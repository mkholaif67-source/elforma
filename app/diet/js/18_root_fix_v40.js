// ═══════════════════════════════════════════════════════════════════
//  ROOT FIX v40 — إصلاح شامل وجذري
//  هندسة: تحويل منطق الرجيم والقواعد الطبية من «جداول معرفات إنجليزية
//  ميتة» إلى «منطق مدفوع ببيانات الطعام الفعلية» (الفئة + الماكروز +
//  مستوى التصنيع + الاسم العربي). يعمل بشكل إضافي غير هدام فوق المحرك.
//
//  يعالج:
//   [F1] عدم تطابق المعرفات: HEALTH_MEAL_RULES.avoidFoods / DIET_CONSTRAINTS
//        / FOOD_ENRICHMENT كانت بمعرفات إنجليزية لا تطابق أطعمة القاعدة
//        (العربية) - الفلاتر الطبية لم تكن تستبعد شيئا فعليا.
//   [F2] تعارض المفتاح hypertension - bp داخل avoidHealth.
//   [F3] لو كارب كان يحظر فئة الكارب بالكامل (صارم كالكيتو) ويناقض وصفه.
//   [F4] mealRole لم يكن يستنتج للأطعمة العربية - قوالب الوجبات تنهار.
//   [F5] غياب فحص سلامة يربط القواعد بقاعدة البيانات.
// ═══════════════════════════════════════════════════════════════════
(function _rootFixV40() {
  'use strict';
  var L = (typeof LOG === 'function') ? LOG : function(){};
  L('ROOT FIX v40 — بدء الإصلاح الشامل...');

  // ── أدوات تطبيع النص العربي ───────────────────────────────────────
  function norm(s) {
    return String(s || '')
      .replace(/[\u064B-\u0652\u0640]/g, '')      // حركات + تطويل
      .replace(/[\u0623\u0625\u0622\u0627]/g, '\u0627') // أإآا - ا
      .replace(/\u0649/g, '\u064A')                 // ى - ي
      .replace(/\u0629/g, '\u0647')                 // ة - ه
      .replace(/\u0624/g, '\u0648')                 // ؤ - و
      .replace(/\u0626/g, '\u064A')                 // ئ - ي
      .replace(/\u0621/g, '')                       // ء
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  // مطابقة بالكلمة الكاملة (وليس الجزئية) لتجنب الإيجابيات الكاذبة:
  // مثل "بروتين" التي تحتوي "تين"، أو "موزاريلا"/"موز"، أو "بطاطس"/"بط".
  // نجرد أدوات التعريف والعطف (ال/وال/بال...) من بداية كل كلمة.
  function stripAffix(tok) { return tok.replace(/^(?:\u0648\u0627\u0644|\u0641\u0627\u0644|\u0628\u0627\u0644|\u0643\u0627\u0644|\u0644\u0644|\u0627\u0644)/, ''); }
  function tokInfo(food) {
    if (food.__rfTok) return food.__rfTok;
    var h = norm((food.nameAr || '') + ' ' + (food.nameEn || '') + ' ' + ((food.tags || []).join(' ')));
    var set = {};
    h.split(' ').forEach(function(t) { if (t) { set[t] = 1; set[stripAffix(t)] = 1; } });
    var info = { padded: ' ' + h + ' ', set: set };
    try { Object.defineProperty(food, '__rfTok', { value: info, enumerable: false }); } catch (e) { food.__rfTok = info; }
    return info;
  }
  function has(food, words) {
    var info = tokInfo(food);
    for (var i = 0; i < words.length; i++) {
      var kw = norm(words[i]);
      if (!kw) continue;
      if (kw.indexOf(' ') !== -1) {            // عبارة متعددة الكلمات - مطابقة عبارة
        if (info.padded.indexOf(' ' + kw + ' ') !== -1) return true;
        if (info.padded.indexOf(kw) !== -1) return true;
      } else if (info.set[kw]) {               // كلمة مفردة - مطابقة رمزية كاملة
        return true;
      }
    }
    return false;
  }
  var hi = function(p){ return p === 'high' || p === 'very_high'; };

  // ── قواميس كلمات (علمية) لاشتقاق القيود الطبية من اسم الطعام ───────
  var KW = {
    fried:        ['مقلي','مقلية','محمر','محمره','بانيه','كرسبي','ناجتس','بطاطس مقلي','بطاطس محمر','سوتيه مقلي'],
    sugary:       ['سكر','عسل','تمر','بلح','مربي','عصير','كولا','بيبسي','سبرايت','غازي','شوكولاته','شيكولاته','حلاوه','بسكويت','كيك','جاتوه','ايس كريم','ايسكريم','نوتيلا','مهلبيه','ارز باللبن','كنافه','بسبوسه','بقلاوه','دونات','عنب','زبيب','تين','مربي'],
    whiteCarb:    ['ارز ابيض','عيش ابيض','خبز ابيض','عيش فينو','فينو','توست ابيض','مكرونه','باستا','اسباجتي','اسباغيتي','نودلز','اندومي','كورن فليكس','رقائق ذره'],
    sweetFruit:   ['موز','مانجو','بطيخ','تمر','بلح','عنب','زبيب','تين','مانجا'],
    saltProc:     ['سجق','لانشون','بسطرمه','بسطرمة','هوت دوج','نقانق','مخلل','مملح','رنجه','فسيخ','ملوحه','شيبسي','جبنه رومي','جبنه روميه','فيتا','جبنه مالحه','جبنه قديمه','صويا صوص','صلصه صويا','مكسبات','ماجي'],
    satFat:       ['كبده','كبد','ممبار','مخ','سجق','لانشون','بسطرمه','سمنه','زبده','قشطه','كريمه','جبنه دسمه','مفروم','جلد','بط','اوز','كرشه'],
    purine:       ['كبده','كبد','كلاوي','مخ','ممبار','سردين','انشوجه','تونه','جمبري','استاكوزا','كابوريا','مأكولات بحريه','بط','اوز','مفروم','مرقه لحم','لحم احمر'],
    fodmap:       ['بصل','ثوم','فول','عدس','حمص','فاصوليا','لوبيا','بسله','قرنبيط','بروكلي','كرنب','ملفوف','بطيخ','تفاح','كمثري','مانجو','لبن','حليب','قمح','شطه','حار','فلفل حار'],
    gerd:         ['مقلي','حار','شطه','فلفل حار','بصل','ثوم','طماطم','صلصه','برتقال','ليمون','حمضيات','قهوه','نسكافيه','كولا','بيبسي','سبرايت','غازي','شوكولاته','نعناع','خل'],
    freshDairy:   ['لبن','حليب','زبادي','ايس كريم','قشطه','كريمه','مهلبيه','ارز باللبن','بشاميل','جبنه قريش','زبادي يوناني'],
    hardCheese:   ['جبنه رومي','جبنه روميه','شيدر','بارميزان','جبنه قديمه','بروفولون'],
    gluten:       ['قمح','عيش','خبز','توست','مكرونه','باستا','اسباجتي','اسباغيتي','شوفان','برغل','فريك','كسكسي','تورتيلا','بقسماط','بيتزا','فطير','فطيره','طحين','دقيق','شعير','نودلز','اندومي','كيك','بسكويت','بقلاوه','كنافه','معجنات','فطاير'],
    iodineCaff:   ['سردين','تونه طازجه','تونه طازج','قهوه','نسكافيه','اعشاب بحريه','اعشاب بحر']
  };

  // ── المحرك: اشتقاق الحالات الممنوعة لكل طعام من بياناته ──────────
  // ملاحظة تصميمية: نحظر فقط ما هو «غير مناسب بوضوح» طبيا — لا نحظر
  // الأطعمة الكاملة الصحية حتى لا نقع في الإفراط في التشدد.
  function deriveBlocked(food) {
    var out = [];
    var cat = food.cat || '';
    var carb = +food.carb || 0;
    var fat = +food.fat || 0;
    var pro = +food.pro || 0;
    var proc = food.processedLevel || '';
    var add = function(c){ if (out.indexOf(c) === -1) out.push(c); };

    var isSugary   = has(food, KW.sugary);
    var isWhite    = has(food, KW.whiteCarb);
    var isFried    = has(food, KW.fried);
    var highGICarb = (cat === 'carb' && (hi(proc) || isWhite));
    var sweetFruit = (cat === 'fruit' && (carb >= 18 || has(food, KW.sweetFruit)));

    // السكري / مقاومة الإنسولين / تكيس المبايض / بطء الحرق:
    // تجنب السكريات + الكارب المكرر عالي المؤشر الجلايسيمي + الفواكه عالية السكر
    if (isSugary || isWhite || highGICarb || sweetFruit || (cat === 'snack' && isSugary)) {
      add('diabetes'); add('insulin'); add('pcos'); add('slow-meta');
    }

    // الضغط: عالي الصوديوم / لحوم مصنعة / مخللات / أجبان مالحة
    if (has(food, KW.saltProc) || (cat === 'protein' && hi(proc))) {
      add('bp');
    }

    // الكوليسترول: دهون مشبعة / مقليات / أحشاء / دهون عالية مصنعة
    if (has(food, KW.satFat) || isFried || (cat === 'protein' && fat >= 22 && proc !== 'none')) {
      add('cholesterol');
    }

    // النقرس: أطعمة عالية البيورين
    if (has(food, KW.purine)) {
      add('gout');
    }

    // الكلى: لحوم مصنعة + أحشاء + مالح بشدة (فوسفور/صوديوم/بيورين)
    if (has(food, KW.saltProc) || has(food, KW.purine)) {
      add('kidney');
    }

    // القولون العصبي (FODMAP) + المقليات + الدهون العالية
    if (has(food, KW.fodmap) || isFried) {
      add('ibs');
    }

    // الارتجاع (GERD): حمضي/حار/مقلي/مكربن/كافيين/دهون عالية
    if (has(food, KW.gerd) || isFried || fat >= 25) {
      add('gerd');
    }

    // اللاكتوز: ألبان طازجة (نستثني الأجبان القديمة منخفضة اللاكتوز)
    if ((cat === 'dairy' && !has(food, KW.hardCheese)) || has(food, KW.freshDairy)) {
      add('lactose');
    }

    // الجلوتين: القمح/الشعير/الشوفان/المعجنات (الأرز آمن)
    if (has(food, KW.gluten)) {
      add('gluten');
    }

    // فرط نشاط الغدة: يود عال + كافيين
    if (has(food, KW.iodineCaff)) {
      add('hyperthyroid');
    }

    return out;
  }

  // ── [F4] استنتاج دور الوجبة (mealRole) من الفئة + الماكروز ─────────
  function inferRole(food) {
    var cat = food.cat || '';
    var pro = +food.pro || 0, fat = +food.fat || 0, carb = +food.carb || 0;
    switch (cat) {
      case 'protein': return (pro >= 18) ? 'main_protein' : 'side_protein';
      case 'carb':    return 'main_carb';
      case 'fruit':   return 'fruit_carb';
      case 'veggie':  return 'veggie';
      case 'fat':     return (fat >= 30) ? 'main_fat' : 'side_fat';
      case 'dairy':   return (pro >= 8) ? 'side_protein' : 'quick_carb';
      case 'snack':   return (carb >= 15) ? 'quick_carb' : 'side_fat';
      default:        return undefined;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  [F1+F2] إثراء قاعدة الأطعمة بالقيود الطبية المشتقة من البيانات
  // ═══════════════════════════════════════════════════════════════
  var statBlocked = {}, taggedFoods = 0;
  if (typeof FOOD_DB !== 'undefined' && Array.isArray(FOOD_DB)) {
    FOOD_DB.forEach(function(food) {
      if (!food || food._rootFixV40) return;

      // (F2) تطبيع avoidHealth: hypertension - bp ، وإزالة التكرار
      var ah = Array.isArray(food.avoidHealth) ? food.avoidHealth.slice() : [];
      ah = ah.map(function(x){ return x === 'hypertension' ? 'bp' : x; });

      // (F1) دمج القيود المشتقة
      var derived = deriveBlocked(food);
      derived.forEach(function(c){ if (ah.indexOf(c) === -1) ah.push(c); });

      food.avoidHealth = ah;
      // مزامنة مع مسار V16 (HF-1) الذي يقرأ blockedConditions
      var bc = Array.isArray(food.blockedConditions) ? food.blockedConditions.slice() : [];
      ah.forEach(function(c){ if (bc.indexOf(c) === -1) bc.push(c); });
      food.blockedConditions = bc;

      // (F4) دور الوجبة على الكائن نفسه (لمن يقرأ food.mealRole)
      if (!food.mealRole) { var r = inferRole(food); if (r) food.mealRole = r; }

      ah.forEach(function(c){ statBlocked[c] = (statBlocked[c] || 0) + 1; });
      food._rootFixV40 = true;
      if (derived.length) taggedFoods++;
    });
    L('✔ [F1/F2] إثراء طبي مشتق من البيانات على ' + FOOD_DB.length + ' طعاما (' + taggedFoods + ' حصل على قيود)');
    L('   توزيع القيود الطبية: ' + JSON.stringify(statBlocked));
  } else {
    L('FOOD_DB غير متاح — تم تخطي الإثراء الطبي');
  }

  // ═══════════════════════════════════════════════════════════════
  //  [F3] إصلاح لو كارب: السماح بالكارب المعقد وحظر المكرر فقط
  // ═══════════════════════════════════════════════════════════════
  if (typeof DIET_CONSTRAINTS !== 'undefined' && DIET_CONSTRAINTS.lowcarb) {
    var lc = DIET_CONSTRAINTS.lowcarb;
    if (lc.allowedCats && lc.allowedCats.indexOf('carb') === -1) {
      lc.allowedCats.push('carb'); // لم نعد نحظر فئة الكارب بالكامل
      L('✔ [F3] لو كارب: تم فتح فئة الكارب (كارب معقد مسموح، مكرر محظور عبر البوابة)');
    }
  }
  function isRefinedCarb(food) {
    return (food.cat === 'carb') &&
      (has(food, KW.whiteCarb) || has(food, KW.sugary) || hi(food.processedLevel || ''));
  }

  // ═══════════════════════════════════════════════════════════════
  //  بوابة isFoodAllowed: طبقة لو كارب (تعمل فوق HF-1)
  // ═══════════════════════════════════════════════════════════════
  if (typeof isFoodAllowed === 'function') {
    var _prevIsFoodAllowed = isFoodAllowed;
    isFoodAllowed = function isFoodAllowed(food) {
      // لو كارب: بعد فتح فئة الكارب، نحظر الكارب المكرر/عالي GI فقط
      try {
        var diet = (typeof DE !== 'undefined' && DE.selectedDiet) ? DE.selectedDiet : 'balanced';
        if (diet === 'lowcarb' && food && isRefinedCarb(food)) {
          return { ok: false, reason: 'كارب مكرر عالي GI — غير مناسب للو كارب (كارب معقد فقط)' };
        }
      } catch (e) {}
      return _prevIsFoodAllowed(food);
    };
    L('✔ بوابة isFoodAllowed: طبقة لو كارب نشطة فوق الفلتر الطبي V16');
  }

  // ═══════════════════════════════════════════════════════════════
  //  [F4] إكمال FOOD_INTELLIGENCE باستنتاج mealRole + GI للأطعمة العربية
  // ═══════════════════════════════════════════════════════════════
  // ملاحظة جوهرية: FOOD_INTELLIGENCE معرف ب const — لا يمكن إعادة إسناده (Proxy)
  // (وهذا بالضبط سبب فشل AutoIntel في 16_subsystems بصمت). الحل الصحيح:
  // التعديل على الكائن نفسه (الربط ثابت لكن الكائن قابل للتعديل) — نضيف ملفات
  // ذكاء مستنتجة للأطعمة العربية غير الموجودة (تشمل mealRole وGI والإشباع).
  try {
    if (typeof FOOD_INTELLIGENCE !== 'undefined' && typeof FOOD_DB !== 'undefined' && Array.isArray(FOOD_DB)) {
      var fiAdded = 0;
      FOOD_DB.forEach(function(food) {
        if (!food || Object.prototype.hasOwnProperty.call(FOOD_INTELLIGENCE, food.id)) return;
        var carb = +food.carb || 0, fat = +food.fat || 0, pro = +food.pro || 0, cat = food.cat || '';
        var insulinImpact = carb < 5 ? 'very_low' : carb < 15 ? 'low' : carb < 30 ? 'medium' : carb < 50 ? 'high' : 'very_high';
        var satietyLevel  = pro >= 20 ? 8 : pro >= 12 ? 7 : fat >= 15 ? 7 : fat >= 8 ? 6 : (cat === 'veggie' ? 4 : 5);
        var digestionSpeed = fat > 15 ? 'slow' : (pro >= 20 && fat < 5) ? 'fast' : (cat === 'fruit' || cat === 'veggie') ? 'fast' : 'medium';
        var fiberLevel = cat === 'veggie' ? 'high' : cat === 'fruit' ? 'medium' : cat === 'carb' ? 'medium' : 'low';
        FOOD_INTELLIGENCE[food.id] = {
          mealRole: inferRole(food), pairWith: [], incompatibleWith: [],
          insulinImpact: insulinImpact, satietyLevel: satietyLevel,
          digestionSpeed: digestionSpeed, fiberLevel: fiberLevel, _rootFixInferred: true
        };
        fiAdded++;
      });
      L('✔ [F4] FOOD_INTELLIGENCE: تمت إضافة ملفات ذكاء مستنتجة ل ' + fiAdded + ' صنفا (mealRole + GI + إشباع)');
    }
  } catch (e) {
    L('[F4] تعذر إكمال FOOD_INTELLIGENCE: ' + e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  //  [F5] فحص سلامة: نسبة مطابقة معرفات القواعد لقاعدة البيانات
  //  + أحجام مجمعات الأطعمة المتبقية لكل حالة (لمنع التشدد المفرط)
  // ═══════════════════════════════════════════════════════════════
  (function integrity() {
    if (typeof FOOD_DB === 'undefined' || !Array.isArray(FOOD_DB)) return;
    var ids = {};
    FOOD_DB.forEach(function(f){ ids[f.id] = true; });

    // (أ) كم مرجعا في HEALTH_MEAL_RULES ما زال "ميتا" (تشخيص فقط)
    if (typeof HEALTH_MEAL_RULES !== 'undefined') {
      var refs = 0, dead = 0;
      Object.keys(HEALTH_MEAL_RULES).forEach(function(k){
        ['avoidFoods','preferFoods'].forEach(function(field){
          var arr = HEALTH_MEAL_RULES[k][field] || [];
          arr.forEach(function(id){ refs++; if (!ids[id]) dead++; });
        });
      });
      L('[F5] مراجع HEALTH_MEAL_RULES بالمعرفات الإنجليزية: ' + dead + '/' + refs +
        ' ميتة (لم تعد مؤثرة — استبدل منطقها بالاشتقاق من البيانات)');
    }

    // (ب) أحجام المجمعات لكل حالة طبية — تحذير لو قل المجمع كثيرا
    var conds = ['diabetes','insulin','bp','cholesterol','kidney','ibs','gout',
                 'gerd','lactose','gluten','pcos','slow-meta','hyperthyroid'];
    var pools = {};
    conds.forEach(function(hc){
      var n = FOOD_DB.filter(function(f){
        return !(Array.isArray(f.avoidHealth) && f.avoidHealth.indexOf(hc) !== -1);
      }).length;
      pools[hc] = n;
      if (n < 60) L('[F5] مجمع أطعمة الحالة "' + hc + '" صغير: ' + n + ' صنف — راجع التشدد');
    });
    L('✔ [F5] أحجام مجمعات الأطعمة المسموحة لكل حالة: ' + JSON.stringify(pools));
  })();

  L('ROOT FIX v40 — اكتمل الإصلاح الشامل بنجاح');
})();
