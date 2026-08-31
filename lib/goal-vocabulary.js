'use strict';
// ═════════════════════════════════════════════════════════════════════
// GOAL VOCABULARY — single source of truth for translating a user's goal.
//
// The app, the website and two engines each speak a slightly different dialect.
// The translation used to be copy-pasted across three files, so a change in one
// could silently drift from the others. This module is now the ONE place the
// server translates a goal, and `translation-contract.test.js` pins it.
//
// There are TWO deliberately different target vocabularies. This is NOT a bug:
//   • NUTRITION engine goals : 'cut' | 'bulk' | 'recomp' | 'maintain'
//   • WORKOUT   engine goals : 'cut' | 'muscle' | 'strength' | 'fitness'
// A mobile 'maintain' means "hold weight" to the nutrition engine (-> 'maintain')
// but "general fitness training" to the workout engine (-> 'fitness'). Merging
// the two would destroy correct behaviour, so we keep them separate but pinned.
//
// The Flutter client mirrors MOBILE_TO_WORKOUT in
// mobile/lib/models/profile_store.dart (`workoutGoal`). If you change one, change
// both; the contract test guards the server half.
// ═════════════════════════════════════════════════════════════════════

// mobile answer -> NUTRITION engine goal
var MOBILE_TO_NUTRITION = { lose: 'cut', maintain: 'maintain', gain: 'bulk', strength: 'bulk', fitness: 'recomp' };
var NUTRITION_GOAL_DEFAULT = 'maintain';

// mobile answer -> WORKOUT engine goal (canonical spec the Dart client mirrors)
var MOBILE_TO_WORKOUT = { lose: 'cut', gain: 'muscle', strength: 'strength', fitness: 'fitness', maintain: 'fitness' };

// valid WORKOUT engine goals the server accepts from an already-translated client
var WORKOUT_GOALS = ['cut', 'muscle', 'strength', 'fitness'];
var WORKOUT_GOAL_DEFAULT = 'muscle';

function has(map, key) { return Object.prototype.hasOwnProperty.call(map, key); }

function toNutritionGoal(mobileGoal) {
  return has(MOBILE_TO_NUTRITION, mobileGoal) ? MOBILE_TO_NUTRITION[mobileGoal] : NUTRITION_GOAL_DEFAULT;
}
function toWorkoutGoal(mobileGoal) {
  return has(MOBILE_TO_WORKOUT, mobileGoal) ? MOBILE_TO_WORKOUT[mobileGoal] : WORKOUT_GOAL_DEFAULT;
}
// Sanitise an ALREADY-translated workout goal coming from the client.
function whitelistWorkoutGoal(goal) {
  return WORKOUT_GOALS.indexOf(goal) > -1 ? goal : WORKOUT_GOAL_DEFAULT;
}

module.exports = {
  MOBILE_TO_NUTRITION: MOBILE_TO_NUTRITION,
  NUTRITION_GOAL_DEFAULT: NUTRITION_GOAL_DEFAULT,
  MOBILE_TO_WORKOUT: MOBILE_TO_WORKOUT,
  WORKOUT_GOALS: WORKOUT_GOALS,
  WORKOUT_GOAL_DEFAULT: WORKOUT_GOAL_DEFAULT,
  toNutritionGoal: toNutritionGoal,
  toWorkoutGoal: toWorkoutGoal,
  whitelistWorkoutGoal: whitelistWorkoutGoal
};
