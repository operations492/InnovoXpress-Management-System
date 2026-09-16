/**
 * Service level actions with toasts. The store only invalidates; this is where
 * the operator hears what happened, and only after the server has answered.
 * Same split as `features/users/hooks/useUserActions.ts`.
 */
import { useMemo } from 'react';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useServiceLevelsStore } from '@/store/ServiceLevelsProvider';
import type { ServiceLevel, ServiceLevelInput, ServiceLevelPatch } from '@/domain/serviceLevel';

function reason(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unknown error';
}

export function useServiceLevelActions() {
  const store = useServiceLevelsStore();
  const { flash } = useToast();

  return useMemo(
    () => ({
      create: async (input: ServiceLevelInput): Promise<ServiceLevel | null> => {
        try {
          const level = await store.create(input);
          flash(`${level.name} created`);
          return level;
        } catch (e) {
          flash(`Could not create service level: ${reason(e)}`);
          return null;
        }
      },

      save: async (level: ServiceLevel, patch: ServiceLevelPatch): Promise<ServiceLevel | null> => {
        try {
          const saved = await store.update(level.id, patch);
          const verb = patch.active === false ? 'retired' : patch.active === true ? 'restored' : 'saved';
          flash(`${saved.name} ${verb}`);
          return saved;
        } catch (e) {
          flash(`Could not save ${level.name}: ${reason(e)}`);
          return null;
        }
      },

      /** The API's 409 already reads "used by N order(s) — deactivate it instead"; pass it through. */
      remove: async (level: ServiceLevel): Promise<boolean> => {
        try {
          await store.remove(level.id);
          flash(`${level.name} deleted`);
          return true;
        } catch (e) {
          flash(`Could not delete ${level.name}: ${reason(e)}`);
          return false;
        }
      },
    }),
    [store, flash],
  );
}
