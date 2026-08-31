
// ═══════════════════════════════════════════════════════════════
//  OWNER-RULES POST-PROCESSOR  v2.0 (25_owner_rules_post.js)
//  يطبَّق فوق مخرجات محرك التغذية بعد اكتمال الوجبات.
//  القواعد:
//  1. ممنوع مكسرات / تمر / فاكهة في وجبة رئيسية (فطار/غداء/عشاء)
//  2. ممنوع زبادي يوناني — يُستبدَل بزبادي طبيعي تلقائياً
//  3. العشاء = تكرار عناصر الفطار أو الغداء (نفس IDs، كمية أخف)
//     أو وجبة خفيفة: فاكهة + زبادي طبيعي فقط
//  4. وجبتان فقط (mc=2): لا تكديس — رفع كمية العناصر الموجودة فقط
//  5. السناك وقبل/بعد التمرين لهم قواعدهم الداخلية — لا نعدّل عليهم
// ═══════════════════════════════════════════════════════════════
(function OwnerRulesPostProcessor(){
  // [FIX] works in both browser and Node vm sandbox (sandbox.window = sandbox)

  // ── مساعدات ──────────────────────────────────────────────────
  var _ORP_LOG = function(m){ try{ if(typeof LOG==='function') LOG('[ORP] '+m); }catch(e){} };

  // معرّف الزبادي الطبيعي والإغريقي
  var NATURAL_YOGURT_ID = 'zbadytbyay';
  var GREEK_YOGURT_ID   = 'zbadytbyay';

  // هل العنصر مكسرات أو تمر؟
  function _isNutOrDate(food){
    if (!food) return false;
    var t = (food.nameAr||'') + ' ' + (food.id||'') + ' ' + (food.nameEn||'');
    // مكسرات
    if (/مكسرات|لوز|كاشو|جوز|فستق|بندق|سوداني|swdany|loz|cashw|kasaw|fstq|bndaq|nuts|peanut/i.test(t)) return true;
    // لب وبذور كسناك
    if (/لب |لب أبيض|لب سوري|سمسم(?! طحينة)|lbswy|bzr|seeds/i.test(t)) return true;
    // تمر وبلح وعجوة
    if (/تمر|بلح|عجوة|tmr|blh|ajwa|date(?!s of)/i.test(t)) return true;
    return false;
  }

  // هل العنصر فاكهة؟
  function _isFruit(food){
    return food && food.cat === 'fruit';
  }

  // هل هذا الزبادي اليوناني؟
  function _isGreekYogurt(food){
    if (!food) return false;
    return (food.id || '') === GREEK_YOGURT_ID ||
      /زبادي يوناني|zbady.*wnan/i.test((food.nameAr||'') + (food.id||''));
  }

  // جلب بديل الزبادي الطبيعي من قاعدة البيانات
  function _getNaturalYogurt(){
    if (typeof FOODS_DB === 'undefined') return null;
    return (Array.isArray(FOODS_DB) ? FOODS_DB : Object.values(FOODS_DB)).find(function(f){
      return f && f.id === NATURAL_YOGURT_ID;
    }) || null;
  }

  // الوجبات الرئيسية التي تطبق عليها قاعدتا المكسرات والفاكهة
  var MAIN_SLOTS = ['breakfast', 'lunch', 'dinner'];

  // ── [RULE 1+2] تنقية كل وجبة رئيسية من المكسرات/التمر/الفاكهة + استبدال الإغريقي ──
  function _cleanMeal(meal){
    if (!meal || !Array.isArray(meal.portions)) return;
    var slot = meal.slot || '';
    var isMain = MAIN_SLOTS.indexOf(slot) >= 0;

    meal.portions = meal.portions.filter(function(p){
      if (!p || !p.food) return true;
      // [RULE 2] استبدال الزبادي الإغريقي بالطبيعي
      if (_isGreekYogurt(p.food)) {
        var nat = _getNaturalYogurt();
        if (nat) {
          _ORP_LOG('RULE-2: تم استبدال زبادي يوناني بطبيعي في ' + slot);
          p.food = nat;
          p.cals = Math.round((nat.cal||60) * p.grams / 100);
          p.pro  = +((nat.pro||5) * p.grams / 100).toFixed(1);
          p.carb = +((nat.carb||5) * p.grams / 100).toFixed(1);
          p.fat  = +((nat.fat||2) * p.grams / 100).toFixed(1);
        }
        return true;
      }
      // [RULE 1] إزالة مكسرات/تمر/فاكهة من الوجبات الرئيسية
      if (isMain && (_isNutOrDate(p.food) || _isFruit(p.food))) {
        _ORP_LOG('RULE-1: حذف '+( p.food.nameAr||p.food.id)+' من '+slot);
        return false;
      }
      return true;
    });
  }

  // ── [RULE 3] العشاء = عناصر الفطار أو الغداء (أخف) أو فاكهة+زبادي ──
  function _enforceDinner(plan){
    if (!plan || !Array.isArray(plan.meals)) return;
    var dinnerMeal = null;
    var breakfastPortions = [];
    var lunchPortions = [];

    plan.meals.forEach(function(m){
      if (m.slot === 'breakfast') breakfastPortions = m.portions || [];
      if (m.slot === 'lunch')     lunchPortions     = m.portions || [];
      if (m.slot === 'dinner')    dinnerMeal        = m;
    });

    if (!dinnerMeal) return;

    // جمع IDs الأطعمة في الفطار والغداء
    var bfIds  = breakfastPortions.map(function(p){ return p.food && p.food.id; }).filter(Boolean);
    var lnIds  = lunchPortions.map(function(p){ return p.food && p.food.id; }).filter(Boolean);
    var mainIds = bfIds.concat(lnIds);

    // هل العشاء الحالي فيه عناصر من خارج الفطار+الغداء؟
    var dinnerFoodIds = (dinnerMeal.portions||[]).map(function(p){ return p.food && p.food.id; }).filter(Boolean);
    var hasNewElement = dinnerFoodIds.some(function(id){ return mainIds.indexOf(id) < 0; });

    if (!hasNewElement) return; // العشاء نظيف، لا حاجة للتعديل

    _ORP_LOG('RULE-3: إعادة بناء العشاء من عناصر الفطار/الغداء');

    // اختر المصدر: الغداء إن وُجد (أغنى)، وإلا الفطار
    var sourcePortions = lunchPortions.length >= 2 ? lunchPortions : breakfastPortions;
    var dinnerTarget   = dinnerMeal.targetCals || (dinnerMeal.totals && dinnerMeal.totals.cals) || 400;

    if (sourcePortions.length === 0) {
      // لا فطار ولا غداء: عشاء خفيف = فاكهة + زبادي طبيعي
      _applyLightDinner(dinnerMeal, dinnerTarget);
      return;
    }

    // بناء نسخة أخف من مصدر (الغداء أو الفطار)
    var sourceCals = sourcePortions.reduce(function(s,p){ return s+(p.cals||0); }, 0);
    var scale = sourceCals > 0 ? (dinnerTarget / sourceCals) : 0.7;
    scale = Math.min(scale, 0.85); // العشاء دايماً أخف من المصدر
    scale = Math.max(scale, 0.45);

    var newPortions = sourcePortions
      .filter(function(p){ return p.food && !_isFruit(p.food) && !_isNutOrDate(p.food); })
      .map(function(p){
        var g = Math.round((p.grams || 100) * scale / 5) * 5;
        g = Math.max(g, 30);
        var f = p.food;
        return {
          food: f,
          grams: g,
          cals: Math.round((f.cal||0)*g/100),
          pro:  +((f.pro||0)*g/100).toFixed(1),
          carb: +((f.carb||0)*g/100).toFixed(1),
          fat:  +((f.fat||0)*g/100).toFixed(1),
        };
      });

    if (newPortions.length === 0) {
      _applyLightDinner(dinnerMeal, dinnerTarget);
      return;
    }

    dinnerMeal.portions = newPortions;
    // تحديث الإجماليات
    dinnerMeal.totals = newPortions.reduce(function(a,p){
      return { cals:a.cals+p.cals, pro:+(a.pro+p.pro).toFixed(1),
               carb:+(a.carb+p.carb).toFixed(1), fat:+(a.fat+p.fat).toFixed(1) };
    }, {cals:0,pro:0,carb:0,fat:0});
  }

  // عشاء خفيف احتياطي: فاكهة + زبادي طبيعي
  function _applyLightDinner(dinnerMeal, targetCals){
    _ORP_LOG('RULE-3b: عشاء خفيف = فاكهة + زبادي طبيعي');
    var nat = _getNaturalYogurt();
    var fruit = null;
    if (typeof FOODS_DB !== 'undefined') {
      fruit = (Array.isArray(FOODS_DB)?FOODS_DB:Object.values(FOODS_DB)).find(function(f){
        return f && f.cat==='fruit' && Array.isArray(f.mealTypes) && f.mealTypes.includes('snack');
      });
    }
    var portions = [];
    if (nat)   portions.push({ food:nat, grams:200, cals:Math.round((nat.cal||60)*2), pro:+((nat.pro||5)*2).toFixed(1), carb:+((nat.carb||5)*2).toFixed(1), fat:+((nat.fat||2)*2).toFixed(1) });
    if (fruit) portions.push({ food:fruit, grams:150, cals:Math.round((fruit.cal||60)*1.5), pro:+((fruit.pro||1)*1.5).toFixed(1), carb:+((fruit.carb||15)*1.5).toFixed(1), fat:+((fruit.fat||0)*1.5).toFixed(1) });
    if (portions.length) {
      dinnerMeal.portions = portions;
      dinnerMeal.totals = portions.reduce(function(a,p){ return {cals:a.cals+p.cals, pro:+(a.pro+p.pro).toFixed(1), carb:+(a.carb+p.carb).toFixed(1), fat:+(a.fat+p.fat).toFixed(1)}; }, {cals:0,pro:0,carb:0,fat:0});
    }
  }

  // ── [RULE 4] وجبتان فقط: رفع كمية العناصر الموجودة دون تكديس ──
  function _scaleTwoMeals(plan){
    if (!plan) return;
    var mc = (typeof DE !== 'undefined' && DE.mealCount) ? DE.mealCount : null;
    if (!mc || mc > 2) return;

    // الوجبات الرئيسية فقط (مش سناك أو تمرين)
    var mainMeals = (plan.meals||[]).filter(function(m){
      return MAIN_SLOTS.indexOf(m.slot) >= 0;
    });
    if (mainMeals.length > 2) return; // أكثر من وجبتين = منطق آخر

    var totalTarget = plan.targetCals || 2000;
    var totalActual = mainMeals.reduce(function(s,m){ return s+(m.totals&&m.totals.cals||0); },0);
    if (totalActual <= 0) return;

    var scale = Math.min(totalTarget / totalActual, 1.6); // حد أقصى للتكبير 60%
    if (scale < 1.05) return; // الفرق صغير — مش محتاج تعديل

    _ORP_LOG('RULE-4: 2-وجبتان scale=' + scale.toFixed(2));

    mainMeals.forEach(function(m){
      (m.portions||[]).forEach(function(p){
        var g = Math.round(p.grams * scale / 5) * 5;
        // حد الجرامات حسب التصنيف
        var maxG = p.food.cat==='fat' ? 45 : p.food.cat==='veggie' ? 300 : 400;
        p.grams = Math.min(g, maxG);
        var f = p.food;
        p.cals = Math.round((f.cal||0)*p.grams/100);
        p.pro  = +((f.pro||0)*p.grams/100).toFixed(1);
        p.carb = +((f.carb||0)*p.grams/100).toFixed(1);
        p.fat  = +((f.fat||0)*p.grams/100).toFixed(1);
      });
      // تحديث الإجماليات
      m.totals = (m.portions||[]).reduce(function(a,p){
        return { cals:a.cals+p.cals, pro:+(a.pro+p.pro).toFixed(1),
                 carb:+(a.carb+p.carb).toFixed(1), fat:+(a.fat+p.fat).toFixed(1) };
      }, {cals:0,pro:0,carb:0,fat:0});
    });
  }

  // ── [RULE 5] منع الخضار المطبوخ/البقول/الشوربة مع السمك أو التونة أو الكفتة أو الكبدة ──
  // طلب صاحب المشروع: الخضار المطبوخ يظهر مع الفراخ واللحمة فقط.
  function _isSensitiveProtein(food){
    if (!food) return false;
    var t = (food.nameAr||'') + ' ' + (food.id||'') + ' ' + (food.nameEn||'');
    return /سمك|تونة|تونه|smk|twna|كفتة|kfta|كبدة|kbda/i.test(t);
  }
  function _isCookedVegSoupLegume(food){
    if (!food) return false;
    var t = (food.nameAr||'') + ' ' + (food.id||'') + ' ' + (food.nameEn||'');
    // شوربة
    if (/شوربة|شوربه|shwrb/i.test(t)) return true;
    // بقول: لوبيا / فاصوليا / بسلة / عدس
    if (/لوبيا|فاصوليا|بسلة|بسله|عدس|lwbya|fasolia|bsl|ads/i.test(t)) return true;
    // خضار مطبوخ صريح
    if (/مطبوخ|مطبوخة|mtbwkh/i.test(t)) return true;
    // خضار مطبوخة شائعة بالاسم
    if (/سبانخ|بامية|باميه|ملوخية|ملوخيه|ملوخيا|بروكلي|قرنبيط|كوسه|كوسة|كوسا|كوسا|زوكيني|sbankh|bamy|mlwkhy|brwkly|kwsh|kwsa|kosa|zucchini/i.test(t)) return true;
    return false;
  }
  function _forbidVegWithSensitive(meal){
    if (!meal || !Array.isArray(meal.portions)) return;
    if (MAIN_SLOTS.indexOf(meal.slot || '') < 0) return;
    var hasSensitive = meal.portions.some(function(p){ return p && _isSensitiveProtein(p.food); });
    if (!hasSensitive) return;
    var before = meal.portions.length;
    meal.portions = meal.portions.filter(function(p){
      if (!p || !p.food) return true;
      if (_isCookedVegSoupLegume(p.food)) {
        _ORP_LOG('RULE-5: حذف '+(p.food.nameAr||p.food.id)+' مع بروتين حساس في '+meal.slot);
        return false;
      }
      return true;
    });
    if (meal.portions.length !== before) {
      meal.totals = meal.portions.reduce(function(a,p){
        return { cals:a.cals+(p.cals||0), pro:+(a.pro+(p.pro||0)).toFixed(1),
                 carb:+(a.carb+(p.carb||0)).toFixed(1), fat:+(a.fat+(p.fat||0)).toFixed(1) };
      }, {cals:0,pro:0,carb:0,fat:0});
    }
  }


  // ── [RULE 6] خضار واحد فردي في الوجبة الرئيسية → يُستبدل بطبق سلطة ──
  // ممنوع: طماطم أو خيار منفرد في الوجبة — لازم يكون في صورة سلطة مشكلة.
  var RAW_SOLO_VEGGIES = /طماطم|خيار|تماتم|خيار|فلفل رومي|فلفل خضار|tmatm|khyar|tmatum|tamatim|cucumber|tomato|pepper/i;
  var SALAD_POOL_IDS = ['salad_green','khdar_mshkl','salad_khadra','salata_arabiya','salata_mshkla','salata','sltah'];

  function _isSoloRawVeggie(food){
    if (!food) return false;
    if (food.cat !== 'veggie' && food.cat !== 'vegetable') return false;
    var t = (food.nameAr||'') + ' ' + (food.id||'') + ' ' + (food.nameEn||'');
    // لو الاسم فيه "مشوي" أو "مطبوخ" → مش فردي خام
    if (/مطبوخ|مشوي|مسلوق|محمر|fried|cooked|grilled|boiled/i.test(t)) return false;
    // لو هو نفسه سلطة مشكلة → مش المشكلة
    if (/سلطة|سلطه|salad|مشكل|مشكله|mixed/i.test(t)) return false;
    return RAW_SOLO_VEGGIES.test(t);
  }

  function _findSalad(){
    if (typeof FOODS_DB === 'undefined') return null;
    var db = Array.isArray(FOODS_DB) ? FOODS_DB : Object.values(FOODS_DB);
    // أولاً: سلطة مشكلة بالاسم
    var salad = db.find(function(f){
      return f && /سلطة|سلطه|salad|مشكل/i.test((f.nameAr||'') + ' ' + (f.id||''));
    });
    if (salad) return salad;
    // ثانياً: أقرب عنصر من مجموعة السلطات
    for (var i = 0; i < SALAD_POOL_IDS.length; i++){
      var found = db.find(function(f){ return f && f.id === SALAD_POOL_IDS[i]; });
      if (found) return found;
    }
    return null;
  }

  // [FIX-5] قائمة تركيبات السلطة المتنوعة (3 عناصر بالضبط)
  var SALAD_3_COMBOS = [
    { ids: ['khyar','tmatm','jzr'],    sub: 'خيار + طماطم + جزر' },
    { ids: ['khyar','tmatm','khas'],   sub: 'خيار + طماطم + خس' },
    { ids: ['khyar','tmatm','flfl'],   sub: 'خيار + طماطم + فلفل' },
    { ids: ['khyar','tmatm','jrjyr'],  sub: 'خيار + طماطم + جرجير' },
    { ids: ['khyar','jzr','khas'],     sub: 'خيار + جزر + خس' },
  ];

  // بناء طبق سلطة من 3 عناصر تحديداً (يتدور بين التركيبات)
  var _lastSaladCombo = 0;
  // [FIX-L] ترتيب الأصناف داخل الوجبة: بروتين → البان → خضار → فاكهة → كارب → دهون
var _CAT_ORDER = {
  protein:1, meat:1, poultry:1, fish:1, egg:1,
  dairy:2, cheese:2,
  veggie:3, vegetable:3, salad:3,
  fruit:4,
  carb:5, grain:5, bread:5, starch:5,
  fat:6, oil:6, nuts:6
};
function _catOrder(food) {
  if (!food || !food.category) return 9;
  var c = food.category.toLowerCase();
  for (var k in _CAT_ORDER) {
    if (c.indexOf(k) !== -1) return _CAT_ORDER[k];
  }
  return 9;
}
function _sortMealPortions(meal) {
  if (!meal || !Array.isArray(meal.portions)) return;
  meal.portions.sort(function(a, b) { return _catOrder(a.food) - _catOrder(b.food); });
}

function _makeSalad3(saladGrams) {
    var g = Math.max(saladGrams || 120, 100);
    _lastSaladCombo = (_lastSaladCombo + 1) % SALAD_3_COMBOS.length;
    var combo = SALAD_3_COMBOS[_lastSaladCombo];
    // مكرونوتريشيا لسلطة 3 خضار (لكل 100ج)
    var CAL=22, PRO=1.8, CARB=4.0, FAT=0.3;
    return {
      food: {
        id: '__salad_3__',
        ids: combo.ids,                 // [FIX-5] 3 عناصر بالضبط
        nameAr: 'سلطة خضراء مشكلة',
        sub: combo.sub,                 // عرض المكونات للمستخدم
        cat: 'veggie', processedLevel: 'none',
        cal: CAL, pro: PRO, carb: CARB, fat: FAT,
      },
      grams: g,
      cals: Math.round(CAL * g / 100),
      pro:  +(PRO * g / 100).toFixed(1),
      carb: +(CARB * g / 100).toFixed(1),
      fat:  +(FAT * g / 100).toFixed(1),
    };
  }

  function _fixSoloVeggies(meal){
    if (!meal || !Array.isArray(meal.portions)) return;
    if (MAIN_SLOTS.indexOf(meal.slot || '') < 0) return;
    var soloCount = meal.portions.filter(function(p){
      return p && _isSoloRawVeggie(p.food);
    }).length;
    var hasSalad = meal.portions.some(function(p){
      return p && p.food && (/سلطة|سلطه|salad|مشكل/i.test((p.food.nameAr||'')+(p.food.id||''))||
                             (Array.isArray(p.food.ids) && p.food.ids.length >= 3));
    });
    if (soloCount === 0 || hasSalad) return;

    var removed = 0;
    var totalGrams = 0;
    meal.portions = meal.portions.filter(function(p){
      if (p && _isSoloRawVeggie(p.food)) {
        totalGrams += (p.grams || 100);
        removed++;
        _ORP_LOG('RULE-6: حذف خضار فردي ' + (p.food.nameAr||p.food.id) + ' من ' + meal.slot);
        return false;
      }
      return true;
    });

    // [FIX-5] سلطة دايمًا 3 عناصر — ليس id فردي
    if (removed > 0) {
      meal.portions.push(_makeSalad3(totalGrams));
      _ORP_LOG('RULE-6: سلطة 3 عناصر أُضيفت في ' + meal.slot);
      meal.totals = meal.portions.reduce(function(a,p){
        return { cals:a.cals+(p.cals||0), pro:+(a.pro+(p.pro||0)).toFixed(1),
                 carb:+(a.carb+(p.carb||0)).toFixed(1), fat:+(a.fat+(p.fat||0)).toFixed(1) };
      }, {cals:0,pro:0,carb:0,fat:0});
    }
  }


  // ═══════════════════════════════════════════════════════════════════
  // [RULE 5-HARD] سمك/تونة: الجانب المسموح = سلطة فقط + طحينة اختيارية
  // لا خضار مطبوخ، لا شوربة، لا أرز مع تونة
  // ═══════════════════════════════════════════════════════════════════
  var _FISH_IDS   = /سمك|تونة|تونه|بلطي|بوري|ماكريل|سردين|مكريل|blty|bwry|tuna|smak|samak|fish/i;
  var _TUNA_IDS   = /تونة|تونه|tuna/i;
  var _RICE_IDS   = /أرز|ارز|رز|رزه|rice|arz/i;
  var _COOKED_VEG = /خضارs*مطبوخ|فاصوليا|بامية|ملوخية|ملوخيا|هريسة|كوسا|كوسه|كوسة|بطاطسs*مسلوقة|بطاطسs*مهروس|شوربة|حساء|شربة/i;
  var _SALAD_IDS  = /سلطة|سلطه|خضارs*طازج|خيار|طماطم.*خيار|خيار.*طماطم|طماطم|salad/i;
  var _TAHINI_IDS = /طحينة|طحينه|طحينى|طاحينة|tahini/i;

  function _isFish(p) { return _FISH_IDS.test((p.food||{}).nameAr||'') || _FISH_IDS.test((p.food||{}).id||''); }
  function _isTuna(p) { return _TUNA_IDS.test((p.food||{}).nameAr||'') || _TUNA_IDS.test((p.food||{}).id||''); }
  function _isRice(p) { return _RICE_IDS.test((p.food||{}).nameAr||'') || _RICE_IDS.test((p.food||{}).id||''); }
  function _isCookedVeg(p) { return _COOKED_VEG.test((p.food||{}).nameAr||''); }
  function _isSalad(p) { return _SALAD_IDS.test((p.food||{}).nameAr||'') || _SALAD_IDS.test((p.food||{}).id||''); }
  function _isTahini(p) { return _TAHINI_IDS.test((p.food||{}).nameAr||'') || _TAHINI_IDS.test((p.food||{}).id||''); }

  function _enforcefish(meal) {
    if (!meal || !Array.isArray(meal.portions)) return;
    var hasFish = meal.portions.some(_isFish);
    if (!hasFish) return;
    var hasTuna = meal.portions.some(_isTuna);
    var kept = [];
    meal.portions.forEach(function(p) {
      // احذف خضار مطبوخ وشوربة مع السمك
      if (_isCookedVeg(p)) { _ORP_LOG('RULE-5H: حذف خضار مطبوخ مع سمك: ' + ((p.food||{}).nameAr||'')); return; }
      // احذف أرز مع تونة تحديداً
      if (hasTuna && _isRice(p)) { _ORP_LOG('RULE-9: حذف أرز مع تونة'); return; }
      kept.push(p);
    });
    // لو مفيش سلطة — أضف واحدة
    var hasSalad = kept.some(_isSalad);
    if (!hasSalad) {
      var sf = { id: 'salata_mshkla', nameAr: 'سلطة مشكلة', nameEn: 'Mixed Salad',
                 cal100: 25, pro100: 1.5, carb100: 4, fat100: 0.3 };
      kept.push({ food: sf, grams: 150, cals: 37, pro: 2.3, carb: 6, fat: 0.5, _orp: true });
      _ORP_LOG('RULE-5H: أُضيفت سلطة مع ' + (hasTuna ? 'تونة' : 'سمك'));
    }
    meal.portions = kept;
  }

  // ═══════════════════════════════════════════════════════════════════
  // [RULE 10] ممنوع أرز في الفطار نهائياً
  // ═══════════════════════════════════════════════════════════════════
  function _noRiceInBreakfast(meal) {
    if (!meal || meal.slot !== 'breakfast') return;
    var before = (meal.portions||[]).length;
    meal.portions = (meal.portions||[]).filter(function(p) {
      if (_isRice(p)) { _ORP_LOG('RULE-10: حذف أرز من الفطار'); return false; }
      return true;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // [RULE 11] وجبة السناك = فاكهة / زبادي / مكسرات فقط
  //           ممنوع أي بروتين حيواني (سمك، فراخ، لحم، تونة، بيض، جبنة)
  // ═══════════════════════════════════════════════════════════════════
  var _SNACK_ANIMAL = /سمك|تونة|تونه|فراخ|دجاج|صدر|ورك|جناح|لحم|بقري|بتلو|كفتة|كفته|كباب|بيض|بيضة|جبن|جبنة|قريش|fish|tuna|chicken|beef|egg|cheese/i;
  var _SNACK_SLOTS  = /snack|سناك|وجبة.*خفيف|خفيف|بين.*وجبت|mid/i;

  function _cleanSnack(meal) {
    if (!meal) return;
    var slot = (meal.slot||'').toLowerCase();
    // تعريف السناك: أي وجبة اسمها snack أو بين الوجبات أو مش فطار/غداء/عشاء
    var isSnack = _SNACK_SLOTS.test(slot) ||
                  (!/(breakfast|lunch|dinner|سحور|إفطار|فطار|غداء|عشاء)/.test(slot) &&
                   slot !== 'breakfast' && slot !== 'lunch' && slot !== 'dinner');
    // ما نعدلش غير السناك
    if (!isSnack) return;
    // أولاً: احذف أي بروتين حيواني
    meal.portions = (meal.portions||[]).filter(function(p) {
      var name = ((p.food||{}).nameAr||'') + ' ' + ((p.food||{}).id||'');
      if (_SNACK_ANIMAL.test(name)) {
        _ORP_LOG('RULE-11: حذف بروتين حيواني من السناك: ' + ((p.food||{}).nameAr||''));
        return false;
      }
      return true;
    });

    // ثانياً: لو السناك فيه فشار/ترمس → احذف فاكهة وزبادي (مسموح: مكسرات فقط)
    var _FUUL_LUPINI = /فشار|فولs*مقشر|فولs*محمص|ترمس|ترمسs*مسلوق|lupini|fuul|feshar/i;
    var _FRUIT_IDS    = /فاكهة|فواكه|تفاح|موزة|موز|برتقال|برتقان|فراولة|عنب|كمثرى|كمثرى|مانجو|خوخ|مشمش|كيوي|جوافة|بطيخ|توت|strawberry|mango|banana|apple|orange|fruit/i;
    var _YOGURT_IDS   = /زبادي|يوغرت|لبن.*زبادي|yogurt|zabady/i;

    var hasFuulLupini = meal.portions.some(function(p){
      var n = ((p.food||{}).nameAr||'') + ' ' + ((p.food||{}).id||'');
      return _FUUL_LUPINI.test(n);
    });
    if (hasFuulLupini) {
      meal.portions = meal.portions.filter(function(p){
        var n = ((p.food||{}).nameAr||'') + ' ' + ((p.food||{}).id||'');
        if (_FRUIT_IDS.test(n))  { _ORP_LOG('RULE-11b: حذف فاكهة مع فشار/ترمس: ' + ((p.food||{}).nameAr||'')); return false; }
        if (_YOGURT_IDS.test(n)) { _ORP_LOG('RULE-11b: حذف زبادي مع فشار/ترمس: ' + ((p.food||{}).nameAr||'')); return false; }
        return true;
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // [RULE 8] مصدر بروتين حيواني واحد فقط في كل وجبة
  //   • استثناء الفطار: بيض + جبنة/زبادي مع بعض = مقبول
  //   • باقي الوجبات: بروتين واحد، الكمية تزيد عادي
  //   • ممنوع في الفطار: سمك/فراخ/لحم مع أي بروتين تاني
  // ═══════════════════════════════════════════════════════════════════
  function _proteinCategory(p) {
    var t = ((p.food||{}).nameAr||'') + ' ' + ((p.food||{}).id||'') + ' ' + ((p.food||{}).nameEn||'');
    if (/سمك|تونة|تونه|بلطي|بوري|ماكريل|سردين|fish|tuna/i.test(t)) return 'fish';
    if (/فراخ|دجاج|صدر.*دجاج|صدر.*فراخ|ورك|جناح|chicken/i.test(t)) return 'chicken';
    if (/لحم|بقري|بتلو|بفتيك|شرحات|ريش|كفتة|كفته|كباب|beef|steak/i.test(t)) return 'beef';
    if (/كبدة|كبد|liver/i.test(t)) return 'liver';
    if (/بيض|بيضة|بيضات|egg/i.test(t)) return 'egg';
    if (/جبن|جبنة|قريش|زبادي|لبنة|يوغرت|cheese|yogurt|dairy/i.test(t)) return 'dairy';
    return null;
  }

  // أولوية الاحتفاظ عند التعارض (الأكبر = الأهم)
  var _PROTEIN_PRIORITY = { chicken:6, beef:5, liver:5, fish:4, egg:3, dairy:2 };

  function _enforceSingleProtein(meal) {
    if (!meal || !Array.isArray(meal.portions)) return;
    var slot = (meal.slot||'').toLowerCase();
    var isBreakfast = slot === 'breakfast' || /فطار|إفطار/.test(slot);

    // اجمع كل الفئات الموجودة
    var catMap = {}; // cat → [portion]
    meal.portions.forEach(function(p) {
      var c = _proteinCategory(p);
      if (c) { if (!catMap[c]) catMap[c] = []; catMap[c].push(p); }
    });
    var cats = Object.keys(catMap);
    if (cats.length <= 1) return; // مفيش تعارض

    // تعريف البروتينات الحيوانية الصارمة (مش بيض ومش ألبان)
    var meatCats = cats.filter(function(c){ return c==='fish'||c==='chicken'||c==='beef'||c==='liver'; });
    var eggCat   = catMap['egg']   ? 'egg'   : null;
    var dairyCat = catMap['dairy'] ? 'dairy' : null;

    // استثناء الفطار: بيض + ألبان فقط = مقبول
    if (isBreakfast && meatCats.length === 0) return; // بيض + جبنة ← OK

    // احدد الفئة المحتفظ بيها (الأعلى أولوية من اللحوم، أو الأول لو مفيش لحوم)
    var keepCat;
    if (meatCats.length > 0) {
      keepCat = meatCats.reduce(function(a,b){
        return (_PROTEIN_PRIORITY[a]||0) >= (_PROTEIN_PRIORITY[b]||0) ? a : b;
      });
    } else {
      keepCat = cats.reduce(function(a,b){
        return (_PROTEIN_PRIORITY[a]||0) >= (_PROTEIN_PRIORITY[b]||0) ? a : b;
      });
    }

    // احذف كل البروتينات التانية عدا المحتفظ بيها
    // استثناء: لو الفطار نحذف اللحوم بس ونبقي البيض والجبنة
    var toRemove = cats.filter(function(c){
      if (isBreakfast) {
        // في الفطار: لو في لحوم → احذف اللحوم غير المختارة + البروتين الحيواني التاني
        if (meatCats.length > 0) return c !== keepCat; // احذف كل حاجة عدا الأعلى أولوية
        return false;
      }
      return c !== keepCat; // في باقي الوجبات: احذف كل حاجة عدا المختار
    });

    if (toRemove.length === 0) return;
    toRemove.forEach(function(c){
      _ORP_LOG('RULE-8: حذف فئة بروتين "' + c + '" من وجبة ' + slot + ' (المحتفظ: ' + keepCat + ')');
    });
    meal.portions = meal.portions.filter(function(p){
      var c = _proteinCategory(p);
      return !c || toRemove.indexOf(c) === -1;
    });
  }

  // ── [RULE 7] إزالة تكرار الكلمات في أسماء الأطعمة (مشوي مشوي → مشوي) ──
  function _dedupeArWords(str){
    if (!str || typeof str !== 'string') return str;
    // احذف كلمة متكررة مباشرة بعد نفسها (بمسافة واحدة أو أكثر)
    return str.replace(/(\S+)(\s+)+/g, '$1').trim();
  }
  function _fixFoodNames(meal){
    if (!meal || !Array.isArray(meal.portions)) return;
    meal.portions.forEach(function(p){
      if (!p || !p.food) return;
      if (p.food.nameAr) p.food.nameAr = _dedupeArWords(p.food.nameAr);
    });
  }


  // ── نقطة التدخل: نعترض generateMealPlan ──────────────────────
  // [FIX v3] Robust hook: tries immediately then retries via setTimeout if needed
  function _doORPHook(_NE){
    var hooked = false;
    if (_NE && typeof _NE.calculate === 'function') {
      var _origCalc = _NE.calculate;
      _NE.calculate = function(ctx){
        var result = _origCalc.call(this, ctx);
        try { result = _applyRules(result, ctx); } catch(e) { _ORP_LOG('calculate ORP error: ' + e); }
        return result;
      };
      hooked = true;
    }
    if (_NE && typeof _NE.generateMealPlan === 'function') {
      var _origGen = _NE.generateMealPlan;
      _NE.generateMealPlan = function(ctx){
        var plan = _origGen(ctx);
        if (!plan || !Array.isArray(plan.meals)) return plan;
        try {
          plan.meals.forEach(function(m){
            _cleanMeal(m);
            _sortMealPortions(m); // [FIX-L]
            _forbidVegWithSensitive(m);
            _fixSoloVeggies(m);
            _fixFoodNames(m);
            _enforcefish(m);
            _noRiceInBreakfast(m);
            _cleanSnack(m);
            _enforceSingleProtein(m);
          });
          _enforceDinner(plan);
          _scaleTwoMeals(plan);
          _ORP_LOG('✅ OwnerRules applied (v3.0)');
        } catch(e) { _ORP_LOG('⚠️ ORP error: '+e.message); }
        return plan;
      };
      hooked = true;
    }
    if (hooked) _ORP_LOG('✅ OwnerRulesPostProcessor v3.0 hooked successfully');
    return hooked;
  }

  var _NE = (typeof window !== 'undefined' && window.NutritionEngine) ||
            (typeof NutritionEngine !== 'undefined' && NutritionEngine) || null;
  if (!_doORPHook(_NE)) {
    // NutritionEngine not yet ready — retry after a tick (handles async load order)
    _ORP_LOG('⚠️ NutritionEngine not ready yet, scheduling retry...');
    if (typeof setTimeout !== 'undefined') {
      setTimeout(function(){
        var _NE2 = (typeof window !== 'undefined' && window.NutritionEngine) ||
                   (typeof NutritionEngine !== 'undefined' && NutritionEngine) || null;
        if (!_doORPHook(_NE2)) {
          _ORP_LOG('⚠️ ORP retry failed — NutritionEngine not available');
        }
      }, 0);
    }
  }

})();
