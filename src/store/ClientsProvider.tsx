import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Client, ClientInput, ClientPatch } from '@/domain/client';
import { api } from '@/lib/api';
import { useAuth } from '@/state/AuthProvider';
import { REFERENCE_KEY } from '@/store/TasksProvider';

/**
 * Clients — the admin CRUD store.
 *
 * Mutations are deliberately toast-free and only invalidate; the toasts live in
 * useClientActions and fire after the server has answered.
 *
 * Every write also invalidates the reference query, because the consignment
 * form's client dropdown — and the sender address it prefills — is served from
 * that same /api/reference payload. Rename or retire a client and the form must
 * not go on offering what it was.
 */

export const CLIENTS_KEY = ['clients'] as const;

interface ClientsValue {
  /** Every client, inactive ones included, newest rules applied server-side. */
  clients: Client[];
  loading: boolean;
  error: Error | null;
  create: (input: ClientInput) => Promise<Client>;
  update: (id: string, patch: ClientPatch) => Promise<Client>;
  remove: (id: string) => Promise<void>;
}

const ClientsContext = createContext<ClientsValue | null>(null);

export function ClientsProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';

  const query = useQuery({
    queryKey: CLIENTS_KEY,
    queryFn: () => api.listClients({ includeInactive: true }),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: CLIENTS_KEY });
    void qc.invalidateQueries({ queryKey: REFERENCE_KEY });
  };

  const createM = useMutation({
    mutationFn: (input: ClientInput) => api.createClient(input),
    onSuccess: invalidate,
  });

  const updateM = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ClientPatch }) => api.updateClient(id, patch),
    onSuccess: invalidate,
  });

  const removeM = useMutation({
    mutationFn: (id: string) => api.deleteClient(id),
    onSuccess: invalidate,
  });

  const { mutateAsync: create } = createM;
  const { mutateAsync: update } = updateM;
  const { mutateAsync: remove } = removeM;

  const value = useMemo<ClientsValue>(
    () => ({
      clients: query.data ?? [],
      // A disabled query is pending forever; without the guard a non-admin would
      // sit on a spinner rather than the "not available" card.
      loading: isAdmin && query.isPending,
      error: (query.error as Error | null) ?? null,
      create: (input) => create(input),
      update: (id, patch) => update({ id, patch }),
      remove: (id) => remove(id),
    }),
    [query.data, query.isPending, query.error, isAdmin, create, update, remove],
  );

  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
}

export function useClientsStore(): ClientsValue {
  const ctx = useContext(ClientsContext);
  if (!ctx) throw new Error('useClientsStore must be used within <ClientsProvider>');
  return ctx;
}
