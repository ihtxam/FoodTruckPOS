package com.foodtruck.pos.sync

import com.foodtruck.pos.data.repository.TransactionRepository
import kotlinx.coroutines.delay
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SyncService @Inject constructor(
    private val transactionRepository: TransactionRepository
) {
    /**
     * Sync-ready architecture: push pending transactions to backend when online.
     * Replace simulation with Retrofit API calls.
     */
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
        delay(100)
        return true
    }
}

data class SyncResult(val synced: Int, val failed: Int)
