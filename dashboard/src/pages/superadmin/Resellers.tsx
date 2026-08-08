import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

type Reseller = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  merchantCount: number;
};

const empty = { name: '', email: '', password: '', phone: '' };

export default function Resellers() {
  const navigate = useNavigate();
  const startImpersonation = useAuthStore((s) => s.startImpersonation);
  const [rows, setRows] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await api.post('/superadmin/resellers/ensure-agency').catch(() => null);
      const res = await api.get('/superadmin/resellers');
      setRows(res.data.resellers || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load resellers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/superadmin/resellers', form);
      toast.success('Reseller created');
      setForm(empty);
      setShowCreate(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (r: Reseller) => {
    const next = r.status === 'active' ? 'suspended' : 'active';
    try {
      await api.put(`/superadmin/resellers/${r.id}`, { status: next });
      toast.success(next === 'active' ? 'Reactivated' : 'Suspended');
      load();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const openAs = async (r: Reseller) => {
    if (r.status !== 'active') {
      toast.error('Reseller is suspended');
      return;
    }
    setOpeningId(r.id);
    try {
      const res = await api.post(`/superadmin/resellers/${r.id}/impersonate`);
      const { token, reseller } = res.data;
      if (!token || !reseller) throw new Error('Invalid response');
      startImpersonation(token, {
        id: reseller.id,
        email: reseller.email,
        name: reseller.name,
        role: 'reseller',
        resellerId: reseller.id,
        impersonatedBy: 'superadmin',
      });
      toast.success(`Opened as ${reseller.name}`);
      navigate('/reseller');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to open reseller');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Dealer / Reseller Manage</h1>
          <p className="text-sm text-stone-600 mt-1">
            Agencies that onboard merchants. Your own sales agency is a normal reseller.
          </p>
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
          Add reseller
        </button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="card p-4 grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            Name *
            <input
              className="input mt-1"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Email *
            <input
              className="input mt-1"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Password *
            <input
              className="input mt-1"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Phone
            <input
              className="input mt-1"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary text-sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <div className="card !p-0 table-scroll">
        {loading ? (
          <p className="p-4 text-sm text-stone-500">Loading…</p>
        ) : (
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-stone-50 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Merchants</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-stone-100">
                  <td className="px-3 py-2 font-medium">
                    <span className="cell-truncate block" title={r.name}>
                      {r.name}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="cell-truncate block" title={r.email}>
                      {r.email}
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.merchantCount}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      className="text-teal-700 hover:underline"
                      disabled={openingId === r.id}
                      onClick={() => openAs(r)}
                    >
                      {openingId === r.id ? 'Opening…' : 'Open as'}
                    </button>
                    <button
                      type="button"
                      className="text-stone-600 hover:underline"
                      onClick={() => toggleStatus(r)}
                    >
                      {r.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
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
