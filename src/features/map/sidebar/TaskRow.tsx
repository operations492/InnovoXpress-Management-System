import { Avatar, Icon, IconButton } from '@/ui';
import type { MapPinDto } from '@/lib/api';

interface TaskRowProps {
  pin: MapPinDto;
  /** Status hue, or the driver's, depending on the colour mode. */
  borderColour: string;
  selected: boolean;
  onOpen: (taskId: string) => void;
  onAssign: (taskId: string) => void;
  onEdit: (taskId: string) => void;
  /** The Assigned and Completed tabs show who is carrying it. */
  showDriver: boolean;
  /** Hidden once a run has started — the API refuses the edit with a 409. */
  editable: boolean;
}

function timeLabel(pin: MapPinDto): string {
  const iso = pin.deliverBefore ?? pin.pickupAfter;
  if (!iso) return '';
  return new Date(iso).toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * One sidebar row.
 *
 * The left border is the status (or driver) colour — the spec's main signal for
 * scanning the list. Quick actions appear on hover, which is why the row is a
 * div with a button inside rather than one big button: a button cannot contain
 * other buttons.
 */
export function TaskRow({
  pin,
  borderColour,
  selected,
  onOpen,
  onAssign,
  onEdit,
  showDriver,
  editable,
}: TaskRowProps) {
  const unplottable = pin.lat === null;

  return (
    <div
      className={`group/row relative flex items-center gap-2 border-b py-2 pr-2 pl-3 transition-colors ${
        selected ? 'bg-accent' : 'hover:bg-muted'
      }`}
      style={{ boxShadow: `inset 3px 0 0 0 ${borderColour}` }}
    >
      <button
        type="button"
        onClick={() => onOpen(pin.id)}
        className="ix-reset-btn min-w-0 flex-1 text-left"
      >
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">{pin.receiverLine1}</span>
          {unplottable && (
            // These rows are real work with a broken address, so they stay in the
            // list rather than being hidden — but they cannot be plotted.
            <span title="No location — cannot be shown on the map">
              <Icon name="pin" size={12} />
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {pin.receiverCity}
          {pin.receiverProvince ? `, ${pin.receiverProvince}` : ''}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{pin.receiverName}</span>
      </button>

      <span className="flex flex-none flex-col items-end gap-1">
        <span className="font-mono text-[10px] text-muted-foreground">{timeLabel(pin)}</span>
        {showDriver && pin.driver && <Avatar name={pin.driver.name} size={22} />}
      </span>

      {/* Quick actions, revealed on hover or keyboard focus. */}
      <span className="absolute right-2 hidden gap-1 group-hover/row:flex group-focus-within/row:flex">
        {pin.driver === null ? (
          <IconButton
            size="sm"
            title="Assign driver"
            aria-label={`Assign driver to ${pin.orderNo}`}
            onClick={() => onAssign(pin.id)}
          >
            <Icon name="truck" size={14} />
          </IconButton>
        ) : (
          editable && (
            <IconButton
              size="sm"
              title="Edit task"
              aria-label={`Edit ${pin.orderNo}`}
              onClick={() => onEdit(pin.id)}
            >
              <Icon name="pencil" size={14} />
            </IconButton>
          )
        )}
      </span>
    </div>
  );
}
