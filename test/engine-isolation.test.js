'use strict';
// Regression test for the confirmed cross-user state leak in the shared
// nutrition engine host. Before the fix, a healthy user computed right after
// a user with a health condition + advanced mesocycle week inherited that
// user's leftover DE fields, so their calories/macros were wrong.
//
// This test asserts: the SAME profile yields the SAME result no matter what
// was computed just before it (order independence == no leak).
const assert = require('assert');
const host = require('../lib/nutrition-engine-host');

let pass = 0, fail = 0;
function ok(name, fn){ try { fn(); pass++; console.log('  \u2713 ' + name); } catch(e){ fail++; console.log('  \u2717 ' + name + '\n      ' + (e && e.message)); } }

// Normalise into HOST-native primitives. Each vm context has its own
// Object.prototype, so comparing result objects from two contexts by reference
// fails even when values match. A JSON round-trip strips the foreign prototype
// and lets us compare purely by value (the thing that actually matters).
function targetsOf(r){
  return JSON.parse(JSON.stringify({
    bmr: Number(r.bmr), tdee: Number(r.tdee), targetCals: Number(r.targetCals),
    macros: { protein: Number(r.macros.protein), carbs: Number(r.macros.carbs), fat: Number(r.macros.fat) }
  }));
}

// A: has a health condition + advanced week + aggressive weekly loss + female.
const A = { gender:'\u0630\u0643\u0631', age:30, height:175, weight:80, activity:1.2, goal:'cut',
  selectedDiet:'balanced', healthConditions:['hyperthyroid'], currentWeek:14, expectedWeeklyLoss:1.0 };
// B: a totally clean, minimal healthy profile.
const B = { gender:'\u0630\u0643\u0631', age:30, height:175, weight:80, activity:1.2, goal:'cut',
  selectedDiet:'balanced' };
// C: a different body + goal, also clean.
const C = { gender:'\u0627\u0646\u062b\u0649', age:25, height:165, weight:60, activity:1.375, goal:'bulk',
  selectedDiet:'balanced' };

console.log('[engine isolation]');

// Ground truth for B and C: computed on a completely fresh module instance.
function freshHost(){ delete require.cache[require.resolve('../lib/nutrition-engine-host')]; return require('../lib/nutrition-engine-host'); }
const hB = freshHost();
const B_truth = targetsOf(hB.computeTargets(B, {}));
const hC = freshHost();
const C_truth = targetsOf(hC.computeTargets(C, {}));

ok('B result is identical whether or not A ran first', () => {
  const h = freshHost();
  h.computeTargets(A, {});                 // pollute with A
  const bAfterA = targetsOf(h.computeTargets(B, {}));
  assert.deepStrictEqual(bAfterA, B_truth, 'B inherited state from A');
});

ok('C result is identical whether or not A ran first', () => {
  const h = freshHost();
  h.computeTargets(A, {});
  const cAfterA = targetsOf(h.computeTargets(C, {}));
  assert.deepStrictEqual(cAfterA, C_truth, 'C inherited state from A');
});

ok('repeated A stays stable (idempotent, no accumulation)', () => {
  const h = freshHost();
  const a1 = targetsOf(h.computeTargets(A, {}));
  const a2 = targetsOf(h.computeTargets(A, {}));
  const a3 = targetsOf(h.computeTargets(A, {}));
  assert.deepStrictEqual(a2, a1);
  assert.deepStrictEqual(a3, a1);
});

ok('alternating A/B/A/B never drifts', () => {
  const h = freshHost();
  for (let i = 0; i < 5; i++) {
    h.computeTargets(A, {});
    const b = targetsOf(h.computeTargets(B, {}));
    assert.deepStrictEqual(b, B_truth, 'B drifted on iteration ' + i);
  }
});

ok('meal-plan path is also isolated (health leak into pantry/plan)', () => {
  const h = freshHost();
  h.computeMealPlan(A, {});
  const bPlan = targetsOf(h.computeMealPlan(B, {}).targets);
  assert.deepStrictEqual(bPlan, B_truth, 'meal-plan B inherited A');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
