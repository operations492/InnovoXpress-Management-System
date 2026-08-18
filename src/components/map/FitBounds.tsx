import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface FitBoundsProps {
  /**
   * What the camera is framed FOR — e.g. `tasks:unassigned` or `driver:abc`.
   * Intent, not data: a refetch produces the same string and therefore never
   * moves the map.
   */
  intent: string;
  anchors: Array<[number, number]>;
  /** Bump to demand a real zoom-to-fit — the "Fit to tasks" button. */
  fitToken: number;
}

/**
 * Picks a point that is guaranteed to have a task on it.
 *
 * The obvious choice — the centroid — is an average, not a place. The centroid of
 * 176 orders scattered over 4 km can easily have nothing within a screen of it at
 * working zoom, which lands the operator on empty map. Panning to the *pin
 * nearest* the centroid keeps the same intent (the middle of the set) while
 * guaranteeing at least one marker is visible.
 */
function nearestToCentre(anchors: Array<[number, number]>): [number, number] {
  let sumLat = 0;
  let sumLng = 0;
  for (const [lat, lng] of anchors) {
    sumLat += lat;
    sumLng += lng;
  }
  const cLat = sumLat / anchors.length;
  const cLng = sumLng / anchors.length;

  let best = anchors[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    // Squared euclidean on degrees: fine for ranking points within one city.
    const d = (anchor[0] - cLat) ** 2 + (anchor[1] - cLng) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = anchor;
    }
  }
  return best;
}

/**
 * Moves the camera, and guards the operator's zoom.
 *
 * `MapContainer` ignores `center`/`zoom` after mount, so all camera work happens
 * here. The rules:
 *
 *  - **Zoom changes twice only** — the very first fit (no user choice to
 *    preserve yet) and the fit button.
 *  - **Every change of intent re-centres at the current zoom** — switching tab,
 *    sub-tab, or driver slides the map onto the nearest task in the new set.
 *  - **Data never moves anything.** Refetches, realtime invalidations, recolours
 *    and search keystrokes are not intents.
 */
export function FitBounds({ intent, anchors, fitToken }: FitBoundsProps) {
  const map = useMap();
  const framedFor = useRef<string | null>(null);
  const lastFitToken = useRef(fitToken);
  const programmatic = useRef(false);

  useEffect(() => {
    // L.latLngBounds([]) is invalid and fitBounds throws on it. Returning
    // without recording the intent means we act as soon as pins do arrive.
    if (anchors.length === 0) return;

    const explicitFit = fitToken !== lastFitToken.current;
    const firstFit = framedFor.current === null;
    const intentChanged = framedFor.current !== intent;

    if (!explicitFit && !firstFit && !intentChanged) return;

    lastFitToken.current = fitToken;
    framedFor.current = intent;
    programmatic.current = true;

    if (explicitFit || firstFit) {
      // The only two moments zoom is allowed to change.
      map.fitBounds(L.latLngBounds(anchors), { padding: [48, 48], maxZoom: 13 });
    } else {
      map.panTo(nearestToCentre(anchors));
    }

    map.once('moveend', () => {
      programmatic.current = false;
    });
  }, [map, intent, anchors, fitToken]);

  return null;
}
