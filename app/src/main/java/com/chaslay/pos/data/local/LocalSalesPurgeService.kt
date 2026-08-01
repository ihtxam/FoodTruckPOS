package com.chaslay.pos.data.local

import androidx.room.withTransaction
import com.chaslay.pos.data.local.dao.HeldOrderDao
import com.chaslay.pos.data.local.dao.HeldOrderItemDao
import com.chaslay.pos.data.local.dao.KitchenMessageDao
import com.chaslay.pos.data.local.dao.TableOrderDao
import com.chaslay.pos.data.local.dao.TableOrderItemDao
import com.chaslay.pos.data.local.dao.TransactionDao
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Removes all local sales / order history while keeping the menu catalog,
 * staff, business settings, and floor plan layout intact.
 */
@Singleton
class LocalSalesPurgeService @Inject constructor(
    private val db: AppDatabase,
    private val transactionDao: TransactionDao,
    private val heldOrderDao: HeldOrderDao,
    private val heldOrderItemDao: HeldOrderItemDao,
    private val tableOrderDao: TableOrderDao,
    private val tableOrderItemDao: TableOrderItemDao,
    private val kitchenMessageDao: KitchenMessageDao
) {
    suspend fun purgeAllSalesData() {
        db.withTransaction {
            heldOrderItemDao.deleteAll()
            heldOrderDao.deleteAll()
            kitchenMessageDao.deleteAll()
            tableOrderItemDao.deleteAll()
            tableOrderDao.deleteAll()
            transactionDao.deleteAllItems()
            transactionDao.deleteAllTransactions()
        }
    }
}
