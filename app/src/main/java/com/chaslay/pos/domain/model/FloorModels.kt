package com.chaslay.pos.domain.model

enum class FloorDeviceRole(val apiValue: String) {
    MAIN_POS("MAIN_POS"),
    WAITER("WAITER"),
    STANDARD("STANDARD");

    companion object {
        fun fromApi(value: String?): FloorDeviceRole = entries.find {
            it.apiValue.equals(value, ignoreCase = true)
        } ?: STANDARD
    }
}

/** How waiter devices reach the main till: LAN, cloud, or both (auto). */
enum class FloorConnectionMode(val apiValue: String) {
    AUTO("AUTO"),
    LAN_ONLY("LAN"),
    CLOUD_ONLY("CLOUD");

    companion object {
        fun fromApi(value: String?): FloorConnectionMode = entries.find {
            it.apiValue.equals(value, ignoreCase = true)
        } ?: AUTO
    }
}
