package com.foodtruck.pos.printer

import com.foodtruck.pos.domain.model.FulfillmentType

data class KitchenPrintMeta(
    val orderNumber: String? = null,
    val fulfillmentType: FulfillmentType = FulfillmentType.WALK_IN,
    val pickupTimeMs: Long? = null,
    val cashierName: String? = null
)
