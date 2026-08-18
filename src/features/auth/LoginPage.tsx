import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Icon, Input } from '@/ui';
import type { SignInResult } from '@/state/AuthProvider';

/**
 * The console's front door.
 *
 * Rendered by AuthProvider in place of the app whenever there is no session, so
 * it needs no route — which also avoids fighting App.tsx's `path="*"` catch-all
 * that redirects everything to /tasks.
 */
export function LoginPage({
  onSignIn,
}: {
  onSignIn: (email: string, password: string) => Promise<SignInResult>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await onSignIn(email.trim(), password);
      if (!res.ok) setError(res.message);
      // On success this component unmounts — AuthProvider swaps in the app.
    } catch {
      setError('Could not reach the sign-in service. Is the backend running?');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Icon name="package" size={22} />
          </div>
          <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
            Innovo Xpress
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Dispatcher console</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-xl border border-border bg-card p-5 shadow-sm"
          noValidate
        >
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12.5px] leading-relaxed text-danger"
            >
              {error}
            </div>
          )}

          <label className="mb-3 flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Email</span>
            <Input
              type="email"
              autoComplete="username"
              autoFocus
              placeholder="you@innovoxpress.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="mb-5 flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Password</span>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={busy || !email.trim() || !password}
            style={{ width: '100%' }}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-4 text-center text-[11.5px] text-muted-foreground">
          Forgotten your password? An administrator can reset it from the Users screen.
        </p>
      </div>
    </div>
  );
}
