import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button, Icon, Input, Modal } from '@/ui';
import { useToast } from '@/components/Toast';
import { nowLabel } from '@/domain/format';
import type { ZoneBookInput } from '@/domain/serviceZone';
import { useServiceZonesStore } from '@/store/ServiceZonesProvider';
import { ZoneBookDetailPanel } from './components/ZoneBookDetailPanel';

const GRID = 'grid grid-cols-[1fr_150px_40px] items-center gap-3';

/** Screen 1 (p1) — Zone Book Directory: master list of zone books + edit panel. */
export function ServiceZonesPage() {
  const store = useServiceZonesStore();
  const navigate = useNavigate();
  const { flash } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(store.books[0]?.id ?? null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const selected = store.books.find((b) => b.id === selectedId) ?? null;

  const createBook = () => {
    const name = newName.trim();
    if (!name) return;
    const book = store.addBook({ name, description: '', createdBy: 'You', createdAt: nowLabel() });
    setSelectedId(book.id);
    setNewName('');
    setShowNew(false);
    flash('Zone book created');
  };
  const submit = (patch: Partial<ZoneBookInput>) => {
    if (!selectedId) return;
    store.updateBook(selectedId, patch);
    flash('Zone book updated');
  };
  const removeBook = (id: string) => {
    store.removeBook(id);
    if (id === selectedId) setSelectedId(null);
    flash('Zone book deleted');
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">Service Zones</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Location zone books used across assignment, rating and routing.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {store.books.length} zone books
        </span>
        <div className="flex-1" />
        <Button variant="primary" size="sm" leadingIcon={<Icon name="plus" size={15} />} onClick={() => setShowNew(true)}>
          New Zone Book
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div
              className={cn(
                GRID,
                'border-b bg-muted px-4 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground',
              )}
            >
              <span>Zone Book Name</span>
              <span>Description</span>
              <span />
            </div>
            {store.books.map((b) => {
              const isSel = b.id === selectedId;
              return (
                <div
                  key={b.id}
                  className={cn(
                    'relative border-b border-l-2 last:border-b-0',
                    isSel ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-muted',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    className="absolute inset-0 z-0"
                    aria-label={`Select ${b.name}`}
                  />
                  <div className={cn(GRID, 'pointer-events-none relative z-10 px-4 py-3')}>
                    <span className="truncate text-[13.5px] font-medium text-foreground">{b.name}</span>
                    <span className="truncate text-[13px] text-muted-foreground">{b.description || '—'}</span>
                    <button
                      type="button"
                      aria-label={`Delete ${b.name}`}
                      onClick={() => removeBook(b.id)}
                      className="pointer-events-auto grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
            {store.books.length === 0 && (
              <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">No zone books yet.</div>
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 lg:w-[384px]">
          <div className="overflow-hidden rounded-xl border bg-card lg:sticky lg:top-4 lg:h-[calc(100vh-180px)]">
            <ZoneBookDetailPanel
              key={selectedId ?? 'empty'}
              book={selected}
              mode={selected ? 'edit' : 'empty'}
              onSubmit={submit}
              onDelete={() => selected && removeBook(selected.id)}
              onEditZones={() => selected && navigate(`/finance/service-zones/${selected.id}`)}
            />
          </div>
        </aside>
      </div>

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        width={420}
        title="New Zone Book"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={!newName.trim()} onClick={createBook}>
              Create
            </Button>
          </div>
        }
      >
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Zone Book Name</span>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Apple Express"
            onKeyDown={(e) => {
              if (e.key === 'Enter') createBook();
            }}
          />
        </label>
      </Modal>
    </div>
  );
}
