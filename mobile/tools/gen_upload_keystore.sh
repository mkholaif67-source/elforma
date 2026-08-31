#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Generate the ONE upload key that makes ElForma a signed, updatable, Google-
# trusted app, then print the exact GitHub secrets to paste.
#
# Run this ONCE on your own machine (needs the JDK `keytool`, which ships with
# Android Studio / Temurin JDK). Keep the produced .jks + passwords safe and
# OFFLINE -- losing them means you can never update the app under the same
# identity again.
#
#   bash tools/gen_upload_keystore.sh
#
# It never commits anything; it only writes a local file and prints secrets.
# ---------------------------------------------------------------------------
set -euo pipefail

OUT="${1:-elforma-upload-keystore.jks}"
ALIAS="${KEY_ALIAS:-upload}"

if [ -f "$OUT" ]; then
  echo "Refusing to overwrite existing $OUT -- move it aside first." >&2
  exit 1
fi

read -r -s -p "Choose a keystore password: " STORE_PW; echo
read -r -s -p "Repeat keystore password:  " STORE_PW2; echo
[ "$STORE_PW" = "$STORE_PW2" ] || { echo "Passwords do not match" >&2; exit 1; }

keytool -genkeypair -v \
  -keystore "$OUT" \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$STORE_PW" -keypass "$STORE_PW" \
  -dname "CN=ElForma, OU=Mobile, O=ElForma, L=Cairo, C=EG"

echo
echo "============================================================"
echo " Add these four repository secrets on GitHub:"
echo "   Settings > Secrets and variables > Actions > New secret"
echo "============================================================"
echo "ANDROID_KEYSTORE_BASE64  ="
base64 -w0 "$OUT" 2>/dev/null || base64 "$OUT"
echo
echo "ANDROID_KEYSTORE_PASSWORD = (the password you just typed)"
echo "ANDROID_KEY_PASSWORD      = (the same password)"
echo "ANDROID_KEY_ALIAS         = $ALIAS"
echo "============================================================"
echo "Keep $OUT and the password backed up OFFLINE. Never commit them."
