import { ChanceFetchError, fetchChanceResult } from '@/lib/shunsugu/client';
import { isValidChanceParam } from '@/lib/shunsugu/parse';

// このハンドラは1リクエスト＝1件のみを処理する。複数件の直列化・間隔制御・進捗表示は
// クライアント側の責務であり、ここでは行わない。
//
// 段階公開の間は自分だけが叩く前提のためレート制限を設けていないが、
// 一般公開に切り替える際はサーバ側レート制限が必須（.claude/context/current-sprint.md 参照）。

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
