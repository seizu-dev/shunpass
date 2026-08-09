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

export type SiteConfig = {
  contactEmail: string | null;
  contactUrl: string | null;
  repositoryUrl: string | null;
  developerUrl: string | null;
};

export const siteConfig: SiteConfig = {
  contactEmail: normalize(process.env.NEXT_PUBLIC_SHUNPASS_CONTACT_EMAIL),
  contactUrl: normalize(process.env.NEXT_PUBLIC_SHUNPASS_CONTACT_URL),
  repositoryUrl: normalize(process.env.NEXT_PUBLIC_SHUNPASS_REPOSITORY_URL),
  developerUrl: normalize(process.env.NEXT_PUBLIC_SHUNPASS_DEVELOPER_URL),
};
