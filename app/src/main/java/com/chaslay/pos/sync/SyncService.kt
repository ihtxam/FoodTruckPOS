package com.chaslay.pos.sync

import android.util.Log
import com.chaslay.pos.data.repository.TransactionRepository
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

@Singleton
class SyncService @Inject constructor(
    private val transactionRepository: TransactionRepository,
    private val menuSyncRepository: MenuSyncRepository,
    private val terminalSyncRepository: TerminalSyncRepository,
    private val staffSyncRepository: StaffSyncRepository,
    private val onlineOrderSyncRepository: OnlineOrderSyncRepository
) {
    private val mutex = Mutex()
    private var lastFullSyncAt = 0L

    suspend fun syncAll(force: Boolean = false): FullSyncResult = mutex.withLock {
        val now = System.currentTimeMillis()
        if (!force && now - lastFullSyncAt < MIN_SYNC_INTERVAL_MS) {
            return FullSyncResult(skipped = true)
        }
        val menu = runCatching { menuSyncRepository.syncMenu() }
            .onFailure { Log.w(TAG, "Menu sync failed", it) }
            .getOrDefault(MenuSyncResult())
        val terminals = runCatching { terminalSyncRepository.syncTerminals() }
            .onFailure { Log.w(TAG, "Terminal sync failed", it) }
            .getOrDefault(TerminalSyncResult())
        val staff = runCatching { staffSyncRepository.syncStaff() }
            .onFailure { Log.w(TAG, "Staff sync failed", it) }
            .getOrDefault(StaffSyncResult())
        val orders = runCatching { onlineOrderSyncRepository.syncIncomingOrders() }
            .onFailure { Log.w(TAG, "Online order sync failed", it) }
            .getOrDefault(OnlineOrderSyncResult())
        val tx = runCatching { syncPendingTransactions() }
            .onFailure { Log.w(TAG, "Transaction sync failed", it) }
            .getOrDefault(SyncResult(0, 0))
        lastFullSyncAt = now
        FullSyncResult(menu = menu, terminals = terminals, staff = staff, orders = orders, transactions = tx)
    }

    suspend fun syncOnlineOrdersOnly(): OnlineOrderSyncResult =
        runCatching { onlineOrderSyncRepository.syncIncomingOrders() }
            .onFailure { Log.w(TAG, "Online order sync failed", it) }
            .getOrDefault(OnlineOrderSyncResult())

    suspend fun syncPendingTransactions(): SyncResult {
        val pending = transactionRepository.getPendingSyncTransactions()
        if (pending.isEmpty()) return SyncResult(0, 0)

        var synced = 0
        var failed = 0
        pending.forEach { transaction ->
            val success = pushToServer(transaction.id)
            if (success) {
                transactionRepository.markSynced(transaction.id)
                synced++
            } else {
                failed++
            }
        }
        return SyncResult(synced, failed)
    }

    private suspend fun pushToServer(transactionId: String): Boolean {
        // TODO: POST /v1/sync/transactions when backend endpoint is added
        return true
    }

    companion object {
        private const val TAG = "SyncService"
        private const val MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000L
    }
}

data class SyncResult(val synced: Int, val failed: Int)

data class FullSyncResult(
    val menu: MenuSyncResult = MenuSyncResult(),
    val terminals: TerminalSyncResult = TerminalSyncResult(),
    val staff: StaffSyncResult = StaffSyncResult(),
    val orders: OnlineOrderSyncResult = OnlineOrderSyncResult(),
    val transactions: SyncResult = SyncResult(0, 0),
    val skipped: Boolean = false
)
