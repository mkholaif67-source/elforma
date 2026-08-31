import 'package:wakelock_plus/wakelock_plus.dart';
// ── ElForma · screens/workout_screen.dart ──
// Workout tab: builds the profile payload, asks the server to compute ranked split plans,
// renders the plan cards with the science quality breakdown, and activates the chosen plan.
// تبويب التمرين: حساب الخطط المرتبة من السيرفر وتفعيل الخطة.

import 'package:flutter/material.dart';
import '../api.dart';
import '../models/profile_store.dart';
import '../models/subscription_store.dart';
import '../models/plan_store.dart';
import '../models/plan_export.dart';
import '../theme.dart';
import 'helper_units_screen.dart';
import 'pricing_screen.dart';
import 'profile_setup_screen.dart';
import 'training_session_screen.dart';
import 'workout_history_screen.dart';

/// Native workout section: collects the user's training profile, sends it to
/// the server-side workout engine (/api/workout/compute), and renders the
/// recommended weekly split with real exercises. Free users get a preview
/// (recommended split + first training day); subscribers get every split.
class WorkoutScreen extends StatefulWidget {
  const WorkoutScreen({super.key});
  @override
  State<WorkoutScreen> createState() => _WorkoutScreenState();
}

class _WorkoutScreenState extends State<WorkoutScreen>
    with SingleTickerProviderStateMixin {
  // تبويبين جوا قسم التمرين: حصة النهارده ، وحداتك.
  // الوحدات المساعدة كانت مدفونة في تبويب حسابي وماحدش كان يوصللها؛
  // مكانها الطبيعي جنب التمرين نفسه.
  late final TabController _tabs = TabController(length: 2, vsync: this);

  // form state
  String gender = 'male';
  final _age = TextEditingController(text: '25');
  final _height = TextEditingController(text: '175');
  final _weight = TextEditingController(text: '75');
  String goal = 'muscle';
  String exp = 'beginner';
  String equip = 'gym';
  int days = 4;
  String sleep = 'ok';
  String stress = 'low';
  int sessionMinutes = 60;
  String daily = 'moderate';
  List<String> injuries = [];
  List<String> weakPoints = [];

  bool _loading = false;
  String? _error;
  Map<String, dynamic>? _result; // full server response
  // [OWNER-RULE] خلال التجربة المجانية التصدير/المشاركة متوقفة، فنخفي الزر.
  bool _canExport = true;

  @override
  void initState() {
    super.initState();
    ProfileStore.I.addListener(_onProfileChanged);
    SubscriptionStore.I.addListener(_onSubChanged);
    _boot();
  }

  void _onSubChanged() {
    if (!mounted) return;
    final wasPro = _canExport;
    setState(() => _canExport = SubscriptionStore.I.canExport);
    // [OWNER-RULE] لو الاشتراك اترقى لـ Pro يحمّل الخطة فوراً بدون logout/login
    if (!wasPro && SubscriptionStore.I.canExport && _result == null && !_loading) {
      _generate();
    } else if (!wasPro && SubscriptionStore.I.isPaidActive) {
      // حتى لو الخطة موجودة، نعيد توليدها عشان تاخد السبليتات الـ Pro الكاملة
      setState(() => _result = null);
      _generate();
    }
  }

  void _onProfileChanged() {
    if (mounted) setState(() {});
  }

  /// Results-first boot. Read the shared profile once, then generate the plan
  /// immediately. The user must never be greeted by a data form again.
  Future<void> _boot() async {
    await ProfileStore.I.ensureLoaded();
    if (!mounted) return;
    _loadSavedProfile();
    if (ProfileStore.I.isComplete && _result == null && !_loading) {
      _generate();
    }
  }

  Future<void> _openSetup() async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ProfileSetupScreen(initial: ProfileStore.I.profile),
    ));
    if (!mounted) return;
    setState(() => _result = null);
    _boot();
  }

  void _loadSavedProfile() {
    final p = ProfileStore.I.profile;
    if (p == null) return;
    String workoutGoal(dynamic value) {
      switch ('$value') {
        case 'lose': return 'cut';
        case 'gain': return 'muscle';
        case 'strength': return 'strength';
        case 'fitness': return 'fitness';
        default: return 'fitness';
      }
    }
    setState(() {
      gender = (p['gender'] ?? gender).toString();
      _age.text = '${p['age'] ?? _age.text}'.replaceFirst(RegExp(r'\.0$'), '');
      _height.text = '${p['height'] ?? _height.text}'.replaceFirst(RegExp(r'\.0$'), '');
      _weight.text = '${p['weight'] ?? _weight.text}'.replaceFirst(RegExp(r'\.0$'), '');
      goal = workoutGoal(p['goal']);
      exp = (p['experience'] ?? exp).toString();
      equip = (p['equipment'] ?? equip).toString();
      days = (p['trainingDays'] as num?)?.toInt() ?? days;
      sleep = (p['sleep'] ?? sleep).toString();
      stress = (p['stress'] ?? stress).toString();
      sessionMinutes = (p['trainingMinutes'] as num?)?.toInt() ?? sessionMinutes;
      daily = (p['dailyActivity'] ?? daily).toString();
      injuries = p['injuries'] is List ? (p['injuries'] as List).whereType<String>().toList() : injuries;
      weakPoints = p['weakPoints'] is List ? (p['weakPoints'] as List).whereType<String>().toList() : weakPoints;
    });
  }

  @override
  void dispose() {
    ProfileStore.I.removeListener(_onProfileChanged);
    SubscriptionStore.I.removeListener(_onSubChanged);
    _age.dispose();
    _height.dispose();
    _weight.dispose();
    super.dispose();
  }

  Map<String, dynamic> _profile() => {
        'gender': gender,
        'age': int.tryParse(_age.text.trim()) ?? 25,
        'height': int.tryParse(_height.text.trim()) ?? 175,
        'weight': int.tryParse(_weight.text.trim()) ?? 75,
        'goal': goal,
        'exp': exp,
        'equip': equip,
        'days': days,
        'sleep': sleep,
        'stress': stress,
        'time': sessionMinutes,
        'daily': daily,
        'injuries': injuries,
        'weak': weakPoints,
      };

  /// يرجع الجدول لوضعه الأصلي بعد أي تبديل تمارين
  /// طلب صاحب المشروع: لو بدلت تمرين وعاوز الجدول الأصلي تاني
  Future<void> _resetPlan() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('رجوع للجدول الأصلي',
            style: TextStyle(color: AppColors.text, fontWeight: FontWeight.w900)),
        content: const Text(
            'هيتلغي أي تبديل عملته والجدول يرجع زي ما اتعمل أول مرة',
            style: TextStyle(color: AppColors.muted, height: 1.6)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('إلغاء', style: TextStyle(color: AppColors.muted))),
          FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppColors.wo),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('رجعه')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _result = null);
    await _generate();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('الجدول رجع لوضعه الأصلي')));
  }

  Future<void> _generate() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final bootstrap = await Api.I.mobileBootstrap();
    // السيرفر بيرجع canExport=false لمستخدم التجربة.
    final sub = bootstrap.data['subscription'];
    if (sub is Map) _canExport = sub['canExport'] == true;
    // مزامنة مع SubscriptionStore
    SubscriptionStore.I.applyFromBootstrap(bootstrap.data.cast<String, dynamic>());
    final shared = bootstrap.data['profile'];
    if (shared is Map) {
      sessionMinutes = (shared['trainingMinutes'] as num?)?.toInt() ?? sessionMinutes;
      daily = (shared['dailyActivity'] ?? daily).toString();
      injuries = shared['injuries'] is List
          ? (shared['injuries'] as List).whereType<String>().toList()
          : injuries;
      weakPoints = shared['weakPoints'] is List
          ? (shared['weakPoints'] as List).whereType<String>().toList()
          : weakPoints;
    }
    final workoutProfile = _profile();
    final r = await Api.I.workoutCompute(workoutProfile);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (r.ok && r.data['ok'] == true) {
        _result = r.data;
        PlanStore.I.markChanged(); // notify home + other screens
      } else {
        _error = r.friendlyError('تعذر توليد الجدول حاول تاني');
      }
    });
    if (r.ok && r.data['ok'] == true) {
      Map<String, dynamic>? selected; // ignore: unused_local_variable
      // [BUG-FIX] احترم اختيار المستخدم — لو عنده جدول محفوظ على السيرفر
      // (bootstrap['workoutPlan']) استخدمه بدل ما نرجع للموصى به ونكتبه عليه
      final storedKey = bootstrap.data['workoutPlan'] is Map
          ? bootstrap.data['workoutPlan']['key']?.toString()
          : null;
      if (r.data['locked'] == true && r.data['recommended'] is Map) {
        selected = Map<String, dynamic>.from(r.data['recommended'] as Map<String, dynamic>);
      } else if (r.data['plans'] is List) {
        final plans = r.data['plans'] as List;
        // ابحث عن الجدول المحفوظ أولاً وحدّث علامة rec عليه
        if (storedKey != null) {
          for (final p in plans) {
            if (p is Map && p['key']?.toString() == storedKey) {
              selected = Map<String, dynamic>.from(p as Map<String, dynamic>);
              for (final q in plans) {
                if (q is Map) q['rec'] = (q['key']?.toString() == storedKey);
              }
              break;
            }
          }
        }

      }  // close else-if
    }  // close if r.ok
  }  // close _generatePlan

// [OWNER-RULE] تحميل الخطة على التليفون كملف حقيقي — مش رابط بينتهي.
  // الملف بيتكتب محليا من الخطة المعروضة، فبيشتغل حتى لو مفيش نت،
  // والمتدرب يقدر يفظه أو يبعته ويفضل معاه للأبد.
  Future<void> _downloadPlan() async {
    final r = _result;
    if (r == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('فعل خطة تمرين الأول قبل ما تحملها')));
      return;
    }
    try {
      // [بند 11] نسخة رسمية احترافية (HTML تتطبع/تتحفظ PDF) بدل TXT.
      final prof = ProfileStore.I.profile ?? const <String, dynamic>{};
      final trainee = (prof['name'] ?? '').toString();
      final html = PlanExport.workoutHtml(r, trainee: trainee, profile: prof);
      await PlanExport.download(
        html: html,
        baseName: 'elforma-workout-plan',
        shareText: 'خطة تمريني من تطبيق الفورمة',
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('تعذر حفظ الملف — حاول تاني')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('قسم التمرين',
            style: TextStyle(fontWeight: FontWeight.w900)),
        centerTitle: true,
        actions: [
          // تحميل الخطة كملف على التليفون (مش متاح خلال التجربة).
          if (_canExport && _result != null)
            IconButton(
              tooltip: 'حمل الخطة على تليفونك',
              icon: const Icon(Icons.download_rounded, color: AppColors.nu2),
              onPressed: _downloadPlan,
            ),
          if (_result != null)
            IconButton(
              tooltip: 'رجع الجدول زي ما كان',
              icon: const Icon(Icons.restart_alt_rounded, color: AppColors.wo2),
              onPressed: _loading ? null : _resetPlan,
            ),
          IconButton(
            tooltip: 'سجل التدريب',
            icon: const Icon(Icons.query_stats_rounded, color: AppColors.nu),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => const WorkoutHistoryScreen(),
            )),
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: AppColors.wo,
          indicatorWeight: 3,
          labelColor: AppColors.text,
          unselectedLabelColor: AppColors.muted,
          labelStyle:
              const TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5),
          tabs: const [
            Tab(text: 'حصة النهارده'),
            Tab(text: '\u062a\u0645\u0627\u0631\u064a\u0646 \u0645\u0643\u0645\u0644\u0629'),
          ],
        ),
      ),
      body: RefreshIndicator(
        color: AppColors.nu,
        backgroundColor: AppColors.card,
        onRefresh: () async {
          // [FIX] السحب للتحديث يزامن حالة الاشتراك (تفعيل الأدمن يبان فورًا)
          // ثم يعيد بناء الجدول — من غير ما المستخدم يقفل التطبيق ويفتحه.
          await SubscriptionStore.I.refresh();
          await _generate();
        },
        child: TabBarView(
          controller: _tabs,
          children: [
            _gatedBody(),
            const HelperUnitsHub(),
          ],
        ),
      ),
    );
  }

  // ------------------------------------------------------------ GATE
  /// Decides what the tab opens on. A raw input form is now the LAST resort,
  /// shown only when we genuinely have no usable profile.
  Widget _gatedBody() {
    final store = ProfileStore.I;
    if (!store.loaded && store.profile == null) {
      return const Center(
          child: CircularProgressIndicator(color: AppColors.wo));
    }
    if (!store.isComplete) return _setupCta();
    if (_result != null) return _buildResult();
    if (_loading) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: AppColors.wo),
            SizedBox(height: 16),
            Text('بنجهز جدولك من بياناتك',
                style: TextStyle(
                    color: AppColors.muted, fontWeight: FontWeight.w600)),
          ],
        ),
      );
    }
    if (_error != null) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 24, 16, 40),
        children: [
          _errorBox(_error!),
          const SizedBox(height: 16),
          SizedBox(
            height: 52,
            child: FilledButton(
              style: FilledButton.styleFrom(
                  backgroundColor: AppColors.wo,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14))),
              onPressed: _generate,
              child: const Text('حاول تاني',
                  style:
                      TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
          ),
        ],
      );
    }
    return _buildForm();
  }

  Widget _setupCta() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 92,
              height: 92,
              decoration: BoxDecoration(
                  color: AppColors.wo.withValues(alpha: .12),
                  shape: BoxShape.circle),
              child: const Icon(Icons.fitness_center_rounded,
                  color: AppColors.wo, size: 44),
            ),
            const SizedBox(height: 22),
            const Text('جدولك مستني بياناتك',
                textAlign: TextAlign.center,
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20)),
            const SizedBox(height: 10),
            const Text(
              'محرك التمرين بيبني تقسيمة أسبوعية على مقاسك من خبرتك وأيامك وإصاباتك ونقاط ضعفك. هتملأ بياناتك مرة واحدة بس',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, height: 1.6),
            ),
            const SizedBox(height: 26),
            SizedBox(
              width: double.infinity,
              height: 54,
              child: FilledButton(
                style: FilledButton.styleFrom(
                    backgroundColor: AppColors.wo,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16))),
                onPressed: _openSetup,
                child: const Text('ابدأ الإعداد',
                    style: TextStyle(
                        fontSize: 17, fontWeight: FontWeight.w900)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------- FORM
  Widget _buildForm() {
    return ListView(
      // [FIX] فيزياء تسمح بالسحب-للتحديث حتى لو المحتوى أقصر من الشاشة.
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
      children: [
        _header(),
        const SizedBox(height: 18),
        _segment('النوع', gender, {'male': 'ذكر', 'female': 'أنثى'},
            (v) => setState(() => gender = v)),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: _numField('العمر', _age)),
          const SizedBox(width: 10),
          Expanded(child: _numField('الطول (سم)', _height)),
          const SizedBox(width: 10),
          Expanded(child: _numField('الوزن (كجم)', _weight)),
        ]),
        const SizedBox(height: 14),
        _segment('الهدف', goal, {
          'muscle': 'تضخيم',
          'cut': 'تنشيف',
          'strength': 'قوة',
          'fitness': 'لياقة',
        }, (v) => setState(() => goal = v)),
        const SizedBox(height: 14),
        _segment('الخبرة', exp, {
          'beginner': 'مبتدئ',
          'intermediate': 'متوسط',
          'advanced': 'متقدم',
        }, (v) => setState(() => exp = v)),
        const SizedBox(height: 14),
        _segment('مكان التمرين', equip, {'gym': 'جيم', 'home': 'البيت'},
            (v) => setState(() => equip = v)),
        const SizedBox(height: 14),
        _daysPicker(),
        const SizedBox(height: 14),
        _segment('النوم', sleep, {
          'poor': 'ضعيف',
          'ok': 'كويس',
          'good': 'ممتاز',
        }, (v) => setState(() => sleep = v)),
        const SizedBox(height: 14),
        _segment('التوتر', stress, {
          'low': 'قليل',
          'mid': 'متوسط',
          'high': 'عالي',
        }, (v) => setState(() => stress = v)),
        const SizedBox(height: 24),
        _generateBtn(),
        if (_error != null) ...[
          const SizedBox(height: 14),
          _errorBox(_error!),
        ],
      ],
    );
  }

  Widget _header() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(colors: [
          AppColors.wo.withValues(alpha: .16),
          AppColors.wo2.withValues(alpha: .05),
        ]),
        border: Border.all(color: AppColors.wo.withValues(alpha: .25)),
      ),
      child: Row(children: [
        Container(
          width: 54,
          height: 54,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: const LinearGradient(colors: [AppColors.wo, AppColors.wo2]),
          ),
          child: const Icon(Icons.fitness_center, color: Colors.white, size: 26),
        ),
        const SizedBox(width: 14),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('جدولك التدريبي الذكي',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
              SizedBox(height: 4),
              Text('املأ بياناتك ونبنيلك جدول مخصص على حسب هدفك وأيامك ومستواك',
                  style: TextStyle(color: AppColors.muted, fontSize: 12, height: 1.5)),
            ],
          ),
        ),
      ]),
    );
  }

  Widget _label(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 8, right: 2),
        child: Text(t,
            style: const TextStyle(
                fontWeight: FontWeight.w800, fontSize: 13, color: AppColors.text)),
      );

  Widget _segment(String label, String value, Map<String, String> options,
      ValueChanged<String> onChange) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label(label),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: options.entries.map((e) {
            final sel = e.key == value;
            return GestureDetector(
              onTap: () => onChange(e.key),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding:
                    const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: sel
                      ? const LinearGradient(
                          colors: [AppColors.wo, AppColors.wo2])
                      : null,
                  color: sel ? null : AppColors.card,
                  border: Border.all(
                      color: sel
                          ? Colors.transparent
                          : AppColors.line.withValues(alpha: .6)),
                ),
                child: Text(e.value,
                    style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        color: sel ? Colors.white : AppColors.muted)),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _numField(String label, TextEditingController c) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label(label),
        TextField(
          controller: c,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          style: const TextStyle(
              fontWeight: FontWeight.w800, color: AppColors.text),
          decoration: InputDecoration(
            filled: true,
            fillColor: AppColors.card,
            contentPadding: const EdgeInsets.symmetric(vertical: 14),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: AppColors.line.withValues(alpha: .6)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.wo2, width: 1.4),
            ),
          ),
        ),
      ],
    );
  }

  Widget _daysPicker() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label('أيام التمرين في الأسبوع'),
        Row(
          children: [2, 3, 4, 5, 6].map((d) {
            final sel = d == days;
            return Expanded(
              child: GestureDetector(
                onTap: () => setState(() => days = d),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: sel
                        ? const LinearGradient(
                            colors: [AppColors.wo, AppColors.wo2])
                        : null,
                    color: sel ? null : AppColors.card,
                    border: Border.all(
                        color: sel
                            ? Colors.transparent
                            : AppColors.line.withValues(alpha: .6)),
                  ),
                  child: Text('$d',
                      style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 16,
                          color: sel ? Colors.white : AppColors.muted)),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _generateBtn() {
    return SizedBox(
      height: 54,
      child: ElevatedButton(
        onPressed: _loading ? null : _generate,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.wo,
          disabledBackgroundColor: AppColors.wo.withValues(alpha: .5),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14)),
        ),
        child: _loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                    strokeWidth: 2.4, color: Colors.white))
            : const Text('حلل وابن جدولي',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: Colors.white)),
      ),
    );
  }

  Widget _errorBox(String msg) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.red.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.red.withValues(alpha: .4)),
      ),
      child: Row(children: [
        const Icon(Icons.error_outline, color: Colors.redAccent, size: 20),
        const SizedBox(width: 10),
        Expanded(
            child: Text(msg,
                style: const TextStyle(
                    color: Colors.redAccent, fontWeight: FontWeight.w600))),
      ]),
    );
  }

  // -------------------------------------------------------------- RESULT
  Widget _buildResult() {
    final r = _result!;
    final locked = r['locked'] == true;
    final metrics = (r['metrics'] as Map?)?.cast<String, dynamic>() ?? {};

    final List<Widget> children = [
      _metricsCard(metrics),
      const SizedBox(height: 16),
    ];

    if (locked) {
      final rec = (r['recommended'] as Map?)?.cast<String, dynamic>();
      final plansTotal = (r['plansTotal'] ?? 0) as int;
      if (rec != null) {
        children.add(_splitHeader(rec['name']?.toString() ?? '',
            rec['desc']?.toString() ?? '', true));
        final total = (rec['trainDaysTotal'] ?? 0) as int;
        final pv = (rec['previewDay'] as Map?)?.cast<String, dynamic>();
        if (pv != null) {
          children.add(const SizedBox(height: 12));
          children.add(_dayCard(pv, 1));
        }
        if (total > 1) {
          children.add(const SizedBox(height: 12));
          children.add(_lockedCard(total - 1, plansTotal));
        }
      }
    } else {
      final plans = (r['plans'] as List?) ?? [];
      Map<String, dynamic>? rec;
      for (final p in plans) {
        if (p is Map && p['rec'] == true) {
          rec = p.cast<String, dynamic>();
          break;
        }
      }
      rec ??= plans.isNotEmpty ? (plans.first as Map).cast<String, dynamic>() : null;
      // [OWNER-RULE] صفحة التمرين تعرض تمرين اليوم فقط — مش الأسبوع كله.
      // باقي الأيام موجودة داخل النظام بس ماتتعرضش هنا.
      if (rec != null) children.addAll(_todayOnly(rec));

      // [OWNER-RULE] الجدول المفعل (الموصى/المحفوظ) لازم يتشال من
      // قائمة التبديل لأنه بالفعل شغال — نستبعده بال key مش
      // بالمرجع بس عشان مايظهرش تاني بعد إعادة التحميل.
      final recKey = (rec?['key'] ?? '').toString();
      final others = plans
          .where((p) =>
              p is Map &&
              p != rec &&
              (p['key'] ?? '').toString() != recKey)
          .map((p) => (p as Map).cast<String, dynamic>())
          .toList();
      // تبديل واختيار الجدول متاح لمستوى المتقدم بس. غير كده بنثبت
      // الجدول الموصى بيه (اللي اتحفظ تلقائيا) ونوضح إن التبديل للمتقدم.
      if (others.isNotEmpty) {
        if (exp == 'advanced' || exp == 'intermediate') {
          children.add(const SizedBox(height: 20));
          // [OWNER-RULE] الجداول البديلة مطوية خلف زرار أنيق — تتفتح
          // بالضغط بس مش ظاهرة في الوش، والجدول المفعل مستبعد.
          children.add(_swapSection(others));
        } else {
          children.add(const SizedBox(height: 20));
          children.add(_advancedOnlyNote());
        }
      }
    }

    return ListView(
      // [FIX] فيزياء تسمح بالسحب-للتحديث حتى لو المحتوى أقصر من الشاشة.
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
      children: children,
    );
  }

  /// المحرك مابيبعتش isRest دايما — أيام الراحة بتيجي باسم «Rest — يوم تعافي»
  /// وبلستة تمارين فاضية. لو اعتمدنا على isRest بس، يوم الراحة بيترسم
  /// ككارت تمرين فاضي — وده اللي كان بيحصل.
  bool _dayIsRest(Map<String, dynamic> day) {
    if (day['isRest'] == true) return true;
    final ex = day['exercises'];
    if (ex is List && ex.isEmpty) return true;
    final name = (day['name'] ?? '').toString().toLowerCase();
    return name.contains('rest') || name.contains('راحة') || name.contains('تعافي');
  }

  /// [بند 12] موضع يوم النهارده في الجدول — نفس منطق الهوم بالظبط
  /// عشان التبويبين مايختلفوش: التقدم بالأيام التقويمية من تاريخ
  /// تفعيل الجدول (مش بالجلسات)، والأسبوع يبدأ السبت.
  // [FIX-8/9/10] Two separate cases:
  // Case 1: selectedDays set → week[0]=Sun..week[6]=Sat, scheduleStartDate=most recent Sunday
  // Case 2: no selectedDays → cyclic from scheduleStartDate (customize logic)
  int _todayIndex(Map<String, dynamic> plan, int len) {
    if (len <= 0) return 0;
    // Get selectedDays from plan data
    final dynamic rawData = plan['data'];
    final dynamic rawSelected = rawData is Map
        ? rawData['selectedDays']
        : plan['selectedDays'];

    final schedStartStr = rawData is Map
        ? rawData['_scheduleStartDate']?.toString()
        : plan['_scheduleStartDate']?.toString();
    final startStr = schedStartStr ?? plan['createdAt']?.toString();

    if (rawSelected is List && rawSelected.isNotEmpty) {
      // Case 1: User selected specific weekdays
      // scheduleStartDate = most recent Sunday → daysSince = weekday (0=Sun..6=Sat)
      if (startStr != null && startStr.isNotEmpty) {
        try {
          final activation = DateTime.parse(startStr).toLocal();
          final today = DateTime.now();
          final t = DateTime(today.year, today.month, today.day);
          final a = DateTime(activation.year, activation.month, activation.day);
          final daysSince = t.difference(a).inDays.clamp(0, 100000);
          final weekdayIdx = daysSince % 7;
          return weekdayIdx < len ? weekdayIdx : 0;
        } catch (_) {}
      }
      return 0;
    }

    // Case 2: No selected days — cyclic from scheduleStartDate
    if (startStr != null && startStr.isNotEmpty) {
      try {
        final activation = DateTime.parse(startStr).toLocal();
        final today = DateTime.now();
        final t = DateTime(today.year, today.month, today.day);
        final a = DateTime(activation.year, activation.month, activation.day);
        final daysSince = t.difference(a).inDays.clamp(0, 100000);
        return daysSince % len;
      } catch (_) {}
    }
    // Fallback: Arabic week starts Saturday=0
    return ((DateTime.now().weekday + 1) % 7) % len;
  }
    // Fallback: أسبوع السبت=0 (بيتطابق مع الأسبوع العربي)
    return ((DateTime.now().weekday + 1) % 7) % len;
  }

  /// بانر في وش المتدرب أول ما يدخل التبويب: النهارده تمرين ولا راحة؟
  /// الجدول بيبدأ من يوم السبت زي الموقع تماما.
  Widget? _todayBanner(Map<String, dynamic> plan) {
    final week = (plan['plan'] as List?) ?? [];
    if (week.length < 7) return null;
    final idx = _todayIndex(plan, week.length); // من تاريخ التفعيل — متطابق مع الهوم
    final raw = week[idx];
    if (raw is! Map) return null;
    final day = raw.cast<String, dynamic>();
    final rest = _dayIsRest(day);
    final color = rest ? const Color(0xFF8BA8FF) : AppColors.wo;
    final name = (day['name'] ?? '').toString().split(RegExp(r'\s*[—–|-]\s*')).first.trim();
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .10),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: .32)),
      ),
      child: Row(children: [
        Icon(rest ? Icons.bedtime_rounded : Icons.local_fire_department_rounded,
            color: color, size: 26),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(rest ? 'مفيش تمرين النهارده يوم راحة' : 'تمرين النهارده',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
              const SizedBox(height: 3),
              Text(
                rest
                    ? 'الراحة جزء من البرنامج مش كسل العضلة بتكبر دلوقتي. امشي شوية ونام كويس'
                    : (name.isEmpty ? 'جلسة النهارده جاهزة تحت' : '$name جاهز تحت'),
                style: const TextStyle(
                    color: AppColors.muted, fontSize: 12, height: 1.55),
              ),
            ],
          ),
        ),
      ]),
    );
  }

  /// [OWNER-RULE] تمرين اليوم فقط: بنجيب يوم النهاردة من الجدول
  /// (الأسبوع بيبدأ من السبت). لو تمرين → كارت اليوم بس.
  /// لو راحة → شاشة راحة شيك ومبهجة. باقي الأيام ماتتعرضش.

/// يعرض تمرين النهاردة أو شاشة الراحة بناءً على الجدول الفعلي.
  /// [FIX] يوم الراحة: بدون اسم الجدول أو السعرات — راحة فقط في وشه.
  /// [FIX] حُذف _isPlanCreatedToday: الجدول يبدأ من يوم التفعيل مباشرةً.
  List<Widget> _todayOnly(Map<String, dynamic> plan) {
    final week = (plan['plan'] as List?) ?? [];

    // تحديد يوم النهارده قبل ما نبني الواجهة
    bool isRestDay;
    Map<String, dynamic> todayDay;

    if (week.length < 7) {
      // جدول صغير → أول يوم تمرين حقيقي
      final first = week
          .whereType<Map>()
          .cast<Map<String, dynamic>>()
          .firstWhere((d) => !_dayIsRest(d), orElse: () => <String, dynamic>{});
      todayDay = first;
      isRestDay = first.isEmpty;
    } else {
      final idx = _todayIndex(plan, week.length);
      final raw = week[idx];
      todayDay = raw is Map ? raw.cast<String, dynamic>() : <String, dynamic>{};
      isRestDay = todayDay.isEmpty || _dayIsRest(todayDay);
    }

    // يوم راحة: اعرض شاشة الراحة فقط بدون سعرات أو اسم الجدول
    if (isRestDay) {
      return [
        const SizedBox(height: 12),
        _restDayHero(),
      ];
    }

    // يوم تمرين: الهيدر + كارت التمرين
    return [
      _splitHeader(
        plan['name']?.toString() ?? '',
        plan['desc']?.toString() ?? '',
        true,
        score: plan['score'] is num ? plan['score'] as num : null,
        quality: plan['quality'] is Map
            ? (plan['quality'] as Map).cast<String, dynamic>()
            : null,
      ),
      const SizedBox(height: 12),
      _dayCard(todayDay, 1),
    ];
  }

  /// [OWNER-RULE] شاشة يوم الراحة: بسيطة وشيك ومبهجة، مع نصائح
  /// خفيفة ليوم الراحة، بدون تعقيد أو عرض باقي الجدول.
  /// [OWNER-RULE] صفحة يوم الراحة: بسيطة وشيكة ومبهجة فقط.
  /// isCustom=true → يوم إنشاء الجدول (يبدأ الجدول فعلًا من بكرة)
  Widget _restDayHero({bool isCustom = false}) {
    const c = Color(0xFF8BA8FF);
    final emoji = isCustom ? '★' : '♥';
    final title = isCustom ? 'يوم راحة تهيئة $emoji' : 'النهاردة يوم راحة $emoji';
    final subtitle = isCustom
        ? 'الجدول بيبدأ بكرة — استرخي النهاردة وكن جاهز'
        : 'خد نفسك — الراحة جزء من الخطة مش كسل';

    return Column(
      children: [
        // ─ بانر الراحة الرئيسي
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [c.withValues(alpha: .20), AppColors.card],
            ),
            border: Border.all(color: c.withValues(alpha: .28)),
          ),
          child: Column(
            children: [
              Container(
                width: 72, height: 72,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: c.withValues(alpha: .14),
                  shape: BoxShape.circle,
                  border: Border.all(color: c.withValues(alpha: .30), width: 1.5),
                ),
                child: const Icon(Icons.self_improvement_rounded, color: c, size: 36),
              ),
              const SizedBox(height: 16),
              Text(title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22)),
              const SizedBox(height: 8),
              Text(subtitle,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.muted, fontSize: 13.5, height: 1.55)),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ─ بطاقة تقييم اليوم
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  width: 36, height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.nu.withValues(alpha: .14),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.fitness_center, size: 18, color: Colors.white),
                ),
                const SizedBox(width: 10),
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('كيف احساسك اليوم؟',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                    Text('قيّم يوم راحتك',
                        style: TextStyle(color: AppColors.muted, fontSize: 11.5)),
                  ],
                ),
              ]),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _moodChip('●', 'متعب'),
                  _moodChip('—', 'عادي'),
                  _moodChip('☺', 'كويس'),
                  _moodChip('⚡', 'نشيط جدا'),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ─ نصائح الاستشفاء
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            children: [
              _restTip(Icons.directions_walk_rounded, c, 'حركة خفيفة',
                  'امشي 20–30 دقيقة بتسرع الدم وتقلّل وجع العضلة'),
              const SizedBox(height: 10),
              _restTip(Icons.water_drop_rounded, const Color(0xFF64B5F6), 'مية وبروتين',
                  'اشرب 2–3 لتر مية وكمل بروتينك زي أي يوم — العضلة بتتبني جسمك دلوقتي'),
              const SizedBox(height: 10),
              _restTip(Icons.bedtime_rounded, const Color(0xFF9575CD), 'نوم كويس',
                  '7–9 ساعات نوم = عضلة بتكبر + أداء أحسن بكرة'),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ─ كلام تحفيزي
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.wo.withValues(alpha: .12), AppColors.card],
            ),
            border: Border.all(color: AppColors.wo.withValues(alpha: .22)),
          ),
          child: Column(
            children: [
              const Icon(Icons.emoji_events_rounded, size: 32, color: Color(0xFFD4AF37)),
              const SizedBox(height: 10),
              const Text(
                'الراحة مش كسل — هي جزء من التدريب',
                textAlign: TextAlign.center,
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
              const SizedBox(height: 8),
              const Text(
                'في يوم الراحة عضلتك بتصلح وبتتكيف وبتتكيف نفسها. بكرة هتجي أقوى وأدائك هيكون أحسن.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted, fontSize: 12.5, height: 1.6),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _moodChip(String emoji, String label) {
    return GestureDetector(
      onTap: () {},
      child: Column(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 26)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 10, color: AppColors.muted)),
        ],
      ),
    );
  }

  Widget _restTip(IconData icon, Color color, String title, String desc) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 38, height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: color.withValues(alpha: .14),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
              const SizedBox(height: 2),
              Text(desc, style: const TextStyle(color: AppColors.muted, fontSize: 12, height: 1.5)),
            ],
          ),
        ),
      ],
    );
  }

  // [ملاحظة من الفحص — كود مهجور] الدالة دي مفيش حاجة بتناديها خالص في المشروع.
  // الشاشة بتستخدم _todayOnly() بدالها، يعني عرض "الجدول الكامل" ده
  // مش قادر المستخدم يوصله أصلا. سيبناها زي ما هي بدل ما نحذفها لأنها شكلها
  // ميزة اتفصلت بالغلط مش كود زايد — قرار وصلها تاني أو حذفها قرار منتج مش فني.
  // ignore: unused_element
  List<Widget> _fullSplit(Map<String, dynamic> plan, bool rec) {
    final banner = rec ? _todayBanner(plan) : null;
    final out = <Widget>[
      if (banner != null) banner,
      _splitHeader(
        plan['name']?.toString() ?? '',
        plan['desc']?.toString() ?? '',
        rec,
        score: plan['score'] is num ? plan['score'] as num : null,
        quality: plan['quality'] is Map
            ? (plan['quality'] as Map).cast<String, dynamic>()
            : null,
      ),
    ];
    final week = (plan['plan'] as List?) ?? [];
    int trainIdx = 0;
    for (final d in week) {
      if (d is! Map) continue;
      final day = d.cast<String, dynamic>();
      if (_dayIsRest(day)) {
        out.add(const SizedBox(height: 10));
        out.add(_restCard());
      } else {
        trainIdx++;
        out.add(const SizedBox(height: 12));
        out.add(_dayCard(day, trainIdx));
      }
    }
    return out;
  }

  /// [OWNER-RULE] تبديل الجدول للمتقدم: يظهر اسم الجدول فقط
  /// (مش تفاصيله)، وعند الضغط يأكد حفظ ويتغير الجدول فعليا.
  /// [OWNER-RULE] قسم «بدل جدولك» بيبقى مطوي في زرار أنيق؛ يتفتح لما
  /// المتقدم يضغط عليه، وجواه أسماء الجداول البديلة بس (من غير المفعل).
  Widget _swapSection(List<Map<String, dynamic>> others) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line.withValues(alpha: .6)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: false,
          tilePadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
          iconColor: AppColors.wo2,
          collapsedIconColor: AppColors.muted,
          leading:
              const Icon(Icons.swap_horiz_rounded, color: AppColors.wo2),
          title: const Text('بدّل جدولك',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
          subtitle: Text('${others.length} جداول بديلة — اضغط تشوفها',
              style: const TextStyle(color: AppColors.muted, fontSize: 12)),
          children: [for (final o in others) _altSplitTile(o)],
        ),
      ),
    );
  }

  Widget _altSplitTile(Map<String, dynamic> plan) {
    final td = (plan['trainDays'] as List?)?.length ?? 0;
    final name = plan['name']?.toString() ?? '';
    return Container(
      margin: const EdgeInsets.only(top: 10),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line.withValues(alpha: .5)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => _confirmSwitchPlan(plan),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              const Icon(Icons.swap_horiz_rounded, color: AppColors.wo2, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 14,
                            color: AppColors.text)),
                    const SizedBox(height: 3),
                    Text('$td أيام تدريب',
                        style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_left_rounded, color: AppColors.muted, size: 22),
            ]),
          ),
        ),
      ),
    );
  }

  /// تأكيد التبديل قبل ما نغير الجدول المفعل فعليا.
  Future<void> _confirmSwitchPlan(Map<String, dynamic> plan) async {
    final name = plan['name']?.toString() ?? 'الجدول';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('تبديل الجدول',
            style: TextStyle(fontWeight: FontWeight.w900)),
        content: Text('عايز تبدل جدولك الحالي ب«$name»؟ هيتحفظ ويبقى جدولك المفعل.',
            style: const TextStyle(color: AppColors.muted, height: 1.6)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('لأ', style: TextStyle(color: AppColors.muted)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.wo),
            child: const Text('احفظ وبدل',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    // [FIX-PLAN-RESET] لو فيه جلسة شغالة للجدول القديم — بننهيها عشان الجدول الجديد يبدأ من اليوم 1
    final _activeSession = _result?['activeSession'];
    if (_activeSession != null) {
      WakelockPlus.disable();
      final _sid = (_activeSession['id'] ?? 0) as int;
      await Api.I.finishWorkoutSession(_sid, 0, 'plan_switched');
    }
    final r = await Api.I.activateWorkoutPlan(
        (plan['key'] ?? 'recommended').toString(), plan);
    if (!mounted) return;
    if (r.ok) {
      PlanStore.I.markChanged(); // [FIX-1] notify home immediately
      SubscriptionStore.I.refresh(); // refresh all subscription listeners
      // [BUG-FIX] إعادة تحميل كاملة عشان تمرين اليوم يتعرض من الجدول الجديد فعلاً
      // كان الكود القديم بيغير rec فقط بدون ما يجيب أيام الجدول الجديد من السيرفر
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('تم التبديل ل«$name» واتحفظ')));
      setState(() => _result = null);
      _boot();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(r.friendlyError('تعذر تبديل الجدول حاول تاني'))));
    }
  }

  /// تبديل واختيار الجدول مميزة لمستوى المتقدم. غير كده بنثبت
  /// الجدول الموصى بيه (محفوظ تلقائيا) ونوضح السبب.
  Widget _advancedOnlyNote() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.wo.withValues(alpha: .08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.wo.withValues(alpha: .28)),
      ),
      child: Row(children: [
        const Icon(Icons.lock_outline_rounded, color: AppColors.wo2, size: 24),
        const SizedBox(width: 12),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('تبديل الجدول متاح للمتوسط والمتقدم',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
              SizedBox(height: 4),
              Text(
                'جدولك الموصى بيه اتحفظ وشغال تلقائيا. لما توصل لمستوى المتقدم هتقدر تبدل بين الجداول البديلة وتختار الأنسب ليك.',
                style: TextStyle(color: AppColors.muted, fontSize: 12, height: 1.55),
              ),
            ],
          ),
        ),
      ]),
    );
  }

  Widget _metricsCard(Map<String, dynamic> m) {
    final bmi = (m['bmi'] is num) ? (m['bmi'] as num).toStringAsFixed(1) : '—';
    final bmiCat = m['bmiCat']?.toString() ?? '';
    // [OWNER-RULE] نفس رقم صفحة التغذية بالظبط: بنعرض السعرات
    // المستهدفة (بعد العجز/الفائض حسب الهدف)، مش TDEE الثبات.
    // الرقم جاي من محرك التغذية (targetCals) ولو مفيش بنرجع ل TDEE.
    final calVal = (m['targetCals'] is num)
        ? m['targetCals'] as num
        : (m['tdee'] is num ? m['tdee'] as num : null);
    final cals = calVal != null ? calVal.round().toString() : '—';
    final rec = (m['recoveryScore'] is num)
        ? (m['recoveryScore'] as num).round().toString()
        : '—';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line.withValues(alpha: .5)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _metric('BMI', bmi, bmiCat),
          _divider(),
          _metric('السعرات المستهدفة', cals, 'سعرة/يوم'),
          _divider(),
          _metric('الاستشفاء', rec, 'من 100'),
        ],
      ),
    );
  }

  Widget _divider() =>
      Container(width: 1, height: 40, color: AppColors.line.withValues(alpha: .5));

  Widget _metric(String label, String value, String sub) {
    return Column(
      children: [
        Text(value,
            style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: AppColors.wo2)),
        const SizedBox(height: 3),
        Text(label,
            style: const TextStyle(
                fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.text)),
        Text(sub,
            style: const TextStyle(fontSize: 10, color: AppColors.muted)),
      ],
    );
  }

  /// شارة جودة الخطة — the website's `qchip`, same thresholds and colours.
  ///
  /// The engine scores every split scientifically (muscle frequency, recovery
  /// demand, experience, goal) and grades the built plan out of 100. Hiding
  /// that left you unable to see WHY one schedule was put in front of another.
  Widget _qualityChip(num? score, Map<String, dynamic>? quality) {
    final grade = quality == null ? null : quality['grade']?.toString();
    final planScore = quality != null && quality['score'] is num
        ? (quality['score'] as num).round()
        : null;
    if (grade == null && planScore == null && score == null) {
      return const SizedBox.shrink();
    }
    final shown = planScore ?? score!.round();
    final color = shown >= 82
        ? const Color(0xFF00D4AA)
        : shown >= 62
            ? const Color(0xFF22B8CF)
            : const Color(0xFFFF9266);
    final label = grade == null
        ? 'جودة الخطة $shown'
        : 'جودة الخطة $grade · $shown';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .13),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: .35)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11.5,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  /// The single strongest reason to trust a schedule: the breakdown the engine
  /// itself produced (coverage, frequency, balance, integrity, recovery,
  /// prescription). The website shows it, so the app shows it too.
  Widget _qualityBreakdown(Map<String, dynamic>? quality) {
    final rows = quality == null ? null : quality['breakdown'];
    if (rows is! List || rows.isEmpty) return const SizedBox.shrink();
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        childrenPadding: const EdgeInsets.only(bottom: 6),
        title: const Text(
          'ليه الجدول دا بالذات؟',
          style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
              color: AppColors.wo2),
        ),
        children: rows.whereType<Map>().map((raw) {
          final row = raw.cast<String, dynamic>();
          final got = row['got'] is num ? (row['got'] as num) : 0;
          final max = row['max'] is num ? (row['max'] as num) : 0;
          final ratio = max > 0 ? (got / max).clamp(0.0, 1.0) : 0.0;
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        row['label']?.toString() ?? '',
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w700),
                      ),
                    ),
                    Text(
                      '$got/$max',
                      style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
                const SizedBox(height: 5),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: ratio.toDouble(),
                    minHeight: 5,
                    backgroundColor: AppColors.line,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      ratio >= .85
                          ? const Color(0xFF00D4AA)
                          : ratio >= .6
                              ? const Color(0xFF22B8CF)
                              : const Color(0xFFFF9266),
                    ),
                  ),
                ),
                if ((row['note']?.toString() ?? '').isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    row['note'].toString(),
                    style: const TextStyle(
                        color: AppColors.muted, fontSize: 11, height: 1.4),
                  ),
                ],
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _splitHeader(String name, String desc, bool rec,
      {num? score, Map<String, dynamic>? quality}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(colors: [
          AppColors.wo.withValues(alpha: .18),
          AppColors.wo2.withValues(alpha: .06),
        ]),
        border: Border.all(color: AppColors.wo.withValues(alpha: .3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            if (rec)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                margin: const EdgeInsets.only(left: 8),
                decoration: BoxDecoration(
                  color: AppColors.wo,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const Text('المقتر لك',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w800)),
              ),
            Expanded(
              child: Text(name,
                  style: const TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w900)),
            ),
          ]),
          if (desc.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(desc,
                style: const TextStyle(
                    color: AppColors.muted, fontSize: 12, height: 1.5)),
          ],
          if (score != null || quality != null) ...[
            const SizedBox(height: 10),
            _qualityChip(score, quality),
            _qualityBreakdown(quality),
          ],
        ],
      ),
    );
  }

  Widget _dayCard(Map<String, dynamic> day, int index) {
    final exercises = (day['exercises'] as List?) ?? [];
    final muscles = <String>{};
    var totalSets = 0;
    var estimatedSeconds = 0;
    for (final raw in exercises.whereType<Map>()) {
      final muscle = (raw['mu'] ?? raw['muscle'] ?? '').toString().trim();
      if (muscle.isNotEmpty) muscles.add(muscle);
      final sets = raw['sets'] is num
          ? (raw['sets'] as num).toInt()
          : int.tryParse('${raw['sets']}') ?? 3;
      final restText = '${raw['restSec'] ?? raw['rest'] ?? ''}';
      final restMatch = RegExp(r'\d+').firstMatch(restText);
      var rest = restMatch == null ? 90 : int.tryParse(restMatch.group(0)!) ?? 90;
      if ((restText.contains('دقيقة') || restText.toLowerCase().contains('min')) && rest < 10) {
        rest *= 60;
      }
      totalSets += sets;
      estimatedSeconds += sets * (rest + 35);
    }
    final estimatedMinutes = (estimatedSeconds / 60).round().clamp(15, 120);
    final rawName = day['name']?.toString() ?? 'يوم تمرين';
    final shortName = rawName.split(RegExp(r'\s*[—|-]\s*')).first.trim();
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line.withValues(alpha: .5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              color: AppColors.wo.withValues(alpha: .10),
            ),
            child: Row(children: [
              Container(
                width: 30,
                height: 30,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [AppColors.wo, AppColors.wo2]),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Text('$index',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(shortName.isEmpty ? 'يوم تمرين' : shortName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
              ),
            ]),
          ),
          if (muscles.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 3),
              child: Wrap(
                spacing: 7,
                runSpacing: 7,
                children: muscles.take(4).map((m) => _pill(m, AppColors.wo2)).toList(),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 13, 14, 8),
            child: Row(children: [
              Expanded(child: _dayStat(Icons.fitness_center, '${exercises.length}', 'تمارين')),
              Expanded(child: _dayStat(Icons.layers_outlined, '$totalSets', 'مجموعة')),
              Expanded(child: _dayStat(Icons.schedule_rounded, '$estimatedMinutes', 'دقيقة تقريبا')),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                onPressed: exercises.isEmpty
                    ? null
                    : () => Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => TrainingSessionScreen(day: day),
                        )),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.wo,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.play_arrow_rounded, color: Colors.white),
                label: const Text('ابدأ جلسة التمرين',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _dayStat(IconData icon, String value, String label) => Column(
        children: [
          Icon(icon, color: AppColors.wo2, size: 18),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w900)),
          Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 10)),
        ],
      );

  Widget _pill(String t, Color c) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: c.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(7),
      ),
      child: Text(t,
          style: TextStyle(
              color: c, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }

  Widget _restCard() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.card.withValues(alpha: .4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line.withValues(alpha: .35)),
      ),
      child: const Row(children: [
        Icon(Icons.bedtime_outlined, color: AppColors.muted, size: 18),
        SizedBox(width: 10),
        Text('يوم راحة وتعافي',
            style: TextStyle(
                color: AppColors.muted, fontWeight: FontWeight.w700)),
      ]),
    );
  }

  Widget _lockedCard(int remainingDays, int plansTotal) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(colors: [
          AppColors.wo.withValues(alpha: .12),
          AppColors.card,
        ]),
        border: Border.all(color: AppColors.wo.withValues(alpha: .3)),
      ),
      child: Column(
        children: [
          const Icon(Icons.lock_outline, color: AppColors.wo2, size: 34),
          const SizedBox(height: 12),
          Text('باقي $remainingDays أيام تدريب + $plansTotal جداول بديلة',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontWeight: FontWeight.w900, fontSize: 15)),
          const SizedBox(height: 8),
          const Text(
            'اشترك عشان تفتح الجدول الأسبوعي كامل بكل التمارين والجداول البديلة وخريطة تغطية العضلات',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted, fontSize: 12.5, height: 1.6),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _showSubscribe,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.wo,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('اشترك الآن',
                  style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 15)),
            ),
          ),
        ],
      ),
    );
  }

  void _showSubscribe() {
    // [BUG-FIX] لو المستخدم فعّل الاشتراك أو التجربة، أعد التحميل عشان
    // الـ locked=false يتعكس فوراً بدون ما المستخدم يضغط "حاول تاني"
    Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const PricingScreen()))
        .then((activated) {
      if (activated == true && mounted) {
        setState(() => _result = null);
        _boot();
      }
    });
  }
}
