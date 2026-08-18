/**
 * Anchored popover — a trigger plus a floating panel positioned beneath it.
 * The panel is rendered in a PORTAL to document.body with `position: fixed`,
 * computed from the trigger's bounding rect, so it overlays the table instead of
 * living inside the scroll container (which would otherwise extend the scroll area).
 * Closes on outside-click and Esc; follows the trigger on scroll/resize.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The always-visible trigger (a button). */
  trigger: ReactNode;
  /** Panel content, shown when open. */
  children: ReactNode;
  align?: 'left' | 'right';
  width?: number;
  /** Panel max-height before it scrolls. */
  maxHeight?: number;
}

export function Popover({
  open,
  onClose,
  trigger,
  children,
  align = 'left',
  width,
  maxHeight,
}: PopoverProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position from the trigger rect; re-measure on scroll/resize so it stays attached.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const w = width ?? r.width;
      setPos({ top: r.bottom + 6, left: align === 'right' ? r.right - w : r.left });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, align, width]);

  // Esc + outside-click (ignore clicks on the trigger or inside the portaled panel).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  return (
    <div ref={anchorRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger}
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width,
              maxHeight,
              overflowY: maxHeight ? 'auto' : undefined,
              zIndex: 1100,
              background: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-dropdown)',
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}
