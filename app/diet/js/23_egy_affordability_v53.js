// ═══════════════════════════════════════════════════════════════
//  PHASE v53 — EGYPTIAN AFFORDABILITY & COMMONNESS FILTER
//  خبير تغذية مصري + مبرمج سنيور
//  الهدف: الخطة التلقائية تطلع لأي مصري مهما كان وضعه الاجتماعي —
//  بلا أصناف غالية (جمبري/سلمون/انشوجة/رنجة/لوز/كاجو/عين جمل/أفوكادو)
//  ولا أصناف رخيصة لكن غير متداولة (رومي/أرانب/شوفان/بروكلي/فطر).
//  السياسة: استبعاد من التوليد التلقائي فقط — ويظهر الصنف لو المستخدم اختاره بنفسه.
//  التونة: مسموحة لكن "بعقل" (مش قوام أساسي يومي).
// ═══════════════════════════════════════════════════════════════
(function EgyptianAffordabilityLayer(){
  function _arr(x){ return Array.isArray(x) ? x : []; }
  function _name(f){ return String((f && (f.nameAr || f.nameEn || f.id)) || ''); }
  function _cat(f){ return String((f && (f.cat || f.category)) || ''); }

  // أصناف رخيصة وشائعة نحافظ عليها حتى لو الاسم فيه كلمة تشبه المستبعد (فول سوداني/لب/طحينة/سمسم)
  function _isCheapCommonFatSeed(nm){
    return /فول سوداني|سوداني|طحينة|سمسم|لب |لب أبيض|لب سوري|لب قرع|لب سوبر|سمسمية/.test(nm);
  }

  // هل الصنف مستبعد (غالي أو غير متداول)؟
  function excluded(f){
    if(!f) return false;
    var nm=_name(f), c=_cat(f);
    if(/أفوكادو|افوكادو/.test(nm)) return true;                 // غالي/نادر
    if(/شوفان/.test(nm)) return true;                           // غير متداول (طلب المستخدم)
    if((c==='fat'||c==='snack') && /لوز|كاجو|جوز|عين جمل|بندق|فستق|بيكان|مكاديميا|مكسرات/.test(nm) && !_isCheapCommonFatSeed(nm)) return true; // مكسرات غالية
    if(c==='dairy' && /حليب لوز|حليب كاجو|حليب شوفان/.test(nm)) return true; // ألبان مكسرات نادرة
    if(c==='protein' && /جمبري|سبيط|كاليماري|كابوريا|سلمون|رنجة|أنشوجة|فسيخ|استاكوزا|جندوفل|بلح البحر/.test(nm)) return true; // بحري غالي/نادر
    if(c==='protein' && /رومي|تركي|حمام|سمان|أرنب|طحال|مخ|كلاوي|كرشة|كوارع|عكاوي|جمل|لحمة راس|طرب/.test(nm)) return true; // بروتين غير متداول
    if(c==='protein' && /لانشون|سجق|سوسيس|بانيه|بانية|برجر|ناجتس|بسطرمة|بسطرمه|هوت دوج|هوتدوج|شاورما/.test(nm)) return true; // [EGY] مصنع صناعي — ممنوع في التوليد التلقائي وأي دايت (طلب المستخدم)
    if(c==='veggie' && /بروكلي|فطر|كابوتشا|كينوا|كيل/.test(nm)) return true; // خضار غير متداول
    return false;
  }

  // التونة: مسموحة لكن غير أساسية يوميا
  function occasional(f){ return !!f && /تونة/.test(_name(f)); }

  // هل المستخدم اختار الصنف بنفسه؟ (لو أيوه نحترم اختياره)
  function userSelected(f){
    try{ return typeof DE!=='undefined' && _arr(DE.availableFoods).indexOf(f.id)!==-1; }catch(e){ return false; }
  }

  // يستبعد من التوليد التلقائي فقط
  function autoBlocked(f){ return excluded(f) && !userSelected(f); }

  function _commonish(f){
    var nm=_name(f);
    return /بيض|جبن|قريش|فول|طعمية|عيش|خبز|توست|أرز|رز|بسمتي|فراخ|صدر|ورك|بط|بلطي|بلاميط|ماكريل|بوري|سردين|سمك موسى|سمك بياض|بطاطس|بطاطا|كبد|لحم|كفت|كباب|زبادي|لبن|سلطة|طماطم|خيار|جرجير|خس|مكرون|عدس|فاصوليا|لوبيا|بامية|كوسة|ملوخية|بسلة|جزر|حمص|موز|تمر|تفاح|برتقال|بلح|فشار|ترمس|سوداني/.test(nm);
  }
  function _score(f){ return (f.healthyScore||5) + (_commonish(f)?6:0) - (f.processedLevel==='high'?5:0) - (f.processedLevel==='medium'?2:0) - (occasional(f)?8:0); }

  // أفضل بديل شائع/رخيص من نفس الفئة والوجبة
  function bestSub(origFood, slotKey, diet){
    if(typeof FOOD_DB==='undefined') return null;
    var cands=FOOD_DB.filter(function(f){
      if(_cat(f)!==_cat(origFood)) return false;
      if(f.id===origFood.id) return false;
      if(excluded(f)) return false;
      if(occasional(f)) return false;
      if(Array.isArray(f.mealTypes)&&f.mealTypes.length&&slotKey&&f.mealTypes.indexOf(slotKey)===-1) return false;
      if(Array.isArray(f.allowedDiets)&&f.allowedDiets.length&&diet&&f.allowedDiets.indexOf(diet)===-1) return false;
      if(typeof isFoodAllowed==='function'){ var c=isFoodAllowed(f); if(c&&c.ok===false) return false; }
      return true;
    });
    if(!cands.length) return null;
    cands.sort(function(a,b){ return _score(b)-_score(a); });
    return cands[0];
  }

  function _mkItem(food, cals){
    var per=food.cal||0;
    var g = per>0 ? Math.max(10, Math.round((cals/per*100)/5)*5) : 100;
    var cap = (food.cat==='fat')?35:(food.cat==='fruit'||food.cat==='veggie')?200:(food.cat==='dairy')?250:350;
    g=Math.min(g,cap);
    return { food:food, grams:g, cals:Math.round(per*g/100),
      pro:+(((food.pro||0)*g/100)).toFixed(1), carb:+(((food.carb||0)*g/100)).toFixed(1), fat:+(((food.fat||0)*g/100)).toFixed(1), _egySwapped:true };
  }
  function _recalc(items){
    var t={cals:0,pro:0,carb:0,fat:0};
    items.forEach(function(p){ t.cals+=p.cals||0; t.pro+=p.pro||0; t.carb+=p.carb||0; t.fat+=p.fat||0; });
    return { cals:Math.round(t.cals), pro:+t.pro.toFixed(1), carb:+t.carb.toFixed(1), fat:+t.fat.toFixed(1) };
  }

  // شبكة الأمان: تنظيف الخطة النهائية مهما كانت الطبقة اللي بنتها
  // مطبع خفيف لدمج الأصناف المكررة
  function _norm23(x){ return String(x||'').replace(/[\u064B-\u0652\u0670\u0640]/g,'').replace(/[\u0623\u0625\u0622]/g,'\u0627').replace(/[\u0629\u0647]/g,'\u0647').replace(/\s+/g,' ').trim().toLowerCase(); }
  // دمج أي صنف مكرر داخل نفس الوجبة (مثل الأرز مرتين) في صنف واحد
  function _mergeDupes(foods){
    if(!Array.isArray(foods)) return foods;
    var idx={}, out=[];
    for(var i=0;i<foods.length;i++){
      var p=foods[i];
      if(!p || !p.food){ out.push(p); continue; }
      var key=_norm23(p.food.nameAr || p.food.nameEn || p.food.id || '');
      if(key && idx[key]!=null){
        var e=out[idx[key]];
        e.grams=Math.round((e.grams||0)+(p.grams||0));
        e.cals=Math.round((e.cals||0)+(p.cals||0));
        e.pro=+(((e.pro||0)+(p.pro||0)).toFixed(1));
        e.carb=+(((e.carb||0)+(p.carb||0)).toFixed(1));
        e.fat=+(((e.fat||0)+(p.fat||0)).toFixed(1));
      } else { idx[key]=out.length; out.push(p); }
    }
    return out;
  }

  function sanitizePlan(plan){
    if(!plan || !Array.isArray(plan.meals)) return plan;
    var swaps=[];
    var diet=(typeof DE!=='undefined'&&DE.selectedDiet)||'balanced';
    plan.meals.forEach(function(meal){
      if(!Array.isArray(meal.foods)) return;
      var changed=false;
      var out=[];
      for(var i=0;i<meal.foods.length;i++){
        var p=meal.foods[i];
        if(p && p.food && autoBlocked(p.food)){
          var sub=bestSub(p.food, meal.slotKey, diet);
          if(sub){ out.push(_mkItem(sub, p.cals||0)); swaps.push(_name(p.food)+' - '+_name(sub)); }
          else { swaps.push(_name(p.food)+' - (حذف)'); }
          changed=true;
        } else { out.push(p); }
      }
      var _mf=_mergeDupes(out); if(_mf.length!==out.length){ changed=true; out=_mf; }
      if(changed){ meal.foods=out; var nt=_recalc(out); if(meal.totals){ meal.totals.cals=nt.cals; meal.totals.pro=nt.pro; meal.totals.carb=nt.carb; meal.totals.fat=nt.fat; } else meal.totals=nt; }
    });
    if(swaps.length){
      var all=[]; plan.meals.forEach(function(m){ if(Array.isArray(m.foods)) all=all.concat(m.foods); });
      var pt=_recalc(all); if(plan.totals){ plan.totals.cals=pt.cals; plan.totals.pro=pt.pro; plan.totals.carb=pt.carb; plan.totals.fat=pt.fat; } else plan.totals=pt;
    }
    plan._egySwaps=swaps;
    return plan;
  }

  var API={ excluded:excluded, occasional:occasional, userSelected:userSelected, autoBlocked:autoBlocked, bestSub:bestSub, sanitizePlan:sanitizePlan };
  if(typeof window!=='undefined') window.EGY_AFFORD=API;
  try{ EGY_AFFORD=API; }catch(e){}
  try{ globalThis.EGY_AFFORD=API; }catch(e){}

  // لف الباني النهائي (الطبقة الخارجية) لتطبيق التنظيف على أي مسار
  function _wrap(fn){
    if(!fn || fn.__egyAfford) return fn;
    var w=function(){ var plan=fn.apply(this, arguments); try{ return sanitizePlan(plan); }catch(e){ return plan; } };
    w.__egyAfford=true; return w;
  }
  var base=(typeof window!=='undefined' && typeof window.buildSmartMealPlan==='function') ? window.buildSmartMealPlan
           : (typeof buildSmartMealPlan==='function' ? buildSmartMealPlan : null);
  if(base){ var wrapped=_wrap(base); if(typeof window!=='undefined') window.buildSmartMealPlan=wrapped; try{ buildSmartMealPlan=wrapped; }catch(e){} }

  if(typeof LOG==='function') LOG('Phase v53 — Egyptian affordability/commonness filter active');
})();
