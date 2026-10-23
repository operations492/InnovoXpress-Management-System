import { Avatar, Badge, Button, Icon, IconButton } from '@/ui';
import type { DriverLatestDto, MapDriverDto } from '@/lib/api';
import { driverColour } from '../pins/pinIcon';
import { POSITION_LIVE_SECONDS } from '../hooks/useDriverPositions';

interface DriverWidgetProps {
  position: DriverLatestDto;
  /** The roster row, when the two queries agree. Absent mid-refetch. */
  driver: MapDriverDto | undefined;
  onClose: () => void;
  /** Filter the map to this driver's tasks — the DRIVERS tab's own behaviour. */
  onShowTasks: (driverId: string) => void;
}

function ago(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (secs < 60) return `${secs} seconds ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-0.5 text-xs">
      <span className="w-[74px] shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground">{children}</span>
    </div>
  );
}

/**
 * The driver pin's details card — the counterpart to `TaskWidget`.
 *
 * Renders entirely from data already on screen (the position feed plus the
 * roster) and never fetches, which is what makes the click feel instant. The
 * same rule `TaskWidget` follows.
 *
 * **The photo comes from the roster row; Avatar falls back to initials without one.** `drivers` has no
 * image field and there is no avatar bucket, so this shows initials tinted with
 * the driver's own map colour — the same hue as their pin and their tasks, which
 * is the thing an operator is actually matching on.
 */
export function DriverWidget({
  position,
  driver,
  onClose,
  onShowTasks,
}: DriverWidgetProps) {
  const stale = (Date.now() - Date.parse(position.recordedAt)) / 1000 > POSITION_LIVE_SECONDS;
  const colour = driver ? driverColour(driver.colorIndex) : '#64748B';

  // Reported in m/s; nobody thinks in m/s. Below ~1 m/s is standing still as far
  // as a dispatcher is concerned, and GPS jitter alone reads as 0.3 m/s.
  const kmh = position.speedMps != null ? Math.round(position.speedMps * 3.6) : null;
  const moving = kmh != null && kmh >= 4;

  return (
    <div className="w-[248px] rounded-xl border bg-card p-3 shadow-[var(--elevation-1)]">
      <div className="mb-2.5 flex items-start gap-2.5">
        <Avatar
          name={position.name}
          src={driver?.photoUrl ?? null}
          size={38}
          style={{ boxShadow: `0 0 0 2px ${colour}` }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{position.name}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {driver?.code ?? '—'}
          </p>
        </div>
        <IconButton size="sm" title="Close" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={14} />
        </IconButton>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {driver && (
          <Badge tone={driver.onShift ? 'accent' : 'neutral'}>
            {driver.onShift ? 'On shift' : 'Off shift'}
          </Badge>
        )}
        {stale && <Badge tone="warning">Not reporting</Badge>}
        {moving && <Badge tone="info">{kmh} km/h</Badge>}
      </div>

      <div className="mb-2.5 border-t pt-1.5">
        <Row label="Last seen">
          <span className={stale ? 'text-warning' : undefined}>{ago(position.recordedAt)}</span>
        </Row>
        <Row label="Active jobs">{driver ? driver.assignedCount : '—'}</Row>
        <Row label="Position">
          <span className="font-mono text-[11px]">
            {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
          </span>
        </Row>
        {position.accuracyM != null && (
          <Row label="Accuracy">±{Math.round(position.accuracyM)} m</Row>
        )}
      </div>

      {/*
        One action, not two. A "Trail" button would need `DriverLocationModal`,
        which is welded to a Task — it titles by order number and draws that
        order's pickup and drop. Offering it here would mean reworking that
        component, so it is left out rather than half-wired.
      */}
      <Button
        variant="utility"
        size="sm"
        className="w-full"
        onClick={() => onShowTasks(position.driverId)}
      >
        Show their tasks
      </Button>
    </div>
  );
}
