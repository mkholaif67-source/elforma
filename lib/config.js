'use strict';
// Central commerce configuration: plans, support handles, payment providers, admins.
// Anything sensitive comes from environment variables; safe defaults for dev.

function env(name, def) {
  const v = process.env[name];
  return (v === undefined || v === null || v === '') ? def : v;
}

// --- Subscription plans (single source of truth for pricing) ---
// Prices in EGP (piastres NOT used — whole pounds). USD is a rough convenience price.
const PLANS = [
  // [OWNER-RULE] الباقة المجانية (trial3) اتشالت تمامًا من قائمة الباقات.
  // التجربة المجانية (3 أيام) مابقتش Package يختارها المستخدم — بتتفعّل تلقائيًا
  // وقت إنشاء الحساب في api/auth.js (commerce.startTrial). القائمة دي بقت
  // باقات مدفوعة بس، فمفيش أي عنصر is_free/is_trial بيتعرض للمستخدم.
  {
    code: 'm1', name: 'شهر', months: 1,
    price_egp: 150, anchor_egp: 200, price_usd: 8, anchor_usd: 11,
    tagline: 'مرونة كاملة', badge: '', is_free: 0,
  },
  {
    code: 'm3', name: '3 شهور', months: 3,
    price_egp: 350, anchor_egp: 450, price_usd: 18, anchor_usd: 25,
    tagline: '≈ 117 ج.م / شهر', badge: 'الأكثر اختيارا', popular: true, is_free: 0,
  },
  {
    code: 'm6', name: '6 شهور', months: 6,
    price_egp: 600, anchor_egp: 800, price_usd: 28, anchor_usd: 40,
    tagline: '≈ 100 ج.م / شهر · أرخص سعر شهري', badge: 'أفضل قيمة', best: true, is_free: 0,
  },
];

// Optional DB-backed overrides (pricing + content). Loaded lazily; safe if missing.
let settings = null;
try { settings = require('./settings'); } catch (_) { settings = null; }
function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }

// Base plans overlaid with any admin pricing overrides from the settings store.
function getPlans() {
  let ov = {};
  if (settings) { try { ov = settings.getJSON('pricing', {}) || {}; } catch (_) { ov = {}; } }
  return PLANS.map((p) => {
    const o = ov[p.code] || {};
    return Object.assign({}, p, {
      price_egp: num(o.price_egp, p.price_egp),
      anchor_egp: num(o.anchor_egp, p.anchor_egp),
      price_usd: num(o.price_usd, p.price_usd),
      anchor_usd: num(o.anchor_usd, p.anchor_usd),
      badge: (o.badge != null && String(o.badge) !== '') ? String(o.badge) : p.badge,
      tagline: (o.tagline != null && String(o.tagline).trim() !== '') ? String(o.tagline) : p.tagline,
    });
  });
}

// Admin-defined extra plans live in the settings store so they survive deploys
// without a schema change. Always returns an array, never throws.
function getCustomPlans() {
  if (!settings) return [];
  let list = [];
  try { list = settings.getJSON('custom_plans', []) || []; } catch (_) { list = []; }
  if (!Array.isArray(list)) return [];
  return list.filter((p) => p && p.code && p.name).map((p) => ({
    code: String(p.code), name: String(p.name),
    months: num(p.months, 1),
    price_egp: num(p.price_egp, 0), anchor_egp: num(p.anchor_egp, 0),
    price_usd: num(p.price_usd, 0), anchor_usd: num(p.anchor_usd, 0),
    tagline: String(p.tagline || ''), badge: String(p.badge || ''),
    is_free: 0, is_trial: 0, custom: true,
  }));
}

// Base plans first, then any admin-created ones. Used by lookups so a custom
// plan code resolves everywhere a built-in code does (checkout, activation...).
function allPlans() {
  return getPlans().concat(getCustomPlans());
}

function planByCode(code) {
  return allPlans().find((p) => p.code === code) || null;
}

// --- Geo / currency detection (IP-based via edge headers; tz fallback client-side) ---
function countryFromReq(req) {
  const h = (req && req.headers) || {};
  const c = h['cf-ipcountry'] || h['x-vercel-ip-country'] || h['x-appengine-country'] ||
            h['x-country-code'] || h['x-geo-country'] || h['fastly-geo-country'] || '';
  const up = String(c).toUpperCase();
  return (up && up !== 'XX' && up !== 'T1') ? up : null;
}
// 'EGP' for Egypt, 'USD' for everyone else, null when unknown (client decides by tz).
function currencyForRequest(req) {
  const c = countryFromReq(req);
  if (!c) return null;
  return c === 'EG' ? 'EGP' : 'USD';
}

// --- Support / manual-payment destinations (public, non-secret) ---
const SUPPORT = {
  whatsapp: env('EF_WHATSAPP', '201020317947') // [FIX-16] matches wallet number in intl format,          // digits only, intl format
  instapay_handle: env('EF_INSTAPAY', 'elforma@instapay'),
  wallet_number: env('EF_WALLET', '01020317947'),
  email: env('EF_SUPPORT_EMAIL', 'support@elforma.app'),
};

// --- Payment provider config (secrets from env; empty = provider disabled) ---
const PAYMOB = {
  enabled: !!env('EF_PAYMOB_API_KEY', ''),
  api_key: env('EF_PAYMOB_API_KEY', ''),
  integration_id: env('EF_PAYMOB_INTEGRATION_ID', ''),
  iframe_id: env('EF_PAYMOB_IFRAME_ID', ''),
  hmac: env('EF_PAYMOB_HMAC', ''),
};
const PAYPAL = {
  enabled: !!env('EF_PAYPAL_CLIENT_ID', ''),
  client_id: env('EF_PAYPAL_CLIENT_ID', ''),
  secret: env('EF_PAYPAL_SECRET', ''),
  mode: env('EF_PAYPAL_MODE', 'live') === 'sandbox' ? 'sandbox' : 'live',
};

// Manual payment (wallet / InstaPay) is always available.
const MANUAL_ENABLED = true;

// --- Admin allowlist (comma-separated emails) ---
const ADMIN_EMAILS = String(env('EF_ADMIN_EMAILS', 'mokholaif7@gmail.com'))
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.includes(String(email).toLowerCase());
}

const APP = {
  base_url: env('EF_BASE_URL', 'http://localhost:' + env('PORT', '8000')),
  env: env('EF_ENV', 'development'),
};

// --- Editable page content (defaults overlaid with admin overrides) ---
const CONTENT_FIELDS = [
  { key: 'hero_tag', label: 'شارة أعلى الهيرو', type: 'text' },
  { key: 'hero_title', label: 'عنوان الهيرو السطر الأول', type: 'text' },
  { key: 'hero_highlight', label: 'عنوان الهيرو السطر المميز', type: 'text' },
  { key: 'hero_sub', label: 'وصف الهيرو', type: 'textarea' },
  { key: 'hero_cta', label: 'زر الهيرو الرئيسي', type: 'text' },
  { key: 'hero_note', label: 'ملاحظة تحت أزرار الهيرو', type: 'text' },
  { key: 'pricing_title', label: 'عنوان قسم الأسعار', type: 'text' },
  { key: 'pricing_sub', label: 'وصف قسم الأسعار', type: 'text' },
  { key: 'cta_title', label: 'عنوان الدعوة الأخيرة', type: 'text' },
  { key: 'cta_sub', label: 'وصف الدعوة الأخيرة', type: 'text' },
  { key: 'support_whatsapp', label: 'واتساب الدعم (أرقام فقط)', type: 'text' },
  { key: 'support_instapay', label: 'حساب InstaPay', type: 'text' },
  { key: 'support_wallet', label: 'رقم المحفظة', type: 'text' },
  { key: 'support_email', label: 'إيميل الدعم', type: 'text' },
  // Social & Branding
  { key: 'logo_url', label: 'رابط اللوجو', type: 'text' },
  { key: 'app_name', label: 'اسم التطبيق', type: 'text' },
  { key: 'social_facebook', label: 'رابط Facebook', type: 'text' },
  { key: 'social_instagram', label: 'رابط Instagram', type: 'text' },
  { key: 'social_tiktok', label: 'رابط TikTok', type: 'text' },
  { key: 'social_twitter', label: 'رابط Twitter / X', type: 'text' },
  { key: 'social_youtube', label: 'رابط YouTube', type: 'text' },
];
const CONTENT_DEFAULTS = {
  hero_tag: 'تمرين + تغذية في منصة واحدة',
  hero_title: 'جسمك اللي نفسك فيه',
  hero_highlight: 'بخطة ذكية موصولة ليك انت',
  hero_sub: 'بطل تخمين وتشتت. ElForma بيبنيلك جدول تمرين وخطة أكل مخصصين 100% حسب جسمك وهدفك وميزانيتك بوجبات مصرية واقعية ومتابعة تمشي معاك خطوة بخطوة',
  hero_cta: 'ابدأ خطتك دلوقتي - ',
  hero_note: 'ابدأ مجانا · مفيش كرت ائتمان · بياناتك محفوظة ومتزامنة على كل أجهزتك',
  pricing_title: 'اختار الخطة اللي تناسبك',
  pricing_sub: 'كلما التزامك أطول وفرت أكتر ونتيجتك تبقى أوضح',
  cta_title: 'جاهز تبدأ رحلتك؟',
  cta_sub: 'دقائق وتطلع بخطة تمرين وتغذية مخصصة ليك انت',
};
function getContent() {
  const base = Object.assign({}, CONTENT_DEFAULTS, {
    support_whatsapp: SUPPORT.whatsapp,
    support_instapay: SUPPORT.instapay_handle,
    support_wallet: SUPPORT.wallet_number,
    support_email: SUPPORT.email,
  });
  let ov = {};
  if (settings) { try { ov = settings.getJSON('content', {}) || {}; } catch (_) { ov = {}; } }
  const out = Object.assign({}, base);
  for (const k in ov) { if (Object.prototype.hasOwnProperty.call(ov, k) && ov[k] != null && String(ov[k]).trim() !== '') out[k] = String(ov[k]); }
  return out;
}
function getSupport() {
  const c = getContent();
  return { whatsapp: c.support_whatsapp, instapay_handle: c.support_instapay, wallet_number: c.support_wallet, email: c.support_email };
}

// --- Account-country timezone (primary IANA zone + fixed UTC offset in minutes) ---
// Used to (a) rotate the 4-day meal cycle on the trainee's own calendar day and
// (b) schedule meal reminders on the account country's clock instead of Cairo.
const COUNTRY_TZ = {
  EG:['Africa/Cairo',120], SA:['Asia/Riyadh',180], AE:['Asia/Dubai',240],
  KW:['Asia/Kuwait',180], QA:['Asia/Qatar',180], BH:['Asia/Bahrain',180],
  OM:['Asia/Muscat',240], JO:['Asia/Amman',180], LB:['Asia/Beirut',180],
  IQ:['Asia/Baghdad',180], DZ:['Africa/Algiers',60], MA:['Africa/Casablanca',60],
  TN:['Africa/Tunis',60], LY:['Africa/Tripoli',120], SD:['Africa/Khartoum',120],
  SY:['Asia/Damascus',180], PS:['Asia/Gaza',120], YE:['Asia/Aden',180],
  MR:['Africa/Nouakchott',0], SO:['Africa/Mogadishu',180], US:['America/New_York',-300],
  GB:['Europe/London',0], FR:['Europe/Paris',60], DE:['Europe/Berlin',60],
  TR:['Europe/Istanbul',180], IT:['Europe/Rome',60], ES:['Europe/Madrid',60],
  CA:['America/Toronto',-300],
};
function tzForCountry(code) {
  const z = COUNTRY_TZ[String(code || '').toUpperCase()] || COUNTRY_TZ.EG;
  return { iana: z[0], offsetMinutes: z[1] };
}

module.exports = {
  PLANS, planByCode, getPlans, getCustomPlans, allPlans, getContent, getSupport, CONTENT_FIELDS, CONTENT_DEFAULTS, SUPPORT, PAYMOB, PAYPAL, MANUAL_ENABLED,
  ADMIN_EMAILS, isAdminEmail, APP, countryFromReq, currencyForRequest, tzForCountry,
  // public subset safe to expose to the browser
  publicConfig() {
    const s = getSupport();
    return {
      plans: getPlans().map((p) => ({
        code: p.code, name: p.name, months: p.months,
        price_egp: p.price_egp, anchor_egp: p.anchor_egp,
        price_usd: p.price_usd, anchor_usd: p.anchor_usd,
        tagline: p.tagline, badge: p.badge || '', popular: !!p.popular, best: !!p.best,
        is_free: p.is_free ? 1 : 0, is_trial: p.is_trial ? 1 : 0,
        trial_days: p.trial_days || 0,
      })),
      support: { whatsapp: s.whatsapp, instapay_handle: s.instapay_handle, wallet_number: s.wallet_number, email: s.email },
      methods: {
        card: PAYMOB.enabled,
        paypal: PAYPAL.enabled,
        wallet: MANUAL_ENABLED,
        instapay: MANUAL_ENABLED,
        paypal_client_id: PAYPAL.client_id, paypal_mode: PAYPAL.mode,
      },
    };
  },
};
