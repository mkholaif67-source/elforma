'use strict';
// ── ElForma · lib/push.js ──
// Real push delivery (Firebase Cloud Messaging HTTP v1) + the device-token
// registry that makes it possible.
//
// Why HTTP v1 and not the legacy server key: Google turned the legacy
// `fcm.googleapis.com/fcm/send` endpoint off. v1 needs a short-lived OAuth2
// access token signed with the project's service account, so this file also
// contains a tiny RS256 JWT signer built on node's own `crypto` -- no new
// dependency is added to package.json for it.
//
// Credentials come from the environment, never from the repo:
//   EF_FCM_SERVICE_ACCOUNT       full service-account JSON (one line)
//   EF_FCM_SERVICE_ACCOUNT_FILE  path to the service-account JSON file
// When neither is set, isConfigured() returns false and every send reports
// `skipped: 'not_configured'` instead of pretending it delivered something.

const crypto = require('crypto');
const fs = require('fs');
const db = require('./db');

/* ------------------------------------------------------------------ *
 * 1. Device registry
 * ------------------------------------------------------------------ */

db.db.exec(`CREATE TABLE IF NOT EXISTS push_devices (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  platform   TEXT NOT NULL DEFAULT 'android',
  enabled    INTEGER NOT NULL DEFAULT 1,
  app_build  TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`);
db.db.exec('CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices(user_id);');

const now = () => new Date().toISOString();

const q = {
  upsert: db.db.prepare(
    'INSERT INTO push_devices (token, user_id, platform, enabled, app_build, created_at, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform, ' +
    'enabled = excluded.enabled, app_build = excluded.app_build, updated_at = excluded.updated_at'
  ),
  disable: db.db.prepare('UPDATE push_devices SET enabled = 0, updated_at = ? WHERE token = ?'),
  drop: db.db.prepare('DELETE FROM push_devices WHERE token = ?'),
  byUser: db.db.prepare('SELECT token FROM push_devices WHERE user_id = ? AND enabled = 1'),
  all: db.db.prepare('SELECT token FROM push_devices WHERE enabled = 1'),
  // Audience queries join the subscription so "send to Pro only" is decided by
  // the same table the paywall reads, not by a copy that can drift.
  byPlan: db.db.prepare(
    'SELECT d.token FROM push_devices d ' +
    'JOIN subscriptions s ON s.user_id = d.user_id ' +
    'WHERE d.enabled = 1 AND s.plan = ? AND s.status = ?'
  ),
  proTokens: db.db.prepare(
    "SELECT d.token FROM push_devices d JOIN subscriptions s ON s.user_id = d.user_id " +
    "WHERE d.enabled = 1 AND s.status = 'active' AND s.plan IN ('pro','trial')"
  ),
  freeTokens: db.db.prepare(
    "SELECT d.token FROM push_devices d LEFT JOIN subscriptions s ON s.user_id = d.user_id " +
    "WHERE d.enabled = 1 AND (s.plan IS NULL OR s.plan = 'free' OR s.status <> 'active')"
  ),
  stats: db.db.prepare(
    'SELECT COUNT(*) total, SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) active, ' +
    'COUNT(DISTINCT user_id) users FROM push_devices'
  ),
  platforms: db.db.prepare(
    'SELECT platform, COUNT(*) n FROM push_devices WHERE enabled = 1 GROUP BY platform'
  ),
};

function registerDevice(userId, token, platform, appBuild) {
  const t = String(token || '').trim();
  if (!t || t.length < 20 || t.length > 4096) return false;
  const p = ['android', 'ios', 'web'].indexOf(String(platform)) > -1 ? String(platform) : 'android';
  const ts = now();
  q.upsert.run(t, Number(userId), p, 1, String(appBuild || '').slice(0, 40), ts, ts);
  return true;
}

function unregisterDevice(token) {
  const t = String(token || '').trim();
  if (!t) return false;
  q.drop.run(t);
  return true;
}

/** Tokens for an audience: 'all' | 'pro' | 'free' | a numeric user id. */
function tokensFor(audience) {
  const a = String(audience == null ? 'all' : audience);
  let rows;
  if (a === 'all') rows = q.all.all();
  else if (a === 'pro') rows = q.proTokens.all();
  else if (a === 'free') rows = q.freeTokens.all();
  else if (/^\d+$/.test(a)) rows = q.byUser.all(Number(a));
  else rows = [];
  return rows.map((r) => r.token);
}

function stats() {
  let s = { total: 0, active: 0, users: 0 };
  try { s = q.stats.get() || s; } catch (_) {}
  let byPlatform = [];
  try { byPlatform = q.platforms.all(); } catch (_) {}
  return {
    total: Number(s.total || 0),
    active: Number(s.active || 0),
    users: Number(s.users || 0),
    byPlatform: byPlatform,
  };
}

/* ------------------------------------------------------------------ *
 * 2. Service-account credentials + OAuth2 access token
 * ------------------------------------------------------------------ */

let _account = null;
let _accountRead = false;

function serviceAccount() {
  if (_accountRead) return _account;
  _accountRead = true;
  const raw = String(process.env.EF_FCM_SERVICE_ACCOUNT || '').trim();
  const file = String(process.env.EF_FCM_SERVICE_ACCOUNT_FILE || '').trim();
  let json = null;
  try {
    if (raw) json = JSON.parse(raw);
    else if (file && fs.existsSync(file)) json = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) { json = null; }
  if (json && json.client_email && json.private_key && json.project_id) _account = json;
  return _account;
}

function isConfigured() { return !!serviceAccount(); }

/** Reset the memoised credentials. Only used by tests. */
function _resetCredentials() { _account = null; _accountRead = false; _token = null; _tokenExp = 0; }

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let _token = null;
let _tokenExp = 0;

async function accessToken() {
  const acc = serviceAccount();
  if (!acc) return null;
  // Reuse the token until a minute before it expires.
  if (_token && Date.now() < _tokenExp - 60000) return _token;
  const iat = Math.floor(Date.now() / 1000);
  const claim = {
    iss: acc.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: acc.token_uri || 'https://oauth2.googleapis.com/token',
    iat: iat,
    exp: iat + 3600,
  };
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(claim));
  let sig;
  try {
    sig = b64url(crypto.createSign('RSA-SHA256').update(head + '.' + body).sign(acc.private_key));
  } catch (_) { return null; }
  const assertion = head + '.' + body + '.' + sig;
  const form = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: assertion,
  }).toString();
  try {
    const r = await fetch(claim.aud, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const j = await r.json();
    if (!r.ok || !j.access_token) return null;
    _token = j.access_token;
    _tokenExp = Date.now() + (Number(j.expires_in || 3600) * 1000);
    return _token;
  } catch (_) { return null; }
}

/* ------------------------------------------------------------------ *
 * 3. Sending
 * ------------------------------------------------------------------ */

// A token that FCM rejects with UNREGISTERED / INVALID_ARGUMENT is dead: the
// app was uninstalled or the token rotated. Deleting it keeps the registry
// honest so the admin's "devices" number means something.
function _handleFailure(token, status, payload) {
  const err = String((payload && payload.error && payload.error.status) || '');
  if (status === 404 || err === 'NOT_FOUND' || err === 'UNREGISTERED' || err === 'INVALID_ARGUMENT') {
    try { q.drop.run(token); } catch (_) {}
    return 'dropped';
  }
  try { q.disable.run(now(), token); } catch (_) {}
  return 'failed';
}

/**
 * Sends one notification to an audience.
 * Returns { configured, attempted, sent, failed, dropped, skipped? }.
 * Never throws: a failed push must not take an admin request down with it.
 */
async function send({ audience, title, body, data, image, channel, sound }) {
  const tokens = tokensFor(audience);
  const out = { configured: isConfigured(), attempted: tokens.length, sent: 0, failed: 0, dropped: 0 };
  if (!out.configured) { out.skipped = 'not_configured'; return out; }
  if (!tokens.length) { out.skipped = 'no_devices'; return out; }
  const tok = await accessToken();
  if (!tok) { out.skipped = 'auth_failed'; return out; }
  const acc = serviceAccount();
  const url = 'https://fcm.googleapis.com/v1/projects/' + acc.project_id + '/messages:send';

  // Everything the phone needs also travels in `data`, because the Flutter side
  // renders its own notification when the app is in the foreground.
  const dataPayload = Object.assign({}, data || {});
  Object.keys(dataPayload).forEach((k) => { dataPayload[k] = String(dataPayload[k] == null ? '' : dataPayload[k]); });

  const chunkSize = 25;
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(chunk.map(async (token) => {
      const message = {
        token: token,
        notification: { title: String(title || ''), body: String(body || '') },
        data: dataPayload,
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: String(channel || 'admin_push_v3'),
            sound: sound ? String(sound) : 'default',
            default_vibrate_timings: true,
          },
        },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: { aps: { sound: 'default', 'mutable-content': 1 } },
        },
      };
      if (image) {
        message.notification.image = String(image);
        message.android.notification.image = String(image);
      }
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: message }),
        });
        if (r.ok) { out.sent++; return; }
        let payload = null;
        try { payload = await r.json(); } catch (_) {}
        const verdict = _handleFailure(token, r.status, payload);
        if (verdict === 'dropped') out.dropped++; else out.failed++;
      } catch (_) {
        out.failed++;
      }
    }));
  }
  return out;
}

module.exports = {
  registerDevice, unregisterDevice, tokensFor, stats,
  isConfigured, send, _resetCredentials,
};
