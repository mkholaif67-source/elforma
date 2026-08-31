'use strict';
// api/share.js — مشاركة الخطة الغذائية/التدريبية برابط مؤقت
// POST /api/share/plan   → ينشئ رابط مشاركة (باقة مدفوعة نشطة فقط)
// GET  /api/share/:token → يجلب الخطة للمشاركة (بدون login)
//
// [مدة الرابط — إصلاح M3] التوثيق كان بيقول 48 ساعة والفعلي كان سنة كاملة.
// المعتمد دلوقتي: الرابط ينتهي مع نهاية الاشتراك، ولو مفيش تاريخ انتهاء
// مسجل يبقى 30 يوم كحد أقصى (مش 365).
const crypto  = require('crypto');
const db      = require('../lib/db');
const auth    = require('../lib/auth');
const { sendJson, readJsonBody, parseCookies } = require('../lib/util');

function _user(req, res) {
  const u = auth.currentUser(parseCookies(req));
  if (!u) sendJson(res, 401, { error: 'unauthenticated' });
  return u;
}

async function createShare(req, res) {
  const u = _user(req, res);
  if (!u) return;
  try {
    // [FIX C1 + C2 — بوابة المشاركة]
    // الكود القديم كان بيمنع مستخدم التجربة بس، فالمستخدم المجاني تمامًا
    // كان بيقدر يطلع رابط مشاركة لخطته ويوزّعها. دلوقتي القاعدة واحدة
    // ومطبقة بـ allowlist: المشاركة/التصدير = باقة مدفوعة نشطة فقط
    // (مش مجاني، ومش تجربة) — وده نفس اللي بيعلنه canExport في bootstrap.
    const sub = db.getSubscription(u.id) || {};
    const isTrial = (sub.plan === 'trial') || (sub.status === 'trialing');
    if (!auth.subActive(sub)) {
      return sendJson(res, 402, {
        error: 'مشاركة وتحميل الخطة متاحة للمشتركين بس. اشترك في أي باقة لتفعيل المشاركة.',
        code: 'subscription_required',
      });
    }
    if (isTrial) {
      return sendJson(res, 403, {
        error: 'تصدير وتحميل الخطة غير متاح خلال التجربة المجانية. اشترك في أي باقة مدفوعة لتفعيل التصدير.',
        code: 'trial_no_export',
      });
    }

    const body = await readJsonBody(req);
    const type = String(body.planType || 'both');
    if (!['nutrition','workout','both'].includes(type))
      return sendJson(res, 400, { error: 'planType must be nutrition|workout|both' });

    const planData = {};

    // خطة التمرين
    if (type === 'workout' || type === 'both') {
      const row = db.db.prepare(
        'SELECT plan_json FROM workout_plans WHERE user_id=? AND active=1 ORDER BY updated_at DESC LIMIT 1'
      ).get(u.id);
      if (row) planData.workout = JSON.parse(row.plan_json);
    }

    // بروفايل التغذية (الخطة محسوبة ديناميكياً — نشارك البروفايل)
    if (type === 'nutrition' || type === 'both') {
      const row = db.db.prepare(
        'SELECT profile_json FROM mobile_profiles WHERE user_id=?'
      ).get(u.id);
      if (row) planData.nutritionProfile = JSON.parse(row.profile_json);
    }

    if (!Object.keys(planData).length)
      return sendJson(res, 404, { error: 'لا توجد خطة محفوظة بعد' });

    const token   = crypto.randomBytes(24).toString('hex');
    // [OWNER-RULE + FIX M3] الرابط يفضل شغال بطول فترة الاشتراك.
    // لو مفيش تاريخ انتهاء مسجل، الاحتياطي بقى 30 يوم بدل 365:
    // رابط عام بيعيش سنة مخاطرة تسريب مالهاش لازمة.
    const SHARE_FALLBACK_DAYS = 30;
    const periodEnd = sub && sub.current_period_end ? Date.parse(sub.current_period_end) : NaN;
    const expiresMs = Number.isFinite(periodEnd) && periodEnd > Date.now()
      ? periodEnd
      : Date.now() + SHARE_FALLBACK_DAYS * 24 * 60 * 60 * 1000;
    const expires = new Date(expiresMs).toISOString();
    const now     = new Date().toISOString();

    db.db.prepare(
      `INSERT OR REPLACE INTO shared_plans(token,user_id,plan_type,plan_json,created_at,expires_at)
       VALUES(?,?,?,?,?,?)`
    ).run(token, u.id, type, JSON.stringify(planData), now, expires);

    // [FIX — Host header injection]
    // الرابط كان بيتبني من رأس Host اللي بيبعته العميل، يعني مهاجم يقدر
    // يخلي السيرفر يولّد روابط على دومين بتاعه ويبعتها للناس. دلوقتي
    // المصدر الوحيد هو EF_BASE_URL من إعدادات الخادم، ورأس Host بيتستخدم
    // فقط لو مفيش EF_BASE_URL (تطوير محلي).
    const base = shareBaseUrl(req);
    return sendJson(res, 200, {
      url: `${base}/share/${token}`,
      token,
      expires,
      planType: type,
    });
  } catch(e) {
    console.error('[share.create]', e);
    return sendJson(res, 500, { error: 'server_error' });
  }
}

// [FIX — Host header injection] مصدر واحد للحقيقة لعنوان الموقع.
function shareBaseUrl(req) {
  const configured = String(process.env.EF_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const host = req.headers.host || 'localhost';
  const proto = /^localhost|^127\.0\.0\.1|^\[::1\]/.test(host) ? 'http' : 'https';
  return `${proto}://${host}`;
}

// [FIX M7 — كتابة على القرص في كل طلب GET]
// الكود القديم كان بيعمل DELETE على كل قراءة لرابط مشاركة — كتابة
// في SQLite (كاتب واحد) مع كل طلب قراءة عام. دلوقتي التنظيف مرة كل ساعة
// كحد أقصى، والصلاحية بتتفلتر في الـ SELECT نفسه.
let _lastPurgeMs = 0;
function purgeExpiredShares() {
  const now = Date.now();
  if (now - _lastPurgeMs < 60 * 60 * 1000) return;
  _lastPurgeMs = now;
  try {
    db.db.prepare("DELETE FROM shared_plans WHERE datetime(expires_at) < datetime('now')").run();
  } catch (e) { console.error('[share.purge]', e.message); }
}

async function getShare(req, res, token) {
  if (!token || token.length > 80)
    return sendJson(res, 400, { error: 'invalid_token' });
  try {
    purgeExpiredShares();

    // الصلاحية بتتفحص في الاستعلام نفسه بـ datetime() (مقارنة زمنية حقيقية،
    // مش مقارنة نصوص بين "2027-08-15T..Z" و"2027-08-15 ..").
    const row = db.db.prepare(
      "SELECT * FROM shared_plans WHERE token=? AND datetime(expires_at) > datetime('now')"
    ).get(token);
    if (!row) return sendJson(res, 404, { error: 'الرابط غير موجود أو انتهت صلاحيته' });

    const userRow = db.db.prepare('SELECT name FROM users WHERE id=?').get(row.user_id);
    return sendJson(res, 200, {
      sharedBy:  userRow ? userRow.name : 'متدرب ElForma',
      planType:  row.plan_type,
      plan:      JSON.parse(row.plan_json),
      expiresAt: row.expires_at,
    });
  } catch(e) {
    console.error('[share.get]', e);
    return sendJson(res, 500, { error: 'server_error' });
  }
}

module.exports = { createShare, getShare };
