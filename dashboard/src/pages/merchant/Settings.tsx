import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
  Building2,
  CreditCard,
  Globe2,
  Languages,
  LayoutGrid,
  Percent,
} from 'lucide-react';
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
  customDomain?: string | null;
  shopEnabled?: boolean;
  shopCustomDomainUrl?: string | null;
  floorPlanEnabled?: boolean;
  paxOrderingEnabled?: boolean;
  shopPathUrl?: string | null;
  shopSubdomainUrl?: string | null;
  panelLanguage?: string | null;
  shopLanguage?: string | null;
  subscriptionPlan?: string | null;
  status?: string | null;
  onlineCardFeeFixed?: string | null;
  onlineCardFeePercent?: string | null;
  vacationSettings?: {
    enabled?: boolean;
    manualActive?: boolean;
    popupImageUrl?: string | null;
    popupTitle?: { en?: string | null; fr?: string | null; de?: string | null } | string | null;
    message?: { en?: string | null; fr?: string | null; de?: string | null } | string | null;
    periods?: Array<{
      id: string;
      startDate: string;
      startTime?: string | null;
      endDate: string;
      endTime?: string | null;
      title?: { en?: string | null; fr?: string | null; de?: string | null } | string | null;
    }>;
  } | null;
}

interface AdyenCreds {
  merchantAccount?: string | null;
  clientId?: string | null;
  apiKeyMasked?: string | null;
  apiKeySet?: boolean;
}

interface TerminalRow {
  id: string;
  terminalId: string;
  terminalName: string;
  serialNumber?: string | null;
  status: string;
}

type TabId = 'business' | 'taxes' | 'shop' | 'operations' | 'payments' | 'language';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-[var(--text)]">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] muted break-all">{hint}</span> : null}
    </label>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? <p className="page-sub mt-1">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

type LocalizedMap = { en?: string | null; fr?: string | null; de?: string | null };

function asLocalized(raw: LocalizedMap | string | null | undefined): LocalizedMap {
  if (raw == null) return { en: '', fr: '', de: '' };
  if (typeof raw === 'string') return { en: raw, fr: raw, de: raw };
  return {
    en: raw.en || '',
    fr: raw.fr || '',
    de: raw.de || '',
  };
}

function LocalizedFields({
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string;
  value: LocalizedMap | string | null | undefined;
  onChange: (next: LocalizedMap) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const loc = asLocalized(value);
  const setLang = (lang: keyof LocalizedMap, v: string) => onChange({ ...loc, [lang]: v });
  const InputTag = multiline ? 'textarea' : 'input';
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-[var(--text)]">{label}</span>
      {(['en', 'fr', 'de'] as const).map((lang) => (
        <label key={lang} className="block space-y-1">
          <span className="text-[11px] muted uppercase tracking-wide">{lang}</span>
          <InputTag
            className={`input ${multiline ? 'min-h-[3.5rem]' : ''}`}
            value={loc[lang] || ''}
            onChange={(e) => setLang(lang, e.target.value)}
            placeholder={placeholder}
          />
        </label>
      ))}
    </div>
  );
}

export default function Settings() {
  const { t, setLocale, locale } = useI18n();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [adyen, setAdyen] = useState<AdyenCreds>({});
  const [merchantAccount, setMerchantAccount] = useState('');
  const [clientId, setClientId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [cardFeeFixed, setCardFeeFixed] = useState('0');
  const [cardFeePercent, setCardFeePercent] = useState('0');
  const [terminals, setTerminals] = useState<TerminalRow[]>([]);
  const [terminalId, setTerminalId] = useState('');
  const [terminalName, setTerminalName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAdyen, setSavingAdyen] = useState(false);
  const [savingFee, setSavingFee] = useState(false);
  const [savingTerminal, setSavingTerminal] = useState(false);
  const vacationImageInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<TabId>(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('tab');
      if (q === 'payments') return 'payments';
    } catch {
      /* ignore */
    }
    return 'business';
  });

  const tabs = useMemo(
    () =>
      [
        { id: 'business' as const, label: t('settingsBusiness'), icon: Building2 },
        { id: 'taxes' as const, label: t('settingsTaxes'), icon: Percent },
        { id: 'shop' as const, label: t('shop'), icon: Globe2 },
        { id: 'operations' as const, label: t('settingsOperations'), icon: LayoutGrid },
        { id: 'payments' as const, label: t('settingsPayments'), icon: CreditCard },
        { id: 'language' as const, label: t('language'), icon: Languages },
      ] as const,
    [t]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, terminalsRes] = await Promise.all([
          api.get('/merchant/settings'),
          api.get('/terminals').catch(() => ({ data: { adyen: {}, terminals: [] } })),
        ]);
        const s = settingsRes.data.settings;
        setSettings(s);
        setCardFeeFixed(String(s?.onlineCardFeeFixed ?? '0'));
        setCardFeePercent(String(s?.onlineCardFeePercent ?? '0'));
        const a = terminalsRes.data.adyen || {};
        setAdyen(a);
        setMerchantAccount(a.merchantAccount || '');
        setClientId(a.clientId || '');
        setTerminals(terminalsRes.data.terminals || []);

        const stored = localStorage.getItem('manupos_panel_lang');
        if (
          (!stored || !['en', 'fr', 'de'].includes(stored)) &&
          s?.panelLanguage &&
          ['en', 'fr', 'de'].includes(s.panelLanguage)
        ) {
          setLocale(s.panelLanguage as Locale);
        } else if (stored && ['en', 'fr', 'de'].includes(stored)) {
          setSettings((prev) => (prev ? { ...prev, panelLanguage: stored } : prev));
        }
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const response = await api.put('/merchant/settings', {
        name: settings.name,
        phone: settings.phone,
        address: settings.address,
        city: settings.city,
        country: settings.country,
        vatNumber: settings.vatNumber,
        vatRate: settings.vatRate ? Number(settings.vatRate) : undefined,
        taxTakeawayRate:
          settings.taxTakeawayRate != null ? Number(settings.taxTakeawayRate) : undefined,
        taxDineInRate: settings.taxDineInRate != null ? Number(settings.taxDineInRate) : undefined,
        taxDeliveryRate:
          settings.taxDeliveryRate != null ? Number(settings.taxDeliveryRate) : undefined,
        slug: settings.slug || undefined,
        subdomain: settings.subdomain || undefined,
        customDomain: settings.customDomain?.trim() || null,
        shopEnabled: !!settings.shopEnabled,
        floorPlanEnabled: !!settings.floorPlanEnabled,
        paxOrderingEnabled: !!settings.paxOrderingEnabled,
        panelLanguage: settings.panelLanguage || locale,
        vacationSettings: settings.vacationSettings || {
          enabled: false,
          popupImageUrl: null,
          popupTitle: null,
          message: null,
          periods: [],
        },
      });
      const next = response.data.merchant || response.data.settings || settings;
      setSettings((prev) => (prev ? { ...prev, ...next } : prev));
      if (next.panelLanguage) setLocale(next.panelLanguage as Locale);
      toast.success(t('settingsSaved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const saveAdyen = async (e: FormEvent) => {
    e.preventDefault();
    setSavingAdyen(true);
    try {
      const response = await api.put('/terminals/adyen-credentials', {
        adyenMerchantAccount: merchantAccount,
        adyenApiKey: apiKey || undefined,
        adyenClientId: clientId,
      });
      setAdyen(response.data.adyen || {});
      setApiKey('');
      toast.success(t('adyenSaved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save Swisspayout credentials');
    } finally {
      setSavingAdyen(false);
    }
  };

  const saveCardFees = async (e: FormEvent) => {
    e.preventDefault();
    setSavingFee(true);
    try {
      const response = await api.put('/merchant/settings', {
        onlineCardFeeFixed: Number(cardFeeFixed) || 0,
        onlineCardFeePercent: Number(cardFeePercent) || 0,
      });
      const next = response.data.merchant || response.data.settings || {};
      setSettings((prev) => (prev ? { ...prev, ...next } : prev));
      setCardFeeFixed(String(next.onlineCardFeeFixed ?? cardFeeFixed));
      setCardFeePercent(String(next.onlineCardFeePercent ?? cardFeePercent));
      toast.success(t('cardFeesSaved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('failedSaveCardFees'));
    } finally {
      setSavingFee(false);
    }
  };

  const addTerminal = async (e: FormEvent) => {
    e.preventDefault();
    if (!terminalId.trim()) {
      toast.error(t('terminalIdRequired'));
      return;
    }
    setSavingTerminal(true);
    try {
      await api.post('/terminals', {
        terminalId: terminalId.trim(),
        terminalName: terminalName.trim() || terminalId.trim(),
        serialNumber: terminalId.trim(),
      });
      toast.success(t('terminalAdded'));
      setTerminalId('');
      setTerminalName('');
      const res = await api.get('/terminals');
      setTerminals(res.data.terminals || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('failedAddTerminal'));
    } finally {
      setSavingTerminal(false);
    }
  };

  const removeTerminal = async (id: string) => {
    try {
      await api.delete(`/terminals/${id}`);
      setTerminals((prev) => prev.filter((t) => t.id !== id));
      toast.success(t('terminalRemoved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('failedRemoveTerminal'));
    }
  };

  if (loading) {
    return <div className="text-center py-12 muted text-sm">{t('loading')}</div>;
  }
  if (!settings) {
    return <div className="card">{t('settingsLoadError')}</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3 sm:space-y-4">
      <div>
        <h1 className="page-title">{t('settings')}</h1>
        <p className="page-sub">
          {t('settingsFor')} <span className="font-medium text-[var(--text)]">{settings.name}</span>
        </p>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-[var(--border)] overflow-x-auto">
          <nav className="flex min-w-max gap-0.5 px-2 py-2" aria-label={t('settings')}>
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex min-w-[4.75rem] flex-col items-center gap-1 rounded-md px-3 py-2 text-[11px] font-medium transition-colors ${
                    active
                      ? 'bg-[var(--bg-muted)] text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 sm:p-5">
          {tab === 'business' && (
            <form onSubmit={onSave} className="space-y-5">
              <Section title={t('businessSettings')} description={t('businessSettingsHint')}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={t('businessName')}>
                    <input
                      className="input"
                      value={settings.name}
                      onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label={t('businessEmail')}>
                    <input className="input bg-[var(--bg-muted)]" value={settings.email} disabled />
                  </Field>
                  <Field label={t('phone')}>
                    <input
                      className="input"
                      value={settings.phone || ''}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    />
                  </Field>
                  <Field label={t('vatNumber')}>
                    <input
                      className="input"
                      value={settings.vatNumber || ''}
                      onChange={(e) => setSettings({ ...settings, vatNumber: e.target.value })}
                      placeholder="CHE-000.000.000 MWST"
                    />
                  </Field>
                  <Field label={t('address')}>
                    <input
                      className="input"
                      value={settings.address || ''}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    />
                  </Field>
                  <Field label={t('city')}>
                    <input
                      className="input"
                      value={settings.city || ''}
                      onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                    />
                  </Field>
                  <Field label={t('country')}>
                    <input
                      className="input"
                      value={settings.country || ''}
                      onChange={(e) => setSettings({ ...settings, country: e.target.value })}
                    />
                  </Field>
                </div>
              </Section>

              <Section title={t('vacationHolidays')} description={t('vacationHolidaysHint')}>
                <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!settings.vacationSettings?.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        vacationSettings: {
                          ...(settings.vacationSettings || { periods: [] }),
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <span className="font-medium block">{t('vacationEnabled')}</span>
                    <span className="text-xs muted">{t('vacationEnabledHint')}</span>
                  </span>
                </label>

                <div className="rounded-md border-2 border-dashed border-[var(--border)] bg-[var(--bg-muted)] p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">{t('vacationPopupImage')}</p>
                    <p className="text-xs muted mt-0.5">{t('vacationPopupImageHint')}</p>
                  </div>
                  {settings.vacationSettings?.popupImageUrl ? (
                    <img
                      src={settings.vacationSettings.popupImageUrl}
                      alt=""
                      className="max-h-44 w-auto max-w-full border border-[var(--border)] object-contain bg-[var(--bg-elevated)]"
                    />
                  ) : (
                    <button
                      type="button"
                      className="w-full min-h-[7rem] rounded-md border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] text-sm text-[var(--text-muted)] hover:border-[var(--text)] hover:text-[var(--text)] transition-colors"
                      onClick={() => vacationImageInputRef.current?.click()}
                    >
                      {t('vacationUploadImage')}
                    </button>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={vacationImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        try {
                          const form = new FormData();
                          form.append('file', file);
                          const res = await api.post('/merchant/media', form, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                          });
                          const url = res.data?.url;
                          if (!url) throw new Error('No URL returned');
                          setSettings({
                            ...settings,
                            vacationSettings: {
                              ...(settings.vacationSettings || { periods: [] }),
                              popupImageUrl: url,
                            },
                          });
                          toast.success(t('vacationImageUploaded'));
                        } catch (error: any) {
                          toast.error(
                            error.response?.data?.error || t('vacationImageUploadFailed')
                          );
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => vacationImageInputRef.current?.click()}
                    >
                      {t('vacationUploadImage')}
                    </button>
                    {settings.vacationSettings?.popupImageUrl ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            vacationSettings: {
                              ...(settings.vacationSettings || { periods: [] }),
                              popupImageUrl: '',
                            },
                          })
                        }
                      >
                        {t('vacationClearImage')}
                      </button>
                    ) : null}
                  </div>
                  <Field label={t('vacationOrPasteUrl')}>
                    <input
                      className="input"
                      value={settings.vacationSettings?.popupImageUrl || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          vacationSettings: {
                            ...(settings.vacationSettings || { periods: [] }),
                            popupImageUrl: e.target.value,
                          },
                        })
                      }
                      placeholder="https://…"
                    />
                  </Field>
                </div>

                <LocalizedFields
                  label={t('vacationPopupTitle')}
                  value={settings.vacationSettings?.popupTitle}
                  placeholder={t('vacationPopupTitlePlaceholder')}
                  onChange={(popupTitle) =>
                    setSettings({
                      ...settings,
                      vacationSettings: {
                        ...(settings.vacationSettings || { periods: [] }),
                        popupTitle,
                      },
                    })
                  }
                />
                <LocalizedFields
                  label={t('vacationMessage')}
                  value={settings.vacationSettings?.message}
                  multiline
                  placeholder={t('vacationMessagePlaceholder')}
                  onChange={(message) =>
                    setSettings({
                      ...settings,
                      vacationSettings: {
                        ...(settings.vacationSettings || { periods: [] }),
                        message,
                      },
                    })
                  }
                />
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{t('vacationPeriods')}</span>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => {
                        const id =
                          typeof crypto !== 'undefined' && crypto.randomUUID
                            ? crypto.randomUUID()
                            : `p-${Date.now()}`;
                        const today = new Date().toISOString().slice(0, 10);
                        setSettings({
                          ...settings,
                          vacationSettings: {
                            ...(settings.vacationSettings || {}),
                            periods: [
                              ...(settings.vacationSettings?.periods || []),
                              {
                                id,
                                startDate: today,
                                startTime: '00:00',
                                endDate: today,
                                endTime: '23:59',
                              },
                            ],
                          },
                        });
                      }}
                    >
                      {t('vacationAddPeriod')}
                    </button>
                  </div>
                  <p className="text-xs muted">{t('vacationPeriodsHint')}</p>
                  {(settings.vacationSettings?.periods || []).length === 0 ? (
                    <p className="text-xs muted">{t('vacationEmptyPeriods')}</p>
                  ) : (
                    <div className="space-y-3">
                      {(settings.vacationSettings?.periods || []).map((period, idx) => (
                        <div
                          key={period.id || idx}
                          className="rounded-md border border-[var(--border)] p-3 space-y-2"
                        >
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <Field label={t('vacationStart')}>
                              <input
                                className="input"
                                type="date"
                                value={period.startDate}
                                onChange={(e) => {
                                  const periods = [...(settings.vacationSettings?.periods || [])];
                                  periods[idx] = { ...period, startDate: e.target.value };
                                  setSettings({
                                    ...settings,
                                    vacationSettings: { ...settings.vacationSettings, periods },
                                  });
                                }}
                                required
                              />
                            </Field>
                            <Field label={t('vacationStartTime')}>
                              <input
                                className="input"
                                type="time"
                                value={period.startTime || '00:00'}
                                onChange={(e) => {
                                  const periods = [...(settings.vacationSettings?.periods || [])];
                                  periods[idx] = { ...period, startTime: e.target.value };
                                  setSettings({
                                    ...settings,
                                    vacationSettings: { ...settings.vacationSettings, periods },
                                  });
                                }}
                              />
                            </Field>
                            <Field label={t('vacationEnd')}>
                              <input
                                className="input"
                                type="date"
                                value={period.endDate}
                                min={period.startDate}
                                onChange={(e) => {
                                  const periods = [...(settings.vacationSettings?.periods || [])];
                                  periods[idx] = { ...period, endDate: e.target.value };
                                  setSettings({
                                    ...settings,
                                    vacationSettings: { ...settings.vacationSettings, periods },
                                  });
                                }}
                                required
                              />
                            </Field>
                            <Field label={t('vacationEndTime')}>
                              <input
                                className="input"
                                type="time"
                                value={period.endTime || '23:59'}
                                onChange={(e) => {
                                  const periods = [...(settings.vacationSettings?.periods || [])];
                                  periods[idx] = { ...period, endTime: e.target.value };
                                  setSettings({
                                    ...settings,
                                    vacationSettings: { ...settings.vacationSettings, periods },
                                  });
                                }}
                              />
                            </Field>
                          </div>
                          <button
                            type="button"
                            className="text-xs text-red-700 underline"
                            onClick={() => {
                              const periods = (settings.vacationSettings?.periods || []).filter(
                                (_, i) => i !== idx
                              );
                              setSettings({
                                ...settings,
                                vacationSettings: { ...settings.vacationSettings, periods },
                              });
                            }}
                          >
                            {t('vacationRemove')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
                <p className="text-xs muted">
                  {t('plan')}: {settings.subscriptionPlan || 'free'} · {t('status')}:{' '}
                  {settings.status || 'active'}
                </p>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          )}

          {tab === 'taxes' && (
            <form onSubmit={onSave} className="space-y-5">
              <Section title={t('taxRates')} description={t('taxRatesHint')}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={`${t('defaultVatRate')} (%)`}>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={settings.vatRate || ''}
                      onChange={(e) => setSettings({ ...settings, vatRate: e.target.value })}
                    />
                  </Field>
                  <Field label={`${t('takeaway')} (%)`}>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={settings.taxTakeawayRate ?? settings.vatRate ?? ''}
                      onChange={(e) => setSettings({ ...settings, taxTakeawayRate: e.target.value })}
                    />
                  </Field>
                  <Field label={`${t('dineIn')} (%)`}>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={settings.taxDineInRate ?? settings.vatRate ?? ''}
                      onChange={(e) => setSettings({ ...settings, taxDineInRate: e.target.value })}
                    />
                  </Field>
                  <Field label={`${t('delivery')} (%)`}>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={settings.taxDeliveryRate ?? settings.vatRate ?? ''}
                      onChange={(e) => setSettings({ ...settings, taxDeliveryRate: e.target.value })}
                    />
                  </Field>
                </div>
              </Section>
              <div className="flex justify-end border-t border-[var(--border)] pt-4">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          )}

          {tab === 'shop' && (
            <form onSubmit={onSave} className="space-y-5">
              <Section title={t('shop')} description={t('shopSettingsHint')}>
                <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!settings.shopEnabled}
                    onChange={(e) => setSettings({ ...settings, shopEnabled: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium block">{t('enableOnlineShop')}</span>
                    <span className="text-xs muted">{t('enableOnlineShopHint')}</span>
                  </span>
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label={t('shopSlug')}
                    hint={settings.shopPathUrl || t('shopSlugHint')}
                  >
                    <input
                      className="input"
                      value={settings.slug || ''}
                      onChange={(e) => setSettings({ ...settings, slug: e.target.value })}
                      placeholder="my-cafe"
                    />
                  </Field>
                  <Field label={t('cmsCustomDomain')} hint={settings.shopCustomDomainUrl || undefined}>
                    <p className="text-xs muted mb-1.5">{t('cmsDnsGoCreate')}</p>
                    <table className="w-full max-w-md text-xs border border-[var(--border)]">
                      <tbody>
                        <tr className="border-b border-[var(--border)]">
                          <th className="bg-[var(--bg-muted)] px-2 py-1.5 text-left font-medium w-24">
                            Type
                          </th>
                          <td className="px-2 py-1.5 font-mono">CNAME</td>
                        </tr>
                        <tr className="border-b border-[var(--border)]">
                          <th className="bg-[var(--bg-muted)] px-2 py-1.5 text-left font-medium">
                            Host
                          </th>
                          <td className="px-2 py-1.5 font-mono">www</td>
                        </tr>
                        <tr>
                          <th className="bg-[var(--bg-muted)] px-2 py-1.5 text-left font-medium">
                            Points to
                          </th>
                          <td className="px-2 py-1.5 font-mono">shop.chaslay.com</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="text-xs muted mt-1.5 mb-1.5">{t('cmsDnsThenEnter')}</p>
                    <input
                      className="input"
                      value={settings.customDomain || ''}
                      onChange={(e) => setSettings({ ...settings, customDomain: e.target.value })}
                      placeholder="www.mycafe.ch"
                    />
                  </Field>
                </div>
              </Section>
              <div className="flex justify-end border-t border-[var(--border)] pt-4">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          )}

          {tab === 'operations' && (
            <form onSubmit={onSave} className="space-y-5">
              <Section title={t('floorPlan')} description={t('floorPlanSettingsHint')}>
                <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!settings.floorPlanEnabled}
                    onChange={(e) => setSettings({ ...settings, floorPlanEnabled: e.target.checked })}
                  />
                  <span className="font-medium">{t('floorPlanEnabled')}</span>
                </label>
                <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!settings.paxOrderingEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        paxOrderingEnabled: e.target.checked,
                        floorPlanEnabled: e.target.checked ? true : settings.floorPlanEnabled,
                      })
                    }
                  />
                  <span>
                    <span className="font-medium block">{t('paxOrderingEnabled')}</span>
                    <span className="text-xs muted">{t('paxOrderingHint')}</span>
                  </span>
                </label>
              </Section>

              <div className="border-t border-[var(--border)] pt-4">
                <Section title={t('webPos')} description={t('webPosHint')}>
                  <a href="/merchant/pos" className="btn-secondary inline-flex">
                    {t('openWebPos')}
                  </a>
                </Section>
              </div>

              <div className="flex justify-end border-t border-[var(--border)] pt-4">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          )}

          {tab === 'payments' && (
            <div className="space-y-8">
              <form onSubmit={saveAdyen} className="space-y-5">
                <Section title={t('adyenCredentials')} description={t('adyenSettingsHint')}>
                  <p className="text-sm text-[var(--text-muted)]">
                    {t('swisspayoutNoAccount')}{' '}
                    <a
                      href="https://swisspayout.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[var(--text)] underline underline-offset-2"
                    >
                      {t('swisspayoutCreateAccount')}
                    </a>
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={t('merchantAccount')}>
                      <input
                        className="input"
                        value={merchantAccount}
                        onChange={(e) => setMerchantAccount(e.target.value)}
                        placeholder="ManuPOS_COM"
                      />
                    </Field>
                    <Field label={t('clientId')}>
                      <input
                        className="input"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field
                        label={t('apiKey')}
                        hint={
                          adyen.apiKeySet
                            ? `${t('currentKey')}: ${adyen.apiKeyMasked || '••••'}`
                            : t('apiKeyHint')
                        }
                      >
                        <input
                          className="input"
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={adyen.apiKeySet ? adyen.apiKeyMasked || '••••' : 'AQE...'}
                          autoComplete="new-password"
                        />
                      </Field>
                    </div>
                  </div>
                </Section>
                <div className="flex justify-end border-t border-[var(--border)] pt-4">
                  <button type="submit" className="btn-primary" disabled={savingAdyen}>
                    {savingAdyen ? t('saving') : t('save')}
                  </button>
                </div>
              </form>

              <form onSubmit={saveCardFees} className="space-y-5 border-t border-[var(--border)] pt-6">
                <Section title={t('onlineCardFees')} description={t('onlineCardFeesHint')}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={t('cardFeeFixed')} hint={t('cardFeeFixedHint')}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.05"
                        value={cardFeeFixed}
                        onChange={(e) => setCardFeeFixed(e.target.value)}
                      />
                    </Field>
                    <Field label={t('cardFeePercent')} hint={t('cardFeePercentHint')}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={cardFeePercent}
                        onChange={(e) => setCardFeePercent(e.target.value)}
                      />
                    </Field>
                  </div>
                </Section>
                <div className="flex justify-end border-t border-[var(--border)] pt-4">
                  <button type="submit" className="btn-primary" disabled={savingFee}>
                    {savingFee ? t('saving') : t('save')}
                  </button>
                </div>
              </form>

              <div className="space-y-5 border-t border-[var(--border)] pt-6">
                <Section title={t('paymentTerminals')} description={t('paymentTerminalsHint')}>
                  <form onSubmit={addTerminal} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Field label={`${t('terminalId')} *`} hint={t('terminalIdHint')}>
                      <input
                        className="input"
                        value={terminalId}
                        onChange={(e) => setTerminalId(e.target.value)}
                        placeholder="S1F2-000158213131044"
                        required
                      />
                    </Field>
                    <Field label={t('terminalName')} hint={t('terminalNameHint')}>
                      <input
                        className="input"
                        value={terminalName}
                        onChange={(e) => setTerminalName(e.target.value)}
                        placeholder={t('terminalNamePlaceholder')}
                      />
                    </Field>
                    <div className="flex items-end">
                      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={savingTerminal}>
                        {savingTerminal ? t('saving') : t('addTerminal')}
                      </button>
                    </div>
                  </form>

                  <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left muted">
                          <th className="px-3 py-2 font-medium">{t('terminalName')}</th>
                          <th className="px-3 py-2 font-medium">{t('terminalId')}</th>
                          <th className="px-3 py-2 font-medium">{t('status')}</th>
                          <th className="px-3 py-2 font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {terminals.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-3 py-6 muted">
                              {t('noTerminals')}
                            </td>
                          </tr>
                        )}
                        {terminals.map((term) => (
                          <tr key={term.id} className="border-b border-[var(--border)] last:border-0">
                            <td className="px-3 py-2.5 font-medium">{term.terminalName}</td>
                            <td className="px-3 py-2.5 font-mono text-xs">{term.terminalId}</td>
                            <td className="px-3 py-2.5 capitalize">{term.status}</td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                className="text-xs font-semibold text-red-600 hover:underline"
                                onClick={() => void removeTerminal(term.id)}
                              >
                                {t('delete')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              </div>
            </div>
          )}

          {tab === 'language' && (
            <div className="space-y-5">
              <Section title={t('language')} description={t('languageSettingsHint')}>
                <Field label={t('panelLanguage')} hint={t('panelLanguageHint')}>
                  <select
                    className="input"
                    value={settings.panelLanguage || locale}
                    onChange={async (e) => {
                      const lang = e.target.value as Locale;
                      setSettings({ ...settings, panelLanguage: lang });
                      setLocale(lang);
                      try {
                        await api.put('/merchant/settings', { panelLanguage: lang });
                        toast.success(t('languageSaved'));
                      } catch (error: any) {
                        toast.error(error.response?.data?.error || t('failedSaveLanguage'));
                      }
                    }}
                  >
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </Field>
                <Field label={t('shopLanguage')} hint={t('shopLanguageHint')}>
                  <select
                    className="input"
                    value={settings.shopLanguage || settings.panelLanguage || 'en'}
                    onChange={async (e) => {
                      const lang = e.target.value as Locale;
                      setSettings({ ...settings, shopLanguage: lang });
                      try {
                        await api.put('/merchant/settings', { shopLanguage: lang });
                        toast.success(t('languageSaved'));
                      } catch (error: any) {
                        toast.error(error.response?.data?.error || t('failedSaveLanguage'));
                      }
                    }}
                  >
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </Field>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
