import { X } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

const PRESETS = [
  'Bring next dish',
  'Fire mains now',
  'Ready for dessert',
  'More bread please',
  'Hurry please',
];

type Props = {
  open: boolean;
  onClose: () => void;
  onSend: (message: string) => void;
};

export default function WebPosKitchenMessageModal({ open, onClose, onSend }: Props) {
  const { t } = useI18n();
  const [custom, setCustom] = useState('');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h3 className="font-semibold">{t('webPosKitchenMessage')}</h3>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((msg) => (
              <button
                key={msg}
                type="button"
                className="rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium hover:bg-stone-50"
                onClick={() => {
                  onSend(msg);
                  onClose();
                }}
              >
                {msg}
              </button>
            ))}
          </div>
          <textarea
            className="input min-h-[4rem] w-full text-sm"
            placeholder={t('webPosCustomMessage')}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary w-full"
            disabled={!custom.trim()}
            onClick={() => {
              onSend(custom.trim());
              setCustom('');
              onClose();
            }}
          >
            {t('webPosSendMessage')}
          </button>
        </div>
      </div>
    </div>
  );
}
