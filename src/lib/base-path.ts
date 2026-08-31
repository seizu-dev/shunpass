// next.config.ts の basePath と同じ値をここでも持つ。next.config.ts からは @/ エイリアスが
// 解決できないため二重管理になる（scripts/generate-site-qr.mjs が DEFAULT_SITE_URL を
// 同じ理由で二重管理しているのと同じ前例）。
export const BASE_PATH = '/shunpass';

/**
 * 先頭が `/` のパスに BASE_PATH を前置する。`/_next/*` や next/link は自動で追従するが、
 * 素の絶対パス文字列（fetch のURLや <img src> 等）は追従しないため、それらにだけ使う。
 */
export function withBasePath(path: string): string {
  return path === '/' ? BASE_PATH : `${BASE_PATH}${path}`;
}
