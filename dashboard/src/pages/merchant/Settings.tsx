import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n, type Locale } from '@/lib/i18n';

interface SettingsData {
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  vatNumber?: string | null;
  vatRate?: string | null;
  taxTakeawayRate?: string | null;
  taxDineInRate?: string | null;
  taxDeliveryRate?: string | null;
  slug?: string | null;
  subdomain?: string | null;
  shopEnabled?: boolean;
  floorPlanEnabled?: boolean;
  paxOrderingEnabled?: boolean;
  shopPathUrl?: string | null;
  shopSubdomainUrl?: string | null;
  panelLanguage?: string | null;
  subscriptionPlan?: string | null;
  status?: string | null;
}

export default function Settings() {
  const { t, setLocale, locale } = useI18n();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/merchant/settings');
        const s = response.data.settings;
        setSettings(s);
        // Prefer local browser choice; only adopt server language if none stored yet.
        const stored = localStorage.getItem('manupos_panel_lang');
        if ((!stored || !['en', 'fr', 'de'].includes(stored)) && s?.panelLanguage && ['en', 'fr', 'de'].includes(s.panelLanguage)) {
          setLocale(s.panelLanguage as Locale);
        } else if (stored && ['en', 'fr', 'de'].includes(stored)) {
          setSettings((prev: SettingsData | null) =>
            prev ? { ...prev, panelLanguage: stored } : prev
          );
        }
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const response = await api.put('/merchant/settings', {
        phone: settings.phone,
        address: settings.address,
        city: settings.city,
        country: settings.country,
        vatNumber: settings.vatNumber,
        vatRate: settings.vatRate ? Number(settings.vatRate) : undefined,
        taxTakeawayRate: settings.taxTakeawayRate != null ? Number(settings.taxTakeawayRate) : undefined,
        taxDineInRate: settings.taxDineInRate != null ? Number(settings.taxDineInRate) : undefined,
        taxDeliveryRate: settings.taxDeliveryRate != null ? Number(settings.taxDeliveryRate) : undefined,
        slug: settings.slug || undefined,
        subdomain: settings.subdomain || undefined,
        shopEnabled: !!settings.shopEnabled,
        floorPlanEnabled: !!settings.floorPlanEnabled,
        paxOrderingEnabled: !!settings.paxOrderingEnabled,
        panelLanguage: settings.panelLanguage || locale,
      });
      const next = response.data.merchant || response.data.settings || settings;
      setSettings((prev) => (prev ? { ...prev, ...next } : prev));
      if (next.panelLanguage) setLocale(next.panelLanguage as Locale);
      toast.success('Settings saved');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12">Loading settings...</div>;
  if (!settings) return <div className="card">Could not load settings.</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="card">
        <h1 className="text-2xl font-bold mb-2">{t('settings')}</h1>
        <p className="text-gray-600 mb-6">Business profile for {settings.name}</p>

        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('language')}</label>
            <select
              className="input"
              value={settings.panelLanguage || locale}
              onChange={async (e) => {
                const lang = e.target.value as Locale;
                setSettings({ ...settings, panelLanguage: lang });
                setLocale(lang);
                try {
                  await api.put('/merchant/settings', { panelLanguage: lang });
                  toast.success(lang === 'de' ? 'Sprache gespeichert' : lang === 'fr' ? 'Langue enregistrée' : 'Language saved');
                } catch (error: any) {
                  toast.error(error.response?.data?.error || 'Failed to save language');
                }
              }}
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Business email</label>
            <input className="input bg-gray-50" value={settings.email} disabled />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              className="input"
              value={settings.phone || ''}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <input
              className="input"
              value={settings.address || ''}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input
                className="input"
                value={settings.city || ''}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <input
                className="input"
                value={settings.country || ''}
                onChange={(e) => setSettings({ ...settings, country: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">VAT number</label>
              <input
                className="input"
                value={settings.vatNumber || ''}
                onChange={(e) => setSettings({ ...settings, vatNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Default VAT rate (%)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={settings.vatRate || ''}
                onChange={(e) => setSettings({ ...settings, vatRate: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h2 className="font-semibold mb-3">{t('taxRates')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('takeaway')} (%)</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={settings.taxTakeawayRate ?? settings.vatRate ?? ''}
                  onChange={(e) => setSettings({ ...settings, taxTakeawayRate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('dineIn')} (%)</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={settings.taxDineInRate ?? settings.vatRate ?? ''}
                  onChange={(e) => setSettings({ ...settings, taxDineInRate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('delivery')} (%)</label>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={settings.taxDeliveryRate ?? settings.vatRate ?? ''}
                  onChange={(e) => setSettings({ ...settings, taxDeliveryRate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h2 className="font-semibold">{t('webPos')}</h2>
            <p className="text-sm text-gray-600">
              Browser POS: open <a className="text-indigo-600 underline" href="/merchant/pos">WebPOS</a>.
              For USB thermal printers on Windows, run <strong>ManuPOS Desktop</strong> (see repo <code>desktop/</code>) —
              it starts a local print agent on <code>127.0.0.1:9101</code>.
            </p>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h2 className="font-semibold">{t('floorPlan')}</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!settings.floorPlanEnabled}
                onChange={(e) => setSettings({ ...settings, floorPlanEnabled: e.target.checked })}
              />
              {t('floorPlanEnabled')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!settings.paxOrderingEnabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    paxOrderingEnabled: e.target.checked,
                    floorPlanEnabled: e.target.checked ? true : settings.floorPlanEnabled,
                  })
                }
              />
              {t('paxOrderingEnabled')}
            </label>
            <p className="text-xs text-gray-500">
              When PAX is on: order each guest separately (kitchen ticket: Person-1…), bill per person, or split total /N at checkout.
            </p>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h2 className="font-semibold">{t('shop')}</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!settings.shopEnabled}
                onChange={(e) => setSettings({ ...settings, shopEnabled: e.target.checked })}
              />
              Enable online shop (orders appear in POS)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Shop slug (path)</label>
                <input
                  className="input"
                  value={settings.slug || ''}
                  onChange={(e) => setSettings({ ...settings, slug: e.target.value })}
                  placeholder="my-cafe"
                />
                {settings.shopPathUrl && (
                  <p className="text-xs text-gray-500 mt-1 break-all">{settings.shopPathUrl}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('subdomain')}</label>
                <input
                  className="input"
                  value={settings.subdomain || ''}
                  onChange={(e) => setSettings({ ...settings, subdomain: e.target.value })}
                  placeholder="mycafé → mycafe"
                />
                {settings.shopSubdomainUrl && (
                  <p className="text-xs text-gray-500 mt-1 break-all">{settings.shopSubdomainUrl}</p>
                )}
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500">
            Plan: {settings.subscriptionPlan || 'free'} · Status: {settings.status || 'active'}
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : t('save')}
          </button>
        </form>
      </div>
    </div>
  );
}
