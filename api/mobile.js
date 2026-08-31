'use strict';
// Structured API consumed by the native Flutter application.
const db = require('../lib/db');
const auth = require('../lib/auth');
const { sendJson, readJsonBody, parseCookies } = require('../lib/util');
const nutritionHost = require('../lib/nutrition-engine-host');
const workoutHost = require('../lib/workout-engine-host');
const bridge = require('../lib/mobile-nutrition-bridge');
const coachEngine = require('../lib/coach-progression');
const periodizer = require('../lib/diet-periodization');
const plateauDx = require('../lib/plateau-diagnostics');
const { rateLimit } = require('../lib/rateLimit');
const { nutritionCache, catalogueCache } = require('../lib/cache');
const prefs = require('../lib/user-prefs');
const commerce = require('../lib/commerce');
const cfg = require('../lib/config');
const settings = require('../lib/settings');
// إعدادات التطبيق اللي الأدمن بيتحكم فيها (الصيانة، بوابة الإصدار، مفاتيح الإعلانات، ...)
const appconfig = require('../lib/appconfig');
// سجل أجهزة الإشعارات: التطبيق بيسجل توكنه هنا عشان الأدمن يقدر يبعتله.
const push = require('../lib/push');
// [OWNER-RULE] الذكاء لازم يفضل شغال حتى لو المتدرب مادخلش داتا.
const selfReport = require('../lib/self-report');

// مسح كاش المستخدم
// أي كتابة بتخص المستخدم لازم تمسح خطته المخزنة وإلا هيشوف أرقام قديمة
// وكمان تحليل تاريخ التمرين، لأن أي مجموعة جديدة بتغير الحجم والـ ACWR والأرقام القياسية
function dropCache(userId){
  try{ nutritionCache.invalidatePrefix('np:' + userId + ':'); }catch(_){}
  try{ nutritionCache.invalidatePrefix('wh:' + userId + ':'); }catch(_){}
}

function user(req, res) {
  const u = auth.currentUser(parseCookies(req));
  if (!u) sendJson(res, 401, { error: 'unauthenticated' });
  return u;
}
function parse(s, fallback) { try { return JSON.parse(s); } catch (_) { return fallback; } }
function n(v, min, max, fallback) { const x=Number(v); return Number.isFinite(x)?Math.max(min,Math.min(max,x)):fallback; }
function date(v) { const s=String(v||'').slice(0,10); return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:new Date().toISOString().slice(0,10); }
/* [FIX H3 — مفيش تعقيم للنصوص الحرة اللي المستخدم بيكتبها]
   المثبت بالدليل: profile() كان بيعمل trim().slice(0,80) وبس، فاسم زي
   <img src=x onerror=alert(1)> كان بيتخزن زي ما هو ويرجع في كل رد.
   أي مكان واحد في الواجهة (أو في لوحة الأدمن) يحطه بـ innerHTML = XSS مخزّن.

   القاعدة هنا: التعقيم يحصل عند الدخول (دفاع في العمق)، مش بديل عن الترميز
   عند العرض. بنشيل الأقواس الزاوية وحروف التحكم والمسافات المتكررة.
   مابنعملش HTML-escape هنا عشان مايبقاش فيه &amp; في اسم المستخدم جوّا
   القاعدة — التخزين يفضل نص نظيف، والعرض مسؤولية textContent. */
function safeText(v, max) {
  if (typeof v !== 'string') return '';
  return v
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // حروف تحكم
    .replace(/[<>]/g, '')                                          // أي وسم HTML
    .replace(/\s+/g, ' ')                                          // مسافات متكررة
    .trim()
    .slice(0, max || 80);
}
function safeTextList(arr, maxItems, maxLen) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(x => typeof x === 'string')
    .map(x => safeText(x, maxLen || 80))
    .filter(Boolean)
    .slice(0, maxItems);
}
function profile(p) {
  p=p&&typeof p==='object'?p:{}; const o={};
  // [FIX H3] كل الحقول النصية الحرة بتعدي على safeText قبل ما تتخزن.
  ['name','gender','goal','experience','equipment','dailyActivity','sleep','stress','diet','gainStyle'].forEach(k=>{if(typeof p[k]==='string')o[k]=safeText(p[k],80);});
  o.age=n(p.age,7,80,null); o.height=n(p.height,100,250,null); o.weight=n(p.weight,30,350,null);
  o.targetWeight=n(p.targetWeight,30,350,null); o.trainingDays=Math.round(n(p.trainingDays,2,6,3));
  o.trainingMinutes=Math.round(n(p.trainingMinutes,20,180,60)); o.mealCount=Math.round(n(p.mealCount,2,8,4));
  // Sprint 12: the diet engine reads these directly (inp-steps, inp-cardio,
  // inp-bf, inp-waist, inp-neck, inp-hip). They were never persisted, so the
  // engine silently fell back to 0/defaults on mobile.
  o.steps=n(p.steps,0,40000,null); o.cardioSessions=n(p.cardioSessions,0,14,null);
  if(['light','moderate','vigorous'].indexOf(String(p.cardioIntensity))>-1)o.cardioIntensity=String(p.cardioIntensity);
  else if(o.cardioSessions)o.cardioIntensity='moderate';
  // The weekly rate the user picked in onboarding. The engine turns it into
  // the daily deficit/surplus (rate * 7700 / 7), so dropping it here meant the
  // question could never affect a single calorie. Clamped to the range the
  // website itself offers: nothing below 0.25 or above 1 kg per week.
  o.weeklyRate=n(p.weeklyRate,0.25,1,null);
  // The helper units picked in onboarding (warmup/core/cardio/stretch/...).
  // Whitelisted here or the workout engine never sees them.
  o.activeModules=safeTextList(p.activeModules,8,40); // [FIX H3]
  o.bodyFat=n(p.bodyFat,3,65,null); o.waist=n(p.waist,40,250,null);
  o.neck=n(p.neck,20,80,null); o.hips=n(p.hips,50,250,null);
  // [FIX H3] نفس التعقيم على كل القوائم النصية.
  o.injuries=safeTextList(p.injuries,10,80);
  o.weakPoints=safeTextList(p.weakPoints,10,80);
  o.healthConditions=safeTextList(p.healthConditions,20,80);
  o.fastingMode=['normal','ramadan','if16'].indexOf(String(p.fastingMode))>-1?String(p.fastingMode):'normal';
  // Sprint 16: the pantry. These are the food ids the user ticked on the
  // "الأصناف المتاحة" screen, the mobile equivalent of the website's step 6.
  // The engine reads them as DE.availableFoods; without them it plans from the
  // whole database, which is its own documented emergency fallback.
  o.availableFoods=Array.isArray(p.availableFoods)
    // [FIX H3] safeText قبل إزالة التكرار، عشان مايعديش نفس الصنف مرتين بفرق مسافة.
    ?Array.from(new Set(p.availableFoods.filter(x=>typeof x==='string').map(x=>safeText(x,120)).filter(Boolean))).slice(0,400)
    :[];
  o.onboardingComplete=!!p.onboardingComplete;
  // إشارة يوم التمرين: محرك التغذية بيستخدمها لحقن وبة قبل التمرين
  // تلقائياً. لو التطبيق بعتها صراحة نحترمها، غير كده نستنتجها من عدد
  // أيام التمرين في الأسبوع (موزعة بالتساوي، السبت = 0 زي التطبيق).
  o.isTrainingDay=(typeof p.isTrainingDay==='boolean')?p.isTrainingDay:isTrainingToday(o.trainingDays);
  return o;
}
// Spread N training days evenly across the Egyptian week (Sat = 0).
function trainingDayIndexes(count){
  const n=Math.max(0,Math.min(7,Math.round(Number(count)||0)));
  const out=[];
  for(let i=0;i<n;i++){
    const idx=Math.round(i*7/n)%7;
    if(out.indexOf(idx)===-1)out.push(idx);
  }
  return out;
}
// اقرا يوم النهارده من الجدول المفعل
// بنرجع null لو مفيش جدول عشان المنادي يرجع للتقدير القديم
// أيام الراحة في المحرك مالهاش علم isRest واسمها بيبدأ بـ Rest وقائمة تمارينها فاضية
function trainingDayFromPlan(userId){
  try{
    const row=db.activeWorkoutPlan(userId);
    if(!row)return null;
    const data=parse(row.plan_json,null);
    const days=(data&&(data.days||(data.plan&&data.plan.days)))||null;
    if(!Array.isArray(days)||!days.length)return null;
    const today=(new Date().getDay()+1)%7;   // Sat = 0
    const d=days[today%days.length];
    if(!d)return null;
    if(d.isRest===true)return false;
    const ex=Array.isArray(d.exercises)?d.exercises:[];
    if(!ex.length)return false;
    if(/^\s*rest\b/i.test(String(d.name||d.dayName||'')))return false;
    return true;
  }catch(_){return null;}
}
function isTrainingToday(count){
  const today=(new Date().getDay()+1)%7;   // Sat = 0
  return trainingDayIndexes(count).indexOf(today)>-1;
}
function activeSub(s){return !!(s&&s.plan&&s.plan!=='free'&&(s.status==='active'||s.status==='trialing')&&(!s.current_period_end||Date.parse(s.current_period_end)>Date.now()));}

/* ==========================================================================
   [FIX C1 — مسارات الموبايل ماكانش عليها أي بوابة اشتراك]
   المشكلة المثبتة بالدليل: مستخدم خطته free واشتراكه غير نشط كان بياخد
   /api/mobile/nutrition-plan بـ 200 وحجم رد ~15.8 كيلوبايت (خطة أسبوع كاملة)
   و/api/mobile/modules بـ 200 و~8 كيلوبايت (كتالوج 57 تمرين بفيديوهاته).
   يعني المنتج المدفوع كله كان مجاني من جهة التطبيق، في حين إن نفس المحتوى
   مقفول صح في مسار الويب (/api/plan/compute).

   الحل متطابق مع مسار الويب: مش رفض 402 يكسر الشاشة، لكن معاينة محدودة:
   الأرقام (سعرات + ماكروز + تحليل) بتفضل ظاهرة لأنها قيمة حقيقية بتجيب اشتراك،
   والمحتوى المولَّد (وجبات اليوم وتمارين الوحدات) بيتقفل ورا locked:true.
   التطبيق بيقرا locked ويعرض شاشة الاشتراك.
   ========================================================================== */
function userSubActive(userId){
  try{ return activeSub(db.getSubscription(userId)||{plan:'free',status:'active'}); }
  catch(_){ return false; }
}

// بترجع نسخة مقفولة من رد خطة التغذية للمستخدم غير المشترك.
// ملحوظة: الكاش بيخزّن الرد الكامل، والقفل بيتطبق وقت الإرسال لكل طلب،
// عشان ماينفع مشترك يسخّن الكاش ومجاني ياخد النسخة الكاملة (أو العكس).
function gateNutritionPayload(userId,payload){
  if(!payload||typeof payload!=='object')return payload;
  if(userSubActive(userId))return Object.assign({},payload,{locked:false});
  const src=payload.plan;
  let gatedPlan=null;
  if(src&&typeof src==='object'){
    gatedPlan=Object.assign({},src);
    if(Array.isArray(gatedPlan.meals)){
      const all=gatedPlan.meals;
      gatedPlan.mealsTotal=all.length;
      gatedPlan.lockedMeals=Math.max(0,all.length-1);
      gatedPlan.meals=all.slice(0,1);   // وجبة واحدة كمعاينة، زي مسار الويب بالظبط
    }
  }
  return Object.assign({},payload,{
    locked:true,
    lockedReason:'subscription_required',
    plan:gatedPlan
  });
}
function plan(r){return r?{id:r.id,key:r.plan_key,createdAt:r.created_at,updatedAt:r.updated_at,data:parse(r.plan_json,null)}:null;}
function nutrition(r){return r?{day:r.day,calories:r.calories,protein:r.protein,carbs:r.carbs,fat:r.fat,waterMl:r.water_ml,meals:parse(r.meals_json,[]),updatedAt:r.updated_at}:null;}

// الإعلانات النشطة لمستخدم معين.
//   place    — 'home' | 'account' | null (كل الأماكن)
//   audience — بيتقرر من حالة اشتراك المستخدم الفعلية (مش من العميل)
// الترتيب: حقل order تصاعديًا زي ما الأدمن رتّبهم في اللوحة.
function activeAnnouncements(place, ctx){
  const cfgApp = appconfig.get();
  if (cfgApp.announcementsEnabled === false) return [];
  const list = settings.getJSON('announcements', []) || [];
  const now = Date.now();
  const isPro = !!(ctx && ctx.isPro);
  return list.filter(function(a){
    if (!a || a.active !== true) return false;
    const p = String(a.placement || 'both');
    if (place && p !== 'both' && p !== place) return false;
    // الجمهور المستهدف: إعلان للمجانيين ماينفعش يوصل لمشترك والعكس.
    const aud = String(a.audience || 'all');
    if (aud === 'pro' && !isPro) return false;
    if (aud === 'free' && isPro) return false;
    if (a.startsAt && Date.parse(a.startsAt) > now) return false;
    if (a.endsAt && Date.parse(a.endsAt) < now) return false;
    return true;
  }).sort(function(x,y){
    const ox = Number(x.order); const oy = Number(y.order);
    return (Number.isFinite(ox)?ox:9999) - (Number.isFinite(oy)?oy:9999);
  }).map(function(a,i){
    return {
      id: String(a.id || ''),
      title: String(a.title || '').slice(0,120),
      body: String(a.body || '').slice(0,500),
      link: String(a.link || '').slice(0,400),
      cta: String(a.cta || '').slice(0,40),
      image: String(a.image || '').slice(0,400),
      phone: String(a.phone || '').slice(0,40),
      placement: String(a.placement || 'both'),
      mode: String(a.mode || 'card'),
      style: ['info','success','warn','promo'].indexOf(String(a.style)) > -1 ? String(a.style) : 'info',
      audience: ['all','free','pro'].indexOf(String(a.audience)) > -1 ? String(a.audience) : 'all',
      dismissible: a.dismissible !== false,
      maxViews: Number.isFinite(Number(a.maxViews)) ? Math.max(0, Math.round(Number(a.maxViews))) : 0,
      order: i,
      active: !!a.active,
      startsAt: a.startsAt || null,
      endsAt: a.endsAt || null,
    };
  });
}

// هل الاشتراك مدفوع وفعّال؟ مصدر واحد لتقرير الجمهور في الإعلانات والإشعارات.
function proContext(userId){
  try {
    const s = db.getSubscription(userId) || {};
    const isPro = (s.status === 'active' || s.status === 'trialing') &&
                  (s.plan === 'pro' || s.plan === 'trial');
    return { isPro: !!isPro, plan: s.plan || 'free' };
  } catch (_) { return { isPro: false, plan: 'free' }; }
}


// [FIX-VIDEO-IDS] Ensures each exercise has both vid and videoId fields
// so Flutter's WorkoutExercise.fromJson() can always find the video link.
function _enrichPlanVideoIds(planObj) {
  if (!planObj || !planObj.data) return planObj;
  try {
    var days = planObj.data.days || planObj.data.schedule || planObj.data.weeks;
    if (!days) return planObj;
    var dayList = Array.isArray(days) ? days : Object.values(days);
    dayList.forEach(function(day) {
      if (!day) return;
      var exercises = day.exercises || day.items || [];
      if (!Array.isArray(exercises)) return;
      exercises.forEach(function(ex) {
        if (!ex || typeof ex !== 'object') return;
        // Ensure both vid and videoId are populated from whichever is available
        var v = ex.vid || ex.videoId || ex.videoUrl || ex.v || ex.video || '';
        if (v) {
          ex.vid = v;
          ex.videoId = v;
          ex.videoUrl = v;
        }
      });
    });
  } catch(e) {
    // Never break bootstrap for video issues
  }
  return planObj;
}

async function bootstrap(req,res){
  const u=user(req,res); if(!u)return; const today=date(new URL(req.url,'http://localhost').searchParams.get('day'));
  const p=db.mobileProfile(u.id), session=db.activeWorkoutSession(u.id), raw=db.getSubscription(u.id)||{plan:'free',status:'active'};
  const isTrial=(raw.plan==='trial')||(raw.status==='trialing');
  return sendJson(res,200,{ok:true,user:{id:u.id,email:u.email,phone:u.phone,name:u.name,verified:!!u.verified,emailVerified:!!u.verified,phoneVerified:!!u.phone_verified},
    subscription:Object.assign({},raw,{active:activeSub(raw),plan:activeSub(raw)?raw.plan:'free',isTrial:isTrial,canExport:activeSub(raw)&&!isTrial,actualDaysSinceStart:(function(){try{var tzOff=parseInt(req.headers['x-tz-offset'],10);var tzMs=Number.isFinite(tzOff)?tzOff*60000:3*3600000;var locMs=Date.now()+tzMs;var start=raw&&raw.created_at?new Date(raw.created_at).getTime():locMs;var subLocMs=start+tzMs;var subDayEnd=(Math.floor(subLocMs/86400000)+1)*86400000;var subRemain=subDayEnd-subLocMs;var effStart=(subRemain<=12*3600000)?(start+(subRemain)):(start);return Math.max(0,Math.floor((locMs-effStart)/86400000));}catch(e){return 1;}})()}),
    smartCoach:prefs.smartCoachEnabled(u.id),
    announcements: activeAnnouncements(null, proContext(u.id)),
    // إعدادات التطبيق الحيّة (صيانة، بوّابة الإصدار، مفاتيح المزايا)
    appConfig: appconfig.get(),
    features: (function(){
      const out = {};
      for (const k of ['ai_nutritionist','ai_coach']) {
        const raw = db.getFeatureFlag(k);
        out[k] = raw === null ? true : raw === '1';
      }
      return out;
    })(),
    profile:p?parse(p.profile_json,null):null,workoutPlan:_enrichPlanVideoIds(plan(db.activeWorkoutPlan(u.id))),activeSession:session?Object.assign({},session,{sets:db.workoutSets(session.id)}):null,recentSessions:db.recentWorkoutSessions(u.id,12),nutritionToday:nutrition(db.nutritionDay(u.id,today)),weights:db.recentWeights(u.id,30),measurements:db.recentMeasurements(u.id,30)});
}
async function saveProfile(req,res){
  const u=user(req,res);if(!u)return;const b=await readJsonBody(req),p=profile(b.profile||b);
  if(!p.age||!p.height||!p.weight)return sendJson(res,400,{error:'العمر والطول والوزن مطلوبين'});
  db.saveMobileProfile(u.id,JSON.stringify(p));dropCache(u.id);return sendJson(res,200,{ok:true,profile:p});
}
async function activatePlan(req,res){
  const u=user(req,res);if(!u)return;const b=await readJsonBody(req,2*1024*1024);
  if(!b.plan||typeof b.plan!=='object')return sendJson(res,400,{error:'plan_required'});
  const encoded=JSON.stringify(b.plan);if(encoded.length>1500000)return sendJson(res,413,{error:'plan_too_large'});
  // [FIX-8/9/10] منطق جدول التمرين الجديد:
  // - يوم الإنشاء دايمًا يوم راحة/تهيئة — التمرين يبدأ من التاني (Issue 8)
  // - لو المستخدم اختار أيام محددة → نحترمها (Issue 9)
  // - لو ما اختارش → customize logic من بكره (Issue 10)
  const _clientTzOffset = parseInt(req.headers['x-tz-offset'], 10);
  const _tzOffsetMs = Number.isFinite(_clientTzOffset) ? _clientTzOffset * 60000 : 3 * 3600000;
  const _nowLocal = Date.now() + _tzOffsetMs;
  const _todayStartLocal = Math.floor(_nowLocal / 86400000) * 86400000;

  const planData = b.plan;
  // selectedDays: array of JS weekday numbers [0=Sun..6=Sat] من profile المستخدم
  const _selDays = Array.isArray(planData.selectedDays || b.selectedDays)
    ? (planData.selectedDays || b.selectedDays).map(Number).filter(d => Number.isFinite(d) && d >= 0 && d <= 6)
    : null;

  let _planStartMs2;

  if (_selDays && _selDays.length > 0) {
    // ─── Case 1: User selected specific weekdays ───────────────────────────
    // إعادة بناء week كـ 7 عناصر مفهرسة بـ JS weekday (0=Sun..6=Sat)
    // Training days → على الأيام المختارة | باقي الأيام → راحة
    if (Array.isArray(planData.plan)) {
      const trainingDays = planData.plan.filter(d =>
        d && !d.isRest && Array.isArray(d.exercises) && d.exercises.length > 0
      );
      const restDay = { name: 'يوم راحة', isRest: true, exercises: [] };
      const newWeek = Array.from({length:7}, () => ({...restDay}));
      const sortedSel = _selDays.slice().sort((a,b) => a-b);
      sortedSel.forEach((wd, ti) => {
        if (ti < trainingDays.length) newWeek[wd] = trainingDays[ti];
      });
      planData.plan = newWeek;
    }
    planData.selectedDays = _selDays;

    // scheduleStartDate = أقرب أحد (JS day 0) قبل أو بعد بكره
    // بحيث daysSince(startDate) = weekday index مباشرة (0=Sun, 1=Mon ... 6=Sat)
    const tomorrowStartLocal = _todayStartLocal + 86400000;
    const tomorrowDate = new Date(tomorrowStartLocal + _tzOffsetMs);
    const tomorrowWd = tomorrowDate.getDay(); // 0=Sun..6=Sat
    const daysToSunday = tomorrowWd; // أيام من الأحد الماضي للتانيالنهارده
    const weekSundayLocal = tomorrowStartLocal - daysToSunday * 86400000;
    _planStartMs2 = weekSundayLocal - _tzOffsetMs; // UTC
  } else {
    // ─── Case 2: No selected days (customize logic) ────────────────────────
    // التمرين يبدأ دايمًا من بكره — يوم الإنشاء دايمًا راحة (Issue 8 + 10)
    _planStartMs2 = _todayStartLocal + 86400000 - _tzOffsetMs;
  }

  const _planStartDate = new Date(_planStartMs2 + _tzOffsetMs).toISOString().slice(0,10);
  planData._scheduleStartDate = _planStartDate;
  planData._scheduleStartedMs = _planStartMs2;
  // [FIX] نعيد الـ encode بعد إضافة _scheduleStartDate حتى تتحفظ في الـ database
  const encoded2 = JSON.stringify(planData);
  if(encoded2.length>1500000)return sendJson(res,413,{error:'plan_too_large'});
  const id=db.saveWorkoutPlan(u.id,String(b.key||planData.key||'custom').slice(0,80),encoded2);
  dropCache(u.id);   // الجدول اتغير يبقى يوم التمرين ممكن يكون اتغير معاه
  return sendJson(res,200,{ok:true,id,workoutPlan:_enrichPlanVideoIds(plan(db.activeWorkoutPlan(u.id))),scheduleStartDate:_planStartDate});
}
async function startSession(req,res){
  const u=user(req,res);if(!u)return;const old=db.activeWorkoutSession(u.id);
  if(old)return sendJson(res,200,{ok:true,resumed:true,session:Object.assign({},old,{sets:db.workoutSets(old.id)})});
  const b=await readJsonBody(req),dayKey=String(b.dayKey||'').trim().slice(0,100);if(!dayKey)return sendJson(res,400,{error:'day_key_required'});
  const p=db.activeWorkoutPlan(u.id);const id=db.startWorkoutSession(u.id,p&&p.id,dayKey,String(b.dayName||dayKey).slice(0,120),b.startedAt||null);
  return sendJson(res,201,{ok:true,resumed:false,session:db.workoutSession(id,u.id)});
}
async function saveSet(req,res){
  const u=user(req,res);if(!u)return;const b=await readJsonBody(req),id=Math.round(n(b.sessionId,1,1e12,0));const s=db.workoutSession(id,u.id);
  if(!s||s.status!=='active')return sendJson(res,404,{error:'active_session_not_found'});
  const exerciseKey=String(b.exerciseKey||'').trim().slice(0,160),exerciseName=String(b.exerciseName||exerciseKey).trim().slice(0,160),setNumber=Math.round(n(b.setNumber,1,30,0));
  if(!exerciseKey||!setNumber)return sendJson(res,400,{error:'invalid_set'});
  db.saveWorkoutSet({sessionId:id,exerciseKey,exerciseName,setNumber,weight:n(b.weight,0,1000,0),reps:Math.round(n(b.reps,0,1000,0)),rir:b.rir==null?null:n(b.rir,0,10,null),completed:!!b.completed});
  dropCache(u.id);   // التاريخ والتحليل اتغيرو
  return sendJson(res,200,{ok:true,sets:db.workoutSets(id)});
}
async function finishSession(req,res){
  const u=user(req,res);if(!u)return;const b=await readJsonBody(req),id=Math.round(n(b.sessionId,1,1e12,0));const s=db.workoutSession(id,u.id);
  if(!s)return sendJson(res,404,{error:'session_not_found'});
  if(s.status==='active')db.finishWorkoutSession(id,u.id,b.finishedAt||null,Math.round(n(b.durationSec,0,86400,0)),String(b.notes||'').slice(0,1000));
  dropCache(u.id);
  return sendJson(res,200,{ok:true,session:db.workoutSession(id,u.id),sets:db.workoutSets(id)});
}
async function saveNutrition(req,res){
  const u=user(req,res);if(!u)return;const b=await readJsonBody(req,2*1024*1024),d=date(b.day),meals=Array.isArray(b.meals)?b.meals.slice(0,30):[];
  db.saveNutritionDay(u.id,d,{calories:n(b.calories,0,20000,0),protein:n(b.protein,0,2000,0),carbs:n(b.carbs,0,3000,0),fat:n(b.fat,0,1000,0),waterMl:Math.round(n(b.waterMl,0,20000,0)),meals});
  dropCache(u.id);
  return sendJson(res,200,{ok:true,nutrition:nutrition(db.nutritionDay(u.id,d))});
}
async function saveWeight(req,res){
  const u=user(req,res);if(!u)return;const b=await readJsonBody(req),w=n(b.weight,30,350,0);if(!w)return sendJson(res,400,{error:'invalid_weight'});
  db.saveWeight(u.id,date(b.day),w,String(b.note||'').slice(0,300));dropCache(u.id);return sendJson(res,200,{ok:true,weights:db.recentWeights(u.id,30)});
}
async function saveMeasurement(req,res){
  const u=user(req,res);if(!u)return;const b=await readJsonBody(req),d=date(b.day);
  const value={
    waist:b.waist==null?null:n(b.waist,20,300,null),chest:b.chest==null?null:n(b.chest,20,300,null),
    hips:b.hips==null?null:n(b.hips,20,300,null),arm:b.arm==null?null:n(b.arm,10,150,null),
    thigh:b.thigh==null?null:n(b.thigh,10,200,null),bodyFat:b.bodyFat==null?null:n(b.bodyFat,2,70,null),
    note:String(b.note||'').slice(0,300)
  };
  if([value.waist,value.chest,value.hips,value.arm,value.thigh,value.bodyFat].every(function(x){return x==null;}))return sendJson(res,400,{error:'measurement_required'});
  db.saveMeasurement(u.id,d,value);
  return sendJson(res,200,{ok:true,measurements:db.recentMeasurements(u.id,30)});
}
async function foodSearch(req,res){
  const u=user(req,res);if(!u)return;
  const url=new URL(req.url,'http://localhost'),q=String(url.searchParams.get('q')||'').slice(0,80);
  const cat=String(url.searchParams.get('cat')||'all').slice(0,30),diet=String(url.searchParams.get('diet')||'balanced').slice(0,30);
  const health=String(url.searchParams.get('health')||'').split(',').filter(Boolean).slice(0,20);
  const prefs=new Map(db.foodPreferences(u.id,200).map(row=>[row.food_id,row]));
  // البحث نفسه مابيتغيرش من مستخدم لتاني: نفس الكلمة = نفس النتيجة من كتالوج الأكل.
  // اللي بيختلف هو المفضلة/عدد الاستخدام ودي بتتركّب فوق النتيجة المخزنة.
  // قبل كدا كل حرف بيكتبه أي متدرب كان بيفلتر كتالوج 2700 صنف من الأول جوّا الـ vm.
  const _fk='fs:'+cat+':'+diet+':'+health.slice().sort().join('|')+':'+q;
  let base=catalogueCache.get(_fk);
  if(!base){ base=nutritionHost.searchFoods({query:q,category:cat,diet,health}); catalogueCache.set(_fk,base); }
  const foods=base.map(food=>{
    const pref=prefs.get(String(food.id));return {...food,favorite:!!(pref&&pref.favorite),useCount:pref?pref.use_count:0,lastUsedAt:pref&&pref.last_used_at||null};
  });
  return sendJson(res,200,{ok:true,foods,count:foods.length});
}
async function foodPreferences(req,res){
  const u=user(req,res);if(!u)return;
  const rows=db.foodPreferences(u.id,100),byId=new Map(rows.map(row=>[row.food_id,row]));
  const foods=nutritionHost.foodsByIds(rows.map(row=>row.food_id)).map(food=>{
    const row=byId.get(String(food.id));return {...food,favorite:!!row.favorite,useCount:row.use_count,lastUsedAt:row.last_used_at};
  }).sort((a,b)=>(Number(b.favorite)-Number(a.favorite))||String(b.lastUsedAt||'').localeCompare(String(a.lastUsedAt||'')));
  return sendJson(res,200,{ok:true,foods,favorites:foods.filter(food=>food.favorite),recent:foods.filter(food=>food.useCount>0).sort((a,b)=>String(b.lastUsedAt||'').localeCompare(String(a.lastUsedAt||''))).slice(0,30)});
}
async function saveFoodPreference(req,res){
  const u=user(req,res);if(!u)return;const b=await readJsonBody(req),foodId=String(b.foodId||'').trim().slice(0,120);
  if(!foodId)return sendJson(res,400,{error:'food_id_required'});
  if(b.favorite!==undefined)db.setFoodFavorite(u.id,foodId,!!b.favorite);
  if(b.used===true)db.markFoodUsed(u.id,foodId);
  const row=db.foodPreferences(u.id,200).find(item=>item.food_id===foodId)||null;
  return sendJson(res,200,{ok:true,preference:row});
}
async function exerciseHistory(req,res){
  const u=user(req,res);if(!u)return;
  const url=new URL(req.url,'http://localhost'),key=String(url.searchParams.get('exerciseKey')||'').trim().slice(0,160);
  if(!key)return sendJson(res,400,{error:'exercise_key_required'});
  const sets=db.exerciseHistory(u.id,key).map(function(row){return {
    setNumber:row.set_number,weight:row.weight,reps:row.reps,rir:row.rir,completed:!!row.completed,
    loggedAt:row.logged_at,sessionId:row.session_id,dayName:row.day_name,finishedAt:row.finished_at
  };});
  let best=null;
  sets.forEach(function(set){
    const e1rm=set.weight>0&&set.reps>0?set.weight*(1+set.reps/30):0;
    if(!best||e1rm>best.e1rm)best={weight:set.weight,reps:set.reps,rir:set.rir,e1rm:Math.round(e1rm*10)/10};
  });
  /* ---- smart-coach progression (ported from the website's app/workout/ui/coach.js) ----
     The website derives the next session's load from browser state. Here we replay the
     user's real logged sets through the identical double-progression rules, so the app
     thinks exactly like the site but remembers across devices. */
  const prescription={
    name:String(url.searchParams.get('name')||key.split('|').pop()||'').slice(0,160),
    reps:String(url.searchParams.get('reps')||'8-12').slice(0,20),
    sets:n(url.searchParams.get('sets'),1,10,3)
  };
  const cycle={
    exp:['beginner','intermediate','advanced'].includes(String(url.searchParams.get('exp')))?String(url.searchParams.get('exp')):'intermediate',
    mweek:n(url.searchParams.get('mweek'),1,12,1),
    meso:n(url.searchParams.get('meso'),2,12,5)
  };
  /* one entry per session (the heaviest completed set of that day), oldest first */
  const bySession=new Map();
  sets.forEach(function(set){
    if(!(set.weight>0)||!(set.reps>0))return;
    const id=set.sessionId||set.finishedAt||set.loggedAt;
    const ts=Date.parse(set.finishedAt||set.loggedAt||'')||0;
    const prev=bySession.get(id);
    const e=set.weight*(1+set.reps/30);
    if(!prev||e>prev._e)bySession.set(id,{weight:set.weight,reps:set.reps,rir:set.rir,ts,_e:e});
  });
  const timeline=Array.from(bySession.values()).sort((a,b)=>a.ts-b.ts);
  let coach=null;
  try{
    const t=coachEngine.nextTarget(prescription,timeline,cycle);
    coach={
      suggestedWeight:t.weight, suggestedReps:t.reps, targetRir:t.rir, sets:t.sets,
      deload:t.deload, rangeLow:t.lo, rangeHigh:t.hi, increment:t.inc,
      hasBase:t.hasBase, progressions:t.prog, stall:t.stall,
      bestE1rm:t.bestE1rm, personalRecords:t.prs, loggedSessions:t.loggedSessions,
      text:coachEngine.suggestText(prescription,timeline,cycle),
      trend:coachEngine.e1rmTrend(timeline.map(x=>({exName:prescription.name,weight:x.weight,reps:x.reps,ts:x.ts})),prescription.name)
    };
  }catch(_){coach=null;}
  // بوابة المتابعة الذكية: لما تكون موقوفة السيستم مايقترحش تطوير تلقائي
  // للأحمال/التكرارات. التاريخ والأرقام القياسية بتفضل زي ما هي،
  // بس التوصية بالتطوير (coach) بتتوقف والمتدرب يعدل دوياً.
  const smartOn=prefs.smartCoachEnabled(u.id);
  if(!smartOn)coach=null;
  return sendJson(res,200,{ok:true,exerciseKey:key,sets,best,coach,smartCoach:smartOn,lastDate:sets[0]&&sets[0].finishedAt||null});
}
async function exerciseAlternatives(req,res){
  const u=user(req,res);if(!u)return;const url=new URL(req.url,'http://localhost');
  const currentName=String(url.searchParams.get('current')||'').trim().slice(0,160);
  if(!currentName)return sendJson(res,400,{error:'current_exercise_required'});
  const equipment=String(url.searchParams.get('equipment')||'gym')==='home'?'home':'gym';
  const goal=String(url.searchParams.get('goal')||'muscle').slice(0,30);
  const injuries=String(url.searchParams.get('injuries')||'').split(',').filter(Boolean).slice(0,10);
  const muscle=String(url.searchParams.get('muscle')||'').trim().slice(0,60);
  const exercises=workoutHost.exerciseAlternatives({currentName,equipment,goal,injuries,muscle});
  return sendJson(res,200,{ok:true,current:currentName,exercises,count:exercises.length});
}
async function workoutHistory(req,res){
  const u=user(req,res);if(!u)return;
  // الرد ده أتقل رد في التطبيق: تحليل كامل (حجم، ACWR، توقفات، أرقام قياسية)
  // فوق كل مجموعات آخر 60 جلسة. ومابيتغيرش إلا لما المتدرب يسجل مجموعة جديدة،
  // فمن غير كاش كنا بنعيد نفس الحساب مع كل فتح شاشة ونقفل الـ event loop لكل باقي الناس.
  const cacheKey='wh:'+u.id+':'+new Date().toISOString().slice(0,10);
  const cached=nutritionCache.get(cacheKey);
  if(cached){ res.setHeader('X-Cache','HIT'); return sendJson(res,200,cached); }
  // المجموعات بتتحمل مرة واحدة بدل استعلام لكل جلسة، وللجلسات المعروضة بس
  // مش لكل تاريخ المستخدم (كان بيقرا عشرات الألوف من الصفوف لمتدرب قديم).
  const completed=db.recentWorkoutSessions(u.id,60).filter(s=>s.status==='completed');
  const setsBySession=db.workoutSetsForSessions(completed.map(s=>s.id));
  const sessions=completed.map(session=>{
    const sets=(setsBySession.get(session.id)||[]).filter(set=>set.completed===1||set.completed===true);
    const volume=Math.round(sets.reduce((sum,set)=>sum+(Number(set.weight)||0)*(Number(set.reps)||0),0)*10)/10;
    const exerciseNames=[...new Set(sets.map(set=>set.exercise_name).filter(Boolean))];
    return {...session,sets,volume,setCount:sets.length,exerciseCount:exerciseNames.length,exerciseNames};
  });
  const totalSets=sessions.reduce((sum,session)=>sum+session.setCount,0);
  const totalVolume=Math.round(sessions.reduce((sum,session)=>sum+session.volume,0)*10)/10;
  const avgDuration=sessions.length?Math.round(sessions.reduce((sum,session)=>sum+(Number(session.duration_sec)||0),0)/sessions.length):0;
  const weekBuckets=new Map();
  for(let offset=7;offset>=0;offset--){
    const d=new Date();d.setUTCHours(0,0,0,0);const day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day-offset*7);
    weekBuckets.set(d.toISOString().slice(0,10),{week:d.toISOString().slice(0,10),sessions:0,sets:0,volume:0});
  }
  for(const session of sessions){
    const d=new Date(session.finished_at||session.started_at);if(Number.isNaN(d.getTime()))continue;
    d.setUTCHours(0,0,0,0);const day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);
    const bucket=weekBuckets.get(d.toISOString().slice(0,10));if(bucket){bucket.sessions++;bucket.sets+=session.setCount;bucket.volume=Math.round((bucket.volume+session.volume)*10)/10;}
  }
  const bestByExercise=new Map();
  sessions.forEach(session=>session.sets.forEach(set=>{
    const weight=Number(set.weight)||0,reps=Number(set.reps)||0,e1rm=Math.round(weight*(1+reps/30)*10)/10;
    const key=set.exercise_key||set.exercise_name;const old=bestByExercise.get(key);
    if(!old||e1rm>old.e1rm)bestByExercise.set(key,{exerciseKey:key,name:set.exercise_name,weight,reps,e1rm,date:session.finished_at});
  }));
  const bestLifts=[...bestByExercise.values()].filter(lift=>lift.weight>0).sort((a,b)=>b.e1rm-a.e1rm).slice(0,8);
  const names=[...new Set(sessions.flatMap(session=>session.sets.map(set=>set.exercise_name).filter(Boolean)))];
  const metadata=workoutHost.exerciseMetadata(names);
  const groupLabels={chest:'الصدر',back:'الظهر',shoulders:'الأكتاف',triceps:'الترايسبس',biceps:'البايسبس',quads:'الرجل الأمامية',hamstrings:'الرجل الخلفية',glutes:'المؤخرة',calves:'السمانة',abs:'البطن والكر',core:'البطن والكور',traps:'الترابيس',forearms:'الساعد',adductors:'العضلات الداخلية'};
  const nowTime=Date.now(),weekMs=7*86400000,muscleMap=new Map(),performance=new Map();let recentSessions=0,rirSum=0,rirCount=0;
  sessions.forEach(session=>{
    const when=Date.parse(session.finished_at||session.started_at)||0,age=nowTime-when;if(age>=0&&age<weekMs)recentSessions++;
    const bestInSession=new Map();
    session.sets.forEach(set=>{
      if(set.rir!=null&&Number.isFinite(Number(set.rir))){rirSum+=Number(set.rir);rirCount++;}
      const meta=metadata[set.exercise_name];if(meta&&age>=0&&age<weekMs*2){
        const key=meta.group||meta.muscle||'other',row=muscleMap.get(key)||{key,name:groupLabels[key]||meta.muscle||key,currentSets:0,previousSets:0};
        if(age<weekMs)row.currentSets++;else row.previousSets++;muscleMap.set(key,row);
      }
      const e1rm=(Number(set.weight)||0)*(1+(Number(set.reps)||0)/30),key=set.exercise_key||set.exercise_name;
      if(e1rm>(bestInSession.get(key)||0))bestInSession.set(key,e1rm);
    });
    bestInSession.forEach((e1rm,key)=>{const list=performance.get(key)||[];list.push({e1rm,date:when});performance.set(key,list);});
  });
  // Stall detection (Sprint 12 fix): the previous version compared the latest
  // session to the 3rd-from-last regardless of WHEN they happened, so three
  // sessions spread over three months were judged as a stall. A stall is a
  // time-bounded concept: no meaningful strength gain across a recent training
  // block. The comparison window must now sit inside the last 42 days and span
  // at least 14 days of actual training.
  const STALL_WINDOW_MS=42*86400000,STALL_MIN_SPAN_MS=14*86400000,STALL_FRESH_MS=21*86400000;
  const stalls=[];performance.forEach((rows,key)=>{
    rows.sort((a,b)=>b.date-a.date);
    const windowRows=rows.filter(r=>nowTime-r.date<=STALL_WINDOW_MS);
    if(windowRows.length<3)return;
    const latest=windowRows[0],oldest=windowRows[Math.min(windowRows.length-1,3)];
    if(nowTime-latest.date>STALL_FRESH_MS)return;
    if(latest.date-oldest.date<STALL_MIN_SPAN_MS)return;
    if(oldest.e1rm>0&&latest.e1rm<=oldest.e1rm*1.01){
      const lift=bestByExercise.get(key);
      stalls.push({exerciseKey:key,name:lift&&lift.name||key,latestE1rm:Math.round(latest.e1rm*10)/10,changePct:Math.round((latest.e1rm/oldest.e1rm-1)*1000)/10,spanDays:Math.round((latest.date-oldest.date)/86400000)});
    }
  });
  const avgRir=rirCount?Math.round(rirSum/rirCount*10)/10:null;
  let coachStatus='progressing',coachTitle='الأداء يتحرك في الاتجاه الصحيح',recommendation='استمر على نفس الخطة وطبق الزيادة التدريجية عند إكمال الحد الأعلى من التكرارات';
  if(sessions.length<3){coachStatus='building_history';coachTitle='نجمع خط أس��س لأدائك';recommendation='أكمل 3 جلسات على الأقل بنفس طريقة التسجيل حتى يصبح تحليل الثبات والإجهاد دقيقا';}
  else if((recentSessions>=5&&avgRir!=null&&avgRir<1.5)||stalls.length>=3){coachStatus='deload';coachTitle='الاستشفاء يحتاج أولوية';recommendation='خفض الأوزان 10 15% والمجموعات 30 40% لمدة أسبوع ثم ارجع تدريجيا';}
  else if(recentSessions>=5||stalls.length>0){coachStatus='watch';coachTitle='راقب الإجهاد والتقدم';recommendation=stalls.length?'ثبت الحمل في التمارين المتوقفة وحاول إضافة تكرار بجودة قبل زيادة الوزن':'حجم التدريب مرتفع هذا الأسبوع؛ حافظ على النوم واترك يوم استشفاء إضافيا عند هبوط الأداء';}
  // Sprint 12: grade real logged volume against the ORIGINAL engine's own
  // MEV / good / opt landmarks and the level-based weekly caps, instead of
  // just reporting raw set counts. Same science the planner is built on.
  const profileRow=db.mobileProfile(u.id),userProfile=profileRow?parse(profileRow.profile_json,{}):{};
  const level=['beginner','intermediate','advanced'].indexOf(String(userProfile.experience))>-1?String(userProfile.experience):'beginner';
  let standards={volume:{},caps:{}};try{standards=workoutHost.volumeStandards();}catch(_){}
  const muscleVolume=[...muscleMap.values()].map(row=>{
    const std=standards.volume[row.key]||null,capRow=standards.caps[row.key]||null,cap=capRow?Number(capRow[level]):null;
    let grade='unknown',note='';
    if(std){
      if(row.currentSets<std.mev){grade='below_mev';note='تحت الحد الأدنى الفعال ('+std.mev+'مجموعة) الحجم ده مش كافي لتحفيز نمو';}
      else if(cap&&row.currentSets>cap){grade='over_cap';note='فوق السقف الأسبوعي لمستواك ('+cap+'مجموعة) ده بيراكم إجهاد أكتر من الاستشفاء';}
      else if(row.currentSets>=std.opt){grade='optimal';note='في النطاق المثالي';}
      else if(row.currentSets>=std.good){grade='good';note='حجم جيد ومنتج';}
      else{grade='developing';note='فوق الحد الأدنى فيه مساحة للزيادة التدريجية';}
    }
    return Object.assign({},row,{mev:std?std.mev:null,good:std?std.good:null,opt:std?std.opt:null,weeklyCap:cap||null,grade,note,delta:row.currentSets-row.previousSets});
  }).sort((a,b)=>b.currentSets-a.currentSets);
  const belowMev=muscleVolume.filter(m=>m.grade==='below_mev').map(m=>m.name);
  const overCap=muscleVolume.filter(m=>m.grade==='over_cap').map(m=>m.name);
  if(overCap.length&&coachStatus!=='deload'){coachStatus='watch';coachTitle='حجم بعض العضلات فوق السقف';recommendation='قلل مجموعات'+overCap.join('، ')+'لحد السقف الأسبوعي لمستواك الزيادة فوق السقف بتاكل من الاستشفاء من غير عائد';}
  else if(belowMev.length&&coachStatus==='progressing'){coachTitle='فيه عضلات حت الحد الأدنى';recommendation='زود مجموعات'+belowMev.slice(0,3).join('، ')+'تدريجيا ل��وصول للحد الأدنى الفعال قبل ما تزود أي حاجة تانية';}
  // Scheduled deload: fatigue accumulates even without visible symptoms.
  // Standard practice is a planned light week every 6-8 weeks of hard training.
  const trainedWeeks=[...weekBuckets.values()].filter(b=>b.sessions>0).length;
  const deloadDue=trainedWeeks>=7&&coachStatus!=='deload'&&coachStatus!=='building_history';
  if(deloadDue){coachStatus='deload';coachTitle='أسبوع تخفيف مجدول';recommendation='عندك '+trainedWeeks+'أسابيع تدريب متواصلة خد أسبوع تخفيف مخطط (نفس الأوزان نص المجموعات) قبل ما الإجهاد يظهر كإصابة أو ثبات';}
  /* ---- Sprint 18: load management, ported from the website's coach.js ----
     Raw weekly tonnage on its own tells the trainee nothing. What matters is the
     RATIO between this week's load and the recent four-week average (ACWR): the
     safe band is 0.8-1.3, and a sudden spike is the single best predictor of
     overuse injury. The zone wording comes from coachEngine.acwrZone, so the app
     speaks exactly like the site. */
  const orderedWeeks=[...weekBuckets.values()];
  const acuteWeek=orderedWeeks[orderedWeeks.length-1]||{volume:0,sets:0};
  const priorWeeks=orderedWeeks.slice(0,-1).filter(b=>b.sessions>0).slice(-4);
  const chronicVolume=priorWeeks.length?priorWeeks.reduce((s,b)=>s+b.volume,0)/priorWeeks.length:0;
  const acwr=chronicVolume>0?Math.round(acuteWeek.volume/chronicVolume*100)/100:null;
  let acwrZone='',acwrNote='';
  try{
    acwrZone=coachEngine.acwrZone(acwr);
    if(acwr==null)acwrNote='محتاجين أسبوعين تدريب على الأقل قبل ما نقدر نقيس تراكم الحمل عندك';
    else if(acwr>1.5)acwrNote='حملك هذا الأسبوع أعلى بكثير من متوسط الأسابيع اللي فاتت الطفرة دي أكبر سبب للإصابات. ثبت الحجم أسبوع';
    else if(acwr<0.8)acwrNote='حملك أقل من متوسطك المعتاد لو مش أسبوع تخفيف مقصود رجع الحجم تدريجيا';
    else acwrNote='تحميلك متدرج وآمن ده بالظبط النطاق اللي بيخلي التقدم مستمر من غير إصابة';
  }catch(_){acwrZone='';}
  /* Commitment: sessions actually completed vs sessions planned across the weeks
     the trainee has been active (the website's commitment ring). */
  const plannedPerWeek=n(userProfile.trainingDays,1,7,4);
  const activeWeeks=Math.max(1,trainedWeeks);
  const commitment=Math.min(100,Math.round(sessions.length/(plannedPerWeek*activeWeeks)*100));
  const weeklyTonnage=Math.round(acuteWeek.volume);
  const previousTonnage=priorWeeks.length?Math.round(priorWeeks[priorWeeks.length-1].volume):null;
  const tonnageDeltaPct=(previousTonnage&&previousTonnage>0)?Math.round((weeklyTonnage/previousTonnage-1)*1000)/10:null;
  const load={weeklyTonnage,previousTonnage,tonnageDeltaPct,chronicTonnage:Math.round(chronicVolume),acwr,acwrZone,acwrNote,weeklySets:acuteWeek.sets,plannedPerWeek,commitment,activeWeeks};
  const coach={status:coachStatus,title:coachTitle,recommendation,recentSessions,avgRir,level,trainedWeeks,deloadScheduled:deloadDue,stalls:stalls.slice(0,8),muscleVolume,belowMev,overCap,load};
  const payload={ok:true,analytics:{totalSessions:sessions.length,totalSets,totalVolume,avgDuration},weeks:[...weekBuckets.values()],bestLifts,coach,sessions};
  nutritionCache.set(cacheKey,payload);
  return sendJson(res,200,payload);
}
// ============================================================
//  GET /api/mobile/nutrition-plan   (Sprint 12)
//  The missing brain: runs the ORIGINAL diet engine with the
//  full set of inputs it expects, then layers real-world
//  correction on top (adaptive TDEE, adherence, staleness).
// ============================================================
async function nutritionPlan(req,res){
  const u=user(req,res);if(!u)return;
  // أتقل طلب في التطبيق: بيشغّل محرك التغذية كامل جوّا vm.
  if(!rateLimit('nutrition-plan:'+u.id,15,60000))return sendJson(res,429,{error:'\u0637\u0644\u0628\u0627\u062a \u0643\u062a\u064a\u0631\u0629 \u0641\u064a \u0648\u0642\u062a \u0642\u0635\u064a\u0631 \u2014 \u0627\u0633\u062a\u0646\u0649 \u062f\u0642\u064a\u0642\u0629 \u0648\u062d\u0627\u0648\u0644 \u062a\u0627\u0646\u064a'});
  const url=new URL(req.url,'http://localhost');
  const wantPlan=url.searchParams.get('plan')!=='0';
  const row=db.mobileProfile(u.id);
  if(!row)return sendJson(res,400,{error:'profile_required'});
  const p=parse(row.profile_json,null);
  if(!p||!p.age||!p.height||!p.weight)return sendJson(res,400,{error:'profile_incomplete'});

  // كاش الرد
  // ده أتقل مسار في السيرفر لأنه بيشغل محرك كامل جوّا vm
  // المفتاح فيه وقت تعديل الملف والتاريخ عشان الخطة تتجدد لوحدها كل يوم
  // وأي كتابة تخص المستخدم بتمسح الكاش فورًا فمافيش فرصة يشوف رقم قديم
  // [EGY-v70] توقيت بلد الحساب: نحسب يوم الدورة (0..3) والتاريخ المحلي على ساعة بلد المستخدم مش القاهرة.
  // [FIX-TZ] بنستخدم UTC offset من الجهاز لو بعته لتطبيق — fallback لـIPلو مبعتش.
  const _clientTzOffset = parseInt(req.headers['x-tz-offset'], 10);
  const _tz = Number.isFinite(_clientTzOffset)
    ? { iana: 'Device', offsetMinutes: _clientTzOffset }
    : cfg.tzForCountry(cfg.countryFromReq(req));
  const _localMs=Date.now()+_tz.offsetMinutes*60000;
  // [FIX-DAY-TIERS] offset=N bisa menggeser hari: 0=hari ini, 1=besok...
  const _dayOffsetParam = parseInt(url.searchParams.get('offset') || '0', 10);
  const _safeOffset = (Number.isFinite(_dayOffsetParam) && _dayOffsetParam >= -1 && _dayOffsetParam <= 6) ? _dayOffsetParam : 0;
  // [OWNER-RULE] منع "أمس" للحسابات الجديدة (أقل من يوم كامل)
  const _u2Row = db.userById(u.id);
  const _acctCreatedMs = _u2Row && _u2Row.created_at ? new Date(_u2Row.created_at).getTime() : Date.now();
  const _acctAgeMs = Date.now() - _acctCreatedMs;
  const _hasYesterday = _acctAgeMs > 22 * 3600000; // أكثر من 22 ساعة
  if (_safeOffset < 0 && !_hasYesterday) {
    // حساب جديد — خطة أمس مافيشش
    return sendJson(res, 200, { ok: true, noYesterdayData: true, plan: null });
  }
  const _shiftedMs = _localMs + _safeOffset * 86400000;
  const _localDate = new Date(_shiftedMs).toISOString().slice(0, 10);
  // [بند 9] يوم الدورة لازم يتحرك مع اليوم المختار (الإزاحة)
  // عشان الوجبات تختلف فعلًا من يوم للتاني وماتفضلش ثابتة.
  // [بند 4] دورة 4 أيام مرتبطة بالأسبوع العربي (سبت=0). 
  // 18285 = السبت 10 يناير 2020 (تحقق السبت = يوم 0 في الدورة) — المرجع: EPOCH_SAT_JAN4_2020 = 18265.
  const _EPOCH_SAT_REF = 18265; // السبت 4 يناير 2020 — سبت مؤكد
  const _daysSinceEpoch = Math.floor(_shiftedMs / 86400000);
  // أوفست يجعل السبت = يوم 0 في الدورة (0..3) — التنوع الحقيقي كل سبت يبدأ من جديد
  const _dayOfCycle = ((_daysSinceEpoch - _EPOCH_SAT_REF) % 4 + 4) % 4;
  const _ck='np:'+u.id+':'+(wantPlan?'1':'0')+':'+String(row.updated_at||'')+':'+_localDate+':d'+_dayOfCycle;
  const _hit=nutritionCache.get(_ck);
  if(_hit){
    res.setHeader('X-Cache','HIT');
    return sendJson(res,200,gateNutritionPayload(u.id,_hit));   // [FIX C1]
  }

  const weights=db.recentWeights(u.id,120);
  const history=db.nutritionHistory(u.id,120);
  const measurements=db.recentMeasurements(u.id,30);
  const latestMeasure=measurements&&measurements.length?measurements[0]:{};

  // Use the freshest logged weight rather than the stale onboarding value.
  const livingProfile=Object.assign({},p);
  if(weights&&weights.length&&Number(weights[0].weight)>0)livingProfile.weight=Number(weights[0].weight);

  const ctx=bridge.buildEngineContext(livingProfile,{
    steps:p.steps,cardioSessions:p.cardioSessions,cardioIntensity:p.cardioIntensity,
    weeklyRate:p.weeklyRate,
    bodyFat:p.bodyFat!=null?p.bodyFat:latestMeasure.body_fat,
    waist:p.waist!=null?p.waist:latestMeasure.waist,
    neck:p.neck,hips:p.hips!=null?p.hips:latestMeasure.hips
  });

  // [EGY-v70] احقن يوم الدورة + رقم الأسبوع في مدخلات المحرك (تنويع يومي دورة 4 أيام + إزاحة أسبوعية).
  const _startedAt=row.created_at||row.updated_at||null;
  // [بند 3+4] قاعدة الـ12 ساعة للتغذية:
  // لو المستخدم اشترك قبل نهاية اليوم بـ12 ساعة أو أقل → اليوم الفعلي الأول هو اليوم التالي.
  // ده بيمنع عرض "أمس" قبل ما يكون فيه يوم فعلي في الخطة.
  let _effectiveStartMs = _startedAt ? new Date(_startedAt).getTime() : _localMs;
  if (_startedAt) {
    const _subLocalMs = new Date(_startedAt).getTime() + _tz.offsetMinutes * 60000;
    const _subDayStartLocal = Math.floor(_subLocalMs / 86400000) * 86400000;
    const _subDayEndLocal = _subDayStartLocal + 86400000;
    const _subRemainingMs = _subDayEndLocal - _subLocalMs;
    const _TWELVE_HOURS_MS = 12 * 3600000;
    if (_subRemainingMs <= _TWELVE_HOURS_MS) {
      // بدأ الاشتراك في النصف الأخير من اليوم → اليوم الفعلي من اليوم التالي
      _effectiveStartMs = (_subDayStartLocal + 86400000 - _tz.offsetMinutes * 60000);
    }
  }
  const _engineWeek=_startedAt?Math.max(1,Math.floor((_localMs-_effectiveStartMs)/604800000)+1):1;
  // عدد الأيام الفعلية من بداية الاشتراك — يُستخدم لإخفاء "أمس" لو مفيش يوم سابق فعلي
  const _actualDaysSinceStart = _startedAt ? Math.floor((_localMs - _effectiveStartMs) / 86400000) : 0;
  if(ctx.inputs){ ctx.inputs['inp-week']=_engineWeek; ctx.inputs.dayOfCycle=_dayOfCycle; }

  // ── The pantry decides WHICH foods land on the plate ────────────────────
  // Until now this was never sent, so DE.availableFoods stayed empty and the
  // engine took its "لم يتم اختيار أطعمة" safety path on every single request.
  const pantry=bridge.resolvePantry(p,db.foodPreferences(u.id,400));
  if(pantry.ids&&pantry.ids.length)ctx.inputs.availableFoods=pantry.ids;

  // يوم التمرين الحقيقي
  // قبل كده كنا بنوزع عدد أيام التمرين بالتساوي على الأسبوع وده تخمين
  // بيخلي وجبة قبل التمرين تظهر في يوم راحة وتغيب في يوم تمرين
  // دلوقتي بنقرا الجدول المفعل نفسه ونشوف يوم النهارده تمرين ولا راحة
  // الجدول المفعل هو المرجع الأول: لو ��رانا منه اليوم تمرين ولا راحة
  // بنأخده وخلاص. قبل كده كنا بنتخطى ده لو الفلاج جاي من تخمين التوزيع
  // المتساوي، فوجبة قبل التمرين كانت بتظهر في يوم راحة وتغيب يوم التمرين.
  const _trFromPlan=trainingDayFromPlan(u.id);
  const _isTrainToday=(_trFromPlan!==null)
    ? _trFromPlan
    : ((typeof p.isTrainingDay==='boolean')?p.isTrainingDay:isTrainingToday(p.trainingDays));
  ctx.profile.isTrainingDay=_isTrainToday;
  if(ctx.inputs)ctx.inputs.isTrainingDay=_isTrainToday;

  let computed;
  try{
    computed=wantPlan
      ? nutritionHost.computeMealPlan(ctx.profile,ctx.inputs)
      : {targets:nutritionHost.computeTargets(ctx.profile,ctx.inputs),plan:null};
  }catch(e){
    // Sprint 15: the engine now REFUSES impossible bodies instead of quietly
    // returning a zero-protein plan. A refusal is the user's data being
    // incomplete, not a server crash, so it must read like guidance and carry
    // 422 (fix your input) rather than 500 (we broke).
    const raw=String(e&&e.message||e);
    const code=raw.split(':')[0];
    const GUIDE={
      engine_missing_age:'\u0645\u062d\u062a\u0627\u062c\u064a\u0646 \u0639\u0645\u0631\u0643 \u0639\u0634\u0627\u0646 \u0646\u062d\u0633\u0628 \u0627\u062d\u062a\u064a\u0627\u062c\u0643 \u0628\u062f\u0642\u0629 \u2014 \u0627\u0643\u0645\u0644 \u0628\u064a\u0627\u0646\u0627\u062a\u0643 \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629.',
      engine_missing_height:'\u0645\u062d\u062a\u0627\u062c\u064a\u0646 \u0637\u0648\u0644\u0643 \u0628\u0627\u0644\u0633\u0646\u062a\u064a\u0645\u062a\u0631 \u0639\u0634\u0627\u0646 \u0646\u062d\u0633\u0628 \u0645\u0639\u062f\u0644 \u0627\u0644\u0623\u064a\u0636 \u0627\u0644\u0623\u0633\u0627\u0633\u064a.',
      engine_missing_weight:'\u0645\u062d\u062a\u0627\u062c\u064a\u0646 \u0648\u0632\u0646\u0643 \u0627\u0644\u062d\u0627\u0644\u064a \u0628\u0627\u0644\u0643\u064a\u0644\u0648 \u0639\u0634\u0627\u0646 \u0646\u0628\u0646\u064a \u062e\u0637\u0629 \u0635\u062d\u064a\u062d\u0629.',
      engine_implausible_age:'\u0627\u0644\u0639\u0645\u0631 \u0627\u0644\u0645\u0643\u062a\u0648\u0628 \u063a\u064a\u0631 \u0645\u0646\u0637\u0642\u064a \u2014 \u0631\u0627\u062c\u0639\u0647 \u0645\u0646 \u0641\u0636\u0644\u0643.',
      engine_implausible_height:'\u0627\u0644\u0637\u0648\u0644 \u0627\u0644\u0645\u0643\u062a\u0648\u0628 \u063a\u064a\u0631 \u0645\u0646\u0637\u0642\u064a \u2014 \u0627\u0643\u062a\u0628\u0647 \u0628\u0627\u0644\u0633\u0646\u062a\u064a\u0645\u062a\u0631 (\u0645\u062b\u0627\u0644: 178).',
      engine_implausible_weight:'\u0627\u0644\u0648\u0632\u0646 \u0627\u0644\u0645\u0643\u062a\u0648\u0628 \u063a\u064a\u0631 \u0645\u0646\u0637\u0642\u064a \u2014 \u0627\u0643\u062a\u0628\u0647 \u0628\u0627\u0644\u0643\u064a\u0644\u0648\u062c\u0631\u0627\u0645.',
      engine_implausible_target:'\u0648\u0632\u0646 \u0627\u0644\u0647\u062f\u0641 \u063a\u064a\u0631 \u0645\u0646\u0637\u0642\u064a \u2014 \u0631\u0627\u062c\u0639\u0647 \u0645\u0646 \u0641\u0636\u0644\u0643.',
      engine_zero_protein:'\u0628\u064a\u0627\u0646\u0627\u062a\u0643 \u0646\u0627\u0642\u0635\u0629 \u0641\u0645\u0627 \u0642\u062f\u0631\u0646\u0627\u0634 \u0646\u062d\u062f\u062f \u0627\u0644\u0628\u0631\u0648\u062a\u064a\u0646 \u0627\u0644\u0645\u0646\u0627\u0633\u0628 \u2014 \u0627\u0643\u0645\u0644 \u0645\u0644\u0641\u0643 \u0648\u062d\u0627\u0648\u0644 \u062a\u0627\u0646\u064a.',
      engine_implausible_bmr:'\u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0645\u062f\u062e\u0644\u0629 \u0645\u0634 \u0645\u062a\u0633\u0642\u0629 \u2014 \u0631\u0627\u062c\u0639 \u0627\u0644\u0637\u0648\u0644 \u0648\u0627\u0644\u0648\u0632\u0646 \u0648\u0627\u0644\u0639\u0645\u0631.',
      engine_implausible_tdee:'\u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0645\u062f\u062e\u0644\u0629 \u0645\u0634 \u0645\u062a\u0633\u0642\u0629 \u2014 \u0631\u0627\u062c\u0639 \u0646\u0634\u0627\u0637\u0643 \u0627\u0644\u064a\u0648\u0645\u064a.',
      engine_target_exceeds_tdee:'\u0641\u064a\u0647 \u062a\u0646\u0627\u0642\u0636 \u0628\u064a\u0646 \u0628\u064a\u0627\u0646\u0627\u062a\u0643 \u2014 \u0631\u0627\u062c\u0639 \u0627\u0644\u0648\u0632\u0646 \u0648\u0627\u0644\u0646\u0634\u0627\u0637 \u0648\u0627\u0644\u0647\u062f\u0641.'
    };
    if(GUIDE[code]){
      return sendJson(res,422,{error:'profile_incomplete',code:code,message:GUIDE[code]});
    }
    return sendJson(res,500,{error:'engine_failed',detail:raw.slice(0,200)});
  }

  const targets=computed.targets||{};
  const adaptive=bridge.adaptiveTdee(history,weights,targets.tdee);
  const adherenceReport=bridge.adherence(history,targets,14);
  const staleness=bridge.planStaleness(p.weight,weights,row.updated_at);

  // [OWNER-RULE] الذكاء مايقفش لو مفيش داتا.
  // قبل كده: مفيش تسجل ← adherencePct=0 ← plateauStatus='collecting' ← الخطة
  // ماتتحركش أبدًا. دلوقتي بنرجع لرد المتدرب على سؤال الالتزام،
  // مع تمييز المصدر (logged مقابل self_reported) عشان ماندّعيش دقة مفيشش.
  const _loggedDays=(history||[]).length;
  const _adh=selfReport.resolveAdherence({
    userId:u.id,
    scope:'nutrition',
    loggedPct:(adherenceReport&&adherenceReport.pct)||0,
    loggedDays:_loggedDays
  });
  // موعد تغيير الخطة = الخطة بقى لها أسبوع أو الوزن بعيد عن خطة الملف.
  const _planDue=!!(staleness&&(staleness.stale||staleness.due));
  const _checkin=selfReport.due({
    userId:u.id,scope:'nutrition',loggedDays:_loggedDays,planDue:_planDue
  })
    ? selfReport.question({scope:'nutrition',targetCals:(targets&&targets.targetCals)||0})
    : null;

  // ── Periodisation: the plan that changes by itself ─────────────────────
  // Same brain the website's smart-coach dashboard runs: which week of the
  // cycle we are in, whether today is a refeed / training / rest day, and
  // whether the numbers should move at all this week. Read-only advice - we
  // never silently overwrite the engine's target.
  let periodization=null;
  try{
    const maint=(adaptive&&adaptive.status==='ready'&&adaptive.recommendedTdee)
      ? adaptive.recommendedTdee
      : (targets.tdee||Math.round((targets.targetCals||0)*1.18));
    const wLogs=(weights||[]).map(function(w){
      return {date:w.date||w.logged_at||w.at,weight:Number(w.weight||w.kg||0)};
    }).filter(function(w){return w.date&&w.weight>0;});
    const startedAt=row.created_at||row.updated_at||null;
    const week=startedAt
      ? Math.max(1,Math.floor((Date.now()-new Date(startedAt).getTime())/604800000)+1)
      : 1;
    const isTrainingDay=(typeof p.isTrainingDay==='boolean')
      ? p.isTrainingDay
      : isTrainingToday(p.trainingDays);
    const common={
      goal:p.goal||'cut',
      targetCals:targets.targetCals||0,
      maintenanceCals:maint,
      macros:targets.macros||{},
      weights:wLogs,
      weight:p.weight,
      planWeight:p.weight,
      // الداتا المسجّلة لها الأولوية دايمًا؛ لو مفيش داتا بنستعمل رد المتدرب
      // على سؤال الالتزام عشان الخطة تتقدم بدل ما تتجمد في collecting.
      adherencePct:_adh.pct,
      adherenceSource:_adh.source,
      loggedDays:(history||[]).length,
      calorieFloor:(targets.ageRules&&targets.ageRules.calorieFloor)||1200
    };
    const phase=periodizer.phaseForWeek(week,common);
    const today=periodizer.dayTarget(Object.assign({},common,{
      week:week,date:new Date(),isTrainingDay:isTrainingDay
    }));
    const adjust=periodizer.autoAdjust(Object.assign({},common,{week:week}));

    // خط أساس الخطوات: لو المتدرّب سجّل رقم وقت إنشاء الخطة نقارن بيه؛
    // غير كده مافيش مقارنة أصلًا وممنوع ندّعي إن حركته قلّت.
    const stepsBaseline=(function(){
      const b=Number(p.stepsBaseline);
      return Number.isFinite(b)&&b>0?b:null;
    })();

    // ليه وقف التقدّم؟ قبل ما نقرّر نقّل أكل، نسأل السؤال ده الأول.
    // ملاحظة: البروفايل بيخزّن النوم والضغط كـ strings ('poor'/'high')، فلازم
    // نترجمهم لأرقام وإلا الإشارتين بيمووا في صمت.
    const diagnosis=plateauDx.diagnose(Object.assign({},common,{
      windowDays:21,
      dietWeeks:week,
      sleepHours:(bridge.SLEEP_HOURS&&bridge.SLEEP_HOURS[String(p.sleep)])||null,
      stress:({low:2,mid:3,high:5})[String(p.stress)]||null,
      stepsNow:p.steps,
      stepsBaseline:stepsBaseline,
      tonnageDeltaPct:null,
      avgRir:null
    }));

    // قفل أمان: لو السبب الرئيسي مش الأكل نفسه، ممنوع نقص السعرات.
    // تقليل الأكل لواحد مش بيسجّل، أو خطواته نزلت، أو نايم 5 ساعات —
    // ده بيزوّد المشكلة مش بيحلها.
    const noCutCauses=['underreport','adherence','water','neat','sleep','dietfatigue'];
    let finalAdjust=adjust;
    if(diagnosis&&diagnosis.stalled&&diagnosis.primary&&adjust&&adjust.action==='decrease'
       &&noCutCauses.indexOf(diagnosis.primary.key)>-1){
      finalAdjust=Object.assign({},adjust,{
        action:'hold',
        suggestedCals:adjust.currentCals,
        deltaCals:0,
        blockedBy:diagnosis.primary.key,
        reason:diagnosis.primary.actionAr
      });
    }

    periodization={week:week,phase:phase,today:today,adjustment:finalAdjust,diagnosis:diagnosis};
  }catch(e){ periodization={error:String(e&&e.message||e)}; }

  // بوابة المتابعة الذكية — التغذية:
  // لما المتدرب يقفل المتابعة الذكية، السيستم مايعدلش السعرات؊
  // والوجبات تلقائياً: الخطة الحالية تفضل زي ما هي، التوصية
  // بزيادة/تقليل السعرات تتحول لـ hold، والهدف التكيفي بيتوقف.
  const _smartOn=prefs.smartCoachEnabled(u.id);
  if(!_smartOn){
    if(periodization&&periodization.adjustment){
      periodization.adjustment=Object.assign({},periodization.adjustment,{
        action:'hold',
        suggestedCals:periodization.adjustment.currentCals!=null?periodization.adjustment.currentCals:(targets.targetCals||0),
        deltaCals:0,
        blockedBy:'smart_coach_off',
        reason:'المتابعة الذكية موقوفة — خطتك ثابتة ومفيش تعديل تلقائي'
      });
    }
    if(periodization)periodization.smartCoach=false;
  }else if(periodization){ periodization.smartCoach=true; }

  // If the observation is solid, show what the target WOULD be using the
  // measured TDEE instead of the formula estimate. We never silently
  // overwrite the engine's number, we surface it as a recommendation.
  let adaptiveTarget=null;
  if(adaptive.status==='ready'&&targets.tdee>0&&targets.targetCals>0){
    const ratio=targets.targetCals/targets.tdee;
    adaptiveTarget=Math.round(adaptive.recommendedTdee*ratio);
  }

  return sendJson(res,200,gateNutritionPayload(u.id,nutritionCache.set(_ck,{   // [FIX C1]
    ok:true,
    targets,
    plan:computed.plan||null,
    engineInputs:ctx.derived,
    // Told plainly so the app can show the user which pantry built this plan
    // and nudge them when their selection was too small to honour.
    pantry:{
      source:pantry.source,
      selectedCount:pantry.count,
      usedCount:computed.pantrySize!=null?computed.pantrySize:null,
      minimum:pantry.min!=null?pantry.min:bridge.MIN_PANTRY
    },
    adaptive:Object.assign({},adaptive,{adaptiveTargetCals:_smartOn?adaptiveTarget:null}),
    adherence:Object.assign({},adherenceReport,{
      resolvedPct:_adh.pct,
      source:_adh.source,
      confidence:_adh.confidence
    }),
    // لو موعد تغيير الخطة جه ومفيش داتا���� التطبيق هيعرض السؤال ده.
    checkin:_checkin,
    staleness,
    smartCoach:_smartOn,
    periodization,
    timezone:_tz.iana,
    dayOfCycle:_dayOfCycle
  })));
}

// ---- سؤال الالتزام (الذكاء بدون داتا مسجّلة) ----
async function checkinSubmit(req,res){
  const u=auth.currentUser(parseCookies(req));
  if(!u) return sendJson(res,401,{error:'محتاجين تسجل دخول الأول'});
  if(!rateLimit('checkin:'+u.id,20,60000))
    return sendJson(res,429,{error:'طلبات كتيرة — استنى شوية'});
  const b=await readJsonBody(req)||{};
  const saved=selfReport.record(u.id,b.scope,b.answer,b.askedFor);
  if(!saved) return sendJson(res,400,{error:'رد غير مفهوم — اختار من الإجابات المتاحة'});
  // الرد غيّر مدخلات الخطة، فلازم الكا�� يموت عشان يشوف المرحلة الجديدة فورًا.
  try{ nutritionCache.clear&&nutritionCache.clear(); }catch(_e){}
  return sendJson(res,200,{ok:true,checkin:saved,
    message:'تمام — مشيت خطتك للمرحلة اللي بعدها على أساس ردك'});
}
// ── الوحدات المساعدة ──────────────────────────────────────
// The engine has always carried real exercises for every helper unit, but the
// catalogue was never exposed over HTTP, so the app could only ever show
// on/off switches. This endpoint publishes it so a unit becomes something you
// can actually open and perform.
//
// Note on keys: the picker vocabulary (warmup/stretch/breath/recovery) is not
// the catalogue vocabulary (mobility/stretching/breathing/recovery). We map
// here rather than making the app guess.
// الإحماء والإطالة اتشالوا من هنا بطلب صاحب المشروع
// هما أساسيين جوا ا��ج����ول نفسه مش وحدات اختيارية
const UNIT_SOURCE={
  core:'core',
  cardio:'cardio',
  yoga:'yoga',
  breath:'breathing',
  recovery:'recovery',
  kegel:'kegel'
};
const UNIT_LABEL={
  core:'الكور',
  cardio:'الكارديو',
  yoga:'اليوجا',
  breath:"التنفس",
  recovery:'التعافي',
  kegel:'الكيجل'
};
// Roughly how long one honest pass through the unit takes, in minutes.
const UNIT_MINUTES={core:12,cardio:20,yoga:15,breath:5,recovery:10,kegel:5};

function unitItem(raw){
  if(!raw||typeof raw!=='object')return null;
  const name=String(raw.n||'').trim();
  if(!name)return null;
  return {
    name:name,
    desc:String(raw.desc||'').trim(),
    // cardio entries carry "protocol" where the others carry "duration"
    duration:String(raw.duration||raw.protocol||'').trim(),
    videoId:String(raw.vid||'').trim(),
    equipment:String(raw.equipment||'').trim(),
    fatigue:String(raw.fatigue||'').trim(),
    tier:String(raw.tier||'').trim()
  };
}

// cardio is nested by intensity tier (s/a/b); everything else is a flat list.
function flattenUnit(node){
  const out=[];
  if(Array.isArray(node)){
    node.forEach(function(x){const i=unitItem(x);if(i)out.push(i);});
    return out;
  }
  if(node&&typeof node==='object'){
    Object.keys(node).forEach(function(k){
      const v=node[k];
      if(Array.isArray(v))v.forEach(function(x){const i=unitItem(x);if(i)out.push(i);});
    });
  }
  return out;
}

/* ---------------------------------------------------------------------------
   GET /api/app/version  (PUBLIC - no auth, no profile)

   Without this the store build is final: if a shipped release turns out to
   corrupt data or point at a dead endpoint, there is no way to stop people
   using it. The app asks on every cold start and compares its own build
   number, so a bad release can be retired from the server in seconds.

   EF_MIN_BUILD   -> below this the app BLOCKS and demands an update.
   EF_LATEST_BUILD-> below this the app SUGGESTS an update (dismissible).
   Both default to 0, i.e. the gate is dormant until you deliberately set it.
--------------------------------------------------------------------------- */
async function appVersion(req,res){
  // بوّابة الإصدار بتجي من لوحة الأدمن الأول، ومتغيرات البيئة تفضل fallback
  // (التفاصيل جوّا appconfig.versionGate). كده صاحب التطبيق يقدر يوقف نسخة
  // مكسورة من اللوحة من غير وصول للسيرفر.
  const gate=appconfig.versionGate();
  const c=appconfig.get();
  return sendJson(res,200,{
    ok:true,
    minBuild:gate.minBuild,
    latestBuild:gate.latestBuild,
    storeUrl:gate.storeUrl,
    message:gate.message,
    // الصيانة: التطبيق بيقرأ ده في UpdateGate.check() وبيورّي شاشة صيانة
    // بدل شاشة التحديث (مفيش زر متجر، لأن مفيش تحديث يحل الموضوع).
    maintenance:!!c.maintenance,
    maintenanceTitle:String(c.maintenanceTitle||''),
    maintenanceMessage:String(c.maintenanceMessage||''),
    // Never let a stale gate answer be cached by a proxy.
    ts:Date.now(),
  });
}

async function modules(req,res){
  const u=user(req,res);if(!u)return;
  if(!rateLimit('modules:'+u.id,30,60000))return sendJson(res,429,{error:'\u0637\u0644\u0628\u0627\u062a \u0643\u062a\u064a\u0631\u0629 \u2014 \u0627\u0633\u062a\u0646\u0649 \u0634\u0648\u064a\u0629'});
  let catalog={};
  try{ catalog=workoutHost.moduleCatalog()||{}; }
  catch(e){ return sendJson(res,500,{error:'catalog_unavailable',detail:String(e&&e.message||e)}); }

  let active=[];
  try{
    const saved=db.mobileProfile(u.id);
    const prof=saved&&saved.profile?saved.profile:{};
    active=Array.isArray(prof.activeModules)?prof.activeModules.map(String):[];
  }catch(_){ active=[]; }

  const units=Object.keys(UNIT_SOURCE).map(function(key){
    const exercises=flattenUnit(catalog[UNIT_SOURCE[key]]);
    return {
      key:key,
      label:UNIT_LABEL[key]||key,
      minutes:UNIT_MINUTES[key]||10,
      active:active.indexOf(key)>-1,
      exerciseCount:exercises.length,
      exercises:exercises
    };
  });
  // [FIX C1] كتالوج التمارين (57 تمرين بفيديوهاته) محتوى مدفوع.
  // غير المشترك بيشوف الوحدات وعدد تمارين كل وحدة (عشان يعرف بيشتري إيه)
  // لكن مابياخدش التمارين ولا معرفات الفيديو.
  if(!userSubActive(u.id)){
    return sendJson(res,200,{
      ok:true,
      locked:true,
      lockedReason:'subscription_required',
      units:units.map(function(unit){
        return {key:unit.key,label:unit.label,minutes:unit.minutes,active:unit.active,exerciseCount:unit.exerciseCount,exercises:[]};
      })
    });
  }
  return sendJson(res,200,{ok:true,locked:false,units:units});
}

async function clientEvent(req,res){
  const u=user(req,res);if(!u)return;
  if(!rateLimit('client-event:'+u.id,20,60000))return sendJson(res,429,{error:'too_many_events'});
  const b=await readJsonBody(req,128*1024),type=String(b.type||'error').trim().slice(0,40),message=String(b.message||'').trim().slice(0,2000);
  if(!message)return sendJson(res,400,{error:'message_required'});
  db.saveClientEvent(u.id,{type,message,stack:String(b.stack||'').slice(0,12000),appVersion:String(b.appVersion||'').slice(0,40)});
  return sendJson(res,201,{ok:true});
}
// تبليغ فيديو مش شغال
// زرار صغير جوا مشغل الفيديو والبلاغ بيدخل طابور صاحب المشروع فورا
// محدود بمعدل عشان محدش يقدر يغرق الطابور
async function reportVideo(req,res){
  const u=user(req,res);if(!u)return;
  if(!rateLimit('video-report:'+u.id,10,60000))return sendJson(res,429,{error:'\u0628\u0644\u0627\u063a\u0627\u062a \u0643\u062a\u064a\u0631\u0629 \u0641\u064a \u0648\u0642\u062a \u0642\u0635\u064a\u0631'});
  const b=await readJsonBody(req,32*1024);
  const key=String(b.exerciseKey||'').trim().slice(0,160);
  if(!key)return sendJson(res,400,{error:'exercise_key_required'});
  const id=db.reportVideo({
    exerciseKey:key,
    exerciseName:String(b.exerciseName||'').slice(0,160),
    videoId:String(b.videoId||'').slice(0,40),
    reason:String(b.reason||'').slice(0,300),
    userId:u.id
  });
  let waNumber='';
  try{ waNumber=(cfg.publicConfig().support||{}).whatsapp||''; }catch(_){}
  return sendJson(res,201,{ok:true,id:id,whatsapp:waNumber});
}

// GET/PUT /api/mobile/smart-coach — تشغيل/إيقاف المتابعة الذكية
// الزر في حساب المستخدم بيتحكم فعلياً في التطوير التلقائي للتمرين والتغذية.
async function smartCoachGet(req,res){
  const u=user(req,res);if(!u)return;
  return sendJson(res,200,{ok:true,enabled:prefs.smartCoachEnabled(u.id)});
}
async function smartCoachSet(req,res){
  const u=user(req,res);if(!u)return;
  const b=await readJsonBody(req,4*1024);
  const enabled=!!(b&&(b.enabled===true||b.enabled==='true'||b.enabled===1));
  const val=prefs.setSmartCoach(u.id,enabled);
  // مسح الكاش عشان الخطة تتحسب تاني بالحالة الجديدة (تقف/تشغيل التعديل التلقائي).
  dropCache(u.id);
  return sendJson(res,200,{ok:true,enabled:val});
}

// [REDEPLOY-FIX-v3.0-2026] POST /api/mobile/trial/start — تفعيل تجربة 3 أيام مجانًا مباشرة.
// [FIX] لا يوجد أي طلب لرقم الهاتف — التفعيل يتم بمجرد الضغط بدون أي بيانات.
async function startTrial(req,res,ip){
  const u=user(req,res);if(!u)return;
  if(!rateLimit('trial:'+ip,10,3600000))return sendJson(res,429,{error:'محاولات كتيرة جرب بعد شوية'});
  // [FIX] بنقرا deviceId (اختياري) عشان نمنع تكرار التجربة على نفس الجهاز.
  let deviceId='';
  try{ const b=await readJsonBody(req,4*1024); deviceId=String((b&&b.deviceId)||'').slice(0,128); }catch(_){}
  // [FIX] التجربة مرة واحدة للأبد: حساب أو هاتف أو إيميل أو جهاز.
  // [FIX] Only block by userId — phone/email/device dedup is too strict and blocks
  // legitimate users on fresh installs or new accounts on the same device.
  // [FIX-16] بنعتمد على commerce.startTrial للـ dedup — مش على prefs.trialUsedBy
  // prefs.trialUsedBy بيبلوك حتى لو التجربة انتهت — ده الـ root cause
  const r=commerce.startTrial(u.id,3);
  if(!r||!r.ok){
    const errMsg=r&&r.error?String(r.error):'';
    const display=errMsg&&!errMsg.includes('_')&&errMsg.length<120?errMsg:'التجربة غير متاحة دلوقتي، تواصل مع الدعم';
    return sendJson(res,409,{error:display});
  }
  try{ prefs.recordTrial(u.id,u.phone,r.current_period_end,{email:u.email,deviceId:deviceId}); }catch(_){}
  try{ db.audit(u.id,'trial_started',ip); }catch(_){}
  try{ db.syncNow(); }catch(_){}
  dropCache(u.id);
  return sendJson(res,201,{ok:true,trial:r});
}

// تاريخ مقسوم على صفحات
// قبل كدا أي شاشة تاريخ كانت لازم تسحب كل الصفوف
// دلوقتي بتسحب دفعة واللي وراها بيجي وقت ما المستخدم ينزل فعلا
async function history(req,res){
  const u=user(req,res);if(!u)return;
  if(!rateLimit('history:'+u.id,60,60000))return sendJson(res,429,{error:'\u0637\u0644\u0628\u0627\u062a \u0643\u062a\u064a\u0631\u0629 \u0641\u064a \u0648\u0642\u062a \u0642\u0635\u064a\u0631'});
  const url=new URL(req.url,'http://x');
  const kind=String(url.searchParams.get('kind')||'weights');
  const limit=Number(url.searchParams.get('limit'))||30;
  const offset=Number(url.searchParams.get('offset'))||0;
  const readers={
    weights:()=>db.weightsPage(u.id,limit,offset),
    measurements:()=>db.measurementsPage(u.id,limit,offset),
    nutrition:()=>db.nutritionPage(u.id,limit,offset),
    sessions:()=>db.workoutSessionsPage(u.id,limit,offset)
  };
  const reader=readers[kind];
  if(!reader)return sendJson(res,400,{error:'unknown_kind'});
  const page=reader();
  return sendJson(res,200,{ok:true,kind:kind,rows:page.rows,total:page.total,limit:page.limit,offset:page.offset,hasMore:page.hasMore});
}


// POST /api/mobile/nutrition/override — يحفظ تعديل المستخدم على خطة التغذية
// المستخدم يقدر يبدل أكل في وجبة، ويحفظ المحرك التعديل ده، ويحترمها في خطط المستقبل
async function saveMealOverride(req,res){
  const u=auth.currentUser(parseCookies(req));
  if(!u)return sendJson(res,401,{error:"unauthenticated"});
  const b=await readJsonBody(req);
  // b = { date, slot, originalFoodId, replacementFoodId, reason }
  const date=String(b.date||'').slice(0,10)||new Date().toISOString().slice(0,10);
  const slot=String(b.slot||'')
  const origId=String(b.originalFoodId||'')
  const replId=String(b.replacementFoodId||'')
  if(!slot||!origId||!replId)return sendJson(res,400,{error:'slot+originalFoodId+replacementFoodId required'});
  // Store in nutrition_overrides table (created on first use)
  db.db.exec(`CREATE TABLE IF NOT EXISTS nutrition_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    override_date TEXT NOT NULL,
    slot TEXT NOT NULL,
    original_food_id TEXT NOT NULL,
    replacement_food_id TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL
  )`);
  db.db.prepare(`INSERT INTO nutrition_overrides
    (user_id,override_date,slot,original_food_id,replacement_food_id,reason,created_at)
    VALUES(?,?,?,?,?,?,?)`).run(
      u.id, date, slot, origId, replId,
      String(b.reason||'').slice(0,200),
      new Date().toISOString()
    );
  db.audit(u.id,'meal_override:'+slot,null);
  return sendJson(res,200,{ok:true,override:{date,slot,originalFoodId:origId,replacementFoodId:replId}});
}

// GET /api/mobile/nutrition/overrides?date=YYYY-MM-DD — يرجع تعديلات يوم معين
async function getMealOverrides(req,res){
  const u=auth.currentUser(parseCookies(req));
  if(!u)return sendJson(res,401,{error:"unauthenticated"});
  const url=new URL('http://x'+req.url);
  const date=url.searchParams.get('date')||''
  try{
    const rows=db.db.prepare(
      `SELECT * FROM nutrition_overrides WHERE user_id=? AND override_date=? ORDER BY id`
    ).all(u.id,date);
    return sendJson(res,200,{overrides:rows});
  }catch(_){
    return sendJson(res,200,{overrides:[]});
  }
}

async function getNotifications(req,res){
  const u=user(req,res); if(!u)return;
  const now=Date.now();
  const all=(settings.getJSON('admin_notifications',[])||[]);
  const items=all.filter(function(n){
    if(!n||!n.title)return false;
    if(n.target&&n.target!=='all'&&String(n.target)!==String(u.id))return false;
    if(n.expires_at&&Date.parse(n.expires_at)<now)return false;
    return true;
  }).slice(0,10);
  return sendJson(res,200,{ok:true,items:items});
}

/* ============================================================
   سجل أجهزة الإشعارات + إعدادات التطبيق الحيّة
   ============================================================ */

// التطبيق بيبعت توكن الجهاز هنا عشان الأدمن يقدر يبعتله إشعار.
async function registerDevice(req,res){
  const u=user(req,res); if(!u)return;
  if(!rateLimit('dev-reg:'+u.id,30,60000))return sendJson(res,429,{error:'\u0637\u0644\u0628\u0627\u062a \u0643\u062a\u064a\u0631\u0629 \u2014 \u0627\u0633\u062a\u0646\u0649 \u0634\u0648\u064a\u0629'});
  const b=await readJsonBody(req,16*1024);
  const token=String(b.token||'').trim();
  if(!token)return sendJson(res,400,{error:'token_required'});
  const platform=String(b.platform||'').trim().slice(0,20)||'android';
  const appBuild=Math.round(n(b.appBuild,0,1e9,0));
  const ok=push.registerDevice(u.id,token,platform,appBuild);
  if(!ok)return sendJson(res,400,{error:'token_invalid'});
  return sendJson(res,200,{ok:true});
}

// لو المستخدم قفل الإشعارات أو سجّل خروج، بنشيل التوكن عشان مايوصلهوش حاجة.
async function unregisterDevice(req,res){
  const u=user(req,res); if(!u)return;
  const b=await readJsonBody(req,16*1024);
  const token=String(b.token||'').trim();
  if(!token)return sendJson(res,400,{error:'token_required'});
  push.unregisterDevice(token);
  return sendJson(res,200,{ok:true});
}

// التطبيق بيسأل على الإعدادات لوحدها (من الخلفية مثلاً) بدون bootstrap كامل.
async function mobileAppConfig(req,res){
  const u=user(req,res); if(!u)return;
  return sendJson(res,200,{ok:true,appConfig:appconfig.get(),ts:Date.now()});
}

module.exports={bootstrap,history,getNotifications,registerDevice,unregisterDevice,mobileAppConfig,activeAnnouncementsPublic:activeAnnouncements,saveProfile,activatePlan,startSession,saveSet,finishSession,saveNutrition,saveWeight,saveMeasurement,foodSearch,foodPreferences,saveFoodPreference,exerciseHistory,exerciseAlternatives,workoutHistory,nutritionPlan,modules,appVersion,clientEvent,reportVideo,smartCoachGet,smartCoachSet,startTrial,checkinSubmit,saveMealOverride,getMealOverrides};
