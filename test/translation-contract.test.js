'use strict';
// Regression test for Fix #5: the goal translation now lives in ONE authority
// (lib/goal-vocabulary.js). This test pins every mapping so a future edit can
// never silently drift the app, the website or either engine apart -- while
// PROVING the deliberate nutrition-vs-workout difference is preserved.
const assert = require('assert');
const vocab = require('../lib/goal-vocabulary');
const bridge = require('../lib/mobile-nutrition-bridge');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('  \u2713 ' + name); }
  catch (e) { fail++; console.log('  \u2717 ' + name + ' \u2014 ' + e.message); }
}

console.log('[translation contract]');

const MOBILE_GOALS = ['lose', 'maintain', 'gain', 'strength', 'fitness'];

// 1) NUTRITION vocabulary is pinned exactly.
check('nutrition goal map is pinned', () => {
  assert.deepStrictEqual(vocab.MOBILE_TO_NUTRITION, {
    lose: 'cut', maintain: 'maintain', gain: 'bulk', strength: 'bulk', fitness: 'recomp'
  });
});

// 2) WORKOUT vocabulary is pinned exactly.
check('workout goal map is pinned', () => {
  assert.deepStrictEqual(vocab.MOBILE_TO_WORKOUT, {
    lose: 'cut', gain: 'muscle', strength: 'strength', fitness: 'fitness', maintain: 'fitness'
  });
});

// 3) Every supported mobile goal is handled in BOTH domains (no silent gap).
check('every mobile goal maps in both domains', () => {
  MOBILE_GOALS.forEach((g) => {
    assert.ok(vocab.toNutritionGoal(g), 'nutrition missing ' + g);
    assert.ok(vocab.toWorkoutGoal(g), 'workout missing ' + g);
    assert.ok(vocab.WORKOUT_GOALS.indexOf(vocab.toWorkoutGoal(g)) > -1, 'workout goal out of vocabulary for ' + g);
  });
});

// 4) The DELIBERATE divergence is preserved (this is the whole point).
check('maintain diverges on purpose: nutrition=maintain, workout=fitness', () => {
  assert.strictEqual(vocab.toNutritionGoal('maintain'), 'maintain');
  assert.strictEqual(vocab.toWorkoutGoal('maintain'), 'fitness');
});
check('strength diverges on purpose: nutrition=bulk, workout=strength', () => {
  assert.strictEqual(vocab.toNutritionGoal('strength'), 'bulk');
  assert.strictEqual(vocab.toWorkoutGoal('strength'), 'strength');
});

// 5) Defaults are stable for unknown input.
check('unknown goal falls back safely', () => {
  assert.strictEqual(vocab.toNutritionGoal('???'), 'maintain');
  assert.strictEqual(vocab.toWorkoutGoal('???'), 'muscle');
  assert.strictEqual(vocab.whitelistWorkoutGoal('???'), 'muscle');
});

// 6) The workout whitelist passes valid engine goals through untouched.
check('workout whitelist passes valid goals through', () => {
  vocab.WORKOUT_GOALS.forEach((g) => assert.strictEqual(vocab.whitelistWorkoutGoal(g), g));
});

// 7) The nutrition bridge now uses the single authority (no private copy).
check('nutrition bridge is wired to the shared authority', () => {
  assert.strictEqual(bridge.GOAL, vocab.MOBILE_TO_NUTRITION);
});

// 8) Behaviour is byte-identical to the OLD inline maps (no silent change).
check('values are unchanged from the pre-refactor inline maps', () => {
  const OLD_NUTRITION = { lose: 'cut', maintain: 'maintain', gain: 'bulk', strength: 'bulk', fitness: 'recomp' };
  const OLD_WORKOUT_WHITELIST = { cut: 'cut', muscle: 'muscle', strength: 'strength', fitness: 'fitness' };
  MOBILE_GOALS.forEach((g) => assert.strictEqual(vocab.toNutritionGoal(g), OLD_NUTRITION[g]));
  Object.keys(OLD_WORKOUT_WHITELIST).forEach((g) =>
    assert.strictEqual(vocab.whitelistWorkoutGoal(g), OLD_WORKOUT_WHITELIST[g] || 'muscle'));
  // old code: GOAL[p.goal] || 'muscle' -> undefined/unknown becomes 'muscle'
  assert.strictEqual(vocab.whitelistWorkoutGoal(undefined), 'muscle');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
