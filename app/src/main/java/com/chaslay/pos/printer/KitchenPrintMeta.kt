package com.chaslay.pos.printer

import com.chaslay.pos.domain.model.FulfillmentType

data class KitchenPrintMeta(
    val orderNumber: String? = null,
    val fulfillmentType: FulfillmentType = FulfillmentType.WALK_IN,
    val pickupTimeMs: Long? = null,
    val orderedAtMs: Long? = null,
    /** POS, WAITERAPP, WEBPOS, ONLINE, etc. */
    val orderSource: String? = null,
    val cashierName: String? = null,
    val deliveryName: String? = null,
    val deliveryAddress: String? = null,
    val deliveryPhone: String? = null,
    val fireCourseNumber: Int? = null
)
