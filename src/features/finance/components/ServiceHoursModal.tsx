/**
 * Business hours for a system-added charge.
 *
 * Two windows rather than one, because a Saturday morning is not an ordinary
 * Tuesday morning and a courier charges differently for it. The hours describe
 * what *normal* looks like; the charge is what happens outside them.
 *
 * Leaving a window blank is a real answer, not a missing one: it means the
 * charge has no notion of normal on those days and so never fires on them.
 * That is why both ends go together — half a window cannot say when the
 * working day ends, and the server rejects it.
 */
import { useState } from 'react';
import { Button, Input, Modal } from '@/ui';
import type { AdditionalService } from '@/domain/services';
import type { ServiceHoursDto } from '@/lib/api';

const EMPTY: ServiceHoursDto = {
  weekdayFrom: null,
  weekdayTo: null,
  weekendFrom: null,
  weekendTo: null,
};

/** One line of plain English for the list, so the hours are readable without opening this. */
export function summariseHours(h: ServiceHoursDto): string {
  const span = (from: string | null, to: string | null) => (from && to ? `${from}–${to}` : 'not set');
  return `Mon–Fri ${span(h.weekdayFrom, h.weekdayTo)} · Sat–Sun ${span(h.weekendFrom, h.weekendTo)}`;
}

/** An empty time input reads as "", which the API spells null. */
const clean = (v: string) => (v.trim() === '' ? null : v);

function Window({
  label,
  from,
  to,
  onChange,
}: {
  label: string;
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Input
          type="time"
          value={from ?? ''}
          onChange={(e) => onChange(clean(e.target.value), to)}
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="time" value={to ?? ''} onChange={(e) => onChange(from, clean(e.target.value))} />
      </div>
    </div>
  );
}

export function ServiceHoursModal({
  service,
  busy = false,
  onClose,
  onSave,
}: {
  service: AdditionalService;
  busy?: boolean;
  onClose: () => void;
  onSave: (hours: ServiceHoursDto) => void;
}) {
  const [draft, setDraft] = useState<ServiceHoursDto>(service.hours ?? EMPTY);

  const problem = (() => {
    const pairs: Array<[string, string | null, string | null]> = [
      ['weekday', draft.weekdayFrom, draft.weekdayTo],
      ['weekend', draft.weekendFrom, draft.weekendTo],
    ];
    for (const [which, from, to] of pairs) {
      if ((from === null) !== (to === null)) {
        return `Give both ends of the ${which} window, or clear both.`;
      }
      // "HH:MM" compares correctly as text, so no parsing is needed here.
      if (from !== null && to !== null && from >= to) {
        return `The ${which} window has to end after it starts.`;
      }
    }
    return null;
  })();

  return (
    <Modal
      open
      onClose={onClose}
      title={`${service.name} — business hours`}
      width={430}
      footer={
        <>
          <Button variant="utility" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={busy || problem !== null}
            onClick={() => onSave(draft)}
          >
            {busy ? 'Saving…' : 'Save hours'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          These are the ordinary working hours. A pickup or delivery outside them is what this
          charge is for &mdash; the system applies it on its own, so nobody ticks it on an order.
        </p>

        <Window
          label="Monday to Friday"
          from={draft.weekdayFrom}
          to={draft.weekdayTo}
          onChange={(weekdayFrom, weekdayTo) => setDraft((d) => ({ ...d, weekdayFrom, weekdayTo }))}
        />

        <Window
          label="Saturday and Sunday"
          from={draft.weekendFrom}
          to={draft.weekendTo}
          onChange={(weekendFrom, weekendTo) => setDraft((d) => ({ ...d, weekendFrom, weekendTo }))}
        />

        {problem && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {problem}
          </p>
        )}

        <p className="text-[11px] text-muted-foreground">
          Clear both ends of a window to say this charge has no normal hours on those days, and so
          never applies to them.
        </p>
      </div>
    </Modal>
  );
}
