import L from 'leaflet';
import { statusColorVar } from '@/domain/status';
import type { TaskStatus } from '@/domain/status';
import { ZONE_COLORS } from '@/domain/serviceZone';
import type { MapPinDto } from '@/lib/api';
import type { ColourMode, PlotEnd } from '../state/mapView';

/*
 * Pin appearance.
 *
 * Colours are CSS colour STRINGS, not hex literals. `statusColorVar` already
 * returns `var(--status-info)`, and a divIcon's HTML lives in the same document,
 * so the variable resolves — which means one factory serves status colours,
 * driver hexes and any future theme without a second code path. The existing
 * three maps interpolate raw hex; this deliberately does not.
 */

/**
 * A driver's colour from the shared 8-entry palette.
 *
 * Modulo because drivers are unbounded and the palette is not: at nine drivers
 * "a unique colour each" stops being true. That is survivable — only one
 * driver's tasks are shown at a time — but it is why roster swatches are only
 * displayed while the colour switch is on.
 */
export function driverColour(colorIndex: number): string {
  return ZONE_COLORS[Math.abs(colorIndex) % ZONE_COLORS.length].hex;
}

/**
 * The colour a pin should be.
 *
 * `colorIndexOf` reads the roster, which is the single source of truth. The pin's
 * own `driver.colorIndex` is not used: the two queries refetch independently, so
 * in the window where one has updated and the other has not, a swatch would
 * disagree with its pins.
 */
export function pinColour(
  pin: MapPinDto,
  mode: ColourMode,
  colorIndexOf: (driverId: string) => number | undefined,
): string {
  if (mode === 'driver' && pin.driver) {
    const index = colorIndexOf(pin.driver.id);
    if (index !== undefined) return driverColour(index);
  }
  return statusColorVar(pin.status as TaskStatus);
}

/**
 * The letter names the END of the job the marker sits on — D at the drop-off
 * address, P at the collection address — not the job type. The type filter and
 * the widget badge already say what kind of job it is; on the map the useful
 * question is "which end am I looking at?", and that reading survives switching
 * the plotted end and drawing the other end as a ring. Legible without colour,
 * for greyscale and colour-blindness.
 */
export function endGlyph(end: PlotEnd): string {
  return end === 'pickup' ? 'P' : 'D';
}

const ringCache = new Map<string, L.DivIcon>();

/**
 * The OTHER end of the open job: a hollow ring in the pin's colour, so the two
 * ends read as one job without a second filled pin competing for attention.
 * A centre-anchored circle rather than a teardrop — it marks a point instead of
 * pointing at one, which is what tells it apart from a pin at a glance.
 */
export function endRingIcon(colour: string, glyph: string): L.DivIcon {
  const key = `${colour}|${glyph}`;
  const hit = ringCache.get(key);
  if (hit) return hit;

  const size = 20;
  const icon = L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:#fff;border:2px solid ${colour};
      box-shadow:0 2px 6px rgba(26,26,46,.35);
      display:flex;align-items:center;justify-content:center;
      color:${colour};font:600 10px system-ui;">${glyph}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  ringCache.set(key, icon);
  return icon;
}

export interface PinLook {
  colour: string;
  glyph: string;
  /** This pin's widget is open. */
  selected: boolean;
  /**
   * This pin is in the multi-selection (ctrl-click or lasso).
   *
   * A separate flag from `selected`, not a reuse of it: "the card is open" and
   * "this is one of the twelve I am about to bulk-assign" are different states
   * and an operator needs to tell them apart at a glance.
   */
  inSelection: boolean;
  /** Orders sharing this exact coordinate. >1 draws a count badge. */
  count: number;
}

/**
 * Module-level cache, not `useMemo`.
 *
 * Passing a fresh `icon` makes react-leaflet call `setIcon()`, which tears down
 * and rebuilds the marker's DOM element — so one parent render would rebuild
 * every marker on screen. A per-marker `useMemo` would still miss on remount.
 * The key space is small (a handful of colours × 2 glyphs × selected × count),
 * so this stays bounded at a few dozen entries.
 */
const cache = new Map<string, L.DivIcon>();

export function pinIcon(look: PinLook): L.DivIcon {
  const key = `${look.colour}|${look.glyph}|${look.selected}|${look.inSelection}|${look.count}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = look.selected || look.inSelection ? 30 : 24;
  // Open card wins the ring, because only one pin can have it. Selection uses
  // the primary hue plus a halo, so a scattered multi-selection is readable
  // across the whole map without hunting for thicker borders.
  const ring = look.selected
    ? '3px solid var(--color-foreground)'
    : look.inSelection
      ? '3px solid var(--color-primary)'
      : '2px solid #fff';
  const glow = look.inSelection && !look.selected
    ? 'box-shadow:0 0 0 4px color-mix(in oklab, var(--color-primary) 30%, transparent),0 3px 8px rgba(26,26,46,.45);'
    : 'box-shadow:0 3px 8px rgba(26,26,46,.45);';
  const badge =
    look.count > 1
      ? `<span style="
          position:absolute;top:-6px;right:-6px;min-width:16px;height:16px;
          padding:0 3px;border-radius:9999px;background:var(--color-foreground);
          color:#fff;font:600 10px/16px system-ui;text-align:center;
          transform:rotate(45deg);">${look.count > 99 ? '99+' : look.count}</span>`
      : '';

  const icon = L.divIcon({
    className: '',
    html: `<div style="
      position:relative;width:${size}px;height:${size}px;
      border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      background:${look.colour};border:${ring};${glow}
      display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:#fff;font:600 11px system-ui">${look.glyph}</span>
      ${badge}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });

  cache.set(key, icon);
  return icon;
}

/**
 * A numbered stop on a planned route.
 *
 * Cached at module level like the task icons, and for the same reason: handing
 * react-leaflet a fresh icon object makes it call `setIcon()`, which rebuilds the
 * marker's DOM element. Reordering fifty stops would otherwise rebuild fifty
 * markers on every keystroke of a drag.
 */
const seqCache = new Map<string, L.DivIcon>();

export function seqIcon(seq: number, active: boolean, flagged: boolean): L.DivIcon {
  const key = `${seq}|${active ? 1 : 0}|${flagged ? 1 : 0}`;
  const hit = seqCache.get(key);
  if (hit) return hit;

  const size = active ? 32 : 26;
  // Amber for a stop that changed under the plan — the same signal the sidebar row
  // uses, so the two views cannot disagree about which stop needs attention.
  const bg = flagged ? 'var(--status-warning)' : '#4B3FCF';
  const ring = active
    ? 'box-shadow:0 0 0 3px rgba(75,63,207,.35),0 3px 10px rgba(26,26,46,.4);'
    : 'box-shadow:0 2px 6px rgba(26,26,46,.35);';

  const icon = L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;background:${bg};
      border:2.5px solid #fff;${ring}
      display:flex;align-items:center;justify-content:center;
      color:#fff;font:700 ${active ? 13 : 11}px system-ui">${seq}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  seqCache.set(key, icon);
  return icon;
}
