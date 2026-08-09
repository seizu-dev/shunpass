import type { ParseFailureReason } from '@/lib/shunsugu/parse';
import type { ScanFailureReason } from '@/lib/scan/qr-detector';
import type { GoogleTasksErrorKind } from '@/lib/output/google-tasks';

// Record<ParseFailureReason, string> にすることで、ParseFailureReason に選択肢が
// 増減したとき型エラーで気づけるようにしている（網羅性の担保）。
export const PARSE_FAILURE_LABELS: Record<ParseFailureReason, string> = {
  'invalid-url': 'URLとして読み取れませんでした',
  'wrong-host': '旬すぐ（shunsugu.jp）のURLではありません',
  'wrong-path': '/chance のURLではありません',
  'missing-params': 'code または serial がURLに含まれていません',
  'invalid-format': 'code または serial の形式が不正です',
};

export function describeParseFailure(reason: ParseFailureReason): string {
  return PARSE_FAILURE_LABELS[reason];
}

// API 側の errorKind は Route Handler / client.ts / api-client.ts のいずれからも
// 増える可能性があるため Record ではなく関数にし、未知の値はフォールバックで拾う。
const API_ERROR_LABELS: Record<string, string> = {
  'invalid-input': '入力の形式が不正です',
  timeout: '旬すぐ側からの応答がタイムアウトしました。時間をおいて再試行してください',
  'upstream-error': '旬すぐ側でエラーが発生しました',
  // 422 は CSRF トークンとセッションの組み合わせが弾かれたことを示す（実測で確認済み）。
  // 通常は起きないはずのため、旬すぐ側の仕様変化を疑う根拠として文言を分けている
  // （.claude/context/known-issues.md 参照）。
  'csrf-not-found': '旬すぐ側の仕様が変わった可能性があります（CSRFトークンを取得できません）',
  'csrf-rejected': '旬すぐ側の仕様が変わった可能性があります（CSRFトークンが拒否されました）',
  // 旬すぐ側ではなく旬パス側で弾いた場合の文言（src/lib/rate-limit.ts）。
  // 原因を取り違えて旬すぐ側を疑わせないよう、Google Tasks の同名ラベルとも文面を分ける。
  'rate-limited': 'リクエストが多すぎます。しばらく待ってから再試行してください',
  'unexpected-response': '旬すぐ側の応答が想定外の形式でした',
  'network-error': '旬すぐ側に接続できませんでした',
  'internal-error': 'サーバ内部でエラーが発生しました',
  aborted: '中断されました',
};

const FALLBACK_API_ERROR_LABEL = '不明なエラーが発生しました';

export function describeApiError(errorKind: string): string {
  return API_ERROR_LABELS[errorKind] ?? FALLBACK_API_ERROR_LABEL;
}

// PARSE_FAILURE_LABELS と同じく、ScanFailureReason の増減に型エラーで気づけるよう Record にする。
export const SCAN_FAILURE_LABELS: Record<ScanFailureReason, string> = {
  'insecure-context': 'HTTPS で開いていないためカメラを使えません。URL貼り付けをご利用ください',
  'no-camera-api': 'このブラウザはカメラ入力に対応していません。URL貼り付けをご利用ください',
  'decoder-unavailable': 'この環境ではQRコードを読み取れませんでした。URL貼り付けをご利用ください',
  'permission-denied': 'カメラの使用が許可されていません。ブラウザの権限設定をご確認ください',
  'no-camera-found': '利用できるカメラが見つかりませんでした',
  'camera-busy': 'カメラを他のアプリが使用中の可能性があります。閉じてから再試行してください',
  'camera-error': 'カメラを起動できませんでした',
};

export function describeScanFailure(reason: ScanFailureReason): string {
  return SCAN_FAILURE_LABELS[reason];
}

// 上2つと同じく、GoogleTasksErrorKind の増減に型エラーで気づけるよう Record にする。
export const GOOGLE_TASKS_FAILURE_LABELS: Record<GoogleTasksErrorKind, string> = {
  // UI 自体が出ない想定なので、これが表示されたら設定漏れかビルド時の環境変数未反映を疑う。
  'not-configured': 'Google Tasks 連携が設定されていません',
  'script-load-failed': 'Google の認証スクリプトを読み込めませんでした',
  // ポップアップブロックと利用者による取り消しは GIS 側で区別できないため同じ文言にする。
  'auth-cancelled': '認可されませんでした。ポップアップがブロックされていないかご確認ください',
  // アクセストークンは約1時間で失効する。リフレッシュトークンを持たない設計のため再認可しかない。
  unauthorized: 'Google の認可が切れました。もう一度「Google Tasks に追加」を押してください',
  'rate-limited': 'Google 側のリクエスト上限に達しました。時間をおいて再試行してください',
  'network-error': 'Google に接続できませんでした',
  'api-error': 'Google Tasks への書き込みに失敗しました',
};

export function describeGoogleTasksFailure(kind: GoogleTasksErrorKind): string {
  return GOOGLE_TASKS_FAILURE_LABELS[kind];
}
