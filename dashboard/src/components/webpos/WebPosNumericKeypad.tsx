import { Delete } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { KeypadMode } from './types';

type Props = {
  mode: KeypadMode;
  onModeChange: (mode: KeypadMode) => void;
  buffer: string;
  onBufferChange: (buf: string) => void;
  onApply: () => void;
  disabled?: boolean;
  showModeButtons?: boolean;
  showQuickAdd?: boolean;
  applyLabel?: string;
  applyDisabled?: boolean;
  /** Tighter keys for cart panel */
  compact?: boolean;
  hideApply?: boolean;
  /** Cart line adjust: +/- step selected line (qty / % / price) */
  onAdjust?: (delta: number) => void;
  /** Custom backspace (cart: buffer edit → price 0 → delete) */
  onBackspace?: () => void;
};

export default function WebPosNumericKeypad({
  mode,
  onModeChange,
  buffer,
  onBufferChange,
  onApply,
  disabled,
  showModeButtons = true,
  showQuickAdd = false,
  applyLabel,
  applyDisabled,
  compact = false,
  hideApply = false,
  onAdjust,
  onBackspace,
}: Props) {
  const { t } = useI18n();

  const push = (ch: string) => {
    onBufferChange(
      (() => {
        const prev = buffer;
        if (ch === '.' && prev.includes('.')) return prev;
        if (prev === '0' && ch !== '.') return ch;
        if (prev.includes('.') && prev.split('.')[1]!.length >= 2) return prev;
        return (prev + ch).slice(0, 10);
      })()
    );
  };

  const backspace = () => {
    if (onBackspace) {
      onBackspace();
      return;
    }
    onBufferChange(buffer.slice(0, -1));
  };
  const toggleSign = () => {
    if (!buffer || buffer === '0') return;
    onBufferChange(buffer.startsWith('-') ? buffer.slice(1) : `-${buffer}`);
  };

  const numKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const keyClass = compact
    ? 'webpos-keypad-key webpos-keypad-key--compact'
    : 'webpos-keypad-key';

  return (
    <div className={`webpos-keypad ${compact ? 'space-y-1' : 'space-y-2'}`}>
      {showModeButtons ? (
        <div className={`grid grid-cols-3 ${compact ? 'gap-1' : 'gap-1.5'}`}>
          {(
            [
              ['qty', t('webPosKeypadQty')],
              ['percent', t('webPosKeypadPercent')],
              ['price', t('webPosKeypadPrice')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => onModeChange(id)}
              className={`rounded-md text-xs font-bold uppercase tracking-wide transition ${
                compact ? 'py-1' : 'py-2 rounded-lg'
              } ${
                mode === id
                  ? 'bg-[var(--webpos-accent-soft)] text-[var(--webpos-accent-text)] ring-1 ring-[var(--webpos-accent-ring)]'
                  : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className={`grid ${compact ? 'gap-1' : 'gap-1.5'} ${showQuickAdd ? 'grid-cols-[1fr_auto]' : 'grid-cols-1'}`}>
        <div className={`grid grid-cols-3 ${compact ? 'gap-1' : 'gap-1.5'}`}>
          {numKeys.map((k) => (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => push(k)}
              className={keyClass}
            >
              {k}
            </button>
          ))}
          {onAdjust ? (
            <div className={`grid grid-cols-2 ${compact ? 'gap-0.5' : 'gap-1'}`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAdjust(-1)}
                className={`${keyClass} bg-amber-50 text-amber-900 ring-amber-200`}
                aria-label="-"
              >
                −
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAdjust(1)}
                className={`${keyClass} bg-amber-50 text-amber-900 ring-amber-200`}
                aria-label="+"
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={toggleSign}
              className={`${keyClass} bg-amber-50 text-amber-900 ring-amber-200`}
            >
              +/-
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => push('0')}
            className={keyClass}
          >
            0
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => push('.')}
            className={`${keyClass} bg-orange-50 text-orange-900 ring-orange-200`}
          >
            .
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={backspace}
            className={`${keyClass} bg-red-50 text-red-700 ring-red-200`}
            aria-label={t('webPosBackspace')}
          >
            <Delete size={compact ? 15 : 18} className="mx-auto" />
          </button>
        </div>

        {showQuickAdd ? (
          <div className={`flex flex-col ${compact ? 'gap-1' : 'gap-1.5'}`}>
            {[10, 20, 50].map((n) => (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => {
                  const base = Number(buffer) || 0;
                  onBufferChange(String(Math.round((base + n) * 100) / 100));
                }}
                className={`${keyClass} min-w-[3rem] bg-emerald-50 text-emerald-800 ring-emerald-200`}
              >
                +{n}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!hideApply ? (
        <button
          type="button"
          disabled={disabled || applyDisabled}
          onClick={onApply}
          className={`webpos-accent-btn w-full rounded-lg text-sm font-semibold disabled:opacity-40 ${
            compact ? 'py-1.5' : 'py-2'
          }`}
        >
          {applyLabel || t('webPosKeypadApply')}
        </button>
      ) : null}
    </div>
  );
}
