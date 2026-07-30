import { useEffect } from 'react';
import axios from 'axios';
import { isLocale, shopLangStorageKey, useI18n } from '@/lib/i18n';

/** Apply merchant default shop language when the visitor has no saved preference for this shop. */
export default function ShopLocaleSync({ shopKey }: { shopKey: string }) {
  const { setLocale } = useI18n();

  useEffect(() => {
    if (!shopKey) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/shop/${shopKey}`);
        const lang = res.data?.data?.language;
        if (!isLocale(lang) || cancelled) return;
        const storageKey = shopLangStorageKey(shopKey);
        try {
          const stored = localStorage.getItem(storageKey);
          if (!isLocale(stored)) setLocale(lang);
        } catch {
          setLocale(lang);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, setLocale]);

  return null;
}
