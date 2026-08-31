// ═══════════════════════════════════════════════════════════════
//  Nutrition Engine Facade v41 — Launch Lock Layer
//  Clean final engine surface after legacy global wrappers.
//  Goals:
//  - Pure meal-plan data object first, DOM rendering second.
//  - Calorie/macro reconciliation after medical caps.
//  - Human meal gates: no empty/rice-only/no-protein main meals.
//  - Deterministic, API-ready surface: window.NutritionEngine.
// ═══════════════════════════════════════════════════════════════
(function NutritionEngineFacadeV41(){
// [FIX-PROTEIN-ROTATION v3.0]
var _PROTEIN_USED_THIS_PLAN = {};
function _getProteinTypeKey(t) {
  t = (t || '').toLowerCase();
  if (t.indexOf('بلطي') >= 0 || t.indexOf('blty') >= 0) return 'blty';
  if (t.indexOf('بوري') >= 0 || t.indexOf('bwry') >= 0) return 'bwry';
  if (t.indexOf('ماكريل') >= 0 || t.indexOf('makryl') >= 0) return 'makryl';
  if (t.indexOf('سردين') >= 0 || t.indexOf('srdyn') >= 0) return 'srdyn';
  if (t.indexOf('تونة') >= 0 || t.indexOf('تونه') >= 0 || t.indexOf('twna') >= 0) return 'tuna';
  if (t.indexOf('سمك') >= 0 || t.indexOf('smk') >= 0) return 'fish';
  if (t.indexOf('صدر') >= 0 || t.indexOf('sdr_frakh') >= 0) return 'chicken_breast';
  if (t.indexOf('ورك') >= 0 || t.indexOf('wrk_frakh') >= 0) return 'chicken_thigh';
  if (t.indexOf('كفت') >= 0 || t.indexOf('kfta') >= 0) return 'kofta';
  if (t.indexOf('كباب') >= 0 || t.indexOf('kbab') >= 0) return 'kebab';
  if (t.indexOf('لحم') >= 0 || t.indexOf('lhm') >= 0) return 'beef';
  return null;
}
function _proteinRotationPenalty(food) {
  try {
    var t = ((food && food.id) || '') + ' ' + ((food && food.nameAr) || '');
    var key = _getProteinTypeKey(t);
    if (!key) return 0;
    var times = _PROTEIN_USED_THIS_PLAN[key] || 0;
    var penalty = 0;
    if (times >= 1) penalty += 20;
    if (times >= 2) penalty += 30;
    var fishKeys = ['blty','bwry','makryl','srdyn','tuna','fish'];
    if (fishKeys.indexOf(key) >= 0) penalty += 10;
    return penalty;
  } catch(e) { return 0; }
}
function _markProteinUsed(food) {
  try {
    var t = ((food && food.id) || '') + ' ' + ((food && food.nameAr) || '');
    var key = _getProteinTypeKey(t);
    if (key) _PROTEIN_USED_THIS_PLAN[key] = (_PROTEIN_USED_THIS_PLAN[key] || 0) + 1;
  } catch(e) {}
}

  if (typeof window === 'undefined') return;
  const L = (msg) => { try { if (typeof LOG === 'function') LOG(msg); } catch(e){} };

  const _origCalcMacros = (typeof calcMacros === 'function') ? calcMacros : null;
  const _origBuildSmartMealPlan = (typeof buildSmartMealPlan === 'function') ? buildSmartMealPlan : null;

  const LABELS = { breakfast:'الفطار', pre:'قبل التمرين', post:'بعد التمرين', lunch:'الغداء', dinner:'العشاء', snack:'السناك' };
  const DESC   = { breakfast:'شبع + طاقة مستقرة', pre:'طاقة خفيفة قبل التمرين', post:'تعافي + بناء عضلي', lunch:'وجبة رئيسية كاملة', dinner:'عشاء مريح للهضم', snack:'سناك خفيف ومشبع' };


  // ── Low-carb final food gate ─────────────────────────────────────
  // Low-carb ≠ zero-carb. The legacy allowedDiets field was hiding most
  // explicit carb foods because many DB rows only list balanced/carbcycle.
  // Final rule: allow measured complex/whole carb sources in lowcarb, while
  // still blocking refined/sugary/fried/high-carb foods and all medical blocks.
  function _v41Norm(s){
    return String(s||'').replace(/[\u064B-\u0652\u0670\u0640]/g,'')
      .replace(/[أإآ]/g,'ا').replace(/[ةه]/g,'ه').replace(/[يى]/g,'ي')
      .replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ء/g,'').toLowerCase();
  }
  function _v41HasAny(food, words){
    const hay = _v41Norm((food.nameAr||'')+' '+(food.nameEn||'')+' '+safeArr(food.tags).join(' '));
    return words.some(w => hay.indexOf(_v41Norm(w)) !== -1);
  }
  function _v41LowcarbComplexCarbAllowed(food){
    if (!food || food.cat !== 'carb') return false;
    const carb = +food.carb || 0;
    const proc = food.processedLevel || 'none';
    const refined = _v41HasAny(food, ['ارز ابيض','عيش ابيض','خبز ابيض','توست ابيض','فينو','مكرونه','مكرونة','باستا','شعيرية','كشري','ارز بالشعريه','ارز بالشعرية','محشي','رايس كيك','سكر','عسل','تمر','بلح','شيبسي']) || proc === 'high' || proc === 'very_high';
    const fried = _v41HasAny(food, ['مقلي','مقلية','شيبسي']);
    if (refined || fried) return false;
    // Cooked complex carbs/legumes/tubers/veg-like carb rows are acceptable
    // in controlled low-carb portions. Per-meal caps are handled by macros.
    if (carb <= 30) return true;
    // Whole bread can be moderate but still too dense for the current low-carb UI pool.
    return false;
  }
  function _v41MedicalBlocked(food){
    for (const hc of safeArr(DE && DE.healthConditions)) {
      const rules = (typeof HEALTH_MEAL_RULES !== 'undefined') ? HEALTH_MEAL_RULES[hc] : null;
      if (rules && safeArr(rules.avoidFoods).includes(food.id)) return true;
      if (Array.isArray(food.avoidHealth) && food.avoidHealth.includes(hc)) return true;
      if (Array.isArray(food.blockedConditions) && food.blockedConditions.includes(hc)) return true;
    }
    return false;
  }
  // Carnivore final gate. The legacy `allowedDiets` field on most foods lists
  // only balanced/carbcycle, so the old isFoodAllowed wrongly blocked EVERY
  // animal food in carnivore -> 100% empty plans. Recompute from the diet's own
  // category contract (DIET_CONSTRAINTS.carnivore.allowedCats) + medical safety.
  function _v41CarnivoreAllowed(food){
    if (!food) return false;
    const c = (typeof DIET_CONSTRAINTS !== 'undefined') ? DIET_CONSTRAINTS.carnivore : null;
    const cats = (c && Array.isArray(c.allowedCats) && c.allowedCats.length) ? c.allowedCats : ['protein','fat'];
    if (safeArr(c && c.forbiddenFoods).includes(food.id)) return false;
    if (cats.includes(food.cat)) {
      // Keep carnivore genuinely near-zero-carb: reject hidden-carb items.
      if ((+food.carb || 0) > 8) return false;
      return true;
    }
    // Eggs/cheese-style animal foods sometimes tagged as dairy: allow if very low carb.
    if (food.cat === 'dairy' && (+food.carb || 0) <= 5) return true;
    return false;
  }
  // فلتر طبي قائم على القواعد — يغطي الحالات اللي مالهاش (أو ليها قليل) وسوم avoidHealth في قاعدة البيانات
  function _healthRuleBlock(food, health){
    if(!food || !Array.isArray(health) || !health.length) return null;
    var t=(((food.nameAr||'')+' '+(food.id||'')+' '+((food.tags||[]).join(' ')))).toLowerCase();
    var has=function(k){return health.indexOf(k)>-1;};
    var carb=+food.carb||0, fat=+food.fat||0, pro=+food.pro||0, cat=food.cat||'';
    var sweet=/سكر|عسل|مربى|شوكولا|شيكولا|حلاوة|بسبوسة|كنافة|كيك|بسكوت|دبس|sugar|honey|jam|syrup/.test(t);
    var concSugar=(cat!=='fruit'&&cat!=='veggie'&&carb>=45&&pro<6);
    var fried=/مقلي|مقلية|محمر|طعمية|fried/.test(t);
    var processedMeat=/لانشون|بسطرمة|سجق|هوت دوج|نقانق|سلامي|salami|sausage|bacon|luncheon/.test(t);
    var organ=/كبد|كلاوي|مخ|قلوب|كوارع|ممبار|طحال|organ|liver|brain/.test(t);
    var verySalty=/مخلل|مملح|فسيخ|رنجة|مدخن|سردين معلب|salted|pickle/.test(t);
    var highSatFat=(cat==='fat'&&/زبد|سمن|شحم|دهن|butter|ghee|lard/.test(t))||/كريمة|قشطة|سمنة/.test(t);
    if((has('diabetes')||has('insulin'))&&(sweet||concSugar)) return 'سكريات سريعة — غير مناسب للسكري/مقاومة الإنسولين';
    if(has('fatty-liver')&&(sweet||fried||concSugar)) return 'سكريات/مقليات تزيد دهون الكبد';
    if(has('cholesterol')&&(highSatFat||fried||processedMeat)) return 'دهون مشبعة عالية — غير مناسب للكولسترول';
    if(has('bp')&&(processedMeat||verySalty)) return 'صوديوم عال — غير مناسب لضغط الدم';
    if(has('gout')&&(organ||/سردين|أنشوجة|انشوجة/.test(t))) return 'بيورين عال — يزيد النقرس';
    if(has('kidney')&&organ) return 'غير مناسب لمشاكل الكلى';
    if(has('gerd')&&(fried||/شطة|فلفل حار|حار|spicy/.test(t))) return 'يهيج الحموضة';
    return null;
  }
  if (typeof isFoodAllowed === 'function') {
    const _v41PrevIsFoodAllowed = isFoodAllowed;
    isFoodAllowed = function isFoodAllowed(food){
      if (!food) return { ok:false, reason:'لا يوجد عنصر غذائي' };
      try{ var _hc=(typeof DE!=='undefined'&&Array.isArray(DE.healthConditions))?DE.healthConditions:[]; if(_hc.length){ var _hb=_healthRuleBlock(food,_hc); if(_hb) return { ok:false, reason:_hb }; } }catch(_e){}
      const diet = (typeof DE !== 'undefined' && DE.selectedDiet) ? DE.selectedDiet : 'balanced';
      if (diet === 'lowcarb' && _v41LowcarbComplexCarbAllowed(food) && !_v41MedicalBlocked(food)) {
        return { ok:true, reason:'كارب معقد مسموح في لو كارب بكمية محسوبة' };
      }
      if (diet === 'carnivore') {
        if (_v41MedicalBlocked(food)) return { ok:false, reason:'ممنوع لحالة صحية' };
        if (_v41CarnivoreAllowed(food)) return { ok:true, reason:'مسموح في كارنيفور (بروتين/دهون)' };
        return { ok:false, reason:'غير مناسب لنظام كارنيفور' };
      }
      return _v41PrevIsFoodAllowed(food);
    };
  }

  function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
  function round5(n){ return Math.round(n/5)*5; }
  function kcalOf(m){ return (m.protein||0)*4 + (m.carbs||0)*4 + (m.fat||0)*9; }
  function safeArr(x){ return Array.isArray(x) ? x : []; }

  // ── [EGY] ذكاء الوجبات المصري — منطق أخصائي تغذية مصري ثابت ──────────
  //  • الفطار المصري = بيض/جبنة/فول/عيش — مش رز ولا مكرونة.
  //  • الزيت "للطبخ" مش عنصر يتشرب - نفضل دهون كاملة (طحينة/مكسرات/زبدة).
  //  • الوجبة الكبيرة (غدا/عشا) = بروتين حيواني أولا.
  function _egyText(food){ return ((food&&food.nameAr)||'')+' '+((food&&food.id)||''); }
  function _egyIsOil(food){ return !!food && food.cat==='fat' && /زيت|سمن|^zyt|_zyt|^smn/.test(_egyText(food)); }
  function _egyBreakfastCarbOk(food){
    // يستبعد من الفطار: رز/مكرونة/كشري/شعرية/باستا
    return !/أرز|ارز|رز |مكرون|كشري|كشرى|شعري|باستا|spaghetti|arz|mkrwn|kshry|sharya|basta/i.test(_egyText(food));
  }
  function _egyDiet(context){ return (context&&context.diet)||'balanced'; }
  function _egyKeto(context){ return ['keto','carnivore'].includes(_egyDiet(context)); }
  // اختيار دهون: نفضل دهون كاملة (طحينة/مكسرات/زبدة)، والزيت آخر حاجة وللكيتو فقط
  function _egyPickFat(pools, slot, context, usedIds){
    const cands = pools.selected.concat(pools.global).filter(f => f && f.cat==='fat').filter(f => _egyEligibleForSlot(f, slot));
    // [EGY-v52.4] بذور سايبة (سمسم/لب) مش صنف يتاكل في وجبة — نفضل طحينة/زيت/سوداني
    const noSeed = slot==='snack' ? cands : cands.filter(f => !/سمسم|smsm|لب |لب أبيض|لب ابيض|لب سوري|بزر|bzr|seeds/.test((f.nameAr||'')+' '+(f.id||'')));
    const base = noSeed.length ? noSeed : cands;
    const fresh = base.filter(f => !usedIds.has(f.id));
    const list  = fresh.length ? fresh : base;
    const whole = list.filter(f => !_egyIsOil(f));
    const pickFrom = whole.length ? whole : list;
    return pickFrom.sort((a,b)=>scoreFood(b,slot,context)-scoreFood(a,slot,context))[0] || null;
  }
  // [EGY-v52.4] طبق سلطة بلدي: خيار + طماطم + بصل/جزر (مش صنف خضار واحد)
  function _egyAddSalad(portions, pools, slot, context, usedIds, totalG){
    const pool = pools.selected.concat(pools.global).filter(f => f && f.cat==='veggie' && _egyEligibleForSlot(f, slot));
    const want = ['خيار|khyar','طماطم|tmatm','خس|khs','جزر|jzr','كابوتشا|kabwtsha','فلفل|flfl','جرجير|jrjyr','فجل|fjl','بصل|bsl'];
    const picked = [];
    want.forEach(rx => {
      if (picked.length >= 3) return;
      const m = pool.find(f => new RegExp(rx).test((f.nameAr||'')+' '+(f.id||'')) && !picked.some(x=>x.id===f.id));
      if (m) picked.push(m);
    });
    if (!picked.length && pool.length) picked.push(pool[0]);
    const per = Math.max(45, Math.round(totalG / Math.max(1, picked.length)));
    // [OWNER-RULE] بنوسم عناصر السلطة بـ _salad عشان تترتب في العرض
    // بعد الخضار والكارب (بروتين → خضار → كارب → سلطة).
    picked.forEach(f => addByMacro(portions, f, per, slot, {_salad:true}));
    // [EGY-v52.8] حمص مسلوق على السلطة = طبق أغنى
    if (slot==='lunch' && context && dietAllowsCarb(context.diet)){
      const hummus = pools.selected.concat(pools.global).find(f => f && /حمص مسلوق|hmsmslwq/.test((f.nameAr||'')+' '+(f.id||'')) && !usedIds.has(f.id));
      if (hummus) addByMacro(portions, hummus, 25, slot, {_salad:true});
    }
    return picked.length;
  }
  // اختيار نشويات بقاعدة الفطار المصري (مفيش رز للفطار)
  // [EGY-v52.8] نوع البروتين عشان نقرنه بالكارب الصح
  function _egyProteinKind(food){
    if (!food) return 'other';
    const t = _egyText(food);
    if (/تونة|twna|tuna/.test(t)) return 'tuna';
    if (/سمك|smk|بلطي|blty|ماكريل|makryl|سردين|srdyn|سلمون|slmwn|بوري|bwry|رنجة|rnja|فسيخ|fsykh|فيليه|fylyh|قاروص|دنيس|موسى|بربوني|بلاميط|سنجاري|مرجان|وقار/.test(t)) return 'fish';
    if (/فراخ|frakh|دجاج|djaj|صدر|sdr|ورك|wrk|جناح|jnah|كبد|kbd|بانيه|banyh|شاورما|shawrma|كفتة|kfta|كباب|kbab|لحم|lhm|بقري|bqry|مفروم|mfrwm|ضاني|dany|ستيك|روست|rwst|سجق|sjq|بسطرم|bstrm/.test(t)) return 'meat';
    return 'other';
  }
  // [EGY-v52.8] قاعدة الإقران: فراخ/لحمة - رز، سمك - عيش/رز، تونة - عيش/سلطة (مش رز)
  function _egyCarbAffinity(carb, pk){
    if (!carb || carb.cat!=='carb' || pk==='other') return 0;
    const t = _egyText(carb);
    const heavy = /أرز|ارز|arz|مكرون|mkrwn|كشري|kshry|باستا|basta|شعري|sharya/.test(t);
    const bread = /عيش|توست|خبز|aysh|twst|tost|bread/.test(t);
    const potato = /بطاطس|بطاطا|btats|btata/.test(t);
    if (pk==='tuna'){ if (heavy) return -50; if (bread) return 26; if (potato) return 12; return 0; }
    if (pk==='meat'){ if (heavy) return 22; if (potato) return 16; if (bread) return -18; return 0; }
    if (pk==='fish'){ if (bread) return 16; if (heavy) return 12; if (potato) return 12; return 0; }
    return 0;
  }
  function _egyPickCarb(pools, slot, context, usedIds, proteinFood){
    // [EGY-v71] الفطار: مصدر الكارب لازم يكون كارب حقيقي (عيش/رايس كيك)، مش فاكهة زي التمر — قاعدة قاطعة.
    const cats = slot==='pre' ? ['fruit','carb'] : slot==='breakfast' ? ['carb'] : ['carb','fruit'];
    const noRepeat = slot!=='pre';
    const pk = _egyProteinKind(proteinFood);
    const sc = (f)=> scoreFood(f,slot,context) + _egyCarbAffinity(f, pk);
    const sel = (pool,nr)=> (pool
      .filter(f => cats.includes(f.cat))
      .filter(f => _egyEligibleForSlot(f, slot))
      .filter(f => slot!=='breakfast' || f.cat!=='carb' || _egyBreakfastCarbOk(f))
      .filter(f => f.id!=='arzbnymtbwkh' || (context && context.diet==='mediterranean'))
      .filter(f => !(nr && usedIds.has(f.id)))
      .sort((a,b)=>sc(b)-sc(a))[0]) || null;
    return sel(pools.selected,noRepeat) || sel(pools.global,noRepeat) || sel(pools.global,false);
  }

  // [EGY-v52] أهلية الصنف للوجبة — قانون صارم واقعي للمطبخ المصري.
  function _egyEligibleForSlot(food, slot){
    if (!food) return false;
    // [EGY-v72] فلتر الموسم — عناصر خارج موسمها لا تدخل الوجبات.
    if (food && Array.isArray(food.season)) {
      var _sm = new Date().getMonth() + 1;
      if (!food.season.includes(_sm)) return false;
    }
    const mt = Array.isArray(food.mealTypes) ? food.mealTypes : null;
    // [EGY-v71] عناصر pool السناك ممنوعة قاطع في الوجبات الرئيسية (فطار/غدا/عشا/بعد التمرين).
    if (food.cat === 'snack' && ['breakfast','lunch','dinner','post'].includes(slot)) {
      return false;
    }
    if (!mt) return true;
    if (slot === 'breakfast') {
      // [EGY-v72] سوداني/مكسرات/دهون مش فطار مصري طبيعي → ممنوع قاطع من الفطار.
      if (food.cat === 'fat' && /(swdany|fstq|peanut|مكسرات|loz|cashw|kasaw|جوز|lbswy|محمص)./.test((food.id||'')+(food.nameAr||''))) return false;
      return mt.includes('breakfast');
    }
    if (slot === 'pre')       return mt.includes('pre') || mt.includes('breakfast') || mt.includes('snack');
    if (slot === 'snack' || slot === 'snack2') return mt.includes('snack') || mt.includes('pre');
    if (slot === 'lunch' || slot === 'dinner' || slot === 'post')
      return mt.includes('lunch') || mt.includes('dinner') || mt.includes('post');
    return true;
  }

  function foodCals(food, grams){ return Math.round((food.cal||0) * grams / 100); }
  // أي شوكولاتة بأي اسم أو أي معرف — دارك، باللبن، مندولين، نوتيلا.
  function isChocolate(food){
    if (!food) return false;
    const t = String(food.id||'') + ' ' + String(food.nameAr||'') + ' ' + String(food.nameEn||'');
    return /choc|شوكولات|شيكولات|شوكولاط|nutella|نوتيلا|مندولين|kitkat|كيتكات/i.test(t);
  }
  function portion(food, grams, flags){
    grams = round5(grams);
    // سقف الشوكولاتة بيتطبق هنا كمان لأن في مسارات بتنده من غير ما تمر على gramLimits.
    if (isChocolate(food) && grams > 30) grams = 30;
    const p = { food, grams, cals: foodCals(food, grams),
      pro:+(((food.pro||0)*grams/100).toFixed(1)),
      carb:+(((food.carb||0)*grams/100).toFixed(1)),
      fat:+(((food.fat||0)*grams/100).toFixed(1)) };
    if (flags) Object.assign(p, flags);
    return p;
  }
  function totals(portions){
    return portions.reduce((a,p)=>({
      cals:a.cals+(p.cals||0),
      pro:+(a.pro+(p.pro||0)).toFixed(1),
      carb:+(a.carb+(p.carb||0)).toFixed(1),
      fat:+(a.fat+(p.fat||0)).toFixed(1)
    }),{cals:0,pro:0,carb:0,fat:0});
  }

  function gramLimits(food, slot){
    const cat = food.cat;
    const id  = food.id || '';
    // [OWNER-RULE] الشوكولاتة ماتزيدش عن 30 جم أبداً مهما حصل.
    // القاعدة متحطوطة فوق كل حاجة عشان مايفرقش معاها التصنيف
    // (snack ولا fat ولا dairy) ولا الوجبة اللي بتتحط فيها.
    if (isChocolate(food)) return [10,30];
    if (cat === 'fat') return /oil|zyt|زيت/i.test(id) ? [5,25] : [10,45];
    if (cat === 'veggie') return [60,220];
    if (cat === 'fruit') {
      if (/tmr|zbyb/.test(id) || /تمر|زبيب|عجوة/.test(food.nameAr||'')) return [40,60]; // تمر/زبيب سكر مركز — حصة صغيرة
      return slot === 'pre' || slot === 'snack' ? [80,220] : [60,160];
    }
    if (cat === 'dairy') return [80,250];
    if (cat === 'carb') return slot === 'pre' ? [60,220] : [70,330];
    if (cat === 'protein') return slot === 'breakfast' ? [70,220] : [90,280];
    if (cat === 'snack') return [20,100];
    return [30,250];
  }

  // [OWNER-RULE] عيش الشوفان ممنوع نهائيا من التوليد التلقائي بطلب صاحب المشروع.
  // مش منتج مصري شعبي ولا متوفر في البيوت، وكان بيظهر في العشاء والفطار.
  // البديل الطبيعي: العيش الاسمر ثم القمح الكامل ثم الابيض ثم الرايس كيك.
  // ملاحظة: الشوفان المطبوخ (shwfanmtbwkh) مسموح لانه اكل حقيقي ومطلوب طبيا
  // في بعض الحالات (كوليسترول/كبد دهني)، الممنوع هو "عيش الشوفان" بس.
  const OWNER_BLOCKED_IDS = ['ayshalshwfan'];

  function isAllowed(food, context){
    if (!food) return false;
    if (OWNER_BLOCKED_IDS.includes(food.id || '')) return false;
    try { if (typeof isFoodAllowed === 'function' && !isFoodAllowed(food).ok) return false; } catch(e){}
    for (const hc of safeArr(context.health)) {
      const rules = (typeof HEALTH_MEAL_RULES !== 'undefined') ? HEALTH_MEAL_RULES[hc] : null;
      if (rules && safeArr(rules.avoidFoods).includes(food.id)) return false;
      if (Array.isArray(food.avoidHealth) && food.avoidHealth.includes(hc)) return false;
      if (Array.isArray(food.blockedConditions) && food.blockedConditions.includes(hc)) return false;
    }
    return true;
  }

  // [EGY-v52.1] طبقة الشعبية المصرية — ترفع الأكل البيتي الشعبي وتخفض الغريب/المودرن.
  // [EGY-v52.6] طبقة السعر + توحيد العناصر: نفضل الاكل العادي الرخيص المتاح
  function _egyCostCanon(food){
    const t = (food.nameAr||'') + ' ' + (food.id||'');
    let s = 0;
    // غالي جدا (سلمون/جمبري/كابوريا/استاكوزا/تونة فريش) — مش لواحد عادي
    if (/سلمون|slmwn|جمبري|jmbry|كابور|kabwry|استاكوز|lobster|تونة فريش|twna_frysh|سوشي|روبيان/.test(t)) s -= 60;
    // غالي شوية (لحوم فاخرة/مدخنة/كباب)
    if (/ضاني|dany|جمل|jml|بتلو|btlw|انتركوت|antrkwt|اسكالوب|iskalwb|ريش|rysh|ماعز|maaz|لحمة راس|lhma_ras|مدخن|mdkhn|بسطرم|bstrm/.test(t)) s -= 32;
    // غريبة/مش منتشرة للطبقة الشعبية (سوابع/طيور خاصة/أسماك فاخرة) — بدون اختراعات
    if (/مخ |mkh_bqry|كلاوي|klawy|طحال|thal|كرشة|krsha|كوارع|kwara|عكاوي|akawy|حمام|hmam|سمان|sman|أرنب|arnb|سبيط|sbyt|كاليمار|kalymar|قاروص|qarws|دنيس|dnys|روست بيف|rwst_byf|بربوني|brbwny|بلاميط|blamyt|سنجاري|snjary|مرجان|mrjan|وقار|wqar|موسى|mwsa/.test(t)) s -= 45;
    // زبادي يوناني: غالي ومش شعبي — نفضل العادي
    if (/يوناني|ywnany/.test(t)) s -= 40;
    // توحيد: نفضل الشكل الشعبي الواحد (تونة عادية / صدر فراخ / بلطي مشوي / زبادي عادي)
    if (/تونة بالزيت|qta_twna_balzyt|تونة لايت|twna_layt|تونة مياه|twna_myah/.test(t)) s += 14;
    if (/صدر فراخ مشوي|sdr_frakh_mshwy|ورك فراخ مشوي|wrk_frakh_mshwy|كبدة فراخ|kbda_frakh|جناح فراخ مشوي|jnah_frakh_mshwy/.test(t)) s += 12;
    s -= _proteinRotationPenalty(t); // [FIX] rotation penalty
    if (/كفتة|kfta|كباب مشوي|kbab_mshwy|لحمه مسلوق|lhm_bqry_mslwq|مفروم قليل|qlyl_aldhn/.test(t)) s += 10;
    if (/فيليه بلطي|fylyh_blty|ماكريل مشوي|makryl_mshwy|سردين مشوي|srdyn_mshwy/.test(t)) s += 10;
    if (/زبادي طبيعي|zbadytbyay|زبادي لايت|zbadylayt/.test(t)) s += 8;
    // خصم خفيف للأنواع الزيادة/الغريبة من نفس العيلة
    if (/تونة مدخنة|twna_mdkhna|قوانص|qwans|سمك بياض|smk_byad|سمك مكرونه|smk_mkrwnh|رنجة|rnja|فسيخ|fsykh/.test(t)) s -= 10;
    return s;
  }
  function _egyPopularity(food){
    if (!food) return 0;
    var t = _egyText(food); var cat = food.cat;
    // خضار غير شعبي على المائدة المصرية
    if (/بروكلي|brwkly|قرنبيط|qrnbyt|فطر|عيش الغراب|ftraysh|كرفس|krfs|جنزبيل|jnzbyl|لفت|lft|كراث|krath/.test(t)) return -55;
    // تحضيرات/أصناف مودرن مش دارجة
    if (/سوتيه|swtyh|كينوا|qynwa|شوفان|shwfan|رايس كيك|rayskyk/.test(t)) return -45;
    // فاكهة غريبة/غالية
    if (cat==='fruit' && /افوكادو|أفوكادو|afwkadw|التنين|tnyn|باشن|bashn|كرز هندي|كيوي|kywy|جريب|jryb|سابوتا|sabwta|نبق/.test(t)) return -35;
    // مكسرات فاخرة/دهون مستوردة
    if (cat==='fat' && /مكاديميا|mkadymya|بيكان|bykan|كاجو|kajw|زبدة لوز|زبدة كاجو|جوز الهند|jwzalhnd|بندق|bndq|فستق|fstq/.test(t)) return -30;
    // أجبان مستوردة/غير دارجة
    if (cat==='dairy' && /بارميزان|موزاريلا|حلوم|ريكوتا|rykwta|جودة|إيدام|ايدام|فلامنك|براميلي|دوبل كريم|كريمي/.test(t)) return -30;
    if (/حليب لوز|حليب شوفان|حليب ارز|حليب صويا|حليب جوز/.test(t)) return -25;
    // === الأساسيات الشعبية (S) ===
    if (/فول مدمس|fwlmdms|عدس|ads|كشري|kshry/.test(t)) return 40;
    // [EGY-v52.8] تفضيل الأرز المصري: بسمتي/أبيض أولا، وبعدهم البني
    if (cat==='carb' && (/بسمتي|bsmty/.test(t) || /أرز أبيض|ارز ابيض|arzabyd/.test(t))) return 40;
    if (cat==='carb' && /أرز بني|ارز بني|arzbny|bnymtbwkh/.test(t)) return 35;
    if (cat==='carb' && /بطاطس مشو|بطاطا مشو|بطاطا في الفرن|بيوريه|btatsmshw|btatamshw|btatafyalfrn|bywryh|fyalfrn/.test(t)) return 38; // [EGY-v52.10] المشوي/الفرن/البيوريه مفضل
    if (cat==='carb' && /بطاطس مسلو|بطاطا مسلو|btatsmslw|btatamslw/.test(t)) return 24; // [EGY-v52.10] المسلوق أقل تفضيلا من المشوي
    if (cat==='carb' && /رز|ارز|أرز|arz|عيش|aysh|مكرونة|mkrwna|بطاطس|btats|شعري/.test(t)) return 32;
    if (cat==='protein' && /رومي|rwmy|بط|حمام|hmam|ارنب|أرنب|arnb|سمان|sman|جمل|jml|كوارع|kwara|عكاوي|akawy|طرب|كرشة|krsha|كلاوي|klawy|طحال|thal|لانشون|lanshwn|سجق/.test(t)) return -38; // [EGY-v52.2] بروتينات مش يومية للمصري
    if (cat==='protein' && /بيض|byd|فراخ|frakh|صدر|sdr|تونة|twna|بلطي|blty|بوري|bwry|ماكريل|makryl|سردين|srdyn|كفتة|kfta|كباب|kbab|لحم|lhm|كبدة|kbda/.test(t) && !/مقلي|mqly|بانيه|banyh|ناجتس|لانشون|سجق|بسطرمة|ريش|مخ /.test(t)) return 30;
    if (cat==='veggie' && /خيار|khyar|طماطم|tmatm|فلفل|flfl|جزر|jzr|بصل|bsl|خس|khs|جرجير|jrjyr|فجل|fjl|كوسة|kwsa|باذنجان|baznjan/.test(t)) return 30;
    if (cat==='dairy' && /قريش|qrysh|بيضاء|byda|زبادي|zbady|لبن|lbn|دمياطي|فيتا|رومي|شيدر|مثلثات|حليب طبيع/.test(t)) return 28;
    if (cat==='fruit' && /موز|mwz|تفاح|tfah|برتقال|brtqal|بطيخ|btykh|فراولة|frawla|عنب|anb|مانجو|manjw|بلح|blh|جوافة|jwafa|يوسفي|ywsfy|شمام|shmam|رمان|rman|تين|tyn|كمثرى|خوخ|مشمش/.test(t)) return 26;
    if (cat==='fat' && /زيت زيتون|zytzytwn|طحينة|thyna|سمسم|smsm|سوداني|swdany|لب أبيض|لب ابيض|لب سوري|زبدة فول/.test(t)) return 18;
    // === شعبي مقبول (A) ===
    if (/محشي|mhshy|ملوخية|mlwkhya|بامية|bamya|فاصوليا|faswlya|بسلة|bsla|لوبيا|lwbya|حمص|hms|سبانخ|sbankh|ورق عنب/.test(t)) return 14;
    if (cat==='snack' && /فشار|popcorn|شوكولات|شيكولات|choc|عصير|juice|تمر|عسل/.test(t)) return 10;
    return 0;
  }

  function scoreFood(food, slot, context){
    let s = 50;
    try { if (typeof scoreFoodForContext === 'function') s = scoreFoodForContext(food, slot, context); } catch(e){}
    if (Array.isArray(food.mealTypes)) s += food.mealTypes.includes(slot) ? 18 : -10;
    if (food.processedLevel === 'none' || food.processedLevel === 'minimal') s += 8;
    if (food.processedLevel === 'high' || food.processedLevel === 'very_high') s -= 15;
    if ((food.healthyScore||0) >= 8) s += 6;
    if (slot === 'pre' && (food.fat||0) > 10) s -= 25;
    if (slot === 'post' && food.cat === 'protein') s += 20;
    if (slot === 'post' && food.cat === 'carb') s += 15;
    if (slot === 'dinner' && food.cat === 'fruit') s -= 30;
    if (slot === 'dinner' && food.cat === 'dairy' && /زبادي|زبادى|zbady/.test(_egyText(food))) s += 20; // [EGY-v64] الزبادي مكانه العشا
    // ── [EGY] منطق غذائي مصري ──────────────────────────────────
    const _t = _egyText(food);
    if (slot === 'breakfast') {
      if (food.cat === 'protein') {
        if (/بيض|byd|بياض/.test(_t)) s += 30;                       // البيض أساس الفطار
        else if (/تونة|سمك|سلمون|سردين|روبيان|جمبري|twna|smk/.test(_t)) s -= 55; // مفيش سمك للفطار
        else if (/فراخ|دجاج|لحم|كبدة|كفتة|كباب|بفتيك|بانيه|frakh|lhm|kbab|kfta/.test(_t)) s -= 35; // مفيش مشويات للفطار
      }
      if (food.cat === 'dairy') { if (/جبن|jbn|قريش|qrysh/.test(_t)) s += 34; else if (/زبادي|زبادى|zbady/.test(_t)) s += 4; else s += 20; }                            // جبنة/زبادي للفطار
      if (/فول|طعمية|tamya|fwl/.test(_t)) s += 26;                   // فول وطعمية
      if (food.cat === 'carb' && !_egyBreakfastCarbOk(food)) s -= 60; // رز/مكرونة للفطار = لأ
    }
    if (slot === 'lunch' || slot === 'dinner' || slot === 'post') {
      if (food.cat === 'protein') {
        s += 16;                          // بروتين حيواني أولا للوجبة الكبيرة
        if (/تونة|twna/.test(_t)) s -= 12; // [EGY-v56] التونة متاحة لكن الأولوية للسمك الطازج
      }
    }
    if (_egyIsOil(food) && !_egyKeto(context)) s -= 22;             // الزيت للطبخ مش عنصر يتاكل
    if ((slot==='lunch'||slot==='dinner') && food.cat==='carb' && /صويا|swya|ترمس|trms/.test(_t)) s -= 45; // [EGY] فول صويا/ترمس مش وجبة رئيسية
    if (food.cat === 'fat' && !_egyIsOil(food)) s += 6;             // دهون كاملة (طحينة/مكسرات/زبدة) مفضلة
    if (slot === 'pre') {
      if (food.cat==='fruit' && /موز|mwz|تمر|tmr/.test(_t)) s += 40; // الأمثل قبل التمرين
      else if (food.cat==='fruit' && /عنب|anb|مانجو|manjw|تين|tyn|زبيب|zbyb|عصير|juice|عسل/.test(_t)) s += 24;
      else if (food.cat==='fruit') s += 10;
      if (/قهوة|coffee/.test(_t)) s += 28; // قهوة سادة قبل التمرين
      if (food.cat==='dairy') s -= 28; // مش وقت الزبادي/اللبن
      if (food.cat==='carb' && /عدس|ads|فول|fwl|فاصوليا|faswlya|حمص|hms|لوبيا|lwbya|بسلة|bsla|ترمس|trms/.test(_t)) s -= 30; // بقوليات بطيئة
      if (food.cat==='protein') s -= 15; // مش وجبة بروتين دسمة
    }
    // [EGY-v65] تفضيلات العقل الافتراضي (لما المستخدم ما يحددش أكل): الصدر > الورك، القريش (الأولى) > رودس طبيعي (الثانية)
    if (food.cat === 'protein') {
      if (/صدر|sdr/.test(_t)) s += 14;        // الصدر أفضل (أقل دهون/أعلى بروتين)
      else if (/ورك|wrk/.test(_t)) s -= 8;    // الورك أقل تفضيلا من الصدر
    }
    if (food.cat === 'dairy') {
      if (/قريش|qrysh/.test(_t)) s += 16;     // [EGY] أولوية الجبن الأولى: قريش
      else if (/رودس|rwds|rodes|جولد|gwld/.test(_t)) s += 12; // [EGY] أولوية الجبن الثانية: رودس طبيعي
    }
    try { var _pr2 = (typeof window!=='undefined' && window.ELF_PRIORITY_RANK && window.ELF_PRIORITY_RANK[food.id]!=null) ? window.ELF_PRIORITY_RANK[food.id] : -1; if (_pr2>=0) s += Math.max(0, 60 - _pr2*3); } catch(e){} // [EGY-v64] أولوية الترتيب
    s += _egyPopularity(food);
    s += _egyCostCanon(food);                                       // [EGY-v52.6] السعر + توحيد العناصر                                      // [EGY-v52.1] طبقة الشعبية المصرية
    return s;
  }

  function getSlots(){
    // يطابق منطق المعالج (buildSlots) بالظبط عشان نفس عدد وهوية الوجبات
    const gym = DE && DE.workoutType === 'gym';
    const mc = Math.max(2, (DE && DE.mealCount) || 3); // [EGY-v72] دايماً 2 وجبات كحد أدنى
    let slots;
    // [EGY-v72] جيم → وجبة قبل التمرين تلقائياً بغض النظر عن عدد الوجبات
    if (gym && mc >= 4) slots = ['breakfast','pre','post','dinner'];
    else if (gym && mc >= 3) slots = ['breakfast','pre','lunch','dinner'];
    else if (gym && mc >= 2) slots = ['breakfast','pre','dinner'];
    else if (mc <= 2) slots = ['breakfast','dinner'];
    else if (mc === 3) slots = ['breakfast','lunch','dinner'];
    else if (mc === 4) slots = ['breakfast','lunch','snack','dinner'];
    else slots = ['breakfast','snack','lunch','snack2','dinner'];
    return slots;
  }

  function calorieShares(slots){
    const hasPre = slots.includes('pre'), hasPost = slots.includes('post');
    // Per-slot base shares. Critical: every possible slot (incl. snack) has a
    // value so a slot can never receive a 0 budget and render as an empty card.
    const base = (hasPre || hasPost)
      ? { breakfast:.22, pre:.13, post:.27, lunch:.23, dinner:.25, snack:.10, snack2:.10 }
      // [EGY-v72] توزيع متوازن: الفطار مش أكبر وجبة، الغداء هو الأكبر
      : { breakfast:.25, lunch:.38, dinner:.27, snack:.10, snack2:.10 };
    const map = {};
    slots.forEach(s => map[s] = base[s] || (1/slots.length));
    // Snack floor: guarantee a meaningful budget if a snack slot exists.
    if (slots.includes('snack') && map.snack < .06) map.snack = .08;
    if (slots.includes('snack2') && map.snack2 < .06) map.snack2 = .08;
    const sum = slots.reduce((a,s)=>a+(map[s]||0),0) || 1;
    slots.forEach(s => map[s] = map[s]/sum);
    return map;
  }

  function resolvePool(context){
    const db = (typeof FOOD_DB !== 'undefined') ? FOOD_DB : [];
    const ids = safeArr(DE && DE.availableFoods).filter(Boolean);
    const source = ids.length ? ids.map(id => (typeof FOOD_MAP !== 'undefined' ? FOOD_MAP.get(id) : db.find(f=>f.id===id))).filter(Boolean) : db.slice();
    const allowed = source.filter(f => isAllowed(f, context));
    const globalAllowed = db.filter(f => isAllowed(f, context));
    return { selected: allowed, global: globalAllowed, hadUserSelection: ids.length > 0 };
  }

  function pick(pool, cats, slot, context, usedIds, opts){
    opts = opts || {};
    const arr = pool.filter(f => cats.includes(f.cat))
      .filter(f => _egyEligibleForSlot(f, slot))
      .filter(f => !(opts.noRepeat && usedIds.has(f.id)))
      .sort((a,b)=>scoreFood(b,slot,context)-scoreFood(a,slot,context));
    return arr[0] || null;
  }
  function fallbackPick(pools, cats, slot, context, usedIds, opts){
    return pick(pools.selected, cats, slot, context, usedIds, opts) || pick(pools.global, cats, slot, context, usedIds, opts) || pick(pools.global, cats, slot, context, new Set(), opts);
  }

  function dietAllowsCarb(diet){ return !['keto','carnivore'].includes(diet); }

  function targetMacrosForSlot(slot, targetCals, dailyMacros, slots){
    const n = slots.length || 1;
    const hasWorkout = slots.includes('pre') || slots.includes('post');
    let pShare = 1/n, cShare = 1/n, fShare = 1/n;
    if (hasWorkout) {
      cShare = ({pre:.24, post:.30, breakfast:.18, lunch:.18, dinner:.08, snack:.06}[slot] || 1/n);
      const cSum = slots.reduce((s,m)=>s+({pre:.24, post:.30, breakfast:.18, lunch:.18, dinner:.08, snack:.06}[m] || 1/n),0);
      cShare /= cSum || 1;
    } else {
      cShare = ({breakfast:.30,lunch:.38,dinner:.22,snack:.10}[slot] || 1/n);
      const cSum = slots.reduce((s,m)=>s+({breakfast:.30,lunch:.38,dinner:.22,snack:.10}[m] || 1/n),0);
      cShare /= cSum || 1;
    }
    if (slot === 'post') pShare *= 1.25;
    if (slot === 'breakfast') pShare *= 1.10;
    return {
      protein: Math.round((dailyMacros.protein||0) * pShare),
      carbs: Math.round((dailyMacros.carbs||0) * cShare),
      fat: Math.round((dailyMacros.fat||0) * fShare),
      cals: targetCals
    };
  }

  function addByMacro(portions, food, grams, slot, flags){
    if (!food || grams <= 0) return;
    const lim = gramLimits(food, slot);
    grams = clamp(round5(grams), lim[0], lim[1]);
    const p = portion(food, grams, flags);
    if (p.cals > 0) portions.push(p);
  }

  // [EGY-v70] بذرة اليوم = دورة 4 أيام (تنويع يومي) + إزاحة أسبوعية بسيطة.
  // الأهداف والسعرات ما بتتغيرش — ده بيغيّر اختيار الأصناف بس عشان المتدرب مايملّش.
  //  day0/week1 تطلع 1 (نفس سلوك currentWeek القديم) — بدون هدم.
  function _egyDaySeed(){
    var _wk=((typeof DE!=='undefined'&&DE&&DE.currentWeek)||1);
    var _day=((typeof DE!=='undefined'&&DE&&typeof DE.dayOfCycle==='number')?DE.dayOfCycle:0);
    return _wk + (((_day%4)+4)%4);
  }


  // [EGY-v72] فلترة الموسم: لو العنصر عنده season والشهر ماش فيها → ممنوع.
  function _isInSeason(food) {
    if (!food || !food.season) return true;  // year-round
    const month = new Date().getMonth() + 1; // 1-12
    return food.season.includes(month);
  }

  function buildMeal(slot, targetCals, slotMacros, pools, context, usedIds, warnings){
    const diet = context.diet;
    let candidatePool = pools.selected.length ? pools.selected : pools.global;
    candidatePool = candidatePool.filter(f => !Array.isArray(f.mealTypes) || f.mealTypes.includes(slot) || slot === 'snack');
    const portions = [];
    const strictCarb = !dietAllowsCarb(diet);
    var _bfMode = (_egyDaySeed() % 3); // 0:فول+جبنة 1:جبنة 2:فول

    let protein = fallbackPick(pools, ['protein','dairy'], slot, context, usedIds, {noRepeat:true}) || fallbackPick(pools, ['protein','dairy'], slot, context, usedIds, {});
    // [EGY-v56] تماسك البروتين الحيواني عبر وجبتي اليوم الرئيسيتين (~70% تكرار نفس المصدر)
    if (['lunch','dinner','post'].indexOf(slot) >= 0) {
      var _wkSeed = _egyDaySeed();
      var _repeatProt = (((_wkSeed * 7) % 10) < 7);
      if (!context._dayAnimalProtein) {
        var _kinds=['chicken','fish','meat','fish'];
        var _wk=_kinds[(((_wkSeed-1)%4)+4)%4];
        var _kre = _wk==='fish' ? /بلطي|blty|بلاميطة|blamyt|ماكريل|makryl|بوري|bwry|سردين|srdyn|موسى|mwsa/
               : _wk==='meat' ? /لحم|lhm|كفتة|kfta|كباب|kbab|بفتيك|شرائح|ريش|rysh/
               : /فراخ|دجاج|صدر|frakh|sdr|wrk|banyh|shysh|tawwq/;
        var _kpick=(pools.selected.concat(pools.global)).filter(function(f){return f && f.cat==='protein' && _egyEligibleForSlot(f,slot) && !usedIds.has(f.id) && _kre.test(_egyText(f));}).sort(function(a,b){return scoreFood(b,slot,context)-scoreFood(a,slot,context);})[0];
        if (_kpick) protein=_kpick;
      }
      if (context._dayAnimalProtein && _repeatProt && context._dayAnimalProtein.cat==='protein' && _egyEligibleForSlot(context._dayAnimalProtein, slot)) {
        protein = context._dayAnimalProtein;
      }
      if (protein && protein.cat==='protein' && !context._dayAnimalProtein) context._dayAnimalProtein = protein;
    }
    const carb    = strictCarb ? null : _egyPickCarb(pools, slot, context, usedIds, protein);
    // [EGY-v59] الفطار: كارب مناسب دائما لو النظام يسمح — أسبوع الجبنة ياخد عيش (مش فول)
    var _bfCarb = carb;
    if (slot === 'breakfast' && !strictCarb && _bfMode === 1) {
      var _bread = (pools.selected.concat(pools.global)).filter(function(f){ return f && f.cat==='carb' && _egyEligibleForSlot(f,'breakfast') && _egyBreakfastCarbOk(f) && !/فول|fwl/.test(_egyText(f)) && !usedIds.has(f.id); }).sort(function(a,b){ return scoreFood(b,'breakfast',context)-scoreFood(a,'breakfast',context); })[0];
      if (_bread) _bfCarb = _bread;
    }
    const veggie  = slot === 'pre' || slot === 'snack' ? null : fallbackPick(pools, ['veggie'], slot, context, usedIds, {noRepeat:true});
    const fat     = _egyPickFat(pools, slot, context, usedIds);
    const dairy   = fallbackPick(pools, ['dairy'], slot, context, usedIds, {noRepeat:true});
    // [EGY-v71] الفطار المصري مافيهوش فاكهة مستقلة (زي التمر) — نقفل المسار من المنبع.
    // التمر/الفاكهة مكانها السناك وقبل التمرين بس.
    const fruit   = slot === 'breakfast' ? null : fallbackPick(pools, ['fruit'], slot, context, usedIds, {noRepeat: slot !== 'pre'});

    if (slot === 'snack') {
      // [OWNER-RULE] السناك المعتاد = فاكهة مع زبادي.
      // وبدائل مصرية بسيطة لو فاضل سعرات: شوكولاتة دارك (30 جم كحد أقصى)
      // أو فشار أو ترمس أو سوداني محمص — مع تدوير أسبوعي عشان مايملش.
      const _snAll = pools.selected.concat(pools.global);
      const _yogurt = _snAll.find(function(f){ return f && f.cat==='dairy' && /زبادي|zbady|لبنة|lbna|قريش|qrysh/.test(_egyText(f)) && _egyEligibleForSlot(f,'snack'); });
      const snackProt = _yogurt || dairy || protein;
      if (snackProt) addByMacro(portions, snackProt, (targetCals*.5)/(snackProt.cal||100)*100, slot);
      if (fruit && dietAllowsCarb(diet)) addByMacro(portions, fruit, (targetCals*.32)/(fruit.cal||80)*100, slot);
      if (totals(portions).cals < targetCals*.82) {
        const _treatOrder = [
          /شوكولاتة دارك|شوكولاتة داكنة|dark_choc|dark_chocolate/,
          /فشار|popcorn/,
          /ترمس|trms|lupin/,
          /سوداني محمص|swdany_mhms|roasted peanuts|peanuts/
        ];
        const _wk = _egyDaySeed();
        let treat = null;
        for (var _t = 0; _t < _treatOrder.length && !treat; _t++){
          const _rx = _treatOrder[(_t + _wk) % _treatOrder.length];
          treat = _snAll.find(function(f){ return f && _rx.test((f.id||'')+' '+(f.nameAr||'')) && _egyEligibleForSlot(f,'snack') && (dietAllowsCarb(diet) || f.cat==='fat' || isChocolate(f)); }) || null;
        }
        if (treat) addByMacro(portions, treat, isChocolate(treat) ? 25 : (treat.cat==='snack' ? 25 : 20), slot);
        else if (fat) addByMacro(portions, fat, 15, slot);
      }
    } else if (slot === 'pre') {
      // [EGY-v65] قبل التمرين = مكس عنصرين سريعين (موز/تمر/زبيب/تفاح/شوكولاتة دارك) + قهوة سادة — التمر/الزبيب حصة صغيرة
      if (strictCarb) {
        if (protein) addByMacro(portions, protein, (targetCals*.5)/(protein.cal||150)*100, slot); // كيتو: بروتين خفيف بدل الكارب
      } else {
        var _preRe = /موز|mwz|تمر|tmr|زبيب|zbyb|تفاح|tfah|شوكولات|شيكولات|choc/;
        var _preSeen = {}; var _preMix = [];
        (pools.selected.concat(pools.global)).filter(function(f){ return f && (f.cat==='fruit'||f.cat==='snack') && _egyEligibleForSlot(f,'pre') && _preRe.test(_egyText(f)); }).sort(function(a,b){ return scoreFood(b,'pre',context)-scoreFood(a,'pre',context); }).forEach(function(f){ if(!_preSeen[f.id]){ _preSeen[f.id]=1; _preMix.push(f); } });
        var _p1 = _preMix[0] || fruit || carb;
        var _p2 = _preMix.find(function(f){ return _p1 && f.id!==_p1.id; }) || null;
        if (_p1) addByMacro(portions, _p1, (targetCals*.5)/(_p1.cal||80)*100, slot);
        if (_p2) addByMacro(portions, _p2, (targetCals*.4)/(_p2.cal||80)*100, slot); // العنصر التاني في المكس
      }
      const coffee = (pools.selected.concat(pools.global)).find(f => /coffee|قهوة ساد/.test((f.id||'')+(f.nameAr||'')));
      if (coffee) { const cp = portion(coffee, 60, {}); if (cp) portions.push(cp); } // كوب قهوة سادة
    } else if (slot === 'post') {
      if (protein) addByMacro(portions, protein, clamp((slotMacros.protein||25)/(protein.pro||20)*100, 100, 240), slot);
      if (carb && dietAllowsCarb(diet)) addByMacro(portions, carb, (targetCals*.38)/(carb.cal||120)*100, slot);
      if (targetCals > 350) _egyAddSalad(portions, pools, slot, context, usedIds, 150); // [EGY-v52.4] سلطة جانبية
    } else if (slot === 'dinner') {
      // [EGY-v55] العشاء: تبديل يومي بين (أ) صدى الوجبة الرئيسية بحصة أصغر و(ب) عشاء خفيف شبيه بالفطار.
      //  الهدف: منطق مصري واقعي — ممنوع نوعين لحمة/بروتين مختلفين في نفس اليوم + تنويع يكسر الملل.
      var _dinMode = (_egyDaySeed() % 2);
      if (_dinMode === 0) {
        // (أ) صدى الوجبة الرئيسية: نفس بروتين اليوم بحصة أصغر + كارب خفيف + سلطة
        var _echo = (context._dayAnimalProtein && _egyEligibleForSlot(context._dayAnimalProtein,'dinner')) ? context._dayAnimalProtein : protein;
        if (_echo) addByMacro(portions, _echo, clamp((slotMacros.protein||24)/(_echo.pro||20)*100, 90, 180), slot);
        if (carb && dietAllowsCarb(diet)) addByMacro(portions, carb, (targetCals*.20)/(carb.cal||120)*100, slot);
        _egyAddSalad(portions, pools, slot, context, usedIds, 200);
      } else {
        // (ب) عشاء خفيف شبيه بالفطار: بيض/قريش/فول/زبادي + عيش + سلطة (بدون لحوم حمراء)
        var _light = (pools.selected.concat(pools.global)).find(function(f){ return f && (f.cat==='protein'||f.cat==='dairy') && /بيض|byd|قريش|qrysh|جبن|gbn|زبادي|zbady|لبنة|lbna|فول|fwl/.test(_egyText(f)) && _egyEligibleForSlot(f,'dinner'); }) || dairy || protein;
        if (_light) addByMacro(portions, _light, _light.cat==='dairy'?170:clamp((slotMacros.protein||24)/(_light.pro||12)*100,90,180), slot);
        var _lbread = (pools.selected.concat(pools.global)).find(function(f){ return f && f.cat==='carb' && /عيش|aysh|توست|twst|بلدي|bldy/.test(_egyText(f)) && _egyBreakfastCarbOk(f) && _egyEligibleForSlot(f,'dinner'); }) || carb;
        if (_lbread && dietAllowsCarb(diet)) addByMacro(portions, _lbread, (targetCals*.18)/(_lbread.cal||120)*100, slot);
        _egyAddSalad(portions, pools, slot, context, usedIds, 200);
      }
    } else {
      if (protein) addByMacro(portions, protein, clamp((slotMacros.protein||30)/(protein.pro||20)*100, slot==='breakfast'?80:100, slot==='breakfast'?170:260), slot);
      const _mainCarb = (slot === 'breakfast') ? _bfCarb : carb;
      if (_mainCarb && dietAllowsCarb(diet)) {
        const ratio = slot === 'dinner' ? .24 : slot === 'breakfast' ? .32 : .36;
        addByMacro(portions, _mainCarb, (targetCals*ratio)/(_mainCarb.cal||120)*100, slot);
      }
      // [EGY] الزيت للطبخ مش صف يتاكل: نضيف دهون واقفة بس لو دهون كاملة أو دايت كيتو
      if (fat && (strictCarb || !_egyIsOil(fat))) {
        const ratio = strictCarb ? .38 : .14;
        addByMacro(portions, fat, (targetCals*ratio)/(fat.cal||600)*100, slot);
      }
      // [EGY-v72] السلطة اختيارية في الفطار، وفي الغداء تدوير بين سلطة وخضار مطبوخ.
      var _vegSeed = (_egyDaySeed() + slot.length) % 10;
      if (slot === 'breakfast') {
        // السلطة في الفطار اختيارية — تظهر ~50% من الأيام
        if (_vegSeed < 5) _egyAddSalad(portions, pools, slot, context, usedIds, 130);
      } else if (slot === 'lunch') {
        // الغداء: سلطة (60%) أو خضار مطبوخ (40%)
        var _lunchCookedVeggies = pools.selected.concat(pools.global).filter(function(f){
          return f && f.cat === 'carb' && f.tags && f.tags.includes('خضار مطبوخة') &&
                 _egyEligibleForSlot(f, 'lunch') && !usedIds.has(f.id);
        }).sort(function(a,b){ return scoreFood(b,'lunch',context)-scoreFood(a,'lunch',context); });
        var _cookedVeg = _lunchCookedVeggies[_vegSeed % Math.max(1,_lunchCookedVeggies.length)] || _lunchCookedVeggies[0];
        if (_vegSeed < 6 || !_cookedVeg) {
          // 60% سلطة (default)
          _egyAddSalad(portions, pools, slot, context, usedIds, 180);
        } else {
          // 40% خضار مطبوخة بدل سلطة
          if (_cookedVeg) addByMacro(portions, _cookedVeg, (180)/(_cookedVeg.cal||80)*100, slot, {_salad:false});
        }
      } else {
        _egyAddSalad(portions, pools, slot, context, usedIds, slot === 'dinner' ? 200 : 170);
      }
    }

    // Human gates: main/post must contain protein; pre must contain energy; no carb-only main.
    const hasProtein = portions.some(p => ['protein','dairy'].includes(p.food.cat));
    const hasCarb    = portions.some(p => ['carb','fruit'].includes(p.food.cat));
    const hasOnlyCarb = portions.length > 0 && portions.every(p => ['carb','fruit'].includes(p.food.cat));
    const isMain = ['breakfast','lunch','dinner','post'].includes(slot);
    if (isMain && !hasProtein && protein) {
      addByMacro(portions, protein, slot === 'breakfast' ? 120 : 160, slot, {_autoCompleted:true});
      warnings.push(`${LABELS[slot]}: تم استكمال مصدر بروتين لمنع وجبة غير متوازنة`);
    }
    if (isMain && hasOnlyCarb && protein) {
      addByMacro(portions, protein, 150, slot, {_autoCompleted:true});
      warnings.push(`${LABELS[slot]}: تم منع وجبة كارب فقط`);
    }
    if (slot === 'post' && dietAllowsCarb(diet) && !hasCarb && carb) {
      addByMacro(portions, carb, 120, slot, {_autoCompleted:true});
      warnings.push('بعد التمرين: تم استكمال كارب للتعافي');
    }
    if (slot === 'pre' && portions.reduce((s,p)=>s+p.cals,0) < Math.min(180, targetCals*.7) && (fruit||carb)) {
      addByMacro(portions, (fruit||carb), 120, slot, {_autoCompleted:true});
    }

    // [EGY-v52] هوية الفطار المصري: لام عنصر مألوف (جبنة/زبادي/عيش/فول).
    if (slot === 'breakfast') {
      const hasFamiliar = portions.some(p => p.food.cat==='dairy' || (p.food.cat==='carb' && _egyBreakfastCarbOk(p.food)) || /فول|fwl|طعمية|tamya|بيض|byd|جبن|gbn|زبادي|zbady|عيش/.test(_egyText(p.food)));
      if (!hasFamiliar) {
        const addF = (dairy && _egyEligibleForSlot(dairy,'breakfast')) ? dairy : _egyPickCarb(pools, 'breakfast', context, usedIds);
        if (addF) { addByMacro(portions, addF, addF.cat==='dairy'?150:80, slot, {_autoCompleted:true}); warnings.push('الفطار: تم استكمال عنصر مصري مألوف لتوازن الفطار'); }
      }
    }

    // [EGY-v56b] الفطار: تنويع أسبوعي (جبنة/فول/الاتنين) مع البيض
    if (slot === 'breakfast') {
      const _hasDairy = portions.some(p => p.food.cat==='dairy');
      const _hasBfCarb = portions.some(p => p.food.cat==='carb');
      const _wantDairy = (_bfMode !== 2) || !_hasBfCarb;
      if (_wantDairy && !_hasDairy && dairy && _egyEligibleForSlot(dairy,'breakfast') && !usedIds.has(dairy.id)) {
        addByMacro(portions, dairy, 120, slot, {_autoCompleted:true});
        if (typeof usedIds.add==='function') usedIds.add(dairy.id);
      }
    }

    // Calorie closing: fill to 90-105% of meal target using existing realistic components.
    let guard = 0;
    while (totals(portions).cals < targetCals * 0.95 && guard++ < 12) {
      const t = totals(portions);
      const deficit = targetCals - t.cals;
      let filler = null;
      if (slot === 'pre') {
        // [EGY-v55] قبل التمرين: كبر الكارب/الفاكهة الموجودة بل إضافة نوع فاكهة تاني (منع ازدواج الفاكهة)
        const _preExisting = portions.filter(p => ['fruit','carb'].includes(p.food.cat)).map(p => p.food);
        const preOpts = strictCarb ? [protein] : _preExisting.concat([carb]);
        filler = preOpts.find(f => f && (gramLimits(f,slot)[1] - portions.filter(x=>x.food.id===f.id).reduce((a,b)=>a+b.grams,0)) >= 10) || null;
        if (!filler) break;
      } else {
        if (!strictCarb && slot !== 'dinner') filler = (slot==='breakfast' && _bfMode===1) ? (dairy || fruit) : (carb || fruit);
        if (!filler && strictCarb) filler = fat || protein;
        if (!filler) filler = fat || carb || protein || veggie;
        if (!filler) break;
      }
      const current = portions.filter(p=>p.food.id===filler.id).reduce((s,p)=>s+p.grams,0);
      const lim = gramLimits(filler, slot)[1];
      const room = lim - current;
      if (room < 10) {
        // try another category instead of looping on capped filler
        const alt = filler !== fat ? fat : (filler !== protein ? protein : carb);
        if (!alt || alt.id === filler.id) break;
        filler = alt;
      }
      const room2 = gramLimits(filler, slot)[1] - portions.filter(p=>p.food.id===filler.id).reduce((s,p)=>s+p.grams,0);
      if (room2 < 10) break;
      const gramsNeeded = clamp(deficit / (filler.cal||100) * 100, 10, room2);
      addByMacro(portions, filler, gramsNeeded, slot, {_calorieFill:true});
    }

    // If still too low, add safe fallbacks until the meal actually reaches its
    // calorie target.
    //
    // [CALORIE-CLOSE-FIX] قبل كدا كان فيه محاولة واحدة بصنف واحد، ولو الصنف ده
    // وصل لسقف الجرامات بتاعه كانت الوجبة تفضل ناقصة. ده كان سبب ظهور
    // "فاضلك X سعرة" في الأب مع إن الخطة مفروض تكون مكتملة.
    // دلوقتي بنجرب لحد 5 أصناف مختلفة وما بنكررش نفس الصنف.
    {
      const fallbackCats = strictCarb ? ['fat','protein'] : ['carb','fat','protein'];
      const fbUsed = new Set(portions.map(p => p.food.id));
      let fbGuard = 0;
      let warned = false;
      // [EGY-v71] منع تكديس العناصر: في الوجبة الرئيسية مانزودش أصناف جديدة فوق الحد،
      // بنكتفي بضبط كميات الموجود بدل ما نحشر عناصر كتير (التنوع بين الأيام مش جوه الوجبة).
      const _mainSlot = ['breakfast','lunch','dinner','post'].includes(slot);
      const _distinctCap = _mainSlot ? 5 : 0;
      while (totals(portions).cals < targetCals * 0.95 && fbGuard++ < 5) {
        if (_distinctCap && new Set(portions.map(p=>p.food.id)).size >= _distinctCap) break;
        const fb = pick(pools.global, fallbackCats, slot, context, fbUsed, {});
        if (!fb || fbUsed.has(fb.id)) break;
        fbUsed.add(fb.id);
        const lim = gramLimits(fb, slot);
        const need = (targetCals - totals(portions).cals) / (fb.cal || 100) * 100;
        const g = clamp(need, Math.min(40, lim[1]), lim[1]);
        const before = totals(portions).cals;
        addByMacro(portions, fb, g, slot, {_safeFallback:true});
        if (totals(portions).cals <= before) break; // مافيش تقدم — اوقف بدل اللف اللانهائي
        if (!warned) {
          warnings.push(`${LABELS[slot]}: تم استخدام بديل آمن لأن الاختيارات المتاحة لا تكفي السعرات`);
          warned = true;
        }
      }
    }

    // Trim if too high (>112%) by reducing calorie fillers first.
    let overGuard = 0;
    while (totals(portions).cals > targetCals * 1.12 && overGuard++ < 8) {
      // [EGY-v52] ترتيب التقليص: حشو السعرات أولا ثم الدهون ثم البروتين الزائد ثم الكارب
      // (لا نحذف العيش/الفول المصري قبل تصغير البروتين المبالغ فيه)
      let idx = portions.findIndex(p => p._calorieFill || p._safeFallback || p._dailyDriftFill);
      if (idx < 0) idx = portions.findIndex(p => p.food.cat === 'fat');
      if (idx < 0) idx = portions.findIndex(p => p.food.cat === 'protein' && p.grams > gramLimits(p.food, slot)[0] + 10);
      if (idx < 0) idx = portions.findIndex(p => p.food.cat === 'carb' || p.food.cat === 'fruit');
      if (idx < 0) break;
      const p = portions[idx];
      const minG = gramLimits(p.food, slot)[0];
      if (p.grams <= minG + 10) { portions.splice(idx,1); }
      else { portions[idx] = portion(p.food, Math.max(minG, p.grams-20), Object.fromEntries(Object.entries(p).filter(([k])=>k.startsWith('_')))); }
    }

    // Diabetes / insulin resistance: enforce a clinical per-meal carbohydrate
    // ceiling by shrinking (then dropping) the heaviest carb/fruit portion.
    if (safeArr(context.health).some(h => h === 'diabetes' || h === 'insulin')) {
      const carbCap = (slot === 'post') ? 75 : 55;
      let cguard = 0;
      while (cguard++ < 14) {
        const carbG = portions.reduce((s,p) => s + (p.carb || 0), 0);
        if (carbG <= carbCap) break;
        let idx = -1, worst = 0;
        portions.forEach((p,k) => { if (['carb','fruit'].includes(p.food.cat) && (p.carb||0) > worst) { worst = p.carb||0; idx = k; } });
        if (idx < 0) break;
        const p = portions[idx];
        const minG = gramLimits(p.food, slot)[0];
        if (p.grams <= minG) { portions.splice(idx,1); continue; }
        const flags = Object.fromEntries(Object.entries(p).filter(([k]) => k.startsWith('_')));
        portions[idx] = portion(p.food, Math.max(minG, p.grams - 25), flags);
      }
    }

    // [EGY-v52] دمج تكرار نفس الصنف في وجبة واحدة.
    (function dedupPortions(){
      const out = []; const idx = {};
      portions.forEach(p => {
        const key = _v41Norm(p.food.nameAr || p.food.id);
        if (idx[key] != null) {
          const ex = out[idx[key]];
          const lim = gramLimits(ex.food, slot);
          const flags = Object.fromEntries(Object.entries(ex).filter(([k])=>k.startsWith('_')));
          out[idx[key]] = portion(ex.food, clamp(round5(ex.grams + p.grams), lim[0], lim[1]), flags);
        } else { idx[key] = out.length; out.push(p); }
      });
      portions.length = 0; Array.prototype.push.apply(portions, out);
    })();
    portions.forEach(p => usedIds.add(p.food.id));

    // [OWNER-RULE] ترتيب عرض عناصر الوجبة: بروتين → خضار → كارب →
    // سلطة → أي عنصر تاني (فاكهة/دهون). الترتيب ثابت (stable sort)
    // عشان مايبوظش ترتيب العناصر المتساوية في الرتبة.
    const _egyOrderRank = (p) => {
      if (p._salad) return 3;
      const cat = p.food && p.food.cat;
      if (cat === 'protein' || cat === 'dairy') return 0;
      if (cat === 'veggie') return 1;
      if (cat === 'carb') return 2;
      return 4;
    };
    portions.sort((a, b) => _egyOrderRank(a) - _egyOrderRank(b));

    const finalTotals = totals(portions);
    const issues = [];
    if (isMain && !portions.some(p => ['protein','dairy'].includes(p.food.cat))) issues.push('missing_protein');
    if (slot === 'post' && dietAllowsCarb(diet) && !portions.some(p => ['carb','fruit'].includes(p.food.cat))) issues.push('missing_post_carb');
    if (finalTotals.cals < targetCals * 0.90) issues.push('under_calories');
    if (portions.length === 0) issues.push('empty_meal');

    // [EGY-v72] حد أقصى لعناصر الوجبة: 4 للوجبات الرئيسية، 3 للسناكس.
    // لو العناصر أكتر، نحذف الأصغر ونوزّع سعراتها على الباقيين بالتناسب.
    // [EGY-v72] حد أقصى 5 للوجبات الرئيسية، 3 للسناكس. نهدف لـ 4 لكن 5 مقبولة.
    const _MAX_ITEMS = (slot === 'snack' || slot === 'snack2' || slot === 'pre') ? 3 : 5;
    if (portions.length > _MAX_ITEMS) {
      portions.sort((a, b) => b.cals - a.cals);
      const _dropped = portions.splice(_MAX_ITEMS);
      const _droppedCals = _dropped.reduce((s, p) => s + (p.cals || 0), 0);
      if (_droppedCals > 0 && portions.length > 0) {
        const _keptTotal = portions.reduce((s, p) => s + (p.cals || 0), 0) || 1;
        portions.forEach(p => {
          const _extra = _droppedCals * ((p.cals || 0) / _keptTotal);
          const _f = p.food;
          if (_f && _f.cal > 0) {
            const _extraG = Math.round(_extra / (_f.cal / 100));
            const _limits = gramLimits(_f, slot);
            p.grams = Math.min((p.grams || 0) + _extraG, _limits[1]);
            const _n = p.grams / 100;
            p.cals = Math.round((_f.cal || 0) * _n);
            p.pro  = Math.round((_f.pro  || 0) * _n);
            p.carb = Math.round((_f.carb || 0) * _n);
            p.fat  = Math.round((_f.fat  || 0) * _n);
          }
        });
      }
    }
    return { slotKey:slot, label:LABELS[slot]||slot, description:DESC[slot]||'', targetCals, targetMacros:slotMacros,
      foods:portions, totals:finalTotals, issues };
  }

  function reconcileMacros(cals, diet, m){
    m = { protein:Math.max(0, Math.round(m.protein||0)), carbs:Math.max(0, Math.round(m.carbs||0)), fat:Math.max(0, Math.round(m.fat||0)) };
    const target = Math.round(cals || kcalOf(m));
    if (!target || target < 100) return m;
    let total = kcalOf(m);
    const strict = ['keto','carnivore'].includes(diet);
    const diabetic = DE && safeArr(DE.healthConditions).some(h=>h==='diabetes'||h==='insulin');
    let delta = target - total;
    if (Math.abs(delta) <= target * 0.03) return m;

    if (delta > 0) {
      if (strict && !(DE && safeArr(DE.healthConditions).includes('fatty-liver'))) {
        m.fat += Math.round(delta/9);
      } else {
        const carbCap = diabetic ? Math.round(target*0.40/4) : (diet === 'lowcarb' ? Math.max(m.carbs, Math.round(target*0.32/4)) : 9999);
        const addC = Math.min(Math.round(delta/4), Math.max(0, carbCap - m.carbs));
        m.carbs += addC; delta -= addC*4;
        if (delta > 0) m.fat += Math.round(delta/9);
      }
    } else {
      delta = -delta;
      const cutC = Math.min(m.carbs, Math.round(delta/4));
      m.carbs -= cutC; delta -= cutC*4;
      if (delta > 0) m.fat = Math.max(20, m.fat - Math.round(delta/9));
    }
    if (diet === 'keto') m.carbs = Math.min(m.carbs, 40);
    if (diet === 'carnivore') m.carbs = Math.min(m.carbs, 10);
    return m;
  }

  if (_origCalcMacros) {
    calcMacros = function calcMacros(cals, diet){
      const d = diet || (DE && DE.selectedDiet) || 'balanced';
      const raw = _origCalcMacros(cals, d);
      const fixed = reconcileMacros(cals, d, raw);
      if (Math.abs(kcalOf(fixed) - cals) > cals * 0.05) L(`[NEF-v41] Macro drift remains ${kcalOf(fixed)-cals} kcal`);
      return fixed;
    };
  }


  function recomputeMeal(meal){
    meal.totals = totals(meal.foods || []);
    return meal;
  }

  function recomputePlanTotals(meals){
    return meals.reduce((a,m)=>({
      cals:a.cals+(m.totals.cals||0),
      pro:+(a.pro+(m.totals.pro||0)).toFixed(1),
      carb:+(a.carb+(m.totals.carb||0)).toFixed(1),
      fat:+(a.fat+(m.totals.fat||0)).toFixed(1)
    }), {cals:0,pro:0,carb:0,fat:0});
  }

  function closeDailyCalorieDrift(meals, cals, pools, context, warnings){
    // Launch lock: daily plan must not underfeed. Fill safely after meal-level gates.
    let total = recomputePlanTotals(meals);
    let guard = 0;
    while (cals > 0 && total.cals < cals * 0.95 && guard++ < 16) {
      const deficit = cals - total.cals;
      const strict = !dietAllowsCarb(context.diet);
      const cats = strict ? ['fat','protein'] : ['fat','carb','protein','dairy','fruit'];
      // Prefer meals with the largest calorie gap, but avoid pre-workout for heavy fillers.
      const meal = meals
        .filter(m => m.slotKey !== 'pre')
        .sort((a,b)=>(b.targetCals-b.totals.cals)-(a.targetCals-a.totals.cals))[0] || meals[meals.length-1];
      if (!meal) break;
      // [EGY-v52.1] تجنب تكرار أي صنف موجود بالخطة عند تعبئة سعرات اليوم
      const planUsed = new Set();
      meals.forEach(mm => (mm.foods||[]).forEach(pp => planUsed.add(pp.food.id)));
      const filler = pick(pools.global, cats, meal.slotKey, context, planUsed, {noRepeat:true})
                  || pick(pools.selected, cats, meal.slotKey, context, planUsed, {noRepeat:true})
                  || pick(pools.global, cats, meal.slotKey, context, new Set(), {});
      if (!filler) break;
      const maxAdd = Math.min(deficit, Math.max(80, meal.targetCals * 0.25));
      const grams = clamp(maxAdd / (filler.cal || 100) * 100, 10, gramLimits(filler, meal.slotKey)[1]);
      addByMacro(meal.foods, filler, grams, meal.slotKey, {_dailyDriftFill:true});
      recomputeMeal(meal);
      total = recomputePlanTotals(meals);
    }
    if (total.cals < cals * 0.95) warnings.push('بعض القيود الصحية/اختيارات الأطعمة جعلت السعرات أقل قليلا من الهدف، راجع إضافة أطعمة آمنة أكثر');
    return total;
  }

  function generateMealPlan(totalCals, macros, weeklyMeta){
  _PROTEIN_USED_THIS_PLAN = {}; // [FIX] reset protein rotation per plan

    const context = { diet:(DE && DE.selectedDiet) || 'balanced', goal:DE && DE.goal, health:safeArr(DE && DE.healthConditions), problems:safeArr(DE && DE.dietProblems) };
    const cals = Math.round(totalCals || (typeof calcTargetCals === 'function' ? calcTargetCals() : 2000));
    const dailyMacros = reconcileMacros(cals, context.diet, macros || (typeof calcMacros === 'function' ? calcMacros(cals, context.diet) : {protein:120,carbs:200,fat:60}));
    const slots = getSlots();
    const shares = calorieShares(slots);
    const pools = resolvePool(context);
    const warnings = [];
    if (pools.hadUserSelection && pools.selected.length < 5) warnings.push('اختيارات الأطعمة قليلة؛ تم الاستكمال ببدائل آمنة عند الحاجة لمنع خطة غير متوازنة');
    if (!pools.hadUserSelection) warnings.push('لم يتم اختيار أطعمة؛ تم استخدام قاعدة الأطعمة المسموحة بالكامل كبداية آمنة');

    // Build a full plan for a given slot list, then top-up daily calories.
    // Kept as a local helper so we can rebuild with fewer meals if needed.
    function buildAndClose(activeSlots){
      const localShares = calorieShares(activeSlots);
      const usedIds = new Set();
      const localWarnings = [];
      const meals = activeSlots.map((slot, i) => {
        let target = Math.round(cals * (localShares[slot] || 1/activeSlots.length));
        if (i === activeSlots.length-1) {
          const before = activeSlots.slice(0,-1).reduce((s,m)=>s+Math.round(cals*(localShares[m]||0)),0);
          target = cals - before;
        }
        const slotMacros = targetMacrosForSlot(slot, target, dailyMacros, activeSlots);
        return buildMeal(slot, target, slotMacros, pools, context, usedIds, localWarnings);
      });
      // Safety net: never surface a truly empty meal card.
      let survivors = meals.filter(m => m.foods && m.foods.length > 0);
      if (survivors.length === 0) survivors = meals; // never return an empty plan
      const merged = survivors.length < meals.length;
      const dailyTotal = closeDailyCalorieDrift(survivors, cals, pools, context, localWarnings);
      return { builtMeals: survivors, total: dailyTotal, merged: merged, warnings: localWarnings };
    }

    // FIX-v42: auto-reduce meal count when the daily target is too low to be
    // spread across this many meals (minimum realistic portions overshoot the
    // target). We drop the least-essential slot and rebuild, keeping the change
    // only if it actually reduces the overshoot. Protein floors are respected
    // by buildMeal itself, so we never under-feed protein to hit a number.
    let activeSlots = slots.slice();
    let attempt = buildAndClose(activeSlots);
    let reducedTo = 0, rGuard = 0;
    while (cals > 0 && attempt.total.cals > cals * 1.10 && activeSlots.length > 2 && rGuard++ < 4) {
      const dropOrder = ['snack','pre','lunch','post','breakfast','dinner'];
      let dropIdx = -1;
      for (const d of dropOrder){ const k = activeSlots.indexOf(d); if (k >= 0){ dropIdx = k; break; } }
      if (dropIdx < 0) dropIdx = activeSlots.length - 1;
      const candidateSlots = activeSlots.slice(0,dropIdx).concat(activeSlots.slice(dropIdx+1));
      const next = buildAndClose(candidateSlots);
      if (Math.abs(next.total.cals - cals) < Math.abs(attempt.total.cals - cals)) {
        activeSlots = candidateSlots; attempt = next; reducedTo = activeSlots.length;
      } else break;
    }
    let builtMeals = attempt.builtMeals;
    (attempt.warnings || []).forEach(w => warnings.push(w));
    if (attempt.merged) {
      warnings.push('تم دمج وجبة لم تتوفر لها أطعمة كافية وإعادة توزيع سعراتها لتفادي وجبة فارغة');
    }
    if (reducedTo) {
      warnings.push('تم تقليل عدد الوجبات تلقائيا إلى ' + builtMeals.length + ' وجبات لأن هدفك من السعرات (' + cals + ' سعرة) منخفض نسبيا؛ توزيعه على وجبات أكثر يجعل كل وجبة صغيرة جدا وغير واقعية. عدد أقل من الوجبات = حصص مشبعة وأقرب لهدفك اليومي');
    }

    const total = attempt.total;
    const planIssues = [];
    builtMeals.forEach(m => m.issues.forEach(x => planIssues.push(`${m.slotKey}:${x}`)));
    const driftPct = cals ? Math.abs(total.cals - cals) / cals : 0;
    if (driftPct > 0.10) planIssues.push(`daily_calorie_drift:${total.cals-cals}`);
    return { version:'v41-launch-lock', targetCals:cals, targetMacros:dailyMacros, totals:total, meals:builtMeals, warnings:[...new Set(warnings)], issues:planIssues, weeklyMeta:weeklyMeta || null };
  }

  function renderMealPlan(plan){
    const q = (typeof calcMealQuality === 'function') ? calcMealQuality : null;
    const analysis = [];
    const drift = plan.targetCals ? Math.round((plan.totals.cals - plan.targetCals) / plan.targetCals * 100) : 0;
    const infoCls = Math.abs(drift) <= 10 && plan.issues.length === 0 ? 'info-green' : 'info-warning';
    analysis.push(`<div class="info-box ${infoCls}" style="margin-bottom:8px;flex-direction:column;align-items:flex-start;gap:4px;">
      <div style="font-weight:800;font-size:13px;">خطة v41 — ${plan.totals.cals} / ${plan.targetCals} kcal (${drift>=0?'+':''}${drift}%)</div>
      <div style="font-size:11.5px;color:var(--text-muted);">المجموع الفعلي: بروتين ${plan.totals.pro}ج · كارب ${plan.totals.carb}ج · دهون ${plan.totals.fat}ج</div>
      ${plan.warnings.map(w=>`<div style="font-size:11px;color:var(--orange);">${w}</div>`).join('')}
      ${plan.issues.map(w=>`<div style="font-size:11px;color:var(--red);">${w}</div>`).join('')}
    </div>`);

    const html = plan.meals.map(m => {
      let quality = null;
      try { quality = q ? q(m.slotKey, m.foods, {diet:DE.selectedDiet||'balanced', goal:DE.goal, health:DE.healthConditions||[], problems:DE.dietProblems||[]}) : null; } catch(e){}
      const foodsHTML = m.foods.length ? m.foods.map(p=>{
        const _gramsTag = p._hasCondiment ? '' : `<span style="background:rgba(42,140,232,0.15);color:var(--blue);border-radius:5px;padding:1px 7px;font-weight:800;font-size:12px;">${p.grams}جم</span>`;
        return `<div class="food-item">
          <span class="food-name">${p.food.nameAr}</span>
          <span class="food-amount" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            ${_gramsTag}
            <span style="color:var(--accent);font-weight:800;font-size:12px;">${p.cals}</span>
            <span style="color:var(--green);font-size:11px;">${p.pro}ج</span>
          </span>
        </div>`;
      }).join('') : `<div style="padding:10px;background:rgba(232,76,76,0.08);border-radius:8px;font-size:12px;color:var(--red);">لا توجد أطعمة آمنة كافية لهذه الوجبة</div>`;
      const qHtml = quality ? `<details class="meal-quality"><summary>مؤشرات الجودة والشبع</summary><div class="mq-body" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;padding-top:8px;">
        <span style="font-size:10.5px;color:${quality.quality>=70?'var(--green)':quality.quality>=40?'var(--orange)':'var(--red)'};font-weight:800;">جودة ${quality.quality}%</span>
        <span style="font-size:10.5px;color:var(--blue);font-weight:700;">شبع ${quality.satiety}%</span>
        <span style="font-size:10.5px;color:var(--purple);font-weight:700;">هضم ${quality.digestion}%</span>
      </div></details>` : '';
      return `<div class="meal-card">
        <div class="meal-card-header"><div style="flex:1;"><div class="meal-title">${m.label}</div><div class="meal-subtitle">${m.description} · <strong style="color:var(--accent);">${m.totals.cals} kcal</strong> <span style="color:var(--text-dim);font-size:11px;">(هدف ${m.targetCals})</span></div></div></div>
        <div class="meal-foods">${foodsHTML}</div>
        ${m.foods.length ? `<div class="meal-macros"><span class="macro-pill" style="color:var(--green);">${m.totals.pro}ج</span><span class="macro-pill" style="color:var(--blue);">${m.totals.carb}ج</span><span class="macro-pill" style="color:var(--orange);">${m.totals.fat}ج</span></div>` : ''}
        ${qHtml}
      </div>`;
    }).join('');
    const el = document.getElementById('res-meals');
    if (el) el.innerHTML = analysis.join('') + html;
    return analysis.join('') + html;
  }

  buildSmartMealPlan = function buildSmartMealPlan(totalCals, macros, weeklyMeta){
    const plan = generateMealPlan(totalCals, macros, weeklyMeta);
    window.__lastNutritionPlan = plan;

  // [FIX-NAME-DEDUP] إزالة التكرار في أسماء الأطعمة (مشوي مشوي → مشوي)
  if (plan && Array.isArray(plan.meals)) {
    plan.meals.forEach(function(meal) {
      if (!meal || !Array.isArray(meal.portions)) return;
      meal.portions.forEach(function(p) {
        if (p && p.food && p.food.nameAr) {
          p.food.nameAr = p.food.nameAr.replace(/(\S+)(\s+)+/g, '$1').trim();
        }
      });
    });
  }

    renderMealPlan(plan);
    L(`✔ [NEF-v41] Meal plan generated: ${plan.totals.cals}/${plan.targetCals} kcal · issues=${plan.issues.length}`);
    return plan;
  };

  window.NutritionEngine = {
    version:'v41-launch-lock',
    calculate: function(input){
      if (input && typeof Object.assign === 'function' && typeof DE !== 'undefined') Object.assign(DE, input);
      const target = (typeof calcTargetCals === 'function') ? calcTargetCals() : 2000;
      return { bmr: typeof calcBMR==='function' ? calcBMR() : null, tdee: typeof calcTDEE==='function' ? calcTDEE() : null, targetCals:target, macros: typeof calcMacros==='function' ? calcMacros(target, DE.selectedDiet||'balanced') : null };
    },
    generateMealPlan,
    renderMealPlan,
    reconcileMacros,
  };

  L('✔ NutritionEngine Facade v41 (+v52 integrity/EGY patch) active');
})();
