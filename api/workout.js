'use strict';
// /api/workout/* — server-side workout plan computation.
// The training-plan engine runs ONLY on the server (via the workout engine
// host). Clients send their profile answers and receive a computed weekly
// split with real exercises, gated by subscription: free users get a preview
// (recommended split + first training day), subscribers get every split fully.
const auth = require('../lib/auth');
const db = require('../lib/db');
const { sendJson, readJsonBody, parseCookies } = require('../lib/util');
const host = require('../lib/workout-engine-host');
const videoGuard = require('../lib/video-guard');
const finisher = require('../lib/workout-plan-finisher');
const { rateLimit } = require('../lib/rateLimit');
const vocab = require('../lib/goal-vocabulary');
// [OWNER-RULE] السعرات اللي بتظهر في التمرين لازم تكون نفس الرقم اللي في التغذية.
const energy = require('../lib/energy-unified');

function subActive(sub) {
  if (!sub || !sub.plan || sub.plan === 'free') return false;
  if (sub.status !== 'active' && sub.status !== 'trialing') return false;
  if (sub.current_period_end) { const e = Date.parse(sub.current_period_end); if (Number.isFinite(e) && e <= Date.now()) return false; }
  return true;
}

const GENDER = { male: 'male', female: 'female' };
// The client already translated the mobile goal into workout vocabulary
// (see profile_store.dart -> goal-vocabulary.js MOBILE_TO_WORKOUT); here we
// only sanitise it against the single authoritative whitelist.
const EQUIP = { gym: 'gym', home: 'home' };
const EXP = { beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced' };
const DAILY = { sedentary: 'sedentary', light: 'light', moderate: 'moderate', active: 'active', veryActive: 'veryActive' };
const SLEEP = { poor: 'poor', ok: 'ok', good: 'good' };
const STRESS = { low: 'low', mid: 'mid', high: 'high' };
const INJ = ['shoulder', 'back', 'knee', 'elbow', 'wrist', 'neck'];
const WEAK = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core', 'calves', 'forearms'];

// Physiological body metrics required to compute ANY plan. Same bounds the
// nutrition path enforces, so the two engines refuse identical bad input.
const BODY = {
  age:    { min: 7,   max: 80,  label: 'العمر' },
  height: { min: 100, max: 250, label: 'الطول' },
  weight: { min: 25,  max: 350, label: 'الوزن' }
};

// Refuse loudly instead of guessing. Before this gate the workout path silently
// fabricated age 25 / height 175 / weight 75 for a half-filled profile and
// shipped a plan built around a body the user never entered. The nutrition
// path already refuses this way; now both do.
function validateBody(b) {
  const p = (b && b.profile) || {};
  const missing = [];
  Object.keys(BODY).forEach(function (key) {
    const v = Number(p[key]);
    if (!Number.isFinite(v) || v <= 0) missing.push(BODY[key].label);
  });
  if (missing.length) {
    return 'بيانات ناقصة: ' + missing.join('، ') + ' مطلوبة لحساب جدول التمرين';
  }
  var bad = null;
  Object.keys(BODY).forEach(function (key) {
    const spec = BODY[key];
    const v = Number(p[key]);
    if (!bad && (v < spec.min || v > spec.max)) {
      bad = 'قيمة غير منطقية ل' + spec.label + 'راجع بياناتك';
    }
  });
  return bad;
}

// Whitelist + coerce only known workout profile fields coming from the client.
// NOTE: age/height/weight carry NO fake fallback anymore -- validateBody has
// already rejected the request if any of them is missing or implausible, so a
// zero here can only mean the gate was bypassed, never a fabricated body.
const MODULES = ['warmup', 'cardio', 'core', 'stretch', 'yoga', 'breath', 'recovery', 'kegel'];

function cleanProfile(b) {
  const p = (b && b.profile) || {};
  const out = {};
  const N = function (k, d) { const v = Number(p[k]); return Number.isFinite(v) ? v : d; };
  out.gender = GENDER[p.gender] || 'male';
  out.age = N('age', 0);
  out.height = N('height', 0);
  out.weight = N('weight', 0);
  out.goal = vocab.whitelistWorkoutGoal(p.goal);
  out.exp = EXP[p.exp] || 'beginner';
  out.equip = EQUIP[p.equip] || 'gym';
  out.days = Math.max(2, Math.min(6, N('days', 3)));
  out.time = String(p.time || '60').slice(0, 6);
  out.daily = DAILY[p.daily] || 'moderate';
  out.sleep = SLEEP[p.sleep] || 'ok';
  out.stress = STRESS[p.stress] || 'low';
  out.injuries = Array.isArray(p.injuries) ? p.injuries.filter(function (x) { return INJ.indexOf(x) > -1; }).slice(0, 6) : [];
  out.weak = Array.isArray(p.weak) ? p.weak.filter(function (x) { return WEAK.indexOf(x) > -1; }).slice(0, 4) : [];
  out.activeModules = Array.isArray(p.activeModules) ? p.activeModules.filter(function (x) { return MODULES.indexOf(x) > -1; }).slice(0, 8) : [];
  // [EGY] الأيام المفضلة للتمرين (السبت=0 .. الجمعة=6) — المحرك يوزع الحصص عليها.
  out.preferredDays = Array.isArray(p.preferredDays)
    ? Array.from(new Set(p.preferredDays.map(function(x){return Math.round(Number(x));}).filter(function(x){return Number.isFinite(x)&&x>=0&&x<=6;}))).sort(function(a,b){return a-b;}).slice(0, 7)
    : [];
  return out;
}

// FREE preview: recommended split, its metadata, and only the FIRST training
// day's exercises; every remaining day and the alternative splits stay locked.
function gatePreview(full) {
  const plans = full.plans || [];
  const rec = plans.filter(function (p) { return p.rec; })[0] || plans[0] || null;
  let preview = null;
  if (rec) {
    const firstTrain = (rec.trainDays || [])[0] || null;
    preview = {
      key: rec.key, name: rec.name, desc: rec.desc,
      trainDaysTotal: (rec.trainDays || []).length,
      previewDay: firstTrain
    };
  }
  return {
    locked: true,
    metrics: full.metrics,
    plansTotal: plans.length,
    recommended: preview
  };
}

async function compute(req, res) {
  const user = auth.currentUser(parseCookies(req));
  /* Building a weekly split boots the training engine in a vm and runs the
     coverage, prescription and video-guard passes. It is the second heaviest
     request in the app, so it gets its own budget instead of being unlimited. */
  if (!rateLimit('workout:compute:' + (user ? 'u' + user.id : 'anon'), 12, 60000)) {
    return sendJson(res, 429, { error: '\u0637\u0644\u0628\u0627\u062a \u0643\u062a\u064a\u0631\u0629 \u0641\u064a \u0648\u0642\u062a \u0642\u0635\u064a\u0631 \u2014 \u0627\u0633\u062a\u0646\u0649 \u062f\u0642\u064a\u0642\u0629 \u0648\u062d\u0627\u0648\u0644 \u062a\u0627\u0646\u064a' });
  }
  const b = await readJsonBody(req);
  const bodyError = validateBody(b);
  if (bodyError) return sendJson(res, 400, { error: bodyError });
  const profile = cleanProfile(b);
  let full;
  // Sprint 15: computeStablePlan() seeds the engine's own variety RNG from the
  // profile (so reopening the app shows the SAME plan, not a reshuffled one)
  // and then re-runs the project's prescribeExercise() over any lift that the
  // late coverage/replacement passes injected after applyPrescriptionLayer had
  // already finished -- those lifts used to reach the phone with blank
  // RIR / tempo / progression fields.
  try { full = finisher.computeStablePlan(profile).out; }
  catch (e) { return sendJson(res, 500, { error: 'تعذر حساب جدول التمرين' }); }
  // Sprint 13: every exercise video must pass the original project's
  // verification pipeline before it can reach a client. Previously the raw
  // engine `vid` (default: the STRING 'null') was shipped as-is, which is why
  // the app opened "video unavailable" pages.
  try { videoGuard.guardPlan(full); } catch (e) { /* never block a plan on video repair */ }
  try{ require('../lib/warmup-activation').attachToPlan(full); }catch(_e){}
  // الإطالة بقت زي الإحماء بالظبط: حركت مختارة لعضلات الجلسة
  // بفيديوهات من نفس قاعدة بيانات المحرك، مش دامب لكل الإطالات.
  try{ require('../lib/stretch-cooldown').attachToPlan(full); }catch(_e){}
  if (!full || !Array.isArray(full.plans) || !full.plans.length) {
    return sendJson(res, 500, { error: 'تعذر توليد جدول مناسب جرب تعديل عدد الأيام' });
  }
  // [OWNER-RULE] توحيد السعرات: محرك التغذية هو المرجع، وصفحة التمرين
  // تعرض نفس رقمه بدل ما تحسب بمعادلة مختلفة. لو فشل بيفضل رقم المحرك.
  try {
    // [OWNER-RULE] بنحمّل نفس البروفايل المخزّن اللي صفحة التغذية بتستخدمه
    // (وزن، طول، weeklyRate، دهون، محيطات) عشان رقم السعرات في التمرين
    // يطابق التغذية بالظبط ويتبع الهدف (تخسيس/زيادة) مش رقم منفصل.
    let mobileProfile = null;
    if (user) {
      try {
        const row = db.mobileProfile(user.id);
        if (row && row.profile_json) {
          const parsed = JSON.parse(row.profile_json);
          if (parsed && Number(parsed.age) > 0 && Number(parsed.height) > 0 && Number(parsed.weight) > 0) {
            const w = db.recentWeights(user.id, 5);
            if (w && w.length && Number(w[0].weight) > 0) parsed.weight = Number(w[0].weight);
            const ms = db.recentMeasurements(user.id, 5);
            const lm = ms && ms.length ? ms[0] : {};
            parsed.__extras = {
              steps: parsed.steps, cardioSessions: parsed.cardioSessions,
              cardioIntensity: parsed.cardioIntensity, weeklyRate: parsed.weeklyRate,
              bodyFat: parsed.bodyFat != null ? parsed.bodyFat : lm.body_fat,
              waist: parsed.waist != null ? parsed.waist : lm.waist,
              neck: parsed.neck, hips: parsed.hips != null ? parsed.hips : lm.hips,
            };
            mobileProfile = parsed;
          }
        }
      } catch (_e2) { mobileProfile = null; }
    }
    energy.unifyPlanMetrics(full, profile, mobileProfile);
  } catch (_e) { /* مانكسرش الخطة عشان رقم */ }
  const sub = user ? (db.getSubscription(user.id) || { plan: 'free', status: 'active' }) : null;
  if (subActive(sub)) {
    return sendJson(res, 200, { ok: true, locked: false, metrics: full.metrics, plans: full.plans });
  }
  return sendJson(res, 200, Object.assign({ ok: true }, gatePreview(full)));
}

module.exports = { compute };
