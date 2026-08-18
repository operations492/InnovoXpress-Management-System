import { useMemo, useState } from 'react';
import { Badge, Button, ConfirmDialog, DataTable, Icon, IconButton, Input, Popover, Select } from '@/ui';
import type { ColumnDef } from '@/ui';
import type { UserDto } from '@/lib/api';
import { useAuth } from '@/state/AuthProvider';
import { useUsersStore } from '@/store/UsersProvider';
import { useUserActions } from './hooks/useUserActions';
import { UserFormDialog } from './components/UserFormDialog';
import { ROLE_OPTIONS } from './userSchema';

const ROLE_TONE: Record<string, 'accent' | 'neutral' | 'info'> = {
  admin: 'accent',
  operator: 'info',
  driver: 'neutral',
};

/**
 * Module scope, not nested inside UsersPage — a component declared inside
 * another is a fresh type on every render, so React unmounts and remounts it
 * and the popover would slam shut whenever the page re-rendered.
 */
function RowActions({
  user,
  isSelf,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  user: UserDto;
  isSelf: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Popover
      open={open}
      onClose={close}
      align="right"
      width={200}
      trigger={
        <IconButton
          size="sm"
          title="Actions"
          active={open}
          aria-label={`Actions for ${user.name}`}
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
            close();
            onEdit();
          }}
        />
        <MenuItem
          label={user.active ? 'Deactivate' : 'Reactivate'}
          // The server refuses this too; the point here is not to offer an
          // action that cannot succeed.
          disabled={isSelf}
          hint={isSelf ? 'You cannot deactivate yourself' : undefined}
          onClick={() => {
            close();
            onToggleActive();
          }}
        />
        <MenuItem
          label="Delete…"
          danger
          disabled={isSelf}
          hint={isSelf ? 'You cannot delete yourself' : undefined}
          onClick={() => {
            close();
            onDelete();
          }}
        />
      </div>
    </Popover>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const store = useUsersStore();
  const actions = useUserActions();

  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; user: UserDto | null } | null>(null);
  const [confirm, setConfirm] = useState<UserDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return store.users.filter((u) => {
      if (!showInactive && !u.active) return false;
      if (role && u.role !== role) return false;
      if (!needle) return true;
      return u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle);
    });
  }, [store.users, q, role, showInactive]);

  const columns = useMemo<ColumnDef<UserDto>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (u) => (
          <span className="flex flex-col">
            <span className="text-[13.5px] text-foreground">
              {u.name}
              {u.id === me.id && <span className="ml-1.5 text-[11px] text-muted-foreground">(you)</span>}
            </span>
            <span className="font-mono text-[11.5px] text-muted-foreground">{u.email}</span>
          </span>
        ),
      },
      {
        key: 'role',
        header: 'Role',
        width: 110,
        render: (u) => <Badge tone={ROLE_TONE[u.role] ?? 'neutral'}>{u.role}</Badge>,
      },
      {
        key: 'status',
        header: 'Status',
        width: 110,
        render: (u) =>
          u.active ? (
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
        key: 'driver',
        header: 'Driver',
        width: 150,
        render: (u) =>
          u.driver ? (
            <span className="flex flex-col">
              <span className="text-[12.5px] text-body">{u.driver.code ?? u.driver.name}</span>
              {u.driver.onShift && <span className="text-[11px] text-success">on shift</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: '__actions',
        header: '',
        width: 56,
        align: 'right',
        render: (u) => (
          <RowActions
            user={u}
            isSelf={u.id === me.id}
            onEdit={() => setDialog({ mode: 'edit', user: u })}
            onToggleActive={() => void actions.setActive(u, !u.active)}
            onDelete={() => setConfirm(u)}
          />
        ),
      },
    ],
    [me.id, actions],
  );

  /**
   * Courtesy only. The real protection is the backend refusing every
   * /api/users call from a non-admin — this page ships in a public bundle and
   * anyone can navigate to it.
   *
   * Placed AFTER every hook: an early return above them would make an admin and
   * a non-admin render different numbers of hooks, and React would throw the
   * moment a role changed.
   */
  if (me.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <Icon name="users" size={22} />
          <h1 className="mt-3 font-display text-[17px] font-bold text-foreground">Not available</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            User management is restricted to administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">Users</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Admins and operators sign in here; drivers sign in on the phone app.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {rows.length} of {store.users.length}
          </span>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Icon name="plus" size={15} />}
            onClick={() => setDialog({ mode: 'create', user: null })}
          >
            New user
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
          <Input
            icon={<Icon name="search" size={15} />}
            placeholder="Search name or email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <Select
            options={[{ value: '', label: 'All roles' }, ...ROLE_OPTIONS]}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ maxWidth: 160 }}
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
          <div className="px-4 py-10 text-center text-[13px] text-danger">
            Could not load users: {store.error.message}
          </div>
        ) : store.loading ? (
          <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">Loading…</div>
        ) : (
          <DataTable<UserDto>
            columns={columns}
            rows={rows}
            rowKey={(u) => u.id}
            emptyText="No users match those filters"
          />
        )}
      </div>

      {dialog && (
        <UserFormDialog
          open
          mode={dialog.mode}
          user={dialog.user}
          isSelf={dialog.user?.id === me.id}
          onClose={() => setDialog(null)}
          onCreate={actions.create}
          onUpdate={(id, payload) => actions.update(id, payload)}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={`Delete ${confirm?.name ?? ''}?`}
        busy={deleting}
        body={
          <>
            <p>Their login is removed immediately and they can no longer sign in.</p>
            {confirm?.driver && (
              <p className="mt-2">
                Their <strong>driver record and delivery history are kept</strong> — consignments must
                keep showing who carried them. Deactivate instead if they may return.
              </p>
            )}
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
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={[
        'flex w-full items-center px-3 py-1.5 text-left text-[13px] transition-colors',
        disabled
          ? 'cursor-not-allowed text-muted-foreground/50'
          : danger
            ? 'text-danger hover:bg-danger/10'
            : 'text-body hover:bg-muted',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
