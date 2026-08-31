// ── ElForma · main.dart ──
// App entry point: sets up providers (ProfileStore, Api), theme and root routing.
// نقطة بدء التطبيق وتهيئة المزودات والثيم والتوجيه.

import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';
import 'theme.dart';
import 'screens/splash_screen.dart';
import 'notification_service.dart';
import 'models/smart_coach_store.dart';
import 'connectivity_service.dart';
import 'background_poll.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Api.I.init();
  await SmartCoachStore.I.init();
  await NotificationService.I.initialize();
  await ConnectivityService.I.init();
  // جدولة فحص الإشعارات في الخلفية. مابنستناهوش عشان مايأخّرش فتح التطبيق،
  // ولو فشل التسجيل التطبيق يفضل شغال عادي (التفاصيل في background_poll.dart).
  unawaited(BackgroundPoll.setup());
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    unawaited(_reportError('flutter', details.exceptionAsString(), details.stack?.toString() ?? ''));
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    unawaited(_reportError('platform', error.toString(), stack.toString()));
    return true;
  };
  runApp(const ElFormaApp());
}

Future<void> _reportError(String type, String message, String stack) async {
  try {
    final sp = await SharedPreferences.getInstance();
    if (sp.getBool('privacy_crash_reports') != true) return;
    await Api.I.sendClientEvent(type, message, stack);
  } catch (_) {}
}

class ElFormaApp extends StatelessWidget {
  const ElFormaApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'الفورمة',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: const SplashScreen(),
    );
  }
}
