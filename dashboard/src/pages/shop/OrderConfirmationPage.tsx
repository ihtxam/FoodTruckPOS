import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { clearCart, resolveShopKey } from '@/lib/shop-cart';
import { roundMoney2 } from '@/lib/money';

type OrderItem = {
  id: string;
  productName: string | null;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  notes?: string | null;
};

type OrderView = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string | null;
  paymentMethod: string | null;
  fulfillmentChannel: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  shippingAddress: string | null;
  scheduledFor: string | null;
  notes: string | null;
  subtotal: string;
  taxAmount: string;
  deliveryFee: string;
  tipAmount: string;
  total: string;
  createdAt: string;
  items: OrderItem[];
  store?: { name: string; address?: string | null; city?: string | null; phone?: string | null };
};

type PaymentSession = {
  id: string;
  sessionData: string;
  clientKey: string;
  environment: string;
};

const money = (v: string | number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CHF' }).format(Number(v));

export default function OrderConfirmationPage() {
  const { merchantSlug, orderId = '' } = useParams<{ merchantSlug?: string; orderId?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const [searchParams] = useSearchParams();
  const wantPay = searchParams.get('pay') === '1' || searchParams.get('paid') === '1';

  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [payMsg, setPayMsg] = useState('');
  const dropinRef = useRef<HTMLDivElement>(null);
  const dropinMounted = useRef(false);

  const load = useCallback(async () => {
    if (!shopKey || !orderId) return;
    try {
      const res = await axios.get(`/api/shop/${shopKey}/orders/${orderId}`);
      const data = res.data.order as OrderView;
      setOrder(data);
      setError('');
      if (
        data.paymentStatus === 'completed' ||
        data.paymentMethod === 'cash' ||
        data.paymentStatus === 'cash'
      ) {
        clearCart(shopKey);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Order not found');
    } finally {
      setLoading(false);
    }
  }, [shopKey, orderId]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(t);
  }, [load]);

  const needsPayment = useMemo(
    () =>
      !!order &&
      order.paymentMethod === 'card' &&
      (order.paymentStatus === 'awaiting_payment' || order.paymentStatus === 'pending'),
    [order]
  );

  useEffect(() => {
    if (!wantPay || !needsPayment || !shopKey || !orderId) return;

    // Prefer session stored at checkout
    try {
      const cached = sessionStorage.getItem(`manupos_pay_${orderId}`);
      if (cached) {
        const parsed = JSON.parse(cached) as PaymentSession;
        if (parsed.sessionData && parsed.clientKey) {
          setSession(parsed);
          setDemoMode(false);
          return;
        }
      }
    } catch {
      /* ignore */
    }

    void (async () => {
      try {
        const res = await axios.post(`/api/shop/${shopKey}/orders/${orderId}/payment-session`, {});
        if (res.data.alreadyPaid) {
          await load();
          return;
        }
        setSession(res.data.paymentSession);
        setDemoMode(false);
      } catch (e: any) {
        setDemoMode(true);
        setPayMsg(
          e.response?.data?.error ||
            'Adyen is not configured for this shop — you can confirm with the demo button.'
        );
      }
    })();
  }, [wantPay, needsPayment, shopKey, orderId, load]);

  useEffect(() => {
    if (!session?.sessionData || !session.clientKey || !dropinRef.current || dropinMounted.current) {
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        // CSS is optional for Drop-in styling; ignore module typing
        await import(/* @vite-ignore */ '@adyen/adyen-web/dist/adyen.css').catch(() => undefined);
        const AdyenCheckout = (await import('@adyen/adyen-web')).default;
        if (cancelled || !dropinRef.current) return;

        const checkout = await AdyenCheckout({
          environment: session.environment === 'live' ? 'live' : 'test',
          clientKey: session.clientKey,
          session: { id: session.id, sessionData: session.sessionData },
          onPaymentCompleted: async () => {
            setPayMsg('Payment completed');
            await axios.post(`/api/shop/${shopKey}/orders/${orderId}/confirm-payment`, {
              resultCode: 'Authorised',
            });
            sessionStorage.removeItem(`manupos_pay_${orderId}`);
            clearCart(shopKey);
            await load();
          },
          onError: (err: { message?: string }) =>
            setPayMsg(err.message || 'Payment failed. Try again or choose cash next time.'),
        } as any);

        checkout.create('dropin').mount(dropinRef.current);
        dropinMounted.current = true;
      } catch {
        setDemoMode(true);
        setPayMsg('Adyen widget unavailable — use demo confirm below.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, shopKey, orderId, load]);

  const confirmDemoPayment = async () => {
    setPaying(true);
    setPayMsg('');
    try {
      await axios.post(`/api/shop/${shopKey}/orders/${orderId}/confirm-payment`, {
        resultCode: 'Authorised',
        demo: true,
        pspReference: `DEMO-${order?.orderNumber || orderId}`,
      });
      sessionStorage.removeItem(`manupos_pay_${orderId}`);
      clearCart(shopKey);
      setPayMsg('Payment confirmed');
      await load();
    } catch (e: any) {
      setPayMsg(e.response?.data?.error || 'Confirm failed');
    } finally {
      setPaying(false);
    }
  };

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-[#f6f5f2] flex items-center justify-center text-stone-500">
        Loading order…
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#f6f5f2] flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-red-600">{error || 'Order not found'}</p>
        <Link to={`${shopBasePath(shopKey) || '/'}`} className="text-stone-900 font-semibold underline">
          Back to menu
        </Link>
      </div>
    );
  }

  const isCash = order.paymentMethod === 'cash';
  const paid =
    order.paymentStatus === 'completed' ||
    order.paymentStatus === 'cash' ||
    (isCash && order.paymentStatus !== 'failed');

  const channelLabel =
    order.fulfillmentChannel === 'delivery'
      ? 'Delivery'
      : order.fulfillmentChannel === 'dine_in'
        ? 'Dine in'
        : 'Pickup';

  return (
    <div className="min-h-screen bg-[#f6f5f2] text-stone-900">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-400">Order confirmation</p>
            <h1 className="text-xl font-bold">#{order.orderNumber}</h1>
          </div>
          <Link to={`${shopBasePath(shopKey) || '/'}`} className="text-sm font-semibold text-stone-900 underline">
            Order again
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <section className="bg-white border border-stone-200 p-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <StatusPill label={order.status} tone={statusTone(order.status)} />
            <StatusPill
              label={`Payment: ${isCash ? 'cash' : order.paymentStatus || '—'}`}
              tone={paid ? 'green' : 'amber'}
            />
            <StatusPill label={channelLabel} tone="stone" />
          </div>
          <p className="text-sm text-stone-600">
            {paid
              ? isCash
                ? 'Pay cash on pickup / delivery. Your order is already in the restaurant POS.'
                : 'Payment received. Your order is already in the restaurant POS.'
              : 'Complete payment to confirm your order with the restaurant.'}
          </p>
          {order.scheduledFor && (
            <p className="text-sm font-medium">
              Scheduled for {new Date(order.scheduledFor).toLocaleString()}
            </p>
          )}
        </section>

        {needsPayment && (
          <section className="bg-white border border-stone-900 p-5 space-y-3">
            <h2 className="font-semibold text-lg">Complete card payment</h2>
            <p className="text-sm text-stone-600">
              Amount due: <strong>{money(order.total)}</strong>
            </p>
            {session && !demoMode && <div ref={dropinRef} className="min-h-[120px]" />}
            {(demoMode || !session) && (
              <button
                type="button"
                disabled={paying}
                onClick={() => void confirmDemoPayment()}
                className="w-full bg-emerald-700 text-white font-semibold py-3 disabled:opacity-50"
              >
                {paying ? 'Confirming…' : 'Confirm payment (demo / test)'}
              </button>
            )}
            {payMsg && <p className="text-sm text-stone-700">{payMsg}</p>}
          </section>
        )}

        <section className="bg-white border border-stone-200 p-5 space-y-2 text-sm">
          <h2 className="font-semibold text-base mb-2">Customer</h2>
          <p className="font-medium">{order.customerName}</p>
          {order.customerPhone && <p className="text-stone-600">{order.customerPhone}</p>}
          {order.customerEmail && <p className="text-stone-600">{order.customerEmail}</p>}
          <p className="text-stone-700 pt-1">
            {order.fulfillmentChannel === 'delivery'
              ? `Deliver to: ${order.shippingAddress || '—'}`
              : `Pickup at: ${order.store?.address || order.shippingAddress || 'restaurant'}${
                  order.store?.city ? `, ${order.store.city}` : ''
                }`}
          </p>
          {order.notes?.replace(/\[Rounding[^\]]*\]/g, '').trim() && (
            <p className="text-stone-500 italic">
              Note: {order.notes.replace(/\[Rounding[^\]]*\]/g, '').trim()}
            </p>
          )}
        </section>

        <section className="bg-white border border-stone-200 p-5">
          <h2 className="font-semibold mb-3">Items</h2>
          <ul className="space-y-2">
            {(order.items || []).map((it) => (
              <li key={it.id} className="flex justify-between gap-3 text-sm">
                <span>
                  {Number(it.quantity)}× {it.productName || 'Item'}
                </span>
                <span className="font-medium">{money(it.totalPrice)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-3 border-t border-stone-100 space-y-1 text-sm">
            <Row label="Subtotal" value={money(order.subtotal)} />
            <Row label="Tax" value={money(order.taxAmount)} />
            <Row label="Delivery" value={money(order.deliveryFee || 0)} />
            <Row label="Tip" value={money(order.tipAmount || 0)} />
            {(() => {
              const parts =
                Number(order.subtotal || 0) +
                Number(order.taxAmount || 0) +
                Number(order.deliveryFee || 0) +
                Number(order.tipAmount || 0);
              const roundAdj = roundMoney2(Number(order.total || 0) - parts);
              if (!roundAdj) return null;
              return (
                <Row
                  label="Rounding"
                  value={`${roundAdj > 0 ? '+' : ''}${money(roundAdj)}`}
                />
              );
            })()}
            <Row label="Total" value={money(order.total)} bold />
          </div>
        </section>
      </main>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-base pt-1' : 'text-stone-600'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'green' | 'amber' | 'stone' | 'blue';
}) {
  const cls =
    tone === 'green'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : tone === 'blue'
          ? 'bg-sky-50 text-sky-800 border-sky-200'
          : 'bg-stone-100 text-stone-700 border-stone-200';
  return (
    <span
      className={`inline-flex px-2.5 py-1 text-xs font-semibold border capitalize ${cls}`}
    >
      {label.split('_').join(' ')}
    </span>
  );
}

function statusTone(status: string): 'green' | 'amber' | 'stone' | 'blue' {
  if (status === 'ready' || status === 'completed') return 'green';
  if (status === 'preparing' || status === 'confirmed') return 'blue';
  if (status === 'cancelled') return 'amber';
  return 'stone';
}
