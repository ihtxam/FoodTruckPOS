import {
  ArrowLeftRight,
  MessageSquare,
  Printer,
  User,
} from 'lucide-react';
import { useMemo } from 'react';
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
  channel: PosChannel | null;
  onChannelChange: (ch: PosChannel) => void;
  activeCourse: number;
  coursesEnabled: boolean;
  courseNumbers: number[];
  onSelectCourse: (course: number) => void;
  orderNote?: string;
  tableLabel?: string | null;
  tabNumber?: string | null;
  customerLabel?: string | null;
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
  showSend: boolean;
  hideTab: boolean;
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

type CartRow =
  | { kind: 'course'; course: number }
  | { kind: 'line'; line: CartLine };

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
  showSend,
  hideTab,
}: Props) {
  const { t } = useI18n();
  const hasItems = cart.length > 0;
  const keypadExpanded = hasItems;

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
    const unassigned = cart.filter((l) => !l.courseNumber);
    for (const line of unassigned) {
      out.push({ kind: 'line', line });
    }
    return out;
  }, [cart, courseNumbers, coursesEnabled]);

  return (
    <aside className="webpos-cart-panel flex w-full shrink-0 flex-col border-r border-stone-200 bg-white lg:w-[min(22rem,34vw)]">
      {/* Channel: Takeaway / Delivery above cart */}
      <div className="shrink-0 grid grid-cols-2 gap-1.5 border-b border-stone-100 px-2 py-2">
        {(
          [
            ['takeaway', t('takeaway')],
            ['delivery', t('delivery')],
          ] as const
        ).map(([id, label]) => (
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
            {label}
          </button>
        ))}
      </div>

      {/* Action / breadcrumb row */}
      <div className="shrink-0 grid grid-cols-4 gap-1 border-b border-stone-100 px-2 py-1.5">
        <button type="button" className="webpos-mini-btn" onClick={onCustomer} title={t('webPosCustomer')}>
          <User size={14} />
          <span>{customerLabel || t('webPosAddClient')}</span>
        </button>
        <button
          type="button"
          className="webpos-mini-btn"
          onClick={onProvisionalReceipt}
          disabled={!hasItems || busy}
          title={t('webPosProvisionalReceipt')}
        >
          <Printer size={14} />
          <span>{t('webPosProvisionalShort')}</span>
        </button>
        <button
          type="button"
          className="webpos-mini-btn"
          onClick={onToggleChannel}
          title={t('webPosConvertChannel')}
        >
          <ArrowLeftRight size={14} />
          <span>
            {channel === 'dine_in' ? t('takeaway') : t('dineIn')}
          </span>
        </button>
        <button
          type="button"
          className="webpos-mini-btn"
          onClick={onKitchenMessage}
          title={t('webPosKitchenMessage')}
        >
          <MessageSquare size={14} />
          <span>{t('webPosMsgShort')}</span>
        </button>
      </div>

      {(tableLabel || tabNumber || orderNote || channel === 'dine_in') && (
        <div className="shrink-0 flex flex-wrap items-center gap-1.5 border-b border-stone-100 px-3 py-1.5 text-[11px] text-stone-500">
          {channel === 'dine_in' ? (
            <span className="rounded bg-sky-100 px-1.5 py-0.5 font-semibold text-sky-800">
              {t('dineIn')}
            </span>
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
                      className={`w-full rounded-md px-2 py-1.5 text-left text-xs font-bold uppercase tracking-wide ${
                        selected
                          ? 'bg-violet-600 text-white'
                          : 'bg-violet-50 text-violet-800 hover:bg-violet-100'
                      }`}
                    >
                      {t('webPosCourse')} {row.course}
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

      {/* Keypad: minimized when empty, expanded after first product */}
      <div
        className={`shrink-0 border-t border-stone-100 bg-stone-50 transition-all ${
          keypadExpanded ? 'px-2 py-2' : 'px-2 py-1'
        }`}
      >
        {coursesEnabled ? (
          <div className="mb-1.5">
            <button
              type="button"
              className="w-full rounded-lg bg-violet-100 py-2 text-xs font-bold uppercase tracking-wide text-violet-900 ring-1 ring-violet-300 hover:bg-violet-200"
              onClick={onCourse}
              disabled={!hasItems}
            >
              {t('webPosCourse')} ù {activeCourse}
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
            disabled={!selectedLineId}
          />
        ) : (
          <p className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-stone-400">
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
        ) : showSend || hideTab || orderSent ? (
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
