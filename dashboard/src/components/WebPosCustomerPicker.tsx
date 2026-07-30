import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

export type WebPosCustomer = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  defaultAddress?: string | null;
  defaultZip?: string | null;
  defaultCity?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: WebPosCustomer) => void;
};

function displayName(c: WebPosCustomer) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone || c.email || 'ù';
}

export default function WebPosCustomerPicker({ open, onClose, onSelect }: Props) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [list, setList] = useState<WebPosCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    zip: '',
    city: '',
  });

  useEffect(() => {
    if (!open) return;
    setQ('');
    setShowCreate(false);
    void load('');
  }, [open]);

  const load = async (search: string) => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/customers', {
        params: { page: 1, limit: 40, search: search || undefined },
      });
      setList(res.data.customers || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosCustomersLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => void load(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q, open]);

  if (!open) return null;

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() && !form.phone.trim()) {
      toast.error(t('webPosCustomerRequired'));
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/merchant/customers', {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        defaultAddress: form.address.trim() || undefined,
        defaultZip: form.zip.trim() || undefined,
        defaultCity: form.city.trim() || undefined,
      });
      const c = res.data.customer as WebPosCustomer;
      toast.success(t('webPosCustomerCreated'));
      onSelect(c);
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('webPosCustomerCreateFailed'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/45 p-3">
      <div className="flex w-full max-w-lg max-h-[90dvh] flex-col rounded-2xl bg-[var(--bg-elevated)] shadow-xl border border-[var(--border)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="font-semibold">{t('webPosSelectCustomer')}</h2>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>

        {!showCreate ? (
          <>
            <div className="p-3 border-b border-[var(--border)] flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                />
                <input
                  className="input pl-9"
                  placeholder={t('webPosSearchCustomers')}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="button" className="btn-primary shrink-0" onClick={() => setShowCreate(true)}>
                {t('webPosCreateCustomer')}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <p className="p-3 text-sm muted">{t('loading')}</p>
              ) : list.length === 0 ? (
                <p className="p-3 text-sm muted">{t('webPosNoCustomers')}</p>
              ) : (
                list.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-left hover:bg-[var(--bg-muted)]"
                    onClick={() => onSelect(c)}
                  >
                    <p className="font-medium text-sm">{displayName(c)}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {[c.phone, c.defaultAddress, c.defaultZip, c.defaultCity]
                        .filter(Boolean)
                        .join(' ù ')}
                    </p>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <form className="p-4 space-y-3 overflow-y-auto" onSubmit={onCreate}>
            <label className="block text-sm space-y-1">
              <span>{t('name')}</span>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm space-y-1">
              <span>{t('phone')}</span>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className="block text-sm space-y-1">
                <span>Email</span>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="block text-sm space-y-1">
              <span>{t('address')}</span>
              <input
                className="input"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm space-y-1">
                <span>ZIP</span>
                <input
                  className="input"
                  value={form.zip}
                  onChange={(e) => setForm({ ...form, zip: e.target.value })}
                />
              </label>
              <label className="block text-sm space-y-1">
                <span>{t('city')}</span>
                <input
                  className="input"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setShowCreate(false)}
              >
                {t('cancel')}
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={creating}>
                {creating ? t('saving') : t('save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
