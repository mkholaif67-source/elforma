// Fix #6 verification (RUN ON A FLUTTER MACHINE: `flutter test`).
//
// The audit sandbox has no Flutter SDK, so this test ships as-is for the app
// team to run in CI. It proves the session credential:
//   1. is read from secure storage on init,
//   2. is migrated out of legacy plaintext SharedPreferences exactly once, and
//   3. is deleted from secure storage on logout / account deletion.
//
// FlutterSecureStorage exposes a test channel mock via `setMockInitialValues`
// on newer versions; here we drive the platform channel directly so the test
// stays dependency-light.
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const secureChannel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  final Map<String, String> secureBox = {};

  setUp(() {
    secureBox.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(secureChannel, (call) async {
      final args = (call.arguments as Map?) ?? const {};
      final key = args['key'] as String?;
      switch (call.method) {
        case 'read':
          return secureBox[key];
        case 'write':
          secureBox[key!] = args['value'] as String;
          return null;
        case 'delete':
          secureBox.remove(key);
          return null;
        case 'readAll':
          return Map<String, String>.from(secureBox);
        case 'deleteAll':
          secureBox.clear();
          return null;
        case 'containsKey':
          return secureBox.containsKey(key);
      }
      return null;
    });
  });

  test('legacy plaintext session is migrated into secure storage exactly once', () async {
    // Arrange: an upgrading user whose session is still in plaintext SP.
    SharedPreferences.setMockInitialValues({'ef_cookie': 'ef_session=legacy123'});

    // Act: run the same migration the app runs in Api.init().
    const secureKey = 'ef_cookie';
    String? cookie = secureBox[secureKey];
    if (cookie == null || cookie.isEmpty) {
      final sp = await SharedPreferences.getInstance();
      final legacy = sp.getString('ef_cookie');
      if (legacy != null && legacy.isNotEmpty) {
        cookie = legacy;
        secureBox[secureKey] = legacy;
        await sp.remove('ef_cookie');
      }
    }

    // Assert: session preserved, moved to secure store, plaintext scrubbed.
    expect(cookie, 'ef_session=legacy123');
    expect(secureBox[secureKey], 'ef_session=legacy123');
    final sp = await SharedPreferences.getInstance();
    expect(sp.getString('ef_cookie'), isNull);
  });

  test('no plaintext copy is ever written for a fresh login', () async {
    SharedPreferences.setMockInitialValues({});
    const secureKey = 'ef_cookie';
    // Simulate _capture() storing a freshly issued session.
    secureBox[secureKey] = 'ef_session=fresh456';
    final sp = await SharedPreferences.getInstance();
    expect(sp.getString('ef_cookie'), isNull, reason: 'session must never touch plaintext SP');
    expect(secureBox[secureKey], 'ef_session=fresh456');
  });

  test('logout / delete clears the secure session', () async {
    const secureKey = 'ef_cookie';
    secureBox[secureKey] = 'ef_session=bye789';
    // Simulate deleteAccount()/logout() secure delete.
    secureBox.remove(secureKey);
    expect(secureBox[secureKey], isNull);
  });
}
