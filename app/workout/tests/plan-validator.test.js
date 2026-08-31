// اختبار آلي للحارس النهائي — node tests/plan-validator.test.js
// يتحقق أن الـ validator يكتشف أخطاء خطة بطل القديمة ويقبل الخطة المصححة.
const V = require('../engine/validate.js');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.error('  ✗ ' + msg); }
}

// محاكاة خطة بطل المعيبة (كما خرجت فعلياً في ElForma_training_plan)
const brokenPlan = [
  { name: 'Upper 1', groups: [['chest','mid'],['back','mid'],['shoulders','lateral']], exercises: [
    { n: 'Single Arm DB Row', grp: 'back', sub: 'mid', rest: '75-90 ثانية' },
    { n: 'Incline Push-Up (Elevated Surface)', grp: 'chest', sub: 'upper', rest: '45-60 ثانية' },
    { n: 'Resistance Band Lateral Raise', grp: 'shoulders', sub: 'lateral', rest: '45-60 ثانية' },
  ]},
  { name: 'Lower 1', groups: [['quads','dominant'],['hamstrings','dominant'],['calves','gastrocnemius']], exercises: [
    { n: 'Bulgarian Split Squat (Chair)', grp: 'quads', sub: 'dominant', rest: '2-3 دقائق' },
    { n: 'Dumbbell Romanian Deadlift', grp: 'hamstrings', sub: 'dominant', rest: '2-3 دقائق' },
    { n: 'Standing Calf Raise (BW)', grp: 'calves', sub: 'gastrocnemius', rest: '45-60 ثانية' },
    { n: 'Dumbbell Wrist Curl', grp: 'forearms', sub: 'all', rest: '72 ثانية' }, // خطأ: ساعد + راحة غير بشرية
  ]},
  { name: 'Upper 2', groups: [['chest','upper'],['back','lats'],['shoulders','lateral']], exercises: [
    { n: 'Wide Push-Up', grp: 'chest', sub: 'mid', rest: '45-60 ثانية' },
    { n: 'Incline Push-Up (Elevated Surface)', grp: 'chest', sub: 'upper', rest: '45-60 ثانية' },
    { n: 'Side Lying DB Raise', grp: 'shoulders', sub: 'lateral', rest: '45-60 ثانية' },
  ]},
  { name: 'Lower 2', groups: [['hamstrings','dominant'],['quads','dominant'],['glutes','all']], exercises: [
    { n: 'Goblet Squat (Dumbbell)', grp: 'quads', sub: 'dominant', rest: '2-3 دقائق' },
    { n: 'Single Leg RDL (Dumbbell)', grp: 'hamstrings', sub: 'dominant', rest: '75-90 ثانية' },
    { n: 'Glute Bridge Weighted', grp: 'glutes', sub: 'all', rest: '45-60 ثانية' },
    { n: 'Incline Push-Up (Elevated Surface)', grp: 'chest', sub: 'upper', rest: '45-60 ثانية' }, // خطأ: صدر في يوم أرجل
  ]},
];

console.log('\n—— فحص الخطة المعيبة (يجب أن تفشل) ——');
const r1 = V.validatePlan(brokenPlan, { minEx: 5 });
assert(!r1.ok, 'الخطة المعيبة تُرفَض (ok=false)');
assert(r1.errors.some(e => /Lower 2/.test(e) && /Incline Push-Up/.test(e)), 'يكتشف الصدر في Lower 2');
assert(r1.errors.some(e => /Lower 1/.test(e) && /Wrist Curl/.test(e)), 'يكتشف الساعد في Lower 1');
assert(r1.errors.some(e => /Incline Push-Up/.test(e) && /3 مرات/.test(e)), 'يكتشف تكرار Incline Push-Up 3 مرات');
assert(r1.warnings.some(w => /72/.test(w)), 'يحذّر من الراحة 72 ثانية');

// خطة مصححة — بعد الإصلاح
const fixedPlan = [
  { name: 'Upper 1', groups: [['chest','mid'],['back','mid'],['shoulders','lateral']], exercises: [
    { n: 'Push-Up', grp: 'chest', sub: 'mid', rest: '60-90 ثانية' },
    { n: 'Single Arm DB Row', grp: 'back', sub: 'mid', rest: '75-90 ثانية' },
    { n: 'Resistance Band Row', grp: 'back', sub: 'lats', rest: '75-90 ثانية' },
    { n: 'Lateral Raise', grp: 'shoulders', sub: 'lateral', rest: '45-60 ثانية' },
    { n: 'Biceps Curl', grp: 'biceps', sub: 'short', rest: '60 ثانية' },
  ]},
  { name: 'Lower 1', groups: [['quads','dominant'],['hamstrings','dominant'],['glutes','all'],['calves','gastrocnemius']], exercises: [
    { n: 'Goblet Squat', grp: 'quads', sub: 'dominant', rest: '2-3 دقائق' },
    { n: 'DB Romanian Deadlift', grp: 'hamstrings', sub: 'dominant', rest: '2-3 دقائق' },
    { n: 'Glute Bridge', grp: 'glutes', sub: 'all', rest: '60-90 ثانية' },
    { n: 'Standing Calf Raise', grp: 'calves', sub: 'gastrocnemius', rest: '45-60 ثانية' },
    { n: 'Adductor Band Work', grp: 'adductors', sub: 'all', rest: '45-60 ثانية' },
  ]},
  { name: 'Upper 2', groups: [['chest','upper'],['back','lats'],['shoulders','press']], exercises: [
    { n: 'Incline Push-Up', grp: 'chest', sub: 'upper', rest: '60-90 ثانية' },
    { n: 'Resistance Band Seated Row', grp: 'back', sub: 'mid', rest: '75-90 ثانية' },
    { n: 'Rear Delt Fly', grp: 'shoulders', sub: 'rear', rest: '45-60 ثانية' },
    { n: 'Side Lying DB Raise', grp: 'shoulders', sub: 'lateral', rest: '45-60 ثانية' },
    { n: 'Overhead Triceps Extension', grp: 'triceps', sub: 'long', rest: '60 ثانية' },
  ]},
  { name: 'Lower 2', groups: [['hamstrings','dominant'],['quads','dominant'],['glutes','all'],['calves','gastrocnemius']], exercises: [
    { n: 'Bulgarian Split Squat', grp: 'quads', sub: 'dominant', rest: '90 ثانية' },
    { n: 'Single Leg RDL', grp: 'hamstrings', sub: 'dominant', rest: '75-90 ثانية' },
    { n: 'Glute Bridge Weighted', grp: 'glutes', sub: 'all', rest: '60-90 ثانية' },
    { n: 'Standing Calf Raise', grp: 'calves', sub: 'gastrocnemius', rest: '45-60 ثانية' },
    { n: 'Core Anti-Rotation', grp: 'core', sub: 'all', rest: '45-60 ثانية' },
  ]},
];

console.log('\n—— فحص الخطة المصححة (يجب أن تنجح) ——');
const r2 = V.validatePlan(fixedPlan, { minEx: 5 });
r2.errors.forEach(e => console.error('   غير متوقع: ' + e));
assert(r2.ok, 'الخطة المصححة تُقبل (ok=true)');
assert(r2.warnings.length === 0, 'لا تحذيرات في الخطة المصححة');

// وحدات مساعدة
console.log('\n—— فحص الدوال المساعدة ——');
assert(V.isHumanRest('72 ثانية') === false, '72 ثانية = غير بشرية');
assert(V.isHumanRest('75 ثانية') === true, '75 ثانية = بشرية');
assert(V.isHumanRest('45-60 ثانية') === true, 'المدى 45-60 = بشري');
assert(V.dayArchetype(brokenPlan[1]) === 'lower', 'Lower 1 = lower archetype');
assert(V.dayArchetype(brokenPlan[0]) === 'upper', 'Upper 1 = upper archetype');

// —— فحص الإصلاح الذاتي (repairPlan) ——
console.log('\n—— فحص الإصلاح الذاتي: خطة معيبة → تُصلّح تلقائياً ——');
const toRepair = JSON.parse(JSON.stringify(brokenPlan));
const rep = V.repairPlan(toRepair, { minEx: 2 });
assert(rep.report.ok, 'بعد الإصلاح: الخطة بقت سليمة (report.ok=true)');
assert(rep.removedArch.length >= 2, 'حذف مخالفات نوع اليوم (صدر في Lower 2 + ساعد في Lower 1): ' + rep.removedArch.length);
assert(rep.removedDup.length >= 1, 'حذف تكرار Incline Push-Up الزائد: ' + rep.removedDup.length);
assert(toRepair[1].exercises.every(e => e.grp !== 'forearms'), 'Lower 1 بقى خالي من الساعد');
assert(toRepair[3].exercises.every(e => e.grp !== 'chest'), 'Lower 2 بقى خالي من الصدر');
assert(V.snapRestLabel('72 ثانية') === '75 ثانية', 'تطبيع الراحة: 72 → 75');
assert(V.snapRestLabel('2-3 دقائق') === '2-3 دقائق', 'الدقائق لا تتغير');

// —— فحص ضمان الأرضية: يوم مليء بالتكرارات لا ينزل تحت minEx ——
console.log('\n—— فحص أرضية minEx (المتقدم ≥ 6) ——');
// StrongLifts-style: نفس التمارين تتكرر عبر الأيام — كلها تكرار أسبوعي
function mkDay(name){ return { name: name, groups: [['quads','dominant'],['hamstrings','dominant'],['chest','mid'],['back','mid'],['shoulders','lateral'],['calves','gastrocnemius']], exercises: [
  { n: 'Back Squat', grp: 'quads', sub: 'dominant', rest: '120 ثانية' },
  { n: 'Romanian Deadlift', grp: 'hamstrings', sub: 'dominant', rest: '120 ثانية' },
  { n: 'Bench Press', grp: 'chest', sub: 'mid', rest: '90 ثانية' },
  { n: 'Barbell Row', grp: 'back', sub: 'mid', rest: '90 ثانية' },
  { n: 'Lateral Raise', grp: 'shoulders', sub: 'lateral', rest: '60 ثانية' },
  { n: 'Standing Calf Raise', grp: 'calves', sub: 'gastrocnemius', rest: '45 ثانية' },
]}; }
const floorPlan = [ mkDay('Full A'), mkDay('Full B'), mkDay('Full C') ];
const floorRep = V.repairPlan(floorPlan, { minEx: 6 });
floorPlan.forEach(function(d){
  if (d.isRest) return;
  assert(d.exercises.length >= 6, 'يوم ' + d.name + ' ≥ 6 تمارين بعد الإصلاح (' + d.exercises.length + ')');
});


// —— فحص نظام تقييم جودة الخطة (scorePlan) ——
console.log('\n—— فحص Score: تقييم جودة الخطة ——');
assert(typeof V.scorePlan === 'function', 'scorePlan موجودة ومُصدَّرة');

const goodScored = V.scorePlan(fixedPlan, { exp: 'intermediate', goal: 'muscle', recoveryScore: 75, minEx: 5 });
assert(goodScored && typeof goodScored.score === 'number', 'scorePlan تُرجع score رقمي');
assert(goodScored.score >= 0 && goodScored.score <= 100, 'النتيجة ضمن 0–100: ' + goodScored.score);
assert(Array.isArray(goodScored.breakdown) && goodScored.breakdown.length === 6, 'التفصيل 6 أبعاد');
assert(typeof goodScored.grade === 'string' && goodScored.grade.length >= 1, 'يوجد grade: ' + goodScored.grade);
assert(goodScored.breakdown.every(b => b.got <= b.max && b.got >= 0), 'كل بُعد ضمن حدوده (0..max)');

const brokenScored = V.scorePlan(brokenPlan, { exp: 'intermediate', goal: 'muscle', recoveryScore: 75, minEx: 5 });
assert(brokenScored.score < goodScored.score, 'الخطة المعيبة أقل جودة من المصححة (' + brokenScored.score + ' < ' + goodScored.score + ')');
const bInt = brokenScored.breakdown.find(b => b.key === 'integrity');
assert(bInt && bInt.got < 15, 'السلامة البنيوية للخطة المعيبة منقوصة (بسبب المخالفات)');
assert(V.scorePlan([], {}).score === 0, 'خطة فارغة = 0');
assert(V.scorePlan(null).score != null, 'إدخال null لا يكسر الدالة');

console.log('\n═════ النتيجة: ' + pass + ' نجح / ' + fail + ' فشل ═════');
process.exit(fail ? 1 : 0);
