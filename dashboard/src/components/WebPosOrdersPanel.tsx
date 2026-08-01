import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Printer, RefreshCw, Search, X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { PosOrderForReceipt } from '@/lib/webpos-receipt';

type CancelReason = { id: string; en: string; fr: string; de: string };

export type PosOrder = PosOrderForReceipt & {
  status: string;
  paymentStatus?: string | null;
  refundAmount: number;
  cancelReason?: string | null;
  notes?: string | null;
  masterOrderId?: string | null;
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

type TabId = 'completed' | 'held' | 'all';
type DateRange = 'today' | 'week' | 'all';

type Props = {
  open: boolean;
  onClose: () => void;
  onResumeHeld: (held: HeldRow) => void;
  onPrintOrder?: (order: PosOrderForReceipt, splitLabel?: string | null) => Promise<void>;
  refreshToken?: number;
  canCancel?: boolean;
  canRefund?: boolean;
  highlightOrderId?: string | null;
};

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });
}

function weekAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });
}

function canCancelOrder(o: PosOrder): boolean {
  if (o.status === 'cancelled' || o.paymentStatus === 'cancelled') return false;
  if (o.status === 'refunded' || o.paymentStatus === 'refunded') return false;
  return o.status === 'completed' || o.paymentStatus === 'completed';
}

function canRefundOrder(o: PosOrder): boolean {
  if (o.status === 'cancelled' || o.paymentStatus === 'cancelled') return false;
  const remaining = Number(o.total || 0) - Number(o.refundAmount || 0);
  if (remaining <= 0.001) return false;
  return (
    o.status === 'completed' ||
    o.status === 'partially_refunded' ||
    o.paymentStatus === 'completed' ||
    o.paymentStatus === 'partially_refunded'
  );
}

function splitBillLabel(t: (k: string) => string, n: number) {
  return t('webPosSplitBillN').replace('{n}', String(n));
}

export default function WebPosOrdersPanel({
  open,
  onClose,
  onResumeHeld,
  onPrintOrder,
  refreshToken = 0,
  canCancel = true,
  canRefund = true,
  highlightOrderId = null,
}: Props) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<TabId>('completed');
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [search, setSearch] = useState('');
  const [held, setHeld] = useState<HeldRow[]>([]);
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [reasons, setReasons] = useState<CancelReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [selected, setSelected] = useState<PosOrder | null>(null);
  const [cancelFor, setCancelFor] = useState<PosOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundFor, setRefundFor] = useState<PosOrder | null>(null);
  const [refundPartial, setRefundPartial] = useState(false);
  const [refundAmountText, setRefundAmountText] = useState('');

  const reasonLabel = (r: CancelReason) =>
    locale === 'fr' ? r.fr : locale === 'de' ? r.de : r.en;

  const statusLabel = (status: string) => {
    const key = status?.toLowerCase().replace(/-/g, '_');
    const map: Record<string, string> = {
      completed: t('webPosStatusCompleted'),
      cancelled: t('webPosStatusCancelled'),
      refunded: t('webPosStatusRefunded'),
      partially_refunded: t('webPosStatusPartialRefund'),
      preparing: t('webPosStatusPreparing'),
      accepted: t('webPosStatusAccepted'),
    };
    return map[key] || status;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '80' });
      if (dateRange === 'today') {
        params.set('from', todayIso());
        params.set('to', todayIso());
      } else if (dateRange === 'week') {
        params.set('from', weekAgoIso());
        params.set('to', todayIso());
      }
      const [h, o] = await Promise.all([
        api.get('/merchant/pos/held'),
        api.get(`/merchant/pos/orders?${params.toString()}`),
      ]);
      setHeld(h.data.held || []);
      setOrders(o.data.orders || []);
      setReasons(o.data.cancelReasons || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosOrdersLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [dateRange, t]);

  useEffect(() => {
    if (open) void load();
  }, [open, load, refreshToken]);

  useEffect(() => {
    if (!open || !highlightOrderId || orders.length === 0) return;
    const match = orders.find((o) => o.id === highlightOrderId || o.clientId === highlightOrderId);
    if (match) {
      setTab('completed');
      setSelected(match);
    }
  }, [open, highlightOrderId, orders]);

  const splitCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      if (o.masterOrderId) {
        map.set(o.masterOrderId, (map.get(o.masterOrderId) || 0) + 1);
      }
    }
    return map;
  }, [orders]);

  const splitOrders = useMemo(() => {
    if (!selected?.masterOrderId) return [] as PosOrder[];
    const siblings = orders.filter((o) => o.masterOrderId === selected.masterOrderId);
    if (siblings.length <= 1) return [];
    return siblings.sort(
      (a, b) =>
        (a.splitCheckNumber ?? 0) - (b.splitCheckNumber ?? 0) ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [selected, orders]);

  const isSplit = splitOrders.length > 1;

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (tab === 'completed') {
      list = list.filter(
        (o) =>
          o.status === 'completed' ||
          o.status === 'partially_refunded' ||
          o.status === 'cancelled' ||
          o.status === 'refunded'
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          (o.clientId || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, tab, search]);

  if (!open) return null;

  const money = (n: number) => `CHF ${Number(n || 0).toFixed(2)}`;

  const doCancel = async () => {
    if (!cancelFor || !cancelReason) return;
    try {
      await api.post(`/merchant/pos/orders/${cancelFor.id}/cancel`, { reason: cancelReason });
      toast.success(t('webPosOrderCancelled'));
      setCancelFor(null);
      setSelected(null);
      setCancelReason('');
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosCancelFailed'));
    }
  };

  const doRefund = async () => {
    if (!refundFor) return;
    const remaining = round2(refundFor.total - refundFor.refundAmount);
    let amount: number | undefined;
    if (refundPartial) {
      amount = round2(Number(refundAmountText));
      if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.001) {
        toast.error(t('webPosRefundInvalidAmount'));
        return;
      }
    }
    try {
      await api.post(`/merchant/pos/orders/${refundFor.id}/refund`, { amount });
      toast.success(t('webPosOrderRefunded'));
      setRefundFor(null);
      setRefundPartial(false);
      setRefundAmountText('');
      setSelected(null);
      void load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosRefundFailed'));
    }
  };

  const openCancel = (o: PosOrder) => {
    setCancelFor(o);
    setCancelReason(reasons[0] ? reasonLabel(reasons[0]) : '');
  };

  const openRefund = (o: PosOrder) => {
    const remaining = round2(o.total - o.refundAmount);
    setRefundFor(o);
    setRefundPartial(false);
    setRefundAmountText(remaining.toFixed(2));
  };

  const printOne = async (order: PosOrder, splitLabel?: string | null) => {
    if (!onPrintOrder) return;
    setPrinting(true);
    try {
      await onPrintOrder(order, splitLabel);
    } finally {
      setPrinting(false);
    }
  };

  const printAllSplits = async () => {
    if (!onPrintOrder || splitOrders.length === 0) return;
    setPrinting(true);
    try {
      for (const split of splitOrders) {
        const label = split.splitCheckNumber
          ? splitBillLabel(t, split.splitCheckNumber)
          : splitBillLabel(t, splitOrders.indexOf(split) + 1);
        await onPrintOrder(split, label);
      }
    } finally {
      setPrinting(false);
    }
  };

  const renderOrderActions = (o: PosOrder, compact = false) => {
    const showCancel = canCancel && canCancelOrder(o);
    const showRefund = canRefund && canRefundOrder(o);
    const showPrint = !!onPrintOrder;
    if (!showCancel && !showRefund && !showPrint) return null;
    return (
      <div className={`flex flex-wrap gap-2 ${compact ? '' : 'pt-1'}`}>
        {showPrint ? (
          <button
            type="button"
            className="btn-secondary text-xs inline-flex items-center gap-1"
            disabled={printing}
            onClick={(e) => {
              e.stopPropagation();
              void printOne(o);
            }}
          >
            <Printer size={12} />
            {t('webPosPrintReceipt')}
          </button>
        ) : null}
        {showCancel ? (
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={(e) => {
              e.stopPropagation();
              openCancel(o);
            }}
          >
            {t('webPosCancelOrder')}
          </button>
        ) : null}
        {showRefund ? (
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={(e) => {
              e.stopPropagation();
              openRefund(o);
            }}
          >
            {t('webPosRefund')}
          </button>
        ) : null}
      </div>
    );
  };

  const renderSplitDetail = () => {
    if (!selected || !isSplit) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {t('webPosSplitOrderTitle').replace('{count}', String(splitOrders.length))}
          </p>
          {onPrintOrder ? (
            <button
              type="button"
              className="btn-secondary text-xs inline-flex items-center gap-1"
              disabled={printing}
              onClick={() => void printAllSplits()}
            >
              <Printer size={12} />
              {t('webPosPrintAllSplits')}
            </button>
          ) : null}
        </div>
        {splitOrders.map((split, index) => {
          const billN = split.splitCheckNumber ?? index + 1;
          const label = splitBillLabel(t, billN);
          return (
            <div
              key={split.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-3 space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{label}</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold tabular-nums">{money(split.total)}</span>
                  {onPrintOrder ? (
                    <button
                      type="button"
                      className="p-1.5 rounded-lg hover:bg-[var(--bg)]"
                      disabled={printing}
                      aria-label={t('webPosPrintReceipt')}
                      onClick={() =>
                        void printOne(split, label)
                      }
                    >
                      <Printer size={16} />
                    </button>
                  ) : null}
                </div>
              </div>
              <ul className="text-xs text-[var(--text-muted)]">
                {split.items.map((i, idx) => (
                  <li key={idx}>
                    {i.quantity}× {i.name}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <div className="flex justify-between font-semibold text-sm pt-1">
          <span>{t('webPosOrderTotal')}</span>
          <span className="tabular-nums">
            {money(splitOrders.reduce((sum, s) => sum + Number(s.total || 0), 0))}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-md flex-col bg-[var(--bg-elevated)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="font-semibold">{t('webPosOrders')}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-2"
              onClick={() => void load()}
              disabled={loading}
              aria-label={t('webPosRefreshOrders')}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-[var(--border)] px-3 pt-2">
          {(
            [
              ['completed', t('webPosCompletedOrders')],
              ['held', t('webPosOnHold')],
              ['all', t('webPosAllOrders')],
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

        {tab !== 'held' ? (
          <div className="space-y-2 border-b border-[var(--border)] px-3 py-2">
            <div className="flex gap-1">
              {(
                [
                  ['today', t('webPosToday')],
                  ['week', t('webPosLast7Days')],
                  ['all', t('webPosDateAll')],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDateRange(id)}
                  className={`rounded-lg px-2.5 py-1 text-xs ${
                    dateRange === id
                      ? 'bg-[var(--text)] text-[var(--bg)] font-medium'
                      : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="search"
                className="input w-full pl-8 text-sm"
                placeholder={t('webPosSearchOrder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        ) : null}

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
                      <p className="font-medium text-sm">{h.label || t('webPosHeldOrder')}</p>
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
          ) : filteredOrders.length === 0 ? (
            <p className="text-sm muted">
              {tab === 'completed' ? t('webPosNoCompletedOrders') : t('webPosNoOrders')}
            </p>
          ) : (
            filteredOrders.map((o) => {
              const isSplitRow = o.masterOrderId && (splitCounts.get(o.masterOrderId) || 0) > 1;
              return (
                <button
                  key={o.id}
                  type="button"
                  className={`w-full rounded-xl border p-3 space-y-2 text-left transition-colors hover:bg-[var(--bg-muted)] ${
                    selected?.id === o.id ? 'border-[var(--text)]' : 'border-[var(--border)]'
                  }`}
                  onClick={() => setSelected(o)}
                >
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-sm truncate">{o.orderNumber}</p>
                        {isSplitRow ? (
                          <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-800">
                            {t('webPosSplitBadge')}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] muted">
                        {statusLabel(o.status)} · {o.paymentMethod || '—'} · {money(o.total)}
                      </p>
                      <p className="text-[11px] muted">
                        {new Date(o.completedAt || o.createdAt).toLocaleString()}
                        {o.channel ? ` · ${o.channel}` : ''}
                      </p>
                      {o.refundAmount > 0 ? (
                        <p className="text-[11px] text-amber-700">
                          {t('webPosRefundedAmount').replace('{amount}', money(o.refundAmount))}
                        </p>
                      ) : null}
                      {o.cancelReason ? (
                        <p className="text-[11px] text-red-700">{o.cancelReason}</p>
                      ) : null}
                    </div>
                    <StatusBadge status={o.status} label={statusLabel(o.status)} />
                  </div>
                  <ul className="text-xs text-[var(--text-muted)]">
                    {o.items.slice(0, 3).map((i, idx) => (
                      <li key={idx}>
                        {i.quantity}× {i.name}
                      </li>
                    ))}
                    {o.items.length > 3 ? (
                      <li className="italic">+{o.items.length - 3} …</li>
                    ) : null}
                  </ul>
                  {renderOrderActions(o, true)}
                </button>
              );
            })
          )}
        </div>

        {selected && !cancelFor && !refundFor ? (
          <div className="border-t border-[var(--border)] p-4 space-y-3 bg-[var(--bg)] max-h-[45vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{selected.orderNumber}</p>
                <p className="text-xs muted">{statusLabel(selected.status)}</p>
              </div>
              <div className="flex items-center gap-1">
                {onPrintOrder ? (
                  <button
                    type="button"
                    className="p-1.5 rounded-lg hover:bg-[var(--bg-muted)]"
                    disabled={printing}
                    aria-label={t('webPosPrintReceipt')}
                    onClick={() => void printOne(selected)}
                  >
                    <Printer size={18} />
                  </button>
                ) : null}
                <button type="button" className="p-1 muted" onClick={() => setSelected(null)}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {isSplit ? (
              renderSplitDetail()
            ) : (
              <>
                <ul className="text-sm space-y-1">
                  {selected.items.map((i, idx) => (
                    <li key={idx} className="flex justify-between gap-2">
                      <span>
                        {i.quantity}× {i.name}
                      </span>
                      <span className="tabular-nums">{money(i.totalPrice)}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-sm space-y-0.5 border-t border-[var(--border)] pt-2">
                  {selected.subtotal != null ? (
                    <div className="flex justify-between">
                      <span className="muted">{t('webPosSubtotal')}</span>
                      <span>{money(selected.subtotal)}</span>
                    </div>
                  ) : null}
                  {selected.taxAmount != null && selected.taxAmount > 0 ? (
                    <div className="flex justify-between">
                      <span className="muted">{t('reportsTax')}</span>
                      <span>{money(selected.taxAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between font-semibold">
                    <span>{t('webPosTotal')}</span>
                    <span>{money(selected.total)}</span>
                  </div>
                </div>
              </>
            )}

            {selected.staffName ? (
              <p className="text-xs muted">
                {t('webPosStaff')}: {selected.staffName}
              </p>
            ) : null}
            {renderOrderActions(selected)}
          </div>
        ) : null}

        {cancelFor ? (
          <div className="border-t border-[var(--border)] p-4 space-y-3 bg-[var(--bg)]">
            <p className="text-sm font-medium">
              {t('webPosCancelReason')} — {cancelFor.orderNumber}
            </p>
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
        ) : null}

        {refundFor ? (
          <div className="border-t border-[var(--border)] p-4 space-y-3 bg-[var(--bg)]">
            <p className="text-sm font-medium">
              {t('webPosRefund')} — {refundFor.orderNumber}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={!refundPartial}
                onChange={() => setRefundPartial(false)}
              />
              {t('webPosRefundFull').replace(
                '{amount}',
                money(round2(refundFor.total - refundFor.refundAmount))
              )}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={refundPartial}
                onChange={() => setRefundPartial(true)}
              />
              {t('webPosRefundPartial')}
            </label>
            {refundPartial ? (
              <input
                type="number"
                step="0.05"
                min="0.05"
                className="input"
                value={refundAmountText}
                onChange={(e) => setRefundAmountText(e.target.value)}
              />
            ) : null}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setRefundFor(null)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => void doRefund()}>
                {t('webPosRefund')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone =
    status === 'completed'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'cancelled'
        ? 'bg-red-100 text-red-800'
        : status === 'refunded' || status === 'partially_refunded'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-[var(--bg-muted)] text-[var(--text-muted)]';
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>
      {label}
    </span>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
