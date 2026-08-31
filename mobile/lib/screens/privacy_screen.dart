// ── ElForma · screens/privacy_screen.dart ──
// In-app privacy policy viewer (loads the same policy served at /privacy.html).
// عارض سياسة الخصوصية داخل التطبيق.

import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api.dart';
import '../theme.dart';
import 'auth_screen.dart';

class PrivacyScreen extends StatefulWidget {
  const PrivacyScreen({super.key});

  @override
  State<PrivacyScreen> createState() => _PrivacyScreenState();
}

class _PrivacyScreenState extends State<PrivacyScreen> {
  bool loading = true, exporting = false, deleting = false;
  bool crashReports = false, analytics = false;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final sp = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      crashReports = sp.getBool('privacy_crash_reports') ?? false;
      analytics = sp.getBool('privacy_analytics') ?? false;
      loading = false;
    });
  }

  Future<void> _toggle(String key, bool value) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setBool(key, value);
    if (!mounted) return;
    setState(() {
      if (key == 'privacy_crash_reports') crashReports = value;
      if (key == 'privacy_analytics') analytics = value;
    });
  }

  Future<void> _export() async {
    setState(() => exporting = true);
    final response = await Api.I.exportAccountData();
    if (!mounted) return;
    if (!response.ok) {
      setState(() => exporting = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(
          response.error.isNotEmpty ? response.error : 'تعذر تصدير البيانات')));
      return;
    }
    try {
      final directory = await getTemporaryDirectory();
      final file = File('${directory.path}/elforma-data-${DateTime.now().millisecondsSinceEpoch}.json');
      await file.writeAsString(const JsonEncoder.withIndent('  ').convert(response.data));
      await Share.shareXFiles([XFile(file.path)], text: 'نسخة من بيانات حسابك في تطبيق الفورمة');
    } finally {
      if (mounted) setState(() => exporting = false);
    }
  }

  Future<void> _delete() async {
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('حذف الحساب نهائيا'),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('سيتم حذف الحساب والخطط والجلسات والوجبات والقياسات. لا يمكن التراجع عن هذا الإجراء',
              style: TextStyle(color: AppColors.muted, height: 1.5)),
          const SizedBox(height: 14),
          TextField(controller: controller,
            decoration: const InputDecoration(labelText: 'اكتب كلمة حذف للتأكيد')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: AppColors.wo),
            onPressed: () => Navigator.pop(context, controller.text.trim() == 'حذف'),
            child: const Text('حذف نهائي')),
        ],
      ),
    );
    controller.dispose();
    if (confirmed != true || !mounted) return;
    setState(() => deleting = true);
    final response = await Api.I.deleteAccount();
    if (!mounted) return;
    if (response.ok) {
      Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const AuthScreen()), (_) => false);
    } else {
      setState(() => deleting = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(
          response.error.isNotEmpty ? response.error : 'تعذر حذف الحساب')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(backgroundColor: AppColors.bg,
        title: const Text('الخصوصية والبيانات', style: TextStyle(fontWeight: FontWeight.w900)), centerTitle: true),
      body: loading ? const Center(child: CircularProgressIndicator(color: AppColors.nu)) : ListView(
        padding: const EdgeInsets.all(18), children: [
          _section('بياناتك تحت سيطرتك',
              'نستخدم بيانات الملف الرياضي والصحي لبناء خططك ومتابعة تقدمك فقط. لا يتم بيع بياناتك الشخصية'),
          const SizedBox(height: 12),
          _switch(Icons.bug_report_outlined, 'تقارير الأعطال الاختيارية',
              'ترسل رسالة الخطأ الفنية وإصدار التطبيق بعد موافقتك بدون كلمات مرور أو محتوى وجباتك',
              crashReports, (value) => _toggle('privacy_crash_reports', value)),
          _switch(Icons.analytics_outlined, 'تحليلات الاستخدام الاختيارية',
              'محفوظة كموافقة مستقلة؛ لا يتم تفعيلها تلقائيا',
              analytics, (value) => _toggle('privacy_analytics', value)),
          const SizedBox(height: 10),
          _action(Icons.download_rounded, 'تنزيل نسخة من بياناتي',
              'حسابك خططك جلساتك تغذيتك وقياساتك في ملف JSON', AppColors.nu,
              exporting ? null : _export, exporting),
          const SizedBox(height: 22),
          const Text('منطقة خطرة', style: TextStyle(color: AppColors.wo2, fontSize: 16, fontWeight: FontWeight.w900)),
          const SizedBox(height: 9),
          _action(Icons.delete_forever_outlined, 'حذف الحساب والبيانات',
              'حذف نهائي لكل بياناتك المرتبطة بالحساب', AppColors.wo2,
              deleting ? null : _delete, deleting),
          const SizedBox(height: 18),
          const Text('التخزين الضروري لتسجيل الدخول والمزامنة يعمل لتقديم الخدمة ولا يستخدم للإعلانات',
              style: TextStyle(color: AppColors.muted, fontSize: 10.5, height: 1.5)),
        ],
      ),
    );
  }

  Widget _section(String title, String body) => Container(
        padding: const EdgeInsets.all(17),
        decoration: BoxDecoration(gradient: LinearGradient(colors: [AppColors.nu.withValues(alpha: .15), AppColors.nu.withValues(alpha: .04)]),
            borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.nu.withValues(alpha: .25))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [const Icon(Icons.verified_user_outlined, color: AppColors.nu), const SizedBox(width: 8),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16))]),
          const SizedBox(height: 8),
          Text(body, style: const TextStyle(color: AppColors.muted, height: 1.55, fontSize: 12)),
        ]),
      );

  Widget _switch(IconData icon, String title, String subtitle, bool value, ValueChanged<bool> changed) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(15), border: Border.all(color: AppColors.line)),
        child: SwitchListTile(value: value, activeColor: AppColors.nu, onChanged: changed,
          secondary: Icon(icon, color: AppColors.nu), title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
          subtitle: Text(subtitle, style: const TextStyle(color: AppColors.muted, fontSize: 10.5, height: 1.4))),
      );

  Widget _action(IconData icon, String title, String subtitle, Color color, VoidCallback? action, bool busy) => Container(
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(15), border: Border.all(color: color.withValues(alpha: .35))),
        child: ListTile(onTap: action, leading: Icon(icon, color: color),
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
          subtitle: Text(subtitle, style: const TextStyle(color: AppColors.muted, fontSize: 10.5)),
          trailing: busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.chevron_left_rounded, color: AppColors.muted)),
      );
}
