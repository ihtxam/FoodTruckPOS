import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Render, type Data } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import { CalendarDays, ShoppingBag } from 'lucide-react';
import { cmsPuckConfig, emptyPuckData, withReservationsHomeCtas } from '@/lib/cms/puck-config';
import { CmsShopProvider } from '@/lib/cms/CmsShopContext';
import ShopVacationPopup from '@/components/shop/ShopVacationPopup';

function asPuckData(blocks: unknown): Data {
  if (blocks && typeof blocks === 'object' && !Array.isArray(blocks) && Array.isArray((blocks as Data).content)) {
    return blocks as Data;
  }
  return emptyPuckData() as Data;
}

function themeToCss(theme: Record<string, unknown> | null): string {
  if (!theme || typeof theme !== 'object') return '';
  const primary = String(theme.primaryColor || theme.primary || '');
  const bg = String(theme.backgroundColor || theme.background || '');
  const text = String(theme.textColor || theme.foreground || '');
  const accent = String(theme.accentColor || theme.accent || '');
  const font = String(theme.fontFamily || '');
  const parts = [
    primary ? `--cms-primary:${primary}` : '',
    bg ? `--cms-bg:${bg}` : '',
    text ? `--cms-text:${text}` : '',
    accent ? `--cms-accent:${accent}` : '',
    font ? `--cms-font:${font}` : '',
  ].filter(Boolean);
  if (!parts.length) return '';
  return `:root{${parts.join(';')}}.cms-puck-page{background:var(--cms-bg,#fff);color:var(--cms-text,#1c1917);font-family:var(--cms-font,inherit)}`;
}

export default function ShopHomePage() {
  const { t, locale, setLocale } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const base = shopBasePath(shopKey);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Data>(emptyPuckData() as Data);
  const [theme, setTheme] = useState<Record<string, unknown> | null>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [menu, setMenu] = useState<any[]>([]);
  const [seoTitle, setSeoTitle] = useState('');

  useEffect(() => {
    if (!shopKey) {
      setLoading(false);
      setError(t('shopNotFound'));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [pageRes, menuRes] = await Promise.all([
          axios.get(`/api/shop/${shopKey}/pages/home`),
          axios.get(`/api/shop/${shopKey}/menu`).catch(() => ({ data: { data: [] } })),
        ]);
        if (cancelled) return;
        const page = pageRes.data.data;
        setData(asPuckData(page.blocks));
        setTheme(page.theme || null);
        setMerchant(page.merchant);
        setSeoTitle(page.seoTitle || page.title || page.merchant?.name || '');
        setMenu(menuRes.data.data || []);
        const lang = page.merchant?.language;
        if (lang === 'en' || lang === 'fr' || lang === 'de') {
          try {
            const stored = localStorage.getItem('manupos_shop_lang');
            if (stored !== 'en' && stored !== 'fr' && stored !== 'de') setLocale(lang);
          } catch {
            setLocale(lang);
          }
        }
      } catch {
        if (!cancelled) setError(t('cmsHomeUnavailable'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, t, setLocale]);

  useEffect(() => {
    if (seoTitle) document.title = seoTitle;
  }, [seoTitle]);

  const themeCss = useMemo(() => themeToCss(theme), [theme]);
  const showReservationsNav = Boolean(merchant?.reservationsEnabled);
  const renderData = useMemo(
    () => withReservationsHomeCtas(data, showReservationsNav),
    [data, showReservationsNav],
  );
  const hasContent = Array.isArray(data.content) && data.content.length > 0;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-600">
        {t('loading')}
      </div>
    );
  }

  if (error || !merchant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-stone-50 px-4 text-center">
        <p className="text-stone-700 font-medium">{error || t('shopNotFound')}</p>
        <Link to={`${base}/menu`} className="underline text-sm">
          {t('cmsGoToMenu')}
        </Link>
      </div>
    );
  }

  return (
    <CmsShopProvider
      value={{
        shopKey,
        basePath: base,
        menu,
        storeHours: merchant.storeHours || {},
        merchantName: merchant.name,
        reservationsEnabled: showReservationsNav,
      }}
    >
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      <ShopVacationPopup vacation={merchant.vacation} shopKey={shopKey} />
      <div className="cms-puck-page min-h-screen bg-stone-50 text-stone-900">
        <header className="border-b border-stone-200 bg-white/90 backdrop-blur sticky top-0 z-20">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
            <Link
              to={base || '/'}
              className="flex items-center gap-2.5 min-w-0"
              aria-label={merchant.name}
            >
              {merchant.shopLogoUrl ? (
                <img src={merchant.shopLogoUrl} alt="" className="h-9 w-9 object-cover" />
              ) : (
                <div className="h-9 w-9 bg-stone-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {(merchant.name || 'M').slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="hidden sm:inline font-semibold tracking-tight truncate">{merchant.name}</span>
            </Link>
            <div className="flex items-center gap-1 shrink-0">
              <ShopLangSwitcher />
              {showReservationsNav ? (
                <Link
                  to={`${base}/reservations`}
                  className="inline-flex h-9 w-9 items-center justify-center text-stone-700 hover:bg-stone-100"
                  aria-label={t('shopReservations')}
                  title={t('shopReservations')}
                >
                  <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
                </Link>
              ) : null}
              <Link
                to={`${base}/menu`}
                className="inline-flex h-9 w-9 items-center justify-center text-stone-700 hover:bg-stone-100"
                aria-label={t('cmsOrderOnline')}
                title={t('cmsOrderOnline')}
              >
                <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </header>

        <main>
          {hasContent ? (
            <Render config={cmsPuckConfig} data={renderData} />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-20 text-center text-stone-500">
              {t('cmsEmptyBlocks')}
            </div>
          )}
        </main>

        <footer className="border-t border-stone-200 mt-12 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-8 text-sm text-stone-500 flex flex-wrap justify-between gap-3">
            <div>
              <p className="font-medium text-stone-900">{merchant.name}</p>
              {(merchant.address || merchant.city) && (
                <p className="mt-1">{[merchant.address, merchant.city].filter(Boolean).join(', ')}</p>
              )}
              {merchant.phone && <p className="mt-1">{merchant.phone}</p>}
            </div>
            <div className="flex flex-wrap gap-4 self-start">
              {showReservationsNav ? (
                <Link to={`${base}/reservations`} className="underline">
                  {t('shopReservations')}
                </Link>
              ) : null}
              <Link to={`${base}/menu`} className="underline">
                {t('cmsGoToMenu')}
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </CmsShopProvider>
  );
}
