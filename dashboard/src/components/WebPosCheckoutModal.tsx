import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  quickCashOptions,
  roundMoney2,
  roundToStep,
  roundingAdjustment,
} from '@/lib/money';
import type { PosCheckoutSettings } from '@/lib/pos-checkout';
import WebPosTipKeypad from '@/components/WebPosTipKeypad';

export type CheckoutPayMethod = 'cash' | 'card' | 'terminal' | 'pay_later';

export type CheckoutResult = {
  method: CheckoutPayMethod;
  discountPercent: number;
  tipAmount: number;
  roundingAmount: number;
  total: number;
  amountTendered: number | null;
  changeDue: number | null;
};

type MethodFlags = {
  cash?: boolean;
  card?: boolean;
  terminal?: boolean;
  payLater?: boolean;
};

type Props = {
  open: boolean;
  subtotal: number;
  taxAmount: number;
  taxRate?: number;
  vatIncludedInPrice?: boolean;
  settings: PosCheckoutSettings;
  methods: MethodFlags;
  initialMethod?: CheckoutPayMethod | 'express';
  onClose: () => void;
  onConfirm: (result: CheckoutResult) => void;
  onSplit?: () => void;
};

export default function WebPosCheckoutModal({
  open,
  subtotal,
  taxAmount,
  taxRate = 0,
  vatIncludedInPrice = false,
  settings,
  methods,
  initialMethod = 'cash',
  onClose,
  onConfirm,
  onSplit,
}: Props) {
  const { t } = useI18n();
  const [method, setMethod] = useState<CheckoutPayMethod>(
    initialMethod === 'express' ? 'cash' : initialMethod
  );
  const [discountPercent, setDiscountPercent] = useState(0);
  const [tipAmount, setTipAmount] = useState(0);
  const [tipPercent, setTipPercent] = useState(0);
  const [tipKeypadOpen, setTipKeypadOpen] = useState(false);
  const [tender, setTender] = useState<number | null>(null);

  const calc = useMemo(() => {
    const merchandise = vatIncludedInPrice ? subtotal + taxAmount : subtotal;
    const disc = roundMoney2((merchandise * discountPercent) / 100);
    const afterDisc = roundMoney2(merchandise - disc);
    const taxShare =
      merchandise > 0 ? roundMoney2(taxAmount * (afterDisc / merchandise)) : taxAmount;
    const preTip = vatIncludedInPrice
      ? afterDisc
      : roundMoney2(afterDisc + taxShare);
    const withTip = roundMoney2(preTip + tipAmount);
    const step = settings.roundingStep || 0;
    const total = roundToStep(withTip, step || 0.01);
    const roundingAmount = roundingAdjustment(withTip, step || 0.01);
    return { disc, preTip, total, roundingAmount, taxShare };
  }, [subtotal, taxAmount, discountPercent, tipAmount, settings.roundingStep, vatIncludedInPrice]);

  const cashOpts = useMemo(
    () => quickCashOptions(calc.total, settings.quickCashDenominations || []),
    [calc.total, settings.quickCashDenominations]
  );

  if (!open) return null;

  const changeDue =
    method === 'cash' && tender != null ? roundMoney2(tender - calc.total) : null;

  const payButtons: Array<{ id: CheckoutPayMethod; label: string; show: boolean }> = [
    { id: 'cash', label: t('cash'), show: methods.cash !== false },
    { id: 'card', label: t('card'), show: methods.card !== false },
    { id: 'terminal', label: t('terminal'), show: methods.terminal !== false },
    { id: 'pay_later', label: t('webPosPayLater'), show: methods.payLater !== false },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/45 p-3">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
          <h2 className="font-semibold text-lg">{t('webPosCheckout')}</h2>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {settings.discountsEnabled && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide muted mb-2">
                {t('discount')}
              </p>
              <div className="flex flex-wrap gap-2">
                {(settings.discountPresets || []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                      discountPercent === p.percent
                        ? 'border-teal-600 bg-teal-50 text-teal-900'
                        : 'border-[var(--border)]'
                    }`}
                    onClick={() => setDiscountPercent(p.percent)}
                  >
                    {p.name} {p.percent > 0 ? `(${p.percent}%)` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {settings.tipsEnabled && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide muted mb-2">
                {t('webPosTip')}
              </p>
              <div className="flex flex-wrap gap-2">
                {(settings.tipPresetsPercent || []).map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                      tipPercent === pct && tipAmount === roundMoney2((calc.preTip * pct) / 100)
                        ? 'border-teal-600 bg-teal-50 text-teal-900'
                        : 'border-[var(--border)]'
                    }`}
                    onClick={() => {
                      setTipPercent(pct);
                      setTipAmount(roundMoney2((calc.preTip * pct) / 100));
                    }}
                  >
                    {pct}%
                  </button>
                ))}
                {settings.allowCustomTip && (
                  <button
                    type="button"
                    className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold"
                    onClick={() => setTipKeypadOpen(true)}
                  >
                    {t('webPosTipAmount')}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[var(--border)] p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>{t('subtotal')}</span>
              <span>CHF {subtotal.toFixed(2)}</span>
            </div>
            {calc.disc > 0 && (
              <div className="flex justify-between text-teal-700">
                <span>
                  {t('discount')} ({discountPercent}%)
                </span>
                <span>-CHF {calc.disc.toFixed(2)}</span>
              </div>
            )}
            {taxAmount > 0 && taxRate > 0 && (
              <div className="flex justify-between muted text-xs">
                <span>{t('webPosTax').replace('{rate}', String(taxRate))}</span>
                <span>CHF {taxAmount.toFixed(2)}</span>
              </div>
            )}
            {tipAmount > 0 && (
              <div className="flex justify-between">
                <span>{t('webPosTip')}</span>
                <span>CHF {tipAmount.toFixed(2)}</span>
              </div>
            )}
            {Math.abs(calc.roundingAmount) >= 0.01 && (
              <div className="flex justify-between muted">
                <span>{t('rounding')}</span>
                <span>
                  {calc.roundingAmount > 0 ? '+' : ''}
                  CHF {calc.roundingAmount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-1 border-t border-[var(--border)]">
              <span>{t('total')}</span>
              <span>CHF {calc.total.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide muted mb-2">
              {t('payment')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {payButtons
                .filter((b) => b.show)
                .map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`rounded-xl border py-3 text-sm font-semibold ${
                      method === b.id
                        ? 'border-teal-600 bg-teal-50 text-teal-900'
                        : 'border-[var(--border)]'
                    }`}
                    onClick={() => {
                      setMethod(b.id);
                      if (b.id !== 'cash') setTender(null);
                    }}
                  >
                    {b.label}
                  </button>
                ))}
            </div>
          </div>

          {method === 'cash' && settings.quickCashEnabled && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide muted mb-2">
                {t('webPosQuickCash')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                    tender === calc.total
                      ? 'border-teal-600 bg-teal-50'
                      : 'border-[var(--border)]'
                  }`}
                  onClick={() => setTender(calc.total)}
                >
                  {t('webPosExact')} CHF {calc.total.toFixed(2)}
                </button>
                {cashOpts.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                      tender === d ? 'border-teal-600 bg-teal-50' : 'border-[var(--border)]'
                    }`}
                    onClick={() => setTender(d)}
                  >
                    CHF {d.toFixed(0)}
                  </button>
                ))}
              </div>
              {tender != null && (
                <p className="mt-2 text-sm font-semibold">
                  {t('webPosChangeDue')}: CHF {(changeDue ?? 0).toFixed(2)}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {settings.splitBillsEnabled && onSplit && (
              <button type="button" className="btn-secondary w-full" onClick={onSplit}>
                {t('webPosSplitBill')}
              </button>
            )}
            <button
              type="button"
              className="btn-primary w-full py-3 text-base"
              disabled={method === 'cash' && settings.quickCashEnabled && tender == null}
              onClick={() =>
                onConfirm({
                  method,
                  discountPercent,
                  tipAmount,
                  roundingAmount: calc.roundingAmount,
                  total: calc.total,
                  amountTendered: method === 'cash' ? tender : null,
                  changeDue: method === 'cash' ? changeDue : null,
                })
              }
            >
              {t('webPosConfirmPay')} ù CHF {calc.total.toFixed(2)}
            </button>
          </div>
        </div>
      </div>

      <WebPosTipKeypad
        open={tipKeypadOpen}
        initial={tipAmount}
        onClose={() => setTipKeypadOpen(false)}
        onConfirm={(amt) => {
          setTipAmount(amt);
          setTipPercent(0);
        }}
      />
    </div>
  );
}
