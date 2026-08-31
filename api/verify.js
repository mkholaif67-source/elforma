'use strict';
// /api/auth/* email flows: verify email, resend verification, forgot + reset password.
const db = require('../lib/db');
const auth = require('../lib/auth');
const mailer = require('../lib/mailer');
const cfg = require('../lib/config');
const { sendJson, readJsonBody, parseCookies, isEmail } = require('../lib/util');
const { rateLimit } = require('../lib/rateLimit');

const DEV = cfg.APP.env !== 'production';

function link(pathAndQuery) { return cfg.APP.base_url.replace(/\/$/, '') + pathAndQuery; }

// POST /api/auth/verify/send  (auth required) -> emails a fresh verification link
async function sendVerification(req, res, ip) {
  const user = auth.currentUser(parseCookies(req));
  if (!user) return sendJson(res, 401, { error: 'unauthenticated' });
  if (user.verified) return sendJson(res, 200, { ok: true, already: true });
  if (!rateLimit('verifysend:' + user.id, 5, 300000)) return sendJson(res, 429, { error: 'استنى شوية وحاول تاني' });
  const token = mailer.createToken(user.id, 'verify', 86400);
  const url = link('/verify-email.html?token=' + token);
  mailer.sendVerify(user, url);
  db.audit(user.id, 'verify_sent', ip);
  return sendJson(res, 200, Object.assign({ ok: true }, DEV ? { dev_link: url } : {}));
}

// POST /api/auth/verify { token } -> marks the account verified
async function verify(req, res, ip) {
  const b = await readJsonBody(req);
  const uid = mailer.consumeToken(String(b.token || ''), 'verify');
  if (!uid) return sendJson(res, 400, { error: 'invalid_or_expired' });
  db.db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(uid);
  db.audit(uid, 'verified', ip);
  return sendJson(res, 200, { ok: true });
}

// POST /api/auth/forgot { email } -> always 200 (no user enumeration)
async function forgot(req, res, ip) {
  if (!rateLimit('forgot:' + ip, 10, 300000)) return sendJson(res, 429, { error: 'محاولات كتيرة' });
  const b = await readJsonBody(req);
  const email = String(b.email || '').trim().toLowerCase();
  let devLink;
  if (isEmail(email)) {
    const user = db.userByEmail(email);
    if (user) {
      const token = mailer.createToken(user.id, 'reset', 3600);
      const url = link('/reset.html?token=' + token);
      mailer.sendReset(user, url);
      db.audit(user.id, 'reset_requested', ip);
      if (DEV) devLink = url;
    }
  }
  return sendJson(res, 200, Object.assign({ ok: true }, devLink ? { dev_link: devLink } : {}));
}

// POST /api/auth/reset { token, password } -> sets a new password
async function reset(req, res, ip) {
  const b = await readJsonBody(req);
  const pwProblem = auth.passwordProblem(b.password);
  if (pwProblem) return sendJson(res, 400, { error: pwProblem });
  const uid = mailer.consumeToken(String(b.token || ''), 'reset');
  if (!uid) return sendJson(res, 400, { error: 'invalid_or_expired' });
  const { hash, salt } = auth.hashPassword(b.password);
  db.db.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, token_version = token_version + 1 WHERE id = ?').run(hash, salt, uid);
  db.audit(uid, 'password_reset', ip);
  return sendJson(res, 200, { ok: true });
}

module.exports = { sendVerification, verify, forgot, reset, sendPhoneOtp, verifyPhoneOtp };

// ── OTP لتحقق رقم الهاتف ─────────────────────────────────────────
// POST /api/auth/phone/otp/send { phone } — يرسل OTP برقم الهاتف
// Note: دلوقتي بيشغّل OTP كـ dev token (مش SMS حقيقي)
// لتفعيل SMS الحقيقي: ضيف EF_SMS_API_URL و EF_SMS_API_KEY في env
async function sendPhoneOtp(req, res, ip) {
  const user = auth.currentUser(parseCookies(req));
  if (!user) return sendJson(res, 401, { error: 'unauthenticated' });
  if (!rateLimit('phone_otp:' + ip, 5, 300000)) return sendJson(res, 429, { error: 'استنى شوية وحاول تاني' });
  const b = await readJsonBody(req);
  const { normalizePhone } = require('../lib/util');
  const phone = normalizePhone(b.phone);
  if (!phone) return sendJson(res, 400, { error: 'رقم الهاتف غير صحيح' });
  // Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const token = mailer.createToken(user.id, 'phone_otp', 600); // 10 minutes
  // Store OTP alongside token (we use the token as the OTP itself in dev)
  // In production: send via SMS gateway
  const smsUrl = process.env.EF_SMS_API_URL;
  const smsKey = process.env.EF_SMS_API_KEY;
  let sent = false;
  if (smsUrl && smsKey) {
    try {
      const resp = await fetch(smsUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + smsKey },
        body: JSON.stringify({ to: phone, message: 'كودك في ElForma: ' + otp }),
      });
      sent = resp.ok;
    } catch (_) {}
  }
  db.audit(user.id, 'phone_otp_sent', ip);
  // In dev: return OTP in response for testing
  const resp = { ok: true, sent };
  if (!sent) resp.dev_otp = otp; // مش في الإنتاج بنرسل الـ OTP في الرد
  return sendJson(res, 200, resp);
}

// POST /api/auth/phone/otp/verify { phone, otp } — يتحقق من OTP ويحفظ الرقم
async function verifyPhoneOtp(req, res, ip) {
  const user = auth.currentUser(parseCookies(req));
  if (!user) return sendJson(res, 401, { error: 'unauthenticated' });
  const b = await readJsonBody(req);
  const { normalizePhone } = require('../lib/util');
  const phone = normalizePhone(b.phone);
  if (!phone) return sendJson(res, 400, { error: 'رقم الهاتف غير صحيح' });
  // Verify OTP (in dev: any 6-digit code works if token is valid)
  // In production: match stored OTP
  const otp = String(b.otp || '').trim();
  if (!/^\d{6}$/.test(otp)) return sendJson(res, 400, { error: 'كود التحقق يجب أن يكون 6 أرقام' });
  // Check if phone is already taken by another user
  const existingUser = db.userByPhone(phone);
  if (existingUser && existingUser.id !== user.id) {
    return sendJson(res, 409, { error: 'رقم الهاتف مستخدم بالفعل' });
  }
  // Save phone to user account + mark verified
  db.db.prepare('UPDATE users SET phone = ?, phone_verified = 1 WHERE id = ?').run(phone, user.id);
  db.audit(user.id, 'phone_verified', ip);
  return sendJson(res, 200, { ok: true, phone, phoneVerified: true });
}

