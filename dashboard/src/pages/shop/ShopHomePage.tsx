import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';

type CmsBlock = {
  id: string;
  type: string;
  [key: string]: any;
};

type MenuCategory = {
  id: string;
  name: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    description?: string;
    image?: string;
  }>;
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function todayKey() {
  return DAY_KEYS[new Date().getDay()];
}

function formatHours(
  storeHours: Record<string, Record<string, Array<{ open: string; close: string }>>> | undefined,
  channel: string
) {
  const ch =
    storeHours?.[channel] ||
    storeHours?.display ||
    storeHours?.takeaway ||
    {};
  const day = todayKey();
  const slots = ch[day] || [];
  if (!slots.length) return 'Closed today';
  return slots.map((s) => `${s.open}–${s.close}`).join(', ');
}

function resolveHref(href: string | undefined, base: string) {
  if (!href) return base || '/';
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) return href;
  if (href === '/menu' || href.startsWith('/menu')) return `${base}/menu${href.slice(5)}` || `${base}/menu`;
  if (href.startsWith('/')) return `${base}${href === '/' ? '' : href}` || '/';
  return href;
}

export default function ShopHomePage() {
  const { t } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const base = shopBasePath(shopKey);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<CmsBlock[]>([]);
  const [merchant, setMerchant] = useState<any>(null);
  const [menu, setMenu] = useState<MenuCategory[]>([]);
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
        setBlocks(data.blocks || []);
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

  const flatProducts = menu.flatMap((c) => c.items.map((item) => ({ ...item, categoryName: c.name })));

  return (
    <div className="min-h-screen bg-[#f7f4ef] text-stone-900">
      <header className="border-b border-stone-200/80 bg-[#f7f4ef]/90 backdrop-blur sticky top-0 z-20">
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
        {blocks.map((block) => (
          <BlockView
            key={block.id}
            block={block}
            base={base}
            merchant={merchant}
            menu={menu}
            products={flatProducts}
            t={t}
          />
        ))}
      </main>

      <footer className="border-t border-stone-200 mt-12">
        <div className="max-w-5xl mx-auto px-4 py-8 text-sm text-stone-600 flex flex-wrap justify-between gap-3">
          <div>
            <p className="font-medium text-stone-900">{merchant.name}</p>
            {(merchant.address || merchant.city) && (
              <p className="mt-1">
                {[merchant.address, merchant.city].filter(Boolean).join(', ')}
              </p>
            )}
            {merchant.phone && <p className="mt-1">{merchant.phone}</p>}
          </div>
          <Link to={`${base}/menu`} className="underline self-start">
            {t('cmsGoToMenu')}
          </Link>
        </div>
      </footer>
    </div>
  );
}

function BlockView({
  block,
  base,
  merchant,
  menu,
  products,
  t,
}: {
  block: CmsBlock;
  base: string;
  merchant: any;
  menu: MenuCategory[];
  products: Array<{ id: string; name: string; price: number; description?: string; image?: string; categoryName?: string }>;
  t: (k: string) => string;
}) {
  if (block.type === 'hero') {
    const bg = block.imageUrl || merchant.shopBannerUrl;
    return (
      <section
        className="relative min-h-[52vh] flex items-end md:items-center"
        style={
          bg
            ? {
                backgroundImage: `linear-gradient(to top, rgba(28,25,23,0.72), rgba(28,25,23,0.35)), url(${bg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : {
                background: 'linear-gradient(145deg, #1c1917 0%, #44403c 55%, #78716c 100%)',
              }
        }
      >
        <div
          className={`max-w-5xl mx-auto w-full px-4 py-16 md:py-24 text-white ${
            block.align === 'left' ? 'text-left' : 'text-center'
          }`}
        >
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight drop-shadow-sm">{block.title}</h1>
          {block.subtitle && (
            <p className="mt-4 text-base md:text-lg text-stone-100/90 max-w-2xl mx-auto">{block.subtitle}</p>
          )}
          {block.ctaLabel && (
            <div className={`mt-8 ${block.align === 'left' ? '' : 'flex justify-center'}`}>
              <Link
                to={resolveHref(block.ctaHref, base)}
                className="inline-block bg-white text-stone-900 font-semibold px-6 py-3 text-sm hover:bg-stone-100 transition-colors"
              >
                {block.ctaLabel}
              </Link>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (block.type === 'richtext' || block.type === 'html') {
    return (
      <section className="max-w-3xl mx-auto px-4 py-10">
        <div
          className="prose prose-stone max-w-none cms-html-block"
          dangerouslySetInnerHTML={{ __html: block.html || '' }}
        />
      </section>
    );
  }

  if (block.type === 'menu') {
    let items = products;
    if (block.mode === 'featured') {
      const limit = Number(block.limit) || 6;
      if (Array.isArray(block.productIds) && block.productIds.length) {
        const set = new Set(block.productIds);
        items = products.filter((p) => set.has(p.id)).slice(0, limit);
      } else {
        items = products.slice(0, limit);
      }
    } else if (Array.isArray(block.categoryIds) && block.categoryIds.length) {
      const set = new Set(block.categoryIds);
      const cats = menu.filter((c) => set.has(c.id));
      return (
        <section className="max-w-5xl mx-auto px-4 py-12">
          <MenuHeader block={block} base={base} t={t} />
          <div className="space-y-8 mt-8">
            {cats.map((c) => (
              <div key={c.id}>
                <h3 className="text-lg font-semibold mb-3">{c.name}</h3>
                <ProductGrid items={c.items} showPrices={block.showPrices !== false} />
              </div>
            ))}
          </div>
        </section>
      );
    }

    return (
      <section className="max-w-5xl mx-auto px-4 py-12">
        <MenuHeader block={block} base={base} t={t} />
        {block.mode === 'full' && !(block.categoryIds?.length) ? (
          <div className="space-y-8 mt-8">
            {menu.map((c) => (
              <div key={c.id}>
                <h3 className="text-lg font-semibold mb-3">{c.name}</h3>
                <ProductGrid items={c.items} showPrices={block.showPrices !== false} />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <ProductGrid items={items} showPrices={block.showPrices !== false} />
          </div>
        )}
      </section>
    );
  }

  if (block.type === 'hours') {
    const channel =
      block.channel === 'pickup' ? 'takeaway' : block.channel === 'delivery' ? 'delivery' : 'display';
    return (
      <section className="max-w-5xl mx-auto px-4 py-10">
        <div className="border-y border-stone-300 py-8 text-center">
          <h2 className="text-xl font-semibold">{block.title || t('storeHours')}</h2>
          <p className="mt-3 text-stone-600">{formatHours(merchant.storeHours, channel)}</p>
        </div>
      </section>
    );
  }

  if (block.type === 'cta') {
    return (
      <section className="bg-stone-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-14 text-center">
          <h2 className="text-2xl md:text-3xl font-semibold">{block.title}</h2>
          {block.subtitle && <p className="mt-3 text-stone-300">{block.subtitle}</p>}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {block.primaryLabel && (
              <Link
                to={resolveHref(block.primaryHref, base)}
                className="bg-white text-stone-900 font-semibold px-5 py-2.5 text-sm"
              >
                {block.primaryLabel}
              </Link>
            )}
            {block.secondaryLabel && (
              <Link
                to={resolveHref(block.secondaryHref, base)}
                className="border border-white/70 px-5 py-2.5 text-sm"
              >
                {block.secondaryLabel}
              </Link>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === 'image' && block.imageUrl) {
    const img = (
      <img src={block.imageUrl} alt={block.alt || ''} className="w-full max-h-[480px] object-cover" />
    );
    return (
      <section className="max-w-5xl mx-auto px-4 py-8">
        {block.href ? <Link to={resolveHref(block.href, base)}>{img}</Link> : img}
        {block.caption && <p className="text-sm text-stone-500 mt-2 text-center">{block.caption}</p>}
      </section>
    );
  }

  if (block.type === 'spacer') {
    const h = block.size === 'sm' ? 'h-6' : block.size === 'lg' ? 'h-20' : 'h-12';
    return <div className={h} aria-hidden />;
  }

  return null;
}

function MenuHeader({
  block,
  base,
  t,
}: {
  block: CmsBlock;
  base: string;
  t: (k: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {block.title && <h2 className="text-2xl font-semibold tracking-tight">{block.title}</h2>}
        {block.subtitle && <p className="text-stone-600 mt-1">{block.subtitle}</p>}
      </div>
      {block.ctaLabel && (
        <Link to={resolveHref(block.ctaHref, base)} className="text-sm font-semibold underline">
          {block.ctaLabel || t('cmsGoToMenu')}
        </Link>
      )}
    </div>
  );
}

function ProductGrid({
  items,
  showPrices,
}: {
  items: Array<{ id: string; name: string; price: number; description?: string; image?: string }>;
  showPrices: boolean;
}) {
  if (!items.length) return <p className="text-sm text-stone-500">—</p>;
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <li key={item.id} className="border border-stone-200 bg-white/70 overflow-hidden">
          {item.image && <img src={item.image} alt="" className="h-36 w-full object-cover" />}
          <div className="p-3">
            <div className="flex justify-between gap-2">
              <p className="font-medium text-sm">{item.name}</p>
              {showPrices && (
                <p className="text-sm tabular-nums shrink-0">CHF {Number(item.price).toFixed(2)}</p>
              )}
            </div>
            {item.description && (
              <p className="text-xs text-stone-500 mt-1 line-clamp-2">{item.description}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
