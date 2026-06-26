package com.foodtruck.pos.debug

import android.content.Context
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

data class CrashLogEntry(
    val fileName: String,
    val timestamp: Long,
    val title: String,
    val preview: String
)

@Singleton
class CrashLogger @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val crashDir: File
        get() = File(context.filesDir, "crashes").also { it.mkdirs() }

    fun installGlobalHandler() {
        val default = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            runCatching { recordCrash(throwable, thread.name) }
            default?.uncaughtException(thread, throwable)
        }
    }

    fun recordCrash(throwable: Throwable, threadName: String = Thread.currentThread().name) {
        val sw = StringWriter()
        throwable.printStackTrace(PrintWriter(sw))
        val body = buildString {
            appendLine("Thread: $threadName")
            appendLine("Message: ${throwable.message}")
            appendLine()
            append(sw.toString())
        }
        writeLog("crash", body)
        Log.e(TAG, "Crash recorded", throwable)
    }

    fun logError(tag: String, message: String, throwable: Throwable? = null) {
        val body = buildString {
            appendLine("Tag: $tag")
            appendLine("Message: $message")
            throwable?.let {
                appendLine()
                append(it.stackTraceToString())
            }
        }
        writeLog("error", body)
        if (throwable != null) Log.e(tag, message, throwable) else Log.e(tag, message)
    }

    fun listLogs(): List<CrashLogEntry> {
        return crashDir.listFiles()
            ?.filter { it.isFile && it.name.endsWith(".log") }
            ?.sortedByDescending { it.lastModified() }
            ?.map { file ->
                val lines = file.readLines()
                CrashLogEntry(
                    fileName = file.name,
                    timestamp = file.lastModified(),
                    title = lines.firstOrNull().orEmpty(),
                    preview = lines.drop(1).take(3).joinToString(" ").take(120)
                )
            }.orEmpty()
    }

    fun readLog(fileName: String): String {
        val file = File(crashDir, fileName)
        if (!file.exists() || !file.canonicalPath.startsWith(crashDir.canonicalPath)) return ""
        return file.readText()
    }

    fun clearLogs() {
        crashDir.listFiles()?.forEach { it.delete() }
    }

    private fun writeLog(prefix: String, body: String) {
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.US).format(Date())
        val file = File(crashDir, "${prefix}_$stamp.log")
        file.writeText(buildString {
            appendLine("${prefix.uppercase()} @ ${SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date())}")
            append(body)
        })
        trimOldLogs()
    }

    private fun trimOldLogs(maxFiles: Int = 50) {
        val files = crashDir.listFiles()?.sortedByDescending { it.lastModified() }.orEmpty()
        files.drop(maxFiles).forEach { it.delete() }
    }

    companion object {
        private const val TAG = "CrashLogger"
    }
}
