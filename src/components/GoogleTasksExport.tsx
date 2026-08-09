'use client';

import { useState } from 'react';
import type { ChanceResult } from '@/lib/shunsugu/types';
import {
  createCouponTasks,
  isGoogleTasksConfigured,
  listGoogleTaskLists,
  requestGoogleAccessToken,
  type GoogleTaskList,
  type GoogleTasksErrorKind,
} from '@/lib/output/google-tasks';
import { describeGoogleTasksFailure } from '@/lib/ui-messages';

const LAST_TASK_LIST_ID_KEY = 'shunpass.googleTasks.listId';

type GoogleTasksExportProps = {
  results: ChanceResult[];
  isRunning: boolean;
};

function readStoredTaskListId(): string | null {
  try {
    return window.localStorage.getItem(LAST_TASK_LIST_ID_KEY);
  } catch {
    return null;
  }
}

function storeTaskListId(taskListId: string): void {
  try {
    window.localStorage.setItem(LAST_TASK_LIST_ID_KEY, taskListId);
  } catch {
    // Safari のプライベートモード等で書き込みが例外になることがあるが、
    // 選択の永続化は補助機能のため失敗しても機能自体は継続させる。
  }
}

export default function GoogleTasksExport({ results, isRunning }: GoogleTasksExportProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<GoogleTasksErrorKind | null>(null);

  const hitResults = results.filter((result) => result.status === 'hit' && !!result.couponCode);

  if (!isGoogleTasksConfigured() || hitResults.length === 0) {
    return null;
  }

  async function handleAuthorize(): Promise<void> {
    setIsBusy(true);
    setFeedback(null);
    setErrorKind(null);

    const tokenResult = await requestGoogleAccessToken();
    if (!tokenResult.ok) {
      setErrorKind(tokenResult.errorKind);
      setIsBusy(false);
      return;
    }

    const listsResult = await listGoogleTaskLists(tokenResult.value);
    if (!listsResult.ok) {
      if (listsResult.errorKind === 'unauthorized') {
        setAccessToken(null);
      }
      setErrorKind(listsResult.errorKind);
      setIsBusy(false);
      return;
    }

    const storedId = readStoredTaskListId();
    const restored = listsResult.value.find((list) => list.id === storedId);
    const initialListId = restored?.id ?? listsResult.value[0]?.id ?? '';

    setAccessToken(tokenResult.value);
    setTaskLists(listsResult.value);
    setSelectedListId(initialListId);
    setIsBusy(false);
  }

  async function handleCreateTasks(): Promise<void> {
    if (accessToken === null || selectedListId === '') {
      return;
    }

    setIsBusy(true);
    setFeedback(null);
    setErrorKind(null);
    setProgress({ done: 0, total: hitResults.length });

    const result = await createCouponTasks(accessToken, selectedListId, hitResults, (doneCount) => {
      setProgress({ done: doneCount, total: hitResults.length });
    });

    setProgress(null);

    if (!result.ok) {
      if (result.errorKind === 'unauthorized') {
        setAccessToken(null);
      }
      setErrorKind(result.errorKind);
      setIsBusy(false);
      return;
    }

    storeTaskListId(selectedListId);
    const { createdCount, failedCount } = result.value;
    setFeedback(
      failedCount > 0
        ? `${createdCount}件を追加しました（${failedCount}件失敗）`
        : `${createdCount}件を追加しました`,
    );
    setIsBusy(false);
  }

  const isAuthorized = accessToken !== null;

  return (
    // 結果画面のアクション行に並ぶため、flex-1 で横幅を折半する側になる。
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {!isAuthorized && (
        <button
          type="button"
          className="h-14 w-full rounded-full border border-divider text-[14px] font-semibold disabled:opacity-40"
          disabled={isBusy || isRunning}
          onClick={handleAuthorize}
        >
          Google Tasks に追加
        </button>
      )}

      {isAuthorized && (
        <>
          {/* 背景色と文字色を明示しないと、UA既定の白背景に inherit した明色の文字が
              乗って読めなくなる（globals.css の color-scheme と対で効かせている）。 */}
          <select
            className="h-14 w-full rounded-full border border-divider bg-bg px-4 text-[14px] font-semibold text-text disabled:opacity-40"
            value={selectedListId}
            disabled={isBusy || isRunning}
            onChange={(event) => setSelectedListId(event.target.value)}
          >
            {taskLists.map((list) => (
              <option key={list.id} value={list.id} className="bg-bg text-text">
                {list.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="on-accent h-14 w-full rounded-full text-[14px] font-semibold disabled:opacity-40"
            disabled={isBusy || isRunning || selectedListId === ''}
            onClick={handleCreateTasks}
          >
            追加（{hitResults.length}件）
          </button>
        </>
      )}

      {progress && (
        <span className="text-[12px] text-text/70">
          {progress.done} / {progress.total} 件
        </span>
      )}
      {feedback && <span className="text-[12px] text-text/70">{feedback}</span>}
      {errorKind && (
        <span className="text-[12px] leading-[1.5] text-accent-800">
          {describeGoogleTasksFailure(errorKind)}
        </span>
      )}
    </div>
  );
}
