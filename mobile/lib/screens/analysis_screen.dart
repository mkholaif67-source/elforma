// ── ElForma · screens/analysis_screen.dart ──
// The "wow" onboarding reveal. Two phases:
//   1) a short animated "analyzing your data" screen (rotating rings + cycling
//      status lines) that feels like a real scientific engine at work;
//   2) a chic results dashboard: an animated calorie gauge, three macro rings,
//      a BMI meter, and coach cards.
// Behaviour the product owner asked for explicitly:
//   • The profile SAVES INSTANTLY the moment this screen appears — whether or
//     not the user ever taps the start button.
//   • A 30-second countdown then auto-starts the journey into the app; the
//     user can also tap to start immediately. Either way we land on the Home
//     shell (all tabs).
// شاشة التحليل: أنيميشن “بنحلل بياناتك” ثم داشبورد دوائر ومؤشرات.
// الحفظ لحظي أول ما تظهر، وبعد 30 ثانية تبدأ الرحلة تلقائيا إلى الرئيسية.

import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../api.dart';
import '../models/profile_store.dart';
import '../theme.dart';
import '../widgets/error_view.dart';
import 'shell_screen.dart';

class AnalysisScreen extends StatefulWidget {
  final Map<String, dynamic> payload;
  // View-only: opened from the account overview just to SHOW the analysis. No
  // re-save, no auto-countdown, and the button just closes the screen.
  final bool viewOnly;
  const AnalysisScreen({super.key, required this.payload, this.viewOnly = false});

  @override
  State<AnalysisScreen> createState() => _AnalysisScreenState();
}

class _AnalysisScreenState extends State<AnalysisScreen>
    with TickerProviderStateMixin {
  static const int _countdownFrom = 30;
  // How long the "analyzing" animation stays on screen at minimum, so the
  // reveal always feels intentional even on a fast connection.
  // [FIX] طلب المالك: شاشة التحليل تظهر مباشرة وبسرعة بدون تأخير ملحوظ.
  // قلّلنا زمن طور «بنحلل» للحد الأدنى اللي يحس طبيعي بس.
  static const Duration _analyzeMin = Duration(milliseconds: 450);

  final List<String> _steps = const [
    'بنحسب معدل الأيض الأساسي',
    'بنوزع البروتين والكارب والدهون',
    'بنختار أكلك المصري المتاح',
    'بنظبط جدول تمرينك',
    'بنركب خطتك على المقاس',
  ];

  late final AnimationController _spin;
  Timer? _stepTimer;
  Timer? _phaseTimer;
  Timer? _countdownTimer;

  bool _analyzing = true;
  // [FIX] الداشبورد مايظهرش قبل ما الأهداف تجهز فعلاً. قبل كده كان
  // بيظهر بعد 450ms حتى لو السيرفر لسه بيرد (Render بينام)، فكان
  // بيبان بصفر سعرات وماكروز فاضية.
  bool _minElapsed = false;
  int _stepIndex = 0;
  int _left = _countdownFrom;
  Map<String, dynamic>? _targets;
  String? _saveError;

  /* The server already computes weekly tonnage, ACWR and the periodization
     phase on every workout-history request, but nothing ever displayed them:
     the trainee saw calories and BMI and nothing about how their training load
     is actually trending. These two fields carry that data to the screen. */
  Map<String, dynamic>? _loadStats;
  Map<String, dynamic>? _periodization;
  Map<String, dynamic>? _adaptive;
  Map<String, dynamic>? _adherence;
  Map<String, dynamic>? _coach;
  List _bestLifts = const [];
  Map<String, dynamic>? _staleness;

  // A failed targets fetch used to leave the dashboard rendering zeros, which
  // reads as "your maintenance is 0 kcal" rather than "we could not load".
  String? _dataError;
  bool _dataOffline = false;

  @override
  void initState() {
    super.initState();
    _spin = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
    _stepTimer = Timer.periodic(const Duration(milliseconds: 640), (_) {
      if (!mounted) return;
      setState(() => _stepIndex = (_stepIndex + 1) % _steps.length);
    });
    // Guarantee the analyzing phase shows for at least _analyzeMin, then reveal.
    _phaseTimer = Timer(_analyzeMin, () {
      _minElapsed = true;
      _maybeReveal();
    });
    _run();
    // تعبئة مبدئية من الكاش المحلي — يساعد على عرض بيانات فورية بينما السيرفر يرد
  }

  /// Instant save + targets fetch. Runs in parallel with the analyzing
  /// animation; the dashboard reveal waits on the timer, not on this.
  Future<void> _run() async {
    if (!widget.viewOnly) {
      final save = await Api.I.saveMobileProfile(widget.payload);
      if (!save.ok) {
        _saveError = save.friendlyError('تعذر حفظ بياناتك');
      }
      await ProfileStore.I.ensureLoaded(force: true);
    }
    await _fetch();
  }

  /// Pulls the two payloads the dashboard renders from. Kept separate from
  /// _run so a retry can never re-save the profile a second time.
  Future<void> _fetch() async {
    // Neither call depends on the other, so they go out together.
    // [FIX #11] الطلبين يتبعتوا مع بعض، لكن كشف الداشبورد يستنى الأهداف بس
    // (مش تاريخ التمرين) عشان البيانات تظهر في لحظات زي الأول.
    final targetsFuture = Api.I.nutritionPlan(withMeals: false);
    final historyFuture = Api.I.workoutHistory();
    final res = await targetsFuture;
    if (!mounted) return;

    setState(() {
      if (res.ok && res.data['targets'] is Map) {
        _targets = Map<String, dynamic>.from(res.data['targets'] as Map);
        _dataError = null;
        if (res.data['periodization'] is Map) {
          _periodization =
              Map<String, dynamic>.from(res.data['periodization'] as Map);
        }
        if (res.data['adaptive'] is Map) {
          _adaptive = Map<String, dynamic>.from(res.data['adaptive'] as Map);
        }
        if (res.data['adherence'] is Map) {
          _adherence = Map<String, dynamic>.from(res.data['adherence'] as Map);
        }
        if (res.data['staleness'] is Map) {
          _staleness = Map<String, dynamic>.from(res.data['staleness'] as Map);
        }
      } else if (!res.ok) {
        _dataOffline = efIsOffline(res.status);
        _dataError = efErrorMessage(res.status, res.data);
      }
    });
    // اعرض الداشبورد فوراً أول ما الأهداف تجهز (لو الحد الأدنى للأنيميشن عدّى)
    // من غير ما ننتظر تاريخ التمرين — ده اللي كان بيأخّر الظهور.
    _maybeReveal();

    // تاريخ التمرين طبقة إضافية: بيتحمّل بعدين وماينفعش يأخّر السعرات والماكروز.
    final history = await historyFuture;
    if (!mounted) return;
    setState(() {
      if (history.ok && history.data['load'] is Map) {
        _loadStats = Map<String, dynamic>.from(history.data['load'] as Map);
      }
      if (history.ok && history.data['coach'] is Map) {
        _coach = Map<String, dynamic>.from(history.data['coach'] as Map);
      }
      if (history.ok && history.data['bestLifts'] is List) {
        _bestLifts = history.data['bestLifts'] as List;
      }
    });
  }

  Future<void> _retryData() async {
    setState(() { _dataError = null; });
    await _fetch();
  }

  // يكشف الداشبورد فقط لما: (1) يعدّي الحد الأدنى للأنيميشن، و(2) تكون
  // الأهداف وصلت فعلاً أو حصل خطأ نعرضه. غير كده تفضل شاشة التحليل
  // شغّالة لحد ما البيانات تجهز (مهم جداً مع بطء بداية سيرفر Render المجاني).
  void _maybeReveal() {
    if (!mounted || !_analyzing) return;
    if (!_minElapsed) return;
    if (_targets == null && _dataError == null) return;
    _revealDashboard();
  }

  void _revealDashboard() {
    if (!mounted || !_analyzing) return;
    _stepTimer?.cancel();
    setState(() => _analyzing = false);
    if (widget.viewOnly) return; // just viewing → no auto-start countdown
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => _left -= 1);
      if (_left <= 0) {
        t.cancel();
        _goHome();
      }
    });
  }

  void _goHome() {
    _countdownTimer?.cancel();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      // Straight into the workout tab: the plan is what the user just unlocked.
      MaterialPageRoute(builder: (_) => const ShellScreen(initialIndex: 1)),
      (route) => false,
    );
  }

  @override
  void dispose() {
    _spin.dispose();
    _stepTimer?.cancel();
    _phaseTimer?.cancel();
    _countdownTimer?.cancel();
    super.dispose();
  }

  // ---------------------------------------------------------------- helpers
  num _num(dynamic v) => v is num ? v : num.tryParse('$v') ?? 0;

  double? get _bmi {
    final h = _num(widget.payload['height']).toDouble();
    final w = _num(widget.payload['weight']).toDouble();
    if (h <= 0 || w <= 0) return null;
    final m = h / 100.0;
    return w / (m * m);
  }

  int get _targetCals => _num(_targets?['targetCals']).round();
  Map get _macros => _targets?['macros'] is Map ? _targets!['macros'] as Map : const {};

  static const Map<String, String> _goalLabels = {
    'lose': 'خسارة دهون', 'maintain': 'ثبات', 'gain': 'بناء عضلات',
    'strength': 'قوة', 'fitness': 'لياقة',
  };
  static const Map<String, String> _activityLabels = {
    'sedentary': 'محدودة', 'light': 'خفيفة', 'moderate': 'متوسطة', 'active': 'عالية',
  };
  static const Map<String, String> _dietLabels = {
    'balanced': 'متوازن', 'lowcarb': 'قليل الكارب', 'keto': 'كيتو',
    'carbcycle': 'تدوير الكارب', 'mediterranean': 'البحر المتوسط',
    'carnivore': 'كارنيفور', 'vegetarian': 'نباتي',
  };

  // ---------------------------------------------------------------- build
  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: widget.viewOnly, // viewOnly = back allowed; onboarding = blocked
      child: Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 500),
          child: _analyzing ? _analyzingView() : _dashboardView(),
        ),
      ),
    ),
    );
  }

  // ---------------------------------------------------------------- phase 1
  Widget _analyzingView() {
    return Center(
      key: const ValueKey('analyzing'),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 150,
            height: 150,
            child: AnimatedBuilder(
              animation: _spin,
              builder: (_, __) {
                return CustomPaint(
                  painter: _SpinnerPainter(_spin.value),
                  child: const Center(
                    child: Icon(Icons.insights_rounded,
                        color: AppColors.nu, size: 46),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 34),
          const Text('بنحلل بياناتك',
              style: TextStyle(
                  fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.text)),
          const SizedBox(height: 12),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 350),
            child: Text(
              _steps[_stepIndex],
              key: ValueKey(_stepIndex),
              style: const TextStyle(
                  fontSize: 15, color: AppColors.nu2, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(height: 6),
          const Text('ثواني وخطتك تبقى جاهزة',
              style: TextStyle(fontSize: 12.5, color: AppColors.muted)),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------- phase 2
  Widget _dashboardView() {
    final bmi = _bmi;
    return ListView(
      key: const ValueKey('dashboard'),
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 28),
      children: [
        Row(
          children: [
            Container(
              width: 54, height: 54,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(colors: [AppColors.nu, AppColors.nu2]),
              ),
              child: const Icon(Icons.verified_rounded, color: Color(0xFF04231B), size: 30),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.viewOnly ? 'تحليل بياناتك' : 'خطتك جاهزة يا بطل',
                      style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 3),
                  Text(widget.viewOnly ? 'ملخص كامل مبني على أرقامك إنت' : 'اتبنت على بياناتك إنت مش على متوسطات',
                      style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 22),
        _caloriesCard(),
        const SizedBox(height: 16),
        _macrosCard(),
        if (bmi != null) ...[
          const SizedBox(height: 16),
          _bmiCard(bmi),
        ],
        if (_waistRatioCard() != null) ...[
          const SizedBox(height: 16),
          _waistRatioCard()!,
        ],
        if (_phaseCard() != null) ...[
          const SizedBox(height: 16),
          _phaseCard()!,
        ],
        if (_loadCard() != null) ...[
          const SizedBox(height: 16),
          _loadCard()!,
        ],
        if (_adaptiveCard() != null) ...[
          const SizedBox(height: 16),
          _adaptiveCard()!,
        ],
        if (_adherenceCard() != null) ...[
          const SizedBox(height: 16),
          _adherenceCard()!,
        ],
        if (_plateauCard() != null) ...[
          const SizedBox(height: 16),
          _plateauCard()!,
        ],
        if (_muscleBalanceCard() != null) ...[
          const SizedBox(height: 16),
          _muscleBalanceCard()!,
        ],
        if (_strengthCard() != null) ...[
          const SizedBox(height: 16),
          _strengthCard()!,
        ],
        if (_recoveryCard() != null) ...[
          const SizedBox(height: 16),
          _recoveryCard()!,
        ],
        if (_stalenessCard() != null) ...[
          const SizedBox(height: 16),
          _stalenessCard()!,
        ],
        const SizedBox(height: 16),
        _proteinPerKgCard(),
        const SizedBox(height: 16),
        _infoGrid(),
        if (_dataError != null) ...[
          const SizedBox(height: 16),
          _card(
            child: ErrorView(
              message: _dataError!,
              offline: _dataOffline,
              onRetry: _retryData,
              compact: true,
            ),
          ),
        ],
        if (_saveError != null) ...[
          const SizedBox(height: 14),
          Text(_saveError!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.wo2, fontSize: 12.5)),
        ],
        const SizedBox(height: 24),
        _startButton(),
      ],
    );
  }

  // ------------------------------------------------------------ new layers

  /* Waist-to-height is the best desk-side health marker there is: it predicts
     metabolic risk better than BMI because it sees WHERE the fat sits, not
     just how heavy the person is. One cutoff, both sexes, every age above ~6:
     keep your waist under half your height. */
  Widget? _waistRatioCard() {
    final waist = _num(widget.payload['waist']).toDouble();
    final height = _num(widget.payload['height']).toDouble();
    if (waist <= 0 || height <= 0) return null;

    final ratio = waist / height;
    final String label;
    final Color color;
    final String note;
    if (ratio < 0.43) {
      label = 'تحت المعدل';
      color = const Color(0xFFFFC857);
      note = 'الوسط ضيق بالنسبة لطولك تابع أكلك كويس';
    } else if (ratio < 0.50) {
      label = 'ممتاز';
      color = AppColors.nu;
      note = 'ده النطاق الصحي. خلي وسطك أقل من نص طولك';
    } else if (ratio < 0.58) {
      label = 'مرتفع';
      color = AppColors.wo;
      note = 'دهون البطن أعلى من المطلوب دي أول حاجة هتتحسن مع الخطة';
    } else {
      label = 'مرتفع جدا';
      color = const Color(0xFFFF6B6B);
      note = 'دهون البطن في نطاق بيزود الخطر على القلب والسكر. الأولوية هنا';
    }

    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.straighten_rounded, color: color, size: 20),
              const SizedBox(width: 8),
              const Text('الوسط إلى الطول',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
              const Spacer(),
              Text(label,
                  style: TextStyle(
                      color: color, fontWeight: FontWeight.w900, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 10),
          Text(ratio.toStringAsFixed(2),
              style: TextStyle(
                  fontSize: 30, fontWeight: FontWeight.w900, color: color)),
          const SizedBox(height: 6),
          Text(note,
              style: const TextStyle(
                  color: AppColors.muted, fontSize: 12.5, height: 1.6)),
        ],
      ),
    );
  }

  /* The diet engine runs a real periodization cycle (adaptation, lean surplus,
     stabilization, cut, diet break) and picks a different calorie target for
     training days, rest days and refeeds. None of that was ever visible, so a
     trainee seeing two different numbers on two days assumed a bug. */
  Widget? _phaseCard() {
    final p = _periodization;
    if (p == null) return null;
    final phase = p['phase'];
    if (phase is! Map) return null;

    final label = '${phase['label'] ?? ''}'.trim();
    if (label.isEmpty) return null;
    final note = '${phase['note'] ?? ''}'.trim();
    final week = _num(p['week']).round();

    final today = p['today'] is Map ? p['today'] as Map : const {};
    final mode = '${today['mode'] ?? ''}'.trim();
    final todayCals = _num(today['targetCals']).round();

    final modeAr = mode == 'training'
        ? 'يوم تمرين'
        : mode == 'rest'
            ? 'يوم راحة'
            : mode == 'refeed'
                ? 'يوم إعادة تغذية'
                : '';

    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.timeline_rounded, color: AppColors.nu, size: 20),
              const SizedBox(width: 8),
              const Text('مرحلتك دلوقتي',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
              const Spacer(),
              if (week > 0)
                Text('الأسبوع $week',
                    style:
                        const TextStyle(color: AppColors.muted, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 10),
          Text(label,
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: AppColors.nu2)),
          if (modeAr.isNotEmpty || todayCals > 0) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                if (modeAr.isNotEmpty)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.wo.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(modeAr,
                        style: const TextStyle(
                            color: AppColors.wo2,
                            fontSize: 12,
                            fontWeight: FontWeight.w800)),
                  ),
                if (todayCals > 0) ...[
                  const SizedBox(width: 10),
                  Text('هدف النهارده: $todayCals سعرة',
                      style: const TextStyle(
                          color: AppColors.muted, fontSize: 12.5)),
                ],
              ],
            ),
          ],
          if (note.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(note,
                style: const TextStyle(
                    color: AppColors.muted, fontSize: 12.5, height: 1.6)),
          ],
        ],
      ),
    );
  }

  /* Weekly tonnage + ACWR. ACWR compares this week's load against the rolling
     average of recent weeks; spikes above ~1.5 are the strongest single
     predictor of overuse injury in the training-load literature, which is why
     the wording is a warning rather than a congratulation. */
  Widget? _loadCard() {
    final l = _loadStats;
    if (l == null) return null;
    final tonnage = _num(l['weeklyTonnage']).round();
    if (tonnage <= 0) return null;

    final deltaRaw = l['tonnageDeltaPct'];
    final zone = '${l['acwrZone'] ?? ''}'.trim();
    final note = '${l['acwrNote'] ?? ''}'.trim();
    final sets = _num(l['weeklySets']).round();

    Color zoneColor = AppColors.nu;
    if (zone == 'high' || zone == 'danger') {
      zoneColor = const Color(0xFFFF6B6B);
    } else if (zone == 'low') {
      zoneColor = const Color(0xFFFFC857);
    }

    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.fitness_center_rounded,
                  color: AppColors.wo, size: 20),
              const SizedBox(width: 8),
              const Text('حمل التمرين الأسبوعي',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('$tonnage',
                  style: const TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w900,
                      color: AppColors.wo2)),
              const SizedBox(width: 5),
              const Padding(
                padding: EdgeInsets.only(bottom: 5),
                child: Text('كجم إجمالي',
                    style: TextStyle(color: AppColors.muted, fontSize: 12.5)),
              ),
              const Spacer(),
              if (deltaRaw != null)
                Builder(builder: (_) {
                  final d = _num(deltaRaw).toDouble();
                  final up = d >= 0;
                  return Row(
                    children: [
                      Icon(
                          up
                              ? Icons.trending_up_rounded
                              : Icons.trending_down_rounded,
                          size: 16,
                          color: up ? AppColors.nu : AppColors.muted),
                      const SizedBox(width: 3),
                      Text('${up ? '+' : ''}${d.toStringAsFixed(1)}%',
                          style: TextStyle(
                              color: up ? AppColors.nu : AppColors.muted,
                              fontWeight: FontWeight.w800,
                              fontSize: 12.5)),
                    ],
                  );
                }),
            ],
          ),
          if (sets > 0) ...[
            const SizedBox(height: 6),
            Text('$sets مجموعة الأسبوع ده',
                style: const TextStyle(color: AppColors.muted, fontSize: 12.5)),
          ],
          if (note.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: zoneColor.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(note,
                  style:
                      TextStyle(color: zoneColor, fontSize: 12.5, height: 1.6)),
            ),
          ],
        ],
      ),
    );
  }

  // ---------------------------------------------------- طبقات تحليل الخبير
  // كل كرت تحت بيقرا رقم السيرفر بيحسبه فعليا وماكان مالوش مكان
  // في الواجهة. مافيش ولا حساب واحد بيتعمل في التليفون — عرض بس.

  Widget _statCard({
    required IconData icon,
    required Color color,
    required String title,
    String? big,
    String? bigSuffix,
    String? note,
    List<Widget> extra = const [],
  }) =>
      _card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 15)),
              ),
            ]),
            if (big != null) ...[
              const SizedBox(height: 12),
              Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(big,
                    style: TextStyle(
                        fontSize: 30,
                        fontWeight: FontWeight.w900,
                        color: color)),
                if (bigSuffix != null) ...[
                  const SizedBox(width: 5),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 5),
                    child: Text(bigSuffix,
                        style: const TextStyle(
                            color: AppColors.muted, fontSize: 12.5)),
                  ),
                ],
              ]),
            ],
            ...extra,
            if (note != null && note.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(11),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(note,
                    style:
                        TextStyle(color: color, fontSize: 12.5, height: 1.6)),
              ),
            ],
          ],
        ),
      );

  /* الأيض المقاس من واقعك مش من معادلة. لو سجلت أكلك ووزنك فترة
     كافية، السيرفر بيحسب صرفك الحقيقي من (متوسط الأكل - تغير الوزن). ده
     أدق رقم ممكن يوصلله أي تطبيق، وكان متحسوب ومرمي. */
  Widget? _adaptiveCard() {
    final a = _adaptive;
    if (a == null) return null;
    final status = '${a['status'] ?? ''}';
    final observed = _num(a['observedTdee']).round();
    final formula = _num(a['formulaTdee']).round();
    final suggested = _num(a['adaptiveTargetCals']).round();
    if (status != 'ready' || observed <= 0) {
      final logged = _num(a['loggedDays']).round();
      return _statCard(
        icon: Icons.local_fire_department_rounded,
        color: const Color(0xFFFFC857),
        title: 'أيضك المقاس من أرقامك',
        note: logged > 0
            ? 'سجلت $logged يوم أكل حتى دلوقتي. محتاجين 14 يوم أكل مسجل و 4 قياسات وزن على الأقل ونقدر نقولك صرفك الحقيقي بدل المعادلة'
            : 'سجل أكلك ووزنك أسبوعين ونقدر نحسب أيضك الحقيقي من واقعك مش من معادلة',
      );
    }
    final delta = _num(a['deltaKcal']).round();
    final sign = delta > 0 ? '+' : '';
    return _statCard(
      icon: Icons.local_fire_department_rounded,
      color: const Color(0xFFFFC857),
      title: 'أيضك المقاس من أرقامك',
      big: '$observed',
      bigSuffix: 'سعرة في اليوم',
      extra: [
        const SizedBox(height: 6),
        Text('المعادلة كانت بتقول $formula سعرة ($sign$delta)',
            style: const TextStyle(color: AppColors.muted, fontSize: 12.5)),
      ],
      note: suggested > 0
          ? 'بناء على صرفك الحقيقي، هدف سعراتك الأنسب حوالين $suggested سعرة'
          : 'الرقم ده مقاس من أكلك ووزنك الفعلي مش تخمين',
    );
  }

  /* الالتزام: مافيش خطة بتفشل وهي متطبقة. قبل أي تعديل في الأرقام
     لازم نشوف نسبة التسجيل ودقة السعرات ووصول البروتين. */
  Widget? _adherenceCard() {
    final a = _adherence;
    if (a == null) return null;
    final logging = _num(a['loggingRate']).round();
    final loggedDays = _num(a['loggedDays']).round();
    if (loggedDays <= 0) return null;
    final accuracy = a['calorieAccuracy'];
    final protein = a['proteinHitRate'];
    final water = _num(a['avgWaterMl']).round();
    final msgs = (a['messages'] is List)
        ? (a['messages'] as List).map((e) => '$e').where((e) => e.isNotEmpty).toList()
        : <String>[];
    Color color = AppColors.nu;
    if (logging < 50) {
      color = const Color(0xFFFF6B6B);
    } else if (logging < 80) {
      color = const Color(0xFFFFC857);
    }
    return _statCard(
      icon: Icons.checklist_rounded,
      color: color,
      title: 'التزامك بالخطة',
      big: '$logging%',
      bigSuffix: 'أيام مسجلة',
      extra: [
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          if (accuracy != null)
            _pill('دقة السعرات ${_num(accuracy).round()}%', AppColors.nu),
          if (protein != null)
            _pill('البروتين ${_num(protein).round()}% من الأيام',
                const Color(0xFF64B5F6)),
          if (water > 0) _pill('مية $water مل يومي', AppColors.nu2),
        ]),
      ],
      note: msgs.isEmpty ? null : msgs.first,
    );
  }

  /* ليه الوزن واقف؟ المحرك بيشخص السبب (تسجيل ناقص، مية، حركة قلت،
     نوم، إرهاق دايت) قبل ما يقلل أكل، وكل ده ماكانش بيطلع للمتدرب. */
  Widget? _plateauCard() {
    final p = _periodization;
    if (p == null || p['diagnosis'] is! Map) return null;
    final d = Map<String, dynamic>.from(p['diagnosis'] as Map);
    final stalled = d['stalled'] == true;
    final primary = d['primary'] is Map
        ? Map<String, dynamic>.from(d['primary'] as Map)
        : null;
    final adjust = p['adjustment'] is Map
        ? Map<String, dynamic>.from(p['adjustment'] as Map)
        : null;
    final blockedBy = adjust != null ? '${adjust['blockedBy'] ?? ''}' : '';
    if (!stalled && blockedBy.isEmpty) return null;
    final title = primary != null ? '${primary['titleAr'] ?? primary['title'] ?? ''}' : '';
    final action = primary != null ? '${primary['actionAr'] ?? primary['action'] ?? ''}' : '';
    return _statCard(
      icon: Icons.troubleshoot_rounded,
      color: const Color(0xFFFFC857),
      title: 'ليه الوزن واقف',
      extra: [
        const SizedBox(height: 10),
        Text(title.isEmpty ? 'فيه حاجة قبل الأكل محتاجة تتظبط' : title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        if (blockedBy.isNotEmpty) ...[
          const SizedBox(height: 8),
          _pill('منعنا تقليل السعرات', const Color(0xFFFF6B6B)),
        ],
      ],
      note: action.isEmpty
          ? 'قبل ما نقلل أكلك، لازم نصلح السبب الحقيقي الأول'
          : action,
    );
  }

  /* توزيع حجم التدريب على العضلات مقارن بالحد الأدنى الفعال (MEV)
     والسقف الأسبوعي لمستواك. ده أقوى مؤشر على إن النتيجة هتجي ولا لأ. */
  Widget? _muscleBalanceCard() {
    final c = _coach;
    if (c == null || c['muscleVolume'] is! List) return null;
    final rows = (c['muscleVolume'] as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .where((e) => _num(e['currentSets']) > 0)
        .toList();
    if (rows.isEmpty) return null;
    final show = rows.take(6).toList();
    final below = (c['belowMev'] is List) ? (c['belowMev'] as List) : const [];
    final over = (c['overCap'] is List) ? (c['overCap'] as List) : const [];
    return _statCard(
      icon: Icons.donut_large_rounded,
      color: AppColors.wo,
      title: 'حجم التدريب لكل عضلة',
      extra: [
        const SizedBox(height: 10),
        ...show.map((row) {
          final name = '${row['name'] ?? ''}';
          final sets = _num(row['currentSets']).round();
          final opt = _num(row['opt']).round();
          final grade = '${row['grade'] ?? ''}';
          Color color = AppColors.nu;
          if (grade == 'below_mev') {
            color = const Color(0xFFFFC857);
          } else if (grade == 'over_cap') {
            color = const Color(0xFFFF6B6B);
          } else if (grade == 'developing') {
            color = const Color(0xFF64B5F6);
          }
          final progress = opt > 0 ? (sets / opt).clamp(0.0, 1.0) : 0.0;
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Column(children: [
              Row(children: [
                Expanded(
                  child: Text(name,
                      style: const TextStyle(
                          fontSize: 12.5, fontWeight: FontWeight.w800)),
                ),
                Text(opt > 0 ? '$sets / $opt مجموعة' : '$sets مجموعة',
                    style: TextStyle(color: color, fontSize: 11.5)),
              ]),
              const SizedBox(height: 5),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: progress.toDouble(),
                  minHeight: 6,
                  backgroundColor: AppColors.card2,
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                ),
              ),
            ]),
          );
        }),
      ],
      note: over.isNotEmpty
          ? 'فوق السقف الأسبوعي: ${over.join('، ')} — الزيادة دي بتاكل من الاستشفاء من غير عائد'
          : (below.isNotEmpty
              ? 'تحت الحد الأدنى الفعال: ${below.take(3).join('، ')} — زود مجموعاتهم تدريجيا'
              : 'توزيع الحجم متوازن على عضلاتك — كمل زي كده'),
    );
  }

  /* القوة: أحسن أرقامك المحسوبة بمعادلة 1RM مع التمارين المتوقفة. */
  Widget? _strengthCard() {
    final lifts = _bestLifts
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .where((e) => _num(e['e1rm']) > 0)
        .take(4)
        .toList();
    final stalls = (_coach != null && _coach!['stalls'] is List)
        ? (_coach!['stalls'] as List)
            .whereType<Map>()
            .map((e) => '${e['name'] ?? ''}')
            .where((e) => e.isNotEmpty)
            .toList()
        : <String>[];
    if (lifts.isEmpty) return null;
    return _statCard(
      icon: Icons.emoji_events_rounded,
      color: AppColors.wo2,
      title: 'أرقامك القياسية وتقدم القوة',
      extra: [
        const SizedBox(height: 10),
        ...lifts.map((l) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(children: [
                Expanded(
                  child: Text('${l['name'] ?? ''}',
                      style: const TextStyle(
                          fontSize: 12.5, fontWeight: FontWeight.w800)),
                ),
                Text(
                    '${_num(l['weight']).round()} × ${_num(l['reps']).round()}',
                    style: const TextStyle(
                        color: AppColors.muted, fontSize: 11.5)),
                const SizedBox(width: 10),
                Text('≈ ${_num(l['e1rm']).round()} كجم',
                    style: const TextStyle(
                        color: AppColors.wo2,
                        fontSize: 12,
                        fontWeight: FontWeight.w900)),
              ]),
            )),
      ],
      note: stalls.isEmpty
          ? 'الرقم المتوقع لمرة واحدة محسوب من تسجيلك نفسه مش تخمين'
          : 'تمارين واقفة تقدمها: ${stalls.take(3).join('، ')} — ثبت الحمل وزود تكرار بجودة قبل زيادة الوزن',
    );
  }

  /* الاستشفاء والانتظام: متوسط RIR، أسابيع التدريب المتواصلة، وهل فيه
     أسبوع تخفيف مستحق، مع نسبة الالتزام بالجلسات. */
  Widget? _recoveryCard() {
    final c = _coach;
    if (c == null) return null;
    final trainedWeeks = _num(c['trainedWeeks']).round();
    final avgRir = c['avgRir'];
    final deload = c['deloadScheduled'] == true;
    final commitment = _loadStats != null ? _num(_loadStats!['commitment']).round() : 0;
    final recommendation = '${c['recommendation'] ?? ''}';
    if (trainedWeeks <= 0 && commitment <= 0 && avgRir == null) return null;
    final color = deload ? const Color(0xFFFF6B6B) : AppColors.nu;
    return _statCard(
      icon: Icons.self_improvement_rounded,
      color: color,
      title: 'الاستشفاء والانتظام',
      big: commitment > 0 ? '$commitment%' : null,
      bigSuffix: commitment > 0 ? 'الجلسات المكملة' : null,
      extra: [
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          if (trainedWeeks > 0)
            _pill('$trainedWeeks أسبوع تدريب', AppColors.wo),
          if (avgRir != null)
            _pill('متوسط RIR ${_num(avgRir).toStringAsFixed(1)}',
                const Color(0xFF64B5F6)),
          if (deload) _pill('أسبوع تخفيف مستحق', const Color(0xFFFF6B6B)),
        ]),
      ],
      note: recommendation.isEmpty ? null : recommendation,
    );
  }

  /* الخطة بايتة؟ لو وزنك اتغير كتير عن وقت بناء الخطة، السعرات والماكروز
     محتاجة إعادة حساب — ده أكتر سبب بيوقف التقدم في صمت. */
  Widget? _stalenessCard() {
    final s = _staleness;
    if (s == null || s['needsRecalc'] != true) return null;
    final msg = '${s['message'] ?? ''}';
    final cur = _num(s['currentWeight']);
    final planW = _num(s['planWeight']);
    return _statCard(
      icon: Icons.autorenew_rounded,
      color: const Color(0xFFFFC857),
      title: 'خطتك محتاجة تحديث',
      extra: (cur > 0 && planW > 0)
          ? [
              const SizedBox(height: 10),
              Text('وزنك دلوقتي $cur كجم والخطة مبنية على $planW كجم',
                  style: const TextStyle(color: AppColors.muted, fontSize: 12.5)),
            ]
          : const [],
      note: msg.isEmpty
          ? 'اعمل إعادة حساب للخطة عشان الأرقام تمشي مع وزنك الجديد'
          : msg,
    );
  }

  /* البروتين لكل كيلو والمية والألياف: أرقام الخبرة اللي أي مدرب بيبدأ منها. */
  Widget _proteinPerKgCard() {
    final weight = _num(widget.payload['weight']).toDouble();
    final protein = _num(_macros['protein']).toDouble();
    final perKg = (weight > 0 && protein > 0) ? protein / weight : 0.0;
    final water = weight > 0 ? (weight * 35).round() : 0;
    final fiber = _targetCals > 0 ? (_targetCals / 1000 * 14).round() : 0;
    return _statCard(
      icon: Icons.science_rounded,
      color: AppColors.nu2,
      title: 'أرقامك التفصيلية',
      extra: [
        const SizedBox(height: 10),
        Wrap(spacing: 8, runSpacing: 8, children: [
          if (perKg > 0)
            _pill('بروتين ${perKg.toStringAsFixed(1)} جم/كجم', AppColors.nu),
          if (water > 0) _pill('مية $water مل يومي', AppColors.nu2),
          if (fiber > 0) _pill('ألياف $fiber جم يومي', const Color(0xFF64B5F6)),
        ]),
      ],
      note: perKg > 0
          ? (perKg < 1.6
              ? 'البروتين ده مناسب لمرحلتك بس لو بتخس وبتتمرن بقوة يفضل يكون فوق 1.6 جم/كجم'
              : 'بروتينك في النطاق اللي بيحفز العضلة ويقلل الجوع')
          : null,
    );
  }

  Widget _pill(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(9),
        ),
        child: Text(text,
            style: TextStyle(
                color: color, fontSize: 11.5, fontWeight: FontWeight.w800)),
      );

  Widget _card({required Widget child}) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.line),
        ),
        child: child,
      );

  Widget _caloriesCard() {
    final cals = _targetCals;
    return _card(
      child: Column(
        children: [
          const Text('سعراتك اليومية المستهدفة',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.muted)),
          const SizedBox(height: 16),
          SizedBox(
            width: 190, height: 190,
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: cals <= 0 ? 0 : 1),
              duration: const Duration(milliseconds: 1100),
              curve: Curves.easeOutCubic,
              builder: (_, t, __) => CustomPaint(
                painter: _GaugePainter(progress: t, color: AppColors.nu),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(cals <= 0 ? '—' : '${(cals * t).round()}',
                          style: const TextStyle(
                              fontSize: 40, fontWeight: FontWeight.w900, color: AppColors.text)),
                      const Text('سعر/يوم',
                          style: TextStyle(fontSize: 13, color: AppColors.muted)),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _macrosCard() {
    final p = _num(_macros['protein']).toDouble();
    final c = _num(_macros['carbs']).toDouble();
    final f = _num(_macros['fat']).toDouble();
    final pk = p * 4, ck = c * 4, fk = f * 9;
    final tot = pk + ck + fk;
    double share(double kcal) => tot <= 0 ? 0 : kcal / tot;
    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('توزيع الماكروز',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.muted)),
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _macroRing('بروتين', p, share(pk), const Color(0xFF4F8CFF)),
              _macroRing('كارب', c, share(ck), AppColors.nu),
              _macroRing('دهون', f, share(fk), AppColors.wo),
            ],
          ),
        ],
      ),
    );
  }

  Widget _macroRing(String label, double grams, double progress, Color color) {
    return Column(
      children: [
        SizedBox(
          width: 86, height: 86,
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: progress),
            duration: const Duration(milliseconds: 1000),
            curve: Curves.easeOutCubic,
            builder: (_, t, __) => CustomPaint(
              painter: _RingPainter(progress: t, color: color, stroke: 9),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('${grams.round()}',
                        style: const TextStyle(
                            fontSize: 19, fontWeight: FontWeight.w900, color: AppColors.text)),
                    const Text('جم', style: TextStyle(fontSize: 10, color: AppColors.muted)),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(label,
            style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: color)),
        Text('${(progress * 100).round()}%',
            style: const TextStyle(fontSize: 11, color: AppColors.muted)),
      ],
    );
  }

  Widget _bmiCard(double bmi) {
    String cat;
    Color col;
    if (bmi < 18.5) {
      cat = 'تحت الطبيعي'; col = const Color(0xFF4F8CFF);
    } else if (bmi < 25) {
      cat = 'طبيعي'; col = AppColors.nu;
    } else if (bmi < 30) {
      cat = 'زيادة بسيطة'; col = const Color(0xFFF4C24B);
    } else {
      cat = 'وزن زائد'; col = AppColors.wo;
    }
    // Map BMI 15..35 onto 0..1 for the marker position.
    final pos = ((bmi - 15) / 20).clamp(0.0, 1.0);
    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('مؤشر كتلة الجسم (BMI)',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.muted)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: col.withValues(alpha: .16),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(cat,
                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: col)),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(bmi.toStringAsFixed(1),
              style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900, color: col)),
          const SizedBox(height: 14),
          LayoutBuilder(builder: (_, box) {
            final w = box.maxWidth;
            return SizedBox(
              height: 22,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    height: 10,
                    margin: const EdgeInsets.only(top: 6),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(6),
                      gradient: const LinearGradient(colors: [
                        Color(0xFF4F8CFF), AppColors.nu, Color(0xFFF4C24B), AppColors.wo,
                      ]),
                    ),
                  ),
                  Positioned(
                    left: (w * pos - 7).clamp(0.0, w - 14),
                    child: Container(
                      width: 14, height: 22,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: AppColors.bg, width: 2),
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _infoGrid() {
    final goal = _goalLabels[widget.payload['goal']] ?? '—';
    final act = _activityLabels[widget.payload['dailyActivity']] ?? '—';
    final diet = _dietLabels[widget.payload['diet']] ?? '—';
    final days = _num(widget.payload['trainingDays']).round();
    final mins = _num(widget.payload['trainingMinutes']).round();
    final meals = _num(widget.payload['mealCount']).round();
    final tw = widget.payload['targetWeight'];
    final tiles = <Widget>[
      _infoTile(Icons.flag_rounded, 'هدفك', goal, AppColors.wo),
      _infoTile(Icons.directions_run_rounded, 'نشاطك', act, AppColors.nu),
      _infoTile(Icons.fitness_center_rounded, 'التمرين', '$days × $minsد', AppColors.wo),
      _infoTile(Icons.restaurant_rounded, 'نظام الأكل', diet, AppColors.nu),
      _infoTile(Icons.local_dining_rounded, 'عدد الوجبات', '$meals وجبات', AppColors.nu),
      if (tw != null)
        _infoTile(Icons.monitor_weight_rounded, 'وزنك المستهدف', '${_num(tw).round()} كجم', AppColors.wo),
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 2.5,
      children: tiles,
    );
  }

  Widget _infoTile(IconData icon, String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                const SizedBox(height: 2),
                Text(value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _startButton() {
    if (widget.viewOnly) {
      return SizedBox(
        width: double.infinity,
        height: 54,
        child: FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.nu,
            foregroundColor: const Color(0xFF04231B),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.check_rounded),
          label: const Text('تمام رجوع',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        ),
      );
    }
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          height: 54,
          child: FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.nu,
              foregroundColor: const Color(0xFF04231B),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            onPressed: _goHome,
            icon: const Icon(Icons.rocket_launch_rounded),
            label: const Text('يلا نبدأ رحلتك',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          ),
        ),
        const SizedBox(height: 10),
        Text('هنبدأ تلقائيا خلال $_left ثانية',
            style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
      ],
    );
  }
}

// ---------------------------------------------------------------- painters
/// Rotating dual-arc spinner used on the analyzing phase.
class _SpinnerPainter extends CustomPainter {
  final double t;
  _SpinnerPainter(this.t);
  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 6;
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6
      ..color = AppColors.line;
    canvas.drawCircle(c, r, track);
    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 6
      ..shader = const SweepGradient(colors: [AppColors.nu, AppColors.nu2, AppColors.nu])
          .createShader(Rect.fromCircle(center: c, radius: r));
    final start = t * 2 * math.pi;
    canvas.drawArc(Rect.fromCircle(center: c, radius: r), start, math.pi * 1.25, false, arc);
    // inner counter-rotating arc
    final r2 = r - 16;
    final arc2 = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 4
      ..color = AppColors.wo.withValues(alpha: .8);
    canvas.drawArc(Rect.fromCircle(center: c, radius: r2), -start * 1.4, math.pi * 0.9, false, arc2);
  }

  @override
  bool shouldRepaint(covariant _SpinnerPainter old) => old.t != t;
}

/// A ~270° calorie gauge.
class _GaugePainter extends CustomPainter {
  final double progress;
  final Color color;
  _GaugePainter({required this.progress, required this.color});
  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 12;
    const startAngle = math.pi * 0.75;
    const sweep = math.pi * 1.5;
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 16
      ..color = AppColors.line;
    canvas.drawArc(Rect.fromCircle(center: c, radius: r), startAngle, sweep, false, track);
    final fill = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 16
      ..shader = LinearGradient(colors: [color, AppColors.nu2])
          .createShader(Rect.fromCircle(center: c, radius: r));
    canvas.drawArc(Rect.fromCircle(center: c, radius: r), startAngle,
        sweep * progress.clamp(0.0, 1.0), false, fill);
  }

  @override
  bool shouldRepaint(covariant _GaugePainter old) =>
      old.progress != progress || old.color != color;
}

/// A full-circle macro ring.
class _RingPainter extends CustomPainter {
  final double progress;
  final Color color;
  final double stroke;
  _RingPainter({required this.progress, required this.color, this.stroke = 8});
  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - stroke / 2;
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = AppColors.line;
    canvas.drawCircle(c, r, track);
    final fill = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = stroke
      ..color = color;
    canvas.drawArc(Rect.fromCircle(center: c, radius: r), -math.pi / 2,
        2 * math.pi * progress.clamp(0.0, 1.0), false, fill);
  }

  @override
  bool shouldRepaint(covariant _RingPainter old) =>
      old.progress != progress || old.color != color;
}
