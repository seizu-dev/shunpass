// zxing-wasm は既定で .wasm を jsDelivr CDN から取得する。外部CDNへの依存を持ち込まないよう
// public/wasm/ に同梱し、src/lib/scan/qr-detector.ts の locateFile でそちらを指している。
// zxing-wasm を更新したら node_modules 側と中身がずれるため、このスクリプトで入れ替える。
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(projectRoot, 'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm');
const destination = resolve(projectRoot, 'public/wasm/zxing_reader.wasm');

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);

process.stdout.write(`copied ${source} -> ${destination}\n`);
