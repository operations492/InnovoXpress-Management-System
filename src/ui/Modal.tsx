/**
 * App modal shell. Wraps the shadcn/ui Dialog (Radix) — which already ships the
 * scrim, Esc-to-close, focus trap, scroll lock, and correct nested-dialog
 * stacking — and adapts it to the app's `open / onClose / title / tabs / footer /
 * width` prop API.
 */
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ModalProps {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  width?: number;
  tabs?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

export function Modal({ open, title, onClose, width, tabs, footer, children }: ModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        style={{ '--mw': `${width ?? 640}px` } as CSSProperties}
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[var(--mw)]"
      >
        {/*
          `shrink-0` on the header, tabs and footer is load-bearing, not tidiness.
          A flex item defaults to `flex-shrink: 1`, so once tall content hits the
          `max-h-[90vh]` cap, flexbox takes the shortfall out of EVERY shrinkable
          child — the title gets squashed and, because the shell is
          `overflow-hidden`, clipped rather than scrolled. The body below is the
          only thing that should give, which is exactly what its
          `min-h-0 flex-1 overflow-auto` is for.
        */}
        {/*
          The header owns a real bottom edge, and that is not decoration either.
          With `pb-0` the scrolling body began flush against the title with no
          gap and no boundary, so a card heading sliding past looked glued to the
          dialog's own heading — two bold lines 2px apart, reading as one broken
          element. Content needs somewhere visible to disappear INTO.

          When tabs are present they provide that edge themselves, so the border
          moves down to them rather than sitting between the title and its tabs.
        */}
        <DialogHeader className={cn('shrink-0 px-5 pt-4', tabs ? 'pb-0' : 'border-b pb-3')}>
          <DialogTitle className={cn('font-display', !title && 'sr-only')}>{title ?? 'Dialog'}</DialogTitle>
        </DialogHeader>
        {tabs && <div className="shrink-0 border-b px-5">{tabs}</div>}
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
        {footer && <div className="shrink-0 border-t px-5 py-3">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}
