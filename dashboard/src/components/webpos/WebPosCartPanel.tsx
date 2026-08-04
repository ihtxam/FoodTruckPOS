import {
  ArrowLeftRight,
  Ban,
  MessageSquare,
  MoreHorizontal,
  Printer,
  User,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import WebPosNumericKeypad from './WebPosNumericKeypad';
import type { CartLine, KeypadMode, PosChannel } from './types';

type Props = {
  cart: CartLine[];
  totals: { subtotal: number; tax: number; rounding: number; total: number };
  taxRate: number;
  money: (n: number) => string;
  selectedLineId: string | null;
  onSelectLine: (lineId: string | null) => void;
  keypadMode: KeypadMode;
  onKeypadModeChange: (mode: KeypadMode) => void;
  keypadBuffer: string;
  onKeypadBufferChange: (buf: string) => void;
  onKeypadApply: () => void;
  onKeypadAdjust: (delta: number) => void;
  onKeypadBackspace: () => void;
  channel: PosChannel | null;
  onChannelChange: (ch: 'takeaway' | 'delivery') => void;
  activeCourse: number;
  coursesEnabled: boolean;
  courseNumbers: number[];
  onSelectCourse: (course: number) => void;
  orderNote?: string;
  tableLabel?: string | null;
  tabNumber?: string | null;
  customerLabel?: string | null;
  fulfillmentLabel?: string | null;
  fulfillmentIsLater?: boolean;
  busy: boolean;
  orderSent: boolean;
  showNewOrder: boolean;
  sendLabel: string;
  onCustomer: () => void;
  onProvisionalReceipt: () => void;
  onToggleChannel: () => void;
  onCourse: () => void;
  onKitchenMessage: () => void;
  onSetTable: () => void;
  onSetTab: () => void;
  onSend: () => void;
  onNewOrder: () => void;
  onPayment: () => void;
  onCancelOrder: () => void;
  onCancelItem: () => void;
  onPayLater: () => void;
  onEditFulfillment?: () => void;
  showSend: boolean;
  hideTab: boolean;
  canCancelOrder: boolean;
  canCancelItem: boolean;
  /** Cart docked left or right of product grid */
  dockSide?: 'left' | 'right';
  /** Show Takeaway / Delivery channel tabs (retail may disable). */
  showChannelTabs?: boolean;
  /** Which fulfillment channels appear when tabs are shown. */
  channelTabOptions?: Array<'takeaway' | 'delivery'>;
  /** Kitchen message, SEND, set table — restaurant only. */
  kitchenEnabled?: boolean;
  /** Hold current cart without kitchen send (retail / direct sale). */
  onHoldOrder?: () => void;
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
  return parts.join(', ');
}

type CartRow =
  | { kind: 'course'; course: number }
  | { kind: 'line'; line: CartLine };

function nextChannelLabel(
  channel: PosChannel | null,
  t: (k: string) => string
): string {
  if (channel === 'takeaway') return t('delivery');
  if (channel === 'delivery') return t('dineIn');
  return t('takeaway');
}

function currentChannelLabel(
  channel: PosChannel | null,
  t: (k: string) => string
): string {
  if (channel === 'delivery') return t('delivery');
  if (channel === 'dine_in') return t('dineIn');
  if (channel === 'takeaway') return t('takeaway');
  return t('webPosOrderType');
}

export default function WebPosCartPanel({
  cart,
  totals,
  taxRate,
  money,
  selectedLineId,
  onSelectLine,
  keypadMode,
  onKeypadModeChange,
  keypadBuffer,
  onKeypadBufferChange,
  onKeypadApply,
  onKeypadAdjust,
  onKeypadBackspace,
  channel,
  onChannelChange,
  activeCourse,
  coursesEnabled,
  courseNumbers,
  onSelectCourse,
  orderNote,
  tableLabel,
  tabNumber,
  customerLabel,
  fulfillmentLabel,
  fulfillmentIsLater,
  busy,
  orderSent,
  showNewOrder,
  sendLabel,
  onCustomer,
  onProvisionalReceipt,
  onToggleChannel,
  onCourse,
  onKitchenMessage,
  onSetTable,
  onSetTab,
  onSend,
  onNewOrder,
  onPayment,
  onCancelOrder,
  onCancelItem,
  onPayLater,
  onEditFulfillment,
  showSend,
  hideTab,
  canCancelOrder,
  canCancelItem,
  dockSide = 'right',
  showChannelTabs = true,
  channelTabOptions = ['takeaway', 'delivery'],
  kitchenEnabled = true,
  onHoldOrder,
}: Props) {
  const { t } = useI18n();
  const hasItems = cart.length > 0;
  const keypadExpanded = hasItems;
  const effectiveShowSend = kitchenEnabled && showSend;
  const channelOptions =
    channelTabOptions.length > 0 ? channelTabOptions : (['takeaway', 'delivery'] as const);
  const [moreOpen, setMoreOpen] = useState(false);
  const sideBorder = dockSide === 'right' ? 'border-l' : 'border-r';

  const rows = useMemo(() => {
    if (!coursesEnabled || courseNumbers.length === 0) {
      return cart.map((line) => ({ kind: 'line' as const, line }));
    }
    const out: CartRow[] = [];
    for (const course of courseNumbers) {
      out.push({ kind: 'course', course });
      for (const line of cart.filter((l) => (l.courseNumber || 1) === course)) {
        out.push({ kind: 'line', line });
      }
    }
    return out;
  }, [cart, courseNumbers, coursesEnabled]);

  return (
    <aside
      className={`webpos-cart-panel flex w-full shrink-0 flex-col ${sideBorder} border-stone-200 bg-white lg:w-[min(22rem,34vw)]`}
    >
      {/* Channel: Takeaway / Delivery above cart */}
      {showChannelTabs ? (
        <div
          className={`shrink-0 grid gap-1.5 border-b border-stone-100 px-2 py-2 ${
            channelOptions.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {channelOptions.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onChannelChange(id)}
              className={`rounded-lg px-2 py-2 text-xs font-bold uppercase tracking-wide ${
                channel === id
                  ? 'bg-[var(--webpos-accent)] text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {id === 'delivery' ? t('delivery') : t('takeaway')}
            </button>
          ))}
        </div>
      ) : null}

      {/* Compact breadcrumb / overflow menu (Android CartOrderMenuButton pattern) */}
      <div className="relative shrink-0 border-b border-stone-100 px-2 py-1.5">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-left hover:bg-stone-100"
          onClick={() => setMoreOpen((v) => !v)}
          title={t('webPosMoreActions')}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-stone-600 ring-1 ring-stone-200">
            <MoreHorizontal size={16} aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] font-semibold text-stone-600">
            <span className="truncate">{customerLabel || t('webPosAddClient')}</span>
            <span className="shrink-0 text-stone-300" aria-hidden>
              /
            </span>
            <span className="truncate">{currentChannelLabel(channel, t)}</span>
            {tableLabel ? (
              <>
                <span className="shrink-0 text-stone-300" aria-hidden>
                  /
                </span>
                <span className="truncate">
                  {t('table')} {tableLabel}
                </span>
              </>
            ) : null}
          </span>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-stone-400">
            {t('webPosMoreShort')}
          </span>
        </button>
        {moreOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-10 cursor-default"
              aria-label={t('close')}
              onClick={() => setMoreOpen(false)}
            />
            <div
              role="menu"
              className="absolute left-2 right-2 top-full z-20 mt-1 rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50"
                onClick={() => {
                  setMoreOpen(false);
                  onCustomer();
                }}
              >
                <User size={14} className="shrink-0 text-stone-500" />
                <span className="truncate">{customerLabel || t('webPosAddClient')}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                disabled={!hasItems || busy}
                onClick={() => {
                  setMoreOpen(false);
                  onProvisionalReceipt();
                }}
              >
                <Printer size={14} className="shrink-0 text-stone-500" />
                {t('webPosProvisionalReceipt')}
              </button>
              {showChannelTabs || kitchenEnabled ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  title={t('webPosConvertChannel')}
                  onClick={() => {
                    setMoreOpen(false);
                    onToggleChannel();
                  }}
                >
                  <ArrowLeftRight size={14} className="shrink-0 text-stone-500" />
                  <span className="min-w-0 truncate">
                    {t('webPosConvertChannel')}
                    <span className="ml-1 font-bold text-stone-500">
                      ({nextChannelLabel(channel, t)})
                    </span>
                  </span>
                </button>
              ) : null}
              {kitchenEnabled ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  onClick={() => {
                    setMoreOpen(false);
                    onKitchenMessage();
                  }}
                >
                  <MessageSquare size={14} className="shrink-0 text-stone-500" />
                  {t('webPosKitchenMessage')}
                </button>
              ) : null}
              {onHoldOrder ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                  disabled={!hasItems || busy}
                  onClick={() => {
                    setMoreOpen(false);
                    onHoldOrder();
                  }}
                >
                  {t('webPosHoldOrder')}
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                disabled={!hasItems || busy || channel === 'dine_in' || !channel}
                onClick={() => {
                  setMoreOpen(false);
                  onPayLater();
                }}
              >
                {t('webPosPayLater')}
              </button>
              <div className="my-1 border-t border-stone-100" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                disabled={!canCancelItem || busy}
                onClick={() => {
                  setMoreOpen(false);
                  onCancelItem();
                }}
              >
                <Ban size={14} className="shrink-0" />
                {t('webPosCancelItem')}
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                disabled={!canCancelOrder || busy}
                onClick={() => {
                  setMoreOpen(false);
                  onCancelOrder();
                }}
              >
                <Ban size={14} className="shrink-0" />
                {t('webPosCancelOrder')}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {(tableLabel ||
        tabNumber ||
        orderNote ||
        channel === 'dine_in' ||
        fulfillmentLabel ||
        channel === 'takeaway' ||
        channel === 'delivery') && (
        <div className="shrink-0 flex flex-wrap items-center gap-1.5 border-b border-stone-100 px-3 py-1.5 text-[11px] text-stone-500">
          {channel === 'dine_in' ? (
            <span className="rounded bg-sky-100 px-1.5 py-0.5 font-semibold text-sky-800">
              {t('dineIn')}
            </span>
          ) : null}
          {channel === 'takeaway' || channel === 'delivery' ? (
            <>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">
                {channel === 'delivery' ? t('delivery') : t('takeaway')}
                {': '}
                {fulfillmentIsLater && fulfillmentLabel
                  ? fulfillmentLabel
                  : t('webPosAsap')}
              </span>
              <button
                type="button"
                onClick={onEditFulfillment}
                className="text-[11px] font-semibold text-[var(--webpos-accent)] underline underline-offset-2 hover:opacity-80"
                title={t('webPosChooseTime')}
              >
                {t('webPosChooseTime')}
              </button>
            </>
          ) : null}
          {tableLabel ? (
            <span className="rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-800">
              {t('table')} {tableLabel}
            </span>
          ) : null}
          {tabNumber ? (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">
              {t('webPosTab')} #{tabNumber}
            </span>
          ) : null}
          {orderNote ? <span className="truncate">{orderNote}</span> : null}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
        {!hasItems ? (
          <p className="py-8 text-center text-sm text-stone-400">{t('webPosTapProducts')}</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((row) => {
              if (row.kind === 'course') {
                const selected = activeCourse === row.course;
                return (
                  <li key={`course-${row.course}`}>
                    <button
                      type="button"
                      onClick={() => onSelectCourse(row.course)}
                      aria-pressed={selected}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-xs font-bold uppercase tracking-wide ${
                        selected
                          ? 'bg-violet-600 text-white ring-2 ring-violet-300 ring-offset-1'
                          : 'bg-violet-50 text-violet-800 hover:bg-violet-100'
                      }`}
                    >
                      {t('webPosCourse')} {row.course}
                      {selected ? (
                        <span className="ml-2 text-[10px] font-semibold normal-case tracking-normal opacity-90">
                          - {t('webPosCourseActive')}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              }
              const l = row.line;
              const selected = selectedLineId === l.lineId;
              const extras = lineExtrasLabel(l);
              return (
                <li key={l.lineId}>
                  <button
                    type="button"
                    onClick={() => onSelectLine(selected ? null : l.lineId)}
                    className={`w-full rounded-lg px-2 py-2 text-left transition ${
                      selected
                        ? 'bg-[var(--webpos-accent-softer)] ring-2 ring-[var(--webpos-accent-ring)]'
                        : 'hover:bg-stone-50'
                    } ${l.sentToKitchen ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">
                          <span className="tabular-nums">{l.quantity}</span> {l.name}
                          {l.sentToKitchen ? (
                            <span className="ml-1 rounded bg-stone-200 px-1 text-[9px] font-bold uppercase text-stone-600">
                              {t('webPosSentBadge')}
                            </span>
                          ) : null}
                        </p>
                        {extras ? (
                          <p className="mt-0.5 text-[11px] text-stone-500">- {extras}</p>
                        ) : null}
                        {l.lineDiscountPercent ? (
                          <p className="text-[11px] font-medium text-[var(--webpos-accent-text)]">
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
      </div>

      {/* Keypad: compact, docked at bottom for more cart space */}
      <div
        className={`shrink-0 border-t border-stone-100 bg-stone-50 transition-all ${
          keypadExpanded ? 'px-1.5 py-1' : 'px-1.5 py-0.5'
        }`}
      >
        {coursesEnabled ? (
          <div className="mb-1">
            <p className="mb-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-violet-700">
              {t('webPosCourse')} {activeCourse} - {t('webPosCourseActive')}
            </p>
            <button
              type="button"
              className="w-full rounded-md bg-violet-600 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-violet-700 disabled:opacity-40"
              onClick={onCourse}
              disabled={!hasItems}
              title={t('webPosAddNextCourse')}
            >
              + {t('webPosAddNextCourse')}
            </button>
          </div>
        ) : null}
        {keypadExpanded ? (
          <WebPosNumericKeypad
            mode={keypadMode}
            onModeChange={onKeypadModeChange}
            buffer={keypadBuffer}
            onBufferChange={onKeypadBufferChange}
            onApply={onKeypadApply}
            onAdjust={onKeypadAdjust}
            onBackspace={onKeypadBackspace}
            disabled={!selectedLineId}
            compact
            hideApply
          />
        ) : (
          <p className="py-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-stone-400">
            {t('webPosKeypadMinimized')}
          </p>
        )}
      </div>

      <div className="shrink-0 grid grid-cols-[1fr_1fr_1.4fr] gap-1.5 border-t border-stone-200 bg-white p-2">
        {showNewOrder ? (
          <button
            type="button"
            disabled={busy}
            onClick={onNewOrder}
            className="col-span-2 rounded-lg bg-violet-700 py-3 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-40"
          >
            {t('webPosNew')}
          </button>
        ) : !kitchenEnabled ? (
          <button
            type="button"
            disabled={!hasItems || busy}
            onClick={() => (onHoldOrder ? onHoldOrder() : onNewOrder())}
            className="col-span-2 rounded-lg bg-violet-700 py-3 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-40"
          >
            {onHoldOrder ? t('webPosHoldOrder') : t('webPosNew')}
          </button>
        ) : effectiveShowSend || hideTab || orderSent ? (
          <button
            type="button"
            disabled={!hasItems || busy}
            onClick={onSend}
            className="col-span-2 rounded-lg bg-violet-700 py-3 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-40"
          >
            {sendLabel}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onSetTable}
              className="rounded-lg bg-violet-700 py-3 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-40"
            >
              {tableLabel || t('webPosSetTable')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onSetTab}
              className="rounded-lg bg-violet-700 py-3 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-40"
            >
              {tabNumber ? `#${tabNumber}` : t('webPosSetTab')}
            </button>
          </>
        )}
        <button
          type="button"
          disabled={!hasItems || busy}
          onClick={onPayment}
          className="rounded-lg bg-stone-200 py-3 text-sm font-bold text-stone-800 hover:bg-stone-300 disabled:opacity-40"
        >
          {t('webPosPayment')}
        </button>
      </div>
    </aside>
  );
}
