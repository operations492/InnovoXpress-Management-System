import type { ReactNode } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * The shared Leaflet shell.
 *
 * Three screens currently re-implement this same block. Kept deliberately
 * minimal — children, class and an initial camera, nothing else — so it does not
 * grow into a god component trying to serve the polygon editor and the trail
 * modal as well. Those are not migrated here on purpose.
 */

/** Lahore. A constant, so tiles start loading before any data arrives. */
export const DEFAULT_CENTER: [number, number] = [31.5204, 74.3587];
export const DEFAULT_ZOOM = 11;

interface MapCanvasProps {
  children?: ReactNode;
  className?: string;
  /** Only read on mount — MapContainer ignores later changes. Reframe via FitBounds. */
  initialCenter?: [number, number];
  initialZoom?: number;
}

export function MapCanvas({
  children,
  className,
  initialCenter = DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
}: MapCanvasProps) {
  return (
    <MapContainer
      center={initialCenter}
      zoom={initialZoom}
      scrollWheelZoom
      className={className}
      style={{ height: '100%', width: '100%' }}
    >
      {/*
       * OpenStreetMap's public tiles, as used by the existing three maps. Their
       * policy forbids production use, and a full-screen city view with hundreds
       * of pins is a far heavier load than a modal thumbnail — a keyed provider
       * belongs here before this ships. Centralised so that is a one-line change.
       */}
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {children}
    </MapContainer>
  );
}
