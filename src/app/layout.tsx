import type { Metadata, Viewport } from 'next';
import { Caprasimo, Figtree } from 'next/font/google';
import './globals.css';

const figtree = Figtree({
  variable: '--font-figtree',
  subsets: ['latin'],
});

// 見出し用。単一ウェイト（400）の欧文専用フォントで、日本語はフォールバックに落ちる。
const caprasimo = Caprasimo({
  variable: '--font-caprasimo',
  weight: '400',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '旬パス',
  description: '旬すぐのパッケージQRからクーポンコードをまとめて取り出す非公式ツールです。',
};

// 下部固定バーの padding に env(safe-area-inset-bottom) を使うため、
// viewportFit: 'cover' を指定する。これが無いと iOS で inset が常に 0 になる。
export const viewport: Viewport = {
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${figtree.variable} ${caprasimo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
