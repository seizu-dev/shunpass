'use client';

import { useEffect, useRef, useState } from 'react';
import { withBasePath } from '@/lib/base-path';
import Scanner from '@/components/Scanner';
import UrlPasteInput from '@/components/UrlPasteInput';
import ResultTable from '@/components/ResultTable';
import SiteFooter from '@/components/SiteFooter';
import { createChanceJob, runChanceQueue, type ChanceJob } from '@/lib/shunsugu/queue';

type InputTab = 'camera' | 'paste';

// 結果は別ルートにせず画面内で切り替える。jobs は React state にしか無いため、
// 同一タブでのページ遷移を挟むと全部消える（/about へのリンクを新規タブにしているのと同じ理由）。
type View = 'input' | 'results';

const TABS = [
  ['camera', 'カメラ'],
  ['paste', 'URL貼り付け'],
] as const;

export default function Home() {
  const [jobs, setJobs] = useState<ChanceJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [tab, setTab] = useState<InputTab>('camera');
  const [view, setView] = useState<View>('input');
  const abortControllerRef = useRef<AbortController | null>(null);

  // アンマウント時に直列処理が残っていれば必ず中断する。旬すぐへのリクエストは
  // 画面が閉じられた後もバックグラウンドで続ける理由がない。
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function runQueueOn(targetJobs: ChanceJob[]): Promise<void> {
    // ボタンの disabled は再描画タイミングに依存するため、同期的に判定できる ref を
    // 二重起動防止の本体にする。ここを素通りすると abortControllerRef.current が
    // 上書きされ、古い AbortController を誰も abort できないまま直列ループが2本
    // 並走し、旬すぐへ並列リクエストが飛んでしまう。
    if (abortControllerRef.current !== null) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsRunning(true);

    const items = targetJobs.map((job) => ({ code: job.code, serial: job.serial }));

    try {
      await runChanceQueue(
        items,
        {
          onStart: (index) => {
            const jobId = targetJobs[index].id;
            setJobs((prev) =>
              prev.map((job) => (job.id === jobId ? { ...job, state: 'running' } : job)),
            );
          },
          onSettled: (index, result) => {
            const jobId = targetJobs[index].id;
            setJobs((prev) =>
              prev.map((job) => {
                if (job.id !== jobId) {
                  return job;
                }
                if (result.ok) {
                  return { ...job, state: 'done', result: result.value, errorKind: null };
                }
                return { ...job, state: 'failed', result: null, errorKind: result.errorKind };
              }),
            );
          },
        },
        { signal: controller.signal },
      );
    } finally {
      // 例外が飛んだ場合でも isRunning を確実に戻す。ここが true のまま固まると
      // リロードするまで実行ボタンが押せなくなる。
      abortControllerRef.current = null;
      setIsRunning(false);
    }
  }

  function handleSubmit(items: { code: string; serial: string }[]): void {
    const newJobs = items.map((item) => createChanceJob(item));
    setJobs(newJobs);
    setView('results');
    void runQueueOn(newJobs);
  }

  function handleAbort(): void {
    abortControllerRef.current?.abort();
  }

  function handleRerunIncomplete(): void {
    // failed だけでなく pending も対象にする。中断すると処理中だった1件は failed に
    // なるが、まだ着手していない後続ジョブは pending のまま残り、failed だけを
    // 拾う実装だとそれらを再開する手段がUI上に無くなるため。
    // 同じ runQueueOn に再投入する（別実装にすると間隔制御の保証が二重管理になり崩れやすい）。
    const incompleteJobs = jobs.filter((job) => job.state === 'failed' || job.state === 'pending');
    if (incompleteJobs.length === 0) {
      return;
    }
    const incompleteIds = new Set(incompleteJobs.map((job) => job.id));
    setJobs((prev) =>
      prev.map((job) =>
        incompleteIds.has(job.id) ? { ...job, state: 'pending', errorKind: null } : job,
      ),
    );
    void runQueueOn(incompleteJobs);
  }

  const completedCount = jobs.filter(
    (job) => job.state === 'done' || job.state === 'failed',
  ).length;

  // カメラで同じQRを読み直しても二重登録しないよう、取得済みの serial を Scanner に渡す。
  const knownSerials = new Set(jobs.map((job) => job.serial));

  if (view === 'results') {
    return (
      <div className="mx-auto w-full max-w-[480px] flex-1">
        <ResultTable
          jobs={jobs}
          isRunning={isRunning}
          onRetry={handleRerunIncomplete}
          onAbort={handleAbort}
          onBack={() => setView('input')}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[480px] flex-1">
      <header className="pt-head px-[18px]">
        {/* 「結果」ボタンはタイトルと同じ行に置く。概要文と横並びにすると、
            ボタンの幅のぶん概要文が早く折り返して右側に空きができる。 */}
        <div className="flex items-center gap-[10px]">
          <h1 className="min-w-0 flex-1 font-heading text-[26px] leading-[1.1] font-extrabold text-title">
            旬パス
          </h1>
          {jobs.length > 0 && (
            // 実行すると結果画面へ切り替わるため、戻ってきた後に結果を開き直す導線が要る。
            <button
              type="button"
              className="flex-none rounded-full bg-neutral-100 px-[10px] py-[6px] text-[11px] whitespace-nowrap text-neutral-800"
              onClick={() => setView('results')}
            >
              結果 {completedCount} / {jobs.length}
            </button>
          )}
        </div>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-text/60">
          旬すぐのパッケージQRをまとめて読み取り、クーポンコードだけを一覧で取り出します。
          {/* 素の <a> を新規タブで開く。同一タブで遷移すると jobs（スキャン結果）は
              React state にしか無いため全部消える。next/link を使わないのも同じ理由。 */}
          <a
            className="text-accent-900 underline underline-offset-2"
            href={withBasePath('/about')}
            target="_blank"
            rel="noopener noreferrer"
          >
            非公式ツール
          </a>
        </p>
      </header>

      <div className="px-[18px] py-3">
        <div className="flex gap-1 rounded-full bg-surface p-1">
          {TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                tab === value
                  ? 'h-10 flex-1 rounded-full bg-accent text-[14px] font-semibold whitespace-nowrap text-accent-900 disabled:opacity-40'
                  : 'h-10 flex-1 rounded-full text-[14px] font-semibold whitespace-nowrap text-text/60 disabled:opacity-40'
              }
              aria-pressed={tab === value}
              disabled={isRunning}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 非表示ではなくアンマウントする。Scanner のクリーンアップでカメラを確実に止めるため。 */}
      <div className="px-[18px]">
        {tab === 'camera' ? (
          <Scanner
            isRunning={isRunning}
            knownSerials={knownSerials}
            onSubmit={handleSubmit}
            onAbort={handleAbort}
          />
        ) : (
          <UrlPasteInput isRunning={isRunning} onSubmit={handleSubmit} onAbort={handleAbort} />
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
