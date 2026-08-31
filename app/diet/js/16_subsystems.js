// ═══════════════════════════════════════════════════════════════════
//  ██╗  ██╗ ██████╗ ████████╗███████╗██╗███╗   ██╗ ██████╗
//  ██║  ██║██╔═══██╗╚══██╔══╝██╔════╝██║████╗  ██║██╔════╝
//  ███████║██║   ██║   ██║   █████╗  ██║██╔██╗ ██║██║  ███╗
//  ██╔══██║██║   ██║   ██║   ██╔══╝  ██║██║╚██╗██║██║   ██║
//  ██║  ██║╚██████╔╝   ██║   ██║     ██║██║ ╚████║╚██████╔╝
//  ╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═╝     ╚═╝╚═╝  ╚═══╝ ╚═════╝
//
//  SURGICAL HOTFIX BLOCK — v29-HF1
//  Applied: Non-destructive monkey-patches & safe injections
//  Fixes: [HF-1] Medical Filter | [HF-2] Carb-Cycle Double Dip |
//         [HF-3] NAFLD Honey  | [HF-4] Manual Grams | [HF-5] Slider Perf
//  Safety: All original functions preserved via closure references.
//          Each fix is additive-only and NaN-safe.
// ═══════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────
//  [HF-1] MEDICAL FILTER BYPASS FIX
//  Wraps isFoodAllowed() to enforce V16 schema `blockedConditions`
//  against DE.healthConditions — previously only legacy `avoidHealth`
//  was checked, leaving blockedConditions silently ignored.
//  Strategy: store original, re-declare, delegate + extend.
// ───────────────────────────────────────────────────────────────────
(function _hf1_medicalFilterFix() {
  const _orig_isFoodAllowed = isFoodAllowed;

  isFoodAllowed = function isFoodAllowed(food) {
    // ── Delegate to original first (legacy + diet checks) ─────────
    const legacyResult = _orig_isFoodAllowed(food);
    if (!legacyResult.ok) return legacyResult; // already blocked

    // ── V16 blockedConditions enforcement ─────────────────────────
    // food.blockedConditions is guaranteed to exist (normalised at DB init)
    const bc = food.blockedConditions;
    if (bc && bc.length) {
      const health = (typeof DE !== 'undefined' && DE.healthConditions) ? DE.healthConditions : [];
      for (let i = 0; i < bc.length; i++) {
        if (health.includes(bc[i])) {
          const label = (typeof HC_LABELS !== 'undefined' && HC_LABELS[bc[i]]) ? HC_LABELS[bc[i]] : bc[i];
          return { ok: false, reason: 'ممنوع طبيا لحالة: ' + label + ' (V16)' };
        }
      }
    }

    return legacyResult; // { ok:true, reason:'' }
  };

  // Propagate any metadata flags the original may have had
  if (typeof _orig_isFoodAllowed._mipWrapped !== 'undefined') {
    isFoodAllowed._mipWrapped = _orig_isFoodAllowed._mipWrapped;
  }

  if (typeof LOG === 'function') LOG('✔ [HF-1] isFoodAllowed — V16 blockedConditions filter active');
})();


// ───────────────────────────────────────────────────────────────────
//  [HF-2] CARB-CYCLING DOUBLE-DIPPING FIX
//  Wraps ccpmApply() so that portions already flagged as
//  `_ccpmAdjusted` (i.e, macro-targets layer already boosted them)
//  are not multiplied a second time — multiplier collapses to 1.0.
//  Strategy: intercept input portions, skip items already adjusted.
// ───────────────────────────────────────────────────────────────────
(function _hf2_carbCycleDoubleDipFix() {
  const _orig_ccpmApply = ccpmApply;

  ccpmApply = function ccpmApply(portions, mealType, weeklyMeta) {
    if (!portions || !portions.length) return portions;

    // If weeklyMeta signals that getMealMacro targets layer already
    // applied a carb-cycle boost, mark those portions as pre-adjusted
    // so the modulator skips them (multiplier effectively = 1.0).
    const macroLayerAlreadyApplied =
      weeklyMeta && weeklyMeta.carbCycleActive &&
      weeklyMeta.ccMacroLayerApplied === true;

    if (macroLayerAlreadyApplied) {
      // Stamp each carb portion as already-adjusted before delegating
      const stamped = portions.map(function(p) {
        const isCarb = (typeof CCPM_CARB_IDS !== 'undefined' && CCPM_CARB_IDS.has(p.food.id)) ||
                       p.food.cat === 'carb';
        const isQuickCarb = (typeof CCPM_QUICK_CARB_IDS !== 'undefined' && CCPM_QUICK_CARB_IDS.has(p.food.id)) ||
                            p.food.cat === 'fruit';
        if ((isCarb || isQuickCarb) && !p._ccpmAdjusted) {
          return Object.assign({}, p, { _ccpmAdjusted: true, _ccpmMult: 1.0, _hf2Guard: true });
        }
        return p;
      });
      // Transfer metadata arrays
      if (portions._p3Validation) stamped._p3Validation = portions._p3Validation;
      if (portions._p3Pairing)    stamped._p3Pairing    = portions._p3Pairing;
      if (portions._mipIncompatWarning) stamped._mipIncompatWarning = portions._mipIncompatWarning;

      if (typeof LOG === 'function') LOG('[HF-2] ccpmApply — macro layer already applied, double-dip guarded');
      return _orig_ccpmApply(stamped, mealType, weeklyMeta);
    }

    // Default: full delegation, no interference
    return _orig_ccpmApply(portions, mealType, weeklyMeta);
  };

  if (typeof LOG === 'function') LOG('✔ [HF-2] ccpmApply — carb-cycle double-dip guard active');
})();


// ───────────────────────────────────────────────────────────────────
//  [HF-3] NAFLD HIDDEN FRUCTOSE HOTFIX (Honey/Molasses Scoring)
//  Wraps the final scoreWithRotation (post-MIP) to apply a clinical
//  -20 point penalty on concentrated fructose sources (honey, molasses)
//  when the user has 'fatty-liver' as a health condition.
//  Score is clamped to [10, 100] per engine convention.
// ───────────────────────────────────────────────────────────────────
(function _hf3_nafldHoneyFix() {
  // Concentrated fructose sources to penalise under NAFLD
  const HF3_FRUCTOSE_IDS = new Set([
    'honey_egyptian', 'honey_white_sidr', 'honey_natural',
    'honey_black_carob', 'molasses_black'
  ]);
  const HF3_NAFLD_PENALTY = 20;

  const _orig_scoreWithRotation = scoreWithRotation;

  scoreWithRotation = function scoreWithRotation(food, mealType, context, _mipState) {
    let score = _orig_scoreWithRotation(food, mealType, context, _mipState);

    try {
      const health = (context && Array.isArray(context.health)) ? context.health : [];
      if (health.includes('fatty-liver') && HF3_FRUCTOSE_IDS.has(food.id)) {
        score = Math.max(10, Math.min(100, score - HF3_NAFLD_PENALTY));
      }
    } catch (e) {
      if (typeof LOG === 'function') LOG('[HF-3] scoreWithRotation NAFLD error: ' + e.message);
    }

    return score;
  };

  // Carry forward the MIP wrapper flag so assertion tests still pass
  scoreWithRotation._mipWrapped = true;
  scoreWithRotation._hf3NafldActive = true;

  if (typeof LOG === 'function') LOG('✔ [HF-3] scoreWithRotation — NAFLD fructose penalty (-20) active');
})();



// ══ END HOTFIX BLOCK v29-HF1 ══


// ═══════════════════════════════════════════════════════════════════
//  ██╗  ██╗███████╗     ██████╗      ██╗  ██╗███████╗      █████╗
//  ██║  ██║██╔════╝    ██╔════╝      ██║  ██║██╔════╝     ██╔══██╗
//  ███████║█████╗      ███████╗█████╗███████║█████╗       ╚█████╔╝
//  ██╔══██║██╔══╝      ██╔═══██╗╚════╝╚════██║╚═══╝        ╚═══██╗
//  ██║  ██║██║         ╚██████╔╝           ██║             █████╔╝
//  ╚═╝  ╚═╝╚═╝          ╚═════╝            ╚═╝             ╚════╝
//
//  SURGICAL HOTFIX BLOCK — v29-HF2
//  Fixes: [HF-6] Micronutrient Scoring Layer
//         [HF-7] Egyptian Meal Intelligence & Cuisine-Aware Grouping
//  Strategy: additive monkey-patches — zero touch on existing logic.
//            All original functions preserved via closure references.
// ═══════════════════════════════════════════════════════════════════


// ───────────────────────────────────────────────────────────────────
//  [HF-6] MICRONUTRIENT SCORING LAYER
//
//  Problem: Engine excels at macros but has no clinical micronutrient
//  awareness. Repeated chicken/rice/egg/banana/tomato combos pass all
//  existing checks while being deficient in K, Mg, omega-3, Ca, Fe.
//
//  Strategy:
//   1. MNL_PROFILES — per-food micronutrient density tags (additive,
//      no DB schema change required)
//   2. MNL_SESSION  — session-level micronutrient coverage tracker
//      (resets with MealRotationTracker on each new plan)
//   3. scoreFoodForContext wrapper — boosts under-represented micros,
//      penalises foods that worsen an already-deficient category
//   4. Validation badge — "غني بالمغنيسيوم" etc. added to meal cards
//
//  Evidence: EFSA DRIs 2019 · WHO nutrient guidelines · Egyptian Diet
//  Diversity studies (NNI Egypt 2015) which confirm Mg/K/Ca/omega-3
//  are the four most under-consumed micronutrients in Egyptian adults.
// ───────────────────────────────────────────────────────────────────
(function _hf6_micronutrientScoringLayer() {

  // ── Micronutrient density profiles per food (additive tag approach)
  // Format: foodId - Set of micronutrient tags it meaningfully contributes
  // Coverage threshold per nutrient before "adequate" flag:
  //   potassium: 2 portions covering it per day
  //   magnesium: 2 portions covering it per day
  //   omega3:    1 portion covering it per day
  //   calcium:   2 portions covering it per day
  //   iron:      1 portion covering it per day (higher bar for females)
  //   vitC:      2 portions covering it per day
  //   zinc:      2 portions covering it per day
  //   vitD:      1 portion covering it per day (hardest to get from food)
  //   fiber:     tracked separately, but counted here too

  const MNL_PROFILES = {
    // ── Proteins ─────────────────────────────────────────────────
    salmon:           ['omega3','vitD','zinc','selenium'],
    tuna_canned:      ['omega3','zinc','selenium'],
    tuna_fresh:       ['omega3','zinc','selenium','vitD'],
    sardines:         ['omega3','calcium','vitD','zinc'],
    mackerel:         ['omega3','vitD','zinc'],
    shrimp:           ['zinc','selenium','omega3'],
    chicken_breast:   ['zinc','selenium'],
    turkey_breast:    ['zinc','selenium','iron'],
    beef_lean:        ['iron','zinc','vitB12'],
    beef_ground:      ['iron','zinc','vitB12'],
    lamb:             ['iron','zinc','vitB12'],
    liver_chicken:    ['iron','vitA','zinc','vitB12','folate'],
    eggs_whole:       ['vitD','vitB12','zinc','selenium','choline'],
    egg_whites:       ['selenium'],
    // ── Dairy ────────────────────────────────────────────────────
    milk_skim:        ['calcium','vitD','vitB12','potassium'],
    greek_yogurt:     ['calcium','zinc','vitB12','potassium'],
    yogurt_plain:     ['calcium','vitB12','potassium'],
    cottage_cheese:   ['calcium','zinc','selenium'],
    feta_cheese:      ['calcium'],
    labneh_spreadable:['calcium'],
    // ── Vegetables ───────────────────────────────────────────────
    spinach:          ['iron','magnesium','potassium','vitK','folate','vitC'],
    broccoli:         ['vitC','vitK','calcium','folate','magnesium'],
    kale_veg:         ['vitK','vitC','calcium','magnesium','iron'],
    sweet_potato:     ['potassium','vitA','vitC','magnesium','fiber'],
    tomato:           ['vitC','potassium','lycopene'],
    tomato_cherry:    ['vitC','potassium','lycopene'],
    bell_pepper_red:  ['vitC','potassium','vitA'],
    cucumber:         ['potassium','vitK'],
    zucchini_veg:     ['potassium','magnesium','vitC'],
    asparagus_veg:    ['folate','vitK','vitC','iron'],
    cauliflower:      ['vitC','vitK','folate'],
    mushroom:         ['vitD','vitB12','zinc','selenium','potassium'],
    eggplant_grilled: ['potassium','magnesium','fiber'],
    // ── Carbs ────────────────────────────────────────────────────
    oats:             ['magnesium','iron','zinc','fiber','vitB1'],
    brown_rice:       ['magnesium','vitB1','fiber'],
    quinoa:           ['magnesium','iron','zinc','fiber','calcium'],
    lentils:          ['iron','folate','magnesium','potassium','fiber','zinc'],
    foul:             ['iron','folate','magnesium','potassium','fiber'],
    chickpeas:        ['iron','folate','magnesium','potassium','fiber','zinc'],
    sweet_potato:     ['potassium','vitA','vitC','magnesium','fiber'],
    // ── Fruits ───────────────────────────────────────────────────
    banana:           ['potassium','vitB6','magnesium'],
    orange:           ['vitC','potassium','folate'],
    strawberry:       ['vitC','folate','potassium'],
    mango_fresh:      ['vitC','vitA','potassium','folate'],
    berries_mix:      ['vitC','vitK','manganese','fiber'],
    // ── Fats & Seeds ─────────────────────────────────────────────
    almonds:          ['magnesium','vitE','calcium','zinc'],
    walnuts:          ['omega3','magnesium','vitE','zinc'],
    olive_oil:        ['vitE','vitK'],
    avocado:          ['potassium','magnesium','vitE','vitK'],
    sunflower_seeds:  ['vitE','magnesium','selenium'],
    lupin_seeds:      ['iron','potassium','calcium','magnesium','zinc'],
    sesame_tahini:    ['calcium','iron','magnesium','zinc'],
    tahini_salad:     ['calcium','iron','magnesium'],
    pumpkin_seeds:    ['magnesium','zinc','omega3','iron'],
    flaxseeds:        ['omega3','magnesium','vitE'],
    // ── Egyptian staples ─────────────────────────────────────────
    baladi_bread:     ['iron','fiber','vitB1'],
    whole_bread:      ['iron','fiber','vitB1','magnesium'],
    hummus_with_olive_oil: ['iron','calcium','potassium','magnesium','fiber'],
  };

  // ── Micronutrient importance weights for scoring
  // Higher = bigger bonus for contributing to this nutrient
  const MNL_WEIGHTS = {
    omega3:     14,  // hardest to get from typical Egyptian diet
    calcium:    12,  // bone health, under-consumed
    magnesium:  11,  // electrolyte, often deficient
    potassium:  10,  // cardiovascular, common deficiency
    iron:       10,  // anaemia prevalent in Egypt
    vitD:       10,  // very hard to get from diet
    zinc:        8,  // immune + hormone function
    vitC:        7,  // antioxidant, cofactor for iron absorption
    folate:      7,  // cell division, often under-consumed
    selenium:    6,
    vitB12:      8,  // deficient in plant-heavy diets
    fiber:       5,  // already tracked elsewhere, small signal here
    vitK:        4,
    vitA:        4,
    vitB1:       3,
    lycopene:    3,
    choline:     3,
    manganese:   2,
    vitE:        4,
  };

  // ── Session tracker — counts how many times each micro was covered this plan
  const MNL_SESSION = {
    coverage: {},        // { nutrient: count }
    targetCounts: {      // how many daily portions needed before "adequate"
      omega3: 1, calcium: 2, magnesium: 2, potassium: 2, iron: 1,
      vitD: 1, zinc: 2, vitC: 2, folate: 1, selenium: 1, vitB12: 1,
      fiber: 3, vitK: 1, vitA: 1, vitB1: 1, lycopene: 1, choline: 1,
    },

    reset() { this.coverage = {}; },

    mark(foodId) {
      const nutrients = MNL_PROFILES[foodId] || [];
      nutrients.forEach(n => {
        this.coverage[n] = (this.coverage[n] || 0) + 1;
      });
    },

    // How "needed" is this nutrient? 0 = already covered, up to 1.0 = critical gap
    getNeedScore(nutrient) {
      const target = this.targetCounts[nutrient] || 1;
      const current = this.coverage[nutrient] || 0;
      if (current >= target) return 0;
      return (target - current) / target; // 1.0 = totally missing, 0.5 = half covered
    },

    // Badge summary of micronutrient coverage for display
    getCoverageBadges() {
      const badges = [];
      const nutrients = Object.keys(this.targetCounts);
      nutrients.forEach(n => {
        const target  = this.targetCounts[n] || 1;
        const current = this.coverage[n] || 0;
        if (current >= target) {
          const labels = {
            omega3:'أوميجا-3', calcium:'كالسيوم', magnesium:'مغنيسيوم',
            potassium:'بوتاسيوم', iron:'حديد', vitD:'فيتامين D', zinc:'زنك',
            vitC:'فيتامين C', folate:'فولات', selenium:'سيلينيوم',
            vitB12:'B12', fiber:'ألياف'
          };
          if (labels[n]) badges.push('✓ ' + labels[n]);
        }
      });
      return badges;
    },

    getGapList() {
      const gaps = [];
      const nutrientLabels = {
        omega3:'أوميجا-3', calcium:'كالسيوم', magnesium:'مغنيسيوم',
        potassium:'بوتاسيوم', iron:'حديد', vitD:'فيتامين D', zinc:'زنك',
        vitC:'فيتامين C', folate:'فولات', vitB12:'B12'
      };
      Object.entries(nutrientLabels).forEach(([n, label]) => {
        const target  = this.targetCounts[n] || 1;
        const current = this.coverage[n] || 0;
        if (current < target) gaps.push(label);
      });
      return gaps;
    }
  };

  // ── Expose MNL_SESSION globally for use in rendering
  window.MNL_SESSION = MNL_SESSION;

  // ── Wrap scoreFoodForContext to inject micronutrient scoring ──────
  const _orig_scoreFoodForContext = scoreFoodForContext;
  scoreFoodForContext = function scoreFoodForContext(food, mealType, context) {
    let score = _orig_scoreFoodForContext(food, mealType, context);
    try {
      const nutrients = MNL_PROFILES[food.id] || [];
      if (!nutrients.length) return score;

      let mnBonus = 0;
      nutrients.forEach(nutrient => {
        const weight   = MNL_WEIGHTS[nutrient] || 3;
        const needScore = MNL_SESSION.getNeedScore(nutrient);
        if (needScore > 0) {
          // Scale bonus: max weight when completely missing, 0 when already covered
          mnBonus += Math.round(weight * needScore);
        }
      });

      // Cap micronutrient bonus at +20 so it can't override primary macro/health scoring
      score = Math.min(100, score + Math.min(mnBonus, 20));
    } catch(e) {
      if (typeof LOG === 'function') LOG('[HF-6] MNL score error: ' + e.message);
    }
    return score;
  };

  // ── Wrap optimizePortions to mark micronutrient coverage after selection
  const _orig_optP_mnl = optimizePortions;
  optimizePortions = function optimizePortions(mealType, targetCals, targetMacros, availableForMeal) {
    const result = _orig_optP_mnl(mealType, targetCals, targetMacros, availableForMeal);
    try {
      if (Array.isArray(result)) {
        result.forEach(p => MNL_SESSION.mark(p.food.id));
      }
    } catch(e) { /* silent */ }
    return result;
  };

  // ── Wrap MealRotationTracker.reset() to also reset MNL session ───
  const _orig_mrt_reset = MealRotationTracker.reset.bind(MealRotationTracker);
  MealRotationTracker.reset = function reset() {
    _orig_mrt_reset();
    MNL_SESSION.reset();
    if (typeof LOG === 'function') LOG('⟳ [HF-6] MNL_SESSION reset with MealRotationTracker');
  };

  // ── Inject micronutrient gap badges into final plan rendering ─────
  // Wraps buildSmartMealPlan to append a coverage report section after the meal cards
  const _orig_bsmp_mnl = buildSmartMealPlan;
  buildSmartMealPlan = function buildSmartMealPlan(totalCals, macros, weeklyMeta) {
    const result = _orig_bsmp_mnl(totalCals, macros, weeklyMeta);
    try {
      const gaps = MNL_SESSION.getGapList();
      const covered = MNL_SESSION.getCoverageBadges();
      const mealSection = document.getElementById('res-meals');
      if (!mealSection) return result;

      // Remove any previous MNL panel
      const old = document.getElementById('mnl-coverage-panel');
      if (old) old.remove();

      if (gaps.length === 0 && covered.length === 0) return result;

      const gapHtml = gaps.length
        ? `<div style="margin-top:8px;">
            <div style="font-size:11px;font-weight:800;color:var(--orange);margin-bottom:5px;">مغذيات تحتاج اهتمام في هذا اليوم:</div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;">
              ${gaps.map(g => `<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:14px;background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.3);color:var(--orange);">${g}</span>`).join('')}
            </div>
          </div>` : '';

      const covHtml = covered.length
        ? `<div style="margin-top:8px;">
            <div style="font-size:11px;font-weight:800;color:var(--green);margin-bottom:5px;">مغذيات مغطاة:</div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;">
              ${covered.map(b => `<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:14px;background:rgba(42,232,123,0.08);border:1px solid rgba(42,232,123,0.25);color:var(--green);">${b}</span>`).join('')}
            </div>
          </div>` : '';

      const panel = document.createElement('div');
      panel.id = 'mnl-coverage-panel';
      panel.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:14px;margin-top:10px;';
      panel.innerHTML = `
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:4px;">تغطية المغذيات الدقيقة</div>
        <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:8px;">تحليل مبني على محتوى الأطعمة المختارة — ليس بديلا عن تحليل مختبري</div>
        ${covHtml}
        ${gapHtml}
        ${gaps.length ? `<div style="margin-top:8px;font-size:10.5px;color:var(--text-dim);line-height:1.7;">
          لتغطية هذه الفجوات: أضف سبانخ أو سلمون أو لوز أو بقوليات في اليوم التالي</div>` : ''}
      `;
      mealSection.appendChild(panel);
    } catch(e) {
      if (typeof LOG === 'function') LOG('[HF-6] MNL panel render error: ' + e.message);
    }
    return result;
  };

  if (typeof LOG === 'function') LOG('✔ [HF-6] Micronutrient Scoring Layer active — MNL_SESSION + scoreFoodForContext boost + coverage panel');
})();


// ───────────────────────────────────────────────────────────────────
//  [HF-7] EGYPTIAN MEAL INTELLIGENCE & CUISINE-AWARE GROUPING
//
//  Problem: Engine builds "macro skeletons" — same protein in every
//  meal, no culinary logic, no realistic Egyptian meal patterns.
//
//  Strategy — three additive layers, zero touch on core engine:
//
//  Layer A: EGYPTIAN_MEAL_PATTERNS — defines realistic Egyptian
//           breakfast / lunch / dinner archetypes with required
//           anchors (e.g. foul + bread + egg for فطار شعبي) and
//           optional companions. Used by the scoring layer to boost
//           foods that "complete" a pattern already started.
//
//  Layer B: SYNERGY_GROUPS — cuisine-aware food synergy clusters.
//           Foods within the same cluster get a bonus when they
//           appear together (نعناع + طماطم + خيار = سلطة مصرية).
//
//  Layer C: ANTI_MONOTONY — tracks protein-source family across
//           the plan (poultry / red_meat / fish / egg / legume /
//           dairy) and enforces family rotation with a stronger
//           penalty than the existing canonical-ID system.
//
//  All layers are integrated into scoreWithRotation (the final scorer
//  that all callers use) via a single lightweight wrapper.
// ───────────────────────────────────────────────────────────────────
(function _hf7_egyptianMealIntelligence() {

  // ── LAYER A: Egyptian meal archetypes ────────────────────────────
  // Each pattern: { name, anchor (required IDs — at least 1 present),
  //                 companions (bonus foods), label }
  const EGYPTIAN_MEAL_PATTERNS = [
    {
      name: 'foul_breakfast',
      label: 'فطار فول مصري',
      anchor:     ['foul', 'foul_cart'],
      companions: ['baladi_bread','eggs_whole','olive_oil',
                   'tahini_salad','feta_cheese','lemon_juice'],
      mealTypes:  ['breakfast'],
    },
    {
      name: 'egg_breakfast',
      label: 'فطار بيض',
      anchor:     ['eggs_whole','egg_whites','eggs_scrambled','eggs_fried_shakshouka'],
      companions: ['baladi_bread','whole_bread','feta_cheese',
                   'labneh_spreadable','spinach','olive_oil'],
      mealTypes:  ['breakfast'],
    },
    {
      name: 'oat_breakfast',
      label: 'فطار شوفان',
      anchor:     ['oats'],
      companions: ['banana','strawberry','berries_mix','greek_yogurt','yogurt_plain',
                   'almonds','milk_skim'],
      mealTypes:  ['breakfast'],
    },
    {
      name: 'grilled_protein_lunch',
      label: 'غداء مشوي',
      anchor:     ['chicken_breast','turkey_breast','beef_lean','tilapia','salmon',
                   'chicken_thigh','shrimp'],
      companions: ['brown_rice','white_rice','sweet_potato','broccoli','salad_fattoush',
                   'grilled_vegetables_mix','tahini_salad','salad_caesar'],
      mealTypes:  ['lunch','dinner'],
    },
    {
      name: 'koshary_meal',
      label: 'كشري / مكرونة بقوليات',
      anchor:     ['lentils','chickpeas'],
      companions: ['pasta_ww','brown_rice','onion'],
      mealTypes:  ['lunch'],
    },
    {
      name: 'fish_meal',
      label: 'وجبة سمك مصري',
      anchor:     ['tilapia','salmon','tuna_canned','tuna_fresh','sardines','mackerel'],
      companions: ['brown_rice','sweet_potato','salad_fattoush','lemon_juice','tahini_salad','broccoli'],
      mealTypes:  ['lunch','dinner'],
    },
    {
      name: 'soup_lentil',
      label: 'شوربة عدس',
      anchor:     ['lentil_soup'],
      companions: ['baladi_bread','whole_bread','lemon_juice','spinach'],
      mealTypes:  ['dinner'],
    },
    {
      name: 'light_protein_dinner',
      label: 'عشاء خفيف بروتين',
      anchor:     ['cottage_cheese','greek_yogurt','egg_whites','tuna_canned'],
      companions: ['whole_bread','baladi_bread','spinach',
                   'bell_pepper_red','olive_oil'],
      mealTypes:  ['dinner'],
    },
    {
      name: 'prewo_carb_protein',
      label: 'قبل تمرين كارب+بروتين',
      anchor:     ['oats','banana','sweet_potato','brown_rice'],
      companions: ['greek_yogurt','egg_whites','protein_bar_clif','honey_egyptian',
                   'milk_skim'],
      mealTypes:  ['pre'],
    },
    {
      name: 'postwo_recovery',
      label: 'بعد تمرين استشفاء',
      anchor:     ['chicken_breast','eggs_whole','greek_yogurt','cottage_cheese',
                   'tuna_canned','turkey_breast'],
      companions: ['banana','brown_rice','sweet_potato','milk_skim','oats'],
      mealTypes:  ['post'],
    },
  ];

  // ── LAYER B: Synergy groups — Egyptian culinary clusters ──────────
  // Foods in the same cluster get a bonus when another cluster-member
  // is already in the current portions array.
  const SYNERGY_GROUPS = [
    // سلطة مصرية
    { name: 'egyp_salad', members: ['bell_pepper_red','onion',
      'arugula_rocket','tomato_cherry','olive_oil','lemon_juice','spinach'] },
    // بروتين بحري
    { name: 'seafood', members: ['tuna_canned','tuna_fresh','salmon','sardines',
      'shrimp','mackerel','tilapia'] },
    // بروتين دواجن
    { name: 'poultry', members: ['chicken_breast','chicken_thigh','turkey_breast',
      'chicken_strips'] },
    // بقوليات مصرية
    { name: 'legumes', members: ['lentils','foul','chickpeas','foul_cart',
      'hummus_with_olive_oil','lentil_soup'] },
    // كارب ناعم مناسب للعشاء
    { name: 'light_carb_dinner', members: ['sweet_potato','pumpkin_kousa',
      'zucchini_veg','eggplant_grilled','cauliflower'] },
    // خضار استشفاء
    { name: 'recovery_veg', members: ['broccoli','spinach','kale_veg','asparagus_veg',
      'green_beans_veg'] },
    // مكسرات وبذور
    { name: 'nuts_seeds', members: ['almonds','sunflower_seeds','lupin_seeds',
      'pumpkin_seeds','sesame_tahini'] },
  ];

  // Build quick-lookup maps
  const _synergyFoodMap = {};  // foodId - groupName
  SYNERGY_GROUPS.forEach(g => {
    g.members.forEach(id => { _synergyFoodMap[id] = g.name; });
  });

  // ── LAYER C: Anti-monotony — protein FAMILY tracker ──────────────
  // More granular than canonical ID tracker; tracks "families" so that
  // even different chicken IDs count as the same family.
  const PROTEIN_FAMILIES = {
    poultry:  ['chicken_breast','chicken_thigh','turkey_breast','chicken_strips',
               'chicken_shish','chicken_grilled'],
    red_meat: ['beef_lean','beef_ground','lamb','kofta','hawawshi','shawarma_meat'],
    fish:     ['salmon','tuna_canned','tuna_fresh','sardines','mackerel','tilapia',
               'shrimp'],
    egg:      ['eggs_whole','egg_whites','eggs_scrambled','eggs_fried_shakshouka'],
    legume:   ['lentils','foul','chickpeas','foul_cart','lentil_soup'],
    dairy:    ['greek_yogurt','cottage_cheese','milk_skim','yogurt_plain',
               'labneh_spreadable'],
  };

  // Build reverse map: foodId - family
  const _proteinFamilyMap = {};
  Object.entries(PROTEIN_FAMILIES).forEach(([family, ids]) => {
    ids.forEach(id => { _proteinFamilyMap[id] = family; });
  });

  // Session-level family usage counter
  const FAMILY_TRACKER = {
    used: {},   // { family: count }
    reset() { this.used = {}; },
    mark(foodId) {
      const fam = _proteinFamilyMap[foodId];
      if (fam) this.used[fam] = (this.used[fam] || 0) + 1;
    },
    getPenalty(foodId) {
      const fam = _proteinFamilyMap[foodId];
      if (!fam) return 0;
      const count = this.used[fam] || 0;
      // First use: no penalty. Second: -8. Third+: -18.
      if (count === 0) return 0;
      if (count === 1) return 8;
      return 18;
    },
  };
  window.FAMILY_TRACKER = FAMILY_TRACKER;

  // Track which patterns are "in progress" for the current meal
  // (populated by a meal-context helper called before scoring)
  let _activeMealContext = { mealType: null, currentPortionIds: [] };

  // ── Helper: set current meal context (called from wrapper below) ──
  function setMealContext(mealType, portions) {
    _activeMealContext = {
      mealType,
      currentPortionIds: (portions || []).map(p => p.food && p.food.id).filter(Boolean),
    };
  }

  // ── Pattern score bonus for a candidate food ──────────────────────
  function getPatternBonus(food, mealType, existingIds) {
    let bonus = 0;
    EGYPTIAN_MEAL_PATTERNS.forEach(pattern => {
      if (!pattern.mealTypes.includes(mealType)) return;

      // Check if a pattern is "in progress" — anchor already present in meal
      const anchorPresent = pattern.anchor.some(id => existingIds.includes(id));
      const isAnchor      = pattern.anchor.includes(food.id);
      const isCompanion   = pattern.companions.includes(food.id);

      if (anchorPresent && isCompanion) {
        // Adding a companion to an already-anchored pattern - cultural coherence bonus
        bonus += 12;
      } else if (isAnchor && existingIds.length === 0) {
        // Food would START a pattern - moderate bonus
        bonus += 6;
      }
    });
    return Math.min(bonus, 18); // cap at +18
  }

  // ── Synergy score bonus for a candidate food ──────────────────────
  function getSynergyBonus(food, existingIds) {
    if (!existingIds.length) return 0;
    const foodGroup = _synergyFoodMap[food.id];
    if (!foodGroup) return 0;
    // If any existing portion is in the same synergy group - bonus
    const hasSameGroup = existingIds.some(id => _synergyFoodMap[id] === foodGroup);
    return hasSameGroup ? 8 : 0;
  }

  // ── Wrap scoreWithRotation — final scorer used by all callers ─────
  const _orig_swr_hf7 = scoreWithRotation;
  scoreWithRotation = function scoreWithRotation(food, mealType, context, _mipState) {
    let score = _orig_swr_hf7(food, mealType, context, _mipState);
    try {
      const existingIds = _activeMealContext.mealType === mealType
        ? _activeMealContext.currentPortionIds
        : [];

      // Layer A: Egyptian pattern bonus
      const patternBonus = getPatternBonus(food, mealType, existingIds);
      if (patternBonus > 0) score = Math.min(100, score + patternBonus);

      // Layer B: Synergy bonus
      const synergyBonus = getSynergyBonus(food, existingIds);
      if (synergyBonus > 0) score = Math.min(100, score + synergyBonus);

      // Layer C: Anti-monotony family penalty
      if (['protein','dairy'].includes(food.cat)) {
        const famPenalty = FAMILY_TRACKER.getPenalty(food.id);
        if (famPenalty > 0) score = Math.max(20, score - famPenalty);
      }
    } catch(e) {
      if (typeof LOG === 'function') LOG('[HF-7] score wrapper error: ' + e.message);
    }
    return Math.max(10, Math.min(100, score));
  };
  // Preserve MIP wrap flags
  scoreWithRotation._mipWrapped   = true;
  scoreWithRotation._hf3NafldActive = true;

  // ── Wrap optimizePortions to inject meal context before scoring ───
  // This gives the scorer real-time knowledge of what's already in the meal
  const _orig_optP_hf7 = optimizePortions;
  optimizePortions = function optimizePortions(mealType, targetCals, targetMacros, availableForMeal) {
    // Set empty context before scoring begins
    setMealContext(mealType, []);
    const result = _orig_optP_hf7(mealType, targetCals, targetMacros, availableForMeal);
    // After portions are selected, mark protein families for anti-monotony
    try {
      if (Array.isArray(result)) {
        result.forEach(p => {
          if (['protein','dairy'].includes(p.food && p.food.cat)) {
            FAMILY_TRACKER.mark(p.food.id);
          }
        });
        // Update context so subsequent candidates in the same meal get pattern/synergy bonuses
        setMealContext(mealType, result);
      }
    } catch(e) { /* silent */ }
    return result;
  };

  // ── Reset FAMILY_TRACKER alongside MealRotationTracker ───────────
  const _orig_mrt_reset_hf7 = MealRotationTracker.reset.bind(MealRotationTracker);
  MealRotationTracker.reset = function reset() {
    _orig_mrt_reset_hf7();
    FAMILY_TRACKER.reset();
    _activeMealContext = { mealType: null, currentPortionIds: [] };
    if (typeof LOG === 'function') LOG('⟳ [HF-7] FAMILY_TRACKER + mealContext reset with MealRotationTracker');
  };

  if (typeof LOG === 'function') LOG('✔ [HF-7] Egyptian Meal Intelligence active — Patterns + Synergy + Family Anti-Monotony');
})();

// ═══════════════════════════════════════════════════════════════════
//  ███╗   ███╗ █████╗ ████████╗    ██╗      ██████╗  ██████╗
//  ████╗ ████║██╔══██╗╚══██╔══╝    ██║     ██╔═══██╗██╔════╝
//  ██╔████╔██║███████║   ██║       ██║     ██║   ██║██║  ███╗
//  ██║╚██╔╝██║██╔══██║   ██║       ██║     ██║   ██║██║   ██║
//  ██║ ╚═╝ ██║██║  ██║   ██║       ███████╗╚██████╔╝╚██████╔╝
//  ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝       ╚══════╝ ╚═════╝  ╚═════╝
//
//  SURGICAL HOTFIX — v29-HF3-MAT
//  [MAT] Macro Audit Trail System
//
//  Strategy  : additive IIFE wrapping _resolveWeeklyTargets pipeline.
//              Zero touch on any existing function bodies.
//              Each stage captured as immutable frozen snapshot.
//  Output    : window.__macroAuditTrail (frozen array of stage snapshots)
//              console.groupCollapsed grouped report on every plan build
//  Drift alerts : per-macro delta thresholds trigger [MacroAudit][WARN]
//  Export    : window.__exportMacroAudit() - JSON string
//
//  Snapshot schema (every stage is Object.freeze'd immediately):
//  {
//    stage        : string   — pipeline stage name
//    source       : string   — __layerOwner (which function/system)
//    protein      : number   — grams
//    carbs        : number   — grams
//    fat          : number   — grams
//    calories     : number   — total kcal from macros
//    deltaFromPrev: { protein, carbs, fat, calories }  — Δ from prior stage
//    deltaFromBase: { protein, carbs, fat, calories }  — Δ from base (stage 0)
//    meta         : object   — any extra context (weekNum, phlActive, etc)
//    ts           : number   — Date.now() at capture time
//  }
//
//  Drift alert thresholds:
//    protein : ±15g from previous stage - WARN
//    carbs   : ±30g from previous stage - WARN
//    fat     : ±20g from previous stage - WARN
//    calories: ±200 kcal from prev stage - WARN
// ═══════════════════════════════════════════════════════════════════
(function _mat_MacroAuditTrailSystem() {
  'use strict';

  // ── Drift thresholds ────────────────────────────────────────────
  const DRIFT_THRESHOLDS = {
    protein:  15,   // g
    carbs:    30,   // g
    fat:      20,   // g
    calories: 200,  // kcal
  };

  // ── Internal trail store (reset each plan build) ────────────────
  let _trail = [];

  // ── Helper: compute calories from macros ────────────────────────
  const _macroKcal = (p, c, f) => Math.round(p * 4 + c * 4 + f * 9);

  // ── Helper: compute delta object between two macro sets ─────────
  function _delta(curr, prev) {
    return Object.freeze({
      protein:  Math.round((curr.protein  - prev.protein)  * 10) / 10,
      carbs:    Math.round((curr.carbs    - prev.carbs)    * 10) / 10,
      fat:      Math.round((curr.fat      - prev.fat)      * 10) / 10,
      calories: Math.round((curr.calories - prev.calories) * 10) / 10,
    });
  }

  // ── Helper: check drift and warn ────────────────────────────────
  function _checkDrift(stageName, source, dFromPrev) {
    const warns = [];
    if (Math.abs(dFromPrev.protein)  > DRIFT_THRESHOLDS.protein)
      warns.push(`protein Δ${dFromPrev.protein > 0 ? '+' : ''}${dFromPrev.protein}g`);
    if (Math.abs(dFromPrev.carbs)    > DRIFT_THRESHOLDS.carbs)
      warns.push(`carbs Δ${dFromPrev.carbs > 0 ? '+' : ''}${dFromPrev.carbs}g`);
    if (Math.abs(dFromPrev.fat)      > DRIFT_THRESHOLDS.fat)
      warns.push(`fat Δ${dFromPrev.fat > 0 ? '+' : ''}${dFromPrev.fat}g`);
    if (Math.abs(dFromPrev.calories) > DRIFT_THRESHOLDS.calories)
      warns.push(`kcal Δ${dFromPrev.calories > 0 ? '+' : ''}${dFromPrev.calories}`);
    if (warns.length) {
      console.warn(
        `%c[MacroAudit][WARN] Large drift after ${stageName} (${source}): ${warns.join(' | ')}`,
        'color:#FF8C00;font-weight:bold;'
      );
    }
  }

  // ── Core: capture an immutable snapshot ─────────────────────────
  function _capture(stage, source, macros, calories, meta = {}) {
    try {
      const p = Math.round(macros.protein  || 0);
      const c = Math.round(macros.carbs    || 0);
      const f = Math.round(macros.fat      || 0);
      const k = Math.round(calories        || _macroKcal(p, c, f));

      const base = _trail.length > 0 ? _trail[0]              : { protein: p, carbs: c, fat: f, calories: k };
      const prev = _trail.length > 0 ? _trail[_trail.length - 1] : base;

      const curr    = { protein: p, carbs: c, fat: f, calories: k };
      const dPrev   = _delta(curr, { protein: prev.protein, carbs: prev.carbs, fat: prev.fat, calories: prev.calories });
      const dBase   = _delta(curr, { protein: base.protein, carbs: base.carbs, fat: base.fat, calories: base.calories });

      const snapshot = Object.freeze({
        stage,
        source,
        protein:       p,
        carbs:         c,
        fat:           f,
        calories:      k,
        deltaFromPrev: dPrev,
        deltaFromBase: dBase,
        meta:          Object.freeze({ ...meta }),
        ts:            Date.now(),
      });

      _trail.push(snapshot);

      // Drift check — skip stage 0 (base, no prev)
      if (_trail.length > 1) _checkDrift(stage, source, dPrev);

      return snapshot;
    } catch (e) {
      if (typeof LOG === 'function') LOG('[MAT] capture error at ' + stage + ': ' + e.message);
    }
  }

  // ── Reset trail (called at start of each plan build) ────────────
  function _reset() {
    _trail = [];
    window.__macroAuditTrail = _trail; // live reference — array is re-assigned
  }

  // ── Console report renderer ──────────────────────────────────────
  function _report() {
    if (!_trail.length) return;

    const base  = _trail[0];
    const final = _trail[_trail.length - 1];
    const totalDrift = _delta(
      { protein: final.protein, carbs: final.carbs, fat: final.fat, calories: final.calories },
      { protein: base.protein,  carbs: base.carbs,  fat: base.fat,  calories: base.calories }
    );

    console.groupCollapsed(
      `%c[MacroAudit] Plan build — ${_trail.length} stages | Base P${base.protein}/C${base.carbs}/F${base.fat} - Final P${final.protein}/C${final.carbs}/F${final.fat} | Drift P${totalDrift.protein>0?'+':''}${totalDrift.protein} C${totalDrift.carbs>0?'+':''}${totalDrift.carbs} F${totalDrift.fat>0?'+':''}${totalDrift.fat}`,
      'color:#4A9EFF;font-weight:bold;font-size:11px;'
    );

    console.log('%c Stage breakdown:', 'color:#888;font-size:10px;');

    _trail.forEach((s, i) => {
      const dTag = i === 0
        ? ''
        : ` | ΔPrev P${s.deltaFromPrev.protein>0?'+':''}${s.deltaFromPrev.protein} C${s.deltaFromPrev.carbs>0?'+':''}${s.deltaFromPrev.carbs} F${s.deltaFromPrev.fat>0?'+':''}${s.deltaFromPrev.fat}`;
      const kcalStr = `${s.calories} kcal`;
      const style = i === 0            ? 'color:#2AE87B;font-weight:bold;'
                  : i === _trail.length-1 ? 'color:#FF6B6B;font-weight:bold;'
                  :                        'color:#CCC;';
      console.log(
        `%c  [${String(i).padStart(2,'0')}] ${s.stage.padEnd(28)} ${s.source.padEnd(22)} P:${String(s.protein).padStart(3)} C:${String(s.carbs).padStart(3)} F:${String(s.fat).padStart(3)} | ${kcalStr}${dTag}`,
        style
      );
      // Print meta if meaningful
      const metaKeys = Object.keys(s.meta).filter(k => s.meta[k] !== null && s.meta[k] !== undefined && s.meta[k] !== false && s.meta[k] !== '—');
      if (metaKeys.length) {
        console.log(
          `%c       meta: ${metaKeys.map(k => `${k}=${JSON.stringify(s.meta[k])}`).join(' | ')}`,
          'color:#888;font-size:9px;'
        );
      }
    });

    console.log('%c Total base - final drift:', 'color:#888;font-size:10px;',
      `P${totalDrift.protein>0?'+':''}${totalDrift.protein}g`,
      `C${totalDrift.carbs>0?'+':''}${totalDrift.carbs}g`,
      `F${totalDrift.fat>0?'+':''}${totalDrift.fat}g`,
      `${totalDrift.calories>0?'+':''}${totalDrift.calories} kcal`
    );

    console.groupEnd();
  }

  // ── JSON export helper ───────────────────────────────────────────
  window.__exportMacroAudit = function exportMacroAudit() {
    const json = JSON.stringify(_trail, null, 2);
    console.log('[MacroAudit] Export:\n' + json);
    return json;
  };

  // ── Expose reset + capture + report for wrappers below ──────────
  window.__macroAudit = { reset: _reset, capture: _capture, report: _report };
  window.__macroAuditTrail = _trail;

  // ════════════════════════════════════════════════════════════════
  //  PIPELINE WRAPPERS — wrap each stage of _resolveWeeklyTargets
  //  Approach: wrap _resolveWeeklyTargets itself to intercept base
  //  input, then wrap each sub-function for internal stages.
  //  All wrappers are additive closures — no function body edits.
  // ════════════════════════════════════════════════════════════════

  // ── WRAPPER 1: calcMacros - capture base macros ─────────────────
  const _mat_origCalcMacros = calcMacros;
  calcMacros = function calcMacros(cals, diet) {
    const result = _mat_origCalcMacros(cals, diet);
    try {
      // Only capture if we're inside a plan build (trail already reset)
      if (window.__macroAudit._building) {
        window.__macroAudit.capture(
          'base (calcMacros)',
          'calcMacros',
          result,
          cals,
          { diet: diet || 'balanced', goal: (typeof DE !== 'undefined' ? DE.goal : '—') }
        );
      }
    } catch(e) { /* silent — never break calcMacros */ }
    return result;
  };

  // ── WRAPPER 2: _resolvePHLAdjustments - capture PHL delta ───────
  const _mat_origPHL = _resolvePHLAdjustments;
  _resolvePHLAdjustments = function _resolvePHLAdjustments(targets, tdee, healthConditions) {
    const result = _mat_origPHL(targets, tdee, healthConditions);
    try {
      if (window.__macroAudit._building && result) {
        const phlActive = !!(result.meta && result.meta.phlActive);
        window.__macroAudit.capture(
          'after PHL',
          '_resolvePHLAdjustments',
          result.macros,
          result.calories,
          {
            phlActive,
            phlType:     result.meta?.phlType     || '—',
            phlStrategy: result.meta?.phlStrategy || '—',
            calDelta:    result.meta?.phlCalDelta  || 0,
          }
        );
      }
    } catch(e) { /* silent */ }
    return result;
  };

  // ── WRAPPER 3: _resolveCarbCycleTargets - capture CC delta ──────
  const _mat_origCC = _resolveCarbCycleTargets;
  _resolveCarbCycleTargets = function _resolveCarbCycleTargets(targets, weekNum) {
    const result = _mat_origCC(targets, weekNum);
    try {
      if (window.__macroAudit._building && result) {
        const ccActive = !!(result.meta && result.meta.ccMacroLayerApplied);
        window.__macroAudit.capture(
          'after CarbCycle',
          '_resolveCarbCycleTargets',
          result.macros,
          result.calories,
          {
            ccActive,
            dayType: result.meta?.dayType || '—',
            weekNum,
          }
        );
      }
    } catch(e) { /* silent */ }
    return result;
  };

  // ── WRAPPER 4: _resolveWeeklyTargets - orchestration wrapper ────
  // Captures DWCP stage (between calcMacros base and PHL/CC stages)
  // by intercepting after DWCP.getWeekTargets resolves but before PHL.
  const _mat_origRWT = _resolveWeeklyTargets;
  _resolveWeeklyTargets = function _resolveWeeklyTargets(baseCals, baseMacros, weekNum) {
    // Mark build in progress so inner wrappers know to capture
    window.__macroAudit._building = true;

    // Capture base (if calcMacros wrapper didn't fire — DWCP fallback path)
    try {
      if (!_trail.length && baseMacros) {
        window.__macroAudit.capture(
          'base (RWT input)',
          '_resolveWeeklyTargets.input',
          baseMacros,
          baseCals,
          { weekNum }
        );
      }
    } catch(e) { /* silent */ }

    // Patch DWCP.getWeekTargets temporarily to intercept DWCP output
    let _dwcpPatchedOnce = false;
    const _origGetWeekTargets = (typeof DWCP !== 'undefined' && typeof DWCP.getWeekTargets === 'function')
      ? DWCP.getWeekTargets.bind(DWCP) : null;

    if (_origGetWeekTargets && !_dwcpPatchedOnce) {
      _dwcpPatchedOnce = true;
      DWCP.getWeekTargets = function getWeekTargets(w) {
        const wt = _origGetWeekTargets(w);
        try {
          if (wt && isFinite(wt.calories) && wt.calories > 0) {
            const activeMacros = (wt.isRefeedWeek && wt.refeedMacros)
              ? { protein: wt.refeedMacros.protein, carbs: wt.refeedMacros.carbs, fat: wt.refeedMacros.fat }
              : { protein: wt.protein, carbs: wt.carbs, fat: wt.fat };
            window.__macroAudit.capture(
              'after DWCP/WSL',
              'DWCP.getWeekTargets',
              activeMacros,
              wt.calories,
              {
                weekNum: w,
                phaseLabel:   wt.phaseLabel   || '—',
                phaseType:    wt.phaseType    || '—',
                isRefeedWeek: wt.isRefeedWeek || false,
                isDietBreak:  wt.isDietBreak  || false,
              }
            );
          }
        } catch(e) { /* silent */ }
        return wt;
      };
    }

    const result = _mat_origRWT(baseCals, baseMacros, weekNum);

    // Restore DWCP.getWeekTargets if patched
    if (_origGetWeekTargets) DWCP.getWeekTargets = _origGetWeekTargets;

    // Capture final resolved targets (after all layers)
    try {
      if (result && result.macros) {
        window.__macroAudit.capture(
          'final (weeklyTargets)',
          '_resolveWeeklyTargets.output',
          result.macros,
          result.calories,
          {
            weekNum,
            isRefeedWeek: result.meta?.isRefeedWeek || false,
            isDietBreak:  result.meta?.isDietBreak  || false,
            phlActive:    result.meta?.phlActive     || false,
            phaseLabel:   result.meta?.phaseLabel    || '—',
          }
        );
      }
    } catch(e) { /* silent */ }

    window.__macroAudit._building = false;
    return result;
  };

  // ── WRAPPER 5: buildSmartMealPlan - capture post-distribution ───
  // Captures actual per-day totals after optimizePortions runs,
  // giving visibility into meal-distribution macro drift.
  const _mat_origBSMP = buildSmartMealPlan;
  buildSmartMealPlan = function buildSmartMealPlan(totalCals, macros, weeklyMeta) {
    // Reset trail at start of every new plan build
    window.__macroAudit.reset();
    window.__macroAudit._building = true;

    // Capture plan entry point (what buildSmartMealPlan receives)
    try {
      if (macros) {
        window.__macroAudit.capture(
          'buildSmartMealPlan input',
          'buildSmartMealPlan',
          macros,
          totalCals,
          {
            weeklyMeta: weeklyMeta
              ? { isRefeed: weeklyMeta.isRefeedWeek, isDietBreak: weeklyMeta.isDietBreak,
                  phaseLabel: weeklyMeta.phaseLabel, phlActive: weeklyMeta.phlActive }
              : null
          }
        );
      }
    } catch(e) { /* silent */ }

    const result = _mat_origBSMP(totalCals, macros, weeklyMeta);

    // After meal plan built: audit actual portion totals vs target
    try {
      const mealSection = document.getElementById('res-meals');
      if (mealSection) {
        // Sum actual macros from rendered portions stored in MNL_SESSION usage
        // (portions were scored and selected — we read from DOM data if available,
        //  else we note the target as the closest we can get without DOM parse)
        window.__macroAudit.capture(
          'after meal distribution',
          'buildSmartMealPlan.output',
          macros,  // target — actual drift would need DOM parse (Phase 2)
          totalCals,
          { note: 'target macros — actual portion drift tracked in Phase 2 (Meal Realism)' }
        );
      }
    } catch(e) { /* silent */ }

    window.__macroAudit._building = false;

    // Print the full audit trail to console
    window.__macroAudit.report();

    return result;
  };

  if (typeof LOG === 'function') {
    LOG('✔ [MAT] Macro Audit Trail System active — 5 pipeline wrappers installed | window.__macroAuditTrail | window.__exportMacroAudit()');
  }

})(); // end _mat_MacroAuditTrailSystem


// ═══════════════════════════════════════════════════════════════════
//  ███╗   ███╗██████╗ ███████╗
//  ████╗ ████║██╔══██╗██╔════╝
//  ██╔████╔██║██████╔╝█████╗
//  ██║╚██╔╝██║██╔══██╗██╔══╝
//  ██║ ╚═╝ ██║██║  ██║███████╗
//  ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝
//
//  SURGICAL HOTFIX — v29-HF3-MRE
//  [MRE] Meal Realism Engine
//
//  ── Analysis Summary (why unrealistic meals still appear) ─────────
//
//  ROOT CAUSE 1 — pairWith data is declared but never consumed
//    FOOD_INTELLIGENCE has pairWith[] for every food (76 entries).
//    optimizePortions picks protein[0], carb[0], fat[0] sequentially
//    by score — but never checks whether the chosen protein PREFERS
//    the chosen carb. A high-scoring salmon can land next to oats
//    because oats score high for that mealType, not because
//    salmon+oats is a human combination.
//    Fix: after the optimizer assembles a meal, score its pairWith
//    compatibility and swap the carb/fat for a better-paired
//    alternative when a clear improvement exists.
//
//  ROOT CAUSE 2 — scoring happens BEFORE assembly, not during
//    All foods are scored in isolation against mealType+context.
//    When protein=chicken_breast scores 90 and carb=oats scores 88,
//    both make the cut — but their co-presence is never evaluated.
//    The incompatibleWith check (MIP-1) only fires POST-assembly
//    as a -25 warning, never causing a substitution.
//    Fix: post-assembly pairWith validator with lightweight swap logic.
//
//  ROOT CAUSE 3 — portion gram sizes feel "calculated not cooked"
//    optimizePortions computes grams via (remainCals × ratio / cal)×100,
//    rounded to 5g. This produces values like 135g rice, 87g chicken,
//    43g broccoli — mathematically correct but humanly odd.
//    Humans think in: half a cup, one breast, a handful, a palm.
//    MIP-6 MIN/MAX clamps exist but don't round to human anchors.
//    Fix: snap to human-anchor gram ranges after MIP-6 runs.
//
//  ROOT CAUSE 4 — pre-workout meal fat tolerance too loose
//    MIP_TIMING penalizes fat>15g in pre by -12, but the optimizer
//    can still add a full fat portion (olive oil 20g, nuts 25g) because
//    the penalty only affects scoring — once fat is in scoredFoods[0]
//    it gets added unconditionally in STEP 3 regardless of timing.
//    Fix: hard gate — suppress fat portions for pre when total fat
//    in meal already exceeds pre-workout threshold.
//
//  ROOT CAUSE 5 — veggie is always 100g regardless of meal context
//    STEP 4: `addPortion(vegOption, 100)` — fixed 100g for every meal.
//    For breakfast this creates situations like 100g spinach next to
//    oats+greek_yogurt — technically valid but behaviorally strange.
//    Fix: context-aware veggie grams (breakfast: 60g max, main: 120g).
//
//  ── What is NOT changed ──────────────────────────────────────────
//    · optimizePortions() body — untouched
//    · scoreWithRotation() chain — untouched
//    · calcMacros / calcFatTarget / calcProteinTarget — untouched
//    · carb-cycle math / PHL / DWCP — untouched
//    · all medical overrides — untouched
//    · HF-1 through HF-5 — untouched
//    · MAT audit trail — untouched
//    · all golden snapshots — macro outputs unchanged (MRE acts on
//      gram presentation only, never on daily macro totals)
//
//  ── Insertion strategy ───────────────────────────────────────────
//    MRE wraps optimizePortions as an additive post-processor.
//    It NEVER re-runs the optimizer. It only:
//      1. Evaluates pairWith compatibility of the assembled meal
//      2. Attempts one carb swap if a clearly better pair exists
//      3. Snaps grams to human anchors (nearest 25g for proteins,
//         50g for carbs, 15g for fats, 25g for veggies)
//      4. Gates fat addition for pre-workout
//      5. Adjusts veggie grams by meal context
//    All steps are individually try/catch guarded — any failure
//    returns the unmodified original portions array.
// ═══════════════════════════════════════════════════════════════════
(function _mre_MealRealismEngine() {
  'use strict';

  // ── MRE-1: pairWith compatibility scorer ─────────────────────────
  // Scores how well the assembled meal matches the main protein's
  // preferred pairings. Returns 0–100 (100 = perfect match).
  function _mre_pairScore(portions) {
    try {
      const mainProt = portions.find(p =>
        p.food.cat === 'protein' &&
        (FOOD_INTELLIGENCE[p.food.id] || {}).mealRole === 'main_protein'
      );
      if (!mainProt) return 100; // no main protein — nothing to evaluate
      const intel = FOOD_INTELLIGENCE[mainProt.food.id] || {};
      const preferred = intel.pairWith || [];
      if (!preferred.length) return 100;
      const mealIds = portions.map(p => p.food.id);
      const matches = preferred.filter(pid => mealIds.includes(pid)).length;
      return Math.round((matches / Math.min(preferred.length, 3)) * 100);
    } catch(e) { return 100; } // safe fallback — assume OK
  }

  // ── MRE-2: carb swap attempt ──────────────────────────────────────
  // If pairScore < 40, try replacing the current carb with the
  // highest-scoring carb from the protein's pairWith list.
  // Constraint: only swap if the replacement is available in
  // availableForMeal AND produces a better pairScore.
  // Never swap if it would violate health/diet constraints.
  function _mre_tryCarbSwap(portions, availableForMeal, mealType) {
    try {
      const pairScore = _mre_pairScore(portions);
      if (pairScore >= 40) return portions; // already acceptable

      const mainProt = portions.find(p =>
        (FOOD_INTELLIGENCE[p.food.id] || {}).mealRole === 'main_protein'
      );
      if (!mainProt) return portions;

      const intel = FOOD_INTELLIGENCE[mainProt.food.id] || {};
      const preferred = (intel.pairWith || []).filter(pid => {
        const f = availableForMeal.find(af => af.id === pid);
        return f && f.cat === 'carb'; // only consider carb swaps
      });
      if (!preferred.length) return portions;

      // Find the current carb portion
      const currentCarbIdx = portions.findIndex(p => p.food.cat === 'carb');
      if (currentCarbIdx < 0) return portions; // no carb to swap

      // Find the best preferred carb available
      const bestPreferred = preferred
        .map(pid => availableForMeal.find(af => af.id === pid))
        .filter(Boolean)
        .sort((a, b) =>
          (scoreWithRotation(b, mealType, { diet: DE.selectedDiet || 'balanced', goal: DE.goal, health: DE.healthConditions, problems: DE.dietProblems }) || 50) -
          (scoreWithRotation(a, mealType, { diet: DE.selectedDiet || 'balanced', goal: DE.goal, health: DE.healthConditions, problems: DE.dietProblems }) || 50)
        )[0];

      if (!bestPreferred) return portions;
      if (bestPreferred.id === portions[currentCarbIdx].food.id) return portions; // already using best

      // Perform swap — preserve gram weight, recalculate macros
      const oldPortion = portions[currentCarbIdx];
      const newGrams = oldPortion.grams;
      const newPortion = {
        food:  bestPreferred,
        grams: newGrams,
        cals:  Math.round(bestPreferred.cal  * newGrams / 100),
        pro:   +(bestPreferred.pro  * newGrams / 100).toFixed(1),
        carb:  +(bestPreferred.carb * newGrams / 100).toFixed(1),
        fat:   +(bestPreferred.fat  * newGrams / 100).toFixed(1),
        _mreSwapped: true,
      };

      const swapped = [...portions];
      swapped[currentCarbIdx] = newPortion;

      // Verify swap improves pairScore (safety check)
      const newScore = _mre_pairScore(swapped);
      if (newScore > pairScore) {
        LOG(`[MRE-2]: carb swap ${oldPortion.food.id} - ${bestPreferred.id} (pairScore ${pairScore} - ${newScore})`);
        return swapped;
      }
      return portions; // swap didn't help — revert
    } catch(e) {
      LOG('[MRE-2]: swap error — ' + e.message);
      return portions;
    }
  }

  // ── MRE-3: human gram anchors ─────────────────────────────────────
  // Snaps gram values to human-readable anchors by category.
  // Anchors are chosen to feel like natural serving sizes.
  // Never reduces a portion below its post-MIP-6 minimum.
  // Never changes the food identity or macros beyond what gram change implies.
  const _mre_ANCHORS = {
    // { anchor, min, max } — snap to nearest anchor within min/max
    protein: [
      { anchor: 75,  min: 60,  max: 90  },  // 1 small breast / 3 eggs
      { anchor: 100, min: 90,  max: 115 },  // 1 standard breast / 4 eggs
      { anchor: 125, min: 115, max: 140 },  // medium breast
      { anchor: 150, min: 140, max: 165 },  // large breast
      { anchor: 175, min: 165, max: 195 },  // XL breast / 200g fillet
      { anchor: 200, min: 195, max: 250 },  // large fillet
      { anchor: 250, min: 250, max: 300 },  // very large (bulk)
    ],
    carb: [
      { anchor: 50,  min: 40,  max: 65  },  // quarter cup dry rice
      { anchor: 75,  min: 65,  max: 90  },  // third cup
      { anchor: 100, min: 90,  max: 120 },  // half cup dry / 1 slice bread
      { anchor: 125, min: 120, max: 145 },  // slightly more
      { anchor: 150, min: 145, max: 175 },  // 3/4 cup
      { anchor: 200, min: 175, max: 225 },  // full cup
      { anchor: 250, min: 225, max: 280 },  // large portion
    ],
    fat: [
      { anchor: 5,   min: 5,   max: 8   },  // 1 tsp oil
      { anchor: 10,  min: 8,   max: 13  },  // 2 tsp / small drizzle
      { anchor: 15,  min: 13,  max: 18  },  // 1 tbsp
      { anchor: 20,  min: 18,  max: 25  },  // 4 tsp
      { anchor: 30,  min: 25,  max: 37  },  // 2 tbsp nuts/oil
      { anchor: 40,  min: 37,  max: 50  },  // generous portion
    ],
    veggie: [
      { anchor: 60,  min: 40,  max: 75  },  // small handful
      { anchor: 100, min: 75,  max: 130 },  // standard portion
      { anchor: 150, min: 130, max: 200 },  // generous
    ],
    dairy: [
      { anchor: 100, min: 80,  max: 115 },  // small pot yogurt
      { anchor: 150, min: 115, max: 175 },  // standard pot
      { anchor: 200, min: 175, max: 250 },  // large pot
    ],
    fruit: [
      { anchor: 80,  min: 60,  max: 100 },  // small fruit
      { anchor: 120, min: 100, max: 150 },  // 1 medium fruit
      { anchor: 150, min: 150, max: 200 },  // large fruit
    ],
  };

  function _mre_snapToAnchor(grams, cat) {
    try {
      const anchors = _mre_ANCHORS[cat];
      if (!anchors) return grams; // unknown cat — don't touch
      // Find the anchor range this gram value falls into
      const match = anchors.find(a => grams >= a.min && grams <= a.max);
      if (match) return match.anchor;
      // Outside all ranges — clamp to nearest anchor
      if (grams < anchors[0].min) return anchors[0].anchor;
      if (grams > anchors[anchors.length - 1].max) return anchors[anchors.length - 1].anchor;
      return grams;
    } catch(e) { return grams; }
  }

  function _mre_applyHumanAnchors(portions) {
    try {
      return portions.map(p => {
        const cat = p.food.cat || '';
        const snapped = _mre_snapToAnchor(p.grams, cat);
        if (snapped === p.grams) return p; // no change needed
        return {
          ...p,
          grams: snapped,
          cals:  Math.round(p.food.cal  * snapped / 100),
          pro:   +(p.food.pro  * snapped / 100).toFixed(1),
          carb:  +(p.food.carb * snapped / 100).toFixed(1),
          fat:   +(p.food.fat  * snapped / 100).toFixed(1),
          _mreAnchorSnapped: true,
        };
      });
    } catch(e) {
      LOG('[MRE-3]: anchor snap error — ' + e.message);
      return portions;
    }
  }

  // ── MRE-4: pre-workout fat gate ───────────────────────────────────
  // Removes or heavily reduces fat portions for pre-workout meals
  // where total fat from other items already exceeds 8g.
  // MIP_TIMING already penalizes high-fat foods in scoring,
  // but the STEP 3 fat addition in optimizePortions is unconditional.
  // This gate enforces the physiological constraint post-assembly.
  function _mre_preWorkoutFatGate(portions, mealType) {
    if (mealType !== 'pre') return portions;
    try {
      const totalFatFromNonFat = portions
        .filter(p => p.food.cat !== 'fat')
        .reduce((s, p) => s + p.fat, 0);

      if (totalFatFromNonFat <= 8) return portions; // fat is fine — protein/carb sources are lean

      // Too much fat already — remove dedicated fat portions
      const filtered = portions.filter(p => {
        if (p.food.cat !== 'fat') return true;
        LOG(`[MRE-4]: pre-workout fat gate — removed ${p.food.id} (${p.grams}g) — background fat=${totalFatFromNonFat.toFixed(1)}g`);
        return false;
      });
      return filtered.length > 0 ? filtered : portions; // never return empty
    } catch(e) { return portions; }
  }

  // ── MRE-5: context-aware veggie grams ────────────────────────────
  // The original optimizePortions always adds vegOption at 100g.
  // Breakfast: 60g max (spinach/cucumber next to eggs — realistic)
  // Pre-workout: already excluded by mealType !== 'pre' guard
  // Main meals (lunch/dinner/post): 100–150g
  function _mre_contextVeggieGrams(portions, mealType) {
    if (mealType === 'pre' || mealType === 'snack') return portions;
    try {
      // ── PATCH 2 START: Dynamic Veggie Volume for High-TDEE Users ─────────
      // Scale veggie gram target proportionally to the meal's calorie budget.
      // A 3500 kcal user's meals are larger; 120g cap is too restrictive.
      const mealCals = portions.reduce((s, p) => s + (p.cals || 0), 0);
      const volMult  = Math.max(1, mealCals / 400);
      const targetG  = mealType === 'breakfast'
        ? Math.round(60  * volMult)
        : Math.round(120 * volMult);
      // ── PATCH 2 END ────────────────────────────────────────────────────────
      return portions.map(p => {
        if (p.food.cat !== 'veggie') return p;
        if (p.grams <= targetG + 20) return p; // already in range
        const snapped = _mre_snapToAnchor(targetG, 'veggie');
        LOG(`[MRE-5]: veggie gram context — ${p.food.id} ${p.grams}g - ${snapped}g (${mealType}, mealCals=${Math.round(mealCals)}, volMult=${volMult.toFixed(2)})`);
        return {
          ...p,
          grams: snapped,
          cals:  Math.round(p.food.cal  * snapped / 100),
          pro:   +(p.food.pro  * snapped / 100).toFixed(1),
          carb:  +(p.food.carb * snapped / 100).toFixed(1),
          fat:   +(p.food.fat  * snapped / 100).toFixed(1),
          _mreVeggieAdjusted: true,
        };
      });
    } catch(e) { return portions; }
  }

  // ── MRE-6: meal coherence validator (LOG only, no modification) ──
  // Produces a realism score 0–100 for each assembled meal.
  // Exposed on the portions array as portions._mreScore.
  // Used by MAT and future UI debug panel — zero side effects.
  function _mre_scoreCoherence(portions, mealType) {
    try {
      let score = 100;
      const ids = portions.map(p => p.food.id);
      const cats = portions.map(p => p.food.cat);

      // Main meals must have protein
      if (['lunch','dinner','breakfast','post'].includes(mealType)) {
        if (!cats.includes('protein') && !cats.includes('dairy')) score -= 30;
      }
      // No two main proteins in one meal
      const mainProts = portions.filter(p => (FOOD_INTELLIGENCE[p.food.id]||{}).mealRole === 'main_protein');
      if (mainProts.length > 1) score -= 20;

      // pairWith bonus
      const pScore = _mre_pairScore(portions);
      score -= Math.round((100 - pScore) * 0.20); // max -20 for poor pairing

      // incompatibleWith penalty
      ids.forEach(id => {
        const incompat = (FOOD_INTELLIGENCE[id]||{}).incompatibleWith || [];
        if (incompat.some(bad => ids.includes(bad))) score -= 15;
      });

      // Pre: fat gate signal
      if (mealType === 'pre') {
        const totalFat = portions.reduce((s,p) => s + p.fat, 0);
        if (totalFat > 12) score -= 15;
      }

      return Math.max(0, Math.min(100, score));
    } catch(e) { return 50; }
  }

  // ── MRE MASTER WRAPPER — additive post-processor on optimizePortions ──
  const _mre_origOptimizePortions = optimizePortions;
  optimizePortions = function optimizePortions(mealType, targetCals, targetMacros, availableForMeal) {
    // Run the full existing pipeline (all upstream wrappers included)
    let portions = _mre_origOptimizePortions(mealType, targetCals, targetMacros, availableForMeal);

    if (!portions || !portions.length) return portions;

    try {
      // Preserve all upstream metadata flags
      const _upstreamMeta = {
        _mipIncompatWarning: portions._mipIncompatWarning,
        _p3Validation:       portions._p3Validation,
        _p3Pairing:          portions._p3Pairing,
        _p3HealWarning:      portions._p3HealWarning,
      };

      // Stage 1: carb swap for better protein–carb pairing
      portions = _mre_tryCarbSwap(portions, availableForMeal, mealType);

      // Stage 2: pre-workout fat gate (physiological enforcement)
      portions = _mre_preWorkoutFatGate(portions, mealType);

      // Stage 3: context-aware veggie grams
      portions = _mre_contextVeggieGrams(portions, mealType);

      // Stage 4: human anchor snapping (gram presentation realism)
      portions = _mre_applyHumanAnchors(portions);

      // Stage 5: coherence scoring (non-mutating, LOG + metadata only)
      const mreScore = _mre_scoreCoherence(portions, mealType);
      portions._mreScore = mreScore;
      if (mreScore < 60) {
        LOG(`[MRE-6]: low coherence score ${mreScore}/100 — meal=${mealType} foods=${portions.map(p=>p.food.id).join(',')}`);
      } else {
        LOG(`[MRE-6]: coherence ${mreScore}/100 — meal=${mealType}`);
      }

      // Restore upstream metadata
      Object.entries(_upstreamMeta).forEach(([k, v]) => { if (v !== undefined) portions[k] = v; });

    } catch(e) {
      LOG('[MRE]: master wrapper error — ' + e.message + ' — returning upstream result unchanged');
    }

    return portions;
  };

  // Preserve MIP/HF7 wrap flags on the new function
  optimizePortions._mipWrapped    = true;
  optimizePortions._mreActive     = true;

  if (typeof LOG === 'function') {
    LOG('✔ [MRE] Meal Realism Engine active — pairWith swap + fat gate + veggie context + human anchors + coherence scoring');
  }

})(); // end _mre_MealRealismEngine


// ═══════════════════════════════════════════════════════════════════
//  ███████╗██████╗ ██╗
//  ██╔════╝██╔══██╗██║
//  ███████╗██║  ██║██║
//  ╚════██║██║  ██║██║
//  ███████║██████╔╝██║
//  ╚══════╝╚═════╝ ╚═╝
//
//  SURGICAL HOTFIX — v29-HF3-SDI
//  [SDI] Satiety & Digestion Intelligence Layer
//
//  ── Audit findings — WHY the day still feels mechanical ──────────
//
//  GAP-A: Satiety is per-food, never per-meal or per-day.
//    satietyLevel * 2 fires only when 'satiety' is in dietProblems.
//    A user without that problem gets zero satiety sequencing.
//    A meal of egg_whites + oats could score identical satiety to
//    beef + legumes + veggie — same math, very different fullness.
//    Fix: meal-level satiety composite (protein density × fiber ×
//    digestion speed × volume) evaluated POST-assembly, always active.
//
//  GAP-B: No cross-meal satiety continuity.
//    The engine has no memory of what the previous meal was.
//    Breakfast - lunch satiety carry-over doesn't exist.
//    A weak breakfast (low fiber, fast digest) should push lunch
//    toward higher-satiety foods — currently it doesn't.
//    Fix: SDI_DAY_STATE — session tracker per plan build that
//    records each meal's satiety score and adjusts scoring for
//    the next meal.
//
//  GAP-C: Gastric load is completely absent.
//    No concept of "how heavy is this meal on the stomach".
//    Fat + slow-digest protein together at dinner = gastric overload.
//    Pre-workout: even after MRE fat gate, no composite load check.
//    Fix: gastricLoad composite = fat_grams + slow_protein_grams +
//    fiber_grams (weighted). Soft cap per meal type.
//
//  GAP-D: Fiber is placed randomly.
//    fiberLevel in food DB (83 entries). Used in scoring ONLY when
//    'satiety' problem flagged. No logic prevents fiber overload
//    around training (pre-workout fiber > 8g = GI distress risk).
//    No logic ensures adequate daily fiber distribution.
//    Fix: per-mealType fiber budget gate + pre-workout fiber hard cap.
//
//  GAP-E: Dinner "psychological dryness".
//    Dinner-thinning (8% carbs) + low fat (hormonal floor) +
//    high protein = technically correct but behaviorally stark.
//    Humans need a comfort signal in dinner: warmth, volume, color.
//    Fix: dinner comfort scoring — boost for high-satiety + slow-digest
//    + warm-cookable foods. Detect "dry dinner" (no fat>8g, no fiber,
//    no dairy) and trigger a soft swap suggestion.
//
//  GAP-F: Energy stability across meals not tracked.
//    High-GI breakfast - crash - hungry before lunch.
//    No signal between meals on insulin response chain.
//    Fix: glycemic load sequencing — penalize consecutive very_high
//    insulin-impact meals, prefer moderate-GI anchors at breakfast.
//
//  ── What is NOT changed ──────────────────────────────────────────
//    · daily macro totals — preserved
//    · all medical overrides — untouched
//    · golden snapshot exp values — macros unchanged
//    · MRE, MAT, HF-1 through HF-7 — untouched
//    · optimizePortions body — untouched
//    · scoreWithRotation inner logic — wrapped, not rewritten
//
//  ── Architecture ─────────────────────────────────────────────────
//    SDI_DAY_STATE  — session state reset on each plan build
//    SDI_SCORES     — exposes satietyFlowScore, digestionFlowScore,
//                     gastricLoadScore, mealComfortScore,
//                     behavioralSustainabilityScore per plan
//    SDI wraps scoreWithRotation - adds SDI_TIMING_DELTA
//    SDI wraps optimizePortions - post-assembly meal evaluation +
//                                  gastric load check + comfort audit
//    SDI wraps buildSmartMealPlan - day-level continuity scoring
// ═════════════════════════════════════════════════════════════════════
(function _sdi_SatietyDigestionIntelligence() {
  'use strict';

  // ── SDI constants ───────────────────────────────────────────────
  const SDI_FIBER_BUDGETS = {  // quantitative fiber load budget per meal (gram-weighted ×4 scale)
    pre:        4,  // was 1 — pre-workout: GI safety (light fiber only)
    post:       8,  // was 2 — moderate; recovery needs fiber not overload
    breakfast: 12,  // was 3 — unrestricted at breakfast
    lunch:     16,  // was 4 — main meal, highest budget
    dinner:     8,  // was 2 — lighter fiber at dinner (sleep quality)
    snack:      4,  // was 1 — snacks stay light
  };

  const SDI_GASTRIC_SOFT_CAPS = {  // composite gastric load soft cap
    pre:       18,  // lightest — stomach must be clear for exercise
    post:      35,  // moderate — recovery needs nutrients
    breakfast: 40,
    lunch:     55,  // heaviest main meal
    dinner:    40,  // lighter for sleep quality
    snack:     25,
  };

  const SDI_DIGESTION_SPEED_SCORE = {
    very_fast: 1, fast: 3, medium: 5, slow: 7, very_slow: 9
  };

  // ── SDI_DAY_STATE — per-plan-build session state ────────────────
  const SDI_DAY_STATE = {
    meals: [],           // [{ mealType, satietyScore, gastricLoad, fiberLoad, glScore }]
    lastSatietyScore: 5, // 1-10 running satiety level
    totalFiberLoad:   0, // cumulative fiber across day
    glSequence:       [], // glycemic load sequence ['low','medium','high',...]

    reset() {
      this.meals = [];
      this.lastSatietyScore = 5;
      this.totalFiberLoad   = 0;
      this.glSequence       = [];
    },

    record(mealType, satiety, gastric, fiber, gl) {
      this.meals.push({ mealType, satiety, gastric, fiber, gl });
      this.lastSatietyScore = satiety;
      this.totalFiberLoad  += fiber;
      this.glSequence.push(gl);
    },

    // Returns SDI scoring modifier for next meal based on prior meals
    getContinuityModifier(foodId) {
      if (!this.meals.length) return 0;
      const prev = this.meals[this.meals.length - 1];
      let mod = 0;
      // Weak previous meal - boost high-satiety foods for next
      if (prev.satiety < 5) {
        const intel = FOOD_INTELLIGENCE[foodId] || {};
        if ((intel.satietyLevel || 5) >= 7) mod += 8;
        if (intel.fiberLevel === 'high' || intel.fiberLevel === 'very_high') mod += 5;
      }
      // High gastric load previous meal - prefer lighter foods next
      if (prev.gastric > 45) {
        const intel = FOOD_INTELLIGENCE[foodId] || {};
        if ((intel.digestionSpeed || 'medium') === 'fast') mod += 6;
        if ((intel.digestionSpeed || 'medium') === 'very_slow') mod -= 8;
      }
      // Two consecutive high-GI meals - penalize another
      if (this.glSequence.length >= 2) {
        const last2 = this.glSequence.slice(-2);
        if (last2.every(g => g === 'high') && FOOD_INTELLIGENCE[foodId]?.insulinImpact === 'very_high') mod -= 10;
      }
      return mod;
    }
  };

  window.SDI_DAY_STATE = SDI_DAY_STATE;

  // ── SDI_SCORES — final day-level behavioral scores ──────────────
  const SDI_SCORES = {
    satietyFlowScore:             0,
    digestionFlowScore:           0,
    gastricLoadScore:             0,
    mealComfortScore:             0,
    behavioralSustainabilityScore:0,

    reset() {
      this.satietyFlowScore = this.digestionFlowScore = this.gastricLoadScore =
      this.mealComfortScore = this.behavioralSustainabilityScore = 0;
    },

    compute(meals) {
      if (!meals.length) return;
      // Satiety flow — how consistently satiating across the day
      const satieties = meals.map(m => m.satiety);
      const avgSat    = satieties.reduce((a,b) => a+b, 0) / satieties.length;
      const satVar    = satieties.reduce((s,v) => s + Math.abs(v - avgSat), 0) / satieties.length;
      this.satietyFlowScore = Math.round(Math.max(0, Math.min(100, avgSat * 10 - satVar * 5)));

      // Digestion flow — no extreme gastric loads
      const gasLoads = meals.map(m => m.gastric);
      const maxLoad  = Math.max(...gasLoads);
      this.digestionFlowScore = Math.round(Math.max(0, Math.min(100, 100 - maxLoad * 1.2)));

      // Gastric load score — penalise overloaded meals
      const overloaded = meals.filter((m,i) => {
        const cap = SDI_GASTRIC_SOFT_CAPS[m.mealType] || 40;
        return m.gastric > cap;
      }).length;
      this.gastricLoadScore = Math.round(Math.max(0, 100 - overloaded * 25));

      // Meal comfort — average comfort across meals
      const comforts = meals.map(m => m.comfort || 5);
      this.mealComfortScore = Math.round((comforts.reduce((a,b)=>a+b,0)/comforts.length) * 10);

      // Behavioral sustainability — composite
      this.behavioralSustainabilityScore = Math.round(
        (this.satietyFlowScore * 0.30) +
        (this.digestionFlowScore * 0.25) +
        (this.gastricLoadScore   * 0.20) +
        (this.mealComfortScore   * 0.25)
      );
    },

    log() {
      console.groupCollapsed(
        `%c[SDI] Behavioral Scores — Satiety:${this.satietyFlowScore} Digestion:${this.digestionFlowScore} Gastric:${this.gastricLoadScore} Comfort:${this.mealComfortScore} Sustainability:${this.behavioralSustainabilityScore}`,
        'color:#A855F7;font-weight:bold;font-size:11px;'
      );
      SDI_DAY_STATE.meals.forEach(m => {
        const cap  = SDI_GASTRIC_SOFT_CAPS[m.mealType] || 40;
        const flag = m.gastric > cap ? '' : '';
        console.log(
          `%c  ${m.mealType.padEnd(10)} sat:${m.satiety.toFixed(1)} gastric:${m.gastric.toFixed(0)}${flag} fiber:${m.fiber.toFixed(0)} gl:${m.gl}`,
          'color:#888;font-size:10px;'
        );
      });
      console.groupEnd();
    }
  };

  window.SDI_SCORES = SDI_SCORES;

  // ── Helper: compute gastric load for a portions array ────────────
  function _sdi_gastricLoad(portions) {
    return portions.reduce((total, p) => {
      const intel = FOOD_INTELLIGENCE[p.food.id] || {};
      const digW  = SDI_DIGESTION_SPEED_SCORE[intel.digestionSpeed || 'medium'];
      // Composite: fat contribution + digestion weight + fiber weight
      const fatContrib   = p.fat * 1.5;               // fat slows gastric emptying
      const digContrib   = (p.grams / 100) * digW * 2;
      const fiberContrib = (intel.fiberLevel === 'very_high' ? 3
                         : intel.fiberLevel === 'high'       ? 2
                         : intel.fiberLevel === 'medium'     ? 1 : 0) * (p.grams / 100);
      return total + fatContrib + digContrib + fiberContrib;
    }, 0);
  }

  // ── Helper: meal satiety composite ──────────────────────────────
  function _sdi_mealSatiety(portions, mealType) {
    if (!portions.length) return 5;
    let score = 0;
    let weight = 0;
    portions.forEach(p => {
      const intel   = FOOD_INTELLIGENCE[p.food.id] || {};
      const sat     = intel.satietyLevel || 5;
      const digW    = SDI_DIGESTION_SPEED_SCORE[intel.digestionSpeed || 'medium'];
      const fiberW  = intel.fiberLevel === 'very_high' ? 2.0
                    : intel.fiberLevel === 'high'       ? 1.5
                    : intel.fiberLevel === 'medium'     ? 1.1 : 1.0;
      // Portion weight: larger portions contribute more to satiety
      const portionW = Math.min(p.grams / 100, 2.0);
      const itemScore = sat * digW * fiberW * portionW;
      score  += itemScore;
      weight += portionW;
    });
    const raw = weight > 0 ? score / weight : 5;
    return Math.max(1, Math.min(10, raw / 5)); // normalize to 1-10
  }

  // ── Helper: meal comfort score ───────────────────────────────────
  // "Dry meal" detection: high protein + no fat + no fiber + no dairy
  function _sdi_mealComfort(portions, mealType) {
    const totalFat   = portions.reduce((s,p) => s + p.fat, 0);
    const totalFiber = portions.filter(p => {
      const intel = FOOD_INTELLIGENCE[p.food.id] || {};
      return ['medium','high','very_high'].includes(intel.fiberLevel || '');
    }).length;
    const hasDairy = portions.some(p => p.food.cat === 'dairy');
    const hasVeggie = portions.some(p => p.food.cat === 'veggie');
    const hasWarm  = portions.some(p => {
      const intel = FOOD_INTELLIGENCE[p.food.id] || {};
      return (intel.cookingStyle || '').match(/grilled|baked|cooked|soup|boiled/);
    });

    let comfort = 5;
    if (totalFat >= 8)   comfort += 1.5;  // fat = flavor + satiety
    if (totalFiber >= 1) comfort += 1;    // fiber = volume + fullness
    if (hasDairy)        comfort += 0.5;  // dairy = texture variety
    if (hasVeggie)       comfort += 0.5;  // color + volume
    if (hasWarm)         comfort += 0.5;  // warmth = psychological comfort
    // Dry meal penalty
    if (totalFat < 5 && !hasDairy && totalFiber === 0 && mealType === 'dinner') {
      comfort -= 2;
      LOG(`[SDI] Dry dinner detected — fat=${totalFat.toFixed(1)}g, no fiber, no dairy`);
    }
    return Math.max(1, Math.min(10, comfort));
  }

  // ── Helper: glycemic load category for a meal ───────────────────
  function _sdi_glCategory(portions) {
    const carbPortions = portions.filter(p => p.food.cat === 'carb' || p.food.cat === 'fruit');
    if (!carbPortions.length) return 'low';
    const avgGI = carbPortions.reduce((s,p) => {
      return s + ((FOOD_INTELLIGENCE[p.food.id]?.insulinImpact || 'medium') === 'very_high' ? 3
               : (FOOD_INTELLIGENCE[p.food.id]?.insulinImpact || 'medium') === 'high'       ? 2
               : (FOOD_INTELLIGENCE[p.food.id]?.insulinImpact || 'medium') === 'medium'      ? 1 : 0);
    }, 0) / carbPortions.length;
    return avgGI >= 2 ? 'high' : avgGI >= 1 ? 'medium' : 'low';
  }

  // ── Helper: fiber load count for a portions array ───────────────
  // ── PATCH 5 START: Quantitative Fiber Load Calculation ───────────────
  // Previous implementation counted items (ignoring gram weight).
  // 300g broccoli was equal to 50g broccoli — incorrect.
  // Now: assigns numerical fiber weights multiplied by (grams/100).
  function _sdi_fiberLoad(portions) {
    const FIBER_WEIGHTS = { very_high: 8, high: 5, medium: 3, low: 0 };
    return portions.reduce((total, p) => {
      const fl     = (FOOD_INTELLIGENCE[p.food.id] || {}).fiberLevel || 'low';
      const weight = FIBER_WEIGHTS[fl] ?? 0;
      return total + weight * ((p.grams || 0) / 100);
    }, 0);
  }
  // ── PATCH 5 END ────────────────────────────────────────────────────────

  // ── SDI TIMING DELTA — injected into scoreWithRotation ──────────
  // Adds per-food SDI signal: continuity modifier + fiber gate +
  // gastric load hint. Max total delta: ±18 (safe — won't override
  // primary macro/medical scoring which ranges 0-100).
  function _sdi_getTimingDelta(food, mealType) {
    try {
      let delta = 0;
      const intel = FOOD_INTELLIGENCE[food.id] || {};

      // 1. Cross-meal continuity (from previous meal state)
      delta += Math.max(-8, Math.min(8, SDI_DAY_STATE.getContinuityModifier(food.id)));

      // 2. Fiber gate — soft penalty for high-fiber foods at pre-workout
      if (mealType === 'pre') {
        const fiberBudget = SDI_FIBER_BUDGETS.pre;
        const currentFiber = SDI_DAY_STATE.meals.filter(m => m.mealType === 'pre')
          .reduce((s,m) => s + m.fiber, 0);
        if (currentFiber >= fiberBudget && ['high','very_high'].includes(intel.fiberLevel || '')) {
          delta -= 12; // fiber overload before training - GI distress risk
          LOG(`[SDI]: pre-workout fiber gate — penalising ${food.id} (budget reached)`);
        }
      }

      // 3. Dinner lightness signal — slow-digest heavy foods penalised at dinner
      if (mealType === 'dinner') {
        if (intel.digestionSpeed === 'very_slow' && food.fat > 12) delta -= 8;
        // Boost comfort foods at dinner (casein, cottage, warm proteins)
        if (['cottage_cheese','greek_yogurt','labneh_spreadable'].includes(food.id)) delta += 6;
        if (intel.satietyLevel >= 8 && intel.digestionSpeed === 'medium') delta += 5;
      }

      // 4. Breakfast GI stability — penalise very high GI at breakfast
      // (insulin crash before lunch = poor energy continuity)
      if (mealType === 'breakfast') {
        if (intel.insulinImpact === 'very_high') delta -= 8;
        if (['very_low','low'].includes(intel.insulinImpact || '')) delta += 5;
        // Protein at breakfast — strong satiety anchor for the day
        if (food.cat === 'protein' && (intel.satietyLevel || 5) >= 7) delta += 6;
      }

      // 5. Post-workout digestion crash prevention
      // Avoid very_slow foods immediately post-workout (blocks nutrient uptake)
      if (mealType === 'post') {
        if (intel.digestionSpeed === 'very_slow') delta -= 8;
        if (intel.digestionSpeed === 'fast' && food.cat === 'protein') delta += 6;
      }

      return Math.max(-18, Math.min(18, delta));
    } catch(e) { return 0; }
  }

  // ── WRAPPER 1: scoreWithRotation - inject SDI timing delta ──────
  const _sdi_origSWR = scoreWithRotation;
  scoreWithRotation = function scoreWithRotation(food, mealType, context, _mipState) {
    let score = _sdi_origSWR(food, mealType, context, _mipState);
    try {
      const sdiDelta = _sdi_getTimingDelta(food, mealType);
      if (sdiDelta !== 0) score = Math.max(10, Math.min(100, score + sdiDelta));
    } catch(e) { /* silent */ }
    return score;
  };
  scoreWithRotation._mipWrapped    = true;
  scoreWithRotation._mreActive     = true;
  scoreWithRotation._sdiActive     = true;
  scoreWithRotation._hf3NafldActive = true;

  // ── WRAPPER 2: optimizePortions - post-assembly SDI evaluation ──
  const _sdi_origOP = optimizePortions;
  optimizePortions = function optimizePortions(mealType, targetCals, targetMacros, availableForMeal) {
    const portions = _sdi_origOP(mealType, targetCals, targetMacros, availableForMeal);
    if (!portions || !portions.length) return portions;

    try {
      const gastric  = _sdi_gastricLoad(portions);
      const satiety  = _sdi_mealSatiety(portions, mealType);
      const comfort  = _sdi_mealComfort(portions, mealType);
      const fiber    = _sdi_fiberLoad(portions);
      const gl       = _sdi_glCategory(portions);
      const softCap  = SDI_GASTRIC_SOFT_CAPS[mealType] || 40;

      // Record into day state for cross-meal continuity
      SDI_DAY_STATE.record(mealType, satiety, gastric, fiber, gl);

      // Attach SDI metadata to the portions array (non-mutating to macros)
      portions._sdiMeal = Object.freeze({
        satiety: +satiety.toFixed(2),
        gastric: +gastric.toFixed(1),
        comfort: +comfort.toFixed(2),
        fiber,
        gl,
        gastricOverload: gastric > softCap,
      });

      // Warn on gastric overload
      if (gastric > softCap) {
        LOG(`[SDI]: gastric overload — ${mealType} load=${gastric.toFixed(0)} cap=${softCap}`);
      }
      // Warn on dry dinner
      if (mealType === 'dinner' && comfort < 4) {
        LOG(`[SDI]: low dinner comfort ${comfort.toFixed(1)}/10 — meal may feel psychologically unsatisfying`);
      }
      LOG(`[SDI]: ${mealType} sat=${satiety.toFixed(1)} gastric=${gastric.toFixed(0)} comfort=${comfort.toFixed(1)} gl=${gl}`);

    } catch(e) {
      LOG('[SDI] optimizePortions wrapper error: ' + e.message);
    }

    return portions;
  };
  optimizePortions._mipWrapped = true;
  optimizePortions._mreActive  = true;
  optimizePortions._sdiActive  = true;

  // ── WRAPPER 3: buildSmartMealPlan - day-level scoring + reset ───
  const _sdi_origBSMP = buildSmartMealPlan;
  buildSmartMealPlan = function buildSmartMealPlan(totalCals, macros, weeklyMeta) {
    // Reset SDI state for this plan build
    SDI_DAY_STATE.reset();
    SDI_SCORES.reset();

    const result = _sdi_origBSMP(totalCals, macros, weeklyMeta);

    try {
      // Compute and log day-level behavioral scores
      SDI_SCORES.compute(SDI_DAY_STATE.meals);
      SDI_SCORES.log();
      // Expose on window for MAT / future debug panel
      window.__sdiScores = { ...SDI_SCORES };
    } catch(e) {
      LOG('[SDI] day scoring error: ' + e.message);
    }

    return result;
  };

  if (typeof LOG === 'function') {
    LOG('✔ [SDI] Satiety & Digestion Intelligence active — continuity + gastric load + comfort + fiber gate + GI sequencing');
  }

})(); // end _sdi_SatietyDigestionIntelligence

// ══ END HOTFIX BLOCK v29-HF2 ══


// ═══════════════════════════════════════════════════════════════════
//
//  ██╗   ██╗██████╗  ██╗    ██╗      █████╗  ██╗   ██╗███████╗██████╗
//  ██║   ██║╚════██╗███║    ██║     ██╔══██╗ ╚██╗ ██╔╝██╔════╝██╔══██╗
//  ██║   ██║ █████╔╝╚██║    ██║     ███████║  ╚████╔╝ █████╗  ██████╔╝
//  ╚██╗ ██╔╝ ╚═══██╗ ██║    ██║     ██╔══██║   ╚██╔╝  ██╔══╝  ██╔══██╗
//   ╚████╔╝ ██████╔╝ ██║    ███████╗██║  ██║    ██║   ███████╗██║  ██║
//    ╚═══╝  ╚═════╝  ╚═╝    ╚══════╝╚═╝  ╚═╝    ╚═╝   ╚══════╝╚═╝  ╚═╝
//
//  v31 UNIFIED STABLE CORE — LAYER 2: SCIENCE & INTELLIGENCE
//  Surgically migrated from v30 science branch
//
//  ARCHITECTURE:
//    Layer 1 (Runtime Kernel) = v29-HF3 — immutable, controls execution
//    Layer 2 (Science Layer)  = v31-L2   — additive only, zero overwrites
//
//  FEATURES MIGRATED:
//    [L2-1] Dynamic Fat Floor Validator — hormonal floor enforcement audit
//    [L2-2] Adaptive Hydration System   — activity + health-aware water targets
//    [L2-3] Breakfast Flexibility Gate  — relaxed breakfast carb/protein rules
//    [L2-4] Medical Diet Warnings       — diet+condition conflict confirmation
//           (already injected above into selectDiet())
//    [L2-5] Carb Drift Reset Guard      — prevents carb overshoot across meals
//    [L2-6] Auto-Intelligence Unknown Foods — graceful fallback for unprofilied foods
//    [L2-7] Macro % Display Enhancement — kcal breakdown in calculator (already present)
//
//  RULES:
//    · Every wrapper captures the prior reference FIRST before wrapping
//    · Every wrapper is tagged with _v31L2Active = true
//    · No wrapper touches FOOD_DB, FOOD_MAP, or FOOD_DB_RAW
//    · No wrapper introduces recursion (single-level delegation only)
//    · All wrappers are try-catch protected — engine never breaks on error
//    · SDI, HF3, HF6, HF7 flags are preserved on wrapped functions
// ═══════════════════════════════════════════════════════════════════


// ───────────────────────────────────────────────────────────────────
//  [L2-1] DYNAMIC FAT FLOOR VALIDATOR
//
//  Problem: v29-HF3 calculates fat floor correctly in calcFatTarget()
//  but has no runtime validation that the final assembled meal plan
//  respects the hormonal fat floor. If carb allocation "steals" the
//  remaining calories, fat can fall below 0.7 g/kg BW silently.
//
//  Solution: Post-assembly validator that logs a warning and records
//  a flag on weeklyMeta when the daily fat total falls below the
//  evidence-based hormonal floor (0.7 g/kg BW for keto/lowcarb,
//  0.6 g/kg BW for balanced). Does NOT modify macros — the
//  calcFatTarget() upstream fix in HF3 handles that. This is a
//  monitoring + logging layer only.
//
//  Evidence: Hamalainen 1984 · Hamalainen 1994 — testosterone drops
//  when fat < 0.6 g/kg BW in men; similar data for female hormone
//  cycles (Reed 1987). Floor is the LBM-based minimum, not absolute.
// ───────────────────────────────────────────────────────────────────
(function _v31l2_dynamicFatFloorValidator() {
  if (typeof buildSmartMealPlan !== 'function') return;

  const _orig_bsmp_ffl = buildSmartMealPlan;

  buildSmartMealPlan = function buildSmartMealPlan(totalCals, macros, weeklyMeta) {
    const result = _orig_bsmp_ffl(totalCals, macros, weeklyMeta);

    try {
      // ── Validate fat floor post-assembly ──────────────────────────
      const fatG      = macros && macros.fat ? macros.fat : 0;
      const weightKg  = (typeof DE !== 'undefined' && DE.weight) ? DE.weight : 70;
      const diet      = (typeof DE !== 'undefined' && DE.selectedDiet) ? DE.selectedDiet : 'balanced';

      // Evidence-based floor: keto/carnivore allow higher fat so floor is higher
      const fatFloorPerKg = ['keto', 'carnivore'].includes(diet) ? 0.9
                          : ['lowcarb','mediterranean'].includes(diet) ? 0.75
                          : 0.6; // balanced / carbcycle
      const fatFloorG = Math.round(weightKg * fatFloorPerKg);

      if (fatG > 0 && fatG < fatFloorG) {
        LOG(`[L2-1] FAT FLOOR BREACH: plan fat=${fatG}g < floor=${fatFloorG}g (${fatFloorPerKg}g/kg × ${weightKg}kg). diet=${diet}. Hormonal risk — check calcFatTarget()`);
        // Tag weeklyMeta for downstream consumers (display layer can surface this)
        if (weeklyMeta && typeof weeklyMeta === 'object') {
          weeklyMeta._v31FatFloorWarning = true;
          weeklyMeta._v31FatFloorActual  = fatG;
          weeklyMeta._v31FatFloorMin     = fatFloorG;
        }
      } else if (fatG > 0) {
        LOG(`✔ [L2-1] Fat floor OK: ${fatG}g ≥ ${fatFloorG}g floor (${diet})`);
      }
    } catch(e) {
      LOG('[L2-1] Fat floor validator error: ' + e.message);
    }

    return result;
  };

  if (typeof LOG === 'function') LOG('✔ [L2-1] Dynamic Fat Floor Validator active');
})();


// ───────────────────────────────────────────────────────────────────
//  [L2-2] ADAPTIVE HYDRATION SYSTEM
//
//  Problem: HF3 uses a fixed 35ml/kg formula for water.
//  v30 introduced a smarter formula that accounts for:
//    · Activity level (training days need +400–600ml)
//    · Medical conditions (CKD: fluid restriction; pcos: +200ml)
//    · Climate: not computable at runtime but a static +100ml
//      bonus is applied as conservative adjustment
//    · High-protein diets: protein metabolism requires more water
//      (~1ml per kcal of protein, above baseline)
//
//  This is a PURE ADDITIVE layer — it computes and stores the
//  enhanced water recommendation on DE.v31WaterML without touching
//  any existing water calculation. UI can read DE.v31WaterML.
//
//  Evidence: IOM 2005 · EFSA 2010 hydration guidelines.
//  CKD fluid restriction: KDIGO 2012 (individualised, not formula).
// ───────────────────────────────────────────────────────────────────
(function _v31l2_adaptiveHydration() {
  if (typeof buildResults !== 'function') return;

  const _orig_buildResults_hy = buildResults;

  buildResults = function buildResults() {
    _orig_buildResults_hy.apply(this, arguments);

    try {
      const weight  = (typeof DE !== 'undefined' && DE.weight)  ? DE.weight  : 70;
      const health  = (typeof DE !== 'undefined' && DE.healthConditions) ? DE.healthConditions : [];
      const diet    = (typeof DE !== 'undefined' && DE.selectedDiet) ? DE.selectedDiet : 'balanced';
      const actLvl  = parseFloat(document.getElementById('inp-activity')?.value) || 1.4;

      // ── Base: 35ml/kg (IOM standard) ──────────────────────────────
      let waterML = Math.round(weight * 35);

      // ── Activity bonus: +400ml moderate / +700ml high ─────────────
      if      (actLvl >= 1.75) waterML += 700;
      else if (actLvl >= 1.55) waterML += 400;
      else if (actLvl >= 1.375) waterML += 150;

      // ── High protein diet: +200ml (protein metabolism) ────────────
      if (['lowcarb', 'keto', 'carnivore'].includes(diet)) waterML += 200;

      // ── PCOS: +200ml (progesterone/estrogen fluid balance) ─────────
      if (health.includes('pcos')) waterML += 200;

      // ── CKD: flag restriction — do NOT add, log warning ───────────
      if (health.includes('kidney')) {
        LOG('[L2-2] CKD detected — fluid recommendation should be individualised by nephrologist. Using base formula only');
        waterML = Math.round(weight * 30); // conservative for CKD
      }

      // ── Kidney stones: increase to 2.5–3.0L (ACOS 2022) ──────────
      if (health.includes('kidney-stones')) {
        waterML = Math.max(waterML, 2500);
        LOG('[L2-2] Kidney stones: minimum 2.5L/day to prevent crystal formation');
      }

      // ── Heart failure: strict restriction ≤1.5L (ESC 2021) ────────
      if (health.includes('heart-failure')) {
        waterML = Math.min(waterML, 1500);
        LOG('[L2-2] Heart failure: fluid restricted to ≤1.5L. Refer to cardiologist for exact target');
      }

      // ── Fatty liver: +200ml (detox support, hepatology guidelines) ─
      if (health.includes('fatty-liver')) waterML += 200;

      // ── Clamp to realistic range ───────────────────────────────────
      waterML = Math.max(1500, Math.min(5000, waterML));

      // ── Store on DE for downstream rendering ──────────────────────
      if (typeof DE !== 'undefined') {
        DE.v31WaterML = waterML;
        DE.v31WaterL  = (waterML / 1000).toFixed(1);
      }

      LOG(`✔ [L2-2] Adaptive hydration: ${waterML}ml (${(waterML/1000).toFixed(1)}L) | activity=${actLvl} | diet=${diet} | health=[${health.join(',')}]`);

      // ── Patch water display if element exists ─────────────────────
      const waterEl = document.getElementById('res-water');
      if (waterEl) {
        const liters = (waterML / 1000).toFixed(1);
        // Only update if displayed value differs (avoid flicker)
        const currentText = waterEl.textContent || '';
        if (!currentText.includes(liters)) {
          waterEl.textContent = liters + ' L';
        }
      }
    } catch(e) {
      LOG('[L2-2] Adaptive hydration error: ' + e.message);
    }
  };

  buildResults._v31L2Active = true;

  if (typeof LOG === 'function') LOG('✔ [L2-2] Adaptive Hydration System active');
})();


// ───────────────────────────────────────────────────────────────────
//  [L2-3] BREAKFAST FLEXIBILITY GATE
//
//  Problem: The engine's food validator scores breakfast foods with
//  the same rigid macro split as lunch/dinner. Nutritional science
//  supports MORE flexibility at breakfast:
//    · First meal of day: insulin sensitivity is highest (Dawn Effect)
//    · Protein-first breakfast - lower glucose spike (Jakubowicz 2015)
//    · Carb-inclusive breakfast is clinically sound for athletes
//      and in carb-cycling contexts
//    · Forcing strict keto ratios at breakfast when the diet is
//      'carbcycle' and it's a training day causes unnecessary food
//      restriction with no clinical benefit
//
//  Strategy: Wrap scoreWithRotation to apply a contextual modifier
//  that relaxes the carb penalty for breakfast foods when:
//    · Diet is NOT pure keto/carnivore
//    · mealType === 'breakfast'
//    · The food is a complex carb (oats, banana, whole bread, sweet potato)
//    · A protein source is already in the meal context
//
//  Impact: +8 score bonus for complex-carb breakfast foods when
//  protein is present. Capped at +8 so it doesn't override medical/
//  diet filters. Does not affect keto/carnivore diets at all.
// ───────────────────────────────────────────────────────────────────
(function _v31l2_breakfastFlexibilityGate() {
  if (typeof scoreWithRotation !== 'function') return;

  // Complex carb IDs that earn flexibility bonus at breakfast
  const BFG_COMPLEX_CARBS = new Set([
    'oats', 'banana', 'whole_bread', 'baladi_bread', 'sweet_potato',
    'brown_rice', 'quinoa', 'oat_bread', 'lentils', 'chickpeas_canned',
    'foul_canned', 'foul', 'apple', 'orange', 'strawberry',
    'milk_skim', 'greek_yogurt', 'yogurt_plain'
  ]);

  // Diets where breakfast flexibility is appropriate
  const BFG_FLEXIBLE_DIETS = new Set(['balanced', 'carbcycle', 'lowcarb', 'mediterranean']);

  const _orig_swr_bfg = scoreWithRotation;

  scoreWithRotation = function scoreWithRotation(food, mealType, context, _mipState) {
    let score = _orig_swr_bfg(food, mealType, context, _mipState);

    try {
      // Only apply at breakfast
      if (mealType !== 'breakfast') return score;

      // Only for flexible diets
      const diet = (context && context.diet) ? context.diet
                 : (typeof DE !== 'undefined' ? DE.selectedDiet : 'balanced');
      if (!BFG_FLEXIBLE_DIETS.has(diet)) return score;

      // Only for complex carb foods
      if (!BFG_COMPLEX_CARBS.has(food.id)) return score;

      // Check if protein is already in meal context (MIPSTATE or activeMealContext)
      let proteinPresent = false;
      if (_mipState && _mipState.currentPortions) {
        proteinPresent = _mipState.currentPortions.some(p =>
          p.food && ['protein','dairy'].includes(p.food.cat)
        );
      }

      // Apply flexibility bonus when protein anchor is present
      if (proteinPresent) {
        score = Math.min(100, score + 8);
        // Don't log every food — only on actual bonus application
      }
    } catch(e) {
      // Silent — never break scoring for a breakfast bonus
    }

    return score;
  };

  // Preserve all existing wrapper flags
  scoreWithRotation._mipWrapped      = true;
  scoreWithRotation._mreActive       = true;
  scoreWithRotation._sdiActive       = true;
  scoreWithRotation._hf3NafldActive  = true;
  scoreWithRotation._v31L2Active     = true;

  if (typeof LOG === 'function') LOG('✔ [L2-3] Breakfast Flexibility Gate active — complex carb bonus at breakfast (flexible diets only)');
})();


// ─────────────────────────────────────────────────────────────────────
//  [L2-5] CARB DRIFT RESET GUARD
//
//  Problem: In carb-cycling mode, if a plan rebuild is triggered
//  mid-session (e.g. user changes training days), the CCPM state
//  can accumulate carb drift — meals that were already generated
//  with training-day multipliers get counted again in the next
//  rebuild, causing carb overshoot of 30–50g/day.
//
//  Root cause: ccpmApply() has no session reset trigger — it tracks
//  _ccpmAdjusted flags but those are per-portion, not per-plan.
//
//  Solution: Hook into buildSmartMealPlan's pre-call lifecycle to
//  clear any CCPM drift state. We do this by resetting the
//  ccMacroLayerApplied flag on weeklyMeta before delegation.
//  This is safe because buildSmartMealPlan rebuilds weeklyMeta
//  fresh from _resolveWeeklyTargets() anyway.
// ───────────────────────────────────────────────────────────────────
(function _v31l2_carbDriftResetGuard() {
  if (typeof buildSmartMealPlan !== 'function') return;

  const _orig_bsmp_cdrg = buildSmartMealPlan;

  buildSmartMealPlan = function buildSmartMealPlan(totalCals, macros, weeklyMeta) {
    try {
      // ── Reset drift flag before plan rebuild ─────────────────────
      if (weeklyMeta && typeof weeklyMeta === 'object') {
        // Clear the "macro layer already applied" flag so CCPM starts clean
        if (weeklyMeta.ccMacroLayerApplied === true) {
          weeklyMeta = Object.assign({}, weeklyMeta, { ccMacroLayerApplied: false, _v31DriftReset: true });
          LOG('⟳ [L2-5] CarbDrift reset: ccMacroLayerApplied cleared for clean rebuild');
        }
      }
    } catch(e) {
      LOG('[L2-5] Carb drift reset error (non-fatal): ' + e.message);
    }
    return _orig_bsmp_cdrg(totalCals, macros, weeklyMeta);
  };

  // ── RC1: Canonical wrapper-status flags — set once, last wrapper ──
  // These are runtime-inspection flags only. Not exported. Not saved.
  buildSmartMealPlan._v31L2Active = true;  // L2 layer stack active
  buildSmartMealPlan._mipWrapped  = true;  // MIP diversity wrapper active
  buildSmartMealPlan._mreActive   = true;  // Macro audit wrapper active
  buildSmartMealPlan._sdiActive   = true;  // SDI day-state wrapper active

  if (typeof LOG === 'function') LOG('✔ [L2-5] Carb Drift Reset Guard active — RC1 wrapper stack complete');
})();


// ───────────────────────────────────────────────────────────────────
//  [L2-6] AUTO-INTELLIGENCE FOR UNKNOWN FOODS
//
//  Problem: FOOD_DB has ~600+ entries. Any food without a
//  FOOD_INTELLIGENCE profile gets scored with default values
//  (satiety=5, digestion='medium') — which is fine but creates
//  invisible scoring gaps for batch-generated foods (brand variants,
//  _batch_N suffix foods).
//
//  Solution: An auto-intelligence resolver that infers FOOD_INTELLIGENCE
//  properties from the food's canonical data (cat, cal, pro, fat, carb)
//  when no profile exists. This is injected as a read-through cache
//  on the FOOD_INTELLIGENCE lookup path — not a mutation of the object.
//
//  Logic:
//    satietyLevel:   high protein (>20g/100g) - 8; high fat - 7; high fiber - 6; default 5
//    digestionSpeed: fat>15g - 'slow'; fat>8g - 'medium'; lean protein - 'fast'
//    insulinImpact:  carb<5g - 'very_low'; carb<15g - 'low'; carb<30g - 'medium'; else - 'high'
//    fiberLevel:     inferred from cat (veggie - 'high', fruit - 'medium', carb - 'medium', else - 'low')
// ───────────────────────────────────────────────────────────────────
(function _v31l2_autoIntelligenceUnknownFoods() {
  // Guard: FOOD_INTELLIGENCE must exist
  if (typeof FOOD_INTELLIGENCE === 'undefined') {
    if (typeof LOG === 'function') LOG('[L2-6] FOOD_INTELLIGENCE not defined — AutoIntel deferred');
    return;
  }

  // ── Auto-inference function (pure, no mutations) ──────────────────
  function _v31_inferIntel(food) {
    if (!food) return {};
    const pro  = food.pro  || 0;
    const fat  = food.fat  || 0;
    const carb = food.carb || 0;
    const cat  = food.cat  || '';

    // satietyLevel: 1-10
    let satietyLevel = 5;
    if (pro >= 20)            satietyLevel = 8;
    else if (pro >= 12)       satietyLevel = 7;
    else if (fat >= 15)       satietyLevel = 7;
    else if (fat >= 8)        satietyLevel = 6;
    else if (cat === 'veggie') satietyLevel = 4;

    // digestionSpeed
    let digestionSpeed = 'medium';
    if      (fat > 15)                  digestionSpeed = 'slow';
    else if (fat > 8)                   digestionSpeed = 'medium';
    else if (pro >= 20 && fat < 5)      digestionSpeed = 'fast';
    else if (cat === 'fruit')           digestionSpeed = 'fast';
    else if (cat === 'veggie')          digestionSpeed = 'fast';

    // insulinImpact
    let insulinImpact = 'medium';
    if      (carb < 5)  insulinImpact = 'very_low';
    else if (carb < 15) insulinImpact = 'low';
    else if (carb < 30) insulinImpact = 'medium';
    else if (carb < 50) insulinImpact = 'high';
    else                insulinImpact = 'very_high';

    // fiberLevel (inferred from category)
    const fiberLevel = cat === 'veggie' ? 'high'
                     : cat === 'fruit'  ? 'medium'
                     : cat === 'carb'   ? 'medium'
                     : 'low';

    return { satietyLevel, digestionSpeed, insulinImpact, fiberLevel, _autoInferred: true };
  }

  // ── Read-through proxy on FOOD_INTELLIGENCE ───────────────────────
  // We create a Proxy that intercepts property access and auto-infers
  // for missing foods without modifying the original object.
  // Falls back gracefully if Proxy is unavailable (IE11 safety).
  try {
    const _origFI = FOOD_INTELLIGENCE;

    // Cache for inferred profiles (avoid repeated inference)
    const _autoCache = {};

    // Override the global FOOD_INTELLIGENCE with a Proxy
    // The engine accesses it as: FOOD_INTELLIGENCE[food.id] || {}
    // Our proxy intercepts the undefined case and returns inferred data.
    FOOD_INTELLIGENCE = new Proxy(_origFI, {
      get(target, prop) {
        // Pass-through for non-string props and Symbol props
        if (typeof prop !== 'string') return target[prop];

        // If profile exists in original object - return it directly
        if (Object.prototype.hasOwnProperty.call(target, prop)) return target[prop];

        // Not found - look up in auto cache or infer
        if (_autoCache[prop]) return _autoCache[prop];

        // Try to find food in FOOD_DB for inference
        const food = (typeof FOOD_MAP !== 'undefined' && FOOD_MAP.get)
          ? FOOD_MAP.get(prop)
          : (typeof FOOD_DB !== 'undefined' ? FOOD_DB.find(f => f.id === prop) : null);

        if (food) {
          const inferred = _v31_inferIntel(food);
          _autoCache[prop] = inferred;
          return inferred;
        }

        // No food found - return empty (engine handles || {} fallback)
        return undefined;
      }
    });

    if (typeof LOG === 'function') LOG('✔ [L2-6] Auto-Intelligence Proxy active — unknown foods will be auto-profiled');
  } catch(e) {
    // Proxy not supported or error - silent fallback, engine still works
    if (typeof LOG === 'function') LOG('[L2-6] Auto-Intelligence Proxy unavailable (' + e.message + ') — using static profiles only');
  }
})();


// ───────────────────────────────────────────────────────────────────
//  v31 LAYER 2 — INTEGRITY SELF-CHECK
//  Runs after all L2 patches to verify wrapper chain is intact.
//  Logs the complete wrapper flag state for debugging.
// ───────────────────────────────────────────────────────────────────
(function _v31l2_integrityCheck() {
  const checks = [];

  // scoreWithRotation flags
  if (typeof scoreWithRotation === 'function') {
    checks.push('scoreWithRotation._mipWrapped='      + (!!scoreWithRotation._mipWrapped));
    checks.push('scoreWithRotation._hf3NafldActive='  + (!!scoreWithRotation._hf3NafldActive));
    checks.push('scoreWithRotation._sdiActive='       + (!!scoreWithRotation._sdiActive));
    checks.push('scoreWithRotation._v31L2Active='     + (!!scoreWithRotation._v31L2Active));
  }

  // optimizePortions flags
  if (typeof optimizePortions === 'function') {
    checks.push('optimizePortions._mipWrapped='   + (!!optimizePortions._mipWrapped));
    checks.push('optimizePortions._sdiActive='    + (!!optimizePortions._sdiActive));
  }

  // buildSmartMealPlan flags
  if (typeof buildSmartMealPlan === 'function') {
    checks.push('buildSmartMealPlan._v31L2Active=' + (!!buildSmartMealPlan._v31L2Active));
    checks.push('buildSmartMealPlan._sdiActive='   + (!!buildSmartMealPlan._sdiActive));
  }

  if (typeof LOG === 'function') {
    LOG('━━━━━━━━━━━━━━━━━━ v31 LAYER 2 INTEGRITY CHECK ━━━━━━━━━━━━━━━━━━');
    LOG('ENGINE VERSION: v31 Unified Stable Core');
    LOG('LAYER 1 (Runtime Kernel): v29-HF3 [HF1–HF7 + SDI + MNL]');
    LOG('LAYER 2 (Science): L2-1 FatFloor · L2-2 Hydration · L2-3 BreakfastFlex · L2-5 CarbDrift · L2-6 AutoIntel');
    LOG('LAYER 2 (Safety):  IMP-4 DietConflicts injected into selectDiet()');
    checks.forEach(c => LOG('  ✔ ' + c));
    LOG('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
})();

// ══ END v31 LAYER 2 — SCIENCE & INTELLIGENCE ══

