import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons broken by Vite bundling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export type LatLngTuple = [number, number]; // [lat, lng] for Leaflet UI
export type LngLatTuple = [number, number]; // [lng, lat] for Geo storage

interface ExistingZone {
  id: string;
  name: string;
  polygon: LngLatTuple[];
  color?: string | null;
}

interface Props {
  center: LatLngTuple;
  storeMarker?: LatLngTuple | null;
  existingZones?: ExistingZone[];
  draftRing: LatLngTuple[];
  onDraftChange: (ring: LatLngTuple[]) => void;
  height?: string;
}

function ClickCapture({
  enabled,
  onAdd,
}: {
  enabled: boolean;
  onAdd: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onAdd(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ center }: { center: LatLngTuple }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export function lngLatToLeaflet(ring: LngLatTuple[]): LatLngTuple[] {
  return (ring || []).map(([lng, lat]) => [lat, lng] as LatLngTuple);
}

export function leafletToLngLat(ring: LatLngTuple[]): LngLatTuple[] {
  return (ring || []).map(([lat, lng]) => [lng, lat] as LngLatTuple);
}

export default function ZoneMapEditor({
  center,
  storeMarker,
  existingZones = [],
  draftRing,
  onDraftChange,
  height = '420px',
}: Props) {
  const [drawing, setDrawing] = useState(true);

  const draftClosed = useMemo(() => {
    if (draftRing.length < 3) return draftRing;
    return [...draftRing, draftRing[0]];
  }, [draftRing]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          className={`btn-secondary ${drawing ? 'ring-2 ring-teal-600' : ''}`}
          onClick={() => setDrawing(true)}
        >
          Draw mode
        </button>
        <button type="button" className="btn-secondary" onClick={() => setDrawing(false)}>
          Pan mode
        </button>
        <button type="button" className="btn-secondary" onClick={() => onDraftChange([])}>
          Clear draft
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={draftRing.length === 0}
          onClick={() => onDraftChange(draftRing.slice(0, -1))}
        >
          Undo point
        </button>
        <span className="text-gray-500 self-center">
          {drawing
            ? 'Click the map to add polygon points (min. 3).'
            : 'Pan/zoom the map, then switch back to draw.'}
        </span>
      </div>
      <div className="overflow-hidden border border-stone-300 rounded-lg" style={{ height }}>
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Recenter center={center} />
          <ClickCapture
            enabled={drawing}
            onAdd={(lat, lng) => onDraftChange([...draftRing, [lat, lng]])}
          />
          {existingZones.map((z) => (
            <Polygon
              key={z.id}
              positions={lngLatToLeaflet(z.polygon || [])}
              pathOptions={{
                color: z.color || '#0d9488',
                fillColor: z.color || '#0d9488',
                fillOpacity: 0.2,
                weight: 2,
              }}
            />
          ))}
          {draftRing.length >= 2 && (
            <Polygon
              positions={draftClosed}
              pathOptions={{ color: '#b45309', fillColor: '#f59e0b', fillOpacity: 0.25, weight: 2 }}
            />
          )}
          {storeMarker && <Marker position={storeMarker} />}
        </MapContainer>
      </div>
    </div>
  );
}
