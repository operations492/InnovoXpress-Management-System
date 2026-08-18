import { Badge, Button, Icon, IconButton, Input } from '@/ui';
import type { IconName } from '@/ui';
import { money } from '@/domain/format';
import type { RowTotals } from '@/domain/derive';

export interface ToolbarActions {
  onNewTask: () => void;
  onAssign: () => void;
  onBulkEdit: () => void;
  onDelete: () => void;
  onLabel: () => void;
  onDocket: () => void;
  onDownload: () => void;
  onCardView: () => void;
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
        <Button size="sm" variant="utility" leadingIcon={<Icon name="pencil" size={15} />} onClick={actions.onBulkEdit}>
          Edit
        </Button>
        <Button size="sm" variant="utility" leadingIcon={<Icon name="trash" size={15} />} onClick={actions.onDelete}>
          Delete
        </Button>
        <Button size="sm" variant="utility" leadingIcon={<Icon name="receipt" size={15} />} onClick={actions.onLabel}>
          Label
        </Button>
        <Button size="sm" variant="utility" leadingIcon={<Icon name="note" size={15} />} onClick={actions.onDocket}>
          Docket
        </Button>
        <Button size="sm" variant="utility" leadingIcon={<Icon name="download" size={15} />} onClick={actions.onDownload}>
          Download
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
        <GroupIcon name="trash" title="Delete" onClick={actions.onDelete} />
        <GroupIcon name="grid" title="Card view" onClick={actions.onCardView} />
        <GroupIcon name="sliders" title="Bulk edit" onClick={actions.onBulkEdit} />
        <GroupIcon name="download" title="Export" onClick={actions.onDownload} />
        <GroupIcon name="columns" title="Table settings" onClick={actions.onTableSettings} />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4 text-sm">
        <span className="font-semibold text-foreground">{totals.count} Tasks</span>
        <span className="tnum text-muted-foreground">{money(totals.fee)} Fee</span>
        <span className="tnum text-muted-foreground">{money(totals.cod)} COD</span>
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
