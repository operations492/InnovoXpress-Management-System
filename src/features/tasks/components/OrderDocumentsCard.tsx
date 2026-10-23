/**
 * The order's paperwork: a release letter, a bill of lading, or both.
 *
 * Replaces `ReleaseLetterCard`. The reason it had to change is the combination
 * the old single slot could not express — a BOL signed at the drop while the
 * release letter is only shown at the collection, on the same order.
 *
 * Self-fetching by `consignmentId`, like `PodPanel`, rather than reading off the
 * `Task` view-model: every link here is a short-lived signed URL that has to be
 * minted per view, so it could never have lived in the order's cached detail.
 */
import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { OrderDocFlags, OrderDocumentDto, OrderDocumentKind } from '@/lib/api';
import { Button, Card, Checkbox, Icon } from '@/ui';
import { cn } from '@/lib/utils';

/** Matches what the API sniffs for. The server decides; this only filters the picker. */
const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp';

/** Both kinds always render, attached or not, so an empty slot is discoverable. */
const KINDS: Array<{ kind: OrderDocumentKind; title: string }> = [
  { kind: 'RELEASE_LETTER', title: 'Release letter' },
  { kind: 'BILL_OF_LADING', title: 'Bill of lading' },
];

const FLAGS: Array<{ key: keyof OrderDocFlags; label: string }> = [
  { key: 'showAtPickup', label: 'Show at pickup' },
  { key: 'showAtDelivery', label: 'Show at dropoff' },
  { key: 'signAtPickup', label: 'Sign at pickup' },
  { key: 'signAtDelivery', label: 'Sign at dropoff' },
];

/**
 * All four flags, never partial — the boxes render from this, and one PATCH
 * carries the whole set. Ticking used to save immediately, which cost a round
 * trip per click and let the server's "a sign flag forces its show flag on"
 * rule flip a box under the operator's finger.
 */
type Flags = Required<OrderDocFlags>;

const BLANK: Flags = {
  showAtPickup: false,
  showAtDelivery: false,
  signAtPickup: false,
  signAtDelivery: false,
};

function flagsOf(doc: OrderDocumentDto): Flags {
  return {
    showAtPickup: doc.showAtPickup,
    showAtDelivery: doc.showAtDelivery,
    signAtPickup: doc.signAtPickup,
    signAtDelivery: doc.signAtDelivery,
  };
}

function reason(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

function when(iso: string) {
  return new Date(iso).toLocaleString();
}

interface OrderDocumentsCardProps {
  consignmentId: string;
  /** Operators attach, configure and clear; pass false for a read-only view. */
  canEdit?: boolean;
}

export function OrderDocumentsCard({ consignmentId, canEdit = true }: OrderDocumentsCardProps) {
  const [error, setError] = useState('');
  /** Ticks not yet saved, per kind. A missing entry means nothing is pending. */
  const [draft, setDraft] = useState<Partial<Record<OrderDocumentKind, Flags>>>({});
  /** Which kind's picker is open, so two file inputs never fight over one ref. */
  const inputs = useRef<Partial<Record<OrderDocumentKind, HTMLInputElement | null>>>({});

  const docs = useQuery({
    queryKey: ['consignment', consignmentId, 'documents'],
    queryFn: () => api.orderDocuments(consignmentId),
    // The urls expire in minutes; never serve one from cache when the modal reopens.
    staleTime: 0,
    gcTime: 0,
  });

  const done = () => {
    setError('');
    void docs.refetch();
  };

  /** Drop a kind's pending ticks — on save, on cancel, and when the file changes. */
  const clear = (kind: OrderDocumentKind) =>
    setDraft((prev) => {
      const next = { ...prev };
      delete next[kind];
      return next;
    });

  const upload = useMutation({
    mutationFn: ({ kind, file }: { kind: OrderDocumentKind; file: File }) =>
      api.uploadOrderDocument(consignmentId, kind, file),
    onSuccess: (_data, { kind }) => {
      clear(kind);
      done();
    },
    onError: (e) => setError(reason(e, 'Could not upload that file')),
  });

  const flags = useMutation({
    mutationFn: ({ kind, patch }: { kind: OrderDocumentKind; patch: OrderDocFlags }) =>
      api.setOrderDocumentFlags(consignmentId, kind, patch),
    onSuccess: (_data, { kind }) => {
      clear(kind);
      done();
    },
    onError: (e) => setError(reason(e, 'Could not save these settings')),
  });

  const remove = useMutation({
    mutationFn: (kind: OrderDocumentKind) => api.deleteOrderDocument(consignmentId, kind),
    onSuccess: (_data, kind) => {
      clear(kind);
      done();
    },
    onError: (e) => setError(reason(e, 'Could not remove the document')),
  });

  /**
   * One tick, held locally. The sign → show coupling is mirrored from the server
   * so what the operator sees before saving is what the save will store.
   */
  const tick = (kind: OrderDocumentKind, saved: Flags, key: keyof OrderDocFlags, on: boolean) =>
    setDraft((prev) => {
      const next: Flags = { ...saved, ...prev[kind], [key]: on };
      if (on && key === 'signAtPickup') next.showAtPickup = true;
      if (on && key === 'signAtDelivery') next.showAtDelivery = true;
      return { ...prev, [kind]: next };
    });

  const busy = upload.isPending || flags.isPending || remove.isPending;
  const byKind = new Map(docs.data?.documents.map((d) => [d.kind, d]) ?? []);

  const pick = (kind: OrderDocumentKind, file: File | undefined) => {
    if (!file) return;
    upload.mutate({ kind, file });
    // Clear the input so re-picking the same file still fires onChange.
    const el = inputs.current[kind];
    if (el) el.value = '';
  };

  const row = ({ kind, title }: { kind: OrderDocumentKind; title: string }) => {
    const doc = byKind.get(kind);
    const saved = doc ? flagsOf(doc) : BLANK;
    /** The saved flags with any pending ticks laid over them. */
    const view: Flags = { ...saved, ...draft[kind] };
    const dirty = !!doc && FLAGS.some((f) => view[f.key] !== saved[f.key]);
    const signing = view.signAtPickup || view.signAtDelivery;

    return (
      <div key={kind} className="border-t pt-3 first:border-t-0 first:pt-0">
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2',
            !doc && 'border-dashed',
          )}
        >
          <Icon name="receipt" size={18} />
          <span className="text-sm font-medium">{title}</span>
          {docs.isPending ? (
            <span className="ml-auto text-xs text-muted-foreground">Loading…</span>
          ) : doc?.url ? (
            <a
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-sm text-primary underline"
            >
              Open
            </a>
          ) : (
            <span className="ml-auto text-xs text-muted-foreground">Nothing attached</span>
          )}
        </div>

        {doc && (
          <>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {FLAGS.map((f) => (
                <Checkbox
                  key={f.key}
                  label={f.label}
                  checked={view[f.key]}
                  disabled={!canEdit || busy}
                  onChange={(e) => tick(kind, saved, f.key, e.target.checked)}
                />
              ))}
            </div>

            {canEdit && dirty && (
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" disabled={busy} onClick={() => flags.mutate({ kind, patch: view })}>
                  {flags.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => clear(kind)}>
                  Cancel
                </Button>
                <span className="text-[11px] text-amber-600">Unsaved changes</span>
              </div>
            )}

            {signing && (
              <p className="mt-2 text-[11px] text-amber-600">
                Signing is required. The driver cannot complete that stop until this document is
                signed — there is no override.
              </p>
            )}

            {doc.signatures.length > 0 && (
              <ul className="mt-2 space-y-1">
                {doc.signatures.map((s) => (
                  <li key={s.leg} className="flex items-center gap-2 text-[11px]">
                    <Icon name="check" size={13} />
                    <span>
                      Signed at {s.leg === 'PICKUP' ? 'pickup' : 'dropoff'} · {when(s.capturedAt)}
                    </span>
                    {s.signedUrl && (
                      <a
                        href={s.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline"
                      >
                        Signed copy
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {canEdit && (
          <div className="mt-2 flex gap-2">
            <input
              ref={(el) => {
                inputs.current[kind] = el;
              }}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => pick(kind, e.target.files?.[0])}
            />
            <Button
              variant="utility"
              size="sm"
              disabled={busy}
              leadingIcon={<Icon name="upload" size={14} />}
              onClick={() => inputs.current[kind]?.click()}
            >
              {doc ? 'Replace' : 'Attach'}
            </Button>
            {doc && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => remove.mutate(kind)}>
                Remove
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card title="Paperwork">
      <div className="space-y-3">{KINDS.map(row)}</div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        PDF or image, up to 10 MB each. The driver assigned to this order sees only the documents
        ticked for the stop they are at.
      </p>

      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
    </Card>
  );
}
