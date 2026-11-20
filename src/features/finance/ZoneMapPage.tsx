/**
 * Finance → Service Zones → Zone Map. Draw an area, get its postal codes.
 *
 * The drawing is only ever an input. What gets stored is the list of codes it
 * produced, and pricing reads nothing but those codes — which is why erasing a
 * shape leaves its codes alone and cannot change a price.
 *
 * Drawing yields FSAs (`M5V`), not six-character codes, because the boundary
 * file behind it is Statistics Canada's free FSA set. An FSA the shape only
 * clips is offered unticked with its coverage shown: narrowing it to the exact
 * addresses inside would need Canada Post's licensed point data, and taking the
 * whole thing would claim streets nobody drew.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, GeoJSON, TileLayer, useMap } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, Icon } from '@/ui';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { api, type ZoneGeoJson, type ZoneShapePreviewDto } from '@/lib/api';

const CANADA_CENTER: [number, number] = [49.5, -89];

/**
 * One hue per drawn area, so a row in the list and a shape on the map are
 * obviously the same thing. Not the driver palette: these are not drivers, and
 * borrowing those hues would suggest a connection that is not there.
 */
const AREA_COLORS = [
  '#2563EB',
  '#7C3AED',
  '#0891B2',
  '#D97706',
  '#16A34A',
  '#DC2626',
  '#DB2777',
  '#4B3FCF',
] as const;
const areaColour = (i: number) => AREA_COLORS[Math.abs(i) % AREA_COLORS.length];

function reason(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

/**
 * Opens a zone where its work already is, instead of in the middle of Canada.
 *
 * Framed per zone, never per shape: a polygon the operator has just drawn is
 * already under their cursor, and moving the camera onto it would yank the map
 * out from under the hand that drew it.
 */
function FitToShape({ geojson, zoneId }: { geojson: ZoneGeoJson | null; zoneId: string | null }) {
  const map = useMap();
  const framedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!zoneId || !geojson || framedFor.current === zoneId) return;
    const bounds = L.geoJSON(geojson as never).getBounds();
    // An empty or broken shape gives invalid bounds, and fitBounds throws on it.
    if (!bounds.isValid()) return;
    framedFor.current = zoneId;
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 });
  }, [map, geojson, zoneId]);

  return null;
}

/*
 * A zone is often not one blob: a city plus an outlying industrial park, the two
 * sides of a lake, a depot the far side of a motorway. Each polygon drawn in a
 * sitting is added to the ones before it rather than replacing them, and the
 * result travels as a MultiPolygon — which the preview, the save schema and
 * PostGIS all already accept, so nothing on the server had to change.
 */
function parts(g: ZoneGeoJson | null): unknown[] {
  if (!g) return [];
  return g.type === 'MultiPolygon' ? (g.coordinates as unknown[]) : [g.coordinates];
}

/** One piece stays a Polygon; two or more become a MultiPolygon. */
function merge(existing: ZoneGeoJson | null, next: ZoneGeoJson): ZoneGeoJson {
  const all = [...parts(existing), ...parts(next)];
  return all.length === 1
    ? { type: 'Polygon', coordinates: all[0] as unknown[] }
    : { type: 'MultiPolygon', coordinates: all };
}

/**
 * Geoman's polygon tool, and nothing else. Edit and drag modes stay off: a shape
 * is redrawn rather than nudged, so there is never a half-edited polygon whose
 * codes were never recalculated. Drawing again adds a piece; Discard starts the
 * whole drawing over.
 */
function DrawLayer({ onDraw }: { onDraw: (g: ZoneGeoJson) => void }) {
  const map = useMap() as LeafletMap & { pm: any };

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

    const handle = (e: { layer: { toGeoJSON: () => any; remove: () => void } }) => {
      const geometry = e.layer.toGeoJSON()?.geometry;
      // The stored shape is the single source of truth; this scratch layer goes.
      e.layer.remove();
      if (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon') onDraw(geometry);
    };

    map.on('pm:create', handle as never);
    return () => {
      map.off('pm:create', handle as never);
      map.pm.removeControls();
    };
  }, [map, onDraw]);

  return null;
}

export function ZoneMapPage() {
  const { bookId = '' } = useParams();
  const navigate = useNavigate();
  const { flash } = useToast();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<ZoneGeoJson | null>(null);
  /*
   * Whether the operator has changed the shape in this sitting.
   *
   * Without it, `drawn === null` means two different things — "nothing has been
   * touched" and "every area was just deleted" — and the second fell through to
   * the stored shape, so areas reappeared the moment the last one was removed.
   */
  const [edited, setEdited] = useState(false);
  const [preview, setPreview] = useState<ZoneShapePreviewDto | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const drawnRef = useRef<ZoneGeoJson | null>(null);
  /** The live map, so a row in the area list can fly the camera to its shape. */
  const mapRef = useRef<LeafletMap | null>(null);
  /** The zone whose stored shape has already been previewed once. */
  const previewedFor = useRef<string | null>(null);

  const list = useQuery({
    queryKey: ['zoneList', bookId],
    queryFn: () => api.getZoneList(bookId, { includeInactive: true }),
  });

  const zones = list.data?.zones ?? [];
  const selected = zones.find((z) => z.id === selectedId) ?? null;

  const detail = useQuery({
    queryKey: ['zone', bookId, selectedId],
    queryFn: () => api.getZone(bookId, selectedId as string),
    enabled: Boolean(selectedId),
  });

  /**
   * Throw away this sitting's changes and show what is stored again.
   *
   * `reload` asks for the stored shape's codes right here rather than leaving it
   * to the once-per-zone effect: that effect only wakes when the zone or the
   * shape's timestamp changes, and discarding changes neither, so the areas came
   * back with every one of them reporting no postcodes.
   *
   * Pass false where the stored shape is about to change anyway — after a save
   * or a delete — so the effect previews the new one instead of the stale one.
   */
  const resetEdits = (reload = true) => {
    setDrawn(null);
    drawnRef.current = null;
    setEdited(false);
    setPreview(null);
    setTicked(new Set());

    const saved = detail.data?.shape?.geojson ?? null;
    if (reload && saved && selectedId) {
      previewedFor.current = selectedId;
      look.mutate(saved);
    } else {
      previewedFor.current = null;
    }
  };

  const look = useMutation({
    mutationFn: (g: ZoneGeoJson) => api.previewZoneShape(bookId, selectedId as string, g),
    onSuccess: (res) => {
      setPreview(res);
      // Whole FSAs start ticked; clipped ones are the operator's decision.
      setTicked(new Set(res.inside.map((f) => f.code)));
    },
    onError: (e) => {
      /*
       * Keep the drawing: losing an operator's work because one request failed
       * is worse than showing it with no codes. The ticks go, so Save is
       * disabled until a preview succeeds and the codes are real again.
       */
      setPreview(null);
      setTicked(new Set());
      flash(reason(e));
    },
  });

  const save = useMutation({
    mutationFn: () =>
      api.saveZoneShape(bookId, selectedId as string, drawn as ZoneGeoJson, [...ticked]),
    onSuccess: (res) => {
      // The shape is about to come back welded, so let the effect preview that.
      resetEdits(false);
      flash(`${res.codes.length} codes on ${selected?.name ?? 'this zone'}`);
      void qc.invalidateQueries({ queryKey: ['zoneList', bookId] });
      void detail.refetch();
    },
    onError: (e) => flash(reason(e)),
  });

  const clear = useMutation({
    mutationFn: () => api.deleteZoneShape(bookId, selectedId as string),
    onSuccess: () => {
      resetEdits(false);
      flash('Drawing removed — its codes were kept');
      void detail.refetch();
    },
    onError: (e) => flash(reason(e)),
  });

  /*
   * The shape being worked on. Once anything has been edited, `drawn` is the
   * whole truth — including when it is null, which now means "all areas were
   * removed" rather than "show me what is stored".
   */
  const working = edited ? drawn : (detail.data?.shape?.geojson ?? null);

  /*
   * The only place the working shape changes, so the drawing, the area list and
   * the postcode preview can never end up describing three different shapes.
   */
  const apply = (g: ZoneGeoJson | null) => {
    drawnRef.current = g;
    setDrawn(g);
    setEdited(true);
    if (g) look.mutate(g);
    else {
      setPreview(null);
      setTicked(new Set());
    }
  };

  const onDraw = (g: ZoneGeoJson) => {
    if (!selectedId) {
      flash('Pick a zone first, then draw');
      return;
    }
    // A new polygon joins the areas already on this zone, saved or not.
    apply(merge(edited ? drawnRef.current : (detail.data?.shape?.geojson ?? null), g));
  };

  /** Drop one area. What is left is re-checked at once, not at save time. */
  const dropArea = (index: number) => {
    const rest = parts(working).filter((_, i) => i !== index);
    if (rest.length === 0) {
      apply(null);
      return;
    }
    apply(
      rest.length === 1
        ? { type: 'Polygon', coordinates: rest[0] as unknown[] }
        : { type: 'MultiPolygon', coordinates: rest },
    );
  };

  /** Put the camera on one area without disturbing anything being drawn. */
  const flyToArea = (coordinates: unknown) => {
    const bounds = L.geoJSON({ type: 'Polygon', coordinates } as never).getBounds();
    if (bounds.isValid()) mapRef.current?.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });
  };

  /*
   * A zone that already has a shape is previewed as soon as it is opened, so its
   * areas arrive with their postcodes underneath instead of as empty headings.
   * One query per zone opened, which is what the list costs to be useful at all.
   */
  useEffect(() => {
    const saved = detail.data?.shape?.geojson ?? null;
    if (!selectedId || !saved || edited || previewedFor.current === selectedId) return;
    previewedFor.current = selectedId;
    look.mutate(saved);
    // Once per zone, when its stored shape is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, detail.data?.shape?.updatedAt]);

  /*
   * The codes grouped under the area that caught them. Every area gets a row
   * even when it caught nothing — an empty heading is information, and silently
   * dropping it would leave a shape on the map with no row to delete it by.
   */
  const areas = useMemo(() => {
    const groups = new Map<number, Array<{ code: string; coveragePct: number; whole: boolean }>>();
    const count = parts(working).length;
    for (let i = 1; i <= count; i++) groups.set(i, []);
    const put = (f: { code: string; coveragePct: number; part: number }, whole: boolean) =>
      (groups.get(f.part) ?? groups.get(1))?.push({ ...f, whole });
    for (const f of preview?.inside ?? []) put(f, true);
    for (const f of preview?.partial ?? []) put(f, false);
    return [...groups.entries()].map(([part, codes]) => ({ part, codes }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, drawn, detail.data?.shape?.updatedAt]);

  const toggle = (code: string, on: boolean) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(code);
      else next.delete(code);
      return next;
    });

  const conflicting = new Set((preview?.conflicts ?? []).map((c) => c.code));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={() => navigate(`/finance/service-zones/${bookId}`)}
          className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          ← {list.data?.name ?? 'Zone list'}
        </button>
      </div>

      <div className="flex items-baseline gap-3 px-4 pt-2 pb-3">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
          Zone Map
        </h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          pick a zone, then draw with the polygon tool (top-left)
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 lg:flex-row">
        <div className="w-full shrink-0 lg:w-[320px]">
          <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
            <div className="border-b bg-muted px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Zone list
            </div>
            <div className="max-h-[260px] overflow-auto">
              {zones.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No zones to map.
                </p>
              ) : (
                zones.map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(z.id);
                      // The new zone previews itself through the effect.
                      resetEdits(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 border-b px-3 py-2.5 text-left last:border-b-0',
                      z.id === selectedId ? 'bg-accent text-primary' : 'hover:bg-muted',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{z.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {z.codeCount}
                    </span>
                  </button>
                ))
              )}
            </div>

            {selected && (
              <div className="border-t p-3">
                <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {selected.name}
                </p>

                {working ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <p className="text-[11px] text-muted-foreground">
                      {areas.length} area{areas.length === 1 ? '' : 's'}
                      {preview
                        ? ` · ${preview.inside.length} whole, ${preview.partial.length} clipped`
                        : look.isPending
                          ? ' · checking…'
                          : ''}
                    </p>

                    <div className="max-h-[300px] overflow-auto rounded-md border bg-muted/40">
                      {areas.map((a, i) => (
                        <div key={a.part} className="border-b p-2 last:border-b-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 shrink-0 rounded-sm"
                              style={{ backgroundColor: areaColour(i) }}
                            />
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                              Area {a.part}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {a.codes.length}
                            </span>
                            <button
                              type="button"
                              aria-label={`Zoom to area ${a.part}`}
                              onClick={() => flyToArea(parts(working)[i])}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Icon name="search" size={12} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove area ${a.part}`}
                              onClick={() => dropArea(i)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Icon name="x" size={12} />
                            </button>
                          </div>

                          <div className="mt-1 pl-5">
                            {a.codes.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground">
                                {look.isPending ? 'Checking…' : 'No postcodes under this area.'}
                              </p>
                            ) : (
                              a.codes.map((f) => (
                                <Checkbox
                                  key={f.code}
                                  label={f.whole ? f.code : `${f.code} · ${f.coveragePct}% covered`}
                                  checked={ticked.has(f.code)}
                                  disabled={conflicting.has(f.code)}
                                  onChange={(e) => toggle(f.code, e.target.checked)}
                                />
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {preview && preview.conflicts.length > 0 && (
                      <p className="text-[11px] text-amber-600">
                        Already in another zone and not available:{' '}
                        {preview.conflicts.map((c) => `${c.code} (${c.zoneName})`).join(', ')}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={save.isPending || ticked.size === 0}
                        onClick={() => save.mutate()}
                      >
                        Save {ticked.size} codes
                      </Button>
                      {edited && (
                        <Button variant="utility" size="sm" onClick={() => resetEdits()}>
                          Discard changes
                        </Button>
                      )}
                      {detail.data?.shape && (
                        /* Deletes the stored drawing. Its codes stay, because
                           pricing reads codes and never the picture. */
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={clear.isPending}
                          onClick={() => clear.mutate()}
                        >
                          Forget drawing
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    <p className="text-[11px] text-muted-foreground">
                      {edited && detail.data?.shape
                        ? 'Every area removed. Forget drawing deletes the stored shape; Discard changes puts it back.'
                        : 'Nothing drawn yet. Draw an area on the map.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {edited && (
                        <Button variant="utility" size="sm" onClick={() => resetEdits()}>
                          Discard changes
                        </Button>
                      )}
                      {detail.data?.shape && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={clear.isPending}
                          onClick={() => clear.mutate()}
                        >
                          Forget drawing
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="h-[calc(100vh-220px)] min-h-[420px] overflow-hidden rounded-xl border bg-card">
            <MapContainer
              ref={mapRef}
              center={CANADA_CENTER}
              zoom={4}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {/* One layer per area in its own colour, so a row in the list and a
                  shape on the map are plainly the same thing. The piece count is
                  in the key: without it a second polygon changed the data but not
                  the key, and the map quietly stopped repainting. */}
              {parts(working).map((coordinates, i) => (
                <GeoJSON
                  key={`${selectedId}-${detail.data?.shape?.updatedAt ?? 'draft'}-${
                    drawn ? 'd' : 's'
                  }${parts(working).length}-${i}`}
                  data={{ type: 'Polygon', coordinates } as never}
                  style={{ color: areaColour(i), weight: 2, fillOpacity: 0.18 }}
                />
              ))}
              <FitToShape geojson={detail.data?.shape?.geojson ?? null} zoneId={selectedId} />
              <DrawLayer onDraw={onDraw} />
            </MapContainer>
          </div>
        </div>
      </div>

      {!selected && (
        <p className="px-4 pb-4 text-[11px] text-muted-foreground">
          <Icon name="navigation" size={12} /> Pick a zone on the left before drawing.
        </p>
      )}
    </div>
  );
}
