// ── ElForma · screens/helper_units_screen.dart ──
// Helper units, rebuilt as a real hub INSIDE the workout section.
//
// Before this file a "unit" was nothing but an on/off switch buried in the
// account tab: the engine carried 57 real exercises with videos for these
// units and the user could never see a single one of them. Here a unit is
// something you open, browse and actually perform.
//
// الوحدات المساعدة: تتصفحها، تفتحها، وتنفذها فعليا.

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api.dart';
import '../models/profile_store.dart';
import '../theme.dart';

/// تمرين واحد جوه وحدة مساعدة، جاي من كتالوج المحرك.
class UnitExercise {
  final String name;
  final String desc;
  final String duration;
  final String videoId;
  final String equipment;
  final String fatigue;

  const UnitExercise({
    required this.name,
    required this.desc,
    required this.duration,
    required this.videoId,
    required this.equipment,
    required this.fatigue,
  });

  static UnitExercise fromJson(Map<String, dynamic> raw) => UnitExercise(
        name: '${raw['name'] ?? ''}',
        desc: '${raw['desc'] ?? ''}',
        duration: '${raw['duration'] ?? ''}',
        videoId: '${raw['videoId'] ?? ''}',
        equipment: '${raw['equipment'] ?? ''}',
        fatigue: '${raw['fatigue'] ?? ''}',
      );
}

/// وحدة مساعدة كاملة بتمارينها.
class HelperUnit {
  final String key;
  final String label;
  final int minutes;
  final bool active;
  final List<UnitExercise> exercises;

  const HelperUnit({
    required this.key,
    required this.label,
    required this.minutes,
    required this.active,
    required this.exercises,
  });

  static HelperUnit fromJson(Map<String, dynamic> raw) {
    final list = raw['exercises'];
    return HelperUnit(
      key: '${raw['key'] ?? ''}',
      label: '${raw['label'] ?? ''}',
      minutes: raw['minutes'] is int ? raw['minutes'] as int : 10,
      active: raw['active'] == true,
      exercises: list is List
          ? list
              .whereType<Map>()
              .map((e) => UnitExercise.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const <UnitExercise>[],
    );
  }

  HelperUnit copyWith({bool? active}) => HelperUnit(
        key: key,
        label: label,
        minutes: minutes,
        active: active ?? this.active,
        exercises: exercises,
      );
}

/// شكل كل وحدة: أيقونة ولون وسطر يشرح فايدتها بصراحة.
class UnitStyle {
  final IconData icon;
  final Color color;
  final String benefit;
  const UnitStyle(this.icon, this.color, this.benefit);
}

const Map<String, UnitStyle> kUnitStyles = {
  'warmup': UnitStyle(Icons.local_fire_department_rounded, AppColors.wo,
      'يرفع حرارة العضلة ويجهز المفاصل بيقلل خطر الإصابة بشكل واضح'),
  'stretch': UnitStyle(Icons.self_improvement_rounded, AppColors.nu,
      'بتحسن مدى الحركة وتخفف شد العضلات بعد الحصة'),
  'core': UnitStyle(Icons.center_focus_strong_rounded, Color(0xFF6C8EF5),
      'بيقوي وسط الجسم فيثبت ظهرك في السكوات والديدلفت'),
  'cardio': UnitStyle(Icons.directions_run_rounded, Color(0xFFFF6B8A),
      'بيرفع لياقة القلب ويزود الحرق اليومي'),
  'yoga': UnitStyle(Icons.spa_rounded, Color(0xFFB87FFF),
      'مرونة وتوازن وتهدئة للجهاز العصبي بعد الأيام التقيلة'),
  'breath': UnitStyle(Icons.air_rounded, Color(0xFF38B6FF),
      'تمارين تنفس بتهدي ضربات القلب وتحسن التركيز والنوم'),
  'recovery': UnitStyle(Icons.bedtime_rounded, Color(0xFF8BA8FF),
      'روتين استشفاء العضلة بتكبر وقت الراحة مش وقت التمرين'),
  'kegel': UnitStyle(Icons.favorite_rounded, Color(0xFFFFC857),
      'بيقوي عضلات قاع الحوض مهم للثبات وللصحة العامة'),
};

UnitStyle styleFor(String key) =>
    kUnitStyles[key] ??
    const UnitStyle(Icons.fitness_center_rounded, AppColors.wo2, '');

// ═══════════════════════════════════════════════════════════
// 1) الهب — قائمة الوحدات
// ═══════════════════════════════════════════════════════════

/// بيتعرض جوا تبويب التمرين (مش شاشة مستقلة في حسابي)، عشان كده
/// مافيش Scaffold ولا AppBar هنا — دي محتوى جوا التبويب.
class HelperUnitsHub extends StatefulWidget {
  const HelperUnitsHub({super.key});
  @override
  State<HelperUnitsHub> createState() => _HelperUnitsHubState();
}

class _HelperUnitsHubState extends State<HelperUnitsHub> {
  List<HelperUnit> units = <HelperUnit>[];
  bool loading = true;
  bool saving = false;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    final response = await Api.I.moduleCatalogue();
    if (!mounted) return;
    if (!response.ok) {
      setState(() {
        loading = false;
        error = response.friendlyError('\u0645\u0642\u062f\u0631\u0646\u0627\u0634 \u0646\u062d\u0645\u0644 \u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646 \u0627\u0644\u0645\u0643\u0645\u0644\u0629 \u062f\u0644\u0648\u0642\u062a\u064a');
      });
      return;
    }
    final raw = response.data['units'];
    setState(() {
      units = raw is List
          ? raw
              .whereType<Map>()
              .map((e) => HelperUnit.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : <HelperUnit>[];
      loading = false;
    });
  }

  /// تفعيل / إلغاء وحدة. بنحدث الواجهة فورا ونرجعها لو الحفظ فشل،
  /// عشان مايبانش إن الحاجة اتحفظت وهي مااتحفظتش.
  Future<void> _toggle(HelperUnit unit, bool value) async {
    if (saving) return;
    final index = units.indexWhere((u) => u.key == unit.key);
    if (index < 0) return;
    setState(() {
      units[index] = unit.copyWith(active: value);
      saving = true;
    });

    await ProfileStore.I.ensureLoaded();
    final profile = Map<String, dynamic>.from(ProfileStore.I.profile ?? {});
    profile['activeModules'] =
        units.where((u) => u.active).map((u) => u.key).toList();
    final response = await Api.I.saveMobileProfile(profile);
    if (!mounted) return;

    if (response.ok) {
      ProfileStore.I.apply(profile);
      setState(() => saving = false);
    } else {
      setState(() {
        units[index] = unit.copyWith(active: !value);
        saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('مقدرناش نحفظ دلوقتي جرب تاني')));
    }
  }

  void _open(HelperUnit unit) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => UnitDetailScreen(unit: unit),
    ));
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.wo));
    }
    if (error != null) {
      return _errorView();
    }
    final activeCount = units.where((u) => u.active).length;
    return RefreshIndicator(
      color: AppColors.wo,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        children: [
          _intro(activeCount),
          const SizedBox(height: 14),
          // شبكة مربعات بدل قائمة تحت بعض بطلب صاحب المشروع
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 11,
            crossAxisSpacing: 11,
            childAspectRatio: 0.92,
            children: units.map(_tile).toList(),
          ),
        ],
      ),
    );
  }

  Widget _errorView() => ListView(
        padding: const EdgeInsets.fromLTRB(18, 60, 18, 18),
        children: [
          const Icon(Icons.cloud_off_rounded, color: AppColors.muted, size: 44),
          const SizedBox(height: 12),
          Text(error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          const SizedBox(height: 16),
          Center(
            child: OutlinedButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('جرب تاني'),
            ),
          ),
        ],
      );

  Widget _intro(int activeCount) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.wo.withValues(alpha: .08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.wo.withValues(alpha: .22)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
            activeCount == 0
                ? '\u0645\u0627\u0641\u064a\u0634 \u062a\u0645\u0631\u064a\u0646 \u0645\u0643\u0645\u0644 \u0645\u0641\u0639\u0644 \u062f\u0644\u0648\u0642\u062a\u064a'
                : '$activeCount \u062a\u0645\u0631\u064a\u0646 \u0645\u0643\u0645\u0644 \u0645\u0641\u0639\u0644 \u0645\u0639 \u062c\u062f\u0648\u0644\u0643',
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5),
          ),
          const SizedBox(height: 6),
          const Text(
            'دي إضافات بتتركب على جدولك الأساسي. تقدر تفتح أي وحدة وتنفذها لوحدها في أي وقت حتى لو مش مفعلة',
            style: TextStyle(
                color: AppColors.muted, fontSize: 12, height: 1.5),
          ),
        ]),
      );

  /// مربع واحد جوا الشبكة
  Widget _tile(HelperUnit unit) {
    final style = styleFor(unit.key);
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
            color: unit.active
                ? style.color.withValues(alpha: .40)
                : AppColors.line),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => _open(unit),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                          color: style.color.withValues(alpha: .13),
                          borderRadius: BorderRadius.circular(13)),
                      child: Icon(style.icon, color: style.color, size: 21),
                    ),
                    const Spacer(),
                    Transform.scale(
                      scale: 0.78,
                      child: Switch(
                        value: unit.active,
                        onChanged: saving ? null : (v) => _toggle(unit, v),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(unit.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 14.5)),
                const SizedBox(height: 4),
                Expanded(
                  child: Text(style.benefit,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 11,
                          height: 1.45)),
                ),
                const SizedBox(height: 6),
                Row(children: [
                  _chip('${unit.exercises.length} تمرين', style.color),
                  const SizedBox(width: 6),
                  _chip('~${unit.minutes} دقيقة', AppColors.muted),
                ]),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _chip(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(
          color: color.withValues(alpha: .12),
          borderRadius: BorderRadius.circular(7),
        ),
        child: Text(text,
            style: TextStyle(
                fontSize: 10, fontWeight: FontWeight.w800, color: color)),
      );
}

// ═══════════════════════════════════════════════════════════
// 2) صفحة الوحدة — تمارينها الحقيقية بفيديوهاتها
// ==========================================================

class UnitDetailScreen extends StatelessWidget {
  final HelperUnit unit;
  const UnitDetailScreen({super.key, required this.unit});

  Future<void> _openVideo(BuildContext context, String id) async {
    if (id.isEmpty) return;
    final uri = Uri.parse('https://www.youtube.com/watch?v=' + id);
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تعذر فتح الفيديو')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final style = styleFor(unit.key);
    final empty = unit.exercises.isEmpty;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        centerTitle: true,
        title: Text(unit.label,
            style: const TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 110),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: style.color.withValues(alpha: .08),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: style.color.withValues(alpha: .22)),
            ),
            child: Row(children: [
              Icon(style.icon, color: style.color, size: 26),
              const SizedBox(width: 11),
              Expanded(
                child: Text(style.benefit,
                    style: const TextStyle(
                        color: AppColors.text, fontSize: 12, height: 1.55)),
              ),
            ]),
          ),
          const SizedBox(height: 16),
          if (empty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Text('مافيش تمارين متاحة للوحدة دي دلوقتي',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.muted, fontSize: 13)),
            )
          else ...[
            Text('تمارين الوحدة (${unit.exercises.length})',
                style: const TextStyle(
                    fontWeight: FontWeight.w900, fontSize: 13.5)),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 11,
              crossAxisSpacing: 11,
              childAspectRatio: 0.80,
              children: unit.exercises
                  .map((e) => _exerciseCard(context, e, style))
                  .toList(),
            ),
          ],
        ],
      ),
      bottomNavigationBar: empty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 14),
                child: SizedBox(
                  height: 52,
                  child: ElevatedButton.icon(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                          builder: (_) => UnitRunnerScreen(unit: unit)),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: style.color,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                    icon: const Icon(Icons.play_arrow_rounded,
                        color: Colors.white),
                    label: const Text('ابدأ الوحدة',
                        style: TextStyle(
                            color: Colors.white, fontWeight: FontWeight.w900)),
                  ),
                ),
              ),
            ),
    );
  }

  // مربع تمرين جوه الشبكة
  // الصورة فوق بنسبة ثابتة والاسم والمدة تحتها عشان كل المربعات تطلع متساوية
  Widget _exerciseCard(
      BuildContext context, UnitExercise exercise, UnitStyle style) {
    final id = exercise.videoId;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: id.isEmpty ? null : () => _openVideo(context, id),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(15)),
                child: AspectRatio(
                  aspectRatio: 16 / 10,
                  child: id.isEmpty
                      ? Container(
                          color: AppColors.bg,
                          child: Icon(style.icon,
                              color: AppColors.muted, size: 28))
                      : Stack(fit: StackFit.expand, children: [
                          Image.network(
                            'https://img.youtube.com/vi/' +
                                id +
                                '/mqdefault.jpg',
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                                color: AppColors.bg,
                                child: Icon(style.icon,
                                    color: AppColors.muted, size: 28)),
                          ),
                          const Center(
                            child: Icon(Icons.play_circle_fill,
                                color: Colors.white70, size: 34),
                          ),
                        ]),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 9, 10, 9),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(exercise.name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 12.5,
                                  height: 1.35)),
                        ),
                        if (exercise.duration.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: style.color.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(exercise.duration,
                                style: TextStyle(
                                    color: style.color,
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w800)),
                          ),
                      ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// 3) مشغل الوحدة — تمرين ورا تمرين مع مؤقت
// ═══════════════════════════════════════════════════════════

class UnitRunnerScreen extends StatefulWidget {
  final HelperUnit unit;
  const UnitRunnerScreen({super.key, required this.unit});
  @override
  State<UnitRunnerScreen> createState() => _UnitRunnerScreenState();
}

class _UnitRunnerScreenState extends State<UnitRunnerScreen> {
  int index = 0;
  int seconds = 0;
  bool running = false;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _toggleTimer() {
    if (running) {
      _timer?.cancel();
      setState(() => running = false);
      return;
    }
    setState(() => running = true);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => seconds++);
    });
  }

  void _resetTimer() {
    _timer?.cancel();
    setState(() {
      seconds = 0;
      running = false;
    });
  }

  void _next() {
    if (index >= widget.unit.exercises.length - 1) {
      _finish();
      return;
    }
    _timer?.cancel();
    setState(() {
      index++;
      seconds = 0;
      running = false;
    });
  }

  void _prev() {
    if (index == 0) return;
    _timer?.cancel();
    setState(() {
      index--;
      seconds = 0;
      running = false;
    });
  }

  void _finish() {
    _timer?.cancel();
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('خلصت ${widget.unit.label} تسلم إيدك 💪')));
  }

  Future<void> _openVideo(String id) async {
    if (id.isEmpty) return;
    final uri = Uri.parse('https://www.youtube.com/watch?v=' + id);
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('\u062a\u0639\u0630\u0631 \u0641\u062a\u062d \u0627\u0644\u0641\u064a\u062f\u064a\u0648')));
    }
  }

  // تبليغ الفيديو المكسور
  // مقصود يبقى صغير جدا وجنب الصورة مش زرار كبير يزحم الشاشة
  Future<void> _reportVideo(UnitExercise exercise) async {
    final res = await Api.I.reportBrokenVideo(
      exerciseKey: exercise.name,
      exerciseName: exercise.name,
      videoId: exercise.videoId,
      reason: 'unit:' + widget.unit.key,
    );
    if (!mounted) return;
    final ok = res.ok;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ok
          ? '\u0648\u0635\u0644\u0646\u0627 \u0628\u0644\u0627\u063a\u0643 \u0648\u0647\u0646\u0631\u0627\u062c\u0639 \u0627\u0644\u0641\u064a\u062f\u064a\u0648'
          : '\u0645\u0627\u0642\u062f\u0631\u0646\u0627\u0634 \u0646\u0628\u0639\u062a \u0627\u0644\u0628\u0644\u0627\u063a \u062d\u0627\u0648\u0644 \u062a\u0627\u0646\u064a'),
      duration: const Duration(seconds: 2),
    ));
  }

  // سطر رفيع تحت الفيديو
  Widget _reportLine(UnitExercise exercise) {
    if (exercise.videoId.isEmpty) return const SizedBox.shrink();
    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton.icon(
        onPressed: () => _reportVideo(exercise),
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 0),
          minimumSize: const Size(0, 26),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        icon: const Icon(Icons.flag_outlined, size: 13, color: AppColors.muted),
        label: const Text(
          '\u0627\u0644\u0641\u064a\u062f\u064a\u0648 \u0645\u0634 \u0634\u063a\u0627\u0644',
          style: TextStyle(
              fontSize: 11,
              color: AppColors.muted,
              fontWeight: FontWeight.w600),
        ),
      ),
    );
  }

  String get _clock {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final exercises = widget.unit.exercises;
    if (exercises.isEmpty) {
      return const Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(
            child: Text('مافيش تمارين',
                style: TextStyle(color: AppColors.muted))),
      );
    }
    final style = styleFor(widget.unit.key);
    final exercise = exercises[index];
    final isLast = index == exercises.length - 1;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        centerTitle: true,
        title: Text('${widget.unit.label} · ${index + 1}/${exercises.length}',
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 6, 18, 120),
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (index + 1) / exercises.length,
              minHeight: 5,
              backgroundColor: AppColors.line,
              valueColor: AlwaysStoppedAnimation<Color>(style.color),
            ),
          ),
          const SizedBox(height: 18),
          GestureDetector(
            onTap: () => _openVideo(exercise.videoId),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: exercise.videoId.isEmpty
                  ? Container(
                      height: 190,
                      color: AppColors.card,
                      child: Icon(style.icon, color: style.color, size: 46))
                  : Stack(alignment: Alignment.center, children: [
                      Image.network(
                        'https://img.youtube.com/vi/' +
                            exercise.videoId +
                            '/mqdefault.jpg',
                        height: 190,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                            height: 190,
                            color: AppColors.card,
                            child: Icon(style.icon,
                                color: style.color, size: 46)),
                      ),
                      Container(
                        padding: const EdgeInsets.all(11),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: .55),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.play_arrow_rounded,
                            color: Colors.white, size: 32),
                      ),
                    ]),
            ),
          ),
          _reportLine(exercise),
          const SizedBox(height: 6),
          Text(exercise.name,
              style:
                  const TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
          if (exercise.duration.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(exercise.duration,
                style: TextStyle(
                    color: style.color,
                    fontSize: 13,
                    fontWeight: FontWeight.w800)),
          ],
          if (exercise.desc.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(exercise.desc,
                style: const TextStyle(
                    color: AppColors.muted, fontSize: 12.5, height: 1.6)),
          ],
          const SizedBox(height: 20),
          _timerCard(style),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 14),
          child: Row(children: [
            if (index > 0) ...[
              SizedBox(
                height: 52,
                child: OutlinedButton(
                  onPressed: _prev,
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.line),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Icon(Icons.chevron_right_rounded,
                      color: AppColors.muted),
                ),
              ),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: _next,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: style.color,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text(isLast ? 'خلصت الوحدة' : 'التالي',
                      style: const TextStyle(
                          color: Colors.white, fontWeight: FontWeight.w900)),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _timerCard(UnitStyle style) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.line),
        ),
        child: Row(children: [
          Icon(Icons.timer_outlined, color: style.color, size: 22),
          const SizedBox(width: 12),
          Text(_clock,
              style: const TextStyle(
                  fontWeight: FontWeight.w900, fontSize: 24, letterSpacing: 1)),
          const Spacer(),
          IconButton(
            onPressed: _resetTimer,
            icon: const Icon(Icons.refresh_rounded, color: AppColors.muted),
          ),
          SizedBox(
            height: 40,
            child: ElevatedButton(
              onPressed: _toggleTimer,
              style: ElevatedButton.styleFrom(
                backgroundColor: running
                    ? AppColors.muted.withValues(alpha: .25)
                    : style.color,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(running ? 'إيقاف' : 'شغل',
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w900)),
            ),
          ),
        ]),
      );
}
