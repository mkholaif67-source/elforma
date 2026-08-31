// مخرج الوحدات المساعدة — /api/mobile/modules
//
// WHY THIS FILE EXISTS
// moduleCatalog() lived in lib/workout-engine-host.js for the entire life of
// the feature and was NEVER exposed over HTTP. 57 engine exercises with real
// video ids were unreachable from the app, so the units screen could only ever
// show on/off switches with nothing behind them.
//
// Three failure modes are pinned here because all three were real or nearly so:
//   1. the catalogue not being reachable at all,
//   2. cardio and weakpoint NOT being arrays (cardio is {s,a,b} tiers,
//      weakpoint is {}), so a naive Array.isArray flatten silently yields zero
//      cardio exercises,
//   3. a missing or invented video id. The owner's rule is absolute: video
//      links are correct and are never substituted, invented or "repaired".
const assert = require('assert');
const host = require('../lib/workout-engine-host');

let passed = 0;
function ok(name, fn) {
  try { fn(); console.log('  \u2713 ' + name); passed++; }
  catch (e) { console.log('  \u2717 ' + name + '\n      ' + e.message); process.exitCode = 1; }
}

// The eight keys the picker offers, and the catalogue key each one must reach.
const UNIT_SOURCE = {
  warmup: 'mobility', stretch: 'stretching', core: 'core', cardio: 'cardio',
  yoga: 'yoga', breath: 'breathing', recovery: 'recovery', kegel: 'kegel'
};

// Same flatten the endpoint uses: an array, OR an object of arrays (cardio).
function flatten(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node.slice();
  if (typeof node === 'object') {
    let out = [];
    Object.keys(node).forEach(function (k) {
      if (Array.isArray(node[k])) out = out.concat(node[k]);
    });
    return out;
  }
  return [];
}

const catalogue = host.moduleCatalog();

console.log('\n\u0645\u062e\u0631\u062c \u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0627\u0644\u0645\u0633\u0627\u0639\u062f\u0629');

ok('the catalogue is reachable from the host, not trapped inside the vm', function () {
  assert.ok(catalogue && typeof catalogue === 'object', 'moduleCatalog() returned nothing');
  assert.ok(Object.keys(catalogue).length > 0, 'moduleCatalog() returned an empty object');
});

ok('every unit the picker offers resolves to a real catalogue key', function () {
  Object.keys(UNIT_SOURCE).forEach(function (unit) {
    const src = UNIT_SOURCE[unit];
    assert.ok(
      Object.prototype.hasOwnProperty.call(catalogue, src),
      'unit "' + unit + '" points at missing catalogue key "' + src + '"'
    );
  });
});

ok('recovery reaches the recovery exercises, NOT the dead "sleep" alias', function () {
  // MODULE_ALIAS maps recovery -> sleep for the planner's note layer, but the
  // exercise database has no "sleep" key at all. The endpoint must bypass the
  // alias or the recovery unit shows up empty.
  assert.ok(!catalogue.sleep, 'catalogue unexpectedly grew a "sleep" key');
  assert.ok(flatten(catalogue.recovery).length > 0, 'recovery unit is empty');
});

ok('cardio is flattened out of its {s,a,b} tiers instead of read as an array', function () {
  assert.ok(!Array.isArray(catalogue.cardio), 'cardio became a flat array - update the endpoint');
  const items = flatten(catalogue.cardio);
  assert.ok(items.length > 0, 'cardio flattened to zero exercises');
});

ok('weakpoint being empty degrades quietly instead of throwing', function () {
  assert.doesNotThrow(function () { flatten(catalogue.weakpoint); });
  assert.strictEqual(flatten(catalogue.weakpoint).length, 0);
});

ok('no unit the picker offers is empty', function () {
  const empty = Object.keys(UNIT_SOURCE).filter(function (unit) {
    return flatten(catalogue[UNIT_SOURCE[unit]]).length === 0;
  });
  assert.strictEqual(empty.length, 0, 'empty units: ' + empty.join(', '));
});

ok('every exercise carries a name and a video id - zero missing videos', function () {
  const missing = [];
  Object.keys(UNIT_SOURCE).forEach(function (unit) {
    flatten(catalogue[UNIT_SOURCE[unit]]).forEach(function (ex) {
      const name = ex && (ex.n || ex.name);
      if (!name) missing.push(unit + ': unnamed exercise');
      else if (!ex.vid) missing.push(unit + ': ' + name);
    });
  });
  assert.strictEqual(missing.length, 0, 'exercises with no video: ' + missing.join(' | '));
});

ok('every video id is a plausible YouTube id, never a placeholder', function () {
  const ID = /^[A-Za-z0-9_-]{8,12}$/;
  const bad = [];
  Object.keys(UNIT_SOURCE).forEach(function (unit) {
    flatten(catalogue[UNIT_SOURCE[unit]]).forEach(function (ex) {
      if (ex && ex.vid && !ID.test(String(ex.vid))) {
        bad.push(unit + ': ' + (ex.n || ex.name) + ' -> ' + ex.vid);
      }
    });
  });
  assert.strictEqual(bad.length, 0, 'malformed video ids: ' + bad.join(' | '));
});

ok('no video id is reused across two different exercises', function () {
  // A duplicate id is the signature of a copy-paste "repair", which is exactly
  // what the owner forbade.
  const seen = new Map();
  const dupes = [];
  Object.keys(UNIT_SOURCE).forEach(function (unit) {
    flatten(catalogue[UNIT_SOURCE[unit]]).forEach(function (ex) {
      if (!ex || !ex.vid) return;
      const name = String(ex.n || ex.name);
      if (seen.has(ex.vid) && seen.get(ex.vid) !== name) {
        dupes.push(ex.vid + ' shared by "' + seen.get(ex.vid) + '" and "' + name + '"');
      } else {
        seen.set(ex.vid, name);
      }
    });
  });
  assert.strictEqual(dupes.length, 0, dupes.join(' | '));
});

ok('the catalogue still holds the full 57 exercises the app promises', function () {
  let total = 0;
  Object.keys(UNIT_SOURCE).forEach(function (unit) {
    total += flatten(catalogue[UNIT_SOURCE[unit]]).length;
  });
  assert.strictEqual(total, 57, 'expected 57 exercises across the eight units, got ' + total);
});

ok('the endpoint is actually routed in server.js', function () {
  const fs = require('fs');
  const server = fs.readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(
    server.indexOf('/api/mobile/modules') > -1,
    'server.js has no route for /api/mobile/modules - the catalogue is unreachable again'
  );
});

ok('the modules handler is exported from api/mobile.js', function () {
  const mobileApi = require('../api/mobile.js');
  assert.strictEqual(typeof mobileApi.modules, 'function', 'api/mobile.js does not export modules()');
});

console.log('\n' + passed + ' passed, ' + (process.exitCode ? 'see failures above' : '0 failed') + '\n');
