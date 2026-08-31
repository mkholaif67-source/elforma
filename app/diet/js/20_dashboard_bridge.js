// Smart-coaching gate — user can disable from account page (EF_smart_coaching)
(function(){
  var _sc; try { _sc = localStorage.getItem('EF_smart_coaching'); } catch(_) {}
  if (_sc !== null && _sc !== undefined) {
    try { if (!JSON.parse(_sc)) {
      window._EF_AI_DISABLED = true;
      console.info('[Diet] Smart coaching disabled by user');
    } } catch(_) {}
  }
})();

/* صمم دايت — Dashboard Bridge (جسر الداشبورد)
   يحفظ الخطة الغذائية المولدة + بيانات المستخدم في localStorage حتى تتمكن
   صفحة الداشبورد المستقلة (dashboard.html) من قراءتها ومتابعتها وتطويرها —
   تماما مثل جسر forma_plan في مشروع ElForma. لا يلمس منطق المحرك إطلاقا.
*/
(function(){
'use strict';
if (typeof window === 'undefined') return;
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function load(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function num(id){var el=document.getElementById(id);return el?(parseFloat(el.value)||0):0;}
function g(name){try{
  if(name==='FOOD_MAP') return (typeof FOOD_MAP!=='undefined')?FOOD_MAP:(typeof window!=='undefined'?window.FOOD_MAP:undefined);
  if(name==='FOOD_DB') return (typeof FOOD_DB!=='undefined')?FOOD_DB:(typeof window!=='undefined'?window.FOOD_DB:undefined);
  if(name==='DE') return (typeof DE!=='undefined')?DE:(typeof window!=='undefined'?window.DE:undefined);
  return (typeof window!=='undefined')?window[name]:undefined;
}catch(e){return undefined;}}

function snapshotProfile(){
  var DEref = (typeof DE!=='undefined')?DE:{};
  var bmr=null,tdee=null,target=null,macros=null;
  try{bmr=(typeof calcBMR==='function')?calcBMR():null;}catch(e){}
  try{tdee=(typeof calcTDEE==='function')?calcTDEE():null;}catch(e){}
  try{target=(typeof calcTargetCals==='function')?calcTargetCals():null;}catch(e){}
  try{macros=(typeof calcMacros==='function')?calcMacros(target,(DEref&&DEref.selectedDiet)||'balanced'):null;}catch(e){}
  var weeklyRate=num('inp-weekly-rate')||(DEref&&DEref.expectedWeeklyLoss)||0.5;
  return {
    name: load('diet_name', (DEref&&DEref.name)||''),
    gender: DEref&&DEref.gender, age:DEref&&DEref.age, height:DEref&&DEref.height,
    weight: DEref&&DEref.weight, target: DEref&&DEref.target,
    activity: DEref&&DEref.activity, goal:(DEref&&DEref.goal)||'cut',
    gainStyle:(DEref&&DEref.gainStyle)||null,
    diet:(DEref&&DEref.selectedDiet)||'balanced',
    mealCount:(DEref&&DEref.mealCount)||3, snacks:!!(DEref&&DEref.snacks),
    health:(DEref&&DEref.healthConditions)||[], problems:(DEref&&DEref.dietProblems)||[],
    trainDays:num('inp-train-days'), workoutType:(DEref&&DEref.workoutType)||null,
    preTiming:(DEref&&DEref.preTiming)||load('diet_pre_timing','light'),
    workoutTime:(DEref&&DEref.workoutTime)||load('diet_wo_time',null),
    weeklyRate:weeklyRate, sleepHours:(DEref&&DEref.sleepHours)||num('inp-sleep')||7,
    bmr:bmr, tdee:tdee, targetCals:target,
    proteinTarget: macros?macros.protein:null,
    currentWeek:(DEref&&DEref.currentWeek)||1
  };
}

/* ── بناء وجبات الخطة من اختيارات المستخدم نفسه (diet_user_meals) ──
   عشان الخطة تطلع من اللي اخترته بالظبط في كل وجبة، مش من مزاج المحرك.
   كل عنصر اخترته بيتحط، والكميات بتتوزع على سعرات الوجبة بشكل منطقي حسب نوع الطعام. */
function slotLabel(k){var M={breakfast:'\uD83C\uDF05 \u0627\u0644\u0641\u0637\u0627\u0631',lunch:'\uD83C\uDF7D\uFE0F \u0627\u0644\u063A\u062F\u0627\u0621',dinner:'\uD83C\uDF19 \u0627\u0644\u0639\u0634\u0627\u0621',snack:'\uD83C\uDF4E \u0633\u0646\u0627\u0643',snack2:'\u26A1 \u0633\u0646\u0627\u0643 \u0645\u0633\u0627\u0626\u064A',pre:'\u26A1 \u0642\u0628\u0644 \u0627\u0644\u062A\u0645\u0631\u064A\u0646',post:'\uD83D\uDCAA \u0628\u0639\u062F \u0627\u0644\u062A\u0645\u0631\u064A\u0646'};return M[k]||k;}
function buildMealsFromSelections(plan){
  var sel; try{sel=load('diet_user_meals',null);}catch(e){sel=null;}
  if(!sel||typeof sel!=='object') return null;
  var FM=g('FOOD_MAP'); if(!FM||typeof FM.get!=='function') return null;
  var slots=[];
  // مصدر الحقيقة = الوجبات اللي اختارها المستخدم في المعالج (sel) فقط — مش اتحاد مع وجبات المحرك
  var engineByKey={};
  if(plan&&plan.meals&&plan.meals.length){
    plan.meals.forEach(function(m){var k=m.slotKey||m.label;engineByKey[k]=m;});
  }
  var ORDER={breakfast:0,pre:1,snack:2,lunch:3,post:4,snack2:5,dinner:6};
  var CUSTOM=null; try{var _co=load('diet_slot_order',null); if(_co&&_co.length){CUSTOM={}; _co.forEach(function(k,i){CUSTOM[k]=i;});}}catch(e){CUSTOM=null;}
  Object.keys(sel).forEach(function(k){
    var m=engineByKey[k]||null;
    slots.push({key:k,label:(m&&m.label)||slotLabel(k),budget:m?(m.targetCals||(m.totals&&m.totals.cals)||0):0,engine:m});
  });
  slots.sort(function(a,b){if(CUSTOM){var ca=(CUSTOM[a.key]==null?99:CUSTOM[a.key]),cb=(CUSTOM[b.key]==null?99:CUSTOM[b.key]);return ca-cb;}var oa=(ORDER[a.key]==null?99:ORDER[a.key]),ob=(ORDER[b.key]==null?99:ORDER[b.key]);return oa-ob;});
  var totalBudget=slots.reduce(function(a,s){return a+(s.budget||0);},0);
  var dayCals=(plan&&plan.targetCals)||totalBudget||1800;
  var hasAnySel=Object.keys(sel).some(function(k){return (sel[k]||[]).length;});
  if(!hasAnySel) return null;
  // حصص واقعية لكل نوع طعام (تكوين وجبة آدمية مش تقسيم سعرات أعمى)
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function r1(x){return Math.round(x*10)/10;}
  function servingFor(f){
    var n=(f.nameAr||f.nameEn||'')+'';var c=f.cat||'';
    if(/بيض/.test(n)) return {base:100,step:50,min:50,max:150};
    if(/جبن|قريش/.test(n)) return {base:40,step:10,min:20,max:90};
    if(/توست|خبز|عيش|رغيف|بقسماط/.test(n)) return {base:60,step:30,min:30,max:120};
    if(/فول/.test(n)) return {base:180,step:30,min:120,max:260};
    if(/زبادي|لبن|حليب|روب/.test(n)) return {base:170,step:30,min:100,max:250};
    if(/زيت|سمن/.test(n)) return {base:10,step:5,min:5,max:20};
    if(/مكسرات|لوز|عين جمل|فستق|كاجو|سوداني/.test(n)) return {base:25,step:5,min:10,max:45};
    if(/عسل|مربى|طحينة|حلاوة/.test(n)) return {base:20,step:5,min:10,max:40};
    switch(c){
      case 'protein': return {base:130,step:20,min:70,max:230};
      case 'carb': return {base:90,step:20,min:40,max:230};
      case 'dairy': return {base:160,step:30,min:100,max:250};
      case 'fruit': return {base:130,step:20,min:80,max:230};
      case 'fat': return {base:15,step:5,min:5,max:30};
      case 'snack': return {base:35,step:10,min:15,max:70};
      case 'veggie': return {base:80,step:20,min:40,max:160};
      default: return {base:100,step:20,min:40,max:220};
    }
  }
  function roundServe(g,sv){g=Math.round(g/sv.step)*sv.step;return clamp(g,sv.min,sv.max);}
  function calsOf(f,g){return (f.cal||0)*g/100;}
  function macroFood(f,g){var sc=g/100;return {id:f.id,name:f.nameAr||f.nameEn||f.id,grams:Math.round(g),cals:Math.round((f.cal||0)*sc),pro:r1((f.pro||0)*sc),carb:r1((f.carb||0)*sc),fat:r1((f.fat||0)*sc),cat:f.cat||''};}
  // ── إكمال الوجبة كطبيب تغذية: لو المستخدم نسي أساسيات الوجبة المنطقية نكملها بهدوء ──
  function hasCat(arr,c){return arr.some(function(f){return (f.cat||'')===c;});}
  function nameHas(arr,re){return arr.some(function(f){return re.test(((f.name||'')+' '+(f.sub||'')));});}
  function addF(arr,id,grams){var f=FM.get(id);if(!f)return;arr.push(macroFood(f,grams));}
  function autoComplete(slot,arr,budget){
    var DEref=g('DE')||{};var diet=DEref.selectedDiet||'balanced';
    var keto=(diet==='keto'||diet==='carnivore');
    var cals=arr.reduce(function(a,f){return a+(f.cals||0);},0);
    var room=budget-cals;var isMain=(slot==='lunch'||slot==='dinner');
    // ١) الفطار لازم مصدر بروتين (جبنة/بيض/زبادي) — أساس الفطار المصري
    if(slot==='breakfast'&&!hasCat(arr,'protein')&&!hasCat(arr,'dairy')&&room>80){addF(arr,'jbnaqrysh',60);room-=59;}
    // ٢) الغدا/العشا لازم خضار أو سلطة تكمل الوجبة
    if(isMain&&!hasCat(arr,'veggie')&&!keto&&room>40){
      var k=FM.get('khyar'),t=FM.get('tmatm');
      if(k&&t){var rr=70/100;arr.push({id:'__salad__',ids:['khyar','tmatm'],name:'سلطة خضراء',sub:'خيار + طماطم',grams:140,cals:Math.round((k.cal*rr)+(t.cal*rr)),pro:r1((k.pro*rr)+(t.pro*rr)),carb:r1((k.carb*rr)+(t.carb*rr)),fat:r1((k.fat*rr)+(t.fat*rr)),cat:'veggie'});room-=24;}
    }
    // ٣) دهون منطقية بالصنف المناسب — بنفكر ونوازن، مش بنحط طحينة بصمجة
    if(isMain&&hasCat(arr,'protein')){
      var curFat=arr.reduce(function(a,f){return a+(f.fat||0);},0);
      // زيت الطبخ المتوقع في الفراخ/اللحمة/التونة مش محسوب — نقدره عشان ما نتخمش الوجبة
      var hid=0;arr.forEach(function(f){var n=(f.name||'')+'';
        if(/مقلي|بانيه|باني|قلي|محمر/.test(n))hid+=8;
        else if(/مشوي|كفتة|كباب|شاورما|ريش|سمك|سلمون|سردين/.test(n))hid+=4;
        else if(/فراخ|دجاج|لحم|بفتيك|تونة|تونه/.test(n))hid+=3;});
      var grilled=nameHas(arr,/مشوي|كفتة|كباب|شاورما|ريش|سمك|سلمون|سردين/);
      var hasVeg=hasCat(arr,'veggie');
      var rotB=((new Date()).getDate()+(slot==='dinner'?1:0))%2;
      // لو الدهون (مع زيت الطبخ) كفاية - ما نضيفش حاجة، تحسبا إن البروتين فيه زيت
      // [EGY] الزيت للطبخ مش عنصر يتشرب - دهون كاملة بس (طحينة/زبدة)، والزيت للكيتو فقط
      if((curFat+hid)<(budget*0.22/9)&&room>60){
        if(diet==='carnivore')addF(arr,'zbda',15);
        else if(grilled)addF(arr,'thyna',keto?18:11);            // طحينة جنب المشوي (مصري أصيل)
        else if(keto)addF(arr,'zytzytwn',12);                    // الكيتو محتاج دهون
        // غير كده: الزيت محسوب ضمن الطبخ، مش صف منفصل يتاكل
      }
    }
    // ٤) العشا لو فاكهة بس - نضيف زبادي للبروتين والإحساس بالشبع (عشا متوازن)
    if(slot==='dinner'&&hasCat(arr,'fruit')&&!hasCat(arr,'protein')&&!hasCat(arr,'dairy')&&room>60){addF(arr,'zbadytbyay',170);}
    // ٥) قبل التمرين: لو الوجبة قهوة بس (مفيش كارب/فاكهة) - كارب سريع للطاقة عشان الوجبة ما تبقاش فاضية
    if(slot==='pre'&&!hasCat(arr,'carb')&&!hasCat(arr,'fruit')&&room>60){addF(arr,'mwz',130);room-=116;if(room>180){addF(arr,'tmr',15);}}
  }
  var out=[];
  slots.forEach(function(s){
    var ids=(sel[s.key]||[]).filter(function(id){return FM.get(id);});
    if(!ids.length){ if(s.engine) out.push(s.engine); return; }
    var budget=s.budget|| Math.round(dayCals/slots.length);
    var foods=ids.map(function(id){return FM.get(id);});
    var veg=foods.filter(function(f){return f.cat==='veggie';});
    var asSalad=veg.length>=2; // ٢ خضار أو أكتر = سلطة واحدة
    var saladBase=0,saladPortions=[];
    if(asSalad){ veg.forEach(function(f){var sv=servingFor(f);saladPortions.push({f:f,g:sv.base});saladBase+=calsOf(f,sv.base);}); }
    var indiv=asSalad?foods.filter(function(f){return f.cat!=='veggie';}):foods;
    // تنظيف علمي عام - بالفئة لا بالاسم - يشتغل مع أي عنصر وأي دايت
    var _isSnack=(s.key==='snack'||s.key==='snack2');var _isPre=(s.key==='pre');var _isPost=(s.key==='post');
    var _catLim={protein:1,dairy:1,carb:_isPost?2:1,fat:1,fruit:_isSnack?2:1,snack:_isPre?2:1,veggie:99};
    var _counts={};
    indiv=indiv.filter(function(f){
      var c=f.cat||f.c||'';
      var lim=_catLim[c];
      if(lim==null)return true;
      _counts[c]=(_counts[c]||0)+1;
      return _counts[c]<=lim;
    });
    var _slotMax={breakfast:4,lunch:5,dinner:5,snack:3,snack2:3,pre:3,post:3}[s.key]||5;
    if(indiv.length>_slotMax)indiv=indiv.slice(0,_slotMax);
    var items=indiv.map(function(f){var sv=servingFor(f);return {f:f,sv:sv,g:sv.base};});
    var baseCals=items.reduce(function(a,it){return a+calsOf(it.f,it.g);},0);
    // نظبط الكميات لتقترب من سعرات الوجبة مع احترام الحصص الواقعية
    var target=Math.max(120,budget-saladBase);
    var ratio=baseCals>0?target/baseCals:1; ratio=clamp(ratio,0.55,1.7);
    items.forEach(function(it){ it.g=roundServe(it.sv.base*ratio,it.sv); });
    // ترتيب منطقي: بروتين ثم نشويات ثم الباقي، والسلطة تحت
    var order={protein:0,carb:1,dairy:2,fruit:3,fat:4,snack:5};
    items.sort(function(a,b){return (order[a.f.cat]==null?9:order[a.f.cat])-(order[b.f.cat]==null?9:order[b.f.cat]);});
    var mfoods=items.map(function(it){return macroFood(it.f,it.g);});
    if(asSalad){
      var sg=0,sc=0,sp=0,scb=0,sf=0,names=[],vids=[];
      saladPortions.forEach(function(p){var r=p.g/100;sg+=p.g;sc+=(p.f.cal||0)*r;sp+=(p.f.pro||0)*r;scb+=(p.f.carb||0)*r;sf+=(p.f.fat||0)*r;names.push(p.f.nameAr||p.f.nameEn||p.f.id);vids.push(p.f.id);});
      mfoods.push({id:'__salad__',ids:vids,name:'سلطة خضراء',sub:names.join(' + '),grams:Math.round(sg),cals:Math.round(sc),pro:r1(sp),carb:r1(scb),fat:r1(sf),cat:'veggie'});
    }
    autoComplete(s.key,mfoods,budget);
    var tot=mfoods.reduce(function(a,f){a.cals+=f.cals;a.pro+=f.pro;a.carb+=f.carb;a.fat+=f.fat;return a;},{cals:0,pro:0,carb:0,fat:0});
    out.push({slotKey:s.key,label:s.label,targetCals:Math.round(tot.cals),
      totals:{cals:Math.round(tot.cals),pro:r1(tot.pro),carb:r1(tot.carb),fat:r1(tot.fat)},foods:mfoods});
  });
  return out.length?out:null;
}

function planSig(plan,prof){
  return [prof.goal,prof.diet,prof.weight,prof.target,plan.targetCals,prof.mealCount,(prof.health||[]).join('-')].join('|');
}

function persistPlan(){
  var plan=window.__lastNutritionPlan;
  if(!plan||!plan.meals||!plan.meals.length) return;
  var prof=snapshotProfile();
  var data={
    version:plan.version, created:Date.now(),
    goal:prof.goal, diet:prof.diet,
    targetCals:plan.targetCals, targetMacros:plan.targetMacros,
    totals:plan.totals, meals:plan.meals, warnings:plan.warnings||[],
    weeklyMeta:plan.weeklyMeta||null, profile:prof
  };
  try{var userMeals=buildMealsFromSelections(plan);if(userMeals&&userMeals.length){data.meals=userMeals;data.fromSelections=true;}}catch(e){}
  var sig=planSig(plan,prof);
  var oldSig=load('diet_plan_sig',null);
  var old=load('diet_plan',null);
  if(old&&oldSig===sig&&old.created){data.created=old.created;}
  save('diet_plan',data);
  save('diet_profile',prof);
  save('diet_plan_sig',sig);
  if(oldSig!==sig){
    localStorage.removeItem('diet_log');
    localStorage.removeItem('diet_coach');
    localStorage.removeItem('diet_water');
    localStorage.removeItem('diet_week');
    localStorage.removeItem('diet_target');
    localStorage.removeItem('diet_intake');
    var d0=new Date().toISOString().slice(0,10);
    if(prof.weight){save('diet_weights',[{date:d0,week:1,weight:prof.weight}]);}
    else{localStorage.removeItem('diet_weights');}
  }
  injectDashLink();
}

function injectDashLink(){
  if(document.getElementById('dashLinkBtn')) return;
  var a=document.createElement('a');
  a.id='dashLinkBtn'; a.href='dashboard.html';
  a.innerHTML='\u0627\u0641\u062A\u062D \u0627\u0644\u062F\u0627\u0634\u0628\u0648\u0631\u062F';
  a.title='\u0645\u062A\u0627\u0628\u0639\u0629 \u0648\u062A\u0637\u0648\u064A\u0631 \u062E\u0637\u062A\u0643';
  a.style.cssText='position:fixed;left:16px;bottom:16px;z-index:9999;background:linear-gradient(120deg,#2f9e6b,#54c98c);color:#fff;padding:13px 20px;border-radius:14px;font-weight:800;font-family:inherit;text-decoration:none;box-shadow:0 10px 28px rgba(47,158,107,.4);font-size:14px;';
  document.body.appendChild(a);
}

function hook(){
  if(typeof window.buildSmartMealPlan==='function' && !window.buildSmartMealPlan.__bridged){
    var orig=window.buildSmartMealPlan;
    var wrapped=function(){
      var r=orig.apply(this,arguments);
      try{persistPlan();}catch(e){}
      return r;
    };
    wrapped.__bridged=true;
    window.buildSmartMealPlan=wrapped;
    try{ buildSmartMealPlan=wrapped; }catch(e){}
  }
}
hook();
if(document.readyState!=='loading'){setTimeout(function(){hook(); if(window.__lastNutritionPlan)persistPlan();},0);}
document.addEventListener('DOMContentLoaded',function(){hook(); if(window.__lastNutritionPlan)persistPlan();});
window.addEventListener('load',function(){hook(); if(window.__lastNutritionPlan)persistPlan();});
})();
