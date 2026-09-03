/**
 * Address lookup for the consignment form — TomTom Search.
 *
 * This replaced Photon (OpenStreetMap) when the system moved to Canadian
 * addressing, for one decisive reason: **TomTom returns `countrySubdivisionCode`
 * as the two-letter province already** (`"ON"`, not `"Ontario"`), and its
 * Canadian postal coverage is far better than OSM's. Photon would have meant a
 * hand-written 13-entry name→code table plus a postal code that is frequently
 * just absent.
 *
 * It is not a clean win everywhere — see `fullPostcode` for the one place
 * TomTom's Canadian shape is genuinely awkward.
 *
 * Framework-free on purpose, like the rest of `src/lib`: debouncing and abort
 * live in the component that calls this.
 *
 * ⚠️ **The key ships in the bundle.** Vite inlines every `VITE_*`, which is how
 * every mapping provider expects browser keys to be used — but Search is a
 * *billable* product, unlike the traffic tiles. Domain-restrict this key in the
 * TomTom console before it goes anywhere real.
 */

const KEY = import.meta.env.VITE_TOMTOM_KEY ?? '';

const SEARCH = 'https://api.tomtom.com/search/2/search';
const REVERSE = 'https://api.tomtom.com/search/2/reverseGeocode';

/**
 * Canada only. Filtering rather than merely biasing is right here: every
 * consignment in this system is domestic, and without it "Hamilton" returns New
 * Zealand and "London" returns England.
 */
const COUNTRY_SET = 'CA';

/**
 * ⚠️ **`en-CA` is not a valid TomTom language tag** — it answers
 * `400 Error parsing 'language': Language tag 'en-CA' not supported`, and the
 * picker turns any failure into "Address search is unavailable", so the cause is
 * invisible from the UI. `countrySet=CA` is what scopes results to Canada; the
 * language tag only picks the language the names come back in.
 */
const LANGUAGE = 'en-US';

/** Below this, results are noise and we are just burning billable requests. */
export const MIN_QUERY = 3;

export type AddressSuggestion = {
  id: string;
  /** Bold first line in the dropdown. */
  label: string;
  /** Muted second line — the surrounding context. */
  sub: string;
  line1: string;
  /** Two-letter code, straight from the provider. No mapping table needed. */
  province: string;
  city: string;
  /** Canonical `A1A 1A1`, or empty when only an FSA was available. */
  postcode: string;
  lat: number;
  lng: number;
};

type TomTomAddress = {
  streetNumber?: string;
  streetName?: string;
  municipality?: string;
  municipalitySubdivision?: string;
  countrySubdivision?: string;
  countrySubdivisionCode?: string;
  /** In Canada this is the **FSA only** — three characters, e.g. "L4W". */
  postalCode?: string;
  /** The full six-character code, e.g. "L4W 0C2". Not always present. */
  extendedPostalCode?: string;
  freeformAddress?: string;
};

type TomTomResult = {
  id?: string;
  address?: TomTomAddress;
  /** Search returns an object. Reverse returns a `"lat,lon"` STRING — see below. */
  position?: { lat?: number; lon?: number } | string;
  poi?: { name?: string };
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * The two endpoints disagree about `position`, and this is the trap in the whole
 * file: `/search` gives `{lat, lon}` while `/reverseGeocode` gives the string
 * `"43.628,-79.626"`. Reading `.lat` off the string yields `undefined`, which
 * lands the pin at NaN and silently produces an order that cannot be routed.
 */
function coordsOf(position: TomTomResult['position']): { lat: number; lng: number } | null {
  if (typeof position === 'string') {
    const [lat, lng] = position.split(',').map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  const lat = position?.lat;
  const lng = position?.lon;
  return Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat: lat as number, lng: lng as number }
    : null;
}

/**
 * TomTom's `postalCode` is the **FSA alone** in Canada — "L4W", three
 * characters — and the complete code lives in `extendedPostalCode`, which is not
 * always returned. Verified live against 5985 Explorer Drive: one result carried
 * only `postalCode: "L4W"`, the next also carried `extendedPostalCode: "L4W 4T9"`.
 *
 * So filling the field from `postalCode` would write a three-character stub the
 * operator then has to notice and finish by hand. Leaving it empty is honest:
 * the field is optional, and blank reads as "we do not know" where "L4W" reads
 * as a complete answer.
 *
 * `extendedPostalCode` can be a comma-separated list where an address spans a
 * range, so only the first is taken.
 */
function fullPostcode(a: TomTomAddress): string {
  const extended = str(a.extendedPostalCode).split(',')[0]?.trim() ?? '';
  return extended.replace(/\s+/g, '').length === 6 ? extended : '';
}

function toSuggestion(r: TomTomResult, i: number): AddressSuggestion[] {
  const at = coordsOf(r.position);
  if (!at) return [];

  const a = r.address ?? {};
  const streetLine = [str(a.streetNumber), str(a.streetName)].filter(Boolean).join(' ');
  const poi = str(r.poi?.name);

  // A POI keeps its name in front of the street ("Eaton Centre, 220 Yonge St");
  // a plain address has no POI and is just the street line.
  const line1 = [poi, streetLine].filter(Boolean).join(', ') || streetLine || poi || str(a.freeformAddress);

  const city = str(a.municipality) || str(a.municipalitySubdivision);
  // `countrySubdivisionCode` is the documented field; `countrySubdivision` also
  // carries the code on current Canadian responses. Prefer the explicit one and
  // fall back, rather than assuming either is always present.
  const province = (str(a.countrySubdivisionCode) || str(a.countrySubdivision)).toUpperCase();
  const postcode = fullPostcode(a);

  return [
    {
      id: str(r.id) || `${i}`,
      label: line1 || city || 'Unnamed place',
      sub: [city, province, postcode].filter(Boolean).join(' · '),
      line1,
      province,
      city,
      postcode,
      lat: at.lat,
      lng: at.lng,
    },
  ];
}

export async function searchAddresses(
  query: string,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY) return [];
  if (!KEY) throw new Error('Address lookup is not configured (VITE_TOMTOM_KEY is missing)');

  const url =
    `${SEARCH}/${encodeURIComponent(q)}.json` +
    `?key=${KEY}&countrySet=${COUNTRY_SET}&limit=6&typeahead=true&language=${LANGUAGE}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Address lookup failed (${res.status})`);

  const body = (await res.json()) as { results?: TomTomResult[] };
  return (body.results ?? []).flatMap(toSuggestion);
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
  if (!KEY) return null;

  const res = await fetch(
    `${REVERSE}/${lat},${lng}.json?key=${KEY}&language=${LANGUAGE}`,
    { signal },
  );
  if (!res.ok) return null;

  const body = (await res.json()) as { addresses?: TomTomResult[] };
  const first = (body.addresses ?? [])[0];
  if (!first) return null;

  // Reverse omits `position` on some responses; the pin we asked about is the
  // answer, so fall back to it rather than dropping an otherwise good address.
  const withPosition: TomTomResult = { ...first, position: first.position ?? { lat, lon: lng } };
  return toSuggestion(withPosition, 0)[0] ?? null;
}

/** Fallback map centres, so an un-geocodable address still opens somewhere sane. */
export const CITY_CENTRES: Record<string, [number, number]> = {
  toronto: [43.6532, -79.3832],
  mississauga: [43.589, -79.6441],
  brampton: [43.7315, -79.7624],
  vaughan: [43.8361, -79.4983],
  hamilton: [43.2557, -79.8711],
  ottawa: [45.4215, -75.6972],
  montreal: [45.5019, -73.5674],
  vancouver: [49.2827, -123.1207],
  calgary: [51.0447, -114.0719],
  edmonton: [53.5461, -113.4938],
  winnipeg: [49.8951, -97.1384],
  halifax: [44.6488, -63.5752],
};

/**
 * Greater Toronto — last resort when even the city is unknown.
 *
 * Deliberately not the geographic centre of Canada, which is in northern
 * Manitoba: an operator who mistypes a city should land on the depot's own
 * metro, not on tundra.
 */
export const CA_CENTRE: [number, number] = [43.6532, -79.3832];

export function centreFor(city: string): [number, number] {
  return CITY_CENTRES[city.trim().toLowerCase()] ?? CA_CENTRE;
}
