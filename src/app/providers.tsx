import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider } from '@/state/AuthProvider';
import { TasksProvider } from '@/store/TasksProvider';
import { UsersProvider } from '@/store/UsersProvider';
import { ChatProvider } from '@/store/ChatProvider';
import { DispatchRealtimeProvider } from '@/store/DispatchRealtimeProvider';
import { AdditionalServicesProvider } from '@/store/AdditionalServicesProvider';
import { FreightItemsProvider } from '@/store/FreightItemsProvider';
import { ServiceLevelsProvider } from '@/store/ServiceLevelsProvider';
import { ServiceZonesProvider } from '@/store/ServiceZonesProvider';
import { TaxRatesProvider } from '@/store/TaxRatesProvider';
import { RateLeviesProvider } from '@/store/RateLeviesProvider';
import { RatePlansProvider } from '@/store/RatePlansProvider';

/**
 * Compose all app-wide providers.
 *
 * QueryClientProvider is outermost so every store below it can run queries and so
 * the cache survives route changes. ToastProvider sits above TasksProvider
 * because the task mutations raise toasts on failure.
 *
 * AuthProvider sits BELOW BrowserRouter (it may need to navigate) and ABOVE
 * every store — because the stores fire queries the moment they mount. Signed
 * out, AuthProvider renders the login screen instead of its children, so
 * nothing below ever mounts without a session and the app never shows a wall of
 * 401s to someone who has not signed in yet.
 *
 * ChatProvider sits directly under AuthProvider because it holds the Realtime
 * socket, which must survive route changes and must not exist while signed out.
 * It deliberately runs no queries of its own — the chat queries live in the
 * feature so they only fire on /chat.
 *
 * DispatchRealtimeProvider sits directly under ChatProvider for exactly the same
 * reason: it holds a Realtime subscription that must survive route changes and
 * must not exist while signed out. It too runs no queries of its own — the
 * dispatch-map queries live in the feature so they only fire on /map.
 *
 * The finance stores below remain in-memory fixtures — out of scope for the
 * consignment wiring.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <ChatProvider>
              <DispatchRealtimeProvider>
                <UsersProvider>
                  <TasksProvider>
                    <AdditionalServicesProvider>
                      <FreightItemsProvider>
                        <ServiceLevelsProvider>
                          <ServiceZonesProvider>
                            <TaxRatesProvider>
                              <RateLeviesProvider>
                                <RatePlansProvider>{children}</RatePlansProvider>
                              </RateLeviesProvider>
                            </TaxRatesProvider>
                          </ServiceZonesProvider>
                        </ServiceLevelsProvider>
                      </FreightItemsProvider>
                    </AdditionalServicesProvider>
                  </TasksProvider>
                </UsersProvider>
              </DispatchRealtimeProvider>
            </ChatProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
