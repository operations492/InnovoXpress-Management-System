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
  /**
   * Earliest selectable day, ISO. Days before it render greyed and refuse the
   * click, and the back arrow stops at its month.
   *
   * Optional so the date FILTER keeps working unchanged — filtering by "last
   * week" is a legitimate thing to do. Only the scheduling pickers pass it,
   * because you cannot plan a collection for yesterday.
   */
  minISO?: string;
}

export function CalendarMonth({ monthDate, from, to, onPrev, onNext, onSelect, minISO }: CalendarMonthProps) {
  const first = startOfDay(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
  const gridStart = addDays(first, -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const todayISO = toISO(new Date());

  return (
    <div className="w-[280px]">
      <div className="mb-2 flex items-center justify-between">
        <IconButton
          size="sm"
          title="Previous month"
          onClick={onPrev}
          // Stop at the floor's month rather than letting the operator page back
          // into a grid where every day is dead.
          disabled={
            minISO !== undefined &&
            toISO(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)) <= minISO
          }
        >
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
          const blocked = minISO !== undefined && iso < minISO;

          return (
            <button
              key={iso}
              type="button"
              disabled={blocked}
              onClick={() => onSelect(iso)}
              /*
               * Deliberately NOT `ix-reset-btn`.
               *
               * That helper is unlayered CSS carrying `background: none` and
               * `color: inherit`, and in Tailwind v4 unlayered rules beat
               * anything in `@layer utilities` — so it silently swallowed
               * `bg-primary`/`text-primary-foreground` and the selected day never
               * filled. Tailwind's own preflight already neutralises the browser
               * button defaults, and it IS layered, so utilities win against it.
               */
              className={cn(
                'appearance-none rounded-md border border-transparent py-[5px] text-center text-xs transition-colors',
                blocked
                  ? 'cursor-not-allowed text-muted-foreground/40 line-through'
                  : 'cursor-pointer',
                isEndpoint
                  ? 'bg-primary font-semibold text-primary-foreground shadow-sm'
                  : cn(
                      !blocked && (inMonth ? 'text-foreground' : 'text-muted-foreground'),
                      inRange && !blocked ? 'bg-accent' : !blocked && 'hover:bg-muted',
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
