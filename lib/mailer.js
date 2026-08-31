'use strict';
// Dependency-free mailer + one-time token store (email verification & password reset).
// In development, emails are written to data/outbox/*.eml and the action link is
// returned to the caller so the flow is fully testable without a live SMTP server.
// In production, wire a real transport in `deliver()` (SMTP/API) via env.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { APP, SUPPORT } = require('./config');

const PROD = APP.env === 'production';
const DATA_DIR = process.env.EF_DATA_DIR || path.join(__dirname, '..', 'data');
const OUTBOX = path.join(DATA_DIR, 'outbox');

const h = db.db;
const now = () => new Date().toISOString();

h.exec(`
CREATE TABLE IF NOT EXISTS email_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  type        TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

const q = {
  insert: h.prepare('INSERT INTO email_tokens (user_id, type, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'),
  find: h.prepare('SELECT * FROM email_tokens WHERE token_hash = ? AND type = ?'),
  markUsed: h.prepare('UPDATE email_tokens SET used = 1 WHERE id = ?'),
  invalidateType: h.prepare('UPDATE email_tokens SET used = 1 WHERE user_id = ? AND type = ? AND used = 0'),
};

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// Create a one-time token, store only its hash, return the raw token.
function createToken(userId, type, ttlSeconds) {
  q.invalidateType.run(userId, type); // one active token per type
  const raw = crypto.randomBytes(32).toString('hex');
  const exp = new Date(Date.now() + (ttlSeconds || 86400) * 1000).toISOString();
  q.insert.run(userId, type, sha(raw), exp, now());
  return raw;
}

// Consume a token: returns userId if valid & unused & unexpired, else null.
function consumeToken(raw, type) {
  const row = q.find.get(sha(raw), type);
  if (!row || row.used) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  q.markUsed.run(row.id);
  return row.user_id;
}

// Low-level delivery. Always archives the message to the outbox on disk, then
// hands it to the configured HTTPS transport when one is set.
function deliver(to, subject, html) {
  try { fs.mkdirSync(OUTBOX, { recursive: true }); }
  catch (e) { console.error('[mailer] cannot create the outbox directory:', e && e.message); }
  const eml =
    'To: ' + to + '\n' +
    'From: ElForma <' + SUPPORT.email + '>\n' +
    'Subject: ' + subject + '\n' +
    'Content-Type: text/html; charset=utf-8\n\n' + html;
  const file = path.join(OUTBOX, Date.now() + '_' + sha(to + subject).slice(0, 8) + '.eml');
  // If this write fails the token is unrecoverable, so it must never be silent.
  let archived = false;
  try { fs.writeFileSync(file, eml); archived = true; }
  catch (e) { console.error('[mailer] could not archive the email to disk:', e && e.message); }
  if (!PROD) console.log('[mailer] (dev) queued email to', to, '->', file);

  // Production transport. Any HTTPS email API works (Resend, Postmark, Brevo...)
  // because they all accept the same minimal JSON body. Configure:
  //   EF_MAIL_API_URL, EF_MAIL_API_KEY, and optionally EF_MAIL_FROM.
  // The outbox copy above is always kept, so a transport outage never loses
  // the token -- it can still be read off the disk.
  const url = process.env.EF_MAIL_API_URL;
  const key = process.env.EF_MAIL_API_KEY;
  if (url && key) {
    const from = process.env.EF_MAIL_FROM || ('ElForma <' + SUPPORT.email + '>');
    // Fire-and-forget: a slow mail provider must never block the HTTP response
    // the user is waiting on.
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({ from: from, to: [to], subject: subject, html: html }),
    })
      .then((r) => { if (!r.ok) console.error('[mailer] transport rejected the email:', r.status); })
      .catch((e) => console.error('[mailer] transport failed:', e && e.message));
    return { ok: true, file: archived ? file : null, sent: true };
  }
  if (PROD) console.error('[mailer] EF_MAIL_API_URL/EF_MAIL_API_KEY are not set — email was recorded to the outbox only.');
  return { ok: archived, file: archived ? file : null, sent: false };
}

function wrap(title, bodyHtml) {
  return `<div style="font-family:Tajawal,Arial,sans-serif;direction:rtl;background:#0a0f1c;color:#e8eefc;padding:28px;border-radius:16px;max-width:520px;margin:auto">
  <h2 style="margin:0 0 12px">${title}</h2>${bodyHtml}
  <p style="color:#9fb0cc;font-size:12px;margin-top:24px">— فريق ElForma</p></div>`;
}

function sendVerify(user, link) {
  const html = wrap('أكد بريدك الإلكتروني', `
    <p>أهلا ${user.name || ''}، اضغط الزر لتفعيل حسابك:</p>
    <p><a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#22d3a6,#3b82f6);color:#04210a;font-weight:800;padding:12px 22px;border-radius:10px;text-decoration:none">تفعيل الحساب</a></p>
    <p style="color:#9fb0cc;font-size:13px">الرابط صالح لمدة 24 ساعة.</p>`);
  return deliver(user.email, 'فعل حسابك ElForma', html);
}

function sendReset(user, link) {
  const html = wrap('إعادة تعيين كلمة المرور', `
    <p>وصلنا طلب لإعادة تعيين كلمة المرور. لو مش انت، تجاهل الرسالة.</p>
    <p><a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#22d3a6,#3b82f6);color:#04210a;font-weight:800;padding:12px 22px;border-radius:10px;text-decoration:none">تعيين كلمة مرور جديدة</a></p>
    <p style="color:#9fb0cc;font-size:13px">الرابط صالح لمدة ساعة واحدة.</p>`);
  return deliver(user.email, 'إعادة تعيين كلمة المرور ElForma', html);
}

module.exports = { createToken, consumeToken, deliver, sendVerify, sendReset, PROD };
