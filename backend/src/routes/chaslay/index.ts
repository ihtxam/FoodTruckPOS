import { Router } from "express";
import licenseRoutes from "./license.routes";
import posAuthRoutes from "./pos-auth.routes";
import syncRoutes from "./sync.routes";
import ordersRoutes from "./orders.routes";
import receiptsRoutes from "./receipts.routes";
import floorRoutes from "./floor.routes";

/**
 * Chaslay / FoodTruck Android POS compatibility routes.
 * Mounted at /v1/* to match Retrofit interfaces in the Android app.
 */
const router = Router();

router.use("/license", licenseRoutes);
router.use("/pos/auth", posAuthRoutes);
router.use("/sync", syncRoutes);
router.use("/orders", ordersRoutes);
router.use("/receipts", receiptsRoutes);
router.use("/floor", floorRoutes);

export default router;
