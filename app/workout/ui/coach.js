/* ElForma — Smart Coach (المدرب الذكي) v2
   A live, science-based auto-progression + analysis layer that EVOLVES the
   trainee's plan from what they log (weights / sets / reps). Operates purely on
   localStorage (forma_plan / forma_logs / forma_done / forma_hist / forma_coach).
   The training ENGINE files are NEVER touched, so the engine stays 100% v60.

   Scientific basis:
   - Double progression (reps inside a range, then load) — Schoenfeld/RP.
   - Weekly volume autoregulation between MEV and MRV (sets/muscle/week).
   - RIR (reps-in-reserve) waving across the mesocycle (fatigue management).
   - Stall detection -> deload/back-off on the lift.
   - Weak-muscle detection (low progression-rate + low relative volume + user
     declared focus) -> prioritized treatment (extra set / extra exercise /
     higher frequency), all gated by user approval for any PLAN change.
   - Scheduled mesocycle deload (fixed cadence) auto-applied, then auto-resume
     with a fresh, heavier block.
*/
(function(){
'use strict';
// Smart-coaching gate — user can disable it from the account page
// (EF_smart_coaching). This MUST run in the module's own scope: the previous
// version wrapped it in a nested IIFE, so its `return` only exited that inner
// function and the whole coach kept loading. The switch did nothing.
var _scRaw = null;
try { _scRaw = localStorage.getItem('EF_smart_coaching'); } catch (_) {}
if (_scRaw !== null && _scRaw !== undefined) {
  var _scOn = true;
  try { _scOn = !!JSON.parse(_scRaw); } catch (_) { _scOn = true; }
  if (!_scOn) {
    console.info('[Coach] Smart coaching disabled by user');
    window._EF_AI_DISABLED = true;
    return; // exits the coach module IIFE -- nothing below is registered
  }
}

function load(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
/* ===== Plan Snapshot (undo support) ===== */
function snapshotPlan(plan){
  try{
    var snaps=JSON.parse(localStorage.getItem('forma_plan_snapshots')||'[]');
    snaps.push({ts:Date.now(),plan:JSON.parse(JSON.stringify(plan))});
    if(snaps.length>15)snaps=snaps.slice(-15);
    localStorage.setItem('forma_plan_snapshots',JSON.stringify(snaps));
  }catch(_){}
}
/* ======================================= */

function round(n,step){step=step||0.5;return Math.round(n/step)*step;}
function uid(){return 'd'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}

var MLABEL={chest:'صدر',back:'ظهر',shoulders:'أكتاف',arms:'ذراع',legs:'أرجل',glutes:'مؤخرة',core:'بطن',calves:'سمانة',forearms:'ساعد',quads:'أمامية',hamstrings:'خلفية',def:'عام'};
function ML(m){return MLABEL[m]||m;}

var BIG=/(squat|deadlift|bench|press|row|pull[- ]?up|chin|سكوات|ديدليفت|بنش|ضغط|تجديف|مكبس|عقلة|سحب|هيب ثراست|hip thrust)/i;
var ISO=/(curl|fly|raise|lateral|extension|pushdown|kickback|بايسبس|ترايسبس|رفرفة|تفتيح|تمديد|سمانة|calf)/i;
function incFor(name){if(BIG.test(name||''))return 5;if(ISO.test(name||''))return 1.25;return 2.5;}
function range(reps){var m=String(reps||'').match(/(\d+)\s*-\s*(\d+)/);if(m)return [+m[1],+m[2]];var n=parseInt(reps,10)||10;return [Math.max(1,n-3),n];}

/* weekly MEV/MRV (sets/muscle/week) by experience — Renaissance Periodization refs */
var MRV={
 beginner:{def:12,chest:12,back:14,legs:14,quads:14,hamstrings:12,glutes:12,shoulders:12,arms:10,core:12,calves:10,forearms:8},
 intermediate:{def:16,chest:18,back:20,legs:18,quads:18,hamstrings:14,glutes:16,shoulders:16,arms:16,core:14,calves:14,forearms:12},
 advanced:{def:20,chest:22,back:24,legs:22,quads:22,hamstrings:18,glutes:18,shoulders:20,arms:20,core:16,calves:18,forearms:14}
};
var MEV={
 beginner:{def:6,chest:6,back:8,quads:6,hamstrings:4,glutes:4,shoulders:6,arms:4,core:6,calves:6,forearms:4},
 intermediate:{def:8,chest:8,back:10,quads:8,hamstrings:6,glutes:6,shoulders:8,arms:6,core:8,calves:8,forearms:6},
 advanced:{def:10,chest:10,back:10,quads:8,hamstrings:6,glutes:6,shoulders:8,arms:8,core:8,calves:8,forearms:6}
};
function mrv(exp,m){var t=MRV[exp]||MRV.intermediate;return t[m]||t.def;}
function mev(exp,m){var t=MEV[exp]||MEV.intermediate;return t[m]||t.def;}

/* RIR target for a mesocycle week (1..meso). Higher RIR early, lower late, +1 on deload */
function rirFor(exp,mweek,meso){
 if(mweek>=meso)return (exp==='advanced'?1:exp==='beginner'?4:3)+1;/* deload: easier */
 var start=3,min=(exp==='beginner'?2:exp==='advanced'?0:1);
 var span=Math.max(1,meso-1);var t=(mweek-1)/span;/* 0..1 across loading weeks */
 return Math.max(min,Math.round(start-(start-min)*t));
}

/* ---------- self-contained exercise bank (engine NOT loaded in dashboard) ---------- */
var BANK={
 chest:[{n:'تفتيح دمبل على بنش مائل',reps:'10-15',v:'eozdVDA78K0'},{n:'ضغط صدر بالكابل',reps:'10-15',v:'Iwe6AmxVf7o'},{n:'بوش أب (ضغط)',reps:'10-20',v:'IODxDxX7oi4'}],
 back:[{n:'سحب أرضي بالكابل',reps:'8-12',v:'GZbfZ033f74'},{n:'تجديف دمبل بذراع واحدة',reps:'8-12',v:'pYcpY20QaE8'},{n:'سحب عالي واسع',reps:'8-12',v:'CAwf7n6Luuc'}],
 shoulders:[{n:'رفرفة جانبية دمبل',reps:'12-20',v:'3VcKaXpzqRo'},{n:'ضغط كتف دمبل',reps:'8-12',v:'qEwKCR5JCog'},{n:'رفرفة خلفية',reps:'12-20',v:'EA7u4Q_8HQ0'}],
 arms:[{n:'بايسبس باربل',reps:'8-12',v:'kwG2ipFRgfo'},{n:'ترايسبس بالكابل',reps:'10-15',v:'2-LAMcpzODU'},{n:'مطرقة دمبل (هامر)',reps:'10-15',v:'zC3nLlEvin4'}],
 quads:[{n:'ليج بريس',reps:'10-15',v:'IZxyjW7MPJQ'},{n:'تمديد أرجل',reps:'12-20',v:'YyvSfVjQeL0'},{n:'سكوات بلغاري',reps:'10-12',v:'2C-uNgKwPLE'}],
 hamstrings:[{n:'ثني أرجل',reps:'10-15',v:'1Tq3QdYUuHs'},{n:'رومانيان ديدليفت',reps:'8-12',v:'2SHsk9AzdjA'},{n:'هيب ثراست',reps:'8-12',v:'xDmFkJxPzeM'}],
 glutes:[{n:'هيب ثراست',reps:'8-12',v:'xDmFkJxPzeM'},{n:'رفعة مؤخرة بالكابل',reps:'12-20',v:'gKZBdjLNN4U'},{n:'سكوات بلغاري',reps:'10-12',v:'2C-uNgKwPLE'}],
 legs:[{n:'ليج بريس',reps:'10-15',v:'IZxyjW7MPJQ'},{n:'لانجز دمبل',reps:'10-12',v:'QOVaHwm-Q6U'}],
 core:[{n:'بلانك',reps:'30-60ث',v:'pSHjTRCQxIw'},{n:'كرنش بالكابل',reps:'12-20',v:'Bfb-mexQNgo'},{n:'رفع أرجل معلق',reps:'10-15',v:'JB2oyawG9KI'}],
 calves:[{n:'رفع سمانة واقف',reps:'12-20',v:'-M4-G8p8fmc'},{n:'رفع سمانة جالس',reps:'15-25',v:'JbyjNymZOt0'}],
 forearms:[{n:'لف رسغ باربل',reps:'15-20',v:'1Tq3QdYUuHs'}]
};
function muscleList(){return ['chest','back','shoulders','arms','quads','hamstrings','glutes','core','calves','forearms'];}
var _DBREPS={chest:'8-12',back:'8-12',shoulders:'10-15',arms:'10-15',quads:'10-15',hamstrings:'10-15',glutes:'10-15',legs:'10-15',core:'12-20',calves:'12-20',forearms:'15-20'};
var _MMAP={chest:['chest'],back:['back'],shoulders:['shoulders'],arms:['biceps','triceps'],quads:['quads'],hamstrings:['hamstrings'],legs:['quads','hamstrings'],core:['core'],calves:['calves'],forearms:['forearms']};
/* Pull RICH exercise objects from the full engine database (engine/db.js - GYM_DB),
   keeping each exercise's anatomical region (sub-group), target label (mu),
   substitute (alt), injury-safety and goal tags. Falls back to the mini BANK. */
function _dbExercises(m){
 if(typeof GYM_DB==='undefined'||!GYM_DB)return null;
 var out=[],seen={};
 function add(group,region,arr){if(Array.isArray(arr))arr.forEach(function(ex){if(ex&&ex.n&&!seen[ex.n]){seen[ex.n]=1;out.push({n:ex.n,reps:_DBREPS[m]||'8-12',v:ex.vid||ex.v||'',alt:ex.alt||'',mu:ex.mu||'',region:region,group:group,tier:ex.tier||'',inj:ex.safe_injuries||[],goals:ex.goal_bonus||[]});}});}
 function eat(group,node){if(!node)return;if(Array.isArray(node)){add(group,group,node);return;}if(typeof node==='object')Object.keys(node).forEach(function(rk){var v=node[rk];if(Array.isArray(v))add(group,group+'/'+rk,v);else if(v&&typeof v==='object')Object.keys(v).forEach(function(rk2){if(Array.isArray(v[rk2]))add(group,group+'/'+rk+'/'+rk2,v[rk2]);});});}
 if(m==='glutes'){var h=GYM_DB.hamstrings;if(h&&h.glutes)add('hamstrings','hamstrings/glutes',h.glutes);return out.length?out:null;}
 var keys=_MMAP[m];if(!keys)return null;
 keys.forEach(function(k){eat(k,GYM_DB[k]);});
 return out.length?out:null;
}
function bankFor(m){var db=_dbExercises(m);if(db&&db.length)return db.map(function(e){return {n:e.n,reps:e.reps,v:e.v};});return (BANK[m]||BANK[m==='legs'?'quads':'def']||[]).slice();}

/* ---------- coach state ---------- */
function cstate(){
 var c=load('forma_coach',null);
 if(!c)c={};
 if(!c.ex)c.ex={};
 if(!c.notes)c.notes=[];
 if(!c.notif)c.notif=[];
 if(!c.reviewedWeek)c.reviewedWeek=0;
 if(c.splitAdvice==null)c.splitAdvice='';
 if(!c.deloadMark)c.deloadMark={};
 return c;
}
function persist(c){save('forma_coach',c);}
function note(c,week,icon,text){c.notes.unshift({week:week,icon:icon,text:text,ts:Date.now()});if(c.notes.length>60)c.notes.length=60;}

/* push a notification. kind: 'info' | 'decision'. decision carries change+state */
function notify(c,o){
 var n={id:uid(),ts:Date.now(),week:o.week||0,icon:o.icon||'',title:o.title||'ملاحظة من المدرب',text:o.text||'',kind:o.kind||'info',read:false};
 if(o.kind==='decision'){n.state='pending';n.change=o.change||null;n.why=o.why||'';n.option=o.option||'الاستمرار على الخطة الحالية';}
 /* avoid duplicate pending decisions for same change signature */
 if(o.kind==='decision'&&o.sig){
  for(var i=0;i<c.notif.length;i++){if(c.notif[i].sig===o.sig&&c.notif[i].state==='pending')return c.notif[i];}
  n.sig=o.sig;
 }
 c.notif.unshift(n);if(c.notif.length>80)c.notif.length=80;
 return n;
}
function ensure(c,key,ex){if(!c.ex[key]){var r=range(ex.reps);c.ex[key]={ww:0,rep:r[0],sets:+ex.sets||3,rest:(+ex.restSec||restToSeconds(ex.rest)||90),stall:0,prog:0,sessions:0};}var s=c.ex[key];if(s.prog==null)s.prog=0;if(s.sessions==null)s.sessions=0;return s;}

/* ---------- next-session target (double progression + deload) ---------- */
function nextTarget(key,ex,mweek,meso,profile){
 var c=cstate();var st=ensure(c,key,ex);var r=range(ex.reps);
 var exp=(profile&&profile.exp)||'intermediate';
 var deload=mweek>=meso;
 var w=st.ww||0;
 return {weight:(deload&&w)?round(w*0.9):(w||null), reps:deload?r[0]:st.rep, rir:rirFor(exp,mweek,meso), sets:st.sets, rest:st.rest, deload:deload, lo:r[0], hi:r[1], hasBase:!!st.ww};
}

/* ---------- applyDay: double progression per lift on logged data ---------- */
function applyDay(day,logs,week,mweek,meso,profile){
 var c=cstate();
 var exp=(profile&&profile.exp)||'intermediate';
 var rirT=rirFor(exp,mweek,meso);
 var deload=mweek>=meso;
 /* ---- session science metrics: volume-load, e1RM PRs, stimulating reps ---- */
 var sTon=0,sStim=0,sSets=0,nLifts=0,prs=0,topInt=0,topName='';
 (day.exercises||[]).forEach(function(ex){
  var key=day.key+'|'+ex.name;var lg=logs[key];if(!lg||!lg.weight)return;
  var st=ensure(c,key,ex);var sets=(+ex.sets||st.sets||0),reps=(+lg.reps||0);
  nLifts++;sSets+=sets;sTon+=tonnage(lg.weight,reps,sets);sStim+=stimReps(reps,rirT)*sets;
  var e=e1rm(lg.weight,reps);if(st.ww&&e>(st.bestE1||0)+0.01){prs++;st.bestE1=e;}
  var ri=pct1rm(reps);if(ri>topInt){topInt=ri;topName=ex.name;}
 });
 if(deload){
  if(nLifts){note(c,week,'','جلسة ديلود: حمل '+Math.round(sTon)+' كجم·عدة (مخفض عمدا) — الهدف تفريغ التعب لا التقدم');notify(c,{week:week,icon:'',title:'ملخص جلسة (ديلود)',text:'سجلت '+nLifts+' تمرين بحمل كلي '+Math.round(sTon)+' كجم·عدة وRIR مستهدف '+rirT+'. الأوزان مخفضة عشان الاستشفاء — مفيش زيادة وده مقصود'});}
  persist(c);return;
 }
 (day.exercises||[]).forEach(function(ex){
  var key=day.key+'|'+ex.name;var lg=logs[key];if(!lg||!lg.weight)return;
  var st=ensure(c,key,ex);var r=range(ex.reps),lo=r[0],hi=r[1],inc=incFor(ex.name);
  st.sessions++;
  if(!st.ww){st.ww=lg.weight;st.rep=Math.max(lo,Math.min(hi,(+lg.reps||lo)));st.bestE1=e1rm(lg.weight,+lg.reps||lo);note(c,week,'','سجلنا وزن البداية ل «'+ex.name+'»: '+lg.weight+' كجم');return;}
  if(lg.weight>=st.ww){
   if((+lg.reps||0)>=hi){st.ww=round(st.ww+inc);st.rep=lo;st.stall=0;st.prog++;notify(c,{week:week,icon:'',title:'زيادة حمل تلقائية',text:'«'+ex.name+'»: وصلت '+hi+' عدة - رفعنا الوزن ل '+st.ww+' كجم (تدرج مزدوج). ده تطور على نفس التمرين مش تغيير في الخطة'});note(c,week,'','«'+ex.name+'»: زودنا الوزن ل '+st.ww+' كجم');}
   else if((+lg.reps||0)>=lo){st.rep=Math.min(hi,(+lg.reps||lo)+1);st.stall=0;st.prog++;}
   else{st.stall++;if(st.stall>=2){st.ww=round(st.ww*0.9);st.rep=lo;st.stall=0;notify(c,{week:week,icon:'',title:'معالجة ثبات',text:'«'+ex.name+'»: ثبات في الأداء مرتين - خفضنا الوزن ل '+st.ww+' كجم لإعادة بناء الزخم (باك أوف).'});note(c,week,'','«'+ex.name+'»: خفضنا الوزن ل '+st.ww+' كجم');}}
  }
 });
 if(nLifts){
  note(c,week,'','ملخص الجلسة: '+nLifts+' تمرين · '+sSets+' مجموعة · حمل '+Math.round(sTon)+' كجم·عدة · ~'+Math.round(sStim)+' تكرار محفز · '+prs+' رقم قياسي (e1RM).');
  notify(c,{week:week,icon:'',title:'ملخص علمي للجلسة',text:'الحمل الكلي '+Math.round(sTon)+' كجم·عدة و~'+Math.round(sStim)+' تكرار محفز (آخر 5 قبل الفشل عند RIR '+rirT+'). '+(prs>0?('حققت '+prs+' تحسن في 1RM التقديري تطور قوة حقيقي'):'مفيش رقم قياسي جديد — زود عدة أو وزن الجلسة الجاية')+(topName?(' أعلى شدة نسبية على «'+topName+'» (~'+Math.round(topInt*100)+'% من 1RM).'):'')});
 }
 persist(c);
}

/* ---------- muscle-key resolver: maps a plan/history exercise to the coach's
   science tables. Works for new plans (cm/grp) AND old saved plans (Arabic label). ---------- */
function cMus(ex){
 if(!ex)return 'def';
 if(ex.cm)return ex.cm;
 var g=ex.grp||'';var sub=ex.sub||'';
 if(g==='hamstrings'&&sub==='glutes')return 'glutes';
 var gmap={chest:'chest',back:'back',shoulders:'shoulders',biceps:'arms',triceps:'arms',quads:'quads',hamstrings:'hamstrings',glutes:'glutes',calves:'calves',core:'core',forearms:'forearms',traps:'back',adductors:'quads'};
 if(gmap[g])return gmap[g];
 var mu=ex.mu||ex.muscle||'';
 if(/صدر/.test(mu))return 'chest';
 if(/ظهر|لات|عريض|دورية/.test(mu))return 'back';
 if(/دلتا|كتف/.test(mu))return 'shoulders';
 if(/ترايس|بايس|براكيال|ذات الرأس/.test(mu))return 'arms';
 if(/ساعد/.test(mu))return 'forearms';
 if(/كوادر|كوادز|رباعية|أمامية الفخذ|فخذ أمامي/.test(mu))return 'quads';
 if(/هامسترينج|خلفية الفخذ|مأبض/.test(mu))return 'hamstrings';
 if(/جلوت|ألوية|مؤخرة/.test(mu))return 'glutes';
 if(/سمان|سولياس|جاستروك|بطة/.test(mu))return 'calves';
 if(/كور|بطن|معدة|جانبية/.test(mu))return 'core';
 if(/مقرب/.test(mu))return 'quads';
 return 'def';
}

/* ---------- weak-muscle detection (science-based, from logged data) ---------- */
function detectWeak(plan,logs,profile){
 var c=cstate();var exp=(profile&&profile.exp)||'intermediate';
 var declared=(plan&&plan.weak)||[];
 var byM={};
 (plan.days||[]).forEach(function(d){(d.exercises||[]).forEach(function(ex){
  var m=cMus(ex);var key=d.key+'|'+ex.name;var st=ensure(c,key,ex);
  byM[m]=byM[m]||{m:m,sets:0,prog:0,stall:0,n:0,based:0};
  byM[m].sets+=(+ex.sets||st.sets||0);byM[m].n++;
  byM[m].prog+=st.prog||0;byM[m].stall+=st.stall||0;if(st.ww)byM[m].based++;
 });});
 var arr=Object.keys(byM).map(function(m){
  var o=byM[m];var cap=mrv(exp,m),floor=mev(exp,m);
  var progRate=o.based>0?o.prog/Math.max(1,o.based):0;/* progressions per established lift */
  var volRatio=o.sets/Math.max(1,cap);
  var lag=0,reasons=[];
  if(declared.indexOf(m)>-1){lag+=2;reasons.push('اخترتها كنقطة ضعف من البداية');}
  if(o.sets<floor){lag+=2;reasons.push('حجمها الأسبوعي ('+o.sets+' ست) تحت الحد الأدنى الفعال (MEV '+floor+')');}
  else if(volRatio<0.5){lag+=1;reasons.push('حجمها أقل من نص السقف الآمن');}
  if(o.based>=1&&progRate<0.34){lag+=2;reasons.push('معدل تقدمها بطيء على الأوزان اللي سجلتها');}
  if(o.stall>=2){lag+=1;reasons.push('فيها علامات ثبات متكررة');}
  return {m:m,label:ML(m),sets:o.sets,cap:cap,floor:floor,progRate:progRate,lag:lag,reasons:reasons};
 });
 arr.sort(function(a,b){return b.lag-a.lag;});
 var weak=arr.filter(function(x){return x.lag>=2;});
 return {all:arr,weak:weak};
}

/* ---------- weekly review: PROPOSE structural changes as decisions ---------- */
function review(plan,logs,week,mweek,meso,profile){
 var c=cstate();if(c.reviewedWeek>=week)return {applied:[],proposed:[]};
 var exp=(profile&&profile.exp)||'intermediate';
 var rec=(profile&&+profile.recovery)||65;
 var goal=(plan&&plan.goal)||'muscle';
 var hist=histAll();var acw=acwrFrom(hist,week);
 var proposed=[];
 var byMuscle={},progressed=0,total=0,stalled=0;
 plan.days.forEach(function(d){(d.exercises||[]).forEach(function(ex){
  var key=d.key+'|'+ex.name;var st=ensure(c,key,ex);var m=cMus(ex);
  byMuscle[m]=byMuscle[m]||{sets:0,exs:[],prog:0,n:0};
  byMuscle[m].sets+=(+ex.sets||st.sets);byMuscle[m].exs.push({key:key,ex:ex,st:st,dayKey:d.key});byMuscle[m].n++;
  var lg=logs[key];total++;
  if(lg&&lg.weight){var r=range(ex.reps);if((+lg.reps||0)>=r[1]){progressed++;byMuscle[m].prog++;}}
  if(st.stall>0)stalled++;
 });});
 var recoveryGood=rec>=65&&stalled<=1;
 var recoveryPoor=rec<50||stalled>=3;

 if(mweek>=meso){
  /* end of deload week is handled by tick() resume; here just acknowledge */
  note(c,week,'','تقييم أسبوع التخفيف تم — الجسم استشفى وجاهز لدورة جديدة');
 } else {
  /* progress proposal: add volume on a well-progressing muscle with safe room */
  if(recoveryGood){
   Object.keys(byMuscle).forEach(function(m){var info=byMuscle[m];var cap=mrv(exp,m);
    if(info.n>0&&info.prog>=Math.ceil(info.n/2)&&info.sets<cap){
     var t=info.exs[0];
     proposed.push({kind:'decision',week:week,icon:'',title:'مقترح: زيادة حجم ل'+ML(m),
      why:'أداؤك على '+ML(m)+' ممتاز. الحجم الحالي '+info.sets+' ست/أسبوع، والمنطقة المثلى MAV ≈ '+mav(exp,m)+' (السقف MRV '+cap+'). زيادة ست تقربك من MAV — أعلى نمو لكل وحدة تعب',
      text:'أضيف مجموعة (ست) على «'+t.ex.name+'».',
      option:'سيب الحجم زي ما هو',
      sig:'vol+|'+t.key,
      change:{type:'set+',key:t.key,dayKey:t.dayKey,exName:t.ex.name,muscle:m}});
    }
   });
  }
  /* fatigue proposal: trim volume on the most-fatigued muscle */
  if(recoveryPoor){
   var top=null;Object.keys(byMuscle).forEach(function(m){if(!top||byMuscle[m].sets>byMuscle[top].sets)top=m;});
   if(top){var info=byMuscle[top];var t=info.exs.sort(function(a,b){return (b.ex.sets||0)-(a.ex.sets||0);})[0];if(t&&(+t.ex.sets||t.st.sets)>2){
    proposed.push({kind:'decision',week:week,icon:'',title:'مقترح: تخفيف حجم '+ML(top),
     why:'مؤشرات الاستشفاء منخفضة (تعب متراكم) — تقليل الحجم يحميك من الإفراط ويحسن الجودة',
     text:'أشيل مجموعة (ست) من «'+t.ex.name+'».',
     option:'كمل بنفس الحجم',
     sig:'vol-|'+t.key,
     change:{type:'set-',key:t.key,dayKey:t.dayKey,exName:t.ex.name,muscle:top}});
   }}
  }
  /* load-spike guard: Acute:Chronic Workload Ratio (ACWR) */
  if(acw!=null&&acw>1.5){
   var topm=null;Object.keys(byMuscle).forEach(function(m){if(!topm||byMuscle[m].sets>byMuscle[topm].sets)topm=m;});
   var ti=topm&&byMuscle[topm].exs.slice().sort(function(a,b){return ((+b.ex.sets||0)-(+a.ex.sets||0));})[0];
   if(ti&&(+ti.ex.sets||ti.st.sets||0)>2){
    proposed.push({kind:'decision',week:week,icon:'',title:'حماية من قفزة الحمل (ACWR '+acw+')',
     why:'نسبة الحمل الحاد:المزمن (ACWR) = '+acw+' وده فوق النطاق الآمن (0.8–1.3). القفزات دي بترفع خطر الإصابة والإفراط. تقليل ست من أكتر عضلة حجما يرجعك للمنطقة الآمنة',
     text:'أشيل مجموعة من «'+ti.ex.name+'» لتهدئة معدل الزيادة',
     option:'كمل بنفس الحمل',
     sig:'acwr|'+ti.key,
     change:{type:'set-',key:ti.key,dayKey:ti.dayKey,exName:ti.ex.name,muscle:topm}});
   }
  } else if(acw!=null&&acw<0.8&&mweek<meso){
   note(c,week,'','ACWR '+acw+' — الحمل أقل من المعتاد؛ زود شوية عشان تحافظ على التكيف');
  }
  /* weak-muscle treatment proposal */
  var wk=detectWeak(plan,logs,profile);
  wk.weak.slice(0,2).forEach(function(w){
   var info=byMuscle[w.m];
   if(info&&info.sets<w.cap){
    var t=info.exs[0];
    proposed.push({kind:'decision',week:week,icon:'',title:'علاج عضلة ضعيفة: '+w.label,
     why:'اكتشفت أن «'+w.label+'» متأخرة لأن: '+w.reasons.slice(0,2).join(' و ')+'. العلاج: أولوية حجم وتكرار أعلى لها',
     text:'أزود مجموعة على «'+t.ex.name+'» لرفع حجم '+w.label+'.',
     option:'سيب التركيز زي ما هو',
     sig:'weakset|'+t.key,
     change:{type:'set+',key:t.key,dayKey:t.dayKey,exName:t.ex.name,muscle:w.m}});
   } else {
    /* no room on existing exercises - propose adding a new exercise for it */
    var dk=(info&&info.exs[0]&&info.exs[0].dayKey)||(plan.days[0]&&plan.days[0].key);
    var sug=suggestExercise(w.m,plan,dk,profile);
    if(sug){
     proposed.push({kind:'decision',week:week,icon:'',title:'علاج عضلة ضعيفة: '+w.label,
      why:'«'+w.label+'» متأخرة: '+w.reasons.slice(0,2).join(' و ')+'. وصلنا لسقف الحجم على التمارين الحالية، والأفضل إضافة تمرين يغطي منطقة ناقصة'+(sug.mu?' ('+sug.mu+')':'')+'.',
      text:'أضيف «'+sug.n+'»'+(sug.mu?' ل'+sug.mu:'')+' ليوم '+dayLabel(plan,dk)+'.',
      option:'ماتضفش تمرين',
      sig:'weakadd|'+w.m,
      change:{type:'add',dayKey:dk,muscle:w.m,exName:sug.n,reps:sug.reps,video:sug.v}});
    }
   }
  });
  /* injury-safety swaps: any planned lift conflicting with a stated injury (cap 3) */
  var injuries=_injuries(profile),injSwaps=0;
  if(injuries.length){
   Object.keys(byMuscle).forEach(function(m){byMuscle[m].exs.forEach(function(t){
    if(injSwaps>=3)return;var meta=exMeta(t.ex.name);if(!meta)return;
    if(injuries.every(function(i){return (meta.inj||[]).indexOf(i)>-1;}))return;
    var sub=swapCandidate(t.ex.name,m,plan,profile);if(!sub)return;injSwaps++;
    proposed.push({kind:'decision',week:week,icon:'',title:'استبدال آمن للإصابة: '+t.ex.name,
     why:'«'+t.ex.name+'» مش ضمن التمارين الآمنة لإصابتك ('+injuries.join('، ')+'). الأفضل تبديله ببديل يستهدف نفس العضلة من غير ما يحمل المنطقة المصابة',
     text:'أستبدله ب«'+sub.n+'».',option:'سيبه زي ما هو',sig:'injswap|'+t.key,
     change:{type:'swap',dayKey:t.dayKey,exName:t.ex.name,newName:sub.n,reps:sub.reps,video:sub.v,muscle:m}});
   });});
  }
  /* stall-based rotation: an exercise stuck for a while - fresh variation (cap 2) */
  var rot=0;
  Object.keys(byMuscle).forEach(function(m){byMuscle[m].exs.forEach(function(t){
   if(rot>=2)return;
   if((t.st.stall||0)>=2&&(t.st.sessions||0)>=4){var sub=swapCandidate(t.ex.name,m,plan,profile);if(!sub)return;rot++;
    proposed.push({kind:'decision',week:week,icon:'',title:'تدوير تمرين متوقف: '+t.ex.name,
     why:'«'+t.ex.name+'» واقف عند نفس الأداء فترة (ثبات متكرر بعد '+(t.st.sessions||0)+' جلسة). تدوير لتمرين بديل يكسر الثبات ويجدد الحافز العضلي مع نفس الهدف',
     text:'أدوره ب«'+sub.n+'».',option:'كمل على نفس التمرين',sig:'rotate|'+t.key,
     change:{type:'swap',dayKey:t.dayKey,exName:t.ex.name,newName:sub.n,reps:sub.reps,video:sub.v,muscle:m}});
   }
  });});
  /* region-balance: a trained muscle with an uncovered anatomical head (cap 1) */
  var regionDone=false;
  Object.keys(byMuscle).forEach(function(m){
   if(regionDone)return;if(!(byMuscle[m].sets>0))return;var gaps=regionGaps(m,plan);if(!gaps.length)return;
   var g=gaps[0];var pick=g.exs&&g.exs[0];if(!pick)return;var dk=byMuscle[m].exs[0].dayKey;regionDone=true;
   proposed.push({kind:'decision',week:week,icon:'',title:'توازن '+ML(m)+': منطقة غير مغطاة',
    why:'بتمرن '+ML(m)+' بس فيه رأس/منطقة ('+(g.mu||g.region)+') مش متغطية في خطتك. تغطية كل رؤوس العضلة بتدي تطور متوازن وتقلل خطر الاختلال العضلي',
    text:'أضيف «'+pick.n+'»'+(g.mu?' ل'+g.mu:'')+' ليوم '+dayLabel(plan,dk)+'.',option:'مش محتاج',sig:'region|'+m+'|'+g.region,
    change:{type:'add',dayKey:dk,muscle:m,exName:pick.n,reps:pick.reps,video:pick.v}});
  });
  /* density manipulation by goal (auto info — small, not a plan change) */
  /* split-change advice if global stagnation near end of meso */
  var prate=total?progressed/total:0;
  if(mweek>=meso-1&&prate<0.25){
   c.splitAdvice='أداؤك ثابت من فترة على نفس النظام — يفضل تغيير التقسيم (Split) أو توزيع الأيام الدورة الجاية';
   notify(c,{week:week,icon:'',title:'نصيحة: ثبات عام',text:c.splitAdvice});
  } else c.splitAdvice='';
 }
 /* register proposals as decision notifications */
 proposed.forEach(function(p){notify(c,p);});
 c.reviewedWeek=week;
 persist(c);
 return {applied:[],proposed:proposed.map(function(p){return p.title;}),deload:mweek>=meso};
}

function dayLabel(plan,dk){var d=(plan.days||[]).filter(function(x){return x.key===dk;})[0];return d?((d.name||'').split('—')[0].trim()||dk):dk;}

/* ---------- exercise suggestion + add/remove (user-driven) ---------- */
function _injuries(profile){var x=(profile&&(profile.injuries||profile.injury))||[];return Array.isArray(x)?x:(x?[x]:[]);}
/* which anatomical regions/heads of this muscle does the current plan already cover? */
function _coveredRegions(plan,full){
 var idx={};full.forEach(function(e){idx[e.n]=e.region;});
 var cov={};
 (plan.days||[]).forEach(function(d){(d.exercises||[]).forEach(function(ex){var nm=(ex.name||'').trim();if(idx[nm])cov[idx[nm]]=(cov[idx[nm]]||0)+1;});});
 return cov;
}
/* Smart, anatomy-aware pick for a weak muscle: prioritise filling an UNtrained
   region/head, then goal-fit, then injury-safety. Tier is only a faint tiebreak. */
function suggestExercise(muscle,plan,dayKey,profile){
 var full=_dbExercises(muscle);
 var have={};
 (plan.days||[]).forEach(function(d){(d.exercises||[]).forEach(function(ex){have[(ex.name||'').trim()]=true;});});
 if(!full||!full.length){
  var bank=(BANK[muscle]||BANK[muscle==='legs'?'quads':'def']||[]);
  for(var b=0;b<bank.length;b++){if(!have[bank[b].n])return bank[b];}
  return bank[0]||null;
 }
 var goal=(plan&&plan.goal)||'muscle';
 var inj=_injuries(profile);
 var cov=_coveredRegions(plan,full);
 var cands=full.filter(function(e){return !have[e.n];});
 if(!cands.length)cands=full.slice();
 function score(e){
  var s=0;
  if(!cov[e.region])s+=3; else s-=Math.min(2,cov[e.region]); /* fill anatomical gaps; avoid piling on a covered head */
  if(e.goals&&e.goals.indexOf(goal)>-1)s+=2;                /* match the trainee's goal */
  if(inj.length){var safe=inj.every(function(i){return (e.inj||[]).indexOf(i)>-1;});s+=safe?2:-3;} /* respect injuries */
  s+= e.tier==='S'?0.4:(e.tier==='A'?0.2:0);                /* faint tiebreak only */
  return s;
 }
 var best=null,bs=-1e9;
 cands.forEach(function(e){var sc=score(e);if(sc>bs){bs=sc;best=e;}});
 return best||cands[0]||null;
}
/* "بدله إيه؟" — the database-defined substitute for an exercise (same target, swappable). */
function substituteFor(name){
 if(!name)return null;
 var all=[];muscleList().forEach(function(m){var d=_dbExercises(m);if(d)all=all.concat(d);});
 for(var i=0;i<all.length;i++){if(all[i].n===name)return all[i].alt||null;}
 return null;
}
/* look up a DB exercise's metadata by name across all muscles (adds _muscle). */
function exMeta(name){
 if(!name)return null;var ms=muscleList();
 for(var i=0;i<ms.length;i++){var d=_dbExercises(ms[i]);if(!d)continue;for(var j=0;j<d.length;j++){if(d[j].n===name){d[j]._muscle=ms[i];return d[j];}}}
 return null;
}
/* anatomical regions/heads of a muscle that the plan does NOT yet cover. */
function regionGaps(muscle,plan){
 var full=_dbExercises(muscle);if(!full||!full.length)return [];
 var cov=_coveredRegions(plan,full);
 var byR={};full.forEach(function(e){if(!byR[e.region])byR[e.region]={region:e.region,mu:e.mu,exs:[]};byR[e.region].exs.push(e);});
 var gaps=[];Object.keys(byR).forEach(function(rk){if(!cov[rk])gaps.push(byR[rk]);});
 return gaps;
}
/* find a replacement for an exercise: prefer DB-defined alt (if injury-safe),
   else a same-muscle, injury-safe, not-already-used pick (same region preferred). */
function swapCandidate(name,muscle,plan,profile){
 var inj=_injuries(profile);
 var meta=exMeta(name);var m=muscle||(meta&&meta._muscle);
 var safe=function(e){return !inj.length||inj.every(function(i){return (e.inj||[]).indexOf(i)>-1;});};
 if(meta&&meta.alt){var am=exMeta(meta.alt);if(am){if(safe(am)&&am.n!==name)return {n:am.n,reps:am.reps,v:am.v,mu:am.mu};}else return {n:meta.alt,reps:(meta.reps||'8-12'),v:'',mu:''};}
 if(!m)return null;
 var full=_dbExercises(m);if(!full||!full.length)return null;
 var have={};(plan.days||[]).forEach(function(d){(d.exercises||[]).forEach(function(ex){have[(ex.name||'').trim()]=true;});});
 var region=meta&&meta.region;
 var cands=full.filter(function(e){return e.n!==name&&!have[e.n]&&safe(e);});
 if(!cands.length)return null;
 cands.sort(function(a,b){var sa=(a.region===region?2:0)+(a.tier==='S'?0.4:a.tier==='A'?0.2:0);var sb=(b.region===region?2:0)+(b.tier==='S'?0.4:b.tier==='A'?0.2:0);return sb-sa;});
 var p=cands[0];return {n:p.n,reps:p.reps,v:p.v,mu:p.mu};
}
function addExercise(plan,dayKey,item,profile){
 var c=cstate();
 var day=(plan.days||[]).filter(function(d){return d.key===dayKey;})[0];if(!day||!item)return false;
 if(!day.exercises)day.exercises=[];
 var ex={name:item.n||item.name,muscle:item.muscle||item.m||'def',sets:3,reps:item.reps||'8-12',rest:90,video:item.v||item.video||'',added:true};
 day.exercises.push(ex);
 snapshotPlan(plan);save('forma_plan',plan);
 notify(c,{week:0,icon:'',title:'تمت إضافة تمرين',text:'أضفت «'+ex.name+'» ل'+ML(ex.muscle)+' في يوم '+dayLabel(plan,dayKey)+' — هيتتابع ويتطور زي باقي تمارينك'});
 note(c,0,'','إضافة «'+ex.name+'» بإيد المتدرب');persist(c);
 return true;
}
function removeExercise(plan,dayKey,exName){
 var day=(plan.days||[]).filter(function(d){return d.key===dayKey;})[0];if(!day)return false;
 day.exercises=(day.exercises||[]).filter(function(e){return e.name!==exName;});
 snapshotPlan(plan);save('forma_plan',plan);return true;
}

/* ---------- decisions: approve / keep ---------- */
function findNotif(c,id){for(var i=0;i<c.notif.length;i++){if(c.notif[i].id===id)return c.notif[i];}return null;}
function applyDecision(plan,id,profile){
 var c=cstate();var n=findNotif(c,id);if(!n||n.kind!=='decision'||n.state!=='pending')return {ok:false};
 var ch=n.change||{};var msg='';
 if(ch.type==='set+'){var s=c.ex[ch.key];if(s)s.sets=(s.sets||3)+1;setPlanSets(plan,ch.dayKey,ch.exName,(s?s.sets:null));msg='تمت زيادة مجموعة على «'+ch.exName+'»';}
 else if(ch.type==='set-'){var s2=c.ex[ch.key];if(s2&&s2.sets>1)s2.sets-=1;setPlanSets(plan,ch.dayKey,ch.exName,(s2?s2.sets:null));msg='تم تخفيف مجموعة من «'+ch.exName+'»';}
 else if(ch.type==='add'){addExercise(plan,ch.dayKey,{n:ch.exName,muscle:ch.muscle,reps:ch.reps,v:ch.video},profile);msg='تمت إضافة «'+ch.exName+'»';}
 else if(ch.type==='swap'){
  (plan.days||[]).forEach(function(d){if(d.key!==ch.dayKey)return;(d.exercises||[]).forEach(function(e){if(e.name===ch.exName){e.name=ch.newName;e.reps=ch.reps||e.reps;if(ch.video)e.video=ch.video;e.muscle=e.muscle||ch.muscle;}});});
  var ok2=ch.dayKey+'|'+ch.exName,nk=ch.dayKey+'|'+ch.newName;var os=c.ex[ok2];
  c.ex[nk]={ww:0,rep:(os&&os.rep)||range(ch.reps||'8-12')[0],sets:(os&&os.sets)||3,rest:(os&&os.rest)||90,stall:0,prog:0,sessions:0};
  if(os)delete c.ex[ok2];
  msg='تم استبدال «'+ch.exName+'» ب«'+ch.newName+'»';
 }
 else if(ch.type==='rest'){applyRest(plan,c,ch.delta);msg='تم تعديل زمن الراحة';}
 n.state='approved';n.read=true;
 note(c,n.week,'','وافقت: '+(n.title||''));
 notify(c,{week:n.week,icon:'',title:'تم تطبيق قرارك',text:msg+' — التغيير اتطبق على خطتك'});
 // Snapshot ONCE, before the change is persisted. It used to be called twice
 // here, which pushed two identical entries onto forma_plan_snapshots and made
 // "undo one step" need two clicks.
 snapshotPlan(plan);
 persist(c);save('forma_plan',plan);
 return {ok:true};
}
function keepDecision(id){
 var c=cstate();var n=findNotif(c,id);if(!n||n.kind!=='decision'||n.state!=='pending')return {ok:false};
 n.state='kept';n.read=true;note(c,n.week,'⏸','اخترت الاستمرار: '+(n.title||''));persist(c);return {ok:true};
}
function setPlanSets(plan,dayKey,exName,sets){if(sets==null)return;(plan.days||[]).forEach(function(d){if(d.key!==dayKey)return;(d.exercises||[]).forEach(function(e){if(e.name===exName)e.sets=sets;});});}
function applyRest(plan,c,delta){(plan.days||[]).forEach(function(d){(d.exercises||[]).forEach(function(e){var st=ensure(c,d.key+'|'+e.name,e);var _rcap=(plan&&plan.goal==='strength')?300:180;st.rest=Math.max(45,Math.min(_rcap,(st.rest||90)+delta));e.rest=st.rest;});});}

/* ---------- deload tick: auto-apply + auto-resume on fixed cadence ---------- */
function tick(plan,logs,week,mweek,meso,profile){
 var c=cstate();var changed=false;
 var cycle=Math.floor((week-1)/meso); /* which mesocycle we are in (0-based) */
 if(mweek>=meso){
  var dk='dl_'+cycle;
  if(!c.deloadMark[dk]){c.deloadMark[dk]=true;changed=true;
   notify(c,{week:week,icon:'',title:'بدأ أسبوع التخفيف (ديلود) تلقائيا',
    text:'دولود أوتوماتيك: الأوزان اتخفضت ~10% والتكرار أقل والRIR أعلى عشان الجسم يستشفي ويفرغ التعب. مفيش منك حاجة — بس التزم بالأوزان المقترحة'});
  }
 } else {
  var rk='rs_'+cycle;
  if(cycle>=1&&!c.deloadMark[rk]){c.deloadMark[rk]=true;changed=true;
   notify(c,{week:week,icon:'',title:'دورة جديدة بدأت — رجوع الخطة',
    text:'خلص الديلود ورجعنا للحمل الكامل تلقائيا بأوزان أعلى ومجهود أقوى. استعد لأسبوع تحميل جديد'});
  }
 }
 if(changed)persist(c);
 return changed;
}

/* ---------- analysis (daily / weekly / monthly) ---------- */
function histAll(){return load('forma_hist',[]);}
function tonnage(w,r,s){return (+w||0)*(+r||0)*(+s||0);}

/* ============ modern training-science metrics ============ */
/* Estimated 1RM (Epley) — a strength proxy independent of the rep used. */
function e1rm(w,r){w=+w||0;r=+r||0;if(w<=0||r<=0)return 0;return r===1?w:Math.round(w*(1+r/30)*10)/10;}
/* Relative intensity = %1RM implied by a rep count (inverse Epley). */
function pct1rm(r){r=+r||0;return r<=1?1:1/(1+r/30);}
/* Stimulating ("effective") reps in a set ≈ the last 5 reps before failure that
   were actually performed; with a target RIR that is max(0, 5 - RIR). */
function stimReps(reps,rir){reps=+reps||0;rir=+rir||0;return Math.max(0,Math.min(reps,5-rir));}
/* Maximum Adaptive Volume = productive midpoint between MEV and MRV. */
function mav(exp,m){return Math.round((mev(exp,m)+mrv(exp,m))/2);}
/* Weekly-volume status for a muscle vs its landmarks (MEV / MAV / MRV). */
function volStatus(exp,m,sets){var lo=mev(exp,m),mid=mav(exp,m),hi=mrv(exp,m);
 if(sets<lo)return {z:'below',lo:lo,mid:mid,hi:hi,txt:'تحت MEV ('+lo+') — حجم غير كاف للنمو'};
 if(sets<mid)return {z:'build',lo:lo,mid:mid,hi:hi,txt:'في منطقة البناء ('+lo+'–'+mid+') — فيه مساحة لزيادة الحجم'};
 if(sets<hi)return {z:'optimal',lo:lo,mid:mid,hi:hi,txt:'قرب الحجم الأمثل ('+mid+'–'+hi+') — زود بحذر'};
 return {z:'over',lo:lo,mid:mid,hi:hi,txt:'عند/فوق MRV ('+hi+') — خطر إفراط، فكر في تخفيف'};}
/* Acute:Chronic Workload Ratio from tonnage history (safe band 0.8–1.3). */
function acwrFrom(hist,week){
 var byW={};hist.forEach(function(h){byW[h.week]=(byW[h.week]||0)+tonnage(h.weight,h.reps,h.sets);});
 var acute=byW[week]||0,chron=0,n=0;
 for(var w=week-1;w>=week-4&&w>=1;w--){if(byW[w]!=null){chron+=byW[w];n++;}}
 chron=n?chron/n:0;
 return chron>0?Math.round(acute/chron*100)/100:null;
}
function acwrZone(a){if(a==null)return '';if(a<0.8)return 'منخفض (احتمال فقدان لياقة)';if(a<=1.3)return 'مثالي (تحميل آمن وفعال)';if(a<=1.5)return 'مرتفع (راقب التعب)';return 'خطر إفراط (Spike)';}
/* e1RM trend for one exercise across history: first vs last estimated 1RM. */
function e1rmTrend(hist,exName){
 var first=null,last=null,lastTs=0,firstTs=1e18;
 hist.forEach(function(h){if(h.exName!==exName)return;var e=e1rm(h.weight,h.reps);if(e<=0)return;if(h.ts<firstTs){firstTs=h.ts;first=e;}if(h.ts>=lastTs){lastTs=h.ts;last=e;}});
 if(first==null||last==null)return null;
 return {from:first,to:last,delta:Math.round((last-first)*10)/10,pct:first?Math.round((last-first)/first*1000)/10:0};
}

function analysis(scope,plan,logs,done,week,mweek,meso,profile){
 var c=cstate();var exp=(profile&&profile.exp)||'intermediate';
 var hist=histAll();
 if(scope==='weekly')return weeklyAn(c,exp,plan,logs,hist,week,mweek,meso,done);
 if(scope==='monthly')return monthlyAn(c,exp,plan,logs,hist,week,mweek,meso,profile);
 return dailyAn(c,exp,plan,logs,hist,week);
}

function dailyAn(c,exp,plan,logs,hist,week){
 /* most recent training day in history (or live today's logs) */
 var today=hist.filter(function(h){return h.week===week;});
 /* group by dayKey, take the latest session's day */
 var lastDay=null,lastTs=0;today.forEach(function(h){if(h.ts>lastTs){lastTs=h.ts;lastDay=h.dayKey;}});
 var rows=today.filter(function(h){return h.dayKey===lastDay;});
 var sets=0,ton=0,exsN={},best=null;
 rows.forEach(function(h){sets+=(+h.sets||0);ton+=tonnage(h.weight,h.reps,h.sets);exsN[h.exName]=true;if(!best||h.weight>best.weight)best={name:h.exName,weight:h.weight,reps:h.reps};});
 var label=lastDay?dayLabel(plan,lastDay):null;
 var evalTxt,score;
 if(!rows.length){evalTxt='لسه مفيش جلسة اتسجلت الأسبوع ده — سجل أوزانك وخلص جلسة عشان يبدأ التحليل';score=0;}
 else{score=Math.min(100,Math.round(Object.keys(exsN).length/Math.max(1,rows.length)*100));evalTxt='جلسة قوية! سجلت '+Object.keys(exsN).length+' تمرين بإجمالي '+sets+' مجموعة وحمل كلي '+Math.round(ton)+' كجم·عدة';}
 var notes=[];
 if(best){var bE=e1rm(best.weight,best.reps);notes.push({icon:'',text:'أقوى رفعة: «'+best.name+'» '+best.weight+'كجم×'+best.reps+' — 1RM تقديري ≈ '+bE+' كجم (شدة نسبية ~'+Math.round(pct1rm(best.reps)*100)+'% من 1RM).'});}
 if(rows.length)notes.push({icon:'',text:'حجم الجلسة: '+sets+' مجموعة بحمل كلي '+Math.round(ton)+' كجم·عدة عبر '+Object.keys(exsN).length+' تمرين'});
 notes.push({icon:'',text:'توصية: استهدف آخر ٥ تكرارات قبل الفشل (المنطقة المحفزة للنمو)، وثبت الأداء قبل زيادة الوزن'});
 return {scope:'daily',label:label,sets:sets,tonnage:Math.round(ton),exercises:Object.keys(exsN).length,score:score,eval:evalTxt,notes:notes};
}

function weeklyAn(c,exp,plan,logs,hist,week,mweek,meso,done){
 done=done||{};
 var wk=hist.filter(function(h){return h.week===week;});
 var prev=hist.filter(function(h){return h.week===week-1;});
 var byM={},ton=0,sets=0,prog=0,base=0;
 wk.forEach(function(h){var m=cMus(h);byM[m]=(byM[m]||0)+(+h.sets||0);ton+=tonnage(h.weight,h.reps,h.sets);sets+=(+h.sets||0);});
 var prevTon=0;prev.forEach(function(h){prevTon+=tonnage(h.weight,h.reps,h.sets);});
 /* progression from coach state */
 Object.keys(c.ex).forEach(function(k){if(c.ex[k].ww){base++;if(c.ex[k].prog>0)prog++;}});
 var sessions=0;(plan.days||[]).forEach(function(d){if(done[d.key+'_w'+week])sessions++;});
 var muscles=Object.keys(byM).map(function(m){return {label:ML(m),m:m,sets:byM[m],cap:mrv(exp,m),floor:mev(exp,m)};}).sort(function(a,b){return b.sets-a.sets;});
 var adher=Math.round(sessions/Math.max(1,(plan.days||[]).length)*100);
 var tonDelta=prevTon?Math.round((ton-prevTon)/prevTon*100):null;
 var score=Math.max(0,Math.min(100,Math.round(adher*0.5+(base?prog/base*100:0)*0.5)));
 var evalTxt;
 if(adher>=80&&score>=60)evalTxt='أسبوع ممتاز — التزام عالي وتقدم واضح. استمر بنفس الإيقاع';
 else if(adher>=80)evalTxt='التزامك ممتاز بس التقدم بطيء شوية — ركز على زيادة التكرار داخل المدى قبل الوزن';
 else evalTxt='الالتزام أقل من المطلوب ('+adher+'%) — حاول تكمل جلساتك عشان التطور يكمل';
 var notes=[];
 var acw=acwrFrom(hist,week);
 muscles.forEach(function(m){var vs=volStatus(exp,m.m,m.sets);if(vs.z==='below')notes.push({icon:'',text:ML(m.m)+': '+m.sets+' ست/أسبوع — '+vs.txt+'.'});else if(vs.z==='over')notes.push({icon:'',text:ML(m.m)+': '+m.sets+' ست/أسبوع — '+vs.txt+'.'});else if(vs.z==='optimal')notes.push({icon:'',text:ML(m.m)+': '+m.sets+' ست/أسبوع — '+vs.txt+'.'});});
 if(acw!=null)notes.push({icon:'',text:'ACWR (الحمل الحاد:المزمن) = '+acw+' — '+acwrZone(acw)+'. النطاق الآمن 0.8–1.3.'});
 if(tonDelta!=null)notes.push({icon:tonDelta>=0?'':'',text:'الحمل الكلي '+(tonDelta>=0?'زاد':'قل')+' '+Math.abs(tonDelta)+'% عن الأسبوع اللي فات'});
 notes.push({icon:'',text:'RIR مستهدف الأسبوع ده '+rirFor(exp,mweek,meso)+' — '+(mweek>=meso?'ديلود (تفريغ تعب)':'تحميل تدريجي')+'.'});
 return {scope:'weekly',sessions:sessions,days:(plan.days||[]).length,adherence:adher,tonnage:Math.round(ton),tonDelta:tonDelta,sets:sets,muscles:muscles,score:score,eval:evalTxt,notes:notes,rir:rirFor(exp,mweek,meso),phase:(mweek>=meso?'ديلود':'تحميل'),acwr:acw};
}

function monthlyAn(c,exp,plan,logs,hist,week,mweek,meso,profile){
 /* aggregate tonnage per week across the mesocycle */
 var byWeek={};hist.forEach(function(h){byWeek[h.week]=(byWeek[h.week]||0)+tonnage(h.weight,h.reps,h.sets);});
 var weeks=Object.keys(byWeek).map(function(w){return {week:+w,ton:Math.round(byWeek[w])};}).sort(function(a,b){return a.week-b.week;}).slice(-meso);
 /* best lifts progression: first vs last recorded weight per exercise */
 var firstW={},lastW={},lastTs={};
 hist.forEach(function(h){var k=h.exName;if(firstW[k]==null)firstW[k]=h.weight;if(h.ts>=(lastTs[k]||0)){lastTs[k]=h.ts;lastW[k]=h.weight;}});
 var lifts=Object.keys(lastW).map(function(k){var dl=lastW[k]-firstW[k];return {name:k,from:firstW[k],to:lastW[k],delta:Math.round(dl*10)/10};}).filter(function(x){return x.delta>0;}).sort(function(a,b){return b.delta-a.delta;}).slice(0,5);
 var wk=detectWeak(plan,logs,profile);
 var totTon=0;weeks.forEach(function(w){totTon+=w.ton;});
 var cycle=Math.floor((week-1)/meso)+1;
 var evalTxt;
 if(lifts.length>=3)evalTxt='تطور شهري قوي — '+lifts.length+' تمارين زادت أوزانها. الدورة شغالة صح';
 else if(lifts.length>=1)evalTxt='فيه تقدم على بعض التمارين — حاول تلتزم أكتر بالتسجيل عشان الصورة تكتمل';
 else evalTxt='لسه مفيش بيانات كافية للتحليل الشهري — كمل تسجيل';
 var notes=[];
 var e1lifts=Object.keys(lastW).map(function(k){var t=e1rmTrend(hist,k);return t&&t.pct>0?{name:k,pct:t.pct,from:t.from,to:t.to}:null;}).filter(function(x){return x;}).sort(function(a,b){return b.pct-a.pct;}).slice(0,3);
 e1lifts.forEach(function(l){notes.push({icon:'',text:'قوة «'+l.name+'» اتحسنت ~'+l.pct+'% (1RM تقديري '+l.from+' - '+l.to+' كجم).'});});
 if(weeks.length>=2){var dd=weeks[weeks.length-1].ton-weeks[0].ton;notes.push({icon:dd>=0?'':'',text:'منحنى الحمل خلال الدورة '+(dd>=0?'صاعد':'هابط')+' ('+weeks[0].ton+' - '+weeks[weeks.length-1].ton+' كجم·عدة).'});}
 wk.weak.slice(0,3).forEach(function(w){notes.push({icon:'',text:'عضلة محتاجة اهتمام: '+w.label+' — '+w.reasons[0]+'.'});});
 notes.push({icon:'',text:'دورة التطور رقم '+cycle+' · أسبوع '+mweek+'/'+meso+(mweek>=meso?' (ديلود)':'')+'.'});
 return {scope:'monthly',weeks:weeks,lifts:lifts,weak:wk.weak,totalTonnage:totTon,cycle:cycle,eval:evalTxt,notes:notes};
}

/* ---------- live summary for coach tab (no mutations) ---------- */
function summary(plan,logs,mweek,meso,profile){
 var c=cstate();var exp=(profile&&profile.exp)||'intermediate';var rec=(profile&&+profile.recovery)||65;
 var byMuscle={},ready=0;
 plan.days.forEach(function(d){(d.exercises||[]).forEach(function(ex){var key=d.key+'|'+ex.name;var st=ensure(c,key,ex);var m=cMus(ex);byMuscle[m]=byMuscle[m]||{sets:0};byMuscle[m].sets+=(+ex.sets||st.sets);var lg=logs[key];if(lg&&lg.weight){var r=range(ex.reps);if((+lg.reps||0)>=r[1])ready++;}});});
 var lines=[];
 if(ready>0)lines.push({icon:'',text:ready+' تمرين وصل لأعلى العدات وجاهز لزيادة الوزن المرة الجاية'});
 lines.push({icon:rec>=65?'':rec>=50?'':'',text:'مؤشر الاستشفاء عندك '+Math.round(rec)+'/100 — '+(rec>=65?'ممتاز للدفع وزيادة الحجم':rec>=50?'كويس، حافظ على نومك وتغذيتك':'منخفض، الأولوية للراحة وجودة الأداء')});
 var rir=rirFor(exp,mweek,meso);
 lines.push({icon:'',text:'استهدف '+rir+' تكرارات احتياطية (RIR) — سيب في الخزان عشان تستشفي وتتقدم بثبات'});
 var muscles=Object.keys(byMuscle).map(function(m){return {label:ML(m),sets:byMuscle[m].sets,cap:mrv(exp,m)};}).sort(function(a,b){return b.sets-a.sets;}).slice(0,8);
 return {rir:rir,lines:lines,muscles:muscles};
}

function state(){return cstate();}
function unread(){var c=cstate();return c.notif.filter(function(n){return !n.read;}).length;}
function notifs(){return cstate().notif;}
function pending(){return cstate().notif.filter(function(n){return n.kind==='decision'&&n.state==='pending';});}
function markAllRead(){var c=cstate();c.notif.forEach(function(n){if(n.kind!=='decision'||n.state!=='pending')n.read=true;});persist(c);}
function muscles(){return muscleList().map(function(m){return {key:m,label:ML(m)};});}

window.Coach={
 nextTarget:nextTarget,applyDay:applyDay,review:review,summary:summary,state:state,
 detectWeak:detectWeak,analysis:analysis,tick:tick,
 suggestExercise:suggestExercise,substituteFor:substituteFor,addExercise:addExercise,removeExercise:removeExercise,
 applyDecision:applyDecision,keepDecision:keepDecision,
 unread:unread,notifs:notifs,pending:pending,markAllRead:markAllRead,muscles:muscles,ML:ML,cmus:cMus
};
})();
