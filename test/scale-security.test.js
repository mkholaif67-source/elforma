'use strict';
// اختبارات دفعة v2.10.28
// القاعدة تحت الضغط · الكاش · بلاغات الفيديو · الأمان · الترابط · الإشعارات · اسم التمارين المكملة
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const check = (label, ok, extra) => {
  if (ok) { pass++; console.log('  \u2713 ' + label); }
  else { fail++; console.log('  \u2717 ' + label + (extra ? ' \u2014 ' + extra : '')); }
};
const ok = (label, fn) => { try { fn(); check(label, true); } catch (e) { check(label, false, e.message); } };
const section = (t) => console.log('\n' + t);
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };

// الملفات العربية جوّا الدارت مكتوبة أحيانا برموز هروب \uXXXX
// فلازم نفكها قبل ما ندور على نص عربي وإلا الاختبار يكدب علينا
const rawOf = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const read = (p) => rawOf(p).replace(/\\u([0-9a-fA-F]{4})/g,
  (m, h) => String.fromCharCode(parseInt(h, 16)));

// ── 1) الكاش ─────────────────────────────────────
section('\u0637\u0628\u0642\u0629 \u0627\u0644\u0643\u0627\u0634');
const { createCache, nutritionCache } = require('../lib/cache');

ok('\u0627\u0644\u0643\u0627\u0634 \u0628\u064a\u0631\u062c\u0639 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u062d\u0641\u0648\u0638\u0629', () => {
  const c = createCache({ max: 10, ttl: 5000 });
  const v = c.set('a', { n: 1 });
  assert(v && v.n === 1, 'set must return the value');
  assert(c.get('a').n === 1, 'get must read it back');
});

ok('\u0627\u0644\u0643\u0627\u0634 \u0628\u064a\u0637\u0631\u062f \u0627\u0644\u0623\u0642\u062f\u0645 \u0644\u0645\u0627 \u064a\u062a\u0645\u0644\u064a', () => {
  // الكاش بيفرض حد أدنى 16 عنصر عشان محدش يظبطه غلط في الإنتاج
  const c = createCache({ max: 16, ttl: 5000 });
  for (let i = 0; i < 40; i++) c.set('k' + i, i);
  assert(c.stats().size <= 16, 'size must stay within max, got ' + c.stats().size);
  assert(c.get('k0') === undefined, 'oldest entry must be evicted');
  assert(c.get('k39') === 39, 'newest entry must survive');
  assert(c.stats().evictions > 0, 'eviction must be counted');
});

ok('\u0627\u0644\u0643\u0627\u0634 \u0628\u064a\u0646\u062a\u0647\u064a \u0628\u0639\u062f \u0627\u0644\u0645\u062f\u0629', () => {
  const c = createCache({ max: 20, ttl: 5000 });
  c.set('x', 9, 5); // مدة مخصوصة قصيرة للاختبار
  c.set('y', 8);
  const until = Date.now() + 25;
  while (Date.now() < until) { /* wait out the ttl */ }
  assert(c.get('x') === undefined, 'expired entry must not be served');
  assert(c.get('y') === 8, 'a fresh entry must still be served');
});

ok('\u0627\u0644\u0625\u0644\u063a\u0627\u0621 \u0628\u0627\u0644\u0628\u0627\u062f\u0626\u0629 \u0628\u064a\u0645\u0633\u062d \u0645\u0633\u062a\u062e\u062f\u0645 \u0648\u0627\u062d\u062f \u0628\u0633', () => {
  const c = createCache({ max: 50, ttl: 5000 });
  c.set('np:7:1', 'mine'); c.set('np:7:0', 'mine2'); c.set('np:8:1', 'other');
  c.invalidatePrefix('np:7:');
  assert(c.get('np:7:1') === undefined, 'user 7 must be cleared');
  assert(c.get('np:8:1') === 'other', 'other users must survive');
});

ok('\u0643\u0627\u0634 \u0627\u0644\u062a\u063a\u0630\u064a\u0629 \u0645\u0648\u062c\u0648\u062f \u0648\u0645\u062d\u062f\u0648\u062f \u0627\u0644\u062d\u062c\u0645', () => {
  const s = nutritionCache.stats();
  assert(s.max > 0 && s.ttlMs > 0, 'nutrition cache must be bounded');
});

ok('\u062e\u0637\u0629 \u0627\u0644\u062a\u063a\u0630\u064a\u0629 \u0628\u062a\u0642\u0631\u0627 \u0648\u0628\u062a\u0643\u062a\u0628 \u0641\u064a \u0627\u0644\u0643\u0627\u0634', () => {
  const src = rawOf('api/mobile.js');
  assert(src.indexOf("require('../lib/cache')") > -1, 'mobile api must use the cache');
  assert(/nutritionCache\.set\(_ck/.test(src), 'the response must be cached');
  assert(/function dropCache/.test(src), 'writes must be able to drop the cache');
});

ok('\u0643\u0644 \u0643\u062a\u0627\u0628\u0629 \u0628\u062a\u0645\u0633\u062d \u0627\u0644\u0643\u0627\u0634', () => {
  const src = rawOf('api/mobile.js');
  const hits = (src.match(/dropCache\(u\.id\)/g) || []).length;
  assert(hits >= 4, 'expected dropCache on profile, plan, nutrition and weight writes, got ' + hits);
});

// ── 2) القاعدة تحت الضغط ───────────────────────
section('\u0627\u0644\u0642\u0627\u0639\u062f\u0629 \u062a\u062d\u062a \u0627\u0644\u0636\u063a\u0637');
const dbSrc = rawOf('lib/db.js');

ok('\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0623\u062f\u0627\u0621 \u0645\u062a\u0641\u0639\u0644\u0629', () => {
  ['journal_mode = WAL', 'synchronous = NORMAL', 'temp_store = MEMORY', 'mmap_size', 'cache_size']
    .forEach((p) => assert(dbSrc.indexOf(p) > -1, 'missing pragma ' + p));
});

ok('\u0643\u0644 \u0627\u0644\u0627\u0633\u062a\u0639\u0644\u0627\u0645\u0627\u062a \u0627\u0644\u0633\u0627\u062e\u0646\u0629 \u0644\u064a\u0647\u0627 \u0641\u0647\u0631\u0633', () => {
  ['idx_nutrition_days_user_day', 'idx_weight_logs_user_day', 'idx_workout_plans_user_active',
   'idx_video_reports_status'].forEach((i) => assert(dbSrc.indexOf(i) > -1, 'missing index ' + i));
});

ok('\u0645\u0627\u0641\u064a\u0634 \u0627\u0633\u062a\u0639\u0644\u0627\u0645 \u0645\u0641\u062a\u0648\u062d \u0628\u0644\u0627 \u0633\u0642\u0641', () => {
  const hot = ['recentWeights', 'recentMeasurements', 'nutritionHistory', 'foodPreferences'];
  hot.forEach((name) => {
    const re = new RegExp(name + '\\s*[:=][\\s\\S]{0,400}?LIMIT');
    assert(re.test(dbSrc), name + ' must be capped with LIMIT');
  });
});

// ── 3) بلاغات الفيديو ───────────────────────────
section('\u0628\u0644\u0627\u063a\u0627\u062a \u0627\u0644\u0641\u064a\u062f\u064a\u0648');

ok('\u0627\u0644\u062c\u062f\u0648\u0644 \u0648\u0627\u0644\u0645\u0633\u0627\u0639\u062f\u0627\u062a \u0645\u0648\u062c\u0648\u062f\u064a\u0646', () => {
  assert(dbSrc.indexOf('video_reports') > -1, 'table missing');
  ['reportVideo', 'videoReports', 'openVideoReportCount', 'resolveVideoReports']
    .forEach((f) => assert(dbSrc.indexOf(f) > -1, 'missing helper ' + f));
});

ok('\u0627\u0644\u0645\u0633\u0627\u0631\u0627\u062a \u0645\u0648\u0635\u0648\u0644\u0629', () => {
  const s = rawOf('server.js');
  ['/api/app/video-report', '/api/admin/video-reports', '/api/admin/video-report/resolve']
    .forEach((r) => assert(s.indexOf(r) > -1, 'missing route ' + r));
});

ok('\u0627\u0644\u0628\u0644\u0627\u063a \u0645\u062d\u0645\u064a \u0645\u0646 \u0627\u0644\u0625\u063a\u0631\u0627\u0642', () => {
  const s = rawOf('api/mobile.js');
  assert(/video-report:/.test(s), 'the report endpoint must be rate limited');
});

ok('\u0627\u0644\u0645\u062a\u062f\u0631\u0628 \u064a\u0642\u062f\u0631 \u064a\u0628\u0644\u063a \u0645\u0646 \u062c\u0648\u0651\u0627 \u0627\u0644\u062a\u0637\u0628\u064a\u0642', () => {
  assert(rawOf('mobile/lib/api.dart').indexOf('reportBrokenVideo') > -1, 'app api missing');
  assert(rawOf('mobile/lib/screens/helper_units_screen.dart').indexOf('_reportLine') > -1,
    'report affordance missing');
});

ok('\u0632\u0631\u0627\u0631 \u0627\u0644\u0628\u0644\u0627\u063a \u0635\u063a\u064a\u0631 \u0645\u0634 \u0632\u062d\u0645\u0629', () => {
  const u = rawOf('mobile/lib/screens/helper_units_screen.dart');
  const i = u.indexOf('_reportLine(UnitExercise');
  assert(i > -1, '_reportLine must exist');
  const body = u.slice(i, i + 900);
  assert(/shrinkWrap/.test(body), 'tap target must shrink');
  assert(/fontSize:\s*1[01](\.\d)?/.test(body), 'label must stay small');
});

ok('\u0644\u0648\u062d\u0629 \u0627\u0644\u0623\u062f\u0645\u0646 \u0628\u062a\u0639\u0631\u0636 \u0627\u0644\u0637\u0627\u0628\u0648\u0631', () => {
  const a = rawOf('public/admin.html');
  assert(a.indexOf('loadVideoReports') > -1, 'reports panel missing');
  assert(a.indexOf('/api/admin/video-reports') > -1, 'panel must call the api');
  assert(a.indexOf('/api/admin/video-report/resolve') > -1, 'resolve button missing');
});

// ── 4) الأمان ───────────────────────────────────
section('\u0627\u0644\u0623\u0645\u0627\u0646');
const rl = require('../lib/rateLimit');

ok('\u0627\u0644\u062f\u062e\u0648\u0644 \u0628\u064a\u062a\u0642\u0641\u0644 \u0628\u0639\u062f \u0645\u062d\u0627\u0648\u0644\u0627\u062a \u0641\u0627\u0634\u0644\u0629 \u0645\u062a\u0643\u0631\u0631\u0629', () => {
  const k = 'lock:test:' + Math.random();
  for (let i = 0; i < 7; i++) rl.registerFailure(k);
  assert(rl.isLocked(k) === false, 'must not lock too early');
  rl.registerFailure(k);
  assert(rl.isLocked(k) === true, 'must lock after the limit');
  assert(rl.lockRemaining(k) > 0, 'must report remaining time');
});

ok('\u0627\u0644\u062f\u062e\u0648\u0644 \u0627\u0644\u0646\u0627\u062c\u062d \u0628\u064a\u0641\u062a\u062d \u0627\u0644\u0642\u0641\u0644', () => {
  const k = 'lock:test2:' + Math.random();
  for (let i = 0; i < 9; i++) rl.registerFailure(k);
  assert(rl.isLocked(k) === true, 'locked first');
  rl.clearFailures(k);
  assert(rl.isLocked(k) === false, 'a correct password must clear the lock');
});

ok('\u0627\u0644\u062f\u062e\u0648\u0644 \u0648\u0627\u0644\u062a\u0633\u062c\u064a\u0644 \u0645\u0648\u0635\u0648\u0644\u064a\u0646 \u0628\u0627\u0644\u0642\u0641\u0644', () => {
  const a = rawOf('api/auth.js');
  assert(a.indexOf('isLocked') > -1, 'auth must consult the lockout');
  assert(a.indexOf('registerFailure') > -1, 'auth must record failures');
  assert(a.indexOf('clearFailures') > -1, 'auth must clear on success');
});

ok('\u0627\u0644\u0643\u0648\u0643\u064a \u0645\u0642\u0641\u0648\u0644 \u0642\u062f\u0627\u0645 \u0627\u0644\u062c\u0627\u0641\u0627 \u0633\u0643\u0631\u0628\u062a', () => {
  const a = rawOf('api/auth.js');
  assert(/httpOnly:\s*true/.test(a), 'session cookie must be httpOnly');
  assert(/sameSite:\s*'Lax'/.test(a), 'session cookie must set sameSite');
  // [FIX H5] الكوكي بقى Secure بشكل افتراضي مش في الإنتاج بس، والخروج منه opt-out صريح.
  assert(/secure:\s*SECURE_COOKIES/.test(a), 'session cookie must be secure by default');
  assert(/EF_INSECURE_COOKIES\s*!==\s*'1'/.test(a), 'secure cookies must be opt-out, not opt-in');
});

ok('\u0627\u0644\u0628\u0627\u0633\u0648\u0631\u062f \u0645\u062a\u062e\u0632\u0646 \u0628\u0637\u0631\u064a\u0642\u0629 \u0642\u0648\u064a\u0629', () => {
  const a = rawOf('lib/auth.js');
  assert(a.indexOf('scryptSync') > -1, 'must use scrypt');
  assert(a.indexOf('timingSafeEqual') > -1, 'must compare in constant time');
});

ok('\u0627\u0644\u0631\u062f\u0648\u062f \u0644\u064a\u0647\u0627 \u062a\u0631\u0648\u0633 \u062d\u0645\u0627\u064a\u0629', () => {
  const s = rawOf('server.js');
  ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Strict-Transport-Security']
    .forEach((h) => assert(s.indexOf(h) > -1, 'missing header ' + h));
});

ok('\u0645\u0627\u0641\u064a\u0634 \u062d\u062f \u064a\u062f\u062e\u0644 \u0627\u0644\u0623\u062f\u0645\u0646 \u0645\u0646 \u063a\u064a\u0631 \u062a\u062d\u0642\u0642', () => {
  const a = rawOf('api/admin.js');
  assert(a.indexOf('requireAdmin') > -1, 'admin guard missing');
  const i = a.indexOf('function videoReports');
  assert(i > -1, 'videoReports missing');
  assert(a.slice(i, i + 400).indexOf('requireAdmin') > -1, 'the reports endpoint must be guarded');
});

ok('\u062d\u062c\u0645 \u0627\u0644\u0637\u0644\u0628 \u0645\u062d\u062f\u0648\u062f', () => {
  assert(rawOf('lib/util.js').indexOf('payload_too_large') > -1, 'body size cap missing');
});

// ── 5) الترابط بين المدرب وأخصائي التغذية ───────────
section('\u0627\u0644\u0645\u062f\u0631\u0628 \u0648\u0623\u062e\u0635\u0627\u0626\u064a \u0627\u0644\u062a\u063a\u0630\u064a\u0629 \u0645\u062a\u0631\u0627\u0628\u0637\u064a\u0646');
const px = require('../lib/plateau-diagnostics');
const pz = require('../lib/diet-periodization');

const mkWeights = (n, start, end) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      date: new Date(Date.now() - (n - i) * 86400000).toISOString().slice(0, 10),
      weight: start + (end - start) * (i / (n - 1))
    });
  }
  return out;
};

const NO_CUT = ['underreport', 'adherence', 'water', 'neat', 'sleep', 'dietfatigue'];
function decide(o) {
  const common = {
    goal: 'cut', targetCals: 2000, maintenanceCals: 2500, macros: {},
    weights: o.weights, weight: o.weights[o.weights.length - 1].weight,
    planWeight: o.weights[0].weight, adherencePct: o.adherence,
    loggedDays: 21, calorieFloor: 1200
  };
  const adjust = pz.autoAdjust(Object.assign({}, common, { week: 8 }));
  const dx = px.diagnose(Object.assign({}, common, {
    windowDays: 21, dietWeeks: 8, sleepHours: o.sleep, stress: o.stress,
    stepsNow: o.stepsNow, stepsBaseline: o.stepsBase
  }));
  let finalAdjust = adjust;
  if (dx && dx.stalled && dx.primary && adjust && adjust.action === 'decrease' &&
      NO_CUT.indexOf(dx.primary.key) > -1) {
    finalAdjust = Object.assign({}, adjust, { action: 'hold', blockedBy: dx.primary.key });
  }
  return { dx: dx, raw: adjust, final: finalAdjust };
}

ok('\u0627\u0644\u0645\u062a\u062f\u0631\u0628 \u0627\u0644\u0644\u064a \u0645\u0627\u0634\u064a \u0643\u0648\u064a\u0633 \u0645\u0627\u062d\u062f\u0634 \u0628\u064a\u0644\u0645\u0633 \u062e\u0637\u062a\u0647', () => {
  const r = decide({ weights: mkWeights(21, 90, 88.4), adherence: 95, sleep: 7, stress: 2, stepsNow: 8000, stepsBase: 8000 });
  assert(r.dx.stalled === false, 'a healthy rate must not read as a plateau');
  assert(r.final.action !== 'decrease', 'nothing should be cut while progress is real');
});

ok('\u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 \u0627\u0644\u0636\u0639\u064a\u0641 \u0628\u064a\u062a\u0642\u0631\u0627 \u0627\u0644\u062a\u0632\u0627\u0645 \u0645\u0634 \u062a\u062e\u0645\u064a\u0646', () => {
  const r = decide({ weights: mkWeights(21, 90, 89.95), adherence: 52, sleep: 7, stress: 2, stepsNow: 8000, stepsBase: 8000 });
  assert(r.dx.primary && r.dx.primary.key === 'adherence', 'primary was ' + (r.dx.primary && r.dx.primary.key));
  assert(r.final.action !== 'decrease', 'never cut a trainee who is not following the plan');
});

ok('\u0642\u0644\u0629 \u0627\u0644\u0646\u0648\u0645 \u0628\u062a\u0643\u0633\u0628 \u0639\u0644\u0649 \u0627\u0644\u062a\u062e\u0645\u064a\u0646', () => {
  const r = decide({ weights: mkWeights(21, 90, 89.95), adherence: 95, sleep: 5, stress: 5, stepsNow: 8000, stepsBase: 8000 });
  assert(r.dx.primary && r.dx.primary.key === 'sleep', 'primary was ' + (r.dx.primary && r.dx.primary.key));
  assert(r.final.action === 'hold' && r.final.blockedBy === 'sleep', 'sleep must block the cut');
});

ok('\u0646\u0632\u0648\u0644 \u0627\u0644\u062d\u0631\u0643\u0629 \u0628\u064a\u0643\u0633\u0628 \u0639\u0644\u0649 \u0627\u0644\u062a\u062e\u0645\u064a\u0646', () => {
  const r = decide({ weights: mkWeights(21, 90, 89.95), adherence: 95, sleep: 7, stress: 2, stepsNow: 3000, stepsBase: 9000 });
  assert(r.dx.primary && r.dx.primary.key === 'neat', 'primary was ' + (r.dx.primary && r.dx.primary.key));
  assert(r.final.action === 'hold' && r.final.blockedBy === 'neat', 'lost steps must block the cut');
});

ok('\u0645\u0627\u0641\u064a\u0634 \u0633\u0628\u0628 \u0628\u064a\u062a\u0642\u0627\u0644 \u0645\u0646 \u063a\u064a\u0631 \u0646\u0635\u064a\u062d\u0629 \u062a\u0646\u0641\u0630', () => {
  const r = decide({ weights: mkWeights(21, 90, 89.95), adherence: 95, sleep: 5, stress: 5, stepsNow: 3000, stepsBase: 9000 });
  assert(r.dx.causes.length > 0, 'a stall must produce causes');
  r.dx.causes.forEach((c) => {
    assert(c.actionAr && c.actionAr.length > 12, 'every cause must carry real advice: ' + c.key);
    assert(c.findingAr && c.findingAr.length > 4, 'every cause must say what it saw: ' + c.key);
  });
});

ok('\u0627\u0644\u0642\u0641\u0644 \u0645\u0648\u062c\u0648\u062f \u0641\u0639\u0644\u0627 \u062c\u0648\u0651\u0627 \u0627\u0644\u0645\u0633\u0627\u0631 \u0645\u0634 \u0641\u064a \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0628\u0633', () => {
  const s = rawOf('api/mobile.js');
  assert(s.indexOf('noCutCauses') > -1, 'the safety lock must live in the endpoint');
  assert(s.indexOf('blockedBy') > -1, 'the endpoint must report what blocked the cut');
  assert(s.indexOf('plateau-diagnostics') > -1 && s.indexOf('diet-periodization') > -1,
    'both brains must be wired into the same response');
});

ok('\u0627\u0644\u062a\u0634\u062e\u064a\u0635 \u0645\u0627\u0628\u064a\u062e\u0631\u0628\u0634 \u0639\u0644\u0649 \u0645\u062f\u062e\u0644\u0627\u062a \u0646\u0627\u0642\u0635\u0629', () => {
  const r = px.diagnose({});
  assert(r && r.stalled === false, 'an empty call must be safe');
  const r2 = px.diagnose({ goal: 'cut', weights: [{ date: 'x', weight: null }] });
  assert(r2 && typeof r2.stalled === 'boolean', 'garbage input must be safe');
});

// ── 6) التحكم الكامل في الإشعارات ─────────────────
section('\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645 \u0641\u064a \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a');
const notifSrc = rawOf('mobile/lib/notification_service.dart');
const remindSrc = rawOf('mobile/lib/screens/reminder_settings_screen.dart');

ok('\u0641\u064a\u0647 \u0645\u0641\u062a\u0627\u062d \u0631\u0626\u064a\u0633\u064a \u0644\u0643\u0644 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a', () => {
  assert(notifSrc.indexOf('cancelAll') > -1, 'the service must expose a master kill');
  assert(remindSrc.indexOf('_setMaster') > -1, 'the screen must wire the master switch');
  assert(remindSrc.indexOf('reminder_master') > -1, 'the master state must persist');
});

ok('\u0642\u0641\u0644 \u0627\u0644\u0645\u0641\u062a\u0627\u062d \u0645\u0627\u0628\u064a\u0645\u0633\u062d\u0634 \u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645', () => {
  const i = remindSrc.indexOf('Future<void> _setMaster');
  assert(i > -1, '_setMaster must exist');
  const body = remindSrc.slice(i, i + 800);
  assert(/cancelAll/.test(body), 'closing must cancel everything');
  assert(/_set\('workout'/.test(body) && /_set\('water'/.test(body),
    'reopening must rebuild from the saved settings');
});

ok('\u0641\u064a\u0647 \u0647\u062f\u0648\u0621 \u0644\u064a\u0644\u064a \u0628\u0645\u0648\u0627\u0639\u064a\u062f', () => {
  assert(remindSrc.indexOf('reminder_quiet_from') > -1, 'quiet start must persist');
  assert(remindSrc.indexOf('reminder_quiet_to') > -1, 'quiet end must persist');
  assert(notifSrc.indexOf('inQuietHours') > -1, 'the service must know the quiet window');
});

ok('\u0627\u0644\u0647\u062f\u0648\u0621 \u0627\u0644\u0644\u064a\u0644\u064a \u0628\u064a\u0639\u062f\u064a \u0646\u0635 \u0627\u0644\u0644\u064a\u0644 \u0635\u062d', () => {
  const m = notifSrc.match(/static bool inQuietHours[\s\S]{0,400}?\n  \}/);
  assert(m, 'inQuietHours body not found');
  const fn = new Function('hour', 'startHour', 'endHour',
    m[0].replace(/^[\s\S]*?\{/, '').replace(/\}\s*$/, ''));
  assert(fn(23, 23, 7) === true, '23 is inside 23-7');
  assert(fn(3, 23, 7) === true, '3 is inside 23-7');
  assert(fn(12, 23, 7) === false, 'noon is outside 23-7');
  assert(fn(9, 8, 10) === true, '9 is inside 8-10');
  assert(fn(5, 5, 5) === false, 'an empty window blocks nothing');
});

ok('\u0627\u0644\u0644\u0648\u062d\u0629 \u0628\u062a\u0642\u0648\u0644 \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u062d\u0642\u064a\u0642\u064a \u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645', () => {
  assert(notifSrc.indexOf('pendingNotificationRequests') > -1, 'must read the real schedule');
  assert(remindSrc.indexOf('_refreshCount') > -1, 'the screen must show it');
});

ok('\u0627\u0644\u0644\u0648\u062d\u0629 \u0641\u0648\u0642 \u0627\u0644\u0634\u0627\u0634\u0629', () => {
  const a = remindSrc.indexOf('_masterCard(),');
  const b = remindSrc.indexOf('_syncCard(),');
  assert(a > -1 && b > -1 && a < b, 'the master panel must sit at the top');
});

// ── 7) اسم التمارين المكملة ─────────────────────────────
section('\u0627\u0633\u0645 \u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646 \u0627\u0644\u0645\u0643\u0645\u0644\u0629');

ok('\u0627\u0644\u062a\u0628\u0648\u064a\u0628 \u0628\u0642\u0649 \u062a\u0645\u0627\u0631\u064a\u0646 \u0645\u0643\u0645\u0644\u0629', () => {
  const w = read('mobile/lib/screens/workout_screen.dart');
  assert(w.indexOf("Tab(text: '\u062a\u0645\u0627\u0631\u064a\u0646 \u0645\u0643\u0645\u0644\u0629')") > -1, 'the tab must use the new name');
  assert(w.indexOf("Tab(text: '\u0648\u062d\u062f\u0627\u062a\u0643')") === -1, 'the old tab name must be gone');
});

ok('\u0634\u0627\u0634\u0629 \u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646 \u0627\u0644\u0645\u0643\u0645\u0644\u0629 \u0628\u062a\u0633\u062a\u062e\u062f\u0645 \u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u062c\u062f\u064a\u062f', () => {
  const u = read('mobile/lib/screens/helper_units_screen.dart');
  assert(u.indexOf('\u0646\u062d\u0645\u0644 \u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646 \u0627\u0644\u0645\u0643\u0645\u0644\u0629') > -1, 'error copy must be renamed');
  assert(u.indexOf('\u0645\u0627\u0641\u064a\u0634 \u062a\u0645\u0631\u064a\u0646 \u0645\u0643\u0645\u0644 \u0645\u0641\u0639\u0644') > -1, 'empty state must be renamed');
});

// ── 8) سرعة التطبيق ───────────────────────────
section('\u0633\u0631\u0639\u0629 \u0627\u0644\u062a\u0637\u0628\u064a\u0642');

ok('\u0627\u0644\u0627\u0633\u062a\u0637\u0644\u0627\u0639 \u0628\u064a\u0628\u0637\u0621 \u0644\u0645\u0627 \u0645\u0627\u0641\u064a\u0634 \u062d\u0627\u062c\u0629 \u0645\u0639\u0644\u0642\u0629', () => {
  const s = rawOf('mobile/lib/screens/shell_screen.dart');
  assert(s.indexOf('_idleMax') > -1, 'an idle ceiling must exist');
  assert(/Timer\.periodic\(const Duration\(seconds: 20\)/.test(s) === false,
    'the hardcoded 20s loop must be gone');
  assert(s.indexOf('_arm(') > -1, 'the timer must be re-armable');
});

ok('\u0627\u0644\u062a\u0627\u064a\u0645\u0631 \u0628\u064a\u062a\u0642\u0641\u0644 \u0639\u0646\u062f \u0627\u0644\u062e\u0631\u0648\u062c', () => {
  const s = rawOf('mobile/lib/screens/shell_screen.dart');
  assert(/dispose\(\)[\s\S]{0,200}_pendingTimer\?\.cancel\(\)/.test(s), 'the timer must be cancelled');
});

// ── 9) قراية التاريخ على صفحات ─────────
section('\u0642\u0631\u0627\u064a\u0629 \u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0639\u0644\u0649 \u0635\u0641\u062d\u0627\u062a');

const pgDbSrc = rawOf('lib/db.js');
const pgMobSrc = rawOf('api/mobile.js');
const pgSrvSrc = rawOf('server.js');
const pgAccSrc = rawOf('api/account.js');

ok('\u0641\u064a\u0647 \u0627\u0633\u062a\u0639\u0644\u0627\u0645\u0627\u062a \u0645\u0642\u0633\u0648\u0645\u0629 \u0639\u0644\u0649 \u0635\u0641\u062d\u0627\u062a', () => {
  ['pageWeights', 'pageMeasurements', 'pageNutrition', 'pageSessions'].forEach((k) => {
    assert(pgDbSrc.indexOf(k) > -1, 'missing paged statement: ' + k);
  });
  ['countWeights', 'countMeasurements', 'countNutrition', 'countSessions'].forEach((k) => {
    assert(pgDbSrc.indexOf(k) > -1, 'missing count statement: ' + k);
  });
  assert(/LIMIT \? OFFSET \?/.test(pgDbSrc), 'no OFFSET based paging in the db layer');
});

ok('\u0627\u0644\u0635\u0641\u062d\u0629 \u0645\u062d\u062f\u0648\u062f\u0629 \u0628\u0645\u0627\u0626\u0629 \u0635\u0641 \u0645\u0647\u0645\u0627 \u0637\u0644\u0628 \u0627\u0644\u0639\u0645\u064a\u0644', () => {
  const db = require('../lib/db');
  const id = db.createUser('scale' + Date.now() + '@t.com', null, 'S', 'h', 's');
  for (let i = 0; i < 140; i++) {
    const d = '2025-' + String(1 + Math.floor(i / 28)).padStart(2, '0') + '-' + String(1 + (i % 28)).padStart(2, '0');
    db.saveWeight(id, d, 90 - i * 0.01, null);
  }
  const p1 = db.weightsPage(id, 30, 0);
  assert(p1.rows.length === 30, 'page must hold exactly the asked size');
  assert(p1.total === 140, 'total must count every row, got ' + p1.total);
  assert(p1.hasMore === true, 'hasMore must be true mid list');
  const p2 = db.weightsPage(id, 30, 30);
  const overlap = p1.rows.some((r) => r.day === p2.rows[0].day);
  assert(!overlap, 'pages must not repeat rows');
  assert(db.weightsPage(id, 999999, 0).rows.length === 100, 'the 100 row ceiling must hold');
  assert(db.weightsPage(id, 30, 120).hasMore === false, 'hasMore must be false on the last page');
  assert(db.weightsPage(id, -5, -5).rows.length > 0, 'negative input must not break the page');
});

ok('\u0645\u0633\u0627\u0631 \u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0645\u0648\u0635\u0648\u0644 \u0648\u0645\u062d\u0645\u064a', () => {
  assert(/function history\(req,res\)/.test(pgMobSrc), 'no history handler');
  assert(/module\.exports=\{bootstrap,history,/.test(pgMobSrc), 'history is not exported');
  assert(pgMobSrc.indexOf("rateLimit('history:'") > -1, 'the history route has no rate limit');
  assert(pgMobSrc.indexOf("const u=user(req,res);if(!u)return;") > -1, 'history must require a signed in user');
  assert(pgSrvSrc.indexOf("'/api/mobile/history'") > -1, 'the route is not wired into the server');
  assert(pgMobSrc.indexOf("unknown_kind") > -1, 'unknown kinds must be rejected');
});

ok('\u0645\u0641\u064a\u0634 \u0627\u0633\u062a\u0639\u0644\u0627\u0645 \u0644\u0643\u0644 \u062c\u0644\u0633\u0629', () => {
  assert(pgDbSrc.indexOf('setsForUser') > -1, 'the single query is missing');
  assert(pgDbSrc.indexOf('workoutSetsByUser') > -1, 'the grouping helper is missing');
  assert(pgAccSrc.indexOf('workoutSetsByUser') > -1, 'the export path still queries per session');
  assert(!/recentWorkoutSessions\(user\.id,1000\)\.map\(function\(session\)\{return Object\.assign\(\{\},session,\{sets:db\.workoutSets/.test(pgAccSrc), 'the old N+1 export line is still there');
  // شاشة التاريخ بقت أحسن من كدا: مش بس استعلام واحد بدل استعلام لكل جلسة،
  // ده كمان استعلام محدود بالجلسات المعروضة بس مش بتاريخ المتدرب كله.
  assert(pgMobSrc.indexOf('db.workoutSetsForSessions(') > -1, 'workout history still queries per session');
  assert(pgDbSrc.indexOf('workoutSetsForSessions(sessionIds)') > -1, 'the bounded sets query is missing');
  assert(!/const setsBySession=db\.workoutSetsByUser\(u\.id\);/.test(pgMobSrc), 'workout history still reads every set the user ever logged');
});

ok('\u0627\u0644\u0627\u0633\u062a\u0639\u0644\u0627\u0645 \u0627\u0644\u0648\u0627\u062d\u062f \u0628\u064a\u0631\u062c\u0639 \u0646\u0641\u0633 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a', () => {
  const db = require('../lib/db');
  const id = db.createUser('n1' + Date.now() + '@t.com', null, 'N', 'h', 's');
  const made = [];
  for (let i = 0; i < 12; i++) {
    const sid = db.startWorkoutSession(id, null, 'd' + i, 'Day ' + i);
    const real = sid && sid.id ? sid.id : sid;
    made.push(real);
    for (let k = 1; k <= 5; k++) {
      db.saveWorkoutSet({ sessionId: real, exerciseKey: 'ex' + k, exerciseName: 'E' + k, setNumber: k, weight: 60, reps: 10, rir: 2, completed: 1 });
    }
    db.finishWorkoutSession(real, id, null, 1800, null);
  }
  const grouped = db.workoutSetsByUser(id);
  let viaLoop = 0, viaOne = 0;
  made.forEach((sid) => { viaLoop += db.workoutSets(sid).length; viaOne += (grouped.get(sid) || []).length; });
  assert(viaLoop === 60, 'the fixture must hold 60 sets, got ' + viaLoop);
  assert(viaOne === viaLoop, 'the single query must return the same rows');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
