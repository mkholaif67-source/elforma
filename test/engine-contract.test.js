'use strict';
const assert = require('node:assert/strict');
const nutrition = require('../lib/nutrition-engine-host');
const workout = require('../lib/workout-engine-host');

const mealResult = nutrition.computeMealPlan({
  gender: 'male', age: 30, height: 178, weight: 82, target: 75,
  activity: 1.55, goal: 'lose', selectedDiet: 'balanced', mealCount: 4,
}, {});
const meal = mealResult.plan.meals[0];
assert.ok(meal.label, 'meal.label is required');
assert.ok(Array.isArray(meal.foods) && meal.foods.length > 0, 'meal.foods is required');
assert.ok(Number.isFinite(meal.totals.cals), 'meal.totals.cals is required');
assert.ok(meal.foods[0].food.nameAr, 'meal.foods[].food.nameAr is required');
assert.ok(Number.isFinite(meal.foods[0].grams), 'meal.foods[].grams is required');

const workoutResult = workout.computeWorkout({
  gender: 'male', age: 30, height: 178, weight: 82,
  goal: 'muscle', exp: 'intermediate', equip: 'gym', days: 4,
  time: '60', daily: 'moderate', sleep: 'ok', stress: 'low',
  injuries: [], weak: ['chest'],
});
const plan = workoutResult.plans.find((item) => item.rec) || workoutResult.plans[0];
const day = plan.trainDays[0];
const exercise = day.exercises[0];
assert.ok(exercise.n || exercise.name, 'exercise name is required');
assert.ok(exercise.vid || exercise.v || exercise.video, 'exercise video is required');
assert.ok(exercise.rest || exercise.restSec, 'exercise rest is required');
assert.ok(exercise.sets, 'exercise sets is required');
assert.ok(exercise.reps, 'exercise reps is required');

const foods = nutrition.searchFoods({
  query: 'فراخ', category: 'protein', diet: 'balanced', health: [],
});
assert.ok(foods.length > 0, 'food search must return results');
assert.ok(foods[0].id && foods[0].nameAr, 'food identity is required');
assert.ok(Number.isFinite(foods[0].cal), 'food calories are required');
assert.ok(Number.isFinite(foods[0].pro), 'food protein is required');

console.log('Engine contracts passed');
