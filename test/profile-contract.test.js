'use strict';
// ============================================================
//  PROFILE CONTRACT
//
//  Three separate places clean incoming profiles by WHITELIST:
//    api/mobile.js  profile()
//    api/workout.js cleanProfile()
//    lib/workout-engine-host.js run(p)
//  Anything they do not name is dropped SILENTLY. The user answers
//  a question, the answer is saved, the summary shows it -- and the
//  engine never sees it.
//
//  This has already happened twice for real: `weeklyRate` (the whole
//  weekly gain/loss question) and `activeModules` (all eight helper
//  units). Both looked fine end to end. Both did nothing.
//
//  So: every key the Flutter app sends must be named on the server.
//  This test reads the real Dart source, so it cannot drift.
// ============================================================

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let pass = 0, fail = 0;
const check = (label, ok, extra) => {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label + (ok || !extra ? '' : '  -> ' + extra));
  ok ? pass++ : fail++;
};
const section = (t) => console.log('\n' + t);

const store = read('mobile/lib/models/profile_store.dart');

function payloadKeys(fnSignature) {
  const start = store.indexOf(fnSignature);
  if (start === -1) return null;
  const body = store.slice(start, store.indexOf('\n  }', start));
  const keys = [];
  const re = /'([a-zA-Z][a-zA-Z0-9_]*)':/g;
  let m;
  while ((m = re.exec(body)) !== null) if (keys.indexOf(m[1]) === -1) keys.push(m[1]);
  return keys;
}

section('the workout payload is fully honoured on the server');
const workoutKeys = payloadKeys('Map<String, dynamic> workoutPayload');
check('workoutPayload() was found in the Dart source', Array.isArray(workoutKeys) && workoutKeys.length > 0,
  String(workoutKeys && workoutKeys.length));

const mobileApi = read('api/mobile.js');
const workoutApi = read('api/workout.js');
const engineHost = read('lib/workout-engine-host.js');
const serverSide = mobileApi + '\n' + workoutApi + '\n' + engineHost;

(workoutKeys || []).forEach((key) => {
  check("'" + key + "' is named somewhere on the server", serverSide.indexOf(key) !== -1,
    'the engine will never receive it');
});

section('the nutrition payload is fully honoured on the server');
const nutritionKeys = payloadKeys('Map<String, dynamic> nutritionPayloadFrom');
check('nutritionPayloadFrom() was found', Array.isArray(nutritionKeys) && nutritionKeys.length > 0,
  String(nutritionKeys && nutritionKeys.length));

const bridge = read('lib/mobile-nutrition-bridge.js');
const nutritionSide = mobileApi + '\n' + bridge;
(nutritionKeys || []).forEach((key) => {
  check("'" + key + "' is named on the nutrition path", nutritionSide.indexOf(key) !== -1,
    'the nutrition engine will never receive it');
});

section('the two fields that were silently dropped before stay wired');
check('weeklyRate survives api/mobile.js', /o\.weeklyRate\s*=/.test(mobileApi));
check('weeklyRate reaches the nutrition engine', bridge.indexOf('weeklyRate') !== -1);
check('activeModules survives api/mobile.js', /o\.activeModules\s*=/.test(mobileApi));
check('activeModules survives api/workout.js', /out\.activeModules\s*=/.test(workoutApi));
check('activeModules reaches the workout engine', engineHost.indexOf('activeModules') !== -1);

section('the whitelists are still whitelists (so this test stays necessary)');
check('api/mobile.js still filters by an explicit key list', /forEach\(k=>\{if\(typeof p\[k\]/.test(mobileApi));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
