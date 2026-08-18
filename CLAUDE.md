# shunpass

旬すぐ（shunsugu.jp）のパッケージQRを一括処理し、抽選演出をスキップして
クーポンコードだけを取り出すWebアプリ。

@AGENTS.md

以下は非公開の開発コンテキストで、このリポジトリには含まれない。
`git clone https://github.com/seizu-dev/shunpass-context.git .claude` で用意する
（独立した git リポジトリとして共存し、`.gitignore` で無視される）。
未取得の環境では import が解決されないだけで、ビルドや動作には影響しない。

@.claude/architecture.md
@.claude/coding-style.md
@.claude/workflows.md
@.claude/context/current-sprint.md
@.claude/context/known-issues.md

## Quick facts
- 言語: TypeScript 5.x
- FW: **Next.js 16.2**（App Router / Turbopack）/ React 19.2
- CSS: Tailwind CSS v4（`@tailwindcss/postcss`）
- DB: なし（ステートレス。永続化が必要になったらここを更新する）
- ホスティング: Vercel（GitHub連携済み。`main` への push で本番へ自動デプロイ）
- 対象外部API: `shunsugu.jp` の `/chance/*.json`（非公開・無保証）
