/**
 * Finance → Service Zones — the directory of zone lists.
 *
 * A zone list is one customer's map of the country: "Apple Express Zones", with
 * Toronto, Timmins and Vancouver inside it. A rate card points at a list rather
 * than at zones directly, so two customers can carve the same city up
 * differently and neither sees the other's.
 *
 * Master-detail, the same shape as Freight Items. Real API — the fixture store
 * this screen used to run on is gone.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Icon, Input, Modal, Switch, Textarea } from '@/ui';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { api, type ZoneListDto } from '@/lib/api';

const GRID = 'grid grid-cols-[1fr_80px_80px] gap-2';

function reason(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

export function ServiceZonesPage() {
  const { flash } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [namingNew, setNamingNew] = useState(false);
  const [newName, setNewName] = useState('');

  const lists = useQuery({
    queryKey: ['zoneLists'],
    queryFn: () => api.listZoneLists({ includeInactive: true }),
  });

  const rows = lists.data ?? [];
  const selected = rows.find((l) => l.id === selectedId) ?? null;
  const activeCount = rows.filter((l) => l.active).length;

  const done = () => qc.invalidateQueries({ queryKey: ['zoneLists'] });

  const create = useMutation({
    mutationFn: (name: string) => api.createZoneList({ name }),
    onSuccess: (created) => {
      setSelectedId(created.id);
      setNamingNew(false);
      flash(`${created.name} created`);
      void done();
    },
    onError: (e) => flash(`Could not create zone list: ${reason(e)}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteZoneList(id),
    onSuccess: () => {
      setSelectedId(null);
      flash('Zone list deleted');
      void done();
    },
    // A list priced by a rate card is refused with a readable 409.
    onError: (e) => flash(`Could not delete: ${reason(e)}`),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="flex items-baseline gap-3 px-4 pt-4 pb-2">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
          Service Zones
        </h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          <b className="font-semibold text-foreground">{rows.length}</b> zone lists · {activeCount}{' '}
          active · a rate card prices one of these
        </span>
      </div>

      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          Zone list directory
        </span>
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Icon name="plus" size={15} />}
          onClick={() => {
            setNewName('');
            setNamingNew(true);
          }}
        >
          New zone list
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div
              className={cn(
                GRID,
                'border-b bg-muted px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground',
              )}
            >
              <span>Zone list</span>
              <span className="text-right">Zones</span>
              <span className="text-right">Codes</span>
            </div>

            {lists.isPending ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No zone lists yet.
              </p>
            ) : (
              rows.map((l) => {
                const isSel = l.id === selectedId;
                return (
                  <div
                    key={l.id}
                    className={cn(
                      GRID,
                      'relative items-center border-b border-l-2 border-border/60 px-4 py-2.5 transition-colors last:border-b-0',
                      isSel ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-muted',
                    )}
                  >
                    <button
                      type="button"
                      aria-label={`Select ${l.name}`}
                      onClick={() => setSelectedId(l.id)}
                      onDoubleClick={() => navigate(`/finance/service-zones/${l.id}`)}
                      className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    />
                    <span
                      className={cn(
                        'pointer-events-none z-10 truncate text-sm',
                        l.active
                          ? 'font-medium text-foreground'
                          : 'text-muted-foreground line-through',
                        isSel && 'text-primary',
                      )}
                    >
                      {l.name}
                    </span>
                    <span className="pointer-events-none z-10 text-right font-mono text-[11px] text-muted-foreground">
                      {l.zoneCount}
                    </span>
                    <span className="pointer-events-none z-10 text-right font-mono text-[11px] text-muted-foreground">
                      {l.codeCount}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 lg:w-[384px]">
          <div className="flex min-h-[440px] flex-col overflow-hidden rounded-xl border bg-card shadow-[var(--elevation-1)] lg:sticky lg:top-0 lg:h-[calc(100vh-180px)]">
            <ZoneListPanel
              key={selected?.id ?? 'empty'}
              list={selected}
              busy={remove.isPending}
              onOpen={() => selected && navigate(`/finance/service-zones/${selected.id}`)}
              onSaved={() => {
                flash('Zone list saved');
                void done();
              }}
              onDelete={() => selected && remove.mutate(selected.id)}
            />
          </div>
        </aside>
      </div>

      <Modal
        open={namingNew}
        onClose={() => setNamingNew(false)}
        title="New zone list"
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
            placeholder="e.g. Apple Express Zones"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) create.mutate(newName.trim());
            }}
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          You'll add the zones and their postal codes next.
        </p>
      </Modal>
    </div>
  );
}

interface ZoneListPanelProps {
  list: ZoneListDto | null;
  busy: boolean;
  onOpen: () => void;
  onSaved: () => void;
  onDelete: () => void;
}

/** Remounted by `key` when the selection changes, so state starts from props. */
function ZoneListPanel({ list, busy, onOpen, onSaved, onDelete }: ZoneListPanelProps) {
  const { flash } = useToast();
  const [name, setName] = useState(list?.name ?? '');
  const [description, setDescription] = useState(list?.description ?? '');
  const [active, setActive] = useState(list?.active ?? true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      api.updateZoneList(list?.id ?? '', {
        name: name.trim(),
        description: description.trim() || null,
        active,
      }),
    onSuccess: onSaved,
    onError: (e) => flash(`Could not save: ${reason(e)}`),
  });

  if (!list) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon name="map" size={20} />
        </span>
        <p className="text-sm text-muted-foreground">
          Select a zone list to edit it, or add a new one.
        </p>
      </div>
    );
  }

  const valid = name.trim().length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b bg-accent px-4 py-3">
        <span className="rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
          List
        </span>
        <h2 className="min-w-0 flex-1 truncate font-display text-[15px] font-bold tracking-tight text-foreground">
          {name.trim() || 'Untitled list'}
        </h2>
        <span
          className={cn(
            'font-mono text-[10px] uppercase tracking-wide',
            active ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {active ? 'Active' : 'Retired'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Name<span className="text-primary"> *</span>
            </span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Description</span>
            <Textarea
              placeholder="What this map is for"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <span className="flex flex-col">
              <span className="text-sm font-medium text-foreground">Active</span>
              <span className="text-xs text-muted-foreground">
                Retired lists stay attached to the rate cards that use them.
              </span>
            </span>
            <Switch checked={active} onChange={(e) => setActive(e.target.checked)} />
          </label>

          <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <p className="font-mono text-[11px] text-muted-foreground">
              {list.zoneCount} zones · {list.codeCount} postal codes
            </p>
            <Button
              variant="utility"
              size="sm"
              className="mt-2"
              leadingIcon={<Icon name="map" size={14} />}
              onClick={onOpen}
            >
              Open zones
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-3">
        {confirmingDelete ? (
          <>
            <span className="text-xs text-muted-foreground">Delete this list?</span>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
              Keep
            </Button>
            <Button variant="danger" size="sm" disabled={busy} onClick={onDelete}>
              Delete
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Icon name="trash" size={14} />}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant="primary"
          size="sm"
          onClick={() => save.mutate()}
          disabled={!valid || save.isPending}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}
