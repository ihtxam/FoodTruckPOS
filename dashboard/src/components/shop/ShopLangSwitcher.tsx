import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useI18n, type Locale } from '@/lib/i18n';

const LOCALES: Locale[] = ['en', 'fr', 'de'];

export default function ShopLangSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-0.5 border border-stone-200 bg-white px-2 text-xs font-semibold uppercase tracking-wide text-stone-800 hover:border-stone-400"
        aria-label={t('shopLanguage')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {locale}
        <ChevronDown className={`h-3.5 w-3.5 text-stone-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-40 mt-1 min-w-full overflow-hidden border border-stone-200 bg-white shadow-sm"
        >
          {LOCALES.map((code) => (
            <li key={code} role="option" aria-selected={locale === code}>
              <button
                type="button"
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide ${
                  locale === code
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                {code}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
