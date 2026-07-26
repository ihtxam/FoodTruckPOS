package com.chaslay.pos.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.chaslay.pos.data.local.dao.AddonGroupDao
import com.chaslay.pos.data.local.dao.AddonOptionDao
import com.chaslay.pos.data.local.dao.BusinessSettingsDao
import com.chaslay.pos.data.local.dao.CancelReasonDao
import com.chaslay.pos.data.local.dao.CategoryDao
import com.chaslay.pos.data.local.dao.ComboSlotDao
import com.chaslay.pos.data.local.dao.ComboSlotOptionDao
import com.chaslay.pos.data.local.dao.CustomerDao
import com.chaslay.pos.data.local.dao.DiscountPresetDao
import com.chaslay.pos.data.local.dao.HeldOrderDao
import com.chaslay.pos.data.local.dao.HeldOrderItemDao
import com.chaslay.pos.data.local.dao.PrinterConfigDao
import com.chaslay.pos.data.local.dao.KitchenMessageDao
import com.chaslay.pos.data.local.dao.ModifierGroupDao
import com.chaslay.pos.data.local.dao.ModifierOptionDao
import com.chaslay.pos.data.local.dao.ProductAddonGroupDao
import com.chaslay.pos.data.local.dao.ProductDao
import com.chaslay.pos.data.local.dao.ProductModifierGroupDao
import com.chaslay.pos.data.local.dao.ProductVariantDao
import com.chaslay.pos.data.local.dao.FloorPlanElementDao
import com.chaslay.pos.data.local.dao.RestaurantTableDao
import com.chaslay.pos.data.local.dao.TableFloorDao
import com.chaslay.pos.data.local.dao.TableOrderDao
import com.chaslay.pos.data.local.dao.TableOrderItemDao
import com.chaslay.pos.data.local.dao.TransactionDao
import com.chaslay.pos.data.local.dao.RoleDao
import com.chaslay.pos.data.local.dao.UserDao
import com.chaslay.pos.data.local.entity.AddonGroupEntity
import com.chaslay.pos.data.local.entity.AddonOptionEntity
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.local.entity.CancelReasonEntity
import com.chaslay.pos.data.local.entity.CustomerEntity
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ComboSlotEntity
import com.chaslay.pos.data.local.entity.ComboSlotOptionEntity
import com.chaslay.pos.data.local.entity.DiscountPresetEntity
import com.chaslay.pos.data.local.entity.HeldOrderEntity
import com.chaslay.pos.data.local.entity.HeldOrderItemEntity
import com.chaslay.pos.data.local.entity.ModifierGroupEntity
import com.chaslay.pos.data.local.entity.ModifierOptionEntity
import com.chaslay.pos.data.local.entity.PrinterConfigEntity
import com.chaslay.pos.data.local.entity.KitchenMessageEntity
import com.chaslay.pos.data.local.entity.ProductAddonGroupEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.local.entity.ProductModifierGroupEntity
import com.chaslay.pos.data.local.entity.ProductVariantEntity
import com.chaslay.pos.data.local.entity.FloorPlanElementEntity
import com.chaslay.pos.data.local.entity.RestaurantTableEntity
import com.chaslay.pos.data.local.entity.TableFloorEntity
import com.chaslay.pos.data.local.entity.TableOrderEntity
import com.chaslay.pos.data.local.entity.TableOrderItemEntity
import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.data.local.entity.TransactionItemEntity
import com.chaslay.pos.data.local.entity.RoleEntity
import com.chaslay.pos.data.local.entity.UserEntity

@Database(
    entities = [
        UserEntity::class,
        RoleEntity::class,
        CategoryEntity::class,
        ProductEntity::class,
        ProductVariantEntity::class,
        ModifierGroupEntity::class,
        ModifierOptionEntity::class,
        AddonGroupEntity::class,
        AddonOptionEntity::class,
        ProductModifierGroupEntity::class,
        ProductAddonGroupEntity::class,
        ComboSlotEntity::class,
        ComboSlotOptionEntity::class,
        TransactionEntity::class,
        TransactionItemEntity::class,
        BusinessSettingsEntity::class,
        TableFloorEntity::class,
        FloorPlanElementEntity::class,
        RestaurantTableEntity::class,
        TableOrderEntity::class,
        TableOrderItemEntity::class,
        KitchenMessageEntity::class,
        DiscountPresetEntity::class,
        PrinterConfigEntity::class,
        CancelReasonEntity::class,
        HeldOrderEntity::class,
        HeldOrderItemEntity::class,
        CustomerEntity::class
    ],
    version = 34,
    exportSchema = true
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun roleDao(): RoleDao
    abstract fun categoryDao(): CategoryDao
    abstract fun productDao(): ProductDao
    abstract fun productVariantDao(): ProductVariantDao
    abstract fun modifierGroupDao(): ModifierGroupDao
    abstract fun modifierOptionDao(): ModifierOptionDao
    abstract fun addonGroupDao(): AddonGroupDao
    abstract fun addonOptionDao(): AddonOptionDao
    abstract fun productModifierGroupDao(): ProductModifierGroupDao
    abstract fun productAddonGroupDao(): ProductAddonGroupDao
    abstract fun comboSlotDao(): ComboSlotDao
    abstract fun comboSlotOptionDao(): ComboSlotOptionDao
    abstract fun transactionDao(): TransactionDao
    abstract fun businessSettingsDao(): BusinessSettingsDao
    abstract fun tableFloorDao(): TableFloorDao
    abstract fun floorPlanElementDao(): FloorPlanElementDao
    abstract fun restaurantTableDao(): RestaurantTableDao
    abstract fun tableOrderDao(): TableOrderDao
    abstract fun tableOrderItemDao(): TableOrderItemDao
    abstract fun kitchenMessageDao(): KitchenMessageDao
    abstract fun discountPresetDao(): DiscountPresetDao
    abstract fun printerConfigDao(): PrinterConfigDao
    abstract fun cancelReasonDao(): CancelReasonDao
    abstract fun heldOrderDao(): HeldOrderDao
    abstract fun heldOrderItemDao(): HeldOrderItemDao
    abstract fun customerDao(): CustomerDao
}
