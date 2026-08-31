// ── ElForma · models/smart_coach_store.dart ──
// «المتابعة الذكية»: حالة تفعيل/إيقاف بطاقات المدرب الذكي.
// مفعلة تلقائيا (الوضع الحالي)، والمستخدم يقدر يقفلها. الحالة بتتحفظ محليا.

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api.dart';

class SmartCoachStore extends ChangeNotifier {
  SmartCoachStore._();
  static final SmartCoachStore I = SmartCoachStore._();

  // بنخزن «مقفول» بدل «مفتوح» علشان الافتراضي (مفيش مفتاح) = مفعل.
  static const String _key = 'ef_smart_coach_off_v1';

  bool _enabled = true;
  bool get enabled => _enabled;

  bool _ready = false;
  bool get ready => _ready;

  Future<void> init() async {
    try {
      final sp = await SharedPreferences.getInstance();
      _enabled = !(sp.getBool(_key) ?? false);
    } catch (_) {
      _enabled = true;
    }
    _ready = true;
    notifyListeners();
    // السيرفر هو مصدر الحقيقة: ال gating للتمرين/التغذية بيتم
    // حسب تفضيل المستخدم المخزن في السيرفر. بنزامن في الخلفية.
    unawaited(_pullFromServer());
  }

  Future<void> _pullFromServer() async {
    try {
      final r = await Api.I.getSmartCoach();
      if (r.ok && r.data.containsKey('smartCoach')) {
        final v = r.data['smartCoach'] == true;
        if (v != _enabled) {
          _enabled = v;
          notifyListeners();
          final sp = await SharedPreferences.getInstance();
          await sp.setBool(_key, !v);
        }
      }
    } catch (_) {}
  }

  /// مزامنة فورية من قيمة جاية مع bootstrap (smartCoach).
  Future<void> syncFromServer(bool value) async {
    if (value == _enabled && _ready) return;
    _enabled = value;
    _ready = true;
    notifyListeners();
    try {
      final sp = await SharedPreferences.getInstance();
      await sp.setBool(_key, !value);
    } catch (_) {}
  }

  Future<void> setEnabled(bool value) async {
    if (_enabled == value) return;
    _enabled = value;
    notifyListeners();
    try {
      final sp = await SharedPreferences.getInstance();
      // مخزن ك off: true يعني مقفول.
      await sp.setBool(_key, !value);
    } catch (_) {
      // لو فشل الحفظ بيفضل متغير في الذاكرة لحد ما ينجح مرة تانية.
    }
    // [OWNER-RULE] الزر يتحكم فعليا: بنبلغ السيرفر عشان يوقف/يشغل
    // التطوير والتحديث التلقائي للتمرين والتغذية (مع طابور أوفلاين).
    try {
      await Api.I.setSmartCoach(value);
    } catch (_) {}
  }
}
