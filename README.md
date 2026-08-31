# shunpass

アプリ上の表示名は **旬パス** です（`shunpass` はリポジトリ名・パッケージ名として使っています）。

旬すぐ（shunsugu.jp）の冷凍総菜パッケージに印字されたQRをまとめて読み取り、
抽選演出を待たずにクーポンコードだけを一覧で取り出す **非公式の個人ツール** です。

**旬すぐの運営とは一切関係がありません。** 提供・許諾・推奨を受けたものではありません。
動作の正確性は保証されません。利用は自己責任でお願いします。

## できること

- カメラでQRを連続スキャンする
- QRのURLをテキストで貼り付けて一括処理する
- 当たりのクーポンコードを一括コピー／Google Tasks へ書き出す

抽選結果は旬すぐ側のサーバーで確定しています。本ツールは結果を読み取って表示するだけで、
当落を書き換えたり、クーポンを使用済みにしたりする操作は行いません。

## データの取り扱い

ブラウザから旬すぐへ直接アクセスすることは CORS の制約でできないため、
**本アプリのサーバーが通信を中継します。** そのため次のデータがサーバーを通過します。

- QRに含まれる商品コード（`item_code`）と `serial`
- 旬すぐから取得した **クーポンコード** と有効期限

これらは **保存しません。** データベースを持たず、サーバーのメモリ上でのみ処理して
応答後に破棄します。ログにも出力せず、エラー応答にも含めません。

例外として以下の2点があります。

1. ホスティング事業者（Vercel）のアクセスログには、リクエストが発生した事実自体が記録されます。
   なお `serial` は POST のボディに入るためURLには現れません。
2. Google Tasks への書き出し機能を使った場合、クーポンコードと商品コードが Google に渡ります
   （利用者が明示的に認可したときのみ。ブラウザから Google へ直接送信され、当方のサーバーは経由しません）。

同じ内容をアプリ内の `/about` にも掲載しています。

開発者: https://seizu.dev

## セットアップ

```bash
npm install
npm run dev          # http://localhost:3000
```

カメラスキャンはセキュアコンテキストでのみ動作します。`localhost` は例外扱いで動きますが、
スマホ実機から LAN 経由で確認する場合は HTTPS が必要です。

```bash
npm run dev:https    # LAN の IP を焼き込んだ自己署名証明書で起動する
```

`certificates/lan.pem` / `lan-key.pem` は含まれていないため、初回は mkcert で自分の
LAN の IP を含む証明書を作ってください（`-install` は不要で、ブラウザ側で警告を許可して進みます）。

```bash
mkcert -key-file certificates/lan-key.pem -cert-file certificates/lan.pem \
       localhost 127.0.0.1 <PC の LAN IP>
```

`next dev` は localhost 以外からの `/_next/*` を既定でブロックします。ブロックされると
**HTML は表示されるのにタップに反応しない**（JS が動かない）状態になり、画面にエラーは出ません。
`next.config.ts` が未設定時に `192.168.*.*` と `10.*.*.*` を許可するので通常は不要ですが、
足りない場合は `.env.local` の `SHUNPASS_DEV_ORIGINS` に追加してください。

### Google Tasks 連携を使う場合

Google Cloud Console で Tasks API を有効化し、OAuth クライアントを**ウェブアプリケーション**として
作成します。認可はブラウザ完結の GIS トークンモデルで行うため **client secret は使いません。**
「承認済みの JavaScript 生成元」にアクセス元のオリジン（`http://localhost:3000` など）を登録し、
**「承認済みのリダイレクト URI」は空のままにします。** 発行された client ID を
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` に設定してください。

なお Google は生の IP アドレスを生成元として受け付けません（例外は `localhost` のみ）。
LAN の IP 直アクセスでは Google Tasks 連携を実機確認できないため、公開ドメインか
`sslip.io` のようなホスト名を使う必要があります。

## 環境変数

`.env.local.example` をコピーして `.env.local` を作成します。**クリーンクローン直後は
`.env.local` が存在しないため、これを作らないとビルドできません**（`.env.local` は
gitignore されているため、コピーし忘れやすい点に注意してください）。
`NEXT_PUBLIC_SHUNPASS_SITE_URL` 以外は任意で、未設定でも基本機能
（スキャンと結果表示、クリップボードへのコピー）は動作します。

| 変数                                            | 用途                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SHUNPASS_SITE_URL`                 | canonical / sitemap / OGP の基点URL。**必須**。未設定だとビルドが失敗する     |
| `NEXT_PUBLIC_SHUNPASS_GOOGLE_SITE_VERIFICATION` | Search Console の所有権確認タグの値。未設定なら meta ごと出力しない           |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`                  | Google Tasks 連携の OAuth クライアントID。未設定なら関連UIを描画しない        |
| `NEXT_PUBLIC_SHUNPASS_CONTACT_EMAIL`            | `/about` に表示する連絡先メール。未設定なら非表示                             |
| `NEXT_PUBLIC_SHUNPASS_CONTACT_URL`              | `/about` に表示する連絡先URL（SNSプロフィール等）。未設定なら非表示           |
| `NEXT_PUBLIC_SHUNPASS_REPOSITORY_URL`           | `/about` に表示するソースコードの公開先。未設定なら非表示                     |
| `NEXT_PUBLIC_SHUNPASS_DEVELOPER_URL`            | フッターと `/about` に表示する開発者サイト。未設定なら非表示                  |
| `SHUNPASS_ENABLE_UPDATE_STATUS`                 | 当たり検出時の開封処理を有効化する。**未検証のため既定 `false` のまま**       |
| `SHUNPASS_DEV_ORIGINS`                          | `next dev` が `/_next/*` を許可するホスト。既定は `192.168.*.*` と `10.*.*.*` |

`NEXT_PUBLIC_*` はビルド時に静的置換されるため、変更したら dev サーバーの再起動
（本番はビルドし直し）が必要です。

## 開発

```bash
npx tsc --noEmit
npm run lint
npm run build        # dev サーバーを止めてから実行すること
npm run sync-wasm    # zxing-wasm を更新したときに .wasm を入れ替える
npm run gen-site-qr  # サイトURLのQRコード（public/site-url-qr.svg）を作り直す
```

`npm run build` は dev サーバーと `.next` を共有するため、起動したまま実行すると
Turbopack の状態が壊れます。壊れた場合は dev サーバーを落とし、`.next` を削除してから
起動し直すと復旧します。

カメラ停止中の枠には、PC（マウス操作の環境）でのみサイトURLのQRコードを表示します。
生成物をコミットしているため、**`NEXT_PUBLIC_SHUNPASS_SITE_URL` を変えたら
`npm run gen-site-qr` を実行し直してください**（ずれても型チェックやビルドでは検出できません）。
別のURLで作る場合は `npm run gen-site-qr -- https://example.com` のように引数で渡します。

## 技術構成

- Next.js 16（App Router / Turbopack）/ React 19 / TypeScript 5 / Tailwind CSS v4
- ホスティング: Vercel
- データベースなし（ステートレス）
- QRデコード: ネイティブ `BarcodeDetector` を優先し、非対応環境のみ
  `barcode-detector`（zxing-wasm）を動的 import。`.wasm` は `public/wasm/` から自己配信

## ライセンス

**ライセンスは付与していません。** 閲覧・検証を目的とした参照は自由に行ってください。
このリポジトリを公開しているのは、`/about` に書いた「何がサーバーを通過し、何を保存しないか」を
利用者がコードで確認できるようにするためです。

一方で、**再配布や複製デプロイは想定していません。** 同じものが各所にデプロイされると
旬すぐ側へのアクセス元が分散して増えることになり、個人運営規模のサービスに負荷をかけます。
本ツールが直列処理と間隔制御でリクエストを抑えているのと同じ理由です。
