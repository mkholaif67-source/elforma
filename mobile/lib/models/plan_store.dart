// ── ElForma · models/plan_store.dart ──
// Global signal: fires whenever any plan (workout OR meal) changes on the server.
// Every screen that *displays* plan data listens to this and reloads.
// Pattern mirrors ProfileStore / SmartCoachStore: singleton ChangeNotifier.

import 'package:flutter/foundation.dart';

class PlanStore extends ChangeNotifier {
  PlanStore._();
  static final PlanStore I = PlanStore._();

  /// Call this after any successful plan save/generate (workout or meal).
  /// All listeners (HomeScreen, etc.) will automatically reload.
  void markChanged() => notifyListeners();
}
