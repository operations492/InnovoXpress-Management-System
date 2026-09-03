import { TileLayer } from 'react-leaflet';

/**
 * Live traffic flow, from TomTom.
 *
 * A transparent PNG per tile on the **same grid as the OSM base**, so Leaflet
 * fetches only what is on screen and covers wherever the operator pans — no
 * bounding box, no backend, no endpoint of ours. Roads show through, coloured by
 * current speed against free-flow: green moving, amber slowing, red crawling.
 *
 * ## Two things to know before trusting it
 *
 * **Coverage is regional.** Measured directly: Toronto, Montreal, Ottawa, Calgary
 * and Vancouver all return 35–68 KB tiles of drawn roads; Lahore and Islamabad
 * return a 1,241-byte tile that is byte-identical between the two cities — the
 * "nothing to draw" PNG. Over Pakistan this layer renders blank, and that is the
 * data, not a bug.
 *
 * **The key ships in the bundle.** Vite inlines every `VITE_*` variable, which is
 * how every mapping provider expects tile keys to be used — but it means the key
 * should be scoped to map/tile products and domain-restricted in the TomTom
 * console. Do not reuse an all-products key here; a leaked tile key should be
 * boring, not billable for routing and search.
 */

const KEY = import.meta.env.VITE_TOMTOM_KEY ?? '';

/** Live flow is recomputed continuously; anything cached longer goes stale on screen. */
const REFRESH_MS = 120_000;

interface TrafficLayerProps {
  /** Bumped on a timer by the parent, so the tiles refetch rather than sit cached. */
  refreshToken?: number;
  /** `light` suits the Iris palette; `dark` is there for a future dark theme. */
  style?: 'light' | 'dark';
}

export function TrafficLayer({ refreshToken = 0, style = 'light' }: TrafficLayerProps) {
  // Nothing to draw without a key, and a request without one is a guaranteed 403.
  if (!KEY) return null;

  return (
    <TileLayer
      /*
       * `key` forces a remount when the token changes. Leaflet caches tiles by URL,
       * so without a changing URL the layer would show whatever traffic looked like
       * when it was first switched on — worse than showing nothing, because it
       * looks current.
       */
      key={refreshToken}
      url={
        `https://api.tomtom.com/maps/orbis/traffic/flow/raster/tile/{z}/{x}/{y}` +
        `?apiVersion=2&key=${KEY}&style=${style}&tileSize=256&t=${refreshToken}`
      }
      // Above the base map, below markers. Leaflet's tilePane is 200; markers are
      // 600, so pins stay clickable and on top.
      zIndex={250}
      opacity={0.9}
      attribution="Traffic &copy; TomTom"
    />
  );
}

export { REFRESH_MS as TRAFFIC_REFRESH_MS };
