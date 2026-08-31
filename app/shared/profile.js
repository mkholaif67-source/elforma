/* ===================================================================
   EF Unified Profile — مصدر الحقيقة الواحد للبيانات المشتركة
   بين قسم التمرين (ElForma) وقسم التغذية (صمم دايت).
   - لا يلمس منطق أي محرك (analysis/planner/splits/calc).
   - يعمل على مستوى كائن (ans) الخام في كل معالج.
   - تخزين موحد في localStorage تحت مفتاح EF_UNIFIED_PROFILE.
   =================================================================== */
(function(){
'use strict';
var KEY='EF_UNIFIED_PROFILE';

function nowISO(){try{return new Date().toISOString();}catch(e){return '';}}
function numOr(v,d){var n=parseFloat(v);return isFinite(n)?n:d;}

function load(){try{var v=localStorage.getItem(KEY);return v?JSON.parse(v):{};}catch(e){return {};}}
function save(p){try{localStorage.setItem(KEY,JSON.stringify(p));}catch(e){}return p;}
function patch(obj){
  var p=load();
  for(var k in obj){if(Object.prototype.hasOwnProperty.call(obj,k)&&obj[k]!=null&&obj[k]!=='')p[k]=obj[k];}
  p.updatedAt=nowISO();
  return save(p);
}
function reset(){try{localStorage.removeItem(KEY);}catch(e){}}

/* ---------- خرائط التطبيع (canonical <-> ans الخام) ---------- */
// الجنس: ans في المحركين يستخدم 'ذكر'/'أنثى'
var GENDER={toCanon:{'ذكر':'male','أنثى':'female'},toAns:{male:'ذكر',female:'أنثى'}};

// النشاط: canonical موحد sedentary|light|moderate|active|veryActive
var ACT={
  workoutToCanon:{'مكتبي':'sedentary','خفيف':'light','معتدل':'moderate','نشيط':'active','رياضي':'veryActive'},
  canonToWorkout:{sedentary:'مكتبي',light:'خفيف',moderate:'معتدل',active:'نشيط',veryActive:'رياضي'},
  dietToCanon:{'خامل':'sedentary','خفيف':'light','متوسط':'moderate','نشيط':'active','شديد':'veryActive'},
  canonToDiet:{sedentary:'خامل',light:'خفيف',moderate:'متوسط',active:'نشيط',veryActive:'شديد'}
};

// الهدف: canonical = fatloss|muscle|mass|strength|fitness
// ملاحظة: مجموعات الأهداف مختلفة بين المحركين، فالعكس تقريبي وأفضل تطابق.
var GOAL={
  workoutToCanon:{'تنشيف':'fatloss','تضخيم':'muscle','قوة':'strength','لياقة':'fitness'},
  canonToWorkout:{fatloss:'تنشيف',muscle:'تضخيم',mass:'تضخيم',strength:'قوة',fitness:'لياقة'},
  dietToCanon:{'تخسيس':'fatloss','تثبيت':'fitness','زيادة عضلية':'muscle','ضخامة':'mass'},
  canonToDiet:{fatloss:'تخسيس',muscle:'زيادة عضلية',mass:'ضخامة',strength:'زيادة عضلية',fitness:'تثبيت'}
};

// نمط التمرين: canonical = gym|home|none
var MODE={
  workoutToCanon:{'جيم':'gym','البيت':'home'},
  canonToWorkout:{gym:'جيم',home:'البيت'}, // none لا يسقط في التمرين (المستخدم دخل قسم التمرين)
  dietToCanon:{'جيم':'gym','البيت':'home','مش بتمرن':'none'},
  canonToDiet:{gym:'جيم',home:'البيت',none:'مش بتمرن'}
};

/* ---------- الالتقاط من التمرين (بعد إكمال المعالج) ---------- */
function captureFromWorkout(ans){
  if(!ans)return load();
  return patch({
    gender:GENDER.toCanon[ans.gender],
    age:numOr(ans.age,undefined),
    height:numOr(ans.height,undefined),
    weight:numOr(ans.weight,undefined),
    goal:GOAL.workoutToCanon[ans.goal],
    activity:ACT.workoutToCanon[ans.daily],
    trainingMode:MODE.workoutToCanon[ans.equip],
    workoutDone:true, workoutAt:nowISO()
  });
}
/* ---------- الالتقاط من التغذية ---------- */
function captureFromDiet(ans){
  if(!ans)return load();
  return patch({
    gender:GENDER.toCanon[ans.gender],
    age:numOr(ans.age,undefined),
    height:numOr(ans.height,undefined),
    weight:numOr(ans.weight,undefined),
    goal:GOAL.dietToCanon[ans.goal],
    activity:ACT.dietToCanon[ans.activity],
    trainingMode:MODE.dietToCanon[ans.workout],
    dietDone:true, dietAt:nowISO()
  });
}

/* ---------- الحقن في التمرين (يملأ ans ويرجع معرفات الأسئلة المملوءة) ---------- */
function applyToWorkout(ans){
  var p=load(),f=[];
  if(!ans)return f;
  if(p.gender&&GENDER.toAns[p.gender]){ans.gender=GENDER.toAns[p.gender];f.push('gender');}
  if(p.age!=null){ans.age=p.age;f.push('age');}
  if(p.height!=null){ans.height=p.height;f.push('height');}
  if(p.weight!=null){ans.weight=p.weight;f.push('weight');}
  if(p.goal&&GOAL.canonToWorkout[p.goal]){ans.goal=GOAL.canonToWorkout[p.goal];f.push('goal');}
  if(p.activity&&ACT.canonToWorkout[p.activity]){ans.daily=ACT.canonToWorkout[p.activity];f.push('daily');}
  if(p.trainingMode&&MODE.canonToWorkout[p.trainingMode]){ans.equip=MODE.canonToWorkout[p.trainingMode];f.push('equip');}
  return f;
}
/* ---------- الحقن في التغذية ---------- */
function applyToDiet(ans){
  var p=load(),f=[];
  if(!ans)return f;
  if(p.gender&&GENDER.toAns[p.gender]){ans.gender=GENDER.toAns[p.gender];f.push('gender');}
  if(p.age!=null){ans.age=p.age;f.push('age');}
  if(p.height!=null){ans.height=p.height;f.push('height');}
  if(p.weight!=null){ans.weight=p.weight;f.push('weight');}
  if(p.goal&&GOAL.canonToDiet[p.goal]){ans.goal=GOAL.canonToDiet[p.goal];f.push('goal');}
  if(p.activity&&ACT.canonToDiet[p.activity]){ans.activity=ACT.canonToDiet[p.activity];f.push('activity');}
  if(p.trainingMode&&MODE.canonToDiet[p.trainingMode]){ans.workout=MODE.canonToDiet[p.trainingMode];f.push('workout');}
  return f;
}

function isWorkoutDone(){return !!load().workoutDone;}
function isDietDone(){return !!load().dietDone;}

window.EFProfile={
  KEY:KEY,load:load,save:save,patch:patch,reset:reset,
  captureFromWorkout:captureFromWorkout,applyToWorkout:applyToWorkout,
  captureFromDiet:captureFromDiet,applyToDiet:applyToDiet,
  isWorkoutDone:isWorkoutDone,isDietDone:isDietDone,
  maps:{GENDER:GENDER,ACT:ACT,GOAL:GOAL,MODE:MODE}
};

/* ===================================================================
   شريط التبديل (Switch) بين القسمين — يحقن على الداشبورد
   =================================================================== */
function currentApp(){var p=location.pathname;if(/\/workout\//.test(p))return 'workout';if(/\/diet\//.test(p))return 'diet';return null;}
function isDashboard(){return /dashboard\.html$/i.test(location.pathname);}
function basePath(){return location.pathname.replace(/\/(workout|diet)\/[^/]*$/,'/');}

function injectStyles(){
  if(document.getElementById('ef-switch-css'))return;
  var s=document.createElement('style');s.id='ef-switch-css';
  s.textContent=''+
  '.ef-switch{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:6px;'+
  'background:rgba(16,22,28,.92);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:6px;'+
  'box-shadow:0 10px 30px rgba(0,0,0,.35);font-family:Cairo,system-ui,sans-serif;direction:rtl;}'+
  '.ef-tab{display:flex;align-items:center;gap:7px;border:0;cursor:pointer;border-radius:999px;padding:9px 16px;font-size:14px;font-weight:700;'+
  'background:transparent;color:#cfe;transition:all .2s;font-family:inherit;}'+
  '.ef-tab .ef-ic{font-size:16px;line-height:1;}'+
  '.ef-tab:hover{background:rgba(255,255,255,.07);}'+
  '.ef-tab.active{background:linear-gradient(135deg,#00D4AA,#22B8CF);color:#04201b;box-shadow:0 4px 14px rgba(0,212,170,.4);cursor:default;}'+
  '.ef-tab.ef-activate{color:#FFCF9E;border:1px dashed rgba(255,146,102,.5);}'+
  '.ef-tab.ef-activate:hover{background:rgba(255,146,102,.12);}'+
  '.ef-tab[disabled]{opacity:.5;cursor:default;}'+
  '.ef-div{width:1px;height:22px;background:rgba(255,255,255,.14);}';
  document.head.appendChild(s);
}

function buildSwitch(){
  var app=currentApp();if(!app||!isDashboard())return;
  injectStyles();
  var wDone=isWorkoutDone(),dDone=isDietDone(),base=basePath();
  function tab(key,label,icon){
    var active=(key===app),done=(key==='workout'?wDone:dDone),href=null,cls='ef-tab',txt=label;
    if(active){cls+=' active';}
    else if(done){href=base+key+'/dashboard.html';}
    else{href=base+key+'/index.html';cls+=' ef-activate';txt='\u0641\u0639\u0651\u0644 '+label;}
    return '<button class="'+cls+'" '+(href?('data-href="'+href+'"'):'disabled')+'><span class="ef-ic">'+icon+'</span><span>'+txt+'</span></button>';
  }
  var bar=document.createElement('div');bar.className='ef-switch';
  bar.innerHTML=tab('workout','\u0627\u0644\u062a\u0645\u0631\u064a\u0646','\uD83C\uDFCB\uFE0F')+'<span class="ef-div"></span>'+tab('diet','\u0627\u0644\u062a\u063a\u0630\u064a\u0629','\uD83E\uDD57');
  document.body.appendChild(bar);
  Array.prototype.forEach.call(bar.querySelectorAll('[data-href]'),function(b){b.onclick=function(){location.href=b.getAttribute('data-href');};});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildSwitch);
else buildSwitch();
})();
