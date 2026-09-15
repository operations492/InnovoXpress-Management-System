import { Button, Icon, IconButton } from '@/ui';
import { cn } from '@/lib/utils';
import { itemsGrandTotal } from '@/domain/derive';
import { decimal, qty as fmtQty } from '@/domain/format';
import type { TaskItem } from '@/domain/types';

interface ItemsEditorProps {
  items: TaskItem[];
  onAdd?: () => void;
  onEdit?: (i: number) => void;
  onDelete?: (i: number) => void;
  readOnly?: boolean;
}

const TH = 'border-b px-2 py-1.5 text-left text-foreground';
const TD = 'border-b px-2 py-2 align-top text-[13px] text-body';
const NUM = 'tnum text-right';

/**
 * The consignment items table. Units live in the column headers, so the cells
 * are plain figures; a blank figure is a dash, never a fabricated 0. Cubic is
 * derived, never typed, and the footer is rounded the way the API rounds its
 * totals so the two can never disagree.
 */
export function ItemsEditor({ items, onAdd, onEdit, onDelete, readOnly }: ItemsEditorProps) {
  const g = itemsGrandTotal(items);
  const columns = readOnly ? 8 : 9;

  return (
    <div>
      <div className="mb-2 flex items-center">
        <div className="t-section flex-1 text-foreground">Consignment Items</div>
        {!readOnly && onAdd && (
          <Button size="sm" variant="utility" leadingIcon={<Icon name="plus" size={14} />} onClick={onAdd}>
            Add Item
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border">
          <thead>
            <tr className="t-table-head">
              <th className={cn(TH, 'w-[150px]')}>Reference</th>
              <th className={cn(TH, 'w-[64px] text-right')}>Qty</th>
              <th className={TH}>Description</th>
              <th className={cn(TH, 'w-[124px] text-right')}>Total Weight (lb)</th>
              <th className={cn(TH, 'w-[92px] text-right')}>Length (in)</th>
              <th className={cn(TH, 'w-[88px] text-right')}>Width (in)</th>
              <th className={cn(TH, 'w-[92px] text-right')}>Height (in)</th>
              <th className={cn(TH, 'w-[84px] text-right')}>Cubic</th>
              {!readOnly && <th className={cn(TH, 'w-[70px]')} aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td className={cn(TD, 'text-muted-foreground')} colSpan={columns}>
                  No items added
                </td>
              </tr>
            )}
            {items.map((it, i) => (
              <tr key={it.id}>
                <td className={cn(TD, 'text-foreground')}>{it.barcode || '—'}</td>
                <td className={cn(TD, NUM)}>{fmtQty(it.qty)}</td>
                <td className={cn(TD, 'text-foreground')}>{it.description || '—'}</td>
                <td className={cn(TD, NUM)}>{decimal(it.weightLb, 3)}</td>
                <td className={cn(TD, NUM)}>{decimal(it.lengthIn)}</td>
                <td className={cn(TD, NUM)}>{decimal(it.widthIn)}</td>
                <td className={cn(TD, NUM)}>{decimal(it.heightIn)}</td>
                <td className={cn(TD, NUM)}>{decimal(it.cubic, 4)}</td>
                {!readOnly && (
                  <td className={cn(TD, 'text-right')}>
                    <div className="inline-flex gap-0.5">
                      <IconButton size="sm" title="Edit item" onClick={() => onEdit?.(i)}>
                        <Icon name="pencil" size={14} />
                      </IconButton>
                      <IconButton size="sm" title="Delete item" onClick={() => onDelete?.(i)}>
                        <Icon name="trash" size={14} />
                      </IconButton>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-foreground">
              <td className={cn(TD, 'font-semibold')}>Total</td>
              <td className={cn(TD, NUM, 'font-semibold')}>{fmtQty(g.qty)}</td>
              <td className={TD} />
              <td className={cn(TD, NUM, 'font-semibold')}>{decimal(g.weightLb, 3)}</td>
              <td className={TD} />
              <td className={TD} />
              <td className={TD} />
              <td className={cn(TD, NUM, 'font-semibold')}>{decimal(g.cubic, 4)}</td>
              {!readOnly && <td className={TD} />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
