'use client';

import { useState } from 'react';
import type { ChanceJob } from '@/lib/shunsugu/queue';
import { buildCouponCodeText, copyToClipboard } from '@/lib/output/clipboard';
import { maskSerial } from '@/lib/mask';
import { describeApiError } from '@/lib/ui-messages';
import { CheckIcon, ChevronLeftIcon, CopyIcon } from '@/components/Icons';
import GoogleTasksExport from '@/components/GoogleTasksExport';

type ResultTableProps = {
  jobs: ChanceJob[];
  isRunning: boolean;
  onRetry: () => void;
  onAbort: () => void;
  onBack: () => void;
};

const TAG_NEUTRAL_CLASS =
  'flex-none rounded-full bg-neutral-100 px-[10px] py-[3px] text-[11px] whitespace-nowrap text-neutral-800';
const NUMBER_BADGE_CLASS =
  'grid h-[30px] w-[30px] flex-none place-items-center rounded-full text-[13px] font-semibold';

function formatExpiresAt(expiresAt: string | null): string {
  if (expiresAt === null) {
    return '—';
  }
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function ResultTable({
  jobs,
  isRunning,
  onRetry,
  onAbort,
  onBack,
}: ResultTableProps) {
  // コピー対象のテキストにクーポンコードが含まれるため、フィードバックメッセージや
  // フォールバック表示にもクーポンコード自体を残さない（一括分は件数のみ表示）。
  const [feedback, setFeedback] = useState<string | null>(null);
  const [manualCopyText, setManualCopyText] = useState<string | null>(null);

  const hitResults = jobs.filter((job) => job.result?.status === 'hit').map((job) => job.result!);
  const incompleteCount = jobs.filter(
    (job) => job.state === 'failed' || job.state === 'pending',
  ).length;
  const completedCount = jobs.filter(
    (job) => job.state === 'done' || job.state === 'failed',
  ).length;
  const loseCount = jobs.filter(
    (job) => job.state === 'done' && job.result?.status !== 'hit',
  ).length;
  const failedCount = jobs.filter((job) => job.state === 'failed').length;
  const unprocessedCount = jobs.filter(
    (job) => job.state === 'pending' || job.state === 'running',
  ).length;

  // 「まだ動いているのか、終わったのか」をヘッダーだけで判断できるようにするための区分。
  // 中断や失敗が残った状態を「完了」と言い切らないよう、3値に分けている。
  const runStatus = isRunning ? 'running' : incompleteCount > 0 ? 'incomplete' : 'complete';
  const progressPercent = jobs.length === 0 ? 0 : Math.round((completedCount / jobs.length) * 100);

  const summaryParts: string[] = [];
  if (loseCount > 0) {
    summaryParts.push(`はずれ ${loseCount}件`);
  }
  if (failedCount > 0) {
    summaryParts.push(`失敗 ${failedCount}件`);
  }
  if (unprocessedCount > 0) {
    summaryParts.push(`未処理 ${unprocessedCount}件`);
  }

  async function handleCopyAll(): Promise<void> {
    const text = buildCouponCodeText(hitResults);
    const ok = await copyToClipboard(text);
    if (ok) {
      setManualCopyText(null);
      setFeedback(`${hitResults.length} 件をコピーしました`);
    } else {
      setManualCopyText(text);
      setFeedback('自動コピーに失敗しました。下のボックスから手動でコピーしてください');
    }
  }

  async function handleCopyOne(couponCode: string): Promise<void> {
    const ok = await copyToClipboard(couponCode);
    if (ok) {
      setManualCopyText(null);
      setFeedback('コピーしました');
    } else {
      setManualCopyText(couponCode);
      setFeedback('自動コピーに失敗しました。下のボックスから手動でコピーしてください');
    }
  }

  return (
    <div>
      <header className="pt-head flex items-center gap-3 px-[18px] pb-3">
        <button
          type="button"
          className="grid h-10 w-10 flex-none place-items-center rounded-full border border-divider"
          aria-label="読み取り画面へ戻る"
          onClick={onBack}
        >
          <ChevronLeftIcon size={20} />
        </button>
        <h1 className="font-heading text-[22px] font-extrabold text-title">結果</h1>
        <div className="flex-1" />

        {runStatus === 'running' && (
          <span className="flex flex-none items-center gap-[6px] rounded-full bg-accent2-100 px-[10px] py-[5px] text-[11px] whitespace-nowrap text-accent2-800">
            <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-accent2-600" />
            取得中 {completedCount} / {jobs.length}
          </span>
        )}
        {/* key を付けて、実行中から切り替わった瞬間に一度だけフラッシュさせる。 */}
        {runStatus === 'complete' && (
          <span
            key="complete"
            className="on-accent flash-pop flex flex-none items-center gap-[5px] rounded-full px-[10px] py-[5px] text-[11px] font-semibold whitespace-nowrap"
          >
            <CheckIcon size={13} />
            完了 {jobs.length}件
          </span>
        )}
        {runStatus === 'incomplete' && (
          <span className="flex-none rounded-full border border-accent-400 bg-surface px-[10px] py-[4px] text-[11px] whitespace-nowrap text-accent-800">
            未完了 {incompleteCount}件
          </span>
        )}
      </header>

      {/* 進捗バーは実行中だけ出す。満ちきったバーを残すより、消えて「完了」タグに
          変わったほうが状態の切り替わりが分かりやすい。 */}
      {runStatus === 'running' && (
        <div className="px-[18px] pb-3">
          <div className="h-[6px] w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* 下部固定バーに隠れないよう、スクロール領域の末尾に余白を確保する。 */}
      <div className="px-[18px] pb-[130px]">
        <div className="flex items-center gap-[14px] rounded-[26px] bg-accent-200 px-4 py-[14px]">
          <div className="on-accent grid h-[60px] w-[60px] flex-none place-items-center rounded-full font-heading text-[26px]">
            {hitResults.length}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-accent-900">件が当たりでした</div>
            <div className="text-[12.5px] text-accent-800 opacity-85">
              {summaryParts.length > 0 ? summaryParts.join('・') : '取得を開始しています'}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-[10px]">
          <button
            type="button"
            className="on-accent flex h-[52px] w-full items-center justify-center gap-2 rounded-full font-heading text-[17px] disabled:opacity-40"
            disabled={hitResults.length === 0}
            onClick={handleCopyAll}
          >
            <CopyIcon size={19} />
            当たり{hitResults.length}件を一括コピー
          </button>

          <div className="flex gap-[10px]">
            <GoogleTasksExport results={hitResults} isRunning={isRunning} />
            {!isRunning && incompleteCount > 0 && (
              <button
                type="button"
                className="h-14 flex-1 rounded-full border border-accent text-[14px] font-semibold text-accent-900"
                onClick={onRetry}
              >
                未完了 {incompleteCount}件を再実行
              </button>
            )}
          </div>
        </div>

        {feedback && <p className="mt-3 text-[12.5px] text-text/70">{feedback}</p>}

        {manualCopyText !== null && (
          <textarea
            readOnly
            className="mt-2 w-full rounded-[20px] border border-divider bg-bg p-3 font-mono text-[14px]"
            value={manualCopyText}
            onFocus={(event) => event.currentTarget.select()}
          />
        )}

        <ul className="mt-4 flex flex-col gap-[10px]">
          {jobs.map((job, index) => {
            const number = index + 1;
            const itemCode = job.result?.itemCode ?? job.code;
            const maskedSerial = maskSerial(job.serial);

            if (job.state === 'done' && job.result?.status === 'hit' && job.result.couponCode) {
              const couponCode = job.result.couponCode;
              return (
                <li
                  key={job.id}
                  className="rounded-[26px] border border-accent-300 bg-accent-100 px-4 py-[14px]"
                >
                  <div className="flex items-center gap-[10px]">
                    <span className={`${NUMBER_BADGE_CLASS} on-accent`}>{number}</span>
                    <span className="on-accent flex-none rounded-full px-[10px] py-[3px] text-[11px] font-semibold whitespace-nowrap">
                      当たり
                    </span>
                    <div className="flex-1" />
                    <div className="truncate font-mono text-[11.5px] opacity-55">
                      {itemCode} ・ {maskedSerial}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[21px] font-semibold tracking-[0.04em] text-accent-900">
                        {couponCode}
                      </div>
                      <div className="mt-[3px] text-[12px] text-accent-800 opacity-80">
                        有効期限 {formatExpiresAt(job.result.expiresAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="on-accent grid h-14 w-14 flex-none place-items-center rounded-full"
                      aria-label="このクーポンコードをコピー"
                      onClick={() => handleCopyOne(couponCode)}
                    >
                      <CopyIcon size={24} />
                    </button>
                  </div>
                </li>
              );
            }

            if (job.state === 'failed') {
              return (
                <li
                  key={job.id}
                  className="rounded-[26px] border border-accent-400 bg-surface px-4 py-[14px]"
                >
                  <div className="flex items-center gap-3">
                    <span className={`${NUMBER_BADGE_CLASS} bg-bg text-neutral-700`}>{number}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[14px]">{itemCode}</div>
                      <div className="mt-0.5 truncate font-mono text-[11.5px] opacity-50">
                        {maskedSerial}
                      </div>
                    </div>
                    <span className="flex-none rounded-full bg-accent-800 px-[10px] py-[3px] text-[11px] whitespace-nowrap text-bg">
                      失敗
                    </span>
                  </div>
                  <div className="mt-2 text-[12.5px] leading-[1.5] text-accent-800">
                    {describeApiError(job.errorKind ?? '')}
                  </div>
                </li>
              );
            }

            return (
              <li
                key={job.id}
                className="flex items-center gap-3 rounded-[26px] bg-surface px-4 py-[14px]"
              >
                <span className={`${NUMBER_BADGE_CLASS} bg-bg text-neutral-700`}>{number}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[14px]">{itemCode}</div>
                  <div className="mt-0.5 truncate font-mono text-[11.5px] opacity-50">
                    {maskedSerial}
                  </div>
                </div>
                {job.state === 'done' && <span className={TAG_NEUTRAL_CLASS}>はずれ</span>}
                {/* 今どの行を処理しているかが一覧の中で分かるよう、取得中だけ点滅させる。 */}
                {job.state === 'running' && (
                  <span className="flex flex-none items-center gap-[5px] rounded-full bg-accent2-100 px-[10px] py-[3px] text-[11px] whitespace-nowrap text-accent2-800">
                    <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-accent2-600" />
                    取得中
                  </span>
                )}
                {job.state === 'pending' && <span className={TAG_NEUTRAL_CLASS}>待機中</span>}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="bar-fade fixed inset-x-0 bottom-0 z-10">
        <div className="pb-home mx-auto w-full max-w-[480px] px-[18px] pt-[14px]">
          {isRunning ? (
            // 実行中に読み取り画面へ戻ると中止ボタンが視界から消えるため、こちらにも置く。
            <button
              type="button"
              className="h-14 w-full rounded-full border border-accent text-[15px] font-semibold text-accent-900"
              onClick={onAbort}
            >
              中止
            </button>
          ) : (
            <button
              type="button"
              className="h-14 w-full rounded-full border border-divider text-[15px] font-semibold"
              onClick={onBack}
            >
              続けて読み取る
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
