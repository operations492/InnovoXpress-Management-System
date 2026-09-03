import { useState } from 'react';
import { Button, Checkbox, Icon, Popover } from '@/ui';
import { FILTER_STATUS_KEYS, FILTER_STATUS_LABELS } from '@/domain/status';
import { useDrivers } from '../hooks/useDrivers';

interface ActiveTasksFilterMenuProps {
  fStatus: string[];
  fType: string[];
  fDriver: string[];
  onStatus: (v: string[]) => void;
  onType: (v: string[]) => void;
  onDriver: (v: string[]) => void;
  onClear: () => void;
  /** See DateFilterMenu — `left` for the map, `right` for the tasks toolbar. */
  align?: 'left' | 'right';
}

function toggle(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

function ColumnHead({ children }: { children: React.ReactNode }) {
  return <div className="t-form-label mb-2 text-foreground">{children}</div>;
}

export function ActiveTasksFilterMenu({
  fStatus,
  fType,
  fDriver,
  onStatus,
  onType,
  onDriver,
  onClear,
  align = 'right',
}: ActiveTasksFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const drivers = useDrivers();
  const activeCount = fStatus.length + fType.length + fDriver.length;

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align={align}
      width={560}
      trigger={
        <Button
          variant="utility"
          size="sm"
          leadingIcon={<Icon name="sliders" size={15} />}
          onClick={() => setOpen((o) => !o)}
        >
          Active Tasks{activeCount ? ` (${activeCount})` : ''}
        </Button>
      }
    >
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <ColumnHead>Task Status</ColumnHead>
            <div className="flex flex-col gap-1.5">
              {FILTER_STATUS_KEYS.map((s) => (
                <Checkbox
                  key={s}
                  label={FILTER_STATUS_LABELS[s]}
                  checked={fStatus.includes(s)}
                  onChange={() => onStatus(toggle(fStatus, s))}
                />
              ))}
            </div>
          </div>
          <div>
            <ColumnHead>Task Type</ColumnHead>
            <div className="flex flex-col gap-1.5">
              {['Delivery', 'Pickup'].map((t) => (
                <Checkbox
                  key={t}
                  label={t}
                  checked={fType.includes(t)}
                  onChange={() => onType(toggle(fType, t))}
                />
              ))}
            </div>
          </div>
          <div>
            <ColumnHead>Driver</ColumnHead>
            <div className="flex flex-col gap-1.5">
              {drivers.map((d) => (
                <Checkbox
                  key={d.id}
                  label={d.name}
                  checked={fDriver.includes(d.name)}
                  onChange={() => onDriver(toggle(fDriver, d.name))}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-between border-t pt-3">
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear All Filters
          </Button>
          <Button variant="utility" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </div>
    </Popover>
  );
}
