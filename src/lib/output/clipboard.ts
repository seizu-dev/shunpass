import type { ChanceResult } from '@/lib/shunsugu/types';

/**
 * 当たりかつコードが取得できた件だけを改行区切りで連結する。
 * `couponCode` は null / undefined / 空文字の可能性があるため、`status` だけでなく
 * 値自体の非空も確認する（coding-style.md の3通り想定に従う）。
 */
export function buildCouponCodeText(results: ChanceResult[]): string {
  return results
    .filter((result) => result.status === 'hit' && !!result.couponCode)
    .map((result) => result.couponCode as string)
    .join('\n');
}

/**
 * クリップボードへのコピーを試みる。非セキュアコンテキストや権限拒否は珍しくないため
 * 例外にせず false を返し、呼び出し側が代替手段（手動選択用の textarea 等）を出す。
 * コピー対象にはクーポンコードが含まれうるため、失敗理由を console に出さない。
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) {
      return false;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
