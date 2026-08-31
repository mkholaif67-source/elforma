// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PLANNER ENGINE — engine/planner.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PLAN VARIETY ENGINE — محرك التنويع (بذرة)
// الهدف: ألا ينتج النظام نفس الجدول الحرفي لكل من تطابقت معطياتهم.
// الفكرة: بدل اختيار "الأعلى ترتيبا دائما" (index 0)، نختار اختيارا
// مبذرا (قابلا لإعادة الإنتاج) من بين المرشحين المتساوين في الجودة فقط:
//   • لا يختار أبدا تمرين أدنى علميا — فقط ضمن "النطاق الأعلى".
//   • البذرة ثابتة خلال الجلسة (تناسق بين الصفحات) ومتغيرة بين
//     المستخدمين والتوليدات - جدولان مختلفان لشخصين بنفس المعطيات.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let _varietySeed = 0x9e3779b9;
function _freshVarietySeed(){
  const r = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  return r === 0 ? 0x9e3779b9 : r;
}
function resetVarietySeed(seed){
  _varietySeed = (typeof seed === 'number' && seed !== 0) ? (seed >>> 0) : _freshVarietySeed();
}
// عشوائية مبذرة قابلة لإعادة الإنتاج: hash(seed + مفاتيح) - [0,1)
// مستقلة عن ترتيب الاستدعاء العام؛ تعتمد فقط على المدخلات - نتائج ثابتة لنفس البذرة.
function _varietyRand(){
  let h = _varietySeed >>> 0;
  for(let i = 0; i < arguments.length; i++){
    const s = '' + arguments[i];
    for(let j = 0; j < s.length; j++){
      h = Math.imul(h ^ s.charCodeAt(j), 0x01000193) >>> 0;
    }
    h = Math.imul(h ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  }
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function pickExercises(groups, equip, injuries, goal, time, exp, gender, dayIdx, crossDayUsed){
  // crossDayUsed: optional Set of S-tier compound names already used in earlier days this week.
  // When provided, these are deprioritised (moved to back of pool) for primary compound slots.
  const _crossUsed = crossDayUsed instanceof Set ? crossDayUsed : new Set();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HARD ANGLE LOCK (Task 4B) — session-level tracker
  // الدستور: نفس الزاوية الميكانيكية لنفس العضلة في نفس الجلسة = HARD BLOCK
  // مثال: Barbell Bench Press (mid) + Dumbbell Bench Press (mid) - مستحيل
  // يختلف عن _weeklyAngleTracker: هذا per-session (reset لكل يوم)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Map: grpName - Set of angles already used this session
  const _sessionAngles = {};

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIMILAR EXERCISE LOCK — session-level
  // القاعدة الذهبية: ممنوع تمرينان متشابهان ميكانيكيا في نفس اليوم
  // مثال: Flat Barbell Bench Press + Flat Dumbbell Bench Press = HARD BLOCK
  // يعمل كطبقة أولى (قبل ال PASS 2R) لمنع المشكلة من الأساس
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _SESSION_SIMILAR = [
    // CHEST
    ['Barbell Bench Press','Dumbbell Bench Press'],['Barbell Bench Press','Machine Chest Press'],
    ['Barbell Bench Press','Smith Machine Flat Press'],['Dumbbell Bench Press','Machine Chest Press'],
    ['Dumbbell Bench Press','Smith Machine Flat Press'],['Machine Chest Press','Smith Machine Flat Press'],
    ['Incline Barbell Press','Incline Dumbbell Press'],['Incline Barbell Press','Incline Smith Machine Press'],
    ['Incline Barbell Press','Hammer Strength Incline Press'],['Incline Dumbbell Press','Incline Smith Machine Press'],
    ['Incline Dumbbell Press','Hammer Strength Incline Press'],
    ['Pec Deck Machine','Seated Cable Fly'],['Pec Deck Machine','Dumbbell Fly'],['Seated Cable Fly','Dumbbell Fly'],
    ['Decline Barbell Press','Decline Dumbbell Press'],['Decline Barbell Press','Dips (Chest Variation)'],
    ['Decline Dumbbell Press','Dips (Chest Variation)'],
    // BACK vertical
    ['Wide Grip Lat Pulldown','Neutral Grip Lat Pulldown'],['Wide Grip Lat Pulldown','Close Grip Pulldown'],
    ['Wide Grip Lat Pulldown','Pull-Ups'],['Neutral Grip Lat Pulldown','Close Grip Pulldown'],
    ['Neutral Grip Lat Pulldown','Pull-Ups'],['Close Grip Pulldown','Pull-Ups'],
    // BACK horizontal
    ['Barbell Bent Over Row','Dumbbell Bent Over Row'],['Barbell Bent Over Row','Smith Machine Row'],
    ['Seated Cable Row','Chest Supported Row Machine'],['Seated Cable Row','Wide Grip Seated Row'],
    ['Chest Supported Row Machine','Wide Grip Seated Row'],
    ['One Arm Dumbbell Row','Meadows Row'],['One Arm Dumbbell Row','Single Arm Cable Row'],['Meadows Row','Single Arm Cable Row'],
    ['Lat Pullover Machine','Cable Pullover'],['Lat Pullover Machine','Dumbbell Pullover (Bench/Floor)'],
    ['Cable Pullover','Dumbbell Pullover (Bench/Floor)'],
    // SHOULDERS press
    ['Overhead Barbell Press','Seated DB Shoulder Press'],['Overhead Barbell Press','Machine Shoulder Press'],
    ['Overhead Barbell Press','Smith Machine Shoulder Press'],['Overhead Barbell Press','Arnold Press'],
    ['Seated DB Shoulder Press','Machine Shoulder Press'],['Seated DB Shoulder Press','Smith Machine Shoulder Press'],
    ['Seated DB Shoulder Press','Arnold Press'],
    ['Dumbbell Shoulder Press (Seated)','Seated DB Shoulder Press'],
    ['Dumbbell Shoulder Press (Seated)','Machine Shoulder Press'],
    ['Dumbbell Shoulder Press (Seated)','Overhead Barbell Press'],
    // SHOULDERS lateral
    ['Dumbbell Lateral Raise','Cable Lateral Raise'],['Dumbbell Lateral Raise','Machine Lateral Raise'],
    ['Cable Lateral Raise','Machine Lateral Raise'],
    // SHOULDERS rear
    ['Rope Face Pull','Rear Delt Machine Fly'],['Rope Face Pull','Bent Over Rear Delt Raise'],
    ['Rope Face Pull','Cable Rear Delt Fly'],['Rear Delt Machine Fly','Bent Over Rear Delt Raise'],
    ['Rear Delt Machine Fly','Cable Rear Delt Fly'],['Bent Over Rear Delt Raise','Cable Rear Delt Fly'],
    // BICEPS
    ['EZ Bar Curl','Barbell Curl'],['EZ Bar Curl','Standing Dumbbell Curl'],['Barbell Curl','Standing Dumbbell Curl'],
    ['Machine Preacher Curl','EZ Bar Preacher Curl'],['Machine Preacher Curl','Spider Curl (EZ Bar)'],
    ['EZ Bar Preacher Curl','Spider Curl (EZ Bar)'],
    ['Bayesian Cable Curl','Incline Dumbbell Curl'],['Bayesian Cable Curl','Cable Bayesian Curl'],
    ['Incline Dumbbell Curl','Cable Bayesian Curl'],
    // TRICEPS
    ['Overhead Cable Tricep Extension','Skull Crushers (EZ Bar)'],
    ['Overhead Cable Tricep Extension','Dumbbell Overhead Tricep Ext'],
    ['Skull Crushers (EZ Bar)','Dumbbell Overhead Tricep Ext'],
    ['Rope Tricep Pushdown','Bar Tricep Pushdown'],['Rope Tricep Pushdown','Cable Tricep Kickback'],
    ['Rope Tricep Pushdown','Tricep Dips Machine'],['Bar Tricep Pushdown','Cable Tricep Kickback'],
    ['Bar Tricep Pushdown','Katana Extension'],
    // TRAPS
    ['Barbell Shrugs','Dumbbell Shrugs'],['Barbell Shrugs','Smith Machine Shrugs'],
    ['Dumbbell Shrugs','Smith Machine Shrugs'],
    // LEGS
    ['Romanian Deadlift','Stiff Leg Deadlift'],['Romanian Deadlift','Dumbbell Romanian Deadlift'],
    ['Stiff Leg Deadlift','Dumbbell Romanian Deadlift'],
    ['Hack Squat Machine','Smith Machine Squat'],['Hack Squat Machine','Barbell Back Squat'],
    ['Smith Machine Squat','Barbell Back Squat'],['Pendulum Squat','Hack Squat Machine'],
    ['Pendulum Squat','Smith Machine Squat'],
    ['Lying Leg Curl Machine','Seated Leg Curl Machine'],['Lying Leg Curl Machine','Single Leg Curl Machine'],
    ['Seated Leg Curl Machine','Single Leg Curl Machine'],
    ['Leg Extension Machine','Single Leg Extension'],
    ['Barbell Hip Thrust','Smith Machine Hip Thrust'],
  ];
  // بناء session-level lookup
  const _sessionSimilarLookup = {};
  _SESSION_SIMILAR.forEach(([a, b]) => {
    if (!_sessionSimilarLookup[a]) _sessionSimilarLookup[a] = new Set();
    if (!_sessionSimilarLookup[b]) _sessionSimilarLookup[b] = new Set();
    _sessionSimilarLookup[a].add(b);
    _sessionSimilarLookup[b].add(a);
  });

  // MOVEMENT-PATTERN IDENTITY CLUSTERS (root-cause dedup):
  // قاعدة البيانات تخزن نفس الحركة بأسماء مختلفة عبر أكثر من sub-group.
  // كل تمرينين داخل نفس ال cluster = نفس النمط الحركي - واحد فقط في الجلسة.
  // تستبعد الحركات الأحادية وLeg Press عمدا حتى لا تجوع خانة لا بديل لها.
  const _SIMILAR_CLUSTERS = [
    ['Romanian Deadlift','Stiff Leg Deadlift','Dumbbell Romanian Deadlift',
     'Romanian Deadlift (RDL)','Stiff-Leg Deadlift','Good Morning'],
    ['Barbell Back Squat','Hack Squat Machine','Smith Machine Squat',
     'Pendulum Squat','Front Barbell Squat'],
    ['Barbell Hip Thrust','Smith Machine Hip Thrust'],
  ];
  _SIMILAR_CLUSTERS.forEach(cluster => {
    for (let _i = 0; _i < cluster.length; _i++) {
      for (let _j = _i + 1; _j < cluster.length; _j++) {
        const a = cluster[_i], b = cluster[_j];
        if (!_sessionSimilarLookup[a]) _sessionSimilarLookup[a] = new Set();
        if (!_sessionSimilarLookup[b]) _sessionSimilarLookup[b] = new Set();
        _sessionSimilarLookup[a].add(b);
        _sessionSimilarLookup[b].add(a);
      }
    }
  });



  // ── 1. STRICT VOLUME BOUNDS BY GENDER + EXPERIENCE ───────────────────
  // SCI-FIX-5: تصحيح منطق الجنس في الحجم — Ralston et al. 2017 + Schoenfeld 2020
  // الكود القديم: النساء يأخذن حجما أقل ب 2-3 مجموعة — خطأ علمي
  // الأبحاث: النساء يتحملن نفس حجم المجموعات لكنهن يتعافين أسرع بين المجموعات
  // (fiber type II أقل + استجابة cortisol أخفض بعد التمرين)
  // الفرق الحقيقي: راحة أقصر بين المجموعات، لا حجم كلي أقل
  // لذلك: نوحد MIN/MAX_SETS بين الجنسين — الفارق يبقى فقط في MIN_EX (تنوع التمارين)
  const isFemale = gender === 'female';
  const isBeginner     = exp === 'beginner';
  const isIntermediate = exp === 'intermediate';
  // Exercise count:
  // مبتدئ: 4-5 (أنثى) / 5-6 (ذكر)
  // متوسط: 5-7 | متقدم: لا أقل من 6 ولا أكثر من 7
  let MIN_EX = isBeginner ? 5 : 6; // ABS-FLOOR-5: لا يقل أي يوم عن 5 تمارين لأي مستوى
  let MAX_EX = isBeginner ? (isFemale?5:6) : 7; // متوسط ومتقدم: 7 كحد أقصى مطلق
  // Sets per session: مشتقة من PreProcessor Budget (الدستور)
  const _ppBudget = _preProcBudget || computeWeeklyBudget(exp, state.days||3, goal, state.recoveryScore||75);
  const _dailySetsTarget = Math.round(_ppBudget.total / Math.max(state.days||3, 1));
  // هامش ±20% حول الهدف اليومي
  let MIN_SETS = Math.max(
    Math.round(_dailySetsTarget * 0.80),
    isBeginner ? 10 : (isIntermediate ? 13 : 18)
  );
  // PATCH-GYM-SETS: سقف صارم — 21 مجموعة/يوم، 24 ليوم الأرجل الفردي
  // القاعدة: 7 تمارين × 3 مجموعات = 21 | أرجل فردي: 8 × 3 = 24
  const _DAILY_HARD_CAP     = 21; // كل يوم عدا أرجل فردي
  const _LEGS_SINGLE_CAP    = 24; // يوم الأرجل الفردي فقط
  // _hardCapToday يحسب بعد تعريف _isLegsSession أسفل — placeholder مؤقت
  let _hardCapToday = _DAILY_HARD_CAP; // سيحدث بعد حساب _isLegsSession

  let MAX_SETS = Math.min(
    Math.round(_dailySetsTarget * 1.20),
    _hardCapToday   // السقف الصارم يتحكم — لا يتجاوزه أي حالة
  );

  // V3-04: Time Tiers
  const sessionTime = time || 60;
  const isShortSession  = sessionTime < 40;
  const isMediumSession = sessionTime >= 40 && sessionTime < 65;
  const isLongSession   = sessionTime >= 65;

  // ── تعديل MAX_EX حسب وقت الجلسة بشكل واقعي ─────────────────────────────
  // كل تمرين يحتاج ~10-12 دقيقة (4 sets × 45-60 ث عمل + راحة)
  // 45 دقيقة - 4-5 تمارين | 60 - 5-6 | 75 - 6-7 | 90+ - 7-8
  if(sessionTime <= 45){
    // جلسة قصيرة: مبتدئ 5 تمارين | متوسط/متقدم: لا ينزل عن 6 (ADVANCED_MIN_RULE)
    // SCI-FIX-ADV: المتقدم حتى في الجلسة القصيرة يحتاج 6+ تمارين للحفاظ على الحجم الأسبوعي
    MAX_EX = Math.max(MIN_EX, isBeginner ? 5 : (isIntermediate ? 6 : 6));
    MIN_SETS = Math.max(MIN_SETS - 2, isBeginner ? 8 : 10);
    MAX_SETS = Math.min(MAX_SETS - 2, isBeginner ? 14 : 18);
  } else if(sessionTime <= 60){
    // جلسة 60 دقيقة: مبتدئ 5-6 | متوسط 6-7 | متقدم 6-7 (لا ينزل عن 6 — ADVANCED_MIN_RULE)
    MAX_EX = isBeginner ? 6 : 7;
    // ADVANCED_MIN_RULE_60: متوسط ومتقدم لا ينزلان عن 6 تمارين في جلسة 60 دقيقة
    if(!isBeginner) MIN_EX = Math.max(MIN_EX, 6);
    MIN_SETS += 1;
    MAX_SETS = Math.min(MAX_SETS + 2, isBeginner ? 18 : (isIntermediate ? 22 : 26));
  } else {
    // جلسة 75 دقيقة: مبتدئ 6-7 | متوسط 6-8 | متقدم 6-8 (لا ينزل عن 6 — ADVANCED_MIN_RULE)
    MAX_EX = isBeginner ? 7 : 8;
    // ADVANCED_MIN_RULE_75: متوسط ومتقدم لا ينزلان عن 6 تمارين في جلسة 75 دقيقة
    if(!isBeginner) MIN_EX = Math.max(MIN_EX, 6);
    MIN_SETS += 2;
    MAX_SETS = Math.min(MAX_SETS + 4, isBeginner ? 20 : (isIntermediate ? 24 : 28));
  }
  // ضمان نهائي مطلق — ADVANCED_MIN_RULE (يسري على كل مدة الجلسة بدون استثناء)
  // متوسط ومتقدم: لا يقل عن 6 تمارين في أي جلسة | مبتدئ: لا يقل عن MIN_EX المحسوب
  if(!isBeginner) MIN_EX = Math.max(MIN_EX, 6);
  // يوم الأرجل له cap خاص — مش بنعدله هنا (بيتعمل بعدين)
  MAX_EX = Math.max(MAX_EX, MIN_EX);

  // RULE: Core تمارين ممنوعة من الجدول الأساسي — تظهر فقط في ال Modules (إضافات اختيارية)
  // الجدول الأساسي يحتوي فقط على: صدر · ظهر · أرجل · أذرع (بايسبس + ترايسبس + ساعد + ترابيس)
  const groupNames = groups.map(([g])=>g);
  // FIX: تعريف "يوم الدفع" على مستوى الدالة — كان يستخدم في فلتر الاختيار (أسفل)
  // قبل تعريفه الأصلي داخل كتلة ال padding، مما يسبب ReferenceError عند تقييم
  // تمارين الكتف الخلفي (push_banned) في أيام الدفع.
  const _dayGrpSet = new Set(groupNames);
  const _isPushDayToday = _dayGrpSet.has('chest') && !_dayGrpSet.has('back') && !_dayGrpSet.has('quads');
  const coreAlreadyInGroups = false;
  const coreSlotNeeded = false;

  // ── قواعد يوم الأرجل الخاصة ──────────────────────────────────────────────
  // يوم الأرجل: 6 groups أساسية (كوادز×2 + هامستينج + جلوتس + سمانة + ضامة) - max 8
  const _isLegsSession = groupNames.some(g => g === 'quads' || g === 'hamstrings');
  if (_isLegsSession) {
    // FIX v23: احسب تكرار الأرجل من ال split template (state.splitDays) لا من state.plan
    // state.plan يملأ يوم يوم فيعطي نتائج خاطئة للأيام الأولى
    const _splitTemplate = state.splitDays || state.plan || [];
    const _legsFreqInWeek = _splitTemplate.filter(d =>
      !d.isRest && (d.groups||[]).some(([g]) => g === 'quads' || g === 'hamstrings')
    ).length;
    // إذا ال template فاضي (لسه ما اتبنيش)، نعتمد على dayIdx لتقدير التكرار من ال split key
    const _splitKey = state.recommendedSplit || state.selectedSplit || '';
    const _legsOncePerWeekSplits = new Set(['ppl','ppl_3','hybrid','brosplit','anterior_posterior']);
    const _isSingleLegsDay = _legsFreqInWeek <= 1
      ? (_legsFreqInWeek === 0 ? _legsOncePerWeekSplits.has(_splitKey) : true)
      : false;
    // يوم الأرجل: 6 groups أساسية (كوادز×2 + هامستينج + جلوتس + سمانة + ضامة) - max 8
    MAX_EX = 8;
    MIN_EX = Math.max(MIN_EX, isBeginner ? 5 : 6);
  }

  // effectiveMAX_EX يحسب بعد تعديل يوم الأرجل
  const effectiveMAX_EX = MAX_EX;

  // PATCH-GYM-SETS: الآن نعرف _isLegsSession - نحدث _hardCapToday و MAX_SETS
  {
    const _splitKey2 = state.recommendedSplit || state.selectedSplit || '';
    const _singleLegsSplits2 = new Set(['ppl','ppl_3','hybrid','brosplit','anterior_posterior']);
    const _splitTemplate2 = state.splitDays || state.plan || [];
    const _legsFreq2 = _splitTemplate2.filter(d =>
      !d.isRest && (d.groups||[]).some(([g]) => g === 'quads' || g === 'hamstrings')
    ).length;
    const _isSingleLegsDay2 = _isLegsSession && (
      _legsFreq2 <= 1 ? (_legsFreq2 === 0 ? _singleLegsSplits2.has(_splitKey2) : true) : false
    );
    _hardCapToday = _isSingleLegsDay2 ? _LEGS_SINGLE_CAP : _DAILY_HARD_CAP;
    // إعادة ضبط MAX_SETS بناء على السقف الصحيح
    MAX_SETS = Math.min(MAX_SETS, _hardCapToday);
  }

  // ── 2. SETS/REPS/REST BY GOAL ──────────────────────────────────────────
  // Each exercise gets a base sets value; will be redistributed at end
  const baseSets = goal==='strength' ? 4 : goal==='cut' ? 3 : 3;
  // FIX-8: Senior modifier — age 55+ shifts rep ranges up (joint safety, less tendon elasticity)
  // Per ACSM Position Stand on Exercise for Older Adults (2009, updated 2018)
  const isSenior = (state.age||0) >= 55;
  // PATCH-GYM-1: سقف تكرارات — الحد الأقصى المطلق = 20 تكرار لأي تمرين
  const repsMap  = {
    strength: { primary: isSenior?'6-8':'4-6',   secondary: isSenior?'8-10':'5-8'   },
    muscle:   { primary: isSenior?'10-15':'8-12', secondary: isSenior?'12-15':'10-15'},
    cut:      { primary: isSenior?'15-20':'12-15',secondary: isSenior?'12-15':'12-15'},
    fitness:  { primary: isSenior?'12-15':'10-15',secondary: isSenior?'12-15':'10-15'}
  };
  // SCI-FIX-5 (تكملة): راحة أقصر للمرأة — Ansdell et al. 2019
  // النساء يتعافين عضليا أسرع بين المجموعات بسبب ألياف type I أعلى نسبة
  // يعطي نفس stimulus مع كفاءة زمنية أعلى
  const restMap  = {
    strength: {
      primary:   isFemale ? '2-3 دقائق'    : '3-4 دقائق',
      secondary: isFemale ? '75-90 ثانية'  : '90-120 ثانية'
    },
    muscle: {
      primary:   isSenior ? '2 دقيقة'     : isFemale ? '75 ثانية'    : '90 ثانية',
      secondary: isSenior ? '90 ثانية'    : isFemale ? '50-60 ثانية' : '60-90 ثانية'
    },
    cut: {
      primary:   isFemale ? '35-45 ثانية' : '45-60 ثانية',
      secondary: isFemale ? '25-35 ثانية' : '30-45 ثانية'
    },
    fitness: {
      primary:   isFemale ? '50 ثانية'    : '60 ثانية',
      secondary: isFemale ? '35-45 ثانية' : '45-60 ثانية'
    }
  };
  const R = repsMap[goal]  || repsMap.fitness;
  const _T_base = restMap[goal] || restMap.fitness;

  // ── تعديل الراحة حسب وقت الجلسة — الوقت المتاح يتحكم في مدة الراحة ─────
  // الجلسة القصيرة (≤45): قلل الراحة 25-30% للحفاظ على الكثافة ضمن الوقت
  // الجلسة الطويلة (≥75): زد الراحة 20-25% للسماح بتعاف أفضل وأوزان أثقل
  function _scaleRest(restStr, factor){
    if(!restStr || factor === 1) return restStr;
    // استخرج الأرقام وعدلها
    const _restSnap = [30,45,60,75,90,105,120,150,180];
    return restStr.replace(/(\d+)/g, n => {
      const v = Math.round(+n * factor);
      if (v < 20) return v; // أرقام الدقائق (2-3) تترك كما هي
      return _restSnap.reduce((b, s) => Math.abs(s - v) < Math.abs(b - v) ? s : b, _restSnap[0]);
    });
  }
  const _timeFactor = sessionTime <= 45 ? 0.72
                    : sessionTime <= 60 ? 1.0
                    : 1.2; // 75

  const T = {
    primary:   _scaleRest(_T_base.primary,   _timeFactor),
    secondary: _scaleRest(_T_base.secondary, _timeFactor),
  };

  // ── 3. INJURY - EXCLUDE SPECIFIC EXERCISES ────────────────────────────
  // Uses the safe_injuries field on each exercise for fine-grained control.
  // An exercise is EXCLUDED if any current injury is NOT in its safe_injuries list.
  // Exception: if safe_injuries includes '<injury>_mild', it means allowed with caution.
  const activeInjuries = (injuries||[]).filter(i=>i!=='none');

  // FIX-9: BMI-based exercise restriction (obesity = high joint stress)
  // Per ACSM Clinical Exercise Physiology guidelines
  const userBMI = state.bmi || 22;
  const isObese        = userBMI >= 30;
  const isSevereObese  = userBMI >= 35;
  // Use module-level constants (UPGRADE-1: defined once at load, not per call)
  const OBESE_RESTRICT        = _OBESE_RESTRICT;
  const SEVERE_OBESE_RESTRICT = _SEVERE_OBESE_RESTRICT;
  function isBMIRestricted(ex){
    if(isSevereObese && SEVERE_OBESE_RESTRICT.has(ex.n)) return true;
    if(isObese && OBESE_RESTRICT.has(ex.n)) return true;
    return false;
  }

  // FIX-B: dangerMap معرف مرة واحدة خارج isExcluded — لا ينشأ من جديد في كل استدعاء
  // كان ينشأ داخل حلقة per-exercise مما يسبب ضغطا على GC وإبطاء في الجلسات الكبيرة
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
              // FIX-2: Nordic Hamstring Curl removed — no spinal compression, safe for back injuries
    knee:    ['Barbell Back Squat','Hack Squat Machine','Smith Machine Squat','Pendulum Squat',
              'Front Barbell Squat','Bulgarian Split Squat','Walking Lunges (Barbell)',
              'Step-Up with Barbell','Leg Press (45°)','Bulgarian Split Squat (Chair)',
              'Dumbbell Squat','Resistance Band Squat',
              'Sissy Squat','Lunge (Dumbbell)','Lunge (Bodyweight)'],
              // FIX-3: Goblet Squat & Step-Up removed from knee block — both are used in knee rehab protocols
              // Sissy Squat stays blocked (extreme patellar tendon stress)
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

  function isExcluded(ex){
    if(!activeInjuries.length) return false;
    const safeList = ex.safe_injuries || [];
    for(const inj of activeInjuries){
      // EXACT match ONLY — 'shoulder_mild' does NOT count as safe for active 'shoulder' injury
      if(safeList.includes(inj)) continue;
      // Exercise not explicitly safe - check DANGER_MAP (defined once, not per-call)
      if((DANGER_MAP[inj]||[]).includes(ex.n)) return true;
      // Shoulder tag fallback: block exercises carrying shoulder_press fatigue tag
      if(inj==='shoulder'){
        const fatTags=(typeof FATIGUE_TAGS!=='undefined'&&FATIGUE_TAGS[ex.n])||[];
        if(fatTags.includes('shoulder_press')) return true;
      }
    }
    return false;
  }

  // Determine which muscle groups are fully blocked (no exercises at all)
  const fullyBlocked = new Set();
  // For severe injuries, certain groups are completely off
  if(activeInjuries.includes('shoulder')) fullyBlocked.add('traps'); // optional — keep but filter
  if(activeInjuries.includes('wrist'))    fullyBlocked.add('forearms');
  // FIX-D: إصابة العارضة (elbow) تحجب تمارين الساعد — elbow flexors مجهدة في Wrist Curl
  if(activeInjuries.includes('elbow'))    fullyBlocked.add('forearms');

  // ── 4. GOAL BONUS — prioritise exercises with goal_bonus match ─────────
  function goalScore(ex){
    if(!ex.goal_bonus) return 0;
    return ex.goal_bonus.includes(goal) ? 2 : 0;
  }

  // ── 5. WEAKNESS BONUS — exercises for weak muscle groups get priority ──
  const weakList = (state.weak||[]).map(w=>w.toLowerCase());
  function weakScore(ex){
    if(!weakList.length) return 0;
    const mu = (ex.mu||'').toLowerCase();
    return weakList.some(w=>mu.includes(w)) ? 1 : 0;
  }

  // ── 6. BUILD EXERCISE POOL ─────────────────────────────────────────────
  const isHome = equip === 'home';
  const ACTIVEDB = isHome ? HOME_DB : GYM_DB;
  const result   = [];
  const usedNames = new Set();

  // PATCH 3: Strict home-mode exercise blocklist — gym machines forbidden
  const GYM_MACHINE_NAMES = new Set([
    'Hack Squat Machine','Leg Press (45°)','Smith Machine Squat','Smith Machine Flat Press',
    'Smith Machine Shoulder Press','Smith Machine Hip Thrust','Smith Machine Shrugs',
    'Pendulum Squat','Machine Chest Press','Pec Deck Machine','Machine Shoulder Press',
    'Leg Extension Machine',
    'Lying Leg Curl Machine','Rope Tricep Pushdown','Bar Tricep Pushdown',
    'Tricep Dips Machine','Lat Pullover Machine','Wide Grip Lat Pulldown',
    'Neutral Grip Lat Pulldown','Close Grip Pulldown','Seated Cable Row',
    'Cable Lateral Raise','Cable Pullover','Cable Upper Chest Crossover',
    'Seated Cable Fly','Cable Crunch','Cable Woodchop','Plank on Cable',
    'Overhead Cable Tricep Extension','Overhead Cable Tricep Ext','Cable Tricep Kickback',
    'Rope Face Pull','Rope Face Pull (High)','Low to High Cable Fly','High to Low Cable Fly',
    'Bayesian Cable Curl','Cable Bayesian Curl','Cable Overhead Curl','Cable Pull Through',
    'Cable Chest Press','Machine Preacher Curl',
    'Rear Delt Machine Fly','Standing Calf Raise Machine','Seated Calf Raise Machine',
    'Donkey Calf Raise','T Bar Row','Chest Supported Row Machine','Lat Pullover Machine',
    'Russian Twist Machine','Incline Smith Machine Press','Decline Barbell Press'
  ]);
  function isGymMachineBlocked(ex) {
    if(!isHome) return false;
    // PRIMARY: use equipment field when present ('gym' = gym-only, 'home' = safe at home)
    if(ex.equipment === 'gym') return true;
    if(ex.equipment === 'home') return false;
    // FALLBACK: name-based blocklist for exercises without equipment field
    return GYM_MACHINE_NAMES.has(ex.n);
  }

  // ── LEGS ROUND-ROBIN: Quad - Ham - Calves - Glutes - Adductors دورة كاملة قبل التكرار ──
  // الفكرة: بدل ما ناخد 2 كواد متلاحقين، نوزع ب round-robin عبر العضلات الخمسة
  // النتيجة: [Q1, H1, C1, Glutes1, A1, Q2, H2, ...] بدل [Q1, Q2, H1, Glutes1, C1, A1]
  const _isLegsRoundRobin = _isLegsSession;
  let _rrGroups = groups;
  if(_isLegsRoundRobin){
    // الترتيب بيعتمد على ما هو موجود في groups — يغطي كل sub-keys ممكنة
    const _LEG_ORDER = [
      ['quads',      'dominant'],
      ['quads',      'isolation'],
      ['hamstrings', 'dominant'],
      ['hamstrings', 'isolation'],
      ['calves',     'gastrocnemius'],
      ['calves',     'soleus'],
      ['hamstrings', 'glutes'],
      ['glutes',     'all'],
      ['adductors',  'all'],
    ];
    const _grpCounts = {};
    for(const [g,s] of groups){
      const k = g+'|'+(s||'*');
      _grpCounts[k] = (_grpCounts[k]||0) + 1;
    }
    const _remaining = Object.assign({}, _grpCounts);
    const _rrResult  = [];
    // Round-robin صحيح: كل لفة تاخد تمرين واحد فقط من كل عضلة بالترتيب
    let _lapHadEntry = true;
    while(_lapHadEntry){
      _lapHadEntry = false;
      for(const [g,s] of _LEG_ORDER){
        const k = g+'|'+(s||'*');
        if((_remaining[k]||0) > 0){
          _rrResult.push([g,s]);
          _remaining[k]--;
          _lapHadEntry = true;
          // لا break هنا — كل عضلة في ال _LEG_ORDER تاخد واحد في نفس اللفة
        }
      }
    }
    // أي groups مش في _LEG_ORDER تضاف في الآخر
    for(const [g,s] of groups){
      const k = g+'|'+(s||'*');
      if((_remaining[k]||0) > 0){ _rrResult.push([g,s]); _remaining[k]--; }
    }
    if(_rrResult.length > 0) _rrGroups = _rrResult;
  }

  // BREADTH-FIRST MUSCLE COVERAGE (non-legs overflow only):
  // عند تجاوز السقف (مثلا Upper ب 8 خانات وMAX=7) القص من النهاية يحرم
  // آخر عضلة (غالبا الذراعين). نعيد ترتيب ال groups breadth-first بحسب العضلة
  // (أول خانة لكل عضلة قبل أي خانة ثانية) فيقتطع التكرار بدل عضلة كاملة.
  // يطبق فقط عند الفائض ولغير أيام الأرجل؛ الترتيب النهائي للعرض يتكفل به sequenceSession.
  // FIX v57: تطبيق نفس ال breadth-first على الأيام المختلطة (أرجل + علوي) أيضا.
  // السبب: في يوم زي Full Body / Anterior / Limbs، ال legs round-robin بيملأ
  // خانات الأرجل الأول ويسيب الذراع/السمانة آخر القايمة فيقصهم الكاب.
  // الحل: نعمل breadth-first (تمرين واحد لكل عضلة قبل أي تكرار) فيقتطع التكرار
  // بدل عضلة كاملة. أيام الأرجل الصافية (كلها أرجل) لا تتأثر إطلاقا.
  const _LEGSET57 = new Set(['quads','hamstrings','glutes','calves','adductors']);
  const _hasNonLeg57 = _rrGroups.some(([g]) => !_LEGSET57.has(g));
  if((!_isLegsRoundRobin || _hasNonLeg57) && _rrGroups.length > effectiveMAX_EX){
    const _occ = {};
    const _tiers = [];
    for(const [g,s] of _rrGroups){
      const t = (_occ[g] = (_occ[g]||0));
      (_tiers[t] = _tiers[t] || []).push([g,s]);
      _occ[g]++;
    }
    const _bf = [];
    for(const tier of _tiers){ for(const gs of tier) _bf.push(gs); }
    if(_bf.length === _rrGroups.length) _rrGroups = _bf;
  }

  // Track used muscle groups to prevent same-group isolation doubles
  const usedMuscleGroups = new Set();

  for(const [grpName, subKey] of _rrGroups){
    if(result.length >= effectiveMAX_EX) break;

    // Skip fully blocked groups
    if(fullyBlocked.has(grpName)) continue;

    // DUPLICATION GUARD: يمنع نفس ال slot بالضبط من التكرار
    // العضلات الأساسية (back/chest/quads/hamstrings) + عضلات الرأسين (biceps/triceps/shoulders/traps)
    // كلها تسمح بالتكرار لأن لكل sub-key هدف عضلي مختلف
    const _multiSubMuscles = ['back','chest','quads','hamstrings','biceps','triceps','shoulders','traps','calves'];
    const groupKey = _multiSubMuscles.includes(grpName) ? `${grpName}:${subKey}` : grpName;
    // Round-robin legs: السماح بجولة ثانية لنفس العضلة (تمرين ثاني بعد كل العضلات تاخد الأول)
    // في ال round-robin: نحسب كم مرة هذا ال groupKey اتضاف بالفعل
    if(_isLegsRoundRobin){
      // نعد كم تمرين لنفس العضلة في result
      const _alreadyCount = result.filter(e => (e.grp+':'+(e.sub||'*')) === groupKey || (!_multiSubMuscles.includes(e.grp) && e.grp === grpName)).length;
      // نعد كم مرة هذا ال groupKey موجود في _rrGroups الأصلية
      const _totalSlots = _rrGroups.filter(([g,s]) => (_multiSubMuscles.includes(g) ? g+':'+(s||'*') : g) === groupKey).length;
      // لو خدنا كل slots المخصصة لهذه العضلة، تجاهلها
      if(_alreadyCount >= _totalSlots) continue;
    } else {
      if(usedMuscleGroups.has(groupKey)) continue;
    }
    usedMuscleGroups.add(groupKey);

    const grpData = ACTIVEDB[grpName];
    if(!grpData) continue;
    let pool = [...(grpData[subKey] || grpData.all || [])];
    if(!pool.length) continue;

    // FIX-5: Sissy Squat blocked for beginners (extreme patellar stress, contraindicated)
    // UPGRADE-2: Short session (<45 min) - compounds only (no isolation exercises)
    let safePool = pool.filter(e => {
      if(isExcluded(e)) return false;
      if(usedNames.has(e.n)) return false;
      if(isGymMachineBlocked(e)) return false;
      if(isBeginner && e.n === 'Sissy Squat') return false;
      if(isBMIRestricted(e)) return false;
      // PUSH_BANNED: تمارين الدلتا الخلفي (Rope Face Pull وغيرها) ممنوعة في Push days
      // push_banned:true في الداتا = يوم Pull/Rear فقط
      if(e.push_banned && _isPushDayToday) return false;
      // Short session: skip pure isolation (tier A only) — keep S-tier and compounds
      if(isShortSession && e.tier !== 'S' && (e.n||'').match(/curl|fly|raise|extension|crunch|kickback/i)) return false;
      // ── HARD ANGLE LOCK (Task 4B) ───────────────────────────────────────
      // إذا نفس الزاوية لنفس العضلة استخدمت هذه الجلسة - HARD BLOCK تام
      // لا soft penalty — لا يختار مطلقا حتى لو كان S-tier
      const _exAngle = ANGLE_MAP[e.n];
      if (_exAngle && _sessionAngles[grpName] && _sessionAngles[grpName].has(_exAngle)) return false;
      // ── SIMILAR EXERCISE LOCK ────────────────────────────────────────────
      // إذا تمرين مشابه ميكانيكيا موجود بالفعل في الجلسة - HARD BLOCK
      if (_sessionSimilarLookup[e.n]) {
        for (const sim of _sessionSimilarLookup[e.n]) {
          if (usedNames.has(sim)) return false;
        }
      }
      return true;
    });

    // ── EXERCISE INTELLIGENCE PATCH 1: Injury safe-alternative fallback ─
    // If primary subKey pool is empty after injury filtering,
    // try sibling subkeys of the same muscle group before giving up.
    // This prevents empty days while keeping dangerous exercises excluded.
    // NEVER forces dangerous exercises — only looks at same-group alternatives.
    if(!safePool.length && activeInjuries.length > 0){
      let siblingKeys = Object.keys(grpData || {}).filter(k => k !== subKey);
      // FIX v28: امنع تقاطع عائلة الدفع/السحب في fallback الأكتاف.
      // دلتا خلفي (rear) = سحب فقط؛ press/lateral = دفع. التقاطع كان يضع
      // Machine Shoulder Press في يوم Pull عند إفراغ مجموعة الدلتا الخلفي بالإصابات.
      if(grpName === 'shoulders'){
        const _PUSH_SUBS = new Set(['press','lateral']);
        if(subKey === 'rear') siblingKeys = siblingKeys.filter(k => !_PUSH_SUBS.has(k));
        else if(_PUSH_SUBS.has(subKey)) siblingKeys = siblingKeys.filter(k => k !== 'rear');
      }
      for(const sk of siblingKeys){
        const altPool = [...(grpData[sk] || [])].filter(e =>
          !isExcluded(e) && !usedNames.has(e.n) && !isGymMachineBlocked(e) &&
          !(isBeginner && e.n === 'Sissy Squat') && !isBMIRestricted(e)
        );
        if(altPool.length){ safePool = altPool; break; }
      }
    }

    // If all exercises excluded by injury, skip this group entirely (don't force dangerous ones)
    if(!safePool.length) continue;

    // ── COMPOUND-ANCHOR LOCK (coach fix) ────────────────────────────────
    // The FIRST exercise of any non-arm day MUST be a compound movement, so the
    // session is always founded on a real press / pull / squat for the day's
    // primary muscle — never an isolation (fly / raise / crossover). Variety is
    // preserved: it just picks among the COMPOUND options instead of all options.
    if (result.length === 0 &&
        ['chest','back','quads','hamstrings','glutes','shoulders'].includes(grpName)) {
      const _isCompoundEx = (e) => {
        if (getExerciseRank({ ...e, grp: grpName, sub: subKey }) <= 2) return true;
        const _pat = MOVEMENT_PATTERN[e.n] || '';
        return !!_pat && _pat !== 'isolation';
      };
      const _compoundPool = safePool.filter(_isCompoundEx);
      if (_compoundPool.length) safePool = _compoundPool;
    }

    // Sort: S-tier first, then goal bonus, then weakness bonus
    // FIX 4: cross-day compounds are deprioritised (score -5) to favour fresh alternatives
    // ANGLE LAYER: angle bonus (+3) applied to accessory slots only (result.length >= 2)
    //              to encourage weekly angle coverage without disrupting primary compound picks
    const isAccessorySlot = result.length >= 2;
    safePool.sort((a,b)=>{
      const tierA = a.tier==='S' ? 3 : 1;
      const tierB = b.tier==='S' ? 3 : 1;
      const crossA = _crossUsed.has(a.n) ? -5 : 0;
      const crossB = _crossUsed.has(b.n) ? -5 : 0;
      const angA = isAccessorySlot ? angleBonus(a, grpName) : 0;
      const angB = isAccessorySlot ? angleBonus(b, grpName) : 0;
      // BUG-1 FIX: ممنوع تكرار نفس التمرين في نفس اليوم — عقوبة -1000
      const dupA = usedNames.has(a.n) ? -1000 : 0;
      const dupB = usedNames.has(b.n) ? -1000 : 0;
      return (tierB + goalScore(b) + weakScore(b) + crossB + angB + dupB) - (tierA + goalScore(a) + weakScore(a) + crossA + angA + dupA);
    });

    // ── VARIETY SELECTION — اختيار مبذر ضمن "النطاق الأعلى" ─────────────
    // بدل اختيار index 0 دائما (نفس الجدول لكل الناس)، نحدد مجموعة المرشحين
    // المتساوين في الجودة (درجتهم ضمن هامش ضيق من الأفضل) ثم نختار منهم اختيارا
    // مبذرا. النتيجة: تنوع حقيقي بين المستخدمين/التوليدات دون التضحية بالعلم.
    //   • المركبات الأساسية: هامش 1 (نحافظ على أفضلية الحركة المركبة الثقيلة).
    //   • المساعدات/العزل: هامش 2 (تنوع أوسع في الزوايا والتمارين).
    const _scoreOf = (e) => {
      const _t = e.tier === 'S' ? 3 : 1;
      const _c = _crossUsed.has(e.n) ? -5 : 0;
      const _a = isAccessorySlot ? angleBonus(e, grpName) : 0;
      const _d = usedNames.has(e.n) ? -1000 : 0; // BUG-1 FIX: no dup in same day
      return _t + goalScore(e) + weakScore(e) + _c + _a + _d;
    };
    const _band = isAccessorySlot ? 2 : 1;
    const _best = _scoreOf(safePool[0]);
    let _topCount = 1;
    for(let _i = 1; _i < safePool.length; _i++){
      // safePool مرتب تنازليا - نتوقف عند أول مرشح خارج النطاق
      if(_best - _scoreOf(safePool[_i]) <= _band) _topCount++; else break;
    }
    const _vr = _varietyRand(dayIdx, grpName, subKey || '*', result.length, _topCount);
    const idx = _topCount > 1 ? Math.floor(_vr * _topCount) : 0;
    const picked = safePool[idx];
    if(!picked) continue;

    usedNames.add(picked.n);
    // ANGLE LAYER: record angle used for this muscle group this week
    recordAngle(picked, grpName);
    // ── HARD ANGLE LOCK: record session angle ──────────────────────────
    // يسجل فور الاختيار — يمنع أي تمرين بنفس الزاوية في بقية الجلسة
    const _pickedAngle = ANGLE_MAP[picked.n];
    if (_pickedAngle) {
      if (!_sessionAngles[grpName]) _sessionAngles[grpName] = new Set();
      _sessionAngles[grpName].add(_pickedAngle);
    }

    // ── المرحلة 3: تحجيم Sets بالميزانية الحقيقية للعضلة ───────────────────
    // عضلات فئة ب (سمانة/ساعد/ترابيس) لها سقف مضغوط من computeWeeklyBudget
    // وصول السمانة لنفس مجموعات الصدر مستحيل رياضيا هنا
    const _budget = _preProcBudget || computeWeeklyBudget(exp, state.days||3, goal, state.recoveryScore||75);
    const _schedule = state.plan || [];
    const _muscleFreq = Math.max(1,
      _schedule.filter(d => (d.groups||[]).some(([g]) => g === grpName)).length
    );
    const muscleTarget = getSetsForMuscle(grpName, exp, state.days||3, goal, _budget, _muscleFreq);
    const sameMuscleGroups = groups.filter(([g]) => g === grpName).length || 1;
    const setsPerEntry = Math.round(muscleTarget.target / sameMuscleGroups);

    // ── HARD CAP: 4 sets/تمرين مطلق (مبتدئ: 3) ─────────────────────────────
    const _ACCESSORY_B_MUSCLES = new Set(['calves','forearms','traps']);
    const _expCap   = exp === 'beginner' ? 3 : 4;
    // FIX v27: السمانة في يوم الأرجل = 3-4 sets (مش 2) — عضلة أرجل أساسية
    const _isAdvancedExp = !isBeginner && !isIntermediate;
    const _isCalvesInLegsDay = grpName === 'calves' && _isLegsSession;
    const _perExCap = (_ACCESSORY_B_MUSCLES.has(grpName) && !_isCalvesInLegsDay)
      ? (_isAdvancedExp ? 3 : 2)
      : _expCap;  // calves في يوم الأرجل = نفس cap العضلات الأساسية
    const _maxExtraForMuscle = _ACCESSORY_B_MUSCLES.has(grpName) ? 1 : 2;
    const _neededEx = Math.min(Math.ceil(setsPerEntry / _perExCap), 1 + _maxExtraForMuscle);
    const _rawExSets = Math.min(_perExCap, Math.max(_isAdvancedExp ? 3 : 2, Math.ceil(setsPerEntry / _neededEx)));
    // أي تمرين للمتقدم = min 3 بلا استثناء
    // السمانة في يوم الأرجل: min 3 مثل باقي عضلات الأرجل
    const _calvesLegsMin = _isLegsSession && grpName === 'calves';
    const _absMin = _isAdvancedExp ? 3 : ((_isLegsSession && (!_ACCESSORY_B_MUSCLES.has(grpName) || _calvesLegsMin)) ? 3 : 2);
    const exSets = Math.max(_rawExSets, _absMin);

    // isPrimary: أول مجموعتين من اليوم هي الحركات المركبة الأساسية
    const isPrimary = result.length < 2;
    const exReps = isPrimary ? R.primary   : R.secondary;
    const exRest = isPrimary ? T.primary   : T.secondary;
    const isBlockedGrp = activeInjuries.some(inj=>{
      const bmap={shoulder:['shoulders'],knee:['quads','hamstrings'],back:['back'],elbow:['biceps','triceps'],neck:['traps']};
      return (bmap[inj]||[]).includes(grpName);
    });

    result.push({
      ...picked,
      grp: grpName, sub: subKey,
      sets: exSets, reps: exReps, rest: exRest,
      blocked: isBlockedGrp,
      vid: getValidVid(picked.vid),
      _src:'MAIN'
    });

    // ── تمارين إضافية لنفس العضلة لو ال volume يحتاج أكثر من تمرين ──────────
    // Round-robin legs: لا توسيع مباشر — التمرين التاني هييجي في الجولة الثانية من ال _rrGroups
    if (_neededEx > 1 && !_isLegsRoundRobin) {
      for (let _xi = 1; _xi < _neededEx; _xi++) {
        if (result.length >= MAX_EX) break;
        const _extraPool = [...safePool].filter(e => {
          if (usedNames.has(e.n)) return false;
          // SIMILAR EXERCISE LOCK (root-cause): امنع نمطا حركيا مكررا (RDL + Stiff-Leg)
          // في نفس اليوم — نفس القفل المطبق في safePool يطبق هنا أيضا.
          if (_sessionSimilarLookup[e.n]) {
            for (const sim of _sessionSimilarLookup[e.n]) { if (usedNames.has(sim)) return false; }
          }
          return true;
        });
        if (!_extraPool.length) break;
        // اختر تمرين بزاوية مختلفة عن المستخدم
        const _extraEx = _extraPool.find(e => {
          const ang = ANGLE_MAP[e.n];
          return !ang || !(_sessionAngles[grpName]?.has(ang));
        }) || _extraPool[0];
        if (!_extraEx) break;
        usedNames.add(_extraEx.n);
        const _ang2 = ANGLE_MAP[_extraEx.n];
        if (_ang2) { if (!_sessionAngles[grpName]) _sessionAngles[grpName] = new Set(); _sessionAngles[grpName].add(_ang2); }
        recordAngle(_extraEx, grpName);
        result.push({
          ..._extraEx,
          grp: grpName, sub: subKey,
          sets: (_isLegsSession && !_ACCESSORY_B_MUSCLES.has(grpName)) ? Math.max(exSets, 3) : exSets,
          reps: R.secondary, rest: T.secondary,
          blocked: isBlockedGrp,
          vid: getValidVid(_extraEx.vid),
          _extraForVolume: true,
          _src:'EXTRA'
        });
      }
    }
  }

  // ── 6b. SHOULDER ORDER ENFORCEMENT ───────────────────────────────────────
  // القاعدة: في أي يوم — أكتاف جانبي (lateral) قبل أكتاف أمامي (press) قبل خلفي (rear)
  // الأولوية: lateral - press - rear
  // السبب: الجانبي العضلة الأصغر تستهدف أولا وهي طازجة — الضغط compound ثانيا
  {
    const _shOrder = { lateral: 0, press: 1, rear: 2 };
    const _shIdxs  = result.map((e,i) => e.grp === 'shoulders' ? i : -1).filter(i => i >= 0);
    if (_shIdxs.length >= 2) {
      _shIdxs.sort((a, b) => (_shOrder[result[a].sub]??9) - (_shOrder[result[b].sub]??9));
      // أخذ ال shoulder exercises وإعادة ترتيبها في نفس المواقع
      const _shExs = _shIdxs.map(i => result[i]);
      _shIdxs.forEach((origIdx, rank) => { result[origIdx] = _shExs[rank]; });
    }
  }

  // ── 7. PAD IF UNDER MIN_EX ─────────────────────────────────────────────
  // لا نتخطى ال padding أبدا لو result أقل من MIN_EX (6 للمتوسط/المتقدم)
  // نمنع padding في Push/Pull فقط لو ال result وصل لل MIN_EX فعلا
  const _isPushOrPull = (dayGrpNames => dayGrpNames.has('chest') || dayGrpNames.has('back'))(new Set(groups.map(([g])=>g)));
  const _skipPadding  = _isPushOrPull && result.length >= MIN_EX;

  if(result.length < MIN_EX && !_skipPadding){
    // تحديد العضلات المستخدمة بالفعل في اليوم
    const usedGrps = new Set(result.map(e => e.grp));
    // تحديد context اليوم (push/pull/legs/upper/lower) من ال groups
    const dayGrpNames = new Set(groups.map(([g]) => g));
    const isPullDay = dayGrpNames.has('back') && !dayGrpNames.has('chest') && !dayGrpNames.has('quads');
    const isPushDay = dayGrpNames.has('chest') && !dayGrpNames.has('back') && !dayGrpNames.has('quads');
    const isLegsDay = dayGrpNames.has('quads') || dayGrpNames.has('hamstrings');

    // بناء pool ال padding بناء على context اليوم
    let padPools = [];
    if(isPullDay){
      // Pull day: فقط عضلات السحب — بايسبس، ترابيس، ساعد، دلتا خلفي
      padPools = [
        ...(ACTIVEDB.biceps?.short || []),
        ...(ACTIVEDB.biceps?.long || []),
        ...(ACTIVEDB.traps?.all || []),
        ...(ACTIVEDB.forearms?.all || []),
        ...(ACTIVEDB.shoulders?.rear || []),  // دلتا خلفي مقبول في Pull
      ];
    } else if(isPushDay){
      // Push day: فقط عضلات الدفع — ترايسبس، دلتا أمامي/جانبي
      padPools = [
        ...(ACTIVEDB.triceps?.lateral || []),
        ...(ACTIVEDB.triceps?.long || []),
        ...(ACTIVEDB.shoulders?.lateral || []),
        ...(ACTIVEDB.shoulders?.press || []),
      ];
    } else if(isLegsDay){
      // Legs day: سمانة، جلوتس عزل
      padPools = [
        ...(([...(ACTIVEDB.calves?.gastrocnemius||[]),...(ACTIVEDB.calves?.soleus||[])]) || []),
        ...(ACTIVEDB.hamstrings?.glutes || []),
      ];
    } else {
      // Upper/Lower/Specialist: بناء ال pool من عضلات اليوم نفسه + محايدة (calves/traps/forearms)
      // المنطق: biceps/triceps يضافون فقط لو اليوم عنده chest أو back (يوم upper)
      // يوم أكتاف فقط - traps + calves فقط | يوم upper - biceps+triceps مقبول
      const _padOwnGrps = new Set(groups.map(([g])=>g));
      const _padHasUpper = _padOwnGrps.has('chest') || _padOwnGrps.has('back') || _padOwnGrps.has('lats');
      const _padHasArms  = _padOwnGrps.has('biceps') || _padOwnGrps.has('triceps');
      padPools = [
        ...(_padHasUpper ? [...(ACTIVEDB.biceps?.short||[]),...(ACTIVEDB.biceps?.long||[])] : []),
        ...(_padHasUpper ? [...(ACTIVEDB.triceps?.lateral||[]),...(ACTIVEDB.triceps?.long||[])] : []),
        ...(_padHasArms  ? [...(ACTIVEDB.shoulders?.lateral||[]),...(ACTIVEDB.shoulders?.press||[])] : []),
        ...(_padOwnGrps.has('shoulders') ? [...(ACTIVEDB.shoulders?.lateral||[]),...(ACTIVEDB.shoulders?.press||[]),...(ACTIVEDB.shoulders?.rear||[]),...(ACTIVEDB.traps?.all||[])] : []),
        ...(ACTIVEDB.traps?.all || []),
        ...(ACTIVEDB.calves?.gastrocnemius || []),
        ...(ACTIVEDB.calves?.soleus || []),
        ...(ACTIVEDB.forearms?.all || []),
      ];
    }

    for(const ex of padPools){
      if(result.length >= MIN_EX) break;
      if(usedNames.has(ex.n)) continue;          // لا تكرار اسم
      if(isExcluded(ex)) continue;
      if(isGymMachineBlocked(ex)) continue;
      if(isBMIRestricted(ex)) continue;

      // تحديد ال grp الحقيقي للتمرين من اسمه (بدل 'accessory')
      const exGrp = ex.grp || (
        (ACTIVEDB.biceps?.short||[]).concat(ACTIVEDB.biceps?.long||[]).some(e=>e.n===ex.n) ? 'biceps' :
        (ACTIVEDB.triceps?.lateral||[]).concat(ACTIVEDB.triceps?.long||[]).some(e=>e.n===ex.n) ? 'triceps' :
        (ACTIVEDB.shoulders?.lateral||[]).concat(ACTIVEDB.shoulders?.rear||[]).some(e=>e.n===ex.n) ? 'shoulders' :
        (ACTIVEDB.traps?.all||[]).some(e=>e.n===ex.n) ? 'traps' :
        (ACTIVEDB.forearms?.all||[]).some(e=>e.n===ex.n) ? 'forearms' :
        'accessory'
      );

      // لا تكرار نفس ال muscle group في ال padding
      if(usedGrps.has(exGrp)) continue;

      // سقف صارم: max تمرين واحد padding لكل عضلة صغيرة (بايسبس/ترايسبس/ترابيس)
      const _smallMuscles = new Set(['biceps','triceps','traps','forearms']);
      const alreadyHasSmall = result.filter(e => _smallMuscles.has(e.grp)).length;
      if(_smallMuscles.has(exGrp) && alreadyHasSmall >= 3) continue; // max 3 تمارين صغيرة في الجلسة

      usedNames.add(ex.n);
      usedGrps.add(exGrp);
      result.push({
        ...ex, grp: exGrp, sub:'all',
        sets: 3, reps: R.secondary, rest: T.secondary,
        blocked: false, vid: getValidVid(ex.vid),
        _padded:true, _src:'PAD'
      });
    }
  }

  // ── 7b. POST-PADDING DEDUP GUARD ──────────────────────────────────────
  // يضمن عدم وجود أكثر من الحد المسموح لكل عضلة صغيرة في الجلسة
  // سبب المشكلة: ال padding كان يضيف بايسبس متعددة لأن grp كان 'accessory'
  const _grpCaps = { biceps: 2, triceps: 2, traps: 1, forearms: 1, shoulders: 3 };
  const _grpCount = {};
  const _deduped = [];
  for(const ex of result){
    const g = ex.grp;
    _grpCount[g] = (_grpCount[g] || 0) + 1;
    if(_grpCaps[g] && _grpCount[g] > _grpCaps[g]) continue; // تجاوز الحد - تجاهل
    _deduped.push(ex);
  }
  // إعادة تعيين result بعد الحذف
  result.length = 0;
  _deduped.forEach(e => result.push(e));

  // ── 7c. FINAL MIN_EX ENFORCEMENT ────────────────────────────────────────────────────
  // للمتوسط والمتقدم: لو result لسه أقل من 6 بعد كل ال filtering وال dedup
  // نكمله من ACTIVEDB مع حارس ال archetype (لا نضيف عضلة تضاد اليوم)
  if(result.length < MIN_EX){
    // ── ARCHETYPE GUARD 7c: نفس منطق 7a لكن يطبق على ال MINEX fallback
    const _dayGrpSet7c = new Set(groups.map(([g])=>g));
    const _isPush7c = _dayGrpSet7c.has('chest') && !_dayGrpSet7c.has('back') && !_dayGrpSet7c.has('quads');
    const _isPull7c = _dayGrpSet7c.has('back') && !_dayGrpSet7c.has('chest') && !_dayGrpSet7c.has('quads');
    const _isLegs7c = _dayGrpSet7c.has('quads') || _dayGrpSet7c.has('hamstrings');
    const _allExercises = Object.values(ACTIVEDB).flatMap(grp =>
      Object.values(grp).flatMap(arr => arr)
    );
    const _usedNamesSet = new Set(result.map(e => e.n));
    const _usedGrpSet   = new Set(result.map(e => e.grp));
    for(const ex of _allExercises){
      if(result.length >= MIN_EX) break;
      if(_usedNamesSet.has(ex.n)) continue;
      if(isExcluded(ex)) continue;
      if(isGymMachineBlocked(ex)) continue;
      if(isBMIRestricted(ex)) continue;
      // حارس التضاد: لا نضيف عضلة تنتمي لحركة معاكسة ليوم ال session
      const _g7c = ex.grp || '', _s7c = ex.sub || '';
      const _backPull7c = _g7c === 'back' && _s7c !== 'lower';
      const _isLeg7c = ['quads','hamstrings','glutes','adductors'].includes(_g7c);
      if(_isPush7c && (_g7c==='biceps' || _backPull7c || _isLeg7c)) continue; // لا سحب/أرجل على Push
      if(_isPull7c && (_g7c==='chest'  || _g7c==='triceps' || _isLeg7c))  continue; // لا دفع/أرجل على Pull
      if(_isLegs7c && (_g7c==='chest'  || _backPull7c || _g7c==='biceps' || _g7c==='triceps' || _g7c==='forearms' || _g7c==='shoulders' || _g7c==='traps')) continue; // لا جذع على Legs
      if(_usedGrpSet.has(ex.grp || ex.n)) continue; // لا تكرار muscle group
      _usedNamesSet.add(ex.n);
      _usedGrpSet.add(ex.grp || ex.n);
      result.push({
        ...ex, grp: ex.grp || 'accessory', sub: 'all',
        sets: 3, reps: R.secondary, rest: T.secondary,
        blocked: false, vid: getValidVid(ex.vid),
        _padded:true, _src:'MINEX'
      });
    }
  }

  // ── 8. STRICT TRIM TO effectiveMAX_EX (core slot already reserved) ────
  // FIX v23 — ABSOLUTE GUARD: apply final cap rules before slicing
  // القاعدة المطلقة: أي يوم لا يتجاوز 7 تمارين مهما حصل
  // استثناء وحيد: يوم الأرجل الفردي (مرة/أسبوع) - max 8
  let _finalCap = effectiveMAX_EX;
  if (_isLegsSession) {
    // يوم الأرجل: 6 groups أساسية - 8 تمارين max
    _finalCap = 8;
  } else {
    // كل يوم تاني: 7 مهما حصل
    _finalCap = Math.min(_finalCap, 7);
  }
  const trimmed = result.slice(0, _finalCap);
  const numEx   = trimmed.length;
  if(!numEx) return trimmed;

  // ── 9. STRICT VOLUME ENFORCEMENT: distribute sets within [MIN_SETS, MAX_SETS]
  // PATCH-GYM-SETS: التوزيع الذكي ل 21 مجموعة (أو 24 أرجل فردي) على عدد التمارين
  // القاعدة: نوزع السقف اليومي بالتساوي على عدد التمارين
  // 7 تمارين - 3×7=21  | 6 تمارين - 3×6=18 + نضيف 3 مجموعات لل compound = 21 

  // First pass: calculate natural total
  let naturalTotal = trimmed.reduce((s,e)=>s+e.sets, 0);

  // توزيع ذكي: نوزع السقف الصارم على عدد التمارين
  const _setsTarget = _hardCapToday; // 21 أو 24
  const _basePerEx  = Math.floor(_setsTarget / numEx); // 3 ل 7 تمارين، 3-4 ل 6
  const _remainder  = _setsTarget - (_basePerEx * numEx); // المجموعات الزائدة توزع على ال compound

  // أعط كل تمرين حصته الأساسية
  for(let i = 0; i < trimmed.length; i++){
    const bonusSet = i < _remainder ? 1 : 0; // ال compound الأولى تاخد المجموعات الزائدة
    trimmed[i] = {...trimmed[i], sets: _basePerEx + bonusSet};
  }
  // تحقق أن المجموع = السقف الصارم
  naturalTotal = trimmed.reduce((s,e)=>s+e.sets, 0);

  // If under minimum (جلسة قصيرة جدا أو مبتدئ): keep as is — لا نجبر المبتدئ على 21
  if(naturalTotal < MIN_SETS && !isBeginner){
    // للمتوسط والمتقدم: لا نسمح بأقل من MIN_SETS
    let deficit = MIN_SETS - naturalTotal;
    const _expCapE = exp === 'beginner' ? 3 : 4;
    for(let i=0; i<trimmed.length && deficit>0; i++){
      const canAdd = Math.min(1, _expCapE - trimmed[i].sets);
      const add = Math.min(deficit, Math.max(0, canAdd));
      trimmed[i] = {...trimmed[i], sets: trimmed[i].sets + add};
      deficit -= add;
    }
  }

  // ال clamp النهائي الصارم — لا يتجاوز السقف اليومي أبدا
  naturalTotal = trimmed.reduce((s,e)=>s+e.sets, 0);
  if(naturalTotal > _hardCapToday){
    let surplus = naturalTotal - _hardCapToday;
    for(let i=trimmed.length-1; i>=0 && surplus>0; i--){
      const canRemove = Math.max(0, trimmed[i].sets - getMinSetsForExp(exp, trimmed[i].grp || ''));
      const remove = Math.min(surplus, canRemove);
      trimmed[i] = {...trimmed[i], sets: trimmed[i].sets - remove};
      surplus -= remove;
    }
  }

  // Final validation — hard clamp
  const finalTotal = trimmed.reduce((s,e)=>s+e.sets, 0);
  if(!(finalTotal >= MIN_SETS && finalTotal <= MAX_SETS + 3)){
    // UPGRADE-5: Structured warn with full context for faster debugging
    console.warn('[pickExercises] Volume OOB:', {
      finalTotal, MIN_SETS, MAX_SETS,
      exp, gender, goal, numEx,
      exercises: trimmed.map(e=>e.n+':'+e.sets+'sets')
    });
  }

  // UPGRADE-6: Weak-point bonus set — exercises targeting weak muscles get +1 set
  // Applied AFTER volume enforcement, within MAX_SETS+2 buffer (weak targets justify extra volume)
  // Per Israetel MEV/MRV: lagging muscles benefit from slightly above MEV volume
  const weakGroups = new Set((state.weak || []).map(w => w.toLowerCase()));
  if(weakGroups.size > 0){
    let weakBudget = 2; // max 2 extra sets total for weak muscles per session
    for(let i = 0; i < trimmed.length && weakBudget > 0; i++){
      const ex = trimmed[i];
      const isWeakTarget = weakGroups.has(ex.grp) ||
        (ex.mu && [...weakGroups].some(w => (ex.mu||'').toLowerCase().includes(w)));
      if(isWeakTarget && ex.sets < 6){
        trimmed[i] = {...ex, sets: ex.sets + 1, _weakBonus: true};
        weakBudget--;
      }
    }
  }

  // ── COMPENSATORY VOLUME: إصابة الركبة - ارفع Hip Thrust تعويضا ─────
  // إذا منع تمرين Squat / Leg Press (knee injury) وكان اليوم يحتوي على
  // Hip Thrust أو Glute أي بديل، نرفع عدد مجموعاته بمجموعتين تعويضا
  // عن الحجم المفقود من الكوادز. هذا يحافظ على stimulus جلسة الأرجل.
  if(activeInjuries.includes('knee')){
    const kneeBlockedGroups = ['quads'];
    const hasKneeBlockedGroup = groups.some(([g])=>kneeBlockedGroups.includes(g));
    if(hasKneeBlockedGroup){
      const hipThrust = trimmed.find(e=>
        e.grp === 'hamstrings' && (
          e.n.toLowerCase().includes('hip thrust') ||
          e.n.toLowerCase().includes('cable pull through') ||
          e.n.toLowerCase().includes('glute')
        )
      );
      if(hipThrust && hipThrust.sets < 6){
        hipThrust.sets = Math.min(hipThrust.sets + 2, 6);
        hipThrust._compensatory = true; // flag for UI display
      }
    }
  }

  // ── FIX-10 DISABLED: Core ممنوع من الجدول الأساسي بقرار تصميمي ──────────
  // الكور متاح فقط من خلال ال Modules (وحدات اختيارية) — لا يحقن هنا أبدا
  // ──────────────────────────────────────────────────────────────────────

  // ── CALVES GUARANTEED INJECTION (v27) ─────────────────────────────────
  // السمانة عضلة أرجل أساسية — يجب أن تكون في كل يوم أرجل منفصل
  // المشكلة: لو ال extra exercises للكوادز/هامستينج ملت ال result > 7 - السمانة بتتحذف بعد slice
  // الحل: نشيل السمانة من ال template groups ونحقنها بالإجبار بعد ال slice (مثل الضامة)
  const _isLegDayForCalves = groups.some(([g]) => g === 'quads' || g === 'hamstrings');
  const _hasPushPullForCalves = groups.some(([g]) => ['chest','back','shoulders','biceps','triceps'].includes(g));
  const _isDedicatedLegsDayCalves = _isLegDayForCalves && !_hasPushPullForCalves;
  const _calvesAlreadyIn = trimmed.some(e => e.grp === 'calves');
  // FIX v57: علم السمانة المختارة طبيعيا كمحمية حتى لا تقص في طبقات ال count-cap اللاحقة (PASS 2L)
  if(_calvesAlreadyIn){ trimmed.forEach(e => { if(e.grp === 'calves') e._protected = true; }); }
  if((_isDedicatedLegsDayCalves || _isLegDayForCalves) && !_calvesAlreadyIn && !isShortSession){
    const _calvesDB = isHome ? (HOME_DB.calves?.all || []) : (GYM_DB.calves?.gastrocnemius || GYM_DB.calves?.all || []);
    const _calvesPool = _calvesDB.filter(e =>
      !usedNames.has(e.n) && !isExcluded(e) && !isBMIRestricted(e)
    );
    const _calvesPick = _calvesPool[0];
    if(_calvesPick){
      // لو trimmed.length == _finalCap - نستبدل آخر تمرين غير أساسي (مش كوادز/هامستينج/جلوتس)
      // لو فيه مساحة - نضيف مباشرة
      const _calveSets = (exp === 'beginner') ? 3 : 3;
      if(trimmed.length < MAX_EX + 1){
        trimmed.push({
          ..._calvesPick, grp:'calves', sub:'gastrocnemius',
          sets: _calveSets, reps: R.secondary, rest: T.secondary,
          blocked: false, vid: getValidVid(_calvesPick.vid),
          _calvesInjected: true, _protected: true
        });
      } else {
        // استبدل آخر تمرين ليس من ال 5 العضلات الأساسية للأرجل
        const _coreLegs = new Set(['quads','hamstrings','glutes','calves','adductors']);
        const _replIdx = [...trimmed].reverse()
          .findIndex(e => !_coreLegs.has(e.grp) && !e._adductorBonus && !e._protected);
        if(_replIdx >= 0){
          const _actualIdx = trimmed.length - 1 - _replIdx;
          trimmed[_actualIdx] = {
            ..._calvesPick, grp:'calves', sub:'gastrocnemius',
            sets: _calveSets, reps: R.secondary, rest: T.secondary,
            blocked: false, vid: getValidVid(_calvesPick.vid),
            _calvesInjected: true, _protected: true
          };
        }
      }
      usedNames.add(_calvesPick.n);
    }
  }

  // V3-07: Adductor Injection — أيام الأرجل المنفصلة (dedicated legs day)
  // العضلة مهملة تماما وتمثل 20-25% من كتلة الساق — تحمي الركبة وتستقر الحوض
  // FIX v26: الشرط الصحيح هو "هل في يوم أرجل منفصل؟" — مش "كام يوم في الأسبوع؟"
  // يوم الأرجل المنفصل = اليوم ده فيه كوادز أو هامستينج فقط (بدون صدر/ظهر/كتف)
  const isLegDay = groups.some(([g]) => g === 'quads' || g === 'hamstrings');
  const _hasPushPullGroups = groups.some(([g]) => ['chest','back','shoulders','biceps','triceps'].includes(g));
  const _isDedicatedLegsDay = isLegDay && !_hasPushPullGroups;
  if(!isHome && _isDedicatedLegsDay && !isShortSession){
    const adductorPool = (GYM_DB.adductors?.all || []).filter(e =>
      !usedNames.has(e.n) && !isExcluded(e) && !isBMIRestricted(e)
    );
    const adductorPick = adductorPool[0];
    const _adductorsAlreadyIn = trimmed.some(e => e.grp === 'adductors');
    if(adductorPick && !_adductorsAlreadyIn){
      const _adDef={...adductorPick, grp:'adductors', sub:'all', sets:3, reps:R.secondary, rest:T.secondary, blocked:false, vid:getValidVid(adductorPick.vid), _optional:true, _adductorBonus:true, _protected:true};
      if(trimmed.length < MAX_EX + 1){
        trimmed.push(_adDef);
        usedNames.add(adductorPick.n);
      } else {
        const _coreLegsA = new Set(['quads','hamstrings','glutes','calves','adductors']);
        const _replIdxA = [...trimmed].reverse().findIndex(e => !_coreLegsA.has(e.grp) && !e._calvesInjected && !e._protected);
        if(_replIdxA >= 0){
          trimmed[trimmed.length - 1 - _replIdxA] = _adDef;
          usedNames.add(adductorPick.n);
        }
      }
    }
  }

  // ── 7d. DEDICATED LEG DAY FLOOR — ضمان حد أدنى ليوم الأرجل المنفصل ──
  // المتطلب: لو الأرجل بتتمرن لوحدها (يوم أرجل خالص بدون صدر/ظهر/أكتاف/ذراع)
  // — لا يقل عن MIN_EX تمارين (6 للمتوسط/المتقدم)، وكلها تمارين أرجل.
  // نمنع تسرب تمارين الجذع (تحذف لاحقا في repairPlan فينزل العدد تحت 6).
  {
    const _legGrpSet7d = new Set(groups.map(([g]) => g));
    const _legDayOnly7d = (_legGrpSet7d.has('quads') || _legGrpSet7d.has('hamstrings'))
      && !['chest','back','shoulders','biceps','triceps','traps','forearms'].some(g => _legGrpSet7d.has(g));
    if(_legDayOnly7d){
      const _LEGOK7d = new Set(['quads','hamstrings','glutes','calves','adductors','core','abs']);
      // (1) أزل أي تمرين يخالف يوم الأرجل (نفس منطق isArchetypeViolation: يسمح بأسفل الظهر فقط)
      for(let _i = trimmed.length - 1; _i >= 0; _i--){
        const _g = trimmed[_i].grp;
        const _keep7d = _LEGOK7d.has(_g) || (_g === 'back' && trimmed[_i].sub === 'lower');
        if(!_keep7d) trimmed.splice(_i, 1);
      }
      // (2) لو أقل من MIN_EX — املأ من بنك تمارين الأرجل فقط (يسمح بثاني/ثالث تمرين للعضلة)
      if(trimmed.length < MIN_EX){
        const _usedNm7d = new Set(trimmed.map(e => e.n));
        const _legPool7d = [
          ...((ACTIVEDB.quads && ACTIVEDB.quads.dominant) || []),
          ...((ACTIVEDB.hamstrings && ACTIVEDB.hamstrings.dominant) || []),
          ...((ACTIVEDB.quads && ACTIVEDB.quads.isolation) || []),
          ...((ACTIVEDB.hamstrings && ACTIVEDB.hamstrings.isolation) || []),
          ...((ACTIVEDB.hamstrings && ACTIVEDB.hamstrings.glutes) || []),
          ...((ACTIVEDB.adductors && ACTIVEDB.adductors.all) || []),
          ...((ACTIVEDB.calves && ACTIVEDB.calves.gastrocnemius) || []),
          ...((ACTIVEDB.calves && ACTIVEDB.calves.soleus) || []),
        ];
        const _LEG_GRPS7d = ['quads','hamstrings','glutes','calves','adductors'];
        const _grpOf7d = (ex) => {
          for(const _gk of _LEG_GRPS7d){
            const _sub = ACTIVEDB[_gk] || {};
            for(const _arr of Object.values(_sub)){
              if(Array.isArray(_arr) && _arr.some(e => e.n === ex.n)) return _gk;
            }
          }
          return ex.grp || 'quads';
        };
        const _legCap7d = { quads:3, hamstrings:3, glutes:1, adductors:1, calves:1 };
        const _legCount7d = {};
        trimmed.forEach(e => { _legCount7d[e.grp] = (_legCount7d[e.grp]||0)+1; });
        for(const _ex of _legPool7d){
          if(trimmed.length >= MIN_EX) break;
          if(_usedNm7d.has(_ex.n)) continue;
          if(isExcluded(_ex)) continue;
          if(isGymMachineBlocked(_ex)) continue;
          if(isBMIRestricted(_ex)) continue;
          const _g7d = _grpOf7d(_ex);
          if((_legCount7d[_g7d]||0) >= (_legCap7d[_g7d]||2)) continue;
          if(_sessionSimilarLookup[_ex.n] && trimmed.some(e => _sessionSimilarLookup[_ex.n].has(e.n))) continue;
          _usedNm7d.add(_ex.n);
          _legCount7d[_g7d] = (_legCount7d[_g7d]||0)+1;
          trimmed.push({
            ..._ex, grp:_g7d, sub: _ex.sub || 'all',
            sets: 3, reps: R.secondary, rest: T.secondary,
            blocked:false, vid: getValidVid(_ex.vid),
            _padded:true, _src:'LEGFLOOR'
          });
        }
      }
    }
  }

  // ── HIERARCHY ENFORCER — القواعد الهيكلية الثابتة (آخر pass) ────────────
  // القاعدة 1: في الجزء العلوي — أكتاف/بايسبس/ترايسبس < صدر أو ظهر دائما
  // القاعدة 2: في الأرجل — سمانة/جلوتس/ضامة < كوادز أو هامستينج دائما
  // استثناء: أيام عزل brosplit (يوم الذراع / يوم الأكتاف المستقل)
  const _isIsolationUpperDay = (
    groups.every(([g]) => ['biceps','triceps','shoulders','traps','forearms'].includes(g))
  );
  const hierarchyFixed = enforceSetHierarchy(trimmed, _isIsolationUpperDay);

  return hierarchyFixed;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ██████╗ ██╗███████╗████████╗██████╗ ██╗██████╗ ██╗   ██╗████████╗██╗ ██████╗ ███╗   ██╗
// INTELLIGENT EXERCISE DISTRIBUTION LAYER  —  v1.0
//
// This layer operates AFTER pickExercises() selects the exercise pool.
// It does NOT modify exercise selection logic, DB access, or volume math.
// It ONLY improves:
//   1. Intra-session sequencing (compound - hypertrophy - isolation - finisher)
//   2. Fatigue tag detection & overlap control
//   3. Weak point priority placement
//   4. Weekly fatigue spacing validation
//   5. Movement pattern balance check
//   6. Program quality scoring + rebuild trigger (distribution only)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── FATIGUE TAG MAP ────────────────────────────────────────────────────
// Each exercise name is tagged with the fatigue systems it stresses.
// lower_back · axial · shoulder_press · elbow_flex · elbow_ext
// grip · cns · posterior · anterior · quad · ham
const FATIGUE_TAGS = {
  // Heavy axial / lower back
  'Barbell Back Squat':          ['cns','axial','quad','lower_back'],
  'Front Barbell Squat':         ['cns','axial','quad','lower_back'],
  'Romanian Deadlift':           ['cns','axial','lower_back','ham','grip'],
  'Stiff Leg Deadlift':          ['axial','lower_back','ham','grip'],
  'Barbell Bent Over Row':       ['cns','axial','lower_back','grip'],
  'Meadows Row':                 ['axial','lower_back','grip'],
  'Barbell Hip Thrust':          ['lower_back','ham','posterior'],
  'Dumbbell Romanian Deadlift':  ['lower_back','ham'],
  'Walking Lunges (Barbell)':    ['axial','lower_back','quad'],
  // Pressing (shoulder stress)
  'Overhead Barbell Press':      ['cns','shoulder_press','elbow_ext','axial'],
  'Machine Shoulder Press':      ['shoulder_press','elbow_ext'],
  'Seated DB Shoulder Press':    ['shoulder_press','elbow_ext'],
  'Arnold Press':                ['shoulder_press','elbow_ext'],
  'Smith Machine Shoulder Press':['shoulder_press','elbow_ext'],
  'Barbell Bench Press':         ['shoulder_press','elbow_ext','anterior'],
  'Incline Barbell Press':       ['shoulder_press','elbow_ext','anterior'],
  'Incline Dumbbell Press':      ['shoulder_press','elbow_ext','anterior'],
  'Dumbbell Bench Press':        ['shoulder_press','elbow_ext','anterior'],
  'Dumbbell Floor Press':        ['shoulder_press','elbow_ext','anterior'],
  'Close Grip Bench Press':      ['shoulder_press','elbow_ext','anterior'],
  'Dips (Chest Variation)':      ['shoulder_press','elbow_ext','anterior'],
  'Dips Between Chairs':         ['shoulder_press','elbow_ext','anterior'],
  'Skull Crushers (EZ Bar)':     ['elbow_ext','lower_back'],
  'Overhead Cable Tricep Extension':['elbow_ext','shoulder_press'],
  'DB Overhead Tricep Extension':['elbow_ext','shoulder_press'],
  // Pulling / elbow flexion
  'Pull-Ups':                    ['cns','grip','elbow_flex','posterior'],
  'Wide Grip Lat Pulldown':      ['grip','elbow_flex','posterior'],
  'Neutral Grip Lat Pulldown':   ['grip','elbow_flex','posterior'],
  'Close Grip Pulldown':         ['grip','elbow_flex','posterior'],
  'Seated Cable Row':            ['elbow_flex','posterior','lower_back'],
  'Chest Supported Row Machine':         ['elbow_flex','posterior'],
  'One Arm Dumbbell Row':        ['elbow_flex','posterior','lower_back'],
  'Dumbbell Bent Over Row':      ['elbow_flex','posterior','lower_back'],
  'T Bar Row':                   ['cns','elbow_flex','posterior','lower_back','axial'],
  'EZ Bar Curl':                 ['elbow_flex'],
  'Hammer Curl':                 ['elbow_flex','grip'],
  'Barbell Curl':                ['elbow_flex'],
  'Machine Preacher Curl':       ['elbow_flex'],
  'EZ Bar Preacher Curl':        ['elbow_flex'],
  'Bayesian Cable Curl':         ['elbow_flex'],
  'Incline Dumbbell Curl':       ['elbow_flex','shoulder_press'],
  // Legs
  'Hack Squat Machine':          ['quad','anterior'],
  'Smith Machine Squat':         ['quad','anterior'],
  'Leg Press (45°)':             ['quad','anterior'],
  'Pendulum Squat':              ['quad','anterior'],
  'Leg Extension Machine':       ['quad'],
  'Lying Leg Curl Machine':      ['ham','posterior'],
  'Bulgarian Split Squat':       ['quad','ham','lower_back'],
  'Bulgarian Split Squat (Chair)':['quad','ham'],
  'Goblet Squat (Dumbbell)':     ['quad','anterior'],
  'Cable Pull Through':          ['ham','posterior'],
  'Standing Calf Raise (Machine)':['calves'],
  // Grip-heavy
  'Farmer Walk (Plates)':        ['grip','cns','lower_back'],
  'Barbell Shrugs':              ['grip','axial','lower_back'],
  'Dead Hangs':                  ['grip'],
};

// ── MOVEMENT PATTERN CLASSIFIER ───────────────────────────────────────
// Assigns a movement pattern to every exercise for balance checking
const MOVEMENT_PATTERN = {
  // Horizontal push
  'Barbell Bench Press':'h_push','Incline Barbell Press':'h_push',
  'Incline Dumbbell Press':'h_push','Dumbbell Bench Press':'h_push',
  'Machine Chest Press':'h_push','Dumbbell Floor Press':'h_push',
  'Smith Machine Flat Press':'h_push','Cable Chest Press':'h_push',
  // Vertical push
  'Overhead Barbell Press':'v_push','Machine Shoulder Press':'v_push',
  'Seated DB Shoulder Press':'v_push','Arnold Press':'v_push',
  'Smith Machine Shoulder Press':'v_push','Pike Push-Up':'v_push',
  'Dumbbell Shoulder Press (Seated)':'v_push',
  // Horizontal pull
  'Barbell Bent Over Row':'h_pull','Seated Cable Row':'h_pull',
  'Chest Supported Row Machine':'h_pull','One Arm Dumbbell Row':'h_pull',
  'Dumbbell Bent Over Row':'h_pull','Meadows Row':'h_pull',
  'T Bar Row':'h_pull','Wide Grip Seated Row':'h_pull',
  'Dumbbell Pullover (Bench/Floor)':'h_pull',
  'Resistance Band Seated Row':'h_pull','Single Arm DB Row (Chair)':'h_pull',
  // Vertical pull
  'Wide Grip Lat Pulldown':'v_pull','Neutral Grip Lat Pulldown':'v_pull',
  'Close Grip Pulldown':'v_pull','Pull-Ups':'v_pull','Chin Ups':'v_pull',
  'Lat Pullover Machine':'v_pull','Cable Pullover':'v_pull',
  'Band Pulldown':'v_pull','Resistance Band Pulldown':'v_pull',
  // Squat pattern
  'Barbell Back Squat':'squat','Hack Squat Machine':'squat',
  'Smith Machine Squat':'squat','Leg Press (45°)':'squat',
  'Pendulum Squat':'squat','Front Barbell Squat':'squat',
  'Goblet Squat (Dumbbell)':'squat','Bulgarian Split Squat':'squat',
  'Bulgarian Split Squat (Chair)':'squat','Dumbbell Squat':'squat',
  // Hinge pattern
  'Romanian Deadlift':'hinge','Stiff Leg Deadlift':'hinge',
  'Dumbbell Romanian Deadlift':'hinge','Barbell Hip Thrust':'hinge',
  'Cable Pull Through':'hinge',
  // Unilateral
  'Bulgarian Split Squat':'unilateral','Bulgarian Split Squat (Chair)':'unilateral',
  'Walking Lunges (Barbell)':'unilateral','Single Leg RDL (Dumbbell)':'unilateral',
  'Step-Up with Barbell':'unilateral','Step-Up (Chair/Box)':'unilateral',
  'One Arm Dumbbell Row':'unilateral','Single Arm DB Row (Chair)':'unilateral',
  'Single Leg Calf Raise':'unilateral','Side Lying DB Raise':'unilateral',
  // Isolation
  'Leg Extension Machine':'isolation',
  'Lying Leg Curl Machine':'isolation','Cable Lateral Raise':'isolation',
  'Dumbbell Lateral Raise':'isolation','Rope Tricep Pushdown':'isolation',
  'Bar Tricep Pushdown':'isolation','Rope Face Pull':'isolation',
  'Rear Delt Machine Fly':'isolation','Pec Deck Machine':'isolation',
  'Cable Crunch':'isolation','Hanging Leg Raise':'isolation',
  'Ab Wheel Rollout':'isolation','Machine Preacher Curl':'isolation',
  'EZ Bar Preacher Curl':'isolation','Bayesian Cable Curl':'isolation',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANGLE MAP — Anatomical Coverage Framework v1.0
// Maps every gym exercise to its mechanical angle / target head.
// Used by the weekly angle tracker to ensure full muscle coverage
// when the same muscle group appears in multiple days (e.g. Upper 1 & 2).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ANGLE_MAP = {
  // ── CHEST ──────────────────────────────────────────────────────────────
  // upper=incline/clavicular, mid=flat/sternal, lower=decline/costal, fly=stretch/isolation
  'Incline Barbell Press':         'upper',
  'Incline Dumbbell Press':        'upper',
  'Low to High Cable Fly':         'upper',
  'Incline Smith Machine Press':   'upper',
  'Cable Upper Chest Crossover':   'upper',
  'Hammer Strength Incline Press': 'upper',
  'Barbell Bench Press':           'mid',
  'Machine Chest Press':           'mid',
  'Dumbbell Bench Press':          'mid',
  'Smith Machine Flat Press':      'mid',
  'Cable Chest Press':             'mid',
  'Pec Deck Machine':              'fly',
  'Seated Cable Fly':              'fly',
  'Dips (Chest Variation)':        'lower',
  'Decline Barbell Press':         'lower',
  'Decline Dumbbell Press':        'lower',
  'High to Low Cable Fly':         'lower',
  'Decline Cable Fly':             'lower',
  // ── BACK ───────────────────────────────────────────────────────────────
  // vertical_pull=lats width, horizontal_pull=thickness/mid, pullover=lats stretch, rear=rear delt
  'Wide Grip Lat Pulldown':        'vertical_pull',
  'Neutral Grip Lat Pulldown':     'vertical_pull',
  'Pull-Ups':                      'vertical_pull',
  'Close Grip Pulldown':           'vertical_pull',
  'Lat Pullover Machine':          'pullover',
  'Cable Pullover':                'pullover',
  'Chest Supported Row Machine':           'horizontal_pull',
  'Seated Cable Row':              'horizontal_pull',
  'Barbell Bent Over Row':         'horizontal_pull',
  'Meadows Row':                   'horizontal_pull',
  'One Arm Dumbbell Row':          'horizontal_pull',
  'Wide Grip Seated Row':          'horizontal_pull',
  'Smith Machine Row':             'horizontal_pull',
  'One Hand Cable Row':            'horizontal_pull',
  'Single Arm Cable Row':          'horizontal_pull',
  'Lower Back Extensions':         'lower_back',
  'Rope Face Pull':                'rear',
  'Reverse Cable Crossover':       'rear',
  'Rear Delt Machine Fly':         'rear',
  'Bent Over Rear Delt Raise':     'rear',
  // ── SHOULDERS ──────────────────────────────────────────────────────────
  // press=anterior/compound, lateral=medial delt, rear=posterior delt
  'Machine Shoulder Press':        'press',
  'Seated DB Shoulder Press':      'press',
  'Overhead Barbell Press':        'press',
  'Smith Machine Shoulder Press':  'press',
  'Cable Lateral Raise':           'lateral',
  'Dumbbell Lateral Raise':        'lateral',
  'Machine Lateral Raise':         'lateral',
  'Leaning Cable Lateral Raise':   'lateral',
  'Cable Rear Delt Fly':           'rear',
  // ── BICEPS ─────────────────────────────────────────────────────────────
  // stretch=long head (behind body), mid=standard, shortened=short head (preacher), brachialis=neutral
  'Bayesian Cable Curl':           'stretch',
  'Incline Dumbbell Curl':         'stretch',
  'Cable Overhead Curl':           'stretch',
  'EZ Bar Curl':                   'mid',
  'Standing Dumbbell Curl':        'mid',
  'Machine Preacher Curl':         'shortened',
  'EZ Bar Preacher Curl':          'shortened',
  'Spider Curl (EZ Bar)':          'shortened',
  'Hammer Curl':                   'brachialis',
  // ── TRICEPS ────────────────────────────────────────────────────────────
  // overhead=long head stretched, pushdown=lateral head, close_grip=compound
  'Overhead Cable Tricep Extension': 'overhead',
  'Skull Crushers (EZ Bar)':         'overhead',
  'Dumbbell Overhead Tricep Ext':    'overhead',
  'Rope Tricep Pushdown':            'pushdown',
  'Bar Tricep Pushdown':             'pushdown',
  'Cable Tricep Kickback':           'pushdown',
  'Katana Extension':                'overhead',
  'Tricep Dips Machine':             'pushdown',
  // ── QUADS ──────────────────────────────────────────────────────────────
  // squat=bilateral compound, leg_press=machine compound, extension=isolation, unilateral=single leg
  'Barbell Back Squat':            'squat',
  'Hack Squat Machine':            'squat',
  'Smith Machine Squat':           'squat',
  'Pendulum Squat':                'squat',
  'Front Barbell Squat':           'squat',
  'Leg Press (45°)':               'leg_press',
  'Leg Extension Machine':         'extension',
  'Bulgarian Split Squat':         'unilateral',
  'Walking Lunges (Barbell)':      'unilateral',
  'Step-Up with Barbell':          'unilateral',
  // ── HAMSTRINGS ─────────────────────────────────────────────────────────
  // hinge=hip extension/RDL, curl=knee flexion
  'Romanian Deadlift':             'hinge',
  'Stiff Leg Deadlift':            'hinge',
  'Lying Leg Curl Machine':        'curl',
  // ── GLUTES ─────────────────────────────────────────────────────────────
  'Barbell Hip Thrust':            'thrust',
  'Smith Machine Hip Thrust':      'thrust',
  'Cable Pull Through':            'hinge',
  // ── CALVES ─────────────────────────────────────────────────────────────
  'Standing Calf Raise (Machine)': 'gastrocnemius',
  'Leg Press Calf Raise':          'gastrocnemius',
  'Smith Machine Calf Raise':      'gastrocnemius',
  'Seated Calf Raise Machine':     'soleus',
    'Donkey Calf Raise':             'soleus',
};

// ── WEEKLY ANGLE TRACKER ───────────────────────────────────────────────
// Tracks which mechanical angles have been used per muscle group in the
// current weekly plan build. Reset before each full plan generation.
// Only influences accessory/isolation slot selection — never primary
// compound choices (rank < 2) to preserve plan stability.
let _weeklyAngleTracker = {};

function resetAngleTracker() {
  _weeklyAngleTracker = {};
}

// Returns an angle-aware score bonus for an exercise.
// Bonus +3 if this angle has NOT been used for this muscle group yet.
// Bonus  0 if angle already covered (still selectable, just deprioritised).
// grpKey = muscle group key (chest / back / shoulders / biceps / triceps / quads / hamstrings)
function angleBonus(ex, grpKey) {
  const angle = ANGLE_MAP[ex.n];
  if (!angle) return 0; // exercise not in map - neutral
  const used = _weeklyAngleTracker[grpKey] || new Set();
  return used.has(angle) ? 0 : 3;
}

// Called after an exercise is confirmed selected for a day.
function recordAngle(ex, grpKey) {
  const angle = ANGLE_MAP[ex.n];
  if (!angle) return;
  if (!_weeklyAngleTracker[grpKey]) _weeklyAngleTracker[grpKey] = new Set();
  _weeklyAngleTracker[grpKey].add(angle);
}

// ── EXERCISE RANK (for sequencing priority) ───────────────────────────
// 1=Primary Compound, 2=Secondary Compound, 3=Hypertrophy, 4=Isolation, 5=Finisher
function getExerciseRank(ex){
  const name = ex.n || '';
  const grp  = ex.grp || '';
  const tier = ex.tier || 'B';
  const pat  = MOVEMENT_PATTERN[name] || '';
  // Primary compounds — CNS-demanding, multi-joint, high axial load
  const primaryList = [
    'Barbell Back Squat','Hack Squat Machine','Pendulum Squat','Leg Press (45°)',
    'Barbell Bent Over Row','Pull-Ups','Wide Grip Lat Pulldown',
    'Barbell Bench Press','Incline Barbell Press','Overhead Barbell Press',
    'Romanian Deadlift','Barbell Hip Thrust',
    'Smith Machine Squat','Front Barbell Squat',
    'Dumbbell Floor Press','Dumbbell Shoulder Press (Seated)',
    'Machine Shoulder Press','Machine Chest Press','Seated Cable Row',
    'Chest Supported Row Machine','Dumbbell Bent Over Row','T Bar Row',
    'Neutral Grip Lat Pulldown','Goblet Squat (Dumbbell)','Bulgarian Split Squat',
    'Bulgarian Split Squat (Chair)','Dumbbell Romanian Deadlift',
    'Leg Press Narrow Stance','Hammer Strength Incline Press', // v54: machine compound names matching db.js
    'Romanian Deadlift (RDL)',                                 // v54: suffix variant in db
  ];
  // Secondary compounds
  const secondaryList = [
    'Incline Dumbbell Press','Close Grip Bench Press','Dips (Chest Variation)',
    'Dips Between Chairs','Arnold Press','Smith Machine Shoulder Press',
    'Walking Lunges (Barbell)','One Arm Dumbbell Row',
    'Single Arm DB Row (Chair)','Close Grip Pulldown','Skull Crushers (EZ Bar)',
    'Overhead Cable Tricep Extension','DB Overhead Tricep Extension',
    'Stiff-Leg Deadlift','Stiff Leg Deadlift','Cable Pull Through','Step-Up with Barbell',
    'Seated DB Shoulder Press','Lat Pullover Machine','Meadows Row',
    'Wide Grip Seated Row','EZ Bar Curl','Barbell Curl','Hammer Curl',
    'Standing Dumbbell Curl','Incline Dumbbell Curl','Rope Face Pull',
    'Smith Machine Hip Thrust',
  ];
  if(primaryList.includes(name))   return 1;
  if(secondaryList.includes(name)) return 2;
  if(pat==='isolation')            return 4;
  // Calves, core, forearms - finishers
  if(['calves','core','forearms','traps'].includes(grp)) return 5;
  // ── SAFETY NET (v55): un-listed MULTI-JOINT movements default to COMPOUND, not isolation ──
  // Root-cause fix: presses/rows/squats/hinges missing from the hardcoded lists were
  // falling through to isolation rep ranges (e.g. Dumbbell Bench Press getting 12-15).
  // Scoped to real resistance muscle groups only; core/finisher/mobility & explicit
  // isolation-pattern are already handled above, so they are never reached here.
  const _COMPOUND_GROUPS = ['chest','back','shoulders','quads','hamstrings','glutes','adductors','abductors'];
  const _COMPOUND_KW = /(squat|press|bench|\brow\b|deadlift|rdl|pulldown|pull-?up|pull up|chin-?up|lunge|hip thrust|thrust|\bdip\b|pull ?through|step-?up|thruster|clean|good morning)/i;
  if(_COMPOUND_GROUPS.includes(grp) && _COMPOUND_KW.test(name)) return 2;
  // S-tier not yet ranked - hypertrophy work
  if(tier==='S') return 3;
  return 4; // default isolation/accessory
}

// ── FATIGUE ACCUMULATOR ────────────────────────────────────────────────
// Scores cumulative fatigue across a set of exercises.
// Returns object: { lower_back, shoulder_press, elbow_flex, elbow_ext,
//                   cns, grip, axial, ham, quad, posterior, anterior }
function accumulateFatigue(exercises){
  const acc = {};
  for(const ex of exercises){
    const tags = FATIGUE_TAGS[ex.n] || [];
    for(const tag of tags){
      acc[tag] = (acc[tag]||0) + (ex.sets||3);
    }
  }
  return acc;
}

// ── OVERLAP DETECTOR ──────────────────────────────────────────────────
// Returns array of overlap warnings if any fatigue bucket exceeds threshold
function detectOverlap(fatigue){
  const thresholds = {
    lower_back:    12,   // >12 sets stressing lower back = too much
    shoulder_press:18,   // >18 sets pressing = shoulder overuse
    elbow_ext:     15,   // >15 sets tricep/pushing = elbow stress
    elbow_flex:    15,   // >15 sets curling/pulling = elbow stress
    cns:           16,   // >16 sets CNS-heavy = overreaching risk
    axial:         12,   // >12 sets axial loading = spinal fatigue
    grip:          18,   // >18 sets grip-dependent = forearm fatigue
  };
  const warnings = [];
  for(const [key, limit] of Object.entries(thresholds)){
    if((fatigue[key]||0) > limit){
      warnings.push({ tag: key, load: fatigue[key], limit });
    }
  }
  return warnings;
}

// ── OVERLAP RESOLVER ──────────────────────────────────────────────────
// When overlap detected, reduce sets of accessory exercises for that fatigue tag
function resolveOverlap(exercises, warnings){
  if(!warnings.length) return exercises;
  const resolved = exercises.map(ex=>({...ex}));
  for(const warn of warnings){
    const tags = FATIGUE_TAGS;
    // Find accessories (rank ≥ 3) that contribute to this fatigue tag
    const accessories = resolved
      .map((ex,i)=>({ex,i,rank:getExerciseRank(ex)}))
      .filter(({ex,rank})=> rank>=3 && (tags[ex.n]||[]).includes(warn.tag))
      .sort((a,b)=>b.rank-a.rank); // trim from highest rank (finishers) first
    let excess = warn.load - warn.limit;
    for(const {ex,i} of accessories){
      if(excess<=0) break;
      const _advMinA = (typeof state !== 'undefined' && state.exp === 'advanced') ? 3 : 2; // FIX v24
      const canCut = Math.max(0, resolved[i].sets - _advMinA);
      const cut = Math.min(canCut, Math.ceil(excess / Math.max(accessories.length,1)));
      resolved[i] = {...resolved[i], sets: resolved[i].sets - cut};
      excess -= cut;
    }
  }
  return resolved;
}

// ── WEAK POINT PROMOTER ───────────────────────────────────────────────
// Moves exercises targeting weak muscles earlier in the session
// (after primary compounds but before other accessories)
function promoteWeakPoints(exercises, weakList){
  if(!weakList||!weakList.length) return exercises;
  const _ARM_GRPS = new Set(['biceps','triceps','forearms']);
  const _MUSCLE_SEQ = { chest:1, back:1, lats:1, quads:1, hamstrings:1, glutes:1, shoulders:2, calves:2, traps:3, biceps:4, triceps:4, forearms:4, core:5 };
  const isWeak = ex => { const mu=(ex.mu||'').toLowerCase(); return weakList.some(w=>mu.includes(w)); };
  const _isCompound = (e) => {
    if (getExerciseRank(e) <= 2) return true;
    const _p = MOVEMENT_PATTERN[e.n] || '';
    return !!_p && _p !== 'isolation';
  };
  // SAME skeleton as sequenceSession (arms last - compounds - primary muscle - 
  // rank). Weak-point exercises are only pulled forward WITHIN their own tier so
  // a lagging muscle gets priority among equals — never breaking the structure.
  return exercises
    .map((ex,i)=>({ex,i}))
    .sort((A,B)=>{
      const a=A.ex, b=B.ex;
      const armA=_ARM_GRPS.has(a.grp)?1:0, armB=_ARM_GRPS.has(b.grp)?1:0; if(armA!==armB)return armA-armB;
      const cA=_isCompound(a)?0:1, cB=_isCompound(b)?0:1; if(cA!==cB)return cA-cB;
      const mA=_MUSCLE_SEQ[a.grp]??2, mB=_MUSCLE_SEQ[b.grp]??2; if(mA!==mB)return mA-mB;
      const rA=getExerciseRank(a), rB=getExerciseRank(b); if(rA!==rB)return rA-rB;
      const wA=isWeak(a)?0:1, wB=isWeak(b)?0:1; if(wA!==wB)return wA-wB;
      return A.i-B.i;
    })
    .map(x=>x.ex);
}

// ── SESSION SEQUENCER ─────────────────────────────────────────────────
// Main sequencing function: orders exercises within a single session
// following the professional hierarchy:
//   1 Primary compound - 2 Secondary compound - 3 Hypertrophy - 
//   4 Isolation - 5 Finisher
// Within each tier: weak-point exercises first, then by goal score
function sequenceSession(exercises, goal, weakList){
  if(!exercises||!exercises.length) return exercises;

  // Tag each exercise with its rank
  const ranked = exercises.map(ex=>({
    ...ex,
    _rank: getExerciseRank(ex),
    _isWeak: (weakList||[]).some(w=>(ex.mu||'').toLowerCase().includes(w)),
    _goalScore: (ex.goal_bonus||[]).includes(goal)?1:0
  }));

  // Sort — professional push/pull/legs hierarchy (variety stays in EXERCISE
  // choice; the SKELETON of every day is fixed and sane):
  //   1) Arms (biceps/triceps/forearms) are ALWAYS sequenced last on a compound
  //      day. (On a dedicated arm day every exercise is an arm - no-op.)
  //   2) Compounds before isolations.
  //   3) The day's PRIMARY/larger muscle leads (chest/back/legs before shoulders)
  //      so a chest day always opens on a chest press, never a shoulder press.
  //   4) Heavier rank first, then weak-point, then goal score.
  const _ARM_GRPS = new Set(['biceps','triceps','forearms']);
  const _MUSCLE_SEQ = { chest:1, back:1, lats:1, quads:1, hamstrings:1, glutes:1, shoulders:2, calves:2, traps:3, biceps:4, triceps:4, forearms:4, core:5 };
  const _isCompound = (e) => {
    if ((e._rank ?? getExerciseRank(e)) <= 2) return true;
    const _p = MOVEMENT_PATTERN[e.n] || '';
    return !!_p && _p !== 'isolation';
  };
  ranked.sort((a,b)=>{
    const armA = _ARM_GRPS.has(a.grp) ? 1 : 0;
    const armB = _ARM_GRPS.has(b.grp) ? 1 : 0;
    if(armA !== armB) return armA - armB;
    const compA = _isCompound(a) ? 0 : 1;
    const compB = _isCompound(b) ? 0 : 1;
    if(compA !== compB) return compA - compB;
    const mpA = _MUSCLE_SEQ[a.grp] ?? 2;
    const mpB = _MUSCLE_SEQ[b.grp] ?? 2;
    if(mpA !== mpB) return mpA - mpB;
    if(a._rank !== b._rank) return a._rank - b._rank;
    if(a._isWeak !== b._isWeak) return a._isWeak ? -1 : 1;
    return b._goalScore - a._goalScore;
  });

  // Strip internal tags before returning
  return ranked.map(({_rank,_isWeak,_goalScore,...ex})=>ex);
}

// ── MOVEMENT BALANCE VALIDATOR ────────────────────────────────────────
// Checks push/pull, quad/ham, compound/isolation balance for a session
function validateMovementBalance(exercises){
  const patterns = exercises.map(e=>MOVEMENT_PATTERN[e.n]||'other');
  const push   = patterns.filter(p=>p==='h_push'||p==='v_push').length;
  const pull   = patterns.filter(p=>p==='h_pull'||p==='v_pull').length;
  const squat  = patterns.filter(p=>p==='squat').length;
  const hinge  = patterns.filter(p=>p==='hinge').length;
  const iso    = patterns.filter(p=>p==='isolation').length;
  const total  = exercises.length;
  const issues = [];
  // Push/pull imbalance in same session
  if(push>0 && pull>0 && Math.abs(push-pull)>2) issues.push('push_pull_imbalance');
  // Too much isolation with no compound
  if(iso>=total-1 && total>2) issues.push('insufficient_compound');
  // Quad without hinge on a full leg day
  if(squat>2 && hinge===0 && total>4) issues.push('no_hinge_pattern');
  return { push, pull, squat, hinge, iso, issues };
}

// ── WEEKLY FATIGUE VALIDATOR ──────────────────────────────────────────
// Analyzes the full weekly plan for fatigue spacing and distribution
function validateWeeklyFatigue(planDays){
  const issues = [];
  const dailyFatigue = planDays.map(d=> accumulateFatigue(d.exercises||[]));
  // Check for back-to-back high lower_back days
  for(let i=1;i<dailyFatigue.length;i++){
    const prev = dailyFatigue[i-1];
    const curr = dailyFatigue[i];
    if((prev.lower_back||0)>8 && (curr.lower_back||0)>8)
      issues.push({type:'consecutive_lower_back', days:[i-1,i]});
    if((prev.shoulder_press||0)>10 && (curr.shoulder_press||0)>10)
      issues.push({type:'consecutive_shoulder_press', days:[i-1,i]});
    if((prev.cns||0)>10 && (curr.cns||0)>10)
      issues.push({type:'consecutive_cns', days:[i-1,i]});
  }
  return issues;
}

// ── DISTRIBUTION QUALITY SCORER ───────────────────────────────────────
// Returns a 0–100 score reflecting how well-organized the program is
function scoreDistributionQuality(planDays){
  let score = 100;
  const deductions = [];
  const activeDays = planDays.filter(d=>(d.exercises||[]).length > 0);
  const totalDays  = activeDays.length || 1;

  for(const day of activeDays){
    const exs = day.exercises||[];
    if(!exs.length) continue;

    // ── Check sequencing: first exercise should be rank 1 or 2 ──
    // Only deduct if clear isolation first (rank 4+), not rank 3 hypertrophy
    if(getExerciseRank(exs[0]) >= 4){
      score -= 5; deductions.push('isolation_first');
    }

    // ── Check overlap — scaled by day count ──
    // Full Body programs naturally hit same muscles - don't over-penalize
    const fat = accumulateFatigue(exs);
    const overlaps = detectOverlap(fat);
    // In full body (high day count with broad coverage) overlap is expected
    const overlapPenalty = totalDays <= 3 ? 2 : 4; // lower penalty for FB/UL
    score -= overlaps.length * overlapPenalty;
    if(overlaps.length) deductions.push('overlap:'+overlaps.map(o=>o.tag).join(','));

    // ── Check movement balance — reduced penalty ──
    const bal = validateMovementBalance(exs);
    score -= bal.issues.length * 3;
  }

  // ── Weekly checks — scaled so 2-day programs aren't crushed ──
  const weeklyIssues = validateWeeklyFatigue(planDays);
  // Cap weekly deductions: max 15 points regardless of issue count
  const weeklyDeduction = Math.min(15, weeklyIssues.length * 5);
  score -= weeklyDeduction;

  // ── Bonus for well-structured programs ──
  // If no isolation_first and no overlap - award structure bonus
  if(!deductions.includes('isolation_first') && !deductions.some(d=>d.startsWith('overlap'))){
    score = Math.min(100, score + 5);
  }

  return { score: Math.max(0, Math.min(100, score)), deductions };
}

// ── MASTER DISTRIBUTION ENGINE ────────────────────────────────────────
// Called once after pickExercises() fills all days.
// Applies all distribution intelligence in one pass.
// DOES NOT rebuild plan, does NOT call pickExercises, does NOT alter volume.
function applyDistributionLayer(planDays, goal, weakList){
  if(!planDays||!planDays.length) return planDays;

  // Pass 1: Sequence each session professionally
  for(let i=0;i<planDays.length;i++){
    const exs = planDays[i].exercises||[];
    if(!exs.length) continue;
    // Step A: professional sequencing
    const sequenced = sequenceSession(exs, goal, weakList);
    // Step B: detect & resolve overlap
    const fatigue   = accumulateFatigue(sequenced);
    const overlaps  = detectOverlap(fatigue);
    const resolved  = resolveOverlap(sequenced, overlaps);
    // Step C: promote weak points early (after compounds)
    const promoted  = promoteWeakPoints(resolved, weakList);
    planDays[i] = {...planDays[i], exercises: promoted};
  }

  // Pass 2: Weekly fatigue spacing
  const weeklyIssues = validateWeeklyFatigue(planDays);
  if(weeklyIssues.length){
    // For consecutive heavy days: reduce sets on accessory exercises of the second day
    for(const issue of weeklyIssues){
      const dayIdx = issue.days?.[1];
      if(dayIdx==null) continue;
      const exs = planDays[dayIdx].exercises||[];
      const accessories = exs
        .map((ex,i)=>({ex,i,rank:getExerciseRank(ex)}))
        .filter(({rank})=>rank>=3);
      for(const {i} of accessories){
        const ex = exs[i];
        if(!ex) continue;
        const tags = FATIGUE_TAGS[ex.n]||[];
        const relevantTag = issue.type.replace('consecutive_','').replace('_','_');
        if(tags.includes(relevantTag)||tags.includes('lower_back')||tags.includes('cns')){
          const _advMinB = (typeof state !== 'undefined' && state.exp === 'advanced') ? 3 : 2; // FIX v24
          exs[i] = {...ex, sets: Math.max(_advMinB, ex.sets-1)};
        }
      }
      planDays[dayIdx] = {...planDays[dayIdx], exercises:exs};
    }
  }

  // Pass 3: Quality validation & internal rebuild if score < 60
  const quality = scoreDistributionQuality(planDays);
  if(quality.score < 60){
    // Rebuild distribution only (re-sequence, not re-pick)
    for(let i=0;i<planDays.length;i++){
      const exs = planDays[i].exercises||[];
      planDays[i] = {...planDays[i],
        exercises: promoteWeakPoints(
          resolveOverlap(
            sequenceSession(exs, goal, weakList),
            detectOverlap(accumulateFatigue(exs))
          ),
          weakList
        )
      };
    }
  }

  // Attach quality metadata to plan for dashboard display
  planDays._distributionQuality = quality;

  // ── STRICT CAP: بعد كل distribution passes نتحقق من السقف الأسبوعي ──
  const _dlExp = (typeof state !== 'undefined' ? state.exp : null) || 'intermediate';
  enforceWeeklyCapsOnPlan(planDays, _dlExp);

  return planDays;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COACHING NOTES ENGINE — Premium Presentation Layer
// Returns a short, practical, coach-written cue for each exercise.
// Covers: tempo · ROM · form · positioning · muscle feel
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const COACHING_NOTES = {
  // ── CHEST ────────────────────────────────────────────────────────────
  'Barbell Bench Press':         'خفض الحديدة ببطء نحو منتصف الصدر (2-3 ثوان). تحكم في النزول، تجنب ارتداد القضيب من الصدر',
  'Incline Barbell Press':       'ابدأ بزاوية 30-45°. حافظ على الكتفين مضغوطين نحو الظهر طوال الحركة',
  'Incline Dumbbell Press':      'اضغط بالدمبل نحو بعضهما في الأعلى. نزول محكوم 3 ثوان لأقصى استطالة',
  'Dumbbell Bench Press':        'النزول حتى مستوى الصدر مع ثني الكوع 75°. اشعر بالشد في الصدر في القاع',
  'Machine Chest Press':         'اضبط المقعد بحيث يكون المقبض عند مستوى وسط الصدر. دفع متحكم فيه، لا تقفل الكوع',
  'Pec Deck Machine':            'حافظ على مرفقين مثنيين قليلا طوال الحركة. اشعر بالضغط في الصدر الداخلي عند الإغلاق',
  'Seated Cable Fly':            'تخيل أنك تعانق شجرة. حافظ على قوس خفيف في الكوعين. لا ترفع وزنا أكبر مما يسمح بالتحكم',
  'Low to High Cable Fly':       'اسحب من الأسفل نحو الأعلى والداخل. ثبت على القمة للحظة للحصول على أقصى ضخ',
  'High to Low Cable Fly':       'اسحب من الأعلى نحو الأسفل والداخل. ثبت الحركة عند القاع وتجنب التأرجح',
  'Dips (Chest Variation)':      'انحن للأمام 15-20° لتفعيل الصدر السفلي. اخفض ببطء وانتبه من الإفراط في الشد بالكتف',
  'Decline Barbell Press':       'نزول محكوم للمنطقة السفلية من الصدر. ثبت قدميك جيدا على المقعد',
  // ── BACK ─────────────────────────────────────────────────────────────
  'Wide Grip Lat Pulldown':      'اسحب نحو الصدر لا نحو الرقبة. تخيل أنك تكسر العصا أمامك. اشعر بالشد في الظهر لا في الذراعين',
  'Neutral Grip Lat Pulldown':   'بسط الذراعين بالكامل في الأعلى. نزول محكوم 2 ثانية، اشعر باللاتيسيموس يمتد',
  'Pull-Ups':                    'نزول كامل حتى تمتد الذراعان. لا تتأرجح. تحكم في الجزء السفلي من الحركة',
  'Barbell Bent Over Row':       'ظهر مستقيم بزاوية 45°. اسحب نحو السرة وليس الصدر. اشعر بضغط لوحي الكتف',
  'Seated Cable Row':            'لا تحني الظهر للأمام للمساعدة. اسحب المرفقين للخلف بقدر ما تستطيع',
  'Chest Supported Row Machine':         'اضغط الصدر على المقعد طوال الحركة. يمنع التأرجح ويعزل الظهر تماما.',
  'One Arm Dumbbell Row':        'لا تدور الكتف. اسحب المرفق بشكل عمودي. تخيل أن يدك مجرد خطاف.',
  'Meadows Row':                 'اسحب نحو وركك. دوران خفيف في الكتف مقبول. تحكم في النزول ببطء',
  'Rope Face Pull':              'اسحب حتى أذنيك لا وجهك. ثبت على القمة ثانية. كوعاك يجب أن يكونا أعلى من الكتفين',
  'Lat Pullover Machine':        'ثبت الوركين. ابدأ الحركة بسحب الكتف للأسفل لا بثني الكوع',
  'Cable Pullover':              'تحكم في العودة ببطء. شعر بامتداد اللاتيسيموس في الأعلى بالكامل',
  // ── SHOULDERS ──────────────────────────────────────────────────────────
  'Overhead Barbell Press':      'شد البطن. لا تثني الظهر للخلف. ادفع رأسك للأمام بعد مرور القضيب',
  'Seated DB Shoulder Press':    'لا ترفع الدمبل حتى التلامس في الأعلى. توقف قبل القفل بقليل. ظهر مستقيم',
  'Dumbbell Shoulder Press (Seated)': 'لا ترفع الدمبل حتى التلامس في الأعلى. توقف قبل القفل بقليل. ظهر مستقيم',
  'Cable Lateral Raise':         'ارفع حتى مستوى الكتف فقط. الإبهام نحو الأسفل قليلا لتفعيل الجزء الأوسط. لا تتأرجح',
  'Dumbbell Lateral Raise':      'ارفع ببطء وأنزل ببطء أكثر (3 ثوان في النزول). لا ترفع فوق مستوى الكتف',
  'Arnold Press':                'ابدأ بالراحتين نحوك ثم أدر أثناء الرفع. حركة سلسة وليست متشنجة',
  'Rear Delt Machine Fly':       'ثبت صدرك على الوسادة. اسحب للخلف بمرفقين مرتفعين. ركز على الشعور بالدلتا الخلفي',
  'Bent Over Rear Delt Raise':   'ظهر مواز للأرض. ارفع حتى مستوى الكتف فقط. لا تستخدم الزخم',
  // ── BICEPS ────────────────────────────────────────────────────────────
  'EZ Bar Curl':                 'لا تحرك الكوعين. نزول كامل حتى 95%. ثبت على القمة ثانية. لا تستخدم الزخم',
  'Barbell Curl':                'نزول بطيء 3 ثوان. تحكم في المرحلة السفلية وامتد بالكامل',
  'Hammer Curl':                 'تجذيف محايد (إبهام نحو الأعلى). العمل يكون في البراكيالس والبايسبس معا.',
  'Incline Dumbbell Curl':       'الاستلقاء على زاوية يطيل الاستطالة. لا تبدأ بثني كبير في الكوع — دع الدمبل يسقط',
  'Cable Bayesian Curl':         'قف بعيدا عن الكابل. مرفقك للأمام في القمة. أفضل حركة لاستطالة البايسبس',
  'Bayesian Cable Curl':         'قف بعيدا عن الكابل. مرفقك للأمام في القمة. أفضل حركة لاستطالة البايسبس',
  'EZ Bar Preacher Curl':        'أكمل النزول بالكامل حتى يمتد الكوع. لا ترتد من القاع. ببطء شديد في الجزء السفلي',
  'Machine Preacher Curl':       'نفس مبدأ Preacher Curl. ركز على العمل بالعضلة لا على رفع الوزن',
  'Spider Curl (EZ Bar)':        'صدرك على حافة المقعد. نزول بطيء جدا — هذه الحركة تستهدف القمة بشكل خاص',
  'Standing Dumbbell Curl':      'ثبت المرفقين على جانبيك. ارفع بالتبادل أو معا. لا تتأرجح بالجذع',
  // ── TRICEPS ───────────────────────────────────────────────────────────
  'Skull Crushers (EZ Bar)':     'خفض نحو الجبهة ببطء مع إبقاء المرفقين ثابتين. لا تفتح الكوعين للخارج',
  'Rope Tricep Pushdown':        'اضغط للأسفل حتى تمتد الذراعان بالكامل. انشر الحبل قليلا في القاع. لا ترفع الكوعين',
  'Bar Tricep Pushdown':         'اضغط لأسفل بالكامل وثبت ثانية. كوعاك لا يتحركان. حركة معزولة تماما.',
  'Overhead Cable Tricep Extension': 'ابسط يديك بالكامل في الأعلى. نزول ببطء خلف الرأس. تجنب تحريك الكوعين',
  'DB Overhead Tricep Extension':'نزول ببطء خلف الرأس. كوعاك نحو الأعلى طوال الوقت. لا تفتح الكوعين',
  'Close Grip Bench Press':      'المسافة بين اليدين 30-35 سم. اشعر بالعمل في الترايسبس لا في الصدر',
  // ── QUADS ─────────────────────────────────────────────────────────────
  'Barbell Back Squat':          'ظهر محايد، صدر مرفوع. انزل حتى تكون الفخذين موازيين للأرض. ركبتاك على محور القدمين',
  'Hack Squat Machine':          'قدماك أمامك قليلا للتركيز على الكوادز. نزول بطيء 3 ثوان. لا ترتد من القاع',
  'Leg Press (45°)':             'قدماك بعيدتان = جلوتس. قريبتان = كوادز. لا تقفل الركبتين في الأعلى',
  'Smith Machine Squat':         'يمكن تقديم القدمين أكثر من السكوات الحر. نزول كامل مع التحكم',
  'Pendulum Squat':              'من أفضل الآلات للكوادز. قدماك أمامك، نزول عميق. تحكم في الإيقاع',
  'Bulgarian Split Squat':       'الساق الأمامية تحمل معظم الثقل. اخفض الركبة الخلفية نحو الأرض. توازن جيد أولا.',
  'Walking Lunges (Barbell)':    'خطوات متساوية. انزل بالركبة الخلفية نحو الأرض تقريبا. ظهر مستقيم',
  'Goblet Squat (Dumbbell)':     'أمسك الدمبل عند الصدر. كعباك على الأرض. نزول عميق بتحكم',
  'Leg Extension Machine':       'اضبط الدعامة خلف الكاحل. ارفع ببطء وثبت ثانية في الأعلى. اخفض ببطء أكثر',
  // ── HAMSTRINGS ────────────────────────────────────────────────────────
  'Romanian Deadlift':           'ظهر مستقيم طوال الحركة. الحديدة تلامس الجسم في النزول. توقف حين تشعر بشد في الهامستينج',
  'Stiff Leg Deadlift':          'أبق الركبتين شبه مستقيمتين. الهدف هو الاستطالة لا رفع وزن ثقيل. إحساس بالشد أهم من النطاق',
  'Lying Leg Curl Machine':      'وركك مضغوط على المقعد. لا ترفع أردافك في الأعلى. نزول ببطء 3 ثوان.',
  'Dumbbell Romanian Deadlift':  'ظهر مستقيم. الدمبل يمر بجانب الساقين. توقف عند الشعور بالشد في الهامستينج',
  // ── GLUTES ────────────────────────────────────────────────────────────
  'Barbell Hip Thrust':          'ارتكز على حافة المقعد عند الكتف. ادفع الوركين للأعلى واضغط الأرداف في القمة',
  'Cable Pull Through':          'ابتعد عن الكابل. انحن للأمام مع ظهر مستقيم. ادفع الوركين للأمام لا للأعلى',
  // ── CALVES ────────────────────────────────────────────────────────────
  'Standing Calf Raise Machine': 'نزول كامل حتى تمتد قدمك بالكامل. نزول 3 ثوان، رفع 1 ثانية، ثبت في الأعلى',
  'Seated Calf Raise Machine':   'وضع الجلوس يستهدف العضلة المؤدية (Soleus). نزول كامل ضروري',
  'Donkey Calf Raise':           'انحن للأمام 90°. نزول عميق وكامل. ارفع على أصابعك بالكامل',
  'Single Leg Calf Raise':       'توازن على الجزء الأمامي للقدم. نزول بطيء كامل. ارتكز بيد واحدة فقط',
  // ── CORE ─────────────────────────────────────────────────────────────
  'Cable Crunch':                'اضغط من الضلوع، لا تسحب بالرقبة. نزول محكوم والعودة ببطء',
  'Hanging Leg Raise':           'لا تتأرجح. ارفع الركبتين فوق الوركين. تحكم في الجزء السفلي',
  'Ab Wheel Rollout':            'شد البطن بقوة. لا تسمح للظهر بالانهيار. ابدأ بنطاق صغير وزد تدريجيا.',
  'Plank':                       'جسم مستقيم من الرأس حتى الكعب. شد البطن كأنك تتلقى ضربة',
};

// ── FALLBACK NOTES BY MOVEMENT PATTERN ──────────────────────────────
const PATTERN_NOTES = {
  heavy_compound: 'تحكم في النزول (2-3 ثوان). ظهر ثابت ومحايد. ضع الثقل على العضلة المستهدفة',
  compound:       'مدى حركة كامل. تحكم في الجزء السفلي. ركز على إحساس العضلة',
  isolation:      'تخلص من الزخم. بطيء في النزول (2-3 ثوان). اشعر بالعضلة في كل عدة',
};

function getCoachingNote(ex) {
  if (COACHING_NOTES[ex.n]) return COACHING_NOTES[ex.n];
  const type = classifyExerciseType(ex);
  return PATTERN_NOTES[type] || PATTERN_NOTES.isolation;
}

// ── ACCENT COLORS PER EXERCISE TYPE ─────────────────────────────────
function getExAccent(ex, dayColor) {
  const type = classifyExerciseType(ex);
  if (type === 'heavy_compound') return '#ff7a1a'; // orange — primary compound
  if (type === 'compound')       return '#6c63ff'; // accent — secondary
  return '#3b82f6';                                // blue — isolation
}

// ── SEQUENCE LABEL ARABIC ────────────────────────────────────────────
function getSeqLabelAr(rank) {
  const labels = {
    1: 'مركبة أساسية',
    2: 'مركبة ثانوية',
    3: 'ضخامة',
    4: 'عزل',
    5: 'إنهاء'
  };
  return labels[rank] || 'إنهاء';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ██████╗ ██████╗ ███████╗███████╗ ██████╗██████╗ ██╗██████╗ ████████╗
// INTELLIGENT TRAINING PRESCRIPTION LAYER  —  v1.0
//
// Runs AFTER pickExercises() + applyDistributionLayer().
// ONLY modifies: reps · rest · sets (minor trim) · adds: rir · progression
// Does NOT touch: exercise selection · DB logic · volume math · sequencing
//
// Core intelligence:
//   • Compound vs Isolation-aware rep ranges
//   • Goal-specific prescription (strength / hypertrophy / fat loss / fitness)
//   • Experience-scaled intensity (beginner safety gates)
//   • Recovery-adjusted volume & fatigue exposure
//   • RIR (Reps In Reserve) prescription per exercise type
//   • Realistic progression guidance per exercise
//   • Validation pass — rebuilds prescription only if unrealistic
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── EXERCISE TYPE CLASSIFIER ──────────────────────────────────────────
// Returns 'heavy_compound' | 'compound' | 'isolation'
// Used to drive ALL prescription decisions downstream.
function classifyExerciseType(ex) {
  const rank = getExerciseRank(ex);
  if (rank === 1) return 'heavy_compound';
  if (rank === 2) return 'compound';
  return 'isolation'; // ranks 3, 4, 5
}

// ── CORE PRESCRIPTION ENGINE ──────────────────────────────────────────
// Returns { reps, rest, rir, progression } for a single exercise
// based on: exercise type · goal · experience · recovery
//
// LEVEL-TO-VOLUME LINK (Task 4A):
//   Beginner:     RIR 2-3  — cues focus on TECHNIQUE over weight
//   Intermediate: RIR 1-2  — balanced cues
//   Advanced:     RIR 0-1  — max intensity cues, proximity to failure
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function prescribeExercise(ex, goal, exp, recoveryScore) {
  const type   = classifyExerciseType(ex);
  const isAdv  = exp === 'advanced';
  const isBeg  = exp === 'beginner';
  const isMid  = !isBeg && !isAdv;
  const lowRec = recoveryScore < 60;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // REP RANGES — experience-differentiated, goal-driven
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let reps, rest, rir, progression;

  if (type === 'heavy_compound') {

    if (goal === 'strength') {
      reps = isBeg ? '5-7'  : isMid ? '4-6'  : '3-5';
      rest = isBeg ? '3 دقائق' : isMid ? '3-4 دقائق' : '4-5 دقائق';
      rir  = isBeg ? '3 RIR' : isMid ? '2 RIR' : '1 RIR';
    } else if (goal === 'muscle') {
      reps = isBeg ? '8-10'  : isMid ? '6-8'  : '5-8';
      rest = isBeg ? '2-3 دقائق' : lowRec ? '3-4 دقائق' : isMid ? '2-3 دقائق' : '2-3 دقائق';
      rir  = isBeg ? '3 RIR' : isMid ? '2 RIR' : '1 RIR';
    } else if (goal === 'cut') {
      reps = isBeg ? '10-12' : isMid ? '8-10' : '6-10';
      rest = isBeg ? '90 ثانية' : '90-120 ثانية';
      rir  = isBeg ? '3 RIR' : isMid ? '2 RIR' : '1-2 RIR';
    } else { // fitness
      reps = isBeg ? '10-12' : isMid ? '8-10' : '6-10';
      rest = isBeg ? '2 دقيقة' : '2-3 دقائق';
      rir  = isBeg ? '3 RIR' : isMid ? '2 RIR' : '1 RIR';
    }

  } else if (type === 'compound') {

    if (goal === 'strength') {
      reps = isBeg ? '7-9'   : isMid ? '5-8'   : '4-6';
      rest = isBeg ? '2 دقيقة' : isMid ? '2-3 دقائق' : '3 دقائق';
      rir  = isBeg ? '3 RIR' : isMid ? '2 RIR' : '1 RIR';
    } else if (goal === 'muscle') {
      reps = isBeg ? '10-12' : isMid ? '8-12'  : '7-12';
      rest = isBeg ? '90 ثانية' : lowRec ? '90 ثانية' : isMid ? '90-120 ثانية' : '90-120 ثانية';
      rir  = isBeg ? '2-3 RIR' : isMid ? '1-2 RIR' : '0-1 RIR';
    } else if (goal === 'cut') {
      reps = isBeg ? '12-15' : '10-15';
      rest = isBeg ? '60 ثانية' : '60-90 ثانية';
      rir  = isBeg ? '2-3 RIR' : isMid ? '1-2 RIR' : '1 RIR';
    } else { // fitness
      reps = isBeg ? '12-15' : '10-15';
      rest = isBeg ? '75 ثانية' : '75-90 ثانية';
      rir  = isBeg ? '2-3 RIR' : isMid ? '2 RIR' : '1 RIR';
    }

  } else { // isolation

    if (goal === 'strength') {
      reps = isBeg ? '12-15' : isMid ? '10-12' : '8-12';
      rest = isBeg ? '60 ثانية' : '60-75 ثانية';
      rir  = isBeg ? '2-3 RIR' : isMid ? '2 RIR' : '1 RIR';
    } else if (goal === 'muscle') {
      reps = isBeg ? '12-15' : isMid ? '12-15' : '12-15'; // PATCH: كان 10-20 - 12-15
      rest = isBeg ? '60 ثانية' : lowRec ? '45 ثانية' : '45-60 ثانية';
      rir  = isBeg ? '2-3 RIR' : isMid ? '1 RIR' : '0-1 RIR';
    } else if (goal === 'cut') {
      reps = isBeg ? '15-20' : isMid ? '15-20' : '15-20'; // PATCH: كان 15-25 - 15-20
      rest = isBeg ? '60 ثانية' : '45-60 ثانية'; // FIX: min 45s floor
      rir  = isBeg ? '2-3 RIR' : isMid ? '1 RIR' : '0 RIR';
    } else { // fitness
      reps = isBeg ? '15-20' : '12-20'; // PATCH: كان 15-20/12-20 - أبقي 12-20 (max = 20 )
      rest = isBeg ? '45-60 ثانية' : '45-60 ثانية';
      rir  = isBeg ? '2-3 RIR' : isMid ? '1-2 RIR' : '0-1 RIR';
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PROGRESSION CUES — TECHNIQUE-FIRST for beginners, INTENSITY for advanced
  // الدستور: مبتدئ - الأسلوب قبل الوزن | متقدم - الشدة القصوى
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (isBeg) {
    // ── المبتدئ: التركيز على الأسلوب — لا زيادة وزن حتى يتقن الحركة ──
    if (type === 'heavy_compound') {
      progression =
        ' الأسلوب أولا: ركز على عمق الحركة والتحكم الكامل. ' +
        'لا تزيد الوزن حتى تتم جميع العدات بنموذج مثالي في 3 جلسات متتالية. ' +
        'بعدها: أضف 2.5 كجم فقط وكرر';
    } else if (type === 'compound') {
      progression =
        ' الأسلوب أولا: حافظ على الانقباض العضلي وتجنب استخدام الزخم. ' +
        'عند إتمام جميع العدات بتحكم جيد في 2-3 جلسات، أضف 1-2.5 كجم أو عدة واحدة';
    } else {
      progression =
        ' الأسلوب أولا: ركز على الإحساس بالعضلة (mind-muscle connection). ' +
        'عند إتمام النطاق الأعلى بعزل ممتاز، أضف 0.5-1 كجم أو عدتين إضافيتين';
    }
  } else if (isMid) {
    // ── المتوسط: توازن بين الأسلوب والتحميل ──
    if (type === 'heavy_compound') {
      progression =
        'عند إتمام جميع المجموعات عند الحد الأعلى بتحكم كامل، أضف 2.5-5 كجم في الأسبوع التالي. ' +
        'إذا انهار الأسلوب: أبق الوزن وأضف عدة';
    } else if (type === 'compound') {
      progression =
        'تقدم بزيادة 1-2.5 كجم أو +عدة عند الوصول للحد الأعلى بجميع المجموعات. ' +
        'استهدف إتمام النطاق قبل رفع الوزن';
    } else {
      progression =
        'ارفع الوزن بمقدار خفيف (0.5-1 كجم) عند إتمام النطاق الأعلى. ' +
        'ركز على الانقباض القوي ومرحلة الإطالة البطيئة';
    }
  } else {
    // ── المتقدم: الشدة القصوى — العمل عند الفشل مقبول ──
    if (type === 'heavy_compound') {
      progression =
        ' شدة عالية: استهدف ال RIR المحدد بدقة. يسمح ب 1 تكرار فاشل في المجموعة الأخيرة. ' +
        'استخدم Double Progression: أضف عدة أولا، ثم وزنا (5 كجم) عند ثبات النطاق';
    } else if (type === 'compound') {
      progression =
        ' شدة عالية: وصول المجموعة الأخيرة ل 0-1 RIR. ' +
        'تقنيات متقدمة مسموحة: Drop Set · Rest-Pause · Cluster Set لتعظيم التحفيز';
    } else {
      progression =
        ' شدة عالية: الإيزوليشن حتى الفشل التقني في المجموعة الأخيرة (0 RIR). ' +
        'أضف تقنيات التكثيف: 1-2 Drop Set أو Myo-Reps لتعظيم الضخ والتحفيز';
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TEMPO — Time Under Tension
  // المبتدئ: إيقاع بطيء للتعلم | المتقدم: متوافق مع الشدة العالية
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let tempo;
  if (type === 'heavy_compound') {
    tempo = isBeg
      ? '3-1-2-0'  // مبتدئ: إيقاع بطيء للتعلم الحركي
      : isAdv
      ? (goal === 'strength' ? '2-1-X-0' : '3-1-2-0')  // متقدم: انفجاري للقوة
      : (goal === 'strength' ? '2-1-X-0' : '3-1-2-0'); // متوسط: متوازن
  } else if (type === 'compound') {
    tempo = isBeg
      ? '3-1-2-0'
      : isAdv
      ? (goal === 'strength' ? '2-0-X-0' : '3-1-2-0')
      : (goal === 'strength' ? '2-0-X-0' : '2-1-2-0');
  } else {
    // Isolation: مبتدئ بطيء للإحساس | متقدم للضخ
    tempo = isBeg
      ? '3-2-2-1'  // بطيء جدا لل mind-muscle connection
      : isAdv
      ? (goal === 'muscle' ? '3-1-2-1' : '2-0-2-0')
      : '3-1-2-0';
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PROGRESSIVE RIR — Israetel/Schoenfeld: أول مجموعة أبعد عن الفشل
  // المبتدئ: ثابت (لا يتغير) | متقدم: تصاعدي واضح
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let progressiveRIR = null;
  if (isBeg) {
    // المبتدئ: RIR ثابت — لا نضغط على المبتدئ بالتصاعد
    progressiveRIR = `${rir} (ثابت — ركز على الأسلوب)`;
  } else {
    // متوسط/متقدم: RIR تصاعدي — المجموعة الأولى أبعد، الأخيرة أقرب للفشل
    const parts   = rir.replace(' RIR', '').split('-').map(Number);
    const endRIR  = isNaN(parts[0]) ? 1 : parts[0];           // هدف المجموعة الأخيرة
    const startRIR = Math.min(endRIR + (isAdv ? 2 : 3), 4);   // بداية (متقدم أقرب للفشل)
    progressiveRIR = `${startRIR} RIR - ${endRIR} RIR`;
  }

  return { reps, rest, rir, progression, tempo, progressiveRIR };
}

// ── PRESCRIPTION VALIDATOR ────────────────────────────────────────────
// Checks if a prescription is realistic before finalizing.
// Returns true if valid, false if rebuild needed (prescription layer only).
function validatePrescription(ex, p) {
  // Parse rep range low end
  const repLow = parseInt(p.reps.split('-')[0], 10);
  const rank   = getExerciseRank(ex);

  // Heavy compound should not exceed 12 reps (unrealistic for true strength)
  if (rank === 1 && repLow > 12) return false;
  // Isolation should not go below 8 reps (joint stress without benefit)
  if (rank >= 4 && repLow < 8)  return false;
  // Rest must exist
  if (!p.rest || !p.rir || !p.progression) return false;
  return true;
}

// ── MASTER PRESCRIPTION LAYER ─────────────────────────────────────────
// Called once after applyDistributionLayer() completes.
// Iterates every exercise across all plan days and replaces generic
// reps/rest with intelligent, context-aware prescriptions.
// Adds: ex.rir · ex.progression
// Does NOT alter: ex.n · ex.sets · ex.grp · ex.tier · ex.mu
function applyPrescriptionLayer(planDays, goal, exp, recoveryScore) {
  if (!planDays || !planDays.length) return planDays;

  for (let d = 0; d < planDays.length; d++) {
    const exs = planDays[d].exercises || [];
    if (!exs.length) continue;

    const prescribed = exs.map(ex => {
      const exType = classifyExerciseType(ex); // يستخدم لسقف الراحة المتدرج (المركب الثقيل 240ث)
      let p = prescribeExercise(ex, goal, exp, recoveryScore);

      // Validation pass — if invalid, use safe fallback prescription
      if (!validatePrescription(ex, p)) {
        const type = classifyExerciseType(ex);
        const isBeg = exp === 'beginner';
        // Safe fallback values that always pass validation
        p = {
          reps: type==='heavy_compound' ? (isBeg?'6-8':'5-8') : type==='compound' ? '8-12' : '12-15',
          rest: type==='heavy_compound' ? '2-3 دقائق' : type==='compound' ? '90 ثانية' : '60 ثانية',
          rir:  type==='heavy_compound' ? '2-3 RIR' : '1-2 RIR',
          progression: isBeg
            ? 'أضف 1-2.5 كجم عند إتمام جميع العدات بتحكم كامل'
            : 'تقدم بزيادة الوزن أو إضافة عدة عند الوصول للحد الأعلى من النطاق'
        };
      }

      return {
        ...ex,
        exType:        exType,
        reps:          p.reps,
        rest:          p.rest,
        rir:           p.rir,
        progressiveRIR: p.progressiveRIR || null, // SCI-FIX-4: RIR تصاعدي
        progression:   p.progression,
        tempo:         p.tempo || '2-0-2-0',
      };
    });

    planDays[d] = { ...planDays[d], exercises: prescribed };
  }

  return planDays;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIX #1: SMART MODULE INTEGRATION LAYER
// Weaves every selected module from Step 6 into the actual training days.
// Must run after applyPrescriptionLayer(), before rendering.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function applyModuleIntegrationLayer(planDays, activeModules, goal, recoveryScore, exp, weak) {
  if (!planDays || !planDays.length || !activeModules || !activeModules.length) return planDays;

  const days = planDays.length;
  const isLowRec = recoveryScore < 65;
  const isBeg    = exp === 'beginner';

  // Helper: append a block tag to a day's module notes array
  function addModuleBlock(dayIdx, tag) {
    if (!planDays[dayIdx]._moduleTags) planDays[dayIdx]._moduleTags = [];
    planDays[dayIdx]._moduleTags.push(tag);
  }

  // Helper: get or create cooldown array
  function addToCooldown(dayIdx, items) {
    if (!planDays[dayIdx].cooldown) planDays[dayIdx].cooldown = [];
    planDays[dayIdx].cooldown.push(...items);
  }

  // Helper: prepend to warmup
  function prependWarmup(dayIdx, items) {
    planDays[dayIdx].warm = [...items, ...(planDays[dayIdx].warm || [])];
  }

  // ── CARDIO ────────────────────────────────────────────────────────────
  if (activeModules.includes('cardio')) {
    // PATCH-GYM-4: BMI > 30 - استبدال الكارديو عالي الاصطدام بمشي مائل
    const userBMImod = state.bmi || 22;
    const isObeseCardio = userBMImod >= 30;
    const cardioLabel = isObeseCardio
      ? ' كارديو آمن للمفاصل — Incline Treadmill Walk 30 دق · منحدر 10% (BMI ≥ 30: حماية الركبتين)'
      : goal === 'cut'
      ? ' كارديو LISS بعد التمرين — 35 دقيقة (هدف: تنشيف)'
      : goal === 'muscle'
      ? ' كارديو خفيف بعد التمرين — 20 دقيقة (صون الطاقة للنمو)'
      : ' كارديو متوسط بعد التمرين — 25-30 دقيقة';
    const cardioRecoveryLabel = isLowRec
      ? ' كارديو تعافي خفيف جدا — 20 دقيقة مشي (تعافيك منخفض)'
      : ' كارديو تعافي — 30 دقيقة دراجة أو مشي متوسط';

    // Post-workout cardio on training days only (skip rest days — 100% rest)
    const activeDayIndices = [];
    for (let i = 0; i < days; i++) {
      if (!planDays[i].isRest) activeDayIndices.push(i);
    }
    const cardioFreq = goal === 'cut' ? Math.min(activeDayIndices.length, 4) : Math.min(activeDayIndices.length, 2);
    const cardioInterval = Math.max(1, Math.floor(activeDayIndices.length / cardioFreq));
    for (let j = 0; j < activeDayIndices.length; j += cardioInterval) {
      const i = activeDayIndices[j];
      addToCooldown(i, [cardioLabel]);
      addModuleBlock(i, ' Cardio');
    }
    // Recovery cardio REMOVED from rest days — يوم الراحة = راحة 100% بلا أي نشاط
  }

  // ── CORE ─────────────────────────────────────────────────────────────
  if (activeModules.includes('core')) {
    const activeIdxCore = [];
    for (let i = 0; i < days; i++) { if (!planDays[i].isRest) activeIdxCore.push(i); }
    const coreSessions = isBeg ? Math.min(activeIdxCore.length, 2) : Math.min(activeIdxCore.length, 3);
    const coreInterval = Math.max(1, Math.floor(activeIdxCore.length / coreSessions));
    const coreBlocks = [
      ' Core: Plank 3×30ث - Dead Bug 3×10 - Hollow Body 3×20ث',
      ' Core: Ab Wheel 3×8-10 - Hanging Knee Raise 3×12 - Side Plank 2×30ث/جانب',
      ' Core: Cable Crunch 3×15 - Pallof Press 3×12/جانب - McGill Sit-up 2×10'
    ];
    let coreBlockIdx = 0;
    for (let j = 0; j < activeIdxCore.length; j += coreInterval) {
      const i = activeIdxCore[j];
      // Avoid overlapping with heavy lower-back days
      const dayGroups = JSON.stringify(planDays[i].groups || []);
      const hasHeavyBack = dayGroups.includes('hamstrings') && dayGroups.includes('dominant');
      const block = hasHeavyBack ? coreBlocks[0] : coreBlocks[coreBlockIdx % coreBlocks.length];
      addToCooldown(i, [block]);
      addModuleBlock(i, ' Core');
      coreBlockIdx++;
    }
  }

  // ── MOBILITY ─────────────────────────────────────────────────────────
  if (activeModules.includes('mobility')) {
    const mobilityItems = [
      'Thoracic Rotation 8×/جانب',
      'Hip 90/90 Stretch 45ث/جانب',
      'Ankle CARs — 10×/جانب',
      'Shoulder CARs 8×/جانب',
      "World's Greatest Stretch 5×/جانب"
    ];
    // Add mobility to warmup of TRAINING days only (rest day = 100% rest)
    for (let i = 0; i < days; i++) {
      if (planDays[i].isRest) continue;
      prependWarmup(i, [' موبيلتي قبل التمرين (7-10 دقائق):']);
      const dayGroups = JSON.stringify(planDays[i].groups || []);
      const isLeg = dayGroups.includes('quads') || dayGroups.includes('hamstrings');
      const items = isLeg
        ? [mobilityItems[1], mobilityItems[2], mobilityItems[4]]
        : [mobilityItems[0], mobilityItems[3], mobilityItems[4]];
      prependWarmup(i, items);
      addModuleBlock(i, ' Mobility');
    }
  }

  // ── STRETCHING ───────────────────────────────────────────────────────
  if (activeModules.includes('stretching')) {
    const S = STRETCH;
    for (let i = 0; i < days; i++) {
      if (planDays[i].isRest) continue; // يوم الراحة = راحة 100%
      const dayGroups = JSON.stringify(planDays[i].groups || []);
      let extras = [];
      if (dayGroups.includes('quads') || dayGroups.includes('hamstrings')) extras = [...S.legs, ...S.glutes];
      else if (dayGroups.includes('chest')) extras = [...S.chest, ...S.shoulders];
      else if (dayGroups.includes('back')) extras = [...S.back, ...S.arms];
      else extras = [...S.shoulders, ...S.arms];
      // Deduplicate against existing stretch
      const existing = planDays[i].stretch || [];
      const merged = [...new Set([...existing, ...extras])];
      planDays[i].stretch = merged;
      addModuleBlock(i, ' Stretching');
    }
  }

  // ── RECOVERY ─────────────────────────────────────────────────────────
  if (activeModules.includes('sleep')) {
    const recoveryNote = isLowRec
      ? ' بروتوكول التعافي: فوم رولينج 10 دقائق، ماغنيسيوم 300mg، نوم 8+ ساعات (أولوية قصوى)'
      : ' بروتوكول التعافي: فوم رولينج 5 دقائق، نوم 7-8 ساعات منتظمة';
    for (let i = 0; i < days; i++) {
      if (planDays[i].isRest) continue; // يوم الراحة = راحة 100% — لا فوم رولينج ولا نشاط
      addToCooldown(i, [recoveryNote]);
      addModuleBlock(i, ' Recovery');
    }
  }

  // ── BREATHING ────────────────────────────────────────────────────────
  if (activeModules.includes('breathing')) {
    const breathingNote = ' تنفس ما بعد التمرين: 4-7-8 (شهيق 4ث، حبس 7ث، زفير 8ث) × 5 دورات';
    const breathingWarm = ' تنفس Box قبل التمرين: 4ث شهيق - 4ث حبس - 4ث زفير - 4ث حبس × 5 دورات';
    for (let i = 0; i < days; i++) {
      if (planDays[i].isRest) continue; // يوم الراحة = راحة 100%
      prependWarmup(i, [breathingWarm]);
      addToCooldown(i, [breathingNote]);
      addModuleBlock(i, ' Breathing');
    }
  }

  // ── YOGA ─────────────────────────────────────────────────────────────
  if (activeModules.includes('yoga')) {
    // Attach to the training day with lightest load (skip rest days — 100% rest)
    let lightestIdx = -1;
    let minEx = Infinity;
    for (let i = 0; i < days; i++) {
      if (planDays[i].isRest) continue; // لا يوغا في يوم الراحة
      const n = (planDays[i].exercises || []).length;
      if (n < minEx) { minEx = n; lightestIdx = i; }
    }
    if (lightestIdx >= 0) {
      addToCooldown(lightestIdx, [
        ' يوغا تعافي (30-40 دقيقة): Cat-Cow - Child\'s Pose - Pigeon Pose - Supine Twist - Savasana'
      ]);
      addModuleBlock(lightestIdx, ' Yoga');
    }
  }

  // ── KEGEL ────────────────────────────────────────────────────────────
  if (activeModules.includes('kegel')) {
    // Low-fatigue end-of-session protocol on 2 days per week (training days only)
    const kegelNote = ' Kegel (قاع الحوض): 3 مجموعات × 10 تقلصات بطيئة (3ث شد، 3ث إرخاء) + 10 سريعة';
    const activeIdxKegel = [];
    for (let i = 0; i < days; i++) { if (!planDays[i].isRest) activeIdxKegel.push(i); }
    const kegelDays = activeIdxKegel.length >= 4
      ? [activeIdxKegel[0], activeIdxKegel[Math.floor(activeIdxKegel.length/2)]]
      : activeIdxKegel.length > 0 ? [activeIdxKegel[0]] : [];
    kegelDays.forEach(i => {
      addToCooldown(i, [kegelNote]);
      addModuleBlock(i, ' Kegel');
    });
  }

  // ── WEAK POINT FOCUS ─────────────────────────────────────────────────
  // يدمج تمرين واحد × 3 مجموعات مباشرة في اليوم الذي يدرب العضلة المستهدفة
  // المصدر: GYM_DB أو HOME_DB حسب state.equip — لا cooldown، لا جلسة منفصلة
  if (activeModules.includes('weakpoint') && weak && weak.length) {

    const weakMap = {
      chest:'صدر', back:'ظهر', shoulders:'أكتاف', arms:'ذراع',
      legs:'أرجل', glutes:'جلوتس', core:'كور', calves:'سمانة',
      forearms:'ساعد', traps:'ترابيس', rotator_cuff:'روتاتور كاف',
      gluteus_medius:'جلوتس ميديوس'
    };

    // خريطة العضلة الضعيفة - مفتاح البحث في اليوم
    const weakDayGroupMap = {
      chest:'chest', back:'back', shoulders:'shoulders',
      arms:'biceps', legs:'quads', glutes:'hamstrings',
      core:'core', calves:'calves', forearms:'forearms',
      traps:'back', rotator_cuff:'shoulders', gluteus_medius:'hamstrings'
    };

    // خريطة العضلة الضعيفة - مصادر التمارين في DB (مرتبة حسب الأولوية)
    const weakDBMap = {
      chest:      db => [...(db.chest?.upper||[]), ...(db.chest?.mid||[]), ...(db.chest?.lower||[])],
      back:       db => [...(db.back?.lats||[]), ...(db.back?.mid||[])],
      shoulders:  db => [...(db.shoulders?.lateral||[]), ...(db.shoulders?.press||[]), ...(db.shoulders?.rear||[])],
      arms:       db => [...(db.biceps?.short||[]), ...(db.biceps?.long||[])],
      legs:       db => [...(db.quads?.isolation||[]), ...(db.quads?.dominant||[])],
      glutes:     db => [...(db.hamstrings?.glutes||[])],
      core:       db => [...(db.core?.all||[])],
      calves:     db => [...(db.calves?.gastrocnemius||db.calves?.all||[]), ...(db.calves?.soleus||[])],
      forearms:   db => [...(db.forearms?.all||[])],
      traps:      db => [...(db.traps?.all||[])],
      rotator_cuff: db => [...(db.shoulders?.rear||[])],
      gluteus_medius: db => [...(db.hamstrings?.glutes||[])]
    };

    // ال DB الصح حسب بيئة المستخدم
    const _wpIsHome = (typeof state !== 'undefined' ? state.equip : null) === 'home';
    const _wpDB = _wpIsHome ? HOME_DB : GYM_DB;

    weak.slice(0, 4).forEach(w => {
      const dayGroupKey = weakDayGroupMap[w] || w;
      const label = weakMap[w] || w;

      // إيجاد أنسب يوم يدرب هذه العضلة
      let bestDay = 0;
      for (let i = 0; i < days; i++) {
        const dg = JSON.stringify(planDays[i].groups || []);
        if (dg.includes(dayGroupKey)) { bestDay = i; break; }
      }

      // جمع أسماء التمارين الموجودة في اليوم المستهدف (لتجنب التكرار)
      const existingNames = new Set((planDays[bestDay].exercises || []).map(e => e.n));

      // سحب التمارين من ال DB الصح
      const poolFn = weakDBMap[w] || weakDBMap['chest'];
      const fullPool = poolFn(_wpDB);

      // اختيار أول تمرين غير موجود في اليوم — S-Tier أولا ثم A-Tier
      const sorted = [
        ...fullPool.filter(e => e.tier === 'S' && !existingNames.has(e.n)),
        ...fullPool.filter(e => e.tier !== 'S' && !existingNames.has(e.n))
      ];

      if (sorted.length === 0) return; // كل التمارين موجودة بالفعل

      const picked = sorted[0];

      if (!planDays[bestDay].exercises) planDays[bestDay].exercises = [];
      planDays[bestDay].exercises.push({
        ...picked,
        sets: 3,
        reps: picked.reps || '12-15',
        rest: picked.rest || '60ث',
        mu: picked.mu || label,
        grp: picked.grp || w,
        _weakPoint: true,   // علامة ل PDF badge
        _weakExtra: true,   // علامة ل UI badge
        _weakLabel: label
      });

      addModuleBlock(bestDay, ` Weak: ${label}`);
    });
  }

  // ── STRICT CAP: بعد إضافة Module exercises نتحقق من السقف الأسبوعي لكل عضلة ──
  const _miExp = (typeof state !== 'undefined' ? state.exp : null) || 'intermediate';
  enforceWeeklyCapsOnPlan(planDays, _miExp);

  return planDays;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIX #2: FULL MUSCLE COVERAGE VALIDATION LAYER
// Detects missing/undertrained muscles and auto-rebalances.
// PATCH 1: Full Muscle Coverage Governance — strict weekly coverage map
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const MUSCLE_COVERAGE_MAP = {
  // CHEST — 3 zones
  chest_upper:    ['chest','upper'],
  chest_mid:      ['chest','mid'],
  chest_lower:    ['chest','lower'],
  // BACK — 5 zones
  back_lats:      ['back','lats'],
  back_mid:       ['back','mid'],
  back_rear:      ['shoulders','rear'],
  // SHOULDERS — 3 zones
  shoulders_front:['shoulders','press'],
  shoulders_lateral:['shoulders','lateral'],
  shoulders_rear: ['shoulders','rear','back','rear'],
  // LEGS — 4 zones
  quads:          ['quads'],
  hamstrings:     ['hamstrings'],
  calves:         ['calves'],
  glutes:         ['hamstrings','glutes'],
  // ARMS — 2 zones
  biceps:         ['biceps'],
  triceps:        ['triceps'],
  // OPTIONAL (prefer to include)
  traps:          ['traps','back'],
  forearms:       ['forearms','biceps'],
  core:           ['core']
};

// Required groups for plans > 2 days (all except optional)
const MUSCLE_COVERAGE_REQUIRED = new Set([
  'chest_upper','chest_mid','chest_lower',
  'back_lats','back_mid','back_rear',
  'shoulders_front','shoulders_lateral','shoulders_rear',
  'quads','hamstrings','calves','glutes',
  'biceps','triceps'
]);

function validateMuscleCoverage(planDays) {
  // Collect all trained group tokens across the week
  const coveredTokens = new Set();
  planDays.forEach(day => {
    (day.groups || []).forEach(g => g.forEach(token => coveredTokens.add(token)));
  });

  const missing = [];
  const missingRequired = [];
  Object.entries(MUSCLE_COVERAGE_MAP).forEach(([muscle, tokens]) => {
    // Coverage: at least one token in the group must be matched
    // For multi-token entries like shoulders_rear which maps ['shoulders','rear','back','rear'],
    // we check if both the primary muscle type AND subkey appear together
    let covered = false;
    if (tokens.length === 2) {
      covered = coveredTokens.has(tokens[0]) && coveredTokens.has(tokens[1]);
    } else if (tokens.length === 4) {
      // e.g. ['shoulders','rear','back','rear'] — covered if either pair is present
      covered = (coveredTokens.has(tokens[0]) && coveredTokens.has(tokens[1])) ||
                (coveredTokens.has(tokens[2]) && coveredTokens.has(tokens[3]));
    } else {
      covered = tokens.some(t => coveredTokens.has(t));
    }
    if (!covered) {
      missing.push(muscle);
      if (MUSCLE_COVERAGE_REQUIRED.has(muscle)) missingRequired.push(muscle);
    }
  });

  // Build coverage report to attach to plan metadata
  const total = Object.keys(MUSCLE_COVERAGE_MAP).length;
  const covered = total - missing.length;
  const coverageScore = Math.round((covered / total) * 100);

  // Auto-fix: append missing groups to the lightest day
  if (missing.length > 0) {
    const fixMap = {
      shoulders_rear: ['shoulders','rear'],
      shoulders_lateral: ['shoulders','lateral'],
      shoulders_front: ['shoulders','press'],
      back_rear:    ['shoulders','rear'],
      back_lats:    ['back','lats'],
      back_mid:     ['back','mid'],
      rear_delts:   ['shoulders','rear'],
      side_delts:   ['shoulders','lateral'],
      front_delts:  ['shoulders','press'],
      lats:         ['back','lats'],
      upper_back:   ['back','mid'],
      glutes:       ['hamstrings','glutes'],
      calves:       ['calves','gastrocnemius'],
      core:         null,         // core ممنوع من الجدول الأساسي
      triceps:      ['triceps','long'],
      biceps:       ['biceps','long'],
      chest:        ['chest','mid'],
      chest_upper:  ['chest','upper'],
      chest_mid:    ['chest','mid'],
      chest_lower:  ['chest','lower'],
      quads:        ['quads','isolation'],
      hamstrings:   ['hamstrings','dominant'],
      traps:        ['traps','all'],
      forearms:     ['forearms','all']
    };

    // FIX v28: اختيار يوم الحقن بحسب السياق (push/pull/legs) + توفر مساحة.
    // قديما: كل العضلات الناقصة تتكدس على "أخف يوم" دون سياق - press في Pull،
    // والترابيس/الساعد في يوم Push أو أرجل. الآن نوجه كل عضلة ليوم مناسب فيه مساحة.
    const _PATCH_CTX = {
      shoulders_front:'push', front_delts:'push', shoulders_lateral:'push', side_delts:'push',
      triceps:'push', chest:'push', chest_upper:'push', chest_mid:'push', chest_lower:'push',
      shoulders_rear:'pull', back_rear:'pull', rear_delts:'pull',
      back_lats:'pull', back_mid:'pull', lats:'pull', upper_back:'pull',
      traps:'pull', forearms:'pull', biceps:'pull',
      glutes:'legs', calves:'legs', quads:'legs', hamstrings:'legs'
    };
    const _dayContext = (day) => {
      const gs = (day.groups||[]);
      const mset = new Set(gs.map(g=>g[0]));
      const hasPushSh = gs.some(g=>g[0]==='shoulders'&&(g[1]==='press'||g[1]==='lateral'));
      const hasRearSh = gs.some(g=>g[0]==='shoulders'&&g[1]==='rear');
      if (mset.has('chest') || hasPushSh || mset.has('triceps')) return 'push';
      if (mset.has('back') || hasRearSh || mset.has('biceps') || mset.has('traps') || mset.has('forearms')) return 'pull';
      if (mset.has('quads') || mset.has('hamstrings') || mset.has('calves') || mset.has('glutes') || mset.has('adductors')) return 'legs';
      return 'other';
    };
    const _dayLoad = (i) => (((planDays[i].exercises||[]).length) || ((planDays[i].groups||[]).length)) + ((planDays[i]._coveragePatches||[]).length);
    const _PATCH_ROOM = 7;
    missing.forEach(m => {
      const grp = fixMap[m];
      if (!grp) return;
      const _wantCtx = _PATCH_CTX[m] || null;
      let bestDay = -1, _bestScore = Infinity;
      planDays.forEach((day, i) => {
        if (day.isRest) return;
        const _ctxMatch = !_wantCtx || _dayContext(day) === _wantCtx;
        const _load = _dayLoad(i);
        const _score = (_ctxMatch?0:1000) + (_load < _PATCH_ROOM ? 0 : 100) + _load;
        if (_score < _bestScore) { _bestScore = _score; bestDay = i; }
      });
      if (bestDay < 0) bestDay = 0;
      // Add the group to that day's groups so pickExercises can cover it
      if (!planDays[bestDay]._coveragePatches) planDays[bestDay]._coveragePatches = [];
      planDays[bestDay]._coveragePatches.push(grp);
      // Also tag the muscle as a coverage note
      if (!planDays[bestDay]._coverageNotes) planDays[bestDay]._coverageNotes = [];
      const arabicName = {
        shoulders_rear:'دلتا خلفي',shoulders_lateral:'دلتا جانبي',shoulders_front:'دلتا أمامي',
        back_lats:'ظهر لاتس',back_mid:'ظهر وسط',back_rear:'ظهر خلفي',
        rear_delts:'دلتا خلفي',side_delts:'دلتا جانبي',front_delts:'دلتا أمامي',
        lats:'ظهر لاتس',upper_back:'ظهر وسط',glutes:'جلوتس',calves:'سمانة',
        core:'كور',triceps:'ترايسبس',biceps:'بايسبس',chest:'صدر',
        chest_upper:'صدر علوي',chest_mid:'صدر وسط',chest_lower:'صدر سفلي',
        quads:'كوادز',hamstrings:'هامستينج',traps:'ترابيس',forearms:'ساعد'
      }[m]||m;
      planDays[bestDay]._coverageNotes.push(` تم إضافة ${arabicName} (تغطية تلقائية)`);
    });
  }

  return { coverageScore, missing, missingRequired, covered, total };
}

// ── Apply coverage patches: run pickExercises for missing groups and add to lightest day
function applyCoveragePatches(planDays, equip, injuries, goal, time, exp, gender) {
  let patchApplied = false;
  planDays.forEach((day, i) => {
    const patches = day._coveragePatches;
    if (!patches || !patches.length) return;
    const additionalExs = pickExercises(patches, equip, injuries, goal, time, exp, gender, i + 99);
    // Only keep the first exercise per patch group to avoid volume explosion
    const toAdd = additionalExs.slice(0, patches.length);
    if (toAdd.length) {
      // PATCH 2: Deduplicate — never add exercise already present in the day
      const existingNames = new Set((day.exercises||[]).map(e => e.n));
      // BUG-2 FIX: لا تضاف تمارين push (ضغط كتف) لأيام pull
      const _dayGrps = new Set((day.groups||[]).map(g=>g[0]));
      const _isPullDay = (_dayGrps.has('back')||_dayGrps.has('lats')) && !_dayGrps.has('chest');
      const _PUSH_SUBS = new Set(['press','lateral']);
      // BUG FIX (v51): الحارس القديم وثق بال sub label فقط؛ لكن coverage patch
      // قد يضيف تمرين ضغط موسوما sub='rear' فيتسلل ليوم Pull. نتحقق الآن
      // من نمط الحركة الفعلي MOVEMENT_PATTERN وهو المرجع الموثوق لا ال label.
      const _PUSH_PATTERNS = new Set(['v_push','h_push']);
      // ── FULL ARCHETYPE GUARD FOR COV: لا تضيف عضلة تضاد أركيتايب اليوم ──
      const _covDayGrps = new Set((day.groups||[]).map(g=>Array.isArray(g)?g[0]:g));
      const _covIsPush  = _covDayGrps.has('chest') && !_covDayGrps.has('back') && !_covDayGrps.has('quads');
      const _covIsPull  = (_covDayGrps.has('back')||_covDayGrps.has('lats')) && !_covDayGrps.has('chest') && !_covDayGrps.has('quads');
      const _covIsLegs  = _covDayGrps.has('quads') || _covDayGrps.has('hamstrings');
      // يوم متخصص (أكتاف/ذراع): ليس chest ولا back ولا quads/hams
      const _covIsSpec  = !_covDayGrps.has('chest') && !_covDayGrps.has('back') && !_covDayGrps.has('lats') && !_covDayGrps.has('quads') && !_covDayGrps.has('hamstrings');
      const dedupedToAdd = toAdd.filter(e => {
        if(existingNames.has(e.n)) return false;
        if(_isPullDay && e.grp==='shoulders' && _PUSH_SUBS.has(e.sub)) return false;
        if(_isPullDay && _PUSH_PATTERNS.has(MOVEMENT_PATTERN[e.n]||'')) return false;
        const _cg=e.grp||'', _cs=e.sub||'';
        const _cbp=_cg==='back'&&_cs!=='lower';
        const _clg=['quads','hamstrings','glutes','adductors'].includes(_cg);
        if(_covIsPush && (_cg==='biceps'||_cbp||_clg)) return false;
        if(_covIsPull && (_cg==='chest'||_cg==='triceps'||_clg)) return false;
        if(_covIsLegs && (_cg==='chest'||_cbp||_cg==='biceps'||_cg==='triceps')) return false;
        if(_covIsSpec && (_cg==='chest'||_cbp||_cg==='biceps'||_cg==='triceps')) return false;
        return true;
      });
      // حساب ال sets الحالية قبل الإضافة
      const currentSets = (day.exercises||[]).reduce((s,e)=>s+(e.sets||0),0);
      const coverageMAX = 21; // SCI-FIX-5: موحد — الفرق في الراحة لا الحجم الكلي
      let remaining = coverageMAX - currentSets;
      // أضف فقط التمارين اللي تناسب ال budget المتبقي
      // FIX v24: لا تتجاوز 7 تمارين/يوم مهما كانت ال patches
      const MAX_EX_PATCH = exp === 'beginner' ? 6 : 7;
      const currentExCount = (day.exercises||[]).length;
      if (currentExCount >= MAX_EX_PATCH) return; // اليوم ممتلئ — لا إضافة
      const slotsAvailable = MAX_EX_PATCH - currentExCount;
      const safeToAdd = [];
      for (const ex of dedupedToAdd) {
        if (safeToAdd.length >= slotsAvailable) break;
        if (remaining <= 0) break;
        const exSets = Math.min(ex.sets || 3, remaining, 3);
        safeToAdd.push({ ...ex, sets: exSets, _src:'COV' });
        remaining -= exSets;
      }
      // Append patch exercises — do NOT filter/remove existing exercises
      day.exercises = [...(day.exercises||[]), ...safeToAdd];
      // Also update day.groups so validateMuscleCoverage re-score reads correctly
      if (!day.groups) day.groups = [];
      patches.forEach(p => { if (!day.groups.some(g=>g[0]===p[0]&&g[1]===p[1])) day.groups.push(p); });
      patchApplied = true;
    }
    delete day._coveragePatches;
  });

  // ── STRICT CAP: بعد إضافة coverage patches نتحقق فورا من السقف الأسبوعي ──
  const _cpExp = (typeof state !== 'undefined' ? state.exp : null) || 'intermediate';
  enforceWeeklyCapsOnPlan(planDays, _cpExp);

  return patchApplied;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LEG BALANCE VALIDATOR & PATCHER — الشرط الذهبي لتوازن تدريب الأرجل
// ─────────────────────────────────────────────────────────────────────
// القاعدة 1 (يوم أرجل واحد):
//   يوم الأرجل المنفصل لازم يغطي: كوادز + هامستينج + سمانة + جلوتس
//   الترتيب الأساسي: كوادز - هامستينج - سمانة  (جلوتس ضمنه في هامستينج)
//
// القاعدة 2 (يومين أرجل منفصلين):
//   الأسبوع كله لازم يغطي بشكل كاف:
//     - كوادز: compound (dominant) في الأقل مرة واحدة
//     - هامستينج: dominant (RDL/Leg Curl) في الأقل مرة واحدة
//     - جلوتس: glutes (hip thrust/bridge) في الأقل مرة واحدة
//     - سمانة: في كل يوم أرجل منفصل
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function validateAndPatchLegBalance(planDays, equip, injuries, goal, time, exp, gender) {
  const isHome = equip === 'home';

  // ── تحديد أيام الأرجل المنفصلة (dedicated leg days) ──────────────────
  // يوم الأرجل المنفصل = يوم فيه كوادز أو هامستينج بدون صدر/ظهر/كتف
  const PUSH_PULL = new Set(['chest','back','shoulders','biceps','triceps']);
  const legDayIndices = [];
  planDays.forEach((day, i) => {
    if (day.isRest) return;
    const grps = (day.groups || []).map(g => g[0]);
    const hasLegs = grps.some(g => g === 'quads' || g === 'hamstrings');
    const hasPushPull = grps.some(g => PUSH_PULL.has(g));
    if (hasLegs && !hasPushPull) legDayIndices.push(i);
  });

  // مفيش يوم أرجل منفصل - لا داعي للشرط
  if (legDayIndices.length === 0) return;

  // ── مساعدات ────────────────────────────────────────────────────────────
  function dayHasGroup(day, grpKey, subKey) {
    return (day.groups || []).some(g => g[0] === grpKey && (!subKey || g[1] === subKey));
  }
  function dayHasExercise(day, grpKey, subKey) {
    return (day.exercises || []).some(e => e.grp === grpKey && (!subKey || e.sub === subKey));
  }
  function pickBestExercise(grpKey, subKey, dayIdx) {
    const db = isHome ? HOME_DB : GYM_DB;
    const pool = (db[grpKey]?.[subKey] || db[grpKey]?.all || []);
    const usedInPlan = new Set(
      planDays.flatMap(d => (d.exercises || []).map(e => e.n))
    );
    // نفضل تمرين غير مستخدم في نفس اليوم
    const dayUsed = new Set((planDays[dayIdx]?.exercises || []).map(e => e.n));
    const available = pool.filter(e => !dayUsed.has(e.n));
    return available[0] || pool[0] || null;
  }
  function injectGroup(dayIdx, grpKey, subKey, label) {
    const day = planDays[dayIdx];
    if (!day) return;
    // تجنب التكرار في ال groups
    if (!dayHasGroup(day, grpKey, subKey)) {
      day.groups = day.groups || [];
      day.groups.push([grpKey, subKey]);
    }
    // تجنب التكرار في ال exercises
    if (dayHasExercise(day, grpKey, subKey)) return;
    const ex = pickBestExercise(grpKey, subKey, dayIdx);
    if (!ex) return;
    const sets = exp === 'beginner' ? 3 : 3;
    const reps = grpKey === 'calves' ? '15-20' : (grpKey === 'hamstrings' && subKey === 'glutes' ? '12-15' : '10-12');
    day.exercises = day.exercises || [];
    day.exercises.push({
      ...ex,
      grp: grpKey,
      sub: subKey,
      sets,
      reps,
      rest: 60,
      blocked: false,
      vid: getValidVid(ex.vid),
      _legBalanceInjected: true,
      _legBalanceLabel: label,
      _protected: true
    });
    if (!day._legBalanceNotes) day._legBalanceNotes = [];
    day._legBalanceNotes.push(` توازن الأرجل: تم إضافة ${label}`);
  }

  // ── helpers لكشف ما يغطيه اليوم بالفعل في التمارين ────────────────────
  function exercisesHaveGroup(day, grpKey, subKey) {
    return (day.exercises || []).some(e => e.grp === grpKey && (!subKey || e.sub === subKey));
  }
  function weekHasGroup(grpKey, subKey) {
    return planDays.some(d => exercisesHaveGroup(d, grpKey, subKey));
  }

  // ══════════════════════════════════════════════════════════════════════
  // القاعدة 1: يوم أرجل واحد - يجب أن يحتوي: كوادز + هامستينج + سمانة + جلوتس + ضامة (جيم)
  // ═══════════════════════════════════════════════════════════════════════════════
  if (legDayIndices.length === 1) {
    const di = legDayIndices[0];
    const day = planDays[di];

    // كوادز compound (dominant)
    if (!exercisesHaveGroup(day, 'quads', 'dominant')) {
      injectGroup(di, 'quads', 'dominant', 'كوادز compound');
    }
    // هامستينج (dominant)
    if (!exercisesHaveGroup(day, 'hamstrings', 'dominant')) {
      injectGroup(di, 'hamstrings', 'dominant', 'هامستينج');
    }
    // جلوتس (ضمن هامستينج/glutes أو hamstrings/glutes)
    if (!exercisesHaveGroup(day, 'hamstrings', 'glutes')) {
      injectGroup(di, 'hamstrings', 'glutes', 'جلوتس');
    }
    // سمانة
    if (!exercisesHaveGroup(day, 'calves', null)) {
      const calvesKey = isHome ? 'all' : 'gastrocnemius';
      injectGroup(di, 'calves', calvesKey, 'سمانة');
    }
    // ضامة (جيم فقط — مفيش في HOME_DB)
    if (!isHome && !exercisesHaveGroup(day, 'adductors', null)) {
      injectGroup(di, 'adductors', 'all', 'ضامة');
    }
    return;
  }

  // ══════════════════════════════════════════════════════════════════════
  // القاعدة 2: يومين أرجل أو أكثر - الأسبوع بالكامل يجب أن يغطي كل قسم بشكل كاف
  // ══════════════════════════════════════════════════════════════════════
  // 2a. كوادز dominant: لازم موجود في الأقل في يوم واحد
  if (!weekHasGroup('quads', 'dominant')) {
    // أضفه لأول يوم أرجل يحتوي على كوادز
    const targetDay = legDayIndices.find(i =>
      dayHasGroup(planDays[i], 'quads', null)
    ) ?? legDayIndices[0];
    injectGroup(targetDay, 'quads', 'dominant', 'كوادز compound');
  }

  // 2b. هامستينج dominant: لازم في الأقل في يوم واحد
  if (!weekHasGroup('hamstrings', 'dominant')) {
    const targetDay = legDayIndices.find(i =>
      dayHasGroup(planDays[i], 'hamstrings', null)
    ) ?? legDayIndices[legDayIndices.length - 1];
    injectGroup(targetDay, 'hamstrings', 'dominant', 'هامستينج dominant');
  }

  // 2c. جلوتس: لازم في الأقل في يوم واحد
  if (!weekHasGroup('hamstrings', 'glutes')) {
    // نفضل اليوم اللي فيه هامستينج
    const targetDay = legDayIndices.find(i =>
      exercisesHaveGroup(planDays[i], 'hamstrings', 'dominant')
    ) ?? legDayIndices[legDayIndices.length - 1];
    injectGroup(targetDay, 'hamstrings', 'glutes', 'جلوتس');
  }

  // 2d. سمانة: لازم في كل يوم أرجل منفصل
  legDayIndices.forEach(di => {
    const day = planDays[di];
    if (!exercisesHaveGroup(day, 'calves', null)) {
      const calvesKey = isHome ? 'all' : 'gastrocnemius';
      injectGroup(di, 'calves', calvesKey, 'سمانة');
    }
  });

  // 2e. ضامة (جيم فقط): لازم في كل يوم أرجل منفصل
  if (!isHome) {
    legDayIndices.forEach(di => {
      if (!exercisesHaveGroup(planDays[di], 'adductors', null)) {
        injectGroup(di, 'adductors', 'all', 'ضامة');
      }
    });
  }

  // 2g. تحقق إضافي: لو يوم أرجل مخصص للكوادز فقط - ضيف isolation للهامستينج
  // ولو يوم مخصص للهامستينج فقط - ضيف كوادز compound
  legDayIndices.forEach(di => {
    const day = planDays[di];
    const hasQuads = exercisesHaveGroup(day, 'quads', null);
    const hasHam   = exercisesHaveGroup(day, 'hamstrings', null);
    // يوم فيه كوادز بس بدون هامستينج - ضيف على الأقل glutes (أخف من dominant)
    if (hasQuads && !hasHam) {
      injectGroup(di, 'hamstrings', 'glutes', 'جلوتس (تكامل يوم كوادز)');
    }
    // يوم فيه هامستينج بس بدون كوادز - ضيف كوادز isolation (مش compound عشان متحملش عليه)
    if (hasHam && !hasQuads) {
      injectGroup(di, 'quads', 'isolation', 'كوادز isolation (تكامل يوم هامستينج)');
    }
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIX #3: GUARANTEED WARMUP & COOLDOWN FOR EVERY DAY
// Ensures every training day has a non-empty warm and stretch,
// regardless of split template. Falls back to smart defaults.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function guaranteeWarmupCooldown(planDays, injuries) {
  const W = WARMUP;
  const S = STRETCH;
  const hasInjury = injuries && !injuries.includes('none') && injuries.length > 0;

  planDays.forEach(day => {
    if(day.isRest) return; // تخطي أيام الراحة — لا إحماء ولا تبريد
    const groupsStr = JSON.stringify(day.groups || []);
    const isLegs    = groupsStr.includes('quads') || groupsStr.includes('hamstrings') || groupsStr.includes('calves');
    const isPush    = groupsStr.includes('chest') || (groupsStr.includes('shoulders') && groupsStr.includes('press'));
    const isPull    = groupsStr.includes('back') || groupsStr.includes('biceps');
    const isFull    = isLegs && (isPush || isPull);

    // ── Warmup guarantee ──────────────────────────────────────────────
    if (!day.warm || day.warm.length === 0) {
      if (isFull)       day.warm = [...W.full];
      else if (isLegs)  day.warm = [...W.legs_quad];
      else if (isPush)  day.warm = [...W.push];
      else if (isPull)  day.warm = [...W.pull];
      else              day.warm = [...W.upper];
    }

    // Injury-aware warmup additions
    if (hasInjury) {
      if (injuries.includes('shoulder') && (isPush || isPull)) {
        if (!day.warm.includes('Band Pull Aparts — 20×'))
          day.warm = ['Band Pull Aparts — 20×', 'Face Pulls — خفيف 15×', ...day.warm];
      }
      if (injuries.includes('knee') && isLegs) {
        if (!day.warm.includes('Terminal Knee Extension 15×/جانب'))
          day.warm = ['Terminal Knee Extension 15×/جانب', 'Mini-band Clam Shell 15×', ...day.warm];
      }
      if (injuries.includes('back') && isLegs) {
        if (!day.warm.includes('Cat-Cow 15×'))
          day.warm = ['Cat-Cow 15×', 'Dead Bug 10×', ...day.warm];
      }
    }

    // V3-03: Serratus Anterior Activation — أيام الصدر والكتف
    // الأبحاث: تفعيل Serratus قبل تمارين الضغط يحسن أداء Scapular Upward Rotation
    // ويخفض الضغط على مفصل AC بنسبة 8-12% (Ludewig & Reynolds 2009)
    if (isPush && !day.warm.some(w => w.includes('Serratus') || w.includes('Push-Up Plus'))) {
      day.warm = [...day.warm, 'Push-Up Plus — 12× (تفعيل Serratus Anterior قبل تمارين الصدر)'];
    }

    // Ramp-up set reminder (always)
    if (!day.warm.some(w => w.toLowerCase().includes('رامب') || w.toLowerCase().includes('pyramid') || w.toLowerCase().includes('50%'))) {
      day.warm.push(' Ramp-Up Sets: ابدأ ب 50% من وزن العمل ثم ارفع تدريجيا');
    }

    // ── Stretch/cooldown guarantee ────────────────────────────────────
    if (!day.stretch || day.stretch.length === 0) {
      if (isLegs)       day.stretch = [...S.legs, ...S.glutes];
      else if (isPush)  day.stretch = [...S.chest, ...S.shoulders];
      else if (isPull)  day.stretch = [...S.back, ...S.arms];
      else              day.stretch = [...S.shoulders, ...S.arms];
    }

    // Breathing reset — always end a session with this
    if (!day.stretch.some(s => s.includes('تنفس') || s.includes('Breathing') || s.includes('breathing'))) {
      day.stretch.push(' إنهاء الجلسة: تنفس عميق — 5 شهيق/زفير بطيء (تفعيل الجهاز الباراسمباثاوي)');
    }
  });

  return planDays;
}

