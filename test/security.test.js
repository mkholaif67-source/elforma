// Live smoke test: signup -> two device sessions -> logout-all -> old session dead,
// calling device still alive. Also exercises the forgot-password endpoint.
'use strict';
process.env.EF_DATA_DIR = '/tmp/smoke_data';
process.env.EF_SECRET = 'smoke-test-secret-value-1234567890';
process.env.EF_ENV = 'test';
process.env.PORT = '0'; // ephemeral port, same convention as test/api.test.js
require('fs').rmSync('/tmp/smoke_data', { recursive: true, force: true });
require('fs').mkdirSync('/tmp/smoke_data', { recursive: true });

const http = require('http');
const app = require('../server.js');

function req(server, method, path, body, cookie) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      host: '127.0.0.1', port: server.address().port, method, path,
      headers: Object.assign(
        { 'content-type': 'application/json' },
        data ? { 'content-length': Buffer.byteLength(data) } : {},
        cookie ? { cookie } : {}),
    }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        const sc = res.headers['set-cookie'];
        let session = null;
        if (sc) { const m = /ef_session=([^;]*)/.exec(sc.join(';')); if (m) session = 'ef_session=' + m[1]; }
        let json = null; try { json = JSON.parse(buf); } catch (_) {}
        resolve({ status: res.statusCode, json, session });
      });
    });
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const srv = app;
  await new Promise((res) => { if (srv.listening) return res(); srv.on('listening', res); });
  let pass = 0, fail = 0;
  const ck = (label, ok) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + label); ok ? pass++ : fail++; };

  const email = 'smoke' + Date.now() + '@gmail.com';
  const up = await req(srv, 'POST', '/api/auth/signup', { name: 'Mo Smoke', email, password: 'StrongPass123' });
  ck('signup works (' + up.status + ')', (up.status === 200 || up.status === 201) && !!up.session);

  const deviceA = await req(srv, 'POST', '/api/auth/login', { identifier: email, password: 'StrongPass123' });
  const deviceB = await req(srv, 'POST', '/api/auth/login', { identifier: email, password: 'StrongPass123' });
  ck('device A signed in', deviceA.status === 200 && !!deviceA.session);
  ck('device B signed in', deviceB.status === 200 && !!deviceB.session);

  // NOTE: /api/auth/me answers 200 with { user: null } for a dead session,
  // so identity must be asserted on the body, never on the status code.
  const meA1 = await req(srv, 'GET', '/api/auth/me', null, deviceA.session);
  ck('device A session valid before revoke', meA1.status === 200 && !!(meA1.json && meA1.json.user));

  const all = await req(srv, 'POST', '/api/account/logout-all', {}, deviceB.session);
  ck('logout-all accepted (' + all.status + ')', all.status === 200 && all.json && all.json.ok === true);
  ck('logout-all returns a refreshed cookie', !!all.session);

  const meA2 = await req(srv, 'GET', '/api/auth/me', null, deviceA.session);
  ck('OTHER device is now signed out', !!(meA2.json && meA2.json.user === null));

  const meB2 = await req(srv, 'GET', '/api/auth/me', null, all.session || deviceB.session);
  ck('CALLING device stays signed in', !!(meB2.json && meB2.json.user && meB2.json.user.email === email));

  // Protected data must also refuse the revoked cookie, not just /me.
  const dataA = await req(srv, 'GET', '/api/account/export', null, deviceA.session);
  ck('revoked device cannot reach protected data (401)', dataA.status === 401);

  const anon = await req(srv, 'POST', '/api/account/logout-all', {});
  ck('logout-all requires auth (401)', anon.status === 401);

  const forgotKnown = await req(srv, 'POST', '/api/auth/forgot', { email });
  const forgotUnknown = await req(srv, 'POST', '/api/auth/forgot', { email: 'nobody@gmail.com' });
  ck('forgot-password answers 200 for a real account', forgotKnown.status === 200);
  ck('forgot-password does not leak unknown emails', forgotUnknown.status === 200);

  const outbox = require('fs').existsSync('/tmp/smoke_data/outbox')
    ? require('fs').readdirSync('/tmp/smoke_data/outbox') : [];
  ck('reset email was actually generated', outbox.length >= 1);

  console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
  srv.close();
  process.exit(fail === 0 ? 0 : 1);
})();
