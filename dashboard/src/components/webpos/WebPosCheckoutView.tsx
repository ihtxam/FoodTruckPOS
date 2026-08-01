import { Banknote, CreditCard, MonitorSmartphone, UserCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import type { PosCheckoutSettings } from '@/lib/pos-checkout';
import WebPosNumericKeypad from './WebPosNumericKeypad';
import type { PosPaymentMethod } from './types';

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
  onBack: () => void;
  onQuickBill: () => void;
  onSplit?: () => void;
  onPay: (method: PosPaymentMethod, amountTendered: number | null) => void;
};

export default function WebPosCheckoutView({
  total,
  splitLabel,
  splitGuestCount,
  settings,
  methods,
  busy,
  onBack,
  onQuickBill,
  onSplit,
  onPay,
}: Props) {
  const { t } = useI18n();
  const [buffer, setBuffer] = useState('');

  const perGuest =
    splitGuestCount && splitGuestCount > 1
      ? roundMoney2(total / splitGuestCount)
      : null;

  const tenderAmount = useMemo(() => {
    const n = Number(buffer);
    if (Number.isFinite(n) && n > 0) return roundMoney2(n);
    return total;
  }, [buffer, total]);

  const payButtons: Array<{
    id: PosPaymentMethod;
    label: string;
    icon: React.ReactNode;
    show: boolean;
  }> = [
    { id: 'cash', label: t('webPosCash'), icon: <Banknote size={22} />, show: methods.cash },
    { id: 'card', label: t('webPosCard'), icon: <CreditCard size={22} />, show: methods.card },
    {
      id: 'terminal',
      label: t('webPosTerminal'),
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

  const payWith = (method: PosPaymentMethod) => {
    const tendered = method === 'cash' ? tenderAmount : null;
    onPay(method, tendered);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white lg:flex-row">
      <div className="flex shrink-0 flex-col gap-2 border-b border-stone-100 p-4 lg:w-56 lg:border-b-0 lg:border-r">
        {payButtons
          .filter((b) => b.show)
          .map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={busy}
              onClick={() => payWith(b.id)}
              className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-4 text-left text-sm font-semibold hover:bg-stone-100 disabled:opacity-40"
            >
              {b.icon}
              {b.label}
            </button>
          ))}
        {settings.splitBillsEnabled && onSplit ? (
          <button type="button" className="btn-secondary mt-2" onClick={onSplit}>
            {t('webPosSplitBill')}
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
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
          {splitLabel ? <p className="mt-1 text-sm font-medium text-teal-700">{splitLabel}</p> : null}
        </div>

        <div className="mt-auto border-t border-stone-100 p-4 lg:max-w-md">
          <div className="mb-3 flex gap-2">
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
          </div>
          <WebPosNumericKeypad
            mode="qty"
            onModeChange={() => undefined}
            buffer={buffer}
            onBufferChange={setBuffer}
            onApply={() => undefined}
            showModeButtons={false}
            showQuickAdd
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => payWith('cash')}
            className="mt-2 w-full rounded-xl bg-violet-700 py-3 text-base font-bold text-white hover:bg-violet-800 disabled:opacity-40"
          >
            {t('webPosCash')} · CHF {tenderAmount.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
