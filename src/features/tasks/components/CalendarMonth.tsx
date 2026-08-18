/** Compact month calendar for the date filter. Highlights the active [from,to] range;
 *  clicking a day selects it (single custom date). No date-lib dependency. */
import { Icon, IconButton } from '@/ui';
import { cn } from '@/lib/utils';
import { addDays, startOfDay, toISO } from '@/domain/format';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface CalendarMonthProps {
  monthDate: Date;
  from: string | null;
  to: string | null;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (iso: string) => void;
}

export function CalendarMonth({ monthDate, from, to, onPrev, onNext, onSelect }: CalendarMonthProps) {
  const first = startOfDay(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
  const gridStart = addDays(first, -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayISO = toISO(new Date());

  return (
    <div className="w-[280px]">
      <div className="mb-2 flex items-center justify-between">
        <IconButton size="sm" title="Previous month" onClick={onPrev}>
          <Icon name="chevronLeft" size={16} />
        </IconButton>
        <span className="text-[13px] font-semibold text-foreground">
          {MONTHS_SHORT[monthDate.getMonth()]} {monthDate.getFullYear()}
        </span>
        <IconButton size="sm" title="Next month" onClick={onNext}>
          <Icon name="chevronRight" size={16} />
        </IconButton>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-0.5 text-center text-[11px] text-muted-foreground">
            {w}
          </div>
        ))}

        {cells.map((cell) => {
          const iso = toISO(cell);
          const inMonth = cell.getMonth() === monthDate.getMonth();
          const isEndpoint = iso === from || iso === to;
          const inRange = (from || to) && (!from || iso >= from) && (!to || iso <= to);
          const isToday = iso === todayISO;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={cn(
                'ix-reset-btn cursor-pointer rounded-md border border-transparent py-[5px] text-center text-xs transition-colors',
                isEndpoint
                  ? 'bg-primary font-semibold text-primary-foreground'
                  : cn(
                      inMonth ? 'text-foreground' : 'text-muted-foreground',
                      inRange ? 'bg-accent' : 'hover:bg-muted',
                      isToday && 'border-primary',
                    ),
              )}
            >
              {cell.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
