import { X } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (tabNumber: string) => void;
  current?: string | null;
};

export default function WebPosSetTabModal({ open, onClose, onConfirm, current }: Props) {
  const { t } = useI18n();
  const [value, setValue] = useState(current || '');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3">
      <div className="w-full max-w-xs rounded-2xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h3 className="font-semibold">{t('webPosSetTab')}</h3>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <input
            className="input w-full text-center text-2xl font-bold tabular-nums"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
            placeholder="123"
            autoFocus
          />
          <button
            type="button"
            className="btn-primary w-full py-3"
            disabled={!value}
            onClick={() => {
              onConfirm(value);
              onClose();
            }}
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
