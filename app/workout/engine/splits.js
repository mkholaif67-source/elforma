// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SPLITS ENGINE — engine/splits.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getRecommendedSplit(){
  // calcAdvancedScores يتشغل من goStep2 قبل استدعاء هذه الدالة
  // ── Run the recovery/sustainability modifier pass ─────────────────────
  const { sustainTier, mods } = calcRecoveryModifiers();

  const d=state.days, e=state.exp, r=state.recoveryScore;
  const g=state.goal, inj=state.injuries||[];
  const hasInjury = inj.length>0 && !inj.includes('none');
  const tol=state.trainingTolerance;
  const isBeg=e==='beginner', isAdv=e==='advanced', isInt=e==='intermediate';
  const highRec=r>=70, midRec=r>=55, lowRec=r<55;

  // ── PATCH 1: INJURY-AWARE SPLIT PROTECTION ───────────────────────────
  // Thin safety gates applied BEFORE day-count gates.
  // Never increases fatigue complexity when injuries are present.
  if(hasInjury){
    // 3-day + back injury: fullbody is safer than ppl_3 or stronglifts
    if(d===3 && inj.includes('back')) return 'fullbody';
    // 5 days with any injury: hybrid is safest (anterior_posterior = 4 days only)
    if(d===5) return 'hybrid';
    // 6 days with injury: ppl is safest valid option (anterior_posterior = 4-5 days only)
    if(d>=6) return 'ppl';
  }
  // ─────────────────────────────────────────────────────────────────────

  // ── 2-DAY GATE ──
  if(d<=2){
    return 'fullbody'; // StrongLifts needs minimum 3 days
  }

  // ── 3-DAY GATE ──
  if(d===3){
    if(g==='strength') return 'stronglifts';
    if(isBeg) return 'fullbody';
    // intermediate/advanced with decent recovery - Modified PPL-3
    // Recovery modifier override: if sustain tier is low/critical, prefer fullbody
    if(sustainTier === 'low' || sustainTier === 'critical') return 'fullbody';
    if((isInt||isAdv) && midRec) return 'ppl_3';
    return 'fullbody'; // low recovery - safer Full Body
  }

  // ── 4-DAY GATE ──
  // الخيارات الهيكلية الصحيحة على 4 أيام:
  //   upper_lower          (علوي × 2 + سفلي × 2)
  //   anterior_posterior   (أمامي × 2 + خلفي × 2)
  //   ppl_weak             (Push+Pull+Legs+WeakPoint) — متوسط/متقدم فقط
  // PPL الكامل وBrosplit وArnold وHybrid = hard-invalid على 4 أيام
  if(d===4){
    if(hasInjury) return 'anterior_posterior';
    if(g==='strength') return applyRecoveryModifierOverride('upper_lower', mods, d, e, r, g);
    if(isBeg){
      const baseBeg = (lowRec || sustainTier === 'critical') ? 'anterior_posterior' : 'upper_lower';
      return applyRecoveryModifierOverride(baseBeg, mods, d, e, r, g);
    }
    if(sustainTier === 'critical') return 'anterior_posterior';
    if(lowRec && tol < 55) return applyRecoveryModifierOverride('anterior_posterior', mods, d, e, r, g);
    // متوسط/متقدم + هدف ضخامة + تعافي جيد: ppl_weak على 4 أيام هو الأذكى
    if((isInt || isAdv) && g === 'muscle' && (sustainTier === 'high' || sustainTier === 'mid')){
      return applyRecoveryModifierOverride('ppl_weak', mods, d, e, r, g);
    }
    // متقدم + تنشيف + تعافي عال: anterior_posterior أفضل للحفاظ على العضل
    if(isAdv && highRec && g === 'cut'){
      return applyRecoveryModifierOverride('anterior_posterior', mods, d, e, r, g);
    }
    // الحالة الافتراضية: scoring engine يختار بين upper_lower و anterior_posterior
    return applyRecoveryModifierOverride('upper_lower', mods, d, e, r, g);
  }

  // ── 5-DAY GATE ──
  // upper_lower = هيكل 4 أيام فقط — لا يجوز اقتراحه على 5 أيام أبدا
  // الخيارات الصحيحة: ppl · hybrid · anterior_posterior · brosplit (متقدم فقط)
  if(d===5){
    if(isBeg) return 'hybrid';
    if(g==='strength') return 'hybrid';

    if(sustainTier === 'critical') return 'hybrid';
    if(sustainTier === 'low'){
      return 'hybrid';
    }

    if(lowRec && tol<50) return 'hybrid';
    if(lowRec) return applyRecoveryModifierOverride('hybrid', mods, d, e, r, g);
    if(tol<50) return applyRecoveryModifierOverride('hybrid', mods, d, e, r, g);

    // تنشيف على 5 أيام: PPL هو الأمثل (تكرار 2× أسبوعيا مع يوم راحة)
    // hybrid خيار ثان جيد — لا يقترح upper_lower أبدا
    if(g==='cut'){
      if(isAdv && highRec) return applyRecoveryModifierOverride('ppl', mods, d, e, r, g);
      return applyRecoveryModifierOverride('hybrid', mods, d, e, r, g);
    }

    if(isInt && g==='muscle') return applyRecoveryModifierOverride('hybrid', mods, d, e, r, g);
    if(isInt && g==='fitness') return applyRecoveryModifierOverride('hybrid', mods, d, e, r, g);
    if(isAdv && g==='muscle' && highRec) return applyRecoveryModifierOverride('brosplit', mods, d, e, r, g);
    if(isAdv && g==='muscle') return applyRecoveryModifierOverride('ppl', mods, d, e, r, g);
    return applyRecoveryModifierOverride('ppl', mods, d, e, r, g);
  }

  // ── 6-DAY GATE ──
  if(d>=6){
    if(isBeg) return 'ppl'; // 6 days beginner - ppl (hybrid = 5 days only)
    if(sustainTier === 'critical') return 'ppl'; // ppl = safest valid 6-day split
    if(sustainTier === 'low'){
      return 'ppl';
    }
    if(lowRec && tol<40) return 'ppl';
    if(lowRec) return 'ppl';
    if(state.sleep === 'poor') return applyRecoveryModifierOverride('ppl', mods, d, e, r, g);
    if(isAdv && highRec && g==='muscle') return applyRecoveryModifierOverride('arnold', mods, d, e, r, g);
    if(isAdv && g==='muscle') return applyRecoveryModifierOverride('ppl', mods, d, e, r, g);
    return applyRecoveryModifierOverride('ppl', mods, d, e, r, g);
  }

  return 'ppl'; // default for 5+ days (constitutional minimum for advanced)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPERIENCE LEVEL THRESHOLDS — The Constitution §3
// Beginner  : < 6 months  (trainingMonths < 6)
// Intermediate: 6–24 months (6 ≤ trainingMonths ≤ 24)
// Advanced  : > 24 months (trainingMonths > 24)
// state.exp is set externally by the form; these thresholds document the
// official definition used by coaches and the engine alike.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const EXP_THRESHOLDS = {
  beginner:     { maxMonths: 5,   label: 'مبتدئ',   desc: 'أقل من 6 أشهر تدريب منتظم'  },
  intermediate: { minMonths: 6,   maxMonths: 24, label: 'متوسط',  desc: '6 أشهر – 24 شهر (سنتان)' },
  advanced:     { minMonths: 25,  label: 'متقدم',   desc: 'أكثر من 24 شهر تدريب منتظم' }
};

/**
 * resolveExpFromMonths — helper: derive experience tier from raw training months.
 * Used when state.exp may not be set explicitly.
 * @param {number} months
 * @returns {'beginner'|'intermediate'|'advanced'}
 */
function resolveExpFromMonths(months){
  if(!months || months < 6)  return 'beginner';
  if(months <= 24)           return 'intermediate';
  return 'advanced';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SPLIT_DB — Canonical day-range definitions (The Constitution §1)
// ─────────────────────────────────────────────────────────────
// STRICT mapping (days - valid splits):
//   2 days : fullbody only
//   3 days : fullbody · ppl_3 · stronglifts
//   4 days : upper_lower · anterior_posterior · ppl_weak (4-day mode)
//   5 days : ppl (5-day) · brosplit · hybrid
//   6 days : ppl (6-day) · arnold
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// SPLITS DATA — 10 أنظمة تدريبية — بناء على The Constitution
// Descriptions adapt dynamically to the user's recovery/goal/sustainability context
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getSplits(){
  // ── Build adaptive description context from current state ─────────────
  const g    = state.goal || '';
  const tier = state._sustainTier || 'mid';
  const goalLabel = {cut:'التنشيف', muscle:'الضخامة', strength:'القوة', fitness:'اللياقة'}[g] || 'هدفك';

  function descFor(key){
    if(key === 'fullbody'){
      if(tier === 'critical') return 'الخيار الأذكى — يتيح التعافي الكافي ويمنع تراكم الإجهاد';
      if(tier === 'low')      return 'هيكل تدريبي مستدام — مناسب لحالتك الحالية واستمرارية '+goalLabel;
      if(g === 'cut')         return 'أفضل توازن بين الأداء والاستشفاء لمرحلة '+goalLabel;
      return 'كل الجسم في كل جلسة — الأمثل للمبتدئين والتنشيف وقلة الوقت';
    }
    if(key === 'upper_lower'){
      if(tier === 'critical' || tier === 'low') return 'أفضل توازن للحجم والاستشفاء في ظروفك الحالية';
      if(g === 'cut')      return 'مناسب للتنشيف مع الحفاظ على التعافي';
      if(g === 'strength') return 'مثالي للقوة مع تردد تدريبي متوازن';
      return 'يوم علوي + يوم سفلي — ممتاز لمعظم الناس والاستشفاء المتوسط';
    }
    if(key === 'ppl_3'){
      if(g === 'cut') return 'مناسب للتنشيف مع الحفاظ على التعافي في 3 أيام';
      return 'Push Pull Legs معدلة في 3 أيام — تغطية كاملة، حجم عال، تعاف كاف';
    }
    if(key === 'ppl'){
      if(tier === 'low' || tier === 'mid') return 'مناسب لرفع الأداء مع مراعاة قدرتك على التعافي';
      if(g === 'cut') return 'مناسب للتنشيف بتردد متوازن — راقب جودة النوم والتعافي';
      return 'Push Pull Legs — تكرار العضلة مرتين أسبوعيا لأقصى نمو عضلي';
    }
    if(key === 'brosplit'){
      if(tier === 'high' && g === 'muscle') return 'حجم تدريبي مرتفع للعضلة الواحدة — تستوفي شروط التعافي العالي · ملاحظة: تكرار 2× أسبوعيا (PPL) يثبت نموا أسرع في معظم الدراسات، لكن ال Bro Split يظل خيارا مشروعا للمتقدمين الملتزمين';
      return 'يوم مخصص لكل عضلة — حجم تدريبي مرتفع، للمتقدمين ذوي التعافي العالي فقط · الأبحاث تشير إلى أن تردد 2×/أسبوع (PPL) ينتج ضخامة أعلى إجمالا';
    }
    if(key === 'arnold'){
      if(tier === 'high') return 'ال Split الأسطوري — مستواك ومؤشرات تعافيك تؤهلك لهذا التحدي';
      return 'ال Split الأسطوري: صدر+ظهر، أكتاف+ذراع، أرجل — للمتقدمين ذوي التعافي العالي فقط';
    }
    if(key === 'stronglifts'){
      if(g === 'strength') return 'الأفضل لبناء القوة الوظيفية بحجم تدريبي صحي ومستدام';
      return 'تمارين مركبة أساسية 5×5 — الأفضل لبناء القوة الوظيفية';
    }
    if(key === 'hybrid'){
      if(tier === 'high') return 'مناسب لرفع الأداء بدون إجهاد زائد — مرونة عالية لتطوير '+goalLabel;
      return 'دمج PPL + Upper Lower — مرونة عالية وتطوير تدريجي ممتاز';
    }
    if(key === 'anterior_posterior'){
      if(tier === 'low' || tier === 'critical') return 'هيكل تدريبي مستدام طويل المدى — مثالي لحالتك واستشفائك الحالي';
      if(g === 'cut') return 'مناسب للتنشيف مع الحفاظ على التعافي وتوازن الجسم';
      return 'السلسلة الأمامية + الخلفية — مثالي للإصابات وتوازن الجسم وتصحيح الوضعية';
    }
    if(key === 'ppul'){
      if(g === 'cut') return 'Push / Pull / Upper / Lower — توزيع متوازن مع تردد 2× للجزء العلوي في التنشيف';
      return 'Push / Pull / Upper / Lower — تكرار 2× للصدر/الظهر/الأكتاف/الذراع في 4 أيام';
    }
    if(key === 'ululf'){
      if(g === 'muscle') return 'Upper/Lower/Upper/Lower/Full — كل عضلة 2-3× أسبوعيا، الأقوى علميا للضخامة في 5 أيام';
      return 'Upper/Lower/Upper/Lower/Full — أعلى تردد أسبوعي متوازن في 5 أيام';
    }
    if(key === 'ul6'){
      return 'Upper/Lower ×3 — كل عضلة 3× أسبوعيا، حجم وتردد أقصى للمتقدمين ذوي التعافي العالي';
    }
    if(key === 'ppl_weak'){
      if(tier === 'high') return 'أفضل توازن بين الأداء والاستشفاء مع تطوير نقاط الضعف';
      return 'Push Pull Legs + يوم لتعزيز العضلات الضعيفة — ذكي ومتوازن';
    }
    if(key === 'torso_limbs'){
      if(g === 'cut') return 'جذع/أطراف — صدر/ظهر/أكتاف في يومين والأرجل/الذراع في يومين، تردد 2× مع تعاف مريح للتنشيف';
      return 'Torso/Limbs — الجذع (صدر/ظهر/أكتاف) × يومين + الأطراف (أرجل/ذراع) × يومين، يمنح الذراع يوما مخصصا بجودة أعلى';
    }
    return '';
  }

  return{
    // ── 2-3 DAYS ──────────────────────────────────────────────────────────
    fullbody:{
      name:'Full Body',freq:`${state.days} أيام/أسبوع`,
      tags:['مبتدئ','تعافي سريع','تنشيف','بداية'],
      desc: descFor('fullbody'),
      // Full Body: valid for 2 OR 3 days. The engine picks 2 or 3 templates accordingly.
      minDays:2, maxDays:3,
      level:['beginner','intermediate','advanced'],
      goals:['cut','fitness','muscle'],
      recDays:[2,3]
    },
    // ── 3 DAYS ONLY ───────────────────────────────────────────────────────
    ppl_3:{
      name:'Push Pull Legs',freq:'3 أيام/أسبوع',
      tags:['PPL مختصر','متوسط','3 أيام','ضخامة'],
      desc: descFor('ppl_3'),
      // PPL_3 is architecturally a 3-day structure — exactly Push+Pull+Legs
      minDays:3, maxDays:3,
      level:['beginner','intermediate','advanced'],
      goals:['muscle','strength','fitness'],
      recDays:[3]
    },
    stronglifts:{
      name:'StrongLifts 5×5',freq:'3 أيام/أسبوع',
      tags:['قوة','مركبة','مبتدئ','متوسط'],
      desc: descFor('stronglifts'),
      // StrongLifts A/B alternates over 3 days — structural constraint
      minDays:3, maxDays:3,
      level:['beginner','intermediate'],
      goals:['strength'],
      recDays:[3]
    },
    // ── 4 DAYS ONLY ───────────────────────────────────────────────────────
    upper_lower:{
      name:'Upper Lower',freq:'4 أيام/أسبوع',
      tags:['متوسط','توازن','مرن','تعافي جيد'],
      desc: descFor('upper_lower'),
      // Upper/Lower = 4 sessions: Upper×2 + Lower×2. Hard 4-day structure.
      minDays:4, maxDays:4,
      level:['beginner','intermediate','advanced'],
      goals:['muscle','cut','strength','fitness'],
      recDays:[4]
    },
    // ── 4-5 DAYS ──────────────────────────────────────────────────────────
    anterior_posterior:{
      name:'Anterior Posterior',freq:`${state.days} أيام/أسبوع`,
      tags:['توازن الجسم','إصابات','وضعية','سلسلة خلفية'],
      desc: descFor('anterior_posterior'),
      // On 4 days: Ant×2 + Post×2. Strictly 4-day split only.
      minDays:4, maxDays:4,
      level:['beginner','intermediate','advanced'],
      goals:['fitness','cut','muscle'],
      recDays:[4]
    },
    ppl_weak:{
      name:'PPL + Weak Point',freq:`${state.days} أيام/أسبوع`,
      tags:['PPL','نقاط ضعف','ذكي','توازن'],
      desc: descFor('ppl_weak'),
      // 4 days: Push+Pull+Legs+WeakPoint. Strictly 4-day split only.
      minDays:4, maxDays:4,
      level:['intermediate','advanced'],
      goals:['muscle','strength','fitness'],
      recDays:[4]
    },
    torso_limbs:{
      name:'Torso / Limbs',freq:'4 أيام/أسبوع',
      tags:['جذع/أطراف','تضخيم','جمالي','ذراع مخصص'],
      desc: descFor('torso_limbs'),
      // Torso×2 + Limbs×2 — هيكل 4 أيام صارم. كل عضلة 2×/أسبوع، الذراع بيوم مخصص.
      minDays:4, maxDays:4,
      level:['intermediate','advanced'],
      goals:['muscle','cut','fitness'],
      recDays:[4]
    },
    // ── 5 DAYS ONLY ───────────────────────────────────────────────────────
    ppl:{
      name:'Push Pull Legs',freq:`${state.days} أيام/أسبوع`,
      tags:['PPL','متوسط','متقدم','بناء عضلي'],
      desc: descFor('ppl'),
      // 5-day PPL: Push+Pull+Legs+Push2+Pull2. 6-day: adds Legs2.
      minDays:5, maxDays:6,
      level:['intermediate','advanced'],
      goals:['muscle','strength'],
      recDays:[5,6]
    },
    brosplit:{
      name:'Bro Split',freq:'5 أيام/أسبوع',
      tags:['كلاسيكي','بودي بيلدنج','تضخيم','متقدم'],
      desc: descFor('brosplit'),
      // Bro Split = 5 dedicated days: Chest/Back/Shoulders/Legs/Arms
      minDays:5, maxDays:5,
      level:['intermediate','advanced'],
      goals:['muscle'],
      recDays:[5]
    },
    hybrid:{
      name:'PPL + Upper Lower',freq:'5 أيام/أسبوع',
      tags:['هجين','مرن','متوسط','تطوير'],
      desc: descFor('hybrid'),
      // Hybrid: Push+Pull+Legs+Upper+Lower — strictly 5 days
      minDays:5, maxDays:5,
      level:['intermediate','advanced'],
      goals:['muscle','strength','fitness'],
      recDays:[5]
    },
    // ── 6 DAYS ONLY ───────────────────────────────────────────────────────
    ppul:{
      name:'Push Pull Upper Lower',freq:'4 أيام/أسبوع',
      tags:['متوسط','متقدم','تكرار 2×','مرن'],
      desc: descFor('ppul'),
      minDays:4, maxDays:4,
      level:['intermediate','advanced'],
      goals:['muscle','strength','fitness'],
      recDays:[4]
    },
    ululf:{
      name:'Upper Lower Full',freq:'5 أيام/أسبوع',
      tags:['تردد عال','ضخامة','كل عضلة 2-3×','علمي'],
      desc: descFor('ululf'),
      minDays:5, maxDays:5,
      level:['intermediate','advanced'],
      goals:['muscle','strength','fitness'],
      recDays:[5]
    },
    ul6:{
      name:'Upper Lower',freq:'6 أيام/أسبوع',
      tags:['متقدم','تردد أقصى','كل عضلة 3×','تعافي عال'],
      desc: descFor('ul6'),
      minDays:6, maxDays:6,
      level:['advanced'],
      goals:['muscle','strength'],
      recDays:[6],
      requiresRecovery:75,
      requiresExp:'advanced'
    },
    arnold:{
      name:'Arnold Split',freq:'6 أيام/أسبوع',
      tags:['متقدم','أسطوري','حجم قصوى','تعافي عال'],
      desc: descFor('arnold'),
      // Arnold: (Chest+Back)×2 + (Shoulders+Arms)×2 + Legs×2 — hard 6-day
      minDays:6, maxDays:6,
      level:['advanced'],
      goals:['muscle'],
      recDays:[6],
      requiresRecovery:70,
      requiresExp:'advanced'
    }
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// recommendSplitsForDays — The Constitution §1 day - split strict map
// Returns the ordered list of split keys that are structurally valid
// for the given day count (ignoring experience/recovery — pure day gate).
// Used by buildSplits() to separate valid vs hard-invalid splits.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function recommendSplitsForDays(days){
  const DAY_SPLIT_MAP = {
    2: ['fullbody'],
    3: ['fullbody', 'ppl_3', 'stronglifts'],
    4: ['upper_lower', 'ppul', 'anterior_posterior', 'ppl_weak', 'torso_limbs'],
    5: ['ppl', 'ululf', 'hybrid', 'brosplit'],
    // anterior_posterior and ppl_weak are strictly 4-day splits
    6: ['ppl', 'ul6', 'arnold']
  };
  // Clamp: anything < 2 - 2-day map; anything > 6 - 6-day map
  const d = Math.max(2, Math.min(days, 6));
  return DAY_SPLIT_MAP[d] || ['fullbody'];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// generateSplits — Generates ordered split list for the UI split selector.
// Returns [{key, split, isRecommended}] for all splits valid on state.days.
// Hard-invalid splits (day mismatch) are excluded entirely.
// Soft-unsupported splits (experience/recovery mismatch) get a warning flag.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateSplits(days){
  const splits = getSplits();
  const rec    = state.recommendedSplit || getRecommendedSplit();
  const validKeys = recommendSplitsForDays(days || state.days);
  const e = state.exp || 'intermediate';
  const r = state.recoveryScore || 60;

  // Experience hard-lock keys: structurally excluded regardless of days
  const expHardLock = new Set();
  if(e === 'beginner'){
    // الوثيقة: PPL_3 مسموح للمبتدئ (نظام 3 أيام مكثف لكن مقبول)
    // ppl_weak محجوب للمبتدئ لأنه يحتاج فهم نقاط الضعف = خبرة متوسطة على الأقل
    expHardLock.add('ppl_weak');
    expHardLock.add('brosplit');
    expHardLock.add('arnold');
  }
  if(e !== 'advanced'){
    expHardLock.add('arnold');
  }

  return validKeys
    .filter(k => !expHardLock.has(k))
    .map(k => {
      const s = splits[k];
      if(!s) return null;
      // Soft-unsupported: valid day-range but suboptimal for experience/recovery
      let softWarn = null;
      const levelAr = {beginner:'مبتدئ',intermediate:'متوسط',advanced:'متقدم'};
      if(s.level && !s.level.includes(e)){
        softWarn = `الأنسب ل ${s.level.map(l=>levelAr[l]||l).join('/')} — مستواك: ${levelAr[e]||e}`;
      }
      if(k === 'arnold' && r < 70){
        softWarn = (softWarn?softWarn+' · ':'')+`تعافيك (${r}%) أقل من المطلوب 70%`;
      }
      return { key:k, split:s, isRecommended: k===rec, softWarn };
    })
    .filter(Boolean);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEEKLY REGION-COVERAGE GUARANTEE
// يضمن أنه عند تدريب عضلة على عدد كاف من الخانات خلال الأسبوع، تجدول كل
// مناطقها التشريحية المهمة مرة واحدة على الأقل. يعمل فقط على المناطق الموجودة
// في قاعدتي بيانات الجيم والمنزل معا. Idempotent: إعادة التشغيل لا تغير شيئا
// بعد اكتمال التغطية. المنطق: نسرق خانة واحدة من أكثر منطقة مكررة (ونفضل
// الخانة المساعدة i>0 لا خانة محور اليوم i=0) ونحولها للمنطقة الناقصة.
//   • الصدر: علوي (Incline) · مسطح/تفتيح (Flat/Fly) · سفلي (Decline/Dips)
//   • الأكتاف: أمامي (Press) · جانبي (Lateral) · خلفي (Rear)
// ملاحظة: تتبع الزوايا الأسبوعي في planner.js يكمل هذا فيختار تلقائيا
// زاوية مختلفة (مثلا تفتيح Fly) عند تكرار نفس ال subKey في يوم آخر.
function _ensureWeeklyRegionCoverage(days){
  if(!Array.isArray(days) || !days.length) return days;
  const COVERAGE = {
    chest:     ['upper','mid','lower'],
    shoulders: ['press','lateral','rear']
  };
  for(const grp of Object.keys(COVERAGE)){
    const required = COVERAGE[grp];
    const slots = [];
    days.forEach(d => {
      if(!d || d.isRest || !Array.isArray(d.groups)) return;
      d.groups.forEach((g,i) => { if(Array.isArray(g) && g[0]===grp) slots.push({d,i}); });
    });
    // نطبق الضمان فقط عند توفر خانات كافية لاستيعاب كل المناطق
    if(slots.length < required.length) continue;
    const subOf = s => s.d.groups[s.i][1];
    const present = new Set(slots.map(subOf));
    const missing = required.filter(r => !present.has(r));
    for(const miss of missing){
      const counts = {};
      slots.forEach(s => { const k=subOf(s); counts[k]=(counts[k]||0)+1; });
      // مرشحون: منطقة مكررة (>=2) آمنة للسرقة دون إنقاصها تحت 1
      const cands = slots.filter(s => (counts[subOf(s)]||0) >= 2);
      if(!cands.length) break;
      cands.sort((a,b) => {
        const ca = counts[subOf(a)], cb = counts[subOf(b)];
        if(cb !== ca) return cb - ca;   // اسرق من الأكثر تكرارا
        return b.i - a.i;               // فضل الخانة المساعدة على محور اليوم
      });
      const pick = cands[0];
      pick.d.groups[pick.i] = [grp, miss];
      present.add(miss);
    }
  }
  return days;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getSplitSchedule(splitKey,days){
  const S=STRETCH,W=WARMUP;
  // Legacy key normalization — ppl_5/ppl_6 - ppl (handles 5-6 days via slice),
  // upper_lower_5 - upper_lower (handles 4-5 days via slice)
  const keyMap={'ppl_5':'ppl','ppl_6':'ppl','upper_lower_5':'upper_lower'};
  if(keyMap[splitKey]) splitKey=keyMap[splitKey];
  if(splitKey==='fullbody'){
    const templates=[
      // A: كوادز + هامستينج (RDL للتوازن) + صدر مسطح + لاتس + كتف جانبي + بايسبس + ترايسبس + سمانة
      // BIOMECHANICS FIX: هامستينج مطلوب في كل يوم فول بادي — غيابه يسبب Agonist/Antagonist Imbalance
      // على الركبة والرباط الصليبي — RDL خفيف (3×10) يكفي لتفعيل الخلفيات دون إجهاد
      {name:'Full Body A — كوادز + هامستينج RDL + صدر مسطح + لاتس + كتف جانبي/أمامي + بايسبس + ترايسبس + سمانة',muscles:['كوادز','هامستينج','صدر مسطح','ظهر لاتس','أكتاف','بايسبس','ترايسبس','سمانة'],groups:[['quads','dominant'],['hamstrings','dominant'],['chest','mid'],['back','lats'],['shoulders','lateral'],['shoulders','press'],['biceps','short'],['triceps','lateral'],['calves','gastrocnemius']],warm:W.full,stretch:[...S.legs,...S.chest,...S.arms]},
      // B: خلفيات + صدر علوي + ظهر سمك + كتف أمامي + كتف جانبي + ترايسبس + سمانة
      {name:'Full Body B — هامستينج + صدر علوي + ظهر سمك + كتف أمامي/جانبي + ترايسبس + سمانة',muscles:['هامستينج','صدر علوي','ظهر وسط','أكتاف','ترايسبس','سمانة'],groups:[['hamstrings','isolation'],['hamstrings','dominant'],['chest','upper'],['back','mid'],['shoulders','lateral'],['shoulders','press'],['triceps','lateral'],['calves','gastrocnemius']],warm:W.full,stretch:[...S.legs,...S.chest,...S.shoulders]},
      // C: كوادز + هامستينج + صدر تفتيح + لاتس + كتف جانبي + بايسبس + قطنية + سمانة
      {name:'Full Body C — كوادز + هامستينج + صدر تفتيح + لاتس + كتف جانبي + بايسبس + سمانة',muscles:['كوادز','هامستينج','صدر','ظهر لاتس','أكتاف','بايسبس','سمانة'],groups:[['quads','dominant'],['hamstrings','dominant'],['chest','mid'],['back','lats'],['shoulders','lateral'],['biceps','long'],['calves','gastrocnemius'],['back','lower']],warm:W.full,stretch:[...S.legs,...S.chest,...S.back]}
    ];
    return templates.slice(0,days);
  }
  if(splitKey==='upper_lower'){
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Upper Lower Split — 4 أيام (Upper×2 + Lower×2)
    // التغطية الأسبوعية الكاملة (كل عضلة رئيسية 2×/أسبوع):
    //
    //  UPPER 1 (محور: صدر مسطح + ظهر لاتس):
    //    صدر مسطح · صدر علوي · لاتس · ظهر وسط · كتف جانبي ·
    //    كتف خلفي · بايسبس short · ترايسبس lateral
    //
    //  LOWER 1 (محور: كوادز Squat + هامستينج RDL):
    //    كوادز compound · كوادز isolation · هامستينج RDL ·
    //    هامستينج compound · جلوتس hip hinge · سمانة · ضامة
    //
    //  UPPER 2 (محور: صدر علوي + ظهر سمك + كتف أمامي + ترابيس):
    //    صدر علوي · صدر تفتيح · ظهر سمك · لاتس ·
    //    كتف أمامي (press) · كتف خلفي · بايسبس long · ترايسبس long · ترابيس
    //
    //  LOWER 2 (محور: هامستينج Curl + جلوتس Thrust + كوادز لونج):
    //    هامستينج Leg Curl · جلوتس Hip Thrust · كوادز لونج ·
    //    ظهر سفلي (RDL) · سمانة · ضامة
    //
    // المبرر العلمي:
    //  - كتف أمامي (press) - Upper 2 لأن Upper 1 تحتوي صدر مسطح = indirect anterior delt
    //  - كتف خلفي (rear delt) - كلا ال Upper (2×/أسبوع) لأنه يتأخر في النمو
    //  - بايسبس: short في U1 + long في U2 - تطوير الرأسين
    //  - ترايسبس: lateral في U1 + long في U2 - تطوير الرأسين
    //  - ترابيس - Upper 2 لأنه يكمل السلسلة الخلفية العلوية
    //  - ضامة - كلا أيام الأرجل (adductors تعمل في ال squat + Romanian patterns)
    //  - سمانة - كلا أيام الأرجل (2×/أسبوع للحصول على تردد كاف)
    //  - ظهر سفلي - Lower 2 (مع RDL) إضافة لل Upper 1 indirect
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    return[

      // ── UPPER 1 ───────────────────────────────────────────────────────
      // محور: صدر مسطح + ظهر لاتس + كتف جانبي + كتف خلفي + بايسبس short + ترايسبس lateral
      {
        name:'Upper 1 — صدر مسطح + علوي + لاتس + ظهر وسط + كتف جانبي + كتف خلفي + بايسبس + ترايسبس',
        muscles:['صدر','ظهر','أكتاف','دلتا خلفي','بايسبس','ترايسبس'],
        groups:[
          ['chest','mid'],           // صدر مسطح (Flat Bench — محور اليوم)
          ['chest','upper'],         // صدر علوي (Incline)
          ['back','lats'],           // لاتس (Pull-Down/Weighted Pull-Up)
          ['back','mid'],            // ظهر وسط (Row)
          ['shoulders','lateral'],   // كتف جانبي (Lateral Raise)
          ['shoulders','rear'],      // كتف خلفي (Rear Delt Fly/Face Pull)
          ['traps','all'],           // ترابيس (Face Pull + Shrug / Cable Shrug)
          ['biceps','short'],        // بايسبس رأس قصير (Barbell/EZ Curl)
          ['triceps','lateral']      // ترايسبس رأس جانبي (Pushdown)
        ],
        warm:W.upper,
        stretch:[...S.chest,...S.back,...S.arms,...S.shoulders]
      },

      // ── LOWER 1 ───────────────────────────────────────────────────────
      // محور: كوادز Squat + هامستينج RDL + جلوتس Hip Hinge + سمانة + ضامة
      {
        name:'Lower 1 — كوادز Squat + كوادز عزل + هامستينج RDL + جلوتس Hip Hinge + سمانة + ضامة',
        muscles:['كوادز','هامستينج','جلوتس','سمانة','ضامة'],
        groups:[
          ['quads','dominant'],        // كوادز compound (Squat/Hack Squat — محور اليوم)
          ['quads','isolation'],       // كوادز عزل (Leg Extension)
          ['hamstrings','dominant'],   // هامستينج RDL (Romanian Deadlift)
          ['hamstrings','dominant'],   // هامستينج compound (Leg Press / Stiff Leg)
          ['hamstrings','glutes'],     // جلوتس Hip Hinge (Hip Thrust / Glute Bridge)
          ['calves','gastrocnemius'],  // سمانة (Standing Calf Raise)
          ['adductors','all'],         // ضامة (Adductor Machine / Sumo Squat)
          ['back','lower']             // ظهر سفلي (Squat يحمل القطنية — Back Extension خفيف)
        ],
        warm:W.legs_quad,
        stretch:[...S.legs,...S.glutes,...S.back]
      },

      // ── UPPER 2 ───────────────────────────────────────────────────────
      // محور: صدر علوي + ظهر سمك + كتف أمامي (press) + كتف خلفي + بايسبس long + ترايسبس long + ترابيس
      {
        name:'Upper 2 — صدر علوي + ظهر سمك + كتف أمامي + كتف خلفي + بايسبس long + ترايسبس long + ترابيس',
        muscles:['صدر علوي','ظهر','أكتاف أمامي','دلتا خلفي','بايسبس','ترايسبس','ترابيس'],
        groups:[
          ['chest','upper'],         // صدر علوي (Incline — محور اليوم)
          ['chest','mid'],           // صدر تفتيح (Cable/Dumbbell Fly)
          ['back','mid'],            // ظهر سمك (Seated Row)
          ['back','lats'],           // لاتس (Pull-Down زاوية مختلفة)
          ['shoulders','lateral'],   // كتف جانبي (Dumbbell/Cable Lateral Raise)
          ['shoulders','press'],     // كتف أمامي (Overhead Press — DB/BB)
          ['shoulders','rear'],      // كتف خلفي (Rear Delt Machine/Cable)
          ['biceps','long'],         // بايسبس رأس طويل (Incline Curl/Hammer Curl)
          ['triceps','long'],        // ترايسبس رأس طويل (Overhead Extension)
          ['traps','all']            // ترابيس (Shrugs / Face Pull + Shrug)
        ],
        warm:W.upper,
        stretch:[...S.chest,...S.back,...S.shoulders,...S.arms]
      },

      // ── LOWER 2 ───────────────────────────────────────────────────────
      // محور: هامستينج Leg Curl + جلوتس Hip Thrust + كوادز لونج + ظهر سفلي + سمانة seated + ضامة
      {
        name:'Lower 2 — هامستينج Curl + جلوتس Hip Thrust + كوادز لونج + ظهر سفلي + سمانة + ضامة',
        muscles:['هامستينج','جلوتس','كوادز','ظهر سفلي','سمانة','ضامة'],
        groups:[
          ['hamstrings','isolation'],  // هامستينج Leg Curl (Lying/Seated) - knee-flexion function
          ['hamstrings','dominant'],   // هامستينج Stiff Leg / Nordic
          ['hamstrings','glutes'],     // جلوتس Hip Thrust (Barbell Hip Thrust — محور اليوم)
          ['quads','dominant'],        // كوادز لونج (Walking Lunge / Bulgarian Split Squat)
          ['back','lower'],            // ظهر سفلي (Back Extension / Hyperextension)
          ['calves','gastrocnemius'],  // سمانة seated (Seated Calf Raise — soleus focus)
          ['adductors','all']          // ضامة (Cable Pull-Through / Sumo)
        ],
        warm:W.legs_ham,
        stretch:[...S.legs,...S.glutes,...S.back]
      }

    ].slice(0,days);
  }
  if(splitKey==='ppl_3'){
    // TRUE Modified PPL-3: Full Body + PPL hybrid
    // Day 1 (Push): Chest + Shoulders + Triceps (+ calves as finisher)
    // Day 2 (Pull+Legs A): Back + Biceps + Quads dominant
    // Day 3 (Legs B+): Hamstrings + Glutes + Quads isolation + Calves + (rear delts)
    // Coverage: ALL major muscles hit at least once. Arms/calves get 2× via overlap.
    return[
      {
        // VOLUME FIX: على تواتر 3 أيام/أسبوع، الصدر السفلي = Junk Volume يرهق مفصل الكتف الأمامي
        // بدون عائد ملموس للضخامة — الأولوية للألياف الكبرى (مسطح + علوي) فقط
        name:'Push — صدر علوي + مسطح + أكتاف أمامي/جانبي + ترايسبس (رأسين)',
        muscles:['صدر علوي','صدر مسطح','أكتاف','ترايسبس'],
        groups:[
          ['chest','upper'],['chest','mid'],
          ['shoulders','press'],['shoulders','lateral'],
          ['triceps','long'],['triceps','lateral'],
          ['calves','gastrocnemius']
        ],
        warm:W.push,
        stretch:[...S.chest,...S.shoulders,...S.arms]
      },
      // Pull: ظهر لاتس + ظهر سمك + كتف خلفي + ترابيس + قطنية + بايسبس رأس طويل + رأس قصير
      {
        // SPINE SAFETY NOTE (PPL_3 Pull):
        // back/lower هنا = ظهر سفلي مفعل ك Stabilizer عبر تمارين السحب المركبة (Deadlift / Row)
        // لا يوجد عزل قطنية مستقل (Hyperextension) في هذا اليوم — يكفي تفعيله بالكمباوند
        // إضافة عزل قطنية بعد تمارين سحب ثقيلة = إرهاق مضاعف لأسفل الظهر
        name:'Pull — لاتس + سمك + كتف خلفي + ترابيس + بايسبس (رأسين)',
        muscles:['ظهر لاتس','ظهر وسط','دلتا خلفي','ترابيس','بايسبس'],
        groups:[
          ['back','lats'],['back','mid'],['shoulders','rear'],
          ['traps','all'],
          ['back','lower'], // مفعل ك Stabilizer في السحب المركب — لا عزل مستقل
          ['biceps','long'],['biceps','short'],
          ['adductors','all']
        ],
        warm:W.pull,
        stretch:[...S.back,...S.arms]
      },
      // Legs: كوادز compound + عزل + خلفيات + مؤخرة + سمانة + ضامة + ترابيس فينيشر
      {
        name:'Legs — كوادز compound + عزل + خلفيات + مؤخرة + سمانة + ضامة',
        muscles:['كوادز','هامستينج','جلوتس','سمانة','ضامة'],
        groups:[
          ['quads','dominant'],['quads','isolation'],
          ['hamstrings','dominant'],['hamstrings','glutes'],
          ['calves','gastrocnemius'],['adductors','all'],
          ['traps','all']
        ],
        warm:W.legs_quad,
        stretch:[...S.legs,...S.glutes]
      }
    ];
  }
  // NOTE: ppl_5 case removed — keyMap above converts 'ppl_5' - 'ppl' before reaching here,
  // making this block unreachable (dead code). The 'ppl' case below handles 5-day slicing correctly.
  if(splitKey==='brosplit'){
    return[
      // صدر: مسطح ضغط + علوي ضغط + مسطح تفتيح + علوي تفتيح + سفلي + بولوفر (لاتس)
      {name:'صدر — مسطح + علوي + تفتيح + سفلي + بولوفر',muscles:['صدر'],
       groups:[['chest','mid'],['chest','upper'],['chest','mid'],['chest','upper'],['chest','lower'],['back','lats']],
       warm:W.push,stretch:[...S.chest,...S.back]},
      // ظهر: لاتس سحب علوي + لاتس سحب أرضي + سمك تجديف بار + سمك كابل + قطنية + ترابيس علوية + ترابيس وسطى
      {name:'ظهر — لاتس + سمك + قطنية + ترابيس',muscles:['ظهر كامل','ترابيس','ظهر سفلي'],
       groups:[['back','lats'],['back','lats'],['back','mid'],['back','mid'],['back','lower'],['traps','all'],['traps','all'],['adductors','all']],
       warm:W.pull,stretch:[...S.back]},
      // أكتاف: جانبي دامبل + جانبي كابل + أمامي ضغط + خلفي تفتيح + خلفي كابل + ترابيس
      {name:'أكتاف — جانبي + أمامي + خلفي + ترابيس + سمانة',muscles:['أكتاف','ترابيس','سمانة'],
       groups:[['shoulders','lateral'],['shoulders','lateral'],['shoulders','press'],['shoulders','rear'],['shoulders','rear'],['traps','all'],['biceps','short'],['calves','gastrocnemius']],
       warm:W.upper,stretch:[...S.shoulders]},
      // أرجل: سكوات + مكبس + عزل + RDL + جهاز + مؤخرة + سمانة
      {name:'أرجل — كوادز + خلفيات + مؤخرة + سمانة',muscles:['أرجل كاملة'],
       groups:[['quads','dominant'],['quads','isolation'],['hamstrings','dominant'],['hamstrings','isolation'],['hamstrings','glutes'],['calves','gastrocnemius'],['adductors','all']],
       warm:W.legs_quad,stretch:[...S.legs,...S.glutes]},
      // ذراع: بايسبس بار + بايسبس دامبل + عضدية + ترايسبس كابل + فوق الرأس + غطس
      {name:'ذراع — بايسبس (رأسين) + ترايسبس (رأسين)',muscles:['بايسبس','ترايسبس'],
       groups:[['biceps','short'],['biceps','long'],['biceps','short'],['triceps','lateral'],['triceps','long'],['triceps','lateral']],
       warm:W.upper,stretch:[...S.arms]}
    ].slice(0,days);
  }
  if(splitKey==='arnold'){
    return[
      // C&B 1: صدر مسطح + لاتس عمودي + صدر علوي + ظهر سمك + صدر سفلي + قطنية
      {name:'صدر + ظهر A — مسطح + لاتس + علوي + سمك + سفلي + قطنية',muscles:['صدر','ظهر'],
       groups:[['chest','mid'],['back','lats'],['chest','upper'],['back','mid'],['chest','lower'],['back','lower'],['traps','all']],
       warm:[...W.push,...W.pull.slice(0,2)],stretch:[...S.chest,...S.back]},
      // S&A 1: كتف جانبي + كتف أمامي + كتف خلفي + بايسبس طويل + بايسبس قصير + تراي طويل + تراي قصير
      {name:'أكتاف + ذراع A — جانبي + أمامي + خلفي + بايسبس (رأسين) + ترايسبس (رأسين)',muscles:['أكتاف كاملة','بايسبس','ترايسبس'],
       groups:[['shoulders','lateral'],['shoulders','press'],['shoulders','rear'],['biceps','long'],['biceps','short'],['triceps','long'],['triceps','lateral']],
       warm:W.upper,stretch:[...S.shoulders,...S.arms]},
      // Legs 1: كوادز سكوات + كوادز مكبس + خلفيات + مؤخرة + سمانة + بطن
      {name:'أرجل A — سكوات + مكبس + خلفيات + مؤخرة + سمانة + بطن',muscles:['أرجل كاملة'],
       groups:[['quads','dominant'],['quads','isolation'],['hamstrings','dominant'],['hamstrings','isolation'],['hamstrings','glutes'],['calves','gastrocnemius'],['adductors','all']],
       warm:W.legs_quad,stretch:[...S.legs,...S.glutes]},
      // C&B 2: صدر علوي + ظهر سمك + صدر مسطح + لاتس أفقي + صدر تفتيح + بولوفر + ترابيس
      {name:'صدر + ظهر B — علوي + سمك + مسطح + لاتس + تفتيح + بولوفر + ترابيس',muscles:['صدر','ظهر','ترابيس'],
       groups:[['chest','upper'],['back','mid'],['chest','mid'],['back','lats'],['chest','mid'],['back','lats'],['traps','all']],
       warm:[...W.push.slice(0,2),...W.pull.slice(0,2)],stretch:[...S.chest,...S.back]},
      // S&A 2: كتف خلفي + كتف جانبي + بايسبس ارتكاز + تراي فوق الرأس + عضدية + تراي كابل
      {name:'أكتاف + ذراع B — خلفي + جانبي + بايسبس ارتكاز + تراي فوق الرأس + عضدية + تراي كابل',muscles:['أكتاف','بايسبس','ترايسبس'],
       groups:[['shoulders','rear'],['shoulders','lateral'],['biceps','short'],['triceps','long'],['biceps','short'],['triceps','lateral']],
       warm:W.upper,stretch:[...S.shoulders,...S.arms]},
      // Legs 2: خلفيات عزل + خلفيات مركب RDL + كوادز + مؤخرة + سمانة + بطن
      {name:'أرجل B — خلفيات + RDL + كوادز + مؤخرة + سمانة + ضامة',muscles:['هامستينج','كوادز','جلوتس','سمانة','ضامة'],
       groups:[['hamstrings','isolation'],['hamstrings','dominant'],['quads','dominant'],['hamstrings','glutes'],['quads','isolation'],['back','lower'],['calves','gastrocnemius'],['adductors','all'],['traps','all']],
       warm:W.legs_ham,stretch:[...S.legs,...S.glutes]}
    ].slice(0,days);
  }
  if(splitKey==='ppl'){
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PPL 5 أيام: Push A - Pull A - Legs (كاملة موسعة) - Push B - Pull B
    // لا تكرار ليوم الأرجل — يوم الأرجل الوحيد يغطي كل الأرجل بعمق
    // Push A: صدر علوي + أكتاف ضغط + ترايسبس رأس طويل  (الزوايا الأمامية)
    // Push B: صدر وسط/سفلي + أكتاف جانبي/خلفي + ترايسبس جانبي (الزوايا الأخرى)
    // Pull A: ظهر لاتس + دلتا خلفي + بايسبس رأس طويل + ترابيس  (الشد العمودي)
    // Pull B: ظهر وسط + بايسبس رأس قصير + ساعد              (الشد الأفقي)
    // Legs:   كوادز compound + كوادز عزل + هامستينج + جلوتس + سمانة  (كامل)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if(days === 5){
      return[
        // Push 1: صدر مسطح + صدر علوي + كتف جانبي + كتف أمامي + تراي طويل + تراي قصير
        {name:'Push 1 — صدر مسطح + علوي + كتف جانبي/أمامي + ترايسبس رأس طويل',
         muscles:['صدر مسطح','صدر علوي','أكتاف','ترايسبس'],
         groups:[['chest','mid'],['chest','upper'],['shoulders','lateral'],['shoulders','press'],['triceps','long']],
         warm:W.push,stretch:[...S.chest,...S.shoulders,...S.arms]},
        // Pull 1: لاتس واسع + لاتس ضيق + ظهر سمك + كتف خلفي + بايسبس قصير + عضدية (Hammer)
        {name:'Pull 1 — لاتس واسع + ضيق + سمك + كتف خلفي + بايسبس + ترابيس',
         muscles:['ظهر لاتس','ظهر سمك','دلتا خلفي','بايسبس','ترابيس'],
         groups:[['back','lats'],['back','lats'],['back','mid'],['shoulders','rear'],['biceps','short'],['traps','all']],
         warm:W.pull,stretch:[...S.back,...S.arms]},
        // Legs 1 (PPL 5-day): كوادز Focus — سكوات + مكبس + عزل كوادز + هامستينج RDL خفيف للتوازن + سمانة + ضامة
        // على 5 أيام = يوم أرجل واحد فقط — القاعدة: Knee Dominant مع RDL خفيف لل Agonist/Antagonist balance
        // لا يوجد Legs 2 على 5 أيام - الهامستينج يغطى ب RDL خفيف (3×10) دون إجهاد ال Hip Hinge الكامل
        {name:'Legs — سكوات + مكبس + عزل كوادز + RDL + جلوتس + سمانة + ضامة',
         muscles:['كوادز','هامستينج','جلوتس','سمانة','ضامة'],
         groups:[['quads','dominant'],['quads','dominant'],['quads','isolation'],['hamstrings','isolation'],['hamstrings','dominant'],['hamstrings','glutes'],['calves','gastrocnemius'],['adductors','all']],
         warm:W.legs_quad,stretch:[...S.legs,...S.glutes]},
        // Push 2: صدر علوي + صدر مسطح + جانبي دامبل + جانبي كابل + كتف أمامي + تراي قصير + طويل
        {name:'Push 2 — صدر علوي + مسطح + جانبي دامبل + كابل + كتف أمامي + ترايسبس جانبي',
         muscles:['صدر علوي','صدر مسطح','أكتاف جانبي','ترايسبس'],
         groups:[['chest','upper'],['chest','mid'],['shoulders','lateral'],['shoulders','lateral'],['shoulders','press'],['triceps','lateral']],
         warm:W.push,stretch:[...S.chest,...S.shoulders,...S.arms]},
        // Pull 2: سمك تجديف + سمك كابل + لاتس + كتف خلفي + قطنية + بايسبس طويل + قصير
        {name:'Pull 2 — سمك تجديف + كابل + لاتس + كتف خلفي + قطنية + بايسبس + ساعد',
         muscles:['ظهر سمك','ظهر لاتس','دلتا خلفي','ظهر سفلي','بايسبس','ساعد'],
         groups:[['back','mid'],['back','mid'],['back','lats'],['shoulders','rear'],['back','lower'],['biceps','long'],['forearms','all']],
         warm:W.pull,stretch:[...S.back,...S.arms]}
      ];
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PPL Standard 6 أيام — مطابق لل document بالكامل
    // Push1 - Pull1 - Legs1 - Push2 - Pull2 - Legs2
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    return[
      // Push 1: صدر مسطح + صدر علوي + كتف جانبي + كتف أمامي + تراي طويل + تراي قصير
      {name:'Push 1 — صدر مسطح + علوي + كتف جانبي/أمامي + ترايسبس رأس طويل',
       muscles:['صدر مسطح','صدر علوي','أكتاف','ترايسبس'],
       groups:[['chest','mid'],['chest','upper'],['shoulders','lateral'],['shoulders','press'],['triceps','long']],
       warm:W.push,stretch:[...S.chest,...S.shoulders,...S.arms]},
      // Pull 1: لاتس واسع + لاتس ضيق + ظهر سمك + كتف خلفي + بايسبس قصير + عضدية
      {name:'Pull 1 — لاتس واسع + ضيق + سمك + كتف خلفي + بايسبس + ترابيس',
       muscles:['ظهر لاتس','ظهر سمك','دلتا خلفي','بايسبس','ترابيس'],
       groups:[['back','lats'],['back','lats'],['back','mid'],['shoulders','rear'],['biceps','short'],['traps','all']],
       warm:W.pull,stretch:[...S.back,...S.arms]},
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PPL 6-DAY LEGS STRATEGIC SPLIT RESTORE
      // Legs 1 = كوادز Focus (Squat pattern — Knee Dominant)
      // Legs 2 = هامستينج Focus (Hinge pattern — Hip Dominant)
      // الخلط بينهما يمنع الوصول لل Hypertrophy المطلوب لأن الجهاز العصبي
      // لا يستطيع تحقيق إجهاد كاف (Mechanical Tension) لكلا الأنماط في نفس الجلسة
      // ─────────────────────────────────────────────────────────────────
      // Legs 1: كوادز Focus — سكوات + مكبس + عزل كوادز + هامستينج خفيف (لونج) + سمانة + ضامة
      {name:'Legs 1 — سكوات + مكبس + عزل كوادز + لونج + سمانة + ضامة',
       muscles:['كوادز','هامستينج خفيف','سمانة','ضامة'],
       groups:[['quads','dominant'],['quads','dominant'],['quads','isolation'],['hamstrings','dominant'],['calves','gastrocnemius'],['adductors','all']],
       warm:W.legs_quad,stretch:[...S.legs,...S.glutes]},
      // Push 2: صدر علوي + صدر مسطح + جانبي دامبل + جانبي كابل + كتف أمامي + تراي قصير + طويل
      {name:'Push 2 — صدر علوي + مسطح + جانبي دامبل + كابل + كتف أمامي + ترايسبس جانبي',
       muscles:['صدر علوي','صدر مسطح','أكتاف جانبي','ترايسبس'],
       groups:[['chest','upper'],['chest','mid'],['shoulders','lateral'],['shoulders','lateral'],['shoulders','press'],['triceps','lateral']],
       warm:W.push,stretch:[...S.chest,...S.shoulders,...S.arms]},
      // Pull 2: سمك تجديف + سمك كابل + لاتس + كتف خلفي + قطنية + بايسبس طويل + قصير
      {name:'Pull 2 — سمك تجديف + كابل + لاتس + كتف خلفي + قطنية + بايسبس + ساعد',
       muscles:['ظهر سمك','ظهر لاتس','دلتا خلفي','ظهر سفلي','بايسبس','ساعد'],
       groups:[['back','mid'],['back','mid'],['back','lats'],['shoulders','rear'],['back','lower'],['biceps','long'],['forearms','all']],
       warm:W.pull,stretch:[...S.back,...S.arms]},
      // Legs 2: هامستينج Focus — RDL + Leg Curl + Hip Thrust + كوادز خفيف + سمانة seated + ضامة
      // الفصل الاستراتيجي: Legs 1 = Knee Dominant | Legs 2 = Hip Dominant
      {name:'Legs 2 — RDL + Leg Curl + Hip Thrust + كوادز خفيف + سمانة + ضامة',
       muscles:['هامستينج','جلوتس','كوادز خفيف','سمانة','ضامة'],
       groups:[['hamstrings','isolation'],['hamstrings','dominant'],['hamstrings','dominant'],['hamstrings','glutes'],['quads','isolation'],['calves','gastrocnemius'],['adductors','all']],
       warm:W.legs_ham,stretch:[...S.legs,...S.glutes]}
    ];
  }
  if(splitKey==='stronglifts'){
    return[
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STRONGLIFTS PHILOSOPHY RESTORE — الأصل الكلاسيكي العنيف
      // CNS-based program: Compound movements ONLY (Squat/Bench/Row/OHP/Deadlift)
      // إضافة عزل (سواعد، جانبي، بطن مستقل) تحوله لبرنامج كمال أجسام مشوه
      // وتسحب الاستشفاء من التمارين الأم — تم التطهير الكامل للجدول
      // ─────────────────────────────────────────────────────────────────
      // Workout A: سكوات 5×5 + بنش بريس 5×5 + تجديف بار 5×5
      // (الترايسبس والبايسبس والكور تفعل تلقائيا كعضلات مساعدة في الكمباوند)
      {name:'StrongLifts A — سكوات 5×5 + بنش بريس 5×5 + تجديف بار 5×5',
       muscles:['كوادز','هامستينج','صدر','ظهر وسط','ظهر سفلي','كور'],
       groups:[['quads','dominant'],['hamstrings','dominant'],['chest','mid'],['back','mid'],['back','lower'],['core','all']],
       warm:W.full,stretch:[...S.legs,...S.chest,...S.back]},
      // Workout B: سكوات 5×5 + ضغط أكتاف 5×5 + ديدليفت 1×5
      // (اللاتس والبايسبس والكور تفعل تلقائيا في الديدليفت والضغط)
      {name:'StrongLifts B — سكوات 5×5 + ضغط أكتاف 5×5 + ديدليفت 1×5',
       muscles:['كوادز','هامستينج','أكتاف','ظهر سفلي','لاتس','ترابيس','كور'],
       groups:[['quads','dominant'],['hamstrings','dominant'],['shoulders','press'],['back','lower'],['back','lats'],['traps','all'],['core','all']],
       warm:W.full,stretch:[...S.legs,...S.shoulders,...S.back]},
      // Workout A (تكرار) — دورة StrongLifts الكلاسيكية: الأسبوع 1 = A · B · A
      {name:'StrongLifts A — سكوات 5×5 + بنش بريس 5×5 + تجديف بار 5×5',
       muscles:['كوادز','هامستينج','صدر','ظهر وسط','ظهر سفلي','كور'],
       groups:[['quads','dominant'],['hamstrings','dominant'],['chest','mid'],['back','mid'],['back','lower'],['core','all']],
       warm:W.full,stretch:[...S.legs,...S.chest,...S.back]}
    ].slice(0,days);
  }
  if(splitKey==='hybrid'){
    return[
      // Push: صدر علوي + صدر مسطح + كتف جانبي + كتف أمامي + تراي طويل + تراي قصير
      {name:'Push — صدر علوي + مسطح + كتف جانبي/أمامي + ترايسبس (رأسين)',muscles:['صدر','أكتاف','ترايسبس'],
       groups:[['chest','upper'],['chest','mid'],['shoulders','lateral'],['shoulders','press'],['triceps','long'],['triceps','lateral']],
       warm:W.push,stretch:[...S.chest,...S.shoulders,...S.arms]},
      // Pull: ظهر سمك + لاتس + كتف خلفي + بايسبس طويل + بايسبس قصير
      {name:'Pull — سمك + لاتس + كتف خلفي + ترابيس + قطنية + بايسبس (رأسين)',muscles:['ظهر','دلتا خلفي','ترابيس','ظهر سفلي','بايسبس'],
       groups:[['back','mid'],['back','lats'],['shoulders','rear'],['traps','all'],['back','lower'],['biceps','long'],['biceps','short']],
       warm:W.pull,stretch:[...S.back,...S.arms]},
      // Legs: خلفيات + كوادز + مؤخرة + سمانة واقف + سمانة جالس + بطن
      {name:'Legs — خلفيات + كوادز + مؤخرة + سمانة واقف + جالس + بطن',muscles:['هامستينج','كوادز','جلوتس','سمانة','كور'],
       groups:[['hamstrings','isolation'],['hamstrings','dominant'],['quads','dominant'],['hamstrings','glutes'],['calves','gastrocnemius'],['adductors','all']],
       warm:W.legs_ham,stretch:[...S.legs,...S.glutes]},
      // Upper: صدر مسطح + صدر علوي + لاتس + سمك + كتف جانبي + بايسبس + ترايسبس
      {name:'Upper — صدر مسطح + علوي + لاتس + سمك + كتف جانبي + كتف خلفي + بايسبس + ترايسبس + ترابيس',muscles:['صدر','ظهر','أكتاف','دلتا خلفي','ترابيس','ذراع'],
       groups:[['chest','mid'],['chest','upper'],['back','lats'],['back','mid'],['shoulders','lateral'],['shoulders','rear'],['traps','all'],['biceps','short'],['triceps','lateral']],
       warm:W.upper,stretch:[...S.chest,...S.back,...S.arms]},
      // Lower: خلفيات + كوادز + مؤخرة + سمانة + ضامة + كور
      // ANATOMY FIX: السواعد عضلة علوية — تدرب مع Pull أو Upper، ليس هنا
      // Lower يركز على: هامستينج + كوادز + جلوتس + سمانة + ضامة + كور (مستقيم)
      {name:'Lower — هامستينج + كوادز + جلوتس + سمانة + ضامة + كور',muscles:['هامستينج','كوادز','جلوتس','سمانة','ضامة','كور'],
       groups:[['hamstrings','isolation'],['hamstrings','dominant'],['quads','dominant'],['hamstrings','glutes'],['calves','gastrocnemius'],['adductors','all'],['core','all']],
       warm:W.legs_ham,stretch:[...S.legs,...S.glutes]}
    ].slice(0,days);
  }
  if(splitKey==='anterior_posterior'){
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Anterior/Posterior Split — 4 أيام فقط (هيكل صارم)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // مبدأ التقسيم الأساسي:
    //   Anterior (أمامي): كوادز · صدر · كتف أمامي+جانبي · بايسبس · ترايسبس · سمانة
    //   Posterior (خلفي): هامستينج · جلوتس · ظهر (لاتس+وسط+سفلي) · كتف خلفي + ترابيس
    //
    // التغطية الأسبوعية المستهدفة (2× لكل عضلة رئيسية):
    //   كوادز      : Ant A  + Ant B 
    //   صدر        : Ant A (مسطح+علوي) + Ant B (علوي+مسطح تفتيح) - 2× 
    //   بايسبس     : Ant A (short) + Ant B (long) - رأسين مختلفين 
    //   ترايسبس    : Ant A (lateral) + Ant B (long) - رأسين مختلفين 
    //   كتف جانبي  : Ant A  + Ant B 
    //   كتف أمامي  : Ant A  + Ant B  (مدمج مع الصدر)
    //   سمانة      : Ant A  + Ant B  (كفينيشر)
    //   هامستينج   : Post A (RDL dominant) + Post B (isolation+glutes) - 2× 
    //   جلوتس      : Post A (hip hinge) + Post B (thrust pattern) - 2× 
    //   ظهر لاتس   : Post A  + Post B 
    //   ظهر وسط    : Post A  + Post B 
    //   كتف خلفي   : Post A  + Post B 
    //   ترابيس     : Post B  (shrugs/face pull)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const base4=[

      // ── ANTERIOR A ────────────────────────────────────────────────────
      // السلسلة الأمامية — كوادز Squat + صدر مسطح (محور) + كتف جانبي + كتف أمامي + بايسبس short + ترايسبس lateral + سمانة
      {
        name:'Anterior A — كوادز + صدر مسطح + كتف جانبي + كتف أمامي + بايسبس + ترايسبس + سمانة',
        muscles:['كوادز','صدر','أكتاف جانبي','أكتاف أمامي','بايسبس','ترايسبس','سمانة'],
        groups:[
          ['quads','dominant'],      // كوادز compound (Squat/Hack Squat — محور)
          ['quads','isolation'],     // كوادز عزل (Leg Extension)
          ['chest','mid'],           // صدر مسطح (Flat Bench)
          ['chest','upper'],         // صدر علوي (Incline)
          ['shoulders','lateral'],   // كتف جانبي (Lateral Raise)
          ['shoulders','press'],     // كتف أمامي (DB Shoulder Press)
          ['triceps','lateral'],     // ترايسبس رأس جانبي (Pushdown)
          ['biceps','short'],        // بايسبس رأس قصير (Barbell/EZ Curl)
          ['calves','gastrocnemius'] // سمانة (Standing Calf Raise — فينيشر)
        ],
        warm:[...W.push,...W.legs_quad.slice(0,2)],
        stretch:[...S.chest,...S.legs,...S.arms]
      },

      // ── POSTERIOR A ───────────────────────────────────────────────────
      // السلسلة الخلفية — هامستينج RDL (محور) + جلوتس Hip Hinge + لاتس + ظهر وسط + ظهر سفلي + كتف خلفي + ترابيس
      {
        name:'Posterior A — هامستينج RDL + جلوتس Hip Hinge + لاتس + ظهر سمك + ظهر سفلي + كتف خلفي + ترابيس',
        muscles:['هامستينج','جلوتس','ظهر لاتس','ظهر سمك','ظهر سفلي','دلتا خلفي','ترابيس'],
        groups:[
          ['hamstrings','dominant'], // هامستينج RDL (Romanian Deadlift — محور اليوم)
          ['hamstrings','dominant'], // هامستينج compound (Stiff Leg Deadlift)
          ['hamstrings','glutes'],   // جلوتس Hip Hinge (Hip Thrust / Glute Bridge)
          ['back','lats'],           // لاتس (Weighted Pull-Up / Lat Pull-Down)
          ['back','mid'],            // ظهر سمك (Barbell Row / T-Bar Row)
          ['back','lower'],          // ظهر سفلي (Back Extension خفيف — القطنية مفعلة كمثبت في RDL)
          // SPINE SAFETY: لا عزل قطنية مستقل هنا — RDL يجهد القطنية ك Stabilizer بقوة رهيبة
          // إضافة تمرين قطنية منفصل = إرهاق مضاعف لأسفل الظهر - خطر انزلاق غضروفي
          ['shoulders','rear'],      // كتف خلفي (Face Pull / Rear Delt Fly)
          ['traps','all']            // ترابيس (Barbell Shrugs / Cable Shrug)
        ],
        warm:[...W.pull,...W.legs_ham.slice(0,2)],
        stretch:[...S.back,...S.legs,...S.glutes]
      },

      // ── ANTERIOR B ────────────────────────────────────────────────────
      // السلسلة الأمامية — صدر علوي (محور) + كوادز لونج + كتف جانبي+أمامي + بايسبس long + ترايسبس long + ضامة + سمانة
      {
        name:'Anterior B — صدر علوي + كوادز لونج + كتف جانبي+أمامي + بايسبس long + ترايسبس long + ضامة + سمانة',
        muscles:['صدر علوي','كوادز','أكتاف','بايسبس','ترايسبس','ضامة','سمانة'],
        groups:[
          ['chest','upper'],         // صدر علوي (Incline — محور اليوم)
          ['chest','mid'],           // صدر تفتيح (Cable Fly/Dumbbell Fly)
          ['quads','dominant'],      // كوادز لونج (Bulgarian Split Squat/Walking Lunge)
          ['shoulders','lateral'],   // كتف جانبي (Cable Lateral Raise)
          ['shoulders','press'],     // كتف أمامي (Overhead Press)
          ['triceps','long'],        // ترايسبس رأس طويل (Overhead Extension)
          ['biceps','long'],         // بايسبس رأس طويل (Incline Curl/Hammer Curl)
          ['adductors','all'],       // ضامة (Adductor Machine / Sumo Squat finish)
          ['calves','gastrocnemius'] // سمانة (Seated Calf Raise — soleus focus)
        ],
        warm:W.push,
        stretch:[...S.chest,...S.shoulders,...S.arms,...S.legs]
      },

      // ── POSTERIOR B ───────────────────────────────────────────────────
      // السلسلة الخلفية — هامستينج Leg Curl + جلوتس Hip Thrust (محور) + لاتس + ظهر وسط + كتف خلفي + ترابيس + ضامة
      {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // POSTERIOR B — Knee Flexion Focus (contrast مع Posterior A = Hip Hinge Focus)
        // SPINE SAFETY: لا عزل قطنية منفرد هنا — الظهر السفلي مفعل ك Stabilizer
        // في Leg Curl + Hip Thrust بقوة كافية — عزل إضافي = مقدمة لانزلاق غضروفي
        // الفرق الاستراتيجي بين A و B:
        //   Posterior A = RDL + Hip Hinge (محور الهامستينج القريب من الجلوتس)
        //   Posterior B = Leg Curl + Hip Thrust (محور الهامستينج القريب من الركبة)
        // ─────────────────────────────────────────────────────────────────
        name:'Posterior B — هامستينج Curl + جلوتس Hip Thrust + لاتس + ظهر وسط + كتف خلفي + ترابيس + ضامة',
        muscles:['هامستينج','جلوتس','ظهر لاتس','ظهر وسط','دلتا خلفي','ترابيس','ضامة'],
        groups:[
          ['hamstrings','isolation'], // هامستينج Leg Curl (Lying/Seated — Knee Flexion)
          ['hamstrings','dominant'], // هامستينج Nordic / Single Leg Curl
          ['hamstrings','glutes'],   // جلوتس Hip Thrust (Barbell Hip Thrust — محور اليوم)
          ['back','lats'],           // لاتس (Pull-Down زاوية مختلفة / Close Grip)
          ['back','mid'],            // ظهر وسط (Cable Row / Machine Row)
          ['back','lower'],          // ظهر سفلي — Stabilizer فقط، لا عزل مستقل هنا
          ['shoulders','rear'],      // كتف خلفي (Rear Delt Machine / Cable Fly)
          ['traps','all'],           // ترابيس (DB Shrugs / Smith Machine Shrug)
          ['adductors','all']        // ضامة (Adductor Machine / Cable Pull-Through)
        ],
        warm:W.pull,
        stretch:[...S.back,...S.glutes,...S.shoulders,...S.legs]
      }
    ];
    return base4.slice(0,4); // anterior_posterior هيكل 4 أيام فقط — hard limit
  }
  if(splitKey==='ppl_weak'){
    const weak=(state.weak||[]);

    // ── Weak Point Day definition ─────────────────────────────────────────
    // If user selected weak points - dedicated weak point day targeting those muscles
    // If no weak points selected - Active Recovery + Rear Chain day (always valuable)
    let weakDayName, weakDayMuscles, weakDayGroups, weakDayWarm, weakDayStretch;

    if(weak.length > 0){
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // WEAK POINT DAY — 100% DYNAMIC (Blood Pooling Principle)
      // القاعدة الذهبية: يوم نقطة الضعف = "جوكر" السيستم
      // لا عضلات إجبارية — كل الزوايا تأتي حصرا من اختيار المتدرب
      // ضخ الدم (Blood Pooling) يتحقق فقط عند التركيز على منطقة واحدة أو اثنتين
      // إضافة عضلات غير مطلوبة (جوانب/سواعد إجبارية) = تشتيت ضخ الدم = صفر استفادة
      // ─────────────────────────────────────────────────────────────────
      weakDayGroups = []; // يبدأ فارغا — كل شيء من المتدرب
      weakDayMuscles = [];
      if(weak.includes('chest'))    { weakDayGroups.push(['chest','upper'],['chest','mid'],['chest','lower']); weakDayMuscles.push('صدر'); }
      if(weak.includes('back'))     { weakDayGroups.push(['back','lats'],['back','mid']); weakDayMuscles.push('ظهر'); }
      if(weak.includes('shoulders')){ weakDayGroups.push(['shoulders','press'],['shoulders','lateral'],['shoulders','rear']); weakDayMuscles.push('أكتاف'); }
      if(weak.includes('arms'))     { weakDayGroups.push(['biceps','long'],['biceps','short'],['triceps','long'],['triceps','lateral']); weakDayMuscles.push('ذراع'); }
      if(weak.includes('legs'))     { weakDayGroups.push(['quads','dominant'],['quads','isolation'],['hamstrings','isolation'],['hamstrings','dominant']); weakDayMuscles.push('أرجل'); }
      if(weak.includes('glutes'))   { weakDayGroups.push(['hamstrings','glutes'],['hamstrings','glutes']); weakDayMuscles.push('جلوتس'); }
      if(weak.includes('calves'))   { weakDayGroups.push(['calves','gastrocnemius'],['calves','gastrocnemius']); weakDayMuscles.push('سمانة'); }
      if(weak.includes('traps'))    { weakDayGroups.push(['traps','all'],['traps','all']); weakDayMuscles.push('ترابيس'); }
      // core & forearms: لا عزل إجباري — يضافان فقط لو اختارهما المتدرب صراحة
      if(weak.includes('forearms')) { weakDayGroups.push(['forearms','all']); weakDayMuscles.push('سواعد'); }
      if(weak.includes('core'))     { weakDayGroups.push(['core','all']); weakDayMuscles.push('كور'); }
      weakDayName = 'Weak Point Day  — ' + weakDayMuscles.join(' + ');
      weakDayWarm = [...W.upper.slice(0,2), ...W.pull.slice(0,2)];
      weakDayStretch = [...S.shoulders, ...S.arms];
    } else {
      // No weak points - Weak Point Day الافتراضي: كتف جانبي دامبل + كابل + خلفي + صدر علوي + سمانة واقف + جالس
      weakDayGroups = [
        ['shoulders','lateral'], ['shoulders','lateral'], ['shoulders','rear'],
        ['chest','upper'], ['calves','gastrocnemius'], ['calves','gastrocnemius']
      ];
      weakDayMuscles = ['كتف جانبي','كتف خلفي','صدر علوي','سمانة'];
      weakDayName = 'Weak Point Day — كتف جانبي + خلفي + صدر علوي + سمانة';
      weakDayWarm = [...W.pull.slice(0,2), ...W.legs_ham.slice(0,2)];
      weakDayStretch = [...S.glutes, ...S.back, ...S.shoulders];
    }

    const basePPLW=[
      {name:'Push — صدر علوي + أكتاف أمامي/جانبي + ترايسبس (رأسين)',muscles:['صدر علوي','أكتاف','ترايسبس','سمانة'],groups:[['chest','upper'],['chest','mid'],['shoulders','lateral'],['shoulders','press'],['triceps','long'],['triceps','lateral'],['calves','gastrocnemius']],warm:W.push,stretch:[...S.chest,...S.shoulders,...S.arms]},
      {name:'Pull — ظهر لاتس + وسط + دلتا خلفي + ترابيس + بايسبس (رأسين)',muscles:['ظهر','دلتا خلفي','ترابيس','بايسبس','ضامة'],groups:[['back','lats'],['back','mid'],['shoulders','rear'],['traps','all'],['biceps','long'],['biceps','short'],['adductors','all']],warm:W.pull,stretch:[...S.back,...S.arms]},
      {name:'Legs — كوادز + هامستينج + جلوتس + سمانة + ضامة',muscles:['كوادز','هامستينج','جلوتس','سمانة','ضامة','ترابيس'],groups:[['quads','dominant'],['quads','isolation'],['hamstrings','isolation'],['hamstrings','dominant'],['hamstrings','glutes'],['calves','gastrocnemius'],['adductors','all'],['traps','all']],warm:W.legs_quad,stretch:[...S.legs,...S.glutes]},
      {name:weakDayName, muscles:[...new Set(weakDayMuscles)].slice(0,5), groups:weakDayGroups.slice(0,7), warm:weakDayWarm, stretch:weakDayStretch}
    ];
    return basePPLW.slice(0,4); // ppl_weak هيكل 4 أيام فقط — hard cap
  }
  if(splitKey==='torso_limbs'){
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Torso / Limbs Split — 4 أيام (Torso×2 + Limbs×2)
    // الفلسفة: الجذع (صدر/ظهر/أكتاف/ترابيس) في يومي Torso،
    //          الأطراف (أرجل + ذراع) في يومي Limbs.
    // كل عضلة رئيسية 2×/أسبوع — والذراع يأخذ يوما مخصصا بجودة أعلى
    // بدلا من تكدسه في نهاية يوم Upper كما في Upper/Lower.
    //
    // التغطية الأسبوعية مطابقة ل Upper/Lower (الذي يجتاز كل قواعد المراجع):
    //   chest×4 · back×6 · shoulders×5 · traps×2 · biceps×2 · triceps×2 ·
    //   quads×3 · hamstrings×4 · glutes×2 · calves×2 · adductors×2
    // لكن biceps/triceps ينقلان إلى أيام Limbs لرفع جودتهما.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    return[

      // ── TORSO 1 ──────────────────────────────────────────────────────
      // محور: صدر مسطح + ظهر لاتس + كتف جانبي/خلفي + ترابيس
      {
        name:'Torso 1 — صدر مسطح + علوي + لاتس + ظهر وسط + كتف جانبي + كتف خلفي + ترابيس',
        muscles:['صدر','ظهر','أكتاف','دلتا خلفي','ترابيس'],
        groups:[
          ['chest','mid'],           // صدر مسطح (Flat Bench — محور اليوم)
          ['chest','upper'],         // صدر علوي (Incline)
          ['back','lats'],           // لاتس (Pull-Down / Weighted Pull-Up)
          ['back','mid'],            // ظهر وسط (Row)
          ['shoulders','lateral'],   // كتف جانبي (Lateral Raise)
          ['shoulders','rear'],      // كتف خلفي (Rear Delt Fly / Face Pull)
          ['traps','all']            // ترابيس (Shrug / Face Pull)
        ],
        warm:W.upper,
        stretch:[...S.chest,...S.back,...S.shoulders]
      },

      // ── LIMBS 1 ──────────────────────────────────────────────────────
      // محور: كوادز Squat + هامستينج RDL + جلوتس + ذراع (بايسبس short + ترايسبس lateral)
      {
        name:'Limbs 1 — كوادز Squat + عزل + هامستينج RDL + جلوتس + سمانة + ضامة + بايسبس + ترايسبس',
        muscles:['كوادز','هامستينج','جلوتس','سمانة','ضامة','بايسبس','ترايسبس'],
        groups:[
          ['quads','dominant'],        // كوادز compound (Squat / Hack Squat — محور اليوم)
          ['quads','isolation'],       // كوادز عزل (Leg Extension)
          ['hamstrings','dominant'],   // هامستينج RDL (Romanian Deadlift)
          ['hamstrings','dominant'],   // هامستينج compound (Leg Press / Stiff Leg)
          ['hamstrings','glutes'],     // جلوتس Hip Hinge (Hip Thrust / Glute Bridge)
          ['calves','gastrocnemius'],  // سمانة (Standing Calf Raise)
          ['adductors','all'],         // ضامة (Adductor Machine / Sumo)
          ['back','lower'],            // ظهر سفلي (Squat يحمل القطنية — Back Extension خفيف)
          ['biceps','short'],          // بايسبس رأس قصير (Barbell / EZ Curl)
          ['triceps','lateral']        // ترايسبس رأس جانبي (Pushdown)
        ],
        warm:W.legs_quad,
        stretch:[...S.legs,...S.glutes,...S.arms]
      },

      // ── TORSO 2 ──────────────────────────────────────────────────────
      // محور: صدر علوي + ظهر سمك + كتف أمامي (press) + كتف خلفي + ترابيس
      {
        name:'Torso 2 — صدر علوي + تفتيح + ظهر سمك + لاتس + كتف أمامي + جانبي + خلفي + ترابيس',
        muscles:['صدر علوي','ظهر','أكتاف أمامي','دلتا خلفي','ترابيس'],
        groups:[
          ['chest','upper'],         // صدر علوي (Incline — محور اليوم)
          ['chest','mid'],           // صدر تفتيح (Cable / Dumbbell Fly)
          ['back','mid'],            // ظهر سمك (Seated Row)
          ['back','lats'],           // لاتس (Pull-Down زاوية مختلفة)
          ['shoulders','press'],     // كتف أمامي (Overhead Press)
          ['shoulders','lateral'],   // كتف جانبي (Cable Lateral Raise)
          ['shoulders','rear'],      // كتف خلفي (Rear Delt Machine)
          ['traps','all']            // ترابيس (Shrugs)
        ],
        warm:W.upper,
        stretch:[...S.chest,...S.back,...S.shoulders]
      },

      // ── LIMBS 2 ──────────────────────────────────────────────────────
      // محور: هامستينج Curl + جلوتس Thrust + كوادز لونج + ذراع (بايسبس long + ترايسبس long)
      {
        name:'Limbs 2 — هامستينج Curl + جلوتس Thrust + كوادز لونج + سمانة + ضامة + بايسبس + ترايسبس',
        muscles:['هامستينج','جلوتس','كوادز','سمانة','ضامة','بايسبس','ترايسبس'],
        groups:[
          ['hamstrings','isolation'],  // هامستينج Leg Curl (Lying / Seated)
          ['hamstrings','dominant'],   // هامستينج Stiff Leg / Nordic
          ['hamstrings','glutes'],     // جلوتس Hip Thrust (Barbell Hip Thrust — محور اليوم)
          ['quads','dominant'],        // كوادز لونج (Walking Lunge / Bulgarian Split Squat)
          ['back','lower'],            // ظهر سفلي (Back Extension / Hyperextension)
          ['calves','gastrocnemius'],  // سمانة seated (Seated Calf Raise — soleus)
          ['adductors','all'],         // ضامة (Cable Pull-Through / Sumo)
          ['biceps','long'],           // بايسبس رأس طويل (Incline / Hammer Curl)
          ['triceps','long']           // ترايسبس رأس طويل (Overhead Extension)
        ],
        warm:W.legs_ham,
        stretch:[...S.legs,...S.glutes,...S.arms]
      }

    ].slice(0,days); // torso_limbs هيكل 4 أيام فقط — hard cap
  }
  if(splitKey==='ppul'){
    // Push / Pull / Upper / Lower — 4 أيام | صدر/ظهر/أكتاف/ذراع 2× · أرجل 1× (Lower مكثف)
    return[
      {name:'Push — صدر علوي + مسطح + كتف أمامي/جانبي + ترايسبس + سمانة',
       muscles:['صدر','أكتاف','ترايسبس','سمانة'],
       groups:[['chest','upper'],['chest','mid'],['shoulders','press'],['shoulders','lateral'],['triceps','long'],['triceps','lateral'],['calves','gastrocnemius']],
       warm:W.push,stretch:[...S.chest,...S.shoulders,...S.arms]},
      {name:'Pull — لاتس + ظهر سمك + كتف خلفي + ترابيس + بايسبس + ضامة',
       muscles:['ظهر','دلتا خلفي','ترابيس','بايسبس'],
       groups:[['back','lats'],['back','mid'],['shoulders','rear'],['traps','all'],['biceps','long'],['biceps','short'],['adductors','all']],
       warm:W.pull,stretch:[...S.back,...S.arms]},
      {name:'Upper — صدر + ظهر + كتف جانبي/خلفي + بايسبس + ترايسبس + ترابيس',
       muscles:['صدر','ظهر','أكتاف','بايسبس','ترايسبس','ترابيس'],
       groups:[['chest','mid'],['chest','upper'],['back','lats'],['back','mid'],['shoulders','lateral'],['shoulders','rear'],['biceps','short'],['triceps','lateral'],['traps','all']],
       warm:W.upper,stretch:[...S.chest,...S.back,...S.arms,...S.shoulders]},
      {name:'Lower — كوادز + هامستينج + جلوتس + سمانة + ضامة',
       muscles:['كوادز','هامستينج','جلوتس','سمانة','ضامة'],
       groups:[['quads','dominant'],['quads','isolation'],['hamstrings','dominant'],['hamstrings','isolation'],['hamstrings','glutes'],['calves','gastrocnemius'],['adductors','all']],
       warm:W.legs_quad,stretch:[...S.legs,...S.glutes,...S.back]}
    ].slice(0,days);
  }
  if(splitKey==='ululf'){
    // Upper/Lower/Upper/Lower/Full — 5 أيام | يعيد استخدام أيام U/L المتوازنة + يوم Full للموازنة
    // التردد: علوي 2× + Full = ~3× | سفلي 2× + Full = ~3×
    const ul = getSplitSchedule('upper_lower', 4);
    const fullDay = {
      name:'Full Body — يوم الموازنة: كوادز + هامستينج + صدر + ظهر + كتف جانبي + بايسبس + ترايسبس + سمانة',
      muscles:['كوادز','هامستينج','صدر','ظهر','أكتاف','بايسبس','ترايسبس','سمانة'],
      groups:[['quads','dominant'],['hamstrings','dominant'],['chest','mid'],['back','lats'],['shoulders','lateral'],['biceps','long'],['triceps','long'],['calves','gastrocnemius']],
      warm:W.full,stretch:[...S.legs,...S.chest,...S.back,...S.arms]
    };
    return [ul[0],ul[1],ul[2],ul[3],fullDay].slice(0,days);
  }
  if(splitKey==='ul6'){
    // Upper/Lower ×3 — 6 أيام — كل عضلة 3×/أسبوع (متقدم/تعافي عال)
    // يعيد استخدام أيام U/L الأربعة + يوم علوي ثالث + يوم سفلي ثالث مختلفين
    const ul = getSplitSchedule('upper_lower', 4);
    const upper3 = {
      name:'Upper 3 — صدر + ظهر + كتف جانبي/خلفي + بايسبس + ترايسبس + ترابيس',
      muscles:['صدر','ظهر','أكتاف','بايسبس','ترايسبس','ترابيس'],
      groups:[['chest','mid'],['back','lats'],['back','mid'],['shoulders','lateral'],['shoulders','rear'],['biceps','short'],['biceps','long'],['triceps','long'],['triceps','lateral'],['traps','all']],
      warm:W.upper,stretch:[...S.chest,...S.back,...S.arms,...S.shoulders]
    };
    const lower3 = {
      name:'Lower 3 — جلوتس + هامستينج + كوادز + سمانة + ضامة',
      muscles:['جلوتس','هامستينج','كوادز','سمانة','ضامة'],
      groups:[['hamstrings','glutes'],['hamstrings','isolation'],['hamstrings','dominant'],['quads','dominant'],['quads','isolation'],['calves','gastrocnemius'],['adductors','all']],
      warm:W.legs_ham,stretch:[...S.legs,...S.glutes]
    };
    return [ul[0],ul[1],ul[2],ul[3],upper3,lower3].slice(0,days);
  }
  return[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PICK EXERCISES — الإصدار الاحترافي الكامل
// حجم الجلسة حسب المستوى (FIX-4):
//   مبتدئ  ذكر - 5-6 تمارين، 12-16 مجموعة    (ACSM untrained)
//   مبتدئ  أنثى - 4-5 تمارين، 10-14 مجموعة
//   متوسط  ذكر - 6-7 تمارين، 15-19 مجموعة
//   متوسط  أنثى - 5-6 تمارين، 13-16 مجموعة
//   متقدم  ذكر - 6-7 تمارين، 18-21 مجموعة
//   متقدم  أنثى - 5-6 تمارين، 15-18 مجموعة
// المصدر: GYM_DB للجيم — HOME_DB للمنزل
// الإصابات تحذف تمارينها تلقائيا
// الهدف يؤثر على عدد المجموعات والعدات والراحة
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
