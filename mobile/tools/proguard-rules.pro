# ElForma release shrinker keep-rules (OPTIONAL R8 / code shrinking).
#
# R8 obfuscation + shrinking reduces app size and reverse-engineering surface,
# which Google's own guidance recommends. It is OFF by default here because it
# must be validated on a real device build first (a bad keep-rule surfaces only
# at runtime). To turn it on, in android/app/build.gradle.kts set inside
# buildTypes.release:
#     isMinifyEnabled = true
#     isShrinkResources = true
#     proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"),
#                   "proguard-rules.pro")
#
# The rules below keep the reflection-driven pieces of our dependencies so the
# build does not crash when scheduling notifications.

# flutter_local_notifications uses Gson + reflection internally.
-keep class com.dexterous.** { *; }
-keep class com.google.gson.** { *; }
-keepattributes Signature
-keepattributes *Annotation*
-keepclassmembers,allowobfuscation class * {
  @com.google.gson.annotations.SerializedName <fields>;
}

# Flutter embedding + deferred components.
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**
