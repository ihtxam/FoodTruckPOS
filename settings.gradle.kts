pluginManagement {
    repositories {
        maven {
            url = uri("https://dl.google.com/dl/android/maven2/")
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("com.android.application") version "9.2.1" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
    id("com.google.dagger.hilt.android") version "2.59.2" apply false
    id("com.google.devtools.ksp") version "2.0.21-1.0.28" apply false
}

// Adyen Tap to Pay (In-Person Payments) SDK is served from a private Maven repo
// authenticated with an x-api-key. The key lives in local.properties (gitignored),
// so it never reaches source control.
val localProps = java.util.Properties()
localProps.apply {
    val f = file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val adyenSdkApiKey: String = localProps.getProperty("adyenSdkApiKey").orEmpty()
val adyenSdkApiKeyLive: String = localProps.getProperty("adyenSdkApiKeyLive").orEmpty()

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }

        if (adyenSdkApiKey.isNotBlank()) {
            maven {
                url = uri("https://pos-mobile-test.cdn.adyen.com/adyen-pos-android")
                credentials(HttpHeaderCredentials::class) {
                    name = "x-api-key"
                    value = adyenSdkApiKey
                }
                authentication { create<HttpHeaderAuthentication>("header") }
            }
        }
        if (adyenSdkApiKeyLive.isNotBlank()) {
            maven {
                url = uri("https://pos-mobile.cdn.adyen.com/adyen-pos-android")
                credentials(HttpHeaderCredentials::class) {
                    name = "x-api-key"
                    value = adyenSdkApiKeyLive
                }
                authentication { create<HttpHeaderAuthentication>("header") }
            }
        }
    }
}

rootProject.name = "ChaslayPOS"
include(":app")
