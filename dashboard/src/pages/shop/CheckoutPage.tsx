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

type Step = 'details' | 'payment' | 'review';
type WhenMode = 'asap' | 'later';

type SavedAddress = {
  id: string;
  label: string;
  address: string;
  zipCode?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
};

const ADDRESS_LABELS = ['home', 'office', 'other'] as const;

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
  const [offerDiscount, setOfferDiscount] = useState(0);
  const [offerLabels, setOfferLabels] = useState<string[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState<(typeof ADDRESS_LABELS)[number]>('home');
  const [savingAddress, setSavingAddress] = useState(false);

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
            const addrs: SavedAddress[] = Array.isArray(me.data.customer.addresses)
              ? me.data.customer.addresses
              : [];
            setSavedAddresses(addrs);
            const preferred =
              addrs.find((a) => a.isDefault) ||
              addrs[0] ||
              null;
            setSelectedAddressId(preferred?.id || null);
            setLoyaltyBalance(Number(loyaltyRes.data.balance) || 0);
            setRedeemRate(Number(loyaltyRes.data.program?.redeemPointsPerChf) || 100);
            setDraft((d) => ({
              ...d,
              authMode: 'login',
              customerName: me.data.customer.name || d.customerName,
              customerEmail: me.data.customer.email || d.customerEmail,
              customerPhone: me.data.customer.phone || d.customerPhone,
              address: preferred?.address || me.data.customer.defaultAddress || d.address,
              zipCode: preferred?.zipCode || me.data.customer.defaultZip || d.zipCode,
              city: preferred?.city || me.data.customer.defaultCity || d.city,
              lat: preferred?.latitude ?? d.lat,
              lng: preferred?.longitude ?? d.lng,
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

  /** Preview promotional offers for the cart */
  useEffect(() => {
    if (!shopKey || !draft.items.length) {
      setOfferDiscount(0);
      setOfferLabels([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const hasBaked = draft.items.some((i) => !!i.offerId && !i.loyaltyReward);
        const res = await axios.post(`/api/shop/${shopKey}/offers/preview`, {
          channel: draft.channel,
          scheduledFor:
            whenMode === 'later' && draft.scheduledFor
              ? localDateTimeToIso(draft.scheduledFor)
              : null,
          items: draft.items.map((i) => ({
            productId: i.id,
            categoryId: i.categoryId || null,
            name: i.name,
            // Use catalog price when offer is already baked into `price`
            unitPrice: i.offerId && i.catalogPrice != null ? i.catalogPrice : i.price,
            quantity: i.quantity,
            loyaltyReward: !!i.loyaltyReward,
            offerId: i.offerId || null,
          })),
        });
        if (cancelled) return;
        // Cart lines already include deal prices — don't subtract the same offer again
        if (hasBaked) {
          setOfferDiscount(0);
          const badges = [
            ...new Set(
              draft.items.map((i) => i.offerBadge).filter((b): b is string => !!b)
            ),
          ];
          setOfferLabels(
            badges.length
              ? badges
              : (res.data.applied || []).map(
                  (a: { name: string; badgeLabel?: string }) => a.badgeLabel || a.name
                )
          );
        } else {
          setOfferDiscount(Number(res.data.discount) || 0);
          setOfferLabels(
            (res.data.applied || []).map(
              (a: { name: string; badgeLabel?: string }) => a.badgeLabel || a.name
            )
          );
        }
      } catch (err) {
        console.warn('[shop] offers preview failed', err);
        if (!cancelled) {
          setOfferDiscount(0);
          setOfferLabels([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, draft.items, draft.channel, draft.scheduledFor, whenMode]);

  /** Keep item prices in sync when switching takeaway ↔ delivery (menu markup). */
  useEffect(() => {
    if (!merchant) return;
    const markupRaw = Number(merchant.deliveryMenuMarkup ?? 0);
    const markup = Number.isFinite(markupRaw) && markupRaw > 0 ? markupRaw : 0;
    setDraft((prev) => {
      let changed = false;
      const addMarkup = prev.channel === 'delivery' ? markup : 0;
      const items = prev.items.map((item) => {
        if (item.loyaltyReward) return item;
        const extrasTotal = roundMoney2(
          (item.selectedExtras || []).reduce((s, e) => s + Number(e.price || 0), 0) +
            (item.comboSelections || []).reduce(
              (s, c) =>
                s +
                Number(c.extraPrice || 0) +
                (c.selectedExtras || []).reduce((x, e) => x + Number(e.price || 0), 0),
              0
            )
        );
        const base =
          typeof item.basePrice === 'number' && Number.isFinite(item.basePrice)
            ? item.basePrice
            : roundMoney2(Number(item.catalogPrice ?? item.price ?? 0) - extrasTotal);
        const catalogUnit = roundMoney2(base + addMarkup + extrasTotal);
        if (item.offerId) {
          if (item.price === 0) {
            if (item.catalogPrice !== catalogUnit) {
              changed = true;
              return { ...item, basePrice: base, catalogPrice: catalogUnit, price: 0 };
            }
            return item;
          }
          if (item.catalogPrice && item.catalogPrice > 0) {
            const ratio = item.price / item.catalogPrice;
            const nextPrice = roundMoney2(catalogUnit * Math.min(1, ratio));
            if (nextPrice !== item.price || item.catalogPrice !== catalogUnit || item.basePrice !== base) {
              changed = true;
              return { ...item, basePrice: base, catalogPrice: catalogUnit, price: nextPrice };
            }
            return item;
          }
        }
        const nextPrice = catalogUnit;
        if (!Number.isFinite(nextPrice)) return item;
        if (nextPrice !== item.price || item.basePrice !== base) {
          changed = true;
          return { ...item, basePrice: base, price: nextPrice };
        }
        return item;
      });
      if (!changed) return prev;
      return { ...prev, items };
    });
  }, [draft.channel, merchant]);

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

  // When closed (or ASAP unavailable), force "later" and auto-pick first slot — only if scheduled orders are allowed.
  useEffect(() => {
    if (!merchant) return;
    const allowScheduled = merchant.scheduledOrdersEnabled !== false;
    if (!allowScheduled) {
      if (whenMode !== 'asap') setWhenMode('asap');
      if (draft.scheduledFor) setDraft((d) => ({ ...d, scheduledFor: '' }));
      return;
    }
    if (!scheduleDays.length) return;
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
  const redeemableBase = roundMoney2(
    Math.max(0, subtotal - offerDiscount) + deliveryFee + tax
  );
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

  const addressLabelText = (label: string) => {
    if (label === 'home') return t('shopAddressHome');
    if (label === 'office') return t('shopAddressOffice');
    if (label === 'other') return t('shopAddressOther');
    return label;
  };

  const applySavedAddress = (a: SavedAddress) => {
    setSelectedAddressId(a.id);
    setDeliveryInfo(null);
    patch({
      address: a.address || '',
      zipCode: a.zipCode || '',
      city: a.city || '',
      lat: a.latitude ?? undefined,
      lng: a.longitude ?? undefined,
    });
  };

  const saveCurrentAddress = async () => {
    if (!customer || !draft.address.trim()) return;
    const token = loadCustomerToken(shopKey);
    if (!token) return;
    setSavingAddress(true);
    setError(null);
    try {
      let lat = draft.lat;
      let lng = draft.lng;
      if (lat == null || lng == null) {
        const geo = await axios.post(`/api/shop/${shopKey}/geocode`, {
          query: `${draft.address}, ${draft.zipCode} ${draft.city} Switzerland`,
        });
        if (geo.data.found) {
          lat = Number(geo.data.lat);
          lng = Number(geo.data.lng);
          patch({ lat, lng });
        }
      }
      const res = await axios.post(
        `/api/shop/${shopKey}/auth/addresses`,
        {
          label: saveLabel,
          address: draft.address.trim(),
          zipCode: draft.zipCode.trim() || null,
          city: draft.city.trim() || null,
          latitude: lat ?? null,
          longitude: lng ?? null,
          isDefault: savedAddresses.length === 0,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const saved = res.data.address as SavedAddress;
      setSavedAddresses((prev) => {
        const without = prev.filter((a) => a.id !== saved.id);
        return saved.isDefault
          ? [saved, ...without.map((a) => ({ ...a, isDefault: false }))]
          : [...without, saved];
      });
      setSelectedAddressId(saved.id);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not save address');
    } finally {
      setSavingAddress(false);
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
      const addrs: SavedAddress[] = Array.isArray(res.data.customer.addresses)
        ? res.data.customer.addresses
        : [];
      setSavedAddresses(addrs);
      const preferred = addrs.find((a) => a.isDefault) || addrs[0] || null;
      setSelectedAddressId(preferred?.id || null);
      await refreshLoyalty(res.data.token);
      setWantCreateAccount(false);
      setShowLogin(false);
      setPassword('');
      patch({
        authMode: 'login',
        customerName: res.data.customer.name || '',
        customerEmail: res.data.customer.email || loginEmail,
        customerPhone: res.data.customer.phone || '',
        address: preferred?.address || res.data.customer.defaultAddress || draft.address,
        zipCode: preferred?.zipCode || res.data.customer.defaultZip || draft.zipCode,
        city: preferred?.city || res.data.customer.defaultCity || draft.city,
        lat: preferred?.latitude ?? draft.lat,
        lng: preferred?.longitude ?? draft.lng,
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
      setError(
        merchant?.scheduledOrdersEnabled === false
          ? t('shopOrdersOnlyWhenOpen')
          : t('shopClosedChooseLater')
      );
      return;
    }
    if (whenMode === 'later' && merchant?.scheduledOrdersEnabled === false) {
      setError(t('shopOrdersOnlyWhenOpen'));
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

  const channelOptions = useMemo(() => {
    const channels = merchant?.channels || {};
    const all: { id: ShopChannel; label: string }[] = [
      { id: 'takeaway', label: t('shopPickup') },
      { id: 'delivery', label: t('shopDelivery') },
      { id: 'dine_in', label: t('shopDineIn') },
    ];
    return all.filter((c) => channels[c.id]?.enabled);
  }, [merchant, t]);

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

  const showChannelPicker =
    channelOptions.length > 1 &&
    (String(merchant?.channelSelectMode || 'checkout') === 'checkout' ||
      String(merchant?.channelSelectMode || '') === 'popup_start' ||
      String(merchant?.channelSelectMode || '') === 'menu');

  const patchChannel = (channel: ShopChannel) => {
    setDraft((d) => ({ ...d, channel }));
    setDeliveryInfo(null);
    setError(null);
    setWhenMode('asap');
    setScheduleDayOffset(0);
  };

  return (
    <div className="min-h-dvh bg-[#f6f5f2] text-stone-900">
      <ShopVacationPopup vacation={merchant?.vacation} shopKey={shopKey} />
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

      <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-4 min-w-0">
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

          <div className="lg:hidden bg-white border border-stone-200 px-4 py-3 text-sm flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{t('shopYourOrder')}</p>
              <p className="text-stone-500 text-xs">
                {draft.items.reduce((n, i) => n + (i.quantity || 1), 0)} · CHF {total.toFixed(2)}
              </p>
            </div>
            <Link to={`${shopBasePath(shopKey)}/menu`} className="text-xs font-semibold underline shrink-0">
              {t('shopAddMore')}
            </Link>
          </div>

          {step === 'details' && (
            <section className="bg-white border border-stone-200 p-5 space-y-4">
              {/* 1. Order type */}
              {showChannelPicker ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{t('shopFulfillment')}</p>
                  <div
                    className={`grid gap-2 ${
                      channelOptions.length >= 3
                        ? 'grid-cols-3'
                        : channelOptions.length === 2
                          ? 'grid-cols-2'
                          : 'grid-cols-1'
                    }`}
                  >
                    {channelOptions.map((c) => {
                      const meta = merchant?.channels?.[c.id];
                      const on = draft.channel === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => patchChannel(c.id)}
                          className={`rounded-xl border px-2 sm:px-3 py-2.5 sm:py-3 text-center sm:text-left transition min-w-0 ${
                            on
                              ? 'border-stone-900 bg-stone-900 text-white'
                              : 'border-stone-200 bg-stone-50 text-stone-800 hover:border-stone-400'
                          }`}
                        >
                          <span className="block text-xs sm:text-sm font-semibold truncate">{c.label}</span>
                          <span
                            className={`block text-[10px] sm:text-[11px] mt-0.5 truncate ${
                              on ? 'text-white/70' : 'text-stone-500'
                            }`}
                          >
                            {meta?.etaMinutes || 30}–{(meta?.etaMinutes || 30) + 10} {t('shopMins')}
                            {meta && !meta.open ? ` · ${t('shopClosed')}` : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
                  <p className="text-sm font-semibold">{channelLabel}</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {merchant?.channels?.[draft.channel]?.etaMinutes || 30}–
                    {(merchant?.channels?.[draft.channel]?.etaMinutes || 30) + 10} {t('shopMins')}
                    {merchant?.channels?.[draft.channel] && !merchant.channels[draft.channel].open
                      ? ` · ${t('shopClosed')}`
                      : ''}
                  </p>
                </div>
              )}

              {/* 2. When / schedule */}
              <div className="border-t border-stone-100 pt-4 space-y-3">
                <label className="block text-sm font-semibold">{t('shopWhen')}</label>
                {!channelOpen && (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2">
                    {t('shopStoreClosedNow')}
                  </p>
                )}
                {merchant?.scheduledOrdersEnabled === false ? (
                  channelOpen ? (
                    <p className="text-sm text-stone-600">{t('shopAsap')}</p>
                  ) : null
                ) : (
                  <>
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
                          <p className="text-sm text-red-600">{t('shopNoOpenHours')}</p>
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
                              <p className="text-xs text-stone-500 mb-2">{t('shopTimeSlotsHint')}</p>
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
                  </>
                )}
              </div>

              {/* 3. Customer / order details */}
              <div className="border-t border-stone-100 pt-4 space-y-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    {draft.channel === 'delivery' ? t('shopDeliveryDetails') : t('shopPickupDetails')}
                  </h1>
                  <p className="text-sm text-stone-500 mt-1">
                    {draft.channel === 'delivery'
                      ? t('shopWhereDeliver')
                      : `${t('shopCollectFrom')} ${merchant?.address || t('shopRestaurant')}${
                          merchant?.city ? `, ${merchant.city}` : ''
                        }`}
                  </p>
                </div>

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
                    {customer ? (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">{t('shopSavedAddresses')}</p>
                        <div className="flex flex-wrap gap-2">
                          {savedAddresses.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => applySavedAddress(a)}
                              className={`rounded-full border px-3 py-1.5 text-left text-xs sm:text-sm max-w-full ${
                                selectedAddressId === a.id
                                  ? 'border-stone-900 bg-stone-900 text-white'
                                  : 'border-stone-200 bg-white text-stone-800'
                              }`}
                            >
                              <span className="font-semibold">{addressLabelText(a.label)}</span>
                              <span className="opacity-80"> · {a.address}</span>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAddressId(null);
                              setDeliveryInfo(null);
                            }}
                            className={`rounded-full border px-3 py-1.5 text-xs sm:text-sm ${
                              selectedAddressId == null
                                ? 'border-stone-900 bg-stone-900 text-white'
                                : 'border-stone-200 bg-white text-stone-800'
                            }`}
                          >
                            {t('shopNewAddress')}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <input
                      className="w-full border border-stone-300 px-3 py-2 text-sm"
                      placeholder={t('shopStreetAddressRequired')}
                      value={draft.address}
                      onChange={(e) => {
                        setSelectedAddressId(null);
                        patch({ address: e.target.value, lat: undefined, lng: undefined });
                      }}
                    />
                    <ZipCityFields
                      shopKey={shopKey}
                      zipCode={draft.zipCode}
                      city={draft.city}
                      onZipChange={(zipCode) => {
                        setSelectedAddressId(null);
                        patch({ zipCode, lat: undefined, lng: undefined });
                      }}
                      onCityChange={(city) => {
                        setSelectedAddressId(null);
                        patch({ city, lat: undefined, lng: undefined });
                      }}
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
                        {deliveryInfo.zone.name}: {t('shopFee')} CHF{' '}
                        {Number(deliveryInfo.zone.deliveryFee).toFixed(2)}
                        {deliveryInfo.zone.minOrderAmount > 0
                          ? ` · ${t('shopMin')} CHF ${Number(deliveryInfo.zone.minOrderAmount).toFixed(2)}`
                          : ''}
                      </p>
                    )}

                    {customer && draft.address.trim() ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs text-stone-500">{t('shopSelectLabel')}</span>
                        {ADDRESS_LABELS.map((lab) => (
                          <button
                            key={lab}
                            type="button"
                            onClick={() => setSaveLabel(lab)}
                            className={`rounded-full border px-2.5 py-1 text-xs ${
                              saveLabel === lab
                                ? 'border-amber-700 bg-amber-700 text-white'
                                : 'border-stone-200 bg-white'
                            }`}
                          >
                            {addressLabelText(lab)}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="ml-auto border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                          disabled={savingAddress || !draft.address.trim()}
                          onClick={() => void saveCurrentAddress()}
                        >
                          {savingAddress ? t('shopSavingAddress') : t('shopSaveAddress')}
                        </button>
                      </div>
                    ) : null}
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

              {offerDiscount > 0 ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 px-3 py-2">
                  {(offerLabels.join(', ') || 'Offer') + `: − CHF ${offerDiscount.toFixed(2)}`}
                </p>
              ) : null}

              <button
                type="button"
                className="w-full bg-stone-900 text-white py-3 font-semibold disabled:opacity-40"
                disabled={!channelOpen && merchant?.scheduledOrdersEnabled === false}
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

        <aside className="hidden lg:block bg-white border border-stone-200 p-5 h-fit sticky top-4 space-y-3">
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
            {offerDiscount > 0 && (
              <div className="flex justify-between text-amber-800">
                <span>{offerLabels.join(', ') || 'Offer'}</span>
                <span>− CHF {offerDiscount.toFixed(2)}</span>
              </div>
            )}
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
