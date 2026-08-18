import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { genId } from '@/domain/id';
import type { RateLevy, RateLevyInput } from '@/domain/rateLevy';
import { SEED_RATE_LEVIES } from '@/fixtures/rateLevies';

type Action =
  | { type: 'add'; levy: RateLevy }
  | { type: 'update'; id: string; patch: Partial<RateLevyInput> }
  | { type: 'remove'; id: string };

function reducer(state: RateLevy[], action: Action): RateLevy[] {
  switch (action.type) {
    case 'add':
      return [...state, action.levy];
    case 'update':
      return state.map((l) => (l.id === action.id ? { ...l, ...action.patch } : l));
    case 'remove':
      // also detach any card that compounds onto the removed one
      return state
        .filter((l) => l.id !== action.id)
        .map((l) => (l.addToBaseId === action.id ? { ...l, addToBaseId: null } : l));
  }
}

interface RateLeviesStore {
  levies: RateLevy[];
  add: (input: RateLevyInput) => RateLevy;
  update: (id: string, patch: Partial<RateLevyInput>) => void;
  remove: (id: string) => void;
}

const RateLeviesContext = createContext<RateLeviesStore | null>(null);

export function RateLeviesProvider({ children }: { children: ReactNode }) {
  const [levies, dispatch] = useReducer(reducer, SEED_RATE_LEVIES);

  const add = useCallback((input: RateLevyInput) => {
    const levy: RateLevy = { ...input, id: genId() };
    dispatch({ type: 'add', levy });
    return levy;
  }, []);
  const update = useCallback(
    (id: string, patch: Partial<RateLevyInput>) => dispatch({ type: 'update', id, patch }),
    [],
  );
  const remove = useCallback((id: string) => dispatch({ type: 'remove', id }), []);

  const value = useMemo<RateLeviesStore>(() => ({ levies, add, update, remove }), [levies, add, update, remove]);
  return <RateLeviesContext.Provider value={value}>{children}</RateLeviesContext.Provider>;
}

export function useRateLeviesStore(): RateLeviesStore {
  const ctx = useContext(RateLeviesContext);
  if (!ctx) throw new Error('useRateLeviesStore must be used within <RateLeviesProvider>');
  return ctx;
}
