import { useEffect, useMemo, useState } from 'react';
import type { ShopChannel } from '@/lib/shop-cart';
import { buildScheduleDays, type StoreHours } from '@/lib/shop-hours';
import { useI18n } from '@/lib/i18n';

type ChannelOption = {
  id: ShopChannel;
  label: string;
  etaMinutes: number;
  open: boolean;
  todayLabel?: string;
};

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  options: ChannelOption[];
  selected: ShopChannel;
  confirmLabel: string;
  onSelect: (channel: ShopChannel) => void;
  onConfirm: (payload: { channel: ShopChannel; scheduledFor: string | null }) => void;
  onClose?: () => void;
  dismissible?: boolean;
  /** When true, show date/time picker like modern food apps */
  withSchedule?: boolean;
  storeHours?: StoreHours | null;
  scheduledFor?: string | null;
};

/**
 * Compact modal for choosing pickup / delivery / dine-in (+ optional schedule).
 */
export default function ShopChannelPrompt({
  open,
  title,
  subtitle,
  options,
  selected,
  confirmLabel,
  onSelect,
  onConfirm,
  onClose,
  dismissible = true,
  withSchedule = false,
  storeHours,
  scheduledFor,
}: Props) {
  const { t, locale } = useI18n();
  const [dayOffset, setDayOffset] = useState(0);
  const [slotValue, setSlotValue] = useState<string | null>(null);
  const [showAllSlots, setShowAllSlots] = useState(false);

  const shopLocale = locale === 'fr' ? 'fr-CH' : locale === 'de' ? 'de-CH' : 'en-CH';
  const eta = options.find((o) => o.id === selected)?.etaMinutes || 30;

  const scheduleDays = useMemo(() => {
    if (!withSchedule) return [];
    return buildScheduleDays({
      storeHours: storeHours || null,
      channel: selected,
      leadMinutes: Math.max(15, eta),
      intervalMinutes: 15,
      horizonDays: 2,
      locale: shopLocale,
    });
  }, [withSchedule, storeHours, selected, eta, shopLocale]);

  useEffect(() => {
    if (!open || !withSchedule) return;
    setShowAllSlots(false);
    const preferred =
      scheduleDays.find((d) => d.offset === dayOffset) ||
      scheduleDays[0] ||
      null;
    setDayOffset(preferred?.offset ?? 0);
    const match = preferred?.slots.find((s) => s.value === scheduledFor);
    setSlotValue(match?.value || preferred?.slots[0]?.value || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected, withSchedule, scheduleDays.length]);

  if (!open) return null;

  const activeDay = scheduleDays.find((d) => d.offset === dayOffset) || scheduleDays[0];
  const visibleSlots = showAllSlots ? activeDay?.slots || [] : (activeDay?.slots || []).slice(0, 8);
  const hiddenCount = Math.max(0, (activeDay?.slots.length || 0) - visibleSlots.length);
  const channelOpen = options.find((o) => o.id === selected)?.open;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/45"
        aria-label="Dismiss"
        onClick={() => {
          if (dismissible) onClose?.();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl px-4 pt-3 pb-5 space-y-4 max-h-[92dvh] overflow-y-auto"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-stone-200 sm:hidden" />
        {dismissible && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white text-sm font-bold"
            aria-label={t('shopClose')}
          >
            ×
          </button>
        ) : null}

        <div className="pr-8">
          <h2 className="text-lg font-bold tracking-tight text-stone-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-stone-500 leading-snug">{subtitle}</p> : null}
        </div>

        <div className={`grid gap-2 ${options.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {options.map((opt) => {
            const on = selected === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelect(opt.id)}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  on
                    ? 'border-amber-700/40 bg-amber-700 text-white'
                    : 'border-stone-200 bg-white text-stone-900 hover:border-stone-400'
                }`}
              >
                <span className="block text-sm font-semibold">
                  {on ? '✓ ' : ''}
                  {opt.label}
                </span>
                <span className={`block text-[11px] mt-0.5 ${on ? 'text-white/80' : 'text-stone-500'}`}>
                  {opt.etaMinutes}-{opt.etaMinutes + 10} {t('shopMins')}
                </span>
              </button>
            );
          })}
        </div>

        {withSchedule ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-stone-800">
              {selected === 'delivery' ? t('shopDateTimeDelivery') : t('shopDateTimePickup')}
            </p>
            <div className="flex flex-wrap gap-2">
              {scheduleDays.map((d) => (
                <button
                  key={d.offset}
                  type="button"
                  onClick={() => {
                    setDayOffset(d.offset);
                    setSlotValue(d.slots[0]?.value || null);
                    setShowAllSlots(false);
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium border ${
                    dayOffset === d.offset
                      ? 'bg-amber-700 text-white border-amber-700'
                      : 'bg-white text-stone-700 border-stone-200'
                  }`}
                >
                  {d.offset === 0
                    ? t('shopToday')
                    : d.offset === 1
                      ? t('shopTomorrow')
                      : d.dateLabel}
                </button>
              ))}
              {!scheduleDays.length ? (
                <span className="text-sm text-rose-600 font-medium">{t('shopClosedThisDay')}</span>
              ) : null}
            </div>

            {channelOpen && dayOffset === 0 ? (
              <button
                type="button"
                onClick={() => setSlotValue(null)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium border ${
                  slotValue == null
                    ? 'bg-amber-700 text-white border-amber-700'
                    : 'bg-white text-stone-700 border-stone-200'
                }`}
              >
                {t('shopAsap')}
              </button>
            ) : null}

            {!channelOpen && dayOffset === 0 && !activeDay?.slots.length ? (
              <p className="text-sm font-medium text-rose-600">{t('shopClosedThisDay')}</p>
            ) : null}

            {visibleSlots.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {visibleSlots.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSlotValue(s.value)}
                    className={`rounded-lg border py-2 text-sm font-semibold tabular-nums ${
                      slotValue === s.value
                        ? 'bg-amber-700 text-white border-amber-700'
                        : 'bg-white text-stone-800 border-stone-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ) : null}

            {hiddenCount > 0 ? (
              <button
                type="button"
                className="text-sm font-medium text-sky-700 underline"
                onClick={() => setShowAllSlots(true)}
              >
                {t('shopMoreSlots').replace('{n}', String(hiddenCount))}
              </button>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() =>
            onConfirm({
              channel: selected,
              scheduledFor: withSchedule ? slotValue : null,
            })
          }
          className="w-full rounded-xl bg-amber-700 py-3.5 text-sm font-semibold text-white hover:bg-amber-800"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
