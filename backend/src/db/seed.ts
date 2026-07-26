import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./index";
import { AuthService } from "../services/auth.service";

dotenv.config();

async function seed() {
  const email = process.env.SEED_SUPERADMIN_EMAIL || "admin@manupos.webprintmedia.swiss";
  const password = process.env.SEED_SUPERADMIN_PASSWORD || "ChangeMeNow!123";
  const name = process.env.SEED_SUPERADMIN_NAME || "ManuPOS Admin";

  const db = getDb();

  const existing = await db
    .select()
    .from(schema.superadmins)
    .where(eq(schema.superadmins.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Superadmin already exists: ${email}`);
    return;
  }

  const superadmin = await AuthService.registerSuperadmin(email, password, name);
  console.log("Seeded superadmin:", superadmin.email);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
