import { useMap } from 'react-leaflet';
import { Avatar, Badge, Button, Icon, IconButton, StatusChip } from '@/ui';
import type { TaskStatus } from '@/domain/status';
import { isEditable } from '@/domain/status';
import type { MapPinDto } from '@/lib/api';
import { endAddress, endCoords, otherEnd, type PlotEnd } from '../state/mapView';

interface TaskWidgetProps {
  pin: MapPinDto;
  /** The end the pin sits on: that row is emphasised, the other gets "show on map". */
  plotEnd: PlotEnd;
  /** Other orders at the same coordinate, so a stack is not invisible. */
  siblings: MapPinDto[];
  onClose: () => void;
  onView: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onAssign: (taskId: string) => void;
  onSelectSibling: (taskId: string) => void;
  /**
   * The assigned driver’s own photo, looked up from the roster by MapPage.
   * Not carried on the pin itself: /pins returns hundreds of tasks and would
   * repeat the same driver, signing a URL per row.
   */
  driverPhotoUrl?: string | null;
}

function timeWindow(pickupAfter: string | null, deliverBefore: string | null): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (pickupAfter && deliverBefore) return `${fmt(pickupAfter)} – ${fmt(deliverBefore)}`;
  if (deliverBefore) return `By ${fmt(deliverBefore)}`;
  if (pickupAfter) return `From ${fmt(pickupAfter)}`;
  return 'No time window';
}

function addressLine(a: { line1: string; city: string; province: string | null }): string {
  return `${a.line1}, ${a.city}${a.province ? `, ${a.province}` : ''}`;
}

interface EndRowProps {
  letter: 'P' | 'D';
  label: 'Pickup' | 'Drop-off';
  /** This is the end the pin sits on: filled chip, emphasised text. */
  plotted: boolean;
  text: string;
  /** Only for the other end, and only when it has a coordinate to go to. */
  onLocate?: () => void;
}

/**
 * One end of the job. The chip mirrors the map — filled for the plotted end,
 * hollow for the other — so the widget reads the same way the pins do.
 */
function EndRow({ letter, label, plotted, text, onLocate }: EndRowProps) {
  return (
    <div className="flex items-start gap-2">
      <span
        aria-label={label}
        className={`mt-0.5 flex size-4 flex-none items-center justify-center rounded-full border border-foreground font-mono text-[10px] leading-none font-semibold ${
          plotted ? 'bg-foreground text-white' : 'text-foreground'
        }`}
      >
        {letter}
      </span>
      <span className={`min-w-0 flex-1 text-foreground ${plotted ? 'font-medium' : ''}`}>{text}</span>
      {onLocate && (
        <IconButton
          size="sm"
          title={`Show ${label.toLowerCase()} on map`}
          aria-label={`Show ${label.toLowerCase()} on map`}
          onClick={onLocate}
        >
          <Icon name="navigation" size={12} />
        </IconButton>
      )}
    </div>
  );
}

/**
 * The pin's details card.
 *
 * Renders entirely from the pin row and never fetches — that is what makes a pin
 * click feel instant. Only the modals it opens read the full record.
 */
export function TaskWidget({
  pin,
  plotEnd,
  siblings,
  onClose,
  onView,
  onEdit,
  onAssign,
  onSelectSibling,
  driverPhotoUrl,
}: TaskWidgetProps) {
  const others = siblings.filter((s) => s.id !== pin.id);
  // The API refuses edits once a run has started, so the button is hidden
  // rather than offered and then rejected with a 409.
  const editable = isEditable(pin.status as TaskStatus);

  // Portalled to document.body, but React context crosses portals, so the map
  // this widget belongs to is still in reach for "show the other end".
  const map = useMap();
  const far = otherEnd(plotEnd);
  const farAt = endCoords(pin, far);
  const locate = farAt ? () => map.panTo(farAt) : undefined;

  return (
    <div className="rounded-xl border bg-card p-3 shadow-[var(--elevation-1)]">
      <div className="mb-2 flex items-start gap-2">
        <Badge tone="neutral">{pin.taskType === 'PICKUP' ? 'Pickup' : 'Delivery'}</Badge>
        <span className="flex-1" />
        <StatusChip status={pin.status as TaskStatus} />
        <IconButton size="sm" title="Close" aria-label="Close" onClick={onClose}>
          <Icon name="x" size={14} />
        </IconButton>
      </div>

      <div className="mb-3 flex justify-center">
        {pin.driver ? (
          <Avatar name={pin.driver.name} src={driverPhotoUrl ?? null} size={44} />
        ) : (
          // Nobody is assigned yet, so this is the placeholder the
          // spec asks for when a task is unassigned.
          <span className="flex size-11 items-center justify-center rounded-full border border-dashed text-muted-foreground">
            <Icon name="user" size={20} />
          </span>
        )}
      </div>

      <dl className="mb-3 flex flex-col gap-1.5 text-sm">
        <div className="flex items-start gap-2">
          <Icon name="user" size={14} />
          {/* Not "Unassigned" — the status chip above already says that, and two
              identical words meaning different things reads as a duplicate. */}
          <span className="text-foreground">{pin.driver?.name ?? 'No driver yet'}</span>
        </div>
        <EndRow
          letter="P"
          label="Pickup"
          plotted={plotEnd === 'pickup'}
          text={addressLine(endAddress(pin, 'pickup'))}
          onLocate={far === 'pickup' ? locate : undefined}
        />
        <EndRow
          letter="D"
          label="Drop-off"
          plotted={plotEnd === 'delivery'}
          text={addressLine(endAddress(pin, 'delivery'))}
          onLocate={far === 'delivery' ? locate : undefined}
        />
        <div className="flex items-start gap-2">
          <Icon name="package" size={14} />
          <span className="text-foreground">Quantity: {pin.totalQty}</span>
        </div>
        <div className="flex items-start gap-2">
          <Icon name="clock" size={14} />
          <span className="text-foreground">{timeWindow(pin.pickupAfter, pin.deliverBefore)}</span>
        </div>
      </dl>

      {others.length > 0 && (
        <div className="mb-3 border-t pt-2">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {others.length + 1} orders at this address
          </p>
          <div className="flex flex-wrap gap-1">
            {others.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onSelectSibling(o.id)}
                className="rounded-md border px-1.5 py-0.5 font-mono text-[10px] text-foreground hover:bg-muted"
              >
                {o.orderNo}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Button size="sm" variant="utility" onClick={() => onView(pin.id)}>
          View Task
        </Button>
        {editable ? (
          <Button size="sm" variant="utility" onClick={() => onEdit(pin.id)}>
            Edit Task
          </Button>
        ) : null}
        {!pin.driver && (
          <Button size="sm" variant="primary" onClick={() => onAssign(pin.id)}>
            Assign Driver
          </Button>
        )}
      </div>
    </div>
  );
}
