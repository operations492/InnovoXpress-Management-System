/**
 * Delivery-date presets for the two places that sweep up billable jobs:
 * creating an invoice, and adding jobs to one that already exists.
 *
 * Shared because the two screens ask the same question of the same endpoint,
 * and a window that means one thing on one screen and something else on the
 * other is how a job quietly fails to be billed.
 */

export const RANGES = [
  // First, because "bill what we delivered yesterday" is the daily job.
  { value: 'last24', label: 'Last 24 Hours' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'last90', label: 'Last 90 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  /*
   * So nothing can hide behind a window.
   *
   * A job delivered outside whatever range happens to be selected looks
   * identical to one that does not exist, and the difference is revenue. This
   * is the escape hatch that proves the list is empty for a real reason.
   */
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom Range' },
] as const;

export type RangeKey = (typeof RANGES)[number]['value'];

/** `YYYY-MM-DD`, local-ish — the form every preset but `last24` sends. */
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function rangeFor(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  const back = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d;
  };

  switch (key) {
    /*
     * A real rolling 24 hours, not "today and yesterday".
     *
     * The others are whole days and send `YYYY-MM-DD`; this one sends a full
     * ISO timestamp, which the API coerces the same way. The closing end stays
     * a date — the server rounds it to end of day, and nothing is delivered in
     * the future, so there is nothing to exclude.
     */
    case 'last24': {
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return { from: since.toISOString(), to: iso(now) };
    }
    case 'last7':
      return { from: iso(back(7)), to: iso(now) };
    case 'last30':
      return { from: iso(back(30)), to: iso(now) };
    case 'last90':
      return { from: iso(back(90)), to: iso(now) };
    case 'thisMonth':
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
    case 'lastMonth':
      return {
        from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    /*
     * Not literally all time: a fixed floor well before this system existed.
     * The API wants two dates, and an open-ended one would mean teaching the
     * endpoint a nullable bound for no practical gain.
     */
    case 'all':
      return { from: '2000-01-01', to: iso(now) };
    default:
      return { from: iso(back(30)), to: iso(now) };
  }
}
