import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type PricingType = 'free' | 'fixed' | 'toppings_by_size';
type SelectionType = 'optional' | 'required';
type SaleStatus = 'in_stock' | 'out_of_stock';

interface ModifierOption {
  id?: string;
  name: string;
  price: number;
  saleStatus: SaleStatus;
  isDefault: boolean;
  sortOrder?: number;
}

interface LinkedProduct {
  id: string;
  name: string;
  categoryName?: string | null;
}

interface ModifierGroup {
  id: string;
  title: string;
  pricingType: PricingType;
  selectionType: SelectionType;
  minSelectable: number;
  maxSelectable: number;
  defaultCollapsed: boolean;
  allowMultipleSameItem: boolean;
  options: ModifierOption[];
  products: LinkedProduct[];
  productIds: string[];
}

interface ProductOption {
  id: string;
  name: string;
  categoryId?: string | null;
  category?: { name?: string } | null;
}

type FormState = {
  title: string;
  pricingType: PricingType;
  selectionType: SelectionType;
  minSelectable: number;
  maxSelectable: number;
  defaultCollapsed: boolean;
  allowMultipleSameItem: boolean;
  options: ModifierOption[];
  productIds: string[];
};

const emptyOption = (): ModifierOption => ({
  name: '',
  price: 0,
  saleStatus: 'in_stock',
  isDefault: false,
});

const emptyForm = (): FormState => ({
  title: '',
  pricingType: 'free',
  selectionType: 'optional',
  minSelectable: 0,
  maxSelectable: 1,
  defaultCollapsed: false,
  allowMultipleSameItem: false,
  options: [emptyOption()],
  productIds: [],
});

export default function Modifiers() {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [otherOpen, setOtherOpen] = useState(true);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const load = async () => {
    try {
      const [g, p] = await Promise.all([
        api.get('/merchant/modifiers'),
        api.get('/merchant/products?limit=500'),
      ]);
      setGroups(g.data.groups || []);
      setProducts(p.data.products || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load modifiers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.options.some((o) => o.name.toLowerCase().includes(q)) ||
        g.products.some((p) => p.name.toLowerCase().includes(q))
    );
  }, [groups, search]);

  const linkedProducts = useMemo(
    () => products.filter((p) => form.productIds.includes(p.id)),
    [products, form.productIds]
  );

  const pickerProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (form.productIds.includes(p.id)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.category?.name || '').toLowerCase().includes(q)
      );
    });
  }, [products, form.productIds, productSearch]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setOtherOpen(true);
    setEditorOpen(true);
  };

  const openEdit = (group: ModifierGroup) => {
    setEditingId(group.id);
    setForm({
      title: group.title,
      pricingType: group.pricingType,
      selectionType: group.selectionType,
      minSelectable: group.minSelectable,
      maxSelectable: group.maxSelectable,
      defaultCollapsed: group.defaultCollapsed,
      allowMultipleSameItem: group.allowMultipleSameItem,
      options: group.options.length
        ? group.options.map((o) => ({ ...o }))
        : [emptyOption()],
      productIds: [...(group.productIds || [])],
    });
    setOtherOpen(true);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    setProductPickerOpen(false);
  };

  const setSelectionType = (selectionType: SelectionType) => {
    setForm((f) => ({
      ...f,
      selectionType,
      minSelectable: selectionType === 'required' ? Math.max(1, f.minSelectable || 1) : 0,
      maxSelectable: Math.max(
        selectionType === 'required' ? 1 : 0,
        f.maxSelectable || 1
      ),
    }));
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    const options = form.options
      .map((o, idx) => ({
        ...o,
        name: o.name.trim(),
        price: form.pricingType === 'free' ? 0 : Number(o.price) || 0,
        sortOrder: idx,
      }))
      .filter((o) => o.name);

    if (!options.length) {
      toast.error('Add at least one option');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        pricingType: form.pricingType,
        selectionType: form.selectionType,
        minSelectable: form.selectionType === 'required' ? form.minSelectable : 0,
        maxSelectable: form.maxSelectable,
        defaultCollapsed: form.defaultCollapsed,
        allowMultipleSameItem: form.allowMultipleSameItem,
        options,
        productIds: form.productIds,
      };
      if (editingId) {
        await api.put(`/merchant/modifiers/${editingId}`, payload);
        toast.success('Modifier group updated');
      } else {
        await api.post('/merchant/modifiers', payload);
        toast.success('Modifier group created');
      }
      closeEditor();
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this modifier group?')) return;
    try {
      await api.delete(`/merchant/modifiers/${id}`);
      toast.success('Deleted');
      if (editingId === id) closeEditor();
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-slate-500">Loading modifiers…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Modifiers / Add-ons</h1>
          <p className="text-slate-600 mt-1">
            Create option groups and apply them to products
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
        >
          <Plus size={18} />
          Add New Group
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search groups, options, products…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="font-semibold text-slate-800">No modifier groups yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Create a group like “Toppings” or “Drink choice”, then link products.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus size={16} /> Add New Group
            </button>
          </div>
        )}

        {filtered.map((group) => (
          <article
            key={group.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{group.title}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                  <Badge>
                    {group.pricingType === 'free'
                      ? 'Free'
                      : group.pricingType === 'fixed'
                        ? 'Fixed Price'
                        : 'Toppings (by size)'}
                  </Badge>
                  <Badge>
                    {group.selectionType === 'required' ? 'Required' : 'Optional'}
                    {group.selectionType === 'required'
                      ? ` · min ${group.minSelectable}`
                      : ''}
                    {` · max ${group.maxSelectable}`}
                  </Badge>
                  <Badge>{group.options.length} options</Badge>
                  <Badge>{group.products.length} products</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-500 line-clamp-1">
                  {group.options.map((o) => o.name).join(' · ') || 'No options'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(group)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(group.id)}
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <form
            onSubmit={onSave}
            className="flex h-full w-full max-w-3xl flex-col bg-[#f5f6f8] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">
                {editingId ? 'Edit Group' : 'Add New Group'}
              </h2>
              <button type="button" onClick={closeEditor} className="rounded-lg p-2 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
                <Field label="Title" required>
                  <input
                    className="field"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </Field>

                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-slate-700">
                    Pricing Type <span className="text-red-500">*</span>
                  </legend>
                  <div className="flex flex-wrap gap-5 text-sm">
                    {(
                      [
                        ['free', 'Free'],
                        ['fixed', 'Fixed Price'],
                        ['toppings_by_size', 'Toppings (Charge By Size)'],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="pricingType"
                          checked={form.pricingType === value}
                          onChange={() => setForm({ ...form, pricingType: value })}
                          className="accent-teal-600"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-slate-700">
                    Selection Type <span className="text-red-500">*</span>
                  </legend>
                  <div className="flex flex-wrap gap-5 text-sm mb-3">
                    {(
                      [
                        ['optional', 'Optional'],
                        ['required', 'Required'],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="selectionType"
                          checked={form.selectionType === value}
                          onChange={() => setSelectionType(value)}
                          className="accent-teal-600"
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                    {form.selectionType === 'required' && (
                      <Stepper
                        label="Minimum Required"
                        value={form.minSelectable}
                        min={1}
                        onChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            minSelectable: v,
                            maxSelectable: Math.max(v, f.maxSelectable),
                          }))
                        }
                      />
                    )}
                    <Stepper
                      label="Maximum Selectable"
                      value={form.maxSelectable}
                      min={form.selectionType === 'required' ? Math.max(1, form.minSelectable) : 0}
                      onChange={(v) => setForm({ ...form, maxSelectable: v })}
                    />
                    <Toggle
                      label="Default To Collapsed View"
                      checked={form.defaultCollapsed}
                      onChange={(v) => setForm({ ...form, defaultCollapsed: v })}
                    />
                    {form.pricingType === 'fixed' && (
                      <Toggle
                        label="Multiple Selection On Same Item"
                        checked={form.allowMultipleSameItem}
                        onChange={(v) => setForm({ ...form, allowMultipleSameItem: v })}
                      />
                    )}
                  </div>
                </fieldset>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Options</h3>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({ ...form, options: [...form.options, emptyOption()] })
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-teal-600 text-white hover:bg-teal-700"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-500">
                        <tr>
                          <th className="px-2 py-2 w-8" />
                          <th className="px-2 py-2">Items</th>
                          {form.pricingType !== 'free' && (
                            <th className="px-2 py-2 w-36">Sale price</th>
                          )}
                          <th className="px-2 py-2 w-36">Sale Status</th>
                          <th className="px-2 py-2 w-28 text-center">Default</th>
                          <th className="px-2 py-2 w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {form.options.map((opt, idx) => (
                          <tr key={idx} className="border-t border-slate-100">
                            <td className="px-2 py-2 text-slate-300">
                              <GripVertical size={16} />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                className="field"
                                placeholder="Option Name"
                                value={opt.name}
                                onChange={(e) => {
                                  const options = [...form.options];
                                  options[idx] = { ...options[idx], name: e.target.value };
                                  setForm({ ...form, options });
                                }}
                              />
                            </td>
                            {form.pricingType !== 'free' && (
                              <td className="px-2 py-2">
                                <div className="relative">
                                  <input
                                    className="field pr-12"
                                    type="number"
                                    step="0.01"
                                    value={opt.price}
                                    onChange={(e) => {
                                      const options = [...form.options];
                                      options[idx] = {
                                        ...options[idx],
                                        price: Number(e.target.value) || 0,
                                      };
                                      setForm({ ...form, options });
                                    }}
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                    CHF
                                  </span>
                                </div>
                              </td>
                            )}
                            <td className="px-2 py-2">
                              <select
                                className="field"
                                value={opt.saleStatus}
                                onChange={(e) => {
                                  const options = [...form.options];
                                  options[idx] = {
                                    ...options[idx],
                                    saleStatus: e.target.value as SaleStatus,
                                  };
                                  setForm({ ...form, options });
                                }}
                              >
                                <option value="in_stock">In stock</option>
                                <option value="out_of_stock">Out of stock</option>
                              </select>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                className="accent-teal-600"
                                checked={opt.isDefault}
                                onChange={(e) => {
                                  const options = [...form.options];
                                  options[idx] = {
                                    ...options[idx],
                                    isDefault: e.target.checked,
                                  };
                                  setForm({ ...form, options });
                                }}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <button
                                type="button"
                                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                onClick={() =>
                                  setForm({
                                    ...form,
                                    options:
                                      form.options.length > 1
                                        ? form.options.filter((_, i) => i !== idx)
                                        : [emptyOption()],
                                  })
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-5 py-4 text-left font-semibold"
                  onClick={() => setOtherOpen((v) => !v)}
                >
                  Other Settings
                  {otherOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {otherOpen && (
                  <div className="border-t border-slate-100 px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-slate-800">Link Products</h4>
                      <button
                        type="button"
                        onClick={() => setProductPickerOpen(true)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-teal-600 text-white hover:bg-teal-700"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-slate-500">
                          <tr>
                            <th className="px-3 py-2 w-12">#</th>
                            <th className="px-3 py-2">Items</th>
                            <th className="px-3 py-2 w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {linkedProducts.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-3 py-8 text-center text-slate-400">
                                No data yet.
                              </td>
                            </tr>
                          )}
                          {linkedProducts.map((p, idx) => (
                            <tr key={p.id} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-slate-800">{p.name}</div>
                                {p.category?.name && (
                                  <div className="text-xs text-slate-500">{p.category.name}</div>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                  onClick={() =>
                                    setForm({
                                      ...form,
                                      productIds: form.productIds.filter((id) => id !== p.id),
                                    })
                                  }
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {productPickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="font-bold text-slate-900">Link Products</h3>
              <button
                type="button"
                onClick={() => setProductPickerOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <input
                className="field"
                placeholder="Search products…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <div className="max-h-80 overflow-y-auto divide-y rounded-lg border border-slate-200">
                {pickerProducts.length === 0 && (
                  <p className="p-6 text-center text-sm text-slate-400">No products to add</p>
                )}
                {pickerProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                    onClick={() => {
                      setForm({ ...form, productIds: [...form.productIds, p.id] });
                    }}
                  >
                    <span>
                      <span className="block font-medium text-slate-800">{p.name}</span>
                      {p.category?.name && (
                        <span className="text-xs text-slate-500">{p.category.name}</span>
                      )}
                    </span>
                    <Plus size={16} className="text-teal-600" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end border-t px-5 py-4">
              <button
                type="button"
                onClick={() => setProductPickerOpen(false)}
                className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .field {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          background: #fff;
        }
        .field:focus {
          outline: none;
          border-color: #14b8a6;
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.15);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{children}</span>
  );
}

function Stepper({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-700">{label}</span>
      <div className="inline-flex items-center rounded-md border border-slate-200 bg-white">
        <button
          type="button"
          className="px-3 py-1.5 text-slate-600 hover:bg-slate-50"
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <span className="min-w-[2rem] text-center text-sm font-semibold">{value}</span>
        <button
          type="button"
          className="px-3 py-1.5 text-slate-600 hover:bg-slate-50"
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${
          checked ? 'bg-teal-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'left-5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}
