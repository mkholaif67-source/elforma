'use strict';
// /api/reviews/* — real user reviews with server-side moderation.
const db = require('../lib/db');
const auth = require('../lib/auth');
const cfg = require('../lib/config');
const { sendJson, readJsonBody, parseCookies } = require('../lib/util');

function isCustomer(userId) {
  const s = db.getSubscription(userId);
  if (!s || !s.plan || s.plan === 'free') return false;
  if (s.status !== 'active' && s.status !== 'trialing') return false;
  if (s.current_period_end) { const e = Date.parse(s.current_period_end); if (Number.isFinite(e) && e <= Date.now()) return false; }
  return true;
}
function requireUser(req, res) {
  const u = auth.currentUser(parseCookies(req));
  if (!u) { sendJson(res, 401, { error: 'سجل دخولك الأول عشان تقدر تقيم' }); return null; }
  return u;
}
function requireAdmin(req, res) {
  const u = auth.currentUser(parseCookies(req));
  if (!u) { sendJson(res, 401, { error: 'unauthenticated' }); return null; }
  if (!cfg.isAdminEmail(u.email)) { sendJson(res, 403, { error: 'forbidden' }); return null; }
  return u;
}
function publicReview(r) {
  return { rating: r.rating, title: r.title || '', body: r.body, name: r.display_name || 'مستخدم', is_customer: !!r.is_customer, date: r.approved_at || r.created_at };
}

async function list(req, res) {
  const rows = db.listApprovedReviews(60).map(publicReview);
  const stats = db.approvedReviewStats();
  return sendJson(res, 200, { ok: true, reviews: rows, stats: stats });
}
async function mine(req, res) {
  const u = requireUser(req, res); if (!u) return;
  const r = db.reviewByUser(u.id);
  return sendJson(res, 200, { ok: true, review: r ? { rating: r.rating, title: r.title || '', body: r.body, status: r.status } : null });
}
async function submit(req, res, ip) {
  const u = requireUser(req, res); if (!u) return;
  const b = await readJsonBody(req);
  const rating = Math.round(Number(b.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return sendJson(res, 400, { error: 'اختر تقييما من 1 إلى 5 نجوم' });
  const body = String(b.body || '').trim();
  if (body.length < 10) return sendJson(res, 400, { error: 'اكتب مراجعة لا تقل عن 10 أحرف' });
  if (body.length > 2000) return sendJson(res, 400, { error: 'المراجعة طويلة جدا (الحد 2000 حرف)' });
  const title = String(b.title || '').trim().slice(0, 120) || null;
  const name = (u.name && String(u.name).trim().slice(0, 60)) || 'مستخدم الفورمة';
  const r = db.upsertReview(u.id, rating, title, body, name, isCustomer(u.id));
  db.audit(u.id, 'review_submitted', ip);
  return sendJson(res, 200, { ok: true, review: { rating: r.rating, title: r.title || '', body: r.body, status: r.status }, message: 'تم استلام تقييمك وهيظهر بعد المراجعة. شكرا!' });
}
async function pending(req, res) {
  const a = requireAdmin(req, res); if (!a) return;
  const rows = db.listReviewsByStatus('pending', 200).map(function (r) {
    const u = db.userById(r.user_id) || {};
    return { id: r.id, rating: r.rating, title: r.title || '', body: r.body, name: r.display_name || '', is_customer: !!r.is_customer, user_email: u.email || '', created_at: r.created_at };
  });
  return sendJson(res, 200, { ok: true, reviews: rows });
}
async function moderate(req, res, ip) {
  const a = requireAdmin(req, res); if (!a) return;
  const b = await readJsonBody(req);
  const id = Number(b.id);
  const action = String(b.action || '');
  if (!id || (action !== 'approve' && action !== 'reject')) return sendJson(res, 400, { error: 'bad_request' });
  const r = db.setReviewStatus(id, action === 'approve' ? 'approved' : 'rejected');
  db.audit(a.id, 'review_' + action + ':' + id, ip);
  return sendJson(res, 200, { ok: true, review: r ? { id: r.id, status: r.status } : null });
}
module.exports = { list, mine, submit, pending, moderate };
