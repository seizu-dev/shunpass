// 公開ページ（/about）に載せる連絡先とリポジトリURL。すべて任意で、未設定なら
// 該当セクションを描画しない（Google Tasks の NEXT_PUBLIC_GOOGLE_CLIENT_ID と同じ
// 「未設定＝機能ごと出さない」パターン）。
//
// NEXT_PUBLIC_* はビルド時の静的置換であり、process.env[key] のような動的アクセスでは
// 値が埋まらない。そのため必ず 1 つずつ直接参照する（ループやマップで回さない）。

function normalize(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  // 空文字は未設定として扱う。Vercel 側で変数だけ作って値を入れ忘れた場合に、
  // 空の連絡先セクションが出てしまうのを防ぐ。
  return trimmed === '' ? null : trimmed;
}

// 本番の公開URL。canonical / sitemap / OGP の絶対URLの基点になる。
const DEFAULT_SITE_URL = 'https://seizu.dev/shunpass';

// siteUrl だけは他と違い null を許さない。metadataBase と sitemap は基点が無いと
// 成立せず、「未設定なら描画しない」で逃げられないため既定値に倒す。
// 末尾スラッシュを落としておかないと sitemap の URL が二重スラッシュになる。
function normalizeSiteUrl(value: string | undefined): string {
  const normalized = normalize(value);
  return normalized === null ? DEFAULT_SITE_URL : normalized.replace(/\/+$/, '');
}

export type SiteConfig = {
  siteUrl: string;
  contactEmail: string | null;
  contactUrl: string | null;
  repositoryUrl: string | null;
  developerUrl: string | null;
  googleSiteVerification: string | null;
};

export const siteConfig: SiteConfig = {
  siteUrl: normalizeSiteUrl(process.env.NEXT_PUBLIC_SHUNPASS_SITE_URL),
  contactEmail: normalize(process.env.NEXT_PUBLIC_SHUNPASS_CONTACT_EMAIL),
  contactUrl: normalize(process.env.NEXT_PUBLIC_SHUNPASS_CONTACT_URL),
  repositoryUrl: normalize(process.env.NEXT_PUBLIC_SHUNPASS_REPOSITORY_URL),
  developerUrl: normalize(process.env.NEXT_PUBLIC_SHUNPASS_DEVELOPER_URL),
  googleSiteVerification: normalize(process.env.NEXT_PUBLIC_SHUNPASS_GOOGLE_SITE_VERIFICATION),
};
