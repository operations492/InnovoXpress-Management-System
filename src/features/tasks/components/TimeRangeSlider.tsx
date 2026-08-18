/** Dual-handle slider for a time-of-day window (minutes since midnight, 0–1439). */
import { cn } from '@/lib/utils';

interface TimeRangeSliderProps {
  from: number;
  to: number;
  onChange: (from: number, to: number) => void;
  width?: number;
}

const MIN = 0;
const MAX = 1439;
const STEP = 15;

export function TimeRangeSlider({ from, to, onChange, width = 120 }: TimeRangeSliderProps) {
  const pct = (v: number) => (v / MAX) * 100;
  // When the two thumbs overlap, keep the grabbable one on top so neither gets stuck:
  // 'from' on top (so it can be dragged back down) unless both are pinned at the
  // minimum, where 'to' must stay free to be dragged back up.
  const fromOnTop = from >= to && from > MIN;

  return (
    <div className="relative flex h-4 items-center" style={{ width }}>
      <div className="absolute inset-x-0 h-1 rounded-full bg-muted" />
      <div
        className="absolute h-1 rounded-full bg-primary"
        style={{ left: `${pct(from)}%`, width: `${pct(to) - pct(from)}%` }}
      />
      <input
        className={cn('ix-range', fromOnTop ? 'z-[5]' : 'z-[3]')}
        type="range"
        min={MIN}
        max={MAX}
        step={STEP}
        value={from}
        aria-label="Start time"
        onChange={(e) => onChange(Math.min(Number(e.target.value), to), to)}
      />
      <input
        className="ix-range z-[4]"
        type="range"
        min={MIN}
        max={MAX}
        step={STEP}
        value={to}
        aria-label="End time"
        onChange={(e) => onChange(from, Math.max(Number(e.target.value), from))}
      />
    </div>
  );
}
