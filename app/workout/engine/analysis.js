// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANALYSIS ENGINE — engine/analysis.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function calcBMI(w,h){return w/((h/100)**2);}
function getBMICat(bmi){if(bmi<18.5)return'نحيف';if(bmi<25)return'طبيعي';if(bmi<30)return'زيادة وزن';return'سمنة';}
function calcTDEE(w,h,age,gender,daily){
  let bmr=gender==='male'?10*w+6.25*h-5*age+5:10*w+6.25*h-5*age-161;
  // FIX-1: 5-level activity multipliers (ACSM/WHO standard)
  // sedentary=مكتبي, light=نشاط خفيف, moderate=معتدل, active=نشيط, veryActive=رياضي
  const m={sedentary:1.2,light:1.375,moderate:1.55,active:1.725,veryActive:1.9};
  return Math.round(bmr*(m[daily]||1.55));
}
function calcRecovery(){
  let s=100;
  if(state.sleep==='poor')s-=25;else if(state.sleep==='ok')s-=10;
  if(state.stress==='high')s-=20;else if(state.stress==='mid')s-=10;
  // FIX-6: 5-level daily activity impact on recovery
  if(state.daily==='veryActive')s-=18; // athlete/manual labor = major recovery demand
  else if(state.daily==='active')s-=10;
  else if(state.daily==='light')s-=3;  // light activity slightly reduces recovery cap
  // sedentary = no penalty (most recovery capacity)
  // SCI-FIX-1: Age penalty محكم بجودة النوم — Dattilo et al. 2011
  // النوم هو المحدد الرئيسي للتعافي بعد 40. الكود القديم أعطى penalty ثابتة
  // بغض النظر عن النوم — يعاقب من ينام جيدا وعمره 42 بنفس عقوبة من ينام سيئا
  const _sleepQ = state.sleep==='good' ? 1.0 : state.sleep==='ok' ? 0.7 : 0.45;
  const _age = state.age || 25;
  if(_age > 65)      s -= Math.round(20 * (1 - _sleepQ * 0.5));  // 65+: penalty 10-20
  else if(_age > 55) s -= Math.round(14 * (1 - _sleepQ * 0.4));  // 55-65: penalty 8-14
  else if(_age > 40) s -= Math.round(8  * (1 - _sleepQ * 0.35)); // 40-55: penalty 5-8
  // PATCH 6: Frequency safety cap — high training frequency limits effective recovery ceiling
  const d=state.days||3;
  if(d>=6) s=Math.min(s,82);  // 6 days: cap prevents Arnold on borderline recovery
  else if(d===5) s=Math.min(s,90); // 5 days: soft ceiling, preserves advanced eligibility
  return Math.max(30,s);
}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADVANCED SCORING SYSTEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function calcAdvancedScores(){
  const s=state;
  const recov = s.recoveryScore;
  let fatigueCap = 100;
  if(s.daily==='veryActive') fatigueCap -= 28; // FIX-7: veryActive = major fatigue competition
  else if(s.daily==='active') fatigueCap -= 20;
  else if(s.daily==='light')  fatigueCap -= 5;
  if(s.daily==='sedentary') fatigueCap += 5;
  if(s.stress==='high') fatigueCap -= 25;
  if(s.stress==='mid') fatigueCap -= 10;
  const hasInj = s.injuries && !s.injuries.includes('none') && s.injuries.length>0;
  if(hasInj) fatigueCap -= 15;
  if(s.age > 40) fatigueCap -= 10;
  if(s.age > 55) fatigueCap -= 10;
  fatigueCap = Math.max(20, Math.min(100, fatigueCap));
  let tolerance = 100;
  if(s.exp==='beginner') tolerance -= 40;
  if(s.exp==='intermediate') tolerance -= 15;
  if(s.sleep==='poor') tolerance -= 20;
  if(s.sleep==='ok') tolerance -= 8;
  if(s.stress==='high') tolerance -= 15;
  tolerance = Math.max(20, Math.min(100, tolerance));
  let volCap = 100;
  // SCI-FIX-2: إزالة التعاقب المزدوج على الوقت
  // الكود القديم: <45 دق يأخذ -20 و-15 = -35 إجمالا، ثم V3-04 يخفض MAX_EX مرة أخرى
  // الصحيح: عتبة واحدة متدرجة هنا، V3-04 يتحكم في MAX_EX/sets بشكل مستقل
  if(s.time < 40)      volCap -= 25; // جلسة ضيقة جدا
  else if(s.time < 60) volCap -= 12; // جلسة معيارية قصيرة
  // 60+ دق: لا penalty
  if(s.exp==='beginner') volCap -= 25;
  if(recov < 60) volCap -= 20;
  volCap = Math.max(20, Math.min(100, volCap));
  let abilityRecover = recov * 0.6 + tolerance * 0.4;
  abilityRecover = Math.max(20, Math.min(100, abilityRecover));
  state.fatigueCap = Math.round(fatigueCap);
  state.trainingTolerance = Math.round(tolerance);
  state.weeklyVolCap = Math.round(volCap);
  state.abilityRecover = Math.round(abilityRecover);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RECOVERY + SUSTAINABILITY + FATIGUE BALANCING LAYER
// ── Surgical modifier pass added on top of the existing engine ──
// This does NOT replace the scoring system.
// It computes a modifier map used as a late-stage tiebreaker.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function calcRecoveryModifiers(){
  const s = state;
  const r = s.recoveryScore || 70;
  const bmi = s.bmi || 22;
  const fc = s.fatigueCap || 80;
  const tol = s.trainingTolerance || 75;
  const g = s.goal;
  const e = s.exp;
  const d = s.days;

  // ── Base sustainability score: 0-100 ──────────────────────────────────
  // Combines recovery, fatigue ceiling, tolerance, and life-stress factors
  let sustainScore = r * 0.45 + fc * 0.30 + tol * 0.25;

  // ── BMI/load stress penalty ──────────────────────────────────────────
  // Obese users carry higher systemic load; recovery demand is greater
  let bmiPenalty = 0;
  if(bmi >= 35)       bmiPenalty = 18;  // severe obesity — significant load stress
  else if(bmi >= 30)  bmiPenalty = 10;  // obese — moderate load stress
  else if(bmi >= 27)  bmiPenalty = 4;   // overweight — mild load stress
  sustainScore -= bmiPenalty;

  // ── Sleep quality modifier ────────────────────────────────────────────
  if(s.sleep === 'poor')  sustainScore -= 14;
  else if(s.sleep === 'ok') sustainScore -= 5;
  // good sleep: no penalty

  // ── Lifestyle stress modifier ─────────────────────────────────────────
  if(s.stress === 'high') sustainScore -= 12;
  else if(s.stress === 'mid') sustainScore -= 5;

  // ── Daily activity: active lifestyle competes with training recovery ──
  if(s.daily === 'active') sustainScore -= 8;
  if(s.daily === 'sedentary') sustainScore += 3; // more recovery capacity

  // ── Age-based recovery ceiling ────────────────────────────────────────
  if(s.age > 55) sustainScore -= 14;
  else if(s.age > 45) sustainScore -= 8;
  else if(s.age > 40) sustainScore -= 4;

  // ── Goal-specific fatigue context ────────────────────────────────────
  // Cutting = caloric deficit = already-reduced recovery capacity
  let goalFatigueMod = 0;
  if(g === 'cut')      goalFatigueMod = -8;   // deficit impairs recovery
  else if(g === 'muscle') goalFatigueMod = +4; // surplus supports recovery
  else if(g === 'strength') goalFatigueMod = +2;
  sustainScore += goalFatigueMod;

  sustainScore = Math.max(0, Math.min(100, sustainScore));

  // ── Derive tier from sustainability score ────────────────────────────
  // tier 'high' - can handle complex/high-frequency systems
  // tier 'mid' - balanced systems preferred
  // tier 'low' - simple, recovery-first systems preferred
  // tier 'critical' - maximum recovery protection needed
  let sustainTier;
  if(sustainScore >= 72)      sustainTier = 'high';
  else if(sustainScore >= 52) sustainTier = 'mid';
  else if(sustainScore >= 35) sustainTier = 'low';
  else                        sustainTier = 'critical';

  // ── Split desirability modifiers: score delta applied on top of engine ──
  // Positive = recommend more, Negative = recommend less (used in override logic)
  const mods = {
    fullbody:          0,
    upper_lower:       0,
    ppl_3:             0,
    ppl:               0,
    brosplit:          0,
    arnold:            0,
    stronglifts:       0,
    hybrid:            0,
    anterior_posterior:0,
    ppl_weak:          0,
    torso_limbs:       0
  };

  // ── HIGH TIER: unlock performance systems normally ────────────────────
  if(sustainTier === 'high'){
    mods.brosplit   += 8;
    mods.arnold     += 6;
    mods.ppl        += 5;
    mods.hybrid     += 4;
    mods.ppl_weak   += 4;
  }

  // ── MID TIER: balanced + structured favored ───────────────────────────
  if(sustainTier === 'mid'){
    mods.upper_lower   += 8;
    mods.anterior_posterior += 6;
    mods.ppl_weak      += 4;
    mods.hybrid        += 3;
    mods.brosplit      -= 6;
    mods.arnold        -= 10;
  }

  // ── LOW TIER: recovery-first structures favored ───────────────────────
  if(sustainTier === 'low'){
    mods.fullbody          += 10;
    mods.upper_lower       += 8;
    mods.anterior_posterior += 8;
    mods.ppl_3             += 3;
    mods.stronglifts       += 3;
    mods.ppl               -= 6;
    mods.brosplit          -= 14;
    mods.arnold            -= 20;
    mods.hybrid            -= 5;
  }

  // ── CRITICAL TIER: maximum protection ────────────────────────────────
  if(sustainTier === 'critical'){
    mods.fullbody          += 18;
    mods.anterior_posterior += 14;
    mods.upper_lower       += 10;
    mods.stronglifts       += 5;
    mods.ppl               -= 12;
    mods.brosplit          -= 22;
    mods.arnold            -= 30;
    mods.hybrid            -= 10;
    mods.ppl_weak          -= 8;
  }

  // ── Goal-specific adjustments (additive, not replacement) ────────────
  // Cutting: prefer lower-volume, sustainable frequency structures
  if(g === 'cut'){
    mods.fullbody      += 4;
    mods.upper_lower   += 4;
    mods.anterior_posterior += 3;
    mods.brosplit      -= 5;
    mods.arnold        -= 8;
  }
  // Strength: prefer structured compound-first splits
  if(g === 'strength'){
    mods.stronglifts   += 6;
    mods.upper_lower   += 4;
    mods.ppl_weak      += 3;
  }
  // Muscle building: volume systems get a small boost only at high tier
  if(g === 'muscle' && sustainTier === 'high'){
    mods.ppl           += 4;
    mods.brosplit      += 5;
    mods.ppl_weak      += 4;
  }
  // Fitness/recomp: balanced structures
  if(g === 'fitness'){
    mods.upper_lower   += 5;
    mods.anterior_posterior += 5;
    mods.hybrid        += 3;
    mods.arnold        -= 6;
    mods.brosplit      -= 4;
  }

  // ── Beginner sustainability guard ─────────────────────────────────────
  // Beginners should never reach brosplit/arnold regardless of other signals
  if(e === 'beginner'){
    mods.brosplit  -= 30;
    mods.arnold    -= 30;
    mods.ppl       -= 10;
    mods.hybrid    -= 8;
    mods.fullbody  += 12;
    mods.upper_lower += 8;
  }

  // ── Obese-specific override ───────────────────────────────────────────
  // High BMI - high mechanical load stress - prefer lower systemic volume
  if(bmi >= 30){
    mods.arnold        -= 12;
    mods.brosplit      -= 8;
    mods.ppl           -= 4;
    mods.upper_lower   += 6;
    mods.anterior_posterior += 6;
    mods.fullbody      += 4;
  }

  // ── 4-day specific scoring: all three valid structures compete fairly ─────
  // على 4 أيام: upper_lower, anterior_posterior, ppl_weak كلهم قانونيون
  // نحيد التحيز الافتراضي ل upper_lower ونترك العوامل الفعلية تحكم
  if(d === 4){
    // ppl_weak على 4 أيام ذكي جدا (Push+Pull+Legs+WeakPoint) — يستحق تقييما عادلا
    if(e !== 'beginner') mods.ppl_weak += 5;
    // anterior_posterior ممتاز للتوازن والتعافي — يستحق منافسة حقيقية
    mods.anterior_posterior += 3;
    // torso_limbs (جذع/أطراف) — خيار 4 أيام مشروع، منافسة عادلة دون إزاحة الافتراضي
    if(e !== 'beginner') mods.torso_limbs += 4;
    // upper_lower baseline — لا boost إضافي، العوامل الأخرى تحكم
  }

  // ── Day-based structural guard ─────────────────────────────────────────
  // upper_lower = هيكل 4 أيام فقط — على 5+ أيام نلغي كل موديفاير حتى لا يفوز بال scoring
  if(d >= 5){
    mods.upper_lower = -999; // hard disqualify from scoring pool on 5+ days
  }

  // ── 5-day context: reward high-frequency systems for capable profiles ───
  // على 5 أيام، المتوسط والمتقدم ذوو التعافي الجيد يستفيدون أكثر من PPL/hybrid
  // anterior_posterior على 5 أيام = underutilization للمتقدم (هيكله 4 أيام بالأساس)
  if(d === 5){
    if(e === 'advanced' && r >= 65){
      mods.ppl   += 14; // PPL هو الأمثل للمتقدم على 5 أيام (P/P/L/P/P)
      mods.hybrid += 6;
      mods.anterior_posterior -= 8; // 4-day structure — أقل كفاءة على 5 أيام للمتقدم
    } else if(e === 'intermediate' && r >= 60){
      mods.hybrid += 8;
      mods.ppl    += 5;
      mods.anterior_posterior -= 4;
    }
  }

  // ── 3-day context: ppl_3 is the smart choice for int/adv on 3 days ─────
  // fullbody على 3 أيام للمتقدم = undertraining — ppl_3 يعطي تغطية أفضل
  if(d === 3){
    if(e === 'advanced' && r >= 55){
      mods.ppl_3    += 16; // PPL_3 هو الأمثل للمتقدم على 3 أيام
      mods.fullbody -= 6;
    } else if(e === 'intermediate' && r >= 50){
      mods.ppl_3    += 10;
      mods.fullbody -= 3;
    }
    // strength على 3 أيام: StrongLifts هو الملك
    if(g === 'strength'){
      mods.stronglifts += 15;
    }
  }

  // ── Home training: high-frequency systems less feasible ──────────────
  if(s.equip === 'home'){
    mods.brosplit  -= 8;
    mods.arnold    -= 10;
    mods.hybrid    -= 4;
    mods.upper_lower += 5;
    mods.fullbody  += 6;
  }

  // ── 6-day beginner extreme guard ─────────────────────────────────────
  // 6 available days does NOT mean 6 hard training days for beginners/poor recovery
  if(d >= 6 && e === 'beginner'){
    mods.upper_lower += 15;
    mods.fullbody    += 10;
    mods.anterior_posterior += 8;
  }
  if(d >= 6 && sustainTier === 'low'){
    mods.ppl         -= 8;
    mods.arnold      -= 15;
    mods.upper_lower += 8;
  }

  // Store for use in description generation
  state._sustainScore = Math.round(sustainScore);
  state._sustainTier  = sustainTier;
  state._splitMods    = mods;

  return { sustainScore, sustainTier, mods };
}

// ── Helper: apply modifier map to resolve a tiebreaker or soft override ──
// Given a candidate split from the base engine, check if a neighbour split
// has sufficiently higher modifier score to warrant a switch.
// Only overrides within the SAME eligibility class; never promotes ineligible splits.
function applyRecoveryModifierOverride(candidate, mods, d, e, r, g){
  const eligible = new Set();

  // Build the set of eligible splits for this profile (mirrors eligibility engine)
  if(d <= 2) eligible.add('fullbody');
  if(d === 3){
    eligible.add('fullbody');
    if(g === 'strength') eligible.add('stronglifts');
    if(e !== 'beginner') eligible.add('ppl_3');
  }
  if(d === 4){
    eligible.add('upper_lower');
    eligible.add('anterior_posterior');
    if(e !== 'beginner') eligible.add('ppl_weak');
    if(e !== 'beginner') eligible.add('torso_limbs');
  }
  if(d === 5){
    // upper_lower هيكل 4 أيام فقط — لا يدخل pool ال 5 أيام أبدا
    // anterior_posterior و ppl_weak = هيكل 4 أيام فقط — ممنوع على 5 أيام
    eligible.add('ppl');
    if(e !== 'beginner'){
      eligible.add('hybrid');
    }
    if(e === 'advanced') eligible.add('brosplit');
    if(g === 'strength') eligible.add('stronglifts');
  }
  if(d >= 6){
    eligible.add('ppl');
    // anterior_posterior = 4-5 days only — not valid on 6 days
    // hybrid = 5 days only — not valid on 6 days
    if(e === 'advanced'){
      eligible.add('brosplit');
      if(r >= 70) eligible.add('arnold');
    }
  }
  // Ensure candidate is in the pool — only if valid for this day count
  const SPLIT_VALID_DAYS = {
    fullbody:[2,3], ppl_3:[3], stronglifts:[3],
    upper_lower:[4], anterior_posterior:[4], ppl_weak:[4], torso_limbs:[4],
    ppl:[5,6], brosplit:[5], hybrid:[5], arnold:[6]
  };
  const candValid = SPLIT_VALID_DAYS[candidate];
  // Hard block: إذا كان ال candidate محجوزا لعدد أيام مختلف، لا يضاف لل eligible أبدا
  if(candValid && candValid.includes(d)) eligible.add(candidate);
  // إذا كان candidate غير معرف في الخريطة (split جديد)، يضاف للأمان
  if(!candValid) eligible.add(candidate);

  // Score each eligible split
  let bestSplit = candidate;
  let bestScore = mods[candidate] || 0;
  for(const s of eligible){
    const score = mods[s] || 0;
    // Override threshold: a competing split must be meaningfully better (+8 points)
    // to displace the base engine's pick. Lowered from 12 to allow real competition.
    if(score > bestScore + 8){
      bestScore = score;
      bestSplit = s;
    }
  }
  return bestSplit;
}

// Split recommendation/catalog functions live in engine/splits.js.
// analysis.js intentionally stops here to keep the engine single-source-of-truth.
