import type { ReactNode } from 'react';
import { Button } from './index';
import { Modal } from './Modal';

/**
 * A deliberate pause before something irreversible.
 *
 * The codebase had no confirm anywhere — deletes fired straight from a row
 * button. That is fine for an in-memory fixture and not fine for deleting a
 * person's login.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width={440}
      footer={
        <>
          <Button variant="utility" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[13.5px] leading-relaxed text-body">{body}</div>
    </Modal>
  );
}
