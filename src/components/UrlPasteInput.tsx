'use client';

import { useMemo, useState } from 'react';
import { parseChanceUrls } from '@/lib/shunsugu/parse';
import { describeParseFailure } from '@/lib/ui-messages';

type UrlPasteInputProps = {
  isRunning: boolean;
  onSubmit: (items: { code: string; serial: string }[]) => void;
  onAbort: () => void;
};

// テキスト自体には serial が含まれるため、このコンポーネントの state に閉じ、
// 親には parseChanceUrls で解析済みの items だけを渡す（.claude/coding-style.md 参照）。
export default function UrlPasteInput({ isRunning, onSubmit, onAbort }: UrlPasteInputProps) {
  const [text, setText] = useState('');

  const parsed = useMemo(() => parseChanceUrls(text), [text]);

  const canSubmit = parsed.items.length > 0 && !isRunning;

  return (
    // 下部固定バーに隠れない余白は SiteFooter 側が持つ（カメラタブと同じ）。
    <div className="flex flex-col gap-3">
      <label htmlFor="chance-url-input" className="text-[13px] font-semibold">
        旬すぐのQRが指すURLを貼り付け（1行に1件）
      </label>
      <textarea
        id="chance-url-input"
        className="min-h-40 w-full rounded-[26px] border border-divider bg-bg p-4 font-mono text-[14px] disabled:opacity-40"
        placeholder="https://shunsugu.jp/chance?code=...&serial=..."
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={isRunning}
      />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-text/60">
        <span>認識: {parsed.items.length} 件</span>
        {parsed.duplicateCount > 0 && <span>重複除外: {parsed.duplicateCount} 件</span>}
        {parsed.errors.length > 0 && <span>解析失敗: {parsed.errors.length} 行</span>}
      </div>

      {parsed.errors.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-[20px] border border-accent-400 bg-surface px-4 py-3 text-[12.5px] leading-[1.5] text-accent-800">
          {parsed.errors.map((error) => (
            <li key={error.line}>
              {error.line}行目: {describeParseFailure(error.reason)}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-[14px] text-[11.5px] leading-[1.6] text-text/55">
        読み取ったQRの情報と取得したクーポンコードは中継のため当方のサーバーを経由しますが、保存もログ出力もしません。旬すぐ運営とは一切関係ありません。
        {/* 素の <a> を新規タブで開く。同一タブ遷移だと親の jobs state が消える。 */}
        <a
          className="text-accent-900 underline underline-offset-2"
          href="/about"
          target="_blank"
          rel="noopener noreferrer"
        >
          データの取り扱い・免責事項
        </a>
      </p>

      <div className="bar-fade fixed inset-x-0 bottom-0 z-10">
        <div className="pb-home mx-auto w-full max-w-[480px] px-[18px] pt-[14px]">
          {isRunning ? (
            <button
              type="button"
              className="h-14 w-full rounded-full border border-accent text-[15px] font-semibold text-accent-900"
              onClick={onAbort}
            >
              中止
            </button>
          ) : (
            <button
              type="button"
              className="on-accent h-14 w-full rounded-full font-heading text-[17px] disabled:opacity-40"
              disabled={!canSubmit}
              onClick={() => onSubmit(parsed.items)}
            >
              {parsed.items.length}件を実行
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
