package com.chaslay.pos.data.local

import androidx.sqlite.db.SupportSQLiteDatabase

/** Sushi Sake menu from flyer PDFs (names + prices only, no descriptions). */
object SushiSakeCatalogSeeder {
    private data class Cat(val name: String, val color: String, val target: String = "KITCHEN")
    private data class Item(val categoryIndex: Int, val name: String, val price: Double)

    private val categories = listOf(
        Cat("Sushi", "#E53935"),
        Cat("Maki", "#FB8C00"),
        Cat("California", "#FDD835"),
        Cat("Spring Rolls", "#43A047"),
        Cat("Bao & Yakitori", "#8E24AA"),
        Cat("Signature Roll", "#3949AB"),
        Cat("Salades & Accompagnements", "#00897B"),
        Cat("Poke Bowls", "#1E88E5"),
        Cat("Boissons", "#546E7A", "POS"),
        Cat("Boxes & Menus", "#6D4C41"),
        Cat("Japo Sashimi", "#D81B60"),
        Cat("Yakisoba Japonaise", "#FF7043"),
        Cat("Desserts", "#C2185B")
    )

    private val items = listOf(
        // Sushi
        Item(0, "Sushi Saumon", 2.00),
        Item(0, "Sushi Thon", 2.50),
        Item(0, "Sushi Saumon Teriyaki", 2.50),
        Item(0, "Sushi Thon Teriyaki", 2.90),
        Item(0, "Sushi Ebi Crevette", 2.90),
        Item(0, "Tulipe Saumon", 3.20),
        Item(0, "Tulipe Cheese", 2.90),
        // Maki
        Item(1, "Maki Avocat", 5.00),
        Item(1, "Maki Concombre", 5.00),
        Item(1, "Maki Cheese Avocat", 5.50),
        Item(1, "Maki Cheese Concombre", 5.50),
        Item(1, "Maki Saumon", 5.90),
        Item(1, "Maki Thon", 6.20),
        Item(1, "Maki Veggie", 6.50),
        Item(1, "Maki Spicy Thon", 6.90),
        Item(1, "Maki Ebi Tempura", 6.90),
        Item(1, "Maki Crevette Tobiko", 6.90),
        Item(1, "Maki Thon Cuit Rosa", 6.90),
        Item(1, "Maki Saumon Cheese", 6.90),
        Item(1, "Maki Unagi", 6.90),
        Item(1, "Maki Poulet Curry", 6.90),
        // California
        Item(2, "California Saumon Avocat", 7.50),
        Item(2, "California Thon Avocat", 7.90),
        Item(2, "California Thon Cuit Rosa", 7.90),
        Item(2, "California Saumon Cheese", 8.50),
        Item(2, "California Ebi Tempura", 8.50),
        Item(2, "California Chicken Teriyaki", 9.90),
        Item(2, "California Veggie Rolls", 7.00),
        Item(2, "California Tartare Saumon", 8.50),
        Item(2, "California 7 Spicy", 9.90),
        Item(2, "California Saumon Concombre Cheese", 8.50),
        Item(2, "California Poulet Curry Avocat", 9.90),
        Item(2, "California Combo Roll", 9.90),
        Item(2, "California Thon Cuit Concombre", 8.50),
        Item(2, "California Crispy Saumon", 9.90),
        Item(2, "California Salmon Roll Avocat Crispy Ognion", 9.90),
        Item(2, "California Salmon Roll Avocat", 8.90),
        Item(2, "California Salmon Roll", 8.50),
        Item(2, "California Sake", 9.90),
        Item(2, "California Smoke", 9.90),
        Item(2, "California Crevette Tokyo", 8.90),
        // Spring Rolls
        Item(3, "Spring Saumon Avocat", 7.50),
        Item(3, "Spring Thon Avocat", 8.50),
        Item(3, "Spring Thon Cuit Rosa", 7.90),
        Item(3, "Spring Cheese Avocat", 7.50),
        Item(3, "Spring Saumon Concombre Cheese", 8.90),
        Item(3, "Spring Saumon Snack\u00E9", 8.90),
        Item(3, "Spring Chicken Pane", 9.90),
        Item(3, "Spring Plante", 8.90),
        Item(3, "Spring Concombre Cheese", 7.90),
        Item(3, "Spring Ebi Tempura", 8.90),
        // Bao & Yakitori
        Item(4, "Yakitori Poulet (2 pcs)", 6.90),
        Item(4, "Yakitori Boeuf & Cheese (2 pcs)", 6.90),
        Item(4, "Bao Poulet Japonaise (3 pcs)", 9.90),
        Item(4, "Bao Veggie Japonaise (3 pcs)", 8.50),
        Item(4, "Gyoza Poulet (4 pcs)", 5.90),
        Item(4, "Gyoza Veggie (4 pcs)", 5.90),
        Item(4, "Gyoza Crevette (4 pcs)", 6.50),
        // Signature Roll
        Item(5, "Spicy Roll", 14.90),
        Item(5, "Ocean Roll", 14.90),
        Item(5, "Fresh Roll", 15.50),
        // Salades & Accompagnements
        Item(6, "Salade Carottes", 5.00),
        Item(6, "Edamame", 5.00),
        Item(6, "Salade Algues", 5.90),
        Item(6, "Vinaigre de Riz", 3.50),
        Item(6, "Salade Chou", 5.00),
        // Poke Bowls
        Item(7, "Saumon Chirashi Bowl", 17.50),
        Item(7, "Chirashi Thon & Saumon", 18.50),
        Item(7, "Poke Vegetarien", 17.50),
        Item(7, "Poke Saumon Teriyaki", 18.50),
        Item(7, "Poke Thon Sriracha Chily", 19.50),
        Item(7, "Poke Saumon Snack", 19.50),
        // Boissons
        Item(8, "Evian 50 cl", 2.50),
        Item(8, "Eau Minerale Gazeuse 50 cl", 2.50),
        Item(8, "Eau Minerale Sans Gaz 50 cl", 2.50),
        Item(8, "Coca-Cola 330 ml", 2.50),
        Item(8, "Coca-Cola Zero 330 ml", 2.50),
        Item(8, "Red Bull", 2.50),
        Item(8, "Fanta 33 cl", 2.50),
        Item(8, "Fanta Exotique 33 cl", 2.50),
        Item(8, "Ramune Original 200 ml", 3.90),
        Item(8, "Ramune Fraise 200 ml", 3.90),
        Item(8, "Ramune Ananas 200 ml", 3.90),
        Item(8, "Aloe Vera Original 500 ml", 3.90),
        Item(8, "Aloe Vera Mangue 500 ml", 3.90),
        Item(8, "Aloe Vera Lychee 500 ml", 3.90),
        Item(8, "Aloe Vera Pasteque 500 ml", 3.90),
        Item(8, "Ice Tea Peach", 2.00),
        Item(8, "Oasis Fraise et Framboise", 2.50),
        Item(8, "Oasis Cassis et Framboise", 2.50),
        Item(8, "Oasis Tropical", 2.50),
        Item(8, "Oishi Green Tea", 3.50),
        Item(8, "Oishi Black Tea", 3.50),
        Item(8, "Ice Mango Tea", 3.50),
        Item(8, "Fanta Mangue et Fruit Dragon 33 cl", 2.50),
        // Boxes & Menus
        Item(9, "Gourmet Box (42 pcs)", 55.00),
        Item(9, "Master Box (12 pcs)", 16.90),
        Item(9, "Lunch Box (20 pcs)", 18.50),
        Item(9, "Salmon Box (18 pcs)", 18.90),
        Item(9, "Fantasy Box (24 pcs)", 24.90),
        Item(9, "Saumon Classique Box (18 pcs)", 18.90),
        Item(9, "Tasty Salmon Box (18 pcs)", 20.90),
        Item(9, "Smart Box (12 pcs)", 15.90),
        Item(9, "Ocean Delight Box (14 pcs)", 20.90),
        Item(9, "Super Box (12 pcs)", 16.90),
        Item(9, "Sushi Classique Box (10 pcs)", 17.50),
        Item(9, "Thon Lovers Box (18 pcs)", 20.90),
        Item(9, "Veggie Box (15 pcs)", 17.90),
        Item(9, "Sushi Twin Box (10 pcs)", 18.50),
        Item(9, "Bento Box (22 pcs)", 24.50),
        Item(9, "Party Box (14 pcs)", 18.90),
        Item(9, "Yummy Box (20 pcs)", 22.90),
        Item(9, "Paco Box (42 pcs)", 49.90),
        // Japo Sashimi
        Item(10, "Sashimi Saumon (6 pcs)", 7.50),
        Item(10, "Sashimi Thon (6 pcs)", 8.50),
        Item(10, "Sashimi Saumon (12 pcs)", 15.90),
        Item(10, "Sashimi Thon (12 pcs)", 17.50),
        Item(10, "Sashimi Thon & Saumon (12 pcs)", 17.50),
        Item(10, "Sashimi Tataki Saumon (12 pcs)", 18.90),
        Item(10, "Sashimi Tataki Thon (12 pcs)", 19.90),
        // Yakisoba
        Item(11, "Yakisoba Poulet Pane", 15.90),
        Item(11, "Yakisoba Brochette Poulet", 15.90),
        Item(11, "Yakisoba Legumes", 13.50),
        Item(11, "Yakisoba Crevette Tempura", 15.50),
        Item(11, "Yakisoba Saumon Snack\u00E9", 15.50),
        // Desserts
        Item(12, "Petit Mochi Vanille", 2.90),
        Item(12, "Petit Mochi Coconut", 2.90),
        Item(12, "Petit Mochi Mangue", 2.90),
        Item(12, "Petit Mochi Caramel", 2.90),
        Item(12, "Tiramisu Classic", 7.50),
        Item(12, "Tiramisu Oreo", 7.50),
        Item(12, "Tiramisu Speculoose", 7.50)
    )

    fun seed(db: SupportSQLiteDatabase) {
        val now = System.currentTimeMillis()
        categories.forEachIndexed { index, cat ->
            val id = index + 1L
            db.execSQL(
                """
                INSERT OR REPLACE INTO categories (id, name, sortOrder, isActive, colorHex, onlineVisible, printTarget, updatedAt)
                VALUES ($id, '${q(cat.name)}', $index, 1, '${q(cat.color)}', 1, '${cat.target}', $now)
                """.trimIndent()
            )
        }
        items.forEachIndexed { index, item ->
            val categoryId = item.categoryIndex + 1L
            insertProduct(db, categoryId, item.name, item.price, 2.6, index + 1, now)
        }
        insertProduct(db, 9L, "Divers", 0.0, 2.6, 900, now, openPrice = true)
    }

    /** Old Vectron-style demo (Soup category) ù one-time migrate to Sushi Sake seed. */
    fun isLegacySoupDemo(db: SupportSQLiteDatabase): Boolean {
        db.query("SELECT COUNT(*) FROM categories WHERE name = 'Soup'").use { cursor ->
            return cursor.moveToFirst() && cursor.getLong(0) > 0L
        }
    }

    @Deprecated("Replaced by isLegacySoupDemo ù do not call on every DB open")
    fun isDemoCatalog(db: SupportSQLiteDatabase): Boolean = isLegacySoupDemo(db)

    fun replaceCatalog(db: SupportSQLiteDatabase) {
        db.execSQL("DELETE FROM products")
        db.execSQL("DELETE FROM categories")
        seed(db)
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
            INSERT INTO products (name, categoryId, taxRate, price, isActive, onlineVisible, isOpenPrice, isWeighed, isCombo, sortOrder, stockQuantity, lowStockThreshold, createdAt, updatedAt, printTarget)
            VALUES ('${q(name)}', $categoryId, $taxRate, $price, 1, 1, ${if (openPrice) 1 else 0}, 0, 0, $sortOrder, ${if (openPrice) "NULL" else "NULL"}, ${if (openPrice) "NULL" else "NULL"}, $timestamp, $timestamp, NULL)
            """.trimIndent()
        )
    }

    private fun q(value: String): String = value.replace("'", "''")
}
