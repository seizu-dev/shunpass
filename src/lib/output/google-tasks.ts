import type { ChanceResult } from '@/lib/shunsugu/types';

export type GoogleTasksErrorKind =
  | 'not-configured'
  | 'script-load-failed'
  | 'auth-cancelled'
  | 'unauthorized'
  | 'rate-limited'
  | 'network-error'
  | 'api-error';

export type GoogleTasksResult<T> =
  | { ok: true; value: T }
  | { ok: false; errorKind: GoogleTasksErrorKind };

export type GoogleTaskList = { id: string; title: string };

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';
const TASKS_API_BASE = 'https://tasks.googleapis.com/tasks/v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
}

/** UI 側が Google Tasks 関連の要素を出すかどうかの判定に使う。 */
export function isGoogleTasksConfigured(): boolean {
  return getClientId() !== '';
}

// 連打や複数コンポーネントからの同時呼び出しで <script> が多重注入されるのを防ぐため、
// ロード処理そのものをモジュールスコープの Promise としてメモ化する。
let gisLoadPromise: Promise<GoogleTasksResult<void>> | null = null;

function loadGisScript(): Promise<GoogleTasksResult<void>> {
  if (gisLoadPromise !== null) {
    return gisLoadPromise;
  }

  const pending: Promise<GoogleTasksResult<void>> = new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ ok: false, errorKind: 'script-load-failed' });
      return;
    }

    if (window.google?.accounts?.oauth2) {
      resolve({ ok: true, value: undefined });
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) {
        resolve({ ok: true, value: undefined });
      } else {
        resolve({ ok: false, errorKind: 'script-load-failed' });
      }
    };
    script.onerror = () => {
      resolve({ ok: false, errorKind: 'script-load-failed' });
    };
    document.head.appendChild(script);
  });

  // 失敗までメモ化すると、一時的な回線断で読めなかっただけの場合にリロードするまで
  // 二度と再試行できなくなる。成功したときだけキャッシュを残す。
  gisLoadPromise = pending.then((result) => {
    if (!result.ok) {
      gisLoadPromise = null;
    }
    return result;
  });

  return gisLoadPromise;
}

/**
 * GIS トークンモデルでアクセストークンを取得する。リフレッシュトークンは発行されない前提
 * （サーバに何も残らない設計）。取得したトークンはメモリ以外に保持しないこと。
 */
export async function requestGoogleAccessToken(): Promise<GoogleTasksResult<string>> {
  const clientId = getClientId();
  if (clientId === '') {
    return { ok: false, errorKind: 'not-configured' };
  }

  const loadResult = await loadGisScript();
  if (!loadResult.ok) {
    return loadResult;
  }

  if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
    return { ok: false, errorKind: 'script-load-failed' };
  }

  const oauth2 = window.google.accounts.oauth2;

  return new Promise((resolve) => {
    // callback と error_callback はどちらか一方しか呼ばれない保証が無いため、
    // resolve が二重に呼ばれないようフラグでガードする。
    let settled = false;

    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: TASKS_SCOPE,
      callback: (response) => {
        if (settled) {
          return;
        }
        settled = true;
        if (response.error || !response.access_token) {
          resolve({ ok: false, errorKind: 'auth-cancelled' });
          return;
        }
        resolve({ ok: true, value: response.access_token });
      },
      error_callback: () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve({ ok: false, errorKind: 'auth-cancelled' });
      },
    });

    tokenClient.requestAccessToken();
  });
}

function errorKindFromStatus(status: number): GoogleTasksErrorKind {
  if (status === 401 || status === 403) {
    return 'unauthorized';
  }
  if (status === 429) {
    return 'rate-limited';
  }
  return 'api-error';
}

function isGoogleTaskListItem(value: unknown): value is GoogleTaskList {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string';
}

/** タスクリスト一覧を取得する。プルダウンの選択肢を出すためだけに使う。 */
export async function listGoogleTaskLists(
  accessToken: string,
): Promise<GoogleTasksResult<GoogleTaskList[]>> {
  let res: Response;
  try {
    res = await fetch(`${TASKS_API_BASE}/users/@me/lists?maxResults=100`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return { ok: false, errorKind: 'network-error' };
  }

  if (!res.ok) {
    return { ok: false, errorKind: errorKindFromStatus(res.status) };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, errorKind: 'api-error' };
  }

  if (!isRecord(body)) {
    return { ok: false, errorKind: 'api-error' };
  }

  const items = Array.isArray(body.items) ? body.items : [];
  return { ok: true, value: items.filter(isGoogleTaskListItem) };
}

function toHitResults(results: ChanceResult[]): ChanceResult[] {
  return results.filter((result) => result.status === 'hit' && !!result.couponCode);
}

/**
 * `expiresAt` から JST のカレンダー日付だけを取り出し、Tasks API が要求する
 * RFC3339 の形（時刻はゼロ埋め・UTC表記）に変換する。Tasks API は due の時刻部分を
 * 保存せず捨てることが分かっているため、タイムゾーンを跨いで日付がずれないよう
 * 実行端末のローカル時刻に依存させず、JST 固定で計算する。
 */
function toDueDate(expiresAt: string | null): string | undefined {
  if (expiresAt === null) {
    return undefined;
  }
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  const jstMs = date.getTime() + 9 * 60 * 60 * 1000;
  const jstDatePart = new Date(jstMs).toISOString().slice(0, 10);
  return `${jstDatePart}T00:00:00.000Z`;
}

/**
 * 当たりのクーポンコードを Google Tasks のタスクとして1件ずつ作成する。
 * `runChanceQueue`（`src/lib/shunsugu/queue.ts`）は旬すぐ側の負荷配慮のための
 * 間隔制御専用であり、Google Tasks への呼び出しはそれとは無関係なため使わない。
 * ここでは直列ループのみで間隔は空けない。
 */
export async function createCouponTasks(
  accessToken: string,
  taskListId: string,
  results: ChanceResult[],
  onProgress: (doneCount: number) => void,
): Promise<GoogleTasksResult<{ createdCount: number; failedCount: number }>> {
  const targets = toHitResults(results);
  let createdCount = 0;
  let failedCount = 0;

  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    const due = toDueDate(target.expiresAt);

    let res: Response;
    try {
      res = await fetch(
        `${TASKS_API_BASE}/lists/${encodeURIComponent(taskListId)}/tasks`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: target.couponCode,
            notes: `商品コード: ${target.itemCode}`,
            ...(due !== undefined ? { due } : {}),
          }),
        },
      );
    } catch {
      failedCount += 1;
      onProgress(i + 1);
      continue;
    }

    if (!res.ok) {
      const kind = errorKindFromStatus(res.status);
      if (kind === 'unauthorized') {
        // トークン失効時に残りを無駄打ちしないよう即座に中断する。
        return { ok: false, errorKind: 'unauthorized' };
      }
      failedCount += 1;
      onProgress(i + 1);
      continue;
    }

    createdCount += 1;
    onProgress(i + 1);
  }

  return { ok: true, value: { createdCount, failedCount } };
}
