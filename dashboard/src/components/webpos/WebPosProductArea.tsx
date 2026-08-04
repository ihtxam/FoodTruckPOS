import { Banknote, CreditCard, Gift, MonitorSmartphone } from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { categoryColor, categoryColorMap } from './categoryColors';
import type { Category, PosPaymentMethod, Product } from './types';

type Props = {
  categories: Category[];
  products: Product[];
  categoryId: string | 'all';
  onCategoryChange: (id: string | 'all') => void;
  onProductClick: (product: Product) => void;
  cartQtyByProduct: Map<string, number>;
  productHasCombo: (p: Product) => boolean;
  productHasMods: (p: Product) => boolean;
  expressCheckout?: boolean;
  expressMethods?: { cash: boolean; card: boolean; terminal: boolean };
  onExpressPay?: (method: PosPaymentMethod) => void;
  expressDisabled?: boolean;
  giftCardsEnabled?: boolean;
  onGiftCards?: () => void;
};

export default function WebPosProductArea({
  categories,
  products,
  categoryId,
  onCategoryChange,
  onProductClick,
  cartQtyByProduct,
  productHasCombo,
  productHasMods,
  expressCheckout = false,
  expressMethods,
  onExpressPay,
  expressDisabled,
  giftCardsEnabled = false,
  onGiftCards,
}: Props) {
  const { t } = useI18n();
  const colorByCat = useMemo(() => categoryColorMap(categories), [categories]);

  const visibleProducts = useMemo(() => {
    return products.filter((p) => categoryId === 'all' || p.categoryId === categoryId);
  }, [products, categoryId]);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-stone-100">
      {/* Category chips — fixed sizes, wrap to a second row when needed */}
      <div className="shrink-0 border-b border-stone-200/80 bg-stone-100/90 px-3 py-2">
        <div className="webpos-cat-scroll flex flex-wrap gap-1.5">
          {giftCardsEnabled && onGiftCards ? (
            <button
              type="button"
              onClick={onGiftCards}
              className="webpos-category-chip inline-flex items-center justify-center gap-1 bg-teal-600 text-white"
              title={t('giftCard')}
            >
              <Gift size={14} />
              <span className="min-w-0 truncate">{t('giftCard')}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onCategoryChange('all')}
            className={`webpos-category-chip ${
              categoryId === 'all' ? 'ring-2 ring-[var(--webpos-accent-ring)] ring-offset-1' : ''
            }`}
            style={{ backgroundColor: '#e7e5e4' }}
            title={t('webPosAllCategories')}
          >
            <span className="min-w-0 w-full truncate">{t('webPosAllCategories')}</span>
          </button>
          {categories.map((c, i) => {
            const color = categoryColor(c.id, i, c.color);
            const active = categoryId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onCategoryChange(c.id)}
                className={`webpos-category-chip ${
                  active ? 'ring-2 ring-[var(--webpos-accent-ring)] ring-offset-1' : ''
                }`}
                style={{ backgroundColor: color }}
                title={c.name}
              >
                <span className="min-w-0 w-full truncate">{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-2 pb-3">
        {visibleProducts.length === 0 ? (
          <div className="flex h-full min-h-[10rem] items-center justify-center text-sm text-stone-500">
            {t('webPosNoProductsMatch')}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {visibleProducts.map((p) => {
              const accent =
                (p.categoryId && colorByCat.get(p.categoryId)) ||
                categoryColor(p.categoryId, 0);
              const qty = cartQtyByProduct.get(p.id) || 0;
              const isCombo = productHasCombo(p);
              const hasMods = !isCombo && productHasMods(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onProductClick(p)}
                  className="webpos-product-card group"
                >
                  <div className="flex min-h-[4rem] flex-1 flex-col px-2 pt-2.5 pb-1">
                    <span className="line-clamp-3 text-center text-sm font-medium leading-snug text-stone-800">
                      {p.name}
                    </span>
                    {(isCombo || hasMods) && (
                      <span className="mx-auto mt-1 rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-stone-500">
                        {isCombo ? t('webPosCombo') : t('webPosOpts')}
                      </span>
                    )}
                  </div>
                  <div className="relative h-1.5 w-full rounded-b-lg" style={{ backgroundColor: accent }} />
                  {qty > 0 ? (
                    <span className="absolute bottom-2 right-2 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md bg-stone-900 px-1 text-xs font-bold text-white">
                      {qty}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {expressCheckout && onExpressPay ? (
        <div className="shrink-0 grid grid-cols-3 gap-2 border-t border-stone-200 bg-white p-3">
          {expressMethods?.cash !== false ? (
            <button
              type="button"
              disabled={expressDisabled}
              onClick={() => onExpressPay('cash')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              <Banknote size={18} />
              {t('webPosCash')}
            </button>
          ) : null}
          {expressMethods?.card !== false ? (
            <button
              type="button"
              disabled={expressDisabled}
              onClick={() => onExpressPay('card')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 py-3.5 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-40"
            >
              <CreditCard size={18} />
              {t('webPosCard')}
            </button>
          ) : null}
          {expressMethods?.terminal ? (
            <button
              type="button"
              disabled={expressDisabled}
              onClick={() => onExpressPay('terminal')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 py-3.5 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-40"
            >
              <MonitorSmartphone size={18} />
              {t('webPosTerminal')}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
