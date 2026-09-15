import { memo } from 'react';
import { Marker, Polyline } from 'react-leaflet';
import type { MapPinDto } from '@/lib/api';
import { endAddress, endCoords, otherEnd, type ColourMode, type PlotEnd } from '../state/mapView';
import type { PinGroup } from './grouping';
import { endGlyph, endRingIcon, pinColour } from './pinIcon';
import { TaskPin } from './TaskPin';

interface PinLayerProps {
  groups: PinGroup[];
  /** Which end every pin sits on; decides the letter and where the ring goes. */
  plotEnd: PlotEnd;
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
 * Every pin, plus the OTHER end of the open job.
 *
 * Plotting both ends of every task would double the marker count for no gain.
 * But the one job the operator has opened is different: showing where it is
 * collected from (or, when plotting pickups, where it goes) is genuinely useful,
 * and costs one hollow ring and one dashed leg between the two.
 */
function PinLayerImpl({
  groups,
  plotEnd,
  colourMode,
  colorIndexOf,
  openTaskId,
  selectedTaskIds,
  onSelect,
  openPin,
}: PinLayerProps) {
  // A Set, because this is checked once per pin and the selection can be large.
  const selectedSet = new Set(selectedTaskIds);
  const glyph = endGlyph(plotEnd);

  const far = otherEnd(plotEnd);
  const farAt = openPin ? endCoords(openPin, far) : null;
  const leg =
    openPin && farAt && openPin.lat !== null && openPin.lng !== null
      ? ([farAt, [openPin.lat, openPin.lng]] as Array<[number, number]>)
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

      {openPin && farAt && (
        // Beneath the pins and not clickable: it marks a place, it is not a task.
        <Marker
          position={farAt}
          icon={endRingIcon(pinColour(openPin, colourMode, colorIndexOf), endGlyph(far))}
          interactive={false}
          zIndexOffset={-100}
          title={`${far === 'pickup' ? 'Pickup' : 'Drop-off'} · ${endAddress(openPin, far).line1}`}
        />
      )}

      {groups.map((group) => (
        <TaskPin
          key={group.key}
          taskId={group.lead.id}
          lat={group.lat}
          lng={group.lng}
          colour={pinColour(group.lead, colourMode, colorIndexOf)}
          glyph={glyph}
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
