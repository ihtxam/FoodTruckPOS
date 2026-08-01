import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type TableShape = 'rect' | 'round';
type TableStatus = 'available' | 'occupied' | 'reserved' | 'dirty';

type PosTable = {
  id: string;
  label: string;
  capacity: number;
  shape: TableShape;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  status: TableStatus;
};

type FloorPlanData = {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  tables: PosTable[];
};

const STATUS_COLOR: Record<TableStatus, string> = {
  available: '#22c55e',
  occupied: '#ef4444',
  reserved: '#f59e0b',
  dirty: '#94a3b8',
};

type Props = {
  onSelectTable?: (table: { id: string; label: string }) => void;
  selectedTableId?: string | null;
};

export default function WebPosTablesView({ onSelectTable, selectedTableId }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<FloorPlanData[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/floor-plans');
      const list: FloorPlanData[] = res.data.plans || [];
      setPlans(list);
      if (list.length) {
        setActivePlanId((prev) => (prev && list.some((p) => p.id === prev) ? prev : list[0]!.id));
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) || null,
    [plans, activePlanId]
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-stone-500">
        {t('loading')}
      </div>
    );
  }

  if (!activePlan) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-stone-500">
        <p>{t('createFloorPlanHint')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-stone-100">
      {plans.length > 1 ? (
        <div className="flex gap-2 border-b border-stone-200 bg-white px-3 py-2">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePlanId(p.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                p.id === activePlanId ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-600'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div
          className="relative mx-auto rounded-xl border border-stone-200 bg-white shadow-sm"
          style={{
            width: activePlan.canvasWidth,
            height: activePlan.canvasHeight,
            maxWidth: '100%',
          }}
        >
          {activePlan.tables.map((table) => {
            const selected = selectedTableId === table.id;
            return (
              <button
                key={table.id}
                type="button"
                onClick={() => onSelectTable?.({ id: table.id, label: table.label })}
                className={`absolute flex flex-col items-center justify-center border-2 text-xs font-bold transition hover:brightness-95 ${
                  table.shape === 'round' ? 'rounded-full' : 'rounded-lg'
                } ${selected ? 'ring-4 ring-teal-400 ring-offset-2' : ''}`}
                style={{
                  left: table.posX,
                  top: table.posY,
                  width: table.width,
                  height: table.height,
                  transform: `rotate(${table.rotation || 0}deg)`,
                  backgroundColor: `${STATUS_COLOR[table.status]}22`,
                  borderColor: STATUS_COLOR[table.status],
                  color: '#1c1917',
                }}
              >
                <span>{table.label}</span>
                <span className="text-[10px] font-normal opacity-70">{table.capacity}p</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
