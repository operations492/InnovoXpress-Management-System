import { useMemo } from 'react';
import { DataTable } from '@/ui';
import type { Task } from '@/domain/types';
import { buildColumns } from './taskColumns';
import type { ColumnHandlers } from './taskColumns';

interface TaskTableProps {
  rows: Task[];
  visibleKeys: string[];
  selected: string[];
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  handlers: ColumnHandlers;
}

export function TaskTable({
  rows,
  visibleKeys,
  selected,
  onToggleRow,
  onToggleAll,
  handlers,
}: TaskTableProps) {
  const columns = useMemo(() => buildColumns(visibleKeys, handlers), [visibleKeys, handlers]);

  return (
    <DataTable<Task>
      columns={columns}
      rows={rows}
      selectable
      selectedKeys={selected}
      rowKey={(r) => r.id}
      onToggleRow={(key) => onToggleRow(String(key))}
      onToggleAll={onToggleAll}
      emptyText="No tasks found"
    />
  );
}
