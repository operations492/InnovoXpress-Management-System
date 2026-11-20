/** Table Settings — show/hide every column (live) + reorder + reset. */
import { Button, Checkbox, Icon, IconButton, Modal } from '@/ui';
import { COLUMN_LABEL } from '../tasks.types';

interface TableSettingsModalProps {
  open: boolean;
  onClose: () => void;
  order: string[];
  visible: Record<string, boolean>;
  toggle: (key: string) => void;
  reset: () => void;
  move: (key: string, dir: -1 | 1) => void;
}

export function TableSettingsModal({
  open,
  onClose,
  order,
  visible,
  toggle,
  reset,
  move,
}: TableSettingsModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      title="Table Settings"
      footer={
        <>
          <Button variant="utility" size="sm" onClick={reset}>
            Reset
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div>
        <div className="t-section mb-2 text-foreground">Columns</div>
        <div className="max-h-[320px] overflow-y-auto rounded-md border">
          {order.map((key, i) => (
            <div key={key} className="flex items-center gap-2.5 border-b px-2.5 py-1.5">
              <Checkbox checked={!!visible[key]} onChange={() => toggle(key)} />
              <span className="flex-1 text-sm text-body">{COLUMN_LABEL[key] ?? key}</span>
              <IconButton size="sm" title="Move up" disabled={i === 0} onClick={() => move(key, -1)}>
                <Icon name="chevronLeft" size={14} className="rotate-90" />
              </IconButton>
              <IconButton
                size="sm"
                title="Move down"
                disabled={i === order.length - 1}
                onClick={() => move(key, 1)}
              >
                <Icon name="chevronRight" size={14} className="rotate-90" />
              </IconButton>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
