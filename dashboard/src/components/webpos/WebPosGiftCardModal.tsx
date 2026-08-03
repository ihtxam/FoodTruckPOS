import { Gift, QrCode, CreditCard, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import RfidScanInput from '@/components/RfidScanInput';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';

export type GiftCardSettingsClient = {
  enabled: boolean;
  presetDenominations: number[];
  minAmount: number;
  maxAmount: number;
  reloadEnabled: boolean;
  customAmountEnabled: boolean;
};

export type GiftCardCartMeta = {
  op: 'sell' | 'reload';
  cardNumber: string;
  cardId?: string;
  mediaType: 'physical' | 'e_card';
  amount: number;
};

export type GiftCardPayResult = {
  cardId: string;
  cardNumber: string;
  mediaType: 'physical' | 'e_card';
  amount: number;
  balanceBefore: number;
  balanceAfter?: number;
};

type Mode = 'menu' | 'sell' | 'reload' | 'balance' | 'pay';
type MediaPick = 'choose' | 'physical' | 'e_card';

type Props = {
  open: boolean;
  mode: 'ops' | 'pay';
  settings: GiftCardSettingsClient | null;
  /** Remaining amount due (for pay mode) */
  amountDue?: number;
  onClose: () => void;
  onAddToCart: (meta: GiftCardCartMeta, lineName: string) => void;
  onPayConfirm?: (result: GiftCardPayResult) => void;
  /** Optional: attach membership customer after RFID read */
  onAttachCustomer?: (customer: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  }) => void;
};

type LookedUpCard = {
  id: string;
  cardNumber: string;
  balance: number;
  status: string;
  membershipEnabled?: boolean;
  customerId?: string | null;
  holderName?: string | null;
  customer?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

export default function WebPosGiftCardModal({
  open,
  mode,
  settings,
  amountDue = 0,
  onClose,
  onAddToCart,
  onPayConfirm,
  onAttachCustomer,
}: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<Mode>(mode === 'pay' ? 'pay' : 'menu');
  const [media, setMedia] = useState<MediaPick>(mode === 'pay' ? 'choose' : 'physical');
  const [code, setCode] = useState('');
  const [card, setCard] = useState<LookedUpCard | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(mode === 'pay' ? 'pay' : 'menu');
    setMedia(mode === 'pay' ? 'choose' : 'physical');
    setCode('');
    setCard(null);
    setAmount('');
    setCustom(false);
    setBusy(false);
  }, [open, mode]);

  // Debounced lookup after RFID wedge / typed card number settles
  useEffect(() => {
    if (!open || media === 'choose' || media === 'e_card') return;
    const trimmed = code.trim();
    if (trimmed.length < 4) return;
    if (card && card.cardNumber === trimmed) return;
    const tmr = window.setTimeout(() => {
      void lookup(trimmed, 'physical');
    }, 280);
    return () => window.clearTimeout(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, open, media]);

  if (!open) return null;

  const presets = settings?.presetDenominations || [20, 50, 100, 150];
  const minA = settings?.minAmount ?? 5;
  const maxA = settings?.maxAmount ?? 500;
  const reloadOk = settings?.reloadEnabled !== false;
  const customOk = settings?.customAmountEnabled !== false;

  const lookup = async (raw: string, mediaType: 'physical' | 'e_card') => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await api.get(`/gift-cards/lookup/${encodeURIComponent(trimmed)}`, {
        params: { mediaType },
      });
      const c = res.data.card;
      const looked: LookedUpCard = {
        id: c.id,
        cardNumber: c.cardNumber,
        balance: Number(c.balance || 0),
        status: c.status,
        membershipEnabled: !!c.membershipEnabled,
        customerId: c.customerId,
        holderName: c.holderName,
        customer: c.customer
          ? {
              id: c.customer.id,
              firstName: c.customer.firstName,
              lastName: c.customer.lastName,
              email: c.customer.email,
              phone: c.customer.phone,
            }
          : null,
      };
      setCard(looked);
      setCode(trimmed);
      if (looked.customer && onAttachCustomer) {
        onAttachCustomer(looked.customer);
      }
      if (step === 'pay' || mode === 'pay') {
        const due = roundMoney2(amountDue);
        const apply = roundMoney2(Math.min(looked.balance, due > 0 ? due : looked.balance));
        setAmount(String(apply));
      }
    } catch (error: any) {
      setCard(null);
      if (step === 'sell') {
        // New card sell: keep code, no existing card
        setCode(trimmed);
      } else {
        toast.error(error.response?.data?.error || t('giftCardNotFound'));
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmSellOrReload = () => {
    const n = roundMoney2(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error(t('giftCardInvalidAmount'));
      return;
    }
    if (n < minA || n > maxA) {
      toast.error(
        t('giftCardDenomOutOfRange')
          .replace('{min}', minA.toFixed(2))
          .replace('{max}', maxA.toFixed(2))
      );
      return;
    }
    const cardNumber = (card?.cardNumber || code).trim();
    if (!cardNumber) {
      toast.error(t('giftCardTapRequired'));
      return;
    }
    if (step === 'reload') {
      if (!card) {
        toast.error(t('giftCardNotFound'));
        return;
      }
      if (!reloadOk) {
        toast.error(t('giftCardReloadDisabled'));
        return;
      }
      onAddToCart(
        {
          op: 'reload',
          cardNumber,
          cardId: card.id,
          mediaType: media === 'e_card' ? 'e_card' : 'physical',
          amount: n,
        },
        `${t('giftCardReload')} CHF ${n.toFixed(2)}`
      );
    } else {
      if (card && Number(card.balance) > 0) {
        toast.error(t('giftCardAlreadyExists'));
        return;
      }
      onAddToCart(
        {
          op: 'sell',
          cardNumber,
          cardId: card?.id,
          mediaType: media === 'e_card' ? 'e_card' : 'physical',
          amount: n,
        },
        `${t('giftCard')} CHF ${n.toFixed(2)}`
      );
    }
    onClose();
  };

  const confirmPay = () => {
    if (!card || !onPayConfirm) return;
    const n = roundMoney2(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error(t('giftCardInvalidAmount'));
      return;
    }
    if (n > card.balance + 0.001) {
      toast.error(t('giftCardInsufficient'));
      return;
    }
    onPayConfirm({
      cardId: card.id,
      cardNumber: card.cardNumber,
      mediaType: media === 'e_card' ? 'e_card' : 'physical',
      amount: n,
      balanceBefore: card.balance,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900">
            <Gift size={20} className="text-teal-600" />
            {mode === 'pay' ? t('giftCardPay') : t('giftCard')}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-stone-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {step === 'menu' && (
            <div className="grid gap-2">
              <button
                type="button"
                className="rounded-xl border border-stone-200 px-4 py-3 text-left font-semibold hover:bg-teal-50"
                onClick={() => {
                  setStep('sell');
                  setMedia('physical');
                }}
              >
                {t('giftCardSell')}
              </button>
              <button
                type="button"
                disabled={!reloadOk}
                className="rounded-xl border border-stone-200 px-4 py-3 text-left font-semibold hover:bg-teal-50 disabled:opacity-40"
                onClick={() => {
                  setStep('reload');
                  setMedia('physical');
                }}
              >
                {t('giftCardReload')}
              </button>
              <button
                type="button"
                className="rounded-xl border border-stone-200 px-4 py-3 text-left font-semibold hover:bg-teal-50"
                onClick={() => {
                  setStep('balance');
                  setMedia('physical');
                }}
              >
                {t('giftCardCheckBalance')}
              </button>
            </div>
          )}

          {(step === 'pay' || mode === 'pay') && media === 'choose' && (
            <div className="grid gap-2">
              <p className="text-sm text-stone-600">{t('giftCardChooseMedia')}</p>
              <button
                type="button"
                className="flex items-center gap-3 rounded-xl border border-stone-200 px-4 py-3 font-semibold hover:bg-teal-50"
                onClick={() => setMedia('physical')}
              >
                <CreditCard size={20} /> {t('giftCardPhysical')}
              </button>
              <button
                type="button"
                className="flex items-center gap-3 rounded-xl border border-stone-200 px-4 py-3 font-semibold hover:bg-teal-50"
                onClick={() => setMedia('e_card')}
              >
                <QrCode size={20} /> {t('giftCardEcard')}
              </button>
            </div>
          )}

          {step !== 'menu' && media !== 'choose' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {media === 'e_card' ? t('giftCardScanOrPasteCode') : t('tapCard')}
                </label>
                {media === 'e_card' ? (
                  <input
                    className="input w-full"
                    autoFocus
                    value={code}
                    placeholder={t('giftCardEcardPlaceholder')}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void lookup(code, 'e_card');
                    }}
                  />
                ) : (
                  <RfidScanInput
                    value={code}
                    onChange={setCode}
                    placeholder={t('tapCard')}
                    autoFocus
                    className="input w-full"
                  />
                )}
                {media === 'e_card' && (
                  <button
                    type="button"
                    className="mt-2 text-sm font-semibold text-teal-700"
                    disabled={busy}
                    onClick={() => void lookup(code, 'e_card')}
                  >
                    {t('giftCardLookup')}
                  </button>
                )}
              </div>

              {card && (
                <div className="rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
                  <div className="font-mono text-xs">{card.cardNumber}</div>
                  <div className="mt-1 text-lg font-bold">
                    CHF {card.balance.toFixed(2)}
                  </div>
                  {card.membershipEnabled && (
                    <div className="mt-1 text-xs">
                      {t('membership')}: {card.holderName || card.customer?.firstName || 'ù'}
                    </div>
                  )}
                </div>
              )}

              {step === 'balance' && card && (
                <button type="button" className="btn-primary w-full" onClick={onClose}>
                  {t('close')}
                </button>
              )}

              {(step === 'sell' || step === 'reload') && (code || card) && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {presets.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setAmount(String(p));
                          setCustom(false);
                        }}
                        className={`rounded-xl border px-3 py-3 text-sm font-bold ${
                          Number(amount) === p
                            ? 'border-teal-500 bg-teal-50 text-teal-800'
                            : 'border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        CHF {p.toFixed(2)}
                      </button>
                    ))}
                  </div>
                  {customOk && (
                    <button
                      type="button"
                      className="text-sm font-semibold text-teal-700"
                      onClick={() => setCustom(true)}
                    >
                      {t('giftCardCustomAmount')}
                    </button>
                  )}
                  {(custom || customOk) && (
                    <input
                      className="input w-full"
                      type="number"
                      min={minA}
                      max={maxA}
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={`CHF ${minA} ù ${maxA}`}
                    />
                  )}
                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={busy}
                    onClick={confirmSellOrReload}
                  >
                    {t('giftCardAddToCart')}
                  </button>
                </div>
              )}

              {mode === 'pay' && media !== 'choose' && card && (
                <div className="space-y-3">
                  <label className="block text-sm">
                    <span className="text-stone-600">{t('giftCardPayAmount')}</span>
                    <input
                      className="input mt-1 w-full"
                      type="number"
                      min="0.01"
                      max={card.balance}
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  {amountDue > card.balance && (
                    <p className="text-xs text-amber-700">
                      {t('giftCardPartialHint')
                        .replace('{balance}', card.balance.toFixed(2))
                        .replace('{due}', amountDue.toFixed(2))}
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={busy}
                    onClick={confirmPay}
                  >
                    {t('giftCardApplyPayment')}
                  </button>
                </div>
              )}

              {step === 'sell' && !card && code && (
                <p className="text-xs text-stone-500">{t('giftCardNewCardHint')}</p>
              )}
            </>
          )}

          {step !== 'menu' && mode !== 'pay' && (
            <button
              type="button"
              className="text-sm text-stone-500 hover:underline"
              onClick={() => {
                setStep('menu');
                setCard(null);
                setCode('');
                setAmount('');
              }}
            >
              ? {t('back')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
