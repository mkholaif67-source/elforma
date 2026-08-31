// ── ElForma · screens/workout_history_screen.dart ──
// Workout history + weekly Smart Coach review card (volume vs MEV/MRV landmarks).
// سجل التمارين + بطاقة مراجعة المدرب.

import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../api.dart';
import '../models/engine_contracts.dart';
import '../theme.dart';

class WorkoutHistoryScreen extends StatefulWidget {
  const WorkoutHistoryScreen({super.key});

  @override
  State<WorkoutHistoryScreen> createState() => _WorkoutHistoryScreenState();
}

class _WorkoutHistoryScreenState extends State<WorkoutHistoryScreen> {
  bool loading = true;
  String? error;
  Map<String, dynamic> analytics = {};
  Map<String, dynamic> coach = {};
  List<Map<String, dynamic>> weeks = [];
  List<Map<String, dynamic>> bestLifts = [];
  List<Map<String, dynamic>> sessions = [];

  num _n(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { loading = true; error = null; });
    final response = await Api.I.workoutHistory();
    if (!mounted) return;
    setState(() {
      loading = false;
      if (response.ok) {
        analytics = response.data['analytics'] is Map
            ? Map<String, dynamic>.from(response.data['analytics']) : {};
        coach = response.data['coach'] is Map
            ? Map<String, dynamic>.from(response.data['coach']) : {};
        weeks = _maps(response.data['weeks']);
        bestLifts = _maps(response.data['bestLifts']);
        sessions = _maps(response.data['sessions']);
      } else {
        error = response.error.isNotEmpty ? response.error : 'تعذر تحميل سجل التدريب';
      }
    });
  }

  List<Map<String, dynamic>> _maps(dynamic raw) => raw is List
      ? raw.whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList()
      : [];

  String _duration(dynamic seconds) {
    final value = _n(seconds).toInt();
    if (value <= 0) return '—';
    final minutes = value ~/ 60;
    return minutes >= 60 ? '${minutes ~/ 60}س ${minutes % 60}د' : '$minutes دقيقة';
  }

  String _volume(dynamic value) {
    final number = _n(value).toDouble();
    if (number >= 1000) return '${(number / 1000).toStringAsFixed(1)} طن';
    return '${number.toStringAsFixed(0)} كجم';
  }

  String _date(dynamic value) {
    final text = '$value';
    final parsed = DateTime.tryParse(text)?.toLocal();
    if (parsed == null) return text.length >= 10 ? text.substring(0, 10) : text;
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    return '${parsed.day} ${months[parsed.month - 1]} ${parsed.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        title: const Text('سجل التدريب', style: TextStyle(fontWeight: FontWeight.w900)),
        centerTitle: true,
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.wo))
          : error != null
              ? Center(child: Text(error!, style: const TextStyle(color: AppColors.wo2)))
              : RefreshIndicator(color: AppColors.wo, onRefresh: _load, child: _content()),
    );
  }

  Widget _content() => ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 35),
        children: [
          _summary(),
          const SizedBox(height: 14),
          _coachCard(),
          const SizedBox(height: 14),
          _weeklyChart(),
          const SizedBox(height: 14),
          _loadCard(),
          if (bestLifts.isNotEmpty) ...[
            const SizedBox(height: 18),
            const Text('أفضل أرقامك', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 9),
            ...bestLifts.take(5).map(_bestLift),
          ],
          const SizedBox(height: 18),
          const Text('الجلسات السابقة', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
          const SizedBox(height: 9),
          if (sessions.isEmpty) _empty() else ...sessions.map(_sessionCard),
        ],
      );

  /// Sprint 18 — load management, the way the website's coach reads it.
  ///
  /// Weekly tonnage on its own means nothing to a trainee. What matters is the
  /// ratio between this week's load and the recent four-week average (ACWR):
  /// 0.8–1.3 is the productive, injury-safe band, and a spike above 1.5 is the
  /// strongest predictor of overuse injury. Both numbers come from the server,
  /// which computes them with the same equations as the site.
  Widget _loadCard() {
    final load = coach['load'] is Map
        ? Map<String, dynamic>.from(coach['load'] as Map)
        : <String, dynamic>{};
    if (load.isEmpty) return const SizedBox.shrink();

    final acwr = load['acwr'];
    final zone = (load['acwrZone'] ?? '').toString();
    final note = (load['acwrNote'] ?? '').toString();
    final delta = load['tonnageDeltaPct'];
    final commitment = _n(load['commitment']).toInt().clamp(0, 100);
    final safe = acwr != null && _n(acwr) >= 0.8 && _n(acwr) <= 1.3;
    final spike = acwr != null && _n(acwr) > 1.5;
    final acwrColor = spike
        ? AppColors.wo2
        : safe
            ? AppColors.nu
            : const Color(0xFFFFC857);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.monitor_heart_rounded, color: AppColors.wo, size: 19),
          const SizedBox(width: 7),
          const Expanded(
            child: Text('حمل الأسبوع والالتزام',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
          ),
          if (zone.isNotEmpty) _coachChip(zone, acwrColor),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_volume(load['weeklyTonnage']),
                  style: const TextStyle(
                      fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.wo2, height: 1.1)),
              const SizedBox(height: 3),
              const Text('رفعته الأسبوع ده',
                  style: TextStyle(color: AppColors.muted, fontSize: 11)),
              if (delta != null) ...[
                const SizedBox(height: 5),
                Row(children: [
                  Icon(_n(delta) >= 0 ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
                      size: 13, color: _n(delta) >= 0 ? AppColors.nu : AppColors.muted),
                  const SizedBox(width: 3),
                  Text('${_n(delta).abs().toStringAsFixed(1)}% عن الأسبوع اللي فات',
                      style: const TextStyle(color: AppColors.muted, fontSize: 11)),
                ]),
              ],
            ]),
          ),
          Container(width: 1, height: 54, color: AppColors.line),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(acwr == null ? '—' : _n(acwr).toStringAsFixed(2),
                  style: TextStyle(
                      fontSize: 24, fontWeight: FontWeight.w900, color: acwrColor, height: 1.1)),
              const SizedBox(height: 3),
              const Text('نسبة تراكم الحمل (الأمان 0.8 1.3)',
                  style: TextStyle(color: AppColors.muted, fontSize: 11)),
            ]),
          ),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          const Text('التزامك بجدولك',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5)),
          const Spacer(),
          Text('$commitment%',
              style: const TextStyle(
                  fontWeight: FontWeight.w900, fontSize: 13, color: AppColors.nu)),
        ]),
        const SizedBox(height: 7),
        ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: LinearProgressIndicator(
            value: commitment / 100,
            minHeight: 9,
            backgroundColor: AppColors.card2,
            valueColor: AlwaysStoppedAnimation<Color>(
                commitment >= 80 ? AppColors.nu : commitment >= 50 ? AppColors.nu2 : AppColors.wo2),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'أتممت جلساتك مقابل ${_n(load['plannedPerWeek']).toInt()} يوم مخطط في الأسبوع · على مدى ${_n(load['activeWeeks']).toInt()} أسبوع',
          style: const TextStyle(color: AppColors.muted, fontSize: 11, height: 1.5),
        ),
        if (note.isNotEmpty) ...[
          const SizedBox(height: 12),
          _note(spike ? Icons.warning_amber_rounded : Icons.verified_rounded, acwrColor, note),
        ],
      ]),
    );
  }

  Widget _coachCard() {
    final status = (coach['status'] ?? 'building_history').toString();
    final warning = status == 'deload' || status == 'watch';
    final color = status == 'deload' ? AppColors.wo2 : warning ? const Color(0xFFFFC857) : AppColors.nu;
    final muscles = _maps(coach['muscleVolume']);
    final stalls = _maps(coach['stalls']);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: color.withValues(alpha: .08), borderRadius: BorderRadius.circular(18),
          border: Border.all(color: color.withValues(alpha: .28))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 40, height: 40, decoration: BoxDecoration(color: color.withValues(alpha: .15), borderRadius: BorderRadius.circular(12)),
              child: Icon(status == 'deload' ? Icons.battery_alert_rounded : Icons.psychology_alt_rounded, color: color)),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('المدرب الذكي', style: TextStyle(color: AppColors.muted, fontSize: 10)),
            Text((coach['title'] ?? 'نجمع بيانات أدائك').toString(), style: const TextStyle(fontWeight: FontWeight.w900)),
          ])),
        ]),
        const SizedBox(height: 10),
        Text((coach['recommendation'] ?? '').toString(), style: const TextStyle(color: AppColors.text, height: 1.55, fontSize: 12)),
        const SizedBox(height: 11),
        Wrap(spacing: 7, runSpacing: 7, children: [
          _coachChip('${_n(coach['recentSessions']).toInt()} جلسات / 7 أيام', color),
          if (coach['avgRir'] != null) _coachChip('متوسط RIR ${_n(coach['avgRir']).toStringAsFixed(1)}', color),
          if (stalls.isNotEmpty) _coachChip('${stalls.length} تمارين متوقفة', color),
          if (coach['level'] != null) _coachChip('مستواك: ${_levelLabel(coach['level'].toString())}', color),
          if (_n(coach['trainedWeeks']) > 0) _coachChip('${_n(coach['trainedWeeks']).toInt()} أسابيع متواصلة', color),
        ]),
        // Sprint 12: surface the engine's own volume landmarks (MEV / optimal /
        // weekly cap) instead of only comparing this week to last week.
        if (coach['deloadScheduled'] == true) ...[
          const SizedBox(height: 11),
          _note(Icons.battery_saver_rounded, const Color(0xFFFFC857),
              'عديت ${_n(coach['trainedWeeks']).toInt()} أسابيع تدريب متواصلة الأسبوع الجاي مفروض يكون ديلود: قلل المجموعات 40% وخفف الأوزان شوية عشان ترجع أقوى'),
        ],
        if (_names(coach['belowMev']).isNotEmpty) ...[
          const SizedBox(height: 9),
          _note(Icons.trending_down_rounded, const Color(0xFFFFC857),
              'تحت الحد الأدنى للنمو (MEV): ${_names(coach['belowMev']).join('، ')}. زود مجموعاتها تدريجيا'),
        ],
        if (_names(coach['overCap']).isNotEmpty) ...[
          const SizedBox(height: 9),
          _note(Icons.warning_amber_rounded, AppColors.wo2,
              'فوق السقف الأسبوعي الآمن: ${_names(coach['overCap']).join('، ')}. الزيادة دي بتأخر الاستشفاء مش بتزود النتيجة'),
        ],
        if (muscles.isNotEmpty) ...[
          const SizedBox(height: 13),
          const Text('حجم العضلات هذا الأسبوع', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11)),
          const SizedBox(height: 8),
          ...muscles.take(8).map((muscle) {
            final current = _n(muscle['currentSets']).toDouble();
            final previous = _n(muscle['previousSets']).toDouble();
            // ignore: unused_local_variable
            // Scale the bar against the engine's weekly cap when we have it, so
            // the bar means "how close am I to the safe ceiling", not just
            // "bigger than last week".
            final cap = _n(muscle['weeklyCap']).toDouble();
            final scale = cap > 0 ? cap : math.max(1.0, math.max(current, previous));
            final grade = (muscle['grade'] ?? 'unknown').toString();
            final gradeColor = _gradeColor(grade, color);
            return Padding(padding: const EdgeInsets.only(bottom: 9), child: Column(children: [
              Row(children: [
                Expanded(child: Text((muscle['name'] ?? '').toString(), style: const TextStyle(fontSize: 10.5))),
                if (grade != 'unknown') ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: gradeColor.withValues(alpha: .15), borderRadius: BorderRadius.circular(6)),
                    child: Text(_gradeLabel(grade), style: TextStyle(color: gradeColor, fontSize: 9, fontWeight: FontWeight.w900)),
                  ),
                  const SizedBox(width: 6),
                ],
                Text(cap > 0 ? '${current.toInt()} / ${cap.toInt()}' : '${current.toInt()} مجموعة',
                    style: TextStyle(color: gradeColor, fontSize: 10, fontWeight: FontWeight.w900)),
              ]),
              const SizedBox(height: 4),
              LinearProgressIndicator(value: (current / scale).clamp(0.0, 1.0), minHeight: 6,
                  borderRadius: BorderRadius.circular(5), color: gradeColor, backgroundColor: AppColors.line),
              if (muscle['note'] != null && muscle['note'].toString().isNotEmpty)
                Padding(padding: const EdgeInsets.only(top: 3),
                    child: Align(alignment: Alignment.centerRight,
                        child: Text(muscle['note'].toString(), style: const TextStyle(color: AppColors.muted, fontSize: 9.5)))),
            ]));
          }),
        ],
      ]),
    );
  }

  String _levelLabel(String v) =>
      v == 'advanced' ? 'متقدم' : v == 'intermediate' ? 'متوسط' : 'مبتدئ';

  String _gradeLabel(String g) {
    switch (g) {
      case 'below_mev': return 'تحت الحد الأدنى';
      case 'developing': return 'في الطريق';
      case 'good': return 'جيد';
      case 'optimal': return 'مثالي';
      case 'over_cap': return 'فوق السقف';
      default: return '';
    }
  }

  Color _gradeColor(String g, Color fallback) {
    switch (g) {
      case 'below_mev': return const Color(0xFFFFC857);
      case 'developing': return const Color(0xFF7FB2FF);
      case 'good': return AppColors.nu;
      case 'optimal': return AppColors.nu;
      case 'over_cap': return AppColors.wo2;
      default: return fallback;
    }
  }

  List<String> _names(dynamic value) => value is List
      ? value.map((e) => e is Map ? (e['name'] ?? e['muscle'] ?? '').toString() : e.toString())
          .where((s) => s.isNotEmpty).toList()
      : const <String>[];

  Widget _note(IconData icon, Color color, String text) => Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: color.withValues(alpha: .10), borderRadius: BorderRadius.circular(11),
            border: Border.all(color: color.withValues(alpha: .25))),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(color: AppColors.text, fontSize: 11, height: 1.5))),
        ]),
      );

  Widget _coachChip(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
        decoration: BoxDecoration(color: color.withValues(alpha: .12), borderRadius: BorderRadius.circular(9)),
        child: Text(text, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w900)),
      );

  Widget _summary() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: [AppColors.wo.withValues(alpha: .96), AppColors.wo2.withValues(alpha: .74)]),
          borderRadius: BorderRadius.circular(21),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Row(children: [
            Icon(Icons.query_stats_rounded, color: Colors.white),
            SizedBox(width: 8),
            Text('حصيلة تدريبك', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900)),
          ]),
          const SizedBox(height: 16),
          Row(children: [
            _summaryItem('${_n(analytics['totalSessions']).toInt()}', 'جلسة'),
            _summaryItem('${_n(analytics['totalSets']).toInt()}', 'مجموعة'),
            _summaryItem(_volume(analytics['totalVolume']), 'حجم التدريب'),
            _summaryItem(_duration(analytics['avgDuration']), 'متوسط الجلسة'),
          ]),
        ]),
      );

  Widget _summaryItem(String value, String label) => Expanded(child: Column(children: [
        Text(value, textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w900)),
        const SizedBox(height: 4),
        Text(label, textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withValues(alpha: .78), fontSize: 9.5)),
      ]));

  Widget _weeklyChart() {
    final values = weeks.map((week) => _n(week['sessions']).toDouble()).toList();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.line)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('الالتزام خلال 8 أسابيع', style: TextStyle(fontWeight: FontWeight.w900)),
        const SizedBox(height: 4),
        const Text('عدد الجلسات المكتملة أسبوعيا', style: TextStyle(color: AppColors.muted, fontSize: 11)),
        const SizedBox(height: 15),
        SizedBox(height: 135, width: double.infinity,
            child: CustomPaint(painter: _WeeklyBarsPainter(values))),
        const SizedBox(height: 7),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [Text('منذ 8 أسابيع', style: TextStyle(color: AppColors.muted, fontSize: 9)),
              Text('هذا الأسبوع', style: TextStyle(color: AppColors.muted, fontSize: 9))]),
      ]),
    );
  }

  Widget _bestLift(Map<String, dynamic> lift) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.line)),
        child: Row(children: [
          Container(width: 39, height: 39, decoration: BoxDecoration(color: AppColors.nu.withValues(alpha: .12), borderRadius: BorderRadius.circular(11)),
              child: const Icon(Icons.emoji_events_outlined, color: AppColors.nu)),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text((lift['name'] ?? '').toString(), maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w900)),
            const SizedBox(height: 3),
            Text('${_n(lift['weight']).toStringAsFixed(1)} كجم × ${_n(lift['reps']).toInt()} تكرار',
                style: const TextStyle(color: AppColors.muted, fontSize: 11)),
          ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('${_n(lift['e1rm']).toStringAsFixed(1)} كجم',
                style: const TextStyle(color: AppColors.nu, fontWeight: FontWeight.w900)),
            const Text('قوة تقديرية', style: TextStyle(color: AppColors.muted, fontSize: 9)),
          ]),
        ]),
      );

  Widget _sessionCard(Map<String, dynamic> session) {
    final sets = _maps(session['sets']);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.line)),
      child: ExpansionTile(
        shape: const Border(),
        collapsedShape: const Border(),
        tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 13),
        leading: Container(width: 42, height: 42, decoration: BoxDecoration(color: AppColors.wo.withValues(alpha: .12), borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.fitness_center, color: AppColors.wo2, size: 21)),
        title: Text(WorkoutExercise.splitDayName((session['day_name'] ?? 'جلسة تدريب').toString()).first,
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
        subtitle: Text('${_date(session['finished_at'] ?? session['started_at'])} · ${_duration(session['duration_sec'])}',
            style: const TextStyle(color: AppColors.muted, fontSize: 10.5)),
        trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text('${_n(session['setCount']).toInt()} مجموعات', style: const TextStyle(color: AppColors.wo2, fontWeight: FontWeight.w900, fontSize: 11)),
          const SizedBox(height: 3),
          Text(_volume(session['volume']), style: const TextStyle(color: AppColors.muted, fontSize: 9.5)),
        ]),
        children: [
          const Divider(color: AppColors.line),
          if (sets.isEmpty)
            const Padding(padding: EdgeInsets.all(8), child: Text('لا توجد مجموعات مسجلة', style: TextStyle(color: AppColors.muted)))
          else
            ..._groupSets(sets).entries.map((entry) => _exerciseSets(entry.key, entry.value)),
        ],
      ),
    );
  }

  Map<String, List<Map<String, dynamic>>> _groupSets(List<Map<String, dynamic>> sets) {
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final set in sets) {
      final name = (set['exercise_name'] ?? 'تمرين').toString();
      grouped.putIfAbsent(name, () => []).add(set);
    }
    return grouped;
  }

  Widget _exerciseSets(String name, List<Map<String, dynamic>> sets) => Padding(
        padding: const EdgeInsets.only(top: 9),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.check_circle, color: AppColors.nu, size: 17),
          const SizedBox(width: 7),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
            const SizedBox(height: 3),
            Text(sets.map((set) => '${_n(set['weight']).toStringAsFixed(1)}×${_n(set['reps']).toInt()}').join('  ·  '),
                style: const TextStyle(color: AppColors.muted, fontSize: 10.5)),
          ])),
        ]),
      );

  Widget _empty() => Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(17), border: Border.all(color: AppColors.line)),
        child: const Column(children: [
          Icon(Icons.history_toggle_off_rounded, color: AppColors.muted, size: 42),
          SizedBox(height: 9),
          Text('أكمل أول جلسة ليظهر سجل تدريبك وتحليلاتك هنا', textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, height: 1.5)),
        ]),
      );
}

class _WeeklyBarsPainter extends CustomPainter {
  final List<double> values;
  _WeeklyBarsPainter(this.values);

  @override
  void paint(Canvas canvas, Size size) {
    final grid = Paint()..color = AppColors.line..strokeWidth = 1;
    for (var i = 0; i <= 3; i++) {
      final y = size.height * i / 3;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    if (values.isEmpty) return;
    final maximum = math.max(1.0, values.reduce(math.max));
    final slot = size.width / values.length;
    final width = math.min(22.0, slot * .55);
    for (var i = 0; i < values.length; i++) {
      final height = values[i] / maximum * (size.height - 12);
      final rect = RRect.fromRectAndRadius(
          Rect.fromLTWH(i * slot + (slot - width) / 2, size.height - height, width, height),
          const Radius.circular(6));
      canvas.drawRRect(rect, Paint()..color = i == values.length - 1 ? AppColors.nu : AppColors.wo2);
    }
  }

  @override
  bool shouldRepaint(covariant _WeeklyBarsPainter oldDelegate) => oldDelegate.values != values;
}
