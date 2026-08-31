// ── ElForma · background_poll.dart ──
// المسار الاحتياطي لإشعارات الأدمن: فحص دوري في الخلفية والتطبيق مقفول.
//
// ليه موجود: FCM لو التوكن مات أو المفتاح مش مضبوط، المتدرب ماكانش
// هيشوف الإشعار غير لما يفتح التطبيق بإيده. الفحص ده بيقفل الفجوة.
//
// ملاحزة مهمة: أندرويد مابيسمحش بفحص دوري أقل من 15 دقيقة، فأقل قيمة
// ممكنة هنا هي 15. الأدمن يقدر يزوّدها من إعدادات التطبيق في اللوحة.
//
// مفتاح 'seen_admin_notifs' متشارك مع shell_screen عمدًا، عشان الإشعار اللي
// وصل في الخلفية مايتكررش كنافذة تاني لما يفتح التطبيق.

import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';

import 'api.dart';
import 'notification_service.dart';

/// اسم المهمة الدورية ومعرّفها الفريد.
const String kPollTaskName = 'ef_admin_notif_poll';
const String kPollTaskId = 'ef_admin_notif_poll_unique';

/// نقطة دخول الـ isolate الخلفي. لازم تكون top-level ومعلّمة بـ vm:entry-point
/// وإلا الـ tree shaking في وضع release بيشيلها والفحص مابيشتغلش خالص.
@pragma('vm:entry-point')
void backgroundDispatcher() {
  Workmanager().executeTask((String task, Map<String, dynamic>? inputData) async {
    try {
      await Api.I.init();
      await NotificationService.I.initialize();
      await BackgroundPoll.runOnce();
    } catch (_) {
      // فشل الفحص ماينفعش يتحول لإعادة محاولة لا نهائية.
    }
    return true;
  });
}

class BackgroundPoll {
  BackgroundPoll._();

  /// تشغيل الفحص الدوري. بيقرأ المدة من إعدادات التطبيق اللي الأدمن
  /// بيتحكم فيها، ولو الأدمن قافل الإشعارات بيلغي المهمة خلاص.
  static Future<void> setup() async {
    int minutes = 15;
    bool enabled = true;
    try {
      final res = await Api.I.getAppConfig();
      if (res.ok && res.data['appConfig'] is Map) {
        final cfg = Map<String, dynamic>.from(res.data['appConfig'] as Map);
        final raw = cfg['pollMinutes'];
        final parsed = raw is num ? raw.toInt() : int.tryParse('$raw') ?? 15;
        minutes = parsed < 15 ? 15 : (parsed > 720 ? 720 : parsed);
        enabled = cfg['pushEnabled'] != false;
      }
    } catch (_) {}

    try {
      await Workmanager().initialize(backgroundDispatcher, isInDebugMode: false);
      // مهمة واحدة بمعرّف ثابت، فإعادة التسجيل بتستبدل القديمة مابتكررهاش.
      await Workmanager().cancelByUniqueName(kPollTaskId);
      if (!enabled) return;
      await Workmanager().registerPeriodicTask(
        kPollTaskId,
        kPollTaskName,
        frequency: Duration(minutes: minutes),
        initialDelay: Duration(minutes: minutes),
        constraints: Constraints(networkType: NetworkType.connected),
      );
    } catch (_) {
      // منصة مابتدعمش المهام الخلفية → بنكمل عادي بالفحص عند الفتح.
    }
  }

  /// الفحص الفعلي: بيجيب إشعارات الأدمن ويعرض اللي المستخدم ماشافهوش.
  /// الفلترة بالجمهور والجدولة بتحصل على السيرفر مش هنا.
  static Future<void> runOnce() async {
    final res = await Api.I.getAdminNotifications();
    if (!res.ok) return;
    final raw = res.data['items'];
    if (raw is! List) return;

    final sp = await SharedPreferences.getInstance();
    final seen = List<String>.from(sp.getStringList('seen_admin_notifs') ?? const <String>[]);
    final now = DateTime.now();
    int shown = 0;

    for (final entry in raw) {
      if (entry is! Map) continue;
      final item = Map<String, dynamic>.from(entry);

      final id = (item['id'] ?? '').toString();
      if (id.isEmpty || seen.contains(id)) continue;

      // مابنعرضش إشعار منتهي أو موعده لسه ماجاش.
      final expires = DateTime.tryParse((item['expires_at'] ?? '').toString());
      if (expires != null && expires.isBefore(now)) continue;
      final scheduled = DateTime.tryParse((item['scheduled_at'] ?? '').toString());
      if (scheduled != null && scheduled.isAfter(now)) continue;

      final title = (item['title'] ?? 'إشعار جديد').toString();
      final body = (item['body'] ?? '').toString();
      await NotificationService.I.showAnnouncement(
        title: title,
        body: body,
        id: 960 + shown,
      );

      seen.add(id);
      shown++;
      // حد أقصى ثلاثة في الفحص الواحد عشان مانغرقش المتدرب بإشعارات.
      if (shown >= 3) break;
    }

    if (shown > 0) {
      await sp.setStringList(
        'seen_admin_notifs',
        seen.length > 300 ? seen.sublist(seen.length - 300) : seen,
      );
    }
  }
}
