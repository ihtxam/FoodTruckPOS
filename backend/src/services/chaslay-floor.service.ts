import { getDb, schema } from "@/db";
import { and, asc, eq, gt } from "drizzle-orm";

type FloorRole = "MAIN_POS" | "WAITER" | "STANDARD";

function normalizeRole(role: unknown): FloorRole {
  if (role === "MAIN_POS" || role === "WAITER" || role === "STANDARD") return role;
  return "STANDARD";
}

export class ChaslayFloorService {
  static async registerDevice(
    merchantId: string,
    input: {
      deviceId: string;
      deviceName?: string | null;
      role?: string | null;
      lanHost?: string | null;
      appVersion?: string | null;
    }
  ) {
    const db = getDb();
    const role = normalizeRole(input.role);
    const now = new Date();

    const existing = await db.query.chaslayFloorDevices.findFirst({
      where: and(
        eq(schema.chaslayFloorDevices.merchantId, merchantId),
        eq(schema.chaslayFloorDevices.deviceId, input.deviceId)
      ),
    });

    if (existing) {
      await db
        .update(schema.chaslayFloorDevices)
        .set({
          deviceName: input.deviceName ?? existing.deviceName,
          role,
          lanHost: input.lanHost ?? existing.lanHost,
          appVersion: input.appVersion ?? existing.appVersion,
          lastSeenAt: now,
        })
        .where(eq(schema.chaslayFloorDevices.id, existing.id));
    } else {
      await db.insert(schema.chaslayFloorDevices).values({
        merchantId,
        deviceId: input.deviceId,
        deviceName: input.deviceName ?? null,
        role,
        lanHost: input.lanHost ?? null,
        appVersion: input.appVersion ?? null,
        lastSeenAt: now,
      });
    }

    return { ok: true, serverTime: Date.now() };
  }

  static async getMainPos(merchantId: string) {
    const db = getDb();
    const devices = await db.query.chaslayFloorDevices.findMany({
      where: and(
        eq(schema.chaslayFloorDevices.merchantId, merchantId),
        eq(schema.chaslayFloorDevices.role, "MAIN_POS")
      ),
      orderBy: [asc(schema.chaslayFloorDevices.lastSeenAt)],
    });

    const withHost = devices
      .filter((d) => d.lanHost && d.lanHost.trim() !== "")
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());

    const row = withHost[0];
    if (!row) {
      return { lanHost: null, deviceName: null, lastSeenAt: null };
    }

    return {
      lanHost: row.lanHost,
      deviceName: row.deviceName,
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    };
  }

  static async listOrders(merchantId: string, sinceMs: number) {
    const db = getDb();
    const sinceDate = sinceMs > 0 ? new Date(sinceMs) : new Date(0);
    const rows = await db.query.chaslayFloorTableOrders.findMany({
      where: and(
        eq(schema.chaslayFloorTableOrders.merchantId, merchantId),
        gt(schema.chaslayFloorTableOrders.updatedAt, sinceDate)
      ),
      orderBy: [asc(schema.chaslayFloorTableOrders.updatedAt)],
    });

    return {
      serverTime: Date.now(),
      orders: rows.map((r) => ({
        local_order_id: r.localOrderId,
        table_id: r.tableId,
        table_name: r.tableName,
        status: r.status,
        service_type: r.serviceType,
        user_id: r.userId,
        user_name: r.userName,
        cart_json: r.cartJson,
        source_device_id: r.sourceDeviceId,
        updated_at: r.updatedAt?.toISOString() ?? null,
      })),
    };
  }

  static async upsertOrder(
    merchantId: string,
    localOrderId: string,
    body: {
      tableId?: number;
      tableName?: string;
      status?: string;
      serviceType?: string;
      userId?: number;
      userName?: string;
      cart?: Record<string, unknown>;
      sourceDeviceId?: string;
    }
  ) {
    const db = getDb();
    const now = new Date();
    const existing = await db.query.chaslayFloorTableOrders.findFirst({
      where: and(
        eq(schema.chaslayFloorTableOrders.merchantId, merchantId),
        eq(schema.chaslayFloorTableOrders.localOrderId, localOrderId)
      ),
    });

    const values = {
      tableId: Number(body.tableId ?? 0),
      tableName: body.tableName ?? "",
      status: body.status ?? "OPEN",
      serviceType: body.serviceType ?? "DINE_IN",
      userId: Number(body.userId ?? 0),
      userName: body.userName ?? "",
      cartJson: (body.cart ?? {}) as Record<string, unknown>,
      sourceDeviceId: body.sourceDeviceId ?? "",
      updatedAt: now,
    };

    if (existing) {
      await db
        .update(schema.chaslayFloorTableOrders)
        .set(values)
        .where(eq(schema.chaslayFloorTableOrders.id, existing.id));
    } else {
      await db.insert(schema.chaslayFloorTableOrders).values({
        merchantId,
        localOrderId,
        ...values,
      });
    }

    return { ok: true, serverTime: Date.now() };
  }

  static async createPrintJob(
    merchantId: string,
    input: {
      jobType: string;
      payload: Record<string, unknown>;
      sourceDeviceId?: string;
      orderId?: string | null;
    }
  ) {
    const db = getDb();
    const safeType = input.jobType === "RECEIPT" ? "RECEIPT" : "KITCHEN";
    const inserted = await db
      .insert(schema.chaslayFloorPrintJobs)
      .values({
        merchantId,
        jobType: safeType,
        status: "PENDING",
        payload: input.payload,
        sourceDeviceId: input.sourceDeviceId ?? "",
        orderId: input.orderId ?? null,
      })
      .returning();

    const row = inserted[0]!;
    return {
      ok: true,
      jobId: row.id,
      createdAt: row.createdAt?.toISOString() ?? null,
    };
  }

  static async listPendingPrintJobs(merchantId: string, limit: number) {
    const db = getDb();
    const rows = await db.query.chaslayFloorPrintJobs.findMany({
      where: and(
        eq(schema.chaslayFloorPrintJobs.merchantId, merchantId),
        eq(schema.chaslayFloorPrintJobs.status, "PENDING")
      ),
      orderBy: [asc(schema.chaslayFloorPrintJobs.createdAt)],
      limit,
    });

    return {
      serverTime: Date.now(),
      jobs: rows.map((r) => ({
        id: r.id,
        job_type: r.jobType,
        payload: r.payload,
        source_device_id: r.sourceDeviceId,
        order_id: r.orderId,
        created_at: r.createdAt?.toISOString() ?? null,
      })),
    };
  }

  static async ackPrintJob(merchantId: string, jobId: string, status: "DONE" | "FAILED") {
    const db = getDb();
    await db
      .update(schema.chaslayFloorPrintJobs)
      .set({ status, processedAt: new Date() })
      .where(
        and(
          eq(schema.chaslayFloorPrintJobs.merchantId, merchantId),
          eq(schema.chaslayFloorPrintJobs.id, jobId)
        )
      );
    return { ok: true };
  }
}
