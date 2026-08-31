'use strict';
// Real relational persistence using Node's built-in SQLite (no external deps).
// محرك قاعدة البيانات بيتحدّد أسفل (node:sqlite محليًا أو libsql/Turso سحابيًا).
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.EF_DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'elforma.db');

// [PERSISTENCE] اختيار محرك قاعدة البيانات:
//  • افتراضيًا: SQLite محلي عبر node:sqlite (تجربة فورية بدون أي إعداد).
//  • لو اتظبطت TURSO_DATABASE_URL → نستخدم libsql كـ Embedded Replica:
//    نسخة محلية سريعة بتتزامن مع Turso السحابي، فالداتا دائمة
//    وتتحمل نجاح التطبيق حتى على استضافات بتمسح الملفات (serverless).
//  ملاحظة مهمة: في وضع السحابة لازم EF_SECRET يكون ثابتًا (متغيّر بيئة)
//  عشان المستخدم مايتسجّلش خروج بعد كل إعادة تشغيل.
let db;
let usingTurso = false;
if (process.env.TURSO_DATABASE_URL) {
  try {
  const LibsqlDatabase = require('libsql');
  db = new LibsqlDatabase(DB_PATH, {
    syncUrl: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    // يسحب أحدث نسخة من السحابة دوريًا (بالثانية) بالإضافة للمزامنة وقت الكتابة.
    syncInterval: Number(process.env.TURSO_SYNC_INTERVAL || 60),
  });
  try { db.sync(); } catch (e) { console.error('[db] Turso initial sync failed:', e && e.message); }
  usingTurso = true;
  console.log('[db] Using Turso (libsql embedded replica) at', DB_PATH);
  } catch (e) {
    // [FIX جذري] لو libsql مش متثبتة أو فشل الاتصال: ماننهارش، بنسجّل
    // تحذير صريح وبنرجع للمحلي عشان السيرفر يفضل شغّال والسبب يبان.
    console.error('[db] !!! TURSO_DATABASE_URL مظبوط بس فشل تحميل/تشغيل libsql:', e && e.message);
    console.error('[db] !!! الداتا مش هتتزامن مع Turso — تأكد إن npm install بيتنفّذ في الـDockerfile.');
  }
}
if (!usingTurso) {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(DB_PATH);
  console.log('[db] Using local SQLite (node:sqlite) at', DB_PATH);
}

// Pragmas for durability + concurrency.
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');
// Scaling pragmas. WAL alone is not enough once thousands of users hit the
// same file: the checkpoint, the page cache and the temp store all matter.
// synchronous = NORMAL is the standard safe pairing with WAL (no data loss on
// an app crash, only on an OS crash) and removes an fsync from every commit.
db.exec('PRAGMA synchronous = NORMAL;');
// 64 MB of page cache. Negative means kibibytes, so -64000 is ~64 MB.
db.exec('PRAGMA cache_size = -64000;');
// Sorts and temp b-trees stay in RAM instead of hitting the disk.
db.exec('PRAGMA temp_store = MEMORY;');
// Memory-mapped reads, 256 MB. Read paths stop copying through the OS buffer.
db.exec('PRAGMA mmap_size = 268435456;');
// Auto-checkpoint a bit later than the 1000-page default so bursts of writes
// do not each pay for a checkpoint.
db.exec('PRAGMA wal_autocheckpoint = 2000;');

// --- Schema (mirrors the localStorage keys 1:1 via a per-user KV store) ---
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL UNIQUE,
  name         TEXT,
  pass_hash    TEXT NOT NULL,
  pass_salt    TEXT NOT NULL,
  verified     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  last_login   TEXT,
  token_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_state (
  user_id      INTEGER NOT NULL,
  k            TEXT NOT NULL,
  v            TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, k),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id            INTEGER PRIMARY KEY,
  plan               TEXT NOT NULL DEFAULT 'free',
  status             TEXT NOT NULL DEFAULT 'active',
  provider           TEXT,
  current_period_end TEXT,
  updated_at         TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  action     TEXT NOT NULL,
  ip         TEXT,
  at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL UNIQUE,
  rating       INTEGER NOT NULL,
  title        TEXT,
  body         TEXT NOT NULL,
  display_name TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  is_customer  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT,
  approved_at  TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Native mobile domain data. These tables replace browser localStorage for
-- all records that must sync safely across Android, iOS and the web account.
CREATE TABLE IF NOT EXISTS mobile_profiles (
  user_id      INTEGER PRIMARY KEY,
  profile_json TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workout_plans (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  plan_key     TEXT NOT NULL,
  plan_json    TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_workout_plans_user_active
  ON workout_plans(user_id, active);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  plan_id      INTEGER,
  day_key      TEXT NOT NULL,
  day_name     TEXT,
  status       TEXT NOT NULL DEFAULT 'active',
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  duration_sec INTEGER,
  notes        TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES workout_plans(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_started
  ON workout_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS workout_sets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   INTEGER NOT NULL,
  exercise_key TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  set_number   INTEGER NOT NULL,
  weight       REAL NOT NULL DEFAULT 0,
  reps         INTEGER NOT NULL DEFAULT 0,
  rir          REAL,
  completed    INTEGER NOT NULL DEFAULT 0,
  logged_at    TEXT NOT NULL,
  UNIQUE(session_id, exercise_key, set_number),
  FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nutrition_days (
  user_id      INTEGER NOT NULL,
  day          TEXT NOT NULL,
  calories     REAL NOT NULL DEFAULT 0,
  protein      REAL NOT NULL DEFAULT 0,
  carbs        REAL NOT NULL DEFAULT 0,
  fat          REAL NOT NULL DEFAULT 0,
  water_ml     INTEGER NOT NULL DEFAULT 0,
  meals_json   TEXT NOT NULL DEFAULT '[]',
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, day),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weight_logs (
  user_id      INTEGER NOT NULL,
  day          TEXT NOT NULL,
  weight       REAL NOT NULL,
  note         TEXT,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, day),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS body_measurements (
  user_id      INTEGER NOT NULL,
  day          TEXT NOT NULL,
  waist        REAL,
  chest        REAL,
  hips         REAL,
  arm          REAL,
  thigh        REAL,
  body_fat     REAL,
  note         TEXT,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, day),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS food_preferences (
  user_id      INTEGER NOT NULL,
  food_id      TEXT NOT NULL,
  favorite     INTEGER NOT NULL DEFAULT 0,
  use_count    INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, food_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_food_preferences_user_recent
  ON food_preferences(user_id, last_used_at DESC);

CREATE TABLE IF NOT EXISTS client_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  event_type   TEXT NOT NULL,
  message      TEXT NOT NULL,
  stack        TEXT,
  app_version  TEXT,
  created_at   TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_client_events_user_created
  ON client_events(user_id, created_at DESC);

-- Owner-controlled video links.
--
-- The workout engine authors a video id for every exercise. This table is the
-- ONLY thing allowed to change one, and only the owner can write to it.
--
-- Critical distinction, do not "simplify" it away:
--   no row        -> use the engine's authored link
--   video_id = '' -> a DELIBERATE delete; hide the video button entirely
-- An empty string is a decision, not a missing value. Collapsing the two would
-- silently resurrect a link the owner removed on purpose.
CREATE TABLE IF NOT EXISTS video_overrides (
  exercise_key  TEXT PRIMARY KEY,
  exercise_name TEXT,
  video_id      TEXT NOT NULL,
  note          TEXT,
  updated_by    INTEGER,
  updated_at    TEXT NOT NULL
);

-- تبليغات الفيديو من المتدربين
-- التحكم في الروابط بقى موجود لكن ماكانش فيه طريقة نعرف بيها إن فيديو وقع
-- دلوقتي المتدرب بيبلغ بضغطة واحدة والبلاغ بيدخل طابور عند صاحب المشروع
CREATE TABLE IF NOT EXISTS video_reports (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_key  TEXT NOT NULL,
  exercise_name TEXT,
  video_id      TEXT,
  reason        TEXT,
  user_id       INTEGER,
  status        TEXT NOT NULL DEFAULT 'open',
  created_at    TEXT NOT NULL,
  resolved_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_video_reports_status
  ON video_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_reports_key
  ON video_reports(exercise_key);

CREATE TABLE IF NOT EXISTS shared_plans (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  plan_type   TEXT NOT NULL,
  plan_json   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_shared_plans_expires
  ON shared_plans(expires_at);

-- Indexes for the remaining hot paths.
--
-- Deliberately NOT indexed: user_state, nutrition_days, weight_logs and
-- body_measurements are keyed on (user_id, day) and subscriptions,
-- mobile_profiles and reviews.user_id are PRIMARY KEY / UNIQUE on user_id.
-- SQLite already serves those lookups from the primary key, so extra indexes
-- would only slow every write down and consume disk for nothing.

-- Per-user history, newest first. Note the column is named at, not created_at.
CREATE INDEX IF NOT EXISTS idx_audit_log_user_at
  ON audit_log(user_id, at DESC);

-- Reading a session replays all of its sets; without this it is a full scan of
-- every set ever logged by every user.
CREATE INDEX IF NOT EXISTS idx_workout_sets_session
  ON workout_sets(session_id);

-- Review lists always filter by status and sort by a date: the public page by
-- approved_at, the admin queue by created_at.
CREATE INDEX IF NOT EXISTS idx_reviews_status_approved
  ON reviews(status, approved_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_status_created
  ON reviews(status, created_at DESC);

-- Scaling indexes. Everything below only starts to matter past a few hundred
-- users, which is exactly the point we are building for now.

-- The daily nutrition read is the single hottest query in the app: every user
-- hits it on every app open. (user_id, day DESC) serves both the single-day
-- lookup and the trailing history window from one index.
CREATE INDEX IF NOT EXISTS idx_nutrition_days_user_day
  ON nutrition_days(user_id, day DESC);

-- Weight and measurement history are read as "last N for this user", which is
-- a scan of the whole table without this.
CREATE INDEX IF NOT EXISTS idx_weight_logs_user_day
  ON weight_logs(user_id, day DESC);
CREATE INDEX IF NOT EXISTS idx_body_measurements_user_day
  ON body_measurements(user_id, day DESC);

-- The subscription check runs on effectively every authenticated request.
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON subscriptions(user_id, status);

-- Login by email must never degrade into a scan as the user table grows.
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

-- Session history lists are per user, newest first.
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_id
  ON workout_sessions(user_id, id DESC);

`);

// ANALYZE lets the query planner use real row-count statistics instead of
// guesses. Cheap on startup, and it is what keeps the plans sane as the tables
// grow from hundreds of rows to millions.
// email_tokens is created further down the file, so its index has to wait
// until after that statement runs.
try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_email_tokens_token ON email_tokens(token);');
} catch (_) { /* the table is created later on a fresh database */ }

try { db.exec('ANALYZE;'); } catch (_) { /* statistics are an optimisation, never a hard dependency */ }

// --- Migration: allow phone-based accounts (email nullable + phone unique) ---
(function migrate(){
  try {
    const cols = db.prepare("PRAGMA table_info(users)").all();
    const hasPhone = cols.some(function(c){ return c.name === 'phone'; });
    const emailCol = cols.find(function(c){ return c.name === 'email'; });
    const emailNotNull = emailCol && emailCol.notnull === 1;
    if (!hasPhone || emailNotNull) {
      /* [FIX M9 — هجرة بتعمل DROP TABLE users على كل إقلاع]
         المشكلة الأصلية: الكود كان بينسخ لـ users_new ثم DROP TABLE users ثم RENAME
         جوّا ترانزاكشن، من غير أي تحقق إن النسخ نجح فعلًا.
         لو الـ INSERT نقص صفوف (مثال: تعارض UNIQUE في phone بين حسابين
         ليهم نفس الرقم) مافيش حاجة كانت هتمسك ده قبل الـ DROP.

         دلوقتي:
           1) نسخة أمان كاملة من الملف قبل أي حاجة (VACUUM INTO).
           2) مقارنة عدد الصفوف قبل وبعد النسخ جوّا الترانزاكشن.
           3) أي فرق = ROLLBACK ورمي استثناء، يعني الجدول القديم مابيتمسحش. */
      const beforeCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;

      // (1) نسخة أمان قبل الهجرة — مرة واحدة بس، وفشلها مايوقفش الإقلاع.
      try {
        const safety = path.join(DATA_DIR, 'pre-phone-migration-' + Date.now() + '.db');
        db.exec("VACUUM INTO '" + safety.replace(/'/g, "''") + "'");
        console.log('[db.migrate] pre-migration snapshot ->', safety);
      } catch (e) { console.error('[db.migrate] snapshot failed:', e && e.message); }

      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec('BEGIN;');
      db.exec("CREATE TABLE IF NOT EXISTS users_new (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, phone TEXT UNIQUE, name TEXT, pass_hash TEXT NOT NULL, pass_salt TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_login TEXT);");
      const phoneSel = hasPhone ? 'phone' : 'NULL';
      db.exec("INSERT INTO users_new (id,email,phone,name,pass_hash,pass_salt,verified,created_at,last_login) SELECT id,email," + phoneSel + ",name,pass_hash,pass_salt,verified,created_at,last_login FROM users;");

      // (2) مانمسحش حاجة قبل ما نتأكد إن كل صف وصل.
      const afterCount = db.prepare('SELECT COUNT(*) AS c FROM users_new').get().c;
      if (afterCount !== beforeCount) {
        db.exec('ROLLBACK;');
        db.exec('PRAGMA foreign_keys = ON;');
        throw new Error('users migration would lose rows: ' + beforeCount + ' -> ' + afterCount);
      }

      db.exec('DROP TABLE users;');
      db.exec('ALTER TABLE users_new RENAME TO users;');
      db.exec('COMMIT;');
      db.exec('PRAGMA foreign_keys = ON;');
      console.log('[db.migrate] users migrated safely (' + afterCount + ' rows)');
    }
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;");
  } catch (e) { try { db.exec('ROLLBACK;'); } catch(_){} console.error('[db.migrate]', e && e.message); }
})();

// Ensure token_version exists on pre-existing databases (session revocation).
try { db.exec("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;"); } catch (_) {}
try { db.exec("ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;"); } catch (_) {}

const now = () => new Date().toISOString();

const q = {
  createUser: db.prepare(
    'INSERT INTO users (email, phone, name, pass_hash, pass_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ),
  userByPhone: db.prepare('SELECT * FROM users WHERE phone = ?'),
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  touchLogin: db.prepare('UPDATE users SET last_login = ? WHERE id = ?'),
  getState: db.prepare('SELECT k, v, updated_at FROM user_state WHERE user_id = ?'),

  videoOverrides: db.prepare('SELECT * FROM video_overrides ORDER BY updated_at DESC'),
  videoOverrideGet: db.prepare('SELECT * FROM video_overrides WHERE exercise_key = ?'),
  videoOverrideSet: db.prepare(
    'INSERT INTO video_overrides (exercise_key, exercise_name, video_id, note, updated_by, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(exercise_key) DO UPDATE SET ' +
    'exercise_name = excluded.exercise_name, video_id = excluded.video_id, ' +
    'note = excluded.note, updated_by = excluded.updated_by, updated_at = excluded.updated_at'
  ),
  videoOverrideDelete: db.prepare('DELETE FROM video_overrides WHERE exercise_key = ?'),
  upsertState: db.prepare(
    'INSERT INTO user_state (user_id, k, v, updated_at) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(user_id, k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at'
  ),
  deleteState: db.prepare('DELETE FROM user_state WHERE user_id = ? AND k = ?'),
  ensureSub: db.prepare(
    'INSERT OR IGNORE INTO subscriptions (user_id, plan, status, updated_at) VALUES (?, ?, ?, ?)'
  ),
  getSub: db.prepare('SELECT * FROM subscriptions WHERE user_id = ?'),
  audit: db.prepare('INSERT INTO audit_log (user_id, action, ip, at) VALUES (?, ?, ?, ?)'),
  setName: db.prepare('UPDATE users SET name = ? WHERE id = ?'),
  setEmail: db.prepare('UPDATE users SET email = ?, verified = 0 WHERE id = ?'),
  setPhone: db.prepare('UPDATE users SET phone = ?, phone_verified = 0 WHERE id = ?'),
  setVerified: db.prepare('UPDATE users SET verified = 1 WHERE id = ?'),
  setPassword: db.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, token_version = token_version + 1 WHERE id = ?'),
  upsertReview: db.prepare(
    'INSERT INTO reviews (user_id, rating, title, body, display_name, status, is_customer, created_at, updated_at) ' +
    "VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?) " +
    'ON CONFLICT(user_id) DO UPDATE SET rating = excluded.rating, title = excluded.title, body = excluded.body, ' +
    "display_name = excluded.display_name, is_customer = excluded.is_customer, status = 'pending', updated_at = excluded.updated_at, approved_at = NULL"
  ),
  reviewByUser: db.prepare('SELECT * FROM reviews WHERE user_id = ?'),
  reviewById: db.prepare('SELECT * FROM reviews WHERE id = ?'),
  listApprovedReviews: db.prepare("SELECT * FROM reviews WHERE status = 'approved' ORDER BY approved_at DESC LIMIT ?"),
  approvedStats: db.prepare("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE status = 'approved'"),
  listReviewsByStatus: db.prepare('SELECT * FROM reviews WHERE status = ? ORDER BY created_at DESC LIMIT ?'),
  setReviewStatus: db.prepare('UPDATE reviews SET status = ?, approved_at = ? WHERE id = ?')
};

const mobileQ = {
  profile: db.prepare('SELECT profile_json, updated_at FROM mobile_profiles WHERE user_id = ?'),
  upsertProfile: db.prepare(
    'INSERT INTO mobile_profiles (user_id, profile_json, updated_at) VALUES (?, ?, ?) ' +
    'ON CONFLICT(user_id) DO UPDATE SET profile_json = excluded.profile_json, updated_at = excluded.updated_at'
  ),
  deactivatePlans: db.prepare('UPDATE workout_plans SET active = 0, updated_at = ? WHERE user_id = ?'),
  insertPlan: db.prepare(
    'INSERT INTO workout_plans (user_id, plan_key, plan_json, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)'
  ),
  activePlan: db.prepare('SELECT * FROM workout_plans WHERE user_id = ? AND active = 1 ORDER BY id DESC LIMIT 1'),
  startSession: db.prepare(
    "INSERT INTO workout_sessions (user_id, plan_id, day_key, day_name, status, started_at) VALUES (?, ?, ?, ?, 'active', ?)"
  ),
  sessionById: db.prepare('SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?'),
  activeSession: db.prepare("SELECT * FROM workout_sessions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1"),
  finishSession: db.prepare(
    "UPDATE workout_sessions SET status = 'completed', finished_at = ?, duration_sec = ?, notes = ? WHERE id = ? AND user_id = ? AND status = 'active'"
  ),
  upsertSet: db.prepare(
    'INSERT INTO workout_sets (session_id, exercise_key, exercise_name, set_number, weight, reps, rir, completed, logged_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(session_id, exercise_key, set_number) DO UPDATE SET ' +
    'exercise_name = excluded.exercise_name, weight = excluded.weight, reps = excluded.reps, rir = excluded.rir, completed = excluded.completed, logged_at = excluded.logged_at'
  ),
  setsForSession: db.prepare('SELECT * FROM workout_sets WHERE session_id = ? ORDER BY id'),
  // كل مجموعات المستخدم في استعلام واحد
  // قبل كدا كنا بنسأل القاعدة مرة لكل جلسة
  // يعني متدرب عنده 500 جلسة كان بيعمل 500 استعلام في طلب واحد
  setsForUser: db.prepare(
    'SELECT ws.* FROM workout_sets ws JOIN workout_sessions s ON s.id = ws.session_id ' +
    'WHERE s.user_id = ? ORDER BY ws.session_id, ws.id'
  ),
  recentSessions: db.prepare(
    "SELECT id, plan_id, day_key, day_name, status, started_at, finished_at, duration_sec, notes FROM workout_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ?"
  ),
  exerciseHistory: db.prepare(
    "SELECT ws.set_number, ws.weight, ws.reps, ws.rir, ws.completed, ws.logged_at, s.id AS session_id, s.day_name, s.finished_at " +
    "FROM workout_sets ws JOIN workout_sessions s ON s.id = ws.session_id " +
    "WHERE ws.exercise_key = ? AND s.user_id = ? AND s.status = 'completed' " +
    "AND s.id = (SELECT s2.id FROM workout_sessions s2 JOIN workout_sets ws2 ON ws2.session_id = s2.id " +
    "WHERE s2.user_id = ? AND s2.status = 'completed' AND ws2.exercise_key = ? ORDER BY s2.finished_at DESC LIMIT 1) " +
    "ORDER BY ws.set_number ASC"
  ),
  upsertNutrition: db.prepare(
    'INSERT INTO nutrition_days (user_id, day, calories, protein, carbs, fat, water_ml, meals_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(user_id, day) DO UPDATE SET calories=excluded.calories, protein=excluded.protein, carbs=excluded.carbs, fat=excluded.fat, water_ml=excluded.water_ml, meals_json=excluded.meals_json, updated_at=excluded.updated_at'
  ),
  nutritionDay: db.prepare('SELECT * FROM nutrition_days WHERE user_id = ? AND day = ?'),
  upsertWeight: db.prepare(
    'INSERT INTO weight_logs (user_id, day, weight, note, created_at) VALUES (?, ?, ?, ?, ?) ' +
    'ON CONFLICT(user_id, day) DO UPDATE SET weight=excluded.weight, note=excluded.note, created_at=excluded.created_at'
  ),
  recentWeights: db.prepare('SELECT day, weight, note, created_at FROM weight_logs WHERE user_id = ? ORDER BY day DESC LIMIT ?')
  ,
  upsertMeasurement: db.prepare(
    'INSERT INTO body_measurements (user_id, day, waist, chest, hips, arm, thigh, body_fat, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(user_id, day) DO UPDATE SET waist=excluded.waist, chest=excluded.chest, hips=excluded.hips, arm=excluded.arm, thigh=excluded.thigh, body_fat=excluded.body_fat, note=excluded.note, created_at=excluded.created_at'
  ),
  recentMeasurements: db.prepare('SELECT day, waist, chest, hips, arm, thigh, body_fat, note, created_at FROM body_measurements WHERE user_id = ? ORDER BY day DESC LIMIT ?')
  ,
  foodPreferences: db.prepare('SELECT food_id, favorite, use_count, last_used_at, updated_at FROM food_preferences WHERE user_id = ? ORDER BY favorite DESC, last_used_at DESC LIMIT ?'),
  markFoodUsed: db.prepare(
    'INSERT INTO food_preferences (user_id, food_id, favorite, use_count, last_used_at, updated_at) VALUES (?, ?, 0, 1, ?, ?) ' +
    'ON CONFLICT(user_id, food_id) DO UPDATE SET use_count=food_preferences.use_count+1, last_used_at=excluded.last_used_at, updated_at=excluded.updated_at'
  ),
  setFoodFavorite: db.prepare(
    'INSERT INTO food_preferences (user_id, food_id, favorite, use_count, last_used_at, updated_at) VALUES (?, ?, ?, 0, NULL, ?) ' +
    'ON CONFLICT(user_id, food_id) DO UPDATE SET favorite=excluded.favorite, updated_at=excluded.updated_at'
  ),
  nutritionHistory: db.prepare('SELECT * FROM nutrition_days WHERE user_id = ? ORDER BY day DESC LIMIT ?'),

  // طبقة الصفحات
  // الاستعلامات فوق بترجع أحدث عدد محدد وخلاص ودا كافي للمحرك
  // لكن شاشات التاريخ لازم تقرا على دفعات مش تسحب سنة كاملة مرة واحدة
  // مع ألوف المستخدمين الفرق بين صفحة 30 صف و365 صف هو الفرق بين تطبيق سريع وتطبيق بيهنج
  pageWeights: db.prepare('SELECT day, weight, note, created_at FROM weight_logs WHERE user_id = ? ORDER BY day DESC LIMIT ? OFFSET ?'),
  countWeights: db.prepare('SELECT COUNT(*) AS n FROM weight_logs WHERE user_id = ?'),
  pageMeasurements: db.prepare('SELECT day, waist, chest, hips, arm, thigh, body_fat, note, created_at FROM body_measurements WHERE user_id = ? ORDER BY day DESC LIMIT ? OFFSET ?'),
  countMeasurements: db.prepare('SELECT COUNT(*) AS n FROM body_measurements WHERE user_id = ?'),
  pageNutrition: db.prepare('SELECT day, calories, protein, carbs, fat, water_ml, updated_at FROM nutrition_days WHERE user_id = ? ORDER BY day DESC LIMIT ? OFFSET ?'),
  countNutrition: db.prepare('SELECT COUNT(*) AS n FROM nutrition_days WHERE user_id = ?'),
  pageSessions: db.prepare(
    'SELECT id, plan_id, day_key, day_name, status, started_at, finished_at, duration_sec, notes ' +
    'FROM workout_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?'
  ),
  countSessions: db.prepare('SELECT COUNT(*) AS n FROM workout_sessions WHERE user_id = ?'),

  insertClientEvent: db.prepare('INSERT INTO client_events (user_id, event_type, message, stack, app_version, created_at) VALUES (?, ?, ?, ?, ?, ?)')
};

module.exports = {
  db,
  now,
  DB_PATH,
  // [FIX — فقدان الحسابات على استضافة بملفات مؤقتة زي Render المجاني]
  // في وضع Turso الكتابة بتروح للنسخة المحلية الأول وتتزامن مع السحابة كل فترة.
  // على Render المجاني الملفات بتتمسح لما الخدمة تنام/تعيد التشغيل، فلو الكتابة
  // ماوصلتش Turso قبل النوم بينزل الحساب (وده «بينسى الحسابات وبيقول بيانات غير
  // صحيحة» عند إعادة الدخول). syncNow() بيدفع التغييرات لـ Turso فورًا بعد أي
  // كتابة مهمة عشان الداتا تبقى دائمة على طول.
  syncNow() {
    if (!process.env.TURSO_DATABASE_URL) return;
    try { db.sync(); } catch (e) { console.error('[db] syncNow failed:', e && e.message); }
  },
  createUser(email, phone, name, hash, salt) {
    const info = q.createUser.run(email ? String(email).toLowerCase() : null, phone || null, name || null, hash, salt, now());
    const id = Number(info.lastInsertRowid);
    q.ensureSub.run(id, 'free', 'active', now());
    // ادفع الحساب الجديد للسحابة فورًا قبل أي نوم/إعادة تشغيل للخدمة.
    try { if (process.env.TURSO_DATABASE_URL) db.sync(); } catch (_) {}
    return id;
  },
  userByEmail: (email) => q.userByEmail.get(String(email || '').toLowerCase()),
  userByPhone: (phone) => q.userByPhone.get(String(phone || '')),
  userById: (id) => q.userById.get(id),
  touchLogin: (id) => q.touchLogin.run(now(), id),
  getState(userId) {
    const rows = q.getState.all(userId);
    const out = {};
    for (const r of rows) out[r.k] = { v: r.v, updated_at: r.updated_at };
    return out;
  },
  setState(userId, k, v) { q.upsertState.run(userId, k, v, now()); },

  /* Returns { exercise_key: video_id } so the video guard can do an O(1)
     lookup per exercise instead of a query per exercise. */
  videoOverrideMap() {
    const out = {};
    for (const r of q.videoOverrides.all()) out[r.exercise_key] = r.video_id;
    return out;
  },
  videoOverrideList: () => q.videoOverrides.all(),
  videoOverride: (key) => q.videoOverrideGet.get(String(key || '')),
  setVideoOverride(key, name, videoId, note, adminId) {
    q.videoOverrideSet.run(
      String(key || ''),
      name == null ? null : String(name),
      String(videoId == null ? '' : videoId),
      note == null ? null : String(note).slice(0, 300),
      adminId == null ? null : adminId,
      now()
    );
  },
  clearVideoOverride: (key) => q.videoOverrideDelete.run(String(key || '')),

  // تبليغات الفيديو
  // بلاغ واحد مفتوح لكل تمرين لكل مستخدم عشان محدش يغرق الطابور بضغط متكرر
  reportVideo(o) {
    const now = new Date().toISOString();
    const key = String((o && o.exerciseKey) || '').slice(0, 160);
    if (!key) return null;
    const dup = db.prepare(
      "SELECT id FROM video_reports WHERE exercise_key = ? AND user_id IS ? AND status = 'open' LIMIT 1"
    ).get(key, o.userId == null ? null : o.userId);
    if (dup) return dup.id;
    const r = db.prepare(
      'INSERT INTO video_reports (exercise_key, exercise_name, video_id, reason, user_id, status, created_at) ' +
      "VALUES (?, ?, ?, ?, ?, 'open', ?)"
    ).run(
      key,
      String((o && o.exerciseName) || '').slice(0, 160),
      String((o && o.videoId) || '').slice(0, 40),
      String((o && o.reason) || '').slice(0, 300),
      o && o.userId != null ? o.userId : null,
      now
    );
    return Number(r.lastInsertRowid);
  },
  // الطابور مجمّع بالتمرين عشان صاحب المشروع يشوف أكتر فيديو اتشتكى منه فوق
  videoReports(status, limit) {
    const st = String(status || 'open');
    return db.prepare(
      'SELECT exercise_key, exercise_name, video_id, COUNT(*) AS reports, ' +
      'MAX(created_at) AS last_at, MIN(created_at) AS first_at ' +
      'FROM video_reports WHERE status = ? GROUP BY exercise_key ' +
      'ORDER BY reports DESC, last_at DESC LIMIT ?'
    ).all(st, Math.max(1, Math.min(500, Number(limit) || 200)));
  },
  openVideoReportCount() {
    const r = db.prepare("SELECT COUNT(*) AS n FROM video_reports WHERE status = 'open'").get();
    return r ? Number(r.n) : 0;
  },
  resolveVideoReports(key) {
    return db.prepare(
      "UPDATE video_reports SET status = 'resolved', resolved_at = ? WHERE exercise_key = ? AND status = 'open'"
    ).run(new Date().toISOString(), String(key || ''));
  },
  removeState(userId, k) { q.deleteState.run(userId, k); },
  getSubscription: (userId) => q.getSub.get(userId),
  setName: (id, name) => q.setName.run(name, id),
  setEmail: (id, email) => q.setEmail.run(email ? String(email).toLowerCase() : null, id),
  setPhone: (id, phone) => q.setPhone.run(phone || null, id),
  setVerified: (id) => q.setVerified.run(id),
  setPassword: (id, hash, salt) => q.setPassword.run(hash, salt, id),
  // The audit trail must never break a request, but a trail that fails silently
  // is worse than none: it looks complete while missing events.
  audit(userId, action, ip) {
    try { q.audit.run(userId || null, action, ip || null, now()); }
    catch (e) { console.error('[db] audit write failed for', action, '-', e && e.message); }
  },
  upsertReview(userId, rating, title, body, displayName, isCustomer) {
    const t = now();
    q.upsertReview.run(userId, rating, title || null, body, displayName || null, isCustomer ? 1 : 0, t, t);
    return q.reviewByUser.get(userId);
  },
  reviewByUser: (userId) => q.reviewByUser.get(userId),
  listApprovedReviews: (limit) => q.listApprovedReviews.all(limit || 50),
  approvedReviewStats() { const r = q.approvedStats.get() || {}; return { count: r.n || 0, avg: r.avg ? Math.round(r.avg * 10) / 10 : 0 }; },
  listReviewsByStatus: (status, limit) => q.listReviewsByStatus.all(status, limit || 200),
  setReviewStatus(id, status) { q.setReviewStatus.run(status, status === 'approved' ? now() : null, id); return q.reviewById.get(id); }
  ,
  mobileProfile(userId) { return mobileQ.profile.get(userId); },
  saveMobileProfile(userId, json) { mobileQ.upsertProfile.run(userId, json, now()); },
  saveWorkoutPlan(userId, planKey, json) {
    const t = now();
    db.exec('BEGIN;');
    try {
      mobileQ.deactivatePlans.run(t, userId);
      const info = mobileQ.insertPlan.run(userId, planKey, json, t, t);
      db.exec('COMMIT;');
      return Number(info.lastInsertRowid);
    } catch (e) { db.exec('ROLLBACK;'); throw e; }
  },
  activeWorkoutPlan(userId) { return mobileQ.activePlan.get(userId); },
  startWorkoutSession(userId, planId, dayKey, dayName, startedAt) {
    const info = mobileQ.startSession.run(userId, planId || null, dayKey, dayName || null, startedAt || now());
    return Number(info.lastInsertRowid);
  },
  workoutSession(id, userId) { return mobileQ.sessionById.get(id, userId); },
  activeWorkoutSession(userId) { return mobileQ.activeSession.get(userId); },
  saveWorkoutSet(v) {
    mobileQ.upsertSet.run(v.sessionId, v.exerciseKey, v.exerciseName, v.setNumber, v.weight, v.reps, v.rir, v.completed ? 1 : 0, now());
  },
  workoutSets(sessionId) { return mobileQ.setsForSession.all(sessionId); },
  // مجموعات جلسات محددة بس
  //
  // ليه موجوة
  // workoutSetsByUser تحت بتسحب كل مجموعة سجلها المستخدم في حياته، وشاشة
  // التاريخ بتعرض آخر 60 جلسة بس. متدرب بقاله سنتين كان بيقرا 18 ألف صف
  // عشان يستخدم جزء صغير منهم. القراية بقت محدودة بالجلسات المعروضة فعلا.
  workoutSetsForSessions(sessionIds) {
    const out = new Map();
    const ids = (Array.isArray(sessionIds) ? sessionIds : []).map(Number).filter(Number.isFinite);
    if (!ids.length) return out;
    const rows = db.prepare(
      'SELECT * FROM workout_sets WHERE session_id IN (' + ids.map(() => '?').join(',') + ') ORDER BY session_id, id'
    ).all(...ids);
    for (const row of rows) {
      const list = out.get(row.session_id);
      if (list) list.push(row); else out.set(row.session_id, [row]);
    }
    return out;
  },
  // مجموعات المستخدم مجمعة برقم الجلسة من استعلام واحد
  workoutSetsByUser(userId) {
    const out = new Map();
    for (const row of mobileQ.setsForUser.all(userId)) {
      const list = out.get(row.session_id);
      if (list) list.push(row); else out.set(row.session_id, [row]);
    }
    return out;
  },
  finishWorkoutSession(id, userId, finishedAt, durationSec, notes) {
    return mobileQ.finishSession.run(finishedAt || now(), durationSec || 0, notes || null, id, userId);
  },
  recentWorkoutSessions(userId, limit) { return mobileQ.recentSessions.all(userId, limit || 20); },
  exerciseHistory(userId, exerciseKey) { return mobileQ.exerciseHistory.all(exerciseKey, userId, userId, exerciseKey); },
  saveNutritionDay(userId, day, v) {
    mobileQ.upsertNutrition.run(userId, day, v.calories, v.protein, v.carbs, v.fat, v.waterMl, JSON.stringify(v.meals || []), now());
  },
  nutritionDay(userId, day) { return mobileQ.nutritionDay.get(userId, day); },
  saveWeight(userId, day, weight, note) { mobileQ.upsertWeight.run(userId, day, weight, note || null, now()); },
  recentWeights(userId, limit) { return mobileQ.recentWeights.all(userId, limit || 30); }
  ,
  saveMeasurement(userId, day, value) {
    mobileQ.upsertMeasurement.run(userId, day, value.waist, value.chest, value.hips, value.arm, value.thigh, value.bodyFat, value.note || null, now());
  },
  recentMeasurements(userId, limit) { return mobileQ.recentMeasurements.all(userId, limit || 30); }
  ,
  foodPreferences(userId, limit) { return mobileQ.foodPreferences.all(userId, limit || 100); },
  markFoodUsed(userId, foodId) { const t=now(); mobileQ.markFoodUsed.run(userId, foodId, t, t); },
  setFoodFavorite(userId, foodId, favorite) { mobileQ.setFoodFavorite.run(userId, foodId, favorite ? 1 : 0, now()); }
  ,
  nutritionHistory(userId, limit) { return mobileQ.nutritionHistory.all(userId, limit || 365); },

  // قراية على صفحات
  // كل دالة بترجع الصفوف والعدد الكلي وهل فيه كمان وراها
  // الحد الأقصى 100 صف عشان محدش يقدر يطلب مليون صف ويوقع الخدمة
  _page(rowsStmt, countStmt, userId, limit, offset) {
    const lim = Math.min(100, Math.max(1, Number(limit) || 30));
    const off = Math.max(0, Number(offset) || 0);
    const rows = rowsStmt.all(userId, lim, off);
    const total = (countStmt.get(userId) || {}).n || 0;
    return { rows, total, limit: lim, offset: off, hasMore: off + rows.length < total };
  },
  weightsPage(userId, limit, offset) { return this._page(mobileQ.pageWeights, mobileQ.countWeights, userId, limit, offset); },
  measurementsPage(userId, limit, offset) { return this._page(mobileQ.pageMeasurements, mobileQ.countMeasurements, userId, limit, offset); },
  nutritionPage(userId, limit, offset) { return this._page(mobileQ.pageNutrition, mobileQ.countNutrition, userId, limit, offset); },
  workoutSessionsPage(userId, limit, offset) { return this._page(mobileQ.pageSessions, mobileQ.countSessions, userId, limit, offset); },

  saveClientEvent(userId, value) { mobileQ.insertClientEvent.run(userId, value.type, value.message, value.stack || null, value.appVersion || null, now()); }
};

// ─── Feature Flags ───
db.exec(`
  CREATE TABLE IF NOT EXISTS feature_flags (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '1'
  );
  INSERT OR IGNORE INTO feature_flags(key,value) VALUES('ai_nutritionist','1');
  INSERT OR IGNORE INTO feature_flags(key,value) VALUES('ai_coach','1');
`);

const ffQ = {
  get:    db.prepare('SELECT value FROM feature_flags WHERE key = ?'),
  set:    db.prepare('INSERT INTO feature_flags(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'),
  getAll: db.prepare('SELECT key, value FROM feature_flags')
};

module.exports.getFeatureFlag    = (key)        => { const r = ffQ.get.get(key); return r ? r.value : null; };
module.exports.setFeatureFlag    = (key, value) => ffQ.set.run(key, String(value));
module.exports.getAllFeatureFlags = ()           => ffQ.getAll.all();
