import { useCallback, useState } from 'react';

/** Multi-select state for the task table (drives the bulk toolbar). */
export function useSelection() {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = useCallback((id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  const set = useCallback((ids: string[]) => setSelected(ids), []);
  const clear = useCallback(() => setSelected([]), []);

  return { selected, toggle, set, clear };
}
