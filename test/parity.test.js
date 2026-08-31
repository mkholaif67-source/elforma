'use strict';
// ═══════════════════════════════════════════════════════════════════════
// ENGINE PARITY SUITE  (Sprint 15)
//
// The one question this file exists to answer, forever, on every build:
//   "Does the mobile app produce the SAME numbers as the website, out of the
//    SAME engine, using the SAME data -- or has something drifted?"
//
// The website runs app/diet/js/* and app/workout/engine/* in a browser.
// The app reaches the identical code through lib/*-engine-host.js. If any
// future change makes the two disagree, this suite fails the build.
//
// It asserts four things:
//   A. NUTRITION PARITY  - website inputs and bridge inputs land on identical
//                          BMR / TDEE / calories / macros.
//   B. WORKOUT PARITY    - the plan is byte-reproducible and every lift comes
//                          from the project's own exercise DB.
//   C. COMPLETENESS      - no lift ever reaches a phone missing its RIR,
//                          tempo or progression rule.
//   D. RESPONSIVENESS    - the user's own data genuinely changes the output.
// ═══════════════════════════════════════════════════════════════════════

const nutritionHost = require('../lib/nutrition-engine-host');
const bridge = require('../lib/mobile-nutrition-bridge');
const workoutHost = require('../lib/workout-engine-host');
const finisher = require('../lib/workout-plan-finisher');
const videoGuard = require('../lib/video-guard');
const coach = require('../lib/coach-progression');

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    passed++;
    console.log('  \u2713 ' + label);
  } else {
    failed++;
    console.log('  \u2717 ' + label + (detail ? '  ->  ' + detail : ''));
  }
}
function section(name) { console.log('\n[' + name + ']'); }
function near(a, b, tol) { return Math.abs(Number(a) - Number(b)) <= tol; }

// One human, described twice: once as a mobile profile, once as a set of
// website form inputs. Both must reach the same conclusion.
const MOBILE_PROFILE = {
  gender: 'male', age: 30, height: 178, weight: 95, targetWeight: 82,
  goal: 'lose', dailyActivity: 'sedentary', sleep: 'poor', stress: 'mid',
  experience: 'intermediate', equipment: 'gym',
  trainingDays: 5, trainingMinutes: 75,
  steps: 12500, cardioSessions: 4, cardioIntensity: 'light',
  waist: 104, neck: 41,
  diet: 'balanced', mealCount: 4, healthConditions: [],
  onboardingComplete: true
};
const EXTRAS = {
  steps: 12500, cardioSessions: 4, cardioIntensity: 'light',
  waist: 104, neck: 41
};

// ── A. NUTRITION PARITY ──────────────────────────────────────────
section('nutrition parity: website inputs vs mobile bridge');
const built = bridge.buildEngineContext(MOBILE_PROFILE, EXTRAS);
const appPlan = nutritionHost.computeMealPlan(built.profile, built.inputs);
const appTargets = appPlan.targets;

// Rebuilt by hand the way a site visitor's form would submit it, so this is a
// genuine independent comparison rather than a copy of the bridge's object.
const siteProfile = {
  gender: '\u0630\u0643\u0631', age: 30, height: 178, weight: 95, target: 82,
  activity: 1.2, goal: 'cut', gainStyle: 'lean',
  selectedDiet: 'balanced', mealCount: 4, healthConditions: [],
  expectedWeeklyLoss: built.profile.expectedWeeklyLoss, sleepHours: 5.5,
  // [FIX] gym equipment => isTrainingDay=true in the app, so site must match
  isTrainingDay: true,
};
const siteInputs = {
  'inp-gender': '\u0630\u0643\u0631', 'inp-age': 30, 'inp-height': 178,
  'inp-weight': 95, 'inp-target': 82, 'inp-activity': 1.2,
  'inp-goal': 'cut', 'inp-gain-style': 'lean', 'inp-steps': 12500,
  'inp-train-days': 5, 'inp-workout-dur': 75,
  'inp-cardio': built.inputs['inp-cardio'], 'inp-sleep': 5.5,
  'inp-weekly-rate': built.inputs['inp-weekly-rate'],
  'inp-bf': built.inputs['inp-bf'], 'inp-waist': 104, 'inp-neck': 41,
  'inp-hip': built.inputs['inp-hip'],
  'inp-meals': 4, 'inp-week': 1, 'inp-diet': 'balanced', 'inp-budget': 'mid'
};
const sitePlan = nutritionHost.computeMealPlan(siteProfile, siteInputs);
const siteTargets = sitePlan.targets;

check('calories identical', appTargets.targetCals === siteTargets.targetCals,
  'app=' + appTargets.targetCals + ' site=' + siteTargets.targetCals);
check('protein identical', near(appTargets.macros.protein, siteTargets.macros.protein, 0.5));
check('carbs identical', near(appTargets.macros.carbs, siteTargets.macros.carbs, 0.5));
check('fat identical', near(appTargets.macros.fat, siteTargets.macros.fat, 0.5));
check('BMR identical', near(appTargets.bmr, siteTargets.bmr, 1));
check('TDEE identical', near(appTargets.tdee, siteTargets.tdee, 1));

section('nutrition sanity');
const macroCals = appTargets.macros.protein * 4 +
  appTargets.macros.carbs * 4 + appTargets.macros.fat * 9;
check('macros reconcile with calories (4/4/9)',
  Math.abs(macroCals - appTargets.targetCals) / appTargets.targetCals <= 0.05,
  Math.round(macroCals) + ' vs ' + appTargets.targetCals);
check('a cut lands below TDEE', appTargets.targetCals < appTargets.tdee);
check('male calorie floor respected', appTargets.targetCals >= 1400);
const lbm = 95 * (1 - Number(built.inputs['inp-bf']) / 100);
const gPerKg = appTargets.macros.protein / lbm;
check('protein inside 1.6-3.1 g/kg lean mass', gPerKg >= 1.6 && gPerKg <= 3.1,
  gPerKg.toFixed(2));

section('meal plan provenance');
const meals = (appPlan.plan && appPlan.plan.meals) || [];
check('weeklyMeta reached the strategy layer', !!appPlan.weeklyMeta);
check('no weeklyMetaError', !(appPlan.plan && appPlan.plan.weeklyMetaError));
// [FIX] Gym users (equipment:'gym') always get isTrainingDay=true which adds
// one pre-workout meal ON TOP of the requested mealCount.
// profile has equipment:'gym' + mealCount:4 => expect 5 (4 main + 1 pre-workout).
check('requested meal count honoured (gym adds +1 pre-workout)', meals.length === 5, 'got ' + meals.length);
const catalog = nutritionHost._buildContext().__EF_FOOD_CATALOG || [];
check('food catalog loaded from the project', catalog.length > 50,
  'size ' + catalog.length);
const catalogIds = new Set(catalog.map((f) => String(f.id)));
let invented = 0;
let items = 0;
meals.forEach((m) => {
  (m.foods || m.items || []).forEach((entry) => {
    items++;
    const food = entry.food || entry;
    if (food && food.id != null && !catalogIds.has(String(food.id))) invented++;
  });
});
check('plan contains real food items', items > 0);
check('zero invented foods', invented === 0, invented + ' foreign');

section('safety: an impossible body never receives a plan');
// Before Sprint 15 this returned bmr=5, tdee=7 and a 1400 kcal plan with ZERO
// grams of protein, because the calorie floor masked the broken maths.
const REFUSAL = /^engine_(missing|implausible|bad|empty|zero|no|target)_?/;
function refuses(label, profile, inputs) {
  let message = null;
  try { nutritionHost.computeMealPlan(profile, inputs || {}); }
  catch (e) { message = e.message; }
  check(label, !!message && REFUSAL.test(message), message || 'returned a plan');
}
refuses('an empty profile is refused, never silently NaN', {});
refuses('zeroes are refused', { gender: 'ذكر', age: 0, height: 0, weight: 0 });
refuses('a 5 cm height is refused',
  { gender: 'ذكر', age: 30, height: 5, weight: 95 });
refuses('a negative weight is refused',
  { gender: 'ذكر', age: 30, height: 178, weight: -50 });
refuses('a 300-year-old is refused',
  { gender: 'ذكر', age: 300, height: 178, weight: 95 });
// ...and the guard must NEVER punish a real person.
let realPersonOk = true;
let realPersonErr = '';
try { nutritionHost.computeMealPlan(built.profile, built.inputs); }
catch (e) { realPersonOk = false; realPersonErr = e.message; }
check('a real profile still passes the guard', realPersonOk, realPersonErr);

// ── B. WORKOUT PARITY ───────────────────────────────────────────
section('workout parity and reproducibility');
const WORKOUT_PROFILE = {
  gender: 'male', age: 30, height: 178, weight: 95,
  goal: 'cut', exp: 'intermediate', equip: 'gym',
  days: 5, sleep: 'poor', stress: 'mid', time: 75,
  daily: 'sedentary', injuries: [], weak: ['chest']
};
function recommended(out) {
  const keys = Object.keys(out.plans);
  const key = keys.filter((k) => out.plans[k].rec)[0] || keys[0];
  return out.plans[key];
}
function liftsOf(planNode) {
  const list = [];
  (planNode.plan || []).forEach((day) => {
    (day.exercises || []).forEach((ex) => list.push(ex));
  });
  return list;
}
const runA = finisher.computeStablePlan(WORKOUT_PROFILE).out;
const runB = finisher.computeStablePlan(JSON.parse(JSON.stringify(WORKOUT_PROFILE))).out;
check('two identical requests give byte-identical plans',
  JSON.stringify(runA) === JSON.stringify(runB));
const recPlan = recommended(runA);
const lifts = liftsOf(recPlan);
check('training days match the request',
  (recPlan.trainDays || []).length === WORKOUT_PROFILE.days,
  'got ' + (recPlan.trainDays || []).length);
check('the week is a full 7-day calendar', (recPlan.plan || []).length === 7);
check('recovery days are scheduled',
  (recPlan.plan || []).some((d) => d.isRest));
check('every training day carries a warm-up and a cooldown',
  (recPlan.plan || []).filter((d) => !d.isRest)
    .every((d) => (d.warm || []).length && (d.stretch || []).length));
check('the week contains lifts', lifts.length > 0);

section('exercise provenance');
const ctx = workoutHost.engineContext();
const known = new Set();
function harvest(node, depth) {
  if (!node || depth > 6) return;
  if (Array.isArray(node)) { node.forEach((x) => harvest(x, depth + 1)); return; }
  if (typeof node !== 'object') return;
  if (typeof node.n === 'string' && node.n) { known.add(node.n.toLowerCase()); return; }
  Object.keys(node).forEach((k) => harvest(node[k], depth + 1));
}
['gym', 'home'].forEach((eq) => {
  try { harvest(ctx.getDB(eq), 0); } catch (e) { /* ignore */ }
});
check('exercise DB loaded from the project', known.size > 80, 'size ' + known.size);
const unknownLifts = lifts.filter((e) => !known.has(String(e.n).toLowerCase()));
check('zero invented exercises', unknownLifts.length === 0,
  unknownLifts.map((e) => e.n).slice(0, 4).join(' | '));
check('every lift offers a substitute', lifts.every((e) => !!e.alt));

// ── C. COMPLETENESS ────────────────────────────────────────────
section('no blank exercise cards ever reach the phone');
['reps', 'rest', 'rir', 'progression', 'tempo'].forEach((field) => {
  const missing = lifts.filter((e) => e[field] == null || String(e[field]) === '');
  check('every lift has ' + field, missing.length === 0,
    missing.map((e) => e.n).slice(0, 3).join(', '));
});
check('the finisher reports its work',
  runA._finisher && typeof runA._finisher.scanned === 'number' &&
  runA._finisher.scanned > 0);

section('video integrity');
const guarded = JSON.parse(JSON.stringify(runA));
videoGuard.guardPlan(guarded);
const VIDEO_RE = /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{8,12}$/;
let videosChecked = 0;
let videosBroken = 0;
function walkVideos(node, depth) {
  if (!node || depth > 8) return;
  if (Array.isArray(node)) { node.forEach((x) => walkVideos(x, depth + 1)); return; }
  if (typeof node !== 'object') return;
  if (typeof node.n === 'string' && (node.videoUrl || node.vid)) {
    videosChecked++;
    if (!VIDEO_RE.test(String(node.videoUrl))) videosBroken++;
  }
  Object.keys(node).forEach((k) => walkVideos(node[k], depth + 1));
}
walkVideos(guarded, 0);
check('the guard reached the lifts', videosChecked > 0);
check('every video URL is well-formed', videosBroken === 0, videosBroken + ' broken');
check('no literal "null" video survives',
  JSON.stringify(guarded).indexOf('"vid":"null"') === -1);

// ── D. RESPONSIVENESS ──────────────────────────────────────────
section('the user\u0027s own data steers the plan');
function variantLifts(patch) {
  const out = finisher.computeStablePlan(Object.assign({}, WORKOUT_PROFILE, patch)).out;
  return { node: recommended(out), names: liftsOf(recommended(out)).map((e) => String(e.n)) };
}
const baseNames = lifts.map((e) => String(e.n));
const home = variantLifts({ equip: 'home' });
check('home equipment changes the exercises',
  home.names.length > 0 && home.names.join('|') !== baseNames.join('|'));
const threeDay = variantLifts({ days: 3 });
check('3 days requested gives 3 training days',
  (threeDay.node.trainDays || []).length === 3,
  'got ' + (threeDay.node.trainDays || []).length);
const injured = variantLifts({ injuries: ['shoulder'] });
check('an injury changes the prescription',
  injured.names.length > 0 && injured.names.join('|') !== baseNames.join('|'));
const beginner = finisher.computeStablePlan(
  Object.assign({}, WORKOUT_PROFILE, { exp: 'beginner' })).out;
const begSets = liftsOf(recommended(beginner))
  .reduce((sum, e) => sum + (Number(e.sets) || 0), 0);
const baseSets = lifts.reduce((sum, e) => sum + (Number(e.sets) || 0), 0);
check('a beginner receives less volume than an intermediate', begSets < baseSets,
  begSets + ' vs ' + baseSets);

section('volume respects the project\u0027s landmarks');
check('the MEV/MRV table is reachable', !!workoutHost.volumeStandards());
const setsByGroup = {};
lifts.forEach((e) => {
  const g = String(e.grp || 'other');
  setsByGroup[g] = (setsByGroup[g] || 0) + (Number(e.sets) || 0);
});
check('weekly volume stays humane',
  baseSets >= 30 && baseSets <= 160, 'total ' + baseSets);
check('no group exceeds a sane weekly cap',
  Object.keys(setsByGroup).every((g) => setsByGroup[g] <= 32),
  Object.keys(setsByGroup).filter((g) => setsByGroup[g] > 32).join(','));
check('the declared weak point is trained above MEV',
  (setsByGroup.chest || 0) >= 6, 'chest ' + (setsByGroup.chest || 0));

// ══ MEAL COMPOSITION PARITY ═════════════════════════════════
// Everything above proves the NUMBERS match the website. It never once
// compared the food actually on the plate, which is how the app shipped a
// breakfast of seven loose items while still reporting a perfect 2269 kcal.
// The engine picks foods from DE.availableFoods ("الأصناف المتاحة"); when it
// is empty, 19_engine_facade.js resolvePool() falls back to the entire
// database and warns "لم يتم اختيار أطعمة". This section exists so that
// silent fallback can never come back unnoticed.
section('meal composition parity: the same pantry must plate the same food');

function mealItems(plan){
  const out = [];
  ((plan && plan.meals) || []).forEach(function(meal){
    (meal.foods || meal.items || []).forEach(function(entry){
      const food = entry.food || entry;
      out.push({
        slot: String(meal.label || meal.slot || ''),
        id: String(food.id),
        nameAr: String(food.nameAr || food.name || ''),
        grams: Math.round(Number(entry.grams) || 0),
        cals: Math.round(Number(entry.cals) || 0)
      });
    });
  });
  return out;
}
// A signature is slot + id + grams: the same food in the same meal at the same
// weight. Anything looser would let a real drift pass.
function composition(plan){
  return mealItems(plan).map(function(i){ return i.slot + '/' + i.id + '/' + i.grams; }).join(' | ');
}

// The pantry must be CATEGORY-BALANCED, the way a real person ticking boxes
// would leave it. My first attempt took the flat first 30 ids and 15 of 20
// plated items had to be borrowed from outside -- not an engine bug, a pantry
// with almost no fat or veg in it. A balanced pantry drops that to 5.
const PANTRY_CATS = ['protein', 'carb', 'veggie', 'fat', 'dairy', 'fruit', 'snack'];
const PANTRY = [];
PANTRY_CATS.forEach(function(cat){
  nutritionHost.searchFoods({ query: '', category: cat, diet: 'balanced' })
    .slice(0, 8).forEach(function(f){ PANTRY.push(f.id); });
});
check('a balanced pantry can be assembled from the shared catalog',
  PANTRY.length >= 40, 'got ' + PANTRY.length);
check('the pantry covers every food group the planner needs',
  PANTRY_CATS.every(function(cat){
    return nutritionHost.foodsByIds(PANTRY).some(function(f){ return f.cat === cat; });
  }));

// The app path: mobile profile -> bridge -> host, pantry carried as an input.
const appCtx = bridge.buildEngineContext(MOBILE_PROFILE, EXTRAS);
const appRun = nutritionHost.computeMealPlan(appCtx.profile,
  Object.assign({}, appCtx.inputs, { availableFoods: PANTRY }));

// The website path: the very same inputs a browser session would hold, built
// by hand from siteProfile/siteInputs, with the same step-6 selection.
const siteRun = nutritionHost.computeMealPlan(siteProfile,
  Object.assign({}, siteInputs, { availableFoods: PANTRY }));

const appComp = composition(appRun.plan);
const siteComp = composition(siteRun.plan);

check('the app produced real meals, not empty shells', mealItems(appRun.plan).length > 0);
check('app and website plate IDENTICAL food, gram for gram', appComp === siteComp,
  'app=' + appComp.slice(0, 220) + ' || site=' + siteComp.slice(0, 220));
check('the numbers still agree too',
  appRun.targets.targetCals === siteRun.targets.targetCals, appRun.targets.targetCals + ' vs ' + siteRun.targets.targetCals);

// ── the pantry is genuinely obeyed ────────────────────────────────
check('the engine confirmed the exact pantry it planned from',
  appRun.pantrySize === PANTRY.length, 'expected ' + PANTRY.length + ' got ' + appRun.pantrySize);
const pantrySet = new Set(PANTRY);
const strays = mealItems(appRun.plan).filter(function(i){ return !pantrySet.has(i.id); });
// The engine is allowed to reach into the global pool to rescue an otherwise
// unbalanced meal (fallbackPick), so a stray is a warning to inspect, not a
// crime -- but it must never be the majority of the plate.
check('the plan is built mostly from the chosen pantry',
  strays.length < Math.floor(mealItems(appRun.plan).length / 2),
  strays.length + ' of ' + mealItems(appRun.plan).length + ' from outside: ' +
    strays.map(function(s){ return s.nameAr; }).join(', '));

// ── a different pantry MUST change the plate ──────────────────────────
const fullRun = nutritionHost.computeMealPlan(appCtx.profile, appCtx.inputs);
check('with no selection the engine uses the whole catalog', fullRun.pantrySize > 300,
  'got ' + fullRun.pantrySize);
check('changing the pantry actually changes the food (the bug that shipped)',
  composition(fullRun.plan) !== appComp, 'the pantry made no difference at all');

// ── determinism: same body + same pantry = same plate, every time ─────────
const repeat = nutritionHost.computeMealPlan(appCtx.profile,
  Object.assign({}, appCtx.inputs, { availableFoods: PANTRY }));
check('the same request twice yields the same plan', composition(repeat.plan) === appComp);

// ── the pantry must never be able to starve the plan ───────────────────
const junkRun = nutritionHost.computeMealPlan(appCtx.profile,
  Object.assign({}, appCtx.inputs, { availableFoods: ['ghost_food_a', 'ghost_food_b'] }));
check('unknown food ids fall back to the catalog instead of an empty pantry',
  junkRun.pantrySize > 300, 'got ' + junkRun.pantrySize);
check('and a real plan still reaches the user', mealItems(junkRun.plan).length > 0);

// ── the server-side pantry resolver ───────────────────────────────
check('an explicit selection wins',
  bridge.resolvePantry({ availableFoods: PANTRY }, []).source === 'user_selection');
check('favourites are used when nothing was ticked',
  bridge.resolvePantry({}, PANTRY.map(function(id){ return { food_id: id, favorite: 1 }; })).source === 'favorites');
check('a selection too small to feed anyone is refused, not honoured',
  bridge.resolvePantry({ availableFoods: ['a', 'b'] }, []).source === 'selection_too_small');
check('with nothing at all we admit we used the full catalog',
  bridge.resolvePantry({}, []).source === 'full_catalog');

// ── progression parity: the app's coach must think like coach.js ────
section('progression parity: double progression, RIR waving, deload, PRs');
{
  const BENCH = { name: 'بنش برس بالبار', reps: '8-12', sets: 4 };
  const CURL = { name: 'بايسبس باربل', reps: '10-15', sets: 3 };
  const NEUTRAL = { name: 'Sled Push', reps: '8-12', sets: 3 };
  const CYCLE = { exp: 'intermediate', mweek: 2, meso: 5 };

  // 1. load increments are classified exactly as coach.js:28-30 does
  check('a compound lift climbs in 5 kg steps', coach.incFor(BENCH.name) === 5,
    'got ' + coach.incFor(BENCH.name));
  check('an isolation lift climbs in 1.25 kg steps', coach.incFor(CURL.name) === 1.25,
    'got ' + coach.incFor(CURL.name));
  check('anything else climbs in 2.5 kg steps', coach.incFor(NEUTRAL.name) === 2.5,
    'got ' + coach.incFor(NEUTRAL.name));

  // 2. RIR waves down across the mesocycle, then eases on the deload week
  const wave = [1, 2, 3, 4, 5].map(function (w) { return coach.rirFor('intermediate', w, 5); });
  check('RIR waves down across the loading weeks', wave[0] >= wave[3],
    'wave = ' + wave.join(','));
  check('the deload week is easier than the last loading week', wave[4] > wave[3],
    'wave = ' + wave.join(','));
  // In a long block the advanced trainee is eventually taken to true failure (RIR 0).
  // Note this is impossible in a short 5-week block by design: rirFor rounds 0.75 to 1.
  check('an advanced trainee is eventually taken to RIR 0 in a long block',
    coach.rirFor('advanced', 7, 8) === 0, 'got ' + coach.rirFor('advanced', 7, 8));
  check('the same advanced trainee is NOT pushed to failure in a short block',
    coach.rirFor('advanced', 4, 5) === 1, 'got ' + coach.rirFor('advanced', 4, 5));
  check('a beginner is never pushed below RIR 2',
    [1, 2, 3, 4].every(function (w) { return coach.rirFor('beginner', w, 5) >= 2; }),
    'got ' + [1, 2, 3, 4].map(function (w) { return coach.rirFor('beginner', w, 5); }).join(','));

  // 3. the first log only sets a baseline - it must never jump the load
  const first = coach.nextTarget(BENCH, [{ weight: 60, reps: 10, ts: 1 }], CYCLE);
  check('the first logged session becomes the baseline, not a jump', first.weight === 60,
    'got ' + first.weight);
  check('a lift with no log asks for a first weight instead of inventing one',
    coach.nextTarget(BENCH, [], CYCLE).weight === null &&
    coach.nextTarget(BENCH, [], CYCLE).hasBase === false);

  // 4. double progression: top of the range -> load up, reps back to the bottom
  const topped = coach.nextTarget(BENCH, [
    { weight: 60, reps: 10, ts: 1 },
    { weight: 60, reps: 12, ts: 2 }
  ], CYCLE);
  check('reaching the top of the rep range raises the load by one increment',
    topped.weight === 65, 'got ' + topped.weight);
  check('after a load rise the reps reset to the bottom of the range',
    topped.reps === 8, 'got ' + topped.reps);

  // 5. inside the range -> one more rep, same load (the other half of double progression)
  const inside = coach.nextTarget(BENCH, [
    { weight: 60, reps: 8, ts: 1 },
    { weight: 60, reps: 9, ts: 2 }
  ], CYCLE);
  check('inside the rep range the app adds a rep, not weight',
    inside.weight === 60 && inside.reps === 10,
    'got ' + inside.weight + ' kg x ' + inside.reps);

  // 6. two sessions under the range -> 10% back-off (coach.js stall handling)
  const stalled = coach.nextTarget(BENCH, [
    { weight: 80, reps: 9, ts: 1 },
    { weight: 80, reps: 5, ts: 2 },
    { weight: 80, reps: 4, ts: 3 }
  ], CYCLE);
  check('two stalled sessions trigger a 10% back-off', stalled.weight === 72,
    'got ' + stalled.weight);

  // 7. deload week: 90% of the working load, bottom of the range, easier RIR
  const dl = coach.nextTarget(BENCH, [{ weight: 80, reps: 10, ts: 1 }],
    { exp: 'intermediate', mweek: 5, meso: 5 });
  check('a deload week drops the load to 90%', dl.deload === true && dl.weight === 72,
    'got ' + dl.weight);
  check('a deload week also drops to the bottom of the rep range', dl.reps === 8,
    'got ' + dl.reps);

  // 8. Epley e1RM identical to the website (coach.js:503)
  check('estimated 1RM uses the website\'s Epley formula', coach.e1rm(100, 5) === 116.7,
    'got ' + coach.e1rm(100, 5));
  check('a single rep is its own 1RM', coach.e1rm(120, 1) === 120);

  // 9. weekly volume is judged against MEV / MAV / MRV, not a guess
  const zones = [4, 12, 17, 25].map(function (s) { return coach.volStatus('intermediate', 'chest', s).z; });
  check('weekly volume is graded below / build / optimal / over',
    zones.join(',') === 'below,build,optimal,over', 'got ' + zones.join(','));
  check('MEV is always below MAV, and MAV below MRV',
    coach.mev('intermediate', 'back') < coach.mav('intermediate', 'back') &&
    coach.mav('intermediate', 'back') < coach.mrv('intermediate', 'back'));
  check('an advanced trainee is allowed more weekly volume than a beginner',
    coach.mrv('advanced', 'chest') > coach.mrv('beginner', 'chest'));

  // 10. ACWR: a sudden load spike must be flagged as a spike
  const spikeHist = [
    { week: 1, weight: 100, reps: 10, sets: 3 },
    { week: 2, weight: 100, reps: 10, sets: 3 },
    { week: 3, weight: 200, reps: 10, sets: 3 }
  ];
  const acwr = coach.acwrFrom(spikeHist, 3);
  check('a doubled weekly load is measured as an ACWR spike', acwr === 2,
    'got ' + acwr);
  check('the spike is explained in Arabic, not left as a number',
    coach.acwrZone(acwr).length > 0 && coach.acwrZone(1.1) !== coach.acwrZone(2));

  // 11. stimulating reps respond to RIR (coach.js:508)
  check('stimulating reps shrink as RIR grows',
    coach.stimReps(10, 0) > coach.stimReps(10, 3), 'got ' +
    coach.stimReps(10, 0) + ' vs ' + coach.stimReps(10, 3));

  // 12. the coach explains itself to the trainee in Arabic
  const txt = coach.suggestText(BENCH, [{ weight: 60, reps: 12, ts: 1 }], CYCLE);
  check('the next-set advice is a real Arabic sentence with a number',
    /\u0645\u0642\u062a\u0631\u062d/.test(txt) && /60/.test(txt), 'got ' + txt);
  check('an untrained lift is told to log a first weight',
    /\u0633\u062c\u0644 \u0623\u0648\u0644 \u0648\u0632\u0646/.test(coach.suggestText(BENCH, [], CYCLE)));

  // 13. determinism: the same log must always produce the same target
  const a = coach.nextTarget(BENCH, [{ weight: 70, reps: 11, ts: 1 }], CYCLE);
  const b = coach.nextTarget(BENCH, [{ weight: 70, reps: 11, ts: 1 }], CYCLE);
  check('the same log always yields the same target',
    JSON.stringify(a) === JSON.stringify(b));

  // 14. progress is actually counted, so the app can show it
  const grown = coach.nextTarget(BENCH, [
    { weight: 60, reps: 12, ts: 1 },
    { weight: 65, reps: 12, ts: 2 },
    { weight: 70, reps: 12, ts: 3 }
  ], CYCLE);
  // Three logged sessions = one baseline + two real progressions. The first log can
  // never be a progression, because there is nothing yet to progress from.
  check('repeated success is counted as progression events', grown.prog === 2,
    'got ' + grown.prog);
  check('a rising load is recorded as a new estimated 1RM record',
    grown.bestE1rm > coach.e1rm(60, 12), 'got ' + grown.bestE1rm);
  check('personal records are counted for the trainee', grown.prs >= 2,
    'got ' + grown.prs);
}

// ── verdict ──────────────────────────────────────────────────
console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  console.error('\nEngine parity FAILED - the app has drifted from the website');
  process.exit(1);
}
console.log('\nEngine parity passed');
