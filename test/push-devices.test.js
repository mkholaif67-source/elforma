'use strict';
/* اختبار المسارات اللي أضفناها للإشعارات وإعدادات التطبيق.
   الغرض منه: إن كل مسار جديد يتنفّذ فعلًا مرة واحدة على الأقل، عشان أي دالة
   ناقصة أو require مفقود يبان هنا مايوصلش للمستخدم. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

process.env.EF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-push-'));
process.env.PORT = '0';
const ADMIN_EMAIL = 'admin_push_' + Date.now() + '@gmail.com';
process.env.EF_ADMIN_EMAILS = ADMIN_EMAIL;
const server = require('../server');

function request(method, pathname, body, cookie) {
  return new Promise(function (resolve, reject) {
    const address = server.address();
    const payload = body == null ? null : JSON.stringify(body);
    const headers = {};
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (cookie) headers.Cookie = cookie;
    const req = http.request({ host: '127.0.0.1', port: address.port, method: method, path: pathname, headers: headers }, function (res) {
      let raw = '';
      res.on('data', function (c) { raw += c; });
      res.on('end', function () {
        let json = {};
        try { json = JSON.parse(raw || '{}'); } catch (_) { json = { _raw: String(raw).slice(0, 200) }; }
        const setCookie = res.headers['set-cookie'] || [];
        const match = /ef_session=[^;]*/.exec(setCookie.join(';'));
        resolve({ status: res.statusCode, json: json, cookie: match && match[0] });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let pass = 0, fail = 0;
function ok(label, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + label); }
  else { fail++; console.log('  \u2717 ' + label + (extra === undefined ? '' : ' \u2014 ' + JSON.stringify(extra))); }
}

(async function () {
  await new Promise(function (r) { if (server.listening) r(); else server.on('listening', r); });

  const user = await request('POST', '/api/auth/signup', {
    email: 'push_user_' + Date.now() + '@gmail.com', password: 'supersecret123', name: 'Push Tester',
  });
  if (user.status !== 201 || !user.cookie) throw new Error('user signup failed');
  const uc = user.cookie;

  const admin = await request('POST', '/api/auth/signup', {
    email: ADMIN_EMAIL, password: 'supersecret123', name: 'Admin Tester',
  });
  if (admin.status !== 201 || !admin.cookie) throw new Error('admin signup failed');
  const ac = admin.cookie;

  console.log('[bootstrap بيرجّع الإعدادات]');
  const boot = await request('GET', '/api/mobile/bootstrap', null, uc);
  ok('bootstrap 200', boot.status === 200, boot.json);
  ok('فيه appConfig', !!boot.json.appConfig && typeof boot.json.appConfig === 'object', boot.json.appConfig);
  ok('فيه announcements', Array.isArray(boot.json.announcements));
  ok('فيه features', !!boot.json.features && typeof boot.json.features === 'object');

  console.log('[إعدادات التطبيق للموبايل]');
  const cfgRes = await request('GET', '/api/mobile/app-config', null, uc);
  ok('app-config 200', cfgRes.status === 200, cfgRes.json);
  ok('pollMinutes رقم', typeof (cfgRes.json.appConfig || {}).pollMinutes === 'number', cfgRes.json.appConfig);

  console.log('[تسجيل جهاز الإشعارات]');
  const token = 'tok_' + new Array(41).join('x');
  const reg = await request('POST', '/api/mobile/device/register', { token: token, platform: 'android', appBuild: 53 }, uc);
  ok('register 200', reg.status === 200, reg.json);
  const bad = await request('POST', '/api/mobile/device/register', { token: '' }, uc);
  ok('توكن فاضي مرفوض 400', bad.status === 400, bad.json);
  const noAuth = await request('POST', '/api/mobile/device/register', { token: token }, null);
  ok('لازم تسجيل دخول 401', noAuth.status === 401, noAuth.json);

  console.log('[الأدمن بيشوف الأجهزة]');
  const st = await request('GET', '/api/admin/push/status', null, ac);
  ok('push/status 200', st.status === 200, st.json);
  ok('الجهاز المسجّل ظهر', Number((st.json.devices || {}).total) >= 1, st.json.devices);
  ok('وصول الإشعار محسوب', Number((st.json.reach || {}).all) >= 1, st.json.reach);
  ok('configured بولياني', typeof st.json.configured === 'boolean', st.json);

  console.log('[إعدادات التطبيق من الأدمن]');
  const cfgGet = await request('GET', '/api/admin/app-config', null, ac);
  ok('app-config get 200', cfgGet.status === 200, cfgGet.json);
  const save = await request('POST', '/api/admin/app-config', { config: { maintenance: true, maintenanceTitle: 'صيانة', pollMinutes: 30 } }, ac);
  ok('حفظ الإعدادات 200', save.status === 200, save.json);

  const after = await request('GET', '/api/mobile/app-config', null, uc);
  ok('الصيانة وصلت الموبايل', (after.json.appConfig || {}).maintenance === true, after.json.appConfig);
  ok('pollMinutes اتغيّرت', (after.json.appConfig || {}).pollMinutes === 30, after.json.appConfig);

  // بوّابة الإصدار لازم تبلّغ التطبيق بالصيانة عشان يورّي شاشة الصيانة.
  const gate = await request('GET', '/api/app/version', null, uc);
  ok('app/version فيه maintenance', gate.status === 200 && gate.json.maintenance === true, gate.json);

  await request('POST', '/api/admin/app-config', { config: { maintenance: false } }, ac);
  const gate2 = await request('GET', '/api/app/version', null, uc);
  ok('إلغاء الصيانة بيوصل كمان', gate2.json.maintenance !== true, gate2.json);

  console.log('[سجل العمليات]');
  const audit = await request('GET', '/api/admin/audit?limit=10', null, ac);
  ok('audit 200', audit.status === 200, audit.json);
  ok('audit بيرجّع مصفوفة', Array.isArray(audit.json.items), audit.json);

  console.log('[إرسال إشعار]');
  const send = await request('POST', '/api/admin/notifications/send', {
    title: 'عنوان تجربة', body: 'نص تجربة', type: 'popup', target: 'all', push: true,
  }, ac);
  ok('send 200', send.status === 200, send.json);
  ok('فيه delivery', !!send.json.delivery && typeof send.json.delivery === 'object', send.json);
  const notifs = await request('GET', '/api/mobile/notifications', null, uc);
  ok('الإشعار وصل الموبايل', notifs.status === 200 && (notifs.json.items || []).some(function (x) { return x.title === 'عنوان تجربة'; }), notifs.json);

  console.log('[منع غير الأدمن]');
  const forbidden = await request('GET', '/api/admin/push/status', null, uc);
  ok('مستخدم عادي ممنوع', forbidden.status === 401 || forbidden.status === 403, forbidden.status);

  console.log('[إلغاء تسجيل الجهاز]');
  const unreg = await request('POST', '/api/mobile/device/unregister', { token: token }, uc);
  ok('unregister 200', unreg.status === 200, unreg.json);
  const st2 = await request('GET', '/api/admin/push/status', null, ac);
  ok('الجهاز اتشال',
    Number((st2.json.devices || {}).active) === Number((st.json.devices || {}).active) - 1,
    { before: st.json.devices, after: st2.json.devices });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  server.close();
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
