import { useMemo, useState } from 'react';

import { addressLine, canDelete, type Client } from '@/domain/client';
import { useAuth } from '@/state/AuthProvider';
import { useClientsStore } from '@/store/ClientsProvider';
import {
  Button,
  ConfirmDialog,
  DataTable,
  Icon,
  IconButton,
  Input,
  Popover,
  type ColumnDef,
} from '@/ui';

import { ClientFormDialog } from './components/ClientFormDialog';
import { useClientActions } from './hooks/useClientActions';

/**
 * Clients — admin only.
 *
 * A client is a name, a frozen-once-used code, an active flag and an optional
 * default pickup address. The address is the point of the screen: it is what a
 * consignment copies into its sender snapshot, which is why a client without one
 * says so plainly in its own column rather than showing an empty cell.
 */
export function ClientsPage() {
  const { user: me } = useAuth();
  const store = useClientsStore();
  const actions = useClientActions();

  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; client: Client | null } | null>(
    null,
  );
  const [confirm, setConfirm] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return store.clients.filter((c) => {
      if (!showInactive && !c.active) return false;
      if (!needle) return true;
      return c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle);
    });
  }, [store.clients, q, showInactive]);

  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        key: 'name',
        header: 'Client',
        render: (c) => (
          <span className="flex flex-col">
            <span className="text-[13.5px] text-foreground">{c.name}</span>
            <span className="font-mono text-[11.5px] text-muted-foreground">{c.code}</span>
          </span>
        ),
      },
      {
        key: 'address',
        header: 'Default pickup address',
        render: (c) => {
          const line = addressLine(c);
          return line ? (
            <span className="block max-w-[420px] truncate text-[12.5px] text-body" title={line}>
              {line}
            </span>
          ) : (
            <span className="text-[12.5px] text-muted-foreground">
              Not set — no sender prefill
            </span>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        width: 110,
        render: (c) =>
          c.active ? (
            <span className="flex items-center gap-1.5 text-[12.5px] text-success">
              <span className="inline-block size-2 rounded-full bg-success" />
              Active
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <span className="inline-block size-2 rounded-full bg-muted-foreground/50" />
              Inactive
            </span>
          ),
      },
      {
        key: 'usageCount',
        header: 'Orders',
        width: 90,
        align: 'right',
        render: (c) => (
          <span className="font-mono text-[12.5px] tabular-nums text-body">{c.usageCount}</span>
        ),
      },
      {
        key: '__actions',
        header: '',
        width: 56,
        align: 'right',
        render: (c) => (
          <RowActions
            client={c}
            onEdit={() => setDialog({ mode: 'edit', client: c })}
            onToggleActive={() => void actions.setActive(c, !c.active)}
            onDelete={() => setConfirm(c)}
          />
        ),
      },
    ],
    [actions],
  );

  /**
   * Courtesy only — the backend refuses every write from a non-admin. Placed
   * after every hook, so an admin and a non-admin render the same hook count.
   */
  if (me.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <Icon name="building" size={22} />
          <h1 className="mt-3 font-display text-[17px] font-bold text-foreground">Not available</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Client management is restricted to administrators.
          </p>
        </div>
      </div>
    );
  }

  const inactiveCount = store.clients.filter((c) => !c.active).length;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
          Clients
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Accounts orders are logged against. A client&apos;s address prefills the sender.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {rows.length} {rows.length === 1 ? 'client' : 'clients'}
            {inactiveCount > 0 && !showInactive ? ` · ${inactiveCount} inactive hidden` : ''}
          </span>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Icon name="plus" size={15} />}
            onClick={() => setDialog({ mode: 'create', client: null })}
          >
            New client
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
          <Input
            icon={<Icon name="search" size={15} />}
            placeholder="Search name or code"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button
            variant={showInactive ? 'primary' : 'utility'}
            size="sm"
            onClick={() => setShowInactive((s) => !s)}
          >
            {showInactive ? 'Showing inactive' : 'Show inactive'}
          </Button>
        </div>

        {store.error ? (
          <p role="alert" className="p-6 text-center text-[13px] text-danger">
            Could not load clients: {store.error.message}
          </p>
        ) : store.loading ? (
          <p className="p-6 text-center text-[13px] text-muted-foreground">Loading…</p>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(c: Client) => c.id}
            emptyText={q.trim() ? 'No client matches that search.' : 'No clients yet.'}
          />
        )}
      </div>

      {dialog && (
        <ClientFormDialog
          open
          mode={dialog.mode}
          client={dialog.client}
          onClose={() => setDialog(null)}
          onCreate={(payload) => actions.create(payload)}
          onUpdate={(id, patch) => {
            const target = store.clients.find((c) => c.id === id);
            return target ? actions.save(target, patch) : Promise.resolve(null);
          }}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={`Delete ${confirm?.name ?? ''}?`}
        busy={deleting}
        body={
          <>
            This removes the client and its stored address for good. Orders already logged against
            it are unaffected, but nothing will prefill from it again.
          </>
        }
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

/**
 * Module scope, not nested in the page: a component declared inside another
 * remounts on every parent render and the popover would slam shut.
 */
function RowActions({
  client,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  client: Client;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const deletable = canDelete(client);

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      width={220}
      trigger={
        <IconButton
          size="sm"
          title="Actions"
          active={open}
          aria-label={`Actions for ${client.name}`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="text-xs">▾</span>
        </IconButton>
      }
    >
      <div className="py-1">
        <MenuItem
          label="Edit"
          onClick={() => {
            setOpen(false);
            onEdit();
          }}
        />
        <MenuItem
          label={client.active ? 'Deactivate' : 'Reactivate'}
          hint={client.active ? 'Hides it from the consignment form' : undefined}
          onClick={() => {
            setOpen(false);
            onToggleActive();
          }}
        />
        <MenuItem
          label="Delete…"
          danger
          disabled={!deletable}
          hint={
            deletable
              ? undefined
              : `Used by ${client.usageCount} order(s) — deactivate instead`
          }
          onClick={() => {
            setOpen(false);
            onDelete();
          }}
        />
      </div>
    </Popover>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
  disabled,
  hint,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={hint}
      className={[
        'flex w-full flex-col items-start px-3 py-2 text-left text-[13px] transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : danger
            ? 'text-danger hover:bg-accent'
            : 'text-foreground hover:bg-accent',
      ].join(' ')}
    >
      <span>{label}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </button>
  );
}
