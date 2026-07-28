import type { ShopChannel } from '@/lib/shop-cart';

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
  onConfirm: () => void;
  onClose?: () => void;
  dismissible?: boolean;
};

/**
 * Compact modal for choosing pickup / delivery / dine-in (start popup or checkout).
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
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/40"
        aria-label="Dismiss"
        onClick={() => {
          if (dismissible) onClose?.();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-channel-prompt-title"
        className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl px-5 pt-4 pb-6 space-y-4"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-stone-200 sm:hidden" />
        <div>
          <h2 id="shop-channel-prompt-title" className="text-lg font-bold tracking-tight text-stone-900">
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-sm text-stone-500 leading-snug">{subtitle}</p> : null}
        </div>
        <div className="space-y-2">
          {options.map((opt) => {
            const on = selected === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelect(opt.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  on
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-white text-stone-900 hover:border-stone-400'
                }`}
              >
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className={`block text-xs mt-0.5 ${on ? 'text-white/75' : 'text-stone-500'}`}>
                  {opt.etaMinutes}–{opt.etaMinutes + 10} min
                  {opt.todayLabel ? ` · ${opt.todayLabel}` : ''}
                  {!opt.open ? ' · closed now' : ''}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onConfirm}
          className="w-full rounded-full bg-stone-900 py-3.5 text-sm font-semibold text-white hover:bg-stone-800"
        >
          {confirmLabel}
        </button>
        {dismissible && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-sm font-medium text-stone-500 hover:text-stone-800"
          >
            Continue browsing
          </button>
        ) : null}
      </div>
    </div>
  );
}
