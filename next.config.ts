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
};

export default nextConfig;
