import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { Render, type Data } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import { cmsPuckConfig, emptyPuckData } from '@/lib/cms/puck-config';
import { CmsShopProvider } from '@/lib/cms/CmsShopContext';

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
  const { t } = useI18n();
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
      } catch {
        if (!cancelled) setError(t('cmsHomeUnavailable'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, t]);

  useEffect(() => {
    if (seoTitle) document.title = seoTitle;
  }, [seoTitle]);

  const themeCss = useMemo(() => themeToCss(theme), [theme]);

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

  const hasContent = Array.isArray(data.content) && data.content.length > 0;

  return (
    <CmsShopProvider
      value={{
        shopKey,
        basePath: base,
        menu,
        storeHours: merchant.storeHours || {},
        merchantName: merchant.name,
      }}
    >
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      <div className="cms-puck-page min-h-screen bg-stone-50 text-stone-900">
        <header className="border-b border-stone-200 bg-white/90 backdrop-blur sticky top-0 z-20">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {merchant.shopLogoUrl ? (
                <img src={merchant.shopLogoUrl} alt="" className="h-9 w-9 object-cover rounded-full" />
              ) : null}
              <span className="font-semibold tracking-tight truncate">{merchant.name}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <ShopLangSwitcher />
              <Link
                to={`${base}/menu`}
                className="text-sm font-semibold border border-stone-900 px-3 py-1.5 hover:bg-stone-900 hover:text-white transition-colors"
              >
                {t('cmsOrderOnline')}
              </Link>
            </div>
          </div>
        </header>

        <main>
          {hasContent ? (
            <Render config={cmsPuckConfig} data={data} />
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
            <Link to={`${base}/menu`} className="underline self-start">
              {t('cmsGoToMenu')}
            </Link>
          </div>
        </footer>
      </div>
    </CmsShopProvider>
  );
}
