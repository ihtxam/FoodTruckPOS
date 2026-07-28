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
import { CalendarDays, ChevronDown, LayoutGrid, Plus, Rows3, ShoppingBag, User } from 'lucide-react';
import { isLocale, useI18n } from '@/lib/i18n';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import ZipCityFields from '@/components/shop/ZipCityFields';
import ShopVacationPopup from '@/components/shop/ShopVacationPopup';
import ShopNotAcceptingBanner from '@/components/shop/ShopNotAcceptingBanner';
import ShopChannelPrompt from '@/components/shop/ShopChannelPrompt';

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
  const [gridCols, setGridCols] = useState<1 | 2>(() => {
    try {
      return localStorage.getItem('manupos_shop_grid') === '1' ? 1 : 2;
    } catch {
      return 2;
    }
  });
  const [channelPromptOpen, setChannelPromptOpen] = useState(false);

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
        const mode = String(data.channelSelectMode || 'checkout');
        setDraft((d) => {
          const next = {
            ...d,
            channel: d.channel && channels[d.channel]?.enabled ? d.channel : first || 'takeaway',
          };
          saveCart(shopKey, next);
          return next;
        });
        setError(null);
        // Popup at start when merchant asks for it and multiple channels exist
        const enabledCount = preferred.filter((c) => channels[c]?.enabled).length;
        if (mode === 'popup_start' && enabledCount > 1) {
          try {
            const key = `manupos_channel_prompted_${shopKey}`;
            if (!sessionStorage.getItem(key)) setChannelPromptOpen(true);
          } catch {
            setChannelPromptOpen(true);
          }
        }
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
  const deliveryMenuMarkup = useMemo(() => {
    const n = Number(merchant?.deliveryMenuMarkup ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [merchant]);
  const catalogUnitPrice = (productPrice: number) =>
    roundMoney2(productPrice + (channel === 'delivery' ? deliveryMenuMarkup : 0));
  const taxRate = useMemo(() => {
    if (!merchant) return 0;
    if (channel === 'dine_in') return Number(merchant.taxDineInRate ?? merchant.vatRate ?? 0);
    if (channel === 'delivery') return Number(merchant.taxDeliveryRate ?? merchant.vatRate ?? 0);
    return Number(merchant.taxTakeawayRate ?? merchant.vatRate ?? 0);
  }, [merchant, channel]);

  /** Keep cart line prices in sync when switching takeaway ↔ delivery (markup). */
  useEffect(() => {
    if (!merchant) return;
    setDraft((prev) => {
      let changed = false;
      const markup = prev.channel === 'delivery' ? deliveryMenuMarkup : 0;
      const items = prev.items.map((item) => {
        if (item.loyaltyReward) return item;
        const extrasTotal = roundMoney2(
          (item.selectedExtras || []).reduce((s, e) => s + e.price, 0) +
            (item.comboSelections || []).reduce(
              (s, c) => s + c.extraPrice + c.selectedExtras.reduce((x, e) => x + e.price, 0),
              0
            )
        );
        const nextPrice = roundMoney2(item.basePrice + markup + extrasTotal);
        if (nextPrice !== item.price) {
          changed = true;
          return { ...item, price: nextPrice };
        }
        return item;
      });
      if (!changed) return prev;
      return { ...prev, items };
    });
  }, [channel, deliveryMenuMarkup, merchant]);

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

    const extrasTotal = extras.reduce((s, e) => s + e.price, 0);
    const comboTotal = comboSelections.reduce(
      (s, c) => s + c.extraPrice + c.selectedExtras.reduce((x, e) => x + e.price, 0),
      0
    );
    // Always recompute from catalog base so delivery markup is applied (modal unitPrice is takeaway-based).
    const price = roundMoney2(catalogUnitPrice(product.price) + extrasTotal + comboTotal);
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
    if (merchant?.acceptingOrders === false) {
      setError(t('shopNotAcceptingOrders'));
      return;
    }
    if (merchant?.vacation?.active) {
      setError(t('shopVacationOrdersBlocked'));
      return;
    }
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
  const channelSelectMode = String(merchant?.channelSelectMode || 'checkout') as
    | 'checkout'
    | 'popup_start'
    | 'menu';
  const showMenuChannelButtons = channelSelectMode === 'menu' && channelButtons.length > 1;
  const channelLabel =
    channelButtons.find((c) => c.id === channel)?.label || t('shopPickup');
  const etaMin = channelMeta?.etaMinutes || 30;

  const setGrid = (cols: 1 | 2) => {
    setGridCols(cols);
    try {
      localStorage.setItem('manupos_shop_grid', String(cols));
    } catch {
      /* ignore */
    }
  };

  const openChannelPrompt = () => {
    if (channelButtons.length <= 1) return;
    setChannelPromptOpen(true);
  };

  const confirmChannelPrompt = () => {
    try {
      sessionStorage.setItem(`manupos_channel_prompted_${shopKey}`, '1');
    } catch {
      /* ignore */
    }
    setChannelPromptOpen(false);
    setError(null);
  };
  const loyaltyEnabled = !!merchant?.loyalty?.enabled;
  const unlockedRewards = loyaltyRewards.filter((r) => r.unlocked);
  const accountPath = `${shopBasePath(shopKey)}/account`;
  const reservationsPath = `${shopBasePath(shopKey)}/reservations`;
  const vacationActive = !!merchant?.vacation?.active;
  const ordersPaused = merchant?.acceptingOrders === false;
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
            <ZipCityFields
              shopKey={shopKey}
              zipCode={draft.zipCode}
              city={draft.city}
              onZipChange={(zipCode) => patch({ zipCode })}
              onCityChange={(city) => patch({ city })}
              zipClassName="w-full border border-stone-300 px-3 py-2 text-sm"
              cityClassName="w-full border border-stone-300 px-3 py-2 text-sm"
            />
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
          disabled={!cart.length || vacationActive || ordersPaused}
          onClick={goCheckout}
          className="w-full bg-stone-900 text-white py-3 font-semibold disabled:opacity-40"
        >
          {ordersPaused
            ? t('shopNotAcceptingOrders')
            : vacationActive
            ? t('shopVacationTitle')
            : channelMeta?.open
              ? t('shopGoCheckout')
              : t('shopScheduleCheckout')}
        </button>
        <p className="text-[11px] text-stone-400 text-center">
          {vacationActive ? t('shopVacationOrdersBlocked') : t('shopCheckoutHint')}
        </p>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#f6f5f2] text-stone-900">
      <ShopVacationPopup vacation={merchant?.vacation} shopKey={shopKey} />
      <header className="sticky top-0 z-30 bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <Link
            to={shopBasePath(shopKey) || '/'}
            className="flex items-center gap-2.5 min-w-0 shrink"
            aria-label={merchant?.name || t('shopBackToMenu')}
          >
            {merchant?.shopLogoUrl ? (
              <img src={merchant.shopLogoUrl} alt="" className="h-9 w-auto max-w-[7rem] object-contain" />
            ) : (
              <div className="h-9 w-9 bg-stone-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {(merchant?.name || 'M').slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="hidden sm:inline font-bold tracking-tight truncate">{merchant?.name}</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <ShopLangSwitcher />
            {showReservations && (
              <Link
                to={reservationsPath}
                className="inline-flex h-9 w-9 items-center justify-center text-stone-700 hover:bg-stone-100"
                aria-label={t('shopReservations')}
                title={t('shopReservations')}
              >
                <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
              </Link>
            )}
            <Link
              to={accountPath}
              className="inline-flex h-9 w-9 items-center justify-center text-stone-700 hover:bg-stone-100"
              aria-label={t('shopAccount')}
              title={t('shopAccount')}
            >
              <User className="h-5 w-5" strokeWidth={1.75} />
            </Link>
            <button
              type="button"
              className="relative inline-flex h-9 w-9 items-center justify-center text-stone-700 hover:bg-stone-100 lg:hidden"
              onClick={() => setMobileBasket(true)}
              aria-label={`${t('shopBasketCount')} (${itemCount})`}
              title={`${t('shopBasketCount')} (${itemCount})`}
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
              {itemCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center bg-stone-900 px-1 text-[10px] font-bold text-white">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </header>

      {ordersPaused ? (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <ShopNotAcceptingBanner kind="orders" phone={merchant?.phone} />
        </div>
      ) : null}

      <section className="bg-white border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-4 pt-3 pb-2">
          <button
            type="button"
            onClick={openChannelPrompt}
            className="mx-auto flex w-full max-w-lg items-center justify-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] sm:text-[13px] text-stone-700 hover:border-stone-300"
          >
            <span className="font-semibold text-stone-900">{channelLabel}</span>
            <span className="text-stone-300">|</span>
            <span className="truncate font-medium">{merchant?.name}</span>
            <span className="text-stone-300">|</span>
            <span className="tabular-nums whitespace-nowrap">
              {etaMin}–{etaMin + 10} {t('shopMins')}
            </span>
            {channelButtons.length > 1 ? <ChevronDown className="h-3.5 w-3.5 text-stone-400 shrink-0" /> : null}
          </button>
        </div>

        {merchant?.shopBannerUrl && (
          <div
            className="h-40 md:h-52 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${merchant.shopBannerUrl})` }}
          />
        )}

        <div className="max-w-7xl mx-auto px-4 py-4 space-y-2">
          {!merchant?.shopBannerUrl ? (
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">{merchant?.name}</h1>
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-2 text-[13px] text-stone-600">
            <div className="min-w-0 space-y-1">
              {(merchant?.address || merchant?.city) && (
                <p>
                  <span className="text-stone-800 font-medium">{merchant?.name}</span>
                  {merchant?.address ? ` · ${merchant.address}` : ''}
                  {merchant?.city ? `, ${merchant.city}` : ''}
                  {mapsUrl ? (
                    <>
                      {' · '}
                      <a href={mapsUrl} target="_blank" rel="noreferrer" className="font-medium text-rose-600 hover:underline">
                        {t('shopGetMap')}
                      </a>
                    </>
                  ) : null}
                </p>
              )}
              <p className="flex flex-wrap items-center gap-2">
                <span>
                  {(merchant?.displayHours?.todayLabel || channelMeta?.todayLabel) || t('shopHoursNotSet')}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    channelMeta?.open ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {channelMeta?.open ? t('shopOpenNow') : t('shopClosed')}
                </span>
                <span className="text-stone-400">·</span>
                <span>
                  {channelLabel} {etaMin}–{etaMin + 10} {t('shopMins')}
                </span>
              </p>
            </div>
          </div>

          {showMenuChannelButtons ? (
            <div className="flex flex-wrap gap-2 pt-1">
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
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold border ${
                      channel === c.id
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white text-stone-700 border-stone-200'
                    }`}
                  >
                    {c.label}
                    <span className="ml-1.5 font-normal opacity-70">{meta.etaMinutes} {t('shopMins')}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {channelSelectMode === 'checkout' && channelButtons.length > 1 ? (
            <p className="text-[12px] text-stone-500">{t('shopChannelAtCheckoutHint')}</p>
          ) : null}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
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

          <div className="sticky top-16 z-20 -mx-4 px-4 py-2.5 bg-[#f6f5f2]/90 backdrop-blur border-b border-stone-200/70 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                    selectedCategory === 'all'
                      ? 'bg-stone-900 text-white'
                      : 'bg-transparent text-stone-600 hover:bg-white'
                  }`}
                >
                  {t('shopAllCategories')}
                </button>
                {menu.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                      selectedCategory === cat.id
                        ? 'bg-stone-900 text-white'
                        : 'bg-transparent text-stone-600 hover:bg-white'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="flex shrink-0 items-center rounded-full border border-stone-200 bg-white p-0.5">
                <button
                  type="button"
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                    gridCols === 1 ? 'bg-stone-900 text-white' : 'text-stone-500'
                  }`}
                  aria-label={t('shopOneColumn')}
                  title={t('shopOneColumn')}
                  onClick={() => setGrid(1)}
                >
                  <Rows3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                    gridCols === 2 ? 'bg-stone-900 text-white' : 'text-stone-500'
                  }`}
                  aria-label={t('shopTwoColumn')}
                  title={t('shopTwoColumn')}
                  onClick={() => setGrid(2)}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div
            className={
              gridCols === 2
                ? 'grid grid-cols-2 gap-3 sm:gap-4'
                : 'grid grid-cols-1 gap-3 max-w-xl'
            }
          >
            {visibleItems.map((product) => {
              const rewardPts =
                product.loyaltyRewardPoints != null && Number(product.loyaltyRewardPoints) >= 1
                  ? Number(product.loyaltyRewardPoints)
                  : null;
              const unlocked = rewardPts != null && customer && loyaltyBalance >= rewardPts;
              return (
                <article key={product.id} className="group flex flex-col">
                  <div className="relative aspect-square overflow-hidden bg-stone-100 rounded-sm">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-stone-300 text-3xl font-light">
                        {(product.name || '?').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleProductClick(product)}
                      className="absolute bottom-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white shadow-md hover:bg-rose-600 active:scale-95"
                      aria-label={`${t('shopAdd')} ${product.name}`}
                    >
                      <Plus className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                    {unlocked ? (
                      <button
                        type="button"
                        onClick={() => addConfiguredItem(product, [], 0, [], true)}
                        className="absolute left-2 top-2 rounded-full bg-teal-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                      >
                        {t('shopFree')}
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleProductClick(product)}
                    className="mt-2 text-left"
                  >
                    <p className="font-semibold text-stone-900 text-sm sm:text-[15px] leading-snug line-clamp-2 uppercase tracking-wide">
                      {product.name}
                    </p>
                    {gridCols === 1 && product.description ? (
                      <p className="mt-0.5 text-sm text-stone-500 line-clamp-2">{product.description}</p>
                    ) : null}
                    <p className="mt-0.5 text-sm text-stone-700 tabular-nums">
                      CHF {catalogUnitPrice(product.price).toFixed(2)}
                    </p>
                    {rewardPts != null ? (
                      <p className="mt-0.5 text-[11px] font-medium text-amber-800">
                        {t('shopPtsBadge').replace('{n}', String(rewardPts))}
                      </p>
                    ) : null}
                  </button>
                </article>
              );
            })}
          </div>
          {visibleItems.length === 0 && (
            <p className="text-stone-500 py-12 text-center">{t('shopNoProducts')}</p>
          )}
        </div>

        <div className="hidden lg:block sticky top-20 h-[calc(100vh-6rem)]">{Basket}</div>
      </div>

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
          product={{ ...pendingProduct, price: catalogUnitPrice(pendingProduct.price) }}
          onClose={() => setPendingProduct(null)}
          onConfirm={(extras) => {
            addConfiguredItem(pendingProduct, extras);
            setPendingProduct(null);
          }}
        />
      )}

      {pendingCombo && (
        <ShopComboWizard
          product={{ ...pendingCombo, price: catalogUnitPrice(pendingCombo.price) }}
          onClose={() => setPendingCombo(null)}
          onConfirm={({ comboSelections, selectedExtras }) => {
            addConfiguredItem(pendingCombo, selectedExtras, undefined, comboSelections);
            setPendingCombo(null);
          }}
        />
      )}

      <ShopChannelPrompt
        open={channelPromptOpen}
        title={t('shopChooseHow')}
        subtitle={
          channelSelectMode === 'popup_start'
            ? t('shopChooseHowHint')
            : t('shopChangeChannelHint')
        }
        options={channelButtons.map((c) => ({
          id: c.id,
          label: c.label,
          etaMinutes: channels[c.id]?.etaMinutes || 30,
          open: !!channels[c.id]?.open,
          todayLabel: channels[c.id]?.todayLabel,
        }))}
        selected={channel}
        confirmLabel={t('shopContinue')}
        dismissible={channelSelectMode !== 'popup_start'}
        onSelect={(id) => {
          patch({ channel: id });
          setDeliveryInfo(null);
          setError(null);
        }}
        onConfirm={confirmChannelPrompt}
        onClose={() => setChannelPromptOpen(false)}
      />
    </div>
  );
}
