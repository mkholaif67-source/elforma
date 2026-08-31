// ── ElForma · api.dart ──
// HTTP client for the ElForma backend: session cookie capture/restore (secure storage),
// an offline write queue that replays on reconnect, and one typed method per endpoint.
// Behaviour contract: every call returns ApiResult(ok/data/error); never throws to the UI.
// عميل الشبكة: جلسة مشفرة + طابور أوفلاين + دالة لكل مسار. كل نداء يرجع ApiResult.

import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiResult {
  final int status;
  final Map<String, dynamic> data;
  ApiResult(this.status, this.data);
  bool get ok => status >= 200 && status < 300;
  String get error => (data['error'] ?? '').toString();

  /// Sprint 15: the engine now refuses impossible bodies (missing height, a
  /// 5 cm person, a negative weight) instead of quietly returning a
  /// zero-protein plan. Those refusals arrive as 422 carrying a ready-made
  /// Arabic sentence naming the field to fix.
  bool get isProfileIncomplete => status == 422 && error == 'profile_incomplete';

  /// The friendliest sentence available: the server's own guidance first, then
  /// a human-readable error, then the caller's fallback. A raw code such as
  /// `engine_missing_age` must never reach a human being.
  // كلمات متعلقة بالهاتف يجب مسحها دائماً من الواجهة
  static final _phoneErrRx = RegExp(
    r'هاتف|تحقق|تفعيل|مراجعة|رقم.*هاتف|phone|verify.*phone|phone.*verif|phone_required|unverified_phone|needs_phone',
    caseSensitive: false,
  );

  String friendlyError(String fallback) {
    final guidance = (data['message'] ?? '').toString().trim();
    // [FIX-PERMANENT] لو الرسالة تتكلم عن الهاتف → تجاهلها وارجع الفال بدل من إظهار رسالة خطأ
    if (guidance.isNotEmpty && !_phoneErrRx.hasMatch(guidance)) return guidance;
    if (error.isNotEmpty && !error.contains('_') && !_phoneErrRx.hasMatch(error)) return error;
    return fallback;
  }
}

/// Single API client that talks to the live ElForma backend and keeps the
/// ef_session cookie so the user stays logged in across app restarts.
class Api {
  Api._();
  static final Api I = Api._();

  static const String baseUrl = String.fromEnvironment(
    'EF_BASE_URL',
    defaultValue: 'https://elforma.onrender.com',
  );

  String? _cookie;
  static const _cookieKey = 'ef_cookie';
  static const _queueKey = 'ef_offline_mutations_v1';
  // [OWNER-RULE] ثبات البيانات: أي كاش محلي لازم يكون مربوط بصاحبه.
  // قبل كده المفاتيح كانت عامة، فلو حساب تاني فتح على نفس الجهاز كان بيلاقي
  // داتا اللي قبله — وده سبب إن المستخدم يقفل ويفتح يلاقي داتا غير بتاعته.
  static const _accountIdKey = 'ef_account_id';
  String? _accountId;
  // [TRIAL-DEVICE] معرّف ثابت للجهاز يتخزن مرة واحدة في التخزين الآمن، عشان
  // السيرفر يقدر يمنع تكرار التجربة المجانية على نفس الجهاز حتى لو المستخدم
  // عمل حساب جديد بإيميل تاني. مابيتغيرش مع تسجيل الخروج/الدخول.
  static const _deviceIdKey = 'ef_device_id';
  String? _deviceId;
  bool _flushing = false;

  /// معرف الحساب الحالي (لو معروف). المخازن بتستخدمه عشان تعزل الكاش.
  String? get accountId => _accountId;

  /// يربط الجهاز بحساب معين. لو الحساب اتغير عن اللي مخزن، بنمسح كل
  /// الكاش المحلي فورا عشان مايظهرش للمستخدم الجديد داتا حد تاني.
  /// بيرجع true لو حصل تبديل حساب (عشان المخازن تفضي نفسها كمان).
  Future<bool> bindAccount(Object? userId) async {
    final id = (userId == null) ? '' : '$userId'.trim();
    if (id.isEmpty) return false;
    final sp = await SharedPreferences.getInstance();
    final previous = sp.getString(_accountIdKey);
    _accountId = id;
    if (previous == id) return false;
    if (previous != null && previous.isNotEmpty) {
      // حساب مختلف على نفس الجهاز: نفضي كل الكاش والطابور القديم.
      // مهم أمنيا: طابور أوفلاين لحساب قديم ماينفعش يتبعت لحساب جديد.
      final keys = sp.getKeys().where((k) => k != _cookieKey).toList();
      for (final k in keys) {
        await sp.remove(k);
      }
    }
    await sp.setString(_accountIdKey, id);
    return previous != null && previous.isNotEmpty;
  }

  /// معرّف ثابت للجهاز. يتولّد مرة واحدة ويتخزن في التخزين الآمن (Keychain/
  /// EncryptedSharedPreferences)، فبيفضل ثابت عبر تسجيل الدخول والخروج،
  /// عشان يمنع أخذ التجربة المجانية أكتر من مرة على نفس الجهاز.
  Future<String> deviceId() async {
    if (_deviceId != null && _deviceId!.isNotEmpty) return _deviceId!;
    var id = await _secure.read(key: _deviceIdKey);
    if (id == null || id.isEmpty) {
      final rnd = Random.secure();
      final bytes = List<int>.generate(16, (_) => rnd.nextInt(256));
      id = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
      await _secure.write(key: _deviceIdKey, value: id);
    }
    _deviceId = id;
    return id;
  }

  // The session cookie is a bearer credential: anyone who reads it is logged in
  // as the user. It therefore lives in the OS-backed encrypted store (Keychain
  // on iOS, EncryptedSharedPreferences on Android), NOT in plaintext
  // SharedPreferences. Only the (non-sensitive) offline queue stays in SP.
  static const FlutterSecureStorage _secure = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<void> init() async {
    _cookie = await _secure.read(key: _cookieKey);
    // [CRITICAL FIX] Restore _accountId from SharedPreferences on every startup.
    // Without this, _accountId stays null until the next login/signup, and every
    // cache key falls back to 'anon', creating a shared bucket across ALL accounts.
    // Result: Account B sees Account A's cached workout plan, calories, and profile.
    final sp = await SharedPreferences.getInstance();
    _accountId = sp.getString(_accountIdKey);

    // Purge any leftover 'anon' cache entries from previous buggy builds.
    // These could contain another user's data that was cached before accountId
    // was properly restored. One-time cost at startup; safe to run every time.
    final anonPrefix = '${_readCachePrefix}anon:';
    final staleKeys = sp.getKeys().where((k) => k.startsWith(anonPrefix)).toList();
    for (final k in staleKeys) { await sp.remove(k); }

    if (_cookie == null || _cookie!.isEmpty) {
      // One-time migration: older builds stored the session in plaintext
      // SharedPreferences. Move any existing session into secure storage and
      // scrub the old copy, so upgrading users are NOT logged out and no
      // plaintext credential is left behind.
      final legacy = sp.getString(_cookieKey);
      if (legacy != null && legacy.isNotEmpty) {
        _cookie = legacy;
        await _secure.write(key: _cookieKey, value: legacy);
        await sp.remove(_cookieKey);
      }
    }
  }

  Map<String, String> _headers({bool json = false}) {
    final h = <String, String>{'Accept': 'application/json'};
    // [FIX-TZ] نبعت الـUTC offset من جهاز المستخدم — مش من IP السيرفر.
    // بيتغير تلقائيًا لو المستخدم سافر أو غيّر توقيت جهازه.
    h['X-Tz-Offset'] = DateTime.now().timeZoneOffset.inMinutes.toString();
    if (json) h['Content-Type'] = 'application/json';
    if (_cookie != null && _cookie!.isNotEmpty) h['Cookie'] = _cookie!;
    return h;
  }

  Future<void> _capture(http.Response r) async {
    final raw = r.headers['set-cookie'];
    if (raw == null) return;
    final m = RegExp(r'ef_session=([^;]*)').firstMatch(raw);
    if (m == null) return;
    final val = m.group(1) ?? '';
    if (val.isEmpty) {
      _cookie = null;
      await _secure.delete(key: _cookieKey);
    } else {
      _cookie = 'ef_session=$val';
      await _secure.write(key: _cookieKey, value: _cookie!);
    }
  }

  ApiResult _parse(http.Response r) {
    dynamic d;
    try {
      d = jsonDecode(r.body);
    } catch (_) {
      d = null;
    }
    final map = (d is Map) ? Map<String, dynamic>.from(d) : <String, dynamic>{};
    return ApiResult(r.statusCode, map);
  }

  Future<void> _enqueue(String method, String path, Map<String, dynamic> body) async {
    if (_cookie == null || _cookie!.isEmpty) return;
    final sp = await SharedPreferences.getInstance();
    List<dynamic> queue;
    try {
      queue = jsonDecode(sp.getString(_queueKey) ?? '[]') as List<dynamic>;
    } catch (_) {
      queue = <dynamic>[];
    }
    queue.add({'method': method, 'path': path, 'body': body, 'createdAt': DateTime.now().toIso8601String()});
    if (queue.length > 100) queue = queue.sublist(queue.length - 100);
    await sp.setString(_queueKey, jsonEncode(queue));
  }

  Future<int> pendingOfflineCount() async {
    final sp = await SharedPreferences.getInstance();
    try {
      final queue = jsonDecode(sp.getString(_queueKey) ?? '[]');
      return queue is List ? queue.length : 0;
    } catch (_) { return 0; }
  }

  Future<int> flushOfflineQueue() async {
    if (_flushing || _cookie == null || _cookie!.isEmpty) return pendingOfflineCount();
    _flushing = true;
    try {
      final sp = await SharedPreferences.getInstance();
      List<dynamic> queue;
      try { queue = jsonDecode(sp.getString(_queueKey) ?? '[]') as List<dynamic>; }
      catch (_) { queue = <dynamic>[]; }
      // [OWNER-RULE] المزامنة مابتقفش عند أول فشل.
      // قبل كده أي طلب بايظ (مثلا 400) كان بيعمل break ويقفل الطابور للأبد،
      // فكل اللي وراه مايوصلش أبدا. دلوقتي:
      //   • خطأ دائم (4xx) ← نرمي العنصر ونكمل، لأن إعادته مش هتنجح.
      //   • مشكلة شبكة أو سيرفر (5xx / انقطاع) ← نقف ونحاول تاني بعدين.
      var guard = 0;
      while (queue.isNotEmpty && guard < 200) {
        guard++;
        final raw = queue.first;
        if (raw is! Map) { queue.removeAt(0); continue; }
        try {
          final method = '${raw['method']}';
          final path = '${raw['path']}';
          final body = raw['body'] is Map ? Map<String, dynamic>.from(raw['body'] as Map) : <String, dynamic>{};
          final uri = Uri.parse('$baseUrl$path');
          final encoded = jsonEncode(body);
          late http.Response response;
          if (method == 'POST') {
            response = await http.post(uri, headers: _headers(json: true), body: encoded).timeout(const Duration(seconds: 25));
          } else {
            response = await http.put(uri, headers: _headers(json: true), body: encoded).timeout(const Duration(seconds: 25));
          }
          await _capture(response);
          final code = response.statusCode;
          final ok = code >= 200 && code < 300;
          final permanentlyBad = code >= 400 && code < 500 && code != 408 && code != 429;
          if (!ok && !permanentlyBad) break; // مشكلة مؤقتة — نستنى
          queue.removeAt(0);
          await sp.setString(_queueKey, jsonEncode(queue));
        } catch (_) { break; }
      }
      return queue.length;
    } finally {
      _flushing = false;
    }
  }

  // ---- كاش القراءات للأوفلاين -------------------------------------
  // [OWNER-RULE] التطبيق لازم يفتح ويوري الخطة حتى من غير نت.
  // الطابور كان بيحفظ اللي المستخدم بيكتبه بس، لكن القراءات (الخطة، الجدول،
  // الأسعار) كانت بترجع فاضية فالشاشة تطلع بيضا. دلوقتي بنخزن آخر رد
  // ناجح لكل مسار GET ونرجعه لو النت قطع، مع علم fromCache عشان
  // الشاشة تقدر تقول للمستخدم إن ده آخر نسخة محفوظة.
  // الكاش مختوم بمعرف الحساب، فمستحيل حساب يشوف داتا حساب تاني.
  static const _readCachePrefix = 'ef_read_cache_v1:';

  // مسارات بس اللي بينفع تتخزن؛ أي حاجة حساسة (تصدير البيانات) بره.
  static const _cacheableGets = <String>[
    '/api/mobile/bootstrap',
    '/api/mobile/nutrition-plan',
    '/api/mobile/workout-history',
    '/api/mobile/modules',
    '/api/plans',
  ];

  bool _isCacheable(String method, String path) {
    if (method != 'GET') return false;
    for (final p in _cacheableGets) {
      if (path == p || path.startsWith('$p?')) return true;
    }
    return false;
  }

  String _cacheKeyFor(String path) =>
      '$_readCachePrefix${_accountId ?? 'anon'}:$path';

  Future<void> _cacheRead(String path, Map<String, dynamic> data) async {
    try {
      final sp = await SharedPreferences.getInstance();
      await sp.setString(_cacheKeyFor(path), jsonEncode({
        'at': DateTime.now().toIso8601String(),
        'data': data,
      }));
    } catch (_) {}
  }

  Future<ApiResult?> _cachedRead(String path) async {
    try {
      final sp = await SharedPreferences.getInstance();
      final raw = sp.getString(_cacheKeyFor(path));
      if (raw == null || raw.isEmpty) return null;
      final decoded = jsonDecode(raw);
      if (decoded is! Map || decoded['data'] is! Map) return null;
      final data = Map<String, dynamic>.from(decoded['data'] as Map);
      data['fromCache'] = true;
      data['cachedAt'] = decoded['at'];
      return ApiResult(200, data);
    } catch (_) {
      return null;
    }
  }

  Future<ApiResult> _send(String method, String path,
      [Map<String, dynamic>? body, bool queueOnFailure = false]) async {
    try {
      final uri = Uri.parse('$baseUrl$path');
      final headers = _headers(json: body != null);
      final b = body != null ? jsonEncode(body) : null;
      const t = Duration(seconds: 70);
      late http.Response r;
      switch (method) {
        case 'POST':
          r = await http.post(uri, headers: headers, body: b).timeout(t);
          break;
        case 'PUT':
          r = await http.put(uri, headers: headers, body: b).timeout(t);
          break;
        default:
          r = await http.get(uri, headers: headers).timeout(t);
      }
      await _capture(r);
      if (!_flushing && r.statusCode >= 200 && r.statusCode < 300) {
        unawaited(flushOfflineQueue());
      }
      final parsed = _parse(r);
      // نخزن آخر نسخة ناجحة عشان تشتغل أوفلاين بعد كده.
      if (parsed.ok && _isCacheable(method, path)) {
        unawaited(_cacheRead(path, parsed.data));
      }
      return parsed;
    } catch (_) {
      if (queueOnFailure && body != null) {
        await _enqueue(method, path, body);
        return ApiResult(202, {'ok': true, 'queued': true, 'message': 'تم الحفظ على الهاتف وسيتم الإرسال تلقائيا عند عودة الإنترنت'});
      }
      // مفيش نت: بدل ما الشاشة تطلع فاضية، ندي آخر نسخة محفوظة.
      if (_isCacheable(method, path)) {
        final cached = await _cachedRead(path);
        if (cached != null) return cached;
      }
      return ApiResult(0, {'error': 'تعذر الاتصال بالخادم تأكد من الإنترنت وحاول تاني'});
    }
  }

  /// رد المتدرب على سؤال الالتزام (يتخزن أوفلاين ويتبعت لما النت يرجع).
  Future<ApiResult> submitCheckin({required String scope, required String answer}) =>
      _send('POST', '/api/mobile/checkin', {'scope': scope, 'answer': answer}, true);

  // أي رد فيه بيانات مستخدم بنربط بيه الجهاز، عشان لو الحساب اتغير
  // يتمسح الكاش القديم قبل ما أي شاشة تقراه.
  Future<void> _bindFrom(ApiResult r) async {
    if (!r.ok) return;
    final u = r.data['user'];
    if (u is Map && u['id'] != null) await bindAccount(u['id']);
  }

  Future<ApiResult> me() async {
    final r = await _send('GET', '/api/auth/me');
    await _bindFrom(r);
    return r;
  }

  // --- Account recovery & session security -------------------------------
  // The server always answers 200 here so that a stranger cannot use this
  // endpoint to discover which emails have accounts.
  Future<ApiResult> forgotPassword(String email) =>
      _send('POST', '/api/auth/forgot', {'email': email});
  Future<ApiResult> resetPassword(String token, String password) =>
      _send('POST', '/api/auth/reset', {'token': token, 'password': password});
  // Revokes every other device's session; this device stays signed in.
  Future<ApiResult> logoutAllDevices() =>
      _send('POST', '/api/account/logout-all', const {});
  // تعديل بيانات الحساب (الاسم/البريد/الهاتف). السيرفر بيرفض التكرار (409)،
  // ويطلب رقم هاتف بصيغة دولية، ولازم يفضل بريد أو هاتف واحد على الأقل.
  Future<ApiResult> updateProfile({String? name, String? email, String? phone}) =>
      _send('POST', '/api/account/profile', {
        if (name != null) 'name': name,
        if (email != null) 'email': email,
        if (phone != null) 'phone': phone,
      });
  // تغيير كلمة المرور — لازم كلمة المرور الحالية صح (403 لو غلط) والجديدة 8 أحرف+.
  // بعد التغيير السيرفر بيقفل الجلسات على باقي الأجهزة ويسيب الجهاز دا داخل.
  Future<ApiResult> changePassword(String current, String next) =>
      _send('POST', '/api/account/password', {'current': current, 'next': next});
  Future<ApiResult> sendVerificationEmail() =>
      _send('POST', '/api/auth/verify/send', const {});
  Future<ApiResult> login(String identifier, String password) async {
    final r = await _send('POST', '/api/auth/login', {'identifier': identifier, 'password': password});
    // لو ده حساب مختلف عن اللي قبله على الجهاز، bindAccount بتمسح كاشه.
    await _bindFrom(r);
    return r;
  }
  Future<ApiResult> signup(Map<String, dynamic> body) async {
    body = {...body, 'deviceId': await deviceId()};
    final r = await _send('POST', '/api/auth/signup', body);
    await _bindFrom(r);
    return r;
  }

  // دخول/تسجيل مباشر بحساب جوجل. التطبيق بيجيب idToken
  // من Google Sign-In والسيرفر بيتحقق منه عند جوجل.
  Future<ApiResult> googleAuth(String idToken, {String? name, String? email}) async {
    final dev = await deviceId();
    final r = await _send('POST', '/api/auth/google', {
      'idToken': idToken,
      'deviceId': dev,
      if (name != null && name.isNotEmpty) 'name': name,
      if (email != null && email.isNotEmpty) 'email': email,
    });
    await _bindFrom(r);
    return r;
  }
  Future<ApiResult> logout() async {
    final result = await _send('POST', '/api/auth/logout', {});
    final sp = await SharedPreferences.getInstance();
    // عند الخروج بنشيل الطابور والكاش وربط الحساب، عشان اللي بعده
    // مايلاقيش أي أثر للحساب السابق.
    await sp.remove(_queueKey);
    await sp.remove(_accountIdKey);
    await sp.remove('ef_profile_cache_v1');
    _accountId = null;
    return result;
  }
  Future<ApiResult> planTargets(Map<String, dynamic> profile) =>
      _send('POST', '/api/plan/targets', {'profile': profile});
  Future<ApiResult> planCompute(Map<String, dynamic> profile) =>
      _send('POST', '/api/plan/compute', {'profile': profile});
  Future<ApiResult> workoutCompute(Map<String, dynamic> profile) =>
      _send('POST', '/api/workout/compute', {'profile': profile});
  Future<ApiResult> plans() => _send('GET', '/api/plans');
  Future<ApiResult> couponCheck(String code, String plan) => _send(
      'POST', '/api/coupon/check', {'code': code, 'plan': plan, 'currency': 'EGP'});
  Future<ApiResult> payManual(Map<String, dynamic> body) =>
      _send('POST', '/api/pay/manual', body);
  // مشاركة الخطة (تمرين/تغذية/الاتنين) برابط مؤقت صالح 48 ساعة.
  // السيرفر بيرجع { url, token, expires, planType }.
  Future<ApiResult> sharePlan({String planType = 'both'}) =>
      _send('POST', '/api/share/plan', {'planType': planType});
  Future<ApiResult> reviewsList() => _send('GET', '/api/reviews');
  Future<ApiResult> reviewMine() => _send('GET', '/api/reviews/mine');
  Future<ApiResult> reviewSubmit(Map<String, dynamic> body) =>
      _send('POST', '/api/reviews', body);
  Future<ApiResult> exportAccountData() => _send('GET', '/api/account/export');
  Future<ApiResult> deleteAccount() async {
    final result = await _send('POST', '/api/account/delete', {});
    if (result.ok) {
      final sp = await SharedPreferences.getInstance();
      await sp.clear();
      await _secure.delete(key: _cookieKey);
      _cookie = null;
    }
    return result;
  }
  Future<ApiResult> sendClientEvent(String type, String message, String stack) =>
      _send('POST', '/api/mobile/client-event', {
        'type': type,
        'message': message,
        'stack': stack,
        // [FIX M2] كان مكتوب '2.8.0+20' بالإيد والتطبيق فعليا 2.10.29+53،
        // يعني كل تقارير الأعطال وإحصاءات الإصدارات كانت بتكدب علينا.
        'appVersion': kAppVersionFull,
      });
  // تبليغ إن فيديو مش شغال
  // بيتحط في طابور صاحب المشروع ولو مفيش نت بيتخزن ويتبعت بعدين
  Future<ApiResult> reportBrokenVideo({
    required String exerciseKey,
    String exerciseName = '',
    String videoId = '',
    String reason = '',
  }) =>
      _send('POST', '/api/app/video-report', {
        'exerciseKey': exerciseKey,
        'exerciseName': exerciseName,
        'videoId': videoId,
        'reason': reason,
      }, true);
  Future<ApiResult> mobileBootstrap({String? day}) => _send('GET',
      '/api/mobile/bootstrap${day == null ? '' : '?day=$day'}');

  /// Admin notifications: in-app notifications sent from the admin dashboard
  Future<ApiResult> getAdminNotifications() =>
      _send('GET', '/api/mobile/notifications');
  // [OWNER-RULE] المتابعة الذكية: تشغيل/إيقاف التطوير التلقائي
  // للتمرين والتغذية. السيرفر بيرجع { ok, smartCoach }.
  Future<ApiResult> getSmartCoach() => _send('GET', '/api/mobile/smart-coach');
  Future<ApiResult> setSmartCoach(bool enabled) =>
      _send('PUT', '/api/mobile/smart-coach', {'enabled': enabled}, true);
  // [OWNER-RULE] تفعيل تجربة 3 أيام مجانا — البيان الوحيد رقم الهاتف.
  // السيرفر بيمنع تكرار التجربة لنفس العميل (بالحساب أو الهاتف).
  // [EGY] الرقم بيتاخد في التسجيل، فالتفعيل المجاني بقى مباشر.
  // لو مابعتناش رقم، السيرفر بيستخدم رقم الحساب المخزّن.
  Future<ApiResult> startTrial([String phone = '']) async =>
      _send('POST', '/api/mobile/trial/start',
          {'phone': phone, 'deviceId': await deviceId()});
  /// كتالوج الوحدات المساعدة بتمارينها الحقيقية من المحرك — مش مجرد مفاتيح تشغيل.
  Future<ApiResult> moduleCatalogue() => _send('GET', '/api/mobile/modules');
  Future<ApiResult> saveMobileProfile(Map<String, dynamic> profile) =>
      _send('PUT', '/api/mobile/profile', {'profile': profile}, true);
  Future<ApiResult> activateWorkoutPlan(String key, Map<String, dynamic> plan) =>
      _send('PUT', '/api/mobile/workout-plan', {'key': key, 'plan': plan}, true);
  Future<ApiResult> startWorkoutSession(String dayKey, String dayName) =>
      _send('POST', '/api/mobile/session/start',
          {'dayKey': dayKey, 'dayName': dayName});
  Future<ApiResult> saveWorkoutSet(Map<String, dynamic> set) =>
      _send('PUT', '/api/mobile/session/set', set, true);
  /// Sprint 18: the history call also carries the exercise's prescription and the
  /// trainee's position in the mesocycle, so the server can answer with the smart
  /// coach's next-session target (double progression, RIR waving, deload) exactly
  /// the way the website's coach.js does.
  Future<ApiResult> exerciseHistory(
    String exerciseKey, {
    String? name,
    String? reps,
    int? sets,
    String? experience,
    int? mesoWeek,
    int? mesoLength,
  }) {
    final params = <String, String>{
      'exerciseKey': exerciseKey,
      if (name != null && name.isNotEmpty) 'name': name,
      if (reps != null && reps.isNotEmpty) 'reps': reps,
      if (sets != null) 'sets': '$sets',
      if (experience != null && experience.isNotEmpty) 'exp': experience,
      if (mesoWeek != null) 'mweek': '$mesoWeek',
      if (mesoLength != null) 'meso': '$mesoLength',
    };
    return _send('GET',
        '/api/mobile/exercise-history?${Uri(queryParameters: params).query}');
  }
  Future<ApiResult> exerciseAlternatives(String current,
      {String equipment = 'gym', String goal = 'muscle', List<String> injuries = const []}) {
    final params = <String, String>{
      'current': current,
      'equipment': equipment,
      'goal': goal,
      if (injuries.isNotEmpty) 'injuries': injuries.join(','),
    };
    return _send('GET', '/api/mobile/exercise-alternatives?${Uri(queryParameters: params).query}');
  }
  Future<ApiResult> workoutHistory() => _send('GET', '/api/mobile/workout-history');

  /// Sprint 12: the adaptive nutrition brain. Runs the original diet engine
  /// with the full set of inputs it expects, then layers adaptive TDEE,
  /// adherence analysis and plan-staleness detection on top.
  /// [FIX-DAY-TIERS] offset: 0=today, 1=tomorrow, 2=day after...
  /// Server uses _localDate + offset to pick the right plan slot.
  Future<ApiResult> nutritionPlan({bool withMeals = true, int dayOffset = 0}) {
    final base = '/api/mobile/nutrition-plan';
    final params = <String>[];
    if (!withMeals) params.add('plan=0');
    if (dayOffset != 0) params.add('offset=$dayOffset');
    final qs = params.isNotEmpty ? '?' + params.join('&') : '';
    return _send('GET', base + qs);
  }
  Future<ApiResult> finishWorkoutSession(
          int sessionId, int durationSec, String notes) =>
      _send('POST', '/api/mobile/session/finish', {
        'sessionId': sessionId,
        'durationSec': durationSec,
        'notes': notes,
      }, true);
  Future<ApiResult> saveNutritionDay(Map<String, dynamic> value) =>
      _send('PUT', '/api/mobile/nutrition', value, true);
  Future<ApiResult> searchFoods(String query,
      {String category = 'all', String diet = 'balanced', List<String> health = const []}) {
    final params = <String, String>{
      'q': query,
      'cat': category,
      'diet': diet,
      if (health.isNotEmpty) 'health': health.join(','),
    };
    return _send('GET', '/api/mobile/foods?${Uri(queryParameters: params).query}');
  }
  Future<ApiResult> foodPreferences() => _send('GET', '/api/mobile/food-preferences');
  Future<ApiResult> saveFoodPreference(String foodId, {bool? favorite, bool used = false}) =>
      _send('PUT', '/api/mobile/food-preference', {
        'foodId': foodId,
        if (favorite != null) 'favorite': favorite,
        if (used) 'used': true,
      }, true);
  Future<ApiResult> saveWeight(double weight, {String? day, String? note}) =>
      _send('PUT', '/api/mobile/weight', {
        'weight': weight,
        if (day != null) 'day': day,
        if (note != null) 'note': note,
      }, true);
  Future<ApiResult> saveMeasurement(Map<String, dynamic> value) =>
      _send('PUT', '/api/mobile/measurement', value, true);
  Future<ApiResult> getState() => _send('GET', '/api/state');
  // ── Meal Overrides ──────────────────────────────────────────────────────────
  Future<ApiResult> saveMealOverride({
    required String date,
    required String slot,
    required String originalFoodId,
    required String replacementFoodId,
    String? reason,
  }) => _send('POST', '/api/mobile/nutrition/override', {
    'date': date,
    'slot': slot,
    'originalFoodId': originalFoodId,
    'replacementFoodId': replacementFoodId,
    if (reason != null) 'reason': reason,
  });

  Future<ApiResult> getMealOverrides(String date) =>
    _send('GET', '/api/mobile/nutrition/overrides?date=\$date');

  // ── Phone OTP ──────────────────────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  // PayPal: create order → user approves in browser → capture
  // [FIX] إضافة PayPal كوسيلة دفع إضافية عالمية
  // ───────────────────────────────────────────────────────────────────────────
  Future<ApiResult> paypalCreate(String planCode, {String? coupon}) =>
      _send('POST', '/api/pay/paypal/create', {
        'plan': planCode,
        if (coupon != null && coupon.isNotEmpty) 'coupon': coupon,
      });

  Future<ApiResult> paypalCapture(String orderId) =>
      _send('POST', '/api/pay/paypal/capture', {'orderId': orderId});

  Future<ApiResult> sendPhoneOtp(String phone) =>
    _send('POST', '/api/auth/phone/otp/send', {'phone': phone});

  Future<ApiResult> verifyPhoneOtp(String phone, String otp) =>
    _send('POST', '/api/auth/phone/otp/verify', {'phone': phone, 'otp': otp});

  // ── Email Verify ──────────────────────────────────────────────────────────
  Future<ApiResult> sendEmailVerify() =>
    _send('POST', '/api/auth/verify/send', {});

  Future<ApiResult> putState(Map<String, dynamic> changes) =>
      _send('PUT', '/api/state', {'changes': changes}, true);

  /// Public release gate. Costs one tiny request on cold start and is the only
  /// way to retire a broken build that is already on people's phones.
  Future<ApiResult> appVersion() => _send('GET', '/api/app/version');

  /// تسجيل جهاز المستخدم عند السيرفر عشان يقدر يبعتله إشعار.
  /// مابيرميش أبدًا: فشل التسجيل ماينفعش يوقف التطبيق.
  Future<ApiResult> registerDevice(String token, String platform, int appBuild) =>
      _send('POST', '/api/mobile/device/register',
          {'token': token, 'platform': platform, 'appBuild': appBuild});

  Future<ApiResult> unregisterDevice(String token) =>
      _send('POST', '/api/mobile/device/unregister', {'token': token});

  /// إعدادات التطبيق الحيّة اللي الأدمن بيتحكم فيها من اللوحة.
  Future<ApiResult> getAppConfig() => _send('GET', '/api/mobile/app-config');
}

/// This build's number, and it MUST equal the `+N` in mobile/pubspec.yaml.
/// A silent mismatch would make the update gate compare the wrong number and
/// either block everybody or block nobody, so `test/app-version-gate.test.js`
/// asserts the two stay equal and fails the build if they ever drift.
const int kAppBuild = 53;
// [FIX M2] مصدر واحد للحقيقة لرقم الإصدار، متطابق مع mobile/pubspec.yaml.
// لو غيرت الإصدار في pubspec غيره هنا كمان (test/app-version-gate بيمسك البيلد).
const String kAppVersionName = '2.10.29';
const String kAppVersionFull = '$kAppVersionName+$kAppBuild';

/// What the server told us to do about this build.
enum UpdateVerdict { ok, suggested, required }

class UpdateGate {
  final UpdateVerdict verdict;
  final String message;
  final String storeUrl;

  /// وضع الصيانة من لوحة الإدارة. بيمنع الاستخدام مثل التحديث الإجباري،
  /// لكن الرسالة والعنوان بيجوا من الأدمن ومفيش زر تحديث.
  final bool maintenance;
  final String maintenanceTitle;
  const UpdateGate(this.verdict, this.message, this.storeUrl,
      {this.maintenance = false, this.maintenanceTitle = ''});

  /// Never blocks on a network failure. If the check itself cannot run we let
  /// the user in: a flaky connection must not turn into a locked app.
  static Future<UpdateGate> check() async {
    try {
      final res = await Api.I.appVersion();
      if (!res.ok) return const UpdateGate(UpdateVerdict.ok, '', '');
      int asInt(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
      final minBuild = asInt(res.data['minBuild']);
      final latestBuild = asInt(res.data['latestBuild']);
      final storeUrl = '${res.data['storeUrl'] ?? ''}';
      final message = '${res.data['message'] ?? ''}'.trim();

      // الصيانة لها الأولوية: لو الأدمن قافل التطبيق، مفيش فايدة من الدخول.
      if (res.data['maintenance'] == true) {
        final mMsg = '${res.data['maintenanceMessage'] ?? ''}'.trim();
        final mTitle = '${res.data['maintenanceTitle'] ?? ''}'.trim();
        return UpdateGate(
          UpdateVerdict.required,
          mMsg.isEmpty ? 'التطبيق في صيانة مؤقتة، جرّب تاني بعد شوية' : mMsg,
          '',
          maintenance: true,
          maintenanceTitle: mTitle.isEmpty ? 'صيانة مؤقتة' : mTitle,
        );
      }

      if (minBuild > 0 && kAppBuild < minBuild) {
        return UpdateGate(
          UpdateVerdict.required,
          message.isEmpty
              ? 'فيه نسخة جديدة لازم تنزلها عشان تكمل النسخة اللي معاك بقت قديمة'
              : message,
          storeUrl,
        );
      }
      if (latestBuild > 0 && kAppBuild < latestBuild) {
        return UpdateGate(
          UpdateVerdict.suggested,
          message.isEmpty ? 'فيه تحديث جديد متاح للتطبيق' : message,
          storeUrl,
        );
      }
    } catch (_) {
      // Deliberately silent — see the note above.
    }
    return const UpdateGate(UpdateVerdict.ok, '', '');
  }
}
