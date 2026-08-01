import { CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type Props = {
  amount: number;
  changeDue?: number | null;
  onContinue: () => void;
};

export default function WebPosSuccessView({ amount, changeDue, onContinue }: Props) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-white px-6 text-center">
      <CheckCircle2 size={72} className="text-emerald-500" strokeWidth={1.5} />
      <h2 className="mt-4 text-2xl font-bold text-stone-800">{t('webPosPaymentSuccess')}</h2>
      <p className="mt-2 text-4xl font-light tabular-nums text-stone-700">CHF {amount.toFixed(2)}</p>
      {changeDue != null && changeDue > 0 ? (
        <p className="mt-3 text-lg font-semibold text-teal-800">
          {t('webPosChangeDue')}: CHF {changeDue.toFixed(2)}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onContinue}
        className="mt-8 min-w-[12rem] rounded-xl bg-teal-700 px-8 py-3.5 text-base font-semibold text-white hover:bg-teal-800"
      >
        {t('webPosContinue')}
      </button>
    </div>
  );
}
