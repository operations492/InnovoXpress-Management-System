import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import type { MeDto } from '@/lib/api';
import { LoginPage } from '@/features/auth/LoginPage';

/**
 * Who is using the console.
 *
 * Supabase answers "is this person real". It has no idea what they are ALLOWED
 * to do — role and the active flag live in our own `users` table — so signing in
 * is two steps: authenticate, then fetch the profile from `GET /api/auth/me`.
 *
 * This provider renders the login screen INSTEAD of its children while signed
 * out. That is deliberate: `TasksProvider` and the other stores fire queries the
 * moment they mount, so letting them mount without a session would produce a
 * wall of 401s before the user has typed anything.
 *
 * It also owns the query cache's lifetime. The `QueryClient` is a module-level
 * singleton, so it outlives any session: without an explicit reset, signing out
 * and back in as somebody else lands the new person on top of the previous one's
 * cached rows — and, worse, on top of the 401s that the old session's in-flight
 * queries recorded as they tore down. Since 4xx never retries, those stored
 * failures are what made a screen come up empty until a hard refresh built a
 * fresh client.
 */

export type SignInResult =
  | { ok: true }
  | { ok: false; message: string };

interface AuthValue {
  user: MeDto;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<MeDto | null>(null);
  const [ready, setReady] = useState(false);

  /** Load the profile for whatever session exists, if any. */
  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setUser(null);
      return null;
    }
    try {
      const { user: me } = await api.me();
      setUser(me);
      return me;
    } catch {
      // A valid Supabase session with no profile behind it, or a deactivated
      // account. Either way this person cannot use the console.
      await supabase.auth.signOut();
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setReady(true));

    // Covers token refresh failure and sign-out from another tab.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        qc.clear();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [load, qc]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // Supabase says "Invalid login credentials", which reads as a system
        // fault to a non-technical user.
        return { ok: false, message: 'Wrong email or password' };
      }

      /*
       * The load-bearing reset. Whatever the previous session left behind — its
       * rows, or the 401s its queries recorded while tearing down — must not be
       * what the new identity reads. Safe to do here: the tree below is still the
       * login screen, so no query is mounted to refetch into the gap.
       */
      qc.clear();

      const me = await load();
      if (!me) {
        return { ok: false, message: 'This account cannot sign in to the console' };
      }

      // A driver holds a perfectly valid account — for the phone. Letting them
      // in would show a console where every request 403s, which reads as the
      // app being broken rather than as them being in the wrong place.
      if (me.role === 'driver') {
        await supabase.auth.signOut();
        setUser(null);
        return { ok: false, message: 'This account is for the driver app, not the console.' };
      }

      if (!me.active) {
        await supabase.auth.signOut();
        setUser(null);
        return { ok: false, message: 'This account has been deactivated.' };
      }

      return { ok: true };
    },
    [load, qc],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Unmount the tree first, then drop the cache — clearing while stores are
    // still mounted would have them refetch with a dead token and re-record the
    // very failures this is here to avoid.
    setUser(null);
    qc.clear();
  }, [qc]);

  const value = useMemo(() => (user ? { user, signOut } : null), [user, signOut]);

  // Blank rather than a spinner: reading a cached session is near-instant, and
  // flashing a login screen at an already-signed-in user looks broken.
  if (!ready) return null;

  if (!value) return <LoginPage onSignIn={signIn} />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Only callable below AuthProvider's gate, so `user` is never null. */
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
