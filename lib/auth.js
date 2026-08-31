'use strict';
// Authentication: scrypt password hashing + stateless signed session tokens.
// Uses only node:crypto (no external deps).
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const DATA_DIR = process.env.EF_DATA_DIR || path.join(__dirname, '..', 'data');

// Server secret used to sign session tokens. Prefer env; otherwise persist one.
function loadSecret() {
  if (process.env.EF_SECRET && process.env.EF_SECRET.length >= 16) return process.env.EF_SECRET;

  // [FIX — تسجيل الخروج التلقائي على استضافة بملفات مؤقتة زي Render المجاني]
  // السبب المثبت: من غير EF_SECRET ثابت، الكود كان بيولّد سرًّا عشوائيًا ويحاول
  // يحفظه في ملف .secret جوه DATA_DIR. بس ملفات Render المجانية بتتمسح مع كل
  // إعادة تشغيل/نوم/نشر، فكل إقلاع بيطلع سر جديد → توقيع الجلسات يتغيّر →
  // كل المستخدمين يتسجّلوا خروج (وده بالظبط «بينسى الحساب ويقفل بسرعة»).
  //
  // الحل من غير ما صاحب المشروع يضطر يضبط أي حاجة: لو Turso متظبّط، نشتق سرًّا
  // ثابتًا من بيانات Turso — دي متغيّرات بيئة ثابتة بتعيش عبر كل إعادة تشغيل،
  // فالسر بيفضل هو هو والجلسات تكمل. (لو ظبطت EF_SECRET صراحةً يفضل هو الأولوية).
  const tursoSeed = String(process.env.TURSO_DATABASE_URL || '') + '|' + String(process.env.TURSO_AUTH_TOKEN || '');
  if (tursoSeed.length >= 24) {
    return crypto.createHmac('sha256', 'elforma-session-secret-v1').update(tursoSeed).digest('hex');
  }

  // No env secret: derive one ONCE and persist it next to the database, on the
  // same volume. This is what keeps people logged in across deploys without
  // anyone having to manage a secret by hand.
  //
  // The old behaviour threw in production, which pushed operators toward a
  // platform-generated secret -- and a secret regenerated on each deploy signs
  // sessions with a new key every release, silently logging out every user.
  // Persisting beats regenerating, so this path is now allowed in production
  // provided the storage is durable (see the guard below).
  const p = path.join(DATA_DIR, '.secret');
  try {
    const existing = fs.readFileSync(p, 'utf8').trim();
    if (existing.length >= 16) return existing;
  } catch (_) {}

  const s = crypto.randomBytes(48).toString('hex');
  let persisted = false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(p, s, { mode: 0o600 });
    // Read it back: a write that silently failed (read-only or ephemeral mount)
    // must not be mistaken for durable storage.
    persisted = fs.readFileSync(p, 'utf8').trim() === s;
  } catch (_) {}

  if (!persisted && process.env.EF_ENV === 'production') {
    // Nothing durable to fall back on. Failing loudly at boot is far better
    // than running a server that logs everyone out on the next restart.
    throw new Error(
      'Cannot persist the session secret to ' + p + '. Mount a persistent disk ' +
      'at EF_DATA_DIR, or set a stable EF_SECRET (>= 16 chars).'
    );
  }
  if (!persisted) {
    console.warn('[auth] session secret is in memory only \u2014 sessions will end on restart.');
  }
  return s;
}
const SECRET = loadSecret();
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days (seconds)

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, expectedHash) {
  const actual = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function sign(payloadStr) {
  return b64url(crypto.createHmac('sha256', SECRET).update(payloadStr).digest());
}

// token = base64url(json).base64url(sig)
function issueToken(userId, tokenVersion) {
  const payload = { uid: userId, tv: (tokenVersion || 0), exp: Math.floor(Date.now() / 1000) + SESSION_TTL, iat: Math.floor(Date.now() / 1000) };
  const body = b64url(JSON.stringify(payload));
  return body + '.' + sign(body);
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(fromB64url(body).toString('utf8')); } catch (_) { return null; }
  if (!payload || !payload.uid || !payload.exp) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// Resolve the authenticated user from the request cookie. Returns user row or null.
function currentUser(cookies) {
  const token = cookies && cookies.ef_session;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = db.userById(payload.uid);
  if (!user) return null;
  // Reject tokens issued before the latest credential change (revocation).
  if ((payload.tv || 0) !== (user.token_version || 0)) return null;
  return user;
}

/* [FIX H1 — سياسة كلمة المرور كانت ضعيفة]
   المثبت بالدليل: التسجيل بـ "password" و"12345678" و"aaaaaaaa" كلهم رجعوا 201.
   الفحص القديم كان طول بس (>= 8).

   السياسة الجديدة من غير أي مكتبة خارجية:
     • 10 حروف على الأقل (NIST 800-63B بيوصي بـ 8 كحد أدنى، وإحنا فوقه).
     • حرف ورقم على الأقل (مش تعقيد زائد، بس بيقتل "12345678901" و"abcdefghij").
     • قائمة حظر محلية للأكثر شيوعًا عالميًا وفي مصر/العالم العربي.
     • رفض التكرار المطلق (aaaaaaaaaa) والتسلسل المباشر (1234567890 / abcdefghij).
   مفيش إجبار على رموز غريبة ولا تغيير دوري، لأن دول بيقللوا الأمان عمليًا. */
const MIN_PASSWORD_LENGTH = 10;

// قائمة حظر مختصرة ومحلية (صفر تبعيات). مقارنة بحروف صغيرة.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234',
  'p@ssword12', 'p@ssw0rd12', 'passw0rd123', 'mypassword', 'mypassword1',
  '1234567890', '12345678901', '123456789012', '0123456789', '1122334455',
  '1234512345', '11111111111', '0000000000', '1234abcd12',
  'qwertyuiop', 'qwerty12345', 'qwerty123456', 'asdfghjkl1', 'zxcvbnm123',
  '1q2w3e4r5t', 'qazwsxedc1', 'abcd1234567', 'abcdefghij',
  'iloveyou12', 'iloveyou123', 'letmein1234', 'welcome1234', 'admin12345',
  'administrator', 'football123', 'superman123', 'trustno1234', 'sunshine12',
  'princess123', 'starwars123', 'monkey12345', 'dragon12345', 'master12345',
  'ahmed12345', 'mohamed1234', 'mahmoud1234', 'mostafa1234', 'mustafa1234',
  'abdallah123', 'islam123456', 'khaled12345', 'hassan12345', 'hussein123',
  'egypt123456', 'masr123456', 'cairo123456', 'zamalek1234', 'ahly1234567',
  'elforma123', 'elforma1234', 'forma123456', 'fitness1234', 'gym123456789',
]);

// تسلسل مباشر طويل (طالع أو نازل) زي 1234567890 أو abcdefghij.
function isSequential(pw) {
  if (pw.length < 6) return false;
  let up = true, down = true;
  for (let i = 1; i < pw.length; i++) {
    const d = pw.charCodeAt(i) - pw.charCodeAt(i - 1);
    if (d !== 1) up = false;
    if (d !== -1) down = false;
    if (!up && !down) return false;
  }
  return up || down;
}

function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD_LENGTH) {
    return 'كلمة المرور لازم تكون ' + MIN_PASSWORD_LENGTH + ' أحرف على الأقل';
  }
  if (pw.length > 200) return 'كلمة المرور طويلة جدا';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return 'كلمة المرور لازم تحتوي على حروف وأرقام';
  }
  if (/^(.)\1+$/.test(pw)) {
    return 'كلمة المرور دي حرف مكرر — سهلة التخمين';
  }
  if (isSequential(pw)) {
    return 'كلمة المرور تسلسل مباشر — سهلة التخمين';
  }
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) {
    return 'كلمة المرور دي مشهورة جدًا وموجودة في قوائم التخمين — اختار واحدة تانية';
  }
  return null;
}

// Server-side entitlement check. Single source of truth for "is this
// subscription currently usable", mirroring api/auth.js#subActive so the two
// can never drift apart. Exported so route guards do not re-implement it.
function subActive(sub) {
  if (!sub || !sub.plan || sub.plan === 'free') return false;
  if (sub.status !== 'active' && sub.status !== 'trialing') return false;
  if (sub.current_period_end) {
    const end = Date.parse(sub.current_period_end);
    if (Number.isFinite(end) && end <= Date.now()) return false; // expired
  }
  return true;
}

// Route guard helper.
//   checkAccess(cookies)                 -> requires a signed-in user
//   checkAccess(cookies, { paid: true }) -> also requires an active subscription
// Returns null when the request may proceed, or { status, error } to send back.
// It deliberately does NOT throw, so a caller can inline it in a route table.
function checkAccess(cookies, opts) {
  const options = opts || {};
  const user = currentUser(cookies);
  if (!user) return { status: 401, error: 'unauthenticated' };
  if (options.paid) {
    const sub = db.getSubscription(user.id) || { plan: 'free', status: 'active' };
    if (!subActive(sub)) return { status: 402, error: 'subscription_required' };
  }
  return null;
}

module.exports = {
  SESSION_TTL, MIN_PASSWORD_LENGTH,
  hashPassword, verifyPassword, issueToken, verifyToken, currentUser, passwordProblem,
  subActive, checkAccess
};
