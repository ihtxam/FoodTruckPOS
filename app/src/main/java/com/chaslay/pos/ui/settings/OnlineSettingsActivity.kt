package com.chaslay.pos.ui.settings

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.Toast
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import com.chaslay.pos.BuildConfig
import com.chaslay.pos.R
import java.net.URLEncoder

/**
 * Opens the merchant dashboard Settings page inside a WebView (OrderPin-style)
 * when the device is online. Auth is injected via /pos-embed hash bridge.
 */
class OnlineSettingsActivity : ComponentActivity() {

    private var webView: WebView? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (!isOnline(this)) {
            Toast.makeText(this, R.string.online_settings_offline, Toast.LENGTH_LONG).show()
            finish()
            return
        }

        val token = intent.getStringExtra(EXTRA_TOKEN).orEmpty()
        val userJson = intent.getStringExtra(EXTRA_USER_JSON).orEmpty()
        val dashboardBase = intent.getStringExtra(EXTRA_DASHBOARD_URL)
            ?.trim()
            ?.trimEnd('/')
            ?.takeIf { it.isNotEmpty() }
            ?: BuildConfig.MERCHANT_DASHBOARD_URL.trim().trimEnd('/')
        val nextPath = intent.getStringExtra(EXTRA_NEXT_PATH) ?: "/merchant/settings"

        if (token.isBlank() || userJson.isBlank()) {
            Toast.makeText(this, R.string.online_settings_need_login, Toast.LENGTH_LONG).show()
            finish()
            return
        }

        val root = FrameLayout(this)
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(8), dp(8), dp(8), dp(8))
            setBackgroundColor(0xFF00897B.toInt())
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            val back = Button(this@OnlineSettingsActivity).apply {
                text = "?"
                setOnClickListener { finish() }
            }
            val title = TextView(this@OnlineSettingsActivity).apply {
                text = getString(R.string.online_settings_title)
                setTextColor(0xFFFFFFFF.toInt())
                textSize = 16f
                setPadding(dp(12), dp(10), dp(12), dp(10))
            }
            addView(back)
            addView(title)
        }
        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            isIndeterminate = true
            visibility = android.view.View.GONE
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(3)
            ).apply { topMargin = dp(56) }
        }
        val wv = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            ).apply { topMargin = dp(56) }
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val url = request?.url?.toString().orEmpty()
                    // Keep navigation inside the merchant panel origin.
                    return url.isNotBlank() && !url.startsWith(dashboardBase)
                }

                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                    progress.visibility = android.view.View.VISIBLE
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    progress.visibility = android.view.View.GONE
                }
            }
        }
        webView = wv
        root.addView(header)
        root.addView(wv)
        root.addView(progress)
        setContentView(root)

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    val w = webView
                    if (w != null && w.canGoBack()) w.goBack() else finish()
                }
            }
        )

        val encodedUser = URLEncoder.encode(userJson, Charsets.UTF_8.name())
        val encodedToken = URLEncoder.encode(token, Charsets.UTF_8.name())
        val next = URLEncoder.encode(nextPath, Charsets.UTF_8.name())
        val url = "$dashboardBase/pos-embed?next=$next#token=$encodedToken&user=$encodedUser"
        wv.loadUrl(url)
    }

    override fun onDestroy() {
        webView?.apply {
            stopLoading()
            destroy()
        }
        webView = null
        super.onDestroy()
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    companion object {
        private const val EXTRA_TOKEN = "dashboard_token"
        private const val EXTRA_USER_JSON = "dashboard_user_json"
        private const val EXTRA_DASHBOARD_URL = "dashboard_url"
        private const val EXTRA_NEXT_PATH = "next_path"

        fun isOnline(context: Context): Boolean {
            val cm = context.getSystemService(ConnectivityManager::class.java) ?: return false
            val network = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(network) ?: return false
            return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        }

        fun createIntent(
            context: Context,
            token: String,
            userJson: String,
            dashboardUrl: String?,
            nextPath: String = "/merchant/settings"
        ): Intent =
            Intent(context, OnlineSettingsActivity::class.java)
                .putExtra(EXTRA_TOKEN, token)
                .putExtra(EXTRA_USER_JSON, userJson)
                .putExtra(EXTRA_DASHBOARD_URL, dashboardUrl)
                .putExtra(EXTRA_NEXT_PATH, nextPath)
    }
}
