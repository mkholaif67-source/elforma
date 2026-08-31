// ── ElForma · screens/support_screen.dart ──
// الدعم والتواصل: واتساب + إيميل من إعدادات السيرفر (مع fallback لو أوفلاين).

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api.dart';
import '../theme.dart';

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});
  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  String _whatsapp = '';
  String _email = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final r = await Api.I.plans();
    if (!mounted) return;
    final support = (r.data['support'] as Map?)?.cast<String, dynamic>() ?? {};
    setState(() {
      _whatsapp = (support['whatsapp'] ?? '').toString().trim();
      _email = (support['email'] ?? '').toString().trim();
      _loading = false;
    });
  }

  Future<void> _open(Uri uri) async {
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('مقدرش أفتح الرابط، حاول تاني')));
    }
  }

  void _openWhatsApp() {
    final digits = _whatsapp.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return;
    _open(Uri.parse('https://wa.me/$digits'));
  }

  void _openEmail() {
    if (_email.isEmpty) return;
    _open(Uri(scheme: 'mailto', path: _email));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: const Text('الدعم والتواصل'),
        centerTitle: true,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.nu))
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
              children: [
                _hero(),
                const SizedBox(height: 22),
                if (_whatsapp.isNotEmpty)
                  _contactCard(
                    icon: Icons.chat_rounded,
                    color: const Color(0xFF25D366),
                    title: 'واتساب الدعم',
                    subtitle: 'رد سريع على استفساراتك وتأكيد التحويلات',
                    action: 'ابدأ محادثة',
                    onTap: _openWhatsApp,
                  ),
                if (_email.isNotEmpty)
                  _contactCard(
                    icon: Icons.alternate_email_rounded,
                    color: AppColors.nu,
                    title: 'إيميل الدعم',
                    subtitle: _email,
                    action: 'ابعت إيميل',
                    onTap: _openEmail,
                  ),
                if (_whatsapp.isEmpty && _email.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 30),
                    child: Text(
                      'بيانات الدعم مش متاحة دلوقتي. تأكد من اتصالك بالإنترنت وحاول تاني.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.muted, height: 1.6),
                    ),
                  ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.nu.withValues(alpha: .06),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.nu.withValues(alpha: .18)),
                  ),
                  child: const Text(
                    'وقت ما تراسلنا اذكر اسمك وتفاصيل الموضوع علشان نقدر نساعدك أسرع.',
                    style: TextStyle(color: AppColors.muted, fontSize: 12.5, height: 1.6),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _hero() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.nu.withValues(alpha: .22), AppColors.nu2.withValues(alpha: .10)],
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.nu.withValues(alpha: .28)),
      ),
      child: Row(children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: AppColors.nu.withValues(alpha: .18),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.support_agent_rounded, color: AppColors.nu2, size: 28),
        ),
        const SizedBox(width: 14),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('إحنا معاك',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
              SizedBox(height: 4),
              Text('فريق الدعم جاهز يرد على أي سؤال يخص حسابك أو اشتراكك',
                  style: TextStyle(color: AppColors.muted, fontSize: 12.5, height: 1.5)),
            ],
          ),
        ),
      ]),
    );
  }

  Widget _contactCard({
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
    required String action,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: .30)),
      ),
      child: Row(children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: color.withValues(alpha: .14),
            borderRadius: BorderRadius.circular(13),
          ),
          child: Icon(icon, color: color, size: 24),
        ),
        const SizedBox(width: 13),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5)),
              const SizedBox(height: 3),
              Text(subtitle,
                  style: const TextStyle(color: AppColors.muted, fontSize: 12, height: 1.45)),
            ],
          ),
        ),
        const SizedBox(width: 8),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: color.withValues(alpha: .16),
            foregroundColor: color,
            elevation: 0,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          ),
          onPressed: onTap,
          child: Text(action,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5)),
        ),
      ]),
    );
  }
}
