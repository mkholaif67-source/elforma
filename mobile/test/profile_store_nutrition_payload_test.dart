import 'package:flutter_test/flutter_test.dart';
import 'package:elforma/models/profile_store.dart';

/// Fix 10-أ — SINGLE SOURCE OF TRUTH for nutrition targets.
///
/// The diet tab used to keep its own editable height/weight/age/gender/
/// activity/goal fields and compute from them, so a user could silently get
/// targets for a body different from the one the server used. Now the tab
/// builds its payload only from the saved profile via
/// [ProfileStore.nutritionPayloadFrom]. These tests pin that pure builder so
/// the second source of truth can never come back.
void main() {
  group('activityMultiplierFor', () {
    test('maps every known level to its engine multiplier', () {
      expect(ProfileStore.activityMultiplierFor('sedentary'), 1.2);
      expect(ProfileStore.activityMultiplierFor('light'), 1.375);
      expect(ProfileStore.activityMultiplierFor('moderate'), 1.55);
      expect(ProfileStore.activityMultiplierFor('active'), 1.725);
      expect(ProfileStore.activityMultiplierFor('very_active'), 1.9);
    });

    test('falls back to moderate for unknown / null values', () {
      expect(ProfileStore.activityMultiplierFor('nonsense'), 1.55);
      expect(ProfileStore.activityMultiplierFor(null), 1.55);
      expect(ProfileStore.activityMultiplierFor(''), 1.55);
    });
  });

  group('nutritionGoal', () {
    test('passes through lose / gain', () {
      expect(ProfileStore.nutritionGoal('lose'), 'lose');
      expect(ProfileStore.nutritionGoal('gain'), 'gain');
    });

    test('normalises everything else to maintain', () {
      expect(ProfileStore.nutritionGoal('maintain'), 'maintain');
      expect(ProfileStore.nutritionGoal('fitness'), 'maintain');
      expect(ProfileStore.nutritionGoal('muscle'), 'maintain');
      expect(ProfileStore.nutritionGoal(null), 'maintain');
    });
  });

  group('nutritionPayloadFrom', () {
    test('is sourced entirely from the saved profile', () {
      final payload = ProfileStore.nutritionPayloadFrom({
        'gender': 'female',
        'age': 29,
        'height': 165,
        'weight': 62,
        'dailyActivity': 'active',
        'goal': 'lose',
        'targetWeight': 57,
        'diet': 'high_protein',
        'mealCount': 5,
        'healthConditions': ['hypothyroid', 'pcos'],
      });

      expect(payload['gender'], 'female');
      expect(payload['age'], 29);
      expect(payload['height'], 165);
      expect(payload['weight'], 62);
      expect(payload['activity'], 1.725);
      expect(payload['goal'], 'lose');
      expect(payload['target'], 57);
      expect(payload['selectedDiet'], 'high_protein');
      expect(payload['mealCount'], 5);
      expect(payload['healthConditions'], ['hypothyroid', 'pcos']);
    });

    test('applies safe defaults for a sparse profile without inventing a body',
        () {
      final payload = ProfileStore.nutritionPayloadFrom({});
      // Body metrics default to 0 so the server refuses clearly instead of
      // computing against a fake 25/175/75 body.
      expect(payload['age'], 0);
      expect(payload['height'], 0);
      expect(payload['weight'], 0);
      // Non-body knobs get sensible, explicit defaults.
      expect(payload['gender'], 'male');
      expect(payload['activity'], 1.55);
      expect(payload['goal'], 'maintain');
      expect(payload['selectedDiet'], 'balanced');
      expect(payload['mealCount'], 4);
      expect(payload['healthConditions'], isEmpty);
    });

    test('a null profile never throws and yields the empty-profile defaults',
        () {
      final payload = ProfileStore.nutritionPayloadFrom(null);
      expect(payload['weight'], 0);
      expect(payload['activity'], 1.55);
      expect(payload['goal'], 'maintain');
    });

    test('parses numeric strings coming back from the cache', () {
      final payload = ProfileStore.nutritionPayloadFrom({
        'age': '31',
        'height': '180.0',
        'weight': '80.5',
        'mealCount': '3',
      });
      expect(payload['age'], 31);
      expect(payload['height'], 180);
      expect(payload['weight'], 80.5);
      expect(payload['mealCount'], 3);
    });

    test('drops non-string entries from healthConditions defensively', () {
      final payload = ProfileStore.nutritionPayloadFrom({
        'healthConditions': ['diabetes', 42, null, 'insulin_resistance'],
      });
      expect(payload['healthConditions'], ['diabetes', 'insulin_resistance']);
    });
  });
}
