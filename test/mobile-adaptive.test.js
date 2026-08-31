'use strict';
// Sprint 12 test suite: the adaptive coaching brain.
// Covers (a) the DOM-input bridge actually reaching the original diet engine,
// (b) the MET cardio correction, (c) adaptive TDEE / adherence / staleness math,
// (d) MEV-MRV volume grading, and (e) the live /api/mobile/nutrition-plan route.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

process.env.EF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-mobile-adaptive-'));
process.env.PORT = '0';
const server = require('../server');
const bridge = require('../lib/mobile-nutrition-bridge');
const nutritionHost = require('../lib/nutrition-engine-host');
const workoutHost = require('../lib/workout-engine-host');

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + (detail ? '  -> ' + detail : '')); }
}

function request(method, pathname, body, cookie) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const payload = body == null ? null : JSON.stringify(body);
    const headers = {};
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (cookie) headers.Cookie = cookie;
    const req = http.request({ host: '127.0.0.1', port: address.port, method, path: pathname, headers }, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(raw || '{}'); } catch (_) { json = { _raw: raw.slice(0, 200) }; }
        const cookies = res.headers['set-cookie'] || [];
        const match = /ef_session=[^;]*/.exec(cookies.join(';'));
        resolve({ status: res.statusCode, json, cookie: match && match[0] });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const dayAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

(async () => {
  await new Promise((r) => server.listening ? r() : server.on('listening', r));

  // ---------------------------------------------------------
  console.log('\n[bridge -> original diet engine]');
  // ---------------------------------------------------------
  const p = {
    gender: 'male', age: 30, height: 178, weight: 95, targetWeight: 82,
    goal: 'lose', dailyActivity: 'sedentary', sleep: 'poor',
    trainingDays: 5, trainingMinutes: 75, diet: 'balanced', mealCount: 4, healthConditions: []
  };
  const ctx = bridge.buildEngineContext(p, { steps: 12500, cardioSessions: 4, cardioIntensity: 'light', waist: 104, neck: 41 });

  check('engine inputs include every inp-* the engine reads',
    ['inp-steps', 'inp-train-days', 'inp-workout-dur', 'inp-cardio', 'inp-sleep', 'inp-weekly-rate', 'inp-bf', 'inp-gain-style', 'inp-goal', 'inp-activity']
      .every((k) => ctx.inputs[k] !== undefined && ctx.inputs[k] !== null),
    JSON.stringify(Object.keys(ctx.inputs)));

  check('goal is translated into engine vocabulary', ctx.inputs['inp-goal'] === 'cut', String(ctx.inputs['inp-goal']));

  const empty = nutritionHost.computeTargets(ctx.profile, {});
  const bridged = nutritionHost.computeTargets(ctx.profile, ctx.inputs);
  check('bridged inputs change the engine result (the root bug)',
    bridged.tdee > empty.tdee + 200, 'empty=' + empty.tdee + ' bridged=' + bridged.tdee);
  check('bridged TDEE is physiologically sane for this profile',
    bridged.tdee > 2400 && bridged.tdee < 4200, String(bridged.tdee));
  check('macros still returned after bridging',
    bridged.macros && bridged.macros.protein > 0 && bridged.macros.fat > 0);

  // ---------------------------------------------------------
  console.log('\n[MET cardio correction]');
  // ---------------------------------------------------------
  const light95 = bridge.cardioKcalPerMin('light', 95);
  const vig95 = bridge.cardioKcalPerMin('vigorous', 95);
  check('light cardio burns less than the engine flat 7.5 kcal/min', light95 < 7.5, light95.toFixed(2));
  check('vigorous cardio burns more than 7.5 kcal/min', vig95 > 7.5, vig95.toFixed(2));
  check('heavier body burns more at the same intensity',
    bridge.cardioKcalPerMin('moderate', 110) > bridge.cardioKcalPerMin('moderate', 70));
  check('session count is scaled, not the engine constant',
    bridge.metCorrectedCardioSessions(4, 'light', 95) < 4);
  check('zero sessions stay zero', bridge.metCorrectedCardioSessions(0, 'light', 95) === 0);

  // ---------------------------------------------------------
  console.log('\n[body fat + safe rate]');
  // ---------------------------------------------------------
  const bf = bridge.navyBodyFat('male', 178, 104, 41, null);
  check('navy body fat is in a plausible range', bf > 15 && bf < 45, String(bf));
  check('navy returns null on missing inputs', bridge.navyBodyFat('male', 178, 0, 41, null) === null);
  check('female navy needs hips', bridge.navyBodyFat('female', 165, 80, 32, null) === null);
  check('leaner cutters get a slower prescribed rate',
    bridge.safeWeeklyRate('cut', 80, 12) / 80 < bridge.safeWeeklyRate('cut', 80, 32) / 80);
  check('lean bulk is slower than mass bulk',
    bridge.safeWeeklyRate('bulk', 80, 15, 'lean') < bridge.safeWeeklyRate('bulk', 80, 15, 'mass'));
  check('maintenance prescribes no weekly change', bridge.safeWeeklyRate('maintain', 80, 20) === 0);

  // ---------------------------------------------------------
  console.log('\n[adaptive TDEE]');
  // ---------------------------------------------------------
  const nut = [], wt = [];
  for (let i = 0; i < 28; i++) {
    nut.push({ day: dayAgo(27 - i), calories: 2200, protein: 170, water_ml: 2500 });
    if (i % 3 === 0) wt.push({ day: dayAgo(27 - i), weight: 90 - (i * 2 / 27) });
  }
  const ad = bridge.adaptiveTdee(nut, wt, 2600);
  check('adaptive TDEE becomes ready with 28 days of data', ad.status === 'ready', ad.status);
  check('observed TDEE is derived from intake and weight trend',
    ad.observedTdee > 2200 && ad.observedTdee < 3200, String(ad.observedTdee));
  check('confidence is high on a full month', ad.confidence === 'high', ad.confidence);
  check('recommendation sits between formula and observation',
    ad.recommendedTdee <= Math.max(ad.formulaTdee, ad.observedTdee)
    && ad.recommendedTdee >= Math.min(ad.formulaTdee, ad.observedTdee));

  check('short history refuses to adapt',
    bridge.adaptiveTdee(nut.slice(0, 5), wt.slice(0, 2), 2600).status === 'insufficient_data');

  const sparse = [];
  for (let i = 0; i < 28; i += 4) sparse.push({ day: dayAgo(27 - i), calories: 2200 });
  check('sparse logging is rejected rather than trusted',
    bridge.adaptiveTdee(sparse.concat(sparse.map((r, j) => ({ day: dayAgo(26 - j * 4), calories: 2100 }))), wt, 2600).status !== 'ready');

  const crazy = nut.map((r) => ({ day: r.day, calories: 6000 }));
  const clamped = bridge.adaptiveTdee(crazy, wt, 2600);
  check('a wild observation is clamped, never blindly trusted',
    clamped.recommendedTdee <= 2600 * 1.26, String(clamped.recommendedTdee));

  // ---------------------------------------------------------
  console.log('\n[adherence]');
  // ---------------------------------------------------------
  const good = bridge.adherence(nut, { targetCals: 2200, macros: { protein: 170 } }, 14);
  check('perfect logging scores excellent', good.status === 'excellent', good.status);
  check('protein hit rate computed', good.proteinHitRate === 100, String(good.proteinHitRate));

  const over = bridge.adherence(nut.map((r) => ({ day: r.day, calories: 3200, protein: 90 })), { targetCals: 2200, macros: { protein: 170 } }, 14);
  check('overeating is called out', over.messages.join(' ').length > 0 && over.calorieAccuracy < 90);
  check('low protein is called out', over.proteinHitRate === 0, String(over.proteinHitRate));
  check('no data is handled safely', bridge.adherence([], { targetCals: 2200 }, 14).status === 'no_data');

  // ---------------------------------------------------------
  console.log('\n[plan staleness]');
  // ---------------------------------------------------------
  const stale = bridge.planStaleness(95, [{ day: dayAgo(1), weight: 86 }, { day: dayAgo(3), weight: 86.4 }, { day: dayAgo(5), weight: 86.8 }], new Date().toISOString());
  check('large weight change triggers recalculation', stale.needsRecalc && stale.reason === 'weight_changed', JSON.stringify(stale.reason));
  const old = bridge.planStaleness(95, [{ day: dayAgo(1), weight: 94.8 }], new Date(Date.now() - 60 * 86400000).toISOString());
  check('an old plan triggers recalculation', old.needsRecalc && old.reason === 'stale_plan', JSON.stringify(old.reason));
  const fresh = bridge.planStaleness(95, [{ day: dayAgo(1), weight: 94.5 }], new Date().toISOString());
  check('a fresh accurate plan is left alone', fresh.needsRecalc === false);

  // ---------------------------------------------------------
  console.log('\n[volume standards from the original engine]');
  // ---------------------------------------------------------
  const std = workoutHost.volumeStandards();
  check('volume standards exposed from the engine', Object.keys(std.volume).length >= 10, String(Object.keys(std.volume).length));
  check('chest landmarks match the engine', std.volume.chest && std.volume.chest.mev === 6 && std.volume.chest.opt === 14);
  check('weekly caps scale with experience',
    std.caps.chest.beginner < std.caps.chest.intermediate && std.caps.chest.intermediate < std.caps.chest.advanced);

  // ---------------------------------------------------------
  console.log('\n[live /api/mobile/nutrition-plan]');
  // ---------------------------------------------------------
  const signup = await request('POST', '/api/auth/signup', {
    email: `adaptive_${Date.now()}@gmail.com`, password: 'supersecret123', name: 'Adaptive Tester'
  });
  if (signup.status !== 201 || !signup.cookie) throw new Error('signup failed');
  const cookie = signup.cookie;

  const noProfile = await request('GET', '/api/mobile/nutrition-plan', null, cookie);
  check('endpoint refuses without a profile', noProfile.status === 400, String(noProfile.status));
  const anon = await request('GET', '/api/mobile/nutrition-plan', null, null);
  check('endpoint requires authentication', anon.status === 401, String(anon.status));

  const saved = await request('PUT', '/api/mobile/profile', Object.assign({}, p, {
    steps: 12500, cardioSessions: 4, cardioIntensity: 'light', waist: 104, neck: 41,
    experience: 'intermediate', equipment: 'gym', onboardingComplete: true
  }), cookie);
  check('new engine inputs survive the profile whitelist',
    saved.status === 200 && saved.json.profile && saved.json.profile.steps === 12500
    && saved.json.profile.cardioSessions === 4 && saved.json.profile.cardioIntensity === 'light'
    && saved.json.profile.waist === 104 && saved.json.profile.neck === 41,
    JSON.stringify(saved.json.profile && {
      steps: saved.json.profile.steps, cardio: saved.json.profile.cardioSessions,
      intensity: saved.json.profile.cardioIntensity, waist: saved.json.profile.waist, neck: saved.json.profile.neck
    }));

  for (let i = 0; i < 20; i++) {
    await request('PUT', '/api/mobile/nutrition', { day: dayAgo(20 - i), calories: 2300, protein: 175, carbs: 240, fat: 70, waterMl: 3000 }, cookie);
    if (i % 3 === 0) await request('PUT', '/api/mobile/weight', { day: dayAgo(20 - i), weight: 95 - i * 0.1 }, cookie);
  }

  const planRes = await request('GET', '/api/mobile/nutrition-plan', null, cookie);
  check('nutrition-plan responds 200', planRes.status === 200, JSON.stringify(planRes.json).slice(0, 160));
  const body = planRes.json || {};
  check('targets returned from the real engine',
    body.targets && body.targets.tdee > 0 && body.targets.targetCals > 0,
    JSON.stringify(body.targets && { tdee: body.targets.tdee, target: body.targets.targetCals }));
  check('a real meal plan is attached', !!body.plan);
  check('engine inputs are reported back for transparency',
    body.engineInputs && body.engineInputs.steps === 12500 && body.engineInputs.stepsEstimated === false,
    JSON.stringify(body.engineInputs && { steps: body.engineInputs.steps, est: body.engineInputs.stepsEstimated }));
  check('body fat was derived from waist and neck',
    body.engineInputs && body.engineInputs.bodyFatSource === 'navy',
    String(body.engineInputs && body.engineInputs.bodyFatSource));
  check('MET-corrected cardio is surfaced',
    body.engineInputs && body.engineInputs.cardioSessionsMetCorrected < 4);
  check('adaptive block present', !!body.adaptive && typeof body.adaptive.status === 'string', JSON.stringify(body.adaptive && body.adaptive.status));
  check('adherence block present', !!body.adherence && body.adherence.loggedDays > 0, JSON.stringify(body.adherence && body.adherence.loggedDays));
  check('staleness block present', !!body.staleness);

  const targetsOnly = await request('GET', '/api/mobile/nutrition-plan?plan=0', null, cookie);
  check('targets-only mode skips meal generation',
    targetsOnly.status === 200 && targetsOnly.json.plan === null && targetsOnly.json.targets.tdee > 0);

  // ---------------------------------------------------------
  console.log('\n[MEV / MRV grading in the smart coach]');
  // ---------------------------------------------------------
  const hist = await request('GET', '/api/mobile/workout-history', null, cookie);
  check('workout history still responds', hist.status === 200, String(hist.status));
  const coach = hist.json && hist.json.coach;
  check('coach reports the training level', !!coach && typeof coach.level === 'string', coach && coach.level);
  check('coach exposes MEV and cap arrays', !!coach && Array.isArray(coach.belowMev) && Array.isArray(coach.overCap));
  check('coach reports deload scheduling', !!coach && typeof coach.deloadScheduled === 'boolean');
  check('muscle volume rows carry landmarks',
    !!coach && coach.muscleVolume.every((m) => 'grade' in m && 'mev' in m && 'weeklyCap' in m));

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  if (!failed) console.log('Mobile adaptive coaching brain passed');
  server.close(() => process.exit(failed ? 1 : 0));
})().catch((e) => {
  console.error('TEST CRASH', e);
  server.close(() => process.exit(1));
});
