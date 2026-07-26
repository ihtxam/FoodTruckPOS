package com.chaslay.pos.di

import android.content.Context
import androidx.room.Room
import com.chaslay.pos.data.local.AppDatabase
import com.chaslay.pos.data.local.DatabaseCallback
import com.chaslay.pos.data.local.dao.BusinessSettingsDao
import com.chaslay.pos.data.local.dao.CategoryDao
import com.chaslay.pos.data.local.dao.ProductDao
import com.chaslay.pos.data.local.dao.ProductVariantDao
import com.chaslay.pos.data.local.dao.TransactionDao
import com.chaslay.pos.data.local.dao.RoleDao
import com.chaslay.pos.data.local.dao.UserDao
import com.chaslay.pos.data.local.dao.CancelReasonDao
import com.chaslay.pos.data.local.dao.CustomerDao
import com.chaslay.pos.data.local.dao.DiscountPresetDao
import com.chaslay.pos.data.local.dao.HeldOrderDao
import com.chaslay.pos.data.local.dao.HeldOrderItemDao
import com.chaslay.pos.data.local.dao.PrinterConfigDao
import com.chaslay.pos.data.local.dao.KitchenMessageDao
import com.chaslay.pos.data.local.dao.FloorPlanElementDao
import com.chaslay.pos.data.local.dao.RestaurantTableDao
import com.chaslay.pos.data.local.dao.TableFloorDao
import com.chaslay.pos.data.local.dao.TableOrderDao
import com.chaslay.pos.data.local.dao.TableOrderItemDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "food_truck_pos.db")
            .addCallback(DatabaseCallback(context))
            .fallbackToDestructiveMigration()
            .build()

    @Provides fun provideRoleDao(db: AppDatabase): RoleDao = db.roleDao()
    @Provides fun provideUserDao(db: AppDatabase): UserDao = db.userDao()
    @Provides fun provideCategoryDao(db: AppDatabase): CategoryDao = db.categoryDao()
    @Provides fun provideProductDao(db: AppDatabase): ProductDao = db.productDao()
    @Provides fun provideProductVariantDao(db: AppDatabase): ProductVariantDao = db.productVariantDao()
    @Provides fun provideModifierGroupDao(db: AppDatabase): com.chaslay.pos.data.local.dao.ModifierGroupDao = db.modifierGroupDao()
    @Provides fun provideModifierOptionDao(db: AppDatabase): com.chaslay.pos.data.local.dao.ModifierOptionDao = db.modifierOptionDao()
    @Provides fun provideAddonGroupDao(db: AppDatabase): com.chaslay.pos.data.local.dao.AddonGroupDao = db.addonGroupDao()
    @Provides fun provideAddonOptionDao(db: AppDatabase): com.chaslay.pos.data.local.dao.AddonOptionDao = db.addonOptionDao()
    @Provides fun provideProductModifierGroupDao(db: AppDatabase): com.chaslay.pos.data.local.dao.ProductModifierGroupDao = db.productModifierGroupDao()
    @Provides fun provideProductAddonGroupDao(db: AppDatabase): com.chaslay.pos.data.local.dao.ProductAddonGroupDao = db.productAddonGroupDao()
    @Provides fun provideComboSlotDao(db: AppDatabase): com.chaslay.pos.data.local.dao.ComboSlotDao = db.comboSlotDao()
    @Provides fun provideComboSlotOptionDao(db: AppDatabase): com.chaslay.pos.data.local.dao.ComboSlotOptionDao = db.comboSlotOptionDao()
    @Provides fun provideTransactionDao(db: AppDatabase): TransactionDao = db.transactionDao()
    @Provides fun provideBusinessSettingsDao(db: AppDatabase): BusinessSettingsDao = db.businessSettingsDao()
    @Provides fun provideTableFloorDao(db: AppDatabase): TableFloorDao = db.tableFloorDao()
    @Provides fun provideFloorPlanElementDao(db: AppDatabase): FloorPlanElementDao = db.floorPlanElementDao()
    @Provides fun provideRestaurantTableDao(db: AppDatabase): RestaurantTableDao = db.restaurantTableDao()
    @Provides fun provideTableOrderDao(db: AppDatabase): TableOrderDao = db.tableOrderDao()
    @Provides fun provideTableOrderItemDao(db: AppDatabase): TableOrderItemDao = db.tableOrderItemDao()
    @Provides fun provideKitchenMessageDao(db: AppDatabase): KitchenMessageDao = db.kitchenMessageDao()
    @Provides fun provideDiscountPresetDao(db: AppDatabase): DiscountPresetDao = db.discountPresetDao()
    @Provides fun providePrinterConfigDao(db: AppDatabase): PrinterConfigDao = db.printerConfigDao()
    @Provides fun provideCancelReasonDao(db: AppDatabase): CancelReasonDao = db.cancelReasonDao()
    @Provides fun provideHeldOrderDao(db: AppDatabase): HeldOrderDao = db.heldOrderDao()
    @Provides fun provideHeldOrderItemDao(db: AppDatabase): HeldOrderItemDao = db.heldOrderItemDao()
    @Provides fun provideCustomerDao(db: AppDatabase): CustomerDao = db.customerDao()
}
