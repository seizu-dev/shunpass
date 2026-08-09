import { ChanceFetchError, fetchChanceResult } from '@/lib/shunsugu/client';
import { isValidChanceParam } from '@/lib/shunsugu/parse';
import { clientKeyFromHeaders, consumeRateLimit } from '@/lib/rate-limit';

// このハンドラは1リクエスト＝1件のみを処理する。複数件の直列化・間隔制御・進捗表示は
// クライアント側の責務であり、ここでは行わない。
//
// クライアント側の直列化はブラウザのコードなので、ここを直接叩かれた場合の歯止めにならない。
// そのためIPごとのレート制限を入れてある（限界は src/lib/rate-limit.ts のコメントを参照）。

// Set-Cookie の複数値取得（getSetCookie）と Cookie 転送を伴う fetch 代行を行うため、
// Edge ランタイムではなく Node ランタイムを明示する。
export const runtime = 'nodejs';

type ChanceRequestBody = {
  code: string;
  serial: string;
};

function isChanceRequestBody(value: unknown): value is ChanceRequestBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const { code, serial } = value as Record<string, unknown>;

  return (
    typeof code === 'string' &&
    typeof serial === 'string' &&
    isValidChanceParam(code) &&
    isValidChanceParam(serial)
  );
}

export async function POST(request: Request): Promise<Response> {
  // 上流への代行取得どころかボディの解析より前に弾く。旬すぐ側への負荷を減らすのが目的で、
  // 入力が正しいかどうかは判定に関係ない。
  const verdict = consumeRateLimit(clientKeyFromHeaders(request.headers));
  if (!verdict.allowed) {
    return Response.json(
      { error: 'rate-limited' },
      { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid-input' }, { status: 400 });
  }

  if (!isChanceRequestBody(body)) {
    return Response.json({ error: 'invalid-input' }, { status: 400 });
  }

  try {
    const result = await fetchChanceResult({ code: body.code, serial: body.serial });
    return Response.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ChanceFetchError) {
      const status = error.kind === 'timeout' ? 504 : 502;
      return Response.json({ error: error.kind }, { status });
    }

    // code / serial をエラーに含められないため、原因の詳細はここでは扱わない。
    return Response.json({ error: 'internal-error' }, { status: 500 });
  }
}
