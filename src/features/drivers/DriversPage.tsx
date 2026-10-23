/**
 * Drivers — the courier roster.
 *
 * This is the roster, not accounts: identity, shift state, live load, photo and ID
 * card. A driver's login is created on the Users tab by linking to a row from
 * here, because a courier record and a sign-in are different things with different
 * lifetimes — someone can leave the company and their deliveries must still say
 * who made them.
 */
import { useMemo, useState } from 'react';
import { Avatar, Button, ConfirmDialog, DataTable, Icon, Input, type ColumnDef } from '@/ui';
import { cn } from '@/lib/utils';
import { useAuth } from '@/state/AuthProvider';
import { useDriversStore } from '@/store/DriversProvider';
import { canDelete, shiftLabel, type Driver } from '@/domain/driver';
import { DriverFormDialog } from './components/DriverFormDialog';
import { DriverDocumentsDialog } from './components/DriverDocumentsDialog';
import { useDriverActions } from './hooks/useDriverActions';

export function DriversPage() {
  const { user } = useAuth();
  const store = useDriversStore();
  const actions = useDriverActions();

  const isAdmin = user?.role === 'admin';

  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; driver: Driver | null } | null>(
    null,
  );
  const [docsFor, setDocsFor] = useState<Driver | null>(null);
  const [confirm, setConfirm] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return store.drivers.filter((d) => {
      if (!showInactive && !d.active) return false;
      if (!needle) return true;
      return (
        d.name.toLowerCase().includes(needle) ||
        (d.code ?? '').toLowerCase().includes(needle) ||
        (d.mobile ?? '').toLowerCase().includes(needle)
      );
    });
  }, [store.drivers, q, showInactive]);

  const columns = useMemo<ColumnDef<Driver>[]>(
    () => [
      {
        key: 'name',
        header: 'Driver',
        render: (d) => (
          <span className="flex items-center gap-2.5">
            <Avatar name={d.name} src={d.photoUrl} size={30} />
            <span className="min-w-0">
              <span
                className={cn(
                  'block truncate text-sm',
                  d.active ? 'font-medium text-foreground' : 'text-muted-foreground line-through',
                )}
              >
                {d.name}
              </span>
              {d.code && (
                <span className="block font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {d.code}
                </span>
              )}
            </span>
          </span>
        ),
      },
      { key: 'mobile', header: 'Mobile', render: (d) => d.mobile ?? '—' },
      {
        key: 'shift',
        header: 'Shift',
        render: (d) => (
          <span
            className={cn(
              'font-mono text-[10px] uppercase tracking-wide',
              d.onShift && d.active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {shiftLabel(d)}
          </span>
        ),
      },
      {
        key: 'load',
        header: 'Load',
        align: 'right',
        render: (d) => (
          <span className="font-mono text-[13px] tabular-nums">{d.activeLoad}</span>
        ),
      },
      {
        key: 'actions',
        header: '',
        render: (d) => (
          <span className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setDocsFor(d)}>
              {d.photoUrl ? 'Documents' : 'Add photo'}
            </Button>
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialog({ mode: 'edit', driver: d })}
                >
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void actions.setActive(d, !d.active)}>
                  {d.active ? 'Deactivate' : 'Reactivate'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${d.name}`}
                  disabled={!canDelete(d)}
                  title={canDelete(d) ? undefined : 'Has active work — deactivate instead'}
                  onClick={() => setConfirm(d)}
                >
                  <Icon name="trash" size={14} />
                </Button>
              </>
            )}
          </span>
        ),
      },
    ],
    [actions, isAdmin],
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
          Drivers
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          The courier roster. Logins are created on the Users tab by linking to a driver here.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted px-4 py-3">
          <span className="font-mono text-[11px] text-muted-foreground">
            <b className="font-semibold text-foreground">{rows.length}</b> of {store.drivers.length}{' '}
            · {store.drivers.filter((d) => d.onShift && d.active).length} on shift
          </span>
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Icon name="plus" size={14} />}
              onClick={() => setDialog({ mode: 'create', driver: null })}
            >
              New driver
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
          <Input
            placeholder="Search name, code or mobile"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            icon={<Icon name="search" size={14} />}
            style={{ maxWidth: 280 }}
          />
          <Button
            variant={showInactive ? 'utility' : 'ghost'}
            size="sm"
            aria-pressed={showInactive}
            onClick={() => setShowInactive((v) => !v)}
          >
            Show inactive
          </Button>
        </div>

        {store.error ? (
          <p role="alert" className="p-6 text-center text-[13px] text-danger">
            {store.error.message}
          </p>
        ) : store.loading ? (
          <p className="p-6 text-center text-[13px] text-muted-foreground">Loading…</p>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(d) => d.id}
            emptyText={store.drivers.length === 0 ? 'No drivers yet.' : 'Nothing matches.'}
          />
        )}
      </div>

      {dialog && (
        <DriverFormDialog
          open
          mode={dialog.mode}
          driver={dialog.driver}
          onClose={() => setDialog(null)}
          onCreate={(input) => actions.create(input)}
          onUpdate={(id, patch) => {
            const target = store.drivers.find((d) => d.id === id);
            return target ? actions.save(target, patch) : Promise.resolve(null);
          }}
        />
      )}

      {docsFor && (
        <DriverDocumentsDialog
          open
          driver={docsFor}
          canEdit={Boolean(isAdmin)}
          onClose={() => setDocsFor(null)}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={`Remove ${confirm?.name ?? ''}?`}
        body="This erases the roster row. Only possible while they have no delivery history — otherwise deactivate them instead."
        confirmLabel="Remove"
        busy={deleting}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          setDeleting(true);
          await actions.remove(confirm);
          setDeleting(false);
          setConfirm(null);
        }}
      />
    </div>
  );
}
