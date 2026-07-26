import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { getDb, schema } from "@/db";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

/**
 * GET /api/rfid-readers
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const readers = await db.query.rfidReaders.findMany({
      where: eq(schema.rfidReaders.merchantId, req.merchantId!),
    });
    res.json({ success: true, readers });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list readers" });
  }
});

/**
 * POST /api/rfid-readers
 * Register an RFID card reader for gift/loyalty cards.
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, readerUid, connectionType } = req.body;
    if (!name || !readerUid) {
      return res.status(400).json({ error: "name and readerUid are required" });
    }
    const db = getDb();
    const [reader] = await db
      .insert(schema.rfidReaders)
      .values({
        merchantId: req.merchantId!,
        name,
        readerUid: String(readerUid).trim(),
        connectionType: connectionType || "hid",
        status: "active",
        lastSeenAt: new Date(),
      })
      .returning();
    res.status(201).json({ success: true, reader });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to register reader" });
  }
});

/**
 * PUT /api/rfid-readers/:id
 */
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const [reader] = await db
      .update(schema.rfidReaders)
      .set({
        name: req.body.name,
        connectionType: req.body.connectionType,
        status: req.body.status,
        lastSeenAt: req.body.ping ? new Date() : undefined,
      })
      .where(
        and(eq(schema.rfidReaders.id, req.params.id), eq(schema.rfidReaders.merchantId, req.merchantId!))
      )
      .returning();
    if (!reader) return res.status(404).json({ error: "Reader not found" });
    res.json({ success: true, reader });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update reader" });
  }
});

/**
 * DELETE /api/rfid-readers/:id
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    await db
      .delete(schema.rfidReaders)
      .where(
        and(eq(schema.rfidReaders.id, req.params.id), eq(schema.rfidReaders.merchantId, req.merchantId!))
      );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete reader" });
  }
});

/**
 * POST /api/rfid-readers/:id/ping
 * Mark reader as seen (heartbeat from POS/dashboard).
 */
router.post("/:id/ping", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const [reader] = await db
      .update(schema.rfidReaders)
      .set({ lastSeenAt: new Date(), status: "active" })
      .where(
        and(eq(schema.rfidReaders.id, req.params.id), eq(schema.rfidReaders.merchantId, req.merchantId!))
      )
      .returning();
    if (!reader) return res.status(404).json({ error: "Reader not found" });
    res.json({ success: true, reader });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Ping failed" });
  }
});

export default router;
