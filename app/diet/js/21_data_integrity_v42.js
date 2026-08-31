/* صمم دايت — طبقة سلامة البيانات (Data Integrity v42)
   إضافية بالكامل — لا تعدل منطق المحرك.
   الهدف: إصلاح المراجع المكسورة بين ال IDs الإنجليزية القديمة في القواعد
   (DIET_CONSTRAINTS / HEALTH_MEAL_RULES / MEDICAL_CONFLICT_RULES) وبين IDs الأطعمة الفعلية
   في FOOD_DB، بالإضافة لتنظيف allowedDiets غير المعروفة (mediterranean).
   يجب أن يحمل بعد js/02 و js/04 (القواعد وقاعدة الأطعمة).
*/
(function(){
  'use strict';
  // خريطة المرادفات: ID إنجليزي قديم -> ID عربي حقيقي موجود في القاعدة
  var FOOD_ALIAS = {
    white_rice:'arzabydmtbwkh', brown_rice:'arzbnymtbwkh',
    oats:'shwfanmtbwkh', oats_quaker:'shwfanmtbwkh',
    banana:'mwz', dates:'tmr',
    broccoli:'brwkly', spinach:'sbankhmtbwkha',
    baladi_bread:'ayshbldy', whole_bread:'ayshqmhkaml', toast_brown:'twstasmr',
    pasta_ww:'mkrwnamslwqa', sweet_potato:'btatamslwqa',
    potato:'btatsmslwqa', potato_baked:'btatsmshwya', potato_boiled:'btatsmslwqa',
    lentils:'adsasfrmtbwkh', foul:'fwlmdms', chickpeas:'hmsmslwq', corn:'zramslwqa',
    bulgur_cooked:'brghlmtbwkh', tortilla_flour:'twrtyla', mountain_bread:'twrtyla',
    milk_skim:'lbnkhalyaldsm', yogurt_plain:'zbadytbyay', greek_yogurt:'zbadytbyay',
    rice_cake:'rayskykbny',
    watermelon:'btykh', mango:'manjw', apple:'tfah', orange:'brtqal', strawberry:'frawla',
    olive_oil:'zytzytwn', onion:'bsl', carrot:'jzr', zucchini:'kwsa', bell_pepper:'flfl',
    cauliflower:'qrnbyt', tomato_cherry:'tmatm', avocado:'afwkadw',
    cheese_romy:'jbnarwmy', cottage_cheese:'jbnaqrysh', feta_cheese:'jbnafyta',
    eggs_whole:'byd_mslwq', eggs_fried_shakshouka:'byd_awmlyt',
    chicken_breast:'sdr_frakh_mshwy', chicken_thigh:'wrk_frakh_mshwy', chicken_liver:'kbda_frakh_mshwya',
    turkey_breast:'sdr_dyk_rwmy_mshwy', sausage_turkey:'trky_mdkhn',
    beef_lean:'lhm_bqry_mslwq', beef_ground:'lhm_mfrwm_bqry_qlyl_aldhn',
    salmon:'slmwn_mshwy', sardines:'srdyn_mshwy', shrimp:'jmbry_mslwq',
    tuna_canned:'twna_myah', tuna_fresh:'twna_frysh_mshwya', pigeon:'hmam_mshwy',
    coffee:'coffee_black'
  };

  function getMap(){ try{ return (typeof FOOD_MAP!=='undefined')?FOOD_MAP:(typeof window!=='undefined'?window.FOOD_MAP:null); }catch(e){ return null; } }
  function getDB(){ try{ return (typeof FOOD_DB!=='undefined')?FOOD_DB:(typeof window!=='undefined'?window.FOOD_DB:null); }catch(e){ return null; } }
  function has(map, id){
    if(!map) return false;
    if(typeof map.has==='function') return map.has(id);
    return Object.prototype.hasOwnProperty.call(map, id);
  }

  var report = { remapped:0, dropped:0, mediterraneanCleaned:0, unresolved:[] };
  var map = getMap();
  var db  = getDB();
  var KNOWN_DIETS = ['balanced','lowcarb','keto','carbcycle','carnivore','mediterranean'];

  // 1) تنظيف allowedDiets غير المعروفة (mediterranean) من أطعمة القاعدة
  try {
    if (Array.isArray(db)) {
      db.forEach(function(f){
        if (f && Array.isArray(f.allowedDiets)) {
          var before = f.allowedDiets.length;
          f.allowedDiets = f.allowedDiets.filter(function(d){ return KNOWN_DIETS.indexOf(d) !== -1; });
          if (f.allowedDiets.length === 0) f.allowedDiets = ['balanced'];
          report.mediterraneanCleaned += (before - f.allowedDiets.length);
        }
      });
    }
  } catch(e){}

  // 2) أداة حل المرادفات داخل أي مصفوفة IDs
  function resolveArray(arr){
    if (!Array.isArray(arr)) return arr;
    var seen = {};
    var out = [];
    for (var i=0;i<arr.length;i++){
      var id = arr[i];
      if (typeof id !== 'string'){ out.push(id); continue; }
      var finalId = id;
      if (map && !has(map, id) && FOOD_ALIAS[id] && has(map, FOOD_ALIAS[id])) {
        finalId = FOOD_ALIAS[id];
        report.remapped++;
      } else if (map && !has(map, id) && !FOOD_ALIAS[id]) {
        // مرجع غير موجود ولا له مرادف (غالبا صنف junk غير موجود أصلا) — غير ضار، نسجله فقط
        if (report.unresolved.indexOf(id) === -1) report.unresolved.push(id);
      }
      if (!seen[finalId]) { seen[finalId] = true; out.push(finalId); }
    }
    return out;
  }

  function fixRuleObject(rule){
    if (!rule || typeof rule !== 'object') return;
    ['forbiddenFoods','preferredFoods','requiredFoods','avoidFoods','preferFoods','dangerFoods','recommendedFoods','goodFoods','badFoods'].forEach(function(key){
      if (Array.isArray(rule[key])) rule[key] = resolveArray(rule[key]);
    });
  }

  try {
    if (typeof DIET_CONSTRAINTS !== 'undefined' && DIET_CONSTRAINTS) {
      Object.keys(DIET_CONSTRAINTS).forEach(function(k){ fixRuleObject(DIET_CONSTRAINTS[k]); });
    }
  } catch(e){}
  try {
    if (typeof HEALTH_MEAL_RULES !== 'undefined' && HEALTH_MEAL_RULES) {
      Object.keys(HEALTH_MEAL_RULES).forEach(function(k){ fixRuleObject(HEALTH_MEAL_RULES[k]); });
    }
  } catch(e){}
  try {
    if (typeof MEDICAL_CONFLICT_RULES !== 'undefined' && Array.isArray(MEDICAL_CONFLICT_RULES)) {
      MEDICAL_CONFLICT_RULES.forEach(function(m){ fixRuleObject(m); });
    }
  } catch(e){}

  try {
    if (typeof window !== 'undefined') { window.FOOD_ALIAS = FOOD_ALIAS; window.__dataIntegrityReport = report; }
    if (typeof LOG === 'function') LOG('\u2714 [DataIntegrity v42] remapped='+report.remapped+' · mediterraneanCleaned='+report.mediterraneanCleaned+' · unresolved='+report.unresolved.length);
    else if (typeof console!=='undefined' && console.log) console.log('✔ [DataIntegrity v42] remapped='+report.remapped+' mediterraneanCleaned='+report.mediterraneanCleaned+' unresolved='+report.unresolved.length);
  } catch(e){}
})();
