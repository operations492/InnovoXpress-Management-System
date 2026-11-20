import { Badge, Button, Icon, IconButton, Input } from '@/ui';
import type { IconName } from '@/ui';
import type { RowTotals } from '@/domain/derive';

export interface ToolbarActions {
  onNewTask: () => void;
  onAssign: () => void;
  onTableSettings: () => void;
  onEditFirst: () => void;
  onClearSelection: () => void;
}

interface TaskToolbarProps {
  selectedCount: number;
  totals: RowTotals;
  tableQ: string;
  onTableQ: (q: string) => void;
  actions: ToolbarActions;
}

function GroupIcon({ name, title, onClick }: { name: IconName; title: string; onClick: () => void }) {
  return (
    <IconButton size="sm" title={title} onClick={onClick}>
      <Icon name={name} size={16} />
    </IconButton>
  );
}

export function TaskToolbar({ selectedCount, totals, tableQ, onTableQ, actions }: TaskToolbarProps) {
  if (selectedCount > 0) {
    return (
      <div className="flex items-center gap-3 border-b bg-muted px-4 py-2">
        <Button size="sm" variant="utility" leadingIcon={<Icon name="user" size={15} />} onClick={actions.onAssign}>
          Assign
        </Button>

        <div className="flex-1" />

        <button
          type="button"
          className="ix-reset-btn inline-flex items-center gap-1.5"
          onClick={actions.onClearSelection}
          title="Clear selection"
        >
          <Badge tone="danger" soft={false}>
            {selectedCount} {selectedCount === 1 ? 'task' : 'tasks'} selected
          </Badge>
          <Icon name="x" size={14} className="text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b px-4 py-2">
      <div className="inline-flex items-center gap-0.5 rounded-md border border-input p-0.5">
        <GroupIcon name="user" title="Assign" onClick={actions.onAssign} />
        <GroupIcon name="pencil" title="Edit" onClick={actions.onEditFirst} />
        <GroupIcon name="columns" title="Table settings" onClick={actions.onTableSettings} />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4 text-sm">
        <span className="font-semibold text-foreground">{totals.count} Tasks</span>
      </div>

      <div className="w-[220px]">
        <Input
          icon={<Icon name="search" size={15} />}
          placeholder="Search in table"
          value={tableQ}
          onChange={(e) => onTableQ(e.target.value)}
        />
      </div>
    </div>
  );
}
