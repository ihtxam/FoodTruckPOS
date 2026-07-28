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
  shopBasePath,
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
import { isLocale, useI18n } from '@/lib/i18n';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import ZipCityFields from '@/components/shop/ZipCityFields';
import ShopVacationPopup from '@/components/shop/ShopVacationPopup';
import ShopNotAcceptingBanner from '@/components/shop/ShopNotAcceptingBanner';

type Step = 'details' | 'payment' | 'review';
type WhenMode = 'asap' | 'later';

export default function CheckoutPage() {
  const { t, setLocale, locale } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const navigate = useNavigate();

  const [draft, setDraft] = useState<ShopCheckoutDraft>(emptyDraft());
  const [merchant, setMerchant] = useState<any>(null);
  const [step, setStep] = useState<Step>('details');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState<any>(null);
  const [checkingZone, setCheckingZone] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [wantCreateAccount, setWantCreateAccount] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [paymentOptions, setPaymentOptions] = useState<any>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [whenMode, setWhenMode] = useState<WhenMode>('asap');
  const [scheduleDayOffset, setScheduleDayOffset] = useState(0);
  const [loyaltyBalance, setLoyaltyBalance] = useState(0);
  const [redeemRate, setRedeemRate] = useState(100);
  /** Explicit "Pay with points" option on the payment step */
  const [payWithPoints, setPayWithPoints] = useState(false);

  useEffect(() => {
    if (!shopKey) return;
    const stored = loadCart(shopKey);
    if (!stored?.items?.length) {
      navigate(`${shopBasePath(shopKey) || '/'}`, { replace: true });
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
        if (isLocale(shopRes.data.data?.language)) {
          try {
            const stored = localStorage.getItem('manupos_shop_lang');
            if (!isLocale(stored)) setLocale(shopRes.data.data.language);
          } catch {
            setLocale(shopRes.data.data.language);
          }
        }

        const token = loadCustomerToken(shopKey);
        if (token) {
          try {
            const [me, loyaltyRes] = await Promise.all([
              axios.get(`/api/shop/${shopKey}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
              }),
              axios.get(`/api/shop/${shopKey}/loyalty`, {
                headers: { Authorization: `Bearer ${token}` },
              }),
            ]);
            setCustomer(me.data.customer);
            setLoyaltyBalance(Number(loyaltyRes.data.balance) || 0);
            setRedeemRate(Number(loyaltyRes.data.program?.redeemPointsPerChf) || 100);
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
            setWantCreateAccount(false);
            setShowLogin(false);
          } catch {
            clearCustomerToken(shopKey);
          }
        }
      } catch (e: any) {
        setError(e.response?.data?.error || t('shopFailedCheckout'));
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

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

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

  const shopLocale = locale === 'fr' ? 'fr-CH' : locale === 'de' ? 'de-CH' : 'en-CH';

  const scheduleDays = useMemo(() => {
    if (!merchant) return [];
    return buildScheduleDays({
      storeHours: merchant.storeHours as StoreHours,
      channel: draft.channel as ShopChannel,
      leadMinutes,
      intervalMinutes: 15,
      horizonDays: 2,
      locale: shopLocale,
    });
  }, [merchant, draft.channel, leadMinutes, shopLocale]);

  const scheduleDayTitle = (offset: number) => {
    if (offset === 0) return t('shopToday');
    if (offset === 1) return t('shopTomorrow');
    if (offset === 2) return t('shopDayAfterTomorrow');
    return t('shopPlusDays').replace('{n}', String(offset));
  };

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
  const rewardPointsInCart = draft.items
    .filter((i) => i.loyaltyReward)
    .reduce((s, i) => s + (i.rewardPointsCost || 0) * i.quantity, 0);
  const loyaltyEnabled = !!merchant?.loyalty?.enabled && !!customer;
  const rate = Math.max(1, Math.floor(redeemRate || 100));
  const balanceAfterRewards = Math.max(0, loyaltyBalance - rewardPointsInCart);
  // Points can cover food + delivery + tax (not tip / card fee)
  const redeemableBase = roundMoney2(subtotal + deliveryFee + tax);
  const maxCashPoints = Math.min(
    Math.floor(Math.max(0, redeemableBase)) * rate,
    Math.floor(balanceAfterRewards / rate) * rate
  );
  const pointsToRedeem = payWithPoints
    ? Math.min(
        Math.max(0, Math.floor(Number(draft.pointsToRedeem) || 0)),
        maxCashPoints
      )
    : 0;
  const pointsDiscount = Math.floor(pointsToRedeem / rate);
  const preCardTotal = Math.max(0, redeemableBase - pointsDiscount) + tip;
  const cardFeeFixed = Number(paymentOptions?.cardFeeFixed || 0) || 0;
  const cardFeePercent = Number(paymentOptions?.cardFeePercent || 0) || 0;
  const remainingAfterPoints = Math.max(0, redeemableBase - pointsDiscount) + tip;
  const cardFee =
    draft.paymentMethod === 'card' && remainingAfterPoints > 0
      ? roundTo005(Math.max(0, cardFeeFixed + (preCardTotal * cardFeePercent) / 100))
      : 0;
  const rawTotal = preCardTotal + cardFee;
  const rounding = roundingAdjustment(rawTotal);
  const total = roundTo005(rawTotal);
  const pointsCoverFullOrder = payWithPoints && pointsDiscount > 0 && total <= 0.001;

  const patch = (p: Partial<ShopCheckoutDraft>) => setDraft((d) => ({ ...d, ...p }));

  const setLineQty = (lineId: string, quantity: number) => {
    setDraft((d) => {
      const items =
        quantity <= 0
          ? d.items.filter((i) => (i.lineId || i.id) !== lineId)
          : d.items.map((i) =>
              (i.lineId || i.id) === lineId ? { ...i, quantity } : i
            );
      const next = { ...d, items };
      if (shopKey) saveCart(shopKey, next);
      if (!items.length) {
        clearCart(shopKey);
        navigate(`${shopBasePath(shopKey) || '/'}`, { replace: true });
      }
      return next;
    });
  };

  const removeLine = (lineId: string) => setLineQty(lineId, 0);

  const checkDelivery = async () => {
    if (draft.channel !== 'delivery') return true;
    if (!draft.address.trim()) {
      setError(t('shopEnterDeliveryAddress'));
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
        setError(res.data.error || t('shopOutsideDelivery'));
        return false;
      }
      if (!res.data.meetsMinOrder) {
        setError(res.data.message);
        return false;
      }
      return true;
    } catch (e: any) {
      setError(e.response?.data?.error || t('shopCouldNotVerifyAddress'));
      return false;
    } finally {
      setCheckingZone(false);
    }
  };

  const refreshLoyalty = async (authToken: string) => {
    try {
      const loyaltyRes = await axios.get(`/api/shop/${shopKey}/loyalty`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setLoyaltyBalance(Number(loyaltyRes.data.balance) || 0);
      setRedeemRate(Number(loyaltyRes.data.program?.redeemPointsPerChf) || 100);
    } catch {
      /* optional */
    }
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
      await refreshLoyalty(res.data.token);
      setWantCreateAccount(false);
      setShowLogin(false);
      setPassword('');
      patch({
        authMode: 'login',
        customerName: res.data.customer.name || '',
        customerEmail: res.data.customer.email || loginEmail,
        customerPhone: res.data.customer.phone || '',
        address: res.data.customer.defaultAddress || draft.address,
        zipCode: res.data.customer.defaultZip || draft.zipCode,
        city: res.data.customer.defaultCity || draft.city,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || t('shopLoginFailed'));
    }
  };

  const registerAccount = async () => {
    if (!draft.customerEmail.trim() || password.length < 6) {
      setError(t('shopEmailPasswordRequired'));
      return false;
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
      await refreshLoyalty(res.data.token);
      setWantCreateAccount(false);
      setPassword('');
      patch({ authMode: 'register' });
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || t('shopCouldNotCreateAccount'));
      return false;
    }
  };

  const goPayment = async () => {
    setError(null);
    if (!draft.customerName.trim() || !draft.customerPhone.trim()) {
      setError(t('shopNamePhoneRequired'));
      return;
    }
    if (!customer && wantCreateAccount) {
      const ok = await registerAccount();
      if (!ok) return;
    } else if (!customer) {
      patch({ authMode: 'guest' });
    }
    if (whenMode === 'asap' && !channelOpen) {
      setError(t('shopClosedChooseLater'));
      return;
    }
    if (whenMode === 'later' && !draft.scheduledFor) {
      setError(t('shopChooseDayAndTime'));
      return;
    }
    if (whenMode === 'later' && scheduleDays.length === 0) {
      setError(t('shopNoOpeningHours'));
      return;
    }
    if (draft.channel === 'delivery') {
      const ok = await checkDelivery();
      if (!ok) return;
    }
    setStep('payment');
  };

  const placeOrder = async () => {
    if (merchant?.acceptingOrders === false) {
      setError(t('shopNotAcceptingOrders'));
      return;
    }
    if (merchant?.vacation?.active) {
      setError(t('shopVacationOrdersBlocked'));
      return;
    }
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
          items: draft.items.map((i) => ({
            productId: i.id,
            quantity: i.quantity,
            selectedExtras: (i.selectedExtras || [])
              .filter((e) => e.id && !String(e.id).startsWith('combo:'))
              .map((e) => ({ id: e.id })),
            comboSelections: (i.comboSelections || []).map((c) => ({
              slotId: c.slotId,
              slotName: c.slotName,
              productId: c.productId,
              selectedExtras: (c.selectedExtras || []).map((e) => ({ id: e.id })),
            })),
            loyaltyReward: !!i.loyaltyReward,
          })),
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
          paymentMethod: pointsCoverFullOrder ? 'cash' : draft.paymentMethod,
          pointsToRedeem: loyaltyEnabled && payWithPoints ? pointsToRedeem : 0,
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

      const payCard = !pointsCoverFullOrder && draft.paymentMethod === 'card';
      if (payCard) {
        const session = res.data.paymentSession;
        if (session?.sessionData && session?.clientKey) {
          sessionStorage.setItem(`manupos_pay_${order.id}`, JSON.stringify(session));
        }
        navigate(`${shopBasePath(shopKey)}/order/${order.id}?pay=1`);
        return;
      }

      navigate(`${shopBasePath(shopKey)}/order/${order.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || t('shopCheckoutFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f5f2] text-stone-600">
        {t('shopLoadingCheckout')}
      </div>
    );
  }

  const steps: { id: Step; label: string }[] = [
    { id: 'details', label: t('shopStepDetails') },
    { id: 'payment', label: t('shopStepPayment') },
    { id: 'review', label: t('shopStepReview') },
  ];

  const channelLabel =
    draft.channel === 'delivery' ? t('shopDelivery') : draft.channel === 'dine_in' ? t('shopDineIn') : t('shopPickup');

  return (
    <div className="min-h-screen bg-[#f6f5f2] text-stone-900">
      <ShopVacationPopup vacation={merchant?.vacation} shopKey={shopKey} />
      {merchant?.acceptingOrders === false && !merchant?.vacation?.active ? (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <ShopNotAcceptingBanner kind="orders" phone={merchant?.phone} />
        </div>
      ) : null}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link to={`${shopBasePath(shopKey) || '/'}`} className="font-bold tracking-tight min-w-0 truncate">
            ← {merchant?.name || t('shopBackToMenu')}
          </Link>
          <div className="flex items-center gap-3 shrink-0">
            <ShopLangSwitcher />
            <span className="hidden sm:inline text-sm text-stone-500">{channelLabel} {t('shopCheckout')}</span>
          </div>
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
                  const order = ['details', 'payment', 'review'] as Step[];
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

          {step === 'details' && (
            <section className="bg-white border border-stone-200 p-5 space-y-4">
              <h1 className="text-2xl font-bold tracking-tight">
                {draft.channel === 'delivery' ? t('shopDeliveryDetails') : t('shopPickupDetails')}
              </h1>
              <p className="text-sm text-stone-500">
                {draft.channel === 'delivery'
                  ? t('shopWhereDeliver')
                  : `${t('shopCollectFrom')} ${merchant?.address || t('shopRestaurant')}${
                      merchant?.city ? `, ${merchant.city}` : ''
                    }`}
              </p>

              <div className="grid md:grid-cols-2 gap-3">
                <input
                  className="border border-stone-300 px-3 py-2 text-sm md:col-span-2"
                  placeholder={t('shopFullNameRequired')}
                  value={draft.customerName}
                  onChange={(e) => patch({ customerName: e.target.value })}
                  required
                />
                <input
                  className="border border-stone-300 px-3 py-2 text-sm"
                  placeholder={t('shopPhoneRequired')}
                  value={draft.customerPhone}
                  onChange={(e) => patch({ customerPhone: e.target.value })}
                  required
                />
                <input
                  className="border border-stone-300 px-3 py-2 text-sm"
                  type="email"
                  placeholder={
                    wantCreateAccount ? `${t('shopEmail')} *` : t('shopEmailReceipt')
                  }
                  value={draft.customerEmail}
                  onChange={(e) => {
                    patch({ customerEmail: e.target.value });
                    if (!showLogin) setLoginEmail(e.target.value);
                  }}
                />
              </div>

              {customer ? (
                <p className="text-sm text-teal-800 border border-teal-100 bg-teal-50 px-3 py-2">
                  {t('shopLoggedInAs')} {customer.name || customer.email}.{' '}
                  <button
                    type="button"
                    className="underline font-medium"
                    onClick={() => {
                      clearCustomerToken(shopKey);
                      setCustomer(null);
                      patch({ authMode: 'guest' });
                    }}
                  >
                    {t('shopLogOut')}
                  </button>
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4 border border-stone-100 bg-stone-50/60 p-4">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-stone-300"
                        checked={wantCreateAccount}
                        onChange={(e) => {
                          setWantCreateAccount(e.target.checked);
                          if (e.target.checked) setShowLogin(false);
                          if (!e.target.checked) setPassword('');
                        }}
                      />
                      {t('shopCreateAccount')}
                    </label>
                    {wantCreateAccount && (
                      <input
                        className="w-full border border-stone-300 px-3 py-2 text-sm bg-white"
                        type="password"
                        placeholder={t('shopPasswordMin6')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    )}
                  </div>

                  <div className="space-y-3 md:border-l md:border-stone-200 md:pl-4">
                    {!showLogin ? (
                      <div className="space-y-1">
                        <p className="text-sm text-stone-500">{t('shopHaveAccount')}</p>
                        <button
                          type="button"
                          className="text-sm font-semibold underline underline-offset-2"
                          onClick={() => {
                            setShowLogin(true);
                            setWantCreateAccount(false);
                            setPassword('');
                            if (draft.customerEmail) setLoginEmail(draft.customerEmail);
                          }}
                        >
                          {t('shopLogIn')}
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={onLogin} className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="font-semibold text-sm">{t('shopLogIn')}</h2>
                          <button
                            type="button"
                            className="text-xs text-stone-500 underline"
                            onClick={() => setShowLogin(false)}
                          >
                            {t('cancel')}
                          </button>
                        </div>
                        <input
                          className="w-full border border-stone-300 px-3 py-2 text-sm bg-white"
                          type="email"
                          placeholder={t('shopEmail')}
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                          autoComplete="email"
                        />
                        <input
                          className="w-full border border-stone-300 px-3 py-2 text-sm bg-white"
                          type="password"
                          placeholder={t('shopPassword')}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          autoComplete="current-password"
                        />
                        <button
                          type="submit"
                          className="w-full bg-stone-900 text-white py-2.5 text-sm font-semibold"
                        >
                          {t('shopLogIn')}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )}

              {draft.channel === 'delivery' && (
                <div className="space-y-3 border-t border-stone-100 pt-4">
                  <input
                    className="w-full border border-stone-300 px-3 py-2 text-sm"
                    placeholder={t('shopStreetAddressRequired')}
                    value={draft.address}
                    onChange={(e) => patch({ address: e.target.value })}
                  />
                  <ZipCityFields
                    shopKey={shopKey}
                    zipCode={draft.zipCode}
                    city={draft.city}
                    onZipChange={(zipCode) => patch({ zipCode })}
                    onCityChange={(city) => patch({ city })}
                    zipClassName="border border-stone-300 px-3 py-2 text-sm w-full"
                    cityClassName="border border-stone-300 px-3 py-2 text-sm w-full"
                  />
                  <button
                    type="button"
                    className="border border-stone-900 px-4 py-2 text-sm font-semibold"
                    onClick={checkDelivery}
                    disabled={checkingZone}
                  >
                    {checkingZone ? t('shopChecking') : t('shopVerifyDeliveryZone')}
                  </button>
                  {deliveryInfo?.deliverable && (
                    <p className="text-sm text-teal-800">
                      {deliveryInfo.zone.name}: {t('shopFee')} CHF {Number(deliveryInfo.zone.deliveryFee).toFixed(2)}
                      {deliveryInfo.zone.minOrderAmount > 0
                        ? ` · ${t('shopMin')} CHF ${Number(deliveryInfo.zone.minOrderAmount).toFixed(2)}`
                        : ''}
                    </p>
                  )}
                </div>
              )}

              <div className="border-t border-stone-100 pt-4 space-y-3">
                <label className="block text-sm font-medium">{t('shopWhen')}</label>
                {!channelOpen && (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2">
                    {t('shopStoreClosedNow')}
                    {merchant?.channels?.[draft.channel]?.todayLabel
                      ? ` · ${merchant.channels[draft.channel].todayLabel}`
                      : ''}
                    . {t('shopChooseLaterSlot')}
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
                      {t('shopAsap')}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`px-3 py-2 text-sm border ${
                      whenMode === 'later' ? 'bg-stone-900 text-white' : 'bg-white'
                    }`}
                    onClick={() => setWhenMode('later')}
                  >
                    {t('shopScheduleLater')}
                  </button>
                </div>

                {whenMode === 'later' && (
                  <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                    {scheduleDays.length === 0 ? (
                      <p className="text-sm text-red-600">
                        {t('shopNoOpenHours')}
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          {scheduleDays.map((day) => (
                            <button
                              key={day.offset}
                              type="button"
                              className={`min-w-0 px-1.5 py-2 text-center border rounded-md ${
                                activeScheduleDay?.offset === day.offset
                                  ? 'bg-stone-900 text-white border-stone-900'
                                  : 'bg-white border-stone-300'
                              }`}
                              onClick={() => {
                                setScheduleDayOffset(day.offset);
                                patch({ scheduledFor: day.slots[0]?.value || '' });
                              }}
                            >
                              <span className="font-semibold block text-xs sm:text-sm leading-tight">
                                {scheduleDayTitle(day.offset)}
                              </span>
                              <span className="text-[10px] sm:text-[11px] opacity-80 block truncate">
                                {day.weekday} {day.dateLabel}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div>
                          <p className="text-xs text-stone-500 mb-2">
                            {t('shopTimeSlotsHint')}
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
                  placeholder={t('shopOrderNotes')}
                  value={draft.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </div>

              <button
                type="button"
                className="w-full bg-stone-900 text-white py-3 font-semibold"
                onClick={goPayment}
              >
                {t('shopContinuePayment')}
              </button>
            </section>
          )}

          {step === 'payment' && (
            <section className="bg-white border border-stone-200 p-5 space-y-4">
              <h1 className="text-2xl font-bold tracking-tight">{t('shopPayment')}</h1>
              <div className="space-y-3">
                {loyaltyEnabled && maxCashPoints > 0 && (
                  <label
                    className={`flex items-start gap-3 border p-4 cursor-pointer ${
                      payWithPoints ? 'border-teal-800 bg-teal-50' : 'border-stone-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payPrimary"
                      checked={payWithPoints}
                      onChange={() => {
                        setPayWithPoints(true);
                        patch({
                          pointsToRedeem: maxCashPoints,
                          paymentMethod: 'cash',
                        });
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{t('shopPayWithPoints')}</div>
                      <p className="text-sm text-stone-600 mt-0.5">
                        {t('shopPayWithPointsHint')
                          .replace('{pts}', String(balanceAfterRewards))
                          .replace('{chf}', (maxCashPoints / rate).toFixed(2))}
                      </p>
                      {payWithPoints && (
                        <div className="mt-3 space-y-2">
                          <input
                            type="range"
                            min={rate}
                            max={maxCashPoints}
                            step={rate}
                            value={Math.max(rate, pointsToRedeem)}
                            onChange={(e) =>
                              patch({
                                pointsToRedeem: Math.max(
                                  rate,
                                  Math.floor(Number(e.target.value) || 0)
                                ),
                              })
                            }
                            className="w-full"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span>
                              {t('shopPointsChip').replace('{n}', String(pointsToRedeem))}
                            </span>
                            <span className="font-semibold text-teal-900">
                              − CHF {pointsDiscount.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500">
                            {t('shopRedeemHint').replace('{n}', String(rate))}
                            {' · '}
                            {t('shopPointsCoverFoodFees')}
                          </p>
                          {total > 0.001 ? (
                            <div className="pt-2 border-t border-teal-100 space-y-2">
                              <p className="text-xs font-medium text-stone-700">
                                {t('shopPayRemaining')
                                  .replace('{chf}', total.toFixed(2))}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className={`px-3 py-1.5 text-sm border ${
                                    draft.paymentMethod === 'cash'
                                      ? 'border-stone-900 bg-white font-semibold'
                                      : 'border-stone-300 bg-white'
                                  }`}
                                  onClick={() => patch({ paymentMethod: 'cash' })}
                                >
                                  {draft.channel === 'delivery'
                                    ? t('shopCashOnDelivery')
                                    : t('shopCashOnPickup')}
                                </button>
                                <button
                                  type="button"
                                  className={`px-3 py-1.5 text-sm border ${
                                    draft.paymentMethod === 'card'
                                      ? 'border-stone-900 bg-white font-semibold'
                                      : 'border-stone-300 bg-white'
                                  }`}
                                  onClick={() => patch({ paymentMethod: 'card' })}
                                >
                                  {t('shopCardAdyen')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs font-medium text-teal-900 pt-1">
                              {t('shopPointsCoverAll')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                )}

                <label
                  className={`flex items-start gap-3 border p-4 cursor-pointer ${
                    !payWithPoints && draft.paymentMethod === 'cash'
                      ? 'border-stone-900 bg-stone-50'
                      : 'border-stone-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="payPrimary"
                    checked={!payWithPoints && draft.paymentMethod === 'cash'}
                    onChange={() => {
                      setPayWithPoints(false);
                      patch({ paymentMethod: 'cash', pointsToRedeem: 0 });
                    }}
                  />
                  <div>
                    <div className="font-semibold">
                      {draft.channel === 'delivery' ? t('shopCashOnDelivery') : t('shopCashOnPickup')}
                    </div>
                    <p className="text-sm text-stone-500">{t('shopCashPayHint')}</p>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-3 border p-4 cursor-pointer ${
                    !payWithPoints && draft.paymentMethod === 'card'
                      ? 'border-stone-900 bg-stone-50'
                      : 'border-stone-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="payPrimary"
                    checked={!payWithPoints && draft.paymentMethod === 'card'}
                    onChange={() => {
                      setPayWithPoints(false);
                      patch({ paymentMethod: 'card', pointsToRedeem: 0 });
                    }}
                  />
                  <div>
                    <div className="font-semibold">{t('shopCardAdyen')}</div>
                    <p className="text-sm text-stone-500">
                      {paymentOptions?.cardReady
                        ? t('shopCardReady')
                        : t('shopCardNotReady')}
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('shopTip')}</label>
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
                {t('shopReviewOrder')}
              </button>
            </section>
          )}

          {step === 'review' && (
            <section className="bg-white border border-stone-200 p-5 space-y-4">
              <h1 className="text-2xl font-bold tracking-tight">{t('shopReviewPlace')}</h1>
              <dl className="text-sm space-y-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">{t('shopType')}</dt>
                  <dd className="font-medium">{channelLabel}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">{t('shopCustomer')}</dt>
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
                    {draft.channel === 'delivery' ? t('shopDeliverTo') : t('shopPickupAt')}
                  </dt>
                  <dd className="font-medium text-right max-w-xs">
                    {draft.channel === 'delivery'
                      ? `${draft.address}, ${draft.zipCode} ${draft.city}`
                      : `${merchant?.address || ''}${merchant?.city ? `, ${merchant.city}` : ''}`}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">{t('shopWhen')}</dt>
                  <dd className="font-medium">
                    {whenMode === 'later' && draft.scheduledFor
                      ? new Date(localDateTimeToIso(draft.scheduledFor) || draft.scheduledFor).toLocaleString(locale === 'de' ? 'de-CH' : locale === 'fr' ? 'fr-CH' : 'en-CH', {
                          timeZone: 'Europe/Zurich',
                        })
                      : t('shopAsap')}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">{t('shopPayment')}</dt>
                  <dd className="font-medium text-right">
                    {payWithPoints && pointsDiscount > 0 ? (
                      <>
                        {t('shopPayWithPoints')}
                        {' (−'}CHF {pointsDiscount.toFixed(2)})
                        {!pointsCoverFullOrder && (
                          <>
                            <br />
                            <span className="text-stone-500 text-xs">
                              {draft.paymentMethod === 'card'
                                ? t('shopCardAdyen')
                                : draft.channel === 'delivery'
                                  ? t('shopCashOnDelivery')
                                  : t('shopCashOnPickup')}
                              {' · '}CHF {total.toFixed(2)}
                            </span>
                          </>
                        )}
                      </>
                    ) : draft.paymentMethod === 'card' ? (
                      t('shopCardAdyen')
                    ) : draft.channel === 'delivery' ? (
                      t('shopCashOnDelivery')
                    ) : (
                      t('shopCashOnPickup')
                    )}
                  </dd>
                </div>
              </dl>

              <ul className="border-t border-stone-100 pt-3 space-y-3 text-sm">
                {draft.items.map((i) => {
                  const lineKey = i.lineId || i.id;
                  return (
                    <li key={lineKey} className="flex justify-between gap-3 items-start">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {i.name}
                          {i.loyaltyReward && (
                            <span className="ml-1 text-xs font-semibold text-teal-800">
                              {t('shopFree')}
                            </span>
                          )}
                        </p>
                        {!!i.comboSelections?.length && (
                          <p className="text-xs text-stone-500 mt-0.5">
                            {i.comboSelections
                              .map((c) => `${c.slotName}: ${c.productName}`)
                              .join(' · ')}
                          </p>
                        )}
                        {!!i.selectedExtras?.length && (
                          <p className="text-xs text-stone-500 mt-0.5">
                            {i.selectedExtras.map((e) => e.name).join(', ')}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            className="w-7 h-7 border border-stone-300 text-sm font-semibold"
                            onClick={() => setLineQty(lineKey, i.quantity - 1)}
                            aria-label="-"
                          >
                            −
                          </button>
                          <span className="w-6 text-center font-semibold">{i.quantity}</span>
                          <button
                            type="button"
                            className="w-7 h-7 border border-stone-300 text-sm font-semibold"
                            onClick={() => setLineQty(lineKey, i.quantity + 1)}
                            aria-label="+"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="ml-2 text-xs text-stone-500 underline"
                            onClick={() => removeLine(lineKey)}
                          >
                            {t('delete')}
                          </button>
                        </div>
                      </div>
                      <span className="shrink-0 font-medium">
                        CHF {(i.price * i.quantity).toFixed(2)}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                className="w-full bg-stone-900 text-white py-3.5 font-semibold disabled:opacity-40"
                disabled={
                  submitting || !!merchant?.vacation?.active || merchant?.acceptingOrders === false
                }
                onClick={placeOrder}
              >
                {merchant?.acceptingOrders === false
                  ? t('shopNotAcceptingOrders')
                  : merchant?.vacation?.active
                  ? t('shopVacationTitle')
                  : submitting
                  ? t('shopPlacingOrder')
                  : pointsCoverFullOrder
                    ? t('shopPlaceOrderPoints')
                    : draft.paymentMethod === 'card'
                      ? `${t('shopPayAmount')} CHF ${total.toFixed(2)}`
                      : `${t('shopPlaceOrder')} · CHF ${total.toFixed(2)}`}
              </button>
            </section>
          )}
        </div>

        <aside className="bg-white border border-stone-200 p-5 h-fit sticky top-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-lg">{t('shopYourOrder')}</h2>
            <Link
              to={`${shopBasePath(shopKey)}/menu`}
              className="text-xs font-semibold underline text-stone-600"
            >
              {t('shopAddMore')}
            </Link>
          </div>
          <ul className="text-sm space-y-3">
            {draft.items.map((i) => {
              const lineKey = i.lineId || i.id;
              return (
                <li key={lineKey} className="flex justify-between gap-2 items-start">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {i.name}
                      {i.loyaltyReward && (
                        <span className="ml-1 text-xs font-semibold text-teal-800">{t('shopFree')}</span>
                      )}
                    </p>
                    {!!i.comboSelections?.length && (
                      <p className="text-xs text-stone-500 mt-0.5">
                        {i.comboSelections.map((c) => `${c.slotName}: ${c.productName}`).join(' · ')}
                      </p>
                    )}
                    {!!i.selectedExtras?.length && (
                      <p className="text-xs text-stone-500 mt-0.5">
                        {i.selectedExtras.map((e) => e.name).join(', ')}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <button
                        type="button"
                        className="w-7 h-7 border border-stone-300 text-sm font-semibold"
                        onClick={() => setLineQty(lineKey, i.quantity - 1)}
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-semibold">{i.quantity}</span>
                      <button
                        type="button"
                        className="w-7 h-7 border border-stone-300 text-sm font-semibold"
                        onClick={() => setLineQty(lineKey, i.quantity + 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="ml-1 text-xs text-stone-500 underline"
                        onClick={() => removeLine(lineKey)}
                      >
                        {t('delete')}
                      </button>
                    </div>
                  </div>
                  <span className="shrink-0">CHF {(i.price * i.quantity).toFixed(2)}</span>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-stone-100 pt-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-500">{t('shopSubtotal')}</span>
              <span>CHF {subtotal.toFixed(2)}</span>
            </div>
            {pointsDiscount > 0 && (
              <div className="flex justify-between text-teal-800">
                <span>{t('shopPointsDiscount')}</span>
                <span>− CHF {pointsDiscount.toFixed(2)}</span>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">{t('shopDelivery')}</span>
                <span>CHF {deliveryFee.toFixed(2)}</span>
              </div>
            )}
            {tip > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">{t('shopTip')}</span>
                <span>CHF {tip.toFixed(2)}</span>
              </div>
            )}
            {cardFee > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">{t('shopCardFee')}</span>
                <span>CHF {cardFee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-500">{t('shopTax')} ({taxRate}%)</span>
              <span>CHF {tax.toFixed(2)}</span>
            </div>
            {rounding !== 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">{t('shopRounding')}</span>
                <span>
                  {rounding > 0 ? '+' : ''}CHF {rounding.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1">
              <span>{t('shopTotal')}</span>
              <span>CHF {total.toFixed(2)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
