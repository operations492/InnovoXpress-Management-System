import { useMemo } from 'react';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useDriversStore } from '@/store/DriversProvider';
import type {
  Driver,
  DriverDetail,
  DriverDocKind,
  DriverDocuments,
  DriverInput,
  DriverPatch,
} from '@/domain/driver';

/** Server wording is passed through, not reworded — a 409 explains itself. */
function reason(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unknown error';
}

/**
 * Toasts live here, not in the provider's mutations, so the store stays usable
 * from anywhere while the console still reports what happened. Nothing throws —
 * failures come back as null/false.
 */
export function useDriverActions() {
  const store = useDriversStore();
  const { flash } = useToast();

  return useMemo(
    () => ({
      create: async (input: DriverInput): Promise<DriverDetail | null> => {
        try {
          const created = await store.create(input);
          flash(`${created.name} added to the roster`);
          return created;
        } catch (e) {
          flash(`Could not add driver: ${reason(e)}`);
          return null;
        }
      },

      save: async (driver: Driver, patch: DriverPatch): Promise<DriverDetail | null> => {
        try {
          const saved = await store.update(driver.id, patch);
          flash(`${saved.name} saved`);
          return saved;
        } catch (e) {
          flash(`Could not save ${driver.name}: ${reason(e)}`);
          return null;
        }
      },

      setActive: async (driver: Driver, active: boolean): Promise<DriverDetail | null> => {
        try {
          const saved = await store.update(driver.id, { active });
          // Deactivating also clocks them off, server-side.
          flash(active ? `${driver.name} reactivated` : `${driver.name} deactivated and clocked off`);
          return saved;
        } catch (e) {
          flash(`Could not change status: ${reason(e)}`);
          return null;
        }
      },

      remove: async (driver: Driver): Promise<boolean> => {
        try {
          await store.remove(driver.id);
          flash(`${driver.name} removed from the roster`);
          return true;
        } catch (e) {
          flash(`Could not remove ${driver.name}: ${reason(e)}`);
          return false;
        }
      },

      upload: async (
        driver: Driver,
        kind: DriverDocKind,
        file: File,
      ): Promise<DriverDocuments | null> => {
        try {
          const docs = await store.uploadDocument(driver.id, kind, file);
          flash(kind === 'photo' ? 'Photo updated' : 'ID card updated');
          return docs;
        } catch (e) {
          flash(`Could not upload: ${reason(e)}`);
          return null;
        }
      },
    }),
    [store, flash],
  );
}
