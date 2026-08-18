import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Shift-drag a rectangle to select the pins inside it.
 *
 * Drawn as a plain DOM overlay rather than an `L.Rectangle`, deliberately: a
 * Leaflet layer would be added and removed on every mouse move, churning the map's
 * layer list dozens of times a second for something the user only ever sees. A
 * single absolutely-positioned div follows the cursor with no map involvement at
 * all, and the map is only consulted once — on release — to convert two pixel
 * corners into geography.
 *
 * Two things it must do besides drawing:
 *
 *  - **Suspend map dragging while shift is held.** Leaflet's own drag handler would
 *    otherwise pan the map underneath the rectangle, so the box and the world move
 *    together and the selection lands somewhere else entirely.
 *  - **Ignore a click.** A shift-click with no movement is not a lasso; without a
 *    minimum size, every stray click would clear the selection.
 */

/** Pixels the pointer must travel before this counts as a drag, not a click. */
const MIN_DRAG_PX = 6;

interface RectangleSelectProps {
  /** Ids are resolved by the parent — this component knows only about geometry. */
  onSelect: (bounds: { north: number; south: number; east: number; west: number }, additive: boolean) => void;
  /** Turned off while a modal is open, so a stray shift-drag cannot fire behind it. */
  enabled?: boolean;
}

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  additive: boolean;
}

export function RectangleSelect({ onSelect, enabled = true }: RectangleSelectProps) {
  const map = useMap();
  const [box, setBox] = useState<Box | null>(null);
  // Mirrored so the document-level handlers, which are bound once, always read the
  // current drag without being rebound on every mouse move.
  const boxRef = useRef<Box | null>(null);
  boxRef.current = box;

  useEffect(() => {
    if (!enabled) return;
    const container = map.getContainer();

    const pointIn = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (e: MouseEvent) => {
      // Left button, shift held. Anything else is a normal map interaction.
      if (!e.shiftKey || e.button !== 0) return;
      e.preventDefault();

      // Without this the map pans under the rectangle and the selection lands
      // somewhere the operator never pointed at.
      map.dragging.disable();
      map.boxZoom.disable();

      const p = pointIn(e);
      // Ctrl/Cmd adds to what is already selected, so several sweeps can build one
      // selection across different parts of the city.
      setBox({ x1: p.x, y1: p.y, x2: p.x, y2: p.y, additive: e.ctrlKey || e.metaKey });
    };

    const onMove = (e: MouseEvent) => {
      if (!boxRef.current) return;
      const p = pointIn(e);
      setBox((b) => (b ? { ...b, x2: p.x, y2: p.y } : b));
    };

    const finish = () => {
      const b = boxRef.current;
      setBox(null);
      map.dragging.enable();
      map.boxZoom.enable();
      if (!b) return;

      // A shift-click is not a lasso. Without this every stray click would clear
      // the selection the operator just built.
      if (Math.abs(b.x2 - b.x1) < MIN_DRAG_PX && Math.abs(b.y2 - b.y1) < MIN_DRAG_PX) return;

      // The one moment the map is consulted: two pixel corners into geography.
      const a = map.containerPointToLatLng([Math.min(b.x1, b.x2), Math.min(b.y1, b.y2)]);
      const c = map.containerPointToLatLng([Math.max(b.x1, b.x2), Math.max(b.y1, b.y2)]);

      onSelect(
        {
          north: Math.max(a.lat, c.lat),
          south: Math.min(a.lat, c.lat),
          east: Math.max(a.lng, c.lng),
          west: Math.min(a.lng, c.lng),
        },
        b.additive,
      );
    };

    // Move and up on the document, not the container: a drag that leaves the map
    // must still finish, rather than leaving a rectangle stuck on screen and
    // dragging permanently disabled.
    container.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', finish);

    return () => {
      container.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', finish);
      map.dragging.enable();
      map.boxZoom.enable();
    };
  }, [map, onSelect, enabled]);

  if (!box) return null;

  const left = Math.min(box.x1, box.x2);
  const top = Math.min(box.y1, box.y2);
  const width = Math.abs(box.x2 - box.x1);
  const height = Math.abs(box.y2 - box.y1);

  return (
    <div
      aria-hidden
      data-testid="lasso-rect"
      // Above every Leaflet pane (popup is 700) but inside the map's own isolated
      // stacking context, so it cannot outrank a dialog.
      className="pointer-events-none absolute z-[750] rounded-[2px] border-2 border-danger bg-danger/10"
      style={{ left, top, width, height }}
    />
  );
}
