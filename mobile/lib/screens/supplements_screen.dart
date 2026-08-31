// ElForma - screens/supplements_screen.dart
// Supplement reminders. Catalogue condensed from the website supplements guide.
// Everything (catalogue, custom supplement, timing, toggle) lives inside this one screen.

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/profile_store.dart';
import '../notification_service.dart';
import '../theme.dart';

/// أقل سن مسموح له يشوف المكملات أصلا.
/// المرجع: NSCA / AAP — مفيش كرياتين ولا كافيين ولا بروتين مصنع كتوصية
/// لحد تحت 17. اللي تحت السن ده أكله بيجي من الأكل مش من علبة.
const int kSupplementsMinAge = 17;

/// مكمل في الكتالوج أو مضاف من المستخدم.
class Supp {
  final String id;
  final String name;
  final String dose;
  final String why;
  final String note;
  final int hour;
  final int minute;
  final bool custom;

  const Supp({
    required this.id,
    required this.name,
    required this.dose,
    required this.why,
    required this.note,
    required this.hour,
    required this.minute,
    this.custom = false,
    this.group = 'gym',
    this.evidence = 'medium',
  });

  /// قوة الدليل العلمي:
  /// 'strong'     = مدروس ومثبت في دراسات متكررة.
  /// 'medium'     = دليل معقول لكنه مش حاسم.
  /// 'weak'       = الدليل ضعيف؛ مالوش أولوية في فلوسك.
  /// 'deficiency' = مفيد لما يكون فيه نقص فعلي بس، مش للتحسين العام.
  final String evidence;

  /// 'صيدلية' = فيتامينات ومعادن من أي صيدلية، 'جيم' = مكملات رياضية.
  final String group;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'dose': dose,
        'why': why,
        'note': note,
        'hour': hour,
        'minute': minute,
        'custom': custom,
        'group': group,
        'evidence': evidence,
      };

  static Supp fromJson(Map<String, dynamic> raw) => Supp(
        id: '${raw['id']}',
        name: '${raw['name']}',
        dose: '${raw['dose'] ?? ''}',
        why: '${raw['why'] ?? ''}',
        note: '${raw['note'] ?? ''}',
        hour: raw['hour'] is int ? raw['hour'] as int : 9,
        minute: raw['minute'] is int ? raw['minute'] as int : 0,
        custom: raw['custom'] == true,
        group: '${raw['group'] ?? 'gym'}',
        evidence: '${raw['evidence'] ?? 'medium'}',
      );

  Supp at(int h, int m) => Supp(
      id: id, name: name, dose: dose, why: why, note: note,
      hour: h, minute: m, custom: custom, group: group, evidence: evidence);
}

// ملخص من دليل المكملات في الموقع - نفس الجرعات والتوقيتات، مختصرة للموبايل.
// التوقيت الافتراضي مبني على أفضل وقت للامتصاص مش على العشوائي.
const List<Supp> kSuppCatalogue = [
  // [OWNER-RULE] مرتبة حسب الأهمية والاستخدام الفعلي: الكرياتين والبروتين وفيتامين D
  // فوق، والأقل دليلا (الجلوتامين) تحت. اتشال المكرر.
  Supp(
    id: 'creatine',
    evidence: 'strong',
    name: 'كرياتين',
    group: 'جيم',
    dose: '3-5 جم يوميا',
    why: 'يزود القوة والانفجارية بنسبة 5-15% مع التدريب بالأثقال وبيزود الماء داخل العضلة فتبان أمتلأ',
    note: 'أي وقت في اليوم - المهم الثبات مش التوقيت. ماتحتاجش مرحلة تحميل. هو أكتر مكمل مدروس علميا على الإطلاق',
    hour: 21, minute: 0,
  ),
  Supp(
    id: 'whey',
    evidence: 'strong',
    name: 'واي بروتين',
    group: 'جيم',
    dose: '25-30 جم للجرعة',
    why: 'أسرع بروتين امتصاصا لبناء وترميم العضلة - مجرد وسيلة سهلة توصل بيها لبروتين يومك',
    note: 'استهدف 1.6-2.2 جم بروتين لكل كجم من وزنك يوميا. لو وصلته من الأكل ماتحتاجهش',
    hour: 18, minute: 30,
  ),
  Supp(
    id: 'vitd3',
    evidence: 'deficiency',
    name: 'فيتامين D',
    group: 'صيدلية',
    dose: '1000-2000 وحدة يوميا',
    why: 'صحة العظام والمناعة ودعم التستوستيرون الطبيعي. نقصه منتشر جدا في مصر رغم الشمس',
    note: 'مع وجبة فيها دهون ومع ال K2. الجرعات العالية (5000+) تبقى بتحليل ومتابعة طبيب مش من نفسك',
    hour: 9, minute: 0,
  ),
  Supp(
    id: 'omega3',
    evidence: 'strong',
    name: 'أوميجا 3',
    group: 'صيدلية',
    dose: '2-3 جم EPA+DHA',
    why: 'يقلل الالتهاب بعد التمرين ويدعم صحة القلب والمفاصل والمخ',
    note: 'بص على محتوى EPA+DHA مش على إجمالي الزيت فرق كبير بين المنتجات. خده مع وجبة دسمة',
    hour: 14, minute: 0,
  ),
  Supp(
    id: 'mag',
    evidence: 'deficiency',
    name: 'ماغنسيوم',
    group: 'صيدلية',
    dose: '300-400 مجم (جلايسينات)',
    why: 'يعمق النوم ويسرع الاستشفاء ويقلل التشنجات والشد العضلي',
    note: 'قبل النوم ب 30-60 دقيقة. الجلايسينات أحسن الأشكال امتصاصا ومابيعملش اضطراب هضمي زي الأكسيد',
    hour: 22, minute: 30,
  ),
  Supp(
    id: 'caffeine',
    evidence: 'strong',
    name: 'كافيين',
    group: 'جيم',
    dose: '3-6 مجم لكل كجم من وزنك',
    why: 'يرفع التركيز والأداء ومعدل الحرق في الحصة وبيقلل الإحساس بالمجهود',
    note: 'قبل التمرين ب 45-60 دقيقة. ماتعديش 400 مجم في اليوم وأوقفه قبل النوم ب 8 ساعات عشان مايضربش نومك والنوم أهم من أي مكمل',
    hour: 17, minute: 0,
  ),
  Supp(
    id: 'zinc',
    evidence: 'deficiency',
    name: 'زنك',
    group: 'صيدلية',
    dose: '15-30 مجم',
    why: 'يدعم المناعة وهرمونات الذكورة والتئام الأنسجة',
    note: 'ماتاخدهوش مع اللبن والألبان أو مكملات الكالسيوم بيمنع امتصاصه. ماتزودش عن 40 مجم طويلا عشان مايقللش النحاس',
    hour: 20, minute: 0,
  ),
  Supp(
    id: 'citrulline',
    evidence: 'medium',
    // [FIX owner-rules] الاختبار "البدائل موجودة بأسماء بسيطة" بيطلب الكتابة
    // الشائعة في مصر "سترولين" مش النقحرفة الحرفية "سيترولين".
    name: 'سترولين',
    group: 'جيم',
    dose: '6-8 جم (سترولين ماليت)',
    why: 'بيوسع الأوعية ويزود تدفق الدم للعضلة فبتعمل تكرارات أكتر والضخ أقوى وبيقلل ألم العضلات بعد التمرين',
    note: 'قبل التمرين ب 60 دقيقة على معدة فاضية نسبيا. أحسن من الأرجنين بكتير لأن الأرجنين بيتكسر في الكبد قبل ما يوصل',
    hour: 17, minute: 0,
  ),
  Supp(
    id: 'betaalanine',
    evidence: 'strong',
    name: 'بيتا ألانين',
    group: 'جيم',
    dose: '3-5 جم يوميا',
    why: 'بيأخر حرقان العضلة في المجموعات اللي بتاخد 1-4 دقايق (التكرارات العالية والكارديو العنيف)',
    note: 'بيشتغل بالتراكم مش بالجرعة لازم 4 أسابيع يومي. الوخز في الوش طبيعي ومش ضار قسم الجرعة لو ضايقك',
    hour: 17, minute: 0,
  ),
  Supp(
    id: 'vitc',
    evidence: 'deficiency',
    name: 'فيتامين C',
    group: 'صيدلية',
    dose: '500 مجم',
    why: 'مضاد أكسدة يدعم المناعة وبيزود امتصاص الحديد من الأكل',
    note: '500 مجم بتدي تقريبا نفس تأثير 1000 ماتبالغش. جرعات ضخمة يوميا ممكن تقلل استجابة التمرين نفسه',
    hour: 13, minute: 0,
  ),
  Supp(
    id: 'vitb',
    evidence: 'deficiency',
    name: 'فيتامين B مركب',
    group: 'صيدلية',
    dose: 'كبسولة واحدة يوميا',
    why: 'إنتاج الطاقة داخل الخلية وصحة الأعصاب وتحويل الأكل لطاقة فعلية',
    note: 'خده مع الفطار. على معدة فاضية ممكن يعمل غثيان. مهم جدا للنباتيين (B12)',
    hour: 9, minute: 0,
  ),
  Supp(
    id: 'iron',
    evidence: 'deficiency',
    name: 'حديد',
    group: 'صيدلية',
    dose: 'حسب التحليل',
    why: 'نقص الحديد هو أشهر سبب للإرهاق وقلة النفس في التمرين وأكتر انتشارا عند البنات واللي بيجري كتير',
    note: 'ممنوع تاخده من غير تحليل الحديد الزايد سام. اعمل صورة دم وفيريتين الأول. يمتص أحسن مع فيتامين C وبعيد عن الشاي والقهوة واللبن',
    hour: 13, minute: 0,
  ),
  Supp(
    id: 'vitk2',
    evidence: 'medium',
    name: 'فيتامين K2',
    group: 'صيدلية',
    dose: '100-200 ميكروجرام (MK-7)',
    why: 'بيوجه الكالسيوم للعظام بدل ما يترسب في الشرايين ده اللي بيخلي فيتامين D آمن ومفيد فعلا',
    note: 'مع وجبة فيها دهون. لو بتاخد فيتامين D بجرعة عالية ال K2 مش رفاهية خده معاه. ممنوع مع مسيلات الدم (وارفارين) إلا بإذن طبيب',
    hour: 9, minute: 0,
  ),
  Supp(
    id: 'ashwagandha',
    evidence: 'medium',
    name: 'أشواجاندا',
    group: 'صيدلية',
    dose: '300-600 مجم KSM-66',
    why: 'يخفض الكورتيزول ويحسن الاستشفاء ويدعم مستوى التستوستيرون',
    note: 'محتاج أسبوعين على الأقل عشان تحس بيه. ممنوع مع مشاكل الدرقية أو أدوية المناعة إلا بإذن طبيب',
    hour: 22, minute: 0,
  ),
  Supp(
    id: 'eaa',
    evidence: 'medium',
    name: 'أحماض أمينية',
    group: 'جيم',
    dose: '10 جم أثناء التمرين',
    why: 'مفيد لو بتتمرن صايم أو بروتين يومك قليل',
    note: 'لو بتاخد بروتين كافي من الأكل فمالوش لزوم حقيقي',
    hour: 17, minute: 30,
  ),
  Supp(
    id: 'glutamine',
    evidence: 'weak',
    name: 'جلوتامين',
    group: 'جيم',
    dose: '5-10 جم',
    why: 'بيدعم بطانة الأمعاء والمناعة وقت التنشيف القاسي أو الحمل التدريبي العالي',
    note: 'بصراحة: دليله في بناء العضل أو الاستشفاء للشخص السليم ضعيف جدا. ماتصرفش عليه قبل ما تظبط البروتين والنوم والكرياتين',
    hour: 22, minute: 0,
  ),
];

class SupplementsScreen extends StatefulWidget {
  const SupplementsScreen({super.key});

  @override
  State<SupplementsScreen> createState() => _SupplementsScreenState();
}

class _SupplementsScreenState extends State<SupplementsScreen> {
  static const String _kEnabled = 'supp_enabled_v1';
  static const String _kTimes = 'supp_times_v1';
  static const String _kCustom = 'supp_custom_v1';

  bool loading = true;
  int _age = 0;
  bool get _tooYoung => _age > 0 && _age < kSupplementsMinAge;
  final Set<String> enabled = <String>{};
  final Map<String, List<int>> times = <String, List<int>>{};
  final List<Supp> custom = <Supp>[];

  List<Supp> get _all => [...kSuppCatalogue, ...custom];

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// معرف ثابت للإشعار مشتق من اسم المكمل عشان مايتضاربش مع باقي التذكيرات.
  int _notifId(String id) => 300 + (id.hashCode.abs() % 180);

  Future<void> _load() async {
    await ProfileStore.I.ensureLoaded();
    _age = ProfileStore.I.intOf('age', 0);
    final sp = await SharedPreferences.getInstance();
    final rawCustom = sp.getString(_kCustom);
    final rawTimes = sp.getString(_kTimes);
    if (!mounted) return;
    setState(() {
      enabled
        ..clear()
        ..addAll(sp.getStringList(_kEnabled) ?? const []);
      custom.clear();
      if (rawCustom != null && rawCustom.isNotEmpty) {
        for (final item in (jsonDecode(rawCustom) as List)) {
          if (item is Map) {
            custom.add(Supp.fromJson(Map<String, dynamic>.from(item)));
          }
        }
      }
      times.clear();
      if (rawTimes != null && rawTimes.isNotEmpty) {
        (jsonDecode(rawTimes) as Map).forEach((key, value) {
          if (value is List && value.length == 2) {
            times['$key'] = [value[0] as int, value[1] as int];
          }
        });
      }
      loading = false;
    });
  }

  Future<void> _persist() async {
    final sp = await SharedPreferences.getInstance();
    await sp.setStringList(_kEnabled, enabled.toList());
    await sp.setString(_kCustom, jsonEncode(custom.map((e) => e.toJson()).toList()));
    await sp.setString(_kTimes, jsonEncode(times));
  }

  TimeOfDay _timeOf(Supp supp) {
    final saved = times[supp.id];
    if (saved != null) return TimeOfDay(hour: saved[0], minute: saved[1]);
    return TimeOfDay(hour: supp.hour, minute: supp.minute);
  }

  Future<void> _reschedule(Supp supp) async {
    final id = _notifId(supp.id);
    await NotificationService.I.cancel(id);
    if (!enabled.contains(supp.id)) return;
    final time = _timeOf(supp);
    await NotificationService.I.scheduleDaily(
      id: id,
      hour: time.hour,
      minute: time.minute,
      title: 'موعد ${supp.name}',
      body: supp.dose.isEmpty ? 'موعد جرعتك دلوقتي' : '${supp.dose} - ${supp.name}',
      channel: 'supplement_reminders',
    );
  }

  Future<void> _toggle(Supp supp, bool value) async {
    setState(() {
      if (value) {
        enabled.add(supp.id);
      } else {
        enabled.remove(supp.id);
      }
    });
    await _persist();
    await _reschedule(supp);
  }

  Future<void> _pickTime(Supp supp) async {
    final selected =
        await showTimePicker(context: context, initialTime: _timeOf(supp));
    if (selected == null || !mounted) return;
    setState(() => times[supp.id] = [selected.hour, selected.minute]);
    await _persist();
    await _reschedule(supp);
  }

  /// علامة التعجب جنب المكمل: التفاصيل الطويلة مخبية هنا عشان القائمة تفضل نظيفة.
  void _info(Supp supp) {
    showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(supp.name,
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (supp.dose.isNotEmpty) ...[
                const Text('الجرعة',
                    style: TextStyle(
                        color: AppColors.nu,
                        fontWeight: FontWeight.w900,
                        fontSize: 11)),
                const SizedBox(height: 3),
                Text(supp.dose, style: const TextStyle(height: 1.5)),
                const SizedBox(height: 13),
              ],
              if (supp.why.isNotEmpty) ...[
                const Text('بيعمل إيه',
                    style: TextStyle(
                        color: AppColors.nu,
                        fontWeight: FontWeight.w900,
                        fontSize: 11)),
                const SizedBox(height: 3),
                Text(supp.why,
                    style: const TextStyle(height: 1.6, color: AppColors.text)),
                const SizedBox(height: 13),
              ],
              if (supp.note.isNotEmpty) ...[
                const Text('انتبه لكده',
                    style: TextStyle(
                        color: AppColors.wo2,
                        fontWeight: FontWeight.w900,
                        fontSize: 11)),
                const SizedBox(height: 3),
                Text(supp.note,
                    style: const TextStyle(height: 1.6, color: AppColors.muted)),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('تمام')),
        ],
      ),
    );
  }

  Future<void> _addCustom() async {
    final nameCtrl = TextEditingController();
    final doseCtrl = TextEditingController();
    TimeOfDay picked = const TimeOfDay(hour: 9, minute: 0);

    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (innerContext, setLocal) => AlertDialog(
          backgroundColor: AppColors.card,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('إضافة مكمل',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(
                  labelText: 'اسم المكمل',
                  hintText: 'مثلا: حديد'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: doseCtrl,
              decoration: const InputDecoration(
                  labelText: 'الجرعة (اختياري)',
                  hintText: 'مثلا: قرص واحد'),
            ),
            const SizedBox(height: 16),
            Row(children: [
              const Icon(Icons.schedule_rounded,
                  color: AppColors.nu, size: 19),
              const SizedBox(width: 8),
              const Text('موعد التذكير'),
              const Spacer(),
              TextButton(
                onPressed: () async {
                  final chosen = await showTimePicker(
                      context: innerContext, initialTime: picked);
                  if (chosen != null) setLocal(() => picked = chosen);
                },
                child: Text(picked.format(innerContext),
                    style: const TextStyle(fontWeight: FontWeight.w900)),
              ),
            ]),
          ]),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('إلغاء')),
            ElevatedButton(
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: const Text('إضافة')),
          ],
        ),
      ),
    );

    if (saved != true) return;
    final name = nameCtrl.text.trim();
    if (name.isEmpty) return;
    final supp = Supp(
      id: 'custom_${DateTime.now().millisecondsSinceEpoch}',
      name: name,
      dose: doseCtrl.text.trim(),
      why: 'مكمل أضفته بنفسك',
      note: 'التوقيت اللي اخترته هو اللي هيوصلك عليه التنبيه كل يوم',
      hour: picked.hour,
      minute: picked.minute,
      custom: true,
    );
    setState(() {
      custom.add(supp);
      enabled.add(supp.id);
      times[supp.id] = [picked.hour, picked.minute];
    });
    await _persist();
    await _reschedule(supp);
  }

  Future<void> _remove(Supp supp) async {
    await NotificationService.I.cancel(_notifId(supp.id));
    setState(() {
      custom.removeWhere((item) => item.id == supp.id);
      enabled.remove(supp.id);
      times.remove(supp.id);
    });
    await _persist();
  }

  /// بديل الكتالوج لأي حد تحت 17. مش رسالة منع جافة — بنقوله يعمل إيه بدالها،
  /// لأن اللي محتاج يخس أو يزيد في السن ده محتاج إجابة مش باب مقفول.
  Widget _underAgeView() {
    const rows = [
      ['\u0628\u0631\u0648\u062a\u064a\u0646 \u0645\u0646 \u0627\u0644\u0623\u0643\u0644',
       '\u0628\u064a\u0636\u060c \u0641\u0631\u0627\u062e\u060c \u0633\u0645\u0643\u060c \u0644\u0628\u0646\u060c \u062c\u0628\u0646\u0629 \u0642\u0631\u064a\u0634\u060c \u0628\u0642\u0648\u0644\u064a\u0627\u062a \u2014 \u0645\u0648\u0632\u0639\u064a\u0646 \u0639\u0644\u0649 \u0648\u062c\u0628\u0627\u062a \u0627\u0644\u064a\u0648\u0645.'],
      ['\u0641\u064a\u062a\u0627\u0645\u064a\u0646 \u062f\u0627\u0644 \u0648\u0627\u0644\u062d\u062f\u064a\u062f',
       '\u0644\u0648 \u0641\u064a\u0647 \u0646\u0642\u0635 \u0641\u0639\u0644\u064a\u060c \u062f\u0647 \u0642\u0631\u0627\u0631 \u0637\u0628\u064a\u0628 \u0628\u0639\u062f \u062a\u062d\u0644\u064a\u0644 \u2014 \u0645\u0634 \u0642\u0631\u0627\u0631 \u062a\u0637\u0628\u064a\u0642.'],
      ['\u0627\u0644\u0646\u0648\u0645',
       '8-10 \u0633\u0627\u0639\u0627\u062a \u0641\u064a \u0627\u0644\u0633\u0646 \u062f\u0647 \u0628\u062a\u0641\u0631\u0642 \u0641\u064a \u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0623\u0643\u062a\u0631 \u0645\u0646 \u0623\u064a \u0645\u0643\u0645\u0644.'],
      ['\u0627\u0644\u0645\u0627\u064a\u0629',
       '\u0642\u0628\u0644 \u0648\u0623\u062b\u0646\u0627\u0621 \u0648\u0628\u0639\u062f \u0627\u0644\u062a\u0645\u0631\u064a\u0646 \u2014 \u0623\u0647\u0645 \u062d\u0627\u062c\u0629 \u0648\u0628\u0644\u0627\u0634 \u0645\u0634\u0631\u0648\u0628\u0627\u062a \u0627\u0644\u0637\u0627\u0642\u0629 \u062e\u0627\u0644\u0635.'],
    ];
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 40),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.wo.withValues(alpha: .10),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.wo.withValues(alpha: .28)),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(Icons.shield_rounded, color: AppColors.wo, size: 20),
                SizedBox(width: 8),
                Expanded(
                  child: Text('\u0642\u0633\u0645 \u0627\u0644\u0645\u0643\u0645\u0644\u0627\u062a \u0645\u0642\u0641\u0648\u0644 \u062a\u062d\u062a 17 \u0633\u0646\u0629',
                      style: TextStyle(
                          color: AppColors.text,
                          fontWeight: FontWeight.w900,
                          fontSize: 15)),
                ),
              ]),
              SizedBox(height: 10),
              Text(
                '\u062f\u0647 \u0645\u0634 \u062a\u0642\u064a\u064a\u062f \u0639\u0634\u0648\u0627\u0626\u064a. \u0641\u064a \u0633\u0646 \u0627\u0644\u0646\u0645\u0648 \u0645\u0641\u064a\u0634 \u0645\u0643\u0645\u0644 \u0623\u062b\u0628\u062a \u0641\u0627\u064a\u062f\u0629 \u062a\u0633\u062a\u0627\u0647\u0644 \u0627\u0644\u0645\u062e\u0627\u0637\u0631\u0629\u060c \u0648\u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0643\u0644\u0647\u0627 \u0628\u062a\u064a\u062c\u064a \u0645\u0646 \u0627\u0644\u0623\u0643\u0644 \u0648\u0627\u0644\u062a\u0645\u0631\u064a\u0646 \u0648\u0627\u0644\u0646\u0648\u0645. \u062e\u0637\u062a\u0643 \u0645\u0638\u0628\u0648\u0637\u0629 \u0639\u0644\u0649 \u0643\u062f\u0647 \u0628\u0627\u0644\u0641\u0639\u0644.',
                style: TextStyle(
                    color: AppColors.muted, fontSize: 13, height: 1.7),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const Text('\u0627\u0644\u0644\u064a \u064a\u0641\u0631\u0642 \u0645\u0639\u0627\u0643 \u0641\u0639\u0644\u0627 \u0641\u064a \u0627\u0644\u0633\u0646 \u062f\u0647',
            style: TextStyle(
                color: AppColors.text,
                fontWeight: FontWeight.w900,
                fontSize: 15)),
        const SizedBox(height: 10),
        ...rows.map((r) => Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(r[0],
                      style: const TextStyle(
                          color: AppColors.nu,
                          fontWeight: FontWeight.w900,
                          fontSize: 14)),
                  const SizedBox(height: 6),
                  Text(r[1],
                      style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 13,
                          height: 1.6)),
                ],
              ),
            )),
        const SizedBox(height: 6),
        const Text(
          '\u0644\u0648 \u0641\u064a\u0647 \u062d\u0627\u0644\u0629 \u0637\u0628\u064a\u0629 \u0623\u0648 \u0646\u0642\u0635 \u0645\u062b\u0628\u062a \u0628\u062a\u062d\u0644\u064a\u0644\u060c \u0637\u0628\u064a\u0628 \u0627\u0644\u0623\u0637\u0641\u0627\u0644 \u0647\u0648 \u0627\u0644\u0644\u064a \u064a\u0642\u0631\u0631.',
          style: TextStyle(color: AppColors.muted, fontSize: 12, height: 1.6),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  /// الصيدلية الأول بعدين الجيم بعدين إضافات المستخدم — الترتيب مقصود:
  /// اللي بيسد نقص حقيقي قبل اللي بيحسن الأداء.
  List<Widget> _groupedRows(List<Supp> list) {
    Widget header(String text, IconData icon, Color color) => Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 10),
          child: Row(children: [
            Icon(icon, size: 17, color: color),
            const SizedBox(width: 7),
            Text(text,
                style: const TextStyle(
                    fontWeight: FontWeight.w900, fontSize: 14.5)),
          ]),
        );

    final pharmacy = list.where((s) => s.group == 'صيدلية' && !s.custom).toList();
    final gym = list.where((s) => s.group == 'جيم' && !s.custom).toList();
    final mine = list.where((s) => s.custom).toList();

    return [
      if (pharmacy.isNotEmpty) ...[
        header('من الصيدلية', Icons.local_pharmacy_rounded, AppColors.nu),
        ...pharmacy.map(_row),
        const SizedBox(height: 10),
      ],
      if (gym.isNotEmpty) ...[
        header('مكملات الجيم', Icons.fitness_center_rounded, AppColors.wo),
        ...gym.map(_row),
        const SizedBox(height: 10),
      ],
      if (mine.isNotEmpty) ...[
        header('إضافاتك', Icons.person_rounded, AppColors.wo2),
        ...mine.map(_row),
      ],
    ];
  }

  @override
  Widget build(BuildContext context) {
    final list = _all;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        centerTitle: true,
        title: const Text('تنبيه المكملات',
            style: TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.nu))
          : _tooYoung
          ? _underAgeView()
          : ListView(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 40),
              children: [
                Container(
                  padding: const EdgeInsets.all(15),
                  decoration: BoxDecoration(
                    color: AppColors.nu.withValues(alpha: .08),
                    borderRadius: BorderRadius.circular(16),
                    border:
                        Border.all(color: AppColors.nu.withValues(alpha: .22)),
                  ),
                  child: const Text(
                    'حدد المكملات اللي بتاخدها بس. التوقيت مظبوط مقدما على أفضل وقت للامتصاص وتقدر تغيره. اضغط على (!) جنب أي مكمل تعرف بيعمل إيه',
                    style: TextStyle(
                        color: AppColors.muted, fontSize: 12.5, height: 1.55),
                  ),
                ),
                const SizedBox(height: 16),
                ..._groupedRows(list),
                const SizedBox(height: 8),
                SizedBox(
                  height: 50,
                  child: OutlinedButton.icon(
                    onPressed: _addCustom,
                    icon: const Icon(Icons.add_rounded),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.nu,
                      side: const BorderSide(color: AppColors.nu),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                    label: const Text('إضافة مكمل وتوقيته',
                        style: TextStyle(fontWeight: FontWeight.w900)),
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'المكملات إضافة لأكل مظبوط مش بديل عنه. لو عندك حالة مرضية أو بتاخد دوا اسأل دكتورك الأول',
                  style: TextStyle(
                      color: AppColors.muted, fontSize: 11, height: 1.6),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
    );
  }

  /// شارة صغيرة جنب الاسم تقول للمتدرب الحقيقة من غير ما يفتح تفاصيل:
  /// إيه اللي مدروس فعلا وإيه اللي مالوش لازمة إلا لو عنده نقص.
  Widget? _evidenceBadge(Supp supp) {
    if (supp.custom) return null;
    String text;
    Color color;
    switch (supp.evidence) {
      case 'strong':
        text = 'دليل قوي';
        color = AppColors.nu;
        break;
      case 'weak':
        text = 'دليل ضعيف';
        color = AppColors.muted;
        break;
      case 'deficiency':
        text = 'للنقص بس';
        color = AppColors.wo2;
        break;
      default:
        text = 'دليل متوسط';
        color = AppColors.wo;
    }
    return Container(
      margin: const EdgeInsets.only(right: 6),
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .13),
        borderRadius: BorderRadius.circular(7),
        border: Border.all(color: color.withValues(alpha: .32)),
      ),
      child: Text(text,
          style: TextStyle(
              fontSize: 9.5, fontWeight: FontWeight.w800, color: color)),
    );
  }

  Widget _row(Supp supp) {
    final on = enabled.contains(supp.id);
    final time = _timeOf(supp);
    final badge = _evidenceBadge(supp);
    return Container(
      margin: const EdgeInsets.only(bottom: 9),
      padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: on ? AppColors.nu.withValues(alpha: .38) : AppColors.line),
      ),
      child: Row(children: [
        Expanded(
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Flexible(
                    child: Text(supp.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w900, fontSize: 13.5)),
                  ),
                  const SizedBox(width: 6),
                  if (badge != null) badge,
                  IconButton(
                    onPressed: () => _info(supp),
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                    constraints:
                        const BoxConstraints(minWidth: 30, minHeight: 30),
                    icon: const Icon(Icons.error_outline_rounded,
                        size: 17, color: AppColors.nu),
                    tooltip: 'يعمل إيه؟',
                  ),
                  if (supp.custom)
                    IconButton(
                      onPressed: () => _remove(supp),
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                      constraints:
                          const BoxConstraints(minWidth: 30, minHeight: 30),
                      icon: const Icon(Icons.delete_outline_rounded,
                          size: 17, color: AppColors.muted),
                      tooltip: 'حذف',
                    ),
                ]),
                InkWell(
                  onTap: on ? () => _pickTime(supp) : null,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Text(
                      on
                          ? 'التذكير ${time.format(context)} · اضغط للتغيير'
                          : (supp.dose.isEmpty
                              ? 'الوقت المقترح ${time.format(context)}'
                              : '${supp.dose} · الوقت المقترح ${time.format(context)}'),
                      style: TextStyle(
                          color: on ? AppColors.nu : AppColors.muted,
                          fontSize: 11,
                          height: 1.4,
                          fontWeight:
                              on ? FontWeight.w800 : FontWeight.w500),
                    ),
                  ),
                ),
              ]),
        ),
        Switch(value: on, onChanged: (value) => _toggle(supp, value)),
      ]),
    );
  }
}
