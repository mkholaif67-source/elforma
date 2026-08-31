// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS — engine/constants.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ── UPGRADE-1: Module-level constants — created ONCE at load, not per-call ──
// Per ACSM Clinical Exercise Physiology: these exercises place extreme axial/joint
// load contraindicated for obese users (BMI≥30) per joint-load research.
// FIX-C: إزالة Bulgarian Split Squat و Pendulum Squat من القائمة
// السبب العلمي: كلاهما آمنان لمستخدمي BMI 30-34 — لا ضغط محوري على العمود الفقري
// BSS: unilateral - يوزع الحمل، مستخدم في بروتوكولات إعادة تأهيل الركبة
// Pendulum Squat: خلفية متكئة تخفف الضغط على الركبة مقارنة بالسكوات التقليدي
// SCI-FIX-3: إزالة Barbell Hip Thrust من _OBESE_RESTRICT
// الخطأ العلمي: Hip Thrust لا يضع ضغطا محوريا على العمود الفقري (لا axial load)
// بل هو موصى به تحديدا لمرضى الظهر وزيادة الوزن لأنه:
// 1) يفعل الجلوتس بأعلى نسبة EMG (Contreras 2011)
// 2) يخفف الضغط عن الركبة مقارنة بالسكوات
// 3) يحسن ميكانيكا المشي عند الوزن الزائد
// المبرر الوحيد للحجب: إذا كان BMI ≥ 35 (SEVERE) مع إصابة ركبة — وهو معالج في SEVERE_OBESE_RESTRICT
const _OBESE_RESTRICT = new Set([
  'Barbell Back Squat','Front Barbell Squat',
  'Walking Lunges (Barbell)','Step-Up with Barbell',
  'Stiff Leg Deadlift','Sissy Squat'
]);
const _SEVERE_OBESE_RESTRICT = new Set([
  ..._OBESE_RESTRICT,
  'Romanian Deadlift','Dumbbell Romanian Deadlift','Hack Squat Machine',
  'Leg Press (45°)','Barbell Bent Over Row','T Bar Row'
]);

// PATCH-GYM-4: فلتر الكارديو عالي الكثافة لل BMI > 30
// ال Burpees وال Battle Ropes تضغط على الركبتين والمفاصل عند السمنة
// يستبدل برمجيا ب Incline Treadmill Walk (كارديو عالي الكفاءة ومنخفض الاصطدام)
const _HIGH_IMPACT_CARDIO = new Set(['Burpees','Jump Squat','Box Jump','Jumping Lunges','Jump Rope','High Knees','Jumping Jacks']);
const _LOW_IMPACT_REPLACEMENT = {
  n: 'Incline Treadmill Walk',
  tier: 'S',
  protocol: '30 دقيقة · منحدر 8-12% · سرعة 5-6 كم/ساعة',
  desc: 'كارديو عالي الكفاءة ومنخفض الاصطدام — مثالي لحماية الركبتين والمفاصل',
  vid: 'null',
  equipment: 'gym',
  fatigue: 'medium',
  category: 'cardio_liss'
};
// يطبق على MODULE_DB.cardio عند بناء الخطة
function applyHighImpactFilter(bmi) {
  if (bmi < 30) return;
  const cardioPool = MODULE_DB?.cardio?.hiit || [];
  for (let i = 0; i < cardioPool.length; i++) {
    if (_HIGH_IMPACT_CARDIO.has(cardioPool[i].n)) {
      const _origName = cardioPool[i].n;
      cardioPool[i] = { ...cardioPool[i], ..._LOW_IMPACT_REPLACEMENT };
      console.log(`[PATCH-GYM-4]  BMI ${bmi.toFixed(1)} ≥ 30 — replaced "${_origName}" - Incline Treadmill Walk`);
    }
  }
  // كذلك في LISS pool
  const lissPool = MODULE_DB?.cardio?.liss || [];
  for (let i = 0; i < lissPool.length; i++) {
    if (_HIGH_IMPACT_CARDIO.has(lissPool[i].n)) {
      lissPool[i] = { ...lissPool[i], ..._LOW_IMPACT_REPLACEMENT };
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ██████╗ ██████╗ ███████╗    ██████╗ ██████╗  ██████╗  ██████╗███████╗███████╗███████╗ ██████╗ ██████╗
// PRE-PROCESSOR ENGINE — "الدستور التدريبي"
// المرحلة 1: حساب الميزانية الأسبوعية الكلية بناء على المستوى
// المرحلة 2: توزيع 60/20/20 على الأيام
// المرحلة 3: ضمان compound-first + zero-duplicate
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── المعايير الذهبية: ميزانية المجموعات الأسبوعية ─────────────────────
// FIX: تحسب بناء على MUSCLE_SET_RANGES الفعلية:
// المعايير الفعلية المطبقة (STRICT_TARGETS + الحدود أدناه): مبتدئ 40-65 / متوسط 70-90 / متقدم 90-120
const WEEKLY_BUDGET = {
  // ── المعايير الذهبية الدقيقة — سقف وأرضية صارمة لا يتجاوزهما السيستم ──
  beginner:     { min: 40,  max: 65  },  // أقل من 6 أشهر (محدث v58: 40-65)
  intermediate: { min: 70,  max: 90  },  // 6 أشهر - سنتين
  advanced:     { min: 90,  max: 120 }   // أكثر من سنتين
};

// ── نطاق المجموعات لكل عضلة حسب المستوى ─────────────────────────────
// المصدر: ACSM Position Stand 2009 + Schoenfeld et al. 2016
// المبتدئ: Minimum Effective Dose — يتجنب DOMS الشديد ويبني القاعدة العصبية
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ABSOLUTE_WEEKLY_BOUNDS — الحدود المطلقة التي لا يكسرها أي pass أبدا
// مبتدئ: 40-65 | متوسط: 70-90 | متقدم: 90-120
// هذه نسخة const ثابتة منفصلة عن WEEKLY_BUDGET لضمان عدم تلوثها
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ABSOLUTE_WEEKLY_BOUNDS = {
  beginner:     { min: 40,  max: 65  },
  intermediate: { min: 70,  max: 90  },
  advanced:     { min: 90,  max: 120 }
};


// ── FIX v24: CENTRAL MIN SETS ENFORCER ──────────────────────────────────
// أي تمرين مهما كانت العضلة — المتقدم لا ينزل عن 3 sets أبدا بدون استثناء
// المبتدئ والمتوسط: 2 sets كحد أدنى
const _ACCESSORY_B_HARD = new Set(['calves','forearms','traps']); // لل weekly cap فقط — مش لل min sets
function getMinSetsForExp(exp, grp) {
  if (exp === 'advanced') return 3; // كل تمرين للمتقدم = 3 على الأقل — بلا استثناء
  return 2;
}

const MUSCLE_SET_RANGES = {
  // العضلات الرئيسية (60%): صدر، ظهر، كوادز، هامستينج
  chest:      { beginner:[8,10],  intermediate:[12,15], advanced:[15,20] },
  back:       { beginner:[8,10],  intermediate:[12,15], advanced:[15,20] },
  quads:      { beginner:[8,10],  intermediate:[12,15], advanced:[15,20] },
  hamstrings: { beginner:[6,8],   intermediate:[9,12],  advanced:[12,15] },
  // الأكتاف (20%): جانبية، خلفية، أمامية
  shoulders:  { beginner:[6,8],   intermediate:[9,12],  advanced:[12,15] },
  // العضلات المساعدة (20%): ذراعين، جلوتس، سمانة، ساعد
  // ملاحظة: البايسبس والترايسبس يتلقيان تحفيزا غير مباشر من الصدر والظهر
  biceps:     { beginner:[4,6],   intermediate:[6,12],  advanced:[9,15]  },
  triceps:    { beginner:[4,6],   intermediate:[6,12],  advanced:[9,15]  },
  calves:     { beginner:[3,5],   intermediate:[4,6],   advanced:[6,9]   },
  glutes:     { beginner:[3,6],   intermediate:[3,9],   advanced:[3,9]   },
  core:       { beginner:[3,6],   intermediate:[4,8],   advanced:[6,10]  },
  forearms:   { beginner:[0,4],   intermediate:[0,6],   advanced:[3,8]   },
  traps:      { beginner:[0,4],   intermediate:[0,6],   advanced:[3,8]   }
};

// ── 60/20/20 تصنيف العضلات ─────────────────────────────────────────
const MUSCLE_CATEGORY = {
  primary:   ['chest','back','quads','hamstrings'],   // 60%
  shoulders: ['shoulders'],                            // 20%
  accessory: ['biceps','triceps','calves','glutes','core','forearms','traps'] // 20%
};

/**
 * PreProcessor: تحسب الميزانية المثلى لكل عضلة في الأسبوع
 * تستخدم لتوجيه pickExercises دون هدم السيستم الحالي
 */
// ── SHARED INJURY DANGER MAP (single source of truth) ────────────────────
// Exposed globally so BOTH planner.js (isExcluded) and components.js
// (enforce602020Distribution._safeForInj) resolve the same map.
// FIX: previously DANGER_MAP was function-scoped inside planner.pickExercises,
// so components.js threw "DANGER_MAP is not defined" whenever an injury value
// (even 'none') was present and an exercise lacked an explicit safe tag.
const DANGER_MAP = {
    shoulder:['Overhead Barbell Press','Overhead Press (Barbell)','Dips (Chest Variation)',
              'Incline Barbell Press','Incline Dumbbell Press',
              'Incline Smith Machine Press','Machine Shoulder Press',
              'Arnold Press','Arnold Press (Dumbbell)','Smith Machine Shoulder Press',
              'Overhead Press','Pike Push-Up',
              'Seated DB Shoulder Press','Dumbbell Shoulder Press (Seated)',
              'Dumbbell Shoulder Press (Seated)','Cable Chest Press',
              'DB Overhead Tricep Extension','Dumbbell Overhead Tricep Ext',
              'Overhead Cable Tricep Extension','Overhead Cable Tricep Ext',
              'Skull Crusher (Floor DB)','Skull Crushers (EZ Bar)',
              'Decline Barbell Press','Decline Dumbbell Press',
              'Close Grip Bench Press','Dips Between Chairs',
              'Bayesian Cable Curl','Incline Dumbbell Curl','Cable Overhead Curl',
              'Smith Machine Flat Press','Barbell Bench Press','Dumbbell Bench Press',
              'Dumbbell Incline Press (Chair)','Incline Push-Up (Elevated Surface)',
              'Decline Push-Up (Feet Elevated)','Close Grip Push-Up'],
    back:    ['Romanian Deadlift','Barbell Bent Over Row','Stiff Leg Deadlift',
              'Barbell Back Squat','Front Barbell Squat','Smith Machine Row','Meadows Row',
              'Dumbbell Romanian Deadlift','Walking Lunges (Barbell)','Step-Up with Barbell',
              'Dumbbell Bent Over Row','T Bar Row',
              'Barbell Hip Thrust','Cable Pull Through'],
    knee:    ['Barbell Back Squat','Hack Squat Machine','Smith Machine Squat','Pendulum Squat',
              'Front Barbell Squat','Bulgarian Split Squat','Walking Lunges (Barbell)',
              'Step-Up with Barbell','Leg Press (45°)','Bulgarian Split Squat (Chair)',
              'Dumbbell Squat','Resistance Band Squat',
              'Sissy Squat','Lunge (Dumbbell)','Lunge (Bodyweight)'],
    elbow:   ['Skull Crushers (EZ Bar)','Close Grip Bench Press','EZ Bar Preacher Curl',
              'EZ Bar Curl','Machine Preacher Curl','Spider Curl (EZ Bar)',
              'Skull Crusher (Floor DB)','DB Overhead Tricep Extension',
              'Overhead Cable Tricep Extension','Overhead Cable Tricep Ext'],
    wrist:   ['Barbell Wrist Curl','Reverse Barbell Wrist Curl','Barbell Bench Press',
              'Close Grip Bench Press','Barbell Back Squat','Front Barbell Squat',
              'Overhead Barbell Press'],
    neck:    ['Barbell Shrugs','Smith Machine Shrugs','Dumbbell Shrugs',
              'Overhead Barbell Press']
};
if (typeof globalThis !== 'undefined') globalThis.DANGER_MAP = DANGER_MAP;

function computeWeeklyBudget(exp, days, goal, recoveryScore) {
  const budget = WEEKLY_BUDGET[exp] || WEEKLY_BUDGET.intermediate;
  const rc = recoveryScore || 75;

  // ── المرحلة 1: سقف صارم بناء على المستوى فقط (المعيار الذهبي) ───────────
  // المبتدئ: هدف ثابت 65 (نطاق 40-65)
  // المتوسط: هدف ثابت 80 (نطاق 70-90)
  // المتقدم: هدف ثابت 105 (نطاق 90-120)
  const STRICT_TARGETS = { beginner: 65, intermediate: 80, advanced: 105 };
  let targetTotal = STRICT_TARGETS[exp] || STRICT_TARGETS.intermediate;

  // FIX v25: deload متدرج عند التعافي المنخفض فقط
  // الأصل كان يخصم -5 ثابتة عند rc<50 فقط (ضعيف). الآن: تعاف جيد (≥80) = السلوك الأصلي
  // (شحنة +5 عند >85)؛ تعاف منخفض (<80) = deload متدرج حتى -20%.
  // الأحجام تبقى ضمن حدود المستوى، والنسب (تسلسل الأولوية) لا تتغير.
  if (rc < 80) {
    const deload = Math.max(0.80, 1 + (rc - 80) * 0.005); // rc=80 x1.0 | rc=30 x0.80
    targetTotal = Math.round(targetTotal * deload);
  } else if (rc > 85) {
    targetTotal = targetTotal + 5;
  }

  // تعديل الهدف ضمن الحدود
  if (goal === 'cut')      targetTotal -= 5;
  if (goal === 'strength') targetTotal += 5;

  // clamp نهائي: لا يتجاوز حدود المستوى أبدا
  targetTotal = Math.max(budget.min, Math.min(budget.max, targetTotal));

  // توزيع 60/20/20 صارم
  const primarySets   = Math.round(targetTotal * 0.60);
  // ── Cap الأكتاف بحدود MUSCLE_SET_RANGES الأسبوعية ────────────────────────
  // الأكتاف تأخذ 20% من الإجمالي لكن بحد أقصى من العلم الرياضي:
  // مبتدئ: 6-8  |  متوسط: 9-12  |  متقدم: 12-15
  const SHOULDER_WEEKLY_CAP = { beginner: 8, intermediate: 12, advanced: 15 };
  const shoulderSetsRaw = Math.round(targetTotal * 0.20);
  const shoulderSets = Math.min(shoulderSetsRaw, SHOULDER_WEEKLY_CAP[exp] || 12);
  const accessorySets = targetTotal - primarySets - shoulderSets;

  // مجموعات لكل يوم (متوسط)
  const setsPerDay = Math.round(targetTotal / Math.max(days, 1));

  return {
    total: targetTotal,
    primary: primarySets,
    shoulders: shoulderSets,
    accessory: accessorySets,
    perDay: setsPerDay,
    budget
  };
}

/**
 * getSetsForMuscle — المصدر الوحيد للحقيقة في عدد المجموعات
 *
 * المبدأ: كل عضلة تأخذ sets من ميزانيتها الحقيقية في 60/20/20
 *
 * الخوارزمية:
 *   1. من budget احسب نصيب العضلة الأسبوعي (weeklyTarget)
 *   2. weeklyTarget ÷ freq = target per session
 *   3. clamp target per session ب MUSCLE_SET_RANGES (حدود الجلسة الواحدة)
 *
 * @param {string} muscle            - مفتاح العضلة
 * @param {string} exp               - beginner / intermediate / advanced
 * @param {number} days              - أيام التمرين في الأسبوع
 * @param {string} goal              - muscle / strength / cut / fitness
 * @param {object} budget            - نتيجة computeWeeklyBudget
 * @param {number} muscleFreqPerWeek - كم مرة هذه العضلة تدرب في الأسبوع
 */
function getSetsForMuscle(muscle, exp, days, goal, budget, muscleFreqPerWeek) {
  const b = budget || _preProcBudget || computeWeeklyBudget(exp, days, goal, state.recoveryScore || 75);

  // ── تصنيف العضلة وحصتها الأسبوعية من الميزانية ───────────────────────────
  const PRIMARY_MUSCLES   = ['chest','back','quads','hamstrings']; // 4 — 60% بالتساوي
  const SHOULDER_MUSCLES  = ['shoulders'];                          // 1 — 20% كاملا
  // ── المرحلة 2: Sub-Weighting داخل 20% المساعدة (المعيار الذهبي) ────────
  // فئة أ (70% من ال accessory): بايسبس، ترايسبس، جلوتس
  // فئة ب (30% من ال accessory): سمانة، ساعد، ترابيس — سقف مقيد!
  // النتيجة: السمانة مستحيل تأخذ أكثر من حصتها الضئيلة في أي نظام من ال 10
  const ACCESSORY_A = new Set(['biceps','triceps','glutes']); // 70% ÷ 3
  const ACCESSORY_B = new Set(['calves','forearms','traps']); // 30% ÷ 3 — محدود!

  // الحصة الأسبوعية للعضلة (sets/week)
  let weeklyTarget;
  if (PRIMARY_MUSCLES.includes(muscle)) {
    // ── وزن توزيع ال 60% (بدل القسمة بالتساوي ÷4) ──
    // الأساس العلمي:
    //  • الظهر (سحب) ≥ الصدر (دفع) — توازن قوامي يقاوم انحناء الكتفين
    //  • الكوادز ≥ الهامسترينج — الكوادز تتحمل/تحتاج حجما أكبر
    // مجموع الأوزان = 1.0 - إجمالي ال primary ثابت (الميزانية محفوظة)
    const PRIMARY_WEIGHTS = { chest: 0.23, back: 0.27, quads: 0.27, hamstrings: 0.23 };
    weeklyTarget = b.primary * (PRIMARY_WEIGHTS[muscle] != null ? PRIMARY_WEIGHTS[muscle] : 0.25);
  } else if (SHOULDER_MUSCLES.includes(muscle)) {
    weeklyTarget = b.shoulders;                // 20% للأكتاف كاملا
  } else if (ACCESSORY_A.has(muscle)) {
    weeklyTarget = (b.accessory * 0.70) / 3;  // 70% من 20% ÷ 3 (فئة أ)
  } else if (ACCESSORY_B.has(muscle)) {
    weeklyTarget = (b.accessory * 0.30) / 3;  // 30% من 20% ÷ 3 (فئة ب — سمانة محدودة!)
  } else {
    weeklyTarget = (b.accessory * 0.10);       // 10% مرن للكور وما تبقى
  }

  // ── تحويل من أسبوعي إلى جلسة واحدة ─────────────────────────────────────
  const freq = muscleFreqPerWeek || 2;
  const perSessionRaw = weeklyTarget / Math.max(freq, 1);

  // ── Clamp بحدود الجلسة الواحدة من MUSCLE_SET_RANGES ─────────────────────
  // MUSCLE_SET_RANGES هنا يعمل كسلامة فسيولوجية — ليس كمصدر الحساب
  // الحد الأعلى للجلسة الواحدة = نصف max الأسبوعي (لأن min freq = 2)
  const ranges = MUSCLE_SET_RANGES[muscle];
  const [rMin, rMax] = ranges
    ? (ranges[exp] || ranges.intermediate)
    : [3, 10];

  // الحد الأقصى للجلسة الواحدة = rMax / 2 (لأن أقل تكرار مقبول = مرتين/أسبوع)
  // هذا يمنع أن تأخذ الأكتاف 16 في جلسة واحدة رغم أن max أسبوعي = 12
  const sessionMax = Math.ceil(rMax / Math.max(freq, 1));
  // ── FIX v24: الحد الأدنى لجلسة واحدة — المتقدم لا ينزل عن 3 أبدا بلا استثناء ──
  const _advFloor = exp === 'advanced' ? 3 : 2;
  const sessionMin = Math.max(_advFloor, Math.ceil(rMin / Math.max(freq * 1.5, 1)));

  const target = Math.round(
    Math.min(sessionMax, Math.max(sessionMin, perSessionRaw))
  );

  return {
    min: sessionMin,
    max: sessionMax,
    target,
    weeklyTarget: Math.round(weeklyTarget),
    freq
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HIERARCHY ENFORCER — قواعد التوازن الهيكلي الثابتة
// المصدر: مبادئ التدريب المتكامل — مدرب دولي معتمد
//
// القاعدة 1 — الجزء العلوي:
//   الأكتاف/البايسبس/الترايسبس لا تأخذ sets أكثر من الصدر أو الظهر في أي session
//   السبب: الصدر والظهر = primary movers — العضلات الصغيرة = synergists
//   الاستثناء: أيام العزل الكاملة (brosplit ذراع/أكتاف) — لا تنطبق القاعدة
//
// القاعدة 2 — الأرجل:
//   السمانة والجلوتس لا تتساوى أو تتجاوز الكوادز أو الهامستينج في أي session
//   مقبول: كوادز = هامستينج | سمانة = جلوتس = ضامة
//   السبب: كوادز/هامستينج = primary leg movers — باقيها = accessories
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * enforceSetHierarchy — يطبق قواعد التوازن الهيكلي على مصفوفة التمارين
 *
 * يستدعى بعد بناء ال session كاملا — pass أخير للتصحيح
 *
 * @param {Array} exercises   - مصفوفة التمارين بعد pickExercises
 * @param {boolean} isIsolationDay - يوم عزل كامل (brosplit ذراع/أكتاف) - تعطيل Q1
 * @returns {Array} - نفس المصفوفة بعد تصحيح ال sets
 */
function enforceSetHierarchy(exercises, isIsolationDay = false) {
  if (!exercises || exercises.length === 0) return exercises;

  // ── حساب إجمالي sets لكل فئة في هذه الجلسة ────────────────────────────
  const setsBy = {};
  exercises.forEach(ex => {
    const g = ex.grp || '';
    setsBy[g] = (setsBy[g] || 0) + (ex.sets || 0);
  });

  // ── UPPER CEILING: أقصى sets للعضلة الأساسية في الجزء العلوي ───────────
  const UPPER_PRIMARY   = ['chest', 'back'];
  const UPPER_SECONDARY = ['shoulders', 'biceps', 'triceps', 'traps'];

  // أعلى قيمة بين الصدر والظهر في هذه الجلسة
  const maxUpperPrimary = Math.max(
    setsBy['chest'] || 0,
    setsBy['back']  || 0
  );

  // ── LOWER CEILING: أقصى sets للعضلة الرئيسية في الأرجل ─────────────────
  const LOWER_PRIMARY   = ['quads', 'hamstrings'];
  const LOWER_SECONDARY = ['calves', 'glutes', 'adductors'];

  // أعلى قيمة بين الكوادز والهامستينج
  const maxLowerPrimary = Math.max(
    setsBy['quads']      || 0,
    setsBy['hamstrings'] || 0
  );

  // ── تطبيق القواعد على كل تمرين ────────────────────────────────────────
  const result = exercises.map(ex => {
    const g = ex.grp || '';
    let newSets = ex.sets;

    // القاعدة 1: عضلات الجزء العلوي الثانوية لا تتجاوز الصدر/الظهر
    if (!isIsolationDay && UPPER_SECONDARY.includes(g) && maxUpperPrimary > 0) {
      // الحد الأقصى = sets الصدر أو الظهر (أيهما أعلى) - 1
      // يعني الثانوية دايما أقل ب 1 على الأقل من الأساسية
      const upperCeiling = Math.max(maxUpperPrimary - 1, 2); // لا ينزل عن 2
      if (newSets > upperCeiling) newSets = upperCeiling;
    }

    // القاعدة 2: السمانة/الجلوتس/الضامة لا تتساوى أو تتجاوز الكوادز/الهامستينج
    if (LOWER_SECONDARY.includes(g) && maxLowerPrimary > 0) {
      // الحد الأقصى = sets الكوادز أو الهامستينج - 1
      const lowerCeiling = Math.max(maxLowerPrimary - 1, 2); // لا ينزل عن 2
      if (newSets > lowerCeiling) newSets = lowerCeiling;
    }

    return newSets !== ex.sets ? { ...ex, sets: newSets } : ex;
  });

  return result;
}

/**
 * shouldReduceGlutes: قاعدة تصحيح جلوتس عند وجود تمارين مركبة
 * إذا كان اليوم يحتوي RDL أو سكوات عميق - خصم 30% من مجموعات عزل الجلوتس
 */
function getGlutesReductionFactor(exercises) {
  const COMPOUND_GLUTE_TRIGGERS = [
    'Romanian Deadlift','Dumbbell Romanian Deadlift','Barbell Back Squat',
    'Hack Squat Machine','Barbell Hip Thrust','Smith Machine Squat',
    'Bulgarian Split Squat','Deficit Deadlift','Sumo Deadlift'
  ];
  const hasCompound = (exercises||[]).some(ex =>
    COMPOUND_GLUTE_TRIGGERS.includes(ex.n)
  );
  return hasCompound ? 0.70 : 1.0; // خصم 30% عند وجود مركب
}

// نسخة Pre-Processor state — تحدث عند بناء الخطة
let _preProcBudget = null;

function initPreProcessor() {
  _preProcBudget = computeWeeklyBudget(
    state.exp,
    state.days,
    state.goal,
    state.recoveryScore
  );
  // تسجيل لل debug
  console.log('[PreProcessor] Weekly Budget:', _preProcBudget);
}

