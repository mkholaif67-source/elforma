'use strict';
/* ============================================================================
 * diet-periodization.js  --  The diet coaching brain, ported to the backend.
 *
 * WHY THIS FILE EXISTS
 * The website's smart-coach dashboard (app/diet/ui/coach.js, 1509 lines) knows
 * how to make a diet CHANGE OVER TIME: it detects plateaus from a 7-day trend
 * weight, runs a 7-week periodised cycle (adaptation -> moderate cut -> diet
 * break), schedules refeed days, and recalculates calories as the body
 * changes. None of that reached the app: the mobile backend computed one
 * static target and kept serving it forever. A plan built at 95 kg is wrong at
 * 88 kg, and a deficit that worked in week 1 stalls by week 6.
 *
 * Every equation below is a verbatim port of the website logic, rewritten as
 * PURE functions (data in -> data out) instead of localStorage readers, so it
 * is testable and reusable from api/mobile.js.
 *
 * Evidence base:
 *  - MATADOR trial (Byrne 2018): intermittent diet breaks at maintenance
 *    preserve RMR and improve fat loss vs continuous restriction.
 *  - Trexler 2014: metabolic adaptation to prolonged energy restriction.
 *  - Refeeds raise leptin and training quality without wiping the weekly
 *    deficit when kept to 1 day of the cycle.
 * ========================================================================= */

const KCAL_PER_KG = 7700;   // energy in 1 kg of body mass (website constant)
const AT_CAP = 0.15;        // metabolic adaptation is capped at 15%

function r1(x){ return Math.round((Number(x) || 0) * 10) / 10; }
function clamp(v, lo, hi){ v = Number(v) || 0; return v < lo ? lo : (v > hi ? hi : v); }
function avg(a){ return (a && a.length) ? a.reduce(function(x, y){ return x + y; }, 0) / a.length : 0; }
function daysBetween(a, b){
  const d = (new Date(b) - new Date(a)) / 86400000;
  return Math.round(Math.abs(d));
}
function sortWeights(weights){
  return (Array.isArray(weights) ? weights : [])
    .filter(function(w){ return w && w.date && Number(w.weight) > 0; })
    .map(function(w){ return { date: String(w.date).slice(0, 10), weight: Number(w.weight) }; })
    .sort(function(a, b){ return new Date(a.date) - new Date(b.date); });
}

/* ── 1) Trend weight ─────────────────────────────────────────────────────
 * A single morning weigh-in is mostly water and salt. The website smooths
 * every logged weight with a 7-day moving average and only ever reasons about
 * that trend, never the raw number. */
function trendSeries(weights){
  const w = sortWeights(weights);
  if (!w.length) return [];
  const out = [];
  for (let i = 0; i < w.length; i++){
    const end = new Date(w[i].date);
    const winStart = new Date(end);
    winStart.setDate(end.getDate() - 6);
    const vals = [];
    for (let j = 0; j <= i; j++){
      const d = new Date(w[j].date);
      if (d >= winStart && d <= end) vals.push(w[j].weight);
    }
    out.push({ date: w[i].date, raw: w[i].weight, trend: r1(avg(vals)) });
  }
  return out;
}

function latestTrend(weights, fallbackWeight){
  const t = trendSeries(weights);
  return t.length ? t[t.length - 1].trend : (Number(fallbackWeight) || null);
}

/* Weekly rate of change in kg/week across the last `days` window. Returns null
 * when there is not enough data (< 2 points or < 5 days apart) so callers can
 * say "still collecting" instead of inventing a number. */
function weeklyRateKg(weights, days){
  days = days || 21;
  const t = trendSeries(weights);
  if (t.length < 2) return null;
  const last = t[t.length - 1];
  const cutoff = new Date(last.date);
  cutoff.setDate(cutoff.getDate() - days);
  let first = t[0];
  for (let i = t.length - 1; i >= 0; i--){
    if (new Date(t[i].date) <= cutoff){ first = t[i]; break; }
  }
  const dd = daysBetween(first.date, last.date);
  if (dd < 5) return null;
  return r1(((last.trend - first.trend) / dd) * 7);
}

/* ── 2) Adaptive TDEE from energy balance ───────────────────────────────
 * estTDEE = average intake - (change in trend weight x 7700) / days
 * A formula only ever produces an ESTIMATE. The body reports the truth. */
function estimateTDEE(weights, avgIntake, theoreticalTdee){
  const t = trendSeries(weights);
  const base = Number(theoreticalTdee) || 0;
  if (t.length < 2 || !avgIntake) return base || null;
  const last = t[t.length - 1];
  const cutoff = new Date(last.date);
  cutoff.setDate(cutoff.getDate() - 21);
  let first = t[0];
  for (let i = t.length - 1; i >= 0; i--){
    if (new Date(t[i].date) <= cutoff){ first = t[i]; break; }
  }
  const dd = daysBetween(first.date, last.date);
  if (dd < 7) return base || null;
  const dW = last.trend - first.trend;
  const est = Number(avgIntake) - (dW * KCAL_PER_KG) / dd;
  if (!base) return Math.round(est);
  return Math.round(clamp(est, base * 0.7, base * 1.3));
}

/* Metabolic adaptation: how far actual TDEE has drifted below theory. */
function adaptivePct(theoreticalTdee, actualTdee){
  if (!theoreticalTdee || !actualTdee) return 0;
  return clamp(Math.round((1 - actualTdee / theoreticalTdee) * 100), 0, Math.round(AT_CAP * 100));
}

/* ── 3) Plateau detection ───────────────────────────────────────────
 * A plateau is NOT "the scale did not move today". The website definition:
 * trend change < ~0.2% bodyweight/week for >= 2 tracked weeks AND adherence
 * >= 85%. Below 85% adherence the problem is not the plan, it is the logging,
 * and dropping calories would be the wrong (and unsafe) answer. */
function plateauStatus(opts){
  const o = opts || {};
  const goal = String(o.goal || 'cut');
  const weights = o.weights || [];
  const adh = Math.round(Number(o.adherencePct) || 0);
  const loggedDays = Number(o.loggedDays) || 0;
  const rate = weeklyRateKg(weights, 21);
  const weeksTracked = Math.max(1, Math.ceil(loggedDays / 7));
  const bw = latestTrend(weights, o.weight) || Number(o.weight) || 80;
  const thr = bw * 0.002;   // 0.2% bodyweight per week

  if (rate === null || weeksTracked < 2) return { state:'collecting', rate:rate, adh:adh, weeksTracked:weeksTracked };

  if (goal === 'cut' || goal === 'recomp' || goal === 'lose'){
    if (Math.abs(rate) < thr){
      if (adh < 85) return { state:'adherence', rate:rate, adh:adh, weeksTracked:weeksTracked };
      return { state:'plateau', rate:rate, adh:adh, weeksTracked:weeksTracked };
    }
    if (rate < -(bw * 0.012)) return { state:'too_fast', rate:rate, adh:adh, weeksTracked:weeksTracked };
    return { state:'on_track', rate:rate, adh:adh, weeksTracked:weeksTracked };
  }
  if (goal === 'bulk' || goal === 'muscle' || goal === 'gain'){
    if (rate < thr) return adh >= 85
      ? { state:'stall_gain', rate:rate, adh:adh, weeksTracked:weeksTracked }
      : { state:'adherence', rate:rate, adh:adh, weeksTracked:weeksTracked };
    if (rate > (bw * 0.01)) return { state:'too_fast_gain', rate:rate, adh:adh, weeksTracked:weeksTracked };
    return { state:'on_track', rate:rate, adh:adh, weeksTracked:weeksTracked };
  }
  return { state:'maintain', rate:rate, adh:adh, weeksTracked:weeksTracked };
}

/* ── 4) Periodisation: the plan that changes by itself ────────────────────
 * 7-week cycle for a cut: weeks 1-2 adaptation (gentler deficit), then
 * moderate cut with 1 refeed day per week, and every 7th week is a full
 * maintenance DIET BREAK (MATADOR protocol). */
function phaseForWeek(week, opts){
  const o = opts || {};
  const goal = String(o.goal || 'cut');
  const base = Math.round(Number(o.targetCals) || 0);
  const maint = Math.round(Number(o.maintenanceCals) || Math.round(base * 1.18));
  week = Math.max(1, Math.round(Number(week) || 1));

  if (goal === 'bulk' || goal === 'muscle' || goal === 'gain'){
    if (week <= 2) return { type:'ADAPTATION', label:'\u062a\u0623\u0633\u064a\u0633 \u0644\u0637\u064a\u0641', cals:Math.round(base * 0.97), refeed:0,
      note:'\u0628\u062f\u0627\u064a\u0629 \u062a\u062f\u0631\u064a\u062c\u064a\u0629 \u0644\u062a\u0647\u064a\u0626\u0629 \u0627\u0644\u062c\u0647\u0627\u0632 \u0627\u0644\u0647\u0636\u0645\u064a' };
    return { type:'LEAN_SURPLUS', label:'\u0641\u0627\u0626\u0636 \u0646\u0638\u064a\u0641', cals:base, refeed:0,
      note:'\u0641\u0627\u0626\u0636 \u0645\u0636\u0628\u0648\u0637 \u0644\u0628\u0646\u0627\u0621 \u0639\u0636\u0644\u064a \u0628\u0623\u0642\u0644 \u062f\u0647\u0648\u0646' };
  }
  if (goal === 'maintain') return { type:'STABILIZATION', label:'\u062b\u0628\u0627\u062a', cals:maint, refeed:0,
    note:'\u062a\u062b\u0628\u064a\u062a \u0627\u0644\u0648\u0632\u0646 \u0639\u0646\u062f \u0627\u0644\u0635\u064a\u0627\u0646\u0629' };

  const cyc = ((week - 1) % 7);
  if (week <= 2) return { type:'ADAPTATION', label:'\u062a\u0623\u0642\u0644\u0645', cals:Math.round(base * 1.04), refeed:0,
    note:'\u062a\u062e\u0641\u064a\u0636 \u0623\u0644\u0637\u0641 \u0641\u064a \u0623\u0648\u0644 \u0623\u0633\u0628\u0648\u0639\u064a\u0646 \u0644\u062a\u0642\u0644\u064a\u0644 \u0635\u062f\u0645\u0629 \u0627\u0644\u062a\u0643\u064a\u0641 \u0627\u0644\u062d\u0631\u0627\u0631\u064a' };
  if (cyc === 6) return { type:'DIET_BREAK', label:'\u0627\u0633\u062a\u0631\u0627\u062d\u0629 \u062f\u0627\u064a\u062a', cals:maint, refeed:7,
    note:'\u0623\u0633\u0628\u0648\u0639 \u0635\u064a\u0627\u0646\u0629 \u0643\u0627\u0645\u0644 (MATADOR) \u0644\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0644\u064a\u0628\u062a\u064a\u0646 \u0648\u0627\u0644\u062f\u0631\u0642\u064a\u0629 \u0648\u062a\u062e\u0641\u064a\u0641 \u0627\u0644\u062a\u0643\u064a\u0641' };
  return { type:'MODERATE_CUT', label:'\u062a\u0646\u0634\u064a\u0641 \u0645\u0639\u062a\u062f\u0644', cals:base, refeed:1,
    note:'\u062a\u0646\u0634\u064a\u0641 \u0645\u0633\u062a\u0642\u0631 \u0645\u0639 \u064a\u0648\u0645 \u0631\u064a\u0641\u064a\u062f \u0641\u064a \u0627\u0644\u0623\u0633\u0628\u0648\u0639' };
}

/* Is this calendar date a refeed day inside the given week? Refeeds land on
 * the highest-training day of the week (Saturday in the Egyptian week). */
function isRefeedDate(date, week, opts){
  const ph = phaseForWeek(week, opts);
  if (!ph.refeed) return false;
  if (ph.refeed >= 7) return true;             // whole diet-break week
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  return d.getDay() === 6;                     // Saturday
}

/* ── 5) Carb cycling: the day-level target ─────────────────────────────
 * Not every day is the same day. Training days get more carbs, rest days get
 * fewer, refeed days go to maintenance carbs. Protein never moves (it is the
 * one macro you protect in a deficit); fat absorbs part of the swing.
 *
 * Evidence: total weekly energy drives weight change, but carb placement
 * around training improves performance and training quality (ISSN 2017). */
function dayTarget(opts){
  const o = opts || {};
  const week = Math.max(1, Math.round(Number(o.week) || 1));
  const phase = phaseForWeek(week, o);
  const isTraining = !!o.isTrainingDay;
  const refeed = isRefeedDate(o.date || new Date(), week, o);
  const baseMacros = o.macros || {};
  const protein = Math.round(Number(baseMacros.protein) || 0);

  let cals = Math.round(phase.cals || Number(o.targetCals) || 0);
  let mode = refeed ? 'refeed' : (isTraining ? 'training' : 'rest');

  // Carb cycling multipliers applied to the PHASE calories.
  // Weekly average stays equal to the phase target, so the deficit is intact.
  if (!refeed && phase.type !== 'DIET_BREAK'){
    if (isTraining) cals = Math.round(cals * 1.08);
    else            cals = Math.round(cals * 0.94);
  }
  if (refeed) cals = Math.round(Number(o.maintenanceCals) || Math.round(cals * 1.15));

  // Re-split macros around the fixed protein floor.
  const proCals = protein * 4;
  let rest = Math.max(0, cals - proCals);
  // Training/refeed days lean carb-heavy, rest days lean fat-heavy.
  const carbShare = refeed ? 0.72 : (isTraining ? 0.65 : 0.48);
  const carbs = Math.round((rest * carbShare) / 4);
  const fat   = Math.round((rest * (1 - carbShare)) / 9);

  return {
    week: week,
    date: String(o.date || '').slice(0, 10) || null,
    mode: mode,
    phase: phase.type,
    phaseLabel: phase.label,
    phaseNote: phase.note,
    isRefeed: refeed,
    isTrainingDay: isTraining,
    targetCals: cals,
    macros: { protein: protein, carbs: carbs, fat: fat }
  };
}

/* ── 6) The auto-adjustment decision ─────────────────────────────────
 * What a real coach does at the weekly check-in. Deliberately conservative:
 * a single adjustment never moves more than 10% of intake, never breaks the
 * calorie floor, and a plateau caused by poor logging is never "fixed" by
 * cutting food. */
function autoAdjust(opts){
  const o = opts || {};
  const status = plateauStatus(o);
  const cur = Math.round(Number(o.targetCals) || 0);
  const floor = Math.round(Number(o.calorieFloor) || 1200);
  const goal = String(o.goal || 'cut');
  const isCut = (goal === 'cut' || goal === 'lose' || goal === 'recomp');
  let next = cur, reason = '', action = 'hold';

  switch (status.state){
    case 'collecting':
      reason = '\u0644\u0633\u0647 \u0628\u0646\u062c\u0645\u0639 \u0628\u064a\u0627\u0646\u0627\u062a. \u0633\u062c\u0651\u0644 \u0648\u0632\u0646\u0643 \u0648\u0648\u062c\u0628\u0627\u062a\u0643 \u0644\u0645\u062f\u0629 \u0623\u0633\u0628\u0648\u0639\u064a\u0646 \u0648\u0627\u0644\u0646\u0638\u0627\u0645 \u0647\u064a\u0638\u0628\u0637 \u0646\u0641\u0633\u0647 \u0644\u0648\u062d\u062f\u0647.';
      break;
    case 'adherence':
      reason = '\u0627\u0644\u062a\u0632\u0627\u0645\u0643 ' + status.adh + '%. \u0627\u0644\u0645\u0634\u0643\u0644\u0629 \u0645\u0634 \u0641\u064a \u0627\u0644\u062e\u0637\u0629 \u0641\u0645\u0627\u0641\u064a\u0634 \u062f\u0627\u0639\u064a \u0646\u0642\u0644\u0644 \u0627\u0644\u0623\u0643\u0644 \u2014 \u0631\u0643\u0651\u0632 \u0639\u0644\u0649 \u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u062f\u0647.';
      break;
    case 'plateau':
      next = Math.max(floor, Math.round(cur * 0.92));
      action = next < cur ? 'decrease' : 'hold';
      reason = '\u062b\u0628\u0627\u062a \u062d\u0642\u064a\u0642\u064a \u0645\u0639 \u0627\u0644\u062a\u0632\u0627\u0645 \u0639\u0627\u0644\u064a. \u062a\u0642\u0644\u064a\u0644 8% \u0645\u0646 \u0627\u0644\u0633\u0639\u0631\u0627\u062a \u0644\u0643\u0633\u0631 \u0627\u0644\u062b\u0628\u0627\u062a.';
      break;
    case 'too_fast':
      next = Math.round(cur * 1.07);
      action = 'increase';
      reason = '\u0628\u062a\u062e\u0633 \u0628\u0633\u0631\u0639\u0629 \u0632\u064a\u0627\u062f\u0629 \u0639\u0646 \u0627\u0644\u0622\u0645\u0646 \u2014 \u062f\u0647 \u0628\u064a\u0627\u0643\u0644 \u0639\u0636\u0644. \u0632\u0648\u062f\u0646\u0627 \u0627\u0644\u0633\u0639\u0631\u0627\u062a \u0634\u0648\u064a\u0629.';
      break;
    case 'stall_gain':
      next = Math.round(cur * 1.08);
      action = 'increase';
      reason = '\u0627\u0644\u0648\u0632\u0646 \u0648\u0627\u0642\u0641 \u0648\u0627\u0644\u0647\u062f\u0641 \u0632\u064a\u0627\u062f\u0629. \u0632\u0648\u062f\u0646\u0627 \u0627\u0644\u0633\u0639\u0631\u0627\u062a 8%.';
      break;
    case 'too_fast_gain':
      next = Math.round(cur * 0.94);
      action = 'decrease';
      reason = '\u0628\u062a\u0632\u064a\u062f \u0628\u0633\u0631\u0639\u0629 \u2014 \u062f\u0647 \u062f\u0647\u0648\u0646 \u0645\u0634 \u0639\u0636\u0644. \u0642\u0644\u0651\u0644\u0646\u0627 \u0627\u0644\u0641\u0627\u0626\u0636 \u0634\u0648\u064a\u0629.';
      break;
    case 'on_track':
      reason = '\u0645\u0627\u0634\u064a \u0635\u062d \u0628\u0645\u0639\u062f\u0644 ' + (status.rate != null ? Math.abs(status.rate) : 0) + ' \u0643\u062c\u0645/\u0623\u0633\u0628\u0648\u0639. \u0645\u0627\u0641\u064a\u0634 \u062f\u0627\u0639\u064a \u0644\u0623\u064a \u062a\u063a\u064a\u064a\u0631.';
      break;
    default:
      reason = '\u0627\u0644\u0648\u0632\u0646 \u062b\u0627\u0628\u062a \u0632\u064a \u0627\u0644\u0645\u0637\u0644\u0648\u0628.';
  }

  // Weight-change recalculation: a plan built at 95 kg is wrong at 88 kg.
  const nowW = latestTrend(o.weights, o.weight);
  const planW = Number(o.planWeight) || Number(o.weight) || nowW;
  const drifted = (nowW && planW) ? Math.abs(nowW - planW) >= Math.max(2, planW * 0.03) : false;

  if (!isCut && action === 'hold' && drifted) action = 'recalculate';
  if (drifted && action === 'hold'){
    action = 'recalculate';
    reason = '\u0648\u0632\u0646\u0643 \u0627\u062a\u063a\u064a\u0631 \u0645\u0646 ' + r1(planW) + ' \u0644\u0640 ' + r1(nowW) + ' \u0643\u062c\u0645 \u2014 \u0627\u0644\u062e\u0637\u0629 \u0645\u062d\u062a\u0627\u062c\u0629 \u0625\u0639\u0627\u062f\u0629 \u062d\u0633\u0627\u0628.';
  }

  return {
    state: status.state,
    action: action,
    weeklyRateKg: status.rate,
    adherencePct: status.adh,
    weeksTracked: status.weeksTracked,
    currentCals: cur,
    suggestedCals: Math.round(next),
    deltaCals: Math.round(next) - cur,
    trendWeight: nowW,
    needsRecalc: drifted,
    reason: reason
  };
}

module.exports = {
  KCAL_PER_KG, AT_CAP,
  trendSeries, latestTrend, weeklyRateKg,
  estimateTDEE, adaptivePct,
  plateauStatus, phaseForWeek, isRefeedDate,
  dayTarget, autoAdjust
};
