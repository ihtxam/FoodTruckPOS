import { useI18n } from '@/lib/i18n';
import WebPosTablesView from './WebPosTablesView';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (table: { id: string; label: string }) => void;
  selectedTableId?: string | null;
};

export default function WebPosSetTableModal({ open, onClose, onSelect, selectedTableId }: Props) {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <h3 className="font-semibold">{t('webPosSetTable')}</h3>
        <button type="button" className="btn-secondary text-sm" onClick={onClose}>
          {t('close')}
        </button>
      </div>
      <WebPosTablesView
        selectedTableId={selectedTableId}
        onSelectTable={(table) => {
          onSelect(table);
          onClose();
        }}
      />
    </div>
  );
}
