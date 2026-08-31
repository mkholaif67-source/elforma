/* صمم دايت — المدرب الذكي للتغذية (Smart Nutrition Coach)
   =====================================================================
   عقل علمي مستقل يعمل على localStorage فقط — لا يلمس محرك توليد الخطة.
   يبني “الخطة التي تتغير” فوق الخطة الأساسية عبر التكيف الأسبوعي + قرارات المدرب.

   الأسس العلمية المدمجة:
   1) توازن الطاقة ووزن الاتجاه (Hall 2011/2012): 1 كجم دهن ≈ 7700 سعر، ومتوسط متحرك 7 أيام
      لتصفية ضجيج الماء، وإعادة حساب الTDEE رجعيا من الاستهلاك وتغير الوزن.
   2) التكيف الحراري (Rosenbaum & Leibel 2010): فقد •10% وزن - هبوط أيض حتى ~15% فوق المتوقع.
   3) الثبات (Plateau): تغير اتجاه الوزن < ~0.2% وزن/أسبوع ل ≥ أسبوعين + التزام ≥ 85%.
   4) استراحات الدايت / الريفيد (MATADOR / Byrne 2018): فترة صيانة 1–2 أسبوع كل 6–8 أسابيع.
   5) الريفرس دايت / الصيانة: رفع تدريجي +5–10% بعد بلوغ الهدف لاستعادة REE/الدرقية.
   6) الNEAT (Levine 2005): 15–50% من الطاقة؛ العجز يخفضه - رفع الخطوات قبل خفض السعرات.
   7) البروتين والشبع (Helms 2014 / Morton 2018): 1.6–2.2 جم/كجم ‫‬يرفع الشبع ويحفظ الكتلة.
   8) الملل والتنوع: تدوير الوجبات داخل الأطعمة الصحية يتغلب على الرتابة.
   9) الحدود الأرضية: لا تنزل تحت الBMR؛ ≈ 1200(أنثى)/1500(ذكر)؛ العجز ≤ ~25%.
*/
(function(){
'use strict';
if (typeof window === 'undefined') return;

var KCAL_PER_KG = 7700;
var PROTEIN_PER_KG = 2.0;          // هدف البروتين الافتراضي أثناء التنشيف
var MAX_DEFICIT_PCT = 0.25;
var BIG_CHANGE_PCT = 0.15;
var AT_CAP = 0.15;                 // سقف التكيف الحراري

/* ---------- أدوات عامة ---------- */
function load(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function round(n,s){s=s||1;return Math.round((+n||0)/s)*s;}
function r1(n){return Math.round((+n||0)*10)/10;}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function todayKey(){return new Date().toISOString().slice(0,10);}
function dateKey(d){return d.toISOString().slice(0,10);}
function daysBetween(a,b){return Math.round((new Date(b)-new Date(a))/86400000);}
function uid(){return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function sum(a){var t=0;for(var i=0;i<a.length;i++)t+=(+a[i]||0);return t;}
function avg(a){return a.length?sum(a)/a.length:0;}

/* ---------- الوصول للبيانات ---------- */
function plan(){var _p=load('diet_plan',null);if(_p&&_p.engineVersion!=='EGY-v64'){try{localStorage.removeItem('diet_plan');}catch(e){}return null;}return _p;}
function profile(){var p=load('diet_profile',null);if(p)return p;var pl=plan();return (pl&&pl.profile)||{};}
function logs(){return load('diet_log',{});}            // {date:{meals:{slot:true}}}
function weights(){var w=load('diet_weights',[]);return (w||[]).slice().sort(function(a,b){return a.date<b.date?-1:1;});}
function water(){return load('diet_water',{});}
function cstateRaw(){return load('diet_coach',{notif:[],log:[],reviewedWeek:0,marks:{},neatGoal:0});}
function persist(c){save('diet_coach',c);}
function workingTarget(){var t=load('diet_target',null);var pl=plan();return t||(pl&&pl.targetCals)||2000;}

/* ---------- وعي كامل بمدخلات المستخدم (الحالة الصحية + التحديات + النوم) ---------- */
function health(){var p=profile();return (p.health||p.healthConditions||[]);}
function probs(){var p=profile();return (p.problems||p.dietProblems||[]);}
function hasCond(x){return health().indexOf(x)>-1;}
function hasProb(x){return probs().indexOf(x)>-1;}
function sleepH(){var p=profile();var s=+(p.sleepHours||p.sleep||0);return s>0?s:7;}
function carbSensitive(){return hasCond('diabetes')||hasCond('insulin')||hasCond('fatty-liver')||hasCond('pcos');}
// حدود البروتين الآمنة حسب الحالة الصحية (جم/كجم)
function proteinBounds(bw){
  bw=bw||75;var lo=1.4,hi=2.4,tgt=PROTEIN_PER_KG,mode='رياضي';
  if(hasCond('kidney')){lo=0.6;hi=0.9;tgt=0.8;mode='معتدل (كلى)';}
  else if(hasCond('gout')){lo=1.0;hi=1.6;tgt=1.4;mode='معتدل (نقرس)';}
  return {lo:Math.round(bw*lo),hi:Math.round(bw*hi),tgt:Math.round(bw*tgt),mode:mode};
}

/* ---------- تتبع السعرات الفعلي (اختياري) — يجعل تقدير الTDEE أدق ---------- */
function intakeLog(){return load('diet_intake',{});}
function logIntake(cals,date){
  date=date||todayKey();var I=intakeLog();var v=parseFloat(cals);
  if(v>=0&&v<12000){I[date]=Math.round(v);save('diet_intake',I);
    var c=cstateRaw();logEvent(c,'\uD83D\uDCDD','\u062a\u0633\u062c\u064a\u0644 \u0633\u0639\u0631\u0627\u062a \u0641\u0639\u0644\u064a\u0629: '+Math.round(v)+' \u0633\u0639\u0631');persist(c);}
  return I;
}
function getIntake(date){return intakeLog()[date||todayKey()];}
function intakeAvg(days){
  days=days||14;var I=intakeLog();var keys=Object.keys(I);if(!keys.length)return null;
  var cutoff=new Date();cutoff.setDate(cutoff.getDate()-days+1);
  var tot=0,cnt=0;
  for(var i=0;i<keys.length;i++){if(new Date(keys[i])>=cutoff){tot+=(+I[keys[i]]||0);cnt++;}}
  return cnt>=3?Math.round(tot/cnt):null;   // محتاج 3 أيام على الأقل للاعتماد عليه
}
function loggedIntakeDays(){return Object.keys(intakeLog()).length;}

/* ---------- الأسبوع الحالي ---------- */
function calWeek(){var pl=plan();if(!pl||!pl.created)return 1;return clamp(Math.floor(daysBetween(pl.created,Date.now())/7)+1,1,99);}
// محرك التدرج: بيانات المستخدم هي القائد. طول ما بيسجل وزنه - تقديم بالبيانات والمؤقت الزمني واقف.
// لو بطل يسجل - المؤقت يكمل من مكانه الحالي (بدون رجوع لأسبوع 1). الأسبوع لا يتراجع أبدا.
var WEEK_LOG_GRACE_DAYS=10;
function _weekFloor(){var w=load('diet_week',null);var n=(typeof w==='number')?w:parseInt(w,10);return (isFinite(n)&&n>0)?clamp(n,1,99):0;}
function resolveWeek(){
  var floorWk=_weekFloor();
  var w=weights();
  var wk;
  if(w&&w.length>=2){
    var spanDays=daysBetween(w[0].date,w[w.length-1].date);
    var dataWeek=Math.floor(spanDays/7)+1;              // تقديم بالبيانات الحقيقية
    var idleDays=daysBetween(w[w.length-1].date,Date.now());
    if(idleDays>WEEK_LOG_GRACE_DAYS)dataWeek+=Math.floor(idleDays/7); // بطل تسجيل - المؤقت يكمل من مكانه
    wk=dataWeek;
  } else { wk=calWeek(); }                                // مفيش تسجيل كفاية - تقديم زمني تلقائي
  return clamp(Math.max(wk,floorWk,1),1,99);              // لا يتراجع ولا يتصفر
}
function curWeek(){var wk=resolveWeek();if(wk>_weekFloor())save('diet_week',wk);return wk;}
function setWeek(w){save('diet_week',clamp(w,1,99));}

/* ============================================================
   1) وزن الاتجاه والتقدم
   ============================================================ */
// متوسط متحرك 7 أيام لكل وزن مسجل (يصفي ضجيج الماء/الأملاح)
function trendSeries(){
  var w=weights();if(!w.length)return [];
  var out=[];
  for(var i=0;i<w.length;i++){
    var end=new Date(w[i].date), winStart=new Date(end);winStart.setDate(end.getDate()-6);
    var vals=[];
    for(var j=0;j<=i;j++){var d=new Date(w[j].date);if(d>=winStart&&d<=end)vals.push(w[j].weight);}
    out.push({date:w[i].date,week:w[i].week,raw:w[i].weight,trend:r1(avg(vals))});
  }
  return out;
}
function latestTrend(){var t=trendSeries();return t.length?t[t.length-1].trend:(profile().weight||null);}
// معدل التغير الأسبوعي (كجم/أسبوع) عبر آخر نافذة أيام
function weeklyRateKg(days){
  days=days||21;var t=trendSeries();if(t.length<2)return null;
  var last=t[t.length-1], cutoff=new Date(last.date);cutoff.setDate(cutoff.getDate()-days);
  var first=t[0];
  for(var i=t.length-1;i>=0;i--){if(new Date(t[i].date)<=cutoff){first=t[i];break;}}
  var dd=daysBetween(first.date,last.date);if(dd<5)return null;
  return r1(((last.trend-first.trend)/dd)*7);
}

/* ============================================================
   2) التزام التغذية (من تعليم الوجبات)
   ============================================================ */
function mealsCount(){var pl=plan();return (pl&&pl.meals&&pl.meals.length)||3;}
function dayEatenCount(date){var L=logs()[date];if(!L||!L.meals)return 0;var n=0;for(var k in L.meals)if(L.meals[k])n++;return n;}
function dayAdherence(date){var mc=mealsCount();return mc?clamp(dayEatenCount(date)/mc,0,1):0;}
// التزام عبر آخر N يوم مع تسجيل
function adherenceWindow(days){
  days=days||7;var L=logs();var keys=Object.keys(L);if(!keys.length)return 0;
  var cutoff=new Date();cutoff.setDate(cutoff.getDate()-days+1);
  var tot=0,cnt=0;
  for(var i=0;i<keys.length;i++){if(new Date(keys[i])>=cutoff){tot+=dayAdherence(keys[i]);cnt++;}}
  return cnt?Math.round((tot/cnt)*100):0;
}
function loggedDays(){return Object.keys(logs()).filter(function(d){return dayEatenCount(d)>0;}).length;}

/* ============================================================
   3) تقدير الTDEE رجعيا من توازن الطاقة
   estTDEE = avgIntake - (ΔtrendWeight_kg × 7700) / days
   ============================================================ */
function estIntake(){
  var real=intakeAvg(14); if(real) return real;   // لو فيه تتبع فعلي كاف (≥3 أيام) نستخدمه — أدق من التقدير
  // غير كده: الاستهلاك الفعلي التقريبي = الهدف × عامل الالتزام (أرضية 0.55)
  var adh=adherenceWindow(14)/100; if(!adh) adh=0.85;
  return Math.round(workingTarget()*clamp(0.55+0.45*adh,0.55,1));
}
function estTDEE(){
  var t=trendSeries();if(t.length<2)return profile().tdee||null;
  var last=t[t.length-1], cutoff=new Date(last.date);cutoff.setDate(cutoff.getDate()-21);
  var first=t[0];for(var i=t.length-1;i>=0;i--){if(new Date(t[i].date)<=cutoff){first=t[i];break;}}
  var dd=daysBetween(first.date,last.date);if(dd<7)return profile().tdee||null;
  var dW=last.trend-first.trend;
  var est=estIntake()-(dW*KCAL_PER_KG)/dd;
  // حدود عقلانية حول التقدير النظري
  var base=profile().tdee||est;
  return Math.round(clamp(est, base*0.7, base*1.3));
}
// التكيف الحراري التقديري (الفرق بين الTDEE النظري والفعلي)
function adaptivePct(){
  var base=profile().tdee, actual=estTDEE();
  if(!base||!actual)return 0;
  return clamp(Math.round((1-actual/base)*100),0,Math.round(AT_CAP*100));
}

/* ============================================================
   4) الثبات (Plateau)
   ============================================================ */
function expectedRate(){ // المعدل المستهدف (سالب للتنشيف)
  var p=profile();var sign=(p.goal==='bulk')?1:-1;
  return (p.weeklyRate||0.5)*sign;
}
function plateauStatus(){
  var p=profile();var goal=p.goal||'cut';
  var rate=weeklyRateKg(21);
  var adh=adherenceWindow(14);
  var weeksTracked=Math.max(1,Math.ceil(loggedDays()/7));
  var bw=latestTrend()||p.weight||80;
  var thr=bw*0.002; // 0.2% وزن أسبوعي
  if(rate===null||weeksTracked<2)return {state:'collecting',rate:rate,adh:adh};
  if(goal==='cut'||goal==='recomp'){
    if(Math.abs(rate)<thr){
      if(adh<85)return {state:'adherence',rate:rate,adh:adh};
      // الوزن ثابت لكن البطن بينزل = إعادة تركيب (دهونعضل) — مفيش داعي نخفض
      if(waistTrendingDown())return {state:'recomp_progress',rate:rate,adh:adh,waist:measureRateCm('waist',28)};
      return {state:'plateau',rate:rate,adh:adh};
    }
    if(rate<-(bw*0.012))return {state:'too_fast',rate:rate,adh:adh};
    return {state:'on_track',rate:rate,adh:adh};
  }
  if(goal==='bulk'){
    if(rate<thr)return adh>=85?{state:'stall_gain',rate:rate,adh:adh}:{state:'adherence',rate:rate,adh:adh};
    if(rate>(bw*0.01))return {state:'too_fast_gain',rate:rate,adh:adh};
    return {state:'on_track',rate:rate,adh:adh};
  }
  return {state:'maintain',rate:rate,adh:adh};
}
function goalReached(){
  var p=profile();if(!p.target||!p.weight)return false;var cur=latestTrend()||p.weight;
  if((p.goal||'cut')==='cut')return cur<=p.target+0.3;
  if(p.goal==='bulk')return cur>=p.target-0.3;
  return false;
}

/* ============================================================
   5) التقسيم الزمني (الخطة التي تتغير) — مراحل + ريفيد + استراحة
   ============================================================ */
function maintenanceCals(){return estTDEE()||profile().tdee||Math.round(workingTarget()*1.18);}
// مرحلة الأسبوع
function phaseForWeek(week){
  var p=profile();var goal=p.goal||'cut';var maint=maintenanceCals();var base=workingTarget();
  if(goal==='bulk'){
    if(week<=2)return {type:'ADAPTATION',label:'\u062a\u0623\u0633\u064a\u0633 \u0644\u0637\u064a\u0641',cals:Math.round(base*0.97),refeed:0,note:'\u0628\u062f\u0627\u064a\u0629 \u062a\u062f\u0631\u064a\u062c\u064a\u0629 \u0644\u062a\u0647\u064a\u0626\u0629 \u0627\u0644\u062c\u0647\u0627\u0632 \u0627\u0644\u0647\u0636\u0645\u064a'};
    return {type:'LEAN_SURPLUS',label:'\u0641\u0627\u0626\u0636 \u0646\u0638\u064a\u0641',cals:base,refeed:0,note:'\u0641\u0627\u0626\u0636 \u0645\u0636\u0628\u0648\u0637 \u0644\u0628\u0646\u0627\u0621 \u0639\u0636\u0644\u064a \u0628\u0623\u0642\u0644 \u062f\u0647\u0648\u0646'};
  }
  if(goal==='maintain')return {type:'STABILIZATION',label:'\u062b\u0628\u0627\u062a',cals:maint,refeed:0,note:'\u062a\u062b\u0628\u064a\u062a \u0627\u0644\u0648\u0632\u0646 \u0639\u0646\u062f \u0627\u0644\u0635\u064a\u0627\u0646\u0629'};
  // cut / recomp
  var cyc=((week-1)%7); // دورة مدتها 7 أسابيع: 6 تنشيف + 1 ريفيد/استراحة
  if(week<=2)return {type:'ADAPTATION',label:'\u062a\u0623\u0642\u0644\u0645',cals:Math.round((base+maint)/2*1.0>base?Math.round(base*1.04):base),refeed:0,note:'\u062a\u062e\u0641\u064a\u0636 \u0623\u0644\u0637\u0641 \u0641\u064a \u0623\u0648\u0644 \u0623\u0633\u0628\u0648\u0639\u064a\u0646 \u0644\u062a\u0642\u0644\u064a\u0644 \u0635\u062f\u0645\u0629 \u0627\u0644\u062a\u0643\u064a\u0641 \u0627\u0644\u062d\u0631\u0627\u0631\u064a'};
  if(cyc===6)return {type:'DIET_BREAK',label:'\u0627\u0633\u062a\u0631\u0627\u062d\u0629 \u062f\u0627\u064a\u062a',cals:maint,refeed:7,note:'\u0623\u0633\u0628\u0648\u0639 \u0635\u064a\u0627\u0646\u0629 \u0643\u0627\u0645\u0644 (MATADOR) \u0644\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0644\u064a\u0628\u062a\u064a\u0646 \u0648\u0627\u0644\u062f\u0631\u0642\u064a\u0629 \u0648\u062a\u062e\u0641\u064a\u0641 \u0627\u0644\u062a\u0643\u064a\u0641'};
  return {type:'MODERATE_CUT',label:'\u062a\u0646\u0634\u064a\u0641 \u0645\u0639\u062a\u062f\u0644',cals:base,refeed:1,note:'\u062a\u0646\u0634\u064a\u0641 \u0645\u0633\u062a\u0642\u0631 \u0645\u0639 \u064a\u0648\u0645 \u0631\u064a\u0641\u064a\u062f \u0623\u0633\u0628\u0648\u0639\u064a \u0644\u062a\u0639\u0648\u064a\u0636 \u0627\u0644\u062c\u0644\u0627\u064a\u0643\u0648\u062c\u064a\u0646'};
}
// أيام التدريب (لتدوير الكارب) — توزيع منتظم حسب عدد أيام التدريب
function trainingDays(){
  var n=clamp(Math.round(profile().trainDays||0),0,7);if(!n)return {};
  var order=[1,3,5,2,4,6,0]; // اثنين،أربعاء،جمعة...
  var set={};for(var i=0;i<n;i++)set[order[i]]=true;return set;
}
function isTrainingDate(date){var d=new Date(date).getDay();return !!trainingDays()[d];}
// نوع اليوم (كارب عال/منخفض) — يعمل للتنشيف/الريكومب عند وجود تدريب
function carbCycleEnabled(){var p=profile();return (p.diet==='carbcycle'||p.goal==='recomp'||(profile().trainDays||0)>=3);}
function dayType(date){
  if(!carbCycleEnabled())return {key:'even',label:'\u064a\u0648\u0645 \u0645\u062a\u0648\u0627\u0632\u0646',cls:'',carbMult:1,fatMult:1};
  if(isTrainingDate(date))return {key:'high',label:'\u064a\u0648\u0645 \u0643\u0627\u0631\u0628 \u0639\u0627\u0644\u064d (\u062a\u062f\u0631\u064a\u0628)',cls:'hi',carbMult:1.25,fatMult:0.7};
  return {key:'low',label:'\u064a\u0648\u0645 \u0643\u0627\u0631\u0628 \u0645\u0646\u062e\u0641\u0636 (\u0631\u0627\u062d\u0629)',cls:'lo',carbMult:0.7,fatMult:1.3};
}
// هل اليوم ريفيد؟ (في أسابيع التنشيف العادي)
function isRefeedDate(date,week){
  var ph=phaseForWeek(week);if(ph.type!=='MODERATE_CUT'||!ph.refeed)return false;
  // أعلى يوم تدريب في الأسبوع = ريفيد؛ وإلا فالسبت
  var d=new Date(date).getDay();var t=trainingDays();var picks=Object.keys(t).map(Number).sort();
  var refeedDay = picks.length?picks[picks.length-1]:6;
  return d===refeedDay;
}
// سعرات اليوم بعد كل التعديلات
function dayTarget(date,week){
  week=week||curWeek();var ph=phaseForWeek(week);
  if(ph.type==='DIET_BREAK')return {cals:ph.cals,reason:'\u0627\u0633\u062a\u0631\u0627\u062d\u0629 \u062f\u0627\u064a\u062a',refeed:true};
  if(isRefeedDate(date,week))return {cals:maintenanceCals(),reason:'\u064a\u0648\u0645 \u0631\u064a\u0641\u064a\u062f',refeed:true};
  return {cals:ph.cals,reason:ph.label,refeed:false};
}

/* ============================================================
   6) الماكرو التكيفي لليوم (بروتين ثابت + تدوير كارب/دهون)
   ============================================================ */
function dayMacros(date,week){
  var pl=plan();var p=profile();var dt=dayTarget(date,week);var cals=dt.cals;
  var bw=p.weight||latestTrend()||75;
  var _ptOvr=load('diet_protein_target',null);
  var _pB=proteinBounds(bw);
  var protein=Math.round(((+_ptOvr||0)|| p.proteinTarget|| (pl&&pl.targetMacros&&pl.targetMacros.protein) || _pB.tgt));
  protein=clamp(protein, _pB.lo, _pB.hi);
  var pCal=protein*4;var rest=Math.max(0,cals-pCal);
  // توزيع أساسي 55% كارب / 45% دهون من الباقي
  var dtp=dayType(date);
  var carbShare=0.55, fatShare=0.45;
  // تدوير الكارب
  carbShare=clamp(carbShare*dtp.carbMult,0.3,0.72);fatShare=1-carbShare;
  if(dt.refeed){var _bump=carbSensitive()?0.04:0.12;var _cap=carbSensitive()?0.55:0.78;carbShare=clamp(carbShare+_bump,0.4,_cap);fatShare=1-carbShare;}
  var carbs=Math.round((rest*carbShare)/4);
  var fat=Math.round((rest*fatShare)/9);
  return {cals:cals,protein:protein,carbs:carbs,fat:fat,dayType:dtp,reason:dt.reason,refeed:dt.refeed};
}

/* ============================================================
   7) خطة اليوم (تحجيم الوجبات لهدف اليوم)
   ============================================================ */
function _dedupMealProteins(foods){
  // قاعدة علمية: نوع بروتين حيواني رئيسي واحد لكل وجبة (الفراخ كلها فراخ، السمك سمك،
  // اللحمة لحمة، والبيض لا يتكرر بشكلين). نبقي أول بروتين ونحذف الباقي. الألبان/الكارب/
  // الخضار/الفاكهة لا تتأثر. عرضي فقط — لا يغير الخطة المخزنة.
  var seen=false;
  return (foods||[]).filter(function(f){
    if((f.cat||'')!=='protein') return true;
    if(seen) return false;
    seen=true; return true;
  });
}
function _sanitizeMealFoods(foods,slotKey){
  // تشيل الدهون اللي ماتتاكلش لوحدها كعنصر قائم بذاته (طحينة/سمسم/زبدة/زيت/سمن)
  // دي تتبيلة أو دهون طبخ مش صنف يتاكل بالملعقة. في الكيتو/كارنيفور الدهون أساسية فبنسيبها. عرضي فقط.
  try{
    var p=(typeof profile==='function')?profile():{};
    var diet=(p&&p.diet)||'balanced';
    if(diet==='keto'||diet==='carnivore')return foods;
    var bad=/طحين|سمسم|زبد|سمن|زيت(?!ون)/;
    var out=(foods||[]).filter(function(f){
      return !(((f.cat||'')==='fat')&&bad.test(String(f.name||'')));
    });
    return out.length?out:foods;
  }catch(e){return foods;}
}
// تجميع كل عناصر الخضار في صف واحد "سلطة خضراء" — دايما في العرض
function _groupSaladFoods(foods){
  try{
    var veg=(foods||[]).filter(function(f){return (f.cat||'')==='veggie';});
    if(veg.length<2) return foods;
    var oth=(foods||[]).filter(function(f){return (f.cat||'')!=='veggie';});
    var sg=0,sc=0,sp=0,scb=0,sf=0,names=[],vids=[];
    veg.forEach(function(f){sg+=(f.grams||0);sc+=(f.cals||0);sp+=(f.pro||0);scb+=(f.carb||0);sf+=(f.fat||0);
      if(f.id==='__salad__'&&f.sub){names.push(f.sub);}else{names.push(f.name||f.id);}
      if(f.ids&&f.ids.length){vids=vids.concat(f.ids);}else if(f.id&&f.id!=='__salad__'){vids.push(f.id);}});
    oth.push({id:'__salad__',ids:vids,name:'سلطة خضراء',sub:names.join(' + '),grams:Math.round(sg),cals:Math.round(sc),pro:r1(sp),carb:r1(scb),fat:r1(sf),cat:'veggie'});
    return oth;
  }catch(e){return foods;}
}
// قبل التمرين: التوقيت يحدد التركيب — "أقل من ساعة" = خفيف وسريع (فاكهة/قهوة بس)، "أكتر من ساعتين" = وجبة كاملة
function _forcePreWorkout(foods, slotKey, mealCals, date){
  try{
    if((slotKey||'')!=='pre') return foods;
    var _preT='light'; try{var _pv=localStorage.getItem('diet_pre_timing'); if(_pv){_pv=JSON.parse(_pv); _preT=(_pv==='full')?'full':'light';}}catch(e){}
    if(_preT==='full') return foods;
    // [EGY-v64] قبل التمرين = ٤ توليفات فقط + قهوة سادة، ممنوع أي فاكهة تانية
    var combos=[['mwz','tmr'],['zbyb','mwz'],['tmr','dark_choc'],['dark_choc','mwz']];
    var di=0; try{di=Math.abs(_hashStr(String(date)))%combos.length;}catch(e){di=0;}
    var combo=combos[di];
    var cals=mealCals||150; if(cals<80)cals=150;
    var split=[0.6,0.4]; var out=[];
    for(var i=0;i<combo.length;i++){
      var per=findFood(combo[i]); if(!per)continue;
      var cph=+per.cal||0; var want=cals*split[i];
      var g=(cph>0)?Math.max(10,Math.round(want/cph*100)):20;
      if(combo[i]==='tmr'||combo[i]==='zbyb') g=Math.min(g,45);
      if(combo[i]==='dark_choc') g=Math.min(g,30);
      if(combo[i]==='mwz') g=Math.min(Math.max(g,80),160);
      out.push({id:per.id,name:per.n,grams:g,cals:Math.round((per.cal||0)*g/100),
        pro:r1((per.p||0)*g/100),carb:r1((per.cb||0)*g/100),fat:r1((per.ft||0)*g/100),
        cat:per.c||'fruit'});
    }
    var cof=findFood('coffee_black');
    if(cof){out.push({id:'coffee_black',name:cof.n,grams:200,cals:Math.round((cof.cal||0)*2),
      pro:r1((cof.p||0)*2),carb:r1((cof.cb||0)*2),fat:r1((cof.ft||0)*2),cat:cof.c||'fat'});}
    return out.length?out:foods;
  }catch(e){return foods;}
}
function _unifyMainProtein(meals,date){
  try{
    if(!meals||!meals.length)return meals;
    // [EGY-v64.2] توحيد البروتين وقت التوليد التلقائي فقط؛ أي وجبة عدلها المستخدم مبتتمسش
    function animalIdx(m){var ff=m.foods||[];for(var i=0;i<ff.length;i++){if(ff[i].cat==='protein'&&ff[i].id&&ff[i].id!=='__salad__')return i;}return -1;}
    function findMeal(sk){for(var i=0;i<meals.length;i++){if(meals[i].slotKey===sk)return meals[i];}return null;}
    var base=null;
    ['lunch','post','dinner'].forEach(function(sk){
      if(base)return;var m=findMeal(sk);if(!m)return;var ai=animalIdx(m);if(ai<0)return;base=m.foods[ai];
    });
    if(!base)return meals;var per=findFood(base.id);if(!per)return meals;
    ['lunch','post','dinner'].forEach(function(sk){
      if(_userEditedSlot(sk))return;
      var m=findMeal(sk);if(!m)return;var ai=animalIdx(m);if(ai<0)return;
      var old=m.foods[ai];if(old.id===base.id)return;
      var g=old.grams||120;
      m.foods[ai]={id:per.id,name:per.n,grams:g,cals:Math.round((per.cal||0)*g/100),
        pro:r1((per.p||0)*g/100),carb:r1((per.cb||0)*g/100),fat:r1((per.ft||0)*g/100),cat:'protein'};
      var ft=m.foods.reduce(function(a,f){a.cals+=(f.cals||0);a.pro+=(f.pro||0);a.carb+=(f.carb||0);a.fat+=(f.fat||0);return a;},{cals:0,pro:0,carb:0,fat:0});
      m.totals={cals:Math.round(ft.cals),pro:r1(ft.pro),carb:r1(ft.carb),fat:r1(ft.fat)};
    });
    return meals;
  }catch(e){return meals;}
}
function _applyPreTiming(foods, slotKey){
  try{
    if((slotKey||'')!=='pre') return foods;
    var t='light'; try{var v=localStorage.getItem('diet_pre_timing'); if(v){v=JSON.parse(v); t=(v==='full')?'full':'light';}}catch(e){}
    if(t==='full') return foods;
    var keep=(foods||[]).filter(function(f){
      var c=(f.cat||''); var nm=((f.name||'')+' '+(f.id||'')).toLowerCase();
      if(c==='fruit') return true;
      if(/coffee|qhw|قهوة|شاي|tea/.test(nm)) return true;
      return false;
    });
    return keep.length?keep:foods;
  }catch(e){return foods;}
}
// ====== تدوير الأصناف يوم بيوم (٤ أيام مختلفة تدور) ======
// كل يوم ياخد بديل من نفس الفئة ونفس الوجبة، بحيث الصنف ما يتكررش أكتر من مرتين في الأسبوع
function _dayVariantIdx(date){
  try{
    var pl=plan(); var created=(pl&&pl.created)?new Date(pl.created):new Date();
    var c0=created.toISOString().slice(0,10);
    var diff=Math.round((new Date(date)-new Date(c0))/86400000);
    if(isNaN(diff))diff=0;
    return ((diff%4)+4)%4;
  }catch(e){return 0;}
}
function _slotVarOffset(slot){var M={breakfast:0,lunch:0,pre:1,post:1,snack:2,snack_am:1,snack2:3,dinner:2};return M[slot]||0;}
function _coachHealthBlock(f,health){
  if(!f||!health||!health.length)return false;
  var t=(((f.n||f.name||'')+' '+(f.id||''))).toLowerCase();
  var cb=+f.cb||0,c=f.c||f.cat||'';
  var has=function(k){return health.indexOf(k)>-1;};
  var sweet=/سكر|عسل|شوكولا|شيكولا|نوتيلا|حلاوة|كيك|سنكرز|كيت كات|جالاكسي|ميلكا|بسبوسة|كنافة|جلاش|سمسمية|دري ميلك|بسكوت/.test(t);
  var driedSugar=(c==='fruit'&&cb>=40);
  var fried=/مقلي|مقلية|محمر|طعمية|شيبس|برنجلز/.test(t);
  var processedMeat=/لانشون|بسطرمة|سجق|نقانق|سلامي/.test(t);
  var organ=/كبد|كلاوي|مخ|طحال|كوارع|كرشة/.test(t);
  var verySalty=/مخلل|فسيخ|رنجة|سردين معلب|مدخن/.test(t);
  var highSatFat=(c==='fat'&&/زبد|سمن|سمنة/.test(t));
  if((has('diabetes')||has('insulin'))&&(sweet||driedSugar))return true;
  if(has('fatty-liver')&&(sweet||fried||driedSugar))return true;
  if(has('cholesterol')&&(highSatFat||fried||processedMeat))return true;
  if(has('bp')&&(processedMeat||verySalty))return true;
  if(has('gout')&&(organ||/سردين|أنشوجة|انشوجة|فسيخ|رنجة/.test(t)))return true;
  if(has('kidney')&&organ)return true;
  if(has('gerd')&&(fried||/شطة|حار|فلفل حار/.test(t)))return true;
  return false;
}
function _coachDietBlock(f,diet){
  var c=f.c||f.cat||'',cb=+f.cb||0;
  if(diet==='lowcarb'||diet==='keto'){
    if(c==='carb'&&cb>10)return true;
    if(c==='fruit'&&cb>12)return true;
    if(c==='snack'&&cb>15)return true;
  }
  return false;
}
var _PREF={sdr_frakh_mshwy:1,wrk_frakh_mshwy:1,kfta_frakh:1,kbda_frakh_mshwya:1,sdr_bt_mshwy:1,wrk_bt_mshwya:1,jnah_frakh_mshwy:1,lhm_bqry_mslwq:1,shrah_lhm_mshwya:1,kbab_mshwy:1,kfta_mshwya_ala_alfhm:1,lhm_mfrwm_bqry_qlyl_aldhn:1,kbda_askndrany:1,byd_mslwq:1,byd_awmlyt:1,twna_myah:1,qta_twna_balzyt:1,blty_mshwy:1,bwry_mshwy:1,makryl_mshwy:1,srdyn_mshwy:1,jbnaqrysh:1,jbna_rwds_gwld:1,jbnabyda:1,jbnarwmy:1,zbadytbyay:1,zbadylayt:1,lbnkhalyaldsm:1,lbnkamlaldsm:1,arzabydmtbwkh:1,arzbsmtymtbwkh:1,arzbnymtbwkh:1,mkrwnamslwqa:1,btatsmslwqa:1,btatsmshwya:1,btatamshwya:1,ayshbldy:1,ayshasmr:1,twstasmr:1,rayskykbny:1,ayshqmhkaml:1,fwlmdms:1,btykh:1,shmam:1,manjw:1,anb:1,khwkh:1,mshmsh:1,tynshwky:1,tyn:1,brtqal:1,ywsfy:1,jwafa:1,kmthra:1,rman:1,frawla:1,kaka:1,tfah:1,mwz:1,blh:1,tmr:1,zbyb:1};
function _isPref(id){return !!_PREF[id];}
// [EGY-v64] رتبة الأولوية حسب ترتيب المستخدم (الأصغر = أعلى أولوية)
var ELF_PRIORITY_ORDER={
  protein:['sdr_frakh_mshwy','wrk_frakh_mshwy','kfta_frakh','kbda_frakh_mshwya','jnah_frakh_mshwy','sdr_bt_mshwy','wrk_bt_mshwya','shrah_lhm_mshwya','lhm_bqry_mslwq','kbab_mshwy','kfta_mshwya_ala_alfhm','lhm_mfrwm_bqry_qlyl_aldhn','kbda_askndrany','byd_mslwq','byd_awmlyt','fwlmdms','twna_myah','qta_twna_balzyt','blty_mshwy','makryl_mshwy','bwry_mshwy','srdyn_mshwy'],
  carb:['arzabydmtbwkh','arzbsmtymtbwkh','btatsmshwya','ayshasmr','rayskykbny','ayshbldy','ayshqmhkaml','btatsmslwqa','twstasmr','arzbnymtbwkh','mkrwnamslwqa','btatamshwya'],
  dairy:['jbnaqrysh','jbna_rwds_gwld','jbnabyda','jbnarwmy']
};
var ELF_PRIORITY_RANK=(function(){var m={};['protein','carb','dairy'].forEach(function(cc){var l=ELF_PRIORITY_ORDER[cc];for(var i=0;i<l.length;i++){if(m[l[i]]==null)m[l[i]]=i;}});return m;})();
try{if(typeof window!=='undefined'){window.ELF_PRIORITY_ORDER=ELF_PRIORITY_ORDER;window.ELF_PRIORITY_RANK=ELF_PRIORITY_RANK;}}catch(e){}
function _elfPrioRank(id){return (ELF_PRIORITY_RANK && ELF_PRIORITY_RANK[id]!=null)?ELF_PRIORITY_RANK[id]:999;}
function _hashStr(s){s=String(s||'');var h=0;for(var i=0;i<s.length;i++){h=((h<<5)-h+s.charCodeAt(i))|0;}return Math.abs(h);}
// [نمط المستخدم] مجموعة الأصناف الموجودة فعلا في الخطة — التدوير اليومي ميطلعش برها
var _PLAN_IDS_CACHE=null,_PLAN_IDS_KEY=null;
function _planAllowedIds(){
  try{var pl=plan();if(!pl||!pl.meals||!pl.meals.length)return null;
    var key=(pl.created||0)+':'+pl.meals.length;
    if(_PLAN_IDS_CACHE&&_PLAN_IDS_KEY===key)return _PLAN_IDS_CACHE;
    var s={};pl.meals.forEach(function(m){(m.foods||[]).forEach(function(f){if(f.id&&f.id!=='__salad__')s[f.id]=1;if(f.ids&&f.ids.length)f.ids.forEach(function(x){s[x]=1;});});});
    _PLAN_IDS_CACHE=s;_PLAN_IDS_KEY=key;return s;
  }catch(e){return null;}
}
function _rotAltFoods(cat,slot,health,diet){
  var FI=foodIndex();
  var KNOWN={breakfast:1,lunch:1,dinner:1,pre:1,post:1,snack:1};
  var sk=(slot==='snack_am'||slot==='snack2')?'snack':slot;
  var useSlot=KNOWN[sk]?sk:null;
  var _PA=_planAllowedIds();
  return FI.filter(function(f){
    if(f.c!==cat)return false;
    if(_PA&&!_PA[f.id])return false;
    if(!_isPref(f.id))return false;
    if(useSlot&&f.mt&&f.mt.length&&f.mt.indexOf(useSlot)<0)return false;
    if(_coachHealthBlock(f,health))return false;
    if(_coachDietBlock(f,diet))return false;
    return true;
  });
}
function _coachSeason(){var m=(new Date()).getMonth();return (m>=3&&m<=9)?"summer":"winter";}
function _coachSeasonFruitSet(){var S={summer:["btykh","shmam","manjw","anb","khwkh","mshmsh","tyn","tynshwky"],winter:["brtqal","ywsfy","jwafa","kmthra","rman","frawla","kaka"]};var l=(S[_coachSeason()]||[]).concat(["mwz","tfah","brtqal"]);var o={};for(var i=0;i<l.length;i++){o[l[i]]=1;}return o;}
function _coachIsDateFood(id){return id==="blh"||id==="tmr"||id==="zbyb"||id==="qrasya";}
function _coachFruitInSeason(id){return _coachIsDateFood(id)||!!_coachSeasonFruitSet()[id];}
function _rotateBaseFood(f,slot,vi,health,diet){
  try{
    if(!f)return f;
    if(f.id==='__salad__'||f.ids)return f;
    var fc=(findFood(f.id)||{}).c||f.cat||(f.food&&f.food.cat)||'';
    if(['protein','carb','fruit','dairy'].indexOf(fc)<0)return f;
    var basePref=_isPref(f.id);
    if(basePref&&vi<=0){if(!(fc==="fruit"&&!_coachFruitInSeason(f.id)))return f;}
    var alts=_rotAltFoods(fc,slot,health,diet);
    if(fc==='fruit'){var _D={blh:1,tmr:1,zbyb:1,qrasya:1};var _bd=!!_D[f.id];var _SF=_coachSeasonFruitSet();alts=alts.filter(function(a){return _bd?!!_D[a.id]:(!_D[a.id]&&!!_SF[a.id]);});}
    if(!alts.length)return f;
    alts.sort(function(a,b){var ra=_elfPrioRank(a.id),rb=_elfPrioRank(b.id);if(ra!==rb)return ra-rb;return a.id<b.id?-1:(a.id>b.id?1:0);});
    var ids=alts.map(function(a){return a.id;});
    var oi,step;
    if(basePref){oi=ids.indexOf(f.id);if(oi<0)oi=0;step=vi;}
    else{oi=_hashStr(f.id)%alts.length;step=Math.max(0,vi);}
    var pick=alts[(((oi+step)%alts.length)+alts.length)%alts.length];
    if(basePref&&pick&&pick.id===f.id){pick=alts[(((oi+step+1)%alts.length)+alts.length)%alts.length];}
    if(!pick||pick.id===f.id)return f;
    var per=findFood(pick.id)||pick;
    var cph=+per.cal||0; var baseCals=+f.cals||0;
    var g=(cph>0)?Math.max(10,Math.round(baseCals/cph*100)):(f.grams||0);
    return {id:per.id,name:per.n,grams:g,cals:Math.round(baseCals),
      pro:r1((per.p||0)*g/100),carb:r1((per.cb||0)*g/100),fat:r1((per.ft||0)*g/100),cat:fc};
  }catch(e){return f;}
}
function dayPlan(date,week){
  var pl=plan();if(!pl||!pl.meals)return null;
  var dm=dayMacros(date,week);
  // الأساس = مجموع سعرات الوجبات الفعلي (مش targetCals المخزن) عشان نوازن الإجمالي مع هدف اليوم بدقة
  var baseCals=sum(pl.meals.map(function(m){return (m.totals&&m.totals.cals)||m.targetCals||0;}))||pl.targetCals||dm.cals;
  var ratio=clamp(dm.cals/(baseCals||dm.cals),0.6,1.6);
  var _vIdx=_dayVariantIdx(date);
  var _prof=(typeof profile==='function'?profile():{})||{};
  var _vHealth=_prof.health||_prof.healthConditions||[];
  var _vDiet=_prof.diet||'balanced';
  var meals=pl.meals.map(function(m){
    var mc=(m.targetCals||(m.totals&&m.totals.cals)||0);
    var _vSlot=m.slotKey||m.label;
    var _vi=_vIdx+_slotVarOffset(_vSlot);
    var _edited=_userEditedSlot(_vSlot);
    var foods=(m.foods||[]).map(function(f0){
      var f=_edited?f0:_rotateBaseFood(f0,_vSlot,_vi,_vHealth,_vDiet);
      var _sv=_serv({n:(f.name||''),c:(f.cat||(findFood(f.id)||{}).c||'')});
      var g=(f.grams>0)?_roundServe((f.grams||0)*ratio,_sv):0;
      var sc=(f.grams?g/f.grams:1);
      return {id:f.id,sub:f.sub,ids:f.ids,name:(f.food&&(f.food.nameAr||f.food.name))||f.name||'\u0639\u0646\u0635\u0631',grams:g,
        cals:Math.round((f.cals||0)*sc),pro:r1((f.pro||0)*sc),carb:r1((f.carb||0)*sc),fat:r1((f.fat||0)*sc),
        cat:f.cat||(f.food&&f.food.cat)||(findFood(f.id)||{}).c||''};
    });
    foods=_dedupMealProteins(foods);
    foods=_sanitizeMealFoods(foods,m.slotKey||m.label);
    foods=_groupSaladFoods(foods);
    foods=_applyPreTiming(foods,m.slotKey||m.label);
      if(!_edited)foods=_forcePreWorkout(foods,m.slotKey||m.label,Math.round(mc*ratio),date);
    var ft=foods.reduce(function(a,f){a.cals+=(f.cals||0);a.pro+=(f.pro||0);a.carb+=(f.carb||0);a.fat+=(f.fat||0);return a;},{cals:0,pro:0,carb:0,fat:0});
    return {slotKey:m.slotKey||m.label,label:m.label||m.slotKey,
      targetCals:Math.round(mc*ratio),
      totals:{cals:Math.round(ft.cals),pro:r1(ft.pro),carb:r1(ft.carb),fat:r1(ft.fat)},
      foods:foods};
  });
  meals=_unifyMainProtein(meals,date);
  var _ord={breakfast:1,snack_am:2,pre:3,lunch:4,post:5,snack:6,snack2:7,dinner:8};
  meals.sort(function(a,b){return (_ord[a.slotKey]==null?9:_ord[a.slotKey])-(_ord[b.slotKey]==null?9:_ord[b.slotKey]);});
  return {date:date,week:week||curWeek(),macros:dm,meals:meals,totalCals:dm.cals};
}

/* ============================================================
   8) الإشعارات والقرارات
   ============================================================ */
// هل القرار "تغير كبير جدا" يحتاج موافقة؟ تغيير السعرات الكبير فقط = موافقة
function needsApproval(d){
  if(!d)return false;
  if(d.type==='swap'||d.type==='add'||d.type==='remove'||d.type==='macro')return true;
  if(d.type!=='cal')return false;            // حركة/تدوير/سلوكي/إبقاء الخطة = تلقائي دائما
  var wt=workingTarget();if(!wt)return true;
  return Math.abs((d.cals-wt)/wt) > BIG_CHANGE_PCT;
}
// تنفيذ أثر القرار فعليا على التخزين (يستخدم للتطبيق التلقائي والموافقة)
function performDecision(c,d){
  if(!d)return null;
  if(_execExpert(c,d))return null;
  if(d.type==='cal'){
    var nt=clamp(d.cals,floorCals(),Math.round((profile().tdee||d.cals*1.4)*1.2));
    save('diet_target',nt);
    logEvent(c,'','تعديل السعرات تلقائيا إلى '+nt+' سعر'+(d.temp?' (مؤقت)':''));
    return nt;
  } else if(d.type==='neat'){
    c.neatGoal=(c.neatGoal||0)+(d.steps||2000);
    logEvent(c,'','رفع هدف الخطوات +'+(d.steps||2000)+'/يوم تلقائيا');
  } else if(d.type==='rotate'){
    save('diet_rotate',(load('diet_rotate',0)||0)+1);
    logEvent(c,'','تدوير الوجبات تلقائيا');
  } else if(d.type==='maintain_plan'){
    logEvent(c,'','إكمال الخطة بدون خفض سعرات (تقدم في المقاسات)');
  } else if(d.type==='behavioral'){
    logEvent(c,'','تفعيل خطة تثبيت الالتزام');
  }
  return null;
}
function notify(c,n){
  c.notif=c.notif||[];
  if(n.sig){for(var i=0;i<c.notif.length;i++){if(c.notif[i].sig===n.sig&&c.notif[i].state!=='kept')return;}}
  n.id=uid();n.ts=Date.now();n.read=false;
  if(n.kind==='decision'&&n.decision){
    if(needsApproval(n.decision)){
      if(!n.state)n.state='pending';
    } else {
      performDecision(c,n.decision);n.state='auto';n.autoApplied=true;
    }
  } else if(!n.state&&n.kind==='decision'){n.state='pending';}
  c.notif.unshift(n);if(c.notif.length>40)c.notif=c.notif.slice(0,40);
}
function logEvent(c,icon,text){c.log=c.log||[];c.log.unshift({icon:icon,text:text,week:curWeek(),ts:Date.now()});if(c.log.length>60)c.log=c.log.slice(0,60);}

// المراجعة الأسبوعية — تولد قرارات علمية

/* ============================================================
   خبير التغذية — قرارات على مستوى العناصر
   ============================================================ */
var _EXP_PRO={
  main:['sdr_frakh_mshwy','blty_mshwy','twna_myah','lhm_mfrwm_bqry_qlyl_aldhn','bwry_mshwy','shysh_tawwq'],
  light:['jbnaqrysh','byd_mslwq','zbadyywnanytbyay']
};
// قائمة بدائل البروتين الموسعة — تبنى ديناميكيا من كل قاعدة الأطعمة وتراعي الحالة الصحية والنظام
function _proteinPool(kind){
  var FI=foodIndex();
  var fb=(kind==='light')?_EXP_PRO.light:_EXP_PRO.main;
  if(!FI||!FI.length) return fb.slice();
  var p=profile();var diet=p.diet||'balanced';
  var gout=hasCond('gout'), lactose=hasCond('lactose');
  var RED=/\u0644\u062d\u0645|\u0644\u062d\u0645\u0629|\u0643\u0628\u062f|\u0643\u0644\u0627\u0648\u064a|\u0645\u0645\u0628\u0627\u0631|\u0645\u062e|\u0633\u062c\u0642|\u0628\u0633\u0637\u0631\u0645|\u0636\u0623\u0646|\u0636\u0627\u0646\u064a|\u0643\u0648\u0627\u0631\u0639|\u0623\u062d\u0634\u0627\u0621/;
  var DAIRY=/\u062c\u0628\u0646|\u0632\u0628\u0627\u062f\u064a|\u0644\u0628\u0646|\u062d\u0644\u064a\u0628|\u0631\u0648\u0628|\u0642\u0631\u064a\u0634|\u062c\u0628\u0646\u0629/;
  var LIGHT=/\u062c\u0628\u0646|\u0642\u0631\u064a\u0634|\u0632\u0628\u0627\u062f\u064a|\u0628\u064a\u0636|\u062a\u0648\u0646\u0629|\u062a\u0648\u0646\u0647|\u0644\u0628\u0646|\u0631\u0648\u0628/;
  var res=[];
  for(var i=0;i<FI.length;i++){
    var f=FI[i];var n=(f.n||'')+'';var c=f.c||'';
    var isProt=(c==='protein')||(c==='dairy'&&/\u062c\u0628\u0646|\u0642\u0631\u064a\u0634|\u0632\u0628\u0627\u062f\u064a/.test(n))||/\u0628\u064a\u0636|\u062a\u0648\u0646\u0629|\u062a\u0648\u0646\u0647/.test(n);
    if(!isProt) continue;
    if(diet==='carnivore'&&(c==='dairy'||DAIRY.test(n))&&!/\u0628\u064a\u0636/.test(n)) continue;
    if(gout&&RED.test(n)) continue;        // النقرس: استبعاد اللحوم الحمراء والأحشاء
    if(lactose&&DAIRY.test(n)) continue;   // اللاكتوز: استبعاد الألبان
    var light=LIGHT.test(n);
    if(kind==='light'&&!light) continue;
    if(kind==='main'&&light) continue;
    res.push(f.id);
  }
  res.sort(function(a,b){var fa=findFood(a),fb2=findFood(b);var sa=(fa&&_isCommonEgy(fa.n))?1:0;var sb=(fb2&&_isCommonEgy(fb2.n))?1:0;return sb-sa;});
  return res.length?res:fb.slice();
}
function _execExpert(c,d){
  if(!d) return false;
  if(d.type==='swap'){
    editMeal(d.slot,{replace:{old:d.oldId,new:d.newId}});
    logEvent(c,'','بدل '+(d.oldName||'')+' ب '+(d.newName||'')+' في '+_slotLabel(d.slot));
    return true;
  }
  if(d.type==='add'){
    editMeal(d.slot,{add:d.foodId});
    logEvent(c,'','أضاف '+(d.foodName||'')+' ل '+_slotLabel(d.slot));
    return true;
  }
  if(d.type==='remove'){
    editMeal(d.slot,{remove:d.foodId});
    logEvent(c,'','شال '+(d.foodName||'')+' من '+_slotLabel(d.slot));
    return true;
  }
  if(d.type==='macro'){
    save('diet_protein_target',d.protein);
    logEvent(c,'','رفع هدف البروتين إلى '+d.protein+' جم');
    return true;
  }
  return false;
}
function _expMealIds(m){var ids=[];(m.foods||[]).forEach(function(f){if(f.id&&f.id!=='__salad__')ids.push(f.id);if(f.ids&&f.ids.length)ids=ids.concat(f.ids);});return ids;}
function _expertReview(c,week){
  if(typeof dayPlan!=='function') return;
  week=week||curWeek();
  var dp=dayPlan(todayKey(),week);
  if(!dp||!dp.meals||!dp.meals.length) return;
  var p=profile()||{};var diet=p.diet||'balanced';
  var dm=dp.macros||{};
  var aP=0,aF=0;
  dp.meals.forEach(function(m){var t=m.totals||{};aP+=t.pro||0;aF+=t.fat||0;});
  if(dm.protein&&aP<dm.protein*0.85){
    var order=['lunch','dinner','breakfast','post','snack'];var target=null;
    for(var oi=0;oi<order.length&&!target;oi++){for(var mi=0;mi<dp.meals.length;mi++){if(dp.meals[mi].slotKey===order[oi]){target=dp.meals[mi];break;}}}
    if(target){
      var slot=target.slotKey;var have=_expMealIds(target);
      var pool=(slot==='breakfast'||slot==='snack'||slot==='pre')?_proteinPool('light'):_proteinPool('main');
      var pickId=null;
      for(var pi=0;pi<pool.length;pi++){if(have.indexOf(pool[pi])<0&&findFood(pool[pi])){pickId=pool[pi];break;}}
      if(pickId){
        var pf=findFood(pickId);var gap=Math.max(1,Math.round(dm.protein-aP));
        notify(c,{kind:'decision',icon:'',title:'زود البروتين',sig:'exp-pro-'+week,
          text:'البروتين أقل من هدفك بحوالي '+gap+' جم؛ نضيف '+pf.n+' ل '+_slotLabel(slot),
          why:'علميا 1.6–2.2 جم/كجم بروتين يحافظ على العضل ويرفع الشبع',
          option:'أضف '+pf.n,
          decision:{type:'add',slot:slot,foodId:pickId,foodName:pf.n}});
      }
    }
  }
  if(diet!=='keto'&&diet!=='carnivore'&&dm.fat&&aF>dm.fat*1.3){
    var bs=null,bid=null,bn=null;
    for(var mi2=0;mi2<dp.meals.length&&!bid;mi2++){var ff=dp.meals[mi2].foods||[];
      for(var fi2=0;fi2<ff.length;fi2++){if(ff[fi2].cat==='fat'&&ff[fi2].id&&ff[fi2].id!=='__salad__'){bs=dp.meals[mi2].slotKey;bid=ff[fi2].id;bn=ff[fi2].name;break;}}}
    if(bid){
      notify(c,{kind:'decision',icon:'',title:'قلل الدهون',sig:'exp-fat-'+week,
        text:'الدهون أعلى من هدفك؛ نشيل '+bn+' من '+_slotLabel(bs),
        why:'تقليل الدهون الزائدة يضبط السعرات دون المساس بالبروتين',
        option:'شيل '+bn,
        decision:{type:'remove',slot:bs,foodId:bid,foodName:bn}});
    }
  }
  var bw=p.weight||latestTrend()||75;var curPT=dm.protein||0;
  var pB=proteinBounds(bw);
  if(hasCond('kidney')){
    if(curPT>pB.hi+8){
      notify(c,{kind:'decision',icon:'',title:'بروتينك أعلى من الآمن لحالتك',sig:'exp-kidney-'+week,
        text:'مع حالة الكلى نخفض هدف البروتين من '+curPT+' إلى '+pB.tgt+' جم (~0.8 جم/كجم).',
        why:'البروتين الزائد يحمل الكلى؛ المعتدل أأمن — ويفضل المتابعة مع طبيبك',
        option:'اضبط على '+pB.tgt+' جم',decision:{type:'macro',protein:pB.tgt}});
    }
  } else if(curPT&&curPT<Math.round(bw*1.8)&&(p.goal==='cut'||p.goal==='recomp'||p.goal==='bulk')){
    var newPT=Math.min(Math.round(bw*2.0), pB.hi);
    if(newPT>curPT+8){
      notify(c,{kind:'decision',icon:'',title:'اضبط ماكروز البروتين',sig:'exp-macro-'+week,
        text:'هدف البروتين الحالي '+curPT+' جم؛ نرفعه إلى '+newPT+' جم (2 جم/كجم)',
        why:'رفع البروتين يحافظ على العضل ويزيد الشبع أثناء تغيير الوزن',
        option:'ارفع البروتين إلى '+newPT+' جم',
        decision:{type:'macro',protein:newPT}});
    }
  }
  if(loggedDays()>=7){
    for(var mi3=0;mi3<dp.meals.length;mi3++){var m3=dp.meals[mi3];
      if(m3.slotKey==='lunch'||m3.slotKey==='dinner'){
        var fid=null,fnm=null;(m3.foods||[]).forEach(function(f){if(!fid&&f.cat==='protein'&&f.id){fid=f.id;fnm=f.name;}});
        if(fid){var have3=_expMealIds(m3);var alt=null;var _MP=_proteinPool('main');
          for(var ai=0;ai<_MP.length;ai++){if(_MP[ai]!==fid&&have3.indexOf(_MP[ai])<0&&findFood(_MP[ai])){alt=_MP[ai];break;}}
          if(alt){var altf=findFood(alt);
            notify(c,{kind:'decision',icon:'',title:'نوع البروتين',sig:'exp-var-'+week+'-'+m3.slotKey,
              text:'تبديل '+fnm+' ب '+altf.n+' في '+_slotLabel(m3.slotKey)+' يكسر الملل',
              why:'التنوع المضبوط داخل أطعمة صحية يحسن الالتزام والاستمرارية',
              option:'بدل إلى '+altf.n,
              decision:{type:'swap',slot:m3.slotKey,oldId:fid,newId:alt,oldName:fnm,newName:altf.n}});
          }
        }
        break;
      }
    }
  }
}

function review(){
  var c=cstateRaw();var p=profile();if(!plan())return c;
  var st=plateauStatus();var week=curWeek();var maint=maintenanceCals();var wt=workingTarget();
  var bw=latestTrend()||p.weight;
  if(st.state!=='plateau'){if(c.neatTriedWeek)c.neatTriedWeek=0;if(c.sleepTriedWeek)c.sleepTriedWeek=0;}
  // 1) التزام ضعيف - تدخل سلوكي (ليس خفض سعرات)
  if(st.state==='adherence'){
    notify(c,{kind:'decision',icon:'',title:'\u0646\u062b\u0628\u0651\u062a \u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 \u0623\u0648\u0644\u0627\u064b',
      sig:'adh-'+week,
      text:'\u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 '+st.adh+'% \u2014 \u0642\u0628\u0644 \u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0633\u0639\u0631\u0627\u062a \u0646\u062d\u062a\u0627\u062c \u062b\u0628\u0627\u062a \u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645',
      why:'\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0633\u0639\u0631\u0627\u062a \u0648\u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 < 85% \u064a\u0639\u0637\u064a \u0642\u0631\u0627\u0631\u0627\u064b \u062e\u0627\u0637\u0626\u0627\u064b\u061b \u0627\u0644\u062b\u0628\u0627\u062a \u0647\u0646\u0627 \u0633\u0644\u0648\u0643\u064a \u0648\u0644\u064a\u0633 \u0623\u064a\u0636\u064a\u0627\u064b',
      option:'\u062a\u0628\u0633\u064a\u0637 \u0627\u0644\u0648\u062c\u0628\u0627\u062a + \u062a\u0630\u0643\u064a\u0631 \u064a\u0648\u0645\u064a',decision:{type:'behavioral'}});
  }
  // 2) ثبات حقيقي - أولا NEAT ثم خفض سعرات
  if(st.state==='plateau' && !c.neatTriedWeek){
    notify(c,{kind:'decision',icon:'',title:'\u0627\u0631\u0641\u0639 \u0627\u0644\u062d\u0631\u0643\u0629 (NEAT) \u0642\u0628\u0644 \u062e\u0641\u0636 \u0627\u0644\u0623\u0643\u0644',
      sig:'neat-'+week,
      text:'\u062b\u0628\u0627\u062a \u062d\u0642\u064a\u0642\u064a \u0645\u0639 \u0627\u0644\u062a\u0632\u0627\u0645 \u062c\u064a\u062f. \u062c\u0631\u0651\u0628 +2000 \u062e\u0637\u0648\u0629/\u064a\u0648\u0645 \u0644\u0645\u062f\u0629 \u0623\u0633\u0628\u0648\u0639',
      why:'\u0627\u0644\u0639\u062c\u0632 \u064a\u062e\u0641\u0636 \u0627\u0644\u0640NEAT (Levine 2005) \u062d\u062a\u0649 50% \u0645\u0646 \u0627\u0644\u0637\u0627\u0642\u0629\u061b \u0631\u0641\u0639\u0647 \u064a\u0639\u064a\u062f \u0627\u0644\u0639\u062c\u0632 \u062f\u0648\u0646 \u062a\u062c\u0648\u064a\u0639',
      option:'\u0647\u062f\u0641 +2000 \u062e\u0637\u0648\u0629/\u064a\u0648\u0645',decision:{type:'neat',steps:2000}});
    c.neatTriedWeek=week;
  } else if(st.state==='plateau' && sleepH()<6 && !c.sleepTriedWeek){
    notify(c,{kind:'decision',icon:'',title:'ظبط نومك قبل خفض الأكل',sig:'sleep-'+week,
      text:'نومك حوالي '+sleepH()+' ساعة فقط — قلة النوم غالبا سبب الثبات. استهدف 7–8 ساعات قبل ما نخفض السعرات.',
      why:'الحرمان من النوم يرفع الجريلين والكورتيزول ويخفض اللبتين - جوع أكثر ونزول أبطأ (سلوكي مش أيضي)',
      option:'خطة تحسين النوم',decision:{type:'behavioral'}});
    c.sleepTriedWeek=week;
  } else if(st.state==='plateau' && week>c.neatTriedWeek && (sleepH()>=6 || c.sleepTriedWeek)){
    var newT=Math.max(Math.round(wt*0.91), floorCals());
    notify(c,{kind:'decision',icon:'',title:'\u062e\u0641\u0636 \u0627\u0644\u0633\u0639\u0631\u0627\u062a ~9%',
      sig:'cut-'+week,
      text:'\u0644\u0648 \u0627\u0633\u062a\u0645\u0631 \u0627\u0644\u062b\u0628\u0627\u062a \u0628\u0639\u062f \u0631\u0641\u0639 \u0627\u0644\u062d\u0631\u0643\u0629: \u0627\u062e\u0641\u0636 \u0645\u0646 '+wt+' \u0625\u0644\u0649 '+newT+' \u0633\u0639\u0631',
      why:'\u0625\u0639\u0627\u062f\u0629 \u062d\u0633\u0627\u0628 \u0627\u0644\u0640TDEE \u0631\u062c\u0639\u064a\u064b\u0627 \u062a\u0642\u062f\u0651\u0631 \u0623\u064a\u0636\u064b\u0627 \u0641\u0639\u0644\u064a\u064b\u0627 \u2248 '+(estTDEE()||'-')+' \u0633\u0639\u0631\u061b \u062e\u0641\u0636 8\u201310% \u064a\u0633\u062a\u0639\u064a\u062f \u0627\u0644\u0639\u062c\u0632 \u0628\u0623\u0645\u0627\u0646',
      option:newT+' \u0633\u0639\u0631/\u064a\u0648\u0645',decision:{type:'cal',cals:newT}});
  }
  // 3) تنشيف سريع جدا - رفع السعرات
  if(st.state==='too_fast'){
    var up=Math.round(wt*1.08);
    notify(c,{kind:'decision',icon:'\u26A0\uFE0F',title:'\u0627\u0644\u0646\u0632\u0648\u0644 \u0633\u0631\u064a\u0639 \u2014 \u0627\u0631\u0641\u0639 \u0627\u0644\u0633\u0639\u0631\u0627\u062a',
      sig:'fast-'+week,
      text:'\u0645\u0639\u062f\u0644 \u0627\u0644\u0646\u0632\u0648\u0644 '+Math.abs(st.rate)+' \u0643\u062c\u0645/\u0623\u0633\u0628\u0648\u0639 \u0623\u0633\u0631\u0639 \u0645\u0646 \u0627\u0644\u0622\u0645\u0646. \u0627\u0631\u0641\u0639 \u0625\u0644\u0649 '+up+' \u0633\u0639\u0631',
      why:'\u0627\u0644\u0646\u0632\u0648\u0644 >1% \u0648\u0632\u0646/\u0623\u0633\u0628\u0648\u0639 \u064a\u0647\u062f\u062f \u0627\u0644\u0643\u062a\u0644\u0629 \u0627\u0644\u0639\u0636\u0644\u064a\u0629 \u0648\u064a\u0633\u0631\u0651\u0639 \u0627\u0644\u062a\u0643\u064a\u0641 \u0627\u0644\u062d\u0631\u0627\u0631\u064a',
      option:up+' \u0633\u0639\u0631/\u064a\u0648\u0645',decision:{type:'cal',cals:up}});
  }
  // 3c) تضخيم: الزيادة وقفت رغم الالتزام - رفع بسيط للسعرات (تلقائي)
  if(st.state==='stall_gain'){
    var upB=Math.round(wt*1.06);
    notify(c,{kind:'decision',icon:'',title:'الزيادة وقفت — نرفع السعرات',sig:'gain-up-'+week,
      text:'الوزن مش بيزيد مع التزام كويس؛ نرفع من '+wt+' إلى '+upB+' سعر',
      why:'لو الفائض مابقاش كاف بسبب ارتفاع الأيض، رفع 5–8% يرجع النمو دون دهون زائدة',
      option:upB+' سعر/يوم',decision:{type:'cal',cals:upB}});
  }
  // 3d) تضخيم: الزيادة أسرع من الآمن - خفض الفائض (تلقائي)
  if(st.state==='too_fast_gain'){
    var dnB=Math.round(wt*0.95);
    notify(c,{kind:'decision',icon:'',title:'الزيادة سريعة — نقلل الفائض',sig:'gain-dn-'+week,
      text:'الزيادة أسرع من الآمن وغالبها دهون؛ نخفض إلى '+dnB+' سعر',
      why:'الزيادة >1% وزن/أسبوع غالبها دهون؛ فائض أقل = نمو أنظف وأقل تراكم دهون',
      option:dnB+' سعر/يوم',decision:{type:'cal',cals:dnB}});
  }
  // 3b) تقدم في المقاسات رغم ثبات الوزن - كمل بدون خفض
  if(st.state==='recomp_progress'){
    notify(c,{kind:'decision',icon:'\uD83D\uDCCF',title:'\u062c\u0633\u0645\u0643 \u0628\u064a\u062a\u063a\u064a\u0651\u0631 \u062d\u062a\u0649 \u0644\u0648 \u0627\u0644\u0648\u0632\u0646 \u062b\u0627\u0628\u062a',
      sig:'recomp-'+week,
      text:'\u0627\u0644\u062e\u0635\u0631 \u0646\u0627\u0632\u0644 ~'+Math.abs(st.waist||0)+' \u0633\u0645/\u0623\u0633\u0628\u0648\u0639 \u0645\u0639 \u062b\u0628\u0627\u062a \u0627\u0644\u0648\u0632\u0646 \u2014 \u062f\u0647 \u0641\u0642\u062f\u0627\u0646 \u062f\u0647\u0648\u0646 \u0645\u0639 \u0628\u0646\u0627\u0621 \u0639\u0636\u0644. \u0643\u0645\u0651\u0644 \u0628\u0646\u0641\u0633 \u0627\u0644\u0633\u0639\u0631\u0627\u062a',
      why:'\u0627\u0644\u0645\u064a\u0632\u0627\u0646 \u0644\u0648\u062d\u062f\u0647 \u0645\u0636\u0644\u0644 \u0623\u062b\u0646\u0627\u0621 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0631\u0643\u064a\u0628\u061b \u0645\u062d\u064a\u0637 \u0627\u0644\u062e\u0635\u0631 \u0645\u0624\u0634\u0631 \u0623\u062f\u0642 \u0639\u0644\u0649 \u062f\u0647\u0648\u0646 \u0627\u0644\u0628\u0637\u0646',
      option:'\u0623\u0643\u0645\u0644 \u0627\u0644\u062e\u0637\u0629 \u0643\u0645\u0627 \u0647\u064a',decision:{type:'maintain_plan'}});
  }
  // 4) استراحة دايت دورية
  var cutWeeks=cumulativeCutWeeks();
  if((p.goal==='cut'||p.goal==='recomp')&&cutWeeks>=8&&phaseForWeek(week).type!=='DIET_BREAK'){
    notify(c,{kind:'decision',icon:'',title:'\u062d\u0627\u0646 \u0648\u0642\u062a \u0627\u0633\u062a\u0631\u0627\u062d\u0629 \u062f\u0627\u064a\u062a',
      sig:'break-'+Math.floor(cutWeeks/8),
      text:'\u0645\u0631\u0651 ~'+cutWeeks+' \u0623\u0633\u0628\u0648\u0639 \u0639\u062c\u0632. \u0623\u0633\u0628\u0648\u0639 \u0635\u064a\u0627\u0646\u0629 \u0639\u0646\u062f '+maint+' \u0633\u0639\u0631 \u064a\u0639\u064a\u062f \u0636\u0628\u0637 \u0627\u0644\u0647\u0631\u0645\u0648\u0646\u0627\u062a',
      why:'MATADOR/Byrne 2018: \u0627\u0633\u062a\u0631\u0627\u062d\u0627\u062a \u0627\u0644\u062f\u0627\u064a\u062a \u062a\u062e\u0641\u0641 \u0627\u0644\u062a\u0643\u064a\u0641 \u0627\u0644\u062d\u0631\u0627\u0631\u064a \u0648\u062a\u062d\u0633\u0651\u0646 \u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 \u0639\u0644\u0649 \u0627\u0644\u0645\u062f\u0649 \u0627\u0644\u0628\u0639\u064a\u062f',
      option:'\u0623\u0633\u0628\u0648\u0639 \u0635\u064a\u0627\u0646\u0629 ('+maint+' \u0633\u0639\u0631)',decision:{type:'cal',cals:maint,temp:true}});
  }
  // 5) بلوغ الهدف - ريفرس/صيانة
  if(goalReached()){
    var rev=Math.round(wt*1.08);
    notify(c,{kind:'decision',icon:'',title:'\u0648\u0635\u0644\u062a \u0644\u0644\u0647\u062f\u0641 \u2014 \u0627\u0628\u062f\u0623 \u0631\u064a\u0641\u0631\u0633 \u062f\u0627\u064a\u062a',
      sig:'reverse',
      text:'\u0631\u0641\u0639 \u062a\u062f\u0631\u064a\u062c\u064a +5\u201310%/\u0623\u0633\u0628\u0648\u0639 \u0644\u0640 '+rev+' \u0633\u0639\u0631 \u0644\u062a\u062b\u0628\u064a\u062a \u0627\u0644\u0648\u0632\u0646 \u0628\u062f\u0648\u0646 \u0627\u0631\u062a\u062f\u0627\u062f',
      why:'\u0628\u0639\u062f \u0639\u062c\u0632 \u0637\u0648\u064a\u0644 \u064a\u062c\u0628 \u0631\u0641\u0639 \u0627\u0644\u0633\u0639\u0631\u0627\u062a \u062a\u062f\u0631\u064a\u062c\u064a\u064b\u0627 \u0644\u0627\u0633\u062a\u0639\u0627\u062f\u0629 REE/\u0627\u0644\u062f\u0631\u0642\u064a\u0629/\u0627\u0644\u0644\u064a\u0628\u062a\u064a\u0646',
      option:rev+' \u0633\u0639\u0631/\u064a\u0648\u0645',decision:{type:'cal',cals:rev}});
  }
  // 6) ملل/رتابة - تدوير وجبات
  if(week>=3&&loggedDays()>=10){
    notify(c,{kind:'decision',icon:'',title:'\u062f\u0648\u0651\u0631 \u0648\u062c\u0628\u0627\u062a\u0643 \u0636\u062f \u0627\u0644\u0645\u0644\u0644',
      sig:'rotate-'+Math.floor(week/3),
      text:'\u062a\u063a\u064a\u064a\u0631 \u062a\u0631\u062a\u064a\u0628 \u0648\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u0648\u062c\u0628\u0627\u062a \u062f\u0627\u062e\u0644 \u0646\u0641\u0633 \u0627\u0644\u0623\u0637\u0639\u0645\u0629 \u0627\u0644\u0635\u062d\u064a\u0629 \u064a\u062d\u0633\u0651\u0646 \u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645',
      why:'\u0627\u0644\u0631\u062a\u0627\u0628\u0629 \u062a\u062e\u0641\u0636 \u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645\u061b \u0627\u0644\u062a\u0646\u0648\u0651\u0639 \u0627\u0644\u0645\u0636\u0628\u0648\u0637 (\u0644\u0627 \u0627\u0644\u0639\u0634\u0648\u0627\u0626\u064a) \u064a\u062d\u0627\u0641\u0638 \u0639\u0644\u0649 \u0627\u0644\u0627\u0633\u062a\u0645\u0631\u0627\u0631\u064a\u0629',
      option:'\u062f\u0648\u0651\u0631 \u0627\u0644\u0648\u062c\u0628\u0627\u062a',decision:{type:'rotate'}});
  }
  // ===== وعي كامل بمدخلات المستخدم: ننفذ المناسب للحالة =====
  if((hasProb('hunger')||hasProb('satiety')||hasProb('night-hunger'))&&(p.goal==='cut'||p.goal==='recomp')){
    notify(c,{kind:'decision',icon:'',title:'حلول للجوع — قبل أي خفض',sig:'pb-hunger-'+week,
      text:'سجلت تحدي الجوع/الشبع؛ زود الخضار والبروتين والمياه ووزع الوجبات — شبع أعلى بسعرات أقل.',
      why:'البروتين والألياف والماء يرفعوا الشبع، فيسهل الالتزام بالعجز دون جوع',
      option:'فعل حلول الشبع',decision:{type:'behavioral'}});
  }
  if(hasCond('bp')){
    notify(c,{kind:'decision',icon:'',title:'ضغطك — قلل الصوديوم',sig:'pb-bp',
      text:'قلل الملح والمعلبات والمخللات، وزود البوتاسيوم (خضار وفاكهة)، واشرب مياه كفاية.',
      why:'خفض الصوديوم ورفع البوتاسيوم يدعم ضبط ضغط الدم',
      option:'تمام',decision:{type:'behavioral'}});
  }
  if(hasCond('gout')){
    notify(c,{kind:'decision',icon:'',title:'النقرس — ترطيب وبروتين معتدل',sig:'pb-gout',
      text:'قلل اللحوم الحمراء والأحشاء، واشرب مياه كتير، وخلي البروتين معتدل.',
      why:'تقليل البيورينات وزيادة الترطيب يقللوا نوبات النقرس',
      option:'تمام',decision:{type:'behavioral'}});
  }
  if(carbSensitive()){
    notify(c,{kind:'decision',icon:'',title:'حالتك حساسة للكارب — أيام الريفيد مضبوطة',sig:'pb-carbsens',
      text:'بنحد رفع الكارب في أيام الريفيد ونعتمد كارب منخفض المؤشر الجلايسيمي.',
      why:'تجنب قفزات سكر الدم مهم مع السكري/مقاومة الإنسولين/الكبد الدهني/تكيس المبايض',
      option:'تمام',decision:{type:'behavioral'}});
  }
  try{_expertReview(c,week);}catch(e){}
  c.reviewedWeek=week;persist(c);return c;
}

function cumulativeCutWeeks(){
  var p=profile();if(p.goal!=='cut'&&p.goal!=='recomp')return 0;
  return Math.max(loggedDays()>0?Math.ceil(loggedDays()/7):0, calWeek()-1);
}
function floorCals(){
  var p=profile();var bmr=p.bmr|| (p.gender==='\u0623\u0646\u062b\u0649'?1300:1600);
  var hard=(p.gender==='\u0623\u0646\u062b\u0649')?1200:1500;
  return Math.max(hard, Math.round(bmr));
}

/* تطبيق القرار */
function applyDecision(id){
  var c=cstateRaw();var n=null;for(var i=0;i<c.notif.length;i++)if(c.notif[i].id===id){n=c.notif[i];break;}
  if(!n||!n.decision)return c;var d=n.decision;
  if(_execExpert(c,d)){n.state='approved';n.read=true;persist(c);return c;}
  if(d.type==='cal'){
    var nt=clamp(d.cals,floorCals(),Math.round((profile().tdee||d.cals*1.4)*1.2));
    save('diet_target',nt);
    logEvent(c,'','\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0633\u0639\u0631\u0627\u062a \u0625\u0644\u0649 '+nt+' \u0633\u0639\u0631'+(d.temp?' (\u0645\u0624\u0642\u062a)':''));
  } else if(d.type==='neat'){
    c.neatGoal=(c.neatGoal||0)+(d.steps||2000);
    logEvent(c,'','\u0647\u062f\u0641 \u062e\u0637\u0648\u0627\u062a +'+(d.steps||2000)+'/\u064a\u0648\u0645');
  } else if(d.type==='rotate'){
    save('diet_rotate',(load('diet_rotate',0)||0)+1);
    logEvent(c,'','\u062a\u062f\u0648\u064a\u0631 \u0627\u0644\u0648\u062c\u0628\u0627\u062a \u0645\u0641\u0639\u0651\u0644');
  } else if(d.type==='maintain_plan'){
    logEvent(c,'\uD83D\uDCCF','\u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062e\u0637\u0629 \u2014 \u062a\u0642\u062f\u0651\u0645 \u0641\u064a \u0627\u0644\u0645\u0642\u0627\u0633\u0627\u062a \u0628\u062f\u0648\u0646 \u062e\u0641\u0636 \u0633\u0639\u0631\u0627\u062a');
  } else if(d.type==='behavioral'){
    logEvent(c,'','\u062e\u0637\u0629 \u062a\u062b\u0628\u064a\u062a \u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645');
  }
  n.state='approved';n.read=true;persist(c);return c;
}
function keepDecision(id){
  var c=cstateRaw();for(var i=0;i<c.notif.length;i++)if(c.notif[i].id===id){c.notif[i].state='kept';c.notif[i].read=true;}
  persist(c);return c;
}
function markAllRead(){var c=cstateRaw();for(var i=0;i<c.notif.length;i++)c.notif[i].read=true;persist(c);return c;}
function unread(){var c=cstateRaw();var n=0;for(var i=0;i<c.notif.length;i++)if(!c.notif[i].read)n++;return n;}
function pending(){var c=cstateRaw();var n=0;for(var i=0;i<c.notif.length;i++)if(c.notif[i].kind==='decision'&&c.notif[i].state==='pending')n++;return n;}

/* ============================================================
   9) التحليل والتقييم (يومي/أسبوعي/شهري)
   ============================================================ */
function analysis(scope){
  scope=scope||'week';var p=profile();var st=plateauStatus();
  var today=todayKey();var dp=dayPlan(today,curWeek());
  if(scope==='day'){
    var eaten=dayEatenCount(today);var mc=mealsCount();
    var consumed=0,pro=0;
    var L=logs()[today];
    if(dp&&L&&L.meals){for(var i=0;i<dp.meals.length;i++){if(L.meals[dp.meals[i].slotKey]){consumed+=dp.meals[i].totals.cals;pro+=dp.meals[i].totals.pro;}}}
    var score=Math.round((mc?eaten/mc:0)*100);
    return {scope:'day',score:score,
      stats:[{k:'\u0648\u062c\u0628\u0627\u062a',v:eaten+'/'+mc},{k:'\u0633\u0639\u0631\u0627\u062a',v:consumed,s:'\u0645\u0646 '+(dp?dp.totalCals:0)},{k:'\u0628\u0631\u0648\u062a\u064a\u0646',v:Math.round(pro)+'\u062c'}],
      eval:dayEvalText(score),delta:null,bars:macroBars(dp)};
  }
  if(scope==='month'){
    var ts=trendSeries();var byWk={};
    for(var j=0;j<ts.length;j++){(byWk[ts[j].week]=byWk[ts[j].week]||[]).push(ts[j].trend);}
    var chart=Object.keys(byWk).map(function(w){return {label:'\u0623'+w,val:r1(avg(byWk[w]))};});
    var first=ts.length?ts[0].trend:p.weight, last=latestTrend()||p.weight;
    var total=r1(last-first);
    return {scope:'month',score:monthScore(),
      stats:[{k:'\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u062a\u063a\u064a\u0631',v:(total>0?'+':'')+total+'\u0643\u062c\u0645'},{k:'\u0623\u064a\u0627\u0645 \u0645\u0633\u062c\u0644\u0629',v:loggedDays()},{k:'TDEE \u0641\u0639\u0644\u064a',v:(estTDEE()||'-')}],
      eval:monthEvalText(total),chart:chart,delta:null};
  }
  // week (default)
  var rate=st.rate, adh=adherenceWindow(7);
  var exp=expectedRate();
  var dlt=(rate!=null&&exp)?{dir:(p.goal==='bulk'?(rate>0):(rate<0))?'up':'down',
    txt:(rate>0?'+':'')+rate+' \u0643\u062c\u0645/\u0623\u0633\u0628\u0648\u0639 (\u0627\u0644\u0645\u0633\u062a\u0647\u062f\u0641 '+(exp>0?'+':'')+r1(exp)+')'}:null;
  return {scope:'week',score:adh,
    stats:[{k:'\u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645',v:adh+'%'},{k:'\u0648\u0632\u0646 \u0627\u0644\u0627\u062a\u062c\u0627\u0647',v:(latestTrend()||'-')+'\u0643\u062c\u0645'},{k:'\u0627\u0644\u0645\u0631\u062d\u0644\u0629',v:phaseForWeek(curWeek()).label,small:true}],
    eval:weekEvalText(st,adh),delta:dlt,bars:macroBars(dp)};
}
function macroBars(dp){
  if(!dp)return [];var m=dp.macros;
  return [{k:'\u0628\u0631\u0648\u062a\u064a\u0646',v:m.protein+'\u062c',pct:100,warn:false},
    {k:'\u0643\u0627\u0631\u0628',v:m.carbs+'\u062c',pct:clamp(m.carbs/Math.max(1,m.carbs+m.fat*2.25)*100,5,100),warn:false},
    {k:'\u062f\u0647\u0648\u0646',v:m.fat+'\u062c',pct:clamp(m.fat*2.25/Math.max(1,m.carbs+m.fat*2.25)*100,5,100),warn:false}];
}
function dayEvalText(s){if(s>=100)return '\u064a\u0648\u0645 \u0645\u0643\u062a\u0645\u0644 \u2014 \u0643\u0644 \u0627\u0644\u0648\u062c\u0628\u0627\u062a \u062a\u0645\u062a';if(s>=60)return '\u0628\u062f\u0627\u064a\u0629 \u0642\u0648\u064a\u0629 \u2014 \u0623\u0643\u0645\u0644 \u0627\u0644\u0648\u062c\u0628\u0627\u062a \u0627\u0644\u0645\u062a\u0628\u0642\u064a\u0629';return '\u0633\u062c\u0651\u0644 \u0648\u062c\u0628\u0627\u062a\u0643 \u0644\u0645\u062a\u0627\u0628\u0639\u0629 \u0623\u062f\u0642';}
function weekEvalText(st,adh){
  var map={on_track:'\u0627\u0644\u062a\u0642\u062f\u0651\u0645 \u0645\u0645\u062a\u0627\u0632 \u0648\u0641\u064a \u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0635\u062d\u064a\u062d \u2705',plateau:'\u062b\u0628\u0627\u062a \u062d\u0642\u064a\u0642\u064a \u2014 \u0631\u0627\u062c\u0639 \u062a\u0648\u0635\u064a\u0627\u062a \u0627\u0644\u0645\u062f\u0631\u0651\u0628',adherence:'\u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 \u0623\u0648\u0644\u0627\u064b \u0642\u0628\u0644 \u0623\u064a \u062a\u0639\u062f\u064a\u0644',too_fast:'\u0627\u0644\u0646\u0632\u0648\u0644 \u0633\u0631\u064a\u0639 \u2014 \u0627\u0631\u0641\u0639 \u0627\u0644\u0633\u0639\u0631\u0627\u062a \u0642\u0644\u064a\u0644\u0627\u064b',collecting:'\u0646\u062c\u0645\u0639 \u0628\u064a\u0627\u0646\u0627\u062a \u0623\u0643\u062b\u0631 \u2014 \u0633\u062c\u0651\u0644 \u0648\u0632\u0646\u0643 \u0623\u0633\u0628\u0648\u0639\u064a\u0627\u064b',too_fast_gain:'\u0627\u0644\u0632\u064a\u0627\u062f\u0629 \u0633\u0631\u064a\u0639\u0629 \u2014 \u0642\u0644\u0651\u0644 \u0627\u0644\u0641\u0627\u0626\u0636',stall_gain:'\u0627\u0644\u0632\u064a\u0627\u062f\u0629 \u062a\u0648\u0642\u0641\u062a \u2014 \u0627\u0631\u0641\u0639 \u0627\u0644\u0633\u0639\u0631\u0627\u062a',maintain:'\u062b\u0628\u0627\u062a \u0645\u0633\u062a\u0642\u0631'};
  if(st.state==='recomp_progress')return '\u0627\u0644\u0648\u0632\u0646 \u062b\u0627\u0628\u062a \u0628\u0633 \u0627\u0644\u0645\u0642\u0627\u0633\u0627\u062a \u0628\u062a\u062a\u062d\u0633\u0651\u0646 \u2014 \u0641\u0642\u062f\u0627\u0646 \u062f\u0647\u0648\u0646 \u0645\u0639 \u0639\u0636\u0644 \uD83D\uDCAA (\u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 '+adh+'%)';
  return (map[st.state]||'\u0627\u0633\u062a\u0645\u0631 \u0641\u064a \u0627\u0644\u062a\u0633\u062c\u064a\u0644')+' (\u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 '+adh+'%)';
}
function monthEvalText(total){var p=profile();if(p.goal==='bulk')return '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0632\u064a\u0627\u062f\u0629 '+total+' \u0643\u062c\u0645';return '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u062a\u063a\u064a\u0631 '+total+' \u0643\u062c\u0645 \u0639\u0628\u0631 \u0627\u0644\u0641\u062a\u0631\u0629 \u0627\u0644\u0645\u0633\u062c\u0644\u0629';}
function monthScore(){var rate=weeklyRateKg(28);var exp=expectedRate();if(rate==null||!exp)return adherenceWindow(28)||50;return clamp(Math.round((rate/exp)*100),0,100);}

/* ============================================================
   ملخص عام للهيرو/الKPIs
   ============================================================ */
function summary(){
  var p=profile();var today=todayKey();var dp=dayPlan(today,curWeek());
  var L=logs()[today]||{meals:{}};var eaten=dayEatenCount(today);var mc=mealsCount();
  var consumed=0;if(dp){for(var i=0;i<dp.meals.length;i++){if(L.meals&&L.meals[dp.meals[i].slotKey])consumed+=dp.meals[i].totals.cals;}}
  return {
    name:p.name||'\u0628\u0637\u0644 \u0627\u0644\u0635\u062d\u0629',
    week:curWeek(),phase:phaseForWeek(curWeek()),
    target:dp?dp.totalCals:workingTarget(),consumed:Math.round(consumed),
    eatenMeals:eaten,totalMeals:mc,adherenceToday:Math.round((mc?eaten/mc:0)*100),
    adherenceWeek:adherenceWindow(7),
    weight:latestTrend()||p.weight,target_weight:p.target,
    rate:plateauStatus().rate,estTDEE:estTDEE(),adaptive:adaptivePct(),
    dayType:dayType(today),refeed:dp&&dp.macros.refeed,
    waist:lastMeasure('waist'),thigh:lastMeasure('thigh'),arm:lastMeasure('arm'),
    waistRate:measureRateCm('waist',28),thighRate:measureRateCm('thigh',28),armRate:measureRateCm('arm',28),
    conditions:health(),problems:probs(),sleep:sleepH(),proteinMode:proteinBounds(latestTrend()||p.weight||75).mode,carbSensitive:carbSensitive(),
    intakeToday:getIntake(),intakeAvg14:intakeAvg(14),trackingActive:(intakeAvg(14)!=null)
  };
}

/* ============================================================
   تسجيل الأفعال (وجبة / وزن / ماء)
   ============================================================ */
function toggleMeal(slotKey,date){
  date=date||todayKey();var L=logs();L[date]=L[date]||{meals:{}};L[date].meals=L[date].meals||{};
  L[date].meals[slotKey]=!L[date].meals[slotKey];save('diet_log',L);return L[date];
}
// ── مقاسات الجسم (بطن/فخذ/زراع) — دليل أدق من الميزان على فقدان الدهون ──
function measuresLog(){return load('diet_measures',{});}
function logMeasures(m){
  if(!m||typeof m!=='object')return;
  var M=measuresLog();var d=todayKey();M[d]=M[d]||{week:curWeek()};var any=false;
  ['waist','thigh','arm'].forEach(function(k){var v=parseFloat(m[k]);if(v&&v>5&&v<300){M[d][k]=v;any=true;}});
  if(any)save('diet_measures',M);
  return any;
}
function measureSeries(field){
  var M=measuresLog();var ds=Object.keys(M).sort();var out=[];
  ds.forEach(function(d){if(M[d]&&M[d][field]!=null)out.push({date:d,val:M[d][field]});});
  return out;
}
function lastMeasure(field){var s=measureSeries(field);return s.length?s[s.length-1].val:null;}
// معدل تغير المقاس (سم/أسبوع) عبر آخر نافذة أيام (سالب = نقصان محيط)
function measureRateCm(field,days){
  days=days||28;var s=measureSeries(field);if(s.length<2)return null;
  var last=s[s.length-1], cutoff=new Date(last.date);cutoff.setDate(cutoff.getDate()-days);
  var first=s[0];for(var i=s.length-1;i>=0;i--){if(new Date(s[i].date)<=cutoff){first=s[i];break;}}
  var dd=daysBetween(first.date,last.date);if(dd<5)return null;
  return Math.round(((last.val-first.val)/dd)*7*10)/10;
}
// هل البطن (المؤشر الأهم للدهون) بينزل فعليا؟
function waistTrendingDown(){var r=measureRateCm('waist',28);return r!=null&&r<=-0.2;}
function anyMeasureImproving(){
  var p=profile();var bulk=(p.goal==='bulk');
  return ['waist','thigh','arm'].some(function(f){var r=measureRateCm(f,28);if(r==null)return false;
    if(f==='waist')return r<=-0.2; // الخصر ينزل = دهون أقل
    return bulk?r>=0.2:false;});
}
function logWeight(kg,measures){
  if(measures)logMeasures(measures);
  kg=parseFloat(kg);
  if(kg&&kg>=25&&kg<=400){
    var w=load('diet_weights',[]);var d=todayKey();var found=false;
    for(var i=0;i<w.length;i++){if(w[i].date===d){w[i].weight=kg;found=true;}}
    if(!found)w.push({date:d,week:curWeek(),weight:kg});
    save('diet_weights',w);
    try{curWeek();}catch(_wk){}   // تسجيل وزن جديد يقدم الأسبوع فورا بالبيانات
    var c=cstateRaw();logEvent(c,'\u2696\uFE0F','\u062a\u0633\u062c\u064a\u0644 \u0648\u0632\u0646 '+kg+' \u0643\u062c\u0645');
    if(measures&&(measures.waist||measures.thigh||measures.arm))logEvent(c,'\uD83D\uDCCF','\u062a\u0633\u062c\u064a\u0644 \u0645\u0642\u0627\u0633\u0627\u062a \u0627\u0644\u062c\u0633\u0645');
    persist(c);
  } else if(measures){
    var c2=cstateRaw();logEvent(c2,'\uD83D\uDCCF','\u062a\u0633\u062c\u064a\u0644 \u0645\u0642\u0627\u0633\u0627\u062a \u0627\u0644\u062c\u0633\u0645');persist(c2);
  }
  return weights();
}
function setWater(n){var w=water();w[todayKey()]=clamp(n,0,12);save('diet_water',w);return w[todayKey()];}
function getWater(){return water()[todayKey()]||0;}

/* التحفيز اليومي */
var MOTIV=['\u0627\u0644\u0627\u0633\u062a\u0645\u0631\u0627\u0631\u064a\u0629 \u0623\u0642\u0648\u0649 \u0645\u0646 \u0627\u0644\u0643\u0645\u0627\u0644','\u062c\u0633\u0645\u0643 \u064a\u0633\u0645\u0639 \u0643\u0644 \u0648\u062c\u0628\u0629 \u0635\u062d\u064a\u0629','\u0627\u0644\u0628\u0631\u0648\u062a\u064a\u0646 \u0635\u062f\u064a\u0642 \u0634\u0628\u0639\u0643 \u0648\u0639\u0636\u0644\u0627\u062a\u0643','\u0627\u0644\u0645\u064a\u0632\u0627\u0646 \u064a\u0643\u0630\u0628 \u064a\u0648\u0645\u064a\u0627\u064b\u060c \u0648\u064a\u0635\u062f\u0642 \u0623\u0633\u0628\u0648\u0639\u064a\u0627\u064b','\u0627\u0644\u062b\u0628\u0627\u062a \u062c\u0632\u0621 \u0645\u0646 \u0627\u0644\u0631\u062d\u0644\u0629\u060c \u0644\u064a\u0633 \u0641\u0634\u0644\u0627\u064b','\u0627\u0634\u0631\u0628 \u0645\u0627\u0621 \u0623\u0643\u062b\u0631\u060c \u062a\u062c\u0648\u0639 \u0623\u0642\u0644','\u0627\u0644\u0646\u0648\u0645 \u0627\u0644\u062c\u064a\u062f = \u0647\u0631\u0645\u0648\u0646\u0627\u062a \u0623\u0641\u0636\u0644','\u062e\u0637\u0648\u0627\u062a\u0643 \u0627\u0644\u064a\u0648\u0645\u064a\u0629 \u062a\u062d\u0631\u0642 \u0623\u0643\u062b\u0631 \u0645\u0645\u0627 \u062a\u0638\u0646'];
var MOTIV2=['الاستمرارية أقوى من الكمال — يوم ناقص مش نهاية العالم','جسمك بيتغير بهدوء، صبرك هو اللي بيكمل الرحلة','البروتين بيشبعك ويحمي عضلاتك، خليه في كل وجبة','الميزان بيكذب يوم بيوم، بص للاتجاه على مدار الأسبوع','الثبات مرحلة طبيعية مش فشل — كمل وهيتحرك','اشرب مياه أكتر، نص الجوع غالبا عطش','نومك الكويس بيظبط هرمونات الجوع ويسهل النزول','خطواتك اليومية بتحرق أكتر مما تتخيل، اتحرك','وجبة وحشة مش بتفرق، أسبوع كامل وحش هو اللي بيفرق','جهز أكلك بدري عشان متاخدش قرارات وانت جعان','قلل السكر المضاف الأول، هو أسرع مكسب','الخضار بيملا معدتك بسعرات قليلة، أكتر منه','التمرين بيبني العضل، والأكل بيحدد النتيجة — الاتنين مهمين','قارن نفسك بنفسك إمبارح، مش بأي حد تاني','النتيجة بتيجي من المجموع، مش من اليوم المثالي','لو زهقت من أكلة، بدلها بصحية مكانها — التنوع بيثبتك','راحة الدايت كل فترة بتساعد نفسيا وهرمونيا','المقاسات أصدق من الميزان وقت الثبات','ابدأ صغير واثبت عليه، العادة أهم من الحماس','كل خطوة صح النهاردة بتقربك من جسمك اللي نفسك فيه'];
function motiv(){return MOTIV2[new Date().getDate()%MOTIV2.length];}

/* ============================================================
   تعديل الوجبات: إضافة/حذف صنف + إعادة الحساب والموازنة
   (يعتمد على window.FOOD_INDEX المحمل في dashboard.html)
   ============================================================ */
function foodIndex(){return (typeof window!=='undefined'&&window.FOOD_INDEX)||[];}
function findFood(id){var FI=foodIndex();for(var i=0;i<FI.length;i++)if(FI[i].id===id)return FI[i];return null;}
// أشهر الأطعمة الشائعة عند المصريين (تطفو لأعلى الاقتراحات)
function _isCommonEgy(n){return /بيض|جبن|قريش|فول|طعمية|عيش|أرز|رز|فراخ|صدور|تونة|بلطي|سمك|بطاطس|بطاطا|زبادي|لبن|طماطم|خيار|سلطة|موز|تفاح|برتقال|مكرونة|عدس|شوفان|خبز/.test(n||'');}
function searchFoods(q,cat,slot){
  var FI=foodIndex();q=(q||'').trim();
  var p=(typeof profile==='function'?profile():null)||{};
  var lowCarb=(p.diet==='lowcarb'||p.diet==='keto');
  var KNOWN={breakfast:1,lunch:1,dinner:1,snack:1,snack2:1,pre:1,post:1};
  var useSlot=(slot&&KNOWN[slot])?slot:null;
  var hasQ=!!q;
  var out=FI.filter(function(f){
    if(cat&&cat!=='all'&&f.c!==cat)return false;
    if(hasQ)return ((f.n||'')+'').indexOf(q)>=0;
    if(f.c==='protein' && /لانشون|سجق|سوسيس|بانيه|بانية|برجر|ناجتس|بسطرمة|بسطرمه|هوت دوج|هوتدوج|شاورما/.test(f.n||'')) return false; // [EGY] مصنع صناعي مخفي من اقتراحات التصفح (يظهر بالبحث بالاسم فقط)
    // بدون بحث: نعرض فقط الأطعمة المناسبة للوجبة الحالية (حسب mt)
    if(useSlot&&f.mt&&f.mt.length&&f.mt.indexOf(useSlot)<0)return false;
    return true;
  });
  function score(f){
    var s=0;
    if(useSlot&&f.mt&&f.mt.indexOf(useSlot)>=0)s+=100;     // مناسب للوجبة
    if(_isCommonEgy(f.n))s+=40;                            // شائع عند المصريين
    if(lowCarb&&f.c==='carb')s-=70;                        // النظام منخفض الكارب
    if(lowCarb&&f.c==='snack'&&(f.cb||0)>15)s-=40;
    return s;
  }
  out=out.slice().sort(function(a,b){return score(b)-score(a);});
  return out.slice(0,50);
}
function _slotLabel(k){var M={breakfast:'\u0627\u0644\u0641\u0637\u0627\u0631',lunch:'\u0627\u0644\u063A\u062F\u0627\u0621',dinner:'\u0627\u0644\u0639\u0634\u0627\u0621',snack:'\u0633\u0646\u0627\u0643',snack2:'\u0633\u0646\u0627\u0643 \u0645\u0633\u0627\u0626\u064A',pre:'\u0642\u0628\u0644 \u0627\u0644\u062A\u0645\u0631\u064A\u0646',post:'\u0628\u0639\u062F \u0627\u0644\u062A\u0645\u0631\u064A\u0646'};return M[k]||k;}
// حصص واقعية لكل نوع طعام (نفس منطق جسر بناء الخطة)
function _serv(f){
  var n=((f.n||'')+'');var c=f.c||'';
  if(/\u0628\u064a\u0636/.test(n))return{base:100,step:50,min:50,max:150};
  if(/\u062c\u0628\u0646|\u0642\u0631\u064a\u0634/.test(n))return{base:40,step:10,min:20,max:90};
  if(/\u062a\u0648\u0633\u062a|\u062e\u0628\u0632|\u0639\u064a\u0634|\u0631\u063a\u064a\u0641|\u0628\u0642\u0633\u0645\u0627\u0637/.test(n))return{base:60,step:30,min:30,max:120};
  if(/\u0641\u0648\u0644/.test(n))return{base:180,step:30,min:120,max:260};
  if(/\u0632\u0628\u0627\u062f\u064a|\u0644\u0628\u0646|\u062d\u0644\u064a\u0628|\u0631\u0648\u0628/.test(n))return{base:170,step:30,min:100,max:250};
  if(/\u0632\u064a\u062a|\u0633\u0645\u0646/.test(n))return{base:10,step:5,min:5,max:20};
  if(/\u0645\u0643\u0633\u0631\u0627\u062a|\u0644\u0648\u0632|\u0639\u064a\u0646 \u062c\u0645\u0644|\u0641\u0633\u062a\u0642|\u0643\u0627\u062c\u0648|\u0633\u0648\u062f\u0627\u0646\u064a/.test(n))return{base:25,step:5,min:10,max:45};
  if(/\u0639\u0633\u0644|\u0645\u0631\u0628\u0649|\u0637\u062d\u064a\u0646\u0629|\u062d\u0644\u0627\u0648\u0629/.test(n))return{base:20,step:5,min:10,max:40};
  switch(c){
    case 'protein':return{base:130,step:20,min:70,max:230};
    case 'carb':return{base:90,step:20,min:40,max:230};
    case 'dairy':return{base:160,step:30,min:100,max:250};
    case 'fruit':return{base:130,step:20,min:80,max:230};
    case 'fat':return{base:15,step:5,min:5,max:30};
    case 'snack':return{base:35,step:10,min:15,max:70};
    case 'veggie':return{base:80,step:20,min:40,max:160};
    default:return{base:100,step:20,min:40,max:220};
  }
}
function _roundServe(g,sv){g=Math.round(g/sv.step)*sv.step;return clamp(g,sv.min,sv.max);}
function _calsOf(f,g){return (f.cal||0)*g/100;}
// تنظيف علمي عام لأي عنصر وأي دايت - مبني على الفئة لا الاسم
// قواعد علمية لكل وجبة: protein<=2, dairy<=1, carb<=2, fat<=1, fruit<=1(رئيسي)/2(سناك), veggie=unlim, snack<=1
function _smartDedup(foods,slotKey){
  var isSnack=(slotKey==='snack'||slotKey==='snack2');
  var isPre=(slotKey==='pre');
  var isPost=(slotKey==='post');
  // قبل التمرين: رتب الكرب البسيط (فاكهة+تمر) أولا عشان يختار قبل الكرب المركب (رز، خبز)
  if(isPre){
    var preOrder={fruit:0,snack:1,protein:2,dairy:3,veggie:4,carb:5,fat:6};
    foods=foods.slice().sort(function(a,b){
      return (preOrder[a.c]!=null?preOrder[a.c]:9)-(preOrder[b.c]!=null?preOrder[b.c]:9);
    });
  }
  var catLimits={
    protein: 1,
    dairy:   1,
    // كرب واحد للوجبات العادية - بعد التمرين ممكن اثنين (تعويض غلايكوجين)
    carb:    isPost?2:1,
    fat:     1,
    // قبل التمرين: فاكهتين (موز+تمر) + سناك اثنين (قهوة+غيره)
    fruit:   isPre?2:(isSnack?2:1),
    snack:   isPre?2:1,
    veggie:  99
  };
  var counts={};
  foods=foods.filter(function(f){
    var c=f.c||'';
    var lim=catLimits[c];
    if(lim==null)return true;
    counts[c]=(counts[c]||0)+1;
    return counts[c]<=lim;
  });
  var slotMax={breakfast:4,lunch:5,dinner:5,snack:3,snack2:3,pre:4,post:4};
  var max=slotMax[slotKey||'']||5;
  if(foods.length>max)foods=foods.slice(0,max);
  return foods;
}// يبني عناصر وجبة من قائمة IDs بحصص واقعية + تجميع السلطة، ويوازن للميزانية لو محددة
function buildMealFoods(ids,budget,slotKey){
  var foods=ids.map(function(id){return findFood(id);}).filter(Boolean);
  if(!foods.length)return {foods:[],totals:{cals:0,pro:0,carb:0,fat:0},ids:[]};
  foods=_smartDedup(foods,slotKey);
  var veg=foods.filter(function(f){return f.c==='veggie';});
  var asSalad=veg.length>=2;
  var saladBase=0,saladPortions=[];
  if(asSalad){veg.forEach(function(f){var sv=_serv(f);saladPortions.push({f:f,g:sv.base});saladBase+=_calsOf(f,sv.base);});}
  var indiv=asSalad?foods.filter(function(f){return f.c!=='veggie';}):foods;
  var items=indiv.map(function(f){var sv=_serv(f);return {f:f,sv:sv,g:sv.base};});
  var baseCals=items.reduce(function(a,it){return a+_calsOf(it.f,it.g);},0);
  if(budget){
    var target=Math.max(120,budget-saladBase);
    var ratio=baseCals>0?target/baseCals:1;ratio=clamp(ratio,0.55,1.7);
    items.forEach(function(it){it.g=_roundServe(it.sv.base*ratio,it.sv);});
  }
  var order={protein:0,carb:1,dairy:2,fruit:3,fat:4,snack:5};
  items.sort(function(a,b){return (order[a.f.c]==null?9:order[a.f.c])-(order[b.f.c]==null?9:order[b.f.c]);});
  var mfoods=items.map(function(it){var sc=it.g/100;return {id:it.f.id,name:it.f.n,grams:Math.round(it.g),cals:Math.round((it.f.cal||0)*sc),pro:r1((it.f.p||0)*sc),carb:r1((it.f.cb||0)*sc),fat:r1((it.f.ft||0)*sc),cat:it.f.c};});
  if(asSalad){
    var sg=0,sc2=0,sp=0,scb=0,sf=0,names=[],vids=[];
    saladPortions.forEach(function(p){var r=p.g/100;sg+=p.g;sc2+=(p.f.cal||0)*r;sp+=(p.f.p||0)*r;scb+=(p.f.cb||0)*r;sf+=(p.f.ft||0)*r;names.push(p.f.n);vids.push(p.f.id);});
    mfoods.push({id:'__salad__',ids:vids,name:'\uD83E\uDD57 \u0633\u0644\u0637\u0629 \u062e\u0636\u0631\u0627\u0621',sub:names.join(' + '),grams:Math.round(sg),cals:Math.round(sc2),pro:r1(sp),carb:r1(scb),fat:r1(sf),cat:'veggie'});
  }
  var tot=mfoods.reduce(function(a,f){a.cals+=f.cals;a.pro+=f.pro;a.carb+=f.carb;a.fat+=f.fat;return a;},{cals:0,pro:0,carb:0,fat:0});
  return {foods:mfoods,totals:{cals:Math.round(tot.cals),pro:r1(tot.pro),carb:r1(tot.carb),fat:r1(tot.fat)},ids:ids.slice()};
}
function slotIds(slotKey){
  var sel=load('diet_user_meals',null);
  if(sel&&sel[slotKey]&&sel[slotKey].length)return sel[slotKey].slice();
  var pl=plan();if(pl&&pl.meals){
    for(var i=0;i<pl.meals.length;i++){var m=pl.meals[i];if((m.slotKey||m.label)===slotKey){
      var ids=[];(m.foods||[]).forEach(function(f){
        if(f.ids&&f.ids.length){ids=ids.concat(f.ids);}
        else if(f.id&&f.id!=='__salad__'){ids.push(f.id);}
        else if(f.name){var mt=foodIndex().filter(function(x){return x.n===f.name;});if(mt[0])ids.push(mt[0].id);}
      });
      return ids;
    }}
  }
  return [];
}
function saveSlotIds(slotKey,ids){var sel=load('diet_user_meals',{})||{};sel[slotKey]=ids;save('diet_user_meals',sel);}
// [EGY-v64] ملاحظات خبير التغذية (تفكير النظام) — يقرأها الخبير في الداشبورد
try{window.ELF_NUTRITION_NOTES={
 pairing:{
  bread:"العيش (بلدي/أسمر/توست أسمر/قمح كامل): فطار جنب بيض أو جبنة أو فول أو تونة، وجنب السمك والمشويات (كفتة/كبدة/كباب).",
  rice:"الأرز (أبيض/بسمتي/بني): جنب السمك والبروتين الحيواني (فراخ/لحمة).",
  pasta:"المكرونة: جنب الفراخ واللحوم فقط — مش مع الأسماك.",
  fruit:"الفاكهة: سناك صحي أو عشاء خفيف مع زبادي، حسب الموسم فقط.",
  cookedVeg:"الخضار المطبوخ: جنب الأرز أو بديل للأرز مع البروتين كمصدر كارب صحي."
 },
 snacks:"سناك صحي مع فاكهة أو زبادي: شوكولاتة دارك، ترمس مسلوق، فشار بالزيت، سوداني محمص، لب قرع محمص، لب عباد محمص.",
 fats:{
  oliveOil:"زيت زيتون جنب سلطة أو جبنة أو فول.",
  butter:"زبدة على بيض أومليت أو فول.",
  peanutButter:"زبدة فول سوداني مع توست أسمر وعسل — قبل التمرين أو سناك.",
  tahini:"طحينة جنب السمك أو المشويات لو محتاج دهون (كمية معقولة).",
  honey:"عسل أبيض: فطار أو سناك مع توست أسمر أو قبل التمرين."
 },
 preWorkout:"قبل التمرين = ٤ توليفات فقط + قهوة سادة، وممنوع أي فاكهة تانية: (موز+تمر+قهوة) أو (زبيب+موز+قهوة) أو (تمر+شوكولاتة دارك+قهوة) أو (شوكولاتة دارك+موز+قهوة).",
 proteinRepeat:"البروتين الأساسي في الوجبات الرئيسية (غدا/عشا/بعد التمرين) يتكرر ~70% — نفس المصدر، وبعد التمرين نفس بروتين الغدا؛ ما ينفعش بروتين جديد فجأة.",
 breakfastDairy:"الفطار: الأولوية للجبنة (قريش/رودس جولد/بيضاء/رومي) عن الزبادي عشان الشبع. الزبادي مكانه العشا (مع بيضة وجبنة) أو مع فاكهة.",
 priority:"أولوية اختيار العناصر بترتيب المستخدم: البروتين (صدر فراخ ثم ورك فراخ...)، الكارب (أرز أبيض ثم بسمتي...)، الجبن (قريش ثم رودس جولد...).",
 salad:"سلطة أساسية: خيار + طماطم + عنصرين من (خس/كرنب/فلفل/جزر/بقدونس/جرجير/حمص مسلوق).",
 fallbackVeg:"لو المستخدم ما حددش أصناف: استخدم خضار مطبوخ صحي — بسلة بالجزر، فاصوليا، لوبيا، بامية، كوسة، عدس بجبة، شوربة عدس أصفر، ملوخية.",
 calorieBuffer:"النظام بيطبق هامش أمان داخلي مخفي +10% على سعرات الخطة كلها موزع بالتساوي (فيحافظ على نسب الماكروز)؛ فالأكل الفعلي المقدم أقل ~9% من الأرقام المعروضة عمدا لتعويض السعرات المخفية اللي بيضيفها المستخدم (زيت/صوص/كميات زيادة). ده داخلي فقط وغير ظاهر — العرض بيفضل على الهدف الأصلي. الخبير لازم يفهم إن الكميات الفعلية أقل شوية من المعروض عن قصد كطبقة حماية للخطة.",
 seasonality:"امنع الفاكهة خارج موسمها تماما. صيفي: بطيخ/شمام/مانجو/عنب/خوخ/مشمش/تين/تين شوكي. شتوي: برتقال/يوسفي/جوافة/كمثرى/رمان/فراولة/كاكا. طول السنة: تفاح/موز."
};}catch(e){}
// [EGY-v52.10] الخبير لازم يفهم كل قواعد الإقران المصري لما يعدل الخطة
function _egyProtKindCoach(food){
  var t=((food&&food.n)||'')+' '+((food&&food.id)||'');
  if(/تونة|twna|tuna/.test(t))return 'tuna';
  if(/سمك|smk|بلطي|blty|بوري|bwry|ماكريل|makryl|سردين|srdyn|سلمون|slmwn|قاروص|qarws|دنيس|dnys|موسى|mwsa|مرجان|بربوني|بلاميط|سنجاري|وقار|رنجة|rnja|فسيخ|fsykh|فيليه|fylyh|جمبري|jmbry|كابوريا|سبيط|كاليمار|قراميط|شاخروه|أنشوجة/.test(t))return 'fish';
  if(/فراخ|frakh|صدر|sdr|ورك|wrk|جناح|jnah|كبد|kbd|بانيه|banyh|شاورما|shawrma|كفتة|kfta|كباب|kbab|لحم|lhm|بقري|bqry|مفروم|mfrwm|ضاني|dany|ستيك|روست|rwst|سجق|sjq|بسطرم|bstrm|شيش|shysh|برجر|brjr|حواوشي|hwawshy|تشيكن/.test(t))return 'meat';
  return 'other';
}
function _coachFindCarb(rx){
  var FI=foodIndex();
  for(var i=0;i<FI.length;i++){var f=FI[i];if(f.c==='carb'&&rx.test((f.n||'')+' '+(f.id||'')))return f.id;}
  return null;
}
function _egyFixPairing(ids,slotKey){
  if(!ids||!ids.length)return ids;
  if(slotKey!=='lunch'&&slotKey!=='dinner'&&slotKey!=='post')return ids;
  var foods=ids.map(findFood).filter(Boolean);
  (function(){var _sm=/أرز|ارز|arz|مكرون|mkrwn|كشري|kshry|شعري|shary|باستا|basta|عيش|توست|خبز|رغيف|aysh|twst|khbz/;var _pt=/بطاطس|بطاطا|btats|btata/;var hasMain=foods.some(function(f){return f&&f.c==='carb'&&_sm.test((f.n||'')+' '+(f.id||''));});if(hasMain){var potIds={};foods.forEach(function(f){if(f&&f.c==='carb'&&_pt.test((f.n||'')+' '+(f.id||'')))potIds[f.id]=1;});if(Object.keys(potIds).length){ids=ids.filter(function(x){return !potIds[x];});foods=ids.map(findFood).filter(Boolean);}}})();
  var prot=null;for(var i=0;i<foods.length;i++){if(foods[i].c==='protein'){prot=foods[i];break;}}
  if(!prot)return ids;
  var pk=_egyProtKindCoach(prot);
  if(pk==='other')return ids;
  var heavyRx=/أرز|ارز|arz|مكرون|mkrwn|كشري|kshry|شعري|shary|باستا|basta/;
  var breadRx=/عيش|توست|خبز|aysh|twst/;
  var out=ids.slice();
  function swapCarb(fromRx,toId){
    if(!toId)return;
    foods.forEach(function(f){
      if(f.c==='carb'&&fromRx.test((f.n||'')+' '+(f.id||''))){
        out=out.filter(function(x){return x!==f.id;});
        if(out.indexOf(toId)<0)out.push(toId);
      }
    });
  }
  if(pk==='tuna'){
    swapCarb(heavyRx,_coachFindCarb(/عيش بلدي|ayshbldy/)||_coachFindCarb(/عيش أسمر|ayshasmr/)||_coachFindCarb(breadRx));
    var hasFat=foods.some(function(f){return f.c==='fat';});
    if(!hasFat&&slotKey!=='post'&&out.indexOf('thyna')<0)out.push('thyna');
  }else if(pk==='meat'){
    swapCarb(breadRx,_coachFindCarb(/أرز أبيض|arzabyd/)||_coachFindCarb(/بسمتي|bsmty/)||_coachFindCarb(heavyRx));
  }else if(pk==='fish'){
    swapCarb(/مكرون|mkrwn|كشري|kshry|شعري|shary|باستا|basta/,_coachFindCarb(/عيش بلدي|ayshbldy/)||_coachFindCarb(breadRx)||_coachFindCarb(/أرز|arz/));
  }
  return out;
}
function _userEditedSlot(slotKey){try{var sel=load('diet_user_meals',null);return !!(sel&&sel[slotKey]&&sel[slotKey].length);}catch(e){return false;}}
function _extractSlotIds(meal){var ids=[];(meal&&meal.foods||[]).forEach(function(f){if(f.ids&&f.ids.length){ids=ids.concat(f.ids);}else if(f.id&&f.id!=='__salad__'){ids.push(f.id);}});return ids;}
function materializeSlot(slotKey,date,week){
  try{
    if(_userEditedSlot(slotKey))return false;
    if(typeof dayPlan!=='function')return false;
    var dp=dayPlan(date||todayKey(),week||curWeek());
    if(!dp||!dp.meals)return false;
    var meal=null;for(var i=0;i<dp.meals.length;i++){if(dp.meals[i].slotKey===slotKey){meal=dp.meals[i];break;}}
    if(!meal)return false;
    var ids=_extractSlotIds(meal);
    if(ids.length){saveSlotIds(slotKey,ids);return true;}
    return false;
  }catch(e){return false;}
}
// [EGY-v64.2] أول أي تعديل يدوي: جمد كل الوجبات المعروضة زي ما هي، فالتعديل يمس وجبته بس وما يغيرش حاجة تانية
function materializeAllSlots(date,week){
  try{
    if(typeof dayPlan!=='function')return;
    var dp=dayPlan(date||todayKey(),week||curWeek());
    if(!dp||!dp.meals)return;
    var sel=load('diet_user_meals',{})||{};var changed=false;
    dp.meals.forEach(function(meal){
      var sk=meal.slotKey;if(!sk)return;
      if(sel[sk]&&sel[sk].length)return;
      var ids=_extractSlotIds(meal);
      if(ids.length){sel[sk]=ids;changed=true;}
    });
    if(changed)save('diet_user_meals',sel);
  }catch(e){}
}
function editMeal(slotKey,action){
  var pl=plan();if(!pl||!pl.meals)return {ok:false};
  var ids=slotIds(slotKey);
  if(action.add){if(ids.indexOf(action.add)<0)ids.push(action.add);}
  else if(action.remove){ids=ids.filter(function(x){return x!==action.remove;});}
  else if(action.removeSalad){ids=ids.filter(function(x){var f=findFood(x);return !(f&&f.c==='veggie');});}
  else if(action.replace){ids=ids.filter(function(x){return x!==action.replace.old;});if(ids.indexOf(action.replace.new)<0)ids.push(action.replace.new);}
  ids=_egyFixPairing(ids,slotKey);
  saveSlotIds(slotKey,ids);
  var built=buildMealFoods(ids,null,slotKey);
  var found=false;
  for(var i=0;i<pl.meals.length;i++){var m=pl.meals[i];if((m.slotKey||m.label)===slotKey){
    m.foods=built.foods;m.totals=built.totals;m.targetCals=built.totals.cals;found=true;break;}}
  if(!found){pl.meals.push({slotKey:slotKey,label:_slotLabel(slotKey),foods:built.foods,totals:built.totals,targetCals:built.totals.cals});}
  pl.targetCals=pl.meals.reduce(function(a,m){return a+((m.totals&&m.totals.cals)||m.targetCals||0);},0);
  pl.fromSelections=true;save('diet_plan',pl);
  return {ok:true,meal:built};
}
function rebalancePlan(date,week){
  var pl=plan();if(!pl||!pl.meals)return {ok:false};
  var dm=dayMacros(date,week);
  var totalNow=pl.meals.reduce(function(a,m){return a+((m.totals&&m.totals.cals)||0);},0)||1;
  pl.meals.forEach(function(m){
    var share=((m.totals&&m.totals.cals)||0)/totalNow;
    var budget=Math.round(dm.cals*share);
    var ids=slotIds(m.slotKey||m.label);
    ids=_egyFixPairing(ids,m.slotKey||m.label);
    var built=buildMealFoods(ids,budget,m.slotKey||m.label);
    if(built.foods.length){m.foods=built.foods;m.totals=built.totals;m.targetCals=built.totals.cals;}
  });
  pl.targetCals=pl.meals.reduce(function(a,m){return a+((m.totals&&m.totals.cals)||0);},0);
  save('diet_plan',pl);return {ok:true};
}
/* اقتراح دهون ذكي: يفحص كل وجبة ويقترح مصدر دهون لو مفيش */
function suggestFat(slotKey,foods){
  var totalFat=(foods||[]).reduce(function(a,f){return a+(f.fat||0);},0);
  if(totalFat>=4)return null; // كفاية دهون
  var slot=(slotKey||'').toLowerCase();
  if(/post/.test(slot))return null; // بعد التمرين: الدهون بتبطئ امتصاص البروتين
  // نختار المصدر حسب الوجبة
  if(/pre/.test(slot))return {id:'swdany_mhms',name:'\u0633\u0648\u062f\u0627\u0646\u064a \u0645\u062d\u0645\u0635',grams:20,note:'\u0637\u0627\u0642\u0629 \u062f\u0647\u0646\u064a\u0629 \u0645\u062f\u0631\u0648\u0633\u0629 \u0642\u0628\u0644 \u0627\u0644\u062a\u0645\u0631\u064a\u0646'};
  if(/snack/.test(slot))return {id:'lwz_mhms',name:'\u0644\u0648\u0632 \u0645\u062d\u0645\u0635',grams:15,note:'\u062f\u0647\u0648\u0646 \u0635\u062d\u064a\u0629 \u0644\u0644\u0633\u0646\u0627\u0643'};
  // فطار/غداء/عشاء = زيت زيتون
  var slotLabels={breakfast:'\u0641\u0637\u0627\u0631',lunch:'\u063a\u062f\u0627\u0621',dinner:'\u0639\u0634\u0627\u0621'};
  var lbl=slotLabels[slot]||slotLabels.breakfast;
  return {id:'zytzytwn',name:'\u0632\u064a\u062a \u0632\u064a\u062a\u0648\u0646',grams:5,note:'\u062f\u0647\u0648\u0646 \u0623\u0648\u0645\u064a\u062c-9 \u0645\u0641\u064a\u062f\u0629 \u0644\u0640 '+lbl};
}
// اقتراح ذكي لإكمال الدهون الناقصة — واع بالنظام الغذائي وحجم الوجبة والماكروز
function suggestFatSmart(slotKey,foods){
  foods=foods||[];
  var slot=(slotKey||'').toLowerCase();
  if(/post/.test(slot))return null; // بعد التمرين: الدهون تبطئ امتصاص البروتين
  var p=profile();var diet=(p&&p.diet)||'balanced';
  var ketoLike=(diet==='keto'||diet==='carnivore');
  var lowCarb=(diet==='lowcarb');
  var mealCals=foods.reduce(function(a,f){return a+(f.cals||0);},0);
  var curFat=foods.reduce(function(a,f){return a+(f.fat||0);},0);
  if(mealCals<=0)return null;
  // نسبة الدهون المثالية من سعرات الوجبة تختلف حسب النظام
  var fatPct=ketoLike?0.6:(lowCarb?0.35:0.25);
  if(/pre/.test(slot))fatPct=ketoLike?0.35:0.08; // قبل التمرين: طاقة سريعة ودهون أقل
  var targetFatG=mealCals*fatPct/9;
  // البروتينات المطبوخة (فراخ/لحمة/سمك/تونة) غالبا فيها زيت طبخ مش محسوب — نقدره
  // عشان ما نتخمش الوجبة بدهون زيادة، وساعات ما نضيفش حاجة أصلا
  var hiddenFat=0;
  for(var hi=0;hi<foods.length;hi++){var hn=(foods[hi].name||'')+'';
    if(/مقلي|بانيه|باني|قلي|محمر/.test(hn))hiddenFat+=8;
    else if(/مشوي|كفتة|كباب|شاورما|ريش|سمك|سلمون|سردين/.test(hn))hiddenFat+=4;
    else if(/فراخ|دجاج|لحم|بفتيك|تونة|تونه/.test(hn))hiddenFat+=3;
  }
  var effFat=curFat+hiddenFat; // الدهون الفعلية تقريبا بعد حساب زيت الطبخ
  if(effFat>=targetFatG*0.75)return null; // الوجبة غالبا فيها دهون كفاية — ما نضيفش
  var deficit=targetFatG-effFat;
  if(deficit<3)return null; // الفرق ضئيل لا يستحق إضافة
  // حدد صنفا مناسبا داخل الوجبة نلصق به الدهون — مش أي صنف بياخد دهون حرة
  // الكارب (رز/عيش/مكرونة) والفاكهة ماينفعش نكب عليهم زيت، والمشويات بتتحب لها طحينة
  function classify(){
    var grill=null,oil=null,hasVeg=false;
    for(var i=0;i<foods.length;i++){var nm=(foods[i].name||'')+'';
      if(/مشوي|كفتة|كباب|شاورما|ريش|سمك|سلمون|سردين/.test(nm))grill=grill||nm;
      if(/سلط|خضار|جرجير|خس/.test(nm)){oil=oil||'للسلطة';hasVeg=true;continue;}
      if(/فول/.test(nm)){oil=oil||'للفول';continue;}
      if(/قريش|لبنة|جبن/.test(nm)){oil=oil||'للجبنة';continue;}
      if(/تونة|تونه/.test(nm)){oil=oil||'للتونة';continue;}
      if(/بيض/.test(nm)){oil=oil||'للبيض';continue;}
    }
    return {grill:grill,oil:oil,hasVeg:hasVeg};
  }
  if(/pre/.test(slot)&&!ketoLike){
    return {id:'swdany_mhms',name:'سوداني محمص',grams:20,note:'طاقة دهنية مدروسة قبل التمرين'};
  }
  if(/snack/.test(slot)){
    var ng=Math.max(10,Math.min(ketoLike?30:20,Math.round((deficit/0.5)/5)*5));
    return {id:'lwz_mhms',name:'لوز محمص',grams:ng,note:ketoLike?'دهون صحية مناسبة للكيتو':'دهون صحية متوازنة للسناك'};
  }
  var fg=Math.max(5,Math.min(ketoLike?25:15,Math.round(deficit/5)*5));
  var info=classify();
  // قرار يفكر ويوازن (مش بصمجة): نوع حسب اليوم والوجبة بدل تكرار نفس الإجابة
  var rot=0;try{rot=((new Date()).getDate()+({breakfast:1,lunch:2,dinner:3,snack:4,snack2:5,pre:6}[slot]||0))%2;}catch(e){}
  // مشوي/سمك: لو معاه سلطة ممكن نرش الزيت على السلطة بدل الطحينة — ونوع حسب اليوم
  if(info.grill){
    var tg=Math.max(10,Math.min(30,Math.round(deficit/5)*5));
    if(info.hasVeg&&rot===0)return {id:'zytzytwn',name:'زيت زيتون',grams:fg,note:'رشة '+fg+'جم زيت زيتون على السلطة جنب '+info.grill};
    return {id:'thyna',name:'طحينة',grams:tg,note:'طحينة جنب '+info.grill+' — دهون صحية للمشوي'};
  }
  // كارنيفور: زبدة طبيعية
  if(diet==='carnivore')return {id:'zbda',name:'زبدة',grams:fg,note:'دهون حيوانية مناسبة للكارنيفور'};
  // جبنة/فول/سلطة/تونة/بيض - نلصق زيت الزيتون بالصنف المناسب فقط
  if(info.oil)return {id:'zytzytwn',name:'زيت زيتون',grams:fg,note:'أضف '+fg+'جم زيت زيتون '+info.oil};
  // مفيش صنف منطقي ياخد دهون حرة (وجبة كارب أو فاكهة بس) — ماننصحش بإضافة زيت لوحده
  return null;
}
function planBalance(date,week){
  var dp=dayPlan(date,week);if(!dp)return null;var dm=dp.macros;
  var t=dp.meals.reduce(function(a,m){a.cals+=(m.totals.cals||0);a.pro+=(m.totals.pro||0);a.carb+=(m.totals.carb||0);a.fat+=(m.totals.fat||0);return a;},{cals:0,pro:0,carb:0,fat:0});
  return {target:dm,now:{cals:Math.round(t.cals),pro:Math.round(t.pro),carb:Math.round(t.carb),fat:Math.round(t.fat)},
    dCals:Math.round(t.cals-dm.cals),dPro:Math.round(t.pro-dm.protein),dCarb:Math.round(t.carb-dm.carbs),dFat:Math.round(t.fat-dm.fat)};
}

/* المحتوى العلمي المبسط — مخصص حسب هدف المستخدم (٤ أهداف) بدون أي معادلات */
function science(){
  var p=profile();var g=(p&&p.goal)||'cut';
  var GL={cut:'\u062a\u0646\u0634\u064a\u0641 \u0648\u0646\u0632\u0648\u0644 \u062f\u0647\u0648\u0646',bulk:'\u062a\u0636\u062e\u064a\u0645 \u0648\u0628\u0646\u0627\u0621 \u0639\u0636\u0644',recomp:'\u0625\u0639\u0627\u062f\u0629 \u062a\u0634\u0643\u064a\u0644 (\u062f\u0647\u0648\u0646\u2193 \u0639\u0636\u0644\u2191)',maintain:'\u062b\u0628\u0627\u062a \u0648\u0635\u064a\u0627\u0646\u0629'};
  var goalCards={
    cut:[
      {icon:'\uD83D\uDD3B',t:'\u0623\u0643\u0628\u0631 \u0663 \u0645\u0634\u0627\u0643\u0644 \u0648\u0627\u0646\u062a \u0628\u062a\u062e\u0633',d:'\u062f\u064a \u0627\u0644\u0644\u064a \u0628\u062a\u0648\u0642\u0641 \u0623\u063a\u0644\u0628 \u0627\u0644\u0646\u0627\u0633:',points:[
        '\u0627\u0644\u062c\u0648\u0639 \u0648\u0642\u0644\u0629 \u0627\u0644\u0634\u0628\u0639 \u2190 \u0627\u0631\u0641\u0639 \u0627\u0644\u0628\u0631\u0648\u062a\u064a\u0646 \u0648\u0627\u0644\u062e\u0636\u0627\u0631 \u0648\u0627\u0644\u0623\u0644\u064a\u0627\u0641 \u0648\u0642\u0633\u0651\u0645 \u0627\u0644\u0648\u062c\u0628\u0627\u062a',
        '\u0627\u0644\u062b\u0628\u0627\u062a (\u0627\u0644\u0645\u064a\u0632\u0627\u0646 \u0648\u0627\u0642\u0641) \u2190 \u0637\u0628\u064a\u0639\u064a \u0628\u0633\u0628\u0628 \u0627\u0644\u0645\u0627\u0621\u061b \u062a\u0627\u0628\u0639 \u0627\u0644\u0645\u0642\u0627\u0633\u0627\u062a \u0645\u0634 \u0627\u0644\u0648\u0632\u0646 \u0628\u0633',
        '\u0641\u0642\u062f \u0627\u0644\u0639\u0636\u0644 \u0648\u0627\u0644\u0637\u0627\u0642\u0629 \u2190 \u0628\u0631\u0648\u062a\u064a\u0646 \u0639\u0627\u0644\u064a + \u062a\u0645\u0627\u0631\u064a\u0646 \u0645\u0642\u0627\u0648\u0645\u0629 + \u0646\u0632\u0648\u0644 \u0645\u0639\u062a\u062f\u0644 \u0645\u0634 \u0642\u0627\u0633\u064a'
      ]},
      {icon:'\u2699\uFE0F',t:'\u0627\u0644\u062a\u0642\u0633\u064a\u0645\u0629 \u0627\u0644\u0635\u062d \u0644\u0644\u062a\u0646\u0634\u064a\u0641',d:'\u0639\u062c\u0632 \u0645\u0639\u062a\u062f\u0644 \u064a\u062d\u0627\u0641\u0638 \u0639\u0644\u0649 \u0627\u0644\u0639\u0636\u0644:',points:[
        '\u0639\u062c\u0632 \u0645\u0639\u062a\u062f\u0644 \u0645\u0646 \u0627\u062d\u062a\u064a\u0627\u062c\u0643 (\u0645\u0634 \u062a\u062c\u0648\u064a\u0639)',
        '\u0628\u0631\u0648\u062a\u064a\u0646 \u0639\u0627\u0644\u064a \u062b\u0627\u0628\u062a \u0643\u0644 \u064a\u0648\u0645',
        '\u062f\u0647\u0648\u0646 \u0643\u0627\u0641\u064a\u0629 \u0644\u0644\u0647\u0631\u0645\u0648\u0646\u0627\u062a \u0645\u0627 \u062a\u0642\u0644\u0634 \u0623\u0648\u064a',
        '\u0627\u0644\u0643\u0627\u0631\u0628 \u0627\u0644\u0628\u0627\u0642\u064a \u062d\u0648\u0627\u0644\u064a\u0646 \u0627\u0644\u062a\u0645\u0631\u064a\u0646 \u0644\u0644\u0637\u0627\u0642\u0629'
      ]},
      {icon:'\uD83E\uDDCA',t:'\u062d\u0644 \u0627\u0644\u062b\u0628\u0627\u062a \u0628\u062f\u0648\u0646 \u062a\u062c\u0648\u064a\u0639',d:'\u0644\u0645\u0627 \u064a\u0642\u0641 \u0627\u0644\u0646\u0632\u0648\u0644 \u0623\u0633\u0628\u0648\u0639\u064a\u0646 \u0648\u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 \u0643\u0648\u064a\u0633:',points:[
        '\u0627\u0631\u0641\u0639 \u0627\u0644\u062e\u0637\u0648\u0627\u062a \u0648\u0627\u0644\u062d\u0631\u0643\u0629 \u0627\u0644\u0623\u0648\u0644',
        '\u0627\u0633\u062a\u0631\u0627\u062d\u0629 \u062f\u0627\u064a\u062a \u0623\u0633\u0628\u0648\u0639 \u0639\u0644\u0649 \u0627\u0644\u0635\u064a\u0627\u0646\u0629 \u0643\u0644 \u0664\u2013\u0668 \u0623\u0633\u0627\u0628\u064a\u0639',
        '\u0628\u0639\u062f\u0647\u0627 \u0642\u0635 \u0628\u0633\u064a\u0637 \u0644\u0648 \u0644\u0633\u0647 \u0648\u0627\u0642\u0641'
      ]}
    ],
    bulk:[
      {icon:'\uD83D\uDD3A',t:'\u0623\u0643\u0628\u0631 \u0663 \u0645\u0634\u0627\u0643\u0644 \u0648\u0627\u0646\u062a \u0628\u062a\u0636\u062e\u0645',d:'\u062f\u064a \u0627\u0644\u0644\u064a \u0628\u062a\u0636\u064a\u0639 \u0645\u062c\u0647\u0648\u062f \u0627\u0644\u0646\u0627\u0633:',points:[
        '\u062f\u0647\u0648\u0646 \u0632\u0627\u064a\u062f\u0629 \u0645\u0639 \u0627\u0644\u0639\u0636\u0644 \u2190 \u0641\u0627\u0626\u0636 \u0628\u0633\u064a\u0637 \u0645\u0634 \u0623\u0643\u0644 \u0645\u0641\u062a\u0648\u062d',
        '\u0635\u0639\u0648\u0628\u0629 \u0627\u0644\u0623\u0643\u0644 \u2190 \u0633\u0639\u0631\u0627\u062a \u0633\u0627\u0626\u0644\u0629 (\u0633\u0645\u0648\u062b\u064a/\u0644\u0628\u0646) \u0648\u0648\u062c\u0628\u0627\u062a \u0623\u0643\u062a\u0631 \u0648\u062f\u0647\u0648\u0646 \u0635\u062d\u064a\u0629',
        '\u062a\u0648\u0642\u0639 \u0646\u0645\u0648 \u0633\u0631\u064a\u0639 \u2190 \u0627\u0644\u0639\u0636\u0644 \u0628\u064a\u0643\u0628\u0631 \u0628\u0628\u0637\u0621\u060c \u0627\u0644\u0635\u0628\u0631 \u0623\u0633\u0627\u0633'
      ]},
      {icon:'\u2699\uFE0F',t:'\u0627\u0644\u062a\u0642\u0633\u064a\u0645\u0629 \u0627\u0644\u0635\u062d \u0644\u0644\u062a\u0636\u062e\u064a\u0645',d:'\u0641\u0627\u0626\u0636 \u0645\u062d\u0633\u0648\u0628 \u0639\u0634\u0627\u0646 \u0639\u0636\u0644 \u0646\u0638\u064a\u0641:',points:[
        '\u0641\u0627\u0626\u0636 \u0628\u0633\u064a\u0637 \u0641\u0648\u0642 \u0627\u062d\u062a\u064a\u0627\u062c\u0643',
        '\u0628\u0631\u0648\u062a\u064a\u0646 \u0639\u0627\u0644\u064a \u0644\u0628\u0646\u0627\u0621 \u0627\u0644\u0639\u0636\u0644',
        '\u0643\u0627\u0631\u0628 \u0639\u0627\u0644\u064a \u0644\u0644\u0623\u062f\u0627\u0621 \u0648\u0627\u0644\u0646\u0645\u0648\u060c \u062e\u0635\u0648\u0635\u0627\u064b \u062d\u0648\u0627\u0644\u064a\u0646 \u0627\u0644\u062a\u0645\u0631\u064a\u0646'
      ]},
      {icon:'\uD83D\uDCCF',t:'\u0625\u0645\u062a\u0649 \u062a\u0648\u0642\u0641 \u0627\u0644\u0632\u064a\u0627\u062f\u0629',d:'\u0639\u0634\u0627\u0646 \u0645\u0627 \u062a\u062a\u0631\u0627\u0643\u0645\u0634 \u062f\u0647\u0648\u0646:',points:[
        '\u0644\u0648 \u0627\u0644\u062e\u0635\u0631 \u0628\u064a\u0632\u064a\u062f \u0628\u0633\u0631\u0639\u0629 \u062b\u0628\u0651\u062a \u0627\u0644\u0633\u0639\u0631\u0627\u062a',
        '\u0645\u064a\u0646\u064a-\u0643\u062a \u0642\u0635\u064a\u0631 \u0628\u064a\u0646\u0638\u0641 \u0627\u0644\u062f\u0647\u0648\u0646 \u0648\u064a\u0631\u062c\u0651\u0639 \u0627\u0644\u062d\u0633\u0627\u0633\u064a\u0629'
      ]}
    ],
    recomp:[
      {icon:'\uD83D\uDD01',t:'\u0627\u0644\u0631\u064a\u0643\u0648\u0645\u0628 \u0644\u0645\u064a\u0646 \u064a\u0646\u0641\u0639',d:'\u062a\u0641\u0642\u062f \u062f\u0647\u0648\u0646 \u0648\u062a\u0628\u0646\u064a \u0639\u0636\u0644 \u0641\u064a \u0646\u0641\u0633 \u0627\u0644\u0648\u0642\u062a:',points:[
        '\u0645\u062b\u0627\u0644\u064a \u0644\u0644\u0645\u0628\u062a\u062f\u0626\u064a\u0646 \u0648\u0627\u0644\u0639\u0627\u0626\u062f\u064a\u0646 \u0628\u0639\u062f \u0627\u0646\u0642\u0637\u0627\u0639 \u0648\u0623\u0635\u062d\u0627\u0628 \u0627\u0644\u062f\u0647\u0648\u0646 \u0627\u0644\u0623\u0639\u0644\u0649',
        '\u0633\u0639\u0631\u0627\u062a \u0642\u0631\u064a\u0628\u0629 \u0645\u0646 \u0627\u0644\u0635\u064a\u0627\u0646\u0629',
        '\u0628\u0631\u0648\u062a\u064a\u0646 \u0639\u0627\u0644\u064a \u062c\u062f\u0627\u064b + \u062a\u0645\u0631\u064a\u0646 \u0645\u0642\u0627\u0648\u0645\u0629 \u062a\u0642\u062f\u0645\u064a'
      ]},
      {icon:'\u2696\uFE0F',t:'\u0644\u064a\u0647 \u0627\u0644\u0645\u064a\u0632\u0627\u0646 \u0628\u064a\u0643\u062f\u0628 \u0647\u0646\u0627',d:'\u0627\u0644\u0648\u0632\u0646 \u0645\u0634 \u0645\u0624\u0634\u0631 \u0643\u0648\u064a\u0633 \u0647\u0646\u0627:',points:[
        '\u0627\u0644\u0648\u0632\u0646 \u0645\u0645\u0643\u0646 \u064a\u062b\u0628\u062a \u0628\u0633 \u0627\u0644\u062e\u0635\u0631 \u064a\u0646\u0632\u0644 \u0648\u0627\u0644\u0639\u0636\u0644 \u064a\u0632\u064a\u062f',
        '\u062a\u0627\u0628\u0639 \u0627\u0644\u0645\u0642\u0627\u0633\u0627\u062a \u0648\u0627\u0644\u0635\u0648\u0631 \u0643\u0644 \u0664\u2013\u0668 \u0623\u0633\u0627\u0628\u064a\u0639'
      ]}
    ],
    maintain:[
      {icon:'\u2696\uFE0F',t:'\u0644\u064a\u0647 \u0627\u0644\u0635\u064a\u0627\u0646\u0629 \u0645\u0647\u0627\u0631\u0629',d:'\u0623\u0635\u0639\u0628 \u0645\u0646 \u0627\u0644\u062e\u0633\u0627\u0631\u0629 \u0644\u0623\u0646\u0647\u0627 \u0628\u062f\u0648\u0646 \u0647\u062f\u0641 \u0648\u0627\u0636\u062d:',points:[
        '\u062d\u062f\u062f \u0646\u0637\u0627\u0642 \u0648\u0632\u0646 \u00b1\u0662 \u0643\u062c\u0645',
        '\u0631\u062c\u0651\u0639 \u0628\u0639\u062c\u0632 \u0628\u0633\u064a\u0637 \u0644\u0648 \u062e\u0631\u062c\u062a \u0639\u0646 \u0627\u0644\u0646\u0637\u0627\u0642',
        '\u062d\u0627\u0641\u0638 \u0639\u0644\u0649 \u0627\u0644\u0628\u0631\u0648\u062a\u064a\u0646 \u0648\u0627\u0644\u062a\u0645\u0631\u064a\u0646'
      ]},
      {icon:'\uD83D\uDCC8',t:'\u062b\u0628\u0627\u062a \u0627\u0644\u0648\u0632\u0646 \u0628\u0639\u062f \u0627\u0644\u062f\u0627\u064a\u062a',d:'\u0631\u062c\u0648\u0639 \u062a\u062f\u0631\u064a\u062c\u064a \u0644\u0644\u0633\u0639\u0631\u0627\u062a:',points:[
        '\u0627\u0631\u0641\u0639 \u0627\u0644\u0633\u0639\u0631\u0627\u062a \u0634\u0648\u064a\u0629 \u0628\u0634\u0648\u064a\u0629 \u0628\u0639\u062f \u0627\u0644\u062a\u0646\u0634\u064a\u0641',
        '\u0648\u0632\u0646 \u0623\u0633\u0628\u0648\u0639\u064a + \u062e\u0637\u0648\u0627\u062a + \u0646\u0648\u0645 \u0643\u0648\u064a\u0633'
      ]}
    ]
  };
  var universal=[
    {icon:'\uD83C\uDF56',t:'\u0627\u0644\u0628\u0631\u0648\u062a\u064a\u0646 = \u0623\u0647\u0645 \u0639\u0646\u0635\u0631',d:'\u0644\u0623\u064a \u0647\u062f\u0641\u060c \u0628\u064a\u062d\u0645\u064a \u0627\u0644\u0639\u0636\u0644 \u0648\u064a\u0632\u0648\u062f \u0627\u0644\u0634\u0628\u0639:',points:['\u0648\u0632\u0651\u0639\u0647 \u0639\u0644\u0649 \u0663\u2013\u0664 \u0648\u062c\u0628\u0627\u062a','\u0645\u0635\u0627\u062f\u0631: \u0641\u0631\u0627\u062e\u060c \u0633\u0645\u0643\u060c \u0628\u064a\u0636\u060c \u0644\u062d\u0645\u060c \u0632\u0628\u0627\u062f\u064a \u064a\u0648\u0646\u0627\u0646\u064a\u060c \u0628\u0631\u0648\u062a\u064a\u0646']},
    {icon:'\uD83D\uDCA7',t:'\u0627\u0644\u0645\u0627\u0621 \u0648\u0627\u0644\u0646\u0648\u0645 \u0648\u0627\u0644\u062d\u0631\u0643\u0629',d:'\u0627\u0644\u0639\u0648\u0627\u0645\u0644 \u0627\u0644\u0645\u0646\u0633\u064a\u0629 \u0627\u0644\u0644\u064a \u0628\u062a\u0641\u0631\u0642 \u062c\u062f\u0627\u064b:',points:['\u0662\u2013\u0663 \u0644\u062a\u0631 \u0645\u0627\u0621 \u064a\u0642\u0644\u0644\u0648\u0627 \u0627\u0644\u062c\u0648\u0639','\u0667\u2013\u0669 \u0633\u0627\u0639\u0627\u062a \u0646\u0648\u0645 \u062a\u0638\u0628\u0637 \u0627\u0644\u0647\u0631\u0645\u0648\u0646\u0627\u062a','\u0627\u0644\u062e\u0637\u0648\u0627\u062a \u0627\u0644\u064a\u0648\u0645\u064a\u0629 \u0628\u062a\u062d\u0631\u0642 \u0623\u0643\u062a\u0631 \u0645\u0645\u0627 \u062a\u062a\u062e\u064a\u0644']},
    {icon:'\uD83D\uDCCA',t:'\u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 \u0623\u0647\u0645 \u0645\u0646 \u0627\u0644\u0643\u0645\u0627\u0644',d:'\u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0645\u0646 \u0627\u0644\u0645\u062a\u0648\u0633\u0637 \u0645\u0634 \u0627\u0644\u064a\u0648\u0645 \u0627\u0644\u0645\u062b\u0627\u0644\u064a:',points:['\u0627\u0644\u062a\u0632\u0627\u0645 \u0668\u0665\u066a+ \u0643\u0641\u064a\u0644 \u0628\u0627\u0644\u0646\u062a\u064a\u062c\u0629','\u064a\u0648\u0645 \u062d\u0631 \u0645\u062f\u0631\u0648\u0633 \u0645\u0634 \u0628\u064a\u062e\u0631\u0651\u0628','\u062a\u0627\u0628\u0639 \u0627\u0644\u0627\u062a\u062c\u0627\u0647 \u0623\u0633\u0628\u0648\u0639\u064a\u0627\u064b \u0645\u0634 \u064a\u0648\u0645 \u0628\u064a\u0648\u0645']}
  ];
  return {goal:g,goalLabel:GL[g]||GL.cut,cards:(goalCards[g]||goalCards.cut).concat(universal)};
}

/* ============================================================
   نمط الحياة: الصيام المتقطع + الماء + النوم
   ============================================================ */
// الصيام المتقطع: نافذة الأكل تبدأ 12 ساعة وتقل ساعة كل أسبوع حتى 8 (نظام 16:8)
function fastingPlan(week){
  week=week||curWeek();
  var START=12,MIN=8,steps=START-MIN+1;
  var stepIdx=clamp(week,1,steps);
  var eat=START-(stepIdx-1);
  var ladder=[];
  for(var n=1;n<=steps;n++){var w=START-(n-1);ladder.push({step:n,eat:w,fast:24-w,done:n<stepIdx,cur:n===stepIdx});}
  var next=stepIdx<steps?{week:week+1,eat:eat-1,fast:24-(eat-1)}:null;
  return {week:week,stepIdx:stepIdx,steps:steps,eat:eat,fast:24-eat,atMax:eat<=MIN,ladder:ladder,next:next};
}
// هدف الماء اليومي: ~35 مل لكل كجم من وزن الجسم
function waterTargetL(){
  var w=0;var ws=weights();if(ws.length)w=ws[ws.length-1].weight;
  if(!w){var p=profile();w=p.weight||p.currentWeight||p.startWeight||75;}
  return clamp(Math.round(w*0.035*10)/10,1.5,4);
}
function lifestyle(){
  return {fasting:fastingPlan(),waterL:waterTargetL(),water:getWater(),sleep:{min:7,max:9}};
}

window.Coach={
  // بيانات
  plan:plan,profile:profile,summary:summary,curWeek:curWeek,setWeek:setWeek,calWeek:calWeek,
  dayPlan:dayPlan,dayMacros:dayMacros,dayTarget:dayTarget,phaseForWeek:phaseForWeek,dayType:dayType,
  maintenanceCals:maintenanceCals,workingTarget:workingTarget,floorCals:floorCals,
  // تقدم
  trendSeries:trendSeries,latestTrend:latestTrend,weeklyRateKg:weeklyRateKg,
  measureSeries:measureSeries,measureRateCm:measureRateCm,lastMeasure:lastMeasure,logMeasures:logMeasures,waistTrendingDown:waistTrendingDown,
  estTDEE:estTDEE,adaptivePct:adaptivePct,plateauStatus:plateauStatus,goalReached:goalReached,
  adherenceWindow:adherenceWindow,loggedDays:loggedDays,cumulativeCutWeeks:cumulativeCutWeeks,
  // تسجيل
  toggleMeal:toggleMeal,logWeight:logWeight,logs:logs,weights:weights,
  setWater:setWater,getWater:getWater,
  logIntake:logIntake,getIntake:getIntake,intakeAvg:intakeAvg,intakeLog:intakeLog,loggedIntakeDays:loggedIntakeDays,
  fastingPlan:fastingPlan,waterTargetL:waterTargetL,lifestyle:lifestyle,
  // مدرب
  review:review,applyDecision:applyDecision,keepDecision:keepDecision,
  notifs:function(){return cstateRaw().notif||[];},coachLog:function(){return cstateRaw().log||[];},
  unread:unread,pending:pending,markAllRead:markAllRead,state:cstateRaw,
  // تحليل + محتوى
  analysis:analysis,science:science,motiv:motiv,
  // تعديل الوجبات وموازنتها
  searchFoods:searchFoods,findFood:findFood,buildMealFoods:buildMealFoods,editMeal:editMeal,rebalancePlan:rebalancePlan,planBalance:planBalance,suggestFat:suggestFatSmart,slotLabel:_slotLabel,slotIds:slotIds,materializeSlot:materializeSlot,materializeAllSlots:materializeAllSlots,
  version:'diet-coach-v1'
};
})();
