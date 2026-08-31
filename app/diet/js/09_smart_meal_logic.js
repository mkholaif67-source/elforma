// ═══════════════════════════════════════════════════════════════
//  PHASE 3 — SMART MEAL LOGIC ENGINE
//  Layered Enhancement — Non-Destructive
//  Builds ON TOP of existing optimizePortions + validateMealComposition
//  Does NOT replace any existing logic.
// ═══════════════════════════════════════════════════════════════
LOG('Phase 3 — Smart Meal Logic Engine...');

// ── 3.1 MEAL COMPOSITION RULES ─────────────────────────────────
// Defines what a valid main meal MUST contain by category role
const MEAL_COMPOSITION_RULES = {
  breakfast: {
    required: ['protein_or_dairy'],
    preferred: ['carb_or_legume', 'veggie'],
    optional:  ['fat'],
    forbidden_alone: ['veggie', 'fat', 'fruit', 'sauce'],
    minProteinG: 12,
    minCals: 200,
    maxCals: 700,
    note: 'الفطار يحتاج: بروتين + مصدر طاقة + خضار اختياري'
  },
  lunch: {
    required: ['protein_or_dairy', 'carb_or_legume'],
    preferred: ['veggie'],
    optional:  ['fat'],
    forbidden_alone: ['sauce', 'fat', 'fruit'],
    minProteinG: 20,
    minCals: 350,
    maxCals: 900,
    note: 'الغداء: بروتين قوي + كارب + خضار'
  },
  dinner: {
    required: ['protein_or_dairy'],
    preferred: ['veggie', 'carb_or_legume'],
    optional:  ['fat'],
    forbidden_alone: ['sauce', 'fat', 'fruit', 'carb'],
    minProteinG: 18,
    minCals: 250,
    maxCals: 750,
    note: 'العشاء: بروتين + خضار + كارب محدود'
  },
  post: {
    required: ['protein_or_dairy', 'carb_or_legume'],
    preferred: [],
    optional:  ['veggie'],
    forbidden_alone: ['sauce', 'fat'],
    minProteinG: 25,
    minCals: 300,
    maxCals: 800,
    note: 'بعد التمرين: بروتين عالي + كارب للتعافي'
  },
  pre: {
    required: ['carb_or_fruit'],
    preferred: ['protein_or_dairy'],
    optional:  [],
    forbidden_alone: ['sauce', 'fat'],
    minProteinG: 0,
    minCals: 150,
    maxCals: 450,
    note: 'قبل التمرين: كارب سريع + بروتين خفيف'
  },
  snack: {
    required: [],
    preferred: ['protein_or_dairy', 'fruit_or_carb'],
    optional:  ['fat'],
    forbidden_alone: ['sauce'],
    minProteinG: 0,
    minCals: 80,
    maxCals: 300,
    note: 'السناك: خفيف ومشبع — بروتين أو فاكهة + مكسرات'
  }
};

// ── 3.2 FORBIDDEN MEAL PATTERNS ────────────────────────────────
// Patterns that must NEVER be generated as standalone meals
const FORBIDDEN_MEAL_PATTERNS = [
  {
    name: 'rice_only',
    check: (items) => items.length <= 1 && items.some(i => ['white_rice','brown_rice'].includes(i.food.id)),
    msg: 'أرز وحده — يجب إضافة بروتين',
    severity: 'critical'
  },
  {
    name: 'soup_only',
    // FIX: exclude pre/snack — a light veggie pre-workout is valid; only flag main meals
    check: (items, mealType) => {
      if (['pre','snack'].includes(mealType)) return false;
      return items.every(i => i.food.cat === 'veggie') && items.length <= 2;
    },
    msg: 'خضار فقط بدون بروتين وكارب — وجبة غير مكتملة',
    severity: 'critical'
  },
  {
    name: 'sauce_only',
    check: (items) => {
      const SAUCE_IDS = ['mayonnaise','tahini_sauce','garlic_sauce','hot_sauce','soy_sauce','mustard_yellow','barbecue_sauce'];
      return items.every(i => SAUCE_IDS.includes(i.food.id));
    },
    msg: 'صلصات فقط — ليست وجبة',
    severity: 'critical'
  },
  {
    name: 'dessert_as_meal',
    // FIX: only flag main meals; snack is allowed to have fruit/dairy with carb
    // FIX: use very_high only — 'high' catches too many valid foods (some dairy, some fruit)
    check: (items, mealType) => {
      if (['snack','pre'].includes(mealType)) return false;
      return items.every(i => i.food.processedLevel === 'very_high' && i.food.carb > 30);
    },
    msg: 'حلويات مصنعة فقط — ليست وجبة رئيسية',
    severity: 'critical'
  },
  {
    name: 'no_protein_main',
    check: (items, mealType) => {
      if (!['breakfast','lunch','dinner','post'].includes(mealType)) return false;
      const hasPro = items.some(i => ['protein','dairy'].includes(i.food.cat));
      const totalPro = items.reduce((s,i) => s + i.pro, 0);
      return !hasPro || totalPro < 8;
    },
    msg: 'وجبة رئيسية بدون بروتين — يجب إضافة مصدر بروتين',
    severity: 'critical'
  },
  {
    name: 'carb_carb_only',
    check: (items) => {
      const mainCarbIds = ['white_rice','brown_rice','pasta_ww','potato','sweet_potato','baladi_bread','whole_bread'];
      const carbCount = items.filter(i => mainCarbIds.includes(i.food.id)).length;
      const hasPro = items.some(i => ['protein','dairy'].includes(i.food.cat));
      return carbCount >= 2 && !hasPro;
    },
    msg: 'كارب + كارب بدون بروتين — وجبة غير متوازنة',
    severity: 'high'
  },
  {
    name: 'snack_as_main',
    check: (items, mealType) => {
      if (mealType === 'snack') return false;
      const allSnack = items.every(i => i.food.cat === 'snack');
      return allSnack && items.length <= 2;
    },
    msg: 'سناك كوجبة رئيسية — أضف بروتين وكارب',
    severity: 'high'
  },
  {
    name: 'fruit_only_main',
    check: (items, mealType) => {
      if (!['breakfast','lunch','dinner'].includes(mealType)) return false;
      return items.every(i => i.food.cat === 'fruit');
    },
    msg: 'فاكهة فقط — لا تكفي كوجبة رئيسية',
    severity: 'high'
  }
];

// ── 3.3 FOOD PAIRING INTELLIGENCE ──────────────────────────────
// Extended pairing logic on top of FOOD_INTELLIGENCE.pairWith
const PAIRING_RULES = {
  // Perfect pairs: score bonus
  excellent: [
    ['chicken_breast',  ['brown_rice','sweet_potato','broccoli','spinach','quinoa']],
    ['turkey_breast',   ['brown_rice','sweet_potato','broccoli','salad']],
    ['salmon',          ['sweet_potato','broccoli','brown_rice','spinach']],
    ['tuna_canned',     ['brown_rice','whole_bread',]],
    ['eggs_whole',      ['baladi_bread','whole_bread','spinach',]],
    ['oats',            ['egg_whites','greek_yogurt','banana','strawberry']],
    ['greek_yogurt',    ['strawberry','banana','oats','almonds']],
    ['lentils',         ['baladi_bread','spinach','salad',]],
    ['foul',            ['baladi_bread','eggs_whole',]],
    ['beef_lean',       ['sweet_potato','brown_rice','broccoli','salad']],
    ['tilapia',         ['brown_rice','sweet_potato','salad','broccoli']],
    ['shrimp',          ['brown_rice','broccoli','bell_pepper','salad']],
    ['cottage_cheese',  ['baladi_bread','whole_bread']],
  ],
  // Weak combos: flag but allow
  weak: [
    { pair: ['white_rice', 'potato'],       msg: 'كارب مزدوج — تقليل كمية أحدهما' },
    { pair: ['banana',     'dates'],        msg: 'سكريات مرتفعة معا' },
    { pair: ['avocado',    'peanut_butter'],msg: 'دهون مرتفعة جدا معا' },
    { pair: ['beef_lean',  'beef_ground'],  msg: 'لحم مكرر — تنوع أفضل' },
    { pair: ['chicken_breast','chicken_thigh'], msg: 'دجاج مكرر — بروتين واحد يكفي' },
    { pair: ['peanut_butter', 'almonds'],   msg: 'مكسرات مزدوجة — سعرات عالية' },
    { pair: ['olive_oil',  'avocado'],      msg: 'دهون صحية مرتفعة معا — اختر واحدا' },
  ]
};

// ── 3.4 ROTATION TRACKER ───────────────────────────────────────
// Tracks used proteins/patterns PER PLAN GENERATION to enforce variety
// ── CANONICAL FOOD ID LAYER ─────────────────────────────────────
// Strips variant suffixes (batch_N, premium, value_pack, etc) so that
// diversity / repetition / rotation systems treat them as the same food.
// FOOD_DB, search, and display are completely unaffected.
function getCanonicalFoodId(id) {
  if (!id) return id;
  return id
    .replace(/_batch_\d+$/i, '')          // _batch_1, _batch_2, ...
    .replace(/_premium$/i, '')            // _premium
    .replace(/_value_pack$/i, '')         // _value_pack
    .replace(/_economy$/i, '')            // _economy (future-proof)
    .replace(/_standard$/i, '')           // _standard (future-proof)
    .replace(/_family_pack$/i, '')        // _family_pack (future-proof)
    .replace(/_\d+g$/i, '');             // _200g, _500g (future-proof)
}
// ── END CANONICAL LAYER ─────────────────────────────────────────

const MealRotationTracker = {
  usedProteins:  [],   // protein IDs used in this plan session
  usedCarbTypes: [],   // carb categories used (rice, potato, legume, etc)
  usedPatterns:  [],   // meal pattern names used

  reset() {
    this.usedProteins  = [];
    this.usedCarbTypes = [];
    this.usedPatterns  = [];
  },

  // Mark a protein as used in this plan
  markProtein(foodId) {
    const cid = getCanonicalFoodId(foodId);
    if (!this.usedProteins.includes(cid)) {
      this.usedProteins.push(cid);
    }
  },

  // Score penalty for reusing same protein (higher = more diverse)
  getProteinDiversityScore(foodId) {
    const cid = getCanonicalFoodId(foodId);
    if (!this.usedProteins.includes(cid)) return 0;    // not used yet - no penalty
    const useCount = this.usedProteins.filter(p => p === cid).length;
    return useCount * 20;  // -20 per repeat
  },

  // Get suggested alternative protein from available pool
  getAlternativeProtein(currentProteinId, proteinPool) {
    const cid = getCanonicalFoodId(currentProteinId);
    const unused = proteinPool.filter(f =>
      !this.usedProteins.includes(getCanonicalFoodId(f.id)) &&
      getCanonicalFoodId(f.id) !== cid &&
      ['protein','dairy'].includes(f.cat)
    );
    return unused[0] || null;
  },

  // Carb type bucket
  getCarbBucket(foodId) {
    if (['white_rice','brown_rice','quinoa'].includes(foodId)) return 'rice';
    if (['potato','sweet_potato'].includes(foodId)) return 'potato';
    if (['baladi_bread','whole_bread'].includes(foodId)) return 'bread';
    if (['lentils','foul','chickpeas'].includes(foodId)) return 'legume';
    if (['oats'].includes(foodId)) return 'oats';
    return 'other';
  },

  markCarb(foodId) {
    const bucket = this.getCarbBucket(getCanonicalFoodId(foodId));
    if (!this.usedCarbTypes.includes(bucket)) {
      this.usedCarbTypes.push(bucket);
    }
  },

  getCarbRepeatPenalty(foodId) {
    const bucket = this.getCarbBucket(getCanonicalFoodId(foodId));
    const count = this.usedCarbTypes.filter(b => b === bucket).length;
    return count >= 2 ? 15 : 0;  // -15 if carb type repeated 2+
  }
};

// ── 3.5 ENHANCED MEAL VALIDATOR ────────────────────────────────
// Runs ON TOP of existing validateMealComposition
// Returns structured result: { passed, critical, warnings, badges, score }
function validateMealLogic(mealType, portions, context) {
  if (!portions || !portions.length) {
    return { passed: false, critical: ['وجبة فارغة'], warnings: [], badges: [], score: 0 };
  }

  const critical  = [];
  const warnings  = [];
  const badges    = [];
  let   score     = 100;

  const foods      = portions.map(p => p.food);
  const ids        = foods.map(f => f.id);
  const cats       = foods.map(f => f.cat);
  const totalPro   = +portions.reduce((s,p) => s + p.pro,  0).toFixed(1);
  const totalCarb  = +portions.reduce((s,p) => s + p.carb, 0).toFixed(1);
  const totalFat   = +portions.reduce((s,p) => s + p.fat,  0).toFixed(1);
  const totalCals  = Math.round(portions.reduce((s,p) => s + p.cals, 0));
  const totalGrams = portions.reduce((s,p) => s + p.grams, 0);

  const hasPro    = cats.some(c => ['protein','dairy'].includes(c));
  const hasCarb   = cats.some(c => ['carb','fruit'].includes(c));
  const hasVeggie = cats.includes('veggie');

  // ── PRIORITY 1: Medical safety (highest — runs first) ──────────
  // FIX: medical checks before forbidden patterns to set correct priority
  if (context && context.health && context.health.length) {
    context.health.forEach(hc => {
      const hrules = HEALTH_MEAL_RULES[hc];
      if (!hrules) return;
      if (hrules.avoidFoods) {
        foods.filter(f => hrules.avoidFoods.includes(f.id)).forEach(f => {
          critical.push('' + f.nameAr + ' ممنوع لحالة: ' + (HC_LABELS[hc] || hc));
          score -= 25;
        });
      }
      if (hrules.maxProteinPerMeal && totalPro > hrules.maxProteinPerMeal) {
        warnings.push('بروتين مرتفع للكلى (' + totalPro + 'ج) — الحد ' + hrules.maxProteinPerMeal + 'ج');
        score -= 15;
      }
      if (hrules.maxCarbPerMeal && totalCarb > hrules.maxCarbPerMeal) {
        warnings.push('كارب مرتفع لل' + (HC_LABELS[hc] || hc) + ' (' + totalCarb + 'ج)');
        score -= 10;
      }
      // ── HOTFIX P4 — IBS fiber stacking detection ──────────────────────
      // Checks total meal fiber vs maxFiberPerMeal rule defined in HEALTH_MEAL_RULES.ibs
      if (hrules.maxFiberPerMeal) {
        const totalFiber = +portions.reduce((s,p) => s + ((p.food.fiber||0) * p.grams / 100), 0).toFixed(1);
        if (totalFiber > hrules.maxFiberPerMeal) {
          warnings.push('تكديس ألياف عال في وجبة واحدة (' + totalFiber + 'ج) — يحذر مع القولون الحساس (الحد ' + hrules.maxFiberPerMeal + 'ج)');
          score -= 12;
        }
      }
    });
  }

  // ── PRIORITY 2: Diet restrictions ──────────────────────────────
  // FIX: diet compliance before forbidden patterns
  if (context && context.diet) {
    const constraints = DIET_CONSTRAINTS[context.diet];
    if (constraints) {
      const forbidden = constraints.forbiddenFoods || [];
      foods.filter(f => forbidden.includes(f.id)).forEach(f => {
        critical.push('' + f.nameAr + ' غير مسموح في دايت ' + constraints.label);
        score -= 30;
      });
      if (constraints.maxCarbPerMeal && totalCarb > constraints.maxCarbPerMeal) {
        warnings.push('كارب مرتفع (' + totalCarb + 'ج) — الحد في ' + constraints.label + ': ' + constraints.maxCarbPerMeal + 'ج');
        score -= 12;
      }
    }
  }

  // ── PRIORITY 3: Forbidden Patterns ─────────────────────────────
  // FIX: track protein issue to avoid double-penalty in composition section
  let proteinIssueRaised = false;
  FORBIDDEN_MEAL_PATTERNS.forEach(pattern => {
    if (pattern.check(portions, mealType)) {
      if (pattern.severity === 'critical') {
        critical.push(pattern.msg);
        score -= 40;
        if (pattern.name === 'no_protein_main') proteinIssueRaised = true;
      } else {
        warnings.push(pattern.msg);
        score -= 20;
      }
    }
  });

  // ── PRIORITY 4: Macro accuracy + protein sufficiency ───────────
  const mealRules = MEAL_COMPOSITION_RULES[mealType];
  if (mealRules) {
    // FIX: skip duplicate protein warning if no_protein_main already fired
    if (mealRules.minProteinG > 0 && totalPro < mealRules.minProteinG && !proteinIssueRaised) {
      const mealLabel = mealType === 'breakfast' ? 'فطار' : mealType === 'lunch' ? 'غداء' : 'عشاء';
      warnings.push('بروتين منخفض (' + totalPro + 'ج) — الحد الأدنى ' + mealRules.minProteinG + 'ج لل' + mealLabel);
      score -= 15;
    }
    if (['lunch','dinner','breakfast'].includes(mealType) && totalCals < mealRules.minCals) {
      warnings.push('سعرات منخفضة (' + totalCals + ' kcal) — الوجبة قد لا تشبع');
      score -= 10;
    }
    // FIX: skip duplicate critical for protein if already raised
    if (mealRules.required.includes('protein_or_dairy') && !hasPro && !proteinIssueRaised) {
      critical.push('يجب وجود بروتين أو داري في هذه الوجبة');
      score -= 35;
    }
    if (mealRules.required.includes('carb_or_legume') || mealRules.required.includes('carb_or_fruit')) {
      if (!hasCarb && !['keto','carnivore'].includes(context && context.diet)) {
        warnings.push('أضف مصدر كارب لاستكمال الوجبة');
        score -= 10;
      }
    }
  }

  // ── PRIORITY 5: Realistic portions ─────────────────────────────
  portions.filter(p => {
    if (['protein','dairy'].includes(p.food.cat) && p.grams > 400) return true;
    if (p.food.cat === 'carb' && p.grams > 350) return true;
    if (p.food.cat === 'fat' && p.grams > 50) return true;
    return false;
  }).forEach(p => {
    warnings.push('كمية كبيرة جدا: ' + p.food.nameAr + ' (' + p.grams + 'ج)');
    score -= 8;
  });

  // ── PRIORITY 6: Processed food ratio ───────────────────────────
  const processedCount = portions.filter(p => ['high','very_high'].includes(p.food.processedLevel)).length;
  if (processedCount / portions.length >= 0.6) {
    warnings.push('أطعمة مصنعة كثيرة — ينصح بالتنويع');
    score -= 15;
  }

  // ── PRIORITY 7: Pairing (advisory only, capped at -10) ─────────
  // FIX: pairing is lowest priority, capped so it can't override medical/diet score
  let pairingPenalty = 0;
  PAIRING_RULES.weak.forEach(rule => {
    const [a, b] = rule.pair;
    if (ids.includes(a) && ids.includes(b) && pairingPenalty < 10) {
      warnings.push('' + rule.msg);
      pairingPenalty += 5;
    }
  });
  score -= pairingPenalty;

  // ── Positive badges ─────────────────────────────────────────────
  if (totalPro >= 25) badges.push('بروتين عالي');
  if (hasVeggie)      badges.push('ألياف وخضار');
  if (hasPro && hasCarb && hasVeggie) badges.push('وجبة كاملة');
  if (totalPro * 4 / Math.max(1, totalCals) > 0.28) badges.push('نسبة بروتين ممتازة');
  if (processedCount === 0) badges.push('طبيعي 100%');
  if (score >= 85) badges.push('وجبة ممتازة');

  score = Math.max(0, Math.min(100, score));
  const passed = critical.length === 0 && score >= 40;

  return { passed, critical, warnings, badges, score,
    stats: { totalPro, totalCarb, totalFat, totalCals, totalGrams } };
}

// ── 3.6 ROTATION-AWARE FOOD SCORER ─────────────────────────────
// Wraps existing scoreFoodForContext — adds rotation penalty on top
// ── FIX-SCORE-V1: converted from `function` declaration to `const` expression ──
// Reason: two `function scoreWithRotation` declarations in same scope cause the
// second (MIP version, line ~14305) to win via hoisting, making
// _mip_originalScoreWithRotation point to itself - infinite recursion.
// Converting v1 to a const ensures it is runtime-assigned BEFORE the MIP
// assignment at line 14304 captures it, breaking the recursion chain.
let scoreWithRotation = function scoreWithRotation(food, mealType, context) {
  let base = scoreFoodForContext(food, mealType, context);
  // Apply protein rotation penalty
  // FIX: cap penalty at 15 (not unlimited) so excellent proteins (base ~90)
  // never score below a mediocre protein (base ~50). Quality beats rotation.
  if (['protein','dairy'].includes(food.cat)) {
    const rawPenalty = MealRotationTracker.getProteinDiversityScore(food.id);
    const cappedPenalty = Math.min(rawPenalty, 15);  // max -15 per protein repeat
    base = Math.max(30, base - cappedPenalty);        // floor at 30 — never zero a valid food
  }
  // Apply carb repeat penalty (advisory only, capped)
  if (food.cat === 'carb') {
    const penalty = MealRotationTracker.getCarbRepeatPenalty(food.id);
    base = Math.max(20, base - penalty);
  }
  return base;
};

// ── 3.7 MEAL PAIRING ANALYZER ──────────────────────────────────
// Returns pairing quality score + recommendations for a given portions array
function analyzeMealPairing(portions) {
  if (!portions || !portions.length) return { score: 0, recommendations: [] };
  const ids  = portions.map(p => p.food.id);
  const cats = portions.map(p => p.food.cat);
  const recs = [];
  let bonus  = 0;

  // Check excellent pairs
  PAIRING_RULES.excellent.forEach(([mainId, goodPairs]) => {
    if (ids.includes(mainId)) {
      const matched = goodPairs.filter(gp => ids.includes(gp));
      if (matched.length >= 1) {
        bonus += 10 * matched.length;
      }
      // Suggest good pair if not already paired
      const unmatched = goodPairs.filter(gp => !ids.includes(gp));
      if (matched.length === 0 && unmatched.length > 0) {
        const food = (typeof FOOD_DB !== 'undefined' ? FOOD_DB : FOOD_DB_RAW).find(f => f.id === unmatched[0]);
        if (food) recs.push(`${food.nameAr} يتناسب مثاليا مع هذه الوجبة`);
      }
    }
  });

  // Check weak combos
  PAIRING_RULES.weak.forEach(rule => {
    const [a, b] = rule.pair;
    if (ids.includes(a) && ids.includes(b)) {
      bonus -= 8;
      recs.push(`${rule.msg}`);
    }
  });

  return { score: Math.max(0, Math.min(100, 70 + bonus)), recommendations: recs.slice(0,3) };
}

// ── 3.8 ENHANCED buildSmartMealPlan HOOK ───────────────────────
// Monkey-patches buildSmartMealPlan to reset rotation tracker before each build
// This is a NON-DESTRUCTIVE hook — does not replace the original function
const _originalBuildSmartMealPlan = buildSmartMealPlan;
buildSmartMealPlan = function buildSmartMealPlan(totalCals, macros, weeklyMeta) {
  // Reset rotation tracker for fresh plan
  MealRotationTracker.reset();
  LOG('⟳ Phase 3 — Rotation Tracker reset for new plan');
  // Delegate to original — pass weeklyMeta through (integration parameter)
  return _originalBuildSmartMealPlan(totalCals, macros, weeklyMeta);
}

// ── 3.9 ENHANCED optimizePortions HOOK ─────────────────────────
// Post-processing layer: runs after original optimizePortions
// Validates the output and marks used proteins/carbs for rotation
const _originalOptimizePortions = optimizePortions;
optimizePortions = function optimizePortions(mealType, targetCals, targetMacros, availableForMeal) {
  // Guard: prevent recursive re-entry (infinite loop protection)
  if (optimizePortions._p3Running) {
    return _originalOptimizePortions(mealType, targetCals, targetMacros, availableForMeal);
  }
  optimizePortions._p3Running = true;

  let portions;
  try {
    // Step 1: Run original logic
    portions = _originalOptimizePortions(mealType, targetCals, targetMacros, availableForMeal);

    if (!portions || !portions.length) { optimizePortions._p3Running = false; return portions; }

    const context = {
      diet:     DE.selectedDiet || 'balanced',
      goal:     DE.goal,
      health:   DE.healthConditions,
      problems: DE.dietProblems
    };

    // Step 2: Validate using Phase 3 logic (read-only, no side effects)
    const validation = validateMealLogic(mealType, portions, context);

    // Step 3: Auto-heal — only for missing protein in main meals
    // FIXES: diet/health filter, calorie budget guard, realistic gram cap, graceful fallback
    const alreadyHasProtein = portions.some(p => ['protein','dairy'].includes(p.food.cat));
    const isMainMeal = ['breakfast','lunch','dinner','post'].includes(mealType);
    const noProteinCritical = validation.critical.some(c =>
      c.includes('بروتين') || c.includes('protein') || c.includes('بدون بروتين')
    );

    if (!alreadyHasProtein && isMainMeal && noProteinCritical && availableForMeal.length > 2) {
      // Remaining calorie budget after existing portions
      const usedCals = portions.reduce((s,p) => s + p.cals, 0);
      const budgetCals = Math.max(80, targetCals - usedCals);

      // Candidate proteins: must pass diet + health filters
      const DIET_CONSTRAINTS_REF = (typeof DIET_CONSTRAINTS !== 'undefined') ? DIET_CONSTRAINTS : {};
      const constraints = DIET_CONSTRAINTS_REF[context.diet] || {};
      const forbiddenByDiet = constraints.forbiddenFoods || [];

      const candidateProteins = availableForMeal.filter(f => {
        if (!['protein','dairy'].includes(f.cat)) return false;
        if (forbiddenByDiet.includes(f.id)) return false;
        // Health filter
        for (const hc of (context.health || [])) {
          const hrules = (typeof HEALTH_MEAL_RULES !== 'undefined') ? HEALTH_MEAL_RULES[hc] : null;
          if (hrules && hrules.avoidFoods && hrules.avoidFoods.includes(f.id)) return false;
        }
        return true;
      }).sort((a, b) => scoreWithRotation(b, mealType, context) - scoreWithRotation(a, mealType, context));

      const healCandidate = candidateProteins[0];

      if (healCandidate) {
        // FIX: base grams on remaining BUDGET, not full targetCals (avoids calorie overshoot)
        // Cap: 35% of budget; min 60g, max 130g; round to 10g
        const rawG = (budgetCals * 0.35 / Math.max(1, healCandidate.cal)) * 100;
        const safeG = Math.round(Math.min(130, Math.max(60, rawG)) / 10) * 10;
        const healCals = Math.round(healCandidate.cal * safeG / 100);

        // FIX: only add if result cals are meaningful and won't catastrophically overshoot
        if (healCals >= 30 && healCals <= budgetCals * 1.15) {
          // Kidney check: cap protein grams
          const kidneyRules = (typeof HEALTH_MEAL_RULES !== 'undefined') ? HEALTH_MEAL_RULES['kidney'] : null;
          const maxProG = kidneyRules && (context.health || []).includes('kidney')
            ? Math.round((kidneyRules.maxProteinPerMeal / Math.max(0.1, healCandidate.pro)) * 100)
            : 130;
          const finalG = Math.min(safeG, maxProG);

          portions.unshift({
            food:  healCandidate,
            grams: finalG,
            cals:  Math.round(healCandidate.cal  * finalG / 100),
            pro:   +(healCandidate.pro  * finalG / 100).toFixed(1),
            carb:  +(healCandidate.carb * finalG / 100).toFixed(1),
            fat:   +(healCandidate.fat  * finalG / 100).toFixed(1),
            _autoAdded: true
          });
          LOG('P3 Auto-heal: added ' + healCandidate.nameAr + ' (' + finalG + 'g) to ' + mealType);
        } else {
          // Graceful fallback: warn but don't corrupt meal
          LOG('P3 Auto-heal: candidate found but budget too tight for ' + mealType + ' — skipping');
          portions._p3HealWarning = 'لم يتوفر بروتين مناسب ضمن ميزانية السعرات — ينصح بإضافة أطعمة بروتينية';
        }
      } else {
        // No valid protein found after all filters
        LOG('P3 Auto-heal: no diet/health-safe protein available for ' + mealType);
        portions._p3HealWarning = 'لا يوجد مصدر بروتين متاح متوافق مع الدايت والحالة الصحية';
      }
    }

    // Step 4: Mark used proteins and carbs for rotation tracking
    portions.forEach(p => {
      if (['protein','dairy'].includes(p.food.cat)) MealRotationTracker.markProtein(p.food.id);
      if (p.food.cat === 'carb') MealRotationTracker.markCarb(p.food.id);
    });

    // Step 5: Attach Phase 3 metadata (non-destructive, re-validate after heal)
    portions._p3Validation = validateMealLogic(mealType, portions, context);
    portions._p3Pairing    = analyzeMealPairing(portions);

  } catch (e) {
    LOG('P3 optimizePortions hook error: ' + e.message);
    // Fallback: return original result without P3 metadata
    if (!portions) portions = _originalOptimizePortions(mealType, targetCals, targetMacros, availableForMeal);
  }

  optimizePortions._p3Running = false;
  return portions;
}
optimizePortions._p3Running = false; // initialize guard

// ── 3.10 PHASE 3 QUALITY RENDERER ──────────────────────────────
// Generates HTML for Phase 3 validation badges to be displayed in meal cards
// Called from buildSmartMealPlan's quality display area
function renderP3Quality(portions) {
  if (!portions || !portions._p3Validation) return '';
  const v  = portions._p3Validation;
  const p  = portions._p3Pairing;

  let html = '';

  // Auto-heal warning (if heal was skipped due to budget/filter constraints)
  if (portions._p3HealWarning) {
    html += `<div style="font-size:11px;color:var(--orange);margin-top:3px;padding:3px 6px;background:rgba(255,160,0,0.08);border-radius:5px;">${portions._p3HealWarning}</div>`;
  }

  // Auto-added protein indicator
  const autoAdded = portions.filter(p => p._autoAdded);
  if (autoAdded.length) {
    html += `<div style="font-size:10.5px;color:var(--blue);margin-top:2px;">تمت إضافة: ${autoAdded.map(p => p.food.nameAr).join(', ')} تلقائيا</div>`;
  }

  // Critical issues — red alerts
  if (v.critical && v.critical.length) {
    html += v.critical.map(c =>
      `<div style="font-size:11px;color:var(--red);margin-top:3px;padding:3px 6px;background:rgba(232,76,76,0.08);border-radius:5px;">${c}</div>`
    ).join('');
  }

  // Warnings (max 2)
  if (v.warnings && v.warnings.length) {
    html += v.warnings.slice(0,2).map(w =>
      `<div style="font-size:10.5px;color:var(--orange);margin-top:2px;">${w}</div>`
    ).join('');
  }

  // Badges row
  if (v.badges && v.badges.length) {
    html += `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px;">` +
      v.badges.slice(0,3).map(b =>
        `<span style="font-size:10px;background:rgba(60,180,100,0.10);color:var(--green);padding:2px 7px;border-radius:10px;font-weight:700;">${b}</span>`
      ).join('') + '</div>';
  }

  // Pairing recommendations (max 1, advisory)
  if (p && p.recommendations && p.recommendations.length) {
    html += `<div style="font-size:10.5px;color:var(--blue);margin-top:3px;">${p.recommendations[0]}</div>`;
  }

  // Phase 3 score pill
  const scoreColor = v.score >= 80 ? 'var(--green)' : v.score >= 55 ? 'var(--orange)' : 'var(--red)';
  html += `<div style="font-size:10px;color:${scoreColor};font-weight:800;margin-top:3px;">P3: ${v.score}%</div>`;

  return html ? `<div class="p3-quality" style="margin-top:6px;border-top:1px dashed var(--border);padding-top:6px;">${html}</div>` : '';
}

// ── 3.11 PHASE 3 TEST SUITE ────────────────────────────────────
// Run in console: PHASE3_TESTS.run() to validate all scenarios
const PHASE3_TESTS = {
  run() {
    const ctx = { diet:'balanced', goal:'cut', health:[], problems:[] };
    const db  = typeof FOOD_DB !== 'undefined' ? FOOD_DB : FOOD_DB_RAW;
    const find = (id) => db.find(f => f.id === id);
    let passed = 0, failed = 0;

    const assert = (label, condition) => {
      if (condition) { passed++; console.log(`${label}`); }
      else           { failed++; console.error(`FAIL: ${label}`); }
    };

    // Test 1: Rice-only meal detection
    const riceOnly = [{ food: find('white_rice'), grams:200, cals:260, pro:5, carb:58, fat:0 }];
    const t1 = validateMealLogic('lunch', riceOnly, ctx);
    assert('Rice-only lunch detected as invalid', !t1.passed || t1.critical.length > 0 || t1.score < 50);

    // Test 2: Complete meal passes
    const completeMeal = [
      { food: find('chicken_breast'), grams:150, cals:165, pro:31, carb:0, fat:3 },
      { food: find('brown_rice'),     grams:150, cals:195, pro:4,  carb:42, fat:1 },
      { food: find('broccoli'),       grams:100, cals:35,  pro:3,  carb:7,  fat:0 }
    ].filter(p => p.food);
    if (completeMeal.length === 3) {
      const t2 = validateMealLogic('lunch', completeMeal, ctx);
      assert('Complete chicken+rice+broccoli meal passes', t2.passed && t2.score >= 65);
    }

    // Test 3: Rotation tracker works
    MealRotationTracker.reset();
    MealRotationTracker.markProtein('chicken_breast');
    const pen = MealRotationTracker.getProteinDiversityScore('chicken_breast');
    assert('Rotation penalty applied for repeated protein', pen >= 20);
    MealRotationTracker.reset();
    const noPen = MealRotationTracker.getProteinDiversityScore('chicken_breast');
    assert('No penalty after rotation reset', noPen === 0);

    // Test 4: Diet compliance — keto + rice
    const ketoCtx = { diet:'keto', goal:'cut', health:[], problems:[] };
    const ketoMeal = [
      { food: find('chicken_breast'), grams:200, cals:220, pro:42, carb:0, fat:4 },
      { food: find('white_rice'),     grams:150, cals:195, pro:4,  carb:42, fat:1 }
    ].filter(p => p.food);
    if (ketoMeal.length === 2) {
      const t4 = validateMealLogic('lunch', ketoMeal, ketoCtx);
      assert('Keto+rice violation detected', t4.critical.some(c => c.includes('أرز') || c.includes('rice') || c.includes('كيتو')));
    }

    // Test 5: Pairing analyzer
    const pairTest = [
      { food: find('chicken_breast'), grams:150, cals:165, pro:31, carb:0, fat:3 },
      { food: find('brown_rice'),     grams:150, cals:195, pro:4,  carb:42, fat:1 }
    ].filter(p => p.food);
    if (pairTest.length === 2) {
      const t5 = analyzeMealPairing(pairTest);
      assert('Pairing score > 0 for good pair', t5.score > 0);
    }

    // Test 6: Forbidden pattern — sauce only
    const sauceOnlyItems = [
      { food: find() || { id:'ketchup_heinz', cat:'snack', nameAr:'كاتشب', processedLevel:'high' }, grams:30, cals:30, pro:0, carb:7, fat:0 }
    ];
    const t6 = FORBIDDEN_MEAL_PATTERNS.find(p => p.name === 'sauce_only');
    assert('Sauce-only pattern defined', !!t6);

    // Test 7: Phase 3 composition rules structure
    assert('MEAL_COMPOSITION_RULES has all 6 meal types',
      ['breakfast','lunch','dinner','post','pre','snack'].every(m => MEAL_COMPOSITION_RULES[m])
    );

    // ── Stabilization Tests ──────────────────────────────────────

    // Test 8: soup_only does NOT fire on pre-workout veggie meal
    const preVeggies = [
      { food: { id:'khyar', cat:'veggie', nameAr:'خيار', processedLevel:'none' }, grams:100, cals:16, pro:1, carb:3, fat:0 },
      { food: { id:'tmatm', cat:'veggie', nameAr:'طماطم', processedLevel:'none' }, grams:80, cals:14, pro:1, carb:3, fat:0 }
    ];
    const t8pattern = FORBIDDEN_MEAL_PATTERNS.find(p => p.name === 'soup_only');
    assert('soup_only does NOT fire on pre-workout', t8pattern && !t8pattern.check(preVeggies, 'pre'));

    // Test 9: dessert_as_meal does NOT fire on snack type
    const snackDessertItems = [
      { food: { id:'ice_cream', cat:'snack', nameAr:'آيس كريم', processedLevel:'very_high', carb:25 }, grams:100, cals:207, pro:3, carb:25, fat:11 }
    ];
    const t9pattern = FORBIDDEN_MEAL_PATTERNS.find(p => p.name === 'dessert_as_meal');
    assert('dessert_as_meal does NOT fire on snack type', t9pattern && !t9pattern.check(snackDessertItems, 'snack'));

    // Test 10: Rotation cap — excellent protein never scores below 30
    MealRotationTracker.reset();
    MealRotationTracker.markProtein('chicken_breast');
    const chickenFood = find('chicken_breast');
    if (chickenFood) {
      const rotScore = scoreWithRotation(chickenFood, 'lunch', { diet:'balanced', goal:'cut', health:[], problems:[] });
      assert('Excellent protein floor >= 30 after rotation penalty', rotScore >= 30);
    }
    MealRotationTracker.reset();

    // Test 11: Validation priority — medical error raises critical
    const kidneyCtx = { diet:'balanced', goal:'cut', health:['kidney'], problems:[] };
    const kidneyMeal = [
      { food: find('spinach') || { id:'spinach', cat:'veggie', nameAr:'سبانخ' }, grams:100, cals:23, pro:3, carb:4, fat:0 }
    ].filter(p => p.food);
    if (kidneyMeal.length) {
      const t11 = validateMealLogic('lunch', kidneyMeal, kidneyCtx);
      // spinach is in kidney avoidFoods — should produce critical
      assert('Medical avoidFood generates critical issue', t11.critical.length > 0);
    }

    // Test 12: Infinite loop guard is initialized
    assert('optimizePortions loop guard initialized', optimizePortions._p3Running === false);

    // Test 13: No double-penalty for no_protein_main
    const noProMeal = [
      { food: { id:'white_rice', cat:'carb', nameAr:'أرز أبيض', processedLevel:'moderate', pro:0 }, grams:200, cals:260, pro:0, carb:58, fat:0.4 }
    ];
    const t13 = validateMealLogic('lunch', noProMeal, { diet:'balanced', goal:'cut', health:[], problems:[] });
    // Should have critical messages but not duplicate the protein message
    const proMessages = t13.critical.filter(c => c.includes('بروتين'));
    assert('No duplicate protein critical message', proMessages.length <= 1);

    console.log(`\nPhase 3 Tests: ${passed} passed, ${failed} failed`);
    return { passed, failed };
  }
};

LOG('✔ Phase 3 Complete — Smart Meal Logic Engine: Composition Rules + Validator + Rotation + Pairing');

// ═══════════════════════════════════════════════════════════════
//  MEAL INTELLIGENCE PATCH (MIP) — v29
//  Advanced Meal Intelligence: Combination Realism · Adherence ·
//  Diversity · Satiety Orchestration · Timing · Portion Realism
//
//  ADDITIVE ONLY — no existing system is replaced or modified.
//  All logic is purely layered ON TOP of existing scorers.
//  Safe fallbacks: any MIP error returns 0 delta (no score change).
// ═══════════════════════════════════════════════════════════════
LOG('MIP v29 — Meal Intelligence Patch loading...');

// ─────────────────────────────────────────────────────────────
//  MIP-1: FOOD COMBINATION INCOMPATIBILITY RUNTIME ENFORCER
//  Extends FOOD_INTELLIGENCE.incompatibleWith to active scoring.
//  Previously: incompatibleWith was declared but never runtime-checked.
//  Now: incompatible co-presence in same meal scores -25 (advisory).
// ─────────────────────────────────────────────────────────────
const MIP_INCOMPATIBILITY = {
  getPenalty(foodId, mealItemIds) {
    try {
      const intel = FOOD_INTELLIGENCE[foodId];
      if (!intel || !intel.incompatibleWith || !intel.incompatibleWith.length) return 0;
      const clash = intel.incompatibleWith.some(badId => mealItemIds.includes(badId));
      return clash ? 25 : 0;
    } catch(e) { return 0; }
  },

  getStructurePenalty(food, mealType, mealItemIds, mealItems) {
    try {
      let penalty = 0;
      const intel = FOOD_INTELLIGENCE[food.id] || {};
      const isMainMeal = ['lunch','dinner','breakfast'].includes(mealType);
      if (intel.mealRole === 'main_protein' && isMainMeal) {
        const alreadyHasMainProt = mealItems.some(it => {
          const iIntel = FOOD_INTELLIGENCE[it.food ? it.food.id : it.id] || {};
          return iIntel.mealRole === 'main_protein' && (it.food ? it.food.id : it.id) !== food.id;
        });
        if (alreadyHasMainProt) penalty += 30;
      }
      if (intel.mealRole === 'quick_carb' && isMainMeal) {
        const alreadyHasQuickCarb = mealItems.some(it => {
          const iIntel = FOOD_INTELLIGENCE[it.food ? it.food.id : it.id] || {};
          return iIntel.mealRole === 'quick_carb';
        });
        if (alreadyHasQuickCarb) penalty += 20;
      }
      return penalty;
    } catch(e) { return 0; }
  }
};

// ─────────────────────────────────────────────────────────────
//  MIP-2: ADVANCED ADHERENCE SCORER
// ─────────────────────────────────────────────────────────────
const MIP_ADHERENCE = {
  getDelta(food, mealType, context, planDayIndex) {
    try {
      let delta = 0;
      const { problems, goal } = context;
      const intel = FOOD_INTELLIGENCE[food.id] || {};
      const adherenceScore = intel.adherenceScore || 5;
      if (goal === 'cut' && adherenceScore >= 9) delta += 4;
      if (['lunch','dinner'].includes(mealType) && food.cat === 'snack' &&
          food.cal > 400 && ['high','very_high'].includes(food.processedLevel || '')) delta -= 8;
      if (problems.includes('emotional') || problems.includes('sweets')) {
        if (adherenceScore >= 8 && (intel.satietyLevel || 0) >= 7) delta += 6;
        if (intel.digestionSpeed === 'very_fast' && food.carb > 25 &&
            ['high','very_high'].includes(food.processedLevel || '')) delta -= 8;
      }
      if (planDayIndex >= 4 && adherenceScore <= 6 && food.cat === 'protein') delta += 5;
      if (mealType === 'snack' && adherenceScore >= 9 && ['snack','fruit'].includes(food.cat)) delta += 5;
      return delta;
    } catch(e) { return 0; }
  }
};

// ─────────────────────────────────────────────────────────────
//  MIP-3: MEAL DIVERSITY INTELLIGENCE
// ─────────────────────────────────────────────────────────────
const MIP_DIVERSITY = {
  usedVeggies:  [],
  usedTextures: [],

  reset() { this.usedVeggies = []; this.usedTextures = []; },

  getTextureBucket(foodId) {
    try {
      const intel = FOOD_INTELLIGENCE[foodId] || {};
      const style = (intel.cookingStyle || '').toLowerCase();
      if (style.includes('raw')) return 'raw';
      if (style.includes('boil') || style.includes('steam') || style.includes('cooked')) return 'soft';
      if (style.includes('grill') || style.includes('bake') || style.includes('baked')) return 'grilled';
      if (style.includes('fry') || style.includes('fried')) return 'fried';
      return 'other';
    } catch(e) { return 'other'; }
  },

  markVeggie(foodId) {
    const cid = getCanonicalFoodId(foodId);
    if (!this.usedVeggies.includes(cid)) this.usedVeggies.push(cid);
    const tex = this.getTextureBucket(cid);
    if (!this.usedTextures.includes(tex)) this.usedTextures.push(tex);
  },

  getVeggieRepeatPenalty(foodId) {
    try { return this.usedVeggies.includes(getCanonicalFoodId(foodId)) ? 12 : 0; } catch(e) { return 0; }
  },

  getTextureDiversityBonus(foodId) {
    try {
      const tex = this.getTextureBucket(getCanonicalFoodId(foodId));
      return !this.usedTextures.includes(tex) ? 5 : 0;
    } catch(e) { return 0; }
  },

  getProteinFamilyPenalty(foodId) {
    try {
      const cid = getCanonicalFoodId(foodId);
      const families = {
        chicken: ['chicken_breast','chicken_thigh','chicken_liver','chicken_crispy','chicken_panee','chicken_burger','chicken_soup'],
        beef:    ['beef_lean','beef_ground','kofta_grilled_skewer','kofta_oven','homemade_burger','hawawshi_homemade','musaka'],
        egg:     ['eggs_whole','egg_whites','eggs_fried_shakshouka'],
        fish:    ['salmon','tuna_canned','tuna_fresh','tilapia','shrimp'],
        legume:  ['lentils','foul','chickpeas','lentil_soup'],
      };
      for (const [fam, ids] of Object.entries(families)) {
        if (ids.includes(cid)) {
          const familyUsed = (MealRotationTracker.usedProteins || []).filter(uid => ids.includes(uid)).length;
          return familyUsed >= 2 ? 10 : 0;
        }
      }
      return 0;
    } catch(e) { return 0; }
  }
};

// ─────────────────────────────────────────────────────────────
//  MIP-4: ADVANCED SATIETY ORCHESTRATOR
// ─────────────────────────────────────────────────────────────
const MIP_SATIETY = {
  getCaloricDensityCategory(food) {
    if (!food.cal) return 'medium';
    if (food.cal < 60)  return 'very_low';
    if (food.cal < 120) return 'low';
    if (food.cal < 250) return 'medium';
    if (food.cal < 400) return 'high';
    return 'very_high';
  },

  getVolumeSatietyDelta(food, mealType, context) {
    try {
      if (!context.problems.includes('satiety') && !context.problems.includes('hunger')) return 0;
      const density = this.getCaloricDensityCategory(food);
      const scores = { very_low:10, low:6, medium:0, high:-4, very_high:-8 };
      let delta = scores[density] || 0;
      if (mealType === 'breakfast') {
        if (food.cat === 'protein' && food.pro >= 15) delta += 5;
        if (['high','very_high'].includes(food.fiberLevel || '')) delta += 4;
      }
      if (mealType === 'dinner') {
        const intel = FOOD_INTELLIGENCE[food.id] || {};
        if ((intel.satietyLevel || 0) >= 8) delta += 4;
      }
      if (mealType === 'snack') {
        const intel = FOOD_INTELLIGENCE[food.id] || {};
        if ((intel.satietyLevel || 0) >= 7 && food.cal < 200) delta += 5;
      }
      if (context.goal === 'cut') {
        if (density === 'very_low') delta += 4;
        if (density === 'very_high') delta -= 4;
      }
      return delta;
    } catch(e) { return 0; }
  },

  getCalorieTrapPenalty(food, mealType) {
    try {
      if (!['lunch','dinner','breakfast'].includes(mealType)) return 0;
      const density = this.getCaloricDensityCategory(food);
      if (density === 'very_high' && !['protein','dairy'].includes(food.cat)) return 10;
      return 0;
    } catch(e) { return 0; }
  }
};

// ─────────────────────────────────────────────────────────────
//  MIP-5: TIMING INTELLIGENCE
// ─────────────────────────────────────────────────────────────
const MIP_TIMING = {
  getTimingDelta(food, mealType) {
    try {
      let delta = 0;
      const intel = FOOD_INTELLIGENCE[food.id] || {};
      const digSpeed = intel.digestionSpeed || 'medium';
      const insulinImpact = intel.insulinImpact || 'medium';
      const fatQuality = intel.fatQuality || 'moderate';
      if (mealType === 'pre') {
        if (food.fat > 15) delta -= 12;
        if (fatQuality === 'saturated') delta -= 10;
        if (['slow','very_slow'].includes(digSpeed)) delta -= 8;
        if (digSpeed === 'very_fast' && food.cat === 'carb') delta += 8;
        if (['high','very_high'].includes(food.fiberLevel || '')) delta -= 8;
        if (food.cat === 'carb' && ['slow','very_slow'].includes(digSpeed)) delta -= 6;
      }
      if (mealType === 'post') {
        if (['protein','dairy'].includes(food.cat) && digSpeed === 'fast') delta += 8;
        if (food.cat === 'carb' && ['high','very_high'].includes(insulinImpact)) delta += 6;
        if (fatQuality === 'saturated' && food.fat > 15) delta -= 8;
      }
      if (mealType === 'dinner') {
        if (food.cat === 'carb' && insulinImpact === 'very_high') delta -= 8;
        if (food.cat === 'carb' && food.cal > 300) delta -= 6;
        if (['protein','dairy'].includes(food.cat) && digSpeed === 'very_slow') delta -= 5;
        if (['cottage_cheese','greek_yogurt','yogurt_plain'].includes(food.id)) delta += 6;
      }
      return delta;
    } catch(e) { return 0; }
  }
};

// ─────────────────────────────────────────────────────────────
//  MIP-6: PORTION REALISM POST-PROCESSOR
// ─────────────────────────────────────────────────────────────
const MIP_PORTIONS = {
  MIN_GRAMS: { protein:60, dairy:80, carb:40, veggie:60, fat:5, fruit:80, snack:20 },
  MAX_GRAMS: { protein:300, dairy:350, carb:280, veggie:200, fat:40, fruit:250, snack:80 },

  applyPortionRealism(portions, targetCals) {
    if (!portions || !portions.length) return portions;
    try {
      let modified = false;
      const adjusted = portions.map(p => {
        const cat = p.food.cat || 'snack';
        const minG = this.MIN_GRAMS[cat] || 20;
        const maxG = this.MAX_GRAMS[cat] || 300;
        let newGrams = Math.round(Math.max(minG, Math.min(maxG, p.grams)) / 5) * 5;
        if (newGrams === p.grams) return p;
        modified = true;
        return {
          ...p,
          grams: newGrams,
          cals:  Math.round(p.food.cal * newGrams / 100),
          pro:   +(p.food.pro  * newGrams / 100).toFixed(1),
          carb:  +(p.food.carb * newGrams / 100).toFixed(1),
          fat:   +(p.food.fat  * newGrams / 100).toFixed(1),
          _mipPortionAdjusted: true
        };
      });
      if (portions._p3Validation) adjusted._p3Validation = portions._p3Validation;
      if (portions._p3Pairing)    adjusted._p3Pairing    = portions._p3Pairing;
      if (portions._p3HealWarning) adjusted._p3HealWarning = portions._p3HealWarning;
      if (modified) LOG('MIP-6: Portion realism adjustment applied');
      return adjusted;
    } catch(e) {
      LOG('MIP-6 error: ' + e.message);
      return portions;
    }
  }
};

// ─────────────────────────────────────────────────────────────
//  MIP INTEGRATION — scoreWithRotation wrapper
// ─────────────────────────────────────────────────────────────
const _mip_originalScoreWithRotation = scoreWithRotation;
// ── FIX-SCORE-MIP: converted from `function` declaration to assignment ──
// Reason: `const scoreWithRotation` at line ~13708 and `function scoreWithRotation`
// in the same scope causes SyntaxError (cannot redeclare block-scoped variable).
// Runtime chain: v1(const) - _mip_originalScoreWithRotation - MIP wrapper - HF-3 wrapper
scoreWithRotation = function scoreWithRotation(food, mealType, context, _mipState) {
  let score = _mip_originalScoreWithRotation(food, mealType, context);
  try {
    score += MIP_ADHERENCE.getDelta(food, mealType, context, (_mipState && _mipState.dayIndex) || 0);
    score += MIP_SATIETY.getVolumeSatietyDelta(food, mealType, context);
    score -= MIP_SATIETY.getCalorieTrapPenalty(food, mealType);
    score += MIP_TIMING.getTimingDelta(food, mealType);
    if (food.cat === 'veggie') {
      score -= MIP_DIVERSITY.getVeggieRepeatPenalty(food.id);
      score += MIP_DIVERSITY.getTextureDiversityBonus(food.id);
    }
    if (['protein','dairy'].includes(food.cat)) {
      score -= MIP_DIVERSITY.getProteinFamilyPenalty(food.id);
    }
  } catch(e) { LOG('MIP scoreWithRotation error: ' + e.message); }
  return Math.max(10, Math.min(100, score));
};
scoreWithRotation._mipWrapped = true;

// ─────────────────────────────────────────────────────────────
//  MIP INTEGRATION — optimizePortions wrapper (MIP-1 + MIP-6)
// ─────────────────────────────────────────────────────────────
const _mip_originalOptimizePortions = optimizePortions;
optimizePortions = function optimizePortions(mealType, targetCals, targetMacros, availableForMeal) {
  let result;
  try {
    result = _mip_originalOptimizePortions(mealType, targetCals, targetMacros, availableForMeal);
  } catch(e) {
    LOG('MIP optimizePortions error: ' + e.message);
    return _mip_originalOptimizePortions(mealType, targetCals, targetMacros, availableForMeal);
  }
  if (!result || !result.length) return result;
  try {
    const mealIds = result.map(p => p.food.id);
    result.forEach(p => {
      const penalty = MIP_INCOMPATIBILITY.getPenalty(p.food.id, mealIds.filter(id => id !== p.food.id));
      if (penalty > 0 && !result._mipIncompatWarning) {
        const intel = FOOD_INTELLIGENCE[p.food.id] || {};
        const clashIds = (intel.incompatibleWith || []).filter(id => mealIds.includes(id));
        if (clashIds.length) {
          const clashNames = clashIds.map(id => {
            const f = (typeof FOOD_DB !== 'undefined' ? FOOD_DB : []).find(f => f.id === id);
            return f ? f.nameAr : id;
          });
          result._mipIncompatWarning = '' + p.food.nameAr + ' لا يتناسب مثاليا مع ' + clashNames.join('، ');
        }
      }
    });
    result.forEach(p => { if (p.food.cat === 'veggie') MIP_DIVERSITY.markVeggie(p.food.id); });
    result = MIP_PORTIONS.applyPortionRealism(result, targetCals);
  } catch(e) { LOG('MIP post-processing error: ' + e.message); }
  return result;
}

// ─────────────────────────────────────────────────────────────
//  MIP INTEGRATION — buildSmartMealPlan wrapper (reset diversity)
// ─────────────────────────────────────────────────────────────
const _mip_originalBuildSmartMealPlan = buildSmartMealPlan;
buildSmartMealPlan = function buildSmartMealPlan(totalCals, macros, weeklyMeta) {
  MIP_DIVERSITY.reset();
  LOG('⟳ MIP v29 — Diversity Tracker reset for new plan');
  return _mip_originalBuildSmartMealPlan(totalCals, macros, weeklyMeta);
}

// ─────────────────────────────────────────────────────────────
//  MIP QUALITY RENDERER EXTENSION
// ─────────────────────────────────────────────────────────────
const _mip_originalRenderP3Quality = renderP3Quality;
renderP3Quality = function renderP3Quality(portions) {
  let html = _mip_originalRenderP3Quality(portions);
  try {
    if (portions._mipIncompatWarning) {
      html += '<div style="font-size:10.5px;color:var(--blue);margin-top:3px;padding:3px 6px;background:rgba(42,140,232,0.07);border-radius:5px;">' + portions._mipIncompatWarning + '</div>';
    }
    const hasAdjusted = Array.isArray(portions) && portions.some(p => p._mipPortionAdjusted);
    if (hasAdjusted) {
      html += '<div style="font-size:10px;color:var(--text-dim);margin-top:2px;">MIP: كميات معدلة لواقعية أفضل</div>';
    }
  } catch(e) { /* silent fallback */ }
  return html;
}

// ─────────────────────────────────────────────────────────────
//  MIP TEST SUITE (console: MIP_TESTS.run())
// ─────────────────────────────────────────────────────────────
const MIP_TESTS = {
  run() {
    let passed = 0, failed = 0;
    const assert = (label, cond) => {
      if (cond) { passed++; console.log('MIP: ' + label); }
      else { failed++; console.error('MIP FAIL: ' + label); }
    };
    assert('scoreWithRotation MIP-wrapped', scoreWithRotation._mipWrapped === true);
    const pen = MIP_INCOMPATIBILITY.getPenalty('avocado', ['peanut_butter']);
    assert('Incompatibility: avocado+peanut_butter detected', pen > 0);
    assert('No incompatibility: chicken+rice is fine', MIP_INCOMPATIBILITY.getPenalty('chicken_breast', ['brown_rice']) === 0);
    const db = typeof FOOD_DB !== 'undefined' ? FOOD_DB : [];
    const cucumber = db.find(f => f.id === 'khyar');
    if (cucumber) {
      const d = MIP_SATIETY.getVolumeSatietyDelta(cucumber, 'lunch', { diet:'balanced', goal:'cut', health:[], problems:['hunger'] });
      assert('Satiety: cucumber gets positive delta on hunger', d > 0);
    }
    const peanutButter = db.find(f => f.id === 'peanut_butter');
    if (peanutButter) assert('Timing: peanut_butter pre-workout negative', MIP_TIMING.getTimingDelta(peanutButter, 'pre') < 0);
    const fake = [{ food:{ id:'chicken_breast', cat:'protein', cal:110, pro:23, carb:0, fat:2, nameAr:'فراخ' }, grams:20, cals:22, pro:4.6, carb:0, fat:0.4 }];
    assert('Portion realism: 20g protein bumped to >= 60g', MIP_PORTIONS.applyPortionRealism(fake, 400)[0].grams >= 60);
    MIP_DIVERSITY.reset();
    MIP_DIVERSITY.markVeggie('broccoli');
    assert('Veggie repeat penalty after marking', MIP_DIVERSITY.getVeggieRepeatPenalty('broccoli') > 0);
    assert('No penalty for new veggie', MIP_DIVERSITY.getVeggieRepeatPenalty('spinach') === 0);
    MIP_DIVERSITY.reset();
    const cottage = db.find(f => f.id === 'cottage_cheese');
    if (cottage) assert('Timing: cottage_cheese positive delta at dinner', MIP_TIMING.getTimingDelta(cottage, 'dinner') > 0);
    if (db.length) {
      const s = scoreWithRotation(db[0], 'lunch', { diet:'balanced', goal:'cut', health:[], problems:[] });
      assert('scoreWithRotation no NaN with MIP', !isNaN(s) && s >= 10 && s <= 100);
    }
    const oil = db.find(f => f.id === 'olive_oil');
    if (oil) assert('Calorie trap: olive_oil lunch penalty > 0', MIP_SATIETY.getCalorieTrapPenalty(oil, 'lunch') > 0);
    const fakeItems = [{ food: { id:'chicken_breast', cat:'protein', nameAr:'فراخ' } }];
    assert('Structure: dual main_protein gets penalty', MIP_INCOMPATIBILITY.getStructurePenalty({ id:'beef_lean', cat:'protein' }, 'lunch', ['chicken_breast'], fakeItems) > 0);
    console.log('\nMIP Tests: ' + passed + ' passed, ' + failed + ' failed');
    return { passed, failed };
  }
};

LOG('✔ MIP v29 Complete — Meal Intelligence Patch: Combination Realism · Adherence · Diversity · Satiety · Timing · Portions');
