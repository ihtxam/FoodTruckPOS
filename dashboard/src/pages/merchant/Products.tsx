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
import { DragHandle, SortableContainer, SortableRow } from '@/components/SortableList';

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

interface ComboOptionForm {
  productId: string;
  extraPrice: number;
}

interface ComboSlotForm {
  id: string;
  name: string;
  minPick: number;
  maxPick: number;
  options: ComboOptionForm[];
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
  loyaltyRewardPoints?: number | null;
  sortOrder?: number;
  modifierGroups?: ModifierGroupSummary[];
  comboItems?: Array<{
    id?: string;
    name?: string;
    minPick?: number;
    maxPick?: number;
    options?: Array<{ productId: string; extraPrice?: number }>;
    productId?: string;
    quantity?: number;
  }>;
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
  imageUrl: string;
  isOpenPrice: boolean;
  soldByWeight: boolean;
  isCombo: boolean;
  comboSlots: ComboSlotForm[];
  specifications: SpecRow[];
  modifierGroupIds: string[];
  /** Empty = not a free reward; otherwise points cost ≥ 1 */
  loyaltyRewardPoints: string;
};

const emptySlot = (name = 'Main'): ComboSlotForm => ({
  id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name,
  minPick: 1,
  maxPick: 1,
  options: [],
});

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  price: '',
  stock: '0',
  sku: '',
  categoryId: '',
  buttonColor: '#0f172a',
  imageUrl: '',
  isOpenPrice: false,
  soldByWeight: false,
  isCombo: false,
  comboSlots: [],
  specifications: [{ id: 'default', name: 'Regular', price: 0, saleStatus: 'in_stock', isDefault: true }],
  modifierGroupIds: [],
  loyaltyRewardPoints: '',
});

function normalizeComboSlotsFromProduct(raw: Product['comboItems']): ComboSlotForm[] {
  if (!Array.isArray(raw) || !raw.length) return [];
  return raw
    .map((row, idx) => {
      if (Array.isArray(row.options) && row.options.length) {
        return {
          id: row.id || `slot-${idx + 1}`,
          name: row.name || `Choice ${idx + 1}`,
          minPick: Math.max(1, Number(row.minPick) || 1),
          maxPick: Math.max(1, Number(row.maxPick) || 1),
          options: row.options
            .filter((o) => o?.productId)
            .map((o) => ({
              productId: o.productId,
              extraPrice: Math.max(0, Number(o.extraPrice) || 0),
            })),
        };
      }
      if (row.productId) {
        return {
          id: row.id || `legacy-${row.productId}-${idx}`,
          name: row.name || `Item ${idx + 1}`,
          minPick: 1,
          maxPick: 1,
          options: [{ productId: row.productId, extraPrice: 0 }],
        };
      }
      return null;
    })
    .filter(Boolean) as ComboSlotForm[];
}

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

const SKU_MAX_LEN = 100; // matches DB varchar(100)
const MAX_MONEY_DIGITS = 10;
const MAX_POINTS = 2_147_483_647; // PG integer max

/** Digits only (ignore decimal point/sign) for length checks. */
const digitCount = (raw: string) => raw.replace(/[^\d]/g, '').length;

const clampNonNegativeInt = (raw: string) => {
  if (raw.trim() === '' || raw === '-') return raw;
  const n = Number(raw);
  if (!Number.isFinite(n)) return '0';
  return String(Math.max(0, Math.floor(n)));
};

type ProductTypeUi = 'standard' | 'combo' | 'open_price' | 'weighed';

const productTypeLabel = (product: Product) => {
  if (product.productType === 'combo' || (product.comboItems && product.comboItems.length)) return 'Combo';
  if (product.soldByWeight) return 'Weighed';
  if (product.isOpenPrice) return 'Open price';
  return product.productType === 'standard' || !product.productType ? 'Standard' : product.productType;
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
  const [reordering, setReordering] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);

  const onUploadProductImage = async (file: File | null) => {
    if (!file) return;
    setImageUploading(true);
    try {
      const { compressImageIfNeeded } = await import('@/lib/compress-image');
      const compressed = await compressImageIfNeeded(file, {
        maxBytes: 350 * 1024,
        targetBytes: 350 * 1024,
        maxWidth: 1200,
      });
      const fd = new FormData();
      fd.append('file', compressed);
      const res = await api.post('/merchant/media', fd);
      setForm((prev) => ({ ...prev, imageUrl: res.data.url || '' }));
      toast.success('Image uploaded');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Upload failed');
    } finally {
      setImageUploading(false);
      if (imageFileRef.current) imageFileRef.current.value = '';
    }
  };

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

  const persistProductOrder = async (next: Product[]) => {
    const prev = products;
    setProducts(next);
    setReordering(true);
    try {
      const res = await api.put('/merchant/products/reorder', {
        orderedIds: next.map((p) => p.id),
      });
      if (res.data.products?.length) {
        setProducts(res.data.products);
      }
    } catch (error: any) {
      setProducts(prev);
      toast.error(error.response?.data?.error || 'Failed to save product order');
    } finally {
      setReordering(false);
    }
  };

  const onReorderFiltered = (nextFiltered: Product[]) => {
    const filteredIds = new Set(nextFiltered.map((p) => p.id));
    let i = 0;
    const merged = products.map((p) => (filteredIds.has(p.id) ? nextFiltered[i++] : p));
    void persistProductOrder(merged);
  };

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
      const comboSlots = normalizeComboSlotsFromProduct(full.comboItems);
      setForm({
        name: full.name,
        description: full.description || '',
        price: String(full.price ?? ''),
        stock: String(full.stock ?? 0),
        sku: full.sku || '',
        categoryId: full.categoryId || '',
        buttonColor: full.buttonColor || '#0f172a',
        imageUrl: full.imageUrl || '',
        isOpenPrice: !!full.isOpenPrice,
        soldByWeight: !!full.soldByWeight,
        isCombo: full.productType === 'combo' || comboSlots.length > 0,
        comboSlots,
        specifications: specs as SpecRow[],
        modifierGroupIds: (full.modifierGroups || []).map((g) => g.id),
        loyaltyRewardPoints:
          full.loyaltyRewardPoints != null && Number(full.loyaltyRewardPoints) >= 1
            ? String(full.loyaltyRewardPoints)
            : '',
      });
    } catch {
      const comboSlots = normalizeComboSlotsFromProduct(product.comboItems);
      setForm({
        name: product.name,
        description: product.description || '',
        price: String(product.price ?? ''),
        stock: String(product.stock ?? 0),
        sku: product.sku || '',
        categoryId: product.categoryId || '',
        buttonColor: product.buttonColor || '#0f172a',
        imageUrl: product.imageUrl || '',
        isOpenPrice: !!product.isOpenPrice,
        soldByWeight: !!product.soldByWeight,
        isCombo: product.productType === 'combo' || comboSlots.length > 0,
        comboSlots,
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
        loyaltyRewardPoints:
          product.loyaltyRewardPoints != null && Number(product.loyaltyRewardPoints) >= 1
            ? String(product.loyaltyRewardPoints)
            : '',
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
    const comboSlots = form.isCombo
      ? form.comboSlots
          .filter((s) => s.name.trim() && s.options.length > 0)
          .map((s) => ({
            id: s.id,
            name: s.name.trim(),
            minPick: Math.max(1, Number(s.minPick) || 1),
            maxPick: Math.max(1, Number(s.maxPick) || 1),
            options: s.options.map((o) => ({
              productId: o.productId,
              extraPrice: Math.max(0, Number(o.extraPrice) || 0),
            })),
          }))
      : [];
    const productType = form.isCombo
      ? 'combo'
      : form.soldByWeight
        ? 'weighed'
        : form.isOpenPrice
          ? 'open_price'
          : 'standard';
    return {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price,
      stock: Math.max(0, Math.floor(Number(form.stock) || 0)),
      sku: form.sku.trim() || undefined,
      categoryId: form.categoryId || undefined,
      buttonColor: form.buttonColor || undefined,
      imageUrl: form.imageUrl.trim() || null,
      isOpenPrice: form.isCombo ? false : form.isOpenPrice,
      soldByWeight: form.isCombo ? false : form.soldByWeight,
      productType,
      comboItems: comboSlots,
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
      loyaltyRewardPoints: (() => {
        const raw = form.loyaltyRewardPoints.trim();
        if (!raw) return null;
        const n = Math.floor(Number(raw));
        return Number.isFinite(n) && n >= 1 ? n : null;
      })(),
    };
  };

  const formProductType: ProductTypeUi = form.isCombo
    ? 'combo'
    : form.soldByWeight
      ? 'weighed'
      : form.isOpenPrice
        ? 'open_price'
        : 'standard';

  const setProductType = (next: ProductTypeUi) => {
    setForm({
      ...form,
      isCombo: next === 'combo',
      isOpenPrice: next === 'open_price',
      soldByWeight: next === 'weighed',
      comboSlots:
        next === 'combo' && form.comboSlots.length === 0
          ? [emptySlot('Main'), emptySlot('Side'), emptySlot('Drink')]
          : form.comboSlots,
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!form.categoryId) {
      toast.error(t('selectCategory'));
      return;
    }
    if (form.sku.trim().length > SKU_MAX_LEN) {
      toast.error(`Product code / SKU must be at most ${SKU_MAX_LEN} characters`);
      return;
    }
    const pointsRaw = form.loyaltyRewardPoints.trim();
    if (pointsRaw) {
      if (digitCount(pointsRaw) > MAX_MONEY_DIGITS) {
        toast.error('Free points must be at most 10 digits');
        return;
      }
      const points = Math.floor(Number(pointsRaw));
      if (!Number.isFinite(points) || points < 1 || points > MAX_POINTS) {
        toast.error('Free points must be a whole number between 1 and 2147483647');
        return;
      }
    }
    const stockNum = Number(form.stock);
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      toast.error('Stock cannot be negative');
      return;
    }
    for (const spec of form.specifications) {
      if (digitCount(String(spec.price)) > MAX_MONEY_DIGITS) {
        toast.error('Price must be at most 10 digits');
        return;
      }
    }
    if (form.price && digitCount(form.price) > MAX_MONEY_DIGITS) {
      toast.error('Price must be at most 10 digits');
      return;
    }
    if (form.isCombo) {
      const validSlots = form.comboSlots.filter((s) => s.name.trim() && s.options.length > 0);
      if (!validSlots.length) {
        toast.error('Add at least one combo step with products');
        return;
      }
    } else if (!form.isOpenPrice) {
      const namedSizes = form.specifications.filter((s) => s.name.trim());
      if (!namedSizes.length) {
        toast.error('Add at least one size with a name');
        return;
      }
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
      a.download = 'chaslayreborn-catalog-template.xlsx';
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
      if (r.errors?.length) toast.error(`${r.errors.length} row error(s) - check file`);
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
              <div className="text-[10px] opacity-80">{t('uncategorized')}</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums">{categoryCounts.get('__none__') || 0}</div>
            </button>
          )}
        </div>
      </section>

      <section className="space-y-2">
        {filteredProducts.length === 0 && (
          <div className="card border-dashed px-4 py-10 text-center">
            <Package className="mx-auto muted" size={28} />
            <p className="mt-2 text-sm font-semibold">{t('noProductsFound')}</p>
            <p className="text-xs muted mt-1">{t('createOrImport')}</p>
            <button
              type="button"
              onClick={openCreate}
              className="btn-primary mt-3"
            >
              <Plus size={14} />
              {t('addProduct')}
            </button>
          </div>
        )}

        <SortableContainer
          as="div"
          className="space-y-2"
          items={filteredProducts}
          onReorder={onReorderFiltered}
          disabled={reordering}
        >
          {filteredProducts.map((product) => {
          const extras = product.extras || [];
          const tiers = product.bulkPricing || [];
          const sizes = product.specifications || [];
          const expanded = expandedProduct === product.id;
          const stockOk = product.stock > 20;

          return (
            <SortableRow
              key={product.id}
              id={product.id}
              as="div"
              className="overflow-hidden card !p-0"
              disabled={reordering}
            >
              {({ attributes, listeners }) => (
              <>
              <div className="flex items-stretch gap-2 p-3">
                <div className="flex items-center shrink-0">
                  <DragHandle attributes={attributes} listeners={listeners} />
                </div>
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
                      {product.loyaltyRewardPoints != null &&
                        Number(product.loyaltyRewardPoints) >= 1 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                            {product.loyaltyRewardPoints} pts free
                          </span>
                        )}
                    </div>
                    {product.description && (
                      <p className="mt-0.5 text-sm text-slate-500 line-clamp-1">{product.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="font-semibold text-emerald-700">{money(product.price)}</span>
                      <span className="text-slate-500">SKU: {product.sku || '-'}</span>
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
                    <InfoCard label={t('category')} value={categoryName(product.categoryId)} />
                    <InfoCard label={t('type')} value={productTypeLabel(product)} />
                    <InfoCard label={t('productCode')} value={product.sku || '-'} />
                    <InfoCard label={t('stock')} value={`${product.stock} units`} />
                    <InfoCard label={t('barcode')} value={product.barcode || '-'} />
                  </div>
                </div>
              )}
              </>
              )}
            </SortableRow>
          );
        })}
        </SortableContainer>
      </section>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-3"
          onClick={closeModal}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeModal();
          }}
          role="presentation"
        >
          <div
            className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-lg sm:rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
              <h2 className="text-base font-semibold">
                {editingId ? t('editProduct') : t('addProduct')}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md muted hover:bg-[var(--bg-muted)]"
                aria-label={t('close')}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3 px-4 py-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={`${t('productName')} *`}>
                  <input
                    className="field-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </Field>
                <Field label={`${t('category')} *`}>
                  <select
                    className="field-input"
                    value={form.categoryId}
                    required
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  >
                    <option value="">{t('selectCategory')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('type')}>
                  <select
                    className="field-input"
                    value={formProductType}
                    onChange={(e) => setProductType(e.target.value as ProductTypeUi)}
                  >
                    <option value="standard">Standard</option>
                    <option value="combo">{t('comboMeal')}</option>
                    <option value="open_price">{t('openPriceItem')}</option>
                    <option value="weighed">{t('weighingProduct')}</option>
                  </select>
                </Field>
                <Field label={t('productCode')}>
                  <input
                    className="field-input"
                    placeholder="For quick search when ordering"
                    value={form.sku}
                    maxLength={SKU_MAX_LEN}
                    onChange={(e) =>
                      setForm({ ...form, sku: e.target.value.slice(0, SKU_MAX_LEN) })
                    }
                  />
                  <p className="mt-1 text-xs muted">Max {SKU_MAX_LEN} characters</p>
                </Field>
                <Field label="Stock">
                  <input
                    className="field-input"
                    type="number"
                    min={0}
                    step={1}
                    value={form.stock}
                    onChange={(e) =>
                      setForm({ ...form, stock: clampNonNegativeInt(e.target.value) })
                    }
                  />
                </Field>
              </div>

              <Field label={t('description')}>
                <textarea
                  className="field-input min-h-[64px]"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>

              <Field label="Product photo">
                <div className="flex flex-wrap items-center gap-3">
                  {form.imageUrl ? (
                    <img
                      src={form.imageUrl}
                      alt=""
                      className="h-16 w-16 rounded-md object-cover border border-[var(--border)]"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-[var(--border)] text-xs muted">
                      -
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      disabled={imageUploading}
                      onClick={() => imageFileRef.current?.click()}
                    >
                      {imageUploading ? 'Uploading…' : form.imageUrl ? 'Replace photo' : 'Upload photo'}
                    </button>
                    {form.imageUrl ? (
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        onClick={() => setForm({ ...form, imageUrl: '' })}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={imageFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onUploadProductImage(e.target.files?.[0] || null)}
                  />
                </div>
                <p className="mt-1 text-xs muted">Compressed to ≤350 KB for the online shop.</p>
              </Field>

              <Field label="Free with points (optional)">
                <input
                  className="field-input"
                  type="number"
                  min="1"
                  max={MAX_POINTS}
                  step="1"
                  placeholder="e.g. 200 - leave empty for none"
                  value={form.loyaltyRewardPoints}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v && digitCount(v) > MAX_MONEY_DIGITS) return;
                    setForm({ ...form, loyaltyRewardPoints: v });
                  }}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Customers with at least this many points can add the product free (pays with points). Max 10 digits.
                </p>
              </Field>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide muted">
                  
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

              {form.isCombo && (
                <div className="rounded-md border border-[var(--border)] p-3 space-y-3">
                  <Field label={`${t('salePrice')} (combo)`}>
                    <div className="relative max-w-xs">
                      <input
                        className="field-input money-input pr-14"
                        type="number"
                        step="0.05"
                        min="0"
                        value={form.price}
                        onChange={(e) => {
                          const price = e.target.value;
                          if (digitCount(price) > MAX_MONEY_DIGITS) return;
                          setForm({
                            ...form,
                            price,
                            specifications: form.specifications.map((s, i) =>
                              i === 0 || s.isDefault ? { ...s, price: Number(price) || 0 } : s
                            ),
                          });
                        }}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold muted">
                        CHF
                      </span>
                    </div>
                  </Field>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">{t('comboSteps')}</h3>
                      <p className="text-[11px] muted mt-0.5">{t('comboStepsHint')}</p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary !py-1 !text-xs"
                      onClick={() =>
                        setForm({
                          ...form,
                          comboSlots: [...form.comboSlots, emptySlot(`Choice ${form.comboSlots.length + 1}`)],
                        })
                      }
                    >
                      <Plus size={14} /> {t('addStep')}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {form.comboSlots.map((slot, slotIdx) => (
                      <div key={slot.id} className="rounded-md border border-[var(--border)] p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold muted w-14 shrink-0">
                            #{slotIdx + 1}
                          </span>
                          <input
                            className="field-input"
                            placeholder={t('stepName')}
                            value={slot.name}
                            onChange={(e) => {
                              const next = [...form.comboSlots];
                              next[slotIdx] = { ...next[slotIdx], name: e.target.value };
                              setForm({ ...form, comboSlots: next });
                            }}
                          />
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-[var(--danger)] hover:bg-[var(--bg-muted)]"
                            onClick={() =>
                              setForm({
                                ...form,
                                comboSlots: form.comboSlots.filter((_, i) => i !== slotIdx),
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {slot.options.map((opt, optIdx) => {
                            const prod = products.find((p) => p.id === opt.productId);
                            return (
                              <div
                                key={`${slot.id}-${opt.productId}-${optIdx}`}
                                className="grid grid-cols-[1fr_5.5rem_auto] gap-1.5 items-center"
                              >
                                <div className="text-sm truncate px-2 py-1.5 rounded-md bg-[var(--bg-muted)]">
                                  {prod?.name || opt.productId}
                                </div>
                                <div className="relative">
                                  <input
                                    className="field-input money-input pr-8"
                                    type="number"
                                    step="0.05"
                                    min="0"
                                    title={t('extraPrice')}
                                    value={opt.extraPrice}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      if (digitCount(raw) > MAX_MONEY_DIGITS) return;
                                      const next = [...form.comboSlots];
                                      const options = [...next[slotIdx].options];
                                      options[optIdx] = {
                                        ...options[optIdx],
                                        extraPrice: Number(raw) || 0,
                                      };
                                      next[slotIdx] = { ...next[slotIdx], options };
                                      setForm({ ...form, comboSlots: next });
                                    }}
                                  />
                                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] muted">
                                    +
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="rounded-md p-1.5 text-[var(--danger)] hover:bg-[var(--bg-muted)]"
                                  onClick={() => {
                                    const next = [...form.comboSlots];
                                    next[slotIdx] = {
                                      ...next[slotIdx],
                                      options: next[slotIdx].options.filter((_, i) => i !== optIdx),
                                    };
                                    setForm({ ...form, comboSlots: next });
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        <select
                          className="field-input text-sm"
                          value=""
                          onChange={(e) => {
                            const productId = e.target.value;
                            if (!productId) return;
                            if (slot.options.some((o) => o.productId === productId)) return;
                            const next = [...form.comboSlots];
                            next[slotIdx] = {
                              ...next[slotIdx],
                              options: [...next[slotIdx].options, { productId, extraPrice: 0 }],
                            };
                            setForm({ ...form, comboSlots: next });
                          }}
                        >
                          <option value="">{t('addProductToStep')}</option>
                          {products
                            .filter(
                              (p) =>
                                p.id !== editingId &&
                                p.productType !== 'combo' &&
                                !slot.options.some((o) => o.productId === p.id)
                            )
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} · {money(p.price)}
                              </option>
                            ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!form.isCombo && (
              <div className="rounded-md border border-[var(--border)] p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{t('sizes')}</h3>
                    <p className="text-[11px] muted">{t('sizesHint')}</p>
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
                        placeholder={t('sizeName')}
                        value={spec.name}
                        onChange={(e) => {
                          const next = [...form.specifications];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setForm({ ...form, specifications: next });
                        }}
                      />
                      <div className="relative">
                        <input
                          className="field-input money-input pr-14"
                          type="number"
                          step="0.01"
                          min="0"
                          value={spec.price}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (digitCount(raw) > MAX_MONEY_DIGITS) return;
                            const next = [...form.specifications];
                            next[idx] = { ...next[idx], price: Number(raw) || 0 };
                            setForm({ ...form, specifications: next, price: raw });
                          }}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold muted">
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
                        <option value="in_stock">{t('inStock')}</option>
                        <option value="out_of_stock">{t('outOfStock')}</option>
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
                        {t('default')}
                      </label>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-[var(--danger)] hover:bg-[var(--bg-muted)] justify-self-start sm:justify-self-auto"
                        onClick={() => {
                          const remaining = form.specifications.filter((_, i) => i !== idx);
                          if (!remaining.length) {
                            // Allow removing the last size row (esp. open-price); keep a blank default for standard.
                            setForm({
                              ...form,
                              specifications: form.isOpenPrice
                                ? []
                                : [
                                    {
                                      id: `size-${Date.now()}`,
                                      name: '',
                                      price: Number(form.price) || 0,
                                      saleStatus: 'in_stock',
                                      isDefault: true,
                                    },
                                  ],
                            });
                            return;
                          }
                          if (!remaining.some((s) => s.isDefault)) {
                            remaining[0] = { ...remaining[0], isDefault: true };
                          }
                          setForm({ ...form, specifications: remaining });
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              )}

              <div className="rounded-md border border-[var(--border)] p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {form.isCombo ? t('comboExtrasOptional') : t('modifiersAddons')}
                    </h3>
                    <p className="text-[11px] muted mt-0.5">
                      {form.isCombo ? t('comboExtrasHint') : t('modifiersHint')}
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
                      {t('noModifiersLinked')}
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
                  {saving ? t('saving') : editingId ? t('save') : t('createProduct')}
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
              <h3 className="text-sm font-semibold">{t('addModifiers')}</h3>
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
        .money-input {
          -moz-appearance: textfield;
        }
        .money-input::-webkit-outer-spin-button,
        .money-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
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
