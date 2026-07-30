import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Printer } from 'lucide-react';
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

type EodReport = {
  range: { label: string; from: string; to: string; preset: string };
  salesCount: number;
  cancelledCount: number;
  revenue: number;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  tipsTotal: number;
  refundTotal: number;
  cancelledTotal: number;
  grandTotal: number;
  coversServed: number | null;
  cashTotal: number;
  cardTotal: number;
  terminalTotal: number;
  paymentRows: Array<{ method: string; count: number; total: number }>;
  channelRows: Array<{ channel: string; count: number; total: number }>;
  productsSold: Array<{ name: string; quantity: number; total: number }>;
};

type Preset = 'today' | 'yesterday' | 'last_week' | 'last_month' | 'custom';

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const [preset, setPreset] = useState<Preset>('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<EodReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [printSettings, setPrintSettings] = useState<PosPrintSettingsClient | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ preset });
      if (preset === 'custom') {
        if (from) params.set('from', from);
        if (to) params.set('to', to);
      }
      const [repRes, setRes] = await Promise.all([
        api.get(`/merchant/reports/eod?${params}`),
        api.get('/merchant/settings'),
      ]);
      setReport(repRes.data.report);
      const s = setRes.data.settings;
      setPrintSettings(s?.posPrintSettings || null);
      setBusinessName(s?.name || '');
      setShopLogoUrl(s?.shopLogoUrl || s?.posPrintSettings?.receiptLogoUrl || null);
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('reportsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [preset, from, to, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const money = (n: number) => `CHF ${Number(n || 0).toFixed(2)}`;

  const printEod = async () => {
    if (!report) return;
    try {
      const lang = resolveReceiptLanguage(printSettings, locale);
      const targets = printersForRole(printSettings, 'eod');
      const paperWidthMm =
        targets[0]?.paperWidthMm || printSettings?.paperWidthMm || 80;
      const text = generateEodReportText({
        label: report.range.label,
        salesCount: report.salesCount,
        revenue: report.revenue,
        taxTotal: report.taxTotal,
        refundTotal: report.refundTotal,
        cancelledCount: report.cancelledCount,
        cancelledTotal: report.cancelledTotal,
        cashTotal: report.cashTotal,
        cardTotal: report.cardTotal,
        terminalTotal: report.terminalTotal,
        coversServed: report.coversServed,
        productsSold: report.productsSold,
        paymentRows: report.paymentRows,
        businessName,
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
      toast.error(e.message || t('webPosPrintFailed'));
    }
  };

  const presets: { id: Preset; label: string }[] = [
    { id: 'today', label: t('reportsToday') },
    { id: 'yesterday', label: t('reportsYesterday') },
    { id: 'last_week', label: t('reportsLastWeek') },
    { id: 'last_month', label: t('reportsLastMonth') },
    { id: 'custom', label: t('reportsCustom') },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('reports')}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t('reportsHint')}</p>
        </div>
        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-2"
          onClick={() => void printEod()}
          disabled={!report || loading}
        >
          <Printer size={16} />
          {t('reportsPrintEod')}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={`rounded-lg px-3 py-1.5 text-sm border ${
              preset === p.id
                ? 'bg-[var(--bg-elevated)] border-[var(--border)] shadow-sm font-medium'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm space-y-1">
            <span className="muted">{t('reportsFrom')}</span>
            <input
              type="date"
              className="input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
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

      {loading ? (
        <p className="text-sm muted">{t('loading')}</p>
      ) : !report ? (
        <p className="text-sm muted">{t('reportsEmpty')}</p>
      ) : (
        <>
          <p className="text-sm text-[var(--text-muted)]">{report.range.label}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              [t('reportsSalesCount'), String(report.salesCount)],
              [t('reportsRevenue'), money(report.revenue)],
              [t('reportsTax'), money(report.taxTotal)],
              [t('reportsNet'), money(report.grandTotal)],
              [t('reportsCash'), money(report.cashTotal)],
              [t('reportsCard'), money(report.cardTotal)],
              [t('reportsTerminal'), money(report.terminalTotal)],
              [t('reportsRefunds'), money(report.refundTotal)],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3"
              >
                <p className="text-[11px] uppercase tracking-wide muted">{label}</p>
                <p className="text-lg font-semibold tabular-nums mt-1">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <section className="rounded-xl border border-[var(--border)] overflow-hidden">
              <h2 className="px-3 py-2 text-sm font-semibold bg-[var(--bg-muted)]">
                {t('reportsByChannel')}
              </h2>
              <ul className="divide-y divide-[var(--border)] text-sm">
                {report.channelRows.length === 0 ? (
                  <li className="px-3 py-3 muted">{t('reportsEmpty')}</li>
                ) : (
                  report.channelRows.map((r) => (
                    <li key={r.channel} className="flex justify-between px-3 py-2">
                      <span>
                        {r.channel} ù {r.count}
                      </span>
                      <span className="tabular-nums">{money(r.total)}</span>
                    </li>
                  ))
                )}
              </ul>
            </section>
            <section className="rounded-xl border border-[var(--border)] overflow-hidden">
              <h2 className="px-3 py-2 text-sm font-semibold bg-[var(--bg-muted)]">
                {t('reportsByPayment')}
              </h2>
              <ul className="divide-y divide-[var(--border)] text-sm">
                {report.paymentRows.length === 0 ? (
                  <li className="px-3 py-3 muted">{t('reportsEmpty')}</li>
                ) : (
                  report.paymentRows.map((r) => (
                    <li key={r.method} className="flex justify-between px-3 py-2">
                      <span>
                        {r.method} ù {r.count}
                      </span>
                      <span className="tabular-nums">{money(r.total)}</span>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <section className="rounded-xl border border-[var(--border)] overflow-hidden">
            <h2 className="px-3 py-2 text-sm font-semibold bg-[var(--bg-muted)]">
              {t('reportsProductsSold')}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border)]">
                    <th className="px-3 py-2 font-medium">{t('reportsProduct')}</th>
                    <th className="px-3 py-2 font-medium">{t('reportsQty')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('reportsRevenue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.productsSold.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-3 muted">
                        {t('reportsEmpty')}
                      </td>
                    </tr>
                  ) : (
                    report.productsSold.map((p) => (
                      <tr key={p.name} className="border-b border-[var(--border)]/60">
                        <td className="px-3 py-2">{p.name}</td>
                        <td className="px-3 py-2 tabular-nums">{p.quantity}</td>
                        <td className="px-3 py-2 tabular-nums text-right">{money(p.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
