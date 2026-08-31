// اختبار عقل تشخيص ثبات الوزن.
// الهدف: نتأكد إن المدرب مايقولش "ثبات وزن" لواحد بيخس فعليًا،
// ومايقللش سعرات والسبب الحقيقي حاجة تانية خالص.
'use strict';

const dx = require('../lib/plateau-diagnostics');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log('  \u2713 ' + name);
  } else {
    failed++;
    console.log('  \u2717 ' + name + (extra ? ' — ' + extra : ''));
  }
}

/** قراءات وزن يومية بتنتهي النهارده. */
function series(n, start, step) {
  const out = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    out.push({
      date: new Date(now - (n - 1 - i) * 86400000).toISOString().slice(0, 10),
      kg: Math.round((start + step * i) * 100) / 100
    });
  }
  return out;
}

const BASE = {
  goal: 'cut',
  weight: 90,
  planWeight: 90,
  targetCals: 2000,
  maintenanceCals: 2600,
  adherencePct: 95,
  loggedDays: 21,
  windowDays: 21,
  dietWeeks: 4
};

function diag(over) {
  return dx.diagnose(Object.assign({}, BASE, over));
}

console.log('\nPlateau diagnostics');

// ── الحالات الأساسية ───────────────────────────────────────
const none = dx.diagnose({ goal: 'cut', weights: [] });
ok('no data yields collecting, never a verdict', none.state === 'collecting' && none.stalled === false, 'state=' + none.state);
ok('collecting reports low confidence', none.confidence === 'low');
ok('collecting names no cause', none.primary === null && none.causes.length === 0);

// الباج اللي كان بيخلي المعدل يتقرا نصّه: متدرّب بيخس 0.63 كجم/أسبوع.
const losing = diag({ weights: series(21, 90, -0.09) });
ok('a trainee losing 0.63 kg/wk is NOT called a plateau', losing.stalled === false && losing.state === 'on_track', 'rate=' + losing.signals.actualRateKg);
ok('the measured rate is accurate, not halved', Math.abs(losing.signals.actualRateKg + 0.63) < 0.06, 'rate=' + losing.signals.actualRateKg);
ok('an on-track trainee gets no causes', losing.causes.length === 0);

// ── التفريق بين الأسباب ──────────────────────────────────
const sparse = diag({ weights: series(21, 90, 0), loggedDays: 6 });
ok('sparse logging is blamed before anything else', sparse.primary && sparse.primary.key === 'underreport', 'primary=' + (sparse.primary && sparse.primary.key));
ok('sparse logging forces low confidence', sparse.confidence === 'low');

const slack = diag({ weights: series(21, 90, 0), adherencePct: 62 });
ok('weak adherence is named, not a calorie cut', slack.primary && slack.primary.key === 'adherence', 'primary=' + (slack.primary && slack.primary.key));
ok('adherence finding quotes the real number', slack.primary && slack.primary.findingAr.indexOf('62') > -1);

const gap = diag({ weights: series(21, 90, 0), adherencePct: 96, loggedDays: 21 });
ok('maths-vs-scale gap surfaces under-reporting', gap.causes.some(function (c) { return c.key === 'underreport'; }));

const neat = diag({ weights: series(21, 90, 0), stepsNow: 4000, stepsBaseline: 9000 });
ok('a NEAT collapse is detected', neat.causes.some(function (c) { return c.key === 'neat'; }));
ok('the NEAT finding quotes the drop', neat.causes.some(function (c) { return c.key === 'neat' && c.findingAr.indexOf('56') > -1; }));

const tired = diag({ weights: series(21, 90, 0), dietWeeks: 14 });
ok('a 14-week diet is told to take a break, not to cut', tired.causes.some(function (c) { return c.key === 'dietfatigue' && c.actionAr.indexOf('\u0627\u0633\u062a\u0631\u0627\u062d\u0629 \u062f\u0627\u064a\u062a') > -1; }));

const drifted = diag({ weights: series(21, 78, 0), weight: 78, planWeight: 90 });
ok('a 12 kg drift asks for a recalculation', drifted.causes.some(function (c) { return c.key === 'drift'; }));

const sleepy = diag({ weights: series(21, 90, 0), sleepHours: 5.5 });
ok('short sleep is picked up as a cause', sleepy.causes.some(function (c) { return c.key === 'sleep'; }));

const stale = diag({ weights: series(21, 90, 0), tonnageDeltaPct: 0 });
ok('flat gym tonnage is picked up', stale.causes.some(function (c) { return c.key === 'training'; }));

const easy = diag({ weights: series(21, 90, 0), avgRir: 4 });
ok('training far from failure is picked up', easy.causes.some(function (c) { return c.key === 'training'; }));

// ── الترتيب والسلامة ────────────────────────────────────
const messy = diag({
  weights: series(21, 90, 0),
  loggedDays: 8,
  adherencePct: 70,
  stepsNow: 4000,
  stepsBaseline: 9000,
  sleepHours: 5,
  dietWeeks: 14,
  tonnageDeltaPct: 0
});
ok('with many causes, the cheapest fix ranks first', messy.primary.key === 'underreport', 'primary=' + messy.primary.key);
ok('causes come back sorted strongest first', messy.causes.every(function (c, i) { return i === 0 || messy.causes[i - 1].score >= c.score; }));
const keys = messy.causes.map(function (c) { return c.key; });
ok('no cause is listed twice', keys.length === new Set(keys).size, keys.join(','));
ok('every cause carries finding, action, label and domain', messy.causes.every(function (c) { return c.findingAr && c.actionAr && c.labelAr && c.domain; }));

const bulkStuck = diag({ goal: 'muscle', weights: series(21, 75, 0), maintenanceCals: 2600, targetCals: 2900 });
ok('a bulk that stopped gaining is flagged', bulkStuck.stalled === true, 'state=' + bulkStuck.state);

const bulkOk = diag({ goal: 'muscle', weights: series(21, 75, 0.04), maintenanceCals: 2600, targetCals: 2900 });
ok('a bulk that is gaining is left alone', bulkOk.stalled === false, 'rate=' + bulkOk.signals.actualRateKg);

ok('an empty call does not throw', (function () { try { dx.diagnose(); return true; } catch (e) { return false; } })());
ok('garbage weights do not throw', (function () {
  try {
    dx.diagnose({ goal: 'cut', weights: [null, { kg: 'abc' }, { date: 'nope', kg: 80 }] });
    return true;
  } catch (e) { return false; }
})());

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
