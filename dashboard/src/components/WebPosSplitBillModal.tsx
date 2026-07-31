import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2, splitEqual005 } from '@/lib/money';

export type SplitCartLine = {
  id: string;
  name: string;
  quantity: number;
  lineTotal: number;
};

export type SplitPart = {
  id: string;
  label: string;
  amount: number;
  lineIds: string[];
};

type Props = {
  open: boolean;
  lines: SplitCartLine[];
  total: number;
  maxParts: number;
  onClose: () => void;
  onConfirm: (parts: SplitPart[]) => void;
};

export default function WebPosSplitBillModal({
  open,
  lines,
  total,
  maxParts,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'equal' | 'items'>('equal');
  const [parts, setParts] = useState(2);
  const [assignments, setAssignments] = useState<Record<string, number>>({});

  const equalParts = useMemo(() => {
    const amounts = splitEqual005(total, parts);
    return amounts.map((amount, i) => ({
      id: `eq-${i + 1}`,
      label: `${t('webPosSplitPart')} ${i + 1}/${parts}`,
      amount,
      lineIds: [] as string[],
    }));
  }, [total, parts, t]);

  const itemParts = useMemo(() => {
    const n = Math.max(2, Math.min(maxParts, parts));
    const buckets: SplitPart[] = Array.from({ length: n }, (_, i) => ({
      id: `it-${i + 1}`,
      label: `${t('webPosSplitPart')} ${i + 1}`,
      amount: 0,
      lineIds: [] as string[],
    }));
    for (const line of lines) {
      const idx = Math.min(n - 1, Math.max(0, assignments[line.id] ?? 0));
      buckets[idx]!.lineIds.push(line.id);
      buckets[idx]!.amount = roundMoney2(buckets[idx]!.amount + line.lineTotal);
    }
    return buckets.filter((b) => b.amount > 0 || b.lineIds.length > 0);
  }, [lines, parts, assignments, maxParts, t]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center bg-black/45 p-3">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="font-semibold">{t('webPosSplitBill')}</h2>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-xl border py-3 text-sm font-semibold ${
                mode === 'equal' ? 'border-teal-600 bg-teal-50' : 'border-[var(--border)]'
              }`}
              onClick={() => setMode('equal')}
            >
              {t('webPosSplitEqual')}
            </button>
            <button
              type="button"
              className={`rounded-xl border py-3 text-sm font-semibold ${
                mode === 'items' ? 'border-teal-600 bg-teal-50' : 'border-[var(--border)]'
              }`}
              onClick={() => setMode('items')}
            >
              {t('webPosSplitByItems')}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm muted">{t('webPosSplitParts')}</span>
            {Array.from({ length: Math.min(maxParts, 8) }, (_, i) => i + 2).map((n) => (
              <button
                key={n}
                type="button"
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                  parts === n ? 'border-teal-600 bg-teal-50' : 'border-[var(--border)]'
                }`}
                onClick={() => setParts(n)}
              >
                /{n}
              </button>
            ))}
          </div>

          {mode === 'equal' ? (
            <ul className="space-y-2 text-sm">
              {equalParts.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <span>{p.label}</span>
                  <span className="font-semibold">CHF {p.amount.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2">
              {lines.map((line) => (
                <div
                  key={line.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">
                      {line.quantity}x {line.name}
                    </p>
                    <p className="muted">CHF {line.lineTotal.toFixed(2)}</p>
                  </div>
                  <select
                    className="input w-auto"
                    value={assignments[line.id] ?? 0}
                    onChange={(e) =>
                      setAssignments((prev) => ({
                        ...prev,
                        [line.id]: Number(e.target.value),
                      }))
                    }
                  >
                    {Array.from({ length: parts }, (_, i) => (
                      <option key={i} value={i}>
                        {t('webPosSplitPart')} {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <ul className="space-y-1 text-sm pt-2">
                {itemParts.map((p) => (
                  <li key={p.id} className="flex justify-between font-semibold">
                    <span>{p.label}</span>
                    <span>CHF {p.amount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            className="btn-primary w-full py-3"
            onClick={() => onConfirm(mode === 'equal' ? equalParts : itemParts)}
          >
            {t('webPosStartSplitPay')}
          </button>
        </div>
      </div>
    </div>
  );
}
