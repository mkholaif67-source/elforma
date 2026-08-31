// ═══════════════════════════════════════════════════════════════════════
//  v32 — SMART MEAL POOL SYSTEM (SMPS)
//  Step 7 complete replacement
//  Architecture:
//    SMPS.pool  = { breakfast: [foodIds], lunch: [...], ... }
//    SMPS.slots = derived from DE.mealCount / DE.workoutType
//    Phase 1 - User builds pool per meal slot
//    Phase 2 - Engine generates 1 sample day from pools
//    Phase 3 - Engine generates 90-day rotating plan
// ═══════════════════════════════════════════════════════════════════════
(function _v32_SmartMealPoolSystem() {

  // ── State ─────────────────────────────────────────────────────────
  const SMPS = {
    pool: {},          // { slotKey: Set<foodId> }
    slots: [],         // ordered array of slot keys for this user
    currentPhase: 1,
    activeSlot: null,
    slotSearchQuery: {},
    slotCatFilter: {},
    _90dayPlan: null,
    _previewDay: null,
  };
  window.SMPS = SMPS; // expose for debugging

  // ── Slot metadata ─────────────────────────────────────────────────
  const SLOT_META = {
    breakfast: { icon:'', label:'الفطار',         desc:'طاقة الصباح — فطار شبعان يوميك صح',       minFoods:3 },
    lunch:     { icon:'', label:'الغداء',          desc:'الوجبة الكبرى — بروتين + كارب + خضار',     minFoods:3 },
    dinner:    { icon:'', label:'العشاء',           desc:'خفيف وسهل الهضم — لا تنم جعان',           minFoods:3 },
    snack:     { icon:'', label:'السناك',           desc:'بين الوجبات — سريع ومشبع',                minFoods:2 },
    pre:       { icon:'', label:'قبل التمرين',      desc:'طاقة سريعة + كارب خفيف',                  minFoods:2 },
    post:      { icon:'', label:'بعد التمرين',      desc:'بروتين سريع + تعافي عضلي',                minFoods:2 },
  };

  // ── Resolve which slots this user needs ───────────────────────────
  function _resolveSlots() {
    let slots = [];
    if (typeof DE === 'undefined') return ['breakfast','lunch','dinner'];
    if (DE.workoutType === 'gym' && DE.gymSplit === 'default') {
      slots = ['breakfast','pre','post','dinner'];
      if (DE.snacks) slots.push('snack');
    } else {
      const n = DE.mealCount || 3;
      if (n === 2) slots = ['breakfast','dinner'];
      else if (n === 3) slots = ['breakfast','lunch','dinner'];
      else if (n === 4) slots = ['breakfast','lunch','dinner','snack'];
      else slots = ['breakfast','pre','lunch','post','dinner'];
      if (DE.snacks && !slots.includes('snack')) slots.push('snack');
    }
    // [OWNER-RULE] أي مستخدم بيتمرن في الجيم لازم تظهر له وجبة «قبل التمرين».
    // لو الـslots اتبنت من غير 'pre' (سبليت غير افتراضي أو عدد وجبات مختلف)
    // نحقنها بعد الفطار مباشرة — قاعدة قبل التمرين موجودة أصلاً ولازم تشتغل.
    if (typeof DE !== 'undefined' && DE.workoutType === 'gym' && !slots.includes('pre')) {
      const bfIdx = slots.indexOf('breakfast');
      if (bfIdx >= 0) slots.splice(bfIdx + 1, 0, 'pre');
      else slots.unshift('pre');
    }
    return slots;
  }

  // ── Check if food allowed for this slot (diet + health + timing) ──
  //  ملاحظة هندسية: هذه بوابة "تجميع" (pool) ثنائية (مسموح/ممنوع) فقط.
  //  تفضيل التوقيت (أنسب طعام قبل/بعد التمرين) يدار عبر نظام التقييم
  //  (MIP/SDI timing scores) كعقوبة ناعمة — لا عبر حظر صارم. لذلك لا نحظر
  //  هنا إلا ما هو غير مناسب فعليا وبشكل قاطع، حتى لا نقصي أطعمة صحية.
  function _isFoodAllowedForSlot(food, slotKey) {
    // [EGY-v72] فلتر الموسم: لو العنصر محددة شهوره والشهر الحالي ماش فيها → ممنوع.
    if (food && Array.isArray(food.season)) {
      var _month = new Date().getMonth() + 1; // 1-12
      if (!food.season.includes(_month)) return false;
    }
    // [FIX-MEALTYPES] حظر صارم: لو الطعام محدد بـmealTypes ولا يشمل هذه الوجبة → ممنوع.
    // الفطار تحديدًا: الأرز/المكرونة/الفيليه محددين بـlunch/dinner فقط في الDB — يتحظروا هنا قاطعًا.
    if (Array.isArray(food.mealTypes) && food.mealTypes.length > 0) {
      if (!food.mealTypes.includes(slotKey)) {
        return { ok: false, reason: 'مش مناسب لهذه الوجبة حسب نوع الطعام' };
      }
    }
    // البوابة الحقيقية الوحيقة: فلتر الدايت/الحالة الصحية (allowedCats + maxCarb + الحالات)
    if (typeof isFoodAllowed === 'function') {
      const check = isFoodAllowed(food);
      if (!check.ok) return { ok: false, reason: check.reason };
    }

    const diet = (typeof DE !== 'undefined' && DE.diet) ? DE.diet : 'balanced';
    const fatBasedDiet = (diet === 'keto' || diet === 'carnivore');
    const cals = food.cal || 0;
    const fatPct = cals > 0 ? (food.fat * 9) / cals : 0; // نسبة الدهون من السعرات

    if (slotKey === 'pre') {
      // قبل التمرين: الدهون المرتفعة جدا تبطئ إفراغ المعدة وتؤخر توفر الطاقة.
      // لكن في الأنظمة الدهنية (كيتو/كارنيفور) الدهون هي الوقود — فلا تحظر إطلاقا.
      // نحظر فقط الحالة القاطعة: طعام دهونه > 70% من سعراته على نظام كاربي.
      if (!fatBasedDiet && fatPct > 0.70 && food.fat >= 20)
        return { ok: false, reason: 'دهون مرتفعة جدا — تبطئ توفر الطاقة قبل التمرين' };
    }
    // بعد التمرين: لا حظر على الدهون "الدهون تمنع امتصاص البروتين بعد التمرين"
    // ادعاء غير دقيق علميا؛ المهم هو إجمالي البروتين/الكارب اليومي. الحظر السابق
    // كان يقصي أطعمة صحية (مكسرات، زبدة فول سوداني، سلمون، أفوكادو) ويتعارض مع
    // الكيتو/الكارنيفور. التوقيت الأمثل يدار عبر نظام التقييم لا عبر الحظر.

    // اللب: تسالي وليس مكون وجبة. مسموح كسناك فقط بطلب صاحب المشروع.
    const SEED_SNACK_ONLY = ['lbqra_mhms','lbswpr','lbswry','lbabyd'];
    if (SEED_SNACK_ONLY.includes(food.id)
        && ['breakfast','lunch','dinner'].includes(slotKey)) {
      return { ok: false, reason: 'اللب تسالي - يتحسب سناك مش وجبة أساسية' };
    }

    if (slotKey === 'dinner') {
      // عشاء عالي الكارب لهدف التخفيف — على الأنظمة الكاربية فقط (الدهنية تحظر الكارب أصلا)
      if (typeof DE !== 'undefined' && DE.goal === 'cut' && !fatBasedDiet
          && food.cat === 'carb' && food.carb > 60)
        return { ok: false, reason: 'كارب عالي في العشاء — غير مناسب لهدف التخفيف' };
    }
    return { ok: true, reason: '' };
  }

  // ══════════════════════════════════════════════════════════════
  //  FOOD_SORT_ORDER — مصدر واحد للترتيب في كل مكان في ال app
  //  أرز - خبز - بطاطا - ريس كيك - شوفان - مكرونة - بقوليات
  //  يستخدم في: SMPS panel + NC search + meal planner
  // ══════════════════════════════════════════════════════════════
  const _FOOD_SORT_ORDER_LIST = [
    // ══ CARB ══════════════════════════════════════════════════
    'arzabydmtbwkh','arzbsmtymtbwkh','arzbnymtbwkh','arzbalsharya',
    // ترتيب الخبز باختيار صاحب المشروع: أسمر ثم قمح كامل ثم أبيض ثم رايس كيك.
    // عيش الشوفان مؤخر عمدا (ليس خيارا أوليا).
    'ayshasmr','ayshqmhkaml','ayshbldy','ayshabyd','rayskykbny',
    'ayshshamy','ayshswry','ayshsn','ayshalzra','ayshalshwfan',
    'twstqmhkaml','twstasmr','twstabyd','twstsn',
    'btatamslwqa','btatamshwya','btatafyalfrn',
    'btatsmslwqa','btatsmshwya','btatsbywryh','btatabywryh',
    'shwfanmtbwkh','frykmtbwkh','brghlmtbwkh','shayrmtbwkh',
    'mkrwnamslwqa','shayryamtbwkha',
    'zramslwqa','zramshwya',
    'fwlmdms','hmsmslwq','hmsmtbwkh','adsasfrmtbwkh','adsbjbamtbwkh',
    'faswlyabydamtbwkha','faswlyahmramtbwkha','fwlswyamtbwkh','kshry',
    'btatsmqlya','btatsshybsy',
    // ══ PROTEIN: بيض - فراخ - سمك - لحوم - معالج ══
    'byd_mslwq','byad_byd','byd_awmlyt','sdr_frakh_mshwy','wrk_frakh_mshwy',
    'jnah_frakh_mshwy','sdr_dyk_rwmy_mshwy','sdr_dyk_rwmy_mslwq','wrk_dyk_rwmy_mshwya','kbda_frakh_mshwya',
    'qwans_frakh','shysh_tawwq','blty_mshwy','bwry_mshwy',
    'makryl_mshwy','srdyn_mshwy',
    'srdyn_malb','twna_myah','twna_layt','twna_frysh_mshwya',
    'fylyh_dnys','dnys_mshwy','smk_byad_mshwy','smk_brbwny_mshwy','smk_mrjan_mshwy',
    
    'jmbry_balfrn','kalymary_balfrn','sbyt_balfrn','kabwrya_mslwqa','kabwrya_balfrn',
    'kfta_mshwya_ala_alfhm','kbab_mshwy','rysh_mshwya_ala_alfhm','shrah_lhm_mshwya','lhm_bqry_mslwq',
    'lhm_mfrwm_bqry_qlyl_aldhn','lhm_dany_mshwy','arnb_mslwq','hmam_mshwy','sdr_sman_mshwy',
    'sdr_bt_mshwy','sdr_frakh_mqly','wrk_frakh_mqly','jnah_frakh_mqly','blty_mqly',
    'fylyh_smk_mqly','srdyn_mqly','dnys_mqly','qarws_mqly','jmbry_mqly',
    'jmbry_banyh','sbyt_banyh','sbyt_mqly','smk_mkrwnh_mqly','mrjan_mqly',
    'kbab_hla','lhm_mfrwm_bqry_mtwst_aldhn','trb_mshwy','lhm_jml_mshwy','lhm_bqry_barda',
    'kbda_askndrany','sjq_askndrany','shawrma_frakh','shawrma_lhma','brjr_lhm_qlyl_aldhn',
    'banyh_mshwy','astrbs_frakh','tshykn_brjr_mshwy','bstrma_bqry','lanshwn_frakh',
    'lanshwn_bqry','shrah_rwst_byf','shrah_djaj_mdkhna','shrah_lhm_mdkhna','twna_mdkhna',
    'slmwn_mdkhn','makryl_mdkhn','slmwn_malb','qta_twna_balzyt','rnja',
    'fsykh','anshwja','brjr_bqry','najts_frakh','brjr_frakh',
    'kfta_frakh','hwawshy_lhm','trky_mdkhn','thal_bqry','mkh_bqry',
    'klawy_bqry','lhma_ras','krsha','kwara','akawy_btlw','hmam_mslwq','sdr_sman_mslwq','wrk_bt_mshwya','smk_snjary_mshwy',
    'smk_mrjan_mshwy','shakhrwh_mshwy','qramyt_mshwy','bstrma_mdkhna',
    // ══ FAT: سوداني - جوز - لوز - بندق - فستق - كاجو - لب - شيكولاتة ══
    'swdany_ny','swdany_mhms','jwz','jwz_mhms','lwz_ny','lwz_mhms','bndq_ny','bndq_mhms','fstq_ny','fstq_mhms','kajw_ny','kajw_mhms','aynjml_ny','aynjml_mhms','mkadymya_ny','mkadymya_mhms',
    'kajw_mhms','lbqra_mhms','lbswry','lbswpr','lbabyd',
    'zytzytwn','zytjwzalhnd','thyna',
    'zbdafwlswdany','zbdalwz','zbdakajw','smsm','bykan','zytabadalshms','zytzra',
    'zbda','smnbldy','galaxy_choc','dairy_milk_choc','milka_choc','mandolin_choc','mandolin_wafer','snickers_bar','juice_asab','juice_guava','juice_mango','juice_ananas','juice_frawla','juice_mwz','juice_laymwn','sesame_bar','peanuts_roasted','honey_natural','honey_black_carob',
    'popcorn_plain','sun_bites','kitkat_bar',
    'milk_chocolate_bar','dark_choc','dark_chocolate_85','nuts_mixed','almonds',
    'bekrolls','protein_bar','coffee_black',
    'pepsi_diet',
    'energy_drink_redbull','jelly_gelatin','gullash_cream','nutella_20g',
    'ketchup_heinz','soy_sauce','chips_lays_25g','chips_pringles_40g',// ══ DAIRY: جبنة قريش/رومي/بيضاء - زبادي - لبن ══
    'jbnaqrysh','jbna_rwds_gwld','jbnarwmy','jbnabyda','jbnamlhkhfyf','jbnadmyaty',
    'jbnaastnbwly','jbnabramyly','jbnahlwm','jbnafyta','lbna',
    'jbnamwtzarylalayt','jbnashydrlayt','jbnashydr','jbnamwzaryla','jbnajwda',
    'jbnaaydam','jbnaflamnk','jbnaflfl','jbnakrymy','jbnadwblkrym',
    'jbnamthlthat','jbnamdkhna','jbnashll','jbnabarmyzan','jbnarykwta',
    'jbnashrahshydr','zbadytbyay','zbadyywnanylayt','zbadytbyay','zbadylayt',
    'lbnraybtbyay','zbadybalfakha','lbnkhalyaldsm','lbnkamlaldsm','hlybtbyaa',
    'hlybkhalyallaktwz','hlyblwz','hlybjwzalhnd','hlybshwfan','hlybswya',
    'hlybarz','hlybmbkhr','hlybmkthfmhla',
    // ══ VEGGIE ════════════════════════════════════════════════
    'khyar','tmatm','bsl','flfl','jrjyr','khs','jzr',
    'brwkly','qrnbyt','kwsa','baznjan','krfs',
    'ftrayshalghrab','zra','zrahlwa',
    // ══ FRUIT ═════════════════════════════════════════════════
    'mwz','tfah','brtqal','ywsfy','frawla','manjw',
    'anb','btykh','kaka','tynshwky','rman','jwafa',
    'tyn','blh','tmr','krz','twt',
  ];
  // حول اللسته ل Map للبحث السريع O(1)
  const _FOOD_SORT_MAP = new Map(
    _FOOD_SORT_ORDER_LIST.map((id, i) => [id, _FOOD_SORT_ORDER_LIST.length - i])
  );
  // ال score: الأول في اللسته يأخذ أعلى رقم، اللي مش موجود يأخذ 0
  function _getFoodSortScore(foodId) {
    return _FOOD_SORT_MAP.get(foodId) || 0;
  }

  // ── ترتيب منطقي للأكل — الأساسي أول ──────────────────────────────
  const _FOOD_PRIORITY = {
    carb: [
      // ══ الأرز أولا دايما ══
      'arzabydmtbwkh','arzbsmtymtbwkh','arzbnymtbwkh','arzbalsharya',
      // الخبز: أسمر ثم قمح كامل ثم أبيض ثم رايس كيك (اختيار صاحب المشروع)
      'ayshasmr','ayshqmhkaml','ayshbldy','ayshabyd','rayskykbny',
      'ayshshamy','ayshswry','ayshsn',
      'twstqmhkaml','twstasmr','twstabyd','twstsn',
      // البطاطا والبطاطس الصحية
      'btatamslwqa','btatamshwya','btatafyalfrn',
      'btatsmslwqa','btatsmshwya','btatsbywryh','btatabywryh',
      // الشوفان والحبوب
      'shwfanmtbwkh','frykmtbwkh','brghlmtbwkh','shayrmtbwkh',
      // المكرونة
      'mkrwnamslwqa','shayryamtbwkha',
      // الذرة
      'zramslwqa','zramshwya','ayshalzra',
      // البقوليات
      'fwlmdms','hmsmslwq','hmsmtbwkh','adsasfrmtbwkh','adsbjbamtbwkh',
      'faswlyabydamtbwkha','faswlyahmramtbwkha','fwlswyamtbwkh','kshry',
      // الأقل شيوعا في الآخر (عيش الشوفان هنا عمدا: متاح وليس مقترحا أولا)
      'ayshalshwfan','btatsmqlya','btatsshybsy',
    ],
    protein: [
      // بيض - فراخ - سمك - لحوم - معالج
      'byd_mslwq','byad_byd','byd_awmlyt','sdr_frakh_mshwy','wrk_frakh_mshwy',
      'jnah_frakh_mshwy','sdr_dyk_rwmy_mshwy','sdr_dyk_rwmy_mslwq','wrk_dyk_rwmy_mshwya','kbda_frakh_mshwya',
      'qwans_frakh','shysh_tawwq','blty_mshwy','bwry_mshwy',
      'makryl_mshwy','srdyn_mshwy',
      'srdyn_malb','twna_myah','twna_layt','twna_frysh_mshwya',
      'fylyh_dnys','dnys_mshwy','smk_byad_mshwy','smk_brbwny_mshwy',
      'jmbry_balfrn','kalymary_balfrn','sbyt_balfrn','kabwrya_mslwqa','kfta_mshwya_ala_alfhm',
      'kbab_mshwy','rysh_mshwya_ala_alfhm','shrah_lhm_mshwya','lhm_bqry_mslwq','lhm_mfrwm_bqry_qlyl_aldhn',
      'lhm_dany_mshwy','arnb_mslwq','hmam_mshwy','sdr_sman_mshwy','sdr_frakh_mqly',
      'wrk_frakh_mqly','jnah_frakh_mqly','blty_mqly','fylyh_smk_mqly','srdyn_mqly',
      'jmbry_mqly','kbab_hla','brjr_lhm_qlyl_aldhn','shawrma_frakh','banyh_mshwy',
      'kbda_askndrany','sjq_askndrany','bstrma_bqry','lanshwn_frakh','najts_frakh',
      'brjr_frakh','brjr_bqry','hwawshy_lhm','twna_mdkhna','slmwn_mdkhn',
      'makryl_mdkhn','rnja','fsykh',
    ],
    fat: [
      // سوداني - جوز - لوز - بندق - فستق - كاجو - لب - شيكولاتة
      'swdany_ny','swdany_mhms','jwz','jwz_mhms','lwz_ny','lwz_mhms','bndq_ny','bndq_mhms','fstq_ny','fstq_mhms','kajw_ny','kajw_mhms','aynjml_ny','aynjml_mhms','mkadymya_ny','mkadymya_mhms',
      'kajw_mhms','lbqra_mhms','lbswry','lbswpr','lbabyd',
      'zytzytwn','zytjwzalhnd','thyna',
      'zbdafwlswdany','zbdalwz','zbdakajw','smsm','bykan','zytabadalshms','zytzra',
      // الشوكولاتة الدارك أولا دايما - لو المستخدم عايز شوكولاتة تبقى دي
      'dark_choc','dark_chocolate_85',
      'zbda','smnbldy','galaxy_choc','dairy_milk_choc','milka_choc','mandolin_choc','mandolin_wafer','snickers_bar','juice_asab','juice_guava','juice_mango','juice_ananas','juice_frawla','juice_mwz','juice_laymwn','sesame_bar','peanuts_roasted','honey_natural','honey_black_carob',
      'popcorn_plain','sun_bites','kitkat_bar',
      'milk_chocolate_bar','dark_choc','dark_chocolate_85','nuts_mixed','almonds',
      'bekrolls','protein_bar','coffee_black',
      'pepsi_diet',
      'energy_drink_redbull','jelly_gelatin','gullash_cream','nutella_20g',
      'ketchup_heinz','soy_sauce','chips_lays_25g','chips_pringles_40g',],
    veggie: [
      'khyar','tmatm','bsl','flfl','jrjyr','khs','jzr',
      'brwkly','qrnbyt','kwsa','baznjan','krfs','bnjr',
      'ftrayshalghrab','zra','zrahlwa',
    ],
    fruit: [
      'mwz','tfah','brtqal','ywsfy','frawla','manjw',
      'anb','btykh','kaka','tynshwky','rman','jwafa',
      'tyn','blh','tmr','krz','twt',
    ],
    dairy: [
      // جبنة قريش/رومي/بيضاء - زبادي - لبن
      'jbnaqrysh','jbna_rwds_gwld','jbnarwmy','jbnabyda','jbnamlhkhfyf','jbnadmyaty',
      'jbnaastnbwly','jbnabramyly','jbnahlwm','jbnafyta','lbna',
      'jbnamwtzarylalayt','jbnashydrlayt','jbnashydr','jbnamwzaryla','jbnajwda',
      'jbnaaydam','jbnaflamnk','jbnaflfl','jbnakrymy','jbnadwblkrym',
      'jbnamthlthat','jbnamdkhna','jbnashll','jbnabarmyzan','jbnarykwta',
      'jbnashrahshydr','zbadytbyay','zbadyywnanylayt','zbadytbyay','zbadylayt',
      'lbnraybtbyay','zbadybalfakha','lbnkhalyaldsm','lbnkamlaldsm','hlybtbyaa',
      'hlybkhalyallaktwz','hlybmbkhr','hlyblwz','hlybjwzalhnd','hlybshwfan',
      'hlybswya','hlybarz','hlybmkthfmhla',
    ],
  };

  // ── Get all foods for a slot (filtered + sorted by logic) ──────────
  function _getFoodsForSlot(slotKey, query, catFilter) {
    const db = (typeof FOOD_DB !== 'undefined') ? FOOD_DB : [];
    const context = (typeof DE !== 'undefined') ? {
      diet: DE.selectedDiet || 'balanced',
      goal: DE.goal,
      health: DE.healthConditions || [],
      problems: DE.dietProblems || []
    } : {};
    const q = (query || '').toLowerCase().trim();

    return db
      .filter(f => {
        if (catFilter && catFilter !== 'all' && f.cat !== catFilter) return false;
        if (q) {
          const nameAr = (f.nameAr || '').toLowerCase();
          const nameEn = (f.id || '').toLowerCase();
          if (!nameAr.includes(q) && !nameEn.includes(q)) return false;
        }
        return true;
      })
      .map(f => {
        // ── Priority rank: كل ما كان في البداية في ال PRIORITY LIST كل ما ارتفع ──
        // ── الترتيب الحتمي: _FOOD_SORT_MAP أولا دايما ──────────
        const sortScore   = _getFoodSortScore(f.id);         // 0..N (أكبر = أول)
        // لو في query بحث: match bonus يضاف فوق ال sort score
        let matchBonus = 0;
        if (q) {
          const ar = (f.nameAr||'').toLowerCase()
            .replace(/[أإآ]/g,'ا').replace(/[ةه]/g,'ه').replace(/[يى]/g,'ي');
          if (ar === q)           matchBonus = 100000; // exact match يطلع فوق كل حاجة
          else if (ar.startsWith(q)) matchBonus = 50000;
          else                       matchBonus = 10000;
        }
        const priorityScore = sortScore + matchBonus;

        return {
          food: f,
          allowed: _isFoodAllowedForSlot(f, slotKey),
          score: priorityScore,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 80);
  }

  // ── Toggle food in a slot pool ────────────────────────────────────
  function smpsToggleFood(slotKey, foodId) {
    if (!SMPS.pool[slotKey]) SMPS.pool[slotKey] = new Set();
    const pool = SMPS.pool[slotKey];
    const isAdding = !pool.has(foodId);
    if (pool.has(foodId)) pool.delete(foodId);
    else pool.add(foodId);

    // مسح خانة البحث بعد الاختيار فورا
    if (isAdding) {
      const searchInput = document.querySelector('#smp-body-' + slotKey + ' .smp-food-search');
      if (searchInput && searchInput.value) {
        searchInput.value = '';
        SMPS.slotSearchQuery[slotKey] = '';
      }
    }

    _renderSlotFoodList(slotKey);
    _renderSlotPoolTags(slotKey);
    _renderSlotHeader(slotKey);
    _renderPoolSummary();
    _validateAndUpdateNav();
  }
  window.smpsToggleFood = smpsToggleFood;

  // ── Open/close slot accordion ─────────────────────────────────────
  function smpsToggleSlot(slotKey) {
    const body = document.getElementById('smp-body-' + slotKey);
    const chev = document.getElementById('smp-chev-' + slotKey);
    const card = document.getElementById('smp-card-' + slotKey);
    if (!body) return;
    const isOpen = body.classList.contains('open');
    // Close all first
    SMPS.slots.forEach(sk => {
      const b = document.getElementById('smp-body-' + sk);
      const c = document.getElementById('smp-chev-' + sk);
      const ca = document.getElementById('smp-card-' + sk);
      if (b) b.classList.remove('open');
      if (c) c.classList.remove('open');
      if (ca) ca.classList.remove('expanding');
    });
    if (!isOpen) {
      body.classList.add('open');
      if (chev) chev.classList.add('open');
      if (card) card.classList.add('expanding');
      SMPS.activeSlot = slotKey;
      _renderSlotFoodList(slotKey);
    } else {
      SMPS.activeSlot = null;
    }
  }
  window.smpsToggleSlot = smpsToggleSlot;

  // ── Category filter for a slot ────────────────────────────────────
  function smpsClearPool(slotKey) {
    SMPS.pool[slotKey] = new Set();
    _renderSlotFoodList(slotKey);
    _renderSlotPoolTags(slotKey);
    // update count badge
    const countEl = document.getElementById('smp-count-' + slotKey);
    if (countEl) {
      countEl.textContent = 'لم تختر بعد';
      countEl.className = 'smp-slot-count empty';
    }
    const cardEl = document.getElementById('smp-card-' + slotKey);
    if (cardEl) cardEl.className = 'smp-slot-card';
  }
  window.smpsClearPool = smpsClearPool;

  function smpsSetCat(slotKey, cat, btn) {
    SMPS.slotCatFilter[slotKey] = cat;
    // Update pill UI
    const pills = document.querySelectorAll('#smp-cats-' + slotKey + ' .smp-cat-pill');
    pills.forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    _renderSlotFoodList(slotKey);
    // ── reset scroll لأعلى ال list عند كل تغيير category ──
    requestAnimationFrame(() => {
      const listEl = document.getElementById('smp-list-' + slotKey);
      if (listEl) listEl.scrollTop = 0;
      // scroll ال list نفسه للأعلى لو في overflow
      const bodyEl = document.getElementById('smp-body-' + slotKey);
      if (bodyEl) bodyEl.scrollTop = 0;
    });
  }
  window.smpsSetCat = smpsSetCat;

  // ── Search within slot ────────────────────────────────────────────
  function smpsSearch(slotKey, val) {
    SMPS.slotSearchQuery[slotKey] = val;
    _renderSlotFoodList(slotKey);
  }
  window.smpsSearch = smpsSearch;

  // ── Render the food list rows inside a slot ───────────────────────
  function _renderSlotFoodList(slotKey) {
    const el = document.getElementById('smp-list-' + slotKey);
    if (!el) return;
    const pool = SMPS.pool[slotKey] || new Set();
    const q = SMPS.slotSearchQuery[slotKey] || '';
    const cat = SMPS.slotCatFilter[slotKey] || 'all';
    const items = _getFoodsForSlot(slotKey, q, cat);
    if (!items.length) {
      el.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-dim);font-size:12px;">لا توجد أطعمة مطابقة</div>';
      return;
    }
    el.innerHTML = items.map(({food, allowed}) => {
      const inPool = pool.has(food.id);
      const blocked = !allowed.ok;
      return `<div class="smp-food-row${blocked ? ' blocked' : ''}${inPool ? ' selected-in-pool' : ''}"
          onclick="${blocked ? '' : `smpsToggleFood('${slotKey}','${food.id}')`}"
          title="${blocked ? allowed.reason : ''}">
        <div class="smp-fr-check">${inPool ? '✓' : ''}</div>
        <div class="smp-fr-name">${food.nameAr || food.id}</div>
        <div class="smp-fr-macros">${food.cal}ك | ${food.pro}ب | ${food.carb}ك | ${food.fat}د</div>
        ${blocked ? `<div class="smp-fr-block-reason">${allowed.reason}</div>` : ''}
      </div>`;
    }).join('');
  }

  // ── Render pool tags (removable pills) ───────────────────────────
  function _renderSlotPoolTags(slotKey) {
    const el = document.getElementById('smp-tags-' + slotKey);
    if (!el) return;
    const pool = SMPS.pool[slotKey] || new Set();
    if (!pool.size) {
      el.innerHTML = '<span style="color:var(--text-dim);font-size:11px;padding:4px 0;">لم تختر أطعمة بعد — ابحث وأضف أعلاه</span>';
      return;
    }
    const db = (typeof FOOD_MAP !== 'undefined' && FOOD_MAP.get) ? null : (typeof FOOD_DB !== 'undefined' ? FOOD_DB : []);
    el.innerHTML = [...pool].map(id => {
      const food = (typeof FOOD_MAP !== 'undefined' && FOOD_MAP.get) ? FOOD_MAP.get(id) : (db ? db.find(f => f.id === id) : null);
      const name = food ? (food.nameAr || id) : id;
      return `<span class="smp-pool-tag" onclick="smpsToggleFood('${slotKey}','${id}')" title="اضغط لإزالة">
        ${name} <span class="rm">✕</span>
      </span>`;
    }).join('');
  }

  // ── Render slot header count badge ───────────────────────────────
  function _renderSlotHeader(slotKey) {
    const el = document.getElementById('smp-count-' + slotKey);
    const card = document.getElementById('smp-card-' + slotKey);
    if (!el) return;
    const cnt = (SMPS.pool[slotKey] || new Set()).size;
    el.textContent = cnt ? cnt + ' طعام ✓' : 'لم تختر بعد';
    el.className = 'smp-slot-count' + (cnt ? ' filled' : ' empty');
    if (card) card.className = 'smp-slot-card' + (cnt >= SLOT_META[slotKey].minFoods ? ' has-foods' : '');
  }

  // ── Render pool summary badges ────────────────────────────────────
  function _renderPoolSummary() {
    const el = document.getElementById('smps-pool-summary');
    if (!el) return;
    el.innerHTML = SMPS.slots.map(sk => {
      const cnt = (SMPS.pool[sk] || new Set()).size;
      const meta = SLOT_META[sk] || {};
      const ok = cnt >= meta.minFoods;
      return `<div class="smps-pool-badge${ok ? ' filled' : ''}">
        ${meta.icon} ${meta.label}: <strong>${cnt}</strong>
        ${ok ? '✓' : `/ ${meta.minFoods} مطلوب`}
      </div>`;
    }).join('');
  }

  // ── Validate all slots and update nav button ──────────────────────
  function _validateAndUpdateNav() {
    const el = document.getElementById('smps-validation-bar');
    const btn = document.getElementById('smps-next-btn');
    if (!el) return;
    let allOk = true;
    let html = '';
    SMPS.slots.forEach(sk => {
      const cnt = (SMPS.pool[sk] || new Set()).size;
      const meta = SLOT_META[sk] || {};
      const ok = cnt >= meta.minFoods;
      if (!ok) allOk = false;
      const cls = ok ? 'ok' : (cnt > 0 ? 'warn' : 'err');
      html += `<div class="smp-val-item ${cls}">
        ${ok ? '' : cnt > 0 ? '' : ''}
        ${meta.icon} ${meta.label}: ${cnt} / ${meta.minFoods} أطعمة مطلوبة
        ${ok ? '' : `<span style="font-size:10px;opacity:0.7;"> — أضف ${meta.minFoods - cnt} أكثر</span>`}
      </div>`;
    });
    el.innerHTML = html;
    if (btn) {
      btn.disabled = !allOk;
      btn.style.opacity = allOk ? '1' : '0.5';
      btn.style.cursor = allOk ? 'pointer' : 'not-allowed';
    }
  }

  // ── Render all slot cards ─────────────────────────────────────────
  function _renderSlots() {
    const container = document.getElementById('smps-slots-container');
    if (!container) return;
    container.innerHTML = SMPS.slots.map(sk => {
      const meta = SLOT_META[sk] || { icon:'', label:sk, desc:'', minFoods:3 };
      const catOptions = [
        {k:'all',l:'الكل'},{k:'protein',l:'بروتين'},{k:'carb',l:'كارب'},
        {k:'fat',l:'دهون'},{k:'veggie',l:'خضار'},{k:'fruit',l:'فاكهة'},
        {k:'dairy',l:'ألبان'},{k:'snack',l:'سناك'}
      ];
      return `
      <div class="smp-slot-card" id="smp-card-${sk}">
        <div class="smp-slot-header" onclick="smpsToggleSlot('${sk}')">
          <div class="smp-slot-icon">${meta.icon}</div>
          <div class="smp-slot-info">
            <div class="smp-slot-title">${meta.label}</div>
            <div class="smp-slot-sub">${meta.desc}</div>
          </div>
          <div class="smp-slot-count empty" id="smp-count-${sk}">لم تختر بعد</div>
          <div class="smp-slot-chevron" id="smp-chev-${sk}">▼</div>
        </div>
        <div class="smp-slot-body" id="smp-body-${sk}">
          <!-- Cat pills -->
          <div class="smp-cat-pills" id="smp-cats-${sk}">
            ${catOptions.map((c,i) => `<button class="smp-cat-pill${i===0?' active':''}"
              onclick="smpsSetCat('${sk}','${c.k}',this)">${c.l}</button>`).join('')}
          </div>
          <!-- Search -->
          <div class="smp-food-search-wrap">
            <input class="smp-food-search" type="text" placeholder="ابحث باسم الطعام..."
              oninput="smpsSearch('${sk}',this.value)" autocomplete="off">
          </div>
          <!-- Food list -->
          <div class="smp-food-list" id="smp-list-${sk}"></div>
          <!-- Pool tags -->
          <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:11.5px;font-weight:800;color:var(--text-muted);">أطعمة البول (${meta.minFoods}+ مطلوب):</span>
            <button onclick="smpsClearPool('${sk}')"
              style="font-size:10.5px;padding:3px 9px;border-radius:6px;border:1px solid rgba(232,76,76,0.35);
                     background:rgba(232,76,76,0.07);color:var(--red);cursor:pointer;font-weight:700;">
             حذف الكل
            </button>
          </div>
          <div class="smp-pool-tags" id="smp-tags-${sk}">
            <span style="color:var(--text-dim);font-size:11px;padding:4px 0;">لم تختر أطعمة بعد</span>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ═══════════════════════════════════════════════════════
  //  POOL - DAY GENERATOR ENGINE
  //  Picks foods from pool per slot, optimises for macros
  // ═══════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════
  //  v33 — SMART MEAL ENGINE (SME)
  //  خبير تغذية + مبرمج سنيور
  //  المنطق:
  //   1. كل يوم = seed مختلف - تنوع حقيقي
  //   2. كل وجبة = بروتين رئيسي + كارب + دهون + خضار (حسب نوع الدايت)
  //   3. تدوير ذكي: نفس الأكل مايتكررش في نفس الأسبوع
  //   4. الكميات محسوبة من الماكروز الفعلية مش عشوائية
  //   5. الفاكهة للسناك وقبل التمرين فقط
  //   6. الدهون تيجي بعد البروتين والكارب دايما
  // ═══════════════════════════════════════════════════════════════════

  // ── Seeded RNG ──────────────────────────────────────────────────────────────
  function _makeRng(seed) {
    let s = seed | 0;
    return {
      next() { s = (s * 1664525 + 1013904223) & 0xffffffff; return Math.abs(s) / 0x100000000; },
      int(n)  { return Math.floor(this.next() * n); },
      pick(arr) { return arr[this.int(arr.length)]; },
      shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = this.int(i + 1);
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }
    };
  }

  // ── Diet-aware meal template ─────────────────────────────────────────
  // لكل نوع دايت وكل وجبة: نسب الماكروز والأولويات
  const _DIET_MEAL_RULES = {
    balanced: {
      // النسب النسبية لكل وجبة (يتم تطبيعها تلقائيا حسب الوجبات الموجودة)
      // المجموع أكبر من 1 عمدا — الكود بينرملز على الوجبات الموجودة فعلا
      calSplit: { breakfast:0.25, lunch:0.35, dinner:0.25, snack:0.10, pre:0.18, post:0.22 },
      slotRules: {
        breakfast: { protein:1, carb:1, fat:0.5, veggie:0 , dairy:1  },
        lunch:     { protein:1, carb:1, fat:0.3, veggie:1 , dairy:0.3 },
        dinner:    { protein:1, carb:0.5, fat:0.3, veggie:1, dairy:0.3 },
        snack:     { protein:0.5, carb:0, fat:0.3, veggie:0, dairy:1, fruit:1 },
        pre:       { protein:0.5, carb:1, fat:0, veggie:0, fruit:0.7 },
        post:      { protein:1, carb:1, fat:0, veggie:0.3 },
      }
    },
    lowcarb: {
      calSplit: { breakfast:0.25, lunch:0.35, dinner:0.27, snack:0.08, pre:0.15, post:0.20 },
      slotRules: {
        breakfast: { protein:1, carb:0.2, fat:0.8, veggie:0.5, dairy:1 },
        lunch:     { protein:1, carb:0.2, fat:0.6, veggie:1   },
        dinner:    { protein:1, carb:0.1, fat:0.5, veggie:1   },
        snack:     { protein:1, fat:0.5, dairy:1              },
        pre:       { protein:0.8, carb:0.3, fat:0.3           },
        post:      { protein:1, carb:0.3, fat:0.2             },
      }
    },
    keto: {
      calSplit: { breakfast:0.25, lunch:0.35, dinner:0.28, snack:0.05, pre:0.10, post:0.15 },
      slotRules: {
        breakfast: { protein:1, fat:1, veggie:0.5, dairy:0.8 },
        lunch:     { protein:1, fat:1, veggie:1               },
        dinner:    { protein:1, fat:1, veggie:1               },
        snack:     { protein:0.5, fat:1                       },
        pre:       { protein:0.8, fat:0.5                     },
        post:      { protein:1, fat:0.3                       },
      }
    },
    carnivore: {
      calSplit: { breakfast:0.25, lunch:0.40, dinner:0.30, snack:0.05, pre:0.10, post:0.20 },
      slotRules: {
        breakfast: { protein:1, fat:0.5 },
        lunch:     { protein:1, fat:0.5 },
        dinner:    { protein:1, fat:0.5 },
        snack:     { protein:1          },
        pre:       { protein:1          },
        post:      { protein:1          },
      }
    },
    carbcycle: {
      // تعدل ديناميكيا حسب training/rest day
      calSplit: { breakfast:0.25, lunch:0.32, dinner:0.22, snack:0.08, pre:0.18, post:0.22 },
      slotRules: {
        breakfast: { protein:1, carb:1, fat:0.3, dairy:0.5 },
        lunch:     { protein:1, carb:1, fat:0.3, veggie:1  },
        dinner:    { protein:1, carb:0.3, fat:0.5, veggie:1 },
        snack:     { protein:0.5, fruit:0.8, dairy:1        },
        pre:       { protein:0.5, carb:1, fruit:0.5         },
        post:      { protein:1, carb:1                      },
      }
    },
    mediterranean: {
      // البحر المتوسط: خضار وفاكهة وبقوليات يوميا، زيت زيتون، سمك متكرر، دهون صحية معتدلة-عالية
      calSplit: { breakfast:0.25, lunch:0.35, dinner:0.25, snack:0.10, pre:0.16, post:0.20 },
      slotRules: {
        breakfast: { protein:1, carb:1, fat:0.6, veggie:0.5, dairy:1, fruit:0.5 },
        lunch:     { protein:1, carb:1, fat:0.6, veggie:1 },
        dinner:    { protein:1, carb:0.6, fat:0.6, veggie:1 },
        snack:     { protein:0.5, fat:0.5, dairy:1, fruit:1 },
        pre:       { protein:0.5, carb:1, fruit:0.7 },
        post:      { protein:1, carb:1, veggie:0.3 },
      }
    },
  };

  // ── Gram limits per food density ─────────────────────────────────────
  function _gramLimit(food) {
    if (['olive_oil','coconut_oil','butter','ghee'].includes(food.id)) return 20;
    if (['peanut_butter','almond_butter','tahini'].includes(food.id)) return 30;
    if (['almonds','cashews','mixed_nuts','pistachios'].includes(food.id)) return 40;
    if (food.cat === 'fat') return 35;
    if (food.cat === 'fruit') return 200;
    if (food.cat === 'veggie') return 200;
    if (food.cat === 'dairy') return 250;
    if (food.cat === 'snack' && food.cal > 400) return 60;
    return 350;
  }

  // ── Pick foods for one meal slot from pool ───────────────────────────
  // dayHistory = Set of foodIds already used today (for same-day variation)
  // weekHistory = Map<foodId, daysAgo> for weekly rotation
  // ���═ v40 — MEAL COMPOSITION BRAIN (خبير تغذية + مبرمج) — لكل الأنظمة ══
  // يبدأ من بول العميل، يكمل الناقص من الداتا، يحترم الأكل المصري المتداول + الصحي + نوع الدايت + تراكب العناصر.
  // الدهون التتبيلة (طحينة/عسل/زيت/زبدة) تتحط + جنب عنصر مناسب في نفس السطر مش كعنصر منفصل.

  function _isCondimentFat(f){
    if(!f) return false;
    var id=String(f.id||''); var nm=String(f.nameAr||f.id||'');
    if(/^zyt|^smn|smnbldy|thyna|smsm|zbd|honey|nutella|gullash_cream|ketchup|soy_sauce/i.test(id)) return true;
    if(/طحين|سمسم|زبدة|سمن|عسل|مرب|نوتيلا|كاتشب|صلصة|زيت(?!ون)/.test(nm)) return true;
    return false;
  }

  // أكل مصري متداول لعامة المصرين (حسب قائمة العميل) — بدون شوفان/رومي/بروكلي/أفوكادو
  function _isCommonEgyId(f){
    var nm=String((f&&f.nameAr)||'');
    return /بيض|جبن|قريش|فول|طعمية|عيش|خبز|توست|رايس كيك|أرز|رز|بسمتي|فراخ|صدر|ورك|بط|تونة|بلطي|بلاميط|ماكريل|سمك|بوري|قاروص|دنيس|سردين|سلمون|بطاطس|بطاطا|كبد|لحم|كفتة|كباب|زبادي|لبن|سلطة|طماطم|خيار|جرجير|خس|بصل|مكرون|عدس|فاصوليا|لوبيا|بامية|كوسة|ملوخية|بسلة|بسله|جزر|حمص|خضار/.test(nm);
  }

  // تقييم مدى مناسبة الصنف للوجبة حسب العرف المصري
  function _egySlotScore(f, slot){
    if(!f) return 0;
    var c=f.cat, nm=String(f.nameAr||''), s=0;
    // عناصر مش متداولة — تقليل (مش منع)
    if(c==='protein' && /رومي|تركي|حمام|سمان|أرنب|جمل|طحال|مخ|كلاوي|كوارع|كرشة|عكاوي|بسطرمة|كاليماري|سبيط|كابوريا/.test(nm)) s-=45;
    if(/شوفان/.test(nm)) s-=40;
    if(/بروكلي|أفوكادو/.test(nm)) s-=70;
    if(slot==='breakfast'){
      if(c==='protein'){ s += /بيض/.test(nm) ? 70 : -450; }
      else if(c==='dairy') s+=55;
      else if(c==='carb'){
        if(/فول/.test(nm)) s+=60;
        else if(/عيش|خبز|توست|فينو|بان كيك|رايس كيك|بطاطس|بطاطا/.test(nm)) s+=45;
        else if(/عدس/.test(nm)) s-=350;
        else if(/أرز|رز|مكرون|كشري|برغل|فريك|شعير|قمح|بامية|كوسة|ملوخية|محشي|بنجر|سبانخ|باذنجان|بسلة|فاصوليا|لوبيا|حمص/.test(nm)) s-=300;
        else s-=120;
      }
      else if(c==='fruit') s+=20;
      else if(c==='veggie') s+=8;
    } else if(slot==='lunch' || slot==='dinner'){
      if(c==='protein') s+=45;
      else if(c==='veggie') s+=28;
      else if(c==='carb'){
        if(/أرز|رز|مكرون|عيش|بطاطس|كشري|ملوخية|بامية|كوسة|فاصوليا|لوبيا|بسلة|محشي|خضار/.test(nm)) s += (slot==='dinner'?14:30);
        else if(/عدس|فول/.test(nm)) s += (slot==='lunch'?8:0);
      }
      else if(c==='fruit') s -= (slot==='dinner'?140:50);
      else if(c==='dairy') s += (slot==='dinner'?18:-30);
    } else if(slot==='snack'){
      if(c==='fruit'||c==='dairy') s+=45;
      else if(c==='snack') s+=22;
      else if(c==='protein'){ s += /بيض/.test(nm) ? 10 : -220; }
      else if(c==='carb') s-=160;
      else if(c==='veggie') s-=40;
    } else if(slot==='pre'){
      if(c==='fruit'||c==='carb') s+=25; else if(c==='protein') s+=10;
    } else if(slot==='post'){
      if(c==='protein') s+=45; else if(c==='carb') s+=30; else if(c==='fruit') s+=15;
    }
    if(_isCommonEgyId(f)) s+=22;
    return s;
  }

  // إكمال عنصر ناقص من قاعدة البيانات (مصري شائع + صحي + مناسب للوجبة)
  function _pickFromDB(cat, slotKey, rng, exclude){
    if(typeof FOOD_DB==='undefined') return null;
    var cands=FOOD_DB.filter(function(f){
      if(f.cat!==cat) return false;
      if(exclude && exclude.has(f.id)) return false;
      if(_isCondimentFat(f)) return false;
      if(Array.isArray(f.mealTypes) && f.mealTypes.length && !f.mealTypes.includes(slotKey)) return false;
      if(typeof isFoodAllowed==='function'){ var c=isFoodAllowed(f); if(c && c.ok===false) return false; }
      if(_egySlotScore(f, slotKey) <= -250) return false; // غير مناسب تماما للوجبة (مثل عدس/رز فطار)
      // v53: استبعاد الغالي/غير المتداول من التوليد التلقائي (مع احترام اختيار المستخدم)
      if(typeof EGY_AFFORD!=='undefined' && EGY_AFFORD.autoBlocked(f)) return false;
      return true;
    });
    if(!cands.length) return null;
    // ── ترتيب الأرز حسب النظام: البني مفضل فقط في البحر المتوسط ──
    // في المتوازن/اللوكارب/الكارب سايكل: الأبيض والبسمتي مش عيب ويسبقوا البني
    var _pdiet=(typeof DE!=='undefined'&&DE.selectedDiet)||'balanced';
    function _riceAdj(f){
      var id=String((f&&f.id)||'');
      // الزبادي الطبيعي من أكثر الألبان المصرية شيوعا وصحة — يبقى في المقدمة
      if(id==='zbadytbyay'||id==='zbadylayt'||id==='zbadytbyay'||id==='zbadyywnanylayt') return 7;
      // الفطار المصري: قريش + جبنة بيضاء + زبادي أفضل من الفول — نرفع ترتيب الجبن/الزبادي وننزل الفول بسيط
      if(slotKey==='breakfast'){
        if(id==='jbnaqrysh') return 11;
        if(id==='jbna_rwds_gwld') return 10;
        if(id==='jbnabyda') return 9;
        if(id==='fwlmdms') return -4;
      }
      if(_pdiet==='mediterranean'){ return (id==='arzbnymtbwkh'||id==='ayshasmr'||id==='rayskykbny')?5:0; }
      if(id==='arzabydmtbwkh'||id==='arzbsmtymtbwkh') return 8;
      if(id==='arzbnymtbwkh') return -5;
      return 0;
    }
    cands.sort(function(a,b){
      var sa=(a.healthyScore||5)+(_isCommonEgyId(a)?6:0)-(a.processedLevel==='high'?5:0)-(a.processedLevel==='medium'?2:0)+_egySlotScore(a,slotKey)*0.25+_riceAdj(a);
      var sb=(b.healthyScore||5)+(_isCommonEgyId(b)?6:0)-(b.processedLevel==='high'?5:0)-(b.processedLevel==='medium'?2:0)+_egySlotScore(b,slotKey)*0.25+_riceAdj(b);
      return sb-sa;
    });
    var top=cands.slice(0, Math.min(5,cands.length));
    return top[(rng?rng.int(top.length):0)] || top[0];
  }

  // قواعد تراكب التتبيلة مع العنصر الأساس (base تاخد food object)
  function _condimentRules(){
    return [
      { match:function(f){return /طحين/.test(f.nameAr);},
        base:function(fd){return /مشوي|سمك|بلطي|بلاميط|ماكريل|تونة|فراخ|صدر|ورك|كفت|كباب|لحم|ريش/.test(fd.nameAr) || fd.cat==='veggie' || /سلطة|فول/.test(fd.nameAr);},
        slots:['lunch','dinner','breakfast'], grams:15 },
      { match:function(f){return /عسل|مرب/.test(f.nameAr);},
        base:function(fd){return /توست|عيش|خبز|بان كيك|رايس كيك|فينو/.test(fd.nameAr);},
        slots:['breakfast','snack'], grams:15 },
      { match:function(f){return /زبدة فول|زبدة لوز|زبدة كاجو|زبدة بندق/.test(f.nameAr);},
        base:function(fd){return /توست|عيش|خبز|رايس كيك|فينو/.test(fd.nameAr);},
        slots:['breakfast','snack'], grams:15 },
      { match:function(f){return /زيت(?!ون)/.test(f.nameAr);},
        base:function(fd){return fd.cat==='veggie' || /سلطة|جبن|فول/.test(fd.nameAr);},
        slots:['breakfast','lunch','dinner'], grams:10 },
      { match:function(f){return /^زبدة$|زبدة بلدي|سمن/.test(f.nameAr);},
        base:function(fd){return /أومليت|بيض|توست|عيش/.test(fd.nameAr);},
        slots:['breakfast'], grams:8 },
    ];
  }

  // يحط تتبيلة واحدة + جنب عنصر مناسب في نفس السطر (دمج الاسم + الماكروز)
  function _attachCondiment(selected, slotKey, diet, rng, poolFoods){
    if(!selected.length) return;
    var rules=_condimentRules();
    for(var r=0;r<rules.length;r++){
      var rule=rules[r];
      if(rule.slots.indexOf(slotKey)<0) continue;
      var baseItem=null;
      for(var i=0;i<selected.length;i++){ if(!selected[i]._addon && selected[i].food && rule.base(selected[i].food)){ baseItem=selected[i]; break; } }
      if(!baseItem) continue;
      var cond=null;
      for(var j=0;j<poolFoods.length;j++){ if(rule.match(poolFoods[j])){ cond=poolFoods[j]; break; } }
      if(!cond && typeof FOOD_DB!=='undefined'){
        var dbc=FOOD_DB.filter(function(f){ return rule.match(f) && (typeof isFoodAllowed!=='function' || (isFoodAllowed(f)||{}).ok!==false) && !(typeof EGY_AFFORD!=='undefined' && EGY_AFFORD.autoBlocked(f)); });
        if(dbc.length) cond=dbc[(rng?rng.int(dbc.length):0)]||dbc[0];
      }
      if(!cond) continue;
      var g=rule.grams, addCals=Math.round((cond.cal||0)*g/100);
      if(addCals<5) continue;
      var baseName=(baseItem.food&&baseItem.food.nameAr)||'';
      // عرض التبيلة: ( X جرام الأكل ) + ( Y جرام التبيلة )
      var formattedName='( '+baseItem.grams+' جرام '+baseName+' ) + ( '+g+' جرام '+(cond.nameAr||'')+' )';
      var newFood=Object.assign({}, baseItem.food, { nameAr: formattedName });
      baseItem.food=newFood;
      baseItem._hasCondiment=true;
      baseItem.cals += addCals;
      baseItem.pro  = +((baseItem.pro||0)+(cond.pro||0)*g/100).toFixed(1);
      baseItem.carb = +((baseItem.carb||0)+(cond.carb||0)*g/100).toFixed(1);
      baseItem.fat  = +((baseItem.fat||0)+(cond.fat||0)*g/100).toFixed(1);
      baseItem._addon=true;
      return; // تتبيلة واحدة كفاية
    }
  }

  // === v50 EGYPTIAN MEAL TEMPLATE BRAIN (L1 templates / L2 resolver / L3 portion / L4 audit) ===
  function _v50Season(){ var m=(new Date()).getMonth(); return (m>=3 && m<=9) ? 'summer' : 'winter'; }
  var _V50_SEASON_FRUIT={ summer:['btykh','shmam','manjw','anb','khwkh','mshmsh','tyn','tynshwky'], winter:['brtqal','ywsfy','jwafa','kmthra','rman','frawla','kaka'] };
  function _v50SeasonFruit(){ var s=_v50Season(); var l=(_V50_SEASON_FRUIT[s]||[]).slice(); return l.concat(['mwz','tfah','brtqal']); }
  var _V50_COMPANION={ oil:{ids:['zytzytwn'],g:10,baseK:['veg','dairy','protein','carb','breadcarb','lightcarb']}, tahini:{ids:['thyna'],g:15,baseK:['protein','veg','carb','breadcarb']}, honey:{ids:['honey_natural'],g:15,baseK:['breadcarb','dairy','fruit']}, pb:{ids:['zbdafwlswdany'],g:15,baseK:['breadcarb']} };
  var _EGY_TEMPLATES={
    breakfast:[
      {id:'bf_fool_egg',diets:['balanced','lowcarb','carbcycle'],companion:'oil',comps:[{k:'carb',ids:['fwlmdms']},{k:'protein',ids:['byd_mslwq','byd_awmlyt']},{k:'dairy',ids:['jbnabyda','jbnaqrysh','jbnarwmy']},{k:'breadcarb',ids:['ayshbldy','ayshasmr','twstabyd']},{k:'veg',ids:['khyar','tmatm']}]},
      {id:'bf_egg_potato',diets:['balanced','carbcycle'],companion:'oil',comps:[{k:'protein',ids:['byd_awmlyt','byd_mslwq']},{k:'carb',ids:['btatsmslwqa','btatsmshwya']},{k:'dairy',ids:['jbnabyda','jbnaqrysh']},{k:'veg',ids:['tmatm','khyar']}]},
      {id:'bf_tuna_bread',diets:['balanced','lowcarb','carbcycle'],companion:'oil',comps:[{k:'protein',ids:['qta_twna_balzyt','twna_myah']},{k:'breadcarb',ids:['ayshbldy','ayshasmr','twstabyd']},{k:'veg',ids:['khyar','tmatm','khs']}]},
      {id:'bf_yogurt_fruit',diets:['balanced','lowcarb','carbcycle'],companion:'honey',comps:[{k:'dairy',ids:['zbadytbyay','zbadytbyay']},{k:'fruit',ids:'SEASON'},{k:'nut',ids:['swdany_mhms','jwz']}]},
      {id:'bf_keto_egg',diets:['keto','carnivore'],companion:'oil',comps:[{k:'protein',ids:['byd_awmlyt','byd_mslwq']},{k:'dairy',ids:['jbnarwmy','jbnabyda']},{k:'veg',ids:['khyar','tmatm']}]}
    ],
    lunch:[
      {id:'ln_chicken_rice',diets:['balanced','carbcycle'],companion:'oil',comps:[{k:'protein',ids:['sdr_frakh_mshwy','wrk_frakh_mshwy']},{k:'carb',ids:['arzabydmtbwkh','arzbsmtymtbwkh']},{k:'veg',ids:['khyar','tmatm','jrjyr','khs','flfl']}]},
      {id:'ln_meat_potato',diets:['balanced','carbcycle'],companion:'oil',comps:[{k:'protein',ids:['lhm_bqry_mslwq','lhm_mfrwm_bqry_qlyl_aldhn']},{k:'carb',ids:['btatsmslwqa','arzabydmtbwkh']},{k:'veg',ids:['jzr','kwsa','tmatm','khyar']}]},
      {id:'ln_kofta_bread',diets:['balanced','carbcycle'],companion:'tahini',comps:[{k:'protein',ids:['kfta_mshwya_ala_alfhm','kbab_mshwy']},{k:'breadcarb',ids:['ayshbldy','ayshasmr']},{k:'veg',ids:['tmatm','khyar','jrjyr','bsl']}]},
      {id:'ln_fish_rice',diets:['balanced','carbcycle'],companion:'tahini',comps:[{k:'protein',ids:['blty_mshwy','bwry_mshwy','smk_mwsa_mshwy']},{k:'carb',ids:['arzabydmtbwkh','arzbsmtymtbwkh']},{k:'veg',ids:['khs','tmatm','khyar','jrjyr']}]},
      {id:'ln_lowcarb_chicken',diets:['lowcarb'],companion:'oil',comps:[{k:'protein',ids:['sdr_frakh_mshwy','wrk_frakh_mshwy']},{k:'veg',ids:['khs','khyar','tmatm','jrjyr','flfl']},{k:'lightcarb',ids:['btatsmslwqa']}]},
      {id:'ln_keto_meat',diets:['keto','carnivore'],companion:'oil',comps:[{k:'protein',ids:['lhm_bqry_mslwq','sdr_frakh_mshwy','blty_mshwy']},{k:'veg',ids:['khs','khyar','flfl']}]}
    ],
    dinner:[
      {id:'dn_egg_light',diets:['balanced','lowcarb','carbcycle'],companion:'oil',comps:[{k:'protein',ids:['byd_mslwq','byd_awmlyt']},{k:'dairy',ids:['jbnaqrysh','jbnabyda']},{k:'breadcarb',ids:['ayshbldy','ayshasmr']},{k:'veg',ids:['khyar','tmatm']}]},
      {id:'dn_tuna',diets:['balanced','lowcarb','carbcycle'],companion:'oil',comps:[{k:'protein',ids:['twna_myah','qta_twna_balzyt']},{k:'veg',ids:['khs','khyar','tmatm','jrjyr']},{k:'lightcarb',ids:['ayshasmr','btatsmslwqa']}]},
      {id:'dn_chicken_veg',diets:['balanced','carbcycle'],companion:'oil',comps:[{k:'protein',ids:['sdr_frakh_mshwy','wrk_frakh_mshwy']},{k:'veg',ids:['kwsa','jzr','tmatm','khyar']},{k:'lightcarb',ids:['arzabydmtbwkh','ayshbldy']}]},
      {id:'dn_yogurt',diets:['balanced','lowcarb','carbcycle'],companion:'oil',comps:[{k:'dairy',ids:['zbadytbyay','zbadytbyay']},{k:'breadcarb',ids:['ayshasmr']},{k:'veg',ids:['khyar','tmatm']}]},
      {id:'dn_keto',diets:['keto','carnivore'],companion:'oil',comps:[{k:'protein',ids:['blty_mshwy','sdr_frakh_mshwy','lhm_bqry_mslwq']},{k:'veg',ids:['khs','khyar']}]}
    ],
    snack:[
      {id:'sn_yogurt_fruit',diets:['balanced','lowcarb','carbcycle'],companion:'honey',comps:[{k:'dairy',ids:['zbadytbyay','zbadytbyay']},{k:'fruit',ids:'SEASON'}]},
      {id:'sn_fruit_nut',diets:['balanced','lowcarb','carbcycle'],comps:[{k:'fruit',ids:'SEASON'},{k:'nut',ids:['swdany_mhms','jwz','lwz_mhms']}]},
      {id:'sn_dark_choc',diets:['balanced','lowcarb','keto','carbcycle'],comps:[{k:'sweet',ids:['dark_choc']},{k:'nut',ids:['swdany_mhms']}]},
      {id:'sn_keto_nut',diets:['keto','carnivore'],comps:[{k:'nut',ids:['lwz_mhms','jwz','swdany_mhms']},{k:'dairy',ids:['jbnarwmy']}]}
    ],
    pre:[
      {id:'pr_sweetpotato',diets:['balanced','carbcycle','lowcarb'],companion:'honey',comps:[{k:'carb',ids:['btatamshwya','btatamslwqa']}]},
      {id:'pr_banana_honey',diets:['balanced','carbcycle'],comps:[{k:'fruit',ids:['mwz']},{k:'sweet',ids:['tmr','honey_natural']}]},
      {id:'pr_toast_pb',diets:['balanced','carbcycle','lowcarb'],companion:'pb',comps:[{k:'breadcarb',ids:['twstabyd','ayshbldy']}]},
      {id:'pr_yogurt',diets:['balanced','lowcarb','carbcycle'],comps:[{k:'dairy',ids:['zbadytbyay','zbadytbyay']},{k:'fruit',ids:'SEASON'}]},
      {id:'pr_keto',diets:['keto','carnivore'],comps:[{k:'protein',ids:['byd_mslwq']},{k:'nut',ids:['lwz_mhms']}]}
    ],
    post:[
      {id:'po_chicken_rice',diets:['balanced','carbcycle','lowcarb'],comps:[{k:'protein',ids:['sdr_frakh_mshwy','banyh_mshwy']},{k:'carb',ids:['arzabydmtbwkh','btatamshwya']}]},
      {id:'po_egg_banana',diets:['balanced','carbcycle'],comps:[{k:'protein',ids:['byd_mslwq','byad_byd']},{k:'fruit',ids:['mwz']}]},
      {id:'po_keto',diets:['keto','carnivore'],comps:[{k:'protein',ids:['sdr_frakh_mshwy','byd_mslwq']}]}
    ]
  };
  function _v50FoodOk(f){ if(!f) return false; if(typeof isFoodAllowed==='function'){ var c=isFoodAllowed(f); if(c && c.ok===false) return false; } return true; }
  function _v50Max(f){ var id=String(f.id||''); var cat=f.cat; if(/^byd|^byad/.test(id)) return 150; if(/twna/.test(id)) return 150; if(cat==='protein') return 250; if(cat==='dairy'){ var cl=f.cal||0; if(cl>=300) return 90; if(cl>=200) return 140; return 250; } if(cat==='fat') return 35; if(cat==='fruit') return 200; if(cat==='veg'||cat==='veggie') return 150; if(cat==='carb') return 350; return 300; }
  function _v50AddOil(items, kcal){ if(kcal<10) return; var cf=(typeof FOOD_MAP!=='undefined')?FOOD_MAP.get('zytzytwn'):null; if(!cf||!cf.cal) return; var g=Math.min(35, Math.max(5, Math.round(kcal/cf.cal*100/5)*5)); var base=null; for(var i=0;i<items.length;i++){ if(items[i].food.cat==='protein'||items[i].food.cat==='dairy'){ base=items[i]; break; } } if(!base) base=items[0]; if(!base) return; base.cals+=Math.round(cf.cal*g/100); base.fat=+((base.fat||0)+cf.fat*g/100).toFixed(1); base._addon=true; }
  function _v50CompCats(k){
    if(k==='protein') return ['protein'];
    if(k==='carb'||k==='breadcarb'||k==='lightcarb') return ['carb'];
    if(k==='dairy') return ['dairy'];
    if(k==='fruit') return ['fruit'];
    if(k==='veg') return ['veg','veggie'];
    if(k==='nut') return ['fat'];
    if(k==='sweet') return ['snack'];
    return [];
  }
  function _v50PickId(comp, rng, dayHistory, weekHistory, poolSet){
    var ids = (comp.ids==='SEASON') ? _v50SeasonFruit() : comp.ids.slice();
    var poolPref = ids.filter(function(id){ return poolSet && poolSet.has(id); });
    var extra = [];
    if(poolSet && poolSet.size && typeof FOOD_MAP!=='undefined'){
      var okCats = _v50CompCats(comp.k);
      poolSet.forEach(function(pid){
        if(ids.indexOf(pid)>=0) return;
        var pf=FOOD_MAP.get(pid); if(!pf) return;
        if(okCats.indexOf(pf.cat)>=0 && !(comp.k!=='nut' && pf.cat==='fat' && _isCondimentFat(pf))) extra.push(pid);
      });
    }
    var base = (poolPref.length || extra.length) ? poolPref.concat(extra) : ids;
    var cands = base.filter(function(id){ return _v50FoodOk((typeof FOOD_MAP!=='undefined')?FOOD_MAP.get(id):null); });
    if(!cands.length) return null;
    var fresh = cands.filter(function(id){ var w=weekHistory&&weekHistory.get(id); return !(dayHistory&&dayHistory.has(id)) && (w===undefined || w>=3); });
    var pool2 = fresh.length ? fresh : cands;
    return pool2[ rng ? rng.int(pool2.length) : 0 ] || pool2[0];
  }
  function _v50Cals(items){ return items.reduce(function(a,b){ return a+(b.cals||0); },0); }
  function _v50Resize(it,g){ if(g<=0||!it.grams) return; var r=g/it.grams; it.grams=Math.round(g/5)*5; it.cals=Math.round(it.cals*r); it.pro=+(it.pro*r).toFixed(1); it.carb=+(it.carb*r).toFixed(1); it.fat=+(it.fat*r).toFixed(1); }
  function _v50GramsFor(food,kcal,minG,maxG){ var g= food.cal>0 ? Math.round(kcal/food.cal*100) : 100; g=Math.round(g/5)*5; return Math.max(minG, Math.min(maxG, g)); }
  function _v50AttachCompanion(items, type, fatBased){
    var spec=_V50_COMPANION[type]; if(!spec) return;
    var base=null; for(var i=0;i<items.length;i++){ if(spec.baseK.indexOf(items[i]._k)>=0){ base=items[i]; break; } }
    if(!base) base=items[0]; if(!base) return;
    var cf=(typeof FOOD_MAP!=='undefined')?FOOD_MAP.get(spec.ids[0]):null; if(!cf || !_v50FoodOk(cf)) return;
    var g=spec.g; var add=Math.round((cf.cal||0)*g/100); if(add<5) return;
    base.food=Object.assign({}, base.food, { nameAr:((base.food&&base.food.nameAr)||'')+' + '+(cf.nameAr||'') });
    base.cals+=add; base.pro=+((base.pro||0)+(cf.pro||0)*g/100).toFixed(1); base.carb=+((base.carb||0)+(cf.carb||0)*g/100).toFixed(1); base.fat=+((base.fat||0)+(cf.fat||0)*g/100).toFixed(1); base._addon=true;
  }
  function _v50Fill(items, target, fatBased){
    if(!items.length) return; var lo=target*(fatBased?0.82:0.9), hi=target*1.12; var cur=_v50Cals(items);
    var fillOrder=[];
    items.forEach(function(it){ if(['carb','breadcarb','lightcarb'].indexOf(it._k)>=0) fillOrder.push(it); });
    items.forEach(function(it){ if(it._k==='protein') fillOrder.push(it); });
    ['nut','dairy','sweet','fruit'].forEach(function(kk){ items.forEach(function(it){ if(it._k===kk) fillOrder.push(it); }); });
    items.forEach(function(it){ if(fillOrder.indexOf(it)<0) fillOrder.push(it); });
    var fi=0, guard=0;
    while(cur<lo && fi<fillOrder.length && guard<80){ var adj=fillOrder[fi]; var f=adj.food; if(!f || !f.cal){ fi++; continue; } var lim=Math.min(_gramLimit(f),_v50Max(f)); if(adj.grams>=lim){ fi++; continue; } var need=Math.round((lo-cur)/f.cal*100/5)*5; if(need<=0) break; var ng=Math.min(lim, adj.grams+need); if(ng<=adj.grams){ fi++; continue; } _v50Resize(adj,ng); cur=_v50Cals(items); guard++; }
    var oilG=0; while(cur<lo && oilG<10){ var _bf=cur; _v50AddOil(items, lo-cur); cur=_v50Cals(items); if(cur<=_bf) break; oilG++; }
    guard=0; while(cur>hi && guard<24){ var big=null; for(var m=0;m<items.length;m++){ if(items[m].food.cat==='veg'||items[m].food.cat==='veggie') continue; if(!big||items[m].cals>big.cals) big=items[m]; } if(!big) break; var ng2=big.grams-10; if(ng2<15){ break; } _v50Resize(big,ng2); cur=_v50Cals(items); guard++; }
  }
  function _v50Assemble(tpl, slotKey, targetCals, mealMacros, rng, dayHistory, weekHistory, diet, fatBased, poolSet){
    var items=[]; var remCals=targetCals; var remPro=mealMacros.protein||0;
    var add=function(f,g,k){ if(!f) return; g=Math.round(g/5)*5; if(g<10) return; var cals=Math.round((f.cal||0)*g/100); if(cals<10) return; items.push({food:f,grams:g,cals:cals,pro:+((f.pro||0)*g/100).toFixed(1),carb:+((f.carb||0)*g/100).toFixed(1),fat:+((f.fat||0)*g/100).toFixed(1),_k:k}); remCals-=cals; remPro-=(f.pro||0)*g/100; if(dayHistory) dayHistory.add(f.id); };
    for(var ci=0; ci<tpl.comps.length; ci++){
      var comp=tpl.comps[ci]; var k=comp.k;
      if(fatBased && (k==='carb'||k==='breadcarb'||k==='lightcarb'||k==='fruit'||k==='sweet')) continue;
      if(diet==='lowcarb' && k==='carb') k='lightcarb';
      var id=_v50PickId(comp, rng, dayHistory, weekHistory, poolSet); if(!id) continue;
      var f=(typeof FOOD_MAP!=='undefined')?FOOD_MAP.get(id):null; if(!f) continue; var g;
      if(k==='protein'){ g=Math.max(80, Math.round((remPro*100)/Math.max(1,f.pro||1))); g=Math.min(_gramLimit(f), _v50Max(f), g); }
      else if(k==='carb'){ g=_v50GramsFor(f, remCals*(slotKey==='dinner'?0.28:0.38), 50, 300); }
      else if(k==='lightcarb'){ g=_v50GramsFor(f, remCals*0.22, 40, 200); }
      else if(k==='breadcarb'){ g=_v50GramsFor(f, remCals*0.30, 30, 150); }
      else if(k==='veg'){ g=100; }
      else if(k==='dairy'){ g=_v50GramsFor(f, remCals*0.30, 60, Math.min(_gramLimit(f),_v50Max(f))); }
      else if(k==='fruit'){ g=_v50GramsFor(f, remCals*0.35, 80, 200); }
      else if(k==='nut'){ g=_v50GramsFor(f, Math.min(180, remCals*0.4), 15, 40); }
      else if(k==='sweet'){ g=_v50GramsFor(f, Math.min(120, remCals*0.3), 10, 40); }
      else { g=100; }
      add(f, g, k);
    }
    if(!items.length) return null;
    if(tpl.companion && !fatBased) _v50AttachCompanion(items, tpl.companion, fatBased);
    else if(fatBased) _v50AttachCompanion(items, 'oil', fatBased);
    _v50Fill(items, targetCals, fatBased);

    // [CALORIE-CLOSE-FIX] إغلاق سعرات حقيقي.
    // المشكلة: _v50Fill بيكبّر الأصناف الموجودة بس، ولما كلها توصل سقف
    // جراماتها الواقعي (مثلا البيض 150ج، الأرز 350ج) الوجبة بتقف ناقصة.
    // ده كان سبب "فاضلك 635 سعرة" في الأب مع إن الخطة مفروض تكون مكتملة.
    // الحل: لو لسه ناقص، نضيف صنف جديد مناسب للوجبة بدل ما نترك فجوة.
    var _V50_TOPUP = {
      carb:    ['arzabydmtbwkh','btatsmslwqa','ayshbldy','ayshasmr','mkrwnamslwqa','fwlmdms'],
      protein: ['byd_mslwq','sdr_frakh_mshwy','twna_myah','fylyh_blty'],
      dairy:   ['jbnaqrysh','zbadytbyay','jbnabyda'],
      nut:     ['swdany_mhms','jwz','lwz_ny']
    };
    var _tuKinds = fatBased ? ['protein','dairy','nut'] : ['carb','protein','dairy','nut'];
    var _tuLo = targetCals * (fatBased ? 0.82 : 0.9);
    for(var _ki=0; _ki<_tuKinds.length && _v50Cals(items) < _tuLo; _ki++){
      var _kind = _tuKinds[_ki];
      var _tuIds = _V50_TOPUP[_kind] || [];
      var _have = {};
      items.forEach(function(it){ if(it && it.food) _have[it.food.id] = true; });
      var _cand = null;
      for(var _z=0; _z<_tuIds.length; _z++){
        if(_have[_tuIds[_z]]) continue;
        var _f2 = (typeof FOOD_MAP!=='undefined') ? FOOD_MAP.get(_tuIds[_z]) : null;
        if(!_f2 || !_f2.cal || !_v50FoodOk(_f2)) continue;
        // احترام قواعد الوجبة (اللب سناك بس، كارب العشاء، دهون قبل التمرين)
        if(typeof _isFoodAllowedForSlot === 'function'){
          var _chk = _isFoodAllowedForSlot(_f2, slotKey);
          if(_chk && _chk.ok === false) continue;
        }
        _cand = _f2; break;
      }
      if(!_cand) continue;
      var _need = _tuLo - _v50Cals(items);
      var _maxG = Math.min(_gramLimit(_cand), _v50Max(_cand));
      var _g2 = _v50GramsFor(_cand, _need, 30, _maxG);
      var _before = _v50Cals(items);
      add(_cand, _g2, _kind);
      if(_v50Cals(items) <= _before) continue; // مافيش تقدم — جرّب النوع اللي بعده
    }
    _v50Fill(items, targetCals, fatBased);
    return items;
  }
  function _v50Audit(items, slotKey, diet){
    if(!items || !items.length) return false;
    for(var i=0;i<items.length;i++){ var f=items[i].food; if(!items[i]._addon && (f.cat==='fat') && _isCondimentFat(f)) return false; }
    var cats=items.map(function(it){ return it.food.cat; });
    var hasPD = cats.indexOf('protein')>=0 || cats.indexOf('dairy')>=0;
    if(['breakfast','lunch','dinner','post'].indexOf(slotKey)>=0 && !hasPD) return false;
    if(slotKey==='breakfast'){ for(var j=0;j<items.length;j++){ var ff=items[j].food; if(ff.cat==='protein' && !/^byd|^byad|twna/.test(String(ff.id||''))) return false; } }
    return true;
  }
  function _buildFromTemplate(slotKey, targetCals, mealMacros, rng, dayHistory, weekHistory, diet){
    var all=_EGY_TEMPLATES[slotKey]||[]; if(!all.length) return null;
    var tpls=all.filter(function(t){ return t.diets.indexOf(diet)>=0; });
    if(!tpls.length) tpls=all.filter(function(t){ return t.diets.indexOf('balanced')>=0; });
    if(!tpls.length) tpls=all.slice();
    var poolSet=(SMPS.pool&&SMPS.pool[slotKey])||new Set();
    var fatBased=(diet==='keto'||diet==='carnivore');
    var order=rng?rng.shuffle(tpls):tpls.slice();
    for(var ti=0; ti<order.length; ti++){ var built=_v50Assemble(order[ti], slotKey, targetCals, mealMacros, rng, dayHistory, weekHistory, diet, fatBased, poolSet); if(built && _v50Audit(built, slotKey, diet)) return {items:built, tpl:order[ti].id}; }
    var fb=_v50Assemble(order[0], slotKey, targetCals, mealMacros, rng, dayHistory, weekHistory, diet, fatBased, poolSet);
    if(fb && fb.length) return {items:fb, tpl:order[0].id};
    return null;
  }

  function _buildMealFromPool(slotKey, targetCals, mealMacros, rng, dayHistory, weekHistory) {
    const pool = SMPS.pool[slotKey];
    const diet = (typeof DE !== 'undefined' && DE.selectedDiet) || 'balanced';
    // v50: template-first generation (Skip + auto path); user pool foods are preferred inside templates
    try {
      var _tb=_buildFromTemplate(slotKey, targetCals, mealMacros, rng, dayHistory, weekHistory, diet);
      if(_tb && _tb.items && _tb.items.length){
        var _selT=_tb.items;
        var _tt=_selT.reduce(function(a,s){ return {cals:a.cals+s.cals, pro:+(a.pro+s.pro).toFixed(1), carb:+(a.carb+s.carb).toFixed(1), fat:+(a.fat+s.fat).toFixed(1)}; },{cals:0,pro:0,carb:0,fat:0});
        return { slotKey:slotKey, targetCals:targetCals, foods:_selT, cals:_tt.cals, pro:_tt.pro, carb:_tt.carb, fat:_tt.fat, totalCals:_tt.cals, totalPro:_tt.pro, totalCarb:_tt.carb, totalFat:_tt.fat };
      }
    } catch(_e){}
    const fatBasedDiet = (diet === 'keto' || diet === 'carnivore');
    let rules = (_DIET_MEAL_RULES[diet] || _DIET_MEAL_RULES.balanced).slotRules[slotKey]
               || _DIET_MEAL_RULES.balanced.slotRules[slotKey]
               || { protein:1, carb:1, fat:0.3, veggie:0.5 };

    if (diet === 'carbcycle') {
      const carbDensity = mealMacros.carbs * 4 / Math.max(1, targetCals);
      if (carbDensity > 0.38) { rules = { ...rules, protein: 1.0, carb: 1.0, fat: 0.15, fruit: 0.6 }; }
      else if (carbDensity > 0.28) { rules = { ...rules, protein: 1.0, carb: 0.7, fat: 0.35, fruit: 0.4 }; }
      else { rules = { ...rules, protein: 1.0, carb: 0.25, fat: 0.85, veggie: 1.0 }; }
    }
    const isSnack = slotKey === 'snack';
    const allPoolFoods = (pool ? [...pool] : []).map(id => (typeof FOOD_MAP !== 'undefined') ? FOOD_MAP.get(id) : null).filter(Boolean);

    const scored = allPoolFoods.map(f => {
      let score = 0; const cat = f.cat;
      score += (rules[cat] || 0) * 50;
      const mt = Array.isArray(f.mealTypes) ? f.mealTypes : [];
      if (mt.length) { if (mt.includes(slotKey)) score += 70; else score -= 9999; } // [FIX] hard block
      score += _egySlotScore(f, slotKey);
      if (typeof f.healthyScore === 'number') score += (f.healthyScore - 5) * 4;
      if (f.processedLevel === 'high') score -= 25;
      if (_isCondimentFat(f) && !fatBasedDiet) score -= 600; // التتبيلة مش صنف مستقل
      if (cat === 'fat' && !_isCondimentFat(f) && !['snack','pre'].includes(slotKey) && !fatBasedDiet) score -= 80;
      const daysAgo = weekHistory.get(f.id);
      if (daysAgo !== undefined) score -= Math.max(0, (4 - daysAgo) * 20);
      if (dayHistory.has(f.id)) score -= 100;
      // [OWNER-RULE] كسر تثبيت نوع بروتين واحد (زي سمك البلطي) في الغداء وعبر الأيام:
      // للبروتين نزود عقوبة التكرار القريب + تشويش عشوائي أوسع عشان الاختيار
      // يتنوع بين كل مصادر البروتين المسموحة، من غير ما نطلّع صنف رديء.
      if (cat === 'protein') {
        if (daysAgo !== undefined) score -= Math.max(0, (4 - daysAgo) * 15);
        score += rng.next() * 30 - 15;
      } else {
        score += rng.next() * 15 - 7.5;
      }
      return { food: f, score };
    }).sort((a, b) => b.score - a.score);

    const selected = [];
    let remCals = targetCals, remPro = mealMacros.protein, remCarb = mealMacros.carbs;
    const usedIds = new Set();

    const addFood = (f, gramOverride) => {
      if (!f) return;
      const maxG = _gramLimit(f); let g;
      if (gramOverride) g = Math.min(maxG, gramOverride);
      else if (f.cal > 0) g = Math.min(maxG, Math.max(20, Math.round((remCals * 0.45 / f.cal) * 100)));
      else g = 100;
      g = Math.round(g / 5) * 5; g = Math.max(20, Math.min(maxG, g));
      const cals = Math.round(f.cal * g / 100);
      if (cals < 10) return;
      selected.push({ food: f, grams: g, cals,
        pro: +(f.pro * g / 100).toFixed(1), carb: +(f.carb * g / 100).toFixed(1), fat: +(f.fat * g / 100).toFixed(1) });
      remCals -= cals; remPro -= f.pro * g / 100; remCarb -= f.carb * g / 100;
      dayHistory.add(f.id); usedIds.add(f.id);
    };

    const bycat = (cat) => scored.find(s => s.food.cat === cat && !dayHistory.has(s.food.id) && !(_isCondimentFat(s.food)&&!fatBasedDiet))?.food
                        || scored.find(s => s.food.cat === cat && !(_isCondimentFat(s.food)&&!fatBasedDiet))?.food;

    if (isSnack) {
      let primary = bycat('fruit') || bycat('dairy')
                 || scored.find(s => (s.food.cat==='snack'||s.food.cat==='fat') && !_isCondimentFat(s.food))?.food
                 || (scored.find(s=>s.food.cat==='protein' && /بيض/.test(s.food.nameAr))||{}).food
                 || _pickFromDB('fruit', slotKey, rng, usedIds) || _pickFromDB('dairy', slotKey, rng, usedIds);
      if (primary) addFood(primary);
      if (remCals > 70) {
        const secondary = bycat('dairy') || bycat('fruit');
        if (secondary && secondary.id !== (primary&&primary.id) && !dayHistory.has(secondary.id)) addFood(secondary);
      }
    } else {
      // 1) بروتين رئيسي — لو فطار: بيض/جبنة مش سمك/فراخ
      let proteinFood = bycat('protein') || bycat('dairy');
      if (slotKey === 'breakfast' && proteinFood && !/بيض/.test(proteinFood.nameAr) && proteinFood.cat !== 'dairy') {
        const egg = _pickFromDB('protein', 'breakfast', rng, usedIds) || bycat('dairy') || _pickFromDB('dairy','breakfast',rng,usedIds);
        if (egg) proteinFood = egg;
      }
      if (!proteinFood) proteinFood = _pickFromDB('protein', slotKey, rng, usedIds) || _pickFromDB('dairy', slotKey, rng, usedIds);
      if (proteinFood) {
        const proGrams = Math.min(_gramLimit(proteinFood), Math.max(80, Math.round((remPro * 100) / Math.max(1, proteinFood.pro))));
        addFood(proteinFood, Math.round(proGrams / 5) * 5);
      }

      // 2) كارب
      const skipCarb = fatBasedDiet;
      const lightCarb = diet === 'lowcarb' || slotKey === 'dinner';
      if (!skipCarb && remCals > 80 && (rules.carb || 0) > 0) {
        let carbFood = bycat('carb');
        if (!carbFood) carbFood = _pickFromDB('carb', slotKey, rng, usedIds);
        if (carbFood) {
          const ratio = lightCarb ? 0.28 : (slotKey === 'post' ? 0.45 : 0.38);
          const carbGrams = Math.min(300, Math.max(50, Math.round((remCals * ratio / Math.max(1, carbFood.cal)) * 100)));
          addFood(carbFood, Math.round(carbGrams / 5) * 5);
        }
      }

      // 3) خضار/سلطة — غدا/عشا/بعد التمرين
      if (['lunch','dinner','post'].includes(slotKey) && remCals > 30) {
        let veggieFood = bycat('veggie');
        if (!veggieFood && ['lunch','dinner'].includes(slotKey)) veggieFood = _pickFromDB('veggie', slotKey, rng, usedIds);
        if (veggieFood) addFood(veggieFood, 100);
      }

      // 4) دهون كاملة كصنف — بس للأنظمة الدهنية (كيتو/كارنيفور). غيرها الدهن جاي كتتبيلة.
      if (fatBasedDiet && remCals > 100) {
        let fatFood = scored.find(s => s.food.cat==='fat' && !dayHistory.has(s.food.id))?.food;
        if (fatFood) {
          const fatGrams = Math.min(_gramLimit(fatFood), Math.max(10, Math.round((remCals * 0.45 / Math.max(1, fatFood.cal)) * 100)));
          addFood(fatFood, Math.round(fatGrams / 5) * 5);
        }
      }

      // 5) فاكهة قبل التمرين
      if (slotKey === 'pre' && remCals > 60 && !fatBasedDiet) {
        const fruitFood = bycat('fruit') || _pickFromDB('fruit', slotKey, rng, usedIds);
        if (fruitFood) addFood(fruitFood);
      }

      // 6) أمان: لو م��يش بروتين/ألبان
      if (!selected.some(s => ['protein','dairy'].includes(s.food.cat))) {
        const dairyFood = bycat('dairy') || _pickFromDB('dairy', slotKey, rng, usedIds) || _pickFromDB('protein', slotKey, rng, usedIds);
        if (dairyFood) addFood(dairyFood, 150);
      }
    }

    // 7) تراكب التتبيلة: طحينة/عسل/زيت/زبدة + جنب عنصر مناسب في نفس السطر (لو الوجبة محتاجة دهون)
    if (!isSnack || slotKey==='snack') {
      const wantsFat = fatBasedDiet || (rules.fat || 0) > 0;
      if (wantsFat) _attachCondiment(selected, slotKey, diet, rng, allPoolFoods);
    }

    const totals = selected.reduce((a, s) => ({
      cals: a.cals + s.cals, pro: +(a.pro + s.pro).toFixed(1),
      carb: +(a.carb + s.carb).toFixed(1), fat: +(a.fat + s.fat).toFixed(1),
    }), { cals:0, pro:0, carb:0, fat:0 });

    return { slotKey, targetCals, foods: selected, ...totals,
             totalCals: totals.cals, totalPro: totals.pro,
             totalCarb: totals.carb, totalFat: totals.fat };
  }

  // ── Main day generator ───────────────────────────────────────────────
  // ccMultipliers: { active, isTraining, carbMult, fatMult, label } | null
  function _generateDayFromPool(daySeed, weekHistory, ccMultipliers) {
    if (typeof DE === 'undefined') return [];
    const totalCals = (typeof calcTargetCals === 'function') ? calcTargetCals()
                    : ((typeof calculateTDEE === 'function') ? calculateTDEE() : 2000);
    const baseMacros = (typeof calcMacros === 'function') ? calcMacros(totalCals, DE.selectedDiet || 'balanced')
                     : { protein:150, carbs:200, fat:65 };
    const seed   = daySeed || Math.floor(Math.random() * 99999);
    const rng    = _makeRng(seed);
    const wh     = weekHistory || new Map();
    const dayH   = new Set();

    const diet   = DE.selectedDiet || 'balanced';
    const dRules = _DIET_MEAL_RULES[diet] || _DIET_MEAL_RULES.balanced;
    const cc     = ccMultipliers; // shorthand

    // ── Carb Cycle: عدل الماكروز اليومية (3 مستويات) ─────────────
    // HIGH   (جيم):    كارب +40%، دهون -20%
    // MEDIUM (كارديو): كارب +10%، دهون -5%
    // LOW    (راحة):   كارب -30%، دهون +20%
    const macros = (cc && cc.active) ? (() => {
      const adjCarbs = Math.max(
        cc.dayType === 'low' ? 80 : 100,  // floor: راحة 80جم، باقي 100جم
        Math.round(baseMacros.carbs * cc.carbMult)
      );
      const carbCalDiff = (adjCarbs - baseMacros.carbs) * 4;
      const fatFloor    = Math.round((DE.weight || 70) * 0.7);
      const adjFat      = Math.max(fatFloor, Math.max(30, Math.round(baseMacros.fat - carbCalDiff / 9)));
      return { protein: baseMacros.protein, carbs: adjCarbs, fat: adjFat };
    })() : baseMacros;

    // ── Calorie split حسب نوع اليوم ──────────────────────────────────
    const split   = dRules.calSplit;
    let ccSplit   = split;
    if (cc && cc.active) {
      if (cc.dayType === 'high') {
        // جيم: pre/post يأخذوا أكتر، العشاء أقل
        ccSplit = { ...split,
          pre:  (split.pre  || 0.15) * 1.40,
          post: (split.post || 0.20) * 1.35,
          breakfast: (split.breakfast || 0.25) * 1.10,
          dinner: (split.dinner || 0.22) * 0.75,
        };
      } else if (cc.dayType === 'medium') {
        // كارديو: توزيع متوازن مع رفع خفيف لل pre
        ccSplit = { ...split,
          pre:  (split.pre  || 0.15) * 1.20,
          post: (split.post || 0.20) * 1.15,
          dinner: (split.dinner || 0.22) * 0.90,
        };
      } else {
        // راحة: توزيع متساو، الغداء والفطار أكتر شبع
        ccSplit = { ...split,
          breakfast: (split.breakfast || 0.25) * 1.10,
          lunch:     (split.lunch     || 0.32) * 1.10,
          pre:       (split.pre       || 0.15) * 0.70,
          post:      (split.post      || 0.20) * 0.70,
        };
      }
    }

    const snackSlots = SMPS.slots.filter(s => s === 'snack').length;
    const mainSlots  = SMPS.slots.filter(s => s !== 'snack').length;
    // ── Snack calories: حد أدنى 150، حد أقصى 300 ──
    const snackPct   = ccSplit.snack || 0.10;
    const snackCals  = Math.min(300, Math.max(150, Math.round(totalCals * snackPct)));
    const remainCals = totalCals - snackCals * snackSlots;
    // ── Normalize على الوجبات الموجودة فعلا فقط ──────────────────
    // يضمن إن كل وجبة تاخد نسبتها الصح من ال remainCals
    const mainSplitSum = SMPS.slots
      .filter(s => s !== 'snack')
      .reduce((sum, s) => sum + (ccSplit[s] || (1 / Math.max(1, mainSlots))), 0);
    const mealCalMap = {};
    // حد أدنى للوجبات الرئيسية: pre≥250، post≥300، الباقي≥350
    const mealFloor = { pre:250, post:300, breakfast:350, lunch:400, dinner:350 };
    SMPS.slots.forEach(sk => {
      if (sk === 'snack') { mealCalMap[sk] = snackCals; return; }
      const pct     = ccSplit[sk] || (1 / Math.max(1, mainSlots));
      const normPct = mainSplitSum > 0 ? pct / mainSplitSum : 1 / Math.max(1, mainSlots);
      const raw     = Math.round(remainCals * normPct);
      mealCalMap[sk] = Math.max(mealFloor[sk] || 300, raw);
    });

    // ── Per-meal macros (مع تعديل الكارب سايكل) ──────────────────────
    const getMealMacros = (sk) => {
      const calFrac = (mealCalMap[sk] || 0) / Math.max(1, totalCals);
      // توزيع الكارب: قبل/بعد التمرين يأخذوا أكتر في يوم التمرين
      const carbBoost = (cc && cc.active && cc.isTraining)
        ? (sk === 'pre' ? 1.6 : sk === 'post' ? 1.5 : sk === 'dinner' ? 0.5 : 1.0)
        : (sk === 'pre' ? 1.5 : sk === 'post' ? 1.4 : sk === 'dinner' ? 0.7 : 1.0);
      var _carbsCalc = Math.round(macros.carbs * calFrac * carbBoost);
      // Diabetes/insulin carb safety cap (ported from results-page HOTFIX P3): standard <=60g, post-workout <=75g
      if (typeof DE !== 'undefined' && Array.isArray(DE.healthConditions) && (DE.healthConditions.includes('diabetes') || DE.healthConditions.includes('insulin'))) {
        var _carbCap = (sk === 'post') ? 75 : 60;
        if (_carbsCalc > _carbCap) _carbsCalc = _carbCap;
      }
      return {
        protein: Math.round(macros.protein * calFrac),
        carbs:   _carbsCalc,
        fat:     Math.round(macros.fat     * calFrac),
      };
    };

    return SMPS.slots.map(sk => {
      const meal = _buildMealFromPool(sk, mealCalMap[sk] || 400, getMealMacros(sk), rng, dayH, wh);
      // ألصق label الكارب سايكل على كل وجبة للعرض
      if (cc && cc.active) {
        meal.ccLabel      = cc.label;
        meal.ccLabelColor = cc.labelColor;
        meal.ccTextColor  = cc.textColor;
      }
      return meal;
    });
  }

  // ── Render phase 2 preview ────────────────────────────────────────
  function smpsGeneratePreview() {
    SMPS._previewDay = _generateDayFromPool();
    _renderPreviewDay();
  }
  window.smpsGeneratePreview = smpsGeneratePreview;

  // ── Veggie grouping helper ────────────────────────────────────────
  // أي أطعمة من فئة veggie في نفس الوجبة تتجمع ك "سلطة" واحدة
  function _groupVeggies(foods) {
    const veggies = foods.filter(f => f.food.cat === 'veggie');
    const others  = foods.filter(f => f.food.cat !== 'veggie');
    if (veggies.length < 2) return foods; // أقل من 2 خضار - لا داعي للتجميع

    // اجمع الخضار في عنصر واحد
    const saladGrams = veggies.reduce((s, f) => s + f.grams, 0);
    const saladCals  = veggies.reduce((s, f) => s + f.cals,  0);
    const saladPro   = veggies.reduce((s, f) => s + f.pro,   0);
    const saladCarb  = veggies.reduce((s, f) => s + f.carb,  0);
    const saladFat   = veggies.reduce((s, f) => s + f.fat,   0);
    const names      = veggies.map(f => f.food.nameAr || f.food.id).join(' + ');

    const saladItem = {
      isSalad: true,
      saladNames: names,
      saladParts: veggies,
      food: { nameAr: 'سلطة', cat: 'veggie', id: 'salad_group' },
      grams: saladGrams,
      cals:  saladCals,
      pro:   saladPro,
      carb:  saladCarb,
      fat:   saladFat,
    };
    return [...others, saladItem];
  }

  // ── Render one food row (handles salad group) ─────────────────────
  function _renderFoodRow(f, style) {
    if (f.isSalad) {
      return `
        <div class="smp-prev-food-row" style="${style||''}">
          <span class="smp-prev-food-name">سلطة
            <span style="font-size:10px;color:var(--text-dim);font-weight:500;display:block;margin-top:1px;">
              ${f.saladNames}
            </span>
          </span>
          <span class="smp-prev-food-g">${f.grams}ج — ${f.cals}ك</span>
        </div>`;
    }
    return `
      <div class="smp-prev-food-row" style="${style||''}">
        <span class="smp-prev-food-name">${f.food.nameAr || f.food.id}</span>
        <span class="smp-prev-food-g">${f.grams}ج — ${f.cals}ك</span>
      </div>`;
  }

  function _renderPreviewDay() {
    const el = document.getElementById('smps-plan-preview');
    if (!el || !SMPS._previewDay) return;
    const MEAL_COLOR = { breakfast:'var(--orange)', lunch:'var(--accent)', dinner:'var(--purple)', snack:'var(--green)', pre:'var(--blue)', post:'var(--green)' };
    let totalCals=0, totalPro=0, totalCarb=0, totalFat=0;
    el.innerHTML = SMPS._previewDay.map(meal => {
      if (!meal.foods.length) return '';
      totalCals += meal.totalCals; totalPro += meal.totalPro;
      totalCarb += meal.totalCarb; totalFat += meal.totalFat;
      const meta    = SLOT_META[meal.slotKey] || { icon:'', label:meal.slotKey };
      const grouped = _groupVeggies(meal.foods);
      return `<div class="smp-preview-meal">
        <div class="smp-prev-header">
          <span style="font-size:20px;">${meta.icon}</span>
          <span class="smp-prev-title">${meta.label}</span>
          <span class="smp-prev-cals">${meal.totalCals} ك</span>
          <span style="font-size:11px;color:var(--green);font-weight:700;">${meal.totalPro}ج</span>
        </div>
        ${grouped.map(f => _renderFoodRow(f)).join('')}
      </div>`;
    }).join('');

    // Update macro bars -- show the ACTUAL daily TARGET (rounded to whole
    // numbers), not the generated meal sum. A small selected food pool can
    // make the generated meals fall short; the target is what we aim for.
    const _tCals = (typeof calcTargetCals === 'function') ? calcTargetCals()
                 : ((typeof calculateTDEE === 'function') ? calculateTDEE() : totalCals);
    const _tMac  = (typeof calcMacros === 'function')
                 ? calcMacros(_tCals, (typeof DE !== 'undefined' && DE.selectedDiet) || 'balanced')
                 : { protein: totalPro, carbs: totalCarb, fat: totalFat };
    const _r = function(v){ return (typeof v === 'number' && isFinite(v)) ? Math.round(v) : v; };
    const setVal = (id, v) => { const e=document.getElementById(id); if(e) e.textContent = _r(v); };
    setVal('smps-tdee-val', _tCals);
    setVal('smps-pro-val',  _tMac.protein);
    setVal('smps-carb-val', _tMac.carbs);
    setVal('smps-fat-val',  _tMac.fat);
  }

  // ═══════════════════════════════════════════════════════
  //  90-DAY PLAN GENERATOR
  // ═══════════════════════════════════════════════════════
  function _generate90Day() {
    const days = [];
    const weekHistory = new Map();
    const isCarbCycle = (typeof DE !== 'undefined') && DE.selectedDiet === 'carbcycle';

    // ── Carb Cycle: 3 مستويات ───────────────────────────────────────
    // الجيم   = يوم عال   (HIGH)   — كارب +40%، دهون -20%
    // كارديو  = يوم متوسط  (MEDIUM) — كارب +10%، دهون -5%
    // راحة    = يوم منخفض  (LOW)    — كارب -30%، دهون +20%
    const gymDays    = Math.min(6, Math.max(0, parseInt(document.getElementById('inp-train-days')?.value) || 4));
    const cardioDays = Math.min(6 - gymDays, Math.max(0, parseInt(document.getElementById('inp-cardio')?.value) || 2));
    const restDays   = Math.max(1, 7 - gymDays - cardioDays);

    // توزيع الأيام في الأسبوع:
    // [0..gymDays-1]           = HIGH
    // [gymDays..gym+cardio-1]  = MEDIUM
    // [gym+cardio..6]          = LOW
    const CC_TYPES = {
      high:   { carbMult: 1.40, fatMult: 0.80, label: 'يوم جيم — كارب عال',      color: 'rgba(42,232,123,0.15)', textColor: 'var(--green)'  },
      medium: { carbMult: 1.10, fatMult: 0.95, label: 'يوم كارديو — كارب متوسط',   color: 'rgba(245,166,35,0.15)', textColor: 'var(--orange)' },
      low:    { carbMult: 0.70, fatMult: 1.20, label: 'يوم راحة — كارب منخفض',     color: 'rgba(42,140,232,0.12)', textColor: 'var(--blue)'   },
    };

    function getDayType(dayOfWeek) {
      if (dayOfWeek < gymDays)               return 'high';
      if (dayOfWeek < gymDays + cardioDays)  return 'medium';
      return 'low';
    }

    for (let d = 0; d < 90; d++) {
    // بناء تاريخ البروتين من الأيام المولّدة حتى الآن
    this._proteinHistory = this._buildProteinHistory({ days: generatedDays });

      // ── freshness window: 6 أيام لتنوع أفضل ──────────────────────
      const relativeHistory = new Map();
      weekHistory.forEach((lastDay, id) => {
        const daysAgo = d - lastDay;
        if (daysAgo <= 6) relativeHistory.set(id, daysAgo);
      });
      // ── protein rotation: كل 3 أيام يتغير مصدر البروتين الرئيسي ──
      // الأسبوع: 0-2 = فراخ، 3-4 = سمك، 5-6 = لحمة/بيض
      const proteinWeek = Math.floor((d % 7) / 3);
      const proteinBoost = proteinWeek === 0
        ? new Set(['sdr_frakh_mshwy','wrk_frakh_mshwy','jnah_frakh_mshwy','sdr_dyk_rwmy_mshwy'])
        : proteinWeek === 1
        ? new Set(['blty_mshwy','bwry_mshwy','twna_myah','twna_layt','srdyn_mshwy'])
        : new Set(['byd_mslwq','byad_byd','byd_awmlyt','kfta_mshwya_ala_alfhm','kbab_mshwy','lhm_bqry_mslwq']);
      // حط العناصر اللي مش في المجموعة الحالية كإنها اتأكلت امبارح
      if (typeof FOOD_DB !== 'undefined') {
        FOOD_DB.filter(f => f.cat === 'protein').forEach(f => {
          if (!proteinBoost.has(f.id) && !relativeHistory.has(f.id)) {
            relativeHistory.set(f.id, 2); // penalty خفيف — مش محظور تماما
          }
        });
      }

      let ccMultipliers = null;
      if (isCarbCycle) {
        const dayType = getDayType(d % 7);
        const ccType  = CC_TYPES[dayType];
        ccMultipliers = {
          active:     true,
          dayType,
          isTraining: dayType === 'high',
          isCardio:   dayType === 'medium',
          carbMult:   ccType.carbMult,
          fatMult:    ccType.fatMult,
          label:      ccType.label,
          labelColor: ccType.color,
          textColor:  ccType.textColor,
        };
      }

      const dayPlan = _generateDayFromPool(d * 137 + 31, relativeHistory, ccMultipliers);
      days.push(dayPlan);

      dayPlan.forEach(meal => {
        meal.foods.forEach(f => weekHistory.set(f.food.id, d));
      });
    }
    SMPS._90dayPlan = days;
  }

  function _renderWeekTabs() {
    const el = document.getElementById('smps-week-tabs');
    if (!el) return;
    el.innerHTML = Array.from({length:13}, (_,i) => `
      <button class="smps-wtab${i===0?' active':''}" id="smps-wt${i}"
        onclick="smpsShowWeek(${i})">
        أسبوع ${i+1}
      </button>`).join('');
  }

  function smpsShowWeek(wIdx) {
    document.querySelectorAll('.smps-wtab').forEach((b,i) => {
      b.classList.toggle('active', i === wIdx);
    });
    _renderWeekContent(wIdx);
  }
  window.smpsShowWeek = smpsShowWeek;

  // -- UNIFY: public entry so the results page (page 7) renders day 1 of the SAME plan --
  SMPS.ensurePlan = function ensurePlan(){
    try { if (!SMPS._90dayPlan || !SMPS._90dayPlan.length) { _generate90Day(); } } catch (e) {}
    return SMPS._90dayPlan || [];
  };

  // -- PRINTABLE 90-DAY WEEKLY TABLES (used by the downloadable plan) --
  // Builds static, collapsible (<details>) tables for all 13 weeks (up to 3
  // representative varied days each) from SMPS._90dayPlan. Returns INNER HTML
  // only. Generates the plan first if needed. Works offline (no JS needed).
  SMPS.buildPrintableWeeks = function buildPrintableWeeks(){
    try {
      if (!SMPS._90dayPlan || !SMPS._90dayPlan.length) { try { _generate90Day(); } catch (e) {} }
      if (!SMPS._90dayPlan || !SMPS._90dayPlan.length) {
        return '<p style="color:var(--text-muted);font-size:13px;">لم يتم توليد خطة الأسابيع بعد. تأكد من اختيار الأطعمة ثم أعد تحميل الملف</p>';
      }
      var DNAMES = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      var out = '';
      for (var w = 0; w < 13; w++) {
        var start = w * 7, end = Math.min(start + 7, 90);
        var idxs = [], seen = {};
        for (var i = start; i < end; i++) {
          var p = SMPS._90dayPlan[i];
          var lbl = (p && p[0] && p[0].ccLabel) ? p[0].ccLabel : null;
          if (lbl && !seen[lbl]) { seen[lbl] = 1; idxs.push(i); }
          if (idxs.length >= 3) break;
        }
        if (!idxs.length) {
          var offs = [start, Math.min(start + 3, end - 1), end - 1];
          for (var o = 0; o < offs.length; o++) {
            if (offs[o] >= start && offs[o] < end && idxs.indexOf(offs[o]) === -1) idxs.push(offs[o]);
          }
        }
        var daysHTML = idxs.map(function(di){
          var dayPlan = SMPS._90dayPlan[di];
          if (!dayPlan) return '';
          var tc = 0, tp = 0, tk = 0, tf = 0;
          dayPlan.forEach(function(m){ tc += m.totalCals; tp += (m.totalPro||0); tk += (m.totalCarb||0); tf += (m.totalFat||0); });
          var ccLabel = dayPlan[0] && dayPlan[0].ccLabel;
          var bdy = dayPlan.filter(function(m){ return m.foods.length; }).map(function(meal){
            var meta = (typeof SLOT_META !== 'undefined' && SLOT_META[meal.slotKey]) ? SLOT_META[meal.slotKey] : { icon:'', label: meal.slotKey };
            var foods = _groupVeggies(meal.foods).map(function(f){
              var nm = f.isSalad ? ('سلطة <small>('+ f.saladNames +')</small>') : (f.food.nameAr || f.food.id);
              var proTxt = (f.pro != null) ? (f.pro + 'ج') : '—';
              return '<tr><td class="nm">'+ nm +'</td><td>'+ f.grams +'ج</td><td>'+ f.cals +'</td><td>'+ proTxt +'</td></tr>';
            }).join('');
            return '<tr class="wkx-meal"><td colspan="4">'+ meta.icon +' '+ meta.label +' <span class="mt">'+ meal.totalCals +' ·'+ Math.round(meal.totalPro||0) +'ج ·'+ Math.round(meal.totalCarb||0) +'ج</span></td></tr>'+ foods;
          }).join('');
          return '<div class="wkx-day">'+
            '<div class="wkx-day-head"><span class="dn">'+ DNAMES[di % 7] +' <small>يوم '+ (di+1) +'</small>'+ (ccLabel ? ' <span class="wkx-cc">'+ ccLabel +'</span>' : '') +'</span>'+
            '<span class="wkx-tot">'+ Math.round(tc) +' ·'+ Math.round(tp) +'ج ·'+ Math.round(tk) +'ج ·'+ Math.round(tf) +'ج</span></div>'+
            '<table class="wkx-table"><tbody>'+ bdy +'</tbody></table>'+
            '</div>';
        }).join('');
        out += '<details class="wkx-week"'+(w===0?' open':'')+'>'+
          '<summary class="wkx-week-head"><span>الأسبوع '+ (w+1) +'</span>'+
          '<span class="wkx-sum">'+ idxs.length +' أيام نموذجية ▾</span></summary>'+
          '<div class="wkx-week-body">'+ daysHTML +'</div></details>';
      }
      var css = '<style>'+
        '.wkx-intro{color:var(--text-muted);font-size:12.5px;line-height:1.9;margin:0 0 14px;}'+
        '.wkx-week{margin-bottom:12px;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--surface2);break-inside:avoid;}'+
        '.wkx-week-head{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:8px;background:linear-gradient(135deg,rgba(74,158,255,0.18),rgba(42,232,123,0.10));padding:11px 15px;font-weight:900;font-size:15px;color:var(--text);user-select:none;}'+
        '.wkx-week-head::-webkit-details-marker{display:none;}'+
        '.wkx-sum{font-size:11px;font-weight:700;color:var(--text-muted);}'+
        '.wkx-week[open] .wkx-sum{color:var(--green);}'+
        '.wkx-week-body{padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(265px,1fr));gap:12px;}'+
        '.wkx-day{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px;break-inside:avoid;}'+
        '.wkx-day-head{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;font-size:11.5px;font-weight:800;color:var(--text);border-bottom:1px solid var(--border);padding-bottom:6px;margin-bottom:6px;}'+
        '.wkx-day-head .dn small{color:var(--text-dim);font-weight:500;}'+
        '.wkx-cc{font-weight:800;color:var(--orange);font-size:10px;}'+
        '.wkx-tot{color:var(--text-muted);font-weight:700;font-size:10px;}'+
        '.wkx-table{width:100%;border-collapse:collapse;font-size:11px;}'+
        '.wkx-table td{padding:3px 6px;border-bottom:1px solid rgba(255,255,255,0.05);color:var(--text);text-align:right;}'+
        '.wkx-table td.nm{font-weight:600;}'+
        '.wkx-table small{color:var(--text-dim);font-weight:400;}'+
        '.wkx-meal td{background:rgba(74,158,255,0.10);font-weight:800;color:var(--text);font-size:10.5px;}'+
        '.wkx-meal .mt{color:var(--text-muted);font-weight:700;font-size:9.5px;}'+
        '</style>';
      return css + '<p class="wkx-intro">اضغط على أي أسبوع لفتحه. لكل أسبوع حتى 3 أيام نموذجية متنوعة (تمرين/كارديو/راحة)، وباقي الأيام تتبع نفس النمط مع تدوير المصادر للتنويع</p>' + out;
    } catch (e) {
      if (typeof LOG === 'function') LOG('[buildPrintableWeeks] error: ' + e);
      return '<p style="color:var(--red);font-size:13px;">تعذر بناء جداول الأسابيع</p>';
    }
  };

  const DAY_NAMES_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

  function _renderWeekContent(wIdx) {
    const el = document.getElementById('smps-week-content');
    if (!el || !SMPS._90dayPlan) return;
    const start = wIdx * 7;
    const end   = Math.min(start + 7, 90);

    // 3-DAY WEEKLY VIEW (display-only): surface up to 3 representative
    // "varied" days per week -- one per distinct carb-cycle type
    // (training/high, cardio/medium, rest/low) when carb cycling is
    // active, else 3 spread-out days. The full 90-day plan stays intact
    // underneath -- DWCP, PHL and periodization are unaffected.
    const _weekIdxs = [];
    for (let _i = start; _i < end; _i++) _weekIdxs.push(_i);
    let _selectedIdxs = [];
    const _seenLabels = new Set();
    for (const _wi of _weekIdxs) {
      const _p = SMPS._90dayPlan[_wi];
      const _lbl = (_p && _p[0] && _p[0].ccLabel) ? _p[0].ccLabel : null;
      if (_lbl && !_seenLabels.has(_lbl)) { _seenLabels.add(_lbl); _selectedIdxs.push(_wi); }
      if (_selectedIdxs.length >= 3) break;
    }
    if (_selectedIdxs.length === 0) {
      const _offs = [0, Math.floor(_weekIdxs.length / 2), _weekIdxs.length - 1];
      for (const _o of _offs) {
        const _idx = _weekIdxs[_o];
        if (_idx !== undefined && _selectedIdxs.indexOf(_idx) === -1) _selectedIdxs.push(_idx);
      }
    }

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px;padding:4px 0;">
        ${_selectedIdxs.map((dayIdx) => {
          const dayPlan = SMPS._90dayPlan[dayIdx];
          const dayName = DAY_NAMES_AR[dayIdx % 7];
          let dayTotalCals=0, dayTotalPro=0, dayTotalCarb=0, dayTotalFat=0;
          dayPlan.forEach(m => {
            dayTotalCals += m.totalCals;
            dayTotalPro  += (m.totalPro  || 0);
            dayTotalCarb += (m.totalCarb || 0);
            dayTotalFat  += (m.totalFat  || 0);
          });
          const ccLabel = dayPlan[0]?.ccLabel;
          const ccBg    = dayPlan[0]?.ccLabelColor || '';
          const ccColor = dayPlan[0]?.ccTextColor  || '';

          const mealsHtml = dayPlan.filter(m => m.foods.length).map(meal => {
            const meta = SLOT_META[meal.slotKey] || { icon:'', label:meal.slotKey };
            const foodsHtml = _groupVeggies(meal.foods).map(f => {
              if (f.isSalad) return `
                <div style="display:flex;justify-content:space-between;align-items:center;
                            padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11.5px;">
                  <span style="color:var(--text);font-weight:600;">سلطة
                    <span style="font-size:9.5px;color:var(--text-dim);font-weight:400;"> (${f.saladNames})</span>
                  </span>
                  <span style="display:flex;gap:5px;align-items:center;flex-shrink:0;">
                    <span style="background:rgba(42,140,232,0.15);color:var(--blue);border-radius:4px;padding:1px 6px;font-weight:700;font-size:10.5px;">${f.grams}ج</span>
                    <span style="color:var(--accent);font-weight:700;font-size:10.5px;">${f.cals}</span>
                  </span>
                </div>`;
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;
                            padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11.5px;">
                  <span style="color:var(--text);font-weight:600;">${f.food.nameAr || f.food.id}</span>
                  <span style="display:flex;gap:5px;align-items:center;flex-shrink:0;">
                    <span style="background:rgba(42,140,232,0.15);color:var(--blue);border-radius:4px;padding:1px 6px;font-weight:700;font-size:10.5px;">${f.grams}ج</span>
                    <span style="color:var(--accent);font-weight:700;font-size:10.5px;">${f.cals}</span>
                    <span style="color:var(--green);font-size:10px;">${f.pro}ج</span>
                  </span>
                </div>`;
            }).join('');
            return `
              <div style="margin-bottom:8px;padding:8px;background:var(--surface3);border-radius:8px;">
                <div style="font-size:11.5px;font-weight:800;color:var(--text-muted);margin-bottom:5px;
                            display:flex;justify-content:space-between;align-items:center;">
                  <span>${meta.icon} ${meta.label}</span>
                  <span style="font-size:10px;color:var(--text-dim);">
                   ${meal.totalCals} |${Math.round(meal.totalPro||0)}ج |${Math.round(meal.totalCarb||0)}ج
                  </span>
                </div>
                ${foodsHtml}
              </div>`;
          }).join('');

          return `
            <div style="background:var(--surface2);border-radius:14px;padding:14px;
                        border:1px solid var(--border);display:flex;flex-direction:column;gap:6px;">
              <!-- Day header -->
              <div style="display:flex;justify-content:space-between;align-items:center;
                          border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:4px;">
                <div>
                  <div style="font-size:13px;font-weight:900;color:var(--text);">
                    ${dayName}
                    <span style="font-size:10px;color:var(--text-dim);font-weight:500;margin-right:4px;">
                      يوم ${dayIdx+1}
                    </span>
                  </div>
                  ${ccLabel ? `<span style="font-size:9.5px;font-weight:800;padding:1px 7px;border-radius:6px;
                    background:${ccBg};color:${ccColor};">${ccLabel}</span>` : ''}
                </div>
                <div style="text-align:left;">
                  <div style="font-size:15px;font-weight:900;color:var(--accent);">${dayTotalCals}</div>
                  <div style="font-size:9px;color:var(--text-dim);">
                   ${Math.round(dayTotalPro)}ج |${Math.round(dayTotalCarb)}ج |${Math.round(dayTotalFat)}ج
                  </div>
                </div>
              </div>
              <!-- Meals -->
              ${mealsHtml}
            </div>`;
        }).join('')}
      </div>`;
  }

  // ═══════════════════════════════════════════════════════
  //  PHASE NAVIGATION
  // ═══════════════════════════════════════════════════════
  function smpsGoPhase(n) {
    // Validate phase 1 before advancing
    if (n > 1) {
      const allReady = SMPS.slots.every(sk => (SMPS.pool[sk] || new Set()).size >= (SLOT_META[sk] || {minFoods:3}).minFoods);
      if (!allReady) {
        // Flash validation bar
        _validateAndUpdateNav();
        if (n > 1) return;
      }
    }

    SMPS.currentPhase = n;

    // Update phase buttons
    [1,2,3].forEach(i => {
      const btn = document.getElementById('smps-pb' + i);
      if (!btn) return;
      btn.className = 'smps-phase-btn' + (i < n ? ' done' : i === n ? ' active' : '');
    });

    // Show/hide phase panels
    [1,2,3].forEach(i => {
      const panel = document.getElementById('smps-phase-' + i);
      if (panel) panel.classList.toggle('active', i === n);
    });

    if (n === 2) {
      smpsGeneratePreview();
    }
    if (n === 3) {
      _generate90Day();
      _renderWeekTabs();
      smpsShowWeek(0);
    }

    // Scroll to top of step
    const step7 = document.getElementById('step-7');
    if (step7) step7.scrollIntoView({ behavior:'smooth', block:'start' });
  }
  window.smpsGoPhase = smpsGoPhase;

  // ═══════════════════════════════════════════════════════
  //  INIT — called when user arrives at step 7
  // ═══════════════════════════════════════════════════════
  function initStep7_SMPS() {
    SMPS.slots = _resolveSlots();
    // Init pools
    SMPS.slots.forEach(sk => {
      if (!SMPS.pool[sk]) SMPS.pool[sk] = new Set();
    });
    SMPS.currentPhase = 1;

    // Re-show phase 1
    [1,2,3].forEach(i => {
      const p = document.getElementById('smps-phase-' + i);
      if (p) p.classList.toggle('active', i === 1);
      const b = document.getElementById('smps-pb' + i);
      if (b) b.className = 'smps-phase-btn' + (i === 1 ? ' active' : '');
    });

    _renderSlots();
    _renderPoolSummary();
    _validateAndUpdateNav();

    // Update step indicator step-7 label if it exists
    LOG('✔ [v32-SMPS] Step 7 initialized — slots: ' + SMPS.slots.join(', '));
  }
  window.initStep7_SMPS = initStep7_SMPS;

  // ── Hook into goStep ──────────────────────────────────────────────
  // Wrap existing goStep to call initStep7_SMPS when step 7 is entered
  if (typeof goStep === 'function') {
    const _origGoStep = goStep;
    goStep = function(n) {
      _origGoStep(n);
      if (n === 7) {
        // Small delay to let DOM update
        setTimeout(initStep7_SMPS, 50);
      }
    };
    if (typeof LOG === 'function') LOG('✔ [v32-SMPS] goStep wrapped for step-7 init');
  }

  // Also expose initStep6 alias pointing to new system so old code doesn't crash
  window.initStep6 = function() {
    // old step 6 was food picker (now absorbed into SMPS phase 1)
    // no-op here — kept for backward compatibility
  };

  LOG('✔ [v32-SMPS] Smart Meal Pool System loaded — waiting for step 7');

})();

// ══ END v32 — SMART MEAL POOL SYSTEM ══