import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useI18n } from '@/lib/i18n';
import type { ShopSelectedExtra } from '@/lib/shop-cart';
import { roundMoney2 } from '@/lib/money';
import type { ShopModifierGroup } from '@/components/shop/ShopProductModifiersModal';

export type ComboOptionProduct = {
  productId: string;
  name: string;
  image?: string | null;
  description?: string | null;
  extraPrice: number;
  allowExtras?: boolean;
  extras?: Array<{ id: string; name: string; price: number; isDefault?: boolean }>;
  modifierGroups?: ShopModifierGroup[];
};

export type ComboSlot = {
  id: string;
  name: string;
  minPick: number;
  maxPick: number;
  options: ComboOptionProduct[];
};

export type ShopComboProduct = {
  id: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  comboSlots: ComboSlot[];
  allowExtras?: boolean;
  extras?: Array<{ id: string; name: string; price: number }>;
  modifierGroups?: ShopModifierGroup[];
};

export type ComboSelection = {
  slotId: string;
  slotName: string;
  productId: string;
  productName: string;
  image?: string | null;
  extraPrice: number;
  selectedExtras: ShopSelectedExtra[];
};

type Props = {
  product: ShopComboProduct;
  onClose: () => void;
  onConfirm: (payload: {
    comboSelections: ComboSelection[];
    selectedExtras: ShopSelectedExtra[];
    unitPrice: number;
  }) => void;
};

type Phase =
  | { kind: 'pick'; slotIndex: number }
  | { kind: 'extras'; slotIndex: number; option: ComboOptionProduct }
  | { kind: 'combo_extras' }
  | { kind: 'summary' };

function optionHasExtras(opt: ComboOptionProduct) {
  return (
    (opt.modifierGroups?.some((g) => g.options?.length) ?? false) ||
    (!!(opt.allowExtras && opt.extras?.length))
  );
}

function effectiveGroups(opt: ComboOptionProduct): ShopModifierGroup[] {
  if (opt.modifierGroups?.length) return opt.modifierGroups;
  if (opt.allowExtras && opt.extras?.length) {
    return [
      {
        id: '__legacy__',
        title: 'Extras',
        selectionType: 'optional',
        minSelectable: 0,
        maxSelectable: opt.extras.length,
        options: opt.extras,
      },
    ];
  }
  return [];
}

function groupMin(g: ShopModifierGroup) {
  if (g.selectionType === 'required') return Math.max(1, Number(g.minSelectable) || 1);
  return Math.max(0, Number(g.minSelectable) || 0);
}

function groupMax(g: ShopModifierGroup) {
  const min = groupMin(g);
  return Math.max(min, Number(g.maxSelectable) || 1);
}

function productHasComboSlots(product: { productType?: string; comboSlots?: ComboSlot[] }) {
  return product.productType === 'combo' && (product.comboSlots?.length ?? 0) > 0;
}

export { productHasComboSlots };

export default function ShopComboWizard({ product, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const slots = product.comboSlots || [];
  const [phase, setPhase] = useState<Phase>({ kind: 'pick', slotIndex: 0 });
  const [selections, setSelections] = useState<ComboSelection[]>([]);
  const [extraSelection, setExtraSelection] = useState<Record<string, string[]>>({});
  const [comboExtraSelection, setComboExtraSelection] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  const comboGroups = useMemo(() => {
    if (product.modifierGroups?.length) return product.modifierGroups;
    if (product.allowExtras && product.extras?.length) {
      return [
        {
          id: '__legacy_combo__',
          title: 'Extras',
          selectionType: 'optional' as const,
          minSelectable: 0,
          maxSelectable: product.extras.length,
          options: product.extras,
        },
      ];
    }
    return [] as ShopModifierGroup[];
  }, [product]);

  const runningTotal = useMemo(() => {
    const picks = selections.reduce(
      (s, sel) =>
        s + sel.extraPrice + sel.selectedExtras.reduce((x, e) => x + e.price, 0),
      0
    );
    return roundMoney2(product.price + picks);
  }, [product.price, selections]);

  const progressLabel = useMemo(() => {
    if (phase.kind === 'summary' || phase.kind === 'combo_extras') {
      return `${slots.length} / ${slots.length}`;
    }
    return `${Math.min(phase.slotIndex + 1, slots.length)} / ${slots.length}`;
  }, [phase, slots.length]);

  const buildExtrasFromSelection = (
    groups: ShopModifierGroup[],
    selection: Record<string, string[]>
  ): ShopSelectedExtra[] => {
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
  };

  const validateGroups = (groups: ShopModifierGroup[], selection: Record<string, string[]>) => {
    for (const g of groups) {
      const count = (selection[g.id] || []).length;
      const min = groupMin(g);
      const title = g.title === 'Extras' ? t('shopExtras') : g.title;
      if (count < min) {
        return min === 1
          ? t('shopChooseOptionFor').replace('{name}', title)
          : t('shopChooseAtLeastOptions').replace('{n}', String(min)).replace('{name}', title);
      }
      if (count > groupMax(g)) return t('shopTooManyOptions').replace('{name}', title);
    }
    return null;
  };

  const goAfterSlot = (nextIndex: number, nextSelections: ComboSelection[]) => {
    if (nextIndex < slots.length) {
      setPhase({ kind: 'pick', slotIndex: nextIndex });
      return;
    }
    if (comboGroups.length) {
      const defaults: Record<string, string[]> = {};
      for (const g of comboGroups) {
        defaults[g.id] = g.options
          .filter((o) => !!(o as { isDefault?: boolean }).isDefault)
          .map((o) => o.id)
          .slice(0, groupMax(g));
      }
      setComboExtraSelection(defaults);
      setPhase({ kind: 'combo_extras' });
      return;
    }
    setSelections(nextSelections);
    setPhase({ kind: 'summary' });
  };

  const pickOption = (slot: ComboSlot, option: ComboOptionProduct) => {
    setError(null);
    if (optionHasExtras(option)) {
      const groups = effectiveGroups(option);
      const defaults: Record<string, string[]> = {};
      for (const g of groups) {
        defaults[g.id] = g.options
          .filter((o) => !!(o as { isDefault?: boolean }).isDefault)
          .map((o) => o.id)
          .slice(0, groupMax(g));
      }
      setExtraSelection(defaults);
      setPhase({ kind: 'extras', slotIndex: slots.indexOf(slot), option });
      return;
    }

    const sel: ComboSelection = {
      slotId: slot.id,
      slotName: slot.name,
      productId: option.productId,
      productName: option.name,
      image: option.image,
      extraPrice: option.extraPrice || 0,
      selectedExtras: [],
    };
    const next = [...selections.filter((s) => s.slotId !== slot.id), sel];
    setSelections(next);
    goAfterSlot(slots.indexOf(slot) + 1, next);
  };

  const confirmSlotExtras = () => {
    if (phase.kind !== 'extras') return;
    const slot = slots[phase.slotIndex];
    const groups = effectiveGroups(phase.option);
    const err = validateGroups(groups, extraSelection);
    if (err) {
      setError(err);
      return;
    }
    const sel: ComboSelection = {
      slotId: slot.id,
      slotName: slot.name,
      productId: phase.option.productId,
      productName: phase.option.name,
      image: phase.option.image,
      extraPrice: phase.option.extraPrice || 0,
      selectedExtras: buildExtrasFromSelection(groups, extraSelection),
    };
    const next = [...selections.filter((s) => s.slotId !== slot.id), sel];
    setSelections(next);
    setError(null);
    goAfterSlot(phase.slotIndex + 1, next);
  };

  const confirmComboExtras = () => {
    const err = validateGroups(comboGroups, comboExtraSelection);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setPhase({ kind: 'summary' });
  };

  const toggleGroupOption = (
    group: ShopModifierGroup,
    optionId: string,
    setter: Dispatch<SetStateAction<Record<string, string[]>>>
  ) => {
    setError(null);
    const max = groupMax(group);
    setter((prev) => {
      const current = prev[group.id] || [];
      const has = current.includes(optionId);
      if (max === 1) return { ...prev, [group.id]: has ? [] : [optionId] };
      if (has) return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      if (current.length >= max) return { ...prev, [group.id]: [...current.slice(1), optionId] };
      return { ...prev, [group.id]: [...current, optionId] };
    });
  };

  const comboExtras = buildExtrasFromSelection(comboGroups, comboExtraSelection);
  const unitPrice = roundMoney2(
    product.price +
      selections.reduce(
        (s, sel) => s + sel.extraPrice + sel.selectedExtras.reduce((x, e) => x + e.price, 0),
        0
      ) +
      comboExtras.reduce((s, e) => s + e.price, 0)
  );

  const renderExtrasEditor = (
    groups: ShopModifierGroup[],
    selection: Record<string, string[]>,
    setter: Dispatch<SetStateAction<Record<string, string[]>>>
  ) => (
    <div className="space-y-4">
      {groups.map((g) => {
        const max = groupMax(g);
        const selected = selection[g.id] || [];
        return (
          <section key={g.id}>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <h3 className="font-semibold text-stone-900">
                {g.title === 'Extras' ? t('shopExtras') : g.title}
              </h3>
              <span className="text-xs text-stone-500">
                {g.selectionType === 'required' || groupMin(g) > 0
                  ? t('shopRequired')
                  : t('shopOptional')}
                {max > 1 ? ` · ${t('shopUpTo').replace('{n}', String(max))}` : ''}
              </span>
            </div>
            <ul className="space-y-2">
              {g.options.map((opt) => {
                const checked = selected.includes(opt.id);
                return (
                  <li key={opt.id}>
                    <label className="flex items-center gap-3 border border-stone-200 px-3 py-2.5 cursor-pointer hover:border-stone-400">
                      <input
                        type={max === 1 ? 'radio' : 'checkbox'}
                        name={`combo-extra-${g.id}`}
                        checked={checked}
                        onChange={() => toggleGroupOption(g, opt.id, setter)}
                        className="accent-stone-900"
                      />
                      <span className="flex-1 text-sm font-medium">{opt.name}</span>
                      <span className="text-sm text-stone-600">
                        {opt.price > 0
                          ? `+CHF ${Number(opt.price).toFixed(2)}`
                          : t('shopFree')}
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
  );

  const currentSlot = phase.kind === 'pick' || phase.kind === 'extras' ? slots[phase.slotIndex] : null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-stone-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">{t('shopCombo')}</p>
              <h2 className="text-lg font-bold tracking-tight truncate">{product.name}</h2>
              <p className="text-sm text-stone-500 mt-0.5">
                {t('shopStepFrom').replace('{step}', String(progressLabel)).replace('{price}', product.price.toFixed(2))}
              </p>
            </div>
            <button type="button" className="text-sm font-semibold text-stone-600 shrink-0" onClick={onClose}>
              {t('close')}
            </button>
          </div>
          <div className="mt-3 h-1.5 bg-stone-100 overflow-hidden">
            <div
              className="h-full bg-stone-900 transition-all duration-300"
              style={{
                width: `${Math.round(
                  ((phase.kind === 'summary' || phase.kind === 'combo_extras'
                    ? slots.length
                    : phase.slotIndex + (phase.kind === 'extras' ? 0.5 : 0)) /
                    Math.max(slots.length, 1)) *
                    100
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {phase.kind === 'pick' && currentSlot && (
            <div>
              <h3 className="text-base font-semibold text-stone-900 mb-1">{currentSlot.name}</h3>
              <p className="text-sm text-stone-500 mb-4">{t('shopChooseOneContinue')}</p>
              <div className="grid grid-cols-2 gap-3">
                {currentSlot.options.map((opt) => (
                  <button
                    key={opt.productId}
                    type="button"
                    onClick={() => pickOption(currentSlot, opt)}
                    className="text-left border border-stone-200 hover:border-stone-900 transition-colors overflow-hidden group"
                  >
                    <div className="aspect-square bg-stone-100 relative overflow-hidden">
                      {opt.image ? (
                        <img
                          src={opt.image}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-300 text-3xl font-light">
                          {opt.name.slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="text-sm font-semibold text-stone-900 line-clamp-2">{opt.name}</div>
                      <div className="text-xs text-stone-600 mt-1">
                        {opt.extraPrice > 0 ? `+CHF ${opt.extraPrice.toFixed(2)}` : t('shopIncluded')}
                        {optionHasExtras(opt) ? ' · extras' : ''}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase.kind === 'extras' && (
            <div>
              <button
                type="button"
                className="text-sm font-medium text-stone-600 mb-3"
                onClick={() => setPhase({ kind: 'pick', slotIndex: phase.slotIndex })}
              >
                {t('shopBack')}
              </button>
              <div className="flex gap-3 mb-4">
                <div className="w-16 h-16 bg-stone-100 shrink-0 overflow-hidden">
                  {phase.option.image ? (
                    <img src={phase.option.image} alt="" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900">{phase.option.name}</h3>
                  <p className="text-sm text-stone-500">{t('shopAddExtras')}</p>
                </div>
              </div>
              {renderExtrasEditor(effectiveGroups(phase.option), extraSelection, setExtraSelection)}
            </div>
          )}

          {phase.kind === 'combo_extras' && (
            <div>
              <h3 className="font-semibold text-stone-900 mb-1">{t('shopComboExtras')}</h3>
              <p className="text-sm text-stone-500 mb-4">{t('shopComboExtrasHint')}</p>
              {renderExtrasEditor(comboGroups, comboExtraSelection, setComboExtraSelection)}
            </div>
          )}

          {phase.kind === 'summary' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-stone-900">{t('shopYourCombo')}</h3>
              <ul className="space-y-3">
                {selections.map((sel) => (
                  <li key={sel.slotId} className="flex gap-3 border border-stone-200 p-2.5">
                    <div className="w-14 h-14 bg-stone-100 shrink-0 overflow-hidden">
                      {sel.image ? (
                        <img src={sel.image} alt="" className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-stone-500">{sel.slotName}</div>
                      <div className="text-sm font-semibold">{sel.productName}</div>
                      {!!sel.selectedExtras.length && (
                        <p className="text-xs text-stone-500 mt-0.5">
                          {sel.selectedExtras.map((e) => e.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-stone-600 shrink-0">
                      {sel.extraPrice > 0 ? `+${sel.extraPrice.toFixed(2)}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
              {!!comboExtras.length && (
                <p className="text-sm text-stone-600">
                  Extras: {comboExtras.map((e) => e.name).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-stone-200 px-5 py-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">{t('shopRunningTotal')}</span>
            <span className="font-semibold">
              CHF {(phase.kind === 'summary' ? unitPrice : runningTotal).toFixed(2)}
            </span>
          </div>

          {phase.kind === 'extras' && (
            <button
              type="button"
              onClick={confirmSlotExtras}
              className="w-full bg-stone-900 text-white py-3 font-semibold"
            >
              {t('shopContinue')}
            </button>
          )}
          {phase.kind === 'combo_extras' && (
            <button
              type="button"
              onClick={confirmComboExtras}
              className="w-full bg-stone-900 text-white py-3 font-semibold"
            >
              {t('shopReviewCombo')}
            </button>
          )}
          {phase.kind === 'summary' && (
            <div className="flex gap-2">
              <button
                type="button"
                className="px-4 border border-stone-300 font-semibold text-sm"
                onClick={() => {
                  setSelections([]);
                  setPhase({ kind: 'pick', slotIndex: 0 });
                }}
              >
                {t('shopRestart')}
              </button>
              <button
                type="button"
                onClick={() => {
                  for (const slot of slots) {
                    const count = selections.filter((s) => s.slotId === slot.id).length;
                    if (count < (slot.minPick || 1)) {
                      setError(
                        (slot.minPick || 1) === 1
                          ? t('shopChooseOptionFor').replace('{name}', slot.name)
                          : t('shopChooseNOptions')
                              .replace('{n}', String(slot.minPick))
                              .replace('{name}', slot.name)
                      );
                      return;
                    }
                  }
                  onConfirm({
                    comboSelections: selections,
                    selectedExtras: comboExtras,
                    unitPrice,
                  });
                }}
                className="flex-1 bg-stone-900 text-white py-3 font-semibold"
              >
                {t('shopAddToBasketPrice').replace('{price}', unitPrice.toFixed(2))}
              </button>
            </div>
          )}
          {phase.kind === 'pick' && phase.slotIndex > 0 && (
            <button
              type="button"
              className="w-full border border-stone-300 py-2.5 text-sm font-semibold"
              onClick={() => {
                const prev = phase.slotIndex - 1;
                setSelections((s) => s.filter((x) => x.slotId !== slots[prev].id));
                setPhase({ kind: 'pick', slotIndex: prev });
              }}
            >
              {t('shopBack')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
