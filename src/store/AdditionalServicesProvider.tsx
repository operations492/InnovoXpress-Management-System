/**
 * Additional services on the real API (`/api/additional-services`).
 *
 * Same shape as ServiceLevelsProvider: retired entries are fetched too, because
 * the admin screen lists them and a dropdown filters them out itself.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AdditionalService,
  AdditionalServiceInput,
  AdditionalServicePatch,
} from '@/domain/services';

export const ADDITIONAL_SERVICES_KEY = ['additionalServices'] as const;

interface AdditionalServicesStore {
  /** Every service, retired ones included, in list order. */
  services: AdditionalService[];
  loading: boolean;
  error: Error | null;
  create: (input: AdditionalServiceInput) => Promise<AdditionalService>;
  update: (id: string, patch: AdditionalServicePatch) => Promise<AdditionalService>;
  remove: (id: string) => Promise<void>;
  /** Convenience for the list's strikethrough toggle. */
  toggleActive: (service: AdditionalService) => Promise<AdditionalService>;
}

const AdditionalServicesContext = createContext<AdditionalServicesStore | null>(null);

export function AdditionalServicesProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ADDITIONAL_SERVICES_KEY,
    queryFn: () => api.listAdditionalServices({ includeInactive: true }),
    staleTime: 60_000,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ADDITIONAL_SERVICES_KEY });
  };

  const { mutateAsync: create } = useMutation({
    mutationFn: (input: AdditionalServiceInput) => api.createAdditionalService(input),
    onSuccess: invalidate,
  });

  const { mutateAsync: update } = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AdditionalServicePatch }) =>
      api.updateAdditionalService(id, patch),
    onSuccess: invalidate,
  });

  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => api.deleteAdditionalService(id),
    onSuccess: invalidate,
  });

  const value = useMemo<AdditionalServicesStore>(
    () => ({
      services: query.data ?? [],
      loading: query.isPending,
      error: (query.error as Error | null) ?? null,
      create: (input) => create(input),
      update: (id, patch) => update({ id, patch }),
      remove: (id) => remove(id),
      toggleActive: (service) => update({ id: service.id, patch: { active: !service.active } }),
    }),
    [query.data, query.isPending, query.error, create, update, remove],
  );

  return (
    <AdditionalServicesContext.Provider value={value}>
      {children}
    </AdditionalServicesContext.Provider>
  );
}

export function useAdditionalServicesStore(): AdditionalServicesStore {
  const ctx = useContext(AdditionalServicesContext);
  if (!ctx) {
    throw new Error(
      'useAdditionalServicesStore must be used within <AdditionalServicesProvider>',
    );
  }
  return ctx;
}
