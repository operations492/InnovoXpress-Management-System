import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Icon, Input, Select } from '@/ui';
import { SUBURBS } from '@/fixtures/suburbs';
import { assignedZoneBySuburb, filterSuburbs, paginate, type Zone } from '@/domain/serviceZone';
import { Pager } from './Pager';

const PAGE_SIZE = 9;
const GRID = 'grid grid-cols-[76px_1fr_72px_110px_1fr] items-center gap-3';

interface Props {
  zone: Zone; // selected zone
  bookZones: Zone[]; // all zones in the book (for Assigned To)
  onToggle: (suburbId: string) => void;
}

/** p2 "Suburbs" tab — master locality list; tick suburbs into the selected zone. */
export function SuburbsTab({ zone, bookZones, onToggle }: Props) {
  const [q, setQ] = useState('');
  const [province, setProvince] = useState('');
  const [postcode, setPostcode] = useState('');
  const [inZone, setInZone] = useState(''); // '' | 'yes' | 'no'
  const [page, setPage] = useState(1);

  const assigned = useMemo(() => assignedZoneBySuburb(bookZones, zone.bookId), [bookZones, zone.bookId]);
  const inSet = useMemo(() => new Set(zone.suburbIds), [zone.suburbIds]);
  const provinces = useMemo(() => Array.from(new Set(SUBURBS.map((s) => s.province))).sort(), []);

  const filtered = useMemo(() => {
    let rows = filterSuburbs(SUBURBS, { q, province, postcode });
    if (inZone === 'yes') rows = rows.filter((s) => inSet.has(s.id));
    else if (inZone === 'no') rows = rows.filter((s) => !inSet.has(s.id));
    return rows;
  }, [q, province, postcode, inZone, inSet]);

  const view = paginate(filtered, page, PAGE_SIZE);

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {zone.suburbIds.length} suburbs in {zone.name}
        </span>
      </div>

      <div className="mx-4 overflow-hidden rounded-lg border">
        <div
          className={cn(
            GRID,
            'border-b bg-muted px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground',
          )}
        >
          <span>In Zone</span>
          <span>Suburb</span>
          <span>Province</span>
          <span>Postcode</span>
          <span>Assigned To</span>
        </div>

        {/* filter row */}
        <div className={cn(GRID, 'border-b px-3 py-2')}>
          <Select
            value={inZone}
            options={[
              { value: '', label: 'All' },
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            onChange={(e) => reset(() => setInZone(e.target.value))}
          />
          <Input value={q} onChange={(e) => reset(() => setQ(e.target.value))} placeholder="Filter…" />
          <Select
            value={province}
            options={[{ value: '', label: 'All' }, ...provinces.map((p) => ({ value: p, label: p }))]}
            onChange={(e) => reset(() => setProvince(e.target.value))}
          />
          <Input value={postcode} onChange={(e) => reset(() => setPostcode(e.target.value))} placeholder="Filter…" />
          <span />
        </div>

        {view.rows.map((s) => {
          const owned = assigned[s.id];
          const isIn = inSet.has(s.id);
          const elsewhere = Boolean(owned && owned.zoneId !== zone.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onToggle(s.id)}
              className={cn(GRID, 'w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted')}
            >
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-[12px] font-medium',
                  isIn ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'grid size-4 place-items-center rounded border',
                    isIn ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                  )}
                >
                  {isIn && <Icon name="check" size={11} />}
                </span>
                {isIn ? 'Yes' : 'No'}
              </span>
              <span className="truncate text-[13px] text-foreground">{s.name}</span>
              <span className="text-[13px] text-muted-foreground">{s.province}</span>
              <span className="font-mono text-[12.5px] text-muted-foreground">{s.postcode}</span>
              <span
                className={cn('truncate text-[12.5px]', elsewhere ? 'text-[color:var(--status-warning)]' : 'text-muted-foreground')}
              >
                {owned ? owned.zoneName : '—'}
              </span>
            </button>
          );
        })}
        {view.total === 0 && (
          <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">No suburbs match.</div>
        )}
      </div>

      <Pager page={view.page} pageCount={view.pageCount} total={view.total} onPage={setPage} />
    </div>
  );
}
