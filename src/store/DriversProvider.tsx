/**
 * The courier roster on the real API (`/api/drivers`).
 *
 * Writes are admin-only server-side; reads are operator+, so unlike
 * ClientsProvider this query is not gated on the role — an operator needs the
 * roster to assign work.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DRIVERS_KEY } from '@/store/TasksProvider';
import type {
  Driver,
  DriverDetail,
  DriverDocKind,
  DriverDocuments,
  DriverInput,
  DriverPatch,
} from '@/domain/driver';

export const driverKey = (id: string) => ['drivers', id] as const;

interface DriversStore {
  /** Every driver, inactive ones included, in name order. */
  drivers: Driver[];
  loading: boolean;
  error: Error | null;
  create: (input: DriverInput) => Promise<DriverDetail>;
  update: (id: string, patch: DriverPatch) => Promise<DriverDetail>;
  remove: (id: string) => Promise<void>;
  uploadDocument: (id: string, kind: DriverDocKind, file: File) => Promise<DriverDocuments>;
}

const DriversContext = createContext<DriversStore | null>(null);

export function DriversProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  // Shares DRIVERS_KEY with the assign picker's useDrivers(), so creating a
  // driver here makes them assignable there without a second fetch.
  const query = useQuery({
    queryKey: DRIVERS_KEY,
    queryFn: () => api.listDrivers({ includeInactive: 'true' }),
    staleTime: 60_000,
  });

  const invalidate = (id?: string) => {
    void qc.invalidateQueries({ queryKey: DRIVERS_KEY });
    if (id) void qc.invalidateQueries({ queryKey: driverKey(id) });
  };

  const { mutateAsync: create } = useMutation({
    mutationFn: (input: DriverInput) => api.createDriver(input),
    onSuccess: (d) => invalidate(d.id),
  });

  const { mutateAsync: update } = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DriverPatch }) =>
      api.updateDriver(id, patch),
    onSuccess: (d) => invalidate(d.id),
  });

  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => api.deleteDriver(id).then(() => undefined),
    onSuccess: () => invalidate(),
  });

  const { mutateAsync: uploadDocument } = useMutation({
    mutationFn: ({ id, kind, file }: { id: string; kind: DriverDocKind; file: File }) =>
      api.uploadDriverDocument(id, kind, file),
    // The roster carries photoUrl, so a new photo has to refresh the list too.
    onSuccess: (_d, vars) => invalidate(vars.id),
  });

  const value = useMemo<DriversStore>(
    () => ({
      drivers: query.data?.data ?? [],
      loading: query.isPending,
      error: (query.error as Error | null) ?? null,
      create: (input) => create(input),
      update: (id, patch) => update({ id, patch }),
      remove: (id) => remove(id),
      uploadDocument: (id, kind, file) => uploadDocument({ id, kind, file }),
    }),
    [query.data, query.isPending, query.error, create, update, remove, uploadDocument],
  );

  return <DriversContext.Provider value={value}>{children}</DriversContext.Provider>;
}

export function useDriversStore(): DriversStore {
  const ctx = useContext(DriversContext);
  if (!ctx) throw new Error('useDriversStore must be used within <DriversProvider>');
  return ctx;
}
