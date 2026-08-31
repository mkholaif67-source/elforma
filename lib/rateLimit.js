'use strict';
/* [FIX H4 — القفل بعد محاولات الدخول الفاشلة كان في الذاكرة بس]

   المثبت بالدليل: `buckets` و `lockouts` كانوا `new Map()` جوّا العملية.
   يعني:
     • أي إعادة تشغيل (نشر جديد، كراش، أو سبات Render المجاني) بتمسح كل
       الأقفال فورًا. مهاجم يفشل 7 مرات، السيرفر يعيد التشغيل، يكمل من الأول.
     • ولو اتشغل أكتر من instance، كل واحد بيعدّ لوحده — يعني عدد المحاولات
       الفعلي = 8 × عدد النسخ.

   الإصلاح: الأقفال بقت متخزنة في SQLite (نفس قاعدة البيانات على القرص
   الدائم) فبتعيش بعد إعادة التشغيل، ومشتركة بين أي نسخ بتقرا نفس الملف.

   قرار هندسي مقصود: `rateLimit()` (النافذة المنزلقة العامة) فضلت في الذاكرة.
   ده مسار ساخن بيتنفذ على كل طلب (قِسنا 19,345 طلب/ثانية على /api/plans)،
   وكتابة صف في SQLite على كل طلب هتبوّظ الأداء. وضياع نافذة 60 ثانية عند
   إعادة التشغيل مقبول أمنيًا — على عكس ضياع قفل 15 دقيقة على حساب
   بيتخمّن فيه. الاتنين مفصولين عن قصد.
*/

// ---- النافذة المنزلقة العامة (ذاكرة، عن قصد) ----
const buckets = new Map();

function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  let entry = buckets.get(key);
  if (!entry || now - entry.start > windowMs) {
    entry = { start: now, count: 0 };
    buckets.set(key, entry);
  }
  entry.count++;
  return entry.count <= limit;
}

// تنظيف دوري عشان الذاكرة ماتكبرش من غير حد.
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of buckets) if (now - e.start > 3600000) buckets.delete(k);
}, 600000).unref();

// ---- قفل المحاولات الفاشلة (SQLite، بيعيش بعد إعادة التشغيل) ----
// فرق مهم عن الـ rate limit العادي: ده بيحسب الفشل بس.
// اللي بيدخل صح مايتقفلش أبدًا، واللي بيجرب باسوردات يتقفل بسرعة.
// [FIX #7] طلب صاحب المشروع: قفل خفيف بعد 5 محاولات خاطئة ولمدة دقيقتين بس
// (بدل 8 محاولات / 15 دقيقة). ده ممكن يتظبط هنا بس — التطبيق بياخد 429 من السيرفر.
const FAIL_LIMIT = 5;
const FAIL_WINDOW = 15 * 60 * 1000;
const LOCK_MS = 2 * 60 * 1000;

// نسخة احتياطية في الذاكرة: لو القاعدة مش متاحة لأي سبب، الحماية تفضل شغالة
// بدل ما تختفي خالص. الفشل هنا لازم يبقى "آمن"، مش "مفتوح".
const memLockouts = new Map();

let stmts = null;
let dbBroken = false;

function sql() {
  if (dbBroken) return null;
  if (stmts) return stmts;
  try {
    // require كسول: بيمنع أي دورة اعتماد بين db.js و rateLimit.js، وبيخلي
    // الوحدة دي قابلة للاستيراد في اختبارات مالهاش قاعدة بيانات.
    const database = require('./db').db;
    database.exec(
      'CREATE TABLE IF NOT EXISTS auth_lockouts (' +
      '  key         TEXT PRIMARY KEY,' +
      '  started_at  INTEGER NOT NULL,' +
      '  fails       INTEGER NOT NULL DEFAULT 0,' +
      '  locked_until INTEGER NOT NULL DEFAULT 0' +
      ')'
    );
    database.exec('CREATE INDEX IF NOT EXISTS idx_auth_lockouts_until ON auth_lockouts(locked_until)');
    stmts = {
      get: database.prepare('SELECT started_at, fails, locked_until FROM auth_lockouts WHERE key = ?'),
      put: database.prepare(
        'INSERT INTO auth_lockouts (key, started_at, fails, locked_until) VALUES (?, ?, ?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET started_at=excluded.started_at, fails=excluded.fails, locked_until=excluded.locked_until'
      ),
      del: database.prepare('DELETE FROM auth_lockouts WHERE key = ?'),
      sweep: database.prepare('DELETE FROM auth_lockouts WHERE locked_until < ? AND started_at < ?'),
    };
    return stmts;
  } catch (_) {
    dbBroken = true;
    return null;
  }
}

function readEntry(key) {
  const s = sql();
  if (s) {
    try {
      const r = s.get.get(key);
      if (!r) return null;
      return { start: Number(r.started_at) || 0, fails: Number(r.fails) || 0, until: Number(r.locked_until) || 0 };
    } catch (_) { dbBroken = true; }
  }
  return memLockouts.get(key) || null;
}

function writeEntry(key, e) {
  const s = sql();
  if (s) {
    try { s.put.run(key, e.start, e.fails, e.until); return; } catch (_) { dbBroken = true; }
  }
  memLockouts.set(key, e);
}

function removeEntry(key) {
  const s = sql();
  if (s) {
    try { s.del.run(key); } catch (_) { dbBroken = true; }
  }
  memLockouts.delete(key);
}

// true = مقفول دلوقتي
function isLocked(key) {
  const e = readEntry(key);
  if (!e) return false;
  if (e.until && Date.now() < e.until) return true;
  if (e.until && Date.now() >= e.until) { removeEntry(key); return false; }
  return false;
}

// الثواني الفاضلة على فتح القفل
function lockRemaining(key) {
  const e = readEntry(key);
  if (!e || !e.until) return 0;
  return Math.max(0, Math.ceil((e.until - Date.now()) / 1000));
}

function registerFailure(key) {
  const now = Date.now();
  let e = readEntry(key);
  if (!e || now - e.start > FAIL_WINDOW) e = { start: now, fails: 0, until: 0 };
  e.fails++;
  if (e.fails >= FAIL_LIMIT) e.until = now + LOCK_MS;
  writeEntry(key, e);
  return e.fails;
}

function clearFailures(key) { removeEntry(key); }

// كنس الصفوف المنتهية: الأقفال المفتوحة والمحاولات الأقدم من ساعة.
setInterval(() => {
  const now = Date.now();
  const s = sql();
  if (s) { try { s.sweep.run(now, now - 3600000); } catch (_) { dbBroken = true; } }
  for (const [k, e] of memLockouts) {
    if ((e.until && now > e.until) || now - e.start > 3600000) memLockouts.delete(k);
  }
}, 600000).unref();

module.exports = { rateLimit, isLocked, lockRemaining, registerFailure, clearFailures, FAIL_LIMIT, LOCK_MS };
