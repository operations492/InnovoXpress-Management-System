import { Button, Icon, IconButton } from '@/ui';
import { cn } from '@/lib/utils';
import { itemsGrandTotal } from '@/domain/derive';
import { money, qty as fmtQty, weightKg } from '@/domain/format';
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

export function ItemsEditor({ items, onAdd, onEdit, onDelete, readOnly }: ItemsEditorProps) {
  const g = itemsGrandTotal(items);

  return (
    <div>
      <div className="mb-2 flex items-center">
        <div className="t-section flex-1 text-foreground">Items / Packages</div>
        {!readOnly && onAdd && (
          <Button size="sm" variant="utility" leadingIcon={<Icon name="plus" size={14} />} onClick={onAdd}>
            Add Item
          </Button>
        )}
      </div>

      <table className="w-full border-collapse border">
        <thead>
          <tr className="t-table-head">
            <th className={TH}>Product</th>
            <th className={cn(TH, 'w-[90px] text-right')}>Quantity</th>
            <th className={cn(TH, 'w-[110px] text-right')}>Line Total</th>
            <th className={cn(TH, 'w-[100px] text-right')}>Weight</th>
            {!readOnly && <th className={cn(TH, 'w-[70px]')} aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td className={cn(TD, 'text-muted-foreground')} colSpan={readOnly ? 4 : 5}>
                No items added
              </td>
            </tr>
          )}
          {items.map((it, i) => (
            <tr key={it.id}>
              <td className={TD}>
                <div className="text-foreground">{it.product || '—'}</div>
                {it.sku && <div className="text-xs text-muted-foreground">{it.sku}</div>}
              </td>
              <td className={cn(TD, 'tnum text-right')}>{fmtQty(it.qty)}</td>
              <td className={cn(TD, 'tnum text-right')}>{money(it.lineTotal)}</td>
              <td className={cn(TD, 'tnum text-right')}>{weightKg(it.weight)}</td>
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
            <td className={cn(TD, 'font-semibold')}>Grand Total</td>
            <td className={cn(TD, 'tnum text-right font-semibold')}>{fmtQty(g.qty)}</td>
            <td className={cn(TD, 'tnum text-right font-semibold')}>{money(g.total)}</td>
            <td className={cn(TD, 'tnum text-right font-semibold')}>{weightKg(g.weight)}</td>
            {!readOnly && <td className={TD} />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
