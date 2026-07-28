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
  isActive: boolean;
  featured: boolean;
  badgeLabel?: string | null;
  priority: number;
  stackable: boolean;
};

type Category = { id: string; name: string; isOffersCategory?: boolean };

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
  percent_category: '% off category',
  percent_order: '% off order',
  fixed_off: 'Fixed CHF off',
  bogo: 'Buy X get Y',
  pay_n_get_m: 'Pay N get M (e.g. 3+1)',
  combo_deal: 'Combo deal',
};

const emptyForm = () => ({
  name: '',
  description: '',
  offerType: 'percent_category' as OfferType,
  percentOff: '20',
  fixedOff: '5',
  buyQty: '1',
  getQty: '1',
  getDiscountPercent: '100',
  payQty: '3',
  receiveQty: '4',
  minOrderAmount: '',
  channels: [] as string[],
  categoryIds: [] as string[],
  scheduleMode: 'always',
  daysOfWeek: [] as string[],
  timeStart: '',
  timeEnd: '',
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const load = async () => {
    try {
      const [o, c] = await Promise.all([
        api.get('/merchant/offers'),
        api.get('/merchant/categories'),
      ]);
      setOffers(o.data.offers || []);
      setCategories(c.data.categories || []);
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
      offerType: (offer.offerType as OfferType) || 'percent_category',
      percentOff: String(r.percentOff ?? '20'),
      fixedOff: String(r.fixedOff ?? '5'),
      buyQty: String(r.buyQty ?? '1'),
      getQty: String(r.getQty ?? '1'),
      getDiscountPercent: String(r.getDiscountPercent ?? '100'),
      payQty: String(r.payQty ?? '3'),
      receiveQty: String(r.receiveQty ?? '4'),
      minOrderAmount: r.minOrderAmount != null ? String(r.minOrderAmount) : '',
      channels: offer.channels || [],
      categoryIds: offer.categoryIds || [],
      scheduleMode: offer.scheduleMode || 'always',
      daysOfWeek: offer.daysOfWeek || [],
      timeStart: offer.timeStart || '',
      timeEnd: offer.timeEnd || '',
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
    return {
      name: form.name.trim(),
      description: form.description.trim() || null,
      offerType: form.offerType,
      rules,
      channels: form.channels,
      categoryIds: form.categoryIds,
      productIds: [],
      scheduleMode: form.scheduleMode,
      daysOfWeek: form.daysOfWeek,
      timeStart: form.timeStart || null,
      timeEnd: form.timeEnd || null,
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

  if (loading) return <div className="text-center py-12">Loading offers…</div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title mb-1">{t('offers')}</h1>
            <p className="page-sub">
              Create promotions: % off categories, BOGO, 3+1 dine-in, weekend deals, off-peak hours.
              Featured offers appear on the shop Offers shelf.
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
                placeholder="Happy hour 20% — Food"
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
            <div>
              <p className="text-xs muted mb-1">Categories (empty = all)</p>
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
          )}

          <div>
            <p className="text-xs muted mb-1">Channels (empty = all)</p>
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
          <p className="text-sm muted">No offers yet — create one or load demo scenarios.</p>
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
                      ? ` · ${o.timeStart || '…'}–${o.timeEnd || '…'}`
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
