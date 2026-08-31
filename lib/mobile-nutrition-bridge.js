'use strict';
// ============================================================
//  Mobile <-> Nutrition Engine Bridge  (Sprint 12)
//
//  ROOT FIX: the original diet engine reads several inputs
//  directly from DOM elements (inp-steps, inp-train-days,
//  inp-workout-dur, inp-cardio, inp-sleep, inp-weekly-rate,
//  inp-bf, inp-gain-style). The Node vm host already shims
//  document.getElementById via `currentInputs`, but the mobile
//  API never populated it, so every one of those inputs resolved
//  to 0 / default and part of the engine's intelligence was dead.
//
//  This is the single translation layer between the mobile profile
//  and the engine's own vocabulary. The engine files are NOT
//  modified: they remain the single source of truth for the science.
// ============================================================

var ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9 };
var STEPS_FALLBACK = { sedentary: 3000, light: 6000, moderate: 9000, active: 12000, athlete: 14000 };
var SLEEP_HOURS = { poor: 5.5, ok: 7, good: 8 };
// Engine goal vocabulary: 'cut' | 'bulk' | 'recomp' | 'maintain'.
// Sourced from the single translation authority so the app, website and both
// engines can never silently drift apart (see lib/goal-vocabulary.js).
var GOAL = require('./goal-vocabulary').MOBILE_TO_NUTRITION;
var DIET = { balanced: 'balanced', lowcarb: 'lowcarb', keto: 'keto', carbcycle: 'carbcycle', mediterranean: 'mediterranean', carnivore: 'carnivore', vegetarian: 'balanced' };

// ---- MET-corrected cardio -----------------------------------
// The engine uses a FLAT 7.5 kcal/min for cardio regardless of
// intensity or bodyweight, which overestimates a light walker by
// up to ~40% and silently eats into the deficit.
// Instead of editing the engine we scale the SESSION COUNT so the
// engine's own arithmetic lands on the MET-correct number:
//     kcal/min = MET * 3.5 * weightKg / 200        (ACSM)
//     equivalentSessions = sessions * (kcalPerMin / 7.5)
var CARDIO_MET = { light: 3.5, moderate: 6.0, vigorous: 8.5 };

function cardioKcalPerMin(intensity, weightKg) {
  var met = CARDIO_MET[intensity] || CARDIO_MET.moderate;
  var w = Number(weightKg) > 0 ? Number(weightKg) : 75;
  return (met * 3.5 * w) / 200;
}

function metCorrectedCardioSessions(sessions, intensity, weightKg) {
  var s = Number(sessions) || 0;
  if (s <= 0) return 0;
  return Math.round(s * (cardioKcalPerMin(intensity, weightKg) / 7.5) * 100) / 100;
}

// ---- Body fat (US Navy) from logged measurements ------------
function navyBodyFat(gender, heightCm, waistCm, neckCm, hipCm) {
  var h = Number(heightCm), w = Number(waistCm), nk = Number(neckCm), hp = Number(hipCm), bf;
  if (!(h > 0 && w > 0 && nk > 0)) return null;
  if (gender === 'female') {
    if (!(hp > 0)) return null;
    bf = 163.205 * Math.log10(w + hp - nk) - 97.684 * Math.log10(h) - 78.387;
  } else {
    if (w - nk <= 0) return null;
    bf = 86.010 * Math.log10(w - nk) - 70.041 * Math.log10(h) + 36.76;
  }
  if (!Number.isFinite(bf) || bf < 3 || bf > 65) return null;
  return Math.round(bf * 10) / 10;
}

// ---- Safe weekly rate of change -----------------------------
// Cut: 0.5-1.0% bodyweight/week (Helms 2014); leaner people go
// slower to protect lean mass. Bulk: 0.25-0.5%/week lean gaining.
function safeWeeklyRate(goal, weightKg, bodyFat, gainStyle) {
  var w = Number(weightKg) > 0 ? Number(weightKg) : 75;
  var bf = Number(bodyFat), pct;
  if (goal === 'cut') {
    pct = 0.0075;
    if (Number.isFinite(bf)) {
      if (bf >= 30) pct = 0.010;
      else if (bf >= 20) pct = 0.0085;
      else if (bf >= 15) pct = 0.0070;
      else pct = 0.0050;
    }
    return Math.round(w * pct * 100) / 100;
  }
  if (goal === 'bulk') return Math.round(w * (gainStyle === 'mass' ? 0.005 : 0.0025) * 100) / 100;
  return 0;
}

// ---- Build engine profile (DE fields) + DOM inputs ----------
function buildEngineContext(mobileProfile, extras) {
  var p = mobileProfile && typeof mobileProfile === 'object' ? mobileProfile : {};
  var x = extras && typeof extras === 'object' ? extras : {};

  var gender = p.gender === 'female' ? 'female' : 'male';
  var genderAr = gender === 'female' ? 'انثى' : 'ذكر';
  var weight = Number(p.weight) || 0;
  var height = Number(p.height) || 0;
  var age = Number(p.age) || 0;
  var goal = GOAL[p.goal] || 'maintain';
  var gainStyle = p.gainStyle === 'mass' ? 'mass' : 'lean';
  var activity = ACTIVITY[p.dailyActivity] || ACTIVITY.light;

  var steps = Number(x.steps) > 0 ? Math.min(40000, Number(x.steps))
    : (STEPS_FALLBACK[p.dailyActivity] || STEPS_FALLBACK.light);

  var trainDays = Number(p.trainingDays) || 0;
  var workoutDur = Number(p.trainingMinutes) || 0;

  var cardioSessions = Number(x.cardioSessions) || Number(p.cardioSessions) || 0;
  var cardioIntensity = String(x.cardioIntensity || p.cardioIntensity || 'moderate');
  var cardio = metCorrectedCardioSessions(cardioSessions, cardioIntensity, weight);

  var sleepHours = Number(x.sleepHours) || SLEEP_HOURS[p.sleep] || 7;

  var bodyFat = Number(x.bodyFat);
  if (!Number.isFinite(bodyFat) || bodyFat <= 0) bodyFat = navyBodyFat(gender, height, x.waist, x.neck, x.hips);

  var weeklyRate = Number(x.weeklyRate) > 0 ? Number(x.weeklyRate)
    : safeWeeklyRate(goal, weight, bodyFat, gainStyle);

  var profile = {
    gender: genderAr,
    age: age,
    height: height,
    weight: weight,
    target: Number(p.targetWeight) || weight,
    activity: activity,
    goal: goal,
    gainStyle: gainStyle,
    selectedDiet: DIET[p.diet] || 'balanced',
    mealCount: Number(p.mealCount) || 4,
    healthConditions: Array.isArray(p.healthConditions) ? p.healthConditions : [],
    fastingMode: String(p.fastingMode || 'normal'),
    expectedWeeklyLoss: weeklyRate,
    sleepHours: sleepHours,
    // [FIX] isTrainingDay: gym users ALWAYS get a pre-workout meal.
    // The pre-workout is shown as an EXTRA meal on top of mealCount.
    // e.g. user selects 3 meals + gym → 3 main meals + 1 pre-workout = 4 shown.
    isTrainingDay: (function() {
      if (x.isTrainingDay === true || x.isTrainingDay === false) return x.isTrainingDay;
      if (p.isTrainingDay === true || p.isTrainingDay === false) return p.isTrainingDay;
      // Gym users always train today — add the pre-workout meal.
      var eq = String(p.equipment || '').trim().toLowerCase();
      if (eq === 'gym') return true;
      return undefined;
    })()
  };
  if (profile.isTrainingDay === undefined) delete profile.isTrainingDay;

  var inputs = {
    'inp-gender': genderAr,
    'inp-age': age,
    'inp-height': height,
    'inp-weight': weight,
    'inp-target': profile.target,
    'inp-activity': activity,
    'inp-goal': goal,
    'inp-gain-style': gainStyle,
    'inp-steps': steps,
    'inp-train-days': trainDays,
    'inp-workout-dur': workoutDur,
    'inp-cardio': cardio,
    'inp-sleep': sleepHours,
    'inp-weekly-rate': weeklyRate
  };
  if (Number.isFinite(bodyFat) && bodyFat > 0) inputs['inp-bf'] = bodyFat;
  if (Number(x.waist) > 0) inputs['inp-waist'] = Number(x.waist);
  if (Number(x.neck) > 0) inputs['inp-neck'] = Number(x.neck);
  if (Number(x.hips) > 0) inputs['inp-hip'] = Number(x.hips);

  return {
    profile: profile,
    inputs: inputs,
    derived: {
      steps: steps,
      stepsEstimated: !(Number(x.steps) > 0),
      cardioSessionsRaw: cardioSessions,
      cardioIntensity: cardioIntensity,
      cardioKcalPerMin: Math.round(cardioKcalPerMin(cardioIntensity, weight) * 10) / 10,
      cardioSessionsMetCorrected: cardio,
      bodyFat: bodyFat,
      bodyFatSource: Number(x.bodyFat) > 0 ? 'measured' : (bodyFat ? 'navy' : 'engine-estimate'),
      weeklyRate: weeklyRate,
      sleepHours: sleepHours,
      trainDays: trainDays,
      workoutDur: workoutDur,
      activity: activity
    }
  };
}

// ---- Adaptive TDEE (the missing coaching brain) -------------
// A formula only ever produces an ESTIMATE. A real coach corrects
// that estimate against what actually happened:
//   observedTDEE = meanDailyIntake - (weightChangeKg * 7700 / days)
// Guards: >=10 logged days and >=14 days span (shorter windows are
// dominated by water/glycogen noise); weight trend uses first-third
// vs last-third averages, not single readings; logging coverage must
// be >=60%; the correction is clamped to +/-25% of the formula and
// blended in proportionally to how much data backs it.
function adaptiveTdee(nutritionRows, weightRows, formulaTdee) {
  var base = Math.round(Number(formulaTdee) || 0);
  var out = {
    status: 'insufficient_data', loggedDays: 0, spanDays: 0, coveragePct: null,
    meanIntake: null, weightChangeKg: null, observedTdee: null,
    recommendedTdee: base, formulaTdee: base, deltaKcal: 0, confidence: 'low'
  };

  var meals = (Array.isArray(nutritionRows) ? nutritionRows : [])
    .filter(function (r) { return r && r.day && Number(r.calories) > 500; })
    .sort(function (a, b) { return a.day < b.day ? -1 : 1; });
  var weights = (Array.isArray(weightRows) ? weightRows : [])
    .filter(function (r) { return r && r.day && Number(r.weight) > 0; })
    .sort(function (a, b) { return a.day < b.day ? -1 : 1; });

  out.loggedDays = meals.length;
  if (meals.length < 10 || weights.length < 4) return out;

  var first = Date.parse(meals[0].day), last = Date.parse(meals[meals.length - 1].day);
  var spanDays = Math.round((last - first) / 86400000) + 1;
  out.spanDays = spanDays;
  if (spanDays < 14) return out;

  var coverage = meals.length / spanDays;
  out.coveragePct = Math.round(coverage * 100);
  if (coverage < 0.6) { out.status = 'low_logging_coverage'; return out; }

  var meanIntake = meals.reduce(function (s, r) { return s + Number(r.calories); }, 0) / meals.length;
  out.meanIntake = Math.round(meanIntake);

  var third = Math.max(1, Math.floor(weights.length / 3));
  var avg = function (arr) { return arr.reduce(function (s, r) { return s + Number(r.weight); }, 0) / arr.length; };
  var weightChange = avg(weights.slice(-third)) - avg(weights.slice(0, third));
  out.weightChangeKg = Math.round(weightChange * 100) / 100;

  var observed = meanIntake - (weightChange * 7700 / spanDays);
  out.observedTdee = Math.round(observed);

  var ref = base || observed;
  var clamped = Math.max(ref * 0.75, Math.min(ref * 1.25, observed));
  var w = Math.min(0.7, (meals.length / 28) * 0.7);

  out.recommendedTdee = Math.round(ref * (1 - w) + clamped * w);
  out.deltaKcal = out.recommendedTdee - Math.round(ref);
  out.status = 'ready';
  out.confidence = (meals.length >= 21 && spanDays >= 21) ? 'high' : 'moderate';
  return out;
}

// ---- Adherence tracking -------------------------------------
// nutrition_days was written and exported but never analysed.
// This turns it into actual coaching signal.
function adherence(nutritionRows, targets, windowDays) {
  var days = Math.max(7, Math.min(90, Number(windowDays) || 14));
  var t = targets && typeof targets === 'object' ? targets : {};
  var targetCals = Number(t.targetCals) || 0;
  var targetProtein = Number((t.macros || {}).protein) || 0;

  var cutoff = Date.now() - days * 86400000;
  var logged = (Array.isArray(nutritionRows) ? nutritionRows : [])
    .filter(function (r) { return r && r.day && Date.parse(r.day) >= cutoff && Number(r.calories) > 0; });

  var out = {
    windowDays: days, loggedDays: logged.length,
    loggingRate: Math.round((logged.length / days) * 100),
    calorieAccuracy: null, proteinHitRate: null,
    avgCalories: null, avgProtein: null, avgWaterMl: null,
    status: 'no_data', messages: []
  };
  if (!logged.length) {
    out.messages.push('\u0645\u0641\u064a\u0634 \u062a\u0633\u062c\u064a\u0644 \u063a\u0630\u0627\u0626\u064a \u0643\u0641\u0627\u064a\u0629 \u2014 \u0633\u062c\u0651\u0644 \u0623\u0643\u0644\u0643 \u0623\u0633\u0628\u0648\u0639 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0639\u0634\u0627\u0646 \u0623\u0642\u062f\u0631 \u0623\u0638\u0628\u0637 \u062e\u0637\u062a\u0643.');
    return out;
  }

  var avgCals = logged.reduce(function (s, r) { return s + Number(r.calories); }, 0) / logged.length;
  var avgPro = logged.reduce(function (s, r) { return s + Number(r.protein || 0); }, 0) / logged.length;
  var avgWater = logged.reduce(function (s, r) { return s + Number(r.water_ml || r.waterMl || 0); }, 0) / logged.length;
  out.avgCalories = Math.round(avgCals);
  out.avgProtein = Math.round(avgPro);
  out.avgWaterMl = Math.round(avgWater);

  if (targetCals > 0) {
    var acc = logged.map(function (r) {
      return Math.max(0, 1 - Math.abs(Number(r.calories) - targetCals) / targetCals);
    });
    out.calorieAccuracy = Math.round((acc.reduce(function (s, v) { return s + v; }, 0) / acc.length) * 100);
  }
  if (targetProtein > 0) {
    var hits = logged.filter(function (r) { return Number(r.protein || 0) >= targetProtein * 0.9; }).length;
    out.proteinHitRate = Math.round((hits / logged.length) * 100);
  }

  if (out.loggingRate < 50) out.messages.push('\u062a\u0633\u062c\u064a\u0644\u0643 \u0645\u062a\u0642\u0637\u0651\u0639 (' + out.loggingRate + '%) \u2014 \u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0645\u0634 \u0647\u062a\u0643\u0648\u0646 \u062f\u0642\u064a\u0642\u0629 \u0645\u0646 \u063a\u064a\u0631 \u062a\u0633\u062c\u064a\u0644 \u0645\u0646\u062a\u0638\u0645.');
  if (targetCals > 0 && avgCals > targetCals * 1.12) out.messages.push('\u0645\u062a\u0648\u0633\u0637 \u0633\u0639\u0631\u0627\u062a\u0643 \u0623\u0639\u0644\u0649 \u0645\u0646 \u0647\u062f\u0641\u0643 \u0628\u0640' + Math.round(avgCals - targetCals) + ' \u0633\u0639\u0631 \u064a\u0648\u0645\u064a\u064b\u0627.');
  if (targetCals > 0 && avgCals < targetCals * 0.85) out.messages.push('\u0645\u062a\u0648\u0633\u0637 \u0633\u0639\u0631\u0627\u062a\u0643 \u0623\u0642\u0644 \u0645\u0646 \u0647\u062f\u0641\u0643 \u0628\u0643\u062a\u064a\u0631 \u2014 \u0627\u0644\u0639\u062c\u0632 \u0627\u0644\u0632\u0627\u0626\u062f \u0628\u064a\u0636\u0631 \u0627\u0644\u0639\u0636\u0644\u0629 \u0648\u0627\u0644\u0647\u0631\u0645\u0648\u0646\u0627\u062a.');
  if (out.proteinHitRate !== null && out.proteinHitRate < 60) out.messages.push('\u0627\u0644\u0628\u0631\u0648\u062a\u064a\u0646 \u0648\u0635\u0644 \u0647\u062f\u0641\u0647 \u0641\u064a ' + out.proteinHitRate + '% \u0645\u0646 \u0627\u0644\u0623\u064a\u0627\u0645 \u0628\u0633 \u2014 \u062f\u0647 \u0623\u0647\u0645 \u0645\u0627\u0643\u0631\u0648 \u0644\u0644\u062d\u0641\u0627\u0638 \u0639\u0644\u0649 \u0627\u0644\u0639\u0636\u0644\u0629.');

  if (out.loggingRate >= 80 && (out.calorieAccuracy === null || out.calorieAccuracy >= 85)) out.status = 'excellent';
  else if (out.loggingRate >= 60) out.status = 'good';
  else if (out.loggingRate >= 35) out.status = 'inconsistent';
  else out.status = 'poor';

  if (!out.messages.length) out.messages.push('\u0627\u0644\u062a\u0632\u0627\u0645\u0643 \u0645\u0645\u062a\u0627\u0632 \u2014 \u0643\u0645\u0651\u0644 \u0628\u0646\u0641\u0633 \u0627\u0644\u0625\u064a\u0642\u0627\u0639.');
  return out;
}

// ---- Plan staleness -----------------------------------------
// A plan built at 95kg is wrong at 88kg. Real coaches recalculate.
function planStaleness(profileWeight, weightRows, profileUpdatedAt) {
  var out = {
    needsRecalc: false, reason: null, message: null,
    currentWeight: null, planWeight: Number(profileWeight) || null,
    deltaKg: null, daysSinceUpdate: null
  };
  var weights = (Array.isArray(weightRows) ? weightRows : [])
    .filter(function (r) { return r && Number(r.weight) > 0; })
    .sort(function (a, b) { return a.day < b.day ? 1 : -1; });

  if (weights.length) {
    var recent = weights.slice(0, Math.min(3, weights.length));
    var cur = recent.reduce(function (s, r) { return s + Number(r.weight); }, 0) / recent.length;
    out.currentWeight = Math.round(cur * 10) / 10;
    if (out.planWeight) {
      out.deltaKg = Math.round((cur - out.planWeight) * 10) / 10;
      if (Math.abs(out.deltaKg) >= Math.max(3, out.planWeight * 0.04)) {
        out.needsRecalc = true;
        out.reason = 'weight_changed';
        out.message = '\u0648\u0632\u0646\u0643 \u0627\u062a\u063a\u064a\u0631 ' + out.deltaKg + ' \u0643\u062c\u0645 \u0639\u0646 \u0648\u0642\u062a \u0628\u0646\u0627\u0621 \u0627\u0644\u062e\u0637\u0629 \u2014 \u0627\u0644\u0633\u0639\u0631\u0627\u062a \u0648\u0627\u0644\u0645\u0627\u0643\u0631\u0648\u0632 \u0645\u062d\u062a\u0627\u062c\u0629 \u0625\u0639\u0627\u062f\u0629 \u062d\u0633\u0627\u0628.';
      }
    }
  }
  if (profileUpdatedAt) {
    var d = Math.round((Date.now() - Date.parse(profileUpdatedAt)) / 86400000);
    if (Number.isFinite(d)) {
      out.daysSinceUpdate = d;
      if (!out.needsRecalc && d >= 42) {
        out.needsRecalc = true;
        out.reason = 'stale_plan';
        out.message = '\u0628\u0642\u0627\u0644\u0643 ' + d + ' \u064a\u0648\u0645 \u0639\u0644\u0649 \u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b \u0644\u0644\u062e\u0637\u0629 \u2014 \u0631\u0627\u062c\u0639 \u0628\u064a\u0627\u0646\u0627\u062a\u0643 \u0639\u0634\u0627\u0646 \u062a\u0641\u0636\u0644 \u062f\u0642\u064a\u0642\u0629.';
      }
    }
  }
  return out;
}

// ── resolvePantry ───────────────────────────────────────────────────
// Decides which food ids the engine is allowed to plan from, mirroring the
// website's step-6 "الأصناف المتاحة" selection.
//
// Priority, strongest intent first:
//   1. profile.availableFoods  -- the user ticked these on the picker screen.
//   2. favourites in food_preferences -- a weaker but still explicit signal,
//      used only when there are enough of them to build balanced meals from.
//   3. nothing -> the caller omits the pantry and the engine falls back to the
//      full allowed database, exactly like the website does.
//
// MIN_PANTRY exists because a 3-food pantry cannot produce a balanced day; the
// engine would spend the plan on repeats. Below the floor we prefer the honest
// full catalog over a crippled selection.
var MIN_PANTRY = 8;

function resolvePantry(mobileProfile, preferenceRows){
  var p = mobileProfile || {};
  var rows = Array.isArray(preferenceRows) ? preferenceRows : [];

  var clean = function(list){
    var seen = Object.create(null), out = [];
    (Array.isArray(list) ? list : []).forEach(function(raw){
      var id = String(raw == null ? '' : raw).trim();
      if (!id || id.length > 120 || seen[id]) return;
      seen[id] = true;
      out.push(id);
    });
    return out.slice(0, 400);
  };

  var chosen = clean(p.availableFoods);
  if (chosen.length >= MIN_PANTRY) {
    return { ids: chosen, source: 'user_selection', count: chosen.length };
  }
  // An explicit but too-small selection is reported so the UI can nudge the
  // user instead of silently ignoring the taps.
  if (chosen.length) {
    return { ids: null, source: 'selection_too_small', count: chosen.length, min: MIN_PANTRY };
  }

  var favs = clean(rows.filter(function(r){ return r && (r.favorite === 1 || r.favorite === true); })
    .map(function(r){ return r.food_id; }));
  if (favs.length >= MIN_PANTRY) {
    return { ids: favs, source: 'favorites', count: favs.length };
  }

  return { ids: null, source: 'full_catalog', count: 0, min: MIN_PANTRY };
}

module.exports = {
  ACTIVITY: ACTIVITY, SLEEP_HOURS: SLEEP_HOURS, GOAL: GOAL, CARDIO_MET: CARDIO_MET,
  MIN_PANTRY: MIN_PANTRY, resolvePantry: resolvePantry,
  buildEngineContext: buildEngineContext,
  adaptiveTdee: adaptiveTdee, adherence: adherence, planStaleness: planStaleness,
  navyBodyFat: navyBodyFat, safeWeeklyRate: safeWeeklyRate,
  cardioKcalPerMin: cardioKcalPerMin, metCorrectedCardioSessions: metCorrectedCardioSessions
};
