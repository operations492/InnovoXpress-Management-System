import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button, Icon, Input, Tabs, type TabItem } from '@/ui';
import { useToast } from '@/components/Toast';
import { rangeCount, suburbCount, zonesForBook, type PostcodeRange, type Zone } from '@/domain/serviceZone';
import { useServiceZonesStore } from '@/store/ServiceZonesProvider';
import { PostcodeRangesTab } from './components/PostcodeRangesTab';
import { SuburbsTab } from './components/SuburbsTab';
import { ZoneFormDialog } from './components/ZoneFormDialog';
import { ImportZonesDialog } from './components/ImportZonesDialog';

/** Screen 2 (p2) — a Zone Book's editor: Zones list + Coverage Rules tabs. */
export function ZoneBookEditorPage() {
  const { bookId = '' } = useParams();
  const store = useServiceZonesStore();
  const navigate = useNavigate();
  const { flash } = useToast();

  const book = store.books.find((b) => b.id === bookId) ?? null;
  const zones = zonesForBook(store.zones, bookId);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(zones[0]?.id ?? null);
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState('postcode');
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; zone: Zone | null } | null>(null);
  const [showImport, setShowImport] = useState(false);

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;

  if (!book) {
    return (
      <div className="p-6">
        <p className="mb-3 text-[13px] text-muted-foreground">Zone book not found.</p>
        <Button variant="utility" size="sm" onClick={() => navigate('/finance/service-zones')}>
          Back to Service Zones
        </Button>
      </div>
    );
  }

  const visibleZones = zones.filter((z) => z.name.toLowerCase().includes(filter.trim().toLowerCase()));

  const deleteZone = (id: string) => {
    store.removeZone(id);
    if (id === selectedZoneId) setSelectedZoneId(null);
    flash('Zone deleted');
  };

  const updateRanges = (ranges: PostcodeRange[]) => {
    if (selectedZone) store.updateZone(selectedZone.id, { postcodeRanges: ranges });
  };

  const toggleSuburb = (suburbId: string) => {
    if (!selectedZone) return;
    if (selectedZone.suburbIds.includes(suburbId)) {
      store.updateZone(selectedZone.id, { suburbIds: selectedZone.suburbIds.filter((id) => id !== suburbId) });
      return;
    }
    // single ownership within a book: detach from any sibling zone first
    for (const z of zones) {
      if (z.id !== selectedZone.id && z.suburbIds.includes(suburbId)) {
        store.updateZone(z.id, { suburbIds: z.suburbIds.filter((id) => id !== suburbId) });
      }
    }
    store.updateZone(selectedZone.id, { suburbIds: [...selectedZone.suburbIds, suburbId] });
  };

  const tabItems: TabItem[] = [
    { value: 'postcode', label: 'Postcode Ranges', count: selectedZone ? rangeCount(selectedZone) : 0 },
    { value: 'suburb', label: 'Suburbs', count: selectedZone ? suburbCount(selectedZone) : 0 },
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/finance/service-zones')}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Icon name="chevronLeft" size={14} /> Zone Books
        </button>
      </div>
      <div>
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">{book.name}</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Define zones and their postcode / suburb coverage.</p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* left — Zones */}
        <div className="min-w-0 lg:w-[360px] lg:shrink-0">
          <div className="flex h-[calc(100vh-220px)] flex-col overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-2 border-b bg-muted px-4 py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Zones</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="utility"
                  size="sm"
                  leadingIcon={<Icon name="map" size={15} />}
                  onClick={() => navigate(`/finance/service-zones/${bookId}/map`)}
                >
                  Edit on Map
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leadingIcon={<Icon name="plus" size={15} />}
                  onClick={() => setDialog({ mode: 'create', zone: null })}
                >
                  New Zone
                </Button>
              </div>
            </div>
            <div className="border-b p-2">
              <Input
                icon={<Icon name="search" size={15} />}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter zones…"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {visibleZones.map((z) => {
                const isSel = z.id === selectedZoneId;
                return (
                  <div
                    key={z.id}
                    className={cn(
                      'relative border-b border-l-2 last:border-b-0',
                      isSel ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-muted',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedZoneId(z.id)}
                      className="absolute inset-0 z-0"
                      aria-label={`Select ${z.name}`}
                    />
                    <div className="pointer-events-none relative z-10 flex items-center gap-2 px-3 py-2.5">
                      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: z.color }} />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">{z.name}</span>
                      {z.shortName && <span className="font-mono text-[10px] text-muted-foreground">{z.shortName}</span>}
                      <button
                        type="button"
                        aria-label={`Edit ${z.name}`}
                        onClick={() => setDialog({ mode: 'edit', zone: z })}
                        className="pointer-events-auto grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                      >
                        <Icon name="pencil" size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${z.name}`}
                        onClick={() => deleteZone(z.id)}
                        className="pointer-events-auto grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {visibleZones.length === 0 && (
                <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">No zones yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* right — Coverage Rules */}
        <div className="min-w-0 flex-1">
          <div className="flex h-[calc(100vh-220px)] flex-col overflow-hidden rounded-xl border bg-card">
            <div className="border-b bg-muted px-4 py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Coverage Rules</span>
              {selectedZone && <span className="ml-2 text-[12px] text-muted-foreground">— {selectedZone.name}</span>}
            </div>
            {selectedZone ? (
              <>
                <div className="border-b px-4 pt-3">
                  <Tabs items={tabItems} value={tab} onChange={setTab} />
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  {tab === 'postcode' ? (
                    <PostcodeRangesTab key={selectedZone.id} zone={selectedZone} onUpdate={updateRanges} />
                  ) : (
                    <SuburbsTab key={selectedZone.id} zone={selectedZone} bookZones={zones} onToggle={toggleSuburb} />
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                <Icon name="navigation" size={24} className="text-muted-foreground" />
                <p className="text-[13px] text-muted-foreground">
                  Select a zone to manage its postcode ranges and suburbs.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {dialog && (
        <ZoneFormDialog
          open
          onClose={() => setDialog(null)}
          mode={dialog.mode}
          zone={dialog.zone}
          bookId={bookId}
          existingCount={zones.length}
          onOpenImport={() => {
            setDialog(null);
            setShowImport(true);
          }}
        />
      )}
      <ImportZonesDialog open={showImport} onClose={() => setShowImport(false)} bookId={bookId} bookZones={zones} />
    </div>
  );
}
