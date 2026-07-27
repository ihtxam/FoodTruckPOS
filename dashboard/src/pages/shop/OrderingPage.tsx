import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  emptyDraft,
  lineSignature,
  loadCart,
  loadCustomerToken,
  newCartLineId,
  resolveShopKey,
  saveCart,
  shopBasePath,
  type ShopCartItem,
  type ShopChannel,
  type ShopCheckoutDraft,
  type ShopComboSelection,
  type ShopSelectedExtra,
} from '@/lib/shop-cart';
import { roundMoney2, roundTo005, roundingAdjustment } from '@/lib/money';
import ShopProductModifiersModal, {
  productHasModifiers,
  type ShopModifierGroup,
  type ShopProductForModifiers,
} from '@/components/shop/ShopProductModifiersModal';
import ShopComboWizard, {
  productHasComboSlots,
  type ComboSlot,
  type ShopComboProduct,
} from '@/components/shop/ShopComboWizard';
import { isLocale, useI18n } from '@/lib/i18n';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  productType?: string;
  allowExtras?: boolean;
  extras?: Array<{ id: string; name: string; price: number }>;
  modifierGroups?: ShopModifierGroup[];
  comboSlots?: ComboSlot[];
  loyaltyRewardPoints?: number | null;
}

type LoyaltyReward = {
  id: string;
  name: string;
  image?: string | null;
  price: number;
  loyaltyRewardPoints: number;
  unlocked: boolean;
};

interface Category {
  id: string;
  name: string;
  items: Product[];
}

interface ChannelInfo {
  enabled: boolean;
  open: boolean;
  todayLabel: string;
  etaMinutes: number;
}

export default function OrderingPage() {
  const { t, setLocale, locale } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const navigate = useNavigate();

  const [merchant, setMerchant] = useState<any>(null);
  const [menu, setMenu] = useState<Category[]>([]);
  const [draft, setDraft] = useState<ShopCheckoutDraft>(emptyDraft());
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileBasket, setMobileBasket] = useState(false);
  const [checkingDelivery, setCheckingDelivery] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState<any>(null);
  const [pendingProduct, setPendingProduct] = useState<ShopProductForModifiers | null>(null);
  const [pendingCombo, setPendingCombo] = useState<ShopComboProduct | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [loyaltyBalance, setLoyaltyBalance] = useState(0);
  const [loyaltyRewards, setLoyaltyRewards] = useState<LoyaltyReward[]>([]);
  const [loyaltyProgress, setLoyaltyProgress] = useState(0);
  const [nextRewardPts, setNextRewardPts] = useState<number | null>(null);

  useEffect(() => {
    if (!shopKey) {
      setLoading(false);
      setError(t('shopNotFound'));
      return;
    }

    const stored = loadCart(shopKey);
    if (stored) setDraft(stored);

    const load = async () => {
      try {
        const token = loadCustomerToken(shopKey);
        const [shopRes, menuRes, loyaltyRes] = await Promise.all([
          axios.get(`/api/shop/${shopKey}`),
          axios.get(`/api/shop/${shopKey}/menu`),
          axios.get(`/api/shop/${shopKey}/loyalty`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined),
        ]);
        const data = shopRes.data.data;
        setMerchant(data);
        setMenu(menuRes.data.data || []);
        setSelectedCategory('all');

        const loyaltyData = loyaltyRes.data || {};
        setLoyaltyRewards(loyaltyData.rewards || []);
        if (token && loyaltyData.balance != null) {
          setLoyaltyBalance(Number(loyaltyData.balance) || 0);
          setLoyaltyProgress(Number(loyaltyData.progressPercent) || 0);
          setNextRewardPts(
            loyaltyData.nextReward?.loyaltyRewardPoints != null
              ? Number(loyaltyData.nextReward.loyaltyRewardPoints)
              : null
          );
        } else {
          setLoyaltyBalance(0);
          setLoyaltyProgress(0);
          setNextRewardPts(null);
        }

        if (token) {
          try {
            const me = await axios.get(`/api/shop/${shopKey}/auth/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            setCustomer(me.data.customer);
            if (me.data.customer?.loyaltyPoints != null) {
              setLoyaltyBalance(Number(me.data.customer.loyaltyPoints) || 0);
            }
          } catch {
            setCustomer(null);
          }
        } else {
          setCustomer(null);
        }

        if (isLocale(data.language)) {
          try {
            const stored = localStorage.getItem('manupos_shop_lang');
            if (!isLocale(stored)) setLocale(data.language);
          } catch {
            setLocale(data.language);
          }
        }
        const channels = data.channels || {};
        const preferred: ShopChannel[] = ['takeaway', 'delivery', 'dine_in'];
        const first = preferred.find((c) => channels[c]?.enabled);
        setDraft((d) => {
          const next = { ...d, channel: d.channel && channels[d.channel]?.enabled ? d.channel : first || 'takeaway' };
          saveCart(shopKey, next);
          return next;
        });
        setError(null);
      } catch (e: any) {
        setError(e.response?.data?.error || t('shopFailedLoad'));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [shopKey]);

  useEffect(() => {
    if (!shopKey || loading) return;
    saveCart(shopKey, draft);
  }, [draft, shopKey, loading]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const channels: Record<ShopChannel, ChannelInfo> = merchant?.channels || {
    takeaway: { enabled: true, open: true, todayLabel: '', etaMinutes: 25 },
    dine_in: { enabled: true, open: true, todayLabel: '', etaMinutes: 25 },
    delivery: { enabled: true, open: true, todayLabel: '', etaMinutes: 45 },
  };

  const channel = draft.channel;
  const cart = draft.items;
  const taxRate = useMemo(() => {
    if (!merchant) return 0;
    if (channel === 'dine_in') return Number(merchant.taxDineInRate ?? merchant.vatRate ?? 0);
    if (channel === 'delivery') return Number(merchant.taxDeliveryRate ?? merchant.vatRate ?? 0);
    return Number(merchant.taxTakeawayRate ?? merchant.vatRate ?? 0);
  }, [merchant, channel]);

  const cartTotal = roundMoney2(cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const deliveryFee = roundMoney2(
    channel === 'delivery' ? Number(deliveryInfo?.zone?.deliveryFee || 0) : 0
  );
  const tax = roundMoney2(((cartTotal + deliveryFee) * taxRate) / 100);
  const rawTotal = cartTotal + deliveryFee + tax;
  const rounding = roundingAdjustment(rawTotal);
  const total = roundTo005(rawTotal);
  const channelMeta = channels[channel];
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  const mapsUrl =
    merchant?.latitude && merchant?.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${merchant.latitude},${merchant.longitude}`
      : merchant?.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${merchant.address} ${merchant.city || ''}`
          )}`
        : null;

  const patch = (p: Partial<ShopCheckoutDraft>) => setDraft((d) => ({ ...d, ...p }));

  const addConfiguredItem = (
    product: Product | ShopProductForModifiers | ShopComboProduct,
    extras: ShopSelectedExtra[] = [],
    unitPrice?: number,
    comboSelections: ShopComboSelection[] = [],
    asReward = false
  ) => {
    const rewardCost =
      'loyaltyRewardPoints' in product && product.loyaltyRewardPoints != null
        ? Number(product.loyaltyRewardPoints)
        : 0;
    if (asReward) {
      setDraft((prev) => {
        const existing = prev.items.find((item) => item.id === product.id && item.loyaltyReward);
        const items: ShopCartItem[] = existing
          ? prev.items.map((item) =>
              item.lineId === existing.lineId ? { ...item, quantity: item.quantity + 1 } : item
            )
          : [
              ...prev.items,
              {
                lineId: newCartLineId(),
                id: product.id,
                name: product.name,
                price: 0,
                basePrice: 0,
                quantity: 1,
                description: product.description,
                image: product.image,
                loyaltyReward: true,
                rewardPointsCost: rewardCost,
              },
            ];
        return { ...prev, items };
      });
      return;
    }

    const price = roundMoney2(
      unitPrice ??
        product.price +
          extras.reduce((s, e) => s + e.price, 0) +
          comboSelections.reduce(
            (s, c) => s + c.extraPrice + c.selectedExtras.reduce((x, e) => x + e.price, 0),
            0
          )
    );
    const sig = lineSignature(extras, comboSelections);
    setDraft((prev) => {
      const existing = prev.items.find(
        (item) =>
          item.id === product.id &&
          !item.loyaltyReward &&
          lineSignature(item.selectedExtras, item.comboSelections) === sig
      );
      const items: ShopCartItem[] = existing
        ? prev.items.map((item) =>
            item.lineId === existing.lineId ? { ...item, quantity: item.quantity + 1 } : item
          )
        : [
            ...prev.items,
            {
              lineId: newCartLineId(),
              id: product.id,
              name: product.name,
              price,
              basePrice: product.price,
              quantity: 1,
              description: product.description,
              image: product.image,
              selectedExtras: extras,
              comboSelections,
            },
          ];
      return { ...prev, items };
    });
  };

  const handleProductClick = (product: Product) => {
    if (productHasComboSlots(product)) {
      setPendingCombo(product as ShopComboProduct);
      return;
    }
    if (productHasModifiers(product)) {
      setPendingProduct(product);
      return;
    }
    addConfiguredItem(product);
  };

  const updateQuantity = (lineId: string, quantity: number) => {
    setDraft((prev) => ({
      ...prev,
      items:
        quantity <= 0
          ? prev.items.filter((item) => item.lineId !== lineId)
          : prev.items.map((item) => (item.lineId === lineId ? { ...item, quantity } : item)),
    }));
  };

  const checkDeliveryPreview = async () => {
    if (!draft.address.trim()) {
      setError(t('shopEnterDeliveryAddress'));
      return;
    }
    setCheckingDelivery(true);
    setError(null);
    try {
      const query = `${draft.address}, ${draft.zipCode} ${draft.city || merchant?.city || ''} Switzerland`;
      const geoRes = await axios.post(`/api/shop/${shopKey}/geocode`, { query });
      const lat = geoRes.data.found ? Number(geoRes.data.lat) : undefined;
      const lng = geoRes.data.found ? Number(geoRes.data.lng) : undefined;
      if (lat != null && lng != null) patch({ lat, lng });
      const res = await axios.post(`/api/shop/${shopKey}/check-delivery`, {
        lat,
        lng,
        zipCode: draft.zipCode,
        subtotal: cartTotal,
      });
      setDeliveryInfo(res.data);
      if (!res.data.deliverable) setError(res.data.error || t('shopOutsideDelivery'));
      else if (!res.data.meetsMinOrder) setError(res.data.message);
    } catch (e: any) {
      setError(e.response?.data?.error || t('shopCouldNotVerifyAddress'));
      setDeliveryInfo(null);
    } finally {
      setCheckingDelivery(false);
    }
  };

  const goCheckout = () => {
    if (!cart.length) return;
    if (channel === 'delivery' && deliveryInfo && !deliveryInfo.deliverable) {
      setError(t('shopOutsideDeliverySwitch'));
      return;
    }
    if (channel === 'delivery' && deliveryInfo && !deliveryInfo.meetsMinOrder) {
      setError(deliveryInfo.message || t('shopMinOrderNotMet'));
      return;
    }
    // Closed now is OK — checkout will offer schedule for later (ASAP hidden when closed).
    const next = {
      ...draft,
      // Clear ASAP when closed so checkout forces a later slot
      scheduledFor: channelMeta?.open ? draft.scheduledFor : draft.scheduledFor || '',
    };
    if (!channelMeta?.open) {
      // Leave scheduledFor empty; checkout auto-picks first later slot
      next.scheduledFor = '';
    }
    saveCart(shopKey, next);
    navigate(`${shopBasePath(shopKey)}/checkout`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-600">
        {t('shopLoading')}
      </div>
    );
  }

  if (error && !merchant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-red-700 font-medium px-4 text-center">
        {error}
      </div>
    );
  }

  const visibleItems =
    selectedCategory === 'all'
      ? menu.flatMap((c) => c.items || [])
      : menu.find((c) => c.id === selectedCategory)?.items || [];
  const allChannels: { id: ShopChannel; label: string }[] = [
    { id: 'takeaway', label: t('shopPickup') },
    { id: 'delivery', label: t('shopDelivery') },
    { id: 'dine_in', label: t('shopDineIn') },
  ];
  const channelButtons = allChannels.filter((c) => channels[c.id]?.enabled);
  const loyaltyEnabled = !!merchant?.loyalty?.enabled;
  const unlockedRewards = loyaltyRewards.filter((r) => r.unlocked);
  const accountPath = `${shopBasePath(shopKey)}/account`;
  const reservationsPath = `${shopBasePath(shopKey)}/reservations`;
  const showReservations = !!merchant?.reservationsEnabled;

  const Basket = (
    <aside className="bg-white border border-stone-200 flex flex-col h-full">
      <div className="px-5 py-4 border-b border-stone-200">
        <h2 className="text-xl font-bold tracking-tight">{t('shopBasket')}</h2>
        <p className="text-sm text-stone-500 mt-1">
          {channelButtons.find((c) => c.id === channel)?.label} · {channelMeta?.etaMinutes || 30}–
          {(channelMeta?.etaMinutes || 30) + 10} min
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {cart.length === 0 ? (
          <p className="text-stone-500 text-sm py-8 text-center">{t('shopNoItems')}</p>
        ) : (
          <ul className="space-y-3">
            {cart.map((item) => (
              <li key={item.lineId} className="flex gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-stone-900">
                    {item.name}
                    {item.loyaltyReward && (
                      <span className="ml-2 text-xs font-semibold text-teal-800">{t('shopFree')}</span>
                    )}
                  </div>
                  {!!item.comboSelections?.length && (
                    <p className="text-xs text-stone-500 mt-0.5 leading-snug">
                      {item.comboSelections
                        .map((c) =>
                          c.selectedExtras?.length
                            ? `${c.productName} (${c.selectedExtras.map((e) => e.name).join(', ')})`
                            : c.productName
                        )
                        .join(' · ')}
                    </p>
                  )}
                  {!!item.selectedExtras?.length && (
                    <p className="text-xs text-stone-500 mt-0.5 leading-snug">
                      {item.selectedExtras.map((e) => e.name).join(', ')}
                    </p>
                  )}
                  <div className="text-stone-500">
                    {item.loyaltyReward
                      ? t('shopPtsBadge').replace('{n}', String(item.rewardPointsCost || 0))
                      : `CHF ${item.price.toFixed(2)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    className="w-7 h-7 border border-stone-300"
                    onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    className="w-7 h-7 border border-stone-300"
                    onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-stone-200 px-5 py-4 space-y-3">
        {channel === 'delivery' && (
          <div className="space-y-2 pb-2 border-b border-stone-100">
            <p className="text-xs text-stone-500">{t('shopCheckDeliverHint')}</p>
            <input
              className="w-full border border-stone-300 px-3 py-2 text-sm"
              placeholder={t('shopStreetAddress')}
              value={draft.address}
              onChange={(e) => patch({ address: e.target.value })}
            />
            <div className="flex gap-2">
              <input
                className="w-28 border border-stone-300 px-3 py-2 text-sm"
                placeholder={t('shopZip')}
                value={draft.zipCode}
                onChange={(e) => patch({ zipCode: e.target.value })}
              />
              <input
                className="flex-1 border border-stone-300 px-3 py-2 text-sm"
                placeholder={t('shopCity')}
                value={draft.city}
                onChange={(e) => patch({ city: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={() => void checkDeliveryPreview()}
              className="w-full border border-stone-900 text-sm font-semibold py-2"
              disabled={checkingDelivery}
            >
              {checkingDelivery ? t('shopChecking') : t('shopCheckDeliveryZone')}
            </button>
            {deliveryInfo?.deliverable && (
              <p className="text-xs text-teal-800">
                {deliveryInfo.zone.name}: {t('shopFee')} CHF {Number(deliveryInfo.zone.deliveryFee).toFixed(2)}
                {deliveryInfo.zone.minOrderAmount > 0
                  ? ` · ${t('shopMin')} CHF ${Number(deliveryInfo.zone.minOrderAmount).toFixed(2)}`
                  : ''}
              </p>
            )}
          </div>
        )}

        <div className="text-sm space-y-1 pt-1">
          <div className="flex justify-between">
            <span className="text-stone-500">{t('shopSubtotal')}</span>
            <span>CHF {cartTotal.toFixed(2)}</span>
          </div>
          {deliveryFee > 0 && (
            <div className="flex justify-between">
              <span className="text-stone-500">{t('shopDelivery')}</span>
              <span>CHF {deliveryFee.toFixed(2)}</span>
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
            <span>{t('shopEstTotal')}</span>
            <span>CHF {total.toFixed(2)}</span>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!channelMeta?.open && (
          <p className="text-amber-700 text-sm">
            {t('shopClosedNow')} · {channelMeta?.todayLabel || '—'} — {t('shopContinueScheduleLater')}
          </p>
        )}

        <button
          type="button"
          disabled={!cart.length}
          onClick={goCheckout}
          className="w-full bg-stone-900 text-white py-3 font-semibold disabled:opacity-40"
        >
          {channelMeta?.open ? t('shopGoCheckout') : t('shopScheduleCheckout')}
        </button>
        <p className="text-[11px] text-stone-400 text-center">
          {t('shopCheckoutHint')}
        </p>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#f6f5f2] text-stone-900">
      <header className="sticky top-0 z-30 bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {merchant?.shopLogoUrl ? (
              <img src={merchant.shopLogoUrl} alt="" className="h-10 w-auto object-contain" />
            ) : (
              <div className="h-10 w-10 bg-stone-900 text-white flex items-center justify-center font-bold text-sm">
                {(merchant?.name || 'M').slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="font-bold tracking-tight truncate">{merchant?.name}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <ShopLangSwitcher />
            <nav className="hidden sm:flex items-center gap-4 text-sm font-medium">
              <span className="text-stone-900 border-b-2 border-stone-900 pb-0.5">{t('shopOrder')}</span>
              {showReservations && (
                <Link to={reservationsPath} className="text-stone-600 hover:text-stone-900">
                  {t('shopReservations')}
                </Link>
              )}
              <Link
                to={accountPath}
                className="text-stone-600 hover:text-stone-900 p-1"
                aria-label={t('shopAccount')}
                title={t('shopAccount')}
              >
                <AccountIcon />
              </Link>
            </nav>
            <div className="sm:hidden flex items-center gap-2">
              {showReservations && (
                <Link
                  to={reservationsPath}
                  className="text-sm font-semibold text-stone-800 underline underline-offset-2"
                >
                  {t('shopReservations')}
                </Link>
              )}
              <Link
                to={accountPath}
                className="p-1.5 text-stone-800"
                aria-label={t('shopAccount')}
                title={t('shopAccount')}
              >
                <AccountIcon />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="bg-white border-b border-stone-200">
        {merchant?.shopBannerUrl && (
          <div
            className="h-36 md:h-48 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${merchant.shopBannerUrl})` }}
          />
        )}
        <div className="max-w-7xl mx-auto px-4 py-5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase">{merchant?.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-600">
            <span>
              {merchant?.address}
              {merchant?.city ? `, ${merchant.city}` : ''}
              {mapsUrl && (
                <>
                  {' · '}
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="underline text-stone-900">
                    {t('shopOpenMaps')}
                  </a>
                </>
              )}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">
              {(merchant?.displayHours?.todayLabel || channelMeta?.todayLabel) || t('shopHoursNotSet')}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-semibold ${
                channelMeta?.open ? 'bg-teal-100 text-teal-900' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {channelMeta?.open ? t('shopOpenNow') : t('shopClosed')}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {channelButtons.map((c) => {
              const meta = channels[c.id];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    patch({ channel: c.id });
                    setError(null);
                    setDeliveryInfo(null);
                  }}
                  className={`px-4 py-2 text-sm font-semibold border ${
                    channel === c.id
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white text-stone-800 border-stone-300'
                  }`}
                >
                  {c.label}
                  <span className="ml-2 font-normal opacity-80">
                    {meta.etaMinutes}–{meta.etaMinutes + 10} min
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div
        className={`max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start${
          itemCount > 0 ? ' pb-28 lg:pb-6' : ''
        }`}
      >
        <div>
          {loyaltyEnabled && unlockedRewards.length > 0 && (
            <div className="mb-5 space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
                {t('shopFreeRewards')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {unlockedRewards.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white border border-teal-200 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{r.name}</p>
                      <p className="text-xs text-teal-800">
                        {t('shopPtsBadge').replace('{n}', String(r.loyaltyRewardPoints))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        addConfiguredItem(
                          {
                            id: r.id,
                            name: r.name,
                            price: r.price,
                            image: r.image || undefined,
                            loyaltyRewardPoints: r.loyaltyRewardPoints,
                          },
                          [],
                          0,
                          [],
                          true
                        )
                      }
                      className="shrink-0 text-xs font-semibold bg-teal-800 text-white px-3 py-2"
                    >
                      {t('shopAddFree')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="sticky top-16 z-20 -mx-4 px-4 py-3 bg-[#f6f5f2]/80 backdrop-blur border-b border-stone-200/80 mb-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`whitespace-nowrap px-3 py-1.5 text-sm font-medium border ${
                  selectedCategory === 'all'
                    ? 'bg-white border-stone-900 text-stone-900'
                    : 'bg-transparent border-transparent text-stone-600'
                }`}
              >
                {t('shopAllCategories')}
              </button>
              {menu.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`whitespace-nowrap px-3 py-1.5 text-sm font-medium border ${
                    selectedCategory === cat.id
                      ? 'bg-white border-stone-900 text-stone-900'
                      : 'bg-transparent border-transparent text-stone-600'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {visibleItems.map((product) => {
              const rewardPts =
                product.loyaltyRewardPoints != null && Number(product.loyaltyRewardPoints) >= 1
                  ? Number(product.loyaltyRewardPoints)
                  : null;
              const unlocked = rewardPts != null && customer && loyaltyBalance >= rewardPts;
              return (
                <div
                  key={product.id}
                  className="bg-white border border-stone-200 p-4 flex gap-4 hover:border-stone-400 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleProductClick(product)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="font-semibold text-stone-900 flex flex-wrap items-center gap-2">
                      <span>{product.name}</span>
                      {rewardPts != null && (
                        <span className="text-[11px] font-semibold bg-amber-100 text-amber-900 px-1.5 py-0.5">
                          {t('shopPtsBadge').replace('{n}', String(rewardPts))}
                        </span>
                      )}
                    </div>
                    {product.description && (
                      <p className="text-sm text-stone-500 mt-1 line-clamp-2">{product.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">CHF {product.price.toFixed(2)}</span>
                      {productHasComboSlots(product) ? (
                        <span className="text-xs font-medium text-teal-800">Build combo</span>
                      ) : productHasModifiers(product) ? (
                        <span className="text-xs font-medium text-stone-500">Customize</span>
                      ) : null}
                    </div>
                  </button>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt=""
                        className="w-24 h-24 object-cover bg-stone-100"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-stone-100 flex items-center justify-center text-2xl text-stone-300">
                        +
                      </div>
                    )}
                    {unlocked && (
                      <button
                        type="button"
                        onClick={() => addConfiguredItem(product, [], 0, [], true)}
                        className="text-xs font-semibold bg-teal-800 text-white px-2 py-1"
                      >
                        {t('shopFree')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {visibleItems.length === 0 && (
              <p className="text-stone-500 py-12 text-center">{t('shopNoProducts')}</p>
            )}
          </div>
        </div>

        <div className="hidden lg:block sticky top-20 h-[calc(100vh-6rem)]">{Basket}</div>
      </div>

      {itemCount > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur safe-bottom">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <button
              type="button"
              className="w-full bg-stone-900 text-white px-4 py-3.5 text-sm font-semibold flex items-center justify-between gap-3"
              onClick={() => setMobileBasket(true)}
            >
              <span className="flex items-center gap-2 min-w-0">
                <CartIcon />
                <span className="truncate">
                  {t('shopBasketCount')} · {itemCount}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">CHF {cartTotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

      {mobileBasket && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMobileBasket(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-full flex flex-col">
              <div className="flex justify-end p-3">
                <button type="button" className="text-sm font-semibold" onClick={() => setMobileBasket(false)}>
                  {t('shopClose')}
                </button>
              </div>
              <div className="flex-1 min-h-0">{Basket}</div>
            </div>
          </div>
        </div>
      )}

      {pendingProduct && (
        <ShopProductModifiersModal
          product={pendingProduct}
          onClose={() => setPendingProduct(null)}
          onConfirm={(extras, unitPrice) => {
            addConfiguredItem(pendingProduct, extras, unitPrice);
            setPendingProduct(null);
          }}
        />
      )}

      {pendingCombo && (
        <ShopComboWizard
          product={pendingCombo}
          onClose={() => setPendingCombo(null)}
          onConfirm={({ comboSelections, selectedExtras, unitPrice }) => {
            addConfiguredItem(pendingCombo, selectedExtras, unitPrice, comboSelections);
            setPendingCombo(null);
          }}
        />
      )}
    </div>
  );
}

function AccountIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="block">
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 19.25c1.6-3.1 3.9-4.5 6.5-4.5s4.9 1.4 6.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="block shrink-0">
      <path
        d="M3.5 5.5h1.6l1.4 10.2a1.5 1.5 0 0 0 1.5 1.3h8.7a1.5 1.5 0 0 0 1.5-1.2l1.1-6.3H7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="19.5" r="1.1" fill="currentColor" />
      <circle cx="16.5" cy="19.5" r="1.1" fill="currentColor" />
    </svg>
  );
}
