/**
 * Column definitions for the task table. Each special cell is its OWN click target
 * (the prototype's distinct interactions): the destination opens View, the driver
 * cell opens Assign, the status chip opens Change Status, the pencil opens the Task
 * Card, and the ▾ menu offers View / Change Status / Delete.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Icon, IconButton, Popover, StatusChip } from '@/ui';
import type { ColumnDef } from '@/ui';
import { cn } from '@/lib/utils';
import { dash, money } from '@/domain/format';
import type { Task } from '@/domain/types';
import { COLUMNS } from '../tasks.types';

export interface ColumnHandlers {
  onView: (id: string) => void;
  onAssign: (id: string) => void;
  onChangeStatus: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSort: (key: string) => void;
  sortKey: string | null;
  sortDir: 'asc' | 'desc';
  onOpenTableSettings: () => void;
}

const TEXT_ACCESSOR: Record<string, (t: Task) => string> = {
  recipient: (t) => t.recipient,
  description: (t) => t.description,
  deliverBefore: (t) => t.deliverBefore,
  createdTime: (t) => t.createdTime,
  type: (t) => t.type,
  dispatchAddress: (t) => t.dispatchAddress,
  dispatchBuilding: (t) => t.dispatchBuilding,
  requester: (t) => t.requester,
  requesterPhone: (t) => t.requesterPhone,
  destBuilding: (t) => t.destBuilding,
  destNotes: (t) => t.destNotes,
  recipientPhone: (t) => t.recipientPhone,
  recipientEmail: (t) => t.recipientEmail,
  team: (t) => t.team,
  pickupAfter: (t) => t.pickupAfter,
  priority: (t) => t.priority,
  merchant: (t) => t.merchant,
  externalId: (t) => t.externalId,
  taskId: (t) => t.id,
};

function SortableHeader({
  label,
  active,
  dir,
  onSort,
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onSort: () => void;
}) {
  return (
    <button
      type="button"
      className="ix-reset-btn t-table-head inline-flex items-center gap-1 text-foreground"
      onClick={onSort}
    >
      {label}
      <span className={cn('text-[10px]', active ? 'text-foreground' : 'text-muted-foreground')}>
        {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </button>
  );
}

function DestCell({ task, onView }: { task: Task; onView: (id: string) => void }) {
  return (
    <button
      type="button"
      className="ix-reset-btn ix-dest ix-clip block max-w-[230px]"
      title={task.dest}
      onClick={() => onView(task.id)}
    >
      {dash(task.dest)}
    </button>
  );
}

function DriverCell({ task, onAssign }: { task: Task; onAssign: (id: string) => void }) {
  const assigned = task.driverAssigned && !!task.driver;
  return (
    <button
      type="button"
      className={cn(
        'ix-reset-btn ix-driver-cell ix-clip inline-flex max-w-[160px] items-center gap-1.5',
        assigned ? 'text-primary' : 'text-muted-foreground',
      )}
      title={assigned ? task.driver : 'Assign driver'}
      onClick={() => onAssign(task.id)}
    >
      <Icon name="user" size={14} />
      <span className="ix-clip">{assigned ? task.driver : 'Assign'}</span>
    </button>
  );
}

function MenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn('ix-reset-btn ix-menu-item', danger && 'text-destructive')}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function RowActions({ task, h }: { task: Task; h: ColumnHandlers }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="inline-flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <IconButton size="sm" title="Edit task" onClick={() => h.onEdit(task.id)}>
        <Icon name="pencil" size={15} />
      </IconButton>
      <Popover
        open={open}
        onClose={close}
        align="right"
        width={180}
        trigger={
          <IconButton size="sm" title="More" active={open} onClick={() => setOpen((o) => !o)}>
            <span className="text-xs">▾</span>
          </IconButton>
        }
      >
        <div className="py-1">
          <MenuItem
            icon={<Icon name="search" size={15} />}
            label="View Details"
            onClick={() => {
              close();
              h.onView(task.id);
            }}
          />
          <MenuItem
            icon={<Icon name="refresh" size={15} />}
            label="Change Status"
            onClick={() => {
              close();
              h.onChangeStatus(task.id);
            }}
          />
          <MenuItem
            icon={<Icon name="trash" size={15} />}
            label="Delete"
            danger
            onClick={() => {
              close();
              h.onDelete(task.id);
            }}
          />
        </div>
      </Popover>
    </div>
  );
}

export function buildColumns(visibleKeys: string[], h: ColumnHandlers): ColumnDef<Task>[] {
  const cols: ColumnDef<Task>[] = visibleKeys.map((key) => {
    const meta = COLUMNS.find((c) => c.key === key);
    const header = (
      <SortableHeader
        label={meta?.label ?? key}
        active={h.sortKey === key}
        dir={h.sortDir}
        onSort={() => h.onSort(key)}
      />
    );
    const base = { key, header, width: meta?.width, align: meta?.align };

    if (key === 'dest') return { ...base, render: (t: Task) => <DestCell task={t} onView={h.onView} /> };
    if (key === 'driver')
      return { ...base, render: (t: Task) => <DriverCell task={t} onAssign={h.onAssign} /> };
    if (key === 'status')
      return {
        ...base,
        render: (t: Task) => <StatusChip status={t.status} onClick={() => h.onChangeStatus(t.id)} />,
      };
    if (key === 'cod')
      return { ...base, render: (t: Task) => <span className="tnum">{money(t.codNum)}</span> };
    if (key === 'shippingFee')
      return { ...base, render: (t: Task) => <span className="tnum">{money(t.feeNum)}</span> };

    const accessor = TEXT_ACCESSOR[key];
    return {
      ...base,
      render: (t: Task) => {
        const value = accessor ? accessor(t) : '';
        return (
          <span className="ix-clip block" style={{ maxWidth: meta?.width ?? 180 }} title={value}>
            {dash(value)}
          </span>
        );
      },
    };
  });

  cols.push({
    key: '__actions',
    width: 92,
    align: 'right',
    header: (
      <IconButton accent title="Table settings" onClick={h.onOpenTableSettings}>
        <Icon name="columns" size={16} />
      </IconButton>
    ),
    render: (t: Task) => <RowActions task={t} h={h} />,
  });

  return cols;
}
