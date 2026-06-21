package com.foodtruck.pos.data.local

import androidx.room.TypeConverter
import com.foodtruck.pos.domain.model.PaymentMethod
import com.foodtruck.pos.domain.model.PaymentStatus
import com.foodtruck.pos.domain.model.SyncStatus
import com.foodtruck.pos.domain.model.UserRole

class Converters {
    @TypeConverter fun fromUserRole(value: UserRole): String = value.name
    @TypeConverter fun toUserRole(value: String): UserRole = UserRole.valueOf(value)

    @TypeConverter fun fromPaymentMethod(value: PaymentMethod): String = value.name
    @TypeConverter fun toPaymentMethod(value: String): PaymentMethod = PaymentMethod.valueOf(value)

    @TypeConverter fun fromPaymentStatus(value: PaymentStatus): String = value.name
    @TypeConverter fun toPaymentStatus(value: String): PaymentStatus = PaymentStatus.valueOf(value)

    @TypeConverter fun fromSyncStatus(value: SyncStatus): String = value.name
    @TypeConverter fun toSyncStatus(value: String): SyncStatus = SyncStatus.valueOf(value)
}
