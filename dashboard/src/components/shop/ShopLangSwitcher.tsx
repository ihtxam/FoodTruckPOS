import { useI18n, type Locale } from '@/lib/i18n';

const LOCALES: Locale[] = ['en', 'fr', 'de'];

export default function ShopLangSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-md border border-stone-200 bg-white p-0.5 text-xs font-semibold ${className}`}
      role="group"
      aria-label={t('shopLanguage')}
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={`min-h-8 min-w-9 px-2 uppercase tracking-wide ${
            locale === code
              ? 'bg-stone-900 text-white'
              : 'text-stone-600 hover:bg-stone-50'
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
