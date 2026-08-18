import { cn } from '@/lib/utils';
import { Button, Icon, Input, Switch } from '@/ui';
import { genId } from '@/domain/id';
import type { PriceBreak, RateCategory, RateCategoryKey } from '@/domain/ratePlan';

const GRID = 'grid grid-cols-[1fr_1fr_1fr_28px] gap-2';
const BIG = 10_000_000;

interface Props {
  categoryKey: RateCategoryKey;
  category: RateCategory;
  onChange: (cat: RateCategory) => void;
}

/** Editor for one rate category — enable + tier toggles + a price-break table. */
export function RateCategoryEditor({ categoryKey, category, onChange }: Props) {
  const set = (patch: Partial<RateCategory>) => onChange({ ...category, ...patch });
  const setBreak = (id: string, patch: Partial<PriceBreak>) =>
    set({ breaks: category.breaks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const addBreak = () => set({ breaks: [...category.breaks, { id: genId(), from: 0, to: BIG, rate: 0 }] });
  const removeBreak = (id: string) => set({ breaks: category.breaks.filter((b) => b.id !== id) });

  const isMinMax = categoryKey === 'min' || categoryKey === 'max';
  const supportsProgressive = categoryKey === 'quantity' || categoryKey === 'weight';
  const supportsCubic = categoryKey === 'weight';

  return (
    <div className="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <Switch checked={category.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          <span className="text-[13px] text-foreground">Enabled</span>
        </label>
        {category.enabled && supportsProgressive && (
          <label className="flex items-center gap-2">
            <Switch checked={category.progressive} onChange={(e) => set({ progressive: e.target.checked })} />
            <span className="text-[13px] text-muted-foreground">Progressive tiers</span>
          </label>
        )}
        {category.enabled && supportsCubic && (
          <label className="flex items-center gap-2">
            <Switch checked={category.useCubicValue} onChange={(e) => set({ useCubicValue: e.target.checked })} />
            <span className="text-[13px] text-muted-foreground">Use cubic value</span>
          </label>
        )}
      </div>

      {category.enabled && (
        <>
          <div className="overflow-hidden rounded-lg border">
            <div
              className={cn(
                GRID,
                'border-b bg-muted px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground',
              )}
            >
              {isMinMax ? (
                <span className="col-span-2">Applies to</span>
              ) : (
                <>
                  <span>From</span>
                  <span>To</span>
                </>
              )}
              <span>Rate ($)</span>
              <span />
            </div>
            {category.breaks.map((b) => (
              <div key={b.id} className={cn(GRID, 'items-center border-b px-3 py-1.5 last:border-b-0')}>
                {isMinMax ? (
                  <span className="col-span-2 self-center text-[12px] text-muted-foreground">Consignment total</span>
                ) : (
                  <>
                    <Input type="number" value={String(b.from)} onChange={(e) => setBreak(b.id, { from: Number(e.target.value) })} />
                    <Input type="number" value={String(b.to)} onChange={(e) => setBreak(b.id, { to: Number(e.target.value) })} />
                  </>
                )}
                <Input
                  type="number"
                  step={0.01}
                  value={String(b.rate)}
                  onChange={(e) => setBreak(b.id, { rate: Number(e.target.value) })}
                />
                <button
                  type="button"
                  aria-label="Remove break"
                  onClick={() => removeBreak(b.id)}
                  className="grid size-6 place-items-center self-center rounded text-muted-foreground hover:text-foreground"
                >
                  <Icon name="x" size={13} />
                </button>
              </div>
            ))}
            {category.breaks.length === 0 && (
              <div className="px-3 py-4 text-center text-[12px] text-muted-foreground">No breaks — add one.</div>
            )}
          </div>
          <Button variant="ghost" size="sm" leadingIcon={<Icon name="plus" size={13} />} onClick={addBreak}>
            {isMinMax ? 'Add charge' : 'Add price break'}
          </Button>
        </>
      )}
    </div>
  );
}
