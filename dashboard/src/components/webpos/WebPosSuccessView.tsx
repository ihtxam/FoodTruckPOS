import { CheckCircle2, ChevronLeft, Printer, Send } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type Props = {
  amount: number;
  changeDue?: number | null;
  onContinue: () => void;
  onPrint?: () => void;
  onSendReceipt?: () => void;
  onBack?: () => void;
  compact?: boolean;
};

export default function WebPosSuccessView({
  amount,
  changeDue,
  onContinue,
  onPrint,
  onSendReceipt,
  onBack,
  compact = false,
}: Props) {
  const { t } = useI18n();
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100)
    .toString()
    .padStart(2, '0');

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col items-center justify-center bg-white px-6 text-center ${
        compact ? 'rounded-2xl border border-stone-200 shadow-xl' : ''
      }`}
    >
      <CheckCircle2 size={compact ? 56 : 72} className="text-emerald-500" strokeWidth={1.5} />
      <h2 className="mt-4 text-xl font-bold text-stone-800 sm:text-2xl">{t('webPosAmountPaid')}</h2>
      <p className="mt-2 tabular-nums tracking-tight text-stone-700">
        <span className="text-2xl font-medium text-stone-400">CHF </span>
        <span className="text-5xl font-bold sm:text-6xl">{whole}</span>
        <span className="text-2xl font-medium text-stone-400">.{cents}</span>
      </p>
      {changeDue != null && changeDue > 0 ? (
        <p className="mt-4 text-lg font-semibold text-[var(--webpos-accent-text)]">
          {t('webPosChangeDue')}: CHF {changeDue.toFixed(2)}
        </p>
      ) : null}

      <div className="mt-10 flex w-full max-w-lg flex-wrap items-stretch justify-center gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-w-[5.5rem] flex-1 items-center justify-center gap-1 rounded-xl bg-stone-100 px-4 py-3.5 text-sm font-semibold text-stone-700 hover:bg-stone-200"
          >
            <ChevronLeft size={18} />
            {t('webPosBack')}
          </button>
        ) : null}
        {onPrint ? (
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex min-w-[5.5rem] flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-100 px-4 py-3.5 text-sm font-semibold text-stone-700 hover:bg-stone-200"
          >
            <Printer size={18} />
            {t('webPosPrint')}
          </button>
        ) : null}
        {onSendReceipt ? (
          <button
            type="button"
            onClick={onSendReceipt}
            className="inline-flex min-w-[5.5rem] flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-100 px-4 py-3.5 text-sm font-semibold text-stone-700 hover:bg-stone-200"
          >
            <Send size={18} />
            {t('webPosSendReceipt')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onContinue}
          className="min-w-[7rem] flex-[1.3] rounded-xl bg-violet-800 px-6 py-3.5 text-sm font-semibold text-white hover:bg-violet-900"
        >
          {t('webPosContinue')}
        </button>
      </div>
    </div>
  );
}
