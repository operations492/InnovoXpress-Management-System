import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { genId } from '@/domain/id';
import type { RatePlan, RatePlanInput, RateVersion } from '@/domain/ratePlan';
import { SEED_RATE_PLANS } from '@/fixtures/ratePlans';

type Action =
  | { type: 'add'; plan: RatePlan }
  | { type: 'update'; id: string; patch: Partial<RatePlanInput> }
  | { type: 'remove'; id: string }
  | { type: 'addVersion'; planId: string; version: RateVersion }
  | { type: 'updateVersion'; planId: string; versionId: string; patch: Partial<RateVersion> }
  | { type: 'removeVersion'; planId: string; versionId: string };

function withVersions(plan: RatePlan, fn: (v: RateVersion[]) => RateVersion[]): RatePlan {
  return { ...plan, versions: fn(plan.versions) };
}

function reducer(state: RatePlan[], action: Action): RatePlan[] {
  switch (action.type) {
    case 'add':
      return [...state, action.plan];
    case 'update':
      return state.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p));
    case 'remove':
      // detach any plan that falls back to the removed one
      return state
        .filter((p) => p.id !== action.id)
        .map((p) => (p.fallbackPlanId === action.id ? { ...p, fallbackPlanId: null } : p));
    case 'addVersion':
      return state.map((p) => (p.id === action.planId ? withVersions(p, (vs) => [...vs, action.version]) : p));
    case 'updateVersion':
      return state.map((p) =>
        p.id === action.planId
          ? withVersions(p, (vs) => vs.map((v) => (v.id === action.versionId ? { ...v, ...action.patch } : v)))
          : p,
      );
    case 'removeVersion':
      return state.map((p) =>
        p.id === action.planId ? withVersions(p, (vs) => vs.filter((v) => v.id !== action.versionId)) : p,
      );
  }
}

interface RatePlansStore {
  plans: RatePlan[];
  add: (input: RatePlanInput) => RatePlan;
  update: (id: string, patch: Partial<RatePlanInput>) => void;
  remove: (id: string) => void;
  addVersion: (planId: string, version: RateVersion) => void;
  updateVersion: (planId: string, versionId: string, patch: Partial<RateVersion>) => void;
  removeVersion: (planId: string, versionId: string) => void;
}

const RatePlansContext = createContext<RatePlansStore | null>(null);

export function RatePlansProvider({ children }: { children: ReactNode }) {
  const [plans, dispatch] = useReducer(reducer, SEED_RATE_PLANS);

  const add = useCallback((input: RatePlanInput) => {
    const plan: RatePlan = { ...input, id: genId() };
    dispatch({ type: 'add', plan });
    return plan;
  }, []);
  const update = useCallback((id: string, patch: Partial<RatePlanInput>) => dispatch({ type: 'update', id, patch }), []);
  const remove = useCallback((id: string) => dispatch({ type: 'remove', id }), []);
  const addVersion = useCallback(
    (planId: string, version: RateVersion) => dispatch({ type: 'addVersion', planId, version }),
    [],
  );
  const updateVersion = useCallback(
    (planId: string, versionId: string, patch: Partial<RateVersion>) =>
      dispatch({ type: 'updateVersion', planId, versionId, patch }),
    [],
  );
  const removeVersion = useCallback(
    (planId: string, versionId: string) => dispatch({ type: 'removeVersion', planId, versionId }),
    [],
  );

  const value = useMemo<RatePlansStore>(
    () => ({ plans, add, update, remove, addVersion, updateVersion, removeVersion }),
    [plans, add, update, remove, addVersion, updateVersion, removeVersion],
  );
  return <RatePlansContext.Provider value={value}>{children}</RatePlansContext.Provider>;
}

export function useRatePlansStore(): RatePlansStore {
  const ctx = useContext(RatePlansContext);
  if (!ctx) throw new Error('useRatePlansStore must be used within <RatePlansProvider>');
  return ctx;
}
