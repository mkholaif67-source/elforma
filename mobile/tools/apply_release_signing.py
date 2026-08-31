#!/usr/bin/env python3
"""Apply a real release signing config to the freshly generated Android module.

Why this matters for "no warnings / safe with Google"
----------------------------------------------------
A release APK/AAB signed with the throw-away *debug* key is what makes a phone
shout "unsafe app" and blocks clean updates. A release build MUST be signed
with a stable *upload key*. This script:
  1. Decodes the base64 keystore from the environment into android/app.
  2. Writes android/key.properties from the environment secrets.
  3. Patches build.gradle.kts to load those properties and use a real
     `release` signingConfig instead of `signingConfigs.getByName("debug")`.

It reads everything from the environment so no secret is ever written into the
repository or the workflow file:
  ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD,
  ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD

If ANDROID_KEYSTORE_BASE64 is empty the script exits 0 without touching
anything, so an un-configured fork still builds (debug-signed) instead of
failing -- the workflow decides whether that is acceptable.

It is idempotent and verifies its own work.
"""
import base64
import os
import sys
from pathlib import Path

GRADLE = Path("android/app/build.gradle.kts")
KEYSTORE = Path("android/app/upload-keystore.jks")
KEYPROPS = Path("android/key.properties")

IMPORTS = "import java.util.Properties\nimport java.io.FileInputStream\n\n"
SETUP = (
    'val keystoreProperties = Properties()\n'
    'val keystorePropertiesFile = rootProject.file("key.properties")\n'
    'if (keystorePropertiesFile.exists()) {\n'
    '    keystoreProperties.load(FileInputStream(keystorePropertiesFile))\n'
    '}\n\n'
)
SIGNING = (
    '    signingConfigs {\n'
    '        create("release") {\n'
    '            keyAlias = keystoreProperties["keyAlias"] as String\n'
    '            keyPassword = keystoreProperties["keyPassword"] as String\n'
    '            storeFile = keystoreProperties["storeFile"]?.let { file(it) }\n'
    '            storePassword = keystoreProperties["storePassword"] as String\n'
    '        }\n'
    '    }\n\n'
)


def main() -> None:
    b64 = os.environ.get("ANDROID_KEYSTORE_BASE64", "").strip()
    if not b64:
        print("NOTE: ANDROID_KEYSTORE_BASE64 is empty -- skipping release signing "
              "(build will be debug-signed). Set the keystore secrets to sign.")
        return
    store_pw = os.environ.get("ANDROID_KEYSTORE_PASSWORD", "")
    alias = os.environ.get("ANDROID_KEY_ALIAS", "")
    key_pw = os.environ.get("ANDROID_KEY_PASSWORD", "")
    missing = [n for n, v in (
        ("ANDROID_KEYSTORE_PASSWORD", store_pw),
        ("ANDROID_KEY_ALIAS", alias),
        ("ANDROID_KEY_PASSWORD", key_pw),
    ) if not v]
    if missing:
        sys.exit("FAIL: keystore provided but missing: " + ", ".join(missing))

    KEYSTORE.write_bytes(base64.b64decode(b64))
    KEYPROPS.write_text(
        "storePassword=" + store_pw + "\n"
        "keyPassword=" + key_pw + "\n"
        "keyAlias=" + alias + "\n"
        "storeFile=upload-keystore.jks\n",
        encoding="utf-8",
    )

    if not GRADLE.is_file():
        sys.exit("FAIL: " + str(GRADLE) + " not found -- did `flutter create` run?")
    s = GRADLE.read_text(encoding="utf-8")
    if "val keystoreProperties = Properties()" not in s:
        s = IMPORTS + SETUP + s
    if 'signingConfigs {' not in s:
        if '    buildTypes {' not in s:
            sys.exit("FAIL: no `buildTypes {` block to anchor signingConfigs")
        s = s.replace('    buildTypes {', SIGNING + '    buildTypes {', 1)
    s = s.replace('signingConfig = signingConfigs.getByName("debug")',
                  'signingConfig = signingConfigs.getByName("release")')
    GRADLE.write_text(s, encoding="utf-8")

    final = GRADLE.read_text(encoding="utf-8")
    problems = []
    if 'signingConfigs.getByName("release")' not in final:
        problems.append('release signingConfig not wired into buildTypes')
    if 'create("release")' not in final:
        problems.append('release signingConfig block missing')
    if not KEYSTORE.is_file():
        problems.append('keystore not decoded')
    if problems:
        sys.exit("FAIL: " + "; ".join(problems))
    print("VERIFIED: release signing configured (upload key, key.properties, gradle wired)")


if __name__ == "__main__":
    main()
