/**
 * What the search form means, with no React in sight.
 *
 * Turning a form into API parameters is the part of search that is easy to get
 * quietly wrong — a filter that is dropped on the way out looks identical to a
 * filter that found nothing. So the rules live here and are unit-tested, the way
 * the dispatch map's view rules do in `features/map/state/mapView.ts`.
 */
import type { Task } from '@/domain/types';

export const ALL = 'All';
export const UNASSIGNED = '__unassigned__';

export interface SearchForm {
  orderNo: string;
  type: string;
  externalId: string;
  driverId: string;
  keyword: string;
  clientId: string;
  status: string;
  deliverBy: string;
}

export const EMPTY_SEARCH: SearchForm = {
  orderNo: '',
  type: ALL,
  externalId: '',
  driverId: ALL,
  keyword: '',
  clientId: ALL,
  status: ALL,
  deliverBy: '',
};

/**
 * The API takes ONE free-text term, and it already matches order number, client
 * reference, sender and receiver name, city and province. So the most specific
 * box that is filled becomes `q`; anything else the operator typed narrows the
 * returned page in `refine`. Any one box on its own is therefore a true
 * whole-table search — only the rarer combination of two narrows within a page.
 */
export function termOf(f: SearchForm): string {
  return f.orderNo.trim() || f.externalId.trim() || f.keyword.trim();
}

export function paramsOf(f: SearchForm): Record<string, string | number | undefined> {
  const p: Record<string, string | number | undefined> = {};
  const q = termOf(f);
  if (q) p.q = q;
  if (f.status !== ALL) p.status = f.status;
  if (f.type !== ALL) p.taskType = f.type;
  if (f.clientId !== ALL) p.clientId = f.clientId;
  // "Unassigned" is not a driver id — it is the absence of one, and the API has
  // its own flag for it.
  if (f.driverId === UNASSIGNED) p.unassigned = 'true';
  else if (f.driverId !== ALL) p.driverId = f.driverId;
  if (f.deliverBy) p.deliverBy = f.deliverBy;
  return p;
}

/** Applies whichever text boxes the server term did not already cover. */
export function refine(rows: Task[], f: SearchForm): Task[] {
  const used = termOf(f);
  const checks: Array<[string, (t: Task) => string]> = [
    [f.orderNo, (t) => t.orderNo],
    [f.externalId, (t) => t.externalId],
    [
      f.keyword,
      (t) =>
        [t.orderNo, t.externalId, t.recipient, t.requester, t.dest, t.destCity, t.description, t.driver, t.merchant]
          .filter(Boolean)
          .join(' '),
    ],
  ];

  return rows.filter((t) =>
    checks.every(([raw, read]) => {
      const v = raw.trim().toLowerCase();
      if (!v || raw.trim() === used) return true;
      return read(t).toLowerCase().includes(v);
    }),
  );
}
