// تستات حماية لقواعد صاحب المشروع
// كل قاعدة هنا اتكسرت مرة قبل كده فلازم يبقى عليها تست دايم
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const check = (label, ok, extra) => {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label + (ok || !extra ? '' : '  -> ' + extra));
  ok ? pass++ : fail++;
};
const ok = (label, fn) => {
  try { fn(); check(label, true); }
  catch (e) { check(label, false, e.message); }
};
const section = (t) => console.log('\n' + t);

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const host = require(path.join(root, 'lib', 'nutrition-engine-host.js'));
const BASE = { age: 29, height: 180, weight: 90, gender: 'male', trainingDays: 4 };
const nameOf = (f) => (f.food && f.food.nameAr) || f.nameAr || '';
const BREAD = /\u0639\u064a\u0634|\u062e\u0628\u0632|\u062a\u0648\u0633\u062a|\u0631\u0627\u064a\u0633/;

const plans = [];
['cut', 'gain', 'maintain'].forEach((goal) => {
  [3, 4, 5, 6].forEach((meals) => {
    [true, false].forEach((isTrainingDay) => {
      plans.push({
        label: goal + '/' + meals + '/train=' + isTrainingDay,
        isTrainingDay,
        result: host.computeMealPlan(Object.assign({}, BASE, { goal, meals, isTrainingDay }))
      });
    });
  });
});

section('\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0639\u064a\u0634 \u0627\u0644\u0648\u0627\u062d\u062f');
ok('\u0645\u0641\u064a\u0634 \u0648\u062c\u0628\u0629 \u0641\u064a\u0647\u0627 \u0646\u0648\u0639\u064a\u0646 \u0639\u064a\u0634', () => {
  const bad = [];
  plans.forEach((p) => {
    (p.result.plan.meals || []).forEach((m) => {
      const breads = (m.foods || []).filter((f) => BREAD.test(nameOf(f)));
      if (breads.length > 1) bad.push(p.label + ' ' + m.slotKey + ': ' + breads.map(nameOf).join(' + '));
    });
  });
  assert.strictEqual(bad.length, 0, bad.join(' | '));
});

section('\u0648\u062c\u0628\u0629 \u0642\u0628\u0644 \u0627\u0644\u062a\u0645\u0631\u064a\u0646');
ok('\u0628\u062a\u062a\u0636\u0627\u0641 \u062a\u0644\u0642\u0627\u0626\u064a \u0641\u064a \u0643\u0644 \u064a\u0648\u0645 \u062a\u0645\u0631\u064a\u0646', () => {
  const missing = plans
    .filter((p) => p.isTrainingDay)
    .filter((p) => !(p.result.plan.meals || []).some((m) => m.slotKey === 'pre'))
    .map((p) => p.label);
  assert.strictEqual(missing.length, 0, missing.join(', '));
});

ok('\u0645\u0627\u0628\u062a\u0638\u0647\u0631\u0634 \u0641\u064a \u064a\u0648\u0645 \u0627\u0644\u0631\u0627\u062d\u0629', () => {
  const leaked = plans
    .filter((p) => !p.isTrainingDay)
    .filter((p) => (p.result.plan.meals || []).some((m) => m._autoPreWorkout === true))
    .map((p) => p.label);
  assert.strictEqual(leaked.length, 0, leaked.join(', '));
});

ok('\u0627\u0644\u0643\u0645\u064a\u0627\u062a \u0645\u0644\u062a\u0632\u0645\u0629 \u0628\u0633\u0642\u0648\u0641 \u0635\u0627\u062d\u0628 \u0627\u0644\u0645\u0634\u0631\u0648\u0639', () => {
  const bad = [];
  plans.forEach((p) => {
    (p.result.plan.meals || []).forEach((m) => {
      if (!m._autoPreWorkout) return;
      (m.foods || []).forEach((f) => {
        const n = nameOf(f);
        const g = Math.round(Number(f.grams) || 0);
        // \u0634\u0648\u0643\u0648\u0644\u0627\u062a\u0629 \u0648\u0639\u0633\u0644 \u0648\u062a\u0648\u0633\u062a \u0644\u0627 \u064a\u0632\u064a\u062f\u0648\u0627 \u0639\u0646 20
        if (/\u0634\u0648\u0643\u0648\u0644|\u0639\u0633\u0644|\u062a\u0648\u0633\u062a/.test(n) && g > 20) bad.push(p.label + ' ' + n + ' ' + g);
        // \u0627\u0644\u062a\u0645\u0631 \u0644\u0627 \u064a\u0632\u064a\u062f \u0639\u0646 60
        if (/\u062a\u0645\u0631/.test(n) && g > 60) bad.push(p.label + ' ' + n + ' ' + g);
        // \u0627\u0644\u0645\u0648\u0632 \u0648\u0627\u0644\u062a\u0641\u0627\u062d \u0644\u0627 \u064a\u0632\u064a\u062f\u0648\u0627 \u0639\u0646 100
        if (/\u0645\u0648\u0632|\u062a\u0641\u0627\u062d/.test(n) && g > 100) bad.push(p.label + ' ' + n + ' ' + g);
      });
    });
  });
  assert.strictEqual(bad.length, 0, bad.join(' | '));
});

ok('\u0641\u064a\u0647\u0627 \u0642\u0647\u0648\u0629 \u0633\u0627\u062f\u0629 \u0648\u0645\u0635\u062f\u0631 \u0643\u0627\u0631\u0628', () => {
  const bad = [];
  plans.filter((p) => p.isTrainingDay).forEach((p) => {
    const pre = (p.result.plan.meals || []).find((m) => m.slotKey === 'pre');
    if (!pre) return;
    const names = (pre.foods || []).map(nameOf).join(' ');
    if (!/\u0642\u0647\u0648\u0629/.test(names)) bad.push(p.label + ' \u0645\u0641\u064a\u0634 \u0642\u0647\u0648\u0629');
    if (!/\u0645\u0648\u0632|\u062a\u0645\u0631|\u062a\u0641\u0627\u062d|\u0634\u0648\u0643\u0648\u0644|\u062a\u0648\u0633\u062a|\u0639\u0633\u0644/.test(names)) bad.push(p.label + ' \u0645\u0641\u064a\u0634 \u0643\u0627\u0631\u0628');
  });
  assert.strictEqual(bad.length, 0, bad.join(' | '));
});

ok('\u062e\u0641\u064a\u0641\u0629 \u0648\u0645\u0627\u0628\u062a\u0643\u0628\u0631\u0634 \u0639\u0634\u0627\u0646 \u062a\u0642\u0641\u0644 \u0641\u062c\u0648\u0629 \u0627\u0644\u064a\u0648\u0645', () => {
  const bad = [];
  plans.filter((p) => p.isTrainingDay).forEach((p) => {
    const pre = (p.result.plan.meals || []).find((m) => m.slotKey === 'pre');
    if (!pre) return;
    const cals = (pre.foods || []).reduce((s, f) => s + (Number(f.cals) || 0), 0);
    if (cals > 320) bad.push(p.label + ' ' + Math.round(cals));
  });
  assert.strictEqual(bad.length, 0, bad.join(' | '));
});

section('\u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0627\u0644\u0645\u0633\u0627\u0639\u062f\u0629');
const mobileApiSrc = read('api/mobile.js');
ok('\u0627\u0644\u0627\u062d\u0645\u0627\u0621 \u0648\u0627\u0644\u0625\u0637\u0627\u0644\u0629 \u0645\u0634 \u0648\u062d\u062f\u0627\u062a', () => {
  const block = mobileApiSrc.slice(mobileApiSrc.indexOf('UNIT_SOURCE'), mobileApiSrc.indexOf('UNIT_MINUTES') + 400);
  assert.ok(!/\bwarmup\s*:/.test(block), 'warmup is still a helper unit');
  assert.ok(!/\bstretch\s*:/.test(block), 'stretch is still a helper unit');
});

section('\u0634\u0627\u0634\u0629 \u0627\u0644\u0648\u062d\u062f\u0627\u062a');
const unitsSrc = read('mobile/lib/screens/helper_units_screen.dart');
ok('\u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0648\u0627\u0644\u062a\u0645\u0627\u0631\u064a\u0646 \u0641\u064a \u0634\u0628\u0643\u0629', () => {
  const grids = unitsSrc.match(/GridView\.count/g) || [];
  assert.ok(grids.length >= 2, 'expected two grids, found ' + grids.length);
});
ok('\u0645\u0641\u064a\u0634 \u0628\u0627\u0646\u064a \u0643\u0631\u0648\u062a \u0645\u064a\u062a', () => {
  assert.ok(!/Widget _card\(HelperUnit/.test(unitsSrc), 'dead _card builder is back');
});

section('\u0627\u0644\u0645\u0643\u0645\u0644\u0627\u062a');
const suppSrc = read('mobile/lib/screens/supplements_screen.dart');
ok('\u0645\u0641\u064a\u0634 \u0639\u0635\u064a\u0631 \u0628\u0646\u062c\u0631 \u0648\u0644\u0627 \u0623\u0645\u0644\u0627\u062d', () => {
  assert.ok(!/\u0628\u0646\u062c\u0631/.test(suppSrc), 'beetroot juice is still listed');
  assert.ok(!/\u0623\u0645\u0644\u0627\u062d \u0635\u0648\u062f\u064a\u0648\u0645|\u0627\u0645\u0644\u0627\u062d \u0635\u0648\u062f\u064a\u0648\u0645/.test(suppSrc), 'sodium salts are still listed');
});
ok('\u0627\u0644\u0628\u062f\u0627\u0626\u0644 \u0645\u0648\u062c\u0648\u062f\u0629 \u0628\u0623\u0633\u0645\u0627\u0621 \u0628\u0633\u064a\u0637\u0629', () => {
  ['\u0633\u062a\u0631\u0648\u0644\u064a\u0646', '\u062c\u0644\u0648\u062a\u0627\u0645\u064a\u0646', '\u0623\u062d\u0645\u0627\u0636 \u0623\u0645\u064a\u0646\u064a\u0629'].forEach((n) => {
    assert.ok(suppSrc.indexOf(n) > -1, 'missing ' + n);
  });
});

section('\u0627\u0644\u062a\u0646\u0628\u064a\u0647\u0627\u062a');
const notifSrc = read('mobile/lib/notification_service.dart');
const remindSrc = read('mobile/lib/screens/reminder_settings_screen.dart');
ok('\u062a\u0646\u0628\u064a\u0647 \u0623\u064a\u0627\u0645 \u0627\u0644\u062a\u0645\u0631\u064a\u0646 \u0628\u0645\u0648\u0627\u0639\u064a\u062f \u0645\u0646\u0641\u0635\u0644\u0629', () => {
  assert.ok(/scheduleWorkoutDays/.test(notifSrc), 'service missing scheduleWorkoutDays');
  assert.ok(/reminder_workout_days/.test(remindSrc), 'settings missing the per-day key');
});
ok('\u062a\u0646\u0628\u064a\u0647 \u0627\u0644\u0643\u0627\u0631\u062f\u064a\u0648 \u0645\u0648\u062c\u0648\u062f \u0648\u0645\u062a\u062d\u0643\u0645 \u0641\u064a\u0647', () => {
  assert.ok(/scheduleCardio/.test(notifSrc), 'service missing scheduleCardio');
  assert.ok(/reminder_cardio_days/.test(remindSrc), 'settings missing the cardio day key');
});

section('\u0633\u0624\u0627\u0644 \u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a');
const setupSrc = read('mobile/lib/screens/profile_setup_screen.dart');
ok('\u0627\u0644\u0627\u0633\u0645 \u0644\u0627\u0632\u0645 \u062d\u0631\u0648\u0641 \u0645\u0634 \u0623\u0631\u0642\u0627\u0645', () => {
  assert.ok(/A-Za-z\\u0621-\\u064A|A-Za-z\u0621-\u064A/.test(setupSrc), 'no letter class in the name validator');
  assert.ok(/0-9\\u0660-\\u0669|0-9\u0660-\u0669/.test(setupSrc), 'no digit rejection in the name validator');
});
ok('\u0635\u064a\u0627\u063a\u0629 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0632\u064a \u0645\u0627 \u0637\u0644\u0628\u0647\u0627 \u0635\u0627\u062d\u0628 \u0627\u0644\u0645\u0634\u0631\u0648\u0639', () => {
  ['\u062d\u0636\u0631\u062a\u0643 \u0627\u0633\u0645\u0643 \u0627\u064a\u0647', '\u0643\u0645 \u0639\u0645\u0631\u0643', '\u0637\u0648\u0644\u0643 \u0627\u0642\u062f \u0627\u064a\u0647 \u0628\u0627\u0644\u0633\u0646\u062a\u064a', '\u0648\u0632\u0646\u0643 \u0627\u0644\u062d\u0627\u0644\u064a \u0628\u0627\u0644\u0643\u064a\u0644\u0648', '\u0647\u062f\u0641\u0643 \u062a\u0648\u0635\u0644 \u0644\u0648\u0632\u0646 \u0643\u0627\u0645', '\u0637\u0645\u0648\u062d\u0643 \u062a\u062e\u0633 \u0643\u0627\u0645 \u0641\u064a \u0627\u0644\u0623\u0633\u0628\u0648\u0639', '\u0628\u062a\u0641\u0636\u0644 \u0627\u0644\u062f\u0627\u064a\u062a \u0627\u064a\u0647'].forEach((q) => {
    assert.ok(setupSrc.indexOf(q) > -1, 'missing prompt: ' + q);
  });
});

ok('\u0644\u0648\u062d\u0629 \u0627\u0644\u0627\u0633\u0645 \u062d\u0631\u0648\u0641 \u0645\u0634 \u0623\u0631\u0642\u0627\u0645', () => {
  assert.ok(/keyboard: TextInputType\.name/.test(setupSrc), 'the name question still opens a number pad');
  assert.ok(/TextInputType keyboard = const TextInputType\.numberWithOptions/.test(setupSrc), 'the keyboard is not per question');
});
ok('\u0625\u062c\u0627\u0628\u0627\u062a \u0645\u0639\u062f\u0644 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0623\u0631\u0642\u0627\u0645 \u0648\u0627\u0636\u062d\u0629', () => {
  ['1/4 \u0643\u064a\u0644\u0648', '1/2 \u0643\u064a\u0644\u0648', '3/4 \u0643\u064a\u0644\u0648', '1 \u0643\u064a\u0644\u0648'].forEach((v) => {
    assert.ok(setupSrc.indexOf(v) > -1, 'missing rate option: ' + v);
  });
});
ok('\u0627\u0644\u0646\u0648\u0645 \u0648\u0627\u0644\u062f\u0627\u064a\u062a \u0648\u0627\u0644\u0643\u0627\u0631\u062f\u064a\u0648 \u0628\u0627\u0644\u0635\u064a\u0627\u063a\u0629 \u0627\u0644\u062c\u062f\u064a\u062f\u0629', () => {
  // طلب صاحب المشروع: الإجابة كلمة واحدة والساعات تنزل في سطر الوصف تحت
  ['متقطع', 'جيد', 'مثالي',
   '\u0643\u0627\u0631\u0646\u064a\u0641\u0648\u0631 \u062f\u0627\u064a\u062a', '\u0643\u064a\u062a\u0648 \u062f\u0627\u064a\u062a', '\u062f\u0627\u064a\u062a \u0646\u0628\u0627\u062a\u064a'].forEach((v) => {
    assert.ok(setupSrc.indexOf(v) > -1, 'missing option: ' + v);
  });
  const si = setupSrc.indexOf('_sleepHints');
  assert.ok(si > -1, 'the sleep description line is gone');
  const hints = setupSrc.slice(si, si + 400);
  ['6', '7', '9'].forEach((v) => {
    assert.ok(hints.indexOf(v) > -1, 'sleep hours missing from the description: ' + v);
  });
  const sl = setupSrc.indexOf('_sleepLabels');
  const labels = setupSrc.slice(sl, sl + 220);
  assert.ok(labels.indexOf('ساعات') === -1, 'the sleep answers still carry the hours');
  const gi = setupSrc.indexOf('_goalLabels = {');
  const row = setupSrc.slice(gi, gi + 220);
  ['lose', 'gain', 'strength', 'fitness', 'maintain'].reduce((prev, key) => {
    const at = row.indexOf("'" + key + "'");
    assert.ok(at > prev, 'goal order is wrong at ' + key);
    return at;
  }, -1);
});

section('\u0632\u0631\u0627\u0631 \u0631\u062c\u0648\u0639 \u0627\u0644\u062c\u062f\u0648\u0644');
const workoutSrc = read('mobile/lib/screens/workout_screen.dart');
ok('\u0641\u064a\u0647 \u0632\u0631\u0627\u0631 \u0641\u0648\u0642 \u064a\u0631\u062c\u0639 \u0627\u0644\u062c\u062f\u0648\u0644 \u0644\u0623\u0635\u0644\u0647', () => {
  assert.ok(/_resetPlan/.test(workoutSrc), 'no reset handler');
  assert.ok(/restart_alt_rounded/.test(workoutSrc), 'no reset button in the app bar');
});

section('\u0645\u0641\u064a\u0634 \u062a\u0634\u0643\u064a\u0644');
ok('\u0646\u0635\u0648\u0635 \u0627\u0644\u0634\u0627\u0634\u0627\u062a \u0645\u0646 \u063a\u064a\u0631 \u062a\u0634\u0643\u064a\u0644', () => {
  const TASHKEEL = /[\u064B-\u0650\u0652]/;
  const dir = path.join(root, 'mobile', 'lib', 'screens');
  const bad = [];
  fs.readdirSync(dir).filter((f) => f.endsWith('.dart')).forEach((f) => {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const lits = src.match(/'[^'\n]*'/g) || [];
    lits.forEach((l) => { if (TASHKEEL.test(l)) bad.push(f + ' ' + l.slice(0, 40)); });
  });
  assert.strictEqual(bad.length, 0, bad.slice(0, 6).join(' | '));
});

section('\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u062a\u062d\u062a \u0627\u0644\u0636\u063a\u0637');
const dbSrc = read('lib/db.js');
ok('\u0628\u0631\u0627\u062c\u0645\u0627\u062a \u0627\u0644\u0623\u062f\u0627\u0621 \u0645\u0648\u062c\u0648\u062f\u0629', () => {
  ['journal_mode = WAL', 'synchronous = NORMAL', 'busy_timeout', 'cache_size', 'temp_store', 'mmap_size'].forEach((p) => {
    assert.ok(dbSrc.indexOf(p) > -1, 'missing pragma: ' + p);
  });
});
ok('\u0641\u0647\u0627\u0631\u0633 \u0627\u0644\u0645\u0633\u0627\u0631\u0627\u062a \u0627\u0644\u0633\u0627\u062e\u0646\u0629 \u0645\u0648\u062c\u0648\u062f\u0629', () => {
  ['idx_nutrition_days_user_day', 'idx_weight_logs_user_day', 'idx_subscriptions_user_status', 'idx_users_email', 'idx_workout_sessions_user_id'].forEach((i) => {
    assert.ok(dbSrc.indexOf(i) > -1, 'missing index: ' + i);
  });
});
ok('\u064a\u0648\u0645 \u0627\u0644\u062a\u0645\u0631\u064a\u0646 \u0628\u064a\u062a\u0642\u0631\u0627 \u0645\u0646 \u0627\u0644\u062c\u062f\u0648\u0644 \u0627\u0644\u0645\u0641\u0639\u0644', () => {
  assert.ok(/function trainingDayFromPlan/.test(mobileApiSrc), 'no plan-based training day reader');
  assert.ok(/trainingDayFromPlan\(u\.id\)/.test(mobileApiSrc), 'the reader is never called');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
