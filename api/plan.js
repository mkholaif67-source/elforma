'use strict';
// /api/plan/* — server-side plan computation.
// The premium plan-generation logic runs ONLY on the server (via the engine
// host). Clients send their profile inputs and receive computed results,
// gated by subscription: free users get a limited preview, subscribers get
// the full plan. The engine logic itself never ships to the browser.
const auth = require('../lib/auth');
const db = require('../lib/db');
const { sendJson, readJsonBody, parseCookies } = require('../lib/util');
const host = require('../lib/nutrition-engine-host');
const { rateLimit } = require('../lib/rateLimit');

/* Plan generation is by far the heaviest thing this server does: it boots the
   whole diet engine inside a vm and assembles a full week of meals. One person
   hammering the button can therefore slow the app down for everyone, so the
   expensive endpoints get their own budget. Logged-in users are keyed by id so
   a shared cafe/office IP never punishes the wrong person. */
function tooMany(res, key, limit, windowMs) {
  if (rateLimit(key, limit, windowMs)) return false;
  sendJson(res, 429, { error: '\u0637\u0644\u0628\u0627\u062a \u0643\u062a\u064a\u0631\u0629 \u0641\u064a \u0648\u0642\u062a \u0642\u0635\u064a\u0631 \u2014 \u0627\u0633\u062a\u0646\u0649 \u062f\u0642\u064a\u0642\u0629 \u0648\u062d\u0627\u0648\u0644 \u062a\u0627\u0646\u064a' });
  return true;
}

// Mirror of auth.subActive — never trust the client for entitlement.
function subActive(sub) {
  if (!sub || !sub.plan || sub.plan === 'free') return false;
  if (sub.status !== 'active' && sub.status !== 'trialing') return false;
  if (sub.current_period_end) { const e = Date.parse(sub.current_period_end); if (Number.isFinite(e) && e <= Date.now()) return false; }
  return true;
}

// Whitelist + coerce only known scalar profile fields coming from the client.
function cleanProfile(b) {
  const p = (b && b.profile) || {};
  const out = {};
  const S = function (k) { if (typeof p[k] === 'string' && p[k].length <= 40) out[k] = p[k]; };
  const N = function (k) { const v = Number(p[k]); if (Number.isFinite(v)) out[k] = v; };
  S('gender'); N('age'); N('height'); N('weight'); N('target'); N('activity');
  S('goal'); S('gainStyle'); S('selectedDiet'); N('mealCount');
  N('currentWeek'); N('expectedWeeklyLoss');
  if (Array.isArray(p.healthConditions)) out.healthConditions = p.healthConditions.filter(function (x) { return typeof x === 'string'; }).slice(0, 20);
  if (Array.isArray(p.dietProblems)) out.dietProblems = p.dietProblems.filter(function (x) { return typeof x === 'string'; }).slice(0, 20);
  if (!out.selectedDiet) out.selectedDiet = 'balanced';
  return out;
}
// Only allow inp-* keys (the DOM input ids the engine reads) with scalar values.
function cleanInputs(b) {
  const i = (b && b.inputs) || {};
  const out = {};
  Object.keys(i).slice(0, 40).forEach(function (k) {
    if (/^inp-[a-z0-9_-]+$/i.test(k)) { const v = i[k]; if (typeof v === 'string' || typeof v === 'number') out[k] = String(v); }
  });
  return out;
}

// FREE preview: numeric targets + only the first meal; the rest stays locked.
function gatePreview(full) {
  const meals = (full.plan && full.plan.meals) || [];
  return {
    locked: true,
    targets: full.targets,
    plan: {
      targetCals: full.plan && full.plan.targetCals,
      totals: full.plan && full.plan.totals,
      mealsTotal: meals.length,
      meals: meals.slice(0, 1)
    }
  };
}

async function compute(req, res, ip) {
  const user = auth.currentUser(parseCookies(req));
  if (tooMany(res, 'plan:compute:' + (user ? 'u' + user.id : 'ip' + ip), 12, 60000)) return;
  const b = await readJsonBody(req);
  const profile = cleanProfile(b);
  const inputs = cleanInputs(b);
  if (!profile.weight || !profile.height || !profile.age) return sendJson(res, 400, { error: 'بيانات ناقصة: الوزن والطول والعمر مطلوبين' });
  let full;
  try { full = host.computeMealPlan(profile, inputs); }
  catch (e) { return sendJson(res, 500, { error: 'تعذر حساب الخطة' }); }
  const sub = user ? (db.getSubscription(user.id) || { plan: 'free', status: 'active' }) : null;
  if (subActive(sub)) return sendJson(res, 200, { ok: true, locked: false, targets: full.targets, plan: full.plan });
  return sendJson(res, 200, Object.assign({ ok: true }, gatePreview(full)));
}

// Numeric targets only (BMR/TDEE/calories/macros) — safe for any request.
async function targets(req, res) {
  const tUser = auth.currentUser(parseCookies(req));
  if (tooMany(res, 'plan:targets:' + (tUser ? 'u' + tUser.id : 'anon'), 30, 60000)) return;
  const b = await readJsonBody(req);
  const profile = cleanProfile(b);
  const inputs = cleanInputs(b);
  if (!profile.weight || !profile.height || !profile.age) return sendJson(res, 400, { error: 'بيانات ناقصة' });
  let t; try { t = host.computeTargets(profile, inputs); } catch (e) { return sendJson(res, 500, { error: 'تعذر الحساب' }); }
  return sendJson(res, 200, { ok: true, targets: t });
}

module.exports = { compute, targets };
