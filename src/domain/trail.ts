/**
 * Trail cleaning.
 *
 * The database keeps every ping the phone sent, warts and all — that is the
 * right call for an audit trail. But drawing it raw produces a scribble: a
 * phone indoors falls back to Wi-Fi and cell-tower positioning, which lands
 * wherever the router or mast is and jumps between them.
 *
 * Measured on this project's own data: 60% of fixes were worse than 50m
 * accuracy, the average was 70m, and the worst was 404m.
 *
 * Framework-free, like the rest of src/domain.
 */

export const MAX_ACCURACY_M = 100;
export const MIN_MOVE_M = 20;
/** ~144 km/h — faster than this between two fixes means one of them is wrong. */
export const MAX_SPEED_MPS = 40;

export interface RawPoint {
  lat: number;
  lng: number;
  accuracyM?: number | null;
  recordedAt: string;
}

/** Haversine, in metres. */
export function metresBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface CleanedTrail {
  points: RawPoint[];
  /** How many the filter removed — shown so a sparse line is explainable. */
  dropped: number;
  /** Total ground covered by the cleaned line, in metres. */
  distanceM: number;
}

/**
 * Keep only fixes that represent real movement.
 *
 * The distance threshold scales with the fix's own uncertainty: a ±8m fix needs
 * 20m of travel to count, a ±100m fix needs 75m. A fixed threshold would either
 * let coarse noise through or discard genuine slow walking.
 */
export function cleanTrail(raw: RawPoint[]): CleanedTrail {
  const points: RawPoint[] = [];
  let distanceM = 0;
  let dropped = 0;

  for (const p of raw) {
    if (p.accuracyM != null && p.accuracyM > MAX_ACCURACY_M) {
      dropped += 1;
      continue;
    }

    const last = points[points.length - 1];
    if (!last) {
      points.push(p);
      continue;
    }

    const moved = metresBetween(last, p);
    const threshold = Math.max(MIN_MOVE_M, (p.accuracyM ?? 0) * 0.75);
    if (moved < threshold) {
      dropped += 1;
      continue;
    }

    const secs = (new Date(p.recordedAt).getTime() - new Date(last.recordedAt).getTime()) / 1000;
    if (secs > 0 && moved / secs > MAX_SPEED_MPS) {
      dropped += 1;
      continue;
    }

    points.push(p);
    distanceM += moved;
  }

  return { points, dropped, distanceM };
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
