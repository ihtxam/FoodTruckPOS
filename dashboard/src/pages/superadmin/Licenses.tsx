import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Copy, KeyRound, Plus, RefreshCw, Ban, Clock } from 'lucide-react';

interface MerchantOption {
  id: string;
  name: string;
  email: string;
}

interface LicenseRow {
  id: string;
  licenseKey: string;
  licenseType: string;
  status: string;
  startsAt: string;
  expiresAt: string;
  merchant?: { id: string; name: string; email: string };
  device?: { id: string; deviceName: string; deviceId: string };
}

interface Stats {
  total: number;
  active: number;
  expired: number;
  suspended: number;
  expiringIn30Days: number;
  trial: number;
  yearly: number;
}

export default function Licenses() {
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [expiring, setExpiring] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [merchantFilter, setMerchantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showIssue, setShowIssue] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueForm, setIssueForm] = useState({
    merchantId: '',
    seats: 1,
    licenseType: 'yearly' as 'trial' | 'yearly' | 'custom',
    customDays: 365,
    deviceType: 'tablet',
  });
  const [lastIssued, setLastIssued] = useState<
    Array<{ deviceName: string; licenseKey: string }>
  >([]);

  const load = async () => {
    try {
      setLoading(true);
      const [licRes, merRes, statsRes, expRes] = await Promise.all([
        api.get('/superadmin/licenses', {
          params: {
            page,
            limit: 20,
            status: statusFilter || undefined,
            merchantId: merchantFilter || undefined,
          },
        }),
        api.get('/superadmin/merchants', { params: { page: 1, limit: 100 } }),
        api.get('/superadmin/licenses/statistics'),
        api.get('/superadmin/licenses/expiring-soon', { params: { days: 35 } }),
      ]);
      setLicenses(licRes.data.licenses || []);
      setMerchants(
        (merRes.data.merchants || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          email: m.email,
        }))
      );
      setStats(statsRes.data.statistics || null);
      setExpiring(expRes.data.licenses || []);
    } catch {
      toast.error('Failed to load licenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, statusFilter, merchantFilter]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const issueSeats = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueForm.merchantId) {
      toast.error('Select a merchant');
      return;
    }
    setIssuing(true);
    try {
      const res = await api.post('/superadmin/licenses/issue-seats', {
        merchantId: issueForm.merchantId,
        seats: Number(issueForm.seats) || 1,
        licenseType: issueForm.licenseType,
        customDays:
          issueForm.licenseType === 'custom' ? Number(issueForm.customDays) : undefined,
        deviceType: issueForm.deviceType,
      });
      const issued = res.data.licenses || [];
      setLastIssued(issued);
      toast.success(res.data.message || 'Licenses issued');
      setShowIssue(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to issue licenses');
    } finally {
      setIssuing(false);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm('Revoke this license?')) return;
    try {
      await api.post(`/superadmin/licenses/${id}/revoke`);
      toast.success('License revoked');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Revoke failed');
    }
  };

  const extend = async (id: string) => {
    const days = window.prompt('Extend by how many days?', '365');
    if (!days) return;
    const n = Number(days);
    if (!n || n <= 0) {
      toast.error('Invalid days');
      return;
    }
    try {
      await api.post(`/superadmin/licenses/${id}/extend`, { additionalDays: n });
      toast.success('License extended');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Extend failed');
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      expired: 'bg-gray-100 text-gray-700',
      suspended: 'bg-red-100 text-red-800',
    };
    return map[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">License Management</h1>
          <p className="text-gray-600 text-sm mt-1">
            Issue device licenses, revoke, extend, and monitor expiries
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={load}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowIssue(true)}>
            <Plus className="w-4 h-4" /> Issue device licenses
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          ['Total', stats?.total],
          ['Active', stats?.active],
          ['Trial', stats?.trial],
          ['Yearly', stats?.yearly],
          ['Expired', stats?.expired],
          ['Suspended', stats?.suspended],
          ['Expiring 30d', stats?.expiringIn30Days],
        ].map(([label, value]) => (
          <div key={String(label)} className="card py-3 px-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-bold">{value ?? '—'}</p>
          </div>
        ))}
      </div>

      {lastIssued.length > 0 && (
        <div className="card border-emerald-200 bg-emerald-50">
          <div className="flex justify-between mb-2">
            <h3 className="font-semibold flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Just issued
            </h3>
            <button className="text-sm text-gray-500" onClick={() => setLastIssued([])}>
              Dismiss
            </button>
          </div>
          <ul className="space-y-2">
            {lastIssued.map((k) => (
              <li
                key={k.licenseKey}
                className="flex items-center justify-between gap-2 bg-white border rounded-lg px-3 py-2"
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

      {expiring.length > 0 && (
        <div className="card">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4" /> Expiring within 35 days
          </h3>
          <ul className="space-y-2 text-sm">
            {expiring.slice(0, 8).map((row: any) => (
              <li key={row.license?.id || row.license?.licenseKey} className="flex justify-between gap-3">
                <span>
                  {row.license?.merchant?.name || '—'} ·{' '}
                  <span className="font-mono text-xs">{row.license?.licenseKey}</span>
                </span>
                <span className="text-amber-700 font-semibold">{row.daysRemaining}d</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          className="input w-auto min-w-[220px]"
          value={merchantFilter}
          onChange={(e) => {
            setPage(1);
            setMerchantFilter(e.target.value);
          }}
        >
          <option value="">All merchants</option>
          {merchants.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : licenses.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No licenses found</div>
        ) : (
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Merchant</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Device</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">License key</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Expires</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((lic) => (
                <tr key={lic.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{lic.merchant?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {lic.device?.deviceName || '—'}
                    <div className="text-xs text-gray-400 font-mono truncate max-w-[160px]">
                      {lic.device?.deviceId}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs">{lic.licenseKey}</span>
                      <button className="p-1" onClick={() => copyText(lic.licenseKey)}>
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">{lic.licenseType}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${statusBadge(
                        lic.status
                      )}`}
                    >
                      {lic.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        className="btn-secondary text-xs px-2 py-1"
                        onClick={() => extend(lic.id)}
                        title="Extend"
                      >
                        +days
                      </button>
                      {lic.status === 'active' && (
                        <button
                          className="p-2 hover:bg-red-50 rounded"
                          onClick={() => revoke(lic.id)}
                          title="Revoke"
                        >
                          <Ban className="w-4 h-4 text-red-600" />
                        </button>
                      )}
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
            className="btn-secondary disabled:opacity-50"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <button
            className="btn-secondary disabled:opacity-50"
            disabled={licenses.length < 20}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {showIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-bold">Issue device licenses</h2>
              <button className="text-gray-500" onClick={() => setShowIssue(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={issueSeats} className="p-6 space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Merchant *</span>
                <select
                  className="input mt-1"
                  value={issueForm.merchantId}
                  onChange={(e) => setIssueForm({ ...issueForm, merchantId: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium">Seats</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="input mt-1"
                    value={issueForm.seats}
                    onChange={(e) => setIssueForm({ ...issueForm, seats: Number(e.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Device type</span>
                  <select
                    className="input mt-1"
                    value={issueForm.deviceType}
                    onChange={(e) => setIssueForm({ ...issueForm, deviceType: e.target.value })}
                  >
                    <option value="tablet">Tablet</option>
                    <option value="mobile">Mobile</option>
                    <option value="terminal">Terminal</option>
                    <option value="desktop">Desktop / WebPOS</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">License type</span>
                  <select
                    className="input mt-1"
                    value={issueForm.licenseType}
                    onChange={(e) =>
                      setIssueForm({
                        ...issueForm,
                        licenseType: e.target.value as 'trial' | 'yearly' | 'custom',
                      })
                    }
                  >
                    <option value="trial">Trial</option>
                    <option value="yearly">Yearly</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                {issueForm.licenseType === 'custom' && (
                  <label className="block">
                    <span className="text-sm font-medium">Days</span>
                    <input
                      type="number"
                      min={1}
                      className="input mt-1"
                      value={issueForm.customDays}
                      onChange={(e) =>
                        setIssueForm({ ...issueForm, customDays: Number(e.target.value) })
                      }
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Creates placeholder POS device slots and printable license keys for activation.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setShowIssue(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={issuing}>
                  {issuing ? 'Issuing…' : 'Issue licenses'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
