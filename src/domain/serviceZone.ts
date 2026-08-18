/**
 * Service Zones domain — framework-free types + pure helpers.
 * A ZoneBook (container) has many Zones; each Zone carries postcode-range rules,
 * a set of assigned suburb ids, an optional map polygon, and a categorical color.
 * Mirrors the shape of `serviceLevel.ts` (interface + `Input = Omit<…,'id'>` + consts).
 */

export interface ZoneBook {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string; // display label
}
export type ZoneBookInput = Omit<ZoneBook, 'id'>;

/** A postcode-range rule (p2 "From / To"). Alphanumeric to support CA FSAs (e.g. M4A→M9Z). */
export interface PostcodeRange {
  id: string;
  from: string;
  to: string;
}

export interface Zone {
  id: string;
  bookId: string;
  // core (New Zone dialog)
  name: string;
  aka: string; // Other Names (AKA)
  shortName: string; // e.g. "TOR"
  color: string; // hex from ZONE_COLORS
  // advanced (zones.md "Advanced Zone List")
  locationName: string;
  address1: string;
  address2: string;
  suburb: string;
  phone: string;
  email: string;
  timeZone: string;
  silentZone: boolean; // hidden from mobile device selection
  // coverage
  postcodeRanges: PostcodeRange[];
  suburbIds: string[]; // ids into the SUBURBS master list
  polygon: [number, number][] | null; // [lat, lng] ring drawn on the Zone Map
  createdBy: string;
  createdAt: string;
}
export type ZoneInput = Omit<Zone, 'id'>;

/** Master locality (system reference data). Canada: province + FSA/postal code. */
export interface Suburb {
  id: string;
  name: string; // locality / suburb
  province: string; // ON, BC, QC…
  postcode: string;
}

export interface ZoneColor {
  name: string;
  hex: string;
}

/** Curated categorical palette (master.md §12 viz palette) — the sanctioned non-indigo hues. */
export const ZONE_COLORS: ZoneColor[] = [
  { name: 'Indigo', hex: '#4B3FCF' },
  { name: 'Violet', hex: '#7C3AED' },
  { name: 'Cyan', hex: '#0891B2' },
  { name: 'Amber', hex: '#D97706' },
  { name: 'Green', hex: '#16A34A' },
  { name: 'Red', hex: '#DC2626' },
  { name: 'Pink', hex: '#DB2777' },
  { name: 'Grey', hex: '#7A7A93' },
];

export const DEFAULT_ZONE_COLOR = ZONE_COLORS[0].hex;

/** Default color for the n-th zone in a book — cycles the palette so new zones differ. */
export function nextZoneColor(index: number): string {
  return ZONE_COLORS[index % ZONE_COLORS.length].hex;
}

/** Human name of a hex if it's a palette color, else the raw hex. */
export function colorName(hex: string): string {
  return ZONE_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;
}

// ── Derivations ─────────────────────────────────────────────────────────────

export function zonesForBook(zones: Zone[], bookId: string): Zone[] {
  return zones.filter((z) => z.bookId === bookId);
}

export function rangeCount(zone: Zone): number {
  return zone.postcodeRanges.length;
}

export function suburbCount(zone: Zone): number {
  return zone.suburbIds.length;
}

export interface Assignment {
  zoneId: string;
  zoneName: string;
}

/** Map suburbId → the zone (within a book) that owns it. First zone wins on conflict. */
export function assignedZoneBySuburb(zones: Zone[], bookId: string): Record<string, Assignment> {
  const map: Record<string, Assignment> = {};
  for (const z of zones) {
    if (z.bookId !== bookId) continue;
    for (const sid of z.suburbIds) {
      if (!map[sid]) map[sid] = { zoneId: z.id, zoneName: z.name };
    }
  }
  return map;
}

export interface SuburbFilter {
  q?: string;
  province?: string;
  postcode?: string;
  /** When set, keep only suburbs whose id is in this set ("In Zone" filter). */
  onlyIds?: string[] | null;
}

export function filterSuburbs(suburbs: Suburb[], f: SuburbFilter): Suburb[] {
  const q = (f.q ?? '').trim().toLowerCase();
  const prov = (f.province ?? '').trim().toLowerCase();
  const pc = (f.postcode ?? '').trim().toLowerCase();
  const onlySet = f.onlyIds ? new Set(f.onlyIds) : null;
  return suburbs.filter((s) => {
    if (q && !s.name.toLowerCase().includes(q)) return false;
    if (prov && !s.province.toLowerCase().includes(prov)) return false;
    if (pc && !s.postcode.toLowerCase().includes(pc)) return false;
    if (onlySet && !onlySet.has(s.id)) return false;
    return true;
  });
}

export interface Page<T> {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
}

export function paginate<T>(rows: T[], page: number, pageSize: number): Page<T> {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safe = Math.min(Math.max(1, page), pageCount);
  const start = (safe - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), page: safe, pageCount, total };
}

// ── CSV import ────────────────────────────────────────────────────────────────

export interface CsvColumnMapping {
  zoneName: number;
  suburb: number;
  province: number;
  postcode: number;
}

export interface CsvRow {
  zoneName: string;
  suburb: string;
  province: string;
  postcode: string;
}

/** Parse a 4-column zone CSV. Splits on commas; trims cells; drops blank / no-zone rows. */
export function parseZonesCsv(
  text: string,
  opts: { ignoreFirstRow: boolean; mapping: CsvColumnMapping },
): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const body = opts.ignoreFirstRow ? lines.slice(1) : lines;
  const { mapping: m } = opts;
  const rows: CsvRow[] = [];
  for (const line of body) {
    const cells = line.split(',').map((c) => c.trim());
    const zoneName = cells[m.zoneName] ?? '';
    if (!zoneName) continue;
    rows.push({
      zoneName,
      suburb: cells[m.suburb] ?? '',
      province: cells[m.province] ?? '',
      postcode: cells[m.postcode] ?? '',
    });
  }
  return rows;
}
