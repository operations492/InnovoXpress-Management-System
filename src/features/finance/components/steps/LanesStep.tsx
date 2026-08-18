import { useState } from 'react';
import { Button, Icon, Select } from '@/ui';
import { genId } from '@/domain/id';
import type { RateVersion } from '@/domain/ratePlan';
import type { Zone } from '@/domain/serviceZone';
import { StepHead, RemovableRow } from './parts';

interface Props {
  version: RateVersion;
  patch: (p: Partial<RateVersion>) => void;
  zones: Zone[];
}

/** Step 3 — define origin → destination lanes from the plan's Zone Book. */
export function LanesStep({ version, patch, zones }: Props) {
  const [source, setSource] = useState('');
  const [dest, setDest] = useState('');

  const zoneOpts = zones.map((z) => ({ value: z.name, label: z.name }));
  const add = () => {
    if (!source || !dest) return;
    patch({ lanes: [...version.lanes, { id: genId(), source, dest }] });
    setDest('');
  };
  const remove = (id: string) => patch({ lanes: version.lanes.filter((l) => l.id !== id) });

  return (
    <div className="space-y-3">
      <StepHead title="Lanes" hint="Add origin → destination zone pairs. Rates can differ per lane." />
      {zones.length === 0 ? (
        <p className="text-[13px] text-[color:var(--status-warning)]">
          This plan has no Zone Book (or the book has no zones). Set a Zone Book on the plan first.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-52">
            <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Source zone</span>
            <Select value={source} placeholder="Origin…" options={zoneOpts} onChange={(e) => setSource(e.target.value)} />
          </div>
          <Icon name="chevronRight" size={16} className="mb-2 text-muted-foreground" />
          <div className="w-52">
            <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Destination zone</span>
            <Select value={dest} placeholder="Destination…" options={zoneOpts} onChange={(e) => setDest(e.target.value)} />
          </div>
          <Button variant="primary" size="sm" leadingIcon={<Icon name="plus" size={14} />} disabled={!source || !dest} onClick={add}>
            Add lane
          </Button>
        </div>
      )}
      <div className="max-w-xl space-y-1.5">
        {version.lanes.map((l) => (
          <RemovableRow
            key={l.id}
            label={
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                {l.source}
                <Icon name="chevronRight" size={12} className="text-muted-foreground" />
                <span className="size-2 rounded-full" style={{ backgroundColor: 'var(--status-info)' }} />
                {l.dest}
              </span>
            }
            onRemove={() => remove(l.id)}
          />
        ))}
        {version.lanes.length === 0 && <p className="text-[13px] text-muted-foreground">No lanes yet.</p>}
      </div>
    </div>
  );
}
