import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';

type TipMode = 'amount' | 'percent';

type Props = {
  open: boolean;
  initial?: number;
  title?: string;
  /** Order total before tip - used for % mode */
  baseAmount?: number;
  presetsPercent?: number[];
  allowPercent?: boolean;
  allowCustom?: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
};

export default function WebPosTipKeypad({
  open,
  initial = 0,
  title,
  baseAmount = 0,
  presetsPercent = [5, 10, 15],
  allowPercent = true,
  allowCustom = true,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<TipMode>('amount');
  const [buf, setBuf] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode('amount');
    setBuf(initial > 0 ? String(roundMoney2(initial)) : '');
  }, [open, initial]);

  if (!open) return null;

  const push = (ch: string) => {
    setBuf((prev) => {
      if (ch === '.' && prev.includes('.')) return prev;
      if (prev === '0' && ch !== '.') return ch;
      if (prev.includes('.') && prev.split('.')[1]!.length >= 2) return prev;
      return (prev + ch).slice(0, 10);
    });
  };

  const resolvedAmount = (() => {
    const n = Number(buf) || 0;
    if (mode === 'percent') {
      return roundMoney2((Math.max(0, baseAmount) * Math.max(0, n)) / 100);
    }
    return roundMoney2(Math.max(0, n));
  })();

  const display =
    mode === 'percent'
      ? `${buf || '0'}% → CHF ${resolvedAmount.toFixed(2)}`
      : `CHF ${buf || '0'}`;

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3">
      <div className="w-full max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="font-semibold">{title || t('webPosTip')}</h3>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          {allowPercent ? (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setMode('amount');
                  setBuf('');
                }}
                className={`rounded-lg py-2 text-xs font-bold uppercase ${
                  mode === 'amount'
                    ? 'bg-[var(--webpos-accent-soft)] text-[var(--webpos-accent-text)] ring-1 ring-[var(--webpos-accent-ring)]'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                {t('webPosTipFixed')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('percent');
                  setBuf('');
                }}
                className={`rounded-lg py-2 text-xs font-bold uppercase ${
                  mode === 'percent'
                    ? 'bg-[var(--webpos-accent-soft)] text-[var(--webpos-accent-text)] ring-1 ring-[var(--webpos-accent-ring)]'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                {t('webPosTipPercent')}
              </button>
            </div>
          ) : null}

          {mode === 'percent' && presetsPercent.length ? (
            <div className="flex flex-wrap gap-1.5">
              {presetsPercent
                .filter((p) => p > 0)
                .map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-semibold hover:bg-stone-50"
                    onClick={() => setBuf(String(pct))}
                  >
                    {pct}%
                  </button>
                ))}
            </div>
          ) : null}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-right text-xl font-semibold tabular-nums">
            {display}
          </div>

          {allowCustom !== false ? (
            <div className="grid grid-cols-3 gap-2">
              {keys.map((k) => (
                <button
                  key={k}
                  type="button"
                  className="rounded-xl border border-[var(--border)] py-3 text-lg font-semibold hover:bg-[var(--bg)]"
                  onClick={() => {
                    if (k === '⌫') setBuf((p) => p.slice(0, -1));
                    else push(k);
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => {
                setBuf('');
                onConfirm(0);
              }}
            >
              {t('clear')}
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => {
                onConfirm(resolvedAmount);
                onClose();
              }}
            >
              {t('confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
