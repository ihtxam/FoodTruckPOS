import { Loader2, X, RotateCcw, CreditCard } from 'lucide-react';

export type WebPosPaymentPhase = 'processing' | 'cancelled' | 'failed';

type Props = {
  open: boolean;
  phase: WebPosPaymentPhase;
  amountLabel: string;
  message?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  onClose?: () => void;
};

export default function WebPosPaymentModal({
  open,
  phase,
  amountLabel,
  message,
  onCancel,
  onRetry,
  onClose,
}: Props) {
  if (!open) return null;

  const title =
    phase === 'processing'
      ? 'Processing payment'
      : phase === 'cancelled'
        ? 'Payment cancelled'
        : 'Payment failed';

  const defaultMessage =
    phase === 'processing'
      ? 'Complete the payment on your terminal…'
      : phase === 'cancelled'
        ? 'The payment was cancelled on the terminal.'
        : 'The terminal could not complete this payment.';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="webpos-payment-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          {phase === 'processing' ? (
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-700">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            </div>
          ) : (
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-600">
              <CreditCard className="h-8 w-8" aria-hidden />
            </div>
          )}

          <h2 id="webpos-payment-title" className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="mt-1 text-2xl font-bold tabular-nums">{amountLabel}</p>
          <p className="mt-3 text-sm text-[var(--text-muted)]">{message || defaultMessage}</p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {phase === 'processing' && onCancel ? (
            <button
              type="button"
              className="w-full rounded-xl border border-[var(--border)] py-2.5 text-sm font-semibold hover:bg-[var(--bg-muted)]"
              onClick={onCancel}
            >
              Cancel
            </button>
          ) : null}

          {(phase === 'cancelled' || phase === 'failed') && onRetry ? (
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
              onClick={onRetry}
            >
              <RotateCcw className="h-4 w-4" />
              Retry payment
            </button>
          ) : null}

          {phase !== 'processing' && onClose ? (
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
              Close
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
