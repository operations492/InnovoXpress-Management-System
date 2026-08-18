import { memo, useMemo } from 'react';
import { Marker } from 'react-leaflet';
import { pinIcon } from './pinIcon';

interface TaskPinProps {
  taskId: string;
  lat: number;
  lng: number;
  /** Any CSS colour string — a `var(--status-*)` or a palette hex. */
  colour: string;
  glyph: string;
  selected: boolean;
  count: number;
  onSelect: (taskId: string) => void;
}

/**
 * One marker.
 *
 * Every prop is a primitive and `onSelect` must be stable, or `memo` does
 * nothing and a parent render walks all of them. The icon comes from a
 * module-level cache, so a re-render with unchanged appearance hands Leaflet the
 * same object and it leaves the DOM element alone.
 */
function TaskPinImpl({
  taskId,
  lat,
  lng,
  colour,
  glyph,
  selected,
  count,
  onSelect,
}: TaskPinProps) {
  const icon = useMemo(
    () => pinIcon({ colour, glyph, selected, count }),
    [colour, glyph, selected, count],
  );

  const handlers = useMemo(
    () => ({ click: () => onSelect(taskId) }),
    [onSelect, taskId],
  );

  return <Marker position={[lat, lng]} icon={icon} eventHandlers={handlers} />;
}

export const TaskPin = memo(TaskPinImpl);
