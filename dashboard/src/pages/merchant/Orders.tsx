import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface OrderItem {
  productName?: string | null;
  quantity: string | number;
  totalPrice: string | number;
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

type BoardTab = 'new' | 'kitchen' | 'ready' | 'all';

const CHANNEL_STYLE: Record<string, string> = {
  takeaway: 'bg-amber-500 text-white border-amber-600',
  dine_in: 'bg-blue-500 text-white border-blue-600',
  delivery: 'bg-emerald-500 text-white border-emerald-600',
};

const CHANNEL_BORDER: Record<string, string> = {
  takeaway: 'border-l-amber-500',
  dine_in: 'border-l-blue-500',
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

  const load = useCallback(async () => {
    try {
      const response = await api.get('/merchant/orders?limit=100');
      setOrders(response.data.orders || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 10000);
    return () => clearInterval(id);
  }, [load]);

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
      order.paymentStatus === 'cash' ||
      order.paymentStatus === 'awaiting_payment';
    const btns: { action: string; label: string; style: string }[] = [];

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

  if (loading) return <div className="text-center py-12">Loading orders...</div>;

  const list =
    tab === 'new'
      ? board.new
      : tab === 'kitchen'
        ? board.kitchen
        : tab === 'ready'
          ? board.ready
          : board.all;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('orders')}</h1>
          <p className="text-slate-600 mt-1">
            Online shop orders: approve → kitchen → ready / delivery → collect payment
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Takeaway
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Dine in
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Delivery
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['new', `To approve (${board.new.length})`],
            ['kitchen', `Kitchen (${board.kitchen.length})`],
            ['ready', `Ready / Delivery (${board.ready.length})`],
            ['all', `All orders (${board.all.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold border ${
              tab === id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {list.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
            No orders in this view.
          </div>
        )}
        {list.map((order) => {
          const ch = order.fulfillmentChannel || 'takeaway';
          return (
            <article
              key={order.id}
              className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm border-l-4 ${
                CHANNEL_BORDER[ch] || 'border-l-slate-400'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">
                    {order.orderNumber || order.id.slice(0, 8)}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {order.orderType === 'web_shop' ? 'Online shop' : 'POS'} ·{' '}
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold border ${
                    CHANNEL_STYLE[ch] || 'bg-slate-500 text-white'
                  }`}
                >
                  {channelLabel(order.fulfillmentChannel)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                  {statusLabel(order.status)}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                  {order.scheduledFor
                    ? `Scheduled ${new Date(order.scheduledFor).toLocaleString()}`
                    : 'ASAP'}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                  {order.paymentMethod || '—'} / {order.paymentStatus || '—'}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                  CHF {Number(order.total || 0).toFixed(2)}
                </span>
              </div>

              {(order.customerName || order.customerPhone) && (
                <p className="mt-2 text-sm text-slate-700">
                  {order.customerName}
                  {order.customerPhone ? ` · ${order.customerPhone}` : ''}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {order.orderType === 'web_shop' &&
                  actionsFor(order).map((btn) => (
                    <button
                      key={btn.action}
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => void runAction(order.id, btn.action)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${btn.style}`}
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
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Details
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{selected.orderNumber}</h2>
                <p className="text-sm text-slate-500">{statusLabel(selected.status)}</p>
              </div>
              <button
                type="button"
                className="text-slate-500"
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <span className="text-slate-500">Customer:</span>{' '}
                {selected.customerName || '—'} {selected.customerPhone || ''}
              </p>
              {selected.shippingAddress && (
                <p>
                  <span className="text-slate-500">Address:</span> {selected.shippingAddress}
                </p>
              )}
              <p>
                <span className="text-slate-500">Payment:</span> {selected.paymentMethod} /{' '}
                {selected.paymentStatus}
              </p>
              {selected.notes && (
                <p>
                  <span className="text-slate-500">Notes:</span> {selected.notes}
                </p>
              )}
            </div>
            <ul className="mt-4 space-y-2 border-t pt-3 text-sm">
              {(selected.items || []).map((item, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    {Number(item.quantity)}× {item.productName || 'Item'}
                  </span>
                  <span className="font-medium">CHF {Number(item.totalPrice).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-right font-bold">
              Total CHF {Number(selected.total).toFixed(2)}
            </p>
            {selected.orderType === 'web_shop' && (
              <div className="mt-4 flex flex-wrap gap-2">
                {actionsFor(selected).map((btn) => (
                  <button
                    key={btn.action}
                    type="button"
                    disabled={busyId === selected.id}
                    onClick={() => void runAction(selected.id, btn.action)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${btn.style}`}
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
