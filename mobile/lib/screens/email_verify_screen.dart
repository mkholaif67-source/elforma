// mobile/lib/screens/email_verify_screen.dart
import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

class EmailVerifyScreen extends StatefulWidget {
  const EmailVerifyScreen({super.key});
  @override
  State<EmailVerifyScreen> createState() => _EmailVerifyScreenState();
}

class _EmailVerifyScreenState extends State<EmailVerifyScreen> {
  bool _busy = false, _sent = false;
  String? _error;

  Future<void> _resend() async {
    setState(() { _busy = true; _error = null; });
    final res = await Api.I.sendEmailVerify();
    if (!mounted) return;
    setState(() { _busy = false; _sent = res.ok; if (!res.ok) _error = res.error; });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg2,
        title: const Text('تأكيد البريد الإلكتروني', style: TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(Icons.mark_email_unread_outlined, size: 72, color: AppColors.nu),
            const SizedBox(height: 20),
            const Text(
              'بريدك الإلكتروني لسه مش متأكد',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
            Text(
              'هنبعتلك رسالة تأكيد على بريدك. افتح الرسالة واضغط على الرابط.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, height: 1.6),
            ),
            if (_sent) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.nu.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.nu.withOpacity(0.3)),
                ),
                child: Text(
                  'تم إرسال رسالة التأكيد. تفقد بريدك.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.nu),
                ),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.redAccent), textAlign: TextAlign.center),
            ],
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _busy ? null : _resend,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.nu,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _busy
                ? const CircularProgressIndicator(color: Colors.white)
                : const Text('إرسال رسالة التأكيد', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('رجوع', style: TextStyle(color: AppColors.muted)),
            ),
          ],
        ),
      ),
    );
  }
}
