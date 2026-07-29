import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
type HoursSlot = { open: string; close: string };
type ChannelHours = Partial<Record<DayKey, HoursSlot[]>>;

type ResSettings = {
  dineInHoursMode: 'same_as_takeaway' | 'custom';
  slotIntervalMinutes: number;
  seatingDurationMinutes: number;
  bufferMinutes: number;
  minPartySize: number;
  maxPartySize: number;
  minHoursBefore: number;
  maxDaysAhead: number;
  autoAccept: boolean;
  sendConfirmationEmail: boolean;
  sendStatusEmails: boolean;
  reminderEnabled: boolean;
  reminderHoursBefore: number;
  sendReminderEmail: boolean;
  notifyAdminEmail: boolean;
  dailySummaryEnabled: boolean;
  maxCoversPerSlot: number | null;
  policiesText: string | null;
  slotDiscounts: Array<{
    id: string;
    name: string;
    percentOff: number;
    scheduleMode: 'specific_days' | 'whole_week';
    daysOfWeek: string[];
    timeStart?: string | null;
    timeEnd?: string | null;
    enabled?: boolean;
  }>;
};

type Reservation = {
  id: string;
  code: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string;
  partySize: number;
  reservedAt: string;
  durationMinutes: number;
  status: string;
  tableId: string | null;
  tableLabel: string | null;
  notes: string | null;
  internalNotes: string | null;
  source: string;
  discountPercent?: number | null;
  discountLabel?: string | null;
};

type Table = { id: string; label: string; capacity: number; status: string; floorPlanName?: string };

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

function emptyWeek(): ChannelHours {
  const w: ChannelHours = {};
  for (const d of DAYS) w[d.key] = [{ open: '11:00', close: '14:00' }, { open: '17:00', close: '22:00' }];
  return w;
}

function ymd(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export default function Reservations() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'bookings' | 'settings'>('bookings');
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [settings, setSettings] = useState<ResSettings | null>(null);
  const [dineInHours, setDineInHours] = useState<ChannelHours>(emptyWeek());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [dateFilter, setDateFilter] = useState(ymd());
  const [statusFilter, setStatusFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    partySize: 2,
    date: ymd(),
    time: '19:00',
    notes: '',
    tableId: '',
  });

  const loadConfig = useCallback(async () => {
    const res = await api.get('/merchant/reservations/config');
    setEnabled(!!res.data.config?.enabled);
    setSettings(res.data.config?.settings);
    if (res.data.config?.hours) setDineInHours(res.data.config.hours);
    setTables(res.data.tables || []);
  }, []);

  const loadList = useCallback(async () => {
    const from = new Date(`${dateFilter}T00:00:00`);
    const to = new Date(`${dateFilter}T23:59:59`);
    const res = await api.get('/merchant/reservations', {
      params: {
        from: from.toISOString(),
        to: to.toISOString(),
        status: statusFilter,
      },
    });
    setReservations(res.data.reservations || []);
  }, [dateFilter, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await loadConfig();
      await loadList();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('cmsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [loadConfig, loadList, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading) void loadList().catch(() => undefined);
  }, [dateFilter, statusFilter]);

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const res = await api.put('/merchant/reservations/config', {
        enabled,
        settings,
        dineInHours: settings.dineInHoursMode === 'custom' ? dineInHours : undefined,
      });
      setEnabled(!!res.data.config?.enabled);
      setSettings(res.data.config?.settings);
      if (res.data.config?.hours) setDineInHours(res.data.config.hours);
      toast.success(t('saved'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('cmsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    id: string,
    action: string,
    extra: Record<string, unknown> = {}
  ) => {
    try {
      await api.post(`/merchant/reservations/${id}/action`, { action, ...extra });
      toast.success(t('saved'));
      await loadList();
      await loadConfig();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  const createReservation = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/merchant/reservations', {
        ...form,
        tableId: form.tableId || undefined,
        partySize: Number(form.partySize),
        source: 'phone',
      });
      setCreateOpen(false);
      setForm({
        guestName: '',
        guestPhone: '',
        guestEmail: '',
        partySize: 2,
        date: dateFilter,
        time: '19:00',
        notes: '',
        tableId: '',
      });
      toast.success(t('created'));
      await loadList();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-900',
      confirmed: 'bg-emerald-100 text-emerald-900',
      seated: 'bg-blue-100 text-blue-900',
      completed: 'bg-stone-100 text-stone-600',
      cancelled: 'bg-stone-100 text-stone-500',
      rejected: 'bg-red-100 text-red-800',
      no_show: 'bg-red-50 text-red-700',
    };
    return colors[status] || 'bg-stone-100 text-stone-700';
  };

  const pendingCount = useMemo(
    () => reservations.filter((r) => r.status === 'pending').length,
    [reservations]
  );

  if (loading || !settings) {
    return <div className="p-4 text-sm muted">{t('loading')}</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('reservationsTitle')}</h1>
          <p className="text-sm muted mt-1">{t('reservationsHint')}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm ${tab === 'bookings' ? 'bg-slate-900 text-white' : 'border bg-white'}`}
            onClick={() => setTab('bookings')}
          >
            {t('reservationsBookings')}
            {pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm ${tab === 'settings' ? 'bg-slate-900 text-white' : 'border bg-white'}`}
            onClick={() => setTab('settings')}
          >
            {t('reservationsSettings')}
          </button>
        </div>
      </div>

      {tab === 'settings' && (
        <form onSubmit={saveSettings} className="space-y-4 rounded-md border border-[var(--border)] bg-[var(--bg)] p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            {t('reservationsEnable')}
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm block">
              <span className="muted block mb-1">{t('reservationsHoursMode')}</span>
              <select
                className="input"
                value={settings.dineInHoursMode}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    dineInHoursMode: e.target.value as ResSettings['dineInHoursMode'],
                  })
                }
              >
                <option value="same_as_takeaway">{t('reservationsSameAsTakeaway')}</option>
                <option value="custom">{t('reservationsCustomHours')}</option>
              </select>
            </label>
            <label className="text-sm block">
              <span className="muted block mb-1">{t('reservationsSlotInterval')}</span>
              <select
                className="input"
                value={settings.slotIntervalMinutes}
                onChange={(e) =>
                  setSettings({ ...settings, slotIntervalMinutes: Number(e.target.value) })
                }
              >
                {[15, 30, 45, 60].map((n) => (
                  <option key={n} value={n}>
                    {n} min
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm block">
              <span className="muted block mb-1">{t('reservationsSeatingDuration')}</span>
              <input
                type="number"
                min={30}
                max={360}
                className="input"
                value={settings.seatingDurationMinutes}
                onChange={(e) =>
                  setSettings({ ...settings, seatingDurationMinutes: Number(e.target.value) })
                }
              />
            </label>
            <label className="text-sm block">
              <span className="muted block mb-1">{t('reservationsBuffer')}</span>
              <input
                type="number"
                min={0}
                max={120}
                className="input"
                value={settings.bufferMinutes}
                onChange={(e) => setSettings({ ...settings, bufferMinutes: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm block">
              <span className="muted block mb-1">{t('reservationsMinHoursBefore')}</span>
              <input
                type="number"
                min={0}
                max={72}
                className="input"
                value={settings.minHoursBefore}
                onChange={(e) => setSettings({ ...settings, minHoursBefore: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm block">
              <span className="muted block mb-1">{t('reservationsMaxDaysAhead')}</span>
              <input
                type="number"
                min={1}
                max={180}
                className="input"
                value={settings.maxDaysAhead}
                onChange={(e) => setSettings({ ...settings, maxDaysAhead: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm block">
              <span className="muted block mb-1">{t('reservationsMinParty')}</span>
              <input
                type="number"
                min={1}
                className="input"
                value={settings.minPartySize}
                onChange={(e) => setSettings({ ...settings, minPartySize: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm block">
              <span className="muted block mb-1">{t('reservationsMaxParty')}</span>
              <input
                type="number"
                min={1}
                className="input"
                value={settings.maxPartySize}
                onChange={(e) => setSettings({ ...settings, maxPartySize: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm block">
              <span className="muted block mb-1">{t('reservationsMaxCovers')}</span>
              <input
                type="number"
                min={0}
                className="input"
                placeholder={t('reservationsMaxCoversAuto')}
                value={settings.maxCoversPerSlot ?? ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxCoversPerSlot: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </label>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.autoAccept}
                onChange={(e) => setSettings({ ...settings, autoAccept: e.target.checked })}
              />
              {t('reservationsAutoAccept')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.sendConfirmationEmail}
                onChange={(e) =>
                  setSettings({ ...settings, sendConfirmationEmail: e.target.checked })
                }
              />
              {t('reservationsSendConfirmEmail')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.notifyAdminEmail !== false}
                onChange={(e) => setSettings({ ...settings, notifyAdminEmail: e.target.checked })}
              />
              Email restaurant (admin) on new / updated reservations
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.sendStatusEmails}
                onChange={(e) => setSettings({ ...settings, sendStatusEmails: e.target.checked })}
              />
              {t('reservationsSendStatusEmails')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.reminderEnabled !== false}
                onChange={(e) => setSettings({ ...settings, reminderEnabled: e.target.checked })}
              />
              Send reservation reminders by email
            </label>
            {settings.reminderEnabled !== false ? (
              <label className="text-sm flex items-center gap-2 flex-wrap">
                <span className="muted">Remind</span>
                <input
                  className="input !w-20"
                  type="number"
                  min={1}
                  max={168}
                  value={settings.reminderHoursBefore ?? 24}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      reminderHoursBefore: Number(e.target.value) || 24,
                    })
                  }
                />
                <span className="muted">hours before the booking</span>
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.dailySummaryEnabled !== false}
                onChange={(e) =>
                  setSettings({ ...settings, dailySummaryEnabled: e.target.checked })
                }
              />
              Daily summary email at 10:00 (lunch & dinner for today)
            </label>
          </div>

          <div className="space-y-3 border-t border-[var(--border)] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Off-peak / slot discounts</h3>
                <p className="text-xs muted">
                  Show “20% off” on reservation time slots (specific days or whole week, optional hours).
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() =>
                  setSettings({
                    ...settings,
                    slotDiscounts: [
                      ...(settings.slotDiscounts || []),
                      {
                        id: `disc-${Date.now()}`,
                        name: 'Off-peak 20%',
                        percentOff: 20,
                        scheduleMode: 'whole_week',
                        daysOfWeek: [],
                        timeStart: '13:00',
                        timeEnd: '17:00',
                        enabled: true,
                      },
                    ],
                  })
                }
              >
                Add discount
              </button>
            </div>
            {(settings.slotDiscounts || []).map((d, idx) => (
              <div
                key={d.id}
                className="rounded-lg border border-[var(--border)] p-3 space-y-2 bg-[var(--bg-muted)]/40"
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input
                    className="input"
                    value={d.name}
                    onChange={(e) => {
                      const next = [...(settings.slotDiscounts || [])];
                      next[idx] = { ...d, name: e.target.value };
                      setSettings({ ...settings, slotDiscounts: next });
                    }}
                    placeholder="Name"
                  />
                  <label className="text-sm flex items-center gap-1">
                    <input
                      className="input !w-20"
                      type="number"
                      min={1}
                      max={90}
                      value={d.percentOff}
                      onChange={(e) => {
                        const next = [...(settings.slotDiscounts || [])];
                        next[idx] = { ...d, percentOff: Number(e.target.value) || 0 };
                        setSettings({ ...settings, slotDiscounts: next });
                      }}
                    />
                    % off
                  </label>
                  <select
                    className="input"
                    value={d.scheduleMode || 'specific_days'}
                    onChange={(e) => {
                      const next = [...(settings.slotDiscounts || [])];
                      next[idx] = {
                        ...d,
                        scheduleMode: e.target.value as 'specific_days' | 'whole_week',
                      };
                      setSettings({ ...settings, slotDiscounts: next });
                    }}
                  >
                    <option value="whole_week">Whole week</option>
                    <option value="specific_days">Certain days</option>
                  </select>
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        slotDiscounts: (settings.slotDiscounts || []).filter((_, i) => i !== idx),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="time"
                    className="input !w-auto"
                    value={d.timeStart || ''}
                    onChange={(e) => {
                      const next = [...(settings.slotDiscounts || [])];
                      next[idx] = { ...d, timeStart: e.target.value || null };
                      setSettings({ ...settings, slotDiscounts: next });
                    }}
                  />
                  <span>–</span>
                  <input
                    type="time"
                    className="input !w-auto"
                    value={d.timeEnd || ''}
                    onChange={(e) => {
                      const next = [...(settings.slotDiscounts || [])];
                      next[idx] = { ...d, timeEnd: e.target.value || null };
                      setSettings({ ...settings, slotDiscounts: next });
                    }}
                  />
                  <span className="text-xs muted">Empty times = all open hours</span>
                </div>
                {d.scheduleMode !== 'whole_week' ? (
                  <div className="flex flex-wrap gap-1">
                    {DAYS.map((day) => {
                      const on = (d.daysOfWeek || []).includes(day.key);
                      return (
                        <button
                          key={day.key}
                          type="button"
                          className={`rounded-full px-2 py-0.5 text-[11px] border ${
                            on
                              ? 'bg-amber-700 text-white border-amber-700'
                              : 'bg-white border-[var(--border)]'
                          }`}
                          onClick={() => {
                            const days = new Set(d.daysOfWeek || []);
                            if (on) days.delete(day.key);
                            else days.add(day.key);
                            const next = [...(settings.slotDiscounts || [])];
                            next[idx] = { ...d, daysOfWeek: [...days] };
                            setSettings({ ...settings, slotDiscounts: next });
                          }}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <label className="text-sm block">
            <span className="muted block mb-1">{t('reservationsPolicies')}</span>
            <textarea
              className="input min-h-24"
              value={settings.policiesText || ''}
              onChange={(e) => setSettings({ ...settings, policiesText: e.target.value || null })}
            />
          </label>

          {settings.dineInHoursMode === 'custom' && (
            <div className="space-y-2 border-t border-[var(--border)] pt-4">
              <h3 className="text-sm font-semibold">{t('reservationsCustomHours')}</h3>
              <p className="text-xs muted">{t('reservationsCustomHoursHint')}</p>
              {DAYS.map((day) => (
                <div key={day.key} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-10 font-medium">{day.label}</span>
                  {(dineInHours[day.key] || []).map((slot, idx) => (
                    <span key={idx} className="flex items-center gap-1">
                      <input
                        type="time"
                        className="input !w-auto"
                        value={slot.open}
                        onChange={(e) => {
                          const next = { ...dineInHours };
                          const slots = [...(next[day.key] || [])];
                          slots[idx] = { ...slots[idx], open: e.target.value };
                          next[day.key] = slots;
                          setDineInHours(next);
                        }}
                      />
                      <span>–</span>
                      <input
                        type="time"
                        className="input !w-auto"
                        value={slot.close}
                        onChange={(e) => {
                          const next = { ...dineInHours };
                          const slots = [...(next[day.key] || [])];
                          slots[idx] = { ...slots[idx], close: e.target.value };
                          next[day.key] = slots;
                          setDineInHours(next);
                        }}
                      />
                    </span>
                  ))}
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => {
                      const next = { ...dineInHours };
                      next[day.key] = [...(next[day.key] || []), { open: '18:00', close: '22:00' }];
                      setDineInHours(next);
                    }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="text-xs muted"
                    onClick={() => {
                      const next = { ...dineInHours };
                      next[day.key] = [];
                      setDineInHours(next);
                    }}
                  >
                    {t('reservationsClosedDay')}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      )}

      {tab === 'bookings' && (
        <div className="space-y-4">
          {!enabled && (
            <p className="text-sm rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2">
              {t('reservationsDisabledHint')}
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="muted block mb-1">{t('date')}</span>
              <input
                type="date"
                className="input"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="muted block mb-1">{t('status')}</span>
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">{t('all')}</option>
                <option value="pending">pending</option>
                <option value="confirmed">confirmed</option>
                <option value="seated">seated</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
                <option value="rejected">rejected</option>
                <option value="no_show">no_show</option>
              </select>
            </label>
            <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
              {t('reservationsNew')}
            </button>
          </div>

          {createOpen && (
            <form
              onSubmit={createReservation}
              className="rounded-md border border-[var(--border)] bg-[var(--bg-muted)] p-4 grid gap-3 md:grid-cols-2"
            >
              <input
                className="input"
                required
                placeholder={t('name')}
                value={form.guestName}
                onChange={(e) => setForm({ ...form, guestName: e.target.value })}
              />
              <input
                className="input"
                required
                placeholder={t('phone')}
                value={form.guestPhone}
                onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
              />
              <input
                className="input"
                type="email"
                placeholder="Email"
                value={form.guestEmail}
                onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
              />
              <input
                className="input"
                type="number"
                min={1}
                value={form.partySize}
                onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })}
              />
              <input
                className="input"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
              <input
                className="input"
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
              <select
                className="input md:col-span-2"
                value={form.tableId}
                onChange={(e) => setForm({ ...form, tableId: e.target.value })}
              >
                <option value="">{t('reservationsNoTable')}</option>
                {tables.map((tb) => (
                  <option key={tb.id} value={tb.id}>
                    {tb.label} ({tb.capacity})
                  </option>
                ))}
              </select>
              <textarea
                className="input md:col-span-2"
                placeholder={t('notes')}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
                  {t('cancel')}
                </button>
                <button type="submit" className="btn-primary">
                  {t('create')}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {reservations.length === 0 && (
              <p className="text-sm muted border border-dashed rounded-md p-6 text-center">
                {t('reservationsEmpty')}
              </p>
            )}
            {reservations.map((r) => (
              <div
                key={r.id}
                className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-3 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{r.guestName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${statusBadge(r.status)}`}>
                        {r.status}
                      </span>
                      <span className="text-xs muted">{r.code}</span>
                      {r.discountPercent ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold border border-amber-300">
                          {r.discountLabel || `${r.discountPercent}% off`}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm muted mt-0.5">
                      {new Date(r.reservedAt).toLocaleString()} · {r.partySize} {t('reservationsGuests')} ·{' '}
                      {r.guestPhone}
                      {r.tableLabel
                        ? ` · ${t('reservationsTable')} ${r.tableLabel}${
                            r.discountPercent
                              ? ` · ${r.discountLabel || `${r.discountPercent}% off`}`
                              : ''
                          }`
                        : ''}
                    </p>
                    {r.notes && <p className="text-xs mt-1">{r.notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="btn-primary text-xs !py-1"
                          onClick={() => void runAction(r.id, 'accept')}
                        >
                          {t('reservationsAccept')}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-xs !py-1"
                          onClick={() => void runAction(r.id, 'reject')}
                        >
                          {t('reservationsReject')}
                        </button>
                      </>
                    )}
                    {['confirmed', 'pending'].includes(r.status) && (
                      <button
                        type="button"
                        className="btn-secondary text-xs !py-1"
                        onClick={() => void runAction(r.id, 'seat')}
                      >
                        {t('reservationsSeat')}
                      </button>
                    )}
                    {r.status === 'seated' && (
                      <button
                        type="button"
                        className="btn-secondary text-xs !py-1"
                        onClick={() => void runAction(r.id, 'complete')}
                      >
                        {t('reservationsComplete')}
                      </button>
                    )}
                    {['pending', 'confirmed'].includes(r.status) && (
                      <>
                        <button
                          type="button"
                          className="text-xs text-red-700 px-2"
                          onClick={() => void runAction(r.id, 'cancel')}
                        >
                          {t('cancel')}
                        </button>
                        <button
                          type="button"
                          className="text-xs muted px-2"
                          onClick={() => void runAction(r.id, 'no_show')}
                        >
                          {t('reservationsNoShow')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {['pending', 'confirmed', 'seated'].includes(r.status) && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="muted">{t('reservationsAssignTable')}</span>
                    <select
                      className="input !w-auto text-sm"
                      value={r.tableId || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) void runAction(r.id, 'unassign_table');
                        else void runAction(r.id, 'assign_table', { tableId: v });
                      }}
                    >
                      <option value="">{t('reservationsNoTable')}</option>
                      {tables.map((tb) => (
                        <option key={tb.id} value={tb.id}>
                          {tb.label} ({tb.capacity}) — {tb.status}
                          {r.discountPercent && r.tableId === tb.id
                            ? ` · ${r.discountLabel || `${r.discountPercent}% off`}`
                            : ''}
                        </option>
                      ))}
                    </select>
                    {r.tableLabel && r.discountPercent ? (
                      <span className="text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                        Table {r.tableLabel} · {r.discountLabel || `${r.discountPercent}% off`}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
