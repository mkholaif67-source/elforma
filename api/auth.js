'use strict';
// /api/auth/* — signup, login, logout, me.
const db = require('../lib/db');
const auth = require('../lib/auth');
const { sendJson, readJsonBody, parseCookies, serializeCookie, isEmail, normalizePhone } = require('../lib/util');
const mailer = require('../lib/mailer');
const crypto = require('crypto');
const { httpsJson } = require('../lib/pay-providers');
const cfg = require('../lib/config');
const { rateLimit, isLocked, lockRemaining, registerFailure, clearFailures } = require('../lib/rateLimit');
const commerce = require('../lib/commerce');
const prefs = require('../lib/user-prefs');
// [OWNER-RULE] إيميلات رسمية معروفة فقط (ممنوع المؤقت) + فحص اسم المستخدم.
const identity = require('../lib/identity-policy');

/* [FIX H5 — كوكي الجلسة ماكانش عليها Secure]
   المثبت بالدليل: الرد كان بيرجع
   ef_session=...; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax
   من غير Secure. السبب: العلم كان مربوط بـ EF_ENV==='production'،
   ولو حد نسي يظبط EF_ENV على السيرفر تبقى كل الجلسات قابلة للإرسال
   على HTTP عادي (سرقة جلسة على واي فاي عام). الإعداد الآمن لازم يكون
   هو الافتراضي، والخروج عنه يبقى قرار صريح.

   دلوقتي: Secure مفعّل دايمًا، إلا لو حد حط EF_INSECURE_COOKIES=1 بإيده
   (للتطوير المحلي على http بس). ملحوظة: المتصفحات بتقبل كوكي Secure
   على localhost/127.0.0.1 حتى فوق http، فالتطوير المحلي مابيتأثرش. */
const SECURE_COOKIES = process.env.EF_INSECURE_COOKIES !== '1';
const PROD = process.env.EF_ENV === 'production';

function setSession(res, userId, tokenVersion) {
  const token = auth.issueToken(userId, tokenVersion);
  res.setHeader('Set-Cookie', serializeCookie('ef_session', token, {
    maxAge: auth.SESSION_TTL, httpOnly: true, sameSite: 'Lax', secure: SECURE_COOKIES
  }));
}

function publicUser(u) {
  return { id: u.id, email: u.email, phone: u.phone, name: u.name, verified: !!u.verified, emailVerified: !!u.verified, phoneVerified: !!u.phone_verified, created_at: u.created_at };
}

async function signup(req, res, ip) {
  if (!rateLimit('signup:' + ip, 10, 60000)) return sendJson(res, 429, { error: 'محاولات كتيرة جرب بعد شوية' });
  // نفس القفل بيطبق على التسجيل عشان ماحدش يفتح حسابات وهمية بالجملة
  if (isLocked('lock:ip:' + ip)) {
    return sendJson(res, 429, { error: 'قفلنا المحاولات مؤقتا جرب بعد شوية' });
  }
  const body = await readJsonBody(req);
  const emailRaw = String(body.email || '').trim().toLowerCase();
  const email = emailRaw || null;
  const phone = normalizePhone(body.phone);
  const name = body.name ? identity.cleanName(body.name) : null;
  if (!email && !phone) return sendJson(res, 400, { error: 'أدخل بريدا إلكترونيا أو رقم هاتف' });
  // [OWNER-RULE] البريد لازم يكون من مزود رسمي معروف، وممنوع البريد المؤقت.
  if (email) {
    const emailIssue = identity.emailProblem(email);
    if (emailIssue) return sendJson(res, 400, { error: emailIssue });
  }
  // [OWNER-RULE] فحص اسم المستخدم (طول، رموز، أسماء محجوزة، عبث).
  if (body.name !== undefined && body.name !== null && String(body.name).trim() !== '') {
    const nameIssue = identity.nameProblem(body.name);
    if (nameIssue) return sendJson(res, 400, { error: nameIssue });
  }
  if (body.phone && !phone) return sendJson(res, 400, { error: 'رقم الهاتف غير صحيح' });
  const pwProblem = auth.passwordProblem(body.password);
  if (pwProblem) return sendJson(res, 400, { error: pwProblem });
  if (email && db.userByEmail(email)) return sendJson(res, 409, { error: 'البريد مسجل بالفعل' });
  // منع فتح 10 حسابات من نفس الإيميل بنقط أو +tag (وتكرار التجربة المجانية).
  if (email) {
    const canon = identity.canonicalEmail(email);
    if (canon !== email && db.userByEmail(canon)) {
      return sendJson(res, 409, { error: 'البريد مسجل بالفعل' });
    }
  }
  if (phone && db.userByPhone(phone)) return sendJson(res, 409, { error: 'رقم الهاتف مسجل بالفعل' });
  const { hash, salt } = auth.hashPassword(body.password);
  const id = db.createUser(email, phone, name, hash, salt);
  db.audit(id, 'signup', ip);
  db.touchLogin(id);
  // [OWNER-RULE] كل حساب جديد ياخد تلقائيًا تجربة 3 أيام Full Access من لحظة
  // إنشاء الحساب — بدون رقم هاتف / تأكيد هاتف / OTP / بطاقة دفع / أي خطوة إضافية.
  // التجربة مش Package يختارها المستخدم؛ بتتفعّل هنا مباشرة وتبدأ مدتها من دلوقتي.
  // commerce.startTrial بيمنع تكرار التفعيل لنفس الحساب (لو عنده اشتراك بالفعل
  // يرجّع already_subscribed). أي فشل هنا لا يوقف عملية التسجيل نفسها.
  // [FIX] التجربة مرة واحدة للأبد: لو نفس الإيميل/الهاتف/الجهاز أخد تجربة قبل
  // كده (حتى لو الحساب القديم اتقفل)، الحساب الجديد يفضل free من غير تجربة.
  let trial = null;
  const trialVia = prefs.trialUsedBy({ email: email, phone: phone, deviceId: body.deviceId });
  if (trialVia) {
    trial = { ok: false, error: 'trial_already_used', via: trialVia };
  } else {
    try {
      trial = commerce.startTrial(id);
      if (trial && trial.ok) {
        db.audit(id, 'trial_started', ip);
        try { prefs.recordTrial(id, phone, trial.current_period_end, { email: email, deviceId: body.deviceId }); } catch (_) {}
        try { db.syncNow(); } catch (_) {}
      }
    } catch (e) { console.error('[signup] trial not granted:', e.message); }
  }
  setSession(res, id, 0);
  // تأكيد الإيميل تلقائيًا عند التسجيل (لو فيه إيميل)
  if (email) {
    try {
      const token = mailer.createToken(id, 'verify', 86400);
      const verifyUrl = cfg.APP.base_url.replace(/\/$/, '') + '/verify-email.html?token=' + token;
      mailer.sendVerify(db.userById(id), verifyUrl);
    } catch (e) { console.error('[signup] verify email failed:', e.message); }
  }
  return sendJson(res, 201, { user: publicUser(db.userById(id)), trial: trial, emailVerificationSent: !!email });
}

async function login(req, res, ip) {
  if (!rateLimit('login:' + ip, 20, 60000)) return sendJson(res, 429, { error: 'محاولات كتيرة جرب بعد شوية' });
  // قفل بعد 8 محاولات فاشلة من نفس الـ IP
  // ده اللي بيوقف محاولات تخمين الباسورد بالجملة
  if (isLocked('lock:ip:' + ip)) {
    return sendJson(res, 429, { error: 'قفلنا المحاولات مؤقتا جرب بعد ' + Math.ceil(lockRemaining('lock:ip:' + ip) / 60) + ' دقيقة' });
  }
  const body = await readJsonBody(req);
  const identifier = String(body.identifier || body.email || body.phone || '').trim();
  let user = null;
  if (identifier.indexOf('@') >= 0) {
    user = db.userByEmail(identifier.toLowerCase());
  } else {
    const phone = normalizePhone(identifier);
    if (phone) user = db.userByPhone(phone);
    if (!user) user = db.userByEmail(identifier.toLowerCase());
  }
  const ok = user && auth.verifyPassword(body.password || '', user.pass_salt, user.pass_hash);
  if (!user || !ok) {
    db.audit(user ? user.id : null, 'login_fail', ip);
    registerFailure('lock:ip:' + ip);
    if (user) registerFailure('lock:user:' + user.id);
    return sendJson(res, 401, { error: 'بيانات الدخول غير صحيحة' });
  }
  // دخول ناجح يمسح عداد الفشل عشان المستخدم العادي مايتقفلش أبدا
  clearFailures('lock:ip:' + ip);
  clearFailures('lock:user:' + user.id);
  db.touchLogin(user.id);
  db.audit(user.id, 'login', ip);
  setSession(res, user.id, user.token_version);
  return sendJson(res, 200, { user: publicUser(user) });
}

// POST /api/auth/google — دخول/تسجيل مباشر بحساب جوجل.
// التطبيق بيبعت idToken من Google Sign-In، والسيرفر
// بيتحقق منه عند جوجل ثم يلاقي الحساب أو ينشئه (بإيميل
// موثّق من جوجل). الربط (GOOGLE_CLIENT_ID) اختياري ويقدر
// صاحب المشروع يضيفه لاحقًا لتقييد التطبيق المسموح.
async function googleAuth(req, res, ip) {
  if (!rateLimit('google:' + ip, 20, 60000)) return sendJson(res, 429, { error: 'محاولات كتيرة جرب بعد شوية' });
  if (isLocked('lock:ip:' + ip)) return sendJson(res, 429, { error: 'قفلنا المحاولات مؤقتا جرب بعد شوية' });
  const body = await readJsonBody(req);
  const idToken = String(body.idToken || body.credential || '').trim();
  if (!idToken) return sendJson(res, 400, { error: 'رمز جوجل مفقود' });
  let info;
  try {
    info = await httpsJson('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
  } catch (e) {
    return sendJson(res, 401, { error: 'تعذر التحقق من حساب جوجل' });
  }
  const email = String((info && info.email) || '').trim().toLowerCase();
  const emailVerified = info && (info.email_verified === true || info.email_verified === 'true');
  if (!email || !emailVerified) return sendJson(res, 401, { error: 'حساب جوجل غير صالح' });
  // لو صاحب المشروع ربط GOOGLE_CLIENT_ID نتأكد إن الرمز لتطبيقنا.
  const wantAud = process.env.GOOGLE_CLIENT_ID || '';
  if (wantAud && String((info && info.aud) || '') !== wantAud) {
    return sendJson(res, 401, { error: 'تطبيق جوجل غير معروف' });
  }
  let user = db.userByEmail(email);
  if (!user) {
    const canon = identity.canonicalEmail(email);
    if (canon !== email && db.userByEmail(canon)) user = db.userByEmail(canon);
  }
  let created = false;
  if (!user) {
    let name = null;
    try { const raw = body.name || (info && info.name) || ''; name = raw ? identity.cleanName(raw) : null; } catch (_) { name = null; }
    // كلمة مرور عشوائية قوية — الدخول بيتم عبر جوجل مش بيها.
    const { hash, salt } = auth.hashPassword(crypto.randomBytes(24).toString('hex') + 'Aa1');
    const id = db.createUser(email, null, name, hash, salt);
    try { db.setVerified(id); } catch (_) {}
    user = db.userById(id);
    created = true;
  } else if (!user.verified) {
    try { db.setVerified(user.id); user = db.userById(user.id); } catch (_) {}
  }
  clearFailures('lock:ip:' + ip);
  db.touchLogin(user.id);
  db.audit(user.id, created ? 'signup_google' : 'login_google', ip);
  // [OWNER-RULE] حساب جوجل الجديد ياخد نفس تجربة الـ3 أيام تلقائيًا زي التسجيل العادي.
  let gTrial = null;
  if (created) {
    const gVia = prefs.trialUsedBy({ email: email, phone: user.phone, deviceId: body.deviceId });
    if (gVia) {
      gTrial = { ok: false, error: 'trial_already_used', via: gVia };
    } else {
      try {
        gTrial = commerce.startTrial(user.id);
        if (gTrial && gTrial.ok) {
          db.audit(user.id, 'trial_started', ip);
          try { prefs.recordTrial(user.id, user.phone, gTrial.current_period_end, { email: email, deviceId: body.deviceId }); } catch (_) {}
          try { db.syncNow(); } catch (_) {}
        }
      } catch (e) { console.error('[googleAuth] trial not granted:', e.message); }
    }
  }
  setSession(res, user.id, user.token_version || 0);
  return sendJson(res, created ? 201 : 200, { user: publicUser(user), trial: gTrial });
}

async function logout(req, res) {
  // [FIX H5] نفس العلم لازم يكون على كوكي المسح كمان، وإلا المتصفح مايعتبرهاش
  // نفس الكوكي ومايمسحهاش.
  res.setHeader('Set-Cookie', serializeCookie('ef_session', '', { maxAge: 0, httpOnly: true, sameSite: 'Lax', secure: SECURE_COOKIES }));
  return sendJson(res, 200, { ok: true });
}

// Server-side entitlement: the single source of truth (handles expiry).
function subActive(sub) {
  if (!sub || !sub.plan || sub.plan === 'free') return false;
  if (sub.status !== 'active' && sub.status !== 'trialing') return false;
  if (sub.current_period_end) {
    const end = Date.parse(sub.current_period_end);
    if (Number.isFinite(end) && end <= Date.now()) return false; // expired
  }
  return true;
}

async function me(req, res) {
  const user = auth.currentUser(parseCookies(req));
  if (!user) return sendJson(res, 200, { user: null });
  const raw = db.getSubscription(user.id) || { plan: 'free', status: 'active' };
  const active = subActive(raw);
  // Never trust the client: expose a computed entitlement + effective plan.
  const subscription = Object.assign({}, raw, { active: active, plan: active ? raw.plan : 'free' });
  return sendJson(res, 200, { user: publicUser(user), subscription: subscription });
}

module.exports = { signup, login, googleAuth, logout, me };
