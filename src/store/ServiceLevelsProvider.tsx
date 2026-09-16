/**
 * Service levels, straight from /api/service-levels through TanStack Query.
 *
 * Keeps the `useServiceLevelsStore()` name and the `{ levels, create, update,
 * remove }` shape the finance pages already consume, so swapping the in-memory
 * fixture store for the API changed no caller. Mutations are toast-free and
 * only invalidate — toasts live in `features/finance/hooks/useServiceLevelActions.ts`
 * and fire after the server answers, the same split as users and tasks.
 *
 * Every write also invalidates the reference query: the consignment form's
 * Service level dropdown is fed from there and must not offer a level that was
 * just retired.
 */
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ServiceLevel, ServiceLevelInput, ServiceLevelPatch } from '@/domain/serviceLevel';
import { REFERENCE_KEY } from '@/store/TasksProvider';

export const SERVICE_LEVELS_KEY = ['serviceLevels'] as const;

interface ServiceLevelsStore {
  /** Every level, retired ones included, in dropdown order. */
  levels: ServiceLevel[];
  loading: boolean;
  error: Error | null;
  create: (input: ServiceLevelInput) => Promise<ServiceLevel>;
  update: (id: string, patch: ServiceLevelPatch) => Promise<ServiceLevel>;
  remove: (id: string) => Promise<void>;
}

const ServiceLevelsContext = createContext<ServiceLevelsStore | null>(null);

export function ServiceLevelsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  // Retired levels are included on purpose: the admin screen has to be able to
  // find one to bring it back. The dropdown reads the reference query instead,
  // which is active-only.
  const query = useQuery({
    queryKey: SERVICE_LEVELS_KEY,
    queryFn: () => api.listServiceLevels({ includeInactive: true }),
    staleTime: 60_000,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: SERVICE_LEVELS_KEY });
    void qc.invalidateQueries({ queryKey: REFERENCE_KEY });
  };

  const createM = useMutation({
    mutationFn: (input: ServiceLevelInput) => api.createServiceLevel(input),
    onSuccess: invalidate,
  });
  const updateM = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ServiceLevelPatch }) => api.updateServiceLevel(id, patch),
    onSuccess: invalidate,
  });
  const removeM = useMutation({
    mutationFn: (id: string) => api.deleteServiceLevel(id),
    onSuccess: invalidate,
  });

  const { mutateAsync: create } = createM;
  const { mutateAsync: update } = updateM;
  const { mutateAsync: remove } = removeM;

  const value = useMemo<ServiceLevelsStore>(
    () => ({
      levels: query.data ?? [],
      loading: query.isPending,
      error: (query.error as Error | null) ?? null,
      create: (input) => create(input),
      update: (id, patch) => update({ id, patch }),
      remove: (id) => remove(id),
    }),
    [query.data, query.isPending, query.error, create, update, remove],
  );

  return <ServiceLevelsContext.Provider value={value}>{children}</ServiceLevelsContext.Provider>;
}

export function useServiceLevelsStore(): ServiceLevelsStore {
  const ctx = useContext(ServiceLevelsContext);
  if (!ctx) throw new Error('useServiceLevelsStore must be used within <ServiceLevelsProvider>');
  return ctx;
}
