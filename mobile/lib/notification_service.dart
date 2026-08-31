
// ── ElForma · notification_service.dart ──
// Local notifications + in-app promo/rest channels.

import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

class NotificationService {
  NotificationService._();
  static final NotificationService I = NotificationService._();
  final FlutterLocalNotificationsPlugin plugin = FlutterLocalNotificationsPlugin();
  bool _ready = false;
  String _zone = 'Africa/Cairo';

  Future<void> setLocation(String? iana) async {
    if (iana == null || iana.trim().isEmpty || iana == _zone) return;
    try {
      tz.setLocalLocation(tz.getLocation(iana));
      _zone = iana;
      final sp = await SharedPreferences.getInstance();
      await sp.setString('account_tz', iana);
    } catch (_) {}
  }

  Future<void> initialize() async {
    if (_ready) return;
    try {
      tz.initializeTimeZones();
      try {
        final saved = (await SharedPreferences.getInstance()).getString('account_tz');
        if (saved != null && saved.isNotEmpty) _zone = saved;
      } catch (_) {}
      try { tz.setLocalLocation(tz.getLocation(_zone)); } catch (_) { tz.setLocalLocation(tz.getLocation('Africa/Cairo')); }
      const settings = InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      );
      await plugin.initialize(settings);
      await plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.requestNotificationsPermission();
      await plugin.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()?.requestPermissions(alert: true, badge: true, sound: true);
      _ready = true;
    } catch (_) {
      _ready = false;
    }
  }

  NotificationDetails _details(String channel, String name, {bool alarmLike = false, String? sound}) {
    return NotificationDetails(
      android: AndroidNotificationDetails(
        channel + '_v3',
        name,
        channelDescription: 'تنبيهات تطبيق الفورمة',
        importance: alarmLike ? Importance.max : Importance.high,
        priority: alarmLike ? Priority.max : Priority.high,
        enableVibration: true,
        playSound: true,
        sound: sound == null ? null : RawResourceAndroidNotificationSound(sound),
        enableLights: true,
        category: alarmLike ? AndroidNotificationCategory.alarm : AndroidNotificationCategory.reminder,
        audioAttributesUsage: alarmLike ? AudioAttributesUsage.alarm : AudioAttributesUsage.notificationEvent,
      ),
      iOS: const DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
        interruptionLevel: InterruptionLevel.timeSensitive,
      ),
    );
  }

  Future<void> buzz({required String title, required String body, int id = 900, bool alarmLike = true}) async {
    await initialize();
    if (!_ready) return;
    await plugin.show(id, title, body, _details('timer_alerts', 'تنبيه التمرين', alarmLike: alarmLike, sound: 'workout_alert'));
  }

  Future<void> showAnnouncement({required String title, required String body, int id = 950}) async {
    await initialize();
    if (!_ready) return;
    await plugin.show(id, title, body, _details('promo_announcements', 'إشعارات العروض', sound: 'promo_alert'));
  }

  Future<void> showRestProgress({required int remaining, required int total, required bool enabled}) async {
    await initialize();
    if (!_ready || !enabled) return;
    final pct = total <= 0 ? 0 : ((total - remaining) * 100 ~/ total).clamp(0, 100);
    await plugin.show(
      951,
      'عداد الراحة شغال',
      'باقي ${_clock(remaining)} للمجموعة التالية',
      NotificationDetails(
        android: AndroidNotificationDetails(
          'rest_background_v1',
          'عداد الراحة بالخلفية',
          channelDescription: 'يظهر عداد الراحة أثناء التمرين بالخلفية',
          importance: Importance.low,
          priority: Priority.low,
          ongoing: true,
          onlyAlertOnce: true,
          showProgress: true,
          maxProgress: 100,
          progress: pct,
          playSound: false,
          category: AndroidNotificationCategory.progress,
        ),
        iOS: const DarwinNotificationDetails(presentAlert: false, presentBadge: false, presentSound: false),
      ),
    );
  }

  Future<void> cancelRestProgress() async {
    await plugin.cancel(951);
  }

  String _clock(int seconds) {
    final minutes = (seconds ~/ 60).toString();
    final rest = (seconds % 60).toString().padLeft(2, '0');
    return '$minutes:$rest';
  }

  tz.TZDateTime _next(int hour, int minute) {
    final now = tz.TZDateTime.now(tz.local);
    var next = tz.TZDateTime(tz.local, now.year, now.month, now.day, hour, minute);
    if (!next.isAfter(now)) next = next.add(const Duration(days: 1));
    return next;
  }

  Future<void> scheduleDaily({required int id, required int hour, required int minute, required String title, required String body, required String channel}) async {
    await initialize();
    if (!_ready) return;
    await plugin.zonedSchedule(
      id, title, body, _next(hour, minute), _details(channel, title, sound: 'reminder_alert'),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
      matchDateTimeComponents: DateTimeComponents.time,
    );
    _remember(id, hour);
  }

  Future<void> scheduleWeekly({required int id, required int weekday, required int hour, required int minute, required String title, required String body}) async {
    await initialize();
    if (!_ready) return;
    var next = _next(hour, minute);
    while (next.weekday != weekday) { next = next.add(const Duration(days: 1)); }
    await plugin.zonedSchedule(
      id, title, body, next, _details('weekly_progress', 'تذكير المتابعة', sound: 'reminder_alert'),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
      matchDateTimeComponents: DateTimeComponents.dayOfWeekAndTime,
    );
    _remember(id, hour);
  }

  Future<void> cancel(int id) async { _slotHours.remove(id); await plugin.cancel(id); }
  Future<void> cancelAll() async { _slotHours.clear(); await plugin.cancelAll(); }
  Future<int> scheduledCount() async { try { return (await plugin.pendingNotificationRequests()).length; } catch (_) { return 0; } }

  static bool inQuietHours(int hour, int startHour, int endHour) {
    if (startHour == endHour) return false;
    if (startHour < endHour) return hour >= startHour && hour < endHour;
    return hour >= startHour || hour < endHour;
  }

  final Map<int, int> _slotHours = {};
  void _remember(int id, int hour) { _slotHours[id] = hour; }

  Future<int> muteWindow(int startHour, int endHour) async {
    var muted = 0;
    for (final entry in _slotHours.entries.toList()) {
      if (inQuietHours(entry.value, startHour, endHour)) {
        await cancel(entry.key);
        muted++;
      }
    }
    return muted;
  }

  static const List<int> waterIds = [201, 202, 203, 204, 205, 206, 207, 208];
  Future<void> scheduleWater(bool enabled, {List<List<int>>? times}) async {
    for (final id in waterIds) { await cancel(id); }
    if (!enabled) return;
    final slots = (times == null || times.isEmpty) ? const [[10, 0], [14, 0], [18, 0]] : times;
    for (var i = 0; i < slots.length && i < waterIds.length; i++) {
      await scheduleDaily(id: waterIds[i], hour: slots[i][0], minute: slots[i][1], title: 'اشرب مياه', body: 'كوب مياه الآن يساعدك تكمل هدف اليوم', channel: 'water_reminders');
    }
  }

  static const List<int> workoutDayIds = [130, 131, 132, 133, 134, 135, 136];
  Future<void> scheduleWorkoutDays(bool enabled, {List<List<int>> slots = const []}) async {
    for (final id in workoutDayIds) { await cancel(id); }
    if (!enabled) return;
    for (var i = 0; i < slots.length && i < workoutDayIds.length; i++) {
      final s = slots[i];
      if (s.length < 3) continue;
      await scheduleWeekly(id: workoutDayIds[i], weekday: s[0], hour: s[1], minute: s[2], title: 'موعد تمرينك', body: 'حصة النهارده مستنياك. ابدأ وسجل أداءك');
    }
  }

  static const List<int> cardioIds = [140, 141, 142, 143, 144, 145, 146];
  Future<void> scheduleCardio(bool enabled, {List<List<int>> slots = const []}) async {
    for (final id in cardioIds) { await cancel(id); }
    if (!enabled) return;
    for (var i = 0; i < slots.length && i < cardioIds.length; i++) {
      final s = slots[i];
      if (s.length < 3) continue;
      await scheduleWeekly(id: cardioIds[i], weekday: s[0], hour: s[1], minute: s[2], title: 'موعد الكارديو', body: 'جلسة كارديو النهارده جزء من خطتك');
    }
  }

  static const List<int> mealIds = [220, 221, 222, 223, 224, 225, 226, 227];
  Future<void> scheduleMeals(bool enabled, {List<Map<String, dynamic>> meals = const []}) async {
    for (final id in mealIds) { await cancel(id); }
    if (!enabled) return;
    for (var i = 0; i < meals.length && i < mealIds.length; i++) {
      final m = meals[i];
      final label = '${m['label'] ?? 'وجبة'}';
      final hour = m['hour'] is int ? m['hour'] as int : 12;
      final minute = m['minute'] is int ? m['minute'] as int : 0;
      final cals = m['cals'];
      await scheduleDaily(
        id: mealIds[i],
        hour: hour,
        minute: minute,
        title: 'موعد $label',
        body: cals == null ? 'افتح خطتك وسجل $label' : '$label بتاعتك حوالي $cals سعرة افتح الخطة وسجلها',
        channel: 'nutrition_reminders',
      );
    }
  }
}
