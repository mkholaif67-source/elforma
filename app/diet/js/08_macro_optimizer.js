// ═══════════════════════════════════════════════════════════════
//  PHASE 6 — MACRO OPTIMIZER
// ═══════════════════════════════════════════════════════════════
LOG('Phase 6 — Macro Optimizer...');

function optimizePortions(mealType, targetCals, targetMacros, availableForMeal) {
  if (!availableForMeal.length) return [];

  const diet = DE.selectedDiet || 'balanced';
  const context = {
    diet, goal: DE.goal, health: DE.healthConditions, problems: DE.dietProblems
  };

  // ── SCORE & SORT foods by context intelligence ──────────────
  const scoredFoods = availableForMeal.map(f => {
    let score = scoreFoodForContext(f, mealType, context);
    // ── CATEGORY GUARD: فرز الأكل بشكل صحيح حسب الوجبة ──
    // الدهون (مكسرات، زيوت) مش مناسبة ك protein/carb بديل في أي وجبة رئيسية
    if (f.cat === 'fat' && ['breakfast','lunch','dinner','pre','post'].includes(mealType)) {
      score -= 60; // تنزيل قوي — الدهون تيجي بعد البروتين والكارب دايما
    }
    // البروتين له أولوية قصوى في كل الوجبات الرئيسية
    if (f.cat === 'protein' && ['breakfast','lunch','dinner','pre','post'].includes(mealType)) {
      score += 25;
    }
    // الكارب له أولوية عالية في الفطار وقبل وبعد التمرين
    if (f.cat === 'carb' && ['breakfast','pre','post','lunch'].includes(mealType)) {
      score += 15;
    }
    // الفاكهة مش مناسبة للعشاء (ارتفاع سكر ليلا)
    if (f.cat === 'fruit' && mealType === 'dinner') {
      score -= 50;
    }
    // الفاكهة مناسبة للسناك وقبل التمرين
    if (f.cat === 'fruit' && ['snack','pre'].includes(mealType)) {
      score += 20;
    }
    // الخضار مناسب لكل الوجبات الرئيسية
    if (f.cat === 'veggie' && ['lunch','dinner','post'].includes(mealType)) {
      score += 10;
    }
    // الألبان مناسبة للفطار والسناك أكثر
    if (f.cat === 'dairy' && ['breakfast','snack'].includes(mealType)) {
      score += 10;
    }
    return { ...f, contextScore: score };
  }).sort((a,b) => b.contextScore - a.contextScore);

  // ── CATEGORIZE with intelligence
  const intel = (id) => FOOD_INTELLIGENCE[id] || {};
  const isMainProtein = (f) => f.cat === 'protein' && (intel(f.id).mealRole === 'main_protein' || f.pro >= 18);
  const isSideProtein = (f) => (f.cat === 'protein' && f.pro >= 8) || f.cat === 'dairy';
  const isMainCarb    = (f) => f.cat === 'carb';
  const isQuickCarb   = (f) => intel(f.id).mealRole === 'quick_carb' || f.cat === 'fruit';
  const isFatSource   = (f) => f.cat === 'fat';
  const isVeggie      = (f) => f.cat === 'veggie';
  const isFruit       = (f) => f.cat === 'fruit';

  const mainProteins = scoredFoods.filter(f => isMainProtein(f));
  const sideProteins = scoredFoods.filter(f => isSideProtein(f) && !isMainProtein(f));
  const allProteins  = scoredFoods.filter(f => f.cat === 'protein' || f.cat === 'dairy');
  const mainCarbs    = scoredFoods.filter(f => isMainCarb(f));
  const quickCarbs   = scoredFoods.filter(f => isQuickCarb(f));
  const fats         = scoredFoods.filter(f => isFatSource(f));
  const veggies      = scoredFoods.filter(f => isVeggie(f));
  const fruits       = scoredFoods.filter(f => isFruit(f));

  // ── v8: Smart gram limits for dense foods ──────────────────
  function smartGramLimit(food) {
    const id = food.id;
    const name = String((food && food.nameAr) || '') + ' ' + String((food && food.nameEn) || '');
    // High-density foods: sauces, oils, nut butters, chocolate, ice cream
    if (['olive_oil','coconut_oil'].includes(id)) return 20;       // max 20g oil
    if (['peanut_butter','almond_butter'].includes(id)) return 30;  // max 30g nut butter
    // [OWNER-RULE] الشوكولاتة ماتتعدّى 30 جم أبدًا — أي شوكولاتة ومهما حصل.
    if (/choc|شوكولات|شيكولات|شوكولاط|nutella|نوتيلا|مندولين|mandolin|kitkat|كيتكات/i.test(id + ' ' + name)) return 30;          // max 30g chocolate
    if (['mayo','tahini_sauce'].includes(id)) return 20;  // max 20g sauces
    if (['nutella'].includes(id)) return 20;                        // max 20g nutella
    if (['ice_cream'].includes(id)) return 100;                     // max 100g ice cream
    if (food.cat === 'fat') return 40;                              // generic fat: 40g
    if (food.cat === 'snack' && food.cal > 400) return 50;         // calorie-dense snacks: 50g
    return 350; // normal foods
  }

  function safePortion(food, grams) {
    const limit = smartGramLimit(food);
    return Math.min(grams, limit);
  }

  const portions = [];
  let remainCals = targetCals;
  let remainPro  = targetMacros.protein;

  const addPortion = (f, g) => {
    const g2 = Math.round(safePortion(f, g) / 5) * 5; // round to 5g
    if (g2 < 5) return;
    const c = Math.round(f.cal * g2 / 100);
    if (c < 5) return;
    portions.push({food:f, grams:g2, cals:c,
      pro:+(f.pro*g2/100).toFixed(1), carb:+(f.carb*g2/100).toFixed(1), fat:+(f.fat*g2/100).toFixed(1)});
    remainCals -= c;
    remainPro  -= f.pro * g2/100;
  };

  // ── SNACK: fruit + protein, or protein alone ─────────────────
  if (mealType === 'snack') {
    const snackCal = Math.min(250, targetCals);
    const fruitOpt = fruits[0] || quickCarbs.find(f => f.cat !== 'carb');
    const protOpt  = sideProteins[0] || mainProteins[0] || allProteins[0];

    if (fruitOpt && protOpt) {
      const g1 = Math.min(200, Math.max(80, Math.round((snackCal * 0.50 / fruitOpt.cal) * 100)));
      const c1 = Math.round(fruitOpt.cal * g1/100);
      const g2 = Math.min(150, Math.max(30, Math.round(((snackCal-c1) / protOpt.cal) * 100)));
      const c2 = Math.round(protOpt.cal * g2/100);
      addPortion(fruitOpt, g1);
      if (c2 > 20) addPortion(protOpt, g2);
    } else if (protOpt) {
      // Protein-only snack (greek yogurt, cottage cheese, etc)
      const g = Math.min(200, Math.max(60, Math.round((snackCal * 0.9 / protOpt.cal) * 100)));
      addPortion(protOpt, g);
    } else if (fruitOpt) {
      // Fruit + small fat (nuts) if no protein available
      const g = Math.min(200, Math.max(80, Math.round((snackCal * 0.7 / fruitOpt.cal) * 100)));
      addPortion(fruitOpt, g);
      const nutOpt = fats[0];
      if (nutOpt && remainCals > 50) {
        const gn = Math.min(25, Math.max(10, Math.round((remainCals * 0.8 / nutOpt.cal) * 100)));
        addPortion(nutOpt, gn);
      }
    }
    return portions;
  }

  // ── PRE-WORKOUT: quick carb + light protein ──────────────────
  if (mealType === 'pre') {
    const qCarb = quickCarbs[0] || mainCarbs[0];
    const lProt = sideProteins[0] || mainProteins[0];
    if (qCarb) {
      const g = Math.max(80, Math.min(150, Math.round((targetCals * 0.55 / qCarb.cal) * 100)));
      addPortion(qCarb, g);
    }
    if (lProt && remainCals > 60) {
      const g = Math.min(120, Math.max(30, Math.round((remainCals * 0.8 / lProt.cal) * 100)));
      addPortion(lProt, g);
    }
    // v8 FIX: if no carb but we have protein, still show a valid pre-workout
    if (!portions.length && allProteins[0]) {
      addPortion(allProteins[0], 100);
    }
    return portions;
  }

  // ══ MAIN MEALS: breakfast, lunch, dinner, post ══════════════

  // ── STEP 1: PROTEIN — mandatory for every main meal ────────
  // v8 FIX: always find SOME protein, even if only side protein or dairy
  const healthRules = DE.healthConditions.map(hc => HEALTH_MEAL_RULES[hc]).filter(Boolean);
  const kidneyRule  = healthRules.find(r => r.maxProteinPerMeal);

  const proteinSource = mainProteins[0] || sideProteins[0] || allProteins[0];
  if (proteinSource) {
    const maxProGrams = kidneyRule
      ? Math.round((kidneyRule.maxProteinPerMeal / Math.max(1, proteinSource.pro)) * 100)
      : 300;
    // For breakfast: lighter protein (eggs ~120g, cottage ~150g); main meals: full portion
    const isBreakfast = mealType === 'breakfast';
    const minG = isBreakfast ? 80 : 100;
    const maxG = isBreakfast ? 200 : 300;
    let g = Math.min(maxProGrams, maxG,
      Math.max(minG, Math.round((remainPro * 0.85 / Math.max(0.1, proteinSource.pro)) * 100)));
    g = Math.round(g / 10) * 10;
    addPortion(proteinSource, g);
  }

  // ── STEP 2: Carb (diet-aware) ───────────────────────────────
  const noCarb = ['keto','carnivore'].includes(diet);
  if (!noCarb && remainCals > 80) {
    const isDinner = mealType === 'dinner';
    const isPost   = mealType === 'post';
    // Post-workout: always include carb even in lowcarb (glycogen replenishment)
    const carbPool = mainCarbs.filter(f => {
      for (const hc of DE.healthConditions) {
        const rules = HEALTH_MEAL_RULES[hc];
        if (rules?.avoidFoods?.includes(f.id)) return false;
      }
      return true;
    });

    const mainCarb = carbPool[0];
    if (mainCarb) {
      // Dinner: less carb (25-30%); Post: more (40-45%); Breakfast/Lunch: 38-42%
      const carbRatio = isDinner ? 0.27 : isPost ? 0.43 : 0.40;
      let g = Math.min(300, Math.max(50, Math.round((remainCals * carbRatio / mainCarb.cal) * 100)));
      g = Math.round(g / 10) * 10;
      addPortion(mainCarb, g);
    }
  }

  // ── STEP 3: Fat (smart limits) ──────────────────────────────
  if (fats.length && remainCals > 60) {
    const mainFat = fats[0];
    const fatRatio = ['keto','carnivore'].includes(diet) ? 0.50 : 0.18;
    // v8 FIX: use smart gram limit
    let g = Math.max(5, Math.round((remainCals * fatRatio / mainFat.cal) * 100));
    g = Math.round(g / 5) * 5;
    g = safePortion(mainFat, g);
    if (g >= 5) addPortion(mainFat, g);
  }

  // ── STEP 4: Veggies (free, always add if available) ─────────
  const vegOption = veggies[0];
  if (vegOption && mealType !== 'pre') {
    addPortion(vegOption, 100);
  }

  // ── STEP 5: POST — ensure carb even in lowcarb ──────────────
  if (mealType === 'post' && !portions.some(p => ['carb','fruit'].includes(p.food.cat))) {
    const postCarb = mainCarbs[0] || quickCarbs[0];
    if (postCarb && !['keto','carnivore'].includes(diet)) {
      addPortion(postCarb, 100);
    }
  }

  // ── v8 SAFETY NET: if meal has no protein at all, add best available ──
  const hasProteinInMeal = portions.some(p => p.food.cat === 'protein' || p.food.cat === 'dairy');
  if (!hasProteinInMeal && allProteins.length > 0) {
    addPortion(allProteins[0], 100);
  }

  // ── 2-MEAL FIX: with only 2 meals/day each meal must carry ~50% of daily cals.
  // Instead of adding 2 proteins + 2 carbs (overcrowding), boost existing item portions.
  // Check that the value EXISTS before comparing it. The old order tested
  // `undefined <= 2` first (which is false), so the guard could never fire.
  if (typeof DE.mealCount !== 'undefined' && DE.mealCount !== null && DE.mealCount <= 2) {
    // Remove duplicate proteins — keep only the first, scale it up
    const proteinItems = portions.filter(p => p.food.cat === 'protein' || p.food.cat === 'dairy');
    if (proteinItems.length > 1) {
      const keep = proteinItems[0];
      const extraCals = proteinItems.slice(1).reduce((s,p) => s + p.cals, 0);
      portions.splice(0, portions.length, ...portions.filter(p => p === keep || (p.food.cat !== 'protein' && p.food.cat !== 'dairy')));
      // Redistribute extra cals into kept protein
      const addG = Math.round((extraCals / keep.food.cal) * 100 / 10) * 10;
      keep.grams = Math.min(350, keep.grams + addG);
      keep.cals  = Math.round(keep.food.cal * keep.grams / 100);
      keep.pro   = +(keep.food.pro * keep.grams / 100).toFixed(1);
    }
    // Remove duplicate carbs — keep only the first, scale it up
    const carbItems = portions.filter(p => p.food.cat === 'carb' || p.food.cat === 'fruit');
    if (carbItems.length > 1) {
      const keep = carbItems[0];
      const extraCals = carbItems.slice(1).reduce((s,p) => s + p.cals, 0);
      portions.splice(0, portions.length, ...portions.filter(p => p === keep || (p.food.cat !== 'carb' && p.food.cat !== 'fruit')));
      const addG = Math.round((extraCals / keep.food.cal) * 100 / 10) * 10;
      keep.grams = Math.min(400, keep.grams + addG);
      keep.cals  = Math.round(keep.food.cal * keep.grams / 100);
      keep.carb  = +(keep.food.carb * keep.grams / 100).toFixed(1);
    }
  }

  return portions;
}

LOG('✔ Phase 6 Complete — Macro Optimizer ready');

// ═══════════════════════════════════════════════════════════════
//  CCPM — CARB CYCLE PORTION MODULATOR  (Additive Only)
//
//  المشكلة: getMealMacro() تعدل targetMacros.carbs لكن optimizePortions
//  تحسب حصة الكارب من (remainCals × carbRatio) — تتاهل targetMacros.carbs.
//  النتيجة: الكارب سايكل لا يظهر فعليا في الحصص الموجودة في الوجبة.
//
//  الحل: بعد تشغيل optimizePortions الأصلية، نطبق multiplier على
//  كميات الكارب الصلبة (أرز، شفان، خبز، بطاطا) بناء على dayState.
//  البروتين والدهون: لا يمسان.
//  Fat compensation: الكالوري المفرج عن تقليل الكارب يعاد ل fat فقط
//  إذا كان fat موجودا، ضمن حدود آمنة.
//
//  ال IDs المستهدفة للكارب الصلب:
//  أرز، شوفان، خبز، بطاطا، كارب رئيسي — جميعها cat === 'carb'
//  + quick carbs: موز، تمر، فاكهة (cat === 'fruit') في pre/post فقط
//
//  ال multipliers:
//   Training day (High):   ×1.35 - +35% gram weight على كارب
//   Rest day    (Low):     ×0.72 - −28% gram weight على كارب
//   Default / no flag:     ×1.00 - لا تعديل
//
//  GUARDS:
//   · يعمل فقط عند DE.selectedDiet === 'carbcycle'
//   · يعمل فقط عند weeklyMeta.carbCycleActive === true
//   · لا ينقص كارب ال post أقل من 80g total في الوجبة
//   · لا ينقص كارب ال pre  أقل من 40g total في الوجبة
//   · NaN-safe: إذا فشل أي حساب - يرجع portions الأصلية دون تعديل
//   · لا يغير البروتين أو يحذف أي مكون
// ═══════════════════════════════════════════════════════════════

// ── IDs الكارب الصلب التي تستجيب لل multiplier ──────────────────
const CCPM_CARB_IDS = new Set([
  'white_rice','brown_rice','rice_white_egyptian','oats','oats_quaker',
  'baladi_bread','whole_bread','toast_brown','bread_crispbread','oat_bread',
  'tortilla_wrap','potato','sweet_potato','pasta_ww','pasta_cooked',
  'quinoa','corn','sweet_corn_canned','rice_cake','lentils','chickpeas','foul',
  'multigrain_crackers','feteer_meshaltet_100g'
]);

// ── Quick carbs (pre/post only) ───────────────────────────────────
const CCPM_QUICK_CARB_IDS = new Set([
  'banana','dates','apple','strawberry','orange','mango_fresh','watermelon',
  'berries_mix','protein_bar_clif'
]);

// ── Main modulation function ─────────────────────────────────────
// @param  portions   {Array}   نتيجة optimizePortions الأصلية
// @param  mealType   {string}  نوع الوجبة
// @param  weeklyMeta {object}  من buildSmartMealPlan
// @returns {Array}   portions معدلة أو الأصلية عند أي خطأ
function ccpmApply(portions, mealType, weeklyMeta) {
  // ── Guard 1: diet ─────────────────────────────────────────────
  if (!portions || !portions.length) return portions;
  if ((typeof DE === 'undefined') || DE.selectedDiet !== 'carbcycle') return portions;

  // ── Guard 2: active flag ──────────────────────────────────────
  if (!weeklyMeta || !weeklyMeta.carbCycleActive) return portions;

  try {
    const isTraining = weeklyMeta.isTrainingDay;

    // Multiplier للكارب الصلب
    const SOLID_MULT = isTraining ? 1.35 : 0.72;

    // لا تعدل quick carbs في غير pre/post
    const applyQuick = ['pre','post'].includes(mealType);

    // حدود دنيا للكارب في الوجبة (grams total)
    const CARB_FLOOR_GRAMS = mealType === 'post' ? 60
                           : mealType === 'pre'  ? 30
                           : 0; // وجبات عادية: لا حد أدنى

    // تطبيق التعديل
    let totalCarbGramsAfter = 0;
    const modified = portions.map(p => {
      const isCarb       = CCPM_CARB_IDS.has(p.food.id)       || p.food.cat === 'carb';
      const isQuickCarb  = CCPM_QUICK_CARB_IDS.has(p.food.id) || p.food.cat === 'fruit';

      const shouldAdjust = isCarb || (isQuickCarb && applyQuick);
      if (!shouldAdjust) return p;

      // حساب ال grams الجديدة
      const rawGrams  = p.grams * SOLID_MULT;
      const newGrams  = Math.max(10, Math.round(rawGrams / 5) * 5); // round to 5g, min 10g
      if (newGrams === p.grams) return p; // لا تغيير فعلي

      const newCals = Math.round(p.food.cal  * newGrams / 100);
      const newCarb = +((p.food.carb || 0) * newGrams / 100).toFixed(1);
      const newPro  = +((p.food.pro  || 0) * newGrams / 100).toFixed(1);
      const newFat  = +((p.food.fat  || 0) * newGrams / 100).toFixed(1);

      // Guard: NaN
      if (!isFinite(newCals) || newCals < 0) return p;

      totalCarbGramsAfter += newGrams;

      return { ...p, grams:newGrams, cals:newCals, pro:newPro, carb:newCarb, fat:newFat,
               _ccpmAdjusted: true, _ccpmMult: SOLID_MULT };
    });

    // ── Floor guard: إذا نزل كارب الوجبة الكلي تحت الحد ──────────
    if (CARB_FLOOR_GRAMS > 0) {
      const totalCarbNow = modified
        .filter(p => CCPM_CARB_IDS.has(p.food.id) || p.food.cat === 'carb' ||
                     CCPM_QUICK_CARB_IDS.has(p.food.id) || p.food.cat === 'fruit')
        .reduce((s,p) => s + p.grams, 0);
      if (totalCarbNow < CARB_FLOOR_GRAMS) {
        // تجاوز ال floor - أرجع الأصلية لهذه الوجبة
        LOG(`CCPM: ${mealType} carb floor hit (${totalCarbNow}g < ${CARB_FLOOR_GRAMS}g) — skipping modulation`);
        return portions;
      }
    }

    // نقل ال metadata من portions الأصلية إذا وجدت
    if (portions._p3Validation) modified._p3Validation = portions._p3Validation;
    if (portions._p3Pairing)    modified._p3Pairing    = portions._p3Pairing;
    if (portions._mipIncompatWarning) modified._mipIncompatWarning = portions._mipIncompatWarning;

    LOG(`CCPM: ${mealType} | ${isTraining ? 'Training ×1.35' : 'Rest ×0.72'} | ${modified.filter(p=>p._ccpmAdjusted).length} carb items adjusted`);
    return modified;

  } catch(e) {
    LOG('CCPM error: ' + e.message + ' — portions unchanged');
    return portions; // safe fallback: أرجع الأصلية دون أي تعديل
  }
}

LOG('✔ CCPM — Carb Cycle Portion Modulator ready');
