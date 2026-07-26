import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { RenderChaiBlocks, getChaiThemeCssVariables } from '@chaibuilder/sdk/render';
import type { ChaiBlock } from '@chaibuilder/sdk';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import { ensureCmsChaiBlocks } from '@/lib/cms/chai-blocks';
import { CmsShopProvider } from '@/lib/cms/CmsShopContext';

ensureCmsChaiBlocks();

export default function ShopHomePage() {
  const { t } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const base = shopBasePath(shopKey);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<ChaiBlock[]>([]);
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
        const data = pageRes.data.data;
        setBlocks((data.blocks || []) as ChaiBlock[]);
        setTheme(data.theme || null);
        setMerchant(data.merchant);
        setSeoTitle(data.seoTitle || data.title || data.merchant?.name || '');
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

  const themeCss = useMemo(() => {
    if (!theme) return '';
    try {
      return getChaiThemeCssVariables(theme as any);
    } catch {
      return '';
    }
  }, [theme]);

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
      }}
    >
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border/80 bg-background/90 backdrop-blur sticky top-0 z-20">
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
                className="text-sm font-semibold border border-foreground px-3 py-1.5 hover:bg-foreground hover:text-background transition-colors"
              >
                {t('cmsOrderOnline')}
              </Link>
            </div>
          </div>
        </header>

        <main>
          {blocks.length ? (
            <RenderChaiBlocks blocks={blocks} lang="en" fallbackLang="en" />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-20 text-center text-muted-foreground">
              {t('cmsEmptyBlocks')}
            </div>
          )}
        </main>

        <footer className="border-t border-border mt-12">
          <div className="max-w-5xl mx-auto px-4 py-8 text-sm text-muted-foreground flex flex-wrap justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">{merchant.name}</p>
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
