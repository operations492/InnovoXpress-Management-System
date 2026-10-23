import { describe, it, expect } from 'vitest';
import type { Task } from '@/domain/types';
import {
  ALL,
  EMPTY_SEARCH,
  UNASSIGNED,
  paramsOf,
  refine,
  termOf,
  type SearchForm,
} from '../state/searchQuery';

const form = (over: Partial<SearchForm> = {}): SearchForm => ({ ...EMPTY_SEARCH, ...over });

function task(over: Partial<Task> = {}): Task {
  return {
    orderNo: 'APX-20261007-0001',
    externalId: 'REF-9',
    recipient: 'Temi Abdul',
    requester: 'Syed Taha Ali',
    dest: '78 Nelson Street',
    destCity: 'Toronto',
    description: '',
    driver: 'Asif Raza',
    merchant: 'Apple Express',
    ...over,
  } as Task;
}

describe('paramsOf', () => {
  it('sends nothing for an untouched form', () => {
    expect(paramsOf(form())).toEqual({});
  });

  it('omits an All select rather than sending the literal string', () => {
    // Sending status=All would be a 400: the API enum has no such member.
    const p = paramsOf(form({ status: ALL, type: ALL, clientId: ALL, driverId: ALL }));
    expect(p.status).toBeUndefined();
    expect(p.taskType).toBeUndefined();
    expect(p.clientId).toBeUndefined();
    expect(p.driverId).toBeUndefined();
  });

  it('maps every structured filter to its API parameter', () => {
    const p = paramsOf(
      form({
        status: 'ASSIGNED',
        type: 'PICKUP_AND_DELIVERY',
        clientId: 'cl1',
        driverId: 'dr1',
        deliverBy: '2026-10-20',
      }),
    );
    expect(p).toEqual({
      status: 'ASSIGNED',
      taskType: 'PICKUP_AND_DELIVERY',
      clientId: 'cl1',
      deliverBy: '2026-10-20',
      driverId: 'dr1',
    });
  });

  it('turns Unassigned into the flag, never a driver id', () => {
    const p = paramsOf(form({ driverId: UNASSIGNED }));
    expect(p.unassigned).toBe('true');
    expect(p.driverId).toBeUndefined();
  });

  it('prefers the most specific text box as the single q term', () => {
    expect(paramsOf(form({ keyword: 'toronto' })).q).toBe('toronto');
    expect(paramsOf(form({ externalId: 'REF-9', keyword: 'toronto' })).q).toBe('REF-9');
    expect(paramsOf(form({ orderNo: 'APX-1', externalId: 'REF-9', keyword: 'x' })).q).toBe('APX-1');
  });

  it('ignores whitespace-only text', () => {
    expect(termOf(form({ keyword: '   ' }))).toBe('');
    expect(paramsOf(form({ keyword: '   ' })).q).toBeUndefined();
  });
});

describe('refine', () => {
  const rows = [task(), task({ orderNo: 'TCS-20261007-0002', recipient: 'Ivy Villena', externalId: 'REF-10' })];

  it('does not re-apply the box that was already sent as q', () => {
    // orderNo became q, so the server already filtered — refining again on the
    // same value would drop the other legitimate server matches.
    expect(refine(rows, form({ orderNo: 'APX-20261007-0001' }))).toHaveLength(2);
  });

  it('applies a second text box the server could not take', () => {
    // `orderNo` went out as q and is not re-applied, so only the keyword narrows
    // these rows — which is why a combined search still shows server matches.
    const hit = refine(rows, form({ orderNo: 'APX', keyword: 'Ivy' }));
    expect(hit).toHaveLength(1);
    expect(hit[0]!.recipient).toBe('Ivy Villena');

    expect(refine(rows, form({ orderNo: 'APX', keyword: 'nobody here' }))).toHaveLength(0);
  });

  it('matches keyword case-insensitively across the row', () => {
    expect(refine(rows, form({ externalId: 'REF', keyword: 'TORONTO' }))).toHaveLength(2);
    expect(refine(rows, form({ externalId: 'REF', keyword: 'apple express' }))).toHaveLength(2);
  });

  it('returns everything when no text box is filled', () => {
    expect(refine(rows, form({ status: 'ASSIGNED' }))).toHaveLength(2);
  });
});
