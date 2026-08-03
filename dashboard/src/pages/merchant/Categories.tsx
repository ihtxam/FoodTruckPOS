import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { DragHandle, SortableContainer, SortableRow } from '@/components/SortableList';

interface Category {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
}

export default function Categories() {
  const { t } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

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
    void load();
  }, []);

  const reset = () => {
    setName('');
    setDescription('');
    setImageUrl('');
    setEditingId(null);
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setDescription(category.description || '');
    setImageUrl(category.imageUrl || '');
  };

  const onUploadImage = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const { compressImageIfNeeded } = await import('@/lib/compress-image');
      const compressed = await compressImageIfNeeded(file, {
        maxBytes: 350 * 1024,
        targetBytes: 350 * 1024,
        maxWidth: 1400,
      });
      const fd = new FormData();
      fd.append('file', compressed);
      const res = await api.post('/merchant/media', fd);
      setImageUrl(res.data.url);
      toast.success('Image uploaded');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/merchant/categories/${editingId}`, {
          name,
          description,
          imageUrl: imageUrl || null,
        });
        toast.success('Category updated');
      } else {
        const created = await api.post('/merchant/categories', { name, description });
        if (imageUrl && created.data?.category?.id) {
          await api.put(`/merchant/categories/${created.data.category.id}`, {
            imageUrl,
          });
        }
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

  const onReorder = async (next: Category[]) => {
    const prev = categories;
    setCategories(next);
    setReordering(true);
    try {
      const res = await api.put('/merchant/categories/reorder', {
        orderedIds: next.map((c) => c.id),
      });
      setCategories(res.data.categories || next);
    } catch (error: any) {
      setCategories(prev);
      toast.error(error.response?.data?.error || 'Failed to save order');
    } finally {
      setReordering(false);
    }
  };

  if (loading) return <div className="text-center py-12">Loading categories...</div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="card">
        <h1 className="page-title mb-1">{t('categories')}</h1>
        <p className="page-sub mb-3">
          {editingId ? t('editCategory') : t('manageCategories')}
        </p>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <input
            className="input"
            placeholder={t('name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder={t('description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="md:col-span-3 flex flex-wrap items-center gap-3">
            <label className="text-sm">
              <span className="font-medium mr-2">Category photo</span>
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => void onUploadImage(e.target.files?.[0] || null)}
              />
            </label>
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-12 w-20 object-cover rounded border" />
            ) : null}
            {imageUrl ? (
              <button type="button" className="text-sm text-red-600" onClick={() => setImageUrl('')}>
                Remove photo
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving || uploading}>
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

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[var(--border)]">
              <th className="py-2 px-2 w-10" />
              <th className="py-2 px-2">{t('name')}</th>
              <th className="py-2 px-2">{t('description')}</th>
              <th className="py-2 px-2" />
            </tr>
          </thead>
          <SortableContainer
            as="tbody"
            items={categories}
            onReorder={onReorder}
            disabled={reordering}
          >
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 px-3 muted">
                  {t('noCategoriesYet')}
                </td>
              </tr>
            )}
            {categories.map((category) => (
              <SortableRow
                key={category.id}
                id={category.id}
                as="tr"
                className="border-b border-[var(--border)] last:border-0 bg-[var(--bg-elevated)]"
                disabled={reordering}
              >
                {({ attributes, listeners }) => (
                  <>
                    <td className="py-2.5 px-2">
                      <DragHandle attributes={attributes} listeners={listeners} />
                    </td>
                    <td className="py-2.5 px-2 font-medium">{category.name}</td>
                    <td className="py-2.5 px-2 muted">{category.description || '-'}</td>
                    <td className="py-2.5 px-2 text-right space-x-3 whitespace-nowrap">
                      <button
                        type="button"
                        className="text-sm text-sky-700 hover:underline dark:text-sky-300"
                        onClick={() => startEdit(category)}
                      >
                        {t('edit')}
                      </button>
                      <button
                        type="button"
                        className="text-sm text-[var(--danger)] hover:underline"
                        onClick={() => void onDelete(category.id)}
                      >
                        {t('delete')}
                      </button>
                    </td>
                  </>
                )}
              </SortableRow>
            ))}
          </SortableContainer>
        </table>
      </div>
    </div>
  );
}
