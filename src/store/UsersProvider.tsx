import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CreateUserPayload, UpdateUserPayload, UserDto } from '@/lib/api';
import { useAuth } from '@/state/AuthProvider';

/**
 * Server state for user administration.
 *
 * Mutations are deliberately toast-free and only invalidate — toasts belong one
 * layer up in `useUserActions`, so they fire after the server has answered
 * rather than optimistically. Same split as TasksProvider / useTaskActions.
 */

export const USERS_KEY = ['users'] as const;

interface UsersValue {
  users: UserDto[];
  loading: boolean;
  error: Error | null;
  create: (payload: CreateUserPayload) => Promise<UserDto>;
  update: (id: string, payload: UpdateUserPayload) => Promise<UserDto>;
  remove: (id: string) => Promise<void>;
}

const UsersContext = createContext<UsersValue | null>(null);

export function UsersProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { user } = useAuth();

  // Only an admin may call this endpoint at all — firing it as an operator
  // would produce a guaranteed 403 on every page of the app.
  const isAdmin = user.role === 'admin';

  const query = useQuery({
    queryKey: USERS_KEY,
    queryFn: () => api.listUsers({ includeInactive: 'true' }).then((r) => r.data),
    enabled: isAdmin,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: USERS_KEY });
  };

  const createM = useMutation({
    mutationFn: (payload: CreateUserPayload) => api.createUser(payload).then((r) => r.user),
    onSuccess: invalidate,
  });

  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      api.updateUser(id, payload).then((r) => r.user),
    onSuccess: invalidate,
  });

  const removeM = useMutation({
    mutationFn: (id: string) => api.deleteUser(id).then(() => undefined),
    onSuccess: invalidate,
  });

  const value = useMemo<UsersValue>(
    () => ({
      users: query.data ?? [],
      loading: isAdmin && query.isPending,
      error: (query.error as Error | null) ?? null,
      create: (payload) => createM.mutateAsync(payload),
      update: (id, payload) => updateM.mutateAsync({ id, payload }),
      remove: async (id) => {
        await removeM.mutateAsync(id);
      },
    }),
    [query.data, query.isPending, query.error, isAdmin, createM, updateM, removeM],
  );

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
}

export function useUsersStore(): UsersValue {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error('useUsersStore must be used inside UsersProvider');
  return ctx;
}
