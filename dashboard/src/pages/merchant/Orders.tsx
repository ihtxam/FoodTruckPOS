import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { playOrderAlertOnce, startOrderAlertLoop, stopOrderAlertLoop } from '@/lib/order-alert';

interface OrderItem {
  productName?: string | null;
  quantity: string | number;
  totalPrice: string | number;
  selectedExtras?: Array<{ id: string; name: string; price: number }> | null;
  comboSelections?: Array<{
    slotName: string;
    productName: string;
    selectedExtras?: Array<{ id: string; name: string; price: number }>;
  }> | null;
}

interface Order {
  id: string;
  orderNumber?: string;
  orderType?: string;
  fulfillmentChannel?: string | null;
  status: string;
  total: string;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  scheduledFor?: string | null;
  notes?: string | null;
  createdAt: string;
  items?: OrderItem[];
}

type BoardTab = 'new' | 'kitchen' | 'ready' | 'programmed' | 'all';

function isProgrammed(o: Order) {
  const unpaid =
    o.paymentStatus === 'awaiting_payment' ||
    o.paymentMethod === 'pay_later' ||
    o.paymentMethod === 'pay-later';
  return (
    o.orderType === 'pos' &&
    unpaid &&
    o.status !== 'completed' &&
    o.status !== 'cancelled' &&
    o.status !== 'refunded'
  );
}

const CHANNEL_STYLE: Record<string, string> = {
  takeaway: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900',
  dine_in: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900',
  delivery: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900',
};

const CHANNEL_BORDER: Record<string, string> = {
  takeaway: 'border-l-amber-500',
  dine_in: 'border-l-sky-500',
  delivery: 'border-l-emerald-500',
};

function isAwaiting(status: string) {
  return status === 'pending' || status === 'pending_approval';
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: 'To approve',
    pending_approval: 'To approve',
    accepted: 'Accepted',
    preparing: 'Preparing',
    ready: 'Ready',
    out_for_delivery: 'Out for delivery',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[status] || status;
}

export default function Orders() {
  const { t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<BoardTab>('new');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const knownNewIdsRef = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api.get('/merchant/orders?limit=100');
      const next = (response.data.orders || []) as Order[];
      setOrders(next);

      const newIds = next
        .filter(
          (o) =>
            o.orderType === 'web_shop' &&
            (o.status === 'pending' || o.status === 'pending_approval')
        )
        .map((o) => o.id);

      if (knownNewIdsRef.current == null) {
        knownNewIdsRef.current = new Set(newIds);
      } else {
        const fresh = newIds.filter((id) => !knownNewIdsRef.current!.has(id));
        for (const id of newIds) knownNewIdsRef.current.add(id);
        if (fresh.length > 0) {
          playOrderAlertOnce();
          startOrderAlertLoop(5000);
          toast(t('webPosNewOrderAlert'), { icon: '🔔', duration: 5000 });
        }
        if (newIds.length === 0) stopOrderAlertLoop();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 10000);
    return () => {
      clearInterval(id);
      stopOrderAlertLoop();
    };
  }, [load]);

  useEffect(() => {
    if (tab === 'new') stopOrderAlertLoop();
  }, [tab]);

  const channelLabel = (channel?: string | null) => {
    if (channel === 'dine_in') return t('dineIn');
    if (channel === 'delivery') return t('delivery');
    if (channel === 'takeaway') return t('takeaway');
    return channel || '—';
  };

  const online = useMemo(
    () => orders.filter((o) => o.orderType === 'web_shop'),
    [orders]
  );

  const board = useMemo(
    () => ({
      new: online.filter((o) => isAwaiting(o.status)),
      kitchen: online.filter((o) => o.status === 'accepted' || o.status === 'preparing'),
      ready: online.filter((o) => o.status === 'ready' || o.status === 'out_for_delivery'),
      programmed: orders.filter(isProgrammed),
      all: orders,
    }),
    [online, orders]
  );

  const runAction = async (orderId: string, action: string) => {
    setBusyId(orderId);
    try {
      await api.post(`/merchant/orders/${orderId}/action`, { action });
      toast.success('Updated');
      await load();
      if (selected?.id === orderId) {
        const refreshed = await api.get(`/merchant/orders/${orderId}`);
        setSelected(refreshed.data.order);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const actionsFor = (order: Order) => {
    const s = order.status;
    const ch = order.fulfillmentChannel || 'takeaway';
    const paid = order.paymentStatus === 'completed' || order.paymentStatus === 'paid';
    const cash =
      order.paymentMethod === 'cash' ||
      order.paymentMethod === 'pay_later' ||
      order.paymentMethod === 'pay-later' ||
      order.paymentStatus === 'cash' ||
      order.paymentStatus === 'awaiting_payment';
    const btns: { action: string; label: string; style: string }[] = [];

    if (isProgrammed(order)) {
      if (s === 'accepted') {
        btns.push({ action: 'start_preparing', label: 'Start kitchen', style: 'bg-slate-900' });
      }
      if (s === 'preparing' || s === 'accepted') {
        btns.push({ action: 'mark_ready', label: 'Mark ready', style: 'bg-teal-600' });
      }
      btns.push({
        action: 'complete_and_collect',
        label: t('ordersCollectCash'),
        style: 'bg-emerald-700',
      });
      return btns;
    }

    if (isAwaiting(s)) {
      btns.push({ action: 'accept', label: 'Accept', style: 'bg-emerald-600' });
      btns.push({ action: 'reject', label: 'Reject', style: 'bg-red-600' });
      return btns;
    }
    if (s === 'accepted') {
      btns.push({ action: 'start_preparing', label: 'Start kitchen', style: 'bg-slate-900' });
    }
    if (s === 'preparing' || s === 'accepted') {
      btns.push({ action: 'mark_ready', label: 'Mark ready', style: 'bg-teal-600' });
    }
    if (s === 'ready' && ch === 'delivery') {
      btns.push({ action: 'out_for_delivery', label: 'Send delivery', style: 'bg-emerald-600' });
    }
    if ((s === 'ready' || s === 'out_for_delivery') && !paid && cash) {
      if (!(ch === 'delivery' && s === 'ready')) {
        btns.push({
          action: 'complete_and_collect',
          label: 'Collect & complete',
          style: 'bg-emerald-700',
        });
      }
    }
    if (s === 'out_for_delivery') {
      btns.push({
        action: paid ? 'complete' : 'complete_and_collect',
        label: paid ? 'Mark delivered' : 'Delivered + collect',
        style: 'bg-emerald-700',
      });
    }
    if (s === 'ready' && ch !== 'delivery' && paid) {
      btns.push({ action: 'complete', label: 'Complete handover', style: 'bg-emerald-700' });
    }
    return btns;
  };

  if (loading) return <div className="text-center py-10 muted text-sm">Loading orders...</div>;

  const list =
    tab === 'new'
      ? board.new
      : tab === 'kitchen'
        ? board.kitchen
        : tab === 'ready'
          ? board.ready
          : tab === 'programmed'
            ? board.programmed
            : board.all;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="page-title">{t('orders')}</h1>
          <p className="page-sub">
            Online shop: approve → kitchen → ready / delivery → collect
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2.5 text-[11px] font-medium muted">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Takeaway
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> Dine in
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Delivery
            </span>
          </div>
        </div>
        <button type="button" onClick={() => void load()} className="btn-secondary self-start">
          Refresh
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
        {(
          [
            ['new', `To approve (${board.new.length})`],
            ['kitchen', `Kitchen (${board.kitchen.length})`],
            ['ready', `Ready (${board.ready.length})`],
            ['programmed', `${t('ordersProgrammed')} (${board.programmed.length})`],
            ['all', `All (${board.all.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium border ${
              tab === id
                ? 'bg-[var(--accent)] text-white border-transparent'
                : 'bg-[var(--bg-elevated)] text-[var(--text)] border-[var(--border)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:gap-2.5 lg:grid-cols-2">
        {list.length === 0 && (
          <div className="col-span-full card border-dashed py-10 text-center muted text-sm">
            No orders in this view.
          </div>
        )}
        {list.map((order) => {
          const ch = order.fulfillmentChannel || 'takeaway';
          return (
            <article
              key={order.id}
              className={`card border-l-[3px] p-3 ${
                CHANNEL_BORDER[ch] || 'border-l-slate-400'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm truncate">
                    {order.orderNumber || order.id.slice(0, 8)}
                  </h3>
                  <p className="text-[11px] muted mt-0.5">
                    {order.orderType === 'web_shop' ? 'Online shop' : 'POS'} ·{' '}
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                    CHANNEL_STYLE[ch] || 'bg-[var(--bg-muted)]'
                  }`}
                >
                  {channelLabel(order.fulfillmentChannel)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-medium">
                <span className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5">
                  {statusLabel(order.status)}
                </span>
                <span className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5">
                  {order.scheduledFor
                    ? `Scheduled ${new Date(order.scheduledFor).toLocaleString()}`
                    : 'ASAP'}
                </span>
                <span className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5">
                  {order.paymentMethod || '—'} / {order.paymentStatus || '—'}
                </span>
                <span className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5">
                  CHF {Number(order.total || 0).toFixed(2)}
                </span>
              </div>

              {(order.customerName || order.customerPhone) && (
                <p className="mt-1.5 text-xs">
                  {order.customerName}
                  {order.customerPhone ? ` · ${order.customerPhone}` : ''}
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {order.orderType === 'web_shop' &&
                  actionsFor(order).map((btn) => (
                    <button
                      key={btn.action}
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => void runAction(order.id, btn.action)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50 ${btn.style}`}
                    >
                      {btn.label}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await api.get(`/merchant/orders/${order.id}`);
                      setSelected(res.data.order);
                    } catch {
                      setSelected(order);
                    }
                  }}
                  className="btn-secondary !py-1 !text-[11px]"
                >
                  Details
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-lg sm:rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold truncate">{selected.orderNumber}</h2>
                <p className="text-xs muted">{statusLabel(selected.status)}</p>
              </div>
              <button
                type="button"
                className="muted p-1"
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            </div>
            <div className="mt-3 space-y-1.5 text-sm">
              <p>
                <span className="muted">Customer:</span>{' '}
                {selected.customerName || '—'} {selected.customerPhone || ''}
              </p>
              {selected.shippingAddress && (
                <p>
                  <span className="muted">Address:</span> {selected.shippingAddress}
                </p>
              )}
              <p>
                <span className="muted">Payment:</span> {selected.paymentMethod} /{' '}
                {selected.paymentStatus}
              </p>
              {selected.notes && (
                <p>
                  <span className="muted">Notes:</span> {selected.notes}
                </p>
              )}
            </div>
            <ul className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-3 text-sm">
              {(selected.items || []).map((item, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    {Number(item.quantity)}× {item.productName || 'Item'}
                    {!!item.comboSelections?.length && (
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">
                        {item.comboSelections
                          .map((c) =>
                            c.selectedExtras?.length
                              ? `${c.productName} (${c.selectedExtras.map((e) => e.name).join(', ')})`
                              : c.productName
                          )
                          .join(' · ')}
                      </span>
                    )}
                    {!item.comboSelections?.length && !!item.selectedExtras?.length && (
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">
                        {item.selectedExtras.map((e) => e.name).join(', ')}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium">CHF {Number(item.totalPrice).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-right text-sm font-semibold">
              Total CHF {Number(selected.total).toFixed(2)}
            </p>
            {selected.orderType === 'web_shop' && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {actionsFor(selected).map((btn) => (
                  <button
                    key={btn.action}
                    type="button"
                    disabled={busyId === selected.id}
                    onClick={() => void runAction(selected.id, btn.action)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold text-white ${btn.style}`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
