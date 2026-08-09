import type { ChanceResult } from '@/lib/shunsugu/types';

export type ChanceApiResult = { ok: true; value: ChanceResult } | { ok: false; errorKind: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ChanceResult には serial も code も含まれない設計だが、レスポンスの型崩れ（上流の
// 仕様変化やプロキシの介在）をここで弾かないと、以降の当落表示が不正な形のまま
// 描画されてしまう。楽観的にキャストせず必須フィールドの型だけ確認する。
function isChanceResult(value: unknown): value is ChanceResult {
  if (!isRecord(value)) {
    return false;
  }

  const { status, couponCode, expiresAt, itemCode, isUnopened, isUnused, isUsed, openedStatus } =
    value;

  if (status !== 'hit' && status !== 'miss') {
    return false;
  }

  if (couponCode !== null && typeof couponCode !== 'string') {
    return false;
  }

  if (expiresAt !== null && typeof expiresAt !== 'string') {
    return false;
  }

  if (typeof itemCode !== 'string') {
    return false;
  }

  if (
    typeof isUnopened !== 'boolean' ||
    typeof isUnused !== 'boolean' ||
    typeof isUsed !== 'boolean'
  ) {
    return false;
  }

  return openedStatus === 'skipped' || openedStatus === 'succeeded' || openedStatus === 'failed';
}

function errorKindFromStatus(status: number): string {
  switch (status) {
    case 400:
      return 'invalid-input';
    case 429:
      return 'rate-limited';
    case 504:
      return 'timeout';
    default:
      return 'upstream-error';
  }
}

async function extractErrorKind(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (isRecord(body) && typeof body.error === 'string') {
      return body.error;
    }
  } catch {
    // ボディが JSON でない場合はステータスから既定値に倒す。
  }
  return errorKindFromStatus(res.status);
}

/**
 * `POST /api/chance` の薄いラッパー。例外を投げず、成否を `ChanceApiResult` で表す。
 */
export async function requestChance(
  input: { code: string; serial: string },
  signal?: AbortSignal,
): Promise<ChanceApiResult> {
  let res: Response;
  try {
    res = await fetch('/api/chance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, errorKind: 'aborted' };
    }
    return { ok: false, errorKind: 'network-error' };
  }

  if (!res.ok) {
    return { ok: false, errorKind: await extractErrorKind(res) };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, errorKind: 'unexpected-response' };
  }

  if (!isChanceResult(body)) {
    return { ok: false, errorKind: 'unexpected-response' };
  }

  return { ok: true, value: body };
}
