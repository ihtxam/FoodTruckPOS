import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';

type Slot = { time: string; available: boolean; remainingCovers: number };

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ReservationsPage() {
  const { t } = useI18n();
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
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
    <div className="min-h-screen bg-[#f6f5f2] text-stone-900">
      <header className="sticky top-0 z-30 bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link to={base || '/'} className="font-bold tracking-tight truncate">
            {config?.shopName || 'Reservations'}
          </Link>
          <div className="flex items-center gap-3 shrink-0">
            <ShopLangSwitcher />
            <Link to={`${base}/menu`} className="text-sm font-semibold underline underline-offset-2">
              {t('shopOrder')}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
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
          <form onSubmit={submit} className="bg-white border border-stone-200 p-5 md:p-6 space-y-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('shopReservations')}</h1>
              <p className="text-sm text-stone-500 mt-1">{t('shopReservationsIntro')}</p>
              {config?.address && <p className="text-sm text-stone-600 mt-1">{config.address}</p>}
            </div>

            {error && (
              <div className="text-sm border border-red-200 bg-red-50 text-red-800 px-3 py-2">{error}</div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm block">
                <span className="font-medium block mb-1">{t('shopReservationsParty')}</span>
                <input
                  type="number"
                  min={minParty}
                  max={maxParty}
                  className="border border-stone-300 px-3 py-2 w-full"
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value) || minParty)}
                  required
                />
              </label>
              <label className="text-sm block">
                <span className="font-medium block mb-1">{t('shopReservationsDate')}</span>
                <input
                  type="date"
                  className="border border-stone-300 px-3 py-2 w-full"
                  min={ymdLocal(new Date())}
                  max={maxDate}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">{t('shopReservationsTime')}</p>
              {slotsLoading ? (
                <p className="text-sm text-stone-500">{t('loading')}</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-stone-500 border border-dashed border-stone-300 p-4 text-center">
                  {t('shopReservationsNoSlots')}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available}
                      onClick={() => setTime(s.time)}
                      className={`px-3 py-2 text-sm border ${
                        time === s.time
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : s.available
                            ? 'border-stone-300 bg-white hover:border-stone-900'
                            : 'border-stone-200 bg-stone-100 text-stone-400 cursor-not-allowed'
                      }`}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-stone-500 mt-2">
                {t('shopReservationsSlotHint')
                  .replace('{interval}', String(config?.settings?.slotIntervalMinutes || 30))
                  .replace('{hours}', String(config?.settings?.minHoursBefore || 0))}
              </p>
            </div>

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
              disabled={submitting || !time}
              className="w-full bg-stone-900 text-white py-3 font-semibold disabled:opacity-40"
            >
              {submitting ? t('saving') : t('shopReservationsBook')}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
