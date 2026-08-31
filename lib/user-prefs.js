'use strict';
// Per-user preferences + trial ledger. Self-contained tables (created here) so
// this module is safe to require in any order, exactly like lib/commerce.js.
//
// 1) smart_coach: «المتابعة الذكية». ON by default. When a user turns it OFF the
//    server must STOP auto-developing their plans: no progression suggestions
//    for training, no automatic calorie/meal adjustments for nutrition. The
//    current plans themselves are never touched — only the automatic evolution
//    pauses, and resumes from the current point when switched back ON.
// 2) trials: one free 3-day trial per customer. We remember the phone so a
//    brand-new account with the same phone cannot claim the trial twice.
const db = require('./db');
const h = db.db;
const now = () => new Date().toISOString();

h.exec(`
CREATE TABLE IF NOT EXISTS user_prefs (
  user_id     INTEGER PRIMARY KEY,
  smart_coach INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trials (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  phone      TEXT,
  email      TEXT,
  device_id  TEXT,
  started_at TEXT NOT NULL,
  ends_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trials_user   ON trials(user_id);
CREATE INDEX IF NOT EXISTS idx_trials_phone  ON trials(phone);
CREATE INDEX IF NOT EXISTS idx_trials_email  ON trials(email);
CREATE INDEX IF NOT EXISTS idx_trials_device ON trials(device_id);
`);
// [FIX] لو الجدول قديم (اتعمل قبل ما نضيف email/device_id) نضيف الأعمدة بأمان.
for (const col of ['email TEXT', 'device_id TEXT']) {
  try { h.exec('ALTER TABLE trials ADD COLUMN ' + col + ';'); } catch (_) {}
}

const q = {
  getPref:  h.prepare('SELECT smart_coach FROM user_prefs WHERE user_id = ?'),
  setPref:  h.prepare(
    'INSERT INTO user_prefs (user_id, smart_coach, updated_at) VALUES (?, ?, ?) ' +
    'ON CONFLICT(user_id) DO UPDATE SET smart_coach = excluded.smart_coach, updated_at = excluded.updated_at'
  ),
  trialByUser:   h.prepare('SELECT * FROM trials WHERE user_id = ? ORDER BY id DESC LIMIT 1'),
  trialByPhone:  h.prepare('SELECT * FROM trials WHERE phone = ? ORDER BY id DESC LIMIT 1'),
  trialByEmail:  h.prepare('SELECT * FROM trials WHERE email = ? ORDER BY id DESC LIMIT 1'),
  trialByDevice: h.prepare('SELECT * FROM trials WHERE device_id = ? ORDER BY id DESC LIMIT 1'),
  insertTrial:   h.prepare('INSERT INTO trials (user_id, phone, email, device_id, started_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)'),
};

// ---- Smart coach ----
// Defaults to enabled for anyone who never touched the switch.
function smartCoachEnabled(userId) {
  try { const r = q.getPref.get(userId); return r ? r.smart_coach === 1 : true; }
  catch (_) { return true; }
}
function setSmartCoach(userId, enabled) {
  q.setPref.run(userId, enabled ? 1 : 0, now());
  return smartCoachEnabled(userId);
}

// ---- Trials ----
// [FIX] التجربة المجانية «مرة واحدة للأبد» لكل عميل: بنمنع تكرارها لو اتفعّلت
// قبل كده على نفس الحساب أو نفس رقم الهاتف أو نفس الإيميل أو نفس الجهاز. أي
// هوية من دول تكفي للمنع، وبنسجّل كل الهويات وقت التفعيل عشان أي حساب جديد
// بنفس الإيميل/الهاتف/الجهاز مايقدرش ياخد التجربة تاني نهائيًا.
function normPhone(p) { return String(p == null ? '' : p).replace(/[^\d+]/g, ''); }
function normEmail(e) { return String(e == null ? '' : e).trim().toLowerCase(); }
function normDevice(d) { return String(d == null ? '' : d).trim().slice(0, 128); }

// بترجّع سبب المنع ('account'|'phone'|'email'|'device') أو null لو مسموح.
function trialUsedBy(opts) {
  const o = opts || {};
  try {
    if (o.userId != null && q.trialByUser.get(o.userId)) return 'account';
    const ph = normPhone(o.phone);
    if (ph && q.trialByPhone.get(ph)) return 'phone';
    const em = normEmail(o.email);
    if (em && q.trialByEmail.get(em)) return 'email';
    const dv = normDevice(o.deviceId);
    if (dv && q.trialByDevice.get(dv)) return 'device';
  } catch (_) {}
  return null;
}
function hasUsedTrial(userId, phone) {
  return !!trialUsedBy({ userId: userId, phone: phone });
}
function recordTrial(userId, phone, endsAt, extra) {
  const e = extra || {};
  q.insertTrial.run(
    userId,
    normPhone(phone) || null,
    normEmail(e.email) || null,
    normDevice(e.deviceId) || null,
    now(),
    endsAt
  );
}

function hasUsedTrialByUser(userId) {
  try { return !!q.trialByUser.get(userId); } catch (_) { return false; }
}
function recordTrialByUser(userId, endsAt) {
  q.insertTrial.run(userId, null, null, null, now(), endsAt);
}
module.exports = {
  smartCoachEnabled, setSmartCoach,
  normPhone, normEmail, normDevice,
  trialUsedBy, hasUsedTrial, recordTrial,
  hasUsedTrialByUser, recordTrialByUser,
};
