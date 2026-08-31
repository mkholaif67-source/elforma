/* صمم دايت — متحكم تفاعلي: معالج تعريفي + تحليل + اختيار النظام + بناء الوجبات (اختار أكلي).
   يعتمد على محرك التغذية العام: DE، NutritionEngine، buildSmartMealPlan، calcMacros،
   searchFoods، isFoodAllowed، FOOD_DB، FOOD_MAP، DI_STATIC_DATA. */
(function(){
'use strict';
var $=function(id){return document.getElementById(id);};
var ans={};
var idx=0;
var PLANS=[];
var METRICS=null;
var CHOSEN=null;
var SLOTS=[];
var slotIdx=0;
var MEAL_SEL={};
var QSEARCH={};
var WO_TIME='mid';
var COFFEE_SEEDED=false;
var EF_SKIP={};   // أسئلة مشتركة تم ملؤها من البروفايل الموحد (تتخطى)

function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function setInp(id,v){var el=$(id);if(el)el.value=(v==null?'':v);}
function clampN(n,a,b){return Math.max(a,Math.min(b,n));}
function catEmoji(c){return{protein:'',carb:'',fat:'',veggie:'',fruit:'',dairy:'',snack:''}[c]||'';}

/* ---------- الأسئلة ---------- */
var Q=[
 {id:'gender',type:'choice',q:'يلا نبدأ — إنت..',h:'محتاجين دي عشان نظبط معادلات السعرات صح من أول خطوة',o:[{v:'ذكر'},{v:'أنثى'}]},
 {id:'age',type:'number',q:'عندك كام سنة؟',h:'السن بيأثر على معدل الحرق واحتياجك من السعرات',min:14,max:80,def:25,step:1,unit:'سنة'},
 {id:'height',type:'number',q:'طولك كام؟',h:'بنحسب بيه مؤشر الكتلة واحتياجك اليومي',min:140,max:215,def:170,step:1,unit:'سم'},
 {id:'weight',type:'number',q:'وزنك الحالي كام؟',h:'نقطة البداية — وهنتابع تطورها مع بعض',min:40,max:200,def:80,step:1,unit:'كجم'},
 {id:'goal',type:'choice',q:'إيه هدفك من النظام؟',h:'هدفك هو اللي هيحدد سعراتك وشكل خطتك بالكامل',o:[{v:'تخسيس',d:'حرق الدهون ونزول الوزن'},{v:'تثبيت',d:'الحفاظ على وزنك وصحتك'},{v:'زيادة عضلية',d:'بناء عضل نظيف بأقل دهون'},{v:'ضخامة',d:'زيادة وزن وكتلة أسرع'}]},
 {id:'target',type:'number',q:'الوزن اللي نفسك توصله؟',h:'هدفك في الوزن — وهنرسم الطريق ليه بأمان',min:40,max:200,def:75,step:1,unit:'كجم',skip:function(){return ans.goal==='تثبيت';}},
 {id:'rate',type:'chips',q:'عايز تغير وزنك بمعدل كام في الأسبوع؟',h:'المعدل المتزن أأمن وأثبت — والجسم بيحافظ على عضلك',o:[{v:'0.25'},{v:'0.5'},{v:'0.75'},{v:'1.0'}],suf:'كجم/أسبوع',skip:function(){return ans.goal==='تثبيت';}},
 {id:'activity',type:'choice',q:'نشاطك اليومي عامل إزاي؟',h:'حركتك اليومية بتحدد جزء كبير من سعراتك',o:[{v:'خامل',d:'جلوس معظم اليوم'},{v:'خفيف',d:'حركة بسيطة'},{v:'متوسط',d:'نشاط معتدل أو تمرين خفيف'},{v:'نشيط',d:'تمرين منتظم'},{v:'شديد',d:'مجهود بدني عالي يوميا'}]},
 {id:'meals',type:'chips',q:'تحب تاكل كام وجبة في اليوم؟',h:'هنوزع سعراتك على الوجبات اللي تناسب يومك',o:[{v:'2'},{v:'3'},{v:'4'},{v:'5'}],suf:'وجبات'},
 {id:'workout',type:'choice',q:'بتتمرن فين؟',h:'بنظبط توقيت ونوع وجباتك على نمط تمرينك',o:[{v:'جيم',d:'تمارين حديد ومقاومة'},{v:'البيت',d:'وزن الجسم ودمبل'},{v:'مش بتمرن',d:'تغذية بس حاليا'}]},
 {id:'wotime',type:'choice',q:'بتتمرن إمتا غالبا؟',h:'بنرتب وجباتك حوالين تمرينك — قبل وبعد التمرين في مكانهم الصح',o:[{v:'صباحي',d:'من بدري للضهر'},{v:'ظهري',d:'الضهر للعصر'},{v:'مسائي',d:'بالليل'}],skip:function(){return ans.workout!=='جيم';}},
 {id:'gymsnack',type:'choice',q:'تحب نضيف سناك لخطتك؟',h:'تقدر تخليها ٣ وجبات رئيسية + سناك، أو تسيب تقسيمة قبل/بعد التمرين زي ما هي',o:[{v:'نعم'},{v:'لا'}],skip:function(){return !(ans.workout==='جيم'&&(+ans.meals)===4);}},
 {id:'health',type:'gate',q:'في حالات صحية لازم ناخد بالنا منها؟',h:'هنفصل خطتك وأطعمتك بأمان حسب حالتك',gq:'عندك حالة صحية مؤثرة؟',yes:'يوجد',no:'لا يوجد',max:4,pick:'اختار حالتك (لحد 4)',o:[{v:'سكري',k:'diabetes'},{v:'مقاومة إنسولين',k:'insulin'},{v:'ضغط مرتفع',k:'bp'},{v:'كوليسترول',k:'cholesterol'},{v:'خمول غدة',k:'hypothyroid'},{v:'نشاط غدة',k:'hyperthyroid'},{v:'قولون',k:'ibs'},{v:'حساسية جلوتين',k:'gluten'},{v:'حساسية لاكتوز',k:'lactose'},{v:'كلى',k:'kidney'},{v:'نقرس',k:'gout'},{v:'تكيس مبايض',k:'pcos'},{v:'حموضة',k:'gerd'},{v:'كبد دهني',k:'fatty-liver'},{v:'حمل',k:'pregnant'},{v:'رضاعة طبيعية',k:'breastfeeding'}]},
 {id:'problems',type:'gate',optional:true,q:'في تحديات بتواجهك في الأكل؟',h:'هنحط حلول عملية ليها جوه خطتك',gq:'عايز نعالج تحديات معينة؟',yes:'أيوه',no:'لأ، تمام',max:4,pick:'اختار التحديات (لحد 4)',o:[{v:'جوع متكرر',k:'hunger'},{v:'اشتهاء حلويات',k:'sweets'},{v:'شبع صعب',k:'satiety'},{v:'أكل عاطفي',k:'emotional'},{v:'وقت ضيق',k:'time'},{v:'أكل بره كتير',k:'outside'},{v:'طاقة منخفضة',k:'energy'},{v:'ملل من الأكل',k:'boredom'},{v:'جوع بالليل',k:'night-hunger'}]}
];
var Qmap={};Q.forEach(function(q){Qmap[q.id]=q;});

var PRAISE=[
 'تمام، إجابتك دي بتساعدنا نظبط خطتك أكتر',
 'حلو — كل معلومة بتقربنا من النظام المثالي ليك',
 'كده إحنا ماشيين صح، كمل معايا',
 'ممتاز، البيانات دي سر إن خطتك تطلع مخصصة ليك إنت بالذات',
 'جميل — فاضل خطوات بسيطة ونخلص',
 'تمام كده، إجابتك واضحة وهتفرق في النتيجة',
 'عاش، كل سؤال بنجاوبه بيخلي خطتك أدق',
 'كده بنبني صورة كاملة عن جسمك واحتياجك',
 'قربنا نخلص — كمل وإنت مطمن إن كل ده مفصل ليك'
];

var SVG_MALE='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="23" r="11"/><path d="M22 18c3-7 17-7 20 0"/><path d="M13 55c0-12 8-17 19-17s19 5 19 17"/></svg>';
var SVG_FEMALE='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="24" r="10"/><path d="M21 27c-4-18 24-18 22 0"/><path d="M20 26c-3 8-2 14-1 18M44 26c3 8 2 14 1 18"/><path d="M15 56c0-11 8-16 17-16s17 5 17 16"/></svg>';
var I={};
I['gender:ذكر']=SVG_MALE; I['gender:أنثى']=SVG_FEMALE;
I['workout:جيم']='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>';
I['workout:البيت']='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/></svg>';
I['workout:مش بتمرن']='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>';
function iconFor(qid,val){return I[qid+':'+val]||'';}

/* أيقونات لكل سؤال + نظام المراحل */
function arNum(n){return String(n).replace(/[0-9]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'[+d];});}
var SVG_=function(p){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';};
I['goal:تخسيس']=SVG_('<circle cx="12" cy="7" r="4"/><path d="M3 21c0-5 4-9 9-9s9 4 9 9"/>'); 
I['goal:تثبيت']=SVG_('<circle cx="12" cy="12" r="7"/><path d="M9 12h6"/><path d="M12 9v6"/>'); 
I['goal:زيادة عضلية']=SVG_('<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>'); 
I['goal:ضخامة']=SVG_('<path d="M3 9v6M7 7v10M21 9v6M7 12h10"/><circle cx="12" cy="12" r="2" fill="currentColor"/>'); 
I['activity:خامل']=SVG_('<rect x="3" y="11" width="18" height="7" rx="2"/><path d="M7 11V8a5 5 0 0 1 10 0v3"/>'); 
I['activity:خفيف']=SVG_('<circle cx="12" cy="5" r="2"/><path d="M8 20l4-7 4 7"/><path d="M9 14h6"/>'); 
I['activity:متوسط']=SVG_('<path d="M5 20l3-5 3 3 4-7 4 4"/><path d="M2 20h20"/>'); 
I['activity:نشيط']=SVG_('<circle cx="13" cy="4" r="2"/><path d="M7 20l3-5 2 2 4-7 3 3"/>'); 
I['activity:شديد']=SVG_('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>'); 
I['wotime:صباحي']=SVG_('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>');
I['wotime:ظهري']=SVG_('<circle cx="12" cy="13" r="3.6"/><path d="M12 5v1.6M4.8 13H3.2M20.8 13h-1.6M6.4 7.7l1.1 1.1M17.6 7.7l-1.1 1.1M3 19.5h18"/>');
I['wotime:مسائي']=SVG_('<path d="M20 14.5A8 8 0 1 1 9.5 4 6.2 6.2 0 0 0 20 14.5z"/><circle cx="17" cy="6" r="1" fill="currentColor"/>');
var IC_COLOR={};
function colorFor(qid,val){return IC_COLOR[qid+':'+val]||['#00D4AA','rgba(0,212,170,.13)'];}
IC_COLOR['goal:تخسيس']=['#FF6B35','rgba(255,107,53,.13)'];
IC_COLOR['goal:تثبيت']=['#22B8CF','rgba(34,184,207,.13)'];
IC_COLOR['goal:زيادة عضلية']=['#00D4AA','rgba(0,212,170,.13)'];
IC_COLOR['goal:ضخامة']=['#5B8BDB','rgba(91,139,219,.13)'];
IC_COLOR['activity:خامل']=['#7AACAA','rgba(122,172,170,.13)'];
IC_COLOR['activity:خفيف']=['#00D4AA','rgba(0,212,170,.13)'];
IC_COLOR['activity:متوسط']=['#22B8CF','rgba(34,184,207,.13)'];
IC_COLOR['activity:نشيط']=['#FF6B35','rgba(255,107,53,.13)'];
IC_COLOR['activity:شديد']=['#5B8BDB','rgba(91,139,219,.13)'];
IC_COLOR['workout:جيم']=['#22B8CF','rgba(34,184,207,.13)'];
IC_COLOR['workout:البيت']=['#FF6B35','rgba(255,107,53,.13)'];
IC_COLOR['gender:ذكر']=['#22B8CF','rgba(34,184,207,.13)'];
IC_COLOR['gender:أنثى']=['#FF6B35','rgba(255,107,53,.13)'];

IC_COLOR['workout:مش بتمرن']=['#7AACAA','rgba(122,172,170,.13)'];
IC_COLOR['wotime:صباحي']=['#FF9266','rgba(255,146,102,.13)'];
IC_COLOR['wotime:ظهري']=['#22B8CF','rgba(34,184,207,.13)'];
IC_COLOR['wotime:مسائي']=['#5B8BDB','rgba(91,139,219,.13)'];
var QIC={
 gender:SVG_('<circle cx="9" cy="8" r="3"/><path d="M4 20c0-3 2-5 5-5s5 2 5 5"/><circle cx="17" cy="9" r="2.3"/><path d="M15 20c0-2.4 1.4-4 3.5-4S22 17.6 22 20"/>'),
 age:SVG_('<path d="M12 4V6"/><circle cx="12" cy="2.6" r="1"/><path d="M6 12a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7H6z"/><path d="M4 19h16"/><path d="M6 14h12"/>'),
 height:SVG_('<rect x="9" y="2.5" width="6" height="19" rx="1.4"/><path d="M9 6.5h2.4M9 10h3M9 13.5h2.4M9 17h3"/>'),
 weight:SVG_('<path d="M4 20a8 8 0 0 1 16 0z"/><path d="M12 20l3.5-9"/><circle cx="12" cy="20" r="1.3" fill="currentColor"/>'),
 goal:SVG_('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>'),
 target:SVG_('<path d="M6 21V3"/><path d="M6 4h11l-2.4 3.5L17 11H6"/>'),
 rate:SVG_('<path d="M3.5 16a8.5 8.5 0 0 1 17 0"/><path d="M12 16l5-3.5"/><circle cx="12" cy="16" r="1.4" fill="currentColor"/>'),
 activity:SVG_('<circle cx="15.5" cy="5" r="2"/><path d="M13.5 8.5l-3.2 2.6 2.2 2.4.9 5"/><path d="M10.3 11.1L6.5 12"/><path d="M12.5 13.5l3.8 1 1.9 4"/>'),
 meals:SVG_('<path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 3c-1.6 0-2.6 2.2-2.6 5.2S16 13 17 13v8"/>'),
 workout:SVG_('<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>'),
 wotime:SVG_('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'),
 health:SVG_('<path d="M12 20S4 15.5 4 9.8A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 8 2.8C20 15.5 12 20 12 20z"/><path d="M7.5 11.5h2.2l1.3-2 1.5 4 1-2h3"/>'),
 problems:SVG_('<path d="M9.5 18h5"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.8 10.6c.7.6 1.1 1.4 1.2 2.4h5.2c.1-1 .5-1.8 1.2-2.4A6 6 0 0 0 12 3z"/>')
};
var PHASES=[
 {name:'\u0646\u062a\u0639\u0631\u0651\u0641 \u0639\u0644\u064a\u0643',sub:'\u0646\u0641\u0647\u0645 \u062c\u0633\u0645\u0643',ic:SVG_('<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-4 3.2-6 7-6s7 2 7 6"/>'),ids:['gender','age','height','weight']},
 {name:'\u0647\u062f\u0641\u0643 \u0648\u0648\u062c\u0647\u062a\u0643',sub:'\u0646\u0631\u0633\u0645 \u0637\u0631\u064a\u0642\u0643',ic:SVG_('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.6"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>'),ids:['goal','target','rate']},
 {name:'\u0623\u0633\u0644\u0648\u0628 \u062d\u064a\u0627\u062a\u0643',sub:'\u0646\u0638\u0628\u0637 \u0639\u0644\u0649 \u064a\u0648\u0645\u0643',ic:SVG_('<path d="M3 12h3.5l2-5 3.2 9 2.2-6 1.6 2H21"/>'),ids:['activity','meals','workout','wotime','gymsnack']},
 {name:'\u0635\u062d\u062a\u0643 \u0648\u0623\u0645\u0627\u0646\u0643',sub:'\u0646\u0623\u0645\u0651\u0646 \u062e\u0637\u062a\u0643',ic:SVG_('<path d="M12 3l7 2.6v5.2c0 4.8-3 7.8-7 9.2-4-1.4-7-4.4-7-9.2V5.6z"/><path d="M9 12l2 2 4-4"/>'),ids:['health','problems']}
];
var DONE_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
function phaseIndexFor(qid){for(var i=0;i<PHASES.length;i++){if(PHASES[i].ids.indexOf(qid)>-1)return i;}return 0;}
function renderTopNav(qid){
 var pi=phaseIndexFor(qid);
 var steps=$('wizSteps');
 if(steps){
  var h='';
  PHASES.forEach(function(p,i){
   var cls=i<pi?'done':(i===pi?'on':'idle');
   h+='<div class="wstep '+cls+'"><span class="ws-ic">'+(cls==='done'?DONE_IC:p.ic)+'</span><span class="ws-lbl">'+esc(p.name)+'</span></div>';
   if(i<PHASES.length-1)h+='<span class="ws-line'+(i<pi?' done':'')+'"></span>';
  });
  steps.innerHTML=h;
 }
 var k=$('qKicker');
 if(k)k.innerHTML='<span class="qk-no">\u0627\u0644\u0645\u0631\u062d\u0644\u0629 '+arNum(pi+1)+' \u0645\u0646 '+arNum(PHASES.length)+'</span><span class="qk-dot">\u2022</span><span class="qk-name">'+esc(PHASES[pi].sub)+'</span>';
 var ic=$('qIcon');
 if(ic){var s=QIC[qid]||'';ic.innerHTML=s;ic.style.display=s?'flex':'none';}
}

function show(id){['scWizard','scAnalysis','scPlans','scBuild'].forEach(function(s){var el=$(s);if(el)el.classList.toggle('active',s===id);});window.scrollTo(0,0);}
function start(){
 try{if(window.EFProfile){EF_SKIP={};(EFProfile.applyToDiet(ans)||[]).forEach(function(id){EF_SKIP[id]=true;});}}catch(e){}
 idx=0;while(idx<Q.length-1&&skipped(idx))idx++;
 show('scWizard');render();
}

function skipped(j){if(Q[j]&&EF_SKIP[Q[j].id])return true;return !!(Q[j]&&Q[j].skip&&Q[j].skip());}
function isLast(){for(var j=idx+1;j<Q.length;j++){if(!skipped(j))return false;}return true;}

function rateOptsFor(goal){
 if(goal==='ضخامة') return [{v:'0.25'},{v:'0.5'},{v:'0.75'}];
 if(goal==='زيادة عضلية') return [{v:'0.25'},{v:'0.5'}];
 return [{v:'0.25'},{v:'0.5'},{v:'0.75'},{v:'1.0'}];
}
function render(){
 var qq=Q[idx];
 if(qq.id==='rate'){
  qq.o=rateOptsFor(ans.goal);
  if(ans.rate&&!qq.o.some(function(o){return o.v===ans.rate;}))ans.rate=null;
  qq.h=(ans.goal==='ضخامة'||ans.goal==='زيادة عضلية')?'الزيادة النظيفة بطيئة بطبيعتها — المعدل الأقل بيدي عضل أنضف ودهون أقل':'المعدل المتزن أأمن وأثبت — والجسم بيحافظ على عضلك';
 }
 var pct=Math.round(idx/Q.length*100);
 $('progBar').style.width=pct+'%';$('progTxt').textContent=pct+'%';
 renderTopNav(qq.id);
 $('qText').textContent=qq.q;
 $('encourage').textContent= idx>0 ? PRAISE[(idx-1)%PRAISE.length] : '';
 var c=$('qContent');c.innerHTML='';

 if(qq.type==='choice'){
  var av=qq.id==='gender';
  var cols=qq.o.length>=4?2:qq.o.length;
  var _five=(qq.o.length===5&&!av);var h='<div class="opts '+(_five?'opts5':'cols'+(cols===3?3:2)+(av?' avrow':''))+'">';
  qq.o.forEach(function(o){var sel=ans[qq.id]===o.v?' sel':'';var ic=iconFor(qq.id,o.v);var _cl=colorFor(qq.id,o.v);var _sx=ic?' style="--ac:'+_cl[0]+';--acs:'+_cl[1]+'"':'';h+='<button class="opt'+(ic?(av?' av':' withic'):'')+sel+'"'+_sx+' data-v="'+esc(o.v)+'">'+(ic?'<span class="oic">'+ic+'</span>':'')+'<span class="olbl">'+esc(o.v)+'</span>'+(o.d?'<span class="odesc">'+esc(o.d)+'</span>':'')+'</button>';});
  h+='</div>';c.innerHTML=h;
  Array.prototype.forEach.call(c.querySelectorAll('.opt'),function(b){b.onclick=function(){ans[qq.id]=b.getAttribute('data-v');render();setTimeout(next,240);};});

 }else if(qq.type==='chips'){
  var h2='<div class="chips center">';
  qq.o.forEach(function(o){var sel=ans[qq.id]===o.v?' sel':'';h2+='<button class="chip'+sel+'" data-v="'+esc(o.v)+'">'+esc(o.v)+(qq.suf?'<span class="unit"> '+esc((qq.suf||'').trim())+'</span>':'')+'</button>';});
  h2+='</div>';c.innerHTML=h2;
  Array.prototype.forEach.call(c.querySelectorAll('.chip'),function(b){b.onclick=function(){ans[qq.id]=b.getAttribute('data-v');render();setTimeout(next,240);};});

 }else if(qq.type==='number'){
  if(ans[qq.id]==null)ans[qq.id]=qq.def;
  var v=+ans[qq.id];
  c.innerHTML='<div class="field"><div class="inputrow"><button class="stepbtn" data-d="-1">−</button><input id="numIn" type="number" value="'+v+'" min="'+qq.min+'" max="'+qq.max+'"><span class="unit">'+esc(qq.unit||'')+'</span><button class="stepbtn" data-d="1">+</button></div><div class="range-wrap"><input id="rng" type="range" min="'+qq.min+'" max="'+qq.max+'" step="'+(qq.step||1)+'" value="'+v+'"></div></div>';
  var inp=$('numIn'),rng=$('rng');
  function setv(nv){nv=clampN(nv||qq.min,qq.min,qq.max);ans[qq.id]=nv;inp.value=nv;rng.value=nv;}
  inp.oninput=function(){ans[qq.id]=+inp.value;rng.value=inp.value;};
  inp.addEventListener('focus',function(){this._stored=this.value;this.value='';});
  inp.onblur=function(){if(this.value===''||isNaN(+this.value))this.value=this._stored||qq.def;setv(+this.value);};
  rng.oninput=function(){setv(+rng.value)};
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
 }
 $('backBtn').style.visibility= idx===0?'hidden':'visible';
 updateNext();
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
 if(qq.type==='gate'){if(!a||a.has==null)return false;if(a.has==='no')return true;return qq.optional?true:((a.list||[]).length>0);}
 if(qq.type==='number')return a!=null;
 return a!=null&&a!=='';}
function updateNext(){var b=$('nextBtn');b.disabled=!valid();b.textContent= isLast()?'حلل وجهز خطتي':'يلا نكمل';}

function next(){if(!valid())return;if(isLast()){runAnalysis();return;}var j=idx+1;while(j<Q.length&&skipped(j))j++;if(j>=Q.length){runAnalysis();return;}idx=j;render();}
function back(){var j=idx-1;while(j>=0&&skipped(j))j--;if(j>=0){idx=j;render();}}

function gateKeys(qid){
 var qq=Qmap[qid];if(!qq)return [];
 var st=ans[qid];if(!st||st.has!=='yes')return [];
 var byV={};(qq.o||[]).forEach(function(o){byV[o.v]=o.k;});
 return (st.list||[]).map(function(v){return byV[v];}).filter(Boolean);
}
function deriveTrainDays(activity,workoutType){
 // مشتقة من مستوى النشاط (قرار خبير التغذية): لو مش بيتمرن = 0؛ غير كدة حسب شدة النشاط
 if(workoutType==='none')return 0;
 if(activity>=1.9)return 5;   // شديد
 if(activity>=1.725)return 4; // نشيط
 if(activity>=1.55)return 3;  // متوسط
 return 2;                    // خفيف/خامل لكن بيتمرن
}
function computeCurrentWeek(){
 // نوحد رقم الأسبوع مع الداشبورد (calWeek): من تاريخ إنشاء الخطة لو موجودة
 try{
  var floorRaw=localStorage.getItem('diet_week');
  var floorWk=floorRaw?parseInt(JSON.parse(floorRaw),10):0; if(!(floorWk>0))floorWk=0;
  var wRaw=localStorage.getItem('diet_weights');
  var wl=wRaw?JSON.parse(wRaw):[]; if(!Array.isArray(wl))wl=[];
  wl=wl.filter(function(e){return e&&e.date&&isFinite(e.weight);}).sort(function(a,b){return a.date<b.date?-1:1;});
  var pl=JSON.parse(localStorage.getItem('diet_plan')||'null');
  var wk;
  if(wl.length>=2){                                       // بيانات المستخدم تقود
   var span=Math.round((new Date(wl[wl.length-1].date)-new Date(wl[0].date))/86400000);
   var dataWeek=Math.floor(span/7)+1;
   var idle=Math.round((Date.now()-new Date(wl[wl.length-1].date))/86400000);
   if(idle>10)dataWeek+=Math.floor(idle/7);               // توقف التسجيل - المؤقت يكمل من مكانه
   wk=dataWeek;
  } else if(pl&&pl.created){                              // تقديم زمني تلقائي (fallback)
   var days=Math.round((Date.now()-new Date(pl.created))/86400000); wk=Math.floor(days/7)+1;
  } else { wk=1; }
  return Math.max(1,Math.min(99,Math.max(wk,floorWk)));   // بدون تصفير أو تراجع
 }catch(e){}
 return 1;
}
function applyToState(){
 if(typeof DE==='undefined')return;
 DE.gender = ans.gender==='أنثى'?'أنثى':'ذكر';
 DE.age = +ans.age||25;
 DE.height = +ans.height||170;
 DE.weight = +ans.weight||80;
 var goalMap={'تخسيس':['cut','lean'],'تثبيت':['maintain','lean'],'زيادة عضلية':['bulk','lean'],'ضخامة':['bulk','mass']};
 var gm=goalMap[ans.goal]||['maintain','lean'];
 DE.goal=gm[0];DE.gainStyle=gm[1];
 DE.target = ans.goal==='تثبيت' ? (+ans.weight||80) : (+ans.target||(+ans.weight||80));
 var actMap={'خامل':1.2,'خفيف':1.375,'متوسط':1.55,'نشيط':1.725,'شديد':1.9};
 DE.activity = actMap[ans.activity]||1.375;
 DE.mealCount = +ans.meals||3;
 var woMap={'جيم':'gym','البيت':'home','مش بتمرن':'none'};
 DE.workoutType = woMap[ans.workout]||'none';
 DE.workoutTime = ({'صباحي':'morning','ظهري':'mid','مسائي':'evening'})[ans.wotime]||null;
 DE.healthConditions = gateKeys('health');
 DE.dietProblems = gateKeys('problems');
 DE.currentWeek = computeCurrentWeek();
 DE.expectedWeeklyLoss = ans.goal==='تثبيت'?0:(parseFloat(ans.rate)||0.5);
 if(!Array.isArray(DE.availableFoods))DE.availableFoods=[];
 setInp('inp-gender',DE.gender);setInp('inp-age',DE.age);setInp('inp-height',DE.height);
 setInp('inp-weight',DE.weight);setInp('inp-target',DE.target);setInp('inp-activity',DE.activity);
 setInp('inp-goal',DE.goal);setInp('inp-gain-style',DE.gainStyle);
 setInp('inp-weekly-rate',DE.expectedWeeklyLoss||0.5);setInp('inp-mealcount',DE.mealCount);
 var _td=deriveTrainDays(DE.activity,DE.workoutType);DE.trainDays=_td;
 setInp('inp-sleep',7);setInp('inp-train-days', _td);
}
function runMetrics(){
 var r=null;
 try{DE.selectedDiet='balanced';r=window.NutritionEngine.calculate({selectedDiet:'balanced'});}catch(e){console.error(e);}
 if(!r)r={bmr:0,tdee:0,targetCals:0,macros:{}};
 var bmi=DE.weight/Math.pow((DE.height||170)/100,2);
 METRICS={bmr:Math.round(r.bmr||0),tdee:Math.round(r.tdee||0),target:Math.round(r.targetCals||0),macros:r.macros||{},bmi:bmi};
 return METRICS;
}

/* ---------- معلومات الأنظمة ---------- */
// الأربعة الأوائل (لوكارب / بحر متوسط / متوازن / كارب سايكل) هي خط الترشيح الأول، والكيتو/الكارنفور حل أخير
var DIETS=[
 {key:'lowcarb',name:'لو كارب'},
 {key:'mediterranean',name:'حمية البحر المتوسط'},
 {key:'balanced',name:'النظام المتوازن'},
 {key:'carbcycle',name:'كارب سايكل'},
 {key:'keto',name:'كيتو'},
 {key:'carnivore',name:'كارنفور'}
];
var DINFO_FB={
 balanced:{tag:'الأنسب للاستمرار',how:'يوزع سعراتك على البروتين والكارب والدهون بنسب صحية متوازنة، بدون حرمان من أي مجموعة غذائية — الأسهل التزاما على المدى الطويل'},
 lowcarb:{tag:'تحكم في الجوع',how:'يقلل الكارب ويرفع البروتين والدهون الصحية، فيخفض الأنسولين ويخلي الجسم يحرق الدهون كمصدر أساسي للطاقة'},
 mediterranean:{tag:'الأفضل لصحة القلب',how:'قائم على زيت الزيتون والخضار والبقوليات والسمك والحبوب الكاملة، يقلل الكوليسترول والالتهاب ويحسن صحة القلب والسكر — مدعوم بأقوى الأدلة العلمية'},
 carbcycle:{tag:'يكسر الثبات',how:'يدور الكارب بين أيام عالية (أيام التمرين) وأيام منخفضة (الراحة) — يحافظ على الأداء والأيض ويكسر ثبات الوزن'},
 keto:{tag:'حرق دهون قوي',how:'كارب أقل من 50ج يوميا ودهون عالية، فيدخل الجسم حالة الكيتوزيس ويحرق الدهون مباشرة كوقود أساسي'},
 carnivore:{tag:'صارم جدا',how:'بروتين ودهون حيوانية بالكامل وكارب قريب من الصفر — نظام إقصائي صارم يعتمد على اللحوم والبيض والأسماك فقط'}
};
function dietLabel(k){return {balanced:'المتوازن',lowcarb:'لو كارب',mediterranean:'حمية البحر المتوسط',carbcycle:'كارب سايكل',keto:'كيتو',carnivore:'كارنفور'}[k]||k;}
function dietInfo(k){
 var how=DINFO_FB[k]?DINFO_FB[k].how:'';
 var tag=DINFO_FB[k]?DINFO_FB[k].tag:'';
 var best=[];
 try{ if(typeof DI_STATIC_DATA!=='undefined'&&DI_STATIC_DATA[k]){ if(DI_STATIC_DATA[k].how_it_works)how=DI_STATIC_DATA[k].how_it_works; if(DI_STATIC_DATA[k].best_for)best=DI_STATIC_DATA[k].best_for.slice(0,2); } }catch(e){}
 return {how:how,tag:tag,best:best};
}
function macroCarb(m){return m?(m.carbs!=null?m.carbs:(m.carb!=null?m.carb:0)):0;}
function recommendKey(){
 var h=DE.healthConditions||[];
 // أولوية لل 4 الأوائل فقط (لا كيتو/كارنفور)
 if(h.indexOf('cholesterol')>-1||h.indexOf('fatty-liver')>-1||h.indexOf('bp')>-1)return 'mediterranean';
 if(h.indexOf('diabetes')>-1||h.indexOf('insulin')>-1)return 'lowcarb';
 if(h.indexOf('kidney')>-1)return 'mediterranean';
 if(DE.goal==='bulk')return DE.gainStyle==='mass'?'balanced':'carbcycle';
 if(DE.goal==='cut'){
  var toLose=(DE.weight||0)-(DE.target||0);
  // وزن زائد كبير (15كج+) - كارب سايكل حل سريع للتنشيف
  if(toLose>=15)return 'carbcycle';
  return 'lowcarb';
 }
 if(DE.goal==='maintain')return 'mediterranean';
 return 'mediterranean';
}
function computePlans(){
 var rec=recommendKey();var out=[];
 DIETS.forEach(function(d){
  var target=METRICS.target;var macros=null;
  try{macros=(typeof calcMacros==='function')?calcMacros(target,d.key):null;}catch(e){}
  out.push({key:d.key,name:d.name,rec:d.key===rec,target:target,macros:macros||{},info:dietInfo(d.key)});
 });
 // المرشح أولا، ثم الأربعة الأوائل، والكيتو/الكارنفور دائما في الآخر (حل أخير)
 var LAST=['keto','carnivore'];
 out.sort(function(a,b){
  var ra=(a.rec?2:0)-(LAST.indexOf(a.key)>-1?1:0);
  var rb=(b.rec?2:0)-(LAST.indexOf(b.key)>-1?1:0);
  return rb-ra;
 });
 return out;
}

var STEPS=['بنحلل جسمك ومؤشر الكتلة','بنحسب احتياجك من السعرات','بنوازن الماكروز على هدفك','بنجهز أنظمتك الغذائية'];
function runAnalysis(){
 try{if(window.EFProfile)EFProfile.captureFromDiet(ans);}catch(e){}
 show('scAnalysis');
 $('anResult').classList.add('hidden');
 $('thinkBox').style.display='flex';
 var ss=$('thinkSteps');ss.innerHTML=STEPS.map(function(s,i){return '<div class="step" data-i="'+i+'"><span class="b">'+(i+1)+'</span><span>'+esc(s)+'</span></div>';}).join('');
 var arc=$('thinkArc'),C=440,p=0,computed=false;
 var t=setInterval(function(){
  p+=2;if(p>100)p=100;
  arc.setAttribute('stroke-dashoffset',C*(1-p/100));
  $('thinkPct').textContent=p+'%';
  var si=Math.min(STEPS.length-1,Math.floor(p/25));
  Array.prototype.forEach.call(ss.querySelectorAll('.step'),function(el){el.classList.toggle('on',+el.getAttribute('data-i')<=si);});
  if(p>=55&&!computed){computed=true;try{applyToState();runMetrics();PLANS=computePlans();}catch(e){console.error(e);}}
  if(p>=100){clearInterval(t);setTimeout(showAnalysisResult,420);}
 },46);
}
function bmiCat(b){if(b<18.5)return 'نحافة';if(b<25)return 'وزن مثالي';if(b<30)return 'زيادة وزن';return 'سمنة';}
function goalAr(){return {cut:'تخسيس',maintain:'تثبيت',bulk:(DE.gainStyle==='mass'?'ضخامة':'زيادة عضلية')}[DE.goal]||'';}
var HC_NOTE={diabetes:'سكري — ركزنا على كارب منخفض المؤشر الجلايسيمي',insulin:'مقاومة إنسولين — قللنا الكارب المكرر',bp:'ضغط مرتفع — صوديوم أقل وخضار أكتر',cholesterol:'كوليسترول — دهون صحية ومصادر أوميجا 3',hypothyroid:'خمول غدة — توازن في السعرات ودعم الأيض',hyperthyroid:'نشاط غدة — سعرات كافية ومتابعة',ibs:'قولون — أطعمة سهلة الهضم',gluten:'حساسية جلوتين — استبعاد القمح والمصادر',lactose:'حساسية لاكتوز — بدائل خالية من اللاكتوز',kidney:'كلى — بروتين معتدل ومتابعة طبية',gout:'نقرس — تقليل اللحوم الحمراء والأحشاء',pcos:'تكيس مبايض — كارب منخفض وتحكم في الأنسولين',gerd:'حموضة — تجنب المهيجات والوجبات الكبيرة',"fatty-liver":'كبد دهني — تقليل السكريات والدهون المشبعة'};
function showAnalysisResult(){
 $('thinkBox').style.display='none';
 var r=$('anResult');r.classList.remove('hidden');
 $('anHi').textContent='تحليلك جاهز — دي صورة احتياجك الحقيقية';
 var bmi=+(METRICS.bmi||0).toFixed(1);
 var cards=[
  {l:'معدل الأيض (BMR)',v:METRICS.bmr,dec:0,sub:'سعر/يوم',pct:clampN(METRICS.bmr/2500*100,0,100)},
  {l:'احتياجك (TDEE)',v:METRICS.tdee,dec:0,sub:'سعر/يوم',pct:clampN(METRICS.tdee/3500*100,0,100)},
  {l:'سعراتك المستهدفة',v:METRICS.target,dec:0,sub:'سعر/يوم',pct:clampN(METRICS.target/3500*100,0,100)},
  {l:'مؤشر الكتلة',v:bmi,dec:1,sub:bmiCat(bmi),pct:clampN(bmi/40*100,0,100)}
 ];
 $('anCards').innerHTML=cards.map(function(c,i){return '<div class="anc tone-'+(i%3)+'"><div class="gauge"><svg viewBox="0 0 90 90"><circle class="bg" cx="45" cy="45" r="38"></circle><circle class="fg" cx="45" cy="45" r="38" stroke-dasharray="239" stroke-dashoffset="239" data-pct="'+(+c.pct||0).toFixed(1)+'"></circle></svg><div class="gv" data-to="'+c.v+'" data-dec="'+c.dec+'">0</div></div><div class="gl">'+esc(c.l)+'</div><div class="gs">'+esc(c.sub)+'</div></div>';}).join('');
 var recPlan=PLANS[0];
 var m=recPlan?recPlan.macros:(METRICS.macros||{});
 var mcal=recPlan?recPlan.target:METRICS.target;
 function mc(l,v,u){return '<div class="amc"><div class="amv">'+esc(v)+'</div><div class="aml">'+esc(l)+'</div><div class="amu">'+esc(u)+'</div></div>';}
 var macroHtml='<div class="an-macros"><div class="amh">تغذيتك المقترحة — هدف '+esc(goalAr())+'</div><div class="amg">'+mc('السعرات',mcal||0,'سعر/يوم')+mc('بروتين',Math.round(m.protein||0),'جرام')+mc('كارب',Math.round(macroCarb(m)),'جرام')+mc('دهون',Math.round(m.fat||0),'جرام')+'</div><div class="amn">أرقام محسوبة من سعراتك وهدفك ووزنك وحالتك الصحية — وهتتطور أسبوعيا مع التزامك</div></div>';
 // معلومات إضافية
 var water=(DE.weight*0.035);
 var proPerKg=DE.weight?((m.protein||0)/DE.weight):0;
 var insights=[];
 insights.push({ic:'',l:'الماء المقترح',v:water.toFixed(1)+' لتر/يوم'});
 insights.push({ic:'',l:'البروتين لكل كيلو',v:proPerKg.toFixed(1)+' ج/كجم'});
 insights.push({ic:'',l:'العجز/الفائض',v:(METRICS.target-METRICS.tdee>=0?'+':'')+(METRICS.target-METRICS.tdee)+' سعر'});
 if(DE.goal!=='maintain'){
  var diff=Math.abs((+ans.target||DE.weight)-DE.weight);
  var rate=parseFloat(ans.rate)||0.5;
  var wks=rate>0?Math.max(1,Math.round(diff/rate)):0;
  if(wks)insights.push({ic:'',l:'الوصول لهدفك',v:'حوالي '+wks+' أسبوع'});
 }
 insights.push({ic:'',l:'تقييم وزنك',v:bmiCat(bmi)});
 var insHtml='<div class="an-ins"><div class="amh">معلومات تهمك</div><div class="ins-grid">'+insights.map(function(x){return '<div class="ins-c"><span class="ins-ic">'+x.ic+'</span><div class="ins-t"><div class="ins-v">'+esc(x.v)+'</div><div class="ins-l">'+esc(x.l)+'</div></div></div>';}).join('')+'</div>';
 var hc=DE.healthConditions||[];
 if(hc.length){
  var notes=hc.map(function(k){return HC_NOTE[k];}).filter(Boolean);
  if(notes.length)insHtml+='<div class="an-warn"><div class="aw-h">راعينا حالتك الصحية</div><ul>'+notes.map(function(n){return '<li>'+esc(n)+'</li>';}).join('')+'</ul></div>';
 }
 insHtml+='</div>';
 var _altP=[];for(var _ai=1;_ai<PLANS.length&&_altP.length<2;_ai++){if(['keto','carnivore'].indexOf(PLANS[_ai].key)<0)_altP.push({p:PLANS[_ai],idx:_ai});}var _altHtml=_altP.map(function(o){return '<div class="an-altplan"><div class="aap-h"><b>'+esc(o.p.name)+'</b><span class="aap-tag">'+esc(o.p.info.tag||'')+'</span></div><p>'+esc(o.p.info.how)+'</p><button type="button" class="btn btn-ghost" style="width:100%" onclick="App.choose('+o.idx+')">ابدأ بنظام '+esc(o.p.name)+'</button></div>';}).join('');var recHtml=recPlan?('<div class="an-recplan"><span class="tag">المرشح ليك</span><h3>'+esc(recPlan.name)+'</h3><p>'+esc(recPlan.info.how)+'</p>'+(_altHtml?'<button type="button" class="an-altbtn" onclick="App.toggleAlts(this)">اختار نظام تاني</button><div class="an-alts hidden">'+_altHtml+'</div>':'')+'</div>'):'';
 $('anRec').innerHTML=macroHtml+insHtml+recHtml;
 setTimeout(function(){
  Array.prototype.forEach.call(document.querySelectorAll('#anCards .fg'),function(el){var p=+el.getAttribute('data-pct')||0;el.style.transition='stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)';el.style.strokeDashoffset=(239*(1-p/100)).toFixed(1);});
  Array.prototype.forEach.call(document.querySelectorAll('#anCards .gv'),function(el){var to=+el.getAttribute('data-to')||0,dec=+el.getAttribute('data-dec')||0,cur=0,step=to/40;var t=setInterval(function(){cur+=step;if(cur>=to){cur=to;clearInterval(t);}el.textContent=dec?cur.toFixed(1):Math.round(cur);},16);});
 },60);
}

function showPlans(){
 show('scPlans');
 $('plansSub').textContent= 'دي '+PLANS.length+' أنظمة مناسبة ليك — والمرشح في الأول. اقرا آلية كل نظام واختار اللي يريحك';
 var g=$('planGrid');g.innerHTML='';
 PLANS.forEach(function(p,i){
  var m=p.macros||{};
  var bestTags=(p.info.best||[]).map(function(b){return '<span class="pl-tag">'+esc(b)+'</span>';}).join('');
  var card=document.createElement('div');
  card.className='plan'+(p.rec?' rec':'');
  card.innerHTML=(p.rec?'<div class="ribbon">المرشح ليك</div>':'')+
   '<div class="pl-badge">'+esc(p.info.tag||'')+'</div>'+
   '<h3>'+esc(p.name)+'</h3>'+
   '<div class="pl-how"><b>إزاي بيشتغل؟</b> '+esc(p.info.how)+'</div>'+
   (bestTags?'<div class="pl-best">'+bestTags+'</div>':'')+
   '<button class="btn '+(p.rec?'btn-primary':'btn-ghost')+' btn-lg" style="width:100%">'+(p.rec?'ابدأ واختار أكلك':'اختار النظام ده')+'</button>';
  card.querySelector('button').onclick=function(){choose(i);};
  g.appendChild(card);
 });
}

/* ---------- بناء الوجبات: اختار أكلي ---------- */
var SALAD_IDS=['khyar','tmatm','flfl','jzr','bsl','khs','kabwtsha','jrjyr'];
var PRE_TIMING=(function(){try{var v=localStorage.getItem('diet_pre_timing');v=v?JSON.parse(v):'light';return (v==='full')?'full':'light';}catch(e){return 'light';}})();
var SLOT_MEAL={breakfast:'breakfast',lunch:'lunch',dinner:'dinner',pre:'pre',post:'post',snack:'snack',snack2:'snack'};
/* اقتراحات مصرية منطقية لكل وجبة — اختيار خبير تغذية لعامة الشعب المصري */
var EGY_SUGGEST={
 breakfast:['byd_mslwq','fwlmdms','jbnaqrysh','ayshbldy','jbnabyda','byd_awmlyt','twstasmr','jbnarwmy','zbadytbyay'],
 lunch:['sdr_frakh_mshwy','wrk_frakh_mshwy','lhm_bqry_mslwq','kfta_mshwya_ala_alfhm','kbab_mshwy','blty_mshwy','smk_blamyta_mshwy','makryl_mshwy','sdr_bt_mshwy','arzabydmtbwkh','btatsmshwya','mkrwnamslwqa'],
 dinner:['byd_mslwq','jbnaqrysh','zbadytbyay','twna_myah','fwlmdms','jbnabyda','blty_mshwy','sdr_frakh_mshwy','twstasmr','tfah','mwz'],
 snack:['tfah','zbadytbyay','mwz','jwafa','lwz_ny','frawla','tmr','kmthra','jbnaqrysh','blh','anb'],
 pre:['mwz','tmr','blh','tfah','rayskykbny','ayshbldy','arzabydmtbwkh','btatsmshwya','twstasmr','brtqal'],
 post:['sdr_frakh_mshwy','wrk_frakh_mshwy','byd_mslwq','twna_myah','blty_mshwy','fylyh_blty','arzabydmtbwkh','btatsmshwya','rayskykbny','mwz','tmr']
};
/* اقتراحات وجبة قبل التمرين حسب التوقيت: خفيفة / متوسطة / أساسية */
var EGY_PRE={
 light:['mwz','tmr','blh','tfah','rayskykbny','twstasmr','brtqal','coffee_black'],
 mid:['twstasmr','rayskykbny','byd_mslwq','zbadytbyay','jbnaqrysh','mwz','tmr','coffee_black'],
 full:['sdr_frakh_mshwy','wrk_frakh_mshwy','arzabydmtbwkh','btatsmshwya','blty_mshwy','twna_myah']
};
function poolByMeal(mt){var arr=[];try{(FOOD_DB||[]).forEach(function(f){if(f&&f.mealTypes&&f.mealTypes.indexOf(mt)>-1)arr.push(f);});}catch(e){}return arr;}
var SLOT_CATS={
 breakfast:['protein','carb','dairy'],
 lunch:['protein','carb','veggie'],
 dinner:['protein','veggie','carb'],
 pre:['carb','fruit'],
 post:['protein','carb'],
 snack:['fruit','dairy','snack'],
 snack2:['fruit','snack']
};
function buildSlots(){
 var mc=+ans.meals||3;
 var gym=ans.workout==='جيم';
 var wt=({'صباحي':'morning','ظهري':'mid','مسائي':'evening'})[ans.wotime]||'mid';
 WO_TIME=wt;
 var bf={k:'breakfast',label:'الفطار',ic:''},lu={k:'lunch',label:'الغداء',ic:''},di={k:'dinner',label:'العشاء',ic:''};
 var pre={k:'pre',label:'قبل التمرين',ic:''},post={k:'post',label:'بعد التمرين',ic:''};
 var sn={k:'snack',label:'سناك',ic:''},sn2={k:'snack2',label:'سناك مسائي',ic:''};
 var list;
 if(gym&&mc>=5){
  if(wt==='morning')list=[pre,post,lu,sn,di];
  else if(wt==='evening')list=[bf,sn,lu,pre,post];
  else list=[bf,sn,pre,post,di];
 }else if(gym&&mc===4){
  if(ans.gymsnack==='نعم'){
   var gs={k:'pre',label:'سناك الجيم',ic:''};
   if(wt==='morning')list=[gs,bf,lu,di];
   else if(wt==='evening')list=[bf,lu,di,gs];
   else list=[bf,lu,gs,di];
  }else{
   if(wt==='morning')list=[pre,post,lu,di];
   else if(wt==='evening')list=[bf,lu,pre,post];
   else list=[bf,pre,post,di];
  }
 }else if(mc<=2){list=[bf,di];}
 else if(mc===3){list=[bf,lu,di];}
 else if(mc===4){list=[bf,lu,sn,di];}
 else{list=[bf,{k:'snack',label:'سناك صباحي',ic:''},lu,sn2,di];}
 SLOTS=list;
 // امسح أي وجبات قديمة اتغيرت إعداداتها عشان ما يتجمعش وجبات شبح
 var keep={};
 SLOTS.forEach(function(s){keep[s.k]=1;if(!MEAL_SEL[s.k])MEAL_SEL[s.k]=[];});
 Object.keys(MEAL_SEL).forEach(function(k){if(!keep[k])delete MEAL_SEL[k];});
 try{ if(gym && keep['pre'] && (wt==='morning'||wt==='mid') && !COFFEE_SEEDED){ var _cf=null; try{_cf=FOOD_MAP.get('coffee_black');}catch(e){} var _ok=true; try{_ok=_cf?isFoodAllowed(_cf).ok:false;}catch(e){_ok=true;} if(_cf && _ok && (MEAL_SEL['pre']||[]).indexOf('coffee_black')<0)MEAL_SEL['pre'].push('coffee_black'); COFFEE_SEEDED=true; } }catch(e){}
}
function toggleAlts(btn){try{var box=btn.parentNode.querySelector(".an-alts");if(box)box.classList.toggle("hidden");}catch(e){}}
function proceedRec(){choose(0);}
function choose(i){
 var p=PLANS[i];if(!p)return;
 CHOSEN=p.key;
 try{DE.selectedDiet=p.key;setInp('inp-goal',DE.goal);}catch(e){}
 buildSlots();slotIdx=0;
 show('scBuild');renderBuild();
}
function suggFoods(slotKey){
 try{DE.selectedDiet=CHOSEN;}catch(e){}
 var mt=SLOT_MEAL[slotKey]||'lunch';
 var picked=[],seen={};
 function tryAdd(f){
  if(!f||seen[f.id])return;
  if((MEAL_SEL[slotKey]||[]).indexOf(f.id)>-1)return;
  if(typeof EGY_AFFORD!=='undefined'&&EGY_AFFORD.excluded(f))return; // [EGY] مصنع صناعي: ممنوع يظهر كاقتراح وقت اختيار الأكل
  var ok=true;try{ok=isFoodAllowed(f).ok;}catch(e){ok=true;}
  if(!ok)return;
  seen[f.id]=1;picked.push(f);
 }
 /* الأول: القائمة المصرية المنطقية المنسقة للوجبة دي (قبل التمرين: حسب التوقيت) */
 var _src=(slotKey==='pre'&&typeof EGY_PRE!=='undefined')?(EGY_PRE[PRE_TIMING]||EGY_PRE.light):(EGY_SUGGEST[mt]||[]);
 _src.forEach(function(id){if(picked.length>=10)return;var f=null;try{f=FOOD_MAP.get(id);}catch(e){}tryAdd(f);});
 /* لو النظام صارم (كيتو/كارنفور) وقلت الاقتراحات، نكمل من أكلات نفس الوجبة المسموحة */
 if(picked.length<6){
  var nat={minimal:4,none:4,low:3,medium:1,high:-2,very_high:-4};
  var pool=poolByMeal(mt).filter(function(f){return f.processedLevel!=='processed'&&f.processedLevel!=='very_high'&&(f.nameAr||'').indexOf('مقلي')<0&&!(typeof EGY_AFFORD!=='undefined'&&EGY_AFFORD.excluded(f));});
  pool.sort(function(a,b){return (nat[b.processedLevel]||0)-(nat[a.processedLevel]||0);});
  for(var i=0;i<pool.length&&picked.length<10;i++)tryAdd(pool[i]);
 }
 return picked;
}
function renderBuild(){
 var s=SLOTS[slotIdx];if(!s)return;
 var pct=Math.round(slotIdx/SLOTS.length*100);
 var n=slotIdx+1;
 var html='';
 html+='<div class="prog"><div class="prog-bar"><i style="width:'+pct+'%"></i></div><span>'+n+'/'+SLOTS.length+'</span></div>';
 html+='<div class="bd-head"><span class="bd-ic">'+s.ic+'</span><div><h2>الوجبة '+n+' — '+esc(s.label)+'</h2><p>ممكن تحب تاكل إيه في '+esc(s.label)+'؟ ابحث وأضف من قاعدة البيانات، أو اختار من اقتراحاتنا</p></div></div>';
 if(s.k==='pre'){html+='<div class="bd-sec pretiming"><div class="bd-lbl">⏱الوجبة دي قبل التمرين ب:</div><div class="pt-row">'+
   '<button type="button" class="pt-chip" data-t="light"><span class="pt-t">أقل من ساعة</span></button>'+
   '<button type="button" class="pt-chip" data-t="full"><span class="pt-t">أكتر من ساعتين</span></button>'+
   '</div></div>';}
 html+='<div class="bd-sec"><div class="bd-lbl">اقتراحات نظام '+esc(dietLabel(CHOSEN))+'</div><div id="bSugg" class="bd-sugg"></div></div>';
 html+='<div class="bd-sec"><div class="bd-lbl">دور على أكلك</div><input id="bSearch" class="bd-search" type="text" placeholder="اكتب اسم الأكل... (مثلا: أرز، فراخ، زبادي)" autocomplete="off"><div id="bResults" class="bd-results"></div></div>';
 html+='<div class="bd-sec"><div class="bd-selhead"><div class="bd-lbl">وجبتك (<span id="bCount">0</span>)</div><button id="bClear" class="bd-clear" type="button">مسح الكل</button></div><div id="bSelected" class="bd-selected"></div><div id="bCheck" class="bd-check"></div></div>';
 html+='<div class="bd-foot"><button class="btn btn-ghost" id="bPrevBtn">رجوع</button><button class="btn btn-primary" id="bNextBtn"></button></div>';
 $('buildWrap').innerHTML=html;
 var inp=$('bSearch');
 if(inp){inp.value=QSEARCH[s.k]||'';inp.oninput=function(){QSEARCH[s.k]=inp.value;refreshResults(s.k);};}
 if(s.k==='pre'){Array.prototype.forEach.call(document.querySelectorAll('.pt-chip'),function(b){
  if(b.getAttribute('data-t')===PRE_TIMING)b.classList.add('on');
  b.onclick=function(){PRE_TIMING=b.getAttribute('data-t');try{DE.preTiming=PRE_TIMING;}catch(e){}try{localStorage.setItem('diet_pre_timing',JSON.stringify(PRE_TIMING));}catch(e){}
   Array.prototype.forEach.call(document.querySelectorAll('.pt-chip'),function(x){if(x===b)x.classList.add('on');else x.classList.remove('on');});
   refreshSugg(s.k);refreshCheck(s.k);};
 });}
 $('bPrevBtn').onclick=function(){bPrev();};
 $('bNextBtn').onclick=function(){bNext();};
 $('bNextBtn').textContent= slotIdx===SLOTS.length-1?'خلص وجهز خطتي':'الوجبة الجاية';
 refreshSugg(s.k);refreshResults(s.k);refreshSelected(s.k);refreshCheck(s.k);
}
function refreshSugg(slotKey){
 var el=$('bSugg');if(!el)return;
 var foods=suggFoods(slotKey);
 if(!foods.length){el.innerHTML='<span class="bd-empty">مفيش اقتراحات إضافية دلوقتي</span>';return;}
 el.innerHTML=foods.map(function(f){return '<button class="sugg-chip" data-id="'+esc(f.id)+'">'+esc(f.nameAr)+' <span class="plus">+</span></button>';}).join('');
 Array.prototype.forEach.call(el.querySelectorAll('.sugg-chip'),function(b){b.onclick=function(){bAdd(slotKey,b.getAttribute('data-id'));};});
}
function refreshResults(slotKey){
 var el=$('bResults');if(!el)return;
 var q=QSEARCH[slotKey]||'';
 if(!q.trim()){el.innerHTML='';el.style.display='none';return;}
 el.style.display='block';
 try{DE.selectedDiet=CHOSEN;}catch(e){}
 var foods=[];try{foods=searchFoods(q,'all')||[];}catch(e){foods=[];}
 foods=foods.slice(0,18);
 if(!foods.length){el.innerHTML='<div class="bd-empty" style="padding:10px">مفيش نتائج ل "'+esc(q)+'"</div>';return;}
 el.innerHTML=foods.map(function(f){
  var added=MEAL_SEL[slotKey].indexOf(f.id)>-1;
  var allow=true,reason='';try{var a=isFoodAllowed(f);allow=a.ok;reason=a.reason||'';}catch(e){}
  return '<div class="fr'+(allow?'':' blocked')+(added?' added':'')+'"'+(allow?(' data-id="'+esc(f.id)+'"'):'')+'><div class="fr-mid"><div class="fr-n">'+esc(f.nameAr)+'</div><div class="fr-m">'+f.cal+' · بروتين '+f.pro+'ج · كارب '+f.carb+'ج · دهون '+f.fat+'ج'+(allow?'':' · '+esc(reason))+'</div></div>'+(allow?('<span class="fr-add'+(added?' on':'')+'">'+(added?'✓ مضاف':'+ أضف')+'</span>'):'<span class="fr-no">ممنوع</span>')+'</div>';
 }).join('');
 Array.prototype.forEach.call(el.querySelectorAll('.fr[data-id]'),function(b){b.onclick=function(){var id=b.getAttribute('data-id');if(MEAL_SEL[slotKey].indexOf(id)>-1)bRemove(slotKey,id);else bAdd(slotKey,id);};});
}
function saladInfo(slotKey){
 var ids=MEAL_SEL[slotKey]||[];
 var inSalad=ids.filter(function(id){return SALAD_IDS.indexOf(id)>-1;});
 return inSalad;
}
function refreshSelected(slotKey){
 var el=$('bSelected');if(!el)return;
 var ids=MEAL_SEL[slotKey]||[];
 var cnt=$('bCount');if(cnt)cnt.textContent=ids.length;
 var clr=$('bClear');if(clr)clr.style.display=ids.length?'inline-flex':'none';
 if(!ids.length){el.innerHTML='<span class="bd-empty">لسه مختارتش حاجة — أضف من الاقتراحات أو ابحث فوق</span>';return;}
 var inSalad=saladInfo(slotKey);
 var html='';
 if(inSalad.length>=3){
  var names=inSalad.map(function(id){var f=FOOD_MAP.get(id);return f?f.nameAr:'';}).filter(Boolean).join('، ');
  html+='<span class="sel-chip salad" data-salad="1" title="اضغط لإزالة السلطة">سلطة <span class="sc-sub">('+esc(names)+')</span> <span class="x">✕</span></span>';
 }else{
  inSalad.forEach(function(id){var f=FOOD_MAP.get(id);if(!f)return;html+='<span class="sel-chip" data-id="'+esc(id)+'">'+esc(f.nameAr)+' <span class="x">✕</span></span>';});
 }
 ids.forEach(function(id){if(SALAD_IDS.indexOf(id)>-1)return;var f=FOOD_MAP.get(id);if(!f)return;html+='<span class="sel-chip" data-id="'+esc(id)+'">'+esc(f.nameAr)+' <span class="x">✕</span></span>';});
 el.innerHTML=html;
 Array.prototype.forEach.call(el.querySelectorAll('.sel-chip'),function(b){
  if(b.getAttribute('data-salad')){b.onclick=function(){bRemoveSalad(slotKey);};}
  else{b.onclick=function(){bRemove(slotKey,b.getAttribute('data-id'));};}
 });
}
function needCats(need){return need==='protein'?['protein','dairy']:need==='carb'?['carb','fruit']:need==='veggie'?['veggie']:[];}
function needLabel(need){return need==='protein'?'زود مصدر بروتين للوجبة:':need==='carb'?'زود مصدر طاقة (كارب):':need==='veggie'?'زود خضار للوجبة:':'';}
function suggForNeed(slotKey,need){
 var cats=needCats(need);if(!cats.length)return [];
 try{DE.selectedDiet=CHOSEN;}catch(e){}
 var mt=SLOT_MEAL[slotKey]||'lunch';
 var picked=[],seen={};
 function tryAdd(f){
  if(!f||seen[f.id])return;
  if(cats.indexOf(f.cat)<0)return;
  if((MEAL_SEL[slotKey]||[]).indexOf(f.id)>-1)return;
  if(typeof EGY_AFFORD!=='undefined'&&EGY_AFFORD.excluded(f))return; // [EGY] مصنع صناعي: ممنوع يظهر كاقتراح وقت اختيار الأكل
  var ok=true;try{ok=isFoodAllowed(f).ok;}catch(e){ok=true;}
  if(!ok)return;
  seen[f.id]=1;picked.push(f);
 }
 (EGY_SUGGEST[mt]||[]).forEach(function(id){if(picked.length>=6)return;var f=null;try{f=FOOD_MAP.get(id);}catch(e){}tryAdd(f);});
 if(picked.length<6){var pool=poolByMeal(mt);if(!pool.length){try{pool=(FOOD_DB||[]);}catch(e){pool=[];}}for(var i=0;i<pool.length&&picked.length<6;i++)tryAdd(pool[i]);}
 return picked.slice(0,6);
}
function refreshCheck(slotKey){
 var el=$('bCheck');if(!el)return;
 var foods=(MEAL_SEL[slotKey]||[]).map(function(id){return FOOD_MAP.get(id);}).filter(Boolean);
 var res=mealCheck(slotKey,foods);
 el.className='bd-check '+(res.cls||'');
 var html=res.msg?('<span>'+esc(res.msg)+'</span>'):'';
 var fix=res.need?suggForNeed(slotKey,res.need):[];
 if(fix.length){
  html+='<div class="bd-fix"><div class="bd-fix-lbl">'+esc(needLabel(res.need))+'</div><div class="bd-fix-row">'+fix.map(function(f){return '<button type="button" class="sugg-chip fix-chip" data-id="'+esc(f.id)+'">'+esc(f.nameAr)+' <span class="plus">+</span></button>';}).join('')+'</div></div>';
 }
 el.innerHTML=html;
 Array.prototype.forEach.call(el.querySelectorAll('.fix-chip'),function(b){b.onclick=function(){bAdd(slotKey,b.getAttribute('data-id'));};});
}
function mealCheck(slotKey,foods){
 if(!foods.length)return {cls:'bad',msg:'لسه مفيش أكل في الوجبة دي'};
 var isSnack=slotKey==='snack'||slotKey==='snack2';
 var isPre=slotKey==='pre';
 var hasPro=foods.some(function(f){return f.cat==='protein'||f.cat==='dairy';});
 var hasCarb=foods.some(function(f){return f.cat==='carb'||f.cat==='fruit';});
 var hasVeg=foods.some(function(f){return f.cat==='veggie';});
 var lowCarb=['keto','carnivore','lowcarb'].indexOf(CHOSEN)>-1;
 // السناك وجبة خفيفة — مش لازم بروتين؛ فاكهة أو زبادي أو أي حاجة يحبها العميل تمام
 if(isSnack)return {cls:'ok',msg:'سناك خفيف مناسب — زود اللي يحلو لك (فاكهة، زبادي، مكسرات... زي ما تحب)'};
 // وجبة ما قبل التمرين: حسب التوقيت اللي اختاره المتدرب
 if(isPre){
  if(PRE_TIMING==='full'){
   if(!hasPro)return {cls:'bad',need:'protein',msg:'بما إنها قبل التمرين بأكتر من ساعتين فهي وجبة أساسية — محتاجة مصدر بروتين'};
   if(!lowCarb&&!hasCarb)return {cls:'bad',need:'carb',msg:'وجبة أساسية قبل التمرين — زود كارب معقد للطاقة'};
   return {cls:'ok',msg:'وجبة أساسية متكاملة قبل التمرين بأكتر من ساعتين (بروتين + كارب معقد)'};
  }
  if(PRE_TIMING==='mid'){
   if(!lowCarb&&!hasCarb)return {cls:'warn',need:'carb',msg:'قبل التمرين بساعة-ساعتين — يفضل كارب للطاقة (شوفان/توست/فاكهة)، والبروتين الخفيف اختياري'};
   return {cls:'ok',msg:'وجبة متوسطة مناسبة قبل التمرين بساعة-ساعتين — كارب + بروتين خفيف اختياري'};
  }
  return {cls:'ok',msg:'وجبة خفيفة مناسبة قبل التمرين بأقل من ساعة — كارب سريع زي الموز/التمر/القهوة كفاية (مش لازم بروتين)'};
 }
 if(!hasPro)return {cls:'bad',need:'protein',msg:'الوجبة ناقصها مصدر بروتين — أساسي في الوجبة الرئيسية عشان تكون متكاملة'};
 if(!lowCarb&&!hasCarb&&['breakfast','lunch','post'].indexOf(slotKey)>-1)
  return {cls:'bad',need:'carb',msg:'الوجبة ناقصها مصدر طاقة (كارب) — مهم في نظام '+dietLabel(CHOSEN)};
 if(['lunch','dinner'].indexOf(slotKey)>-1&&!hasVeg&&CHOSEN!=='carnivore')
  return {cls:'warn',need:'veggie',msg:'يفضل تضيف خضار للوجبة عشان تكون أكمل وأشبع'};
 return {cls:'ok',msg:'وجبة متكاملة ومناسبة لنظامك'};
}
function bAdd(slotKey,id){
 if(!id)return;
 var food=FOOD_MAP.get(id);if(!food)return;
 var allow=true,reason='';try{DE.selectedDiet=CHOSEN;var a=isFoodAllowed(food);allow=a.ok;reason=a.reason||'';}catch(e){}
 if(!allow){var el=$('bCheck');if(el){el.className='bd-check bad';el.innerHTML='<span>'+esc(food.nameAr)+' ممنوع: '+esc(reason)+'</span>';}return;}
 if(MEAL_SEL[slotKey].indexOf(id)<0)MEAL_SEL[slotKey].push(id);
 // بعد ما تضيف الصنف: اقفل قائمة نتائج البحث وفضي خانة البحث
 QSEARCH[slotKey]='';var sb=$('bSearch');if(sb)sb.value='';
 refreshSelected(slotKey);refreshSugg(slotKey);refreshResults(slotKey);refreshCheck(slotKey);
}
function bRemove(slotKey,id){
 var i=MEAL_SEL[slotKey].indexOf(id);if(i>-1)MEAL_SEL[slotKey].splice(i,1);
 refreshSelected(slotKey);refreshSugg(slotKey);refreshResults(slotKey);refreshCheck(slotKey);
}
function bRemoveSalad(slotKey){
 MEAL_SEL[slotKey]=MEAL_SEL[slotKey].filter(function(id){return SALAD_IDS.indexOf(id)<0;});
 refreshSelected(slotKey);refreshSugg(slotKey);refreshResults(slotKey);refreshCheck(slotKey);
}
function bClearAll(slotKey){
 MEAL_SEL[slotKey]=[];
 refreshSelected(slotKey);refreshSugg(slotKey);refreshResults(slotKey);refreshCheck(slotKey);
}
function bPrev(){if(slotIdx===0){show('scAnalysis');return;}slotIdx--;renderBuild();}
function bNext(){if(slotIdx<SLOTS.length-1){slotIdx++;renderBuild();}else{finish();}}
function _persistDietPlan(rawPlan,de,metrics,chosen){
 // حفظ الخطة والبروفايل بالشكل اللي الداشبورد (coach.js) بيقراه — تحويل أصناف المحرك لشكل مسطح
 try{
  de=de||(typeof DE!=='undefined'?DE:{});metrics=metrics||(typeof METRICS!=='undefined'?METRICS:{});chosen=chosen||(typeof CHOSEN!=='undefined'?CHOSEN:'balanced');
  var genderEn=de.gender==='أنثى'?'female':'male';
  var trainDays=deriveTrainDays(de.activity,de.workoutType);
  var target=Math.round((((rawPlan&&rawPlan.targetCals)||metrics.target||0))*(window.ELF_HIDDEN_BUFFER||1.10));
  var _BUFP=(window.ELF_HIDDEN_BUFFER||1.10);var _rmac=(rawPlan&&rawPlan.targetMacros)||metrics.macros||{};var macros={};for(var _mk in _rmac){macros[_mk]=(typeof _rmac[_mk]==='number')?Math.round(_rmac[_mk]*_BUFP):_rmac[_mk];}
  var prof={gender:genderEn,age:de.age,height:de.height,weight:de.weight,goal:de.goal,gainStyle:de.gainStyle,activity:de.activity,tdee:metrics.tdee,bmr:metrics.bmr,bmi:metrics.bmi,target:de.target,target_weight:de.target,targetCals:target,diet:chosen,healthConditions:de.healthConditions||[],dietProblems:de.dietProblems||[],sleep:7,weeklyRate:de.expectedWeeklyLoss||0.5,trainDays:trainDays,proteinTarget:(macros.protein||null),mealCount:de.mealCount};
  var _infO=function(t){t=t||{};var o={};for(var _k in t){o[_k]=(typeof t[_k]==='number')?Math.round(t[_k]*_BUFP):t[_k];}return o;};
  var meals=((rawPlan&&rawPlan.meals)||[]).map(function(m){
   return {slotKey:m.slotKey,label:m.label,targetCals:Math.round((m.targetCals||0)*_BUFP),totals:_infO(m.totals),foods:((m.foods||[]).map(function(f){var fo=f.food||{};return {id:fo.id,name:fo.nameAr||fo.nameEn||'',cat:fo.cat||'',grams:f.grams,cals:Math.round((f.cals||0)*_BUFP),pro:Math.round((f.pro||0)*_BUFP),carb:Math.round((f.carb||0)*_BUFP),fat:Math.round((f.fat||0)*_BUFP)};}))};
  });
  var planObj={version:(rawPlan&&rawPlan.version)||null,engineVersion:'EGY-v64',created:new Date().toISOString(),diet:chosen,targetCals:target,targetMacros:macros,totals:(rawPlan&&rawPlan.totals)?_infO(rawPlan.totals):null,meals:meals,profile:prof};
  localStorage.setItem('diet_plan',JSON.stringify(planObj));
  localStorage.setItem('diet_profile',JSON.stringify(prof));
  localStorage.setItem('diet_target',JSON.stringify(target));
  localStorage.setItem('diet_protein_target',JSON.stringify(macros.protein||0));
  if(!localStorage.getItem('diet_weights')){var tk=new Date().toISOString().slice(0,10);localStorage.setItem('diet_weights',JSON.stringify([{date:tk,week:1,weight:de.weight}]));}
  return planObj;
 }catch(e){try{console.error('persist',e);}catch(_){}return null;}
}
function finish(){
 try{
  DE.selectedDiet=CHOSEN;setInp('inp-goal',DE.goal);
  var all=[];
  SLOTS.forEach(function(s){(MEAL_SEL[s.k]||[]).forEach(function(id){if(all.indexOf(id)<0)all.push(id);});});
  if(!Array.isArray(DE.availableFoods))DE.availableFoods=[];
  DE.availableFoods=all;
  try{if(typeof SMPS!=='undefined'&&SMPS){SMPS.pool={};SLOTS.forEach(function(s){SMPS.pool[s.k]=new Set(MEAL_SEL[s.k]||[]);});}}catch(e){}
  try{localStorage.setItem('diet_user_meals',JSON.stringify(MEAL_SEL));}catch(e){}
  try{localStorage.setItem('diet_slot_order',JSON.stringify(SLOTS.map(function(s){return s.k;})));}catch(e){}
  try{localStorage.setItem('diet_wo_time',JSON.stringify(WO_TIME));}catch(e){}
  try{DE.preTiming=PRE_TIMING;localStorage.setItem('diet_pre_timing',JSON.stringify(PRE_TIMING));}catch(e){}
  var target=METRICS.target||(window.NutritionEngine.calculate({selectedDiet:CHOSEN}).targetCals);
  var _BUF=(window.ELF_HIDDEN_BUFFER||1.10);
  var _engTarget=Math.round(target/_BUF);
  var macros=(typeof calcMacros==='function')?calcMacros(_engTarget,CHOSEN):null;
  var _plan=window.buildSmartMealPlan(_engTarget,macros,null);
  _persistDietPlan(_plan,DE,METRICS,CHOSEN);
 }catch(e){console.error('finish',e);}
 location.href='dashboard.html';
}

window.App={start:start,next:next,back:back,showPlans:showPlans,choose:choose,toggleAlts:toggleAlts,proceedRec:proceedRec,bNext:bNext,bPrev:bPrev,finish:finish,_persistDietPlan:_persistDietPlan,deriveTrainDays:deriveTrainDays,computeCurrentWeek:computeCurrentWeek};
})();

window.ELF_HIDDEN_BUFFER=(typeof window.ELF_HIDDEN_BUFFER==='number'?window.ELF_HIDDEN_BUFFER:1.10);
function __boot(){try{window.App.start();}catch(e){console.error('boot',e);}}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',__boot);}else{__boot();}
