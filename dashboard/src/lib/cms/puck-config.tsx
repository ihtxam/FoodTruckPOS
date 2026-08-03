import type { Config, Data } from '@puckeditor/core';
import { Link } from 'react-router-dom';
import { useCmsShop } from '@/lib/cms/CmsShopContext';
import { useI18n } from '@/lib/i18n';

function resolveHref(href: string | undefined, base: string) {
  if (!href) return base || '/';
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
    return href;
  }
  if (href === '/menu' || href.startsWith('/menu')) {
    return `${base}/menu${href.slice(5)}` || `${base}/menu`;
  }
  if (href === '/reservations' || href.startsWith('/reservations')) {
    return `${base}/reservations${href.slice('/reservations'.length)}` || `${base}/reservations`;
  }
  if (href.startsWith('/')) return `${base}${href === '/' ? '' : href}` || '/';
  return href;
}

function isReservationsPath(href: string | undefined) {
  if (!href) return true;
  return href === '/reservations' || href.startsWith('/reservations');
}

/** Map common English CMS defaults to shop i18n keys so the lang switch updates them. */
function localizeCmsText(raw: string | undefined, t: (k: string) => string): string {
  if (!raw) return '';
  const map: Record<string, string> = {
    'Order now': 'shopOrderNow',
    'See the menu': 'cmsOrderOnline',
    'Order online': 'cmsOrderOnline',
    'Start order': 'shopOrderNow',
    'Full menu & checkout': 'cmsGoToMenu',
    Reservations: 'shopReservations',
    'Book a table': 'shopBookTable',
    'Reserve a table': 'shopReserveTable',
    'Opening hours': 'shopHours',
    "When we're open": 'shopHours',
    Hours: 'shopHours',
    Hungry: 'shopHungry',
    'Hungry?': 'shopHungry',
    'Order ahead': 'shopOrderNow',
    'Ready to order?': 'shopReadyToOrder',
  };
  const key = map[raw.trim()];
  return key ? t(key) : raw;
}

/** Ensure a mid-page reservations band exists when online booking is enabled. */
export function withReservationsHomeCtas(data: Data, reservationsEnabled: boolean): Data {
  if (!reservationsEnabled || !Array.isArray(data.content)) return data;
  const content = [...data.content];
  if (!content.some((b) => b.type === 'ReservationsCta')) {
    const posIdx = content.findIndex((b) => b.type === 'PosMenu');
    const insertAt = posIdx >= 0 ? posIdx + 1 : Math.min(2, content.length);
    content.splice(insertAt, 0, {
      type: 'ReservationsCta',
      props: {
        id: 'auto-reservations-cta',
        title: '',
        subtitle: '',
        ctaLabel: '',
        ctaHref: '/reservations',
      },
    });
  }
  return { ...data, content };
}

function ProductGrid({
  items,
  showPrices,
}: {
  items: Array<{ id: string; name: string; price: number; description?: string; image?: string }>;
  showPrices: boolean;
}) {
  if (!items.length) return <p className="text-sm text-stone-500">-</p>;
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

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function HeroBlock({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
  imageUrl,
  align,
}: CmsPuckProps['Hero']) {
  const shop = useCmsShop();
  const { t } = useI18n();
  const base = shop?.basePath || '';
  const bg = imageUrl || '';
  const secondaryHref = secondaryCtaHref || '/reservations';
  const secondaryLabel = (() => {
    if (secondaryCtaLabel) {
      if (isReservationsPath(secondaryHref) && !shop?.reservationsEnabled) return '';
      return localizeCmsText(secondaryCtaLabel, t);
    }
    return shop?.reservationsEnabled ? t('shopReservations') : '';
  })();
  const primaryLabel = localizeCmsText(ctaLabel, t);
  return (
    <section
      className="relative min-h-[48vh] flex items-end md:items-center"
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
          align === 'left' ? 'text-left' : 'text-center'
        }`}
      >
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p
            className={`mt-4 text-base md:text-lg text-stone-100/90 max-w-2xl ${
              align === 'left' ? '' : 'mx-auto'
            }`}
          >
            {subtitle}
          </p>
        ) : null}
        {(primaryLabel || secondaryLabel) && (
          <div
            className={`mt-8 flex flex-wrap gap-3 ${
              align === 'left' ? '' : 'justify-center'
            }`}
          >
            {primaryLabel ? (
              <Link
                to={resolveHref(ctaHref, base)}
                className="inline-block bg-white text-stone-900 font-semibold px-6 py-3 text-sm"
              >
                {primaryLabel}
              </Link>
            ) : null}
            {secondaryLabel ? (
              <Link
                to={resolveHref(secondaryHref, base)}
                className="inline-block border border-white/80 text-white font-semibold px-6 py-3 text-sm"
              >
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function PosMenuBlock(props: CmsPuckProps['PosMenu']) {
  const { title, subtitle, mode, showPrices, limit, ctaLabel, ctaHref } = props;
  const shop = useCmsShop();
  const { t } = useI18n();
  const menu = shop?.menu || [];
  const base = shop?.basePath || '';
  const products = menu.flatMap((c) => c.items.map((item) => ({ ...item, categoryName: c.name })));
  const featured = products.slice(0, Number(limit) || 8);
  const href = resolveHref(ctaHref, base);
  const linkLabel = localizeCmsText(ctaLabel, t);
  return (
    <section className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          {title ? <h2 className="text-2xl font-semibold tracking-tight">{title}</h2> : null}
          {subtitle ? <p className="text-stone-600 mt-1">{subtitle}</p> : null}
        </div>
        {linkLabel ? (
          <Link to={href} className="text-sm font-semibold underline">
            {linkLabel}
          </Link>
        ) : null}
      </div>
      {!menu.length ? (
        <p className="text-sm text-stone-500 border border-dashed border-stone-300 p-6 text-center">
          POS menu - live catalog appears on the published site
        </p>
      ) : mode === 'featured' ? (
        <ProductGrid items={featured} showPrices={showPrices !== false} />
      ) : (
        <div className="space-y-8">
          {menu.map((c) => (
            <div key={c.id}>
              <h3 className="text-lg font-semibold mb-3">{c.name}</h3>
              <ProductGrid items={c.items} showPrices={showPrices !== false} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ShopHoursBlock({ title, channel }: CmsPuckProps['ShopHours']) {
  const shop = useCmsShop();
  const { t } = useI18n();
  const storeHours = shop?.storeHours || {};
  const chKey = channel === 'pickup' ? 'takeaway' : channel === 'delivery' ? 'delivery' : 'display';
  const ch = storeHours[chKey] || storeHours.display || storeHours.takeaway || {};
  const day = DAY_KEYS[new Date().getDay()];
  const slots = ch[day] || [];
  const label = slots.length
    ? slots.map((s) => `${s.open}-${s.close}`).join(', ')
    : t('shopClosedToday');
  return (
    <section className="max-w-5xl mx-auto px-4 py-10">
      <div className="border-y border-stone-300 py-8 text-center">
        <h2 className="text-xl font-semibold">{localizeCmsText(title, t) || t('shopHours')}</h2>
        <p className="mt-3 text-stone-600">{label}</p>
      </div>
    </section>
  );
}

function CtaBlock(props: CmsPuckProps['Cta']) {
  const { title, subtitle, primaryLabel, primaryHref, secondaryLabel, secondaryHref } = props;
  const shop = useCmsShop();
  const { t } = useI18n();
  const base = shop?.basePath || '';
  const secondHref = secondaryHref || '/reservations';
  const secondLabel = (() => {
    if (secondaryLabel) {
      if (isReservationsPath(secondHref) && !shop?.reservationsEnabled) return '';
      return localizeCmsText(secondaryLabel, t);
    }
    return shop?.reservationsEnabled ? t('shopBookTable') : '';
  })();
  return (
    <section className="bg-stone-900 text-white">
      <div className="max-w-5xl mx-auto px-4 py-14 text-center">
        <h2 className="text-2xl md:text-3xl font-semibold">
          {localizeCmsText(title, t) || title}
        </h2>
        {subtitle ? <p className="mt-3 text-stone-300">{subtitle}</p> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {primaryLabel ? (
            <Link
              to={resolveHref(primaryHref, base)}
              className="bg-white text-stone-900 font-semibold px-5 py-2.5 text-sm"
            >
              {localizeCmsText(primaryLabel, t)}
            </Link>
          ) : null}
          {secondLabel ? (
            <Link
              to={resolveHref(secondHref, base)}
              className="border border-white/70 px-5 py-2.5 text-sm"
            >
              {secondLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ReservationsCtaBlock(props: CmsPuckProps['ReservationsCta']) {
  const shop = useCmsShop();
  const { t } = useI18n();
  if (!shop?.reservationsEnabled) return null;
  const base = shop.basePath || '';
  const title = localizeCmsText(props.title, t) || t('shopReserveTable');
  const subtitle =
    props.subtitle || t('shopReservationsIntro');
  const label = localizeCmsText(props.ctaLabel, t) || t('shopBookTable');
  const href = resolveHref(props.ctaHref || '/reservations', base);
  return (
    <section className="border-y border-stone-200 bg-stone-100/80">
      <div className="max-w-3xl mx-auto px-4 py-14 text-center">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-3 text-stone-600">{subtitle}</p> : null}
        <Link
          to={href}
          className="mt-6 inline-block bg-stone-900 text-white font-semibold px-6 py-3 text-sm"
        >
          {label}
        </Link>
      </div>
    </section>
  );
}

function ImageBlockComp({ imageUrl, alt, caption, href }: CmsPuckProps['ImageBlock']) {
  const shop = useCmsShop();
  if (!imageUrl) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-sm text-stone-500 text-center border border-dashed">
        Image
      </div>
    );
  }
  const img = <img src={imageUrl} alt={alt || ''} className="w-full max-h-[480px] object-cover" />;
  return (
    <section className="max-w-5xl mx-auto px-4 py-8">
      {href ? <Link to={resolveHref(href, shop?.basePath || '')}>{img}</Link> : img}
      {caption ? <p className="text-sm text-stone-500 mt-2 text-center">{caption}</p> : null}
    </section>
  );
}

export type CmsPuckProps = {
  Hero: {
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
    imageUrl: string;
    align: 'left' | 'center';
  };
  Heading: { text: string; level: 'h1' | 'h2' | 'h3' };
  Text: { text: string };
  Html: { html: string };
  PosMenu: {
    title: string;
    subtitle: string;
    mode: 'full' | 'featured';
    showPrices: boolean;
    limit: number;
    ctaLabel: string;
    ctaHref: string;
  };
  ShopHours: { title: string; channel: 'display' | 'pickup' | 'delivery' };
  Cta: {
    title: string;
    subtitle: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
  };
  ReservationsCta: {
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaHref: string;
  };
  ImageBlock: { imageUrl: string; alt: string; caption: string; href: string };
  Spacer: { size: 'sm' | 'md' | 'lg' };
};

export const cmsPuckConfig: Config<{
  components: CmsPuckProps;
  root: { title?: string };
}> = {
  root: {
    fields: {
      title: { type: 'text', label: 'Page title' },
    },
    defaultProps: {
      title: '',
    },
    render: ({ children }) => <div className="cms-puck-root min-h-full">{children}</div>,
  },
  categories: {
    layout: { title: 'Layout', components: ['Hero', 'Cta', 'ReservationsCta', 'Spacer', 'ImageBlock'] },
    content: { title: 'Content', components: ['Heading', 'Text', 'Html'] },
    shop: { title: 'Shop', components: ['PosMenu', 'ShopHours'] },
  },
  components: {
    Hero: {
      label: 'Hero',
      fields: {
        title: { type: 'text', label: 'Title' },
        subtitle: { type: 'textarea', label: 'Subtitle' },
        ctaLabel: { type: 'text', label: 'Button label' },
        ctaHref: { type: 'text', label: 'Button link' },
        secondaryCtaLabel: { type: 'text', label: '2nd button label' },
        secondaryCtaHref: { type: 'text', label: '2nd button link' },
        imageUrl: { type: 'text', label: 'Background image URL' },
        align: {
          type: 'radio',
          label: 'Align',
          options: [
            { label: 'Center', value: 'center' },
            { label: 'Left', value: 'left' },
          ],
        },
      },
      defaultProps: {
        title: 'Your shop',
        subtitle: 'A short welcome line',
        ctaLabel: 'Order now',
        ctaHref: '/menu',
        secondaryCtaLabel: 'Reservations',
        secondaryCtaHref: '/reservations',
        imageUrl: '',
        align: 'center',
      },
      render: (props) => <HeroBlock {...props} />,
    },
    Heading: {
      label: 'Heading',
      fields: {
        text: { type: 'text', label: 'Text' },
        level: {
          type: 'select',
          label: 'Level',
          options: [
            { label: 'H1', value: 'h1' },
            { label: 'H2', value: 'h2' },
            { label: 'H3', value: 'h3' },
          ],
        },
      },
      defaultProps: { text: 'Heading', level: 'h2' },
      render: ({ text, level }) => {
        const className =
          level === 'h1'
            ? 'text-4xl font-semibold tracking-tight'
            : level === 'h3'
              ? 'text-xl font-semibold'
              : 'text-2xl font-semibold tracking-tight';
        if (level === 'h1') return <h1 className={`max-w-5xl mx-auto px-4 py-4 ${className}`}>{text}</h1>;
        if (level === 'h3') return <h3 className={`max-w-5xl mx-auto px-4 py-3 ${className}`}>{text}</h3>;
        return <h2 className={`max-w-5xl mx-auto px-4 py-4 ${className}`}>{text}</h2>;
      },
    },
    Text: {
      label: 'Text',
      fields: {
        text: { type: 'textarea', label: 'Text' },
      },
      defaultProps: { text: 'Tell your story…' },
      render: ({ text }) => (
        <p className="max-w-3xl mx-auto px-4 py-4 text-stone-700 leading-relaxed whitespace-pre-wrap">{text}</p>
      ),
    },
    Html: {
      label: 'HTML block',
      fields: {
        html: { type: 'textarea', label: 'HTML' },
      },
      defaultProps: {
        html: '<div style="padding:1rem;text-align:center">Custom HTML block</div>',
      },
      render: ({ html }) => (
        <section
          className="max-w-3xl mx-auto px-4 py-6 prose prose-stone"
          dangerouslySetInnerHTML={{ __html: html || '' }}
        />
      ),
    },
    PosMenu: {
      label: 'POS menu',
      fields: {
        title: { type: 'text', label: 'Title' },
        subtitle: { type: 'text', label: 'Subtitle' },
        mode: {
          type: 'radio',
          label: 'Mode',
          options: [
            { label: 'Full menu', value: 'full' },
            { label: 'Featured', value: 'featured' },
          ],
        },
        showPrices: {
          type: 'radio',
          label: 'Show prices',
          options: [
            { label: 'Yes', value: true },
            { label: 'No', value: false },
          ],
        },
        limit: { type: 'number', label: 'Featured limit', min: 1 },
        ctaLabel: { type: 'text', label: 'CTA label' },
        ctaHref: { type: 'text', label: 'CTA link' },
      },
      defaultProps: {
        title: 'Our menu',
        subtitle: '',
        mode: 'full',
        showPrices: true,
        limit: 8,
        ctaLabel: 'Order online',
        ctaHref: '/menu',
      },
      render: (props) => <PosMenuBlock {...props} />,
    },
    ShopHours: {
      label: 'Shop hours',
      fields: {
        title: { type: 'text', label: 'Title' },
        channel: {
          type: 'select',
          label: 'Hours source',
          options: [
            { label: 'Homepage / display', value: 'display' },
            { label: 'Pickup', value: 'pickup' },
            { label: 'Delivery', value: 'delivery' },
          ],
        },
      },
      defaultProps: { title: 'Opening hours', channel: 'display' },
      render: (props) => <ShopHoursBlock {...props} />,
    },
    Cta: {
      label: 'Call to action',
      fields: {
        title: { type: 'text', label: 'Title' },
        subtitle: { type: 'text', label: 'Subtitle' },
        primaryLabel: { type: 'text', label: 'Primary button' },
        primaryHref: { type: 'text', label: 'Primary link' },
        secondaryLabel: { type: 'text', label: 'Secondary button' },
        secondaryHref: { type: 'text', label: 'Secondary link' },
      },
      defaultProps: {
        title: 'Ready to order?',
        subtitle: '',
        primaryLabel: 'Order now',
        primaryHref: '/menu',
        secondaryLabel: 'Book a table',
        secondaryHref: '/reservations',
      },
      render: (props) => <CtaBlock {...props} />,
    },
    ReservationsCta: {
      label: 'Reservations CTA',
      fields: {
        title: { type: 'text', label: 'Title' },
        subtitle: { type: 'textarea', label: 'Subtitle' },
        ctaLabel: { type: 'text', label: 'Button label' },
        ctaHref: { type: 'text', label: 'Button link' },
      },
      defaultProps: {
        title: 'Reserve a table',
        subtitle: 'Book online and we will have everything ready when you arrive.',
        ctaLabel: 'Book a table',
        ctaHref: '/reservations',
      },
      render: (props) => <ReservationsCtaBlock {...props} />,
    },
    ImageBlock: {
      label: 'Image',
      fields: {
        imageUrl: { type: 'text', label: 'Image URL' },
        alt: { type: 'text', label: 'Alt text' },
        caption: { type: 'text', label: 'Caption' },
        href: { type: 'text', label: 'Link (optional)' },
      },
      defaultProps: { imageUrl: '', alt: '', caption: '', href: '' },
      render: (props) => <ImageBlockComp {...props} />,
    },
    Spacer: {
      label: 'Spacer',
      fields: {
        size: {
          type: 'radio',
          label: 'Size',
          options: [
            { label: 'S', value: 'sm' },
            { label: 'M', value: 'md' },
            { label: 'L', value: 'lg' },
          ],
        },
      },
      defaultProps: { size: 'md' },
      render: ({ size }) => {
        const h = size === 'sm' ? 'h-6' : size === 'lg' ? 'h-20' : 'h-12';
        return <div className={h} aria-hidden />;
      },
    },
  },
};

export function emptyPuckData(title = ''): Data {
  return {
    root: { props: { title } },
    content: [],
  };
}
