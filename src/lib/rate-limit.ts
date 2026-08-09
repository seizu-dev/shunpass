// 旬すぐ側は個人運営規模のサービスで、1件あたり HTML 取得 + POST の2リクエストが発生する。
// クライアント側の runChanceQueue が直列化と 1500ms 間隔を保証しているが、それはブラウザの
// コードであり、/api/chance を直接叩かれた場合の歯止めにはならない。ここはその最後の砦。
//
// ただし Vercel のサーバーレスは同時に複数インスタンスが立ち、このカウンタはプロセスごとに
// 独立する。実効上限はインスタンス数倍になるため、これは「無制限を潰す」緩和策であって
// 上限の保証ではない。厳密にやるなら外部ストアが要るが、DBなし・ステートレスという
// 本アプリの設計と引き換えになるため採っていない。

// クライアントは CHANCE_REQUEST_INTERVAL_MS = 1500 の直列で投げるため、正常利用の上限は
// 概ね 40 req/min になる。そこに余裕を持たせた値にしてある。
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;
const REFILL_TOKENS_PER_MS = MAX_REQUESTS_PER_WINDOW / WINDOW_MS;

// 追跡するキーの上限。IPごとにエントリが増えるため、際限なく持たせない。
const MAX_TRACKED_KEYS = 10_000;

type Bucket = {
  tokens: number;
  updatedAt: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

// 最後の更新から WINDOW_MS 経ったエントリは満タンに戻っており、消しても判定は変わらない。
function sweepExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt >= WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

/**
 * トークンを1つ消費し、許可するかどうかを返す。
 *
 * @param key 呼び出し元を識別する文字列（通常はクライアントIP）
 */
export function consumeRateLimit(key: string, now: number = Date.now()): RateLimitVerdict {
  const bucket = buckets.get(key);
  const tokens =
    bucket === undefined
      ? MAX_REQUESTS_PER_WINDOW
      : Math.min(
          MAX_REQUESTS_PER_WINDOW,
          bucket.tokens + (now - bucket.updatedAt) * REFILL_TOKENS_PER_MS,
        );

  if (tokens < 1) {
    // 満タンに戻るまで待たせる必要はない。1トークン貯まれば次が通る。
    const waitMs = (1 - tokens) / REFILL_TOKENS_PER_MS;
    buckets.set(key, { tokens, updatedAt: now });
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)) };
  }

  if (bucket === undefined && buckets.size >= MAX_TRACKED_KEYS) {
    sweepExpired(now);
    // 掃除しても埋まっているなら、メモリを際限なく増やすよりカウンタを捨てる方を選ぶ。
    // 最悪でも一時的に上限が緩むだけで、リクエストを誤って拒否することにはならない。
    if (buckets.size >= MAX_TRACKED_KEYS) {
      buckets.clear();
    }
  }

  buckets.set(key, { tokens: tokens - 1, updatedAt: now });
  return { allowed: true };
}

/**
 * リクエストヘッダからレート制限のキー（クライアントIP）を取り出す。
 */
export function clientKeyFromHeaders(headers: Headers): string {
  // x-forwarded-for は最前段のプロキシより手前で任意の値を差し込めるため、
  // ホスティング側が付与するヘッダを優先する。
  const trusted = headers.get('x-vercel-forwarded-for') ?? headers.get('x-real-ip');
  if (trusted !== null && trusted.trim() !== '') {
    return trusted.trim();
  }

  const forwarded = headers.get('x-forwarded-for');
  if (forwarded !== null) {
    const first = forwarded.split(',')[0]?.trim();
    if (first !== undefined && first !== '') {
      return first;
    }
  }

  // ローカル開発ではどのヘッダも付かない。全員が同じバケットを共有するが、
  // 本番では上のいずれかが必ず付くため実害は無い。
  return 'unknown';
}
