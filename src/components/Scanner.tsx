'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TrashIcon } from '@/components/Icons';
import { withBasePath } from '@/lib/base-path';
import { maskSerial } from '@/lib/mask';
import {
  checkCameraEnvironment,
  createQrDetector,
  toScanFailureReason,
  type QrDetector,
  type ScanFailureReason,
} from '@/lib/scan/qr-detector';
import { parseChanceUrl } from '@/lib/shunsugu/parse';
import { siteConfig } from '@/lib/site-config';
import { describeParseFailure, describeScanFailure } from '@/lib/ui-messages';

type ScannerProps = {
  isRunning: boolean;
  knownSerials: Set<string>;
  onSubmit: (items: { code: string; serial: string }[]) => void;
  onAbort: () => void;
};

// detect() は特にポリフィル（wasm）経路で重い。requestAnimationFrame で毎フレーム
// 呼ぶとモバイルで発熱・コマ落ちするため、間隔を空けたポーリングにする。
const DETECT_INTERVAL_MS = 250;

// QRを1件でも読めたら、次の検出まではこれだけ空ける。250ms のまま回すと、同じQRを
// 構えている間ずっと再検出され、登録した直後の1件が「読み取り済み」に化けて連呼される。
const SCAN_COOLDOWN_MS = 2000;

// wasm の取得失敗などで detect() が毎回失敗する状態になると、UI 上は「読み取れないだけ」に
// 見えて原因が分からない。連続失敗が続いたらデコーダ側の異常として扱い、停止して理由を出す。
const MAX_CONSECUTIVE_DETECT_FAILURES = 5;

const FEEDBACK_DURATION_MS = 2500;

// カメラ停止中の枠に出す「スマホで開く」の表示用。スキームは冗長なので落とす。
const SITE_URL_LABEL = siteConfig.siteUrl.replace(/^https?:\/\//, '');

type ScanPhase = 'idle' | 'starting' | 'scanning';

// id は表示のたびに増やす。同じ文言が続いても key が変わって要素が作り直され、
// フラッシュのアニメーションが最初から再生される（同一要素のままだと再生されない）。
type Feedback = { id: number; text: string; tone: 'ok' | 'warn' };

// 読み取ったURLには serial が含まれるため、生の文字列と待機リストはこのコンポーネントに閉じ、
// 親には解析済みの items だけを渡す（UrlPasteInput と同じ責務分割）。
export default function Scanner({ isRunning, knownSerials, onSubmit, onAbort }: ScannerProps) {
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [failure, setFailure] = useState<ScanFailureReason | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingItems, setPendingItems] = useState<{ code: string; serial: string }[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<QrDetector | null>(null);
  const timerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const feedbackIdRef = useRef(0);
  const detectFailureCountRef = useRef(0);

  // 検出ループは setTimeout の再帰なので state を読むと古い値を掴む。判定に使う集合は
  // すべて ref に持ち、ループからは ref だけを見る。
  const pendingSerialsRef = useRef<Set<string>>(new Set());
  const knownSerialsRef = useRef<Set<string>>(knownSerials);

  // 直前に読んだ serial。クールタイム明けに同じQRがまだ視野にある場合の、
  // 「読み取り済みのQRです」の再表示を抑えるためだけに使う。
  const lastDecodedSerialRef = useRef<string | null>(null);

  // 起動処理は await を挟むため、その間に停止・アンマウントされることがある。
  // 世代番号を進めることで「古い起動処理」が後からストリームを掴むのを防ぐ。
  const startTokenRef = useRef(0);
  const phaseRef = useRef<ScanPhase>('idle');

  useEffect(() => {
    knownSerialsRef.current = knownSerials;
  }, [knownSerials]);

  // 以下の検出まわりは「毎回 ref を読む」形に統一してあるため、再生成されても挙動が変わらない。
  // useCallback にすると detectFrame が自分自身を参照できなくなるので、素の関数宣言にしている。
  function showFeedback(text: string, tone: Feedback['tone']): void {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackIdRef.current += 1;
    setFeedback({ id: feedbackIdRef.current, text, tone });
    feedbackTimerRef.current = window.setTimeout(() => {
      feedbackTimerRef.current = null;
      setFeedback(null);
    }, FEEDBACK_DURATION_MS);
  }

  // stopScanning だけは useEffect のクリーンアップから呼ぶため、参照が安定している必要がある。
  const stopScanning = useCallback(() => {
    startTokenRef.current += 1;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    detectorRef.current = null;
    detectFailureCountRef.current = 0;
    lastDecodedSerialRef.current = null;

    // トラックを止めないと端末のカメラ使用インジケータが点いたままになる。
    const stream = streamRef.current;
    if (stream !== null) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video !== null) {
      video.srcObject = null;
    }

    phaseRef.current = 'idle';
    setPhase('idle');
  }, []);

  function handleDecoded(rawValue: string): void {
    const result = parseChanceUrl(rawValue);
    if (!result.ok) {
      showFeedback(describeParseFailure(result.reason), 'warn');
      return;
    }

    const { serial } = result.value;
    // 待機リストと、既に実行済みのジョブの両方を見る。parseChanceUrls と同じ先勝ち。
    if (pendingSerialsRef.current.has(serial) || knownSerialsRef.current.has(serial)) {
      // 同じQRを構え続けているだけなら黙る。別の読み取り済みQRを向けたときは知らせる。
      if (lastDecodedSerialRef.current !== serial) {
        showFeedback('読み取り済みのQRです', 'warn');
      }
      lastDecodedSerialRef.current = serial;
      return;
    }

    lastDecodedSerialRef.current = serial;
    pendingSerialsRef.current.add(serial);
    setPendingItems((prev) => [...prev, result.value]);
    showFeedback(`読み取りました（${pendingSerialsRef.current.size}件目）`, 'ok');
  }

  async function detectFrame(): Promise<void> {
    timerRef.current = null;

    const detector = detectorRef.current;
    const video = videoRef.current;
    if (detector === null || video === null) {
      return;
    }

    // 読めた直後だけ間隔を延ばす。読めていない間は 250ms のまま反応を鈍らせない。
    let nextDelayMs = DETECT_INTERVAL_MS;

    // 再生開始前は videoWidth が 0 で、この状態の detect() は実装によって例外を投げる。
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      try {
        const rawValues = await detector.detect(video);
        detectFailureCountRef.current = 0;
        for (const rawValue of rawValues) {
          handleDecoded(rawValue);
        }
        // 解析に失敗するQR（旬すぐ以外のURL等）でも警告が連呼されるため、
        // 中身を問わず「1件でもデコードできたか」でクールタイムを判断する。
        if (rawValues.length > 0) {
          nextDelayMs = SCAN_COOLDOWN_MS;
        }
      } catch {
        // 1フレームの失敗でループを止める理由はない（手ブレ等でも起こりうる）。
        // ただし継続的に失敗する場合はデコーダ自体の異常なので打ち切る。
        detectFailureCountRef.current += 1;
        if (detectFailureCountRef.current >= MAX_CONSECUTIVE_DETECT_FAILURES) {
          stopScanning();
          setFailure('decoder-unavailable');
          return;
        }
      }
    }

    if (detectorRef.current !== null) {
      timerRef.current = window.setTimeout(() => {
        void detectFrame();
      }, nextDelayMs);
    }
  }

  async function startScanning(): Promise<void> {
    // ボタンの disabled は再描画タイミングに依存するため、同期的に判定できる ref で弾く。
    // 素通りすると getUserMedia が二重に走り、片方のストリームを誰も止められなくなる。
    if (phaseRef.current !== 'idle') {
      return;
    }
    phaseRef.current = 'starting';
    setPhase('starting');
    setFailure(null);

    const token = startTokenRef.current;

    const environmentFailure = checkCameraEnvironment();
    if (environmentFailure !== null) {
      phaseRef.current = 'idle';
      setPhase('idle');
      setFailure(environmentFailure);
      return;
    }

    const detectorResult = await createQrDetector();
    if (token !== startTokenRef.current) {
      return;
    }
    if (!detectorResult.ok) {
      phaseRef.current = 'idle';
      setPhase('idle');
      setFailure(detectorResult.reason);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (error) {
      if (token !== startTokenRef.current) {
        return;
      }
      phaseRef.current = 'idle';
      setPhase('idle');
      setFailure(toScanFailureReason(error));
      return;
    }

    const video = videoRef.current;
    // 待っている間に停止・アンマウントされていたら、取得したストリームは即座に捨てる。
    if (token !== startTokenRef.current || video === null) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamRef.current = stream;
    detectorRef.current = detectorResult.value;
    detectFailureCountRef.current = 0;

    // iOS Safari は muted / playsInline が無いとインライン再生せず全画面に飛ぶ。
    // React の muted 属性は DOM へ反映されないことがあるため明示的に代入する。
    video.muted = true;
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // 自動再生が拒否されても srcObject は生きており、detect は videoWidth が
      // 立ってから走るため、ここでは失敗として扱わない。
    }

    if (token !== startTokenRef.current) {
      return;
    }

    phaseRef.current = 'scanning';
    setPhase('scanning');
    void detectFrame();
  }

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
      stopScanning();
    };
  }, [stopScanning]);

  // バックグラウンドに回ったタブでカメラを掴み続けない。
  useEffect(() => {
    function handleVisibilityChange(): void {
      if (document.visibilityState === 'hidden') {
        stopScanning();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [stopScanning]);

  function handleRemove(serial: string): void {
    pendingSerialsRef.current.delete(serial);
    setPendingItems((prev) => prev.filter((item) => item.serial !== serial));
  }

  function handleClear(): void {
    pendingSerialsRef.current.clear();
    setPendingItems([]);
  }

  function handleSubmit(): void {
    if (pendingItems.length === 0 || isRunning) {
      return;
    }
    // 取得中にカメラを回し続ける理由がない。結果は下の一覧に移るので待機リストは空にする。
    stopScanning();
    const items = pendingItems;
    pendingSerialsRef.current.clear();
    setPendingItems([]);
    onSubmit(items);
  }

  const canSubmit = pendingItems.length > 0 && !isRunning;
  const isCameraActive = phase !== 'idle';
  const statusLabel =
    phase === 'scanning' ? '読み取り中' : phase === 'starting' ? '起動中' : '停止中';

  return (
    // 下部固定バーに隠れない余白は SiteFooter 側が持つ（page.tsx で常に後ろに続くため）。
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-[#2b2724]">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />

        {isCameraActive ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="aspect-square w-[58%] rounded-[24px] border-[3px] border-bg/80" />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-[18px] px-6 text-center text-[13px] leading-relaxed text-bg/70">
            <p>下の「カメラ起動」でQRの読み取りを始めます</p>

            {/* PCで見ている人にスマホへ移ってもらうための導線。スマホでは自分の画面のQRを
                読めないので出さない。pointer-fine（マウス等の精密なポインタ）はCSSだけの
                判定なので、UA判定と違ってハイドレーション不一致が起きない。 */}
            <div className="hidden flex-col items-center gap-[10px] pointer-fine:flex">
              {/* 静的な小さいSVGで、next/image の最適化対象にする意味がない。 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={withBasePath('/site-url-qr.svg')}
                alt="旬パスのURLのQRコード"
                width={156}
                height={156}
                className="rounded-[10px] bg-white p-2"
              />
              <div>
                <div className="text-[13px] font-semibold text-bg/85">スマホで開く</div>
                {/* URLは静的SVGではなく siteConfig から描く。QRの中身とずれたときに
                    画面上で気づけるようにするため（静的チェックでは検出できない）。 */}
                <div className="mt-0.5 font-mono text-[12px] text-bg/60">{SITE_URL_LABEL}</div>
              </div>
            </div>
          </div>
        )}

        {/* フィードバックはカメラ枠内に重ねる。通常フローに置くと、表示・消滅のたびに
            下の待機リストが上下にずれて読み取り作業の邪魔になる。 */}
        {feedback && (
          <div className="pointer-events-none absolute inset-x-[14px] top-[14px] flex justify-center">
            <span
              key={feedback.id}
              className={
                feedback.tone === 'ok'
                  ? 'on-accent flash-pop rounded-full px-3 py-1.5 text-center text-[12px] font-semibold'
                  : 'rounded-full bg-text/70 px-3 py-1.5 text-center text-[12px] font-semibold text-bg'
              }
            >
              {feedback.text}
            </span>
          </div>
        )}

        <div className="absolute bottom-[14px] left-[14px] flex items-center gap-[7px] rounded-full bg-text/55 px-3 py-1.5 text-[12px] text-bg">
          <span
            className={
              phase === 'scanning'
                ? 'h-[7px] w-[7px] rounded-full bg-accent2-500'
                : 'h-[7px] w-[7px] rounded-full bg-neutral-400'
            }
          />
          {statusLabel}
        </div>
      </div>

      {failure !== null && (
        <p className="rounded-[20px] border border-accent-400 bg-surface px-4 py-3 text-[12.5px] leading-[1.5] text-accent-800">
          {describeScanFailure(failure)}
        </p>
      )}

      {pendingItems.length > 0 && (
        <>
          <div className="flex items-center gap-[14px] rounded-[26px] bg-accent2-200 px-4 py-3">
            <div className="grid h-14 w-14 flex-none place-items-center rounded-full bg-accent2-600 font-heading text-[24px] text-bg">
              {pendingItems.length}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold text-accent2-900">件が待機中</div>
              <div className="text-[12.5px] text-accent2-800 opacity-80">続けてQRをかざせます</div>
            </div>
          </div>

          <ul className="flex flex-col gap-[10px]">
            {/* 新しく読んだものを上に出す。かざした直後の1件が視界に入る位置にあってほしい。 */}
            {[...pendingItems].reverse().map((item, index) => (
              <li
                key={item.serial}
                className="flex items-center gap-3 rounded-[26px] bg-surface py-3 pr-3 pl-[14px]"
              >
                <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-bg text-[14px] font-semibold text-neutral-700">
                  {pendingItems.length - index}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[16px] font-semibold">{item.code}</div>
                  <div className="mt-0.5 truncate font-mono text-[12px] opacity-50">
                    serial {maskSerial(item.serial)}
                  </div>
                </div>
                <button
                  type="button"
                  className="grid h-14 w-14 flex-none place-items-center rounded-full bg-accent-200 text-accent-800"
                  aria-label="待機リストから削除"
                  onClick={() => handleRemove(item.serial)}
                >
                  <TrashIcon size={24} />
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="h-11 self-start rounded-full border border-divider px-5 text-[14px] font-semibold"
            onClick={handleClear}
          >
            すべて消去
          </button>
        </>
      )}

      <p className="mt-[14px] text-[11.5px] leading-[1.6] text-text/55">
        読み取ったQRの情報と取得したクーポンコードは中継のため当方のサーバーを経由しますが、保存もログ出力もしません。旬すぐ運営とは一切関係ありません。
        {/* 素の <a> を新規タブで開く。同一タブ遷移だと親の jobs state が消える。 */}
        <a
          className="text-accent-900 underline underline-offset-2"
          href={withBasePath('/about')}
          target="_blank"
          rel="noopener noreferrer"
        >
          データの取り扱い・免責事項
        </a>
      </p>

      <div className="bar-fade fixed inset-x-0 bottom-0 z-10">
        <div className="pb-home mx-auto flex w-full max-w-[480px] gap-[10px] px-[18px] pt-[14px]">
          <button
            type="button"
            className="h-14 w-[118px] flex-none rounded-full border border-divider text-[15px] font-semibold disabled:opacity-40"
            disabled={isRunning}
            onClick={isCameraActive ? stopScanning : () => void startScanning()}
          >
            {isCameraActive ? 'カメラ停止' : 'カメラ起動'}
          </button>

          {isRunning ? (
            <button
              type="button"
              className="h-14 flex-1 rounded-full border border-accent text-[15px] font-semibold text-accent-900"
              onClick={onAbort}
            >
              中止
            </button>
          ) : (
            <button
              type="button"
              className="on-accent h-14 flex-1 rounded-full font-heading text-[17px] disabled:opacity-40"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {pendingItems.length}件を実行
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
