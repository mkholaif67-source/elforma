'use strict';
// GENERATED-BY-BATCH12
// ============================================================
//  NIGHTLY BACKUP  (runs inside the web service)
//
//  The previous design was a Render cron running scripts/backup-db.sh.
//  It could never have worked: the Docker image did not contain scripts/,
//  the image has no sqlite3 CLI, and a Render disk cannot be attached to
//  two services at once. The result was zero backups, reported as success.
//
//  This module needs none of that. It uses SQLite's own VACUUM INTO, which
//  produces a consistent copy of a live database from inside the running
//  process, then gzips it and prunes old copies.
// ============================================================

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.EF_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'elforma.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP = Math.max(1, parseInt(process.env.EF_BACKUP_KEEP || '30', 10) || 30);

// 02:10 UTC = 04:10 Cairo, the quietest hour for this audience.
const HOUR_UTC = 2;
const MINUTE_UTC = 10;
const CHECK_EVERY_MS = 15 * 60 * 1000;

function stamp(d) {
  return d.toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function runBackup() {
  if (!fs.existsSync(DB_PATH)) return { ok: false, reason: 'no database yet' };
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const target = path.join(BACKUP_DIR, 'elforma-' + stamp(new Date()) + '.db');
  fs.rmSync(target, { force: true });

  // VACUUM INTO is atomic and safe against a live, WAL-mode database.
  const src = new DatabaseSync(DB_PATH);
  try {
    src.exec("VACUUM INTO '" + target.replace(/'/g, "''") + "'");
  } finally {
    try { src.close(); } catch (e) { /* already closed */ }
  }

  // A backup nobody verified is not a backup.
  const copy = new DatabaseSync(target);
  let integrity = 'unknown';
  try {
    const row = copy.prepare('PRAGMA integrity_check').get();
    integrity = row && (row.integrity_check || row['integrity_check']) || 'unknown';
  } finally {
    try { copy.close(); } catch (e) { /* already closed */ }
  }
  if (integrity !== 'ok') {
    fs.rmSync(target, { force: true });
    return { ok: false, reason: 'integrity_check = ' + integrity };
  }

  const gz = target + '.gz';
  fs.writeFileSync(gz, zlib.gzipSync(fs.readFileSync(target)));
  fs.rmSync(target, { force: true });

  const kept = prune();
  return { ok: true, file: gz, kept: kept };
}

function prune() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('elforma-') && f.endsWith('.db.gz'))
    .sort()
    .reverse();
  files.slice(KEEP).forEach((f) => fs.rmSync(path.join(BACKUP_DIR, f), { force: true }));
  return Math.min(files.length, KEEP);
}

/* [FIX H8 — النسخ الاحتياطي كله كان على نفس القرص]
   المشكلة المثبتة بالدليل: BACKUP_DIR = DATA_DIR/backups، يعني النسخ عايشة
   على نفس قرص Render اللي فيه elforma.db. ده بيحمي من "مسحت جدول بالغلط"
   بس مابيحميش خالص من فقدان القرص نفسه أو حذف الخدمة — ده مش نسخ احتياطي،
   ده نسخة محلية.

   الحل هنا: رفع الملف المضغوط لمكان خارجي بـ HTTP PUT بسيط عبر fetch
   (متوافق مع أي تخزين S3-compatible بـ presigned URL، أو Backblaze B2، أو أي endpoint
   بيقبل PUT). مفيش مكتبات جديدة — المشروع بيفضل zero-dependency.

   التفعيل: EF_BACKUP_REMOTE_URL (مثال https://…/elforma-backups/)
            EF_BACKUP_REMOTE_TOKEN (اختياري — يتبعت كـ Authorization: Bearer)
   لو المتغير مش موجود، بنسجل تحذير واضح مرة واحدة في اليوم بدل الصمت.

   ملحوظة صريحة: ماقدرتش أختبر الرفع فعليًا (مفيش شبكة في بيئة الفحص)،
   المختبر هو منطق الاستدعاء والفشل الآمن. خطوات الاسترجاع في docs/RESTORE.md. */
const REMOTE_URL = (process.env.EF_BACKUP_REMOTE_URL || '').trim();
const REMOTE_TOKEN = (process.env.EF_BACKUP_REMOTE_TOKEN || '').trim();

async function uploadOffsite(file) {
  if (!REMOTE_URL) {
    return { ok: false, reason: 'EF_BACKUP_REMOTE_URL not set — backups are LOCAL ONLY' };
  }
  if (typeof fetch !== 'function') {
    return { ok: false, reason: 'global fetch unavailable on this Node build' };
  }
  const body = fs.readFileSync(file);
  const base = REMOTE_URL.endsWith('/') ? REMOTE_URL : REMOTE_URL + '/';
  const target = base + path.basename(file);
  const headers = {
    'Content-Type': 'application/gzip',
    'Content-Length': String(body.length),
  };
  if (REMOTE_TOKEN) headers.Authorization = 'Bearer ' + REMOTE_TOKEN;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120000);
  try {
    const r = await fetch(target, { method: 'PUT', headers, body, signal: ctl.signal });
    if (!r.ok) return { ok: false, reason: 'HTTP ' + r.status };
    return { ok: true, target: target, bytes: body.length };
  } catch (e) {
    return { ok: false, reason: (e && e.name === 'AbortError') ? 'timeout after 120s' : (e && e.message) };
  } finally {
    clearTimeout(timer);
  }
}

let lastRunDay = null;

function tick() {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  if (lastRunDay === day) return;
  const due = now.getUTCHours() > HOUR_UTC ||
    (now.getUTCHours() === HOUR_UTC && now.getUTCMinutes() >= MINUTE_UTC);
  if (!due) return;
  lastRunDay = day;
  try {
    const r = runBackup();
    if (r.ok) {
      console.log('[backup] ok -> ' + path.basename(r.file) + ' (keeping ' + r.kept + ')');
      // [FIX H8] الرفع الخارجي ماينفعش يوقع المؤقّت أو السيرفر.
      uploadOffsite(r.file).then(function (u) {
        if (u.ok) console.log('[backup] offsite ok -> ' + u.target + ' (' + u.bytes + ' bytes)');
        else console.error('[backup] OFFSITE FAILED: ' + u.reason);
      }).catch(function (e) {
        console.error('[backup] OFFSITE FAILED: ' + (e && e.message));
      });
    } else {
      console.error('[backup] skipped: ' + r.reason);
    }
  } catch (e) {
    console.error('[backup] FAILED: ' + e.message);
  }
}

function start() {
  // unref so this timer can never hold a test run or a shutdown open.
  const t = setInterval(tick, CHECK_EVERY_MS);
  if (typeof t.unref === 'function') t.unref();
  return t;
}

module.exports = { start, runBackup, prune, tick, uploadOffsite, DB_PATH, BACKUP_DIR, KEEP };
