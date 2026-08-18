import L from 'leaflet';

/**
 * Shared Leaflet markers for places and drivers.
 *
 * Lifted out of `DriverLocationModal` when a second screen needed the same marks:
 * two screens drawing "the pickup" or "a driver" differently is the kind of drift
 * that makes an operator distrust both. This module is the one definition.
 *
 * All of these are `divIcon`s rather than Leaflet's default marker, whose image
 * path is rewritten by the bundler and renders as a broken-image square.
 */

/** A fixed place — a teardrop pin with a letter. `P` pickup, `D` delivery. */
export const placeIcon = (colour: string, glyph: string) =>
  L.divIcon({
    className: '',
    html: `<div style="
      width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      background:${colour};border:2px solid #fff;box-shadow:0 3px 8px rgba(26,26,46,.45);
      display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:#fff;font:600 11px system-ui">${glyph}</span>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });

/**
 * The rider, in full — pulsing halo and a heading arrow.
 *
 * The badge stays upright: rotating the whole thing would leave the bike upside
 * down on a southbound heading. Only the arrow spins, which is what carries the
 * direction.
 *
 * Deliberately loud, so use it for ONE driver. Six of these on a city view is
 * unreadable — that is what `driverDotIcon` is for.
 */
export const driverIcon = (headingDeg: number | null) =>
  L.divIcon({
    className: '',
    html: `<div style="position:relative;width:46px;height:46px">
      <span style="position:absolute;inset:3px;border-radius:50%;background:#16A34A;opacity:.22;
        animation:ixpulse 1.9s ease-out infinite"></span>
      ${
        headingDeg === null
          ? ''
          : `<div style="position:absolute;inset:0;transform:rotate(${headingDeg}deg)">
               <div style="position:absolute;left:50%;top:-1px;transform:translateX(-50%);width:0;height:0;
                 border-left:7px solid transparent;border-right:7px solid transparent;
                 border-bottom:11px solid #15803D;
                 filter:drop-shadow(0 1px 2px rgba(26,26,46,.4))"></div>
             </div>`
      }
      <div style="position:absolute;inset:8px;border-radius:50%;background:#16A34A;
        border:2.5px solid #fff;box-shadow:0 3px 10px rgba(26,26,46,.45);
        display:flex;align-items:center;justify-content:center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="5" cy="16.5" r="3.2"/>
          <circle cx="19" cy="16.5" r="3.2"/>
          <path d="M5 16.5h4.5l3-5.5H17"/>
          <path d="M12.5 11 11 7.5H8.5"/>
          <path d="M16 11l3 5.5"/>
        </svg>
      </div>
    </div>
    <style>@keyframes ixpulse{0%{transform:scale(.55);opacity:.45}100%{transform:scale(1.5);opacity:0}}</style>`,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });

/** First letters of a name, for a marker too small to hold the whole thing. */
export function markerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * A driver in a crowd — compact, initials, no animation.
 *
 * Cached per (initials, rank, selected) at module level: handing react-leaflet a
 * fresh `icon` object makes it call `setIcon()`, which rebuilds the marker's DOM
 * element. With a poll running that would rebuild every marker every tick and
 * eat the click the operator was in the middle of.
 */
const dotCache = new Map<string, L.DivIcon>();

export function driverDotIcon(opts: {
  name: string;
  /** 1-based position in the ranking; shown instead of initials when known. */
  rank?: number | null;
  selected?: boolean;
  /** Dimmed styling for a driver whose position could not be measured. */
  muted?: boolean;
}): L.DivIcon {
  const label = opts.rank != null ? String(opts.rank) : markerInitials(opts.name);
  const key = `${label}|${opts.selected ? 1 : 0}|${opts.muted ? 1 : 0}`;
  const hit = dotCache.get(key);
  if (hit) return hit;

  const size = opts.selected ? 34 : 28;
  const bg = opts.muted ? '#94A3B8' : '#16A34A';
  // The selected driver gets a ring rather than a bigger colour change, so the
  // list selection and the map selection read as the same state.
  const ring = opts.selected ? 'box-shadow:0 0 0 3px rgba(22,163,74,.35),0 3px 10px rgba(26,26,46,.4);' : 'box-shadow:0 2px 6px rgba(26,26,46,.35);';

  const icon = L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;background:${bg};
      border:2.5px solid #fff;${ring}
      display:flex;align-items:center;justify-content:center;
      color:#fff;font:700 ${opts.selected ? 13 : 11}px system-ui;letter-spacing:.02em">
      ${label}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  dotCache.set(key, icon);
  return icon;
}
