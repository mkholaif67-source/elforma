// mobile/lib/screens/phone_otp_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../api.dart';
import '../theme.dart';

class PhoneOtpScreen extends StatefulWidget {
  final String phone;
  const PhoneOtpScreen({super.key, required this.phone});
  @override
  State<PhoneOtpScreen> createState() => _PhoneOtpScreenState();
}

class _PhoneOtpScreenState extends State<PhoneOtpScreen> {
  final _otp = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void initState() { super.initState(); _sendOtp(); }
  @override
  void dispose() { _otp.dispose(); super.dispose(); }

  Future<void> _sendOtp() async {
    setState(() { _busy = true; _error = null; });
    final res = await Api.I.sendPhoneOtp(widget.phone);
    if (!mounted) return;
    setState(() { _busy = false; if (!res.ok) _error = res.error; });
  }

  Future<void> _verify() async {
    final code = _otp.text.trim();
    if (code.length != 6) { setState(() => _error = 'الكود لازم يكون 6 أرقام'); return; }
    setState(() { _busy = true; _error = null; });
    final res = await Api.I.verifyPhoneOtp(widget.phone, code);
    if (!mounted) return;
    setState(() => _busy = false);
    if (res.ok) {
      Navigator.pop(context, true); // success
    } else {
      setState(() => _error = res.error.isNotEmpty ? res.error : 'كود غلط أو منتهي');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg2,
        title: const Text('تحقق من رقم الهاتف', style: TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(Icons.phone_android_rounded, size: 64, color: AppColors.nu),
            const SizedBox(height: 20),
            Text(
              'كود التحقق اتبعت على ${widget.phone}',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _otp,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              maxLength: 6,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, letterSpacing: 8),
              decoration: const InputDecoration(
                hintText: '_ _ _ _ _ _',
                counterText: '',
              ),
              onSubmitted: (_) => _verify(),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.redAccent), textAlign: TextAlign.center),
            ],
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _busy ? null : _verify,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.nu,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _busy
                ? const CircularProgressIndicator(color: Colors.white)
                : const Text('تأكيد الكود', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: _busy ? null : _sendOtp,
              child: Text('إعادة إرسال الكود', style: TextStyle(color: AppColors.muted)),
            ),
          ],
        ),
      ),
    );
  }
}
