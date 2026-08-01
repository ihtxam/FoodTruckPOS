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

  const backspace = () => onBufferChange(buffer.slice(0, -1));
  const toggleSign = () => {
    if (!buffer || buffer === '0') return;
    onBufferChange(buffer.startsWith('-') ? buffer.slice(1) : `-${buffer}`);
  };

  const numKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="webpos-keypad space-y-2">
      {showModeButtons ? (
        <div className="grid grid-cols-3 gap-1.5">
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
              className={`rounded-lg py-2 text-xs font-bold uppercase tracking-wide transition ${
                mode === id
                  ? 'bg-teal-100 text-teal-900 ring-1 ring-teal-400'
                  : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className={`grid gap-1.5 ${showQuickAdd ? 'grid-cols-[1fr_auto]' : 'grid-cols-1'}`}>
        <div className="grid grid-cols-3 gap-1.5">
          {numKeys.map((k) => (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => push(k)}
              className="webpos-keypad-key"
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={toggleSign}
            className="webpos-keypad-key bg-amber-50 text-amber-900 ring-amber-200"
          >
            +/?
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => push('0')}
            className="webpos-keypad-key"
          >
            0
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => push('.')}
            className="webpos-keypad-key bg-orange-50 text-orange-900 ring-orange-200"
          >
            .
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={backspace}
            className="webpos-keypad-key bg-red-50 text-red-700 ring-red-200"
            aria-label={t('webPosBackspace')}
          >
            <Delete size={18} className="mx-auto" />
          </button>
        </div>

        {showQuickAdd ? (
          <div className="flex flex-col gap-1.5">
            {[10, 20, 50].map((n) => (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => {
                  const base = Number(buffer) || 0;
                  onBufferChange(String(Math.round((base + n) * 100) / 100));
                }}
                className="webpos-keypad-key bg-emerald-50 text-emerald-800 ring-emerald-200 min-w-[3.5rem]"
              >
                +{n}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onApply}
        className="w-full rounded-lg bg-teal-600 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-40"
      >
        {t('webPosKeypadApply')}
      </button>
    </div>
  );
}
