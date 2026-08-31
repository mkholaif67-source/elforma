// ════════════════════════════════════════════════════════════
// tests/volume-math.test.js — شبكة أمان لمحرك الحجم (constants.js)
// ════════════════════════════════════════════════════════════
// تحمّل constants.js داخل sandbox بـ vm مع globals وهمية، بدون تعديل
// أي ملف إنتاجي. الهدف: قفل السلوك الحالي (characterization) قبل أي إصلاح.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = {
  console,
  state: { exp: 'intermediate', days: 4, goal: 'muscle', recoveryScore: 75, bmi: 24 },
  MODULE_DB: { cardio: { hiit: [], liss: [] } },
  window: undefined
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'engine/constants.js'), 'utf8'), sandbox, { filename: 'constants.js' });

let pass = 0, fail = 0;
function assert(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

const CWB = sandbox.computeWeeklyBudget;
const GSM = sandbox.getSetsForMuscle;
assert(typeof CWB === 'function', 'computeWeeklyBudget متاحة للاختبار');
assert(typeof GSM === 'function', 'getSetsForMuscle متاحة للاختبار');

// —— 1) الميزانية الأسبوعية تبقى داخل حدود المستوى (حارس جوهري) ——
console.log('\n—— حدود الميزانية الأسبوعية ——');
const bAdv = CWB('advanced', 5, 'muscle', 75);
const bInt = CWB('intermediate', 4, 'muscle', 75);
const bBeg = CWB('beginner', 3, 'muscle', 75);
assert(bBeg.total >= 40 && bBeg.total <= 65, 'مبتدئ ضمن 40–65: ' + bBeg.total);
assert(bInt.total >= 70 && bInt.total <= 90, 'متوسط ضمن 70–90: ' + bInt.total);
assert(bAdv.total >= 90 && bAdv.total <= 120, 'متقدم ضمن 90–120: ' + bAdv.total);
assert(Math.abs(bAdv.primary + bAdv.shoulders + bAdv.accessory - bAdv.total) <= 1, 'مجموع 60/20/20 = الإجمالي');

// —— 2) deload التعافي المنخفض يقلّل الحجم (ولا يرفعه) ——
console.log('\n—— autoregulation التعافي ——');
const bLowRec = CWB('intermediate', 4, 'muscle', 40);
const bHighRec = CWB('intermediate', 4, 'muscle', 90);
assert(bLowRec.total <= bInt.total, 'تعافي منخفض (40) ≤ تعافي عادي (75): ' + bLowRec.total + ' ≤ ' + bInt.total);
assert(bHighRec.total >= bInt.total, 'تعافي عالٍ (90) ≥ عادي: ' + bHighRec.total + ' ≥ ' + bInt.total);
assert(bLowRec.total >= 70, 'deload لا يكسر أرضية المستوى (≥ 70): ' + bLowRec.total);

// —— 3) سقف الأكتاف لا يتجاوز الحد العلمي ——
assert(bAdv.shoulders <= 15, 'سقف الأكتاف للمتقدم ≤ 15: ' + bAdv.shoulders);

// —— 4) getSetsForMuscle: clamp الجلسة الواحدة ——
console.log('\n—— توزيع المجموعات لكل عضلة ——');
const chest = GSM('chest', 'advanced', 5, 'muscle', bAdv, 2);
const back = GSM('back', 'advanced', 5, 'muscle', bAdv, 2);
const quads = GSM('quads', 'advanced', 5, 'muscle', bAdv, 2);
const hams = GSM('hamstrings', 'advanced', 5, 'muscle', bAdv, 2);
const calves = GSM('calves', 'advanced', 5, 'muscle', bAdv, 2);
assert(chest.target >= chest.min && chest.target <= chest.max, 'الصدر: target داخل [min,max]');
assert(chest.target >= 3, 'المتقدم لا ينزل عن 3 مجموعات/جلسة (الصدر): ' + chest.target);
assert(calves.weeklyTarget < chest.weeklyTarget, 'السمانة < الصدر أسبوعياً (توزيع سليم): ' + calves.weeklyTarget + ' < ' + chest.weeklyTarget);

// —— 5) CHARACTERIZATION: السلوك الحالي (قبل إصلاح الوزن) ——
// حالياً: الـ 60% تُقسم بالتساوي → صدر = ظهر = كوادز = هامسترينج.
// بعد الإصلاح المخطّط (Phase 2) هذا سيتغيّر لـ: ظهر ≥ صدر، كوادز ≥ هامسترينج.
console.log('\n—— توثيق السلوك الحالي (سيوجّه الإصلاح) ——');
console.log('    الأسبوعي الحالي → صدر:' + chest.weeklyTarget + ' ظهر:' + back.weeklyTarget + ' كوادز:' + quads.weeklyTarget + ' هام:' + hams.weeklyTarget);
// ✅ Phase 2: الوزن المرجّح للـ60% — السلوك الصحيح المطلوب
assert(back.weeklyTarget > chest.weeklyTarget, 'الظهر > الصدر أسبوعياً (توازن دفع/سحب): ظهر ' + back.weeklyTarget + ' > صدر ' + chest.weeklyTarget);
assert(quads.weeklyTarget > hams.weeklyTarget, 'الكوادز > الهامسترينج أسبوعياً: كوادز ' + quads.weeklyTarget + ' > هام ' + hams.weeklyTarget);
assert((chest.weeklyTarget + back.weeklyTarget + quads.weeklyTarget + hams.weeklyTarget) >= bAdv.primary - 2, 'إجمالي العضلات الأساسية لم ينخفض (الميزانية محفوظة): مجموع ≈ ' + bAdv.primary);

console.log('\n═════ نتيجة محرك الحجم: ' + pass + ' نجح / ' + fail + ' فشل ═════');
process.exit(fail ? 1 : 0);
