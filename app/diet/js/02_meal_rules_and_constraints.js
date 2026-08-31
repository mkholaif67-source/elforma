// ═══════════════════════════════════════════════════════════════
//  MEAL TEMPLATES SYSTEM
//  Defines valid meal structures for each meal type
// ═══════════════════════════════════════════════════════════════

const MEAL_TEMPLATES = {
  breakfast: [
    { name:'فطار بروتيني كامل', roles:['main_protein','side_carb','veggie'], minScore:8, hint:'بيض + خبز + خضار' },
    { name:'شوفان بروتيني', roles:['main_carb','side_protein'], minScore:7, hint:'شوفان + زبادي/بيض' },
    { name:'زبادي يوناني بول', roles:['side_protein','fruit_carb'], minScore:7, hint:'زبادي + فاكهة' },
    { name:'فطار مصري تقليدي', roles:['main_carb','side_protein','veggie'], minScore:7, hint:'فول/عدس + بيض + خضار' }
  ],
  pre: [
    { name:'طاقة سريعة قبل التمرين', roles:['quick_carb','side_protein'], minScore:8, hint:'موز/تمر + بروتين خفيف' },
    { name:'وجبة خفيفة قبل التمرين', roles:['main_carb','side_protein'], minScore:7, hint:'أرز + بروتين خفيف' }
  ],
  post: [
    { name:'تعافي عضلي مثالي', roles:['main_protein','main_carb'], minScore:9, hint:'بروتين قوي + كارب مناسب' },
    { name:'تعافي مع خضار', roles:['main_protein','main_carb','veggie'], minScore:8, hint:'دجاج/تونة + أرز + خضار' }
  ],
  lunch: [
    { name:'الوجبة الرئيسية الكاملة', roles:['main_protein','main_carb','veggie'], minScore:9, hint:'بروتين + كارب + خضار' },
    { name:'الوجبة الرئيسية بدون كارب', roles:['main_protein','veggie','main_fat'], minScore:7, hint:'بروتين + خضار + دهون صحية' }
  ],
  dinner: [
    { name:'عشاء خفيف الهضم', roles:['main_protein','veggie'], minScore:8, hint:'بروتين خفيف + خضار' },
    { name:'عشاء متوازن', roles:['main_protein','side_carb','veggie'], minScore:7, hint:'بروتين + كارب محدود + خضار' }
  ],
  snack: [
    { name:'سناك بروتيني', roles:['side_protein','fruit_carb'], minScore:7, hint:'زبادي/جبنة + فاكهة' },
    { name:'سناك خفيف', roles:['fruit_carb','side_fat'], minScore:6, hint:'فاكهة + مكسرات' },
    { name:'سناك سريع', roles:['quick_carb'], minScore:5, hint:'تمر/موز فقط' }
  ]
};

// ═══════════════════════════════════════════════════════════════
//  DIET CONSTRAINT ENGINE
//  Central rules based on FINAL NUTRITION CONTEXT
// ═══════════════════════════════════════════════════════════════

const DIET_CONSTRAINTS = {
  keto: {
    label:'كيتو',
    allowedCats:['protein','fat','veggie'],
    forbiddenFoods:['arzabydmtbwkh','arzbnymtbwkh','shwfanmtbwkh','mwz','tmr','ayshbldy',
      'ayshqmhkaml','mkrwnamslwqa','btatamslwqa','btatsmslwqa','adsasfrmtbwkh','fwlmdms',
      'hmsmslwq','zramslwqa','lbnkhalyaldsm','zbadytbyay','rayskykbny','btykh','manjw'],
    maxCarbPerMeal:10,
    preferredFoods:['sdr_frakh_mshwy','slmwn_mshwy','byd_mslwq','afwkadw','almonds',],
    carbTiming:'avoid_all',
    macroRanges:{ pPct:[0.28,0.35], fPct:[0.60,0.70], cPct:[0.03,0.08] }
  },
  carnivore: {
    label:'كارنفور',
    allowedCats:['protein','fat'],
    forbiddenFoods:['arzabydmtbwkh','arzbnymtbwkh','shwfanmtbwkh','mwz','tmr','ayshbldy',
      'ayshqmhkaml','mkrwnamslwqa','btatamslwqa','btatsmslwqa','adsasfrmtbwkh','fwlmdms',
      'hmsmslwq','brwkly','sbankhmtbwkha','flfl','tfah',
      'frawla','almonds','afwkadw'],
    maxCarbPerMeal:5,
    preferredFoods:['sdr_frakh_mshwy','lhm_bqry_mslwq','slmwn_mshwy','byd_mslwq','wrk_frakh_mshwy'],
    carbTiming:'none',
    macroRanges:{ pPct:[0.33,0.40], fPct:[0.60,0.67], cPct:[0,0] }
  },
  lowcarb: {
    label:'لو كارب',
    allowedCats:['protein','fat','veggie','fruit','dairy'],
    forbiddenFoods:['arzabydmtbwkh','ayshbldy','btatsmslwqa','zramslwqa','btykh','manjw','tmr'],
    maxCarbPerMeal:25,
    preferredFoods:['sdr_frakh_mshwy','sdr_dyk_rwmy_mshwy','byd_mslwq','slmwn_mshwy','arzbnymtbwkh','btatamslwqa'],
    carbTiming:'morning_and_preworkout_only',
    macroRanges:{ pPct:[0.32,0.40], fPct:[0.38,0.48], cPct:[0.15,0.25] }
  },
  balanced: {
    label:'متوازن',
    allowedCats:['protein','carb','fat','veggie','fruit','dairy','snack'],
    forbiddenFoods:[],
    maxCarbPerMeal:80,
    preferredFoods:['sdr_frakh_mshwy','sdr_dyk_rwmy_mshwy','byd_mslwq','arzbnymtbwkh','btatamslwqa','brwkly'],
    carbTiming:'spread_evenly',
    macroRanges:{ pPct:[0.28,0.35], fPct:[0.22,0.30], cPct:[0.38,0.45] }
  },
  carbcycle: {
    label:'كارب سايكل',
    allowedCats:['protein','carb','fat','veggie','fruit','dairy','snack'],
    forbiddenFoods:[],
    maxCarbPerMeal:80,
    preferredFoods:['sdr_frakh_mshwy','sdr_dyk_rwmy_mshwy','arzbnymtbwkh','btatamslwqa','byd_mslwq'],
    carbTiming:'high_on_training_days',
    macroRanges:{ pPct:[0.32,0.38], fPct:[0.25,0.32], cPct:[0.30,0.40] }
  },
  // ═══════════════════════════════════════════════════════════════
  //  MEDITERRANEAN DIET — evidence-based (AHA / Mayo / Harvard / EASL / PREDIMED)
  //  Plant-forward whole foods, olive oil as primary fat, fish 2-3x/week,
  //  legumes + whole grains, moderate dairy/poultry/eggs, low red meat,
  //  minimal processed meat & sweets. Carb-inclusive, MUFA-rich.
  // ═══════════════════════════════════════════════════════════════
  mediterranean: {
    label:'حمية البحر المتوسط',
    allowedCats:['protein','carb','fat','veggie','fruit','dairy','snack'],
    forbiddenFoods:[],
    maxCarbPerMeal:75,
    preferredFoods:['slmwn_mshwy','srdyn_mshwy','blty_mshwy','twna_myah','adsasfrmtbwkh','hmsmslwq','fwlmdms','zytzytwn','arzbnymtbwkh','ayshasmr','sbankhmtbwkha','brwkly','zbadytbyay','almonds','tfah'],
    carbTiming:'spread_evenly',
    macroRanges:{ pPct:[0.25,0.32], fPct:[0.30,0.38], cPct:[0.38,0.45] }
  }
};

// ═══════════════════════════════════════════════════════════════
//  COMPATIBILITY MATRIX
//  Score each diet for each health condition, goal, problem
// ═══════════════════════════════════════════════════════════════

const COMPATIBILITY_MATRIX = {
  health: {
    diabetes:    { keto:85, lowcarb:90, balanced:55, carbcycle:45, carnivore:50, mediterranean:80 },
    insulin:     { keto:80, lowcarb:92, balanced:58, carbcycle:42, carnivore:55, mediterranean:78 },
    bp:          { balanced:85, lowcarb:70, carbcycle:65, keto:45, carnivore:30, mediterranean:92 },
    cholesterol: { balanced:80, lowcarb:65, carbcycle:70, keto:40, carnivore:20, mediterranean:93 },
    kidney:      { balanced:90, lowcarb:55, carbcycle:60, keto:25, carnivore:10, mediterranean:80 },
    ibs:         { balanced:75, lowcarb:72, carbcycle:60, keto:55, carnivore:50, mediterranean:68 },
    gerd:        { balanced:80, lowcarb:72, carbcycle:65, keto:45, carnivore:35, mediterranean:78 },
    gout:        { balanced:85, lowcarb:65, carbcycle:70, keto:40, carnivore:20, mediterranean:84 },
    thyroid:      { balanced:85, lowcarb:70, carbcycle:72, keto:50, carnivore:40, mediterranean:84 },
    // ── GAP-1: Hypothyroid vs Hyperthyroid — clinically opposite requirements ──
    // Hypothyroid: slow metabolism — lowcarb/keto can help insulin sensitivity but must be SE-rich
    // Hyperthyroid: fast metabolism — needs calorie support, avoid iodine excess, anti-catabolic
    hypothyroid:  { balanced:85, lowcarb:75, carbcycle:72, keto:55, carnivore:45, mediterranean:84 },
    hyperthyroid: { balanced:90, carbcycle:80, lowcarb:60, keto:35, carnivore:40, mediterranean:86 },
    pcos:        { lowcarb:88, balanced:70, carbcycle:65, keto:72, carnivore:45, mediterranean:80 },
    anemia:      { balanced:90, lowcarb:70, carbcycle:75, keto:40, carnivore:60, mediterranean:82 },
    'fatty-liver':{ balanced:80, lowcarb:82, carbcycle:72, keto:60, carnivore:30, mediterranean:92 },
    lactose:     { balanced:80, lowcarb:75, carbcycle:75, keto:75, carnivore:85, mediterranean:76 },
    gluten:      { balanced:75, lowcarb:80, carbcycle:75, keto:85, carnivore:90, mediterranean:70 },
    'slow-meta': { balanced:75, lowcarb:85, carbcycle:82, keto:78, carnivore:55, mediterranean:78 }
  },
  goal: {
    cut:         { keto:78, lowcarb:85, balanced:75, carbcycle:80, carnivore:55, mediterranean:80 },
    bulk:        { balanced:90, carbcycle:82, lowcarb:50, keto:20, carnivore:40, mediterranean:80 },
    recomp:      { carbcycle:92, balanced:82, lowcarb:72, keto:55, carnivore:40, mediterranean:82 },
    maintain:    { balanced:95, carbcycle:80, lowcarb:72, keto:55, carnivore:40, mediterranean:92 }
  },
  problem: {
    hunger:      { balanced:78, lowcarb:88, keto:85, carbcycle:72, carnivore:75, mediterranean:80 },
    satiety:     { balanced:75, lowcarb:88, keto:90, carbcycle:70, carnivore:82, mediterranean:80 },
    adherence:   { balanced:90, carbcycle:75, lowcarb:72, keto:50, carnivore:35, mediterranean:90 },
    time:        { balanced:88, lowcarb:75, carbcycle:65, keto:55, carnivore:50, mediterranean:76 },
    outside:     { balanced:92, lowcarb:75, carbcycle:65, keto:40, carnivore:30, mediterranean:86 },
    boredom:     { balanced:85, carbcycle:92, lowcarb:70, keto:50, carnivore:35, mediterranean:82 },
    plateau:     { carbcycle:92, keto:80, lowcarb:78, balanced:65, carnivore:55, mediterranean:68 },
    energy:      { balanced:85, carbcycle:80, lowcarb:65, keto:55, carnivore:45, mediterranean:85 }
  }
};

// ═══════════════════════════════════════════════════════════════
//  HEALTH CONSTRAINT RULES
//  Defines what each condition forces on meal building
// ═══════════════════════════════════════════════════════════════

const HEALTH_MEAL_RULES = {
  diabetes: {
    maxCarbPerMeal: 35, avoidInsulImpact:['very_high','high'],
    avoidFoods:['arzabydmtbwkh','ayshbldy','mwz','tmr','btykh','manjw','btatsmslwqa','zramslwqa'],
    preferFoods:['arzbnymtbwkh','btatamslwqa','brwkly','sbankhmtbwkha'],
    mealNotes:'وجبات صغيرة متعددة — تجنب ارتفاع السكر المفاجئ'
  },
  insulin: {
    maxCarbPerMeal: 40, avoidInsulImpact:['very_high','high'],
    avoidFoods:['arzabydmtbwkh','ayshbldy','mwz','tmr','btykh','btatsmslwqa'],
    preferFoods:['arzbnymtbwkh','btatamslwqa','hmsmslwq','adsasfrmtbwkh'],
    mealNotes:'كارب معقد فقط — تقليل السكريات البسيطة'
  },
  bp: {
    avoidHighSodium:true,
    avoidFoods:['trky_mdkhn','dark_choc'],
    preferFoods:['sbankhmtbwkha','brwkly','mwz','btatamslwqa','slmwn_mshwy'],
    mealNotes:'تقليل الصوديوم — زيادة البوتاسيوم والمغنيسيوم'
  },
  cholesterol: {
    avoidHighSatFat:true,
    avoidFoods:['lhm_mfrwm_bqry_qlyl_aldhn','hmam_mshwy','kbda_frakh_mshwya','dark_choc'],
    preferFoods:['slmwn_mshwy','sdr_dyk_rwmy_mshwy','shwfanmtbwkh','almonds',],
    mealNotes:'تقليل الدهون المشبعة — زيادة الأوميغا-3 والألياف'
  },
  kidney: {
    maxProteinPerMeal: 25,
    avoidFoods:['sbankhmtbwkha','nuts_mixed','almonds',],
    mealNotes:'تقليل البروتين الزائد والبوتاسيوم العالي'
  },
  ibs: {
    avoidHighFiber:true,
    // ── PATCH 3 — IBS/FODMAP: extended high-FODMAP avoidance list ──
    // Added missing triggers: garlic_sauce (fructans), corn (polyols),
    // watermelon (fructose), oats_quaker (fructans overlap), harissa_paste
    // (capsaicin — IBS irritant), indomie_spicy (capsaicin + onion),
    // mustard_yellow (potential FODMAP), nuts_mixed (excess FODMAPs),
    // bulgur_cooked (fructans/GOS), couscous_cooked (fructans).
    avoidFoods:[
      // original list
      'brwkly','qrnbyt','hmsmslwq','adsasfrmtbwkh','bsl','fwlmdms',
      // PATCH additions — high-FODMAP / IBS-trigger foods
      // fructans (very high FODMAP)
      'zramslwqa',               // polyols
      'btykh',         // excess fructose
      'shwfanmtbwkh',        // fructans for sensitive IBS patients
      // capsaicin — strong IBS irritant
      // capsaicin irritant
      // capsaicin + onion powder
      'nuts_mixed',         // GOS — high FODMAP in large amounts
      'brghlmtbwkh',      // fructans/GOS
      // fructans
      'trms',               // lupin/legume — may trigger IBS/FODMAP symptoms
      'bslamtbwkha',        // peas/legume — GOS/FODMAP risk
      'fwlswyamtbwkh',      // soybeans/legume — GOS/FODMAP risk
            // potential FODMAP irritant
    ],
    preferFoods:['arzabydmtbwkh','sdr_frakh_mshwy','byd_mslwq','kwsa','jzr'],
    // ── HOTFIX P4 — IBS: fiber stacking reduction + FODMAP clustering limits ──
    maxFiberPerMeal: 8,      // hard cap on per-meal fiber (g) to prevent stacking
    maxFodmapFoodsPerMeal: 1, // no more than 1 moderate-FODMAP food per meal
    preferLowFiber: true,    // scoring bias: prefer lower-fiber options when IBS active
    mealNotes:'أطعمة سهلة الهضم — تجنب FODMAP العالي (ثوم، بصل، بقوليات، حبوب كاملة، كابسيسين) — لا تكديس ألياف في وجبة واحدة — وجبات صغيرة ومتكررة'
  },
  gout: {
    avoidHighPurine:true,
    avoidFoods:['kbda_frakh_mshwya','lhm_mfrwm_bqry_qlyl_aldhn','twna_myah','twna_frysh_mshwya','jmbry_mslwq'],
    preferFoods:['sdr_frakh_mshwy','sdr_dyk_rwmy_mshwy','byd_mslwq','arzbnymtbwkh','btatamslwqa'],
    mealNotes:'تجنب اللحوم عالية البيورين — شرب كميات كبيرة من الماء'
  },
  anemia: {
    preferFoods:['kbda_frakh_mshwya','lhm_bqry_mslwq','sbankhmtbwkha','adsasfrmtbwkh','fwlmdms'],
    combineWith:['flfl','frawla'],
    mealNotes:'مصادر حديد مع فيتامين C لتحسين الامتصاص'
  },
  'fatty-liver': {
    // ── GAP-6: Fatty Liver — Fructose-specific avoidance ─────────────────
    // The liver is the ONLY organ that metabolically processes fructose via
    // De Novo Lipogenesis - directly creates fat from fructose (not from glucose).
    // This is distinct from general sugar rules. Fructose-specific sources must be
    // penalized independently from diabetes rules.
    avoidFoods:[
      // High-fructose foods — directly drive hepatic De Novo Lipogenesis
      'arzabydmtbwkh',         // high glycemic — hepatic fat accumulation
      'ayshbldy',       // refined carb — rapidly converted to liver fat
      'mwz',             // moderate-high fructose
      'tmr',              // very high fructose — worst for NAFLD
      'dark_choc',          // added sugar + fat - combined liver burden
      // ── GAP-6 additions: fructose-specific sources ──
      'btykh',         // high fructose content despite low GI
      // HFCS (High Fructose Corn Syrup) — most dangerous
      // sucrose - 50% fructose — hepatic DNL trigger
      // fructose + carbonation
      // combined refined carb + fat + sugar
    ],
    preferFoods:[
      'arzbnymtbwkh',        // complex carb — low hepatic burden
      'shwfanmtbwkh',              // soluble fiber (beta-glucan) — improves liver fat
      'brwkly',          // sulforaphane — shown to reduce liver fat in NAFLD
      'sbankhmtbwkha',           // anti-inflammatory + fiber
      'slmwn_mshwy',            // omega-3 — reduces hepatic inflammation and DNL
      // omega-3 + polyphenols — NAFLD benefit in RCTs
      'coffee_black',      // 2-3 cups/day reduces hepatic fibrosis 40% (multiple RCTs)
      'byd_mslwq',        // choline — essential for liver fat export as VLDL
      'sdr_frakh_mshwy',    // lean protein — necessary for liver repair
                // EGCG catechins — reduce liver fat accumulation
    ],
    mealNotes:'الكبد الدهني: الفركتوز هو العدو الأول — تجنب العصائر والسكريات المضافة والمشروبات المحلاة. كارب معقد فقط. أوميغا-3 يوميا. الشوفان وبروكلي والسالمون الأفضل'
  },

  // ── المجموعة المكتملة — PHASE 4 COMPLETION ──────────────────
  thyroid: {
    // ── PATCH 4 — Thyroid: remove cooked-cruciferous hard-block ──
    // Science: goitrogens in broccoli/cauliflower/spinach are
    // substantially deactivated by cooking (steaming, boiling, roasting).
    // Blocking them entirely via avoidFoods incorrectly eliminates some
    // of the most nutritious foods for thyroid patients (selenium,
    // iodine cofactors, fiber). The avoidRaw field is for advisory
    // display only — it is NOT enforced as a hard food block.
    // FIX: avoidFoods is now empty for thyroid (no hard food blocks).
    //      avoidRaw retained for advisory warnings in the UI.
    avoidFoods:[],   // cooked cruciferous is SAFE — no hard block
    avoidRaw:['brwkly','qrnbyt','sbankhmtbwkha'],  // advisory: raw only
    preferFoods:['byd_mslwq','sdr_frakh_mshwy','sdr_dyk_rwmy_mshwy','slmwn_mshwy','arzbnymtbwkh'],
    mealNotes:'تجنب الصليبيات النيئة فقط — مسموح مطبوخة. دعم اليود والسيلينيوم. يفضل البروتين الخفيف والكارب المعقد'
  },

  // ── GAP-1: Hypothyroid — clinically opposite to Hyperthyroid ──────────────
  // Hypothyroid = قصور الغدة: slow metabolism, weight gain tendency, fatigue.
  // Priority nutrients: Iodine (seafood), Selenium (brazil nuts, tuna), Zinc (meat),
  // Vitamin D, Iron. Avoid: raw goitrogens (cruciferous), excessive soy.
  // Diet preference: balanced/lowcarb — supports insulin sensitivity often impaired.
  hypothyroid: {
    avoidFoods: [],   // No hard blocks — goitrogens safe when cooked
    avoidRaw:   ['brwkly','qrnbyt','sbankhmtbwkha','kale'],  // advisory only — raw form reduces iodine uptake
    preferFoods: [
      'slmwn_mshwy',          // iodine + omega-3 + selenium — triple thyroid benefit
      'srdyn_mshwy',        // iodine + selenium + vitamin D
      'twna_myah',     // selenium (70mcg/100g — near full daily RDI)
      'byd_mslwq',      // iodine + selenium + protein
      'sdr_dyk_rwmy_mshwy',   // zinc + selenium + lean protein
      'sdr_frakh_mshwy',  // zinc + lean protein — metabolic support
      'arzbnymtbwkh',      // complex carb — stable energy for slow metabolism
      'btatamslwqa',    // complex carb + beta-carotene (T4 - T3 cofactor)
      'almonds',         // selenium + zinc + healthy fat
      'sbankhmtbwkha',         // iron + zinc — cooked form is safe
      'brwkly'         // cooked: goitrogens destroyed — selenium source
    ],
    mealNotes: 'قصور الغدة: ركز على اليود (أسماك) والسيلينيوم (تونة، مكسرات) والزنك (لحوم). الصليبيات مطبوخة فقط. كارب معقد لدعم الطاقة البطيئة. تجنب الصويا الزائدة'
  },

  // ── GAP-1: Hyperthyroid — فرط نشاط الغدة ────────────────────────────────
  // Hyperthyroid = فرط الغدة: fast metabolism, weight loss tendency, anxiety, palpitations.
  // Priority: AVOID excess iodine (accelerates thyroid), increase Calcium/Magnesium,
  // anti-inflammatory foods, adequate calories to prevent muscle wasting.
  // Diet preference: balanced/carbcycle — needs adequate carbs for energy demand.
  hyperthyroid: {
    avoidFoods: [
      // High-iodine foods — directly stimulate overactive thyroid hormone production
      'srdyn_mshwy',        // very high iodine — avoid in hyperthyroid
      'twna_frysh_mshwya',      // high iodine
      // High-caffeine — worsens palpitations and anxiety in hyperthyroid
      'coffee_black'           // caffeine - worsens tachycardia + anxiety symptoms
    ],
    avoidHighIodine: true,  // flag for future iodine-aware scoring
    preferFoods: [
      'sdr_frakh_mshwy',  // lean protein — prevents catabolism (high metabolism burns muscle)
      'sdr_dyk_rwmy_mshwy',   // lean protein
      'byd_mslwq',      // complete protein + vitamin D (moderate iodine — acceptable)
      'zbadytbyay',    // calcium — hyperthyroid accelerates bone loss
      'lbnkhalyaldsm',       // calcium + vitamin D — bone protection critical in hyperthyroid
      'almonds',         // magnesium — reduces palpitations and anxiety
      // magnesium + anti-inflammatory omega-3
      'brwkly',        // cruciferous — natural mild goitrogen helps SLOW thyroid slightly (therapeutic)
      'qrnbyt',     // same cruciferous benefit — mild goitrogen, anti-inflammatory
      'sbankhmtbwkha',         // magnesium + iron — energy support
      'btatamslwqa',    // complex carb — hyperthyroid needs adequate carbs for energy demand
      'shwfanmtbwkh'             // complex carb + magnesium — sustained energy + calming effect
    ],
    mealNotes: 'فرط الغدة: تجنب اليود الزائد (سردين، تونة طازجة، ملح معالج). ركز على الكالسيوم والمغنيسيوم. كارب كاف لمنع هدم العضلات. الصليبيات مسموحة — قد تعاكس فرط النشاط طبيا'
  },
  pcos: {
    maxCarbPerMeal: 40,
    avoidFoods:['arzabydmtbwkh','ayshbldy','mwz','tmr','btykh'],
    preferFoods:[
      'arzbnymtbwkh','btatamslwqa','sdr_frakh_mshwy','byd_mslwq','almonds','afwkadw',
      // ── HOTFIX P4 — PCOS: omega-3, low-GI, anti-inflammatory additions ──
      'slmwn_mshwy',          // omega-3 — reduces androgen-driven inflammation
      // omega-3 + polyphenols
      'srdyn_mshwy',        // omega-3
      'brwkly',        // anti-inflammatory cruciferous (low-GI)
      'sbankhmtbwkha',         // anti-inflammatory leafy greens
      'frawla',      // low-GI antioxidant
      'adsasfrmtbwkh',         // low-GI legume protein
      'hmsmslwq',       // low-GI, fiber — glycemic control
      'zbadytbyay',    // low-GI dairy protein
      'zytzytwn'        // anti-inflammatory MUFA
    ],
    mealNotes:'كارب معقد منخفض GI — أوميغا-3 يوميا — أطعمة مضادة للالتهاب. مشابه لمقاومة الإنسولين'
  },
  'slow-meta': {
    avoidFoods:['arzabydmtbwkh','ayshbldy','btatsmslwqa','zramslwqa'],
    preferFoods:['sdr_frakh_mshwy','sdr_dyk_rwmy_mshwy','byd_mslwq','arzbnymtbwkh','brwkly','sbankhmtbwkha'],
    mealNotes:'رفع نسبة البروتين — وجبات صغيرة متكررة. تجنب الكارب المعالج'
  },
  lactose: {
    avoidFoods:['lbnkhalyaldsm','zbadytbyay','zbadytbyay','jbnaqrysh'],
    preferFoods:['sdr_frakh_mshwy','byd_mslwq','almonds','arzbnymtbwkh','brwkly','slmwn_mshwy'],
    mealNotes:'استبدال منتجات الألبان ببدائل نباتية (حليب جوز الهند / لوز)'
  },
  gluten: {
    avoidFoods:['ayshbldy','ayshqmhkaml','mkrwnamslwqa','shwfanmtbwkh','twrtyla','twrtyla','twstasmr'],
    preferFoods:['arzabydmtbwkh','arzbnymtbwkh','btatamslwqa','btatsmslwqa',
                 'sdr_frakh_mshwy','byd_mslwq','slmwn_mshwy'],
    mealNotes:'تجنب القمح والشعير والجاودار — الشوفان ممنوع إلا المعلم gluten-free'
  },
  gerd: {
    avoidHighFat:true,
    avoidFoods:['brtqal','dark_choc','lhm_mfrwm_bqry_qlyl_aldhn','zytzytwn',
                'byd_awmlyt','fwlmdms',
                // ── HOTFIX P4 — GERD: additional acidic/spicy/fried avoidances ──
                'coffee_black',           // strong LES relaxant — avoid or limit
                // carbonated + acidic
                // carbonated
                // carbonated + acidic
                // spicy irritant + high fat
                'trky_mdkhn',   // processed + high fat - LES relaxation
                'jbnarwmy',      // high-fat cheese — slows gastric emptying
                'lhm_bqry_mslwq'         // red meat — slower digestion, GERD risk at dinner
               ],
    preferFoods:['sdr_frakh_mshwy','sdr_dyk_rwmy_mshwy','byd_mslwq','shwfanmtbwkh',
                 'mwz','btatamslwqa','brwkly',
                 // ── HOTFIX P4 — GERD: add alkaline/low-acid preferences ──
                 'arzbnymtbwkh',      // low-acid, easy digestion
                 'kwsa',        // alkaline vegetable
                 'jzr',          // low-acid, soothing
                 'zbadytbyay'     // probiotic — may reduce reflux episodes
                ],
    // ── HOTFIX P4 — GERD: enforce small meal sizing and avoid large late meals ──
    avoidLargeLateNight: true,  // flag for meal-timing logic
    maxDinnerCarbRatio: 0.5,    // dinner carbs ≤ 50% of target (lighter dinner)
    mealNotes:'تجنب الأطعمة الحمضية والدهنية والحارة والمكربنة — وجبات صغيرة ومتكررة — عشاء خفيف جدا قبل النوم ب 3 ساعات على الأقل — لا أطعمة مقلية'
  }
};
