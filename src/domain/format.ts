/**
 * Display formatting — centralized so currency/number conventions live in ONE place.
 * The design language carries a currency symbol on money and uses tabular numerals
 * in tables. The prototype uses `$`; Innovo Xpress is Canadian, so flip CURRENCY to
 * `CAD $` once confirmed — every figure updates from here.
 */

export const CURRENCY = '$';

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/** Money with the currency symbol, two decimals. e.g. money(20) → "$20.00". */
export function money(n: number): string {
  return `${CURRENCY}${safe(n).toFixed(2)}`;
}

/** Weight in kilograms. e.g. weightKg(0.5) → "0.50 KG". */
export function weightKg(n: number): string {
  return `${safe(n).toFixed(2)} KG`;
}

/** Integer-ish display of a quantity. */
export function qty(n: number): string {
  return String(safe(n));
}

/**
 * Defensive display for possibly-dirty data: blank / null / undefined → "—",
 * and the literal source-data error sentinel "#ERROR!" → "—" as well.
 * A bad field must never crash a row.
 */
export function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const s = String(v).trim();
  if (s === '' || s === '#ERROR!') return '—';
  return s;
}

/** Parse a possibly currency-prefixed string to a number ("$1.50" → 1.5). */
export function parseMoney(v: string): number {
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Parse a possibly unit-suffixed weight string to a number ("0.50 KG" → 0.5). */
export function parseWeight(v: string): number {
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short display timestamp matching the prototype, e.g. "Jun 26 11:16 AM". */
export function nowLabel(d: Date = new Date()): string {
  const mon = MONTHS[d.getMonth()];
  const day = d.getDate();
  const minutes = d.getMinutes();
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  const hour12 = d.getHours() % 12 || 12;
  const mm = minutes < 10 ? `0${minutes}` : String(minutes);
  return `${mon} ${day} ${hour12}:${mm} ${ampm}`;
}

/* ----------------------------------------------------- Date / time helpers */

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Date → ISO date string "YYYY-MM-DD" (local). */
export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" (or a longer datetime) → "Jun 16". */
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
}

/** A from/to ISO pair → "Jun 29 - Jul 2" / "Jun 16" / "All Days". */
export function dateRangeLabel(from: string | null, to: string | null): string {
  if (from && to) return from === to ? shortDate(from) : `${shortDate(from)} - ${shortDate(to)}`;
  if (to) return `Until ${shortDate(to)}`;
  if (from) return `From ${shortDate(from)}`;
  return 'All Days';
}

/** Minutes since midnight → "12:00 AM" / "1:30 PM". */
export function minutesToLabel(min: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(min)));
  let h = Math.floor(clamped / 60);
  const m = clamped % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Parse the time-of-day (minutes since midnight) from a "… HH:MM AM/PM" string. */
export function timeOfDayMinutes(full: string): number | null {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(full ?? '');
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]);
}
