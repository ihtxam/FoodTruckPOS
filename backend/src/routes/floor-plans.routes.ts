import { Router, Request, Response } from "express";
import { z } from "zod";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { requireEditionFeature } from "@/middleware/edition.middleware";
import { FloorPlanService } from "@/services/floor-plan.service";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);
router.use(requireEditionFeature("pos_tables"));

router.get("/", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const plans = await FloorPlanService.list(merchantId);
    res.json({ success: true, plans });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list floor plans" });
  }
});

router.get("/covers", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const dateRaw = typeof req.query.date === "string" ? req.query.date : undefined;
    const date = dateRaw ? new Date(dateRaw) : new Date();
    const report = await FloorPlanService.coversReport(merchantId, date);
    res.json({ success: true, ...report });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load covers report" });
  }
});

router.get("/tables", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const tables = await FloorPlanService.listTablesForSync(merchantId);
    res.json({ success: true, tables });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list tables" });
  }
});

router.get("/:planId", async (req: Request, res: Response) => {
  try {
    const plan = await FloorPlanService.getPlan(req.merchantId!, req.params.planId);
    res.json({ success: true, plan });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Floor plan not found" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = z.object({ name: z.string().min(1).max(120).optional() }).parse(req.body || {});
    const plan = await FloorPlanService.createPlan(req.merchantId!, body.name || "Main floor");
    res.status(201).json({ success: true, plan });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create floor plan" });
  }
});

router.patch("/:planId", async (req: Request, res: Response) => {
  try {
    const body = z
      .object({
        name: z.string().min(1).max(120).optional(),
        canvasWidth: z.number().int().positive().optional(),
        canvasHeight: z.number().int().positive().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body || {});
    const plan = await FloorPlanService.updatePlan(req.merchantId!, req.params.planId, body);
    res.json({ success: true, plan });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update floor plan" });
  }
});

router.delete("/:planId", async (req: Request, res: Response) => {
  try {
    await FloorPlanService.deletePlan(req.merchantId!, req.params.planId);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete floor plan" });
  }
});

router.put("/:planId/tables", async (req: Request, res: Response) => {
  try {
    const body = z
      .object({
        tables: z.array(
          z.object({
            id: z.string().uuid().optional(),
            label: z.string().min(1).max(50),
            capacity: z.number().int().min(1).max(50).optional(),
            shape: z.enum(["round", "rect"]).optional(),
            posX: z.number().optional(),
            posY: z.number().optional(),
            width: z.number().positive().optional(),
            height: z.number().positive().optional(),
            rotation: z.number().optional(),
            status: z.enum(["available", "occupied", "reserved", "dirty"]).optional(),
            sortOrder: z.number().int().optional(),
          })
        ),
      })
      .parse(req.body || {});
    const plan = await FloorPlanService.saveTables(req.merchantId!, req.params.planId, body.tables);
    res.json({ success: true, plan });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to save tables" });
  }
});

router.patch("/tables/:tableId/status", async (req: Request, res: Response) => {
  try {
    const body = z
      .object({
        status: z.enum(["available", "occupied", "reserved", "dirty"]),
        currentOrderId: z.string().uuid().nullable().optional(),
      })
      .parse(req.body || {});
    const table = await FloorPlanService.setTableStatus(
      req.merchantId!,
      req.params.tableId,
      body.status,
      body.currentOrderId
    );
    res.json({ success: true, table });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update table status" });
  }
});

export default router;
