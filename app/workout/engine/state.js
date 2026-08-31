// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATE — engine/state.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const state = {
  age:null,height:null,weight:null,gender:'',
  exp:'',days:null,time:null,goal:'',equip:'',
  sleep:'',stress:'',daily:'moderate',
  injuries:[],weak:[],
  bmi:null,bmiCat:'',tdee:null,recoveryScore:null,
  fatigueCap:null,trainingTolerance:null,weeklyVolCap:null,abilityRecover:null,
  recommendedSplit:'',selectedSplit:'',
  splitData:null,activeModules:[],plan:null
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ██████╗ ██████╗     ███████╗██╗  ██╗███████╗██████╗  ██████╗██╗███████╗███████╗
// GYM EXERCISE DATABASE — FULL 150+ EXERCISES — GYM EQUIPMENT ONLY
// Each entry: {n, alt, vid, mu, tier, safe_injuries:[...], goal_bonus:[...]}
// safe_injuries = injuries where this exercise is SAFE to keep
// goal_bonus = goals where this exercise is extra beneficial
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function saveStateToStorage() {
  try {
    const toSave = {};
    STATE_FIELDS_TO_SAVE.forEach(k => { toSave[k] = state[k]; });
    // sessionStorage: تتمسح تلقائيا لما يغلق التاب — ريفريش واحد فقط يرجع البيانات
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    sessionStorage.removeItem(STORAGE_KEY + '_used');
  } catch(e) {}
}

function loadStateFromStorage() {
  try {
    // لو اتاستهلك قبل كده (ريفريش ثاني) - لا ترجع حاجة
    if (sessionStorage.getItem(STORAGE_KEY + '_used')) return false;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    STATE_FIELDS_TO_SAVE.forEach(k => {
      if (saved[k] !== undefined && saved[k] !== null) state[k] = saved[k];
    });
    // علامة: البيانات اتاستهلكت — الريفريش التالي يبدأ نظيف
    sessionStorage.setItem(STORAGE_KEY + '_used', '1');
    return true;
  } catch(e) { return false; }
}

// UI restoration and navigation hooks live in ui/state-persistence.js.
