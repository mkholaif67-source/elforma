// ── ElForma · screens/account_screen.dart ──
// Account tab: calm profile-edit entry, data export & delete (GDPR-style), logout.
// تبويب الحساب: تعديل البيانات، تصدير/حذف البيانات، تسجيل الخروج.

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../api.dart';

import '../widgets/gender_avatar.dart';
import '../models/profile_store.dart';
import '../theme.dart';
import '../widgets/error_view.dart';
import '../widgets/announcement_card.dart';
import 'auth_screen.dart';
import 'edit_account_screen.dart';
import 'pricing_screen.dart';
import 'profile_setup_screen.dart';
import 'profile_overview_screen.dart';
import 'progress_screen.dart';
import 'workout_history_screen.dart';
import 'reminder_settings_screen.dart';
import 'faq_screen.dart';
import 'support_screen.dart';
import '../models/smart_coach_store.dart';
import '../widgets/social_bar.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});
  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  Map<String, dynamic>? _user;
  Map<String, dynamic>? _sub;
  Map<String, dynamic>? _profile;
  List<Map<String, dynamic>> _announcements = const [];
  bool _loading = true;

  // A failed load used to leave this screen blank forever. Now it explains
  // itself and offers a retry.
  String? _error;
  bool _offline = false;

  // [FIX-2] مزامنة فورية لحالة الاشتراك بدون Refresh يدوي
  void _onSubOrPlanChanged() { if (mounted) _load(); }

  @override
  void initState() {
    super.initState();
    SubscriptionStore.I.addListener(_onSubOrPlanChanged);
    PlanStore.I.addListener(_onSubOrPlanChanged);
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    )..repeat(reverse: true);
    _load();
  }

  @override
  void dispose() {
    SubscriptionStore.I.removeListener(_onSubOrPlanChanged);
    PlanStore.I.removeListener(_onSubOrPlanChanged);
    _pulse.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (!_loading) setState(() { _loading = true; _error = null; });
    final results = await Future.wait([Api.I.me(), Api.I.mobileBootstrap()]);
    final res = results[0];
    final bootstrap = results[1];
    if (!mounted) return;

    // me() is the one that decides: without it there is no account to show.
    // A failing bootstrap only costs the profile block, so it is not fatal.
    if (!res.ok) {
      setState(() {
        _loading = false;
        _offline = efIsOffline(res.status);
        _error = efErrorMessage(res.status, res.data);
      });
      return;
    }

    setState(() {
      _error = null;
      _user = res.data['user'] is Map
          ? Map<String, dynamic>.from(res.data['user'])
          : null;
      _sub = res.data['subscription'] is Map
          ? Map<String, dynamic>.from(res.data['subscription'])
          : null;
      _profile = bootstrap.data['profile'] is Map
          ? Map<String, dynamic>.from(bootstrap.data['profile'])
          : null;
      _announcements = (bootstrap.data['announcements'] is List ? (bootstrap.data['announcements'] as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : <Map<String, dynamic>>[]);
      _loading = false;
    });
    // [OWNER-RULE] مزامنة حالة المتابعة الذكية من السيرفر (bootstrap.smartCoach)
    // عشان الزر يعكس الحالة الفعلية المخزنة.
    if (bootstrap.data.containsKey('smartCoach')) {
      await SmartCoachStore.I.syncFromServer(bootstrap.data['smartCoach'] == true);
      if (mounted) setState(() {});
    }
  }

  /// Security: revokes the session on every other phone/browser while keeping
  /// this device signed in. Useful after losing a phone or sharing a password.
  Future<void> _logoutAllDevices() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('خروج من كل الأجهزة',
            style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text(
            'هيتم قفل الجلسات على أي جهاز تاني داخل بحسابك وهتفضل داخل على الجهاز دا',
            style: TextStyle(color: AppColors.muted, height: 1.5)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('إلغاء',
                  style: TextStyle(color: AppColors.muted))),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('تمام اقفلهم',
                  style: TextStyle(
                      color: AppColors.wo2, fontWeight: FontWeight.w900))),
        ],
      ),
    );
    if (ok != true) return;
    final res = await Api.I.logoutAllDevices();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(res.ok
            ? 'تم تسجيل الخروج من كل الأجهزة التانية'
            : 'معلش ما قدرناش نقفل الجلسات دلوقتي حاول تاني')));
  }

  Future<void> _logout() async {
    await Api.I.logout();
    // Wipe the cached profile, otherwise the next account to sign in on this
    // device would open onto the previous user's plan.
    await ProfileStore.I.clear();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const AuthScreen()),
      (route) => false,
    );
  }

  /// يفتح صفحة تعديل بيانات الحساب (بيانات + كلمة مرور) ويعيد التحميل لو اتغير حاجة.
  Future<void> _openEditAccount() async {
    final changed = await Navigator.of(context).push<bool>(MaterialPageRoute(
      builder: (_) => EditAccountScreen(user: _user ?? const {}),
    ));
    if (changed == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final pro = _sub != null && _sub!['active'] == true;
    final trialing =
        _sub != null && _sub!['status'] == 'trialing' && pro;
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        title: const Text('حسابي', style: TextStyle(fontWeight: FontWeight.w900)),
        centerTitle: true,
      ),
      body: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorView(
              message: _error!,
              offline: _offline,
              onRetry: _load,
              compact: true,
            )
          : RefreshIndicator(
              color: const Color(0xFFD4AF37),
              backgroundColor: const Color(0xFF1E1E2C),
              onRefresh: _load,
              child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                _brandAvatar(),
                ..._announcementCards(),
                const SizedBox(height: 16),
                Center(
                  child: Text(
                    (_user?['name'] ?? 'مستخدم الفورمة').toString(),
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w900),
                  ),
                ),
                const SizedBox(height: 24),
                _row(Icons.workspace_premium_outlined, 'الاشتراك',
                    trialing ? 'تجربة مجانية' : (pro ? 'مشترك' : 'مجاني')),
                const SizedBox(height: 20),
                _actionTile(
                    Icons.manage_accounts_rounded,
                    'تعديل بيانات حسابك',
                    'البريد ورقم الهاتف وكلمة المرور',
                    _openEditAccount),
                _profileTile(),
                _navTile(
                    Icons.insights_rounded,
                    'الوزن وقياسات الجسم',
                    'سجل تقدمك وشاهد الاتجاهات',
                    const ProgressScreen()),
                _navTile(
                    Icons.query_stats_rounded,
                    'سجل وتحليلات التدريب',
                    'الجلسات والأحجام وأفضل أرقامك',
                    const WorkoutHistoryScreen()),
                _navTile(
                    Icons.notifications_active_outlined,
                    'التذكيرات والمزامنة',
                    'التمرين والوجبات والمياه والحفظ دون إنترنت',
                    const ReminderSettingsScreen()),
                _smartCoachTile(),
                _navTile(
                    Icons.help_outline_rounded,
                    'الأسئلة الشائعة',
                    'إجابات مقسمة عن التمرين والتغذية والالتزام',
                    const FaqScreen()),
                _navTile(
                    Icons.support_agent_rounded,
                    'الدعم والتواصل',
                    'كلمنا على واتساب أو الإيميل',
                    const SupportScreen()),
                if (trialing) _trialBanner(),
                if (!pro) _subscribeCta(),
                const SizedBox(height: 20),
                SizedBox(
                  height: 52,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.wo2,
                      side: const BorderSide(color: AppColors.wo),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: _logout,
                    icon: const Icon(Icons.logout),
                    label: const Text('تسجيل الخروج',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
                const SizedBox(height: 10),
                Center(
                  child: TextButton.icon(
                    onPressed: _logoutAllDevices,
                    icon: const Icon(Icons.devices_other_rounded,
                        size: 18, color: AppColors.muted),
                    label: const Text('تسجيل الخروج من كل الأجهزة التانية',
                        style: TextStyle(
                            color: AppColors.muted,
                            fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(height: 26),
                const SocialBar(),
                const SizedBox(height: 10),
              ],
            ),
          ),
    );
  }


  List<Widget> _announcementCards() {
    final list = _announcements;
    final rows = list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).where((a) {
      final p = (a['placement'] ?? 'both').toString();
      return p == 'both' || p == 'account';
    }).where((a) => (a['mode'] ?? 'card').toString() == 'card' || (a['mode'] ?? '').toString() == 'both').toList();
    if (rows.isEmpty) return const <Widget>[];
    return rows.map((a) => Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: AnnouncementCard(data: a),
    )).toList();
  }

  /// «المتابعة الذكية»: تفعيل/إيقاف بطاقات المدرب الذكي على التغذية والرياضة.
  /// مفعلة تلقائيا، والمستخدم يقدر يقفلها. الحالة بتتحفظ محليا.
  Widget _smartCoachTile() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.nu2.withValues(alpha: .28)),
      ),
      child: SwitchListTile(
        value: SmartCoachStore.I.enabled,
        activeColor: AppColors.nu,
        onChanged: (v) async {
          await SmartCoachStore.I.setEnabled(v);
          if (mounted) setState(() {});
        },
        secondary: const Icon(Icons.auto_awesome_rounded, color: AppColors.nu2),
        title: const Text('المتابعة الذكية',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
        subtitle: const Text(
          'النظام يتابع تقدمك ويطور جدول التمرين والتغذية تلقائيا. لو قفلتها الجداول تفضل زي ما هي وتعدلها بنفسك',
          style: TextStyle(color: AppColors.muted, fontSize: 12),
        ),
      ),
    );
  }

  /// Animated brand avatar: a slowly rotating gradient ring with a breathing
  /// glow around the ElForma mark — a lively, premium identity above the name
  /// instead of a flat generic person icon.
  Widget _brandAvatar() {
    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, _) {
        final t = Curves.easeInOut.transform(_pulse.value);
        final glow = 0.20 + t * 0.28;
        return Center(
          child: Container(
            width: 118,
            height: 118,
            padding: const EdgeInsets.all(15),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.card,
              border: Border.all(color: AppColors.nu.withValues(alpha: .45), width: 2),
              boxShadow: [
                BoxShadow(
                  color: AppColors.nu.withValues(alpha: glow),
                  blurRadius: 30,
                  spreadRadius: 1,
                ),
              ],
            ),
            // [OWNER-RULE] أفاتار للمستخدم حسب جنسه (ذكر/أنثى) بدل لوجو الفورما.
            child: ClipOval(
              child: SvgPicture.asset(
                genderAvatarAsset(_profile?['gender'] ?? _user?['gender']),
                fit: BoxFit.cover,
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _profileTile() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.nu.withValues(alpha: .28)),
      ),
      child: ListTile(
        onTap: () async {
          // Onboarded already → open the chic read-first overview (view, edit,
          // analyze, or delete). Not yet → go straight into the setup chat.
          final done = _profile?['onboardingComplete'] == true;
          final changed = await Navigator.of(context).push<bool>(MaterialPageRoute(
            builder: (_) => done
                ? ProfileOverviewScreen(initial: _profile ?? const {})
                : ProfileSetupScreen(initial: _profile),
          ));
          if (changed == true) _load();
        },
        leading: const Icon(Icons.tune_rounded, color: AppColors.nu),
        title: const Text('بيانات التدريب والتغذية',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
        subtitle: Text(
          _profile?['onboardingComplete'] == true ? 'بياناتك محفوظة اضغط للتعديل' : 'أكمل بياناتك لبناء خطة أدق',
          style: const TextStyle(color: AppColors.muted, fontSize: 12),
        ),
        trailing: const Icon(Icons.chevron_left, color: AppColors.muted),
      ),
    );
  }

  // عدد الأيام المتبقية في التجربة المجانية (من current_period_end).
  int _trialDaysLeft() {
    final end = _sub?['current_period_end']?.toString();
    if (end == null || end.isEmpty) return 0;
    final dt = DateTime.tryParse(end);
    if (dt == null) return 0;
    final hours = dt.difference(DateTime.now()).inHours;
    return hours <= 0 ? 0 : (hours / 24).ceil();
  }

  Widget _trialBanner() {
    final days = _trialDaysLeft();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(colors: [
          AppColors.nu.withValues(alpha: .18),
          AppColors.nu2.withValues(alpha: .06),
        ]),
        border: Border.all(color: AppColors.nu.withValues(alpha: .35)),
      ),
      child: Row(
        children: [
          const Icon(Icons.hourglass_bottom_rounded, color: AppColors.nu2),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('تجربتك المجانية شغالة',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
                const SizedBox(height: 4),
                Text(
                  days > 0
                      ? 'باقي $days ${days == 1 ? 'يوم' : 'أيام'} وكل المميزات مفتوحة'
                      : 'تجربتك بتخلص النهارده — اشترك عشان تكمل',
                  style: const TextStyle(
                      color: AppColors.muted, fontSize: 12.5, height: 1.5),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 44,
                  child: ElevatedButton(
                    onPressed: () async {
                      // [EGY-v71] بعد الرجوع من الباقات (خصوصا تفعيل التجربة اللي بيضيف الرقم)
                      // نعيد تحميل بيانات الحساب عشان الرقم يظهر فورا مش بعد إعادة الدخول.
                      final changed = await Navigator.of(context).push<bool>(
                          MaterialPageRoute(builder: (_) => const PricingScreen()));
                      if (changed == true && mounted) _load();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.nu,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('اشترك واحتفظ بالمميزات',
                        style: TextStyle(
                            color: Colors.white, fontWeight: FontWeight.w900)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _subscribeCta() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(colors: [
          AppColors.nu.withValues(alpha: .18),
          AppColors.wo.withValues(alpha: .10),
        ]),
        border: Border.all(color: AppColors.nu.withValues(alpha: .3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('افتح الفورمة بالكامل',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          const Text(
              'جداول تمرين وتغذية كاملة كل الخطط البديلة وتحديثات مستمرة',
              style: TextStyle(color: AppColors.muted, fontSize: 12.5, height: 1.5)),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () async {
                // [EGY-v71] نفس المنطق: refresh لبيانات الحساب بعد الاشتراك/التجربة.
                final changed = await Navigator.of(context).push<bool>(MaterialPageRoute(
                    builder: (_) => const PricingScreen()));
                if (changed == true && mounted) _load();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.nu,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('شوف الباقات واشترك',
                  style: TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w900)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _navTile(
      IconData icon, String title, String subtitle, Widget target) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: ListTile(
        onTap: () => Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => target)),
        leading: Icon(icon, color: AppColors.nu),
        title: Text(title,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
        subtitle: Text(subtitle,
            style: const TextStyle(color: AppColors.muted, fontSize: 12)),
        trailing: const Icon(Icons.chevron_left, color: AppColors.muted),
      ),
    );
  }

  Widget _actionTile(
      IconData icon, String title, String subtitle, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: ListTile(
        onTap: onTap,
        leading: Icon(icon, color: AppColors.nu),
        title: Text(title,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
        subtitle: Text(subtitle,
            style: const TextStyle(color: AppColors.muted, fontSize: 12)),
        trailing: const Icon(Icons.chevron_left, color: AppColors.muted),
      ),
    );
  }

  Widget _row(IconData icon, String label, String value) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.nu, size: 22),
          const SizedBox(width: 14),
          Text(label, style: const TextStyle(color: AppColors.muted)),
          const Spacer(),
          Flexible(
            child: Text(value,
                textAlign: TextAlign.left,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}
