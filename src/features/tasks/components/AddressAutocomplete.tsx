/**
 * Address entry, as a summary field that opens a picker.
 *
 * The form shows a compact read-only card; everything — search, the map, the
 * pin, "use my location" — happens in a modal, so the two-column form stays
 * scannable instead of carrying two live maps inline.
 *
 * Edits are a DRAFT: nothing reaches the form until Save, so a half-finished
 * fiddle with the map cannot leave the consignment in a worse state than it
 * started.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button, Icon, Input, Modal } from '@/ui';
import { cn } from '@/lib/utils';
import { centreFor, MIN_QUERY, reverseGeocode, searchAddresses } from '@/lib/geocode';
import type { AddressSuggestion } from '@/lib/geocode';

const DEBOUNCE_MS = 300;

export interface AddressValue {
  line1: string;
  area: string;
  city: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
}

export interface AddressFieldProps {
  label: string;
  tone?: 'pickup' | 'drop';
  value: AddressValue;
  onSave: (v: AddressValue) => void;
}

/* ================================================================== */
/* The field shown in the form                                         */
/* ================================================================== */

export function AddressField({ label, tone = 'pickup', value, onSave }: AddressFieldProps) {
  const [open, setOpen] = useState(false);
  const pinned = value.lat !== null && value.lng !== null;
  const sub = [value.area, value.city, value.postcode].filter(Boolean).join(' · ');

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        <span aria-hidden className="ml-0.5 text-danger">
          *
        </span>
        <span className="sr-only"> (required)</span>
      </span>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent',
          pinned ? 'border-input' : 'border-danger/50',
        )}
      >
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-md',
            tone === 'drop' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon name="pin" size={15} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">
            {value.line1 || <span className="text-muted-foreground">Set address…</span>}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {pinned ? (
              <>
                {sub || 'Pinned'} · {value.lat!.toFixed(4)}, {value.lng!.toFixed(4)}
              </>
            ) : (
              <span className="text-danger">No map pin yet — required</span>
            )}
          </span>
        </span>

        <Icon name="pencil" size={14} />
      </button>

      <AddressPickerModal
        open={open}
        title={label}
        tone={tone}
        value={value}
        onClose={() => setOpen(false)}
        onSave={(v) => {
          onSave(v);
          setOpen(false);
        }}
      />
    </div>
  );
}

/* ================================================================== */
/* The picker                                                          */
/* ================================================================== */

function AddressPickerModal({
  open,
  title,
  tone,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  tone: 'pickup' | 'drop';
  value: AddressValue;
  onClose: () => void;
  onSave: (v: AddressValue) => void;
}) {
  const [draft, setDraft] = useState<AddressValue>(value);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  /**
   * Set whenever WE write the query — picking a suggestion, or resolving a
   * dropped pin. Without it those writes look identical to typing and kick off
   * a fresh search for the text we just settled on.
   */
  const selfWrite = useRef(false);
  const reverseAbort = useRef<AbortController | null>(null);

  // Reset the draft each time the modal opens, so Cancel truly discards.
  useEffect(() => {
    if (open) {
      setDraft(value);
      setQuery(value.line1);
      setResults([]);
      setNote(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced search, with the in-flight request aborted on each keystroke —
  // otherwise responses can land out of order and the list flickers.
  useEffect(() => {
    if (!open) return;

    // Do NOT compare against draft.line1 here: the input writes both on every
    // keystroke, so they are always equal and the search would never run.
    if (selfWrite.current) {
      selfWrite.current = false;
      setResults([]);
      return;
    }

    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const t = window.setTimeout(() => {
      setBusy(true);
      searchAddresses(q, controller.signal)
        .then(setResults)
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          setNote('Address search is unavailable — place the pin on the map instead');
        })
        .finally(() => setBusy(false));
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  const applySuggestion = (s: AddressSuggestion) => {
    selfWrite.current = true;
    setDraft({
      line1: s.line1,
      area: s.area || draft.area,
      city: s.city || draft.city,
      postcode: s.postcode || draft.postcode,
      lat: s.lat,
      lng: s.lng,
    });
    setQuery(s.line1);
    setResults([]);
    setNote(null);
  };

  /**
   * Move the pin AND resolve what is there.
   *
   * Clicking the map is the operator saying "it is here" — so the address above
   * should follow the pin, not stay stale. Reverse geocoding may return nothing
   * (common off-network in Pakistan), in which case the pin still stands on its
   * own and the typed text is left alone.
   */
  const movePin = useCallback((lat: number, lng: number) => {
    setDraft((d) => ({ ...d, lat, lng }));
    setNote(null);

    reverseAbort.current?.abort();
    const controller = new AbortController();
    reverseAbort.current = controller;
    setResolving(true);

    reverseGeocode(lat, lng, controller.signal)
      .then((found) => {
        if (!found) return;
        selfWrite.current = true;
        setDraft((d) => ({
          ...d,
          line1: found.line1 || d.line1,
          area: found.area || d.area,
          city: found.city || d.city,
          postcode: found.postcode || d.postcode,
          lat,
          lng,
        }));
        if (found.line1) setQuery(found.line1);
        setResults([]);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        // The pin is what matters; a failed lookup is not worth an error.
      })
      .finally(() => setResolving(false));
  }, []);

  // Drop an in-flight reverse lookup if the modal closes under it.
  useEffect(() => () => reverseAbort.current?.abort(), []);

  /** Drop the pin where the operator is, and fill the fields from it. */
  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setNote('This browser has no location support');
      return;
    }
    setLocating(true);
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Same path as dropping the pin by hand, so the address resolves too.
        movePin(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setNote(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — allow it for this site, or place the pin by hand'
            : 'Could not get your location — place the pin by hand',
        );
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const pinned = draft.lat !== null && draft.lng !== null;
  const centre: [number, number] = pinned
    ? [draft.lat as number, draft.lng as number]
    : centreFor(draft.city);

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={720}
      title={title}
      footer={
        <>
          <Button variant="utility" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!pinned || !draft.line1.trim()}
            onClick={() => onSave({ ...draft, line1: draft.line1.trim() || query.trim() })}
          >
            Save address
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {/* search */}
        <div className="relative" ref={listRef}>
          <Input
            icon={<Icon name="search" size={15} />}
            placeholder="Search an address, e.g. DHA Phase 5 Lahore"
            value={query}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value);
              setDraft((d) => ({ ...d, line1: e.target.value }));
            }}
          />
          {(busy || resolving) && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
              {resolving ? 'reading the map…' : 'searching…'}
            </span>
          )}
          {results.length > 0 && (
            <ul
              role="listbox"
              className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg"
            >
              {results.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applySuggestion(s)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-accent"
                  >
                    <span className="text-sm text-foreground">{s.label}</span>
                    {s.sub && <span className="text-xs text-muted-foreground">{s.sub}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* structured fields — auto-filled, still editable */}
        <div className="grid grid-cols-3 gap-2.5">
          <SmallField label="Area" value={draft.area} onChange={(area) => setDraft((d) => ({ ...d, area }))} />
          <SmallField label="City" value={draft.city} onChange={(city) => setDraft((d) => ({ ...d, city }))} />
          <SmallField
            label="Postcode"
            value={draft.postcode}
            onChange={(postcode) => setDraft((d) => ({ ...d, postcode }))}
          />
        </div>

        {/* map */}
        <div
          className={cn(
            'h-[300px] w-full overflow-hidden rounded-lg border',
            pinned ? 'border-border' : 'border-danger/40',
          )}
        >
          <MapContainer center={centre} zoom={pinned ? 16 : 11} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapSync centre={centre} pinned={pinned} open={open} />
            <ClickToPlace onPick={movePin} />
            {pinned && (
              <Marker
                position={centre}
                icon={pinIcon(tone)}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const p = (e.target as L.Marker).getLatLng();
                    movePin(p.lat, p.lng);
                  },
                }}
              />
            )}
          </MapContainer>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="utility" size="sm" onClick={useMyLocation} disabled={locating}>
            <span className="flex items-center gap-1.5">
              <Icon name="pin" size={14} />
              {locating ? 'Locating…' : 'Use my current location'}
            </span>
          </Button>

          <span className="font-mono text-[11px] text-muted-foreground">
            {pinned ? (
              `${(draft.lat as number).toFixed(5)}, ${(draft.lng as number).toFixed(5)}`
            ) : (
              <span className="text-danger">Tap the map to place the pin</span>
            )}
          </span>
        </div>

        {note && <p className="text-[11px] text-danger">{note}</p>}

        <p className="text-[11px] text-muted-foreground">
          Pick a suggestion, or drop the pin yourself — many Pakistani street addresses are not in
          OpenStreetMap, and a hand-placed pin is just as good.
        </p>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function SmallField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <Input value={value} placeholder={label} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/**
 * Leaflet's default marker icon resolves to an image path the bundler rewrites,
 * so it renders as a broken-image square. A divIcon sidesteps that and takes
 * the Iris palette.
 */
const pinIcon = (tone: 'pickup' | 'drop') =>
  L.divIcon({
    className: '',
    html: `<div style="
      width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      background:${tone === 'drop' ? '#4B3FCF' : '#45455C'};
      border:2px solid #fff;box-shadow:0 3px 8px rgba(26,26,46,.45);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });

/**
 * Two jobs: re-centre when the pin moves (MapContainer ignores `center` changes
 * after mount), and invalidateSize on open — a map mounted inside a dialog that
 * is still 0x0 paints one grey tile and nothing else.
 */
function MapSync({
  centre,
  pinned,
  open,
}: {
  centre: [number, number];
  pinned: boolean;
  open: boolean;
}) {
  const map = useMap();
  const key = useMemo(() => centre.join(','), [centre]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      map.invalidateSize();
      map.setView(centre, pinned ? 16 : 11);
    }, 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, open, pinned]);

  return null;
}

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}
