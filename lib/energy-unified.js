'use strict';
// lib/energy-unified.js — [OWNER-RULE] مرجع واحد للسعرات.
//
// المشكلة اللي اتصلحت هنا: صفحة التمرين كانت بتعرض TDEE محسوب من محرك
// التمرين (Mifflin-St Jeor × معامل نشاط)، وصفحة التغذية بتعرض رقم تاني
// طالع من محرك التغذية (وفوقه طبقة سياسة السن Schofield). يعني المتدرب
// كان يشوف رقمين مختلفين لنفس الحاجة — وده بيهدم الثقة في السيستم كله.
//
// القرار: محرك التغذية هو المرجع (لأنه اللي بيبني عليه الأكل فعليًا
// وفوقه سياسة السن والحدود الآمنة)، وصفحة التمرين بتعرض نفس رقمه.
// لو حصل أي خطأ في محرك التغذية، بنرجع لرقم محرك التمرين بدل ما نكسر الصفحة.

const vocab = require('./goal-vocabulary');
// [OWNER-RULE] المرجع الحقيقي للسعرات هو نفس مسار صفحة التغذية بالظبط:
// bridge.buildEngineContext(mobileProfile) ثم host.computeTargets. كده
// صفحة التمرين وصفحة التغذية بيحسبوا من نفس البروفايل الكامل (وزن، طول،
// weeklyRate، دهون، محيطات، صحة) فيطلعوا نفس الرقم بالظبط مش رقمين.
const bridge = require('./mobile-nutrition-bridge');

// نفس معاملات النشاط المستخدمة في محرك التمرين (app/workout/engine/analysis.js).
const ACTIVITY = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

// هدف محرك التمرين -> هدف محرك التغذية.
const WORKOUT_TO_NUTRITION_GOAL = {
  cut: 'cut',
  muscle: 'bulk',
  strength: 'bulk',
  fitness: 'recomp',
};

function activityFactor(daily) {
  const f = ACTIVITY[String(daily || '').trim()];
  return Number.isFinite(f) ? f : ACTIVITY.moderate;
}

/**
 * يحوّل بروفايل محرك التمرين لبروفايل يفهمه محرك التغذية.
 */
function toNutritionProfile(workoutProfile) {
  const p = workoutProfile || {};
  const goal = WORKOUT_TO_NUTRITION_GOAL[String(p.goal || '').trim()] || 'maintain';
  return {
    gender: p.gender === 'female' ? 'female' : 'male',
    age: Number(p.age) || 0,
    height: Number(p.height) || 0,
    weight: Number(p.weight) || 0,
    activity: activityFactor(p.daily),
    goal: goal,
  };
}

/**
 * الرقم الموحّد. بيرجّع { bmr, tdee, targetCals, source } أو null لو ماقدرش.
 * @param {object} workoutProfile بروفايل بلغة محرك التمرين.
 */
function unifiedEnergy(workoutProfile) {
  const p = workoutProfile || {};
  if (!Number.isFinite(Number(p.age)) || Number(p.age) <= 0) return null;
  if (!Number.isFinite(Number(p.height)) || Number(p.height) <= 0) return null;
  if (!Number.isFinite(Number(p.weight)) || Number(p.weight) <= 0) return null;
  try {
    // بنحمّل محرك التغذية كسولي (lazy) عشان مانثقلش بدء السيرفر.
    const host = require('./nutrition-engine-host');
    const t = host.computeTargets(toNutritionProfile(p), {});
    if (!t) return null;
    const tdee = Number(t.tdee);
    if (!Number.isFinite(tdee) || tdee <= 0) return null;
    return {
      bmr: Number(t.bmr) || null,
      tdee: Math.round(tdee),
      targetCals: Number.isFinite(Number(t.targetCals)) ? Math.round(Number(t.targetCals)) : null,
      source: 'nutrition_engine',
    };
  } catch (e) {
    return null;
  }
}

/**
 * يوحّد رقم السعرات جوّا metrics بتاع خطة التمرين (تعديل في المكان).
 * لو ماقدرناش نحسب، بنسيب رقم محرك التمرين زي ما هو.
 */
function unifyPlanMetrics(full, workoutProfile, mobileProfile) {
  if (!full || !full.metrics) return full;
  // الأفضلية للبروفايل الموبايل الكامل (نفس مصدر صفحة التغذية) عشان
  // الرقمين يطابقوا بعض تمامًا. لو مش متاح بنرجع لبروفايل محرك التمرين.
  let e = null;
  if (mobileProfile && typeof mobileProfile === 'object') {
    e = unifiedFromMobile(mobileProfile, mobileProfile.__extras || {});
  }
  if (!e) e = unifiedEnergy(workoutProfile);
  if (!e) return full;
  full.metrics.tdee = e.tdee;
  if (e.bmr) full.metrics.bmr = Math.round(e.bmr);
  // بنورّي كمان هدف السعرات عشان يطابق صفحة التغذية بالظبط.
  if (e.targetCals) full.metrics.targetCals = e.targetCals;
  full.metrics.calorieSource = e.source;
  return full;
}

/**
 * الرقم الموحّد من بروفايل الموبايل الكامل — نفس مسار صفحة التغذية.
 * بيرجّع { bmr, tdee, targetCals, source } أو null.
 */
function unifiedFromMobile(mobileProfile, extras) {
  const p = mobileProfile && typeof mobileProfile === 'object' ? mobileProfile : null;
  if (!p) return null;
  if (!(Number(p.age) > 0 && Number(p.height) > 0 && Number(p.weight) > 0)) return null;
  try {
    const host = require('./nutrition-engine-host');
    const ctx = bridge.buildEngineContext(p, extras || {});
    const t = host.computeTargets(ctx.profile, ctx.inputs);
    if (!t) return null;
    const tdee = Number(t.tdee);
    if (!Number.isFinite(tdee) || tdee <= 0) return null;
    return {
      bmr: Number(t.bmr) || null,
      tdee: Math.round(tdee),
      targetCals: Number.isFinite(Number(t.targetCals)) ? Math.round(Number(t.targetCals)) : null,
      source: 'nutrition_engine',
    };
  } catch (e) {
    return null;
  }
}

module.exports = {
  ACTIVITY: ACTIVITY,
  unifiedFromMobile: unifiedFromMobile,
  activityFactor: activityFactor,
  toNutritionProfile: toNutritionProfile,
  unifiedEnergy: unifiedEnergy,
  unifyPlanMetrics: unifyPlanMetrics,
};
