'use strict';
// End-to-end API tests — no external test framework. Starts the real server
// against a throwaway DB, exercises the full auth + sync + account flow.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Isolated data dir so tests never touch real data.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-test-'));
process.env.EF_DATA_DIR = TMP;
process.env.PORT = '0'; // ephemeral port

const server = require('../server');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.error('  \u2717 ' + name); }
}

function req(method, pathname, { body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const data = body != null ? JSON.stringify(body) : null;
    const headers = {};
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
    if (cookie) headers['Cookie'] = cookie;
    const r = http.request({ host: '127.0.0.1', port: addr.port, method, path: pathname, headers }, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => {
        let json = null; try { json = JSON.parse(buf); } catch (_) {}
        const setCookie = res.headers['set-cookie'];
        let sessionCookie = null;
        if (setCookie) { const m = /ef_session=[^;]*/.exec(setCookie.join(';')); if (m) sessionCookie = m[0]; }
        resolve({ status: res.statusCode, json, raw: buf, sessionCookie });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async function run() {
  await new Promise((res) => { if (server.listening) return res(); server.on('listening', res); });
  console.log('\nRunning ElForma API tests...\n');
  const email = 'test_' + Date.now() + '@gmail.com';
  const password = 'supersecret123';
  let cookie = null;

  console.log('[health]');
  let r = await req('GET', '/api/health');
  check('health returns ok', r.status === 200 && r.json && r.json.ok === true);

  console.log('[auth]');
  r = await req('GET', '/api/auth/me');
  check('me is null when logged out', r.status === 200 && r.json.user === null);

  r = await req('POST', '/api/auth/signup', { body: { email, password, name: 'Tester' } });
  check('signup succeeds (201)', r.status === 201 && r.json.user && r.json.user.email === email);
  check('signup sets session cookie', !!r.sessionCookie);
  cookie = r.sessionCookie;

  r = await req('POST', '/api/auth/signup', { body: { email, password } });
  check('duplicate signup rejected (409)', r.status === 409);

  r = await req('POST', '/api/auth/signup', { body: { email: 'x@y.com', password: 'short' } });
  check('weak password rejected (400)', r.status === 400);

  r = await req('POST', '/api/auth/signup', { body: { email: 'not-an-email', password: 'longenough1' } });
  check('invalid email rejected (400)', r.status === 400);

  r = await req('GET', '/api/auth/me', { cookie });
  check('me returns user with cookie', r.status === 200 && r.json.user && r.json.user.email === email);
  // [OWNER-RULE] كل حساب جديد بيتفعّل له تلقائيًا تجربة 3 أيام (plan='trial') عند التسجيل.
  check('me includes subscription (auto trial)', r.json.subscription && r.json.subscription.plan === 'trial');

  r = await req('POST', '/api/auth/login', { body: { email, password: 'wrongpass' } });
  check('login with wrong password fails (401)', r.status === 401);

  r = await req('POST', '/api/auth/login', { body: { email, password } });
  check('login succeeds', r.status === 200 && r.json.user.email === email);
  cookie = r.sessionCookie || cookie;

  console.log('[state sync]');
  r = await req('GET', '/api/state', { cookie });
  check('state starts empty', r.status === 200 && r.json.state && Object.keys(r.json.state).length === 0);

  r = await req('GET', '/api/state');
  check('state requires auth (401)', r.status === 401);

  const plan = JSON.stringify({ days: 5, split: 'PPL' });
  r = await req('PUT', '/api/state', { cookie, body: { changes: {
    'EF_UNIFIED_PROFILE': JSON.stringify({ gender: 'male', goal: 'muscle' }),
    'forma_plan': plan,
    'diet_target': '2200',
    'hacker_key': 'should-be-skipped'
  } } });
  check('put applies allowed keys, skips others', r.status === 200 && r.json.applied === 3 && r.json.skipped === 1);

  r = await req('GET', '/api/state', { cookie });
  check('state persisted forma_plan', r.json.state.forma_plan === plan);
  check('state persisted profile', !!r.json.state.EF_UNIFIED_PROFILE);
  check('disallowed key not stored', !('hacker_key' in r.json.state));

  r = await req('PUT', '/api/state', { cookie, body: { changes: { 'diet_target': null } } });
  check('null value deletes key', r.status === 200);
  r = await req('GET', '/api/state', { cookie });
  check('deleted key is gone', !('diet_target' in r.json.state));

  console.log('[cross-device: second login sees data]');
  r = await req('POST', '/api/auth/login', { body: { email, password } });
  const cookie2 = r.sessionCookie;
  r = await req('GET', '/api/state', { cookie: cookie2 });
  check('new session sees synced plan', r.json.state.forma_plan === plan);

  console.log('[app gating]');
  r = await req('GET', '/app/');
  check('app redirects when unauthenticated (302)', r.status === 302);

  console.log('[account]');
  r = await req('GET', '/api/account/export', { cookie });
  check('export returns data', r.status === 200 && r.json.account && r.json.account.email === email && r.json.state.forma_plan === plan);

  r = await req('POST', '/api/account/delete', { cookie });
  check('account delete succeeds', r.status === 200);
  r = await req('GET', '/api/auth/me', { cookie });
  check('deleted account session invalid', r.json.user === null);
  r = await req('POST', '/api/auth/login', { body: { email, password } });
  check('cannot login after delete (401)', r.status === 401);

  // [REMOVED] landing page test — صفحة الموقع اتحذفت عمداً (تطبيق موبايل بس).

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  server.close();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
