import { describe, expect, it } from 'vitest';
import {
  assignDriver,
  buildItem,
  bulkUpdate,
  changeStatus,
  createTask,
  deleteMany,
  expandRequirements,
  requirementsLabel,
  updateTask,
} from '@/domain/mutations';
import { EMPTY_ITEM, EMPTY_TASK_FORM } from '@/domain/schemas';
import { makeTask } from '@/test/factory';

const META = { actor: 'Tester', time: 'Jun 1 9:00 AM' };

describe('assignDriver', () => {
  it('assigns, clears isNew, and promotes Unassigned → Assigned', () => {
    const tasks = [makeTask({ id: 'a', status: 'UNASSIGNED', isNew: true })];
    const [t] = assignDriver(tasks, ['a'], 'Bilal Ahmed', META);
    expect(t.driver).toBe('Bilal Ahmed');
    expect(t.driverAssigned).toBe(true);
    expect(t.isNew).toBe(false);
    expect(t.status).toBe('ASSIGNED');
    expect(t.history[0].text).toContain('Bilal Ahmed');
  });

  it('does not change a non-unassigned status', () => {
    const tasks = [
      makeTask({ id: 'a', status: 'EN_ROUTE_TO_DELIVERY', driverAssigned: true, driver: 'X' }),
    ];
    const [t] = assignDriver(tasks, ['a'], 'Y', META);
    expect(t.status).toBe('EN_ROUTE_TO_DELIVERY');
    expect(t.driver).toBe('Y');
  });
});

describe('changeStatus', () => {
  it('Unassigned clears the driver', () => {
    const tasks = [makeTask({ id: 'a', status: 'ASSIGNED', driver: 'X', driverAssigned: true })];
    const [t] = changeStatus(tasks, 'a', 'UNASSIGNED', META);
    expect(t.driver).toBe('');
    expect(t.driverAssigned).toBe(false);
    expect(t.isNew).toBe(false);
  });

  it('Assigned with no driver auto-assigns the default driver', () => {
    const tasks = [makeTask({ id: 'a', status: 'UNASSIGNED' })];
    const [t] = changeStatus(tasks, 'a', 'ASSIGNED', META);
    expect(t.driverAssigned).toBe(true);
    expect(t.driver).toBe('Muhammad Abdullah');
  });
});

describe('bulkUpdate', () => {
  it('applies only non-empty fields and clears isNew', () => {
    const tasks = [makeTask({ id: 'a', isNew: true, priority: 'Normal', merchant: 'Mini Mart' })];
    const [t] = bulkUpdate(tasks, ['a'], { priority: 'High' });
    expect(t.priority).toBe('High');
    expect(t.merchant).toBe('Mini Mart'); // untouched
    expect(t.isNew).toBe(false);
  });

  it('status Unassigned clears the driver', () => {
    const tasks = [makeTask({ id: 'a', driver: 'X', driverAssigned: true })];
    const [t] = bulkUpdate(tasks, ['a'], { status: 'UNASSIGNED' });
    expect(t.driverAssigned).toBe(false);
    expect(t.driver).toBe('');
  });
});

describe('createTask / updateTask / deleteMany', () => {
  it('createTask is always Unassigned + isNew', () => {
    const t = createTask({ ...EMPTY_TASK_FORM, recipient: 'A' }, [], { id: 'x', ...META });
    expect(t.status).toBe('UNASSIGNED');
    expect(t.isNew).toBe(true);
    expect(t.recipient).toBe('A');
  });

  it('updateTask clears isNew', () => {
    const tasks = [makeTask({ id: 'a', isNew: true })];
    const [t] = updateTask(tasks, 'a', { ...EMPTY_TASK_FORM, description: 'edited' }, []);
    expect(t.isNew).toBe(false);
    expect(t.description).toBe('edited');
  });

  it('deleteMany removes by id', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' })];
    expect(deleteMany(tasks, ['a']).map((t) => t.id)).toEqual(['b']);
  });
});

describe('items + requirements', () => {
  it('buildItem parses numbers and derives sku', () => {
    const it = buildItem({ ...EMPTY_ITEM, productId: '991', pkg: 'Box', qty: '3', lineTotal: '4.5', weight: '2' });
    expect(it.qty).toBe(3);
    expect(it.lineTotal).toBe(4.5);
    expect(it.weight).toBe(2);
    expect(it.sku).toBe('991 · Box');
  });

  it('expandRequirements / requirementsLabel round-trip', () => {
    expect(expandRequirements('None')).toEqual([]);
    expect(expandRequirements('All (5)').length).toBe(5);
    expect(requirementsLabel([])).toBe('None');
    expect(requirementsLabel(['Photo'])).toBe('Photo');
    expect(requirementsLabel(['Photo', 'Signature', 'Notes', 'Barcode', 'Cash On Delivery'])).toBe('All (5)');
  });
});
