// ═══════════════════════════════════════════════════════════════
//  MEDICAL SAFETY LAYER — Lightweight dangerous food conflict detection
//  Hardcoded dangerous combinations — simple meal-level checks only
//  NO nutrient simulation — NO biochemical engine
// ═══════════════════════════════════════════════════════════════
const MEDICAL_CONFLICT_RULES = [
  // كلى + بوتاسيوم عال
  { conditions:['kidney'],
    // v45-NUT2: expanded to include common high-potassium Egyptian foods
    // (original list missed potato, banana, tomato, orange juice — most frequent triggers)
    dangerFoods:[
      'sbankhmtbwkha','almonds','nuts_mixed','afwkadw',  // original
      'btatsmslwqa','btatsmshwya','btatamslwqa',        // بطاطا — very high K
      'mwz','tmr','tmr',                               // فاكهة عالية البوتاسيوم
      // عصائر — K مركز
      'tmatm',                       // طماطم
      'adsasfrmtbwkh','hmsmslwq','fwlmdms',                         // بقوليات — K + فوسفور
      'nuts_mixed','zbdakajw','jwz','bykan'                  // مكسرات إضافية
    ],
    msg:'بوتاسيوم/فوسفور مرتفع — يحذر لمشاكل الكلى، استشر طبيبك', severity:'warning' },
  // نقرس + بيورين عال
  { conditions: ['gout'],
    // v44: all 6 original IDs were broken placeholders. Replaced with 22 verified FOOD_DB IDs.
    dangerFoods: [
      'kbda_frakh_mshwya','kbda_askndrany','qwans_frakh',
      'twna_frysh_mshwya','twna_myah','twna_layt','twna_mdkhna','qta_twna_balzyt',
      'srdyn_mshwy','srdyn_malb','srdyn_mqly','srdyn_snyh',
      'jmbry_mslwq','jmbry_mqly','jmbry_balfrn','jmbry_banyh',
      'lhm_mfrwm_bqry_qlyl_aldhn','lhm_mfrwm_bqry_mtwst_aldhn',
      'lhm_bqry_mslwq','shrah_lhm_mshwya','kbab_mshwy','kbab_hla'
    ],
    msg: 'محتوى بيورين مرتفع — يجنب أو يقلل جدا في النقرس', severity: 'warning' },
  // سكري + سكريات سريعة
  { conditions:['diabetes','insulin'], dangerFoods:['tmr','mwz','btykh','manjw',],
    msg:'سكريات سريعة — خطر ارتفاع السكر المفاجئ', severity:'critical' },
  // ضغط + صوديوم عال
  { conditions:['bp'], dangerFoods:['soy_sauce','jbnafyta','jbnarwmy'],
    msg:'صوديوم مرتفع — يحذر مع ضغط الدم', severity:'warning' },
  // غدة درقية + صليبيات نيئة (مطبوخة مقبولة)
  { conditions:['thyroid'], dangerFoods:['brwkly','qrnbyt'],
    msg:'صليبيات نيئة — تناولها مطبوخة فقط مع مشاكل الغدة', severity:'advisory' },
  // كبد دهني + سكر مرتفع
  { conditions:['fatty-liver'], dangerFoods:['tmr','mwz','btykh'],
    msg:'سكريات مرتفعة — يجنب مع الكبد الدهني', severity:'warning' },
  // ── GAP-1: Hypothyroid — raw goitrogens advisory ──────────────────────────
  { conditions:['hypothyroid'], dangerFoods:['brwkly','qrnbyt','sbankhmtbwkha'],
    msg:'صليبيات نيئة — يؤكل مطبوخا فقط مع قصور الغدة', severity:'warning' },
  // ── GAP-1: Hyperthyroid — high-iodine foods and caffeine ─────────────────
  { conditions:['hyperthyroid'], dangerFoods:['srdyn_mshwy','coffee_black'],
    msg:'يود مرتفع أو كافيين — يجنب مع فرط نشاط الغدة', severity:'critical' },
  // حموضة + مثيرات حموضة
  { conditions:['gerd'], dangerFoods:['brtqal'],
    msg:'مثير للحموضة — يجنب مع ال GERD', severity:'warning' },
  // حساسية لاكتوز + ألبان
  { conditions:['lactose'], dangerFoods:['lbnkhalyaldsm','zbadytbyay','zbadytbyay','jbnaqrysh'],
    msg:'يحتوي لاكتوز — يجنب مع حساسية اللاكتوز', severity:'critical' },
  // حساسية جلوتين + قمح
  { conditions:['gluten'], dangerFoods:['ayshbldy','ayshqmhkaml','mkrwnamslwqa','shwfanmtbwkh','twrtyla'],
    msg:'يحتوي جلوتين — ممنوع تماما مع الحساسية', severity:'critical' },
  // القولون العصبي + FODMAP مرتفع
  { conditions:['ibs'], dangerFoods:['brwkly','qrnbyt','hmsmslwq','adsasfrmtbwkh','bsl','fwlmdms','zramslwqa','btykh','shwfanmtbwkh','nuts_mixed','brghlmtbwkh'],
    msg:'تهيج للقولون العصبي (FODMAP مرتفع) — ينصح بتجنبه أو الحد منه', severity:'warning' }
];

// دالة فحص الصراعات الطبية في وجبة — lightweight, no complex math
function detectMedicalConflicts(portions, healthConditions) {
  if (!portions || !portions.length || !healthConditions || !healthConditions.length) return [];
  const ids = portions.map(p => p.food.id);
  const conflicts = [];
  MEDICAL_CONFLICT_RULES.forEach(rule => {
    const conditionMatch = rule.conditions.some(c => healthConditions.includes(c));
    if (!conditionMatch) return;
    const dangerMatch = rule.dangerFoods.filter(f => ids.includes(f));
    if (dangerMatch.length > 0) {
      const foodNames = dangerMatch.map(id => {
        const f = (typeof FOOD_DB !== 'undefined' ? FOOD_DB : FOOD_DB_RAW).find(x => x.id === id);
        return f ? f.nameAr : id;
      }).join('، ');
      conflicts.push({ severity: rule.severity, msg: rule.msg, foods: foodNames });
    }
  });
  return conflicts;
}

// ═══════════════════════════════════════════════════════════════
//  MEAL VALIDATION ENGINE
//  Checks if a meal composition is humanly logical
// ═══════════════════════════════════════════════════════════════

function validateMealComposition(mealType, portions) {
  const issues = [];
  const foods = portions.map(p => p.food);
  const foodIds = foods.map(f => f.id);
  const intel = (id) => FOOD_INTELLIGENCE[id] || {};

  // Rule 1: Breakfast must have real energy source + protein
  if (mealType === 'breakfast') {
    const hasProtein = foods.some(f => ['protein','dairy'].includes(f.cat));
    const hasEnergy  = foods.some(f => ['carb'].includes(f.cat) || intel(f.id).mealRole === 'fruit_carb');
    if (!hasProtein) issues.push({ severity:'high', msg:'الفطار يحتاج مصدر بروتين' });
    if (!hasEnergy)  issues.push({ severity:'medium', msg:'أضف مصدر طاقة للفطار' });
    // Block: cheese + cucumber only
    const hasOnlyCheese = foods.every(f => ['lettuce'].includes(f.id) || f.id === 'jbnaqrysh');
    if (hasOnlyCheese && foods.length <= 2) issues.push({ severity:'high', msg:'فطار ضعيف — أضف مصدر طاقة حقيقي' });
  }

  // Rule 2: Pre-workout — no heavy fats, no slow digestion
  if (mealType === 'pre') {
    const heavyFat = foods.some(f => f.fat > 15 && intel(f.id).digestionSpeed === 'slow');
    const onlyBanana = foods.length === 1 && foodIds.includes('mwz');
    if (heavyFat) issues.push({ severity:'high', msg:'قبل التمرين: تجنب الدهون الثقيلة بطيئة الهضم' });
    if (onlyBanana) issues.push({ severity:'medium', msg:'أضف بروتين خفيف مع الموز قبل التمرين' });
    const slowDig = foods.filter(f => intel(f.id).digestionSpeed === 'very_slow');
    if (slowDig.length) issues.push({ severity:'high', msg:'تجنب الهضم البطيء جدا قبل التمرين' });
  }

  // Rule 3: Post-workout must have strong protein + carb
  if (mealType === 'post') {
    const mainProteins = foods.filter(f => f.cat === 'protein' && f.pro >= 20);
    const hasCarb = foods.some(f => ['carb','fruit'].includes(f.cat));
    if (!mainProteins.length) issues.push({ severity:'high', msg:'بعد التمرين: يجب بروتين قوي (25ج+) للتعافي' });
    if (!hasCarb && !['keto','carnivore'].includes(DE.selectedDiet))
      issues.push({ severity:'medium', msg:'بعد التمرين: أضف كارب لاستعادة الجليكوجين' });
  }

  // Rule 4: Dinner — no multiple heavy proteins, no heavy fat
  if (mealType === 'dinner') {
    const heavyProteins = foods.filter(f => f.cat === 'protein' && f.pro > 25);
    if (heavyProteins.length > 1) issues.push({ severity:'medium', msg:'العشاء: اكتف ببروتين واحد رئيسي' });
    const totalFat = portions.reduce((s,p) => s + p.fat, 0);
    if (totalFat > 30) issues.push({ severity:'medium', msg:'العشاء: قلل الدهون لتسهيل الهضم والنوم' });
  }

  // Rule 5: No multiple main proteins (except post-workout)
  if (mealType !== 'post') {
    const mainProteins = foods.filter(f => {
      const role = intel(f.id).mealRole;
      return role === 'main_protein';
    });
    if (mainProteins.length > 1) {
      const names = mainProteins.slice(1).map(f => f.nameAr).join(' + ');
      issues.push({ severity:'medium', msg:`تحديد بروتين رئيسي واحد — إزالة ${names}` });
    }
  }

  // Rule 6: Snack should not be a heavy meal
  if (mealType === 'snack') {
    const totalCals = portions.reduce((s,p) => s + p.cals, 0);
    if (totalCals > 350) issues.push({ severity:'medium', msg:'السناك يجب أن يكون خفيفا (< 350 سعرة)' });
  }

  // Rule 7: Check incompatible pairs
  foods.forEach(f => {
    const incompat = (intel(f.id).incompatibleWith || []);
    incompat.forEach(incompId => {
      if (foodIds.includes(incompId)) {
        const incompFood = (typeof FOOD_MAP !== 'undefined') ? FOOD_MAP.get(incompId) : (FOOD_DB ? FOOD_DB.find(x => x.id === incompId) : null); // FIX-2
        const incompName = incompFood ? incompFood.nameAr : incompId;
        issues.push({ severity:'low', msg:`${f.nameAr} + ${incompName} — ليست توليفة مثالية` });
      }
    });
  });

  return issues;
}

// ═══════════════════════════════════════════════════════════════
//  SMART FOOD SCORER
//  Returns score 0-100 for a food in a given context
// ═══════════════════════════════════════════════════════════════

// ── Data-driven meal-type fitness (منطق تكوين الوجبة الواقعي) ────────
// يقيم ملاءمة الطعام لنوع الوجبة من الفئة والماكروز وقائمة mealTypes في
// قاعدة البيانات — بدل قوائم معرفات إنجليزية ميتة. النتيجة 0-100 (≈50 محايد).
function _deriveMealTypeFitness(food, mealType) {
  const cat  = food.cat;
  const cals = food.cal || 0;
  const carbPct = cals > 0 ? (food.carb * 4) / cals : 0;
  const proPct  = cals > 0 ? (food.pro  * 4) / cals : 0;
  const fatPct  = cals > 0 ? (food.fat  * 9) / cals : 0;
  const gi      = (typeof food.glycemicIndex === 'number') ? food.glycemicIndex : null;
  const processed = ['high','very_high'].includes(food.processedLevel);

  const byCat = {
    breakfast: { carb:62, dairy:68, fruit:64, protein:60, veggie:48, fat:52, snack:46 },
    pre:       { carb:70, fruit:68, dairy:56, protein:54, veggie:42, fat:36, snack:50 },
    post:      { protein:72, carb:66, dairy:62, fruit:56, veggie:46, fat:44, snack:44 },
    lunch:     { protein:68, carb:64, veggie:62, dairy:50, fat:52, fruit:46, snack:38 },
    dinner:    { protein:66, veggie:64, dairy:56, fat:52, carb:48, fruit:48, snack:40 },
    snack:     { fruit:66, dairy:64, snack:60, fat:58, protein:54, veggie:48, carb:46 },
  };
  let s = (byCat[mealType] && byCat[mealType][cat] != null) ? byCat[mealType][cat] : 50;

  // إشارة قاعدة البيانات: mealTypes تشمل كل الخانات (breakfast/pre/lunch/post/dinner/snack)
  // وهي تصنيف المنسق نفسه — أصدق إشارة لملاءمة الوجبة. نطابق مباشرة.
  if (Array.isArray(food.mealTypes) && food.mealTypes.length) {
    if (food.mealTypes.includes(mealType)) s += 10;  // مخصص لهذه الوجبة في القاعدة
    else s -= 6;                                      // غير مدرج لهذه الوجبة - أقل ملاءمة
  }

  if (mealType === 'pre') {
    if (gi != null && gi >= 60) s += 6;        // طاقة سريعة مفيدة قبل التمرين
    if (fatPct > 0.45) s -= 10;                // الدهون تبطئ الطاقة
  }
  if (mealType === 'post') {
    if (proPct >= 0.40) s += 8;                // بروتين عال للاستشفاء
    if (cat === 'carb' && gi != null && gi >= 55) s += 4; // كارب لتعويض الجلايكوجين
  }
  if (mealType === 'breakfast' && cat === 'carb' && gi != null && gi < 55) s += 5;
  if (mealType === 'dinner') {
    if (carbPct > 0.55) s -= 8;                // عشاء ثقيل الكارب أقل ملاءمة
    if (proPct >= 0.40) s += 4;                // بروتين خفيف مناسب
  }
  if (mealType === 'lunch' && proPct >= 0.30 && carbPct >= 0.20) s += 4; // طبق متكامل

  if (processed) s -= 8;                       // مصنع بشدة أقل ملاءمة
  return Math.max(20, Math.min(90, s));
}

function scoreFoodForContext(food, mealType, context) {
  // لا نرجع درجة ثابتة (50) للأطعمة غير المدرجة في FOOD_INTELLIGENCE (القاعدة
  // العربية)؛ بدلا من ذلك نشتق ملاءمة الوجبة من بيانات الطعام نفسها.
  const intel = FOOD_INTELLIGENCE[food.id] || {};

  const { diet, goal, health, problems } = context;
  let score = 50;

  // Base meal type score — درجات الذكاء الجاهزة إن وجدت، وإلا اشتقاق من البيانات
  const intelMealScore = {
    breakfast: intel.breakfastScore,
    pre:       intel.preWorkoutScore,
    post:      intel.postWorkoutScore,
    lunch:     intel.lunchScore,
    dinner:    intel.dinnerScore,
    snack:     intel.snackScore
  }[mealType];
  score = (typeof intelMealScore === 'number')
    ? intelMealScore * 10
    : _deriveMealTypeFitness(food, mealType); // 0-100

  // Health condition adjustments
  health.forEach(hc => {
    const rules = HEALTH_MEAL_RULES[hc];
    if (!rules) return;
    if (rules.avoidFoods && rules.avoidFoods.includes(food.id)) score -= 40;
    if (rules.preferFoods && rules.preferFoods.includes(food.id)) score += 20;
    // Avoid high insulin impact for diabetes/insulin
    if (['diabetes','insulin'].includes(hc) && ['very_high','high'].includes(intel.insulinImpact)) score -= 30;
  });

  // Diet adjustments
  const constraints = DIET_CONSTRAINTS[diet];
  if (constraints) {
    if (constraints.forbiddenFoods.includes(food.id)) score = 0;
    if (constraints.preferredFoods && constraints.preferredFoods.includes(food.id)) score += 15;

    // ── Carb timing (منطق توقيت الكارب لكل دايت) ───────────────────
    // ينفذ نية carbTiming فعليا بدل أن تكون إعدادا ميتا: يعاقب الأطعمة
    // عالية الكارب في الأوقات غير المناسبة حسب النظام. يعتمد على جرامات الكارب
    // الفعلية (تشمل الفاكهة/الألبان) لا فئة "carb" فقط — فيشمل الكيتو/اللوكارب.
    const carbHeavy = (food.carb || 0) >= 20;
    if (carbHeavy && constraints.carbTiming) {
      const morningOrPre = (mealType === 'breakfast' || mealType === 'pre');
      if (constraints.carbTiming === 'morning_and_preworkout_only' && !morningOrPre) {
        score -= 12; // الكارب مسموح صباحا/قبل التمرين فقط (لو كارب)
      } else if (constraints.carbTiming === 'avoid_all') {
        score -= 15; // كيتو: تقليل أي كارب متبق في أي وجبة
      }
    }
  }

  // Adherence bonus for hard-to-follow problems
  if (problems.includes('adherence') || problems.includes('time')) {
    score += (intel.adherenceScore || 5) * 2;
  }
  if (problems.includes('satiety') || problems.includes('hunger')) {
    score += (intel.satietyLevel || 5) * 2;
  }

  // ── QUALITY PATCH 1: Goal Scoring Refinement ──────────────────────
  // Previous: cut=+10 protein, bulk=+8 carb only — too coarse.
  // Now: multi-signal scoring per goal using existing food fields.
  if (goal === 'cut') {
    // Protein foods — lean sources prioritized over fatty
    if (food.cat === 'protein') {
      score += 10;
      // Lean protein gets extra boost (thermogenic effect + satiety)
      if (['lean','healthy_omega3'].includes(intel.fatQuality)) score += 6;
      // Fatty protein slightly penalized on cut (e.g. chicken_thigh vs breast)
      if (intel.fatQuality === 'saturated') score -= 4;
    }
    // Penalty for ultra-processed / high inflammation foods on cut
    // (cortisol, water retention, metabolic interference)
    if (['high','very_high'].includes(food.processedLevel)) score -= 12;
    if (food.inflammationScore >= 7) score -= 8;
    // Veggies: high value on cut (volume, fiber, micronutrients)
    if (food.cat === 'veggie') score += 8;
    // High GI carbs on cut: lower priority (insulin spike - fat storage)
    if (food.cat === 'carb' && food.glycemicIndex >= 70) score -= 8;
    // Healthy fats on cut: small boost (satiety, hormonal support)
    if (food.cat === 'fat' && intel.fatQuality === 'healthy_omega3') score += 5;
  }

  if (goal === 'bulk') {
    // Carbs: still boosted, but quality carbs get more
    if (food.cat === 'carb') {
      score += 8;
      // Complex carbs (lower GI) get extra boost — sustained energy, less fat spillover
      if (food.glycemicIndex > 0 && food.glycemicIndex < 55) score += 6;
      // High-GI still OK on bulk but less preferred than complex
    }
    // Protein on bulk: complete proteins preferred for muscle synthesis
    if (food.cat === 'protein' && intel.proteinQuality === 'complete') score += 8;
    // Healthy fats on bulk: essential for anabolic hormone production
    if (food.cat === 'fat' && ['healthy_omega3','healthy'].includes(intel.fatQuality)) score += 6;
    // Dense calorie foods preferred on bulk (easier to hit surplus)
    if (food.cal >= 200 && !['high','very_high'].includes(food.processedLevel)) score += 4;
    // Ultra-processed still penalized on bulk — poor micronutrient density
    if (['very_high'].includes(food.processedLevel)) score -= 8;
  }

  if (goal === 'recomp') {
    // Recomp: protein quality matters most (muscle synthesis while cutting fat)
    if (food.cat === 'protein') {
      score += 12;
      if (intel.proteinQuality === 'complete') score += 6;
      if (['lean','healthy_omega3'].includes(intel.fatQuality)) score += 4;
    }
    // Complex carbs preferred (fuel workouts, low insulin stress)
    if (food.cat === 'carb' && food.glycemicIndex > 0 && food.glycemicIndex < 60) score += 6;
    // High GI carbs: small penalty (insulin sensitivity key for recomp)
    if (food.cat === 'carb' && food.glycemicIndex >= 70) score -= 6;
    // Veggies: high value (micronutrients, fiber, volume)
    if (food.cat === 'veggie') score += 7;
    // Ultra-processed foods: significant penalty (hormonal interference)
    if (['high','very_high'].includes(food.processedLevel)) score -= 14;
    // Low inflammation foods: bonus (recovery, body composition)
    if (food.inflammationScore && food.inflammationScore <= 2) score += 5;
  }

  // ── QUALITY PATCH 2: Satiety Intelligence ─────────────────────────
  // Previous: satiety problem - satietyLevel * 2 only.
  // Now: fiber density and protein density also contribute to satiety scoring.
  if (problems.includes('satiety') || problems.includes('hunger')) {
    // Fiber is the strongest satiety signal after protein
    const fiberBonus = { very_high: 10, high: 7, medium: 4, low: 1, none: 0 };
    score += fiberBonus[food.fiberLevel] || 0;
    // High-protein foods: extra satiety signal (protein is most satiating macro)
    if (food.cat === 'protein' && food.pro >= 20) score += 5;
    // Very fast digesting foods reduce satiety — penalty on hunger problems
    if (intel.digestionSpeed === 'very_fast' && mealType !== 'pre') score -= 6;
    // Slow digesting foods: bonus for hunger/satiety problems
    if (['slow','very_slow'].includes(intel.digestionSpeed)) score += 5;
  }

  // ── QUALITY PATCH 3: Omega-3 & Anti-Inflammatory Scoring ──────────
  // Previous: fatQuality:'healthy_omega3' existed but was never scored.
  // Now: foods with omega-3 fat quality or low inflammation score get boosted
  // for: arthritis/joint health (gout), cardiovascular (bp/cholesterol),
  // general health bonus, and anti-inflammatory diet support.
  if (intel.fatQuality === 'healthy_omega3') {
    // Universal small bonus — omega-3 is evidence-based for all goals
    score += 8;
    // Extra boost for conditions that directly benefit from omega-3
    if (health.includes('bp'))          score += 6;
    if (health.includes('cholesterol')) score += 6;
    if (health.includes('gout'))        score += 5;  // anti-inflammatory
    if (health.includes('thyroid'))     score += 4;  // thyroid function support
    if (health.includes('hypothyroid')) score += 6;  // omega-3 reduces thyroid inflammation — key for hypothyroid
    if (health.includes('hyperthyroid')) score += 4; // anti-inflammatory — calms autoimmune Graves' mechanism
    if (health.includes('pcos'))        score += 8;  // ── HOTFIX P4: raised from +5 — omega-3 is first-line PCOS intervention
  }

  // ── GAP-1: Hypothyroid — Selenium, Iodine, Zinc scoring ──────────────────
  // Selenium is essential for T4 - T3 conversion (deiodinase enzymes).
  // Iodine is the building block of thyroid hormones T3/T4.
  // Zinc activates thyroid hormone receptors. Deficiency - worsened hypothyroid.
  if (health.includes('hypothyroid')) {
    // Selenium-rich foods: highest priority for hypothyroid
    const _seleniumRich = ['twna_myah','twna_frysh_mshwya','slmwn_mshwy','srdyn_mshwy','byd_mslwq','sdr_dyk_rwmy_mshwy','sdr_frakh_mshwy'];
    if (_seleniumRich.includes(food.id)) score += 10;
    // Zinc-rich lean proteins: important for T3 receptor activation
    if (food.cat === 'protein' && intel.proteinQuality === 'complete') score += 5;
    // Complex carbs: hypothyroid patients often have slow gastric emptying — complex better
    if (food.cat === 'carb' && food.glycemicIndex > 0 && food.glycemicIndex < 60) score += 4;
    // Raw goitrogens: penalise (cooked are fine — handled in preferFoods as cooked)
    const _rawGoitrogens = ['brwkly','qrnbyt','sbankhmtbwkha'];
    // Note: penalty only applies in raw context — HEALTH_MEAL_RULES.hypothyroid.avoidRaw handles advisory
    // High-iodine penalty for processed/non-seafood sources: none — iodine needed
    // High inflammation: extra penalty (inflammation suppresses T4 - T3 conversion)
    if (food.inflammationScore !== undefined && food.inflammationScore >= 7) score -= 8;
  }

  // ── GAP-1: Hyperthyroid — anti-iodine, anti-catabolism, calcium scoring ──
  // Hyperthyroid accelerates bone loss (PTH disruption) and muscle catabolism.
  // Must avoid: excess iodine (triggers more T3/T4), excess caffeine (palpitations).
  // Must prioritize: calcium (bone), magnesium (palpitations/anxiety), adequate protein.
  if (health.includes('hyperthyroid')) {
    // Calcium-rich foods: critical — hyperthyroid causes bone loss via PTH
    const _calciumRich = ['lbnkhalyaldsm','zbadytbyay','zbadytbyay','jbnaqrysh','almonds'];
    if (_calciumRich.includes(food.id)) score += 10;
    // Magnesium-rich: reduces palpitations and neuromuscular excitability
    const _magnesiumRich = ['almonds','sbankhmtbwkha','shwfanmtbwkh','arzbnymtbwkh','dark_choc'];
    if (_magnesiumRich.includes(food.id)) score += 7;
    // Anti-catabolism: adequate protein needed — hyperthyroid increases protein turnover
    if (food.cat === 'protein' && intel.proteinQuality === 'complete') score += 6;
    // Cruciferous: therapeutic mild goitrogens — score BONUS for hyperthyroid
    const _mildGoitrogens = ['brwkly','qrnbyt'];
    if (_mildGoitrogens.includes(food.id)) score += 8;
    // Very high iodine foods: penalty — accelerates already overactive gland
    const _highIodine = ['srdyn_mshwy','twna_frysh_mshwya'];
    if (_highIodine.includes(food.id)) score -= 15;
    // Caffeine penalty: worsens tachycardia and anxiety
    if (food.id === 'coffee_black') score -= 20;
    // Adequate carbs needed: hyperthyroid has high energy demand — don't restrict too much
    if (food.cat === 'carb' && food.glycemicIndex > 0 && food.glycemicIndex < 65) score += 4;
  }
  // Anti-inflammatory score from extended FOOD_DB (1=very anti-inflam, 10=pro-inflam)
  if (food.inflammationScore !== undefined) {
    if (food.inflammationScore <= 2)  score += 6;   // strongly anti-inflammatory
    else if (food.inflammationScore <= 4) score += 3; // mildly anti-inflammatory
    else if (food.inflammationScore >= 8) score -= 8; // pro-inflammatory penalty
    else if (food.inflammationScore >= 6) score -= 4;
    // ── HOTFIX P4 — PCOS: extra anti-inflammatory scoring ──────────────
    // PCOS is driven by systemic inflammation + androgen excess;
    // anti-inflammatory foods reduce both pathways.
    if (health.includes('pcos')) {
      if (food.inflammationScore <= 2)  score += 7;  // strongly anti-inflam: major PCOS benefit
      else if (food.inflammationScore <= 4) score += 4; // mildly anti-inflam: good for PCOS
      else if (food.inflammationScore >= 7) score -= 6; // pro-inflammatory: penalise for PCOS
    }
  }
  // ── HOTFIX P4 — PCOS: low-GI food scoring boost ─────────────────────
  // Low glycemic index reduces insulin spikes — core PCOS management target.
  if (health.includes('pcos') && food.glycemicIndex !== undefined) {
    if (food.glycemicIndex <= 35)      score += 6;  // very low GI — strong benefit
    else if (food.glycemicIndex <= 55) score += 3;  // low-medium GI — benefit
    else if (food.glycemicIndex >= 70) score -= 8;  // high GI — significant PCOS penalty
  }

  // ── GAP-6: Fatty Liver — Fructose-specific scoring penalty ─────────────
  // Fructose drives De Novo Lipogenesis in the liver uniquely — independent
  // of total calories. High-fructose foods must be penalized specifically for
  // fatty-liver, not just generally as "sugary foods".
  if (health.includes('fatty-liver')) {
    const _highFructoseFoods = ['tmr','mwz','btykh'];
    const _highFructoseIDs   = _highFructoseFoods;
    if (_highFructoseIDs.includes(food.id)) {
      score -= 18; // severe penalty — fructose is the primary driver of NAFLD
      LOG(`GAP-6: Fatty-liver fructose penalty on ${food.id}`);
    }
    // Omega-3 and choline-rich foods: strong positive for NAFLD
    const _naflBenefit = ['slmwn_mshwy','srdyn_mshwy','byd_mslwq'];
    if (_naflBenefit.includes(food.id)) score += 8;
    // Soluble fiber (oats): reduces hepatic DNL indirectly via gut-liver axis
    if (food.id === 'shwfanmtbwkh' || food.id === 'shwfanmtbwkh') score += 6;
    // Cruciferous (broccoli): sulforaphane — clinical evidence in NAFLD reduction
    if (['brwkly','qrnbyt'].includes(food.id)) score += 5;
  }

  // ── QUALITY PATCH 4: Fiber Awareness ──────────────────────────────
  // fiberLevel is in FOOD_DB but was never used in scoring.
  // Now: fiber scores affect: hunger, satiety, bp (potassium/fiber),
  // diabetes (glycemic control), IBS (nuanced — high fiber not always good),
  // fatty-liver (fiber aids liver health), cholesterol (soluble fiber).
  if (food.fiberLevel) {
    const fiberIsHigh = ['high','very_high'].includes(food.fiberLevel);
    const fiberIsMed  = food.fiberLevel === 'medium';
    // Fiber bonus for conditions that benefit
    if (fiberIsHigh) {
      if (health.includes('bp'))           score += 5;
      if (health.includes('cholesterol'))  score += 5;
      if (health.includes('fatty-liver'))  score += 4;
      if (health.includes('slow-meta'))    score += 4;  // fiber aids metabolic rate
    }
    if (fiberIsHigh || fiberIsMed) {
      if (health.includes('diabetes'))     score += 4;  // slows glucose absorption
    }
    // IBS: high fiber foods can trigger — penalty if IBS patient
    if (fiberIsHigh && health.includes('ibs')) score -= 8;
  }

  // ── QUALITY PATCH 5: Sodium Awareness ────────────────────────────
  // sodiumLevel is in FOOD_DB (very_high/high/medium/low) but was ignored.
  // Now: high-sodium foods penalized for bp, cholesterol, kidney conditions.
  if (food.sodiumLevel) {
    const sodiumPenaltyMap = { very_high: -15, high: -8, medium: -2 };
    const baseSodiumPenalty = sodiumPenaltyMap[food.sodiumLevel] || 0;
    if (health.includes('bp')) {
      score += baseSodiumPenalty * 1.5; // stronger penalty for hypertension
    } else if (health.includes('kidney')) {
      score += baseSodiumPenalty * 1.3; // kidney disease: sodium restriction
    } else if (health.includes('cholesterol')) {
      score += baseSodiumPenalty * 0.8; // mild penalty for cardiovascular
    }
    // Very high sodium: small universal penalty (water retention, health)
    if (food.sodiumLevel === 'very_high') score -= 4;
  }

  // ── QUALITY PATCH 6: Emotional Eating Handling ────────────────────
  // 'emotional' problem was UI-only — zero impact on food scoring.
  // Emotional eating is driven by: dopamine reward, palatability, density.
  // Strategy: prioritize high-satiety, high-protein, structured foods
  // that reduce impulsive eating; penalize ultra-processed reward foods.
  if (problems.includes('emotional')) {
    // High satiety + slow digesting = reduces emotional eating urges
    const satiety = intel.satietyLevel || 5;
    if (satiety >= 8) score += 8;
    else if (satiety >= 6) score += 4;
    // Slow digesting foods: reduce cravings between meals
    if (['slow','very_slow'].includes(intel.digestionSpeed)) score += 5;
    // Structured complete protein: reduces emotional hunger signals
    if (food.cat === 'protein' && intel.proteinQuality === 'complete') score += 7;
    // Ultra-processed and high-sugar foods: PENALTY for emotional eaters
    // (these are the trigger foods for reward-driven eating cycles)
    if (['high','very_high'].includes(food.processedLevel)) score -= 15;
    if (['high','very_high'].includes(food.sugarLevel)) score -= 10;
    // Veggies and complex carbs: stabilize blood sugar - fewer emotional triggers
    if (food.cat === 'veggie') score += 6;
    if (food.cat === 'carb' && food.glycemicIndex > 0 && food.glycemicIndex < 55) score += 4;
    // High GI foods spike then crash blood sugar — emotional eating trigger
    if (food.glycemicIndex >= 70) score -= 8;
  }

  // ── GAP-8: Glycemic Load (GL) correction layer ───────────────────────────
  // GI alone is misleading — watermelon GI=72 but GL=4 (safe for most people).
  // GL = GI × carb_per_serving / 100. We use the stored glycemicLoad from FOOD_DB.
  // This layer CORRECTS over-penalizations from GI-only scoring above.
  // Applied for: diabetes, insulin, pcos — conditions where GL matters most.
  if (food.glycemicLoad !== undefined && food.glycemicLoad !== null) {
    const gl = food.glycemicLoad;
    const isGlycemicSensitive = health.includes('diabetes') || health.includes('insulin') || health.includes('pcos');
    if (isGlycemicSensitive) {
      // GL-based scoring: more accurate than GI for real meal impact
      if (gl <= 5)  score += 6;   // very low GL — safe even for diabetics (e.g. watermelon, berries)
      else if (gl <= 10) score += 3; // low GL — good choice
      else if (gl >= 25) score -= 8; // high GL — significant blood sugar impact
      else if (gl >= 20) score -= 4; // moderate-high GL — be cautious
    }
    // Universal: very low GL foods get a small universal bonus (nutrient-dense, low insulin impact)
    if (gl <= 5 && food.cat !== 'protein' && food.cat !== 'fat') score += 3;
  }

  // ── BP-LOWCARB DASH SCORING LAYER (additive) ─────────────────────────────
  // Activated ONLY when: bp ∈ health AND diet ∈ {lowcarb, keto, carnivore}.
  // Purpose: compensate for removed 40% carb floor by boosting keto-friendly
  // potassium-rich / DASH-aligned foods and penalising high-sodium ones harder.
  // Zero impact on any other combination.
  if (health.includes('bp') && ['lowcarb','keto','carnivore'].includes(diet)) {
    // Tier-1: potassium-rich AND keto-safe (carb ≤ 10g) — strong DASH boost
    const _bpDashTier1 = [
      'sbankhmtbwkha','brwkly','kwsa','lettuce','mushroom',
      'qrnbyt','arugula_rocket','asparagus_veg','mushroom_fresh',
      'kousa_squash','slmwn_mshwy','afwkadw','avocado_half','twna_frysh_mshwya',
      'srdyn_mshwy','tilapia'
    ];
    // Tier-2: potassium-rich but moderate carb (10-15g) — allowed on lowcarb
    const _bpDashTier2 = [
      'tmatm','jzr','pumpkin','eggplant_grilled',
      'zbadytbyay','jbnaqrysh','lhm_bqry_mslwq','sdr_dyk_rwmy_mshwy',
      'sdr_frakh_mshwy','byd_mslwq','egg_whites','twna_myah'
    ];
    if (_bpDashTier1.includes(food.id))      score += 12; // high potassium + keto-safe
    else if (_bpDashTier2.includes(food.id)) score += 6;  // good potassium + lowcarb-safe

    // Extra sodium penalty (on top of Quality Patch 5) for bp+lowcarb context
    // Sodium control becomes more critical when we can't rely on high-carb fiber sources
    if (food.sodiumLevel === 'very_high') score -= 10;  // stacks on existing -15 from Patch 5
    else if (food.sodiumLevel === 'high') score -= 5;   // stacks on existing -8 from Patch 5

    // Penalise high-sodium processed proteins common on keto (sausages, cured meats)
    if (['very_high','high'].includes(food.processedLevel) &&
        ['protein','dairy'].includes(food.cat) &&
        food.sodiumLevel && food.sodiumLevel !== 'low') {
      score -= 8;
    }
  }
  // ── END BP-LOWCARB DASH SCORING LAYER ────────────────────────────────────

  return Math.max(0, Math.min(100, score));
}

function calcMealQuality(mealType, portions, context) {
  if (!portions.length) return null;
  const foods = portions.map(p => p.food);

  const satietyScore = Math.min(10, portions.reduce((s,p) => {
    const intel = FOOD_INTELLIGENCE[p.food.id];
    const base = intel ? intel.satietyLevel || 5 : 5;
    return s + (base * p.grams / 200);
  }, 0));

  const digestionScore = (() => {
    const speeds = { very_fast:10, fast:8, medium:6, slow:4, very_slow:2 };
    const avg = foods.reduce((s,f) => {
      const intel = FOOD_INTELLIGENCE[f.id];
      return s + (speeds[intel?.digestionSpeed] || 6);
    }, 0) / foods.length;
    // For pre/dinner: higher is better. For post: medium is fine.
    if (['dinner','pre'].includes(mealType)) return avg;
    return 7; // neutral for others
  })();

  const adherenceScore = Math.round(
    foods.reduce((s,f) => {
      const intel = FOOD_INTELLIGENCE[f.id];
      return s + (intel?.adherenceScore || 7);
    }, 0) / foods.length
  );

  const validationIssues = validateMealComposition(mealType, portions);
  const qualityScore = Math.max(0, 10 - validationIssues.filter(i => i.severity === 'high').length * 3
    - validationIssues.filter(i => i.severity === 'medium').length * 1);

  return {
    quality: Math.round(qualityScore * 10),
    satiety: Math.round(Math.min(100, satietyScore * 10)),
    digestion: Math.round(digestionScore * 10),
    adherence: Math.round(adherenceScore * 10),
    issues: validationIssues
  };
}

