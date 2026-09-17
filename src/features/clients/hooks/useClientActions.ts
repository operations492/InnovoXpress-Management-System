import { useMemo } from 'react';

import { useToast } from '@/components/Toast';
import type { Client, ClientInput, ClientPatch } from '@/domain/client';
import { ApiError } from '@/lib/api';
import { useClientsStore } from '@/store/ClientsProvider';

function reason(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unknown error';
}

/**
 * Toasts for the client store. The store invalidates; this says so out loud,
 * and only once the server has answered.
 */
export function useClientActions() {
  const store = useClientsStore();
  const { flash } = useToast();

  return useMemo(
    () => ({
      create: async (input: ClientInput): Promise<Client | null> => {
        try {
          const client = await store.create(input);
          flash(`${client.name} created`);
          return client;
        } catch (e) {
          flash(`Could not create client: ${reason(e)}`);
          return null;
        }
      },

      save: async (client: Client, patch: ClientPatch): Promise<Client | null> => {
        try {
          const saved = await store.update(client.id, patch);
          flash(`${saved.name} saved`);
          return saved;
        } catch (e) {
          flash(`Could not save ${client.name}: ${reason(e)}`);
          return null;
        }
      },

      setActive: async (client: Client, active: boolean): Promise<boolean> => {
        try {
          await store.update(client.id, { active });
          flash(active ? `${client.name} reactivated` : `${client.name} deactivated`);
          return true;
        } catch (e) {
          flash(`Could not change status: ${reason(e)}`);
          return false;
        }
      },

      remove: async (client: Client): Promise<boolean> => {
        try {
          await store.remove(client.id);
          flash(`${client.name} deleted`);
          return true;
        } catch (e) {
          // The API's 409 already reads '"X" is used by N order(s) — deactivate
          // it instead'. Pass it through rather than invent a second wording.
          flash(`Could not delete ${client.name}: ${reason(e)}`);
          return false;
        }
      },
    }),
    [store, flash],
  );
}
