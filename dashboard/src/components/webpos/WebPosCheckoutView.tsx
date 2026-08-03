import { Banknote, CreditCard, MonitorSmartphone, UserCircle2, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import type { PosCheckoutSettings } from '@/lib/pos-checkout';
import WebPosNumericKeypad from './WebPosNumericKeypad';
import type { PosPaymentMethod } from './types';

export type AppliedPayment = {
  id: string;
  method: PosPaymentMethod;
  amount: number;
};

type Props = {
  total: number;
  splitLabel?: string | null;
  splitGuestCount?: number;
  settings: PosCheckoutSettings;
  methods: {
    cash: boolean;
    card: boolean;
    terminal: boolean;
    payLater: boolean;
  };
  busy: boolean;
  customerLabel?: string | null;
  onBack: () => void;
  onQuickBill: () => void;
  onSplit?: () => void;
  onComplete: (payments: AppliedPayment[], changeDue: number) => void;
};

export default function WebPosCheckoutView({
  total,
  splitLabel,
  splitGuestCount,
  settings,
  methods,
  busy,
  customerLabel,
  onBack,
  onQuickBill,
  onSplit,
  onComplete,
}: Props) {
  const { t } = useI18n();
  const [buffer, setBuffer] = useState('');
  const [payments, setPayments] = useState<AppliedPayment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [invoice, setInvoice] = useState(false);

  const paid = useMemo(
    () => roundMoney2(payments.reduce((s, p) => s + p.amount, 0)),
    [payments]
  );
  const remaining = useMemo(() => roundMoney2(Math.max(0, total - paid)), [total, paid]);
  const changeDue = useMemo(() => roundMoney2(Math.max(0, paid - total)), [paid, total]);

  const perGuest =
    splitGuestCount && splitGuestCount > 1
      ? roundMoney2(total / splitGuestCount)
      : null;

  const bufferAmount = useMemo(() => {
    const n = Number(buffer);
    if (Number.isFinite(n) && n > 0) return roundMoney2(n);
    return null;
  }, [buffer]);

  const payButtons: Array<{
    id: PosPaymentMethod;
    label: string;
    icon: ReactNode;
    show: boolean;
  }> = [
    { id: 'cash', label: t('webPosCash'), icon: <Banknote size={22} />, show: methods.cash },
    { id: 'card', label: t('webPosCard'), icon: <CreditCard size={22} />, show: methods.card },
    {
      id: 'terminal',
      label: t('webPosOnlinePayment'),
      icon: <MonitorSmartphone size={22} />,
      show: methods.terminal,
    },
    {
      id: 'pay_later',
      label: t('webPosCustomerAccount'),
      icon: <UserCircle2 size={22} />,
      show: methods.payLater,
    },
  ];

  const methodLabel = (m: PosPaymentMethod) =>
    payButtons.find((b) => b.id === m)?.label || m;

  const applyMethod = (method: PosPaymentMethod) => {
    if (busy) return;

    // Overwrite selected applied payment amount
    if (selectedPaymentId) {
      const amount = bufferAmount ?? remaining;
      if (amount <= 0) return;
      setPayments((prev) =>
        prev.map((p) => (p.id === selectedPaymentId ? { ...p, method, amount } : p))
      );
      setSelectedPaymentId(null);
      setBuffer('');
      return;
    }

    const amount = bufferAmount ?? (remaining > 0 ? remaining : total);
    if (amount <= 0) return;
    setPayments((prev) => [
      ...prev,
      { id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, method, amount },
    ]);
    setBuffer('');
  };

  const removePayment = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
    if (selectedPaymentId === id) setSelectedPaymentId(null);
  };

  const canValidate = payments.length > 0 && paid + 0.001 >= total;

  const validate = () => {
    if (!canValidate || busy) return;
    onComplete(payments, changeDue);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white lg:flex-row">
      {/* Left: payment methods + keypad BELOW (no separate left-bar-only layout) */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-stone-100 p-3 lg:w-[min(20rem,36vw)] lg:border-b-0 lg:border-r lg:overflow-y-auto">
        {payButtons
          .filter((b) => b.show)
          .map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={busy}
              onClick={() => applyMethod(b.id)}
              className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-left text-sm font-semibold hover:bg-stone-100 disabled:opacity-40"
            >
              {b.icon}
              {b.label}
            </button>
          ))}

        <div className="mt-1 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg border border-stone-200 bg-white px-2 py-2 text-xs font-semibold text-stone-700"
          >
            {customerLabel || t('webPosCustomer')}
          </button>
          <button
            type="button"
            onClick={() => setInvoice((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${
              invoice
                ? 'border-violet-400 bg-violet-50 text-violet-900'
                : 'border-stone-200 bg-white text-stone-600'
            }`}
          >
            <span
              className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px] ${
                invoice ? 'border-violet-600 bg-violet-600 text-white' : 'border-stone-400'
              }`}
            >
              {invoice ? '?' : ''}
            </span>
            {t('webPosInvoice')}
          </button>
        </div>

        {settings.splitBillsEnabled && onSplit ? (
          <button type="button" className="btn-secondary text-sm" onClick={onSplit}>
            {t('webPosSplitBill')}
          </button>
        ) : null}

        <div className="mt-auto border-t border-stone-100 pt-3">
          <WebPosNumericKeypad
            mode="qty"
            onModeChange={() => undefined}
            buffer={buffer}
            onBufferChange={setBuffer}
            onApply={validate}
            showModeButtons={false}
            showQuickAdd
            disabled={busy}
            applyLabel={t('webPosValidate')}
          />
        </div>
      </div>

      {/* Right: total + applied payments + remaining */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center px-4 py-8 text-center">
          <p className="text-5xl font-light tabular-nums tracking-tight text-stone-700 sm:text-6xl">
            CHF {total.toFixed(2)}
          </p>
          {perGuest ? (
            <p className="mt-3 text-lg text-stone-500">
              CHF {perGuest.toFixed(2)} / {t('webPosGuest')}{' '}
              <span className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded bg-stone-200 text-sm font-bold">
                {splitGuestCount}
              </span>
            </p>
          ) : null}
          {splitLabel ? (
            <p className="mt-1 text-sm font-medium text-[var(--webpos-accent-text)]">{splitLabel}</p>
          ) : null}

          <div className="mt-8 w-full max-w-md space-y-2 text-left">
            {payments.length === 0 ? (
              <p className="text-center text-sm text-stone-400">{t('webPosTapPaymentMethod')}</p>
            ) : (
              payments.map((p) => {
                const selected = selectedPaymentId === p.id;
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedPaymentId(selected ? null : p.id);
                      setBuffer(String(p.amount));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedPaymentId(selected ? null : p.id);
                        setBuffer(String(p.amount));
                      }
                    }}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${
                      selected
                        ? 'border-sky-400 bg-sky-50 ring-1 ring-sky-300'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <span className="text-sm font-semibold">{methodLabel(p.method)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums">
                        CHF {p.amount.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        className="rounded p-1 text-red-500 hover:bg-red-50"
                        aria-label={t('delete')}
                        onClick={(e) => {
                          e.stopPropagation();
                          removePayment(p.id);
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-6 w-full max-w-md space-y-1 text-sm">
            <div className="flex justify-between font-semibold">
              <span>{t('webPosRemaining')}</span>
              <span className="tabular-nums text-[var(--webpos-accent-text)]">
                CHF {remaining.toFixed(2)}
              </span>
            </div>
            {changeDue > 0 ? (
              <div className="flex justify-between font-semibold text-emerald-700">
                <span>{t('webPosChangeDue')}</span>
                <span className="tabular-nums">CHF {changeDue.toFixed(2)}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-auto flex gap-2 border-t border-stone-100 p-4">
          <button type="button" className="btn-secondary flex-1" onClick={onBack}>
            {t('webPosBack')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onQuickBill}
            className="flex-[1.2] rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {t('webPosQuickBill')}
          </button>
          <button
            type="button"
            disabled={busy || !canValidate}
            onClick={validate}
            className="flex-[1.4] rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-40"
          >
            {t('webPosValidate')}
          </button>
        </div>
      </div>
    </div>
  );
}
