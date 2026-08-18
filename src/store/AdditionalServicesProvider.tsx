/**
 * In-memory store for the Additional Services (extra charges) catalog — mirrors
 * TasksProvider (context + reducer + useCallback action creators + useMemo value).
 * No backend; seeded from SEED_ADDITIONAL_SERVICES. This is the single source of
 * truth consumed by both the Finance config page and the create-consignment dropdown.
 */
import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { AdditionalService, AdditionalServiceInput } from '@/domain/services';
import { SEED_ADDITIONAL_SERVICES } from '@/fixtures/additionalServices';
import { genId } from '@/domain/id';

type Action =
  | { type: 'add'; service: AdditionalService }
  | { type: 'update'; id: string; patch: Partial<AdditionalServiceInput> }
  | { type: 'remove'; id: string }
  | { type: 'toggleActive'; id: string };

function reducer(state: AdditionalService[], action: Action): AdditionalService[] {
  switch (action.type) {
    case 'add':
      return [...state, action.service];
    case 'update':
      return state.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s));
    case 'remove':
      return state.filter((s) => s.id !== action.id);
    case 'toggleActive':
      return state.map((s) => (s.id === action.id ? { ...s, active: !s.active } : s));
  }
}

interface AdditionalServicesStore {
  services: AdditionalService[];
  add: (input: AdditionalServiceInput) => AdditionalService;
  update: (id: string, patch: Partial<AdditionalServiceInput>) => void;
  remove: (id: string) => void;
  toggleActive: (id: string) => void;
}

const AdditionalServicesContext = createContext<AdditionalServicesStore | null>(null);

export function AdditionalServicesProvider({ children }: { children: ReactNode }) {
  const [services, dispatch] = useReducer(reducer, SEED_ADDITIONAL_SERVICES);

  const add = useCallback((input: AdditionalServiceInput) => {
    const service: AdditionalService = { ...input, id: genId() };
    dispatch({ type: 'add', service });
    return service;
  }, []);
  const update = useCallback((id: string, patch: Partial<AdditionalServiceInput>) => {
    dispatch({ type: 'update', id, patch });
  }, []);
  const remove = useCallback((id: string) => {
    dispatch({ type: 'remove', id });
  }, []);
  const toggleActive = useCallback((id: string) => {
    dispatch({ type: 'toggleActive', id });
  }, []);

  const value = useMemo<AdditionalServicesStore>(
    () => ({ services, add, update, remove, toggleActive }),
    [services, add, update, remove, toggleActive],
  );

  return <AdditionalServicesContext.Provider value={value}>{children}</AdditionalServicesContext.Provider>;
}

export function useAdditionalServicesStore(): AdditionalServicesStore {
  const ctx = useContext(AdditionalServicesContext);
  if (!ctx) throw new Error('useAdditionalServicesStore must be used within <AdditionalServicesProvider>');
  return ctx;
}
