// ════════════════════════════════════════════════════════════════════
//  js/22_egyptian_meal_intelligence.js
//  طبقة ذكاء الوجبة المصرية — Egyptian Meal Intelligence Layer (EGY-MIL)
//
//  غير هدام بالكامل: بيلف scoreFoodForContext فقط.
//  لا يمس BMR/TDEE ولا السعرات ولا الماكروز ولا الفلاتر الطبية
//  ولا قيود الأنظمة ولا واجهة اختيار الأكل.
//
//  الهدف: لما النظام يكمل وجبة تلقائيا (العميل سابها فاضية أو ناقصة)،
//  يبقى الأكل المضاف تلقائيا أكل مصري طبيعي مناسب لطبيعة الوجبة —
//  مش أكل سناك زي الترمس/السوداني/المكسرات كأساس فطار/غدا/عشا.
//
//  القاعدة: "مسموح في الدايت" ≠ "مناسب تلقائيا للوجبة".
//  اختيار العميل اليدوي محصن تماما من أي عقوبة (العميل أولا).
// ════════════════════════════════════════════════════════════════════
(function EgyptianMealIntelligenceLayer(){
  if (typeof window === 'undefined') return;
  if (typeof scoreFoodForContext !== 'function') {
    try { console.warn('[EGY-MIL] scoreFoodForContext غير موجود — الطبقة غير مفعلة'); } catch(e){}
    return;
  }

  function _arr(x){ return Array.isArray(x) ? x : []; }

  // تطبيع عربي خفيف (نفس فلسفة _v41Norm الموجودة في المحرك)
  function _norm(s){
    return String(s||'')
      .replace(/[\u064B-\u0652\u0670\u0640]/g,'')
      .replace(/[\u0623\u0625\u0622]/g,'\u0627')
      .replace(/[\u0629\u0647]/g,'\u0647')
      .replace(/[\u064A\u0649]/g,'\u064A')
      .replace(/\u0624/g,'\u0648').replace(/\u0626/g,'\u064A').replace(/\u0621/g,'')
      .toLowerCase().trim();
  }
  function _txt(food){
    if (!food) return '';
    return _norm((food.nameAr||'')+' '+(food.nameEn||'')+' '+(food.id||'')+' '+_arr(food.tags).join(' '));
  }
  function _hasAny(food, words){
    const hay = _txt(food);
    return words.some(function(w){ return hay.indexOf(_norm(w)) !== -1; });
  }

  // أكل "مسليات/سناك" بطبيعته — مينفعش يبقى أساس وجبة رئيسية تلقائيا
  //  (السوداني والترمس والمكسرات والشيبسي والبسكوت)
  var SNACK_ONLY = [
    '\u0633\u0648\u062f\u0627\u0646\u064a','peanut','swdany',
    '\u062a\u0631\u0645\u0633','trms','lupin',
    '\u0644\u0648\u0632','almond','\u0643\u0627\u062c\u0648','cashew','\u0639\u064a\u0646 \u062c\u0645\u0644','\u062c\u0648\u0632','walnut',
    '\u0628\u0646\u062f\u0642','hazelnut','\u0641\u0633\u062a\u0642','pistachio','\u0628\u064a\u0643\u0627\u0646','pecan',
    '\u0645\u0643\u0633\u0631\u0627\u062a','nuts','\u0645\u0633\u0644\u064a\u0627\u062a',
    '\u0644\u0628 \u0627\u0628\u064a\u0636','\u0644\u0628 \u0633\u0648\u0631\u064a','\u0644\u0628 \u0642\u0631\u0639','\u0644\u0628 \u0633\u0648\u0628\u0631','lbabyd','lbswry','lbqra','lbswpr',
    '\u0628\u0630\u0648\u0631','seeds','\u062f\u0648\u0627\u0631 \u0627\u0644\u0634\u0645\u0633','sunflower',
    '\u0634\u064a\u0628\u0633\u064a','crisps','chips','\u0628\u0633\u0643\u0648\u062a','\u0628\u0633\u0643\u0648\u064a\u062a','biscuit',
    '\u0634\u0648\u0643\u0648\u0644\u0627\u062a\u0647','chocolate','\u062c\u0631\u0627\u0646\u0648\u0644\u0627','granola'
  ];
  function _isSnackOnly(food){
    if (!food) return false;
    return _hasAny(food, SNACK_ONLY);
  }

  function _slotIsMain(slot){
    return slot === 'breakfast' || slot === 'lunch' || slot === 'dinner' || slot === 'post' || slot === 'pre';
  }
  function _userSelected(food){
    try {
      return !!food && typeof DE !== 'undefined' && _arr(DE.availableFoods).indexOf(food.id) !== -1;
    } catch(e){ return false; }
  }

  // الفطار الشعبي المصري (أعلى أولوية): بيض/قريش/جبنة بيضاء/رودس جولد/فول
  var EGY_BREAKFAST_TOP  = ['بيض','byd','egg','فول','fwl','foul','قريش','qrysh','cottage','جبنه بيضا','جبنة بيضاء','بيضا','white cheese','رودس','rodes','rods','roses','جولد'];
  // أساسيات فطار طبيعية أخرى (أولوية متوسطة)
  var EGY_BREAKFAST_CORE = ['عيش','ays','خبز','توست','toast','زبادي','zbady','لبنه','laban','جبن','jbn','طعميه','طعمية','tameya'];
  // جبن/أصناف مصنعة تخفض أولويتها في الفطار (مستعملة بكثرة)
  var EGY_BREAKFAST_LOWPRIO = ['شيدر','شيدار','cheddar','مثلث','مثلثات','triangle','موزاريلا','موتزاريلا','mozzarella','كيري','kiri'];
  // بروتين قطعي طبيعي (أعلى أولوية): صدور/ورك فراخ، لحمة، سمك، كبدة
  var EGY_WHOLE_CUT = ['صدر','صدور','فيليه','فراخ','دجاج','frakh','ورك','فخد','فخده','لحم','لحمه','بقري','بتلو','بفتيك','سمك','smk','بلطي','بوري','ماكريل','سردين','تونه','twna','كبد','كبده','بيف','beef','chicken','fish'];
  // مفروم/مشوي بيتي (أولوية عالية زي القطعيات): كفتة/كباب/حواوشي
  var EGY_HOMEMADE_MINCED = ['كفته','كفتة','kofta','كباب','kebab','حواوشي','hawawshi'];

  // [بند 2] أولوية الخضار بالترتيب: طبق سلطة أولاً ثم خيار > فلفل > كابوتشا/خس > طماطم
  // ينطبق على الفطار والعشاء بنفس المنطق.
  var EGY_VEGGIE_PRIORITY_1 = ['salad','سلطة','سلطه','tabouleh','تبولة','fattoush','فتوش','خضار مشكل','mixed.veg'];
  var EGY_VEGGIE_PRIORITY_2 = ['خيار','cucumber','khyar'];
  var EGY_VEGGIE_PRIORITY_3 = ['فلفل','pepper','filfil','capsicum'];
  var EGY_VEGGIE_PRIORITY_4 = ['كابوتشا','cabbage','خس','lettuce','khass'];
  var EGY_VEGGIE_PRIORITY_5 = ['طماطم','tomato','tmatum','tamatim']; // أقل أولوية
  // [بند 1] إضافات الدهون — تُستخدم فقط لاستكمال احتياج الدهون — ليست إضافات تلقائية 
  // زيت زيتون: مرتبط بالسلطة والفول والجبنة | زبدة: مرتبطة بالفول والبيض المقلي
  var FAT_ADDITION_OLIVE_OIL_TRIGGERS = ['سلط','salad','فول','foul','fwl','جبنه','جبنة','cheese','cottage','قريش'];
  var FAT_ADDITION_BUTTER_TRIGGERS    = ['فول','foul','fwl','بيض مقلي','بيض مقل','fried egg','fried_egg','qly'];
  var FAT_ADDITION_IDS = ['olive_oil','butter','زيت زيتون','زبدة'];
  // لو الأكلة الحالية في الوجبة لا تتضمن محفز الدهن ، بنخفض أولوية الزيت/الزبدة (لا يدخلوا تلقائياً) 
  function _isFatAddition(food){ return food && FAT_ADDITION_IDS.some(function(id){ return (food.id||'').indexOf(id) !== -1 || _hasAny(food,[id]); }); }
  function _hasFatTrigger(food, list){ return food && _hasAny(food, list); }
  // مصنع صناعي (أولوية أقل): برجر/سجق/لانشون/بسطرمة/ناجتس/بانيه/شاورما
  var EGY_PROCESSED_MEAT = ['برجر','burger','سجق','سوسيس','sausage','لانشون','luncheon','بسطرمه','بسطرمة','pastrami','هوت دوج','hotdog','ناجتس','nuggets','بانيه','بانية','panne','شاورما','shawrma'];

  var _origScore = scoreFoodForContext;
  scoreFoodForContext = function scoreFoodForContext(food, mealType, context){
    var s = _origScore(food, mealType, context);
    try {
      if (!food) return s;
      var slot = mealType;
      var picked = _userSelected(food);

      // (1) منع الأكل السناك من الدخول التلقائي كأساس لوجبة رئيسية.
      //     اختيار العميل اليدوي محصن تماما (مفيش عقوبة).
      //     العقوبة بتعيد الترتيب بس، ومابتمنعش الاختيار كملاذ أخير لو مفيش بديل.
      if (!picked && _slotIsMain(slot) && _isSnackOnly(food)) {
        // [بند 1] منع صارم: سناك/مكسرات/تمر/فاكهة في وجبة رئيسية — -800 حتى لو بالبانتري
        // استثناء: الزبادي مسموح (ليس سناك بالمعنى الكامل)
        var isYogurt = _hasAny(food, ['زبادي','زباده','zbady','yoghurt','yogurt','labneh','لبنه']);
        if (!isYogurt) s -= 800;
      }

      // (2) الفطار المصري: تعزيز الأساسيات الطبيعية (بيض/فول/جبنة/عيش/زبادي)
      if (slot === 'breakfast') {
        if (_hasAny(food, EGY_BREAKFAST_TOP))            s += 30;
        else if (_hasAny(food, EGY_BREAKFAST_CORE))      s += 10;
        if (!picked && _hasAny(food, EGY_BREAKFAST_LOWPRIO)) s -= 22;
        // أولوية الجبن في الفطار: قريش (الأولى) ثم رودس طبيعي (الثانية)
        if (food.cat === 'dairy') {
          if (_hasAny(food, ['قريش','qrysh','cottage']))                s += 16;
          else if (_hasAny(food, ['رودس','rwds','rodes','جولد','gwld'])) s += 12;
        }
        // منع صارم لكاربات الغداء من الفطار (أرز/مكرونة/كشري) حتى لو اختارها المستخدم
        if (food.cat === 'carb' && _hasAny(food, ['ارز','رز','أرز','مكرون','مكرونه','مكرونة','كشري','كشرى'])) s -= 5000;
      }

      // (2b) [بند 2] أولوية الخضار: سلطة أولاً ثم خيار > فلفل > كابوتشا/خس > طماطم (فطار+عشاء+غداء)
      if (food.cat === 'veggie' || food.cat === 'vegetable') {
        var isMainOrBreakfastOrDinner = slot === 'breakfast' || slot === 'lunch' || slot === 'dinner';
        if (isMainOrBreakfastOrDinner) {
          if (_hasAny(food, EGY_VEGGIE_PRIORITY_1))      s += 25; // سلطة مشكلة أولا
          else if (_hasAny(food, EGY_VEGGIE_PRIORITY_2)) s += 18; // خيار
          else if (_hasAny(food, EGY_VEGGIE_PRIORITY_3)) s += 14; // فلفل
          else if (_hasAny(food, EGY_VEGGIE_PRIORITY_4)) s += 10; // كابوتشا/خس
          else if (_hasAny(food, EGY_VEGGIE_PRIORITY_5)) s += 2;  // طماطم — أقل أولوية
        }
      }

      // (3) الغداء/العشاء/بعد التمرين: تعزيز البروتين الحيواني الطبيعي كأولوية أولى
      if (slot === 'lunch' || slot === 'dinner' || slot === 'post') {
        if (_hasAny(food, EGY_WHOLE_CUT))            s += 20;  // فراخ صدور/أوراك، سمك، لحمة قطعية = الاختيار الأول
        else if (_hasAny(food, EGY_HOMEMADE_MINCED)) s += 12;  // كفتة/كباب بيتي = أولوية عالية كمان
        else if (_hasAny(food, EGY_PROCESSED_MEAT))  s += 1;   // مصنع صناعي (لانشون/سجق) = أقل أولوية
      }

      // (4) [بند 1] زيت زيتون/زبدة: يدخلان فقط عند وجود محفز دهن (سلطة/فول/جبنة) ولا يضافان تلقائياً
      if (_isFatAddition(food) && _slotIsMain(slot)) {
        var mealIds = items.map(function(f){ return _txt(f); }).join(' ');
        var isOliveOil = _hasAny(food, ['olive_oil','زيت زيتون','zayt','zyt']);
        var isButter   = _hasAny(food, ['butter','زبدة','زبده','zbda']);
        var hasTrigger = false;
        if (isOliveOil) {
          hasTrigger = FAT_ADDITION_OLIVE_OIL_TRIGGERS.some(function(t){ return mealIds.indexOf(_norm(t)) !== -1; });
        } else if (isButter) {
          hasTrigger = FAT_ADDITION_BUTTER_TRIGGERS.some(function(t){ return mealIds.indexOf(_norm(t)) !== -1; });
        }
        // لو مافيش محفز مناسب: خفض الأولوية بشدة (موش حظر كامل لو اختاره المستخدم)
        if (!hasTrigger && !picked) s -= 500;
        else if (hasTrigger && !picked) s -= 200; // موجود محفز لكن مش الاختيار الأول: فقط كآخر خيار
      }

      // (5) [EGY-CARB] أولوية الكرب المصري (عيش/رايس كيك/رز/بطاطس) في الفطار والغدا
      // يعمل كـ tiebreaker بين كرب وكرب بس — لا يمس قواعد الدايت السبعة ولا يتجاوز فلاتر keto/carnivore
      // الدايت كيتو/كارنيفور/lowcarb: الكرب محظور من المحرك — ما بيصلوش هنا اصلا
      if (food.cat === 'carb' && (slot === 'breakfast' || slot === 'lunch' || slot === 'dinner')) {
        var _dietOk = true;
        try { _dietOk = !(['keto','carnivore'].indexOf((context && context.diet) || '') !== -1); } catch(e){}
        if (_dietOk) {
          // كرب هيكلي مصري: عيش/خبز/توست/رايس كيك
          var _egyStructCarb = ['عيش','ays','خبز','khbz','توست','toast','رايس كيك','rayskyk','rice.cake','rayskyk','rais.kik'];
          // كرب غدا/عشاء مصري: رز/بطاطس
          var _egyLunchCarb  = ['رز','arz','ارز','أرز','rice','بطاطس','بطاطا','btats','btatah','potato'];
          var _isStructural = _hasAny(food, _egyStructCarb);
          var _isLunchCarb  = _hasAny(food, _egyLunchCarb);
          if (slot === 'breakfast') {
            // عيش/رايس كيك = أولوية عالية في الفطار
            if (_isStructural)                       s += 18;
            // كرب خضار في الفطار (قرع/باذنجان/خضار كمصدر كرب) = تخفيض طفيف
            else if (!_isLunchCarb && !_isStructural) s -= 8;
          } else if (slot === 'lunch') {
            // رز + عيش + بطاطس أولوية في الغدا
            if (_isStructural || _isLunchCarb)       s += 14;
            // كرب خضار خالص (ليس عيش ولا رز ولا بطاطس): تخفيض
            else s -= 6;
          } else if (slot === 'dinner') {
            // بطاطس/رز/عيش في العشاء تليها بشوية فقط
            if (_isLunchCarb || _isStructural)       s += 4;
          }
        }
      }

      // (4b) السناك هو البيت الطبيعي للترمس/السوداني/المكسرات — عززهم هناك بساطة
      if (slot === 'snack' && _isSnackOnly(food)) {
        s += 6;
      }
    } catch(e){}
    return s;
  };

  // ── أداة تقييم واقعية الوجبة (Egyptian Realism Score) — للوحة/الاختبارات ──
  function egyptianRealismScore(slot, foods){
    foods = _arr(foods);
    if (!foods.length) return 0;
    var items = foods.map(function(f){ return f && f.food ? f.food : f; });
    var isMain = _slotIsMain(slot) && slot !== 'pre';
    var hasProtein = items.some(function(f){ return f && (f.cat === 'protein' || f.cat === 'dairy'); });
    var snackCount = items.filter(function(f){ return _isSnackOnly(f); }).length;
    var score = 80;
    if (isMain && !hasProtein) score -= 35;
    if (slot === 'breakfast') {
      if (items.some(function(f){ return _hasAny(f, EGY_BREAKFAST_TOP) || _hasAny(f, EGY_BREAKFAST_CORE); })) score += 15;
      if (items.some(function(f){ return _isSnackOnly(f); })) score -= 30;
      if (items.some(function(f){ return f && f.cat === 'carb' && _hasAny(f, ['\u0627\u0631\u0632','\u0631\u0632','\u0645\u0643\u0631\u0648\u0646','\u0643\u0634\u0631\u064a']); })) score -= 25;
    }
    if (isMain && snackCount >= 2) score -= 20;
    return Math.max(0, Math.min(100, score));
  }

  try {
    window.EgyptianMealIntelligence = {
      version: 'egy-mil-1.1-egycarb',
      isSnackOnly: _isSnackOnly,
      realismScore: egyptianRealismScore,
      classify: function(food){
        return {
          id: food && food.id,
          snackOnly: _isSnackOnly(food),
          breakfastCore: (_hasAny(food, EGY_BREAKFAST_TOP) || _hasAny(food, EGY_BREAKFAST_CORE)),
          mainProtein: _hasAny(food, EGY_WHOLE_CUT)
        };
      }
    };
    if (typeof LOG === 'function') LOG('\u2714 [EGY-MIL] Egyptian Meal Intelligence Layer active — auto-completion now prefers natural Egyptian foods per meal');
  } catch(e){}
})();
