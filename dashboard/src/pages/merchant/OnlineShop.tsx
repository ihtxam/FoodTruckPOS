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

type DayKey = (typeof DAYS)[number]['key'];
type HoursChannelKey = 'takeaway' | 'dine_in' | 'delivery' | 'display';

const ORDER_CHANNELS: { key: Exclude<HoursChannelKey, 'display'>; label: string }[] = [
  { key: 'takeaway', label: 'Pickup' },
  { key: 'dine_in', label: 'Dine in' },
  { key: 'delivery', label: 'Delivery' },
];

const ALL_CHANNELS: HoursChannelKey[] = ['takeaway', 'dine_in', 'delivery', 'display'];

/** Where a quick schedule should be written. */
type ApplyTarget =
  | 'all'
  | 'ordering'
  | 'takeaway'
  | 'delivery'
  | 'dine_in'
  | 'homepage';

const APPLY_TARGETS: { key: ApplyTarget; label: string; hint: string }[] = [
  {
    key: 'all',
    label: 'All order types',
    hint: 'Pickup, dine-in, delivery + homepage banner',
  },
  {
    key: 'ordering',
    label: 'Pickup + delivery',
    hint: 'Both main order types (+ homepage)',
  },
  {
    key: 'takeaway',
    label: 'Pickup only',
    hint: 'Take away / pickup checkout hours',
  },
  {
    key: 'delivery',
    label: 'Delivery only',
    hint: 'Home delivery checkout hours',
  },
  {
    key: 'dine_in',
    label: 'Dine in only',
    hint: 'Eat-in checkout hours',
  },
  {
    key: 'homepage',
    label: 'Homepage only',
    hint: 'Banner hours on the shop page — does not gate ordering',
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

function targetsFor(apply: ApplyTarget): HoursChannelKey[] {
  switch (apply) {
    case 'all':
      return ['takeaway', 'dine_in', 'delivery', 'display'];
    case 'ordering':
      return ['takeaway', 'delivery', 'display'];
    case 'takeaway':
      return ['takeaway'];
    case 'delivery':
      return ['delivery'];
    case 'dine_in':
      return ['dine_in'];
    case 'homepage':
      return ['display'];
    default:
      return ['takeaway', 'delivery', 'display'];
  }
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
  const [applyTarget, setApplyTarget] = useState<ApplyTarget>('all');
  const [markClosed, setMarkClosed] = useState(false);
  const [showFineTune, setShowFineTune] = useState(false);
  const [fineTuneChannel, setFineTuneChannel] = useState<HoursChannelKey>('takeaway');
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
    const channels = targetsFor(applyTarget);
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
    const targetLabel = APPLY_TARGETS.find((t) => t.key === applyTarget)?.label || applyTarget;
    toast.success(
      markClosed
        ? `Closed ${dayLabel} → ${targetLabel}`
        : `Set ${formatDaySlots(slots)} on ${dayLabel} → ${targetLabel}`
    );
  };

  const setFineTuneDaySlots = (day: string, slots: Slot[]) => {
    setHours((prev) => {
      const channel = { ...(prev[fineTuneChannel] || {}) };
      channel[day] = slots;
      return { ...prev, [fineTuneChannel]: channel };
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

  const fineTuneHours = hours[fineTuneChannel] || {};

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
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 space-y-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Opening hours</h2>
              <p className="text-sm text-stone-500 mt-0.5">
                Pick several days, set one schedule, choose where it applies — then save.
              </p>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium">Days</span>
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
              <span className="text-sm font-medium block mb-2">Applies to</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {APPLY_TARGETS.map((opt) => {
                  const on = applyTarget === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setApplyTarget(opt.key)}
                      className={`text-left rounded-lg border px-3 py-2.5 transition ${
                        on ? 'border-stone-900 bg-white shadow-sm' : 'border-stone-200 bg-white/70 hover:border-stone-400'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{opt.label}</span>
                      <span className="block text-[11px] text-stone-500 mt-0.5 leading-snug">{opt.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-secondary" onClick={applyQuickSchedule}>
                Apply to selected days
              </button>
              <span className="text-xs text-stone-500">
                Preview updates below — click Save to publish.
              </span>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Current schedule</p>
              {(
                [
                  { key: 'display' as const, label: 'Homepage banner' },
                  ...ORDER_CHANNELS,
                ] as { key: HoursChannelKey; label: string }[]
              ).map((c) => (
                <div key={c.key} className="text-sm flex flex-col sm:flex-row sm:gap-2">
                  <span className="font-medium text-stone-800 sm:w-36 shrink-0">{c.label}</span>
                  <span className="text-stone-600">{summarizeChannel(hours[c.key] || {})}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-stone-200 pt-3">
              <button
                type="button"
                className="text-sm font-medium text-stone-700 underline-offset-2 hover:underline"
                onClick={() => setShowFineTune((v) => !v)}
              >
                {showFineTune ? 'Hide fine-tune editor' : 'Fine-tune a single channel (optional)'}
              </button>
              {showFineTune && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { key: 'display' as const, label: 'Homepage' },
                        ...ORDER_CHANNELS,
                      ] as { key: HoursChannelKey; label: string }[]
                    ).map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        className={`px-3 py-1.5 text-sm border rounded-lg ${
                          fineTuneChannel === c.key ? 'bg-stone-900 text-white border-stone-900' : 'bg-white'
                        }`}
                        onClick={() => setFineTuneChannel(c.key)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {DAYS.map((d) => {
                      const slots = fineTuneHours[d.key] || [];
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
                                    setFineTuneDaySlots(d.key, next);
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
                                    setFineTuneDaySlots(d.key, next);
                                  }}
                                />
                              </span>
                            ))
                          )}
                          <button
                            type="button"
                            className="text-teal-700"
                            onClick={() =>
                              setFineTuneDaySlots(d.key, [
                                ...slots,
                                { open: '17:00', close: '23:00' },
                              ])
                            }
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="text-red-600"
                            onClick={() => setFineTuneDaySlots(d.key, [])}
                          >
                            Closed
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
