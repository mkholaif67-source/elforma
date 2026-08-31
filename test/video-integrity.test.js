'use strict';
// ============================================================
//  VIDEO INTEGRITY
//
//  Every video id in this project was verified BY HAND by the
//  project owner. The app is therefore FORBIDDEN from inventing
//  or swapping a link. Showing the wrong demonstration is worse
//  than showing none: it teaches a wrong movement.
//
//  These assertions exist because the guard used to silently
//  replace missing ids with a muscle-group clip, which masked a
//  real data gap and put an unrelated video on the exercise.
// ============================================================

const guard = require('../lib/video-guard');
const host = require('../lib/workout-engine-host');

let pass = 0, fail = 0;
const check = (label, ok, extra) => {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label + (ok || !extra ? '' : '  -> ' + extra));
  ok ? pass++ : fail++;
};
const section = (t) => console.log('\n' + t);

section('an authored id is returned untouched');
const AUTHORED = ['ezvyKMleqiA', '7hojk65NU4o', 'BBLFDbGvhg8', 'lTe6GFTieP8', '6HgNrPFaGlw'];
AUTHORED.forEach((id) => {
  const r = guard.resolve(id, 'chest');
  check('kept ' + id, r.videoId === id && r.source === 'authored', 'got ' + r.videoId);
});

section('a full URL is only normalised, never changed');
check('watch?v= form', guard.resolve('https://www.youtube.com/watch?v=ezvyKMleqiA', 'back').videoId === 'ezvyKMleqiA');
check('youtu.be form', guard.resolve('https://youtu.be/ezvyKMleqiA', 'back').videoId === 'ezvyKMleqiA');
check('shorts form', guard.resolve('https://www.youtube.com/shorts/ezvyKMleqiA', 'back').videoId === 'ezvyKMleqiA');

section('a MISSING id is reported, never invented');
['', null, undefined, 'null', 'undefined', 'NaN'].forEach((bad) => {
  const r = guard.resolve(bad, 'chest');
  check('no video invented for ' + JSON.stringify(bad),
    r.videoId === '' && r.url === '' && r.missing === true && r.source === 'missing',
    'invented ' + r.videoId);
});

section('the fallback tables are never consulted');
const inventedIds = Object.keys(guard.GROUP_FALLBACK).map((k) => guard.GROUP_FALLBACK[k]).concat([guard.ULTIMATE]);
const missingResults = ['', 'null', undefined].map((b) => guard.resolve(b, 'legs').videoId);
check('no group fallback leaked into a result',
  missingResults.every((v) => inventedIds.indexOf(v) === -1));

section('a real computed plan keeps every authored link');
const plan = host.computeWorkout({
  gender: 'male', age: 30, height: 175, weight: 85, goal: 'lose',
  experience: 'intermediate', equipment: 'gym', trainingDays: 4,
  dailyActivity: 'moderate', sleep: 'ok', stress: 'mid', diet: 'balanced'
});
const before = [];
(function collect(node, depth) {
  if (!node || (depth || 0) > 8) return;
  if (Array.isArray(node)) return node.forEach((x) => collect(x, (depth || 0) + 1));
  if (typeof node !== 'object') return;
  if (typeof node.n === 'string' && Object.prototype.hasOwnProperty.call(node, 'vid')) {
    before.push({ n: node.n, vid: String(node.vid == null ? '' : node.vid) });
  }
  Object.keys(node).forEach((k) => { const v = node[k]; if (v && typeof v === 'object') collect(v, (depth || 0) + 1); });
})(plan, 0);

check('the plan actually contains exercises', before.length > 0, before.length + ' found');

const copy = JSON.parse(JSON.stringify(plan));
guard.guardPlan(copy);
const after = [];
(function collect(node, depth) {
  if (!node || (depth || 0) > 8) return;
  if (Array.isArray(node)) return node.forEach((x) => collect(x, (depth || 0) + 1));
  if (typeof node !== 'object') return;
  if (typeof node.n === 'string' && Object.prototype.hasOwnProperty.call(node, 'vid')) {
    after.push({ n: node.n, vid: String(node.vid == null ? '' : node.vid) });
  }
  Object.keys(node).forEach((k) => { const v = node[k]; if (v && typeof v === 'object') collect(v, (depth || 0) + 1); });
})(copy, 0);

const changed = [];
before.forEach((b, i) => {
  const a = after[i];
  if (!a) return;
  const wasReal = b.vid && ['null', 'undefined', 'nan', 'none'].indexOf(b.vid.toLowerCase()) === -1;
  if (wasReal && a.vid !== guard.extractId(b.vid)) changed.push(b.n + ': ' + b.vid + ' -> ' + a.vid);
});
check('the guard changed ZERO verified links', changed.length === 0, changed.slice(0, 5).join(' | '));

section('the data gap is visible instead of hidden');
const gaps = guard.auditPlan(copy);
check('auditPlan reports missing videos as a list', Array.isArray(gaps), typeof gaps);
check('the shipped exercise data has no missing video', gaps.length === 0,
  gaps.slice(0, 8).join(', '));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
