import { useCallback, useState } from 'react';
import type { TaskItem } from '@/domain/types';
import type { ItemFormValues } from '@/domain/schemas';
import { buildItem } from '@/domain/mutations';

function toItemForm(it: TaskItem): ItemFormValues {
  return {
    productId: it.productId,
    product: it.product,
    qty: String(it.qty),
    lineTotal: String(it.lineTotal),
    weight: String(it.weight),
    barcode: it.barcode,
    pkg: it.pkg,
    orderId: it.orderId,
  };
}

/** Manages the items list + add/edit-item modal for New Task and the Task Card. */
export function useItemsEditor(seed: TaskItem[]) {
  const [items, setItems] = useState<TaskItem[]>(seed);
  const [open, setOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const reset = useCallback((next: TaskItem[]) => {
    setItems(next);
    setOpen(false);
    setEditIndex(null);
  }, []);

  const openAdd = useCallback(() => {
    setEditIndex(null);
    setOpen(true);
  }, []);

  const openEdit = useCallback((i: number) => {
    setEditIndex(i);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const remove = useCallback((i: number) => {
    setItems((arr) => arr.filter((_, idx) => idx !== i));
  }, []);

  const commit = useCallback(
    (values: ItemFormValues, another: boolean) => {
      setItems((arr) => {
        const built = buildItem(values, editIndex != null ? arr[editIndex].id : undefined);
        return editIndex != null ? arr.map((it, idx) => (idx === editIndex ? built : it)) : [...arr, built];
      });
      if (another) setEditIndex(null);
      else setOpen(false);
    },
    [editIndex],
  );

  const initial = editIndex != null ? toItemForm(items[editIndex]) : null;

  return { items, reset, open, editIndex, initial, openAdd, openEdit, close, remove, commit };
}
