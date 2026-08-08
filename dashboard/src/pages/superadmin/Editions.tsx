import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { ALL_EDITION_FEATURES, type EditionFeatureKey } from '@/lib/edition-features';
import EditionFeatureChecklist from '@/components/EditionFeatureChecklist';

type Edition = {
  id: string;
  name: string;
  note: string | null;
  businessCategory: string;
  features: EditionFeatureKey[];
  isActive: boolean;
};

const empty = {
  name: '',
  note: '',
  businessCategory: 'both',
  features: [...ALL_EDITION_FEATURES] as EditionFeatureKey[],
};

export default function Editions() {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Edition | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/editions', { params: { all: '1' } });
      setEditions(res.data.editions || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load editions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm(empty);
  };

  const openEdit = (ed: Edition) => {
    setCreating(false);
    setEditing(ed);
    setForm({
      name: ed.name,
      note: ed.note || '',
      businessCategory: ed.businessCategory || 'both',
      features: ed.features?.length ? ed.features : [...ALL_EDITION_FEATURES],
    });
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/superadmin/editions/${editing.id}`, form);
        toast.success('Edition updated');
      } else {
        await api.post('/superadmin/editions', form);
        toast.success('Edition created');
      }
      setCreating(false);
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (ed: Edition) => {
    if (!window.confirm(`Deactivate "${ed.name}"?`)) return;
    try {
      await api.delete(`/superadmin/editions/${ed.id}`);
      toast.success('Edition deactivated');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed');
    }
  };

  const showForm = creating || editing;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Edition Management</h1>
          <p className="text-sm text-stone-600 mt-1">
            Feature packs assigned to merchants (POS versions).
          </p>
        </div>
        {!showForm && (
          <button type="button" onClick={openCreate} className="btn-primary text-sm">
            Add edition
          </button>
        )}
      </div>

      {showForm && (
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold">{editing ? 'Edit edition' : 'New edition'}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium">Version name *</span>
              <input
                className="input mt-1"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Business category</span>
              <select
                className="input mt-1"
                value={form.businessCategory}
                onChange={(e) => setForm((f) => ({ ...f, businessCategory: e.target.value }))}
              >
                <option value="both">Both</option>
                <option value="restaurant">Restaurant / Catering</option>
                <option value="retail">Retail</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium">Note</span>
            <input
              className="input mt-1"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </label>
          <EditionFeatureChecklist
            value={form.features}
            onChange={(features) => setForm((f) => ({ ...f, features }))}
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </button>
            <button type="button" className="btn-primary text-sm" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-stone-500">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Features</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {editions.map((ed) => (
                <tr key={ed.id} className="border-t border-stone-100">
                  <td className="px-3 py-2 font-medium">{ed.name}</td>
                  <td className="px-3 py-2 capitalize">{ed.businessCategory}</td>
                  <td className="px-3 py-2">{ed.features?.length ?? 0}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        ed.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {ed.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button type="button" className="text-teal-700 hover:underline" onClick={() => openEdit(ed)}>
                      Edit
                    </button>
                    {ed.isActive && (
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
                        onClick={() => deactivate(ed)}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
