/**
 * Finance → Service Zones → one list. Zones on the left, their postal codes on
 * the right.
 *
 * Codes are one pasted box, because that is what an operator actually has: a
 * column copied out of a spreadsheet. There are deliberately no ranges — a
 * Canadian postal code is not ordinal, so "M5V to M5X" names no definite set of
 * streets — and no suburb list, because the code is what pricing matches on.
 *
 * The box owns the TYPED codes only. Codes produced by drawing on the map are
 * shown beside them and are replaced by redrawing, never by typing.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Icon, Input, Modal, Textarea } from '@/ui';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { api, type ZoneCodePreviewDto, type ZoneDetailDto, type ZoneDto } from '@/lib/api';

function reason(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

export function ZoneBookEditorPage() {
  const { bookId = '' } = useParams();
  const navigate = useNavigate();
  const { flash } = useToast();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [namingNew, setNamingNew] = useState(false);
  const [newName, setNewName] = useState('');

  const list = useQuery({
    queryKey: ['zoneList', bookId],
    queryFn: () => api.getZoneList(bookId, { includeInactive: true }),
  });

  const zones = list.data?.zones ?? [];
  const shown = zones.filter((z) => z.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const selected = zones.find((z) => z.id === selectedId) ?? null;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['zoneList', bookId] });
    void qc.invalidateQueries({ queryKey: ['zone', bookId] });
  };

  const create = useMutation({
    mutationFn: (name: string) => api.createZone(bookId, { name }),
    onSuccess: (z) => {
      setSelectedId(z.id);
      setNamingNew(false);
      flash(`${z.name} added`);
      refresh();
    },
    onError: (e) => flash(`Could not add zone: ${reason(e)}`),
  });

  const remove = useMutation({
    mutationFn: (zoneId: string) => api.deleteZone(bookId, zoneId),
    onSuccess: (res) => {
      setSelectedId(null);
      // A zone named on a priced route is retired rather than removed.
      flash(res.deleted ? 'Zone deleted' : 'Zone retired — a rate card prices it');
      refresh();
    },
    onError: (e) => flash(`Could not delete zone: ${reason(e)}`),
  });

  if (list.isError) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <p className="text-sm text-muted-foreground">Zone list not found.</p>
        <Button variant="utility" size="sm" onClick={() => navigate('/finance/service-zones')}>
          Back to Service Zones
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={() => navigate('/finance/service-zones')}
          className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          ← Zone lists
        </button>
      </div>

      <div className="flex items-baseline gap-3 px-4 pt-2 pb-2">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
          {list.data?.name ?? 'Loading…'}
        </h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          {zones.length} zones · {list.data?.codeCount ?? 0} postal codes
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 lg:flex-row">
        {/* Zones */}
        <div className="w-full shrink-0 lg:w-[340px]">
          <div className="flex h-full min-h-[440px] flex-col overflow-hidden rounded-xl border bg-card lg:h-[calc(100vh-220px)]">
            <div className="flex items-center gap-2 border-b bg-muted px-3 py-2.5">
              <span className="flex-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Zones
              </span>
              <Button
                variant="utility"
                size="sm"
                leadingIcon={<Icon name="map" size={14} />}
                onClick={() => navigate(`/finance/service-zones/${bookId}/map`)}
              >
                Edit on map
              </Button>
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Icon name="plus" size={14} />}
                onClick={() => {
                  setNewName('');
                  setNamingNew(true);
                }}
              >
                New
              </Button>
            </div>

            <div className="border-b px-3 py-2">
              <Input
                placeholder="Filter zones…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {shown.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {zones.length === 0 ? 'No zones yet.' : 'Nothing matches that filter.'}
                </p>
              ) : (
                shown.map((z: ZoneDto) => {
                  const isSel = z.id === selectedId;
                  return (
                    <div
                      key={z.id}
                      className={cn(
                        'flex items-center gap-2 border-b border-l-2 border-border/60 px-3 py-2.5 last:border-b-0',
                        isSel ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-muted',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(z.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span
                          className={cn(
                            'block truncate text-sm',
                            z.active
                              ? 'font-medium text-foreground'
                              : 'text-muted-foreground line-through',
                            isSel && 'text-primary',
                          )}
                        >
                          {z.name}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {z.codeCount} codes
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${z.name}`}
                        onClick={() => remove.mutate(z.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Codes */}
        <div className="min-w-0 flex-1">
          <div className="flex h-full min-h-[440px] flex-col overflow-hidden rounded-xl border bg-card lg:h-[calc(100vh-220px)]">
            {selected ? (
              <CodesPanel
                key={selected.id}
                listId={bookId}
                zone={selected}
                onChanged={refresh}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Icon name="navigation" size={20} />
                </span>
                <p className="text-sm text-muted-foreground">
                  Select a zone to manage its postal codes.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={namingNew}
        onClose={() => setNamingNew(false)}
        title="New zone"
        width={400}
        footer={
          <>
            <Button variant="utility" size="sm" onClick={() => setNamingNew(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => create.mutate(newName.trim())}
              disabled={!newName.trim() || create.isPending}
            >
              Create
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Name<span className="text-primary"> *</span>
          </span>
          <Input
            autoFocus
            placeholder="e.g. Toronto"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) create.mutate(newName.trim());
            }}
          />
        </label>
      </Modal>
    </div>
  );
}

interface CodesPanelProps {
  listId: string;
  zone: ZoneDto;
  onChanged: () => void;
}

function CodesPanel({ listId, zone, onChanged }: CodesPanelProps) {
  const { flash } = useToast();
  const [text, setText] = useState<string | null>(null);
  const [preview, setPreview] = useState<ZoneCodePreviewDto | null>(null);

  const detail = useQuery({
    queryKey: ['zone', listId, zone.id],
    queryFn: () => api.getZone(listId, zone.id),
  });

  const typed = (detail.data?.codes ?? []).filter((c) => c.source === 'TYPED');
  const drawn = (detail.data?.codes ?? []).filter((c) => c.source === 'MAP');

  // The box starts from what is stored and is the operator's from then on.
  const value = text ?? typed.map((c) => c.code).join(', ');

  const check = useMutation({
    mutationFn: () => api.previewZoneCodes(listId, zone.id, value),
    onSuccess: setPreview,
    onError: (e) => flash(`Could not check: ${reason(e)}`),
  });

  const save = useMutation({
    mutationFn: () => api.saveZoneCodes(listId, zone.id, value),
    onSuccess: (res) => {
      setPreview(res);
      setText(null);
      void detail.refetch();
      onChanged();
      flash(`${res.codes.length} codes saved`);
    },
    onError: (e) => flash(reason(e)),
  });

  return (
    <>
      <div className="flex items-center gap-2.5 border-b bg-accent px-4 py-3">
        <span className="rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
          Zone
        </span>
        <h2 className="min-w-0 flex-1 truncate font-display text-[15px] font-bold tracking-tight text-foreground">
          {zone.name}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {typed.length} typed · {drawn.length} drawn
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Postal codes — comma separated
          </span>
          <Textarea
            rows={8}
            placeholder="M4C, M4S, M5B, M5V 3L9"
            value={value}
            onChange={(e) => {
              setText(e.target.value);
              setPreview(null);
            }}
          />
        </label>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Three characters for a whole area (<code>M5V</code>) or all six for one address
          (<code>M5V 3L9</code>). A six-character code overrides the area it sits inside, which is
          how an airport is carved out of the city around it. Saving replaces every typed code in
          this zone.
        </p>

        {preview && (
          <div className="mt-3 flex flex-col gap-2 rounded-md border bg-muted/40 p-3 text-[11px]">
            <span className="font-mono uppercase tracking-wide text-muted-foreground">
              {preview.savable} of {preview.valid.length} would be saved
            </span>
            {preview.duplicates.length > 0 && (
              <span className="text-muted-foreground">
                Repeated, kept once: {preview.duplicates.join(', ')}
              </span>
            )}
            {preview.invalid.length > 0 && (
              <span className="text-destructive">
                Not a postal code: {preview.invalid.join(', ')}
              </span>
            )}
            {preview.conflicts.length > 0 && (
              <span className="text-amber-600">
                Already taken —{' '}
                {preview.conflicts.map((c) => `${c.code} is in "${c.zoneName}"`).join(', ')}.
                Nothing will be saved until these are removed.
              </span>
            )}
          </div>
        )}

        {drawn.length > 0 && (
          <div className="mt-3 rounded-md border bg-muted/40 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              From the map
            </p>
            <p className="mt-1 font-mono text-[11px] text-foreground">
              {drawn.map((c) => c.code).join(', ')}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Replaced by redrawing on the map, not by this box.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-3">
        <Button
          variant="utility"
          size="sm"
          onClick={() => check.mutate()}
          disabled={check.isPending}
        >
          Check
        </Button>
        <div className="flex-1" />
        <Button
          variant="primary"
          size="sm"
          onClick={() => save.mutate()}
          disabled={save.isPending || (preview?.conflicts.length ?? 0) > 0}
        >
          Save codes
        </Button>
      </div>
    </>
  );
}

export type { ZoneDetailDto };
