'use strict';
// ============================================================
//  Workout Engine Host (server-side)
//  Runs the SAME browser workout-engine files unchanged inside
//  a Node vm sandbox with a minimal DOM/storage shim, so the
//  plan-generation logic executes on the server and stays the
//  single source of truth (same files the browser loads).
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WROOT = path.join(__dirname, '..', 'app', 'workout');
// Browser load order (from app/workout/index.html), minus pure export/UI-only
// files not needed to compute a plan.
// NOTE: ui/app.js is intentionally excluded. In the browser it is wrapped in
// an IIFE (its runMetrics/computePlans/buildFor helpers are private), so we
// re-implement that thin orchestration below using the global engine funcs.
const FILES = [
  'engine/state.js', 'engine/db.js', 'engine/rest.js', 'engine/constants.js',
  'engine/utils.js', 'engine/analysis.js', 'engine/splits.js', 'engine/planner.js',
  'engine/volume.js', 'engine/validate.js', 'export/video.js', 'ui/components.js'
];

function makeStub() {
  const f = function () { return makeStub(); };
  return new Proxy(f, {
    get: function (t, p) { if (p === Symbol.iterator) return function* () {}; if (p === 'length') return 0; return makeStub(); },
    set: function () { return true; },
    apply: function () { return makeStub(); },
    construct: function () { return makeStub(); }
  });
}
function makeEl(value) {
  const t = { value: value, innerHTML: '', textContent: '', value_: value, className: '', style: {}, dataset: {},
    classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
    children: [], childNodes: [], options: [] };
  const methods = { appendChild: 1, removeChild: 1, setAttribute: 1, getAttribute: 1, hasAttribute: 1,
    addEventListener: 1, removeEventListener: 1, insertAdjacentHTML: 1, remove: 1, closest: 1,
    querySelector: 1, querySelectorAll: 1, focus: 1, click: 1, scrollIntoView: 1, cloneNode: 1, replaceChildren: 1 };
  return new Proxy(t, {
    get: function (o, p) { if (p in o) return o[p]; if (methods[p]) return function () { return makeStub(); }; return makeStub(); },
    set: function (o, p, v) { o[p] = v; return true; }
  });
}

function makeStorage() {
  const _m = new Map();
  const s = {
    getItem: function (k) { return _m.has(k) ? _m.get(k) : null; },
    setItem: function (k, v) { _m.set(k, String(v)); },
    removeItem: function (k) { _m.delete(k); },
    clear: function () { _m.clear(); },
    key: function (i) { return Array.from(_m.keys())[i] || null; }
  };
  Object.defineProperty(s, 'length', { get: function () { return _m.size; } });
  return s;
}

function buildContext() {
  const sandbox = {
    console: { log: function () {}, warn: function () {}, error: function () {}, info: function () {}, debug: function () {} },
    document: {
      getElementById: function () { return makeEl(undefined); },
      querySelector: function () { return makeEl(undefined); },
      querySelectorAll: function () { return []; },
      getElementsByClassName: function () { return []; },
      getElementsByTagName: function () { return []; },
      createElement: function () { return makeEl(undefined); },
      createElementNS: function () { return makeEl(undefined); },
      createTextNode: function () { return makeEl(undefined); },
      addEventListener: function () {}, removeEventListener: function () {},
      body: makeEl(undefined), head: makeEl(undefined), documentElement: makeEl(undefined),
      readyState: 'complete', cookie: ''
    },
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    requestIdleCallback: function () { return 0; }, cancelIdleCallback: function () {},
    requestAnimationFrame: function () { return 0; }, cancelAnimationFrame: function () {},
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    setInterval: function () { return 0; }, clearInterval: function () {},
    navigator: { userAgent: 'node', language: 'ar' },
    location: { href: '', search: '', pathname: '/', hash: '', origin: '' },
    history: { pushState: function () {}, replaceState: function () {} },
    matchMedia: function () { return { matches: false, addListener: function () {}, removeListener: function () {}, addEventListener: function () {}, removeEventListener: function () {} }; },
    getComputedStyle: function () { return {}; },
    alert: function () {}, confirm: function () { return false; }, prompt: function () { return null; },
    performance: { now: function () { return Date.now(); } },
    fetch: function () { return Promise.reject(new Error('no network in host')); },
    URL: URL, URLSearchParams: URLSearchParams,
    Math: Math, Date: Date, JSON: JSON
  };
  vm.createContext(sandbox);
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox; sandbox.top = sandbox;

  let code = '';
  for (let i = 0; i < FILES.length; i++) {
    let src = fs.readFileSync(path.join(WROOT, FILES[i]), 'utf8');
    code += '\n;/* ===== ' + FILES[i] + ' ===== */\n' + src + '\n';
  }
  // Orchestrator lives in the SAME lexical scope so it can see const state,
  // GYM_DB, and the function declarations (runMetrics/computePlans/...).
  code += [
    "",
    "// ---- scoreSplitScientific: ported VERBATIM from app/workout/ui/app.js ----",
    "// ui/app.js is not loaded in this sandbox (it is the browser UI), but it is",
    "// not only UI: this function is how the website RANKS the training splits.",
    "// Without it the app ordered plans by the recommended flag alone, so a",
    "// second choice that the website would have ranked higher stayed buried.",
    "// `state` is a lexical const inside the bundle, so this must live HERE, in",
    "// the same scope -- a host-side copy could never read S._sustainTier.",
    ";function __efScoreSplit(k, meta, rec, S){",
    "  var s=(meta&&meta[k])||{};",
    "  var g=S.goal||'muscle', e=S.exp||'intermediate';",
    "  var r=+S.recoveryScore||60, tier=S._sustainTier||'mid';",
    "  var FREQ={fullbody:2.5,ppl_3:1.2,stronglifts:1.6,upper_lower:2,anterior_posterior:2,ppl_weak:1.4,torso_limbs:2,ppl:(S.days>=6?2:1.7),ululf:2.4,hybrid:1.6,ppul:1.7,brosplit:1,ul6:3,arnold:2};",
    "  var DEM={fullbody:1,ppl_3:1.4,stronglifts:2,upper_lower:1.5,anterior_posterior:1.5,ppl_weak:1.5,torso_limbs:1.5,ppl:2,ululf:2.4,hybrid:1.8,ppul:1.6,brosplit:2.4,ul6:3,arnold:3};",
    "  var f=FREQ[k]||1.6, dem=DEM[k]||1.8;",
    "  var sc=55;",
    "  if(s.goals&&s.goals.indexOf(g)>-1) sc+=13; else sc-=5;",
    "  if(s.level&&s.level.indexOf(e)>-1) sc+=10; else sc-=7;",
    "  var fw=(g==='muscle')?10:(g==='strength'?7:(g==='cut'?6:4));",
    "  sc+=Math.round(fw*(1-Math.min(1,Math.abs(2-f)/2)));",
    "  var rN=Math.max(0,Math.min(1,(r-40)/50));",
    "  sc-=Math.round((dem-1)*(1-rN)*7);",
    "  if((tier==='low'||tier==='critical')&&dem>=2.4) sc-=8;",
    "  if(s.requiresRecovery&&r<s.requiresRecovery) sc-=10;",
    "  if(s.requiresExp&&s.requiresExp!==e) sc-=10;",
    "  if(k===rec) sc+=18;",
    "  return Math.max(35,Math.min(99,Math.round(sc)));",
    "}",
    ";globalThis.__EF_WK__ = {",
    "  run: function(p){",
    "    var S = state;",
    "    S.gender = (p.gender==='female')?'female':'male';",
    "    S.age=+p.age||25; S.height=+p.height||175; S.weight=+p.weight||75;",
    "    S.goal=p.goal||'muscle'; S.exp=p.exp||'beginner'; S.equip=p.equip||'gym';",
    "    S.days=+p.days||3; S.time=String(p.time||'60');",
    "    S.daily=p.daily||'moderate'; S.sleep=p.sleep||'ok'; S.stress=p.stress||'low';",
    "    S.injuries=(Array.isArray(p.injuries)&&p.injuries.length)?p.injuries:['none'];",
    "    S.weak=Array.isArray(p.weak)?p.weak:[];",
    "    S._activeModules=Array.isArray(p.activeModules)?p.activeModules.slice(0,8):[];",
    "    S.preferredDays=Array.isArray(p.preferredDays)?p.preferredDays.slice(0,7):[];",
    "    S.plan=null; S._trainingSchedule=null; S._planCacheKey=null; S.splitData=null;",
    "    S._lastMuscleMapSplit=null; S._realTotalSets=null; S.selectedSplit='';",
    "    // ---- runMetrics (mirrors ui/app.js) ----",
    "    S.bmi = calcBMI(S.weight, S.height);",
    "    S.bmiCat = getBMICat(S.bmi);",
    "    S.tdee = calcTDEE(S.weight, S.height, S.age, S.gender, S.daily);",
    "    try{ S.recoveryScore = calcRecovery(); }catch(e){ S.recoveryScore = 70; }",
    "    try{ calcAdvancedScores(); }catch(e){}",
    "    try{ calcRecoveryModifiers(); }catch(e){}",
    "    S.recommendedSplit = getRecommendedSplit();",
    "    // ---- computePlans (mirrors ui/app.js) ----",
    "    var meta = {}; try{ meta = getSplits()||{}; }catch(e){}",
    "    var keys = []; try{ keys = (recommendSplitsForDays(S.days)||[]).slice(); }catch(e){}",
    "    var rec = S.recommendedSplit;",
    "    if(rec && keys.indexOf(rec)>-1){ keys = [rec].concat(keys.filter(function(k){return k!==rec;})); }",
    "    var out = [];",
    "    keys.forEach(function(k){",
    "      S.selectedSplit=k; S._trainingSchedule=null; S.plan=null; S._planCacheKey=null;",
    "      S._realTotalSets=null; S.splitData=null; S._lastMuscleMapSplit=null;",
    "      var plan=[]; try{ buildExercisePlan(); plan = JSON.parse(JSON.stringify(S.plan||[])); }catch(e){ plan=[]; }",
    "      // The website injects the helper units (warmup/core/cardio/stretch/...)",
    "      // into the plan days AFTER the exercises are picked. Mobile loaded the",
    "      // planner but never called this layer, so every unit the user chose was",
    "      // silently dropped on the way to the app.",
    "      try{ if(S._activeModules.length && typeof applyModuleIntegrationLayer==='function'){",
    "        plan = applyModuleIntegrationLayer(plan, S._activeModules, S.goal, +S.recoveryScore||70, S.exp, S.weak) || plan;",
    "      } }catch(e){}",
    "      var td = plan.filter(function(d){ return d && !d.isRest && (d.exercises||[]).length>0; });",
    "      if(td.length){",
    "        // Plan-quality grade, same call the website makes on its cards.",
    "        var q=null;",
    "        try{ if(typeof PlanValidator!=='undefined' && PlanValidator.scorePlan){",
    "          q=PlanValidator.scorePlan(td,{ exp:S.exp, goal:S.goal, recoveryScore:+S.recoveryScore||70, minEx:(S.exp==='advanced'?6:(S.exp==='beginner'?4:5)) });",
    "        } }catch(e){ q=null; }",
    "        out.push({ key:k, name:(meta[k]||{}).name||k, desc:(meta[k]||{}).desc||'', rec:(k===rec), plan:plan, trainDays:td, score:__efScoreSplit(k,meta,rec,S), quality:q });",
    "      }",
    "    });",
    "    // Website order: highest scientific score first, recommended breaks ties.",
    "    out.sort(function(a,b){ return (b.score-a.score)||((b.rec?1:0)-(a.rec?1:0)); });",
    "    return JSON.parse(JSON.stringify({",
    "      metrics:{ bmi:S.bmi, bmiCat:S.bmiCat, tdee:S.tdee, recoveryScore:S.recoveryScore, recommendedSplit:S.recommendedSplit },",
    "      plans: out",
    "    }));",
    "  },",
    "  modules: function(){ if(typeof MODULE_DB==='undefined')return {}; return JSON.parse(JSON.stringify(MODULE_DB)); },",
    "  alternatives: function(o){",
    "    o=o||{}; var active=(o.equipment==='home')?HOME_DB:GYM_DB; var all=[];",
    "    Object.keys(active).forEach(function(group){ var g=active[group]||{}; Object.keys(g).forEach(function(sub){ (g[sub]||[]).forEach(function(ex){ all.push({n:ex.n,alt:ex.alt||'',vid:ex.vid||'',mu:ex.mu||'',tier:ex.tier||'',safe_injuries:ex.safe_injuries||[],goal_bonus:ex.goal_bonus||[],group:group,sub:sub}); }); }); });",
    "    var current=all.filter(function(ex){return ex.n===o.currentName;})[0]||null; var injuries=Array.isArray(o.injuries)?o.injuries.filter(function(x){return x&&x!=='none';}):[];",
    "    var seen={}; var pool=all.filter(function(ex){",
    "      if(!ex.n||ex.n===o.currentName||seen[ex.n])return false; seen[ex.n]=1;",
    "      if(current&&ex.group!==current.group)return false;",
    "      return injuries.every(function(inj){ var base=String(inj).replace(/_mild$/,''); return ex.safe_injuries.indexOf(inj)>-1||ex.safe_injuries.indexOf(base)>-1||ex.safe_injuries.indexOf(base+'_mild')>-1; });",
    "    }).map(function(ex){ ex.score=(current&&current.alt===ex.n?100:0)+(current&&ex.sub===current.sub?60:0)+(current&&ex.mu===current.mu?30:0)+(ex.goal_bonus.indexOf(o.goal)>-1?10:0)+(ex.tier==='S'?5:ex.tier==='A'?3:0); return ex; })",
    "      .sort(function(a,b){return b.score-a.score;});",
    "    if(!current){",
    "      var hint=String(o.muscle||o.group||'').trim().toLowerCase(); if(!hint) return [];",
    "      return pool.filter(function(ex){ return String(ex.mu).toLowerCase()===hint||String(ex.group).toLowerCase()===hint; }).slice(0,20);",
    "    }",
    "    var sameFunction=pool.filter(function(ex){return ex.sub===current.sub;});",
    "    var rest=pool.filter(function(ex){return ex.sub!==current.sub;});",
    "    return sameFunction.concat(rest).slice(0,20);",
    "  },",
    "  metadata: function(names){",
    "    var wanted={}; (Array.isArray(names)?names:[]).forEach(function(name){wanted[String(name)]=1;}); var out={},dbs=[GYM_DB,HOME_DB];",
    "    dbs.forEach(function(active){Object.keys(active).forEach(function(group){var g=active[group]||{};Object.keys(g).forEach(function(sub){(g[sub]||[]).forEach(function(ex){if(wanted[ex.n]&&!out[ex.n])out[ex.n]={name:ex.n,muscle:ex.mu||'',group:group,sub:sub,tier:ex.tier||'',videoId:ex.vid||''};});});});});",
    "    return out;",
    "  },",
    "  standards: function(){",
    "    return { volume: (typeof MUSCLE_VOLUME_STANDARDS!=='undefined'?MUSCLE_VOLUME_STANDARDS:{}), caps: (typeof MUSCLE_WEEKLY_CAPS!=='undefined'?MUSCLE_WEEKLY_CAPS:{}) };",
    "  }",
    "};"
  ].join('\n');
  const script = new vm.Script(code, { filename: 'workout-engine-bundle.js' });
  script.runInContext(sandbox, { timeout: 30000 });
  return sandbox;
}

let _ctx = null;
function ctx() { if (!_ctx) _ctx = buildContext(); return _ctx; }

// ── Weak-point vocabulary bridge ─────────────────────────
// The mobile UI stores coarse, user-friendly muscle names (legs / arms /
// core) but the engine's weakScore matches against each exercise `mu`
// string, which uses ANATOMICAL keys (quads / hamstrings / biceps /
// triceps / abs). Without this expansion a "legs" or "arms" weak point
// silently scored 0 and never boosted an exercise. Expanding at this one
// server-side chokepoint also migrates every already-saved profile.
const WEAK_ALIAS = {
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  arms: ['biceps', 'triceps'],
  core: ['core', 'abs']
};
function normalizeWeak(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  list.forEach(function (raw) {
    const key = String(raw || '').trim().toLowerCase();
    if (!key) return;
    (WEAK_ALIAS[key] || [key]).forEach(function (m) { if (out.indexOf(m) < 0) out.push(m); });
  });
  return out;
}

function computeWorkout(profile) {
  const c = ctx();
  const p = Object.assign({}, profile || {});
  p.weak = normalizeWeak(p.weak);
  p.activeModules = normalizeModules(p.activeModules);
  return c.__EF_WK__.run(p);
}

// ── Helper-unit key bridge ────────────────────────────────────────────
// The website ships TWO vocabularies for the same units: the picker offers
// warmup / stretch / breath / recovery, while the planner branches on
// mobility / stretching / breathing / sleep. Four of the eight units could
// therefore never fire on the website either. Translating at this one
// chokepoint makes every unit real on mobile.
const MODULE_ALIAS = {
  warmup: 'mobility',
  stretch: 'stretching',
  breath: 'breathing',
  recovery: 'sleep'
};
const MODULE_KEYS = ['warmup', 'cardio', 'core', 'stretch', 'yoga', 'breath', 'recovery', 'kegel'];
function normalizeModules(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  list.forEach(function (raw) {
    const key = String(raw || '').trim().toLowerCase();
    if (!key) return;
    const mapped = MODULE_ALIAS[key] || key;
    if (out.indexOf(mapped) < 0) out.push(mapped);
  });
  return out;
}

function moduleCatalog() {
  const c = ctx();
  try { return JSON.parse(JSON.stringify(c.__EF_WK__.modules())); } catch (_) { return {}; }
}

function exerciseAlternatives(options) {
  const c = ctx();
  return JSON.parse(JSON.stringify(c.__EF_WK__.alternatives(options || {})));
}

function exerciseMetadata(names) {
  const c = ctx();
  return JSON.parse(JSON.stringify(c.__EF_WK__.metadata(names || [])));
}

// Exposes the original engine's MEV/good/opt landmarks and level-based weekly
// caps so the mobile Smart Coach grades real logged volume against the SAME
// science the planner is built on, instead of inventing its own thresholds.
function volumeStandards() {
  const c = ctx();
  return JSON.parse(JSON.stringify(c.__EF_WK__.standards()));
}

// Exposes the live sandbox so lib/video-guard.js can reuse the ORIGINAL
// verifiedVideoPipeline / safeVidUrl curation instead of reimplementing it.
// Uses the cached context -- never rebuilds the (expensive) engine bundle.
function engineContext() {
  return ctx();
}

module.exports = { computeWorkout: computeWorkout, normalizeWeak: normalizeWeak, normalizeModules: normalizeModules, moduleCatalog: moduleCatalog, exerciseAlternatives: exerciseAlternatives, exerciseMetadata: exerciseMetadata, volumeStandards: volumeStandards, engineContext: engineContext, _buildContext: buildContext };
