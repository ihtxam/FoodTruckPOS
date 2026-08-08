import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import api from '@/lib/api';
import { I18nProvider, useI18n, type Locale } from '@/lib/i18n';
import { APP_PANEL_TITLE } from '@/lib/brand';
import { useAuthStore } from '@/store/auth';
import { ALL_EDITION_FEATURES, type EditionFeatureKey } from '@/lib/edition-features';
import EditionFeatureChecklist from '@/components/EditionFeatureChecklist';

function Overview() {
  const [overview, setOverview] = useState({ merchantCount: 0, activeCount: 0, suspendedCount: 0 });
  useEffect(() => {
    api
      .get('/reseller/overview')
      .then((r) => setOverview(r.data.overview || overview))
      .catch(() => null);
  }, []);
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-xl font-bold">Reseller dashboard</h1>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-stone-500">Merchants</p>
          <p className="text-2xl font-bold">{overview.merchantCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-stone-500">Active / trial</p>
          <p className="text-2xl font-bold">{overview.activeCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-stone-500">Suspended</p>
          <p className="text-2xl font-bold">{overview.suspendedCount}</p>
        </div>
      </div>
    </div>
  );
}

function MerchantsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const startImpersonation = useAuthStore((s) => s.startImpersonation);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [editions, setEditions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    businessName: '',
    email: '',
    password: '',
    phone: '',
    city: '',
    address: '',
    country: 'CH',
    editionId: '',
    businessCategory: 'restaurant' as 'retail' | 'restaurant',
    shopEnabled: true,
    deviceSeats: 1,
  });

  const load = useCallback(async () => {
    try {
      const [m, e] = await Promise.all([
        api.get('/reseller/merchants', { params: { search: search || undefined } }),
        api.get('/reseller/editions'),
      ]);
      setMerchants(m.data.merchants || []);
      setEditions(e.data.editions || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load');
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.editionId) {
      toast.error(t('posVersionSelect'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/reseller/merchants', {
        ...form,
        password: form.password || undefined,
        deviceSeats: Number(form.deviceSeats) || 0,
      });
      toast.success('Merchant created');
      setShowCreate(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const openPanel = async (m: any) => {
    try {
      const res = await api.post(`/reseller/merchants/${m.id}/impersonate`);
      const { token, merchant } = res.data;
      startImpersonation(token, {
        id: merchant.id,
        email: merchant.email,
        name: merchant.name,
        role: 'merchant',
        merchantId: merchant.id,
        isOwner: true,
        impersonatedBy: 'reseller',
      });
      toast.success('Opened merchant panel');
      navigate('/merchant');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Store / Merchant manage</h1>
        <button type="button" className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
          Add store
        </button>
      </div>
      <input
        className="input max-w-sm"
        placeholder="Search�"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {showCreate && (
        <form onSubmit={create} className="card p-4 grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            Store name *
            <input
              className="input mt-1"
              required
              value={form.businessName}
              onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Admin email *
            <input
              className="input mt-1"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Password (optional � invite if empty)
            <input
              className="input mt-1"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Category
            <select
              className="input mt-1"
              value={form.businessCategory}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  businessCategory: e.target.value as 'retail' | 'restaurant',
                }))
              }
            >
              <option value="restaurant">Catering / Restaurant</option>
              <option value="retail">Retail</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            {t('posVersion')} *
            <select
              className="input mt-1"
              required
              value={form.editionId}
              onChange={(e) => setForm((f) => ({ ...f, editionId: e.target.value }))}
            >
              <option value="">{t('posVersionSelect')}</option>
              {editions.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.name} ({ed.ownerType})
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary text-sm" disabled={saving}>
              Save
            </button>
          </div>
        </form>
      )}

      <div className="card !p-0 table-scroll">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-stone-50 text-left">
            <tr>
              <th className="px-3 py-2">Store</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {merchants.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-3 py-2 font-medium">
                  <span className="cell-truncate block" title={m.name}>
                    {m.name}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="cell-truncate block" title={m.email}>
                    {m.email}
                  </span>
                </td>
                <td className="px-3 py-2">{m.status}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-teal-700 hover:underline"
                    onClick={() => openPanel(m)}
                  >
                    Open panel
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

function EditionsPage() {
  const { t } = useI18n();
  const [editions, setEditions] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '',
    note: '',
    businessCategory: 'both',
    features: [...ALL_EDITION_FEATURES] as EditionFeatureKey[],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const res = await api.get('/reseller/editions', { params: { all: '1' } });
    setEditions(res.data.editions || []);
  };

  useEffect(() => {
    load().catch(() => toast.error(t('posVersionLoadFailed')));
  }, [t]);

  const save = async () => {
    try {
      if (editingId) {
        const ed = editions.find((e) => e.id === editingId);
        if (ed?.ownerType === 'platform') {
          toast.error('Clone a platform template to edit your own copy');
          return;
        }
        await api.put(`/reseller/editions/${editingId}`, form);
      } else {
        await api.post('/reseller/editions', form);
      }
      toast.success('Saved');
      setShowForm(false);
      setEditingId(null);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed');
    }
  };

  const clone = async (id: string) => {
    try {
      await api.post(`/reseller/editions/${id}/clone`);
      toast.success('Cloned');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed');
    }
  };

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">{t('posVersionManagement')}</h1>
        <button
          type="button"
          className="btn-primary text-sm"
          onClick={() => {
            setEditingId(null);
            setForm({
              name: '',
              note: '',
              businessCategory: 'both',
              features: [...ALL_EDITION_FEATURES],
            });
            setShowForm(true);
          }}
        >
          {t('posVersionNew')}
        </button>
      </div>
      {showForm && (
        <div className="card p-4 space-y-3">
          <input
            className="input"
            placeholder={t('posVersionName')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <EditionFeatureChecklist
            value={form.features}
            onChange={(features) => setForm((f) => ({ ...f, features }))}
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary text-sm" onClick={save}>
              Save
            </button>
          </div>
        </div>
      )}
      <div className="card !p-0 table-scroll">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-stone-50 text-left">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Features</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {editions.map((ed) => (
              <tr key={ed.id} className="border-t">
                <td className="px-3 py-2 font-medium">{ed.name}</td>
                <td className="px-3 py-2">{ed.ownerType}</td>
                <td className="px-3 py-2">{ed.features?.length}</td>
                <td className="px-3 py-2 text-right space-x-2">
                  {ed.ownerType === 'platform' ? (
                    <button type="button" className="text-teal-700 hover:underline" onClick={() => clone(ed.id)}>
                      Clone
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-teal-700 hover:underline"
                      onClick={() => {
                        setEditingId(ed.id);
                        setForm({
                          name: ed.name,
                          note: ed.note || '',
                          businessCategory: ed.businessCategory || 'both',
                          features: ed.features || [...ALL_EDITION_FEATURES],
                        });
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResellerShell() {
  const { t, locale, setLocale } = useI18n();
  const user = useAuthStore((s) => s.user);
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    document.title = APP_PANEL_TITLE;
  }, []);

  const menuItems = [
    { label: t('overview'), path: '/reseller', icon: '??' },
    {
      id: 'merchants',
      label: 'Merchants',
      icon: '??',
      children: [{ label: 'Stores', path: '/reseller/merchants', icon: '??' }],
    },
    {
      id: 'editions',
      label: t('posVersions'),
      icon: '??',
      children: [{ label: t('posVersionManagement'), path: '/reseller/editions', icon: '??' }],
    },
  ];

  return (
    <div className="flex h-full max-h-full panel-shell">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        menuItems={menuItems}
        panelKey="reseller"
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
        <Header
          title={`${user?.name || 'Reseller'} — Agency`}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          language={locale}
          onLanguageChange={(lang: Locale) => setLocale(lang)}
        />
        <main className="panel-main flex-1 p-3 sm:p-4">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="merchants" element={<MerchantsPage />} />
            <Route path="editions" element={<EditionsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function ResellerDashboard() {
  return (
    <I18nProvider>
      <ResellerShell />
    </I18nProvider>
  );
}
