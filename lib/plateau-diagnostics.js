// ── ElForma · lib/plateau-diagnostics.js ──────────────────────────────
// تشخيص ثبات الوزن / توقّف التقدّم — بالفرق بين الأسباب، مش بردّ فعل واحد.
//
// WHY THIS FILE EXISTS
// The old behaviour was a single reflex: weight stalled -> cut calories ~8%.
// That is wrong most of the time, and it is the fastest way to burn a client
// out. The literature is consistent on the point:
//
//   • Thomas et al. 2014 (AJCN, PMC4135489) modelled the classic 6-month
//     plateau and found intermittent non-adherence / energy under-reporting
//     explains it BETTER than metabolic adaptation alone.
//   • Ostendorf et al. 2021 (PubMed 33742193) found under-reporting persists
//     even among successful weight-loss maintainers.
//   • Trexler et al. 2014 — adaptive thermogenesis is real but modest, and it
//     is a reason to pause the deficit, not to deepen it.
//   • Byrne 2018 (MATADOR) — intermittent diet breaks preserved more fat loss
//     than continuous restriction.
//   • StatPearls NBK576400 — reduced NEAT is a major, measurable contributor.
//
// So: before ever recommending fewer calories, we ask WHY the scale stopped.
// Nine competing causes are scored, ranked, and the strongest one wins. Six of
// those causes make a calorie cut the WRONG answer, and the caller is expected
// to honour that.
//
// Pure CommonJS, zero dependencies, no I/O. Deterministic and unit-testable.

'use strict';

const KCAL = 7700; // kcal per kg of body mass

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (d === undefined ? null : d);
}

function r1(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
}

function clamp(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

const CONF = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

// domain tells the app WHICH coach should speak: nutrition / training /
// activity / recovery. The app must never show a training fix in a meal card.
const CAUSES = {
  adherence:   { key: 'adherence',   labelAr: 'الالتزام',        domain: 'nutrition' },
  underreport: { key: 'underreport', labelAr: 'دقة التسجيل',     domain: 'nutrition' },
  water:       { key: 'water',       labelAr: 'احتباس ماية',     domain: 'recovery'  },
  neat:        { key: 'neat',        labelAr: 'الحركة اليومية',  domain: 'activity'  },
  adaptation:  { key: 'adaptation',  labelAr: 'تأقلم الأيض',     domain: 'nutrition' },
  sleep:       { key: 'sleep',       labelAr: 'النوم والضغط',    domain: 'recovery'  },
  training:    { key: 'training',    labelAr: 'تطور التمرين',    domain: 'training'  },
  drift:       { key: 'drift',       labelAr: 'الخطة قديمة',     domain: 'nutrition' },
  dietfatigue: { key: 'dietfatigue', labelAr: 'إرهاق الدايت',    domain: 'nutrition' }
};

module.exports = { KCAL, CONF, CAUSES, num, r1, clamp };

// ── إشارات خام ─────────────────────────────────────────────

function sortWeights(weights) {
  if (!Array.isArray(weights)) return [];
  return weights
    .map(function (w) {
      if (!w) return null;
      const kg = num(w.kg !== undefined ? w.kg : w.weight, null);
      const t = new Date(w.date || w.at || w.day || 0).getTime();
      if (kg === null || kg <= 0 || !Number.isFinite(t) || t <= 0) return null;
      return { t: t, kg: kg };
    })
    .filter(Boolean)
    .sort(function (a, b) { return a.t - b.t; });
}

/**
 * Weekly rate of change in kg, from a split-half comparison of the window.
 *
 * ⚠ The subtle bug this function had: the difference between the two half
 * averages spans the distance between the two halves' CENTRES in time — which
 * is roughly half the window — but the code divided by the FULL span. Every
 * rate came out understated by ~2×, so somebody losing 0.63 kg/week read as
 * 0.35 and got told they had plateaued. We divide by the centroid gap.
 */
function rateKg(weights, days) {
  const list = sortWeights(weights);
  if (list.length < 4) return null;

  const last = list[list.length - 1];
  const cutoff = last.t - (days || 21) * 86400000;
  const win = list.filter(function (x) { return x.t >= cutoff; });
  if (win.length < 4) return null;

  const half = Math.floor(win.length / 2);
  const early = win.slice(0, half);
  const late = win.slice(win.length - half);
  if (!early.length || !late.length) return null;

  const avg = function (a) {
    return a.reduce(function (s, x) { return s + x.kg; }, 0) / a.length;
  };
  const centre = function (a) {
    return a.reduce(function (s, x) { return s + x.t; }, 0) / a.length;
  };

  const gapDays = (centre(late) - centre(early)) / 86400000;
  const totalSpanDays = (win[win.length - 1].t - win[0].t) / 86400000;
  if (totalSpanDays < 5 || gapDays <= 0) return null;

  return Math.round(((avg(late) - avg(early)) / gapDays) * 7 * 100) / 100;
}

/** Day-to-day noise. High volatility on a flat trend usually means water. */
function volatilityKg(weights, days) {
  const list = sortWeights(weights);
  if (list.length < 4) return null;
  const last = list[list.length - 1];
  const cutoff = last.t - (days || 21) * 86400000;
  const win = list.filter(function (x) { return x.t >= cutoff; });
  if (win.length < 4) return null;
  const mean = win.reduce(function (s, x) { return s + x.kg; }, 0) / win.length;
  const variance =
    win.reduce(function (s, x) { return s + Math.pow(x.kg - mean, 2); }, 0) /
    win.length;
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

/** What the maths says the scale SHOULD be doing, in kg/week. */
function predictedRateKg(targetCals, maintenanceCals) {
  const t = num(targetCals, null);
  const m = num(maintenanceCals, null);
  if (t === null || m === null || m <= 0) return null;
  return Math.round(((t - m) * 7 / KCAL) * 100) / 100;
}

/** 0..1 — how much of the window the trainee actually logged. */
function loggingDensity(loggedDays, windowDays) {
  const w = num(windowDays, 21) || 21;
  const l = num(loggedDays, 0) || 0;
  return Math.round(clamp(l / w, 0, 1) * 100) / 100;
}

module.exports.sortWeights = sortWeights;
module.exports.rateKg = rateKg;
module.exports.volatilityKg = volatilityKg;
module.exports.predictedRateKg = predictedRateKg;
module.exports.loggingDensity = loggingDensity;

// ── التشخيص التفاضلي ──────────────────────────────────────

function pushCause(out, key, score, confidence, findingAr, actionAr) {
  const meta = CAUSES[key];
  if (!meta) return;
  out.push({
    key: meta.key,
    labelAr: meta.labelAr,
    domain: meta.domain,
    score: score,
    confidence: confidence,
    findingAr: findingAr,
    actionAr: actionAr
  });
}

/**
 * diagnose(o) -> { stalled, state, causes[], primary, confidence, signals }
 *
 * state: 'collecting' (not enough data) | 'on_track' | 'stalled'
 * Causes are ranked by score, de-duplicated, strongest first.
 */
function diagnose(o) {
  const opt = o || {};
  const goal = String(opt.goal || 'cut');
  const windowDays = num(opt.windowDays, 21) || 21;
  const bw = num(opt.weight, null) || num(opt.planWeight, null) || 80;

  const actual = rateKg(opt.weights, windowDays);
  const predicted = predictedRateKg(opt.targetCals, opt.maintenanceCals);
  const volatility = volatilityKg(opt.weights, windowDays);
  const density = loggingDensity(opt.loggedDays, windowDays);
  const adherence = num(opt.adherencePct, null);
  const dietWeeks = num(opt.dietWeeks, 0) || 0;

  const signals = {
    actualRateKg: actual,
    predictedRateKg: predicted,
    volatilityKg: volatility,
    loggingDensity: density,
    adherencePct: adherence,
    dietWeeks: dietWeeks
  };

  // Not enough weigh-ins to say anything honest yet.
  if (actual === null) {
    return {
      stalled: false,
      state: 'collecting',
      causes: [],
      primary: null,
      confidence: CONF.LOW,
      signals: signals
    };
  }

  // ما هي الحركة المقبولة؟ عتبة نسبية لوزن الجسم، مش رقم ثابت.
  const cutStall = bw * 0.002;      // ~0.18 kg/wk for a 90 kg trainee
  const maintainBand = bw * 0.004;

  let stalled = false;
  if (goal === 'cut') stalled = actual > -cutStall;
  else if (goal === 'muscle' || goal === 'gain') stalled = actual < cutStall;
  else stalled = Math.abs(actual) > maintainBand;

  if (!stalled) {
    return {
      stalled: false,
      state: 'on_track',
      causes: [],
      primary: null,
      confidence: density < 0.6 ? CONF.LOW : CONF.MEDIUM,
      signals: signals
    };
  }

  const causes = [];
  const isCut = goal === 'cut';
  const adh = adherence === null ? 100 : adherence;

  // 1) مفيش تسجيل كافي — أقوى احتمال وأرخص إصلاح. ممنوع نقص سعرات وإحنا عميان.
  if (density < 0.6) {
    pushCause(causes, 'underreport', 92, CONF.HIGH,
      'سجلت' + Math.round(density * 100) + '% بس من أيام الفترة',
      'قبل ما نغير حاجة في الخطة سجل أكلك كامل 7 أيام متواصلة. تقليل السعرات وإحنا مش شايفين الصورة غلط');
  }

  // 2) التزام ضعيف والتسجيل كويس — الخطة سليمة، التنفيذ هو المشكلة.
  if (adherence !== null && adh < 85 && density >= 0.6) {
    pushCause(causes, 'adherence', 88, CONF.HIGH,
      'التزامك ' + Math.round(adh) + '% على الخطة',
      'الخطة مش محتاجة تتغير محتاجين نقربها لحياتك. قولي الوجبة اللي بتقع منك وهنبدلها');
  }

  // 3) المعادلة بتقول المفروض تخس، والميزان بيقول لأ — الفجوة دي طاقة مش محسوبة.
  // ملاحظة مهمة على الدرجة
  // الفجوة دي إشارة غير مباشرة يعني إحنا بنستنتج من فرق أرقام
  // أما قلة النوم ونزول الخطوات فدول إشارات مباشرة مقاسة
  // فلما يكون فيه إشارة مباشرة واضحة ماينفعش التخمين يكسبها
  const _sleepH = num(opt.sleepHours, null);
  const _stressN = num(opt.stress, null);
  const _stepsN = num(opt.stepsNow, null);
  const _stepsB = num(opt.stepsBaseline, null);
  const _neatDrop = (_stepsN !== null && _stepsB !== null && _stepsB > 1000)
    ? (_stepsB - _stepsN) / _stepsB : 0;
  const _hardSignal = (_sleepH !== null && _sleepH < 6) ||
                      (_stressN !== null && _stressN >= 5) ||
                      (_neatDrop >= 0.15);
  if (isCut && adh >= 85 && predicted !== null && predicted < -0.15 &&
      Math.abs(actual - predicted) >= 0.35) {
    pushCause(causes, 'underreport', _hardSignal ? 68 : 84, CONF.MEDIUM,
      'المفروض تنزل ' + Math.abs(predicted).toFixed(2) +
        ' كجم/أسبوع والفعلي ' + actual.toFixed(2) + '.',
      'الفرق ده عادة سعرات مش متسجلة: زيت الطبخ قضمة من طبق حد مشروبات. وزن الأكل بالميزان أسبوع واحد');
  }

  // 4) الدهون بتقل والمياه بتخبّي النتيجة.
  const sleepHours = num(opt.sleepHours, null);
  const stress = num(opt.stress, null);
  if (volatility !== null && volatility >= bw * 0.008) {
    const tense = (sleepHours !== null && sleepHours < 6.5) ||
                  (stress !== null && stress >= 4);
    pushCause(causes, 'water', tense ? 76 : 62, CONF.MEDIUM,
      'وزنك بيتذبذب ±' + volatility.toFixed(2) + 'كجم حوالين المتوسط',
      'ده ماية مش دهون. اوزن نفسك كل يوم الصبح واحكم على متوسط الأسبوع مش على رقم يوم واحد');
  }

  // 5) NEAT — الجسم بيوفّر طاقة بإنه يقلل حركتك التلقائية من غير ما تاخد بالك.
  const stepsNow = num(opt.stepsNow, null);
  const stepsBase = num(opt.stepsBaseline, null);
  if (stepsNow !== null && stepsBase !== null && stepsBase > 1000) {
    const drop = (stepsBase - stepsNow) / stepsBase;
    if (drop >= 0.15) {
      // كلما النزول أكبر كلما السبب ده أقوى
      // نزول 30% في الخطوات ممكن يوصل لـ 300 سعر يومي مفقودة من الحرق
      pushCause(causes, 'neat', drop >= 0.30 ? 86 : 78, CONF.MEDIUM,
        'خطواتك نزلت ' + Math.round(drop * 100) + '% عن بداية الخطة',
        'رجع خطواتك لمستواها الأول قبل ما نفكر نقلل أكل. ده بيرجع حرق يومي مفقود');
    }
  }

  // 6) إرهاق دايت طويل — الحل استراحة، مش تقليل زيادة (MATADOR).
  if (isCut && dietWeeks >= 10 && adh >= 85 && density >= 0.6) {
    pushCause(causes, 'dietfatigue', 72, CONF.MEDIUM,
      'بقالك ' + Math.round(dietWeeks) + 'أسبوع في عجز متواصل',
      'الحل مش تقليل زيادة خد استراحة دايت أسبوعين على سعرات الثبات وبعديها ارجع للعجز. ده بيحافظ على نتيجة أحسن على المدى الطويل');
  }

  // 7) الخطة اتحسبت على جسم مابقاش موجود.
  const planWeight = num(opt.planWeight, null);
  const nowWeight = num(opt.weight, null);
  if (planWeight !== null && nowWeight !== null &&
      Math.abs(nowWeight - planWeight) >= Math.max(2, planWeight * 0.03)) {
    pushCause(causes, 'drift', 70, CONF.HIGH,
      'وزنك دلوقتي ' + nowWeight + ' كجم والخطة اتحسبت على ' + planWeight + 'كجم',
      'محتاجين نعيد حساب الخطة على وزنك الحالي احتياجك اتغير فعليا');
  }

  // 8) التمرين واقف مكانه — مفيش حمل زايد يحافظ على العضلة.
  // 5ب) قلة النوم والضغط سبب مستقل لوقوف النتيجة
  // مش مجرد عامل مساعد لاحتباس الماية
  // النوم القليل بيقلل فقد الدهون وبيزود الجوع وبيقلل الحركة التلقائية
  // فتقليل الأكل في الحالة دي بيزود الطين بلة
  if (isCut && adh >= 85 && density >= 0.6 &&
      ((_sleepH !== null && _sleepH < 6) || (_stressN !== null && _stressN >= 5))) {
    const _bad = (_sleepH !== null && _sleepH < 6);
    pushCause(causes, 'sleep', _bad && _stressN !== null && _stressN >= 5 ? 88 : 80, CONF.MEDIUM,
      _bad ? ('بتنام ' + _sleepH + ' ساعات بس') : 'مستوى الضغط عندك عالي',
      'النوم القليل والضغط بيوقفوا فقد الدهون وبيزودوا الجوع. زود نومك لـ 7 لـ 8 ساعات أسبوعين قبل ما نمس السعرات');
  }

  const tonnageDelta = num(opt.tonnageDeltaPct, null);
  if (tonnageDelta !== null && tonnageDelta <= 1) {
    pushCause(causes, 'training', 66, CONF.MEDIUM,
      'إجمالي الحمل في الجيم مازادش (' + tonnageDelta + '%).',
      'زود تكرار أو وزن في التمارين الأساسية. الحمل المتزايد هو اللي بيحمي عضلتك وأنت بتخس');
  }
  const avgRir = num(opt.avgRir, null);
  if (avgRir !== null && avgRir >= 3) {
    pushCause(causes, 'training', 60, CONF.MEDIUM,
      'متوسط المجهود بعيد عن الفشل (RIR ' + avgRir + ').',
      'قرب من الفشل شوية آخر مجموعة تبقى فاضل فيها تكرار أو اتنين بس');
  }

  // 9) نوم وضغط.
  if ((sleepHours !== null && sleepHours < 6) ||
      (stress !== null && stress >= 4)) {
    pushCause(causes, 'sleep', 58, CONF.MEDIUM,
      sleepHours !== null && sleepHours < 6
        ? 'بتنام ' + sleepHours + 'ساعة بس'
        : 'مستوى الضغط عندك عالي',
      'قلة النوم بتزود الجوع وتقلل الحرق التلقائي. 7 ساعات هتفرق معاك أكتر من خصم 100 سعرة');
  }

  // 10) تأقلم الأيض — حقيقي لكنه آخر احتمال نلجأ له، مش أوله.
  if (isCut && dietWeeks >= 6) {
    pushCause(causes, 'adaptation', 55, CONF.LOW,
      'بقالك ' + Math.round(dietWeeks) + 'أسبوع والجسم بيوفر طاقة',
      'تأقلم الأيض موجود لكنه أصغر مما الناس فاكرة. نتأكد من الأسباب اللي فوق الأول');
  }

  // ترتيب تنازلي + إزالة التكرار (نسيب الأعلى درجة لكل سبب).
  causes.sort(function (a, b) { return b.score - a.score; });
  const seen = {};
  const ranked = causes.filter(function (c) {
    if (seen[c.key]) return false;
    seen[c.key] = true;
    return true;
  });

  // لو التسجيل ضعيف، الثقة في أي استنتاج منخفضة مهما كان السبب.
  const primary = ranked.length ? ranked[0] : null;
  const confidence = density < 0.6
    ? CONF.LOW
    : (primary ? primary.confidence : CONF.LOW);

  return {
    stalled: true,
    state: 'stalled',
    causes: ranked,
    primary: primary,
    confidence: confidence,
    signals: signals
  };
}

module.exports.diagnose = diagnose;
