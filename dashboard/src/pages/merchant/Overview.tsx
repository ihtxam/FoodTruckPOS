import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Printer,
  Download,
  Settings2,
  X,
  Plus,
  Trash2,
  Mail,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  generateEodReportText,
  logoUrlToEscPos,
  printersForRole,
  resolveReceiptLanguage,
  textToEscPos,
  uint8ToBase64,
  type PosPrintSettingsClient,
} from '@/lib/webpos-receipt';
import { isPrintAgentAvailable, printViaAgent } from '@/lib/print-agent';

type Preset = 'today' | 'yesterday' | 'last_week' | 'custom';

type OverviewData = {
  range: { label: string; from: string; to: string; preset: string };
  kpis: {
    totalSales: number;
    netSales: number;
    fundingAmount: number;
    orders: number;
    customers: number;
    tipsTotal: number;
    taxTotal: number;
    changes: {
      totalSales: number;
      netSales: number;
      fundingAmount: number;
      orders: number;
      customers: number;
    };
    previousLabel: string;
  };
  salesBreakdown: { productAmount: number; tax: number; totalSales: number };
  salesOverTime: Array<{ label: string; amount: number }>;
  paymentMethods: Array<{
    method: string;
    label: string;
    total: number;
    count: number;
    percent: number;
  }>;
  orderTypes: Array<{
    channel: string;
    label: string;
    total: number;
    count: number;
    percent: number;
  }>;
  products: Array<{ name: string; quantity: number; total: number }>;
  staff: Array<{ name: string; salesCount: number; total: number }>;
  businessName: string;
  eod?: Record<string, unknown>;
};

type ReportEmailSettings = {
  language: 'en' | 'fr' | 'de';
  sendEveryDay: boolean;
  sendEveryMonth: boolean;
  emails: string[];
};

const CHART_COLORS = ['#a855f7', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#64748b'];

function money(n: number) {
  return `CHF ${Number(n || 0).toFixed(2)}`;
}

function ChangeLine({ value, label }: { value: number; label: string }) {
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p
      className={`mt-1.5 text-xs inline-flex items-center gap-1 ${
        up ? 'text-emerald-600' : 'text-rose-600'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {up ? '↑' : '↓'} {Math.abs(value).toFixed(0)}% {label}
    </p>
  );
}

export default function Overview() {
  const { t, locale } = useI18n();
  const [preset, setPreset] = useState<Preset>('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emailSettings, setEmailSettings] = useState<ReportEmailSettings>({
    language: 'en',
    sendEveryDay: false,
    sendEveryMonth: false,
    emails: [''],
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [printSettings, setPrintSettings] = useState<PosPrintSettingsClient | null>(null);
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ preset });
    if (preset === 'custom') {
      if (from) params.set('from', from);
      if (to) params.set('to', to);
    }
    return params;
  }, [preset, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, setRes] = await Promise.all([
        api.get(`/merchant/reports/overview?${queryParams}`),
        api.get('/merchant/settings').catch(() => null),
      ]);
      setData(ovRes.data.overview);
      const s = setRes?.data?.settings;
      if (s) {
        setPrintSettings(s.posPrintSettings || null);
        setShopLogoUrl(s.shopLogoUrl || s.posPrintSettings?.receiptLogoUrl || null);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('ovLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [queryParams, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openSettings = async () => {
    setSettingsOpen(true);
    try {
      const res = await api.get('/merchant/reports/email-settings');
      const s = res.data.settings as ReportEmailSettings;
      setEmailSettings({
        language: s.language || 'en',
        sendEveryDay: !!s.sendEveryDay,
        sendEveryMonth: !!s.sendEveryMonth,
        emails: s.emails?.length ? s.emails : [''],
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('ovSettingsLoadFailed'));
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const emails = emailSettings.emails.map((e) => e.trim()).filter(Boolean);
      const res = await api.put('/merchant/reports/email-settings', {
        ...emailSettings,
        emails,
      });
      const s = res.data.settings as ReportEmailSettings;
      setEmailSettings({
        language: s.language || 'en',
        sendEveryDay: !!s.sendEveryDay,
        sendEveryMonth: !!s.sendEveryMonth,
        emails: s.emails?.length ? s.emails : [''],
      });
      toast.success(t('ovSettingsSaved'));
      setSettingsOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('ovSettingsSaveFailed'));
    } finally {
      setSavingSettings(false);
    }
  };

  const downloadExport = async (format: 'xlsx' | 'csv') => {
    try {
      const res = await api.get(`/merchant/reports/export?${queryParams}&format=${format}`, {
        responseType: 'blob',
      });
      const cd = String(res.headers['content-disposition'] || '');
      const match = cd.match(/filename="?([^"]+)"?/i);
      const filename =
        match?.[1] ||
        `Report_${data?.range?.from || 'export'}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('ovExportDone'));
      setExportOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('ovExportFailed'));
    }
  };

  const sendEmailNow = async () => {
    setSendingEmail(true);
    try {
      const emails = emailSettings.emails.map((e) => e.trim()).filter(Boolean);
      await api.post('/merchant/reports/email-send', {
        preset,
        from: preset === 'custom' ? from : undefined,
        to: preset === 'custom' ? to : undefined,
        emails: emails.length ? emails : undefined,
        language: emailSettings.language,
      });
      toast.success(t('ovEmailSent'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('ovEmailFailed'));
    } finally {
      setSendingEmail(false);
    }
  };

  const printOverview = async () => {
    if (!data?.eod) {
      toast.error(t('ovPrintFailed'));
      return;
    }
    try {
      const eod = data.eod as any;
      const lang = resolveReceiptLanguage(printSettings, locale);
      const targets = printersForRole(printSettings, 'eod');
      const paperWidthMm = targets[0]?.paperWidthMm || printSettings?.paperWidthMm || 80;
      const text = generateEodReportText({
        label: data.range.label,
        periodFrom: data.range.from,
        periodTo: data.range.to,
        salesCount: eod.salesCount,
        revenue: eod.revenue,
        subtotal: eod.subtotal || eod.revenue,
        taxTotal: eod.taxTotal,
        netTotal: eod.netTotal,
        tipsTotal: eod.tipsTotal,
        grandTotal: eod.grandTotal,
        refundTotal: eod.refundTotal,
        cancelledCount: eod.cancelledCount,
        cancelledTotal: eod.cancelledTotal,
        cashTotal: eod.cashTotal,
        cardTotal: eod.cardTotal,
        terminalTotal: eod.terminalTotal,
        coversServed: eod.coversServed,
        vatRows: eod.vatRows,
        productsSold: eod.productsSold,
        paymentRows: eod.paymentRows,
        orderTypeRows: eod.orderTypeRows,
        channelRows: eod.channelRows,
        shiftCash: eod.shiftCash?.length ? eod.shiftCash : undefined,
        businessName: data.businessName,
        language: lang,
        paperWidthMm,
        header: printSettings?.receiptHeader,
        footer: printSettings?.receiptFooter,
      });
      const ok = await isPrintAgentAvailable();
      if (!ok) throw new Error(t('webPosAgentOffline'));
      const logoUrl = printSettings?.receiptLogoUrl || shopLogoUrl;
      const logo = logoUrl
        ? await logoUrlToEscPos(logoUrl, paperWidthMm === 58 ? 240 : 384)
        : null;
      const escpos = textToEscPos(text, undefined, logo);
      const dataBase64 = uint8ToBase64(escpos);
      const names =
        targets.length > 0
          ? targets.map((x) => x.name)
          : [localStorage.getItem('manupos_webpos_printer') || ''];
      for (const name of names) {
        await printViaAgent({ printerName: name || undefined, dataBase64, text });
      }
      toast.success(t('reportsPrinted'));
    } catch (e: any) {
      toast.error(e.message || t('ovPrintFailed'));
    }
  };

  const compareLabel =
    preset === 'today'
      ? t('ovThanYesterday')
      : preset === 'yesterday'
        ? t('ovThanPrevDay')
        : t('ovThanPrevPeriod');

  const presets: { id: Preset; label: string }[] = [
    { id: 'today', label: t('reportsToday') },
    { id: 'yesterday', label: t('reportsYesterday') },
    { id: 'last_week', label: t('reportsLastWeek') },
    { id: 'custom', label: t('reportsCustom') },
  ];

  if (loading && !data) {
    return <div className="text-center py-10 muted text-sm">{t('loading')}</div>;
  }

  const kpis = data?.kpis;
  const maxProduct = Math.max(...(data?.products || []).map((p) => p.total), 1);
  const maxStaff = Math.max(...(data?.staff || []).map((s) => s.total), 1);

  return (
    <div className="space-y-4 max-w-[1400px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{t('overview')}</h1>
          <p className="page-sub">{t('overviewSub')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input py-1.5 text-sm min-w-[140px]"
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn-secondary inline-flex items-center gap-1.5" onClick={() => void printOverview()}>
            <Printer className="w-4 h-4" />
            {t('ovPrint')}
          </button>
          <div className="relative">
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-1.5"
              onClick={() => setExportOpen((v) => !v)}
            >
              <Download className="w-4 h-4" />
              {t('ovExport')}
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 z-20 card p-1.5 min-w-[160px] shadow-lg">
                <button
                  type="button"
                  className="w-full text-left text-sm px-2.5 py-1.5 rounded hover:bg-[var(--bg-muted)]"
                  onClick={() => void downloadExport('xlsx')}
                >
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  className="w-full text-left text-sm px-2.5 py-1.5 rounded hover:bg-[var(--bg-muted)]"
                  onClick={() => void downloadExport('csv')}
                >
                  CSV
                </button>
                <button
                  type="button"
                  className="w-full text-left text-sm px-2.5 py-1.5 rounded hover:bg-[var(--bg-muted)] inline-flex items-center gap-1.5"
                  onClick={() => void sendEmailNow()}
                  disabled={sendingEmail}
                >
                  <Mail className="w-3.5 h-3.5" />
                  {sendingEmail ? t('loading') : t('ovSendEmail')}
                </button>
              </div>
            )}
          </div>
          <button type="button" className="btn-secondary inline-flex items-center gap-1.5" onClick={() => void openSettings()}>
            <Settings2 className="w-4 h-4" />
            {t('ovSettings')}
          </button>
        </div>
      </div>

      {preset === 'custom' && (
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm space-y-1">
            <span className="muted">{t('reportsFrom')}</span>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-sm space-y-1">
            <span className="muted">{t('reportsTo')}</span>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className="btn-primary" onClick={() => void load()}>
            {t('reportsApply')}
          </button>
        </div>
      )}

      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {[
            { key: 'totalSales', label: t('ovTotalSales'), value: money(kpis.totalSales), change: kpis.changes.totalSales },
            { key: 'netSales', label: t('ovNetSales'), value: money(kpis.netSales), change: kpis.changes.netSales },
            { key: 'funding', label: t('ovFunding'), value: money(kpis.fundingAmount), change: kpis.changes.fundingAmount },
            { key: 'orders', label: t('ovOrders'), value: String(kpis.orders), change: kpis.changes.orders },
            { key: 'customers', label: t('ovCustomers'), value: String(kpis.customers), change: kpis.changes.customers },
          ].map((card) => (
            <div key={card.key} className="card">
              <p className="text-xs muted">{card.label}</p>
              <p className="text-xl font-semibold mt-1 tabular-nums">{card.value}</p>
              <ChangeLine value={card.change} label={compareLabel} />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="card xl:col-span-2 min-h-[280px]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">{t('ovSalesOverTime')}</h2>
            <Link to="/merchant/reports" className="text-xs text-[var(--accent)] hover:underline">
              {t('ovViewMore')}
            </Link>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.salesOverTime || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Line type="monotone" dataKey="amount" stroke="#a855f7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold mb-3">{t('ovSalesBreakdown')}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="muted">{t('ovProductAmount')}</span>
              <span className="font-medium tabular-nums">{money(data?.salesBreakdown.productAmount || 0)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="muted">{t('ovTax')}</span>
              <span className="font-medium tabular-nums">{money(data?.salesBreakdown.tax || 0)}</span>
            </div>
            <div className="flex justify-between gap-2 pt-2 border-t border-[var(--border)] font-semibold">
              <span>{t('ovTotalSales')}</span>
              <span className="tabular-nums">{money(data?.salesBreakdown.totalSales || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card min-h-[260px]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">{t('ovByPayment')}</h2>
            <Link to="/merchant/reports" className="text-xs text-[var(--accent)] hover:underline">
              {t('ovViewMore')}
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="h-[180px] w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.paymentMethods || []}
                    dataKey="total"
                    nameKey="label"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                  >
                    {(data?.paymentMethods || []).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="text-sm space-y-1.5 w-full sm:w-1/2">
              {(data?.paymentMethods || []).map((p, i) => (
                <li key={p.method} className="flex justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="truncate">{p.label}</span>
                  </span>
                  <span className="tabular-nums shrink-0">
                    {money(p.total)} ({p.percent}%)
                  </span>
                </li>
              ))}
              {!data?.paymentMethods?.length && <li className="muted">{t('reportsEmpty')}</li>}
            </ul>
          </div>
        </div>

        <div className="card min-h-[260px]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">{t('ovByOrderType')}</h2>
            <Link to="/merchant/reports" className="text-xs text-[var(--accent)] hover:underline">
              {t('ovViewMore')}
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="h-[180px] w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.orderTypes || []}
                    dataKey="total"
                    nameKey="label"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                  >
                    {(data?.orderTypes || []).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="text-sm space-y-1.5 w-full sm:w-1/2">
              {(data?.orderTypes || []).map((o, i) => (
                <li key={o.channel} className="flex justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: CHART_COLORS[(i + 2) % CHART_COLORS.length] }}
                    />
                    <span className="truncate">{o.label}</span>
                  </span>
                  <span className="tabular-nums shrink-0">
                    {money(o.total)} ({o.percent}%)
                  </span>
                </li>
              ))}
              {!data?.orderTypes?.length && <li className="muted">{t('reportsEmpty')}</li>}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">{t('ovByProducts')}</h2>
            <Link to="/merchant/reports" className="text-xs text-[var(--accent)] hover:underline">
              {t('ovViewMore')}
            </Link>
          </div>
          <div className="space-y-2">
            {(data?.products || []).slice(0, 8).map((p) => (
              <div key={p.name} className="text-sm">
                <div className="flex justify-between gap-2 mb-0.5">
                  <span className="truncate">{p.name}</span>
                  <span className="tabular-nums muted shrink-0">
                    {p.quantity} · {money(p.total)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-fuchsia-500/80"
                    style={{ width: `${Math.max(4, (p.total / maxProduct) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {!data?.products?.length && <p className="text-sm muted">{t('reportsEmpty')}</p>}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">{t('ovByStaff')}</h2>
            <Link to="/merchant/reports" className="text-xs text-[var(--accent)] hover:underline">
              {t('ovViewMore')}
            </Link>
          </div>
          <div className="h-[220px]">
            {(data?.staff || []).length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.staff || []} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Bar dataKey="total" fill="#a855f7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm muted">{t('reportsEmpty')}</p>
            )}
          </div>
          {!data?.staff?.length ? null : (
            <ul className="mt-2 text-xs muted space-y-1">
              {(data?.staff || []).map((s) => (
                <li key={s.name} className="flex justify-between">
                  <span>{s.name}</span>
                  <span className="tabular-nums">
                    {money(s.total)} ({Math.round((s.total / maxStaff) * 100)}%)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold mb-3">{t('ovCommonOps')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-rose-600 mb-2">{t('ovOrderReports')}</p>
            <div className="flex flex-wrap gap-2">
              {[
                { to: '/merchant/reports', label: t('ovLinkOrderTypes') },
                { to: '/merchant/reports', label: t('ovLinkTax') },
                { to: '/merchant/reports', label: t('ovLinkProducts') },
                { to: '/merchant/orders', label: t('orders') },
              ].map((link) => (
                <Link key={link.label} to={link.to} className="btn-secondary text-xs py-1.5">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-amber-600 mb-2">{t('ovFinancialReports')}</p>
            <div className="flex flex-wrap gap-2">
              <Link to="/merchant/reports" className="btn-secondary text-xs py-1.5">
                {t('ovLinkTender')}
              </Link>
              <Link to="/merchant/reports" className="btn-secondary text-xs py-1.5">
                {t('ovLinkCashDrawer')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-[var(--bg-elevated)] rounded-xl shadow-xl w-full max-w-lg border border-[var(--border)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <h3 className="font-semibold">{t('ovReportSettings')}</h3>
              <button type="button" className="p-1 rounded hover:bg-[var(--bg-muted)]" onClick={() => setSettingsOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <label className="block text-sm space-y-1">
                <span className="muted">{t('ovEmailLanguage')}</span>
                <select
                  className="input"
                  value={emailSettings.language}
                  onChange={(e) =>
                    setEmailSettings((s) => ({
                      ...s,
                      language: e.target.value as 'en' | 'fr' | 'de',
                    }))
                  }
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={emailSettings.sendEveryDay}
                  onChange={(e) => setEmailSettings((s) => ({ ...s, sendEveryDay: e.target.checked }))}
                />
                <span>
                  <span className="text-sm font-medium block">{t('ovSendEveryDay')}</span>
                  <span className="text-xs muted">{t('ovSendEveryDayHint')}</span>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={emailSettings.sendEveryMonth}
                  onChange={(e) => setEmailSettings((s) => ({ ...s, sendEveryMonth: e.target.checked }))}
                />
                <span>
                  <span className="text-sm font-medium block">{t('ovSendEveryMonth')}</span>
                  <span className="text-xs muted">{t('ovSendEveryMonthHint')}</span>
                </span>
              </label>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm muted">{t('ovEmailList')}</span>
                  <button
                    type="button"
                    className="text-sm text-[var(--accent)] inline-flex items-center gap-1"
                    onClick={() => setEmailSettings((s) => ({ ...s, emails: [...s.emails, ''] }))}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('ovAddEmail')}
                  </button>
                </div>
                <div className="space-y-2">
                  {emailSettings.emails.map((email, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="email"
                        className="input flex-1"
                        placeholder={t('ovEmailPlaceholder')}
                        value={email}
                        onChange={(e) =>
                          setEmailSettings((s) => {
                            const emails = [...s.emails];
                            emails[idx] = e.target.value;
                            return { ...s, emails };
                          })
                        }
                      />
                      <button
                        type="button"
                        className="btn-secondary px-2"
                        onClick={() =>
                          setEmailSettings((s) => ({
                            ...s,
                            emails: s.emails.filter((_, i) => i !== idx),
                          }))
                        }
                        aria-label={t('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
              <button type="button" className="btn-secondary" onClick={() => setSettingsOpen(false)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn-primary" disabled={savingSettings} onClick={() => void saveSettings()}>
                {savingSettings ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
