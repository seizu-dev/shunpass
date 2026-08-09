import { siteConfig } from '@/lib/site-config';

// Server Component。連絡先と同じ「未設定なら描画しない」パターンで、状態も副作用も持たない。
export default function SiteFooter() {
  return (
    <footer className="mt-8 flex flex-wrap gap-x-4 gap-y-1 border-t border-divider px-[18px] pt-3 pb-[150px] text-[12px] text-text/55">
      {siteConfig.developerUrl !== null && (
        // 素の <a target="_blank"> を使う。同一タブで遷移すると jobs（スキャン結果）は
        // page.tsx の React state にしか無いため全部消える。next/link を使わないのも同じ理由。
        <a
          className="text-accent-900 underline underline-offset-2"
          href={siteConfig.developerUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          開発者
        </a>
      )}
      {siteConfig.repositoryUrl !== null && (
        <a
          className="text-accent-900 underline underline-offset-2"
          href={siteConfig.repositoryUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          ソースコード
        </a>
      )}
      <a
        className="text-accent-900 underline underline-offset-2"
        href="/about"
        target="_blank"
        rel="noopener noreferrer"
      >
        このツールについて
      </a>
    </footer>
  );
}
