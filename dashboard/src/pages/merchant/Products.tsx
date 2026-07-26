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
  specifications: [{ id: 'default', name: 'Default', price: 0, saleStatus: 'in_stock', isDefault: true }],
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
      <div className="flex items-center justify-center py-20 text-slate-500">
        Loading products…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('products')}</h1>
          <p className="text-slate-600 mt-1">
            Live catalog — categories, extras, bulk tiers, Excel import
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void downloadTemplate()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download size={18} />
            Template
          </button>
          <button
            type="button"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FileSpreadsheet size={18} />
            {importing ? 'Importing…' : 'Import Excel'}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus size={18} />
            Add Product
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, SKU, category…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
          Categories
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`rounded-xl border p-4 text-left transition ${
              selectedCategory === null
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="text-xs opacity-80">All</div>
            <div className="mt-1 text-2xl font-bold">{products.length}</div>
          </button>
          {categories.map((cat, idx) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-xl border p-4 text-left transition ${
                selectedCategory === cat.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : `${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} hover:opacity-90`
              }`}
            >
              <div className="text-xs opacity-80 truncate">{cat.name}</div>
              <div className="mt-1 text-2xl font-bold">{categoryCounts.get(cat.id) || 0}</div>
            </button>
          ))}
          {(categoryCounts.get('__none__') || 0) > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory('__none__')}
              className={`rounded-xl border p-4 text-left transition ${
                selectedCategory === '__none__'
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="text-xs opacity-80">Uncategorized</div>
              <div className="mt-1 text-2xl font-bold">{categoryCounts.get('__none__') || 0}</div>
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        {filteredProducts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <Package className="mx-auto text-slate-300" size={40} />
            <p className="mt-3 font-semibold text-slate-800">No products found</p>
            <p className="text-sm text-slate-500 mt-1">Create one or import an Excel catalog.</p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus size={16} />
              Add Product
            </button>
          </div>
        )}

        {filteredProducts.map((product) => {
          const extras = product.extras || [];
          const tiers = product.bulkPricing || [];
          const expanded = expandedProduct === product.id;
          const stockOk = product.stock > 20;

          return (
            <article
              key={product.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-stretch gap-2 p-4 md:p-5">
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
                <div className="border-t border-slate-100 bg-slate-50 p-5 space-y-5">
                  {tiers.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-slate-900">Bulk pricing tiers</h4>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {tiers.map((tier, idx) => (
                          <div
                            key={`${product.id}-tier-${idx}`}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                          >
                            <span className="text-slate-700">From {tier.minQty} units</span>
                            <span className="font-semibold text-slate-900">{money(tier.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {extras.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-slate-900">Add-ons (extras)</h4>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {extras.map((extra) => (
                          <div
                            key={extra.id}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                          >
                            <span className="text-slate-700">{extra.name}</span>
                            <span className="font-semibold text-slate-900">+{money(extra.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!tiers.length && !extras.length && (
                    <p className="text-sm text-slate-500">No extras or bulk tiers configured.</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">
                {editingId ? 'Edit product' : 'Add product'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4 px-6 py-5">
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
                  className="field-input min-h-[80px]"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Button color
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {BUTTON_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm({ ...form, buttonColor: color })}
                      className={`h-8 w-8 rounded-full border-2 ${
                        form.buttonColor === color ? 'border-slate-900' : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  <input
                    className="field-input w-28"
                    value={form.buttonColor}
                    onChange={(e) => setForm({ ...form, buttonColor: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-5 text-sm">
                <label className="inline-flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isOpenPrice}
                    onChange={(e) => setForm({ ...form, isOpenPrice: e.target.checked })}
                  />
                  Open price item
                </label>
                <label className="inline-flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.soldByWeight}
                    onChange={(e) => setForm({ ...form, soldByWeight: e.target.checked })}
                  />
                  Weighing product
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Price / Specifications</h3>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700"
                    onClick={() =>
                      setForm({
                        ...form,
                        specifications: [
                          ...form.specifications,
                          {
                            id: `spec-${Date.now()}`,
                            name: '',
                            price: Number(form.price) || 0,
                            saleStatus: 'in_stock',
                            isDefault: false,
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={16} /> Specification
                  </button>
                </div>
                <div className="space-y-2">
                  {form.specifications.map((spec, idx) => (
                    <div
                      key={spec.id || idx}
                      className="grid grid-cols-[1fr_8rem_8rem_auto_auto] gap-2 items-center"
                    >
                      <input
                        className="field-input"
                        placeholder="Item name"
                        value={spec.name}
                        onChange={(e) => {
                          const next = [...form.specifications];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setForm({ ...form, specifications: next });
                        }}
                      />
                      <div className="relative">
                        <input
                          className="field-input pr-12"
                          type="number"
                          step="0.01"
                          value={spec.price}
                          onChange={(e) => {
                            const next = [...form.specifications];
                            next[idx] = { ...next[idx], price: Number(e.target.value) || 0 };
                            setForm({ ...form, specifications: next, price: e.target.value });
                          }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
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
                      <label className="inline-flex items-center gap-1 text-xs text-slate-600">
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
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
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
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">Modifiers / Add-ons</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Link groups created under Modifiers. Manage options there.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModifierPickerOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700"
                  >
                    <Plus size={16} /> Add modifiers
                  </button>
                </div>
                <div className="divide-y rounded-lg border border-slate-200">
                  {linkedModifierGroups.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-slate-400">
                      No modifiers linked yet.
                    </p>
                  )}
                  {linkedModifierGroups.map((g) => (
                    <div key={g.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-800">{g.title}</p>
                        <p className="text-xs text-slate-500">
                          {(g.options || []).map((o) => o.name).join(' · ') || 'No options'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                        onClick={() =>
                          setForm({
                            ...form,
                            modifierGroupIds: form.modifierGroupIds.filter((id) => id !== g.id),
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingId ? t('save') : 'Create product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modifierPickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="font-bold text-slate-900">Add modifiers</h3>
              <button
                type="button"
                onClick={() => setModifierPickerOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y">
              {allModifierGroups.filter((g) => !form.modifierGroupIds.includes(g.id)).length === 0 && (
                <p className="p-8 text-center text-sm text-slate-400">
                  No more groups available. Create one under Modifiers.
                </p>
              )}
              {allModifierGroups
                .filter((g) => !form.modifierGroupIds.includes(g.id))
                .map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-slate-50"
                    onClick={() =>
                      setForm({
                        ...form,
                        modifierGroupIds: [...form.modifierGroupIds, g.id],
                      })
                    }
                  >
                    <span>
                      <span className="block font-medium text-slate-800">{g.title}</span>
                      <span className="text-xs text-slate-500">
                        {g.selectionType || 'optional'} · {(g.options || []).length} options
                      </span>
                    </span>
                    <Plus size={16} className="text-teal-600" />
                  </button>
                ))}
            </div>
            <div className="flex justify-end border-t px-5 py-4">
              <button
                type="button"
                onClick={() => setModifierPickerOpen(false)}
                className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white"
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
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          background: #fff;
        }
        .field-input:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
          border-color: #94a3b8;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900 truncate">{value}</p>
    </div>
  );
}
