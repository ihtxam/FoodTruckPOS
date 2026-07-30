import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  clearCustomerToken,
  emptyDraft,
  loadCart,
  loadCustomerToken,
  newCartLineId,
  resolveShopKey,
  saveCart,
  saveCustomerToken,
  shopBasePath,
  type ShopCartItem,
  type ShopCheckoutDraft,
} from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';

type LoyaltyReward = {
  id: string;
  name: string;
  image?: string | null;
  price: number;
  loyaltyRewardPoints: number;
  unlocked: boolean;
};

type LoyaltySummary = {
  program: {
    enabled: boolean;
    earnPointsPerChf: number;
    redeemPointsPerChf: number;
    expiryDays: number;
  };
  balance: number;
  rewards: LoyaltyReward[];
  unlockedRewards: LoyaltyReward[];
  nextReward: LoyaltyReward | null;
  progressPercent: number;
  expiringSoon?: { points: number; expiresAt: string } | null;
};

type HistoryOrder = {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  createdAt: string;
  items: Array<{
    productId: string | null;
    productName: string | null;
    quantity: string;
    unitPrice: string;
    selectedExtras?: Array<{ id: string; name: string; price: number }> | null;
  }>;
};

type MenuProduct = {
  id: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  loyaltyRewardPoints?: number | null;
};

export default function AccountPage() {
  const { t } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const navigate = useNavigate();
  const base = shopBasePath(shopKey) || '/';

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(null);
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [catalog, setCatalog] = useState<Map<string, MenuProduct>>(new Map());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [addresses, setAddresses] = useState<
    Array<{
      id: string;
      label: string;
      address: string;
      zipCode?: string | null;
      city?: string | null;
      isDefault?: boolean;
    }>
  >([]);
  const [newLabel, setNewLabel] = useState<'home' | 'office' | 'other'>('home');
  const [newAddress, setNewAddress] = useState('');
  const [newZip, setNewZip] = useState('');
  const [newCity, setNewCity] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  const token = shopKey ? loadCustomerToken(shopKey) : '';

  const loadAll = async (authToken: string) => {
    if (!shopKey) return;
    const headers = { Authorization: `Bearer ${authToken}` };
    const [meRes, loyaltyRes, ordersRes, menuRes] = await Promise.all([
      axios.get(`/api/shop/${shopKey}/auth/me`, { headers }),
      axios.get(`/api/shop/${shopKey}/loyalty`, { headers }),
      axios.get(`/api/shop/${shopKey}/my-orders`, { headers }),
      axios.get(`/api/shop/${shopKey}/menu`),
    ]);
    const c = meRes.data.customer;
    setCustomer(c);
    setFirstName(c.firstName || '');
    setLastName(c.lastName || '');
    setPhone(c.phone || '');
    setAddresses(Array.isArray(c.addresses) ? c.addresses : []);
    setLoyalty(loyaltyRes.data as LoyaltySummary);
    setOrders(ordersRes.data.orders || []);

    const map = new Map<string, MenuProduct>();
    for (const cat of menuRes.data.data || []) {
      for (const p of cat.items || []) {
        map.set(p.id, p);
      }
    }
    setCatalog(map);
  };

  useEffect(() => {
    if (!shopKey) {
      setLoading(false);
      setError(t('shopNotFound'));
      return;
    }
    const boot = async () => {
      setLoading(true);
      setError('');
      try {
        if (!token) {
          setCustomer(null);
          return;
        }
        await loadAll(token);
      } catch {
        clearCustomerToken(shopKey);
        setCustomer(null);
      } finally {
        setLoading(false);
      }
    };
    void boot();
  }, [shopKey]);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!shopKey) return;
    setLoggingIn(true);
    setError('');
    try {
      const res = await axios.post(`/api/shop/${shopKey}/auth/login`, {
        email: loginEmail,
        password: loginPassword,
      });
      saveCustomerToken(shopKey, res.data.token);
      await loadAll(res.data.token);
    } catch (err: any) {
      setError(err.response?.data?.error || t('shopLoginFailed'));
    } finally {
      setLoggingIn(false);
    }
  };

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!shopKey || !token) return;
    setSaving(true);
    setError('');
    try {
      const res = await axios.put(
        `/api/shop/${shopKey}/auth/me`,
        { firstName, lastName, phone },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCustomer(res.data.customer);
      if (Array.isArray(res.data.customer.addresses)) {
        setAddresses(res.data.customer.addresses);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('shopUpdateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const addressLabelText = (label: string) => {
    if (label === 'home') return t('shopAddressHome');
    if (label === 'office') return t('shopAddressOffice');
    if (label === 'other') return t('shopAddressOther');
    return label;
  };

  const onAddAddress = async (e: FormEvent) => {
    e.preventDefault();
    if (!shopKey || !token || !newAddress.trim()) return;
    setSavingAddress(true);
    setError('');
    try {
      const res = await axios.post(
        `/api/shop/${shopKey}/auth/addresses`,
        {
          label: newLabel,
          address: newAddress.trim(),
          zipCode: newZip.trim() || null,
          city: newCity.trim() || null,
          isDefault: addresses.length === 0,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const saved = res.data.address;
      setAddresses((prev) =>
        saved.isDefault
          ? [saved, ...prev.map((a) => ({ ...a, isDefault: false }))]
          : [...prev, saved]
      );
      setNewAddress('');
      setNewZip('');
      setNewCity('');
    } catch (err: any) {
      setError(err.response?.data?.error || t('shopCouldNotSaveAddress'));
    } finally {
      setSavingAddress(false);
    }
  };

  const onDeleteAddress = async (id: string) => {
    if (!shopKey || !token) return;
    try {
      await axios.delete(`/api/shop/${shopKey}/auth/addresses/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || t('shopCouldNotDeleteAddress'));
    }
  };

  const logout = () => {
    if (shopKey) clearCustomerToken(shopKey);
    setCustomer(null);
    setLoyalty(null);
    setOrders([]);
    setAddresses([]);
  };

  const patchCart = (mutator: (draft: ShopCheckoutDraft) => ShopCheckoutDraft) => {
    if (!shopKey) return;
    const current = loadCart(shopKey) || emptyDraft();
    const next = mutator(current);
    saveCart(shopKey, next);
  };

  const addRewardToCart = (reward: LoyaltyReward) => {
    if (!reward.unlocked) return;
    patchCart((draft) => {
      const existing = draft.items.find((i) => i.id === reward.id && i.loyaltyReward);
      const items: ShopCartItem[] = existing
        ? draft.items.map((i) =>
            i.lineId === existing.lineId ? { ...i, quantity: i.quantity + 1 } : i
          )
        : [
            ...draft.items,
            {
              lineId: newCartLineId(),
              id: reward.id,
              name: reward.name,
              price: 0,
              basePrice: 0,
              quantity: 1,
              image: reward.image || undefined,
              loyaltyReward: true,
              rewardPointsCost: reward.loyaltyRewardPoints,
            },
          ];
      return { ...draft, items };
    });
    navigate(`${base}/checkout`);
  };

  const reorder = (order: HistoryOrder) => {
    const balance = loyalty?.balance ?? 0;
    patchCart((draft) => {
      const items = [...draft.items];
      for (const line of order.items || []) {
        if (!line.productId) continue;
        const product = catalog.get(line.productId);
        if (!product) continue;
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
        const wasFree =
          Number(line.unitPrice) === 0 &&
          (line.selectedExtras || []).some((e) => e.id === 'loyalty_reward');
        const cost = product.loyaltyRewardPoints != null ? Number(product.loyaltyRewardPoints) : 0;
        const asReward = wasFree && cost >= 1 && balance >= cost;

        if (asReward) {
          const existing = items.find((i) => i.id === product.id && i.loyaltyReward);
          if (existing) {
            existing.quantity += qty;
          } else {
            items.push({
              lineId: newCartLineId(),
              id: product.id,
              name: product.name,
              price: 0,
              basePrice: 0,
              quantity: qty,
              image: product.image,
              loyaltyReward: true,
              rewardPointsCost: cost,
            });
          }
        } else {
          const extras = (line.selectedExtras || []).filter((e) => e.id !== 'loyalty_reward');
          items.push({
            lineId: newCartLineId(),
            id: product.id,
            name: product.name,
            price: product.price,
            basePrice: product.price,
            quantity: qty,
            image: product.image,
            selectedExtras: extras.map((e) => ({
              id: e.id,
              name: e.name,
              price: Number(e.price) || 0,
            })),
          });
        }
      }
      return { ...draft, items };
    });
    navigate(base);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f5f2] text-stone-600">
        {t('shopLoading')}
      </div>
    );
  }

  if (!shopKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f5f2] text-red-700">
        {error || t('shopNotFound')}
      </div>
    );
  }

  const pointsBalance = Math.max(
    0,
    Number(loyalty?.balance ?? customer?.loyaltyPoints ?? 0) || 0
  );
  const programOn = !!loyalty?.program?.enabled;

  return (
    <div className="min-h-screen bg-[#f6f5f2] text-stone-900">
      <header className="sticky top-0 z-20 bg-white border-b border-stone-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link to={base} className="text-sm font-semibold underline underline-offset-2">
            ← {t('shopBackToMenu')}
          </Link>
          <div className="flex items-center gap-3">
            <ShopLangSwitcher />
            {customer ? (
              <span className="text-xs font-bold bg-teal-800 text-white px-2.5 py-1 rounded-full">
                {t('shopPointsChip').replace('{n}', String(pointsBalance))}
              </span>
            ) : null}
            <span className="font-bold text-sm">{t('shopMyAccount')}</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {!customer ? (
          <section className="bg-white border border-stone-200 p-5 space-y-4">
            <h1 className="text-xl font-bold">{t('shopLoginToContinue')}</h1>
            <form onSubmit={onLogin} className="space-y-3">
              <input
                className="w-full border border-stone-300 px-3 py-2.5 text-sm"
                type="email"
                placeholder={t('shopEmail')}
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
              <input
                className="w-full border border-stone-300 px-3 py-2.5 text-sm"
                type="password"
                placeholder={t('shopPassword')}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loggingIn}
                className="w-full bg-stone-900 text-white py-3 font-semibold disabled:opacity-40"
              >
                {loggingIn ? t('shopLoading') : t('shopLogIn')}
              </button>
            </form>
            <p className="text-sm text-stone-500">
              {t('shopHaveAccount')}{' '}
              <Link to={`${base}/checkout`} className="underline font-medium text-stone-900">
                {t('shopCreateAccount')}
              </Link>
            </p>
          </section>
        ) : (
          <>
            <section className="bg-white border border-stone-200 p-5 space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-400">{t('shopFidelity')}</p>
                  <p className="text-3xl font-bold tracking-tight">
                    {pointsBalance}{' '}
                    <span className="text-base font-semibold text-stone-500">{t('shopPoints')}</span>
                  </p>
                  <p className="text-sm text-stone-500 mt-1">{t('shopPointsBalance')}</p>
                </div>
                {loyalty?.program ? (
                  <p className="text-xs text-stone-500 text-right max-w-[12rem]">
                    {t('shopEarnHint').replace('{n}', String(loyalty.program.earnPointsPerChf))}
                    <br />
                    {t('shopRedeemHint').replace(
                      '{n}',
                      String(loyalty.program.redeemPointsPerChf)
                    )}
                    {loyalty.program.expiryDays ? (
                      <>
                        <br />
                        {t('shopPointsExpireHint').replace(
                          '{n}',
                          String(loyalty.program.expiryDays)
                        )}
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>

              {programOn ? (
                <>
                  <div className="h-2.5 bg-stone-100 overflow-hidden rounded-full">
                    <div
                      className="h-full bg-teal-700 transition-all"
                      style={{ width: `${loyalty?.progressPercent || 0}%` }}
                    />
                  </div>
                  <p className="text-sm text-stone-600">
                    {loyalty?.nextReward
                      ? t('shopProgressToReward').replace(
                          '{n}',
                          String(
                            Math.max(
                              0,
                              loyalty.nextReward.loyaltyRewardPoints - pointsBalance
                            )
                          )
                        )
                      : t('shopAllRewardsUnlocked')}
                  </p>
                  {loyalty?.expiringSoon?.points ? (
                    <p className="text-xs text-amber-700">
                      {t('shopPointsExpiringSoon')
                        .replace('{n}', String(loyalty.expiringSoon.points))
                        .replace(
                          '{date}',
                          new Date(loyalty.expiringSoon.expiresAt).toLocaleDateString()
                        )}
                    </p>
                  ) : null}
                  {(loyalty?.unlockedRewards || []).length > 0 && (
                    <div className="pt-2 space-y-2">
                      <p className="text-sm font-semibold">{t('shopUnlockedRewards')}</p>
                      <ul className="space-y-2">
                        {loyalty!.unlockedRewards.map((r) => (
                          <li
                            key={r.id}
                            className="flex items-center justify-between gap-3 border border-stone-100 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">{r.name}</p>
                              <p className="text-xs text-stone-500">
                                {t('shopPtsBadge').replace('{n}', String(r.loyaltyRewardPoints))}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => addRewardToCart(r)}
                              className="shrink-0 text-sm font-semibold bg-teal-800 text-white px-3 py-1.5"
                            >
                              {t('shopAddFree')}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-stone-500">{t('shopFidelityInactive')}</p>
              )}
            </section>

            <section className="bg-white border border-stone-200 p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-lg">{t('shopMyAccount')}</h2>
                <span className="text-sm font-semibold text-teal-800">
                  {t('shopPointsChip').replace('{n}', String(pointsBalance))}
                </span>
              </div>
              <form onSubmit={onSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  className="border border-stone-300 px-3 py-2 text-sm"
                  placeholder={t('shopFirstName')}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <input
                  className="border border-stone-300 px-3 py-2 text-sm"
                  placeholder={t('shopLastName')}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
                <input
                  className="border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
                  value={customer.email || ''}
                  disabled
                />
                <input
                  className="border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
                  placeholder={t('shopPhone')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
                <button
                  type="submit"
                  disabled={saving}
                  className="sm:col-span-2 bg-stone-900 text-white py-2.5 font-semibold disabled:opacity-40"
                >
                  {saving ? t('shopLoading') : t('shopSaveProfile')}
                </button>
              </form>

              <div className="border-t border-stone-100 pt-3 space-y-3">
                <h3 className="font-semibold text-sm">{t('shopSavedAddresses')}</h3>
                {addresses.length === 0 ? (
                  <p className="text-sm text-stone-500">{t('shopNewAddress')}</p>
                ) : (
                  <ul className="space-y-2">
                    {addresses.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-start justify-between gap-3 border border-stone-100 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {addressLabelText(a.label)}
                            {a.isDefault ? (
                              <span className="ml-2 text-[10px] uppercase text-teal-700">{t('shopDefaultLabel')}</span>
                            ) : null}
                          </p>
                          <p className="text-stone-600 truncate">
                            {a.address}
                            {a.zipCode || a.city ? `, ${a.zipCode || ''} ${a.city || ''}`.trim() : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-xs font-semibold underline shrink-0"
                          onClick={() => void onDeleteAddress(a.id)}
                        >
                          {t('delete')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={onAddAddress} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="sm:col-span-2 flex flex-wrap gap-1.5">
                    {(['home', 'office', 'other'] as const).map((lab) => (
                      <button
                        key={lab}
                        type="button"
                        onClick={() => setNewLabel(lab)}
                        className={`rounded-full border px-2.5 py-1 text-xs ${
                          newLabel === lab
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200'
                        }`}
                      >
                        {addressLabelText(lab)}
                      </button>
                    ))}
                  </div>
                  <input
                    className="border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
                    placeholder={t('shopStreetAddress')}
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    required
                  />
                  <input
                    className="border border-stone-300 px-3 py-2 text-sm"
                    placeholder={t('shopZip')}
                    value={newZip}
                    onChange={(e) => setNewZip(e.target.value)}
                  />
                  <input
                    className="border border-stone-300 px-3 py-2 text-sm"
                    placeholder={t('shopCity')}
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={savingAddress}
                    className="sm:col-span-2 border border-stone-900 px-3 py-2 text-sm font-semibold disabled:opacity-40"
                  >
                    {savingAddress ? t('shopSavingAddress') : t('shopSaveAddress')}
                  </button>
                </form>
              </div>

              <button
                type="button"
                onClick={logout}
                className="text-sm font-semibold underline underline-offset-2 text-stone-700"
              >
                {t('shopLogOut')}
              </button>
            </section>

            <section className="bg-white border border-stone-200 p-5 space-y-3">
              <h2 className="font-bold text-lg">{t('shopOrderHistory')}</h2>
              {orders.length === 0 ? (
                <p className="text-sm text-stone-500">{t('shopNoOrdersYet')}</p>
              ) : (
                <ul className="space-y-3">
                  {orders.map((o) => (
                    <li key={o.id} className="border border-stone-100 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">#{o.orderNumber}</p>
                          <p className="text-xs text-stone-500">
                            {new Date(o.createdAt).toLocaleString()} · CHF{' '}
                            {Number(o.total).toFixed(2)}
                          </p>
                          <p className="text-xs text-stone-500 mt-0.5">
                            {(o.items || [])
                              .map((i) => `${Number(i.quantity)}× ${i.productName || ''}`)
                              .join(', ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => reorder(o)}
                          className="shrink-0 text-sm font-semibold border border-stone-900 px-3 py-1.5"
                        >
                          {t('shopReorder')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
