// ═══════════════════════════════════════════════════════════════
//  SMART NUTRITION CALCULATION ENGINE v9
//  Mifflin St Jeor + Dynamic TDEE + LBM-based Macros + Adaptive Deficit
// ═══════════════════════════════════════════════════════════════

// ── Body Fat Estimation ────────────────────────────────────────
function estimateBodyFat() {
  const { gender, weight, height, age } = DE;
  const bf = parseFloat(document.getElementById('inp-bf')?.value);
  if (bf >= 3 && bf <= 60) return bf; // Direct input — highest priority

  // Navy Formula if waist + neck (+ hip for females) available
  const waist = parseFloat(document.getElementById('inp-waist')?.value);
  const neck  = parseFloat(document.getElementById('inp-neck')?.value);
  const hip   = parseFloat(document.getElementById('inp-hip')?.value);

  if (waist > 0 && neck > 0 && waist > neck) {
    if (gender === 'ذكر') {
      // Navy male: 495 / (1.0324 - 0.19077*log10(waist-neck) + 0.15456*log10(height)) - 450
      const bf_navy = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
      if (bf_navy > 3 && bf_navy < 60) return +bf_navy.toFixed(1);
    } else {
      // Navy female: 495 / (1.29579 - 0.35004*log10(waist+hip-neck) + 0.22100*log10(height)) - 450
      if (hip > 0 && (waist + hip) > neck) {
        const bf_navy = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(height)) - 450;
        if (bf_navy > 3 && bf_navy < 60) return +bf_navy.toFixed(1);
      }
    }
  }

  // Intelligent fallback estimation using BMI + age + gender
  const bmi = weight / ((height / 100) ** 2);
  // Deurenberg formula: BF% = 1.20*BMI + 0.23*age - 10.8*sex - 5.4  (sex: M=1, F=0)
  const sex = gender === 'ذكر' ? 1 : 0;
  const bfEst = 1.20 * bmi + 0.23 * age - 10.8 * sex - 5.4;
  return +Math.max(5, Math.min(55, bfEst)).toFixed(1);
}

// ── Lean Body Mass ─────────────────────────────────────────────
function calcLBM() {
  const bf = estimateBodyFat();
  return +(DE.weight * (1 - bf / 100)).toFixed(1);
}

// ── BMR — Mifflin St Jeor ──────────────────────────────────────
function calcBMR() {
  const { gender, weight, height, age } = DE;
  // v44: age guard (Mifflin validated 18-78 yrs). Flag only, no block.
  if (age < 15) {
    DE._ageWarning = 'عمرك أقل من 15 سنة — هذا المحرك للبالغين. استشر طبيب أطفال قبل البدء';
  } else if (age > 80) {
    DE._ageWarning = 'عمرك فوق 80 سنة — معادلات الحساب أقل دقة. استشر طبيبك لخطة غذائية آمنة';
  } else { DE._ageWarning = null; }
  // Mifflin St Jeor (most accurate for general population)
  if (gender === 'ذكر') {
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  } else {
    return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  }
}

// ── Dynamic TDEE ───────────────────────────────────────────────
function calcTDEE() {
  const bmr = calcBMR();
  let tdee = Math.round(bmr * DE.activity);

  // Dynamic enhancement from optional inputs
  const steps     = parseFloat(document.getElementById('inp-steps')?.value) || 0;
  const trainDays = parseFloat(document.getElementById('inp-train-days')?.value) || 0;
  const wDur      = parseFloat(document.getElementById('inp-workout-dur')?.value) || 0;
  const cardio    = parseFloat(document.getElementById('inp-cardio')?.value) || 0;

  // Steps adjustment: ~0.04 kcal/step on top of activity multiplier residual
  // (Only add if user provided steps AND activity was set as sedentary/light)
  if (steps > 0 && DE.activity <= 1.375) {
    // Baseline ~3000 steps assumed in sedentary. Extra burn: (steps-3000)*0.04
    const extraStepCals = Math.max(0, (steps - 3000) * 0.04);
    tdee += Math.round(extraStepCals);
  }

  // ── PATCH 1 — TDEE double-counting fix ───────────────────────
  // Activity multipliers >= 1.55 (moderate/heavy/very active) already
  // incorporate structured training burn. Adding explicit training kcal
  // on top creates a dangerous double-count (300–600 kcal/day excess).
  // Only apply training/cardio corrections for sedentary/light users
  // (DE.activity <= 1.375) where the multiplier does NOT model gym work.
  const trainingAlreadyInMultiplier = DE.activity > 1.375;

  // Resistance training TEF: ~5-7 kcal/min net above baseline
  if (trainDays > 0 && wDur > 0 && !trainingAlreadyInMultiplier) {
    const weeklyLiftBurn = trainDays * wDur * 6; // ~6 kcal/min net for lifting
    tdee += Math.round(weeklyLiftBurn / 7);       // spread daily
  }

  // Cardio: MET-based estimate (~8 kcal/min moderate cardio)
  if (cardio > 0 && !trainingAlreadyInMultiplier) {
    const avgCardioDur = wDur > 0 ? Math.min(wDur, 45) : 35; // 35 min default
    const weeklyCardioBurn = cardio * avgCardioDur * 7.5;
    tdee += Math.round(weeklyCardioBurn / 7);
  }

  // ── GAP-1: Thyroid TDEE adjustment — hypothyroid vs hyperthyroid are OPPOSITE ──
  // Hypothyroid: BMR genuinely reduced 15-40% in clinical cases. Conservative 10% reduction.
  // Hyperthyroid: BMR genuinely ELEVATED 25-80% above normal. Conservative +15% addition.
  // Old generic 'thyroid' tag kept for backward compat — treated as hypothyroid.
  if (DE.healthConditions.includes('hypothyroid') || DE.healthConditions.includes('thyroid') || DE.healthConditions.includes('slow-meta')) {
    tdee = Math.round(tdee * 0.90); // 10% reduction for hypothyroid/slow meta
    LOG('ThyroidAdj: Hypothyroid/slow-meta — TDEE reduced 10%');
  }
  if (DE.healthConditions.includes('hyperthyroid')) {
    tdee = Math.round(tdee * 1.12); // 12% increase for hyperthyroid (elevated BMR)
    LOG('ThyroidAdj: Hyperthyroid — TDEE increased 12% (elevated BMR)');
  }

  // v44: PCOS -5% TDEE only when IR co-exists (Georgopoulos 2001, Balen 2007)
  if (DE.healthConditions.includes('pcos') && DE.healthConditions.includes('insulin')) {
    tdee = Math.round(tdee * 0.95);
    LOG('PCOS+IR: TDEE -5%');
  }

  // ── PHYSIOLOGY B: Adaptive Thermogenesis TDEE Correction ──────
  // Evidence: Rosenbaum & Leibel 2010, Hall et al. 2012 — after sustained
  // caloric restriction the body reduces TDEE beyond what fat-free mass loss
  // alone predicts ("metabolic adaptation"). This is separate from deficit
  // management — it corrects the TDEE estimate itself.
  //
  // Effect size (conservative evidence-based estimates):
  //   Weeks 1-4:  no adaptation (body hasn't adjusted yet)
  //   Weeks 5-8:  ~3% TDEE reduction (early adaptation)
  //   Weeks 9-12: ~6% TDEE reduction (established adaptation)
  //   Weeks 13+:  ~9% TDEE reduction (significant chronic adaptation)
  //
  // GUARDS:
  //   Only applies during cut/recomp (surplus or maintenance - no adaptation)
  //   Max correction capped at 9% (evidence ceiling — Hall et al)
  //   Does NOT stack with thyroid/slow-meta adjustments (already adjusted above)
  //   NaN-safe: currentWeek defaults to 1
  const _physioWeek = (typeof DE !== 'undefined' && DE.currentWeek) ? DE.currentWeek : 1;
  const _physioGoal = (typeof DE !== 'undefined') ? (DE.goal || 'cut') : 'cut';
  const _alreadySlowMeta = DE.healthConditions.includes('thyroid') || DE.healthConditions.includes('slow-meta') || DE.healthConditions.includes('hypothyroid') || DE.healthConditions.includes('hyperthyroid');

  if (['cut','recomp'].includes(_physioGoal) && !_alreadySlowMeta && _physioWeek >= 5) {
    const adaptPct = _physioWeek <= 8 ? 0.97    // −3%
                   : _physioWeek <= 12 ? 0.94   // −6%
                   : 0.91;                       // −9% (capped)
    tdee = Math.round(tdee * adaptPct);
    LOG(`PhysioB: Adaptive thermogenesis week ${_physioWeek} — TDEE adjusted ×${adaptPct}`);
  }

  return tdee;
}

// ── Adaptive Deficit/Surplus ───────────────────────────────────
function calcAdaptiveDeficit(tdee) {
  const bf      = estimateBodyFat();
  const lbm     = calcLBM();
  const weeklyRate = parseFloat(document.getElementById('inp-weekly-rate')?.value) || 0.5;

  // 7700 kcal ≈ 1 kg fat. Weekly deficit = weeklyRate * 7700 / 7
  const rawDailyDeficit = Math.round((weeklyRate * 7700) / 7);

  let deficit = rawDailyDeficit;

  // Adaptive: if very lean (BF < 12% male / < 20% female), reduce deficit to protect muscle
  const leanThreshold = DE.gender === 'ذكر' ? 12 : 20;
  const fatThreshold  = DE.gender === 'ذكر' ? 30 : 38;

  if (bf < leanThreshold) {
    // Very lean: cap deficit at 300 kcal max
    deficit = Math.min(deficit, 300);
  } else if (bf > fatThreshold) {
    // ── PATCH 5a — High-BF branch: 20% deficit scaling for high body-fat users ──
    deficit = rawDailyDeficit * 1.2;
  }

  // PhysioA1 REMOVED v44: PhysioB already corrects TDEE baseline for
  // the same Leibel/Rosenbaum adaptation. Double-applying under-fed users
  // by up to 22% beyond intended deficit.  A2/A3 preserved (different phenomena).
  const week = (typeof DE !== 'undefined' && DE.currentWeek) ? DE.currentWeek : 1;
  const isOnCut = (DE.goal === 'cut' || DE.goal === 'recomp');

  // ── PHYSIOLOGY A2: NEAT Downregulation Awareness ──────────────
  // Evidence: Levine et al. 2005, Müller et al. 2016 — aggressive cuts
  // (>25% TDEE) cause unconscious NEAT reduction of 100–300 kcal/day.
  // The engine compensates by reducing the REQUESTED deficit when the
  // cut is already aggressive, preventing over-correction.
  // ONLY applies for sedentary users (DE.activity ≤ 1.375) where NEAT
  // is the primary non-exercise activity component.
  if (isOnCut && DE.activity <= 1.375 && tdee > 0) {
    const deficitPct = deficit / tdee;
    if (deficitPct > 0.25) {
      // Aggressive cut: NEAT will drop 100–200 kcal - effective deficit is
      // already larger than requested. Reduce requested deficit by ~8%.
      deficit = Math.round(deficit * 0.92);
      LOG(`PhysioA2: NEAT downregulation detected (deficit ${Math.round(deficitPct*100)}% TDEE) — deficit reduced 8%`);
    }
  }

  // ── PHYSIOLOGY A3: Training Recovery Awareness ────────────────
  // Evidence: Kreher & Schwartz 2012 (overreaching) — high training load
  // (≥5 days/wk) with aggressive cut increases cortisol, impairs recovery.
  // Reduce deficit slightly when training volume is high during a cut.
  const trainDays = parseFloat(document.getElementById('inp-train-days')?.value) || 0;
  if (isOnCut && trainDays >= 5) {
    deficit = Math.round(deficit * 0.93); // ~7% reduction for high training load
    LOG(`PhysioA3: High training load (${trainDays}d/wk) on cut — deficit reduced 7%`);
  }

  // ── PHYSIOLOGY A4: Hormonal Stress Protection ─────────────────
  // Evidence: Tomiyama et al. 2010, Prentice et al. 1991 — chronic deficits
  // >30% TDEE elevate cortisol, suppress thyroid T3, reduce leptin, increasing
  // muscle catabolism and fat regain risk upon diet end.
  // If the current deficit would exceed 30% of TDEE, flag and cap harder.
  if (isOnCut && tdee > 0 && deficit / tdee > 0.30) {
    deficit = Math.round(tdee * 0.28); // cap at 28% — below hormonal stress threshold
    LOG(`PhysioA4: Hormonal stress threshold — deficit hard-capped at 28% TDEE`);
  }

  // ── PHYSIOLOGY A5: Advanced Obesity Crash-Risk Prevention ────
  // Evidence: Very-Low-Calorie Diet risks (VLCD guidelines, NIH 1998):
  // obese beginners (BMI ≥ 35) are at risk of gallstone formation,
  // electrolyte imbalance, and cardiac arrhythmia below 800 kcal/day.
  // Progressive deficit smoothing: week 1-2 - gentle start regardless of weeklyRate.
  const bmi = DE.weight && DE.height ? DE.weight / ((DE.height / 100) ** 2) : 25;
  if (bmi >= 35 && week <= 2 && isOnCut) {
    const gentleDeficit = Math.round(tdee * 0.15); // max 15% deficit for obese week 1-2
    deficit = Math.min(deficit, gentleDeficit);
    LOG(`PhysioA5: Obese beginner (BMI ${bmi.toFixed(1)}) week ${week} — deficit smoothed to 15% TDEE max`);
  }

  // ── Original safety bounds (Patch 5b — preserved) ────────────
  const MAX_DEFICIT_PCT = 0.35;
  const MIN_DEFICIT     = 100;

  deficit = Math.min(deficit, Math.round(tdee * MAX_DEFICIT_PCT)); // ceiling
  deficit = Math.max(deficit, MIN_DEFICIT);                         // floor

  // ── NaN guard (Patch 5c — preserved) ─────────────────────────
  if (!isFinite(deficit) || deficit < MIN_DEFICIT) deficit = MIN_DEFICIT;

  return Math.round(deficit);
}

function calcTargetCals() {
  const tdee = calcTDEE();
  // ── SAFETY GATE: pregnancy / breastfeeding ──
  // A calorie deficit is unsafe during pregnancy/breastfeeding. Force
  // maintenance (no cut) and surface a strong medical warning; any energy
  // adjustment must be individualized by an OB-GYN / registered dietitian.
  if (DE.healthConditions && (DE.healthConditions.includes('pregnant') || DE.healthConditions.includes('breastfeeding'))) {
    DE._pregnancySafety = true;
    const _pgTarget = Math.max(1500, Math.round(tdee));
    if (typeof LOG === 'function') LOG('SAFETY: pregnancy/breastfeeding -> deficit disabled, target=maintenance (' + _pgTarget + ' kcal). Refer to physician.');
    return _pgTarget;
  }
  const diff = DE.target - DE.weight;
  const weeklyRate = parseFloat(document.getElementById('inp-weekly-rate')?.value) || 0.5;

  // ── HOTFIX P2 — HARD CALORIE FLOOR ────────────────────────────────
  // Numeric clamp applied to ALL return values in this function.
  // Female minimum: 1200 kcal. Male minimum: 1400 kcal.
  // Exception: BMI ≥ 40 AND medically-supervised flag - floor bypassed.
  const lbm = calcLBM();
  const _p2Floor = (DE.gender === 'أنثى' || lbm < 50) ? 1200 : 1400;
  const _p2Bmi   = DE.weight / ((DE.height / 100) ** 2);
  const _p2MedSupervised = DE.medSupervised === true || DE.medSupervised === 'true';
  const _p2AggressiveObesityException = _p2Bmi >= 40 && _p2MedSupervised;
  const _p2ApplyFloor = (raw) => {
    if (_p2AggressiveObesityException) return Math.round(raw); // exception: supervised obesity protocol
    const clamped = Math.max(_p2Floor, Math.round(raw));
    if (clamped !== Math.round(raw)) {
      LOG(`HOTFIX-P2: Calorie floor applied — ${Math.round(raw)} kcal - ${clamped} kcal (floor=${_p2Floor}, gender=${DE.gender})`);
      // ── Surface to results for visible user warning ──
      DE._calorieFloorApplied = true;
      DE._calorieFloorFrom    = Math.round(raw);
      DE._calorieFloorTo      = clamped;
    } else {
      DE._calorieFloorApplied = false;
    }
    return clamped;
  };

  if (DE.goal === 'bulk') {
    // ── GAIN ENGINE: lean muscle gain vs mass differ ONLY in surplus size ──
    // 'lean' (زيادة عضلية): clean surplus ~5-8% TDEE, clamped 120–350/day
    // - slow gain (~0.25-0.4 kg/wk) = mostly muscle, minimal fat.
    // 'mass'  (ضخامة): larger surplus, rate-driven, clamped 300–700/day.
    // 1 kg ≈ 7700 kcal. daily surplus from weekly rate = rate * 7700 / 7.
    const _gainStyle = DE.gainStyle || (document.getElementById('inp-gain-style')?.value) || 'lean';
    const weeklyRateBulk = parseFloat(document.getElementById('inp-weekly-rate')?.value) || 0.5;
    const rateSurplus = Math.round(weeklyRateBulk * 7700 / 7);
    let bulkSurplus;
    if (_gainStyle === 'lean') {
      bulkSurplus = Math.min(350, Math.max(120, rateSurplus));
    } else {
      bulkSurplus = Math.min(700, Math.max(300, rateSurplus));
    }
    return _p2ApplyFloor(tdee + bulkSurplus);
  }

  if (diff > 5 && DE.goal !== 'cut' && DE.goal !== 'recomp') {
    return _p2ApplyFloor(tdee + 300); // lean bulk for target significantly higher
  }

  if (DE.goal === 'cut') {
    const deficit = calcAdaptiveDeficit(tdee);
    // Cut floor already checked but now enforced via _p2ApplyFloor
    return _p2ApplyFloor(tdee - deficit);
  }

  if (DE.goal === 'recomp') {
    // Recomp: very mild deficit ~100-200 kcal — preserves muscle, slow fat loss
    const bf = estimateBodyFat();
    const recompDeficit = bf > 25 ? 200 : 100;
    return _p2ApplyFloor(tdee - recompDeficit);
  }

  return _p2ApplyFloor(tdee); // maintain
}

// ── Smart Protein Calculation based on LBM + Goal + Activity ──
function calcProteinTarget(cals) {
  const lbm = calcLBM();
  const bf  = estimateBodyFat();
  const trainDays = parseFloat(document.getElementById('inp-train-days')?.value) || 0;

  // Protein per kg LBM (most precise method)
  let protPerKgLBM;

  if (DE.goal === 'cut') {
    // ── [FIX-PROTEIN-1] Evidence-corrected BF-stratified protein targets ──────
    // Source: Helms 2014, Morton 2018, Barakat 2020, Huovinen 2015
    // Rationale: higher BF = greater caloric availability from fat oxidation
    // - reduced reliance on protein catabolism - lower g/kg LBM needed.
    // Previous values (2.2–2.4 at high BF) were designed for lean athletes
    // and caused systematic over-prescription at BF > 20%.
    // Corrected ranges are still within the evidence range (1.6–3.1 g/kg LBM);
    // they simply use the lower end of that range where physiology supports it.
    if      (bf < 12 && trainDays >= 4) protPerKgLBM = 2.8;  // lean competitor — unchanged
    else if (bf < 15)                   protPerKgLBM = 2.6;  // lean — unchanged
    else if (bf < 20)                   protPerKgLBM = 2.2;  // moderate — was 2.4
    else if (bf < 30)                   protPerKgLBM = 1.9;  // high BF — was 2.2 (over-prescribed)
    else                                protPerKgLBM = 1.7;  // obese — new bracket, was missing
    LOG(`[FIX-P1]: BF=${bf.toFixed(1)}% - protPerKgLBM=${protPerKgLBM} (corrected brackets)`);

    // ── [TVM] Training Volume Modifier ──────────────────────────
    // Evidence: Helms 2014 meta-analysis — higher training volume
    // increases MPS demand and amino acid oxidation - small upward
    // adjustment justified. Applied AFTER bracket selection so it
    // layers onto the already BF-corrected base, not independently.
    // Volume classification:
    //   high:     ≥5 days/wk OR sessions marked high-intensity
    //   moderate: 3–4 days/wk
    //   low:      ≤2 days/wk (default, no modifier)
    // Modifiers are deliberately conservative (+0.05/+0.10 g/kg LBM)
    // and are always subject to the FIX-P2 sanity cap downstream.
    // FIX-P2 acts as the absolute ceiling regardless of TVM output.
    (function _applyTrainingVolumeModifier() {
      const _tvDays  = trainDays;
      let   _tvMod   = 0;
      let   _tvLabel = 'low';
      if (_tvDays >= 5)      { _tvMod = 0.10; _tvLabel = 'high';     }
      else if (_tvDays >= 3) { _tvMod = 0.05; _tvLabel = 'moderate'; }
      // low (≤2 days): no modifier — base bracket already conservative enough

      if (_tvMod > 0) {
        const _prevRate = protPerKgLBM;
        // Hard ceiling for TVM: never push above 3.1 g/kg LBM (absolute evidence max)
        protPerKgLBM = Math.min(parseFloat((protPerKgLBM + _tvMod).toFixed(2)), 3.1);
        LOG(`[TVM]: trainDays=${_tvDays} (${_tvLabel} volume) - +${_tvMod} g/kg - ${_prevRate} - ${protPerKgLBM} g/kg LBM`);
      }
    })();

    // ── PHYSIOLOGY C1: Prolonged Cut Protein Escalation ─────────
    // Evidence: Helms et al. 2014, Barakat et al. 2020 — protein needs
    // rise as diet extends because: (a) glycogen depletion increases amino
    // acid oxidation, (b) muscle protein synthesis efficiency declines,
    // (c) adaptive thermogenesis increases reliance on protein catabolism.
    // Week 9+: escalate toward upper evidence ceiling (3.1 g/kg LBM)
    const cutWeek = (typeof DE !== 'undefined' && DE.currentWeek) ? DE.currentWeek : 1;
    if (cutWeek >= 9 && bf < 25) {
      // Scale from current toward 3.1 g/kg over weeks 9–16
      const escalation = Math.min((cutWeek - 8) * 0.05, 0.30); // max +0.30 g/kg
      protPerKgLBM = Math.min(protPerKgLBM + escalation, 3.1);
      LOG(`PhysioC1: Week ${cutWeek} prolonged cut — protein escalated to ${protPerKgLBM.toFixed(2)} g/kg LBM`);
    }

    // ── PHYSIOLOGY C2: Very-Lean Athlete Protection ──────────────
    // Evidence: Maestu et al. 2010, Mäestu et al. 2010 — lean competitors
    // (BF <12% M / <20% F) lose disproportionate LBM even at moderate deficits.
    // Push to 3.0 g/kg LBM minimum when lean + training ≥4d.
    if (bf < (DE.gender === 'ذكر' ? 12 : 20) && trainDays >= 4) {
      protPerKgLBM = Math.max(protPerKgLBM, 3.0);
      LOG(`PhysioC2: Very-lean athlete — protein floor raised to 3.0 g/kg LBM`);
    }
  } else if (DE.goal === 'bulk') {
    // v44: gainStyle-aware protein (Schoenfeld 2018, ISSN 2017)
    const _gs = DE.gainStyle || (document.getElementById('inp-gain-style')?.value) || 'lean';
    if (_gs === 'lean') { protPerKgLBM = trainDays >= 4 ? 2.4 : 2.2; }
    else               { protPerKgLBM = trainDays >= 5 ? 2.2 : 2.0; }
    LOG(`PROT-BULK-v44: gainStyle=${_gs} - ${protPerKgLBM} g/kg LBM`);
  } else if (DE.goal === 'recomp') {
    // v45-NUT3: BF-stratified recomp protein (same logic as cut)
    // High BF - fat oxidation covers more energy - less protein catabolism risk
    const _reconBF = estimateBodyFat();
    if      (_reconBF < 15) protPerKgLBM = 2.6;
    else if (_reconBF < 25) protPerKgLBM = 2.3;
    else if (_reconBF < 35) protPerKgLBM = 2.0;
    else                    protPerKgLBM = 1.8;
    LOG(`PROT-RECOMP-v45: BF=${_reconBF.toFixed(1)}% - ${protPerKgLBM} g/kg LBM`);
  } else {
    // Maintain: 1.6–2.0 g/kg LBM
    protPerKgLBM = 1.8;
  }

  // Health overrides
  if (DE.healthConditions.includes('kidney')) {
    // ── PATCH 2 — Kidney protein: IBW-based cap for obese CKD users ──
    // KDIGO/KDOQI guidelines: protein is prescribed per IBW, not actual
    // weight, when the patient is obese. Using actual weight for an obese
    // CKD user over-prescribes protein and stresses impaired kidneys.
    // IBW (Devine formula): Male = 50 + 2.3*(height_cm/2.54 - 60)
    //                       Female = 45.5 + 2.3*(height_cm/2.54 - 60)
    const heightIn = DE.height / 2.54;
    const ibwBase  = DE.gender === 'ذكر' ? 50 : 45.5;
    const ibw      = Math.max(30, ibwBase + 2.3 * (heightIn - 60)); // floor 30 kg safety
    // Use IBW when the user is obese (actual weight > IBW * 1.2); else use actual weight
    const refWeight = DE.weight > ibw * 1.2 ? ibw : DE.weight;
    // CKD stage not known — conservative cap: 0.8 g/kg IBW (KDOQI non-dialysis)
    return Math.round(refWeight * 0.8);
  }

  // Anemia: adequate protein for hemoglobin synthesis
  if (DE.healthConditions.includes('anemia')) protPerKgLBM = Math.max(protPerKgLBM, 2.0);

  const proteinGrams = Math.round(lbm * protPerKgLBM);

  // ── [STABILITY-LOCK v2] Hybrid protein floor ──────────────────────
  // Problem with static weight×0.8: obese sedentary user at 150kg - 
  //   floor = 120g, but LBM ≈ 67kg - 120g = 1.79 g/kg LBM which is
  //   ABOVE the evidence target for their BF class (1.7 g/kg).
  //   The floor was inflating protein for obese users, exactly what
  //   FIX-PROTEIN-1 was designed to avoid.
  // Solution: hybrid of LBM-based floor + obesity-class modifier
  //   Class I  (BF 30–35%): floor = max(60g, LBM×1.2)
  //   Class II (BF 35–40%): floor = max(60g, LBM×1.1)
  //   Class III (BF >40%):  floor = max(60g, LBM×1.0) - conservative
  //   Non-obese (BF <30%):  floor = max(60g, weight×0.8) — original logic
  //   All classes: calorie guard — floor never > 30% of cals
  // Evidence: Phillips 2016 — protein floor in obesity should reference
  //   LBM not TBW to avoid over-prescription.
  const _bf = estimateBodyFat();
  let absFloor;
  if (_bf >= 40) {
    absFloor = Math.max(60, Math.round(lbm * 1.0));  // Class III obese
  } else if (_bf >= 35) {
    absFloor = Math.max(60, Math.round(lbm * 1.1));  // Class II obese
  } else if (_bf >= 30) {
    absFloor = Math.max(60, Math.round(lbm * 1.2));  // Class I obese
  } else {
    absFloor = Math.max(60, Math.round(DE.weight * 0.8)); // non-obese — TBW reference
  }
  // Calorie guard: floor must not push protein above 30% of cals
  const _floorCalCap = Math.round(cals * 0.30 / 4);
  absFloor = Math.min(absFloor, _floorCalCap);

  // Calorie cap: protein total should not exceed 40% of calories
  const maxProteinCals = cals * 0.40;
  return Math.min(Math.max(proteinGrams, absFloor), Math.round(maxProteinCals / 4));
}

// ── Smart Carb Distribution based on Activity + Goal ──────────
function calcCarbsTarget(cals, proteinG, fatG) {
  // Remaining calories after protein and fat - carbs
  const remaining = cals - (proteinG * 4) - (fatG * 9);
  return Math.max(20, Math.round(remaining / 4));
}

// ── Smart Fat Minimum (hormonal health floor) ──────────────────
function calcFatTarget(cals, proteinG) {
  const lbm = calcLBM();
  const diet = DE.selectedDiet || 'balanced';

  // ── [STABILITY-LOCK v2] Fat floor — dynamic calorie-aware hormonal safety ──
  // Evidence: Hamalainen 1984, Volek 1997, Talbott 2007, Thomas 2016 (RED-S)
  // Problem with static 1.0 g/kg female floor:
  //   At aggressive deficits (1200–1500 kcal), fat floor can consume
  //   55–75% of calorie budget - collapses carbs - kills performance.
  //   Example: 60kg female 1200 kcal - floor=60g fat=540 kcal=45%
  //            leaves only 660 kcal for protein+carbs - unsustainable.
  // Solution: dynamic floor scales with calorie budget availability.
  //   Tier 1 (≥1600 kcal): full 1.0 g/kg — hormonal safety intact
  //   Tier 2 (1400–1599 kcal): 0.85 g/kg — slight relaxation, still safe
  //   Tier 3 (<1400 kcal): 0.75 g/kg — minimum viable, RED-S risk flag
  //   Hard absolute minimum: max(45g, 20% of cals) — never less than this
  // Male: 0.7 g/kg unchanged — less sensitive to low-fat due to androgen
  //   synthesis relying less on adipose than female estrogen pathway.
  const isFemale = DE.gender === 'أنثى';
  let minFat;
  if (isFemale) {
    // Dynamic female floor — calorie-tiered
    const _femFatRate = cals >= 1600 ? 1.00
                      : cals >= 1400 ? 0.85
                      :                0.75;
    const _femFatCalc = Math.round(DE.weight * _femFatRate);
    // Hard absolute: fat must be ≥ 20% of cals (functional minimum)
    const _femFatPctMin = Math.round(cals * 0.20 / 9);
    minFat = Math.max(_femFatCalc, _femFatPctMin, 45);
    // Soft ceiling: floor must not exceed 35% of cals (would collapse carbs)
    const _femFatCeiling = Math.round(cals * 0.35 / 9);
    if (minFat > _femFatCeiling) {
      LOG(`[FAT-FLOOR-F]: floor ${minFat}g exceeds 35% ceiling ${_femFatCeiling}g - clamped (cals=${cals})`);
      minFat = _femFatCeiling;
    }
    LOG(`[FAT-FLOOR-F]: cals=${cals} rate=${_femFatRate}g/kg - floor=${minFat}g`);
  } else {
    minFat = Math.round(DE.weight * 0.7); // male androgens floor: 0.7 g/kg BW — unchanged
  }

  let fatG;
  if (['keto','carnivore'].includes(diet)) {
    // Keto: fat fills remaining calories after protein
    const remainingCals = cals - (proteinG * 4);
    fatG = Math.round(remainingCals * 0.75 / 9); // 75% of remaining as fat
  } else {
    // Non-keto: fat = 20-30% of total calories
    // ── GainStyle-aware fat %: lean gain - more carbs, mass - slightly higher fat
    // Lean 23%: frees carbs for muscle-glycogen replenishment (Burke 2017, Cholewa 2017)
    // Mass 27%: supports hormonal environment with larger caloric surplus
    const _fatGs = DE.gainStyle || (document.getElementById('inp-gain-style')?.value) || 'lean';
    // v45-NUT1: Female cut fat raised 22% - 25% (estrogen synthesis floor, RED-S prevention)
    const _isFemaleOnCut = (DE.goal === 'cut' && DE.gender === 'أنثى');
    const fatPct = _isFemaleOnCut        ? 0.25
                 : DE.goal === 'cut'     ? 0.22
                 : DE.goal === 'bulk'    ? (_fatGs === 'mass' ? 0.27 : 0.23)
                 : 0.25;
    fatG = Math.round((cals * fatPct) / 9);

    // ── PHYSIOLOGY D: Recovery-Supportive Fat Modulation ─────────
    // Evidence: Hamalainen et al. 1984, Volek et al. 1997 — high training
    // volume (≥5 days/wk) with low fat intake (<20% cals) suppresses
    // testosterone and elevates SHBG, impairing recovery and body comp.
    // Apply a small fat floor raise for high-frequency trainees.
    const _fatTrainDays = parseFloat(document.getElementById('inp-train-days')?.value) || 0;
    if (_fatTrainDays >= 5 && DE.goal !== 'bulk') {
      // Ensure fat ≥ 25% for recovery — not 22% cut default
      const recoveryFatMin = Math.round((cals * 0.25) / 9);
      if (fatG < recoveryFatMin) {
        fatG = recoveryFatMin;
        LOG(`PhysioD: High training volume — fat raised to 25% cals for recovery support`);
      }
    }
  }

  // ── Medical fat caps — applied AFTER minFat to enforce clinical limits ──
  // These conditions have evidence-based fat CEILINGS that override the
  // hormonal floor in the interest of clinical safety:
  //   cholesterol: <20% cals — hyperlipidemia management (AHA guidelines)
  //   fatty-liver: <22% cals — NAFLD fat reduction (EASL 2016 guidelines)
  // When medical cap < minFat: cap wins, but never below absolute minimum
  // (45g for females, 40g for males) to prevent clinical complications.
  const _absMinFatMedical = isFemale ? 45 : 40; // never go below this even for NAFLD/cholesterol
  let fatAfterFloor = Math.max(fatG, minFat);

  if (DE.healthConditions.includes('cholesterol')) {
    const _cholCap = Math.round((cals * 0.20) / 9);
    if (fatAfterFloor > _cholCap) {
      fatAfterFloor = Math.max(_cholCap, _absMinFatMedical);
      LOG(`[FAT-MEDICAL]: cholesterol cap ${Math.round(cals*0.20/9)}g applied — fat=${fatAfterFloor}g`);
    }
  }
  if (DE.healthConditions.includes('fatty-liver')) {
    const _naflCap = Math.round((cals * 0.22) / 9);
    if (fatAfterFloor > _naflCap) {
      fatAfterFloor = Math.max(_naflCap, _absMinFatMedical);
      LOG(`[FAT-MEDICAL]: NAFLD cap ${Math.round(cals*0.22/9)}g applied — fat=${fatAfterFloor}g`);
    }
  }

  return fatAfterFloor;
}

function calcMacros(cals, diet) {
  // Use LBM-based protein calculation
  let protein = calcProteinTarget(cals);

  // ── [FIX-PROTEIN-2] Hard sanity cap — prevents DWCP/WSL/PHL multipliers ──
  // from stacking on top of a value that was ALREADY calibrated for muscle
  // preservation. calcProteinTarget returns an LBM-based value; subsequent
  // layers (macroAdjustment × 1.20, PHL × 1.05) can compound it far beyond
  // the evidence ceiling.
  // Cap is applied HERE so it acts as a ceiling for ALL downstream layers.
  // Evidence ceiling per BF bracket (same logic as FIX-P1):
  //   BF < 15% - max 3.1 g/kg LBM  (lean athlete absolute ceiling, Helms 2014)
  //   BF 15-25% - max 2.4 g/kg LBM
  //   BF > 25% - max 2.0 g/kg LBM  (high BF — fat oxidation reduces catabolism risk)
  (function _fixP2_proteinSanityCap() {
    try {
      const _capLBM = calcLBM();
      const _capBF  = estimateBodyFat();
      const _capPerKg = _capBF < 15 ? 3.1 : _capBF < 25 ? 2.4 : 2.0;
      const _hardCap  = Math.round(_capLBM * _capPerKg);
      if (protein > _hardCap) {
        LOG(`[FIX-P2]: protein hard cap — ${protein}g - ${_hardCap}g (BF=${_capBF.toFixed(1)}%, max=${_capPerKg}g/kg LBM=${_capLBM.toFixed(1)}kg)`);
        protein = _hardCap;
      }
    } catch(e) { LOG('[FIX-P2]: sanity cap error: ' + e.message); }
  })();

  // ── GAP-7: Sleep adjustment — Ghrelin/Leptin/Protein catabolism ──────────
  // Evidence: Spiegel 2004, Taheri 2004 — sleep deprivation <6h raises Ghrelin 28%,
  // lowers Leptin 18%, increases muscle catabolism and insulin resistance.
  // Practical response: increase protein target to compensate for catabolism.
  const _sleepHrs = parseFloat(document.getElementById('inp-sleep')?.value) || 7;
  DE.sleepHours = _sleepHrs; // store for later use in tips
  if (_sleepHrs < 6) {
    const _sleepProteinBoost = Math.round(protein * 0.07); // +7% protein to counter catabolism
    protein = protein + _sleepProteinBoost;
    LOG(`GAP-7: Sleep deprivation (${_sleepHrs}h) — protein boosted +${_sleepProteinBoost}g to counter catabolism`);
  }

  let   fat     = calcFatTarget(cals, protein);
  // ── v53: Mediterranean — olive-oil-forward healthy fats (~30-35% cals) ──
  // unless a medical fat ceiling applies (cholesterol/fatty-liver are already
  // capped inside calcFatTarget — never override those clinical limits).
  if (diet === 'mediterranean' &&
      !DE.healthConditions.includes('cholesterol') &&
      !DE.healthConditions.includes('fatty-liver')) {
    const _medFatMin = Math.round((cals * 0.30) / 9);
    if (fat < _medFatMin) fat = _medFatMin;
  }
  let   carbs   = calcCarbsTarget(cals, protein, fat);

  // ── HEALTH OVERRIDES ON CARBS ──────────────────────────────────
  // Diabetes / Insulin resistance: cap carbs at 45% and prefer complex sources
  if (DE.healthConditions.includes('diabetes') || DE.healthConditions.includes('insulin')) {
    const maxDiabetesCarbs = Math.round((cals * 0.40) / 4); // max 40% of cals as carb
    if (carbs > maxDiabetesCarbs) {
      carbs = maxDiabetesCarbs;
    }
  }

  // IBS: slightly reduce high-fiber complex carbs if problem present — handled in food filter
  // Kidney: protein already capped in calcProteinTarget — no carb change needed

  // GOUT: no special carb restriction needed
  // BP: no special carb restriction, but ensure we don't go too low (need fiber for potassium)
  // ── BP-LOWCARB GUARD (additive) ──────────────────────────────────────────
  // Problem: the 40% carb floor conflicts with lowcarb/keto philosophy.
  // Fix: only apply the floor when the user is NOT on a low-carb diet.
  // When bp + lowcarb/keto: BP is managed via potassium-rich foods + sodium
  // control in the scoring layer (BP_LOWCARB_DASH_SCORING below) instead.
  if (DE.healthConditions.includes('bp')) {
    const _bpDietIsLowCarb = ['lowcarb','keto','carnivore'].includes(diet);
    if (!_bpDietIsLowCarb) {
      const minBpCarbs = Math.round((cals * 0.40) / 4); // ensure adequate carbs for fiber/potassium
      carbs = Math.max(carbs, minBpCarbs);
      LOG('BP-guard: carb floor 40% applied (balanced/carbcycle diet)');
    } else {
      LOG(`BP-guard: carb floor SKIPPED — diet=${diet}; BP managed via DASH food scoring`);
    }
  }
  // ── END BP-LOWCARB GUARD ─────────────────────────────────────────────────

  // PCOS: lower carb helps — similar to insulin
  if (DE.healthConditions.includes('pcos') && !['keto','lowcarb'].includes(diet)) {
    const maxPCOSCarbs = Math.round((cals * 0.38) / 4);
    carbs = Math.min(carbs, maxPCOSCarbs);
  }

  // Fatty liver: reduce refined carb contribution (macros level: limit to 40%)
  if (DE.healthConditions.includes('fatty-liver')) {
    const maxFLCarbs = Math.round((cals * 0.40) / 4);
    carbs = Math.min(carbs, maxFLCarbs);
  }

  // Diet-specific carb override for very low carb diets
  if (diet === 'keto') {
    const ketoCarbs = Math.min(carbs, 40);
    // ── PATCH B1-a: keto fat reconciliation ─────────────────────────
    // protein+carb budget may exceed cals at low calorie targets;
    // cap fat at budget remainder, then apply absolute floor 50g.
    const ketoBudgetRemaining = cals - protein * 4 - ketoCarbs * 4;
    const ketoFatRaw  = Math.round(ketoBudgetRemaining / 9);
    const ketoFatSafe = Math.max(ketoFatRaw, 50);
    // If even 50g fat overflows, reconcile protein downward (preserve carb ceiling)
    const ketoTotalCheck = protein * 4 + ketoCarbs * 4 + ketoFatSafe * 9;
    if (ketoTotalCheck > cals * 1.05) {
      const ketoProteinAdj = Math.max(50, Math.round((cals - ketoCarbs * 4 - ketoFatSafe * 9) / 4));
      LOG(`PatchB1-keto: macro overflow reconciled — protein ${protein} - ${ketoProteinAdj}g`);
      return { protein: ketoProteinAdj, carbs: ketoCarbs, fat: ketoFatSafe };
    }
    return { protein, carbs: ketoCarbs, fat: ketoFatSafe };
  }
  if (diet === 'carnivore') {
    const carnoCarbs = Math.min(carbs, 10);
    // ── PATCH B1-b: carnivore fat reconciliation ────────────────────
    const carnoBudgetRemaining = cals - protein * 4 - carnoCarbs * 4;
    const carnoFatRaw  = Math.round(carnoBudgetRemaining / 9);
    const carnoFatSafe = Math.max(carnoFatRaw, 50);
    const carnoTotalCheck = protein * 4 + carnoCarbs * 4 + carnoFatSafe * 9;
    if (carnoTotalCheck > cals * 1.05) {
      const carnoProteinAdj = Math.max(50, Math.round((cals - carnoCarbs * 4 - carnoFatSafe * 9) / 4));
      LOG(`PatchB1-carnivore: macro overflow reconciled — protein ${protein} - ${carnoProteinAdj}g`);
      return { protein: carnoProteinAdj, carbs: carnoCarbs, fat: carnoFatSafe };
    }
    return { protein, carbs: carnoCarbs, fat: carnoFatSafe };
  }

  // ── HOTFIX P1 — CKD DAILY PROTEIN HARD CAP ──────────────────────
  // Applied BEFORE reconciliation. Enforces 0.6–0.8 g/kg IBW ceiling
  // for kidney users per KDIGO/KDOQI non-dialysis guidelines.
  // calcProteinTarget() already handles the direct return path; this
  // guard catches any downstream recalculation that bypasses it.
  if (DE.healthConditions.includes('kidney')) {
    const _p1HeightIn = DE.height / 2.54;
    const _p1IbwBase  = DE.gender === 'أنثى' ? 45.5 : 50;
    const _p1Ibw      = Math.max(30, _p1IbwBase + 2.3 * (_p1HeightIn - 60));
    const _p1RefW     = DE.weight > _p1Ibw * 1.2 ? _p1Ibw : DE.weight;
    const _p1ProteinCap = Math.round(_p1RefW * 0.8); // 0.8 g/kg IBW — KDOQI ceiling
    if (protein > _p1ProteinCap) {
      LOG(`HOTFIX-P1: CKD protein clamped ${protein}g - ${_p1ProteinCap}g (0.8g/kg IBW=${_p1Ibw.toFixed(1)}kg refW=${_p1RefW.toFixed(1)}kg)`);
      protein = _p1ProteinCap;
      // Re-derive carbs from freed calories; preserve fat floor
      carbs = Math.max(20, Math.round((cals - protein * 4 - fat * 9) / 4));
    }
  }

  // ── PATCH B1-c: STRICT CALORIE RECONCILIATION LAYER ──────────────
  // Runs AFTER all floors and health overrides.
  // Priority: protein floors > fat hormonal floor > carbs.
  // If protein+fat already exceed cals, scale fat down first,
  // never below absolute hormonal minimum (0.5g/kg body weight).
  // This fixes: obese fat-floor overflow, BP-carb vs ratio conflict.
  (function reconcileMacros() {
    // ── NaN guard: if cals is invalid, clamp to safe floor and rebuild ──
    if (!isFinite(cals) || cals < 100) {
      const safeFloor = (DE.gender === 'أنثى') ? 1200 : 1400;
      cals   = safeFloor;
      fat    = Math.max(fat,   isFinite(fat)   ? fat   : Math.round(DE.weight * 0.7));
      protein= Math.max(protein, isFinite(protein) ? protein : Math.round((DE.weight || 70) * 1.6));
      carbs  = Math.max(20, Math.round((cals - protein * 4 - fat * 9) / 4));
      LOG(`PatchB1-NaN: invalid cals - clamped to ${cals} kcal, rebuilt macros`);
      return;
    }
    const absMinFatG  = Math.max(20, Math.round((DE.weight || 70) * 0.5)); // absolute hormonal floor
    const proteinCals = protein * 4;
    const fatCals     = fat * 9;
    const carbCals    = carbs * 4;
    const totalUsed   = proteinCals + fatCals + carbCals;

    if (totalUsed <= cals * 1.05) return; // within 5% — no action needed

    // Step 1: reduce fat first (not below absMinFat)
    const budgetAfterProtein = cals - proteinCals;
    if (budgetAfterProtein < absMinFatG * 9) {
      // Protein alone exceeds budget — protein is medically fixed; accept overflow
      // but minimise fat and carb damage
      fat   = absMinFatG;
      carbs = Math.max(0, Math.round((cals - proteinCals - absMinFatG * 9) / 4));
      LOG(`PatchB1: severe overflow (protein floor) — fat=${fat}g carbs=${carbs}g (cals budget: ${cals})`);
      return;
    }
    // Allocate fat: up to 35% of cals, never below absMinFat
    const fatFromBudget = Math.round(Math.min(budgetAfterProtein * 0.35, fat * 9) / 9);
    fat   = Math.max(fatFromBudget, absMinFatG);
    carbs = Math.max(0, Math.round((cals - proteinCals - fat * 9) / 4));
    // Final NaN safety net
    if (!isFinite(fat))   fat   = absMinFatG;
    if (!isFinite(carbs)) carbs = 20;
    LOG(`PatchB1: overflow reconciled — fat=${fat}g carbs=${carbs}g (target: ${cals} kcal)`);

    // ── PATCH 1 START: Medical Constraints Starvation Prevention ─────────
    // When severe multi-constraint stacking (e.g. kidney protein cap +
    // cholesterol fat cap + keto carb cap) collapses total allocated macros
    // below 92% of target budget, release the carb cap to restore energy.
    // Threshold is 0.92 (not 0.85) because carb caps alone (keto=40g,
    // lowcarb=100g) can silently remove 8-12% of budget in low-cal profiles.
    const emergencyCals = (protein * 4) + (carbs * 4) + (fat * 9);
    if (emergencyCals < cals * 0.92) {
      carbs = Math.round((cals - (protein * 4) - (fat * 9)) / 4);
      if (!isFinite(carbs) || carbs < 0) carbs = 0;
      LOG('HOTFIX-MEDICAL: Impossible macro constraints detected. Carb cap released to prevent starvation');
    }
    // ── PATCH 1 END ────────────────────────────────────────────────────────
  })();

  return { protein, carbs, fat };
}
function isBulkScenario() {
  // FIX: Only use explicit user goal — don't auto-infer bulk from target weight diff
  // (old code: DE.target - DE.weight > 5 could silently switch maintain - bulk)
  return DE.goal === 'bulk';
}

// ── Weekly Rate UI ─────────────────────────────────────────────
function selWeeklyRate(btn, val) {
  document.querySelectorAll('#rate-btns .choice-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('inp-weekly-rate').value = val;
  const dailyAmount = Math.round((val * 7700) / 7);
  const isBulk = (document.getElementById('inp-goal')?.value === 'bulk') || (DE && DE.goal === 'bulk');
  // ── GainStyle-aware hints: lean shows ACTUAL capped surplus for transparency ──
  const _srGs = isBulk ? (DE?.gainStyle || document.getElementById('inp-gain-style')?.value || 'lean') : null;
  const _leanActual = Math.min(350, Math.max(120, Math.round((val * 7700) / 7)));

  const hints = !isBulk ? {
    // CUT — unchanged
    0.25: `عجز يومي ~${dailyAmount} سعرة — نزول ناعم جدا، حماية عضل ممتازة. الأفضل لأصحاب الوزن القريب من الهدف`,
    0.5:  `عجز يومي ~${dailyAmount} سعرة — معيار ذهبي للحفاظ على العضل مع فقد دهون فعال`,
    0.75: `عجز يومي ~${dailyAmount} سعرة — سريع نسبيا، يحتاج بروتين عالي وتمرين منتظم لحماية العضل`,
    1.0:  `عجز يومي ~${dailyAmount} سعرة — أقصى معدل موصى به. يحتاج نسبة دهون ≥20% ومتابعة دقيقة`
  } : _srGs === 'lean' ? {
    // LEAN GAIN — show ACTUAL capped surplus so user understands the cap
    0.25: `فائض فعلي ~${_leanActual} سعرة/يوم (~${(_leanActual*7/7700).toFixed(2)}كجم/أسبوع) — زيادة عضلية ناعمة نظيفة`,
    0.5:  `فائض فعلي ~${_leanActual} سعرة/يوم (~${(_leanActual*7/7700).toFixed(2)}كجم/أسبوع) — الحد الأمثل للزيادة العضلية النظيفة`,
    0.75: `فائض فعلي ~${_leanActual} سعرة/يوم — محدود بالسقف الأمني (عمليا يعادل 0.5)`,
    1.0:  `فائض فعلي ~${_leanActual} سعرة/يوم — محدود بالسقف الأمني (عمليا يعادل 0.5)`
  } : {
    // MASS (ضخامة)
    0.25: `فائض يومي ~${dailyAmount} سعرة — ضخامة ناعمة، نسبة عضل/دهون أفضل`,
    0.5:  `فائض يومي ~${dailyAmount} سعرة — معيار ذهبي للضخامة الذكية مع بروتين عالي`,
    0.75: `فائض يومي ~${dailyAmount} سعرة — ضخامة سريعة نسبيا، يحتاج تمرين مقاومة منتظم`,
    1.0:  `فائض يومي ~${dailyAmount} سعرة — ضخامة قوية، مناسبة للمبتدئين أو بعد توقف طويل`
  };
  document.getElementById('rate-hint').textContent = hints[val] || '';
  // ── BF% safety check: warn if cut at max rate with low body fat ──
  if (!isBulk && val === 1.0) {
    const _bfVal = parseFloat(document.getElementById('inp-bf')?.value) || 0;
    if (_bfVal > 0 && _bfVal < 15) {
      const _rh = document.getElementById('rate-hint');
      if (_rh) _rh.textContent += 'نسبة دهونك أقل من 15% — هذا المعدل يعرض عضلاتك لخطر حقيقي. نوصي ب0.25 أو 0.5 كجم/أسبوع بدلا من ذلك';
    }
  }
}

// ── Precision Section Toggle ───────────────────────────────────
function togglePrecision() {
  const body  = document.getElementById('precision-body');
  const arrow = document.getElementById('precision-arrow');
  const open  = body.style.display === 'block';
  body.style.display  = open ? 'none' : 'block';
  arrow.textContent   = open ? '▼' : '▲';
  // Show hip field for females
  if (!open && DE.gender === 'أنثى') {
    document.getElementById('precision-hip-wrap').style.display = 'block';
  }
}

function onPrecisionChange() {
  const bf    = parseFloat(document.getElementById('inp-bf')?.value);
  const waist = parseFloat(document.getElementById('inp-waist')?.value);
  const neck  = parseFloat(document.getElementById('inp-neck')?.value);
  const res   = document.getElementById('precision-result');
  const txt   = document.getElementById('precision-result-text');

  if (!res || !txt) return;

  const parts = [];
  if (bf >= 3 && bf <= 60) {
    parts.push(`نسبة الدهون المدخلة: <strong>${bf}%</strong>`);
    const lbm = +(DE.weight * (1 - bf/100)).toFixed(1);
    parts.push(`الكتلة العضلية (LBM): <strong>${lbm} كجم</strong>`);
  } else if (waist > 0 && neck > 0) {
    const bfCalc = estimateBodyFat();
    const lbm = +(DE.weight * (1 - bfCalc/100)).toFixed(1);
    parts.push(`نسبة الدهون (Navy Formula): <strong>${bfCalc}%</strong>`);
    parts.push(`الكتلة العضلية (LBM): <strong>${lbm} كجم</strong>`);
  }

  if (parts.length) {
    txt.innerHTML = parts.join(' · ');
    res.style.display = 'flex';
  } else {
    res.style.display = 'none';
  }
}

// Update hip field visibility when gender changes
const _origSelectGender = selectGender;
function selectGenderExtended(btn, val) {
  selectGender(btn, val);
  const hipWrap = document.getElementById('precision-hip-wrap');
  if (hipWrap) hipWrap.style.display = val === 'أنثى' ? 'block' : 'none';
}
