import { ShoppingBag } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import ShopVacationPopup from '@/components/shop/ShopVacationPopup';

type Slot = { time: string; available: boolean; remainingCovers: number };

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ReservationsPage() {
  const { t, locale } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const base = shopBasePath(shopKey);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState(() => ymdLocal(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ code: string; status: string; reservedAt: string } | null>(
    null
  );
  const [partyExpanded, setPartyExpanded] = useState(false);
  const [timesExpanded, setTimesExpanded] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (partySize > 4) setPartyExpanded(true);
  }, [partySize]);

  useEffect(() => {
    setTimesExpanded(false);
  }, [date, partySize]);

  useEffect(() => {
    if (!time || timesExpanded) return;
    const idx = slots.findIndex((s) => s.time === time);
    if (idx >= 6) setTimesExpanded(true);
  }, [time, slots, timesExpanded]);

  useEffect(() => {
    if (!shopKey) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/shop/${shopKey}/reservations/config`);
        if (cancelled) return;
        setConfig(res.data.config);
        const min = Number(res.data.config?.settings?.minPartySize) || 2;
        setPartySize(min);
      } catch (e: any) {
        if (!cancelled) setError(e.response?.data?.error || t('shopReservationsUnavailable'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, t]);

  useEffect(() => {
    if (!shopKey || !config) return;
    let cancelled = false;
    setSlotsLoading(true);
    setTime('');
    (async () => {
      try {
        const res = await axios.get(`/api/shop/${shopKey}/reservations/slots`, {
          params: { date, partySize },
        });
        if (cancelled) return;
        setSlots(res.data.slots || []);
      } catch (e: any) {
        if (!cancelled) {
          setSlots([]);
          setError(e.response?.data?.error || t('shopReservationsSlotsFailed'));
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, config, date, partySize, t]);

  const maxDate = useMemo(() => {
    const days = Number(config?.settings?.maxDaysAhead) || 30;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return ymdLocal(d);
  }, [config]);

  const minParty = Number(config?.settings?.minPartySize) || 1;
  const maxParty = Number(config?.settings?.maxPartySize) || 12;

  const partyOptions = useMemo(() => {
    const list: number[] = [];
    for (let n = minParty; n <= maxParty; n += 1) list.push(n);
    return list;
  }, [minParty, maxParty]);

  const dateOptions = useMemo(() => {
    const days = Math.min(Math.max(Number(config?.settings?.maxDaysAhead) || 30, 1), 60);
    const loc = locale === 'fr' || locale === 'de' ? locale : 'en';
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    const out: Array<{
      value: string;
      weekday: string;
      dayNum: string;
      month: string;
      isToday: boolean;
    }> = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push({
        value: ymdLocal(d),
        weekday: d.toLocaleDateString(loc, { weekday: 'short' }),
        dayNum: String(d.getDate()),
        month: d.toLocaleDateString(loc, { month: 'short' }),
        isToday: i === 0,
      });
    }
    return out;
  }, [config, locale]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (config?.vacation?.active) {
      setError(t('shopVacationReservationsBlocked'));
      return;
    }
    if (!time) {
      setError(t('shopReservationsPickTime'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await axios.post(`/api/shop/${shopKey}/reservations`, {
        guestName,
        guestPhone,
        guestEmail: guestEmail || undefined,
        partySize,
        date,
        time,
        notes: notes || undefined,
      });
      setDone({
        code: res.data.reservation.code,
        status: res.data.reservation.status,
        reservedAt: res.data.reservation.reservedAt,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || t('shopReservationsBookFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-600">
        {t('loading')}
      </div>
    );
  }

  if (!config && error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-stone-50 px-4 text-center">
        <p className="text-stone-700 font-medium">{error}</p>
        <Link to={`${base}/menu`} className="underline text-sm">
          {t('shopOrder')}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f5f2] text-stone-900 overflow-x-hidden">
      <ShopVacationPopup vacation={config?.vacation} shopKey={shopKey} />
      <header className="sticky top-0 z-30 bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <Link
            to={base || '/'}
            className="font-bold tracking-tight truncate min-w-0"
            aria-label={config?.shopName || 'Home'}
          >
            {config?.shopName || 'Reservations'}
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            <ShopLangSwitcher />
            <Link
              to={`${base}/menu`}
              className="inline-flex h-9 w-9 items-center justify-center text-stone-700 hover:bg-stone-100"
              aria-label={t('shopOrder')}
              title={t('shopOrder')}
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 min-w-0 overflow-x-hidden">
        {done ? (
          <div className="bg-white border border-stone-200 p-6 space-y-3 text-center">
            <h1 className="text-2xl font-bold tracking-tight">{t('shopReservationsThanks')}</h1>
            <p className="text-stone-600">
              {done.status === 'confirmed'
                ? t('shopReservationsConfirmedMsg')
                : t('shopReservationsPendingMsg')}
            </p>
            <p className="font-mono text-sm">{done.code}</p>
            <p className="text-sm">
              {new Date(done.reservedAt).toLocaleString(undefined, {
                timeZone: 'Europe/Zurich',
                dateStyle: 'full',
                timeStyle: 'short',
              })}
            </p>
            <Link to={`${base}/menu`} className="inline-block mt-4 bg-stone-900 text-white px-5 py-2.5 text-sm font-semibold">
              {t('shopOrder')}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white border border-stone-200 p-5 md:p-6 space-y-5 overflow-x-hidden max-w-full">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('shopReservations')}</h1>
              <p className="text-sm text-stone-500 mt-1">{t('shopReservationsIntro')}</p>
              {config?.address && <p className="text-sm text-stone-600 mt-1">{config.address}</p>}
            </div>

            {error && (
              <div className="text-sm border border-red-200 bg-red-50 text-red-800 px-3 py-2">{error}</div>
            )}

            {config?.vacation?.active ? (
              <div className="text-sm border border-amber-200 bg-amber-50 text-amber-950 px-3 py-2">
                {(() => {
                  const msg = config.vacation.message;
                  if (typeof msg === 'string' && msg.trim()) return msg.trim();
                  if (msg && typeof msg === 'object') {
                    const loc = (locale === 'fr' || locale === 'de' ? locale : 'en') as 'en' | 'fr' | 'de';
                    const picked = msg[loc] || msg.en || msg.fr || msg.de;
                    if (picked) return String(picked);
                  }
                  return t('shopVacationReservationsBlocked');
                })()}
              </div>
            ) : null}

            <fieldset className="space-y-2 min-w-0">
              <legend className="text-sm font-medium">{t('shopReservationsParty')}</legend>
              <div
                className="grid grid-cols-4 gap-2"
                role="radiogroup"
                aria-label={t('shopReservationsParty')}
              >
                {(partyExpanded ? partyOptions : partyOptions.slice(0, 4)).map((n) => {
                  const selected = partySize === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPartySize(n)}
                      className={`min-h-11 text-base font-semibold border transition-colors ${
                        selected
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-300 bg-white text-stone-800 hover:border-stone-900'
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
                {!partyExpanded && partyOptions.length > 4 ? (
                  <button
                    type="button"
                    onClick={() => setPartyExpanded(true)}
                    className="col-span-4 min-h-11 text-base font-semibold border border-stone-300 bg-white text-stone-800 hover:border-stone-900"
                  >
                    {t('shopReservationsShowMore')}
                  </button>
                ) : null}
                {partyExpanded && partyOptions.length > 4 ? (
                  <button
                    type="button"
                    onClick={() => setPartyExpanded(false)}
                    className="col-span-4 min-h-11 text-base font-semibold border border-stone-300 bg-white text-stone-800 hover:border-stone-900"
                  >
                    {t('shopReservationsShowLess')}
                  </button>
                ) : null}
              </div>
            </fieldset>

            <fieldset className="space-y-2 min-w-0">
              <legend className="text-sm font-medium">{t('shopReservationsDate')}</legend>
              <div className="max-w-full min-w-0 overflow-x-hidden">
                <div
                  className="flex gap-1.5 overflow-x-auto overscroll-x-contain touch-pan-x snap-x snap-mandatory max-w-full [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  role="radiogroup"
                  aria-label={t('shopReservationsDate')}
                >
                  {dateOptions.map((d) => {
                    const selected = date === d.value;
                    return (
                      <button
                        key={d.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setDate(d.value);
                          setDatePickerOpen(false);
                        }}
                        className={`snap-start shrink-0 w-12 min-h-11 py-1.5 border text-center transition-colors ${
                          selected && !datePickerOpen
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-300 bg-white text-stone-800 hover:border-stone-900'
                        }`}
                      >
                        <span className="block text-[9px] font-medium uppercase tracking-wide opacity-80 leading-none">
                          {d.isToday ? t('shopReservationsToday') : d.weekday}
                        </span>
                        <span className="mt-1 block text-sm font-bold leading-none">{d.dayNum}</span>
                        <span className="mt-0.5 block text-[9px] opacity-80 leading-none">{d.month}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setDatePickerOpen((v) => !v)}
                    className={`snap-start shrink-0 w-12 min-h-11 py-1.5 border text-center transition-colors ${
                      datePickerOpen
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-300 bg-white text-stone-800 hover:border-stone-900'
                    }`}
                    aria-expanded={datePickerOpen}
                    title={t('shopReservationsOtherDate')}
                  >
                    <span className="block text-[9px] font-medium uppercase tracking-wide opacity-80 leading-none">
                      {t('shopReservationsOtherShort')}
                    </span>
                    <span className="mt-1 block text-sm font-bold leading-none">···</span>
                    <span className="mt-0.5 block text-[9px] opacity-80 leading-none">&nbsp;</span>
                  </button>
                </div>
              </div>
              {datePickerOpen ? (
                <label className="block text-xs text-stone-500">
                  <span className="sr-only">{t('shopReservationsDate')}</span>
                  <input
                    type="date"
                    className="border border-stone-300 px-3 py-2 w-full max-w-[11rem] text-sm text-stone-800"
                    min={ymdLocal(new Date())}
                    max={maxDate}
                    value={date}
                    onChange={(e) => {
                      if (e.target.value) setDate(e.target.value);
                    }}
                  />
                </label>
              ) : null}
            </fieldset>

            <fieldset className="space-y-2 min-w-0">
              <legend className="text-sm font-medium">{t('shopReservationsTime')}</legend>
              {slotsLoading ? (
                <p className="text-sm text-stone-500 py-4">{t('loading')}</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-stone-500 border border-dashed border-stone-300 p-4 text-center">
                  {t('shopReservationsNoSlots')}
                </p>
              ) : (
                <>
                  <div
                    className="grid grid-cols-3 gap-2"
                    role="radiogroup"
                    aria-label={t('shopReservationsTime')}
                  >
                    {(timesExpanded ? slots : slots.slice(0, 6)).map((s) => {
                      const selected = time === s.time;
                      return (
                        <button
                          key={s.time}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={!s.available}
                          onClick={() => setTime(s.time)}
                          className={`min-h-11 text-sm font-semibold border tabular-nums transition-colors ${
                            selected
                              ? 'border-stone-900 bg-stone-900 text-white'
                              : s.available
                                ? 'border-stone-300 bg-white text-stone-800 hover:border-stone-900'
                                : 'border-stone-200 bg-stone-100 text-stone-400 cursor-not-allowed line-through'
                          }`}
                        >
                          {s.time}
                        </button>
                      );
                    })}
                    {!timesExpanded && slots.length > 6 ? (
                      <button
                        type="button"
                        onClick={() => setTimesExpanded(true)}
                        className="col-span-3 min-h-11 text-sm font-semibold border border-stone-300 bg-white text-stone-800 hover:border-stone-900"
                      >
                        {t('shopReservationsShowMore')}
                      </button>
                    ) : null}
                    {timesExpanded && slots.length > 6 ? (
                      <button
                        type="button"
                        onClick={() => setTimesExpanded(false)}
                        className="col-span-3 min-h-11 text-sm font-semibold border border-stone-300 bg-white text-stone-800 hover:border-stone-900"
                      >
                        {t('shopReservationsShowLess')}
                      </button>
                    ) : null}
                  </div>
                </>
              )}
              <p className="text-xs text-stone-500">
                {t('shopReservationsSlotHint')
                  .replace('{interval}', String(config?.settings?.slotIntervalMinutes || 30))
                  .replace('{hours}', String(config?.settings?.minHoursBefore || 0))}
              </p>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm block sm:col-span-2">
                <span className="font-medium block mb-1">{t('name')}</span>
                <input
                  className="border border-stone-300 px-3 py-2 w-full"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                />
              </label>
              <label className="text-sm block">
                <span className="font-medium block mb-1">{t('phone')}</span>
                <input
                  className="border border-stone-300 px-3 py-2 w-full"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  required
                />
              </label>
              <label className="text-sm block">
                <span className="font-medium block mb-1">Email</span>
                <input
                  type="email"
                  className="border border-stone-300 px-3 py-2 w-full"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                />
              </label>
              <label className="text-sm block sm:col-span-2">
                <span className="font-medium block mb-1">{t('notes')}</span>
                <textarea
                  className="border border-stone-300 px-3 py-2 w-full min-h-20"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>

            {config?.settings?.policiesText && (
              <p className="text-xs text-stone-500 whitespace-pre-wrap border-t border-stone-100 pt-3">
                {config.settings.policiesText}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !time || !!config?.vacation?.active}
              className="w-full bg-stone-900 text-white py-3 font-semibold disabled:opacity-40"
            >
              {config?.vacation?.active
                ? t('shopVacationTitle')
                : submitting
                  ? t('saving')
                  : t('shopReservationsBook')}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
