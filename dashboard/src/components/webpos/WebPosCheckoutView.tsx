import { Banknote, CreditCard, Gift, MonitorSmartphone, UserCircle2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import type { PosCheckoutSettings } from '@/lib/pos-checkout';
import WebPosTipKeypad from '@/components/WebPosTipKeypad';
import WebPosNumericKeypad from './WebPosNumericKeypad';
import type { PosPaymentMethod } from './types';

export type AppliedPayment = {
  id: string;
  method: PosPaymentMethod;
  amount: number;
  giftCardId?: string;
  giftCardNumber?: string;
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
    giftCard?: boolean;
  };
  busy: boolean;
  customerLabel?: string | null;
  onSplit?: () => void;
  onComplete: (payments: AppliedPayment[], changeDue: number, tipAmount: number) => void;
  onGiftCardRequest?: (remaining: number) => void;
  injectPayment?: AppliedPayment | null;
  onInjectPaymentConsumed?: () => void;
};

function newPayId() {
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function WebPosCheckoutView({
  total: baseTotal,
  splitLabel,
  splitGuestCount,
  settings,
  methods,
  busy,
  customerLabel,
  onSplit,
  onComplete,
  onGiftCardRequest,
  injectPayment,
  onInjectPaymentConsumed,
}: Props) {
  const { t } = useI18n();
  const [buffer, setBuffer] = useState('');
  const [payments, setPayments] = useState<AppliedPayment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [invoice, setInvoice] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [tipOpen, setTipOpen] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const total = useMemo(() => roundMoney2(baseTotal + tipAmount), [baseTotal, tipAmount]);

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
    if (!buffer) return null;
    const n = Number(buffer);
    if (Number.isFinite(n) && n >= 0) return roundMoney2(n);
    return null;
  }, [buffer]);

  // Default: cash covers full amount when entering checkout
  useEffect(() => {
    if (seeded) return;
    const defaultMethod: PosPaymentMethod | null = methods.cash
      ? 'cash'
      : methods.card
        ? 'card'
        : methods.terminal
          ? 'terminal'
          : methods.giftCard
            ? 'gift_card'
            : methods.payLater
              ? 'pay_later'
              : null;
    if (defaultMethod && baseTotal > 0 && defaultMethod !== 'gift_card') {
      setPayments([{ id: newPayId(), method: defaultMethod, amount: roundMoney2(baseTotal) }]);
    }
    setSeeded(true);
  }, [seeded, methods.cash, methods.card, methods.terminal, methods.giftCard, methods.payLater, baseTotal]);

  // Inject gift-card tender from parent RFID/QR modal
  useEffect(() => {
    if (!injectPayment) return;
    setPayments((prev) => {
      const withoutGc = prev.filter((p) => p.method !== 'gift_card' || p.giftCardId !== injectPayment.giftCardId);
      // Replace a single covering tender if still alone and unpaid remainder matches
      if (withoutGc.length === 1 && Math.abs(withoutGc[0]!.amount - total) < 0.011) {
        const cover = withoutGc[0]!;
        const rest = roundMoney2(Math.max(0, cover.amount - injectPayment.amount));
        const next: AppliedPayment[] = [
          { ...injectPayment, id: injectPayment.id || newPayId() },
        ];
        if (rest > 0.001) {
          next.push({ id: newPayId(), method: cover.method, amount: rest });
        }
        return next;
      }
      return [...withoutGc, { ...injectPayment, id: injectPayment.id || newPayId() }];
    });
    onInjectPaymentConsumed?.();
  }, [injectPayment, onInjectPaymentConsumed, total]);

  // Keep sole full-cover tender in sync when tip changes total
  useEffect(() => {
    if (!seeded) return;
    setPayments((prev) => {
      if (prev.length !== 1) return prev;
      const only = prev[0]!;
      const withoutTip = roundMoney2(baseTotal);
      const coversBaseOrTotal =
        Math.abs(only.amount - withoutTip) < 0.011 || Math.abs(only.amount - total) < 0.011;
      if (!coversBaseOrTotal || Math.abs(only.amount - total) < 0.005) return prev;
      return [{ ...only, amount: total }];
    });
  }, [tipAmount, total, baseTotal, seeded]);

  // Live-update selected payment row from keypad
  useEffect(() => {
    if (!selectedPaymentId || bufferAmount == null) return;
    setPayments((prev) =>
      prev.map((p) => (p.id === selectedPaymentId ? { ...p, amount: bufferAmount } : p))
    );
  }, [bufferAmount, selectedPaymentId]);

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
      id: 'gift_card',
      label: t('giftCard'),
      icon: <Gift size={22} />,
      show: !!methods.giftCard,
    },
    {
      id: 'pay_later',
      label: t('webPosPayLater'),
      icon: <UserCircle2 size={22} />,
      show: methods.payLater,
    },
  ];

  const methodLabel = (m: PosPaymentMethod) =>
    payButtons.find((b) => b.id === m)?.label || m;

  const applyMethod = (method: PosPaymentMethod) => {
    if (busy) return;

    if (method === 'gift_card') {
      const due =
        bufferAmount != null && bufferAmount > 0
          ? bufferAmount
          : remaining > 0
            ? remaining
            : total;
      onGiftCardRequest?.(roundMoney2(due));
      return;
    }

    // Change method (and optionally amount) on selected row
    if (selectedPaymentId) {
      const amount = bufferAmount ?? payments.find((p) => p.id === selectedPaymentId)?.amount ?? remaining;
      if (amount < 0) return;
      setPayments((prev) =>
        prev.map((p) =>
          p.id === selectedPaymentId ? { ...p, method, amount: roundMoney2(amount) } : p
        )
      );
      return;
    }

    // With a typed amount before method: use it; else full remaining (or full total if empty)
    const amount =
      bufferAmount != null && bufferAmount > 0
        ? bufferAmount
        : remaining > 0
          ? remaining
          : total;
    if (amount <= 0) return;

    // If no payments yet, set as sole tender
    if (payments.length === 0) {
      setPayments([{ id: newPayId(), method, amount: roundMoney2(amount) }]);
      setBuffer('');
      return;
    }

    // Multi-tender: add another method for remaining / typed amount
    setPayments((prev) => [
      ...prev,
      { id: newPayId(), method, amount: roundMoney2(amount) },
    ]);
    setBuffer('');
  };

  const removePayment = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
    if (selectedPaymentId === id) {
      setSelectedPaymentId(null);
      setBuffer('');
    }
  };

  const canComplete = payments.length > 0 && paid + 0.001 >= total;

  const complete = () => {
    if (!canComplete || busy) return;
    onComplete(payments, changeDue, tipAmount);
  };

  const liveEntryLabel =
    bufferAmount != null
      ? `CHF ${bufferAmount.toFixed(2)}`
      : buffer
        ? `CHF ${buffer}`
        : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white lg:flex-row">
      {/* Left: payment methods + tip + keypad */}
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
                ? 'border-[var(--webpos-accent-ring)] bg-[var(--webpos-accent-soft)] text-[var(--webpos-accent-text)]'
                : 'border-stone-200 bg-white text-stone-600'
            }`}
          >
            <span
              className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px] ${
                invoice
                  ? 'border-[var(--webpos-accent)] bg-[var(--webpos-accent)] text-white'
                  : 'border-stone-400'
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

        <div className="mt-auto space-y-2 border-t border-stone-100 pt-3">
          {settings.tipsEnabled ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setTipOpen(true)}
              className="w-full rounded-lg bg-[var(--webpos-accent-soft)] py-2.5 text-sm font-bold uppercase tracking-wide text-[var(--webpos-accent-text)] ring-1 ring-[var(--webpos-accent-ring)] hover:brightness-95 disabled:opacity-40"
            >
              {t('webPosTip')}
              {tipAmount > 0 ? ` - CHF ${tipAmount.toFixed(2)}` : ''}
            </button>
          ) : null}
          <WebPosNumericKeypad
            mode="qty"
            onModeChange={() => undefined}
            buffer={buffer}
            onBufferChange={setBuffer}
            onApply={complete}
            showModeButtons={false}
            showQuickAdd
            compact
            disabled={busy}
            applyLabel={canComplete ? t('webPosConfirmPay') : t('webPosExact')}
            applyDisabled={busy || !canComplete}
          />
        </div>
      </div>

      {/* Right: amount due + payment rows */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center px-4 py-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-stone-400">
            {t('webPosAmountDue')}
          </p>
          <p className="text-5xl font-light tabular-nums tracking-tight text-stone-700 sm:text-6xl">
            CHF {total.toFixed(2)}
          </p>
          {tipAmount > 0 ? (
            <p className="mt-1 text-sm text-[var(--webpos-accent-text)]">
              {t('webPosTip')}: CHF {tipAmount.toFixed(2)}
            </p>
          ) : null}
          {liveEntryLabel && !selectedPaymentId ? (
            <p className="mt-2 text-base font-semibold tabular-nums text-[var(--webpos-accent-text)]">
              {t('webPosEntering')}: {liveEntryLabel}
            </p>
          ) : null}
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
                      if (selected) {
                        setSelectedPaymentId(null);
                        setBuffer('');
                      } else {
                        setSelectedPaymentId(p.id);
                        setBuffer(String(p.amount));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        if (selected) {
                          setSelectedPaymentId(null);
                          setBuffer('');
                        } else {
                          setSelectedPaymentId(p.id);
                          setBuffer(String(p.amount));
                        }
                      }
                    }}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${
                      selected
                        ? 'border-[var(--webpos-accent-ring)] bg-[var(--webpos-accent-soft)] ring-1 ring-[var(--webpos-accent-ring)]'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-semibold">{methodLabel(p.method)}</span>
                      {selected && liveEntryLabel ? (
                        <p className="mt-0.5 text-xs font-medium text-[var(--webpos-accent-text)]">
                          {t('webPosEntering')}: {liveEntryLabel}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums">
                        CHF {(selected && bufferAmount != null ? bufferAmount : p.amount).toFixed(2)}
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

        {canComplete ? (
          <div className="mt-auto border-t border-stone-100 p-4">
            <button
              type="button"
              disabled={busy}
              onClick={complete}
              className="webpos-accent-btn w-full rounded-xl px-4 py-3.5 text-sm font-bold disabled:opacity-40"
            >
              {t('webPosConfirmPay')}
              {changeDue > 0 ? ` ù ${t('webPosChangeDue')} CHF ${changeDue.toFixed(2)}` : ''}
            </button>
          </div>
        ) : null}
      </div>

      <WebPosTipKeypad
        open={tipOpen}
        initial={tipAmount}
        baseAmount={baseTotal}
        presetsPercent={settings.tipPresetsPercent}
        allowPercent
        allowCustom={settings.allowCustomTip !== false}
        onClose={() => setTipOpen(false)}
        onConfirm={(amount) => {
          setTipAmount(roundMoney2(Math.max(0, amount)));
          setTipOpen(false);
        }}
      />
    </div>
  );
}
