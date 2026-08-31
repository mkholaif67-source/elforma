// mobile/lib/screens/change_password_screen.dart
import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});
  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _new1    = TextEditingController();
  final _new2    = TextEditingController();
  bool _busy = false, _hideC = true, _hideN = true;
  String? _error, _success;

  @override
  void dispose() { _current.dispose(); _new1.dispose(); _new2.dispose(); super.dispose(); }

  Future<void> _submit() async {
    if (_new1.text.length < 10) {
      setState(() => _error = 'كلمة المرور الجديدة لازم تكون 10 أحرف على الأقل');
      return;
    }
    if (_new1.text != _new2.text) {
      setState(() => _error = 'كلمتا المرور مش متطابقتين');
      return;
    }
    setState(() { _busy = true; _error = null; _success = null; });
    final res = await Api.I.changePassword(_current.text, _new1.text);
    if (!mounted) return;
    setState(() => _busy = false);
    if (res.ok) {
      setState(() => _success = 'تم تغيير كلمة المرور بنجاح');
      Future.delayed(const Duration(seconds: 2), () { if (mounted) Navigator.pop(context); });
    } else {
      setState(() => _error = res.error.isNotEmpty ? res.error : 'حصل خطأ حاول تاني');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg2,
        title: const Text('تغيير كلمة المرور', style: TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _passField(_current, 'كلمة المرور الحالية', _hideC, () => setState(() => _hideC = !_hideC)),
            const SizedBox(height: 14),
            _passField(_new1, 'كلمة المرور الجديدة', _hideN, () => setState(() => _hideN = !_hideN)),
            const SizedBox(height: 14),
            TextField(
              controller: _new2,
              obscureText: _hideN,
              decoration: const InputDecoration(hintText: 'تأكيد كلمة المرور الجديدة'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.redAccent)),
            ],
            if (_success != null) ...[
              const SizedBox(height: 12),
              Text(_success!, style: TextStyle(color: AppColors.nu)),
            ],
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _busy ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.nu,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _busy
                ? const CircularProgressIndicator(color: Colors.white)
                : const Text('تغيير كلمة المرور', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _passField(TextEditingController c, String hint, bool hide, VoidCallback toggle) {
    return TextField(
      controller: c,
      obscureText: hide,
      decoration: InputDecoration(
        hintText: hint,
        suffixIcon: IconButton(
          icon: Icon(hide ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: AppColors.muted),
          onPressed: toggle,
        ),
      ),
    );
  }
}
