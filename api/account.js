'use strict';
// /api/account/* — export & delete (GDPR-style data rights).
const db = require('../lib/db');
const auth = require('../lib/auth');
const { sendJson, parseCookies, serializeCookie, readJsonBody, isEmail, normalizePhone } = require('../lib/util');
const { rateLimit } = require('../lib/rateLimit');
// [OWNER-RULE] سياسة البريد الرسمي + فحص اسم المستخدم.
const identity = require('../lib/identity-policy');

// [FIX H5] نفس سياسة api/auth.js: Secure هو الافتراضي، والخروج عنه بقرار صريح
// عن طريق EF_INSECURE_COOKIES=1 (تطوير محلي بس).
const SECURE_COOKIES = process.env.EF_INSECURE_COOKIES !== '1';
const PROD = process.env.EF_ENV === 'production';

function requireUser(req, res) {
  const user = auth.currentUser(parseCookies(req));
  if (!user) { sendJson(res, 401, { error: 'unauthenticated' }); return null; }
  return user;
}

// Being signed in is not a licence to hammer an endpoint. Password change in
// particular is an oracle for the CURRENT password, so it must be throttled
// exactly like login is. Keyed per account, not per IP, so one hijacked session
// cannot burn through attempts from many addresses.
function throttled(res, action, userId, limit, windowMs) {
  if (rateLimit('acct:' + action + ':' + userId, limit, windowMs)) return false;
  sendJson(res, 429, { error: 'محاولات كتيرة جرب بعد شوية' });
  return true;
}

// GET /api/account/export -> full JSON dump of the user's data.
async function exportData(req, res) {
  const user = requireUser(req, res); if (!user) return;
  // [FIX C2 — عكس منطق البوابة]
  // الكود القديم كان بيمنع مستخدم التجربة من تصدير بياناته، بينما المستخدم
  // المجاني (اللي مامعاهوش أي اشتراك) كان بيصدّر عادي. النتيجة إن اللي بيفعّل
  // التجربة بيتعاقب ويفقد ميزة كانت شغالة عنده.
  //
  // الفصل الصح:
  //   • /api/account/export = تصدير بيانات المستخدم نفسه (حق قانوني/GDPR):
  //     متاح لأي حساب مسجّل دخول، مجاني أو تجربة أو مشترك. دي بياناته هو.
  //   • تصدير/مشاركة الخطة المولَّدة = منتج مدفوع، وبيتحكم فيه
  //     api/share.js (باقة مدفوعة نشطة فقط) وحقل canExport في bootstrap.
  const rows = db.getState(user.id);
  const state = {};
  for (const k of Object.keys(rows)) state[k] = rows[k].v;
  const payload = {
    exported_at: db.now(),
    account: { id: user.id, email: user.email, name: user.name, created_at: user.created_at },
    subscription: db.getSubscription(user.id),
    state,
    mobile: {
      profile: (function(){ const row=db.mobileProfile(user.id); try{return row?JSON.parse(row.profile_json):null;}catch(_){return null;} })(),
      active_workout_plan: (function(){ const row=db.activeWorkoutPlan(user.id); try{return row?JSON.parse(row.plan_json):null;}catch(_){return null;} })(),
      // المجموعات بتتحمل مرة واحدة بدل استعلام لكل جلسة
      workout_sessions: (function(){
        const byId = db.workoutSetsByUser(user.id);
        return db.recentWorkoutSessions(user.id,1000).map(function(session){
          return Object.assign({},session,{sets:byId.get(session.id)||[]});
        });
      })(),
      nutrition_days: db.nutritionHistory(user.id,1000).map(function(row){let meals=[];try{meals=JSON.parse(row.meals_json||'[]');}catch(_){}return Object.assign({},row,{meals:meals,meals_json:undefined});}),
      weights: db.recentWeights(user.id,1000),
      body_measurements: db.recentMeasurements(user.id,1000),
      food_preferences: db.foodPreferences(user.id,1000)
    }
  };
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': 'attachment; filename="elforma-data.json"',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload, null, 2));
}

// POST /api/account/delete -> removes the account and all data.
async function deleteAccount(req, res, ip) {
  const user = requireUser(req, res); if (!user) return;
  if (throttled(res, 'delete', user.id, 5, 600000)) return;
  db.db.prepare('DELETE FROM users WHERE id = ?').run(user.id); // cascades
  db.audit(null, 'account_deleted:' + user.email, ip);
  res.setHeader('Set-Cookie', serializeCookie('ef_session', '', { maxAge: 0, httpOnly: true, sameSite: 'Lax', secure: SECURE_COOKIES }));
  return sendJson(res, 200, { ok: true });
}

// POST /api/account/profile -> update name / email / phone (change, not delete).
async function updateProfile(req, res, ip) {
  const user = requireUser(req, res); if (!user) return;
  // Email/phone changes probe for "is this address taken?", so cap them too.
  if (throttled(res, 'profile', user.id, 20, 300000)) return;
  let body; try { body = await readJsonBody(req); } catch (_) { return sendJson(res, 400, { error: 'طلب غير صالح' }); }
  body = body || {};
  const updates = {};
  if (typeof body.name === 'string') {
    // [OWNER-RULE] نفس فحص اليوزر نيم اللي في التسجيل — ماينفعش يتخطّى من هنا.
    if (body.name.trim() !== '') {
      const nameIssue = identity.nameProblem(body.name);
      if (nameIssue) return sendJson(res, 400, { error: nameIssue });
    }
    updates.name = identity.cleanName(body.name);
  }
  if (body.email !== undefined) {
    const email = String(body.email || '').trim().toLowerCase();
    if (email) {
      // [OWNER-RULE] بريد رسمي معروف فقط، وممنوع البريد المؤقت.
      const emailIssue = identity.emailProblem(email);
      if (emailIssue) return sendJson(res, 400, { error: emailIssue });
      const other = db.userByEmail(email);
      if (other && other.id !== user.id) return sendJson(res, 409, { error: 'البريد الإلكتروني مستخدم بالفعل' });
      updates.email = email;
    } else { updates.email = null; }
  }
  if (body.phone !== undefined) {
    const raw = String(body.phone || '').trim();
    if (raw) {
      const phone = normalizePhone(raw);
      if (!phone) return sendJson(res, 400, { error: 'رقم الهاتف غير صحيح' });
      const other = db.userByPhone(phone);
      if (other && other.id !== user.id) return sendJson(res, 409, { error: 'رقم الهاتف مستخدم بالفعل' });
      updates.phone = phone;
    } else { updates.phone = null; }
  }
  const nextEmail = updates.email !== undefined ? updates.email : user.email;
  const nextPhone = updates.phone !== undefined ? updates.phone : user.phone;
  if (!nextEmail && !nextPhone) return sendJson(res, 400, { error: 'لازم يكون فيه بريد إلكتروني أو رقم هاتف على الأقل' });
  if (updates.name !== undefined) db.setName(user.id, updates.name || null);
  if (updates.email !== undefined) db.setEmail(user.id, updates.email);
  if (updates.phone !== undefined) db.setPhone(user.id, updates.phone);
  db.audit(user.id, 'profile_updated', ip);
  const fresh = db.userById(user.id);
  return sendJson(res, 200, { ok: true, user: { id: fresh.id, email: fresh.email, phone: fresh.phone, name: fresh.name, verified: !!fresh.verified, emailVerified: !!fresh.verified, phoneVerified: !!fresh.phone_verified, created_at: fresh.created_at } });
}

// POST /api/account/password -> change password (requires current password).
async function changePassword(req, res, ip) {
  const user = requireUser(req, res); if (!user) return;
  // The tightest limit in the file: this endpoint verifies the current password.
  if (throttled(res, 'password', user.id, 10, 900000)) return;
  let body; try { body = await readJsonBody(req); } catch (_) { return sendJson(res, 400, { error: 'طلب غير صالح' }); }
  body = body || {};
  const current = String(body.current || '');
  const next = String(body.next || body.password || '');
  if (!auth.verifyPassword(current, user.pass_salt, user.pass_hash)) {
    return sendJson(res, 403, { error: 'كلمة المرور الحالية غير صحيحة' });
  }
  const problem = auth.passwordProblem(next);
  if (problem) return sendJson(res, 400, { error: problem });
  const { hash, salt } = auth.hashPassword(next);
  db.setPassword(user.id, hash, salt); // also bumps token_version -> revokes old sessions
  db.audit(user.id, 'password_changed', ip);
  // Keep the current device signed in with a token matching the new version.
  const fresh = db.userById(user.id);
  const token = auth.issueToken(fresh.id, fresh.token_version);
  res.setHeader('Set-Cookie', serializeCookie('ef_session', token, { maxAge: auth.SESSION_TTL, httpOnly: true, sameSite: 'Lax', secure: SECURE_COOKIES }));
  return sendJson(res, 200, { ok: true });
}

// POST /api/account/logout-all -> revoke every other device's session.
// Sessions are stateless signed tokens carrying the user's token_version, so
// bumping that version invalidates every token already issued. The calling
// device gets a fresh cookie so the person who asked for it stays signed in.
async function logoutAllDevices(req, res, ip) {
  const user = requireUser(req, res); if (!user) return;
  db.db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(user.id);
  db.audit(user.id, 'logout_all_devices', ip);
  const fresh = db.userById(user.id);
  const token = auth.issueToken(fresh.id, fresh.token_version);
  res.setHeader('Set-Cookie', serializeCookie('ef_session', token, { maxAge: auth.SESSION_TTL, httpOnly: true, sameSite: 'Lax', secure: SECURE_COOKIES }));
  return sendJson(res, 200, { ok: true });
}

module.exports = { exportData, deleteAccount, updateProfile, changePassword, logoutAllDevices };
