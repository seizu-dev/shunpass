import type { ChanceResult, ShunsuguChanceResponse } from './types';

const CHANCE_PAGE_URL = 'https://shunsugu.jp/chance';
const INITIAL_RESULT_URL = 'https://shunsugu.jp/chance/initial.json';
const UPDATE_STATUS_URL = 'https://shunsugu.jp/chance/update_status.json';

// 実ブラウザに近いヘッダーで叩かないと Rails 側の挙動（CSRF検証やレスポンス形）が
// 変わる可能性があるため、UA と Accept を明示的に揃える。
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 個人運営規模の上流に配慮し、1件あたりの待ち時間が極端に伸びないよう上限を設ける。
const REQUEST_TIMEOUT_MS = 10_000;

// Rails の csrf_meta_tags は `name` → `content` の順・ダブルクォートで出力するが、
// 属性順とクォート種別のどちらが変わってもトークンを見失うと全件失敗するため、
// 両方の並びとクォートを許容している（HTMLパーサーは導入しない）。
const CSRF_TOKEN_PATTERN =
  /<meta\s+(?:name=["']csrf-token["']\s+content=["']([^"']*)["']|content=["']([^"']*)["']\s+name=["']csrf-token["'])/;

export type ChanceFetchErrorKind =
  | 'upstream-error'
  | 'csrf-not-found'
  | 'csrf-rejected'
  | 'unexpected-response'
  | 'timeout'
  | 'network-error';

export class ChanceFetchError extends Error {
  readonly kind: ChanceFetchErrorKind;

  constructor(kind: ChanceFetchErrorKind, message: string) {
    super(message);
    this.name = 'ChanceFetchError';
    this.kind = kind;
  }
}

function isAbortOrTimeoutError(error: unknown): boolean {
  // fetch の AbortSignal.timeout() は DOMException を投げる環境と TimeoutError を
  // 投げる環境があり、name だけで判定する（instanceof は環境差の影響を受けやすい）。
  return (
    error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

async function fetchChancePage(
  code: string,
  serial: string,
): Promise<{ csrfToken: string; cookie: string; pageUrl: string }> {
  const pageUrl = `${CHANCE_PAGE_URL}?code=${encodeURIComponent(code)}&serial=${encodeURIComponent(serial)}`;

  let res: Response;
  try {
    res = await fetch(pageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (isAbortOrTimeoutError(error)) {
      throw new ChanceFetchError('timeout', 'upstream request timed out');
    }
    throw new ChanceFetchError('network-error', 'failed to reach upstream');
  }

  if (!res.ok) {
    throw new ChanceFetchError('upstream-error', 'upstream returned a non-success status');
  }

  // Set-Cookie は複数回送られてくることがあり、Headers#get('set-cookie') では
  // カンマ結合されて壊れるため、複数値を保ったまま取り出せる getSetCookie() を使う。
  // 各値の `name=value` 部分（`;` より前）だけを繋ぎ直し、次のリクエストの Cookie にする。
  const cookie = res.headers
    .getSetCookie()
    .map((entry) => entry.split(';', 1)[0])
    .join('; ');

  const html = await res.text();
  const match = CSRF_TOKEN_PATTERN.exec(html);
  const csrfToken = match?.[1] ?? match?.[2];

  if (!csrfToken) {
    throw new ChanceFetchError('csrf-not-found', 'csrf token was not found in upstream page');
  }

  return { csrfToken, cookie, pageUrl };
}

async function fetchChanceInitial(input: {
  code: string;
  serial: string;
  csrfToken: string;
  cookie: string;
  pageUrl: string;
}): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(INITIAL_RESULT_URL, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': input.csrfToken,
        Cookie: input.cookie,
        Referer: input.pageUrl,
      },
      body: JSON.stringify({ code: input.code, serial: input.serial }),
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (isAbortOrTimeoutError(error)) {
      throw new ChanceFetchError('timeout', 'upstream request timed out');
    }
    throw new ChanceFetchError('network-error', 'failed to reach upstream');
  }

  // 実測で、CSRF検証に失敗すると 422 / トークンが正しく無効な serial だと 500 と
  // はっきり分かれた。422 はこちらの実装か上流仕様の変化を示すため別扱いにする。
  if (res.status === 422) {
    throw new ChanceFetchError('csrf-rejected', 'upstream rejected the csrf token');
  }

  if (!res.ok) {
    throw new ChanceFetchError('upstream-error', 'upstream returned a non-success status');
  }

  try {
    return await res.json();
  } catch {
    throw new ChanceFetchError('unexpected-response', 'upstream response was not valid JSON');
  }
}

// 未開封 serial での検証が済んでいないため、既定では無効。有効化した場合のみ
// 実際に unopened -> unused の状態遷移を通す（.claude/context/known-issues.md 参照）。
function isUpdateStatusEnabled(): boolean {
  return process.env.SHUNPASS_ENABLE_UPDATE_STATUS === 'true';
}

// 当たり検出時のみ呼ぶ。initial.json と同一セッションの csrfToken / cookie を使い回す。
// 失敗しても呼び出し元でクーポンコードの取得自体は成立させるため、例外は投げず
// 成否だけを返す。
async function postUpdateStatus(input: {
  customerCouponId: number;
  csrfToken: string;
  cookie: string;
  pageUrl: string;
}): Promise<boolean> {
  try {
    const res = await fetch(UPDATE_STATUS_URL, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': input.csrfToken,
        Cookie: input.cookie,
        Referer: input.pageUrl,
      },
      body: JSON.stringify({ customer_coupon_id: input.customerCouponId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    return res.ok;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// coupon_code は null / undefined / キー欠落の3通りをすべて「はずれ」として扱うため、
// 文字列であることだけを厳密にチェックし、他は緩く許容する。
function isShunsuguChanceResponse(value: unknown): value is ShunsuguChanceResponse {
  if (!isRecord(value)) {
    return false;
  }

  const { chance_video, coupon, video, customer_coupon } = value;

  if (!isRecord(chance_video) || !isRecord(coupon) || !isRecord(customer_coupon)) {
    return false;
  }

  if (typeof video !== 'string') {
    return false;
  }

  // update_status.json のボディに使うため、開封処理を安全に呼べるかどうかの土台として
  // ここで number であることを確定させる（当落判定そのものには不要）。
  if (typeof customer_coupon.id !== 'number') {
    return false;
  }

  const couponCode = customer_coupon.coupon_code;
  if (couponCode !== null && couponCode !== undefined && typeof couponCode !== 'string') {
    return false;
  }

  const expiredAt = customer_coupon.expired_at;
  if (expiredAt !== null && expiredAt !== undefined && typeof expiredAt !== 'string') {
    return false;
  }

  // 開封状態のフラグは判定に使わない補助情報なので、欠落していても異常扱いにしない。
  // ここを必須にすると、はずれのレスポンス形が想定と違ったときに当落まで取れなくなる。
  return typeof customer_coupon.item_code === 'string';
}

function normalize(
  response: ShunsuguChanceResponse,
  openedStatus: ChanceResult['openedStatus'],
): ChanceResult {
  const customerCoupon = response.customer_coupon;

  // 当落判定はここだけ。chance_video.hit は実測で当たり/はずれが逆転しており
  // 意味が確定していないため使わない（.claude/context/known-issues.md 参照）。
  // null / undefined / キー欠落の3通りをまとめて「はずれ」に倒す。
  const couponCode =
    typeof customerCoupon.coupon_code === 'string' ? customerCoupon.coupon_code : null;

  return {
    status: couponCode !== null ? 'hit' : 'miss',
    couponCode,
    expiresAt: customerCoupon.expired_at ?? null,
    itemCode: customerCoupon.item_code,
    isUnopened: customerCoupon['unopened?'] ?? false,
    isUnused: customerCoupon['unused?'] ?? false,
    isUsed: customerCoupon['used?'] ?? false,
    openedStatus,
  };
}

/**
 * 旬すぐの抽選APIを演出無しで叩き、当落と結果を取得する。
 * サーバ専用（Route Handler からのみ呼ぶ）。code / serial はエラーメッセージやログに含めない。
 */
export async function fetchChanceResult(input: {
  code: string;
  serial: string;
}): Promise<ChanceResult> {
  const { csrfToken, cookie, pageUrl } = await fetchChancePage(input.code, input.serial);

  const raw = await fetchChanceInitial({
    code: input.code,
    serial: input.serial,
    csrfToken,
    cookie,
    pageUrl,
  });

  if (!isShunsuguChanceResponse(raw)) {
    throw new ChanceFetchError('unexpected-response', 'upstream response had an unexpected shape');
  }

  const isHit = typeof raw.customer_coupon.coupon_code === 'string';

  // 当たりを検出したときだけ、正規の状態遷移（unopened → unused）を通す。
  // initial.json と同一セッションの csrfToken / cookie をそのまま使い回す
  // （新しくページを取り直すとセッションが変わり検証が通らない）。
  // 未開封 serial での検証が済んでいないため、フラグが有効な場合のみ実際に叩く
  // （.claude/context/known-issues.md「未検証の懸念」参照）。失敗しても取得済みの
  // クーポンコードは返す。
  let openedStatus: ChanceResult['openedStatus'] = 'skipped';
  if (isHit && isUpdateStatusEnabled()) {
    const succeeded = await postUpdateStatus({
      customerCouponId: raw.customer_coupon.id,
      csrfToken,
      cookie,
      pageUrl,
    });
    openedStatus = succeeded ? 'succeeded' : 'failed';
  }

  return normalize(raw, openedStatus);
}
