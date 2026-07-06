package com.chaslay.pos.data.local

import android.content.Context
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import java.security.MessageDigest

class DatabaseCallback(
    private val context: Context
) : RoomDatabase.Callback() {
    override fun onCreate(db: SupportSQLiteDatabase) {
        super.onCreate(db)
        seedAll(db)
    }

    override fun onOpen(db: SupportSQLiteDatabase) {
        super.onOpen(db)
        wipeLegacyOrderDataIfNeeded(db)
        if (count(db, "categories") == 0L || count(db, "products") == 0L) {
            SushiSakeCatalogSeeder.seed(db)
        } else if (SushiSakeCatalogSeeder.isDemoCatalog(db)) {
            SushiSakeCatalogSeeder.replaceCatalog(db)
        }
        if (count(db, "roles") == 0L) {
            seedRoles(db)
        }
        if (count(db, "users") == 0L) {
            seedUsers(db)
        }
        if (count(db, "business_settings") == 0L) {
            seedSettings(db)
        }
        if (count(db, "restaurant_tables") == 0L) {
            seedTables(db)
        }
        if (count(db, "discount_presets") == 0L) {
            seedDiscountPresets(db)
        }
        if (count(db, "cancel_reasons") == 0L) {
            seedCancelReasons(db)
        }
        if (count(db, "customers") == 0L) {
            seedCustomers(db)
        }
        db.execSQL(
            """
            UPDATE products
            SET stockQuantity = 50, lowStockThreshold = 5
            WHERE stockQuantity IS NULL AND isOpenPrice = 0
            """.trimIndent()
        )
    }

    private fun count(db: SupportSQLiteDatabase, table: String): Long {
        db.query("SELECT COUNT(*) FROM $table").use { cursor ->
            return if (cursor.moveToFirst()) cursor.getLong(0) else 0L
        }
    }

    private fun seedAll(db: SupportSQLiteDatabase) {
        seedRoles(db)
        seedUsers(db)
        seedSettings(db)
        seedTables(db)
        SushiSakeCatalogSeeder.seed(db)
        seedDiscountPresets(db)
        seedCancelReasons(db)
        seedCustomers(db)
    }

    private fun seedRoles(db: SupportSQLiteDatabase) {
        val allPerms = "USE_POS,PROCESS_PAYMENTS,APPLY_DISCOUNTS,OPEN_CASH_DRAWER,SEND_KITCHEN,MANAGE_TABLES,TAKEAWAY_ORDERS,DELIVERY_ORDERS,VIEW_ORDER_HISTORY,CANCEL_ORDERS,REFUND_ORDERS,VIEW_REPORTS,MANAGE_PRODUCTS,ACCESS_SETTINGS,MANAGE_USERS,MANAGE_ROLES,END_OF_DAY"
        val waiterPerms = "USE_POS,PROCESS_PAYMENTS,APPLY_DISCOUNTS,OPEN_CASH_DRAWER,SEND_KITCHEN,MANAGE_TABLES,TAKEAWAY_ORDERS,VIEW_ORDER_HISTORY,CANCEL_ORDERS"
        val deliveryPerms = "USE_POS,DELIVERY_ORDERS,VIEW_ORDER_HISTORY,SEND_KITCHEN,PROCESS_PAYMENTS"
        val managerPerms = "USE_POS,PROCESS_PAYMENTS,APPLY_DISCOUNTS,OPEN_CASH_DRAWER,SEND_KITCHEN,MANAGE_TABLES,TAKEAWAY_ORDERS,DELIVERY_ORDERS,VIEW_ORDER_HISTORY,CANCEL_ORDERS,REFUND_ORDERS,VIEW_REPORTS,MANAGE_PRODUCTS,ACCESS_SETTINGS,END_OF_DAY"
        val cashierPerms = "USE_POS,PROCESS_PAYMENTS,TAKEAWAY_ORDERS,VIEW_ORDER_HISTORY,OPEN_CASH_DRAWER,APPLY_DISCOUNTS"
        listOf(
            Triple(1L, "Admin", allPerms),
            Triple(2L, "Waiter", waiterPerms),
            Triple(3L, "Delivery", deliveryPerms),
            Triple(4L, "Manager", managerPerms),
            Triple(5L, "Cashier", cashierPerms)
        ).forEach { (id, name, perms) ->
            db.execSQL(
                """
                INSERT OR IGNORE INTO roles (id, name, permissions, isSystem)
                VALUES ($id, '${q(name)}', '${q(perms)}', 1)
                """.trimIndent()
            )
        }
    }

    private fun seedUsers(db: SupportSQLiteDatabase) {
        val now = System.currentTimeMillis()
        db.execSQL(
            """
            INSERT OR IGNORE INTO users (id, name, email, pinHash, passwordHash, roleId, isActive, biometricEnabled, createdAt)
            VALUES (1, 'Admin', 'admin@foodtruck.local', '${hash("1234")}', '${hash("admin123")}', 1, 1, 0, $now)
            """.trimIndent()
        )
        db.execSQL(
            """
            INSERT OR IGNORE INTO users (id, name, email, pinHash, passwordHash, roleId, isActive, biometricEnabled, createdAt)
            VALUES (2, 'Waiter', NULL, '${hash("1111")}', NULL, 2, 1, 0, $now)
            """.trimIndent()
        )
        db.execSQL(
            """
            INSERT OR IGNORE INTO users (id, name, email, pinHash, passwordHash, roleId, isActive, biometricEnabled, createdAt)
            VALUES (3, 'Delivery', NULL, '${hash("2222")}', NULL, 3, 1, 0, $now)
            """.trimIndent()
        )
        db.execSQL(
            """
            INSERT OR IGNORE INTO users (id, name, email, pinHash, passwordHash, roleId, isActive, biometricEnabled, createdAt)
            VALUES (4, 'Cashier', NULL, '${hash("0000")}', NULL, 5, 1, 0, $now)
            """.trimIndent()
        )
    }

    private fun seedSettings(db: SupportSQLiteDatabase) {
        db.execSQL(
            """
            INSERT OR IGNORE INTO business_settings (
                id, businessName, vatNumber, address, phone, email, website,
                defaultCurrency, currencySymbol, defaultLanguage,
                tapToPayEnabled, adyenTerminalEnabled, adyenTerminalId, adyenApiKey, adyenMerchantAccount,
                dineInVatRate, takeawayVatRate, defaultServiceType, posMode,
                receiptBaseUrl, receiptHeader, receiptFooter, kitchenTicketHeader, kitchenTicketFooter
            ) VALUES (
                1, '${q("Sushi Sake")}', '', '${q("17 Rue Cheneau-de-Bourg, 1003 Lausanne")}', '+41 79 621 39 37', 'noreply@chaslay.com', '',
                'CHF', 'CHF', 'fr',
                0, 0, '', '', '',
                8.1, 2.6, 'TAKEAWAY', 'RESTAURANT',
                'https://pay.chaslay.com/receipts',
                '${q("Sushi Sake")}', '${q("Merci!")}', '', ''
            )
            """.trimIndent()
        )
    }

    private fun seedTables(db: SupportSQLiteDatabase) {
        (1..20).forEach { number ->
            db.execSQL(
                "INSERT OR IGNORE INTO restaurant_tables (id, name, sortOrder, isActive) VALUES ($number, '${q("Table $number")}', $number, 1)"
            )
        }
    }

    private fun seedDiscountPresets(db: SupportSQLiteDatabase) {
        listOf(
            Triple(1, "VIP", 10.0),
            Triple(2, "Student", 15.0),
            Triple(3, "Staff", 20.0)
        ).forEach { (id, name, percent) ->
            db.execSQL(
                """
                INSERT OR IGNORE INTO discount_presets (id, name, percent, isActive, sortOrder)
                VALUES ($id, '${q(name)}', $percent, 1, $id)
                """.trimIndent()
            )
        }
    }

    private fun seedCustomers(db: SupportSQLiteDatabase) {
        val now = System.currentTimeMillis()
        listOf(
            Triple("Abigail Peterson", "+1 555-0101", "abigail@example.com"),
            Triple("Acme Corporation", "+1 555-0102", "orders@acme.example.com"),
            Triple("Anita Oliver", "+1 555-0103", "anita@example.com")
        ).forEachIndexed { index, (name, phone, email) ->
            val address = when (index) {
                0 -> "77 Santa Barbara Rd, Pleasant Hill CA 94523, United States"
                1 -> "100 Market St, San Francisco CA 94105, United States"
                else -> "12 Oak Avenue, Oakland CA 94607, United States"
            }
            db.execSQL(
                """
                INSERT OR IGNORE INTO customers (id, name, phone, email, address, zip, notes, createdAt)
                VALUES (${index + 1}, '${q(name)}', '${q(phone)}', '${q(email)}', '${q(address)}', '', '', $now)
                """.trimIndent()
            )
        }
    }

    private fun seedCancelReasons(db: SupportSQLiteDatabase) {
        listOf(
            "Could not process order",
            "Kitchen too busy",
            "Client cancellation",
            "Out of stock",
            "Wrong order entered",
            "Other"
        ).forEachIndexed { index, reason ->
            db.execSQL(
                """
                INSERT OR IGNORE INTO cancel_reasons (id, label, sortOrder, isActive)
                VALUES (${index + 1}, '${q(reason)}', ${index + 1}, 1)
                """.trimIndent()
            )
        }
    }

    /** One-time wipe so client handoff builds start without demo sales history. */
    private fun wipeLegacyOrderDataIfNeeded(db: SupportSQLiteDatabase) {
        val prefs = context.getSharedPreferences("pos_migrations", Context.MODE_PRIVATE)
        if (prefs.getBoolean("client_order_wipe_v2", false)) return
        db.execSQL("DELETE FROM transaction_items")
        db.execSQL("DELETE FROM transactions")
        db.execSQL("DELETE FROM kitchen_messages")
        db.execSQL("DELETE FROM table_order_items")
        db.execSQL("DELETE FROM table_orders")
        db.execSQL("DELETE FROM held_order_items")
        db.execSQL("DELETE FROM held_orders")
        prefs.edit().putBoolean("client_order_wipe_v2", true).apply()
    }

    private fun q(value: String): String = value.replace("'", "''")

    private fun hash(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
    }
}
