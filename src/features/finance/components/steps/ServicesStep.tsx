import { Icon, Select } from '@/ui';
import type { RateVersion } from '@/domain/ratePlan';
import type { ServiceLevel } from '@/domain/serviceLevel';
import { StepHead, RemovableRow } from './parts';

interface Props {
  version: RateVersion;
  patch: (p: Partial<RateVersion>) => void;
  levels: ServiceLevel[];
}

/** Step 1 — pick the service levels this version prices. */
export function ServicesStep({ version, patch, levels }: Props) {
  const available = levels.filter((l) => !version.serviceLevelIds.includes(l.id));
  const name = (id: string) => levels.find((l) => l.id === id)?.name ?? id;
  const add = (id: string) => id && patch({ serviceLevelIds: [...version.serviceLevelIds, id] });
  const remove = (id: string) => patch({ serviceLevelIds: version.serviceLevelIds.filter((x) => x !== id) });

  return (
    <div className="space-y-3">
      <StepHead title="Services" hint="Choose which service levels this rate version prices." />
      <div className="w-80">
        <Select
          value=""
          placeholder={available.length ? 'Add a service level…' : 'All service levels added'}
          options={available.map((l) => ({ value: l.id, label: l.name }))}
          onChange={(e) => add(e.target.value)}
          icon={<Icon name="plus" size={14} />}
        />
      </div>
      <div className="max-w-xl space-y-1.5">
        {version.serviceLevelIds.map((id) => (
          <RemovableRow key={id} label={name(id)} onRemove={() => remove(id)} />
        ))}
        {version.serviceLevelIds.length === 0 && (
          <p className="text-[13px] text-muted-foreground">No services added yet.</p>
        )}
      </div>
    </div>
  );
}
