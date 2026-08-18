/**
 * Proof of delivery, read-only.
 *
 * Deliberately has no delete or replace: proof is the evidence a job happened,
 * and an operator being able to remove it from the record would defeat the
 * point. (Swapping a blurry file is an admin-only API call, not a console
 * action.)
 *
 * The image links are SIGNED and expire in about five minutes, so this refetches
 * whenever the tab is opened rather than caching them.
 */
import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Icon } from '@/ui';
import { api } from '@/lib/api';
import type { PodFileDto, PodLegDto } from '@/lib/api';

const LEG_LABEL: Record<PodLegDto['leg'], string> = {
  PICKUP: 'Pickup',
  DELIVERY: 'Delivery',
};

export function PodPanel({
  consignmentId,
  orderNo,
}: {
  consignmentId: string;
  orderNo: string;
}) {
  const pod = useQuery({
    queryKey: ['pod', consignmentId],
    queryFn: () => api.getPod(consignmentId),
    // Shorter than the ~5 minute signature lifetime, so a stale link is never
    // handed to the browser.
    staleTime: 60_000,
    refetchOnMount: 'always',
  });

  const legs = pod.data?.proof ?? [];

  if (pod.isPending) {
    return (
      <div className="grid gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-44 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (pod.isError) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
        Could not load proof of delivery: {(pod.error as Error).message}
        <div className="mt-3">
          <Button variant="utility" size="sm" onClick={() => void pod.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (legs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
        <Icon name="camera" size={22} />
        <p className="text-sm font-medium text-foreground">No proof captured yet</p>
        <p className="max-w-md text-xs text-muted-foreground">
          The driver captures a photo and a signature at pickup, and again at delivery. Those two
          uploads are what move the order to Picked&nbsp;up and Delivered — so proof appears here the
          moment either step is completed.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {legs.map((leg) => (
        <LegCard key={leg.leg} leg={leg} orderNo={orderNo} onExpired={() => void pod.refetch()} />
      ))}

      <p className="text-[11px] text-muted-foreground">
        Proof is part of the permanent record and cannot be edited or removed here. Image links are
        signed and expire after a few minutes — reopen this tab to refresh them.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LegCard({
  leg,
  orderNo,
  onExpired,
}: {
  leg: PodLegDto;
  orderNo: string;
  onExpired: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2.5">
        <span
          className={
            leg.leg === 'DELIVERY'
              ? 'rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary'
              : 'rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground'
          }
        >
          {LEG_LABEL[leg.leg]}
        </span>

        <span className="font-mono text-xs text-muted-foreground">
          {new Date(leg.capturedAt).toLocaleString()}
        </span>

        {leg.capturedByDriver && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon name="truck" size={13} />
            {leg.capturedByDriver.name}
          </span>
        )}

        {leg.replacedAt && (
          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] text-warning">
            File replaced {new Date(leg.replacedAt).toLocaleDateString()}
          </span>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 p-4">
        <FileTile
          title="Photo"
          file={leg.photo}
          filename={`${orderNo}-${leg.leg.toLowerCase()}-photo`}
          onExpired={onExpired}
        />
        <FileTile
          title="Signature"
          file={leg.signature}
          filename={`${orderNo}-${leg.leg.toLowerCase()}-signature`}
          checkered
          onExpired={onExpired}
        />
      </div>
    </section>
  );
}

function FileTile({
  title,
  file,
  filename,
  checkered = false,
  onExpired,
}: {
  title: string;
  file: PodFileDto;
  filename: string;
  /** Signatures are dark-on-transparent; a plain background hides them. */
  checkered?: boolean;
  onExpired: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await saveFile(file, filename);
    } catch {
      // Almost always an expired signature; pulling fresh links usually fixes it.
      setError('Link expired — refreshing');
      onExpired();
    } finally {
      setSaving(false);
    }
  }, [file, filename, onExpired]);

  return (
    <figure className="m-0 flex flex-col gap-2">
      <figcaption className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{kb(file.bytes)}</span>
      </figcaption>

      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        title="Open full size"
        className={[
          'flex h-40 items-center justify-center overflow-hidden rounded-lg border border-border',
          checkered ? 'bg-[repeating-conic-gradient(#f4f4f7_0_25%,#fff_0_50%)] bg-[length:16px_16px]' : 'bg-muted',
        ].join(' ')}
      >
        {broken ? (
          <span className="px-3 text-center text-[11px] text-muted-foreground">
            Preview unavailable — the signed link may have expired
          </span>
        ) : (
          <img
            src={file.url}
            alt={title}
            loading="lazy"
            className="max-h-full max-w-full object-contain"
            onError={() => setBroken(true)}
          />
        )}
      </a>

      <Button variant="utility" size="sm" onClick={() => void download()} disabled={saving}>
        <span className="flex items-center justify-center gap-1.5">
          <Icon name="download" size={14} />
          {saving ? 'Saving…' : 'Download'}
        </span>
      </Button>

      {error && <span className="text-[11px] text-danger">{error}</span>}
    </figure>
  );
}

/* ------------------------------------------------------------------ */

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Fetch to a blob, then save.
 *
 * `<a download>` is IGNORED for cross-origin URLs — and these are signed links
 * on supabase.co, so a plain download attribute would just navigate to the
 * image instead of saving it. Going via a blob keeps it a real download.
 */
async function saveFile(file: PodFileDto, filename: string): Promise<void> {
  const res = await fetch(file.url);
  if (!res.ok) throw new Error(String(res.status));
  const blob = await res.blob();

  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = `${filename}.${EXT[file.mime] ?? 'bin'}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the save in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(href), 2_000);
}

function kb(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
