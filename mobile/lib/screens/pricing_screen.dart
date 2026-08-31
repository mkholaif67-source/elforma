// ── ElForma · screens/pricing_screen.dart ──
// Plans, coupon check and manual checkout flow (server-validated).
// الباقات والكوبونات والدفع.

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../api.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme.dart';
import '../country_codes.dart';

/// Native pricing + checkout screen. Loads plans from /api/plans, lets the
/// user pick a plan, validate a coupon (/api/coupon/check), and submit a
/// manual wallet/InstaPay transfer request (/api/pay/manual). The server
/// re-prices everything — the client never decides the amount.
class PricingScreen extends StatefulWidget {
  const PricingScreen({super.key});
  @override
  State<PricingScreen> createState() => _PricingScreenState();
}

class _PricingScreenState extends State<PricingScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _plans = [];
  Map<String, dynamic> _support = {};
  // [OWNER-RULE] العملة والدولة بتتحدد تلقائيا حسب ال IP من السيرفر:
  // مصر → EGP، برا مصر → USD. العرض بيتبع العملة دي.
  String _currency = 'EGP';
  bool get _usd => _currency == 'USD';
  String _countryIso = 'EG'; // الدولة المختارة للهاتف (افتراضي من ال IP)

  // سعر الباقة بالعملة اللي السيرفر قررها من ال IP.
  // السيرفر بيبعت price_egp و price_usd مع كل باقة، واحنا بنختار
  // الرقم المناسب بس — مفيش تحويل عملة في التطبيق أبدا.
  num _priceOf(Map<String, dynamic> p) {
    final v = _usd ? p['price_usd'] : p['price_egp'];
    if (v is num) return v;
    return num.tryParse('$v') ?? 0;
  }

  // السعر المشطوب (قبل الخصم). بنرجع 0 لو مفيش أو لو مش أعلى
  // من السعر الفعلي، عشان مانعرضش خصم وهمي للمستخدم.
  num _anchorOf(Map<String, dynamic> p) {
    final v = _usd ? p['anchor_usd'] : p['anchor_egp'];
    final anchor = (v is num) ? v : (num.tryParse('$v') ?? 0);
    return anchor > _priceOf(p) ? anchor : 0;
  }
  // NOTE: the server also returns a `methods` map (available payment
  // providers). It is intentionally not stored here: nothing in this screen
  // renders it yet, and a field that is written but never read is dead weight
  // that hides real problems in the analyzer output.
  String? _selected; // plan code

  // coupon
  final _coupon = TextEditingController();
  bool _couponChecking = false;
  String? _couponMsg;
  bool _couponOk = false;
  num? _finalPrice;
  num? _discount;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _coupon.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    // نطلب الباقات + بيانات الحساب في نفس الوقت
    final results = await Future.wait([Api.I.plans(), Api.I.me()]);
    final r = results[0];
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (r.ok) {
        // [OWNER-RULE] الباقة المجانية اتشالت من قائمة الباقات نهائيًا — بنفلترها
        // client-side كمان عشان متظهرش حتى لو السيرفر (نشر قديم) رجّعها.
        _plans = ((r.data['plans'] as List?) ?? [])
            .whereType<Map>()
            .map((e) => e.cast<String, dynamic>())
            .where((p) => p['is_free'] != 1 && p['is_trial'] != 1)
            .toList();
        _support = (r.data['support'] as Map?)?.cast<String, dynamic>() ?? {};
        // العملة جاية من geo اللي السيرفر بيحسبها من ال IP.
        final geo = (r.data['geo'] as Map?)?.cast<String, dynamic>() ?? {};
        _currency = (geo['currency']?.toString().toUpperCase() == 'USD')
            ? 'USD'
            : 'EGP';
        // دولة المستخدم تلقائيا من ال IP — لو غلط يقدر يغيرها بنفسه.
        final iso = (geo['country']?.toString().toUpperCase() ?? '');
        if (iso.isNotEmpty && kCountries.any((c) => c.iso == iso)) {
          _countryIso = iso;
        }
        // الافتراضي: أول باقة مدفوعة مميزة (مش التجربة).
        final paid = _plans.where((p) => p['is_free'] != 1).toList();
        final pop = paid.firstWhere((p) => p['popular'] == true,
            orElse: () => paid.isNotEmpty ? paid.first : {});
        _selected = pop['code']?.toString();
      } else {
        _error = r.error.isNotEmpty ? r.error : 'تعذر تحميل الباقات';
      }
    });
  }

  Map<String, dynamic>? get _selectedPlan {
    if (_selected == null) return null;
    for (final p in _plans) {
      if (p['code'] == _selected) return p;
    }
    return null;
  }

  Future<void> _checkCoupon() async {
    final code = _coupon.text.trim();
    if (code.isEmpty || _selected == null) return;
    setState(() {
      _couponChecking = true;
      _couponMsg = null;
    });
    final r = await Api.I.couponCheck(code, _selected!);
    if (!mounted) return;
    setState(() {
      _couponChecking = false;
      if (r.ok && r.data['valid'] == true) {
        _couponOk = true;
        _finalPrice = r.data['final'] as num?;
        _discount = r.data['discount'] as num?;
        _couponMsg = 'تم تطبيق الكوبون خصم $_discount ج.م';
      } else {
        _couponOk = false;
        _finalPrice = null;
        _discount = null;
        _couponMsg = (r.data['error']?.toString().isNotEmpty ?? false)
            ? r.data['error'].toString()
            : 'الكوبون غير صالح';
      }
    });
  }

  void _resetCoupon() {
    setState(() {
      _couponOk = false;
      _finalPrice = null;
      _discount = null;
      _couponMsg = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('الاشتراك والأسعار',
            style: TextStyle(fontWeight: FontWeight.w900)),
        centerTitle: true,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.nu))
          : _error != null
              ? _errorView()
              : _body(),
    );
  }

  Widget _errorView() => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off, color: AppColors.muted, size: 40),
              const SizedBox(height: 12),
              Text(_error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.muted)),
              const SizedBox(height: 16),
              OutlinedButton(
                  onPressed: () {
                    setState(() => _loading = true);
                    _load();
                  },
                  child: const Text('إعادة المحاولة')),
            ],
          ),
        ),
      );

  Widget _body() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
      children: [
        const Text('اختر باقتك',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        const SizedBox(height: 4),
        const Text('كل الباقات تفتح كل مميزات التطبيق بالكامل',
            style: TextStyle(color: AppColors.muted, fontSize: 12.5)),
        const SizedBox(height: 14),
        ..._plans.map(_planCard),
        const SizedBox(height: 18),
        _couponBox(),
        const SizedBox(height: 20),
        _checkoutBox(),
      ],
    );
  }

  Widget _planCard(Map<String, dynamic> p) {
    final sel = p['code'] == _selected;
    final price = _priceOf(p);
    final anchor = _anchorOf(p);
    final badge = p['badge']?.toString() ?? '';
    return GestureDetector(
      onTap: () {
        setState(() => _selected = p['code']?.toString());
        _resetCoupon();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: sel
              ? LinearGradient(colors: [
                  AppColors.nu.withValues(alpha: .16),
                  AppColors.nu2.withValues(alpha: .05),
                ])
              : null,
          color: sel ? null : AppColors.card,
          border: Border.all(
            color: sel ? AppColors.nu : AppColors.line.withValues(alpha: .6),
            width: sel ? 1.6 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(sel ? Icons.check_circle : Icons.circle_outlined,
                color: sel ? AppColors.nu : AppColors.muted, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Text(p['name']?.toString() ?? '',
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w900)),
                    if (badge.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.nu.withValues(alpha: .16),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(badge,
                            style: const TextStyle(
                                color: AppColors.nu2,
                                fontSize: 10,
                                fontWeight: FontWeight.w800)),
                      ),
                    ],
                  ]),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('$price',
                        style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: AppColors.nu2)),
                    const SizedBox(width: 3),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 3),
                      child: Text(_usd ? 'USD' : 'ج.م',
                          style: const TextStyle(
                              color: AppColors.muted, fontSize: 12)),
                    ),
                  ],
                ),
                if (anchor > 0)
                  Text('$anchor',
                      style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                          decoration: TextDecoration.lineThrough)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _couponBox() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line.withValues(alpha: .5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('كوبون خصم (اختياري)',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(
              child: TextField(
                controller: _coupon,
                textCapitalization: TextCapitalization.characters,
                style: const TextStyle(
                    fontWeight: FontWeight.w700, color: AppColors.text),
                decoration: InputDecoration(
                  hintText: 'اكتب الكود',
                  hintStyle: const TextStyle(color: AppColors.muted),
                  filled: true,
                  fillColor: AppColors.bg2,
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 12),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide:
                        BorderSide(color: AppColors.line.withValues(alpha: .6)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide:
                        const BorderSide(color: AppColors.nu2, width: 1.3),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            SizedBox(
              height: 46,
              child: ElevatedButton(
                onPressed: _couponChecking ? null : _checkCoupon,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.nu,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                child: _couponChecking
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2.2, color: Colors.white))
                    : const Text('تحقق',
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800)),
              ),
            ),
          ]),
          if (_couponMsg != null) ...[
            const SizedBox(height: 8),
            Text(_couponMsg!,
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: _couponOk ? AppColors.nu2 : Colors.redAccent)),
          ],
        ],
      ),
    );
  }

  Widget _checkoutBox() {
    final plan = _selectedPlan;
    if (plan == null) return const SizedBox.shrink();
    // [OWNER-RULE] الباقة المجانية اتشالت تمامًا — التجربة بتتفعّل تلقائيًا وقت
    // إنشاء الحساب، فمفيش بطاقة تجربة ولا طلب رقم هاتف في شاشة الباقات.
    if (plan['is_free'] == 1 || plan['is_trial'] == 1) {
      return const SizedBox.shrink();
    }
    final base = _priceOf(plan);
    final pay = _couponOk && _finalPrice != null ? _finalPrice! : base;
    final cur = _usd ? 'USD' : 'ج.م';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(colors: [
          AppColors.nu.withValues(alpha: .12),
          AppColors.card,
        ]),
        border: Border.all(color: AppColors.nu.withValues(alpha: .3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('الإجمالي',
                  style: TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 15)),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (_couponOk && _finalPrice != null && _finalPrice != base)
                    Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: Text('$base',
                          style: const TextStyle(
                              color: AppColors.muted,
                              decoration: TextDecoration.lineThrough)),
                    ),
                  Text('$pay $cur',
                      style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: AppColors.nu2)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 52,
            child: ElevatedButton.icon(
              onPressed: () => _openManual(plan, pay),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.nu,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              icon: const Icon(Icons.account_balance_wallet_outlined,
                  color: Colors.white),
              label: const Text('ادفع بالمحفظة / InstaPay',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w900)),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'بعد التحويل وإرسال الطلب يتم تفعيل اشتراكك يدويا خلال وقت قصير',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted, fontSize: 11.5, height: 1.5),
          ),
          if (plan['paypal'] == true) ...[
            const SizedBox(height: 12),
            _PaypalButton(plan: plan, amount: {'amount': pay}, coupon: _couponOk ? _coupon.text.trim() : null),
          ],
        ],
      ),
    );
  }

  Country get _country => kCountries.firstWhere((e) => e.iso == _countryIso,
      orElse: () => kCountries.first);

  // زرار اختيار الدولة (علم + كود) — يفتح قائمة بحث.
  // ملحوظة: التجربة المجانية بقت بتتفعل برقم الحساب المخزّن،
  // فالزرار ده محفوظ للاستخدام المستقبلي (اختيار دولة يدوي).
  // ignore: unused_element
  Widget _countryButton() {
    final c = _country;
    return InkWell(
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
          const Icon(Icons.arrow_drop_down_rounded, color: AppColors.muted),
        ]),
      ),
    );
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
                      c.name.contains(q) || c.dial.contains(q) ||
                      c.iso.toLowerCase().contains(q.toLowerCase()))
                  .toList();
          return Padding(
            padding: EdgeInsets.only(
                bottom: MediaQuery.of(ctx).viewInsets.bottom),
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
                      final sel = c.iso == _countryIso;
                      return ListTile(
                        leading: Text(c.flag,
                            style: const TextStyle(fontSize: 22)),
                        title: Text(c.name,
                            style: const TextStyle(
                                color: AppColors.text,
                                fontWeight: FontWeight.w700)),
                        trailing: Text('+${c.dial}',
                            style: TextStyle(
                                color: sel ? AppColors.nu : AppColors.muted,
                                fontWeight: FontWeight.w900)),
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

  void _openManual(Map<String, dynamic> plan, num amount) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.card2,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (_) => _ManualPaySheet(
        plan: plan,
        amount: amount,
        coupon: _couponOk ? _coupon.text.trim() : null,
        support: _support,
      ),
    );
  }
}

// ------------------------------------------------------- MANUAL PAY SHEET
class _ManualPaySheet extends StatefulWidget {
  final Map<String, dynamic> plan;
  final num amount;
  final String? coupon;
  final Map<String, dynamic> support;
  const _ManualPaySheet(
      {required this.plan,
      required this.amount,
      required this.coupon,
      required this.support});
  @override
  State<_ManualPaySheet> createState() => _ManualPaySheetState();
}

class _ManualPaySheetState extends State<_ManualPaySheet> {
  String method = 'instapay';
  // [FIX] نوع المحفظة الإلكترونية اللي المستخدم حوّل منها.
  String _wallet = 'vodafone';
  static const List<List<String>> _walletOptions = [
    ['vodafone', 'Vodafone Cash'],
    ['etisalat', 'Etisalat Cash'],
    ['orange', 'Orange Cash'],
    ['wepay', 'WE Pay'],
    ['other', 'أخرى'],
  ];
  final _sender = TextEditingController();
  final _ref = TextEditingController();
  bool _submitting = false;
  String? _error;
  Map<String, dynamic>? _success;

  @override
  void dispose() {
    _sender.dispose();
    _ref.dispose();
    super.dispose();
  }

  String get _destination {
    if (method == 'wallet') {
      return widget.support['wallet_number']?.toString() ?? '—';
    }
    return widget.support['instapay_handle']?.toString() ?? '—';
  }

  Future<void> _submit() async {
    // [FIX] بيانات مصدر التحويل — مش لازم تطابق رقم الحساب ولا بتتأكد.
    final sender = _sender.text.trim();
    if (sender.isEmpty) {
      setState(() => _error = method == 'wallet'
          ? 'اكتب رقم المحفظة اللي حوّلت منها'
          : 'اكتب مصدر التحويل (رقم حساب / InstaPay / رقم / أي مُعرّف)');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final r = await Api.I.payManual({
      'plan': widget.plan['code'],
      'method': method,
      'sender': sender,
      if (method == 'wallet') 'wallet': _wallet,
      'ref': _ref.text.trim(),
      if (widget.coupon != null) 'coupon': widget.coupon,
    });
    if (!mounted) return;
    setState(() {
      _submitting = false;
      if (r.status == 401) {
        _error = 'سجل دخولك الأول عشان تقدر تشترك';
      } else if (r.ok && r.data['ok'] == true) {
        _success = r.data;
        SubscriptionStore.I.refresh(); // [FIX-5] تحديث الاشتراك فور نجاح الدفع
      } else {
        _error = r.friendlyError('تعذر إرسال الطلب، حاول تاني');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + bottom),
      child: _success != null ? _successView() : _formView(),
    );
  }

  Widget _formView() {
    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                  color: AppColors.line,
                  borderRadius: BorderRadius.circular(4)),
            ),
          ),
          const SizedBox(height: 16),
          Text('دفع ${widget.plan['name']} ${widget.amount} ج.م',
              style: const TextStyle(
                  fontSize: 17, fontWeight: FontWeight.w900)),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(
                child: _methodTab('instapay', 'InstaPay', Icons.bolt)),
            const SizedBox(width: 10),
            Expanded(
                child: _methodTab('wallet', 'محفظة',
                    Icons.account_balance_wallet_outlined)),
          ]),
          const SizedBox(height: 14),
          _destinationCard(),
          const SizedBox(height: 14),
          // [FIX] اختيار نوع المحفظة الإلكترونية (بيظهر مع المحفظة بس).
          if (method == 'wallet') ...[
            _walletSelector(),
            const SizedBox(height: 14),
          ],
          // [FIX] خانة «حوّلت من» المرنة — بيانات مصدر التحويل فقط.
          _field(
            _sender,
            method == 'wallet'
                ? 'رقم المحفظة اللي حوّلت منها'
                : 'حوّلت من',
            hint: method == 'wallet'
                ? 'مثال: 010xxxxxxxx'
                : 'رقم حساب / InstaPay Username / رقم / أي مُعرّف',
            keyboard: method == 'wallet'
                ? TextInputType.phone
                : TextInputType.text,
          ),
          const SizedBox(height: 14),
          // العملية المرجعية أساسية وموجودة زي ما هي (اختيارية).
          _field(_ref, 'رقم العملية / المرجع (اختياري)'),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!,
                style: const TextStyle(
                    color: Colors.redAccent, fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 18),
          SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.nu,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.4, color: Colors.white))
                  : const Text('أرسل طلب التفعيل',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w900)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _methodTab(String key, String label, IconData icon) {
    final sel = method == key;
    return GestureDetector(
      onTap: () => setState(() => method = key),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: sel
              ? const LinearGradient(colors: [AppColors.nu, AppColors.nu2])
              : null,
          color: sel ? null : AppColors.bg2,
          border: Border.all(
              color: sel ? Colors.transparent : AppColors.line.withValues(alpha: .6)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                size: 18, color: sel ? Colors.white : AppColors.muted),
            const SizedBox(width: 6),
            Text(label,
                style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: sel ? Colors.white : AppColors.muted)),
          ],
        ),
      ),
    );
  }

  Widget _destinationCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.nu.withValues(alpha: .3)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                    method == 'wallet'
                        ? 'حول على رقم المحفظة'
                        : 'حول على حساب InstaPay',
                    style: const TextStyle(
                        color: AppColors.muted, fontSize: 12)),
                const SizedBox(height: 4),
                SelectableText(_destination,
                    style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                        color: AppColors.nu2)),
              ],
            ),
          ),
          IconButton(
            tooltip: 'نسخ',
            icon: const Icon(Icons.copy, color: AppColors.nu2, size: 20),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: _destination));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('تم نسخ الرقم')),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _field(TextEditingController c, String label,
      {String? hint, TextInputType? keyboard}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6, right: 2),
          child: Text(label,
              style: const TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 12.5)),
        ),
        TextField(
          controller: c,
          keyboardType: keyboard,
          style: const TextStyle(
              fontWeight: FontWeight.w700, color: AppColors.text),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: AppColors.muted, fontSize: 13),
            filled: true,
            fillColor: AppColors.bg2,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: AppColors.line.withValues(alpha: .6)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.nu2, width: 1.3),
            ),
          ),
        ),
      ],
    );
  }

  // [FIX] اختيار نوع المحفظة: Vodafone/Etisalat/Orange/WE Pay/أخرى.
  Widget _walletSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(bottom: 8, right: 2),
          child: Text('نوع المحفظة اللي حوّلت منها',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _walletOptions.map((w) {
            final sel = _wallet == w[0];
            return GestureDetector(
              onTap: () => setState(() => _wallet = w[0]),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  color: sel
                      ? AppColors.nu.withValues(alpha: .16)
                      : AppColors.bg2,
                  border: Border.all(
                      color: sel
                          ? AppColors.nu
                          : AppColors.line.withValues(alpha: .6),
                      width: sel ? 1.5 : 1),
                ),
                child: Text(w[1],
                    style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 12.5,
                        color: sel ? AppColors.nu2 : AppColors.muted)),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _successView() {
    final id = _success!['payment_id'];
    final wa = widget.support['whatsapp']?.toString() ?? '';
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 8),
        Container(
          width: 64,
          height: 64,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.nu.withValues(alpha: .16),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.check_rounded,
              color: AppColors.nu2, size: 36),
        ),
        const SizedBox(height: 14),
        const Text('تم استلام طلبك',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        const SizedBox(height: 8),
        Text('رقم الطلب: #$id',
            style: const TextStyle(
                color: AppColors.nu2, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        const Text(
          'تم تسجيل طلب التفعيل. لتأكيد أسرع ابعت إيصال التحويل على واتساب الدعم مع رقم الطلب',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.muted, height: 1.6, fontSize: 12.5),
        ),
        if (wa.isNotEmpty) ...[
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.bg2,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(children: [
              const Icon(Icons.chat, color: AppColors.nu2, size: 20),
              const SizedBox(width: 10),
              const Text('واتساب الدعم: ',
                  style: TextStyle(color: AppColors.muted, fontSize: 12)),
              Expanded(
                child: SelectableText(wa,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: AppColors.text)),
              ),
              IconButton(
                tooltip: 'نسخ رقم الواتساب',
                icon: const Icon(Icons.copy, size: 18, color: AppColors.nu2),
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: wa));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('تم نسخ الرقم')),
                  );
                },
              ),
            ]),
          ),
        ],
        const SizedBox(height: 18),
        SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.nu,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('تمام',
                style: TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w900)),
          ),
        ),
      ],
    );
  }
}

// ───────────────────────────────────────────────────────────────────────────
/// زر PayPal: ينشئ الطلب ثم يفتح المتصفح للموافقة
// [FIX] PayPal — وسيلة دفع دولية تعمل على أي هوست
// ───────────────────────────────────────────────────────────────────────────
class _PaypalButton extends StatefulWidget {
  final Map<String, dynamic> plan;
  final Map<String, dynamic> amount;
  final String? coupon;
  const _PaypalButton({required this.plan, required this.amount, this.coupon});
  @override
  State<_PaypalButton> createState() => _PaypalButtonState();
}

class _PaypalButtonState extends State<_PaypalButton> {
  bool _loading = false;
  bool _awaitingCapture = false;
  String? _orderId;
  String? _error;
  String? _success;

  Future<void> _start() async {
    setState(() { _loading = true; _error = null; });
    final r = await Api.I.paypalCreate(
      widget.plan['code']?.toString() ?? '',
      coupon: widget.coupon,
    );
    if (!mounted) return;
    if (!r.ok) {
      setState(() { _loading = false; _error = r.friendlyError('تعذّر فتح PayPal، حاول تاني'); });
      return;
    }
    final orderId = r.data['id']?.toString() ?? '';
    final mode = r.data['mode']?.toString() ?? 'live';
    final host = mode == 'sandbox'
        ? 'www.sandbox.paypal.com'
        : 'www.paypal.com';
    final approvalUrl = Uri.https(host, '/checkoutnow', {'token': orderId});
    try {
      await launchUrl(approvalUrl, mode: LaunchMode.externalApplication);
    } catch (_) {
      await launchUrl(approvalUrl, mode: LaunchMode.platformDefault);
    }
    setState(() { _loading = false; _orderId = orderId; _awaitingCapture = true; });
  }

  Future<void> _capture() async {
    if (_orderId == null) return;
    setState(() { _loading = true; _error = null; });
    final r = await Api.I.paypalCapture(_orderId!);
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (r.ok && r.data['ok'] == true) {
        _success = 'تم الدفع بنجاح! سيتم تفعيل اشتراكك خلال دقائق ✅';
        _awaitingCapture = false;
      } else {
        _error = r.friendlyError('لم يتم تأكيد الدفع بعد، تأكد من الموافقة على PayPal ثم حاول تاني');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_success != null) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.green.withValues(alpha: .1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.green),
        ),
        child: Text(_success!, textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.green, fontWeight: FontWeight.w700)),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: 52,
          child: ElevatedButton.icon(
            onPressed: _loading ? null : (_awaitingCapture ? _capture : _start),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF003087), // PayPal blue
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            icon: _loading
                ? const SizedBox(width: 18, height: 18,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Icon(Icons.payment, color: Colors.white),
            label: Text(
              _awaitingCapture ? 'تأكيد الدفع بعد الموافقة على PayPal' : 'ادفع بـ PayPal',
              style: const TextStyle(color: Colors.white, fontSize: 15,
                  fontWeight: FontWeight.w900),
            ),
          ),
        ),
        if (_awaitingCapture && !_loading)
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text(
              'وافق على PayPal ثم ارجع هنا واضغط ⋃ تأكيد الدفع',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, fontSize: 11.5, height: 1.5),
            ),
          ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(_error!, textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.redAccent,
                    fontWeight: FontWeight.w600, fontSize: 13)),
          ),
      ],
    );
  }
}

