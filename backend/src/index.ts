import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "@/routes/auth.routes";
import licensingRoutes from "@/routes/licensing.routes";
import superadminRoutes from "@/routes/superadmin.routes";
import merchantRoutes from "@/routes/merchant.routes";
import paymentRoutes from "@/routes/payment.routes";
import webshopRoutes from "@/routes/webshop.routes";
import loyaltyRoutes from "@/routes/loyalty.routes";
import syncRoutes from "@/routes/sync.routes";
import terminalsRoutes from "@/routes/terminals.routes";
import shopRoutes from "@/routes/shop.routes";
import rfidReadersRoutes from "@/routes/rfid-readers.routes";
import deliveryZonesRoutes from "@/routes/delivery-zones.routes";
import floorPlansRoutes from "@/routes/floor-plans.routes";
import receiptsRoutes from "@/routes/receipts.routes";
import chaslayRoutes from "@/routes/chaslay";

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

// ============================================================================
// ROUTES
// ============================================================================

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "manupos-backend",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/licensing", licensingRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/merchant", merchantRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/webshop", webshopRoutes);
app.use("/api/loyalty", loyaltyRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/terminals", terminalsRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api/rfid-readers", rfidReadersRoutes);
app.use("/api/delivery-zones", deliveryZonesRoutes);
app.use("/api/merchant/floor-plans", floorPlansRoutes);
app.use("/api/receipts", receiptsRoutes);
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
  console.log(`✅ ManuPOS API running on port ${PORT}`);
  console.log(`🏥 Health check: /health`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
