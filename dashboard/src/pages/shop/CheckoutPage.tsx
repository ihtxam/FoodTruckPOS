import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  cartSubtotal,
  clearCart,
  clearCustomerToken,
  loadCart,
  loadCustomerToken,
  resolveShopKey,
  saveCart,
  saveCustomerToken,
  type ShopCheckoutDraft,
  type ShopChannel,
  emptyDraft,
} from '@/lib/shop-cart';
import {
  buildScheduleDays,
  isChannelOpenAt,
  localDateTimeToIso,
  type StoreHours,
} from '@/lib/shop-hours';
import { roundMoney2, roundTo005, roundingAdjustment } from '@/lib/money';

type Step = 'account' | 'details' | 'payment' | 'review';
type WhenMode = 'asap' | 'later';

export default function CheckoutPage() {
  const { merchantSlug } = useParams<{ merchantSlug: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const navigate = useNavigate();

  const [draft, setDraft] = useState<ShopCheckoutDraft>(emptyDraft());
  const [merchant, setMerchant] = useState<any>(null);
  const [step, setStep] = useState<Step>('account');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState<any>(null);
  const [checkingZone, setCheckingZone] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [paymentOptions, setPaymentOptions] = useState<any>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [whenMode, setWhenMode] = useState<WhenMode>('asap');
  const [scheduleDayOffset, setScheduleDayOffset] = useState(0);

  useEffect(() => {
    if (!shopKey) return;
    const stored = loadCart(shopKey);
    if (!stored?.items?.length) {
      navigate(`/shop/${shopKey}`, { replace: true });
      return;
    }
    setDraft(stored);
    if (stored.scheduledFor) setWhenMode('later');

    const boot = async () => {
      try {
        const [shopRes, payRes] = await Promise.all([
          axios.get(`/api/shop/${shopKey}`),
          axios.get(`/api/shop/${shopKey}/payment-options`),
        ]);
        setMerchant(shopRes.data.data);
        setPaymentOptions(payRes.data.options);

        const token = loadCustomerToken(shopKey);
        if (token) {
          try {
            const me = await axios.get(`/api/shop/${shopKey}/auth/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            setCustomer(me.data.customer);
            setDraft((d) => ({
              ...d,
              authMode: 'login',
              customerName: me.data.customer.name || d.customerName,
              customerEmail: me.data.customer.email || d.customerEmail,
              customerPhone: me.data.customer.phone || d.customerPhone,
              address: me.data.customer.defaultAddress || d.address,
              zipCode: me.data.customer.defaultZip || d.zipCode,
              city: me.data.customer.defaultCity || d.city,
            }));
            setStep('details');
          } catch {
            clearCustomerToken(shopKey);
          }
        }
      } catch (e: any) {
        setError(e.response?.data?.error || 'Failed to load checkout');
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, [shopKey, navigate]);

  useEffect(() => {
    if (!shopKey || !draft.items.length) return;
    saveCart(shopKey, draft);
  }, [draft, shopKey]);

  const taxRate = useMemo(() => {
    if (!merchant) return 0;
    if (draft.channel === 'dine_in') return Number(merchant.taxDineInRate ?? merchant.vatRate ?? 0);
    if (draft.channel === 'delivery') return Number(merchant.taxDeliveryRate ?? merchant.vatRate ?? 0);
    return Number(merchant.taxTakeawayRate ?? merchant.vatRate ?? 0);
  }, [merchant, draft.channel]);

  const channelOpen = useMemo(() => {
    if (!merchant) return false;
    const fromApi = merchant.channels?.[draft.channel]?.open;
    if (typeof fromApi === 'boolean') return fromApi;
    return isChannelOpenAt(merchant.storeHours as StoreHours, draft.channel as ShopChannel).open;
  }, [merchant, draft.channel]);

  const leadMinutes = useMemo(() => {
    const eta = Number(merchant?.channels?.[draft.channel]?.etaMinutes);
    return Number.isFinite(eta) && eta > 0 ? Math.max(15, eta) : 30;
  }, [merchant, draft.channel]);

  const scheduleDays = useMemo(() => {
    if (!merchant) return [];
    return buildScheduleDays({
      storeHours: merchant.storeHours as StoreHours,
      channel: draft.channel as ShopChannel,
      leadMinutes,
      intervalMinutes: 15,
      horizonDays: 2,
    });
  }, [merchant, draft.channel, leadMinutes]);

  const activeScheduleDay = useMemo(() => {
    if (!scheduleDays.length) return null;
    return (
      scheduleDays.find((d) => d.offset === scheduleDayOffset) ||
      scheduleDays[0]
    );
  }, [scheduleDays, scheduleDayOffset]);

  // When closed (or ASAP unavailable), force "later" and auto-pick first slot.
  useEffect(() => {
    if (!merchant || !scheduleDays.length) return;
    if (!channelOpen && whenMode === 'asap') {
      setWhenMode('later');
    }
    if (whenMode === 'later') {
      const day = scheduleDays.find((d) => d.offset === scheduleDayOffset) || scheduleDays[0];
      if (!day) return;
      if (day.offset !== scheduleDayOffset) setScheduleDayOffset(day.offset);
      const stillValid = day.slots.some((s) => s.value === draft.scheduledFor);
      if (!stillValid) {
        setDraft((d) => ({ ...d, scheduledFor: day.slots[0].value }));
      }
    } else if (whenMode === 'asap' && draft.scheduledFor) {
      setDraft((d) => ({ ...d, scheduledFor: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant, channelOpen, whenMode, scheduleDays, scheduleDayOffset, draft.channel]);

  const subtotal = roundMoney2(cartSubtotal(draft.items));
  const deliveryFee = roundMoney2(
    draft.channel === 'delivery' ? Number(deliveryInfo?.zone?.deliveryFee || 0) : 0
  );
  const tip = roundTo005(Math.max(0, Number(draft.tipAmount) || 0));
  const tax = roundMoney2(((subtotal + deliveryFee) * taxRate) / 100);
  const rawTotal = subtotal + deliveryFee + tip + tax;
  const rounding = roundingAdjustment(rawTotal);
  const total = roundTo005(rawTotal);

  const patch = (p: Partial<ShopCheckoutDraft>) => setDraft((d) => ({ ...d, ...p }));

  const checkDelivery = async () => {
    if (draft.channel !== 'delivery') return true;
    if (!draft.address.trim()) {
      setError('Enter your delivery address');
      return false;
    }
    setCheckingZone(true);
    setError(null);
    try {
      const geoRes = await axios.post(`/api/shop/${shopKey}/geocode`, {
        query: `${draft.address}, ${draft.zipCode} ${draft.city} Switzerland`,
      });
      const lat = geoRes.data.found ? Number(geoRes.data.lat) : undefined;
      const lng = geoRes.data.found ? Number(geoRes.data.lng) : undefined;
      if (lat != null && lng != null) patch({ lat, lng });
      const res = await axios.post(`/api/shop/${shopKey}/check-delivery`, {
        lat,
        lng,
        zipCode: draft.zipCode,
        subtotal,
      });
      setDeliveryInfo(res.data);
      if (!res.data.deliverable) {
        setError(res.data.error || 'Outside delivery area');
        return false;
      }
      if (!res.data.meetsMinOrder) {
        setError(res.data.message);
        return false;
      }
      return true;
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not verify address');
      return false;
    } finally {
      setCheckingZone(false);
    }
  };

  const onGuestContinue = () => {
    patch({ authMode: 'guest' });
    setStep('details');
  };

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await axios.post(`/api/shop/${shopKey}/auth/login`, {
        email: loginEmail,
        password: loginPassword,
      });
      saveCustomerToken(shopKey, res.data.token);
      setCustomer(res.data.customer);
      patch({
        authMode: 'login',
        customerName: res.data.customer.name || '',
        customerEmail: res.data.customer.email || loginEmail,
        customerPhone: res.data.customer.phone || '',
        address: res.data.customer.defaultAddress || draft.address,
        zipCode: res.data.customer.defaultZip || draft.zipCode,
        city: res.data.customer.defaultCity || draft.city,
      });
      setStep('details');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  const onRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!draft.customerEmail || password.length < 6) {
      setError('Email and password (min 6 characters) are required');
      return;
    }
    try {
      const names = draft.customerName.trim().split(/\s+/);
      const res = await axios.post(`/api/shop/${shopKey}/auth/register`, {
        email: draft.customerEmail,
        password,
        firstName: names[0],
        lastName: names.slice(1).join(' ') || undefined,
        phone: draft.customerPhone,
      });
      saveCustomerToken(shopKey, res.data.token);
      setCustomer(res.data.customer);
      patch({ authMode: 'register' });
      setStep('details');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not create account');
    }
  };

  const goPayment = async () => {
    setError(null);
    if (!draft.customerName.trim() || !draft.customerPhone.trim()) {
      setError('Name and phone are required');
      return;
    }
    if (whenMode === 'asap' && !channelOpen) {
      setError('Store is closed — please choose a later time slot');
      return;
    }
    if (whenMode === 'later' && !draft.scheduledFor) {
      setError('Please choose a day and time slot');
      return;
    }
    if (whenMode === 'later' && scheduleDays.length === 0) {
      setError('No opening hours available for scheduling — try another order type');
      return;
    }
    if (draft.channel === 'delivery') {
      const ok = await checkDelivery();
      if (!ok) return;
    }
    setStep('payment');
  };

  const placeOrder = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (draft.channel === 'delivery') {
        const ok = await checkDelivery();
        if (!ok) {
          setSubmitting(false);
          return;
        }
      }

      const token = loadCustomerToken(shopKey);
      const res = await axios.post(
        `/api/shop/${shopKey}/orders`,
        {
          items: draft.items.map((i) => ({ productId: i.id, quantity: i.quantity })),
          fulfillmentChannel: draft.channel,
          customerName: draft.customerName,
          customerEmail: draft.customerEmail || undefined,
          customerPhone: draft.customerPhone,
          shippingAddress: draft.channel === 'delivery' ? draft.address : undefined,
          city: draft.city,
          zipCode: draft.zipCode,
          lat: draft.lat,
          lng: draft.lng,
          notes: draft.notes || undefined,
          tipAmount: tip,
          paymentMethod: draft.paymentMethod,
          scheduledFor:
            whenMode === 'later' && draft.scheduledFor
              ? localDateTimeToIso(draft.scheduledFor)
              : null,
          guestCheckout: draft.authMode === 'guest',
        },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );

      const order = res.data.order;
      clearCart(shopKey);

      if (draft.paymentMethod === 'card') {
        const session = res.data.paymentSession;
        if (session?.sessionData && session?.clientKey) {
          sessionStorage.setItem(`manupos_pay_${order.id}`, JSON.stringify(session));
        }
        navigate(`/shop/${shopKey}/order/${order.id}?pay=1`);
        return;
      }

      navigate(`/shop/${shopKey}/order/${order.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f5f2] text-stone-600">
        Loading checkout…
      </div>
    );
  }

  const steps: { id: Step; label: string }[] = [
    { id: 'account', label: 'Account' },
    { id: 'details', label: 'Details' },
    { id: 'payment', label: 'Payment' },
    { id: 'review', label: 'Place order' },
  ];

  const channelLabel =
    draft.channel === 'delivery' ? 'Delivery' : draft.channel === 'dine_in' ? 'Dine in' : 'Pickup';

  return (
    <div className="min-h-screen bg-[#f6f5f2] text-stone-900">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={`/shop/${shopKey}`} className="font-bold tracking-tight">
            ← {merchant?.name || 'Back to menu'}
          </Link>
          <span className="text-sm text-stone-500">{channelLabel} checkout</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {steps.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className={`px-3 py-1.5 text-sm font-medium border ${
                  step === s.id ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-300'
                }`}
                onClick={() => {
                  const order = ['account', 'details', 'payment', 'review'] as Step[];
                  if (order.indexOf(s.id) <= order.indexOf(step)) setStep(s.id);
                }}
              >
                {idx + 1}. {s.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
          )}

          {step === 'account' && (
            <section className="bg-white border border-stone-200 p-5 space-y-5">
              <h1 className="text-2xl font-bold tracking-tight">How would you like to continue?</h1>
              <button
                type="button"
                className="w-full border-2 border-stone-900 py-4 font-semibold hover:bg-stone-50"
                onClick={onGuestContinue}
              >
                Continue as guest
              </button>

              <div className="grid md:grid-cols-2 gap-4 pt-2">
                <form onSubmit={onLogin} className="border border-stone-200 p-4 space-y-3">
                  <h2 className="font-semibold">Log in</h2>
                  <input
                    className="w-full border border-stone-300 px-3 py-2 text-sm"
                    type="email"
                    placeholder="Email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                  <input
                    className="w-full border border-stone-300 px-3 py-2 text-sm"
                    type="password"
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <button type="submit" className="w-full bg-stone-900 text-white py-2.5 font-semibold">
                    Log in
                  </button>
                </form>

                <form onSubmit={onRegister} className="border border-stone-200 p-4 space-y-3">
                  <h2 className="font-semibold">Create account</h2>
                  <input
                    className="w-full border border-stone-300 px-3 py-2 text-sm"
                    placeholder="Full name"
                    value={draft.customerName}
                    onChange={(e) => patch({ customerName: e.target.value })}
                    required
                  />
                  <input
                    className="w-full border border-stone-300 px-3 py-2 text-sm"
                    type="email"
                    placeholder="Email"
                    value={draft.customerEmail}
                    onChange={(e) => patch({ customerEmail: e.target.value })}
                    required
                  />
                  <input
                    className="w-full border border-stone-300 px-3 py-2 text-sm"
                    placeholder="Phone"
                    value={draft.customerPhone}
                    onChange={(e) => patch({ customerPhone: e.target.value })}
                  />
                  <input
                    className="w-full border border-stone-300 px-3 py-2 text-sm"
                    type="password"
                    placeholder="Password (min 6)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button type="submit" className="w-full bg-stone-900 text-white py-2.5 font-semibold">
                    Register & continue
                  </button>
                </form>
              </div>
              {customer && (
                <p className="text-sm text-teal-800">
                  Logged in as {customer.name || customer.email}.{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      clearCustomerToken(shopKey);
                      setCustomer(null);
                    }}
                  >
                    Log out
                  </button>
                </p>
              )}
            </section>
          )}

          {step === 'details' && (
            <section className="bg-white border border-stone-200 p-5 space-y-4">
              <h1 className="text-2xl font-bold tracking-tight">
                {draft.channel === 'delivery' ? 'Delivery details' : 'Pickup details'}
              </h1>
              <p className="text-sm text-stone-500">
                {draft.channel === 'delivery'
                  ? 'Where should we deliver your order?'
                  : `Collect from ${merchant?.address || 'the restaurant'}${
                      merchant?.city ? `, ${merchant.city}` : ''
                    }`}
              </p>

              <div className="grid md:grid-cols-2 gap-3">
                <input
                  className="border border-stone-300 px-3 py-2 text-sm md:col-span-2"
                  placeholder="Full name *"
                  value={draft.customerName}
                  onChange={(e) => patch({ customerName: e.target.value })}
                  required
                />
                <input
                  className="border border-stone-300 px-3 py-2 text-sm"
                  placeholder="Phone *"
                  value={draft.customerPhone}
                  onChange={(e) => patch({ customerPhone: e.target.value })}
                  required
                />
                <input
                  className="border border-stone-300 px-3 py-2 text-sm"
                  type="email"
                  placeholder="Email (receipt)"
                  value={draft.customerEmail}
                  onChange={(e) => patch({ customerEmail: e.target.value })}
                />
              </div>

              {draft.channel === 'delivery' && (
                <div className="space-y-3 border-t border-stone-100 pt-4">
                  <input
                    className="w-full border border-stone-300 px-3 py-2 text-sm"
                    placeholder="Street address *"
                    value={draft.address}
                    onChange={(e) => patch({ address: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className="border border-stone-300 px-3 py-2 text-sm"
                      placeholder="ZIP"
                      value={draft.zipCode}
                      onChange={(e) => patch({ zipCode: e.target.value })}
                    />
                    <input
                      className="border border-stone-300 px-3 py-2 text-sm"
                      placeholder="City"
                      value={draft.city}
                      onChange={(e) => patch({ city: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    className="border border-stone-900 px-4 py-2 text-sm font-semibold"
                    onClick={checkDelivery}
                    disabled={checkingZone}
                  >
                    {checkingZone ? 'Checking…' : 'Verify delivery zone'}
                  </button>
                  {deliveryInfo?.deliverable && (
                    <p className="text-sm text-teal-800">
                      {deliveryInfo.zone.name}: fee CHF {Number(deliveryInfo.zone.deliveryFee).toFixed(2)}
                      {deliveryInfo.zone.minOrderAmount > 0
                        ? ` · min CHF ${Number(deliveryInfo.zone.minOrderAmount).toFixed(2)}`
                        : ''}
                    </p>
                  )}
                </div>
              )}

              <div className="border-t border-stone-100 pt-4 space-y-3">
                <label className="block text-sm font-medium">When?</label>
                {!channelOpen && (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2">
                    Store is closed now
                    {merchant?.channels?.[draft.channel]?.todayLabel
                      ? ` · ${merchant.channels[draft.channel].todayLabel}`
                      : ''}
                    . Choose a later slot (tomorrow or day after tomorrow).
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {channelOpen && (
                    <button
                      type="button"
                      className={`px-3 py-2 text-sm border ${
                        whenMode === 'asap' ? 'bg-stone-900 text-white' : 'bg-white'
                      }`}
                      onClick={() => {
                        setWhenMode('asap');
                        patch({ scheduledFor: '' });
                      }}
                    >
                      ASAP
                    </button>
                  )}
                  <button
                    type="button"
                    className={`px-3 py-2 text-sm border ${
                      whenMode === 'later' ? 'bg-stone-900 text-white' : 'bg-white'
                    }`}
                    onClick={() => setWhenMode('later')}
                  >
                    Schedule for later
                  </button>
                </div>

                {whenMode === 'later' && (
                  <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                    {scheduleDays.length === 0 ? (
                      <p className="text-sm text-red-600">
                        No open hours in the next days for this option. Check store hours or try another channel.
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {scheduleDays.map((day) => (
                            <button
                              key={day.offset}
                              type="button"
                              className={`px-3 py-2 text-sm border rounded-md ${
                                activeScheduleDay?.offset === day.offset
                                  ? 'bg-stone-900 text-white border-stone-900'
                                  : 'bg-white border-stone-300'
                              }`}
                              onClick={() => {
                                setScheduleDayOffset(day.offset);
                                patch({ scheduledFor: day.slots[0]?.value || '' });
                              }}
                            >
                              <span className="font-semibold block">{day.label}</span>
                              <span className="text-[11px] opacity-80">
                                {day.weekday} {day.dateLabel}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div>
                          <p className="text-xs text-stone-500 mb-2">
                            Time slots every 15 min during opening hours
                          </p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                            {(activeScheduleDay?.slots || []).map((slot) => (
                              <button
                                key={slot.value}
                                type="button"
                                className={`px-2 py-2 text-sm border rounded-md font-medium ${
                                  draft.scheduledFor === slot.value
                                    ? 'bg-teal-700 text-white border-teal-700'
                                    : 'bg-white border-stone-300 hover:border-stone-900'
                                }`}
                                onClick={() => patch({ scheduledFor: slot.value })}
                              >
                                {slot.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <textarea
                  className="w-full border border-stone-300 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Order notes (allergies, door code…)"
                  value={draft.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </div>

              <button
                type="button"
                className="w-full bg-stone-900 text-white py-3 font-semibold"
                onClick={goPayment}
              >
                Continue to payment
              </button>
            </section>
          )}

          {step === 'payment' && (
            <section className="bg-white border border-stone-200 p-5 space-y-4">
              <h1 className="text-2xl font-bold tracking-tight">Payment</h1>
              <div className="space-y-3">
                <label
                  className={`flex items-start gap-3 border p-4 cursor-pointer ${
                    draft.paymentMethod === 'cash' ? 'border-stone-900 bg-stone-50' : 'border-stone-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="pay"
                    checked={draft.paymentMethod === 'cash'}
                    onChange={() => patch({ paymentMethod: 'cash' })}
                  />
                  <div>
                    <div className="font-semibold">
                      Cash {draft.channel === 'delivery' ? 'on delivery' : 'on pickup'}
                    </div>
                    <p className="text-sm text-stone-500">Pay the courier or at the counter.</p>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-3 border p-4 cursor-pointer ${
                    draft.paymentMethod === 'card' ? 'border-stone-900 bg-stone-50' : 'border-stone-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="pay"
                    checked={draft.paymentMethod === 'card'}
                    onChange={() => patch({ paymentMethod: 'card' })}
                  />
                  <div>
                    <div className="font-semibold">Card (Adyen)</div>
                    <p className="text-sm text-stone-500">
                      {paymentOptions?.cardReady
                        ? 'Secure online payment with Adyen.'
                        : 'Online card payment — merchant Adyen credentials will be used when configured.'}
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tip</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[0, 5, 10, 15].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      className="px-3 py-1.5 text-sm border border-stone-300 bg-white"
                      onClick={() => patch({ tipAmount: roundTo005((subtotal * pct) / 100) })}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.05"
                  className="border border-stone-300 px-3 py-2 text-sm w-40"
                  value={draft.tipAmount}
                  onChange={(e) => patch({ tipAmount: roundTo005(Number(e.target.value) || 0) })}
                />
              </div>

              <button
                type="button"
                className="w-full bg-stone-900 text-white py-3 font-semibold"
                onClick={() => setStep('review')}
              >
                Review order
              </button>
            </section>
          )}

          {step === 'review' && (
            <section className="bg-white border border-stone-200 p-5 space-y-4">
              <h1 className="text-2xl font-bold tracking-tight">Review & place order</h1>
              <dl className="text-sm space-y-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">Type</dt>
                  <dd className="font-medium">{channelLabel}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">Customer</dt>
                  <dd className="font-medium text-right">
                    {draft.customerName}
                    <br />
                    {draft.customerPhone}
                    {draft.customerEmail ? (
                      <>
                        <br />
                        {draft.customerEmail}
                      </>
                    ) : null}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">
                    {draft.channel === 'delivery' ? 'Deliver to' : 'Pickup at'}
                  </dt>
                  <dd className="font-medium text-right max-w-xs">
                    {draft.channel === 'delivery'
                      ? `${draft.address}, ${draft.zipCode} ${draft.city}`
                      : `${merchant?.address || ''}${merchant?.city ? `, ${merchant.city}` : ''}`}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">When</dt>
                  <dd className="font-medium">
                    {whenMode === 'later' && draft.scheduledFor
                      ? new Date(localDateTimeToIso(draft.scheduledFor) || draft.scheduledFor).toLocaleString('en-CH', {
                          timeZone: 'Europe/Zurich',
                        })
                      : 'ASAP'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">Payment</dt>
                  <dd className="font-medium">
                    {draft.paymentMethod === 'card'
                      ? 'Card (Adyen)'
                      : draft.channel === 'delivery'
                        ? 'Cash on delivery'
                        : 'Cash on pickup'}
                  </dd>
                </div>
              </dl>

              <ul className="border-t border-stone-100 pt-3 space-y-2 text-sm">
                {draft.items.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span>
                      {i.quantity}× {i.name}
                    </span>
                    <span>CHF {(i.price * i.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="w-full bg-stone-900 text-white py-3.5 font-semibold disabled:opacity-40"
                disabled={submitting}
                onClick={placeOrder}
              >
                {submitting
                  ? 'Placing order…'
                  : draft.paymentMethod === 'card'
                    ? `Pay CHF ${total.toFixed(2)}`
                    : `Place order · CHF ${total.toFixed(2)}`}
              </button>
            </section>
          )}
        </div>

        <aside className="bg-white border border-stone-200 p-5 h-fit sticky top-4 space-y-3">
          <h2 className="font-bold text-lg">Your order</h2>
          <ul className="text-sm space-y-2">
            {draft.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-2">
                <span>
                  {i.quantity}× {i.name}
                </span>
                <span>CHF {(i.price * i.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-stone-100 pt-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-500">Subtotal</span>
              <span>CHF {subtotal.toFixed(2)}</span>
            </div>
            {deliveryFee > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">Delivery</span>
                <span>CHF {deliveryFee.toFixed(2)}</span>
              </div>
            )}
            {tip > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">Tip</span>
                <span>CHF {tip.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500">Tax ({taxRate}%)</span>
              <span>CHF {tax.toFixed(2)}</span>
            </div>
            {rounding !== 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">Rounding</span>
                <span>
                  {rounding > 0 ? '+' : ''}CHF {rounding.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1">
              <span>Total</span>
              <span>CHF {total.toFixed(2)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
