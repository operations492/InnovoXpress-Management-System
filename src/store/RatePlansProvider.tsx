/**
 * Rate plans on the real API (`/api/rate-plans`).
 *
 * The list is plan headers only; the priced grid comes from `useRatePlan(id)`,
 * which fetches the plan together with every active catalogue entry so the
 * editor's four tabs can never disagree about what exists.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  RatePlan,
  RatePlanDetail,
  RatePlanInput,
  RatePlanItemsInput,
  RatePlanPatch,
} from '@/domain/ratePlan';

export const RATE_PLANS_KEY = ['ratePlans'] as const;
export const ratePlanKey = (id: string) => ['ratePlans', id] as const;

interface RatePlansStore {
  /** Every plan, retired ones included. */
  plans: RatePlan[];
  loading: boolean;
  error: Error | null;
  create: (input: RatePlanInput) => Promise<RatePlan>;
  update: (id: string, patch: RatePlanPatch) => Promise<RatePlan>;
  remove: (id: string) => Promise<void>;
  setItems: (id: string, items: RatePlanItemsInput) => Promise<RatePlanDetail>;
}

const RatePlansContext = createContext<RatePlansStore | null>(null);

export function RatePlansProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: RATE_PLANS_KEY,
    queryFn: () => api.listRatePlans({ includeInactive: true }),
    staleTime: 60_000,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: RATE_PLANS_KEY });
  };

  const { mutateAsync: create } = useMutation({
    mutationFn: (input: RatePlanInput) => api.createRatePlan(input),
    onSuccess: invalidate,
  });

  const { mutateAsync: update } = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RatePlanPatch }) =>
      api.updateRatePlan(id, patch),
    onSuccess: (plan) => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ratePlanKey(plan.id) });
    },
  });

  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => api.deleteRatePlan(id),
    onSuccess: invalidate,
  });

  const { mutateAsync: setItems } = useMutation({
    mutationFn: ({ id, items }: { id: string; items: RatePlanItemsInput }) =>
      api.setRatePlanItems(id, items),
    onSuccess: (detail) => {
      qc.setQueryData(ratePlanKey(detail.id), detail);
    },
  });

  const value = useMemo<RatePlansStore>(
    () => ({
      plans: query.data ?? [],
      loading: query.isPending,
      error: (query.error as Error | null) ?? null,
      create: (input) => create(input),
      update: (id, patch) => update({ id, patch }),
      remove: (id) => remove(id),
      setItems: (id, items) => setItems({ id, items }),
    }),
    [query.data, query.isPending, query.error, create, update, remove, setItems],
  );

  return <RatePlansContext.Provider value={value}>{children}</RatePlansContext.Provider>;
}

export function useRatePlansStore(): RatePlansStore {
  const ctx = useContext(RatePlansContext);
  if (!ctx) throw new Error('useRatePlansStore must be used within <RatePlansProvider>');
  return ctx;
}

/** One plan with its priced grid — what the editor renders. */
export function useRatePlan(id: string | undefined) {
  return useQuery({
    queryKey: ratePlanKey(id ?? ''),
    queryFn: () => api.getRatePlan(id as string),
    enabled: Boolean(id),
  });
}
