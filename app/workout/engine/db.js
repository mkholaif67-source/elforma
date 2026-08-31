// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATABASE — engine/db.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const GYM_DB = {

  // ══════════════════════════════════════════════════════════
  // CHEST — صدر علوي | وسط | سفلي
  // ══════════════════════════════════════════════════════════
  chest:{
    upper:[
      // compound press — زاوية مائلة
      {n:'Incline Barbell Press',           alt:'Incline Dumbbell Press',       vid:'hA4Y5b7xEDM', mu:'صدر علوي',        tier:'S', safe_injuries:['knee','elbow_mild'],           goal_bonus:['muscle','strength']},
      {n:'Incline Dumbbell Press',          alt:'Incline Barbell Press',        vid:'Sj8t4vL-Ryw', mu:'صدر علوي',        tier:'S', safe_injuries:['wrist_mild','knee'],           goal_bonus:['muscle']},
      {n:'Incline Smith Machine Press',     alt:'Incline Barbell Press',        vid:'dTDhV_w1NoU', mu:'صدر علوي',        tier:'A', safe_injuries:['wrist','shoulder_mild'],       goal_bonus:['muscle']},
      {n:'Hammer Strength Incline Press',   alt:'Incline Barbell Press',        vid:'hkU6fSHcslw', mu:'صدر علوي',        tier:'A', safe_injuries:['wrist','shoulder_mild'],       goal_bonus:['muscle','strength']},
      // isolation fly — صدر علوي داخلي
      {n:'Low to High Cable Fly',           alt:'Cable Upper Chest Crossover',  vid:'BwqlWtr3v10', mu:'صدر علوي داخلي', tier:'A', safe_injuries:['shoulder','wrist','elbow'],    goal_bonus:['cut','fitness']},
      {n:'Cable Upper Chest Crossover',     alt:'Low to High Cable Fly',        vid:'X8X1ReVotR0', mu:'صدر علوي داخلي', tier:'A', safe_injuries:['shoulder','wrist','back'],     goal_bonus:['cut','fitness']},
    ],
    mid:[
      // compound press — زاوية مسطحة
      {n:'Barbell Bench Press',             alt:'Dumbbell Bench Press',         vid:'XjrsqShr-Ic', mu:'صدر وسط كامل',   tier:'S', safe_injuries:['knee','back_mild'],            goal_bonus:['strength','muscle']},
      {n:'Dumbbell Bench Press',            alt:'Barbell Bench Press',          vid:'Ne_9EKkUVXY', mu:'صدر وسط',        tier:'S', safe_injuries:['back_mild','knee'],            goal_bonus:['muscle']},
      {n:'Machine Chest Press',             alt:'Dumbbell Bench Press',         vid:'Qu7-ceCvq7w', mu:'صدر وسط',        tier:'S', safe_injuries:['shoulder','wrist','back'],     goal_bonus:['muscle','fitness']},
      {n:'Smith Machine Flat Press',        alt:'Barbell Bench Press',          vid:'5rbI0TYcgiA', mu:'صدر وسط',        tier:'A', safe_injuries:['wrist_mild','back_mild'],      goal_bonus:['muscle']},
      {n:'Cable Chest Press',               alt:'Machine Chest Press',          vid:'USAXajC6oUw', mu:'صدر وسط كامل',   tier:'A', safe_injuries:['wrist','shoulder_mild'],       goal_bonus:['muscle','fitness']},
      // isolation fly — صدر داخلي
      {n:'Pec Deck Machine',                alt:'Seated Cable Fly',             vid:'SE3FR_LqaW8', mu:'صدر داخلي',      tier:'A', safe_injuries:['shoulder','wrist','back','elbow'], goal_bonus:['cut','fitness']},
      {n:'Seated Cable Fly',                alt:'Pec Deck Machine',             vid:'SE3FR_LqaW8', mu:'صدر داخلي',      tier:'A', safe_injuries:['shoulder','wrist','back'],     goal_bonus:['cut','fitness']}
    ],
    lower:[
      // compound press — زاوية منخفضة / ديبس
      {n:'Dips (Chest Variation)',          alt:'Decline Dumbbell Press',       vid:'6ELKNQG-jRs', mu:'صدر سفلي',       tier:'S', safe_injuries:['knee','back'],                 goal_bonus:['muscle','strength']},
      {n:'Decline Barbell Press',           alt:'Decline Dumbbell Press',       vid:'nZGAtubdDrM', mu:'صدر سفلي',       tier:'S', safe_injuries:['knee'],                        goal_bonus:['muscle','strength']},
      {n:'Decline Dumbbell Press',          alt:'Dips (Chest Variation)',       vid:'m68nOljccd8', mu:'صدر سفلي',       tier:'A', safe_injuries:['knee','shoulder_mild'],        goal_bonus:['muscle']},
      // isolation fly — صدر سفلي داخلي
      {n:'High to Low Cable Fly',           alt:'Decline Cable Fly',            vid:'uu_Fcp-KN-0', mu:'صدر سفلي',       tier:'A', safe_injuries:['shoulder','wrist','back'],     goal_bonus:['cut','fitness']},
      {n:'Decline Cable Fly',               alt:'High to Low Cable Fly',        vid:'uu_Fcp-KN-0', mu:'صدر سفلي داخلي',tier:'A', safe_injuries:['shoulder','wrist','back'],     goal_bonus:['cut']}
    ]
  },

  // ══════════════════════════════════════════════════════════
  // BACK — لات (عرضي) | منتصف (أفقي) | سفلي (erector/RDL)
  // ملاحظة: دلتا خلفي - shoulders.rear (ليس هنا)
  // ══════════════════════════════════════════════════════════
  back:{
    lats:[
      // سحب رأسي — توسيع الظهر
      {n:'Wide Grip Lat Pulldown',          alt:'Neutral Grip Lat Pulldown',                     vid:'bNmvKpJSWKM', mu:'لاتيسيموس',       tier:'S', safe_injuries:['knee','back_mild','elbow_mild'],goal_bonus:['muscle','strength']},
      {n:'Neutral Grip Lat Pulldown',       alt:'Wide Grip Lat Pulldown',       vid:'jXRxMJhOCc0', mu:'لاتيسيموس',       tier:'S', safe_injuries:['shoulder','elbow_mild','knee'], goal_bonus:['muscle']},
      {n:'Close Grip Pulldown',             alt:'Neutral Grip Lat Pulldown',    vid:'VZ4R9_E5BBE', mu:'لاتيسيموس',       tier:'A', safe_injuries:['shoulder_mild','wrist'],       goal_bonus:['muscle']},
      {n:'Lat Pullover Machine',            alt:'Cable Pullover',               vid:'TCvTnibKiCs', mu:'لاتيسيموس',       tier:'A', safe_injuries:['shoulder','wrist','elbow'],    goal_bonus:['muscle']},
      {n:'Cable Pullover',                  alt:'Lat Pullover Machine',         vid:'yK6-CD9u2vQ', mu:'لاتيسيموس سفلي', tier:'A', safe_injuries:['shoulder','wrist','elbow'],    goal_bonus:['cut','muscle']}
    ],
    mid:[
      // سحب أفقي — سماكة الظهر (رومبويد + تراب وسط + ظهر علوي)
      {n:'Barbell Bent Over Row',           alt:'Chest Supported Row Machine',          vid:'phVtqawIgbk', mu:'ظهر كامل',        tier:'S', safe_injuries:['knee'],                        goal_bonus:['strength','muscle']},
      {n:'Chest Supported Row Machine',     alt:'Seated Cable Row',             vid:'BwOscEHiqKQ', mu:'ظهر وسط ورومبويد',tier:'S', safe_injuries:['back','shoulder_mild'],        goal_bonus:['muscle','fitness']},
      {n:'Seated Cable Row',                alt:'Chest Supported Row Machine',          vid:'hnNjcQI9ZMU', mu:'ظهر وسط كامل',   tier:'S', safe_injuries:['knee','back_mild'],            goal_bonus:['muscle','strength']},
      {n:'Meadows Row',                     alt:'One Arm Dumbbell Row',         vid:'eLrNUDTaMSk', mu:'ظهر وسط وعلوي',  tier:'S', safe_injuries:['back_mild','knee'],            goal_bonus:['muscle']},
      {n:'One Arm Dumbbell Row',            alt:'Chest Supported Row Machine',          vid:'RPDKC0M_P7Y', mu:'ظهر وسط',        tier:'A', safe_injuries:['back_mild','shoulder_mild'],   goal_bonus:['muscle']},
      {n:'Wide Grip Seated Row',            alt:'Seated Cable Row',             vid:'p48Cf7htySA', mu:'ظهر علوي ورومبويد',tier:'A',safe_injuries:['back_mild','knee'],           goal_bonus:['muscle']},
      {n:'Smith Machine Row',               alt:'Barbell Bent Over Row',        vid:'sTuwq4Vcvag', mu:'ظهر وسط',        tier:'A', safe_injuries:['back_mild','knee'],            goal_bonus:['muscle']},
      {n:'One Hand Cable Row',              alt:'One Arm Dumbbell Row',         vid:'0VDkEX5RBC8', mu:'ظهر وسط',        tier:'A', safe_injuries:['back_mild','shoulder_mild'],   goal_bonus:['muscle']},
      {n:'Single Arm Cable Row',            alt:'One Arm Dumbbell Row',         vid:'yIvvQc2Z6uM', mu:'ظهر وسط',        tier:'A', safe_injuries:['back_mild','shoulder_mild'],   goal_bonus:['muscle']}
    ],
    lower:[
      // ظهر سفلي + إركتور سبايني (hip hinge / hyperextension)
      {n:'Romanian Deadlift',               alt:'Stiff Leg Deadlift',           vid:'HHoaBq8zoSM', mu:'ظهر سفلي وهامستينج',tier:'S',safe_injuries:['shoulder_mild','knee_mild'],  goal_bonus:['muscle','strength']},
      {n:'Stiff Leg Deadlift',              alt:'Romanian Deadlift',            vid:'gplY6YfPhDY', mu:'ظهر سفلي وهامستينج',tier:'A',safe_injuries:['shoulder_mild','knee_mild'],  goal_bonus:['muscle']},
      {n:'Lower Back Extensions',           alt:'Romanian Deadlift',            vid:'uMr1txvrmgg', mu:'ظهر سفلي',       tier:'A', safe_injuries:['knee','shoulder'],             goal_bonus:['fitness','strength']}
    ]
  },

  // ══════════════════════════════════════════════════════════
  // SHOULDERS — ضغط (أمامي) | جانبي | خلفي
  // ══════════════════════════════════════════════════════════
  shoulders:{
    press:[
      // دلتا أمامي وجانبي — overhead press
      {n:'Machine Shoulder Press',          alt:'Seated DB Shoulder Press',     vid:'pFjJXU8S2gs', mu:'دلتا أمامي وجانبي',tier:'S',safe_injuries:['wrist','back'],               goal_bonus:['muscle','fitness']},
      {n:'Seated DB Shoulder Press',        alt:'Machine Shoulder Press',       vid:'k6tzKisR3NY', mu:'دلتا كامل',       tier:'S', safe_injuries:['back_mild','wrist_mild'],       goal_bonus:['muscle']},
      {n:'Overhead Barbell Press',          alt:'Machine Shoulder Press',       vid:'qybgyITCwcI', mu:'دلتا أمامي وجانبي',tier:'S',safe_injuries:['back_mild'],                  goal_bonus:['strength','muscle']},
      {n:'Smith Machine Shoulder Press',    alt:'Machine Shoulder Press',       vid:'E7ngsffMPR0', mu:'دلتا كامل',       tier:'A', safe_injuries:['back','wrist_mild'],           goal_bonus:['muscle']}
    ],
    lateral:[
      // دلتا جانبي — عزل
      {n:'Cable Lateral Raise',             alt:'Dumbbell Lateral Raise',       vid:'lMJUXEvcMkQ', mu:'دلتا جانبي',      tier:'S', safe_injuries:['back','wrist','elbow','shoulder_mild'], goal_bonus:['cut','fitness','muscle']},
      {n:'Dumbbell Lateral Raise',          alt:'Cable Lateral Raise',          vid:'C3sSWhFcEyY', mu:'دلتا جانبي',      tier:'S', safe_injuries:['back','wrist_mild'],           goal_bonus:['cut','muscle']},
      {n:'Machine Lateral Raise',           alt:'Cable Lateral Raise',          vid:'0o07iGKUarI', mu:'دلتا جانبي',      tier:'A', safe_injuries:['back','wrist','elbow'],        goal_bonus:['fitness','cut']},
      {n:'Leaning Cable Lateral Raise',     alt:'Cable Lateral Raise',          vid:'23VoAvqwSzo', mu:'دلتا جانبي',      tier:'A', safe_injuries:['back','elbow','shoulder_mild'], goal_bonus:['cut','muscle']},
    ],
    rear:[
      // دلتا خلفي — عزل خلفي (يستخدم في Pull days فقط)
      // CLASSIFICATION: دلتا خلفي = Pull day / Rear Delt day فقط — ممنوع في Push
      {n:'Rope Face Pull',                  alt:'Rear Delt Machine Fly',        vid:'zzTdj6pnkxI', mu:'دلتا خلفي',       tier:'S', safe_injuries:['back','shoulder','wrist','elbow'],goal_bonus:['fitness','cut'], push_banned:true},
      {n:'Reverse Cable Crossover',         alt:'Rope Face Pull',               vid:'cGXBVOc5xIk', mu:'دلتا خلفي',       tier:'S', safe_injuries:['back','shoulder','wrist'],     goal_bonus:['cut','fitness']},
      {n:'Rear Delt Machine Fly',           alt:'Rope Face Pull',               vid:'7tgx6QHB0-A', mu:'دلتا خلفي',       tier:'A', safe_injuries:['back','shoulder','wrist','elbow'],goal_bonus:['fitness']},
      {n:'Cable Rear Delt Fly',             alt:'Rope Face Pull',               vid:'FeERX9UwspY', mu:'دلتا خلفي',       tier:'A', safe_injuries:['back','shoulder','wrist'],     goal_bonus:['cut','fitness']},
      {n:'Bent Over Rear Delt Raise',       alt:'Rear Delt Machine Fly',        vid:'YjLf5zig7jg', mu:'دلتا خلفي',       tier:'A', safe_injuries:['shoulder_mild','wrist'],       goal_bonus:['cut','fitness']}
    ]
  },

  // ══════════════════════════════════════════════════════════
  // TRICEPS — رأس طويل (long) | جانبي ووتري (lateral)
  // ══════════════════════════════════════════════════════════
  triceps:{
    long:[
      // تمديد فوق الرأس — يستهدف الرأس الطويل بشكل حصري (overhead stretch)
      {n:'Overhead Cable Tricep Extension', alt:'Skull Crushers (EZ Bar)',      vid:'QYc9NDoUrPM', mu:'ترايسبس رأس طويل',tier:'S', safe_injuries:['back','wrist_mild','shoulder_mild'],goal_bonus:['muscle']},
      {n:'Skull Crushers (EZ Bar)',         alt:'Overhead Cable Tricep Extension',vid:'1cikFylNxqw',mu:'ترايسبس كامل',    tier:'S', safe_injuries:['back','shoulder_mild'],        goal_bonus:['muscle','strength']},
      {n:'Dumbbell Overhead Tricep Ext',    alt:'Overhead Cable Tricep Extension',vid:'UOiuG9kbTZU',mu:'ترايسبس رأس طويل',tier:'A',safe_injuries:['back_mild','wrist_mild'],       goal_bonus:['muscle']},
      {n:'Cable Overhead Curl',             alt:'Overhead Cable Tricep Extension',vid:'9Ark9S11uXw', mu:'ترايسبس رأس طويل',tier:'A', safe_injuries:['back','knee'],                 goal_bonus:['muscle']}
    ],
    lateral:[
      // ضغط للأسفل — يستهدف الرأس الجانبي والوتري (pushdown)
      {n:'Rope Tricep Pushdown',            alt:'Bar Tricep Pushdown',          vid:'u36jNfqh8_U', mu:'ترايسبس جانبي',   tier:'S', safe_injuries:['back','shoulder','wrist_mild'], goal_bonus:['cut','muscle']},
      {n:'Bar Tricep Pushdown',             alt:'Rope Tricep Pushdown',         vid:'1FjkhpZsaxc', mu:'ترايسبس جانبي',   tier:'A', safe_injuries:['back','shoulder'],             goal_bonus:['muscle']},
      {n:'Cable Tricep Kickback',           alt:'Bar Tricep Pushdown',          vid:'7_C9_SWHZbo', mu:'ترايسبس جانبي',   tier:'A', safe_injuries:['back','shoulder','wrist'],     goal_bonus:['cut','fitness']},
      {n:'Katana Extension',                alt:'Bar Tricep Pushdown',          vid:'WmWIR6pq9hw', mu:'ترايسبس',         tier:'A', safe_injuries:['back','shoulder'],             goal_bonus:['muscle']},
      {n:'Tricep Dips Machine',             alt:'Cable Tricep Kickback',        vid:'7_C9_SWHZbo', mu:'ترايسبس',         tier:'A', safe_injuries:['back','wrist','shoulder_mild'], goal_bonus:['muscle']}
    ]
  },

  // ══════════════════════════════════════════════════════════
  // BICEPS — رأس طويل (long) | رأس قصير / قمة (short)
  // ══════════════════════════════════════════════════════════
  biceps:{
    long:[
      // ذراع خلف الجسم أو مائلة — يمدد الرأس الطويل بالكامل
      {n:'Bayesian Cable Curl',             alt:'Incline Dumbbell Curl',        vid:'EhC6ejgDGF0', mu:'بايسبس رأس طويل', tier:'S', safe_injuries:['shoulder_mild','back'],        goal_bonus:['muscle']},
      {n:'Hammer Curl',                     alt:'Incline Dumbbell Curl',       vid:'jdYGDzCuGE4', mu:'براكياليس ورأس طويل',tier:'A', safe_injuries:['back','shoulder'],            goal_bonus:['muscle']},
      {n:'Incline Dumbbell Curl',           alt:'Bayesian Cable Curl',          vid:'EhC6ejgDGF0', mu:'بايسبس رأس طويل', tier:'S', safe_injuries:['back','shoulder_mild'],        goal_bonus:['muscle']},
    ],
    short:[
      // ذراع أمام الجسم أو على مسند — يضغط الرأس القصير ويبني القمة
      {n:'Machine Preacher Curl',           alt:'EZ Bar Preacher Curl',         vid:'S4dDLfp3e8w', mu:'بايسبس قمة',      tier:'S', safe_injuries:['back','shoulder','wrist_mild'], goal_bonus:['muscle']},
      {n:'EZ Bar Preacher Curl',            alt:'Machine Preacher Curl',        vid:'S4dDLfp3e8w', mu:'بايسبس قمة',      tier:'S', safe_injuries:['back','shoulder'],             goal_bonus:['muscle']},
      {n:'EZ Bar Curl',                     alt:'Standing Dumbbell Curl',       vid:'zta8JuQZC_A', mu:'بايسبس',          tier:'A', safe_injuries:['back','shoulder'],             goal_bonus:['muscle']},
      {n:'Standing Dumbbell Curl',          alt:'EZ Bar Curl',                  vid:'MKWBV29S6c0', mu:'بايسبس',          tier:'A', safe_injuries:['back','shoulder','wrist_mild'], goal_bonus:['muscle','cut']},
    ]
  },

  // ══════════════════════════════════════════════════════════
  // QUADS — compound dominant | isolation
  // ══════════════════════════════════════════════════════════
  quads:{
    dominant:[
      {n:'Barbell Back Squat',              alt:'Hack Squat Machine',           vid:'i5tL8KwlkWE', mu:'كوادز وجلوتس',   tier:'S', safe_injuries:['shoulder_mild','back_mild'],   goal_bonus:['strength','muscle']},
      {n:'Hack Squat Machine',              alt:'Smith Machine Squat',          vid:'rYgNArpwE7E', mu:'كوادز كامل',     tier:'S', safe_injuries:['back','shoulder'],             goal_bonus:['muscle','strength']},
      {n:'Smith Machine Squat',             alt:'Hack Squat Machine',           vid:'ue249CNAigc', mu:'كوادز وجلوتس',   tier:'S', safe_injuries:['back','shoulder'],             goal_bonus:['muscle']},
      {n:'Pendulum Squat',                  alt:'Hack Squat Machine',           vid:'1vdoqE--qTA', mu:'كوادز',          tier:'S', safe_injuries:['back','shoulder'],             goal_bonus:['muscle']},
      {n:'Leg Press (45°)',                 alt:'Hack Squat Machine',           vid:'oFsPXMIbNR4', mu:'كوادز وجلوتس',   tier:'S', safe_injuries:['back','shoulder'],             goal_bonus:['muscle','fitness']},
      {n:'Front Barbell Squat',             alt:'Barbell Back Squat',           vid:'rKjh8K-ZxLc', mu:'كوادز علوي',     tier:'A', safe_injuries:['back_mild','shoulder_mild'],   goal_bonus:['strength']},
      {n:'Bulgarian Split Squat',           alt:'Leg Press (45°)',              vid:'or1frhkjBDc', mu:'كوادز وجلوتس أحادي',tier:'S',safe_injuries:['back','shoulder'],           goal_bonus:['fitness','muscle']}
    ],
    isolation:[
      {n:'Leg Extension Machine',           alt:'Bulgarian Split Squat',        vid:'SQcjwqjOwb4', mu:'كوادز عزل',      tier:'S', safe_injuries:['back','shoulder','wrist','elbow'],goal_bonus:['cut','fitness','muscle']},
      {n:'Walking Lunges (Barbell)',         alt:'Bulgarian Split Squat',        vid:'EWBiNhxDnmQ', mu:'كوادز وجلوتس',  tier:'A', safe_injuries:['back_mild','shoulder_mild'],   goal_bonus:['fitness','cut']},
      {n:'Step-Up with Barbell',            alt:'Bulgarian Split Squat',        vid:'Ls73TInTRe4', mu:'كوادز وجلوتس أحادي',tier:'A',safe_injuries:['back_mild','shoulder_mild'], goal_bonus:['fitness']},
      {n:'Sissy Squat',                      alt:'Leg Extension Machine',        vid:'Cu2THH1IQDA', mu:'كوادز علوي (Rectus Femoris)',tier:'A',safe_injuries:['back','shoulder','wrist','elbow'],goal_bonus:['muscle','cut']},
      {n:'Leg Press Narrow Stance',          alt:'Leg Extension Machine',        vid:'eDgxpUNdbD8', mu:'كوادز خارجي (Vastus Lateralis)',tier:'A',safe_injuries:['back','shoulder'],goal_bonus:['muscle']}
    ]
  },

  // ══════════════════════════════════════════════════════════
  // HAMSTRINGS — dominant (leg curl) | isolation | glutes (hip thrust)
  // ملاحظة: RDL + Stiff Leg - back.lower (hip hinge مع تركيز ظهر سفلي)
  //         leg curl machines - hamstrings.dominant/isolation (تقلص خالص)
  // ══════════════════════════════════════════════════════════
  // HAMSTRINGS — hip_hinge | knee_flexion | glutes
  // dominant = hip hinge (RDL) — يستهدف الهامستينج في وضع الامتداد (proximal)
  // isolation = knee flexion (curls) — يستهدف الهامستينج في وضع التقلص (distal)
  // glutes = hip thrust — جلوتس + هامستينج
  // ══════════════════════════════════════════════════════════
  hamstrings:{
    dominant:[
      // ── Hip Hinge — proximal hamstring (semimembranosus, long head) ──
      {n:'Romanian Deadlift (RDL)',          alt:'Stiff-Leg Deadlift',           vid:'xAL7lHwj30E', mu:'هامستينج وجلوتس',  tier:'S', safe_injuries:['shoulder','wrist','elbow'],    goal_bonus:['muscle','strength']},
      {n:'Stiff-Leg Deadlift',              alt:'Romanian Deadlift (RDL)',      vid:'CN_7cz3P-1U', mu:'هامستينج',          tier:'S', safe_injuries:['shoulder','wrist','elbow'],    goal_bonus:['muscle','strength']},
      {n:'Single Leg RDL (Dumbbell)',        alt:'Romanian Deadlift (RDL)',      vid:'FV1xu0LySiQ', mu:'هامستينج أحادي',   tier:'A', safe_injuries:['back_mild','shoulder','wrist'], goal_bonus:['fitness','muscle']},
    ],
    isolation:[
      // عزل الهامستينج — ثني الركبة (Knee Flexion) — يستهدف الرأس القصير بشكل أكبر
      {n:'Lying Leg Curl Machine',          alt:'Seated Leg Curl Machine',     vid:'EfeVvA1vdd4', mu:'هامستينج عزل',      tier:'S', safe_injuries:['back','shoulder','wrist','elbow'],goal_bonus:['cut','muscle']},
      {n:'Single Leg Curl Machine',         alt:'Lying Leg Curl Machine',      vid:'bZuv_z8z8go', mu:'هامستينج أحادي عزل',tier:'A', safe_injuries:['back','shoulder','wrist','elbow'],goal_bonus:['cut','muscle']},
      {n:'Standing Leg Curl Machine',       alt:'Lying Leg Curl Machine',      vid:'eFs1d8c5vRI', mu:'هامستينج عزل',      tier:'A', safe_injuries:['back','shoulder','wrist','elbow'],goal_bonus:['cut','muscle']}
    ],
    glutes:[
      // ── Hip Thrust — جلوتس + هامستينج ──
      {n:'Barbell Hip Thrust',              alt:'Barbell Hip Thrust',           vid:'ZSPmIyX9RZs', mu:'جلوتس وهامستينج',  tier:'S', safe_injuries:['shoulder_mild','back_mild'],   goal_bonus:['muscle','fitness']},
      {n:'Cable Pull Through',              alt:'Barbell Hip Thrust',           vid:'SbquVKT_2jg', mu:'جلوتس وهامستينج',  tier:'A', safe_injuries:['back','shoulder','elbow'],     goal_bonus:['cut','fitness']},
      {n:'Smith Machine Hip Thrust',        alt:'Barbell Hip Thrust',           vid:'i5Vpsf-c6r0', mu:'جلوتس',            tier:'S', safe_injuries:['back','shoulder_mild'],        goal_bonus:['muscle']}
    ]
  },

  // ══════════════════════════════════════════════════════════
  // CALVES — سمانة كاملة
  // gastrocnemius = knee extended (الساق ممدودة) — الرأس الخارجي والداخلي
  // soleus        = knee flexed  (الركبة مثنية) — الطبقة الداخلية الأعمق
  // الفصل ده علمي: ال gastrocnemius biceps يعطل لما الركبة تنثني
  //   ف Seated Calf Raise = soleus isolation حقيقي (Donkey ركبة ممدودة - gastrocnemius)
  // ══════════════════════════════════════════════════════════
  calves:{
    gastrocnemius:[
      // ── Knee Extended — ركبة ممدودة ——  gastrocnemius dominant ──
      {n:'Standing Calf Raise (Machine)',   alt:'Smith Machine Calf Raise',     vid:'baEXLy09Ncc', mu:'جاستروكنيميوس',   tier:'S', safe_injuries:['back','shoulder','wrist','elbow'],goal_bonus:['muscle']},
      {n:'Smith Machine Calf Raise',        alt:'Standing Calf Raise (Machine)',vid:'wlqTemUXPXY', mu:'جاستروكنيميوس',   tier:'A', safe_injuries:['wrist','elbow'],               goal_bonus:['muscle']},
      {n:'Leg Press Calf Raise',            alt:'Standing Calf Raise (Machine)',vid:'DvEnixpoSg0', mu:'سمانة كاملة',     tier:'A', safe_injuries:['back','shoulder','wrist','elbow'],goal_bonus:['muscle','fitness']},
      {n:'Donkey Calf Raise',               alt:'Standing Calf Raise (Machine)',vid:'watMaxAQBCU', mu:'جاستروكنيميوس',   tier:'A', safe_injuries:['back_mild','shoulder','wrist','elbow'],goal_bonus:['muscle','fitness']},
    ],
    soleus:[
      // ── Knee Flexed — ركبة مثنية — soleus isolation ──
      {n:'Seated Calf Raise Machine',       alt:'Leg Press Calf Raise',         vid:'OZlYFWLZ3cw', mu:'سولياس',          tier:'S', safe_injuries:['back','shoulder','wrist','elbow'],goal_bonus:['muscle']}
    ]
  },


  // ══════════════════════════════════════════════════════════
  // TRAPS — شراغيل فقط (دلتا خلفي - shoulders.rear)
  // ══════════════════════════════════════════════════════════
  traps:{
    all:[
      {n:'Barbell Shrugs',                  alt:'Smith Machine Shrugs',         vid:'IJSDHkN7qPc', mu:'ترابيس علوي',     tier:'S', safe_injuries:['knee','back_mild'],            goal_bonus:['muscle','strength']},
      {n:'Smith Machine Shrugs',            alt:'Barbell Shrugs',               vid:'nd8eNnkFOKU', mu:'ترابيس علوي',     tier:'S', safe_injuries:['knee','wrist_mild'],           goal_bonus:['muscle']},
      {n:'Dumbbell Shrugs',                 alt:'Barbell Shrugs',               vid:'rFsSeClGnNA', mu:'ترابيس علوي',     tier:'A', safe_injuries:['knee','back_mild'],            goal_bonus:['muscle']}
    ]
  },

  // ══════════════════════════════════════════════════════════
  // FOREARMS — ساعد
  // ══════════════════════════════════════════════════════════
  forearms:{
    all:[
      {n:'Barbell Wrist Curl',              alt:'Dumbbell Wrist Curl',          vid:'d5YiFNoiCa0', mu:'ساعد أمامي',      tier:'S', safe_injuries:['back','shoulder','knee'],      goal_bonus:['strength','muscle']},
      {n:'Reverse Barbell Wrist Curl',      alt:'Barbell Wrist Curl',           vid:'yz2eCSWoY4E', mu:'ساعد خلفي',       tier:'S', safe_injuries:['back','shoulder','knee'],      goal_bonus:['strength']},
      {n:'Dumbbell Wrist Curl',             alt:'Barbell Wrist Curl',           vid:'M8TpHw5aYgA', mu:'ساعد أمامي',      tier:'A', safe_injuries:['back','shoulder','knee'],      goal_bonus:['muscle']},
      {n:'Farmer Walk (Plates)',            alt:'Dead Hangs',                   vid:'5LKllcK6PfQ', mu:'ساعد وترابيس',    tier:'A', safe_injuries:['shoulder_mild','back_mild'],   goal_bonus:['strength','fitness']},
      {n:'Dead Hangs',                      alt:'Farmer Walk (Plates)',         vid:'XPcT3capkyk', mu:'قبضة + تحرير لاتس',  tier:'A', safe_injuries:['shoulder','knee','back'],      goal_bonus:['strength','fitness']}
    ]
  },
  // FIX-A: GYM_DB.core — تمارين الكور للجيم (كابل + آلات + معدات ثقيلة)
  // المشكلة: غياب هذا القسم جعل GYM_DB?.core?.all = undefined - لا يحقن كور لمستخدمي الجيم أبدا
  core:{
    all:[
      {n:'Cable Crunch',                    alt:'Ab Wheel Rollout',             vid:'mKp3sLESlhU', mu:'بطن علوي وكور',    tier:'S', safe_injuries:['knee','shoulder','wrist'], goal_bonus:['cut','muscle']},
      {n:'Ab Wheel Rollout',                alt:'Cable Crunch',                 vid:'tmy1wmws9z4', mu:'كور كامل',         tier:'S', safe_injuries:['knee','elbow_mild'],       goal_bonus:['strength','fitness']},
      {n:'Hanging Leg Raise',               alt:'Cable Crunch',                 vid:'2HgbXXA-uqE', mu:'بطن سفلي',         tier:'S', safe_injuries:['back_mild','knee','shoulder_mild'], goal_bonus:['fitness','cut']},
      {n:'Cable Woodchop',                  alt:'Russian Twist',                vid:'yy3TRnJYE08', mu:'بطن جانبي وكور',   tier:'A', safe_injuries:['knee','shoulder_mild','back_mild'], goal_bonus:['fitness','cut']},
      {n:'Plank on Cable',                  alt:'Ab Wheel Rollout',             vid:'k3Y2HGFRl6A', mu:'كور كامل',         tier:'A', safe_injuries:['back','knee','shoulder','wrist','elbow'], goal_bonus:['fitness']},
      {n:'Decline Sit-Up',                  alt:'Cable Crunch',                 vid:'G2vYhVJq_Nk', mu:'بطن علوي',         tier:'A', safe_injuries:['knee','shoulder','wrist','elbow'], goal_bonus:['fitness','cut']},
      {n:'Plank',                           alt:'Ab Wheel Rollout',             vid:'k3Y2HGFRl6A', mu:'كور كامل',         tier:'A', safe_injuries:['back','knee','shoulder','wrist','elbow'], goal_bonus:['fitness']}
    ]
  },
  // V3-07: Adductors — مقربات الفخذ (20-25% من كتلة عضلات الساق)
  // optional: تضاف لأيام الأرجل فقط عند 4+ أيام تدريب
  adductors:{
    all:[
      {n:'Cable Hip Adduction',             alt:'Dumbbell Side Lunge',          vid:'Q08rMkanmtc', mu:'مقرب داخلي فخذ', tier:'S', safe_injuries:['back','shoulder','wrist','elbow'], goal_bonus:['fitness','muscle']},
      {n:'Seated Hip Adduction Machine',    alt:'Cable Hip Adduction',          vid:'BmMmt-c9aNM', mu:'مقرب داخلي فخذ', tier:'S', safe_injuries:['back','shoulder','wrist','elbow'], goal_bonus:['muscle','fitness']},
      {n:'Dumbbell Side Lunge',             alt:'Cable Hip Adduction',          vid:'EwdQSgvBeZ4', mu:'مقرب ومبعد فخذ وجلوتس', tier:'A', safe_injuries:['back','shoulder'],     goal_bonus:['fitness','cut']}
    ]
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOME EXERCISE DATABASE — BODYWEIGHT + DUMBBELLS + BANDS ONLY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const HOME_DB = {
  chest:{
    upper:[
      {n:'Incline Push-Up (Elevated Surface)',alt:'Pike Push-Up',              vid:'B2ey8AegfOI', mu:'صدر علوي',        tier:'A', safe_injuries:['knee','back','elbow_mild'], goal_bonus:['fitness','cut']}
    ],
    mid:[
      {n:'Wide Push-Up',                     alt:'Resistance Band Chest Fly',  vid:'UPqqRK-0Cyg', mu:'صدر وسط',         tier:'A', safe_injuries:['back_mild','wrist_mild'],   goal_bonus:['fitness','cut']},
      {n:'Resistance Band Chest Fly',        alt:'Wide Push-Up',               vid:'kCqkeb1Hjdo', mu:'صدر داخلي',       tier:'A', safe_injuries:['shoulder','back','wrist'],  goal_bonus:['fitness']}
    ],
    lower:[
      {n:'Decline Push-Up (Feet Elevated)',  alt:'Wide Push-Up',               vid:'mPklne1U9aI', mu:'صدر سفلي',        tier:'A', safe_injuries:['back_mild','knee','wrist_mild'],goal_bonus:['fitness']}
    ]
  },
  back:{
    lats:[
      {n:'Resistance Band Pulldown',         alt:'Single Arm DB Row (Chair)',   vid:'PwXRg-BwYgc', mu:'لاتيسيموس',       tier:'A', safe_injuries:['shoulder','back','wrist'],  goal_bonus:['fitness']},
      {n:'Single Arm DB Row (Chair)',         alt:'Resistance Band Pulldown',    vid:'uVT8qEn-5eo', mu:'ظهر وسط',         tier:'S', safe_injuries:['back_mild','shoulder_mild'],goal_bonus:['muscle']}
    ],
    mid:[
      {n:'Resistance Band Seated Row',       alt:'Resistance Band Face Pull',   vid:'bBpK36TAQww', mu:'ظهر وسط',         tier:'A', safe_injuries:['back','shoulder','wrist'],  goal_bonus:['fitness']},
    ],
    rear:[
      {n:'Resistance Band Face Pull',        alt:'Prone Dumbbell Y-Raise',      vid:'Qij3pSB-gNk', mu:'دلتا خلفي',       tier:'A', safe_injuries:['back','shoulder','wrist'],  goal_bonus:['fitness']},
      {n:'Prone Dumbbell Y-Raise',           alt:'Resistance Band Face Pull',   vid:'cYLucJwoiFI', mu:'دلتا خلفي وترابيس',tier:'A', safe_injuries:['back','shoulder','wrist','elbow'],goal_bonus:['fitness']}
    ]
  },
  quads:{
    dominant:[
      {n:'Goblet Squat (Dumbbell)',          alt:'Resistance Band Squat',       vid:'29bKY-pAsdc', mu:'كوادز وجلوتس',    tier:'A', safe_injuries:['back','shoulder'],         goal_bonus:['fitness','cut']},
      {n:'Bulgarian Split Squat (Chair)',    alt:'Goblet Squat (Dumbbell)',      vid:'1M-V_qlyowo', mu:'كوادز وجلوتس',    tier:'S', safe_injuries:['back','shoulder'],         goal_bonus:['muscle','fitness']},
      {n:'Resistance Band Squat',            alt:'Goblet Squat (Dumbbell)',      vid:'S5cTdwO1Trk', mu:'كوادز',           tier:'A', safe_injuries:['back','shoulder','wrist','elbow'],goal_bonus:['fitness']}
    ],
    isolation:[
      {n:'Sissy Squat',                      alt:'Step-Up (Chair/Box)',          vid:'pU7XbxvViIY', mu:'كوادز عزل',        tier:'A', safe_injuries:['back','shoulder','wrist','elbow'],goal_bonus:['fitness','cut']},
      {n:'Step-Up (Chair/Box)',               alt:'Sissy Squat',                 vid:'3LrzsE3clIs', mu:'كوادز وجلوتس',    tier:'A', safe_injuries:['back','shoulder','wrist'],  goal_bonus:['fitness']}
    ]
  },
  hamstrings:{
    dominant:[
      {n:'Dumbbell Romanian Deadlift',       alt:'Single Leg RDL (Dumbbell)',   vid:'HHoaBq8zoSM', mu:'هامستينج وجلوتس',  tier:'S', safe_injuries:['shoulder_mild','knee_mild'],goal_bonus:['muscle','fitness']},
      {n:'Single Leg RDL (Dumbbell)',        alt:'Dumbbell Romanian Deadlift',  vid:'kNZlId2h7i8', mu:'هامستينج أحادي',   tier:'A', safe_injuries:['back_mild','shoulder_mild'],goal_bonus:['fitness']}
    ],
    glutes:[
      {n:'Glute Bridge Weighted',            alt:'Resistance Band Pull Through',vid:'LORVjN2bg5o', mu:'جلوتس',            tier:'A', safe_injuries:['back_mild','shoulder'],      goal_bonus:['fitness']},
      {n:'Resistance Band Pull Through',     alt:'Glute Bridge Weighted',       vid:'ZTANv8Fjpj8', mu:'جلوتس وهامستينج',  tier:'A', safe_injuries:['back','shoulder','elbow'],   goal_bonus:['fitness']}
    ]
  },
  calves:{
    all:[
      {n:'Standing Calf Raise (BW)',         alt:'Single Leg Calf Raise',       vid:'27Vu1-5mv-4', mu:'سمانة',            tier:'A', safe_injuries:['back','shoulder','wrist','elbow'],goal_bonus:['fitness']},
      {n:'Single Leg Calf Raise',            alt:'Standing Calf Raise (BW)',    vid:'4N9Flc-4JzU', mu:'سمانة أحادية',    tier:'S', safe_injuries:['back','shoulder','wrist','elbow'],goal_bonus:['fitness']}
    ]
  },
  shoulders:{
    press:[
      {n:'Dumbbell Shoulder Press (Seated)', alt:'Pike Push-Up',                vid:'KybK2zbg0n4', mu:'دلتا كامل',        tier:'S', safe_injuries:['back_mild','knee','wrist_mild'],goal_bonus:['muscle']},
      {n:'Pike Push-Up',                     alt:'Dumbbell Shoulder Press',     vid:'FlvG95fGrCM', mu:'دلتا أمامي وجانبي',tier:'A', safe_injuries:['back_mild','knee','wrist_mild'],goal_bonus:['fitness']}
    ],
    lateral:[
      {n:'Resistance Band Lateral Raise',    alt:'Side Lying DB Raise',         vid:'YuOhl4-Ppq4', mu:'دلتا جانبي',       tier:'A', safe_injuries:['back','wrist','elbow'],      goal_bonus:['fitness']},
      {n:'Side Lying DB Raise',              alt:'Resistance Band Lateral Raise',vid:'erhCK5sEhfY', mu:'دلتا جانبي',       tier:'S', safe_injuries:['back','elbow','wrist_mild'],  goal_bonus:['cut','muscle']}
    ],
    rear:[
      {n:'Dumbbell Rear Delt Fly',           alt:'Resistance Band Face Pull',   vid:'Xq2aSZvNk2E', mu:'دلتا خلفي',        tier:'A', safe_injuries:['back','shoulder','wrist'],   goal_bonus:['fitness']}
    ]
  },
  biceps:{
    long:[
      {n:'Incline Dumbbell Curl',            alt:'Hammer Curl (Dumbbell)',       vid:'K2C4Nf3zQyc', mu:'بايسبس رأس طويل',  tier:'S', safe_injuries:['back','shoulder_mild'],      goal_bonus:['muscle']}
    ],
    short:[
      {n:'Dumbbell Preacher Curl (Chair)',   alt:'Hammer Curl (Dumbbell)',       vid:'ZYtpAy4rg74', mu:'بايسبس قمة',       tier:'S', safe_injuries:['back','shoulder'],           goal_bonus:['muscle']},
      {n:'Hammer Curl (Dumbbell)',           alt:'Dumbbell Preacher Curl',       vid:'ktG4qWYIzUQ', mu:'براكياليس وساعد',  tier:'A', safe_injuries:['back','shoulder'],           goal_bonus:['muscle']}
    ]
  },
  triceps:{
    long:[
      {n:'DB Overhead Tricep Extension',    alt:'Close Grip Push-Up',           vid:'xPgtezPGbOk', mu:'ترايسبس رأس طويل', tier:'S', safe_injuries:['back_mild','wrist_mild'],    goal_bonus:['muscle']}
    ],
    lateral:[
      {n:'Resistance Band Pushdown',        alt:'Close Grip Push-Up',           vid:'PkGesjlH7RQ', mu:'ترايسبس جانبي',    tier:'A', safe_injuries:['back','shoulder','wrist'],    goal_bonus:['fitness']},
      {n:'Close Grip Push-Up',              alt:'Resistance Band Pushdown',     vid:'CZT3gEobyOo', mu:'ترايسبس وصدر',     tier:'A', safe_injuries:['back_mild','wrist_mild'],    goal_bonus:['fitness']}
    ]
  },
  forearms:{
    all:[
      {n:'Dumbbell Wrist Curl',             alt:'Reverse Dumbbell Wrist Curl',  vid:'3PJSBYpWfWI', mu:'ساعد أمامي',       tier:'S', safe_injuries:['back','shoulder','knee'],    goal_bonus:['strength']},
      {n:'Reverse Dumbbell Wrist Curl',     alt:'Dumbbell Wrist Curl',          vid:'Sj4nSnbKZMc', mu:'ساعد خلفي',        tier:'S', safe_injuries:['back','shoulder','knee'],    goal_bonus:['strength']}
    ]
  },
  traps:{
    all:[
      {n:'Dumbbell Shrugs',                 alt:'Resistance Band Face Pull',    vid:'gvC0ubD0hdQ', mu:'ترابيس علوي',      tier:'S', safe_injuries:['back_mild','knee'],          goal_bonus:['muscle']}
    ]
  },
  core:{
    all:[
      {n:'Hanging Leg Raise (Pull-Up Bar)', alt:'Plank',                        vid:'2HgbXXA-uqE', mu:'بطن سفلي',         tier:'S', safe_injuries:['back_mild','knee'],          goal_bonus:['fitness']},
      {n:'Plank',                           alt:'Dead Bug',                     vid:'k3Y2HGFRl6A', mu:'كور كامل',         tier:'A', safe_injuries:['back','knee','shoulder','wrist','elbow'],goal_bonus:['fitness']},
      {n:'Bicycle Crunch',                  alt:'Plank',                        vid:'EFqM4Gg8LJc', mu:'بطن كامل',         tier:'A', safe_injuries:['shoulder','wrist','elbow'],  goal_bonus:['cut','fitness']},
      {n:'Mountain Climbers',               alt:'Plank',                        vid:'1wDQznFSh3E', mu:'كور وكارديو',       tier:'A', safe_injuries:['shoulder_mild','wrist_mild'],goal_bonus:['cut','fitness']},
      {n:'Dead Bug',                        alt:'Plank',                        vid:'DqLL45uk2Tk', mu:'كور عميق',         tier:'A', safe_injuries:['back','shoulder','wrist','elbow','knee'],goal_bonus:['fitness']}
    ]
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ███╗   ███╗ ██████╗ ██████╗ ██╗   ██╗██╗     ███████╗    ██████╗ ██████╗
// MODULE EXERCISE DATABASE — KEGEL · CARDIO · CORE · MOBILITY · STRETCH
//                            YOGA · BREATHING · RECOVERY · WEAK POINT
// Every module has its own internal database — verified, structured, tiered
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const MODULE_DB = {

  // ─── KEGEL TRAINING ────────────────────────────────────────────────────
  kegel:[
    {n:'Quick Kegel Pulses',          tier:'S', duration:'20 نبضة سريعة × 3 sets',   desc:'تقلصات سريعة متتالية — تنشط الألياف السريعة لقاع الحوض', vid:'Rq3EXYus03E', equipment:'none', fatigue:'low', category:'pelvic_floor'},
    {n:'Long Hold Kegels',            tier:'A', duration:'10ث hold × 8 rep × 3 sets', desc:'مسك طويل يبني التحمل العضلي لقاع الحوض', vid:'GZBNdOOkPNs', equipment:'none', fatigue:'low', category:'pelvic_floor'},
    {n:'Seated Kegel',                tier:'B', duration:'5ث × 12 rep × 2 sets',      desc:'نفذ وأنت جالس — أسهل للمبتدئين وقابل للتطبيق في أي مكان', vid:'I4kdOS4zrXE', equipment:'none', fatigue:'low', category:'pelvic_floor'},
    {n:'Kegel exercise',              tier:'B', duration:'5ث × 10 rep × 2 sets',      desc:'نفذ واقفا — يزيد صعوبة التحكم ويحسن التثبيت الوظيفي', vid:'nOgifRznpzk', equipment:'none', fatigue:'low', category:'pelvic_floor'}
  ],

  // ─── CARDIO DATABASE ───────────────────────────────────────────────────
  cardio:{
    s:[
      {n:'Battle Ropes',              tier:'S', protocol:'30ث عمل / 30ث راحة × 8',               desc:'HIIT بكثافة عالية — يتعب بسرعة لكن فعال لحرق الدهون', vid:'k3d8XozZyQQ', equipment:'gym', fatigue:'high', category:'cardio_hiit'},
      {n:'Burpees',                   tier:'S', protocol:'10 rep × 5 sets · راحة 60ث',            desc:'Full Body HIIT بلا معدات — مكثف جدا', vid:'VTsD3quZ5HE', equipment:'both', fatigue:'high', category:'cardio_hiit'},
      {n:'Mountain Climbers (Cardio)',tier:'S', protocol:'40ث عمل / 20ث راحة × 8',               desc:'Core + Cardio معا — لياقة وحرق مشترك', vid:'UDPHAuf9I2k', equipment:'none', fatigue:'medium', category:'cardio_hiit'}
    ],
    a:[
      {n:'Outdoor Jogging',           tier:'A', protocol:'نبضات 130-150 · 25-35 دقيقة',          desc:'كارديو متعدد الاتجاهات — يبني القلب والأوعية الدموية', vid:'uOY1rxnFY9w', equipment:'none', fatigue:'medium', category:'cardio_liss'}
    ],
    b:[
      {n:'Incline Treadmill Walk',    tier:'B', protocol:'5° incline · 5-6 km/h · 30-40 دقيقة', desc:'الأفضل لحرق الدهون بدون هدم عضلي — Low Intensity Steady State LISS', vid:'HwXYMPGjlUg', equipment:'gym', fatigue:'low', category:'cardio_liss'},
      {n:'Stationary Cycling (LISS)', tier:'B', protocol:'مقاومة متوسطة · 30-45 دقيقة',         desc:'أداء منخفض الإجهاد على الركبة — ممتاز لأيام التعافي', vid:'NY4_GJnrfKQ', equipment:'gym', fatigue:'low', category:'cardio_liss'},
      {n:'Jump Rope (HIIT)',          tier:'B', protocol:'30ث عمل / 30ث راحة × 10-15 جولة',     desc:'HIIT فعال بحرق عالي — يحتاج ركبة ومفصل صحي', vid:'WtZxqC9ZKzI', equipment:'both', fatigue:'medium', category:'cardio_hiit'},
      {n:'Stair Climber',             tier:'B', protocol:'مستوى 8-12 · 20-30 دقيقة',             desc:'كارديو + تقوية الجلوتس والكوادز في وقت واحد', vid:'Zz_9Hx82RLo', equipment:'gym', fatigue:'medium', category:'cardio_liss'}
    ]
  },

  // ─── CORE PROTOCOL DATABASE ────────────────────────────────────────────
  core:[
    // S Tier
    {n:'Cable Crunch',                tier:'S', sets:'3×12-15', desc:'أفضل تمرين للبطن العلوي بحمل خارجي — Progressive Overload ممكن', vid:'iRYIqSFN21w', equipment:'gym', fatigue:'low', mu:'بطن علوي', category:'core_weighted'},
    {n:'Hanging Leg Raise',           tier:'S', sets:'3×10-12', desc:'أفضل تمرين للبطن السفلي — يشغل Hip Flexors وال Core بالكامل', vid:'2HgbXXA-uqE', equipment:'gym_home', fatigue:'low', mu:'بطن سفلي', category:'core_bodyweight'},
    {n:'Ab Wheel Rollout',            tier:'S', sets:'3×8-10',  desc:'تمرين كور ضغط ضخم — يشغل العضلة المستقيمة بالكامل في مدى كامل', vid:'tmy1wmws9z4', equipment:'both', fatigue:'medium', mu:'كور كامل', category:'core_bodyweight'},
    {n:'Plank',                       tier:'S', sets:'3×45-60ث',desc:'ثبات Core بالكامل — يحمي الظهر السفلي ويبني ال Anti-Extension', vid:'k3Y2HGFRl6A', equipment:'none', fatigue:'low', mu:'كور كامل', category:'core_isometric'},
    // A Tier
    {n:'Pallof Press (Cable)',        tier:'A', sets:'3×12/side',desc:'أفضل Anti-Rotation تمرين — يستهدف ال Obliques بذكاء', vid:'GXbdhyKckCA', equipment:'gym', fatigue:'low', mu:'جانب البطن', category:'core_anti_rotation'},
    {n:'Dead Bug',                    tier:'A', sets:'3×10/side',desc:'تنشيط Core عميق بأمان مطلق — مثالي لحماية الظهر السفلي', vid:'DqLL45uk2Tk', equipment:'none', fatigue:'low', mu:'كور عميق', category:'core_stability'},
    {n:'Russian Twist',               tier:'A', sets:'3×15/side',desc:'تمرين ال Obliques المباشر — أضف وزنا للتقدم', vid:'9luUFuwS3LY', equipment:'both', fatigue:'low', mu:'جانب البطن', category:'core_rotation'},
    {n:'carve your core',             tier:'A', sets:'3×30-45ث/side',desc:'Anti-Lateral Flexion — يبني ثبات الجذع الجانبي', vid:'Shdpeii5WF4', equipment:'none', fatigue:'low', mu:'جانب الكور', category:'core_isometric'},
    // B Tier
    {n:'Decline Crunch',              tier:'B', sets:'3×15-20', desc:'بطن علوي على منحدر — يزيد مدى الحركة مقارنة بالكرانش العادي', vid:'bN6e7i-VyYs', equipment:'gym', fatigue:'low', mu:'بطن علوي', category:'core_bodyweight'},
    {n:'Cable Woodchop',              tier:'A', sets:'3×12/side',desc:'تمرين تدوير مقاوم للكابل — يطور القوة الدورانية وال Obliques', vid:'8OZImYISmSg', equipment:'gym', fatigue:'low', mu:'جانب البطن', category:'core_rotation'},
    {n:'Bicycle Crunch',              tier:'B', sets:'3×15/side',desc:'بطن كامل + Obliques في تمرين واحد — تدوير حقيقي', vid:'CakPX7X-mSw', equipment:'none', fatigue:'low', mu:'بطن كامل', category:'core_rotation'},
    {n:'V-Ups',                       tier:'B', sets:'3×12-15', desc:'بطن علوي وسفلي معا في حركة مركبة', vid:'uQFgVjFrI8k', equipment:'none', fatigue:'low', mu:'بطن كامل', category:'core_bodyweight'}
  ],

  // ─── MOBILITY & FLEXIBILITY DATABASE ──────────────────────────────────
  mobility:[
    {n:'Hip 90/90 Flow',              tier:'S', duration:'60ث/جانب × 2',  desc:'أفضل تمرين لفتح الورك — ضروري قبل أي تمرين أرجل', vid:'npdpCtfPI5I', equipment:'none', fatigue:'low', target:'ورك', category:'mobility_hip'},
    {n:'Thoracic Rotation (CARs)',    tier:'S', duration:'10 دورات/جانب', desc:'يحرر الظهر الوسط ويحسن وضعية الكتف — قبل تمارين الصدر والظهر', vid:'4NnQeVkOjM', equipment:'none', fatigue:'low', target:'ظهر وسط', category:'mobility_spine'},
    {n:'Shoulder CARs',               tier:'S', duration:'5 دورات/جانب',  desc:'Controlled Articular Rotation للكتف — يحمي الكتف ويحسن المدى الحركي', vid:'ZOP6RPjdAhA', equipment:'none', fatigue:'low', target:'كتف', category:'mobility_shoulder'},
    {n:'Ankle CARs',                  tier:'S', duration:'10 دورات/جانب', desc:'تحسين مدى حركة الكاحل — مهم لعمق السكوات والحركة العامة', vid:'UVtCSGJmGEY', equipment:'none', fatigue:'low', target:'كاحل', category:'mobility_ankle'},
    {n:'World Greatest Stretch',      tier:'A', duration:'5 rep/جانب × 2', desc:'تمرين مركب يفتح الورك والظهر الوسط والكتف في آن واحد', vid:'OCXMbIzYJTQ', equipment:'none', fatigue:'low', target:'جسم كامل', category:'mobility_full'},
    {n:'Deep Squat Hold',             tier:'A', duration:'45-60ث × 3',     desc:'يفتح الورك والكاحل ويحسن عمق السكوات وصحة الركبة', vid:'LPa3LKlQ7eU', equipment:'none', fatigue:'low', target:'ورك وكاحل', category:'mobility_hip'},
    {n:'Band Shoulder Opener',        tier:'A', duration:'15 rep × 3',     desc:'يحرر capsule الكتف الأمامية — ضد التحدب والجلوس الطويل', vid:'6SwxIDhsAwk', equipment:'band', fatigue:'low', target:'كتف', category:'mobility_shoulder'},
    {n:'Cat-Cow Spinal Flow',         tier:'B', duration:'10 دورات × 2',   desc:'تحريك الفقرات كلها بلطف — يقلل جمود الظهر الصباحي', vid:'aHZ2O2lM8Zs', equipment:'none', fatigue:'low', target:'عمود فقري', category:'mobility_spine'},
    {n:'Wall Slides',                 tier:'B', duration:'15 rep × 3',     desc:'تصحيح وضعية الكتف والظهر — يعالج Rounded Shoulders', vid:'OtgQDv7u1TM', equipment:'none', fatigue:'low', target:'كتف وظهر علوي', category:'mobility_shoulder'}
  ],

  // ─── STRETCHING PROTOCOL DATABASE ─────────────────────────────────────
  stretching:[
    {n:'Hamstring Stretch (Seated)',  tier:'S', duration:'45ث × 2/جانب', desc:'الأكثر أهمية بعد تمارين الأرجل — يقلل آلام الهامستينج', vid:'ezvyKMleqiA', equipment:'none', fatigue:'none', target:'هامستينج', category:'stretch_static'},
    {n:'Hip Flexor Lunge Stretch',   tier:'S', duration:'45ث × 2/جانب', desc:'ضد جمود الجلوس الطويل — يمتد ال Psoas وال Rectus Femoris', vid:'7hojk65NU4o', equipment:'none', fatigue:'none', target:'hip flexor', category:'stretch_static'},
    {n:'Doorway Chest Stretch',      tier:'S', duration:'30ث × 3',       desc:'يفتح الصدر ويصحح الكتف للأمام — أساسي بعد تمارين الصدر', vid:'D5rbt6UQ5WA', equipment:'none', fatigue:'none', target:'صدر وكتف أمامي', category:'stretch_static'},
    {n:'Child\'s Pose Lower Back',   tier:'S', duration:'60ث × 2',       desc:'يمتد الظهر السفلي وال Lats — مريح جدا بعد تمارين الظهر', vid:'AgwjXQJqfYo', equipment:'none', fatigue:'none', target:'ظهر سفلي ولاتس', category:'stretch_static'},
    {n:'Quad Stretch Standing',      tier:'A', duration:'30ث × 2/جانب', desc:'يمتد الكوادز بعد تمارين الأرجل ويقلل توتر الركبة', vid:'VusdhPd8C4I', equipment:'none', fatigue:'none', target:'كوادز', category:'stretch_static'},
    {n:'Lat Stretch (Overhead)',     tier:'A', duration:'30ث × 2/جانب', desc:'يمتد اللاتيسيموس بالكامل — ضروري بعد Pulldown وRow', vid:'lTRprj1Zt9A', equipment:'none', fatigue:'none', target:'لاتيسيموس', category:'stretch_static'},
    {n:'Cross Body Shoulder Stretch',tier:'A', duration:'30ث × 2/جانب', desc:'يمتد الدلتا الخلفي وال Rotator Cuff', vid:'dl0V2yhhSWs', equipment:'none', fatigue:'none', target:'كتف خلفي', category:'stretch_static'},
    {n:'Calf Wall Stretch',          tier:'B', duration:'30ث × 2/جانب', desc:'يمتد ال Gastrocnemius وال Soleus — بعد تمارين السمانة', vid:'KxliHPOmsTY', equipment:'none', fatigue:'none', target:'سمانة', category:'stretch_static'},
    {n:'Glute Figure-4 Stretch',     tier:'B', duration:'45ث × 2/جانب', desc:'يمتد الجلوتس وال Piriformis — يحمي الركبة والظهر السفلي', vid:'4CqSgEx5q_g', equipment:'none', fatigue:'none', target:'جلوتس', category:'stretch_static'}
  ],

  // ─── YOGA FLOW DATABASE ────────────────────────────────────────────────
  yoga:[
    {n:'Sun Salutation (Surya A)',    tier:'S', duration:'5-8 دورات',      desc:'التدفق الكلاسيكي — يسخن الجسم كله ويصفي الذهن', vid:'DbpJGzoRGhs', equipment:'mat', fatigue:'low', category:'yoga_flow'},
    {n:'Downward Dog (Adho Mukha)',   tier:'S', duration:'45ث × 3',        desc:'يمتد الظهر الكامل وال Hamstrings ويقوي الذراع', vid:'HmfuLTV03xg', equipment:'mat', fatigue:'low', category:'yoga_active'},
    {n:'Warrior I Pose',             tier:'A', duration:'45ث/جانب × 2',   desc:'يفتح الورك ويقوي الأرجل ويحسن التوازن', vid:'56hnUF1scTE', equipment:'mat', fatigue:'low', category:'yoga_standing'},
    {n:'Pigeon Pose (Eka Pada)',      tier:'A', duration:'90ث/جانب × 2',   desc:'أعمق استرتش للجلوتس وال Hip Flexor — مكمل ممتاز لتمارين الأرجل', vid:'BBLFDbGvhg8', equipment:'mat', fatigue:'none', category:'yoga_restorative'},
    {n:'Cat-Cow (Marjaryasana)',      tier:'A', duration:'10 دورات × 2',   desc:'تنشيط العمود الفقري — ينسق التنفس مع الحركة', vid:'EBQD1Sha26k', equipment:'mat', fatigue:'none', category:'yoga_flow'},
    {n:'Seated Spinal Twist',        tier:'B', duration:'60ث/جانب × 2',   desc:'تدوير العمود الفقري — يحرر التوتر في الظهر الوسط', vid:'QR5lJFjd1z8', equipment:'mat', fatigue:'none', category:'yoga_restorative'},
    {n:'Tree Pose (Vrksasana)',       tier:'B', duration:'45ث/جانب × 2',   desc:'تحسين التوازن والتركيز — يقوي الكاحل والكور', vid:'-nivNPefRds', equipment:'mat', fatigue:'none', category:'yoga_balance'}
  ],

  // ─── BREATHING & MINDSET DATABASE ─────────────────────────────────────
  breathing:[
    {n:'Box Breathing',               tier:'S', protocol:'4ث شهيق · 4ث حبس · 4ث زفير · 4ث حبس — 5-10 دورات', desc:'تقنية Navy SEALs — تخفض الكورتيزول وتحسن التركيز قبل التمرين', vid:'cPJJab_QV5w', equipment:'none', fatigue:'none', category:'breathwork'},
    {n:'Diaphragmatic Breathing',     tier:'S', protocol:'5ث شهيق بطيء من البطن · 7ث زفير بطيء — 10 دورات', desc:'التنفس الأساسي الصحيح — يفعل ال Parasympathetic ويسرع التعافي', vid:'bLUdPWR4lPs', equipment:'none', fatigue:'none', category:'breathwork'},
    {n:'Nasal Breathing Protocol',    tier:'S', protocol:'التنفس الكامل من الأنف فقط أثناء التمرين — 20+ دقيقة', desc:'يحسن ثاني أكسيد الكربون في الدم ويزيد كفاءة الأكسجين', vid:'rhtUesVqetc', equipment:'none', fatigue:'none', category:'breathwork'},
    {n:'4-7-8 Breathing',             tier:'A', protocol:'4ث شهيق · 7ث حبس · 8ث زفير — 4 دورات', desc:'تقنية الاسترخاء العميق — مثالية قبل النوم أو بعد تمرين مكثف', vid:'KHEnU4ky1Wc', equipment:'none', fatigue:'none', category:'breathwork'},
    {n:'Wim Hof',                     tier:'B', protocol:'5 دقائق بعد التمرين مباشرة — تنفس بطيء',        desc:'يسرع انتقال الجسم من Sympathetic إلى Parasympathetic', vid:'cIvWZ3u-81k', equipment:'none', fatigue:'none', category:'breathwork'}
  ],

  // ─── RECOVERY PROTOCOL DATABASE ───────────────────────────────────────
  recovery:[
    {n:'Mobility Recovery Flow',      tier:'S', duration:'15-20 دقيقة', desc:'Hip 90/90 + Thoracic + Shoulder CARs — تحرير المفاصل بعد الجلسة', vid:'rwkQzNJCAiI', equipment:'none', fatigue:'none', category:'recovery_mobility'},
    {n:'Full Body Stretch Session',   tier:'S', duration:'15-20 دقيقة', desc:'استرتش ثابت 30-45ث لكل عضلة عملت — يقلل DOMS بشكل فعال', vid:'lTe6GFTieP8', equipment:'mat', fatigue:'none', category:'recovery_stretch'},
    {n:'Foam Rolling Protocol',       tier:'A', duration:'10-15 دقيقة', desc:'Self-Myofascial Release — يكسر نقاط الضغط ويحسن تدفق الدم', vid:'KibUgcGXMTY', equipment:'foam_roller', fatigue:'none', category:'recovery_smr'},
  ],

  // ─── WEAK POINT / ISOLATION DATABASE — محذوفة بالكامل بناء على طلب المستخدم ───
  weakpoint:{}
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STRICT GYM / HOME ENFORCEMENT LAYER
// This is the FINAL GATE — exercises NEVER cross the gym/home boundary.
// The engine ALWAYS uses this function to get the correct database.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
