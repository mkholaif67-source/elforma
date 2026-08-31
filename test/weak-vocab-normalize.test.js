'use strict';
// Pins the mobile<->engine weak-point vocabulary bridge (item #2: naming
// unification). The engine's weakScore matches weak points against each
// exercise's anatomical `mu` string, so coarse mobile labels must expand.
const assert = require('assert');
const host = require('../lib/workout-engine-host');

function eq(a, b, msg) { assert.deepStrictEqual(a, b, msg); }

// 1. legs -> the four anatomical lower-body keys the engine actually uses
eq(host.normalizeWeak(['legs']), ['quads', 'hamstrings', 'glutes', 'calves'], 'legs must expand');

// 2. arms -> biceps/triceps (engine has no 'arms' mu)
eq(host.normalizeWeak(['arms']), ['biceps', 'triceps'], 'arms must expand');

// 3. core -> core + abs (engine tags both)
eq(host.normalizeWeak(['core']), ['core', 'abs'], 'core must expand');

// 4. already-anatomical keys pass through untouched
eq(host.normalizeWeak(['chest', 'back', 'shoulders', 'glutes']), ['chest', 'back', 'shoulders', 'glutes'], 'canonical passthrough');

// 5. mixed + dedupe + case/whitespace tolerance
eq(host.normalizeWeak(['legs', ' Chest ', 'CORE', 'quads']), ['quads', 'hamstrings', 'glutes', 'calves', 'chest', 'core', 'abs'], 'mixed dedupe');

// 6. defensive: non-arrays / empties never throw
eq(host.normalizeWeak(null), [], 'null -> []');
eq(host.normalizeWeak(undefined), [], 'undefined -> []');
eq(host.normalizeWeak(['', '  ', null]), [], 'blank entries dropped');

console.log('weak-vocab-normalize: all assertions passed');
