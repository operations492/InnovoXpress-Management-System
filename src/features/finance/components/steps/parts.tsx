import type { ReactNode } from 'react';
import { Icon } from '@/ui';

/** Section heading used at the top of each builder step. */
export function StepHead({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-[15px] font-bold tracking-tight text-foreground">{title}</h2>
        <p className="text-[12.5px] text-muted-foreground">{hint}</p>
      </div>
      {action}
    </div>
  );
}

/** A labelled row with a remove (x) button. */
export function RemovableRow({ label, onRemove }: { label: ReactNode; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{label}</span>
      <button
        type="button"
        aria-label="Remove"
        onClick={onRemove}
        className="grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

const NUM = (v: string): number | null => (v.trim() === '' ? null : Number(v));
export { NUM as parseNumOrNull };
