import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { clearCart, resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import { shopDocumentTitle } from '@/lib/brand';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import { roundMoney2 } from '@/lib/money';

type OrderItem = {
  id: string;
  productName: string | null;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  notes?: string | null;
  selectedExtras?: Array<{ id: string; name: string; price: number }> | null;
  comboSelections?: Array<{
    slotId: string;
    slotName: string;
    productId: string;
    productName: string;
    extraPrice: number;
    selectedExtras?: Array<{ id: string; name: string; price: number }>;
  }> | null;
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
  cardFee?: string;
  pointsDiscount?: string | number | null;
  pointsEarned?: number | null;
  pointsRedeemed?: number | null;
  total: string;
  createdAt: string;
  items: OrderItem[];
  store?: {
    name: string;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    shopLogoUrl?: string | null;
    cmsHomepageEnabled?: boolean;
  };
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
  const { t, locale } = useI18n();
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
      setError(e.response?.data?.error || t('shopOrderNotFound'));
    } finally {
      setLoading(false);
    }
  }, [shopKey, orderId]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (order?.store?.name) {
      document.title = shopDocumentTitle(`${order.store.name} - ${order.orderNumber}`);
    }
  }, [order?.store?.name, order?.orderNumber]);

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
        setPayMsg(e.response?.data?.error || t('shopCardNotConfigured'));
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
            setPayMsg(t('shopPaymentCompleted'));
            await axios.post(`/api/shop/${shopKey}/orders/${orderId}/confirm-payment`, {
              resultCode: 'Authorised',
            });
            sessionStorage.removeItem(`manupos_pay_${orderId}`);
            clearCart(shopKey);
            await load();
          },
          onError: (err: { message?: string }) =>
            setPayMsg(err.message || t('shopPaymentFailed')),
        } as any);

        checkout.create('dropin').mount(dropinRef.current);
        dropinMounted.current = true;
      } catch {
        setDemoMode(true);
        setPayMsg(t('shopCardFormUnavailable'));
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
      setPayMsg(t('shopPaymentConfirmed'));
      await load();
    } catch (e: any) {
      setPayMsg(e.response?.data?.error || t('shopConfirmFailed'));
    } finally {
      setPaying(false);
    }
  };

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-[#f6f5f2] flex items-center justify-center text-stone-500">
        {t('shopLoadingOrder')}
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#f6f5f2] flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-red-600">{error || t('shopOrderNotFound')}</p>
        <Link to={`${shopBasePath(shopKey) || '/'}`} className="text-stone-900 font-semibold underline">
          {t('shopBackToMenu')}
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
      ? t('shopDelivery')
      : order.fulfillmentChannel === 'dine_in'
        ? t('shopDineIn')
        : t('shopPickup');

  const statusLabel = translateOrderStatus(order.status, t);
  const paymentStatusLabel = isCash
    ? t('shopCash')
    : translatePaymentStatus(order.paymentStatus, t);

  const shopLocale = locale === 'de' ? 'de-CH' : locale === 'fr' ? 'fr-CH' : 'en-CH';

  return (
    <div className="min-h-screen bg-[#f6f5f2] text-stone-900">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Link
                to={shopBasePath(shopKey) || '/'}
                className="flex items-center shrink-0"
                aria-label={order.store?.name || t('shopHome')}
              >
                {order.store?.shopLogoUrl ? (
                  <img
                    src={order.store.shopLogoUrl}
                    alt=""
                    className="h-10 w-auto max-w-[6rem] object-contain"
                  />
                ) : (
                  <div className="h-10 w-10 bg-stone-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {(order.store?.name || 'M').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </Link>
              <Link
                to={shopBasePath(shopKey) || '/'}
                className="inline-flex items-center justify-center bg-stone-900 text-white px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-semibold shrink-0"
              >
                {t('shopHome')}
              </Link>
              <Link
                to={`${shopBasePath(shopKey)}/menu`}
                className="inline-flex items-center justify-center border border-stone-300 bg-white px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-semibold shrink-0"
              >
                {t('shopOrderAgain')}
              </Link>
            </div>
            <ShopLangSwitcher className="shrink-0" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-stone-400">
              {t('shopOrderConfirmation')}
            </p>
            <h1
              className="min-w-0 text-base sm:text-lg font-bold leading-snug break-all"
              title={order.orderNumber}
            >
              #{order.orderNumber}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <section className="bg-white border border-stone-200 p-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <StatusPill label={statusLabel} tone={statusTone(order.status)} />
            <StatusPill
              label={`${t('shopPaymentLabel')}: ${paymentStatusLabel}`}
              tone={paid ? 'green' : 'amber'}
            />
            <StatusPill label={channelLabel} tone="stone" />
          </div>
          <p className="text-sm text-stone-600">
            {paid
              ? isCash
                ? t('shopPayCashPos')
                : t('shopPaymentReceived')
              : t('shopCompletePayment')}
          </p>
          {order.scheduledFor && (
            <p className="text-sm font-medium">
              {t('shopScheduledFor')}{' '}
              {new Date(order.scheduledFor).toLocaleString(shopLocale, {
                timeZone: 'Europe/Zurich',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </section>

        {needsPayment && (
          <section className="bg-white border border-stone-900 p-5 space-y-3">
            <h2 className="font-semibold text-lg">{t('shopCompleteCardPayment')}</h2>
            <p className="text-sm text-stone-600">
              {t('shopAmountDue')}: <strong>{money(order.total)}</strong>
            </p>
            {session && !demoMode && <div ref={dropinRef} className="min-h-[120px]" />}
            {(demoMode || !session) && (
              <button
                type="button"
                disabled={paying}
                onClick={() => void confirmDemoPayment()}
                className="w-full bg-emerald-700 text-white font-semibold py-3 disabled:opacity-50"
              >
                {paying ? t('shopConfirming') : t('shopConfirmPaymentDemo')}
              </button>
            )}
            {payMsg && <p className="text-sm text-stone-700">{payMsg}</p>}
          </section>
        )}

        <section className="bg-white border border-stone-200 p-5 space-y-2 text-sm">
          <h2 className="font-semibold text-base mb-2">{t('shopCustomer')}</h2>
          <p className="font-medium">{order.customerName}</p>
          {order.customerPhone && <p className="text-stone-600">{order.customerPhone}</p>}
          {order.customerEmail && <p className="text-stone-600">{order.customerEmail}</p>}
          <p className="text-stone-700 pt-1">
            {order.fulfillmentChannel === 'delivery'
              ? `${t('shopDeliverTo')}: ${order.shippingAddress || '-'}`
              : `${t('shopPickupAt')}: ${order.store?.address || order.shippingAddress || t('shopRestaurant')}${
                  order.store?.city ? `, ${order.store.city}` : ''
                }`}
          </p>
          {order.notes?.replace(/\[Rounding[^\]]*\]/g, '').trim() && (
            <p className="text-stone-500 italic">
              {t('shopNote')}: {order.notes.replace(/\[Rounding[^\]]*\]/g, '').trim()}
            </p>
          )}
        </section>

        <section className="bg-white border border-stone-200 p-5">
          <h2 className="font-semibold mb-3">{t('shopItems')}</h2>
          <ul className="space-y-2">
            {(order.items || []).map((it) => (
              <li key={it.id} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0">
                  {Number(it.quantity)}× {it.productName || t('shopItem')}
                  {!!it.comboSelections?.length && (
                    <span className="block text-xs text-stone-500 mt-0.5">
                      {it.comboSelections
                        .map((c) =>
                          c.selectedExtras?.length
                            ? `${c.productName} (${c.selectedExtras.map((e) => e.name).join(', ')})`
                            : c.productName
                        )
                        .join(' · ')}
                    </span>
                  )}
                  {!it.comboSelections?.length && !!it.selectedExtras?.length && (
                    <span className="block text-xs text-stone-500 mt-0.5">
                      {it.selectedExtras.map((e) => e.name).join(', ')}
                    </span>
                  )}
                </span>
                <span className="font-medium shrink-0">{money(it.totalPrice)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-3 border-t border-stone-100 space-y-1 text-sm">
            <Row label={t('shopSubtotal')} value={money(order.subtotal)} />
            {Number(order.pointsDiscount || 0) > 0 && (
              <Row
                label={t('shopPointsDiscount')}
                value={`- ${money(order.pointsDiscount || 0)}`}
              />
            )}
            <Row label={t('shopTax')} value={money(order.taxAmount)} />
            <Row label={t('shopDelivery')} value={money(order.deliveryFee || 0)} />
            <Row label={t('shopTip')} value={money(order.tipAmount || 0)} />
            {Number(order.cardFee || 0) > 0 && (
              <Row label={t('shopCardFee')} value={money(order.cardFee || 0)} />
            )}
            {(() => {
              const parts =
                Number(order.subtotal || 0) -
                Number(order.pointsDiscount || 0) +
                Number(order.taxAmount || 0) +
                Number(order.deliveryFee || 0) +
                Number(order.tipAmount || 0) +
                Number(order.cardFee || 0);
              const roundAdj = roundMoney2(Number(order.total || 0) - parts);
              if (!roundAdj) return null;
              return (
                <Row
                  label={t('shopRounding')}
                  value={`${roundAdj > 0 ? '+' : ''}${money(roundAdj)}`}
                />
              );
            })()}
            <Row label={t('shopTotal')} value={money(order.total)} bold />
            {Number(order.pointsEarned || 0) > 0 && (
              <Row
                label={t('shopPointsEarned')}
                value={`+${order.pointsEarned} ${t('shopPoints')}`}
              />
            )}
            {Number(order.pointsRedeemed || 0) > 0 && (
              <Row
                label={t('shopPointsRedeemed')}
                value={`-${order.pointsRedeemed} ${t('shopPoints')}`}
              />
            )}
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
    <span className={`inline-flex max-w-full px-2.5 py-1 text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

function translateOrderStatus(status: string, t: (key: string) => string) {
  const key = `shopStatus_${status}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return status.replace(/_/g, ' ');
}

function translatePaymentStatus(status: string | null, t: (key: string) => string) {
  if (!status) return '-';
  const key = `shopPayStatus_${status}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return status.replace(/_/g, ' ');
}

function statusTone(status: string): 'green' | 'amber' | 'stone' | 'blue' {
  if (status === 'ready' || status === 'completed') return 'green';
  if (status === 'preparing' || status === 'confirmed' || status === 'accepted') return 'blue';
  if (status === 'cancelled' || status === 'failed') return 'amber';
  return 'stone';
}
