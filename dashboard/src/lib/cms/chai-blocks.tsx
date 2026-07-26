import { Link } from 'react-router-dom';
import {
  registerChaiBlock,
  registerChaiBlockSchema,
  stylesProp,
  type ChaiBlockComponentProps,
  type ChaiStyles,
} from '@chaibuilder/sdk/runtime';
import { loadWebBlocks } from '@chaibuilder/sdk/web-blocks';
import { useCmsShop } from '@/lib/cms/CmsShopContext';

let registered = false;

type PosMenuProps = {
  styles: ChaiStyles;
  title: string;
  subtitle: string;
  mode: 'full' | 'featured';
  showPrices: boolean;
  limit: number;
  ctaLabel: string;
  ctaHref: string;
};

function PosMenuBlock(props: ChaiBlockComponentProps<PosMenuProps>) {
  const {
    blockProps,
    styles,
    title,
    subtitle,
    mode = 'full',
    showPrices = true,
    limit = 8,
    ctaLabel,
    ctaHref = '/menu',
    inBuilder,
  } = props;
  const shop = useCmsShop();
  const menu = shop?.menu || [];
  const base = shop?.basePath || '';

  const products = menu.flatMap((c) => c.items.map((item) => ({ ...item, categoryName: c.name })));
  const featured = products.slice(0, Number(limit) || 8);
  const href = ctaHref.startsWith('/') ? `${base}${ctaHref === '/' ? '' : ctaHref}` || '/' : ctaHref;

  return (
    <section {...blockProps} {...styles}>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          {title ? <h2 className="text-2xl font-semibold tracking-tight">{title}</h2> : null}
          {subtitle ? <p className="text-stone-600 mt-1">{subtitle}</p> : null}
        </div>
        {ctaLabel ? (
          inBuilder ? (
            <span className="text-sm font-semibold underline opacity-70">{ctaLabel}</span>
          ) : (
            <Link to={href || `${base}/menu`} className="text-sm font-semibold underline">
              {ctaLabel}
            </Link>
          )
        ) : null}
      </div>

      {inBuilder && !menu.length ? (
        <p className="text-sm text-stone-500 border border-dashed border-stone-300 p-6 text-center">
          POS menu preview — live catalog appears on the published site
        </p>
      ) : null}

      {mode === 'featured' ? (
        <ProductGrid items={featured} showPrices={showPrices !== false} />
      ) : (
        <div className="space-y-8">
          {menu.map((c) => (
            <div key={c.id}>
              <h3 className="text-lg font-semibold mb-3">{c.name}</h3>
              <ProductGrid items={c.items} showPrices={showPrices !== false} />
            </div>
          ))}
          {!menu.length && !inBuilder ? <p className="text-sm text-stone-500">Menu coming soon.</p> : null}
        </div>
      )}
    </section>
  );
}

function ProductGrid({
  items,
  showPrices,
}: {
  items: Array<{ id: string; name: string; price: number; description?: string; image?: string }>;
  showPrices: boolean;
}) {
  if (!items.length) return null;
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <li key={item.id} className="border border-stone-200 bg-white/80 overflow-hidden">
          {item.image ? <img src={item.image} alt="" className="h-36 w-full object-cover" /> : null}
          <div className="p-3">
            <div className="flex justify-between gap-2">
              <p className="font-medium text-sm">{item.name}</p>
              {showPrices ? (
                <p className="text-sm tabular-nums shrink-0">CHF {Number(item.price).toFixed(2)}</p>
              ) : null}
            </div>
            {item.description ? (
              <p className="text-xs text-stone-500 mt-1 line-clamp-2">{item.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

type ShopHoursProps = {
  styles: ChaiStyles;
  title: string;
  channel: string;
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function ShopHoursBlock(props: ChaiBlockComponentProps<ShopHoursProps>) {
  const { blockProps, styles, title, channel = 'display', inBuilder } = props;
  const shop = useCmsShop();
  const storeHours = shop?.storeHours || {};
  const chKey = channel === 'pickup' ? 'takeaway' : channel === 'delivery' ? 'delivery' : 'display';
  const ch = storeHours[chKey] || storeHours.display || storeHours.takeaway || {};
  const day = DAY_KEYS[new Date().getDay()];
  const slots = ch[day] || [];
  const label = slots.length ? slots.map((s) => `${s.open}–${s.close}`).join(', ') : 'Closed today';

  return (
    <section {...blockProps} {...styles}>
      <div className="border-y border-stone-300 py-8">
        <h2 className="text-xl font-semibold">{title || 'Hours'}</h2>
        <p className="mt-3 text-stone-600">{label}</p>
        {inBuilder ? <p className="text-xs text-stone-400 mt-2">Uses Online shop hours</p> : null}
      </div>
    </section>
  );
}

export function ensureCmsChaiBlocks() {
  if (registered) return;
  registered = true;
  loadWebBlocks();

  registerChaiBlock(PosMenuBlock, {
    type: 'PosMenu',
    label: 'POS Menu',
    category: 'custom',
    group: 'shop',
    description: 'Products from your POS / online shop catalog',
    ...registerChaiBlockSchema({
      properties: {
        styles: stylesProp(''),
        title: { type: 'string', title: 'Title', default: 'Our menu' },
        subtitle: { type: 'string', title: 'Subtitle', default: '' },
        mode: {
          type: 'string',
          title: 'Mode',
          default: 'full',
          enum: ['full', 'featured'],
        },
        showPrices: { type: 'boolean', title: 'Show prices', default: true },
        limit: { type: 'number', title: 'Featured limit', default: 8 },
        ctaLabel: { type: 'string', title: 'CTA label', default: 'Order online' },
        ctaHref: { type: 'string', title: 'CTA link', default: '/menu' },
      },
    }),
  });

  registerChaiBlock(ShopHoursBlock, {
    type: 'ShopHours',
    label: 'Shop hours',
    category: 'custom',
    group: 'shop',
    description: 'Opening hours from Online shop settings',
    ...registerChaiBlockSchema({
      properties: {
        styles: stylesProp(''),
        title: { type: 'string', title: 'Title', default: 'Opening hours' },
        channel: {
          type: 'string',
          title: 'Hours source',
          default: 'display',
          enum: ['display', 'pickup', 'delivery'],
        },
      },
    }),
  });
}
