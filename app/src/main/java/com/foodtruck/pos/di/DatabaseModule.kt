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
    @Provides fun provideTransactionDao(db: AppDatabase): TransactionDao = db.transactionDao()
    @Provides fun provideBusinessSettingsDao(db: AppDatabase): BusinessSettingsDao = db.businessSettingsDao()
}
