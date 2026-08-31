// ── ElForma · models/meal_display.dart ──
// Display-only helper that presents an engine meal the Egyptian way. When a
// meal contains two or more raw salad vegetables (خس/خيار/طماطم/جرجير…)
// they are merged into a single «سلطة» line — exactly how the website groups
// them — so the diet preview reads like a real plate instead of a repetitive
// pile of single vegetables. This changes nothing the engine computes: the
// merged row simply sums the grams and macros of its parts.
import 'engine_contracts.dart';

// Raw salad vegetables per the owner's canonical Egyptian list. Cooked
// vegetables (فاصوليا/بسلة/كوسة مطبوخة…) are intentionally NOT here — only
// raw items that belong on one «سلطة» plate the way the website groups
// cat=='veggie'.

// ==============================================================
//  العناصر المركبة (زيت زيتون / زبدة) — أصناف حقيقية منفصلة
//  بدل أرقام ثابتة ملزوقة في الصنف الأساسي:
//  • الكمية Dynamic: نسبة من كمية الصنف الأساسي (تتقرب لأقرب 5جم، بحد أدنى/أقصى).
//  • عنصر مستقل تمامًا: يتعدّل أو يتحذف لوحده، وإجمالي الوجبة يعاد حسابه تلقائي.
//  • العرض يفضل مدموج في نفس السطر (بعلامة +) لكن داخليًا صنفين منفصلين.
// ==============================================================
class _AddonSpec {
  final String name;   // اسم العنصر المضاف (زيت زيتون / زبدة)
  final num calPer100; // سعرات لكل 100جم
  final num fatPer100; // دهون لكل 100جم
  final num ratio;     // نسبة كمية المضاف من كمية الأساس
  final num minG;      // أقل كمية منطقية
  final num maxG;      // أقصى كمية منطقية
  const _AddonSpec(this.name, this.calPer100, this.fatPer100, this.ratio, this.minG, this.maxG);
}

// زيت زيتون: 884 سعرة/100جم و100جم دهون. زبدة: 717 سعرة/100جم و81جم دهون.
// [OWNER-RULE] الإضافات الدهنية هدفها استكمال احتياج اليوم من الدهون — مش تكديس دهون
// وسعرات في الفطار، فالنسبة والحد الأقصى اتقللوا لكميات معقولة (حد أقصى 10جم).
const _oliveSpec  = _AddonSpec('زيت زيتون', 884, 100, 0.05, 5, 10);
const _butterSpec = _AddonSpec('زبدة', 717, 81, 0.06, 5, 10);

_AddonSpec? _addonFor(String id, String name) {
  final i = id.toLowerCase();
  if (i.contains('fwl') || i.contains('byd_mqly') ||
      name.contains('فول') || name.contains('بيض مقل')) return _butterSpec;
  if (i.contains('jbn') || i.contains('qrysh') || i.contains('rods') ||
      name.contains('جبن')) return _oliveSpec;
  return null;
}

num _round5(num g) {
  final r = (g / 5).round() * 5;
  return r < 5 ? 5 : r;
}

/// يبني صنف مضاف حقيقي بكمية Dynamic محسوبة من كمية الأساس.
NutritionFoodItem _buildAddon(String pairGroup, _AddonSpec spec, num baseGrams) {
  num g = _round5(baseGrams * spec.ratio);
  if (g < spec.minG) g = spec.minG;
  if (g > spec.maxG) g = spec.maxG;
  final k = g / 100;
  return NutritionFoodItem(
    id: '${pairGroup}__addon',
    name: spec.name,
    grams: g,
    calories: (spec.calPer100 * k).round(),
    protein: 0,
    carbs: 0,
    fat: double.parse((spec.fatPer100 * k).toStringAsFixed(1)),
    isAddon: true,
    pairGroup: pairGroup,
  );
}

/// يحوّل العناصر المركبة لأصناف حقيقية منفصلة: يدخل الزيت/الزبدة كصنف مستقل
/// بعد الصنف الأساسي مباشرة. Idempotent — مبيكررش لو العنصر المضاف موجود.
List<NutritionFoodItem> expandCondiments(List<NutritionFoodItem> foods) {
  final existing = <String>{};
  for (final f in foods) {
    if (f.isAddon && f.pairGroup != null) existing.add(f.pairGroup!);
  }
  // إجمالي كمية السلطة (لو فيه طبق مدموج) لحساب زيت السلطة كعنصر واحد.
  num saladGrams = 0;
  var saladCount = 0;
  var lastSaladIdx = -1;
  for (var i = 0; i < foods.length; i++) {
    if (!foods[i].isAddon && _isSalad(foods[i].name)) {
      saladGrams += foods[i].grams;
      saladCount++;
      lastSaladIdx = i;
    }
  }
  final out = <NutritionFoodItem>[];
  for (var i = 0; i < foods.length; i++) {
    final f = foods[i];
    out.add(f);
    if (f.isAddon) continue;
    // زيت السلطة: عنصر واحد للطبق كله، بعد آخر خضرة.
    if (saladCount >= 2 && i == lastSaladIdx && !existing.contains('salad_group')) {
      out.add(_buildAddon('salad_group', _oliveSpec, saladGrams));
      existing.add('salad_group');
      continue;
    }
    if (_isSalad(f.name)) continue; // الخضار المفردة بتتجمع في طبق، مالهاش زيت مستقل
    if (existing.contains(f.id)) continue;
    final spec = _addonFor(f.id, f.name);
    if (spec != null) {
      out.add(_buildAddon(f.id, spec, f.grams));
      existing.add(f.id);
    }
  }
  return out;
}
const List<String> _saladKeywords = [
  'خس', 'طماطم', 'خيار', 'فلفل', 'جزر', 'كابوتشا', 'جرجير', 'فجل',
  'بقدونس', 'شبت', 'كزبرة', 'كرنب', 'خضار مشكل', 'سلطة خضراء',
];

/// The id carried by the merged «سلطة» display row.
const String saladGroupId = 'salad_group';

/// True when this row is a raw salad vegetable (or the merged salad plate).
/// المتدرب لازم يقدر يحذف طبق السلطة أو يعدل كميته، فالواجهة محتاجة
/// تعرف أي صفوف الوجبة اللي مكونة الطبق المدموج.
bool isSaladItem(NutritionFoodItem food) =>
    food.id == saladGroupId || _isSalad(food.name);

/// Positions of the real salad rows inside the meal's own food list.
List<int> saladIndexes(List<NutritionFoodItem> foods) {
  final out = <int>[];
  for (var i = 0; i < foods.length; i++) {
    if (_isSalad(foods[i].name)) out.add(i);
  }
  return out;
}

bool _isSalad(String name) {
  for (final k in _saladKeywords) {
    if (name.contains(k)) return true;
  }
  return false;
}

/// Returns the meal's foods with salad vegetables merged into one «سلطة»
/// row when two or more of them appear together. Meal order is preserved: the
/// merged row takes the position of the first salad item. When fewer than two
/// salad items exist the original list is returned untouched.
/// يشيل تكرار كلمة ملتصقة في الاسم زي «سمك بلطي مشوي مشوي» → «سمك بلطي مشوي».
String _dedupName(String name) {
  return name
      .replaceAllMapped(RegExp(r'(\S+)(\s+\1\b)+'), (m) => m[1]!)
      .trim();
}

/// نسخة من الصنف باسم منظّف. الأنواع immutable فبنعيد البناء بنفس القيم.
NutritionFoodItem _withCleanName(NutritionFoodItem f) {
  final cleaned = _dedupName(f.name);
  if (cleaned == f.name) return f;
  return NutritionFoodItem(
    id: f.id,
    name: cleaned,
    grams: f.grams,
    calories: f.calories,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
    hasCondiment: f.hasCondiment,
    condimentName: f.condimentName,
    condimentGrams: f.condimentGrams,
    isAddon: f.isAddon,
    pairGroup: f.pairGroup,
  );
}

/// ترتيب العناصر داخل الوجبة حسب طلب صاحب المشروع:
/// البروتين الأول، بعده الكارب، بعده السلطة/الخضار، بعده الزبادي، وأي حاجة تانية آخراً.
int _categoryRank(NutritionFoodItem f) {
  final t = '${f.name} ${f.id}';
  if (f.id == saladGroupId || _isSalad(f.name)) return 3; // سلطة / خضار
  if (RegExp('زبادي|لبن رايب|لبن رايب|zbady|laban').hasMatch(t)) return 4; // زبادي
  if (RegExp(
          'فراخ|فرخة|لحم|لحمة|كفتة|كبدة|سمك|تونة|تونه|بيض|رومي|بط|حمام|جمبري|سردين|سلمون|بروتين|بانيه|فول|جبن|قريش|frakh|lhm|smk|twna|byd|blty|kbda|kfta|slmwn|srdyn|jmbry|fwl|jbn|qrysh')
      .hasMatch(t)) {
    return 1; // بروتين
  }
  if (RegExp(
          'أرز|ارز|عيش|خبز|بطاطس|بطاطا|مكرون|شوفان|بليلة|فينو|توست|تورتيلا|كارب|arz|ays|khbz|btata|mkrwn|shwfan|tost|carb')
      .hasMatch(t)) {
    return 2; // كارب
  }
  return 5; // أي حاجة تانية
}

/// Returns the meal's foods cleaned, salad-merged, and ordered the owner's way
/// (protein → carb → salad/veg → yogurt → other) while keeping each add-on
/// (oil/butter) glued right after its base item.
List<NutritionFoodItem> displayFoods(List<NutritionFoodItem> foods) {
  // 1) تنظيف الأسماء من التكرار.
  final cleaned = foods.map(_withCleanName).toList();

  // 2) دمج الخضار النيّئة في طبق «سلطة» واحد.
  List<NutritionFoodItem> mergedList;
  final saladItems = cleaned.where((f) => _isSalad(f.name)).toList();
  if (saladItems.length < 2) {
    mergedList = cleaned;
  } else {
    num grams = 0, calories = 0, protein = 0, carbs = 0, fat = 0;
    final names = <String>[];
    for (final f in saladItems) {
      grams += f.grams;
      calories += f.calories;
      protein += f.protein;
      carbs += f.carbs;
      fat += f.fat;
      names.add(f.name);
    }
    final saladRow = NutritionFoodItem(
      id: 'salad_group',
      name: 'سلطة (${names.join(' + ')})',
      grams: grams,
      calories: calories,
      protein: protein,
      carbs: carbs,
      fat: fat,
    );
    final tmp = <NutritionFoodItem>[];
    var inserted = false;
    for (final f in cleaned) {
      if (_isSalad(f.name)) {
        if (!inserted) {
          tmp.add(saladRow);
          inserted = true;
        }
      } else {
        tmp.add(f);
      }
    }
    mergedList = tmp;
  }

  // 3) ترتيب حسب النوع مع تثبيت العنصر الإضافي (زيت/زبدة) ورا أساسه.
  final bases = <NutritionFoodItem>[];
  final addonsByGroup = <String, List<NutritionFoodItem>>{};
  for (final f in mergedList) {
    if (f.isAddon && f.pairGroup != null) {
      addonsByGroup.putIfAbsent(f.pairGroup!, () => <NutritionFoodItem>[]).add(f);
    } else {
      bases.add(f);
    }
  }
  final indexed = <MapEntry<int, NutritionFoodItem>>[
    for (var i = 0; i < bases.length; i++) MapEntry(i, bases[i]),
  ];
  indexed.sort((a, b) {
    final ra = _categoryRank(a.value), rb = _categoryRank(b.value);
    if (ra != rb) return ra.compareTo(rb);
    return a.key.compareTo(b.key); // نفس النوع = نفس الترتيب الأصلي (stable)
  });

  final out = <NutritionFoodItem>[];
  for (final e in indexed) {
    final f = e.value;
    out.add(f);
    final addons = addonsByGroup.remove(f.id);
    if (addons != null) out.addAll(addons);
  }
  // أي إضافات فضلت من غير أساس (احتياطي) تتحط في الآخر.
  for (final leftover in addonsByGroup.values) {
    out.addAll(leftover);
  }
  return out;
}
