import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Reservation = {
  id: string;
  code: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  reservedAt: string;
  status: string;
  tableLabel: string | null;
};

function ymd(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export default function WebPosBookingsView() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [dateFilter, setDateFilter] = useState(ymd());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(`${dateFilter}T00:00:00`);
      const to = new Date(`${dateFilter}T23:59:59`);
      const res = await api.get('/merchant/reservations', {
        params: { from: from.toISOString(), to: to.toISOString(), status: 'all' },
      });
      setReservations(res.data.reservations || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('cmsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [dateFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-stone-50">
      <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-3">
        <label className="text-sm font-medium text-stone-600">{t('date')}</label>
        <input
          type="date"
          className="input w-auto"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        <button type="button" className="btn-secondary text-sm" onClick={() => void load()}>
          {t('refresh')}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {loading ? (
          <p className="text-sm text-stone-500">{t('loading')}</p>
        ) : reservations.length === 0 ? (
          <p className="text-sm text-stone-500">{t('webPosNoBookings')}</p>
        ) : (
          <ul className="space-y-2">
            {reservations.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.guestName}</p>
                    <p className="text-xs text-stone-500">
                      {new Date(r.reservedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {r.partySize} {t('reservationsGuests')}
                    </p>
                    <p className="text-xs text-stone-500">{r.guestPhone}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-semibold uppercase">{r.status}</p>
                    <p className="text-stone-500">{r.tableLabel || t('reservationsNoTable')}</p>
                    <p className="text-stone-400">{r.code}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
