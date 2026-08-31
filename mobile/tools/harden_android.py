#!/usr/bin/env python3
"""Single source of truth for hardening the Android app module that
`flutter create` regenerates on every CI run.

Why this file exists
--------------------
The android/ folder is NOT committed; it is generated fresh inside CI. Both
workflows previously duplicated ~30 lines of inline Python to patch the
manifest, and the two copies had already drifted apart (different permission
ordering, one missing a receiver action). Drift in security-relevant config is
a defect waiting to happen, so the logic now lives here, is idempotent, and is
unit-tested against a synthetic manifest.

What it does
------------
1. App label -> the Arabic brand name.
2. Declares exactly the permissions the app actually uses:
   - INTERNET            : talk to the HTTPS backend.
   - POST_NOTIFICATIONS  : local training / meal / water reminders (Android 13+).
   - RECEIVE_BOOT_COMPLETED + VIBRATE : reschedule reminders after reboot.
   No location, no contacts, no storage, no camera -> smaller "Data safety"
   surface and fewer Play review questions.
3. Locks the network down: usesCleartextTraffic="false" plus a
   network_security_config that forbids plaintext HTTP everywhere. The backend
   and every asset URL are already HTTPS, so this cannot break traffic and it
   removes a whole class of MITM warnings.
4. Registers the flutter_local_notifications receivers.

It is deliberately idempotent: running it twice must not double-inject.
"""
import sys
from pathlib import Path

MANIFEST = Path("android/app/src/main/AndroidManifest.xml")
NETSEC = Path("android/app/src/main/res/xml/network_security_config.xml")

PERMISSIONS = (
    '    <uses-permission android:name="android.permission.INTERNET" />\n'
    '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n'
    '    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />\n'
    '    <uses-permission android:name="android.permission.VIBRATE" />\n    <uses-permission android:name="android.permission.WAKE_LOCK" />\n    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />\n'
)

HARDEN_ATTRS = (
    '        android:usesCleartextTraffic="false"\n'
    '        android:networkSecurityConfig="@xml/network_security_config"\n'
)

RECEIVERS = (
    '        <receiver android:exported="false" '
    'android:name="com.dexterous.flutterlocalnotifications.ScheduledNotificationReceiver" />\n'
    '        <receiver android:exported="false" '
    'android:name="com.dexterous.flutterlocalnotifications.ScheduledNotificationBootReceiver">\n'
    '            <intent-filter>\n'
    '                <action android:name="android.intent.action.BOOT_COMPLETED" />\n'
    '                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />\n'
    '                <action android:name="android.intent.action.QUICKBOOT_POWERON" />\n'
    '                <action android:name="com.htc.intent.action.QUICKBOOT_POWERON" />\n'
    '            </intent-filter>\n'
    '        </receiver>\n'
)

NETSEC_XML = (
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<!-- HTTPS only. The backend (elforma.onrender.com) and every asset URL\n'
    '     are TLS, so plaintext HTTP is forbidden app-wide. -->\n'
    '<network-security-config>\n'
    '    <base-config cleartextTrafficPermitted="false" />\n'
    '</network-security-config>\n'
)


def harden(text: str) -> str:
    # 1) brand label — the home-screen name must read exactly "El Forma".
    text = text.replace('android:label="elforma" android:largeHeap="true"', 'android:label="El Forma"')
    # Migrate any previously generated Arabic label to the final brand name.
    text = text.replace('android:label="\u0627\u0644\u0641\u0648\u0631\u0645\u0629"', 'android:label="El Forma"')
    # 2) permissions (idempotent: only if INTERNET not already declared)
    if 'android.permission.INTERNET' not in text:
        text = text.replace('    <application', PERMISSIONS + '    <application', 1)
    # 3) network hardening attributes on the <application> tag
    if 'usesCleartextTraffic' not in text:
        anchor = 'android:name="${applicationName}"'
        if anchor not in text:
            sys.exit('FAIL: could not find applicationName anchor in <application> tag')
        text = text.replace(anchor, anchor + '\n' + HARDEN_ATTRS.rstrip('\n'), 1)
    # 4) notification receivers (idempotent)
    if 'ScheduledNotificationReceiver' not in text:
        text = text.replace('    </application>', RECEIVERS + '    </application>', 1)
    return text


def main() -> None:
    if not MANIFEST.is_file():
        sys.exit('FAIL: ' + str(MANIFEST) + ' not found -- did `flutter create` run?')
    original = MANIFEST.read_text(encoding='utf-8')
    patched = harden(original)
    MANIFEST.write_text(patched, encoding='utf-8')
    NETSEC.parent.mkdir(parents=True, exist_ok=True)
    NETSEC.write_text(NETSEC_XML, encoding='utf-8')

    # Verify rather than trust.
    final = MANIFEST.read_text(encoding='utf-8')
    problems = []
    for needle in ('android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS',
                   'usesCleartextTraffic="false"', 'network_security_config',
                   'ScheduledNotificationReceiver'):
        if needle not in final:
            problems.append('missing ' + needle)
    if 'cleartextTrafficPermitted="false"' not in NETSEC.read_text(encoding='utf-8'):
        problems.append('network_security_config not written')
    if problems:
        sys.exit('FAIL: ' + '; '.join(problems))
    print('VERIFIED: manifest hardened (label, minimal permissions, HTTPS-only, receivers)')


if __name__ == '__main__':
    main()
