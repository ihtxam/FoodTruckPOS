package com.chaslay.pos.data.local

import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import java.security.MessageDigest

class DatabaseCallback : RoomDatabase.Callback() {
    override fun onCreate(db: SupportSQLiteDatabase) {
        super.onCreate(db)
        seedAll(db)
    }

    override fun onOpen(db: SupportSQLiteDatabase) {
        super.onOpen(db)
        if (count(db, "categories") == 0L || count(db, "products") == 0L) {
            seedCatalog(db)
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
        seedCatalog(db)
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
                1, '${q("Demo Restaurant")}', 'CHE-123.456.789', '${q("Main Street 1")}', '+41 44 000 00 00', 'demo@restaurant.local', '',
                'CHF', 'CHF', 'en',
                0, 0, '', '', '',
                8.1, 2.6, 'TAKEAWAY', 'RESTAURANT',
                'https://pay.chaslay.com/receipts',
                '${q("Demo Restaurant")}', '${q("Merci / Thank you!")}', '', ''
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

    private fun seedCatalog(db: SupportSQLiteDatabase) {
        val now = System.currentTimeMillis()
        val categories = listOf(
            Triple("Soup", "#4ECDC4", "KITCHEN"),
            Triple("Starters", "#E8923A", "KITCHEN"),
            Triple("Salads", "#5B9BD5", "KITCHEN"),
            Triple("Vegetables", "#6B8E6B", "KITCHEN"),
            Triple("Fish", "#2E86AB", "KITCHEN"),
            Triple("Meat", "#C0392B", "KITCHEN"),
            Triple("Snacks", "#F39C12", "KITCHEN"),
            Triple("Dish of the day", "#9B59B6", "KITCHEN"),
            Triple("Desserts", "#C75B9E", "KITCHEN"),
            Triple("Drinks", "#3498DB", "POS")
        )
        categories.forEachIndexed { index, (name, color, target) ->
            val id = index + 1L
            db.execSQL(
                """
                INSERT OR IGNORE INTO categories (id, name, sortOrder, isActive, colorHex, onlineVisible, printTarget, updatedAt)
                VALUES ($id, '${q(name)}', $index, 1, '${q(color)}', 1, '$target', $now)
                """.trimIndent()
            )
        }

        val products = listOf(
            Triple(1L, "Chicken broth", 5.50),
            Triple(1L, "Tomato soup", 4.50),
            Triple(1L, "Vegetable soup", 4.50),
            Triple(2L, "Carpaccio", 12.90),
            Triple(2L, "Bruschetta", 8.50),
            Triple(2L, "Antipasti", 9.50),
            Triple(3L, "Mixed salad", 8.50),
            Triple(3L, "Salad small", 4.50),
            Triple(3L, "Salad large", 7.50),
            Triple(3L, "Caesar's salad", 9.90),
            Triple(4L, "Seasonal vegetables", 6.50),
            Triple(4L, "Grilled vegetables", 7.50),
            Triple(5L, "Salmon fillet", 18.90),
            Triple(5L, "Fish & chips", 14.50),
            Triple(5L, "Fish of the day", 17.50),
            Triple(6L, "Burger Classic", 12.50),
            Triple(6L, "Steak", 24.90),
            Triple(6L, "Schnitzel", 16.50),
            Triple(6L, "Vegetable lasagne", 14.90),
            Triple(7L, "French fries", 4.50),
            Triple(7L, "Onion rings", 5.00),
            Triple(7L, "Nachos", 6.50),
            Triple(8L, "Chef special", 15.90),
            Triple(9L, "Tiramisu", 6.50),
            Triple(9L, "Chocolate brownie", 5.50),
            Triple(9L, "Ice cream", 4.50),
            Triple(10L, "Coke small", 3.50),
            Triple(10L, "Coke large", 4.50),
            Triple(10L, "Lemonade small", 3.50),
            Triple(10L, "Soda small", 3.00),
            Triple(10L, "Espresso", 2.00),
            Triple(10L, "Cappuccino", 3.50),
            Triple(10L, "Bitter small", 4.00),
            Triple(10L, "Bitter large", 5.50),
            Triple(10L, "Gin Tonic", 8.50),
            Triple(10L, "Lager small", 4.50),
            Triple(10L, "Sparkling water", 3.50)
        )
        products.forEachIndexed { index, (categoryId, name, price) ->
            insertProduct(db, categoryId, name, price, 2.6, index + 1, now)
        }
        insertProduct(db, 8L, "Divers", 0.0, 2.6, 100, now, openPrice = true)
        insertProduct(db, 9L, "Donation", 0.0, 0.0, 101, now, openPrice = true)
    }

    private fun insertProduct(
        db: SupportSQLiteDatabase,
        categoryId: Long,
        name: String,
        price: Double,
        taxRate: Double,
        sortOrder: Int,
        timestamp: Long,
        openPrice: Boolean = false
    ) {
        db.execSQL(
            """
            INSERT INTO products (name, categoryId, taxRate, price, isActive, onlineVisible, isOpenPrice, sortOrder, stockQuantity, lowStockThreshold, createdAt, updatedAt, printTarget)
            VALUES ('${q(name)}', $categoryId, $taxRate, $price, 1, 1, ${if (openPrice) 1 else 0}, $sortOrder, ${if (openPrice) "NULL" else "50"}, ${if (openPrice) "NULL" else "5"}, $timestamp, $timestamp, NULL)
            """.trimIndent()
        )
    }

    private fun q(value: String): String = value.replace("'", "''")

    private fun hash(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
    }
}
