import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import ZoneMapEditor, {
  leafletToLngLat,
  lngLatToLeaflet,
  type LatLngTuple,
  type LngLatTuple,
} from '@/components/ZoneMapEditor';
import { useI18n } from '@/lib/i18n';

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
] as const;

const CHANNELS = [
  { key: 'takeaway', label: 'Pickup / take away' },
  { key: 'dine_in', label: 'Dine in' },
  { key: 'delivery', label: 'Delivery' },
] as const;

type Slot = { open: string; close: string };
type ChannelHours = Record<string, Slot[]>;
type StoreHours = Record<string, ChannelHours>;

interface Zone {
  id: string;
  name: string;
  polygon: LngLatTuple[];
  minOrderAmount: string;
  deliveryFee: string;
  estimatedMinutes?: number | null;
  color?: string | null;
  isActive: boolean;
  zipCodes?: string[];
}

/** Default: lunch + dinner split (11–14 and 17–23). */
function emptyHours(): StoreHours {
  const lunchDinner: Slot[] = [
    { open: '11:00', close: '14:00' },
    { open: '17:00', close: '23:00' },
  ];
  const mk = (): ChannelHours =>
    Object.fromEntries(DAYS.map((d) => [d.key, lunchDinner.map((s) => ({ ...s }))]));
  return { takeaway: mk(), dine_in: mk(), delivery: mk() };
}

function mergeHours(saved: StoreHours | null | undefined): StoreHours {
  const base = emptyHours();
  if (!saved || typeof saved !== 'object') return base;
  const out: StoreHours = { ...base };
  for (const ch of CHANNELS) {
    const incoming = saved[ch.key];
    if (!incoming || typeof incoming !== 'object') continue;
    const dayMap: ChannelHours = { ...(base[ch.key] || {}) };
    for (const d of DAYS) {
      const slots = incoming[d.key];
      if (Array.isArray(slots)) {
        dayMap[d.key] = slots
          .filter((s) => s && s.open && s.close)
          .map((s) => ({ open: s.open, close: s.close }));
      }
    }
    out[ch.key] = dayMap;
  }
  return out;
}

function resetZoneForm() {
  return {
    zoneName: '',
    minOrder: '20',
    deliveryFee: '5',
    eta: '45',
    color: '#0d9488',
    zipCodes: '',
    draftRing: [] as LatLngTuple[],
    editingId: null as string | null,
  };
}

export default function OnlineShop() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [savingHours, setSavingHours] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [hours, setHours] = useState<StoreHours>(emptyHours());
  const [hoursChannel, setHoursChannel] = useState<(typeof CHANNELS)[number]['key']>('takeaway');
  const [zones, setZones] = useState<Zone[]>([]);

  const [zoneName, setZoneName] = useState('');
  const [minOrder, setMinOrder] = useState('20');
  const [deliveryFee, setDeliveryFee] = useState('5');
  const [eta, setEta] = useState('45');
  const [color, setColor] = useState('#0d9488');
  const [zipCodes, setZipCodes] = useState('');
  const [draftRing, setDraftRing] = useState<LatLngTuple[]>([]);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [savingZone, setSavingZone] = useState(false);
  const [keepExistingPolygon, setKeepExistingPolygon] = useState(false);

  const mapCenter = useMemo<LatLngTuple>(() => {
    const lat = Number(settings?.latitude);
    const lng = Number(settings?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    return [46.99, 6.93];
  }, [settings]);

  const otherZones = useMemo(
    () => zones.filter((z) => z.id !== editingZoneId),
    [zones, editingZoneId]
  );

  const load = async () => {
    try {
      const [s, z] = await Promise.all([
        api.get('/merchant/settings'),
        api.get('/delivery-zones'),
      ]);
      const settingsData = s.data.settings;
      setSettings(settingsData);
      setHours(mergeHours(settingsData.storeHours));
      setZones(z.data.zones || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load shop settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setDaySlots = (day: string, slots: Slot[]) => {
    setHours((prev) => {
      const channel = { ...(prev[hoursChannel] || {}) };
      channel[day] = slots;
      return { ...prev, [hoursChannel]: channel };
    });
  };

  const updateSlot = (day: string, index: number, field: 'open' | 'close', value: string) => {
    const slots = [...(hours[hoursChannel]?.[day] || [])];
    if (!slots[index]) return;
    slots[index] = { ...slots[index], [field]: value };
    setDaySlots(day, slots);
  };

  const addSlot = (day: string) => {
    const slots = [...(hours[hoursChannel]?.[day] || [])];
    slots.push({ open: '17:00', close: '23:00' });
    setDaySlots(day, slots);
  };

  const removeSlot = (day: string, index: number) => {
    const slots = [...(hours[hoursChannel]?.[day] || [])];
    slots.splice(index, 1);
    setDaySlots(day, slots);
  };

  const clearDay = (day: string) => setDaySlots(day, []);

  const openDayDefault = (day: string) =>
    setDaySlots(day, [
      { open: '11:00', close: '14:00' },
      { open: '17:00', close: '23:00' },
    ]);

  const copyDayToAll = (day: string) => {
    const slots = hours[hoursChannel]?.[day] || [];
    setHours((prev) => {
      const channel: ChannelHours = {};
      DAYS.forEach((d) => {
        channel[d.key] = slots.map((s) => ({ ...s }));
      });
      return { ...prev, [hoursChannel]: channel };
    });
  };

  const onSaveShopMeta = async (e: FormEvent) => {
    e.preventDefault();
    setSavingHours(true);
    try {
      const response = await api.put('/merchant/settings', {
        shopEnabled: settings.shopEnabled,
        pickupEnabled: settings.pickupEnabled,
        dineInEnabled: settings.dineInEnabled,
        deliveryEnabled: settings.deliveryEnabled,
        storeHours: hours,
        latitude: settings.latitude,
        longitude: settings.longitude,
        pickupEtaMinutes: Number(settings.pickupEtaMinutes || 25),
        deliveryEtaMinutes: Number(settings.deliveryEtaMinutes || 45),
        shopLogoUrl: settings.shopLogoUrl,
        shopBannerUrl: settings.shopBannerUrl,
        slug: settings.slug,
        subdomain: settings.subdomain,
      });
      setSettings((prev: any) => ({ ...prev, ...(response.data.merchant || {}) }));
      toast.success('Shop hours & channels saved');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Save failed');
    } finally {
      setSavingHours(false);
    }
  };

  const clearZoneEditor = () => {
    const reset = resetZoneForm();
    setZoneName(reset.zoneName);
    setMinOrder(reset.minOrder);
    setDeliveryFee(reset.deliveryFee);
    setEta(reset.eta);
    setColor(reset.color);
    setZipCodes(reset.zipCodes);
    setDraftRing(reset.draftRing);
    setEditingZoneId(null);
    setKeepExistingPolygon(false);
  };

  const startEditZone = (zone: Zone) => {
    setEditingZoneId(zone.id);
    setZoneName(zone.name);
    setMinOrder(String(zone.minOrderAmount ?? '0'));
    setDeliveryFee(String(zone.deliveryFee ?? '0'));
    setEta(String(zone.estimatedMinutes ?? 45));
    setColor(zone.color || '#0d9488');
    setZipCodes((zone.zipCodes || []).join(', '));
    // Load polygon into draft for visual edit; keep flag so save works without redraw
    const ring = lngLatToLeaflet(zone.polygon || []);
    // Drop closing duplicate point if present
    const openRing =
      ring.length > 1 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
        ? ring.slice(0, -1)
        : ring;
    setDraftRing(openRing);
    setKeepExistingPolygon(true);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const onSaveZone = async (e: FormEvent) => {
    e.preventDefault();
    const editing = !!editingZoneId;
    const hasDraft = draftRing.length >= 3;
    if (!editing && !hasDraft) {
      toast.error('Draw at least 3 points on the map');
      return;
    }
    if (editing && !hasDraft && !keepExistingPolygon) {
      toast.error('Draw at least 3 points, or keep the existing shape');
      return;
    }

    setSavingZone(true);
    try {
      const payload: Record<string, unknown> = {
        name: zoneName,
        minOrderAmount: Number(minOrder),
        deliveryFee: Number(deliveryFee),
        estimatedMinutes: Number(eta),
        color,
        zipCodes: zipCodes
          .split(',')
          .map((z) => z.trim())
          .filter(Boolean),
      };
      if (hasDraft) {
        payload.polygon = leafletToLngLat(draftRing);
      }

      if (editingZoneId) {
        await api.put(`/delivery-zones/${editingZoneId}`, payload);
        toast.success('Delivery zone updated');
      } else {
        await api.post('/delivery-zones', payload);
        toast.success('Delivery zone created');
      }
      clearZoneEditor();
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save zone');
    } finally {
      setSavingZone(false);
    }
  };

  const onDeleteZone = async (id: string) => {
    if (!confirm('Delete this delivery zone?')) return;
    try {
      await api.delete(`/delivery-zones/${id}`);
      toast.success('Deleted');
      if (editingZoneId === id) clearZoneEditor();
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Delete failed');
    }
  };

  if (loading) return <div className="text-center py-12">Loading online shop…</div>;
  if (!settings) return <div className="card">Could not load settings.</div>;

  const channelHours = hours[hoursChannel] || {};

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold mb-1">{t('shop')}</h1>
        <p className="text-gray-600 mb-4">
          Channels, opening hours (multiple ranges per day), and map-drawn delivery zones.
        </p>
        {settings.shopPathUrl && (
          <p className="text-sm mb-4">
            Public shop:{' '}
            <a className="text-teal-700 underline" href={settings.shopPathUrl} target="_blank" rel="noreferrer">
              {settings.shopPathUrl}
            </a>
          </p>
        )}

        <form onSubmit={onSaveShopMeta} className="space-y-5">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!settings.shopEnabled}
                onChange={(e) => setSettings({ ...settings, shopEnabled: e.target.checked })}
              />
              Shop enabled
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!settings.pickupEnabled}
                onChange={(e) => setSettings({ ...settings, pickupEnabled: e.target.checked })}
              />
              Pickup
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!settings.dineInEnabled}
                onChange={(e) => setSettings({ ...settings, dineInEnabled: e.target.checked })}
              />
              Dine in
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!settings.deliveryEnabled}
                onChange={(e) => setSettings({ ...settings, deliveryEnabled: e.target.checked })}
              />
              Delivery
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Pickup ETA (min)</label>
              <input
                className="input"
                type="number"
                value={settings.pickupEtaMinutes ?? 25}
                onChange={(e) => setSettings({ ...settings, pickupEtaMinutes: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Delivery ETA (min)</label>
              <input
                className="input"
                type="number"
                value={settings.deliveryEtaMinutes ?? 45}
                onChange={(e) => setSettings({ ...settings, deliveryEtaMinutes: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Store latitude</label>
              <input
                className="input"
                value={settings.latitude || ''}
                onChange={(e) => setSettings({ ...settings, latitude: e.target.value })}
                placeholder="46.99"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Store longitude</label>
              <input
                className="input"
                value={settings.longitude || ''}
                onChange={(e) => setSettings({ ...settings, longitude: e.target.value })}
                placeholder="6.93"
              />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {CHANNELS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`px-3 py-1.5 text-sm border ${
                    hoursChannel === c.key ? 'bg-stone-900 text-white' : 'bg-white'
                  }`}
                  onClick={() => setHoursChannel(c.key)}
                >
                  {c.label} hours
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Add several open/close ranges per day (e.g. 11:00–14:00 and 17:00–23:00).
            </p>
            <div className="space-y-4">
              {DAYS.map((d) => {
                const slots = channelHours[d.key] || [];
                return (
                  <div key={d.key} className="border border-stone-200 rounded-lg p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="font-semibold">{d.label}</span>
                      <div className="flex flex-wrap gap-2 text-sm">
                        {slots.length === 0 ? (
                          <button type="button" className="text-teal-700" onClick={() => openDayDefault(d.key)}>
                            Open day
                          </button>
                        ) : (
                          <>
                            <button type="button" className="text-teal-700" onClick={() => addSlot(d.key)}>
                              + Time range
                            </button>
                            <button type="button" className="text-red-600" onClick={() => clearDay(d.key)}>
                              Closed
                            </button>
                          </>
                        )}
                        <button type="button" className="text-gray-600" onClick={() => copyDayToAll(d.key)}>
                          Copy → week
                        </button>
                      </div>
                    </div>
                    {slots.length === 0 ? (
                      <p className="text-sm text-gray-500">Closed</p>
                    ) : (
                      <div className="space-y-2">
                        {slots.map((slot, idx) => (
                          <div key={`${d.key}-${idx}`} className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-gray-500 w-14">Range {idx + 1}</span>
                            <input
                              type="time"
                              className="input w-auto"
                              value={slot.open}
                              onChange={(e) => updateSlot(d.key, idx, 'open', e.target.value)}
                            />
                            <span className="text-gray-400">–</span>
                            <input
                              type="time"
                              className="input w-auto"
                              value={slot.close}
                              onChange={(e) => updateSlot(d.key, idx, 'close', e.target.value)}
                            />
                            <button
                              type="button"
                              className="text-sm text-red-600"
                              onClick={() => removeSlot(d.key, idx)}
                              disabled={slots.length === 1}
                              title="Remove this range"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={savingHours}>
            {savingHours ? 'Saving…' : 'Save channels & hours'}
          </button>
        </form>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Delivery zones</h2>
            <p className="text-gray-600 text-sm">
              Draw or edit zones on the map. Set minimum order and delivery fee per zone.
            </p>
          </div>
          {editingZoneId && (
            <button type="button" className="btn-secondary" onClick={clearZoneEditor}>
              Cancel edit
            </button>
          )}
        </div>

        <ZoneMapEditor
          center={mapCenter}
          storeMarker={
            Number.isFinite(Number(settings.latitude)) && Number.isFinite(Number(settings.longitude))
              ? [Number(settings.latitude), Number(settings.longitude)]
              : null
          }
          existingZones={otherZones}
          draftRing={draftRing}
          onDraftChange={(ring) => {
            setDraftRing(ring);
            // Clearing while editing keeps the saved polygon unless a new shape is drawn
            if (ring.length === 0 && editingZoneId) {
              setKeepExistingPolygon(true);
            } else if (ring.length > 0) {
              setKeepExistingPolygon(false);
            }
          }}
        />

        <form onSubmit={onSaveZone} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3 text-sm font-medium">
            {editingZoneId ? 'Editing zone' : 'New zone'}
            {editingZoneId && keepExistingPolygon && draftRing.length >= 3 && (
              <span className="text-gray-500 font-normal"> — existing shape loaded (redraw optional)</span>
            )}
          </div>
          <input
            className="input"
            placeholder="Zone name (Center)"
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            required
          />
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="Min order CHF"
            value={minOrder}
            onChange={(e) => setMinOrder(e.target.value)}
            required
          />
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="Delivery fee CHF"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            required
          />
          <input
            className="input"
            type="number"
            placeholder="ETA minutes"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
          />
          <input
            className="input"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            title="Zone color"
          />
          <input
            className="input"
            placeholder="ZIP codes (optional, comma-separated)"
            value={zipCodes}
            onChange={(e) => setZipCodes(e.target.value)}
          />
          <div className="md:col-span-3 flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={savingZone}>
              {savingZone
                ? 'Saving…'
                : editingZoneId
                  ? `Update zone (${draftRing.length} points)`
                  : `Save zone (${draftRing.length} points)`}
            </button>
            {editingZoneId && (
              <button type="button" className="btn-secondary" onClick={clearZoneEditor}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Zone</th>
              <th className="py-2">Min order</th>
              <th className="py-2">Fee</th>
              <th className="py-2">ETA</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {zones.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-gray-500">
                  No zones yet — draw one on the map.
                </td>
              </tr>
            )}
            {zones.map((z) => (
              <tr
                key={z.id}
                className={`border-b last:border-0 ${editingZoneId === z.id ? 'bg-amber-50' : ''}`}
              >
                <td className="py-3 font-medium">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ background: z.color || '#0d9488' }}
                    />
                    {z.name}
                  </span>
                </td>
                <td className="py-3">CHF {Number(z.minOrderAmount).toFixed(2)}</td>
                <td className="py-3">CHF {Number(z.deliveryFee).toFixed(2)}</td>
                <td className="py-3">{z.estimatedMinutes || 45} min</td>
                <td className="py-3 text-right space-x-3">
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => startEditZone(z)}>
                    Edit
                  </button>
                  <button type="button" className="text-red-600 hover:underline" onClick={() => onDeleteZone(z.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
