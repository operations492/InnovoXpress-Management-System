/**
 * Date filter — trigger button + a two-pane popover (preset list + month calendar),
 * plus an inline time-of-day slider that appears once a bounded date is selected.
 * Presets resolve to a date range; a calendar click picks a single custom day.
 */
import { useEffect, useState } from 'react';
import { Button, Icon, Popover } from '@/ui';
import { cn } from '@/lib/utils';
import { dateRangeLabel, minutesToLabel } from '@/domain/format';
import { CalendarMonth } from './CalendarMonth';
import { TimeRangeSlider } from './TimeRangeSlider';

const PRESETS = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'next3', label: 'Next 3 Days' },
  { key: 'next7', label: 'Next 7 Days' },
];

function parseISO(iso: string | null): Date | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

interface DateFilterMenuProps {
  dateFilter: string;
  dateFrom: string | null;
  dateTo: string | null;
  timeFrom: number;
  timeTo: number;
  onPreset: (key: string) => void;
  onPickDate: (iso: string) => void;
  onTime: (from: number, to: number) => void;
  /**
   * Which edge of the trigger the panel hangs from. Defaults to `right`, which
   * is correct in the consignments toolbar where these sit on the right-hand
   * side and the panel opens leftwards into the page.
   *
   * The map needs `left`: the same menu sits in the top-LEFT corner there, and a
   * 440px panel opening leftwards from x=12 is simply off-screen.
   */
  align?: 'left' | 'right';
}

export function DateFilterMenu({
  dateFilter,
  dateFrom,
  dateTo,
  timeFrom,
  timeTo,
  onPreset,
  onPickDate,
  onTime,
  align = 'right',
}: DateFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [monthDate, setMonthDate] = useState<Date>(() => parseISO(dateFrom) ?? new Date());

  useEffect(() => {
    if (open) setMonthDate(parseISO(dateFrom) ?? new Date());
  }, [open, dateFrom]);

  const active = dateFilter !== 'all';
  const label =
    dateFilter === 'all'
      ? 'All Days'
      : dateFilter === 'today'
        ? 'Today'
        : dateFilter === 'tomorrow'
          ? 'Tomorrow'
          : dateFilter === 'overdue'
            ? 'Overdue'
            : dateRangeLabel(dateFrom, dateTo);

  const shiftMonth = (delta: number) =>
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));

  return (
    <div
      className={cn(
        'inline-flex items-center',
        active ? 'gap-1 rounded-md border border-destructive py-px pl-px pr-1.5' : 'gap-2',
      )}
    >
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        align={align}
        width={440}
        trigger={
          <Button
            variant={active ? 'ghost' : 'utility'}
            size="sm"
            className={active ? 'text-destructive' : undefined}
            leadingIcon={<Icon name="calendar" size={15} />}
            trailingIcon={<span className="text-[11px]">▾</span>}
            onClick={() => setOpen((o) => !o)}
          >
            {label}
          </Button>
        }
      >
        <div className="flex">
          <div className="w-[132px] border-r py-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={cn('ix-reset-btn ix-menu-item', dateFilter === p.key && 'font-semibold text-primary')}
                onClick={() => {
                  onPreset(p.key);
                  setOpen(false);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="p-3">
            <CalendarMonth
              monthDate={monthDate}
              from={dateFrom}
              to={dateTo}
              onPrev={() => shiftMonth(-1)}
              onNext={() => shiftMonth(1)}
              onSelect={(iso) => {
                onPickDate(iso);
                setOpen(false);
              }}
            />
          </div>
        </div>
      </Popover>

      {active && (
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">{minutesToLabel(timeFrom)}</span>
          <TimeRangeSlider from={timeFrom} to={timeTo} onChange={onTime} />
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">{minutesToLabel(timeTo)}</span>
        </div>
      )}
    </div>
  );
}
