/**
 * Add or edit a roster row. Identity only — a login is created separately on the
 * Users tab, and the photo and ID card are uploaded from the drawer, because both
 * need a driver id that does not exist until this dialog has saved.
 */
import { useState } from 'react';
import { Button, Input, Modal } from '@/ui';
import type { Driver, DriverInput, DriverPatch } from '@/domain/driver';

interface DriverFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  driver: Driver | null;
  onClose: () => void;
  onCreate: (input: DriverInput) => Promise<unknown>;
  onUpdate: (id: string, patch: DriverPatch) => Promise<unknown>;
}

const trimmed = (v: string) => v.trim();

export function DriverFormDialog({
  open,
  mode,
  driver,
  onClose,
  onCreate,
  onUpdate,
}: DriverFormDialogProps) {
  const [name, setName] = useState(driver?.name ?? '');
  const [code, setCode] = useState(driver?.code ?? '');
  const [mobile, setMobile] = useState(driver?.mobile ?? '');
  const [email, setEmail] = useState(driver?.email ?? '');
  const [busy, setBusy] = useState(false);

  const valid = trimmed(name).length > 0;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      if (mode === 'create') {
        // Blank optionals are omitted rather than sent as '' — the column is
        // nullable and an empty string is not the same as "not set".
        await onCreate({
          name: trimmed(name),
          ...(trimmed(code) ? { code: trimmed(code) } : {}),
          ...(trimmed(mobile) ? { mobile: trimmed(mobile) } : {}),
          ...(trimmed(email) ? { email: trimmed(email) } : {}),
        });
      } else if (driver) {
        // On edit a cleared box means null, which is how a value is removed.
        await onUpdate(driver.id, {
          name: trimmed(name),
          code: trimmed(code) || null,
          mobile: trimmed(mobile) || null,
          email: trimmed(email) || null,
        });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'New driver' : `Edit ${driver?.name ?? 'driver'}`}
      onClose={onClose}
      width={460}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={!valid || busy}>
            {mode === 'create' ? 'Add driver' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Name<span className="text-primary"> *</span>
          </span>
          <Input
            placeholder="e.g. Imran Khalid"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Driver code</span>
            <Input
              placeholder="DRV-009"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Mobile</span>
            <Input
              placeholder="+1 416 555 0134"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Email</span>
          <Input
            placeholder="driver@example.ca"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">
            Contact detail only. Their sign-in is created on the Users tab.
          </span>
        </label>
      </div>
    </Modal>
  );
}
