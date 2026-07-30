import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  buildScheduleDays,
  type ScheduleDayOption,
  type StoreHours,
} from '@/lib/shop-hours';

export type FulfillmentWhen = {
  mode: 'asap' | 'later';
  scheduledFor: string | null;
  label: string;
};

type Props = {
  open: boolean;
  channel: 'takeaway' | 'delivery';
  storeHours?: StoreHours | null;
  leadMinutes?: number;
  onClose: () => void;
  onConfirm: (when: FulfillmentWhen) => void;
};

export default function WebPosFulfillmentModal({
  open,
  channel,
  storeHours,
  leadMinutes = 20,
  onClose,
  onConfirm,
}: Props) {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<'asap' | 'later'>('asap');
  const [dayOffset, setDayOffset] = useState(0);
  const [slotValue, setSlotValue] = useState<string | null>(null);

  const days: ScheduleDayOption[] = useMemo(
    () =>
      buildScheduleDays({
        storeHours,
        channel,
        leadMinutes,
        horizonDays: 1,
        locale: locale === 'fr' ? 'fr-CH' : locale === 'de' ? 'de-CH' : 'en-CH',
      }),
    [storeHours, channel, leadMinutes, locale]
  );

  useEffect(() => {
    if (!open) return;
    setMode('asap');
    setDayOffset(days[0]?.offset ?? 0);
    setSlotValue(days[0]?.slots[0]?.value ?? null);
  }, [open, days]);

  if (!open) return null;

  const activeDay = days.find((d) => d.offset === dayOffset) || days[0];
  const title =
    channel === 'delivery' ? t('webPosWhenDelivery') : t('webPosWhenPickup');

  const confirm = () => {
    if (mode === 'asap') {
      onConfirm({ mode: 'asap', scheduledFor: null, label: t('webPosAsap') });
      return;
    }
    if (!slotValue) return;
    const slot = activeDay?.slots.find((s) => s.value === slotValue);
    onConfirm({
      mode: 'later',
      scheduledFor: slotValue,
      label: `${activeDay?.label || ''} ${slot?.label || ''}`.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/45 p-3">
      <div className="w-full max-w-md rounded-2xl bg-[var(--bg-elevated)] shadow-xl border border-[var(--border)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-xl border py-3 text-sm font-semibold ${
                mode === 'asap'
                  ? 'border-teal-600 bg-teal-50 text-teal-900'
                  : 'border-[var(--border)]'
              }`}
              onClick={() => setMode('asap')}
            >
              {t('webPosAsap')}
            </button>
            <button
              type="button"
              className={`rounded-xl border py-3 text-sm font-semibold ${
                mode === 'later'
                  ? 'border-teal-600 bg-teal-50 text-teal-900'
                  : 'border-[var(--border)]'
              }`}
              onClick={() => setMode('later')}
              disabled={!days.length}
            >
              {t('webPosLater')}
            </button>
          </div>

          {mode === 'later' && (
            <>
              <div className="flex gap-2">
                {days.map((d) => (
                  <button
                    key={d.offset}
                    type="button"
                    onClick={() => {
                      setDayOffset(d.offset);
                      setSlotValue(d.slots[0]?.value ?? null);
                    }}
                    className={`flex-1 rounded-xl border px-2 py-2 text-sm ${
                      dayOffset === d.offset
                        ? 'border-teal-600 bg-teal-50 font-semibold'
                        : 'border-[var(--border)]'
                    }`}
                  >
                    <div>{d.offset === 0 ? t('reportsToday') : t('webPosTomorrow')}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{d.dateLabel}</div>
                  </button>
                ))}
              </div>
              {!activeDay?.slots.length ? (
                <p className="text-sm muted">{t('webPosNoSlots')}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {activeDay.slots.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSlotValue(s.value)}
                      className={`rounded-lg border py-2 text-sm tabular-nums ${
                        slotValue === s.value
                          ? 'border-teal-600 bg-teal-50 font-semibold'
                          : 'border-[var(--border)]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex gap-2 border-t border-[var(--border)] p-4">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={mode === 'later' && !slotValue}
            onClick={confirm}
          >
            {t('webPosContinue')}
          </button>
        </div>
      </div>
    </div>
  );
}
