import { STATUS_META, TASK_STATUSES } from '@/domain/status';
import type { MapDriverDto } from '@/lib/api';
import type { ColourMode } from '../state/mapView';
import { driverColour } from '../pins/pinIcon';

interface MapLegendProps {
  mode: ColourMode;
  /** The selected driver, when colouring by driver. */
  driver: MapDriverDto | null;
}

/**
 * What the pin colours currently mean.
 *
 * This switches wholesale with the colour mode, and that is deliberate: seven of
 * the eight driver colours are the same hex as a status colour, so an operator
 * must never be reading two colour systems at once.
 */
export function MapLegend({ mode, driver }: MapLegendProps) {
  if (mode === 'driver' && driver) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-xs">
        <span
          aria-hidden
          className="size-2.5 rounded-full"
          style={{ background: driverColour(driver.colorIndex) }}
        />
        <span className="text-foreground">{driver.name}</span>
        <span className="text-muted-foreground">— all statuses</span>
      </div>
    );
  }

  /*
   * Eight statuses, six swatches: the two "en route" states share a hue and so do
   * the two "arrived" ones. That is a design decision, not a shortfall — the pair
   * means the same thing at either end of the job — so the legend groups them
   * rather than repeating a colour twice.
   */
  const seen = new Set<string>();
  const entries = TASK_STATUSES.filter((status) => {
    const colour = STATUS_META[status].colorVar;
    if (seen.has(colour)) return false;
    seen.add(colour);
    return true;
  });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card px-2.5 py-1.5 text-xs">
      {entries.map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ background: STATUS_META[status].colorVar }}
          />
          <span className="text-muted-foreground">{STATUS_META[status].label}</span>
        </span>
      ))}
    </div>
  );
}
