import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Database = NodePgDatabase<typeof schema>;

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    const pool = new Pool({
      connectionString: databaseUrl,
    });

    db = drizzle(pool, { schema });
  }

  return db;
}

export type { Database };
export { schema };
export type { CmsBlock, CmsPuckData, CmsTheme, ReservationSettings, ReservationStatus, VacationSettings, VacationPeriod, MerchantSmtpSettings, MarketingSettings, OfferRules, OfferType } from "./schema";
