"use strict";
// Commerce persistence: payments + coupons (+ activation of subscriptions).
const db = require('./db');
const { planByCode } = require('./config');

const h = db.db;
const now = () => new Date().toISOString();

h.exec(`
CREATE TABLE IF NOT EXISTS payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  plan_code     TEXT NOT NULL,
  provider      TEXT NOT NULL,
  amount        INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'EGP',
  status        TEXT NOT NULL DEFAULT 'pending',
  provider_ref  TEXT,
  meta          TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coupons (
  code            TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  value           INTEGER NOT NULL,
  plan_scope      TEXT,
  max_redemptions INTEGER,
  redeemed        INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1,
  expires_at      TEXT
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  code        TEXT NOT NULL,
  user_id     INTEGER NOT NULL,
  payment_id  INTEGER,
  redeemed_at TEXT NOT NULL,
  PRIMARY KEY (code, user_id)
);
`);

function addColumn(sql) { try { h.exec(sql); } catch (_) {} }
addColumn('ALTER TABLE coupons ADD COLUMN referral_owner TEXT');
addColumn('ALTER TABLE coupons ADD COLUMN note TEXT');
addColumn('ALTER TABLE coupons ADD COLUMN created_at TEXT');

const q = {
  insertPayment: h.prepare(
    "INSERT INTO payments (user_id, plan_code, provider, amount, currency, status, provider_ref, meta, created_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ),
  paymentById: h.prepare('SELECT * FROM payments WHERE id = ?'),
  paymentByRef: h.prepare('SELECT * FROM payments WHERE provider_ref = ?'),
  setPaymentStatus: h.prepare('UPDATE payments SET status = ?, provider_ref = COALESCE(?, provider_ref), updated_at = ? WHERE id = ?'),
  listByUser: h.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY id DESC'),
  listByStatus: h.prepare('SELECT * FROM payments WHERE status = ? ORDER BY id DESC LIMIT ?'),
  listAll: h.prepare('SELECT * FROM payments ORDER BY id DESC LIMIT ?'),
  couponByCode: h.prepare('SELECT * FROM coupons WHERE code = ?'),
  bumpCoupon: h.prepare('UPDATE coupons SET redeemed = redeemed + 1 WHERE code = ?'),
  setSub: h.prepare(
    'INSERT INTO subscriptions (user_id, plan, status, provider, current_period_end, updated_at) VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(user_id) DO UPDATE SET plan = excluded.plan, status = excluded.status, provider = excluded.provider, current_period_end = excluded.current_period_end, updated_at = excluded.updated_at'
  ),
  listCoupons: h.prepare('SELECT * FROM coupons ORDER BY code'),
  upsertCoupon: h.prepare(
    'INSERT INTO coupons (code, type, value, plan_scope, max_redemptions, active, expires_at, referral_owner, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(code) DO UPDATE SET type = excluded.type, value = excluded.value, plan_scope = excluded.plan_scope, max_redemptions = excluded.max_redemptions, active = excluded.active, expires_at = excluded.expires_at, referral_owner = excluded.referral_owner, note = excluded.note'
  ),
  setCouponActive: h.prepare('UPDATE coupons SET active = ? WHERE code = ?'),
  deleteCoupon: h.prepare('DELETE FROM coupons WHERE code = ?'),
  deleteCouponUses: h.prepare('DELETE FROM coupon_redemptions WHERE code = ?'),
  couponUsedByUser: h.prepare('SELECT 1 FROM coupon_redemptions WHERE code = ? AND user_id = ?'),
  markCouponUsed: h.prepare('INSERT OR IGNORE INTO coupon_redemptions (code, user_id, payment_id, redeemed_at) VALUES (?, ?, ?, ?)'),
  listCouponUses: h.prepare(
    'SELECT r.code, r.user_id, r.payment_id, r.redeemed_at, u.name, u.email FROM coupon_redemptions r ' +
    'LEFT JOIN users u ON u.id = r.user_id ORDER BY r.redeemed_at DESC'
  ),
  listCouponUsesByCode: h.prepare(
    'SELECT r.code, r.user_id, r.payment_id, r.redeemed_at, u.name, u.email FROM coupon_redemptions r ' +
    'LEFT JOIN users u ON u.id = r.user_id WHERE r.code = ? ORDER BY r.redeemed_at DESC'
  ),
};

// Seed the owner's special coupon and remove legacy demo coupons.
try {
  q.deleteCouponUses.run('WELCOME10'); q.deleteCoupon.run('WELCOME10');
  q.deleteCouponUses.run('FORMA20');  q.deleteCoupon.run('FORMA20');
  q.deleteCouponUses.run('SAVE50');   q.deleteCoupon.run('SAVE50');
  // [FIX] الكوبون القديم كان مربوط بباقة 3 شهور (m3). حوّلناه لخصم 100%
  // على باقة الشهر (m1) باسم جديد MOKHOLAIF_1M، فنشيل القديم نهائيًا.
  q.deleteCouponUses.run('MOKHOLAIF_3M'); q.deleteCoupon.run('MOKHOLAIF_3M');
} catch (_) {}
try {
  // خصم 100% على باقة الشهر فقط (plan_scope = 'm1') = شهر مجاني.
  q.upsertCoupon.run('MOKHOLAIF_1M', 'percent', 100, 'm1', 50, 1, null, 'mokholaif7@gmail.com', '1-month free owner coupon', now());
} catch (_) {}

function couponEvaluate(code, planCode, baseAmount, userId) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return { ok: false, error: 'empty' };
  const c = q.couponByCode.get(code);
  if (!c || !c.active) return { ok: false, error: 'not_found' };
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return { ok: false, error: 'expired' };
  if (c.max_redemptions != null && c.redeemed >= c.max_redemptions) return { ok: false, error: 'exhausted' };
  if (c.plan_scope && c.plan_scope !== planCode) return { ok: false, error: 'wrong_plan' };
  if (userId != null && q.couponUsedByUser.get(code, Number(userId))) return { ok: false, error: 'already_used_by_account' };
  let discount = c.type === 'percent' ? Math.round(baseAmount * c.value / 100) : c.value;
  if (discount > baseAmount) discount = baseAmount;
  const final = Math.max(0, baseAmount - discount);
  return { ok: true, coupon: c, discount, final };
}

function couponRedeem(code, userId, paymentId) {
  code = String(code || '').trim().toUpperCase();
  const uid = Number(userId);
  if (!code || !Number.isFinite(uid)) return false;
  try {
    const info = q.markCouponUsed.run(code, uid, paymentId || null, now());
    if (info && info.changes > 0) {
      q.bumpCoupon.run(code);
      return true;
    }
  } catch (_) {}
  return false;
}

function createPayment({ userId, planCode, provider, amount, currency, status, ref, meta }) {
  const info = q.insertPayment.run(
    userId, planCode, provider, amount, currency || 'EGP', status || 'pending',
    ref || null, meta ? JSON.stringify(meta) : null, now()
  );
  return Number(info.lastInsertRowid);
}
const getPayment = (id) => q.paymentById.get(id);
const getPaymentByRef = (ref) => q.paymentByRef.get(ref);
function setPaymentStatus(id, status, ref) { q.setPaymentStatus.run(status, ref || null, now(), id); }
const listUserPayments = (userId) => q.listByUser.all(userId);
function listPayments(status, limit) {
  limit = limit || 200;
  return status ? q.listByStatus.all(status, limit) : q.listAll.all(limit);
}

function activateSubscription(userId, planCode, provider) {
  const plan = planByCode(planCode);
  const months = plan ? plan.months : 1;
  const end = new Date(Date.now() + months * 30 * 24 * 3600 * 1000).toISOString();
  q.setSub.run(userId, 'pro', 'active', provider || null, end, now());
  return { plan: 'pro', status: 'active', current_period_end: end };
}

function approvePayment(id, provider) {
  const p = getPayment(id);
  if (!p) return null;
  const alreadyPaid = p.status === 'paid';
  setPaymentStatus(id, 'paid');
  if (!alreadyPaid) {
    let meta = null;
    try { meta = p.meta ? JSON.parse(p.meta) : null; } catch (_) { meta = null; }
    if (meta && meta.coupon) couponRedeem(meta.coupon, p.user_id, p.id);
  }
  const sub = activateSubscription(p.user_id, p.plan_code, provider || p.provider);
  db.audit(p.user_id, 'payment_approved:' + id, null);
  return { payment: getPayment(id), subscription: sub };
}
function rejectPayment(id) {
  const p = getPayment(id);
  if (!p) return null;
  setPaymentStatus(id, 'rejected');
  db.audit(p.user_id, 'payment_rejected:' + id, null);
  return getPayment(id);
}

function listCoupons() { return q.listCoupons.all(); }
function listCouponUses(code) {
  return code ? q.listCouponUsesByCode.all(String(code).trim().toUpperCase()) : q.listCouponUses.all();
}
function upsertCoupon({ code, type, value, plan_scope, max_redemptions, active, expires_at, referral_owner, note }) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return { ok: false, error: 'empty_code' };
  if (type !== 'percent' && type !== 'fixed') return { ok: false, error: 'bad_type' };
  const val = Math.round(Number(value));
  if (!(val > 0)) return { ok: false, error: 'bad_value' };
  if (type === 'percent' && val > 100) return { ok: false, error: 'bad_value' };
  const maxR = (max_redemptions != null && max_redemptions !== '') ? Math.round(Number(max_redemptions)) : null;
  const scope = plan_scope ? String(plan_scope).trim() : null;
  q.upsertCoupon.run(code, type, val, scope || null, maxR, active ? 1 : 0, expires_at || null,
    referral_owner ? String(referral_owner).trim().slice(0, 160) : null,
    note ? String(note).trim().slice(0, 300) : null,
    now());
  return { ok: true, coupon: q.couponByCode.get(code) };
}
function setCouponActive(code, active) { q.setCouponActive.run(active ? 1 : 0, String(code || '').toUpperCase()); }
function deleteCoupon(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return { ok: false, error: 'empty_code' };
  q.deleteCouponUses.run(c);
  q.deleteCoupon.run(c);
  return { ok: true, code: c };
}

function adminSetSubscription(userId, plan, status, months, provider) {
  let end = null;
  if (plan === 'pro' && months) end = new Date(Date.now() + months * 30 * 24 * 3600 * 1000).toISOString();
  q.setSub.run(userId, plan, status, provider || 'admin', end, now());
  db.audit(userId, 'admin_set_sub:' + plan + ':' + status, null);
  try { if (db.syncNow) db.syncNow(); } catch (_) {}
  return { plan, status, current_period_end: end };
}

const TRIAL_DAYS = 3;
function startTrial(userId, days) {
  const existing = db.getSubscription(userId);
  // [FIX] Only block if there is a currently ACTIVE non-free subscription.
  // An expired trial or a free account can always start a new trial.
  if (existing && existing.plan && existing.plan !== 'free'
      && existing.status === 'active'
      && existing.current_period_end
      && new Date(existing.current_period_end) > new Date()) {
    return { ok: false, error: 'already_subscribed', subscription: existing };
  }
  let d = Math.round(Number(days));
  if (!Number.isFinite(d) || d < 1 || d > 30) d = TRIAL_DAYS;
  const end = new Date(Date.now() + d * 24 * 3600 * 1000).toISOString();
  q.setSub.run(userId, 'trial', 'trialing', 'trial', end, now());
  try { if (db.syncNow) db.syncNow(); } catch (_) {}
  return { ok: true, plan: 'trial', status: 'trialing', current_period_end: end, days: d };
}

h.exec(`
CREATE TABLE IF NOT EXISTS promo_codes (
  code       TEXT PRIMARY KEY,
  months     INTEGER NOT NULL DEFAULT 1,
  active     INTEGER NOT NULL DEFAULT 1,
  redeemed   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  code        TEXT NOT NULL,
  user_id     INTEGER NOT NULL,
  redeemed_at TEXT NOT NULL,
  PRIMARY KEY (code, user_id)
);
`);

const pq = {
  list:    h.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC'),
  byCode:  h.prepare('SELECT * FROM promo_codes WHERE code = ?'),
  upsert:  h.prepare(`INSERT INTO promo_codes(code, months, active, redeemed, created_at)
                      VALUES(?,?,?,0,?)
                      ON CONFLICT(code) DO UPDATE SET months=excluded.months, active=excluded.active`),
  toggle:  h.prepare('UPDATE promo_codes SET active = ? WHERE code = ?'),
  bump:    h.prepare('UPDATE promo_codes SET redeemed = redeemed + 1 WHERE code = ?'),
  remove:  h.prepare('DELETE FROM promo_codes WHERE code = ?'),
  hasUsed: h.prepare('SELECT 1 FROM promo_redemptions WHERE code = ? AND user_id = ?'),
  markUsed: h.prepare('INSERT OR IGNORE INTO promo_redemptions(code, user_id, redeemed_at) VALUES(?,?,?)'),
};

const normCode = (c) => String(c == null ? '' : c).trim().toUpperCase();
function listPromos() { return pq.list.all(); }
function adminUpsertPromo(code, months, active) {
  const c = normCode(code);
  if (!c) throw new Error('code_required');
  let m = Math.round(Number(months));
  if (!Number.isFinite(m)) m = 1;
  m = Math.max(1, Math.min(24, m));
  pq.upsert.run(c, m, active === false ? 0 : 1, now());
  return pq.byCode.get(c);
}
function adminTogglePromo(code, active) {
  const c = normCode(code);
  if (!pq.byCode.get(c)) throw new Error('promo_not_found');
  pq.toggle.run(active ? 1 : 0, c);
  return pq.byCode.get(c);
}
function adminDeletePromo(code) {
  const c = normCode(code);
  if (!pq.byCode.get(c)) throw new Error('promo_not_found');
  pq.remove.run(c);
  return { ok: true, code: c };
}
function redeemPromo(userId, code) {
  const c = normCode(code);
  if (!c) return { ok: false, error: 'code_required' };
  const promo = pq.byCode.get(c);
  if (!promo) return { ok: false, error: 'promo_not_found' };
  if (!promo.active) return { ok: false, error: 'promo_inactive' };
  if (pq.hasUsed.get(c, userId)) return { ok: false, error: 'already_redeemed' };
  const sub = db.getSubscription(userId);
  let base = Date.now();
  if (sub && sub.current_period_end) {
    const cur = Date.parse(sub.current_period_end);
    if (Number.isFinite(cur) && cur > base) base = cur;
  }
  const until = new Date(base + promo.months * 30 * 24 * 3600 * 1000).toISOString();
  q.setSub.run(userId, 'promo', 'active', 'promo', until, now());
  pq.markUsed.run(c, userId, now());
  pq.bump.run(c);
  db.audit(userId, 'promo_redeemed:' + c, null);
  return { ok: true, code: c, months: promo.months, current_period_end: until };
}

module.exports = {
  couponEvaluate, couponRedeem,
  createPayment, getPayment, getPaymentByRef, setPaymentStatus,
  listUserPayments, listPayments,
  activateSubscription, approvePayment, rejectPayment,
  startTrial, TRIAL_DAYS,
  listCoupons, listCouponUses, upsertCoupon, setCouponActive, deleteCoupon, adminSetSubscription,
  listPromos, adminUpsertPromo, adminTogglePromo, adminDeletePromo, redeemPromo,
};
