'use strict';
// Regression test for Fix #2: the workout path must REFUSE a request that is
// missing (or has implausible) age/height/weight instead of silently
// fabricating 25/175/75 and shipping a plan around a body nobody entered.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

process.env.EF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-workout-gate-'));
process.env.PORT = '0';
const server = require('../server');

function request(method, pathname, body, cookie) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const payload = body == null ? null : JSON.stringify(body);
    const headers = {};
    if (payload) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(payload); }
    if (cookie) headers.Cookie = cookie;
    const req = http.request({ host:'127.0.0.1', port:address.port, method, path:pathname, headers }, (res) => {
      let raw = ''; res.on('data', (c) => raw += c);
      res.on('end', () => {
        let json = {}; try { json = JSON.parse(raw || '{}'); } catch(_) {}
        const cookies = res.headers['set-cookie'] || [];
        const match = /ef_session=[^;]*/.exec(cookies.join(';'));
        resolve({ status: res.statusCode, json, cookie: match && match[0] });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name); } }

const FULL = {
  gender:'male', age:30, height:175, weight:80, goal:'muscle', exp:'beginner',
  equip:'gym', days:4, time:60, daily:'moderate', sleep:'ok', stress:'low',
  injuries:[], weak:[]
};

(async () => {
  await new Promise((resolve) => server.listening ? resolve() : server.on('listening', resolve));
  const signup = await request('POST', '/api/auth/signup', {
    email:`wkgate_${Date.now()}@gmail.com`, password:'supersecret123', name:'Gate Tester'
  });
  if (signup.status !== 201 || !signup.cookie) throw new Error('signup failed');
  const cookie = signup.cookie;

  console.log('[workout gate]');

  // 1) Complete profile -> accepted (200) with a real plan/preview.
  const good = await request('POST', '/api/workout/compute', { profile: FULL }, cookie);
  check('complete profile is accepted (200)', good.status === 200 && good.json.ok === true);

  // 2) Each missing body metric -> refused (400), no plan.
  for (const key of ['age','height','weight']) {
    const p = Object.assign({}, FULL); delete p[key];
    const r = await request('POST', '/api/workout/compute', { profile: p }, cookie);
    check('missing ' + key + ' is refused (400)', r.status === 400 && !r.json.plans && !r.json.recommended);
  }

  // 3) Empty profile -> refused (400), lists all three missing fields.
  const empty = await request('POST', '/api/workout/compute', { profile: {} }, cookie);
  check('empty profile refused (400) and names the missing fields',
    empty.status === 400 && /\u0627\u0644\u0639\u0645\u0631/.test(empty.json.error || '') &&
    /\u0627\u0644\u0637\u0648\u0644/.test(empty.json.error || '') && /\u0627\u0644\u0648\u0632\u0646/.test(empty.json.error || ''));

  // 4) Implausible values -> refused (400).
  for (const [key, val] of [['age',5],['age',150],['height',60],['weight',10],['weight',500]]) {
    const p = Object.assign({}, FULL); p[key] = val;
    const r = await request('POST', '/api/workout/compute', { profile: p }, cookie);
    check('implausible ' + key + '=' + val + ' refused (400)', r.status === 400 && !r.json.plans);
  }

  // 5) The refusal must NOT be the old silent 25/175/75 plan: an empty profile
  //    and the fabricated defaults must give DIFFERENT outcomes.
  const fabricated = await request('POST', '/api/workout/compute', { profile: { age:25, height:175, weight:75, goal:'muscle', exp:'beginner', equip:'gym', days:4 } }, cookie);
  check('the fabricated 25/175/75 body is a DELIBERATE 200, empty is a 400',
    fabricated.status === 200 && empty.status === 400);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  server.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
