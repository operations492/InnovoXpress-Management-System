import { Button, Icon, Input, Select, Switch } from '@/ui';
import { genId } from '@/domain/id';
import type { RateItem, RateVersion } from '@/domain/ratePlan';
import type { FreightItem } from '@/domain/freight';
import { StepHead, parseNumOrNull } from './parts';

interface Props {
  version: RateVersion;
  patch: (p: Partial<RateVersion>) => void;
  freightItems: FreightItem[];
  onEditOverride: (item: RateItem) => void;
}

/** Step 2 — pick freight items + set cubic multiplier, pro-rata, and overrides. */
export function ItemsStep({ version, patch, freightItems, onEditOverride }: Props) {
  const usedIds = new Set(version.items.map((i) => i.freightItemId));
  const available = freightItems.filter((f) => !usedIds.has(f.id));
  const fname = (id: string) => freightItems.find((f) => f.id === id)?.name ?? id;

  const add = (freightItemId: string) => {
    if (!freightItemId) return;
    const item: RateItem = {
      id: genId(),
      freightItemId,
      cubicMultiplier: null,
      proRataWeight: null,
      proRataHeight: null,
      proRataArea: null,
      defaultFreight: false,
      override: null,
    };
    patch({ items: [...version.items, item] });
  };
  const update = (id: string, p: Partial<RateItem>) =>
    patch({ items: version.items.map((it) => (it.id === id ? { ...it, ...p } : it)) });
  const remove = (id: string) => patch({ items: version.items.filter((it) => it.id !== id) });

  return (
    <div className="space-y-3">
      <StepHead title="Items" hint="Choose freight items and set their cubic multiplier and pro-rata thresholds." />
      <div className="w-80">
        <Select
          value=""
          placeholder={available.length ? 'Add a freight item…' : 'All freight items added'}
          options={available.map((f) => ({ value: f.id, label: f.name }))}
          onChange={(e) => add(e.target.value)}
          icon={<Icon name="plus" size={14} />}
        />
      </div>

      <div className="space-y-3">
        {version.items.map((it) => (
          <div key={it.id} className="rounded-xl border bg-card p-3">
            <div className="mb-3 flex items-center gap-2">
              <Icon name="box" size={15} className="text-muted-foreground" />
              <span className="flex-1 text-[13.5px] font-semibold text-foreground">{fname(it.freightItemId)}</span>
              <Button variant="utility" size="sm" leadingIcon={<Icon name="sliders" size={14} />} onClick={() => onEditOverride(it)}>
                Override{it.override ? ' •' : ''}
              </Button>
              <button
                type="button"
                aria-label="Remove item"
                onClick={() => remove(it.id)}
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <NumField label="Cubic Multiplier" value={it.cubicMultiplier} placeholder="250" onChange={(v) => update(it.id, { cubicMultiplier: v })} />
              <NumField label="Pro-rata Weight" value={it.proRataWeight} onChange={(v) => update(it.id, { proRataWeight: v })} />
              <NumField label="Pro-rata Height (m)" value={it.proRataHeight} onChange={(v) => update(it.id, { proRataHeight: v })} />
              <NumField label="Pro-rata Area (m²)" value={it.proRataArea} onChange={(v) => update(it.id, { proRataArea: v })} />
            </div>
            <label className="mt-3 flex items-center gap-2">
              <Switch checked={it.defaultFreight} onChange={(e) => update(it.id, { defaultFreight: e.target.checked })} />
              <span className="text-[13px] text-foreground">Default freight item</span>
            </label>
          </div>
        ))}
        {version.items.length === 0 && <p className="text-[13px] text-muted-foreground">No items yet.</p>}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | null;
  placeholder?: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      <Input
        type="number"
        step={0.01}
        value={value === null ? '' : String(value)}
        placeholder={placeholder}
        onChange={(e) => onChange(parseNumOrNull(e.target.value))}
      />
    </label>
  );
}
