package com.chaslay.pos.sync

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

@Singleton
class FloorSyncEvents @Inject constructor() {
    private val _tableOrdersChanged = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val tableOrdersChanged: SharedFlow<Unit> = _tableOrdersChanged.asSharedFlow()

    fun notifyTableOrdersChanged() {
        _tableOrdersChanged.tryEmit(Unit)
    }
}
