import { Router, Request, Response } from "express";
import { eq, and, asc } from "drizzle-orm";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { getDb, schema } from "@/db";
import { normalizeRing } from "@/lib/geo";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

/**
 * GET /api/delivery-zones
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const zones = await db.query.deliveryZones.findMany({
      where: eq(schema.deliveryZones.merchantId, req.merchantId!),
      orderBy: [asc(schema.deliveryZones.sortOrder)],
    });
    res.json({ success: true, zones });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list zones" });
  }
});

/**
 * POST /api/delivery-zones
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      name,
      polygon,
      zipCodes,
      minOrderAmount,
      deliveryFee,
      estimatedMinutes,
      color,
      isActive,
      sortOrder,
    } = req.body;

    if (!name) return res.status(400).json({ error: "name is required" });
    const ring = normalizeRing(polygon || []);
    if (ring.length < 4) {
      return res.status(400).json({ error: "Draw a delivery zone polygon with at least 3 points" });
    }

    const db = getDb();
    const [zone] = await db
      .insert(schema.deliveryZones)
      .values({
        merchantId: req.merchantId!,
        name,
        polygon: ring,
        zipCodes: Array.isArray(zipCodes) ? zipCodes.map(String) : [],
        minOrderAmount: String(minOrderAmount ?? 0),
        deliveryFee: String(deliveryFee ?? 0),
        estimatedMinutes: estimatedMinutes ?? 45,
        color: color || "#0d9488",
        isActive: isActive !== false,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    res.status(201).json({ success: true, zone });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create zone" });
  }
});

/**
 * PUT /api/delivery-zones/:id
 */
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (req.body.name !== undefined) patch.name = req.body.name;
    if (req.body.polygon !== undefined) {
      const ring = normalizeRing(req.body.polygon);
      if (ring.length < 4) {
        return res.status(400).json({ error: "Polygon needs at least 3 points" });
      }
      patch.polygon = ring;
    }
    if (req.body.zipCodes !== undefined) {
      patch.zipCodes = Array.isArray(req.body.zipCodes) ? req.body.zipCodes.map(String) : [];
    }
    if (req.body.minOrderAmount !== undefined) patch.minOrderAmount = String(req.body.minOrderAmount);
    if (req.body.deliveryFee !== undefined) patch.deliveryFee = String(req.body.deliveryFee);
    if (req.body.estimatedMinutes !== undefined) patch.estimatedMinutes = req.body.estimatedMinutes;
    if (req.body.color !== undefined) patch.color = req.body.color;
    if (req.body.isActive !== undefined) patch.isActive = !!req.body.isActive;
    if (req.body.sortOrder !== undefined) patch.sortOrder = req.body.sortOrder;

    const db = getDb();
    const [zone] = await db
      .update(schema.deliveryZones)
      .set(patch)
      .where(
        and(
          eq(schema.deliveryZones.id, req.params.id),
          eq(schema.deliveryZones.merchantId, req.merchantId!)
        )
      )
      .returning();

    if (!zone) return res.status(404).json({ error: "Zone not found" });
    res.json({ success: true, zone });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update zone" });
  }
});

/**
 * DELETE /api/delivery-zones/:id
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    await db
      .delete(schema.deliveryZones)
      .where(
        and(
          eq(schema.deliveryZones.id, req.params.id),
          eq(schema.deliveryZones.merchantId, req.merchantId!)
        )
      );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete zone" });
  }
});

export default router;
