import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { genId } from '@/domain/id';
import type { TaxRate, TaxRateInput } from '@/domain/taxRate';
import { SEED_TAX_RATES } from '@/fixtures/taxRates';

type Action =
  | { type: 'add'; rate: TaxRate }
  | { type: 'update'; id: string; patch: Partial<TaxRateInput> }
  | { type: 'remove'; id: string };

function reducer(state: TaxRate[], action: Action): TaxRate[] {
  switch (action.type) {
    case 'add':
      return [...state, action.rate];
    case 'update':
      return state.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r));
    case 'remove':
      return state.filter((r) => r.id !== action.id);
  }
}

interface TaxRatesStore {
  rates: TaxRate[];
  add: (input: TaxRateInput) => TaxRate;
  update: (id: string, patch: Partial<TaxRateInput>) => void;
  remove: (id: string) => void;
}

const TaxRatesContext = createContext<TaxRatesStore | null>(null);

export function TaxRatesProvider({ children }: { children: ReactNode }) {
  const [rates, dispatch] = useReducer(reducer, SEED_TAX_RATES);

  const add = useCallback((input: TaxRateInput) => {
    const rate: TaxRate = { ...input, id: genId() };
    dispatch({ type: 'add', rate });
    return rate;
  }, []);
  const update = useCallback(
    (id: string, patch: Partial<TaxRateInput>) => dispatch({ type: 'update', id, patch }),
    [],
  );
  const remove = useCallback((id: string) => dispatch({ type: 'remove', id }), []);

  const value = useMemo<TaxRatesStore>(() => ({ rates, add, update, remove }), [rates, add, update, remove]);
  return <TaxRatesContext.Provider value={value}>{children}</TaxRatesContext.Provider>;
}

export function useTaxRatesStore(): TaxRatesStore {
  const ctx = useContext(TaxRatesContext);
  if (!ctx) throw new Error('useTaxRatesStore must be used within <TaxRatesProvider>');
  return ctx;
}
