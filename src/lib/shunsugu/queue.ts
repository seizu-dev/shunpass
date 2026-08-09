import { requestChance, type ChanceApiResult } from '@/lib/shunsugu/api-client';
import type { ChanceResult } from '@/lib/shunsugu/types';

// 旬すぐ側は個人運営規模のサービスで、1件につき HTML 取得（GET）+ 結果取得（POST）の
// 2リクエストが発生する。並列化や間隔短縮は上流への負荷を無視した実装になるため、
// 直列実行と間隔は UI から上書きできない定数としてここに固定する
// （.claude/architecture.md「禁止パターン」参照）。
export const CHANCE_REQUEST_INTERVAL_MS = 1500;

export type ChanceJobState = 'pending' | 'running' | 'done' | 'failed';

export type ChanceJob = {
  id: string;
  code: string;
  serial: string;
  state: ChanceJobState;
  result: ChanceResult | null;
  errorKind: string | null;
};

export function createChanceJob(item: { code: string; serial: string }): ChanceJob {
  return {
    id: crypto.randomUUID(),
    code: item.code,
    serial: item.serial,
    state: 'pending',
    result: null,
    errorKind: null,
  };
}

// abort シグナルが発火した時点で即座に待機を解除するため、setTimeout と abort リスナを
// 組み合わせる。リスナは resolve 後に必ず解除しないとメモリリーク・多重発火の原因になる。
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort(): void {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }

    signal?.addEventListener('abort', onAbort);
  });
}

/**
 * `items` を1件ずつ直列に取得代行へ投げる。`Promise.all` 等での並列化は行わない
 * （旬すぐ側への負荷配慮。上記コメント参照）。
 *
 * 1件の失敗（`ok: false`）ではループを止めない。ユーザーは失敗した分だけ後から
 * 再実行できるため、他の件の取得を止める理由がない。中断は abort によってのみ起こる。
 */
export async function runChanceQueue(
  items: { code: string; serial: string }[],
  handlers: {
    onStart: (index: number) => void;
    onSettled: (index: number, result: ChanceApiResult) => void;
  },
  options?: { signal?: AbortSignal },
): Promise<void> {
  const signal = options?.signal;

  for (let index = 0; index < items.length; index += 1) {
    if (signal?.aborted) {
      return;
    }

    handlers.onStart(index);
    const result = await requestChance(items[index], signal);
    handlers.onSettled(index, result);

    if (signal?.aborted) {
      return;
    }

    const isLast = index === items.length - 1;
    if (!isLast) {
      await sleep(CHANCE_REQUEST_INTERVAL_MS, signal);
    }
  }
}
