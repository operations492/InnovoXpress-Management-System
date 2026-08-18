/**
 * Lifecycle status chip — an Iris soft-tint pill (dot + label) whose color is
 * driven by domain/status.ts (the single source for the 8-status vocabulary).
 * When `onClick` is provided it renders as a real <button> so the status cell is
 * keyboard-accessible.
 */
import type { CSSProperties } from 'react';
import { statusColorVar, statusLabel } from '@/domain/status';
import type { TaskStatus } from '@/domain/status';

interface StatusChipProps {
  status: TaskStatus;
  onClick?: () => void;
  title?: string;
  style?: CSSProperties;
}

export function StatusChip({ status, onClick, title, style }: StatusChipProps) {
  const color = statusColorVar(status);
  const chip = (
    <span
      className="inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
        ...style,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {statusLabel(status)}
    </span>
  );

  if (!onClick) return chip;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? 'Change status'}
      className="ix-reset-btn leading-none"
    >
      {chip}
    </button>
  );
}
