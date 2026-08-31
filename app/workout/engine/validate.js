// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// engine/validate.js — FINAL PLAN VALIDATOR (single source of truth)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// حارس جودة نهائي يفحص الخطة قبل عرضها للمستخدم. يكتشف:
//   • تمارين تخالف نوع اليوم (صدر/ذراع على Lower، أرجل على Upper).
//   • تكرار نفس التمرين أسبوعيا فوق المسموح.
//   • قيم راحة غير بشرية (مثل 72 ثانية).
//   • أيام أقل من الحد الأدنى للتمارين.
// تستخدم الدوال دي من أي ملف (المتصفح أو الاختبارات).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function (root) {
  'use strict';

  var LOWER_KEYS = ['quads', 'hamstrings', 'glutes', 'calves', 'adductors'];
  var UPPER_KEYS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'traps', 'forearms'];
  // التكرار الأسبوعي المسموح لكل عضلة (افتراضي = 1)
  var MAX_WEEKLY_FREQ = { calves: 2, shoulders: 2, core: 2, abs: 2 };
  // قيم الراحة البشرية المقبولة (بالثواني)
  var HUMAN_REST_SEC = [30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300];

  function _grpsOf(day) {
    return new Set((day.groups || []).map(function (g) {
      return Array.isArray(g) ? g[0] : g;
    }));
  }

  function dayArchetype(day) {
    var s = _grpsOf(day);
    var isLower = LOWER_KEYS.some(function (k) { return s.has(k); });
    var isUpper = UPPER_KEYS.some(function (k) { return s.has(k); });
    if (isLower && !isUpper) return 'lower';
    if (isUpper && !isLower) return 'upper';
    return 'mixed';
  }

  // هل التمرين يخالف نوع اليوم؟
  function isArchetypeViolation(arch, ex) {
    var g = ex.grp;
    if (arch === 'lower') {
      // يسمح بأسفل الظهر فقط من الجذع
      if (UPPER_KEYS.indexOf(g) !== -1 && !(g === 'back' && ex.sub === 'lower')) return true;
    } else if (arch === 'upper') {
      if (LOWER_KEYS.indexOf(g) !== -1) return true;
    }
    return false;
  }

  // هل قيمة الراحة منطقية (كل الأرقام بالثواني ضمن المجموعة البشرية)؟
  function isHumanRest(rest) {
    if (rest == null || rest === '') return true;
    var s = String(rest);
    if (/دقيق|min/i.test(s)) return true; // الدقائق مقبولة
    var nums = (s.match(/\d+/g) || []).map(Number);
    return nums.every(function (n) { return n < 20 || HUMAN_REST_SEC.indexOf(n) !== -1; });
  }

  // الفحص الرئيسي — يرجع { ok, errors[], warnings[] }
  function validatePlan(plan, opts) {
    opts = opts || {};
    var minEx = opts.minEx != null ? opts.minEx : 4;
    var errors = [];
    var warnings = [];
    var weekly = {};

    (plan || []).forEach(function (day, di) {
      if (!day || day.isRest || !day.exercises) return;
      var arch = dayArchetype(day);
      var label = (day.name || ('يوم ' + (di + 1)));

      if (day.exercises.length < minEx) {
        warnings.push('[' + label + '] عدد التمارين ' + day.exercises.length + ' أقل من الحد الأدنى ' + minEx);
      }

      day.exercises.forEach(function (ex) {
        // 1) التضاد مع نوع اليوم
        if (isArchetypeViolation(arch, ex)) {
          errors.push('[' + label + '] تمرين يخالف نوع اليوم (' + arch + '): "' + ex.n + '" (' + ex.grp + ')');
        }
        // 2) راحة غير بشرية
        if (!isHumanRest(ex.rest)) {
          warnings.push('[' + label + '] راحة غير منطقية ل "' + ex.n + '": ' + ex.rest);
        }
        // 3) تجميع التكرار الأسبوعي
        weekly[ex.n] = (weekly[ex.n] || 0) + 1;
      });
    });

    // تقييم التكرار الأسبوعي
    Object.keys(weekly).forEach(function (name) {
      var count = weekly[name];
      if (count > 2) {
        errors.push('تكرار مفرط: "' + name + '" ظهر ' + count + ' مرات في الأسبوع');
      }
    });

    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  // للاستخدام الصارم (P0): يرمي استثناء لو فيه خطأ حرج
  function validatePlanOrThrow(plan, opts) {
    var r = validatePlan(plan, opts);
    if (!r.ok) throw new Error('PLAN_INVALID:\n' + r.errors.join('\n'));
    return r;
  }

  // تشخيص غير معطل — يسجل في ال console ولا يوقف التدفق
  function diagnosePlan(plan, opts) {
    var r = validatePlan(plan, opts);
    if (typeof console !== 'undefined') {
      r.errors.forEach(function (e) { console.error('[VALIDATE] ' + e); });
      r.warnings.forEach(function (w) { console.warn('[VALIDATE] ' + w); });
      if (r.ok && !r.warnings.length) console.log('[VALIDATE] ✓ الخطة سليمة بنيويا');
    }
    return r;
  }

  // تقريب رقم راحة لأقرب قيمة بشرية داخل نص الراحة (يحترم المدى والدقائق)
  function snapRestLabel(rest) {
    if (rest == null) return rest;
    var s = String(rest);
    return s.replace(/\d+/g, function (m) {
      var n = +m;
      if (n < 20) return m; // قيم بالدقائق — تترك كما هي
      if (HUMAN_REST_SEC.indexOf(n) !== -1) return m;
      var best = HUMAN_REST_SEC[0], bd = Math.abs(n - best);
      for (var i = 1; i < HUMAN_REST_SEC.length; i++) {
        var d = Math.abs(n - HUMAN_REST_SEC[i]);
        if (d < bd) { bd = d; best = HUMAN_REST_SEC[i]; }
      }
      return String(best);
    });
  }

  // إصلاح ذاتي نهائي (شبكة أمان) — يستدعى قبل حفظ الخطة.
  // يعدل الخطة في مكانها (mutate) ويرجع تقريرا بما تم إصلاحه.
  // لا يرمي أي استثناء ولا يوقف المستخدم — الخطة توصل للمتابعة نظيفة دائما.
  function repairPlan(plan, opts) {
    opts = opts || {};
    var minEx = (opts.minEx != null) ? opts.minEx : 0;
    var removedArch = [], removedDup = [], snapped = 0;
    var weekly = {};
    (plan || []).forEach(function (day) {
      if (!day || day.isRest || !Array.isArray(day.exercises)) return;
      var arch = dayArchetype(day);
      var origLen = day.exercises.length;
      // أرضية إلزامية لكل يوم: لا تحذف تمارين لو ذلك ينزل اليوم تحت minEx
      var floor = Math.min(minEx, origLen);
      // تصنيف كل تمرين: مخالفة نوع يوم / تكرار أسبوعي زائد / سليم
      var entries = day.exercises.map(function (ex) {
        var archViol = isArchetypeViolation(arch, ex);
        var dupViol = false;
        if (!archViol) {
          var cap = MAX_WEEKLY_FREQ[ex.grp] != null ? MAX_WEEKLY_FREQ[ex.grp] : 1;
          weekly[ex.n] = (weekly[ex.n] || 0) + 1;
          if (weekly[ex.n] > cap) dupViol = true;
        }
        return { ex: ex, archViol: archViol, dupViol: dupViol };
      });
      var keepers = entries.filter(function (e) { return !e.archViol && !e.dupViol; }).length;
      // الحد الأدنى له الأولوية: استرجع الأقل ضررا (التكرارات أولا ثم مخالفات النوع)
      if (keepers < floor) {
        var needed = floor - keepers;
        for (var i = 0; i < entries.length && needed > 0; i++) {
          if (entries[i].dupViol) { entries[i].dupViol = false; needed--; }
        }
        for (var j = 0; j < entries.length && needed > 0; j++) {
          if (entries[j].archViol) { entries[j].archViol = false; needed--; }
        }
      }
      var kept = [];
      entries.forEach(function (e) {
        if (e.archViol) { removedArch.push(e.ex.n); return; }
        if (e.dupViol) { removedDup.push(e.ex.n); return; }
        if (e.ex.rest != null) {
          var ns = snapRestLabel(e.ex.rest);
          if (ns !== String(e.ex.rest)) { e.ex.rest = ns; snapped++; }
        }
        kept.push(e.ex);
      });
      day.exercises = kept;
    });
    var report = validatePlan(plan, opts);
    if (typeof console !== 'undefined' && (removedArch.length || removedDup.length || snapped)) {
      console.warn('[REPAIR] حذف مخالفات نوع اليوم: ' + removedArch.length +
        ' · حذف تكرار: ' + removedDup.length + ' · تعديل راحة: ' + snapped);
    }
    return { plan: plan, removedArch: removedArch, removedDup: removedDup, snapped: snapped, report: report };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // scorePlan — تقييم جودة الخطة علميا (0–100) بتفصيل شفاف
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // أبعاد التقييم (مبنية على أدبيات الحجم/التكرار — Schoenfeld 2016/2017 —
  // وتوازن الدفع/السحب والعلوي/السفلي + السلامة البنيوية + جدوى الاستشفاء
  // + اكتمال الوصفة):
  //   1) تغطية الحجم الأسبوعي (35)
  //   2) تكرار العضلة أسبوعيا (15)
  //   3) التوازن (دفع/سحب + علوي/سفلي) (15)
  //   4) السلامة البنيوية — من validatePlan (15)
  //   5) جدوى الاستشفاء — حجم كلي مقابل القدرة (10)
  //   6) اكتمال الوصفة — تكرارات/راحة/شدة (10)
  // نقية، لا ترمي استثناء، قابلة للاختبار في Node.

  // معايير الحجم الأسبوعي (مشتقة من MUSCLE_VOLUME_STANDARDS في engine/volume.js)
  var VOL_STD = {
    chest: { mev: 6, good: 10, freq: 2 }, back: { mev: 6, good: 10, freq: 2 },
    quads: { mev: 6, good: 8, freq: 1 }, hamstrings: { mev: 4, good: 7, freq: 1 },
    shoulders: { mev: 6, good: 9, freq: 2 }, glutes: { mev: 3, good: 4, freq: 1 },
    biceps: { mev: 5, good: 9, freq: 2 }, triceps: { mev: 4, good: 8, freq: 2 },
    calves: { mev: 3, good: 5, freq: 1 }, adductors: { mev: 3, good: 5, freq: 1 },
    traps: { mev: 0, good: 3, freq: 1 }, forearms: { mev: 0, good: 2, freq: 1 },
    core: { mev: 0, good: 4, freq: 2 }
  };
  var MAJOR_MUSCLES = ['chest', 'back', 'quads', 'hamstrings', 'shoulders'];
  var PUSH_MUSCLES = ['chest', 'shoulders', 'triceps'];
  var PULL_MUSCLES = ['back', 'biceps'];

  function _setsOf(ex) {
    if (!ex) return 0;
    if (Array.isArray(ex.sets)) return ex.sets.length;
    var n = Number(ex.sets);
    return (isFinite(n) && n > 0) ? n : 0;
  }
  function _clampN(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function _has(v) { return v != null && String(v).trim() !== ''; }

  function scorePlan(plan, opts) {
    opts = opts || {};
    var exp = opts.exp || 'intermediate';
    var recovery = (typeof opts.recoveryScore === 'number' && opts.recoveryScore > 0) ? opts.recoveryScore : 70;
    var minEx = opts.minEx != null ? opts.minEx : 4;
    var days = (plan || []).filter(function (d) { return d && !d.isRest && Array.isArray(d.exercises) && d.exercises.length; });

    // خطة فارغة (لا أيام تدريب ولا تمارين) = 0 بلا جودة
    if (!days.length) {
      return {
        score: 0, grade: 'E', label: 'تحتاج إعادة بناء',
        breakdown: [
          { key: 'coverage', label: 'تغطية الحجم الأسبوعي', got: 0, max: 35, note: 'لا توجد أيام تدريب' },
          { key: 'frequency', label: 'تكرار العضلة أسبوعيا', got: 0, max: 15, note: 'لا توجد أيام تدريب' },
          { key: 'balance', label: 'التوازن العضلي (دفع/سحب · علوي/سفلي)', got: 0, max: 15, note: 'لا توجد أيام تدريب' },
          { key: 'integrity', label: 'السلامة البنيوية', got: 0, max: 15, note: 'لا توجد أيام تدريب' },
          { key: 'recovery', label: 'جدوى الاستشفاء (حجم كلي مقابل القدرة)', got: 0, max: 10, note: 'لا توجد أيام تدريب' },
          { key: 'prescription', label: 'اكتمال الوصفة (تكرارات/راحة/شدة)', got: 0, max: 10, note: 'لا توجد تمارين' }
        ],
        totals: { weeklySets: {}, freq: {}, totalSets: 0, totalEx: 0 }
      };
    }

    var weeklySets = {}, freq = {}, totalSets = 0, totalEx = 0;
    var rxReps = 0, rxRest = 0, rxAdv = 0;
    days.forEach(function (day) {
      var seen = {};
      day.exercises.forEach(function (ex) {
        var g = ex.grp || '';
        var s = _setsOf(ex) || 3;
        weeklySets[g] = (weeklySets[g] || 0) + s;
        totalSets += s; totalEx++;
        if (g && !seen[g]) { freq[g] = (freq[g] || 0) + 1; seen[g] = 1; }
        if (_has(ex.reps)) rxReps++;
        if (_has(ex.rest) && isHumanRest(ex.rest)) rxRest++;
        if (_has(ex.rir) || _has(ex.tempo) || _has(ex.progression) || _has(ex.progressiveRIR)) rxAdv++;
      });
    });

    var breakdown = [];

    // 1) تغطية الحجم الأسبوعي (35)
    var covPts = 0, covMax = 35;
    var trained = Object.keys(weeklySets).filter(function (g) { return VOL_STD[g]; });
    if (trained.length) {
      var ratios = trained.map(function (g) {
        var std = VOL_STD[g];
        return _clampN(std.good ? weeklySets[g] / std.good : 1, 0, 1);
      });
      var avg = ratios.reduce(function (a, b) { return a + b; }, 0) / ratios.length;
      var penalty = 0, missing = [];
      MAJOR_MUSCLES.forEach(function (g) {
        var sets = weeklySets[g] || 0;
        if (sets === 0) { penalty += 0.12; missing.push(g); }
        else if (sets < VOL_STD[g].mev) penalty += 0.06;
      });
      avg = _clampN(avg - penalty, 0, 1);
      covPts = Math.round(avg * covMax);
      breakdown.push({ key: 'coverage', label: 'تغطية الحجم الأسبوعي', got: covPts, max: covMax, note: missing.length ? ('عضلات كبيرة غير مغطاة: ' + missing.join(', ')) : 'تغطية حجم جيدة عبر العضلات' });
    } else {
      breakdown.push({ key: 'coverage', label: 'تغطية الحجم الأسبوعي', got: 0, max: covMax, note: 'لا توجد عضلات معروفة' });
    }

    // 2) تكرار العضلة أسبوعيا (15)
    var freqPts = 0, freqMax = 15;
    var majorTrained = MAJOR_MUSCLES.filter(function (g) { return (weeklySets[g] || 0) > 0; });
    if (majorTrained.length) {
      var met = majorTrained.filter(function (g) { return (freq[g] || 0) >= (VOL_STD[g].freq || 2); }).length;
      freqPts = Math.round(met / majorTrained.length * freqMax);
      breakdown.push({ key: 'frequency', label: 'تكرار العضلة أسبوعيا', got: freqPts, max: freqMax, note: met + '/' + majorTrained.length + ' عضلة كبيرة بتكرار مثالي' });
    } else {
      breakdown.push({ key: 'frequency', label: 'تكرار العضلة أسبوعيا', got: 0, max: freqMax, note: 'لا توجد عضلات كبيرة مدربة' });
    }

    // 3) التوازن (15)
    var balMax = 15;
    var push = PUSH_MUSCLES.reduce(function (a, g) { return a + (weeklySets[g] || 0); }, 0);
    var pull = PULL_MUSCLES.reduce(function (a, g) { return a + (weeklySets[g] || 0); }, 0);
    var upper = UPPER_KEYS.reduce(function (a, g) { return a + (weeklySets[g] || 0); }, 0);
    var lower = LOWER_KEYS.reduce(function (a, g) { return a + (weeklySets[g] || 0); }, 0);
    function _ratioScore(a, b) { if (a + b === 0) return 0; var hi = Math.max(a, b); return hi ? Math.min(a, b) / hi : 0; }
    var bal = _ratioScore(push, pull) * 0.6 + _ratioScore(upper, lower) * 0.4;
    var balPts = Math.round(bal * balMax);
    breakdown.push({ key: 'balance', label: 'التوازن العضلي (دفع/سحب · علوي/سفلي)', got: balPts, max: balMax, note: 'دفع ' + push + ' · سحب ' + pull + ' · علوي ' + upper + ' · سفلي ' + lower });

    // 4) السلامة البنيوية (15)
    var intMax = 15;
    var v = validatePlan(plan, { minEx: minEx });
    var intPts = _clampN(intMax - (v.errors.length * 5 + v.warnings.length * 2), 0, intMax);
    breakdown.push({ key: 'integrity', label: 'السلامة البنيوية', got: intPts, max: intMax, note: (v.errors.length || v.warnings.length) ? (v.errors.length + ' خطأ · ' + v.warnings.length + ' تنبيه') : 'بنية سليمة بالكامل' });

    // 5) جدوى الاستشفاء (10)
    var recMax = 10, recPts = 0;
    var base = exp === 'advanced' ? 120 : (exp === 'beginner' ? 60 : 90);
    var rf = recovery >= 82 ? 1 : Math.max(0.8, 1 + (recovery - 82) * 0.005);
    var budget = base * rf, loBudget = budget * 0.5;
    if (totalSets === 0) recPts = 0;
    else if (totalSets <= budget && totalSets >= loBudget) recPts = recMax;
    else if (totalSets < loBudget) recPts = Math.round(recMax * (totalSets / loBudget));
    else recPts = _clampN(Math.round(recMax * (1 - (totalSets - budget) / budget)), 0, recMax);
    breakdown.push({ key: 'recovery', label: 'جدوى الاستشفاء (حجم كلي مقابل القدرة)', got: recPts, max: recMax, note: totalSets + ' set/أسبوع · ميزانية ≈' + Math.round(budget) });

    // 6) اكتمال الوصفة (10)
    var rxMax = 10, rxPts = 0;
    if (totalEx) {
      var repsFrac = rxReps / totalEx, restFrac = rxRest / totalEx, advFrac = rxAdv / totalEx;
      rxPts = Math.round(repsFrac * 4 + restFrac * 3 + advFrac * 3);
      breakdown.push({ key: 'prescription', label: 'اكتمال الوصفة (تكرارات/راحة/شدة)', got: rxPts, max: rxMax, note: Math.round(repsFrac * 100) + '% تكرارات · ' + Math.round(restFrac * 100) + '% راحة سليمة · ' + Math.round(advFrac * 100) + '% شدة/إيقاع' });
    } else {
      breakdown.push({ key: 'prescription', label: 'اكتمال الوصفة (تكرارات/راحة/شدة)', got: 0, max: rxMax, note: 'لا توجد تمارين' });
    }

    var score = _clampN(Math.round(covPts + freqPts + balPts + intPts + recPts + rxPts), 0, 100);
    var grade = score >= 90 ? 'A+' : score >= 82 ? 'A' : score >= 73 ? 'B' : score >= 62 ? 'C' : score >= 50 ? 'D' : 'E';
    var label = score >= 90 ? 'ممتازة' : score >= 82 ? 'قوية' : score >= 73 ? 'جيدة' : score >= 62 ? 'مقبولة' : score >= 50 ? 'ضعيفة' : 'تحتاج إعادة بناء';
    return { score: score, grade: grade, label: label, breakdown: breakdown, totals: { weeklySets: weeklySets, freq: freq, totalSets: totalSets, totalEx: totalEx } };
  }

  root.PlanValidator = {
    LOWER_KEYS: LOWER_KEYS,
    UPPER_KEYS: UPPER_KEYS,
    MAX_WEEKLY_FREQ: MAX_WEEKLY_FREQ,
    HUMAN_REST_SEC: HUMAN_REST_SEC,
    dayArchetype: dayArchetype,
    isArchetypeViolation: isArchetypeViolation,
    isHumanRest: isHumanRest,
    snapRestLabel: snapRestLabel,
    validatePlan: validatePlan,
    validatePlanOrThrow: validatePlanOrThrow,
    diagnosePlan: diagnosePlan,
    repairPlan: repairPlan,
    scorePlan: scorePlan
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.PlanValidator;
  }
})(typeof window !== 'undefined' ? window : this);
