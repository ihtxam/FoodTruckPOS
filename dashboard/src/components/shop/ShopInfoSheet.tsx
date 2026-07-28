import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polygon, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { summarizeStoreHours } from '@/lib/shop-hours-display';

type Zone = {
  id: string;
  name: string;
  polygon: [number, number][]; // lng,lat
  minOrderAmount: string | number;
  deliveryFee: string | number;
  color?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  merchant: any;
  zones: Zone[];
};

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#b91c1c;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/**
 * Store info sheet: map + delivery zones + hours + contact.
 */
export default function ShopInfoSheet({ open, onClose, merchant, zones }: Props) {
  const { t, locale } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  const center = useMemo((): [number, number] => {
    const lat = Number(merchant?.latitude);
    const lng = Number(merchant?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(Math.abs(lat) < 1e-5 && Math.abs(lng) < 1e-5)) {
      return [lat, lng];
    }
    return [46.8182, 8.2275];
  }, [merchant?.latitude, merchant?.longitude]);

  const hoursRows = useMemo(
    () => summarizeStoreHours(merchant?.storeHours, merchant?.channels, locale),
    [merchant?.storeHours, merchant?.channels, locale]
  );

  const mapsUrl =
    merchant?.latitude && merchant?.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${merchant.latitude},${merchant.longitude}`
      : merchant?.address
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
            `${merchant.address} ${merchant.city || ''}`
          )}`
        : null;

  if (!open && !mounted) return null;

  return (
    <div className={`fixed inset-0 z-[70] ${open ? '' : 'pointer-events-none'}`}>
      <button
        type="button"
        className={`absolute inset-0 bg-stone-900/40 transition ${open ? 'opacity-100' : 'opacity-0'}`}
        aria-label={t('shopClose')}
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 top-10 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl transition ${
          open ? 'translate-y-0 opacity-100' : 'translate-y-full sm:translate-y-4 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3 shrink-0">
          <div className="min-w-0">
            <p className="font-bold tracking-tight truncate uppercase text-sm sm:text-base">
              {merchant?.name}
            </p>
            <p className="text-[11px] text-stone-500 truncate">
              {[merchant?.address, merchant?.city].filter(Boolean).join(', ')}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200"
            onClick={onClose}
            aria-label={t('shopClose')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="h-52 w-full bg-stone-100">
            {mounted ? (
              <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom={false}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={center} icon={pinIcon} />
                {zones.map((z, i) => {
                  const ring = (z.polygon || [])
                    .map((p) => [Number(p[1]), Number(p[0])] as [number, number])
                    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
                  if (ring.length < 3) return null;
                  const color = z.color || ['#7c3aed', '#2563eb', '#ea580c', '#0d9488'][i % 4];
                  return (
                    <Polygon
                      key={z.id}
                      positions={ring}
                      pathOptions={{ color, fillColor: color, fillOpacity: 0.2, weight: 2 }}
                    />
                  );
                })}
              </MapContainer>
            ) : null}
          </div>

          {mapsUrl ? (
            <div className="px-4 py-2 border-b border-stone-100">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-rose-600 hover:underline"
              >
                {t('shopGetDirections')}
              </a>
            </div>
          ) : null}

          {zones.length > 0 ? (
            <div className="px-4 py-3 border-b border-stone-100 space-y-2">
              <p className="text-sm font-semibold">{t('shopDeliveryCosts')}</p>
              <ul className="space-y-1.5">
                {zones.map((z, i) => {
                  const color = z.color || ['#7c3aed', '#2563eb', '#ea580c', '#0d9488'][i % 4];
                  return (
                    <li key={z.id} className="flex items-start gap-2 text-sm">
                      <span
                        className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: color }}
                      />
                      <span className="min-w-0">
                        <span className="font-medium">{z.name}</span>
                        <span className="block text-stone-500 text-xs">
                          {t('shopZoneMinFee')
                            .replace('{min}', Number(z.minOrderAmount || 0).toFixed(2))
                            .replace('{fee}', Number(z.deliveryFee || 0).toFixed(2))}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="px-4 py-3 border-b border-stone-100 space-y-2">
            <p className="text-sm font-semibold">{t('shopOpeningHours')}</p>
            <div className="space-y-1 text-sm">
              {hoursRows.map((row) => (
                <div key={row.label} className="flex justify-between gap-3">
                  <span className="text-stone-600">{row.label}</span>
                  <span className="text-right font-medium tabular-nums">{row.hours}</span>
                </div>
              ))}
              {hoursRows.length === 0 ? (
                <p className="text-stone-500 text-xs">{t('shopHoursNotSet')}</p>
              ) : null}
            </div>
          </div>

          <div className="px-4 py-3 space-y-1 text-sm">
            <p className="font-semibold">{t('shopContact')}</p>
            {merchant?.phone ? <p className="text-stone-700">{merchant.phone}</p> : null}
            {(merchant?.address || merchant?.city) && (
              <p className="text-stone-600">
                {[merchant.address, merchant.city].filter(Boolean).join(', ')}
              </p>
            )}
            <p className="text-[11px] text-stone-400 pt-2">
              {locale === 'de'
                ? 'Lieferzonen und Öffnungszeiten können sich ändern.'
                : locale === 'fr'
                  ? 'Les zones et horaires peuvent changer.'
                  : 'Zones and hours may change.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
