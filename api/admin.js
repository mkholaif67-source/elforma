'use strict';
// /api/admin/* — payment review dashboard (allowlisted admin emails only).
const fs = require('fs');
const path = require('path');
const vm = require('vm'); // [FIX M8] لقراية قاعدة المحرك كـكائن بدل regex
const db = require('../lib/db');
const auth = require('../lib/auth');
const cfg = require('../lib/config');
const commerce = require('../lib/commerce');
const settings = require('../lib/settings');
const appconfig = require('../lib/appconfig');
const push = require('../lib/push');
const { sendJson, readJsonBody, parseCookies, mimeFor } = require('../lib/util');
const os = require('os');
const videoGuard = require('../lib/video-guard');

const ENGINE_DB_FILE = path.join(__dirname, '..', 'app', 'workout', 'engine', 'db.js');
const DATA_DIR = process.env.EF_DATA_DIR || path.join(__dirname, '..', 'data');
const RECEIPTS = path.join(DATA_DIR, 'uploads', 'receipts');

function requireAdmin(req, res) {
  const user = auth.currentUser(parseCookies(req));
  if (!user) { sendJson(res, 401, { error: 'unauthenticated' }); return null; }
  if (!cfg.isAdminEmail(user.email)) { sendJson(res, 403, { error: 'forbidden' }); return null; }
  return user;
}

function enrich(p) {
  let meta = {}; try { meta = p.meta ? JSON.parse(p.meta) : {}; } catch (_) {}
  const u = db.userById(p.user_id) || {};
  const plan = cfg.planByCode(p.plan_code);
  return {
    id: p.id, user: { id: p.user_id, name: u.name, email: u.email },
    plan: p.plan_code, plan_name: plan ? plan.name : p.plan_code,
    provider: p.provider, amount: p.amount, currency: p.currency, status: p.status,
    created_at: p.created_at, updated_at: p.updated_at,
    method: meta.method || null, sender: meta.sender || null, ref: p.provider_ref || meta.ref || null,
    wallet: meta.wallet || null, walletLabel: meta.walletLabel || null,
    coupon: meta.coupon || null, discount: meta.discount || 0,
    receipt: meta.receipt || null,
  };
}

// GET /api/admin/whoami -> is the current user an admin?
// [FIX M11] المسار كان مفتوح للمجهولين وبيرد 200 على طول. دلوقتي لازم تسجيل
// دخول الأول (401 للمجهول)، والرد للمسجل بيقول admin:true/false بس — مافيش
// أي تفاصيل إضافية تساعد في حصر إيميلات الأدمن.
async function whoami(req, res) {
  const user = auth.currentUser(parseCookies(req));
  if (!user) return sendJson(res, 401, { error: 'unauthenticated' });
  return sendJson(res, 200, { admin: !!cfg.isAdminEmail(user.email) });
}

// GET /api/admin/payments?status=pending
async function payments(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const url = new URL(req.url, 'http://localhost');
  const status = url.searchParams.get('status') || '';
  const rows = commerce.listPayments(status || null, 300).map(enrich);
  const counts = {
    pending: commerce.listPayments('pending', 1000).length,
    paid: commerce.listPayments('paid', 1000).length,
  };
  return sendJson(res, 200, { ok: true, payments: rows, counts });
}

// POST /api/admin/payment/approve { id }
async function approve(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const b = await readJsonBody(req);
  const r = commerce.approvePayment(Number(b.id), 'manual');
  if (!r) return sendJson(res, 404, { error: 'not_found' });
  db.audit(admin.id, 'admin_approve:' + b.id, ip);
  return sendJson(res, 200, { ok: true, payment: enrich(r.payment) });
}

// POST /api/admin/payment/reject { id }
async function reject(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const b = await readJsonBody(req);
  const p = commerce.rejectPayment(Number(b.id));
  if (!p) return sendJson(res, 404, { error: 'not_found' });
  db.audit(admin.id, 'admin_reject:' + b.id, ip);
  return sendJson(res, 200, { ok: true, payment: enrich(p) });
}

// GET /api/admin/receipt?file=... -> streams an uploaded receipt (admin only)
async function receipt(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const url = new URL(req.url, 'http://localhost');
  const file = path.basename(url.searchParams.get('file') || '');
  if (!/^r_[\w.]+$/.test(file)) return sendJson(res, 400, { error: 'bad_file' });
  const full = path.join(RECEIPTS, file);
  if (!full.startsWith(RECEIPTS) || !fs.existsSync(full)) return sendJson(res, 404, { error: 'not_found' });
  // [FIX H2 — دفاع في العمق]
  // حتى بعد فحص magic bytes عند الرفع، أي ملف قديم مخزّن قبل الإصلاح لسه
  // موجود على القرص. الأدمن لازم ينزّل الملف، ماينفعش المتصفح يعرضه
  // وينفّذ أي سكريبت جوّاه في سياق دومين الموقع.
  res.writeHead(200, {
    'Content-Type': mimeFor(full),
    'Content-Disposition': 'attachment; filename="' + file + '"',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(full).pipe(res);
}

// ---- Overview stats ----
async function stats(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const one = (sql) => { try { return db.db.prepare(sql).get().n; } catch (_) { return 0; } };
  const users = one('SELECT COUNT(*) n FROM users');
  const verified = one('SELECT COUNT(*) n FROM users WHERE verified = 1');
  const activePro = one("SELECT COUNT(*) n FROM subscriptions WHERE plan NOT IN ('free') AND status = 'active' AND (current_period_end IS NULL OR current_period_end > datetime('now'))");
  const trialing = one("SELECT COUNT(*) n FROM subscriptions WHERE status = 'trialing' OR plan = 'trial'");
  const pending = one("SELECT COUNT(*) n FROM payments WHERE status = 'pending'");
  const paid = one("SELECT COUNT(*) n FROM payments WHERE status = 'paid'");
  let revenue = [];
  try { revenue = db.db.prepare("SELECT currency, COALESCE(SUM(amount),0) total FROM payments WHERE status = 'paid' GROUP BY currency").all(); } catch (_) {}
  return sendJson(res, 200, { ok: true, stats: { users, verified, activePro, trialing, pending, paid, revenue } });
}

// ---- Users management ----
async function users(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const url = new URL(req.url, 'http://localhost');
  const term = String(url.searchParams.get('q') || '').trim().slice(0, 120);
  // [FIX M10 — حقن رموز LIKE]
  // البحث كان بيحط نص الأدمن جوّا LIKE من غير تهريب، فبحث بـ "%" لوحده
  // كان بيطابق كل المستخدمين، و"_" بيطابق أي حرف. مش ثغرة SQLi (القيمة
  // مربوطة بـ parameter) لكنه سلوك بحث غلط ومكلف على قاعدة كبيرة.
  // دلوقتي بنهرّب \\ و% و_ ونعلن ESCAPE '\\'.
  const escaped = term.replace(/[\\%_]/g, function (ch) { return '\\' + ch; });
  const like = '%' + escaped + '%';
  let rows = [];
  try {
    rows = db.db.prepare(
      'SELECT u.id, u.name, u.email, u.phone, u.verified, u.created_at, u.last_login, ' +
      's.plan, s.status, s.current_period_end ' +
      'FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id ' +
      "WHERE (? = '' OR u.email LIKE ? ESCAPE '\\' OR u.phone LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\') " +
      'ORDER BY u.id DESC LIMIT 500'
    ).all(term, like, like, like);
  } catch (e) { return sendJson(res, 500, { error: 'query_failed' }); }
  const list = rows.map((u) => ({
    id: u.id, name: u.name, email: u.email, phone: u.phone, verified: !!u.verified,
    created_at: u.created_at, last_login: u.last_login,
    plan: u.plan || 'free', status: u.status || 'active', current_period_end: u.current_period_end,
    admin: cfg.isAdminEmail(u.email),
  }));
  return sendJson(res, 200, { ok: true, users: list });
}

// POST /api/admin/user/subscription { userId, action: grant|extend|revoke, months? }
async function setUserSubscription(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const b = await readJsonBody(req);
  const userId = Number(b.userId);
  const u = db.userById(userId);
  if (!u) return sendJson(res, 404, { error: 'user_not_found' });
  const action = String(b.action || '');
  let r;
  if (action === 'grant' || action === 'extend') {
    const months = Math.max(1, Math.min(60, Math.round(Number(b.months) || 1)));
    r = commerce.adminSetSubscription(userId, 'pro', 'active', months, 'admin');
  } else if (action === 'revoke') {
    r = commerce.adminSetSubscription(userId, 'free', 'canceled', null, 'admin');
  } else {
    return sendJson(res, 400, { error: 'bad_action' });
  }
  db.audit(admin.id, 'admin_sub:' + action + ':' + userId, ip);
  return sendJson(res, 200, { ok: true, subscription: r });
}

// POST /api/admin/user/delete { userId }
async function deleteUser(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const b = await readJsonBody(req);
  const userId = Number(b.userId);
  const u = db.userById(userId);
  if (!u) return sendJson(res, 404, { error: 'user_not_found' });
  if (userId === admin.id) return sendJson(res, 400, { error: 'cannot_delete_self' });
  db.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  db.audit(admin.id, 'admin_delete_user:' + u.email, ip);
  return sendJson(res, 200, { ok: true });
}

// ---- Coupons ----
async function coupons(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  return sendJson(res, 200, { ok: true, coupons: commerce.listCoupons(), uses: commerce.listCouponUses() });
}
async function couponUpsert(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const b = await readJsonBody(req);
  const r = commerce.upsertCoupon(b);
  if (!r.ok) return sendJson(res, 400, { error: r.error });
  db.audit(admin.id, 'admin_coupon_upsert:' + (b.code || ''), ip);
  return sendJson(res, 200, { ok: true, coupon: r.coupon });
}
async function couponToggle(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const b = await readJsonBody(req);
  commerce.setCouponActive(String(b.code || ''), !!b.active);
  db.audit(admin.id, 'admin_coupon_toggle:' + (b.code || ''), ip);
  return sendJson(res, 200, { ok: true });
}
async function couponDelete(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const b = await readJsonBody(req);
  const r = commerce.deleteCoupon(String(b.code || ''));
  if (!r.ok) return sendJson(res, 400, { error: r.error });
  db.audit(admin.id, 'admin_coupon_delete:' + (b.code || ''), ip);
  return sendJson(res, 200, { ok: true, code: r.code });
}

// ---- Pricing management ----
function anum(v) { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; }
async function pricingGet(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  return sendJson(res, 200, { ok: true, plans: cfg.publicConfig().plans });
}
async function pricingSave(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const b = await readJsonBody(req);
  const clean = {};
  ['m1', 'm3', 'm6'].forEach((code) => {
    const o = (b && b[code]) || {};
    clean[code] = {
      price_egp: anum(o.price_egp), anchor_egp: anum(o.anchor_egp),
      price_usd: anum(o.price_usd), anchor_usd: anum(o.anchor_usd),
      badge: (o.badge == null ? '' : String(o.badge).slice(0, 40)),
      tagline: (o.tagline == null ? '' : String(o.tagline).slice(0, 80)),
    };
  });
  settings.setJSON('pricing', clean);
  db.audit(admin.id, 'admin_pricing_update', ip);
  return sendJson(res, 200, { ok: true, plans: cfg.publicConfig().plans });
}

// ---- Content management ----
async function contentGet(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  return sendJson(res, 200, { ok: true, content: cfg.getContent(), fields: cfg.CONTENT_FIELDS });
}
async function contentSave(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const b = await readJsonBody(req);
  const fields = cfg.CONTENT_FIELDS || [];
  const clean = {};
  fields.forEach((f) => {
    if (b && Object.prototype.hasOwnProperty.call(b, f.key)) {
      clean[f.key] = String(b[f.key] == null ? '' : b[f.key]).slice(0, 2000);
    }
  });
  settings.setJSON('content', clean);
  db.audit(admin.id, 'admin_content_update', ip);
  return sendJson(res, 200, { ok: true, content: cfg.getContent() });
}

// ---- Video links ----
//
// The owner asked to add, edit and delete exercise videos without a release.
// The catalogue of exercises lives in the workout engine, which is a browser
// bundle: it cannot be require()d here, and running it in a VM does not expose
// its private MODULE_DB const. So we read the engine file as TEXT and pull the
// authored pairs out of it. That is deliberate, not lazy — it keeps the engine
// the single source of truth and needs no duplicate list to drift out of sync.
let _catalogueCache = null;

/* [FIX M8 — كاتالوج الفيديو كان بيتقرا بـ regex من ملف المحرك]
   المشكلة: /n:\s*'([^']+)'[\s\S]{0,400}?vid:\s*'([^']*)'/ بيفترض ترتيب ومسافة
   ثابتين جوّا كل عنصر. أي إعادة تنسيق للملف، أو أي وصف أطول من 400 حرف،
   أو اسم فيه أبوستروف، يبقى إما تمرين مختفي أو اسم متربط بفيديو تمرين تاني
   — ويبقى غلط صامت في لوحة الأدمن محدش هيلاحظه.

   الحل: نشغل الملف فعلًا جوّا vm sandbox معزول ونقرا GYM_DB كـكائن حقيقي
   (نفس الأسلوب اللي lib/workout-engine-host.js بيستخدمه). الـ regex فضل موجود
   كـfallback بس مع تحذير في اللوج، عشان لو المحرك اتغير ماتقعش اللوحة. */
function walkEngineDb(node, out, seen) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) {
      if (item && typeof item === 'object' && typeof item.n === 'string') {
        const key = videoGuard.videoKey(item.n);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({ key, name: item.n, engineVideoId: typeof item.vid === 'string' ? item.vid : '' });
      } else if (item && typeof item === 'object') {
        walkEngineDb(item, out, seen);
      }
    }
    return;
  }
  if (typeof node === 'object') {
    for (const k of Object.keys(node)) walkEngineDb(node[k], out, seen);
  }
}

function videoCatalogueFromRegex(src, out, seen) {
  const re = /n:\s*'([^']+)'[\s\S]{0,400}?vid:\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    const key = videoGuard.videoKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, name, engineVideoId: m[2] || '' });
  }
}

function videoCatalogue() {
  if (_catalogueCache) return _catalogueCache;
  let src = '';
  try { src = fs.readFileSync(ENGINE_DB_FILE, 'utf8'); } catch (e) { src = ''; }

  const out = [];
  const seen = new Set();

  let parsed = null;
  if (src) {
    try {
      // sandbox فاضي تمامًا: مفيش require ولا process ولا وصول للقرص.
      const sandbox = Object.create(null);
      const ctx = vm.createContext(sandbox);
      const wrapped = src + '\n;this.__EF_GYM_DB = (typeof GYM_DB !== "undefined") ? GYM_DB : null;';
      new vm.Script(wrapped, { filename: 'engine-db.js' }).runInContext(ctx, { timeout: 5000 });
      parsed = sandbox.__EF_GYM_DB;
    } catch (e) {
      console.error('[admin.videoCatalogue] sandbox parse failed, falling back to regex:', e && e.message);
      parsed = null;
    }
  }

  if (parsed && typeof parsed === 'object') {
    walkEngineDb(parsed, out, seen);
  }
  if (!out.length && src) {
    console.error('[admin.videoCatalogue] structured parse returned 0 exercises — using regex fallback');
    videoCatalogueFromRegex(src, out, seen);
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  _catalogueCache = out;
  return out;
}

async function videos(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;

  const rows = db.videoOverrideList();
  const byKey = {};
  rows.forEach((r) => { byKey[r.exercise_key] = r; });

  const items = [];
  const counts = { engine: 0, override: 0, added: 0, removed: 0, missing: 0 };

  videoCatalogue().forEach((c) => {
    const ov = byKey[c.key];
    let videoId = c.engineVideoId;
    let status = c.engineVideoId ? 'engine' : 'missing';
    if (ov) {
      videoId = ov.video_id;
      // '' is a deliberate delete, never a fallback to the engine link.
      status = ov.video_id === '' ? 'removed'
        : (c.engineVideoId ? 'override' : 'added');
    }
    counts[status] = (counts[status] || 0) + 1;
    items.push({
      key: c.key,
      name: c.name,
      engineVideoId: c.engineVideoId,
      videoId,
      url: videoId ? 'https://www.youtube.com/watch?v=' + videoId : '',
      thumb: videoId ? 'https://img.youtube.com/vi/' + videoId + '/mqdefault.jpg' : '',
      status,
      note: ov && ov.note ? ov.note : '',
      updatedAt: ov ? ov.updated_at : ''
    });
  });

  return sendJson(res, 200, { ok: true, total: items.length, counts, items });
}

async function videoSet(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const b = await readJsonBody(req);

  const key = videoGuard.videoKey(b && (b.key || b.name));
  if (!key) return sendJson(res, 400, { error: 'missing_exercise' });

  // Accept a full YouTube URL or a bare id; store only the id so the app never
  // has to parse anything and test/parity.test.js keeps passing.
  const videoId = videoGuard.extractId(b && b.videoId);
  if (!videoId) return sendJson(res, 400, { error: 'bad_video_id' });

  const name = (b && b.name) ? String(b.name) : key;
  db.setVideoOverride(key, name, videoId, b && b.note, admin.id);
  videoGuard.invalidateOverrides();
  db.audit(admin.id, 'admin_video:set:' + key, ip);
  return sendJson(res, 200, { ok: true, key, videoId });
}

async function videoRemove(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const b = await readJsonBody(req);

  const key = videoGuard.videoKey(b && (b.key || b.name));
  if (!key) return sendJson(res, 400, { error: 'missing_exercise' });

  // Store an EMPTY override rather than deleting the row: deleting would just
  // re-expose the engine's link, which is the opposite of what was asked.
  db.setVideoOverride(key, (b && b.name) ? String(b.name) : key, '', b && b.note, admin.id);
  videoGuard.invalidateOverrides();
  db.audit(admin.id, 'admin_video:remove:' + key, ip);
  return sendJson(res, 200, { ok: true, key, videoId: '' });
}

async function videoReset(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const b = await readJsonBody(req);

  const key = videoGuard.videoKey(b && (b.key || b.name));
  if (!key) return sendJson(res, 400, { error: 'missing_exercise' });

  db.clearVideoOverride(key);
  videoGuard.invalidateOverrides();
  db.audit(admin.id, 'admin_video:reset:' + key, ip);
  return sendJson(res, 200, { ok: true, key });
}

// طابور بلاغات الفيديو
// مجمّع بالتمرين ومرتب بعدد البلاغات عشان أخطر فيديو يبقى فوق
async function videoReports(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const url = new URL(req.url, 'http://localhost');
  const status = String(url.searchParams.get('status') || 'open');
  const rows = db.videoReports(status, 200);
  return sendJson(res, 200, {
    ok: true,
    open: db.openVideoReportCount(),
    items: rows.map((r) => ({
      key: r.exercise_key,
      name: r.exercise_name || r.exercise_key,
      videoId: r.video_id || '',
      reports: Number(r.reports) || 0,
      lastAt: r.last_at,
      firstAt: r.first_at
    }))
  });
}

async function videoReportResolve(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const b = await readJsonBody(req);
  const key = String((b && b.key) || '').trim().slice(0, 160);
  if (!key) return sendJson(res, 400, { error: 'missing_exercise' });
  db.resolveVideoReports(key);
  db.audit(admin.id, 'admin_video_report:resolve:' + key, ip);
  return sendJson(res, 200, { ok: true, key: key, open: db.openVideoReportCount() });
}



// ---- Announcements / in-app promos -----------------------------------
// كل حقل هنا له قارئ فعلي في api/mobile.js -> activeAnnouncements()
// وفي mobile/lib/widgets/announcement_card.dart. ممنوع حقل بلا قارئ.
function cleanAnnouncement(a, index) {
  a = a && typeof a === 'object' ? a : {};
  const anNum = (v, def, min, max) => {
    const x = Number(v);
    if (!Number.isFinite(x)) return def;
    return Math.max(min, Math.min(max, Math.round(x)));
  };
  return {
    id: String(a.id || ('ann_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7))).slice(0, 60),
    title: String(a.title || '').slice(0, 120),
    body: String(a.body || '').slice(0, 500),
    link: String(a.link || '').slice(0, 400),
    // [بند 17] اسم زر الإجراء (CTA) — لو فاضي التطبيق بيستخدم «اعرف أكتر».
    cta: String(a.cta || '').slice(0, 40),
    image: String(a.image || '').slice(0, 400),
    phone: String(a.phone || '').slice(0, 40),
    placement: ['home','account','both'].indexOf(String(a.placement)) > -1 ? String(a.placement) : 'both',
    mode: ['card','popup','both'].indexOf(String(a.mode)) > -1 ? String(a.mode) : 'card',
    // الجمهور: الفلترة بتحصل على السيرفر حسب اشتراك المستخدم الحقيقي.
    audience: ['all','free','pro'].indexOf(String(a.audience)) > -1 ? String(a.audience) : 'all',
    // شكل الكارت داخل التطبيق (لون الحد + الأيقونة).
    style: ['info','success','warn','promo'].indexOf(String(a.style)) > -1 ? String(a.style) : 'info',
    // الترتيب اللي الموبايل بيرتّب بيه الإعلانات.
    order: anNum(a.order, Number.isFinite(Number(index)) ? Number(index) : 0, 0, 999),
    // يقدر يقفله؟ وكام مرة يشوفه (0 = بلا حدود).
    dismissible: a.dismissible !== false,
    maxViews: anNum(a.maxViews, 0, 0, 100),
    startsAt: a.startsAt ? String(a.startsAt).slice(0, 40) : null,
    endsAt: a.endsAt ? String(a.endsAt).slice(0, 40) : null,
    active: a.active !== false,
  };
}
async function announcementsGet(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  return sendJson(res, 200, { ok: true, items: settings.getJSON('announcements', []) || [] });
}
async function announcementsSave(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const b = await readJsonBody(req);
  const items = Array.isArray(b && b.items)
    ? b.items.slice(0, 50).map(function (a, i) { return cleanAnnouncement(a, i); })
    : [];
  settings.setJSON('announcements', items);
  db.audit(admin.id, 'admin_announcements_save', ip);
  return sendJson(res, 200, { ok: true, items: items });
}
async function referrals(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const coupons = commerce.listCoupons();
  const uses = commerce.listCouponUses();
  const groups = {};
  coupons.forEach(function(c){
    if (!c.referral_owner) return;
    const key = String(c.referral_owner);
    if (!groups[key]) groups[key] = { owner: key, coupons: [], uses: [] };
    groups[key].coupons.push(c);
  });
  uses.forEach(function(u){
    const c = coupons.find(function(x){ return x.code === u.code; });
    if (!c || !c.referral_owner) return;
    const key = String(c.referral_owner);
    if (!groups[key]) groups[key] = { owner: key, coupons: [], uses: [] };
    groups[key].uses.push(u);
  });
  return sendJson(res, 200, { ok: true, referrals: Object.keys(groups).map(function(k){ return groups[k]; }) });
}
// ---- Promo code management -------------------------------------------
// A promo grants free months directly (unlike a coupon, which discounts a
// payment). Every handler here goes through the module-local requireAdmin,
// which is the only admin check this file has -- auth.requireAdmin does not
// exist and calling it was a guaranteed TypeError.
async function promoList(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  return sendJson(res, 200, { ok: true, promos: commerce.listPromos() });
}

async function promoAction(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  let b; try { b = await readJsonBody(req); } catch (_) { return sendJson(res, 400, { error: 'bad_request' }); }
  b = b || {};
  const code = String(b.code || '').trim().toUpperCase();
  const action = String(b.action || '');
  if (!code) return sendJson(res, 400, { error: 'code required' });
  try {
    if (action === 'activate') {
      commerce.adminTogglePromo(code, true);
    } else if (action === 'deactivate') {
      commerce.adminTogglePromo(code, false);
    } else if (action === 'update' || action === 'create') {
      commerce.adminUpsertPromo(code, b.months, b.active === undefined ? true : !!b.active);
    } else if (action === 'delete') {
      commerce.adminDeletePromo(code);
    } else {
      return sendJson(res, 400, { error: 'unknown action' });
    }
  } catch (e) {
    const known = e && e.message === 'promo_not_found';
    return sendJson(res, known ? 404 : 500, { error: known ? 'promo_not_found' : 'server_error' });
  }
  db.audit(admin.id, 'admin_promo:' + action + ':' + code, ip);
  return sendJson(res, 200, { ok: true, promos: commerce.listPromos() });
}

// ---- AI feature flags -------------------------------------------------
// Flags live in the feature_flags table (lib/db.js). The previous version read
// and wrote a separate `ai_features` key in the settings store, so the table
// the schema created was never the thing being toggled.
const FEATURE_KEYS = ['ai_nutritionist', 'ai_coach'];

function readFeatureFlags() {
  const out = {};
  for (const key of FEATURE_KEYS) {
    const raw = db.getFeatureFlag(key);
    out[key] = raw === null ? true : raw === '1';
  }
  return out;
}

async function featuresGet(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  return sendJson(res, 200, { ok: true, features: readFeatureFlags() });
}

async function featuresSave(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  let b; try { b = await readJsonBody(req); } catch (_) { return sendJson(res, 400, { error: 'bad_request' }); }
  b = b || {};
  for (const key of FEATURE_KEYS) {
    if (typeof b[key] === 'boolean') db.setFeatureFlag(key, b[key] ? '1' : '0');
  }
  db.audit(admin.id, 'admin_features_save', ip);
  return sendJson(res, 200, { ok: true, features: readFeatureFlags() });
}

// ---- Custom subscription plans ---------------------------------------
async function planList(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  return sendJson(res, 200, { ok: true, plans: cfg.allPlans() });
}

async function planAdd(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  let b; try { b = await readJsonBody(req); } catch (_) { return sendJson(res, 400, { error: 'bad_request' }); }
  b = b || {};
  const code = String(b.code || '').trim().slice(0, 20);
  const name = String(b.name || '').trim().slice(0, 80);
  if (!code || !name) return sendJson(res, 400, { error: 'code and name required' });
  if (cfg.planByCode(code)) return sendJson(res, 409, { error: 'plan_exists' });
  const plan = {
    code: code,
    name: name,
    months: Math.max(1, Math.min(36, Number(b.months) || 1)),
    price_egp: Math.max(0, Number(b.price_egp) || 0),
    price_usd: Math.max(0, Number(b.price_usd) || 0),
    anchor_egp: Math.max(0, Number(b.anchor_egp) || 0),
    anchor_usd: Math.max(0, Number(b.anchor_usd) || 0),
    tagline: String(b.tagline || '').slice(0, 120),
    badge: String(b.badge || '').slice(0, 40),
    is_free: 0, is_trial: 0,
  };
  const custom = settings.getJSON('custom_plans', []) || [];
  custom.push(plan);
  settings.setJSON('custom_plans', custom);
  db.audit(admin.id, 'admin_plan_add:' + plan.code, ip);
  return sendJson(res, 200, { ok: true, plan: plan, plans: cfg.allPlans() });
}

async function planDelete(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  let b; try { b = await readJsonBody(req); } catch (_) { return sendJson(res, 400, { error: 'bad_request' }); }
  b = b || {};
  const code = String(b.code || '').trim();
  if (!code) return sendJson(res, 400, { error: 'code required' });
  // Built-in plans are defined in code and must not be deletable at runtime.
  if (cfg.PLANS.some(function (p) { return p.code === code; })) {
    return sendJson(res, 400, { error: 'builtin_plan' });
  }
  const before = settings.getJSON('custom_plans', []) || [];
  const after = before.filter(function (p) { return p.code !== code; });
  if (after.length === before.length) return sendJson(res, 404, { error: 'plan_not_found' });
  settings.setJSON('custom_plans', after);
  db.audit(admin.id, 'admin_plan_delete:' + code, ip);
  return sendJson(res, 200, { ok: true, plans: cfg.allPlans() });
}

// ---- Referrals: manual create ----------------------------------------
// [بند 17] الأدمن يقدر يضيف محيل يدويًا (اسم + إيميل + كود + خصم %).
// بنخزنه ككوبون عادي مع referral_owner = الإيميل، والاسم جوّا note،
// فيتتبّع الاستخدام تلقائيًا مع باقي الكوبونات.
async function referralCreate(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  let b; try { b = await readJsonBody(req); } catch (_) { return sendJson(res, 400, { error: 'bad_request' }); }
  b = b || {};
  const name = String(b.name || '').trim().slice(0, 120);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 160);
  const code = String(b.code || '').trim().toUpperCase().slice(0, 40);
  const percent = Math.max(1, Math.min(100, Math.round(Number(b.percent) || 0)));
  if (!name || !email) return sendJson(res, 400, { error: 'name_email_required' });
  if (!code) return sendJson(res, 400, { error: 'code_required' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return sendJson(res, 400, { error: 'bad_email' });
  if (!percent) return sendJson(res, 400, { error: 'bad_percent' });
  const r = commerce.upsertCoupon({
    code: code, type: 'percent', value: percent, plan_scope: b.plan_scope || null,
    max_redemptions: Number(b.max_redemptions) || 0, active: 1, expires_at: b.expires_at || null,
    referral_owner: email, note: name,
  });
  if (!r.ok) return sendJson(res, 400, { error: r.error });
  db.audit(admin.id, 'admin_referral_create:' + code, ip);
  return sendJson(res, 200, { ok: true, coupon: r.coupon });
}

// ---- Announcements: live preview / test delivery ---------------------
// [بند 17] بيرجّع الإعلانات الفعّالة زي ما المتدرب بيشوفها بالظبط
// (بعد فلترة التاريخ والتفعيل والمكان)، عشان الأدمن يتأكد من التوصيل.
async function announcementsPreview(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const place = new URL(req.url, 'http://localhost').searchParams.get('place') || null;
  let mobile; try { mobile = require('./mobile'); } catch (_) { mobile = null; }
  let items = [];
  if (mobile && typeof mobile.activeAnnouncementsPublic === 'function') {
    items = mobile.activeAnnouncementsPublic(place);
  } else {
    // fallback: فلترة محلية لو الموديول ماصدّرش الدالة
    const now = Date.now();
    items = (settings.getJSON('announcements', []) || []).filter(function (a) {
      if (!a || a.active !== true) return false;
      if (place && a.placement && a.placement !== 'both' && a.placement !== place) return false;
      if (a.startsAt && Date.parse(a.startsAt) > now) return false;
      if (a.endsAt && Date.parse(a.endsAt) < now) return false;
      return true;
    }).map(cleanAnnouncement);
  }
  return sendJson(res, 200, { ok: true, items: items, count: items.length });
}


// ---- In-app notifications -----------------------------------------------
// Stored as JSON in settings. Flutter app reads them via /api/mobile/notifications.
// Each notification: { id, title, body, type:"popup"|"banner", target:"all"|userId, sent_at, expires_at }
async function notificationsGet(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  return sendJson(res, 200, { ok: true, items: settings.getJSON('admin_notifications', []) || [] });
}
// POST /api/admin/notify
// إشعار واحد بيمشي في مسارين في نفس الوقت:
//  1) Push حقيقي عبر FCM — يوصل والتطبيق مقفول زي أي تطبيق تاني.
//  2) اتنسخ في admin_notifications — فالموبايل بيلقطه كمان من الفحص
//     الدوري (الاحتياطي) لو التوكن مات أو FCM مش مضبوط.
// الرد بيرجع أرقام التوزيع الحقيقية مش "تم الإرسال" وخلاص.
async function notificationsSend(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  let b; try { b = await readJsonBody(req); } catch (_) { return sendJson(res, 400, { error: 'bad_request' }); }
  b = b || {};
  const title = String(b.title || '').trim().slice(0, 120);
  const body = String(b.body || '').trim().slice(0, 400);
  const type = ['popup', 'banner', 'silent'].includes(b.type) ? b.type : 'popup';
  const target = b.target ? String(b.target).trim().slice(0, 40) : 'all';
  const expiresHours = Math.max(1, Math.min(720, Number(b.expiresHours) || 48));
  const image = String(b.image || '').trim().slice(0, 400);
  const link = String(b.link || '').trim().slice(0, 400);
  if (!title || !body) return sendJson(res, 400, { error: 'title_body_required' });

  // جدولة: لو الوقت في المستقبل مابنبعتش push دلوقتي؛ الجهاز بياخده في ميعاده
  // من الفحص الدوري، ولما الميعاد يجي أول فتح/فحص بيعرضه.
  const scheduledRaw = String(b.scheduleAt || '').trim();
  const scheduledTs = scheduledRaw ? Date.parse(scheduledRaw) : 0;
  const isScheduled = Number.isFinite(scheduledTs) && scheduledTs > Date.now() + 30000;

  const note = {
    id: 'notif_' + Date.now(),
    title, body, type, target, image, link,
    sent_at: new Date().toISOString(),
    scheduled_at: isScheduled ? new Date(scheduledTs).toISOString() : null,
    expires_at: new Date((isScheduled ? scheduledTs : Date.now()) + expiresHours * 3600000).toISOString(),
  };

  // الإرسال الفعلي. لو الأدمن قفل الإشعارات من إعدادات التطبيق، مابنبعتش.
  let delivery = { configured: push.isConfigured(), attempted: 0, sent: 0, failed: 0, dropped: 0 };
  const wantPush = b.push !== false && type !== 'silent';
  if (isScheduled) {
    delivery.skipped = 'scheduled';
  } else if (!appconfig.get().pushEnabled) {
    delivery.skipped = 'push_disabled_in_settings';
  } else if (wantPush) {
    delivery = await push.send({
      audience: target,
      title: title,
      body: body,
      image: image || null,
      data: { notifId: note.id, type: type, link: link },
    });
  } else {
    delivery.skipped = 'push_not_requested';
  }
  note.delivery = delivery;

  const list = (settings.getJSON('admin_notifications', []) || []).slice(0, 199);
  list.unshift(note);
  settings.setJSON('admin_notifications', list);
  db.audit(admin.id, 'admin_notify:' + note.id, ip);
  return sendJson(res, 200, { ok: true, notification: note, delivery: delivery });
}

// GET /api/admin/push/status
// بيقول للأدمن الحقيقة: FCM مضبوط ولا لأ، وكام جهاز فعلًا مستعد يستقبل.
// لو الرقم صفر، اللوحة بتوري تحوير واضح بدل ما تدّي إحساس كادب.
async function pushStatus(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const s = push.stats();
  return sendJson(res, 200, {
    ok: true,
    configured: push.isConfigured(),
    devices: s,
    reach: {
      all: push.tokensFor('all').length,
      pro: push.tokensFor('pro').length,
      free: push.tokensFor('free').length,
    },
  });
}

// ---- App configuration (maintenance, version gate, global switches) -------
// GET /api/admin/app-config
async function appConfigGet(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  return sendJson(res, 200, { ok: true, config: appconfig.get(), defaults: appconfig.defaults() });
}

// POST /api/admin/app-config
// كل مفتاح هنا بيقرأه التطبيق فعليًا (bootstrap + /api/mobile/app-config).
async function appConfigSave(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  let b; try { b = await readJsonBody(req); } catch (_) { return sendJson(res, 400, { error: 'bad_request' }); }
  const saved = appconfig.save((b && b.config) || b || {});
  db.audit(admin.id, 'admin_app_config_save', ip);
  return sendJson(res, 200, { ok: true, config: saved });
}

// GET /api/admin/audit?limit=100 — سجل العمليات الحقيقي من جدول audit_log.
async function auditLog(req, res) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const url = new URL(req.url, 'http://localhost');
  const limit = Math.max(1, Math.min(300, Number(url.searchParams.get('limit')) || 100));
  let rows = [];
  try {
    rows = db.db.prepare(
      'SELECT a.id, a.user_id, a.action, a.ip, a.at AS created_at, u.email ' +
      'FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ' +
      'ORDER BY a.id DESC LIMIT ?'
    ).all(limit);
  } catch (_) { rows = []; }
  return sendJson(res, 200, { ok: true, items: rows });
}

async function notificationDelete(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  let b; try { b = await readJsonBody(req); } catch (_) { return sendJson(res, 400, { error: 'bad_request' }); }
  const id = String((b && b.id) || '').trim();
  if (!id) return sendJson(res, 400, { error: 'id_required' });
  const list = (settings.getJSON('admin_notifications', []) || []).filter(n => n.id !== id);
  settings.setJSON('admin_notifications', list);
  db.audit(admin.id, 'admin_notify_delete:' + id, ip);
  return sendJson(res, 200, { ok: true });
}


// ---- Image upload (for announcements) ------------------------------------
// POST /api/admin/upload  Content-Type: multipart/form-data  field: image
async function uploadImage(req, res, ip) {
  const admin = requireAdmin(req, res); if (!admin) return;
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('multipart/form-data')) return sendJson(res, 400, { error: 'multipart_required' });
  const boundary = ct.split('boundary=')[1];
  if (!boundary) return sendJson(res, 400, { error: 'no_boundary' });
  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', resolve);
    req.on('error', reject);
  });
  const buf = Buffer.concat(chunks);
  // Simple multipart parser: find image field
  const bndBuf = Buffer.from('--' + boundary);
  const CRLF2 = Buffer.from([0x0d, 0x0a, 0x0d, 0x0a]);
  let imageData = null;
  let origName = 'upload.jpg';
  let mimeType = 'image/jpeg';
  let pos = 0;
  while (pos < buf.length) {
    const bStart = buf.indexOf(bndBuf, pos);
    if (bStart < 0) break;
    const hStart = bStart + bndBuf.length + 2; // skip CRLF after boundary
    const hEnd = buf.indexOf(CRLF2, hStart);
    if (hEnd < 0) break;
    const header = buf.slice(hStart, hEnd).toString('utf8');
    if (header.includes('name="image"')) {
      const mMatch = header.match(/filename="([^"]+)"/);
      if (mMatch) origName = path.basename(mMatch[1]);
      const ctMatch = header.match(/Content-Type:\s*([^\r\n]+)/);
      if (ctMatch) mimeType = ctMatch[1].trim();
      const dataStart = hEnd + 4;
      const nextBnd = buf.indexOf(bndBuf, dataStart);
      const dataEnd = nextBnd > 0 ? nextBnd - 2 : buf.length; // strip trailing CRLF
      imageData = buf.slice(dataStart, dataEnd);
      break;
    }
    pos = bStart + bndBuf.length;
  }
  if (!imageData || imageData.length < 4) return sendJson(res, 400, { error: 'no_image' });
  if (imageData.length > 5 * 1024 * 1024) return sendJson(res, 400, { error: 'too_large' });
  // Validate magic bytes (JPEG, PNG, GIF, WebP)
  const sig = imageData.slice(0, 4);
  const validImg = (sig[0] === 0xFF && sig[1] === 0xD8) ||
                   (sig[0] === 0x89 && sig[1] === 0x50) ||
                   (sig[0] === 0x47 && sig[1] === 0x49) ||
                   (sig[0] === 0x52 && sig[1] === 0x49);
  if (!validImg) return sendJson(res, 400, { error: 'not_an_image' });
  const ext = (origName.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 5);
  const fname = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
  const imagesDir = path.join(DATA_DIR, 'uploads', 'images');
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
  const fpath = path.join(imagesDir, fname);
  fs.writeFileSync(fpath, imageData);
  db.audit(admin.id, 'admin_upload_image:' + fname, ip);
  const url = '/uploads/images/' + fname;
  return sendJson(res, 200, { ok: true, url, fname });
}


module.exports = {
  whoami, payments, approve, reject, receipt, stats, users, setUserSubscription, deleteUser,
  coupons, couponUpsert, couponToggle, couponDelete, announcementsGet, announcementsSave, announcementsPreview, referrals, referralCreate, pricingGet, pricingSave, contentGet, contentSave,
  notificationsGet, notificationsSend, notificationDelete, uploadImage,
  pushStatus, appConfigGet, appConfigSave, auditLog,
  videos, videoSet, videoRemove, videoReset, videoReports, videoReportResolve,
  promoList, promoAction, featuresGet, featuresSave, planList, planAdd, planDelete,
};
