import { useMemo } from 'react';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import type { CreateUserPayload, UpdateUserPayload, UserDto } from '@/lib/api';
import { useUsersStore } from '@/store/UsersProvider';

/**
 * The single seam the Users screen calls.
 *
 * Toasts fire AFTER the server answers, never before — and they surface the
 * backend's own message, which is already plain English for the cases that
 * matter ("This is the last active admin — promote someone else first").
 */

function reason(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unknown error';
}

export function useUserActions() {
  const store = useUsersStore();
  const { flash } = useToast();

  return useMemo(
    () => ({
      create: async (payload: CreateUserPayload): Promise<UserDto | null> => {
        try {
          const user = await store.create(payload);
          flash(`${user.name} created`);
          return user;
        } catch (e) {
          flash(`Could not create user: ${reason(e)}`);
          return null;
        }
      },

      update: async (id: string, payload: UpdateUserPayload, label = 'User'): Promise<boolean> => {
        try {
          await store.update(id, payload);
          flash(`${label} updated`);
          return true;
        } catch (e) {
          flash(`Could not update: ${reason(e)}`);
          return false;
        }
      },

      setActive: async (user: UserDto, active: boolean): Promise<boolean> => {
        try {
          await store.update(user.id, { active });
          flash(active ? `${user.name} reactivated` : `${user.name} deactivated`);
          return true;
        } catch (e) {
          flash(`Could not change status: ${reason(e)}`);
          return false;
        }
      },

      remove: async (user: UserDto): Promise<boolean> => {
        try {
          await store.remove(user.id);
          flash(
            user.driver
              ? `${user.name}'s login deleted — their driver record and history remain`
              : `${user.name} deleted`,
          );
          return true;
        } catch (e) {
          flash(`Could not delete: ${reason(e)}`);
          return false;
        }
      },
    }),
    [store, flash],
  );
}
