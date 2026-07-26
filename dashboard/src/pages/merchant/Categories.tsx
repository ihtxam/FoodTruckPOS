import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

interface Category {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
}

export default function Categories() {
  const { t } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const response = await api.get('/merchant/categories');
      setCategories(response.data.categories || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setName('');
    setDescription('');
    setEditingId(null);
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setDescription(category.description || '');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/merchant/categories/${editingId}`, { name, description });
        toast.success('Category updated');
      } else {
        await api.post('/merchant/categories', { name, description });
        toast.success('Category created');
      }
      reset();
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try {
      await api.delete(`/merchant/categories/${id}`);
      toast.success('Deleted');
      if (editingId === id) reset();
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Delete failed');
    }
  };

  if (loading) return <div className="text-center py-12">Loading categories...</div>;

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold mb-2">{t('categories')}</h1>
        <p className="text-gray-600 mb-4">
          {editingId ? 'Edit category' : 'Manage product categories (also importable via Excel).'}
        </p>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="input"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editingId ? t('save') : t('add')}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={reset}>
                {t('cancel')}
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Name</th>
              <th className="py-2">Description</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-gray-500">
                  No categories yet.
                </td>
              </tr>
            )}
            {categories.map((category) => (
              <tr key={category.id} className="border-b last:border-0">
                <td className="py-3 font-medium">{category.name}</td>
                <td className="py-3">{category.description || '—'}</td>
                <td className="py-3 text-right space-x-3">
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => startEdit(category)}
                  >
                    {t('edit')}
                  </button>
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() => onDelete(category.id)}
                  >
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
