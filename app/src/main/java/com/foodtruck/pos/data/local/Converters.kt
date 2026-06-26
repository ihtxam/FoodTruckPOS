package com.foodtruck.pos.data.local

import androidx.room.TypeConverter
import com.foodtruck.pos.domain.model.HeldOrderStatus
import com.foodtruck.pos.domain.model.PrintTarget
import com.foodtruck.pos.domain.model.PaymentMethod
import com.foodtruck.pos.domain.model.PaymentStatus
import com.foodtruck.pos.domain.model.FulfillmentType
import com.foodtruck.pos.domain.model.ServiceType
import com.foodtruck.pos.domain.model.SyncStatus
import com.foodtruck.pos.domain.model.TableOrderStatus
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

    @TypeConverter fun fromServiceType(value: ServiceType): String = value.name
    @TypeConverter fun toServiceType(value: String): ServiceType = ServiceType.fromName(value)

    @TypeConverter fun fromFulfillmentType(value: FulfillmentType): String = value.name
    @TypeConverter fun toFulfillmentType(value: String): FulfillmentType = FulfillmentType.fromName(value)

    @TypeConverter fun fromTableOrderStatus(value: TableOrderStatus): String = value.name
    @TypeConverter fun toTableOrderStatus(value: String): TableOrderStatus = TableOrderStatus.valueOf(value)

    @TypeConverter fun fromPrintTarget(value: PrintTarget): String = value.name
    @TypeConverter fun toPrintTarget(value: String): PrintTarget = PrintTarget.fromName(value)

    @TypeConverter fun fromHeldOrderStatus(value: HeldOrderStatus): String = value.name
    @TypeConverter fun toHeldOrderStatus(value: String): HeldOrderStatus = HeldOrderStatus.valueOf(value)
}
