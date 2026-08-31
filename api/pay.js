// [REDEPLOY-FIX-v3.0-2026] No phone verification in pay.js — manual() and all routes are phone-free.
'use strict';
// /api/plans, /api/coupon/check, /api/pay/* — checkout + payment endpoints.
const fs = require('fs');
const path = require('path');
const db = require('../lib/db');
const auth = require('../lib/auth');
const cfg = require('../lib/config');
const commerce = require('../lib/commerce');
const providers = require('../lib/pay-providers');
const { sendJson, readJsonBody, parseCookies } = require('../lib/util');
const { rateLimit } = require('../lib/rateLimit');

const DATA_DIR = process.env.EF_DATA_DIR || path.join(__dirname, '..', 'data');
const RECEIPTS = path.join(DATA_DIR, 'uploads', 'receipts');

function requireUser(req, res) {
  const user = auth.currentUser(parseCookies(req));
  if (!user) { sendJson(res, 401, { error: 'unauthenticated' }); return null; }
  return user;
}
// [FIX] تأكيد رقم الهاتف بقى مطلوب فقط عند تفعيل الباقة المجانية (startTrial).
// الباقات المدفوعة لا تشترط تأكيد الهاتف وتعمل بالنظام السابق.
// خلّينا الدالة كـ no-op للتوافق الخلفي فقط.
function requireVerifiedPhone(u) { return true; /* [FIX] phone check permanently disabled */ }

// حماية جغرافية: الدفع/التفعيل بالسعر المصري (EGP) لا يعمل خارج مصر.
// لو الـ IP معروف إنه بره مصر نرفض تماماً. الدفع بالدولار (USD) شغال في أي
// دولة حتى مصر، فمابنمنعوش. لو الدولة مجهولة مابنمنعش (مش قادرين نثبت إنه بره).
// بترجع نص الخطأ لو مرفوض، أو null لو مسموح.
function egpGeoReject(req) {
  const country = cfg.countryFromReq(req);
  if (country && country !== 'EG') {
    return 'الأسعار المصرية متاحة داخل مصر فقط. من خارج مصر استخدم الدفع بالدولار.';
  }
  return null;
}

// Re-price a plan on the server, applying an optional coupon. Never trust client totals.
function priceFor(planCode, coupon, currency, userId) {
  const plan = cfg.planByCode(planCode);
  if (!plan || plan.is_free) return { error: 'invalid_plan' };
  const usd = currency === 'USD';
  const base = usd ? plan.price_usd : plan.price_egp;
  let amount = base, discount = 0, applied = '';
  if (coupon) {
    const cv = commerce.couponEvaluate(coupon, planCode, base, userId);
    if (cv.ok) { amount = cv.final; discount = cv.discount; applied = String(coupon).toUpperCase(); }
  }
  return { plan, base, amount, discount, applied, currency: usd ? 'USD' : 'EGP' };
}

// GET /api/plans -> public config (plans + methods + support)
async function plans(req, res) {
  const pc = cfg.publicConfig();
  pc.geo = { country: cfg.countryFromReq(req), currency: cfg.currencyForRequest(req) };
  return sendJson(res, 200, pc);
}

// GET /api/pay/methods -> which methods are enabled + manual destinations
async function methods(req, res) {
  const pc = cfg.publicConfig();
  return sendJson(res, 200, { ok: true, methods: pc.methods, support: pc.support });
}

// GET /api/content -> editable public page content (defaults + admin overrides)
async function content(req, res) {
  return sendJson(res, 200, { ok: true, content: cfg.getContent() });
}

// POST /api/coupon/check { code, plan, currency? }
async function couponCheck(req, res, ip) {
  if (!rateLimit('coupon:' + ip, 30, 60000)) return sendJson(res, 429, { error: 'محاولات كتيرة' });
  const b = await readJsonBody(req);
  const currency = String(b.currency || 'EGP').toUpperCase() === 'USD' ? 'USD' : 'EGP';
  const plan = cfg.planByCode(String(b.plan || ''));
  if (!plan || plan.is_free) return sendJson(res, 400, { error: 'invalid_plan' });
  const base = currency === 'USD' ? plan.price_usd : plan.price_egp;
  const me = auth.currentUser(parseCookies(req));
  const cv = commerce.couponEvaluate(String(b.code || ''), plan.code, base, me ? me.id : null);
  if (!cv.ok) return sendJson(res, 200, { ok: true, valid: false, error: cv.error });
  return sendJson(res, 200, {
    ok: true, valid: true, currency, base,
    discount: cv.discount, final: cv.final, type: cv.coupon.type, value: cv.coupon.value,
  });
}

// GET /api/pay/mine -> current user's payment history
async function mine(req, res) {
  const user = requireUser(req, res); if (!user) return;
  const rows = commerce.listUserPayments(user.id).map((p) => ({
    id: p.id, plan: p.plan_code, provider: p.provider, amount: p.amount,
    currency: p.currency, status: p.status, created_at: p.created_at,
  }));
  return sendJson(res, 200, { ok: true, payments: rows });
}

// [FIX H2 — رفع الإيصالات بيخزّن أي بايتات بامتداد صورة]
// الفحص القديم كان على بادئة الـ data URL بس، فأي حد يقدر يبعت
// "data:image/png;base64,<HTML أو سكريبت>" ويتخزن على القرص باسم .png
// ويتقدّم للأدمن بعد كدا. دلوقتي بنفحص التوقيع السحري (magic bytes) للبايتات
// نفسها، ولازم يطابق الامتداد المعلن.
const IMAGE_SIGNATURES = {
  png:  (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  jpg:  (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  webp: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
};

// بترجع نوع الصورة الحقيقي من البايتات، أو null لو مش صورة معروفة.
function sniffImageType(buf) {
  for (const type of Object.keys(IMAGE_SIGNATURES)) {
    if (IMAGE_SIGNATURES[type](buf)) return type;
  }
  return null;
}

function saveReceipt(userId, dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = /^data:(image\/(png|jpeg|jpg|webp));base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) return null;
  const declared = m[2] === 'jpeg' ? 'jpg' : m[2];
  const buf = Buffer.from(m[3], 'base64');
  if (!buf.length || buf.length > 5 * 1024 * 1024) return null;
  // الامتداد بيتحدد من محتوى الملف، مش من كلام العميل.
  const actual = sniffImageType(buf);
  if (!actual) return null;              // مش صورة أصلاً → مرفوض
  if (actual !== declared) return null;  // بيدّعي نوع غير اللي فعلاً بعته → مرفوض
  try { fs.mkdirSync(RECEIPTS, { recursive: true }); } catch (_) {}
  const name = 'r_' + userId + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + actual;
  try { fs.writeFileSync(path.join(RECEIPTS, name), buf); return name; } catch (_) { return null; }
}

// POST /api/pay/manual { plan, method(wallet|instapay), sender, ref?, coupon?, receipt?(dataURL) }
async function manual(req, res, ip) {
  const user = requireUser(req, res); if (!user) return;
  if (!rateLimit('pay:' + ip, 20, 60000)) return sendJson(res, 429, { error: 'محاولات كتيرة' });
  const b = await readJsonBody(req, 8 * 1024 * 1024);
  const method = b.method === 'wallet' ? 'wallet' : 'instapay';
  // الدفع اليدوي دايماً بالجنيه المصري → محظور خارج مصر.
  const geoErr = egpGeoReject(req);
  if (geoErr) return sendJson(res, 403, { error: geoErr, code: 'egp_geo_blocked' });
  const price = priceFor(String(b.plan || ''), b.coupon, 'EGP', user.id);
  if (price.error) {
    // [FIX-16] Return Arabic message so friendlyError shows it directly (no underscores)
    const priceMsg = price.error === 'invalid_plan' ? 'الباقة المختارة غير موجودة، اختار باقة أخرى أو تواصل مع الدعم'
                   : price.error === 'no_price' ? 'سعر الباقة غير متاح في عملتك'
                   : 'خطأ في بيانات الباقة، حاول تاني';
    console.error('[pay.manual] priceFor error:', price.error, 'plan:', b.plan);
    return sendJson(res, 400, { error: priceMsg });
  }
  // [FIX] بيانات مصدر التحويل: نوع المحفظة + خانة «حوّلت من» المرنة.
  // دي بيانات مصدر التحويل بس — مش مطلوب تطابق رقم الحساب ولا بتتأكد.
  const WALLET_LABELS = { vodafone: 'Vodafone Cash', etisalat: 'Etisalat Cash', orange: 'Orange Cash', wepay: 'WE Pay', other: 'أخرى' };
  const wallet = method === 'wallet'
    ? (WALLET_LABELS[String(b.wallet || '')] ? String(b.wallet) : 'other')
    : '';
  const walletLabel = wallet ? WALLET_LABELS[wallet] : '';
  const sender = String(b.sender || '').trim().slice(0, 120); // [FIX] مصدر التحويل المرن (رقم/username/مُعرّف)
  const ref = String(b.ref || '').trim().slice(0, 120);
  const receipt = saveReceipt(user.id, b.receipt);

  const meta = { method, wallet, walletLabel, sender, ref, receipt, coupon: price.applied, discount: price.discount };
  let payId;
  try {
    payId = commerce.createPayment({
      userId: user.id, planCode: price.plan.code, provider: 'instapay',
      amount: price.amount, currency: 'EGP', status: 'pending', ref: ref || null, meta,
    });
  } catch (payErr) {
    console.error('[pay.manual] createPayment threw:', payErr);
    return sendJson(res, 500, { error: 'خطأ في تسجيل الطلب، حاول تاني لو المشكلة فضلت تواصل مع الدعم' });
  }
  // [FIX C4] الكوبون مابيتحرقش هنا. الدفعة لسه pending، ولو العميل ساب الصفحة
  // كان الكوبون بيضيع. الحرق بقى جوّا commerce.approvePayment() وقت التأكيد.
  db.audit(user.id, 'payment_manual:' + payId, ip);

  const wa = String(cfg.getSupport().whatsapp || '').replace(/\D+/g, '');
  const lines = [
    'طلب تفعيل اشتراك ElForma',
    'رقم الطلب: #' + payId,
    'الاسم: ' + (user.name || '—') + ' | الإيميل: ' + user.email,
    'الباقة: ' + price.plan.name + ' — ' + price.amount + ' ج.م' + (price.applied ? ' (كوبون ' + price.applied + ': -' + price.discount + ')' : ''),
    'الطريقة: ' + (method === 'wallet' ? ('محفظة' + (walletLabel ? ' — ' + walletLabel : '')) : 'InstaPay'),
    'حوّلت من: ' + (sender || '—'),
  ];
  if (ref) lines.push('المرجع: ' + ref);
  const waUrl = wa ? ('https://wa.me/' + wa + '?text=' + encodeURIComponent(lines.join('\n'))) : '';

  return sendJson(res, 200, {
    ok: true, payment_id: payId, amount_egp: price.amount,
    instapay_handle: cfg.getSupport().instapay_handle, wallet_number: cfg.getSupport().wallet_number,
    wa_url: waUrl, receipt_saved: !!receipt,
  });
}

// POST /api/pay/paymob { plan, coupon? } -> { iframe_url }
async function paymob(req, res, ip) {
  const user = requireUser(req, res); if (!user) return;
  if (!cfg.PAYMOB.enabled) return sendJson(res, 501, { error: 'paymob_not_configured' });
  const b = await readJsonBody(req);
  // Paymob بالجنيه المصري → محظور خارج مصر.
  const geoErr = egpGeoReject(req);
  if (geoErr) return sendJson(res, 403, { error: geoErr, code: 'egp_geo_blocked' });
  const price = priceFor(String(b.plan || ''), b.coupon, 'EGP', user.id);
  if (price.error) {
    // [FIX-16] Return Arabic message so friendlyError shows it directly (no underscores)
    const priceMsg = price.error === 'invalid_plan' ? 'الباقة المختارة غير موجودة، اختار باقة أخرى أو تواصل مع الدعم'
                   : price.error === 'no_price' ? 'سعر الباقة غير متاح في عملتك'
                   : 'خطأ في بيانات الباقة، حاول تاني';
    console.error('[pay.manual] priceFor error:', price.error, 'plan:', b.plan);
    return sendJson(res, 400, { error: priceMsg });
  }
  const orderRef = 'EF-' + user.id + '-' + Date.now();
  const payId = commerce.createPayment({
    userId: user.id, planCode: price.plan.code, provider: 'paymob',
    amount: price.amount, currency: 'EGP', status: 'pending', ref: orderRef,
    meta: { coupon: price.applied, discount: price.discount },
  });
  try {
    const r = await providers.paymobCheckout({ amountEgp: price.amount, user, planCode: price.plan.code, orderRef });
    // [FIX C4] فتح صفحة الدفع مش دفع. الكوبون بيتحرق في approvePayment() بعد
    // ما الـ webhook يأكد نجاح العملية.
    return sendJson(res, 200, { ok: true, payment_id: payId, iframe_url: r.iframe_url });
  } catch (e) {
    commerce.setPaymentStatus(payId, 'failed');
    return sendJson(res, e.statusCode || 502, { error: 'paymob_error', detail: e.message });
  }
}

// POST /api/pay/paymob/webhook -> Paymob transaction callback (HMAC verified upstream in prod)
async function paymobWebhook(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const providedHmac = url.searchParams.get('hmac') || '';
  const b = await readJsonBody(req, 256 * 1024);
  const obj = (b && b.obj) || {};
  // Security gate: reject any webhook we cannot cryptographically verify.
  if (!cfg.PAYMOB.hmac || !providers.verifyPaymobHmac(obj, providedHmac, cfg.PAYMOB.hmac)) {
    return sendJson(res, 403, { error: 'invalid_hmac' });
  }
  const ref = obj.order && (obj.order.merchant_order_id || obj.order.id);
  const success = obj.success === true || obj.success === 'true';
  if (ref) {
    const p = commerce.getPaymentByRef(String(ref));
    if (p && p.status !== 'paid') {
      if (success) commerce.approvePayment(p.id, 'paymob');
      else commerce.setPaymentStatus(p.id, 'failed');
    }
  }
  return sendJson(res, 200, { ok: true });
}

// POST /api/pay/paypal/create { plan, coupon? } -> { id, payment_id }
async function paypalCreate(req, res) {
  const user = requireUser(req, res); if (!user) return;
  if (!cfg.PAYPAL.enabled) return sendJson(res, 501, { error: 'paypal_not_configured' });
  const b = await readJsonBody(req);
  const price = priceFor(String(b.plan || ''), b.coupon, 'USD', user.id);
  if (price.error) {
    // [FIX-16] Return Arabic message so friendlyError shows it directly (no underscores)
    const priceMsg = price.error === 'invalid_plan' ? 'الباقة المختارة غير موجودة، اختار باقة أخرى أو تواصل مع الدعم'
                   : price.error === 'no_price' ? 'سعر الباقة غير متاح في عملتك'
                   : 'خطأ في بيانات الباقة، حاول تاني';
    console.error('[pay.manual] priceFor error:', price.error, 'plan:', b.plan);
    return sendJson(res, 400, { error: priceMsg });
  }
  const orderRef = 'EF-' + user.id + '-' + Date.now();
  const payId = commerce.createPayment({
    userId: user.id, planCode: price.plan.code, provider: 'paypal',
    amount: price.amount, currency: 'USD', status: 'pending', ref: orderRef,
    meta: { coupon: price.applied, discount: price.discount },
  });
  try {
    const r = await providers.paypalCreate({ amountUsd: price.amount, orderRef });
    commerce.setPaymentStatus(payId, 'pending', r.id);
    return sendJson(res, 200, { ok: true, id: r.id, payment_id: payId });
  } catch (e) {
    commerce.setPaymentStatus(payId, 'failed');
    return sendJson(res, e.statusCode || 502, { error: 'paypal_error', detail: e.message });
  }
}

// POST /api/pay/paypal/capture { orderId } -> approves on success
async function paypalCapture(req, res) {
  const user = requireUser(req, res); if (!user) return;
  if (!cfg.PAYPAL.enabled) return sendJson(res, 501, { error: 'paypal_not_configured' });
  const b = await readJsonBody(req);
  const orderId = String(b.orderId || '');
  const p = commerce.getPaymentByRef(orderId);
  if (!p || p.user_id !== user.id) return sendJson(res, 404, { error: 'payment_not_found' });
  try {
    const r = await providers.paypalCapture({ orderId });
    if (r.ok) { commerce.approvePayment(p.id, 'paypal'); return sendJson(res, 200, { ok: true, status: 'paid' }); }
    commerce.setPaymentStatus(p.id, 'failed');
    return sendJson(res, 402, { error: 'not_completed', status: r.status });
  } catch (e) {
    return sendJson(res, e.statusCode || 502, { error: 'paypal_error', detail: e.message });
  }
}

module.exports = { plans, methods, content, couponCheck, mine, manual, paymob, paymobWebhook, paypalCreate, paypalCapture };
