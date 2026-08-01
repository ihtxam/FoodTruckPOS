import { FormEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type TableShape = 'rect' | 'round';
type TableStatus = 'available' | 'occupied' | 'reserved' | 'dirty';

interface DesignerTable {
  localId: string;
  id?: string;
  label: string;
  capacity: number;
  shape: TableShape;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  status: TableStatus;
}

interface FloorPlanData {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  isActive: boolean;
  tables: Array<Omit<DesignerTable, 'localId'> & { id: string }>;
}

function uid() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function toDesigner(tables: FloorPlanData['tables'] = []): DesignerTable[] {
  return tables.map((t) => ({
    localId: t.id || uid(),
    id: t.id,
    label: t.label,
    capacity: t.capacity || 2,
    shape: t.shape === 'round' ? 'round' : 'rect',
    posX: t.posX ?? 40,
    posY: t.posY ?? 40,
    width: t.width || 100,
    height: t.height || 80,
    rotation: t.rotation || 0,
    status: (t.status as TableStatus) || 'available',
  }));
}

const STATUS_COLOR: Record<TableStatus, string> = {
  available: '#22c55e',
  occupied: '#ef4444',
  reserved: '#f59e0b',
  dirty: '#94a3b8',
};

export default function FloorPlan({ embedded = false }: { embedded?: boolean }) {
  const { t } = useI18n();
  const [plans, setPlans] = useState<FloorPlanData[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [tables, setTables] = useState<DesignerTable[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [covers, setCovers] = useState<{ coversServed: number; dineInOrders: number; averagePartySize: number } | null>(null);
  const [drag, setDrag] = useState<{ localId: string; offsetX: number; offsetY: number } | null>(null);
  /** Inner canvas (same coordinate space for pointer down + move). */
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) || null,
    [plans, activePlanId]
  );
  const selected = tables.find((t) => t.localId === selectedId) || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, coversRes] = await Promise.all([
        api.get('/merchant/floor-plans'),
        api.get('/merchant/floor-plans/covers').catch(() => null),
      ]);
      const list: FloorPlanData[] = plansRes.data.plans || [];
      setPlans(list);
      if (coversRes?.data) {
        setCovers({
          coversServed: coversRes.data.coversServed || 0,
          dineInOrders: coversRes.data.dineInOrders || 0,
          averagePartySize: coversRes.data.averagePartySize || 0,
        });
      }
      if (list.length) {
        const id = activePlanId && list.some((p) => p.id === activePlanId) ? activePlanId : list[0].id;
        setActivePlanId(id);
        const plan = list.find((p) => p.id === id)!;
        setTables(toDesigner(plan.tables));
      } else {
        setActivePlanId(null);
        setTables([]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load floor plans');
    } finally {
      setLoading(false);
    }
  }, [activePlanId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectPlan = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    setActivePlanId(planId);
    setTables(toDesigner(plan.tables));
    setSelectedId(null);
  };

  const createPlan = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/merchant/floor-plans', { name: newPlanName || 'Main floor' });
      const plan = res.data.plan as FloorPlanData;
      setPlans((prev) => [...prev, plan]);
      setActivePlanId(plan.id);
      setTables(toDesigner(plan.tables));
      setNewPlanName('');
      toast.success('Floor plan created');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create floor plan');
    }
  };

  const addTable = () => {
    const n = tables.length + 1;
    const next: DesignerTable = {
      localId: uid(),
      label: `T${n}`,
      capacity: 4,
      shape: 'rect',
      posX: 40 + (n % 5) * 30,
      posY: 40 + (n % 4) * 30,
      width: 110,
      height: 90,
      rotation: 0,
      status: 'available',
    };
    setTables((prev) => [...prev, next]);
    setSelectedId(next.localId);
  };

  const updateSelected = (patch: Partial<DesignerTable>) => {
    if (!selectedId) return;
    setTables((prev) => prev.map((t) => (t.localId === selectedId ? { ...t, ...patch } : t)));
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setTables((prev) => prev.filter((t) => t.localId !== selectedId));
    setSelectedId(null);
  };

  const saveTables = async () => {
    if (!activePlanId) return;
    setSaving(true);
    try {
      const res = await api.put(`/merchant/floor-plans/${activePlanId}/tables`, {
        tables: tables.map((t, idx) => ({
          label: t.label,
          capacity: t.capacity,
          shape: t.shape,
          posX: Math.round(t.posX),
          posY: Math.round(t.posY),
          width: Math.round(t.width),
          height: Math.round(t.height),
          rotation: t.rotation,
          status: t.status,
          sortOrder: idx,
        })),
      });
      const plan = res.data.plan as FloorPlanData;
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? plan : p)));
      setTables(toDesigner(plan.tables));
      toast.success('Tables saved');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save tables');
    } finally {
      setSaving(false);
    }
  };

  const onCanvasPointerDown = (e: PointerEvent<HTMLDivElement>, localId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const table = tables.find((t) => t.localId === localId);
    if (!table) return;
    setSelectedId(localId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrag({
      localId,
      offsetX: e.clientX - rect.left - table.posX,
      offsetY: e.clientY - rect.top - table.posY,
    });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onCanvasPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || !activePlan) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(
      0,
      Math.min(activePlan.canvasWidth - (tables.find((t) => t.localId === drag.localId)?.width || 40), e.clientX - rect.left - drag.offsetX)
    );
    const y = Math.max(
      0,
      Math.min(activePlan.canvasHeight - (tables.find((t) => t.localId === drag.localId)?.height || 40), e.clientY - rect.top - drag.offsetY)
    );
    setTables((prev) =>
      prev.map((t) => (t.localId === drag.localId ? { ...t, posX: x, posY: y } : t))
    );
  };

  const onCanvasPointerUp = (e?: PointerEvent<HTMLDivElement>) => {
    if (e && drag) {
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    setDrag(null);
  };

  if (loading) return <div className="text-center py-12">Loading floor plans...</div>;

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('floorPlan')}</h1>
            <p className="text-slate-600 mt-1">
              Design dining tables with capacity (PAX). Enable floor plan &amp; per-person ordering in Settings → Tables.
            </p>
          </div>
          {covers && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Covers served today</div>
              <div className="text-2xl font-bold text-slate-900">{covers.coversServed}</div>
              <div className="text-xs text-slate-500">
                {covers.dineInOrders} dine-in · avg party {covers.averagePartySize}
              </div>
            </div>
          )}
        </div>
      )}
      {embedded && covers && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm inline-block">
          <div className="text-xs uppercase tracking-wide text-slate-500">Covers served today</div>
          <div className="text-2xl font-bold text-slate-900">{covers.coversServed}</div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr_280px] gap-4">
        {/* Plans list */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-slate-900">Floor plans</h2>
          <form onSubmit={createPlan} className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="New plan name"
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
            />
            <button type="submit" className="btn-primary whitespace-nowrap">
              {t('add')}
            </button>
          </form>
          <div className="space-y-1">
            {plans.length === 0 && <p className="text-sm text-slate-500">No plans yet. Create one to start.</p>}
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPlan(p.id)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm ${
                  p.id === activePlanId ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-50'
                }`}
              >
                {p.name}
                <span className="block text-xs text-slate-500">{p.tables?.length || 0} tables</span>
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="card">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="font-semibold text-slate-900">{activePlan?.name || 'Canvas'}</h2>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={addTable} disabled={!activePlan}>
                + Table
              </button>
              <button type="button" className="btn-primary" onClick={saveTables} disabled={!activePlan || saving}>
                {saving ? 'Saving...' : t('save')}
              </button>
            </div>
          </div>

          {!activePlan ? (
            <div className="h-[420px] flex items-center justify-center text-slate-500 border border-dashed rounded-xl">
              Create a floor plan to design tables
            </div>
          ) : (
            <div
              className="relative rounded-xl border border-slate-200 bg-[linear-gradient(#e2e8f0_1px,transparent_1px),linear-gradient(90deg,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px]"
              style={{
                height: Math.min(activePlan.canvasHeight, 560),
                overflow: drag ? 'hidden' : 'auto',
                touchAction: drag ? 'none' : 'auto',
              }}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              onPointerLeave={onCanvasPointerUp}
              onClick={() => setSelectedId(null)}
            >
              <div
                ref={canvasRef}
                className="relative bg-slate-50/40"
                style={{ width: activePlan.canvasWidth, height: activePlan.canvasHeight }}
              >
                {tables.map((table) => (
                  <div
                    key={table.localId}
                    onPointerDown={(e) => onCanvasPointerDown(e, table.localId)}
                    className={`absolute flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none shadow-sm border-2 ${
                      selectedId === table.localId ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-700/40'
                    } ${table.shape === 'round' ? 'rounded-full' : 'rounded-xl'}`}
                    style={{
                      left: table.posX,
                      top: table.posY,
                      width: table.width,
                      height: table.height,
                      touchAction: 'none',
                      backgroundColor: `${STATUS_COLOR[table.status]}22`,
                      transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
                    }}
                  >
                    <div className="font-bold text-slate-900 text-sm">{table.label}</div>
                    <div className="text-[11px] text-slate-600">{table.capacity} PAX</div>
                    <div
                      className="mt-1 h-2 w-2 rounded-full"
                      style={{ backgroundColor: STATUS_COLOR[table.status] }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            {Object.entries(STATUS_COLOR).map(([k, c]) => (
              <span key={k} className="inline-flex items-center gap-1 capitalize">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
                {k}
              </span>
            ))}
          </div>
        </div>

        {/* Inspector */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-slate-900">Table details</h2>
          {!selected ? (
            <p className="text-sm text-slate-500">Select a table on the canvas to edit label, capacity, shape.</p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Label</label>
                <input
                  className="input"
                  value={selected.label}
                  onChange={(e) => updateSelected({ label: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Capacity (PAX)</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={50}
                  value={selected.capacity}
                  onChange={(e) => updateSelected({ capacity: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Shape</label>
                <select
                  className="input"
                  value={selected.shape}
                  onChange={(e) => updateSelected({ shape: e.target.value as TableShape })}
                >
                  <option value="rect">Rectangle</option>
                  <option value="round">Round</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Width</label>
                  <input
                    className="input"
                    type="number"
                    value={selected.width}
                    onChange={(e) => updateSelected({ width: Math.max(40, Number(e.target.value) || 40) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Height</label>
                  <input
                    className="input"
                    type="number"
                    value={selected.height}
                    onChange={(e) => updateSelected({ height: Math.max(40, Number(e.target.value) || 40) })}
                  />
                </div>
              </div>
              <button type="button" className="btn-secondary w-full text-red-600" onClick={removeSelected}>
                {t('delete')} table
              </button>
            </>
          )}
          <div className="border-t pt-3 text-xs text-slate-500 space-y-1">
            <p>
              <strong>PAX ordering:</strong> when enabled in Settings, POS orders &amp; bills per person (Person 1…).
            </p>
            <p>
              <strong>Split bill:</strong> at checkout use Pay all, /N equal split, or pay by person.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
