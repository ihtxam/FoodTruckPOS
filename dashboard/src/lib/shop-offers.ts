import { roundMoney2 } from '@/lib/money';

export type LiveShopOffer = {
  id: string;
  name: string;
  badgeLabel?: string | null;
  offerType: string;
  rules?: Record<string, unknown> | null;
  productIds?: string[];
  categoryIds?: string[];
  channels?: string[];
};

/** % off that can be baked into a single line (category or product scoped). */
export function matchingPercentOffer(
  offers: LiveShopOffer[],
  product: { id: string; categoryId?: string | null },
  channel?: string
): { offer: LiveShopOffer; percent: number } | null {
  let best: { offer: LiveShopOffer; percent: number } | null = null;
  for (const o of offers) {
    if (o.offerType !== 'percent_category' && o.offerType !== 'percent_order') continue;
    // Whole-order % is applied at checkout, not per line (except we still show badge)
    if (o.offerType === 'percent_order') continue;
    const channels = o.channels || [];
    if (channel && channels.length && !channels.includes(channel)) continue;
    const pids = o.productIds || [];
    const cids = o.categoryIds || [];
    let match = false;
    if (pids.length) match = pids.includes(product.id);
    else if (cids.length) match = !!product.categoryId && cids.includes(product.categoryId);
    else match = true; // all products
    if (!match) continue;
    const percent = Math.min(90, Math.max(0, Number(o.rules?.percentOff) || 0));
    if (percent <= 0) continue;
    if (!best || percent > best.percent) best = { offer: o, percent };
  }
  return best;
}

export function applyPercent(price: number, percent: number) {
  return roundMoney2(price * (1 - percent / 100));
}

export function isPickableDeal(offerType: string) {
  return offerType === 'package_deal' || offerType === 'bogo' || offerType === 'pay_n_get_m';
}
