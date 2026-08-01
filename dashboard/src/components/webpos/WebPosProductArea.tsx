import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { categoryColor, categoryIndexMap } from './categoryColors';
import type { Category, Product } from './types';

type Props = {
  categories: Category[];
  products: Product[];
  categoryId: string | 'all';
  onCategoryChange: (id: string | 'all') => void;
  onProductClick: (product: Product) => void;
  cartQtyByProduct: Map<string, number>;
  productHasCombo: (p: Product) => boolean;
  productHasMods: (p: Product) => boolean;
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
}: Props) {
  const { t } = useI18n();
  const catIndex = useMemo(() => categoryIndexMap(categories), [categories]);

  const visibleProducts = useMemo(() => {
    return products.filter((p) => categoryId === 'all' || p.categoryId === categoryId);
  }, [products, categoryId]);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-stone-100">
      <div className="shrink-0 p-3 pb-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <button
            type="button"
            onClick={() => onCategoryChange('all')}
            className={`webpos-category-tile ${categoryId === 'all' ? 'ring-2 ring-teal-500 ring-offset-2' : ''}`}
            style={{ backgroundColor: '#e7e5e4' }}
          >
            {t('webPosAllCategories')}
          </button>
          {categories.map((c, i) => {
            const color = categoryColor(c.id, i);
            const active = categoryId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onCategoryChange(c.id)}
                className={`webpos-category-tile ${active ? 'ring-2 ring-teal-500 ring-offset-2' : ''}`}
                style={{ backgroundColor: color }}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {visibleProducts.length === 0 ? (
          <div className="flex h-full min-h-[10rem] items-center justify-center text-sm text-stone-500">
            {t('webPosNoProductsMatch')}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {visibleProducts.map((p) => {
              const idx = p.categoryId ? catIndex.get(p.categoryId) ?? 0 : 0;
              const accent = categoryColor(p.categoryId, idx);
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
                  <div className="flex min-h-[4.5rem] flex-1 flex-col px-2 pt-3 pb-1">
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
    </section>
  );
}
