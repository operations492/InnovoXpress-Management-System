import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Keeps Leaflet's idea of its own size honest.
 *
 * A map measured while its container is 0 wide paints only the top-left tile and
 * looks grey — the failure `CLAUDE.md` warns about for modals. On a page it bites
 * differently: collapsing the sidebar changes the map's width without a window
 * resize, so Leaflet never hears about it.
 *
 * Debounced, because a CSS transition fires this on every frame.
 */
export function InvalidateOnResize() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let timer: number | undefined;

    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => map.invalidateSize(), 100);
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [map]);

  return null;
}
