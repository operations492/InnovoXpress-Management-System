import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Icon, Select } from '@/ui';
import { genId } from '@/domain/id';
import {
  CATEGORY_HELP,
  CATEGORY_LABELS,
  RATE_CATEGORIES,
  emptyCategories,
  findRateLine,
  type RateCategory,
  type RateCategoryKey,
  type RateVersion,
} from '@/domain/ratePlan';
import type { ServiceLevel } from '@/domain/serviceLevel';
import type { FreightItem } from '@/domain/freight';
import { RateCategoryEditor } from '../RateCategoryEditor';
import { StepHead } from './parts';

interface Props {
  version: RateVersion;
  patch: (p: Partial<RateVersion>) => void;
  levels: ServiceLevel[];
  freightItems: FreightItem[];
}

/** Step 4 — set tiered rates per (Service × Item × Lane). */
export function RatesStep({ version, patch, levels, freightItems }: Props) {
  const [serviceLevelId, setServiceLevelId] = useState(version.serviceLevelIds[0] ?? '');
  const [itemId, setItemId] = useState(version.items[0]?.id ?? '');
  const [laneId, setLaneId] = useState(version.lanes[0]?.id ?? '');
  const [openCat, setOpenCat] = useState<RateCategoryKey | null>('flat');

  const missing = version.serviceLevelIds.length === 0 || version.items.length === 0 || version.lanes.length === 0;
  const ready = Boolean(serviceLevelId && itemId && laneId);
  const line = ready ? findRateLine(version, serviceLevelId, itemId, laneId) : null;
  const cats = line?.categories ?? emptyCategories();

  const setCategory = (key: RateCategoryKey, cat: RateCategory) => {
    if (!ready) return;
    if (line) {
      patch({
        rateLines: version.rateLines.map((l) =>
          l.id === line.id ? { ...l, categories: { ...l.categories, [key]: cat } } : l,
        ),
      });
    } else {
      patch({
        rateLines: [
          ...version.rateLines,
          { id: genId(), serviceLevelId, itemId, laneId, categories: { ...emptyCategories(), [key]: cat } },
        ],
      });
    }
  };

  const lname = (id: string) => levels.find((l) => l.id === id)?.name ?? id;
  const iname = (rateItemId: string) => {
    const it = version.items.find((x) => x.id === rateItemId);
    return it ? freightItems.find((f) => f.id === it.freightItemId)?.name ?? it.freightItemId : rateItemId;
  };
  const laneLabel = (id: string) => {
    const ln = version.lanes.find((l) => l.id === id);
    return ln ? `${ln.source} → ${ln.dest}` : id;
  };

  return (
    <div className="space-y-3">
      <StepHead title="Rates" hint="Pick a service, item and lane, then set tiered price breaks per rate type." />
      {missing ? (
        <p className="text-[13px] text-[color:var(--status-warning)]">
          Add at least one service, item, and lane in the previous steps first.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <Sel label="Service" value={serviceLevelId} opts={version.serviceLevelIds.map((id) => ({ value: id, label: lname(id) }))} onChange={setServiceLevelId} />
            <Sel label="Item" value={itemId} opts={version.items.map((it) => ({ value: it.id, label: iname(it.id) }))} onChange={setItemId} />
            <Sel label="Lane" value={laneId} opts={version.lanes.map((l) => ({ value: l.id, label: laneLabel(l.id) }))} onChange={setLaneId} />
          </div>

          {ready && (
            <div className="overflow-hidden rounded-xl border">
              {RATE_CATEGORIES.map((key) => {
                const cat = cats[key];
                const open = openCat === key;
                return (
                  <div key={key} className="border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setOpenCat(open ? null : key)}
                      className="flex w-full items-center gap-2 bg-muted px-4 py-2.5 text-left"
                    >
                      <Icon name="chevronRight" size={14} className={cn('text-muted-foreground transition-transform', open && 'rotate-90')} />
                      <span className="text-[13px] font-semibold text-foreground">{CATEGORY_LABELS[key]}</span>
                      {cat.enabled && (
                        <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary">on</span>
                      )}
                      <span className="ml-auto hidden text-[11px] text-muted-foreground md:block">{CATEGORY_HELP[key]}</span>
                    </button>
                    {open && <RateCategoryEditor categoryKey={key} category={cat} onChange={(c) => setCategory(key, c)} />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Sel({
  label,
  value,
  opts,
  onChange,
}: {
  label: string;
  value: string;
  opts: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="w-52">
      <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">{label}</span>
      <Select value={value} options={opts} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
