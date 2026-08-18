import { describe, expect, it } from 'vitest';
import {
  assignedZoneBySuburb,
  filterSuburbs,
  paginate,
  parseZonesCsv,
  type Suburb,
  type Zone,
} from '@/domain/serviceZone';

function zone(partial: Partial<Zone> & { id: string; bookId: string; name: string; suburbIds: string[] }): Zone {
  return {
    aka: '',
    shortName: '',
    color: '#000000',
    locationName: '',
    address1: '',
    address2: '',
    suburb: '',
    phone: '',
    email: '',
    timeZone: '',
    silentZone: false,
    postcodeRanges: [],
    polygon: null,
    createdBy: '',
    createdAt: '',
    ...partial,
  };
}

const SUBS: Suburb[] = [
  { id: '1', name: 'Toronto', province: 'ON', postcode: 'M4C 3C4' },
  { id: '2', name: 'Vancouver', province: 'BC', postcode: 'V6B 2W9' },
  { id: '3', name: 'Ottawa', province: 'ON', postcode: 'K1A 0B1' },
];

describe('assignedZoneBySuburb', () => {
  it('maps a suburb to the first owning zone within the book', () => {
    const zones = [
      zone({ id: 'a', bookId: 'b1', name: 'A', suburbIds: ['s1', 's2'] }),
      zone({ id: 'c', bookId: 'b1', name: 'C', suburbIds: ['s2', 's3'] }),
      zone({ id: 'd', bookId: 'b2', name: 'D', suburbIds: ['s1'] }),
    ];
    const map = assignedZoneBySuburb(zones, 'b1');
    expect(map['s1']).toEqual({ zoneId: 'a', zoneName: 'A' });
    expect(map['s2'].zoneName).toBe('A'); // first zone wins on conflict
    expect(map['s3'].zoneName).toBe('C');
  });
});

describe('filterSuburbs', () => {
  it('filters by name, province and postcode (case-insensitive)', () => {
    expect(filterSuburbs(SUBS, { q: 'tor' }).map((s) => s.id)).toEqual(['1']);
    expect(filterSuburbs(SUBS, { province: 'ON' }).map((s) => s.id)).toEqual(['1', '3']);
    expect(filterSuburbs(SUBS, { postcode: 'v6b' }).map((s) => s.id)).toEqual(['2']);
  });
  it('honors onlyIds', () => {
    expect(filterSuburbs(SUBS, { onlyIds: ['3'] }).map((s) => s.id)).toEqual(['3']);
  });
});

describe('paginate', () => {
  it('slices, clamps out-of-range pages, reports counts', () => {
    const rows = Array.from({ length: 25 }, (_, i) => i);
    const p = paginate(rows, 3, 10);
    expect(p.rows).toEqual([20, 21, 22, 23, 24]);
    expect(p.pageCount).toBe(3);
    expect(p.total).toBe(25);
    expect(paginate(rows, 99, 10).page).toBe(3);
  });
});

describe('parseZonesCsv', () => {
  it('parses rows with the header ignored', () => {
    const csv = 'Zone,Suburb,State,Postcode\nToronto,Toronto,ON,M4C 3C4\nVancouver,Vancouver,BC,V6B 2W9';
    const rows = parseZonesCsv(csv, {
      ignoreFirstRow: true,
      mapping: { zoneName: 0, suburb: 1, province: 2, postcode: 3 },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ zoneName: 'Toronto', suburb: 'Toronto', province: 'ON', postcode: 'M4C 3C4' });
  });
  it('drops rows with no zone name', () => {
    const rows = parseZonesCsv(',Suburb,ON,K1A\nOttawa,Ottawa,ON,K1A', {
      ignoreFirstRow: false,
      mapping: { zoneName: 0, suburb: 1, province: 2, postcode: 3 },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].zoneName).toBe('Ottawa');
  });
});
