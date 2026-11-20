import { describe, it, expect } from 'vitest';
import {
  TASK_STATUSES,
  STATUS_META,
  canTransition,
  changeStatusOptions,
  isEditable,
  isTaskStatus,
  isTaskTab,
  isTerminal,
} from '../status';

describe('status metadata', () => {
  it('has an entry for every status', () => {
    // The guard against the crash that used to take the whole Tasks route down:
    // SearchPanel builds its option list from these at module scope.
    for (const s of TASK_STATUSES) {
      expect(STATUS_META[s]).toBeDefined();
      expect(STATUS_META[s].label).toBeTruthy();
      expect(STATUS_META[s].colorVar).toMatch(/^var\(--/);
    }
  });

  it('recognises its own values and rejects the old ones', () => {
    expect(isTaskStatus('AT_PICKUP')).toBe(true);
    expect(isTaskStatus('processed')).toBe(false);
    expect(isTaskStatus('cancelled')).toBe(false);
  });
});

describe('transitions', () => {
  it('walks the happy path with the right gate', () => {
    expect(canTransition('UNASSIGNED', 'ASSIGNED', 'ASSIGNMENT')).toBe(true);
    expect(canTransition('ASSIGNED', 'EN_ROUTE_TO_PICKUP', 'MANUAL')).toBe(true);
    expect(canTransition('EN_ROUTE_TO_PICKUP', 'AT_PICKUP', 'MANUAL')).toBe(true);
    expect(canTransition('AT_PICKUP', 'PICKED_UP', 'POD')).toBe(true);
    expect(canTransition('PICKED_UP', 'EN_ROUTE_TO_DELIVERY', 'MANUAL')).toBe(true);
    expect(canTransition('EN_ROUTE_TO_DELIVERY', 'AT_DELIVERY', 'MANUAL')).toBe(true);
    expect(canTransition('AT_DELIVERY', 'DELIVERED', 'POD')).toBe(true);
  });

  it('refuses the right edge through the wrong gate', () => {
    expect(canTransition('AT_PICKUP', 'PICKED_UP', 'MANUAL')).toBe(false);
    expect(canTransition('AT_DELIVERY', 'DELIVERED', 'MANUAL')).toBe(false);
  });

  it('treats DELIVERED as terminal', () => {
    expect(isTerminal('DELIVERED')).toBe(true);
    expect(isTerminal('AT_DELIVERY')).toBe(false);
  });
});

describe('changeStatusOptions', () => {
  it('never offers a status that needs proof of delivery', () => {
    for (const s of TASK_STATUSES) {
      const opts = changeStatusOptions(s);
      expect(opts).not.toContain('PICKED_UP');
      expect(opts).not.toContain('DELIVERED');
    }
  });

  it('never offers a status that belongs to driver assignment', () => {
    for (const s of TASK_STATUSES) {
      const opts = changeStatusOptions(s);
      expect(opts).not.toContain('ASSIGNED');
      expect(opts).not.toContain('UNASSIGNED');
    }
  });

  it('offers the next travelling step from an assigned order', () => {
    expect(changeStatusOptions('ASSIGNED')).toEqual(['EN_ROUTE_TO_PICKUP']);
    expect(changeStatusOptions('PICKED_UP')).toEqual(['EN_ROUTE_TO_DELIVERY']);
  });

  it('offers nothing where the next step needs proof, or where the job is done', () => {
    expect(changeStatusOptions('AT_PICKUP')).toEqual([]);
    expect(changeStatusOptions('AT_DELIVERY')).toEqual([]);
    expect(changeStatusOptions('DELIVERED')).toEqual([]);
    expect(changeStatusOptions('UNASSIGNED')).toEqual([]);
  });
});

describe('tabs', () => {
  it('has one list and Search - the old status tabs are gone', () => {
    expect(isTaskTab('all')).toBe(true);
    expect(isTaskTab('search')).toBe(true);
    expect(isTaskTab('active')).toBe(false);
    expect(isTaskTab('delivered')).toBe(false);
    expect(isTaskTab('new')).toBe(false);
  });
});

describe('editability', () => {
  it('allows edits only before the goods move', () => {
    expect(isEditable('UNASSIGNED')).toBe(true);
    expect(isEditable('ASSIGNED')).toBe(true);
    expect(isEditable('EN_ROUTE_TO_PICKUP')).toBe(false);
    expect(isEditable('DELIVERED')).toBe(false);
  });
});
