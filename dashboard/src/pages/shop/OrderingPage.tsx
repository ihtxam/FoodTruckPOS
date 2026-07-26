import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  emptyDraft,
  loadCart,
  resolveShopKey,
  saveCart,
  shopBasePath,
  type ShopCartItem,
  type ShopChannel,
  type ShopCheckoutDraft,
} from '@/lib/shop-cart';
import { roundMoney2, roundTo005, roundingAdjustment } from '@/lib/money';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
}

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
  const { merchantSlug } = useParams<{ merchantSlug: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const navigate = useNavigate();

  const [merchant, setMerchant] = useState<any>(null);
  const [menu, setMenu] = useState<Category[]>([]);
  const [draft, setDraft] = useState<ShopCheckoutDraft>(emptyDraft());
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileBasket, setMobileBasket] = useState(false);
  const [checkingDelivery, setCheckingDelivery] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState<any>(null);

  useEffect(() => {
    if (!shopKey) {
      setLoading(false);
      setError('Shop not found');
      return;
    }

    const stored = loadCart(shopKey);
    if (stored) setDraft(stored);

    const load = async () => {
      try {
        const [shopRes, menuRes] = await Promise.all([
          axios.get(`/api/shop/${shopKey}`),
          axios.get(`/api/shop/${shopKey}/menu`),
        ]);
        const data = shopRes.data.data;
        setMerchant(data);
        setMenu(menuRes.data.data || []);
        setSelectedCategory(menuRes.data.data?.[0]?.id || '');
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
        setError(e.response?.data?.error || 'Failed to load shop');
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

  const addToCart = (product: Product) => {
    setDraft((prev) => {
      const existing = prev.items.find((item) => item.id === product.id);
      const items: ShopCartItem[] = existing
        ? prev.items.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          )
        : [
            ...prev.items,
            {
              id: product.id,
              name: product.name,
              price: product.price,
              quantity: 1,
              description: product.description,
              image: product.image,
            },
          ];
      return { ...prev, items };
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setDraft((prev) => ({
      ...prev,
      items:
        quantity <= 0
          ? prev.items.filter((item) => item.id !== productId)
          : prev.items.map((item) => (item.id === productId ? { ...item, quantity } : item)),
    }));
  };

  const checkDeliveryPreview = async () => {
    if (!draft.address.trim()) {
      setError('Enter a delivery address to check your zone');
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
      if (!res.data.deliverable) setError(res.data.error || 'Outside delivery area');
      else if (!res.data.meetsMinOrder) setError(res.data.message);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not verify address');
      setDeliveryInfo(null);
    } finally {
      setCheckingDelivery(false);
    }
  };

  const goCheckout = () => {
    if (!cart.length) return;
    if (channel === 'delivery' && deliveryInfo && !deliveryInfo.deliverable) {
      setError('Outside delivery area — change address or switch to pickup');
      return;
    }
    if (channel === 'delivery' && deliveryInfo && !deliveryInfo.meetsMinOrder) {
      setError(deliveryInfo.message || 'Minimum order not met');
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
        Loading shop…
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

  const visibleItems = menu.find((c) => c.id === selectedCategory)?.items || [];
  const allChannels: { id: ShopChannel; label: string }[] = [
    { id: 'takeaway', label: 'Pickup' },
    { id: 'delivery', label: 'Delivery' },
    { id: 'dine_in', label: 'Dine in' },
  ];
  const channelButtons = allChannels.filter((c) => channels[c.id]?.enabled);

  const Basket = (
    <aside className="bg-white border border-stone-200 flex flex-col h-full">
      <div className="px-5 py-4 border-b border-stone-200">
        <h2 className="text-xl font-bold tracking-tight">Basket</h2>
        <p className="text-sm text-stone-500 mt-1">
          {channelButtons.find((c) => c.id === channel)?.label} · {channelMeta?.etaMinutes || 30}–
          {(channelMeta?.etaMinutes || 30) + 10} min
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {cart.length === 0 ? (
          <p className="text-stone-500 text-sm py-8 text-center">No items added yet.</p>
        ) : (
          <ul className="space-y-3">
            {cart.map((item) => (
              <li key={item.id} className="flex gap-3 text-sm">
                <div className="flex-1">
                  <div className="font-medium text-stone-900">{item.name}</div>
                  <div className="text-stone-500">CHF {item.price.toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="w-7 h-7 border border-stone-300"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    className="w-7 h-7 border border-stone-300"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
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
            <p className="text-xs text-stone-500">Optional: check if we deliver to you</p>
            <input
              className="w-full border border-stone-300 px-3 py-2 text-sm"
              placeholder="Street address"
              value={draft.address}
              onChange={(e) => patch({ address: e.target.value })}
            />
            <div className="flex gap-2">
              <input
                className="w-28 border border-stone-300 px-3 py-2 text-sm"
                placeholder="ZIP"
                value={draft.zipCode}
                onChange={(e) => patch({ zipCode: e.target.value })}
              />
              <input
                className="flex-1 border border-stone-300 px-3 py-2 text-sm"
                placeholder="City"
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
              {checkingDelivery ? 'Checking…' : 'Check delivery zone'}
            </button>
            {deliveryInfo?.deliverable && (
              <p className="text-xs text-teal-800">
                {deliveryInfo.zone.name}: fee CHF {Number(deliveryInfo.zone.deliveryFee).toFixed(2)}
                {deliveryInfo.zone.minOrderAmount > 0
                  ? ` · min CHF ${Number(deliveryInfo.zone.minOrderAmount).toFixed(2)}`
                  : ''}
              </p>
            )}
          </div>
        )}

        <div className="text-sm space-y-1 pt-1">
          <div className="flex justify-between">
            <span className="text-stone-500">Subtotal</span>
            <span>CHF {cartTotal.toFixed(2)}</span>
          </div>
          {deliveryFee > 0 && (
            <div className="flex justify-between">
              <span className="text-stone-500">Delivery</span>
              <span>CHF {deliveryFee.toFixed(2)}</span>
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
            <span>Est. total</span>
            <span>CHF {total.toFixed(2)}</span>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!channelMeta?.open && (
          <p className="text-amber-700 text-sm">
            Closed now · {channelMeta?.todayLabel || '—'} — continue to schedule for later
          </p>
        )}

        <button
          type="button"
          disabled={!cart.length}
          onClick={goCheckout}
          className="w-full bg-stone-900 text-white py-3 font-semibold disabled:opacity-40"
        >
          {channelMeta?.open ? 'Go to checkout' : 'Schedule & checkout'}
        </button>
        <p className="text-[11px] text-stone-400 text-center">
          Guest or login · address · cash or Adyen
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
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium">
            <span className="text-stone-900 border-b-2 border-stone-900 pb-0.5">Order</span>
          </nav>
          <button
            type="button"
            className="lg:hidden bg-stone-900 text-white px-4 py-2 text-sm font-semibold"
            onClick={() => setMobileBasket(true)}
          >
            Basket ({itemCount})
          </button>
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
                    Open maps
                  </a>
                </>
              )}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{channelMeta?.todayLabel || 'Hours not set'}</span>
            <span
              className={`px-2 py-0.5 text-xs font-semibold ${
                channelMeta?.open ? 'bg-teal-100 text-teal-900' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {channelMeta?.open ? 'Open now' : 'Closed'}
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

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div>
          <div className="sticky top-16 z-20 -mx-4 px-4 py-3 bg-[#f6f5f2]/80 backdrop-blur border-b border-stone-200/80 mb-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
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
            {visibleItems.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addToCart(product)}
                className="w-full text-left bg-white border border-stone-200 p-4 flex gap-4 hover:border-stone-400 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-stone-900">{product.name}</div>
                  {product.description && (
                    <p className="text-sm text-stone-500 mt-1 line-clamp-2">{product.description}</p>
                  )}
                  <div className="mt-2 font-semibold">CHF {product.price.toFixed(2)}</div>
                </div>
                {product.image ? (
                  <img
                    src={product.image}
                    alt=""
                    className="w-24 h-24 object-cover flex-shrink-0 bg-stone-100"
                  />
                ) : (
                  <div className="w-24 h-24 flex-shrink-0 bg-stone-100 flex items-center justify-center text-2xl text-stone-300">
                    +
                  </div>
                )}
              </button>
            ))}
            {visibleItems.length === 0 && (
              <p className="text-stone-500 py-12 text-center">No products in this category.</p>
            )}
          </div>
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
                  Close
                </button>
              </div>
              <div className="flex-1 min-h-0">{Basket}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
