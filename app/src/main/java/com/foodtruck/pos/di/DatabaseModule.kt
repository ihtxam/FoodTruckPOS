package com.foodtruck.pos.di

import android.content.Context
import androidx.room.Room
import com.foodtruck.pos.data.local.AppDatabase
import com.foodtruck.pos.data.local.DatabaseCallback
import com.foodtruck.pos.data.local.dao.BusinessSettingsDao
import com.foodtruck.pos.data.local.dao.CategoryDao
import com.foodtruck.pos.data.local.dao.ProductDao
import com.foodtruck.pos.data.local.dao.ProductVariantDao
import com.foodtruck.pos.data.local.dao.TransactionDao
import com.foodtruck.pos.data.local.dao.UserDao
import com.foodtruck.pos.data.local.dao.CancelReasonDao
import com.foodtruck.pos.data.local.dao.DiscountPresetDao
import com.foodtruck.pos.data.local.dao.HeldOrderDao
import com.foodtruck.pos.data.local.dao.HeldOrderItemDao
import com.foodtruck.pos.data.local.dao.PrinterConfigDao
import com.foodtruck.pos.data.local.dao.KitchenMessageDao
import com.foodtruck.pos.data.local.dao.RestaurantTableDao
import com.foodtruck.pos.data.local.dao.TableOrderDao
import com.foodtruck.pos.data.local.dao.TableOrderItemDao
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
            .addCallback(DatabaseCallback())
            .fallbackToDestructiveMigration()
            .build()

    @Provides fun provideUserDao(db: AppDatabase): UserDao = db.userDao()
    @Provides fun provideCategoryDao(db: AppDatabase): CategoryDao = db.categoryDao()
    @Provides fun provideProductDao(db: AppDatabase): ProductDao = db.productDao()
    @Provides fun provideProductVariantDao(db: AppDatabase): ProductVariantDao = db.productVariantDao()
    @Provides fun provideModifierGroupDao(db: AppDatabase): com.foodtruck.pos.data.local.dao.ModifierGroupDao = db.modifierGroupDao()
    @Provides fun provideModifierOptionDao(db: AppDatabase): com.foodtruck.pos.data.local.dao.ModifierOptionDao = db.modifierOptionDao()
    @Provides fun provideAddonGroupDao(db: AppDatabase): com.foodtruck.pos.data.local.dao.AddonGroupDao = db.addonGroupDao()
    @Provides fun provideAddonOptionDao(db: AppDatabase): com.foodtruck.pos.data.local.dao.AddonOptionDao = db.addonOptionDao()
    @Provides fun provideProductModifierGroupDao(db: AppDatabase): com.foodtruck.pos.data.local.dao.ProductModifierGroupDao = db.productModifierGroupDao()
    @Provides fun provideProductAddonGroupDao(db: AppDatabase): com.foodtruck.pos.data.local.dao.ProductAddonGroupDao = db.productAddonGroupDao()
    @Provides fun provideTransactionDao(db: AppDatabase): TransactionDao = db.transactionDao()
    @Provides fun provideBusinessSettingsDao(db: AppDatabase): BusinessSettingsDao = db.businessSettingsDao()
    @Provides fun provideRestaurantTableDao(db: AppDatabase): RestaurantTableDao = db.restaurantTableDao()
    @Provides fun provideTableOrderDao(db: AppDatabase): TableOrderDao = db.tableOrderDao()
    @Provides fun provideTableOrderItemDao(db: AppDatabase): TableOrderItemDao = db.tableOrderItemDao()
    @Provides fun provideKitchenMessageDao(db: AppDatabase): KitchenMessageDao = db.kitchenMessageDao()
    @Provides fun provideDiscountPresetDao(db: AppDatabase): DiscountPresetDao = db.discountPresetDao()
    @Provides fun providePrinterConfigDao(db: AppDatabase): PrinterConfigDao = db.printerConfigDao()
    @Provides fun provideCancelReasonDao(db: AppDatabase): CancelReasonDao = db.cancelReasonDao()
    @Provides fun provideHeldOrderDao(db: AppDatabase): HeldOrderDao = db.heldOrderDao()
    @Provides fun provideHeldOrderItemDao(db: AppDatabase): HeldOrderItemDao = db.heldOrderItemDao()
}
