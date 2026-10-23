/**
 * The driver's photo and ID card.
 *
 * Both are uploaded one at a time and replace whatever was there. The links are
 * short-lived signed URLs, so this fetches them fresh when it opens rather than
 * holding one from an earlier render.
 */
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button, Icon, Modal } from '@/ui';
import { cn } from '@/lib/utils';
import { useDriverActions } from '../hooks/useDriverActions';
import type { Driver, DriverDocKind } from '@/domain/driver';

interface DriverDocumentsDialogProps {
  open: boolean;
  driver: Driver;
  canEdit: boolean;
  onClose: () => void;
}

const SLOTS: Array<{ kind: DriverDocKind; label: string; hint: string }> = [
  { kind: 'photo', label: 'Driver photo', hint: 'Shown on the map and the roster.' },
  { kind: 'id-card', label: 'ID card / licence', hint: 'Stored privately; viewable here.' },
];

export function DriverDocumentsDialog({
  open,
  driver,
  canEdit,
  onClose,
}: DriverDocumentsDialogProps) {
  const actions = useDriverActions();
  const [busy, setBusy] = useState<DriverDocKind | null>(null);
  const inputs = useRef<Partial<Record<DriverDocKind, HTMLInputElement | null>>>({});

  const docs = useQuery({
    queryKey: ['drivers', driver.id, 'documents'],
    queryFn: () => api.driverDocuments(driver.id),
    enabled: open,
    // Signed links expire; never serve one from cache on reopen.
    staleTime: 0,
    gcTime: 0,
  });

  const urlFor = (kind: DriverDocKind) =>
    kind === 'photo' ? docs.data?.photoUrl : docs.data?.idCardUrl;

  const pick = async (kind: DriverDocKind, file: File | undefined) => {
    if (!file) return;
    setBusy(kind);
    const ok = await actions.upload(driver, kind, file);
    setBusy(null);
    if (ok) await docs.refetch();
    // Clear the input so re-picking the same file still fires onChange.
    const el = inputs.current[kind];
    if (el) el.value = '';
  };

  return (
    <Modal open={open} title={`${driver.name} — documents`} onClose={onClose} width={560}>
      <div className="grid grid-cols-2 gap-4">
        {SLOTS.map(({ kind, label, hint }) => {
          const url = urlFor(kind);
          return (
            <div key={kind} className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">{label}</span>

              <div
                className={cn(
                  'grid aspect-[4/3] place-items-center overflow-hidden rounded-md border bg-muted/40',
                  !url && 'border-dashed',
                )}
              >
                {docs.isPending ? (
                  <span className="text-xs text-muted-foreground">Loading…</span>
                ) : url ? (
                  <img src={url} alt={label} className="size-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Icon name={kind === 'photo' ? 'user' : 'receipt'} size={20} />
                    <span className="text-xs">Nothing uploaded</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground">{hint}</p>

              {canEdit && (
                <>
                  <input
                    ref={(el) => {
                      inputs.current[kind] = el;
                    }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => void pick(kind, e.target.files?.[0])}
                  />
                  <Button
                    variant="utility"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => inputs.current[kind]?.click()}
                  >
                    {busy === kind ? 'Uploading…' : url ? 'Replace' : 'Upload'}
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        PNG, JPEG or WebP. The file type is checked by its actual bytes, not its name.
      </p>
    </Modal>
  );
}
