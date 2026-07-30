import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { X } from 'lucide-react';
import { roundMoney2 } from '@/lib/money';

export type ShopOfferProduct = {
  id: string;
  name: string;
  price: number;
  image?: string | null;
  categoryId?: string | null;
  description?: string;
  productType?: string;
  /** True when this menu item needs the combo wizard (Main / Side / …) */
  isCombo?: boolean;
};

export type ShopOfferForPicker = {
  id: string;
  name: string;
  description?: string | null;
  badgeLabel?: string | null;
  offerType: string;
  rules?: Record<string, unknown> | null;
  productIds?: string[];
  categoryIds?: string[];
};

export type ShopOfferPickerResult = {
  offerId: string;
  offerBadge: string;
  offerName: string;
  lines: Array<{
    product: ShopOfferProduct;
    role: 'paid' | 'free';
    price: number;
    catalogPrice: number;
  }>;
};

function productInOffer(offer: ShopOfferForPicker, p: ShopOfferProduct, list?: string[]) {
  if (list && list.length) return list.includes(p.id);
  const pids = offer.productIds || [];
  const cids = offer.categoryIds || [];
  if (pids.length) return pids.includes(p.id);
  if (cids.length) return !!p.categoryId && cids.includes(p.categoryId);
  return true;
}

function badgeFor(offer: ShopOfferForPicker): string {
  if (offer.badgeLabel) return offer.badgeLabel;
  const rules = offer.rules || {};
  const buy = Number(rules.buyQty) || 2;
  const get = Number(rules.getQty) || 1;
  if (offer.offerType === 'package_deal') {
    const price = Number(rules.packagePrice) || 0;
    return price > 0 ? `${buy}+${get} · CHF ${price}` : `${buy}+${get}`;
  }
  if (offer.offerType === 'pay_n_get_m') {
    const pay = Number(rules.payQty) || 3;
    const recv = Number(rules.receiveQty) || pay + 1;
    return `${pay}+${recv - pay}`;
  }
  return `${buy}+${get}`;
}

type Props = {
  offer: ShopOfferForPicker;
  products: ShopOfferProduct[];
  /** Catalog unit price after delivery markup */
  priceOf: (p: ShopOfferProduct) => number;
  onClose: () => void;
  onConfirm: (result: ShopOfferPickerResult) => void;
};

/**
 * Interactive picker for 2+1 / package / BOGO: choose paid + free products, add to cart now.
 */
export default function ShopOfferPicker({ offer, products, priceOf, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const rules = offer.rules || {};
  const isPackage = offer.offerType === 'package_deal';
  const isPayN = offer.offerType === 'pay_n_get_m';

  const buyQty = isPayN
    ? Math.max(1, Math.floor(Number(rules.payQty) || 3))
    : Math.max(1, Math.floor(Number(rules.buyQty) || 2));
  const getQty = isPayN
    ? Math.max(1, Math.floor((Number(rules.receiveQty) || buyQty + 1) - buyQty))
    : Math.max(0, Math.floor(Number(rules.getQty) || 1));
  const packagePrice = Math.max(0, Number(rules.packagePrice) || 0);
  const buyList = isPackage ? ((rules.buyProductIds as string[]) || []) : undefined;
  const getList = isPackage ? ((rules.getProductIds as string[]) || []) : undefined;

  const paidPool = useMemo(
    () => products.filter((p) => productInOffer(offer, p, buyList)),
    [products, offer, buyList]
  );
  const freePool = useMemo(
    () => products.filter((p) => productInOffer(offer, p, getList?.length ? getList : buyList)),
    [products, offer, getList, buyList]
  );

  const [paidIds, setPaidIds] = useState<string[]>([]);
  const [freeIds, setFreeIds] = useState<string[]>([]);

  const badge = badgeFor(offer);
  const paidReady = paidIds.length === buyQty;
  const freeReady = getQty === 0 || freeIds.length === getQty;
  const canAdd = paidReady && freeReady;

  const toggle = (list: string[], id: string, max: number, set: (v: string[]) => void) => {
    if (list.includes(id)) {
      set(list.filter((x) => x !== id));
      return;
    }
    if (list.length >= max) {
      set([...list.slice(1), id]);
      return;
    }
    set([...list, id]);
  };

  const previewTotal = useMemo(() => {
    if (!canAdd) return null;
    const paidCatalog = paidIds.reduce((s, id) => {
      const p = paidPool.find((x) => x.id === id);
      return s + (p ? priceOf(p) : 0);
    }, 0);
    const freeCatalog = freeIds.reduce((s, id) => {
      const p = freePool.find((x) => x.id === id);
      return s + (p ? priceOf(p) : 0);
    }, 0);
    if (isPackage && packagePrice > 0) return roundMoney2(packagePrice);
    return roundMoney2(paidCatalog); // free at 0
  }, [canAdd, paidIds, freeIds, paidPool, freePool, priceOf, isPackage, packagePrice]);

  const confirm = () => {
    if (!canAdd) return;
    const paidProducts = paidIds
      .map((id) => paidPool.find((p) => p.id === id))
      .filter(Boolean) as ShopOfferProduct[];
    const freeProducts = freeIds
      .map((id) => freePool.find((p) => p.id === id))
      .filter(Boolean) as ShopOfferProduct[];

    const paidCatalogs = paidProducts.map((p) => priceOf(p));
    const paidSum = paidCatalogs.reduce((a, b) => a + b, 0);

    let paidPrices: number[];
    if (isPackage && packagePrice > 0 && paidProducts.length) {
      // Distribute {t('shopPackagePrice')} across paid lines; free = 0
      paidPrices = paidCatalogs.map((c) =>
        paidSum > 0 ? roundMoney2((c / paidSum) * packagePrice) : roundMoney2(packagePrice / paidProducts.length)
      );
      // Fix rounding drift on last paid line
      const drift = roundMoney2(packagePrice - paidPrices.reduce((a, b) => a + b, 0));
      if (paidPrices.length) paidPrices[paidPrices.length - 1] = roundMoney2(paidPrices[paidPrices.length - 1] + drift);
    } else {
      paidPrices = paidCatalogs.map((c) => roundMoney2(c));
    }

    const lines: ShopOfferPickerResult['lines'] = [
      ...paidProducts.map((product, i) => ({
        product,
        role: 'paid' as const,
        price: paidPrices[i],
        catalogPrice: paidCatalogs[i],
      })),
      ...freeProducts.map((product) => ({
        product,
        role: 'free' as const,
        price: 0,
        catalogPrice: priceOf(product),
      })),
    ];

    onConfirm({ offerId: offer.id, offerBadge: badge, offerName: offer.name, lines });
  };

  const ProductPick = ({
    pool,
    selected,
    max,
    onToggle,
    accent,
  }: {
    pool: ShopOfferProduct[];
    selected: string[];
    max: number;
    onToggle: (id: string) => void;
    accent: 'paid' | 'free';
  }) => (
    <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
      {pool.map((p) => {
        const on = selected.includes(p.id);
        const price = priceOf(p);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            className={`text-left rounded-lg border p-2 transition ${
              on
                ? accent === 'free'
                  ? 'border-amber-600 bg-amber-50 ring-1 ring-amber-600'
                  : 'border-stone-900 bg-stone-50 ring-1 ring-stone-900'
                : 'border-stone-200 bg-white'
            }`}
          >
            <p className="text-xs font-semibold text-stone-900 line-clamp-2">{p.name}</p>
            {p.isCombo || p.productType === 'combo' ? (
              <p className="mt-0.5 text-[10px] font-semibold text-amber-800">{t('shopComboPickHint')}</p>
            ) : null}
            <p className="mt-1 text-[11px] text-stone-600 tabular-nums">CHF {price.toFixed(2)}</p>
          </button>
        );
      })}
      {pool.length === 0 ? (
        <p className="col-span-2 text-sm text-stone-500 py-4 text-center">{t('shopNoMatchingProducts')}</p>
      ) : null}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
          <div className="min-w-0">
            {badge ? (
              <span className="inline-block rounded-full bg-amber-700 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                {badge}
              </span>
            ) : null}
            <h2 className="mt-1 text-base font-bold text-stone-900">{offer.name}</h2>
            {offer.description ? (
              <p className="mt-0.5 text-xs text-stone-600">{offer.description}</p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="p-1 text-stone-500" aria-label={t('close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-5">
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-stone-900">
                {t('shopPaidPick').replace('{n}', String(buyQty))}
              </h3>
              <span className="text-xs text-stone-500">
                {paidIds.length}/{buyQty}
              </span>
            </div>
            <ProductPick
              pool={paidPool}
              selected={paidIds}
              max={buyQty}
              accent="paid"
              onToggle={(id) => toggle(paidIds, id, buyQty, setPaidIds)}
            />
          </section>

          {getQty > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-amber-900">
                  {t('shopFreePick').replace('{n}', String(getQty))}
                </h3>
                <span className="text-xs text-stone-500">
                  {freeIds.length}/{getQty}
                </span>
              </div>
              <ProductPick
                pool={freePool}
                selected={freeIds}
                max={getQty}
                accent="free"
                onToggle={(id) => toggle(freeIds, id, getQty, setFreeIds)}
              />
            </section>
          ) : null}

          {previewTotal != null ? (
            <p className="text-sm font-semibold text-stone-900 tabular-nums">
              {t('shopDealTotal')}: CHF {previewTotal.toFixed(2)}
              {isPackage && packagePrice > 0 ? (
                <span className="ml-2 text-xs font-normal text-stone-500">package price</span>
              ) : (
                <span className="ml-2 text-xs font-normal text-amber-800">{t('shopNFree').replace('{n}', String(getQty))}</span>
              )}
            </p>
          ) : (
            <p className="text-xs text-stone-500">
              {t('shopSelectDealHint').replace('{paid}', String(buyQty)).replace('{freePart}', getQty > 0 ? t('shopAndNFree').replace('{n}', String(getQty)) : '')}
            </p>
          )}
          <p className="text-[11px] text-stone-500">
            {t('shopComboNextHint')}
          </p>
        </div>

        <div className="sticky bottom-0 border-t border-stone-200 bg-white px-4 py-3 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 border border-stone-300 py-3 text-sm font-semibold">
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={!canAdd}
            onClick={confirm}
            className="flex-1 bg-amber-700 text-white py-3 text-sm font-semibold disabled:opacity-40"
          >
            {t('shopAddToCart')}
          </button>
        </div>
      </div>
    </div>
  );
}
