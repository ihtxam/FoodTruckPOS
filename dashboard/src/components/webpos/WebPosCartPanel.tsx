import { ArrowUpFromLine, MessageSquare, MoreVertical, Printer, User } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import WebPosNumericKeypad from './WebPosNumericKeypad';
import type { CartLine, KeypadMode, PosChannel } from './types';

type Props = {
  cart: CartLine[];
  totals: { subtotal: number; tax: number; rounding: number; total: number };
  taxRate: number;
  money: (n: number) => string;
  expanded: boolean;
  selectedLineId: string | null;
  onSelectLine: (lineId: string | null) => void;
  keypadMode: KeypadMode;
  onKeypadModeChange: (mode: KeypadMode) => void;
  keypadBuffer: string;
  onKeypadBufferChange: (buf: string) => void;
  onKeypadApply: () => void;
  channel: PosChannel | null;
  onChannelChange: (ch: PosChannel) => void;
  activeCourse: number;
  coursesEnabled: boolean;
  orderNote?: string;
  tableLabel?: string | null;
  tabNumber?: string | null;
  customerLabel?: string | null;
  busy: boolean;
  onCustomer: () => void;
  onNote: () => void;
  onProvisionalReceipt: () => void;
  onHold: () => void;
  onCourse: () => void;
  onKitchenMessage: () => void;
  onSetTable: () => void;
  onSetTab: () => void;
  onSend: () => void;
  onPayment: () => void;
  showSend: boolean;
};

function lineExtrasLabel(l: CartLine) {
  const parts: string[] = [];
  if (l.comboSelections.length) {
    parts.push(
      ...l.comboSelections.map((c) =>
        c.selectedExtras?.length
          ? `${c.productName} (${c.selectedExtras.map((e) => e.name).join(', ')})`
          : c.productName
      )
    );
  }
  if (!l.comboSelections.length && l.selectedExtras.length) {
    parts.push(...l.selectedExtras.map((e) => e.name));
  } else if (l.comboSelections.length && l.selectedExtras.length) {
    parts.push(...l.selectedExtras.map((e) => e.name));
  }
  return parts.join(' ù ');
}

export default function WebPosCartPanel({
  cart,
  totals,
  taxRate,
  money,
  expanded,
  selectedLineId,
  onSelectLine,
  keypadMode,
  onKeypadModeChange,
  keypadBuffer,
  onKeypadBufferChange,
  onKeypadApply,
  channel,
  onChannelChange,
  activeCourse,
  coursesEnabled,
  orderNote,
  tableLabel,
  tabNumber,
  customerLabel,
  busy,
  onCustomer,
  onNote,
  onProvisionalReceipt,
  onHold,
  onCourse,
  onKitchenMessage,
  onSetTable,
  onSetTab,
  onSend,
  onPayment,
  showSend,
}: Props) {
  const { t } = useI18n();
  const channels: Array<{ id: PosChannel; label: string }> = [
    { id: 'takeaway', label: t('takeaway') },
    { id: 'dine_in', label: t('dineIn') },
    { id: 'delivery', label: t('delivery') },
  ];

  if (!expanded) {
    return (
      <aside className="webpos-cart-panel webpos-cart-panel--mini flex w-[4.5rem] shrink-0 flex-col border-r border-stone-200 bg-white lg:w-[5.5rem]">
        <div className="flex flex-1 flex-col items-center justify-end gap-2 p-2 pb-3">
          {coursesEnabled ? (
            <button
              type="button"
              onClick={onCourse}
              className="webpos-action-chip w-full"
              title={t('webPosCourse')}
            >
              {t('webPosCourse')}
            </button>
          ) : null}
          <div className="mt-auto w-full space-y-1">
            <p className="text-center text-[9px] font-semibold uppercase tracking-wide text-stone-400">
              {t('webPosOrderType')}
            </p>
            {channels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onChannelChange(c.id)}
                className={`w-full rounded-lg px-1 py-1.5 text-[10px] font-semibold leading-tight ${
                  channel === c.id
                    ? 'bg-teal-600 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="webpos-cart-panel flex w-full shrink-0 flex-col border-r border-stone-200 bg-white lg:w-[min(22rem,34vw)]">
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
        {cart.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400">{t('webPosTapProducts')}</p>
        ) : (
          <ul className="space-y-1">
            {cart.map((l) => {
              const selected = selectedLineId === l.lineId;
              const extras = lineExtrasLabel(l);
              return (
                <li key={l.lineId}>
                  <button
                    type="button"
                    onClick={() => onSelectLine(selected ? null : l.lineId)}
                    className={`w-full rounded-lg px-2 py-2 text-left transition ${
                      selected ? 'bg-teal-50 ring-2 ring-teal-400' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">
                          <span className="tabular-nums">{l.quantity}</span> {l.name}
                          {l.courseNumber && coursesEnabled ? (
                            <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] font-bold text-violet-700">
                              C{l.courseNumber}
                            </span>
                          ) : null}
                        </p>
                        {extras ? (
                          <p className="mt-0.5 text-[11px] text-stone-500">- {extras}</p>
                        ) : null}
                        {l.lineDiscountPercent ? (
                          <p className="text-[11px] font-medium text-teal-700">
                            -{l.lineDiscountPercent}%
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {money(l.lineTotal)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-stone-100 px-3 py-2">
        <div className="space-y-0.5 text-sm">
          <div className="flex justify-between text-stone-500">
            <span>{t('webPosTax').replace('{rate}', String(taxRate))}</span>
            <span className="tabular-nums">{money(totals.tax)}</span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>{t('webPosTotal')}</span>
            <span className="tabular-nums">{money(totals.total)}</span>
          </div>
        </div>
        {(customerLabel || orderNote || tableLabel || tabNumber) && (
          <div className="mt-2 space-y-0.5 text-[11px] text-stone-500">
            {customerLabel ? <p>{t('webPosCustomer')}: {customerLabel}</p> : null}
            {tableLabel ? <p>{t('table')}: {tableLabel}</p> : null}
            {tabNumber ? <p>{t('webPosTab')}: {tabNumber}</p> : null}
            {orderNote ? <p>{t('webPosNote')}: {orderNote}</p> : null}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-stone-100 px-2 py-2">
        <div className="grid grid-cols-4 gap-1">
          <button type="button" className="webpos-mini-btn" onClick={onCustomer} title={t('webPosCustomer')}>
            <User size={14} />
            <span>{t('webPosCustomerShort')}</span>
          </button>
          <button type="button" className="webpos-mini-btn" onClick={onNote} title={t('webPosNote')}>
            <MessageSquare size={14} />
            <span>{t('webPosNote')}</span>
          </button>
          <button
            type="button"
            className="webpos-mini-btn"
            onClick={onProvisionalReceipt}
            title={t('webPosProvisionalReceipt')}
          >
            <Printer size={14} />
            <span>{t('webPosProvisionalShort')}</span>
          </button>
          <button
            type="button"
            className="webpos-mini-btn"
            onClick={onHold}
            disabled={!cart.length || busy}
            title={t('webPosHoldOrder')}
          >
            <ArrowUpFromLine size={14} />
          </button>
        </div>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {coursesEnabled ? (
            <button type="button" className="webpos-mini-btn col-span-1" onClick={onCourse}>
              {t('webPosCourse')} {activeCourse}
            </button>
          ) : null}
          <button type="button" className="webpos-mini-btn" onClick={onKitchenMessage}>
            MSG
          </button>
          <button type="button" className="webpos-mini-btn" aria-label={t('webPosMoreActions')}>
            <MoreVertical size={14} />
          </button>
        </div>
      </div>

      {cart.length > 0 ? (
        <div className="shrink-0 border-t border-stone-100 bg-stone-50 px-2 py-2">
          <WebPosNumericKeypad
            mode={keypadMode}
            onModeChange={onKeypadModeChange}
            buffer={keypadBuffer}
            onBufferChange={onKeypadBufferChange}
            onApply={onKeypadApply}
            disabled={!selectedLineId}
          />
        </div>
      ) : null}

      <div className="shrink-0 grid grid-cols-[1fr_1fr_1.4fr] gap-1.5 border-t border-stone-200 bg-white p-2">
        {showSend ? (
          <button
            type="button"
            disabled={!cart.length || busy}
            onClick={onSend}
            className="col-span-2 rounded-lg bg-violet-700 py-3 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-40"
          >
            {t('webPosSend')}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={!cart.length || busy}
              onClick={onSetTable}
              className="rounded-lg bg-violet-700 py-3 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-40"
            >
              {tableLabel || t('webPosSetTable')}
            </button>
            <button
              type="button"
              disabled={!cart.length || busy}
              onClick={onSetTab}
              className="rounded-lg bg-violet-700 py-3 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-40"
            >
              {tabNumber ? `#${tabNumber}` : t('webPosSetTab')}
            </button>
          </>
        )}
        <button
          type="button"
          disabled={!cart.length || busy}
          onClick={onPayment}
          className="rounded-lg bg-stone-200 py-3 text-sm font-bold text-stone-800 hover:bg-stone-300 disabled:opacity-40"
        >
          {t('webPosPayment')}
        </button>
      </div>
    </aside>
  );
}
