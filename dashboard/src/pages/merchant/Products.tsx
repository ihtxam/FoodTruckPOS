import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Edit2,
  FileSpreadsheet,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface Extra {
  id: string;
  name: string;
  price: number;
}

interface BulkTier {
  minQty: number;
  price: number;
}

interface SpecRow {
  id: string;
  name: string;
  price: number;
  saleStatus: 'in_stock' | 'out_of_stock';
  isDefault: boolean;
}

interface ModifierGroupSummary {
  id: string;
  title: string;
  options?: Array<{ id: string; name: string; price: number }>;
  pricingType?: string;
  selectionType?: string;
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: string | number;
  stock: number;
  sku?: string | null;
  barcode?: string | null;
  imageUrl?: string | null;
  buttonColor?: string | null;
  productType?: string;
  isOpenPrice?: boolean;
  soldByWeight?: boolean;
  categoryId?: string | null;
  bulkPricing?: BulkTier[];
  specifications?: SpecRow[];
  extras?: Extra[];
  allowExtras?: boolean;
  modifierGroups?: ModifierGroupSummary[];
}

interface Category {
  id: string;
  name: string;
}

type FormState = {
  name: string;
  description: string;
  price: string;
  stock: string;
  sku: string;
  categoryId: string;
  buttonColor: string;
  isOpenPrice: boolean;
  soldByWeight: boolean;
  specifications: SpecRow[];
  modifierGroupIds: string[];
};

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  price: '',
  stock: '0',
  sku: '',
  categoryId: '',
  buttonColor: '#0f172a',
  isOpenPrice: false,
  soldByWeight: false,
  specifications: [{ id: 'default', name: 'Regular', price: 0, saleStatus: 'in_stock', isDefault: true }],
  modifierGroupIds: [],
});

const BUTTON_COLORS = ['#ffffff', '#facc15', '#7dd3fc', '#4ade80', '#f9a8d4', '#3370FE', '#0f172a'];

const CATEGORY_COLORS = [
  'bg-rose-50 text-rose-800 border-rose-100',
  'bg-orange-50 text-orange-800 border-orange-100',
  'bg-amber-50 text-amber-800 border-amber-100',
  'bg-emerald-50 text-emerald-800 border-emerald-100',
  'bg-sky-50 text-sky-800 border-sky-100',
  'bg-violet-50 text-violet-800 border-violet-100',
  'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-100',
  'bg-slate-50 text-slate-800 border-slate-100',
];

const money = (value: string | number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CHF' }).format(Number(value) || 0);

const productTypeLabel = (product: Product) => {
  if (product.soldByWeight) return 'Weighed';
  if (product.isOpenPrice) return 'Open price';
  return product.productType || 'Standard';
};

export default function Products() {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [allModifierGroups, setAllModifierGroups] = useState<ModifierGroupSummary[]>([]);
  const [modifierPickerOpen, setModifierPickerOpen] = useState(false);

  const load = async () => {
    try {
      const [p, c, m] = await Promise.all([
        api.get('/merchant/products?limit=200'),
        api.get('/merchant/categories'),
        api.get('/merchant/modifiers'),
      ]);
      setProducts(p.data.products || []);
      setCategories(c.data.categories || []);
      setAllModifierGroups(m.data.groups || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const categoryName = (categoryId?: string | null) =>
    categories.find((c) => c.id === categoryId)?.name || 'Uncategorized';

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      const key = product.categoryId || '__none__';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => {
      if (selectedCategory === '__none__' && product.categoryId) return false;
      if (selectedCategory && selectedCategory !== '__none__' && product.categoryId !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        (product.sku || '').toLowerCase().includes(q) ||
        (product.description || '').toLowerCase().includes(q) ||
        categoryName(product.categoryId).toLowerCase().includes(q)
      );
    });
  }, [products, selectedCategory, search, categories]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = async (product: Product) => {
    setEditingId(product.id);
    setModalOpen(true);
    try {
      const res = await api.get(`/merchant/products/${product.id}`);
      const full = res.data.product as Product;
      const specs =
        full.specifications && full.specifications.length
          ? full.specifications.map((s, i) => ({
              id: s.id || `spec-${i}`,
              name: s.name,
              price: Number(s.price) || 0,
              saleStatus: s.saleStatus === 'out_of_stock' ? 'out_of_stock' : 'in_stock',
              isDefault: !!s.isDefault,
            }))
          : [
              {
                id: 'default',
                name: 'Default',
                price: Number(full.price) || 0,
                saleStatus: 'in_stock' as const,
                isDefault: true,
              },
            ];
      setForm({
        name: full.name,
        description: full.description || '',
        price: String(full.price ?? ''),
        stock: String(full.stock ?? 0),
        sku: full.sku || '',
        categoryId: full.categoryId || '',
        buttonColor: full.buttonColor || '#0f172a',
        isOpenPrice: !!full.isOpenPrice,
        soldByWeight: !!full.soldByWeight,
        specifications: specs,
        modifierGroupIds: (full.modifierGroups || []).map((g) => g.id),
      });
    } catch {
      setForm({
        name: product.name,
        description: product.description || '',
        price: String(product.price ?? ''),
        stock: String(product.stock ?? 0),
        sku: product.sku || '',
        categoryId: product.categoryId || '',
        buttonColor: product.buttonColor || '#0f172a',
        isOpenPrice: !!product.isOpenPrice,
        soldByWeight: !!product.soldByWeight,
        specifications: [
          {
            id: 'default',
            name: 'Default',
            price: Number(product.price) || 0,
            saleStatus: 'in_stock',
            isDefault: true,
          },
        ],
        modifierGroupIds: [],
      });
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    setModifierPickerOpen(false);
  };

  const linkedModifierGroups = useMemo(
    () => allModifierGroups.filter((g) => form.modifierGroupIds.includes(g.id)),
    [allModifierGroups, form.modifierGroupIds]
  );

  const buildPayload = () => {
    const defaultSpec =
      form.specifications.find((s) => s.isDefault) || form.specifications[0];
    const price = Number(defaultSpec?.price ?? form.price) || 0;
    return {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price,
      stock: Number(form.stock) || 0,
      sku: form.sku.trim() || undefined,
      categoryId: form.categoryId || undefined,
      buttonColor: form.buttonColor || undefined,
      isOpenPrice: form.isOpenPrice,
      soldByWeight: form.soldByWeight,
      productType: form.soldByWeight ? 'weighed' : form.isOpenPrice ? 'open_price' : 'standard',
      specifications: form.specifications
        .filter((s) => s.name.trim())
        .map((s, i) => ({
          id: s.id || `spec-${i + 1}`,
          name: s.name.trim(),
          price: Number(s.price) || 0,
          saleStatus: s.saleStatus,
          isDefault: !!s.isDefault,
          sortOrder: i,
        })),
      modifierGroupIds: form.modifierGroupIds,
      allowExtras: form.modifierGroupIds.length > 0,
    };
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingId) {
        await api.put(`/merchant/products/${editingId}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/merchant/products', payload);
        toast.success('Product created');
      }
      closeModal();
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await api.delete(`/merchant/products/${id}`);
      toast.success('Deleted');
      if (editingId === id) closeModal();
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Delete failed');
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/merchant/products/import/template', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manupos-catalog-template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download template');
    }
  };

  const onImport = async (file: File) => {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/merchant/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const r = response.data;
      toast.success(
        `Import done: +${r.categoriesCreated} categories, +${r.productsCreated} products, ~${r.productsUpdated} updated`
      );
      if (r.errors?.length) toast.error(`${r.errors.length} row error(s) — check file`);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 muted text-sm">
        Loading products…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="page-title">{t('products')}</h1>
          <p className="page-sub">
            Catalog, sizes, modifiers, Excel import
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => void downloadTemplate()}
            className="btn-secondary"
          >
            <Download size={14} />
            Template
          </button>
          <button
            type="button"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
            className="btn-secondary"
          >
            <FileSpreadsheet size={14} />
            {importing ? 'Importing…' : 'Import'}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="btn-primary"
          >
            <Plus size={14} />
            Add
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImport(file);
            }}
          />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 muted" size={14} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, SKU, category…"
          className="input pl-8"
        />
      </div>

      <section className="card">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide muted mb-2">
          Categories
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`rounded-md border p-2 text-left transition ${
              selectedCategory === null
                ? 'border-transparent bg-[var(--accent)] text-white'
                : 'border-[var(--border)] bg-[var(--bg-muted)] hover:opacity-90'
            }`}
          >
            <div className="text-[10px] opacity-80">All</div>
            <div className="mt-0.5 text-base font-semibold tabular-nums">{products.length}</div>
          </button>
          {categories.map((cat, idx) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-md border p-2 text-left transition ${
                selectedCategory === cat.id
                  ? 'border-transparent bg-[var(--accent)] text-white'
                  : `${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} hover:opacity-90`
              }`}
            >
              <div className="text-[10px] opacity-80 truncate">{cat.name}</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums">{categoryCounts.get(cat.id) || 0}</div>
            </button>
          ))}
          {(categoryCounts.get('__none__') || 0) > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory('__none__')}
              className={`rounded-md border p-2 text-left transition ${
                selectedCategory === '__none__'
                  ? 'border-transparent bg-[var(--accent)] text-white'
                  : 'border-[var(--border)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-muted)]'
              }`}
            >
              <div className="text-[10px] opacity-80">Uncategorized</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums">{categoryCounts.get('__none__') || 0}</div>
            </button>
          )}
        </div>
      </section>

      <section className="space-y-2">
        {filteredProducts.length === 0 && (
          <div className="card border-dashed px-4 py-10 text-center">
            <Package className="mx-auto muted" size={28} />
            <p className="mt-2 text-sm font-semibold">No products found</p>
            <p className="text-xs muted mt-1">Create one or import an Excel catalog.</p>
            <button
              type="button"
              onClick={openCreate}
              className="btn-primary mt-3"
            >
              <Plus size={14} />
              Add Product
            </button>
          </div>
        )}

        {filteredProducts.map((product) => {
          const extras = product.extras || [];
          const tiers = product.bulkPricing || [];
          const sizes = product.specifications || [];
          const expanded = expandedProduct === product.id;
          const stockOk = product.stock > 20;

          return (
            <article
              key={product.id}
              className="overflow-hidden card !p-0"
            >
              <div className="flex items-stretch gap-2 p-3">
                <button
                  type="button"
                  className="flex flex-1 items-center gap-4 text-left min-w-0"
                  onClick={() => setExpandedProduct(expanded ? null : product.id)}
                >
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 overflow-hidden">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package size={22} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-lg text-slate-900">{product.name}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        {productTypeLabel(product)}
                      </span>
                    </div>
                    {product.description && (
                      <p className="mt-0.5 text-sm text-slate-500 line-clamp-1">{product.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="font-semibold text-emerald-700">{money(product.price)}</span>
                      <span className="text-slate-500">SKU: {product.sku || '—'}</span>
                      <span className={stockOk ? 'text-emerald-600' : 'text-amber-600'}>
                        Stock: {product.stock}
                      </span>
                      <span className="text-slate-500">{categoryName(product.categoryId)}</span>
                      {(extras.length > 0 || tiers.length > 0) && (
                        <span className="text-slate-400">
                          {tiers.length ? `${tiers.length} tiers` : ''}
                          {tiers.length && extras.length ? ' · ' : ''}
                          {extras.length ? `${extras.length} extras` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="hidden sm:inline text-slate-400">
                    {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void openEdit(product)}
                    className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(product.id)}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="border-t border-[var(--border)] bg-[var(--bg-muted)] p-3 space-y-3">
                  {sizes.length > 0 && (
                    <div>
                      <h4 className="mb-1.5 text-xs font-semibold">Sizes</h4>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {sizes.map((size, idx) => (
                          <div
                            key={size.id || `${product.id}-size-${idx}`}
                            className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs"
                          >
                            <span>
                              {size.name || 'Size'}
                              {size.isDefault ? ' · default' : ''}
                            </span>
                            <span className="font-semibold">{money(size.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {tiers.length > 0 && (
                    <div>
                      <h4 className="mb-1.5 text-xs font-semibold">Bulk pricing</h4>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {tiers.map((tier, idx) => (
                          <div
                            key={`${product.id}-tier-${idx}`}
                            className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs"
                          >
                            <span>From {tier.minQty} units</span>
                            <span className="font-semibold">{money(tier.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {extras.length > 0 && (
                    <div>
                      <h4 className="mb-1.5 text-xs font-semibold">Add-ons</h4>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {extras.map((extra) => (
                          <div
                            key={extra.id}
                            className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs"
                          >
                            <span>{extra.name}</span>
                            <span className="font-semibold">+{money(extra.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!sizes.length && !tiers.length && !extras.length && (
                    <p className="text-xs muted">No sizes, extras, or bulk tiers configured.</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-sm">
                    <InfoCard label="Category" value={categoryName(product.categoryId)} />
                    <InfoCard label="Type" value={productTypeLabel(product)} />
                    <InfoCard label="Stock" value={`${product.stock} units`} />
                    <InfoCard label="Barcode" value={product.barcode || '—'} />
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-3">
          <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-lg sm:rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
              <h2 className="text-base font-semibold">
                {editingId ? 'Edit product' : 'Add product'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1.5 muted hover:bg-[var(--bg-muted)]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3 px-4 py-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Product Name *">
                  <input
                    className="field-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Category *">
                  <select
                    className="field-input"
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Product Code / SKU">
                  <input
                    className="field-input"
                    placeholder="For quick search when ordering"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </Field>
                <Field label="Stock">
                  <input
                    className="field-input"
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  className="field-input min-h-[64px]"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide muted">
                  Button color
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {BUTTON_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm({ ...form, buttonColor: color })}
                      className={`h-6 w-6 rounded-full border ${
                        form.buttonColor === color ? 'border-[var(--text)] ring-1 ring-[var(--text)]' : 'border-[var(--border)]'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  <input
                    className="field-input w-24"
                    value={form.buttonColor}
                    onChange={(e) => setForm({ ...form, buttonColor: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isOpenPrice}
                    onChange={(e) => setForm({ ...form, isOpenPrice: e.target.checked })}
                  />
                  Open price item
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.soldByWeight}
                    onChange={(e) => setForm({ ...form, soldByWeight: e.target.checked })}
                  />
                  Weighing product
                </label>
              </div>

              <div className="rounded-md border border-[var(--border)] p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Sizes</h3>
                    <p className="text-[11px] muted">e.g. Small / Regular / Large — each with its own price</p>
                  </div>
                  <button
                    type="button"
                    className="btn-primary !py-1 !text-xs"
                    onClick={() =>
                      setForm({
                        ...form,
                        specifications: [
                          ...form.specifications,
                          {
                            id: `size-${Date.now()}`,
                            name: '',
                            price: Number(form.price) || 0,
                            saleStatus: 'in_stock',
                            isDefault: false,
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={14} /> Size
                  </button>
                </div>
                <div className="space-y-2">
                  {form.specifications.map((spec, idx) => (
                    <div
                      key={spec.id || idx}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_6.5rem_7rem_auto_auto] gap-1.5 items-center"
                    >
                      <input
                        className="field-input"
                        placeholder="Size name (Small, Large…)"
                        value={spec.name}
                        onChange={(e) => {
                          const next = [...form.specifications];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setForm({ ...form, specifications: next });
                        }}
                      />
                      <div className="relative">
                        <input
                          className="field-input pr-10"
                          type="number"
                          step="0.01"
                          value={spec.price}
                          onChange={(e) => {
                            const next = [...form.specifications];
                            next[idx] = { ...next[idx], price: Number(e.target.value) || 0 };
                            setForm({ ...form, specifications: next, price: e.target.value });
                          }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] muted">
                          CHF
                        </span>
                      </div>
                      <select
                        className="field-input"
                        value={spec.saleStatus}
                        onChange={(e) => {
                          const next = [...form.specifications];
                          next[idx] = {
                            ...next[idx],
                            saleStatus: e.target.value as SpecRow['saleStatus'],
                          };
                          setForm({ ...form, specifications: next });
                        }}
                      >
                        <option value="in_stock">In stock</option>
                        <option value="out_of_stock">Out of stock</option>
                      </select>
                      <label className="inline-flex items-center gap-1 text-[11px] muted">
                        <input
                          type="radio"
                          name="defaultSpec"
                          checked={spec.isDefault}
                          onChange={() =>
                            setForm({
                              ...form,
                              specifications: form.specifications.map((s, i) => ({
                                ...s,
                                isDefault: i === idx,
                              })),
                              price: String(spec.price),
                            })
                          }
                        />
                        Default
                      </label>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-[var(--danger)] hover:bg-[var(--bg-muted)] justify-self-start sm:justify-self-auto"
                        onClick={() =>
                          setForm({
                            ...form,
                            specifications:
                              form.specifications.length > 1
                                ? form.specifications.filter((_, i) => i !== idx)
                                : form.specifications,
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-[var(--border)] p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Modifiers / Add-ons</h3>
                    <p className="text-[11px] muted mt-0.5">
                      Link groups from Modifiers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModifierPickerOpen(true)}
                    className="btn-primary !py-1 !text-xs"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
                <div className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
                  {linkedModifierGroups.length === 0 && (
                    <p className="px-3 py-4 text-center text-xs muted">
                      No modifiers linked yet.
                    </p>
                  )}
                  {linkedModifierGroups.map((g) => (
                    <div key={g.id} className="flex items-center justify-between px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{g.title}</p>
                        <p className="text-[11px] muted truncate">
                          {(g.options || []).map((o) => o.name).join(' · ') || 'No options'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-[var(--danger)] hover:bg-[var(--bg-muted)]"
                        onClick={() =>
                          setForm({
                            ...form,
                            modifierGroupIds: form.modifierGroupIds.filter((id) => id !== g.id),
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1 sticky bottom-0 bg-[var(--bg-elevated)] pb-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary flex-1"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? 'Saving…' : editingId ? t('save') : 'Create product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modifierPickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-t-lg sm:rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h3 className="text-sm font-semibold">Add modifiers</h3>
              <button
                type="button"
                onClick={() => setModifierPickerOpen(false)}
                className="rounded-md p-1.5 hover:bg-[var(--bg-muted)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border)]">
              {allModifierGroups.filter((g) => !form.modifierGroupIds.includes(g.id)).length === 0 && (
                <p className="p-6 text-center text-xs muted">
                  No more groups available. Create one under Modifiers.
                </p>
              )}
              {allModifierGroups
                .filter((g) => !form.modifierGroupIds.includes(g.id))
                .map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-[var(--bg-muted)]"
                    onClick={() =>
                      setForm({
                        ...form,
                        modifierGroupIds: [...form.modifierGroupIds, g.id],
                      })
                    }
                  >
                    <span>
                      <span className="block text-sm font-medium">{g.title}</span>
                      <span className="text-[11px] muted">
                        {g.selectionType || 'optional'} · {(g.options || []).length} options
                      </span>
                    </span>
                    <Plus size={14} className="muted" />
                  </button>
                ))}
            </div>
            <div className="flex justify-end border-t border-[var(--border)] px-4 py-3">
              <button
                type="button"
                onClick={() => setModifierPickerOpen(false)}
                className="btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .field-input {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid var(--border);
          padding: 0.4rem 0.625rem;
          font-size: 0.8125rem;
          background: var(--bg-elevated);
          color: var(--text);
        }
        .field-input:focus {
          outline: none;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 40%, transparent);
          border-color: var(--ring);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide muted">{label}</span>
      {children}
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-2">
      <p className="text-[11px] muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold truncate">{value}</p>
    </div>
  );
}
