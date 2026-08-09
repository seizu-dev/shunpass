// serial は機微情報なので UI 上でも全体を出さない。末尾4文字だけ残し、対応関係の
// 確認（どの行がどのQRか）はできるが、画面共有やスクショで漏れる範囲を最小化する。
// serial のフォーマットは未確定（VALUE_FORMAT は1〜64文字を許容）なので、4文字以下だと
// slice(-4) が全体を返してしまい露出する。その場合は全マスクにする。
export function maskSerial(serial: string): string {
  if (serial.length <= 4) {
    return '•'.repeat(serial.length);
  }
  const visible = serial.slice(-4);
  return `••••${visible}`;
}
