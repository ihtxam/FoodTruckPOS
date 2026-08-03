import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
  Building2,
  CreditCard,
  Globe2,
  Languages,
  Mail,
  Monitor,
  Percent,
  Printer,
  Search,
  UtensilsCrossed,
} from 'lucide-react';
import api from '@/lib/api';
import { dashboardVersionLabel } from '@/lib/app-version';
import { useI18n, type Locale } from '@/lib/i18n';
import { compressImageIfNeeded } from '@/lib/compress-image';
import FloorPlan from './FloorPlan';

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
  taxIncludedInPrice?: boolean;
  slug?: string | null;
  subdomain?: string | null;
  customDomain?: string | null;
  shopEnabled?: boolean;
  acceptingOrders?: boolean;
  acceptingReservations?: boolean;
  reservationsEnabled?: boolean;
  shopCustomDomainUrl?: string | null;
  floorPlanEnabled?: boolean;
  paxOrderingEnabled?: boolean;
  coursesEnabled?: boolean;
  shiftsEnabled?: boolean;
  posColorTheme?: string;
  posCheckoutSettings?: {
    tipsEnabled?: boolean;
    tipPresetsPercent?: number[];
    allowCustomTip?: boolean;
    discountsEnabled?: boolean;
    discountPresets?: Array<{ id: string; name: string; percent: number }>;
    roundingStep?: number;
    quickCashEnabled?: boolean;
    quickCashDenominations?: number[];
    splitBillsEnabled?: boolean;
    maxSplitParts?: number;
    courseSendMode?: 'fire_per_course' | 'send_all_once';
    cartSide?: 'left' | 'right';
    postSuccessTarget?: 'register' | 'tables';
  } | null;
  shopPathUrl?: string | null;
  shopSubdomainUrl?: string | null;
  panelLanguage?: string | null;
  shopLanguage?: string | null;
  subscriptionPlan?: string | null;
  status?: string | null;
  onlineCardFeeFixed?: string | null;
  onlineCardFeePercent?: string | null;
  webposExpressEnabled?: boolean;
  webposCashEnabled?: boolean;
  webposCardEnabled?: boolean;
  webposTerminalEnabled?: boolean;
  adyenLiveEnvironment?: boolean;
  adyenUseLegacyEndpoint?: boolean;
  emailSmtpSettings?: {
    enabled?: boolean;
    host?: string | null;
    port?: number | null;
    secure?: boolean;
    user?: string | null;
    passwordSet?: boolean;
    fromEmail?: string | null;
    fromName?: string | null;
  } | null;
  marketingSettings?: {
    reorderReminderEnabled?: boolean;
    reorderReminderDays?: number;
    reorderReminderSubject?: string | null;
    reorderReminderBody?: string | null;
  } | null;
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
  shopLogoUrl?: string | null;
  posPrintSettings?: {
    receiptHeader?: string;
    receiptFooter?: string;
    kitchenTicketHeader?: string;
    kitchenTicketFooter?: string;
    kitchenItemTextScale?: 1 | 2 | 3;
    kitchenHeaderTextScale?: 1 | 2 | 3;
    kitchenBoldText?: boolean;
    receiptShowVatTable?: boolean;
    receiptShowStaffLine?: boolean;
    receiptShowQrCode?: boolean;
    paperWidthMm?: 58 | 80;
    receiptLanguage?: 'en' | 'fr' | 'de' | 'panel';
    receiptLogoUrl?: string | null;
    autoPrintReceipt?: boolean;
    autoPrintKitchen?: boolean;
    printers?: Array<{
      id: string;
      name: string;
      enabled?: boolean;
      paperWidthMm?: 58 | 80;
      printReceipts?: boolean;
      printKitchenTickets?: boolean;
      printEndOfDayReports?: boolean;
      printAllProducts?: boolean;
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

type TabId =
  | 'business'
  | 'taxes'
  | 'tables'
  | 'shop'
  | 'pos'
  | 'payments'
  | 'receipt'
  | 'email'
  | 'language';

type SettingsSearchEntry = {
  id: string;
  tab: TabId;
  keywords: string[];
};

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
  id,
  highlight,
  dimmed,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
  highlight?: boolean;
  dimmed?: boolean;
}) {
  return (
    <section
      id={id}
      data-settings-section={id}
      className={`space-y-4 rounded-md transition-colors ${
        highlight ? 'bg-[var(--bg-muted)] ring-2 ring-[var(--ring)] p-3 sm:p-4' : ''
      } ${dimmed ? 'opacity-40' : ''}`}
    >
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
  const [smtpPassword, setSmtpPassword] = useState('');
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [terminals, setTerminals] = useState<TerminalRow[]>([]);
  const [terminalId, setTerminalId] = useState('');
  const [terminalName, setTerminalName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAdyen, setSavingAdyen] = useState(false);
  const [savingFee, setSavingFee] = useState(false);
  const [savingWebposPay, setSavingWebposPay] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [savingTerminal, setSavingTerminal] = useState(false);
  const vacationImageInputRef = useRef<HTMLInputElement>(null);
  const [settingsQuery, setSettingsQuery] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('tab');
      if (q === 'payments') return 'payments';
      if (q === 'tables') return 'tables';
      if (q === 'taxes') return 'taxes';
      if (q === 'pos' || q === 'operations') return 'pos';
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
        { id: 'tables' as const, label: t('settingsTables'), icon: UtensilsCrossed },
        { id: 'shop' as const, label: t('shop'), icon: Globe2 },
        { id: 'pos' as const, label: t('settingsPos'), icon: Monitor },
        { id: 'payments' as const, label: t('settingsPayments'), icon: CreditCard },
        { id: 'receipt' as const, label: t('settingsReceipt'), icon: Printer },
        { id: 'email' as const, label: t('settingsEmail'), icon: Mail },
        { id: 'language' as const, label: t('language'), icon: Languages },
      ] as const,
    [t]
  );

  const searchIndex = useMemo<SettingsSearchEntry[]>(
    () => [
      {
        id: 'pos-layout',
        tab: 'pos',
        keywords: [
          'cart',
          'cart side',
          'cart position',
          'left',
          'right',
          'layout',
          'panier',
          'position panier',
          'gauche',
          'droite',
          'warenkorb',
          'position',
          'links',
          'rechts',
          'post success',
          'after payment',
          'navigate',
          'après paiement',
          'nach zahlung',
          'theme',
          'color',
          'couleur',
          'farbe',
          'teal',
          'violet',
          t('posCartSide'),
          t('posCartSideLeft'),
          t('posCartSideRight'),
          t('webPosPostSuccessNav'),
          t('posColorTheme'),
          t('posLayoutSettings'),
        ],
      },
      {
        id: 'pos-courses',
        tab: 'pos',
        keywords: [
          'courses',
          'course',
          'cours',
          'gänge',
          'gange',
          'gang',
          'fire',
          'kitchen',
          'send mode',
          t('coursesEnabled'),
          t('courseSendMode'),
        ],
      },
      {
        id: 'pos-checkout',
        tab: 'pos',
        keywords: [
          'tips',
          'pourboire',
          'trinkgeld',
          'discount',
          'remise',
          'rabatt',
          'quick cash',
          'split',
          'checkout',
          t('posCheckoutSettings'),
          t('tipsEnabled'),
          t('discountsEnabled'),
          t('quickCashEnabled'),
          t('splitBillsEnabled'),
        ],
      },
      {
        id: 'pos-payments',
        tab: 'pos',
        keywords: [
          'express',
          'express checkout',
          'cash',
          'card',
          'terminal',
          'paiement',
          'zahlung',
          t('webposExpress'),
          t('webposPaymentMethods'),
          t('webposCash'),
          t('webposCard'),
          t('webposTerminal'),
        ],
      },
      {
        id: 'pos-shifts',
        tab: 'pos',
        keywords: [
          'shift',
          'shifts',
          'caisse',
          'kasse',
          'float',
          'operations',
          'opérations',
          t('settingsOperations'),
          t('shiftsEnabled'),
          t('webPosShiftMenu'),
        ],
      },
      {
        id: 'tables-floor',
        tab: 'tables',
        keywords: ['tables', 'floor', 'plan', 'pax', t('floorPlanEnabled'), t('paxOrderingEnabled')],
      },
      {
        id: 'payments-adyen',
        tab: 'payments',
        keywords: ['adyen', 'swisspayout', 'terminal', t('adyenCredentials')],
      },
      {
        id: 'business-profile',
        tab: 'business',
        keywords: ['business', 'name', 'address', 'vat', t('businessSettings')],
      },
      {
        id: 'taxes-rates',
        tab: 'taxes',
        keywords: ['tax', 'vat', 'tva', 'mwst', t('taxRates')],
      },
      {
        id: 'shop-online',
        tab: 'shop',
        keywords: ['shop', 'online', 'domain', 'subdomain', t('shop')],
      },
      {
        id: 'receipt-print',
        tab: 'receipt',
        keywords: ['receipt', 'printer', 'kitchen', 'ticket', t('settingsReceipt')],
      },
      {
        id: 'email-smtp',
        tab: 'email',
        keywords: ['email', 'smtp', 'marketing', t('settingsEmail')],
      },
      {
        id: 'language-panel',
        tab: 'language',
        keywords: ['language', 'langue', 'sprache', t('language')],
      },
    ],
    [t]
  );

  const normalizedQuery = settingsQuery.trim().toLowerCase();
  const matchedSearch = useMemo(() => {
    if (!normalizedQuery) return [] as SettingsSearchEntry[];
    return searchIndex.filter((entry) =>
      entry.keywords.some((kw) => kw.toLowerCase().includes(normalizedQuery))
    );
  }, [normalizedQuery, searchIndex]);

  const matchedIds = useMemo(() => new Set(matchedSearch.map((m) => m.id)), [matchedSearch]);
  const matchedTabs = useMemo(() => new Set(matchedSearch.map((m) => m.tab)), [matchedSearch]);

  useEffect(() => {
    if (!normalizedQuery) {
      setHighlightId(null);
      return;
    }
    const matches = searchIndex.filter((entry) =>
      entry.keywords.some((kw) => kw.toLowerCase().includes(normalizedQuery))
    );
    if (matches.length === 0) {
      setHighlightId(null);
      return;
    }
    const best = matches[0];
    setTab(best.tab);
    setHighlightId(best.id);
    const timer = window.setTimeout(() => {
      document.getElementById(best.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
    // Jump only when the query text changes — not on every match-list identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedQuery]);

  const isSectionVisible = (id: string) => !normalizedQuery || matchedIds.has(id);
  const isSectionHighlight = (id: string) => highlightId === id;

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
        taxIncludedInPrice: !!settings.taxIncludedInPrice,
        slug: settings.slug || undefined,
        subdomain: settings.subdomain || undefined,
        customDomain: settings.customDomain?.trim() || null,
        shopEnabled: !!settings.shopEnabled,
        acceptingOrders: settings.acceptingOrders !== false,
        acceptingReservations: settings.acceptingReservations !== false,
        floorPlanEnabled: !!settings.floorPlanEnabled,
        paxOrderingEnabled: !!settings.paxOrderingEnabled,
        coursesEnabled: !!settings.coursesEnabled,
        shiftsEnabled: !!settings.shiftsEnabled,
        posColorTheme: settings.posColorTheme || 'teal',
        posCheckoutSettings: settings.posCheckoutSettings || undefined,
        webposExpressEnabled: settings.webposExpressEnabled !== false,
        webposCashEnabled: settings.webposCashEnabled !== false,
        webposCardEnabled: settings.webposCardEnabled !== false,
        webposTerminalEnabled: settings.webposTerminalEnabled !== false,
        panelLanguage: settings.panelLanguage || locale,
        emailSmtpSettings: {
          enabled: !!settings.emailSmtpSettings?.enabled,
          host: settings.emailSmtpSettings?.host || '',
          port: Number(settings.emailSmtpSettings?.port) || 587,
          secure: !!settings.emailSmtpSettings?.secure,
          user: settings.emailSmtpSettings?.user || '',
          password: smtpPassword || undefined,
          fromEmail: settings.emailSmtpSettings?.fromEmail || '',
          fromName: settings.emailSmtpSettings?.fromName || '',
        },
        marketingSettings: {
          reorderReminderEnabled: !!settings.marketingSettings?.reorderReminderEnabled,
          reorderReminderDays: Number(settings.marketingSettings?.reorderReminderDays) || 5,
          reorderReminderSubject: settings.marketingSettings?.reorderReminderSubject || '',
          reorderReminderBody: settings.marketingSettings?.reorderReminderBody || '',
        },
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

  const saveWebposPayments = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSavingWebposPay(true);
    try {
      const response = await api.put('/merchant/settings', {
        webposExpressEnabled: settings.webposExpressEnabled !== false,
        webposCashEnabled: settings.webposCashEnabled !== false,
        webposCardEnabled: settings.webposCardEnabled !== false,
        webposTerminalEnabled: settings.webposTerminalEnabled !== false,
        adyenLiveEnvironment: !!settings.adyenLiveEnvironment,
        adyenUseLegacyEndpoint: !!settings.adyenUseLegacyEndpoint,
      });
      const next = response.data.merchant || response.data.settings || {};
      setSettings((prev) => (prev ? { ...prev, ...next } : prev));
      toast.success(t('saved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save WebPOS payment settings');
    } finally {
      setSavingWebposPay(false);
    }
  };

  const saveReceiptPrint = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSavingReceipt(true);
    try {
      const ps = settings.posPrintSettings || {};
      const response = await api.put('/merchant/settings', {
        posPrintSettings: {
          receiptHeader: ps.receiptHeader || '',
          receiptFooter: ps.receiptFooter || '',
          kitchenTicketHeader: ps.kitchenTicketHeader || '',
          kitchenTicketFooter: ps.kitchenTicketFooter || '',
          kitchenItemTextScale: ps.kitchenItemTextScale === 1 || ps.kitchenItemTextScale === 3 ? ps.kitchenItemTextScale : 2,
          kitchenHeaderTextScale:
            ps.kitchenHeaderTextScale === 1 || ps.kitchenHeaderTextScale === 3
              ? ps.kitchenHeaderTextScale
              : 2,
          kitchenBoldText: ps.kitchenBoldText !== false,
          receiptShowVatTable: ps.receiptShowVatTable !== false,
          receiptShowStaffLine: ps.receiptShowStaffLine !== false,
          receiptShowQrCode: ps.receiptShowQrCode !== false,
          paperWidthMm: ps.paperWidthMm === 58 ? 58 : 80,
          receiptLanguage: ps.receiptLanguage || 'panel',
          receiptLogoUrl: ps.receiptLogoUrl || null,
          autoPrintReceipt: ps.autoPrintReceipt !== false,
          autoPrintKitchen: ps.autoPrintKitchen !== false,
          printers: ps.printers || [],
        },
      });
      const next = response.data.merchant || response.data.settings || {};
      setSettings((prev) => (prev ? { ...prev, ...next } : prev));
      toast.success(t('saved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('failedSaveReceipt'));
    } finally {
      setSavingReceipt(false);
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
    <div className="mx-auto w-full max-w-6xl space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">{t('settings')}</h1>
          <p className="page-sub">
            {t('settingsFor')} <span className="font-medium text-[var(--text)]">{settings.name}</span>
          </p>
        </div>
        <label className="relative block w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="input pl-9"
            type="search"
            value={settingsQuery}
            onChange={(e) => setSettingsQuery(e.target.value)}
            placeholder={t('settingsSearchPlaceholder')}
            aria-label={t('settingsSearch')}
          />
        </label>
      </div>
      {normalizedQuery ? (
        <p className="text-xs muted">
          {matchedSearch.length
            ? t('settingsSearchMatches').replace('{count}', String(matchedSearch.length))
            : t('settingsSearchNoMatches')}
        </p>
      ) : null}

      <div className="card !p-0 overflow-x-clip">
        <div className="border-b border-[var(--border)] overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <nav className="flex min-w-max gap-0.5 px-2 py-2" aria-label={t('settings')}>
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              const searchHit = normalizedQuery ? matchedTabs.has(item.id) : false;
              const searchMiss = normalizedQuery ? !searchHit : false;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    if (normalizedQuery) {
                      const first = matchedSearch.find((m) => m.tab === item.id);
                      if (first) setHighlightId(first.id);
                    }
                  }}
                  className={`flex min-w-[4.75rem] flex-col items-center gap-1 rounded-md px-3 py-2 text-[11px] font-medium transition-colors ${
                    active
                      ? 'bg-[var(--bg-muted)] text-[var(--text)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
                  } ${searchHit ? 'ring-1 ring-[var(--ring)]' : ''} ${searchMiss ? 'opacity-45' : ''}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 sm:p-5 pb-24 sm:pb-5">
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
                      className="max-h-36 sm:max-h-44 w-auto max-w-full border border-[var(--border)] object-contain bg-[var(--bg-elevated)]"
                    />
                  ) : (
                    <button
                      type="button"
                      className="w-full min-h-[5.5rem] sm:min-h-[7rem] rounded-md border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] text-sm text-[var(--text-muted)] hover:border-[var(--text)] hover:text-[var(--text)] transition-colors"
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
                          const compressed = await compressImageIfNeeded(file, {
                            maxBytes: 500 * 1024,
                            targetBytes: 350 * 1024,
                            maxWidth: 1600,
                          });
                          const form = new FormData();
                          form.append('file', compressed);
                          const res = await api.post('/merchant/media', form);
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
              <Section title={t('taxPriceMode')} description={t('taxPriceModeHint')}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label
                    className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm ${
                      !settings.taxIncludedInPrice
                        ? 'border-[var(--text)] bg-[var(--bg-muted)]'
                        : 'border-[var(--border)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="taxPriceMode"
                      className="mt-0.5"
                      checked={!settings.taxIncludedInPrice}
                      onChange={() => setSettings({ ...settings, taxIncludedInPrice: false })}
                    />
                    <span>
                      <span className="font-medium block">{t('taxExcludedInPrice')}</span>
                      <span className="text-xs muted">{t('taxExcludedInPriceHint')}</span>
                    </span>
                  </label>
                  <label
                    className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm ${
                      settings.taxIncludedInPrice
                        ? 'border-[var(--text)] bg-[var(--bg-muted)]'
                        : 'border-[var(--border)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="taxPriceMode"
                      className="mt-0.5"
                      checked={!!settings.taxIncludedInPrice}
                      onChange={() => setSettings({ ...settings, taxIncludedInPrice: true })}
                    />
                    <span>
                      <span className="font-medium block">{t('taxIncludedInPrice')}</span>
                      <span className="text-xs muted">{t('taxIncludedInPriceHint')}</span>
                    </span>
                  </label>
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

                <div className="rounded-md border border-[var(--border)] p-3 space-y-2">
                  <p className="text-sm font-medium">{t('acceptingMenuTitle')}</p>
                  <p className="text-xs muted">{t('acceptingMenuHint')}</p>
                  <label className="flex items-start gap-2.5 text-sm py-1">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={settings.acceptingOrders !== false}
                      onChange={(e) =>
                        setSettings({ ...settings, acceptingOrders: e.target.checked })
                      }
                    />
                    <span>
                      <span className="font-medium block">{t('acceptingOrders')}</span>
                      <span className="text-[11px] muted">{t('acceptingOrdersHint')}</span>
                    </span>
                  </label>
                  <label
                    className={`flex items-start gap-2.5 text-sm py-1 ${
                      !settings.reservationsEnabled ? 'opacity-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={settings.acceptingReservations !== false}
                      disabled={!settings.reservationsEnabled}
                      onChange={(e) =>
                        setSettings({ ...settings, acceptingReservations: e.target.checked })
                      }
                    />
                    <span>
                      <span className="font-medium block">{t('acceptingReservations')}</span>
                      <span className="text-[11px] muted">
                        {settings.reservationsEnabled
                          ? t('acceptingReservationsHint')
                          : t('acceptingReservationsDisabled')}
                      </span>
                    </span>
                  </label>
                </div>
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
                            {t('cmsDnsType')}
                          </th>
                          <td className="px-2 py-1.5 font-mono">CNAME</td>
                        </tr>
                        <tr className="border-b border-[var(--border)]">
                          <th className="bg-[var(--bg-muted)] px-2 py-1.5 text-left font-medium">
                            {t('cmsDnsHost')}
                          </th>
                          <td className="px-2 py-1.5 font-mono">www</td>
                        </tr>
                        <tr>
                          <th className="bg-[var(--bg-muted)] px-2 py-1.5 text-left font-medium">
                            {t('cmsDnsPointsTo')}
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

          {tab === 'tables' && (
            <div className="space-y-5">
              <form onSubmit={onSave} className="space-y-5">
                <Section
                  id="tables-floor"
                  title={t('settingsTables')}
                  description={t('floorPlanSettingsHint')}
                  highlight={isSectionHighlight('tables-floor')}
                  dimmed={normalizedQuery ? !isSectionVisible('tables-floor') : false}
                >
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
                  <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-2.5 text-xs muted">
                    {t('coursesMovedToPosHint')}{' '}
                    <button
                      type="button"
                      className="font-medium text-[var(--text)] underline underline-offset-2"
                      onClick={() => {
                        setSettingsQuery('courses');
                        setTab('pos');
                        setHighlightId('pos-courses');
                      }}
                    >
                      {t('settingsPos')}
                    </button>
                  </p>
                </Section>
                <div className="flex justify-end border-t border-[var(--border)] pt-4">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? t('saving') : t('save')}
                  </button>
                </div>
              </form>
              <Section title={t('tableDesigner')} description={t('tableDesignerHint')}>
                <FloorPlan embedded />
              </Section>
            </div>
          )}

          {tab === 'pos' && (
            <form onSubmit={onSave} className="space-y-8">
              <Section
                id="pos-layout"
                title={t('posLayoutSettings')}
                description={t('posLayoutSettingsHint')}
                highlight={isSectionHighlight('pos-layout')}
                dimmed={normalizedQuery ? !isSectionVisible('pos-layout') : false}
              >
                <Field label={t('posCartSide')} hint={t('posCartSideHint')}>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(
                      [
                        ['right', t('posCartSideRight')],
                        ['left', t('posCartSideLeft')],
                      ] as const
                    ).map(([side, label]) => {
                      const active = (settings.posCheckoutSettings?.cartSide || 'right') === side;
                      return (
                        <label
                          key={side}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm ${
                            active
                              ? 'border-[var(--text)] bg-[var(--bg-muted)]'
                              : 'border-[var(--border)]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="cartSide"
                            className="mt-0.5"
                            checked={active}
                            onChange={() =>
                              setSettings({
                                ...settings,
                                posCheckoutSettings: {
                                  ...(settings.posCheckoutSettings || {}),
                                  cartSide: side,
                                },
                              })
                            }
                          />
                          <span className="font-medium">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </Field>
                <div id="pos-post-success">
                  <Field label={t('webPosPostSuccessNav')} hint={t('posPostSuccessHint')}>
                    <select
                      className="input max-w-md"
                      value={settings.posCheckoutSettings?.postSuccessTarget || 'register'}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          posCheckoutSettings: {
                            ...(settings.posCheckoutSettings || {}),
                            postSuccessTarget: e.target.value as 'register' | 'tables',
                          },
                        })
                      }
                    >
                      <option value="register">{t('webPosTabRegister')}</option>
                      <option value="tables">{t('webPosTabTables')}</option>
                    </select>
                  </Field>
                </div>
                <div id="pos-theme">
                  <Field label={t('posColorTheme')} hint={t('posColorThemeHint')}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(
                        [
                          ['teal', t('posThemeTeal')],
                          ['green', t('posThemeGreen')],
                          ['blue', t('posThemeBlue')],
                          ['violet', t('posThemeViolet')],
                        ] as const
                      ).map(([id, label]) => {
                        const active = (settings.posColorTheme || 'teal') === id;
                        const swatch =
                          id === 'teal'
                            ? 'bg-teal-600'
                            : id === 'green'
                              ? 'bg-green-600'
                              : id === 'blue'
                                ? 'bg-blue-600'
                                : 'bg-violet-600';
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setSettings({ ...settings, posColorTheme: id })}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm ${
                              active
                                ? 'border-stone-900 ring-2 ring-stone-900/20'
                                : 'border-[var(--border)] hover:bg-[var(--bg-muted)]'
                            }`}
                          >
                            <span className={`h-4 w-4 shrink-0 rounded-full ${swatch}`} />
                            <span className="font-medium">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                </div>
              </Section>

              <Section
                id="pos-shifts"
                title={t('settingsOperations')}
                description={t('shiftsEnabledHint')}
                highlight={isSectionHighlight('pos-shifts')}
                dimmed={normalizedQuery ? !isSectionVisible('pos-shifts') : false}
              >
                <label className="flex items-start gap-2.5 rounded-md border-2 border-[var(--border)] bg-[var(--bg-muted)] px-3 py-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!settings.shiftsEnabled}
                    onChange={(e) => setSettings({ ...settings, shiftsEnabled: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium block">{t('shiftsEnabled')}</span>
                    <span className="text-xs muted">{t('shiftsEnabledHint')}</span>
                    {settings.shiftsEnabled ? (
                      <span className="mt-1.5 block text-xs font-medium text-teal-700">
                        {t('webPosShiftOpenHint')}
                      </span>
                    ) : null}
                  </span>
                </label>
                <a href="/merchant/pos" className="btn-secondary mt-3 inline-flex">
                  {t('openWebPos')}
                </a>
              </Section>

              <Section
                id="pos-courses"
                title={t('coursesEnabled')}
                description={t('coursesEnabledHint')}
                highlight={isSectionHighlight('pos-courses')}
                dimmed={normalizedQuery ? !isSectionVisible('pos-courses') : false}
              >
                <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!settings.coursesEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        coursesEnabled: e.target.checked,
                        floorPlanEnabled: e.target.checked ? true : settings.floorPlanEnabled,
                      })
                    }
                  />
                  <span>
                    <span className="font-medium block">{t('coursesEnabled')}</span>
                    <span className="text-xs muted">{t('coursesEnabledHint')}</span>
                  </span>
                </label>
                {settings.coursesEnabled ? (
                  <Field label={t('courseSendMode')} hint={t('courseSendModeHint')}>
                    <select
                      className="input"
                      value={settings.posCheckoutSettings?.courseSendMode || 'fire_per_course'}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          posCheckoutSettings: {
                            ...(settings.posCheckoutSettings || {}),
                            courseSendMode: e.target.value as 'fire_per_course' | 'send_all_once',
                          },
                        })
                      }
                    >
                      <option value="fire_per_course">{t('courseSendModeFirePerCourse')}</option>
                      <option value="send_all_once">{t('courseSendModeSendAllOnce')}</option>
                    </select>
                  </Field>
                ) : null}
              </Section>

              <Section
                id="pos-checkout"
                title={t('posCheckoutSettings')}
                description={t('posCheckoutHint')}
                highlight={isSectionHighlight('pos-checkout')}
                dimmed={normalizedQuery ? !isSectionVisible('pos-checkout') : false}
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(
                    [
                      ['tipsEnabled', 'tipsEnabled'],
                      ['allowCustomTip', 'allowCustomTip'],
                      ['discountsEnabled', 'discountsEnabled'],
                      ['quickCashEnabled', 'quickCashEnabled'],
                      ['splitBillsEnabled', 'splitBillsEnabled'],
                    ] as const
                  ).map(([key, labelKey]) => (
                    <label
                      key={key}
                      className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={settings.posCheckoutSettings?.[key] !== false}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            posCheckoutSettings: {
                              ...(settings.posCheckoutSettings || {}),
                              [key]: e.target.checked,
                            },
                          })
                        }
                      />
                      <span className="font-medium">{t(labelKey)}</span>
                    </label>
                  ))}
                </div>
                <Field label={t('quickCashDenominations')} hint={t('quickCashDenominationsHint')}>
                  <input
                    className="input"
                    value={(settings.posCheckoutSettings?.quickCashDenominations || [10, 20, 50, 100]).join(
                      ', '
                    )}
                    onChange={(e) => {
                      const dens = e.target.value
                        .split(/[,;\s]+/)
                        .map((x) => Number(x))
                        .filter((n) => Number.isFinite(n) && n > 0);
                      setSettings({
                        ...settings,
                        posCheckoutSettings: {
                          ...(settings.posCheckoutSettings || {}),
                          quickCashDenominations: dens.length ? dens : [10, 20, 50, 100],
                        },
                      });
                    }}
                  />
                </Field>
              </Section>

              <Section
                id="pos-payments"
                title={t('webposPaymentMethods')}
                description={t('webposPaymentMethodsHint')}
                highlight={isSectionHighlight('pos-payments')}
                dimmed={normalizedQuery ? !isSectionVisible('pos-payments') : false}
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(
                    [
                      ['webposExpressEnabled', t('webposExpress')] as const,
                      ['webposCashEnabled', t('webposCash')] as const,
                      ['webposCardEnabled', t('webposCard')] as const,
                      ['webposTerminalEnabled', t('webposTerminal')] as const,
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={settings?.[key] !== false}
                        onChange={(e) =>
                          setSettings((prev) =>
                            prev ? { ...prev, [key]: e.target.checked } : prev
                          )
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </Section>

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
                <Section
                  id="payments-adyen"
                  title={t('adyenCredentials')}
                  description={t('adyenSettingsHint')}
                  highlight={isSectionHighlight('payments-adyen')}
                  dimmed={normalizedQuery ? !isSectionVisible('payments-adyen') : false}
                >
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
                        placeholder="ChaslayReborn_COM"
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

              <form onSubmit={saveWebposPayments} className="space-y-5 border-t border-[var(--border)] pt-6">
                <Section title={t('adyenTerminalEnv')}>
                  <p className="text-xs muted">
                    {t('webposPaymentMethodsMovedHint')}{' '}
                    <button
                      type="button"
                      className="font-medium text-[var(--text)] underline underline-offset-2"
                      onClick={() => {
                        setSettingsQuery('express');
                        setTab('pos');
                        setHighlightId('pos-payments');
                      }}
                    >
                      {t('settingsPos')}
                    </button>
                  </p>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={!!settings?.adyenLiveEnvironment}
                      onChange={(e) =>
                        setSettings((prev) =>
                          prev ? { ...prev, adyenLiveEnvironment: e.target.checked } : prev
                        )
                      }
                    />
                    {t('adyenLiveMode')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={!!settings?.adyenUseLegacyEndpoint}
                      onChange={(e) =>
                        setSettings((prev) =>
                          prev ? { ...prev, adyenUseLegacyEndpoint: e.target.checked } : prev
                        )
                      }
                    />
                    {t('adyenLegacyEndpoint')}
                  </label>
                </Section>
                <div className="flex justify-end border-t border-[var(--border)] pt-4">
                  <button type="submit" className="btn-primary" disabled={savingWebposPay}>
                    {savingWebposPay ? t('saving') : t('save')}
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

          {tab === 'email' && (
            <form onSubmit={onSave} className="space-y-5">
              <Section title={t('settingsSmtp')} description={t('settingsSmtpHint')}>
                <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!settings.emailSmtpSettings?.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        emailSmtpSettings: {
                          ...(settings.emailSmtpSettings || {}),
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <span className="font-medium block">{t('smtpEnabled')}</span>
                    <span className="text-xs muted">{t('smtpEnabledHint')}</span>
                  </span>
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={t('smtpHost')}>
                    <input
                      className="input"
                      value={settings.emailSmtpSettings?.host || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailSmtpSettings: {
                            ...(settings.emailSmtpSettings || {}),
                            host: e.target.value,
                          },
                        })
                      }
                      placeholder="smtp.example.com"
                    />
                  </Field>
                  <Field label={t('smtpPort')}>
                    <input
                      className="input"
                      type="number"
                      value={settings.emailSmtpSettings?.port ?? 587}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailSmtpSettings: {
                            ...(settings.emailSmtpSettings || {}),
                            port: Number(e.target.value) || 587,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label={t('smtpUser')}>
                    <input
                      className="input"
                      value={settings.emailSmtpSettings?.user || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailSmtpSettings: {
                            ...(settings.emailSmtpSettings || {}),
                            user: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field
                    label={t('smtpPassword')}
                    hint={
                      settings.emailSmtpSettings?.passwordSet
                        ? t('smtpPasswordSetHint')
                        : undefined
                    }
                  >
                    <input
                      className="input"
                      type="password"
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder={settings.emailSmtpSettings?.passwordSet ? '••••••••' : ''}
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field label={t('smtpFromEmail')}>
                    <input
                      className="input"
                      type="email"
                      value={settings.emailSmtpSettings?.fromEmail || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailSmtpSettings: {
                            ...(settings.emailSmtpSettings || {}),
                            fromEmail: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label={t('smtpFromName')}>
                    <input
                      className="input"
                      value={settings.emailSmtpSettings?.fromName || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailSmtpSettings: {
                            ...(settings.emailSmtpSettings || {}),
                            fromName: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!settings.emailSmtpSettings?.secure}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        emailSmtpSettings: {
                          ...(settings.emailSmtpSettings || {}),
                          secure: e.target.checked,
                        },
                      })
                    }
                  />
                  {t('smtpSecure')}
                </label>
                <div className="flex flex-wrap gap-2 items-end">
                  <Field label={t('smtpTestTo')}>
                    <input
                      className="input"
                      type="email"
                      value={testEmailTo}
                      onChange={(e) => setTestEmailTo(e.target.value)}
                      placeholder={settings.email || 'you@example.com'}
                    />
                  </Field>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={testingEmail}
                    onClick={async () => {
                      setTestingEmail(true);
                      try {
                        await api.put('/merchant/settings', {
                          emailSmtpSettings: {
                            enabled: !!settings.emailSmtpSettings?.enabled,
                            host: settings.emailSmtpSettings?.host || '',
                            port: Number(settings.emailSmtpSettings?.port) || 587,
                            secure: !!settings.emailSmtpSettings?.secure,
                            user: settings.emailSmtpSettings?.user || '',
                            password: smtpPassword || undefined,
                            fromEmail: settings.emailSmtpSettings?.fromEmail || '',
                            fromName: settings.emailSmtpSettings?.fromName || '',
                          },
                        });
                        await api.post('/merchant/marketing/test-email', {
                          to: testEmailTo || settings.email,
                        });
                        toast.success(t('smtpTestSent'));
                        setSmtpPassword('');
                      } catch (error: any) {
                        toast.error(error.response?.data?.error || t('smtpTestFailed'));
                      } finally {
                        setTestingEmail(false);
                      }
                    }}
                  >
                    {testingEmail ? t('saving') : t('smtpSendTest')}
                  </button>
                </div>
              </Section>

              <Section title={t('reorderReminder')} description={t('reorderReminderHint')}>
                <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!settings.marketingSettings?.reorderReminderEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        marketingSettings: {
                          ...(settings.marketingSettings || {}),
                          reorderReminderEnabled: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <span className="font-medium block">{t('reorderReminderEnable')}</span>
                    <span className="text-xs muted">{t('reorderReminderEnableHint')}</span>
                  </span>
                </label>
                <Field label={t('reorderReminderDays')}>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={90}
                    value={settings.marketingSettings?.reorderReminderDays ?? 5}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        marketingSettings: {
                          ...(settings.marketingSettings || {}),
                          reorderReminderDays: Number(e.target.value) || 5,
                        },
                      })
                    }
                  />
                </Field>
                <Field label={t('reorderReminderSubject')}>
                  <input
                    className="input"
                    value={settings.marketingSettings?.reorderReminderSubject || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        marketingSettings: {
                          ...(settings.marketingSettings || {}),
                          reorderReminderSubject: e.target.value,
                        },
                      })
                    }
                    placeholder="We miss you - order again from {{businessName}}"
                  />
                </Field>
                <Field label={t('reorderReminderBody')} hint={t('newsletterPlaceholders')}>
                  <textarea
                    className="input min-h-[10rem] font-mono text-xs"
                    value={settings.marketingSettings?.reorderReminderBody || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        marketingSettings: {
                          ...(settings.marketingSettings || {}),
                          reorderReminderBody: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
              </Section>

              <div className="flex justify-end border-t border-[var(--border)] pt-4">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          )}

          {tab === 'receipt' && (
            <form className="space-y-5" onSubmit={saveReceiptPrint}>
              <Section title={t('settingsReceipt')} description={t('settingsReceiptHint')}>
                <Field label={t('receiptLanguage')}>
                  <select
                    className="input"
                    value={settings.posPrintSettings?.receiptLanguage || 'panel'}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          receiptLanguage: e.target.value as 'en' | 'fr' | 'de' | 'panel',
                        },
                      })
                    }
                  >
                    <option value="panel">{t('receiptLangPanel')}</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </Field>
                <Field label={t('receiptPaperWidth')}>
                  <select
                    className="input"
                    value={settings.posPrintSettings?.paperWidthMm === 58 ? 58 : 80}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          paperWidthMm: Number(e.target.value) === 58 ? 58 : 80,
                        },
                      })
                    }
                  >
                    <option value={80}>80mm</option>
                    <option value={58}>58mm</option>
                  </select>
                </Field>
                <Field label={t('receiptLogoUpload')} hint={t('receiptLogoUploadHint')}>
                  <div className="space-y-2">
                    {(settings.posPrintSettings?.receiptLogoUrl || settings.shopLogoUrl) && (
                      <img
                        src={settings.posPrintSettings?.receiptLogoUrl || settings.shopLogoUrl || ''}
                        alt=""
                        className="h-16 object-contain rounded border border-[var(--border)] bg-white p-1"
                      />
                    )}
                    <div className="flex flex-wrap gap-2">
                      <label className="btn-secondary cursor-pointer inline-flex">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            try {
                              const fd = new FormData();
                              fd.append('file', file);
                              const res = await api.post('/merchant/media', fd, {
                                headers: { 'Content-Type': 'multipart/form-data' },
                              });
                              const url = res.data.url as string;
                              setSettings({
                                ...settings,
                                posPrintSettings: {
                                  ...(settings.posPrintSettings || {}),
                                  receiptLogoUrl: url,
                                },
                              });
                              toast.success(t('saved'));
                            } catch (err: any) {
                              toast.error(err.response?.data?.error || t('uploadFailed'));
                            }
                          }}
                        />
                        {t('receiptLogoUpload')}
                      </label>
                      {settings.posPrintSettings?.receiptLogoUrl && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              posPrintSettings: {
                                ...(settings.posPrintSettings || {}),
                                receiptLogoUrl: null,
                              },
                            })
                          }
                        >
                          {t('receiptLogoRemove')}
                        </button>
                      )}
                    </div>
                    <input
                      className="input"
                      value={settings.posPrintSettings?.receiptLogoUrl || ''}
                      placeholder={settings.shopLogoUrl || t('receiptLogoUrl')}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          posPrintSettings: {
                            ...(settings.posPrintSettings || {}),
                            receiptLogoUrl: e.target.value || null,
                          },
                        })
                      }
                    />
                  </div>
                </Field>
                <Field label={t('receiptHeader')}>
                  <textarea
                    className="input min-h-[5rem]"
                    value={settings.posPrintSettings?.receiptHeader || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          receiptHeader: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
                <Field label={t('receiptFooter')}>
                  <textarea
                    className="input min-h-[4rem]"
                    value={settings.posPrintSettings?.receiptFooter || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          receiptFooter: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
                <Field label={t('kitchenTicketHeader')}>
                  <textarea
                    className="input min-h-[3rem]"
                    value={settings.posPrintSettings?.kitchenTicketHeader || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          kitchenTicketHeader: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
                <Field label={t('kitchenTicketFooter')}>
                  <textarea
                    className="input min-h-[3rem]"
                    value={settings.posPrintSettings?.kitchenTicketFooter || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          kitchenTicketFooter: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
                <Field label={t('kitchenItemTextScale')} hint={t('kitchenTextScaleHint')}>
                  <select
                    className="input"
                    value={settings.posPrintSettings?.kitchenItemTextScale || 2}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          kitchenItemTextScale: Number(e.target.value) as 1 | 2 | 3,
                        },
                      })
                    }
                  >
                    <option value={1}>{t('kitchenScaleNormal')}</option>
                    <option value={2}>{t('kitchenScaleLarge')}</option>
                    <option value={3}>{t('kitchenScaleXLarge')}</option>
                  </select>
                </Field>
                <Field label={t('kitchenHeaderTextScale')}>
                  <select
                    className="input"
                    value={settings.posPrintSettings?.kitchenHeaderTextScale || 2}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          kitchenHeaderTextScale: Number(e.target.value) as 1 | 2 | 3,
                        },
                      })
                    }
                  >
                    <option value={1}>{t('kitchenScaleNormal')}</option>
                    <option value={2}>{t('kitchenScaleLarge')}</option>
                    <option value={3}>{t('kitchenScaleXLarge')}</option>
                  </select>
                </Field>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.posPrintSettings?.kitchenBoldText !== false}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          kitchenBoldText: e.target.checked,
                        },
                      })
                    }
                  />
                  {t('kitchenBoldText')}
                </label>
                <div className="flex flex-wrap gap-4 text-sm">
                  {(
                    [
                      ['receiptShowVatTable', t('receiptShowVat')],
                      ['receiptShowStaffLine', t('receiptShowStaff')],
                      ['receiptShowQrCode', t('receiptShowQr')],
                      ['autoPrintReceipt', t('autoPrintReceipt')],
                      ['autoPrintKitchen', t('autoPrintKitchen')],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.posPrintSettings?.[key] !== false}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            posPrintSettings: {
                              ...(settings.posPrintSettings || {}),
                              [key]: e.target.checked,
                            },
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </Section>

              <Section title={t('printAgentDownload')} description={t('printAgentDownloadHint')}>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    className="btn-primary inline-flex"
                    href={
                      // Production dashboard uses VITE_API_URL=/api → same-origin /downloads/*
                      // (Caddy proxies /downloads to the API; never hit SPA index.html).
                      // Absolute API hosts (local / custom) keep their origin.
                      (() => {
                        const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(
                          /\/api\/?$/,
                          ''
                        );
                        if (!api || api.startsWith('/')) {
                          return '/downloads/chaslay-print-agent-setup.exe';
                        }
                        return `${api}/downloads/chaslay-print-agent-setup.exe`;
                      })()
                    }
                    download
                  >
                    {t('downloadPrintAgent')}
                  </a>
                  <p className="text-sm text-[var(--muted)] max-w-xl m-0">
                    {t('printAgentInstallSteps')}
                  </p>
                </div>
              </Section>

              <Section title={t('printerProfiles')} description={t('printerProfilesHint')}>
                {(settings.posPrintSettings?.printers || []).map((p, idx) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-[var(--border)] p-3 space-y-2"
                  >
                    <Field label={t('printerName')}>
                      <input
                        className="input"
                        value={p.name}
                        onChange={(e) => {
                          const printers = [...(settings.posPrintSettings?.printers || [])];
                          printers[idx] = { ...p, name: e.target.value };
                          setSettings({
                            ...settings,
                            posPrintSettings: { ...(settings.posPrintSettings || {}), printers },
                          });
                        }}
                        placeholder="Windows printer name"
                      />
                    </Field>
                    <div className="flex flex-wrap gap-3 text-sm">
                      {(
                        [
                          ['printReceipts', t('printRoleReceipts')],
                          ['printKitchenTickets', t('printRoleKitchen')],
                          ['printEndOfDayReports', t('printRoleEod')],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="inline-flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={!!p[key]}
                            onChange={(e) => {
                              const printers = [...(settings.posPrintSettings?.printers || [])];
                              printers[idx] = { ...p, [key]: e.target.checked };
                              setSettings({
                                ...settings,
                                posPrintSettings: { ...(settings.posPrintSettings || {}), printers },
                              });
                            }}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() => {
                        const printers = (settings.posPrintSettings?.printers || []).filter(
                          (_, i) => i !== idx
                        );
                        setSettings({
                          ...settings,
                          posPrintSettings: { ...(settings.posPrintSettings || {}), printers },
                        });
                      }}
                    >
                      {t('delete')}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const printers = [
                      ...(settings.posPrintSettings?.printers || []),
                      {
                        id: `p-${Date.now()}`,
                        name: '',
                        enabled: true,
                        paperWidthMm: 80 as const,
                        printReceipts: false,
                        printKitchenTickets: true,
                        printEndOfDayReports: false,
                        printAllProducts: true,
                      },
                    ];
                    setSettings({
                      ...settings,
                      posPrintSettings: { ...(settings.posPrintSettings || {}), printers },
                    });
                  }}
                >
                  {t('addPrinterProfile')}
                </button>
              </Section>

              <div className="flex justify-end border-t border-[var(--border)] pt-4">
                <button type="submit" className="btn-primary" disabled={savingReceipt}>
                  {savingReceipt ? t('saving') : t('save')}
                </button>
              </div>
            </form>
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
      <p className="text-center text-xs text-stone-400">{dashboardVersionLabel}</p>
    </div>
  );
}
