import { ImageResponse } from 'next/og';

// 旬すぐの商標・ロゴ・パッケージ画像は使わない（.claude/architecture.md の禁止パターン）。
// 配色は globals.css のトークンと同じ値を直接書いている。ImageResponse は Tailwind の
// CSS変数を解決できないため参照にできない。
export const alt = '旬パス - 旬すぐのパッケージQRからクーポンコードをまとめて取り出す非公式ツール';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#f5ead8';
const TITLE = '#402310';
const TEXT = '#201e1d';
const ACCENT = '#aaca26';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: BG,
        padding: '80px',
      }}
    >
      <div style={{ display: 'flex', width: '120px', height: '16px', backgroundColor: ACCENT }} />
      <div style={{ display: 'flex', marginTop: '40px', fontSize: '112px', color: TITLE }}>
        旬パス
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: '24px',
          // 40px だと 1 行に収まらず「取り出す」が折り返される（1200-160px の実測）。
          fontSize: '36px',
          color: TEXT,
          opacity: 0.75,
        }}
      >
        旬すぐのパッケージQRからクーポンコードをまとめて取り出す
      </div>
      <div
        style={{ display: 'flex', marginTop: '48px', fontSize: '32px', color: TEXT, opacity: 0.5 }}
      >
        非公式ツール / shunpass
      </div>
    </div>,
    size,
  );
}
