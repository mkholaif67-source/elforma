'use strict';
/*
  test/app-version-gate.test.js

  The forced-update gate is the only way to retire a broken release that is
  already installed on people's phones. It has exactly two ways to fail, and
  both are silent:

    1. `kAppBuild` in mobile/lib/api.dart drifts away from the `+N` build number
       in mobile/pubspec.yaml. The gate then compares the WRONG number, so it
       either blocks everybody who is perfectly up to date, or blocks nobody
       when you desperately need it to block someone.

    2. The endpoint stops being wired end to end (handler exported, route
       registered, client method present). Nothing crashes -- the gate just
       quietly never fires, and you find out during the incident.

  Neither shows up in a normal test run, so they are asserted here.
*/
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let passed = 0;
let failed = 0;
function ok(name, fn) {
  try {
    fn();
    passed++;
    console.log('  \u2713 ' + name);
  } catch (e) {
    failed++;
    process.exitCode = 1;
    console.log('  \u2717 ' + name + ' \u2014 ' + e.message);
  }
}

console.log('app version gate');

const pubspec = read('mobile/pubspec.yaml');
const apiDart = read('mobile/lib/api.dart');
const mobileJs = read('api/mobile.js');
const serverJs = read('server.js');
const splash = read('mobile/lib/screens/splash_screen.dart');

// --- 1. the drift guard, the whole reason this file exists ------------------

const pubspecBuild = (() => {
  const m = pubspec.match(/^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+)\s*$/m);
  return m ? { version: m[1], build: parseInt(m[2], 10) } : null;
})();

const dartBuild = (() => {
  const m = apiDart.match(/const\s+int\s+kAppBuild\s*=\s*([0-9]+)\s*;/);
  return m ? parseInt(m[1], 10) : null;
})();

ok('pubspec.yaml declares a parseable version+build', () => {
  assert.ok(pubspecBuild, 'could not parse the `version: x.y.z+N` line');
  assert.ok(pubspecBuild.build > 0, 'build number must be positive');
});

ok('api.dart declares kAppBuild', () => {
  assert.ok(dartBuild !== null, 'kAppBuild constant not found in api.dart');
});

ok('kAppBuild EQUALS the pubspec build number (drift guard)', () => {
  assert.strictEqual(
    dartBuild,
    pubspecBuild.build,
    'api.dart kAppBuild=' + dartBuild + ' but pubspec build=' + pubspecBuild.build +
      ' \u2014 bump BOTH together or the update gate compares the wrong number'
  );
});

// --- 2. the endpoint is wired end to end -----------------------------------

ok('the server exports an appVersion handler', () => {
  assert.ok(/async function appVersion\s*\(/.test(mobileJs), 'handler not defined');
  assert.ok(/module\.exports\s*=\s*\{[^}]*\bappVersion\b/.test(mobileJs), 'handler not exported');
});

ok('the /api/app/version route is registered', () => {
  assert.ok(
    serverJs.includes("pathname === '/api/app/version'"),
    'route missing from server.js'
  );
  assert.ok(
    /'\/api\/app\/version'\)\s*return void \(await mobileApi\.appVersion\(/.test(serverJs),
    'route does not call mobileApi.appVersion'
  );
});

ok('the version endpoint is PUBLIC, not behind the auth helper', () => {
  // A blocked build must be able to ask BEFORE it can log in. If this handler
  // ever grows a `user(req,res)` guard the gate becomes unreachable for exactly
  // the people it exists to stop.
  const body = mobileJs.slice(mobileJs.indexOf('async function appVersion('));
  const handler = body.slice(0, body.indexOf('\n}\n') + 3);
  assert.ok(
    !/\buser\s*\(\s*req\s*,\s*res\s*\)/.test(handler),
    'appVersion must not require authentication'
  );
});

ok('the client exposes appVersion() and an UpdateGate', () => {
  assert.ok(/Future<ApiResult> appVersion\(\)/.test(apiDart), 'api.dart method missing');
  assert.ok(/class UpdateGate/.test(apiDart), 'UpdateGate missing');
  assert.ok(/enum UpdateVerdict/.test(apiDart), 'UpdateVerdict missing');
});

// --- 3. behaviour that must never regress ----------------------------------

ok('a network failure does NOT lock the user out', () => {
  const gate = apiDart.slice(apiDart.indexOf('class UpdateGate'));
  assert.ok(/catch \(_\)/.test(gate), 'check() must swallow errors');
  assert.ok(
    /return const UpdateGate\(UpdateVerdict\.ok, '', ''\);\s*\n\s*\}\s*\n\}/.test(gate),
    'check() must fall through to UpdateVerdict.ok'
  );
  assert.ok(
    /if \(!res\.ok\) return const UpdateGate\(UpdateVerdict\.ok/.test(gate),
    'a non-2xx answer must not block'
  );
});

ok('the gate is dormant until deliberately configured', () => {
  // minBuild/latestBuild default to 0 on the server, and the client only acts
  // when they are > 0. Shipping without setting the env vars must be a no-op.
  const gate = apiDart.slice(apiDart.indexOf('class UpdateGate'));
  assert.ok(/minBuild > 0 && kAppBuild < minBuild/.test(gate), 'missing minBuild > 0 guard');
  assert.ok(/latestBuild > 0 && kAppBuild < latestBuild/.test(gate), 'missing latestBuild > 0 guard');
});

ok('splash checks the gate BEFORE routing into the app', () => {
  const bootStart = splash.indexOf('Future<void> _boot()');
  assert.ok(bootStart > -1, '_boot not found');
  const gateAt = splash.indexOf('UpdateGate.check()', bootStart);
  const meAt = splash.indexOf('Api.I.me()', bootStart);
  assert.ok(gateAt > -1, 'splash never calls UpdateGate.check()');
  assert.ok(meAt > -1, 'splash never calls Api.I.me()');
  assert.ok(gateAt < meAt, 'the gate must run before the session is restored');
});

ok('the forced-update screen exists and has no way past it', () => {
  assert.ok(/class _ForcedUpdateScreen/.test(splash), 'screen missing');
  const scr = splash.slice(splash.indexOf('class _ForcedUpdateScreen'));
  assert.ok(
    !/Navigator\.of\(context\)\.(pop|push)/.test(scr),
    'the forced-update screen must be a dead end \u2014 no navigation out of it'
  );
});

ok('a required update never renders an empty message', () => {
  const gate = apiDart.slice(apiDart.indexOf('class UpdateGate'));
  assert.ok(
    /message\.isEmpty[\s\S]{0,200}\u0644\u0627\u0632\u0645 \u062a\u0646\u0632\u0644\u0647\u0627/.test(gate),
    'required verdict must fall back to Arabic copy when the server sends none'
  );
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
