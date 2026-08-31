// ── ElForma · screens/meal_plan_screen.dart ──
// Detailed meal-plan view: per-meal foods and macros from the nutrition engine.
// عرض خطة الوجبات بالتفصيل.

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:share_plus/share_plus.dart';
import '../api.dart';
import '../notification_service.dart';
import '../models/engine_contracts.dart';
import '../models/meal_display.dart';
import '../models/profile_store.dart';
import '../models/subscription_store.dart';
import '../models/plan_store.dart';
import '../models/plan_export.dart';
import '../theme.dart';
import 'pricing_screen.dart';
import 'food_picker_screen.dart';

class MealPlanScreen extends StatefulWidget {
  /// Optional: when this screen is the nutrition tab it resolves the shared
  /// profile itself, so it no longer depends on a parent page passing it in.
  final Map<String, dynamic>? profile;
  const MealPlanScreen({super.key, this.profile});

  @override
  State<MealPlanScreen> createState() => _MealPlanScreenState();
}

class _MealPlanScreenState extends State<MealPlanScreen> {
  bool _busy = true;
  String? _error;
  bool _locked = false;
  int _mealsTotal = 0;
  num _targetCalories = 0;
  num _planCalories = 0;
  num _planProtein = 0;
  num _planCarbs = 0;
  num _planFat = 0;
  List<NutritionMeal> _meals = const [];
  bool _canExport = false; // [بند 11] التصدير للمشتركين المدفوعين فقط.

  /// تشخيص المدرب لما التقدم يقف: ليه وقف، وإيه الخطوة الصح.
  /// فاضي لو المتدرب ماشي صح — مابنقلقهوش من غير سبب.
  Map<String, dynamic>? _diagnosis;

  /// قرار السعرات للأسبوع ده، وفيه blockedBy لو اتمنع تقليل الأكل.
  Map<String, dynamic>? _adjustment;

  /// The single source of truth for the profile, whether passed in or shared.
  Map<String, dynamic> get _profile =>
      widget.profile ?? ProfileStore.I.nutritionPayload();
  final Set<String> _expanded = {};
  final Set<String> _completed = {};
  int _waterMl = 0;
  bool _saving = false;
  // [بند 9] الافتراضي يوم النهاردة بس، مع خيار تصفّح اليوم السابق
  // وباقي أيام الأسبوع (تجهيز مقدمًا). التسجيل بيشتغل على النهاردة بس.
  int _dayOffset = 0;
  bool get _isToday => _dayOffset == 0;
  bool _showFullWeek = false; // [بند 5] إخفاء الأسبوع الكامل افتراضيًا
  // [OWNER-RULE] نخفي قائمة "أمس" للحسابات الجديدة
  bool _hasYesterdayData = false; // [FIX] مخفي حتى السيرفر يؤكد وجود بيانات أمس
  static const List<String> _weekdayNames = [
    'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'
  ];
  String _dayLabel(int offset) {
    if (offset == 0) return 'النهاردة';
    if (offset == -1) return 'أمس';
    if (offset == 1) return 'بكرة';
    final d = DateTime.now().add(Duration(days: offset));
    return _weekdayNames[d.weekday - 1];
  }

  @override
  void initState() {
    super.initState();
    ProfileStore.I.addListener(_onProfileChanged); // refresh when profile updates
    SubscriptionStore.I.addListener(_onSubChanged); // [FIX-3] refresh on subscription change
    _load();
  }

  void _onProfileChanged() { if (mounted) _load(); }
  void _onSubChanged() { if (mounted) _load(); } // [FIX-3]

  num _number(dynamic value) {
    if (value is num) return value;
    return num.tryParse('$value') ?? 0;
  }

  /// Re-uploads the locally cached profile when the server has lost it.
  ///
  /// The nutrition endpoint answers `profile_required` when there is no saved
  /// profile row for the account, which is what put a raw English error code
  /// on this screen while the workout tab kept working from its local cache.
  /// The phone already holds the full profile, so the honest fix is to put it
  /// back rather than ask the user to fill the questionnaire in again.
  Future<bool> _restoreProfileFromCache() async {
    await ProfileStore.I.ensureLoaded();
    final cached = ProfileStore.I.profile;
    if (cached == null || cached.isEmpty) return false;
    final response = await Api.I.saveMobileProfile(cached);
    return response.ok;
  }

  Future<void> _load({bool recovering = false}) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    // Unified source of truth: BOTH the diet tab and this editor now read the
    // exact same engine plan from /api/mobile/nutrition-plan — built from the
    // saved living profile, the pantry, health filters and auto-Ramadan. The
    // old planCompute path used a stripped profile with no pantry, so the two
    // screens showed different meals. They no longer diverge.
    // [بند 9] نحمّل خطة اليوم حسب الإزاحة المختارة. بيانات التسجيل
    // (المية والوجبات المكملة) ليوم النهاردة بس، فباقي الأيام معاينة.
    final isToday = _dayOffset == 0;
    final response = await Api.I.nutritionPlan(withMeals: true, dayOffset: _dayOffset);
    final bootstrap = isToday ? await Api.I.mobileBootstrap() : null;
    if (!mounted) return;
    // [OWNER-RULE] لو السيرفر بيقول مافيشش بيانات أمس → روح ليوم التالي وأخفي التبويب
    if (response.ok && response.data['noYesterdayData'] == true) {
      setState(() { _hasYesterdayData = false; _dayOffset = 0; _busy = false; });
      _load();
      return;
    }
    if (!response.ok || response.data['plan'] is! Map) {
      final code = response.error;

      // Self-heal once, silently, before showing the user any failure.
      if (!recovering && code.contains('profile_required')) {
        if (await _restoreProfileFromCache()) {
          if (!mounted) return;
          return _load(recovering: true);
        }
      }

      setState(() {
        _busy = false;
        _error = _friendlyError(code);
      });
      return;
    }

    final plan = Map<String, dynamic>.from(response.data['plan'] as Map);
    final rawMeals = plan['meals'] is List ? plan['meals'] as List : const [];
    final meals = <NutritionMeal>[];
    for (var i = 0; i < rawMeals.length; i++) {
      if (rawMeals[i] is Map) meals.add(NutritionMeal.fromJson(rawMeals[i] as Map, i));
    }
    final totals = plan['totals'] is Map ? plan['totals'] as Map : const {};
    final targets = response.data['targets'] is Map ? response.data['targets'] as Map : const {};
    final saved = (isToday && bootstrap != null && bootstrap.data['nutritionToday'] is Map)
        ? bootstrap.data['nutritionToday'] as Map
        : const {};
    final savedMeals = saved['meals'] is List ? saved['meals'] as List : const [];
    final editableMeals = <NutritionMeal>[];
    if (savedMeals.isNotEmpty) {
      for (var i = 0; i < savedMeals.length; i++) {
        if (savedMeals[i] is Map) {
          editableMeals.add(NutritionMeal.fromJson(savedMeals[i] as Map, i));
        }
      }
    }

    // التشخيص بيوصل جوا periodization مع خطة التغذية.
    final periodization = response.data['periodization'] is Map
        ? Map<String, dynamic>.from(response.data['periodization'] as Map)
        : const <String, dynamic>{};
    final diagnosis = periodization['diagnosis'] is Map
        ? Map<String, dynamic>.from(periodization['diagnosis'] as Map)
        : null;
    final adjustment = periodization['adjustment'] is Map
        ? Map<String, dynamic>.from(periodization['adjustment'] as Map)
        : null;

    // [بند 11] بوابة التصدير: مشترك مدفوع نشط فقط (مش مجاني/تجربة).
    // لو مفيش bootstrap (معاينة يوم تاني) نسيب الحالة زي ما هي.
    if (bootstrap != null && bootstrap.data['subscription'] is Map) {
      final sub = bootstrap.data['subscription'] as Map;
      _canExport = sub['canExport'] == true;
      SubscriptionStore.I.applyFromBootstrap(bootstrap.data.cast<String, dynamic>());
    }
    setState(() {
      // nutrition-plan never locks the editor (unlike the old preview gate).
      _locked = response.data['locked'] == true;
      _diagnosis = diagnosis;
      _adjustment = adjustment;
      _meals = (editableMeals.isNotEmpty ? editableMeals : meals)
          .map((m) => m.withFoods(expandCondiments(m.foods)))
          .toList();
      _mealsTotal = _number(plan['mealsTotal']).toInt();
      if (_mealsTotal <= 0) _mealsTotal = meals.length;
      _targetCalories = _number(plan['targetCals']);
      if (_targetCalories <= 0) _targetCalories = _number(targets['targetCals']);
      _planCalories = _number(totals['cals']);
      _planProtein = _number(totals['pro']);
      _planCarbs = _number(totals['carb']);
      _planFat = _number(totals['fat']);
      if (meals.isNotEmpty) _expanded.add(meals.first.key);
      _waterMl = _number(saved['waterMl']).toInt();
      _completed
        ..clear()
        ..addAll(savedMeals.whereType<Map>()
            .where((meal) => meal['completed'] == true)
            .map((meal) => (meal['key'] ?? '').toString())
            .where((key) => key.isNotEmpty));
      if (editableMeals.isNotEmpty) _recalculate();
      _busy = false;
    });

    // [EGY-v70] توقيت التذكيرات على ساعة بلد الحساب مش القاهرة (السيرفر بيحسبها من ال IP).
    final tzName = response.data['timezone'];
    if (tzName is String && tzName.isNotEmpty) {
      await NotificationService.I.setLocation(tzName);
    }

    // تنبيه لكل وجبة: مواعيدها بتتولد من خطة المستخدم نفسها مش من ميعاد ثابت.
    // بنجدول التذكيرات على خطة يوم النهاردة بس — مش على أيام المعاينة.
    if (isToday) await _syncMealReminders(_meals.isNotEmpty ? _meals : meals);
  }

  /// بيوزع وجبات الخطة على اليوم ويحفظها لشاشة التذكيرات، ويجدول
  /// تنبيه مستقل لكل وجبة لو المستخدم مفعل تذكير الوجبات.
  /// المستخدم يقدر يغير أي ميعاد من شاشة التذكيرات ومابندوسش عليه.
  Future<void> _syncMealReminders(List<NutritionMeal> meals) async {
    if (meals.isEmpty) return;
    // مواعيد منطقية لكل خانة — وقبل التمرين مربوطة بميعاد تمرين المستخدم.
    const slotHours = <String, List<int>>{
      'breakfast': [8, 0],
      'snack': [11, 30],
      'pre': [16, 30],
      'lunch': [14, 0],
      'post': [19, 30],
      'dinner': [20, 30],
    };
    final sp = await SharedPreferences.getInstance();
    final existing = sp.getString('reminder_meal_slots') ?? '';
    // لو المستخدم عدل ميعاد قبل كده، نحترم تعديله ومانرجعهوش للافتراضي.
    final previous = <String, List<int>>{};
    for (final part in existing.split(';')) {
      final bits = part.split('|');
      if (bits.length < 2) continue;
      final hm = bits[1].split(':');
      if (hm.length != 2) continue;
      final h = int.tryParse(hm[0]), m = int.tryParse(hm[1]);
      if (h != null && m != null) previous[bits[0]] = [h, m];
    }

    final slots = <Map<String, dynamic>>[];
    for (final meal in meals) {
      final label = meal.name.trim().isEmpty ? 'وجبة' : meal.name.trim();
      final base = previous[label] ?? slotHours[meal.key] ?? const [12, 0];
      slots.add({
        'label': label,
        'hour': base[0],
        'minute': base[1],
        'cals': meal.calories.round(),
      });
    }
    slots.sort((a, b) => ((a['hour'] as int) * 60 + (a['minute'] as int))
        .compareTo((b['hour'] as int) * 60 + (b['minute'] as int)));

    await sp.setString(
      'reminder_meal_slots',
      slots
          .map((m) => '${m['label']}|${m['hour']}:${m['minute']}|${m['cals']}')
          .join(';'),
    );
    if (sp.getBool('reminder_meals') == true) {
      await NotificationService.I.scheduleMeals(true, meals: slots);
    }
  }

  /// Never show a raw server code to a user. `profile_required` and
  /// `profile_incomplete` used to render as-is, in English, on an Arabic
  /// screen with no way forward.
  String _friendlyError(String code) {
    if (code.contains('profile_required') ||
        code.contains('profile_incomplete')) {
      return 'محتاجين نكمل بياناتك الأو عشان نحسب سعراتك صح';
    }
    return code.isNotEmpty ? code : 'تعذر تحميل الخطة حاول تاني';
  }

  void _recalculate() {
    _planCalories = _meals.fold<num>(0, (sum, meal) => sum + meal.calories);
    _planProtein = _meals.fold<num>(0, (sum, meal) => sum + meal.protein);
    _planCarbs = _meals.fold<num>(0, (sum, meal) => sum + meal.carbs);
    _planFat = _meals.fold<num>(0, (sum, meal) => sum + meal.fat);
    PlanStore.I.markChanged(); // notify HomeScreen of meal plan update
  }

  Future<void> _saveDay() async {
    // [بند 9] أيام المعاينة للعرض بس — مابنسجلش عليها.
    if (!_isToday) return;
    if (_saving) return;
    setState(() => _saving = true);
    final response = await Api.I.saveNutritionDay({
      'calories': _planCalories,
      'protein': _planProtein,
      'carbs': _planCarbs,
      'fat': _planFat,
      'waterMl': _waterMl,
      'meals': _meals.map((meal) => meal.toJson(completed: _completed.contains(meal.key))).toList(),
    });
    if (!mounted) return;
    setState(() => _saving = false);
    if (!response.ok) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(response.error.isNotEmpty ? response.error : 'تعذر حفظ يومك')));
    }
  }

  Future<void> _pickFood(NutritionMeal meal, {int? replaceIndex}) async {
    final food = await Navigator.of(context).push<NutritionFoodItem>(MaterialPageRoute(
      builder: (_) => FoodPickerScreen(
        diet: (_profile['selectedDiet'] ?? 'balanced').toString(),
        health: _profile['healthConditions'] is List
            ? (_profile['healthConditions'] as List).whereType<String>().toList()
            : const [],
        replacementTarget: replaceIndex != null && replaceIndex >= 0 && replaceIndex < meal.foods.length
            ? meal.foods[replaceIndex]
            : null,
      ),
    ));
    if (food == null || !mounted) return;
    final foods = meal.foods.toList();
    final replacing =
        replaceIndex != null && replaceIndex >= 0 && replaceIndex < foods.length;

    // How many calories are actually free right now. When replacing an item,
    // the calories it currently occupies are freed up first.
    final freed = replacing ? foods[replaceIndex].calories : 0;
    final room = _targetCalories - _planCalories + freed;

    // If the chosen food does not fit, shrink the portion instead of breaking
    // the day's target. The floor is 25% of the requested portion: below that
    // the item stops resembling what the user picked, so it is better to add
    // it honestly and let the overage show than to serve a token crumb.
    var chosen = food;
    var trimmed = false;
    var overflow = false;
    if (_targetCalories > 0 && food.calories > 0 && room < food.calories) {
      final factor = room <= 0 ? 0.0 : room / food.calories;
      if (factor >= 0.25) {
        chosen = food.scaledToFit(factor);
        trimmed = chosen.grams < food.grams;
      } else {
        // مافيش مكان حقيقي: نقولها صريح بدل ما يعدي الصنف في السر.
        overflow = true;
      }
    }

    if (replacing) {
      foods[replaceIndex] = chosen;
    } else {
      foods.add(chosen);
    }
    final index = _meals.indexWhere((item) => item.key == meal.key);
    if (index < 0) return;
    setState(() {
      _meals[index] = meal.withFoods(foods);
      _recalculate();
    });
    if (overflow && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('ضفناه بالكامل وهيعدي هدفك ب ${(_planCalories - _targetCalories).round()} سعرة - شوف لو تحب تقلل صنف تاني'),
      ));
    }
    if (trimmed && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(
            'ظبطنا الكمية ل ${chosen.grams.round()} جم عشان تفضل جوا سعرات يومك'),
      ));
    }
    await _saveDay();
  }

  Future<void> _removeFood(NutritionMeal meal, int foodIndex) async {
    final foods = meal.foods.toList()..removeAt(foodIndex);
    await _applyFoods(meal, foods);
  }

  /// طبق السلطة مدموج من كام خضرة في الوجبة، فحذفه = حذف كل أجزائه.
  Future<void> _removeSalad(NutritionMeal meal) async {
    final foods = meal.foods.where((f) => !isSaladItem(f)).toList();
    if (foods.length == meal.foods.length) return;
    await _applyFoods(meal, foods);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('شيلنا طبق السلطة من الوجبة')));
    }
  }

  /// تعديل كمية صنف واحد بالجرامات.
  Future<void> _editGrams(
      NutritionMeal meal, int foodIndex, NutritionFoodItem item) async {
    final grams = await _askGrams(item.name, item.grams);
    if (grams == null) return;
    final foods = meal.foods.toList();
    foods[foodIndex] = item.atGrams(grams);
    await _applyFoods(meal, foods);
  }

  /// تعديل كمية الطبق كله: بنوزع الفرق على كل خضرة بنفس النسبة.
  Future<void> _editSaladGrams(
      NutritionMeal meal, NutritionFoodItem plate) async {
    final grams = await _askGrams('طبق السلطة', plate.grams);
    if (grams == null || plate.grams <= 0) return;
    final factor = grams / plate.grams;
    final foods = meal.foods.toList();
    for (final i in saladIndexes(foods)) {
      foods[i] = foods[i].atGrams(foods[i].grams * factor);
    }
    await _applyFoods(meal, foods);
  }

  Future<num?> _askGrams(String name, num current) async {
    final controller =
        TextEditingController(text: current.round().toString());
    final value = await showDialog<num>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text('كمية $name',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              autofocus: true,
              decoration: const InputDecoration(
                suffixText: 'جم',
                labelText: 'الكمية بالجرام',
              ),
            ),
            const SizedBox(height: 10),
            const Text('الكمية بتتقرب لأقرب 5 جم والسعرات بتتحسب تلقائي',
                style: TextStyle(color: AppColors.muted, fontSize: 11.5)),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('إلغاء')),
          FilledButton(
            onPressed: () {
              final parsed = num.tryParse(controller.text.trim());
              Navigator.of(dialogContext)
                  .pop(parsed != null && parsed > 0 ? parsed : null);
            },
            child: const Text('تمام'),
          ),
        ],
      ),
    );
    return value;
  }

  Future<void> _applyFoods(
      NutritionMeal meal, List<NutritionFoodItem> foods) async {
    final index = _meals.indexWhere((item) => item.key == meal.key);
    if (index < 0) return;
    setState(() {
      _meals[index] = meal.withFoods(foods);
      _recalculate();
    });
    await _saveDay();
  }

  Future<void> _toggleCompleted(NutritionMeal meal) async {
    setState(() => _completed.contains(meal.key)
        ? _completed.remove(meal.key)
        : _completed.add(meal.key));
    await _saveDay();
  }

  Future<void> _addWater(int amount) async {
    setState(() => _waterMl = (_waterMl + amount).clamp(0, 10000).toInt());
    await _saveDay();
  }

  // [بند 11] تحميل نسخة رسمية احترافية من خطة التغذية (HTML تتطبع/تتحفظ PDF).
  Future<void> _downloadPlan() async {
    if (_meals.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('احفظ خطة تغذيتك الأول قبل ما تحملها')));
      return;
    }
    try {
      final prof = ProfileStore.I.profile ?? const <String, dynamic>{};
      final trainee = (prof['name'] ?? '').toString();
      final mealsData = _meals.map((m) {
        final shown = displayFoods(m.foods);
        num mealCals = 0;
        final foods = shown.map((f) {
          mealCals += f.calories;
          return <String, dynamic>{
            'name': f.name,
            'grams': f.grams,
            'cals': f.calories,
          };
        }).toList();
        return <String, dynamic>{
          'name': m.name,
          'cals': mealCals,
          'foods': foods,
        };
      }).toList();
      final html = PlanExport.nutritionHtml(
        meals: mealsData,
        dayLabel: _dayLabel(_dayOffset),
        targetCalories: _targetCalories,
        trainee: trainee,
        profile: prof,
      );
      await PlanExport.download(
        html: html,
        baseName: 'elforma-nutrition-plan',
        shareText: 'خطة تغذيتي من تطبيق الفورمة',
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('تعذر حفظ الملف — حاول تاني')));
    }
  }

  // مشاركة خطة التغذية برابط مؤقت.
  Future<void> _sharePlan() async {
    final r = await Api.I.sharePlan(planType: 'nutrition');
    if (!mounted) return;
    final url = r.data['url']?.toString() ?? '';
    if (r.ok && url.isNotEmpty) {
      await Share.share('شوف خطة الوجبات بتاعتي على تطبيق الفورمة:\n$url',
          subject: 'خطة وجباتي - ElForma');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(r.friendlyError('احفظ خطة تغذيتك الأول قبل ما تشاركها'))));
    }
  }

  @override
  void dispose() {
    ProfileStore.I.removeListener(_onProfileChanged);
    SubscriptionStore.I.removeListener(_onSubChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        title: const Text('خطة وجباتك', style: TextStyle(fontWeight: FontWeight.w900)),
        centerTitle: true,
        actions: [
          if (_canExport)
            IconButton(
              tooltip: 'شارك خطة وجباتك برابط',
              icon: const Icon(Icons.ios_share_rounded, color: AppColors.nu2),
              onPressed: _sharePlan,
            ),
          if (_canExport)
            IconButton(
              tooltip: 'حمل نسخة رسمية من خطتك',
              icon: const Icon(Icons.download_rounded, color: AppColors.nu2),
              onPressed: _downloadPlan,
            ),
        ],
        // No second nutrition page. This screen is the single source of truth
        // for the day's food, so there is nowhere else to navigate to and no
        // way for two screens to disagree about what the plan is.
      ),
      body: _busy
          ? const Center(child: CircularProgressIndicator(color: AppColors.nu))
          : _error != null
              ? _errorView()
              : _content(),
    );
  }

  Widget _errorView() => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.error_outline, color: AppColors.wo2, size: 44),
            const SizedBox(height: 14),
            Text(_error!, textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, height: 1.6)),
            const SizedBox(height: 18),
            FilledButton(
              style: FilledButton.styleFrom(
                  backgroundColor: AppColors.nu,
                  foregroundColor: const Color(0xFF04231B)),
              onPressed: _load,
              child: const Text('إعادة المحاولة'),
            ),
          ]),
        ),
      );

  Widget _content() {
    final remaining = (_mealsTotal - _meals.length).clamp(0, 99);
    // بنبنيه مرة واحدة بس مش مرتين في نفس الرسمة.
    final diagnosisCard = _diagnosisCard();
    return RefreshIndicator(
      color: AppColors.nu,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 36),
        children: [
          if (diagnosisCard != null) ...[
            diagnosisCard,
            const SizedBox(height: 12),
          ],
          _daySelector(),
          const SizedBox(height: 12),
          if (!_isToday) ...[
            _previewBanner(),
            const SizedBox(height: 12),
          ],
          _dailySummary(),
          const SizedBox(height: 12),
          if (_isToday) ...[
            _waterTracker(),
            const SizedBox(height: 20),
          ] else
            const SizedBox(height: 8),
          Row(children: [
            const Expanded(child: Text('وجبات اليوم',
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900))),
            Text('${_meals.length} من $_mealsTotal',
                style: const TextStyle(color: AppColors.muted, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 10),
          ..._meals.map(_mealCard),
          if (_locked && remaining > 0) _lockedCard(remaining),
        ],
      ),
    );
  }

  // [بند 5] تنقل سريع: أمس ← النهاردة ← بكره — بدون عرض الأسبوع كامل.
  // زر منفصل "تجهيز مبكر" يفتح باقي الأيام لمن يريد التخطيط المسبق.
  Widget _daySelector() {
    // الأيام الأساسية الثلاثة فقط (prev / today / next)
    // [OWNER-RULE] إذا مافيشش بيانات أمس — خفي التبويب وريّح باليومين بس
    final coreOffsets = _hasYesterdayData ? [-1, 0, 1] : [0, 1];
    final todayRow = Row(
      children: [
        ...coreOffsets.map((off) {
          final d = DateTime.now().add(Duration(days: off)); // [FIX] تعريف d لكل offset
          final sel = off == _dayOffset;
          return Expanded(
            child: Padding(
              padding: EdgeInsets.only(left: off == coreOffsets.last ? 0 : 6),
              child: InkWell(
                onTap: _busy ? null : () {
                  setState(() { _dayOffset = off; _showFullWeek = false; });
                  _load();
                },
                borderRadius: BorderRadius.circular(14),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  height: 58,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: sel ? AppColors.nu.withValues(alpha: .16) : AppColors.card,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                        color: sel ? AppColors.nu.withValues(alpha: .60) : AppColors.line,
                        width: sel ? 1.5 : 1.0),
                  ),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(_dayLabel(off),
                        style: TextStyle(
                            color: sel ? AppColors.nu2 : AppColors.text,
                            fontWeight: FontWeight.w900,
                            fontSize: 13)),
                    const SizedBox(height: 3),
                    Text('${d.day}/${d.month}', // [FIX] تفعيل التحويل الحقيقي
                        style: TextStyle(
                            color: sel ? AppColors.nu2.withValues(alpha:.7) : AppColors.muted,
                            fontSize: 11)),
                  ]),
                ),
              ),
            ),
          );
        }),
      ],
    );

    // صف الأسبوع الكامل (يظهر فقط عند الضغط على "تجهيز مبكر")
    final weekRow = _showFullWeek
        ? Padding(
            padding: const EdgeInsets.only(top: 8),
            child: SizedBox(
              height: 58,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: 5, // غد+2 حتى +5 أيام قادمة
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final off = i + 2; // من +2 لـ +6
                  final d = DateTime.now().add(Duration(days: off)); // [FIX] d لكل offset
                  final sel = off == _dayOffset;
                  return InkWell(
                    onTap: _busy ? null : () { setState(() => _dayOffset = off); _load(); },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      width: 62,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: sel ? AppColors.nu.withValues(alpha: .14) : AppColors.card,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: sel ? AppColors.nu.withValues(alpha: .50) : AppColors.line),
                      ),
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Text(_dayLabel(off),
                            style: TextStyle(
                                color: sel ? AppColors.nu2 : AppColors.text,
                                fontWeight: FontWeight.w900, fontSize: 12)),
                        const SizedBox(height: 3),
                        Text('${d.day}/${d.month}', // [FIX] تحويل حقيقي
                            style: const TextStyle(color: AppColors.muted, fontSize: 10.5)),
                      ]),
                    ),
                  );
                },
              ),
            ),
          )
        : const SizedBox.shrink();

    // زر "تجهيز مبكر" صغير وأنيق
    final prepBtn = GestureDetector(
      onTap: () => setState(() => _showFullWeek = !_showFullWeek),
      child: Container(
        margin: const EdgeInsets.only(top: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: _showFullWeek
              ? AppColors.nu.withValues(alpha: .12)
              : AppColors.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: _showFullWeek
                  ? AppColors.nu.withValues(alpha: .45)
                  : AppColors.line),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(
            _showFullWeek ? Icons.expand_less_rounded : Icons.calendar_view_week_rounded,
            size: 15,
            color: _showFullWeek ? AppColors.nu2 : AppColors.muted,
          ),
          const SizedBox(width: 5),
          Text(
            _showFullWeek ? 'إخفاء' : 'تجهيز مبكر',
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: _showFullWeek ? AppColors.nu2 : AppColors.muted),
          ),
        ]),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [todayRow, weekRow, Align(alignment: Alignment.centerRight, child: prepBtn)],
    );
  }

  Widget _previewBanner() {
    final d = DateTime.now().add(Duration(days: _dayOffset));
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.nu.withValues(alpha: .10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.nu.withValues(alpha: .3)),
      ),
      child: Row(children: [
        const Icon(Icons.visibility_outlined, color: AppColors.nu2, size: 18),
        const SizedBox(width: 8),
        Expanded(
          child: Text('معاينة يوم ${_dayLabel(_dayOffset)} (${d.day}/${d.month}) — التسجيل بيشتغل على يوم النهاردة بس',
              style: const TextStyle(color: AppColors.nu2, fontSize: 12, height: 1.4)),
        ),
      ]),
    );
  }

  Widget _waterTracker() {
    final progress = (_waterMl / 2500).clamp(0.0, 1.0);
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(17),
          border: Border.all(color: const Color(0xFF42A5F5).withValues(alpha: .35))),
      child: Column(children: [
        Row(children: [
          const Icon(Icons.water_drop_rounded, color: Color(0xFF42A5F5)),
          const SizedBox(width: 8),
          const Expanded(child: Text('مياه اليوم', style: TextStyle(fontWeight: FontWeight.w900))),
          Text('${(_waterMl / 1000).toStringAsFixed(1)} / 2.5 لتر',
              style: const TextStyle(color: Color(0xFF42A5F5), fontWeight: FontWeight.w900)),
        ]),
        const SizedBox(height: 10),
        LinearProgressIndicator(value: progress, minHeight: 7, borderRadius: BorderRadius.circular(8),
            color: const Color(0xFF42A5F5), backgroundColor: AppColors.line),
        const SizedBox(height: 8),
        Row(mainAxisAlignment: MainAxisAlignment.end, children: [
          TextButton(onPressed: _saving ? null : () => _addWater(-250), child: const Text('- كوب')),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF42A5F5)),
            onPressed: _saving ? null : () => _addWater(250),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('كوب 250 مل'),
          ),
        ]),
      ]),
    );
  }

  /// كارت التشخيص: يظهر بس لما التقدم يقف فعلا.
  /// فلسفته: مايقولش «ثبات وزن» ويسكت، يقول ليه وقف وإيه أول خطوة.
  Widget? _diagnosisCard() {
    final dx = _diagnosis;
    if (dx == null || dx['stalled'] != true) return null;
    final primary = dx['primary'] is Map
        ? Map<String, dynamic>.from(dx['primary'] as Map)
        : null;
    if (primary == null) return null;

    final finding = '${primary['findingAr'] ?? ''}';
    final action = '${primary['actionAr'] ?? ''}';
    final label = '${primary['labelAr'] ?? ''}';
    final lowConfidence = '${dx['confidence']}' == 'low';

    // الأسباب التانية المحتملة، مرتبة بالقوة.
    final rest = <String>[];
    if (dx['causes'] is List) {
      for (final c in (dx['causes'] as List).whereType<Map>().skip(1)) {
        final l = '${c['labelAr'] ?? ''}';
        if (l.isNotEmpty) rest.add(l);
      }
    }

    // لو السيستم منع تقليل السعرات، المتدرب من حقه يعرف إن ده قرار مقصود.
    final blocked = _adjustment != null &&
        '${_adjustment!['blockedBy'] ?? ''}'.isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.wo.withValues(alpha: .34)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.troubleshoot_rounded,
              color: AppColors.wo, size: 18),
          const SizedBox(width: 7),
          const Expanded(
            child: Text('التقدم واقف وده السبب الأرجح',
                style:
                    TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5)),
          ),
          if (label.isNotEmpty)
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.wo.withValues(alpha: .14),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(label,
                  style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: AppColors.wo)),
            ),
        ]),
        if (finding.isNotEmpty) ...[
          const SizedBox(height: 11),
          Text(finding,
              style: const TextStyle(fontSize: 12.5, height: 1.6)),
        ],
        if (action.isNotEmpty) ...[
          const SizedBox(height: 9),
          Container(
            padding: const EdgeInsets.all(11),
            decoration: BoxDecoration(
              color: AppColors.nu.withValues(alpha: .08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.arrow_forward_rounded,
                  size: 15, color: AppColors.nu),
              const SizedBox(width: 7),
              Expanded(
                child: Text(action,
                    style: const TextStyle(fontSize: 12, height: 1.6)),
              ),
            ]),
          ),
        ],
        if (blocked) ...[
          const SizedBox(height: 9),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.shield_rounded,
                size: 14, color: AppColors.nu2),
            const SizedBox(width: 6),
            const Expanded(
              child: Text(
                  'ماقللناش سعراتك الأسبوع ده عن قصد السبب مش الأكل وتقليله كان هيزود المشكلة',
                  style: TextStyle(
                      fontSize: 11, height: 1.5, color: AppColors.nu2)),
            ),
          ]),
        ],
        if (lowConfidence) ...[
          const SizedBox(height: 9),
          const Text(
              'ملحوظة: البيانات لسة قليلة فده ترجيح مش تأكيد',
              style: TextStyle(fontSize: 10.5, color: AppColors.muted)),
        ],
        if (rest.isNotEmpty) ...[
          const SizedBox(height: 11),
          Text('احتمالات تانية: ${rest.take(3).join(' · ')}',
              style: const TextStyle(
                  fontSize: 10.5, color: AppColors.muted, height: 1.5)),
        ],
      ]),
    );
  }

  Widget _dailySummary() {
    // Same source as the nutrition headline, so both screens always agree.
    // الرقم الكبير لازم يتحرك لما تحذف أو تضيف صنف.
    // قبل كده كان بيعرض الهدف دائما فماكانش بي����غير أبدا.
    final calories = _planCalories;
    final target = _targetCalories;
    final over = target > 0 && calories > target;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [AppColors.nu, AppColors.nu2],
        ),
      ),
      child: Column(children: [
        Text(target > 0 ? 'سعرات خطتك من أصل ${target.round()} سعرة' : 'إجمالي يومك',
            style: const TextStyle(color: Color(0xFF04231B), fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text('${calories.round()}',
            style: const TextStyle(color: Color(0xFF04231B), fontSize: 42, fontWeight: FontWeight.w900)),
        Text(
            target <= 0
                ? 'سعرة حرارية'
                : over
                    ? 'زايد ${(calories - target).round()} سعرة عن هدفك'
                    : 'فاضلك ${(target - calories).round()} سعرة',
            style: const TextStyle(color: Color(0xFF164B40))),
        if (_planProtein > 0 || _planCarbs > 0 || _planFat > 0) ...[
          const SizedBox(height: 16),
          Row(children: [
            _summaryMacro('بروتين', _planProtein),
            _summaryMacro('كارب', _planCarbs),
            _summaryMacro('دهون', _planFat),
          ]),
        ],
      ]),
    );
  }

  Widget _summaryMacro(String label, num value) => Expanded(
        child: Column(children: [
          Text('${value.round()} جم',
              style: const TextStyle(color: Color(0xFF04231B), fontWeight: FontWeight.w900)),
          Text(label, style: const TextStyle(color: Color(0xFF164B40), fontSize: 11)),
        ]),
      );



  Widget _mealCard(NutritionMeal meal) {
    final isOpen = _expanded.contains(meal.key);
    final done = _completed.contains(meal.key);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(19),
        border: Border.all(color: isOpen ? AppColors.nu.withValues(alpha: .55) : AppColors.line),
      ),
      child: Column(children: [
        InkWell(
          borderRadius: BorderRadius.circular(19),
          onTap: () => setState(() { if (isOpen) { _expanded.remove(meal.key); } else { _expanded..clear()..add(meal.key); } }),
          child: Padding(
            padding: const EdgeInsets.all(15),
            child: Row(children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                    color: AppColors.nu.withValues(alpha: .14),
                    borderRadius: BorderRadius.circular(13)),
                child: const Icon(Icons.restaurant_menu_rounded, color: AppColors.nu),
              ),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(meal.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                Text('${displayFoods(meal.foods).length} أصناف · ${meal.calories.round()} سعرة',
                    style: const TextStyle(color: AppColors.muted, fontSize: 12)),
              ])),
              Icon(isOpen ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                  color: AppColors.nu),
            ]),
          ),
        ),
        if (isOpen) ...[
          const Divider(height: 1, color: AppColors.line),
          Padding(
            padding: const EdgeInsets.fromLTRB(15, 12, 15, 6),
            child: Row(children: [
              _macroChip('P', meal.protein, AppColors.nu),
              _macroChip('C', meal.carbs, const Color(0xFF64B5F6)),
              _macroChip('F', meal.fat, AppColors.wo2),
            ]),
          ),
          if (meal.description.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(15, 5, 15, 5),
              child: Align(alignment: Alignment.centerRight,
                  child: Text(meal.description,
                      style: const TextStyle(color: AppColors.muted, fontSize: 12))),
            ),
          if (meal.foods.isEmpty)
            const Padding(
              padding: EdgeInsets.all(18),
              child: Text('لا توجد أصناف داخل هذه الوجبة',
                  style: TextStyle(color: AppColors.muted)),
            )
          else
            // Salad vegetables are shown as one «سلطة» plate, like the website.
            ...displayFoods(meal.foods)
                .map((item) => _foodRow(meal, meal.foods.indexOf(item), item)),
          Padding(
            padding: const EdgeInsets.fromLTRB(15, 8, 15, 14),
            child: Row(children: [
              Expanded(child: OutlinedButton.icon(
                onPressed: () => _pickFood(meal),
                icon: const Icon(Icons.add_rounded),
                label: const Text('إضافة طعام'),
              )),
              const SizedBox(width: 8),
              Expanded(child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: done ? AppColors.nu : AppColors.card2,
                  foregroundColor: done ? const Color(0xFF04231B) : AppColors.text,
                  side: BorderSide(color: done ? AppColors.nu : AppColors.line),
                ),
                onPressed: _saving ? null : () => _toggleCompleted(meal),
                icon: Icon(done ? Icons.check_circle : Icons.circle_outlined),
                label: Text(done ? 'تمت الوجبة' : 'أكملت الوجبة'),
              )),
            ]),
          ),
          const SizedBox(height: 8),
        ],
      ]),
    );
  }

  Widget _macroChip(String label, num value, Color color) => Expanded(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 3),
          padding: const EdgeInsets.symmetric(vertical: 7),
          alignment: Alignment.center,
          decoration: BoxDecoration(color: color.withValues(alpha: .10), borderRadius: BorderRadius.circular(9)),
          child: Text('$label ${value.toStringAsFixed(1)}g',
              style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w800)),
        ),
      );

  Widget _foodRow(NutritionMeal meal, int index, NutritionFoodItem item) {
    // العناصر المركبة (زيت/زبدة) بقت أصناف حقيقية منفصلة تتعرض متبوّظة بعلامة +
    final bool addon = item.isAddon;
    return Padding(
        padding: EdgeInsets.only(
            right: addon ? 34 : 15, left: 15, top: addon ? 2 : 9, bottom: addon ? 6 : 9),
        child: Row(children: [
          Icon(addon ? Icons.add_rounded : Icons.circle,
              size: addon ? 12 : 6, color: addon ? AppColors.muted : AppColors.nu),
          const SizedBox(width: 9),
          Expanded(
            child: Text(item.name,
                style: TextStyle(
                    color: addon ? AppColors.muted : AppColors.text,
                    fontWeight: addon ? FontWeight.w600 : FontWeight.w700,
                    fontSize: addon ? 13 : 14)),
          ),
          // سعرات + وزن (ل�� مفيش مكمل بيظهر الوزن)
          SizedBox(
            width: 74,
            child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('${item.grams.round()} جم',
                  style: TextStyle(
                      color: addon ? AppColors.muted : AppColors.text,
                      fontSize: 12, fontWeight: FontWeight.w700)),
              Text('${item.calories.round()} سعرة',
                  style: const TextStyle(color: AppColors.muted, fontSize: 10)),
            ]),
          ),
          // صف السلطة مالوش صنف واحد في المحرك (مدموج من كام خضرة)،
          // وقبل كده كان مالوش قائمة خالص فماكان�� فيه طريقة تحذفه
          // أو تعدل كميته. دلوقتي ليه قائمة بتش��ل أو تعدل كل أجزائه مع بعض.
          if (index >= 0)
            SizedBox(
              width: 40,
              child: PopupMenuButton<String>(
                padding: EdgeInsets.zero,
                icon: const Icon(Icons.more_vert, color: AppColors.muted, size: 20),
                onSelected: (value) {
                  if (value == 'replace') _pickFood(meal, replaceIndex: index);
                  if (value == 'grams') _editGrams(meal, index, item);
                  if (value == 'remove') _removeFood(meal, index);
                },
                itemBuilder: (_) => [
                  if (!addon)
                    const PopupMenuItem(value: 'replace', child: Text('استبدال الصنف')),
                  const PopupMenuItem(value: 'grams', child: Text('تعديل الكمية')),
                  const PopupMenuItem(value: 'remove', child: Text('حذف الصنف')),
                ],
              ),
            )
          else if (isSaladItem(item))
            SizedBox(
              width: 40,
              child: PopupMenuButton<String>(
                padding: EdgeInsets.zero,
                icon: const Icon(Icons.more_vert, color: AppColors.muted, size: 20),
                onSelected: (value) {
                  if (value == 'saladGrams') _editSaladGrams(meal, item);
                  if (value == 'saladAdd')   _addToSalad(meal);
                  if (value == 'saladRemove') _removeSalad(meal);
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'saladGrams', child: Text('تعديل كمية السلطة')),
                  PopupMenuItem(value: 'saladAdd',   child: Text('إضافة عنصر للسلطة')),
                  PopupMenuItem(value: 'saladRemove', child: Text('حذف طبق السلطة')),
                ],
              ),
            )
          else
            const SizedBox(width: 40),
        ]),
      );
  }

  // === [EGY-v72] إضافة عنصر للسلطة ===
  static const List<Map<String, dynamic>> _saladAddables = [
    { 'id': 'khyar', 'name': 'خيار',       'cal': 16,  'pro': 0.7, 'carb': 3.6, 'fat': 0.1 },
    { 'id': 'tmatm', 'name': 'طماطم',      'cal': 18,  'pro': 0.9, 'carb': 3.9, 'fat': 0.2 },
    { 'id': 'jzr',   'name': 'جزر',        'cal': 41,  'pro': 0.9, 'carb': 10,  'fat': 0.2 },
    { 'id': 'bsl',   'name': 'بصل',        'cal': 40,  'pro': 1.1, 'carb': 9,   'fat': 0.1 },
    { 'id': 'flfl',  'name': 'فلفل ملون',  'cal': 31,  'pro': 1.0, 'carb': 6.0, 'fat': 0.3 },
    { 'id': 'jrjyr', 'name': 'جرجير',      'cal': 25,  'pro': 2.6, 'carb': 3.7, 'fat': 0.7 },
    { 'id': 'khs',   'name': 'خس',         'cal': 15,  'pro': 1.2, 'carb': 2.9, 'fat': 0.2 },
    { 'id': 'fjl',   'name': 'فجل',        'cal': 16,  'pro': 0.7, 'carb': 3.4, 'fat': 0.1 },
    { 'id': 'bnjr',  'name': 'بنجر',       'cal': 43,  'pro': 1.7, 'carb': 10,  'fat': 0.2 },
    { 'id': 'zra',   'name': 'ذرة شامية',  'cal': 86,  'pro': 3.2, 'carb': 19,  'fat': 1.2 },
  ];

  Future<void> _addToSalad(NutritionMeal meal) async {
    final chosen = await showModalBottomSheet<List<String>>(
      context: context,
      backgroundColor: AppColors.card,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _SaladPickerSheet(
        existingIds: meal.foods.map((f) => f.id).toSet(),
      ),
    );
    if (chosen == null || chosen.isEmpty) return;

    const grams = 50.0;
    final extras = chosen.map((id) {
      final m = _saladAddables.firstWhere((x) => x['id'] == id);
      final n = grams / 100;
      return NutritionFoodItem(
        id: m['id'] as String,
        name: m['name'] as String,
        grams: grams,
        calories: ((m['cal'] as num) * n).round(),
        protein:  ((m['pro']  as num) * n * 10).round() / 10,
        carbs:    ((m['carb'] as num) * n * 10).round() / 10,
        fat:      ((m['fat']  as num) * n * 10).round() / 10,
      );
    }).toList();

    await _applyFoods(meal, [...meal.foods, ...extras]);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('أضفنا ${chosen.length} عنصر للسلطة ✅')),
      );
    }
  }

  Widget _lockedCard(int remaining) => Container(
        padding: const EdgeInsets.all(21),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(19),
          border: Border.all(color: AppColors.wo.withValues(alpha: .35)),
          gradient: LinearGradient(colors: [AppColors.wo.withValues(alpha: .10), AppColors.card]),
        ),
        child: Column(children: [
          const Icon(Icons.lock_outline, color: AppColors.wo2, size: 36),
          const SizedBox(height: 10),
          Text('باقي الوجبات ($remaining) مقفولة',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
          const SizedBox(height: 7),
          const Text('افتح الخطة اليومية كاملة بكل الأصناف والكميات',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, height: 1.5)),
          const SizedBox(height: 15),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                  backgroundColor: AppColors.wo,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13))),
              onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const PricingScreen())),
              icon: const Icon(Icons.workspace_premium),
              label: const Text('افتح الخطة الكاملة', style: TextStyle(fontWeight: FontWeight.w900)),
            ),
          ),
        ]),
      );
}


// ============================================================
// [EGY-v72] واجهة اختيار عناصر السلطة — Bottom Sheet
// ============================================================
class _SaladPickerSheet extends StatefulWidget {
  final Set<String> existingIds;
  const _SaladPickerSheet({required this.existingIds});
  @override
  State<_SaladPickerSheet> createState() => _SaladPickerSheetState();
}

class _SaladPickerSheetState extends State<_SaladPickerSheet> {
  final Set<String> _selected = {};
  static const _items = _MealPlanScreenState._saladAddables;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Icons.eco_rounded, color: AppColors.nu, size: 22),
              const SizedBox(width: 8),
              const Text('إضافة عنصر للسلطة',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(context),
              ),
            ]),
            const SizedBox(height: 4),
            const Text('اختار الخضروات اللي تحب تضيفها (50جم لكل عنصر)',
                style: TextStyle(color: AppColors.muted, fontSize: 13)),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _items.map((item) {
                final id   = item['id']   as String;
                final name = item['name'] as String;
                final alreadyIn = widget.existingIds.contains(id);
                final selected  = _selected.contains(id);
                return FilterChip(
                  label: Text(name),
                  selected: selected,
                  onSelected: alreadyIn
                      ? null
                      : (v) => setState(() {
                            if (v) _selected.add(id);
                            else _selected.remove(id);
                          }),
                  backgroundColor: AppColors.card2,
                  selectedColor: AppColors.nu.withValues(alpha: .25),
                  checkmarkColor: AppColors.nu,
                  labelStyle: TextStyle(
                    color: alreadyIn ? AppColors.muted : AppColors.text,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.normal,
                  ),
                  tooltip: alreadyIn ? 'مضاف بالفعل' : null,
                );
              }).toList(),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor:
                      _selected.isEmpty ? AppColors.muted : AppColors.nu,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(13)),
                ),
                onPressed: _selected.isEmpty
                    ? null
                    : () => Navigator.pop(context, _selected.toList()),
                child: Text(
                  _selected.isEmpty
                      ? 'اختار على الأقل عنصر واحد'
                      : 'إضافة ${_selected.length} عنصر للسلطة',
                  style: const TextStyle(
                      fontWeight: FontWeight.w900, fontSize: 15),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
