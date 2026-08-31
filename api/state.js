'use strict';
// /api/state — cloud persistence that replaces localStorage.
// The client mirrors its whitelisted localStorage keys here so plans/logs/
// profile survive browser clears and sync across devices.
const db = require('../lib/db');
const auth = require('../lib/auth');
const { sendJson, readJsonBody, parseCookies } = require('../lib/util');

// Only these key prefixes are accepted from the client (defense in depth).
const ALLOWED_PREFIXES = ['EF_', 'diet_', 'forma_'];
const MAX_KEY_LEN = 128;
const MAX_VAL_LEN = 512 * 1024; // 512KB per key
const MAX_KEYS = 200;

function keyAllowed(k) {
  return typeof k === 'string' && k.length <= MAX_KEY_LEN && ALLOWED_PREFIXES.some((p) => k.startsWith(p));
}

function requireUser(req, res) {
  const user = auth.currentUser(parseCookies(req));
  if (!user) { sendJson(res, 401, { error: 'unauthenticated' }); return null; }
  return user;
}

// GET /api/state -> { state: { key: value, ... } }
async function getAll(req, res) {
  const user = requireUser(req, res); if (!user) return;
  const rows = db.getState(user.id);
  const state = {};
  for (const k of Object.keys(rows)) state[k] = rows[k].v;
  return sendJson(res, 200, { state });
}

// PUT /api/state  body: { changes: { key: value|null, ... } }
// value === null deletes the key. Values are opaque strings (already JSON from the app).
async function put(req, res) {
  const user = requireUser(req, res); if (!user) return;
  const body = await readJsonBody(req, 2 * 1024 * 1024);
  const changes = body && body.changes;
  if (!changes || typeof changes !== 'object') return sendJson(res, 400, { error: 'changes object required' });
  const keys = Object.keys(changes);
  if (keys.length > MAX_KEYS) return sendJson(res, 400, { error: 'too many keys' });
  let applied = 0, skipped = 0;
  const tx = db.db.prepare('SELECT 1'); // noop to ensure db ready
  for (const k of keys) {
    if (!keyAllowed(k)) { skipped++; continue; }
    const v = changes[k];
    if (v === null || v === undefined) { db.removeState(user.id, k); applied++; continue; }
    const str = typeof v === 'string' ? v : JSON.stringify(v);
    if (str.length > MAX_VAL_LEN) { skipped++; continue; }
    db.setState(user.id, k, str);
    applied++;
  }
  return sendJson(res, 200, { ok: true, applied, skipped });
}

module.exports = { getAll, put };
