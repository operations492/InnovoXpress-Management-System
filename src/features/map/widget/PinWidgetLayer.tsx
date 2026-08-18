import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';

interface PinWidgetLayerProps {
  lat: number;
  lng: number;
  children: ReactNode;
  onClose: () => void;
}

/**
 * The pin widget, anchored above its marker.
 *
 * A React overlay rather than `L.Popup`, for two reasons that both bite:
 * Leaflet's popup is owned by its marker and dies whenever the marker's icon is
 * replaced (which recolouring does), and it lives inside a CSS-transformed
 * ancestor, where `position: fixed` breaks — which would mis-position the modals
 * this widget's own buttons open.
 *
 * Portalled to `document.body`, so no transformed ancestor is involved at all.
 * Position is written straight to the element's transform inside a
 * requestAnimationFrame — never through state, because with hundreds of markers
 * mounted a setState per `move` frame would be unusable.
 */
export function PinWidgetLayer({ lat, lng, children, onClose }: PinWidgetLayerProps) {
  const map = useMap();
  const ref = useRef<HTMLDivElement | null>(null);
  const frame = useRef<number | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const point = map.latLngToContainerPoint([lat, lng]);
    const box = map.getContainer().getBoundingClientRect();
    const x = box.left + point.x;
    const y = box.top + point.y;

    // Flip below the pin when there is no room above. The northernmost order is
    // the common case, and a top-clipped widget is the obvious first bug.
    const roomAbove = y - box.top > el.offsetHeight + 24;
    const anchor = roomAbove ? 'calc(-100% - 18px)' : '18px';

    el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, ${anchor})`;
  }, [map, lat, lng]);

  const schedule = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null;
      place();
    });
  }, [place]);

  useEffect(() => {
    place();
    map.on('move zoom resize', schedule);
    return () => {
      map.off('move zoom resize', schedule);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [map, place, schedule]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="Task details"
      /*
       * z-40, deliberately UNDER Radix's z-50 dialog.
       *
       * This is portalled to body, so it is outside the map's isolated stacking
       * context and does not need to outrank Leaflet's panes — it only needs to
       * sit above the map section (which has no z-index) and below the View/Edit
       * modals this widget's own buttons open.
       */
      className="fixed top-0 left-0 z-40 w-72"
      // Wheel and pointer events must not reach the map underneath, or scrolling
      // the widget body would zoom the map.
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
