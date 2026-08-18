import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

/**
 * Every test runs signed in.
 *
 * `AuthProvider` renders the login screen instead of the app when there is no
 * session, and `api.ts` throws before it fetches. Without a stub here, every
 * page smoke test would assert against a login form and every API test would
 * fail on a missing token.
 *
 * Mocked globally rather than per file because it is a precondition of the app
 * existing at all, not a behaviour any single test is exercising. A test that
 * genuinely cares about the signed-out state overrides this with its own
 * `vi.mock`.
 */

const SESSION = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'test-user-id', email: 'admin@test.local' },
};

const ME = {
  id: 'test-user-id',
  email: 'admin@test.local',
  name: 'Test Admin',
  role: 'admin',
  active: true,
  driver: null,
};

/**
 * A default `fetch` that answers only the one call every mounted app makes.
 *
 * `AuthProvider` fetches `/api/auth/me` to learn the signed-in person's role;
 * with no answer it assumes the account is unusable and drops to the login
 * screen, so a page smoke test would assert against a login form.
 *
 * Anything else 404s, exactly as an unstubbed call did before. A test that
 * cares about other endpoints replaces this wholesale with `vi.stubGlobal`.
 */
vi.stubGlobal(
  'fetch',
  vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/auth/me')) {
      return Promise.resolve(
        new Response(JSON.stringify({ user: ME }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: `unstubbed ${url}` } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }),
);

/**
 * Realtime is stubbed as deliberately as auth, and for the same reason.
 *
 * `ChatProvider` is mounted app-wide, so every test that renders `AppProviders`
 * touches it — including the users and finance suites, which have nothing to do
 * with chat. Without a `realtime` key here, `supabase.realtime.setAuth()` throws
 * `Cannot read properties of undefined` during mount and takes those suites down
 * with an error that points nowhere near the cause.
 *
 * `subscribe` deliberately never invokes its status callback: firing SUBSCRIBED
 * would push a state update outside `act()` in every unrelated test. A test that
 * wants live delivery drives it explicitly with `emitChatBroadcast`.
 */
const realtimeStub = vi.hoisted(() => {
  // Keyed by event name: the app registers one handler per event on the same
  // channel, and delivering a payload to all of them would fire the wrong one.
  const handlers = new Map<string, Set<(envelope: { payload: unknown }) => void>>();

  const channel = {
    on: (
      _type: string,
      filter: { event?: string } | undefined,
      handler: (e: { payload: unknown }) => void,
    ) => {
      const key = filter?.event ?? '*';
      const bucket = handlers.get(key) ?? new Set();
      bucket.add(handler);
      handlers.set(key, bucket);
      return channel;
    },
    subscribe: () => channel,
    unsubscribe: () => {},
  };

  return {
    channel,
    emit: (event: string, payload: unknown) => {
      for (const handler of handlers.get(event) ?? []) handler({ payload });
    },
  };
});

/** Test seam: deliver an event as though it had arrived over the socket. */
export const emitChatBroadcast = realtimeStub.emit;

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })),
      refreshSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })),
      signInWithPassword: vi.fn(async () => ({ data: { session: SESSION }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    realtime: {
      setAuth: vi.fn(async () => undefined),
    },
    channel: vi.fn(() => realtimeStub.channel),
    removeChannel: vi.fn(async () => 'ok'),
  },
}));
