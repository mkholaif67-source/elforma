'use strict';
// ═══════════════════════════════════════════════════════════════════════
// WORKOUT PLAN FINISHER  (Sprint 15)
//
// Two defects were proven by probe, both inside the ORIGINAL engine's
// later passes -- and both leaked straight onto the app's exercise cards:
//
//  (1) INCOMPLETE PRESCRIPTIONS
//      `applyPrescriptionLayer()` runs BEFORE the coverage/replacement
//      passes. Any lift swapped in afterwards (tagged `_pass2rReplacement`
//      in ui/components.js:3798) therefore never meets prescribeExercise(),
//      so it arrives with NO rir, NO tempo, NO progression and NO exType.
//      The app then rendered an exercise card with blank fields.
//
//  (2) UNSTABLE VARIETY SEED
//      planner.js:16 `_freshVarietySeed()` mixes Date.now() with
//      Math.random(), so warm-up drill ORDER changed on every request.
//      A training plan the user reopens must look the same.
//
// PRINCIPLE: we invent NOTHING. Repairs call the project's own
// `prescribeExercise` / `classifyExerciseType` / `resetVarietySeed`, so the
// coaching logic stays exactly as authored -- we only make sure it is
// actually APPLIED to every lift that reaches the phone.
// ═══════════════════════════════════════════════════════════════════════

var host = require('./workout-engine-host');

// ── deterministic 32-bit FNV-1a, so one profile always maps to one seed ──
function hashString(str) {
  var h = 0x811c9dc5;
  var s = String(str);
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0 || 0x9e3779b9;
}

// The seed must depend on WHO the user is (two different people get two
// different-looking plans, which the engine intends) but NOT on WHEN they
// asked (the same person reopening the app sees the same plan).
function stableSeed(profile) {
  var p = profile || {};
  return hashString([
    p.gender, p.age, p.height, p.weight, p.goal, p.exp, p.equip,
    p.days, p.time, p.daily, p.sleep, p.stress,
    (p.injuries || []).slice().sort().join('.'),
    (p.weak || []).slice().sort().join('.')
  ].join('|'));
}

// Call BEFORE host.computeWorkout so the engine's own variety RNG is
// reproducible. Uses the project's exported resetVarietySeed.
function stabilize(profile) {
  try {
    var ctx = host.engineContext();
    if (ctx && typeof ctx.resetVarietySeed === 'function') {
      ctx.resetVarietySeed(stableSeed(profile));
      return true;
    }
  } catch (e) { /* variety stability is a nicety, never a blocker */ }
  return false;
}

function isLift(node) {
  return node && typeof node === 'object' &&
    typeof node.n === 'string' && node.n.length > 0 &&
    (node.sets != null || node.reps != null || node.mu != null || node.grp != null);
}

function needsPrescription(ex) {
  return !ex.rir || !ex.progression || !ex.tempo || !ex.reps || !ex.rest;
}

// Fill ONLY what the engine left empty. Never overwrite an authored value.
function prescribe(ex, ctx, goal, exp, recovery) {
  if (!ctx || typeof ctx.prescribeExercise !== 'function') return null;
  var p;
  try { p = ctx.prescribeExercise(ex, goal, exp, recovery); }
  catch (e) { return null; }
  if (!p || typeof p !== 'object') return null;

  var filled = [];
  ['reps', 'rest', 'rir', 'progression', 'tempo', 'progressiveRIR'].forEach(function (k) {
    var missing = ex[k] == null || String(ex[k]).length === 0;
    if (missing && p[k] != null && String(p[k]).length > 0) {
      ex[k] = p[k];
      filled.push(k);
    }
  });

  if (!ex.exType && typeof ctx.classifyExerciseType === 'function') {
    try {
      var t = ctx.classifyExerciseType(ex);
      if (t) { ex.exType = t; filled.push('exType'); }
    } catch (e) { /* classification is cosmetic */ }
  }

  if (filled.length) ex._prescriptionRepaired = filled.join(',');
  return filled.length ? filled : null;
}

// Walk the whole computeWorkout() result and complete every lift.
function completePlan(out, profile) {
  var stats = { scanned: 0, repaired: 0, fields: {} };
  if (!out) return stats;

  var ctx;
  try { ctx = host.engineContext(); } catch (e) { return stats; }
  if (!ctx) return stats;

  var p = profile || {};
  var goal = String(p.goal || 'fitness');
  var exp = String(p.exp || 'intermediate');
  var recovery = Number(out.metrics && out.metrics.recoveryScore);
  if (!Number.isFinite(recovery) || recovery <= 0) recovery = 75;

  function walk(node, depth) {
    if (!node || depth > 8) return;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) walk(node[i], depth + 1);
      return;
    }
    if (typeof node !== 'object') return;

    if (isLift(node)) {
      stats.scanned++;
      if (needsPrescription(node)) {
        var filled = prescribe(node, ctx, goal, exp, recovery);
        if (filled) {
          stats.repaired++;
          filled.forEach(function (k) {
            stats.fields[k] = (stats.fields[k] || 0) + 1;
          });
        }
      }
      return; // a lift holds no nested lifts
    }

    var keys = Object.keys(node);
    for (var j = 0; j < keys.length; j++) walk(node[keys[j]], depth + 1);
  }

  walk(out, 0);
  return stats;
}

// ── COLD-START GUARD ────────────────────────────────────────────
// Proven by probe: the FIRST computeWorkout() in a fresh process differs from
// every later one, and Render cold-starts services constantly. Burn one
// throwaway computation so every plan a human sees comes from settled state.
var _warmed = false;
function warmUp() {
  if (_warmed) return;
  _warmed = true;
  try {
    stabilize({ warmup: true });
    host.computeWorkout({
      gender: 'male', age: 30, height: 175, weight: 80,
      goal: 'fitness', exp: 'intermediate', equip: 'gym',
      days: 3, time: 60, daily: 'light', sleep: 'ok', stress: 'low',
      injuries: [], weak: []
    });
  } catch (e) { /* a failed warm-up must never break a real request */ }
}

// ── WARM-UP NORMALISATION ─────────────────────────────────────
// The residual instability is NOT exercise selection -- selection is already
// byte-stable. It is ONE advisory line: the engine appends a generic
// "Ramp-Up Sets" coaching note into the same array as the concrete drills,
// and its insertion position shifts with module load order.
//
// Rather than freeze an arbitrary order, impose the order a coach actually
// wants on screen: concrete drills first (authored order preserved), general
// advice last. Nothing is added or removed -- only ordered, and now stable.
var ADVISORY = /Ramp-Up Sets/;
function normalizeWarmups(out) {
  var moved = 0;
  function fix(day) {
    if (!day || !Array.isArray(day.warm) || day.warm.length < 2) return;
    var drills = [], notes = [];
    day.warm.forEach(function (line) {
      if (ADVISORY.test(String(line))) notes.push(line);
      else drills.push(line);
    });
    if (!notes.length) return;
    var reordered = drills.concat(notes);
    for (var i = 0; i < reordered.length; i++) {
      if (day.warm[i] !== reordered[i]) { moved++; break; }
    }
    day.warm = reordered;
  }
  if (out && Array.isArray(out.plans)) {
    out.plans.forEach(function (p) {
      if (p && Array.isArray(p.plan)) p.plan.forEach(fix);
      if (p && Array.isArray(p.trainDays)) p.trainDays.forEach(fix);
    });
  }
  return moved;
}

// One call for the API layer: warm, seed, compute, complete, normalise.
function computeStablePlan(profile) {
  warmUp();
  stabilize(profile);
  var out = host.computeWorkout(profile);
  var stats = completePlan(out, profile);
  stats.warmupsReordered = normalizeWarmups(out);
  // NOTE: only load-order-invariant telemetry may ride along in the response.
  // `warmupsReordered` counts how many arrays this call had to reorder, which
  // legitimately differs between the first and later calls in a process -- it
  // stays in `stats` for tests and never enters the payload, otherwise it
  // would itself break byte-parity between two identical requests.
  if (out && typeof out === 'object') {
    out._finisher = { scanned: stats.scanned, repaired: stats.repaired };
  }
  return { out: out, stats: stats };
}

module.exports = {
  hashString: hashString,
  stableSeed: stableSeed,
  stabilize: stabilize,
  completePlan: completePlan,
  computeStablePlan: computeStablePlan,
  warmUp: warmUp,
  normalizeWarmups: normalizeWarmups,
  isLift: isLift,
  needsPrescription: needsPrescription
};
