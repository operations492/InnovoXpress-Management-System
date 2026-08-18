/**
 * The map beside the assign list.
 *
 * Centred on the pickup, with every assignable driver plotted around it. Selection
 * is two-way and shared with the list: the same `selectedId` that drives the radio
 * buttons rings the marker here, and clicking a marker selects the row. That is
 * only possible because both views render the same array from one request.
 *
 * It draws no trails and fetches nothing of its own — the parent already has the
 * data, and a second request would let the two panes disagree.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button, Icon } from '@/ui';
import type { NearestDriverDto, NearestDriversResponse } from '@/lib/api';
import { driverDotIcon, placeIcon } from '@/components/map/markers';

interface DriverProximityMapProps {
  pickup: NearestDriversResponse['meta']['pickup'];
  drivers: NearestDriverDto[];
  selectedId: string | null;
  onSelect: (driverId: string) => void;
  /** Rank badge per driver id, so the marker matches the list position. */
  rankOf: Map<string, number>;
  /**
   * The selected driver's road route to the pickup, when there is one. Drawn rather
   * than a straight line on purpose — it IS the path behind the drive time in the
   * list, so a crow-flies line would contradict the number beside it.
   */
  route: [number, number][] | null;
}

export function DriverProximityMap({
  pickup,
  drivers,
  selectedId,
  onSelect,
  rankOf,
  route,
}: DriverProximityMapProps) {
  const centre: [number, number] = [pickup.lat, pickup.lng];

  // Only drivers we actually have a position for can be drawn. The rest are still
  // in the list, labelled — they are assignable, just not locatable.
  const plotted = useMemo(
    () => drivers.filter((d) => d.lat !== null && d.lng !== null),
    [drivers],
  );

  const fitRef = useRef<(() => void) | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  /*
   * Do not initialise Leaflet until the container has a real measured size.
   *
   * This is the root fix for two bugs that looked unrelated. A Leaflet map derives
   * its pixel origin from `getSize()` at init, and every marker's position is then
   * computed against that origin. Initialise into a container that has not been
   * laid out yet — which is what happens here, because this map mounts in the same
   * commit that the dialog grows from 420px to 960px — and you get:
   *
   *   - tiles requested for a narrower viewport, so half the map stays white; and
   *   - markers placed against a stale origin, so they sit off-screen.
   *
   * The second is the nastier one, because correcting the size afterwards does NOT
   * fix it: `setView` to an unchanged centre and zoom takes Leaflet's animated-pan
   * fast path, pans by (0,0), returns early and never fires `viewreset` — the event
   * layers listen to in order to reposition. The markers only jumped into place
   * when something changed their icon, since `setIcon` repositions as a side effect.
   *
   * Measuring first makes all of that moot. `clientWidth` deliberately, not
   * `getBoundingClientRect`: the dialog animates in with a transform, and only
   * `clientWidth` reports layout size unaffected by it.
   */
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    const check = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) setMeasured(true);
    };

    const observer = new ResizeObserver(check);
    observer.observe(el);
    check();

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={shellRef}
      className="relative h-full min-h-[300px] w-full overflow-hidden rounded-xl border border-border"
    >
      {measured && (
      <MapContainer
        center={centre}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <PickupCamera
          centre={centre}
          plotted={plotted.map((d) => [d.lat as number, d.lng as number])}
          registerFit={(fn) => {
            fitRef.current = fn;
          }}
        />

        {/* Under the markers: the line is context, the pins are the subject.
            Drawn as a casing plus a stroke so it stays readable over dark tiles and
            over other roads — a single thin line disappears on a busy map. */}
        {route && route.length > 1 && (
          <>
            <Polyline
              positions={route}
              pathOptions={{ color: '#ffffff', weight: 7, opacity: 0.85 }}
              interactive={false}
            />
            <Polyline
              positions={route}
              pathOptions={{ color: '#16A34A', weight: 4, opacity: 0.95 }}
              interactive={false}
            />
          </>
        )}

        {/* The pickup is the fixed thing on this screen, so it keeps the teardrop
            pin the rest of the app uses for a place. Drivers are circles — the
            two must never be confusable at a glance. */}
        <Marker position={centre} icon={placeIcon('#45455C', 'P')} zIndexOffset={500}>
          <Tooltip direction="top" offset={[0, -22]}>
            <span className="text-[11px]">
              Pickup — {pickup.line1}, {pickup.city}
            </span>
          </Tooltip>
        </Marker>

        {plotted.map((d) => (
          <Marker
            key={d.driverId}
            position={[d.lat as number, d.lng as number]}
            icon={driverDotIcon({
              name: d.name,
              rank: rankOf.get(d.driverId) ?? null,
              selected: selectedId === d.driverId,
              muted: !d.ranked,
            })}
            // Keep the selected driver on top of any overlapping marker, so the
            // ring is never hidden behind a colleague parked next door.
            zIndexOffset={selectedId === d.driverId ? 400 : 0}
            eventHandlers={{ click: () => onSelect(d.driverId) }}
          >
            <Tooltip direction="top" offset={[0, -16]}>
              <span className="text-[11px]">{d.name}</span>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
      )}

      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
        <span className="pointer-events-auto rounded-md bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
          {plotted.length} of {drivers.length} located
        </span>
        <Button
          variant="utility"
          size="sm"
          className="pointer-events-auto"
          onClick={() => fitRef.current?.()}
        >
          <Icon name="pin" size={13} />
          Fit all
        </Button>
      </div>
    </div>
  );
}

const DEFAULT_ZOOM = 12;

/**
 * Camera.
 *
 * Opens centred on the pickup rather than fitted to everyone, because the pickup
 * is the question being asked — a fit-to-bounds on one driver stranded across the
 * city would zoom the whole map out to uselessness. "Fit all" is the escape hatch,
 * which beats trying to guess the right framing.
 *
 * It never re-frames on a poll: the operator's pan and zoom are theirs, and having
 * the view jump every fifteen seconds while they are reading it is worse than any
 * framing improvement.
 *
 * The framing of the FIRST paint is not done here at all — see the measurement gate
 * in the parent, which is what guarantees Leaflet is born with a correct size.
 */
function PickupCamera({
  centre,
  plotted,
  registerFit,
}: {
  centre: [number, number];
  plotted: [number, number][];
  registerFit: (fn: () => void) => void;
}) {
  const map = useMap();
  const framed = useRef(false);

  // `plotted` is a fresh array each render; collapse it to a value that only
  // changes when the positions actually do.
  const key = plotted.map((p) => p.join(',')).join('|');

  useEffect(() => {
    registerFit(() => {
      map.invalidateSize();
      if (plotted.length === 0) {
        map.setView(centre, 13);
        return;
      }
      map.fitBounds(L.latLngBounds([centre, ...plotted]), { padding: [40, 40], maxZoom: 15 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, centre[0], centre[1], registerFit]);

  /*
   * Later resizes only — the opening view is already correct, because the parent
   * does not create the map until its container has been measured, and
   * `MapContainer`'s own `center`/`zoom` props frame that first paint.
   *
   * `viewreset` after `invalidateSize` is the load-bearing part. `invalidateSize`
   * compensates for a size change by shifting the map pane, which keeps the centre
   * looking right but leaves every marker positioned against the PREVIOUS pixel
   * origin. `viewreset` is the event layers subscribe to in order to recompute
   * their positions; without it markers drift off and only snap back if something
   * else happens to change their icon.
   */
  useEffect(() => {
    const container = map.getContainer();
    let debounce: number | undefined;

    const observer = new ResizeObserver(() => {
      window.clearTimeout(debounce);
      // A CSS transition fires this every frame, so debounce — but keep it short,
      // or the operator sits looking at a half-painted map.
      debounce = window.setTimeout(() => {
        map.invalidateSize();
        map.fire('viewreset');
      }, 80);
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      window.clearTimeout(debounce);
    };
  }, [map]);

  // A different pickup is a different question, so re-frame — but never on the
  // first run, which `MapContainer` has already handled.
  useEffect(() => {
    if (!framed.current) {
      framed.current = true;
      return;
    }
    map.setView(centre, DEFAULT_ZOOM, { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, centre[0], centre[1]]);

  return null;
}
