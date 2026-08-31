/* ElForma dashboard — standalone progression tracker (localStorage only).
   The training ENGINE is never touched here; this only reads the saved plan
   (forma_plan / forma_logs / forma_done / forma_modules) and tracks progress. */
(function(){
'use strict';
function $(id){return document.getElementById(id);}
var _lastMob=null;
window.addEventListener('resize',function(){
  var m=!!(window.matchMedia&&window.matchMedia('(max-width:600px)').matches);
  if(m!==_lastMob){_lastMob=m;if(typeof render==='function'&&typeof PLAN!=='undefined'&&PLAN&&PLAN.days&&PLAN.days.length){render();}}
});
document.addEventListener('click',function(e){var f=$('tfab');if(f&&f.classList.contains('open')&&!e.target.closest('#tfab')){f.classList.remove('open');}});
document.addEventListener('click',function(e){var pd=document.getElementById('pqDetails');if(pd&&pd.classList.contains('open')&&!e.target.closest('#pqDetails')&&!e.target.closest('[data-pqtoggle]')){pd.classList.remove('open');var _ct=document.querySelector('.pq-toggle');if(_ct)_ct.classList.remove('on');}});
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function load(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function vurl(v){if(!v)return'';return /^https?:/.test(v)?v:'https://www.youtube.com/watch?v='+v;}
function fmt1(n){if(n==null||isNaN(n))return n;return (Math.round(n*100)/100).toString();}

var MLABEL={chest:'صدر',back:'ظهر',shoulders:'أكتاف',arms:'ذراع',legs:'أرجل',glutes:'مؤخرة',core:'بطن',calves:'سمانة',forearms:'ساعد',quads:'أمامية',hamstrings:'خلفية'};
var MUDISP={'لاتيسيموس':'الظهر العريض','لاتيسيموس سفلي':'الظهر العريض السفلي','قبضة + تحرير لاتس':'قبضة وإطالة الظهر','ظهر وسط':'وسط الظهر','ظهر وسط ورومبويد':'وسط الظهر (سماكة)','ظهر علوي ورومبويد':'أعلى الظهر','ظهر وسط وعلوي':'وسط وأعلى الظهر','ظهر وسط كامل':'وسط الظهر (شامل)','ظهر سفلي':'أسفل الظهر','ظهر سفلي وهامستينج':'أسفل الظهر وخلفية الفخذ','ظهر كامل':'الظهر كامل','صدر علوي':'الصدر العلوي','صدر علوي داخلي':'الصدر العلوي الداخلي','صدر سفلي':'الصدر السفلي','صدر سفلي داخلي':'الصدر السفلي الداخلي','صدر وسط':'وسط الصدر','صدر وسط كامل':'وسط الصدر (شامل)','صدر داخلي':'الصدر الداخلي','دلتا أمامي وجانبي':'الكتف الأمامي والجانبي','دلتا جانبي':'الكتف الجانبي','دلتا خلفي':'الكتف الخلفي','دلتا كامل':'الكتف كامل','دلتا خلفي وترابيس':'الكتف الخلفي والترابيس','ترابيس علوي':'الترابيس العلوي','ترابيس ودلتا جانبي':'الترابيس والكتف الجانبي','ساعد وترابيس':'الساعد والترابيس','ترايسبس رأس طويل':'الترايسبس (الرأس الطويل)','ترايسبس جانبي':'الترايسبس (الرأس الجانبي)','ترايسبس':'الترايسبس','ترايسبس كامل':'الترايسبس كامل','ترايسبس وصدر':'الترايسبس والصدر','بايسبس قمة':'البايسبس (القمة)','بايسبس رأس طويل':'البايسبس (الرأس الطويل)','بايسبس':'البايسبس','براكياليس وساعد':'العضلة العضدية والساعد','براكياليس ورأس طويل':'العضلة العضدية والبايسبس','ساعد أمامي':'الساعد الأمامي','ساعد خلفي':'الساعد الخلفي','كوادز':'الفخذ الأمامي','كوادز وجلوتس':'الفخذ الأمامي والمؤخرة','كوادز وجلوتس أحادي':'الفخذ الأمامي والمؤخرة (رجل واحدة)','كوادز عزل':'الفخذ الأمامي (عزل)','كوادز كامل':'الفخذ الأمامي (شامل)','كوادز علوي':'الفخذ الأمامي العلوي','كوادز علوي (Rectus Femoris)':'الفخذ الأمامي (العضلة المستقيمة)','كوادز خارجي (Vastus Lateralis)':'الفخذ الأمامي الخارجي','هامستينج':'خلفية الفخذ','هامستينج عزل':'خلفية الفخذ (عزل)','هامستينج أحادي':'خلفية الفخذ (رجل واحدة)','هامستينج أحادي عزل':'خلفية الفخذ (عزل، رجل واحدة)','هامستينج وجلوتس':'خلفية الفخذ والمؤخرة','جلوتس وهامستينج':'المؤخرة وخلفية الفخذ','جلوتس':'المؤخرة','مقرب داخلي فخذ':'مقربات الفخذ الداخلية','مقرب ومبعد فخذ وجلوتس':'مقربات ومبعدات الفخذ والمؤخرة','جاستروكنيميوس':'السمانة (الجزء الظاهر)','سولياس':'السمانة العميقة','سمانة':'السمانة','سمانة كاملة':'السمانة (كاملة)','سمانة أحادية':'السمانة (رجل واحدة)','كور كامل':'عضلات الوسط (كاملة)','كور عميق':'عضلات الوسط العميقة','كور وكارديو':'عضلات الوسط وكارديو','جانب الكور':'جانب الوسط','بطن كامل':'البطن (كامل)','بطن علوي':'البطن العلوي','بطن سفلي':'البطن السفلي','بطن علوي وكور':'البطن العلوي والوسط','بطن جانبي وكور':'البطن الجانبي والوسط','جانب البطن':'جانب البطن'};
function muDisp(x){return MUDISP[x]||MLABEL[x]||x||'';}
function efAvatar(p){
  var female=p&&p.gender==='female';
  var male=p&&p.gender==='male';
  var skin=female?'#f6b58d':'#eeb27f';
  var hair=female?'#352016':'#24180f';
  var top=female?'#ff6b9a':(male?'#00d4aa':'#5b8bdb');
  var bg=female?'#ff6b9a':(male?'#00d4aa':'#38bdf8');
  var hairPath=female?'M20 30c0-12 8-20 20-20s20 8 20 20v9c-4-2-7-8-7-14-8 5-18 5-26 0 0 6-3 12-7 14-3-6-6-9-12-10z':'M20 31c1-12 9-19 20-19s19 7 20 19c-5-6-13-7-20-7s-15 1-20 7z';
  return '<svg class="avatar-svg" viewBox="0 0 80 80" aria-hidden="true">'+
    '<defs><radialGradient id="g1" cx="35%" cy="25%" r="70%"><stop offset="0" stop-color="#ffffff" stop-opacity=".45"/><stop offset=".45" stop-color="'+bg+'"/><stop offset="1" stop-color="#0d1b2a"/></radialGradient><filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="5" flood-color="'+bg+'" flood-opacity=".35"/></filter></defs>'+
    '<circle cx="40" cy="40" r="38" fill="url(#g1)" filter="url(#sh)"/><circle cx="40" cy="40" r="35" fill="none" stroke="rgba(255,255,255,.42)" stroke-width="2"/>'+
    '<path d="M20 69c3-13 13-20 20-20s17 7 20 20" fill="'+top+'"/><circle cx="40" cy="34" r="17" fill="'+skin+'"/>'+
    '<path d="'+hairPath+'" fill="'+hair+'"/><circle cx="33" cy="35" r="2" fill="#17202a"/><circle cx="47" cy="35" r="2" fill="#17202a"/><path d="M34 45c4 4 8 4 12 0" fill="none" stroke="#7b3f2a" stroke-width="2.5" stroke-linecap="round"/>'+
    '<path d="M23 68c4-8 10-13 17-13s13 5 17 13" fill="rgba(13,27,42,.18)"/></svg>';
}

/* EF: user-isolation gate */
(function(){
  var prevUid = localStorage.getItem('EF_current_uid');
  window.__EF_stored_uid = prevUid || null;
})();
/* /EF */
var PLAN=load('forma_plan',null);
var LOGS=load('forma_logs',{});
var DONE=load('forma_done',{});
var MESO=(PLAN&&PLAN.meso_weeks)||6;
var TAB='today';
var EFNICKS=['يا بطل','يا وحش','يا كابتن','يا كوتش','يا فورمه'];
var EFGREET=EFNICKS[Math.floor(Math.random()*EFNICKS.length)];
var MOB=false;
var ANSCOPE='daily';
var MSEL=load('forma_modules',null);
if(!Array.isArray(MSEL))MSEL=(PLAN&&PLAN.activeModules)?PLAN.activeModules.slice():[];
var ESS_MODS=['cardio','warmup','stretch','core'];

if(!PLAN||!PLAN.days||!PLAN.days.length){
  $('dashRoot').innerHTML='<div class="empty"><div class="big"></div><h2>لسه مفيش خطة</h2><p>ابدأ التحليل واختار جدولك الأول عشان تبدأ تتابع تقدمك</p><a class="btn btn-primary btn-lg" href="index.html">ابدأ دلوقتي</a></div>';
  return;
}

/* ---- week derivation: a session counts when its day is marked done ---- */
function sessionsDone(){return Object.keys(DONE).filter(function(k){return DONE[k];}).length;}
function curWeek(){return Math.floor(sessionsDone()/PLAN.days.length)+1;}
var WEEK=curWeek();
var MWEEK=((WEEK-1)%MESO)+1;
var DELOAD=(MWEEK===MESO);
var PROFILE=PLAN.profile||{};
/*EF_ACCT_NAME*/try{localStorage.setItem('EF_LAST_SECTION','workout');}catch(e){}if(!PLAN.profile)PLAN.profile={};try{fetch('/api/auth/me',{credentials:'include'}).then(function(r){return r.json();}).then(function(d){var u=d&&(d.user||d);if(u&&u.name){PLAN.profile.name=u.name;PROFILE.name=u.name;}if(d&&d.subscription){window.EF_SUB=d.subscription;}/* EF_current_uid_check */var _curUid=u&&String(u.id||'');var _prevUid=window.__EF_stored_uid;if(_curUid&&_prevUid&&_curUid!==_prevUid){  ['forma_plan','forma_logs','forma_done','forma_hist','forma_coach',   'forma_plan_original','forma_plan_snapshots'].forEach(function(k){localStorage.removeItem(k);});  PLAN=null;LOGS={};DONE={};}if(_curUid)localStorage.setItem('EF_current_uid',_curUid);if(PLAN&&!localStorage.getItem('forma_plan_original')){  try{localStorage.setItem('forma_plan_original',JSON.stringify(PLAN));}catch(_){}}if((u&&u.name||d&&d.subscription)&&typeof render==='function')render();}).catch(function(){});}catch(e){}
if(window.Coach&&Coach.tick){try{Coach.tick(PLAN,LOGS,WEEK,MWEEK,MESO,PROFILE);}catch(e){}}
function doneKey(dk,w){return dk+'_w'+w;}
function isDone(dk){return !!DONE[doneKey(dk,WEEK)];}
var SEL=(function(){for(var i=0;i<PLAN.days.length;i++){if(!isDone(PLAN.days[i].key))return i;}return 0;})();
var OPEN={};/* which exercises are expanded */

/* ---- progressive overload (scientific, applied on logged data) ---- */
var BIG=/(squat|deadlift|bench|press|row|سكوات|ديدليفت|بنش|ضغط|تجديف|مكبس|hip thrust)/i;
function incFor(name){return BIG.test(name||'')?5:2.5;}
function topRep(reps){var m=String(reps||'').match(/(\d+)\s*-\s*(\d+)/);if(m)return +m[2];var n=parseInt(reps,10);return n||12;}
function cTarget(dk,ex){return (window.Coach)?Coach.nextTarget(dk+'|'+ex.name,ex,MWEEK,MESO,PROFILE):null;}
function suggestWeight(dk,ex){var t=cTarget(dk,ex);if(t&&t.weight!=null)return t.weight;var lg=LOGS[dk+'|'+ex.name];if(!lg||!lg.weight)return null;if((+lg.reps||0)>=topRep(ex.reps))return lg.weight+incFor(ex.name);return lg.weight;}
function suggestText(dk,ex){
  var t=cTarget(dk,ex);var top=topRep(ex.reps);
  if(t){
    if(!t.hasBase)return 'سجل أول وزن'+(DELOAD?' (أسبوع تخفيف)':'')+' عشان مدربك الذكي يبدأ يطور حملك';
    if(DELOAD)return 'أسبوع تخفيف: '+fmt1(t.weight)+' كجم × '+t.reps+' عدة · خفيف وسهل (RIR '+t.rir+')';
    return 'مقترح: '+fmt1(t.weight)+' كجم × '+t.reps+' عدة — احتفظ ب '+t.rir+' تكرار في الخزان';
  }
  var lg=LOGS[dk+'|'+ex.name]||null;
  if(!lg||!lg.weight)return 'ابدأ بوزن تتحكم فيه تماما، واستهدف '+top+' عدة بأسلوب صحيح';
  if((+lg.reps||0)>=top)return 'وصلت للحد الأعلى — زد '+incFor(ex.name)+' كجم في الجلسة القادمة ('+(lg.weight+incFor(ex.name))+' كجم)';
  return 'استمر على '+lg.weight+' كجم واستهدف '+top+' عدة';
}

/* ---- KPIs ---- */
function plannedSetsWeek(){return PLAN.days.reduce(function(a,d){return a+(d.exercises||[]).reduce(function(x,e){return x+(+e.sets||0);},0);},0);}
function setsThisWeek(){var n=0;PLAN.days.forEach(function(d){(d.exercises||[]).forEach(function(e){var lg=LOGS[d.key+'|'+e.name];if(lg&&lg.week===WEEK&&lg.done)n+=(+e.sets||0);});});return n;}
function commitment(){var total=PLAN.days.length*WEEK;if(!total)return 0;return Math.min(100,Math.round(sessionsDone()/total*100));}
function bodyWeight(){return (PLAN.profile&&PLAN.profile.weight)||null;}
function topProgress(){var best=null;PLAN.days.forEach(function(d){(d.exercises||[]).forEach(function(e){var lg=LOGS[d.key+'|'+e.name];if(lg&&lg.weight&&(!best||lg.weight>best.weight))best={name:e.name,muscle:e.muscle,weight:lg.weight,reps:lg.reps};});});return best;}

/* ---- animation helpers ---- */
function setRing(el,pct,C){if(!el)return;pct=Math.max(0,Math.min(100,pct||0));el.style.transition='stroke-dashoffset 1.05s cubic-bezier(.2,.8,.2,1)';setTimeout(function(){el.style.strokeDashoffset=(C*(1-pct/100)).toFixed(1);},40);}
function countUp(el,target,suffix,prefix){if(!el)return;if(target==null||isNaN(target)){el.innerHTML=(prefix||'')+'—'+(suffix||'');return;}var dec=target%1!==0,cur=0,step=target/38;var t=setInterval(function(){cur+=step;if(cur>=target){cur=target;clearInterval(t);}el.innerHTML=(prefix||'')+(dec?cur.toFixed(1):Math.round(cur))+(suffix||'');},18);}

/* ---- render ---- */
/* EF: undo/restore helpers */
function undoLastCoachChange(){
  try{var snaps=JSON.parse(localStorage.getItem('forma_plan_snapshots')||'[]');
    if(!snaps.length){if(window.EFToast)EFToast.warn('مفيش تعديلات سابقة');return;}
    var prev=snaps.pop();
    localStorage.setItem('forma_plan_snapshots',JSON.stringify(snaps));
    localStorage.setItem('forma_plan',JSON.stringify(prev.plan));
    PLAN=prev.plan;
    if(window.EFToast)EFToast.ok('↩ رجوع خطوة للوراء');
    if(typeof render==='function')render();
    if(window.__efSyncUndoBar)__efSyncUndoBar();
  }catch(e){if(window.EFToast)EFToast.warn('خطأ');}
}
function restoreOriginalPlan(){
  try{var orig=JSON.parse(localStorage.getItem('forma_plan_original'));
    if(!orig){if(window.EFToast)EFToast.warn('مفيش خطة أصلية محفوظة');return;}
    if(!confirm('هترجع للخطة الأصلية. تعديلات المدرب الذكي كلها هتتمسح. كمّل؟'))return;
    localStorage.setItem('forma_plan',JSON.stringify(orig));
    localStorage.removeItem('forma_plan_snapshots');
    localStorage.removeItem('forma_coach');
    PLAN=orig;
    if(window.EFToast)EFToast.ok('✅ تم استعادة الخطة الأصلية');
    if(typeof render==='function')render();
    if(window.__efSyncUndoBar)__efSyncUndoBar();
  }catch(e){if(window.EFToast)EFToast.warn('خطأ');}
}
/* /EF undo/restore */
function render(){
  var p=PLAN.profile||{};
  var hr=new Date().getHours();
  var part=hr<12?'صباح الطاقة':(hr<18?'أهلا':(hr<21?'مساء النشاط':'ليلة الإنجاز'));
  var deload=Math.max(0,MESO-MWEEK);
  var deloadTxt=DELOAD?'أسبوع التخفيف — حمل أخف لتعزيز الاستشفاء':('أسبوع '+MWEEK+' من '+MESO+(deload>0?' · باقي '+deload+(deload===1?' أسبوع':' أسابيع')+' للديلود':''));
  var day=PLAN.days[SEL];
  var exs=(day&&day.exercises)||[];
  var estMin=Math.round(exs.reduce(function(s,e){return s+(+e.sets||3)*(((+e.restSec||restToSeconds(e.rest)||75)+35)/60);},0));

  MOB=!!(window.matchMedia&&window.matchMedia('(max-width:600px)').matches);
  _lastMob=MOB;
  if(MOB){renderMobileDash(p,day,exs,estMin,deload,deloadTxt);return;}
  var html='<div class="wrap">';
  html+='<div class="dhead"><h1>'+part+'، '+esc(EFGREET)+'</h1><div class="daymotiv"><span class="dm-txt">'+esc(wmotiv())+'</span></div></div>';

  /* hero (faithful desktop redesign) */
  html+='<div class="ef-hero"><div class="ef-hero-ring"><div class="ef-hring"><svg viewBox="0 0 96 96" width="96" height="96"><circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="9"/><circle id="heroRing" cx="48" cy="48" r="40" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-dasharray="251" stroke-dashoffset="251" transform="rotate(-90 48 48)"/></svg><div class="ef-hlab"><b id="heroPct">0%</b><small>الالتزام</small></div></div></div>'+
    '<div class="ef-hero-body"><h2>جدولك التدريبي — '+esc(PLAN.split_name||PLAN.title||'برنامجك')+'</h2>'+
    '<div class="ef-hmeta"><span class="ef-hchip">'+esc((day&&day.name)?day.name.split('—')[0].trim():'جلستك')+'</span><span class="ef-hchip">'+exs.length+' تمارين</span><span class="ef-hchip">⏱~'+estMin+' دقيقة</span></div>'+
    '<button class="ef-hstart" id="heroStart">▶ ابدأ جلستك الآن</button></div></div>';

  /* KPIs (faithful desktop redesign) */
  html+='<div class="ef-kpis">'+
    dialCard('dialS','cS','مجموعات الأسبوع','أتممتها حتى الآن','')+
    dialCard('dialW','cW','وزن الجسم','آخر وزن مسجل','')+
    dialCard('dialD','cD','أسابيع للديلود','تخفيف دوري مجدول','peach')+
  '</div>';

  /* tabnav (faithful desktop redesign) */
  html+='<div class="ef-tabnav">'+
   '<button class="ef-tab'+(TAB==='profile'?' on':'')+'" data-tab="profile">البروفايل</button>'+
   '<button class="ef-tab'+(TAB==='today'?' on':'')+'" data-tab="today">تمرين اليوم</button>'+
   '<button class="ef-tab'+(TAB==='analysis'?' on':'')+'" data-tab="analysis">التحليل والتقييم</button>'+
   '<button class="ef-tab'+(TAB==='coach'?' on':'')+'" data-tab="coach">المدرب الذكي</button>'+
   '<button class="ef-tab'+(TAB==='modules'?' on':'')+'" data-tab="modules">تمارين أساسية</button>'+
  '</div>';

  html+='<div class="dpane">';
  if(TAB==='profile'){html+=profileTab(p);}
  else if(TAB==='modules'){html+=modulesTab();}
  else if(TAB==='coach'){html+=coachTab();}
  else if(TAB==='analysis'){html+=analysisTab();}
  else{html+='<div class="ef-dbody"><div class="ef-left">'+sideCol()+'</div><div class="ef-right">'+todayCard()+'</div></div>';}
  html+='</div>';/* /dpane */

  if(MOB){html+='<div class="dhact bottom"><button class="dhbtn" id="dlPlan">تحميل الخطة</button><a class="dhbtn" href="index.html">خطة جديدة</a></div>';}

  html+='</div>';/* /wrap */

  /* مؤقت الراحة العائم (موبايل فقط) */
  if(MOB&&TAB!=='modules'){html+=floatTimer();}

  /* finish modal + toast */
  html+='<div class="modal" id="modal"><div class="modalbox"><div class="mi done-ic">✓</div><h2>جلسة مكتملة</h2><p id="msum"></p><button id="modalOk">حسنا</button></div></div>';
  html+='<div class="toast" id="toast"></div>';
  html+=notifBellHtml()+notifPanelHtml()+addexModalHtml();

  $('dashRoot').innerHTML=html;
  animate({commitment:commitment(),weight:bodyWeight(),sets:setsThisWeek(),deload:deload});
  bind();
}

function profileModalHtml(p){
  p=p||{};
  function row(l,v){return '<div class="pfrow"><span class="pfl">'+esc(l)+'</span><span class="pfv">'+esc(v==null||v===''?'—':String(v))+'</span></div>';}
  var gender=p.gender==='female'?'أنثى':(p.gender==='male'?'ذكر':(p.gender||'—'));
  var days=PLAN.days_per_week||PLAN.freq||(PLAN.days&&PLAN.days.length)||null;
  var weak=(PLAN.weak||[]).map(function(k){return (typeof MLABEL!=='undefined'&&MLABEL[k])||k;}).join('، ');
  var h='<div class="pfmodal" id="pfmodal"><div class="pfbox">';
  h+='<div class="pfhd"><button class="pfx" id="pfClose" type="button">✕</button>'+
     '<div class="pfav">'+efAvatar(p)+'</div>'+
     '<div><h2>'+esc(p.name||'بطل')+'</h2><p class="pfsub">'+esc(p.goal_label||'')+(p.exp_label?' · '+esc(p.exp_label):'')+'</p></div></div>';
  h+='<div class="pfsec">بياناتك</div><div class="pfrows">'+
    row('الاسم',p.name||'بطل')+
    row('الجنس',gender)+
    row('العمر',p.age?p.age+' سنة':'—')+
    row('الطول',p.height?p.height+' سم':'—')+
    row('الوزن',p.weight!=null?fmt1(p.weight)+' كجم':'—')+
    row('الهدف',p.goal_label)+
    row('مستوى الخبرة',p.exp_label)+
    row('أيام التدريب',days?days+' أيام/أسبوع':'—')+
    row('البرنامج',PLAN.split_name||PLAN.title)+
    (weak?row('نقاط الضعف',weak):'')+'</div>';
  h+='<div class="pfsec">مؤشراتك</div><div class="pfmetrics">'+
    '<div class="pfmetric"><b>'+esc(p.bmi!=null?p.bmi:'—')+'</b><span>'+esc(p.bmiCat||'مؤشر الكتلة')+'</span></div>'+
    '<div class="pfmetric"><b>'+esc(p.tdee!=null?p.tdee:'—')+'</b><span>سعر/يوم</span></div>'+
    '<div class="pfmetric"><b>'+esc(p.recovery!=null?p.recovery:'—')+'</b><span>الاستشفاء /100</span></div></div>';
  h+='<div class="pfacts"><button class="pfact primary" id="dlPlan">تحميل الخطة</button>'+
     '<a class="pfact" href="index.html">خطة جديدة</a></div>';
  h+='</div></div>';
  return h;
}
(function(){if(window.__efSupBound)return;window.__efSupBound=1;var EF_WA_FALLBACK='201000000000';document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('[data-ef-support]'):null;if(!a)return;e.preventDefault();function go(sup){var wa=(sup&&sup.whatsapp)||EF_WA_FALLBACK;var u='https://wa.me/'+wa+'?text='+encodeURIComponent('محتاج مساعدة بخصوص حسابي أو اشتراكي في الفورمة');window.open(u,'_blank','noopener');}if(window.EF_SUPPORT){return go(window.EF_SUPPORT);}fetch('/api/plans').then(function(r){return r.json();}).then(function(c){window.EF_SUPPORT=(c&&c.support)||{};go(window.EF_SUPPORT);}).catch(function(){go(null);});});})();function efSubSection(){var s=(window.EF_SUB)||{plan:'free',status:'active'};var PA={free:'مجاني',m1:'اشتراك شهر',m3:'اشتراك 3 شهور',m6:'اشتراك 6 شهور'};var paid=s.plan&&s.plan!=='free'&&s.status==='active';var end=s.current_period_end||null;var dl=end?Math.ceil((new Date(end)-new Date())/86400000):null;var endTxt=end?new Date(end).toLocaleDateString('ar-EG'):'—';var badge=paid?'<span class="ef-sub-badge on">مفعل</span>':'<span class="ef-sub-badge free">مجاني</span>';var h='<div class="ef-prof-sec">الاشتراك</div><div class="ef-sub-box">';h+='<div class="ef-sub-top"><div class="ef-sub-plan">'+esc(paid?(PA[s.plan]||s.plan):'الباقة المجانية')+'</div>'+badge+'</div>';if(paid){h+='<div class="ef-sub-meta">'+(dl!=null?(dl>0?('متبقي '+dl+' يوم'):'انتهى الاشتراك'):'نشط')+(end?(' · ينتهي '+endTxt):'')+'</div>';}var showRenew=paid&&dl!=null&&dl<=10;if(!paid){h+='<a class="ef-sub-cta" href="/#pricing">فعل اشتراكك الآن</a>';}else if(showRenew){h+='<a class="ef-sub-cta" href="/#pricing">تجديد الاشتراك</a>';}h+='</div>';return h;}
try{var _efRe=function(){try{if(TAB==='profile'){PLAN=load('forma_plan',PLAN)||PLAN;PROFILE=PLAN.profile||PROFILE;if(typeof render==='function')render();}}catch(e){}};window.addEventListener('focus',_efRe);document.addEventListener('visibilitychange',function(){if(!document.hidden)_efRe();});}catch(e){}
function profileTab(p){
  p=p||{};
  function row(l,v){return '<div class="ef-prof-row"><span class="ef-prof-l">'+esc(l)+'</span><span class="ef-prof-v">'+esc(v==null||v===''?'—':String(v))+'</span></div>';}
  var gender=p.gender==='female'?'أنثى':(p.gender==='male'?'ذكر':(p.gender||'—'));
  var days=PLAN.days_per_week||PLAN.freq||(PLAN.days&&PLAN.days.length)||null;
  var weak=(PLAN.weak||[]).map(function(k){return (typeof MLABEL!=='undefined'&&MLABEL[k])||k;}).join('، ');
  var h='<div class="ef-prof">';
  h+='<div class="ef-prof-hd"><div class="ef-prof-av">'+efAvatar(p)+'</div><div><h2>'+esc(p.name||'بطل')+'</h2><p class="ef-prof-sub">'+esc(p.goal_label||'')+(p.exp_label?' · '+esc(p.exp_label):'')+'</p></div></div>';
  h+='<div class="ef-prof-sec">بياناتك</div><div class="ef-prof-rows">'+
    row('الاسم',p.name||'بطل')+row('الجنس',gender)+row('العمر',p.age?p.age+' سنة':'—')+row('الطول',p.height?p.height+' سم':'—')+row('الوزن',p.weight!=null?fmt1(p.weight)+' كجم':'—')+row('الهدف',p.goal_label)+row('مستوى الخبرة',p.exp_label)+row('أيام التدريب',days?days+' أيام/أسبوع':'—')+row('البرنامج',PLAN.split_name||PLAN.title)+(weak?row('نقاط الضعف',weak):'')+'</div>';
  h+='<div class="ef-prof-sec">مؤشراتك</div><div class="ef-prof-metrics">'+
    '<div class="ef-prof-metric"><b>'+esc(p.bmi!=null?p.bmi:'—')+'</b><span>'+esc(p.bmiCat||'مؤشر الكتلة')+'</span></div>'+
    '<div class="ef-prof-metric"><b>'+esc(p.tdee!=null?p.tdee:'—')+'</b><span>سعر/يوم</span></div>'+
    '<div class="ef-prof-metric"><b>'+esc(p.recovery!=null?p.recovery:'—')+'</b><span>الاستشفاء /100</span></div></div>';
  h+=efSubSection();h+='<div class="ef-prof-acts"><button class="ef-prof-act primary" id="dlPlan">تحميل الخطة</button><a class="ef-prof-act" href="index.html">خطة جديدة</a><a class="ef-prof-act" data-ef-support target="_blank" rel="noopener" href="https://wa.me/201000000000">تواصل مع الدعم</a></div>';
  h+='</div>';
  return h;
}
function dialCard(rid,vid,label,sub,color){
  var st=color==='peach'?'#E8A020':'#2F9E6B';
  return '<div class="ef-kpi"><div class="ef-dial"><svg viewBox="0 0 56 56" width="56" height="56"><circle cx="28" cy="28" r="22" fill="none" stroke="#E2E0D8" stroke-width="6"/>'+
    '<circle id="'+rid+'" cx="28" cy="28" r="22" fill="none" stroke="'+st+'" stroke-width="6" stroke-linecap="round" stroke-dasharray="138" stroke-dashoffset="138" transform="rotate(-90 28 28)"/></svg>'+
    '<span class="ef-dialc" id="'+vid+'" style="color:'+st+'">0</span></div><div class="ef-kpi-info"><div class="ef-lbl">'+esc(label)+'</div><div class="ef-sub">'+esc(sub)+'</div></div></div>';
}
function spotCard(){
  return '<div class="kpi spot"><div class="sl">أبرز تطور</div><div class="big" id="spotM">—</div>'+
    '<div class="spstats"><div><small>أعلى وزن</small><b id="spotW">—</b></div><div><small>تكرارات</small><b id="spotR">—</b></div></div></div>';
}

function animate(k){
  var _hp=$('heroPct');if(_hp)_hp.textContent=(k.commitment||0)+'%';setRing($('heroRing'),k.commitment,251);var _hb=$('heroBar');if(_hb)_hb.style.width=(k.commitment||0)+'%';
  countUp($('cW'),k.weight,'');setRing($('dialW'),k.weight?62:0,138);
  countUp($('cS'),k.sets,'');setRing($('dialS'),Math.min(100,(k.sets||0)/Math.max(1,plannedSetsWeek())*100),138);
  var _cd=$('cD');if(k.deload>0){countUp(_cd,k.deload,'');}else if(_cd){_cd.innerHTML='الآن';}
  setRing($('dialD'),MESO>0?((MESO-k.deload)/MESO*100):100,138);
  var sp=topProgress();
  var _sm=$('spotM');if(_sm)_sm.textContent=sp?(muDisp(sp.muscle)||sp.name):'ابدأ التسجيل';
  var _sw=$('spotW');if(_sw)_sw.textContent=sp?fmt1(sp.weight)+' كجم':'—';
  var _sr=$('spotR');if(_sr)_sr.textContent=(sp&&sp.reps)?sp.reps+' عدة':'—';
}

function todayCard(){
  var day=PLAN.days[SEL];var exs=(day.exercises||[]);
  function _hasBase(ex){var lg2=LOGS[day.key+'|'+ex.name];return !!(lg2&&lg2.weight);}
  var noBase=exs.some(function(e){return !_hasBase(e);});
  var dnm=(day.name||'').split('—')[0].trim()||('يوم '+(SEL+1));
  var h='<div class="ef-excard">';
  h+='<div class="ef-daytabs">';
  PLAN.days.forEach(function(d,i){var dn=isDone(d.key);var nm=(d.name||'').split('—')[0].trim()||('يوم '+(i+1));h+='<span class="daytab'+(i===SEL?' on':'')+(dn?' done':'')+'" data-i="'+i+'">'+esc(nm)+(dn?' ✔':'')+'</span>';});
  h+='</div>';
  h+='<div class="ef-subhead"><h3>'+esc(dnm)+'</h3><span class="ef-notice">'+(noBase?'سجل أول وزن ليبدأ التطوير':'اضغط لتعديل أوزانك')+'</span></div>';
  exs.forEach(function(e,i){
    var key=day.key+'|'+e.name;var lg=LOGS[key]||{};var vid=vurl(e.video);
    var sw=suggestWeight(day.key,e);var top=topRep(e.reps);
    var op=(OPEN[key]||(i===0&&OPEN[key]!==false))?' open':'';
    var muscleLbl=e.muscle?muDisp(e.muscle):'';
    h+='<div class="ex'+op+'" data-key="'+esc(key)+'">'+
      '<div class="exhead" data-toggle="'+esc(key)+'">'+
        '<div class="exnum">'+(i+1)+'</div>'+
        '<div class="exmain"><div class="exname">'+esc(e.name)+'</div>'+
          '<div class="exmeta">'+(muscleLbl?'<span class="mchip">'+esc(muscleLbl)+'</span>':'')+'<span class="mchip">'+e.sets+' سيت × '+esc(e.reps)+'</span>'+'<span class="mchip">⏱ '+esc(fmtRest(e.rest))+'</span>'+(e.rir?'<span class="mchip">شدة '+esc(e.progRir||e.rir)+'</span>':'')+(e.tempo?'<span class="mchip">إيقاع '+esc(e.tempo)+'</span>':'')+'</div>'+
          '<div class="exprog">'+esc(suggestText(day.key,e))+'</div></div>'+
        '<div class="exkg"><b>'+(sw!=null?fmt1(sw):'—')+'</b><span>كجم مقترح</span></div>'+
        (vid?'<a class="vid" href="'+esc(vid)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">▶ فيديو</a>':'')+
      '</div>'+
      '<div class="setlog">'+
        '<div class="setrow h"><span>وزن (كجم)</span><span>تكرار</span><span>تم</span></div>'+
        '<div class="setrow"><input type="number" inputmode="decimal" data-k="'+esc(key)+'" data-f="weight" value="'+(lg.weight||'')+'" placeholder="'+(sw!=null?fmt1(sw):'')+'"><input type="number" inputmode="numeric" data-k="'+esc(key)+'" data-f="reps" value="'+(lg.reps||'')+'" placeholder="'+top+'"><button class="chk'+(lg.done?' on':'')+'" data-done="'+esc(key)+'">'+(lg.done?'✓':'')+'</button></div>'+
      '</div>'+
    '</div>';
  });
  h+='<div class="ef-finish-wrap"><button class="ef-finish" id="finishBtn">'+(isDone(day.key)?'تحديث بيانات الجلسة':'أنه جلستك وشاهد تقييمك')+'</button></div>';
  h+='</div>';
  return h;
}
function coachTip(){
  var MOTIV=[
    'الاستمرارية تصنع النتائج، حضورك اليوم استثمار في نسختك القادمة',
    'كل مجموعة أتممتها تقربك خطوة، الإجهاد مؤقت والتطور دائم',
    'الأوزان التي تسجلها هي خريطة تطورك — لا تتهاون في التدوين',
    'لا يوجد تقدم صغير. كل زيادة في الوزن تعني عضلة أكثر قوة',
    'العقل يستسلم قبل الجسد. قرر الاستمرار',
    'الراحة جزء من التدريب، لكن الحضور هو الفارق',
    'برنامجك مبني على أسس علمية — ثق في التدرج وأده بدقة',
    'أوزان اليوم ستصبح سقف الأمس',
    'الالتزام ليس شعورا، هو قرار يتخذ كل يوم',
    'جسمك يتكيف مع ما تعرضه له — عرضه للتحدي الصحيح',
    'التكرار المتقن يساوي عشرة تكرارات مهملة',
    'الأسلوب الصحيح دائما قبل الوزن الأثقل',
    'كل أسبوع تتدرب فيه يضاف إلى رصيدك العضلي',
    'النتائج لا تظهر في اليوم العشرين، لكنها تبنى فيه',
    'الفارق بين شخصين بدآ معا هو من واظب'
  ];
  var day=PLAN.days[SEL];var exs=(day.exercises||[]);
  for(var i=0;i<exs.length;i++){var lg=LOGS[day.key+'|'+exs[i].name];if(lg&&lg.weight&&(+lg.reps||0)>=topRep(exs[i].reps))return 'وصلت للحد الأعلى في «'+exs[i].name+'». في جلستك القادمة، زد '+incFor(exs[i].name)+' كجم وابدأ من الحد الأدنى للتكرار';}
  return MOTIV[new Date().getDate()%MOTIV.length];
}

function floatTimer(){
  return '<div class="tfab" id="tfab">'+
    '<div class="tfab-panel" id="tfabPanel">'+
      '<div class="tfab-hd"><span class="tstate" id="tstate">مؤقت الراحة</span><button class="tfab-x" id="tfabClose" title="إغلاق">✕</button></div>'+
      '<div class="tring" id="tring" title="اضغط لبدء/إيقاف الراحة"><svg width="96" height="96" viewBox="0 0 160 160"><circle cx="80" cy="80" r="70" fill="none" stroke="#eef1ec" stroke-width="12"/>'+
      '<circle id="tprog" cx="80" cy="80" r="70" fill="none" stroke="var(--mint)" stroke-width="12" stroke-linecap="round" stroke-dasharray="440" stroke-dashoffset="0" transform="rotate(-90 80 80)"/></svg><div class="tval" id="tval">1:30</div></div>'+
      '<div class="presets"><button class="pbtn" data-s="60">60ث</button><button class="pbtn on" data-s="90">90ث</button><button class="pbtn" data-s="120">120ث</button></div>'+
      '<button class="restbtn" id="restbtn">بدء الراحة</button>'+
    '</div>'+
    '<button class="tfab-toggle" id="tfabToggle" title="مؤقت الراحة"><span class="tfab-ic">⏱</span><span class="tfab-mini" id="tfabMini"></span></button>'+
  '</div>';
}
function sideCol(){
  var h='<div class="ef-card"><div class="ef-card-t">⏱مؤقت الراحة</div>'+
    '<div class="ef-tring-wrap"><div class="ef-tring" id="tring" title="اضغط لبدء/إيقاف الراحة"><svg width="108" height="108" viewBox="0 0 160 160"><circle cx="80" cy="80" r="70" fill="none" stroke="#E2E0D8" stroke-width="12"/>'+
    '<circle id="tprog" cx="80" cy="80" r="70" fill="none" stroke="#2F9E6B" stroke-width="12" stroke-linecap="round" stroke-dasharray="440" stroke-dashoffset="0" transform="rotate(-90 80 80)"/></svg><span class="ef-tval" id="tval">1:30</span></div></div>'+
    '<div class="ef-timer-hint" id="tstate">اختر مدة الراحة ثم ابدأ</div>'+
    '<div class="ef-presets presets"><button class="pbtn" data-s="60">60 ث</button><button class="pbtn on" data-s="90">90 ث</button><button class="pbtn" data-s="120">120 ث</button></div>'+
    '<button class="ef-restbtn restbtn" id="restbtn">بدء الراحة</button></div>';
  h+=cycleCard();
  return h;
}
function cycleCard(){
  var focus=(PLAN.weak||[]);
  var pct=Math.round(MWEEK/MESO*100);
  var h='<div class="ef-card"><div class="ef-card-t">دورة التطور</div>';
  h+='<div class="ef-cyc-head"><span class="ef-cyc-label">'+(DELOAD?'أسبوع التخفيف':('أسبوع '+MWEEK+' من '+MESO))+'</span><span class="ef-cyc-pct">'+pct+'%</span></div>';
  h+='<div class="ef-cyc-track">';
  for(var w=1;w<=MESO;w++){var cls=w<MWEEK?' done':(w===MWEEK?' cur':'');h+='<div class="ef-cseg'+cls+'"></div>';}
  h+='</div></div>';
  h+='<div class="ef-note"><div class="ef-note-top">التزامك اليوم</div><p>الراحة جزء من التدريب. التزم بالأوزان والتكرارات وسجل كل مجموعة لتتطور بثبات</p></div>';
  if(focus.length){h+='<div class="ef-card"><div class="ef-card-t">تركيزك الخاص</div><div class="ef-focus">'+focus.map(function(f){return '<span class="ef-fc">'+esc(MLABEL[f]||f)+'</span>';}).join('')+'</div></div>';}
  return h;
}

/* ---- helper units MOBILE: rest timer + clean tappable grid of OUR modules ---- */
function modulesTabMobile(cat){
  var ic={warmup:'',cardio:'',core:'',stretch:'',yoga:'',breath:'',recovery:'',kegel:''};
  var h='<h2 class="sech">وحداتنا المساعدة</h2>';
  function _mcard(m){var open=OPEN['mod_'+m.key];var s='<div class="modcard'+(open?' open':'')+'" data-modtoggle="'+esc(m.key)+'"><div class="mc-ic">'+(ic[m.key]||'')+'</div><div class="mc-t">'+esc(m.title)+'</div><div class="mc-s">'+esc(m.tagline||'')+'</div><div class="mc-c">'+(m.items||[]).length+' تمارين</div></div>';
    if(open){
      s+='<div class="modopen"><div class="mguide">'+esc(m.guide||'')+'</div><div class="mitems">';
      (m.items||[]).forEach(function(e){var vid=vurl(e.video);s+='<div class="mitem"><div class="mi-main"><div class="mi-n">'+esc(e.name)+'</div>'+(e.desc?'<div class="mi-d">'+esc(e.desc)+'</div>':'')+'</div><div class="mi-side">'+(e.dose?'<span class="mi-dose">'+esc(e.dose)+'</span>':'')+(vid?'<a class="mi-v" href="'+esc(vid)+'" target="_blank" rel="noopener"><svg class="vico" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg><span>فيديو</span></a>':'')+'</div></div>';});
      s+='</div></div>';
    }
    return s;}
  var _ess=cat.filter(function(m){return ESS_MODS.indexOf(m.key)>-1;});
  var _ext=cat.filter(function(m){return ESS_MODS.indexOf(m.key)<0;});
  h+='<div class="modgrid">'+_ess.map(_mcard).join('')+'</div>';
  if(_ext.length){h+='<details open class="hextras" style="margin-top:14px;border:1px solid rgba(0,212,170,.22);border-radius:14px;padding:12px;background:rgba(0,212,170,.04)"><summary style="cursor:pointer;font-weight:800;color:#2dd4a0">إضافات صحية اختيارية — '+_ext.length+' وحدات</summary><div class="modgrid" style="margin-top:12px">'+_ext.map(_mcard).join('')+'</div></details>';}
  return h;
}

/* ---- helper units (وحدات مساعدة) — in-dashboard tab, GRID, persisted ---- */
function modulesTab(){
  var cat=PLAN.modules||[];
  if(!cat.length)return '<div class="card"><div class="muted">مفيش تمارين أساسية متاحة في الخطة دي</div></div>';
  if(MOB)return modulesTabMobile(cat);
  var on=cat.filter(function(m){return MSEL.indexOf(m.key)>-1;}).length;
  var h='<div class="card modpanel"><h3>تمارين أساسية لأداء أفضل <span class="pill">'+on+' / '+cat.length+' مفعل</span></h3>'+
    '<div class="muted" style="margin:2px 0 14px">كل الوحدات مستوردة من المحرك الأساسي — فعل اللي يناسبك واختياراتك بتتحفظ تلقائيا</div>';
  function _modCard(m){var act=MSEL.indexOf(m.key)>-1;var open=OPEN['mod_'+m.key];var s='<div class="modc'+(act?' active':'')+(open?' open':'')+'" data-mod="'+esc(m.key)+'">'+
      '<div class="modc-top">'+
        '<button class="modtoggle'+(act?' on':'')+'" data-k="'+esc(m.key)+'"><span class="kn"></span></button>'+
        '<div class="modc-h" data-modtoggle="'+esc(m.key)+'"><div class="mt">'+esc(m.title)+'</div><div class="mtag">'+esc(m.tagline||'')+'</div></div>'+
        '<span class="mcount">'+(m.items||[]).length+' تمارين</span>'+
      '</div>'+
      '<div class="modc-body"><div class="mguide">'+esc(m.guide||'')+'</div><div class="mitems">';
    (m.items||[]).forEach(function(e){var vid=vurl(e.video);s+='<div class="mitem"><div class="mi-main"><div class="mi-n">'+esc(e.name)+'</div>'+(e.desc?'<div class="mi-d">'+esc(e.desc)+'</div>':'')+'</div><div class="mi-side">'+(e.dose?'<span class="mi-dose">'+esc(e.dose)+'</span>':'')+(vid?'<a class="mi-v" href="'+esc(vid)+'" target="_blank" rel="noopener"><svg class="vico" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg><span>فيديو</span></a>':'')+'</div></div>';});
    s+='</div></div></div>';return s;}
  var _ess=cat.filter(function(m){return ESS_MODS.indexOf(m.key)>-1;});
  var _ext=cat.filter(function(m){return ESS_MODS.indexOf(m.key)<0;});
  h+='<div class="mods">'+_ess.map(_modCard).join('')+'</div>';
  if(_ext.length){h+='<details open class="hextras" style="margin-top:16px;border:1px solid rgba(0,212,170,.22);border-radius:14px;padding:12px 14px;background:rgba(0,212,170,.04)"><summary style="cursor:pointer;font-weight:800;color:#2dd4a0">إضافات صحية اختيارية — '+_ext.length+' وحدات (اضغط للعرض)</summary><div class="muted" style="margin:8px 0 4px;font-size:12px">تنفس، كيجل، يوجا، وتعاف — تحسينات اختيارية لصحتك العامة، مش جزء أساسي من جدول الحديد</div><div class="mods" style="margin-top:12px">'+_ext.map(_modCard).join('')+'</div></details>';}
  h+='</div>';
  return h;
}

/* ---- smart coach tab ---- */
function coachTab(){
  var S=window.Coach?Coach.summary(PLAN,LOGS,MWEEK,MESO,PROFILE):null;
  var st=window.Coach?Coach.state():{notes:[],splitAdvice:''};
  var h='<div class="card coachcard"><h3>مدربك الذكي</h3>';
  h+='<div class="phase"><div class="ph"><b>'+MWEEK+'/'+MESO+'</b><span>أسبوع الدورة</span></div><div class="ph"><b>'+(DELOAD?'ديلود':'تحميل')+'</b><span>المرحلة</span></div><div class="ph"><b>'+(S?S.rir:'-')+'</b><span>RIR مستهدف</span></div></div>';
  if(DELOAD)h+='<div class="dnote">أسبوع تخفيف — حمل أخف وراحة أطول عشان الجسم يستشفي ويفرغ التعب قبل دورة جديدة</div>';
  if(S&&S.lines.length){h+='<h4 class="csec">ملاحظات على أدائك</h4><div class="obs">'+S.lines.map(function(l){return '<div class="ob"><span class="obi">'+l.icon+'</span><span>'+esc(l.text)+'</span></div>';}).join('')+'</div>';}
  if(S&&S.muscles.length){h+='<h4 class="csec">الحجم الأسبوعي لكل عضلة <small>(مقابل السقف الآمن MRV)</small></h4><div class="mvol">';S.muscles.forEach(function(m){var pct=Math.min(100,Math.round(m.sets/Math.max(1,m.cap)*100));var warn=m.sets>=m.cap;h+='<div class="abrow"><span class="abk">'+esc(muDisp(m.label))+'</span><div class="abtrack"><i class="abfill'+(warn?' warn':'')+'" style="width:'+pct+'%"></i></div><span class="abv">'+m.sets+'/'+m.cap+'</span></div>';});h+='</div>';}
  if(st.splitAdvice)h+='<div class="dnote warn">'+esc(st.splitAdvice)+'</div>';
  var _DAY2=2*86400000,_nowD=Date.now();
  var _fresh=(st.notes||[]).filter(function(n){return n&&n.ts&&(_nowD-n.ts)<=_DAY2;});
  if(_fresh.length){var _dec=_fresh.filter(function(n){var _t=n.text||'';return !/^(ملخص الجلسة|سجلنا وزن البداية|جلسة ديلود|تقييم أسبوع|ACWR)/.test(_t);});if(_dec.length){h+='<h4 class="csec">سجل قرارات المدرب</h4><div class="muted" style="font-size:11px;margin:-4px 0 8px">تعديلات ونصائح اتنفذت أو هتتنفذ على جدولك</div><div class="clog">'+_dec.slice(0,12).map(function(n){return '<div class="cl"><span class="cli">'+n.icon+'</span><span class="clt">'+esc(n.text)+'</span></div>';}).join('')+'</div>';}}
  h+='</div>';
  return h;
}

/* ---- toast ---- */
/* ---- downloadable / printable plan (phone-friendly: Save as PDF) ---- */
function planToHTML(){
 var p=PLAN,prof=PROFILE||{};
 var phase=DELOAD?'أسبوع تخفيف':'أسبوع تحميل';
 function safe(x){return esc(x==null?'':x)}
 function vv(vid){return vurl(vid||'')}
 function vcell(vid){var u=vv(vid);return u?'<a class="vbtn" href="'+safe(u)+'" target="_blank" rel="noopener">شاهد الفيديو</a>':'<span class="novid">—</span>';}
 function vchip(vid){var u=vv(vid);return u?'<a class="m vid" href="'+safe(u)+'" target="_blank" rel="noopener"><span class="vico">▶</span> فيديو</a>':'<span class="m novid"><i>الفيديو</i><b>—</b></span>';}
 // Report a broken/wrong exercise video.
 // The endpoint is /api/app/video-report (api/mobile.js#reportVideo). It reads
 // the session COOKIE -- there is no Bearer-token route -- and expects
 // camelCase keys (exerciseKey/exerciseName/videoId/reason).
 function _reportVideo(exName,vidUrl){
   if(!confirm('تبليغ عن فيديو التمرين: '+exName+'\nهيتبعت للمدرب عشان يعدّل الرابط. نكمّل؟'))return;
   var say=function(msg,kind){ if(window.EFToast&&EFToast.show){EFToast.show(msg,kind||'ok');} else {alert(msg);} };
   fetch('/api/app/video-report',{
     method:'POST',
     credentials:'same-origin',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({exerciseKey:exName,exerciseName:exName,videoId:vidUrl||'',reason:'user_report'})
   }).then(function(r){
     if(r.ok){ say('تم التبليغ ✔ هنراجع الرابط قريبًا','ok'); }
     else if(r.status===401){ say('لازم تسجّل دخول الأول عشان تبلّغ','err'); }
     else if(r.status===429){ say('بلاغات كتيرة في وقت قصير، جرّب بعد شوية','err'); }
     else { say('تعذّر إرسال التبليغ، جرّب تاني','err'); }
   }).catch(function(){ say('تعذّر إرسال التبليغ، اتأكد من الاتصال','err'); });
 }

 // Delegated handler: the report buttons are re-rendered on every plan paint,
 // so binding per-button (or via inline onclick, which cannot see a function
 // scoped to this module) would break. One listener on document covers all.
 if(!window.__efVideoReportBound){
   window.__efVideoReportBound=true;
   document.addEventListener('click',function(ev){
     var btn=ev.target&&ev.target.closest&&ev.target.closest('.ef-vid-report');
     if(!btn)return;
     ev.preventDefault();
     _reportVideo(btn.getAttribute('data-ex')||'',btn.getAttribute('data-vid')||'');
   });
 }
 function vrow(vid,exName){
   var u=vv(vid);
   if(!u){
     return '<div class="ex-video novideo"><span class="vbtn2-ic"></span>'+
            '<span class="vbtn2-tx"><b>لا يوجد فيديو لهذا التمرين</b>'+
            '<small>اسأل مدربك عن طريقة الأداء الصحيحة</small></span></div>';
   }
   // Values go into HTML attributes, so they must be escaped -- never inlined
   // into an onclick string.
   var rptBtn='<button type="button" class="ef-vid-report"'+
     ' data-ex="'+safe(exName||'')+'" data-vid="'+safe(vid||'')+'"'+
     ' title="بلغ عن رابط خطأ">'+
     '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'+
     '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zm0 7v-7"/></svg>'+
     ' بلغ عن الفيديو</button>';
   return '<div class="ex-video">'+
     '<a class="vbtn2" href="'+safe(u)+'" target="_blank" rel="noopener">'+
     '<span class="vbtn2-ic">▶</span><span class="vbtn2-tx">'+
     '<b>شاهد شرح التمرين بالفيديو</b><small>طريقة الأداء الصحيحة خطوة بخطوة</small>'+
     '</span></a>'+rptBtn+'</div>';
 }
 function stat(label,value){return '<div class="stat"><span>'+safe(label)+'</span><b>'+safe(value||'—')+'</b></div>';}
 function goalAr(g){var m={cut:'تنشيف',muscle:'ضخامة عضلية',strength:'قوة',fitness:'لياقة'};return m[g]||g||'—';}
 function expAr(x){var m={beginner:'مبتدئ',intermediate:'متوسط',advanced:'متقدم','مبتدئ':'مبتدئ','متوسط':'متوسط','متقدم':'متقدم'};return m[x]||x||'—';}
 var goalTxt=goalAr(p.goal||prof.goal||p.goal_label||prof.goal_label);
 var expTxt=expAr(prof.exp||prof.exp_label);
 var palette=['#00D4AA','#22B8CF','#5B8BDB','#FF9266','#9A5FDD','#00A87F','#38BDF8'];
 var days=(p.days||[]).map(function(d,i){
  var accent=palette[i%palette.length];
  var rows=(d.exercises||[]).map(function(e,idx){
   return '<article class="ex"><div class="ex-top"><span class="ex-idx">'+(idx+1)+'</span><div class="ex-titles"><b class="ex-name">'+safe(e.name)+'</b>'+(e.muscle?'<span class="ex-def">'+safe(muDisp(e.muscle))+'</span>':'')+'</div></div><div class="ex-chips"><span class="m"><i>المجموعات</i><b>'+safe(e.sets||'-')+'</b></span><span class="m"><i>التكرار</i><b>'+safe(e.reps||'-')+'</b></span><span class="m"><i>الراحة</i><b>'+safe(fmtRest(e.rest))+'</b></span>'+(e.rir?'<span class="m"><i>الشدة (RIR)</i><b>'+safe(e.progRir||e.rir)+'</b></span>':'')+(e.tempo?'<span class="m"><i>الإيقاع</i><b>'+safe(e.tempo)+'</b></span>':'')+'</div>'+vrow(e.video||e.v||'')+(e.progression?'<div class="ex-prog"><span class="ex-prog-ic"></span><span>'+safe(e.progression)+'</span></div>':'')+'</article>';
  }).join('');
  return '<section class="day" style="--accent:'+accent+'"><h2><span>اليوم '+(i+1)+'</span>'+safe((d.name||('اليوم '+(i+1))).split('—')[0].trim())+'</h2><div class="exlist">'+rows+'</div></section>';
 }).join('');
 var sel=(typeof MSEL!=='undefined'&&MSEL)?MSEL:((p.activeModules)||[]);
 var actMods=(p.modules||[]).filter(function(m){return sel.indexOf(m.key)>-1;});
 function _modSec(m,mi){
  var accent=palette[(mi+(p.days||[]).length)%palette.length];
  var mr=(m.items||[]).map(function(e,idx){return '<article class="ex"><div class="ex-top"><span class="ex-idx">'+(idx+1)+'</span><div class="ex-titles"><b class="ex-name">'+safe(e.name)+'</b>'+(e.desc?'<span class="ex-def">'+safe(e.desc)+'</span>':'')+'</div></div><div class="ex-chips"><span class="m"><i>الجرعة</i><b>'+safe(e.dose||'—')+'</b></span></div>'+vrow(e.video)+'</article>';}).join('');
  return '<section class="day mod" style="--accent:'+accent+'"><h2><span>وحدة</span>'+safe(m.title||m.name||'وحدة مساعدة')+'</h2><div class="exlist">'+mr+'</div></section>';
 }
 var ESS_X=['cardio','warmup','stretch','core'];
 var essMods=actMods.filter(function(m){return ESS_X.indexOf(m.key)>-1;});
 var xtraMods=actMods.filter(function(m){return ESS_X.indexOf(m.key)<0;});
 var mods=essMods.map(_modSec).join('');
 var xmods=xtraMods.map(function(m,mi){return _modSec(m,mi+essMods.length);}).join('');
 var meta='خطة تدريب شخصية · '+safe(p.split_name||p.title||'برنامج')+' · '+safe((p.days||[]).length)+' أيام أسبوعيا';
 var legend='<section class="legend-wrap"><h2 class="sect-title">كيف تقرأ خطتك؟</h2><div class="legend"><div class="lg"><b>المجموعات</b><span>عدد الجولات اللي هتعملها في التمرين الواحد</span></div><div class="lg"><b>التكرار</b><span>عدد مرات تكرار الحركة في كل مجموعة</span></div><div class="lg"><b>الراحة</b><span>مدة الراحة بين كل مجموعة والتانية</span></div><div class="lg"><b>الشدة (RIR)</b><span>عدد التكرارات اللي تقدر تزودها قبل ما تتعب تماما — كل ما الرقم قل زادت صعوبة المجموعة</span></div><div class="lg"><b>الإيقاع</b><span>سرعة أداء الحركة بالثواني (نزول · ثبات · رفع)</span></div></div></section>';
 return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>خطة تمرين ElForma</title><style>'+ 
 '*{box-sizing:border-box}body{margin:0;background:#0D1B2A;color:#E8F4F1;font-family:Arial,Tahoma,sans-serif;line-height:1.7}.page{max-width:1040px;margin:0 auto;padding:28px 20px 40px}.cover{display:flex;align-items:center;gap:18px;background:linear-gradient(135deg,#162436,#102f29);border:1px solid #1E3A50;border-radius:26px;padding:20px 22px;margin-bottom:18px}.logo{width:96px;height:70px;object-fit:contain}.brand{flex:1}.brand small{display:block;color:#00D4AA;font-weight:900;letter-spacing:.6px}.brand h1{margin:3px 0;font-size:30px;line-height:1.2;color:#F3FFFC}.brand p{margin:0;color:#A6CECB}.badge{background:rgba(0,212,170,.12);border:1px solid rgba(0,212,170,.35);color:#00D4AA;border-radius:999px;padding:7px 13px;font-weight:900;white-space:nowrap}.stats-wrap{margin:22px 0}.sect-title{display:flex;align-items:center;gap:9px;font-size:16px;color:#00D4AA;font-weight:900;margin:0 0 13px}.sect-title::before{content:"";width:5px;height:20px;border-radius:3px;background:linear-gradient(180deg,#00D4AA,#22B8CF)}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:11px}.stat{position:relative;background:linear-gradient(150deg,#18293c,#11202f);border:1px solid #244257;border-radius:16px;padding:16px 15px 14px;overflow:hidden}.stat::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#00D4AA,#22B8CF)}.stat span{display:block;color:#9FC4C2;font-size:12px;font-weight:600}.stat b{display:block;color:#F3FFFC;font-size:18px;font-weight:900;margin-top:6px}.day{background:#162436;border:1px solid var(--accent);border-radius:24px;overflow:hidden;margin-bottom:16px;break-inside:avoid;box-shadow:0 12px 32px rgba(0,0,0,.15)}.day h2{margin:0;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.08);font-size:22px;color:#F3FFFC;background:linear-gradient(135deg,var(--accent),#162436 52%)}.day h2 span{display:inline-flex;margin-left:9px;background:rgba(13,27,42,.7);border:1px solid rgba(255,255,255,.16);color:#F3FFFC;border-radius:999px;padding:3px 10px;font-size:12px;vertical-align:middle}.day.mod h2{color:#F3FFFC}.exlist{padding:12px;display:grid;gap:10px}.ex{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-right:4px solid var(--accent);border-radius:15px;padding:13px 15px;break-inside:avoid}.ex-top{display:flex;align-items:flex-start;gap:11px}.ex-idx{flex:0 0 auto;width:30px;height:30px;border-radius:9px;background:var(--accent);color:#06231c;font-weight:900;display:flex;align-items:center;justify-content:center;font-size:14px}.ex-titles{flex:1;min-width:0}.ex-name{display:block;color:#F3FFFC;font-size:15.5px;font-weight:800;line-height:1.35}.ex-def{display:block;color:#A6CECB;font-size:12.5px;margin-top:3px}.ex-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.ex-chips .m{display:inline-flex;flex-direction:column;align-items:center;gap:2px;background:rgba(13,27,42,.5);border:1px solid rgba(255,255,255,.09);border-radius:11px;padding:6px 14px;min-width:60px}.ex-chips .m i{font-style:normal;color:#7FA8A6;font-size:10.5px}.ex-chips .m b{color:#F3FFFC;font-size:14px;font-weight:800}.ex-chips .vid{flex-direction:row;align-items:center;gap:6px;background:var(--accent);border-color:var(--accent);font-weight:900;font-size:12.5px;text-decoration:none}.ex-chips .vid,.ex-chips .vid b{color:#06231c}.ex-chips .vid .vico{font-size:11px}.ex-chips .novid b{color:#7AACAA}.ex-prog{display:flex;gap:7px;align-items:flex-start;margin-top:10px;padding:8px 11px;background:rgba(0,212,170,.06);border:1px solid rgba(0,212,170,.15);border-radius:11px;color:#A6CECB;font-size:11.5px;line-height:1.55}.ex-prog-ic{flex:0 0 auto;font-size:13px}.ex-video{margin-top:11px}.vbtn2{display:flex;align-items:center;gap:11px;text-decoration:none;background:rgba(0,212,170,.10);border:1px solid rgba(0,212,170,.32);border-radius:13px;padding:11px 14px}.vbtn2-ic{flex:0 0 auto;width:34px;height:34px;border-radius:9px;background:var(--accent);color:#06231c;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900}.vbtn2-tx{display:flex;flex-direction:column;gap:1px}.vbtn2-tx b{color:#F3FFFC;font-size:13.5px;font-weight:800}.vbtn2-tx small{color:#A6CECB;font-size:11px}.ex-video.novideo{display:flex;align-items:center;gap:11px;background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.16);border-radius:13px;padding:11px 14px}.ex-video.novideo .vbtn2-ic{background:rgba(255,255,255,.08);color:#7FA8A6}.legend-wrap{margin:22px 0}.legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.lg{background:linear-gradient(150deg,#18293c,#11202f);border:1px solid #244257;border-radius:14px;padding:12px 14px}.lg b{display:block;color:#00D4AA;font-size:13.5px;font-weight:900;margin-bottom:3px}.lg span{color:#C5DEDB;font-size:12.5px;line-height:1.55}.foot{margin-top:18px;background:#102235;border:1px solid #1E3A50;border-radius:18px;padding:13px 16px;color:#A6CECB;font-size:13px}@media(max-width:760px){.page{padding:16px 10px 28px}.cover{align-items:flex-start;padding:15px}.logo{width:74px;height:54px}.brand h1{font-size:23px}.stats{grid-template-columns:repeat(2,1fr);gap:9px}.stat{padding:11px}.stat b{font-size:16px}.day h2{font-size:19px;padding:14px}.foot{font-size:12px}.legend{grid-template-columns:1fr}.vbtn2-tx b{font-size:12.5px}}'+
 '</style></head><body><main class="page"><header class="cover"><img class="logo" src="data:image/png;base64,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" alt="ElForma"><div class="brand"><small>ELFORMA TRAINING PLAN</small><h1>خطة '+safe(prof.name||'بطل')+'</h1><p>'+safe(meta)+'</p></div><div class="badge">أسبوع '+MWEEK+'/'+MESO+'</div></header><section class="stats-wrap"><h2 class="sect-title">معلومات المتدرب</h2><div class="stats">'+stat('الهدف',goalTxt)+stat('المستوى',expTxt)+stat('عدد أيام التدريب',(p.days||[]).length+' أيام')+stat('الوزن',prof.weight?(prof.weight+' كجم'):'—')+stat('الطول',prof.height?(prof.height+' سم'):'—')+stat('السن',prof.age?(prof.age+' سنة'):'—')+stat('BMI',prof.bmi||'—')+stat('السعرات التقريبية',prof.tdee?(prof.tdee+' كالوري'):'—')+stat('البرنامج',p.split_name||p.title||'—')+stat('المرحلة',phase)+stat('RIR مستهدف',(window.Coach&&Coach.analysis?((Coach.analysis(PLAN,LOGS,WEEK,MWEEK,MESO,PROFILE)||{}).rir||'-'):'-'))+'</div></section>'+legend+days+(essMods.length?'<h2 style="color:#00D4AA;margin:24px 4px 12px">وحدات مساعدة أساسية</h2><p style="color:#A6CECB;font-size:13px;margin:-6px 4px 12px">إحماء، كارديو، إطالة وتمارين كور — جزء أساسي من برنامجك علشان تتمرن بأمان وتوصل لأفضل نتيجة</p>'+mods:'')+(xtraMods.length?'<h2 style="color:#2dd4a0;margin:24px 4px 12px">إضافات صحية اختيارية</h2><p style="color:#A6CECB;font-size:13px;margin:-6px 4px 12px">تنفس، كيجل، يوجا، وتعاف — تحسينات لصحتك العامة خارج جدول الحديد</p>'+xmods:'')+'<div class="foot"><b style="color:#00D4AA">ملاحظة:</b> اضغط على فيديو لفتح الشرح، وسجل الوزن والتكرارات بعد كل تمرين عشان المدرب يطور الخطة</div></main></body></html>';
}

function downloadPlan(){
 try{
  var html=planToHTML();
  var blob=new Blob(['\ufeff'+html],{type:'text/html;charset=UTF-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  var nm=(PROFILE&&PROFILE.name?String(PROFILE.name).replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g,'_'):'athlete');
  a.href=url;
  a.download='ElForma_training_plan_'+nm+'.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function(){try{URL.revokeObjectURL(url);}catch(e){}},60000);
  toast('تم تحميل الخطة بتصميم احترافي');
 }catch(e){toast('تعذر تجهيز الخطة');}
}
function toast(msg){var t=$('toast');if(!t)return;t.textContent=msg;t.classList.add('on');clearTimeout(window._tt);window._tt=setTimeout(function(){t.classList.remove('on');},2200);}

/* ---- rest timer ---- */
var timer={dur:90,left:90,h:null};
function tfmt(s){var m=Math.floor(s/60),x=s%60;return m+':'+(x<10?'0':'')+x;}
function tStop(){if(timer.h){clearInterval(timer.h);timer.h=null;}}
function tPrimeAudio(){try{var AC=window.AudioContext||window.webkitAudioContext;if(AC){window._actx=window._actx||new AC();if(window._actx.state==='suspended')window._actx.resume();}}catch(e){}try{if(window.Notification&&Notification.permission==='default')Notification.requestPermission();}catch(e){}}
function tBeep(){try{var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;var ctx=window._actx||(window._actx=new AC());if(ctx.state==='suspended')ctx.resume();var master=ctx.createGain();master.gain.value=0.95;master.connect(ctx.destination);[0,0.24,0.48].forEach(function(d){var o=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain();o.type='square';o.frequency.value=988;o2.type='sine';o2.frequency.value=1319;o.connect(g);o2.connect(g);g.connect(master);var t0=ctx.currentTime+d;g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(0.9,t0+0.012);g.gain.setValueAtTime(0.9,t0+0.13);g.gain.exponentialRampToValueAtTime(0.0001,t0+0.22);o.start(t0);o2.start(t0);o.stop(t0+0.24);o2.stop(t0+0.24);});}catch(e){}}
function tNotify(){try{navigator.vibrate&&navigator.vibrate([400,150,400,150,400]);}catch(e){}tBeep();try{if(window.Notification&&Notification.permission==='granted')new Notification('ElForma',{body:'خلصت الراحة! ابدأ مجموعتك الجاية'});}catch(e){}toast('خلصت الراحة!');var f=$('tfab');if(f)f.classList.add('done');}
function tPaint(){var v=$('tval');if(v)v.textContent=tfmt(timer.left);var m=$('tfabMini');if(m)m.textContent=timer.h?tfmt(timer.left):'';var pr=$('tprog');if(pr){var C=440;pr.setAttribute('stroke-dashoffset',(C*(1-timer.left/timer.dur)).toFixed(1));}var f=$('tfab');if(f)f.classList.toggle('running',!!timer.h);}
function tMinFab(){var f=$('tfab');if(f)setTimeout(function(){f.classList.remove('open');},240);}
function tToggle(){
  var rb=$('restbtn');var ts=$('tstate');
  if(timer.h){tStop();if(rb)rb.textContent='بدء الراحة';if(ts)ts.textContent='متوقف — اضغط للاستئناف';tPaint();tMinFab();return;}
  if(timer.left<=0)timer.left=timer.dur;
  tPrimeAudio();
  var f0=$('tfab');if(f0)f0.classList.remove('done');
  if(rb)rb.textContent='إيقاف';if(ts)ts.textContent='راحة شغالة…';
  timer.h=setInterval(function(){timer.left--;tPaint();if(timer.left<=0){tStop();var s=$('tstate');if(s)s.textContent='خلصت الراحة!';if($('restbtn'))$('restbtn').textContent='بدء الراحة';tNotify();tPaint();}},1000);
  tPaint();tMinFab();
}

/* ---- bind ---- */
function bind(){
  bindExtra();
  var _pqt=document.querySelector('[data-pqtoggle]');if(_pqt)_pqt.onclick=function(e){e.stopPropagation();var pd=$('pqDetails');if(pd){var _op=pd.classList.toggle('open');_pqt.classList.toggle('on',_op);}};
  var hs=$('heroStart');if(hs)hs.onclick=function(){if(TAB!=='today'){TAB='today';render();}var f=document.querySelector('.ex');if(f)f.scrollIntoView({behavior:'smooth',block:'center'});};var _dl=$('dlPlan');if(_dl)_dl.onclick=downloadPlan;
  Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'),function(b){b.onclick=function(){TAB=b.getAttribute('data-tab');render();try{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;var _mb=document.querySelector('.m2-body');if(_mb)_mb.scrollTop=0;}catch(_e){}};});
  /* module activation toggle (persisted) */
  Array.prototype.forEach.call(document.querySelectorAll('.modtoggle'),function(b){b.onclick=function(e){e.preventDefault();e.stopPropagation();var k=b.getAttribute('data-k');var i=MSEL.indexOf(k);if(i>-1){MSEL.splice(i,1);toast('اتلغى تفعيل الوحدة');}else{MSEL.push(k);toast('اتفعلت الوحدة ✓');}save('forma_modules',MSEL);render();};});
  /* expand a module card */
  Array.prototype.forEach.call(document.querySelectorAll('[data-modtoggle]'),function(b){b.onclick=function(){var k='mod_'+b.getAttribute('data-modtoggle');var willOpen=!OPEN[k];Object.keys(OPEN).forEach(function(ok){if(ok.indexOf('mod_')===0)OPEN[ok]=false;});OPEN[k]=willOpen;render();};});
  /* day selector */
  Array.prototype.forEach.call(document.querySelectorAll('.wday'),function(b){b.onclick=function(){SEL=+b.getAttribute('data-i');render();};});
  Array.prototype.forEach.call(document.querySelectorAll('.daytab[data-i]'),function(b){b.onclick=function(){SEL=+b.getAttribute('data-i');render();};});
  /* expand/collapse exercise */
  Array.prototype.forEach.call(document.querySelectorAll('[data-toggle]'),function(b){b.onclick=function(e){if(e.target.closest('.vid'))return;var par=b.parentElement;var willOpen=!par.classList.contains('open');var k=b.getAttribute('data-toggle');if(willOpen){var _sel=par.classList.contains('m2-ex')?'.m2-ex.open':'.ex.open';Array.prototype.forEach.call(document.querySelectorAll(_sel),function(o){o.classList.remove('open');var ok=o.getAttribute('data-key');if(ok)OPEN[ok]=false;});}OPEN[k]=willOpen;par.classList.toggle('open',willOpen);};});
  /* inputs */
  Array.prototype.forEach.call(document.querySelectorAll('.setrow input'),function(inp){inp.onchange=function(){var k=inp.getAttribute('data-k'),f=inp.getAttribute('data-f');var cur=LOGS[k]||{};cur[f]=+inp.value||0;cur.week=WEEK;cur.ts=Date.now();LOGS[k]=cur;save('forma_logs',LOGS);};});
  /* per-exercise done check */
  Array.prototype.forEach.call(document.querySelectorAll('.chk[data-done]'),function(b){b.onclick=function(e){e.stopPropagation();var k=b.getAttribute('data-done');var cur=LOGS[k]||{};cur.done=!cur.done;cur.week=WEEK;if(cur.done){var nm=k.split('|')[1];PLAN.days[SEL].exercises.forEach(function(x){if(x.name===nm)cur.sets=+x.sets||0;});}LOGS[k]=cur;save('forma_logs',LOGS);b.classList.toggle('on',cur.done);b.textContent=cur.done?'✓':'';};});
  /* finish session */
  var fb=$('finishBtn');if(fb)fb.onclick=function(){
    var day=PLAN.days[SEL];
    var _miss=(day.exercises||[]).filter(function(e){var lg=LOGS[day.key+'|'+e.name]||{};return !((+lg.weight)>0&&(+lg.reps)>0&&lg.done);});
    if(_miss.length){toast('لسه '+_miss.length+' تمرين محتاج وزن + تكرار + علامة «تم» — كملهم الأول');var _fk=day.key+'|'+_miss[0].name;OPEN[_fk]=true;SEL=SEL;render();var _row=document.querySelector('.ex[data-key="'+_fk.replace(/"/g,'')+'"]');if(_row&&_row.scrollIntoView)_row.scrollIntoView({behavior:'smooth',block:'center'});return;}
    var cnt=0;
    var _hist=load('forma_hist',[]);
    (day.exercises||[]).forEach(function(e){var k=day.key+'|'+e.name;var cur=LOGS[k]||{};cur.done=true;cur.week=WEEK;cur.sets=+e.sets||0;LOGS[k]=cur;cnt+=(+e.sets||0);if(cur.weight){_hist.push({ts:Date.now(),week:WEEK,dayKey:day.key,exName:e.name,muscle:(window.Coach&&Coach.cmus?Coach.cmus(e):(e.cm||e.muscle||'def')),weight:+cur.weight||0,reps:+cur.reps||0,sets:+e.sets||0});}});
    if(_hist.length>1500)_hist=_hist.slice(-1500);save('forma_hist',_hist);
    DONE[doneKey(day.key,WEEK)]=true;save('forma_logs',LOGS);save('forma_done',DONE);
    var coachMsg='';
    if(window.Coach){
      Coach.applyDay(day,LOGS,WEEK,MWEEK,MESO,PROFILE);
      var sd=sessionsDone();
      if(PLAN.days.length&&sd%PLAN.days.length===0){var cw=sd/PLAN.days.length;var mw=((cw-1)%MESO)+1;var res=Coach.review(PLAN,LOGS,cw,mw,MESO,PROFILE);if(res&&res.proposed&&res.proposed.length)coachMsg='<br>مدربك عنده '+res.proposed.length+' قرار محتاج موافقتك — افتح الجرس أو تبويب «التحليل والتقييم»';}
    }
    var msum=$('msum');if(msum)msum.innerHTML='أتممت <span class="stat">'+(day.exercises||[]).length+'</span> تمارين، <span class="stat">'+cnt+'</span> مجموعة مكتملة. معدل الالتزام: <span class="stat">'+commitment()+'%</span>'+coachMsg;
    var md=$('modal');if(md)md.classList.add('on');
    WEEK=curWeek();MWEEK=((WEEK-1)%MESO)+1;DELOAD=(MWEEK===MESO);SEL=(function(){for(var i=0;i<PLAN.days.length;i++){if(!isDone(PLAN.days[i].key))return i;}return SEL;})();
  };
  var mok=$('modalOk');if(mok)mok.onclick=function(){var md=$('modal');if(md)md.classList.remove('on');render();};
  /* بروفايل الديسكتوب (modal) */
  var pb=$('profileBtn');if(pb)pb.onclick=function(){var m=$('pfmodal');if(m)m.classList.add('on');};
  var pfxBtn=$('pfClose');if(pfxBtn)pfxBtn.onclick=function(){var m=$('pfmodal');if(m)m.classList.remove('on');};
  var pfm=$('pfmodal');if(pfm)pfm.onclick=function(e){if(e.target===pfm)pfm.classList.remove('on');};
  /* timer */
  Array.prototype.forEach.call(document.querySelectorAll('.pbtn'),function(b){b.onclick=function(){Array.prototype.forEach.call(document.querySelectorAll('.pbtn'),function(x){x.classList.remove('on');});b.classList.add('on');timer.dur=+b.getAttribute('data-s');timer.left=timer.dur;tStop();if($('restbtn'))$('restbtn').textContent='بدء الراحة';var ts=$('tstate');if(ts)ts.textContent='حدد المدة وابدأ العد التنازلي';tPaint();};});
  var tr=$('tring');if(tr)tr.onclick=tToggle;
  var rb=$('restbtn');if(rb)rb.onclick=tToggle;
  var tg=$('tfabToggle');if(tg)tg.onclick=function(){var f=$('tfab');if(f){f.classList.toggle('open');f.classList.remove('done');}};
  var tx=$('tfabClose');if(tx)tx.onclick=function(e){e.stopPropagation();var f=$('tfab');if(f)f.classList.remove('open');};
  if(!timer.h){timer.left=timer.dur;}tPaint();
}

/* ---- analysis & evaluation tab (daily / weekly / monthly) ---- */
function barpc(pct){return Math.max(0,Math.min(100,Math.round(pct||0)));}
function anStat(v,l,sub){return '<div class="anstat"><b>'+esc(v==null?'—':v)+'</b><span>'+esc(l)+'</span>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</div>';}
function anEval(score,txt){var s=(score==null)?'':'<div class="anscore"><div class="anring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--mint2)" stroke-width="7"/><circle cx="40" cy="40" r="34" fill="none" stroke="var(--mint)" stroke-width="7" stroke-linecap="round" stroke-dasharray="214" stroke-dashoffset="'+(214*(1-barpc(score)/100)).toFixed(1)+'" transform="rotate(-90 40 40)"/></svg><b>'+barpc(score)+'</b></div><span>تقييم الأداء</span></div>';return '<div class="anevalrow">'+s+'<div class="anevaltxt">'+esc(txt)+'</div></div>';}
function anScopeBtns(){function b(k,l){return '<button class="anb'+(ANSCOPE===k?' on':'')+'" data-an="'+k+'">'+l+'</button>';}return '<div class="anscope">'+b('daily','يومي')+b('weekly','أسبوعي')+b('monthly','شهري')+'</div>';}
// —— بطاقة تقييم جودة الخطة (Score) ——
function planQualityCard(){
  var q=PLAN&&PLAN.quality;if(!q||q.score==null)return '';
  var col=q.score>=82?'var(--mint)':q.score>=62?'#22B8CF':'#FF9266';
  var ring='<div class="anring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--mint2)" stroke-width="7"/><circle cx="40" cy="40" r="34" fill="none" stroke="'+col+'" stroke-width="7" stroke-linecap="round" stroke-dasharray="214" stroke-dashoffset="'+(214*(1-q.score/100)).toFixed(1)+'" transform="rotate(-90 40 40)"/></svg><b>'+q.score+'</b></div>';
  var bars=(q.breakdown||[]).map(function(b){var pc=Math.round(b.got/Math.max(1,b.max)*100);var low=pc<55;var warn=pc>=55&&pc<75;return '<div class="abrow"><span class="abk">'+esc(b.label)+'</span><div class="abtrack"><i class="abfill'+(low?' low':(warn?'':' '))+'" style="width:'+pc+'%"></i></div><span class="abv">'+b.got+'/'+b.max+'</span></div>'+(b.note?'<div class="muted" style="font-size:11px;margin:-4px 0 8px">'+esc(b.note)+'</div>':'');}).join('');
  var rated=(q.breakdown||[]).map(function(b){return {b:b,r:b.got/Math.max(1,b.max)};});
  var best=rated.slice().sort(function(a,b){return b.r-a.r;})[0];
  var worst=rated.slice().sort(function(a,b){return a.r-b.r;})[0];
  var verdict=q.score>=90?'خطة احترافية متكاملة — بناء علمي دقيق يغطي كل ركائز التضخيم والقوة، كمل بثبات على التدرج.':q.score>=82?'خطة قوية ومتوازنة — أساس ممتاز للتقدم المستمر مع مساحة بسيطة للضبط.':q.score>=73?'خطة جيدة وعملية — ركائزها صحيحة وتحتاج تحسينات مدروسة عشان توصل للمثالية.':q.score>=62?'خطة مقبولة — شغالة بس فيها نقاط ضعف بتقلل عائد مجهودك، عالجها بالأولوية.':'خطة محتاجة إعادة ضبط — فيها فجوات أساسية بتأثر على نتائجك، ركز على النقاط دي الأول.';
  var adv={coverage:'وزع مجموعاتك الأسبوعية بحيث كل عضلة كبيرة تاخد حجمها الفعال — ده أكبر عامل في النمو.',frequency:'درب كل عضلة كبيرة مرتين أسبوعيا على الأقل؛ التكرار الأعلى بيزود تخليق البروتين.',balance:'وازن بين الدفع/السحب والعلوي/السفلي عشان تحمي مفاصلك وتمنع آلام الكتف والظهر.',integrity:'راجع ترتيب التمارين — المركبات قبل العزل؛ البنية السليمة بتقلل الإصابة.',recovery:'اضبط الحجم الكلي على قدرتك على الاستشفاء — النوم والأكل والراحة جزء من الخطة.',prescription:'اضبط التكرارات والراحة والشدة (RIR) لكل تمرين؛ الوصفة الكاملة بتحول المجهود لتقدم مقاس.'};
  var strong=best?('<div class="pq-ins good"><b>أقوى نقطة — '+esc(best.b.label)+'</b><span>'+esc(best.b.note||'')+'</span></div>'):'';
  var prio=worst?('<div class="pq-ins work"><b>أولوية التحسين — '+esc(worst.b.label)+'</b><span>'+esc(adv[worst.b.key]||worst.b.note||'')+'</span></div>'):'';
  return '<style>.pqcard .anring{width:62px;height:62px}.pqcard h3{margin-bottom:6px}.pqcard .cintro{margin-bottom:10px;font-size:12px}.pqcard .anevalrow{align-items:flex-start}.pqcard .anscore{flex:0 0 auto}.pqcard .anevaltxt{flex:1;min-width:0}.pq-label{display:block;font-size:16px;font-weight:800;margin-bottom:4px}.pq-verdict-tx{margin:0;font-size:13px;line-height:1.7;color:var(--mut);font-weight:600}.pq-insights{display:grid;gap:8px;margin:8px 0 4px}.pq-ins{border-radius:12px;padding:9px 11px;font-size:12.5px;line-height:1.55}.pq-ins b{display:block;margin-bottom:2px}.pq-ins.good{background:rgba(0,212,170,.06);border:1px solid rgba(0,212,170,.16)}.pq-ins.work{background:rgba(255,146,102,.07);border:1px solid rgba(255,146,102,.22)}.pq-ins span{opacity:.85}</style>'+
    '<div class="card ancard pqcard"><h3>تقييم جودة خطتك</h3>'+
    '<div class="muted cintro">تقييم رياضي عملي مبني على 6 ركائز علمية لبناء العضلة والقوة.</div>'+
    '<div class="anevalrow"><div class="anscore">'+ring+'<span>جودة الخطة · '+esc(q.grade)+'</span></div><div class="anevaltxt"><b class="pq-label">'+esc(q.label)+'</b><p class="pq-verdict-tx">'+esc(verdict)+'</p></div></div>'+
    '<div class="pq-insights">'+strong+prio+'</div>'+
    '<button class="pq-toggle" type="button" data-pqtoggle="1">تفاصيل الركائز الستة <span class="pq-caret">▾</span></button>'+
    '<div class="mvol pq-details" id="pqDetails">'+bars+'</div></div>';
}
function analysisTab(){
  var A=window.Coach?Coach.analysis(ANSCOPE,PLAN,LOGS,DONE,WEEK,MWEEK,MESO,PROFILE):null;
  var h=planQualityCard()+'<div class="card ancard"><h3>التحليل والتقييم</h3>';
  h+='<div class="muted cintro">تحليل علمي لأدائك من اللي بتسجله — يومي وأسبوعي وشهري — عشان تشوف بتتطور في إيه، وبيغذي قرارات مدربك الذكي</div>';
  h+=anScopeBtns();
  if(!A){h+='<div class="muted">لسه مفيش بيانات</div></div>';return h;}
  if(ANSCOPE==='daily'){
    h+='<div class="anstats">'+anStat(A.exercises,'تمارين')+anStat(A.sets,'مجموعات')+anStat(A.tonnage,'حمل كلي','كجم·عدة')+'</div>';
    h+=anEval(A.score,A.eval);
  } else if(ANSCOPE==='weekly'){
    h+='<div class="anstats">'+anStat(A.sessions+'/'+A.days,'جلسات')+anStat(A.adherence+'%','التزام')+anStat(A.tonnage,'حمل كلي','كجم·عدة')+'</div>';
    if(A.tonDelta!=null)h+='<div class="andelta '+(A.tonDelta>=0?'up':'down')+'">'+(A.tonDelta>=0?'▲':'▼')+' الحمل '+(A.tonDelta>=0?'زاد':'قل')+' '+Math.abs(A.tonDelta)+'% عن الأسبوع اللي فات</div>';
    h+=anEval(A.score,A.eval);
    if(A.muscles&&A.muscles.length){h+='<h4 class="csec">الحجم الأسبوعي لكل عضلة <small>(مقابل MEV/MRV)</small></h4><div class="mvol">';A.muscles.forEach(function(m){var pct=barpc(m.sets/Math.max(1,m.cap)*100);var warn=m.sets>=m.cap;var low=m.sets<m.floor;h+='<div class="abrow"><span class="abk">'+esc(muDisp(m.label))+'</span><div class="abtrack"><i class="abfill'+(warn?' warn':(low?' low':''))+'" style="width:'+pct+'%"></i></div><span class="abv">'+m.sets+'/'+m.cap+'</span></div>';});h+='</div>';}
  } else {
    h+='<div class="anstats">'+anStat(A.cycle,'الدورة')+anStat((A.lifts||[]).length,'تمارين تطورت')+anStat(A.totalTonnage,'حمل الدورة','كجم·عدة')+'</div>';
    h+=anEval(null,A.eval);
    if(A.weeks&&A.weeks.length){var mx=0;A.weeks.forEach(function(w){if(w.ton>mx)mx=w.ton;});h+='<h4 class="csec">الحمل الكلي أسبوع بأسبوع</h4><div class="trend">';A.weeks.forEach(function(w){var hpc=mx?Math.round(w.ton/mx*100):0;h+='<div class="tcol"><div class="tbarw"><div class="tbar" style="height:'+Math.max(6,hpc)+'%"></div></div><span>أ'+w.week+'</span></div>';});h+='</div>';}
    if(A.lifts&&A.lifts.length){h+='<h4 class="csec">أكبر تطور في الأوزان</h4><div class="lifts">';A.lifts.forEach(function(l){h+='<div class="lift"><span class="ln">'+esc(l.name)+'</span><span class="lv">'+fmt1(l.from)+' - '+fmt1(l.to)+' كجم <b>+'+fmt1(l.delta)+'</b></span></div>';});h+='</div>';}
  }
  if(A.notes&&A.notes.length){h+='<h4 class="csec">ملاحظات وتوصيات</h4><div class="obs">'+A.notes.map(function(n){return '<div class="ob"><span class="obi">'+n.icon+'</span><span>'+esc(n.text)+'</span></div>';}).join('')+'</div>';}
  h+='<button class="addexbtn" id="addexBtn">أضف تمرين لعضلة معينة</button>';
  h+='</div>';
  return h;
}
var WMOTIV=['كل تكرار بيقربك من هدفك — ابدأ وكمل','الالتزام أهم من الكمال — النهاردة فرصة جديدة','جسمك بيتغير وانت مش واخد بالك — استمر','القوة بتتبني يوم بيوم — خليك ثابت','مفيش تمرين ضايع — كله بيتحسب','النتيجة بتيجي للي بيكمل — انت من دول','الراحة جزء من التقدم — وازن بين الجد والريكفري','ركز على أداء النهاردة والباقي هييجي'];
function wmotiv(){return WMOTIV[new Date().getDate()%WMOTIV.length];}
/* ---- notifications ---- */
function notifBellHtml(){var list=window.Coach?Coach.notifs():[];if(!list.length)return '';var n=window.Coach?Coach.unread():0;return '<button class="bell" id="notifBell" title="إشعارات المدرب">'+(n>0?'<span class="bdot">'+n+'</span>':'')+'</button>';}
function notifPanelHtml(){
  var list=window.Coach?Coach.notifs():[];
  var h='<div class="notifwrap" id="notifWrap"><div class="notifbg" id="notifBg"></div><div class="notifpanel"><div class="nph"><b>إشعارات المدرب الذكي</b><button id="notifClose">✕</button></div><div class="nplist">';
  if(!list.length){h+='<div class="muted" style="padding:18px">لسه مفيش إشعارات — سجل تمارينك وخلص جلساتك وهتلاقي قرارات مدربك هنا</div>';}
  else{list.slice(0,40).forEach(function(n){
    var dec=n.kind==='decision';var pend=dec&&n.state==='pending';
    h+='<div class="nitem'+(n.read?'':' unread')+(pend?' pend':'')+'">'+
      '<div class="ntop"><span class="nico">'+n.icon+'</span><b>'+esc(n.title)+'</b></div>'+
      '<div class="ntext">'+esc(n.text)+'</div>'+
      (n.why?'<div class="nwhy">'+esc(n.why)+'</div>':'');
    if(pend){h+='<div class="nacts"><button class="napprove" data-approve="'+n.id+'">وافق وطبق</button><button class="nkeep" data-keep="'+n.id+'">⏸'+esc(n.option||'استمر')+'</button></div>';}
    else if(dec){h+='<div class="nstate">'+(n.state==='approved'?'اتطبق':'⏸فضلت زي ما هي')+'</div>';}
    h+='</div>';
  });}
  h+='</div></div></div>';
  return h;
}
/* ---- add-exercise modal ---- */
function addexModalHtml(){
  var days=(PLAN.days||[]).map(function(d,i){return '<option value="'+esc(d.key)+'">'+esc((d.name||'').split('—')[0].trim()||('يوم '+(i+1)))+'</option>';}).join('');
  var ms=(window.Coach?Coach.muscles():[]).map(function(m){return '<option value="'+esc(m.key)+'">'+esc(muDisp(m.label))+'</option>';}).join('');
  return '<div class="addexwrap" id="addexWrap"><div class="notifbg" id="addexBg"></div><div class="addexbox"><div class="nph"><b>إضافة تمرين لعضلة</b><button id="addexClose">✕</button></div>'+
    '<div class="axfield"><label>اليوم</label><select id="axDay">'+days+'</select></div>'+
    '<div class="axfield"><label>العضلة</label><select id="axMuscle">'+ms+'</select></div>'+
    '<div class="axsug" id="axSug"></div>'+
    '<button class="addexbtn" id="axConfirm">أضف التمرين للجدول</button>'+
    '<div class="muted" style="font-size:11px;margin-top:8px">النظام بيختار تمرين مناسب للعضلة مش موجود في جدولك، وهيتتابع ويتطور زي باقي تمارينك</div>'+
    '</div></div>';
}
function axRefresh(){
  var dk=$('axDay')?$('axDay').value:null;var m=$('axMuscle')?$('axMuscle').value:null;if(!dk||!m)return;
  var sug=window.Coach?Coach.suggestExercise(m,PLAN,dk):null;
  var el=$('axSug');if(!el)return;
  if(sug){el.innerHTML='<div class="axcard"><div class="axn">'+esc(sug.n)+'</div><div class="axm">'+esc(Coach.ML(m))+' · '+esc(sug.reps)+' عدة · 3 مجموعات</div></div>';el.setAttribute('data-n',sug.n);el.setAttribute('data-reps',sug.reps);el.setAttribute('data-v',sug.v||'');}
  else{el.innerHTML='<div class="muted">مفيش تمرين مقترح للعضلة دي</div>';el.removeAttribute('data-n');}
}
function bindExtra(){
  var bell=$('notifBell');if(bell)bell.onclick=function(){var w=$('notifWrap');if(w){w.classList.add('on');if(window.Coach)Coach.markAllRead();}};
  var nc=$('notifClose');if(nc)nc.onclick=function(){var w=$('notifWrap');if(w)w.classList.remove('on');render();};
  var nbg=$('notifBg');if(nbg)nbg.onclick=function(){var w=$('notifWrap');if(w)w.classList.remove('on');render();};
  Array.prototype.forEach.call(document.querySelectorAll('[data-approve]'),function(b){b.onclick=function(){if(window.Coach){Coach.applyDecision(PLAN,b.getAttribute('data-approve'),PROFILE);PLAN=load('forma_plan',PLAN);}toast('تم تطبيق القرار ✓');render();};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-keep]'),function(b){b.onclick=function(){if(window.Coach)Coach.keepDecision(b.getAttribute('data-keep'));toast('فضلت زي ما هي');render();};});
  Array.prototype.forEach.call(document.querySelectorAll('.anb[data-an]'),function(b){b.onclick=function(){ANSCOPE=b.getAttribute('data-an');render();};});
  var ab=$('addexBtn');if(ab)ab.onclick=function(){var w=$('addexWrap');if(w){w.classList.add('on');if($('axDay')&&PLAN.days[SEL])$('axDay').value=PLAN.days[SEL].key;axRefresh();}};
  var axc=$('addexClose');if(axc)axc.onclick=function(){var w=$('addexWrap');if(w)w.classList.remove('on');};
  var axbg=$('addexBg');if(axbg)axbg.onclick=function(){var w=$('addexWrap');if(w)w.classList.remove('on');};
  var axd=$('axDay');if(axd)axd.onchange=axRefresh;
  var axm=$('axMuscle');if(axm)axm.onchange=axRefresh;
  var axcf=$('axConfirm');if(axcf)axcf.onclick=function(){var el=$('axSug');var dk=$('axDay')?$('axDay').value:null;var m=$('axMuscle')?$('axMuscle').value:null;var nm=el?el.getAttribute('data-n'):null;if(!dk||!nm||!window.Coach){toast('اختر يوم وعضلة');return;}Coach.addExercise(PLAN,dk,{n:nm,muscle:m,reps:el.getAttribute('data-reps'),v:el.getAttribute('data-v')},PROFILE);PLAN=load('forma_plan',PLAN);var w=$('addexWrap');if(w)w.classList.remove('on');toast('تمت إضافة التمرين ✓');render();};
}

window.Dash={render:render};
render();


/* ================= MOBILE APP REDESIGN v17 (dark shell + bottom nav, mobile only) ================= */
function m2Stat(ic,num,unit,lbl){
  return '<div class="m2-stat"><div class="m2-ic">'+ic+'</div><div class="m2-stxt"><div class="m2-num">'+esc(String(num))+(unit?' <small>'+esc(unit)+'</small>':'')+'</div><div class="m2-lbl">'+esc(lbl)+'</div></div></div>';
}
function m2Metric(lbl,val,sub){
  return '<div class="m2-metric"><b>'+esc(String(val))+'</b><div class="m2-ml">'+esc(lbl)+'</div>'+(sub?'<div class="m2-ms">'+esc(sub)+'</div>':'')+'</div>';
}
function m2Header(p){
  var hr=new Date().getHours();
  var part=hr<12?'صباح الطاقة':(hr<18?'أهلا':(hr<21?'مساء النشاط':'ليلة الإنجاز'));
  var n=window.Coach?Coach.unread():0;
  return '<header class="m2-hd"><div class="m2-greet"><h1>'+part+'، '+esc(EFGREET)+'</h1>'+ 
    '<p>'+esc(PLAN.split_name||PLAN.title||'برنامجك')+' · أسبوع '+MWEEK+' من '+MESO+'</p></div>'+ 
    '</header>';
}
function m2Nav(){
  function nb(tab,ic,label){return '<button class="m2-nb'+(TAB===tab?' on':'')+'" data-tab="'+tab+'"><span class="m2-nb-ic">'+ic+'</span><span class="m2-nb-l">'+esc(label)+'</span></button>';}
  function fab(tab,ic){return '<button class="m2-nb m2-nb-c" data-tab="'+tab+'" title="الوحدات المساعدة"><span class="m2-fab">'+ic+'</span></button>';}
  var SV={
    today:'<svg viewBox="0 0 24 24"><path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/></svg>',
    coach:'<svg viewBox="0 0 24 24"><path d="M12 4a7 7 0 0 0-7 7c0 2.6 1.4 4.8 3.4 6"/><path d="M15.6 17A7 7 0 0 0 12 4"/><path d="M8 11h8M9 15h6"/><path d="M12 20v-3"/></svg>',
    modules:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1.4"/><rect x="14" y="4" width="6" height="6" rx="1.4"/><rect x="4" y="14" width="6" height="6" rx="1.4"/><rect x="14" y="14" width="6" height="6" rx="1.4"/></svg>',
    analysis:'<svg viewBox="0 0 24 24"><path d="M4 19V5"/><path d="M4 19h16"/><rect x="7" y="11" width="3" height="5" rx="1"/><rect x="12" y="7" width="3" height="9" rx="1"/><rect x="17" y="9" width="3" height="7" rx="1"/></svg>',
    account:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5.8 20c.5-4 3-6.2 6.2-6.2s5.7 2.2 6.2 6.2"/></svg>'
  };
  return '<nav class="m2-nav">'+nb('today',SV.today,'الرئيسية')+nb('coach',SV.coach,'المدرب')+fab('modules',SV.modules)+nb('analysis',SV.analysis,'التحليل')+nb('account',SV.account,'حسابي')+'</nav>';
}
function m2Cycle(){
  var segs='';
  for(var w=1;w<=MESO;w++){var cls=w<MWEEK?'done':(w===MWEEK?'cur':(w===MESO?'dlod':''));segs+='<div class="m2-cseg '+cls+'"></div>';}
  return '<div class="m2-cycle"><div class="m2-cycle-h"><span class="m2-cycle-t">'+esc(PLAN.split_name||'دورة التطور')+'</span><span class="m2-cycle-s">أسبوع '+MWEEK+' من '+MESO+'</span></div><div class="m2-cycle-track">'+segs+'</div></div>';
}
function m2Home(p,day,exs,estMin){
  var cm=Math.round(commitment()||0);
  var bw=bodyWeight();var sw=setsThisWeek();var dl=Math.max(0,MESO-MWEEK);var sp=topProgress();
  var dn=(day&&day.name)?day.name.split('—')[0].trim():'جلستك';
  var h='<div class="m2-hero"><div class="m2-hero-top"><div class="m2-hero-info">'+
    '<div class="m2-hero-lbl">جدولك التدريبي</div><div class="m2-hero-title">'+esc(PLAN.split_name||PLAN.title||'برنامجك')+'</div>'+
    '<div class="m2-hero-meta">'+esc(dn)+' · '+exs.length+' تمارين · ~'+estMin+' دقيقة</div></div>'+
    '<div class="m2-hero-ring"><svg width="54" height="54" viewBox="0 0 54 54"><circle cx="27" cy="27" r="22" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="5"/>'+
    '<circle cx="27" cy="27" r="22" fill="none" stroke="var(--mint-d)" stroke-width="5" stroke-linecap="round" stroke-dasharray="138" stroke-dashoffset="'+(138*(1-cm/100)).toFixed(1)+'" transform="rotate(-90 27 27)"/></svg>'+
    '<span class="m2-hero-pct">'+cm+'%</span></div></div>'+
    '<button class="m2-hero-btn" id="heroStart">ابدأ جلستك الآن</button></div>';
  h+='<div class="m2-strip">'+
    m2Stat('',(bw!=null?fmt1(bw):'—'),'كجم','وزن الجسم')+
    m2Stat('',dl,'أسبوع','للديلود')+
    m2Stat('',(sw||0),'ست','مجموعات')+
    m2Stat('',(sp?fmt1(sp.weight):'—'),(sp?'كجم':''),(sp?('أبرز: '+muDisp(sp.muscle)):'أبرز تطور'))+
    '</div>';
  h+='<div class="m2-sec">تمارين اليوم</div><div class="m2-days">';
  PLAN.days.forEach(function(d,i){var done=isDone(d.key);h+='<button class="wday m2-day'+(i===SEL?' on':'')+(done?' done':'')+'" data-i="'+i+'"><span class="m2-day-n">يوم '+(i+1)+'</span><span class="m2-day-t">'+esc((d.name||'').split('—')[0].trim()||('يوم '+(i+1)))+'</span></button>';});
  h+='</div>';
  h+='<div class="m2-hint">اضغط على أي تمرين لتسجيل الوزن والتكرار · ضع علامة ✓ عند اكتمال المجموعة</div>';
  exs.forEach(function(e,i){
    var key=day.key+'|'+e.name;var lg=LOGS[key]||{};var vid=vurl(e.video);
    var sw2=suggestWeight(day.key,e);var top=topRep(e.reps);
    var op=(OPEN[key]||(i===0&&OPEN[key]!==false))?' open':'';
    var muscleLbl=e.muscle?muDisp(e.muscle):'';
    h+='<div class="m2-ex'+op+'" data-key="'+esc(key)+'"><div class="m2-exhd" data-toggle="'+esc(key)+'">'+
      '<div class="m2-exnum">'+(i+1)+'</div><div class="m2-exinfo"><div class="m2-exname">'+esc(e.name)+'</div>'+
      '<div class="m2-exmeta">'+(muscleLbl?'<span class="mchip">'+esc(muscleLbl)+'</span>':'')+'<span class="mchip">'+e.sets+'×'+esc(e.reps)+'</span>'+'<span class="mchip">⏱ '+esc(fmtRest(e.rest))+'</span>'+(e.rir?'<span class="mchip">شدة '+esc(e.progRir||e.rir)+'</span>':'')+(e.tempo?'<span class="mchip">إيقاع '+esc(e.tempo)+'</span>':'')+'</div></div>'+
      '<div class="m2-exsug"><b>'+(sw2!=null?fmt1(sw2):'—')+'</b><span>كجم</span></div>'+
      (vid?'<a class="vid m2-exvid" href="'+esc(vid)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()"><span class="m2-vico">▶</span> فيديو</a>':'')+
      '<span class="m2-exchev">›</span></div>'+
      '<div class="setlog"><div class="setrow h"><span>وزن (كجم)</span><span>تكرار</span><span>تم</span></div>'+
      '<div class="setrow"><input type="number" inputmode="decimal" data-k="'+esc(key)+'" data-f="weight" value="'+(lg.weight||'')+'" placeholder="'+(sw2!=null?fmt1(sw2):'')+'"><input type="number" inputmode="numeric" data-k="'+esc(key)+'" data-f="reps" value="'+(lg.reps||'')+'" placeholder="'+top+'"><button class="chk'+(lg.done?' on':'')+'" data-done="'+esc(key)+'">'+(lg.done?'✓':'')+'</button></div></div></div>';
  });
  h+='<div class="m2-tip"><span class="m2-tip-i"></span><div><b>رسالة اليوم</b><p>'+esc(coachTip())+'</p></div></div>';
  h+='<button class="finish" id="finishBtn">'+(isDone(day.key)?'تحديث بيانات الجلسة':'أنه جلستك وشاهد تقييمك')+'</button>';
  return h;
}
function m2Account(p){
  function row(l,v){return '<div class="m2-arow"><span class="m2-al">'+esc(l)+'</span><span class="m2-av">'+esc(v==null||v===''?'—':String(v))+'</span></div>';}
  var gender=p.gender==='female'?'أنثى':(p.gender==='male'?'ذكر':(p.gender||'—'));
  var h='<div class="m2-acc-hd"><div class="m2-acc-av">'+efAvatar(p)+'</div><div class="m2-acc-name">'+esc(p.name||'بطل')+'</div><div class="m2-acc-sub">'+esc(p.goal_label||'')+(p.exp_label?' · '+esc(p.exp_label):'')+'</div></div>';
  h+='<div class="m2-sec">بياناتك</div><div class="m2-card">'+
    row('العمر',p.age?p.age+' سنة':'—')+
    row('الطول',p.height?p.height+' سم':'—')+
    row('الوزن',p.weight!=null?fmt1(p.weight)+' كجم':'—')+
    row('الجنس',gender)+
    row('الهدف',p.goal_label)+
    row('مستوى الخبرة',p.exp_label)+
    row('أيام التدريب',(PLAN.days_per_week||PLAN.freq)+' أيام/أسبوع')+
    row('البرنامج',PLAN.split_name||PLAN.title)+'</div>';
  h+='<div class="m2-sec">مؤشراتك</div><div class="m2-mgrid">'+
    m2Metric('مؤشر الكتلة',(p.bmi!=null?p.bmi:'—'),p.bmiCat||'')+
    m2Metric('السعرات اليومية',(p.tdee!=null?p.tdee:'—'),'سعر/يوم')+
    m2Metric('قدرة الاستشفاء',(p.recovery!=null?p.recovery:'—'),'من 100')+'</div>';
  h+=efSubSection();h+='<div class="m2-sec">خطتك</div><div class="m2-acts">'+
    '<button class="m2-act" id="dlPlan">تحميل الخطة</button>'+
    '<a class="m2-act" href="index.html">خطة جديدة</a><a class="m2-act" data-ef-support target="_blank" rel="noopener" href="https://wa.me/201000000000">تواصل مع الدعم</a></div>';
  return h;
}
function renderMobileDash(p,day,exs,estMin,deload,deloadTxt){
  var body='';
  if(TAB==='modules'){body=modulesTab();}
  else if(TAB==='coach'){body='<div class="m2-sec">دورة التطور</div>'+m2Cycle()+coachTab();}
  else if(TAB==='analysis'){body=analysisTab();}
  else if(TAB==='account'){body=m2Account(p);}
  else {body=m2Home(p,day,exs,estMin);}
  var _ft=(TAB!=='modules'&&TAB!=='coach'&&TAB!=='analysis'&&TAB!=='account')?floatTimer():'';
  var html='<div class="m2">'+notifBellHtml()+m2Header(p)+'<div class="m2-body">'+body+'</div>'+m2Nav()+_ft+'</div>';
  html+='<div class="modal" id="modal"><div class="modalbox"><div class="mi done-ic">✓</div><h2>جلسة مكتملة</h2><p id="msum"></p><button id="modalOk">حسنا</button></div></div>';
  html+='<div class="toast" id="toast"></div>';
  html+=notifBellHtml()+notifPanelHtml()+addexModalHtml();
  $('dashRoot').innerHTML=html;
  bind();
}
})();

/* EF: undo floating bar */
(function(){
  var bar=document.createElement('div');
  bar.id='ef-undo-bar';
  bar.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:9999;opacity:0;pointer-events:none;transition:opacity .35s;';
  var b1=document.createElement('button');
  b1.innerHTML='&#x21A9; &#x0631;&#x062C;&#x0648;&#x0639; &#x062E;&#x0637;&#x0648;&#x0629;';
  b1.style.cssText='background:rgba(30,22,50,.95);border:1.5px solid rgba(255,150,50,.6);color:#ff9632;padding:9px 20px;border-radius:12px;font-size:14px;cursor:pointer;font-family:inherit;box-shadow:0 4px 18px rgba(0,0,0,.4);';
  b1.onclick=function(){undoLastCoachChange();};
  var b2=document.createElement('button');
  b2.innerHTML='&#x1F504; &#x0627;&#x0633;&#x062A;&#x0639;&#x0627;&#x062F;&#x0629; &#x0627;&#x0644;&#x0623;&#x0635;&#x0644;&#x064A;';
  b2.style.cssText='background:rgba(30,22,50,.95);border:1.5px solid rgba(0,212,170,.5);color:#2ee6a6;padding:9px 20px;border-radius:12px;font-size:14px;cursor:pointer;font-family:inherit;box-shadow:0 4px 18px rgba(0,0,0,.4);';
  b2.onclick=function(){restoreOriginalPlan();};
  bar.appendChild(b1);bar.appendChild(b2);
  document.body.appendChild(bar);
  function syncBar(){
    var snaps=[];try{snaps=JSON.parse(localStorage.getItem('forma_plan_snapshots')||'[]');}catch(_){}
    var hasOrig=!!localStorage.getItem('forma_plan_original');
    var show=snaps.length>0||hasOrig;
    bar.style.opacity=show?'1':'0';
    bar.style.pointerEvents=show?'auto':'none';
    b1.disabled=!snaps.length;b1.style.opacity=snaps.length?'1':'0.45';
  }
  window.__efSyncUndoBar=syncBar;
  syncBar();setInterval(syncBar,5000);
})();
/* /EF undo bar */