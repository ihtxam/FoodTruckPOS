import { X } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

type Props = {
  open: boolean;
  initial?: string;
  onClose: () => void;
  onSave: (note: string) => void;
};

export default function WebPosOrderNoteModal({ open, initial = '', onClose, onSave }: Props) {
  const { t } = useI18n();
  const [note, setNote] = useState(initial);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h3 className="font-semibold">{t('webPosNote')}</h3>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <textarea
            className="input min-h-[6rem] w-full text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('webPosOrderNotePlaceholder')}
            autoFocus
          />
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              {t('cancel')}
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => {
                onSave(note.trim());
                onClose();
              }}
            >
              {t('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
