import { memo } from 'react';
import L from 'leaflet';
import { Marker, Tooltip } from 'react-leaflet';
import type { DriverLatestDto } from '@/lib/api';
import { driverColour } from './pins/pinIcon';
import { POSITION_LIVE_SECONDS } from './hooks/useDriverPositions';

/**
 * Live driver pins.
 *
 * Deliberately a different shape from a task pin — a circle with initials, not a
 * teardrop — because an operator scanning the map must never have to work out
 * whether a marker is a job or a person. Colour still comes from the roster's
 * `mapColorIndex`, so a driver is the same hue here as on the tasks they carry.
 */

/**
 * Module-level cache, keyed on everything that affects the HTML.
 *
 * A fresh `icon` object makes react-leaflet call `setIcon()`, which rebuilds the
 * marker's DOM element. With positions arriving several times a second that
 * would rebuild every pin continuously and eat the click an operator was making.
 */
const iconCache = new Map<string, L.DivIcon>();

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function driverPin(name: string, colour: string, stale: boolean, open: boolean): L.DivIcon {
  const label = initials(name);
  const key = `${label}|${colour}|${stale ? 1 : 0}|${open ? 1 : 0}`;
  const hit = iconCache.get(key);
  if (hit) return hit;

  const size = open ? 36 : 30;
  const icon = L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${colour};${stale ? 'opacity:.45;' : ''}
      border:2.5px solid #fff;
      box-shadow:${open ? `0 0 0 3px ${colour}55,` : ''}0 2px 6px rgba(26,26,46,.4);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font:700 ${open ? 13 : 11}px system-ui;letter-spacing:.02em;cursor:pointer"
    >${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  iconCache.set(key, icon);
  return icon;
}

function ago(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

interface DriverLayerProps {
  positions: DriverLatestDto[];
  /** From the roster — the single source of truth for a driver's hue. */
  colorIndexOf: (driverId: string) => number | undefined;
  /** Opens the driver widget. Must be `useCallback`-stable or every marker remounts. */
  onSelect: (driverId: string) => void;
  openDriverId: string | null;
}

function DriverLayerImpl({ positions, colorIndexOf, onSelect, openDriverId }: DriverLayerProps) {
  const now = Date.now();

  return (
    <>
      {positions.map((d) => {
        const index = colorIndexOf(d.driverId);
        const colour = index !== undefined ? driverColour(index) : '#64748B';
        /*
         * Stale pins fade, they do not vanish. "Ali, last seen 6 minutes ago" is
         * information an operator can act on; a pin that quietly disappears just
         * looks like the driver was never there.
         */
        const stale = (now - Date.parse(d.recordedAt)) / 1000 > POSITION_LIVE_SECONDS;
        const open = d.driverId === openDriverId;

        return (
          <Marker
            key={d.driverId}
            position={[d.lat, d.lng]}
            icon={driverPin(d.name, colour, stale, open)}
            eventHandlers={{ click: () => onSelect(d.driverId) }}
            // Above task pins, so a driver is never hidden under the job they
            // are standing on — which is exactly when you want to see them.
            zIndexOffset={1000}
          >
            <Tooltip direction="top" offset={[0, -16]}>
              <span className="font-medium">{d.name}</span>
              <br />
              <span className="text-[11px]">
                {ago(d.recordedAt)}
                {stale && ' · stale'}
              </span>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}

export const DriverLayer = memo(DriverLayerImpl);
