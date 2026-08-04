import { useEffect, useRef, useState } from 'react';
import { Loader2, Lock, UserCircle2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

/** Staff PINs are 4–8 digits; auto-submit after a brief pause once length ≥ 4. */
const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 8;
/** Pause so a longer PIN can be typed before verify runs (no OK button in gate mode). */
const PIN_AUTO_DELAY_MS = 420;

export type WebPosPinModalMode = 'gate' | 'switch';

export default function WebPosPinModal({
  open,
  mode = 'switch',
  onClose,
  onSuccess,
}: {
  open: boolean;
  /** `gate` = fullscreen unlock before register; `switch` = compact switch-user modal */
  mode?: WebPosPinModalMode;
  onClose: () => void;
  onSuccess: (staff: {
    id: string;
    name: string;
    roleId: string;
    roleName: string;
    permissions: string[];
  }) => void;
}) {
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const busyRef = useRef(false);
  const autoTimerRef = useRef<number | null>(null);
  const isGate = mode === 'gate';

  const clearAutoTimer = () => {
    if (autoTimerRef.current != null) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      clearAutoTimer();
      setPin('');
      setError('');
      setShake(false);
      busyRef.current = false;
      setBusy(false);
    }
  }, [open]);

  useEffect(() => () => clearAutoTimer(), []);

  if (!open) return null;

  const failPin = (message: string) => {
    setError(message);
    setPin('');
    setShake(true);
    window.setTimeout(() => setShake(false), 420);
    toast.error(message);
  };

  const submitPin = async (value: string) => {
    clearAutoTimer();
    if (busyRef.current) return;
    if (value.length < PIN_MIN_LENGTH) {
      setError(t('webPosPinHint'));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/merchant/staff/verify-pin', { pin: value });
      onSuccess(res.data.staff);
      if (!isGate) onClose();
    } catch (e: any) {
      failPin(e.response?.data?.error || t('webPosPinInvalid'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const scheduleAutoSubmit = (value: string) => {
    clearAutoTimer();
    if (value.length < PIN_MIN_LENGTH) return;
    autoTimerRef.current = window.setTimeout(() => {
      autoTimerRef.current = null;
      void submitPin(value);
    }, PIN_AUTO_DELAY_MS);
  };

  const appendDigit = (d: string) => {
    if (pin.length >= PIN_MAX_LENGTH || busyRef.current) return;
    clearAutoTimer();
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length >= PIN_MIN_LENGTH) {
      scheduleAutoSubmit(next);
    }
  };

  const backspace = () => {
    if (busyRef.current) return;
    clearAutoTimer();
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const keys = isGate
    ? (['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', ''] as const)
    : (['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'] as const);

  const dots = Math.max(PIN_MIN_LENGTH, Math.min(pin.length || PIN_MIN_LENGTH, PIN_MAX_LENGTH));

  const keypad = (
    <div
      className={`grid grid-cols-3 ${
        isGate ? 'mx-auto w-full max-w-md gap-3 sm:gap-4' : 'gap-2'
      }`}
    >
      {keys.map((key, idx) => {
        if (!key) {
          return <div key={`empty-${idx}`} />;
        }
        return (
          <button
            key={key}
            type="button"
            disabled={busy}
            onClick={() => {
              if (key === '⌫') backspace();
              else if (key === 'OK') void submitPin(pin);
              else appendDigit(key);
            }}
            className={`font-semibold disabled:opacity-50 ${
              isGate
                ? `rounded-2xl py-5 text-3xl sm:py-6 sm:text-4xl ${
                    key === '⌫'
                      ? 'bg-stone-200 text-stone-800 hover:bg-stone-300'
                      : 'bg-stone-100 text-stone-900 hover:bg-stone-200'
                  }`
                : `rounded-xl py-3 text-lg ${
                    key === 'OK'
                      ? 'bg-teal-700 text-white hover:bg-teal-800'
                      : 'bg-[var(--bg-muted)] hover:bg-[var(--border)]'
                  }`
            }`}
          >
            {busy && key === 'OK' ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : key}
          </button>
        );
      })}
    </div>
  );

  if (isGate) {
    return (
      <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-stone-950 px-4 py-8 text-white">
        <div
          className={`flex w-full max-w-lg flex-col items-center ${
            shake ? 'webpos-pin-shake' : ''
          }`}
        >
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
              {busy ? (
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              ) : (
                <Lock className="h-8 w-8 text-white" />
              )}
            </span>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t('webPosPinGateTitle')}
            </h1>
            <p className="max-w-sm text-sm text-stone-300">{t('webPosPinGateHint')}</p>
          </div>

          <div className="mb-8 flex justify-center gap-3">
            {Array.from({ length: dots }).map((_, i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full sm:h-5 sm:w-5 ${
                  i < pin.length ? 'bg-white' : 'bg-white/25'
                }`}
              />
            ))}
          </div>

          {error ? (
            <p className="mb-4 text-center text-sm font-medium text-red-300">{error}</p>
          ) : null}

          {keypad}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className={`w-full max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-2xl ${
          shake ? 'webpos-pin-shake' : ''
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCircle2 className="h-5 w-5" />
            <h2 className="font-semibold">{t('webPosPinTitle')}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--bg-muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex justify-center gap-2">
          {Array.from({ length: PIN_MIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full ${
                i < Math.min(pin.length, PIN_MIN_LENGTH) ? 'bg-stone-900' : 'bg-stone-300'
              }`}
            />
          ))}
        </div>

        {error ? <p className="mb-3 text-center text-sm text-red-600">{error}</p> : null}

        {keypad}
      </div>
    </div>
  );
}
