
// ── ElForma · screens/auth_screen.dart ──
// شاشات تسجيل الدخول / إنشاء الحساب — بالتصميم الجديد:
//  • دخول بحقل واحد (بريد أو رقم هاتف) + كلمة مرور.
//  • إنشاء حساب: الاسم + البريد + رقم الهاتف (مع كود الدولة) +
//    كلمة المرور + تأكيدها.
//  • دخول مباشر بحساب Google.
// الرقم بيتاخد في التسجيل، فالباقة المجانية بتتفعل مباشرة،
// وتأكيد الرقم في بيانات الحساب زي ما هو.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../api.dart';
import '../theme.dart';
import '../country_codes.dart';
import 'shell_screen.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _login = true;
  bool _busy = false;
  bool _hide = true;
  bool _hide2 = true;
  String _countryIso = 'EG';
  String? _error;
  final _ident = TextEditingController(); // الدخول: بريد أو رقم
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _name = TextEditingController();
  final _pass = TextEditingController();
  final _pass2 = TextEditingController();

  Country get _country =>
      kCountries.firstWhere((e) => e.iso == _countryIso, orElse: () => kCountries.first);

  @override
  void initState() {
    super.initState();
    _loadGeo();
  }

  Future<void> _loadGeo() async {
    try {
      final r = await Api.I.plans();
      if (!mounted || !r.ok) return;
      final geo = (r.data['geo'] as Map?)?.cast<String, dynamic>() ?? {};
      final iso = (geo['country']?.toString().toUpperCase() ?? '');
      if (iso.isNotEmpty && kCountries.any((c) => c.iso == iso)) {
        setState(() => _countryIso = iso);
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _ident.dispose();
    _email.dispose();
    _phone.dispose();
    _name.dispose();
    _pass.dispose();
    _pass2.dispose();
    super.dispose();
  }

  Future<void> _forgotPassword() async {
    final ctrl = TextEditingController(text: _ident.text.trim());
    final email = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('استعادة كلمة المرور', style: TextStyle(fontWeight: FontWeight.w900)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('اكتب بريد حسابك وهنبعتلك رابط لتعيين كلمة مرور جديدة',
                style: TextStyle(color: AppColors.muted, height: 1.5)),
            const SizedBox(height: 14),
            TextField(
              controller: ctrl,
              autofocus: true,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(hintText: 'البريد الإلكتروني'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('إلغاء', style: TextStyle(color: AppColors.muted)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            child: const Text('ابعت الرابط', style: TextStyle(color: AppColors.nu, fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );
    if (email == null || email.isEmpty) return;
    setState(() => _busy = true);
    await Api.I.forgotPassword(email);
    if (!mounted) return;
    setState(() => _busy = false);
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('لو البريد مسجل عندنا هتوصلك رسالة فيها رابط تعيين كلمة مرور جديدة خلال دقايق')));
  }

  // قاعدة أمان كلمة المرور (متوافقة مع السيرفر: 10 أحرف + حروف + أرقام).
  String? _passwordProblem(String pw) {
    if (pw.length < 10) return 'كلمة المرور لازم تكون 10 أحرف على الأقل';
    if (!RegExp(r'[A-Z]').hasMatch(pw)) return 'لازم تحتوي على حرف كبير واحد على الأقل';
    if (!RegExp(r'[0-9]').hasMatch(pw)) return 'لازم تحتوي على رقم واحد على الأقل';
    return null;
  }

  Future<void> _submit() async {
    if (_login) {
      final identifier = _ident.text.trim();
      if (identifier.isEmpty) {
        setState(() => _error = 'اكتب البريد أو رقم الهاتف');
        return;
      }
      if (_pass.text.isEmpty) {
        setState(() => _error = 'اكتب كلمة المرور');
        return;
      }
      setState(() { _busy = true; _error = null; });
      final res = await Api.I.login(identifier, _pass.text);
      _afterAuth(res);
      return;
    }

    // إنشاء حساب
    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'الاسم مطلوب');
      return;
    }
    final email = _email.text.trim().toLowerCase();
    if (email.isEmpty || !email.contains('@') || !email.contains('.')) {
      setState(() => _error = 'اكتب بريد إلكتروني صحيح');
      return;
    }
    // [OWNER-RULE] رقم الهاتف اختياري تمامًا — الحساب والتجربة المجانية
    // مش محتاجين رقم هاتف. لو اتكتب رقم بنتحقق من طوله بس، ولو فاضي عادي.
    final digits = _phone.text.replaceAll(RegExp(r'[^0-9]'), '');
    final c = _country;
    if (digits.isNotEmpty && (digits.length < c.minLen || digits.length > c.maxLen)) {
      setState(() => _error = 'رقم ${c.name} لازم يكون ${c.hint}');
      return;
    }
    final pwProblem = _passwordProblem(_pass.text);
    if (pwProblem != null) {
      setState(() => _error = pwProblem);
      return;
    }
    if (_pass.text != _pass2.text) {
      setState(() => _error = 'تأكيد كلمة المرور مش مطابق');
      return;
    }

    setState(() { _busy = true; _error = null; });
    final body = <String, dynamic>{
      'name': _name.text.trim(),
      'email': email,
      if (digits.isNotEmpty) 'phone': '+${c.dial}$digits',
      'password': _pass.text,
    };
    final res = await Api.I.signup(body);
    _afterAuth(res);
  }

  void _afterAuth(ApiResult res) {
    if (!mounted) return;
    setState(() => _busy = false);
    if (res.ok && res.data['user'] != null) {
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const ShellScreen()));
    } else {
      setState(() => _error = res.error.isNotEmpty ? res.error : 'حصل خطأ حاول تاني');
    }
  }

  // دخول/تسجيل بحساب Google. بياخد idToken من جوجل ويبعته للسيرفر.
  // الربط الأصلي (OAuth Client ID) بيتعمل في إعدادات المنصة لاحقا.
  Future<void> _google() async {
    setState(() { _busy = true; _error = null; });
    try {
      final gsi = GoogleSignIn(scopes: const ['email', 'profile']);
      try { await gsi.signOut(); } catch (_) {}
      final acc = await gsi.signIn();
      if (acc == null) {
        if (mounted) setState(() => _busy = false);
        return; // المستخدم لغى
      }
      final authd = await acc.authentication;
      final idToken = authd.idToken;
      if (idToken == null || idToken.isEmpty) {
        if (mounted) setState(() { _busy = false; _error = 'تعذر الدخول بجوجل، جرب تاني'; });
        return;
      }
      final res = await Api.I.googleAuth(idToken, name: acc.displayName, email: acc.email);
      _afterAuth(res);
    } catch (e) {
      if (mounted) setState(() { _busy = false; _error = 'تعذر الدخول بجوجل — تأكد من إعداد جوجل لاحقا'; });
    }
  }

  void _switchMode(bool login) {
    if (_login == login) return;
    setState(() {
      _login = login;
      _error = null;
    });
  }

  void _pickCountry() {
    final search = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card2,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (ctx) {
        return StatefulBuilder(builder: (ctx, setSheet) {
          final q = search.text.trim().toLowerCase();
          final list = q.isEmpty
              ? kCountries
              : kCountries.where((c) => c.name.toLowerCase().contains(q) || c.iso.toLowerCase().contains(q) || c.dial.contains(q)).toList();
          return Padding(
            padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
            child: SizedBox(
              height: MediaQuery.of(ctx).size.height * .72,
              child: Column(children: [
                const SizedBox(height: 12),
                Container(width: 42, height: 4, decoration: BoxDecoration(color: AppColors.line, borderRadius: BorderRadius.circular(4))),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: TextField(
                    controller: search,
                    autofocus: true,
                    onChanged: (_) => setSheet(() {}),
                    decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'ابحث عن الدولة أو الكود'),
                  ),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: ListView.builder(
                    itemCount: list.length,
                    itemBuilder: (_, i) {
                      final c = list[i];
                      return ListTile(
                        leading: Text(c.flag, style: const TextStyle(fontSize: 22)),
                        title: Text(c.name, style: const TextStyle(color: AppColors.text, fontWeight: FontWeight.w700)),
                        trailing: Text('+${c.dial}', style: TextStyle(color: c.iso == _countryIso ? AppColors.nu : AppColors.muted, fontWeight: FontWeight.w900)),
                        onTap: () {
                          setState(() => _countryIso = c.iso);
                          Navigator.of(ctx).pop();
                        },
                      );
                    },
                  ),
                ),
              ]),
            ),
          );
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // [FIX] شاشة ثابتة (Static) — الكيبورد مايزحّقش المحتوى ومفيش أي Scrolling.
      resizeToAvoidBottomInset: true,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.bg2, AppColors.bg],
          ),
        ),
        child: SafeArea(
          child: LayoutBuilder(
            // [FIX] مفيش SingleChildScrollView خالص — المحتوى ثابت وبيتحجّم
            // تل��ائيًا بـ FittedBox(scaleDown) عشان يناسب أي مقاس شاشة بدون سكرول.
            // [FIX] بدل FittedBox(scaleDown) اللي كان بيصغّر الفورم على الشاشات
            // الصغيرة ويسيب فراغ كبير حواليه: دلوقتي الفورم بحجمه الطبيعي
            // ومتوسّط لو فيه مساحة، وبيعمل Scroll لو الشاشة قصيرة أو الكيبورد طالع.
            builder: (context, constraints) => SingleChildScrollView(
              child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: Center(
              child: Padding(
              // [FIX] شاشة إنشاء الحساب أطول (اسم/بريد/هاتف/باسورد/تأكيد)،
              // فبنبدأها من فوق ��دل ما نوسّطها — ده بيمنع الفراغ الكبير فوق
              // والسكرول غير المنطقي. شاشة الدخول أقصر فتفضل متوسّطة.
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Column(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // زرار رجوع في شاشة إنشاء الحساب (زي السكرين شوت).
                      SizedBox(
                        height: 32,
                        child: _login
                            ? const SizedBox.shrink()
                            : Align(
                                alignment: AlignmentDirectional.centerStart,
                                child: IconButton(
                                  onPressed: _busy ? null : () => _switchMode(true),
                                  icon: const Icon(Icons.arrow_back_rounded, color: AppColors.text),
                                ),
                              ),
                      ),
                      const SizedBox(height: 4),
                      Text(_login ? 'تسجيل الدخول' : 'إنشاء حساب',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: AppColors.text, height: 1.2)),
                      const SizedBox(height: 10),
                      Text(
                          _login
                              ? 'مرحبا بك من جديد، سجل دخولك لمتابعة رحلتك'
                              : 'ابدأ رحلتك نحو أفضل نسخة منك',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.muted, fontSize: 14, height: 1.5)),
                      SizedBox(height: _login ? 24 : 16),

                      if (_login) ..._loginFields() else ..._signupFields(),

                      if (_error != null) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0x22FF6B35),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.wo.withValues(alpha: .35)),
                          ),
                          child: Row(children: [
                            const Icon(Icons.error_outline_rounded, color: AppColors.wo2, size: 20),
                            const SizedBox(width: 10),
                            Expanded(child: Text(_error!, style: const TextStyle(color: AppColors.wo2))),
                          ]),
                        ),
                      ],

                      SizedBox(height: _login ? 22 : 16),
                      _cta(),
                      SizedBox(height: _login ? 18 : 12),
                      _orDivider(),
                      SizedBox(height: _login ? 18 : 12),
                      _googleButton(_login ? 'تسجيل الدخول باستخدام Google' : 'إنشاء حساب باستخدام Google'),
                      SizedBox(height: _login ? 24 : 14),
                      Center(
                        child: Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(_login ? 'ليس لديك حساب؟ ' : 'لديك حساب بالفعل؟ ',
                                style: const TextStyle(color: AppColors.muted, fontWeight: FontWeight.w600)),
                            GestureDetector(
                              onTap: _busy ? null : () => _switchMode(!_login),
                              child: Text(_login ? 'تسجيل حساب' : 'تسجيل الدخول',
                                  style: const TextStyle(color: AppColors.nu2, fontWeight: FontWeight.w900)),
                            ),
                          ],
                        ),
                      ),
                    ],
                ),
              ),
              ),
              ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── حقول تسجيل الدخول ──
  List<Widget> _loginFields() {
    return [
      _field(
        controller: _ident,
        hint: 'البريد الإلكتروني أو رقم الهاتف',
        icon: Icons.person_outline_rounded,
        keyboardType: TextInputType.emailAddress,
        textInputAction: TextInputAction.next,
      ),
      const SizedBox(height: 14),
      _passwordField(_pass, 'كلمة المرور', _hide, () => setState(() => _hide = !_hide), onSubmitted: (_) => _submit()),
      const SizedBox(height: 8),
      Align(
        alignment: AlignmentDirectional.centerEnd,
        child: TextButton(
          onPressed: _busy ? null : _forgotPassword,
          style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 4)),
          child: const Text('نسيت كلمة المرور؟', style: TextStyle(color: AppColors.nu2, fontWeight: FontWeight.w700)),
        ),
      ),
    ];
  }

  // ── حقول إنشاء الحساب ──
  List<Widget> _signupFields() {
    final c = _country;
    return [
      _field(controller: _name, hint: 'الاسم الكامل', icon: Icons.person_outline_rounded, textInputAction: TextInputAction.next),
      const SizedBox(height: 14),
      _field(
        controller: _email,
        hint: 'البريد الإلكتروني',
        icon: Icons.alternate_email_rounded,
        keyboardType: TextInputType.emailAddress,
        textInputAction: TextInputAction.next,
      ),
      const SizedBox(height: 14),
      Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          InkWell(
            onTap: _pickCountry,
            borderRadius: BorderRadius.circular(14),
            child: Container(
              height: 56,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(color: AppColors.card2, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.line)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(c.flag, style: const TextStyle(fontSize: 18)),
                const SizedBox(width: 6),
                Text('+${c.dial}', style: const TextStyle(color: AppColors.nu, fontWeight: FontWeight.w900)),
                const Icon(Icons.arrow_drop_down_rounded, color: AppColors.muted),
              ]),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _field(
              controller: _phone,
              hint: 'رقم الهاتف (اختياري)',
              icon: Icons.phone_android_rounded,
              keyboardType: TextInputType.phone,
              formatters: [FilteringTextInputFormatter.digitsOnly],
              textInputAction: TextInputAction.next,
            ),
          ),
        ],
      ),
      const SizedBox(height: 14),
      _passwordField(_pass, 'كلمة المرور', _hide, () => setState(() => _hide = !_hide), textInputAction: TextInputAction.next),
      const SizedBox(height: 6),
      const Padding(
        padding: EdgeInsets.symmetric(horizontal: 4),
        child: Text('استخدم 10 أحرف على الأقل تتضمن حرف كبير ورقم',
            style: TextStyle(color: AppColors.muted, fontSize: 11.5)),
      ),
      const SizedBox(height: 14),
      _passwordField(_pass2, 'تأكيد كلمة المرور', _hide2, () => setState(() => _hide2 = !_hide2), onSubmitted: (_) => _submit()),
    ];
  }

  Widget _passwordField(TextEditingController controller, String hint, bool hidden, VoidCallback onToggle,
      {TextInputAction? textInputAction, ValueChanged<String>? onSubmitted}) {
    return _field(
      controller: controller,
      hint: hint,
      icon: Icons.lock_outline_rounded,
      obscure: hidden,
      textInputAction: textInputAction ?? TextInputAction.done,
      onSubmitted: onSubmitted,
      suffix: IconButton(
        tooltip: hidden ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور',
        icon: Icon(hidden ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: AppColors.muted),
        onPressed: onToggle,
      ),
    );
  }

  Widget _orDivider() {
    return Row(children: const [
      Expanded(child: Divider(color: AppColors.line, thickness: 1)),
      Padding(
        padding: EdgeInsets.symmetric(horizontal: 14),
        child: Text('أو', style: TextStyle(color: AppColors.muted, fontWeight: FontWeight.w700)),
      ),
      Expanded(child: Divider(color: AppColors.line, thickness: 1)),
    ]);
  }

  Widget _googleButton(String label) {
    return SizedBox(
      height: 54,
      child: OutlinedButton(
        onPressed: _busy ? null : _google,
        style: OutlinedButton.styleFrom(
          backgroundColor: AppColors.card,
          side: const BorderSide(color: AppColors.line),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          _googleMark(),
          const SizedBox(width: 11),
          Text(label, style: const TextStyle(color: AppColors.text, fontWeight: FontWeight.w800, fontSize: 14.5)),
        ]),
      ),
    );
  }

  Widget _googleMark() {
    // شعار Google: لو فيه assets/google.png بيتعرض، غير كده حرف G ملوّن.
    return Image.asset(
      'assets/google.png',
      width: 22,
      height: 22,
      errorBuilder: (_, __, ___) => Container(
        width: 22,
        height: 22,
        alignment: Alignment.center,
        decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
        child: const Text('G', style: TextStyle(color: Color(0xFF4285F4), fontWeight: FontWeight.w900, fontSize: 15)),
      ),
    );
  }

  Widget _field({
    Key? key,
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool obscure = false,
    Widget? suffix,
    TextInputType? keyboardType,
    TextInputAction? textInputAction,
    List<TextInputFormatter>? formatters,
    ValueChanged<String>? onSubmitted,
  }) {
    return TextField(
      key: key,
      controller: controller,
      obscureText: obscure,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      inputFormatters: formatters,
      onSubmitted: onSubmitted,
      decoration: InputDecoration(
        hintText: hint,
        prefixIcon: Icon(icon, color: AppColors.muted),
        suffixIcon: suffix,
      ),
    );
  }

  Widget _cta() {
    return SizedBox(
      height: 56,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: const LinearGradient(colors: [AppColors.nu, AppColors.nu2]),
          boxShadow: [BoxShadow(color: AppColors.nu.withValues(alpha: .35), blurRadius: 22, offset: const Offset(0, 10))],
        ),
        child: FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: Colors.transparent,
            shadowColor: Colors.transparent,
            foregroundColor: const Color(0xFF04231B),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          onPressed: _busy ? null : _submit,
          child: _busy
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Color(0xFF04231B)))
              : Text(_login ? 'تسجيل الدخول' : 'إنشاء حساب', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
        ),
      ),
    );
  }
}
