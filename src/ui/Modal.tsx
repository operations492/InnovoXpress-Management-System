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
        <DialogHeader className="px-5 pt-4 pb-0">
          <DialogTitle className={cn('font-display', !title && 'sr-only')}>{title ?? 'Dialog'}</DialogTitle>
        </DialogHeader>
        {tabs && <div className="px-5">{tabs}</div>}
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t px-5 py-3">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}
