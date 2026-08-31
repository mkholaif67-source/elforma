// ── Helper training units (الوحدات المساعدة) ─────────────────────────────
// The website engine can weave eight optional units into a plan: warm-up,
// cardio, core, stretching, yoga, breathing, recovery and kegel. The mobile
// app loaded the planner but never called its module layer, so every unit the
// user picked was silently dropped between the questions and the plan.
//
// Two failure modes are pinned here because both were real:
//   1. the layer never running at all, and
//   2. the website's own key mismatch (the picker says warmup/stretch/breath/
//      recovery, the planner branches on mobility/stretching/breathing/sleep),
//      which made four of the eight units dead on arrival.
const assert = require('assert');
const host = require('../lib/workout-engine-host');
const mobileApi = require('../api/mobile.js');

let passed = 0;
function ok(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.log('  ✗ ' + name + '\n      ' + e.message); process.exitCode = 1; }
}

const BASE = {
  gender: 'male', age: 30, height: 178, weight: 88, goal: 'cut',
  exp: 'intermediate', equip: 'gym', days: 4, time: '60',
  daily: 'moderate', sleep: 'ok', stress: 'low', injuries: [], weak: []
};
const ALL = ['warmup', 'cardio', 'core', 'stretch', 'yoga', 'breath', 'recovery', 'kegel'];

function harvest(modules) {
  const out = host.computeWorkout(Object.assign({}, BASE, { activeModules: modules }));
  const plan = ((out.plans || [])[0] || {}).plan || [];
  const acc = { warm: [], cooldown: [], stretch: [], tags: [] };
  plan.forEach(function (d) {
    (d.warm || []).forEach(function (x) { acc.warm.push(String(x)); });
    (d.cooldown || []).forEach(function (x) { acc.cooldown.push(String(x)); });
    (d.stretch || []).forEach(function (x) { acc.stretch.push(String(x)); });
    (d._moduleTags || []).forEach(function (x) { acc.tags.push(String(x).trim()); });
  });
  acc.tags = Array.from(new Set(acc.tags));
  return acc;
}

console.log('[helper training units]');

const none = harvest([]);
const all = harvest(ALL);

ok('a plan with no units chosen carries no unit blocks', function () {
  assert.strictEqual(none.tags.length, 0, 'baseline leaked: ' + JSON.stringify(none.tags));
  assert.strictEqual(none.cooldown.length, 0, 'baseline cooldown should be empty');
});

// Each unit is asserted BY NAME: a regression that drops one is caught alone.
const EXPECTED_TAG = {
  warmup: 'Mobility', cardio: 'Cardio', core: 'Core', stretch: 'Stretching',
  yoga: 'Yoga', breath: 'Breathing', recovery: 'Recovery', kegel: 'Kegel'
};
Object.keys(EXPECTED_TAG).forEach(function (key) {
  ok('unit "' + key + '" reaches the plan as ' + EXPECTED_TAG[key], function () {
    assert.ok(all.tags.indexOf(EXPECTED_TAG[key]) > -1,
      'tag missing. got: ' + JSON.stringify(all.tags));
  });
});

ok('the four aliased keys are translated, not passed through raw', function () {
  const mapped = host.normalizeModules(['warmup', 'stretch', 'breath', 'recovery']);
  assert.deepStrictEqual(mapped, ['mobility', 'stretching', 'breathing', 'sleep']);
});

ok('unaliased keys survive untouched', function () {
  assert.deepStrictEqual(host.normalizeModules(['cardio', 'core', 'kegel', 'yoga']),
    ['cardio', 'core', 'kegel', 'yoga']);
});

ok('duplicates collapse instead of doubling a unit', function () {
  assert.deepStrictEqual(host.normalizeModules(['warmup', 'mobility', 'warmup']), ['mobility']);
});

ok('choosing units extends the warm-up rather than replacing it', function () {
  assert.ok(all.warm.length > none.warm.length,
    'warm-up did not grow: ' + none.warm.length + ' -> ' + all.warm.length);
  none.warm.forEach(function (item) {
    assert.ok(all.warm.indexOf(item) > -1, 'original warm-up item lost: ' + item);
  });
});

ok('cardio and kegel write a real, readable instruction', function () {
  assert.ok(all.cooldown.some(function (x) { return /كارديو|LISS|مشي/.test(x); }), 'no cardio line');
  assert.ok(all.cooldown.some(function (x) { return /Kegel/i.test(x); }), 'no kegel line');
});

ok('rest days stay 100% rest — no unit is attached to them', function () {
  const out = host.computeWorkout(Object.assign({}, BASE, { activeModules: ALL }));
  const plan = ((out.plans || [])[0] || {}).plan || [];
  plan.filter(function (d) { return d && d.isRest; }).forEach(function (d) {
    assert.ok(!(d._moduleTags || []).length, 'a unit landed on a rest day');
    assert.ok(!(d.cooldown || []).length, 'cooldown work landed on a rest day');
  });
});

ok('the unit catalogue is exposed to the client', function () {
  const cat = host.moduleCatalog();
  ['kegel', 'core', 'mobility', 'stretching', 'yoga', 'breathing', 'recovery', 'cardio']
    .forEach(function (k) { assert.ok(cat[k], 'catalogue missing pool: ' + k); });
});

ok('the profile sanitizer keeps activeModules instead of dropping them', function () {
  const saved = mobileApi._profile
    ? mobileApi._profile({ activeModules: ['warmup', 'core'] })
    : null;
  if (saved) {
    assert.deepStrictEqual(saved.activeModules, ['warmup', 'core']);
  } else {
    // Sanitizer is not exported; assert the source keeps the field instead.
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'api', 'mobile.js'), 'utf8');
    assert.ok(/o\.activeModules\s*=/.test(src), 'activeModules is not whitelisted in profile()');
  }
});

ok('the app sends the units it collected', function () {
  const fs = require('fs'), path = require('path');
  const store = fs.readFileSync(path.join(__dirname, '..', 'mobile', 'lib', 'models', 'profile_store.dart'), 'utf8');
  assert.ok(store.indexOf("'activeModules': listOf('activeModules')") > -1,
    'workoutPayload does not send activeModules');
  const setup = fs.readFileSync(path.join(__dirname, '..', 'mobile', 'lib', 'screens', 'profile_setup_screen.dart'), 'utf8');
  assert.ok(/'modules'/.test(setup), 'no modules question in onboarding');
  assert.ok(setup.indexOf("'activeModules': activeModules.toList()") > -1,
    'onboarding does not put activeModules in the payload');
});

ok('the cooldown still renders the units the engine attached', function () {
  const fs = require('fs'), path = require('path');
  const sess = fs.readFileSync(path.join(__dirname, '..', 'mobile', 'lib', 'screens', 'training_session_screen.dart'), 'utf8');
  ['cooldown', 'stretch'].forEach(function (key) {
    assert.ok(sess.indexOf("_engineSteps('" + key + "'") > -1,
      'session screen never reads plan key: ' + key);
  });
});

ok('the warm-up shows essentials + activation, never the helper-unit dump', function () {
  const fs = require('fs'), path = require('path');
  const sess = fs.readFileSync(path.join(__dirname, '..', 'mobile', 'lib', 'screens', 'training_session_screen.dart'), 'utf8');
  assert.ok(sess.indexOf("_engineSteps('warm'") === -1,
    'warm-up is dumping helper units again');
  assert.ok(sess.indexOf('_activationCards()') > -1,
    'warm-up lost the muscle-activation cards');
});

console.log('\n' + passed + ' passed, ' + (process.exitCode ? 'FAILURES ABOVE' : '0 failed'));
