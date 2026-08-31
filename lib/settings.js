'use strict';
// DB-backed key/value settings store for admin-editable pricing & page content.
const db = require('./db');

db.db.exec(`CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`);

const now = () => new Date().toISOString();
const qGet = db.db.prepare('SELECT value FROM site_settings WHERE key = ?');
const qSet = db.db.prepare('INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at');
const qAll = db.db.prepare('SELECT key, value FROM site_settings');

function getJSON(key, def) {
  try { const r = qGet.get(key); if (!r) return def; return JSON.parse(r.value); }
  catch (_) { return def; }
}
function setJSON(key, val) { qSet.run(key, JSON.stringify(val), now()); }
function all() {
  const out = {};
  for (const r of qAll.all()) { try { out[r.key] = JSON.parse(r.value); } catch (_) { out[r.key] = r.value; } }
  return out;
}
module.exports = { getJSON, setJSON, all };
