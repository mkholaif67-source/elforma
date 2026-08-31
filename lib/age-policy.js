'use strict';
// ============================================================================
//  طبقة سياسة السن — Age Policy Layer
// ----------------------------------------------------------------------------
//  السيستم بقى مفتوح من 7 لـ 80 سنة. فتح الرقم لوحده خطر: ماتور البالغين
//  ممكن يدي طفل 12 سنة عجز 25% وبرنامج تضخيم برفعات قصوى. الملف ده
//  هو المرجع الوحيد للسؤال: إيه المسموح والممنوع في كل سن؟
//
//  المراجع العلمية المبني عليها الملف:
//  1) NSCA Youth Resistance Training Position Statement (2009):
//     تدريب المقاومة آمن من سن 7-8 لو مصمم ومشرف عليه صح.
//     اللي بيؤذي مش التمرين، لكن الرفعات القصوى (1RM) والباورليفتنج
//     قبل اكتمال البلوغ — خطر على ألواح النمو (growth plates).
//  2) Mayo Clinic / St. Louis Children's / UH Rainbow:
//     أوزان خفيفة + تكرارات أعلى + إتقان الأداء قبل زيادة الحمل.
//  3) AAP Clinical Practice Guideline for Pediatric Obesity (2023) +
//     Academy of Nutrition & Dietetics Pediatric Weight Management:
//     لو فيه تقييد سعرات للمراهق (13-18) فالحد الأدنى 1200 سعرة/يوم
//     وتحت متابعة. للأصغر الهدف تثبيت الوزن مع استمرار الطول
//     (grow into the weight) مش خسارة سريعة.
//  4) تحذير الـ AAP من اضطرابات الأكل: ممنوع لغة الحرمان والأرقام
//     القاسية مع الأطفال.
//  5) GSSI / Nutritional Recommendations for the Young Athlete:
//     بروتين المراهق الرياضي ~1.2-1.5 جم/كجم موزعين ~0.3 جم/كجم
//     على 4-5 وجبات — مش 2.2 بتاع البالغين.
//  6) Mifflin-St Jeor متحقق علميا لسن 18-78 بس — تحت 18 بنستخدم
//     Schofield (FAO/WHO/UNU) وهي المعتمدة للأطفال والمراهقين.
// ============================================================================

var MIN_AGE = 7;
var MAX_AGE = 80;

// معاملات Schofield (weight-based, kcal/day) حسب الفئة العمرية والجنس.
// BMR = a * weight(kg) + b
var SCHOFIELD = {
  male:   [{ max: 10, a: 22.7, b: 495 }, { max: 18, a: 17.5, b: 651 }],
  female: [{ max: 10, a: 22.5, b: 499 }, { max: 18, a: 12.2, b: 746 }]
};

function isFemale(gender) {
  var g = String(gender || '').trim().toLowerCase();
  return g === 'female' || g === 'f' || g === '\u0623\u0646\u062b\u0649' || g === '\u0641\u062a\u0627\u0629' || g === '\u0633\u064a\u062f\u0629';
}

// BMR للأطفال والمراهقين تحت 18 — Schofield بدل Mifflin.
function schofieldBMR(age, weight, gender) {
  var table = isFemale(gender) ? SCHOFIELD.female : SCHOFIELD.male;
  for (var i = 0; i < table.length; i++) {
    if (age < table[i].max) return Math.round(table[i].a * weight + table[i].b);
  }
  return null;
}

// ----------------------------------------------------------------------------
//  الشرائح
// ----------------------------------------------------------------------------
//  child   7-9    طفل — حركة ومهارة، مفيش دايت ولا أوزان خالص
//  preteen 10-13  ما قبل البلوغ — مقاومة خفيفة، تثبيت وزن مش خسارة
//  teen    14-16  مراهق — جيم عادي بأوزان متدرجة، عجز/فائض محسوب
//  adult   17-54  بالغ — المنطق الكامل زي ما هو
//  senior  55-69  كبير سن — بروتين أعلى، راحة أطول
//  elder   70-80  متقدم — مفاصل وتوازن، مفيش قفز ولا عجز عنيف
// ----------------------------------------------------------------------------

var TIERS = [
  {
    key: 'child', min: 7, max: 9,
    label: '\u0637\u0641\u0644 (7-9 \u0633\u0646\u064a\u0646)',
    // تغذية
    allowDeficit: false,          // ممنوع أي عجز نهائيا
    allowSurplus: false,          // وممنوع تضخيم متعمد
    maxDeficitPct: 0,
    maxSurplusPct: 0,
    calorieFloor: 1200,
    proteinPerKg: [1.0, 1.2],
    useSchofield: true,
    // تدريب
    allowWeights: false,          // وزن الجسم والمقاومة المطاطية بس
    allowMaxLifts: false,
    allowPlyometrics: false,
    repRange: [12, 20],
    maxSessionsPerWeek: 3,
    maxSessionMinutes: 40,
    restSeconds: 90,
    allowSupplements: false,
    requiresGuardianConsent: true,
    focus: '\u0644\u0639\u0628 \u0648\u062d\u0631\u0643\u0629 \u0648\u0625\u062a\u0642\u0627\u0646 \u0623\u0646\u0645\u0627\u0637 \u0627\u0644\u062d\u0631\u0643\u0629',
    note: '\u0641\u064a \u0627\u0644\u0633\u0646 \u062f\u0647 \u0627\u0644\u0647\u062f\u0641 \u062d\u0631\u0643\u0629 \u0648\u0645\u062a\u0639\u0629 \u0648\u0623\u0643\u0644 \u0645\u062a\u0648\u0627\u0632\u0646 \u2014 \u0645\u0641\u064a\u0634 \u062f\u0627\u064a\u062a \u0648\u0644\u0627 \u0631\u064a\u062c\u064a\u0645.'
  },
  {
    key: 'preteen', min: 10, max: 13,
    label: '\u0645\u0627 \u0642\u0628\u0644 \u0627\u0644\u0628\u0644\u0648\u063a (10-13 \u0633\u0646\u0629)',
    allowDeficit: true,
    allowSurplus: true,
    maxDeficitPct: 10,            // عجز خفيف جدا — الهدف ت\u062bبيت مع الطول
    maxSurplusPct: 8,
    calorieFloor: 1400,
    proteinPerKg: [1.2, 1.5],
    useSchofield: true,
    allowWeights: true,           // أوزان خفيفة بإشراف
    allowMaxLifts: false,
    allowPlyometrics: false,
    repRange: [10, 15],
    maxSessionsPerWeek: 3,
    maxSessionMinutes: 50,
    restSeconds: 90,
    allowSupplements: false,
    requiresGuardianConsent: true,
    focus: '\u0625\u062a\u0642\u0627\u0646 \u0627\u0644\u0623\u062f\u0627\u0621 \u0628\u0623\u0648\u0632\u0627\u0646 \u062e\u0641\u064a\u0641\u0629',
    note: '\u0627\u0644\u062e\u0633\u0627\u0631\u0629 \u0647\u0646\u0627 \u0628\u062a\u062d\u0635\u0644 \u0628\u062b\u0628\u0627\u062a \u0627\u0644\u0648\u0632\u0646 \u0645\u0639 \u0632\u064a\u0627\u062f\u0629 \u0627\u0644\u0637\u0648\u0644\u060c \u0645\u0634 \u0628\u0631\u064a\u062c\u064a\u0645 \u0642\u0627\u0633\u064a.'
  },
  {
    key: 'teen', min: 14, max: 16,
    label: '\u0645\u0631\u0627\u0647\u0642 (14-16 \u0633\u0646\u0629)',
    allowDeficit: true,
    allowSurplus: true,
    maxDeficitPct: 15,            // أقل من البالغين (20-25%)
    maxSurplusPct: 12,
    calorieFloor: 1600,           // أعلى من ا\u0644\u062d\u062f \u0627\u0644\u0637\u0628\u064a \u0627\u0644\u0623\u062f\u0646\u0649 1200 \u0644\u0623\u0645\u0627\u0646 \u0623\u0632\u064a\u062f
    proteinPerKg: [1.4, 1.7],
    useSchofield: true,
    allowWeights: true,
    allowMaxLifts: false,         // لسة ممنوع قبل اكتمال البلوغ
    allowPlyometrics: true,
    repRange: [8, 15],
    maxSessionsPerWeek: 4,
    maxSessionMinutes: 60,
    restSeconds: 75,
    allowSupplements: false,      // مفيش كرياتين ولا كافيين قبل 17
    requiresGuardianConsent: true,
    focus: '\u0642\u0648\u0629 \u0648\u062a\u0631\u0643\u064a\u0628 \u062c\u0633\u0645 \u0628\u062a\u062f\u0631\u062c \u0622\u0645\u0646',
    note: '\u062c\u064a\u0645 \u0639\u0627\u062f\u064a \u0648\u0646\u062a\u064a\u062c\u0629 \u062d\u0642\u064a\u0642\u064a\u0629\u060c \u0628\u0633 \u0645\u0641\u064a\u0634 \u0631\u0641\u0639\u0627\u062a \u0642\u0635\u0648\u0649 \u0648\u0645\u0641\u064a\u0634 \u062a\u062c\u0648\u064a\u0639.'
  },
  {
    key: 'adult', min: 17, max: 54,
    label: '\u0628\u0627\u0644\u063a',
    allowDeficit: true,
    allowSurplus: true,
    maxDeficitPct: 25,
    maxSurplusPct: 20,
    calorieFloor: 1200,
    // null = ممنوع اللمس. البالغ 17-54 هو بالظبط الحالة اللي الموقع
    // معمول ليها ومتحقق منها، والموقع هو المرجع. طبقة السن
    // مالهاش حق تغير أرقامه — دورها يبدأ برا النطاق ده بس.
    proteinPerKg: null,
    useSchofield: false,
    allowWeights: true,
    allowMaxLifts: true,
    allowPlyometrics: true,
    repRange: [4, 20],
    maxSessionsPerWeek: 6,
    maxSessionMinutes: 120,
    restSeconds: 90,
    allowSupplements: true,
    requiresGuardianConsent: false,
    focus: '\u0627\u0644\u0647\u062f\u0641 \u0627\u0644\u0644\u064a \u0627\u062e\u062a\u0627\u0631\u0647',
    note: ''
  },
  {
    key: 'senior', min: 55, max: 69,
    label: '\u0641\u0648\u0642 55',
    allowDeficit: true,
    allowSurplus: true,
    maxDeficitPct: 20,
    maxSurplusPct: 15,
    calorieFloor: 1400,
    proteinPerKg: [1.6, 2.0],     // مقاومة الساركوبينيا
    useSchofield: false,
    allowWeights: true,
    allowMaxLifts: false,
    allowPlyometrics: false,
    repRange: [8, 20],
    maxSessionsPerWeek: 5,
    maxSessionMinutes: 75,
    restSeconds: 120,
    allowSupplements: true,
    requiresGuardianConsent: false,
    focus: '\u0627\u0644\u062d\u0641\u0627\u0638 \u0639\u0644\u0649 \u0627\u0644\u0643\u062a\u0644\u0629 \u0648\u0627\u0644\u0648\u0638\u064a\u0641\u0629',
    note: '\u0627\u0644\u0628\u0631\u0648\u062a\u064a\u0646 \u0628\u064a\u0632\u064a\u062f \u0645\u0639 \u0627\u0644\u0633\u0646 \u0645\u0634 \u0628\u064a\u0642\u0644\u060c \u0639\u0634\u0627\u0646 \u0641\u0642\u062f \u0627\u0644\u0639\u0636\u0644.'
  },
  {
    key: 'elder', min: 70, max: 80,
    label: '\u0641\u0648\u0642 70',
    allowDeficit: true,
    allowSurplus: true,
    maxDeficitPct: 12,
    maxSurplusPct: 15,
    calorieFloor: 1500,
    proteinPerKg: [1.6, 2.0],
    useSchofield: false,
    allowWeights: true,
    allowMaxLifts: false,
    allowPlyometrics: false,
    repRange: [10, 20],
    maxSessionsPerWeek: 4,
    maxSessionMinutes: 60,
    restSeconds: 150,
    allowSupplements: true,
    requiresGuardianConsent: false,
    focus: '\u062a\u0648\u0627\u0632\u0646 \u0648\u0645\u0641\u0627\u0635\u0644 \u0648\u0645\u0646\u0639 \u0627\u0644\u0633\u0642\u0648\u0637',
    note: '\u0627\u0644\u0623\u0648\u0644\u0648\u064a\u0629 \u0644\u0644\u062a\u0648\u0627\u0632\u0646 \u0648\u0627\u0644\u0642\u0648\u0629 \u0627\u0644\u0648\u0638\u064a\u0641\u064a\u0629 \u0645\u0634 \u0644\u0644\u0631\u0642\u0645 \u0639\u0644\u0649 \u0627\u0644\u0645\u064a\u0632\u0627\u0646.'
  }
];

function tierFor(age) {
  var a = Number(age);
  if (!isFinite(a)) return null;
  for (var i = 0; i < TIERS.length; i++) {
    if (a >= TIERS[i].min && a <= TIERS[i].max) return TIERS[i];
  }
  return a < MIN_AGE ? TIERS[0] : TIERS[TIERS.length - 1];
}

function isYouth(age) {
  var t = tierFor(age);
  return !!t && (t.key === 'child' || t.key === 'preteen' || t.key === 'teen');
}

module.exports = {
  MIN_AGE: MIN_AGE,
  MAX_AGE: MAX_AGE,
  TIERS: TIERS,
  tierFor: tierFor,
  isYouth: isYouth,
  isFemale: isFemale,
  schofieldBMR: schofieldBMR
};
