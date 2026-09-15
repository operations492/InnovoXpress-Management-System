import { Avatar, Icon } from '@/ui';
import type { MapDriverDto, MapPinDto } from '@/lib/api';
import type { PlotEnd } from '../state/mapView';
import { driverColour } from '../pins/pinIcon';
import { TaskRow } from './TaskRow';

interface DriverRowProps {
  driver: MapDriverDto;
  expanded: boolean;
  /** Their tasks, already filtered. Only rendered while expanded. */
  tasks: MapPinDto[];
  /** Which end the map is plotting, so each row names the same address as its pin. */
  plotEnd: PlotEnd;
  /** Swatches only make sense while the colour switch is on. */
  showSwatch: boolean;
  /** Status hue or the driver's, matching the map. */
  borderColourOf: (pin: MapPinDto) => string;
  editableOf: (pin: MapPinDto) => boolean;
  openTaskId: string | null;
  onToggle: (driverId: string) => void;
  onOpenTask: (taskId: string) => void;
  onAssign: (taskId: string) => void;
  onEdit: (taskId: string) => void;
}

/**
 * A driver card, and their tasks as an accordion.
 *
 * The spec's "capacity/load progress bar" is a plain count: there is no
 * per-driver capacity in the schema, so a bar would need a denominator we do not
 * have and would be inventing.
 */
export function DriverRow({
  driver,
  expanded,
  tasks,
  plotEnd,
  showSwatch,
  borderColourOf,
  editableOf,
  openTaskId,
  onToggle,
  onOpenTask,
  onAssign,
  onEdit,
}: DriverRowProps) {
  return (
    <div className="border-b">
      <button
        type="button"
        onClick={() => onToggle(driver.id)}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
          expanded ? 'bg-accent' : 'hover:bg-muted'
        }`}
      >
        <Avatar name={driver.name} size={30} />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{driver.name}</span>
            {showSwatch && (
              <span
                aria-hidden
                className="size-2.5 flex-none rounded-full"
                style={{ background: driverColour(driver.colorIndex) }}
              />
            )}
            {!driver.onShift && (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                off shift
              </span>
            )}
          </span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {driver.assignedCount} assigned
          </span>
        </span>

        <Icon name={expanded ? 'chevronLeft' : 'chevronRight'} size={16} />
      </button>

      {expanded && (
        <div className="bg-background/40">
          {tasks.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">Nothing assigned right now.</p>
          ) : (
            tasks.map((pin) => (
              <TaskRow
                key={pin.id}
                pin={pin}
                plotEnd={plotEnd}
                borderColour={borderColourOf(pin)}
                selected={pin.id === openTaskId}
                onOpen={onOpenTask}
                onAssign={onAssign}
                onEdit={onEdit}
                showDriver={false}
                editable={editableOf(pin)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
