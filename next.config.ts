import type { NextConfig } from 'next';

// next dev は localhost 以外からの /_next/* へのアクセスを既定でブロックする。
// ブロックされるとページは表示されるのにタップに一切反応しない状態になり、画面には何も出ない
// （.claude/context/known-issues.md 参照）。カメラスキャンはセキュアコンテキスト必須で
// localhost では実機確認ができないため、スマホから LAN 越しに開けるよう許可する。
// dev 専用の設定で本番には影響しない。
//
// LAN の構成は環境ごとに違うので .env.local の SHUNPASS_DEV_ORIGINS で上書きできるようにし、
// 未設定時は一般的なプライベート範囲にフォールバックする。
// 172.16〜31 は既定に入れていない。ワイルドカードが範囲指定に対応しておらず、
// 172.*.*.* と書くと公衆IPまで含んでしまうため（必要なら .env.local に明示する）。
const DEFAULT_DEV_ORIGINS = ['192.168.*.*', '10.*.*.*'];

const devOrigins =
  process.env.SHUNPASS_DEV_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? DEFAULT_DEV_ORIGINS;

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,

  // Cloudflare Tunnel が seizu.dev/shunpass 配下をパスを剥がさずそのまま Vercel へ転送するため、
  // Next.js 側もこのサブパスで応答する必要がある。src/lib/base-path.ts の BASE_PATH と対にすること。
  basePath: '/shunpass',

  async redirects() {
    return [
      {
        // basePath はビルド時に埋め込まれ1ビルド1パスになるため、素の shunpass.vercel.app/ は
        // 404になる。その逃げとして /shunpass へ流す。source 自体への basePath の前置を
        // 避けるため basePath: false が要る（無いと source が /shunpass/ になってしまう）。
        // seizu.dev/ は Cloudflare 側で既存サイトに向いており Vercel には到達しないため、
        // この redirect の影響を受けない。
        source: '/',
        destination: '/shunpass',
        permanent: false,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
