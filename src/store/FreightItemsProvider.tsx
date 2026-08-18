/**
 * In-memory store for Freight Items — mirrors the other feature stores (context +
 * reducer + useCallback actions + useMemo value). No backend; seeded from
 * SEED_FREIGHT_ITEMS. A reusable lookup that rate cards / services can reference later.
 */
import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { FreightItem, FreightItemInput } from '@/domain/freight';
import { SEED_FREIGHT_ITEMS } from '@/fixtures/freightItems';
import { genId } from '@/domain/id';

type Action =
  | { type: 'add'; item: FreightItem }
  | { type: 'update'; id: string; patch: Partial<FreightItemInput> }
  | { type: 'remove'; id: string };

function reducer(state: FreightItem[], action: Action): FreightItem[] {
  switch (action.type) {
    case 'add':
      return [...state, action.item];
    case 'update':
      return state.map((f) => (f.id === action.id ? { ...f, ...action.patch } : f));
    case 'remove':
      return state.filter((f) => f.id !== action.id);
  }
}

interface FreightItemsStore {
  items: FreightItem[];
  add: (input: FreightItemInput) => FreightItem;
  update: (id: string, patch: Partial<FreightItemInput>) => void;
  remove: (id: string) => void;
}

const FreightItemsContext = createContext<FreightItemsStore | null>(null);

export function FreightItemsProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(reducer, SEED_FREIGHT_ITEMS);

  const add = useCallback((input: FreightItemInput) => {
    const item: FreightItem = { ...input, id: genId() };
    dispatch({ type: 'add', item });
    return item;
  }, []);
  const update = useCallback((id: string, patch: Partial<FreightItemInput>) => {
    dispatch({ type: 'update', id, patch });
  }, []);
  const remove = useCallback((id: string) => {
    dispatch({ type: 'remove', id });
  }, []);

  const value = useMemo<FreightItemsStore>(() => ({ items, add, update, remove }), [items, add, update, remove]);

  return <FreightItemsContext.Provider value={value}>{children}</FreightItemsContext.Provider>;
}

export function useFreightItemsStore(): FreightItemsStore {
  const ctx = useContext(FreightItemsContext);
  if (!ctx) throw new Error('useFreightItemsStore must be used within <FreightItemsProvider>');
  return ctx;
}
