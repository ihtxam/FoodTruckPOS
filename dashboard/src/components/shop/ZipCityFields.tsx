import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useI18n } from '@/lib/i18n';

type Suggestion = { zip: string; city: string; cities: string[] };

export default function ZipCityFields({
  shopKey,
  zipCode,
  city,
  onZipChange,
  onCityChange,
  zipClassName = 'border border-stone-300 px-3 py-2.5 text-sm w-full',
  cityClassName = 'border border-stone-300 px-3 py-2.5 text-sm w-full',
}: {
  shopKey: string;
  zipCode: string;
  city: string;
  onZipChange: (zip: string) => void;
  onCityChange: (city: string) => void;
  zipClassName?: string;
  cityClassName?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, []);

  useEffect(() => {
    if (!shopKey) return;
    const digits = zipCode.replace(/\D/g, '').slice(0, 4);
    if (digits.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    const id = ++reqId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/shop/${shopKey}/postal-suggest`, {
          params: { q: digits },
        });
        if (reqId.current !== id) return;
        const list: Suggestion[] = res.data.suggestions || [];
        setItems(list);
        setOpen(list.length > 0);
        if (digits.length === 4 && res.data.city && !city.trim()) {
          onCityChange(String(res.data.city));
        }
      } catch {
        if (reqId.current === id) {
          setItems([]);
          setOpen(false);
        }
      } finally {
        if (reqId.current === id) setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
    // city intentionally omitted — autofill only when empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopKey, zipCode]);

  const pick = (s: Suggestion) => {
    onZipChange(s.zip);
    onCityChange(s.city || s.cities[0] || '');
    setOpen(false);
  };

  return (
    <div className="grid grid-cols-2 gap-3" ref={rootRef}>
      <div className="relative">
        <label className="sr-only">{t('shopZip')}</label>
        <input
          className={zipClassName}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder={t('shopZip')}
          value={zipCode}
          onChange={(e) => onZipChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onFocus={() => items.length > 0 && setOpen(true)}
        />
        {open && items.length > 0 ? (
          <ul
            className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-auto border border-stone-200 bg-white shadow-sm"
            role="listbox"
          >
            {items.map((s) => (
              <li key={s.zip}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full items-baseline gap-2 px-3 py-2.5 text-left text-sm hover:bg-stone-50"
                  onClick={() => pick(s)}
                >
                  <span className="font-semibold tabular-nums">{s.zip}</span>
                  <span className="text-stone-600 truncate">{s.city}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {loading ? (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-stone-400">
            …
          </span>
        ) : null}
      </div>
      <div>
        <label className="sr-only">{t('shopCity')}</label>
        <input
          className={cityClassName}
          autoComplete="address-level2"
          placeholder={t('shopCity')}
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
        />
      </div>
    </div>
  );
}
