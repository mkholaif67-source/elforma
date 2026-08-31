// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// engine/rest.js — REST POLICY: single source of truth
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// سياسة الراحة الموحدة لكل النظام:
//   • تنشيف / تضخيم / لياقة: الراحة لا تتجاوز 3 دقائق (180 ثانية) أبدا.
//   • قوة: معفاة — المركبات الثقيلة تحتاج 3–5 دقائق.
// كل عرض أو حساب للراحة في أي ملف لازم يمر من الدوال دي.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function (root) {
  'use strict';

  var REST_CAP_SEC = 180; // 3 دقائق — سقف العزل/المركب العادي للأهداف غير القوة
  var REST_CAP_HEAVY_SEC = 240; // المركبات الثقيلة: حتى 4 دقائق حتى في الضخامة (Schoenfeld 2016: راحة أطول = تضخم أعلى)

  // ملحوظة: "دقيق" تلتقط المفرد (دقيقة) والمثنى (دقيقتين)، و"دقائق" تلتقط الجمع.
  // [إصلاح باق كامن]: الجمع "دقائق" لا يحتوي "دقيق" فكان يقرأ ثوان خطأ.
  function _isMinutes(s) { return /دقيق|دقائق|min/i.test(String(s)); }
  function _nums(s) { return (String(s).match(/\d+/g) || []).map(Number); }
  function _isStrength(goal) { return goal === 'strength' || goal === 'قوة'; }
  // سقف الراحة حسب الهدف ونوع التمرين: القوة معفاة (∞)، المركب الثقيل 240ث، الباقي 180ث.
  function _capFor(goal, exType) {
    if (_isStrength(goal)) return Infinity;
    return exType === 'heavy_compound' ? REST_CAP_HEAVY_SEC : REST_CAP_SEC;
  }

  // Average rest in seconds — used for math (progression, time estimates).
  // الحد الأدنى المطلق للراحة: 45 ثانية — حتى لقوة التحمل والدوائر
  // الأساس العلمي: ACSM / Schoenfeld: أقل من 45 ثانية يرفع الحموضة (lactate)
  // ويضر بجودة المجموعات التالية — لا يوجد هدف رياضي آمن يستدعي أقل من 45 ثانية.
  var REST_FLOOR_SEC = 45;

  function restToSeconds(rest, goal, exType) {
    if (rest == null || rest === '') return null;
    var cap = _capFor(goal, exType);
    if (typeof rest === 'number') {
      return Math.min(Math.max(rest, REST_FLOOR_SEC), cap);
    }
    var nums = _nums(rest);
    if (!nums.length) return 90;
    var avg = nums.reduce(function (a, b) { return a + b; }, 0) / nums.length;
    var sec = Math.round(_isMinutes(rest) ? avg * 60 : avg);
    // الحد الأدنى 45 ث — الحد الأقصى حسب الهدف ونوع التمرين
    return Math.min(Math.max(sec, REST_FLOOR_SEC), cap);
  }

  // Pretty-print a seconds value into an Arabic label.
  function formatRestSeconds(sec) {
    if (sec == null) return '\u2014';
    sec = Math.round(sec);
    if (sec < 90) return sec + ' ثانية';
    if (sec % 60 === 0) { var m = sec / 60; return m + (m === 1 ? ' دقيقة' : ' دقائق'); }
    return (Math.round(sec / 60 * 10) / 10) + ' دقيقة';
  }

  // Canonical, cap-enforced display label. Use at the DATA SOURCE (where goal
  // is known) so every downstream consumer inherits a compliant value.
  // Within the cap it preserves the engine's descriptive range label
  // (e.g. "2-3 دقائق", "30-45 ثانية"); only clamps when a non-strength value
  // would exceed 3 minutes.
  function canonicalRestLabel(rest, goal, exType) {
    if (rest == null || rest === '') return '\u2014';
    var cap = _capFor(goal, exType);
    if (typeof rest === 'number') {
      return formatRestSeconds(Math.min(rest, cap));
    }
    var s = String(rest).trim();
    var nums = _nums(s);
    if (!nums.length) return s;
    var isMin = _isMinutes(s);
    var allSec = nums.map(function (n) { return isMin ? n * 60 : n; });
    var maxSec = Math.max.apply(null, allSec);
    var minSec = Math.min.apply(null, allSec);
    // سقف من الأعلى + أرضية من الأسفل
    if (minSec < REST_FLOOR_SEC) {
      // الكل تحت الأرضية: ارجع الأرضية مباشرة
      if (maxSec <= REST_FLOOR_SEC) return formatRestSeconds(REST_FLOOR_SEC);
      // نطاق يبدأ أقل من الأرضية: اضبط الحد الأدنى للنطاق
      var newMin = REST_FLOOR_SEC;
      var newMax = Math.min(maxSec, cap);
      return newMin === newMax ? formatRestSeconds(newMin) : (newMin + '-' + newMax + ' ثانية');
    }
    if (maxSec <= cap) return s;
    return formatRestSeconds(cap);
  }

  // Pure display formatter for ALREADY-canonical data (render sites). Handles
  // both numeric seconds (e.g. coach-adjusted rest) and string labels.
  function fmtRest(rest) {
    if (rest == null || rest === '') return '\u2014';
    if (typeof rest === 'number') return formatRestSeconds(rest);
    return String(rest);
  }

  // Enforce the 3-minute cap across an entire plan in place (belt-and-suspenders).
  function enforceRestCapOnPlan(plan, goal) {
    if (!plan || !plan.forEach || _isStrength(goal)) return plan;
    plan.forEach(function (day) {
      if (!day || !day.exercises) return;
      day.exercises.forEach(function (e) {
        if (!e || e.rest == null) return;
        e.rest = canonicalRestLabel(e.rest, goal, e.exType);
      });
    });
    return plan;
  }

  root.REST_CAP_SEC = REST_CAP_SEC;
  root.REST_CAP_HEAVY_SEC = REST_CAP_HEAVY_SEC;
  root.restToSeconds = restToSeconds;
  root.formatRestSeconds = formatRestSeconds;
  root.canonicalRestLabel = canonicalRestLabel;
  root.fmtRest = fmtRest;
  root.enforceRestCapOnPlan = enforceRestCapOnPlan;
})(typeof window !== 'undefined' ? window : this);
