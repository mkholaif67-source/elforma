'use strict';
// ============================================================================
// البند ٧ — عقد التعديلات الصحية على TDEE  (Health-condition TDEE contract)
// ----------------------------------------------------------------------------
// هذا الملف يحرس المعاملات الطبية التي راجعها خبير التغذية/الرياضة مقابل الأدلة.
// القرار الهندسي: المعاملات متحفّظة وفي الاتجاه الآمن؛ تثبّت هنا حتى لا يجعلها
// أحد أكثر عدوانية بلا مراجعة طبية (ذلك قد يدفع السعرات لمستوى خطر).
//
// الأساس العلمي (ملخّص):
//   • قصور الغدة (hypothyroid): BMR ينخفض فعليًا (دراسات: ~١٢% وحتى ٤٠% إكلينيكيًا).
//     الكود يطبّق −١٠% فقط = تحفّظ مقصود لتجنّب التقييد المفرط (خاصةً للمعالَجين).
//   • فرط الغدة (hyperthyroid): BMR مرتفع (+٢٥% إلى +٨٠%). الكود +١٢% = تحفّظ واتجاه آمن (أكل أكثر).
//   • PCOS + مقاومة إنسولين: REE أقل ~٤٠٠–٥٠٠ سعرة (أي ~−٢٥%). الكود −٥% فقط = أشد تحفّظًا وأمانًا.
//   • التكيّف الحراري: الأدلة تقدّر −١٠–١٥% في حفظ فقدان الوزن؛ الكود يحدّ عند −٩%.
// الخلاصة: كل التعديلات في الاتجاه الصحيح وتُقلّل أقل ممّا تقترحه الأدلة (تصميم آمن لتطبيق استهلاكي).
// ============================================================================
const assert = require('assert');
const H = require('../lib/nutrition-engine-host');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('  \u2713 ' + name); }
  catch (e) { fail++; console.log('  \u2717 ' + name + ' \u2014 ' + e.message); }
}
function near(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, (msg || '') + ' expected ~' + expected + ' got ' + actual);
}

const BASE = { gender:'male', age:30, height:178, weight:82, activity:1.55, selectedDiet:'balanced' };
function tdee(extra){ return H.computeTargets(Object.assign({}, BASE, extra), {}).tdee; }

console.log('[health adjustments contract]');
const baseline = tdee({ goal:'maintain' });

check('hypothyroid reduces TDEE by ~10% (conservative vs clinical -15..-40%)', () => {
  near(tdee({ goal:'maintain', healthConditions:['hypothyroid'] }) / baseline, 0.90, 0.01);
});
check('legacy "thyroid" tag behaves as hypothyroid (backward compat)', () => {
  near(tdee({ goal:'maintain', healthConditions:['thyroid'] }) / baseline, 0.90, 0.01);
});
check('hyperthyroid raises TDEE by ~12% (safe direction: more food)', () => {
  near(tdee({ goal:'maintain', healthConditions:['hyperthyroid'] }) / baseline, 1.12, 0.01);
});
check('PCOS + insulin resistance reduces TDEE by ~5% (very conservative)', () => {
  near(tdee({ goal:'maintain', healthConditions:['pcos','insulin'] }) / baseline, 0.95, 0.01);
});
check('PCOS alone applies NO TDEE cut (avoids over-restriction)', () => {
  near(tdee({ goal:'maintain', healthConditions:['pcos'] }) / baseline, 1.00, 0.005);
});

// ---- Adaptive thermogenesis (metabolic adaptation) -------------------------
check('no adaptation weeks 1-4', () => {
  near(tdee({ goal:'cut', currentWeek:4 }) / tdee({ goal:'cut', currentWeek:1 }), 1.00, 0.005);
});
check('early adaptation weeks 5-8 ~ -3%', () => {
  near(tdee({ goal:'cut', currentWeek:7 }) / tdee({ goal:'cut', currentWeek:1 }), 0.97, 0.01);
});
check('established adaptation weeks 9-12 ~ -6%', () => {
  near(tdee({ goal:'cut', currentWeek:11 }) / tdee({ goal:'cut', currentWeek:1 }), 0.94, 0.01);
});
check('chronic adaptation capped at -9% (evidence ceiling)', () => {
  near(tdee({ goal:'cut', currentWeek:13 }) / tdee({ goal:'cut', currentWeek:1 }), 0.91, 0.01);
  // never drops below the -9% ceiling even far out
  near(tdee({ goal:'cut', currentWeek:52 }) / tdee({ goal:'cut', currentWeek:1 }), 0.91, 0.01);
});
check('adaptation applies to recomp but NOT to maintain/bulk', () => {
  assert.ok(tdee({ goal:'recomp', currentWeek:13 }) < tdee({ goal:'recomp', currentWeek:1 }), 'recomp should adapt');
  near(tdee({ goal:'bulk', currentWeek:13 }) / tdee({ goal:'bulk', currentWeek:1 }), 1.00, 0.005);
  near(tdee({ goal:'maintain', currentWeek:13 }) / tdee({ goal:'maintain', currentWeek:1 }), 1.00, 0.005);
});
check('adaptation does NOT STACK with thyroid adjustment (safety)', () => {
  // hypothyroid + long-running cut must stay ~ -10% (thyroid), NOT -10% x -9%.
  const stacked = tdee({ goal:'cut', currentWeek:13, healthConditions:['hypothyroid'] });
  const baseCut = tdee({ goal:'cut', currentWeek:1 });
  near(stacked / baseCut, 0.90, 0.015, 'must be ~0.90 not ~0.819');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
