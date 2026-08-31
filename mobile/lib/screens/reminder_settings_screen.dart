// ── ElForma · screens/reminder_settings_screen.dart ──
// Reminder settings: schedules local notifications via NotificationService.
// إعدادات التذكير.

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api.dart';
import '../notification_service.dart';
import '../theme.dart';
import '../widgets/error_view.dart';
import 'custom_reminders_screen.dart';
import 'supplements_screen.dart';

class ReminderSettingsScreen extends StatefulWidget {
  const ReminderSettingsScreen({super.key});

  @override
  State<ReminderSettingsScreen> createState() => _ReminderSettingsScreenState();
}

class _ReminderSettingsScreenState extends State<ReminderSettingsScreen> {
  bool loading = true;
  bool workout = false, meals = false, water = false, weight = false;

  /// مواعيد المياه بقت ملك المستخدم: يزود ويقلل ويغير أي ميعاد،
  /// بدل 10ص/2م/6م المدفونة في الكود. مخزنة "ساعة:دقيقة" مفصولة بفاصلة.
  List<List<int>> waterTimes = [
    [10, 0],
    [14, 0],
    [18, 0],
  ];

  /// وجبات خطة اليوم زي ما المحرك رجعها (الفطار، قبل التمرين، الغدا…)
  /// عشان نعمل تنبيه لكل واحدة باسمها وسعراتها وميعادها.
  List<Map<String, dynamic>> planMeals = [];
  /// مواعيد التمرين لكل يوم لوحده [weekday 1-7, hour, minute]
  /// عددهم بيتحدد من أيام الجدول مش من رقم ثابت
  List<List<int>> workoutDays = [];
  bool cardio = false;
  List<List<int>> cardioDays = [];
  TimeOfDay workoutTime = const TimeOfDay(hour: 18, minute: 0);
  TimeOfDay mealTime = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay weightTime = const TimeOfDay(hour: 9, minute: 0);
  int pending = 0;
  bool syncing = false;

  // لوحة التحكم الرئيسية
  // مفتاح واحد فوق بيوقف كل إشعار في التطبيق من غير ما يمسح إعداداتك
  bool master = true;
  // هدوء ليلي من ولل
  bool quiet = false;
  TimeOfDay quietFrom = const TimeOfDay(hour: 23, minute: 0);
  TimeOfDay quietTo = const TimeOfDay(hour: 7, minute: 0);
  // عدد التنبيهات المجدولة فعليا من النظام
  int scheduled = 0;

  @override
  void initState() { super.initState(); _load(); }

  // Local storage genuinely can fail (a full disk, a corrupted preferences
  // file after a bad update). Without this the screen spun its spinner
  // forever and every reminder setting looked lost.
  String? error;

  Future<void> _load() async {
    if (!loading) setState(() { loading = true; error = null; });
    final SharedPreferences sp;
    final int queued;
    try {
      sp = await SharedPreferences.getInstance();
      queued = await Api.I.pendingOfflineCount();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = 'ماقدرناش نقرا إعدادات التذكير. جرب تاني';
      });
      return;
    }
    if (!mounted) return;
    setState(() {
      error = null;
      workout = sp.getBool('reminder_workout') ?? false;
      meals = sp.getBool('reminder_meals') ?? false;
      water = sp.getBool('reminder_water') ?? false;
      weight = sp.getBool('reminder_weight') ?? false;
      workoutTime = _time(sp.getString('reminder_workout_time'), workoutTime);
      mealTime = _time(sp.getString('reminder_meal_time'), mealTime);
      weightTime = _time(sp.getString('reminder_weight_time'), weightTime);
      waterTimes = _decodeTimes(sp.getString('reminder_water_times')) ?? waterTimes;
      cardio = sp.getBool('reminder_cardio') ?? false;
      master = sp.getBool('reminder_master') ?? true;
      quiet = sp.getBool('reminder_quiet') ?? false;
      quietFrom = _time(sp.getString('reminder_quiet_from'), quietFrom);
      quietTo = _time(sp.getString('reminder_quiet_to'), quietTo);
      workoutDays = _decodeDays(sp.getString('reminder_workout_days'));
      cardioDays = _decodeDays(sp.getString('reminder_cardio_days'));
      planMeals = _decodeMeals(sp.getString('reminder_meal_slots'));
      pending = queued;
      loading = false;
    });
    // الرقم اللي فوق لازم يكون من النظام نفسه مش صفر ثابت
    await _refreshCount();
  }

  /// مواعيد المياه مخزنة ك "10:0,14:0,18:0" — نص بسيط مايحتاجش JSON.
  List<List<int>>? _decodeTimes(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    final out = <List<int>>[];
    for (final part in raw.split(',')) {
      final bits = part.split(':');
      if (bits.length != 2) continue;
      final h = int.tryParse(bits[0]), m = int.tryParse(bits[1]);
      if (h == null || m == null) continue;
      out.add([h, m]);
    }
    return out.isEmpty ? null : out;
  }

  String _encodeTimes(List<List<int>> times) =>
      times.map((t) => '${t[0]}:${t[1]}').join(',');

  /// مواعيد الأيام مخزنة ك "2:18:0,5:10:30" يعني يوم:ساعة:دقيقة
  List<List<int>> _decodeDays(String? raw) {
    if (raw == null || raw.trim().isEmpty) return [];
    final out = <List<int>>[];
    for (final part in raw.split(',')) {
      final bits = part.split(':');
      if (bits.length != 3) continue;
      final d = int.tryParse(bits[0]);
      final h = int.tryParse(bits[1]);
      final m = int.tryParse(bits[2]);
      if (d == null || h == null || m == null) continue;
      out.add([d, h, m]);
    }
    out.sort((a, b) => a[0].compareTo(b[0]));
    return out;
  }

  String _encodeDays(List<List<int>> days) =>
      days.map((d) => '${d[0]}:${d[1]}:${d[2]}').join(',');

  static const List<String> _dayNames = [
    '', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت', 'الحد'
  ];

  /// وجبات الخطة مخزنة ك "الفطار|8:0|520;الغدا|14:0|700".
  List<Map<String, dynamic>> _decodeMeals(String? raw) {
    if (raw == null || raw.trim().isEmpty) return [];
    final out = <Map<String, dynamic>>[];
    for (final part in raw.split(';')) {
      final bits = part.split('|');
      if (bits.length < 2) continue;
      final hm = bits[1].split(':');
      if (hm.length != 2) continue;
      out.add({
        'label': bits[0],
        'hour': int.tryParse(hm[0]) ?? 12,
        'minute': int.tryParse(hm[1]) ?? 0,
        if (bits.length > 2 && int.tryParse(bits[2]) != null)
          'cals': int.parse(bits[2]),
      });
    }
    return out;
  }

  String _encodeMeals(List<Map<String, dynamic>> meals) => meals
      .map((m) =>
          '${m['label']}|${m['hour']}:${m['minute']}|${m['cals'] ?? ''}')
      .join(';');

  TimeOfDay _time(String? raw, TimeOfDay fallback) {
    final parts = (raw ?? '').split(':');
    if (parts.length != 2) return fallback;
    final h = int.tryParse(parts[0]), m = int.tryParse(parts[1]);
    return h == null || m == null ? fallback : TimeOfDay(hour: h, minute: m);
  }

  String _encoded(TimeOfDay value) => '${value.hour}:${value.minute}';

  // لو المفتاح الرئيسي مقفول ممنوع يتجدول أي تنبيه
  // بنحفظ اختيار المستخدم بس مابننفذهوش لحد ما يفتح المفتاح
  Future<void> _set(String type, bool enabled) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setBool('reminder_$type', enabled);
    if (!master) {
      if (!mounted) return;
      setState(() {
        if (type == 'workout') workout = enabled;
        else if (type == 'cardio') cardio = enabled;
        else if (type == 'meals') meals = enabled;
        else if (type == 'water') water = enabled;
        else weight = enabled;
      });
      return;
    }
    if (type == 'workout') {
      setState(() => workout = enabled);
      await NotificationService.I.cancel(101);
      // لو المستخدم ظبط مواعيد لكل يوم نستخدمها
      // غير كده نرجع للتنبيه اليومي الواحد زي الأول
      await NotificationService.I.scheduleWorkoutDays(false);
      if (enabled) {
        if (workoutDays.isNotEmpty) {
          await NotificationService.I
              .scheduleWorkoutDays(true, slots: workoutDays);
        } else {
          await NotificationService.I.scheduleDaily(id: 101, hour: workoutTime.hour,
              minute: workoutTime.minute, title: 'موعد تمرينك',
              body: 'حصة النهارده مستنياك. ابدأ وسجل أداءك', channel: 'workout_reminders');
        }
      }
    } else if (type == 'cardio') {
      setState(() => cardio = enabled);
      await NotificationService.I.scheduleCardio(enabled, slots: cardioDays);
    } else if (type == 'meals') {
      setState(() => meals = enabled);
      await NotificationService.I.cancel(102);
      if (enabled) await NotificationService.I.scheduleDaily(id: 102, hour: mealTime.hour,
          minute: mealTime.minute, title: 'خطتك الغذائية جاهزة',
          body: 'راجع وجبات اليوم وسجل المياه والوجبات المكتملة', channel: 'nutrition_reminders');
    } else if (type == 'water') {
      setState(() => water = enabled);
      await NotificationService.I.scheduleWater(enabled, times: waterTimes);
    } else {
      setState(() => weight = enabled);
      await NotificationService.I.cancel(104);
      if (enabled) await NotificationService.I.scheduleWeekly(id: 104, weekday: DateTime.saturday,
          hour: weightTime.hour, minute: weightTime.minute, title: 'متابعة تقدمك',
          body: 'سجل الوزن وقياسات الجسم لمقارنة الأسبوع الحالي');
    }
    await _applyQuietHours();
    await _refreshCount();
  }

  // الهدوء الليلي
  // بعد ما أي تنبيه يتجدول بنمر على كل المواعيد ونلغي اللي جوا وقت النوم
  // كدا الإعداد مش مجرد محفوظ في التليفون ده فعلا بيمنع الرنة
  Future<void> _applyQuietHours() async {
    if (!quiet || !master) return;
    await NotificationService.I.muteWindow(quietFrom.hour, quietTo.hour);
  }

  Future<void> _pickTime(String type, TimeOfDay current) async {
    final selected = await showTimePicker(context: context, initialTime: current);
    if (selected == null || !mounted) return;
    final sp = await SharedPreferences.getInstance();
    if (type == 'workout') {
      setState(() => workoutTime = selected);
      await sp.setString('reminder_workout_time', _encoded(selected));
      if (workout) await _set('workout', true);
    } else if (type == 'meals') {
      setState(() => mealTime = selected);
      await sp.setString('reminder_meal_time', _encoded(selected));
      if (meals) await _set('meals', true);
    } else {
      setState(() => weightTime = selected);
      await sp.setString('reminder_weight_time', _encoded(selected));
      if (weight) await _set('weight', true);
    }
  }

  /// تحكم كامل في مواعيد المياه: تعديل أي ميعاد، حذف، أو إضافة لغاية 8.
  Widget _waterTimesCard() {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.lightBlueAccent.withValues(alpha: .28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('مواعيد المياه',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5)),
          const SizedBox(height: 8),
          ...List.generate(waterTimes.length, (i) {
            final t = TimeOfDay(hour: waterTimes[i][0], minute: waterTimes[i][1]);
            return Row(children: [
              const Icon(Icons.water_drop_rounded,
                  size: 15, color: Colors.lightBlueAccent),
              const SizedBox(width: 8),
              Expanded(
                child: Text('التذكير ${i + 1}',
                    style: const TextStyle(color: AppColors.muted, fontSize: 12.5)),
              ),
              TextButton(
                onPressed: () => _editWaterTime(i),
                child: Text(t.format(context),
                    style: const TextStyle(fontWeight: FontWeight.w900)),
              ),
              IconButton(
                onPressed: waterTimes.length <= 1 ? null : () => _removeWaterTime(i),
                icon: const Icon(Icons.close_rounded, size: 17),
                color: AppColors.muted,
              ),
            ]);
          }),
          if (waterTimes.length < 8)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton.icon(
                onPressed: _addWaterTime,
                icon: const Icon(Icons.add_rounded, size: 17),
                label: const Text('إضافة ميعاد',
                    style: TextStyle(fontWeight: FontWeight.w900)),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _persistWater() async {
    final sp = await SharedPreferences.getInstance();
    await sp.setString('reminder_water_times', _encodeTimes(waterTimes));
    if (water) await NotificationService.I.scheduleWater(true, times: waterTimes);
  }

  Future<void> _editWaterTime(int i) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: waterTimes[i][0], minute: waterTimes[i][1]),
    );
    if (picked == null || !mounted) return;
    setState(() => waterTimes[i] = [picked.hour, picked.minute]);
    await _persistWater();
  }

  Future<void> _removeWaterTime(int i) async {
    setState(() => waterTimes.removeAt(i));
    await _persistWater();
  }

  Future<void> _addWaterTime() async {
    final picked = await showTimePicker(
        context: context, initialTime: const TimeOfDay(hour: 12, minute: 0));
    if (picked == null || !mounted) return;
    setState(() {
      waterTimes.add([picked.hour, picked.minute]);
      waterTimes.sort((a, b) => (a[0] * 60 + a[1]).compareTo(b[0] * 60 + b[1]));
    });
    await _persistWater();
  }

  /// تنبيه لكل وجبة في خطتك باسمها وميعادها مش تنبيه واحد عمومي.
  /// كرت تحكم في مواعيد أيام معينة
  /// بيتستخدم للتمرين وللكارديو
  Widget _daysCard({
    required String title,
    required String hint,
    required List<List<int>> days,
    required Color color,
    required String storageKey,
    required String kind,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: .28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5)),
          const SizedBox(height: 4),
          Text(hint,
              style: const TextStyle(
                  color: AppColors.muted, fontSize: 11.5, height: 1.5)),
          const SizedBox(height: 8),
          if (days.isEmpty)
            const Text('مافيش مواعيد لسة. زود أول يوم من تحت',
                style: TextStyle(
                    color: AppColors.muted, fontSize: 12, height: 1.6))
          else
            ...List.generate(days.length, (i) {
              final d = days[i];
              final t = TimeOfDay(hour: d[1], minute: d[2]);
              return Row(children: [
                Icon(Icons.event_rounded, size: 15, color: color),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(_dayNames[d[0]],
                      style: const TextStyle(fontSize: 12.5)),
                ),
                TextButton(
                  onPressed: () => _editDaySlot(days, i, storageKey, kind),
                  child: Text(t.format(context),
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded,
                      size: 17, color: AppColors.muted),
                  onPressed: () => _removeDaySlot(days, i, storageKey, kind),
                ),
              ]);
            }),
          if (days.length < 7)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton.icon(
                onPressed: () => _addDaySlot(days, storageKey, kind),
                icon: Icon(Icons.add_rounded, size: 18, color: color),
                label: Text('زود يوم', style: TextStyle(color: color)),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _persistDays(
      List<List<int>> days, String storageKey, String kind) async {
    days.sort((a, b) => a[0].compareTo(b[0]));
    final sp = await SharedPreferences.getInstance();
    await sp.setString(storageKey, _encodeDays(days));
    if (kind == 'workout' && workout) {
      await NotificationService.I.cancel(101);
      await NotificationService.I.scheduleWorkoutDays(true, slots: days);
    } else if (kind == 'cardio' && cardio) {
      await NotificationService.I.scheduleCardio(true, slots: days);
    }
  }

  Future<void> _addDaySlot(
      List<List<int>> days, String storageKey, String kind) async {
    final used = days.map((d) => d[0]).toSet();
    int weekday = 1;
    for (var i = 1; i <= 7; i++) {
      if (!used.contains(i)) { weekday = i; break; }
    }
    final picked = await showDialog<int>(
      context: context,
      builder: (ctx) => SimpleDialog(
        backgroundColor: AppColors.card,
        title: const Text('اختار اليوم',
            style: TextStyle(color: AppColors.text, fontWeight: FontWeight.w900)),
        children: List.generate(7, (i) {
          final d = i + 1;
          final taken = used.contains(d);
          return SimpleDialogOption(
            onPressed: taken ? null : () => Navigator.pop(ctx, d),
            child: Text(_dayNames[d],
                style: TextStyle(
                    color: taken ? AppColors.muted : AppColors.text)),
          );
        }),
      ),
    );
    if (picked == null || !mounted) return;
    weekday = picked;
    final time = await showTimePicker(
        context: context, initialTime: const TimeOfDay(hour: 18, minute: 0));
    if (time == null || !mounted) return;
    setState(() => days.add([weekday, time.hour, time.minute]));
    await _persistDays(days, storageKey, kind);
  }

  Future<void> _editDaySlot(
      List<List<int>> days, int i, String storageKey, String kind) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: days[i][1], minute: days[i][2]),
    );
    if (picked == null || !mounted) return;
    setState(() => days[i] = [days[i][0], picked.hour, picked.minute]);
    await _persistDays(days, storageKey, kind);
  }

  Future<void> _removeDaySlot(
      List<List<int>> days, int i, String storageKey, String kind) async {
    setState(() => days.removeAt(i));
    await _persistDays(days, storageKey, kind);
  }

  Widget _mealSlotsCard() {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.nu.withValues(alpha: .28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('تنبيه لكل وجبة',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5)),
          const SizedBox(height: 4),
          const Text(
            'المواعيد مأخودة من خطة وجباتك نفسها غير أي ميعاد يناسبك',
            style: TextStyle(color: AppColors.muted, fontSize: 11.5, height: 1.5),
          ),
          const SizedBox(height: 8),
          if (planMeals.isEmpty)
            const Text(
              'لسه مفيش خطة وجبات محفوظة. افتح تبويب التغذية الأول وهنظبط تنبيه لكل وجبة أوتوماتيك',
              style: TextStyle(color: AppColors.muted, fontSize: 12, height: 1.6),
            )
          else
            ...List.generate(planMeals.length, (i) {
              final m = planMeals[i];
              final t = TimeOfDay(
                  hour: m['hour'] as int, minute: m['minute'] as int);
              return Row(children: [
                const Icon(Icons.restaurant_rounded, size: 15, color: AppColors.nu),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    m['cals'] == null
                        ? '${m['label']}'
                        : '${m['label']} · ${m['cals']} سعرة',
                    style: const TextStyle(fontSize: 12.5),
                  ),
                ),
                TextButton(
                  onPressed: () => _editMealSlot(i),
                  child: Text(t.format(context),
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                ),
              ]);
            }),
        ],
      ),
    );
  }

  Future<void> _editMealSlot(int i) async {
    final m = planMeals[i];
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: m['hour'] as int, minute: m['minute'] as int),
    );
    if (picked == null || !mounted) return;
    setState(() {
      planMeals[i] = {...m, 'hour': picked.hour, 'minute': picked.minute};
    });
    final sp = await SharedPreferences.getInstance();
    await sp.setString('reminder_meal_slots', _encodeMeals(planMeals));
    if (meals) {
      await NotificationService.I.scheduleMeals(true, meals: planMeals);
    }
  }

  Future<void> _sync() async {
    setState(() => syncing = true);
    final remaining = await Api.I.flushOfflineQueue();
    if (!mounted) return;
    setState(() { syncing = false; pending = remaining; });
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(
        remaining == 0 ? 'تمت مزامنة كل البيانات' : 'ما زال $remaining تغييرا محفوظا على الهاتف')));
  }

  // المفتاح الرئيسي
  // قفل معناه إلغاء كل تنبيه مجدول فورا
  // فتح معناه إعادة بناء كل حاجة من إعداداتك المحفوظة زي ما كانت
  Future<void> _setMaster(bool value) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setBool('reminder_master', value);
    setState(() => master = value);
    if (!value) {
      await NotificationService.I.cancelAll();
    } else {
      await _rebuildAll();
    }
    await _refreshCount();
  }

  Future<void> _rebuildAll() async {
    await _set('workout', workout);
    await _set('cardio', cardio);
    await _set('meals', meals);
    await _set('water', water);
    await _set('weight', weight);
  }

  Future<void> _setQuiet(bool value) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setBool('reminder_quiet', value);
    setState(() => quiet = value);
  }

  Future<void> _pickQuiet(bool isFrom) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isFrom ? quietFrom : quietTo,
    );
    if (picked == null) return;
    final sp = await SharedPreferences.getInstance();
    await sp.setString(
        isFrom ? 'reminder_quiet_from' : 'reminder_quiet_to', _encoded(picked));
    setState(() {
      if (isFrom) {
        quietFrom = picked;
      } else {
        quietTo = picked;
      }
    });
  }

  Future<void> _refreshCount() async {
    final n = await NotificationService.I.scheduledCount();
    if (!mounted) return;
    setState(() => scheduled = n);
  }

  // البانل الرئيسي فوق الشاشة
  Widget _masterCard() => Container(
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
              color: master
                  ? AppColors.nu.withValues(alpha: .34)
                  : AppColors.line),
        ),
        child: Column(children: [
          Row(children: [
            Icon(
                master
                    ? Icons.notifications_active_rounded
                    : Icons.notifications_off_rounded,
                color: master ? AppColors.nu : AppColors.muted,
                size: 22),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('\u0643\u0644 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a',
                        style: TextStyle(
                            fontWeight: FontWeight.w900, fontSize: 14.5)),
                    const SizedBox(height: 3),
                    Text(
                        master
                            ? '$scheduled \u062a\u0646\u0628\u064a\u0647 \u0645\u062c\u062f\u0648\u0644 \u062f\u0644\u0648\u0642\u062a\u064a'
                            : '\u0643\u0644 \u0627\u0644\u062a\u0646\u0628\u064a\u0647\u0627\u062a \u0645\u0642\u0641\u0648\u0644\u0629 \u0648\u0625\u0639\u062f\u0627\u062f\u0627\u062a\u0643 \u0645\u062d\u0641\u0648\u0638\u0629',
                        style: const TextStyle(
                            color: AppColors.muted, fontSize: 11.5)),
                  ]),
            ),
            Switch(
                value: master,
                activeThumbColor: AppColors.nu,
                onChanged: _setMaster),
          ]),
          if (master) ...[
            const Divider(height: 22, color: AppColors.line),
            Row(children: [
              const Icon(Icons.bedtime_rounded,
                  color: AppColors.muted, size: 19),
              const SizedBox(width: 11),
              const Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('\u0647\u062f\u0648\u0621 \u0644\u064a\u0644\u064a',
                          style: TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 13.5)),
                      SizedBox(height: 3),
                      Text(
                          '\u0645\u0627\u0641\u064a\u0634 \u062a\u0646\u0628\u064a\u0647 \u064a\u0648\u0635\u0644\u0643 \u0648\u0627\u0646\u062a \u0646\u0627\u064a\u0645',
                          style: TextStyle(
                              color: AppColors.muted, fontSize: 11.5)),
                    ]),
              ),
              Switch(
                  value: quiet,
                  activeThumbColor: AppColors.nu,
                  onChanged: _setQuiet),
            ]),
            if (quiet)
              Padding(
                padding: const EdgeInsets.only(top: 9),
                child: Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _pickQuiet(true),
                      child: Text(
                          '\u0645\u0646 ' + quietFrom.format(context),
                          style: const TextStyle(fontSize: 12.5)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _pickQuiet(false),
                      child: Text(
                          '\u0644\u063a\u0627\u064a\u0629 ' + quietTo.format(context),
                          style: const TextStyle(fontSize: 12.5)),
                    ),
                  ),
                ]),
              ),
          ],
        ]),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(backgroundColor: AppColors.bg,
        title: const Text('التذكيرات والمزامنة', style: TextStyle(fontWeight: FontWeight.w900)), centerTitle: true),
      body: loading
          ? const LoadingView()
          : error != null
          ? ErrorView(message: error!, onRetry: _load, compact: true)
          : ListView(
        padding: const EdgeInsets.all(18), children: [
          _masterCard(),
          const SizedBox(height: 14),
          _syncCard(),
          const SizedBox(height: 18),
          const Text('\u062a\u0630\u0643\u064a\u0631\u0627\u062a\u0643', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
          const SizedBox(height: 9),
          // لو المفتاح الرئيسي مقفول بنوضح إن كل اللي تحت موقوف مؤقتا
          if (!master)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                  '\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u062f\u064a \u0645\u062d\u0641\u0648\u0638\u0629 \u0644\u0643\u0646 \u0645\u0648\u0642\u0648\u0641\u0629 \u0644\u062d\u062f \u0645\u0627 \u062a\u0641\u062a\u062d \u0627\u0644\u0645\u0641\u062a\u0627\u062d \u0641\u0648\u0642',
                  style: TextStyle(
                      color: AppColors.wo2.withValues(alpha: .9),
                      fontSize: 12,
                      fontWeight: FontWeight.w700)),
            ),
          _reminder(Icons.fitness_center, 'موعد التمرين', 'تذكير يومي', workout, AppColors.wo,
              (value) => _set('workout', value), () => _pickTime('workout', workoutTime), workoutTime.format(context)),
          if (workout) _daysCard(
            title: 'موعد مختلف لكل يوم تمرين',
            hint: 'لو بتتمرن يوم الصبح ويوم بالليل ظبط كل يوم لوحده',
            days: workoutDays,
            color: AppColors.wo,
            storageKey: 'reminder_workout_days',
            kind: 'workout',
          ),
          // الكارديو جوا بلوك التمرين لأنهما قرار واحد في دماغ المتدرب:
          // تنبيه الكارديو تحت تنبيه الجيم مباشرة مش تحت الوجبات والمية.
          _reminder(Icons.directions_run_rounded, 'موعد الكارديو',
              cardioDays.isEmpty
                  ? 'مافيش مواعيد مظبوطة لسة'
                  : '${cardioDays.length} أيام في الأسبوع',
              cardio, const Color(0xFF37E6C2),
              (value) => _set('cardio', value), null, null),
          if (cardio) _daysCard(
            title: 'أيام الكارديو',
            hint: 'زود اليوم والميعاد اللي يناسبك',
            days: cardioDays,
            color: const Color(0xFF37E6C2),
            storageKey: 'reminder_cardio_days',
            kind: 'cardio',
          ),
          _reminder(Icons.restaurant_rounded, 'خطة الوجبات', 'مراجعة الوجبات يوميا', meals, AppColors.nu,
              (value) => _set('meals', value), () => _pickTime('meals', mealTime), mealTime.format(context)),
          if (meals) _mealSlotsCard(),
          _reminder(Icons.water_drop_rounded, 'شرب المياه',
              '${waterTimes.length} مرات يوميا المواعيد بالمللي تحت', water,
              Colors.lightBlueAccent, (value) => _set('water', value), null, null),
          if (water) _waterTimesCard(),
          _reminder(Icons.monitor_weight_outlined, 'الوزن والقياسات', 'كل سبت', weight, const Color(0xFFFFC857),
              (value) => _set('weight', value), () => _pickTime('weight', weightTime), weightTime.format(context)),
          const SizedBox(height: 14),
          const Text('أقسام أخرى', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
          const SizedBox(height: 9),
          _navTile(Icons.medication_liquid_rounded, 'تنبيه المكملات',
              'حدد مكملاتك والتوقيت المثالي جاهز', const Color(0xFFB87FFF), const SupplementsScreen()),
          _navTile(Icons.alarm_add_rounded, 'تنبيه مخصص',
              'اعمل تنبيه لأي حاجة في أي وقت', const Color(0xFF38B6FF), const CustomRemindersScreen()),
          const SizedBox(height: 6),
          const Text('يمكنك إيقاف أي تذكير في أي وقت. مواعيد التذكيرات محفوظة على الهاتف',
              style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.5)),
        ],
      ),
    );
  }

  Widget _navTile(IconData icon, String title, String subtitle, Color color, Widget target) => InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => target)),
        child: Container(
          margin: const EdgeInsets.only(bottom: 9),
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: color.withValues(alpha: .13), borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 11),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
              const SizedBox(height: 2),
              Text(subtitle, style: const TextStyle(color: AppColors.muted, fontSize: 11, height: 1.4)),
            ])),
            const Icon(Icons.chevron_left_rounded, color: AppColors.muted),
          ]),
        ),
      );

  Widget _syncCard() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.line)),
        child: Row(children: [
          Container(width: 44, height: 44, decoration: BoxDecoration(color: AppColors.nu.withValues(alpha: .12), borderRadius: BorderRadius.circular(13)),
              child: Icon(pending == 0 ? Icons.cloud_done_outlined : Icons.cloud_upload_outlined, color: AppColors.nu)),
          const SizedBox(width: 11),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(pending == 0 ? 'بياناتك متزامنة' : '$pending تغييرات بانتظار الإنترنت', style: const TextStyle(fontWeight: FontWeight.w900)),
            const SizedBox(height: 3),
            Text(pending == 0 ? 'لا توجد بيانات معلقة على الهاتف' : 'لن تضيع؛ سيتم إرسالها تلقائيا عند عودة الاتصال',
                style: const TextStyle(color: AppColors.muted, fontSize: 10.5)),
          ])),
          if (pending > 0) IconButton(tooltip: 'مزامنة البيانات المعلقة', onPressed: syncing ? null : _sync,
              icon: syncing ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.sync_rounded, color: AppColors.nu)),
        ]),
      );

  Widget _reminder(IconData icon, String title, String subtitle, bool enabled, Color color,
      ValueChanged<bool> onChanged, VoidCallback? onTime, String? time) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.fromLTRB(13, 8, 8, 8),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(15), border: Border.all(color: enabled ? color.withValues(alpha: .42) : AppColors.line)),
        child: Row(children: [
          Icon(icon, color: color),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
            Text(subtitle, style: const TextStyle(color: AppColors.muted, fontSize: 10.5)),
          ])),
          if (time != null) TextButton(onPressed: onTime, child: Text(time, style: TextStyle(color: color, fontWeight: FontWeight.w900))),
          Switch(value: enabled, activeColor: color, onChanged: onChanged),
        ]),
      );
}
