/**
 * Minimal toast host. The prototype flashes a short confirmation after each
 * action ("Driver assigned", "Task created", …). Single transient message,
 * auto-clears — flat and factual, per the design language.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface ToastApi {
  flash: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setMessage(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 1700);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const api = useMemo(() => ({ flash }), [flash]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {message && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            background: 'var(--color-foreground)',
            color: 'var(--color-on-primary)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--type-body-sm-size)',
            boxShadow: 'var(--shadow-dropdown)',
          }}
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
