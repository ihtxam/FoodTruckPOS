package com.chaslay.pos.sync

import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.Collections

object NetworkAddress {
    fun localIpv4(): String? {
        val interfaces = Collections.list(NetworkInterface.getNetworkInterfaces())
        for (intf in interfaces) {
            if (!intf.isUp || intf.isLoopback) continue
            val addresses = Collections.list(intf.inetAddresses)
            for (addr in addresses) {
                if (addr is Inet4Address && !addr.isLoopbackAddress) {
                    return addr.hostAddress
                }
            }
        }
        return null
    }

    fun localLanUrl(port: Int): String? {
        val ip = localIpv4() ?: return null
        return "http://$ip:$port"
    }
}
