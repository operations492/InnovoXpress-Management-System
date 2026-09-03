import { memo, useMemo } from 'react';
import { Marker } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import { pinIcon } from './pinIcon';

interface TaskPinProps {
  /** The group's lead id — what a plain click opens. */
  taskId: string;
  /**
   * Every id at this coordinate, comma-joined.
   *
   * A STRING rather than an array, deliberately: every prop here has to be a
   * primitive or `memo` compares by reference, misses, and a parent render walks
   * all of them. Ctrl-clicking a stack of twelve orders should take all twelve,
   * so the handler needs the full list without breaking that.
   */
  taskIds: string;
  lat: number;
  lng: number;
  /** Any CSS colour string — a `var(--status-*)` or a palette hex. */
  colour: string;
  glyph: string;
  selected: boolean;
  inSelection: boolean;
  count: number;
  /** `additive` is true when ctrl (or ⌘) was held. */
  onSelect: (taskId: string, taskIds: string, additive: boolean) => void;
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
  taskIds,
  lat,
  lng,
  colour,
  glyph,
  selected,
  inSelection,
  count,
  onSelect,
}: TaskPinProps) {
  const icon = useMemo(
    () => pinIcon({ colour, glyph, selected, inSelection, count }),
    [colour, glyph, selected, inSelection, count],
  );

  const handlers = useMemo(
    () => ({
      click: (e: LeafletMouseEvent) => {
        /*
         * `metaKey` as well as `ctrlKey`: on macOS ⌘ is the multi-select modifier
         * and Ctrl+click is interpreted as a right-click, so a ctrl-only check
         * would leave Mac operators with no way to do this at all.
         */
        const additive = e.originalEvent.ctrlKey || e.originalEvent.metaKey;
        onSelect(taskId, taskIds, additive);
      },
    }),
    [onSelect, taskId, taskIds],
  );

  return <Marker position={[lat, lng]} icon={icon} eventHandlers={handlers} />;
}

export const TaskPin = memo(TaskPinImpl);
