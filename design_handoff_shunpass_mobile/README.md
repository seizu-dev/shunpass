# Handoff: 旬パス モバイル向け読み取り／結果画面（2a・2b）

## Overview
`seizu-dev/shunpass`（ブランチ `feat/shunsugu-client`）のトップ画面を、片手のスマホ操作に耐えるように再設計したもの。採用案は 2 画面。

- **2a 読み取り画面** — `src/app/page.tsx` + `src/components/Scanner.tsx` の置き換え
- **2b 結果画面** — `src/components/ResultTable.tsx` の置き換え（テーブル → 縦カード）

元実装からの主な変更点:
1. 冒頭を占めていた免責文を1行の概要＋リンクに圧縮し、本文はページ下部へ移した
2. 待機リストの「削除」を 56px の丸ボタンに拡大（元は約 20px 高のテキストボタン）
3. 「実行／カメラ停止」を画面下部の固定バーに置き、親指の可動域に収めた
4. 待機件数・当たり件数を大きな円形カウンタとして独立させた
5. 結果を横スクロールする `<table>` から縦積みカードに変更。当たりはクーポンコードを最大の要素にし、はずれは1行に圧縮、失敗はエラー文言を展開する

## About the Design Files
同梱の `shunpass-mobile.dc.html` は **HTML で作った design reference**（意図した見た目と挙動を示すプロトタイプ）であり、そのまま本番へ貼るコードではない。作業は、この HTML が示すデザインを **既存の Next.js 16 / React 19 / Tailwind CSS v4 環境の作法で作り直すこと**。ファイルには 1a/1b/1c（初回検討案）と 2a/2b（採用案）が縦に並んでいるが、**実装対象は 2a と 2b のみ**。

ブラウザで開くには同じフォルダ構成のまま `shunpass-mobile.dc.html` を開く（`support.js`、`ios-frame.jsx`、`_ds/…/styles.css` を相対参照している）。iPhone のベゼルは `ios-frame.jsx` によるプレビュー用の枠であり、実装物には含めない。

## Fidelity
**High-fidelity。** 色・タイポ・角丸・タップ領域は下記の値で確定。既存の Tailwind ユーティリティに落として構わないが、寸法と色は一致させてほしい。ダミーの商品コード・serial・クーポンコードはサンプル値。

## Design Tokens

同梱の Organic デザインシステム（`_ds/…/styles.css`）のトークンを使用。ただし **アクセントのみ #aaca26（ライム）に差し替え済み**。実装では下記の値を Tailwind の theme か CSS 変数として持たせる。

### 色

| 役割 | 値 |
| --- | --- |
| 背景 `--color-bg` | `#f5ead8` |
| サーフェス `--color-surface` | `#ebddc5` |
| 本文 `--color-text` | `#201e1d` |
| タイトル文字 | `#402310` |
| 罫線 `--color-divider` | `color-mix(in srgb, #201e1d 16%, transparent)` |
| アクセント 100 | `#f6fbdf` |
| アクセント 200 | `#e9f4bb` |
| アクセント 300 | `#d5e88a` |
| アクセント 400 | `#c0d95a` |
| **アクセント 500（基準）** | `#aaca26` |
| アクセント 600 | `#8ba81b` |
| アクセント 700 | `#6c8412` |
| アクセント 800 | `#4e5f0c` |
| アクセント 900 | `#333e08` |
| 第2アクセント 200 | `#e1eecc` |
| 第2アクセント 600 | `#728157` |
| 第2アクセント 800 | `#3d472b` |
| 第2アクセント 900 | `#272e1b` |
| ニュートラル 400 | `#c0b6a5` |
| ニュートラル 700 | `#645c50` |

**コントラストの注意（重要）:** `#aaca26` はライトな色なので、**ライム地の上にクリーム文字を置いてはいけない**（1.58:1）。ライム地の文字・アイコンは必ず `#333e08`（アクセント900）にする。また 12〜14px の本文サイズでアクセント色の文字を使う場合は `#4e5f0c`〜`#333e08` を使う（`#6c8412` はクリーム地に対し 3.57:1 で不足）。

### タイポグラフィ
- 見出し: `Caprasimo`（欧文のみ。日本語はフォールバック）→ 実装では `font-weight: 800` を併用。ラテン数字のカウンタ（`3`）は Caprasimo が効く
- 本文: `Figtree`, 通常 400 / 強調 600・700
- 等幅（商品コード・serial・クーポンコード）: `ui-monospace, Menlo, monospace`
- サイズ: 画面タイトル 26px / セクション見出し 22px / カード内コード 16px / クーポンコード 21px（`letter-spacing: .04em`）/ 本文 15px / 補助 12.5px / 免責 11.5px（`line-height: 1.6`）

### 角丸・寸法
- カード・カメラ枠: `26px`〜`28px`
- ボタン・タグ・タブ・行: `999px`（ピル）
- 主ボタン高さ `56px` / 副ボタン高さ `56px` / タブ高さ `40px`
- 削除・コピーの丸ボタン: `56px × 56px`
- 番号バッジ: 待機一覧 `34px`、結果一覧 `30px`
- カウンタ円: 2a `56px`、2b `60px`
- 左右パディング `18px`、カード内 `12〜16px`、要素間 `10〜14px`
- 下部固定バー: `padding: 14px 18px 40px`（最後の 40px はホームインジケータ回避）＋背景に `linear-gradient(to top, var(--color-bg) 68%, transparent)`

### アイコン
Lucide、`stroke-width: 2.75`。使用: `trash-2`（削除）、`copy`（コピー）、`chevron-left`（戻る）、`info`（概要）。

## Screens / Views

### 2a 読み取り画面

**Purpose:** パッケージのQRを次々にかざして待機リストに積み、まとめて実行する。

**Layout（上から縦一列、全幅）:**
1. **ヘッダー**（`padding: 60px 18px 0`）
   - `旬パス` — 26px / weight 800 / `#402310` / `line-height: 1.1`
   - 直下に概要文 12.5px / `color-mix(in srgb, #201e1d 62%, transparent)` / `margin-top: 4px`:
     「旬すぐのパッケージQRをまとめて読み取り、クーポンコードだけを一覧で取り出します。**非公式ツール**」
     — 末尾の「非公式ツール」は `#333e08` の下線リンク（`/about` へ、`target="_blank"`。既存実装と同じ理由でタブ遷移させない）
2. **タブ**（`padding: 12px 18px`）— セグメンテッドコントロール。外枠 `background: #ebddc5` / `border-radius: 999px` / `padding: 4px` / `gap: 4px`。各タブ `flex: 1` / 高さ 40px / 14px weight 600 / ピル。選択中は `background: #aaca26` + 文字 `#333e08`、非選択は `color-mix(in srgb, #201e1d 60%, transparent)`。ラベルは `カメラ` / `URL貼り付け`。`white-space: nowrap` 必須（402px 幅で折り返す）
3. **カメラビュー** — `aspect-ratio: 4/3` / `border-radius: 28px` / `overflow: hidden`。中央に照準枠（幅 58%・正方形・`border-radius: 24px`・`border: 3px solid rgba(245,234,216,.8)`）。左下に状態ピル（`background: rgba(32,30,29,.55)` / 文字 `#f5ead8` 12px / 先頭に 7px の丸ドット `#8fa073`）＝「読み取り中」
4. **待機カウンタ**（`margin-top: 14px`）— `background: #e1eecc` / `border-radius: 26px` / `padding: 12px 16px` / `display: flex; gap: 14px`。左に 56px の円（`background: #728157`、文字 `#f5ead8` 24px 見出し体）に件数。右に「件が待機中」15px weight 700 `#272e1b` ＋「続けてQRをかざせます」12.5px `#3d472b` opacity .8
5. **待機リスト** — カードを `gap: 10px` で縦積み。各行: `background: #ebddc5` / `border-radius: 26px` / `padding: 12px 12px 12px 14px` / `display: flex; align-items: center; gap: 12px`
   - 番号バッジ 34px 円 / `background: #f5ead8` / 文字 `#645c50` 14px weight 600 — **新しく読んだものが上（降順）**
   - 中央: 商品コード 16px weight 600 等幅 ／ 下段 `serial ••••b930` 12px opacity .5
   - 右: **56px の削除ボタン** — 円 / `background: #e9f4bb` / アイコン `#4e5f0c` / `trash-2` 24px
6. **すべて消去** — アウトラインのピルボタン、高さ 44px、左寄せ
7. **免責文**（`margin-top: 14px`、11.5px、`color-mix(in srgb, #201e1d 55%, transparent)`）
   「読み取ったQRの情報と取得したクーポンコードは中継のため当方のサーバーを経由しますが、保存もログ出力もしません。旬すぐ運営とは一切関係ありません。**データの取り扱い・免責事項**」（末尾は `#333e08` の下線リンク）
8. **下部固定バー** — `カメラ停止`（幅 118px・アウトライン）＋ `3件を実行`（`flex: 1` / `background: #aaca26` / 文字 `#333e08` / 17px 見出し体）。スクロール領域の下に `padding-bottom: 150px` を確保してバーに隠れないようにする

### 2b 結果画面

**Purpose:** 取得結果を確認し、当たりのクーポンコードをコピー／書き出す。

**Layout:**
1. **ヘッダー**（`padding: 60px 18px 12px` / flex / gap 12px）— 40px の丸い戻るボタン（`chevron-left`、`border: 1px solid divider`）＋ `結果` 22px weight 800 `#402310` ＋ 右端に進捗タグ `12 / 12 件`（`.tag-neutral`: `background: #f9f4ed` / 文字 `#474238` / 11px / ピル）
2. **当たりカウンタ** — `background: #e9f4bb` / `border-radius: 26px` / `padding: 14px 16px`。左に 60px 円（`background: #aaca26`、文字 **`#333e08`** 26px 見出し体）。右に「件が当たりでした」15px weight 700 `#333e08` ＋「はずれ 8件・失敗 1件」12.5px `#4e5f0c` opacity .85
3. **アクション**（`gap: 10px`）
   - `当たり3件を一括コピー` — 高さ 52px の全幅主ボタン（`#aaca26` / 文字 `#333e08` / `copy` アイコン 19px）
   - 下段に 2 つ横並び（各 `flex: 1`、高さ 56px、14px）: `Google Tasks に追加`（アウトライン `divider`）／ `未完了 1件を再実行`（枠 `#aaca26`、文字 `#333e08`）
4. **結果リスト**（`gap: 10px`）— 状態ごとに情報量を変える
   - **当たり** — `background: #f6fbdf` / `border: 1px solid #d5e88a` / `border-radius: 26px` / `padding: 14px 16px`
     - 上段: 30px 番号円（`background: #aaca26`、文字 `#333e08`）／`当たり` タグ（`background: #aaca26`、文字 `#333e08`、weight 600）／右端に `4901234-018 ・ ••••8f21` 11.5px 等幅 opacity .55
     - 下段（`margin-top: 12px` / flex / gap 12px）: クーポンコード **21px weight 600 等幅 `letter-spacing: .04em` `#333e08`** ＋ その下に `有効期限 2026/09/30` 12px `#4e5f0c` opacity .8 ／ 右に **56px の丸コピーボタン**（`background: #aaca26`、アイコン `#333e08`）
   - **はずれ** — 1行に圧縮。`background: #ebddc5` / `padding: 14px 16px` / 番号円（`background: #f5ead8`、文字 `#645c50`）／商品コード 14px＋serial 11.5px opacity .5 ／右端に `はずれ` のニュートラルタグ
   - **失敗** — はずれと同じ行に `border: 1px solid #c0d95a` を足し、タグは `background: #4e5f0c` / 文字 `#f5ead8`。行の下（`margin-top: 8px`）に 12.5px `#4e5f0c` でエラー文言（例:「旬すぐ側からの応答がタイムアウトしました。時間をおいて再試行してください」）。文言は既存の `src/lib/ui-messages.ts` の `describeApiError` をそのまま使う
   - **取得中／待機中** — はずれと同じ行に `取得中` の第2アクセントタグ（`.tag-accent-2`: `background: #f0fae1` / 文字 `#3d472b`）
5. **下部固定バー** — `続けて読み取る` の全幅アウトラインボタン

## Interactions & Behavior

既存の挙動は変えない。UI の変更に伴う分だけ:

- **タブ切り替え** — 現行どおり `Scanner` / `UrlPasteInput` をアンマウント切り替え（カメラを確実に停止するため）。実行中は `disabled`
- **削除** — 56px ボタンのタップで該当 serial を待機リストから除去。誤爆が怖いので確認ダイアログは入れない（取り消しは再スキャンで足りる）
- **すべて消去** — 現行どおり即時クリア
- **実行** — カメラを停止してから `onSubmit`、待機リストを空にする（現行 `handleSubmit` と同じ）
- **下部固定バー** — `position: absolute; bottom: 0`（実装では `position: sticky` か `fixed` + `env(safe-area-inset-bottom)`）。スクロール領域末尾に 130〜150px の余白
- **実行中** — 主ボタンを `中止` に置き換える（現行の `isRunning` 分岐に対応）。結果画面の進捗タグは `完了数 / 総数` を反映
- **コピー** — 現行 `copyToClipboard` を使い、失敗時は手動コピー用の `textarea` を表示。フィードバックは文字だけを差し替え、**クーポンコード自体をフィードバック文に含めない**（既存方針を維持）
- **フィードバック（読み取りました／読み取り済みのQRです）** — 現行の 2500ms 自動消去のまま。カメラビュー直下に表示
- **状態** — `hover` は据え置き（タッチ主体）。`:active` はアクセント1段濃く（`#8ba81b`）。`:focus-visible` は `outline: 2px solid #aaca26; outline-offset: 2px`
- **レスポンシブ** — 設計幅 402px。`max-width: 480px` で中央寄せし、それ以上の幅ではカラム幅を固定して余白を左右に流す

## State Management
既存のままで足りる。追加は不要。
- `page.tsx`: `jobs: ChanceJob[]`、`isRunning`、`tab`、`abortControllerRef`
- `Scanner.tsx`: `phase`、`engine`、`failure`、`feedback`、`pendingItems`、各 ref
- `ResultTable.tsx`: `feedback`、`manualCopyText`
- 結果画面を別ルートにする場合は `jobs` が state のみに存在する点に注意（既存コメントのとおり、同一タブ遷移で全消失する）。**画面内の表示切り替えで実装するのが安全**

## Assets
新規アセットなし。アイコンは Lucide（`stroke-width: 2.75`）。カメラビューのプレビューは実装では `<video>` に置き換える（グラデーションはモック用のプレースホルダ）。

## Files
- `shunpass-mobile.dc.html` — 全案。**2a / 2b が採用案**（`id="2a"`、`id="2b"`）。1a/1b/1c は検討履歴
- `support.js`、`ios-frame.jsx` — プロトタイプを開くためのランタイムとデバイス枠（実装対象外）
- `_ds/organic-…/styles.css` — 元のデザイントークン一式（アクセントは上表のライムに差し替えて使う）

### 対応する実装ファイル
| デザイン | 置き換え先 |
| --- | --- |
| 2a ヘッダー・概要・タブ | `src/app/page.tsx` |
| 2a カメラ・待機リスト・下部バー | `src/components/Scanner.tsx` |
| 2b 結果一覧・アクション | `src/components/ResultTable.tsx` |
| 2b Google Tasks ボタン | `src/components/GoogleTasksExport.tsx` |
| 色・フォントのトークン | `src/app/globals.css`（`@theme inline`） |

**注意:** 現行 `globals.css` はダークモードに追従している（`prefers-color-scheme: dark`）。この配色はクリーム地の単一テーマなので、ダーク対応を残すか落とすかを決める必要がある。落とす場合は `color-scheme: light` 固定にし、`dark:` バリアントを削除する。
