import { useCallback, useMemo, useState } from 'react';
import { COLUMNS } from '../tasks.types';

/** Column visibility + order state for the table, driven by Table Settings. */
export function useTableColumns() {
  const [order, setOrder] = useState<string[]>(() => COLUMNS.map((c) => c.key));
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.default])),
  );

  const toggle = useCallback((key: string) => {
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  }, []);

  const reset = useCallback(() => {
    setOrder(COLUMNS.map((c) => c.key));
    setVisible(Object.fromEntries(COLUMNS.map((c) => [c.key, c.default])));
  }, []);

  const move = useCallback((key: string, dir: -1 | 1) => {
    setOrder((o) => {
      const i = o.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const visibleKeys = useMemo(() => order.filter((k) => visible[k]), [order, visible]);

  return { order, visible, visibleKeys, toggle, reset, move };
}
