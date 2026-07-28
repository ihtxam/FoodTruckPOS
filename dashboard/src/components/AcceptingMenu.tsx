import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type AcceptingState = {
  acceptingOrders: boolean;
  acceptingReservations: boolean;
  reservationsEnabled: boolean;
};

/**
 * Header dropdown: quickly pause online orders and/or reservations
 * without turning off the whole shop (visitors still browse, see a call-us message).
 */
export default function AcceptingMenu() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<AcceptingState>({
    acceptingOrders: true,
    acceptingReservations: true,
    reservationsEnabled: false,
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [settingsRes, reservationsRes] = await Promise.all([
          api.get('/merchant/settings'),
          api.get('/merchant/reservations/config').catch(() => null),
        ]);
        if (cancelled) return;
        const s = settingsRes.data.settings || {};
        const reservationsEnabled = !!(
          reservationsRes?.data?.config?.enabled ?? s.reservationsEnabled
        );
        setState({
          acceptingOrders: s.acceptingOrders !== false,
          acceptingReservations: s.acceptingReservations !== false,
          reservationsEnabled,
        });
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const patch = async (next: Partial<AcceptingState>) => {
    setSaving(true);
    const prev = state;
    const merged = { ...state, ...next };
    setState(merged);
    try {
      await api.put('/merchant/settings', {
        acceptingOrders: merged.acceptingOrders,
        acceptingReservations: merged.acceptingReservations,
      });
      toast.success(t('acceptingSaved'));
    } catch (error: any) {
      setState(prev);
      toast.error(error.response?.data?.error || t('acceptingSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const bothOn = state.acceptingOrders && (!state.reservationsEnabled || state.acceptingReservations);
  const bothOff =
    !state.acceptingOrders && (!state.reservationsEnabled || !state.acceptingReservations);
  const statusLabel = loading
    ? '…'
    : bothOn
      ? t('acceptingOpen')
      : bothOff
        ? t('acceptingPaused')
        : t('acceptingPartial');

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
          bothOff
            ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
            : bothOn
              ? 'border-[var(--border)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-muted)]'
              : 'border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={loading}
        title={t('acceptingMenuHint')}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            bothOff ? 'bg-amber-600' : bothOn ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        />
        <span className="hidden sm:inline">{statusLabel}</span>
        <span className="sm:hidden">{bothOff ? '!' : bothOn ? '●' : '◐'}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-lg"
        >
          <p className="text-xs font-semibold mb-2">{t('acceptingMenuTitle')}</p>
          <p className="text-[11px] muted mb-3">{t('acceptingMenuHint')}</p>
          <label className="flex items-start gap-2.5 text-sm py-1.5">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={state.acceptingOrders}
              disabled={saving}
              onChange={(e) => void patch({ acceptingOrders: e.target.checked })}
            />
            <span>
              <span className="font-medium block">{t('acceptingOrders')}</span>
              <span className="text-[11px] muted">{t('acceptingOrdersHint')}</span>
            </span>
          </label>
          <label
            className={`flex items-start gap-2.5 text-sm py-1.5 ${
              !state.reservationsEnabled ? 'opacity-50' : ''
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={state.acceptingReservations}
              disabled={saving || !state.reservationsEnabled}
              onChange={(e) => void patch({ acceptingReservations: e.target.checked })}
            />
            <span>
              <span className="font-medium block">{t('acceptingReservations')}</span>
              <span className="text-[11px] muted">
                {state.reservationsEnabled
                  ? t('acceptingReservationsHint')
                  : t('acceptingReservationsDisabled')}
              </span>
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
