/**
 * shunsugu.jp `/chance/initial.json` のレスポンス型（snake_case のまま受ける境界の型）。
 *
 * `unopened?` 等のキーは Ruby 由来でそのまま返ってくるため、TypeScript の識別子として
 * 使えず必ずクォートする。
 */
export type ShunsuguChanceVideo = {
  id: number;
  ratio: number;
  priority: number;
  /**
   * 名前から当落フラグに見えるが、実測では当たりで 0 / はずれで 1 と逆の値が返り、
   * 本当の意味が特定できていない。当落判定に使ってはいけない
   * （.claude/context/known-issues.md 参照）。
   */
  hit: number;
  name: string;
  video_url: string;
};

export type ShunsuguCoupon = {
  id: number;
  status: number;
  category: number;
};

export type ShunsuguCustomerCoupon = {
  // update_status.json のボディに使う。当たり・はずれ両方のサンプルで存在を実測済み。
  id: number;
  // 当落判定はこのフィールドのみを唯一の基準とする。実測では当たりで文字列 / はずれで null が
  // 返るが、キー自体が省略される可能性も否定できないため optional にしてある。
  coupon_code?: string | null;
  coupon_status: string;
  // はずれのときに期限そのものが存在しない可能性があるため、欠落と null の両方を許容する。
  expired_at?: string | null;
  item_code: string;
  serial: string;
  // 当落判定には不要な補助情報。当たり・はずれ両方のサンプルで3つとも実物を確認済みだが、
  // 未確認の応答形（別の当落パターンやAPI変化）で欠落しても当落判定自体は壊さないよう
  // optional のままにしてある。
  'unopened?'?: boolean;
  'unused?'?: boolean;
  'used?'?: boolean;
};

export type ShunsuguChanceResponse = {
  chance_video: ShunsuguChanceVideo;
  coupon: ShunsuguCoupon;
  video: string;
  customer_coupon: ShunsuguCustomerCoupon;
};

/**
 * アプリ内部で使う正規化後の型（camelCase）。
 * serial は返す必要がなく、保持箇所を減らすほどログ流出リスクが下がるため含めない。
 */
export type ChanceResult = {
  status: 'hit' | 'miss';
  couponCode: string | null;
  expiresAt: string | null;
  itemCode: string;
  isUnopened: boolean;
  isUnused: boolean;
  isUsed: boolean;
  // 当たり検出時の unopened -> unused 遷移（update_status.json）の実行結果。
  // はずれ、またはフラグ無効時は 'skipped'。開封処理はあくまで補助のため、
  // 'failed' でもクーポンコードの取得自体は成功として扱う。
  openedStatus: 'skipped' | 'succeeded' | 'failed';
};
