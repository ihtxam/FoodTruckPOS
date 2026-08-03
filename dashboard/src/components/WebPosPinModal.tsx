import { useEffect, useRef, useState } from 'react';
import { Loader2, UserCircle2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

/** Staff PINs are 4–8 digits; WebPOS auto-submits shortly after the 4th digit. */
const PIN_AUTO_LENGTH = 4;
const PIN_MAX_LENGTH = 8;
/** Brief pause so a 5th digit can cancel auto-submit (longer PINs use OK). */
const PIN_AUTO_DELAY_MS = 280;

export default function WebPosPinModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
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
    if (value.length < PIN_AUTO_LENGTH) {
      setError(t('webPosPinHint'));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/merchant/staff/verify-pin', { pin: value });
      onSuccess(res.data.staff);
      onClose();
    } catch (e: any) {
      failPin(e.response?.data?.error || t('webPosPinInvalid'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const appendDigit = (d: string) => {
    if (pin.length >= PIN_MAX_LENGTH || busyRef.current) return;
    clearAutoTimer();
    const next = pin + d;
    setPin(next);
    setError('');
    // Auto-login after 4th digit (correct PIN → no OK). Extra digits cancel the timer; use OK.
    if (next.length === PIN_AUTO_LENGTH) {
      autoTimerRef.current = window.setTimeout(() => {
        autoTimerRef.current = null;
        void submitPin(next);
      }, PIN_AUTO_DELAY_MS);
    }
  };

  const backspace = () => {
    if (busyRef.current) return;
    clearAutoTimer();
    setPin((p) => p.slice(0, -1));
    setError('');
  };

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
          {Array.from({ length: PIN_AUTO_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full ${
                i < Math.min(pin.length, PIN_AUTO_LENGTH) ? 'bg-stone-900' : 'bg-stone-300'
              }`}
            />
          ))}
        </div>

        {error ? <p className="mb-3 text-center text-sm text-red-600">{error}</p> : null}

        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].map((key) => (
            <button
              key={key}
              type="button"
              disabled={busy}
              onClick={() => {
                if (key === '⌫') backspace();
                else if (key === 'OK') void submitPin(pin);
                else appendDigit(key);
              }}
              className={`rounded-xl py-3 text-lg font-semibold ${
                key === 'OK'
                  ? 'bg-teal-700 text-white hover:bg-teal-800'
                  : 'bg-[var(--bg-muted)] hover:bg-[var(--border)]'
              } disabled:opacity-50`}
            >
              {busy && key === 'OK' ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
