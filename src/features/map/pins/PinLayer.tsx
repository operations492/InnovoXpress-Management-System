import { memo } from 'react';
import { Polyline } from 'react-leaflet';
import type { MapPinDto } from '@/lib/api';
import type { ColourMode } from '../state/mapView';
import type { PinGroup } from './grouping';
import { pinColour, pinGlyph } from './pinIcon';
import { TaskPin } from './TaskPin';

interface PinLayerProps {
  groups: PinGroup[];
  colourMode: ColourMode;
  colorIndexOf: (driverId: string) => number | undefined;
  openTaskId: string | null;
  /** Ids in the multi-selection, for the pin's selected look. */
  selectedTaskIds: string[];
  /** Must be referentially stable, or every pin re-renders. */
  onSelect: (taskId: string, taskIds: string, additive: boolean) => void;
  /** The open task, so its collection leg can be drawn. */
  openPin: MapPinDto | null;
}

/**
 * Every pin, plus one line.
 *
 * The line is the only use of the sender coordinates: plotting all of them would
 * double the marker count for no gain, but showing where the OPEN task is
 * collected from is genuinely useful and costs one polyline.
 */
function PinLayerImpl({
  groups,
  colourMode,
  colorIndexOf,
  openTaskId,
  selectedTaskIds,
  onSelect,
  openPin,
}: PinLayerProps) {
  // A Set, because this is checked once per pin and the selection can be large.
  const selectedSet = new Set(selectedTaskIds);
  const leg =
    openPin &&
    openPin.senderLat !== null &&
    openPin.senderLng !== null &&
    openPin.lat !== null &&
    openPin.lng !== null
      ? ([
          [openPin.senderLat, openPin.senderLng],
          [openPin.lat, openPin.lng],
        ] as Array<[number, number]>)
      : null;

  return (
    <>
      {leg && (
        <Polyline
          positions={leg}
          pathOptions={{
            color: 'var(--color-muted)',
            weight: 2,
            dashArray: '4 6',
            interactive: false,
          }}
        />
      )}

      {groups.map((group) => (
        <TaskPin
          key={group.key}
          taskId={group.lead.id}
          lat={group.lat}
          lng={group.lng}
          colour={pinColour(group.lead, colourMode, colorIndexOf)}
          glyph={pinGlyph(group.lead.taskType)}
          taskIds={group.pins.map((p) => p.id).join(',')}
          selected={group.pins.some((p) => p.id === openTaskId)}
          inSelection={group.pins.some((p) => selectedSet.has(p.id))}
          count={group.pins.length}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

export const PinLayer = memo(PinLayerImpl);
