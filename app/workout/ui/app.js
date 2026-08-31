/* ElForma controller — human onboarding + analysis + plan chooser.
   Uses the smart_workout_v60 engine (global `state`, buildExercisePlan, MODULE_DB, ...). */
(function(){
'use strict';
var $=function(id){return document.getElementById(id);};
var ans={};       // answers by question id
var idx=0;        // current question index
var PLANS=[];     // computed plans
var EF_SKIP={};   // أسئلة مشتركة تم ملؤها من البروفايل الموحد (تتخطى)

/* ---------- defensive exercise readers ---------- */
function exName(e){return e.n||e.name||'تمرين';}
function exSets(e){return Array.isArray(e.sets)?e.sets.length:(e.sets||3);}
function exReps(e){return e.reps||'10-12';}
function exRest(e){var r=e.rest;if(typeof r==='number')return r;var m=String(r||'').match(/\d+/);return m?+m[0]:90;}
function exVid(e){return e.vid||e.video||'';}
function exMuscle(e){return e.mu||e.muscle||'';}

/* ---------- questions: human, professional, no emojis ---------- */
var Q=[
 {id:'gender',type:'choice',q:'يلا نبدأ رحلتك — إنت...',h:'محتاجين دي عشان نظبط معادلات جسمك صح من أول خطوة',o:[{v:'ذكر'},{v:'أنثى'}]},
 {id:'age',type:'number',q:'عندك كام سنة؟',h:'السن بيحدد سرعة استشفاء جسمك وحجم الحمل المناسب ليك',min:14,max:75,def:25,step:1,unit:'سنة'},
 {id:'goal',type:'choice',q:'إيه أكتر هدف نفسك توصله؟',h:'هدفك هو اللي هيحدد شكل الجدول وطريقة تمرينك بالكامل',o:[{v:'تضخيم',d:'تكبير العضلات وزيادة الكتلة'},{v:'تنشيف',d:'حرق الدهون وإبراز العضل'},{v:'قوة',d:'رفع أوزان أتقل وزيادة قوتك'},{v:'لياقة',d:'صحة ولياقة وجسم متناسق'}]},
 {id:'exp',type:'choice',q:'خبرتك في الحديد لحد دلوقتي؟',h:'كل ما تكون أصدق، كل ما يطلع جدولك مظبوط على مستواك',o:[{v:'مبتدئ',d:'أقل من سنة'},{v:'متوسط',d:'من سنة ل 3 سنين'},{v:'متقدم',d:'أكتر من 3 سنين'}]},
 {id:'equip',type:'choice',q:'هتتمرن فين غالبا؟',h:'عشان نختارلك تمارين متاحة قدامك فعلا',o:[{v:'جيم',d:'أجهزة وأوزان كاملة'},{v:'البيت',d:'دمبل ووزن الجسم'}]},
 {id:'days',type:'chips',q:'تقدر تلتزم بكام يوم في الأسبوع؟',h:'اختار رقم تقدر تكمل عليه فعلا — الالتزام أهم من الطموح',o:[{v:'2'},{v:'3'},{v:'4'},{v:'5'},{v:'6'}],suf:'أيام'},
 {id:'time',type:'chips',q:'وقتك المتاح للتمرينة الواحدة؟',h:'هنفصل حجم التمرينة على الوقت اللي عندك',o:[{v:'45'},{v:'60'},{v:'75'}],suf:'دقيقة'},
 {id:'height',type:'number',q:'طولك كام؟',h:'بنحسب بيه مؤشر الكتلة واحتياجك من السعرات',min:140,max:215,def:175,step:1,unit:'سم'},
 {id:'weight',type:'number',q:'وزنك الحالي كام؟',h:'دي نقطة البداية بس — وهنشوف تطورها مع بعض',min:40,max:200,def:75,step:1,unit:'كجم'},
 {id:'daily',type:'choice',q:'نشاطك اليومي برة التمرين عامل إزاي؟',h:'حركتك اليومية بتأثر على سعراتك وقدرتك على الاستشفاء',o:[{v:'مكتبي',d:'جلوس معظم اليوم'},{v:'خفيف',d:'حركة بسيطة'},{v:'معتدل',d:'نشاط متوسط'},{v:'نشيط',d:'حركة كتير'},{v:'رياضي',d:'مجهود بدني عالي'}]},
 {id:'sleep',type:'choice',q:'نومك بالليل عامل إزاي؟',h:'النوم هو وقت بناء العضلات الحقيقي — بناخده بجدية',o:[{v:'ضعيف',d:'أقل من 6 ساعات'},{v:'كويس',d:'من 6 ل 7 ساعات'},{v:'ممتاز',d:'أكتر من 7 ساعات'}]},
 {id:'stress',type:'choice',q:'مستوى التوتر والضغط في حياتك؟',h:'بنراعيه عشان نظبط حجم المجهود على قدرتك الحقيقية',o:[{v:'قليل',d:'رايق غالبا'},{v:'متوسط',d:'عادي'},{v:'عالي',d:'ضغط مستمر'}]},
 {id:'injuries',type:'gate',q:'في أي إصابات لازم ناخد بالنا منها؟',h:'سلامتك أهم حاجة — هنتجنب أي تمرين ممكن يضرك',gq:'عندك إصابة حاليا؟',yes:'يوجد',no:'لا يوجد',max:2,pick:'اختار مكان الإصابة (لحد إصابتين)',o:[{v:'كتف'},{v:'ظهر'},{v:'ركبة'},{v:'مرفق'},{v:'رسغ'},{v:'رقبة'}]},
 {id:'weak',type:'gate',optional:true,q:'في عضلة حاسس إنها متأخرة وعايز تركز عليها؟',h:'هنديها اهتمام وحجم تمرين أكبر داخل جدولك',gq:'عايز تركز على عضلة معينة؟',yes:'أيوه',no:'لأ، كله متوازن',max:3,pick:'اختار العضلات (لحد 3)',o:[{v:'صدر'},{v:'ظهر'},{v:'أكتاف'},{v:'ذراع'},{v:'أرجل'},{v:'مؤخرة'},{v:'بطن'},{v:'سمانة'},{v:'ساعد'}]}
];

var PRAISE=[
 'تمام، إجابتك دي بتساعدنا نظبط جدولك أكتر',
 'حلو — كل معلومة بتقربنا من الجدول المثالي ليك',
 'كده إحنا ماشيين صح، كمل معايا',
 'ممتاز، البيانات دي هي سر إن جدولك يطلع مخصص ليك إنت بالذات',
 'جميل — فاضل خطوات بسيطة ونخلص',
 'تمام كده، إجابتك واضحة وهتفرق في النتيجة',
 'عاش، كل سؤال بنجاوبه بيخلي خطتك أدق',
 'كده بنبني صورة كاملة عن جسمك واحتياجك',
 'قربنا نخلص — كمل وإنت مطمن إن كل ده مفصل ليك'
];

function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

/* ---------- inline SVG illustrations (line-art, NOT emojis) ---------- */
var SVG_MALE='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="23" r="11"/><path d="M22 18c3-7 17-7 20 0"/><path d="M13 55c0-12 8-17 19-17s19 5 19 17"/></svg>';
var SVG_FEMALE='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="24" r="10"/><path d="M21 27c-4-18 24-18 22 0"/><path d="M20 26c-3 8-2 14-1 18M44 26c3 8 2 14 1 18"/><path d="M15 56c0-11 8-16 17-16s17 5 17 16"/></svg>';
function bars(n){var hh=[8,12,16],s='';for(var i=0;i<3;i++){var on=i<n;s+='<rect x="'+(3+i*7)+'" y="'+(21-hh[i])+'" width="5" height="'+hh[i]+'" rx="1.5" '+(on?'fill="currentColor"':'fill="none" stroke="currentColor" stroke-width="1.6" opacity=".35"')+'/>';}return '<svg viewBox="0 0 24 24">'+s+'</svg>';}
function gauge(x,y){return '<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 27a18 18 0 0 1 36 0"/><line x1="24" y1="27" x2="'+x+'" y2="'+y+'"/><circle cx="24" cy="27" r="2.6" fill="currentColor" stroke="none"/></svg>';}
var I={};
I['gender:ذكر']=SVG_MALE; I['gender:أنثى']=SVG_FEMALE;
I['exp:مبتدئ']=bars(1); I['exp:متوسط']=bars(2); I['exp:متقدم']=bars(3);
I['equip:جيم']='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>';
I['equip:البيت']='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/></svg>';
I['daily:مكتبي']='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="11" rx="1.5"/><path d="M8 20h8M12 15v5"/></svg>';
I['daily:خفيف']='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4.5" r="2"/><path d="M13 8l-2 5 3 3 1 5M11 13l-4 2M16 11l3 2"/></svg>';
I['daily:معتدل']='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="3.5"/><circle cx="18" cy="17" r="3.5"/><path d="M9.5 17l3-6h4l2.5 6M12.5 11l3-3"/></svg>';
I['daily:نشيط']='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="14" cy="4.5" r="2"/><path d="M14 8l-3 4 2 4 1 5M11 12l-4 1-2 4M16 12l4 1"/></svg>';
I['daily:رياضي']='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M10 14v3M14 14v3M8 20h8"/></svg>';
I['stress:قليل']=gauge(12,15); I['stress:متوسط']=gauge(24,9); I['stress:عالي']=gauge(36,15);
function moon(n){var st='';var pos=[[17,5],[20,9]];for(var i=0;i<n;i++){st+='<circle cx="'+pos[i][0]+'" cy="'+pos[i][1]+'" r="1.1" fill="currentColor" stroke="none"/>';}return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4 6.2 6.2 0 0 0 20 14.5z"/>'+st+'</svg>';}
I['goal:تضخيم']='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-7"/><path d="M21 8v4h-4"/></svg>';
I['goal:تنشيف']='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 .5 2 2 2.5 3 1.5 .6-1.5-1-4 0-6z"/></svg>';
I['goal:قوة']='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>';
I['goal:لياقة']='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-5 3 10 2-5h7"/></svg>';
I['sleep:ضعيف']=moon(0); I['sleep:كويس']=moon(1); I['sleep:ممتاز']=moon(2);
var IC_COLOR={'gender:ذكر':['#22B8CF','rgba(34,184,207,.13)'],'gender:أنثى':['#FF6B35','rgba(255,107,53,.13)'],'goal:تضخيم':['#00D4AA','rgba(0,212,170,.13)'],'goal:تنشيف':['#FF6B35','rgba(255,107,53,.13)'],'goal:قوة':['#5B8BDB','rgba(91,139,219,.13)'],'goal:لياقة':['#9a5fdd','rgba(154,95,221,.13)'],'exp:مبتدئ':['#00D4AA','rgba(0,212,170,.13)'],'exp:متوسط':['#22B8CF','rgba(34,184,207,.13)'],'exp:متقدم':['#FF6B35','rgba(255,107,53,.13)'],'equip:جيم':['#22B8CF','rgba(34,184,207,.13)'],'equip:البيت':['#FF6B35','rgba(255,107,53,.13)'],'daily:مكتبي':['#7AACAA','rgba(122,172,170,.13)'],'daily:خفيف':['#00D4AA','rgba(0,212,170,.13)'],'daily:معتدل':['#22B8CF','rgba(34,184,207,.13)'],'daily:نشيط':['#FF6B35','rgba(255,107,53,.13)'],'daily:رياضي':['#5B8BDB','rgba(91,139,219,.13)'],'sleep:ضعيف':['#FF6B35','rgba(255,107,53,.13)'],'sleep:كويس':['#22B8CF','rgba(34,184,207,.13)'],'sleep:ممتاز':['#00D4AA','rgba(0,212,170,.13)'],'stress:قليل':['#00D4AA','rgba(0,212,170,.13)'],'stress:متوسط':['#FF9266','rgba(255,146,102,.13)'],'stress:عالي':['#FF6B35','rgba(255,107,53,.13)']};
function colorFor(qid,val){return IC_COLOR[qid+':'+val]||['#00D4AA','rgba(0,212,170,.13)'];}
function iconFor(qid,val){return I[qid+':'+val]||'';}

/* ---------- helper-unit catalog (ALL units imported from MODULE_DB) ---------- */
function _md(e){return e.duration||e.protocol||e.sets||'';}
function _tierRank(t){var r={S:0,A:1,B:2,C:3,D:4};return r[t]!=null?r[t]:9;}
function _mapAll(arr){return (arr||[]).slice().sort(function(a,b){return _tierRank(a.tier)-_tierRank(b.tier);}).slice(0,5).map(function(e){return{name:e.n,dose:_md(e),desc:e.desc||'',video:e.vid||'',tier:e.tier||'',equipment:e.equipment||'none'};});}
function buildModuleCatalog(){
 var M=(typeof MODULE_DB!=='undefined')?MODULE_DB:null;if(!M)return [];
 var out=[];
 if(M.mobility)out.push({key:'warmup',title:'الإحماء',tagline:'تجهيز الجسم قبل التمرين',guide:'قبل كل تمرينة 5–8 دقايق — بيرفع كفاءة أدائك ومدى حركتك ويقلل خطر الإصابة لأقصى درجة',items:_mapAll(M.mobility)});
 if(M.cardio){var c=[].concat(M.cardio.s||[],M.cardio.a||[],M.cardio.b||[]);out.push({key:'cardio',title:'الكارديو',tagline:'لياقة القلب وحرق الدهون',guide:'حسب هدفك: للتنشيف 3 مرات أسبوعيا بعد الحديد، وللتضخيم خفيف مرة–مرتين للحفاظ على صحة القلب',items:_mapAll(c)});}
 if(M.core)out.push({key:'core',title:'الكور (البطن والجذع)',tagline:'جذع أقوى وثبات أعلى',guide:'2–3 مرات أسبوعيا في آخر التمرينة — الكور القوي بيحميك من إصابات الظهر ويحسن كل رفعاتك الكبيرة',items:_mapAll(M.core)});
 if(M.stretching)out.push({key:'stretch',title:'الإطالة',tagline:'استشفاء أسرع ومرونة أعلى',guide:'بعد كل تمرينة 5 دقايق — بتقلل الشد العضلي وتسرع الاستشفاء وتحافظ على مرونة مفاصلك',items:_mapAll(M.stretching)});
 if(M.yoga)out.push({key:'yoga',title:'اليوجا والمرونة',tagline:'توازن وصفاء ذهن',guide:'في أيام الراحة أو الصبح — بتحسن المرونة والتوازن وبتهدي الأعصاب',items:_mapAll(M.yoga)});
 if(M.breathing)out.push({key:'breath',title:'التنفس والاسترخاء',tagline:'تركيز أعلى وتعاف أسرع',guide:'قبل التمرين للتركيز وبعده للاسترخاء — بيخفض هرمون التوتر ويسرع التعافي',items:_mapAll(M.breathing)});
 if(M.recovery)out.push({key:'recovery',title:'التعافي',tagline:'تقليل الألم بعد التمرين',guide:'في أيام الراحة — فوم رولينج وإطالة كاملة بتقلل آلام العضلات وتحسن تدفق الدم',items:_mapAll(M.recovery)});
 if(M.kegel)out.push({key:'kegel',title:'الكيجل (قاع الحوض)',tagline:'تحكم وأداء أفضل',guide:'يوميا في أي وقت — بيقوي قاع الحوض ويحسن التحكم والثبات أثناء الرفعات الكبيرة',items:_mapAll(M.kegel)});
 return out;
}
function defaultActiveModules(){
 var g={'تنشيف':'cut','تضخيم':'muscle','قوة':'strength','لياقة':'fitness'}[ans.goal]||'muscle';
 var base=['warmup','stretch','core'];
 if(g==='cut'||g==='fitness')base.push('cardio');
 return base;
}
Q.push({id:'modules',type:'modules',q:'تحب نضيف وحدات مساعدة لبرنامجك؟',h:'دي إضافات بتكمل جدولك — اختار اللي يناسب وقتك وهدفك، وتقدر تغيرها من الداشبورد في أي وقت'});

/* ---------- phase stepper ---------- */
var PHASE_BOUNDS=[2,7,12,15]; // question idx: phase 0=0-1, 1=2-6, 2=7-11, 3=12+
function phaseOf(i){for(var p=0;p<PHASE_BOUNDS.length;p++){if(i<PHASE_BOUNDS[p])return p;}return 3;}
// progress within current phase (0..1)
function phaseProgress(i){
  var cur=phaseOf(i);
  var lo=cur===0?0:PHASE_BOUNDS[cur-1];
  var hi=PHASE_BOUNDS[cur];
  return (i-lo)/Math.max(1,hi-lo);
}
function updatePhase(i){
  var cur=phaseOf(i);
  var pct=phaseProgress(i);
  Array.prototype.forEach.call(document.querySelectorAll('.ef-phase'),function(el){
    var p=+el.getAttribute('data-phase');
    el.classList.toggle('done',p<cur);
    el.classList.toggle('active',p===cur);
    el.classList.toggle('pending',p>cur);
  });
  // animate fill tracks
  for(var li=0;li<3;li++){
    var fill=document.getElementById('epFill'+li);
    if(!fill)continue;
    if(li<cur){fill.style.width='100%';}
    else if(li===cur){fill.style.width=Math.round(pct*100)+'%';}
    else{fill.style.width='0%';}
  }
}

/* ---------- screens ---------- */
function show(id){['scWizard','scAnalysis','scPlans'].forEach(function(s){var el=$(s);if(el)el.classList.toggle('active',s===id);});var ef=document.getElementById('efPhases');if(ef)ef.style.display=(id==='scWizard'?'flex':'none');window.scrollTo(0,0);}
function start(){
 try{if(window.EFProfile){EF_SKIP={};(EFProfile.applyToWorkout(ans)||[]).forEach(function(id){EF_SKIP[id]=true;});}}catch(e){}
 idx=0;while(idx<Q.length-1&&EF_SKIP[Q[idx].id])idx++;
 show('scWizard');render();
}

/* ---------- render current question ---------- */
/* ---- Phase icons for qIcon ---- */
var EF_PHASE_ICONS=[
 '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
 '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="3" x2="12" y2="1"/><line x1="12" y1="23" x2="12" y2="21"/><line x1="3" y1="12" x2="1" y2="12"/><line x1="23" y1="12" x2="21" y2="12"/></svg>',
 '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
 '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
];
var EF_PHASE_NAMES=['تعرف عليك','هدفك ووجهتك','أسلوب حياتك','صحتك وأمانتك'];

function render(){
 var qq=Q[idx];
 var pct=Math.round((idx)/Q.length*100);
 $('progBar').style.width=pct+'%';$('progTxt').textContent=pct+'%';
 /* -- qIcon & qKicker -- */
 var pi=phaseOf(idx);
 var PHC=[['#00D4AA','rgba(0,212,170,.15)'],['#22B8CF','rgba(34,184,207,.15)'],['#FF6B35','rgba(255,107,53,.15)'],['#5B8BDB','rgba(91,139,219,.15)']];var ic=$('qIcon');if(ic){var s=EF_PHASE_ICONS[pi]||'';ic.innerHTML=s;ic.style.display=s?'flex':'none';var pc=PHC[pi]||PHC[0];ic.style.color=pc[0];ic.style.background=pc[1];ic.style.borderColor=pc[0];ic.style.boxShadow='0 10px 24px '+pc[1];}
 var kk=$('qKicker');if(kk)kk.innerHTML='<span class="qk-no">المرحلة '+(pi+1)+' من 4</span><span class="qk-dot">•</span><span class="qk-name">'+(EF_PHASE_NAMES[pi]||'')+'</span>';
 $('qText').textContent=qq.q;
 $('qHint').textContent='';$('qHint').style.display='none';
 $('encourage').textContent= idx>0 ? PRAISE[(idx-1)%PRAISE.length] : '';
 var c=$('qContent');c.innerHTML='';
 var note=$('multiNote');note.classList.add('hidden');

 if(qq.type==='choice'){
  var cols=qq.o.length>=4?(qq.o.length%3===0?3:2):qq.o.length;
  var av=qq.id==='gender';
  var colsCls=qq.o.length===5?'cols23':('cols'+(cols===3?3:2));
  var h='<div class="opts '+colsCls+(av?' avrow':'')+'">';
  qq.o.forEach(function(o){var sel=ans[qq.id]===o.v?' sel':'';var ic=iconFor(qq.id,o.v);var col=colorFor(qq.id,o.v);var stx=ic?(' style="--ac:'+col[0]+';--acs:'+col[1]+'"'):'';h+='<button class="opt'+(ic?(av?' av':' withic'):'')+sel+'"'+stx+' data-v="'+esc(o.v)+'">'+(ic?'<span class="oic">'+ic+'</span>':'')+'<span class="olbl">'+esc(o.v)+'</span>'+(o.d?'<span class="odesc">'+esc(o.d)+'</span>':'')+'</button>';});
  h+='</div>';c.innerHTML=h;
  Array.prototype.forEach.call(c.querySelectorAll('.opt'),function(b){b.onclick=function(){ans[qq.id]=b.getAttribute('data-v');render();setTimeout(next,260);};});

 }else if(qq.type==='chips'){
  var h2='<div class="chips center">';
  qq.o.forEach(function(o){var sel=ans[qq.id]===o.v?' sel':'';h2+='<button class="chip'+sel+'" data-v="'+esc(o.v)+'">'+esc(o.v)+(qq.suf?'<span class="unit"> '+esc((qq.suf||'').trim())+'</span>':'')+'</button>';});
  h2+='</div>';c.innerHTML=h2;
  Array.prototype.forEach.call(c.querySelectorAll('.chip'),function(b){b.onclick=function(){ans[qq.id]=b.getAttribute('data-v');render();setTimeout(next,260);};});

 }else if(qq.type==='number'){
  if(ans[qq.id]==null)ans[qq.id]=qq.def;
  var v=+ans[qq.id];
  c.innerHTML='<div class="field"><div class="inputrow"><button class="stepbtn" data-d="-1">−</button><input id="numIn" type="number" value="'+v+'" min="'+qq.min+'" max="'+qq.max+'"><span class="unit">'+esc(qq.unit||'')+'</span><button class="stepbtn" data-d="1">+</button></div><div class="range-wrap"><input id="rng" type="range" min="'+qq.min+'" max="'+qq.max+'" step="'+(qq.step||1)+'" value="'+v+'"></div></div>';
  var inp=$('numIn'),rng=$('rng');
  function setv(nv){nv=Math.max(qq.min,Math.min(qq.max,nv||qq.min));ans[qq.id]=nv;inp.value=nv;rng.value=nv;}
  inp.oninput=function(){ans[qq.id]=+inp.value;rng.value=inp.value;};
  inp.addEventListener('focus',function(){this._stored=this.value;this.value='';});inp.onblur=function(){if(this.value===''||isNaN(+this.value))this.value=this._stored||qq.dflt;setv(+this.value);};
  rng.oninput=function(){setv(+rng.value);};
  Array.prototype.forEach.call(c.querySelectorAll('.stepbtn'),function(b){b.onclick=function(){setv((+ans[qq.id])+(+b.getAttribute('data-d'))*(qq.step||1));};});

 }else if(qq.type==='gate'){
  if(ans[qq.id]==null||typeof ans[qq.id]!=='object')ans[qq.id]={has:null,list:[]};
  var stg=ans[qq.id];
  var hg='<div class="gate"><div class="gate-q">'+esc(qq.gq)+'</div>';
  hg+='<div class="opts cols2 narrow">';
  hg+='<button class="opt gbtn'+(stg.has==='yes'?' sel':'')+'" data-g="yes"><span class="olbl">'+esc(qq.yes||'يوجد')+'</span></button>';
  hg+='<button class="opt gbtn'+(stg.has==='no'?' sel':'')+'" data-g="no"><span class="olbl">'+esc(qq.no||'لا يوجد')+'</span></button>';
  hg+='</div>';
  if(stg.has==='yes'){
   hg+='<div class="gate-pick"><div class="pick-l">'+esc(qq.pick||'اختار')+'</div><div class="chips center">';
   qq.o.forEach(function(o){var on=stg.list.indexOf(o.v)>-1?' sel':'';hg+='<button class="chip sm'+on+'" data-v="'+esc(o.v)+'">'+esc(o.v)+'</button>';});
   hg+='</div><div class="pick-note" id="pickNote"></div></div>';
  }
  hg+='</div>';c.innerHTML=hg;
  Array.prototype.forEach.call(c.querySelectorAll('.gbtn'),function(b){b.onclick=function(){var g=b.getAttribute('data-g');stg.has=g;if(g==='no')stg.list=[];render();};});
  Array.prototype.forEach.call(c.querySelectorAll('.chip'),function(b){b.onclick=function(){toggleGate(qq,b.getAttribute('data-v'));};});
  refreshPick(qq);
 }else if(qq.type==='modules'){
  if(!Array.isArray(ans.modules))ans.modules=defaultActiveModules();
  var cat=buildModuleCatalog();
  var hm='<div class="modsel">';
  cat.forEach(function(m){
   var on=ans.modules.indexOf(m.key)>-1;
   hm+='<button class="msel'+(on?' sel':'')+'" data-k="'+esc(m.key)+'"><span class="msel-box"></span><span class="msel-main"><span class="msel-t">'+esc(m.title)+'</span><span class="msel-tag">'+esc(m.tagline)+' · '+m.items.length+' تمرين</span></span></button>';
  });
  hm+='</div>';c.innerHTML=hm;
  Array.prototype.forEach.call(c.querySelectorAll('.msel'),function(b){b.onclick=function(){var k=b.getAttribute('data-k');var i=ans.modules.indexOf(k);if(i>-1)ans.modules.splice(i,1);else ans.modules.push(k);render();};});
 }
 $('backBtn').style.visibility= idx===0?'hidden':'visible';
 updateNext();
 updatePhase(idx);
}

function toggleGate(qq,v){
 var arr=ans[qq.id].list;var i=arr.indexOf(v);
 if(i>-1){arr.splice(i,1);}
 else{ if(arr.length>=qq.max){flashPick(qq);return;} arr.push(v); }
 render();
}
function refreshPick(qq){var n=$('pickNote');if(!n)return;var cnt=(ans[qq.id].list||[]).length;n.textContent='اخترت '+cnt+' من '+qq.max;}
function flashPick(qq){var n=$('pickNote');if(!n)return;n.textContent='وصلت للحد الأقصى ('+qq.max+') — شيل واحد الأول';n.classList.add('warn');setTimeout(function(){n.classList.remove('warn');refreshPick(qq);},1300);}

function valid(){var qq=Q[idx];var a=ans[qq.id];
 if(qq.type==='modules')return true;
 if(qq.type==='gate'){if(!a||a.has==null)return false;if(a.has==='no')return true;return qq.optional?true:((a.list||[]).length>0);}
 if(qq.type==='number')return a!=null;
 return a!=null&&a!=='';}
function updateNext(){var b=$('nextBtn');b.disabled=!valid();b.textContent= idx===Q.length-1?'حلل وابن جدولي':'يلا نكمل';}

function next(){if(!valid())return;if(idx===Q.length-1){runAnalysis();return;}var j=idx+1;while(j<Q.length&&EF_SKIP[Q[j].id])j++;if(j>=Q.length){runAnalysis();return;}idx=j;render();}
function back(){var j=idx-1;while(j>=0&&EF_SKIP[Q[j].id])j--;if(j>=0){idx=j;render();}}

/* ---------- engine integration ---------- */
function applyToState(){
 var g={'ذكر':'male','أنثى':'female'};
 var goal={'تنشيف':'cut','تضخيم':'muscle','قوة':'strength','لياقة':'fitness'};
 var eq={'جيم':'gym','البيت':'home'};
 var xp={'مبتدئ':'beginner','متوسط':'intermediate','متقدم':'advanced'};
 var dl={'مكتبي':'sedentary','خفيف':'light','معتدل':'moderate','نشيط':'active','رياضي':'veryActive'};
 var sl={'ضعيف':'poor','كويس':'ok','ممتاز':'good'};
 var st={'قليل':'low','متوسط':'mid','عالي':'high'};
 var inj={'كتف':'shoulder','ظهر':'back','ركبة':'knee','مرفق':'elbow','رسغ':'wrist','رقبة':'neck'};
 var wk={'صدر':'chest','ظهر':'back','أكتاف':'shoulders','ذراع':'arms','أرجل':'legs','مؤخرة':'glutes','بطن':'core','سمانة':'calves','ساعد':'forearms'};
 state.gender=g[ans.gender]||'male';
 state.age=+ans.age||25;
 state.goal=goal[ans.goal]||'muscle';
 state.exp=xp[ans.exp]||'beginner';
 state.equip=eq[ans.equip]||'gym';
 state.days=+ans.days||3;
 state.time=String(ans.time||'60');
 state.height=+ans.height||175;
 state.weight=+ans.weight||75;
 state.daily=dl[ans.daily]||'moderate';
 state.sleep=sl[ans.sleep]||'ok';
 state.stress=st[ans.stress]||'low';
 var injList=(ans.injuries&&ans.injuries.has==='yes')?(ans.injuries.list||[]):[];
 var ai=injList.map(function(x){return inj[x];}).filter(Boolean);
 state.injuries=ai.length?ai:['none'];
 var weakList=(ans.weak&&ans.weak.has==='yes')?(ans.weak.list||[]):[];
 state.weak=weakList.map(function(x){return wk[x];}).filter(Boolean);
}
function runMetrics(){
 state.bmi=calcBMI(state.weight,state.height);
 state.bmiCat=getBMICat(state.bmi);
 state.tdee=calcTDEE(state.weight,state.height,state.age,state.gender,state.daily);
 try{state.recoveryScore=calcRecovery();}catch(e){state.recoveryScore=70;}
 try{calcAdvancedScores();}catch(e){}
 try{calcRecoveryModifiers();}catch(e){}
 state.recommendedSplit=getRecommendedSplit();
}
function buildFor(key){
 state.selectedSplit=key;state._trainingSchedule=null;state.plan=null;state._planCacheKey=null;
 state._realTotalSets=null;state.splitData=null;state._lastMuscleMapSplit=null;
 try{buildExercisePlan();}catch(e){console.warn('build',key,e&&e.message);}
 try{return JSON.parse(JSON.stringify(state.plan||[]));}catch(e){return [];}
}
function computePlans(){
 var meta={};try{meta=getSplits()||{};}catch(e){}
 var keys=[];try{keys=(recommendSplitsForDays(state.days)||[]).slice();}catch(e){}
 var rec=state.recommendedSplit;
 if(rec&&keys.indexOf(rec)>-1)keys=[rec].concat(keys.filter(function(k){return k!==rec;}));
 // كل الجداول المتاحة لعدد أيامك تظهر — مرتبة علميا (مش محدودة ب3)
 var out=[];
 keys.forEach(function(k){
  var plan=buildFor(k);
  var td=plan.filter(function(d){return d&&!d.isRest&&(d.exercises||[]).length>0;});
  if(td.length){
   var _q=null;
   try{if(typeof PlanValidator!=='undefined'&&PlanValidator.scorePlan){_q=PlanValidator.scorePlan(td,{exp:state.exp,goal:state.goal,recoveryScore:+state.recoveryScore||70,minEx:state.exp==='advanced'?6:(state.exp==='beginner'?4:5)});}}catch(_e){_q=null;}
   out.push({key:k,name:(meta[k]||{}).name||k,desc:(meta[k]||{}).desc||'',rec:k===rec,plan:plan,trainDays:td,score:scoreSplitScientific(k,meta,rec),quality:_q});
  }
 });
 out.sort(function(a,b){return (b.score-a.score)||((b.rec?1:0)-(a.rec?1:0));});
 return out;
}
// ── تقييم علمي للسبليت: يحدد ترتيب ظهوره للعميل ──────────────────────
// مبني على: تردد تدريب العضلة أسبوعيا (الأمثل ≈ 2×/أسبوع — Schoenfeld 2016)،
// مطابقة الهدف، مطابقة الخبرة، جدوى الاستشفاء، ومرساة التوصية الذكية.
function scoreSplitScientific(k,meta,rec){
 var s=(meta&&meta[k])||{};
 var g=state.goal||'muscle', e=state.exp||'intermediate';
 var r=+state.recoveryScore||60, tier=state._sustainTier||'mid';
 var FREQ={fullbody:2.5,ppl_3:1.2,stronglifts:1.6,upper_lower:2,anterior_posterior:2,ppl_weak:1.4,torso_limbs:2,ppl:(state.days>=6?2:1.7),ululf:2.4,hybrid:1.6,ppul:1.7,brosplit:1,ul6:3,arnold:2};
 var DEM={fullbody:1,ppl_3:1.4,stronglifts:2,upper_lower:1.5,anterior_posterior:1.5,ppl_weak:1.5,torso_limbs:1.5,ppl:2,ululf:2.4,hybrid:1.8,ppul:1.6,brosplit:2.4,ul6:3,arnold:3};
 var f=FREQ[k]||1.6, dem=DEM[k]||1.8;
 var sc=55;
 if(s.goals&&s.goals.indexOf(g)>-1) sc+=13; else sc-=5;
 if(s.level&&s.level.indexOf(e)>-1) sc+=10; else sc-=7;
 var fw=(g==='muscle')?10:(g==='strength'?7:(g==='cut'?6:4));
 sc+=Math.round(fw*(1-Math.min(1,Math.abs(2-f)/2)));
 var rN=Math.max(0,Math.min(1,(r-40)/50));
 sc-=Math.round((dem-1)*(1-rN)*7);
 if((tier==='low'||tier==='critical')&&dem>=2.4) sc-=8;
 if(s.requiresRecovery&&r<s.requiresRecovery) sc-=10;
 if(s.requiresExp&&s.requiresExp!==e) sc-=10;
 if(k===rec) sc+=18;
 return Math.max(35,Math.min(99,Math.round(sc)));
}
// —— شارة جودة الخطة (Score) على كارت الاختيار ——
function qChip(q){
 if(!q||q.score==null)return '';
 var c=q.score>=82?'#00D4AA':q.score>=62?'#22B8CF':'#FF9266';
 return '<span class="qchip" style="display:inline-flex;align-items:center;gap:4px;background:'+c+'22;color:'+c+';border:1px solid '+c+'55;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:800;margin-top:6px">جودة الخطة '+q.grade+' · '+q.score+'</span>';
}

/* ---------- helper units (وحدات مساعدة) from MODULE_DB ---------- */
function modDose(e){return e.duration||e.protocol||e.sets||'';}
function pickEq(arr){var eq=state.equip;return (arr||[]).filter(function(e){var x=e.equipment||'none';if(x==='gym')return eq==='gym';return true;});}
function mapItems(arr){return (arr||[]).map(function(e){return{name:e.n,dose:modDose(e),desc:e.desc||'',video:e.vid||''};});}
function uniqByName(arr){var seen={},out=[];arr.forEach(function(e){if(e&&!seen[e.n]){seen[e.n]=1;out.push(e);}});return out;}
function buildModules(){
 var M=(typeof MODULE_DB!=='undefined')?MODULE_DB:null;if(!M)return [];
 var goal=state.goal,bmi=+state.bmi||24,inj=state.injuries||[];
 var kneeBad=inj.indexOf('knee')>-1;
 var out=[];
 if(M.mobility){
  var warm=pickEq(M.mobility).filter(function(e){return e.tier==='S';}).slice(0,4);
  if(warm.length<3)warm=pickEq(M.mobility).slice(0,4);
  out.push({key:'warmup',title:'الإحماء',tagline:'تجهيز الجسم قبل التمرين',guide:'قبل كل تمرينة: 5–8 دقايق. الإحماء بيزود مدى حركتك ويرفع كفاءة أدائك ويقلل خطر الإصابة لأقصى درجة',items:mapItems(warm)});
 }
 if(M.cardio){
  var pool=[].concat(M.cardio.s||[],M.cardio.a||[],M.cardio.b||[]);
  pool=pickEq(pool);
  if(kneeBad||bmi>=30){pool=pool.filter(function(e){return e.fatigue!=='high'&&e.category!=='cardio_hiit';});}
  if(goal==='muscle'||goal==='strength'){pool=pool.filter(function(e){return e.fatigue==='low';}).concat(pool);}
  var nCard=(goal==='cut'||goal==='fitness')?4:2;
  var card=uniqByName(pool).slice(0,nCard);
  var cguide=(goal==='cut')?'3 مرات أسبوعيا بعد الحديد أو في يوم منفصل — أساسي لحرق الدهون مع الحفاظ على عضلك':(goal==='fitness')?'2–3 مرات أسبوعيا — بيبني قلب أقوى ولياقة أعلى ونفس أطول':'مرة ل مرتين أسبوعيا خفيف — للحفاظ على صحة القلب من غير ما ياكل من عضلك';
  out.push({key:'cardio',title:'الكارديو',tagline:'لياقة القلب وحرق الدهون',guide:cguide,items:mapItems(card)});
 }
 if(M.core){
  var core=pickEq(M.core).filter(function(e){return e.tier==='S'||e.tier==='A';}).slice(0,4);
  out.push({key:'core',title:'الكور (البطن والجذع)',tagline:'جذع أقوى وثبات أعلى',guide:'2–3 مرات أسبوعيا في آخر التمرينة — اختار تمرين أو اتنين. الكور القوي بيحميك من إصابات الظهر وبيحسن كل رفعاتك الكبيرة',items:mapItems(core)});
 }
 if(M.stretching){
  var stp=pickEq(M.stretching).filter(function(e){return e.tier==='S';}).slice(0,4);
  if(stp.length<3)stp=pickEq(M.stretching).slice(0,4);
  out.push({key:'stretch',title:'الإطالة (بعد التمرين)',tagline:'استشفاء أسرع ومرونة أعلى',guide:'بعد كل تمرينة 5 دقايق — بتقلل الشد العضلي وتسرع الاستشفاء وتحافظ على مرونتك وصحة مفاصلك',items:mapItems(stp)});
 }
 if(M.kegel){
  out.push({key:'kegel',title:'الكيجل (قاع الحوض)',tagline:'تحكم وأداء أفضل',guide:'يوميا في أي وقت — بيقوي عضلات قاع الحوض، ويحسن التحكم والأداء والثبات أثناء الرفعات الكبيرة',items:mapItems(M.kegel.slice(0,2))});
 }
 return out;
}

/* ---------- analysis animation ---------- */
var STEPS=['بنحلل جسمك ومؤشر الكتلة','بنحسب سعراتك وقدرتك على الاستشفاء','بنختار أنسب الأنظمة ليك','بنجهز خطتك النهائية'];
function runAnalysis(){
 show('scAnalysis');
 $('anResult').classList.add('hidden');
 $('thinkBox').style.display='flex';
 var ss=$('thinkSteps');ss.innerHTML=STEPS.map(function(s,i){return '<div class="step" data-i="'+i+'"><span class="b">'+(i+1)+'</span><span>'+esc(s)+'</span></div>';}).join('');
 var arc=$('thinkArc'),C=440,p=0,computed=false;
 var t=setInterval(function(){
  p+=2; if(p>100)p=100;
  arc.setAttribute('stroke-dashoffset',C*(1-p/100));
  $('thinkPct').textContent=p+'%';
  var si=Math.min(STEPS.length-1,Math.floor(p/25));
  Array.prototype.forEach.call(ss.querySelectorAll('.step'),function(el){el.classList.toggle('on',+el.getAttribute('data-i')<=si);});
  if(p>=55&&!computed){computed=true;try{applyToState();runMetrics();PLANS=computePlans();}catch(e){console.error(e);}}
  if(p>=100){clearInterval(t);setTimeout(showAnalysisResult,420);}
 },46);
}
function _goalAr(){return {cut:'تنشيف',muscle:'تضخيم',strength:'قوة',fitness:'لياقة'}[state.goal]||'';}
function _macros(){
 var w=+state.weight||75,tdee=+state.tdee||2000,g=state.goal;
 var cal=g==='cut'?Math.round(tdee-450):g==='muscle'?Math.round(tdee+300):g==='strength'?Math.round(tdee+150):Math.round(tdee);
 var refW=Math.min(w, Math.round(27.5*((+state.height||175)/100)*((+state.height||175)/100)));
 var protein=Math.round(refW*(g==='cut'?2.2:2.0));
 var fat=Math.round(w*0.9);
 var carbs=Math.max(0,Math.round((cal-protein*4-fat*9)/4));
 return{cal:cal,protein:protein,carbs:carbs,fat:fat};
}
function _tierInfo(t){return {high:['ممتازة','جسمك في حالة ممتازة للاستمرار — تقدر تدفع بقوة وتزود الحمل تدريجيا'],mid:['جيدة','حالتك كويسة — التزم بالخطة وراقب نومك وتغذيتك عشان تفضل في تقدم ثابت'],low:['محدودة','قدرتك على الاستمرار محدودة دلوقتي — ركز على النوم وتقليل التوتر وما تبالغش في الحجم'],critical:['حرجة','جسمك محتاج راحة واستشفاء — قلل الحمل وادي بالك لنومك وتغذيتك الأول']}[t]||['جيدة',''];}
function showAnalysisResult(){
 $('thinkBox').style.display='none';
 var r=$('anResult');r.classList.remove('hidden');
 $('anHi').textContent='تحليلك جاهز — دي صورة جسمك الحقيقية';
 var bmi=+((+state.bmi||0).toFixed(1));
 var tdee=Math.round(state.tdee||0);
 var rec=Math.round(state.recoveryScore||0);
 var tol=Math.round(state.trainingTolerance||0);
 var fcap=Math.round(state.fatigueCap||0);
 var vcap=Math.round(state.weeklyVolCap||0);
 var arec=Math.round(state.abilityRecover||0);
 var sus=Math.round(state._sustainScore||state.recoveryScore||0);
 var cards=[{l:'مؤشر الكتلة',v:bmi,dec:1,sub:state.bmiCat||'',pct:Math.min(100,bmi/40*100)},{l:'السعرات اليومية',v:tdee,dec:0,sub:'سعر/يوم',pct:Math.min(100,tdee/3500*100)},{l:'قدرة الاستشفاء',v:rec,dec:0,sub:'من 100',pct:rec},{l:'أيام التدريب',v:state.days,dec:0,sub:'في الأسبوع',pct:state.days/7*100}];
 if(tol>0)cards.push({l:'تحمل التدريب',v:tol,dec:0,sub:'من 100',pct:tol});
 if(fcap>0)cards.push({l:'سقف الإجهاد',v:fcap,dec:0,sub:'من 100',pct:fcap});
 if(vcap>0)cards.push({l:'سقف الحجم الأسبوعي',v:vcap,dec:0,sub:'مجموعة/أسبوع',pct:Math.min(100,vcap/30*100)});
 if(arec>0)cards.push({l:'سرعة الاستعادة',v:arec,dec:0,sub:'من 100',pct:arec});
 var t4=vcap>0?['سقف الحجم',vcap,Math.min(100,vcap/30*100),'purple']:['سرعة الاستعادة',arec,arec,'purple'];var g2c=[['أيام التدريب',state.days,state.days/7*100,'green'],['قدرة الاستشفاء',rec,rec,'blue'],['تحمل التدريب',(tol||fcap),(tol||fcap),'orange'],t4];$('anCards').innerHTML='<div class="an2-hero"><div class="an2-ring"><svg viewBox="0 0 90 90"><circle class="bg" cx="45" cy="45" r="38"></circle><circle class="fg" cx="45" cy="45" r="38" stroke-dasharray="239" stroke-dashoffset="239" data-pct="'+Math.min(100,sus).toFixed(1)+'"></circle></svg><div class="an2-rc"><span class="gv" data-to="'+sus+'" data-dec="0">0</span>%</div></div><div class="an2-htxt"><div class="an2-hval"><span class="gv" data-to="'+tdee+'" data-dec="0">0</span></div><div class="an2-hsub">سعر يومي</div><div class="an2-htag">مؤشر الكتلة '+bmi+' · '+esc(state.bmiCat||'')+'</div></div></div>'+'<div class="an2-grid">'+g2c.map(function(c){return '<div class="an2-gc t-'+c[3]+'"><div class="an2-gtxt"><div class="an2-gv"><span class="gv" data-to="'+c[1]+'" data-dec="0">0</span></div><div class="an2-gl">'+esc(c[0])+'</div></div><div class="an2-gring"><svg viewBox="0 0 90 90"><circle class="bg" cx="45" cy="45" r="38"></circle><circle class="fg" cx="45" cy="45" r="38" stroke-dasharray="239" stroke-dashoffset="239" data-pct="'+Math.min(100,c[2]).toFixed(1)+'"></circle></svg></div></div>';}).join('')+'</div>';
 var tier=state._sustainTier||(sus>=72?'high':sus>=52?'mid':sus>=35?'low':'critical');
 var ti=_tierInfo(tier);
 var readout='<div class="an2-stat t-'+esc(tier)+'"><span class="an2-sb">'+esc(ti[0])+'</span><span class="an2-st">'+esc(ti[1])+'</span></div>';
 var m=_macros();
 function mc(l,v,u){return '<div class="amc"><div class="amv">'+esc(v)+'</div><div class="aml">'+esc(l)+'</div><div class="amu">'+esc(u)+'</div></div>';}
 var macroHtml='<div class="an2-mac"><div class="an2-mt">تغذيتك المقترحة — هدف '+esc(_goalAr())+'</div><div class="an2-mg"><div class="an2-mi mi-green"><div class="an2-miv">'+esc(m.protein)+'</div><div class="an2-min">بروتين</div><div class="an2-miu">جرام</div></div><div class="an2-mi mi-blue"><div class="an2-miv">'+esc(m.cal)+'</div><div class="an2-min">السعرات</div><div class="an2-miu">سعر/يوم</div></div><div class="an2-mi mi-purple"><div class="an2-miv">'+esc(m.carbs)+'</div><div class="an2-min">كارب</div><div class="an2-miu">جرام</div></div><div class="an2-mi mi-orange"><div class="an2-miv">'+esc(m.fat)+'</div><div class="an2-min">دهون</div><div class="an2-miu">جرام</div></div></div></div>';
 var recPlan=PLANS[0];
 var recHtml=recPlan?('<div class="an2-rec"><div class="an2-rl">الخطة المقترحة</div><div class="an2-rv">'+esc(recPlan.name)+'</div><div class="an2-rs">'+esc(recPlan.desc||'نظام متوازن مختار على حسب خبرتك وأيامك وهدفك')+'</div><button class="an2-alt" type="button" onclick="App.showPlans()">مش عاجباك؟ اختار خطة تانية</button></div>'):'';
 var bars=[];
 if(rec)bars.push(['قدرة الاستشفاء',rec]);
 if(tol)bars.push(['تحمل التدريب',tol]);
 if(fcap)bars.push(['سقف الإجهاد',fcap]);
 if(arec)bars.push(['سرعة الاستعادة',arec]);
 bars.push(['الاستمرارية',sus]);
 var BCOL={'قدرة الاستشفاء':'green','تحمل التدريب':'blue','سقف الإجهاد':'orange','سرعة الاستعادة':'purple','الاستمرارية':'yellow'};var barsHtml='<div class="an2-bars"><div class="an2-bt">ملف تدريبك</div>'+bars.map(function(b){return '<div class="an2-br"><span class="an2-bn">'+esc(b[0])+'</span><div class="an2-bt2"><i class="abfill bf-'+(BCOL[b[0]]||'green')+'" data-w="'+Math.min(100,b[1])+'"></i></div><span class="an2-bv">'+b[1]+'</span></div>';}).join('')+'</div>';
 $('anRec').innerHTML=barsHtml+readout+macroHtml+recHtml;
 setTimeout(function(){
  Array.prototype.forEach.call(document.querySelectorAll('#anCards .fg'),function(el){var p=+el.getAttribute('data-pct')||0;el.style.transition='stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)';el.style.strokeDashoffset=(239*(1-p/100)).toFixed(1);});
  Array.prototype.forEach.call(document.querySelectorAll('#anCards .gv'),function(el){var to=+el.getAttribute('data-to')||0,dec=+el.getAttribute('data-dec')||0,cur=0,step=to/40;var t=setInterval(function(){cur+=step;if(cur>=to){cur=to;clearInterval(t);}el.textContent=dec?cur.toFixed(1):Math.round(cur);},16);});
  Array.prototype.forEach.call(document.querySelectorAll('.abfill'),function(el){el.style.width=(+el.getAttribute('data-w'))+'%';});
 },60);
}

/* ---------- plans ---------- */
function showPlans(){
 // المبتدئ ما يختارش بين جداول — نحدد له الأنسب والأسهل ونوديه على طول
 if(state.exp==='beginner' && PLANS && PLANS.length){
  var _bi=0; for(var _j=0;_j<PLANS.length;_j++){ if(PLANS[_j].rec){_bi=_j;break;} }
  choose(_bi); return;
 }
 show('scPlans');
  var EF_MOB=window.matchMedia('(max-width:600px)').matches;
 $('plansSub').textContent= PLANS.length>1?('جهزنالك '+PLANS.length+' خطط مناسبة — والمرشح ليك في الأول'):'دي الخطة الأنسب ليك دلوقتي';
 var g=$('planGrid');g.innerHTML='';
 var PLAN_ICON_IMG={fullbody:'kettlebell',upper_lower:'dumbbell',ppl_3:'plates',ppl:'barbell',brosplit:'bicep',
  arnold:'arnold',stronglifts:'squat',hybrid:'hybrid',anterior_posterior:'anatomy',ppl_weak:'target',ppul:'cross',ululf:'flask',ul6:'flame',torso_limbs:'anatomy'};
 PLANS.forEach(function(p,i){
  var totEx=p.trainDays.reduce(function(a,d){return a+(d.exercises||[]).length;},0);
  var dl=p.trainDays.map(function(d,di){
   var nm=String(d.name||('يوم '+(di+1)));
   var sp=nm.split(/\s*[—–-]\s*/);
   var ttl=sp[0].trim()||('يوم '+(di+1));var det=sp.slice(1).join(' - ').trim();
   var tags=det?'<div class="dtags">'+det.split(/\s*\+\s*/).map(function(x){return x.trim()?'<span>'+esc(x.trim())+'</span>':'';}).join('')+'</div>':'';
   return '<div class="dl"><div class="dl-head"><span class="dn">'+(di+1)+'</span><span class="dtitle">'+esc(ttl)+'</span></div>'+tags+'</div>';
  }).join('');
  var card=document.createElement('div');
  if(EF_MOB){
   card.className='plan-card'+(p.rec?' featured':'');
   var sess=p.trainDays.map(function(d,di){var nm=String(d.name||('يوم '+(di+1))).split(/\s*[—–-]\s*/)[0].trim()||('يوم '+(di+1));var sc=(di%3===1)?' s2':(di%3===2)?' s3':'';return '<div class="sess-row"><span class="sess-name">'+esc(nm)+'</span><span class="sess-num'+sc+'">'+(di+1)+'</span></div>';}).join('');
   card.innerHTML='<div class="plan-top"><div><div class="plan-name">'+esc(p.name)+'</div><div class="plan-days">'+p.trainDays.length+' أيام في الأسبوع</div>'+qChip(p.quality)+'</div>'+(p.rec?'<span class="rec-badge">المرشح ليك</span>':'')+'</div>'+
    '<div class="stats-row"><div class="stat"><div class="sv">'+p.trainDays.length+'</div><div class="sl">أيام</div></div><div class="stat"><div class="sv">'+totEx+'</div><div class="sl">تمرين</div></div><div class="stat"><div class="sv">6</div><div class="sl">أسابيع</div></div><div class="stat"><div class="sv">'+(p.score||'-')+'</div><div class="sl">توافق</div></div></div>'+
    '<div class="sessions">'+sess+'</div>'+
    '<button class="plan-btn'+(p.rec?'':' outline')+'">'+(p.rec?'ابدأ بالخطة دي':'اختار الخطة دي')+'</button>';
  }else{
   card.className='plan'+(p.rec?' rec':'');
   var iconFile=PLAN_ICON_IMG[p.key]||'dumbbell';
   card.innerHTML=(p.rec?'<div class="ribbon">المرشح ليك</div>':'')+
    '<div class="plan-head"><img class="plan-icon" src="assets/splits/'+iconFile+'.svg?v=1" alt="" loading="lazy"><div class="plan-head-txt"><h3>'+esc(p.name)+'</h3><div class="freq">'+p.trainDays.length+' أيام في الأسبوع</div>'+qChip(p.quality)+'</div></div>'+
    '<div class="meta"><div class="m"><b>'+p.trainDays.length+'</b><span>أيام</span></div><div class="m"><b>'+totEx+'</b><span>تمرين</span></div><div class="m"><b>6</b><span>أسابيع</span></div><div class="m"><b>'+(p.score||'-')+'</b><span>توافق</span></div></div>'+
    '<div class="daylist">'+dl+'</div>'+
    '<button class="btn '+(p.rec?'btn-primary':'btn-ghost')+' btn-lg" style="width:100%">'+(p.rec?'ابدأ بالخطة دي':'اختار الخطة دي')+'</button>';
  }
  card.querySelector('button').onclick=function(){choose(i);};
  g.appendChild(card);
 });
}

/* ---------- choose -> persist -> dashboard ---------- */
/* map planner group -> smart-coach muscle key, so the engine's MEV/MRV/volume
   actually match (Arabic `muscle` is kept for display; `cm` is the coach key) */
function coachMuscle(e){
 var g=(e&&e.grp)||'';var sub=(e&&e.sub)||'';
 if(g==='hamstrings'&&sub==='glutes')return 'glutes';
 var map={chest:'chest',back:'back',shoulders:'shoulders',biceps:'arms',triceps:'arms',quads:'quads',hamstrings:'hamstrings',glutes:'glutes',calves:'calves',core:'core',forearms:'forearms',traps:'back',adductors:'quads'};
 if(map[g])return map[g];
 var mu=(e&&(e.mu||e.muscle))||'';
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
function normalize(p){
 var days=p.trainDays.map(function(d,i){return{key:'d'+(i+1),label:'اليوم '+(i+1),name:d.name||('يوم '+(i+1)),muscles:d.muscles||[],exercises:(d.exercises||[]).map(function(e){return{name:exName(e),muscle:exMuscle(e),cm:coachMuscle(e),sets:exSets(e),reps:exReps(e),rest:canonicalRestLabel(e.rest,state.goal,e.exType),restSec:restToSeconds(e.rest,state.goal,e.exType),video:exVid(e),rir:e.rir||'',progRir:e.progressiveRIR||'',tempo:e.tempo||'',progression:e.progression||''};})};});
 var goalLabel={cut:'تنشيف',muscle:'تضخيم',strength:'قوة',fitness:'لياقة'}[state.goal]||state.goal;
 var expLabel={beginner:'مبتدئ',intermediate:'متوسط',advanced:'متقدم'}[state.exp]||state.exp;
 var profile={name:ans.name||'بطل',age:state.age,weight:state.weight,height:state.height,gender:state.gender,exp:state.exp,exp_label:expLabel,goal:state.goal,goal_label:goalLabel,tdee:Math.round(state.tdee||0),bmi:+(+state.bmi||0).toFixed(1),bmiCat:state.bmiCat,recovery:Math.round(state.recoveryScore||0)};
 var catalog=buildModuleCatalog();
 var active=Array.isArray(ans.modules)?ans.modules.slice():defaultActiveModules();
 return{title:p.name,goal:state.goal,goal_label:goalLabel,split_key:p.key,split_name:p.name,freq:days.length,days_per_week:state.days,meso_weeks:6,created:Date.now(),profile:profile,days:days,weak:state.weak||[],modules:catalog,activeModules:active,quality:p.quality||null};
}
function choose(i){
 var p=PLANS[i];if(!p)return;
 try{if(window.EFProfile)EFProfile.captureFromWorkout(ans);}catch(e){}
 // ── شبكة الإصلاح الذاتي النهائية: تضمن وصول خطة نظيفة للمتابعة (دون إيقاف المستخدم) ──
 try{
  if(typeof PlanValidator!=='undefined' && PlanValidator.repairPlan && Array.isArray(p.trainDays)){
   PlanValidator.repairPlan(p.trainDays,{minEx:state.exp==='advanced'?6:(state.exp==='beginner'?4:5)});
  }
 }catch(_e){/* الإصلاح لا يوقف الانتقال أبدا */}
 var data=normalize(p);
 try{
  localStorage.setItem('forma_plan',JSON.stringify(data));
  localStorage.setItem('forma_profile',JSON.stringify(data.profile));
  localStorage.removeItem('forma_logs');
  localStorage.removeItem('forma_done');
 }catch(e){console.error(e);}
 location.href='dashboard.html';
}

function acceptRec(){choose(0);}
window.App={start:start,next:next,back:back,showPlans:showPlans,choose:choose,acceptRec:acceptRec};
})();

/* ---------- auto-enter the engine directly (no landing) ---------- */
function __boot(){try{window.App.start();}catch(e){console.error('boot',e);}}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',__boot);}else{__boot();}
