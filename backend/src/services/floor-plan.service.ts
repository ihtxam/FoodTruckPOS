import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type TableShape = "rect" | "round";
export type TableStatus = "available" | "occupied" | "reserved" | "dirty";

export type DiningTableInput = {
  id?: string;
  label: string;
  capacity?: number;
  shape?: TableShape;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  rotation?: number;
  status?: TableStatus;
  sortOrder?: number;
};

export class FloorPlanService {
  static async list(merchantId: string) {
    const db = getDb();
    const plans = await db.query.floorPlans.findMany({
      where: eq(schema.floorPlans.merchantId, merchantId),
      with: {
        tables: { orderBy: [asc(schema.diningTables.sortOrder), asc(schema.diningTables.label)] },
      },
      orderBy: [asc(schema.floorPlans.sortOrder), asc(schema.floorPlans.name)],
    });
    return plans.map((p) => this.serializePlan(p));
  }

  static async getPlan(merchantId: string, planId: string) {
    const db = getDb();
    const plan = await db.query.floorPlans.findFirst({
      where: and(eq(schema.floorPlans.id, planId), eq(schema.floorPlans.merchantId, merchantId)),
      with: {
        tables: { orderBy: [asc(schema.diningTables.sortOrder), asc(schema.diningTables.label)] },
      },
    });
    if (!plan) throw new Error("Floor plan not found");
    return this.serializePlan(plan);
  }

  static async createPlan(merchantId: string, name: string) {
    const db = getDb();
    const title = (name || "").trim() || "Main floor";
    const [plan] = await db
      .insert(schema.floorPlans)
      .values({ merchantId, name: title })
      .returning();
    return this.getPlan(merchantId, plan.id);
  }

  static async updatePlan(
    merchantId: string,
    planId: string,
    updates: { name?: string; canvasWidth?: number; canvasHeight?: number; isActive?: boolean }
  ) {
    const db = getDb();
    const existing = await db.query.floorPlans.findFirst({
      where: and(eq(schema.floorPlans.id, planId), eq(schema.floorPlans.merchantId, merchantId)),
    });
    if (!existing) throw new Error("Floor plan not found");

    await db
      .update(schema.floorPlans)
      .set({
        name: updates.name?.trim() || existing.name,
        canvasWidth: updates.canvasWidth ?? existing.canvasWidth,
        canvasHeight: updates.canvasHeight ?? existing.canvasHeight,
        isActive: updates.isActive !== undefined ? !!updates.isActive : existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(schema.floorPlans.id, planId));

    return this.getPlan(merchantId, planId);
  }

  static async deletePlan(merchantId: string, planId: string) {
    const db = getDb();
    const existing = await db.query.floorPlans.findFirst({
      where: and(eq(schema.floorPlans.id, planId), eq(schema.floorPlans.merchantId, merchantId)),
    });
    if (!existing) throw new Error("Floor plan not found");
    await db.delete(schema.floorPlans).where(eq(schema.floorPlans.id, planId));
    return { success: true };
  }

  /** Replace all tables on a plan (designer save). */
  static async saveTables(merchantId: string, planId: string, tables: DiningTableInput[]) {
    const db = getDb();
    const plan = await db.query.floorPlans.findFirst({
      where: and(eq(schema.floorPlans.id, planId), eq(schema.floorPlans.merchantId, merchantId)),
    });
    if (!plan) throw new Error("Floor plan not found");

    await db.delete(schema.diningTables).where(eq(schema.diningTables.floorPlanId, planId));

    const rows = tables
      .map((t, idx) => ({
        merchantId,
        floorPlanId: planId,
        label: (t.label || `T${idx + 1}`).trim(),
        capacity: Math.max(1, Number(t.capacity) || 2),
        shape: t.shape === "round" ? "round" : "rect",
        posX: Number(t.posX) || 40,
        posY: Number(t.posY) || 40,
        width: Math.max(40, Number(t.width) || 100),
        height: Math.max(40, Number(t.height) || 80),
        rotation: Number(t.rotation) || 0,
        status: (["available", "occupied", "reserved", "dirty"].includes(String(t.status))
          ? t.status
          : "available") as TableStatus,
        sortOrder: t.sortOrder !== undefined ? Number(t.sortOrder) : idx,
      }))
      .filter((t) => t.label);

    if (rows.length) {
      await db.insert(schema.diningTables).values(rows);
    }

    await db
      .update(schema.floorPlans)
      .set({ updatedAt: new Date() })
      .where(eq(schema.floorPlans.id, planId));

    return this.getPlan(merchantId, planId);
  }

  static async setTableStatus(
    merchantId: string,
    tableId: string,
    status: TableStatus,
    currentOrderId?: string | null
  ) {
    const db = getDb();
    const table = await db.query.diningTables.findFirst({
      where: and(eq(schema.diningTables.id, tableId), eq(schema.diningTables.merchantId, merchantId)),
    });
    if (!table) throw new Error("Table not found");

    const [updated] = await db
      .update(schema.diningTables)
      .set({
        status,
        currentOrderId: currentOrderId === undefined ? table.currentOrderId : currentOrderId,
        updatedAt: new Date(),
      })
      .where(eq(schema.diningTables.id, tableId))
      .returning();

    return updated;
  }

  /** Covers served today = sum(guest_count) for completed dine-in orders. */
  static async coversReport(merchantId: string, date = new Date()) {
    const db = getDb();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const orders = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.status, "completed"),
        gte(schema.orders.createdAt, start),
        lte(schema.orders.createdAt, end)
      ),
      columns: {
        id: true,
        fulfillmentChannel: true,
        guestCount: true,
        tableLabel: true,
        total: true,
      },
    });

    const dineIn = orders.filter((o) => o.fulfillmentChannel === "dine_in");
    const covers = dineIn.reduce((sum, o) => sum + (o.guestCount || 0), 0);
    const checksWithPax = dineIn.filter((o) => (o.guestCount || 0) > 0).length;

    return {
      date: start.toISOString().slice(0, 10),
      totalOrders: orders.length,
      dineInOrders: dineIn.length,
      coversServed: covers,
      averagePartySize: checksWithPax ? Math.round((covers / checksWithPax) * 10) / 10 : 0,
      dineInRevenue: dineIn.reduce((s, o) => s + parseFloat(o.total?.toString() || "0"), 0),
    };
  }

  /** Flat table list for POS sync. */
  static async listTablesForSync(merchantId: string) {
    const db = getDb();
    const tables = await db.query.diningTables.findMany({
      where: eq(schema.diningTables.merchantId, merchantId),
      with: { floorPlan: true },
      orderBy: [asc(schema.diningTables.label)],
    });
    return tables.map((t) => ({
      id: t.id,
      floorPlanId: t.floorPlanId,
      floorPlanName: t.floorPlan?.name || "Floor",
      label: t.label,
      capacity: t.capacity,
      shape: t.shape,
      posX: t.posX,
      posY: t.posY,
      width: t.width,
      height: t.height,
      rotation: t.rotation,
      status: t.status,
      currentOrderId: t.currentOrderId,
    }));
  }

  private static serializePlan(p: any) {
    return {
      id: p.id,
      name: p.name,
      canvasWidth: p.canvasWidth,
      canvasHeight: p.canvasHeight,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
      tables: (p.tables || []).map((t: any) => ({
        id: t.id,
        label: t.label,
        capacity: t.capacity,
        shape: t.shape,
        posX: t.posX,
        posY: t.posY,
        width: t.width,
        height: t.height,
        rotation: t.rotation,
        status: t.status,
        currentOrderId: t.currentOrderId,
        sortOrder: t.sortOrder,
      })),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
