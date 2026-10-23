/**
 * Freight items on the real API (`/api/freight-items`).
 *
 * Same shape as ServiceLevelsProvider. The context key stays `items` because the
 * quote calculator and the rate builder already read it by that name.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { FreightItem, FreightItemInput, FreightItemPatch } from '@/domain/freight';

export const FREIGHT_ITEMS_KEY = ['freightItems'] as const;

interface FreightItemsStore {
  /** Every item, disabled ones included, in list order. */
  items: FreightItem[];
  loading: boolean;
  error: Error | null;
  create: (input: FreightItemInput) => Promise<FreightItem>;
  update: (id: string, patch: FreightItemPatch) => Promise<FreightItem>;
  remove: (id: string) => Promise<void>;
  toggleActive: (item: FreightItem) => Promise<FreightItem>;
}

const FreightItemsContext = createContext<FreightItemsStore | null>(null);

export function FreightItemsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: FREIGHT_ITEMS_KEY,
    queryFn: () => api.listFreightItems({ includeInactive: true }),
    staleTime: 60_000,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: FREIGHT_ITEMS_KEY });
  };

  const { mutateAsync: create } = useMutation({
    mutationFn: (input: FreightItemInput) => api.createFreightItem(input),
    onSuccess: invalidate,
  });

  const { mutateAsync: update } = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: FreightItemPatch }) =>
      api.updateFreightItem(id, patch),
    onSuccess: invalidate,
  });

  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => api.deleteFreightItem(id),
    onSuccess: invalidate,
  });

  const value = useMemo<FreightItemsStore>(
    () => ({
      items: query.data ?? [],
      loading: query.isPending,
      error: (query.error as Error | null) ?? null,
      create: (input) => create(input),
      update: (id, patch) => update({ id, patch }),
      remove: (id) => remove(id),
      toggleActive: (item) => update({ id: item.id, patch: { active: !item.active } }),
    }),
    [query.data, query.isPending, query.error, create, update, remove],
  );

  return <FreightItemsContext.Provider value={value}>{children}</FreightItemsContext.Provider>;
}

export function useFreightItemsStore(): FreightItemsStore {
  const ctx = useContext(FreightItemsContext);
  if (!ctx) {
    throw new Error('useFreightItemsStore must be used within <FreightItemsProvider>');
  }
  return ctx;
}
