import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type KeypadProps = {
  value: string;
  onChange: (v: string) => void;
};

function CashKeypad({ value, onChange }: KeypadProps) {
  const append = (ch: string) => {
    if (ch === 'C') {
      onChange('');
      return;
    }
    if (ch === '?') {
      onChange(value.slice(0, -1));
      return;
    }
    if (ch === '.' && value.includes('.')) return;
    if (ch === '.' && !value) {
      onChange('0.');
      return;
    }
    const next = value + ch;
    const [, dec] = next.split('.');
    if (dec && dec.length > 2) return;
    onChange(next);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '?'];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => append(k)}
          className="webpos-keypad-key py-3.5"
        >
          {k}
        </button>
      ))}
      <button type="button" onClick={() => append('C')} className="webpos-keypad-key col-span-3 py-2 text-sm">
        C
      </button>
    </div>
  );
}

export function WebPosStartShiftModal({
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (openingCash: number) => void;
}) {
  const { t } = useI18n();
  const [askConfirm, setAskConfirm] = useState(true);
  const [cash, setCash] = useState('');

  useEffect(() => {
    if (open) {
      setAskConfirm(true);
      setCash('');
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        {askConfirm ? (
          <>
            <h2 className="text-lg font-bold text-stone-900">{t('webPosShiftStartTitle')}</h2>
            <p className="mt-2 text-sm text-stone-600">{t('webPosShiftStartAsk')}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" className="btn-secondary py-3" onClick={onCancel} disabled={busy}>
                {t('no')}
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--webpos-accent)] py-3 text-sm font-bold text-white hover:opacity-90"
                onClick={() => setAskConfirm(false)}
                disabled={busy}
              >
                {t('yes')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-stone-900">{t('webPosShiftOpeningCash')}</h2>
            <p className="mt-1 text-sm text-stone-600">{t('webPosShiftOpeningCashHint')}</p>
            <div className="my-4 rounded-xl bg-stone-50 py-3 text-center text-3xl font-bold tabular-nums text-stone-900">
              {cash || '0'} <span className="text-base font-semibold text-stone-500">CHF</span>
            </div>
            <CashKeypad value={cash} onChange={setCash} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="btn-secondary py-3" onClick={onCancel} disabled={busy}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--webpos-accent)] py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                disabled={busy}
                onClick={() => onConfirm(Number(cash || 0))}
              >
                {t('webPosShiftStartConfirm')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function WebPosCloseShiftModal({
  open,
  busy,
  live,
  openingCash,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy?: boolean;
  openingCash: number;
  live: {
    cashSales: number;
    cardSales: number;
    terminalSales: number;
    totalSales: number;
    orderCount: number;
    expectedCash: number;
  } | null;
  onCancel: () => void;
  onConfirm: (closingCash: number) => void;
}) {
  const { t } = useI18n();
  const [cash, setCash] = useState('');
  const expected = live?.expectedCash ?? openingCash;
  const counted = Number(cash || 0);
  const diff = Math.round((counted - expected) * 100) / 100;
  const balanced = cash !== '' && Math.abs(diff) < 0.005;

  useEffect(() => {
    if (open) setCash('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-bold text-stone-900">{t('webPosShiftCloseTitle')}</h2>
        <p className="mt-1 text-sm text-stone-600">{t('webPosShiftCloseHint')}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs text-stone-500">{t('webPosShiftCashSales')}</p>
            <p className="text-lg font-bold tabular-nums">{(live?.cashSales ?? 0).toFixed(2)} CHF</p>
          </div>
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs text-stone-500">{t('webPosShiftExpectedDrawer')}</p>
            <p className="text-lg font-bold tabular-nums">{expected.toFixed(2)} CHF</p>
          </div>
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs text-stone-500">{t('webPosShiftCardSales')}</p>
            <p className="font-semibold tabular-nums">
              {((live?.cardSales ?? 0) + (live?.terminalSales ?? 0)).toFixed(2)} CHF
            </p>
          </div>
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs text-stone-500">{t('webPosShiftOrders')}</p>
            <p className="font-semibold tabular-nums">{live?.orderCount ?? 0}</p>
          </div>
        </div>

        <p className="mt-4 text-sm font-semibold text-stone-800">{t('webPosShiftCountCash')}</p>
        <div
          className={`my-2 rounded-xl py-3 text-center text-3xl font-bold tabular-nums ${
            cash === ''
              ? 'bg-stone-50 text-stone-900'
              : balanced
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-800'
          }`}
        >
          {cash || '0'} <span className="text-base font-semibold opacity-70">CHF</span>
        </div>
        {cash !== '' ? (
          <p
            className={`mb-2 flex items-center justify-center gap-1 text-sm font-semibold ${
              balanced ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {balanced ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {balanced
              ? t('webPosShiftBalanced')
              : t('webPosShiftVariance').replace('{amount}', diff.toFixed(2))}
          </p>
        ) : null}

        <CashKeypad value={cash} onChange={setCash} />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary py-3" onClick={onCancel} disabled={busy}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="rounded-xl bg-[var(--webpos-accent)] py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            disabled={busy || cash === ''}
            onClick={() => onConfirm(counted)}
          >
            {t('webPosShiftCloseConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WebPosShiftClosedModal({
  open,
  balanced,
  onPrintEod,
  onRestart,
  onStay,
}: {
  open: boolean;
  balanced: boolean;
  onPrintEod: () => void;
  onRestart: () => void;
  onStay: () => void;
}) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          {balanced ? (
            <CheckCircle2 className="mb-2 text-emerald-600" size={48} />
          ) : (
            <XCircle className="mb-2 text-amber-600" size={48} />
          )}
          <h2 className="text-lg font-bold text-stone-900">{t('webPosShiftClosedTitle')}</h2>
          <p className="mt-1 text-sm text-stone-600">
            {balanced ? t('webPosShiftClosedBalanced') : t('webPosShiftClosedWithVariance')}
          </p>
        </div>
        <div className="mt-5 space-y-2">
          <button
            type="button"
            className="w-full rounded-xl bg-[var(--webpos-accent)] py-3 text-sm font-bold text-white"
            onClick={onPrintEod}
          >
            {t('webPosShiftPrintEod')}
          </button>
          <button type="button" className="btn-secondary w-full py-3" onClick={onRestart}>
            {t('webPosShiftRestart')}
          </button>
          <button type="button" className="w-full py-2 text-sm font-medium text-stone-600 hover:underline" onClick={onStay}>
            {t('webPosShiftStayConnected')}
          </button>
        </div>
      </div>
    </div>
  );
}
