export type ScanFailureReason =
  | 'insecure-context'
  | 'no-camera-api'
  | 'decoder-unavailable'
  | 'permission-denied'
  | 'no-camera-found'
  | 'camera-busy'
  | 'camera-error';

/**
 * ネイティブ実装とポリフィルの差をここで吸収した、アプリ側が使う唯一のデコーダ形。
 * `DetectedBarcode` の `boundingBox` / `cornerPoints` は使わないため、
 * 型差が外へ漏れないよう `rawValue` の配列だけを返す。
 */
export type QrDetector = {
  detect(source: HTMLVideoElement): Promise<string[]>;
};

export type QrDetectorEngine = 'native' | 'polyfill';

export type CreateQrDetectorResult =
  | { ok: true; value: QrDetector; engine: QrDetectorEngine }
  | { ok: false; reason: ScanFailureReason };

// BarcodeDetector は実験的APIで lib.dom.d.ts に型が無いため、使う分だけ自前で宣言する。
type NativeBarcodeDetector = {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
};

type NativeBarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats(): Promise<readonly string[]>;
};

const QR_FORMAT = 'qr_code';

// zxing-wasm は既定で .wasm を jsDelivr CDN から取得する。外部CDNへの依存を持ち込まないよう
// public/wasm/ に同梱したものを指すよう locateFile を差し替える。
// ファイルは node_modules/zxing-wasm/dist/reader/zxing_reader.wasm のコピーで、
// zxing-wasm を更新したときは `npm run sync-wasm` で入れ替える必要がある。
const WASM_DIR_PATH = '/wasm/';

function getNativeConstructor(): NativeBarcodeDetectorConstructor | null {
  const candidate = (globalThis as { BarcodeDetector?: NativeBarcodeDetectorConstructor })
    .BarcodeDetector;
  return typeof candidate === 'function' ? candidate : null;
}

/**
 * ネイティブ実装が本当に qr_code を読めるかまで確認する。
 * 存在チェックだけでは不十分で、Chrome 113 未満 + macOS Ventura 以降では
 * インターフェースが生えているのに黙って失敗する既知の不具合がある（MDN 記載）。
 * getSupportedFormats() まで通らない環境はポリフィルへ落とす。
 */
async function createNativeDetector(): Promise<QrDetector | null> {
  const Constructor = getNativeConstructor();
  if (Constructor === null) {
    return null;
  }

  try {
    const formats = await Constructor.getSupportedFormats();
    if (!formats.includes(QR_FORMAT)) {
      return null;
    }

    const detector = new Constructor({ formats: [QR_FORMAT] });
    return {
      detect: async (source) => {
        const barcodes = await detector.detect(source);
        return barcodes.map((barcode) => barcode.rawValue);
      },
    };
  } catch {
    return null;
  }
}

async function createPolyfillDetector(): Promise<QrDetector | null> {
  try {
    // ネイティブが使える環境（Android Chrome 等）では wasm を一切ロードしないよう、
    // 動的 import にしてこの分岐に入ったときだけ読み込む。
    const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');

    prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith('.wasm') ? `${WASM_DIR_PATH}${path}` : `${prefix}${path}`,
      },
    });

    const detector = new BarcodeDetector({ formats: [QR_FORMAT] });
    return {
      detect: async (source) => {
        const barcodes = await detector.detect(source);
        return barcodes.map((barcode) => barcode.rawValue);
      },
    };
  } catch {
    return null;
  }
}

/**
 * カメラを起動する前に、この環境でそもそもカメラが使えるかを同期的に判定する。
 * 使えない理由が分かっていればユーザーにURL貼り付けへ誘導できる。
 */
export function checkCameraEnvironment(): ScanFailureReason | null {
  if (typeof window === 'undefined') {
    return 'no-camera-api';
  }
  // getUserMedia はセキュアコンテキストでしか生えない。HTTP の LAN アクセスで
  // navigator.mediaDevices 自体が undefined になるため、原因を切り分けて表示する。
  if (!window.isSecureContext) {
    return 'insecure-context';
  }
  if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
    return 'no-camera-api';
  }
  return null;
}

export async function createQrDetector(): Promise<CreateQrDetectorResult> {
  const native = await createNativeDetector();
  if (native !== null) {
    return { ok: true, value: native, engine: 'native' };
  }

  const polyfill = await createPolyfillDetector();
  if (polyfill !== null) {
    return { ok: true, value: polyfill, engine: 'polyfill' };
  }

  return { ok: false, reason: 'decoder-unavailable' };
}

/**
 * `getUserMedia` が投げる DOMException を UI 向けの理由に対応付ける。
 * 例外オブジェクトの中身（デバイス名など）は文言に含めない。
 */
export function toScanFailureReason(error: unknown): ScanFailureReason {
  const name = error instanceof DOMException ? error.name : '';

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'permission-denied';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'no-camera-found';
    case 'NotReadableError':
    case 'AbortError':
      return 'camera-busy';
    default:
      return 'camera-error';
  }
}
