// ── ElForma · screens/edit_account_screen.dart ──
// [OWNER-RULE] شاشة بيانات الحساب — كل بيان في صف مستقل + زر تعديل/تأكيد inline.
// التعديل يفتح bottom sheet لهذا البيان فقط — لا خانات مفتوحة من البداية.

import 'package:flutter/material.dart';
import '../api.dart';
import '../country_codes.dart';
import 'change_password_screen.dart';
import 'email_verify_screen.dart';
import 'phone_otp_screen.dart';
import '../theme.dart';

class EditAccountScreen extends StatefulWidget {
  final Map<String, dynamic> user;
  const EditAccountScreen({super.key, required this.user});
  @override
  State<EditAccountScreen> createState() => _EditAccountScreenState();
}

class _EditAccountScreenState extends State<EditAccountScreen> {
  bool _changed = false;
  late Map<String, dynamic> _user;

  @override
  void initState() {
    super.initState();
    _user = Map<String, dynamic>.from(widget.user);
  }

  String get _name  => (_user['name']  ?? '').toString();
  String get _email => (_user['email'] ?? '').toString();
  String get _phone => (_user['phone'] ?? '').toString();
  bool get _emailVerified => _user['emailVerified'] == true;
  bool get _phoneVerified => _user['phoneVerified'] == true;

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(msg)));
  }

  // ─────────────────────────── تعديل الاسم ───────────────────────────
  Future<void> _editName() async {
    final ctrl = TextEditingController(text: _name);
    final result = await _sheet(
      context: context,
      title: 'تعديل الاسم',
      ctrl: ctrl,
      hint: 'الاسم الكامل',
      type: TextInputType.name,
    );
    if (result == null || result.trim().isEmpty || result.trim() == _name) return;
    final res = await Api.I.updateProfile(
        name: result.trim(), email: _email, phone: _phone);
    if (!mounted) return;
    if (res.ok) {
      setState(() { _user['name'] = result.trim(); _changed = true; });
      _toast('تم تعديل الاسم');
    } else {
      _toast(res.friendlyError('ما قدرناش نحفظ التعديل'));
    }
  }

  // ─────────────────────────── تعديل البريد ──────────────────────────
  Future<void> _editEmail() async {
    final ctrl = TextEditingController(text: _email);
    final result = await _sheet(
      context: context,
      title: 'تعديل البريد الإلكتروني',
      ctrl: ctrl,
      hint: 'example@mail.com',
      type: TextInputType.emailAddress,
    );
    if (result == null || result.trim().isEmpty || result.trim() == _email) return;
    final res = await Api.I.updateProfile(
        name: _name, email: result.trim(), phone: _phone);
    if (!mounted) return;
    if (res.ok) {
      setState(() {
        _user['email'] = result.trim();
        _user['emailVerified'] = false;
        _changed = true;
      });
      _toast('تم تعديل البريد — اتحقق منه عشان يتفعل');
    } else {
      _toast(res.friendlyError('ما قدرناش نحفظ التعديل'));
    }
  }

  // ─────────────────────────── تعديل الهاتف ──────────────────────────
  // [FIX] إدخال الرقم بنفس شكل باقي التطبيق: كود الدولة جنب الرقم
  // مع تحديد الدولة تلقائيًا من الـ IP وإتاحة تغييرها يدويًا، بدون نصوص زائدة.
  Future<void> _editPhone() async {
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (ctx) => _PhoneEditSheet(initial: _phone),
    );
    if (result == null || result.trim().isEmpty || result.trim() == _phone) return;
    final res = await Api.I.updateProfile(
        name: _name, email: _email, phone: result.trim());
    if (!mounted) return;
    if (res.ok) {
      setState(() {
        _user['phone'] = result.trim();
        _user['phoneVerified'] = false;
        _changed = true;
      });
      _toast('تم تعديل الرقم — اتحقق منه عشان يتفعل');
    } else {
      _toast(res.friendlyError('ما قدرناش نحفظ التعديل'));
    }
  }

  // ─────────────────────────── Bottom sheet ──────────────────────────
  Future<String?> _sheet({
    required BuildContext context,
    required String title,
    required TextEditingController ctrl,
    required String hint,
    required TextInputType type,
    String? note,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (ctx) => _FieldSheet(
        title: title,
        ctrl: ctrl,
        hint: hint,
        type: type,
        note: note,
      ),
    );
  }

  // ─────────────────────────── Build ─────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final hasPhone = _phone.isNotEmpty;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        Navigator.of(context).pop(_changed);
      },
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: const Text('بيانات الحساب',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
          centerTitle: true,
          leading: IconButton(
            icon: const Icon(Icons.arrow_forward_rounded),
            onPressed: () => Navigator.of(context).pop(_changed),
          ),
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            // ─── Header ───
            const SizedBox(height: 6),
            Row(
              children: const [
                Icon(Icons.manage_accounts_rounded,
                    color: AppColors.nu, size: 22),
                SizedBox(width: 9),
                Text('بياناتك الأساسية',
                    style: TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 16)),
              ],
            ),
            const SizedBox(height: 4),
            const Text('اضغط تعديل أو تأكيد جنب أي بيان',
                style: TextStyle(color: AppColors.muted, fontSize: 12.5)),
            const SizedBox(height: 16),

            // ─── Card ───
            Container(
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                children: [

                  // الاسم
                  _row(
                    icon: Icons.person_outline_rounded,
                    label: 'الاسم',
                    value: _name.isEmpty ? 'غير مضاف' : _name,
                    emptyValue: _name.isEmpty,
                    action: _DataAction.edit,
                    onAction: _editName,
                  ),

                  _sep(),

                  // البريد
                  _row(
                    icon: Icons.email_outlined,
                    label: 'البريد الإلكتروني',
                    value: _email.isEmpty ? 'غير مضاف' : _email,
                    emptyValue: _email.isEmpty,
                    action: (!_email.isEmpty && !_emailVerified)
                        ? _DataAction.verify
                        : _DataAction.edit,
                    verified: _emailVerified && _email.isNotEmpty,
                    onAction: (!_email.isEmpty && !_emailVerified)
                        ? () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) =>
                                    const EmailVerifyScreen())).then(
                            (_) => setState(() {}))
                        : _editEmail,
                  ),

                  _sep(),

                  // الهاتف
                  _row(
                    icon: Icons.phone_android_rounded,
                    label: 'رقم الهاتف',
                    value: hasPhone ? _phone : 'غير مضاف',
                    emptyValue: !hasPhone,
                    action: (hasPhone && !_phoneVerified)
                        ? _DataAction.verify
                        : _DataAction.edit,
                    verified: _phoneVerified && hasPhone,
                    onAction: (hasPhone && !_phoneVerified)
                        ? () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) =>
                                    PhoneOtpScreen(phone: _phone))).then(
                            (_) => setState(() {}))
                        : _editPhone,
                    actionLabel: hasPhone ? null : 'إضافة',
                  ),

                  _sep(),

                  // كلمة المرور
                  _row(
                    icon: Icons.lock_outline_rounded,
                    label: 'كلمة المرور',
                    value: '••••••••',
                    action: _DataAction.edit,
                    actionLabel: 'تغيير',
                    onAction: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) =>
                                const ChangePasswordScreen())),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─────────────────────────── Row widget ────────────────────────────
  Widget _row({
    required IconData icon,
    required String label,
    required String value,
    required _DataAction action,
    required VoidCallback onAction,
    bool emptyValue = false,
    bool verified = false,
    String? actionLabel,
  }) {
    final btnLabel = actionLabel ??
        (action == _DataAction.verify ? 'تأكيد' : 'تعديل');
    final btnColor =
        action == _DataAction.verify ? AppColors.wo : AppColors.nu;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(icon, color: AppColors.muted, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label,
                    style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600)),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        value,
                        style: TextStyle(
                          color: emptyValue
                              ? AppColors.muted
                              : AppColors.text,
                          fontWeight: FontWeight.w800,
                          fontSize: emptyValue ? 13 : 14.5,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (verified) ...[
                      const SizedBox(width: 6),
                      _badge('مؤكد ✓', AppColors.nu2,
                          AppColors.nu2.withValues(alpha: .14)),
                    ] else if (action == _DataAction.verify &&
                        !emptyValue) ...[
                      const SizedBox(width: 6),
                      _badge('غير مؤكد', AppColors.wo2,
                          AppColors.wo.withValues(alpha: .14)),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              foregroundColor: btnColor,
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: BorderSide(
                      color: btnColor.withValues(alpha: .3), width: .8)),
            ),
            child: Text(btnLabel,
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 12.5)),
          ),
        ],
      ),
    );
  }

  Widget _sep() =>
      const Divider(color: AppColors.line, height: 1, indent: 16, endIndent: 16);

  Widget _badge(String text, Color fg, Color bg) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration:
            BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
        child: Text(text,
            style: TextStyle(
                color: fg, fontSize: 10, fontWeight: FontWeight.w700)),
      );
}

enum _DataAction { edit, verify }

// ─── Bottom Sheet للتعديل الفردي ────────────────────────────────────────
// شيت تعديل الهاتف — زرار الدولة (علم + كود) جنب خانة الرقم،
// مع تحديد الدولة تلقائيًا من الـ IP (/api/plans geo) وإمكانية تغييرها يدويًا.
class _PhoneEditSheet extends StatefulWidget {
  final String initial;
  const _PhoneEditSheet({required this.initial});
  @override
  State<_PhoneEditSheet> createState() => _PhoneEditSheetState();
}

class _PhoneEditSheetState extends State<_PhoneEditSheet> {
  final _num = TextEditingController();
  String _iso = 'EG';
  bool _detecting = false;

  Country get _country =>
      kCountries.firstWhere((e) => e.iso == _iso, orElse: () => kCountries.first);

  @override
  void initState() {
    super.initState();
    _parseInitial();
  }

  // لو فيه رقم متسجل: نفصل كود الدولة عن الرقم الوطني.
  // لو مفيش: نحاول نجيب دولة المستخدم من الـ IP.
  void _parseInitial() {
    final raw = widget.initial.trim();
    if (raw.isEmpty) {
      _autoDetectCountry();
      return;
    }
    final digits = raw.startsWith('+') ? raw.substring(1) : raw;
    Country? match;
    for (final c in kCountries) {
      if (digits.startsWith(c.dial)) {
        if (match == null || c.dial.length > match.dial.length) match = c;
      }
    }
    if (match != null) {
      _iso = match.iso;
      _num.text = digits.substring(match.dial.length);
    } else {
      _num.text = digits;
    }
  }

  Future<void> _autoDetectCountry() async {
    setState(() => _detecting = true);
    try {
      final r = await Api.I.plans();
      final geo = (r.data['geo'] as Map?)?.cast<String, dynamic>() ?? {};
      final iso = (geo['country']?.toString().toUpperCase() ?? '');
      if (iso.isNotEmpty && kCountries.any((c) => c.iso == iso)) {
        _iso = iso;
      }
    } catch (_) {}
    if (mounted) setState(() => _detecting = false);
  }

  void _pickCountry() {
    final search = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card2,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (ctx) {
        return StatefulBuilder(builder: (ctx, setSheet) {
          final q = search.text.trim();
          final list = q.isEmpty
              ? kCountries
              : kCountries
                  .where((c) =>
                      c.name.contains(q) ||
                      c.dial.contains(q) ||
                      c.iso.toLowerCase().contains(q.toLowerCase()))
                  .toList();
          return Padding(
            padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
            child: SizedBox(
              height: MediaQuery.of(ctx).size.height * .7,
              child: Column(children: [
                const SizedBox(height: 12),
                Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                        color: AppColors.line,
                        borderRadius: BorderRadius.circular(4))),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: TextField(
                    controller: search,
                    autofocus: true,
                    onChanged: (_) => setSheet(() {}),
                    decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.search_rounded),
                        hintText: 'دور على دولتك'),
                  ),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: ListView.builder(
                    itemCount: list.length,
                    itemBuilder: (_, i) {
                      final c = list[i];
                      final sel = c.iso == _iso;
                      return ListTile(
                        leading: Text(c.flag, style: const TextStyle(fontSize: 22)),
                        title: Text(c.name,
                            style: const TextStyle(
                                color: AppColors.text,
                                fontWeight: FontWeight.w700)),
                        trailing: Text('+${c.dial}',
                            style: TextStyle(
                                color: sel ? AppColors.nu : AppColors.muted,
                                fontWeight: FontWeight.w900)),
                        onTap: () {
                          setState(() => _iso = c.iso);
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

  void _save() {
    final national = _num.text.trim().replaceAll(RegExp(r'\D'), '');
    if (national.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('اكتب رقم الهاتف')));
      return;
    }
    Navigator.pop(context, '+${_country.dial}$national');
  }

  @override
  Widget build(BuildContext context) {
    final c = _country;
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 22,
        bottom: MediaQuery.of(context).viewInsets.bottom + 28,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(widget.initial.isEmpty ? 'إضافة رقم الهاتف' : 'تعديل رقم الهاتف',
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
              const Spacer(),
              IconButton(
                  icon: const Icon(Icons.close_rounded, size: 20),
                  onPressed: () => Navigator.pop(context)),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              InkWell(
                onTap: _pickCountry,
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  height: 58,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: AppColors.card2,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.line),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text(c.flag, style: const TextStyle(fontSize: 20)),
                    const SizedBox(width: 6),
                    Text('+${c.dial}',
                        style: const TextStyle(
                            color: AppColors.text, fontWeight: FontWeight.w900)),
                    _detecting
                        ? const Padding(
                            padding: EdgeInsets.only(left: 4),
                            child: SizedBox(
                                width: 12,
                                height: 12,
                                child: CircularProgressIndicator(strokeWidth: 2)))
                        : const Icon(Icons.arrow_drop_down_rounded,
                            color: AppColors.muted),
                  ]),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _num,
                  keyboardType: TextInputType.phone,
                  autofocus: true,
                  decoration: InputDecoration(
                      prefixText: '+${c.dial}  ',
                      prefixStyle: const TextStyle(
                          color: AppColors.text, fontWeight: FontWeight.w800),
                      hintText: c.example),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.nu,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: _save,
              child: const Text('حفظ',
                  style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 16,
                      color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }
}

class _FieldSheet extends StatelessWidget {
  final String title;
  final TextEditingController ctrl;
  final String hint;
  final TextInputType type;
  final String? note;
  const _FieldSheet({
    required this.title,
    required this.ctrl,
    required this.hint,
    required this.type,
    this.note,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 22,
        bottom: MediaQuery.of(context).viewInsets.bottom + 28,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ─ عنوان + زر إغلاق
          Row(
            children: [
              Text(title,
                  style: const TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w900)),
              const Spacer(),
              IconButton(
                  icon: const Icon(Icons.close_rounded, size: 20),
                  onPressed: () => Navigator.pop(context)),
            ],
          ),
          const SizedBox(height: 14),

          // ─ حقل الإدخال
          TextField(
            controller: ctrl,
            keyboardType: type,
            autofocus: true,
            decoration: InputDecoration(hintText: hint),
          ),

          if (note != null) ...[
            const SizedBox(height: 8),
            Text(note!,
                style: const TextStyle(
                    color: AppColors.muted, fontSize: 12)),
          ],

          const SizedBox(height: 18),

          // ─ زر الحفظ
          SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.nu,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: () => Navigator.pop(context, ctrl.text),
              child: const Text('حفظ',
                  style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 16,
                      color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }
}
