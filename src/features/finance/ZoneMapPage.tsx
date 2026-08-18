import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, Polygon, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { cn } from '@/lib/utils';
import { Button, Icon } from '@/ui';
import { useToast } from '@/components/Toast';
import { zonesForBook } from '@/domain/serviceZone';
import { useServiceZonesStore } from '@/store/ServiceZonesProvider';
import { ColorSwatchPicker } from './components/ColorSwatchPicker';

const CANADA_CENTER: [number, number] = [49.5, -89];

function centroid(poly: [number, number][]): [number, number] {
  const n = poly.length || 1;
  const sum = poly.reduce(([ay, ax], [y, x]) => [ay + y, ax + x], [0, 0]);
  return [sum[0] / n, sum[1] / n];
}

/** Enables geoman's polygon draw tool; writes the drawn ring back to the selected zone. */
function DrawLayer({
  selectedRef,
  onDraw,
}: {
  selectedRef: { current: string | null };
  onDraw: (id: string, ring: [number, number][]) => void;
}) {
  const map = useMap();
  useEffect(() => {
    map.pm.addControls({
      position: 'topleft',
      drawPolygon: true,
      drawMarker: false,
      drawCircle: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawText: false,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      rotateMode: false,
      removalMode: false,
    });
    const handle = (e: L.LeafletEvent) => {
      const layer = (e as unknown as { layer: L.Polygon }).layer;
      const latlngs = layer.getLatLngs()[0] as L.LatLng[];
      const ring = latlngs.map((ll) => [ll.lat, ll.lng] as [number, number]);
      layer.remove(); // single source of truth is zone.polygon (rendered by <Polygon>)
      if (selectedRef.current) onDraw(selectedRef.current, ring);
    };
    map.on('pm:create', handle);
    return () => {
      map.off('pm:create', handle);
      map.pm.removeControls();
    };
  }, [map, selectedRef, onDraw]);
  return null;
}

function Recenter({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView(target, 8);
  }, [map, target]);
  return null;
}

/** Screen 3 (p3) — draw colored zone polygons on an OpenStreetMap. */
export function ZoneMapPage() {
  const { bookId = '' } = useParams();
  const store = useServiceZonesStore();
  const navigate = useNavigate();
  const { flash } = useToast();

  const book = store.books.find((b) => b.id === bookId) ?? null;
  const zones = zonesForBook(store.zones, bookId);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(zones[0]?.id ?? null);
  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;

  const selRef = useRef<string | null>(selectedZoneId);
  useEffect(() => {
    selRef.current = selectedZoneId;
  }, [selectedZoneId]);

  const onDraw = (id: string, ring: [number, number][]) => {
    store.updateZone(id, { polygon: ring });
    flash('Zone area saved');
  };
  const clearPolygon = () => {
    if (!selectedZone) return;
    store.updateZone(selectedZone.id, { polygon: null });
    flash('Zone area cleared');
  };

  if (!book) {
    return (
      <div className="p-6">
        <p className="text-[13px] text-muted-foreground">Zone book not found.</p>
      </div>
    );
  }

  const recenterTarget = selectedZone?.polygon ? centroid(selectedZone.polygon) : null;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(`/finance/service-zones/${bookId}`)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Icon name="chevronLeft" size={14} /> {book.name}
        </button>
      </div>
      <div>
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">Zone Map</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Draw zone areas on the map — pick a zone, then use the polygon tool (top-left).
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* left — zone list + color */}
        <div className="lg:w-[300px] lg:shrink-0">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b bg-muted px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Zone List
            </div>
            <div className="max-h-[280px] overflow-auto">
              {zones.map((z) => {
                const isSel = z.id === selectedZoneId;
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => setSelectedZoneId(z.id)}
                    className={cn(
                      'flex w-full items-center gap-2 border-b border-l-2 px-4 py-2.5 text-left last:border-b-0',
                      isSel ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-muted',
                    )}
                  >
                    <span className="size-4 shrink-0 rounded" style={{ backgroundColor: z.color }} />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">{z.name}</span>
                    {z.polygon && <Icon name="check" size={14} className="text-primary" />}
                  </button>
                );
              })}
              {zones.length === 0 && (
                <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">No zones to map.</div>
              )}
            </div>
            {selectedZone && (
              <div className="space-y-3 border-t p-4">
                <div>
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    Color — {selectedZone.name}
                  </div>
                  <ColorSwatchPicker
                    value={selectedZone.color}
                    onChange={(hex) => store.updateZone(selectedZone.id, { color: hex })}
                  />
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  leadingIcon={<Icon name="trash" size={15} />}
                  disabled={!selectedZone.polygon}
                  onClick={clearPolygon}
                >
                  Clear polygon
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* right — map */}
        <div className="min-w-0 flex-1">
          <div className="h-[calc(100vh-220px)] overflow-hidden rounded-xl border bg-card">
            <MapContainer
              center={recenterTarget ?? CANADA_CENTER}
              zoom={recenterTarget ? 8 : 4}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {zones.map(
                (z) =>
                  z.polygon && (
                    <Polygon
                      key={z.id}
                      positions={z.polygon}
                      pathOptions={{
                        color: z.color,
                        fillColor: z.color,
                        fillOpacity: z.id === selectedZoneId ? 0.35 : 0.18,
                        weight: z.id === selectedZoneId ? 3 : 2,
                      }}
                    />
                  ),
              )}
              <DrawLayer selectedRef={selRef} onDraw={onDraw} />
              <Recenter target={recenterTarget} />
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
