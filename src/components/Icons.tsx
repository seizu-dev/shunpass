// Lucide のパスをインラインSVGで持つ。アイコン数が4種以下のため、
// ランタイム依存を増やさずデザイン指定（stroke-width: 2.75）をそのまま満たす。

type IconProps = {
  size?: number;
};

function iconProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

export function TrashIcon({ size = 24 }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}

export function CopyIcon({ size = 24 }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <rect x="9" y="9" width="12" height="12" rx="3" />
      <path d="M5 15V5a2 2 0 012-2h8" />
    </svg>
  );
}

export function CheckIcon({ size = 14 }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 20 }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
