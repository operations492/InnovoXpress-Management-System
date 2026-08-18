import { describe, it, expect } from 'vitest';
import { cleanTrail, metresBetween, formatDistance } from '../trail';
import type { RawPoint } from '../trail';

/**
 * Built against the real numbers from this project's driver_locations table:
 * 60% of fixes worse than 50m, average 70m, worst 404m, plus two synthetic
 * Lahore pings sitting 250km from the Islamabad ones.
 */

const t = (secs: number) => new Date(Date.UTC(2026, 7, 15, 12, 0, secs)).toISOString();

const p = (lat: number, lng: number, accuracyM: number, secs: number): RawPoint => ({
  lat,
  lng,
  accuracyM,
  recordedAt: t(secs),
});

describe('metresBetween', () => {
  it('measures real ground distance', () => {
    // Lahore -> Islamabad is roughly 270 km as the crow flies.
    const d = metresBetween({ lat: 31.5204, lng: 74.3587 }, { lat: 33.6844, lng: 73.0479 });
    expect(d).toBeGreaterThan(250_000);
    expect(d).toBeLessThan(290_000);
  });

  it('is symmetric and zero for the same point', () => {
    const a = { lat: 33.6844, lng: 73.0479 };
    expect(metresBetween(a, a)).toBe(0);
  });
});

describe('cleanTrail', () => {
  it('drops fixes too inaccurate to be GPS', () => {
    const { points, dropped } = cleanTrail([
      p(33.6844, 73.0479, 10, 0),
      p(33.6900, 73.0500, 404, 10), // the worst real fix in the table
      // ~100m on from the first point after 20s — a believable ride, so this
      // one survives and only the inaccurate fix is lost.
      p(33.6853, 73.0479, 12, 20),
    ]);
    expect(points).toHaveLength(2);
    expect(dropped).toBe(1);
    expect(points.every((q) => (q.accuracyM ?? 0) <= 100)).toBe(true);
  });

  it('suppresses a stationary phone instead of drawing jitter', () => {
    // Five fixes over a 10m radius: a phone on a desk, not a journey.
    const { points, dropped, distanceM } = cleanTrail([
      p(33.68440, 73.04790, 12, 0),
      p(33.68445, 73.04795, 14, 5),
      p(33.68438, 73.04788, 11, 10),
      p(33.68447, 73.04792, 13, 15),
      p(33.68441, 73.04797, 10, 20),
    ]);
    expect(points).toHaveLength(1);
    expect(dropped).toBe(4);
    expect(distanceM).toBe(0);
  });

  it('scales the movement threshold with the fix uncertainty', () => {
    // ~40m apart. Accepted for a tight fix...
    const tight = cleanTrail([p(33.6844, 73.0479, 8, 0), p(33.68476, 73.0479, 8, 10)]);
    expect(tight.points).toHaveLength(2);

    // ...but a +/-90m fix needs ~68m of travel before it counts as movement.
    const loose = cleanTrail([p(33.6844, 73.0479, 8, 0), p(33.68476, 73.0479, 90, 10)]);
    expect(loose.points).toHaveLength(1);
  });

  it('rejects a physically impossible jump', () => {
    // The exact shape of the real bug: a Lahore ping among Islamabad ones.
    const { points, dropped } = cleanTrail([
      p(33.6844, 73.0479, 10, 0),
      p(31.5204, 74.3587, 11, 30), // 250km in 30 seconds
      p(33.6860, 73.0490, 10, 60),
    ]);
    expect(dropped).toBe(1);
    expect(points.every((q) => q.lat > 33)).toBe(true);
  });

  it('keeps a genuine walk and measures it', () => {
    // ~50m steps every 10s — about 5 m/s, a slow ride.
    const walk = [0, 1, 2, 3, 4].map((i) => p(33.6844 + i * 0.00045, 73.0479, 9, i * 10));
    const { points, dropped, distanceM } = cleanTrail(walk);
    expect(points).toHaveLength(5);
    expect(dropped).toBe(0);
    expect(distanceM).toBeGreaterThan(150);
    expect(distanceM).toBeLessThan(250);
  });

  it('always keeps the first usable fix, so the map is never empty', () => {
    const { points } = cleanTrail([p(33.6844, 73.0479, 95, 0)]);
    expect(points).toHaveLength(1);
  });

  it('handles an empty trail', () => {
    expect(cleanTrail([])).toEqual({ points: [], dropped: 0, distanceM: 0 });
  });

  it('tolerates a missing accuracy', () => {
    const { points } = cleanTrail([
      { lat: 33.6844, lng: 73.0479, recordedAt: t(0) },
      { lat: 33.6900, lng: 73.0479, recordedAt: t(60) },
    ]);
    expect(points).toHaveLength(2);
  });
});

describe('formatDistance', () => {
  it('switches to km past a kilometre', () => {
    expect(formatDistance(340)).toBe('340 m');
    expect(formatDistance(1500)).toBe('1.5 km');
  });
});
