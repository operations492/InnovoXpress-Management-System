/**
 * In-memory store for Consignment Service Levels — mirrors the other feature stores
 * (context + reducer + useCallback actions + useMemo value). No backend; seeded from
 * SEED_SERVICE_LEVELS. A reusable lookup that consignments / rate cards reference later.
 */
import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { ServiceLevel, ServiceLevelInput } from '@/domain/serviceLevel';
import { SEED_SERVICE_LEVELS } from '@/fixtures/serviceLevels';
import { genId } from '@/domain/id';

type Action =
  | { type: 'add'; level: ServiceLevel }
  | { type: 'update'; id: string; patch: Partial<ServiceLevelInput> }
  | { type: 'remove'; id: string };

function reducer(state: ServiceLevel[], action: Action): ServiceLevel[] {
  switch (action.type) {
    case 'add':
      return [...state, action.level];
    case 'update':
      return state.map((l) => (l.id === action.id ? { ...l, ...action.patch } : l));
    case 'remove':
      // Also detach any children that pointed at the removed level.
      return state
        .filter((l) => l.id !== action.id)
        .map((l) => (l.parentId === action.id ? { ...l, parentId: null } : l));
  }
}

interface ServiceLevelsStore {
  levels: ServiceLevel[];
  add: (input: ServiceLevelInput) => ServiceLevel;
  update: (id: string, patch: Partial<ServiceLevelInput>) => void;
  remove: (id: string) => void;
}

const ServiceLevelsContext = createContext<ServiceLevelsStore | null>(null);

export function ServiceLevelsProvider({ children }: { children: ReactNode }) {
  const [levels, dispatch] = useReducer(reducer, SEED_SERVICE_LEVELS);

  const add = useCallback((input: ServiceLevelInput) => {
    const level: ServiceLevel = { ...input, id: genId() };
    dispatch({ type: 'add', level });
    return level;
  }, []);
  const update = useCallback((id: string, patch: Partial<ServiceLevelInput>) => {
    dispatch({ type: 'update', id, patch });
  }, []);
  const remove = useCallback((id: string) => {
    dispatch({ type: 'remove', id });
  }, []);

  const value = useMemo<ServiceLevelsStore>(() => ({ levels, add, update, remove }), [levels, add, update, remove]);

  return <ServiceLevelsContext.Provider value={value}>{children}</ServiceLevelsContext.Provider>;
}

export function useServiceLevelsStore(): ServiceLevelsStore {
  const ctx = useContext(ServiceLevelsContext);
  if (!ctx) throw new Error('useServiceLevelsStore must be used within <ServiceLevelsProvider>');
  return ctx;
}
