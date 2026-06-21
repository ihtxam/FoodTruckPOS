package com.foodtruck.pos.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.foodtruck.pos.data.local.dao.BusinessSettingsDao
import com.foodtruck.pos.data.local.dao.CategoryDao
import com.foodtruck.pos.data.local.dao.ProductDao
import com.foodtruck.pos.data.local.dao.ProductVariantDao
import com.foodtruck.pos.data.local.dao.TransactionDao
import com.foodtruck.pos.data.local.dao.UserDao
import com.foodtruck.pos.data.local.entity.BusinessSettingsEntity
import com.foodtruck.pos.data.local.entity.CategoryEntity
import com.foodtruck.pos.data.local.entity.ProductEntity
import com.foodtruck.pos.data.local.entity.ProductVariantEntity
import com.foodtruck.pos.data.local.entity.TransactionEntity
import com.foodtruck.pos.data.local.entity.TransactionItemEntity
import com.foodtruck.pos.data.local.entity.UserEntity

@Database(
    entities = [
        UserEntity::class,
        CategoryEntity::class,
        ProductEntity::class,
        ProductVariantEntity::class,
        TransactionEntity::class,
        TransactionItemEntity::class,
        BusinessSettingsEntity::class
    ],
    version = 1,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun categoryDao(): CategoryDao
    abstract fun productDao(): ProductDao
    abstract fun productVariantDao(): ProductVariantDao
    abstract fun transactionDao(): TransactionDao
    abstract fun businessSettingsDao(): BusinessSettingsDao
}
