import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import api from '@/lib/api';

type Plan = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  priceMonthly: string;
  priceYearly?: string | null;
  currency: string;
  maxDevices: number;
  maxProducts?: number | null;
  features?: string[] | null;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  trialDays: number;
};

type AdyenSettings = {
  merchantAccount: string;
  clientKey: string;
  environment: string;
  apiKeyMasked: string;
  apiKeySet: boolean;
  hmacKeyMasked: string;
  hmacKeySet: boolean;
  configured: boolean;
  usingEnvFallback?: boolean;
};

type EmailSettings = {
  configured: boolean;
  provider?: string | null;
  fromEmail: string;
  fromName: string;
  apiKeyMasked?: string;
  apiKeySet: boolean;
  usingEnvFallback?: boolean;
};

const emptyPlan = {
  name: '',
  slug: '',
  description: '',
  priceMonthly: '0',
  priceYearly: '',
  currency: 'CHF',
  maxDevices: 1,
  maxProducts: '',
  featuresText: '',
  isActive: true,
  isPublic: true,
  sortOrder: 0,
  trialDays: 0,
};

export default function Settings() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [adyen, setAdyen] = useState<AdyenSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAdyen, setSavingAdyen] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [savingPlan, setSavingPlan] = useState(false);
  const [adyenForm, setAdyenForm] = useState({
    merchantAccount: '',
    clientKey: '',
    environment: 'TEST',
    apiKey: '',
    hmacKey: '',
  });

  const load = async () => {
    try {
      setLoading(true);
      const [plansRes, adyenRes] = await Promise.all([
        api.get('/superadmin/plans'),
        api.get('/superadmin/platform-settings/adyen'),
      ]);
      setPlans(plansRes.data.plans || []);
      const a = adyenRes.data.adyen as AdyenSettings;
      setAdyen(a);
      setAdyenForm({
        merchantAccount: a.merchantAccount || '',
        clientKey: a.clientKey || '',
        environment: a.environment || 'TEST',
        apiKey: '',
        hmacKey: '',
      });
    } catch {
      toast.error('Failed to load platform settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setPlanForm({ ...emptyPlan, sortOrder: (plans.length + 1) * 10 });
    setShowPlanForm(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      priceMonthly: String(plan.priceMonthly ?? '0'),
      priceYearly: plan.priceYearly != null ? String(plan.priceYearly) : '',
      currency: plan.currency || 'CHF',
      maxDevices: plan.maxDevices ?? 1,
      maxProducts: plan.maxProducts != null ? String(plan.maxProducts) : '',
      featuresText: (plan.features || []).join('\n'),
      isActive: plan.isActive,
      isPublic: plan.isPublic,
      sortOrder: plan.sortOrder ?? 0,
      trialDays: plan.trialDays ?? 0,
    });
    setShowPlanForm(true);
  };

  const savePlan = async (e: FormEvent) => {
    e.preventDefault();
    if (!planForm.name.trim()) {
      toast.error('License package name is required');
      return;
    }
    setSavingPlan(true);
    try {
      const payload = {
        name: planForm.name.trim(),
        slug: planForm.slug.trim() || planForm.name,
        description: planForm.description || null,
        priceMonthly: Number(planForm.priceMonthly) || 0,
        priceYearly: planForm.priceYearly === '' ? null : Number(planForm.priceYearly),
        currency: planForm.currency || 'CHF',
        maxDevices: Number(planForm.maxDevices) || 1,
        maxProducts: planForm.maxProducts === '' ? null : Number(planForm.maxProducts),
        features: planForm.featuresText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        isActive: planForm.isActive,
        isPublic: planForm.isPublic,
        sortOrder: Number(planForm.sortOrder) || 0,
        trialDays: Number(planForm.trialDays) || 0,
      };
      if (editingId) {
        await api.put(`/superadmin/plans/${editingId}`, payload);
        toast.success('License package updated');
      } else {
        await api.post('/superadmin/plans', payload);
        toast.success('License package created');
      }
      setShowPlanForm(false);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save license package');
    } finally {
      setSavingPlan(false);
    }
  };

  const deactivatePlan = async (plan: Plan) => {
    if (!confirm(`Deactivate license package "${plan.name}"? Merchants will no longer see it.`)) return;
    try {
      await api.delete(`/superadmin/plans/${plan.id}`);
      toast.success('License package deactivated');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to deactivate license package');
    }
  };

  const saveAdyen = async (e: FormEvent) => {
    e.preventDefault();
    setSavingAdyen(true);
    try {
      const res = await api.put('/superadmin/platform-settings/adyen', {
        merchantAccount: adyenForm.merchantAccount,
        clientKey: adyenForm.clientKey,
        environment: adyenForm.environment,
        apiKey: adyenForm.apiKey || undefined,
        hmacKey: adyenForm.hmacKey || undefined,
      });
      setAdyen(res.data.adyen);
      setAdyenForm((f) => ({ ...f, apiKey: '', hmacKey: '' }));
      toast.success('Platform Adyen settings saved');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save Adyen settings');
    } finally {
      setSavingAdyen(false);
    }
  };

  if (loading) {
    return <div className="card">Loading platform settings…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Subscription plans</h1>
            <p className="text-gray-600 mt-1">
              License packages for payment only (devices, price, trial). Feature access is controlled by POS
              versions, not by these packages.
            </p>
          </div>
          <button type="button" className="btn btn-primary flex items-center gap-2" onClick={openCreate}>
            <Plus size={16} /> New license package
          </button>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">License package</th>
                <th className="py-2 pr-3">Monthly</th>
                <th className="py-2 pr-3">Yearly</th>
                <th className="py-2 pr-3">Devices</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Visible</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b last:border-0">
                  <td className="py-3 pr-3">
                    <div className="font-medium">{plan.name}</div>
                    <div className="text-xs text-gray-500">{plan.slug}</div>
                  </td>
                  <td className="py-3 pr-3">
                    {Number(plan.priceMonthly).toFixed(2)} {plan.currency}
                  </td>
                  <td className="py-3 pr-3">
                    {plan.priceYearly != null
                      ? `${Number(plan.priceYearly).toFixed(2)} ${plan.currency}`
                      : '-'}
                  </td>
                  <td className="py-3 pr-3">{plan.maxDevices}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        plan.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 pr-3">{plan.isPublic ? 'Merchants' : 'Admin only'}</td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-gray-100"
                        onClick={() => openEdit(plan)}
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-red-50 text-red-600"
                        onClick={() => void deactivatePlan(plan)}
                        title="Deactivate"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!plans.length && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">
                    No license packages yet. Create one or re-run seed to load defaults.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold">Platform Adyen (subscription payments)</h2>
        <p className="text-gray-600 mt-1 mb-4">
          When merchants buy a subscription, payments settle to <strong>your</strong> Adyen account - not
          the merchant&apos;s shop Adyen credentials.
        </p>

        {adyen && (
          <p className="text-sm mb-4">
            Status:{' '}
            <span className={adyen.configured ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
              {adyen.configured ? 'Configured' : 'Not configured'}
            </span>
            {adyen.usingEnvFallback ? ' (using environment variables)' : null}
          </p>
        )}

        <form onSubmit={saveAdyen} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <label className="block">
            <span className="text-sm font-medium">Merchant account</span>
            <input
              className="input mt-1"
              value={adyenForm.merchantAccount}
              onChange={(e) => setAdyenForm({ ...adyenForm, merchantAccount: e.target.value })}
              placeholder="YourCompanyECOM"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Client key</span>
            <input
              className="input mt-1"
              value={adyenForm.clientKey}
              onChange={(e) => setAdyenForm({ ...adyenForm, clientKey: e.target.value })}
              placeholder="test_…"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Environment</span>
            <select
              className="input mt-1"
              value={adyenForm.environment}
              onChange={(e) => setAdyenForm({ ...adyenForm, environment: e.target.value })}
            >
              <option value="TEST">TEST</option>
              <option value="LIVE">LIVE</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">
              API key {adyen?.apiKeySet ? `(set: ${adyen.apiKeyMasked})` : '(not set)'}
            </span>
            <input
              className="input mt-1"
              type="password"
              autoComplete="new-password"
              value={adyenForm.apiKey}
              onChange={(e) => setAdyenForm({ ...adyenForm, apiKey: e.target.value })}
              placeholder={adyen?.apiKeySet ? 'Leave blank to keep current' : 'AQE…'}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium">
              HMAC key (webhook) {adyen?.hmacKeySet ? `(set: ${adyen.hmacKeyMasked})` : '(optional)'}
            </span>
            <input
              className="input mt-1"
              type="password"
              autoComplete="new-password"
              value={adyenForm.hmacKey}
              onChange={(e) => setAdyenForm({ ...adyenForm, hmacKey: e.target.value })}
              placeholder={adyen?.hmacKeySet ? 'Leave blank to keep current' : 'Optional'}
            />
          </label>
          <div className="md:col-span-2">
            <p className="text-xs text-gray-500 mb-3">
              Webhook URL: <code>/api/webhooks/adyen/subscription</code>
            </p>
            <button type="submit" className="btn btn-primary" disabled={savingAdyen}>
              {savingAdyen ? 'Saving…' : 'Save Adyen settings'}
            </button>
          </div>
        </form>
      </div>

      {showPlanForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                {editingId ? 'Edit license package' : 'New license package'}
              </h3>
              <button type="button" onClick={() => setShowPlanForm(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={savePlan} className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">Name</span>
                <input
                  className="input mt-1"
                  required
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Slug</span>
                <input
                  className="input mt-1"
                  placeholder="auto from name"
                  value={planForm.slug}
                  onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Description</span>
                <textarea
                  className="input mt-1"
                  rows={2}
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm font-medium">Monthly</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.priceMonthly}
                    onChange={(e) => setPlanForm({ ...planForm, priceMonthly: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Yearly</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.priceYearly}
                    onChange={(e) => setPlanForm({ ...planForm, priceYearly: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Currency</span>
                  <input
                    className="input mt-1"
                    value={planForm.currency}
                    onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm font-medium">Max devices</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="1"
                    value={planForm.maxDevices}
                    onChange={(e) => setPlanForm({ ...planForm, maxDevices: Number(e.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Max products</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    placeholder="unlimited"
                    value={planForm.maxProducts}
                    onChange={(e) => setPlanForm({ ...planForm, maxProducts: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Sort order</span>
                  <input
                    className="input mt-1"
                    type="number"
                    value={planForm.sortOrder}
                    onChange={(e) => setPlanForm({ ...planForm, sortOrder: Number(e.target.value) })}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-medium">Features (one per line)</span>
                <textarea
                  className="input mt-1"
                  rows={3}
                  value={planForm.featuresText}
                  onChange={(e) => setPlanForm({ ...planForm, featuresText: e.target.value })}
                />
              </label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={planForm.isActive}
                    onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={planForm.isPublic}
                    onChange={(e) => setPlanForm({ ...planForm, isPublic: e.target.checked })}
                  />
                  Visible to merchants
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn" onClick={() => setShowPlanForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingPlan}>
                  {savingPlan ? 'Saving…' : 'Save license package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
