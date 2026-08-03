import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export type CancelScope = 'order' | 'item';

type Props = {
  open: boolean;
  scope: CancelScope;
  itemLabel?: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

const REASON_KEYS = [
  'webPosCancelReasonBusy',
  'webPosCancelReasonClient',
  'webPosCancelReasonStock',
  'webPosCancelReasonWrong',
  'webPosCancelReasonProcess',
  'webPosCancelReasonOther',
] as const;

export default function WebPosCancelModal({
  open,
  scope,
  itemLabel,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const reasons = useMemo(() => REASON_KEYS.map((k) => t(k)), [t]);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setReason(reasons[0] || '');
  }, [open, reasons]);

  if (!open) return null;

  const title =
    scope === 'item'
      ? t('webPosCancelItem')
      : t('webPosCancelOrder');

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/45 p-3">
      <div className="w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] shadow-xl border border-[var(--border)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="font-semibold text-rose-700">{title}</h2>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {scope === 'item' && itemLabel ? (
            <p className="text-sm text-[var(--text-muted)]">{itemLabel}</p>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">{t('webPosCancelReasonPrompt')}</p>
          )}
          <div className="space-y-1.5">
            {reasons.map((r) => (
              <label
                key={r}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                  reason === r
                    ? 'border-rose-500 bg-rose-50 font-semibold text-rose-900'
                    : 'border-[var(--border)]'
                }`}
              >
                <input
                  type="radio"
                  name="webpos-cancel-reason"
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-rose-600"
                />
                {r}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2 border-t border-[var(--border)] p-4">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-40"
            disabled={!reason}
            onClick={() => onConfirm(reason)}
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
