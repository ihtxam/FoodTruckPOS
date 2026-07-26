-keep class com.chaslay.pos.data.local.entity.** { *; }
-keep class com.chaslay.pos.data.remote.dto.** { *; }
-keep interface com.chaslay.pos.data.remote.** { *; }
-keepattributes Signature
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keepclassmembers,allowobfuscation class * {
  @com.google.gson.annotations.SerializedName <fields>;
}
-dontwarn com.google.gson.**
-keep class com.google.gson.** { *; }
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}
-dontwarn javax.xml.stream.**
-keep class org.dhatim.fastexcel.** { *; }
-keep class fi.iki.elonen.** { *; }
