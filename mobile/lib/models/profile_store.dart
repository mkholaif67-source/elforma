// ── ElForma · models/profile_store.dart ──
// Single source of truth for the user profile on the client (ChangeNotifier).
// Caches the profile in secure storage and BUILDS the exact payloads the two engines expect:
//   workoutPayload()  -> workout engine goal vocabulary (mirrors lib/goal-vocabulary.js)
//   nutritionPayload() -> nutrition engine goal vocabulary
// The vocabulary mapping is pinned; if you change it here, change goal-vocabulary.js too.
// مصدر البيانات الوحيد للملف ويبني حمولات المحركين بنفس مفردات الهدف.

import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api.dart';

/// Single source of truth for the user's profile.
///
/// Before this existed every screen called `Api.I.mobileBootstrap()` on its own
/// `initState`, kept a private copy of the profile, and rendered a full input
/// form because it had no reliable way to know whether onboarding was already
/// done. That is why the workout and diet tabs always opened on a data form.
///
/// Now: one cached profile, one `onboardingComplete` flag, one notifier every
/// screen listens to. Screens render RESULTS; editing happens in one place.
class ProfileStore extends ChangeNotifier {
  ProfileStore._();
  static final ProfileStore I = ProfileStore._();

  static const _cacheKey = 'ef_profile_cache_v1';

  Map<String, dynamic>? _profile;
  bool _loaded = false;
  bool _loading = false;
  Future<void>? _inFlight;

  Map<String, dynamic>? get profile => _profile;
  bool get loaded => _loaded;
  bool get loading => _loading;

  /// True only when the user actually finished the setup flow.
  bool get isComplete {
    final p = _profile;
    if (p == null) return false;
    if (p['onboardingComplete'] != true) return false;
    // Defensive: the engine cannot compute anything without these three.
    return num0(p['age']) > 0 && num0(p['height']) > 0 && num0(p['weight']) > 0;
  }

  static double num0(dynamic v) {
    if (v is num) return v.toDouble();
    return double.tryParse('$v') ?? 0;
  }

  T? get<T>(String key) {
    final v = _profile?[key];
    return v is T ? v : null;
  }

  String str(String key, [String fallback = '']) {
    final v = _profile?[key];
    if (v == null) return fallback;
    final s = '$v';
    return s.isEmpty ? fallback : s;
  }

  int intOf(String key, int fallback) {
    final v = _profile?[key];
    if (v is num) return v.toInt();
    return int.tryParse('$v'.replaceFirst(RegExp(r'\.0$'), '')) ?? fallback;
  }

  List<String> listOf(String key) {
    final v = _profile?[key];
    if (v is List) return v.whereType<String>().toList();
    return const [];
  }

  /// Loads from local cache first (instant paint, works offline) then
  /// refreshes from the server. Concurrent callers share one request.
  Future<void> ensureLoaded({bool force = false}) {
    if (_loaded && !force) return Future.value();
    final existing = _inFlight;
    if (existing != null) return existing;
    final f = _load(force: force);
    _inFlight = f;
    return f.whenComplete(() => _inFlight = null);
  }

  Future<void> _load({bool force = false}) async {
    _loading = true;
    notifyListeners();
    if (_profile == null) {
      try {
        final sp = await SharedPreferences.getInstance();
        final raw = sp.getString(_cacheKey);
        if (raw != null && raw.isNotEmpty) {
          final decoded = jsonDecode(raw);
          if (decoded is Map) {
            // [OWNER-RULE] ثبات البيانات: مانقراش كاش إلا لو متأكدين إنه
            // لصاحب الحساب الحالي. أي كاش لحساب تاني يترمي فورا.
            final owner = decoded['__ownerId'];
            final current = Api.I.accountId;
            final mismatch = owner != null && current != null && '$owner' != current;
            if (mismatch) {
              await sp.remove(_cacheKey);
            } else {
              final map = Map<String, dynamic>.from(decoded)..remove('__ownerId');
              _profile = map;
              notifyListeners();
            }
          }
        }
      } catch (_) {
        // A corrupt cache must never block the app.
      }
    }
    try {
      final response = await Api.I.mobileBootstrap();
      if (response.ok && response.data['profile'] is Map) {
        _profile = Map<String, dynamic>.from(response.data['profile'] as Map);
        await _persist();
      }
    } catch (_) {
      // Offline: keep whatever the cache gave us.
    }
    _loaded = true;
    _loading = false;
    notifyListeners();
  }

  /// Called by the setup screen after a successful save.
  Future<void> apply(Map<String, dynamic> profile) async {
    _profile = Map<String, dynamic>.from(profile);
    _loaded = true;
    await _persist();
    notifyListeners();
  }

  Future<void> _persist() async {
    try {
      final sp = await SharedPreferences.getInstance();
      // بنختم الكاش بصاحبه عشان مايتقراش لحساب تاني على نفس الجهاز.
      final payload = Map<String, dynamic>.from(_profile ?? {});
      final owner = Api.I.accountId;
      if (owner != null) payload['__ownerId'] = owner;
      await sp.setString(_cacheKey, jsonEncode(payload));
    } catch (_) {}
  }

  Future<void> clear() async {
    _profile = null;
    _loaded = false;
    try {
      final sp = await SharedPreferences.getInstance();
      await sp.remove(_cacheKey);
    } catch (_) {}
    notifyListeners();
  }

  // ---------------------------------------------------------------------
  // Vocabulary translation: the mobile profile speaks one dialect, the
  // original workout engine speaks another. Keeping the mapping HERE means
  // no screen ever invents its own translation again.
  // ---------------------------------------------------------------------

  /// Canonical spec: this MUST mirror `MOBILE_TO_WORKOUT` in the server's
  /// lib/goal-vocabulary.js. The server pins its half in
  /// test/translation-contract.test.js; keep the two in sync.
  static String workoutGoal(dynamic value) {
    switch ('$value') {
      case 'lose':
        return 'cut';
      case 'gain':
        return 'muscle';
      case 'strength':
        return 'strength';
      case 'fitness':
        return 'fitness';
      case 'maintain':
        return 'fitness';
      default:
        return 'fitness';
    }
  }

  /// Builds the exact payload `/api/workout/compute` expects.
  ///
  /// Body metrics carry NO fake fallback: sending a made-up 25/175/75 would
  /// hide an incomplete profile from the server and produce a plan built around
  /// a body the user never entered. We send 0 for a missing metric so the
  /// server refuses clearly. Screens already gate on `isComplete` before
  /// calling, so a real user never reaches here with zeros.
  /// Builds the exact profile payload the WORKOUT engine expects, translating the
  /// user's stored goal through the pinned workout vocabulary (mirrors
  /// lib/goal-vocabulary.js MOBILE_TO_WORKOUT). Do not change one side only.
  Map<String, dynamic> workoutPayload() {
    return {
      'gender': str('gender', 'male'),
      'age': intOf('age', 0),
      'height': intOf('height', 0),
      'weight': intOf('weight', 0),
      'goal': workoutGoal(_profile?['goal']),
      'exp': str('experience', 'beginner'),
      'equip': str('equipment', 'gym'),
      'days': intOf('trainingDays', 4).clamp(2, 6),
      'sleep': str('sleep', 'ok'),
      'stress': str('stress', 'low'),
      'time': intOf('trainingMinutes', 60),
      'daily': str('dailyActivity', 'moderate'),
      'injuries': listOf('injuries'),
      'weak': listOf('weakPoints'),
      'activeModules': listOf('activeModules'),
      'preferredDays': listOf('preferredDays'),
    };
  }

  // ---------------------------------------------------------------------
  // Nutrition payload (Fix 10-أ): SINGLE SOURCE OF TRUTH.
  //
  // The diet tab used to keep its OWN editable height/weight/age/gender/
  // activity/goal fields and compute from them, so a user could silently get
  // targets for a body different from the one every other screen and the
  // server used -- two sources of truth that could drift apart. Now the diet
  // tab reads these builders, which are sourced ONLY from the saved profile.
  // Changing a body metric is a conscious re-assessment through the setup
  // flow, never a throwaway field on a results screen.
  // ---------------------------------------------------------------------

  /// Canonical daily-activity -> multiplier map, mirroring the diet engine's
  /// activity table. Centralised so no screen re-invents it.
  static const Map<String, double> activityMultipliers = {
    'sedentary': 1.2,
    'light': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    // 'athlete' is the server/engine key; 'very_active' kept as a legacy alias
    // so older cached profiles keep resolving. See lib/mobile-nutrition-bridge.js.
    'athlete': 1.9,
    'very_active': 1.9,
  };

  static double activityMultiplierFor(dynamic dailyActivity) =>
      activityMultipliers['$dailyActivity'] ?? 1.55;

  /// Normalises the stored goal to the nutrition engine's vocabulary
  /// (lose / maintain / gain). Anything unknown means "maintain".
  static String nutritionGoal(dynamic value) {
    switch ('$value') {
      case 'lose':
        return 'lose';
      case 'gain':
        return 'gain';
      default:
        return 'maintain';
    }
  }

  /// Pure builder for the `/api/plan/targets` and `/api/plan/compute` payload,
  /// sourced ONLY from the passed profile map. Kept static and side-effect free
  /// so it can be unit-tested without SharedPreferences or the network.
  static Map<String, dynamic> nutritionPayloadFrom(Map<String, dynamic>? profile) {
    final p = profile ?? const <String, dynamic>{};
    String s(String k, String fb) {
      final v = p[k];
      if (v == null) return fb;
      final str = '$v';
      return str.isEmpty ? fb : str;
    }
    int i(String k, int fb) {
      final v = p[k];
      if (v is num) return v.toInt();
      return int.tryParse('$v'.replaceFirst(RegExp(r'\.0$'), '')) ?? fb;
    }
    List<String> list(String k) {
      final v = p[k];
      if (v is List) return v.whereType<String>().toList();
      return const [];
    }
    return {
      'gender': s('gender', 'male'),
      'age': num0(p['age']),
      'height': num0(p['height']),
      'weight': num0(p['weight']),
      'activity': activityMultiplierFor(p['dailyActivity']),
      'goal': nutritionGoal(p['goal']),
      'target': p['targetWeight'],
      'selectedDiet': s('diet', 'balanced'),
      'mealCount': i('mealCount', 4),
      'healthConditions': list('healthConditions'),
    };
  }

  /// Instance shortcut: the diet tab's single source of truth for targets.
  /// Builds the NUTRITION engine payload from the cached profile (goal is
  /// translated by nutritionPayloadFrom via the nutrition vocabulary).
  Map<String, dynamic> nutritionPayload() => nutritionPayloadFrom(_profile);
}
