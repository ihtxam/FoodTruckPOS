import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Search, Plus, Edit2, Trash2, Eye, X, Copy, KeyRound } from 'lucide-react';

interface Merchant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  slug?: string;
  shopEnabled?: boolean;
  status: 'active' | 'trial' | 'suspended' | 'expired';
  subscriptionPlan?: string;
  createdAt: string;
  devices: number;
  licenses: number;
  activeLicenses?: number;
}

interface IssuedLicense {
  deviceId: string;
  deviceName: string;
  licenseKey: string;
  expiresAt: string;
}

interface PlanOption {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  priceMonthly: string;
  currency: string;
}

const emptyForm = {
  businessName: '',
  email: '',
  password: '',
  phone: '',
  address: '',
  city: '',
  country: 'CH',
  slug: '',
  shopEnabled: true,
  subscriptionPlan: 'starter',
  deviceSeats: 1,
  licenseType: 'yearly' as 'trial' | 'yearly' | 'custom',
  customDays: 365,
};

export default function Merchants() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Merchant | null>(null);
  const [detailFull, setDetailFull] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [issuedKeys, setIssuedKeys] = useState<IssuedLicense[]>([]);

  useEffect(() => {
    fetchMerchants();
  }, [page, search]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get('/superadmin/plans');
        const list = (res.data.plans || []).filter((p: PlanOption) => p.isActive !== false);
        setPlans(list);
        if (list.length && !list.some((p: PlanOption) => p.slug === emptyForm.subscriptionPlan)) {
          setForm((f) => ({ ...f, subscriptionPlan: list[0].slug }));
        }
      } catch {
        /* keep hardcoded fallbacks in select */
      }
    })();
  }, []);

  const fetchMerchants = async () => {
    try {
      setLoading(true);
      const response = await api.get('/superadmin/merchants', {
        params: { page, limit: 10, search: search || undefined },
      });
      setMerchants(response.data.merchants || []);
    } catch {
      toast.error('Failed to load merchants');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (merchant: Merchant) => {
    setShowDetail(merchant);
    try {
      const res = await api.get(`/superadmin/merchants/${merchant.id}`);
      setDetailFull(res.data.merchant);
    } catch {
      toast.error('Failed to load merchant details');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.email || !form.password) {
      toast.error('Name, email and password are required');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/superadmin/merchants', {
        businessName: form.businessName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        country: form.country || 'CH',
        slug: form.slug || undefined,
        shopEnabled: form.shopEnabled,
        subscriptionPlan: form.subscriptionPlan,
        deviceSeats: Number(form.deviceSeats) || 0,
        licenseType: form.licenseType,
        customDays: form.licenseType === 'custom' ? Number(form.customDays) : undefined,
      });
      const issued = res.data.merchant?.issuedLicenses || [];
      setIssuedKeys(issued);
      toast.success('Merchant created');
      setForm(emptyForm);
      setShowCreate(false);
      fetchMerchants();
      if (issued.length) {
        toast.success(`${issued.length} device license(s) issued — copy keys below`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create merchant');
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async (merchantId: string) => {
    try {
      await api.post(`/superadmin/merchants/${merchantId}/suspend`);
      toast.success('Merchant suspended');
      fetchMerchants();
    } catch {
      toast.error('Failed to suspend merchant');
    }
  };

  const handleReactivate = async (merchantId: string) => {
    try {
      await api.post(`/superadmin/merchants/${merchantId}/reactivate`);
      toast.success('Merchant reactivated');
      fetchMerchants();
    } catch {
      toast.error('Failed to reactivate merchant');
    }
  };

  const handleDelete = async (merchantId: string) => {
    if (!window.confirm('Suspend/delete this merchant?')) return;
    try {
      await api.delete(`/superadmin/merchants/${merchantId}`);
      toast.success('Merchant deleted');
      fetchMerchants();
    } catch {
      toast.error('Failed to delete merchant');
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'trial':
        return 'bg-blue-100 text-blue-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Merchants</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create merchants, enable online shop, and issue device licenses
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-4 h-4" />
          Add Merchant
        </button>
      </div>

      {issuedKeys.length > 0 && (
        <div className="card border-emerald-200 bg-emerald-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Newly issued device licenses
            </h3>
            <button className="text-sm text-gray-500" onClick={() => setIssuedKeys([])}>
              Dismiss
            </button>
          </div>
          <ul className="space-y-2">
            {issuedKeys.map((k) => (
              <li
                key={k.licenseKey}
                className="flex items-center justify-between gap-3 bg-white rounded-lg px-3 py-2 border"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{k.deviceName}</p>
                  <p className="font-mono text-xs truncate">{k.licenseKey}</p>
                </div>
                <button className="btn-secondary p-2" onClick={() => copyText(k.licenseKey)}>
                  <Copy className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search merchants..."
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="input pl-10"
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : merchants.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No merchants found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Shop</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Devices</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Licenses</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {merchants.map((merchant) => (
                <tr key={merchant.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{merchant.name}</td>
                  <td className="px-6 py-4 text-gray-600">{merchant.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {merchant.shopEnabled ? (
                      <span className="text-emerald-700">/{merchant.slug || '—'}</span>
                    ) : (
                      <span className="text-gray-400">off</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        merchant.status
                      )}`}
                    >
                      {merchant.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{merchant.devices}</td>
                  <td className="px-6 py-4">
                    {merchant.activeLicenses ?? merchant.licenses}
                    <span className="text-gray-400 text-xs"> / {merchant.licenses}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        className="p-2 hover:bg-gray-100 rounded"
                        title="View"
                        onClick={() => openDetail(merchant)}
                      >
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      {merchant.status === 'suspended' ? (
                        <button
                          className="p-2 hover:bg-gray-100 rounded text-xs text-emerald-700"
                          onClick={() => handleReactivate(merchant.id)}
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          className="p-2 hover:bg-gray-100 rounded"
                          title="Suspend"
                          onClick={() => handleSuspend(merchant.id)}
                        >
                          <Edit2 className="w-4 h-4 text-amber-600" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(merchant.id)}
                        className="p-2 hover:bg-gray-100 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Page {page}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="btn-secondary disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(page + 1)}
            disabled={merchants.length < 10}
            className="btn-secondary disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold">Create merchant</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block md:col-span-2">
                  <span className="text-sm font-medium">Business name *</span>
                  <input
                    className="input mt-1"
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Login email *</span>
                  <input
                    type="email"
                    className="input mt-1"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Temp password *</span>
                  <input
                    type="text"
                    className="input mt-1"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={8}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Phone</span>
                  <input
                    className="input mt-1"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">City</span>
                  <input
                    className="input mt-1"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-sm font-medium">Address</span>
                  <input
                    className="input mt-1"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Shop slug</span>
                  <input
                    className="input mt-1"
                    placeholder="auto from name"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Plan</span>
                  <select
                    className="input mt-1"
                    value={form.subscriptionPlan}
                    onChange={(e) => setForm({ ...form, subscriptionPlan: e.target.value })}
                  >
                    {plans.length > 0 ? (
                      plans.map((p) => (
                        <option key={p.id} value={p.slug}>
                          {p.name} ({Number(p.priceMonthly).toFixed(2)} {p.currency}/mo)
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="free">Free</option>
                        <option value="starter">Starter</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                      </>
                    )}
                  </select>
                  {!plans.length && (
                    <span className="text-xs text-amber-700 mt-1 block">
                      No plans in Settings yet — using defaults. Create plans under Superadmin → Settings.
                    </span>
                  )}
                </label>
              </div>

              <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.shopEnabled}
                    onChange={(e) => setForm({ ...form, shopEnabled: e.target.checked })}
                  />
                  Enable online shop
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="block">
                    <span className="text-sm font-medium">Device license seats</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      className="input mt-1"
                      value={form.deviceSeats}
                      onChange={(e) => setForm({ ...form, deviceSeats: Number(e.target.value) })}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">License type</span>
                    <select
                      className="input mt-1"
                      value={form.licenseType}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          licenseType: e.target.value as 'trial' | 'yearly' | 'custom',
                        })
                      }
                    >
                      <option value="trial">Trial (7 days)</option>
                      <option value="yearly">Yearly</option>
                      <option value="custom">Custom days</option>
                    </select>
                  </label>
                  {form.licenseType === 'custom' && (
                    <label className="block">
                      <span className="text-sm font-medium">Days</span>
                      <input
                        type="number"
                        min={1}
                        className="input mt-1"
                        value={form.customDays}
                        onChange={(e) => setForm({ ...form, customDays: Number(e.target.value) })}
                      />
                    </label>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Each seat creates a POS device slot + license key the Android/Web POS can activate.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Creating…' : 'Create merchant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold">{showDetail.name}</h2>
              <button
                onClick={() => {
                  setShowDetail(null);
                  setDetailFull(null);
                }}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <p>
                <span className="text-gray-500">Email:</span> {showDetail.email}
              </p>
              <p>
                <span className="text-gray-500">Status:</span> {showDetail.status}
              </p>
              <p>
                <span className="text-gray-500">Shop:</span>{' '}
                {showDetail.shopEnabled ? `/${showDetail.slug || '—'}` : 'disabled'}
              </p>
              <p>
                <span className="text-gray-500">Devices / licenses:</span> {showDetail.devices} /{' '}
                {showDetail.licenses}
              </p>
              {detailFull?.devices?.length > 0 && (
                <div>
                  <p className="font-semibold mb-2">Devices</p>
                  <ul className="space-y-1">
                    {detailFull.devices.map((d: any) => (
                      <li key={d.id} className="font-mono text-xs bg-gray-50 rounded px-2 py-1">
                        {d.deviceName} · {d.deviceId}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {detailFull?.licenses?.length > 0 && (
                <div>
                  <p className="font-semibold mb-2">Licenses</p>
                  <ul className="space-y-1">
                    {detailFull.licenses.map((l: any) => (
                      <li
                        key={l.id}
                        className="flex items-center justify-between gap-2 bg-gray-50 rounded px-2 py-1"
                      >
                        <span className="font-mono text-xs truncate">{l.licenseKey}</span>
                        <button className="p-1" onClick={() => copyText(l.licenseKey)}>
                          <Copy className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
