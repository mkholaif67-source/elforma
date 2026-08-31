// ════════════════════════════════════════════════════════════
// tests/rest-policy.test.js — سياسة الراحة (rest.js)
// ════════════════════════════════════════════════════════════
const path = require('path');
const R = require(path.join(__dirname, '..', 'engine', 'rest.js'));

let pass = 0, fail = 0;
function assert(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('—— سقوف الراحة الأساسية ——');
assert(R.REST_CAP_SEC === 180, 'سقف العادي 180ث');
assert(R.REST_CAP_HEAVY_SEC === 240, 'سقف المركّب الثقيل 240ث');

console.log('\n—— Phase 3: المركّب الثقيل يُسمح له بـ 3–4 دقائق في الضخامة ——');
// قبل الإصلاح: "3-4 دقائق" كانت تُقص لـ "3 دقائق" للضخامة.
assert(R.canonicalRestLabel('3-4 دقائق', 'muscle', 'heavy_compound') === '3-4 دقائق', 'مركّب ثقيل/ضخامة: "3-4 دقائق" تُحفظ كما هي');
assert(R.restToSeconds('3-4 دقائق', 'muscle', 'heavy_compound') === 210, 'متوسط الثواني = 210ث (لا يُقص لـ180)');

console.log('\n—— العزل يبقى مقيّداً بـ 180ث ——');
assert(R.canonicalRestLabel('3-4 دقائق', 'muscle', 'isolation') === '3 دقائق', 'عزل/ضخامة: يُقص لـ "3 دقائق"');
assert(R.restToSeconds(300, 'muscle', 'isolation') === 180, 'عزل: 300ث تُقص لـ180ث');
assert(R.canonicalRestLabel('5 دقائق', 'muscle', 'heavy_compound') === '4 دقائق', 'مركّب ثقيل: 5د تُقص لـ 4د (سقف 240)');

console.log('\n—— القوة معفاة تماماً ——');
assert(R.canonicalRestLabel('4-5 دقائق', 'strength', 'heavy_compound') === '4-5 دقائق', 'قوة: تُحفظ 4-5 دقائق بلا قص');
assert(R.restToSeconds(300, 'strength', 'heavy_compound') === 300, 'قوة: 300ث تُحفظ');

console.log('\n—— توافق خلفي (بدون exType) ——');
assert(R.canonicalRestLabel('3-4 دقائق', 'muscle') === '3 دقائق', 'بدون exType → سلوك السقف القديم 180ث (آمن)');
assert(R.restToSeconds('60-90 ثانية', 'cut') === 75, 'بدون exType: متوسط 75ث سليم');

console.log('\n—— enforceRestCapOnPlan تحترم نوع التمرين ——');
const plan = [{ exercises: [
  { n: 'سكوات', exType: 'heavy_compound', rest: '3-4 دقائق' },
  { n: 'تفريدة', exType: 'isolation', rest: '3-4 دقائق' }
]}];
R.enforceRestCapOnPlan(plan, 'muscle');
assert(plan[0].exercises[0].rest === '3-4 دقائق', 'السكوات (ثقيل) حفظ 3-4 دقائق');
assert(plan[0].exercises[1].rest === '3 دقائق', 'التفريدة (عزل) قُصّت لـ 3 دقائق');

console.log('\n═════ نتيجة سياسة الراحة: ' + pass + ' نجح / ' + fail + ' فشل ═════');
process.exit(fail ? 1 : 0);
