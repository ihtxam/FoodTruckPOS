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

/** Reject empty / Null Island (0,0) so the map does not open in the ocean. */
function parseStoreCoords(latRaw: unknown, lngRaw: unknown): LatLngTuple | null {
  if (latRaw == null || lngRaw == null || latRaw === '' || lngRaw === '') return null;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) < 1e-5 && Math.abs(lng) < 1e-5) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

const DEFAULT_MAP_CENTER: LatLngTuple = [46.8182, 8.2275]; // Switzerland overview

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
] as const;

type DayKey = (typeof DAYS)[number]['key'];
type HoursChannelKey = 'takeaway' | 'dine_in' | 'delivery' | 'display';

const ORDER_CHANNELS: { key: Exclude<HoursChannelKey, 'display'>; label: string }[] = [
  { key: 'takeaway', label: 'Pickup' },
  { key: 'dine_in', label: 'Dine in' },
  { key: 'delivery', label: 'Delivery' },
];

const ALL_CHANNELS: HoursChannelKey[] = ['takeaway', 'dine_in', 'delivery', 'display'];

/** Channels a quick schedule can be applied to (multi-select). */
const APPLY_CHANNELS: { key: HoursChannelKey; label: string; hint: string }[] = [
  {
    key: 'takeaway',
    label: 'Pickup',
    hint: 'Take away / pickup checkout hours',
  },
  {
    key: 'dine_in',
    label: 'Dine in',
    hint: 'Eat-in checkout hours',
  },
  {
    key: 'delivery',
    label: 'Delivery',
    hint: 'Home delivery checkout hours',
  },
  {
    key: 'display',
    label: 'Homepage banner',
    hint: 'Hours shown on the shop page — does not gate ordering',
  },
];

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

function cloneSlots(slots: Slot[]): Slot[] {
  return slots.map((s) => ({ open: s.open, close: s.close }));
}

function mkWeek(slots: Slot[]): ChannelHours {
  return Object.fromEntries(DAYS.map((d) => [d.key, cloneSlots(slots)]));
}

/** Default: lunch + dinner split (11–14 and 17–23). */
function emptyHours(): StoreHours {
  const lunchDinner: Slot[] = [
    { open: '11:00', close: '14:00' },
    { open: '17:00', close: '23:00' },
  ];
  return {
    takeaway: mkWeek(lunchDinner),
    dine_in: mkWeek(lunchDinner),
    delivery: mkWeek(lunchDinner),
    display: mkWeek(lunchDinner),
  };
}

function mergeHours(saved: StoreHours | null | undefined): StoreHours {
  const base = emptyHours();
  if (!saved || typeof saved !== 'object') return base;
  const out: StoreHours = { ...base };
  for (const ch of ALL_CHANNELS) {
    const incoming = saved[ch];
    if (!incoming || typeof incoming !== 'object') continue;
    const dayMap: ChannelHours = { ...(base[ch] || {}) };
    for (const d of DAYS) {
      const slots = incoming[d.key];
      if (Array.isArray(slots)) {
        dayMap[d.key] = slots
          .filter((s) => s && s.open && s.close)
          .map((s) => ({ open: s.open, close: s.close }));
      }
    }
    out[ch] = dayMap;
  }
  // Older saves without display → mirror takeaway for homepage banner
  if (!saved.display) out.display = mkWeekFromChannel(out.takeaway);
  return out;
}

function mkWeekFromChannel(ch: ChannelHours): ChannelHours {
  return Object.fromEntries(DAYS.map((d) => [d.key, cloneSlots(ch[d.key] || [])]));
}

function formatDaySlots(slots: Slot[] | undefined): string {
  if (!slots?.length) return 'Closed';
  return slots.map((s) => `${s.open}–${s.close}`).join(', ');
}

function summarizeChannel(ch: ChannelHours): string {
  // Collapse identical consecutive days for a compact summary
  const groups: { start: string; end: string; text: string }[] = [];
  for (const d of DAYS) {
    const text = formatDaySlots(ch[d.key]);
    const last = groups[groups.length - 1];
    if (last && last.text === text) {
      last.end = d.label;
    } else {
      groups.push({ start: d.label, end: d.label, text });
    }
  }
  return groups
    .map((g) => (g.start === g.end ? `${g.start} ${g.text}` : `${g.start}–${g.end} ${g.text}`))
    .join(' · ');
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
  const [selectedDays, setSelectedDays] = useState<DayKey[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [draftSlots, setDraftSlots] = useState<Slot[]>([
    { open: '11:00', close: '14:00' },
    { open: '17:00', close: '23:00' },
  ]);
  /** Mode currently being edited (schedules are independent per mode). */
  const [editChannel, setEditChannel] = useState<HoursChannelKey>('takeaway');
  /** Optional extras when applying the quick schedule (never overwrites unselected modes). */
  const [alsoCopyTo, setAlsoCopyTo] = useState<HoursChannelKey[]>([]);
  const [markClosed, setMarkClosed] = useState(false);
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
  const [locatingStore, setLocatingStore] = useState(false);

  const storeCoords = useMemo(
    () => parseStoreCoords(settings?.latitude, settings?.longitude),
    [settings?.latitude, settings?.longitude]
  );

  const mapCenter = useMemo<LatLngTuple>(() => storeCoords || DEFAULT_MAP_CENTER, [storeCoords]);

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
      return settingsData;
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load shop settings');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const locateStoreFromAddress = async (opts?: { silent?: boolean; settingsOverride?: any }) => {
    const src = opts?.settingsOverride || settings;
    if (!src) return null;
    setLocatingStore(true);
    try {
      const query = [src.address, src.city, src.country || 'Switzerland']
        .map((p: unknown) => String(p || '').trim())
        .filter(Boolean)
        .join(', ');
      if (!query) {
        if (!opts?.silent) toast.error('Set your business address in Settings first');
        return null;
      }
      const res = await api.post('/merchant/geocode', { query });
      if (!res.data.found) {
        if (!opts?.silent) toast.error('Could not find that address on the map');
        return null;
      }
      const lat = Number(res.data.lat);
      const lng = Number(res.data.lng);
      const coords = parseStoreCoords(lat, lng);
      if (!coords) {
        if (!opts?.silent) toast.error('Invalid coordinates for address');
        return null;
      }
      setSettings((prev: any) =>
        prev ? { ...prev, latitude: String(coords[0]), longitude: String(coords[1]) } : prev
      );
      // Persist so the next visit opens on the store
      try {
        await api.put('/merchant/settings', {
          latitude: coords[0],
          longitude: coords[1],
        });
      } catch {
        /* keep UI coords even if save fails */
      }
      if (!opts?.silent) toast.success('Map centered on store address');
      return coords;
    } catch (error: any) {
      if (!opts?.silent) {
        toast.error(error.response?.data?.error || 'Could not locate store address');
      }
      return null;
    } finally {
      setLocatingStore(false);
    }
  };

  useEffect(() => {
    void (async () => {
      const settingsData = await load();
      if (!settingsData) return;
      if (parseStoreCoords(settingsData.latitude, settingsData.longitude)) return;
      const hasAddress = Boolean(
        String(settingsData.address || '').trim() || String(settingsData.city || '').trim()
      );
      if (hasAddress) {
        await locateStoreFromAddress({ silent: true, settingsOverride: settingsData });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDay = (day: DayKey) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const selectPresetDays = (preset: 'all' | 'weekdays' | 'weekend') => {
    if (preset === 'all') setSelectedDays(DAYS.map((d) => d.key));
    else if (preset === 'weekdays') setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri']);
    else setSelectedDays(['sat', 'sun']);
  };

  const updateDraftSlot = (index: number, field: 'open' | 'close', value: string) => {
    setDraftSlots((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const toggleAlsoCopyTo = (key: HoursChannelKey) => {
    if (key === editChannel) return;
    setAlsoCopyTo((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectEditChannel = (key: HoursChannelKey) => {
    setEditChannel(key);
    setAlsoCopyTo((prev) => prev.filter((k) => k !== key));
  };

  const applyQuickSchedule = () => {
    if (!selectedDays.length) {
      toast.error('Select at least one day');
      return;
    }
    const slots = markClosed
      ? []
      : draftSlots.filter((s) => s.open && s.close).map((s) => ({ open: s.open, close: s.close }));
    if (!markClosed && !slots.length) {
      toast.error('Add at least one open–close time');
      return;
    }
    const channels = Array.from(new Set<HoursChannelKey>([editChannel, ...alsoCopyTo]));
    setHours((prev) => {
      const next: StoreHours = { ...prev };
      for (const ch of channels) {
        const dayMap: ChannelHours = { ...(next[ch] || {}) };
        for (const day of selectedDays) {
          dayMap[day] = cloneSlots(slots);
        }
        next[ch] = dayMap;
      }
      return next;
    });
    const dayLabel =
      selectedDays.length === 7
        ? 'every day'
        : selectedDays.map((k) => DAYS.find((d) => d.key === k)?.label || k).join(', ');
    const targetLabel = channels
      .map((k) => APPLY_CHANNELS.find((c) => c.key === k)?.label || k)
      .join(', ');
    toast.success(
      markClosed
        ? `Closed ${dayLabel} → ${targetLabel}`
        : `Set ${formatDaySlots(slots)} on ${dayLabel} → ${targetLabel}`
    );
  };

  const copyEditWeekTo = (targets: HoursChannelKey[]) => {
    const source = hours[editChannel] || {};
    const dest = targets.filter((t) => t !== editChannel);
    if (!dest.length) {
      toast.error('Choose at least one other mode to copy to');
      return;
    }
    setHours((prev) => {
      const next: StoreHours = { ...prev };
      for (const ch of dest) {
        next[ch] = mkWeekFromChannel(source);
      }
      return next;
    });
    toast.success(
      `Copied ${APPLY_CHANNELS.find((c) => c.key === editChannel)?.label || editChannel} week → ${dest
        .map((k) => APPLY_CHANNELS.find((c) => c.key === k)?.label || k)
        .join(', ')}`
    );
  };

  const setEditDaySlots = (day: string, slots: Slot[]) => {
    setHours((prev) => {
      const channel = { ...(prev[editChannel] || {}) };
      channel[day] = slots;
      return { ...prev, [editChannel]: channel };
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
        channelSelectMode: settings.channelSelectMode || 'checkout',
        storeHours: hours,
        latitude: settings.latitude,
        longitude: settings.longitude,
        pickupEtaMinutes: Number(settings.pickupEtaMinutes || 25),
        deliveryEtaMinutes: Number(settings.deliveryEtaMinutes || 45),
        deliveryMenuMarkup: Number(settings.deliveryMenuMarkup || 0),
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

  const editHours = hours[editChannel] || {};
  const editChannelLabel = APPLY_CHANNELS.find((c) => c.key === editChannel)?.label || editChannel;

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold mb-1">{t('shop')}</h1>
        <p className="text-gray-600 mb-4">
          Channels, smart opening hours, and map-drawn delivery zones.
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

          <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
            <label className="block text-sm font-medium">Ask pickup / delivery / dine-in</label>
            <p className="text-xs text-stone-500 leading-snug">
              Cleaner shops ask at checkout. Use a start popup if guests should choose before browsing.
            </p>
            <select
              className="input max-w-md"
              value={settings.channelSelectMode || 'checkout'}
              onChange={(e) => setSettings({ ...settings, channelSelectMode: e.target.value })}
            >
              <option value="checkout">At checkout (recommended)</option>
              <option value="popup_start">Popup when opening the menu</option>
              <option value="menu">Buttons on the menu page</option>
            </select>
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
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Delivery menu markup (CHF)
              </label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={settings.deliveryMenuMarkup ?? 0}
                onChange={(e) => setSettings({ ...settings, deliveryMenuMarkup: e.target.value })}
                placeholder="0"
              />
              <p className="text-xs text-stone-500 mt-1">
                Added to every item for delivery (e.g. 2.00 → delivery prices = takeaway + 2.00). Zone
                delivery fee is separate.
              </p>
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
            <div className="md:col-span-2 flex flex-wrap items-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={locatingStore}
                onClick={() => void locateStoreFromAddress()}
              >
                {locatingStore ? 'Locating…' : 'Locate from business address'}
              </button>
              <p className="text-xs text-stone-500">
                Uses the address from Settings → Business. The delivery map opens on this pin.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 space-y-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Opening hours</h2>
              <p className="text-sm text-stone-500 mt-0.5">
                Each mode has its own schedule. Edit Pickup and Dine in separately if Monday (or any day) differs.
              </p>
            </div>

            <div>
              <span className="text-sm font-medium block mb-2">Editing schedule for</span>
              <div className="flex flex-wrap gap-1.5 rounded-xl bg-white border border-stone-200 p-1">
                {APPLY_CHANNELS.map((opt) => {
                  const on = editChannel === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => selectEditChannel(opt.key)}
                      className={`flex-1 min-w-[6.5rem] rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                        on
                          ? 'bg-stone-900 text-white shadow-sm'
                          : 'text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-stone-500 mt-2 leading-snug">
                Changes below only update <strong>{editChannelLabel}</strong>
                {alsoCopyTo.length
                  ? ` (and ${alsoCopyTo
                      .map((k) => APPLY_CHANNELS.find((c) => c.key === k)?.label || k)
                      .join(', ')} when you apply)`
                  : ''}
                . Other modes stay unchanged.
              </p>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium">Quick set — days</span>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <button type="button" className="px-2 py-1 rounded border bg-white" onClick={() => selectPresetDays('all')}>
                    All week
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 rounded border bg-white"
                    onClick={() => selectPresetDays('weekdays')}
                  >
                    Weekdays
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 rounded border bg-white"
                    onClick={() => selectPresetDays('weekend')}
                  >
                    Weekend
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => {
                  const on = selectedDays.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDay(d.key)}
                      className={`min-w-[2.75rem] px-3 py-2 text-sm font-semibold rounded-lg border transition ${
                        on
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium">Hours</span>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded border bg-white"
                    onClick={() =>
                      setDraftSlots([
                        { open: '11:00', close: '14:00' },
                        { open: '17:00', close: '23:00' },
                      ])
                    }
                  >
                    Lunch + dinner
                  </button>
                  <label className="flex items-center gap-2 text-sm text-stone-600">
                    <input
                      type="checkbox"
                      checked={markClosed}
                      onChange={(e) => setMarkClosed(e.target.checked)}
                    />
                    Mark selected days closed
                  </label>
                </div>
              </div>
              {!markClosed && (
                <div className="space-y-2">
                  {draftSlots.map((slot, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-stone-500 w-16 shrink-0">
                        {idx === 0 ? 'Lunch' : idx === 1 ? 'Dinner' : `Range ${idx + 1}`}
                      </span>
                      <input
                        type="time"
                        className="input w-auto"
                        value={slot.open}
                        onChange={(e) => updateDraftSlot(idx, 'open', e.target.value)}
                      />
                      <span className="text-stone-400">to</span>
                      <input
                        type="time"
                        className="input w-auto"
                        value={slot.close}
                        onChange={(e) => updateDraftSlot(idx, 'close', e.target.value)}
                      />
                      {draftSlots.length > 1 && (
                        <button
                          type="button"
                          className="text-sm text-red-600"
                          onClick={() => setDraftSlots((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-sm font-medium text-teal-700"
                    onClick={() => setDraftSlots((prev) => [...prev, { open: '17:00', close: '23:00' }])}
                  >
                    + Add another range
                  </button>
                </div>
              )}
            </div>

            <div>
              <span className="text-sm font-medium block mb-2">Also apply to (optional)</span>
              <p className="text-[11px] text-stone-500 mb-2 leading-snug">
                Leave empty to change only {editChannelLabel}. Check other modes only when they should get the same times.
              </p>
              <div className="flex flex-wrap gap-2">
                {APPLY_CHANNELS.filter((c) => c.key !== editChannel).map((opt) => {
                  const on = alsoCopyTo.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleAlsoCopyTo(opt.key)}
                      aria-pressed={on}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ${
                        on
                          ? 'border-stone-900 bg-white shadow-sm font-semibold'
                          : 'border-stone-200 bg-white/70 text-stone-600 hover:border-stone-400'
                      }`}
                    >
                      <span
                        className={`h-3.5 w-3.5 rounded border flex items-center justify-center text-[9px] font-bold ${
                          on ? 'bg-stone-900 border-stone-900 text-white' : 'border-stone-300'
                        }`}
                        aria-hidden
                      >
                        {on ? '✓' : ''}
                      </span>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-secondary" onClick={applyQuickSchedule}>
                Apply to {editChannelLabel}
                {alsoCopyTo.length ? ` + ${alsoCopyTo.length}` : ''}
              </button>
              <span className="text-xs text-stone-500">
                Then switch mode tabs to set a different schedule. Save when done.
              </span>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {editChannelLabel} — day by day
                </p>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <button
                    type="button"
                    className="px-2 py-1 rounded border bg-stone-50 hover:bg-stone-100"
                    onClick={() =>
                      copyEditWeekTo(
                        APPLY_CHANNELS.map((c) => c.key).filter((k) => k !== editChannel)
                      )
                    }
                  >
                    Copy week to all other modes
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {DAYS.map((d) => {
                  const slots = editHours[d.key] || [];
                  return (
                    <div key={d.key} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="w-10 font-medium">{d.label}</span>
                      {slots.length === 0 ? (
                        <span className="text-stone-400">Closed</span>
                      ) : (
                        slots.map((slot, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1">
                            <input
                              type="time"
                              className="input w-auto py-1"
                              value={slot.open}
                              onChange={(e) => {
                                const next = cloneSlots(slots);
                                next[idx] = { ...next[idx], open: e.target.value };
                                setEditDaySlots(d.key, next);
                              }}
                            />
                            <span>–</span>
                            <input
                              type="time"
                              className="input w-auto py-1"
                              value={slot.close}
                              onChange={(e) => {
                                const next = cloneSlots(slots);
                                next[idx] = { ...next[idx], close: e.target.value };
                                setEditDaySlots(d.key, next);
                              }}
                            />
                            {slots.length > 1 ? (
                              <button
                                type="button"
                                className="text-stone-400 hover:text-red-600"
                                aria-label="Remove range"
                                onClick={() =>
                                  setEditDaySlots(
                                    d.key,
                                    slots.filter((_, i) => i !== idx)
                                  )
                                }
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        ))
                      )}
                      <button
                        type="button"
                        className="text-teal-700"
                        onClick={() =>
                          setEditDaySlots(d.key, [...slots, { open: '17:00', close: '23:00' }])
                        }
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="text-red-600"
                        onClick={() => setEditDaySlots(d.key, [])}
                      >
                        Closed
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                All modes overview
              </p>
              {(
                [
                  { key: 'takeaway' as const, label: 'Pickup' },
                  { key: 'dine_in' as const, label: 'Dine in' },
                  { key: 'delivery' as const, label: 'Delivery' },
                  { key: 'display' as const, label: 'Homepage banner' },
                ] as { key: HoursChannelKey; label: string }[]
              ).map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => selectEditChannel(c.key)}
                  className={`w-full text-left text-sm flex flex-col sm:flex-row sm:gap-2 rounded-md px-2 py-1.5 transition ${
                    editChannel === c.key ? 'bg-stone-100' : 'hover:bg-stone-50'
                  }`}
                >
                  <span className="font-medium text-stone-800 sm:w-36 shrink-0">{c.label}</span>
                  <span className="text-stone-600">{summarizeChannel(hours[c.key] || {})}</span>
                </button>
              ))}
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
              Menu markup for delivery items is set above (takeaway price + CHF).
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
          zoom={storeCoords ? 15 : 8}
          storeMarker={storeCoords}
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
