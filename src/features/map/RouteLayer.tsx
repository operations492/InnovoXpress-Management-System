import { Marker, Polyline, Tooltip } from 'react-leaflet';
import type { RouteDto } from '@/lib/api';
import { placeIcon } from '@/components/map/markers';
import { seqIcon } from './pins/pinIcon';

/**
 * A planned route drawn over the map: the line, the depot, and numbered stops.
 *
 * Rendered only while a driver is selected in the DRIVERS tab, which is what makes
 * "saving a route does not show it" true — the plan is read deliberately, not
 * thrown at the operator the moment it is created.
 *
 * The line is drawn as a casing plus a stroke because a single thin line disappears
 * over a busy city map, and it sits under the markers so the numbers stay readable.
 */
interface RouteLayerProps {
  route: RouteDto;
  /** Highlighted stop, kept in step with the sidebar. */
  activeConsignmentId: string | null;
  onSelectStop: (consignmentId: string) => void;
}

export function RouteLayer({ route, activeConsignmentId, onSelectStop }: RouteLayerProps) {
  return (
    <>
      {route.points.length > 1 && (
        <>
          <Polyline
            positions={route.points}
            pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.9 }}
            interactive={false}
          />
          <Polyline
            positions={route.points}
            pathOptions={{ color: '#4B3FCF', weight: 4, opacity: 0.95 }}
            interactive={false}
          />
        </>
      )}

      {/* The depot. A teardrop, like every other fixed place in the app — stops are
          circles, and the two must never be confusable at a glance. */}
      <Marker
        position={[route.start.lat, route.start.lng]}
        icon={placeIcon('#45455C', 'S')}
        zIndexOffset={600}
      >
        <Tooltip direction="top" offset={[0, -22]}>
          <span className="text-[11px]">Start — {route.start.label ?? 'collection point'}</span>
        </Tooltip>
      </Marker>

      {route.end && (
        <Marker
          position={[route.end.lat, route.end.lng]}
          icon={placeIcon('#4B3FCF', 'E')}
          zIndexOffset={600}
        >
          <Tooltip direction="top" offset={[0, -22]}>
            <span className="text-[11px]">End — {route.end.label ?? 'finish'}</span>
          </Tooltip>
        </Marker>
      )}

      {route.stops.map((stop) => (
        <Marker
          key={stop.consignmentId}
          position={[stop.lat, stop.lng]}
          icon={seqIcon(
            stop.seq,
            activeConsignmentId === stop.consignmentId,
            stop.issues.length > 0,
          )}
          zIndexOffset={activeConsignmentId === stop.consignmentId ? 500 : 100}
          eventHandlers={{ click: () => onSelectStop(stop.consignmentId) }}
        >
          <Tooltip direction="top" offset={[0, -16]}>
            <span className="text-[11px]">
              {stop.seq}. {stop.receiverLine1}
            </span>
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
