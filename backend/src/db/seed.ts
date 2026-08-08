import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./index";
import { AuthService } from "../services/auth.service";
import { generateSyncApiKey } from "../services/chaslay-compat.service";
import { SubscriptionPlansService } from "../services/subscription-plans.service";

dotenv.config();

/** Open all day every channel — keeps demo shop orderable after seed. */
const ALWAYS_OPEN = {
  takeaway: {
    mon: [{ open: "00:00", close: "23:59" }],
    tue: [{ open: "00:00", close: "23:59" }],
    wed: [{ open: "00:00", close: "23:59" }],
    thu: [{ open: "00:00", close: "23:59" }],
    fri: [{ open: "00:00", close: "23:59" }],
    sat: [{ open: "00:00", close: "23:59" }],
    sun: [{ open: "00:00", close: "23:59" }],
  },
  dine_in: {
    mon: [{ open: "00:00", close: "23:59" }],
    tue: [{ open: "00:00", close: "23:59" }],
    wed: [{ open: "00:00", close: "23:59" }],
    thu: [{ open: "00:00", close: "23:59" }],
    fri: [{ open: "00:00", close: "23:59" }],
    sat: [{ open: "00:00", close: "23:59" }],
    sun: [{ open: "00:00", close: "23:59" }],
  },
  delivery: {
    mon: [{ open: "00:00", close: "23:59" }],
    tue: [{ open: "00:00", close: "23:59" }],
    wed: [{ open: "00:00", close: "23:59" }],
    thu: [{ open: "00:00", close: "23:59" }],
    fri: [{ open: "00:00", close: "23:59" }],
    sat: [{ open: "00:00", close: "23:59" }],
    sun: [{ open: "00:00", close: "23:59" }],
  },
};

async function seedSuperadmin() {
  const email = process.env.SEED_SUPERADMIN_EMAIL || "admin@manupos.webprintmedia.swiss";
  const password = process.env.SEED_SUPERADMIN_PASSWORD || "ChangeMeNow!123";
  const name = process.env.SEED_SUPERADMIN_NAME || "ChaslayReborn Admin";
  const db = getDb();

  const existing = await db
    .select()
    .from(schema.superadmins)
    .where(eq(schema.superadmins.email, email))
    .limit(1);

  if (existing.length > 0) {
    // Keep password in sync with SEED_SUPERADMIN_PASSWORD so deploys can recover lockouts
    if (password && password !== "replace-with-strong-admin-password") {
      const passwordHash = await AuthService.hashPassword(password);
      await db
        .update(schema.superadmins)
        .set({ passwordHash, name, isActive: true, updatedAt: new Date() })
        .where(eq(schema.superadmins.id, existing[0]!.id));
      console.log(`Superadmin password synced from SEED_SUPERADMIN_PASSWORD: ${email}`);
    } else {
      console.log(`Superadmin already exists: ${email}`);
    }
    return;
  }

  const superadmin = await AuthService.registerSuperadmin(email, password, name);
  console.log("Seeded superadmin:", superadmin.email);
}

async function seedDemoShop() {
  if (process.env.SEED_DEMO_SHOP === "false") {
    console.log("SEED_DEMO_SHOP=false — skipping demo merchant");
    return;
  }

  const db = getDb();
  const email = process.env.SEED_DEMO_MERCHANT_EMAIL || "demo@chaslay.com";
  const password = process.env.SEED_DEMO_MERCHANT_PASSWORD || "DemoShop123!";
  const slug = process.env.SEED_DEMO_SLUG || "demo";
  // Keep Android BuildConfig SYNC_API_KEY working when present
  const syncApiKey =
    process.env.SEED_DEMO_SYNC_API_KEY || "ihtsham_76875hgf755rjgkjh7zrzrhvjhv";

  let merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.slug, slug),
  });

  if (!merchant) {
    const byEmail = await db.query.merchants.findFirst({
      where: eq(schema.merchants.email, email),
    });
    if (byEmail) {
      merchant = byEmail;
    }
  }

  if (!merchant) {
    const passwordHash = await AuthService.hashPassword(password);
    const inserted = await db
      .insert(schema.merchants)
      .values({
        email,
        passwordHash,
        name: process.env.SEED_DEMO_MERCHANT_NAME || "Demo Food Truck",
        phone: "+41 79 000 00 00",
        address: "Bahnhofstrasse 1",
        city: "Zürich",
        country: "CH",
        slug,
        subdomain: slug,
        shopEnabled: true,
        pickupEnabled: true,
        dineInEnabled: true,
        deliveryEnabled: true,
        storeHours: ALWAYS_OPEN,
        status: "active",
        subscriptionPlan: "starter",
        syncApiKey: syncApiKey || generateSyncApiKey(),
        vatRate: "8.10",
        taxTakeawayRate: "8.10",
        taxDineInRate: "8.10",
        taxDeliveryRate: "8.10",
        panelLanguage: "en",
      })
      .returning();
    merchant = inserted[0]!;
    console.log(`Seeded demo merchant: ${merchant.email} (slug=${slug})`);
    console.log(`  Shop: https://shop.chaslay.com/${slug} or /shop/${slug}`);
    console.log(`  Sync API key: ${merchant.syncApiKey}`);
  } else {
    await db
      .update(schema.merchants)
      .set({
        shopEnabled: true,
        slug: merchant.slug || slug,
        subdomain: merchant.subdomain || slug,
        pickupEnabled: true,
        dineInEnabled: true,
        deliveryEnabled: true,
        storeHours: (merchant.storeHours as object) || ALWAYS_OPEN,
        status: "active",
        syncApiKey: merchant.syncApiKey || syncApiKey,
        updatedAt: new Date(),
      })
      .where(eq(schema.merchants.id, merchant.id));
    console.log(`Demo merchant ensured open: ${merchant.email} (slug=${merchant.slug || slug})`);
  }

  const existingCats = await db.query.categories.findMany({
    where: eq(schema.categories.merchantId, merchant.id),
    limit: 1,
  });
  if (existingCats.length > 0) {
    console.log("Demo catalog already present");
    return;
  }

  const catFood = (
    await db
      .insert(schema.categories)
      .values({
        merchantId: merchant.id,
        name: "Food",
        sortOrder: 1,
        color: "#F97316",
        clientId: "cat-food",
      })
      .returning()
  )[0]!;

  const catDrinks = (
    await db
      .insert(schema.categories)
      .values({
        merchantId: merchant.id,
        name: "Drinks",
        sortOrder: 2,
        color: "#0EA5E9",
        clientId: "cat-drinks",
      })
      .returning()
  )[0]!;

  await db.insert(schema.products).values([
    {
      merchantId: merchant.id,
      categoryId: catFood.id,
      name: "Cheeseburger",
      description: "Beef patty, cheese, house sauce",
      price: "12.50",
      stock: 100,
      isActive: true,
      isTaxable: true,
      clientId: "prod-burger",
      sku: "BURGER-01",
    },
    {
      merchantId: merchant.id,
      categoryId: catFood.id,
      name: "Fries",
      description: "Crispy fries",
      price: "5.00",
      stock: 100,
      isActive: true,
      isTaxable: true,
      clientId: "prod-fries",
      sku: "FRIES-01",
    },
    {
      merchantId: merchant.id,
      categoryId: catDrinks.id,
      name: "Cola",
      description: "0.33L",
      price: "3.50",
      stock: 100,
      isActive: true,
      isTaxable: true,
      clientId: "prod-cola",
      sku: "COLA-01",
    },
  ]);

  console.log("Seeded demo categories + products");
}

async function seedEditionsAndReseller() {
  const { EditionService } = await import("../services/edition.service");
  const { ResellerService } = await import("../services/reseller.service");
  await EditionService.ensureDefaults();
  const agency = await ResellerService.ensureChaslayAgency();
  console.log("Seeded editions + agency reseller:", agency.email);
}

async function seed() {
  await seedSuperadmin();
  await SubscriptionPlansService.ensureDefaults();
  await seedEditionsAndReseller();
  await seedDemoShop();
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
