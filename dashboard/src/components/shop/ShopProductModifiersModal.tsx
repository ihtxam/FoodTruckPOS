import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import type { ShopSelectedExtra } from '@/lib/shop-cart';
import { roundMoney2 } from '@/lib/money';

export interface ShopModifierOption {
  id: string;
  name: string;
  price: number;
  isDefault?: boolean;
}

export interface ShopModifierGroup {
  id: string;
  title: string;
  pricingType?: string;
  selectionType?: 'optional' | 'required' | string;
  minSelectable?: number;
  maxSelectable?: number;
  options: ShopModifierOption[];
}

export interface ShopProductForModifiers {
  id: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  allowExtras?: boolean;
  extras?: ShopModifierOption[];
  modifierGroups?: ShopModifierGroup[];
}

type Props = {
  product: ShopProductForModifiers;
  onClose: () => void;
  onConfirm: (extras: ShopSelectedExtra[], unitPrice: number) => void;
};

function effectiveGroups(product: ShopProductForModifiers): ShopModifierGroup[] {
  if (product.modifierGroups?.length) return product.modifierGroups;
  if (product.allowExtras && product.extras?.length) {
    return [
      {
        id: '__legacy__',
        title: 'Extras',
        selectionType: 'optional',
        minSelectable: 0,
        maxSelectable: product.extras.length,
        options: product.extras,
      },
    ];
  }
  return [];
}

function initialSelection(groups: ShopModifierGroup[]): Record<string, string[]> {
  const sel: Record<string, string[]> = {};
  for (const g of groups) {
    const defaults = g.options.filter((o) => o.isDefault).map((o) => o.id);
    const max = Math.max(1, Number(g.maxSelectable) || 1);
    sel[g.id] = defaults.slice(0, max);
  }
  return sel;
}

function groupMin(g: ShopModifierGroup) {
  if (g.selectionType === 'required') return Math.max(1, Number(g.minSelectable) || 1);
  return Math.max(0, Number(g.minSelectable) || 0);
}

function groupMax(g: ShopModifierGroup) {
  const min = groupMin(g);
  return Math.max(min, Number(g.maxSelectable) || 1);
}

export default function ShopProductModifiersModal({ product, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const groups = useMemo(() => effectiveGroups(product), [product]);
  const [selection, setSelection] = useState<Record<string, string[]>>(() => initialSelection(groups));
  const [error, setError] = useState<string | null>(null);

  const selectedExtras: ShopSelectedExtra[] = useMemo(() => {
    const extras: ShopSelectedExtra[] = [];
    for (const g of groups) {
      for (const id of selection[g.id] || []) {
        const opt = g.options.find((o) => o.id === id);
        if (!opt) continue;
        extras.push({
          id: opt.id,
          name: opt.name,
          price: Number(opt.price) || 0,
          groupId: g.id,
          groupTitle: g.title,
        });
      }
    }
    return extras;
  }, [groups, selection]);

  const extrasTotal = roundMoney2(selectedExtras.reduce((s, e) => s + e.price, 0));
  const unitPrice = roundMoney2(product.price + extrasTotal);

  const toggle = (group: ShopModifierGroup, optionId: string) => {
    setError(null);
    const max = groupMax(group);
    setSelection((prev) => {
      const current = prev[group.id] || [];
      const has = current.includes(optionId);
      if (max === 1) {
        return { ...prev, [group.id]: has ? [] : [optionId] };
      }
      if (has) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= max) {
        // Replace oldest when at max for multi-select
        return { ...prev, [group.id]: [...current.slice(1), optionId] };
      }
      return { ...prev, [group.id]: [...current, optionId] };
    });
  };

  const confirm = () => {
    for (const g of groups) {
      const count = (selection[g.id] || []).length;
      const min = groupMin(g);
      const max = groupMax(g);
      if (count < min) {
        setError(
          min === 1
            ? t('shopChooseOptionFor').replace('{name}', g.title)
            : t('shopChooseOptionFor').replace('{name}', g.title)
        );
        return;
      }
      if (count > max) {
        setError(t('shopTooManyOptions').replace('{name}', g.title));
        return;
      }
    }
    onConfirm(selectedExtras, unitPrice);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md max-h-[90vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-stone-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight truncate">{product.name}</h2>
            <p className="text-sm text-stone-500 mt-0.5">{t('shopCustomizeItem')}</p>
          </div>
          <button type="button" className="text-sm font-semibold text-stone-600 shrink-0" onClick={onClose}>
            {t('close')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {groups.map((g) => {
            const min = groupMin(g);
            const max = groupMax(g);
            const selected = selection[g.id] || [];
            return (
              <section key={g.id}>
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-stone-900">{g.title === 'Extras' ? t('shopExtras') : g.title}</h3>
                  <span className="text-xs text-stone-500">
                    {g.selectionType === 'required' || min > 0 ? t('shopRequired') : t('shopOptional')}
                    {max > 1 ? ` · ${t('shopUpTo').replace('{n}', String(max))}` : ''}
                  </span>
                </div>
                <ul className="space-y-2">
                  {g.options.map((opt) => {
                    const checked = selected.includes(opt.id);
                    const inputType = max === 1 ? 'radio' : 'checkbox';
                    return (
                      <li key={opt.id}>
                        <label className="flex items-center gap-3 border border-stone-200 px-3 py-2.5 cursor-pointer hover:border-stone-400">
                          <input
                            type={inputType}
                            name={`group-${g.id}`}
                            checked={checked}
                            onChange={() => toggle(g, opt.id)}
                            className="accent-stone-900"
                          />
                          <span className="flex-1 text-sm font-medium text-stone-900">{opt.name}</span>
                          <span className="text-sm text-stone-600">
                            {opt.price > 0 ? `+CHF ${opt.price.toFixed(2)}` : t('shopIncluded')}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="border-t border-stone-200 px-5 py-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">{t('shopItemTotal')}</span>
            <span className="font-semibold">CHF {unitPrice.toFixed(2)}</span>
          </div>
          <button
            type="button"
            onClick={confirm}
            className="w-full bg-stone-900 text-white py-3 font-semibold"
          >
            {t('shopAddToBasket')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function productHasModifiers(product: ShopProductForModifiers) {
  return (
    (product.modifierGroups?.some((g) => g.options?.length) ?? false) ||
    (!!(product.allowExtras && product.extras?.length))
  );
}
