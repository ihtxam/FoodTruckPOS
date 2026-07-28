import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

export type ShopVacationInfo = {
  active?: boolean;
  message?: string | null;
  popupImageUrl?: string | null;
};

type Props = {
  vacation?: ShopVacationInfo | null;
  shopKey?: string;
};

/**
 * Full-screen vacation notice. Dismissible so visitors can still browse the site;
 * ordering / reservations stay blocked by the API and UI CTAs.
 */
export default function ShopVacationPopup({ vacation, shopKey }: Props) {
  const { t } = useI18n();
  const storageKey = `chaslay_vacation_dismissed:${shopKey || 'shop'}:${vacation?.popupImageUrl || ''}:${vacation?.message || ''}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!vacation?.active) {
      setOpen(false);
      return;
    }
    try {
      if (sessionStorage.getItem(storageKey) === '1') {
        setOpen(false);
        return;
      }
    } catch {
      /* ignore */
    }
    setOpen(true);
  }, [vacation?.active, storageKey]);

  if (!vacation?.active || !open) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('shopVacationTitle')}
    >
      <div className="relative w-full max-w-lg bg-white shadow-xl overflow-hidden">
        {vacation.popupImageUrl ? (
          <img
            src={vacation.popupImageUrl}
            alt=""
            className="w-full max-h-[70vh] object-contain bg-stone-100"
          />
        ) : null}
        <div className="p-5 space-y-3 text-center">
          <h2 className="text-xl font-bold tracking-tight text-stone-900">{t('shopVacationTitle')}</h2>
          <p className="text-sm text-stone-600">
            {vacation.message?.trim() || t('shopVacationDefaultMsg')}
          </p>
          <p className="text-xs text-stone-500">{t('shopVacationBrowseHint')}</p>
          <button
            type="button"
            onClick={dismiss}
            className="w-full bg-stone-900 text-white py-2.5 text-sm font-semibold"
          >
            {t('shopVacationContinue')}
          </button>
        </div>
      </div>
    </div>
  );
}
