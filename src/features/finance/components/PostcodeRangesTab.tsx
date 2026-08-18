import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Icon, Input } from '@/ui';
import { genId } from '@/domain/id';
import { paginate, type PostcodeRange, type Zone } from '@/domain/serviceZone';
import { Pager } from './Pager';

const PAGE_SIZE = 8;
const GRID = 'grid grid-cols-[1fr_1fr_36px_36px] items-center gap-3';

interface Props {
  zone: Zone;
  onUpdate: (ranges: PostcodeRange[]) => void;
}

/** p2 "Postcode Ranges" tab — From/To range rules with add/edit/delete + pager. */
export function PostcodeRangesTab({ zone, onUpdate }: Props) {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PostcodeRange | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const view = paginate(zone.postcodeRanges, page, PAGE_SIZE);

  const openNew = () => {
    setEditing(null);
    setFrom('');
    setTo('');
    setShowForm(true);
  };
  const openEdit = (r: PostcodeRange) => {
    setEditing(r);
    setFrom(r.from);
    setTo(r.to);
    setShowForm(true);
  };
  const save = () => {
    const f = from.trim().toUpperCase();
    const t = to.trim().toUpperCase();
    if (!f || !t) return;
    if (editing) {
      onUpdate(zone.postcodeRanges.map((r) => (r.id === editing.id ? { ...r, from: f, to: t } : r)));
    } else {
      onUpdate([...zone.postcodeRanges, { id: genId(), from: f, to: t }]);
    }
    setShowForm(false);
  };
  const remove = (id: string) => onUpdate(zone.postcodeRanges.filter((r) => r.id !== id));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {zone.postcodeRanges.length} ranges
        </span>
        <Button variant="primary" size="sm" leadingIcon={<Icon name="plus" size={15} />} onClick={openNew}>
          New Rule
        </Button>
      </div>

      {showForm && (
        <div className="mx-4 mb-3 rounded-lg border bg-muted p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {editing ? 'Edit range' : 'New range'}
          </div>
          <div className="flex items-end gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Postcode from</span>
              <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="M1A" />
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Postcode to</span>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="M9Z" />
            </label>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={!from.trim() || !to.trim()} onClick={save}>
              {editing ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      )}

      <div className="mx-4 overflow-hidden rounded-lg border">
        <div
          className={cn(
            GRID,
            'border-b bg-muted px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground',
          )}
        >
          <span>Postcode from</span>
          <span>Postcode to</span>
          <span />
          <span />
        </div>
        {view.rows.map((r) => (
          <div key={r.id} className={cn(GRID, 'border-b px-3 py-2 last:border-b-0 hover:bg-muted')}>
            <span className="font-mono text-[13px] text-foreground">{r.from}</span>
            <span className="font-mono text-[13px] text-foreground">{r.to}</span>
            <button
              type="button"
              aria-label="Edit range"
              onClick={() => openEdit(r)}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <Icon name="pencil" size={14} />
            </button>
            <button
              type="button"
              aria-label="Delete range"
              onClick={() => remove(r.id)}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
        {zone.postcodeRanges.length === 0 && (
          <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">No records to view</div>
        )}
      </div>

      <Pager page={view.page} pageCount={view.pageCount} total={view.total} onPage={setPage} />
    </div>
  );
}
