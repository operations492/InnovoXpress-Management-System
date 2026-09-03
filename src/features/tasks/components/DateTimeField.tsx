import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Icon, Input, Select } from '@/ui';
import { cn } from '@/lib/utils';
import { toISO } from '@/domain/format';
import { CalendarMonth } from './CalendarMonth';

/**
 * A date **and** time, which cannot be emptied.
 *
 * The four scheduling windows are `NOT NULL` in the database, so a blank here is
 * not a state the system can store — the form would either send nothing and take
 * a 400, or send a guess the operator never saw. Instead the field is always
 * populated: it is read-only to the keyboard, and the only way to change it is
 * the panel, which always commits a real instant.
 *
 * `readOnly` rather than `disabled`: a disabled input is skipped by tab order and
 * greyed out, which reads as "you may not change this". Read-only stays focusable
 * and normal-looking, which reads as "change this here, not by typing" — the truth.
 *
 * ## Why this does not use `@/ui`'s Popover
 *
 * Three reasons, all of which showed up in this exact position:
 *
 * 1. **Its anchor is `display: inline-flex`**, so the input shrank to its content
 *    instead of filling the form row.
 * 2. **It portals the panel to `document.body`.** This field lives inside a Radix
 *    dialog, which traps focus within its own subtree — a panel outside that
 *    subtree loses focus back to the dialog the moment you click into it.
 * 3. **Its Escape handler is on `document`**, so one press closed the popover AND
 *    the surrounding modal, discarding the whole draft.
 *
 * An absolutely-positioned panel inside the field's own wrapper has none of those
 * problems. It is a descendant of the dialog, so the focus trap is satisfied, and
 * Escape is handled locally with `stopPropagation`.
 *
 * The cost of staying in the DOM is that an absolutely-positioned descendant
 * still contributes to its scroll container's scrollable height, so a panel
 * hanging past the bottom of the card grew the dialog. `dropUp` is the answer:
 * when there is no room below, it opens upward over content already on screen.
 *
 * ## No past instants — but only relative to the FLOOR
 *
 * A new order cannot be scheduled in the past, so days before today are dead in
 * the grid and the back arrow stops at the current month. An order created two
 * days ago keeps its own date reachable, because the floor is the earlier of
 * `now` and the value the field opened with — see `floor` below for why a plain
 * `now` silently corrupts an edit.
 *
 * The floor constrains time as well as date: on the floor's own day the hour and
 * minute lists shrink to what it allows, which a date-only floor misses and an
 * operator hits every afternoon.
 *
 * The wire format is `"YYYY-MM-DD h:mm AM/PM"`, matching `mappers.fullStamp`.
 * Both the date filter's `^YYYY-MM-DD` anchor and its `h:mm AM/PM` time regex
 * parse it, and `new Date()` accepts it on the way back to an ISO instant.
 */

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const MERIDIEMS = ['AM', 'PM'];

/**
 * Roughly how tall the panel renders — calendar, time row, buttons and padding.
 *
 * An estimate on purpose. Measuring the real height needs the panel mounted,
 * which means one frame rendered in the wrong place and a visible jump; a
 * constant that is close enough decides the side before anything paints.
 */
const PANEL_HEIGHT_PX = 360;

/** `"2026-08-30 4:21 PM"` — the one shape this component reads and writes. */
export function formatStamp(d: Date): string {
  const minutes = d.getMinutes();
  const meridiem = d.getHours() >= 12 ? 'PM' : 'AM';
  const hour12 = d.getHours() % 12 || 12;
  return `${toISO(d)} ${hour12}:${minutes < 10 ? `0${minutes}` : minutes} ${meridiem}`;
}

/**
 * Parse back, falling back to `now` rather than to null.
 *
 * Every caller needs a Date to open the panel on, and there is no "no date"
 * branch to render — so an unparseable value degrades to the current instant
 * instead of crashing.
 */
function parseStamp(value: string): Date {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

interface DateTimeFieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  /**
   * A sibling window this one must not precede — `pickupBefore` takes
   * `pickupAfter`, `deliverBefore` takes the later of `deliverAfter` and
   * `pickupAfter`. Same stamp format as `value`.
   *
   * It raises the floor, but **never above this field's own current value** (see
   * `floor`). Letting it do so would recreate the bug this floor exists to
   * prevent: a field displaying a date its own calendar refuses to offer.
   */
  notBefore?: string;
}

export function DateTimeField({ label, value, onChange, notBefore }: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  /**
   * Open upward when there is not enough room below.
   *
   * The panel is absolutely positioned, and an absolutely positioned descendant
   * still contributes to its scroll container's scrollable height — so a panel
   * hanging off the bottom of the Schedule card made the whole dialog grow a few
   * hundred pixels of empty scroll. Flipping it above the input overlays content
   * that is already rendered, so nothing about the dialog's size changes.
   */
  const [dropUp, setDropUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Draft state, so Cancel genuinely discards. The committed value only moves
  // when Apply is pressed.
  const [draft, setDraft] = useState(() => parseStamp(value));
  const [month, setMonth] = useState(() => parseStamp(value));

  // Reopening shows what is committed, not last time's abandoned edit.
  useEffect(() => {
    if (!open) return;

    const d = parseStamp(value);
    setDraft(d);
    setMonth(d);

    // Measured on open, against the viewport rather than the dialog: the modal
    // is capped at 90vh, so "fits on screen" and "fits in the dialog" are the
    // same question here, and the viewport is the one the browser can answer.
    const rect = wrapRef.current?.getBoundingClientRect();
    setDropUp(!!rect && rect.bottom + PANEL_HEIGHT_PX > window.innerHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on a click anywhere outside this field.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const dayISO = useMemo(() => toISO(draft), [draft]);
  const hour12 = draft.getHours() % 12 || 12;
  const meridiem = draft.getHours() >= 12 ? 'PM' : 'AM';

  /*
   * The floor: **the earlier of now and the value this field opened with.**
   *
   * A floor of plain `now` is right for a new order and wrong for an existing
   * one. Open an order logged two days ago and its own pickup time is in the
   * past — the field would display a value its own calendar refused to
   * reproduce, and nudging the minutes would silently jump the window forward to
   * today. Worse, `pickupAfter` could leap past a `deliverBefore` that stayed
   * put, and Postgres would reject the whole save over a field nobody touched.
   *
   * Taking the earlier of the two means a brand-new order still cannot be
   * scheduled in the past, while an existing one keeps its own history
   * reachable.
   *
   * Captured once per open, not per render: recomputing every render would let
   * the minute list shrink under the operator's cursor while the panel sits
   * open, so the option they are reaching for vanishes as they reach it.
   */
  const floor = useMemo(() => {
    if (!open) return new Date(0);

    const opened = parseStamp(value);
    const now = new Date();
    let base = opened < now ? opened : now;

    /*
     * A sibling raises the floor, but is capped at this field's own value.
     *
     * Without the cap: move `pickupAfter` to next week while `pickupBefore` is
     * still today, and `pickupBefore` would floor at next week — displaying
     * today's date in a calendar that refuses to offer it, which is exactly the
     * failure the floor exists to prevent. Capping keeps the field internally
     * consistent, and the out-of-order pair is caught by `missingRequired`,
     * which names it in the footer and disables Save.
     */
    if (notBefore) {
      const sibling = parseStamp(notBefore);
      if (sibling > base) base = sibling < opened ? sibling : opened;
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const floorISO = toISO(floor);
  // Only the floor's own day is time-constrained; any later day is wide open.
  const onFloorDay = dayISO === floorISO;

  const meridiemOptions = onFloorDay
    ? MERIDIEMS.filter((m) => !(m === 'AM' && floor.getHours() >= 12))
    : MERIDIEMS;

  const hourOptions = onFloorDay
    ? HOURS.filter((h) => (Number(h) % 12) + (meridiem === 'PM' ? 12 : 0) >= floor.getHours())
    : HOURS;

  // Minutes only matter within the floor's own hour; later hours are wide open.
  const inFloorHour =
    onFloorDay && (hour12 % 12) + (meridiem === 'PM' ? 12 : 0) === floor.getHours();
  const minuteOptions = inFloorHour
    ? MINUTES.filter((m) => Number(m) >= floor.getMinutes())
    : MINUTES;

  /** Rebuild the draft from one changed part, leaving the rest alone. */
  const withTime = (h: number, m: number, mer: string) => {
    const next = new Date(draft);
    // 12 AM is hour 0 and 12 PM is hour 12 — the one case a naive
    // `h + (pm ? 12 : 0)` gets wrong, twice a day.
    const hour24 = (h % 12) + (mer === 'PM' ? 12 : 0);
    next.setHours(hour24, m, 0, 0);
    setDraft(next);
  };

  const pickDay = (iso: string) => {
    const [y, mo, d] = iso.split('-').map(Number);
    const next = new Date(draft);
    next.setFullYear(y, mo - 1, d);
    // Dropping back onto the floor's own day can strand a time earlier than the
    // floor — the lists would then show no matching option and Apply would
    // commit something the calendar had just refused. Pull it forward instead.
    setDraft(next < floor ? new Date(floor) : next);
  };

  return (
    <div className="relative flex min-w-0 flex-col gap-1.5" ref={wrapRef}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>

      <Input
        icon={<Icon name="calendar" size={15} />}
        value={value}
        readOnly
        aria-label={label}
        aria-expanded={open}
        className="cursor-pointer"
        onClick={() => setOpen((o) => !o)}
        // Space and Enter open it, so the field works without a mouse even
        // though it refuses typed input.
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
          // Locally handled, and NOT allowed to bubble — otherwise Radix closes
          // the whole dialog and the operator loses the draft they were editing.
          if (e.key === 'Escape' && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />

      {open && (
        <div
          role="dialog"
          aria-label={`Choose ${label}`}
          className={cn(
            'absolute left-0 z-[60] w-max rounded-lg border bg-popover p-3 shadow-lg',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <CalendarMonth
            monthDate={month}
            from={dayISO}
            to={dayISO}
            onPrev={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            onNext={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            onSelect={pickDay}
            minISO={floorISO}
          />

          <div className="mt-3 flex items-center justify-center gap-1.5">
            <Select
              options={hourOptions}
              value={String(hour12)}
              onChange={(e) => withTime(Number(e.target.value), draft.getMinutes(), meridiem)}
            />
            <span className="text-muted-foreground">:</span>
            <Select
              options={minuteOptions}
              value={String(draft.getMinutes()).padStart(2, '0')}
              onChange={(e) => withTime(hour12, Number(e.target.value), meridiem)}
            />
            <Select
              options={meridiemOptions}
              value={meridiem}
              onChange={(e) => withTime(hour12, draft.getMinutes(), e.target.value)}
            />
          </div>

          <div className="mt-3 flex justify-end gap-2 border-t pt-3">
            <Button variant="utility" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onChange(formatStamp(draft));
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
