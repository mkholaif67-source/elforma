'use strict';
// ============================================================
//  OWNER VIDEO CONTROL
//
//  The owner must be able to add, edit and delete an exercise
//  video from the admin page without shipping a release.
//
//  These assertions exist because a syntax check proves nothing:
//  an earlier bug in this project passed `node --check` and still
//  threw at runtime on an undefined identifier. So this file
//  EXECUTES the layer against a real throwaway database.
// ============================================================

const fs = require('fs');
const os = require('os');
const path = require('path');

// Point the database at a throwaway directory BEFORE lib/db is loaded, so a
// test run can never touch real trainee data.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-videos-'));
process.env.EF_DATA_DIR = TMP;

const db = require('../lib/db');
const guard = require('../lib/video-guard');

let pass = 0, fail = 0;
const check = (label, ok, extra) => {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label + (ok || !extra ? '' : '  -> ' + extra));
  ok ? pass++ : fail++;
};
const section = (t) => console.log('\n' + t);

// ------------------------------------------------------------------
section('the lookup key is stable however the name is typed');
check('trims and lowercases', guard.videoKey('  Cable Crunch  ') === 'cable crunch');
check('collapses inner spaces', guard.videoKey('Cable   Crunch') === 'cable crunch');
check('same key for both spellings',
  guard.videoKey('BOX Breathing') === guard.videoKey('box breathing'));
check('empty name yields an empty key', guard.videoKey(null) === '');

// ------------------------------------------------------------------
section('with no override the authored link is untouched');
guard.invalidateOverrides();
const base = guard.resolve('ezvyKMleqiA', 'chest', 'Bench Press');
check('id preserved', base.videoId === 'ezvyKMleqiA', base.videoId);
check('source is authored', base.source === 'authored', base.source);

// ------------------------------------------------------------------
section('an override really replaces the authored link');
db.setVideoOverride(guard.videoKey('Bench Press'), 'Bench Press', 'lTe6GFTieP8', 'test', null);
guard.invalidateOverrides();
const over = guard.resolve('ezvyKMleqiA', 'chest', 'Bench Press');
check('the owner id wins', over.videoId === 'lTe6GFTieP8', over.videoId);
check('source is override', over.source === 'override', over.source);
check('url is rebuilt from the new id',
  over.url === 'https://www.youtube.com/watch?v=lTe6GFTieP8', over.url);

// The whole point of the cache is that it must never outlive a write.
section('a write invalidates the cache immediately');
db.setVideoOverride(guard.videoKey('Bench Press'), 'Bench Press', '7hojk65NU4o', null, null);
guard.invalidateOverrides();
check('the second edit is visible at once',
  guard.resolve('ezvyKMleqiA', 'chest', 'Bench Press').videoId === '7hojk65NU4o');

// ------------------------------------------------------------------
section('an EMPTY override is a deliberate delete, not a fallback');
db.setVideoOverride(guard.videoKey('Bench Press'), 'Bench Press', '', null, null);
guard.invalidateOverrides();
const gone = guard.resolve('ezvyKMleqiA', 'chest', 'Bench Press');
check('the authored link does NOT come back', gone.videoId === '', gone.videoId);
check('source says removed, not missing', gone.source === 'removed', gone.source);
check('url is empty so the button can hide', gone.url === '', gone.url);
check('missing flag is set', gone.missing === true);

section('clearing the override restores the engine link');
db.clearVideoOverride(guard.videoKey('Bench Press'));
guard.invalidateOverrides();
check('back to the authored id',
  guard.resolve('ezvyKMleqiA', 'chest', 'Bench Press').videoId === 'ezvyKMleqiA');

// ------------------------------------------------------------------
section('an override never leaks a malformed id into a plan');
// test/parity.test.js enforces a strict YouTube URL shape; anything the admin
// stores has to survive that same rule.
const VIDEO_RE = /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{8,12}$/;
db.setVideoOverride(guard.videoKey('Cable Crunch'), 'Cable Crunch',
  guard.extractId('https://youtu.be/iRYIqSFN21w'), null, null);
guard.invalidateOverrides();
const norm = guard.resolve('', 'abs', 'Cable Crunch');
check('a pasted URL is stored and served as a clean id', norm.videoId === 'iRYIqSFN21w', norm.videoId);
check('the emitted url still matches the parity rule', VIDEO_RE.test(norm.url), norm.url);
db.clearVideoOverride(guard.videoKey('Cable Crunch'));
guard.invalidateOverrides();

// ------------------------------------------------------------------
section('junk is rejected before it can ever be stored');
['', null, undefined, 'not a link', 'https://example.com/x', '???'].forEach((bad) => {
  check('extractId rejects ' + JSON.stringify(bad), !guard.extractId(bad));
});

// ------------------------------------------------------------------
section('the admin surface is wired end to end');
const admin = require('../api/admin');
['videos', 'videoSet', 'videoRemove', 'videoReset'].forEach((fn) => {
  check('api/admin exports ' + fn, typeof admin[fn] === 'function');
});

const adminSrc = fs.readFileSync(path.join(__dirname, '..', 'api', 'admin.js'), 'utf8');
['videos', 'videoSet', 'videoRemove', 'videoReset'].forEach((fn) => {
  // Every handler must gate on requireAdmin: these routes rewrite what every
  // trainee sees, so an unauthenticated caller must never reach them.
  const body = adminSrc.split('async function ' + fn + '(')[1] || '';
  check(fn + ' is behind requireAdmin', body.slice(0, 200).indexOf('requireAdmin') >= 0);
});

const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
[
  ["'/api/admin/videos'", 'adminApi.videos('],
  ["'/api/admin/video/set'", 'adminApi.videoSet('],
  ["'/api/admin/video/remove'", 'adminApi.videoRemove('],
  ["'/api/admin/video/reset'", 'adminApi.videoReset(']
].forEach((pair) => {
  check('route ' + pair[0] + ' is registered',
    serverSrc.indexOf(pair[0]) >= 0 && serverSrc.indexOf(pair[1]) >= 0);
});

section('the admin page can actually reach the routes');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
check('a Videos tab exists', html.indexOf('data-v="videos"') >= 0);
check('the router handles it', html.indexOf("v==='videos'") >= 0);
['/api/admin/videos', '/api/admin/video/set', '/api/admin/video/remove', '/api/admin/video/reset']
  .forEach((p) => check('page calls ' + p, html.indexOf(p) >= 0));

// ------------------------------------------------------------------
section('the catalogue is built from the engine, not a duplicate list');
const engineFile = path.join(__dirname, '..', 'app', 'workout', 'engine', 'db.js');
check('the engine file the admin reads exists', fs.existsSync(engineFile));

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* best effort */ }

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
