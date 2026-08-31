'use strict';
// lib/self-report.js — [OWNER-RULE] الذكاء مايقفش لو المتدرب ماسجّلش.
//
// المشكلة: محرك تطوير المتدرب (تغذية وتمرين) مبني على الداتا المدخلة.
// لو المستخدم ماسجّلش أكله ولا جلساته، الحالة بتفضل 'collecting' للأبد
// والخطة ماتتقدمش خالص — يعني المتدرب متجمّد مكانه وهو مش حاسس.
//
// الحل: عند موعد تغيير الخطة، لو مفيش داتا كافية، المدرب بيسأل سؤال
// واحد قصير عن الالتزام، والرد بيترجم لـ adherencePct تقديري يغذّي نفس
// محرك التدرج الموجود — مش محرك تاني موازي.
//
// مهم من ناحية الأمان العلمي: رد المتدرب تقدير ذاتي مش قياس، فبنعلّمه
// (source='self_reported') وبنقلّل حجم أي تعديل مبني عليه، ومابنديهوش
// نفس ثقة الداتا المسجّلة فعليًا.

const db = require('./db');

let ready = false;
function ensureTable() {
  if (ready) return;
  db.db.prepare(
    `CREATE TABLE IF NOT EXISTS adherence_checkins(
       user_id     INTEGER NOT NULL,
       scope       TEXT    NOT NULL,
       answer      TEXT    NOT NULL,
       pct         INTEGER NOT NULL,
       asked_for   TEXT,
       created_at  TEXT    NOT NULL,
       PRIMARY KEY(user_id, scope)
     )`
  ).run();
  ready = true;
}

// ترجمة الرد لنسبة التزام تقديرية.
// الأرقام متحفّظة عن قصد: الناس بتبالغ في تقييم نفسها، فـ"التزمت
// تمامًا" بتدي 92 مش 100، وده لسّه فوق عتبة 85 اللي بيشتغل عليها
// plateauStatus، فالخطة تتقدم فعليًا بدل ما تتجمد.
const ANSWERS = {
  full:    { pct: 92, label: 'التزمت تمامًا' },
  partial: { pct: 70, label: 'نص نص' },
  none:    { pct: 40, label: 'مالتزمتش' },
};

function normalizeAnswer(a) {
  const key = String(a || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ANSWERS, key) ? key : null;
}

function normalizeScope(s) {
  const key = String(s || '').trim().toLowerCase();
  return key === 'workout' ? 'workout' : 'nutrition';
}

/** يسجّل رد المتدرب على سؤال الالتزام. يرجّع السجل أو null. */
function record(userId, scope, answer, askedFor) {
  const key = normalizeAnswer(answer);
  if (!key || !userId) return null;
  ensureTable();
  const sc = normalizeScope(scope);
  const now = new Date().toISOString();
  db.db.prepare(
    `INSERT OR REPLACE INTO adherence_checkins(user_id,scope,answer,pct,asked_for,created_at)
     VALUES(?,?,?,?,?,?)`
  ).run(userId, sc, key, ANSWERS[key].pct, askedFor || null, now);
  return { scope: sc, answer: key, pct: ANSWERS[key].pct, createdAt: now };
}

/** آخر رد مسجّل — وبينتهي بعد 10 أيام عشان مايفضلش ماسك الخطة للأبد. */
function latest(userId, scope) {
  if (!userId) return null;
  ensureTable();
  const row = db.db.prepare(
    `SELECT scope,answer,pct,asked_for,created_at FROM adherence_checkins
      WHERE user_id=? AND scope=?`
  ).get(userId, normalizeScope(scope));
  if (!row) return null;
  const ts = Date.parse(row.created_at);
  const ageDays = Number.isFinite(ts) ? (Date.now() - ts) / 86400000 : 999;
  if (ageDays > 10) return null;
  return {
    scope: row.scope,
    answer: row.answer,
    pct: row.pct,
    ageDays: Math.round(ageDays),
    createdAt: row.created_at,
  };
}

/**
 * هل لازم نسأل دلوقت؟ نسأل لما يبقى موعد تغيير الخطة ومفيش داتا كافية
 * ومفيش رد حديث مسجّل.
 */
function due(o) {
  const opt = o || {};
  if (!opt.userId) return false;
  if (!opt.planDue) return false;
  const minLogged = Number.isFinite(opt.minLogged) ? opt.minLogged : 4;
  if (Number(opt.loggedDays || 0) >= minLogged) return false;
  return !latest(opt.userId, opt.scope);
}

/** نص السؤال مع الخيارات، مصوغ على حسب التعديل اللي هيتعمل. */
function question(o) {
  const opt = o || {};
  const scope = normalizeScope(opt.scope);
  let text;
  if (scope === 'workout') {
    const d = Number(opt.trainingDays || 0);
    text = d > 0
      ? 'قبل ما أظبط جدولك الجديد — التزمت بـ ' + d + ' أيام تمرين في الأسبوع اللي فات؟'
      : 'قبل ما أظبط جدولك الجديد — التزمت بتمارينك الأسبوع اللي فات؟';
  } else {
    const c = Number(opt.targetCals || 0);
    text = c > 0
      ? 'قبل ما أعدّل خطتك — التزمت بحدود ' + Math.round(c) + ' سعرة في اليوم؟'
      : 'قبل ما أعدّل خطتك — التزمت بخطة الأكل الأسبوع اللي فات؟';
  }
  return {
    scope: scope,
    text: text,
    note: 'ردك هيخليني أحرّك خطتك للمرحلة اللي بعدها بدل ما تقف مكانها',
    options: Object.keys(ANSWERS).map(function (k) {
      return { value: k, label: ANSWERS[k].label };
    }),
  };
}

/**
 * يدمج الداتا الحقيقية مع الرد الذاتي. الداتا المسجّلة دايمًا لها الأولوية.
 * @returns {{pct:number, source:string, confidence:number}}
 */
function resolveAdherence(o) {
  const opt = o || {};
  const loggedPct = Number(opt.loggedPct);
  const loggedDays = Number(opt.loggedDays || 0);
  const minLogged = Number.isFinite(opt.minLogged) ? opt.minLogged : 4;
  if (loggedDays >= minLogged && Number.isFinite(loggedPct) && loggedPct > 0) {
    return { pct: loggedPct, source: 'logged', confidence: 1 };
  }
  const said = latest(opt.userId, opt.scope);
  if (said) {
    // ثقة أقل — وده بيترجم لتعديل أصغر في الطبقة اللي فوق.
    return { pct: said.pct, source: 'self_reported', confidence: 0.6 };
  }
  return {
    pct: Number.isFinite(loggedPct) ? loggedPct : 0,
    source: 'none',
    confidence: 0,
  };
}

module.exports = {
  ANSWERS: ANSWERS,
  record: record,
  latest: latest,
  due: due,
  question: question,
  resolveAdherence: resolveAdherence,
  normalizeAnswer: normalizeAnswer,
  normalizeScope: normalizeScope,
};
