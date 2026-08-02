plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.dagger.hilt.android")
    id("com.google.devtools.ksp")
}

android {
    namespace = "com.chaslay.pos"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.chaslay.pos"
        minSdk = 25
        targetSdk = 35
        versionCode = 23
        versionName = "1.0.22"

        multiDexEnabled = true

        ndk {
            abiFilters += listOf("armeabi-v7a", "arm64-v8a", "x86", "x86_64")
        }

        buildConfigField("String", "LICENSE_API_BASE_URL", "\"https://api.chaslay.com/\"")
        buildConfigField("String", "TENANT_SLUG", "\"\"")
        buildConfigField("String", "SYNC_API_KEY", "\"ihtsham_76875hgf755rjgkjh7zrzrhvjhv\"")
        buildConfigField("int", "TRIAL_DAYS", "15")
        buildConfigField("int", "LICENSE_RENEWAL_WARNING_DAYS", "30")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        ksp {
            arg("room.schemaLocation", "$projectDir/schemas")
        }
    }

    signingConfigs {
        // Sideload/test phones reject unsigned APKs with "package is not valid".
        // Use RELEASE_* props when set; otherwise sign release with the debug keystore.
        create("release") {
            val releaseStore = (project.findProperty("RELEASE_STORE_FILE") as String?)
                ?.takeIf { it.isNotBlank() }
                ?.let { rootProject.file(it) }
                ?.takeIf { it.isFile }
            if (releaseStore != null) {
                storeFile = releaseStore
                storePassword = project.findProperty("RELEASE_STORE_PASSWORD") as String?
                keyAlias = project.findProperty("RELEASE_KEY_ALIAS") as String?
                keyPassword = project.findProperty("RELEASE_KEY_PASSWORD") as String?
            } else {
                storeFile = signingConfigs.getByName("debug").storeFile
                storePassword = signingConfigs.getByName("debug").storePassword
                keyAlias = signingConfigs.getByName("debug").keyAlias
                keyPassword = signingConfigs.getByName("debug").keyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
    implementation("androidx.multidex:multidex:2.0.1")
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.fragment:fragment-ktx:1.8.5")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.8.5")
    implementation("sh.calvin.reorderable:reorderable:2.4.3")

    implementation("com.google.dagger:hilt-android:2.59.2")
    ksp("com.google.dagger:hilt-android-compiler:2.59.2")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")
    implementation("androidx.hilt:hilt-work:1.2.0")
    ksp("androidx.hilt:hilt-compiler:1.2.0")

    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("com.google.zxing:core:3.5.3")
    implementation("com.google.mlkit:barcode-scanning:17.3.0")
    implementation("androidx.camera:camera-camera2:1.4.1")
    implementation("androidx.camera:camera-lifecycle:1.4.1")
    implementation("androidx.camera:camera-view:1.4.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.dhatim:fastexcel-reader:0.18.4")
    implementation("org.dhatim:fastexcel:0.18.4")
    implementation("com.fasterxml:aalto-xml:1.3.2")
    implementation("com.github.mik3y:usb-serial-for-android:3.9.0")
    implementation("org.nanohttpd:nanohttpd:2.3.1")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

/** Copies signed release/debug APKs to Downloads as chaslaypos-<versionName>.apk for phone testing. */
afterEvaluate {
    fun registerCopyApkTask(taskName: String, assembleTaskName: String, variantFolder: String, suffix: String) {
        tasks.register(taskName) {
            dependsOn(assembleTaskName)
            doLast {
                val versionName = android.defaultConfig.versionName
                val apkDir = layout.buildDirectory.dir("outputs/apk/$variantFolder").get().asFile
                val intermediatesDir = layout.buildDirectory.dir("intermediates/apk/$variantFolder").get().asFile

                // Prefer signed universal APKs; never ship *-unsigned.apk (phones reject them).
                val source = sequenceOf(apkDir, intermediatesDir)
                    .flatMap { it.walkTopDown() }
                    .filter { it.isFile && it.extension.equals("apk", ignoreCase = true) }
                    .filter { !it.name.contains("unsigned", ignoreCase = true) }
                    .maxByOrNull { it.lastModified() }
                    ?: error(
                        "No signed APK found in $apkDir or $intermediatesDir — run $assembleTaskName first. " +
                            "Do not install *-unsigned.apk (causes 'package is not valid' on phones)."
                    )
                val fileName = if (suffix.isEmpty()) {
                    "chaslaypos-$versionName.apk"
                } else {
                    "chaslaypos-$versionName-$suffix.apk"
                }
                val dest = rootProject.layout.projectDirectory.file("../$fileName").asFile
                dest.parentFile?.mkdirs()
                source.copyTo(dest, overwrite = true)
                logger.lifecycle("Test APK (signed, universal ABIs): ${dest.absolutePath}")
                logger.lifecycle("Install: adb install -r \"${dest.absolutePath}\"")
            }
        }
        tasks.named(assembleTaskName) {
            finalizedBy(taskName)
        }
    }

    registerCopyApkTask("copyReleaseApkForTesting", "assembleRelease", "release", suffix = "")
    registerCopyApkTask("copyDebugApkForTesting", "assembleDebug", "debug", suffix = "debug")
}
