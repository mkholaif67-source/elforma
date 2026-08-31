'use strict';
// ============================================================
//  Nutrition Engine Host (server-side)
//  Runs the SAME browser diet-engine files unchanged inside a
//  Node vm sandbox with a minimal DOM/localStorage shim, so the
//  premium plan-generation logic can execute on the server and
//  never ship to the client. Single source of truth = the same
//  files under app/diet/js that the browser loads.
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = path.join(__dirname, '..', 'app', 'diet', 'js');
// Compute-relevant engine files in browser load order.
// Excluded: 11_steps_ui / 20_dashboard_bridge / 21_data_integrity — pure UI/persistence layers not needed to compute a plan.
const FILES = [
  '00_core_bootstrap.js','01_food_intelligence.js','02_meal_rules_and_constraints.js',
  '03_scoring_and_validation.js','04_food_database.js','05_engine_state.js',
  '06_food_filter_and_search.js','07_day_planner.js','08_macro_optimizer.js',
  '09_smart_meal_logic.js','10_weekly_strategy.js','11_steps_ui.js','12_nutrition_calc_engine.js',
  '13_recommendation_results_export.js','15_diet_info.js','16_subsystems.js',
  '17_smart_meal_pool.js','18_root_fix_v40.js','19_engine_facade.js',
  // 21 repairs FOOD_MAP references and rule objects (resolveArray /
  // fixRuleObject). The website loads it; this host used to skip it, so the
  // app was planning meals against unrepaired rules. 20_dashboard_bridge.js
  // stays out on purpose: it is browser-only persistence (localStorage +
  // injecting a dashboard button into document.body) and changes no food.
  '21_data_integrity_v42.js',
  '22_egyptian_meal_intelligence.js','23_egy_affordability_v53.js','25_owner_rules_post.js'
];

let currentInputs = {};

function makeStub(){
  const f = function(){ return makeStub(); };
  return new Proxy(f, {
    get: function(t,p){ if(p===Symbol.iterator) return function*(){}; if(p==='length') return 0; return makeStub(); },
    set: function(){ return true; },
    apply: function(){ return makeStub(); },
    construct: function(){ return makeStub(); }
  });
}
function makeEl(value){
  const t = { value:value, innerHTML:'', textContent:'', value_:value, className:'', style:{}, dataset:{},
    classList:{ add:function(){}, remove:function(){}, toggle:function(){}, contains:function(){return false;} },
    children:[], childNodes:[], options:[] };
  const methods = { appendChild:1, removeChild:1, setAttribute:1, getAttribute:1, hasAttribute:1,
    addEventListener:1, removeEventListener:1, insertAdjacentHTML:1, remove:1, closest:1,
    querySelector:1, querySelectorAll:1, focus:1, click:1, scrollIntoView:1, cloneNode:1, replaceChildren:1 };
  return new Proxy(t, {
    get: function(o,p){ if(p in o) return o[p]; if(methods[p]) return function(){ return makeStub(); }; return makeStub(); },
    set: function(o,p,v){ o[p]=v; return true; }
  });
}

function buildContext(){
  // Build the context with NO request inputs in scope, so the DE snapshot
  // captured below reflects pristine engine defaults and never the first
  // caller's data.
  const _savedInputs = currentInputs;
  currentInputs = {};
  const _ls = new Map();
  const localStorage = {
    getItem:function(k){ return _ls.has(k)?_ls.get(k):null; },
    setItem:function(k,v){ _ls.set(k,String(v)); },
    removeItem:function(k){ _ls.delete(k); },
    clear:function(){ _ls.clear(); },
    key:function(i){ return Array.from(_ls.keys())[i]||null; }
  };
  Object.defineProperty(localStorage,'length',{ get:function(){ return _ls.size; } });
  const sandbox = {
    console:{ log:function(){}, warn:function(){}, error:function(){}, info:function(){}, debug:function(){}, group:function(){}, groupCollapsed:function(){}, groupEnd:function(){}, table:function(){}, trace:function(){}, count:function(){}, countReset:function(){}, dir:function(){}, dirxml:function(){}, assert:function(){}, time:function(){}, timeEnd:function(){}, timeLog:function(){} },
    document:{
      getElementById:function(id){ return Object.prototype.hasOwnProperty.call(currentInputs,id) ? makeEl(String(currentInputs[id])) : makeEl(undefined); },
      querySelector:function(){ return makeEl(undefined); },
      querySelectorAll:function(){ return []; },
      getElementsByClassName:function(){ return []; },
      getElementsByTagName:function(){ return []; },
      createElement:function(){ return makeEl(undefined); },
      createElementNS:function(){ return makeEl(undefined); },
      createTextNode:function(){ return makeEl(undefined); },
      addEventListener:function(){}, removeEventListener:function(){},
      body:makeEl(undefined), head:makeEl(undefined), documentElement:makeEl(undefined),
      readyState:'complete', cookie:''
    },
    localStorage: localStorage,
    requestIdleCallback:function(){ return 0; }, cancelIdleCallback:function(){},
    requestAnimationFrame:function(){ return 0; }, cancelAnimationFrame:function(){},
    setTimeout:function(){ return 0; }, clearTimeout:function(){},
    setInterval:function(){ return 0; }, clearInterval:function(){},
    navigator:{ userAgent:'node', language:'ar' },
    location:{ href:'', search:'', pathname:'/', hash:'', origin:'' },
    history:{ pushState:function(){}, replaceState:function(){} },
    matchMedia:function(){ return { matches:false, addListener:function(){}, removeListener:function(){}, addEventListener:function(){}, removeEventListener:function(){} }; },
    getComputedStyle:function(){ return {}; },
    alert:function(){}, confirm:function(){ return false; }, prompt:function(){ return null; },
    performance:{ now:function(){ return Date.now(); } }
  };
  vm.createContext(sandbox);
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox; sandbox.top = sandbox;
  let code = '';
  for (let i=0;i<FILES.length;i++){
    // Capture the REAL template-first meal builder (defined in module 13 +
    // v50 Egyptian templates in module 17) BEFORE the v41 facade (module 19)
    // overwrites the global `buildSmartMealPlan` with its DOM-oriented scatter
    // builder. The scatter builder ignored the Egyptian pairing templates
    // (fool+egg breakfast, tahini only with grills, peanut-butter only with
    // toast, olive-oil beside cheese) and produced unclamped portions. We keep
    // a handle to the original so the host can plan meals THROUGH the templates.
    if (FILES[i] === '19_engine_facade.js') {
      code += '\n;globalThis.__EF_TEMPLATE_BSMP = (typeof buildSmartMealPlan === "function") ? buildSmartMealPlan : null;\n';
    }
    code += '\n;/* ===== ' + FILES[i] + ' ===== */\n' + fs.readFileSync(path.join(DIR, FILES[i]),'utf8') + '\n';
  }
  code += '\n;globalThis.__EF_FOOD_CATALOG = (typeof FOOD_DB !== "undefined" ? FOOD_DB : FOOD_DB_RAW).map(function(f){ return {' +
    'id:f.id,nameAr:f.nameAr,nameEn:f.nameEn,cat:f.cat,cal:f.cal,pro:f.pro,carb:f.carb,fat:f.fat,unit:f.unit,' +
    'mealTypes:f.mealTypes||[],allowedDiets:f.allowedDiets||[],avoidHealth:f.avoidHealth||[],healthyScore:f.healthyScore||5,processedLevel:f.processedLevel||"unknown"}; });\n';
  // ── The pantry bridge ────────────────────────────────────────────────
  // 05_engine_state.js declares `const DE = {...}` at the TOP LEVEL of the
  // bundle script. Top-level const/let are lexical, NOT properties of the vm
  // global object, so `sandbox.DE` is undefined and any attempt to set
  // `sandbox.DE.availableFoods` from the host silently does nothing. That is
  // precisely why the app's pantry never reached the engine. These two
  // accessors are compiled INSIDE the same script, so they close over the real
  // DE and are the only correct way in.
  code += '\n;globalThis.__EF_SET_AVAILABLE = function(ids){ try { if (typeof DE !== "undefined" && DE) { DE.availableFoods = ids.slice(); return DE.availableFoods.length; } } catch(e){} return -1; };\n' +
    'globalThis.__EF_GET_AVAILABLE = function(){ try { if (typeof DE !== "undefined" && DE && Array.isArray(DE.availableFoods)) return DE.availableFoods.length; } catch(e){} return -1; };\n';
  // [EGY-v70] بذرة اليوم/الأسبوع — DE لكسيكال فمابنوصلهاش من الهوست إلا بستر جوّا الحزمة (زي __EF_SET_AVAILABLE).
  code += '\n;globalThis.__EF_SET_DAYSEED = function(week, day){ try { if (typeof DE !== "undefined" && DE) { if (typeof week === "number" && week > 0) DE.currentWeek = week; DE.dayOfCycle = ((Number(day)%4)+4)%4; return true; } } catch(e){} return false; };\n';
  // ── Request-isolation snapshot (see resetEngineState) ────────────
  // The engine keeps ALL request state in a single top-level `const DE`.
  // The compiled context is cached and reused across requests, so any field
  // one caller leaves in DE bleeds into the NEXT caller (proven: a healthy
  // user inherited a previous user's thyroid flag + mesocycle week). DE is
  // lexical and unreachable from the host, so we snapshot its pristine
  // defaults INSIDE the bundle and expose a reset the host runs before every
  // compute. JSON round-trip is safe: DE holds only data (verified).
  code += '\n;globalThis.__EF_DE_SNAPSHOT=(function(){try{return (typeof DE!=="undefined"&&DE)?JSON.parse(JSON.stringify(DE)):null;}catch(e){return null;}})();globalThis.__EF_RESET_DE=function(){try{if(typeof DE==="undefined"||!DE||!globalThis.__EF_DE_SNAPSHOT)return false;var snap=globalThis.__EF_DE_SNAPSHOT;Object.keys(DE).forEach(function(k){if(!Object.prototype.hasOwnProperty.call(snap,k)){try{delete DE[k];}catch(_e){DE[k]=undefined;}}});var fresh=JSON.parse(JSON.stringify(snap));Object.keys(fresh).forEach(function(k){DE[k]=fresh[k];});return true;}catch(e){return false;}};\n';
  const script = new vm.Script(code, { filename:'diet-engine-bundle.js' });
  try { script.runInContext(sandbox, { timeout: 20000 }); }
  finally { currentInputs = _savedInputs; }
  return sandbox;
}

let _ctx = null;
function ctx(){ if(!_ctx) _ctx = buildContext(); return _ctx; }

// ── Sprint 13: NaN guard ────────────────────────────────────────────────
// The diet engine reads its inputs through document.getElementById(...) ids
// (inp-weight, inp-bf, inp-steps ...). When an id is missing the shim returns
// an empty element, the maths silently degrades to NaN, and the engine STILL
// returns an object -- so the app used to build meals around a non-existent
// target. Nothing may leave this host without being a finite, sane number.
// ── Sprint 15: physiological plausibility guard ────────────────────────
// Proven by probe: an empty or half-filled profile did NOT fail. The engine
// returned bmr=5, tdee=7, protein=0 g -- and because the calorie floor lifts
// the total to 1400, the old calorie-only guard waved it through and the app
// happily rendered a three-meal plan with ZERO protein. For a nutrition app
// that is not a bug, it is a hazard. A body that cannot exist must never
// receive a plan; we refuse loudly instead of guessing.
var HUMAN = {
  age:    { min: 7,   max: 80,  label: 'age' },
  height: { min: 100, max: 250, label: 'height' },
  weight: { min: 25,  max: 350, label: 'weight' }
};
function assertProfile(profile, where){
  var p = profile || {};
  Object.keys(HUMAN).forEach(function (key) {
    var spec = HUMAN[key];
    var n = Number(p[key]);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error('engine_missing_' + spec.label + ':' + where);
    }
    if (n < spec.min || n > spec.max) {
      throw new Error('engine_implausible_' + spec.label + ':' + where + ':' + n);
    }
  });
  var target = Number(p.target);
  if (Number.isFinite(target) && target > 0 &&
      (target < HUMAN.weight.min || target > HUMAN.weight.max)) {
    throw new Error('engine_implausible_target:' + where + ':' + target);
  }
  return p;
}

function assertTargets(r, where){
  if (!r || typeof r !== 'object') {
    throw new Error('engine_no_result:' + where);
  }
  const cals = Number(r.targetCals);
  if (!Number.isFinite(cals) || cals <= 0) {
    throw new Error('engine_bad_target_cals:' + where + ':' + String(r.targetCals));
  }
  // A human plan below 800 or above 8000 kcal means the inputs never arrived.
  if (cals < 800 || cals > 8000) {
    throw new Error('engine_target_out_of_range:' + where + ':' + cals);
  }
  const m = r.macros || {};
  const p = Number(m.protein), cb = Number(m.carbs), f = Number(m.fat);
  if (![p, cb, f].every(Number.isFinite)) {
    throw new Error('engine_bad_macros:' + where + ':' + JSON.stringify(m));
  }
  if (p <= 0 && cb <= 0 && f <= 0) {
    throw new Error('engine_empty_macros:' + where);
  }
  // Sprint 15: protein is the one macro that is never optional. A plan that
  // prescribes 0 g of protein means the inputs never reached Mifflin-St Jeor.
  if (p <= 0) {
    throw new Error('engine_zero_protein:' + where);
  }
  // A resting metabolism under 800 kcal is not survivable for an adult, so it
  // can only mean height/weight/age arrived empty.
  var bmrVal = Number(r.bmr);
  if (Number.isFinite(bmrVal) && bmrVal > 0 && bmrVal < 800) {
    throw new Error('engine_implausible_bmr:' + where + ':' + Math.round(bmrVal));
  }
  var tdeeVal = Number(r.tdee);
  if (Number.isFinite(tdeeVal) && tdeeVal > 0 && tdeeVal < 900) {
    throw new Error('engine_implausible_tdee:' + where + ':' + Math.round(tdeeVal));
  }
  // The calorie floor must never silently outrun the maths: if the target had
  // to be lifted to double the computed expenditure, the expenditure is fiction.
  if (Number.isFinite(tdeeVal) && tdeeVal > 0 && cals > tdeeVal * 2) {
    throw new Error('engine_target_exceeds_tdee:' + where + ':' + cals + '>' + Math.round(tdeeVal));
  }
  return r;
}

// ── Sprint 16: the pantry the engine plans from ─────────────────────────
// `DE.availableFoods` is the list of food ids the user says they actually
// have. It is referenced 41 times across 7 engine files, and the Egyptian
// intelligence layer keys its every decision off it:
//
//   function _userSelected(food){ return DE.availableFoods.indexOf(food.id) !== -1 }
//
// This host never set it, so it stayed `[]` forever: `_userSelected` was
// always false, every food fell down the penalty branch (snacks -800,
// processed cheese -22) and nothing was ever rewarded. The Egyptian brain was
// loaded but blind, which is exactly why the produced meals looked like a
// scavenged pile instead of a real Egyptian meal.
//
// Passing an explicit list = the user's own pantry selection.
// Passing nothing = the whole catalog, which mirrors the website's
// "select all visible" and is a truthful superset -- never an empty pantry.
function applyAvailableFoods(c, inputs){
  var i = inputs || {};
  var catalog = c.__EF_FOOD_CATALOG || [];
  var known = Object.create(null);
  for (var n = 0; n < catalog.length; n++) known[catalog[n].id] = true;

  var requested = Array.isArray(i.availableFoods) ? i.availableFoods : null;
  var ids = [];
  if (requested && requested.length) {
    // Only ids the catalog really contains: a stale id from an old phone
    // cache must not silently shrink the pantry to nothing.
    for (var k = 0; k < requested.length; k++) {
      var id = String(requested[k]);
      if (known[id]) ids.push(id);
    }
  }
  if (!ids.length) {
    for (var m = 0; m < catalog.length; m++) ids.push(catalog[m].id);
  }
  // Must go through the in-bundle setter: see the pantry bridge note in
  // buildContext. A host-side assignment cannot reach a lexical `const DE`.
  var landed = -1;
  try { if (typeof c.__EF_SET_AVAILABLE === 'function') landed = c.__EF_SET_AVAILABLE(ids); } catch (e) {}
  if (landed !== ids.length) {
    // Fail loudly rather than serve a plan built from a pantry we never set:
    // a silent miss here is exactly the bug that produced nonsense meals.
    throw new Error('engine_pantry_not_applied:' + landed + '/' + ids.length);
  }
  return ids.length;
}

// ── Request isolation ────────────────────────────────────────
// Restore the engine to pristine per-request state BEFORE each compute so no
// field survives from the previous caller. Covers the top-level DE state
// object (via the in-bundle reset) and the localStorage shim.
function resetEngineState(c){
  try { if (typeof c.__EF_RESET_DE === 'function') c.__EF_RESET_DE(); } catch(e){}
  try { if (c.localStorage && typeof c.localStorage.clear === 'function') c.localStorage.clear(); } catch(e){}
}

function computeTargets(profile, inputs){
  assertProfile(profile, 'computeTargets');
  currentInputs = inputs || {};
  const c = ctx();
  resetEngineState(c);
  applyAvailableFoods(c, inputs);
  let r;
  try { r = c.NutritionEngine.calculate(profile || {}); }
  finally { currentInputs = {}; }
  r = applyAgePolicy(profile || {}, assertTargets(r, 'computeTargets'));
  return assertTargets(r, 'computeTargets:agePolicy');
}

// ---------------------------------------------------------------------------
//  طبقة سياسة السن — بتتطبق فوق ناتج الماتور مش جواه.
//  الماتور اتبنى للبالغين: Mifflin-St Jeor (متحقق 18-78) وعجز لغاية 25%
//  وبروتين لغاية 2.2 جم/كجم. ده مقبول لشاب 25 وخطر على ولد 12.
//  بدل ما نعدل الماتور (وهو مرجع الموقع)، بنفرض الحدود الآمنة بعده.
function applyAgePolicy(profile, targets) {
  const AGE = require('./age-policy');
  const age = Number(profile.age);
  const tier = AGE.tierFor(age);
  if (!tier || !targets) return targets;

  const weight = Number(profile.weight) || 0;
  const goalRaw = String(profile.goal || '').trim().toLowerCase();
  const isGain = /muscle|gain|bulk|\u062a\u0636\u062e\u064a\u0645|\u0632\u064a\u0627\u062f\u0629/.test(goalRaw);
  const isCut  = /cut|lose|loss|\u062a\u0646\u0634\u064a\u0641|\u062a\u062e\u0633\u064a\u0633|\u062e\u0633\u0627\u0631\u0629/.test(goalRaw);
  const out = Object.assign({}, targets);
  out.ageTier = tier.key;
  out.ageTierLabel = tier.label;
  out.ageNotes = [];

  // 1) تحت 18: Mifflin مش متحقق علميا — بنستخدم Schofield (FAO/WHO).
  if (tier.useSchofield && weight > 0) {
    const bmr = AGE.schofieldBMR(age, weight, profile.gender);
    if (bmr && isFinite(bmr) && bmr > 0) {
      const ratio = out.bmr > 0 ? (bmr / out.bmr) : 1;
      out.bmr = bmr;
      if (isFinite(out.tdee) && ratio > 0) out.tdee = Math.round(out.tdee * ratio);
      if (isFinite(out.targetCals) && ratio > 0) out.targetCals = Math.round(out.targetCals * ratio);
      out.ageNotes.push('\u0627\u0644\u062d\u0633\u0627\u0628 \u0628\u0645\u0639\u0627\u062f\u0644\u0629 Schofield \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u0629 \u0644\u0644\u0623\u0637\u0641\u0627\u0644 \u0648\u0627\u0644\u0645\u0631\u0627\u0647\u0642\u064a\u0646 \u0628\u062f\u0644 \u0645\u0639\u0627\u062f\u0644\u0629 \u0627\u0644\u0628\u0627\u0644\u063a\u064a\u0646.');
    }
  }

  // 2) قفل العجز والفائض عند الحد الآمن للشريحة.
  const tdee = Number(out.tdee);
  if (isFinite(tdee) && tdee > 0 && isFinite(out.targetCals)) {
    const floorCals = Math.round(tdee * (1 - tier.maxDeficitPct / 100));
    const ceilCals  = Math.round(tdee * (1 + tier.maxSurplusPct / 100));
    if (out.targetCals < floorCals) {
      out.targetCals = floorCals;
      out.ageNotes.push(tier.maxDeficitPct === 0
        ? '\u0641\u064a \u0627\u0644\u0633\u0646 \u062f\u0647 \u0645\u0641\u064a\u0634 \u0639\u062c\u0632 \u0633\u0639\u0631\u0627\u062a \u062e\u0627\u0644\u0635 \u2014 \u0627\u0644\u0647\u062f\u0641 \u0623\u0643\u0644 \u0645\u062a\u0648\u0627\u0632\u0646 \u0648\u062d\u0631\u0643\u0629.'
        : '\u0627\u0644\u0639\u062c\u0632 \u0627\u062a\u0642\u0641\u0644 \u0639\u0646\u062f ' + tier.maxDeficitPct + '% \u0639\u0634\u0627\u0646 \u0627\u0644\u0646\u0645\u0648 \u0645\u0627\u064a\u062a\u0623\u062b\u0631\u0634.');
    } else if (out.targetCals > ceilCals) {
      out.targetCals = ceilCals;
      out.ageNotes.push('\u0627\u0644\u0641\u0627\u0626\u0636 \u0627\u062a\u0642\u0641\u0644 \u0639\u0646\u062f ' + tier.maxSurplusPct + '% \u2014 \u0632\u064a\u0627\u062f\u0629 \u0623\u0633\u0631\u0639 \u0645\u0646 \u0643\u062f\u0647 \u0628\u062a\u0628\u0642\u0649 \u062f\u0647\u0648\u0646 \u0645\u0634 \u0639\u0636\u0644.');
    }

    // الولد اللي محتاج يزيد: الماتور كان بيديه سعرات صيانة بالظبط
    // (صفر فائض) يعني ماكانش هيزيد أبدا. النقص في الوزن في سن النمو
    // مشكلة صحية زي الزيادة بالظبط، فلازم فائض حقيقي محسوب.
    if (isGain && tier.allowSurplus && tier.maxSurplusPct > 0) {
      const minGain = Math.round(tdee * 1.05);
      if (out.targetCals < minGain) {
        out.targetCals = Math.min(minGain, ceilCals);
        out.ageNotes.push('\u0627\u062a\u0632\u0627\u062f \u0641\u0627\u0626\u0636 \u0622\u0645\u0646 \u0639\u0634\u0627\u0646 \u0627\u0644\u0632\u064a\u0627\u062f\u0629 \u062a\u062d\u0635\u0644 \u0641\u0639\u0644\u0627 \u2014 \u0633\u0639\u0631\u0627\u062a \u0627\u0644\u0635\u064a\u0627\u0646\u0629 \u0644\u0648\u062d\u062f\u0647\u0627 \u0645\u0627\u0628\u062a\u0632\u0648\u062f\u0634 \u0648\u0632\u0646.');
      }
    }
  }

  // 3) أرضية سعرات مطلقة — AAP/AND: ممنوع النزول تحتها للصغير.
  if (isFinite(out.targetCals) && out.targetCals < tier.calorieFloor) {
    out.targetCals = tier.calorieFloor;
    out.ageNotes.push('\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u062f\u0646\u0649 \u0627\u0644\u0622\u0645\u0646 \u0641\u064a \u0627\u0644\u0633\u0646 \u062f\u0647 ' + tier.calorieFloor + ' \u0633\u0639\u0631\u0629 \u064a\u0648\u0645\u064a\u0627.');
  }

  // 4) البروتين: مراهق رياضي مايحتاجش 2.2 جم/كجم (GSSI ~1.5).
  if (out.macros && weight > 0 && tier.proteinPerKg) {
    const m = Object.assign({}, out.macros);
    const minP = Math.round(tier.proteinPerKg[0] * weight);
    const maxP = Math.round(tier.proteinPerKg[1] * weight);
    const before = Number(m.protein) || 0;
    if (before > maxP) m.protein = maxP;
    if (before < minP) m.protein = minP;
    if (m.protein !== before) {
      out.ageNotes.push('\u0627\u0644\u0628\u0631\u0648\u062a\u064a\u0646 \u0627\u062a\u0638\u0628\u0637 \u0639\u0644\u0649 ' + tier.proteinPerKg[0] + '-' + tier.proteinPerKg[1] + ' \u062c\u0645/\u0643\u062c\u0645 \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629 \u0644\u0644\u0633\u0646.');
      // نعيد توزيع فرق السعرات على الكارب عشان الإجمالي يفضل مظبوط.
      const deltaCals = (before - m.protein) * 4;
      m.carbs = Math.max(0, Math.round((Number(m.carbs) || 0) + deltaCals / 4));
    }
    out.macros = m;
  }

  // الرسالة لازم تناسب الهدف. الولد اللي بيزود ماينفعش يقرا كلام عن الخسارة.
  if (AGE.isYouth(age)) {
    if (isGain) {
      out.ageNotes.push(tier.key === 'child'
        ? '\u0641\u064a \u0627\u0644\u0633\u0646 \u062f\u0647 \u0627\u0644\u0632\u064a\u0627\u062f\u0629 \u0628\u062a\u064a\u062c\u064a \u0645\u0646 \u0623\u0643\u0644 \u0643\u0627\u0645\u0644 \u0648\u0645\u0646\u062a\u0638\u0645 \u0648\u0646\u0648\u0645 \u0643\u0648\u064a\u0633 \u2014 \u0645\u0641\u064a\u0634 \u062d\u0627\u062c\u0629 \u0627\u0633\u0645\u0647\u0627 \u062a\u0636\u062e\u064a\u0645 \u0644\u0637\u0641\u0644.'
        : '\u0627\u0644\u0632\u064a\u0627\u062f\u0629 \u0647\u0646\u0627 \u0628\u062a\u0643\u0648\u0646 \u0628\u0637\u064a\u0626\u0629 \u0648\u062b\u0627\u0628\u062a\u0629 \u0645\u0639 \u062a\u062f\u0631\u064a\u0628 \u0645\u0642\u0627\u0648\u0645\u0629 \u2014 \u0627\u0644\u0633\u0631\u0639\u0629 \u0628\u062a\u062f\u064a \u062f\u0647\u0648\u0646 \u0645\u0634 \u0639\u0636\u0644.');
    } else if (isCut) {
      out.ageNotes.push(tier.key === 'child'
        ? '\u0641\u064a \u0627\u0644\u0633\u0646 \u062f\u0647 \u0645\u0641\u064a\u0634 \u0631\u064a\u062c\u064a\u0645 \u2014 \u0627\u0644\u0647\u062f\u0641 \u0623\u0643\u0644 \u0645\u062a\u0648\u0627\u0632\u0646 \u0648\u062d\u0631\u0643\u0629 \u064a\u0648\u0645\u064a\u0629.'
        : '\u0627\u0644\u062e\u0633\u0627\u0631\u0629 \u0647\u0646\u0627 \u0628\u062a\u062d\u0635\u0644 \u0628\u062b\u0628\u0627\u062a \u0627\u0644\u0648\u0632\u0646 \u0645\u0639 \u0632\u064a\u0627\u062f\u0629 \u0627\u0644\u0637\u0648\u0644\u060c \u0645\u0634 \u0628\u0631\u064a\u062c\u064a\u0645 \u0642\u0627\u0633\u064a.');
    }
    if (tier.requiresGuardianConsent) {
      out.ageNotes.push('\u0627\u0644\u062e\u0637\u0629 \u062f\u064a \u0644\u0627\u0632\u0645 \u062a\u0643\u0648\u0646 \u0628\u0639\u0644\u0645 \u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631\u060c \u0648\u0644\u0648 \u0641\u064a\u0647 \u0623\u064a \u062d\u0627\u0644\u0629 \u0637\u0628\u064a\u0629 \u0627\u0633\u062a\u0634\u0631 \u0637\u0628\u064a\u0628 \u0627\u0644\u0623\u0637\u0641\u0627\u0644 \u0627\u0644\u0623\u0648\u0644.');
    }
  } else if (tier.note) {
    out.ageNotes.push(tier.note);
  }
  out.ageRules = {
    allowSupplements: tier.allowSupplements,
    allowMaxLifts: tier.allowMaxLifts,
    allowPlyometrics: tier.allowPlyometrics,
    allowWeights: tier.allowWeights,
    repRange: tier.repRange,
    maxSessionsPerWeek: tier.maxSessionsPerWeek,
    maxSessionMinutes: tier.maxSessionMinutes,
    restSeconds: tier.restSeconds,
    requiresGuardianConsent: tier.requiresGuardianConsent
  };
  return out;
}
// Sprint 13: the third argument (weeklyMeta) used to be hard-coded to null,
// which silently disabled 10_weekly_strategy.js -- no weekly rotation, no
// variety, no week-by-week progression. It also meant the user's chosen meal
// count never reached the planner (4 requested -> 3 produced). We now build a
// real meta object from the profile so the ORIGINAL strategy layer runs.
function buildWeeklyMeta(profile, inputs, targets){
  const p = profile || {};
  const i = inputs || {};
  const num = function(v, min, max, dflt){
    const n = Number(v);
    if (!Number.isFinite(n)) return dflt;
    return Math.max(min, Math.min(max, Math.round(n)));
  };
  // Meal count: explicit profile value wins, then the engine input id, else 4.
  const mealCount = num(p.mealCount != null ? p.mealCount : i['inp-meals'], 2, 8, 4);
  // Rotate the plan across a 4-week cycle so the same foods do not repeat.
  const week = num(p.week != null ? p.week : i['inp-week'], 1, 52, 1);
  // [EGY-v70] يوم الدورة (0..3) — بيتحقن من الـ API حسب توقيت بلد الحساب.
  const dayOfCycle = num(p.dayOfCycle != null ? p.dayOfCycle : i['dayOfCycle'], 0, 3, 0);
  return {
    week: week,
    dayOfCycle: dayOfCycle,
    cycleWeek: ((week - 1) % 4) + 1,
    meals: mealCount,
    mealCount: mealCount,
    mealsPerDay: mealCount,
    diet: String(p.diet || i['inp-diet'] || 'balanced'),
    goal: String(p.goal || ''),
    calories: targets && targets.targetCals,
    macros: (targets && targets.macros) || null,
    health: Array.isArray(p.healthConditions) ? p.healthConditions : [],
    budget: String(p.budget || i['inp-budget'] || 'mid'),
    variety: true
  };
}

function computeMealPlan(profile, inputs){
  assertProfile(profile, 'computeMealPlan');
  const c = ctx();
  // ── Therapeutic pantry pruning (Egyptian clinical layer) ──
  // When the trainee reports health conditions we restrict the pantry the
  // engine plans from to foods that PASS every active condition's rule, so the
  // AUTOMATIC plan never pushes something unsafe (e.g. white rice/dates for a
  // diabetic, offal/sardines for gout, pickles/rennge for hypertension). This
  // only affects auto-suggestions; the picker still lets a user pick manually.
  const health0 = Array.isArray(profile && profile.healthConditions) ? profile.healthConditions : [];
  let effInputs = inputs || {};
  if (health0.length) {
    const cat = c.__EF_FOOD_CATALOG || [];
    const allowedSet = Object.create(null);
    for (let fi = 0; fi < cat.length; fi++) { if (passesHealth(cat[fi], health0)) allowedSet[cat[fi].id] = true; }
    const req = (Array.isArray(effInputs.availableFoods) && effInputs.availableFoods.length)
      ? effInputs.availableFoods : Object.keys(allowedSet);
    const pruned = req.map(String).filter(function(id){ return allowedSet[id]; });
    effInputs = Object.assign({}, effInputs, { availableFoods: pruned.length ? pruned : Object.keys(allowedSet) });
  }
  currentInputs = effInputs;
  resetEngineState(c);
  const pantrySize = applyAvailableFoods(c, effInputs);
  let targets, plan = null, meta = null;
  try {
    targets = c.NutritionEngine.calculate(profile || {});
    // Guard BEFORE building meals: never plan food around a NaN target.
    assertTargets(targets, 'computeMealPlan');
    meta = buildWeeklyMeta(profile, effInputs, targets);
    // [EGY-v70] احقن بذرة اليوم/الأسبوع في DE قبل بناء الوجبات (DE لكسيكال).
    try { if (typeof c.__EF_SET_DAYSEED === 'function') c.__EF_SET_DAYSEED(meta.week, meta.dayOfCycle); } catch(e){}
    // NOTE: routing meal composition through the v50 Egyptian templates
    // (__EF_TEMPLATE_BSMP / SMPS.ensurePlan) is the planned fix for meal
    // pairing + portion realism, but the template builder returns a different
    // data shape and needs a dedicated, fully-tested adapter. Until that lands
    // we keep the working structured builder so plans never break.
    var _bsmp = (typeof c.buildSmartMealPlan === 'function') ? c.buildSmartMealPlan : null;
    if (_bsmp) {
      try {
        plan = _bsmp(targets.targetCals, targets.macros, meta);
      } catch(e){
        // The strategy layer is an enhancement, not a hard dependency: if it
        // throws we retry the legacy call so the user still gets a plan.
        plan = _bsmp(targets.targetCals, targets.macros, null);
        plan = plan || {};
        plan.weeklyMetaError = String((e&&e.message)||e);
      }
    }
  } finally {
    currentInputs = {};
  }
  // ── Composition realism layer (portions + Egyptian pairing rules) ──
  // Deterministic post-pass on the structured builder's output: clamp absurd
  // portions to realistic Egyptian servings, round to the nearest 5g, enforce
  // the owner's hard pairing rules, then recompute every meal + day total so the
  // numbers the user sees always add up. Best-effort: never break a plan.
  // ── Training-day pre-workout meal ───────────────────────────────
  // لو النهاردة يوم تمرين، الوجبة بتتحقن قبل طبقة التنظيف عشان إغلاق
  // السعرات يوزع اليوم كله من جديد ويفضل مطابق للهدف بالظبط.
  if (plan) {
    try {
      const _pf = profile || {};
      const _isTrain = (_pf.isTrainingDay === true || _pf.isTrainingDay === 1 || _pf.isTrainingDay === 'true');
      if (_isTrain) _efInjectPreWorkout(plan, _pf.preWorkoutVariant != null ? _pf.preWorkoutVariant : new Date().getDay());
    } catch(_pe){ plan.preWorkoutError = String((_pe&&_pe.message)||_pe); }
  }
  if (plan) { try { _efSanitizePlan(plan); } catch(_se){ plan.sanitizeError = String((_se&&_se.message)||_se); } }
  // ── Fasting / Ramadan scheduling layer ──
  // Display + timing only: the meals, calories and macros are IDENTICAL to what
  // the engine computed; we only relabel/re-time the slots into إفطار/سحور
  // (Ramadan) or an 8-hour eating window (16:8).
  // Ramadan is applied AUTOMATICALLY, and ONLY during the actual Hijri month of
  // Ramadan (server/device date). There is no manual toggle: the إفطار/سحور
  // schedule surfaces on its own during Ramadan and disappears the rest of the
  // year. Nutrition (calories + macros) is IDENTICAL — only slot labels/timing
  // change.
  const fmode = _efIsRamadanNow() ? 'ramadan' : 'normal';
  if (fmode !== 'normal' && plan) { plan = applyMealSchedule(plan, fmode); plan.fastingMode = fmode; }
  // pantrySize is reported so the caller can prove which pantry produced the
  // plan instead of guessing.
  return { targets:targets, plan:plan, weeklyMeta:meta, pantrySize:pantrySize, healthPruned: health0.length ? true : false };
}
// ── Meal composition sanitizer (portions + pairing) ────────────────────────
// A deterministic, best-effort post-pass that makes the AUTOMATIC plan look
// like a real Egyptian coach wrote it: sane portions and the owner's hard
// pairing rules, with every total recomputed from the foods actually shown.
function _efNameOf(f){ return String((f && f.food && f.food.nameAr) || (f && f.nameAr) || (f && f.name) || ''); }
function _efCatOf(f){ return String((f && f.food && (f.food.cat || f.food.category)) || (f && f.cat) || (f && f.category) || ''); }
// Realistic Egyptian per-serving ceilings, in grams.
function _efPortionCap(f){
  const n = _efNameOf(f); const cat = _efCatOf(f);
  const has = function(s){ return n.indexOf(s) !== -1; };
  // [OWNER-RULE] الشوكولاتة سقفها 30 جم مهما حصل — ولا طبقة إقفال
  // السعرات ولا أي مسار تاني يقدر يرفعها فوق كده.
  const _id = String((f && f.food && f.food.id) || (f && f.id) || '');
  if (/choc|nutella|kitkat/i.test(_id) || has('شوكولات') || has('شيكولات') || has('نوتيلا') || has('مندولين') || has('كيتكات')) return 30;
  if (has('فول سوداني')) return 30;                                   // peanut butter
  if (cat === 'fat' || has('زيت') || has('طحينة') || has('زبدة') || has('لب ') || has('سمنة')) return 35;
  if (has('عيش') || has('توست')) return 100;                          // bread / toast
  if (has('بيض')) return 150;                                         // ~3 eggs
  if (cat === 'carb' || has('رز') || has('أرز') || has('مكرونة') || has('بطاطس')) return 220;
  if (has('زبادي')) return 250;
  if (cat === 'dairy' || has('جبنة')) return 150;
  if (cat === 'protein') return 250;
  if (cat === 'fruit') return 200;
  if (cat === 'veg' || cat === 'vegetable' || cat === 'vegetables') return 150;
  return 300;                                                          // absolute ceiling
}
// Set a food's grams (rounded to 5) and recompute its macros/cals from the
// per-100g base so the numbers stay internally consistent.
function _efSetGrams(f, g){
  g = Math.max(5, Math.round(g / 5) * 5);
  const oldG = Number(f.grams) || 0;
  const base = f.food || null;
  f.grams = g;
  const R1 = function(x){ return Math.round(x * 10) / 10; };
  if (base && base.cal != null) {
    f.cals = Math.round((Number(base.cal) || 0) * g / 100);
    if (base.pro != null) f.pro = R1((Number(base.pro) || 0) * g / 100);
    if (base.carb != null) f.carb = R1((Number(base.carb) || 0) * g / 100);
    if (base.fat != null) f.fat = R1((Number(base.fat) || 0) * g / 100);
  } else if (oldG > 0) {
    const r = g / oldG;
    if (f.cals != null) f.cals = Math.round((Number(f.cals) || 0) * r);
    if (f.pro != null) f.pro = R1((Number(f.pro) || 0) * r);
    if (f.carb != null) f.carb = R1((Number(f.carb) || 0) * r);
    if (f.fat != null) f.fat = R1((Number(f.fat) || 0) * r);
  }
  if (f.calories != null) f.calories = (f.cals != null ? f.cals : f.calories);
}
function _efIsBreakfast(meal){ return /فطار|فطور|إفطار|breakfast/.test(String((meal && meal.slotKey) || '') + ' ' + String((meal && meal.label) || '')); }
function _efMealHas(names, token){ for (var i = 0; i < names.length; i++){ if (names[i].indexOf(token) !== -1) return true; } return false; }
// Return true to KEEP a food, false to drop it (owner's hard pairing rules).
function _efPairingKeep(f, names, meal){
  const n = _efNameOf(f);
  // وجبة قبل التمرين مقفولة ومظبوطة بالإيد. ماتتلمسش
  if (meal && meal._autoPreWorkout) return true;
  const breakfast = _efIsBreakfast(meal);
  const slot = String((meal && meal.slotKey) || '');
  const isSnack = slot === 'snack' || /سناك|تحلية/.test(String((meal && meal.label) || ''));
  const hasCarbMain = _efMealHas(names,'رز') || _efMealHas(names,'أرز') || _efMealHas(names,'عيش') || _efMealHas(names,'مكرونة');
  const hasGrill = _efMealHas(names,'مشوي') || _efMealHas(names,'مشوية');
  const hasFoolOrFriedEgg = _efMealHas(names,'فول مدمس') || _efMealHas(names,'بيض مقلي');
  const hasCheeseOrEgg = _efMealHas(names,'جبنة') || _efMealHas(names,'بيض');
  // [OWNER-RULE] الفطار مصري: ممنوع رز أو مكرونة في الفطار خالص.
  if (breakfast && (n.indexOf('رز') !== -1 || n.indexOf('أرز') !== -1 || n.indexOf('مكرونة') !== -1)) return false;
  if (breakfast && n.indexOf('فاصوليا') !== -1) return false;                          // no cooked fasolia at breakfast
  // [OWNER-RULE] السناك: ممنوع الجبنة القريش خالص، السناك فاكهة/
  // زبادي/شوكولاتة دارك/مكسرات أو بدائل زي الترمس/الفشار.
  if (isSnack && n.indexOf('قريش') !== -1) return false;
  if (n.indexOf('حمص') !== -1 && hasCarbMain) return false;                             // chickpeas only alongside salad
  if (n.indexOf('طحينة') !== -1 && !hasGrill) return false;                             // tahini only with grills
  if (n.indexOf('فول سوداني') !== -1 && hasCheeseOrEgg) return false;                    // peanut butter never with cheese/egg
  if (n.indexOf('زبدة') !== -1 && n.indexOf('فول سوداني') === -1 && !hasFoolOrFriedEgg) return false; // butter only w/ fool or fried egg
  // [OWNER-RULE] زيت الزيتون مرتبط بالسلطة والجبنة والفول المدمس فقط.
  if (n.indexOf('زيت زيتون') !== -1) {
    const okZeit = _efMealHas(names,'سلطة') || _efMealHas(names,'جبنة') || _efMealHas(names,'فول مدمس');
    if (!okZeit) return false;
  }
  // [FIX-R2] قواعد المطبخ المصري اللي كانت متكتوبة في 25_owner_rules_post.js بس
  // مكانتش بتتنفّذ (الموديول بيقرا portions/slot والخطة الحقيقية foods/slotKey،
  // وكمان الهوست بينده buildSmartMealPlan مباشرة). بنرجّع تنفيذها هنا في الطبقة
  // اللي فعلاً بتشتغل على الخطة النهائية. مااخترعناش قاعدة — رجّعنا تطبيق الموجود.
  var _slotMain = (slot === 'lunch' || slot === 'dinner' || breakfast);
  if (_slotMain) {
    // (أ) [#2/#4] عناصر السناك (سوداني/مكسرات/لب/بذور/ترمس/فشار/شوكولاتة/جرانولا)
    //     والتمر/الفاكهة ممنوعة جوه الوجبات الرئيسية — مكانها السناك وقبل/بعد التمرين.
    var _cf = _efCatOf(f);
    if (_cf === 'nut' || _cf === 'snack') return false;
    if (/سوداني|كاجو|كاشو|لوز|بندق|فستق|عين جمل|بيكان|بيكن|مكسرات|ترمس|فشار|شوكولات|شيكولات|جرانولا|بذور|لب أبيض|لب ابيض|لب سوري|لب قرع|لب سوبر|لب /.test(n)) return false;
    if (_cf === 'fruit' || n.indexOf('تمر') !== -1 || n.indexOf('بلح') !== -1) return false;
  }
  // (ب) [#6] السمك ما بيجيش معاه خضار مطبوخ — سلطة + عيش/رز أو طحينة بس.
  //     الخضار المطبوخ يبقى جنب اللحمة/الفراخ بس.
  var _hasFish = _efMealHas(names,'سمك') || _efMealHas(names,'بلطي') || _efMealHas(names,'بوري') ||
    _efMealHas(names,'ماكريل') || _efMealHas(names,'سردين') || _efMealHas(names,'تونة') ||
    _efMealHas(names,'سلمون') || _efMealHas(names,'بلاميط') || _efMealHas(names,'قاروص') || _efMealHas(names,'دنيس');
  if (_hasFish && _efCatOf(f) !== 'protein' &&
      /فاصوليا|بسلة|بسله|لوبيا|ملوخية|كوسة|بامية|باذنجان|خضار مشكل|خضار مطبوخ|شوربة عدس|عدس/.test(n)) return false;
  // (ج) [#6] التونة ما تتحطش تلقائياً مع الرز — تبقى مع العيش/السلطة.
  if (_efMealHas(names,'تونة') && (n.indexOf('رز') !== -1 || n.indexOf('أرز') !== -1)) return false;
  return true;
}
// [OWNER-RULE] ربط الزيت/الزبدة بالعنصر المرتبط به للعرض inline (بيض + زبدة)
// بدل سطر منفصل. بنسيب العنصر في الماكروز زي ما هو (محسوب) بس بنعلّمه
// بالعنصر اللي يتعرض جنبه عشان الموبايل يدمجهم في سطر واحد.
function _efPairFats(meal){
  const foods = (meal && meal.foods) || [];
  if (foods.length < 2) return;
  const findMain = function(tokens){
    for (var i = 0; i < foods.length; i++){
      const nm = _efNameOf(foods[i]);
      for (var t = 0; t < tokens.length; t++){ if (nm.indexOf(tokens[t]) !== -1) return foods[i]; }
    }
    return null;
  };
  for (var i = 0; i < foods.length; i++){
    const nm = _efNameOf(foods[i]);
    let main = null;
    if (nm.indexOf('زبدة') !== -1 && nm.indexOf('فول سوداني') === -1){
      main = findMain(['بيض مقلي','بيض','فول مدمس']);
    } else if (nm.indexOf('زيت زيتون') !== -1){
      main = findMain(['سلطة','فول مدمس','جبنة']);
    }
    if (main && main !== foods[i]){
      foods[i]._pairWith = _efNameOf(main);
      if (!main._pairAddon) main._pairAddon = nm;
    }
  }
}
// [OWNER-RULE] منع التكديس لما المتدرب مختار وجبتين بس:
// ممنوع نوعين كارب أو نوعين بروتين في نفس الوجبة بلا داعٍ.
// بنسيب الأكبر جرامات ونشيل الزايد ونورّد جراماته للمتبقي (نرفع المية مش الأصناف).
function _efDedupeCategory(meal, cat){
  const foods = (meal && meal.foods) || [];
  if (foods.length < 2) return;
  const group = foods.filter(function(f){ return _efCatOf(f) === cat; });
  if (group.length < 2) return;
  let keep = group[0];
  for (var b = 1; b < group.length; b++){ if ((Number(group[b].grams)||0) > (Number(keep.grams)||0)) keep = group[b]; }
  let extra = 0;
  for (var c = 0; c < group.length; c++){ if (group[c] !== keep) extra += Number(group[c].grams) || 0; }
  meal.foods = foods.filter(function(f){ return _efCatOf(f) !== cat || f === keep; });
  if (extra > 0){
    const cap = _efPortionCap(keep);
    const want = (Number(keep.grams) || 0) + Math.round(extra * 0.6);
    _efSetGrams(keep, want > cap ? cap : want);
  }
}
// منع تكرار النشويات المتشابهة في نفس الوجبة
// المستخدم شاف عيش أبيض وعيش بلدي في فطار واحد ودي غلطة كبيرة
function _efIsBreadLike(name){
  const n = String(name || '');
  return n.indexOf('عيش') !== -1 || n.indexOf('خبز') !== -1 || n.indexOf('توست') !== -1 || n.indexOf('رايس كيك') !== -1;
}
function _efDedupeBread(meal){
  const foods = (meal && meal.foods) || [];
  if (foods.length < 2) return meal;
  const breads = [];
  for (var i = 0; i < foods.length; i++){
    if (_efIsBreadLike(_efNameOf(foods[i]))) breads.push(foods[i]);
  }
  if (breads.length < 2) return meal;
  // الأكبر جرامات هو اللي يفضل
  var keep = breads[0];
  var extra = 0;
  for (var b = 1; b < breads.length; b++){
    if ((Number(breads[b].grams) || 0) > (Number(keep.grams) || 0)) keep = breads[b];
  }
  for (var c = 0; c < breads.length; c++){
    if (breads[c] !== keep) extra += Number(breads[c].grams) || 0;
  }
  meal.foods = foods.filter(function(f){ return !_efIsBreadLike(_efNameOf(f)) || f === keep; });
  // نورد جزء من الجرامات المشيلة للعيش المتبقي في حدود سقفه الواقعي
  if (extra > 0){
    const cap = _efPortionCap(keep);
    const want = (Number(keep.grams) || 0) + extra;
    _efSetGrams(keep, want > cap ? cap : want);
  }
  return meal;
}
function _efRecalcTotals(node){
  const fs = (node && node.foods) || [];
  let cals = 0, pro = 0, carb = 0, fat = 0;
  for (var i = 0; i < fs.length; i++){ const f = fs[i]; cals += Number(f.cals != null ? f.cals : f.calories) || 0; pro += Number(f.pro) || 0; carb += Number(f.carb) || 0; fat += Number(f.fat) || 0; }
  cals = Math.round(cals); pro = Math.round(pro); carb = Math.round(carb); fat = Math.round(fat);
  if (node.totals && typeof node.totals === 'object'){ node.totals.cals = cals; node.totals.pro = pro; node.totals.carb = carb; node.totals.fat = fat; }
  if (node.cals != null) node.cals = cals;
  if (node.calories != null) node.calories = cals;
  if (node.pro != null) node.pro = pro;
  if (node.carb != null) node.carb = carb;
  if (node.fat != null) node.fat = fat;
  return { cals: cals, pro: pro, carb: carb, fat: fat };
}
// ── Pre-workout meal injection (training days) ────────────────────────
// طلب صاحب المشروع: أي حد بيتمرن، يوم التمرين تتضاف له وجبة خفيفة قبل
// التمرين تلقائياً — حتى لو مختار وجبتين أو تلاتة — ومن نفس سعرات اليوم
// مش زيادة عليها. طبقة إغلاق السعرات في _efSanitizePlan بتظبط باقي الوجبات بعدها.
//
// الأساس العلمي: كافيين 3-6 مج/كج قبل التمرين بيحسّن الأداء ويقلل الإحساس
// بالمجهود (ISSN 2021)، وكارب سريع مع دهون قليلة بيدي طاقة من غير تقل معدة.
function _efPreWorkoutMeal(targetCals, variant){
  const C = function(id, nameAr, cat, cal, pro, carb, fat){
    return { id:id, nameAr:nameAr, cat:cat, cal:cal, pro:pro, carb:carb, fat:fat, unit:'جم', mealTypes:['pre'] };
  };
  const coffee = C('coffee_black','قهوة سادة','drink',2,0.1,0.3,0);
  const banana = C('mwz','موز','fruit',89,1.1,23,0.3);
  const apple  = C('tfah','تفاح','fruit',52,0.3,14,0.2);
  const dates  = C('tmr','تمر','fruit',313,2.5,75,0.4);
  const choc   = C('dark_choc','شوكولاتة دارك','snack',598,7.8,46,43);
  const honey  = C('asl_nhl','عسل نحل','snack',304,0.3,82,0);
  const toast  = C('twst_asmr','توست أسمر','carb',265,9,49,3.2);
  // سقوف الكميات بطلب صاحب المشروع
  // شوكولاتة وعسل وتوست 20 جم كحد أقصى
  // تمر 60 جم كحد أقصى
  // موز وتفاح 100 جم كحد أقصى
  const combos = [
    [ {f:coffee, g:200}, {f:banana, g:100} ],
    [ {f:coffee, g:200}, {f:dates,  g:60}  ],
    [ {f:coffee, g:200}, {f:banana, g:100}, {f:dates, g:40} ],
    [ {f:coffee, g:200}, {f:choc,   g:20}  ],
    [ {f:coffee, g:200}, {f:dates,  g:50},  {f:choc,  g:15} ],
    [ {f:coffee, g:200}, {f:banana, g:90},  {f:choc,  g:15} ],
    [ {f:coffee, g:200}, {f:apple,  g:100} ],
    [ {f:coffee, g:200}, {f:toast,  g:20},  {f:honey, g:15} ]
  ];
  const pick = combos[Math.abs(Number(variant)||0) % combos.length];
  const foods = pick.map(function(p){
    const e = { food:p.f, grams:0, cals:0, pro:0, carb:0, fat:0 };
    _efSetGrams(e, p.g);
    return e;
  });
  const cals = foods.reduce(function(a,b){ return a + (Number(b.cals)||0); }, 0);
  return {
    slotKey: 'pre',
    label: 'قبل التمرين',
    description: 'طاقة سريعة وهضم خفيف قبل التمرين ب 45-60 دقيقة',
    targetCals: Math.round(cals),
    targetMacros: {
      protein: Math.round(foods.reduce(function(a,b){ return a+(Number(b.pro)||0); },0)),
      carbs:   Math.round(foods.reduce(function(a,b){ return a+(Number(b.carb)||0); },0)),
      fat:     Math.round(foods.reduce(function(a,b){ return a+(Number(b.fat)||0); },0)),
      cals:    Math.round(cals)
    },
    foods: foods,
    _autoPreWorkout: true
  };
}
// Insert the pre-workout meal right after breakfast (or first) on training days.
function _efInjectPreWorkout(plan, variant){
  if (!plan || !Array.isArray(plan.meals) || !plan.meals.length) return plan;
  for (var i = 0; i < plan.meals.length; i++){
    const sk = String(plan.meals[i] && plan.meals[i].slotKey || '');
    if (sk === 'pre') return plan;   // موجودة فعلاً
  }
  const meal = _efPreWorkoutMeal(Number(plan.targetCals) || 0, variant);
  var at = 0;
  for (var j = 0; j < plan.meals.length; j++){
    if (String(plan.meals[j].slotKey || '') === 'breakfast'){ at = j + 1; break; }
  }
  plan.meals.splice(at, 0, meal);
  plan.hasAutoPreWorkout = true;
  return plan;
}
// [OWNER-RULE][ORDER] ��رتيب عرض عناصر الوجبة زي ما طلب صاحب المشروع:
// 1) البروتين  2) الخضار/السلاطة (السلطة النية قبل الخضار المطبوخ)
// 3) الكربوهيدرات  4) الإضافات المرتبطة (زيت/زبدة).
// ترتيب عرض فقط — الإجماليات والحسابات مستقلة عن ترتيب المصفوفة.
var _EF_SALAD_WORDS = ['خس','طماطم','خيار','فلفل','جرجير','فجل','كابوتشا','سلطة','خضار مشكل','كرنب'];
function _efIsSaladName(name){
  var n = String(name || '');
  for (var i = 0; i < _EF_SALAD_WORDS.length; i++){ if (n.indexOf(_EF_SALAD_WORDS[i]) !== -1) return true; }
  return false;
}
function _efOrderRank(f){
  var c = String(_efCatOf(f) || '');
  var isVeg = (c === 'veg' || c === 'veggie' || c === 'vegetable' || c === 'vegetables');
  if (c === 'protein') return 0;
  if (c === 'dairy') return 1;
  if (isVeg) return _efIsSaladName(_efNameOf(f)) ? 2 : 3;
  if (c === 'carb') return 4;
  if (c === 'fruit') return 5;
  if (c === 'fat') return 7;   // الإضافات الدهنية آخر الصف
  return 6;
}
// فرز ثابت: العناصر المتساوية في الرتبة تفضل بترتيبها الأصلي.
function _efOrderMealFoods(meal){
  var foods = (meal && meal.foods) || [];
  if (foods.length < 2) return;
  var idx = foods.map(function(f, i){ return { f: f, i: i, r: _efOrderRank(f) }; });
  idx.sort(function(a, b){ return a.r === b.r ? a.i - b.i : a.r - b.r; });
  meal.foods = idx.map(function(x){ return x.f; });
}
// [FIX-R2 #3] العشاء يكرّر عناصر الفطار أو الغداء بكمية أخف — نفس قاعدة
// 25_owner_rules_post.js (RULE-3) بس متطبّقة على شكل الخطة الحقيقي (foods/slotKey).
function _efMirrorDinner(plan){
  var meals = (plan && plan.meals) || [];
  var bf=null, ln=null, dn=null;
  for (var i=0;i<meals.length;i++){
    if (meals[i] && meals[i]._autoPreWorkout) continue;
    var sk=String((meals[i] && meals[i].slotKey)||'');
    if (sk==='lunch') ln=meals[i];
    else if (sk==='dinner') dn=meals[i];
    else if (sk==='breakfast' || _efIsBreakfast(meals[i])) bf=meals[i];
  }
  if (!dn || !Array.isArray(dn.foods) || !dn.foods.length) return;
  var src = (ln && Array.isArray(ln.foods) && ln.foods.length>=2) ? ln : bf;
  if (!src || !Array.isArray(src.foods) || !src.foods.length || src===dn) return;
  var srcIds = src.foods.map(function(x){ return (x.food&&x.food.id)||''; });
  var dnIds  = dn.foods.map(function(x){ return (x.food&&x.food.id)||''; });
  var hasNew = dnIds.some(function(id){ return id && srcIds.indexOf(id)<0; });
  if (!hasNew) return; // العشاء أصلاً متكرر من وجبة أساسية — سيبه زي ما هو
  var dnTarget = Number(dn.targetCals) || (dn.totals && dn.totals.cals) || 0;
  var srcCals = src.foods.reduce(function(s,f){ return s+(Number(f.cals!=null?f.cals:f.calories)||0); },0);
  var scale = srcCals>0 ? (dnTarget>0 ? dnTarget/srcCals : 0.7) : 0.7;
  if (scale>0.85) scale=0.85; if (scale<0.45) scale=0.45; // العشاء دايماً أخف من المصدر
  var newFoods = [];
  for (var k=0;k<src.foods.length;k++){
    var f=src.foods[k]; var c=_efCatOf(f); var nm=_efNameOf(f);
    if (c==='fruit' || c==='nut' || c==='snack' || nm.indexOf('تمر')!==-1) continue;
    var base=f.food||null;
    var g=Math.round((Number(f.grams)||100)*scale/5)*5; if (g<30) g=30;
    var e={ food:base, grams:0, cals:0, pro:0, carb:0, fat:0 };
    if (base){ _efSetGrams(e, g); }
    else { e.grams=g; e.cals=Math.round((Number(f.cals)||0)*scale); e.pro=f.pro; e.carb=f.carb; e.fat=f.fat; }
    newFoods.push(e);
  }
  if (newFoods.length){ dn.foods = newFoods; dn._mirroredFrom = (src===ln?'lunch':'breakfast'); }
}
// [FIX-R2 #4/#5] الوجبة الرئيسية (خصوصاً الفطار) ما تتبنيش على عنصر خضار واحد
// منفرد زي الطماطم — نكمّله طبق سلطة بإضافة مكوّن تاني عشان العرض يجمعهم "سلطة (…)"
// حسب قاعدة طبق السلطة الموجودة. مااخترعناش قاعدة — بنطبّق الموجود.
function _efFixLoneBreakfastVeg(plan){
  var meals=(plan&&plan.meals)||[];
  var VEG={ khyar:{id:'khyar',nameAr:'خيار',cat:'veggie',cal:16,pro:0.7,carb:3.6,fat:0.1},
           tmatm:{id:'tmatm',nameAr:'طماطم',cat:'veggie',cal:18,pro:0.9,carb:3.9,fat:0.2} };
  for (var m=0;m<meals.length;m++){
    var meal=meals[m];
    if (!meal || meal._autoPreWorkout || !Array.isArray(meal.foods)) continue;
    var slot=String(meal.slotKey||'');
    var main=(slot==='breakfast'||slot==='lunch'||slot==='dinner'||_efIsBreakfast(meal));
    if (!main) continue;
    var saladVegs=meal.foods.filter(function(f){ var c=_efCatOf(f); var isVeg=(c==='veg'||c==='veggie'||c==='vegetable'||c==='vegetables'); return isVeg && _efIsSaladName(_efNameOf(f)); });
    if (saladVegs.length!==1) continue;
    var lone=saladVegs[0]; var lname=_efNameOf(lone);
    if (lname.indexOf('سلطة')!==-1) continue;
    var addBase = lname.indexOf('طماطم')!==-1 ? VEG.khyar : VEG.tmatm;
    if (meal.foods.some(function(f){ return ((f.food&&f.food.id)||'')===addBase.id; })) continue;
    var e={ food:Object.assign({unit:'جم',mealTypes:[]},addBase), grams:0, cals:0, pro:0, carb:0, fat:0 };
    _efSetGrams(e, Math.max(40, Number(lone.grams)||60));
    meal.foods.push(e);
  }
}
function _efSanitizePlan(plan){
  const meals = (plan && plan.meals) || [];
  try { _efMirrorDinner(plan); } catch(_mdErr){ plan.dinnerMirrorError = String((_mdErr&&_mdErr.message)||_mdErr); }
  try { _efFixLoneBreakfastVeg(plan); } catch(_lvErr){ plan.saladFixError = String((_lvErr&&_lvErr.message)||_lvErr); }
  // عدد الوجبات الفعلية (ماعدا وجبة قبل التمرين). لو وجبتين بس
  // بنمنع تكديس أكتر من نوع كارب/بروتين في نفس الوجبة.
  const realMeals = meals.filter(function(mm){ return !(mm && mm._autoPreWorkout); }).length;
  const twoMeals = realMeals <= 2;
  let dCals = 0, dPro = 0, dCarb = 0, dFat = 0;
  for (var m = 0; m < meals.length; m++){
    const meal = meals[m];
    const foods = (meal && meal.foods) || [];
    for (var i = 0; i < foods.length; i++){ const f = foods[i]; const g = Number(f.grams) || 0; const cap = _efPortionCap(f); _efSetGrams(f, g > cap ? cap : g); }
    const names = foods.map(_efNameOf);
    // قاعدة صاحب المشروع: مس��حيل نوعين عيش في وجبة واحدة
    // نسيب الأكبر في الجرامات ونشيل الباقي ونورد جراماته للمتبقي
    _efDedupeBread(meal);
    // وجبتين بس → ممنوع تكديس كارب أو بروتين (نرفع الكمية مش الأصناف)
    if (twoMeals && !(meal && meal._autoPreWorkout)){
      _efDedupeCategory(meal, 'carb');
      _efDedupeCategory(meal, 'protein');
    }
    const foods2 = (meal && meal.foods) || foods;
    const names2 = foods2.map(_efNameOf);
    const kept = foods2.filter(function(f){ return _efPairingKeep(f, names2, meal); });
    if (kept.length >= 2 && kept.length < foods.length) meal.foods = kept;   // never strip a meal bare
    // ربط الزيت/الزبدة بالعنصر المرتبط (للعرض inline)
    _efPairFats(meal);
    // ترتيب العرض: بروتين ← سلطة ← خضار مطبوخ ← كارب ← إضافات
    _efOrderMealFoods(meal);
    const t = _efRecalcTotals(meal);
    dCals += t.cals; dPro += t.pro; dCarb += t.carb; dFat += t.fat;
  }
  // [CALORIE-CLOSE-FIX] اقفل فجوة السعرات بعد القص.
  // السقوف الواقعية فوق بتقص الجرامات لتحت، فكان اليوم بيخرج ناقص 400-800 سعرة
  // وبيظهر للمستخدم "فاضلك 635 سعرة" مع إن الخطة مفروض تكون مكتملة.
  // الحل: نوزع الناقص على الأصناف اللي لسه تحت سقفها الواقعي، من غير ما نكسر
  // أي سقف ومن غير ما نكبر الخضار (مالوش معنى نزود خس عشان سعرات).
  const _tgt = Number(plan.targetCals) || 0;
  if (_tgt > 0 && dCals < _tgt * 0.97){
    let _guard = 0;
    while (dCals < _tgt * 0.97 && _guard++ < 40){
      let _moved = false;
      for (var m2 = 0; m2 < meals.length; m2++){
        // وجبة قبل التمرين لازم تفضل خفيفة — مانكبرهاش عشان نقفل فجوة اليوم.
        if (meals[m2] && meals[m2]._autoPreWorkout) continue;
        const _foods = (meals[m2] && meals[m2].foods) || [];
        for (var j = 0; j < _foods.length; j++){
          if (dCals >= _tgt * 0.97) break;
          const f2 = _foods[j];
          const c2 = _efCatOf(f2);
          if (c2 === 'veg' || c2 === 'veggie' || c2 === 'vegetable' || c2 === 'vegetables') continue;
          const _per100 = (f2.food && f2.food.cal != null) ? Number(f2.food.cal) : 0;
          if (!_per100) continue;
          const _cap = _efPortionCap(f2);
          const _cur = Number(f2.grams) || 0;
          if (_cur >= _cap) continue;
          let _addG = Math.min(_cap - _cur, Math.max(5, Math.round((_tgt - dCals) / _per100 * 100)));
          _addG = Math.round(_addG / 5) * 5;
          if (_addG < 5) continue;
          const _before = Number(f2.cals) || 0;
          _efSetGrams(f2, _cur + _addG);
          dCals += (Number(f2.cals) || 0) - _before;
          _moved = true;
        }
      }
      if (!_moved) break;
    }
    // لو كل الأصناف وصلت سقفها ولسه فيه ناقص (بيحصل مع أهداف التضخيم
    // العالية)، نضيف صنف جديد حقيقي للوجبة بدل ما نسيب اليوم ناقص.
    if (dCals < _tgt * 0.97){
      const _TU = {
        bread:  { id:'ayshbldy',      nameAr:'عيش بلدي',     cat:'carb',    cal:265, pro:8.5,  carb:55, fat:1.5 },
        rice:   { id:'arzabydmtbwkh', nameAr:'أرز أبيض مطبوخ', cat:'carb', cal:130, pro:2.7, carb:28, fat:0.3 },
        yogurt: { id:'zbadytbyay',    nameAr:'زبادي طبيعي', cat:'dairy',   cal:61,  pro:3.5,  carb:4.7, fat:3.3 },
        dates:  { id:'tmr',           nameAr:'تمر',           cat:'fruit',   cal:313, pro:2.5,  carb:75, fat:0.4 },
        peanut: { id:'swdany_mhms',   nameAr:'سوداني محمص', cat:'nut',    cal:567, pro:26,   carb:16, fat:49 }
      };
      // [OWNER-RULE] إقفال فجوة السعرات بإضافة صنف لازم يحترم نفس قواعد
      // المطبخ المصري: ممنع تكديس كارب/بروتين في نفس الوجبة،
      // وممنوع رز في الفطار. قبل كده الطبقة دي كانت بتتجاوز القواعد
      // وتحط عيش + أرز + سوداني في فطار واحد — وده الغلط اللي اتشاف.
      const _hasCat4 = function(meal, cat){
        const fs = (meal && meal.foods) || [];
        for (var z = 0; z < fs.length; z++){ if (_efCatOf(fs[z]) === cat) return true; }
        return false;
      };
      const _plan4Slot = function(meal){
        const slot = String((meal && meal.slotKey) || '');
        // [EGY-v71] من غير رز ولا تمر في الفطار — التمر/الفاكهة مكانها السناك وقبل/بعد التمرين بس.
        // [FIX #4] عناصر السناك (سوداني/مكسرات) ممنوعة في الوجبات الرئيسية —
        // مكانها السناك وقبل/بعد التمرين بس، زي قاعدة التمر/الفاكهة فوق بالظبط.
        // (السوداني cat:'nut' فماكانش بيتمنع بفحص التكديس، عشان كده كان بيطلع في الفطار.)
        if (_efIsBreakfast(meal)) return [_TU.yogurt];
        if (slot === 'dinner') return [_TU.yogurt];
        if (slot === 'snack' || slot === 'pre' || slot === 'post') return [_TU.dates, _TU.peanut];
        return [_TU.bread, _TU.rice];
      };
      for (var m4 = 0; m4 < meals.length && dCals < _tgt * 0.97; m4++){
        const _meal4 = meals[m4];
        if (!_meal4 || !Array.isArray(_meal4.foods)) continue;
        if (_meal4._autoPreWorkout) continue;   // وجبة قبل التمرين تفضل خفيفة
        const _ids4 = _meal4.foods.map(function(x){ return (x.food && x.food.id) || ''; });
        const _opts = _plan4Slot(_meal4);
        for (var o = 0; o < _opts.length && dCals < _tgt * 0.97; o++){
          const _o = _opts[o];
          if (_ids4.indexOf(_o.id) !== -1) continue;
          // ممنوع التكديس: ماننضافش كارب لو فيه كارب، ولا بروتين لو فيه بروتين.
          if ((_o.cat === 'carb' || _o.cat === 'protein') && _hasCat4(_meal4, _o.cat)) continue;
          const _entry = { food: Object.assign({ unit:'جم', mealTypes:[] }, _o), grams:0, cals:0, pro:0, carb:0, fat:0 };
          // لازم يعدي قواعد الاقتران المصرية (بما فيها ممنوع رز في الفطار).
          const _namesNew = _meal4.foods.map(_efNameOf).concat(_efNameOf(_entry));
          if (!_efPairingKeep(_entry, _namesNew, _meal4)) continue;
          const _capO = _efPortionCap(_entry);
          let _gO = Math.min(_capO, Math.max(10, Math.round((_tgt - dCals) / _o.cal * 100)));
          _gO = Math.round(_gO / 5) * 5;
          if (_gO < 10) continue;
          _efSetGrams(_entry, _gO);
          _meal4.foods.push(_entry);
          _ids4.push(_o.id);
          dCals += Number(_entry.cals) || 0;
        }
      }
    }
    dCals = 0; dPro = 0; dCarb = 0; dFat = 0;
    for (var m3 = 0; m3 < meals.length; m3++){
      const _t3 = _efRecalcTotals(meals[m3]);
      dCals += _t3.cals; dPro += _t3.pro; dCarb += _t3.carb; dFat += _t3.fat;
    }
  }
  // والاتجاه التاني: لو اليوم زاد عن الهدف نقص من غير الخضار.
  // "لا أقل ولا أكتر" — لازم يشتغل في الاتجاهين.
  if (_tgt > 0 && dCals > _tgt * 1.03){
    let _g2 = 0;
    while (dCals > _tgt * 1.03 && _g2++ < 60){
      let _cut = false;
      for (var m5 = 0; m5 < meals.length; m5++){
        const _fs = (meals[m5] && meals[m5].foods) || [];
        for (var k5 = 0; k5 < _fs.length; k5++){
          if (dCals <= _tgt * 1.03) break;
          const f5 = _fs[k5];
          const c5 = _efCatOf(f5);
          if (c5 === 'veg' || c5 === 'veggie' || c5 === 'vegetable' || c5 === 'vegetables') continue;
          const _p5 = (f5.food && f5.food.cal != null) ? Number(f5.food.cal) : 0;
          const _cg = Number(f5.grams) || 0;
          if (!_p5 || _cg <= 15) continue;
          let _dg = Math.min(_cg - 15, Math.max(5, Math.round((dCals - _tgt) / _p5 * 100)));
          _dg = Math.round(_dg / 5) * 5;
          if (_dg < 5) continue;
          const _b5 = Number(f5.cals) || 0;
          _efSetGrams(f5, _cg - _dg);
          dCals -= _b5 - (Number(f5.cals) || 0);
          _cut = true;
        }
      }
      if (!_cut) break;
    }
    dCals = 0; dPro = 0; dCarb = 0; dFat = 0;
    for (var m6 = 0; m6 < meals.length; m6++){
      const _t6 = _efRecalcTotals(meals[m6]);
      dCals += _t6.cals; dPro += _t6.pro; dCarb += _t6.carb; dFat += _t6.fat;
    }
  }
  // تنظيف أخير للعيش
  // بلوك إقفال فجوة السعرات فوق ممكن يكون ضاف عيش بلدي لوجبة فيها عيش أبيض
  // فلازم نعدي تاني بعده مش قبله بس وإلا الباج يرجع في أهداف الزيادة
  for (var m7 = 0; m7 < meals.length; m7++){ _efDedupeBread(meals[m7]); }
  dCals = 0; dPro = 0; dCarb = 0; dFat = 0;
  for (var m8 = 0; m8 < meals.length; m8++){
    const _t8 = _efRecalcTotals(meals[m8]);
    dCals += _t8.cals; dPro += _t8.pro; dCarb += _t8.carb; dFat += _t8.fat;
  }
  if (plan.totals && typeof plan.totals === 'object'){
    plan.totals.cals = Math.round(dCals); plan.totals.pro = Math.round(dPro); plan.totals.carb = Math.round(dCarb); plan.totals.fat = Math.round(dFat);
  }
  return plan;
}
function normalizeSearch(value){
  return String(value||'').toLowerCase().replace(/[\u064B-\u0652\u0670\u0640]/g,'')
    .replace(/[أإآ]/g,'ا').replace(/[ةه]/g,'ه').replace(/[يى]/g,'ي')
    .replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ء/g,'').replace(/\s+/g,' ').trim();
}
// Egyptian-first ordering (refined to the owner's canonical staples list):
//  - everyday Egyptian foods surface FIRST in the exact priority the owner gave
//  - uncommon/expensive items are NEVER hidden from the picker; they stay fully
//    searchable and are simply pushed to the very END of any list
//  - the automatic PLAN (الاقتراحات) still excludes them through the engine's own
//    affordability layer (module 23), so "hidden from suggestions, shown in
//    search, always last" is honoured end-to-end.
// egyIsRare mirrors module 23's excluded() set and is CATEGORY-AWARE so a short
// token like "مخ" only demotes offal (protein) and never "مخلل".
var EGY_COMMON_ORDER=[
  // كربوهيدرات
  'عيش اسمر','عيش ابيض','رز ابيض','رز بسمتي','رز بني','بطاطس مسلوقة','بطاطس مشوية','بطاطس بوريه','بطاطا مشوية','فول مدمس',
  // بروتين (التوكنز مطابقة لأسماء الكتالوج الفعلية: صدر/ورك مفرد)
  'صدر فراخ','ورك فراخ','جناح فراخ','كبدة فراخ','كبدة اسكندراني','قوانص فراخ','لحمه مسلوق','لحمه مشوي','لحمه كباب','كفتة مشوي','كفتة فراخ','ورك بط','صدر بط','بوري','بلطي','ماكريل','تونة','سردين','بيض','جبنة قريش','جبنة بيضاء','جبنة رومي','زبادي',
  // خضار مطبوخ
  'فاصوليا','لوبيه','بسلة','كوسة','خضار مشكل','عدس بجبه','باذنجان مشوي','شوربة عدس','ملوخية','شوربة فراخ','شوربة لحمة',
  // خضار
  'خس','طماطم','خيار','فلفل','جزر','كابوتشا','جرجير','فجل','ليمون',
  // فاكهة
  'تفاح','موز','برتقال','يوسفي','جوافة','مانجو','عنب','خوخ','برقوق','كمثرى','مشمش','فراولة','بطيخ','شمام','كنتالوب','رمان','تين','بلح','اناناس','كاكا','تمر',
  // سناكس ودهون
  'سوداني','شوكولاتة دارك','دارك','فشار','لب ابيض','لب قرع','لب سوري','زيت زيتون','طحينة','زيتون','مخلل',
  'سلطة'
];
var EGY_COMMON_ORDER_N=EGY_COMMON_ORDER.map(normalizeSearch);
function egyCommonRank(food){
  var name=normalizeSearch(String(food&&food.nameAr||''));
  for(var i=0;i<EGY_COMMON_ORDER_N.length;i++){ if(EGY_COMMON_ORDER_N[i] && name.indexOf(EGY_COMMON_ORDER_N[i])>-1) return i; }
  return 9999;
}
function egyIsRare(food){
  var nm=normalizeSearch(String(food&&food.nameAr||'')); var c=String(food&&food.cat||'');
  if(/افوكادو/.test(nm)) return true;
  if(/شوفان/.test(nm)) return true;
  if((c==='fat'||c==='snack') && /لوز|كاجو|عين جمل|بندق|فستق|بيكان|ماكاداميا|مكاديميا|صنوبر/.test(nm) && !/سوداني|طحينة|سمسم|لب /.test(nm)) return true;
  if(c==='dairy' && /حليب لوز|حليب كاجو|حليب شوفان/.test(nm)) return true;
  if(c==='protein' && /جمبري|سبيط|كاليماري|كابوريا|سلمون|رنجة|انشوجة|فسيخ|استاكوزا|جندوفل|بلح البحر|سلطعون|لوبستر|محار|كافيار|بطارخ/.test(nm)) return true;
  if(c==='protein' && /رومي|تركي|حمام|سمان|ارنب|طحال|مخ|كلاوي|كرشة|كوارع|عكاوي|جمل|لحمة راس/.test(nm)) return true;
  if(c==='veggie' && /بروكلي|فطر|مشروم|كينوا|كيل|هليون|خرشوف/.test(nm)) return true;
  return false;
}
function searchFoods(options){
  options=options||{}; const query=normalizeSearch(options.query), cat=String(options.category||'all');
  const diet=String(options.diet||'balanced'); const health=Array.isArray(options.health)?options.health:[];
  const words=query.split(' ').filter(Boolean); const catalog=ctx().__EF_FOOD_CATALOG||[];
  return catalog.filter(function(food){
    if(cat!=='all'&&food.cat!==cat)return false;
    if(food.allowedDiets&&food.allowedDiets.length&&food.allowedDiets.indexOf(diet)<0)return false;
    if((food.avoidHealth||[]).some(function(x){return health.indexOf(x)>-1;}))return false;
    if(!passesHealth(food, health))return false;   // الفلاتر العلاجية المصرية
    const hay=normalizeSearch((food.nameAr||'')+' '+(food.nameEn||'')+' '+(food.id||''));
    return words.every(function(word){return hay.indexOf(word)>-1||(word[0]==='ا'&&hay.indexOf(word.slice(1))>-1);});
  }).sort(function(a,b){
    var raA=egyIsRare(a)?1:0, raB=egyIsRare(b)?1:0;   // الغالي/النادر دايمًا في الآخر
    if(raA!==raB) return raA-raB;
    var ca=egyCommonRank(a), cb=egyCommonRank(b);      // الشائع المصري بترتيب المالك أولًا
    if(ca!==cb) return ca-cb;
    return (b.healthyScore||0)-(a.healthyScore||0)||(a.nameAr||'').localeCompare(b.nameAr||'','ar');
  }).slice(0,60);
}
// ── Egyptian therapeutic filters (الفلاتر العلاجية) ──
// Each condition maps to plain Arabic tokens of foods to AVOID. Tokens are
// normalized the same way food names are, then matched by substring, so a
// diabetic never gets sugar/high-GI carbs pushed, a gout patient never gets
// organ meats/sardines, a hypertensive never gets pickles/salted fish, etc.
// Conservative defaults: they only shape the AUTO plan and the picker filter.
var EGY_HEALTH_AVOID_RAW = {
  diabetes:    ['سكر','عسل','مربى','دبس','قصب','تمر','بلح','مانجو','بطيخ','عصير','شربات','كنافة','بسبوسة','حلاوة','كورن فليكس','رز ابيض','عيش ابيض'],
  insulin:     ['سكر','عسل','مربى','دبس','قصب','تمر','بلح','عصير','كنافة','بسبوسة','حلاوة','رز ابيض','عيش ابيض'],
  bp:          ['مخلل','رنجة','فسيخ','ملوحة','لانشون','سجق','بسطرمة','بيكون','جبنة رومي','شيبسي','صويا','مكسرات مملحة'],
  cholesterol: ['كبد','كلاوي','كوارع','ممبار','طحال','سمنة','زبدة','قشطة','كريمة','مقلي','مقلية','لانشون','سجق','بسطرمة','بيكون'],
  kidney:      ['مخلل','رنجة','فسيخ','لانشون','سجق','بسطرمة','مكسرات','شوكولاتة','موز','بلح','تمر','جبنة رومي'],
  gerd:        ['مقلي','مقلية','شطة','فلفل حار','صلصة طماطم','ليمون','برتقال','جريب فروت','قهوة','نعناع','شوكولاتة','مشروب غازي'],
  gout:        ['كبد','كلاوي','كوارع','ممبار','طحال','سردين','انشوجة','رنجة','جمبري','استاكوزا','سبيط','كابوريا','مرقة لحمة'],
  ibs:         ['بصل','ثوم','فول','عدس','حمص','فاصوليا','لوبيا','تفاح','بطيخ','كمثرى','كرنب','قرنبيط','بروكلي','مشروب غازي']
};
var EGY_HEALTH_AVOID = (function(){
  var out = Object.create(null);
  Object.keys(EGY_HEALTH_AVOID_RAW).forEach(function(k){ out[k] = EGY_HEALTH_AVOID_RAW[k].map(normalizeSearch); });
  return out;
})();
function passesHealth(food, health){
  if(!Array.isArray(health) || !health.length) return true;
  var nm = normalizeSearch(String(food&&food.nameAr||'') + ' ' + String(food&&food.nameEn||''));
  for(var i=0;i<health.length;i++){
    var toks = EGY_HEALTH_AVOID[health[i]];
    if(!toks) continue;
    for(var t=0;t<toks.length;t++){ if(toks[t] && nm.indexOf(toks[t])>-1) return false; }
  }
  return true;
}
// ── Fasting / Ramadan meal scheduler (وضع الصيام/رمضان) ──
// Relabels/re-times the engine's meals WITHOUT touching their food or macros.
// ── Automatic Hijri-date detection (tabular Islamic calendar) ──
// Converts today's Gregorian date to the Hijri calendar so the app knows when
// it is Ramadan WITHOUT any manual switch or network call. Tabular civil
// algorithm; may differ from the official moon sighting by ~1 day, which is
// acceptable for switching the meal-schedule view.
function _efGregToHijri(gy, gm, gd){
  var a = Math.floor((14 - gm) / 12);
  var y = gy + 4800 - a;
  var m = gm + 12 * a - 3;
  var jd = gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4)
         - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  var l = jd - 1948440 + 10632;
  var n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  var j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719)
        + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
        - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  var hm = Math.floor((24 * l) / 709);
  var hd = l - Math.floor((709 * hm) / 24);
  var hy = 30 * n + j - 30;
  return { y: hy, m: hm, d: hd };
}
function _efIsRamadanNow(){
  try {
    var d = (typeof globalThis !== 'undefined' && globalThis.__EF_NOW instanceof Date)
      ? globalThis.__EF_NOW : new Date();
    return _efGregToHijri(d.getFullYear(), d.getMonth() + 1, d.getDate()).m === 9;
  } catch(e){ return false; }
}
function applyMealSchedule(plan, mode){
  if(!plan || !Array.isArray(plan.meals) || !plan.meals.length) return plan;
  var meals = plan.meals; var n = meals.length;
  function relabel(i, label, desc){ meals[i] = Object.assign({}, meals[i], { label: label, description: desc }); }
  if(mode === 'ramadan'){
    for(var i=0;i<n;i++){
      if(i===0) relabel(i,'الإفطار (بعد المغرب)','ابدأ ب3 تمرات ومياه أو شوربة خفيفة وبعد صلاة المغرب كمل الوجبة الرئيسية');
      else if(i===n-1) relabel(i,'السحور (قبل الفجر)','ركز على بروتين + كارب بطيء الهضم عشان الطاقة تفضل معاك طول نهار الصيام');
      else if(String(meals[i].slotKey)==='snack' || /سناك/.test(String(meals[i].label||''))) relabel(i,'تحلية/سناك بعد الإفطار','خفيفة ويفضل بعد الوجبة الرئيسية بساعة');
      else relabel(i,'وجبة بين الإفطار والسحور',(meals[i].description||''));
    }
    plan.scheduleNote = 'وضع رمضان: وجباتك موزعة بين الإفطار والسحور نفس السعرات والماكروز اللي المحرك حسبها بالظبط';
  } else if(mode === 'if16'){
    var startH = 12, span = 8, step = n>1 ? Math.max(1, Math.floor(span/(n-1))) : 0;
    for(var j=0;j<n;j++){
      var hr = startH + (n>1 ? j*step : 0); var ampm = hr>=12 ? 'م' : 'ص'; var h12 = ((hr+11)%12)+1; var t = h12+' '+ampm;
      if(j===0) relabel(j,'أول وجبة فطر الصيام ('+t+')','افتح صيامك بوجبة متوازنة بروتين + كارب');
      else if(j===n-1) relabel(j,'آخر وجبة قبل الصيام ('+t+')','آخر أكل قبل ما تقفل نافذة الأكل');
      else relabel(j,'وجبة ('+t+')',(meals[j].description||'داخل نافذة الأكل'));
    }
    plan.scheduleNote = 'صيام متقطع 16:8 نافذة الأكل ~8 ساعات (مثال 12 الظهر ← 8 المساء). نفس السعرات والماكروز';
  }
  return plan;
}
function foodsByIds(ids){
  const wanted=new Set((Array.isArray(ids)?ids:[]).map(String));
  return (ctx().__EF_FOOD_CATALOG||[]).filter(function(food){return wanted.has(String(food.id));});
}
module.exports = { computeTargets:computeTargets, computeMealPlan:computeMealPlan, searchFoods:searchFoods, foodsByIds:foodsByIds, assertProfile:assertProfile, assertTargets:assertTargets, applyAvailableFoods:applyAvailableFoods, _buildContext:buildContext };
