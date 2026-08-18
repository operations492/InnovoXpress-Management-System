import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Icon, Input, Switch } from '@/ui';
import { genId } from '@/domain/id';
import { formatLevyRate, isExpired, type LevyRate } from '@/domain/rateLevy';

const TODAY = new Date().toISOString().slice(0, 10);
const GRID = 'grid grid-cols-[1fr_104px_104px_52px_28px] items-center gap-2';

interface Props {
  rates: LevyRate[];
  onChange: (rates: LevyRate[]) => void;
}

/** Date-versioned rate history — add/edit/delete dated rate periods (% or flat $). */
export function RateScheduleEditor({ rates, onChange }: Props) {
  const [showExpired, setShowExpired] = useState(false);
  const [draft, setDraft] = useState<LevyRate | null>(null);

  const visible = rates
    .filter((r) => showExpired || !isExpired(r, TODAY))
    .slice()
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));

  const startNew = () => setDraft({ id: genId(), rate: 0, flatRate: false, effectiveFrom: TODAY, expireOn: '' });
  const startEdit = (r: LevyRate) => setDraft({ ...r });
  const cancel = () => setDraft(null);
  const save = () => {
    if (!draft) return;
    const exists = rates.some((r) => r.id === draft.id);
    onChange(exists ? rates.map((r) => (r.id === draft.id ? draft : r)) : [...rates, draft]);
    setDraft(null);
  };
  const remove = (id: string) => onChange(rates.filter((r) => r.id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Rate Schedule</span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Switch checked={showExpired} onChange={(e) => setShowExpired(e.target.checked)} /> Show expired
          </label>
          <Button variant="utility" size="sm" leadingIcon={<Icon name="plus" size={14} />} onClick={startNew}>
            Add rate
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div
          className={cn(
            GRID,
            'border-b bg-muted px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground',
          )}
        >
          <span>Rate</span>
          <span>Effective</span>
          <span>Expire</span>
          <span>Flat</span>
          <span />
        </div>
        {visible.map((r) => (
          <div
            key={r.id}
            className={cn(GRID, 'border-b px-3 py-2 last:border-b-0 hover:bg-muted', isExpired(r, TODAY) && 'opacity-60')}
          >
            <button
              type="button"
              onClick={() => startEdit(r)}
              className="text-left font-mono text-[13px] text-foreground hover:text-primary"
            >
              {formatLevyRate(r)}
            </button>
            <span className="font-mono text-[12px] text-muted-foreground">{r.effectiveFrom || '—'}</span>
            <span className="font-mono text-[12px] text-muted-foreground">{r.expireOn || '—'}</span>
            <span className="text-[12px] text-muted-foreground">{r.flatRate ? 'Yes' : 'No'}</span>
            <button
              type="button"
              aria-label="Delete rate period"
              onClick={() => remove(r.id)}
              className="grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground"
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">No rate periods.</div>
        )}
      </div>

      {draft && (
        <div className="space-y-3 rounded-lg border bg-muted p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {rates.some((r) => r.id === draft.id) ? 'Edit rate period' : 'New rate period'}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">
                Rate {draft.flatRate ? '($)' : '(%)'}
              </span>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={String(draft.rate)}
                onChange={(e) => setDraft({ ...draft, rate: Number(e.target.value) })}
              />
            </label>
            <label className="flex items-end gap-2 pb-2">
              <Switch checked={draft.flatRate} onChange={(e) => setDraft({ ...draft, flatRate: e.target.checked })} />
              <span className="text-[13px] text-foreground">Flat rate ($)</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Effective Date</span>
              <Input
                type="date"
                value={draft.effectiveFrom}
                onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Expire Date</span>
              <Input
                type="date"
                value={draft.expireOn}
                onChange={(e) => setDraft({ ...draft, expireOn: e.target.value })}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={cancel}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={save}>
              Save rate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
