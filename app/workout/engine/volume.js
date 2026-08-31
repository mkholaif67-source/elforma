/* ============================================================================
 * engine/volume.js — Headless volume standards & weekly-hierarchy enforcers.
 * Extracted verbatim from ui/components.js (v49 engine extraction).
 * PURE: no DOM, no rendering. Operates on plan arrays + the global `state`.
 * Loaded as a classic script BEFORE ui/components.js (browser) and listed in
 * every vm test harness that loads components.js.
 * ==========================================================================*/
'use strict';

// ── buildCoverageVisualState ──────────────────────────────────────────
// Pure visualization helper: receives raw engine data, returns UI card objects.
// NEVER recalculates training logic. Read-only.
// ── MUSCLE-SPECIFIC MEV/MRV STANDARDS ────────────────────────────────
// Source: Gymna Pro / Israetel MEV standards (image reference)
// Each entry: { mev: minimum effective volume, opt: optimal target, optFreq }
// ──────────────────────────────────────────────────────────────────────
// MUSCLE_VOLUME_STANDARDS — عتبات مشتقة من MAV الفعلي للبرامج المتوازنة
// المبدأ: برنامج متوازن ومدروس يجب أن يصل 75-85 — مش 55-65
// mev  = الحد الأدنى الفعال (أقل منه = low)
// good = نطاق جيد (ما تنتجه البرامج المتوازنة فعلا)
// opt  = النطاق المثالي (يحتاج تكرار كاف أيضا)
// ─────────────────────────────────────────────────────────────────────
const MUSCLE_VOLUME_STANDARDS = {
  // ── عضلات أساسية (وزن ×3 في الدرجة) ─────────────────────────────
  chest:       { mev: 6,  good: 10, opt: 14, optFreq: 2 },
  back:        { mev: 6,  good: 10, opt: 14, optFreq: 2 },
  // كوادز/هامستينج: optFreq=1 لأن يوم الأرجل الواحد المكثف (12-18 sets) يكافئ يومين معتدلين
  quads:       { mev: 6,  good:  8, opt: 12, optFreq: 1 },
  hamstrings:  { mev: 4,  good:  7, opt:  9, optFreq: 1 }, // بعد فصل الجلوتس — sets الهامستينج الحقيقية أقل
  shoulders:   { mev: 6,  good:  9, opt: 13, optFreq: 2 },

  // ── عضلات ثانوية (وزن ×2 في الدرجة) ─────────────────────────────
  biceps:      { mev: 5,  good:  9, opt: 13, optFreq: 2 },
  triceps:     { mev: 4,  good:  8, opt: 11, optFreq: 2 },
  glutes:      { mev: 3,  good:  4, opt: 6,  optFreq: 1 }, // يوم أرجل واحد: 1 تمرين × 3-4 sets كاف

  // ── عضلات صغيرة مقيدة (session cap = الحد الأقصى) ──
  // السمانة: مبتدئ 3-5 | متوسط 4-6 | متقدم 6-9
  calves:      { mev: 3,  good:  5, opt:  9, optFreq: 1, _capped: true },
  adductors:   { mev: 3,  good:  5, opt:  8, optFreq: 1, _capped: true },
  traps:       { mev: 0,  good:  3, opt:  6, optFreq: 1, _capped: true },
  forearms:    { mev: 0,  good:  2, opt:  4, optFreq: 1, _capped: true },

  // ── عضلات ملحقة (وزن ×1 في الدرجة) ─────────────────────────────
  core:        { mev: 0,  good:  4, opt:  8, optFreq: 2 },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MUSCLE_WEEKLY_CAPS — الحد الأسبوعي الأقصى لكل عضلة حسب المستوى
// مشتق من الجدول العلمي المرجعي (Weekly Sets per Muscle)
// يطبق في hardAnchorCheck بعد كل passes لضمان عدم تجاوز السقف الأسبوعي
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const MUSCLE_WEEKLY_CAPS = {
  //            beginner  intermediate  advanced
  chest:      { beginner: 10, intermediate: 15, advanced: 20 },
  back:       { beginner: 10, intermediate: 15, advanced: 20 },
  quads:      { beginner: 10, intermediate: 15, advanced: 20 },
  hamstrings: { beginner:  8, intermediate: 12, advanced: 18 }, // ul6×3 lower days = 17-18 sets — within MAV range (Schoenfeld 2017)
  shoulders:  { beginner:  8, intermediate: 12, advanced: 15 },
  biceps:     { beginner:  6, intermediate: 12, advanced: 15 },
  triceps:    { beginner:  6, intermediate: 12, advanced: 15 },
  glutes:     { beginner:  6, intermediate:  9, advanced:  9 },
  calves:     { beginner:  6, intermediate:  9, advanced: 12 }, // رفع — سمانة في كل يوم أرجل = 3×2 = 6 minimum
  adductors:  { beginner:  6, intermediate:  6, advanced:  9 }, // ضامة — beginner رفع ل6: upper_lower يدربها يومين (2×2-3=4-6 على الأقل)
  forearms:   { beginner:  4, intermediate:  6, advanced:  9 },
  traps:      { beginner:  6, intermediate:  6, advanced:  9 },
  core:       { beginner:  6, intermediate:  8, advanced: 10 }, // FIX v25: أضيف لمنع تراكم sets الكور بلا حدود
};

/* ============================================================================
 * VOLUME MODEL — المصدر الموحد للحقيقة في الأحجام (v24 governance layer)
 * ----------------------------------------------------------------------------
 * طبقة توثيق + حارس اتساق. لا تغير أي رقم — فقط توحد الأدوار وتمنع
 * التضارب مستقبلا (نطور مش نهدم).
 *
 * النموذج الموحد = 4 أدوار متمايزة (ليست تكرارا لنفس الرقم):
 *   1) computeWeeklyBudget + WEEKLY_BUDGET (constants.js)
 * - الميزانية الأسبوعية الكلية + توزيع 60/20/20.
 *   2) getSetsForMuscle + MUSCLE_SET_RANGES (constants.js)
 * - مصدر التخصيص الوحيد. ال RANGES = حد أمان للجلسة (ليست مصدر حساب).
 *   3) MUSCLE_WEEKLY_CAPS (هنا)
 * - السقف الأسبوعي الصارم — يطبق بعد البناء (enforcement).
 *   4) MUSCLE_VOLUME_STANDARDS (هنا)
 * - مرجع علمي للعرض (coverage) وأرضية MEV. قيمة opt مرجع مطلق (متقدم)
 *          وقد تتجاوز سقف المبتدئ/المتوسط عمدا (ليست خطأ).
 *
 * الثابت الحاكم (INVARIANT): لكل عضلة×مستوى:
 *        MUSCLE_SET_RANGES.min ≤ MUSCLE_SET_RANGES.max ≤ MUSCLE_WEEKLY_CAPS
 * أي أن طبقة التخصيص لا تتجاوز أبدا طبقة ال enforcement.
 * ==========================================================================*/
function validateVolumeModel() {
  if (typeof MUSCLE_SET_RANGES === 'undefined' || typeof MUSCLE_WEEKLY_CAPS === 'undefined') return true;
  const exps = ['beginner', 'intermediate', 'advanced'];
  let ok = true;
  Object.keys(MUSCLE_SET_RANGES).forEach(m => {
    exps.forEach(e => {
      const rng = MUSCLE_SET_RANGES[m] && (MUSCLE_SET_RANGES[m][e] || MUSCLE_SET_RANGES[m].intermediate);
      const cap = MUSCLE_WEEKLY_CAPS[m] && MUSCLE_WEEKLY_CAPS[m][e];
      if (!rng) return;
      if (rng[0] > rng[1]) { ok = false; if (typeof console !== 'undefined') console.warn('[VolumeModel] ' + m + '/' + e + ': min(' + rng[0] + ')>max(' + rng[1] + ')'); }
      if (cap != null && rng[1] > cap) { ok = false; if (typeof console !== 'undefined') console.warn('[VolumeModel] ' + m + '/' + e + ': RANGE.max(' + rng[1] + ')>CAP(' + cap + ') — allocation exceeds enforcement ceiling'); }
    });
  });
  if (ok && typeof console !== 'undefined' && console.log) console.log('[VolumeModel] allocation - caps consistent across all muscles×levels');
  return ok;
}
try { validateVolumeModel(); } catch (e) {}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ██████╗ WEEKLY CAP ENFORCER — الحارس الصارم للسقف الأسبوعي لكل عضلة
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// يستدعى في أي مكان يضيف فيه sets (patches, modules, distribution)
// يضمن أن أي عضلة لا تتجاوز MUSCLE_WEEKLY_CAPS[grp][exp] مهما حدث
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * getMuscleTotalSets — يحسب مجموع sets لعضلة معينة عبر الخطة كلها
 */
function getMuscleTotalSets(plan, grp) {
  let total = 0;
  plan.forEach(day => {
    if (!day?.exercises?.length) return;
    day.exercises.forEach(ex => {
      if (ex.grp === grp) total += (ex.sets || 0);
    });
  });
  return total;
}

/**
 * getMuscleWeeklyCap — يعيد السقف الأسبوعي لعضلة حسب المستوى
 */
// FIX v25: recovery-driven effective cap for big muscles only (protects small-muscle audit floors)
const _RECOVERY_SCALED_MUSCLES = new Set(['chest','back','quads','hamstrings','shoulders','biceps','triceps']);
function getRecoveryVolumeFactor() {
  const r = (typeof state !== 'undefined' && state && typeof state.recoveryScore === 'number' && state.recoveryScore > 0) ? state.recoveryScore : 100; // unknown recovery => assume full (no phantom deload)
  if (r >= 82) return 1.0; // good recovery: no reduction (protects healthy profiles)
  return Math.max(0.80, 1 + (r - 82) * 0.005); // graduated deload down to 80% at deep fatigue
}
function getMuscleWeeklyCap(grp, exp) {
  const caps = MUSCLE_WEEKLY_CAPS[grp];
  if (!caps) return Infinity;
  const base = caps[exp] || caps.intermediate || Infinity;
  if (base === Infinity) return Infinity;
  if (_RECOVERY_SCALED_MUSCLES.has(grp)) {
    const f = getRecoveryVolumeFactor();
    return Math.max(Math.ceil(base * 0.80), Math.round(base * f));
  }
  return base;
}

/**
 * getSetsAllowedToAdd — كم set مسموح إضافتهم لعضلة بدون تجاوز السقف
 */
function getSetsAllowedToAdd(plan, grp, exp) {
  const cap = getMuscleWeeklyCap(grp, exp);
  if (cap === Infinity) return Infinity;
  const current = getMuscleTotalSets(plan, grp);
  return Math.max(0, cap - current);
}

/**
 * enforceWeeklyCapsOnPlan — يطبق بعد أي pass يضيف sets
 * يقطع كل عضلة تجاوزت سقفها الأسبوعي من isolation أولا ثم compound
 * لا يمس min sets لكل تمرين (متقدم: 3، غيره: 2)
 */
// ── WEEKLY HIERARCHY GUARD (v29) ───────────────────────────
// يضمن تفوق العضلات الرئيسية على المساعدة أسبوعيا داخل كل منطقة.
// الحل الذكي: ارفع الرئيسية أولا (تحت السقف)، وإلا قص المساعدة دون MEV.
function enforceWeeklyHierarchy(plan, exp) {
  if (!plan || !plan.length) return false;
  const _exp = exp || (typeof state !== 'undefined' ? state.exp : 'intermediate') || 'intermediate';
  const _minPerEx = _exp === 'advanced' ? 3 : 2;
  const _perExMax = 5;
  const DAILY_HARD = 21, LEGS_DAILY = 24;

  const MEV = {};
  Object.keys(MUSCLE_VOLUME_STANDARDS).forEach(k => { MEV[k] = MUSCLE_VOLUME_STANDARDS[k].mev || 0; });

  let changed = false;

  function weeklySets() {
    const s = {};
    plan.forEach(d => { if (d.isRest) return; (d.exercises||[]).forEach(ex => {
      if (!ex.grp) return;
      const k = (ex.grp === 'hamstrings' && ex.sub === 'glutes') ? 'glutes' : ex.grp;
      s[k] = (s[k]||0) + (ex.sets||0);
    }); });
    return s;
  }
  function dayTotal(di) { return (plan[di].exercises||[]).reduce((a,e)=>a+(e.sets||0),0); }
  function muscleExs(muscle) {
    const list = [];
    plan.forEach((d,di)=>{ if(d.isRest) return; (d.exercises||[]).forEach((ex,ei)=>{
      if(!ex.grp) return;
      const k = (ex.grp === 'hamstrings' && ex.sub === 'glutes') ? 'glutes' : ex.grp;
      if(k===muscle) list.push({di,ei});
    });});
    return list;
  }
  function muscleFreq(muscle) {
    let f = 0;
    plan.forEach(d => { if(d.isRest) return;
      const has = (d.exercises||[]).some(e => {
        if(!e.grp) return false;
        const k = (e.grp==='hamstrings'&&e.sub==='glutes')?'glutes':e.grp;
        return k===muscle;
      });
      if(has) f++;
    });
    return f;
  }
  function boostMuscle(muscle, target, legs, perExCap) {
    const pec = perExCap || _perExMax;
    let s = weeklySets(); let cur = s[muscle]||0;
    const cap = getMuscleWeeklyCap(muscle, _exp);
    const goal = Math.min(target, cap);
    if (cur >= goal) return cur;
    const exs = muscleExs(muscle);
    let guard = 0;
    while (cur < goal && guard++ < 80) {
      let added = false;
      for (const {di,ei} of exs) {
        if (cur >= goal) break;
        const ex = plan[di].exercises[ei]; if (!ex) continue;
        const dcap = legs ? LEGS_DAILY : DAILY_HARD;
        if ((ex.sets||0) >= pec) continue;
        if (dayTotal(di) >= dcap) continue;
        plan[di].exercises[ei] = Object.assign({}, ex, { sets:(ex.sets||0)+1, _hierBoosted:true });
        cur++; added = true; changed = true;
      }
      if (!added) break;
    }
    return cur;
  }
  function trimMuscle(muscle, ceiling, floor) {
    let s = weeklySets(); let cur = s[muscle]||0;
    const stop = Math.max(floor||0, ceiling);
    if (cur <= stop) return cur;
    const exs = muscleExs(muscle)
      .map(({di,ei}) => ({di,ei,rank:getExerciseRank(plan[di].exercises[ei])}))
      .sort((x,y)=> y.rank - x.rank);
    let g = 0;
    while (cur > stop && g++ < 80) {
      let removed = false;
      for (const {di,ei} of exs) {
        if (cur <= stop) break;
        const ex = plan[di].exercises[ei]; if (!ex || ex._protected) continue;
        if ((ex.sets||0) <= _minPerEx) continue;
        plan[di].exercises[ei] = Object.assign({}, ex, { sets: ex.sets-1, _hierTrimmed:true });
        cur--; removed = true; changed = true;
      }
      if (!removed) break;
    }
    // Phase 2: stuck at the per-exercise floor but still above the ceiling - 
    // remove whole lowest-rank slots (never dropping weekly volume below MEV floor).
    // This is what lets the hierarchy hold on splits where an accessory was
    // over-scheduled with many slots (e.g. fullbody shoulders, double triceps).
    if (cur > stop) {
      const slots = muscleExs(muscle)
        .map(({di,ei}) => ({di,ei,rank:getExerciseRank(plan[di].exercises[ei])}))
        .sort((x,y)=> x.rank - y.rank); // least valuable first
      for (const {di,ei} of slots) {
        if (cur <= stop) break;
        const ex = plan[di].exercises[ei]; if (!ex || ex._protected) continue;
        const exSets = ex.sets||0;
        if ((cur - exSets) < (floor||0)) continue; // keep weekly >= MEV floor
        plan[di].exercises[ei] = { sets:0, _hierRemoved:true };
        cur -= exSets; changed = true;
      }
    }
    return cur;
  }

  // TRAPS floor (run FIRST to claim daily room): high-frequency upper schedules
  // (back trained >=2x) deserve >=6 traps sets instead of a token 3.
  {
    const s = weeklySets();
    const trapsW = s.traps||0;
    if (muscleFreq('back') >= 2 && trapsW > 0 && trapsW < 6) {
      boostMuscle('traps', Math.min(6, getMuscleWeeklyCap('traps', _exp)), false, 6);
    }
  }

  // REGIONS: primaries must beat accessories. shoulders = soft (<=, equal allowed).
  const REGIONS = [
    { primaries:['quads','hamstrings'], accessories:['glutes','calves','adductors'], soft:[],            legs:true },
    { primaries:['chest','back'],       accessories:['biceps','triceps','traps'],    soft:['shoulders'], legs:false },
  ];

  REGIONS.forEach(({primaries, accessories, soft, legs}) => {
    let s = weeklySets();
    const allAcc = accessories.concat(soft||[]);
    const maxAccVal = Math.max(0, ...allAcc.map(a => s[a]||0));
    // 1) boost weakest primaries above the top accessory (preferred path)
    primaries.forEach(p => { if ((s[p]||0) > 0) boostMuscle(p, maxAccVal+1, legs); s = weeklySets(); });
    // 2) recompute weakest primary
    s = weeklySets();
    const weakP = Math.min(...primaries.map(p => s[p]||0).filter(v => v>0));
    if (!isFinite(weakP) || weakP <= 0) return;
    // 3) strict accessories: must be < weakP
    accessories.forEach(a => { trimMuscle(a, weakP-1, MEV[a]||0); });
    // 4) soft (shoulders): <= weakP (chest/back never below shoulders)
    (soft||[]).forEach(a => { trimMuscle(a, weakP, MEV[a]||0); });
  });

  // ARMS BALANCE: triceps == biceps (always equal)
  {
    let s = weeklySets();
    let bi = s.biceps||0, tri = s.triceps||0;
    if (bi > 0 && tri > 0 && bi !== tri) {
      const weakUP = Math.min(s.chest||999, s.back||999);
      const armCeil = Math.max(0, weakUP - 1);
      const hi = Math.max(bi, tri);
      const loMuscle = bi < tri ? 'biceps' : 'triceps';
      const target = Math.min(hi, armCeil, getMuscleWeeklyCap(loMuscle, _exp));
      boostMuscle(loMuscle, target, false);
      s = weeklySets(); bi = s.biceps||0; tri = s.triceps||0;
      if (bi !== tri) {
        const newLo = Math.min(bi, tri);
        const hiMuscle = bi > tri ? 'biceps' : 'triceps';
        trimMuscle(hiMuscle, newLo, Math.min(newLo, MEV[hiMuscle]||0));
      }
    }
  }

  // Clean up removed-slot tombstones left by trimMuscle Phase 2.
  plan.forEach(d => { if (d && d.exercises) d.exercises = d.exercises.filter(e => e && e.grp && (e.sets||0) > 0); });

  if (changed && typeof console !== 'undefined' && console.log) {
    console.log('[WeeklyHierarchy v31] primaries>accessories | shoulders<=chest/back | tri==bi | traps floor | slot-removal');
  }
  return changed;
}

function enforceWeeklyCapsOnPlan(plan, exp) {
  const _exp = exp || (typeof state !== 'undefined' ? state.exp : 'intermediate') || 'intermediate';
  const _minPerEx = _exp === 'advanced' ? 3 : 2;

  Object.keys(MUSCLE_WEEKLY_CAPS).forEach(grp => {
    const cap = getMuscleWeeklyCap(grp, _exp);
    const total = getMuscleTotalSets(plan, grp);
    if (total <= cap) return; // ضمن الحد

    let toRemove = total - cap;
    // جمع تمارين هذه العضلة مرتبة ب rank أعلى أولا (isolation يقطع قبل compound)
    const exsList = [];
    plan.forEach((day, di) => {
      if (!day?.exercises?.length) return;
      day.exercises.forEach((ex, ei) => {
        if (ex.grp === grp) exsList.push({ di, ei, sets: ex.sets || 0, rank: getExerciseRank(ex) });
      });
    });
    exsList.sort((a, b) => b.rank - a.rank || b.sets - a.sets);

    // ── Pass 1: تقليص sets مع الحفاظ على ال floor (_minPerEx) ──
    for (const { di, ei } of exsList) {
      if (toRemove <= 0) break;
      const ex = plan[di].exercises[ei];
      // السمانة والضامة المحقونة محمية — لا تحذف أبدا
      if (ex._protected) continue;
      const canRemove = Math.max(0, (ex.sets || 0) - _minPerEx);
      const remove = Math.min(toRemove, canRemove);
      if (remove > 0) {
        plan[di].exercises[ei] = { ...ex, sets: ex.sets - remove, _weeklyCapped: true };
        toRemove -= remove;
      }
    }

    // ── Pass 2: لو لسه فوق ال cap — احذف التمارين الزيادة كاملا (isolation أولا) ──
    // ده بيحصل لما كل التمارين وصلت لل floor ولا زال الإجمالي فوق ال cap
    if (toRemove > 0) {
      console.warn(`[WeeklyCapEnforcer]${grp} still ${toRemove} over cap — removing excess exercises`);
      // إعادة ترتيب: isolation (rank أعلى) أولا، ثم أقل sets
      exsList.sort((a, b) => b.rank - a.rank || a.sets - b.sets);
      for (const { di, ei } of exsList) {
        if (toRemove <= 0) break;
        const ex = plan[di].exercises[ei];
        if (!ex) continue;
        // السمانة والضامة المحقونة محمية — لا تحذف أبدا
        if (ex._protected) continue;
        const exSets = ex.sets || 0;
        if (exSets <= 0) continue;
        // حذف التمرين كله
        toRemove -= exSets;
        plan[di].exercises[ei] = { ...ex, sets: 0, _weeklyCapRemoved: true };
        console.log(`[WeeklyCapEnforcer]Removed all ${exSets} sets of "${ex.n}" (${grp}) to enforce cap`);
      }
      // تنظيف التمارين التي sets=0
      plan.forEach((day, di) => {
        if (!day?.exercises?.length) return;
        plan[di].exercises = day.exercises.filter(ex => (ex.sets || 0) > 0 || ex._protected);
      });
    }

    const finalTotal = getMuscleTotalSets(plan, grp);
    if (finalTotal > cap) {
      console.warn(`[WeeklyCapEnforcer] ${grp} STILL ${finalTotal - cap} over cap=${cap} — floor conflict`);
    } else {
      console.log(`[WeeklyCapEnforcer] ${grp} capped (${_exp}): ${total} - ${finalTotal} ≤ ${cap}`);
    }
  });
}
