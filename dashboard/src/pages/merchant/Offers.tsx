import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type OfferType =
  | 'percent_category'
  | 'percent_order'
  | 'fixed_off'
  | 'bogo'
  | 'pay_n_get_m'
  | 'package_deal'
  | 'combo_deal';

type Offer = {
  id: string;
  name: string;
  description?: string | null;
  offerType: OfferType | string;
  rules: Record<string, unknown>;
  channels: string[];
  categoryIds: string[];
  productIds: string[];
  scheduleMode: string;
  daysOfWeek: string[];
  timeStart?: string | null;
  timeEnd?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  isActive: boolean;
  featured: boolean;
  badgeLabel?: string | null;
  priority: number;
  stackable: boolean;
};

type Category = { id: string; name: string; isOffersCategory?: boolean };
type ProductOpt = { id: string; name: string; price: string | number; categoryId?: string | null };

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

const TYPE_LABELS: Record<string, string> = {
  percent_order: '% off whole order',
  percent_category: '% off category or products',
  fixed_off: 'Fixed CHF off',
  package_deal: 'Package (pick N + free, one price)',
  bogo: 'Buy X get Y (same list)',
  pay_n_get_m: 'Pay N get M (e.g. 3+1)',
  combo_deal: 'Combo (legacy)',
};

function endOfZurichDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function startOfZurichDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Preset date window for "today / 2 days / week" */
function validityPreset(kind: 'today' | 'two_days' | 'week'): { validFrom: string; validTo: string } {
  const from = startOfZurichDay(new Date());
  const to = new Date(from);
  if (kind === 'today') {
    // end of today
  } else if (kind === 'two_days') {
    to.setDate(to.getDate() + 1);
  } else {
    to.setDate(to.getDate() + 6);
  }
  return { validFrom: from.toISOString(), validTo: endOfZurichDay(to).toISOString() };
}

const emptyForm = () => ({
  name: '',
  description: '',
  offerType: 'percent_order' as OfferType,
  percentOff: '20',
  fixedOff: '5',
  buyQty: '2',
  getQty: '1',
  getDiscountPercent: '100',
  payQty: '3',
  receiveQty: '4',
  packagePrice: '25',
  buyProductIds: [] as string[],
  getProductIds: [] as string[],
  minOrderAmount: '',
  channels: [] as string[],
  categoryIds: [] as string[],
  productIds: [] as string[],
  scheduleMode: 'always',
  daysOfWeek: [] as string[],
  timeStart: '',
  timeEnd: '',
  validFrom: '' as string,
  validTo: '' as string,
  validityPreset: '' as '' | 'today' | 'two_days' | 'week',
  featured: true,
  isActive: true,
  badgeLabel: '',
  priority: '10',
  stackable: false,
});

export default function Offers() {
  const { t } = useI18n();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const load = async () => {
    try {
      const [o, c, p] = await Promise.all([
        api.get('/merchant/offers'),
        api.get('/merchant/categories'),
        api.get('/merchant/products?limit=500'),
      ]);
      setOffers(o.data.offers || []);
      setCategories(c.data.categories || []);
      setProducts(p.data.products || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const startEdit = (offer: Offer) => {
    setEditingId(offer.id);
    const r = offer.rules || {};
    setForm({
      name: offer.name,
      description: offer.description || '',
      offerType: (offer.offerType as OfferType) || 'percent_order',
      percentOff: String(r.percentOff ?? '20'),
      fixedOff: String(r.fixedOff ?? '5'),
      buyQty: String(r.buyQty ?? '2'),
      getQty: String(r.getQty ?? '1'),
      getDiscountPercent: String(r.getDiscountPercent ?? '100'),
      payQty: String(r.payQty ?? '3'),
      receiveQty: String(r.receiveQty ?? '4'),
      packagePrice: String(r.packagePrice ?? '25'),
      buyProductIds: Array.isArray(r.buyProductIds) ? (r.buyProductIds as string[]) : [],
      getProductIds: Array.isArray(r.getProductIds) ? (r.getProductIds as string[]) : [],
      minOrderAmount: r.minOrderAmount != null ? String(r.minOrderAmount) : '',
      channels: offer.channels || [],
      categoryIds: offer.categoryIds || [],
      productIds: offer.productIds || [],
      scheduleMode: offer.scheduleMode || 'always',
      daysOfWeek: offer.daysOfWeek || [],
      timeStart: offer.timeStart || '',
      timeEnd: offer.timeEnd || '',
      validFrom: offer.validFrom ? String(offer.validFrom) : '',
      validTo: offer.validTo ? String(offer.validTo) : '',
      validityPreset: '',
      featured: offer.featured !== false,
      isActive: offer.isActive !== false,
      badgeLabel: offer.badgeLabel || '',
      priority: String(offer.priority ?? 10),
      stackable: !!offer.stackable,
    });
  };

  const buildPayload = () => {
    const rules: Record<string, unknown> = {};
    if (form.minOrderAmount) rules.minOrderAmount = Number(form.minOrderAmount) || 0;
    if (form.offerType === 'percent_category' || form.offerType === 'percent_order') {
      rules.percentOff = Number(form.percentOff) || 0;
    }
    if (form.offerType === 'fixed_off') rules.fixedOff = Number(form.fixedOff) || 0;
    if (form.offerType === 'bogo') {
      rules.buyQty = Number(form.buyQty) || 1;
      rules.getQty = Number(form.getQty) || 1;
      rules.getDiscountPercent = Number(form.getDiscountPercent) || 100;
    }
    if (form.offerType === 'pay_n_get_m') {
      rules.payQty = Number(form.payQty) || 3;
      rules.receiveQty = Number(form.receiveQty) || 4;
    }
    if (form.offerType === 'package_deal') {
      rules.buyQty = Number(form.buyQty) || 2;
      rules.getQty = Number(form.getQty) || 1;
      rules.packagePrice = Number(form.packagePrice) || 0;
      rules.buyProductIds = form.buyProductIds;
      rules.getProductIds = form.getProductIds;
    }
    return {
      name: form.name.trim(),
      description: form.description.trim() || null,
      offerType: form.offerType,
      rules,
      channels: form.channels,
      categoryIds: form.offerType === 'package_deal' ? [] : form.categoryIds,
      productIds:
        form.offerType === 'percent_category' || form.offerType === 'bogo' || form.offerType === 'pay_n_get_m'
          ? form.productIds
          : [],
      scheduleMode: form.scheduleMode,
      daysOfWeek: form.daysOfWeek,
      timeStart: form.timeStart || null,
      timeEnd: form.timeEnd || null,
      validFrom: form.validFrom || null,
      validTo: form.validTo || null,
      featured: form.featured,
      isActive: form.isActive,
      badgeLabel: form.badgeLabel.trim() || null,
      priority: Number(form.priority) || 0,
      stackable: form.stackable,
    };
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (form.offerType === 'package_deal') {
      if (form.buyProductIds.length < Number(form.buyQty || 0)) {
        toast.error(`Select at least ${form.buyQty} products in the paid list`);
        return;
      }
      if (Number(form.getQty) > 0 && form.getProductIds.length < Number(form.getQty)) {
        toast.error(`Select at least ${form.getQty} products in the free list`);
        return;
      }
      if (!(Number(form.packagePrice) > 0)) {
        toast.error('Set a package price greater than 0');
        return;
      }
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingId) {
        await api.put(`/merchant/offers/${editingId}`, payload);
        toast.success('Offer updated');
      } else {
        await api.post('/merchant/offers', payload);
        toast.success('Offer created');
      }
      reset();
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this offer?')) return;
    try {
      await api.delete(`/merchant/offers/${id}`);
      toast.success('Deleted');
      if (editingId === id) reset();
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const toggleDay = (key: string) => {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(key)
        ? f.daysOfWeek.filter((d) => d !== key)
        : [...f.daysOfWeek, key],
    }));
  };

  const toggleChannel = (key: string) => {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(key)
        ? f.channels.filter((c) => c !== key)
        : [...f.channels, key],
    }));
  };

  const toggleCategory = (id: string) => {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((c) => c !== id)
        : [...f.categoryIds, id],
    }));
  };

  const toggleScopedProduct = (id: string) => {
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(id)
        ? f.productIds.filter((p) => p !== id)
        : [...f.productIds, id],
    }));
  };

  const applyValidityPreset = (kind: 'today' | 'two_days' | 'week') => {
    const { validFrom, validTo } = validityPreset(kind);
    setForm((f) => ({ ...f, validityPreset: kind, validFrom, validTo }));
  };

  const toggleProduct = (field: 'buyProductIds' | 'getProductIds', id: string) => {
    setForm((f) => {
      const list = f[field];
      return {
        ...f,
        [field]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
      };
    });
  };

  if (loading) return <div className="text-center py-12">Loading offers…</div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title mb-1">{t('offers')}</h1>
            <p className="page-sub">
              % off on a category or single products (applied live in the shop cart), package deals
              (tap 2+1 on the shelf to pick paid + free), BOGO, 3+1. Set validity to today, 2 days,
              or a full week. Featured offers appear on the shop shelf.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={async () => {
                try {
                  const res = await api.post('/merchant/offers/ensure-category');
                  toast.success(`Offers category ready: ${res.data.category?.name}`);
                  await load();
                } catch (e: any) {
                  toast.error(e.response?.data?.error || 'Failed');
                }
              }}
            >
              Ensure Offers category
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={async () => {
                try {
                  const res = await api.post('/merchant/offers/seed-demos');
                  toast.success(`Loaded ${res.data.offers?.length || 0} demo offers`);
                  await load();
                } catch (e: any) {
                  toast.error(e.response?.data?.error || 'Failed');
                }
              }}
            >
              Load demo scenarios
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 border-t border-[var(--border)] pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm block">
              <span className="muted block mb-1">Name *</span>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Happy hour 20% - Food"
                required
              />
            </label>
            <label className="text-sm block">
              <span className="muted block mb-1">Type</span>
              <select
                className="input"
                value={form.offerType}
                onChange={(e) => setForm({ ...form, offerType: e.target.value as OfferType })}
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-sm block">
            <span className="muted block mb-1">Description</span>
            <textarea
              className="input min-h-[60px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Shown on the Offers shelf"
            />
          </label>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(form.offerType === 'percent_category' || form.offerType === 'percent_order') && (
              <label className="text-sm block">
                <span className="muted block mb-1">% off</span>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="90"
                  value={form.percentOff}
                  onChange={(e) => setForm({ ...form, percentOff: e.target.value })}
                />
              </label>
            )}
            {form.offerType === 'fixed_off' && (
              <label className="text-sm block">
                <span className="muted block mb-1">CHF off</span>
                <input
                  className="input"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={form.fixedOff}
                  onChange={(e) => setForm({ ...form, fixedOff: e.target.value })}
                />
              </label>
            )}
            {form.offerType === 'bogo' && (
              <>
                <label className="text-sm block">
                  <span className="muted block mb-1">Buy qty</span>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={form.buyQty}
                    onChange={(e) => setForm({ ...form, buyQty: e.target.value })}
                  />
                </label>
                <label className="text-sm block">
                  <span className="muted block mb-1">Get qty</span>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={form.getQty}
                    onChange={(e) => setForm({ ...form, getQty: e.target.value })}
                  />
                </label>
                <label className="text-sm block">
                  <span className="muted block mb-1">Get discount %</span>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max="100"
                    value={form.getDiscountPercent}
                    onChange={(e) => setForm({ ...form, getDiscountPercent: e.target.value })}
                  />
                </label>
              </>
            )}
            {form.offerType === 'pay_n_get_m' && (
              <>
                <label className="text-sm block">
                  <span className="muted block mb-1">Pay for</span>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={form.payQty}
                    onChange={(e) => setForm({ ...form, payQty: e.target.value })}
                  />
                </label>
                <label className="text-sm block">
                  <span className="muted block mb-1">Receive total</span>
                  <input
                    className="input"
                    type="number"
                    min="2"
                    value={form.receiveQty}
                    onChange={(e) => setForm({ ...form, receiveQty: e.target.value })}
                  />
                </label>
              </>
            )}
            {form.offerType === 'package_deal' && (
              <>
                <label className="text-sm block">
                  <span className="muted block mb-1">Choose how many (paid)</span>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={form.buyQty}
                    onChange={(e) => setForm({ ...form, buyQty: e.target.value })}
                  />
                </label>
                <label className="text-sm block">
                  <span className="muted block mb-1">How many free</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.getQty}
                    onChange={(e) => setForm({ ...form, getQty: e.target.value })}
                  />
                </label>
                <label className="text-sm block">
                  <span className="muted block mb-1">Package price (CHF)</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.packagePrice}
                    onChange={(e) => setForm({ ...form, packagePrice: e.target.value })}
                  />
                </label>
              </>
            )}
            <label className="text-sm block">
              <span className="muted block mb-1">Min order CHF (optional)</span>
              <input
                className="input"
                type="number"
                min="0"
                value={form.minOrderAmount}
                onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
              />
            </label>
            <label className="text-sm block">
              <span className="muted block mb-1">Badge</span>
              <input
                className="input"
                value={form.badgeLabel}
                onChange={(e) => setForm({ ...form, badgeLabel: e.target.value })}
                placeholder="20% off"
              />
            </label>
            <label className="text-sm block">
              <span className="muted block mb-1">Priority</span>
              <input
                className="input"
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </label>
          </div>

          {(form.offerType === 'percent_category' ||
            form.offerType === 'bogo' ||
            form.offerType === 'pay_n_get_m') && (
            <div className="space-y-3">
              <div>
                <p className="text-xs muted mb-1">
                  Categories (empty = all
                  {form.offerType === 'percent_category' ? ', unless you pick products below' : ''})
                </p>
                <div className="flex flex-wrap gap-2">
                  {categories
                    .filter((c) => !c.isOffersCategory)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`rounded-full px-3 py-1 text-xs border ${
                          form.categoryIds.includes(c.id)
                            ? 'bg-amber-700 text-white border-amber-700'
                            : 'bg-white border-[var(--border)]'
                        }`}
                        onClick={() => toggleCategory(c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                </div>
              </div>
              {form.offerType === 'percent_category' ? (
                <div>
                  <p className="text-xs muted mb-1">
                    Or specific products only ({form.productIds.length} selected - overrides
                    categories when set)
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {products.map((p) => (
                      <button
                        key={`pct-${p.id}`}
                        type="button"
                        className={`rounded-full px-2.5 py-1 text-[11px] border ${
                          form.productIds.includes(p.id)
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-white border-[var(--border)]'
                        }`}
                        onClick={() => toggleScopedProduct(p.id)}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {form.offerType === 'package_deal' && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <p className="text-sm font-medium text-amber-950">
                Pick {form.buyQty || 2} from paid list + {form.getQty || 1} free → CHF{' '}
                {form.packagePrice || '0'} for the set
              </p>
              <div>
                <p className="text-xs muted mb-1">
                  Paid choices - select products customers pick from ({form.buyProductIds.length}{' '}
                  selected)
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {products.map((p) => (
                    <button
                      key={`buy-${p.id}`}
                      type="button"
                      className={`rounded-full px-2.5 py-1 text-[11px] border ${
                        form.buyProductIds.includes(p.id)
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white border-[var(--border)]'
                      }`}
                      onClick={() => toggleProduct('buyProductIds', p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
                  {products.length === 0 ? (
                    <span className="text-xs muted">No products - add some in Products first</span>
                  ) : null}
                </div>
              </div>
              <div>
                <p className="text-xs muted mb-1">
                  Free choices - select products for the free pick ({form.getProductIds.length}{' '}
                  selected)
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {products.map((p) => (
                    <button
                      key={`get-${p.id}`}
                      type="button"
                      className={`rounded-full px-2.5 py-1 text-[11px] border ${
                        form.getProductIds.includes(p.id)
                          ? 'bg-amber-700 text-white border-amber-700'
                          : 'bg-white border-[var(--border)]'
                      }`}
                      onClick={() => toggleProduct('getProductIds', p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs muted mb-1">Channels (empty = all) - for pickup-only, select Pickup</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'takeaway', label: 'Pickup' },
                { id: 'delivery', label: 'Delivery' },
                { id: 'dine_in', label: 'Dine-in' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs border ${
                    form.channels.includes(c.id)
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white border-[var(--border)]'
                  }`}
                  onClick={() => toggleChannel(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm block">
              <span className="muted block mb-1">Schedule</span>
              <select
                className="input"
                value={form.scheduleMode}
                onChange={(e) => setForm({ ...form, scheduleMode: e.target.value })}
              >
                <option value="always">Always (within time window)</option>
                <option value="days">Specific days</option>
              </select>
            </label>
            <label className="text-sm block">
              <span className="muted block mb-1">From (HH:mm)</span>
              <input
                className="input"
                type="time"
                value={form.timeStart}
                onChange={(e) => setForm({ ...form, timeStart: e.target.value })}
              />
            </label>
            <label className="text-sm block">
              <span className="muted block mb-1">To (HH:mm)</span>
              <input
                className="input"
                type="time"
                value={form.timeEnd}
                onChange={(e) => setForm({ ...form, timeEnd: e.target.value })}
              />
            </label>
          </div>

          <div>
            <p className="text-xs muted mb-1">Valid for (date range)</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {(
                [
                  ['today', 'Today only'],
                  ['two_days', '2 days'],
                  ['week', 'Full week'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs border ${
                    form.validityPreset === key
                      ? 'bg-amber-700 text-white border-amber-700'
                      : 'bg-white border-[var(--border)]'
                  }`}
                  onClick={() => applyValidityPreset(key)}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                className="rounded-full px-3 py-1 text-xs border bg-white border-[var(--border)]"
                onClick={() => setForm({ ...form, validityPreset: '', validFrom: '', validTo: '' })}
              >
                No end date
              </button>
            </div>
            {(form.validFrom || form.validTo) && (
              <p className="text-[11px] text-stone-500">
                {form.validFrom ? new Date(form.validFrom).toLocaleString() : '…'} →{' '}
                {form.validTo ? new Date(form.validTo).toLocaleString() : '…'}
              </p>
            )}
          </div>

          {form.scheduleMode === 'days' && (
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs border ${
                    form.daysOfWeek.includes(d.key)
                      ? 'bg-amber-700 text-white border-amber-700'
                      : 'bg-white border-[var(--border)]'
                  }`}
                  onClick={() => toggleDay(d.key)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />
              Show on Offers shelf
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.stackable}
                onChange={(e) => setForm({ ...form, stackable: e.target.checked })}
              />
              Stackable with other stackable offers
            </label>
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update offer' : 'Create offer'}
            </button>
            {editingId ? (
              <button type="button" className="btn-secondary" onClick={reset}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="text-base font-semibold mb-3">Your offers</h2>
        {offers.length === 0 ? (
          <p className="text-sm muted">No offers yet - create one or load demo scenarios.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {offers.map((o) => (
              <li key={o.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{o.name}</span>
                    {o.badgeLabel ? (
                      <span className="rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[11px] font-bold">
                        {o.badgeLabel}
                      </span>
                    ) : null}
                    {!o.isActive ? (
                      <span className="text-[11px] text-stone-500">Inactive</span>
                    ) : null}
                  </div>
                  <p className="text-xs muted mt-0.5">
                    {TYPE_LABELS[o.offerType] || o.offerType}
                    {o.scheduleMode === 'days' && o.daysOfWeek?.length
                      ? ` · ${o.daysOfWeek.join(', ')}`
                      : ' · always'}
                    {o.timeStart || o.timeEnd
                      ? ` · ${o.timeStart || '…'}-${o.timeEnd || '…'}`
                      : ''}
                    {o.channels?.length ? ` · ${o.channels.join(', ')}` : ' · all channels'}
                  </p>
                  {o.description ? <p className="text-sm mt-1 text-stone-600">{o.description}</p> : null}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" className="btn-secondary text-sm" onClick={() => startEdit(o)}>
                    Edit
                  </button>
                  <button type="button" className="btn-secondary text-sm" onClick={() => onDelete(o.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
