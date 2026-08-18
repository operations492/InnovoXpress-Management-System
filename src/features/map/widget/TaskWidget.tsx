import { Avatar, Badge, Button, Icon, IconButton, StatusChip } from '@/ui';
import type { TaskStatus } from '@/domain/status';
import { isEditable } from '@/domain/status';
import type { MapPinDto } from '@/lib/api';

interface TaskWidgetProps {
  pin: MapPinDto;
  /** Other orders at the same coordinate, so a stack is not invisible. */
  siblings: MapPinDto[];
  onClose: () => void;
  onView: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  onAssign: (taskId: string) => void;
  onSelectSibling: (taskId: string) => void;
}

function timeWindow(readyBy: string | null, deliverBy: string | null): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (readyBy && deliverBy) return `${fmt(readyBy)} – ${fmt(deliverBy)}`;
  if (deliverBy) return `By ${fmt(deliverBy)}`;
  if (readyBy) return `From ${fmt(readyBy)}`;
  return 'No time window';
}

/**
 * The pin's details card.
 *
 * Renders entirely from the pin row and never fetches — that is what makes a pin
 * click feel instant. Only the modals it opens read the full record.
 */
export function TaskWidget({
  pin,
  siblings,
  onClose,
  onView,
  onEdit,
  onAssign,
  onSelectSibling,
}: TaskWidgetProps) {
  const others = siblings.filter((s) => s.id !== pin.id);
  // The API refuses edits once a run has started, so the button is hidden
  // rather than offered and then rejected with a 409.
  const editable = isEditable(pin.status as TaskStatus);

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
          <Avatar name={pin.driver.name} size={44} />
        ) : (
          // No driver photos exist in the schema, so this is the placeholder the
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
        <div className="flex items-start gap-2">
          <Icon name="pin" size={14} />
          <span className="text-foreground">
            {pin.receiverLine1}
            {pin.receiverArea ? `, ${pin.receiverArea}` : ''}, {pin.receiverCity}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Icon name="package" size={14} />
          <span className="text-foreground">Quantity: {pin.totalQty}</span>
        </div>
        <div className="flex items-start gap-2">
          <Icon name="clock" size={14} />
          <span className="text-foreground">{timeWindow(pin.readyBy, pin.deliverBy)}</span>
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
