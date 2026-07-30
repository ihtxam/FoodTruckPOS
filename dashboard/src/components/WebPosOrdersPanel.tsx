import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type CancelReason = { id: string; en: string; fr: string; de: string };

type PosOrder = {
  id: string;
  orderNumber: string;
  clientId?: string | null;
  status: string;
  channel?: string | null;
  paymentMethod?: string | null;
  total: number;
  refundAmount: number;
  cancelReason?: string | null;
  createdAt: string;
  items: Array<{ name?: string | null; quantity: number; totalPrice: number }>;
};

type HeldRow = {
  id: string;
  label?: string | null;
  status: string;
  channel?: string | null;
  cartJson: unknown;
  notes?: string | null;
  updatedAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onResumeHeld: (held: HeldRow) => void;
};

export default function WebPosOrdersPanel({ open, onClose, onResumeHeld }: Props) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<'held' | 'history'>('held');
  const [held, setHeld] = useState<HeldRow[]>([]);
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [reasons, setReasons] = useState<CancelReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelFor, setCancelFor] = useState<PosOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundFor, setRefundFor] = useState<PosOrder | null>(null);

  const reasonLabel = (r: CancelReason) =>
    locale === 'fr' ? r.fr : locale === 'de' ? r.de : r.en;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, o] = await Promise.all([
        api.get('/merchant/pos/held'),
        api.get('/merchant/pos/orders?limit=40'),
      ]);
      setHeld(h.data.held || []);
      setOrders(o.data.orders || []);
      setReasons(o.data.cancelReasons || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosOrdersLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) return null;

  const money = (n: number) => `CHF ${Number(n || 0).toFixed(2)}`;

  const doCancel = async () => {
    if (!cancelFor || !cancelReason) return;
    try {
      await api.post(`/merchant/pos/orders/${cancelFor.id}/cancel`, { reason: cancelReason });
      toast.success(t('webPosOrderCancelled'));
      setCancelFor(null);
      setCancelReason('');
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosCancelFailed'));
    }
  };

  const doRefund = async (full: boolean) => {
    if (!refundFor) return;
    try {
      await api.post(`/merchant/pos/orders/${refundFor.id}/refund`, {
        amount: full ? undefined : undefined,
      });
      toast.success(t('webPosOrderRefunded'));
      setRefundFor(null);
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosRefundFailed'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-md flex-col bg-[var(--bg-elevated)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="font-semibold">{t('webPosOrders')}</h2>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className="flex gap-1 border-b border-[var(--border)] px-3 pt-2">
          {(['held', 'history'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-2 text-sm ${
                tab === id
                  ? 'border-b-2 border-[var(--text)] font-semibold'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {id === 'held' ? t('webPosOnHold') : t('webPosHistory')}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <p className="text-sm muted">{t('loading')}</p>
          ) : tab === 'held' ? (
            held.length === 0 ? (
              <p className="text-sm muted">{t('webPosNoHeld')}</p>
            ) : (
              held.map((h) => (
                <div
                  key={h.id}
                  className="rounded-xl border border-[var(--border)] p-3 space-y-2"
                >
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">
                        {h.label || t('webPosHeldOrder')}
                      </p>
                      <p className="text-[11px] muted">
                        {h.status} · {h.channel} · {new Date(h.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-primary flex-1 text-sm"
                      onClick={() => {
                        onResumeHeld(h);
                        onClose();
                      }}
                    >
                      {t('webPosResume')}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={async () => {
                        try {
                          await api.delete(`/merchant/pos/held/${h.id}`);
                          void load();
                        } catch (e: any) {
                          toast.error(e.response?.data?.error || t('deleteFailed'));
                        }
                      }}
                    >
                      {t('delete')}
                    </button>
                  </div>
                </div>
              ))
            )
          ) : orders.length === 0 ? (
            <p className="text-sm muted">{t('webPosNoOrders')}</p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{o.orderNumber}</p>
                    <p className="text-[11px] muted">
                      {o.status} · {o.paymentMethod} · {money(o.total)}
                    </p>
                    <p className="text-[11px] muted">
                      {new Date(o.createdAt).toLocaleString()}
                    </p>
                    {o.cancelReason ? (
                      <p className="text-[11px] text-amber-700">{o.cancelReason}</p>
                    ) : null}
                  </div>
                </div>
                <ul className="text-xs text-[var(--text-muted)]">
                  {o.items.slice(0, 4).map((i, idx) => (
                    <li key={idx}>
                      {i.quantity}× {i.name}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {o.status === 'completed' || o.status === 'partially_refunded' ? (
                    <>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => {
                          setCancelFor(o);
                          setCancelReason(reasons[0] ? reasonLabel(reasons[0]) : '');
                        }}
                      >
                        {t('webPosCancelOrder')}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => setRefundFor(o)}
                      >
                        {t('webPosRefund')}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        {cancelFor && (
          <div className="border-t border-[var(--border)] p-4 space-y-3 bg-[var(--bg)]">
            <p className="text-sm font-medium">{t('webPosCancelReason')}</p>
            <select
              className="input"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            >
              {reasons.map((r) => (
                <option key={r.id} value={reasonLabel(r)}>
                  {reasonLabel(r)}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setCancelFor(null)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => void doCancel()}>
                {t('confirm')}
              </button>
            </div>
          </div>
        )}

        {refundFor && (
          <div className="border-t border-[var(--border)] p-4 space-y-3 bg-[var(--bg)]">
            <p className="text-sm font-medium">
              {t('webPosRefundConfirm').replace('{amount}', money(refundFor.total - refundFor.refundAmount))}
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setRefundFor(null)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => void doRefund(true)}>
                {t('webPosRefund')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
