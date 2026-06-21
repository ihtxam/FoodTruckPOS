package com.foodtruck.pos.data.local

import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.foodtruck.pos.data.local.entity.BusinessSettingsEntity
import com.foodtruck.pos.data.local.entity.CategoryEntity
import com.foodtruck.pos.data.local.entity.ProductEntity
import com.foodtruck.pos.data.local.entity.ProductVariantEntity
import com.foodtruck.pos.data.local.entity.UserEntity
import com.foodtruck.pos.domain.model.UserRole
import java.security.MessageDigest

class DatabaseCallback : RoomDatabase.Callback() {
    override fun onCreate(db: SupportSQLiteDatabase) {
        super.onCreate(db)
        seedDatabase(db)
    }

    private fun seedDatabase(db: SupportSQLiteDatabase) {
        db.execSQL(
            """
            INSERT INTO users (name, email, pinHash, passwordHash, role, isActive, biometricEnabled, createdAt)
            VALUES ('Admin', 'admin@foodtruck.local', '${hash("1234")}', '${hash("admin123")}', 'ADMIN', 1, 0, ${System.currentTimeMillis()})
            """.trimIndent()
        )
        db.execSQL(
            """
            INSERT INTO users (name, email, pinHash, passwordHash, role, isActive, biometricEnabled, createdAt)
            VALUES ('Cashier', NULL, '${hash("0000")}', NULL, 'CASHIER', 1, 0, ${System.currentTimeMillis()})
            """.trimIndent()
        )

        db.execSQL("INSERT INTO business_settings (id, businessName, defaultCurrency, currencySymbol) VALUES (1, 'Food Truck', 'CHF', 'CHF')")

        val categories = listOf("Drinks", "Food", "Desserts", "Merchandise", "Services")
        categories.forEachIndexed { index, name ->
            db.execSQL("INSERT INTO categories (name, sortOrder, isActive) VALUES ('$name', $index, 1)")
        }

        insertProduct(db, 1, "Coca Cola", 4.50, 2.5, 1)
        insertProduct(db, 1, "Sparkling Water", 3.50, 2.5, 2)
        insertProduct(db, 2, "Pizza Margherita", 14.90, 2.5, 3)
        insertProduct(db, 2, "Burger Classic", 12.50, 2.5, 4)
        insertProduct(db, 3, "Chocolate Brownie", 5.50, 2.5, 5)
        insertProduct(db, 5, "Custom Service", 0.0, 2.5, 6, openPrice = true)
        insertProduct(db, 5, "Donation", 0.0, 0.0, 7, openPrice = true)

        db.execSQL(
            """
            INSERT INTO products (name, sku, categoryId, taxRate, price, isActive, isOpenPrice, sortOrder, createdAt, updatedAt)
            VALUES ('Coffee', 'COFFEE', 1, 2.5, 4.00, 1, 0, 8, ${System.currentTimeMillis()}, ${System.currentTimeMillis()})
            """.trimIndent()
        )
        val coffeeId = db.query("SELECT last_insert_rowid()").use {
            it.moveToFirst()
            it.getLong(0)
        }
        listOf("Small" to 3.50, "Medium" to 4.00, "Large" to 4.50).forEachIndexed { index, (name, price) ->
            db.execSQL(
                """
                INSERT INTO product_variants (productId, name, price, sortOrder, isActive)
                VALUES ($coffeeId, '$name', $price, $index, 1)
                """.trimIndent()
            )
        }

        db.execSQL(
            """
            INSERT INTO products (name, sku, categoryId, taxRate, price, isActive, isOpenPrice, sortOrder, createdAt, updatedAt)
            VALUES ('Pizza Special', 'PIZZA-V', 2, 2.5, 16.90, 1, 0, 9, ${System.currentTimeMillis()}, ${System.currentTimeMillis()})
            """.trimIndent()
        )
        val pizzaId = db.query("SELECT last_insert_rowid()").use {
            it.moveToFirst()
            it.getLong(0)
        }
        listOf("Regular" to 16.90, "Large" to 19.90, "Family" to 24.90).forEachIndexed { index, (name, price) ->
            db.execSQL(
                """
                INSERT INTO product_variants (productId, name, price, sortOrder, isActive)
                VALUES ($pizzaId, '$name', $price, $index, 1)
                """.trimIndent()
            )
        }
    }

    private fun insertProduct(
        db: SupportSQLiteDatabase,
        categoryId: Long,
        name: String,
        price: Double,
        taxRate: Double,
        sortOrder: Int,
        openPrice: Boolean = false
    ) {
        db.execSQL(
            """
            INSERT INTO products (name, categoryId, taxRate, price, isActive, isOpenPrice, sortOrder, createdAt, updatedAt)
            VALUES ('$name', $categoryId, $taxRate, $price, 1, ${if (openPrice) 1 else 0}, $sortOrder, ${System.currentTimeMillis()}, ${System.currentTimeMillis()})
            """.trimIndent()
        )
    }

    private fun hash(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
    }
}
