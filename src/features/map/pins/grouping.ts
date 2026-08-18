import type { MapPinDto } from '@/lib/api';

/**
 * Orders sharing a coordinate.
 *
 * The real problem at this scale is not pin count, it is stacking: twelve orders
 * to one shopping mall share a lat/lng exactly, so eleven of them are invisible
 * underneath the twelfth and a dispatcher has no way to know. Grouping makes the
 * pile visible as a count badge.
 *
 * 5 decimal places is about a metre — close enough that two pins would overlap
 * anyway, and it tolerates the tiny differences a geocoder introduces.
 */
export interface PinGroup {
  /** The coordinate key; stable, so it is safe as a React key. */
  key: string;
  lat: number;
  lng: number;
  /** The pin the widget opens on. */
  lead: MapPinDto;
  /** Every order at this coordinate, lead included, in the incoming order. */
  pins: MapPinDto[];
}

const PRECISION = 5;

export function groupByCoord(pins: MapPinDto[]): PinGroup[] {
  const groups = new Map<string, PinGroup>();

  for (const pin of pins) {
    if (pin.lat === null || pin.lng === null) continue;

    const key = `${pin.lat.toFixed(PRECISION)},${pin.lng.toFixed(PRECISION)}`;
    const existing = groups.get(key);

    if (existing) {
      existing.pins.push(pin);
    } else {
      groups.set(key, { key, lat: pin.lat, lng: pin.lng, lead: pin, pins: [pin] });
    }
  }

  return [...groups.values()];
}

/** The group containing a given task, so the widget can offer its neighbours. */
export function groupOf(groups: PinGroup[], taskId: string): PinGroup | null {
  return groups.find((g) => g.pins.some((p) => p.id === taskId)) ?? null;
}
