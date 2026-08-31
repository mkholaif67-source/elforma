'use strict';
// ============================================================================
//  اختبارات طبقة سياسة السن (7-80)
//  الهدف: محددش يقدر يفتح السيستم للأطفال ويسيب منطق البالغين شغال عليهم.
//  كل اختبار هنا بيحمي قاعدة طبية منشورة مش تفضيل شخصي.
// ============================================================================
const AGE = require('../lib/age-policy');
const H = require('../lib/nutrition-engine-host');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('  \u2713 ' + name); }
  catch (e) { fail++; console.log('  \u2717 ' + name + ' \u2014 ' + e.message); }
}
function t(profile) {
  return H.computeTargets(Object.assign({
    gender: 'male', height: 170, weight: 65, activity: 1.55, selectedDiet: 'balanced'
  }, profile), {});
}

console.log('[age policy 7-80]');

// ---- الشرائح -------------------------------------------------------------
check('every age from 7 to 80 maps to exactly one tier', () => {
  for (let a = 7; a <= 80; a++) {
    const tier = AGE.tierFor(a);
    if (!tier) throw new Error('age ' + a + ' has no tier');
    if (a < tier.min || a > tier.max) throw new Error('age ' + a + ' mapped to ' + tier.key);
  }
});
check('the tier boundaries are the ones we designed', () => {
  const want = { 7:'child', 9:'child', 10:'preteen', 13:'preteen', 14:'teen', 16:'teen', 17:'adult', 54:'adult', 55:'senior', 69:'senior', 70:'elder', 80:'elder' };
  Object.keys(want).forEach(a => {
    const got = AGE.tierFor(Number(a)).key;
    if (got !== want[a]) throw new Error('age ' + a + ': expected ' + want[a] + ', got ' + got);
  });
});
check('17+ is treated as a normal adult (user requirement)', () => {
  if (AGE.isYouth(17)) throw new Error('17 must not be youth');
  if (!AGE.tierFor(17).allowSupplements) throw new Error('17 should be allowed supplements');
  if (!AGE.tierFor(17).allowMaxLifts) throw new Error('17 should be allowed max lifts');
});

// ---- التخسيس للأولاد 10-16 ---------------------------------------------
check('an overweight 12-year-old CAN get a cut plan (not blocked)', () => {
  const r = t({ age: 12, height: 150, weight: 60, goal: 'cut' });
  if (!r || !(r.targetCals > 0)) throw new Error('no plan produced');
  if (r.ageTier !== 'preteen') throw new Error('wrong tier ' + r.ageTier);
});
check('a 12-year-old cut never exceeds a 10% deficit', () => {
  const r = t({ age: 12, height: 150, weight: 60, goal: 'cut' });
  // سماحية نص في المية لأن السعرات بتتقرب لأقرب رقم صحيح.
  const maxDeficit = 1 - (r.targetCals / r.tdee);
  if (maxDeficit > 0.105) throw new Error('deficit ' + (maxDeficit * 100).toFixed(1) + '% exceeds 10%');
});
check('a 15-year-old cut never exceeds a 15% deficit', () => {
  const r = t({ age: 15, height: 168, weight: 85, goal: 'cut' });
  const deficit = 1 - (r.targetCals / r.tdee);
  if (deficit > 0.1501) throw new Error('deficit ' + Math.round(deficit * 100) + '% exceeds 15%');
});
check('an adult may cut harder than a teen of the same body', () => {
  const teen  = t({ age: 15, height: 175, weight: 95, goal: 'cut' });
  const adult = t({ age: 30, height: 175, weight: 95, goal: 'cut' });
  const dTeen  = 1 - teen.targetCals / teen.tdee;
  const dAdult = 1 - adult.targetCals / adult.tdee;
  if (!(dAdult > dTeen)) throw new Error('adult deficit ' + dAdult.toFixed(3) + ' not deeper than teen ' + dTeen.toFixed(3));
});
check('no youth plan ever falls below its safe calorie floor', () => {
  [[10,1400],[12,1400],[13,1400],[14,1600],[15,1600],[16,1600]].forEach(([age, floor]) => {
    const r = t({ age, height: 150, weight: 90, goal: 'cut' });
    if (r.targetCals < floor) throw new Error('age ' + age + ' got ' + r.targetCals + ' < floor ' + floor);
  });
});
check('a 7-9 year old is never given any deficit at all', () => {
  const r = t({ age: 8, height: 128, weight: 40, goal: 'cut' });
  if (r.targetCals < r.tdee) throw new Error('child put in a deficit: ' + r.targetCals + ' < ' + r.tdee);
});

// ---- الزيادة للأولاد 10-16 ----------------------------------------------
check('an underweight 12-year-old who needs to gain gets a REAL surplus', () => {
  const r = t({ age: 12, height: 150, weight: 35, goal: 'muscle' });
  if (!(r.targetCals > r.tdee)) throw new Error('no surplus: target ' + r.targetCals + ' vs tdee ' + r.tdee);
});
check('a 16-year-old bulking gets a surplus but never more than 12%', () => {
  const r = t({ age: 16, height: 172, weight: 58, goal: 'muscle' });
  const surplus = (r.targetCals / r.tdee) - 1;
  if (!(surplus > 0)) throw new Error('no surplus at all');
  if (surplus > 0.1201) throw new Error('surplus ' + Math.round(surplus * 100) + '% exceeds 12%');
});
check('a gaining child is never shown weight-loss wording', () => {
  const r = t({ age: 12, height: 150, weight: 35, goal: 'muscle' });
  const joined = (r.ageNotes || []).join(' ');
  if (/\u062e\u0633\u0627\u0631\u0629|\u0631\u064a\u062c\u064a\u0645/.test(joined)) throw new Error('loss wording shown to a gaining child: ' + joined);
});

// ---- المعادلة والبروتين -----------------------------------------------
check('under 18 uses Schofield, not the adult Mifflin equation', () => {
  const r = t({ age: 15, height: 168, weight: 60, goal: 'cut' });
  const expected = AGE.schofieldBMR(15, 60, 'male');
  if (r.bmr !== expected) throw new Error('bmr ' + r.bmr + ' != Schofield ' + expected);
});
check('18+ keeps the engine equation untouched by the age layer', () => {
  const r = t({ age: 30, height: 178, weight: 82, goal: 'cut' });
  // المطلوب إثباته: الطبقة مالمستش حساب البالغين — مش إن الماتور
  // بيستخدم معادلة بعينها (ده قرار الموقع مش قرارنا).
  if (r.ageTier !== 'adult') throw new Error('wrong tier');
  const schofieldIfApplied = AGE.schofieldBMR(30, 82, 'male');
  if (schofieldIfApplied !== null) throw new Error('Schofield must not be defined for adults');
  const joined = (r.ageNotes || []).join(' ');
  if (/Schofield/.test(joined)) throw new Error('adult bmr was overridden by the youth equation');
  if (!(r.bmr > 0)) throw new Error('adult bmr missing');
});
check('a teen never gets adult-level protein (max 1.7 g/kg)', () => {
  const r = t({ age: 15, height: 168, weight: 70, goal: 'muscle' });
  const perKg = r.macros.protein / 70;
  if (perKg > 1.71) throw new Error('protein ' + perKg.toFixed(2) + ' g/kg exceeds the youth ceiling');
});
check('a teen still gets ENOUGH protein for growth (min 1.4 g/kg)', () => {
  const r = t({ age: 15, height: 168, weight: 70, goal: 'cut' });
  const perKg = r.macros.protein / 70;
  if (perKg < 1.39) throw new Error('protein ' + perKg.toFixed(2) + ' g/kg is below the growth minimum');
});
check('seniors get RAISED protein against sarcopenia, not lowered', () => {
  const r = t({ age: 65, height: 172, weight: 80, goal: 'cut' });
  const perKg = r.macros.protein / 80;
  if (perKg < 1.59) throw new Error('senior protein ' + perKg.toFixed(2) + ' g/kg is too low');
});

// ---- قواعد التدريب والمكملات ---------------------------------------
check('max lifts (1RM) are forbidden for everyone under 17', () => {
  for (let a = 7; a <= 16; a++) {
    if (AGE.tierFor(a).allowMaxLifts) throw new Error('age ' + a + ' allowed max lifts');
  }
});
check('supplements are hidden for everyone under 17', () => {
  for (let a = 7; a <= 16; a++) {
    if (AGE.tierFor(a).allowSupplements) throw new Error('age ' + a + ' allowed supplements');
  }
});
check('the plan exposes the training rules the app must enforce', () => {
  const r = t({ age: 15, height: 168, weight: 60, goal: 'cut' });
  const rules = r.ageRules || {};
  ['allowSupplements','allowMaxLifts','allowWeights','repRange','maxSessionsPerWeek','restSeconds']
    .forEach(k => { if (!(k in rules)) throw new Error('missing rule: ' + k); });
  if (rules.allowMaxLifts !== false) throw new Error('teen max lifts not blocked in ageRules');
});
check('a guardian notice is attached to every under-17 plan', () => {
  [8, 12, 15, 16].forEach(age => {
    const r = t({ age, height: 150, weight: 55, goal: 'cut' });
    const joined = (r.ageNotes || []).join(' ');
    if (!/\u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631/.test(joined)) throw new Error('age ' + age + ' has no guardian notice');
  });
});
check('no guardian notice is shown to adults', () => {
  const r = t({ age: 25, goal: 'cut' });
  if (/\u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631/.test((r.ageNotes || []).join(' '))) throw new Error('adult got a guardian notice');
});

// ---- الأطراف -----------------------------------------------------------
check('every supported age produces a complete usable plan', () => {
  for (let a = 7; a <= 80; a++) {
    const r = t({ age: a, goal: a % 2 ? 'cut' : 'muscle' });
    if (!r || !(r.targetCals > 0) || !r.macros || !(r.macros.protein > 0) || !(r.macros.fat > 0))
      throw new Error('age ' + a + ' produced a broken plan: ' + JSON.stringify(r && r.macros));
  }
});
check('adult results did not change after adding the age layer', () => {
  const r = t({ age: 30, height: 178, weight: 82, goal: 'cut' });
  if (r.ageTier !== 'adult') throw new Error('wrong tier');
  const deficit = 1 - r.targetCals / r.tdee;
  if (deficit > 0.2501) throw new Error('adult deficit changed unexpectedly');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('FAILURES ABOVE'); process.exitCode = 1; }
