import { useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';

type Props = {
  open: boolean;
  initial?: number;
  onClose: () => void;
  onConfirm: (amount: number) => void;
};

export default function WebPosTipKeypad({ open, initial = 0, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const [buf, setBuf] = useState(() =>
    initial > 0 ? String(roundMoney2(initial)) : ''
  );

  if (!open) return null;

  const display = buf || '0';
  const push = (ch: string) => {
    setBuf((prev) => {
      if (ch === '.' && prev.includes('.')) return prev;
      if (prev === '0' && ch !== '.') return ch;
      if (prev.includes('.') && prev.split('.')[1]!.length >= 2) return prev;
      return (prev + ch).slice(0, 10);
    });
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '?'];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3">
      <div className="w-full max-w-xs rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="font-semibold">{t('webPosTipAmount')}</h3>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="rounded-xl bg-[var(--bg)] border border-[var(--border)] px-4 py-3 text-right text-2xl font-semibold tabular-nums">
            CHF {display}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {keys.map((k) => (
              <button
                key={k}
                type="button"
                className="rounded-xl border border-[var(--border)] py-3 text-lg font-semibold hover:bg-[var(--bg)]"
                onClick={() => {
                  if (k === '?') setBuf((p) => p.slice(0, -1));
                  else push(k);
                }}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setBuf('')}>
              {t('clear')}
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => {
                onConfirm(roundMoney2(Math.max(0, Number(buf) || 0)));
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
