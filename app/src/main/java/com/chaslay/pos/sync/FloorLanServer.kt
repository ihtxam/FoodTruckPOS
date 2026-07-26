package com.chaslay.pos.sync

import android.util.Log
import com.chaslay.pos.data.remote.dto.FloorOrderUpsertRequest
import com.chaslay.pos.data.remote.dto.FloorPrintJobRequest
import com.google.gson.Gson
import fi.iki.elonen.NanoHTTPD
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.runBlocking

@Singleton
class FloorLanServer @Inject constructor(
    private val floorSyncRepository: FloorSyncRepository
) {
    private val gson = Gson()
    private var server: NanoHTTPD? = null

    fun start() {
        if (server?.isAlive == true) return
        val repository = floorSyncRepository
        server = object : NanoHTTPD(PORT) {
            override fun serve(session: IHTTPSession): Response = runBlocking {
                handleRequest(session, repository)
            }
        }.also {
            runCatching { it.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false) }
                .onFailure { e -> Log.w(TAG, "Floor LAN server failed to start", e) }
                .onSuccess { Log.i(TAG, "Floor LAN server listening on port $PORT") }
        }
    }

    fun stop() {
        runCatching { server?.stop() }
        server = null
    }

    val isRunning: Boolean get() = server?.isAlive == true

    private suspend fun handleRequest(
        session: NanoHTTPD.IHTTPSession,
        repository: FloorSyncRepository
    ): NanoHTTPD.Response {
        val uri = session.uri.orEmpty()
        val method = session.method
        return when {
            method == NanoHTTPD.Method.GET && uri == "/health" ->
                jsonResponse(NanoHTTPD.Response.Status.OK, """{"ok":true}""")

            method == NanoHTTPD.Method.PUT && uri.startsWith(ORDERS_PREFIX) -> {
                val orderId = uri.removePrefix(ORDERS_PREFIX).trim('/')
                if (orderId.isBlank()) {
                    return jsonResponse(NanoHTTPD.Response.Status.BAD_REQUEST, """{"ok":false}""")
                }
                val body = readBody(session)
                val request = runCatching {
                    gson.fromJson(body, FloorOrderUpsertRequest::class.java)
                }.getOrNull() ?: return jsonResponse(NanoHTTPD.Response.Status.BAD_REQUEST, """{"ok":false}""")
                val ok = repository.handleLanOrder(orderId, request)
                jsonResponse(
                    if (ok) NanoHTTPD.Response.Status.OK else NanoHTTPD.Response.Status.INTERNAL_ERROR,
                    """{"ok":$ok}"""
                )
            }

            method == NanoHTTPD.Method.POST && uri == PRINT_JOBS_PATH -> {
                val body = readBody(session)
                val request = runCatching {
                    gson.fromJson(body, FloorPrintJobRequest::class.java)
                }.getOrNull() ?: return jsonResponse(NanoHTTPD.Response.Status.BAD_REQUEST, """{"ok":false}""")
                val ok = repository.handleLanPrintJob(request)
                jsonResponse(
                    if (ok) NanoHTTPD.Response.Status.OK else NanoHTTPD.Response.Status.INTERNAL_ERROR,
                    """{"ok":$ok}"""
                )
            }

            else -> jsonResponse(
                NanoHTTPD.Response.Status.NOT_FOUND,
                """{"ok":false,"error":"not found"}"""
            )
        }
    }

    private fun readBody(session: NanoHTTPD.IHTTPSession): String {
        val files = HashMap<String, String>()
        session.parseBody(files)
        return files["postData"].orEmpty().ifBlank {
            session.queryParameterString.orEmpty()
        }
    }

    private fun jsonResponse(status: NanoHTTPD.Response.Status, body: String): NanoHTTPD.Response =
        NanoHTTPD.newFixedLengthResponse(status, "application/json", body)

    companion object {
        private const val TAG = "FloorLanServer"
        const val PORT = 8787
        private const val ORDERS_PREFIX = "/v1/floor/orders/"
        private const val PRINT_JOBS_PATH = "/v1/floor/print-jobs"
    }
}
