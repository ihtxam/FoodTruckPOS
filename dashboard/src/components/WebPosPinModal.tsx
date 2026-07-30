import { useEffect, useState } from 'react';
import { Loader2, UserCircle2, X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

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

  useEffect(() => {
    if (!open) {
      setPin('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const appendDigit = (d: string) => {
    if (pin.length >= 8 || busy) return;
    setPin((p) => p + d);
    setError('');
  };

  const backspace = () => {
    if (busy) return;
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const submit = async () => {
    if (pin.length < 4) {
      setError(t('webPosPinHint'));
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/merchant/staff/verify-pin', { pin });
      onSuccess(res.data.staff);
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.error || t('webPosPinInvalid'));
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-2xl">
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
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full ${i < pin.length ? 'bg-stone-900' : 'bg-stone-300'}`}
            />
          ))}
        </div>

        {error ? <p className="mb-3 text-center text-sm text-red-600">{error}</p> : null}

        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '?', '0', 'OK'].map((key) => (
            <button
              key={key}
              type="button"
              disabled={busy}
              onClick={() => {
                if (key === '?') backspace();
                else if (key === 'OK') void submit();
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
