import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type Plan = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  priceMonthly: string;
  priceYearly?: string | null;
  currency: string;
  maxDevices: number;
  features?: string[] | null;
};

type PaymentSession = {
  id: string;
  sessionData: string;
  clientKey: string;
  environment: string;
};

type BillingPayment = {
  id: string;
  amount: string;
  currency: string;
  billingCycle: string;
  status: string;
  paidAt?: string | null;
  createdAt: string;
  plan?: { name: string; slug: string } | null;
};

function money(amount: string | number, currency = 'CHF') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'CHF',
  }).format(Number(amount));
}

export default function Billing() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSlug, setCurrentSlug] = useState<string>('free');
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(null);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [adyenReady, setAdyenReady] = useState(false);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [payMsg, setPayMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const dropinRef = useRef<HTMLDivElement>(null);
  const dropinMounted = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/merchant/billing');
      setPlans(res.data.plans || []);
      setCurrentSlug(res.data.merchant?.subscriptionPlan || 'free');
      setSubscriptionEndsAt(res.data.merchant?.subscriptionEndsAt || null);
      setPayments(res.data.payments || []);
      setAdyenReady(!!res.data.platformAdyenConfigured);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load billing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session?.sessionData || !session.clientKey || !dropinRef.current || dropinMounted.current) {
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        await import(/* @vite-ignore */ '@adyen/adyen-web/dist/adyen.css').catch(() => undefined);
        const AdyenCheckout = (await import('@adyen/adyen-web')).default;
        if (cancelled || !dropinRef.current) return;

        const checkout = await AdyenCheckout({
          environment: session.environment === 'live' ? 'live' : 'test',
          clientKey: session.clientKey,
          session: { id: session.id, sessionData: session.sessionData },
          onPaymentCompleted: async (result: { resultCode?: string }) => {
            setPayMsg('Payment completed - activating plan…');
            try {
              await api.post('/merchant/billing/confirm', {
                paymentId,
                resultCode: result?.resultCode || 'Authorised',
              });
              toast.success('Subscription activated');
              setCheckoutPlan(null);
              setSession(null);
              setPaymentId(null);
              dropinMounted.current = false;
              await load();
            } catch (err: any) {
              toast.error(err.response?.data?.error || 'Payment received but activation failed');
            }
          },
          onError: (err: { message?: string }) => {
            setPayMsg(err.message || 'Payment failed');
          },
        } as any);

        checkout.create('dropin').mount(dropinRef.current);
        dropinMounted.current = true;
      } catch {
        setPayMsg('Could not load Adyen payment form. Check platform Adyen client key.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, paymentId, load]);

  const startCheckout = async (plan: Plan) => {
    setBusy(true);
    setPayMsg('');
    setCheckoutPlan(plan);
    setSession(null);
    setPaymentId(null);
    dropinMounted.current = false;
    try {
      const res = await api.post('/merchant/billing/checkout', {
        planId: plan.id,
        billingCycle: cycle,
        returnUrl: `${window.location.origin}/merchant/billing`,
      });

      if (res.data.free) {
        toast.success(`${plan.name} plan activated`);
        setCheckoutPlan(null);
        await load();
        return;
      }

      setPaymentId(res.data.payment?.id || null);
      setSession(res.data.paymentSession);
    } catch (err: any) {
      setCheckoutPlan(null);
      toast.error(err.response?.data?.error || 'Checkout failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="card">Loading billing…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold">Billing & plans</h1>
        <p className="text-gray-600 mt-1">
          Current plan: <strong className="capitalize">{currentSlug}</strong>
          {subscriptionEndsAt
            ? ` · renews / ends ${new Date(subscriptionEndsAt).toLocaleDateString()}`
            : null}
        </p>
        {!adyenReady && (
          <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Platform Adyen is not configured yet. Free plans can still be activated; paid plans require
            the platform owner to add Adyen credentials in Superadmin → Settings.
          </p>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Choose a plan</h2>
          <div className="inline-flex rounded border overflow-hidden text-sm">
            <button
              type="button"
              className={`px-3 py-1.5 ${cycle === 'monthly' ? 'bg-slate-900 text-white' : 'bg-white'}`}
              onClick={() => setCycle('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 ${cycle === 'yearly' ? 'bg-slate-900 text-white' : 'bg-white'}`}
              onClick={() => setCycle('yearly')}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const price =
              cycle === 'yearly'
                ? plan.priceYearly != null && plan.priceYearly !== ''
                  ? Number(plan.priceYearly)
                  : Number(plan.priceMonthly) * 12
                : Number(plan.priceMonthly);
            const isCurrent = plan.slug === currentSlug;
            return (
              <div
                key={plan.id}
                className={`border rounded-lg p-4 flex flex-col ${
                  isCurrent ? 'border-emerald-500 ring-1 ring-emerald-200' : 'border-gray-200'
                }`}
              >
                <div className="font-semibold text-lg">{plan.name}</div>
                <div className="text-2xl font-bold mt-2">
                  {money(price, plan.currency)}
                  <span className="text-sm font-normal text-gray-500">
                    /{cycle === 'yearly' ? 'year' : 'month'}
                  </span>
                </div>
                {plan.description && <p className="text-sm text-gray-600 mt-2">{plan.description}</p>}
                <ul className="mt-3 space-y-1 text-sm text-gray-700 flex-1">
                  {(plan.features || []).map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                  <li>• Up to {plan.maxDevices} device(s)</li>
                </ul>
                <button
                  type="button"
                  disabled={busy || isCurrent}
                  className="btn btn-primary mt-4 w-full disabled:opacity-50"
                  onClick={() => void startCheckout(plan)}
                >
                  {isCurrent ? 'Current plan' : price <= 0 ? 'Activate free' : 'Buy with Adyen'}
                </button>
              </div>
            );
          })}
        </div>
        {!plans.length && (
          <p className="text-gray-500 text-sm">No public plans available. Ask the platform admin to create plans.</p>
        )}
      </div>

      {checkoutPlan && (
        <div className="card">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold">Pay for {checkoutPlan.name}</h2>
              <p className="text-sm text-gray-600">
                Secure checkout via Adyen - payment goes to the platform account.
              </p>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setCheckoutPlan(null);
                setSession(null);
                setPaymentId(null);
                dropinMounted.current = false;
              }}
            >
              Cancel
            </button>
          </div>
          {session ? <div ref={dropinRef} className="min-h-[140px]" /> : <p className="text-sm text-gray-500">Preparing checkout…</p>}
          {payMsg && <p className="text-sm mt-3 text-gray-700">{payMsg}</p>}
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Payment history</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Plan</th>
                <th className="py-2 pr-3">Cycle</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{new Date(p.paidAt || p.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-3">{p.plan?.name || '-'}</td>
                  <td className="py-2 pr-3 capitalize">{p.billingCycle}</td>
                  <td className="py-2 pr-3">{money(p.amount, p.currency)}</td>
                  <td className="py-2 capitalize">{p.status}</td>
                </tr>
              ))}
              {!payments.length && (
                <tr>
                  <td colSpan={5} className="py-4 text-gray-500 text-center">
                    No subscription payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
