import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { ReservationService } from "@/services/reservation.service";
import { FloorPlanService } from "@/services/floor-plan.service";
import { zurichLocalToDate } from "@/services/reservation.service";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

/**
 * GET /api/merchant/reservations/config
 */
router.get("/config", async (req: Request, res: Response) => {
  try {
    const config = await ReservationService.getConfig(req.merchantId!);
    const tables = await FloorPlanService.listTablesForSync(req.merchantId!);
    res.json({ success: true, config, tables });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load config" });
  }
});

/**
 * PUT /api/merchant/reservations/config
 */
router.put("/config", async (req: Request, res: Response) => {
  try {
    const config = await ReservationService.updateSettings(req.merchantId!, {
      enabled: req.body.enabled,
      settings: req.body.settings,
      dineInHours: req.body.dineInHours,
    });
    res.json({ success: true, config });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to save settings" });
  }
});

/**
 * GET /api/merchant/reservations
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const reservations = await ReservationService.list(req.merchantId!, { from, to, status });
    res.json({ success: true, reservations });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list" });
  }
});

/**
 * GET /api/merchant/reservations/slots
 */
router.get("/slots", async (req: Request, res: Response) => {
  try {
    const date = String(req.query.date || "");
    const partySize = Number(req.query.partySize) || 2;
    const result = await ReservationService.getSlots(req.merchantId!, date, partySize);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to load slots" });
  }
});

/**
 * POST /api/merchant/reservations
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    let reservedAt: Date | string = req.body.reservedAt;
    if (req.body.date && req.body.time) {
      reservedAt = zurichLocalToDate(String(req.body.date), String(req.body.time));
    }
    const reservation = await ReservationService.create(req.merchantId!, {
      guestName: req.body.guestName,
      guestEmail: req.body.guestEmail,
      guestPhone: req.body.guestPhone,
      partySize: req.body.partySize,
      reservedAt,
      notes: req.body.notes,
      source: req.body.source || "dashboard",
      tableId: req.body.tableId,
      status: req.body.status,
      skipSlotCheck: !!req.body.skipSlotCheck,
    });
    res.status(201).json({ success: true, reservation });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create" });
  }
});

/**
 * GET /api/merchant/reservations/:id
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const reservation = await ReservationService.get(req.merchantId!, req.params.id);
    res.json({ success: true, reservation });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Not found" });
  }
});

/**
 * POST /api/merchant/reservations/:id/action
 */
router.post("/:id/action", async (req: Request, res: Response) => {
  try {
    const reservation = await ReservationService.action(
      req.merchantId!,
      req.params.id,
      req.body.action,
      {
        tableId: req.body.tableId,
        internalNotes: req.body.internalNotes,
      }
    );
    res.json({ success: true, reservation });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Action failed" });
  }
});

export default router;
