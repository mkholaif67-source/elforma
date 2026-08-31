'use strict';
// ── ElForma · lib/appconfig.js ──
// One shared normaliser for everything the admin dashboard can change about
// the mobile app. Both /api/admin/* (writer) and /api/mobile/* (reader) go
// through this file, so the value the admin saves and the value the phone
// receives can never be two different shapes.
//
// Storage: the existing `site_settings` key/value table via lib/settings.js.
// Key: 'app_config'.

const settings = require('./settings');

const KEY = 'app_config';

const num = (v, def, min, max) => {
  const x = Number(v);
  if (!Number.isFinite(x)) return def;
  return Math.max(min, Math.min(max, Math.round(x)));
};
const str = (v, len) => String(v == null ? '' : v).trim().slice(0, len);
const bool = (v, def) => (typeof v === 'boolean' ? v : def);

/**
 * The full, defaulted shape. Every field here is consumed by the Flutter app;
 * nothing is stored that the phone does not read.
 */
function defaults() {
  return {
    // ── Maintenance gate: shown as a blocking screen in the app ──
    maintenance: false,
    maintenanceTitle: 'صيانة مؤقتة',
    maintenanceMessage: 'بنطور حاجة حلوة دلوقتي. رجاءً حاول كمان شوية.',

    // ── Version gate ──
    // minBuild > the installed build  => hard block with an update button.
    // latestBuild > installed build   => soft, dismissible update banner.
    minBuild: 0,
    latestBuild: 0,
    storeUrl: '',
    updateMessage: '',

    // ── Global switches for the announcement / notification systems ──
    announcementsEnabled: true,
    pushEnabled: true,
    // How often the phone's background worker checks for new notifications.
    // This is the polling fallback for devices without a working FCM token.
    pollMinutes: 15,

    // ── Feature gates the app actually branches on ──
    trialEnabled: true,
    trialDays: 3,
    reviewsEnabled: true,
    referralsEnabled: true,

    // ── Support / contact surfaced on the account + support screens ──
    supportWhatsapp: '',
    supportEmail: '',
  };
}

function normalize(input) {
  const d = defaults();
  const a = input && typeof input === 'object' ? input : {};
  return {
    maintenance: bool(a.maintenance, d.maintenance),
    maintenanceTitle: str(a.maintenanceTitle, 120) || d.maintenanceTitle,
    maintenanceMessage: str(a.maintenanceMessage, 400) || d.maintenanceMessage,

    minBuild: num(a.minBuild, d.minBuild, 0, 1000000),
    latestBuild: num(a.latestBuild, d.latestBuild, 0, 1000000),
    storeUrl: str(a.storeUrl, 400),
    updateMessage: str(a.updateMessage, 300),

    announcementsEnabled: bool(a.announcementsEnabled, d.announcementsEnabled),
    pushEnabled: bool(a.pushEnabled, d.pushEnabled),
    pollMinutes: num(a.pollMinutes, d.pollMinutes, 15, 720),

    trialEnabled: bool(a.trialEnabled, d.trialEnabled),
    trialDays: num(a.trialDays, d.trialDays, 1, 30),
    reviewsEnabled: bool(a.reviewsEnabled, d.reviewsEnabled),
    referralsEnabled: bool(a.referralsEnabled, d.referralsEnabled),

    supportWhatsapp: str(a.supportWhatsapp, 40),
    supportEmail: str(a.supportEmail, 120),
  };
}

/** Current config: stored values normalised over the defaults. */
function get() {
  return normalize(settings.getJSON(KEY, null));
}

/** Merge a partial update into the stored config and return the new value. */
function save(patch) {
  const merged = Object.assign({}, get(), patch && typeof patch === 'object' ? patch : {});
  const clean = normalize(merged);
  settings.setJSON(KEY, clean);
  return clean;
}

/**
 * The version gate, with the historical environment variables as a fallback.
 * The dashboard wins when it has a value, so an owner without shell access can
 * still stop a broken build from being used.
 */
function versionGate() {
  const c = get();
  const envNum = (v) => { const x = parseInt(String(v || '').trim(), 10); return Number.isFinite(x) && x > 0 ? x : 0; };
  return {
    minBuild: c.minBuild || envNum(process.env.EF_MIN_BUILD),
    latestBuild: c.latestBuild || envNum(process.env.EF_LATEST_BUILD),
    storeUrl: c.storeUrl || String(process.env.EF_STORE_URL || '').trim(),
    message: c.updateMessage || String(process.env.EF_UPDATE_MESSAGE || '').trim(),
  };
}

module.exports = { KEY, defaults, normalize, get, save, versionGate };
