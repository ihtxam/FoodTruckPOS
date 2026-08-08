import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
export type OnlineOrder = {
  id: string;
  orderNumber?: string;
  orderType?: string;
  fulfillmentChannel?: string | null;
  status: string;
  total: string | number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  scheduledFor?: string | null;
  notes?: string | null;
  createdAt: string;
  items?: Array<{
    productName?: string | null;
    quantity: string | number;
    totalPrice?: string | number;
  }>;
};
type Props = {
  open: boolean;
  onClose: () => void;
  orders: OnlineOrder[];
  onRefresh: () => void;
};
function isNew(status: string) {
  return status === 'pending' || status === 'pending_approval';
}
export default function WebPosOnlineOrdersPanel({ open, onClose, orders, onRefresh }: Props) {
  const { t } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<'new' | 'active' | 'all'>('new');
  useEffect(() => {
    if (open) setTab('new');
  }, [open]);
  const run = useCallback(
    async (id: string, action: string) => {
      setBusyId(id);
      try {
        await api.post(`/merchant/orders/${id}/action`, { action });
        toast.success(t('updated'));
        onRefresh();
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('actionFailed'));
      } finally {
        setBusyId(null);
      }
    },
    [onRefresh, t]
  );
  if (!open) return null;
  const list =
    tab === 'new'
      ? orders.filter((o) => isNew(o.status))
      : tab === 'active'
        ? orders.filter(
            (o) =>
              !isNew(o.status) &&
              o.status !== 'completed' &&
              o.status !== 'cancelled'
          )
        : orders;
  const money = (n: string | number) => `CHF ${Number(n || 0).toFixed(2)}`;
  const channelLabel = (ch?: string | null) => {
    if (ch === 'delivery') return t('delivery');
    if (ch === 'dine_in') return t('dineIn');
    return t('takeaway');
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-md flex-col bg-[var(--bg-elevated)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="font-semibold">{t('webPosOnlineOrders')}</h2>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className="flex gap-1 border-b border-[var(--border)] px-3 pt-2">
          {(
            [
              ['new', t('webPosOnlineNew')],
              ['active', t('webPosOnlineActive')],
              ['all', t('webPosOnlineAll')],
            ] as const
          ).map(([id, label]) => (
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
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
          {list.length === 0 ? (
            <p className="text-sm muted p-2">{t('webPosNoOnlineOrders')}</p>
          ) : (
            list.map((o) => (
              <div
                key={o.id}
                className={`rounded-xl border p-3 space-y-2 ${
                  isNew(o.status)
                    ? 'border-amber-400 bg-amber-50/80'
                    : 'border-[var(--border)]'
                }`}
              >
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {o.orderNumber || o.id.slice(0, 8)}
                      {isNew(o.status) ? (
                        <span className="ml-2 rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          {t('webPosNewBadge')}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {channelLabel(o.fulfillmentChannel)} · {money(o.total)} ·{' '}
                      {o.scheduledFor
                        ? new Date(o.scheduledFor).toLocaleString()
                        : t('webPosAsap')}
                    </p>
                    {(o.customerName || o.customerPhone) && (
                      <p className="text-[11px] mt-0.5">
                        {[o.customerName, o.customerPhone].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] tabular-nums text-[var(--text-muted)] shrink-0">
                    {new Date(o.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <ul className="text-xs text-[var(--text-muted)]">
                  {(o.items || []).slice(0, 5).map((i, idx) => (
                    <li key={idx}>
                      {i.quantity}× {i.productName || 'Item'}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {isNew(o.status) ? (
                    <>
                      <button
                        type="button"
                        className="btn-primary text-xs flex-1"
                        disabled={busyId === o.id}
                        onClick={() => void run(o.id, 'accept')}
                      >
                        {t('webPosAcceptOrder')}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={busyId === o.id}
                        onClick={() => void run(o.id, 'reject')}
                      >
                        {t('webPosRejectOrder')}
                      </button>
                    </>
                  ) : null}
                  {o.status === 'accepted' || o.status === 'preparing' ? (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busyId === o.id}
                      onClick={() =>
                        void run(
                          o.id,
                          o.status === 'accepted' ? 'start_preparing' : 'mark_ready'
                        )
                      }
                    >
                      {o.status === 'accepted'
                        ? t('webPosStartKitchen')
                        : t('webPosMarkReady')}
                    </button>
                  ) : null}
                  {o.status === 'ready' ? (
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      disabled={busyId === o.id}
                      onClick={() =>
                        void run(
                          o.id,
                          o.paymentStatus === 'awaiting_payment' ||
                            o.paymentMethod === 'cash'
                            ? 'complete_and_collect'
                            : 'complete'
                        )
                      }
                    >
                      {t('webPosCompleteOrder')}
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
