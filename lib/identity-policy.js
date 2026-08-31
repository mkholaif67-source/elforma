'use strict';
// lib/identity-policy.js — [OWNER-RULE] سياسة الهوية: إيميلات رسمية معروفة فقط
// (ممنوع المؤقت/الوهمي) + فحص اسم المستخدم.
//
// ليه allowlist مش blocklist بس؟ لأن دومينات الإيميل المؤقت بتتولد بالآلاف
// كل يوم؛ أي blocklist هتفضل متأخرة. المزودين الرسميين محدودين ومستقرين،
// فالـ allowlist هي الطريقة الوحيدة اللي بتقفل الباب فعليًا.
//
// ملحوظة: دومينات الشركات/الجامعات مسموحة برضه (مش من المزودين العامين)
// طالما مش في قائمة المؤقت وشكل الدومين سليم — عشان مانمنعش عميل حقيقي.

// مزودو البريد المعروفين والمشهورين (مقبولين دائمًا).
const KNOWN_PROVIDERS = new Set([
  // Google
  'gmail.com', 'googlemail.com',
  // Microsoft
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.sa', 'outlook.eg',
  'hotmail.co.uk', 'live.co.uk', 'outlook.fr', 'outlook.de', 'outlook.es', 'outlook.it',
  // Yahoo
  'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.es', 'yahoo.it',
  'yahoo.ca', 'yahoo.com.au', 'ymail.com', 'rocketmail.com',
  // Apple
  'icloud.com', 'me.com', 'mac.com',
  // مزودين محترمين ومستقرين
  'proton.me', 'protonmail.com', 'pm.me',
  'zoho.com', 'zohomail.com',
  'aol.com', 'gmx.com', 'gmx.de', 'gmx.net',
  'mail.com', 'yandex.com', 'yandex.ru',
  'fastmail.com', 'hey.com', 'tutanota.com', 'tuta.com',
  // إقليمي/مصري وعربي شائع
  'link.net', 'tedata.net.eg', 'orange.eg', 'vodafone.com.eg', 'etisalat.eg',
]);

// قائمة حظر للإيميل المؤقت/الوهمي المشهور (طبقة ثانية فوق الـ allowlist).
const DISPOSABLE = new Set([
  'mailinator.com', 'yopmail.com', 'guerrillamail.com', 'guerrillamail.net',
  'sharklasers.com', 'grr.la', 'temp-mail.org', 'tempmail.com', 'tempmail.net',
  '10minutemail.com', '10minutemail.net', 'minuteinbox.com', 'throwawaymail.com',
  'trashmail.com', 'trashmail.net', 'getnada.com', 'nada.email', 'dispostable.com',
  'maildrop.cc', 'mailnesia.com', 'mohmal.com', 'emailondeck.com', 'fakeinbox.com',
  'tempinbox.com', 'mytemp.email', 'moakt.com', 'tmpmail.org', 'burnermail.io',
  'spamgourmet.com', 'mailcatch.com', 'inboxbear.com', 'harakirimail.com',
  'discard.email', 'anonaddy.me', 'simplelogin.com', 'temp-mail.io', 'tmail.com',
  'dropmail.me', 'emltmp.com', 'linshiyouxiang.net', 'mail-temp.com', 'luxusmail.org',
]);

// أنماط دومينات الإيميل المؤقت اللي بتتولد باستمرار (طبقة ثالثة).
const DISPOSABLE_PATTERNS = [
  /(^|\.)temp[-.]?mail\./i,
  /(^|\.)tempmail/i,
  /(^|\.)\d+minutemail\./i,
  /(^|\.)throwaway/i,
  /(^|\.)trashmail/i,
  /(^|\.)fakemail/i,
  /(^|\.)disposable/i,
  /(^|\.)guerrilla/i,
  /(^|\.)mailinator/i,
  /(^|\.)yopmail/i,
];

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function domainOf(email) {
  const at = String(email || '').lastIndexOf('@');
  return at < 0 ? '' : String(email).slice(at + 1).trim().toLowerCase();
}

/**
 * يتحقق من البريد حسب سياسة صاحب المشروع.
 * @returns {null|string} null يعني مقبول، وغير كده رسالة خطأ عربية.
 */
function emailProblem(email, opts) {
  const o = opts || {};
  const raw = String(email || '').trim().toLowerCase();
  if (!raw) return 'اكتب بريدك الإلكتروني';
  if (raw.length > 254) return 'البريد الإلكتروني طويل أوي';
  if (!EMAIL_RE.test(raw)) return 'البريد الإلكتروني غير صحيح';

  const domain = domainOf(raw);
  if (!domain || domain.indexOf('.') < 0) return 'البريد الإلكتروني غير صحيح';
  if (domain.indexOf('..') >= 0 || domain.startsWith('-') || domain.startsWith('.')) {
    return 'البريد الإلكتروني غير صحيح';
  }

  // دومينات اختبار/محلية ماتنفعش لحساب حقيقي.
  if (/\.(test|local|localhost|invalid|example)$/i.test(domain)) {
    return 'استخدم بريد إلكتروني حقيقي';
  }

  // طبقة 1: قائمة الحظر الصريحة.
  if (DISPOSABLE.has(domain)) return 'البريد المؤقت مش مقبول — استخدم بريد رسمي زي Gmail أو Outlook';

  // طبقة 2: أنماط الدومينات المؤقتة.
  for (let i = 0; i < DISPOSABLE_PATTERNS.length; i++) {
    if (DISPOSABLE_PATTERNS[i].test(domain)) {
      return 'البريد المؤقت مش مقبول — استخدم بريد رسمي زي Gmail أو Outlook';
    }
  }

  // طبقة 3: لو الوضع المتشدد شغال (الافتراضي) — مزودين معروفين فقط.
  const strict = o.strict !== false;
  if (strict && !KNOWN_PROVIDERS.has(domain)) {
    return 'استخدم بريد رسمي معروف (Gmail · Outlook · Yahoo · iCloud · Proton)';
  }
  return null;
}

/**
 * يطبّع البريد: حروف صغيرة، وفي Gmail بنشيل النقط والـ +tag
 * عشان ماحدش يعمل عشر حسابات من نفس الإيميل (ويكرر التجربة المجانية).
 */
function canonicalEmail(email) {
  const raw = String(email || '').trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at < 0) return raw;
  let local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
    return local + '@gmail.com';
  }
  return local + '@' + domain;
}

// أسماء محجوزة ماينفعش حد ياخدها (انتحال صفة).
const RESERVED_NAMES = new Set([
  'admin', 'administrator', 'root', 'support', 'help', 'system', 'moderator',
  'elforma', 'forma', 'el forma', 'forma coach', 'coach', 'staff', 'owner',
  'الفورما', 'الفورمة', 'مدرب فورما', 'المدرب', 'الادمن', 'الإدارة', 'الدعم',
]);

// حروف مسموحة: عربي + إنجليزي + مسافة + شرطة ونقطة وأبوستروف.
const NAME_ALLOWED = /^[\u0621-\u064A\u0660-\u0669a-zA-Z0-9 .'\-_]+$/;

/**
 * فحص اسم المستخدم (اليوزر نيم).
 * @returns {null|string} null يعني مقبول، وغير كده رسالة خطأ عربية.
 */
function nameProblem(name) {
  const raw = String(name == null ? '' : name).trim().replace(/\s+/g, ' ');
  if (!raw) return 'اكتب اسمك';
  if (raw.length < 2) return 'الاسم قصير أوي — حرفين على الأقل';
  if (raw.length > 40) return 'الاسم طويل أوي — 40 حرف كحد أقصى';
  if (!NAME_ALLOWED.test(raw)) return 'الاسم فيه رموز مش مسموحة — حروف وأرقام بس';
  if (/^[0-9]+$/.test(raw)) return 'الاسم ماينفعش يكون أرقام بس';
  // حرف مكرر أكتر من 4 مرات ورا بعض = عبث (aaaaa).
  if (/(.)\1{4,}/.test(raw)) return 'اكتب اسم حقيقي من فضلك';
  if (RESERVED_NAMES.has(raw.toLowerCase())) return 'الاسم ده محجوز — اختار اسم تاني';
  return null;
}

/** يطبّع الاسم قبل الحفظ (مسافات مرتبة + طول محدود). */
function cleanName(name) {
  return String(name == null ? '' : name).trim().replace(/\s+/g, ' ').slice(0, 40);
}

module.exports = {
  emailProblem, canonicalEmail, nameProblem, cleanName,
  KNOWN_PROVIDERS, DISPOSABLE, domainOf,
};
