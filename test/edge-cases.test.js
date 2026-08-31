'use strict';
// ============================================================================
// البند ٨ — اختبارات الحالات الحدّية والمدخلات غير المتوقّعة (edge cases)
// تغطّي: حدود الجسم الفيزيولوجية، كل أنواع الإصابات، تأثير الحالات الصحية على الماكروز،
// وعزل الطلبات المتتالية باختلاف الحالات.
// ============================================================================
const assert = require('assert');
const H = require('../lib/nutrition-engine-host');
const W = require('../lib/workout-engine-host');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('  \u2713 ' + name); }
  catch (e) { fail++; console.log('  \u2717 ' + name + ' \u2014 ' + e.message); }
}
function throwsWith(re, fn) {
  try { fn(); } catch (e) { assert.ok(re.test(String(e.message)), 'wrong error: ' + e.message); return; }
  throw new Error('expected a throw matching ' + re);
}

const NBASE = { gender:'male', age:30, height:178, weight:82, activity:1.55, selectedDiet:'balanced', goal:'cut' };
function targets(extra){ return H.computeTargets(Object.assign({}, NBASE, extra), {}); }

console.log('[edge cases]');

// ---- (A) Physiological bounds: a body that cannot exist must be REFUSED -----
check('rejects missing / zero weight', () => throwsWith(/engine_missing_weight/, () => targets({ weight:0 })));
check('rejects missing / zero age', () => throwsWith(/engine_missing_age/, () => targets({ age:0 })));
// السن المدعوم بقى 7-80 سنة (كان 10-100). الأطفال مايتمنعوش من الخطة،
// لكن أي جسم خارج المدى الفسيولوجي المدعوم لازم يترفض بصوت عالي.
check('rejects implausibly low age (6)', () => throwsWith(/engine_implausible_age/, () => targets({ age:6 })));
check('rejects implausibly high age (81)', () => throwsWith(/engine_implausible_age/, () => targets({ age:81 })));
function sane(r, who) {
  if (!r || !isFinite(r.targetCals) || r.targetCals <= 0) throw new Error(who + ': no usable targetCals');
  if (!r.macros || !(r.macros.protein > 0) || !(r.macros.carbs >= 0) || !(r.macros.fat > 0))
    throw new Error(who + ': broken macros ' + JSON.stringify(r.macros));
  return r;
}
check('accepts age 7 (youngest supported)', () => sane(targets({ age:7, height:125, weight:26 }), 'age 7'));
check('accepts age 12 (child/teen boundary)', () => sane(targets({ age:12, height:150, weight:40 }), 'age 12'));
check('accepts age 80 (oldest supported)', () => sane(targets({ age:80 }), 'age 80'));
check('a 7-year-old never gets an adult-sized calorie target', () => {
  const kid = sane(targets({ age:7, height:125, weight:26 }), 'age 7');
  const adult = sane(targets({}), 'adult');
  if (kid.targetCals >= adult.targetCals)
    throw new Error('child target ' + kid.targetCals + ' >= adult target ' + adult.targetCals);
});
check('an 80-year-old gets a lower target than a 30-year-old of the same body', () => {
  const old = sane(targets({ age:80 }), 'age 80');
  const young = sane(targets({ age:30 }), 'age 30');
  if (old.targetCals >= young.targetCals)
    throw new Error('senior target ' + old.targetCals + ' >= young target ' + young.targetCals);
});
check('rejects implausibly low height (99cm)', () => throwsWith(/engine_implausible_height/, () => targets({ height:99 })));
check('rejects implausibly high height (251cm)', () => throwsWith(/engine_implausible_height/, () => targets({ height:251 })));
check('rejects implausibly high weight (351kg)', () => throwsWith(/engine_implausible_weight/, () => targets({ weight:351 })));
check('accepts a normal body and returns a finite sane target', () => {
  const r = targets({});
  assert.ok(Number.isFinite(r.targetCals) && r.targetCals >= 800 && r.targetCals <= 8000, 'cals out of range: ' + r.targetCals);
  assert.ok(r.macros && Number.isFinite(r.macros.protein) && r.macros.protein > 0, 'protein must be positive');
});

// ---- (B) Health conditions actually reshape the macros ---------------------
const baseMacros = targets({}).macros;
check('diabetes lowers carbohydrates vs baseline', () => {
  const d = targets({ healthConditions:['diabetes'] }).macros;
  assert.ok(d.carbs < baseMacros.carbs, 'diabetes carbs ' + d.carbs + ' should be < ' + baseMacros.carbs);
});
check('insulin resistance lowers carbohydrates vs baseline', () => {
  const d = targets({ healthConditions:['insulin'] }).macros;
  assert.ok(d.carbs < baseMacros.carbs, 'insulin carbs ' + d.carbs + ' should be < ' + baseMacros.carbs);
});
check('protein stays positive under every single health condition', () => {
  ['hypothyroid','hyperthyroid','pcos','insulin','diabetes','fatty-liver'].forEach((h) => {
    const r = targets({ gender:'female', healthConditions:[h] });
    assert.ok(r.macros.protein > 0, h + ' produced zero protein');
  });
});

// ---- (C) Every injury produces a valid, non-empty workout (no crash) -------
const WBASE = { gender:'male', age:30, height:178, weight:82, goal:'muscle', exp:'intermediate',
  equip:'gym', days:4, time:'60', daily:'moderate', sleep:'ok', stress:'low', weak:[] };
const INJURIES = ['knee','shoulder','lower-back','back','wrist','elbow','ankle','hip','neck'];
INJURIES.forEach((inj) => {
  check('injury "' + inj + '" still yields a valid plan', () => {
    const r = W.computeWorkout(Object.assign({}, WBASE, { injuries:[inj] }));
    const plan = (r.plans || []).find((p) => p.rec) || (r.plans || [])[0];
    assert.ok(plan && Array.isArray(plan.trainDays) && plan.trainDays.length > 0, 'no train days');
    plan.trainDays.forEach((d, i) => {
      assert.ok(Array.isArray(d.exercises) && d.exercises.length > 0, 'day ' + i + ' has no exercises');
      d.exercises.forEach((ex) => {
        assert.ok(ex.n || ex.name, 'exercise missing name');
        assert.ok(ex.sets && ex.reps, 'exercise missing sets/reps');
      });
    });
  });
});
check('multiple simultaneous injuries do not crash the planner', () => {
  const r = W.computeWorkout(Object.assign({}, WBASE, { injuries:['knee','shoulder','lower-back'] }));
  const plan = (r.plans || []).find((p) => p.rec) || (r.plans || [])[0];
  assert.ok(plan && plan.trainDays.length > 0, 'combined injuries produced no plan');
});

// ---- (D) Request isolation across ALTERNATING health conditions ------------
// Reinforces engine-isolation specifically for health flags & mesocycle week:
// a sick user's flag must never bleed into the next (healthy) user's numbers.
check('a healthy request between two sick ones is unaffected', () => {
  const solo = targets({ goal:'maintain' }).tdee;
  targets({ goal:'maintain', healthConditions:['hypothyroid'] });   // sick #1
  const middle = targets({ goal:'maintain' }).tdee;                 // healthy
  targets({ goal:'cut', currentWeek:20, healthConditions:['hyperthyroid'] }); // sick #2
  const after = targets({ goal:'maintain' }).tdee;                  // healthy again
  assert.strictEqual(middle, solo, 'health flag bled into healthy request (' + middle + ' != ' + solo + ')');
  assert.strictEqual(after, solo, 'week/flag bled into later healthy request (' + after + ' != ' + solo + ')');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
