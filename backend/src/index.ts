import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import authRoutes from "@/routes/auth.routes";
import licensingRoutes from "@/routes/licensing.routes";
import superadminRoutes from "@/routes/superadmin.routes";
import merchantRoutes from "@/routes/merchant.routes";
import paymentRoutes from "@/routes/payment.routes";
import webshopRoutes from "@/routes/webshop.routes";
import loyaltyRoutes from "@/routes/loyalty.routes";
import giftCardsRoutes from "@/routes/gift-cards.routes";
import syncRoutes from "@/routes/sync.routes";
import terminalsRoutes from "@/routes/terminals.routes";
import shopRoutes from "@/routes/shop.routes";
import cmsRoutes from "@/routes/cms.routes";
import rfidReadersRoutes from "@/routes/rfid-readers.routes";
import deliveryZonesRoutes from "@/routes/delivery-zones.routes";
import floorPlansRoutes from "@/routes/floor-plans.routes";
import reservationsRoutes from "@/routes/reservations.routes";
import receiptsRoutes from "@/routes/receipts.routes";
import chaslayRoutes from "@/routes/chaslay";
import webhooksRoutes from "@/routes/webhooks.routes";
import offersRoutes from "@/routes/offers.routes";
import marketingRoutes from "@/routes/marketing.routes";
import staffRoutes from "@/routes/staff.routes";
import { ensureUploadsRoot } from "@/services/media-upload.service";
import { MarketingService } from "@/services/marketing.service";
import { ReservationService } from "@/services/reservation.service";

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

function buildCorsOrigins(): string[] {
  const defaults = [
    process.env.SUPERADMIN_URL,
    process.env.MERCHANT_DASHBOARD_URL,
    process.env.WEB_SHOP_URL,
    process.env.PUBLIC_APP_URL,
    "http://localhost:5173",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
  ].filter(Boolean) as string[];

  const extra = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...defaults, ...extra])];
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = buildCorsOrigins();
      // Allow mobile apps / same-origin / curl (no Origin header)
      if (!origin || allowed.includes(origin) || process.env.CORS_ALLOW_ALL === "true") {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Public uploaded media (vacation popup images, etc.)
const uploadsRoot = ensureUploadsRoot();
app.use(
  "/api/uploads",
  express.static(uploadsRoot, {
    fallthrough: false,
    maxAge: "7d",
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=604800");
    },
  })
);

// Public installers / static downloads (print agent EXE, etc.)
const downloadsRoot = path.join(__dirname, "..", "public", "downloads");
app.use(
  "/downloads",
  express.static(downloadsRoot, {
    // Missing file → 404 from static (do not fall through to SPA-style handlers)
    fallthrough: false,
    maxAge: "1h",
    setHeaders(res, filePath) {
      if (filePath.endsWith(".exe")) {
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);
        // Prevent proxies from gzip/brotli-transforming the binary
        res.setHeader("Content-Encoding", "identity");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "public, max-age=3600");
      } else {
        res.setHeader("Cache-Control", "public, max-age=3600");
      }
    },
  })
);

// ============================================================================
// ROUTES
// ============================================================================

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "chaslayreborn-backend",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/licensing", licensingRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/merchant", merchantRoutes);
app.use("/api/merchant", staffRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/webshop", webshopRoutes);
app.use("/api/loyalty", loyaltyRoutes);
app.use("/api/gift-cards", giftCardsRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/terminals", terminalsRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api/merchant/cms", cmsRoutes);
app.use("/api/rfid-readers", rfidReadersRoutes);
app.use("/api/delivery-zones", deliveryZonesRoutes);
app.use("/api/merchant/floor-plans", floorPlansRoutes);
app.use("/api/merchant/reservations", reservationsRoutes);
app.use("/api/merchant/offers", offersRoutes);
app.use("/api/merchant/marketing", marketingRoutes);
app.use("/api/receipts", receiptsRoutes);
app.use("/api/webhooks", webhooksRoutes);
/** Chaslay / FoodTruck Android POS (Retrofit /v1/* contract) */
app.use("/v1", chaslayRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error:", err);
  const isCors = err.message.startsWith("CORS blocked");
  res.status(isCors ? 403 : 500).json({
    error: isCors ? err.message : "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`✅ ChaslayReborn API running on port ${PORT}`);
  console.log(`🏥 Health check: /health`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);

  // Reminder sweeps (~hourly). Lightweight; skips merchants without email.
  const tick = async () => {
    try {
      const result = await MarketingService.processReorderReminders();
      if (result.sent > 0) {
        console.log(`[marketing] reorder reminders sent: ${result.sent}`);
      }
    } catch (error) {
      console.error("[marketing] reorder reminder job failed", error);
    }
    try {
      const result = await ReservationService.processReminders();
      if (result.sent > 0) {
        console.log(`[reservations] reminders sent: ${result.sent}`);
      }
    } catch (error) {
      console.error("[reservations] reminder job failed", error);
    }
    try {
      const result = await ReservationService.processDailySummaries();
      if (result.sent > 0) {
        console.log(`[reservations] daily summaries sent: ${result.sent}`);
      }
    } catch (error) {
      console.error("[reservations] daily summary job failed", error);
    }
    try {
      const { PosShiftService } = await import("@/services/pos-shift.service");
      const closed = await PosShiftService.autoCloseStaleShifts();
      if (closed > 0) {
        console.log(`[pos-shifts] auto-closed stale shifts: ${closed}`);
      }
    } catch (error) {
      console.error("[pos-shifts] auto-close job failed", error);
    }
  };
  setTimeout(() => void tick(), 45_000);
  setInterval(() => void tick(), 60 * 60 * 1000);
});

export default app;
