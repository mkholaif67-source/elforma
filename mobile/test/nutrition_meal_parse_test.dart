import 'package:flutter_test/flutter_test.dart';
import 'package:elforma/models/engine_contracts.dart';

/// Fix 10-ب — the diet tab now renders the ACTUAL Egyptian meal composition
/// (فول+بيض+عيش، فراخ+رز+خضار...) instead of numbers only. That preview
/// is built by parsing `plan.meals` (the exact shape /api/mobile/nutrition-plan
/// and the website's gatePreview return) through [NutritionMeal.fromJson].
/// These tests pin that parsing contract so the composition can never silently
/// regress to "just numbers" again.
void main() {
  group('NutritionMeal.fromJson (10-ب composition preview)', () {
    test('parses a real Egyptian breakfast with nested food objects', () {
      final meal = NutritionMeal.fromJson({
        'slotKey': 'breakfast',
        'label': 'الفطار',
        'targetCals': 500,
        'totals': {'cals': 480, 'pro': 30, 'carb': 45, 'fat': 18},
        'foods': [
          {
            'food': {'id': 'fwlmdms', 'nameAr': 'فول مدمس'},
            'grams': 200,
            'cals': 240,
            'pro': 16,
            'carb': 30,
            'fat': 6,
          },
          {
            'food': {'id': 'byd_mslwq', 'nameAr': 'بيض مسلوق'},
            'grams': 100,
            'cals': 155,
            'pro': 13,
            'carb': 1,
            'fat': 11,
          },
          {
            'food': {'id': 'ayshbldy', 'nameAr': 'عيش بلدي'},
            'grams': 90,
            'cals': 85,
            'pro': 1,
            'carb': 14,
            'fat': 1,
          },
        ],
      }, 0);

      expect(meal.name, 'الفطار');
      expect(meal.key, 'breakfast');
      expect(meal.targetCalories, 500);
      // Totals block wins when present.
      expect(meal.calories, 480);
      expect(meal.protein, 30);
      // Composition itself — the whole point of 10-ب.
      expect(meal.foods.length, 3);
      expect(meal.foods[0].name, 'فول مدمس');
      expect(meal.foods[0].grams, 200);
      expect(meal.foods[0].calories, 240);
      expect(meal.foods[1].name, 'بيض مسلوق');
      expect(meal.foods[2].name, 'عيش بلدي');
    });

    test('falls back to summing foods when no totals block is sent', () {
      final meal = NutritionMeal.fromJson({
        'name': 'الغدا',
        'foods': [
          {'nameAr': 'صدر فراخ مشوي', 'grams': 150, 'cals': 250, 'pro': 46},
          {'nameAr': 'أرز مطبوخ', 'grams': 180, 'cals': 234, 'carb': 51},
        ],
      }, 1);

      expect(meal.name, 'الغدا');
      expect(meal.foods.length, 2);
      // 250 + 234 summed from the items.
      expect(meal.calories, 484);
      expect(meal.protein, 46);
      expect(meal.carbs, 51);
    });

    test('gives a stable fallback name/key when the slot is unlabelled', () {
      final meal = NutritionMeal.fromJson({'foods': const []}, 2);
      expect(meal.name, 'وجبة 3');
      expect(meal.key, 'meal_2');
      expect(meal.foods, isEmpty);
    });

    test('reads the items[] alias some engine layers emit', () {
      final meal = NutritionMeal.fromJson({
        'label': 'سناك',
        'items': [
          {'nameAr': 'زبادي', 'grams': 100, 'cals': 60},
        ],
      }, 3);
      expect(meal.foods.length, 1);
      expect(meal.foods[0].name, 'زبادي');
    });
  });
}
