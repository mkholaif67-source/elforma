// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILS — engine/utils.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ── Bidi Fix: Mixed Arabic/English/Numbers text renderer ─────────────────
// يلف اسم التمرين الإنجليزي + رقمه المتصل في <bdi dir="ltr"> واحد
// الأرقام والوحدات العربية (ث/جانب/×) تفضل في تدفق RTL الطبيعي
function mixedText(str) {
  if (!str) return str;
  // RLM يجبر المتصفح يبدأ التقييم من اليمين
  const RLM = '\u200F';
  const result = str.replace(
    /([A-Za-z][A-Za-z0-9 '\-.]*\b(?:\s*\d[\d\-.]*)?)/g,
    (match) => {
      if (!/[A-Za-z]/.test(match)) return match;
      return '<bdi dir="ltr">' + match.trimEnd() + '</bdi>';
    }
  );
  return RLM + result;
}

function getDB(equip){
  if(equip === 'home') return HOME_DB;
  return GYM_DB;
}

// Validate that exercise belongs to the correct database context
function validateExerciseSource(exName, equip){
  const db = getDB(equip);
  for(const grp of Object.values(db)){
    for(const sub of Object.values(grp)){
      if(Array.isArray(sub) && sub.some(e=>e.n===exName)) return true;
    }
  }
  return false; // exercise not found in approved DB for this equip type
}

// Legacy alias kept for any remaining references
const DB = GYM_DB;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VIDEO VALIDATION — async check with smart fallback
// Fallback map: if vid unavailable, use this backup vid
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const VID_FALLBACKS = {
  // chest
  '8iPEnn-ltC8':'SCVCLChPQEY', 'D3mMVuWqnSs':'Z57CtFmRMxA',
  'SCVCLChPQEY':'dRp4UqHRTVo', 'dRp4UqHRTVo':'Z57CtFmRMxA',
  'Z57CtFmRMxA':'dRp4UqHRTVo', '2z8JmcrW-As':'nEF0bv2z-gE',
  // back
  'CAwf7n6Luuc':'xBmfkqbGUWs', 'xBmfkqbGUWs':'CAwf7n6Luuc',
  'eGo4IYlbE5g':'CAwf7n6Luuc', 'JObJSYKR5lw':'xBmfkqbGUWs',
  'UtOHMCmOAYI':'GZbfZ033f74', 'GZbfZ033f74':'UtOHMCmOAYI',
  '0fnkODFYbVY':'pYcpY20QaE8', 'pYcpY20QaE8':'GZbfZ033f74',
  'V8dZ3x7a4EQ':'Yfx4LxQBkwk', 'Yfx4LxQBkwk':'V8dZ3x7a4EQ',
  // legs
  'rYgNArpwE7E':'ultWZbUMPL8', 'ultWZbUMPL8':'iGK-yd6j8Ko',
  'iGK-yd6j8Ko':'sEM_zo6HKLA', '1vdoqE--qTA':'rYgNArpwE7E',
  'sEM_zo6HKLA':'iGK-yd6j8Ko', 'YyvSfVjQeL0':'sEM_zo6HKLA',
  '2C-uNgKwPLE':'sEM_zo6HKLA', 'm4ytaCJZDoE':'ultWZbUMPL8',
  'JCXUYuzwNrM':'EfeVvA1vdd4', 'EfeVvA1vdd4':'1Tq3QdYUuHs',
  '1Tq3QdYUuHs':'EfeVvA1vdd4', 'xDmFkJxPzeM':'OUgsJ8-Vi0E',
  'OUgsJ8-Vi0E':'tHGR_3MsVBg', 'tHGR_3MsVBg':'OUgsJ8-Vi0E',
  'YA-h3n9L4YU':'JCXUYuzwNrM', 'gwLzBkvzekY':'c5b-rGRXvXk',
  'JbyjNymZOt0':'gwLzBkvzekY', 'IGwqbwVCRuA':'gwLzBkvzekY',
  'c5b-rGRXvXk':'gwLzBkvzekY',
  // shoulders
  'WvLMauqrnK8':'qEwKCR5JCog', 'qEwKCR5JCog':'WvLMauqrnK8',
  'PPGKIKsR5Ec':'fEFNezIgMeQ', 'fEFNezIgMeQ':'PPGKIKsR5Ec',
  'eIq5CB9JfKE':'V8dZ3x7a4EQ',  // patched - use rope face pull ID
  // arms
  '_4EGFiBU0PY':'soxrZlIl35U', 'soxrZlIl35U':'_4EGFiBU0PY',
  'fIWP-FRFNU0':'av7-8CzC9Vk', 'zG2C55O9FHs':'fIWP-FRFNU0',
  'av7-8CzC9Vk':'zG2C55O9FHs', 'zC3nLlEvin4':'av7-8CzC9Vk',
  // triceps
  'd_KZxkY_gmE':'2-LAMcpzODU', '2-LAMcpzODU':'nEF0bv2z-gE',  // tricep chain (correct)
  'Hq71JvEQpKo':'2-LAMcpzODU',
  'nEF0bv2z-gE':'2-LAMcpzODU', '6Fzep104f0s':'2-LAMcpzODU',
  // core (separate from triceps)
  '_gsUck-7M-o':'6HgNrPFaGlw',
  // misc
  'V7bCBlMMPFY':'G8l_8chR5BE', 'G8l_8chR5BE':'V7bCBlMMPFY',
  'Fkzks_YrMOI':'V7bCBlMMPFY', 'cJRVVxmytaM':'eSIUSUoJPJ8',
  'eSIUSUoJPJ8':'cJRVVxmytaM', '6HgNrPFaGlw':'eGo4IYlbE5g',
  'cfns6QMnFNc':'IODxDxX7oi4', 'IODxDxX7oi4':'cfns6QMnFNc'
};

// Cache of validated vids: 'vid' -> true|false
const _vidCache = {};

// Fire-and-forget video check using oEmbed (no CORS issue)
function checkVideoAvailable(vid){
  if(!vid) return Promise.resolve(false);
  if(_vidCache[vid]!==undefined) return Promise.resolve(_vidCache[vid]);
  const url = 'https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + vid) + '&format=json';
  return fetch(url,{method:'GET'})
    .then(r=>{ const ok=r.ok; _vidCache[vid]=ok; return ok; })
    .catch(()=>{ _vidCache[vid]=false; return false; });
}

// Get valid vid with fallback (sync — uses cache, fires async pre-check)
function getValidVid(vid){
  if(!vid) return '6HgNrPFaGlw';
  if(_vidCache[vid]===true) return vid;
  if(_vidCache[vid]===false){
    const fb = VID_FALLBACKS[vid]||'6HgNrPFaGlw';
    return _vidCache[fb]===false ? '6HgNrPFaGlw' : fb;
  }
  // Not checked yet — pre-check async, return original for now
  checkVideoAvailable(vid);
  return vid;
}

// Pre-warm video cache for all exercises in a plan
function prewarmVideos(plan){
  const vids = new Set();
  (plan||[]).forEach(day=>(day.exercises||[]).forEach(ex=>{ if(ex.vid) vids.add(ex.vid); }));
  vids.forEach(v=>checkVideoAvailable(v));
}

function isHomeCompatible(name){
  const homeKeywords=['dumbbell','bodyweight','resistance','band','push-up','squat','lunge','bridge','plank','row','curl','nordic','sissy','pike'];
  return homeKeywords.some(k=>name.toLowerCase().includes(k));
}

const WARMUP={
  upper:[
    'Arm Circles — 30ث أمام وخلف',
    'Band Pull Aparts — 15×',
    'Shoulder Rolls — 20×',
    'Empty Bar Press — 2×15',
    'Face Pulls — خفيف 15×'
  ],
  lower:[
    'Incline Treadmill — 5 دقائق',
    'Leg Swings — أمامي وجانبي 10×/جانب',
    'Squat and Reach — 10×',
    'Hip Circles — 10×/جانب',
    'Walking Lunges — 10×'
  ],
  full:[
    'Stair Climber — 5 دقائق',
    'Arm Circles — 30ث',
    'Leg Swings — 10×/جانب',
    'Squat and Reach — 10×',
    'Pyramid Loading — ابدأ ب 50% وزن'
  ],
  push:[
    'Band Pull Aparts — 20×',
    'Empty Bar Press — 2×20',
    'Shoulder CARs — 10×/جانب',
    'Arm Circles — واسعة 30ث'
  ],
  pull:[
    'Dead Hangs — 20ث × 3',
    'Band Pull Aparts — 15×',
    'Cat-Cow — 10×',
    'Shoulder Blade Squeezes — 15×'
  ],
  legs_quad:[
    'Incline Treadmill — 5 دقائق',
    'Air Squats — 20×',
    'Hip 90/90 Stretch — 30ث/جانب',
    'Ankle CARs — 10×/جانب',
    'Walking Lunges — 10×'
  ],
  legs_ham:[
    'Leg Swings — 10×/جانب',
    'Good Morning — حركة بدون وزن 15×',
    'Hip Hinge Drill — 10×',
    'Glute Bridge Bodyweight — 15×'
  ]
};
const STRETCH={
  chest:[
    'Doorway Stretch — 30ث × 2',
    'High Wall Stretch — 30ث/جانب',
    'Cobra Pose — 30ث × 2'
  ],
  back:[
    'Lat Stretch — على بار 30ث × 2',
    'Supine Twist — 30ث/جانب',
    "Child's Pose — 45ث × 2",
    'Doorway Lat Stretch — 30ث/جانب'
  ],
  legs:[
    'Quad Stretch — واقف 30ث × 2/جانب',
    'Calf Stretch — على حائط 30ث × 2/جانب',
    'Pigeon Pose — 45ث/جانب',
    'Hamstring Stretch — جالس 30ث × 2',
    'Yoga Squat — 45ث',
    'Adductor Stretch — 30ث/جانب'
  ],
  shoulders:[
    'Cross Body Shoulder Stretch — 30ث/جانب',
    'Triceps Stretch — فوق الرأس 30ث/جانب',
    'Doorway Chest Stretch — 30ث',
    'Neck Side Tilt — 20ث/جانب'
  ],
  glutes:[
    'Pigeon Pose — 45ث/جانب',
    'Figure-4 Stretch — 30ث/جانب',
    'Hip Flexor Lunge Stretch — 30ث/جانب'
  ],
  arms:[
    'Biceps Wall Stretch — 30ث/جانب',
    'Triceps Overhead Stretch — 30ث/جانب',
    'Wrist Flexor/Extensor Stretch — 20ث/جانب',
    'Forward Bend — 30ث'
  ]
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOGGLE LOGIC
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
