import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Icon, Modal } from '@/ui';
import { cn } from '@/lib/utils';
import type { MapDriverDto, MapPinDto } from '@/lib/api';
import { AddressField, type AddressValue } from '@/features/tasks/components/AddressAutocomplete';

/**
 * Plan a run from the tasks currently lassoed.
 *
 * Three inputs, and the asymmetry between them is the design: **start is mandatory**
 * because a route has to begin somewhere and the depot is where the driver collects
 * everything; **end is optional** because plenty of runs simply finish at the last
 * drop; **driver is mandatory** because a plan with no owner is not a plan.
 *
 * Saving does NOT show the route. That is deliberate and was asked for — the
 * operator carries on selecting, and the plan is read later from the DRIVERS tab.
 */

const EMPTY: AddressValue = { line1: '', province: '', city: '', postcode: '', lat: null, lng: null };

const pinned = (a: AddressValue) => a.lat !== null && a.lng !== null;

interface CreateRouteModalProps {
  open: boolean;
  onClose: () => void;
  /** The lassoed tasks, already filtered to ones that can be routed. */
  tasks: MapPinDto[];
  drivers: MapDriverDto[];
  onSave: (input: {
    driverId: string;
    consignmentIds: string[];
    start: { lat: number; lng: number; label?: string };
    end?: { lat: number; lng: number; label?: string };
  }) => void;
  pending?: boolean;
  error?: string | null;
}

export function CreateRouteModal({
  open,
  onClose,
  tasks,
  drivers,
  onSave,
  pending,
  error,
}: CreateRouteModalProps) {
  const [start, setStart] = useState<AddressValue>(EMPTY);
  const [end, setEnd] = useState<AddressValue>(EMPTY);
  const [driverId, setDriverId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStart(EMPTY);
      setEnd(EMPTY);
      setDriverId(null);
    }
  }, [open]);

  // Only on-shift drivers: the API refuses anyone else with a 409, and offering a
  // name that cannot be chosen is worse than a shorter list.
  const available = useMemo(
    () => drivers.filter((d) => d.active && d.onShift),
    [drivers],
  );

  const unpinned = useMemo(
    () => tasks.filter((t) => t.receiverLat === null || t.receiverLng === null),
    [tasks],
  );
  const routable = tasks.length - unpinned.length;

  const canSave = pinned(start) && !!driverId && routable >= 2 && !pending;

  const labelOf = (a: AddressValue) =>
    [a.line1, a.province, a.city].filter(Boolean).join(', ') || undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create route"
      width={520}
      footer={
        <>
          <Button variant="utility" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canSave}
            onClick={() =>
              driverId &&
              onSave({
                driverId,
                consignmentIds: tasks
                  .filter((t) => t.receiverLat !== null && t.receiverLng !== null)
                  .map((t) => t.id),
                start: { lat: start.lat as number, lng: start.lng as number, label: labelOf(start) },
                end: pinned(end)
                  ? { lat: end.lat as number, lng: end.lng as number, label: labelOf(end) }
                  : undefined,
              })
            }
          >
            {pending ? 'Planning…' : 'Save route'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {routable} delivery{routable === 1 ? '' : ' stops'} will be ordered for the shortest
          driving time, starting from the collection point.
        </p>

        {unpinned.length > 0 && (
          // Named, not counted: with fifty selected, "some cannot be routed" gives
          // an operator nothing to go and fix.
          <p className="rounded-md bg-warning/5 px-3 py-2.5 text-xs text-warning">
            {unpinned.length} selected order{unpinned.length === 1 ? ' has' : 's have'} no delivery
            pin and will be left out: {unpinned.map((t) => t.orderNo).join(', ')}
          </p>
        )}

        <AddressField
          label="Start — where the driver collects"
          tone="pickup"
          value={start}
          onSave={setStart}
        />

        <div className="flex flex-col gap-1.5">
          <AddressField label="End (optional)" tone="drop" value={end} onSave={setEnd} />
          <p className="text-[11px] text-muted-foreground">
            Leave empty to finish at the last delivery.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Driver
            <span aria-hidden className="ml-0.5 text-danger">
              *
            </span>
          </span>

          <div className="flex max-h-[190px] flex-col gap-0.5 overflow-y-auto">
            {available.map((d) => {
              const selected = driverId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDriverId(d.id)}
                  className={cn(
                    'ix-reset-btn flex items-center gap-2.5 rounded-md p-2 text-left transition-colors',
                    selected ? 'bg-accent' : 'hover:bg-muted',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-3.5 shrink-0 place-items-center rounded-full border-2',
                      selected ? 'border-primary' : 'border-input',
                    )}
                  >
                    {selected && <span className="size-1.5 rounded-full bg-primary" />}
                  </span>
                  <Avatar name={d.name} size={28} />
                  <span className="ix-clip flex-1 text-[13px] text-foreground">{d.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {d.assignedCount} active
                  </span>
                </button>
              );
            })}

            {available.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                No drivers are on shift — a route cannot be planned for someone who has gone home.
              </p>
            )}
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-danger/5 px-3 py-2.5 text-xs text-danger">{error}</p>
        )}

        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Icon name="clock" size={12} className="mt-px shrink-0" />
          Ordered by driving time on static road speeds — not live traffic, and delivery time
          windows are not taken into account.
        </p>
      </div>
    </Modal>
  );
}
