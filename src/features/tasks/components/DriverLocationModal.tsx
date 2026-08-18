/**
 * Live driver tracking for one consignment.
 *
 * Shows the pickup and delivery pins, the driver's current position, and the
 * path they have taken. Polls every 5 seconds — see useDriverTrail for why this
 * is not Realtime.
 *
 * "No location yet" is a first-class state, not an error: the backend's
 * latest-position endpoint only looks back 60 minutes, so a driver whose app
 * has not reported simply is not in the response.
 */
import { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button, Icon, Modal } from '@/ui';
import type { Task } from '@/domain/types';
import { formatDistance } from '@/domain/trail';
import { driverIcon, placeIcon } from '@/components/map/markers';
import { useDriverTrail } from '../hooks/useDriverTrail';

export interface DriverLocationModalProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
}

export function DriverLocationModal({ open, task, onClose }: DriverLocationModalProps) {
  const { latest, points, dropped, distanceM, retentionDays, error } = useDriverTrail(
    task?.driverId || null,
    task?.id ?? null,
    open,
  );

  if (!task) return null;

  const pickup = coord(task.dispatchLat, task.dispatchLng);
  const drop = coord(task.destLat, task.destLng);
  const driver = latest ? ([latest.lat, latest.lng] as [number, number]) : null;

  const anchors = [pickup, drop, driver, ...points.map((p) => [p.lat, p.lng] as [number, number])]
    .filter(Boolean) as [number, number][];

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={880}
      title={`Driver live location — ${task.orderNo}`}
      footer={
        <Button variant="utility" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <StatusStrip
          task={task}
          latest={latest}
          pointCount={points.length}
          dropped={dropped}
          distanceM={distanceM}
          error={error}
        />

        {anchors.length === 0 ? (
          <EmptyMap />
        ) : (
          <div className="h-[440px] w-full overflow-hidden rounded-xl border border-border">
            <MapContainer
              center={anchors[0]}
              zoom={13}
              scrollWheelZoom
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {/* A Leaflet map mounted inside a just-opened dialog measures a
                  0x0 container and renders grey. This fixes both that and the
                  framing. */}
              <FitToContent anchors={anchors} />

              {points.length > 1 && (
                <Polyline
                  positions={points.map((p) => [p.lat, p.lng] as [number, number])}
                  pathOptions={{ color: '#4B3FCF', weight: 4, opacity: 0.75 }}
                />
              )}

              {pickup && <Marker position={pickup} icon={placeIcon('#45455C', 'P')} />}
              {drop && <Marker position={drop} icon={placeIcon('#4B3FCF', 'D')} />}

              {/* How sure we are, drawn to scale. A ±200m fix should look like
                  "roughly here", not a confident dot. */}
              {driver && latest?.accuracyM != null && latest.accuracyM > 25 && (
                <Circle
                  center={driver}
                  radius={latest.accuracyM}
                  pathOptions={{ color: '#16A34A', weight: 1, opacity: 0.5, fillOpacity: 0.08 }}
                />
              )}
              {driver && <Marker position={driver} icon={driverIcon(latest?.headingDeg ?? null)} />}
            </MapContainer>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <Legend colour="#45455C" label="Pickup" />
          <Legend colour="#4B3FCF" label="Delivery" />
          <Legend colour="#16A34A" label="Driver" />
          {retentionDays !== null && <span>Trail kept for {retentionDays} days</span>}
          <span>Updates every 5s</span>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function StatusStrip({
  task,
  latest,
  pointCount,
  dropped,
  distanceM,
  error,
}: {
  task: Task;
  latest: { recordedAt: string; accuracyM: number | null } | null;
  pointCount: number;
  dropped: number;
  distanceM: number;
  error: Error | null;
}) {
  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
        {error.message}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon name="truck" size={15} />
        {task.driver || 'Unassigned'}
      </span>

      {latest ? (
        <>
          <span className="flex items-center gap-1.5 text-xs text-success">
            <span className="inline-block size-2 animate-pulse rounded-full bg-success" />
            Live · {ago(latest.recordedAt)}
          </span>
          {latest.accuracyM !== null && (
            <span className="font-mono text-xs text-muted-foreground">
              ±{Math.round(latest.accuracyM)} m
            </span>
          )}
          <span className="font-mono text-xs text-muted-foreground">
            {pointCount} points · {formatDistance(distanceM)}
          </span>
          {dropped > 0 && (
            <span
              className="font-mono text-xs text-muted-foreground"
              title="Fixes discarded as noise: poor accuracy, no real movement, or an impossible jump. Indoors a phone positions by Wi-Fi rather than GPS."
            >
              {dropped} noisy fixes hidden
            </span>
          )}
        </>
      ) : (
        <span className="text-xs text-muted-foreground">
          Location not received yet — this driver&rsquo;s app hasn&rsquo;t reported a position.
        </span>
      )}
    </div>
  );
}

function EmptyMap() {
  return (
    <div className="flex h-[440px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 text-center">
      <Icon name="pin" size={22} />
      <p className="text-sm font-medium text-foreground">Nothing to plot yet</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        This order has no pickup or delivery coordinates, and the driver has not reported a position.
        Edit the order and set both map pins to see it here.
      </p>
    </div>
  );
}

function Legend({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-full" style={{ background: colour }} />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */

const coord = (lat: number | null, lng: number | null): [number, number] | null =>
  lat !== null && lng !== null ? [lat, lng] : null;

// placeIcon and driverIcon moved to components/map/markers.ts when the assign
// screen needed the same marks — two screens drawing "the pickup" differently is
// how an operator learns to distrust both.

function FitToContent({ anchors }: { anchors: [number, number][] }) {
  const map = useMap();
  const key = useMemo(() => anchors.map((a) => a.join(',')).join('|'), [anchors]);

  useEffect(() => {
    // Without invalidateSize the map was measured while the dialog was still
    // 0x0, and only the top-left tile ever paints.
    map.invalidateSize();
    if (anchors.length === 1) {
      map.setView(anchors[0], 15);
    } else if (anchors.length > 1) {
      map.fitBounds(L.latLngBounds(anchors), { padding: [40, 40], maxZoom: 16 });
    }
    // `key` collapses the array into a stable dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}

function ago(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}
