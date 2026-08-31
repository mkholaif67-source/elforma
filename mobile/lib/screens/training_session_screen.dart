// ── ElForma · screens/training_session_screen.dart ──
// Live training session: log sets per exercise, pull exercise history, and render the
// workout Smart Coach card (next-target suggestion) sourced from lib/coach-progression.js.
// جلسة تدريب حية: تسجيل المجموعات + بطاقة المدرب الذكي.

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api.dart';
import '../models/engine_contracts.dart';
import '../notification_service.dart';
import '../models/smart_coach_store.dart';
import '../theme.dart';
import 'exercise_picker_screen.dart';

class TrainingSessionScreen extends StatefulWidget {
  final Map<String, dynamic> day;
  const TrainingSessionScreen({super.key, required this.day});

  @override
  State<TrainingSessionScreen> createState() => _TrainingSessionScreenState();
}

class _TrainingSessionScreenState extends State<TrainingSessionScreen> {
  int? sessionId;
  bool loading = true;
  bool finishing = false;
  String? error;
  int current = 0;
  String phase = 'warmup';
  // في شاشة التهدئة: نعرض 5 إطالات وبس والباقي بطلب المستخدم.
  bool _allStretches = false;
  late final List<WorkoutExercise> sessionExercises;
  late final DateTime started;
  Timer? sessionTicker;
  Timer? restTicker;
  int elapsed = 0;
  int restRemaining = 0;
  int restTotal = 0;
  bool restPaused = false;
  bool _restBackground = true;
  final Map<String, TextEditingController> weights = {};
  final Map<String, TextEditingController> reps = {};
  final Map<String, TextEditingController> rirs = {};
  final Map<String, Map<String, dynamic>> history = {};
  final Set<String> historyLoading = {};
  final Set<String> completed = {};

  List<WorkoutExercise> _initialExercises() {
    final raw = widget.day['exercises'] is List ? widget.day['exercises'] as List : const [];
    final result = <WorkoutExercise>[];
    for (var i = 0; i < raw.length; i++) {
      if (raw[i] is Map) result.add(WorkoutExercise.fromJson(raw[i] as Map, i));
    }
    return result;
  }
  List<WorkoutExercise> get exercises => sessionExercises;

  @override
  void initState() {
    super.initState();
    sessionExercises = _initialExercises();
    started = DateTime.now();
    sessionTicker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => elapsed = DateTime.now().difference(started).inSeconds);
    });
    _loadRestPref();
    _start();
  }

  Future<void> _loadRestPref() async { final sp = await SharedPreferences.getInstance(); if (mounted) setState(() => _restBackground = sp.getBool('rest_background_enabled') ?? true); }
  Future<void> _saveRestPref(bool v) async { final sp = await SharedPreferences.getInstance(); await sp.setBool('rest_background_enabled', v); if (mounted) setState(() => _restBackground = v); if (!v) { await NotificationService.I.cancelRestProgress(); } else if (restRemaining > 0) { await NotificationService.I.showRestProgress(remaining: restRemaining, total: restTotal, enabled: true); } }

  @override
  void dispose() {
    sessionTicker?.cancel();
    restTicker?.cancel();
    NotificationService.I.cancelRestProgress();
    for (final controller in weights.values) controller.dispose();
    for (final controller in reps.values) controller.dispose();
    for (final controller in rirs.values) controller.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    final key = (widget.day['key'] ?? widget.day['name'] ?? 'workout').toString();
    final name = (widget.day['name'] ?? 'جلسة تمرين').toString();
    final response = await Api.I.startWorkoutSession(key, name);
    if (!mounted) return;
    final session = response.data['session'];
    setState(() {
      loading = false;
      if (response.ok && session is Map) {
        sessionId = (session['id'] as num?)?.toInt();
        final oldSets = session['sets'] is List ? session['sets'] as List : const [];
        if (oldSets.isNotEmpty) phase = 'workout';
        for (final raw in oldSets.whereType<Map>()) {
          final key = '${raw['exercise_key']}:${raw['set_number']}';
          weights[key] = TextEditingController(text: '${raw['weight'] ?? ''}');
          reps[key] = TextEditingController(text: '${raw['reps'] ?? ''}');
          rirs[key] = TextEditingController(text: '${raw['rir'] ?? ''}');
          if (raw['completed'] == 1 || raw['completed'] == true) completed.add(key);
        }
      } else {
        error = response.error.isNotEmpty ? response.error : 'تعذر بدء الجلسة';
      }
    });
    if (response.ok && exercises.isNotEmpty) _loadHistory(exercises.first);
  }

  TextEditingController _weight(String key) =>
      weights.putIfAbsent(key, TextEditingController.new);
  TextEditingController _reps(String key) =>
      reps.putIfAbsent(key, TextEditingController.new);
  TextEditingController _rir(String key) =>
      rirs.putIfAbsent(key, TextEditingController.new);

  Future<void> _loadHistory(WorkoutExercise exercise) async {
    if (history.containsKey(exercise.key) || historyLoading.contains(exercise.key)) return;
    setState(() => historyLoading.add(exercise.key));
    final response = await Api.I.exerciseHistory(exercise.key);
    if (!mounted) return;
    setState(() {
      historyLoading.remove(exercise.key);
      if (response.ok) history[exercise.key] = response.data;
    });
  }

  Future<void> _toggleSet(WorkoutExercise exercise, int setNo) async {
    if (sessionId == null) return;
    final key = '${exercise.key}:$setNo';
    final next = !completed.contains(key);
    final weight = double.tryParse(_weight(key).text.trim()) ?? 0;
    final repetitions = int.tryParse(_reps(key).text.trim()) ?? 0;
    final rir = double.tryParse(_rir(key).text.trim());
    if (next && repetitions <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('اكتب عدد التكرارات الأول')));
      return;
    }
    final response = await Api.I.saveWorkoutSet({
      'sessionId': sessionId,
      'exerciseKey': exercise.key,
      'exerciseName': exercise.name,
      'setNumber': setNo,
      'weight': weight,
      'reps': repetitions,
      'rir': rir,
      'completed': next,
    });
    if (!mounted) return;
    if (response.ok) {
      setState(() => next ? completed.add(key) : completed.remove(key));
      if (next) {
        HapticFeedback.mediumImpact();
        _startRest(exercise.restSeconds);
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(response.error.isNotEmpty ? response.error : 'تعذر حفظ المجموعة')));
    }
  }

  // الحد الأدنى للراحة بين المجموعات — 45 ثانية علمياً (ACSM/Schoenfeld)
  // حتى لو القيمة من السيرفر أقل (بق سابق كان يعطي 15 ثانية)
  static const int _kMinRestSec = 45;

  void _startRest(int seconds) {
    restTicker?.cancel();
    final safeSeconds = seconds < _kMinRestSec ? _kMinRestSec : seconds;
    setState(() {
      restTotal = safeSeconds;
      restRemaining = safeSeconds;
      restPaused = false;
    });
    NotificationService.I.showRestProgress(remaining: restRemaining, total: restTotal, enabled: _restBackground);
    _runRestTimer();
  }

  void _runRestTimer() {
    restTicker?.cancel();
    restTicker = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (restRemaining <= 1) {
        timer.cancel();
        setState(() => restRemaining = 0);
        HapticFeedback.heavyImpact();
        SystemSound.play(SystemSoundType.alert);
        // SystemSound لوحده صوته خافت جدا وبيتبلع على أغلب أجهزة أندرويد،
        // ومابيشتغلش خالص لو الشاشة مقفولة. دي نغمة حقيقية بتوصل في الحالتين.
        NotificationService.I.cancelRestProgress();
        NotificationService.I.buzz(
          title: 'خلصت الراحة',
          body: 'جاهز للمجموعة التالية',
        );
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          backgroundColor: AppColors.nu,
          content: Text('خلصت الراحة جاهز للمجموعة التالية',
              style: TextStyle(color: Color(0xFF04231B), fontWeight: FontWeight.w900)),
        ));
      } else {
        setState(() => restRemaining--);
        NotificationService.I.showRestProgress(remaining: restRemaining, total: restTotal, enabled: _restBackground);
      }
    });
  }

  void _toggleRestPause() {
    if (restRemaining <= 0) return;
    if (restPaused) {
      setState(() => restPaused = false);
      NotificationService.I.showRestProgress(remaining: restRemaining, total: restTotal, enabled: _restBackground);
    _runRestTimer();
    } else {
      restTicker?.cancel();
      setState(() => restPaused = true);
    }
  }

  void _adjustRest(int delta) {
    setState(() {
      restRemaining = (restRemaining + delta).clamp(0, 600).toInt();
      restTotal = restTotal < restRemaining ? restRemaining : restTotal;
    });
    if (restRemaining == 0) { restTicker?.cancel(); NotificationService.I.cancelRestProgress(); } else { NotificationService.I.showRestProgress(remaining: restRemaining, total: restTotal, enabled: _restBackground); }
  }

  Future<void> _openVideo(WorkoutExercise exercise) async {
    if (exercise.videoId.isEmpty) return;
    final uri = Uri.parse('https://www.youtube.com/watch?v=${exercise.videoId}');
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تعذر فتح فيديو التمرين')));
    }
  }

  Future<void> _replaceExercise(WorkoutExercise exercise) async {
    final selected = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(builder: (_) => ExercisePickerScreen(currentName: exercise.name)),
    );
    if (!mounted || selected == null) return;
    final replacement = exercise.replaceWith(selected);
    setState(() {
      sessionExercises[current] = replacement;
      restTicker?.cancel();
      restRemaining = 0;
      NotificationService.I.cancelRestProgress();
    });
    await _loadHistory(replacement);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('تم استبدال ${exercise.name} ب ${replacement.name}'),
      ));
    }
  }

  Future<void> _finish() async {
    if (sessionId == null) return;
    setState(() => finishing = true);
    final response = await Api.I.finishWorkoutSession(sessionId!, elapsed, '');
    if (!mounted) return;
    setState(() => finishing = false);
    if (response.ok) {
      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          backgroundColor: AppColors.card,
          title: const Text('تمرين مكتمل'),
          content: Text('الجلسة اتحفظت بنجاح. أنجزت ${completed.length} مجموعة'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('تمام')),
          ],
        ),
      );
      if (mounted) Navigator.pop(context, true);
    } else {
      setState(() => error = response.error.isNotEmpty ? response.error : 'تعذر إنهاء الجلسة');
    }
  }

  String _clock(int seconds) {
    final minutes = (seconds ~/ 60).toString().padLeft(2, '0');
    final rest = (seconds % 60).toString().padLeft(2, '0');
    return '$minutes:$rest';
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.wo)));
    }
    if (error != null && sessionId == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(error!, textAlign: TextAlign.center),
        )),
      );
    }
    final allExercises = exercises;
    if (allExercises.isEmpty) {
      return Scaffold(appBar: AppBar(), body: const Center(child: Text('مفيش تمارين في اليوم ده')));
    }
    if (phase == 'warmup') return _warmupScreen(allExercises);
    if (phase == 'cooldown') return _cooldownScreen();
    final exercise = allExercises[current];
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        titleSpacing: 0,
        // Just the schedule + day name (e.g. "Anterior A") — no detailed
        // muscle breakdown in the title, per the product owner.
        title: Text(
          WorkoutExercise.splitDayName(widget.day['name']?.toString() ?? '')[0],
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
        ),
        actions: [
          Center(child: Padding(
            padding: const EdgeInsets.only(left: 16),
            child: Text(_clock(elapsed),
                style: const TextStyle(color: AppColors.wo2, fontWeight: FontWeight.w900)),
          )),
        ],
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: LinearProgressIndicator(
            value: (current + 1) / allExercises.length,
            minHeight: 7,
            borderRadius: BorderRadius.circular(8),
            color: AppColors.wo,
            backgroundColor: AppColors.line,
          ),
        ),
        const SizedBox(height: 8),
        Text('تمرين ${current + 1} من ${allExercises.length}',
            style: const TextStyle(color: AppColors.muted, fontSize: 12)),
        Expanded(child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            _videoCard(exercise),
            const SizedBox(height: 16),
            Text(exercise.name,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
            if (exercise.muscle.isNotEmpty)
              Text(exercise.muscle,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.muted)),
            const SizedBox(height: 12),
            Wrap(alignment: WrapAlignment.center, spacing: 7, runSpacing: 7, children: [
              _chip('${exercise.sets} مجموعات'),
              _chip('${exercise.reps} تكرار'),
              _chip('راحة ${exercise.restSeconds}ث'),
              if (exercise.rir.isNotEmpty) _chip('RIR ${exercise.rir}'),
              if (exercise.tempo.isNotEmpty) _chip('Tempo ${exercise.tempo}'),
            ]),
            if (exercise.progression.isNotEmpty) ...[
              const SizedBox(height: 14),
              _guidance(Icons.trending_up_rounded, 'التطور', exercise.progression, AppColors.nu),
            ],
            const SizedBox(height: 10),
            _coachCard(exercise),
            _historyCard(exercise),
            if (exercise.alternative.isNotEmpty) ...[
              const SizedBox(height: 9),
              _guidance(Icons.swap_horiz_rounded, 'البديل', exercise.alternative, AppColors.wo2),
            ],
            const SizedBox(height: 9),
            OutlinedButton.icon(
              onPressed: () => _replaceExercise(exercise),
              icon: const Icon(Icons.change_circle_outlined),
              label: const Text('اختيار بديل آمن'),
              style: OutlinedButton.styleFrom(foregroundColor: AppColors.wo2,
                  side: const BorderSide(color: AppColors.wo2)),
            ),
            if (restRemaining > 0) ...[
              const SizedBox(height: 16),
              _restPanel(),
            ],
            const SizedBox(height: 22),
            const Text('سجل مجموعاتك',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            ...List.generate(exercise.sets, (index) => _setRow(exercise, index + 1)),
          ],
        )),
        _navigation(allExercises.length),
      ]),
    );
  }

  Widget _videoCard(WorkoutExercise exercise) {
    if (exercise.videoId.isEmpty) {
      return Container(
        height: 155,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AppColors.line),
        ),
        child: const Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.fitness_center, color: AppColors.wo2, size: 48),
          SizedBox(height: 8),
          Text('لا يوجد فيديو لهذا التمرين', style: TextStyle(color: AppColors.muted)),
        ]),
      );
    }
    return InkWell(
      onTap: () => _openVideo(exercise),
      borderRadius: BorderRadius.circular(22),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: Stack(alignment: Alignment.center, children: [
          Image.network(
            'https://img.youtube.com/vi/${exercise.videoId}/hqdefault.jpg',
            height: 180,
            width: double.infinity,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(
              height: 180,
              color: AppColors.card,
              child: const Icon(Icons.play_circle_fill, color: AppColors.wo2, size: 62),
            ),
          ),
          Container(height: 180, color: Colors.black.withValues(alpha: .20)),
          Container(
            width: 62,
            height: 62,
            decoration: BoxDecoration(color: AppColors.wo.withValues(alpha: .94), shape: BoxShape.circle),
            child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 39),
          ),
          const Positioned(
            right: 12,
            bottom: 10,
            child: Text('شاهد الأداء الصحيح',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900,
                    shadows: [Shadow(color: Colors.black, blurRadius: 8)])),
          ),
          // [OWNER-RULE] زر صغير وشيك للإبلاغ عن مشكلة في الفيديو —
          // مايزحمش الواجهة، والبلاغ يتحول لواتساب الدعم.
          Positioned(
            left: 8,
            bottom: 8,
            child: Material(
              color: Colors.black.withValues(alpha: .38),
              borderRadius: BorderRadius.circular(999),
              child: InkWell(
                borderRadius: BorderRadius.circular(999),
                onTap: () => _reportBrokenVideo(exercise),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                  child: Text('الرابط لا يعمل؟',
                      style: TextStyle(color: Colors.white70, fontSize: 10.5,
                          fontWeight: FontWeight.w600)),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  /// [OWNER-RULE] الإبلاغ عن فيديو مكسور/مش شغال: بنسجل البلاغ
  /// في السيرفر ثم بنحوله لواتساب الدعم برسالة جاهزة.
  Future<void> _reportBrokenVideo(WorkoutExercise exercise) async {
    final r = await Api.I.reportBrokenVideo(
      exerciseKey: exercise.key,
      exerciseName: exercise.name,
      videoId: exercise.videoId,
      reason: 'broken_or_not_working',
    );
    if (!mounted) return;
    // رقم الدعم بييجي من السيرفر (support.whatsapp).
    final wa = (r.data['whatsapp'] ?? '').toString().replaceAll(RegExp(r'[^0-9]'), '');
    final msg = Uri.encodeComponent(
        'مرحبا، فيه مشكلة في فيديو تمرين «${exercise.name}» داخل التطبيق.');
    if (wa.isNotEmpty) {
      final uri = Uri.parse('https://wa.me/$wa?text=$msg');
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('وصلنا بلاغك — هنراجع الفيديو ونصلحه. شكرا ليك')));
  }

  Widget _guidance(IconData icon, String label, String value, Color color) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: color.withValues(alpha: .08), borderRadius: BorderRadius.circular(13),
            border: Border.all(color: color.withValues(alpha: .20))),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 9),
          Expanded(child: Text('$label: $value',
              style: const TextStyle(color: AppColors.text, fontSize: 12.5, height: 1.5))),
        ]),
      );

  /// Sprint 18 — «مدربك الذكي» for this lift.
  ///
  /// This is the website's progression brain (app/workout/ui/coach.js) surfaced in
  /// the app: double progression inside the rep range, then a load increase of
  /// incFor() kg, RIR waving across the mesocycle, a 10% back-off after two stalled
  /// sessions, and e1RM personal records. The numbers come from the server, which
  /// replays the trainee's own logged sets through those exact rules.
  Widget _coachCard(WorkoutExercise exercise) {
    final data = history[exercise.key];
    final coach = data != null && data['coach'] is Map
        ? (data['coach'] as Map).cast<String, dynamic>()
        : null;
    if (coach == null) return const SizedBox.shrink();
    // «المتابعة الذكية» مقفولة ← مانعرضش بطاقة المدرب.
    if (!SmartCoachStore.I.enabled) return const SizedBox.shrink();

    final hasBase = coach['hasBase'] == true;
    final deload = coach['deload'] == true;
    final weight = coach['suggestedWeight'];
    final reps = coach['suggestedReps'];
    final rir = coach['targetRir'];
    final bestE1rm = coach['bestE1rm'];
    final prs = (coach['personalRecords'] as num?)?.toInt() ?? 0;
    final progressions = (coach['progressions'] as num?)?.toInt() ?? 0;
    final increment = coach['increment'];
    final trend = coach['trend'] is Map ? (coach['trend'] as Map).cast<String, dynamic>() : null;
    final accent = deload ? AppColors.nu : AppColors.wo2;

    String fmt(dynamic v) {
      final n = (v as num?)?.toDouble();
      if (n == null) return '—';
      return n % 1 == 0 ? n.toStringAsFixed(0) : n.toStringAsFixed(1);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accent.withValues(alpha: 0.35)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(deload ? Icons.spa_rounded : Icons.psychology_alt_rounded, color: accent, size: 19),
          const SizedBox(width: 7),
          Text(deload ? 'مدربك الذكي · أسبوع تخفيف' : 'مدربك الذكي',
              style: TextStyle(color: accent, fontWeight: FontWeight.w900, fontSize: 13.5)),
        ]),
        const SizedBox(height: 10),
        if (hasBase) ...[
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(fmt(weight),
                style: TextStyle(color: accent, fontSize: 30, fontWeight: FontWeight.w900, height: 1)),
            const Padding(
              padding: EdgeInsets.only(bottom: 3, right: 4, left: 4),
              child: Text('كجم', style: TextStyle(color: AppColors.muted, fontSize: 12.5)),
            ),
            Text('× $reps عدة',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          ]),
          const SizedBox(height: 6),
          Text(
            deload
                ? 'حمل مخفض عن قصد الهدف تفريغ التعب مش التقدم. سيب $rir تكرار في الخزان'
                : 'سيب $rir تكرار في الخزان (RIR). لو وصلت ${coach['rangeHigh']} عدة الجلسة الجاية بنرفع ${fmt(increment)} كجم',
            style: const TextStyle(color: AppColors.muted, fontSize: 12.5, height: 1.5),
          ),
        ] else
          Text('${coach['text'] ?? 'سجل أول وزن عشان مدربك الذكي يبدأ يطور حملك'}',
              style: const TextStyle(color: AppColors.muted, fontSize: 13, height: 1.5)),
        if (hasBase) ...[
          const SizedBox(height: 12),
          Wrap(spacing: 7, runSpacing: 7, children: [
            if (bestE1rm != null) _coachStat('أقوى 1RM تقديري', '${fmt(bestE1rm)} كجم', AppColors.nu),
            if (prs > 0) _coachStat('أرقام قياسية', '$prs', AppColors.nu2),
            if (progressions > 0) _coachStat('مرات تطورت', '$progressions', accent),
            if ((coach['stall'] as num?) != null && (coach['stall'] as num).toInt() > 0)
              _coachStat('جلسات ثبات', '${coach['stall']}', AppColors.wo),
          ]),
        ],
        if (trend != null && (trend['pct'] as num?) != null && (trend['pct'] as num) != 0) ...[
          const SizedBox(height: 10),
          Row(children: [
            Icon(
              (trend['pct'] as num) > 0 ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
              size: 15,
              color: (trend['pct'] as num) > 0 ? AppColors.nu : AppColors.wo,
            ),
            const SizedBox(width: 5),
            Expanded(
              child: Text(
                'قوتك على التمرين دا اتغيرت ${fmt(trend['pct'])}% من أول مرة سجلت فيها (${fmt(trend['from'])} ← ${fmt(trend['to'])} كجم تقديري)',
                style: const TextStyle(color: AppColors.muted, fontSize: 11.5, height: 1.45),
              ),
            ),
          ]),
        ],
      ]),
    );
  }

  Widget _coachStat(String label, String value, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.28)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 10)),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 13)),
        ]),
      );

  Widget _historyCard(WorkoutExercise exercise) {
    if (historyLoading.contains(exercise.key)) {
      return const Center(child: Padding(
        padding: EdgeInsets.all(10),
        child: SizedBox(width: 18, height: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.nu)),
      ));
    }
    final data = history[exercise.key];
    final sets = data?['sets'] is List ? data!['sets'] as List : const [];
    if (sets.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(13),
            border: Border.all(color: AppColors.line)),
        child: const Row(children: [
          Icon(Icons.auto_awesome_outlined, color: AppColors.nu, size: 19),
          SizedBox(width: 9),
          Expanded(child: Text('أول مرة لهذا التمرين سجل أداءك لنقترح الحمل القادم',
              style: TextStyle(color: AppColors.muted, fontSize: 12))),
        ]),
      );
    }
    final completedSets = sets.whereType<Map>().where((set) => set['completed'] == true).toList();
    final source = completedSets.isNotEmpty ? completedSets : sets.whereType<Map>().toList();
    final best = source.reduce((a, b) {
      final av = (a['weight'] as num? ?? 0) * (1 + (a['reps'] as num? ?? 0) / 30);
      final bv = (b['weight'] as num? ?? 0) * (1 + (b['reps'] as num? ?? 0) / 30);
      return bv > av ? b : a;
    });
    final weight = (best['weight'] as num?)?.toDouble() ?? 0;
    final repsDone = (best['reps'] as num?)?.toInt() ?? 0;
    final rirDone = (best['rir'] as num?)?.toDouble();
    final numbers = RegExp(r'\d+').allMatches(exercise.reps)
        .map((match) => int.parse(match.group(0)!)).toList();
    final high = numbers.isEmpty ? 12 : numbers.last;
    final canIncrease = weight > 0 && repsDone >= high && (rirDone == null || rirDone >= 1.5);
    final suggestion = canIncrease ? ((weight * 1.025) * 2).round() / 2 : weight;
    final message = canIncrease
        ? 'أكملت الحد الأعلى؛ جرب ${suggestion.toStringAsFixed(1)} كجم'
        : 'ابدأ ب ${weight.toStringAsFixed(1)} كجم وحاول تحسين التكرارات أو RIR';
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(color: AppColors.nu.withValues(alpha: .07), borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.nu.withValues(alpha: .22))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Row(children: [
          Icon(Icons.history_rounded, color: AppColors.nu, size: 19),
          SizedBox(width: 7),
          Text('أداؤك السابق', style: TextStyle(fontWeight: FontWeight.w900)),
        ]),
        const SizedBox(height: 7),
        Text('${weight.toStringAsFixed(1)} كجم × $repsDone تكرار${rirDone == null ? '' : ' · RIR ${rirDone.toStringAsFixed(1)}'}',
            style: const TextStyle(color: AppColors.text, fontWeight: FontWeight.w800)),
        const SizedBox(height: 5),
        Text(message, style: const TextStyle(color: AppColors.nu, fontSize: 12, height: 1.45)),
      ]),
    );
  }

  Widget _restPanel() {
    final progress = restTotal <= 0 ? 0.0 : restRemaining / restTotal;
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: AppColors.nu.withValues(alpha: .09),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.nu.withValues(alpha: .35)),
      ),
      child: Column(children: [
        Row(children: [
          const Icon(Icons.timer_outlined, color: AppColors.nu),
          const SizedBox(width: 8),
          const Expanded(child: Text('وقت الراحة', style: TextStyle(fontWeight: FontWeight.w900))),
          Text(_clock(restRemaining),
              style: const TextStyle(color: AppColors.nu, fontSize: 25, fontWeight: FontWeight.w900)),
        ]),
        const SizedBox(height: 10),
        LinearProgressIndicator(value: progress, minHeight: 6, borderRadius: BorderRadius.circular(8),
            color: AppColors.nu, backgroundColor: AppColors.line),
        const SizedBox(height: 8),
        Row(mainAxisAlignment: MainAxisAlignment.end, children: [
          TextButton.icon(
            onPressed: () => _saveRestPref(!_restBackground),
            icon: Icon(_restBackground ? Icons.notifications_active_rounded : Icons.notifications_off_rounded, size: 18),
            label: Text(_restBackground ? 'خلفية شغالة' : 'خلفية مقفولة'),
          ),
          TextButton.icon(
            onPressed: _toggleRestPause,
            icon: Icon(restPaused ? Icons.play_arrow_rounded : Icons.pause_rounded, size: 18),
            label: Text(restPaused ? 'استكمال' : 'إيقاف'),
          ),
          TextButton(onPressed: () => _adjustRest(15), child: const Text('+15 ثانية')),
          TextButton(onPressed: () => _adjustRest(-restRemaining), child: const Text('تخطي')),
        ]),
      ]),
    );
  }

  Widget _setRow(WorkoutExercise exercise, int setNo) {
    final key = '${exercise.key}:$setNo';
    final done = completed.contains(key);
    return Container(
      margin: const EdgeInsets.only(bottom: 9),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: done ? AppColors.nu : AppColors.line),
      ),
      child: Row(children: [
        SizedBox(width: 30, child: Text('$setNo', textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.w900))),
        const SizedBox(width: 6),
        Expanded(child: TextField(
          controller: _weight(key),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          textAlign: TextAlign.center,
          decoration: const InputDecoration(labelText: 'الوزن', suffixText: 'كجم', isDense: true),
        )),
        const SizedBox(width: 8),
        Expanded(child: TextField(
          controller: _reps(key),
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          decoration: const InputDecoration(labelText: 'التكرار', isDense: true),
        )),
        const SizedBox(width: 6),
        SizedBox(width: 58, child: TextField(
          controller: _rir(key),
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          textAlign: TextAlign.center,
          decoration: const InputDecoration(labelText: 'RIR', isDense: true),
        )),
        IconButton(
          tooltip: done ? 'إلغاء تأكيد المجموعة $setNo' : 'تأكيد إتمام المجموعة $setNo',
          onPressed: () => _toggleSet(exercise, setNo),
          icon: Icon(done ? Icons.check_circle : Icons.radio_button_unchecked,
              color: done ? AppColors.nu : AppColors.muted),
        ),
      ]),
    );
  }

  Widget _navigation(int count) => Padding(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 18),
        child: Row(children: [
          if (current > 0) ...[
            IconButton.filledTonal(
                onPressed: () {
                  setState(() => current--);
                  _loadHistory(exercises[current]);
                },
                icon: const Icon(Icons.arrow_forward_rounded)),
            const SizedBox(width: 8),
          ],
          Expanded(child: SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: finishing
                  ? null
                  : current < count - 1
                      ? () {
                          restTicker?.cancel();
                          setState(() {
                            restRemaining = 0;
                            current++;
                          });
                          _loadHistory(exercises[current]);
                        }
                      : () => setState(() => phase = 'cooldown'),
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.wo,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
              child: finishing
                  ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                  : Text(current < count - 1 ? 'التمرين التالي' : 'الإطالة ثم الإنهاء',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
            ),
          )),
        ]),
      );

  // The engine writes the chosen helper units straight into the plan day
  // (warm / cooldown / stretch). Rendering them here is what turns a picked
  // unit into something the user actually does.
  List<MapEntry<String, String>> _engineSteps(String key, String label) {
    final raw = widget.day[key];
    if (raw is! List) return const [];
    final out = <MapEntry<String, String>>[];
    for (final item in raw) {
      final text = item?.toString().trim() ?? '';
      if (text.isEmpty) continue;
      out.add(MapEntry(label, text));
    }
    return out;
  }

  // إحماء عضلات اليوم: يجي جاهزا من المحرك (warmActivation).
  // The ids come straight from the website engine database - the app never
  // stores or invents a link of its own.
  List<Map<String, String>> _activationMoves() => _movesFrom('warmActivation');

  // إطالة عضلات اليوم: نفس العقد بالظبط (stretchCooldown) — المحرك
  // بيختار الحركات المناسبة لعضلات الجلسة بفيديوهاتها.
  List<Map<String, String>> _cooldownMoves() => _movesFrom('stretchCooldown');

  List<Map<String, String>> _movesFrom(String key) {
    final raw = widget.day[key];
    if (raw is! List) return const [];
    final out = <Map<String, String>>[];
    for (final item in raw) {
      if (item is! Map) continue;
      final name = item['name']?.toString().trim() ?? '';
      if (name.isEmpty) continue;
      out.add({
        'name': name,
        'detail': item['detail']?.toString().trim() ?? '',
        'videoId': item['videoId']?.toString().trim() ?? '',
      });
    }
    return out;
  }

  Future<void> _openVideoId(String id) async {
    if (id.isEmpty) return;
    final uri = Uri.parse('https://www.youtube.com/watch?v=' + id);
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تعذر فتح الفيديو')));
    }
  }

  List<Widget> _activationCards() =>
      _moveCards('تنشيط عضلات اليوم', _activationMoves());

  // كروت الحركات بفيديوهاتها — مستخدمة للإحماء وللإطالة بنفس التنزيم.
  List<Widget> _moveCards(String title, List<Map<String, String>> moves) {
    if (moves.isEmpty) return const [];
    return [
      Padding(
        padding: const EdgeInsets.only(top: 6, bottom: 10),
        child: Text(title,
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
      ),
      ...moves.map((m) {
        final id = m['videoId'] ?? '';
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(15),
            border: Border.all(color: AppColors.line),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(15),
            onTap: id.isEmpty ? null : () => _openVideoId(id),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Row(children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(11),
                  child: id.isEmpty
                      ? Container(
                          width: 92, height: 62, color: AppColors.bg,
                          child: const Icon(Icons.self_improvement_rounded,
                              color: AppColors.muted, size: 26))
                      : Image.network(
                          'https://img.youtube.com/vi/' + id + '/mqdefault.jpg',
                          width: 92, height: 62, fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                              width: 92, height: 62, color: AppColors.bg,
                              child: const Icon(Icons.play_circle_fill,
                                  color: AppColors.wo2, size: 26)),
                        ),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(m['name'] ?? '',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                      if ((m['detail'] ?? '').isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(m['detail'] ?? '',
                            style: const TextStyle(color: AppColors.muted, fontSize: 11, height: 1.4)),
                      ],
                    ],
                  ),
                ),
                if (id.isNotEmpty)
                  const Icon(Icons.play_circle_outline, color: AppColors.wo2, size: 22),
              ]),
            ),
          ),
        );
      }),
    ];
  }

  Widget _warmupScreen(List<WorkoutExercise> list) {
    final muscles = list.map((e) => e.muscle).where((e) => e.isNotEmpty).take(3).join('، ');
    final steps = <MapEntry<String, String>>[
      const MapEntry('رفع حرارة الجسم', '3 5 دقائق مشي سريع أو دراجة بمجهود خفيف'),
      const MapEntry('حركة المفاصل', 'دوائر للكتف والحوض والكاحل × 8 لكل اتجاه'),
      MapEntry('تنشيط عضلات اليوم', muscles.isEmpty ? 'حركات خفيفة للعضلات المستهدفة' : 'حركات خفيفة ل $muscles'),
      const MapEntry('مجموعات تمهيدية', 'نفذ مجموعتين من أول تمرين: 50% ثم 70% من حمل العمل بدون إجهاد'),
    ];
    return _phaseScaffold(
      title: 'الإحماء',
      icon: Icons.local_fire_department_rounded,
      color: AppColors.wo,
      intro: 'لا تبدأ بالحمل الأساسي مباشرة. الإحماء يجهز المفاصل ويحسن الأداء',
      steps: steps,
      extra: _activationCards(),
      button: 'ابدأ التمرين',
      onPressed: () {
        setState(() => phase = 'workout');
        if (exercises.isNotEmpty) _loadHistory(exercises.first);
      },
    );
  }

  // الإطالة كانت مزعجة: المحرك بيرجع ممكن 14 حركة، وكلها كانت بتترمي في
  // نفس اللستة المرقمة بعنوان مكرر «إطالة من وحداتك» 18 مرة ورا بعض.
  // بقت زي الإحماء بالظبط: 4 خطوات أساسية مرقمة وبس، وحركات الوحدات
  // في قسم مستقل تحتيه بعنوان واحد، من غير تكرار ومن غير ترقيم طويل.
  List<Widget> _stretchCards() {
    // لو المحرك بعت إطالات مختارة بفيديوهات، هي الأصل ومافيش داعي
    // لللستة النصية القديمة تحتيها.
    if (_cooldownMoves().isNotEmpty) return const [];
    final items = <String>[];
    for (final e in [
      ..._engineSteps('stretch', ''),
      ..._engineSteps('cooldown', ''),
    ]) {
      final v = e.value.trim();
      if (v.isEmpty || items.contains(v)) continue;
      items.add(v);
    }
    if (items.isEmpty) return const [];
    final shown = _allStretches ? items : items.take(5).toList();
    return [
      Padding(
        padding: const EdgeInsets.only(top: 14, bottom: 8),
        child: Row(children: [
          const Icon(Icons.spa_rounded, color: AppColors.nu, size: 18),
          const SizedBox(width: 7),
          const Expanded(
            child: Text('إطالات وحداتك',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
          ),
          Text('${items.length} حركة',
              style: const TextStyle(color: AppColors.muted, fontSize: 12)),
        ]),
      ),
      Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          children: [
            for (var i = 0; i < shown.length; i++) ...[
              if (i > 0)
                const Divider(height: 1, thickness: 1, color: AppColors.line),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
                child: Row(children: [
                  const Icon(Icons.check_circle_outline_rounded,
                      size: 16, color: AppColors.nu),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(shown[i],
                        style: const TextStyle(fontSize: 13, height: 1.45)),
                  ),
                ]),
              ),
            ],
          ],
        ),
      ),
      if (items.length > 5)
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () => setState(() => _allStretches = !_allStretches),
            child: Text(_allStretches
                ? 'اعرض أقل'
                : 'عرض باقي الإطالات (${items.length - 5})'),
          ),
        ),
    ];
  }

  Widget _cooldownScreen() => _phaseScaffold(
        title: 'الإطالة',
        icon: Icons.self_improvement_rounded,
        color: AppColors.nu,
        intro: 'دقائق قليلة تساعد جسمك يرجع تدريجيا للوضع الطبيعي',
        steps: const [
          MapEntry('خفض النبض', '2 3 دقائق مشي هادئ مع تنفس منتظم'),
          MapEntry('تنفس عميق', 'شهيق 4 ثوان وزفير 6 ثوان × 5 مرات'),
          MapEntry('إطالة خفيفة', 'إطالة عضلات اليوم 20 30 ثانية بدون ألم أو ارتداد'),
          MapEntry('بعد الجلسة', 'اشرب ماء وسجل أي ألم غير طبيعي بدل تجاهله'),
        ],
        extra: [
          ..._moveCards('إطالة عضلات اليوم', _cooldownMoves()),
          ..._stretchCards(),
        ],
        button: 'حفظ وإنهاء الجلسة',
        onPressed: finishing ? null : _finish,
      );

  Widget _phaseScaffold({required String title, required IconData icon,
      required Color color, required String intro,
      required List<MapEntry<String, String>> steps, required String button,
      required VoidCallback? onPressed,
      List<Widget> extra = const []}) => Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(backgroundColor: AppColors.bg,
          title: Text(
              WorkoutExercise.splitDayName(widget.day['name']?.toString() ?? '')[0],
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w900))),
        body: ListView(padding: const EdgeInsets.fromLTRB(18, 12, 18, 30), children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [color.withValues(alpha: .95), color.withValues(alpha: .60)]),
              borderRadius: BorderRadius.circular(22),
            ),
            child: Column(children: [
              Icon(icon, color: Colors.white, size: 46),
              const SizedBox(height: 10),
              Text(title, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
              const SizedBox(height: 7),
              Text(intro, textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, height: 1.5)),
            ]),
          ),
          const SizedBox(height: 16),
          ...steps.asMap().entries.map((entry) => Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(15),
                border: Border.all(color: AppColors.line)),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(width: 30, height: 30, alignment: Alignment.center,
                decoration: BoxDecoration(color: color.withValues(alpha: .14), shape: BoxShape.circle),
                child: Text('${entry.key + 1}', style: TextStyle(color: color, fontWeight: FontWeight.w900))),
              const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(entry.value.key, style: const TextStyle(fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                Text(entry.value.value, style: const TextStyle(color: AppColors.muted, height: 1.45, fontSize: 12)),
              ])),
            ]),
          )),
          ...extra,
          const SizedBox(height: 8),
          SizedBox(height: 54, child: ElevatedButton(
            onPressed: onPressed,
            style: ElevatedButton.styleFrom(backgroundColor: color,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15))),
            child: finishing
                ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                : Text(button, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
          )),
        ]),
      );

  Widget _chip(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(color: AppColors.wo.withValues(alpha: .12), borderRadius: BorderRadius.circular(9)),
        child: Text(text,
            style: const TextStyle(color: AppColors.wo2, fontSize: 11, fontWeight: FontWeight.w700)),
      );
}
