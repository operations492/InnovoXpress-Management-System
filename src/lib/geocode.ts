/**
 * Address lookup for the consignment form.
 *
 * Uses Photon (photon.komoot.io) — the same OpenStreetMap data as Nominatim,
 * but purpose-built for type-ahead. Nominatim itself is not an option here:
 * its usage policy explicitly forbids autocomplete and caps callers at one
 * request per second.
 *
 * Free, no API key, no signup — so it is called straight from the browser and
 * needs no proxy endpoint.
 *
 * Framework-free on purpose, like the rest of src/lib: debouncing and abort
 * live in the component that calls this.
 */

const ENDPOINT = 'https://photon.komoot.io/api/';
const REVERSE_ENDPOINT = 'https://photon.komoot.io/reverse';

/**
 * Pakistan's bounding box (west, south, east, north).
 *
 * Without it "DHA" returns Dhaka and "Model Town" returns somewhere in the US.
 * Every consignment in this system is domestic, so filtering rather than merely
 * biasing is the right call.
 */
const PK_BBOX = '60.9,23.6,77.1,37.1';

/** Below this, results are noise and we are just burning requests. */
export const MIN_QUERY = 3;

export type AddressSuggestion = {
  id: string;
  /** Bold first line in the dropdown. */
  label: string;
  /** Muted second line — the surrounding context. */
  sub: string;
  line1: string;
  area: string;
  city: string;
  postcode: string;
  lat: number;
  lng: number;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export async function searchAddresses(
  query: string,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY) return [];

  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&limit=6&lang=en&bbox=${PK_BBOX}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Address lookup failed (${res.status})`);

  const body = (await res.json()) as { features?: PhotonFeature[] };
  return (body.features ?? []).flatMap(toSuggestion);
}

function toSuggestion(f: PhotonFeature, i: number): AddressSuggestion[] {
  const coords = f.geometry?.coordinates;
  if (!coords || coords.length < 2) return [];

  // ⚠️ GeoJSON order is [longitude, latitude] — NOT [lat, lng].
  // Swapping these puts every Pakistani address in the Indian Ocean, and it
  // looks plausible enough on a zoomed-out map to survive a glance.
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  const p = f.properties ?? {};
  const housenumber = str(p.housenumber);
  const street = str(p.street);
  const name = str(p.name);

  // Photon puts the venue in `name` and the road in `street`; a house has both,
  // a landmark usually only `name`.
  const streetLine = [housenumber, street].filter(Boolean).join(' ');
  const line1 = [name, streetLine].filter(Boolean).join(', ') || streetLine || name;

  const area = str(p.district) || str(p.suburb) || str(p.locality);
  const city = str(p.city) || str(p.county) || str(p.state);
  const postcode = str(p.postcode);

  return [
    {
      id: `${str(p.osm_type)}${String(p.osm_id ?? i)}-${i}`,
      label: line1 || city || 'Unnamed place',
      sub: [area, city, str(p.state)].filter(Boolean).join(' · '),
      line1,
      area,
      city,
      postcode,
      lat,
      lng,
    },
  ];
}

/**
 * Coordinates → address. Used when the operator drops a pin or hits
 * "use my current location", so the structured fields can be filled from the
 * map rather than typed twice.
 *
 * Returns null when nothing is nearby — an empty result is normal here, not an
 * error, and the pin is still valid on its own.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<AddressSuggestion | null> {
  const res = await fetch(
    `${REVERSE_ENDPOINT}?lat=${lat}&lon=${lng}&limit=1&lang=en`,
    { signal },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { features?: PhotonFeature[] };
  const first = (body.features ?? [])[0];
  return first ? (toSuggestion(first, 0)[0] ?? null) : null;
}

/** Fallback map centres, so an un-geocodable address still opens somewhere sane. */
export const CITY_CENTRES: Record<string, [number, number]> = {
  lahore: [31.5204, 74.3587],
  karachi: [24.8607, 67.0011],
  islamabad: [33.6844, 73.0479],
  rawalpindi: [33.5651, 73.0169],
  faisalabad: [31.4187, 73.0791],
  multan: [30.1575, 71.5249],
  peshawar: [34.0151, 71.5249],
  quetta: [30.1798, 66.975],
};

/** Centre of Pakistan — last resort when even the city is unknown. */
export const PK_CENTRE: [number, number] = [30.3753, 69.3451];

export function centreFor(city: string): [number, number] {
  return CITY_CENTRES[city.trim().toLowerCase()] ?? PK_CENTRE;
}
