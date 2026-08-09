const ALLOWED_HOSTS = new Set(['shunsugu.jp', 'www.shunsugu.jp']);
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const ALLOWED_PATHS = new Set(['/chance', '/chance/']);

// 実測サンプルが code=数字10桁 / serial=英数16文字 の2件しかなく、形式が確定していない。
// 厳格にすると正当なQRを弾くリスクの方が大きいため、
// URLのクエリ値として妥当な範囲（英数・ハイフン・アンダースコア）に緩めている。
const VALUE_FORMAT = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * `code` / `serial` の形式検証。QRパースとAPI入力バリデーションの両方で使うため、
 * 正規表現の二重定義を避けてここに一本化している。
 */
export function isValidChanceParam(value: string): boolean {
  return VALUE_FORMAT.test(value);
}

export type ParseFailureReason =
  | 'invalid-url'
  | 'wrong-host'
  | 'wrong-path'
  | 'missing-params'
  | 'invalid-format';

export type ParseResult =
  | { ok: true; value: { code: string; serial: string } }
  | { ok: false; reason: ParseFailureReason };

/**
 * QRが指すURL（`https://shunsugu.jp/chance?code=..&serial=..`）から
 * `code` / `serial` を取り出す。
 */
export function parseChanceUrl(input: string): ParseResult {
  const trimmed = input.trim();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'invalid-url' };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: 'invalid-url' };
  }

  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, reason: 'wrong-host' };
  }

  if (!ALLOWED_PATHS.has(url.pathname)) {
    return { ok: false, reason: 'wrong-path' };
  }

  const code = url.searchParams.get('code');
  const serial = url.searchParams.get('serial');

  if (!code || !serial) {
    return { ok: false, reason: 'missing-params' };
  }

  if (!isValidChanceParam(code) || !isValidChanceParam(serial)) {
    return { ok: false, reason: 'invalid-format' };
  }

  return { ok: true, value: { code, serial } };
}

/**
 * 複数行のURLテキスト（改行区切り）を一括で解析する。
 * serial が重複するQRはカメラ連続スキャンやコピペで混入しやすいため、
 * 先に出てきたものを残して除外する。
 */
export function parseChanceUrls(text: string): {
  items: { code: string; serial: string }[];
  errors: { line: number; reason: ParseFailureReason }[];
  duplicateCount: number;
} {
  const lines = text.split('\n');
  const items: { code: string; serial: string }[] = [];
  const errors: { line: number; reason: ParseFailureReason }[] = [];
  const seenSerials = new Set<string>();
  let duplicateCount = 0;

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line === '') {
      return;
    }

    const result = parseChanceUrl(line);
    if (!result.ok) {
      errors.push({ line: index + 1, reason: result.reason });
      return;
    }

    if (seenSerials.has(result.value.serial)) {
      duplicateCount += 1;
      return;
    }

    seenSerials.add(result.value.serial);
    items.push(result.value);
  });

  return { items, errors, duplicateCount };
}
