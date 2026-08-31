// ── ElForma · models/engine_contracts.dart ──
// Data-transfer objects that MIRROR the server engine JSON (nutrition + workout).
// These are the typed contract between the Flutter UI and lib/*-engine-host.js output.
// Keep field names in sync with api/mobile.js; do not add client-side computation here.
// نماذج البيانات التي تطابق خرج محركات السيرفر — مجرد عقد أنواع، بلا حسابات.

/// One food row inside a meal, as computed by the nutrition engine on the server.
/// Field names mirror the api/mobile.js JSON exactly; this class only parses/holds.
class NutritionFoodItem {
  final String id;
  final String name;
  final num grams;
  final num calories;
  final num protein;
  final num carbs;
  final num fat;
  final bool hasCondiment;
  // [NEW] خصائص المكمل (زيت / زبدة) — لعرض "150 جرام جبنة قريش + 10 جرام زيت زيتون"
  final String? condimentName;
  final num condimentGrams;
  // [DYNAMIC-PAIR] العناصر المركبة (زيت/زبدة) بقت أصناف حقيقية منفصلة.
  // isAddon=true معناها عنصر إضافي (زي زيت زيتون) مرتبط بصنف أساسي
  // للعرض في نفس السطر بس، لكنه قابل للتعديل والحذف وإعادة الحساب مستقلًا.
  final bool isAddon;
  final String? pairGroup;

  const NutritionFoodItem({
    required this.id,
    required this.name,
    required this.grams,
    required this.calories,
    required this.protein,
    required this.carbs,
    required this.fat,
    this.hasCondiment = false,
    this.condimentName,
    this.condimentGrams = 0,
    this.isAddon = false,
    this.pairGroup,
  });

  static num _number(dynamic value) {
    if (value is num) return value;
    return num.tryParse('$value') ?? 0;
  }

  factory NutritionFoodItem.fromJson(Map raw) {
    final nested = raw['food'];
    final food = nested is Map ? nested : const <String, dynamic>{};
    final name = (food['nameAr'] ?? food['nameEn'] ?? raw['nameAr'] ??
            raw['name'] ?? (nested is String ? nested : null) ?? food['id'] ?? 'صنف غذائي')
        .toString();
    return NutritionFoodItem(
      id: (food['id'] ?? raw['id'] ?? name).toString(),
      name: name,
      grams: _number(raw['grams']),
      calories: _number(raw['cals'] ?? raw['calories']),
      protein: _number(raw['pro'] ?? raw['protein']),
      carbs: _number(raw['carb'] ?? raw['carbs']),
      fat: _number(raw['fat'] ?? raw['fats']),
      hasCondiment: raw['_hasCondiment'] == true,
      isAddon: raw['isAddon'] == true || raw['_isAddon'] == true,
      pairGroup: (raw['pairGroup'] ?? raw['_pairGroup'])?.toString(),
    );
  }

  factory NutritionFoodItem.fromCatalog(Map raw, num grams) {
    num n(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;
    final ratio = grams / 100;
    return NutritionFoodItem(
      id: (raw['id'] ?? '').toString(),
      name: (raw['nameAr'] ?? raw['nameEn'] ?? 'صنف غذائي').toString(),
      grams: grams,
      calories: n(raw['cal']) * ratio,
      protein: n(raw['pro']) * ratio,
      carbs: n(raw['carb']) * ratio,
      fat: n(raw['fat']) * ratio,
    );
  }

  /// Returns the same food at a smaller portion.
  ///
  /// Used when an added item would push the day past its calorie target: the
  /// portion shrinks to fit instead of silently blowing the budget. Grams are
  /// rounded to the nearest 5 because no one weighs food to the gram, and the
  /// macros are scaled from the rounded grams so the numbers on screen always
  /// agree with the portion shown.
  NutritionFoodItem scaledToFit(num factor) {
    if (factor >= 1 || factor <= 0 || grams <= 0) return this;
    final target = grams * factor;
    final rounded = (target / 5).round() * 5;
    final safeGrams = rounded < 5 ? 5 : rounded;
    final applied = safeGrams / grams;
    return NutritionFoodItem(
      id: id,
      name: name,
      grams: safeGrams,
      calories: (calories * applied).round(),
      protein: double.parse((protein * applied).toStringAsFixed(1)),
      carbs: double.parse((carbs * applied).toStringAsFixed(1)),
      fat: double.parse((fat * applied).toStringAsFixed(1)),
      hasCondiment: hasCondiment,
      condimentName: condimentName,
      condimentGrams: condimentGrams,
      isAddon: isAddon,
      pairGroup: pairGroup,
    );
  }

  /// Returns the same food at an explicit portion (up or down).
  ///
  /// المتدرب لازم يقدر يعدل كمية أي صنف بإيده، مش ينقصها بس.
  /// الجرامات بتتقرب لأقرب 5 جم والماكروز بتتحسب من نفس الكمية.
  NutritionFoodItem atGrams(num newGrams) {
    if (grams <= 0 || newGrams <= 0) return this;
    final rounded = (newGrams / 5).round() * 5;
    final safeGrams = rounded < 5 ? 5 : rounded;
    final applied = safeGrams / grams;
    return NutritionFoodItem(
      id: id,
      name: name,
      grams: safeGrams,
      calories: (calories * applied).round(),
      protein: double.parse((protein * applied).toStringAsFixed(1)),
      carbs: double.parse((carbs * applied).toStringAsFixed(1)),
      fat: double.parse((fat * applied).toStringAsFixed(1)),
      hasCondiment: hasCondiment,
      condimentName: condimentName,
      condimentGrams: condimentGrams,
      isAddon: isAddon,
      pairGroup: pairGroup,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'grams': grams,
        'cals': calories,
        'pro': protein,
        'carb': carbs,
        'fat': fat,
        if (isAddon) 'isAddon': true,
        if (pairGroup != null) 'pairGroup': pairGroup,
      };
}

/// A single planned meal (name + its food items + macro totals) from the engine.
class NutritionMeal {
  final String key;
  final String name;
  final String description;
  final num targetCalories;
  final num calories;
  final num protein;
  final num carbs;
  final num fat;
  final List<NutritionFoodItem> foods;

  const NutritionMeal({
    required this.key,
    required this.name,
    required this.description,
    required this.targetCalories,
    required this.calories,
    required this.protein,
    required this.carbs,
    required this.fat,
    required this.foods,
  });

  static num _number(dynamic value) {
    if (value is num) return value;
    return num.tryParse('$value') ?? 0;
  }

  factory NutritionMeal.fromJson(Map raw, int index) {
    final source = raw['foods'] is List
        ? raw['foods'] as List
        : raw['items'] is List
            ? raw['items'] as List
            : const [];
    final foods = source
        .whereType<Map>()
        .map(NutritionFoodItem.fromJson)
        .toList(growable: false);
    final totals = raw['totals'] is Map ? raw['totals'] as Map : const {};
    num sum(num Function(NutritionFoodItem) pick) =>
        foods.fold<num>(0, (value, item) => value + pick(item));
    final calories = _number(totals['cals'] ?? raw['cals'] ?? raw['calories']);
    final protein = _number(totals['pro'] ?? raw['pro'] ?? raw['protein']);
    final carbs = _number(totals['carb'] ?? raw['carb'] ?? raw['carbs']);
    final fat = _number(totals['fat'] ?? raw['fat'] ?? raw['fats']);
    return NutritionMeal(
      key: (raw['slotKey'] ?? raw['key'] ?? 'meal_$index').toString(),
      name: (raw['label'] ?? raw['name'] ?? raw['type'] ?? 'وجبة ${index + 1}').toString(),
      description: (raw['description'] ?? '').toString(),
      targetCalories: _number(raw['targetCals']),
      calories: calories > 0 ? calories : sum((item) => item.calories),
      protein: protein > 0 ? protein : sum((item) => item.protein),
      carbs: carbs > 0 ? carbs : sum((item) => item.carbs),
      fat: fat > 0 ? fat : sum((item) => item.fat),
      foods: foods,
    );
  }

  NutritionMeal withFoods(List<NutritionFoodItem> nextFoods) {
    num sum(num Function(NutritionFoodItem) pick) =>
        nextFoods.fold<num>(0, (value, item) => value + pick(item));
    return NutritionMeal(
      key: key,
      name: name,
      description: description,
      targetCalories: targetCalories,
      calories: sum((item) => item.calories),
      protein: sum((item) => item.protein),
      carbs: sum((item) => item.carbs),
      fat: sum((item) => item.fat),
      foods: List.unmodifiable(nextFoods),
    );
  }

  Map<String, dynamic> toJson({required bool completed}) => {
        'key': key,
        'name': name,
        'completed': completed,
        'calories': calories,
        'protein': protein,
        'carbs': carbs,
        'fat': fat,
        'foods': foods.map((item) => item.toJson()).toList(),
      };
}

/// One prescribed exercise (name, sets/reps, target muscle, video) from the
/// workout engine, plus the client-side per-set logging state during a session.
class WorkoutExercise {
  final String key;
  final String name;
  final String muscle;
  final int sets;
  final String reps;
  final int restSeconds;
  final String rir;
  final String tempo;
  final String progression;
  final String alternative;
  final String videoId;

  const WorkoutExercise({
    required this.key,
    required this.name,
    required this.muscle,
    required this.sets,
    required this.reps,
    required this.restSeconds,
    required this.rir,
    required this.tempo,
    required this.progression,
    required this.alternative,
    required this.videoId,
  });

  static int _int(dynamic value, int fallback) {
    if (value is num) return value.toInt();
    return int.tryParse('$value') ?? fallback;
  }

  static int _rest(dynamic rawSeconds, dynamic rawLabel) {
    final seconds = _int(rawSeconds, 0);
    if (seconds > 0) return seconds.clamp(45, 600).toInt();
    final text = '$rawLabel';
    final values = RegExp(r'\d+').allMatches(text).map((m) => int.parse(m.group(0)!)).toList();
    if (values.isEmpty) return 90;
    if (text.contains('دقيقة') || text.toLowerCase().contains('min')) {
      return (values.first * 60).clamp(45, 600).toInt();
    }
    return values.first.clamp(45, 600).toInt();
  }

  /// Splits an engine day name like "Upper 1 صدر مسطح + علوي + لاتس"
  /// into a short title and the muscle detail. The engine ships both in one
  /// string, which used to be dumped straight into the AppBar and overflow.
  static List<String> splitDayName(String full) {
    final text = full.trim();
    if (text.isEmpty) return const ['جلسة التمرين', ''];
    for (final sep in const [' — ', ' - ', ' – ', '—', '–']) {
      final i = text.indexOf(sep);
      if (i > 0) {
        return [text.substring(0, i).trim(), text.substring(i + sep.length).trim()];
      }
    }
    return [text, ''];
  }

  /// Muscle detail split into individual chips instead of one long line.
  static List<String> muscleChips(String detail) {
    return detail
        .split(RegExp(r'\s*[+،,/]\s*'))
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
  }

  static String _videoId(dynamic raw) {
    final value = '$raw'.trim();
    if (value.isEmpty ||
        value == 'null' ||
        value == 'undefined' ||
        value == 'none' ||
        value == 'NaN') return '';
    final uri = Uri.tryParse(value);
    if (uri != null && uri.hasScheme) {
      if (uri.host.contains('youtu.be')) return uri.pathSegments.isEmpty ? '' : uri.pathSegments.first;
      final v = uri.queryParameters['v'];
      if (v != null && v.isNotEmpty) return v;
      final parts = uri.pathSegments;
      final marker = parts.indexWhere((p) => p == 'embed' || p == 'shorts');
      if (marker >= 0 && marker + 1 < parts.length) return parts[marker + 1];
    }
    return value;
  }

  factory WorkoutExercise.fromJson(Map raw, int index) {
    final name = (raw['n'] ?? raw['name'] ?? 'تمرين ${index + 1}').toString();
    return WorkoutExercise(
      key: (raw['key'] ?? name).toString(),
      name: name,
      muscle: (raw['mu'] ?? raw['muscle'] ?? '').toString(),
      sets: _int(raw['sets'], 3).clamp(1, 12).toInt(),
      reps: (raw['reps'] ?? '8-12').toString(),
      restSeconds: _rest(raw['restSec'], raw['rest']),
      rir: (raw['progRir'] ?? raw['rir'] ?? '').toString(),
      tempo: (raw['tempo'] ?? '').toString(),
      progression: (raw['progression'] ?? '').toString(),
      alternative: (raw['alt'] ?? raw['alternative'] ?? '').toString(),
      // Prefer the server-guarded videoUrl (lib/video-guard.js) over the raw
      // engine id: the guard already validated it and substituted a
      // muscle-relevant fallback when the id was dead or missing.
      videoId: _videoId(raw['videoUrl'] ?? raw['vid'] ?? raw['videoId'] ?? raw['v'] ?? raw['video']),
    );
  }

  WorkoutExercise replaceWith(Map raw) => WorkoutExercise(
        key: (raw['n'] ?? raw['name'] ?? key).toString(),
        name: (raw['n'] ?? raw['name'] ?? name).toString(),
        muscle: (raw['mu'] ?? raw['muscle'] ?? muscle).toString(),
        sets: sets,
        reps: reps,
        restSeconds: restSeconds,
        rir: rir,
        tempo: tempo,
        progression: progression,
        alternative: (raw['alt'] ?? name).toString(),
        videoId: _videoId(raw['videoUrl'] ?? raw['vid'] ?? raw['videoId'] ?? raw['v'] ?? raw['video']),
      );
}
