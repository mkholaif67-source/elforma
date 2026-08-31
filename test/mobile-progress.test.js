'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

process.env.EF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-mobile-progress-'));
process.env.PORT = '0';
const server = require('../server');

function request(method, pathname, body, cookie) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const payload = body == null ? null : JSON.stringify(body);
    const headers = {};
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (cookie) headers.Cookie = cookie;
    const req = http.request({host:'127.0.0.1', port:address.port, method, path:pathname, headers}, (res) => {
      let raw = '';
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => {
        const json = JSON.parse(raw || '{}');
        const cookies = res.headers['set-cookie'] || [];
        const match = /ef_session=[^;]*/.exec(cookies.join(';'));
        resolve({status:res.statusCode, json, cookie:match && match[0]});
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  await new Promise((resolve) => server.listening ? resolve() : server.on('listening', resolve));
  const signup = await request('POST', '/api/auth/signup', {
    email:`progress_${Date.now()}@gmail.com`, password:'supersecret123', name:'Progress Tester',
  });
  if (signup.status !== 201 || !signup.cookie) throw new Error('signup failed');
  const cookie = signup.cookie;

  const weight = await request('PUT', '/api/mobile/weight', {day:'2026-07-24', weight:81.4}, cookie);
  if (weight.status !== 200 || weight.json.weights[0].weight !== 81.4) throw new Error('weight save failed');

  const measurement = await request('PUT', '/api/mobile/measurement', {
    day:'2026-07-24', waist:88.5, chest:103, hips:98, arm:37.2, thigh:59, bodyFat:18.5,
  }, cookie);
  if (measurement.status !== 200 || measurement.json.measurements[0].waist !== 88.5) {
    throw new Error('measurement save failed');
  }

  const bootstrap = await request('GET', '/api/mobile/bootstrap?day=2026-07-24', null, cookie);
  if (bootstrap.status !== 200 || bootstrap.json.weights[0].weight !== 81.4) throw new Error('weight bootstrap failed');
  const latest = bootstrap.json.measurements[0];
  if (!latest || latest.chest !== 103 || latest.body_fat !== 18.5) throw new Error('measurement bootstrap failed');

  console.log('Mobile progress flow passed');
  server.close(() => process.exit(0));
})().catch((error) => {
  console.error(error);
  server.close(() => process.exit(1));
});
