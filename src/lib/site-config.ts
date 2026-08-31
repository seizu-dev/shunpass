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

// siteUrl だけは他と違い null を許さない。metadataBase と sitemap は基点が無いと
// 成立せず、「未設定なら描画しない」で逃げられないため必須にしている。
// 以前は既定値へのフォールバックだったが、既定値が本ファイルと
// scripts/generate-site-qr.mjs の2箇所に重複し、片方だけ直すと
// canonical / sitemap / 同梱QR が静かにずれる問題があった（tsc / lint / build の
// どれも検出できない）。既定値そのものを無くし、必須の環境変数にすることで
// 二重管理と「静かにずれる」問題を根本から解消した。
// 末尾スラッシュを落としておかないと sitemap の URL が二重スラッシュになる。
function normalizeSiteUrl(value: string | undefined): string {
  const normalized = normalize(value);
  if (normalized === null) {
    throw new Error(
      'NEXT_PUBLIC_SHUNPASS_SITE_URL が未設定です。' +
        'ローカルでは .env.local に、Vercel では環境変数に設定してください（例: https://example.com/shunpass）。',
    );
  }
  return normalized.replace(/\/+$/, '');
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
