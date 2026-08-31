// ── ElForma · screens/profile_overview_screen.dart ──
// The chic, read-first view of a COMPLETED training & nutrition profile.
// Opened from the account tab («بيانات التدريب والتغذية») ONLY when onboarding is
// already done. It lays every saved answer out in neat, grouped cards, and gives
// three actions:
//   • تعديل (top-right) → opens the setup chat in edit mode; on save the store
//     refreshes and this view updates instantly.
//   • عرض التحليل → the same wow analysis dashboard, in view-only mode
//     (no re-save, no auto-countdown).
//   • حذف وإعادة الإدخال → resets onboarding so the user re-enters from scratch.
// شاشة عرض البيانات المكتملة بشكل مرتب مع تعديل / عرض تحليل / حذف.

import 'package:flutter/material.dart';
import '../api.dart';
import '../models/profile_store.dart';
import '../theme.dart';
import '../widgets/error_view.dart';
import 'analysis_screen.dart';
import 'profile_setup_screen.dart';

class ProfileOverviewScreen extends StatefulWidget {
  final Map<String, dynamic> initial;
  const ProfileOverviewScreen({super.key, required this.initial});

  @override
  State<ProfileOverviewScreen> createState() => _ProfileOverviewScreenState();
}

class _ProfileOverviewScreenState extends State<ProfileOverviewScreen> {
  late Map<String, dynamic> _p;
  bool _busy = false;
  bool _changed = false; // did anything change while we were here?

  @override
  void initState() {
    super.initState();
    _p = Map<String, dynamic>.from(widget.initial);
  }

  // ── label dictionaries (mirror the setup screen) ─────────────────
  static const Map<String, String> _gender = {'male': 'ذكر', 'female': 'أنثى'};
  static const Map<String, String> _goal = {'lose': 'خسارة دهون', 'maintain': 'ثبات', 'gain': 'بناء عضلات', 'strength': 'قوة', 'fitness': 'لياقة'};
  static const Map<String, String> _activity = {'sedentary': 'محدودة', 'light': 'خفيفة', 'moderate': 'متوسطة', 'active': 'عالية'};
  static const Map<String, String> _sleep = {'poor': 'ضعيف', 'ok': 'جيد', 'good': 'ممتاز'};
  static const Map<String, String> _stress = {'low': 'قليل', 'mid': 'متوسط', 'high': 'عال'};
  static const Map<String, String> _intensity = {'light': 'خفيف', 'moderate': 'متوسط', 'vigorous': 'عالي'};
  static const Map<String, String> _exp = {'beginner': 'مبتدئ', 'intermediate': 'متوسط', 'advanced': 'متقدم'};
  static const Map<String, String> _equip = {'gym': 'الجيم', 'home': 'البيت'};
  static const Map<String, String> _diet = {'balanced': 'متوازن', 'lowcarb': 'قليل الكارب', 'keto': 'كيتو', 'carbcycle': 'تدوير الكارب', 'mediterranean': 'البحر المتوسط', 'carnivore': 'كارنيفور', 'vegetarian': 'نباتي'};
  static const Map<String, String> _fasting = {'normal': 'أكل عادي', 'ramadan': 'صيام رمضان', 'if16': 'صيام متقطع 16:8'};
  static const Map<String, String> _inj = {'shoulder': 'كتف', 'back': 'ظهر', 'knee': 'ركبة', 'elbow': 'كوع', 'wrist': 'رسغ', 'neck': 'رقبة'};
  static const Map<String, String> _weak = {'chest': 'صدر', 'back': 'ظهر', 'shoulders': 'أكتاف', 'arms': 'ذراع', 'quads': 'رجل أمامية', 'hamstrings': 'رجل خلفية', 'glutes': 'جلوتس', 'calves': 'سمانة', 'core': 'بطن/كور'};
  static const Map<String, String> _health = {'diabetes': 'سكري', 'insulin': 'مقاومة إنسولين', 'bp': 'ضغط', 'cholesterol': 'كوليسترول', 'kidney': 'كلى', 'gerd': 'ارتجاع', 'gout': 'نقرس', 'ibs': 'قولون عصبي'};

  // ── tiny readers ──────────────────────────────────────
  String _s(String k) {
    final v = _p[k];
    return v == null ? '' : '$v';
  }

  String _mapv(Map<String, String> m, String k) => m[_s(k)] ?? '—';

  String _numv(String k, {String suffix = ''}) {
    final v = _p[k];
    if (v == null) return '—';
    final s = '$v'.replaceFirst(RegExp(r'\.0$'), '');
    if (s.isEmpty) return '—';
    return suffix.isEmpty ? s : '$s $suffix';
  }

  bool _has(String k) {
    final v = _p[k];
    if (v == null) return false;
    if (v is num) return v > 0;
    return '$v'.trim().isNotEmpty;
  }

  List<String> _listv(String k) {
    final v = _p[k];
    if (v is List) return v.whereType<String>().toList();
    return const [];
  }

  // ── actions ─────────────────────────────────────────
  Future<void> _edit() async {
    final changed = await Navigator.of(context).push<bool>(MaterialPageRoute(
      builder: (_) => ProfileSetupScreen(initial: _p),
    ));
    if (changed == true) {
      _changed = true;
      final fresh = ProfileStore.I.profile;
      if (fresh != null && mounted) setState(() => _p = Map<String, dynamic>.from(fresh));
    }
  }

  void _viewAnalysis() {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => AnalysisScreen(payload: _p, viewOnly: true),
    ));
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('حذف البيانات؟',
            style: TextStyle(color: AppColors.text, fontWeight: FontWeight.w900)),
        content: const Text(
            'هنمسح بيانات التدريب والتغذية وترجع تدخلها من الأول. متأكد؟',
            style: TextStyle(color: AppColors.muted, height: 1.6)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            style: TextButton.styleFrom(foregroundColor: AppColors.muted),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.wo, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('احذف وابدأ من جديد'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    // The server insists on age/height/weight, so we keep the trio but drop
    // everything else and flip onboardingComplete off → the app treats the user
    // as not-yet-onboarded and walks them through a fresh setup that overwrites
    // the old plan entirely.
    final reset = <String, dynamic>{
      'age': _p['age'],
      'height': _p['height'],
      'weight': _p['weight'],
      'onboardingComplete': false,
    };
    final res = await Api.I.saveMobileProfile(reset);
    if (!mounted) return;
    setState(() => _busy = false);
    if (res.ok) {
      await ProfileStore.I.clear();
      if (!mounted) return;
      Navigator.pop(context, true); // account reloads → tile flips to «أكمل بياناتك»
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res.friendlyError('تعذر حذف البيانات'))),
      );
    }
  }

  // ── build ──────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final cardio = ProfileStore.num0(_p['cardioSessions']).round();
    final hasMeasurements = _has('waist') || _has('neck') || _has('hips') || _has('bodyFat');
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        Navigator.pop(context, _changed);
      },
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          title: const Text('بيانات التدريب والتغذية',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
          centerTitle: true,
          leading: IconButton(
            tooltip: 'رجوع',
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: () => Navigator.pop(context, _changed),
          ),
          actions: [
            TextButton.icon(
              onPressed: _busy ? null : _edit,
              icon: const Icon(Icons.edit_rounded, size: 18),
              label: const Text('تعديل'),
              style: TextButton.styleFrom(foregroundColor: AppColors.nu),
            ),
          ],
        ),
        body: SafeArea(
          child: _p.isEmpty
              // Reaching this screen with no profile is not an error: it means
              // onboarding was never finished. Saying "something went wrong"
              // would send the trainee hunting for a bug that isn't there.
              ? EmptyView(
                  message: 'مفيش بيانات لسة. اكمل بياناتك عشان نبني لك الخطة',
                  icon: Icons.assignment_ind_rounded,
                  actionLabel: 'ابدأ دلوقتي',
                  onAction: _busy ? null : _edit,
                )
              : ListView(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
            children: [
              _hero(),
              const SizedBox(height: 16),
              _section('البيانات الأساسية', Icons.badge_rounded, AppColors.nu, [
                _row('الجنس', _mapv(_gender, 'gender')),
                _row('السن', _numv('age', suffix: 'سنة')),
                _row('الطول', _numv('height', suffix: 'سم')),
                _row('الوزن', _numv('weight', suffix: 'كجم')),
                if (_has('targetWeight')) _row('الوزن المستهدف', _numv('targetWeight', suffix: 'كجم')),
              ]),
              _section('الهدف والنشاط', Icons.flag_rounded, AppColors.wo, [
                _row('الهدف', _mapv(_goal, 'goal')),
                _row('النشاط اليومي', _mapv(_activity, 'dailyActivity')),
                _row('النوم', _mapv(_sleep, 'sleep')),
                _row('التوتر', _mapv(_stress, 'stress')),
                if (_has('steps')) _row('الخطوات', _numv('steps', suffix: 'خطوة/يوم')),
                _row('الكارديو',
                    cardio == 0 ? 'مفيش' : '$cardio جلسة/أسبوع · ${_mapv(_intensity, 'cardioIntensity')}'),
              ]),
              _section('التمرين', Icons.fitness_center_rounded, AppColors.wo, [
                _row('الخبرة', _mapv(_exp, 'experience')),
                _row('مكان التمرين', _mapv(_equip, 'equipment')),
                _row('أيام التمرين', _numv('trainingDays', suffix: 'أيام/أسبوع')),
                _row('مدة الجلسة', _numv('trainingMinutes', suffix: 'دقيقة')),
              ]),
              _section('التغذية', Icons.restaurant_rounded, AppColors.nu, [
                _row('نظام الأكل', _mapv(_diet, 'diet')),
                _row('عدد الوجبات', _numv('mealCount', suffix: 'وجبات')),
                _row('نمط الأكل', _mapv(_fasting, 'fastingMode')),
              ]),
              if (hasMeasurements)
                _section('القياسات', Icons.straighten_rounded, AppColors.nu2, [
                  if (_has('waist')) _row('الخصر', _numv('waist', suffix: 'سم')),
                  if (_has('neck')) _row('الرقبة', _numv('neck', suffix: 'سم')),
                  if (_has('hips')) _row('الأرداف', _numv('hips', suffix: 'سم')),
                  if (_has('bodyFat')) _row('نسبة الدهون', _numv('bodyFat', suffix: '%')),
                ]),
              _section('الإصابات والتركيز', Icons.health_and_safety_rounded, AppColors.wo2, [
                _chips('إصابات', _listv('injuries'), _inj),
                _chips('عضلات متأخرة', _listv('weakPoints'), _weak),
                _chips('حالات صحية', _listv('healthConditions'), _health),
              ]),
              const SizedBox(height: 6),
              _primary('عرض التحليل', Icons.insights_rounded, _busy ? null : _viewAnalysis),
              const SizedBox(height: 12),
              _danger('حذف البيانات وإعادة الإدخال', Icons.delete_outline_rounded, _busy ? null : _delete),
            ],
          ),
        ),
      ),
    );
  }

  // ── pieces ────────────────────────────────────────
  Widget _hero() {
    final h = ProfileStore.num0(_p['height']);
    final w = ProfileStore.num0(_p['weight']);
    final bmi = (h > 0 && w > 0) ? w / ((h / 100) * (h / 100)) : null;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(colors: [
          AppColors.nu.withValues(alpha: .18),
          AppColors.wo.withValues(alpha: .12),
        ]),
        border: Border.all(color: AppColors.nu.withValues(alpha: .3)),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(colors: [AppColors.nu, AppColors.nu2]),
            ),
            child: const Icon(Icons.verified_rounded, color: Color(0xFF04231B), size: 28),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('ملفك مكتمل',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
                const SizedBox(height: 3),
                Text('${_mapv(_goal, 'goal')} · نشاط ${_mapv(_activity, 'dailyActivity')}',
                    style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
              ],
            ),
          ),
          if (bmi != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.bg.withValues(alpha: .5),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                children: [
                  Text(bmi.toStringAsFixed(1),
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.nu2)),
                  const Text('BMI', style: TextStyle(fontSize: 10, color: AppColors.muted)),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _section(String title, IconData icon, Color color, List<Widget> rows) => Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(color: color.withValues(alpha: .16), borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, color: color, size: 18),
              ),
              const SizedBox(width: 10),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14.5, color: AppColors.text)),
            ]),
            const SizedBox(height: 6),
            ...rows,
          ],
        ),
      );

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
            const SizedBox(width: 12),
            Flexible(
              child: Text(value,
                  textAlign: TextAlign.left,
                  style: const TextStyle(color: AppColors.text, fontWeight: FontWeight.w800, fontSize: 13.5)),
            ),
          ],
        ),
      );

  Widget _chips(String label, List<String> keys, Map<String, String> m) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 13)),
            const SizedBox(height: 8),
            if (keys.isEmpty)
              const Align(
                alignment: Alignment.centerRight,
                child: Text('لا يوجد',
                    style: TextStyle(color: AppColors.text, fontWeight: FontWeight.w700, fontSize: 13)),
              )
            else
              Align(
                alignment: Alignment.centerRight,
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  alignment: WrapAlignment.end,
                  children: keys
                      .map((k) => Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppColors.bg,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: AppColors.line),
                            ),
                            child: Text(m[k] ?? k,
                                style: const TextStyle(color: AppColors.text, fontWeight: FontWeight.w700, fontSize: 12.5)),
                          ))
                      .toList(),
                ),
              ),
          ],
        ),
      );

  Widget _primary(String label, IconData icon, VoidCallback? onTap) => SizedBox(
        width: double.infinity,
        height: 54,
        child: FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.nu,
            foregroundColor: const Color(0xFF04231B),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          onPressed: onTap,
          icon: Icon(icon),
          label: Text(label, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w900)),
        ),
      );

  Widget _danger(String label, IconData icon, VoidCallback? onTap) => SizedBox(
        width: double.infinity,
        height: 52,
        child: OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.wo2,
            side: BorderSide(color: AppColors.wo.withValues(alpha: .5)),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          onPressed: onTap,
          icon: Icon(icon),
          label: Text(label, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800)),
        ),
      );
}
