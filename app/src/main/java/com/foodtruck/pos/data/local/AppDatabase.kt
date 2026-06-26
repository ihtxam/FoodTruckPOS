package com.foodtruck.pos.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.foodtruck.pos.data.local.dao.AddonGroupDao
import com.foodtruck.pos.data.local.dao.AddonOptionDao
import com.foodtruck.pos.data.local.dao.BusinessSettingsDao
import com.foodtruck.pos.data.local.dao.CancelReasonDao
import com.foodtruck.pos.data.local.dao.CategoryDao
import com.foodtruck.pos.data.local.dao.DiscountPresetDao
import com.foodtruck.pos.data.local.dao.HeldOrderDao
import com.foodtruck.pos.data.local.dao.HeldOrderItemDao
import com.foodtruck.pos.data.local.dao.PrinterConfigDao
import com.foodtruck.pos.data.local.dao.KitchenMessageDao
import com.foodtruck.pos.data.local.dao.ModifierGroupDao
import com.foodtruck.pos.data.local.dao.ModifierOptionDao
import com.foodtruck.pos.data.local.dao.ProductAddonGroupDao
import com.foodtruck.pos.data.local.dao.ProductDao
import com.foodtruck.pos.data.local.dao.ProductModifierGroupDao
import com.foodtruck.pos.data.local.dao.ProductVariantDao
import com.foodtruck.pos.data.local.dao.RestaurantTableDao
import com.foodtruck.pos.data.local.dao.TableOrderDao
import com.foodtruck.pos.data.local.dao.TableOrderItemDao
import com.foodtruck.pos.data.local.dao.TransactionDao
import com.foodtruck.pos.data.local.dao.UserDao
import com.foodtruck.pos.data.local.entity.AddonGroupEntity
import com.foodtruck.pos.data.local.entity.AddonOptionEntity
import com.foodtruck.pos.data.local.entity.BusinessSettingsEntity
import com.foodtruck.pos.data.local.entity.CancelReasonEntity
import com.foodtruck.pos.data.local.entity.CategoryEntity
import com.foodtruck.pos.data.local.entity.DiscountPresetEntity
import com.foodtruck.pos.data.local.entity.HeldOrderEntity
import com.foodtruck.pos.data.local.entity.HeldOrderItemEntity
import com.foodtruck.pos.data.local.entity.ModifierGroupEntity
import com.foodtruck.pos.data.local.entity.ModifierOptionEntity
import com.foodtruck.pos.data.local.entity.PrinterConfigEntity
import com.foodtruck.pos.data.local.entity.KitchenMessageEntity
import com.foodtruck.pos.data.local.entity.ProductAddonGroupEntity
import com.foodtruck.pos.data.local.entity.ProductEntity
import com.foodtruck.pos.data.local.entity.ProductModifierGroupEntity
import com.foodtruck.pos.data.local.entity.ProductVariantEntity
import com.foodtruck.pos.data.local.entity.RestaurantTableEntity
import com.foodtruck.pos.data.local.entity.TableOrderEntity
import com.foodtruck.pos.data.local.entity.TableOrderItemEntity
import com.foodtruck.pos.data.local.entity.TransactionEntity
import com.foodtruck.pos.data.local.entity.TransactionItemEntity
import com.foodtruck.pos.data.local.entity.UserEntity

@Database(
    entities = [
        UserEntity::class,
        CategoryEntity::class,
        ProductEntity::class,
        ProductVariantEntity::class,
        ModifierGroupEntity::class,
        ModifierOptionEntity::class,
        AddonGroupEntity::class,
        AddonOptionEntity::class,
        ProductModifierGroupEntity::class,
        ProductAddonGroupEntity::class,
        TransactionEntity::class,
        TransactionItemEntity::class,
        BusinessSettingsEntity::class,
        RestaurantTableEntity::class,
        TableOrderEntity::class,
        TableOrderItemEntity::class,
        KitchenMessageEntity::class,
        DiscountPresetEntity::class,
        PrinterConfigEntity::class,
        CancelReasonEntity::class,
        HeldOrderEntity::class,
        HeldOrderItemEntity::class
    ],
    version = 16,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun categoryDao(): CategoryDao
    abstract fun productDao(): ProductDao
    abstract fun productVariantDao(): ProductVariantDao
    abstract fun modifierGroupDao(): ModifierGroupDao
    abstract fun modifierOptionDao(): ModifierOptionDao
    abstract fun addonGroupDao(): AddonGroupDao
    abstract fun addonOptionDao(): AddonOptionDao
    abstract fun productModifierGroupDao(): ProductModifierGroupDao
    abstract fun productAddonGroupDao(): ProductAddonGroupDao
    abstract fun transactionDao(): TransactionDao
    abstract fun businessSettingsDao(): BusinessSettingsDao
    abstract fun restaurantTableDao(): RestaurantTableDao
    abstract fun tableOrderDao(): TableOrderDao
    abstract fun tableOrderItemDao(): TableOrderItemDao
    abstract fun kitchenMessageDao(): KitchenMessageDao
    abstract fun discountPresetDao(): DiscountPresetDao
    abstract fun printerConfigDao(): PrinterConfigDao
    abstract fun cancelReasonDao(): CancelReasonDao
    abstract fun heldOrderDao(): HeldOrderDao
    abstract fun heldOrderItemDao(): HeldOrderItemDao
}
