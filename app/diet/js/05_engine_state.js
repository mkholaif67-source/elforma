// ═══════════════════════════════════════════════════════════════
//  ENGINE STATE
// ═══════════════════════════════════════════════════════════════
const DE = {
  gender: 'ذكر', age: null, height: null, weight: null, target: null,
  activity: 1.375, goal: null, gainStyle: null,
  healthConditions: [], dietProblems: [],
  workoutType: null, gymSplit: 'default', homeSplit: 'default',
  mealCount: 3, snacks: false,
  selectedDiet: null,
  availableFoods: [],   // - NEW: food IDs chosen by user
  currentStep: 1,
  foodSearchCat: 'all',
  currentWeek: 1,        // - INTEGRATION: active week for DWCP-driven meal generation
  // ---- progress feedback (real weigh-ins + adherence) ----
  weightLog: [],          // [{ week:N, weight:X }] actual logged weights
  adherencePct: null,     // real self-reported adherence (1-100); null until provided
  expectedWeeklyLoss: 0.5 // target weekly loss (kg/week); updated from buildResults
};
