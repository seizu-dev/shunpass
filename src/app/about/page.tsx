import type { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/lib/site-config';

// Server Component として描画する。連絡先とリポジトリURLは NEXT_PUBLIC_* のビルド時
// 埋め込みで足り、状態も副作用も持たないため 'use client' は付けない。

export const metadata: Metadata = {
  title: '旬パスについて',
  description:
    '旬パスが何をするツールか、どのデータがサーバーを経由するか、免責事項をまとめたページです。',
};

const SECTION_CLASS = 'flex flex-col gap-3';
const HEADING_CLASS = 'font-heading text-lg font-extrabold text-title';
const TEXT_CLASS = 'text-sm leading-relaxed text-text/70';
const LIST_CLASS = 'flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-text/70';
const LINK_CLASS = 'text-accent-900 underline underline-offset-2 hover:no-underline';

export default function AboutPage() {
  const hasContact = siteConfig.contactEmail !== null || siteConfig.contactUrl !== null;

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-extrabold text-title">旬パスについて</h1>
          <p className={TEXT_CLASS}>
            このページでは、旬パスが何をするツールか、どのデータがどこを経由するか、
            そして免責事項をまとめています。
          </p>
        </div>

        <section className={SECTION_CLASS}>
          <h2 className={HEADING_CLASS}>このツールについて</h2>
          <p className={TEXT_CLASS}>
            旬パスは、旬すぐ（shunsugu.jp）の冷凍総菜パッケージに印字されたQRをまとめて読み取り、
            抽選演出を待たずにクーポンコードだけを一覧で取り出すためのツールです。
          </p>
          <p className={TEXT_CLASS}>
            <strong className="font-semibold text-text">
              個人が作成した非公式のツールであり、旬すぐの運営とは一切関係がありません。
            </strong>
            旬すぐから提供・許諾・推奨を受けたものではありません。
          </p>
          <p className={TEXT_CLASS}>
            抽選の結果は旬すぐ側のサーバーで確定しています。旬パスはその結果を読み取って表示するだけで、
            当落を書き換えることはありません。また、クーポンを使用済みにする操作も行いません。
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={HEADING_CLASS}>データの取り扱い</h2>
          <p className={TEXT_CLASS}>
            ブラウザから旬すぐへ直接アクセスすることはブラウザの制約（CORS）上できないため、
            旬パスのサーバーが通信を中継しています。そのため、次のデータが当方のサーバーを通過します。
          </p>
          <ul className={LIST_CLASS}>
            <li>QRに含まれる商品コード（item_code）と serial</li>
            <li>
              旬すぐから取得した
              <strong className="font-semibold text-text">クーポンコード</strong>
              と有効期限
            </li>
          </ul>

          <h3 className="text-sm font-semibold text-title">利用目的</h3>
          <p className={TEXT_CLASS}>
            旬すぐへの中継と、その結果を利用者の画面へ返すことだけに使用します。
            他の目的には利用しません。
          </p>

          <h3 className="text-sm font-semibold text-title">保存について</h3>
          <p className={TEXT_CLASS}>
            保存しません。旬パスはデータベースを持たず、上記のデータはサーバーのメモリ上でのみ処理され、
            応答を返した時点で破棄されます。ログにも出力せず、エラー応答にも含めません。
          </p>

          <h3 className="text-sm font-semibold text-title">ただし、以下の例外があります</h3>
          <ul className={LIST_CLASS}>
            <li>
              ホスティング事業者（Vercel）のアクセスログには、リクエストが発生した事実そのもの
              （日時・IPアドレス・アクセス先のパスなど）が記録されます。これは当方が制御できません。
              なお serial はリクエストのボディに入るため、URLには現れません。
            </li>
            <li>
              <strong className="font-semibold text-text">
                Google Tasks への書き出し機能を使った場合、クーポンコードと商品コードが Google
                に渡ります。
              </strong>
              これは利用者がボタンを押して認可したときにだけ発生し、ブラウザから Google
              へ直接送信されます （当方のサーバーは経由しません）。使わなければ Google
              との通信は一切発生しません。
            </li>
          </ul>

          <h3 className="text-sm font-semibold text-title">第三者提供</h3>
          <p className={TEXT_CLASS}>
            上記の例外を除き、取得したデータを第三者に提供・販売することはありません。
          </p>

          <h3 className="text-sm font-semibold text-title">通信先</h3>
          <p className={TEXT_CLASS}>
            shunsugu.jp のみです。利用者が Google Tasks への書き出しを選んだ場合に限り、 Google
            の認可サービスおよび Google Tasks API とも通信します。
          </p>

          <p className="text-xs leading-relaxed text-text/55">
            この節は実装の実態を説明したもので、法的な文書として厳密なものではありません。
          </p>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={HEADING_CLASS}>免責事項</h2>
          <ul className={LIST_CLASS}>
            <li>動作および取得結果の正確性を保証しません。</li>
            <li>
              結果の誤り、取得の失敗、取り出したクーポンが利用できない等によって生じた損害について、
              作成者は一切の責任を負いません。
            </li>
            <li>
              旬すぐ側の仕様変更により、予告なく動作しなくなることがあります。
              また、予告なくサービスの提供を停止する場合があります。
            </li>
          </ul>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={HEADING_CLASS}>利用上の注意</h2>
          <ul className={LIST_CLASS}>
            <li>本ツールは非公式です。利用は自己責任でお願いします。</li>
            <li>
              すべての利用者のリクエストが同一のサーバーIPアドレスから発生するため、
              アクセスが集中した場合、旬すぐ側からアクセスを制限され、本ツールが利用できなくなる可能性があります。
            </li>
            <li>
              旬すぐ側の負荷に配慮し、複数のQRを処理する場合も1件ずつ間隔を空けて順番に問い合わせています。
              まとめて実行すると件数に応じた時間がかかります。
            </li>
          </ul>
        </section>

        {siteConfig.repositoryUrl !== null && (
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>ソースコード</h2>
            <p className={TEXT_CLASS}>
              ソースコードは公開しています。データを保存していないことは、実際のコードで確認できます。
            </p>
            <p className={TEXT_CLASS}>
              <a
                className={LINK_CLASS}
                href={siteConfig.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {siteConfig.repositoryUrl}
              </a>
            </p>
          </section>
        )}

        {siteConfig.developerUrl !== null && (
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>開発者について</h2>
            <p className={TEXT_CLASS}>このツールの開発者のサイトです。</p>
            <p className={TEXT_CLASS}>
              <a
                className={LINK_CLASS}
                href={siteConfig.developerUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {siteConfig.developerUrl}
              </a>
            </p>
          </section>
        )}

        {hasContact && (
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>連絡先</h2>
            <ul className={LIST_CLASS}>
              {siteConfig.contactEmail !== null && (
                <li>
                  メール:{' '}
                  <a className={LINK_CLASS} href={`mailto:${siteConfig.contactEmail}`}>
                    {siteConfig.contactEmail}
                  </a>
                </li>
              )}
              {siteConfig.contactUrl !== null && (
                <li>
                  その他:{' '}
                  <a
                    className={LINK_CLASS}
                    href={siteConfig.contactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {siteConfig.contactUrl}
                  </a>
                </li>
              )}
            </ul>
          </section>
        )}

        <p className="text-sm">
          {/* このページは新規タブで開かれる想定で、保持すべき state を持たない。
              トップへ戻る導線は通常の遷移でよいため next/link を使う
              （逆向きのリンクだけは、jobs state を失わないよう素の <a> + target="_blank"）。 */}
          <Link className={LINK_CLASS} href="/">
            旬パスのトップページへ
          </Link>
        </p>
      </main>
    </div>
  );
}
