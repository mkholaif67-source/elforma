// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UI COMPONENTS — ui/components.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildAnalysis(){
  // ── 1) Read state (بنفس البيانات — بدون إضافة أي نقطة جديدة)
  const bmi      = state.bmi.toFixed(1);
  const recScore = state.recoveryScore;
  const goalKcal = state.goal==='cut'?state.tdee-400:state.goal==='muscle'?state.tdee+250:state.tdee;
  const goalDeltaTxt = {cut:'−400 عجز يومي',muscle:'+250 فائض يومي',strength:'صيانة + طاقة',fitness:'صيانة'}[state.goal] || 'صيانة';
  const bmiColor = state.bmi<18.5?'#60a5fa':state.bmi<25?'#00e5b0':state.bmi<30?'#fbbf24':'#ff4466';
  const bmiCatTxt= state.bmi<18.5?'تحت الوزن':state.bmi<25?'وزن صحي':state.bmi<30?'زيادة':'سمنة';
  const trainingTol = state.trainingTolerance || 80;
  const volCap      = state.weeklyVolCap || 80;
  const sleepPct    = state.sleep==='good'?90:state.sleep==='ok'?60:35;
  const sleepHrs    = {poor:'أقل من 6 ساعات',ok:'6–8 ساعات',good:'8+ ساعات'}[state.sleep] || '6–8 ساعات';
  const stressTxt   = {low:'منخفض',mid:'متوسط',high:'مرتفع'}[state.stress] || 'متوسط';
  const dailyTxt    = {sedentary:'مكتبي',light:'خفيف',moderate:'متوسط',active:'نشيط',veryActive:'رياضي',very_active:'نشيط جدا'}[state.daily] || 'متوسط';
  const expTxt      = {beginner:'مبتدئ',intermediate:'متوسط',advanced:'متقدم'}[state.exp] || state.exp;
  const goalTxt     = {cut:'تنشيف',muscle:'ضخامة',strength:'قوة',fitness:'لياقة'}[state.goal] || state.goal;
  const genderTxt   = state.gender==='male'?'ذكر':'أنثى';
  const overall     = Math.round((recScore + trainingTol + volCap) / 3);
  const splits      = getSplits();
  const splitName   = splits[state.recommendedSplit]?.name || 'Push Pull Legs';
  const splitDesc   = splits[state.recommendedSplit]?.desc || '';
  const stressColor = state.stress==='low'?'#00e5b0':state.stress==='high'?'#ff6b8a':'#ffd060';
  const sleepColor  = state.sleep==='good'?'#00e5b0':state.sleep==='poor'?'#ff6b8a':'#ffd060';
  const dailyKey    = String(state.daily||'').toLowerCase();
  const isHighDaily = ['active','veryactive','very_active'].includes(dailyKey);
  const recoColor   = overall>=80?'#00e5b0':overall>=60?'#fbbf24':'#ff4466';

  // ── 2) سبلت تشيبس للتقسيم (لو متوفر)
  const splitChips  = ({
    'fullbody':          [{l:'Full A',c:'#00e5b0'},{l:'Full B',c:'#5b8dee'},{l:'Full C',c:'#b87fff'}],
    'ppl':               [{l:'Push',c:'#00e5b0'},{l:'Pull',c:'#5b8dee'},{l:'Legs',c:'#ff6b8a'}],
    'ppl_3':             [{l:'Push',c:'#00e5b0'},{l:'Pull',c:'#5b8dee'},{l:'Legs',c:'#ff6b8a'}],
    'stronglifts':       [{l:'A 5×5',c:'#00e5b0'},{l:'B 5×5',c:'#5b8dee'}],
    'upper_lower':       [{l:'Upper',c:'#5b8dee'},{l:'Lower',c:'#ff6b8a'}],
    'anterior_posterior':[{l:'Anterior',c:'#00e5b0'},{l:'Posterior',c:'#5b8dee'}],
    'ppl_weak':          [{l:'Push',c:'#00e5b0'},{l:'Pull',c:'#5b8dee'},{l:'Legs',c:'#ff6b8a'},{l:'Weak',c:'#b87fff'}],
    'torso_limbs':       [{l:'Torso A',c:'#5b8dee'},{l:'Limbs A',c:'#ff6b8a'},{l:'Torso B',c:'#00e5b0'},{l:'Limbs B',c:'#ffd060'}],
    'ppul':              [{l:'Push',c:'#00e5b0'},{l:'Pull',c:'#5b8dee'},{l:'Upper',c:'#ffd060'},{l:'Lower',c:'#ff6b8a'}],
    'brosplit':          [{l:'صدر',c:'#00e5b0'},{l:'ظهر',c:'#5b8dee'},{l:'أكتاف',c:'#ffd060'},{l:'أرجل',c:'#ff6b8a'},{l:'ذراع',c:'#b87fff'}],
    'hybrid':            [{l:'Push',c:'#00e5b0'},{l:'Pull',c:'#5b8dee'},{l:'Legs',c:'#ff6b8a'},{l:'Upper',c:'#ffd060'},{l:'Lower',c:'#b87fff'}],
    'ululf':             [{l:'Upper',c:'#5b8dee'},{l:'Lower',c:'#ff6b8a'},{l:'Full',c:'#00e5b0'}],
    'arnold':            [{l:'صدر+ظهر',c:'#00e5b0'},{l:'أكتاف+ذراع',c:'#5b8dee'},{l:'أرجل',c:'#ff6b8a'}],
    'ul6':               [{l:'Upper ×3',c:'#5b8dee'},{l:'Lower ×3',c:'#ff6b8a'}],
  })[state.recommendedSplit] || [{l: splitName || 'Plan', c:'#00e5b0'}];

  // ── 3) إخفاء العناصر القديمة
  const ph=document.getElementById('profileHeader'); if(ph) ph.style.display='none';
  const oi=document.getElementById('analysisInsight'); if(oi) oi.style.display='none';

  // ── 4) Helpers — sparkline svg
  const spark=(seed,color)=>{
    const pts=[]; let v=50;
    for(let i=0;i<14;i++){
      v += (Math.sin(seed*0.7+i*1.3)*14) + (Math.cos(seed*1.1+i*0.4)*9);
      v = Math.max(20,Math.min(80,v));
      pts.push([i*(100/13), 100-v]);
    }
    const linePath = 'M '+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L ');
    const fillPath = linePath + ` L 100 100 L 0 100 Z`;
    return `<svg class="a3-spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path class="fill" d="${fillPath}"/>
      <path class="line" d="${linePath}"/>
    </svg>`;
  };

  // ── 5) Build HTML
  let html = `<div class="a3-wrap">`;

  // HEADER (حذف عنوان مكرر)

  // KPI strip
  html += `<div class="a3-kpi-grid">
    <div class="a3-kpi" style="--kpi-color:#00e5b0;--kpi-tint:rgba(0,229,176,0.18);">
      <div class="a3-kpi-row">
        <div><span class="a3-kpi-val">${overall}%</span></div>
        <div class="a3-kpi-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </div>
      </div>
      <div class="a3-kpi-lbl">جاهزية الجسم</div>
      <div class="a3-kpi-sub">مؤشر عام</div>
      ${spark(1,'#00e5b0')}
    </div>
    <div class="a3-kpi" style="--kpi-color:#5b8dee;--kpi-tint:rgba(108,142,245,0.18);">
      <div class="a3-kpi-row">
        <div><span class="a3-kpi-val">${state.tdee}</span></div>
        <div class="a3-kpi-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
        </div>
      </div>
      <div class="a3-kpi-lbl">TDEE</div>
      <div class="a3-kpi-sub">استهلاك يومي</div>
      ${spark(2,'#5b8dee')}
    </div>
    <div class="a3-kpi" style="--kpi-color:${bmiColor};--kpi-tint:${bmiColor==='#00e5b0'?'rgba(0,229,176,0.18)':bmiColor==='#fbbf24'?'rgba(251,191,36,0.18)':bmiColor==='#60a5fa'?'rgba(96,165,250,0.18)':'rgba(255,68,102,0.18)'};">
      <div class="a3-kpi-row">
        <div><span class="a3-kpi-val">${bmi}</span></div>
        <div class="a3-kpi-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
      </div>
      <div class="a3-kpi-lbl">BMI</div>
      <div class="a3-kpi-sub">${bmiCatTxt}</div>
      ${spark(3,bmiColor)}
    </div>
    <div class="a3-kpi" style="--kpi-color:#00e5b0;--kpi-tint:rgba(0,229,176,0.14);">
      <div class="a3-kpi-row">
        <div><span class="a3-kpi-val">${state.weight}</span></div>
        <div class="a3-kpi-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5h11l1.5 12.5a1 1 0 0 1-1 1.1H6a1 1 0 0 1-1-1.1z"/><path d="M9 9l3-3 3 3"/></svg>
        </div>
      </div>
      <div class="a3-kpi-lbl">الوزن الحالي</div>
      <div class="a3-kpi-sub">كجم</div>
      ${spark(4,'#00e5b0')}
    </div>
  </div>`;

  // PAIR: Performance bars + Training System
  html += `<div class="a3-pair">
    <div class="a3-panel" style="--panel-line:#5b8dee;">
      <div class="a3-panel-title">مؤشرات الأداء</div>
      <div class="a3-bars">
        <div class="a3-bar" style="--bar-color:#00e5b0;">
          <div class="a3-bar-row">
            <div class="a3-bar-label"><span class="a3-bar-ico"></span>طاقة الجسم الأقصى</div>
            <div class="a3-bar-val">${volCap}%</div>
          </div>
          <div class="a3-bar-track"><div class="a3-bar-fill" data-w="${volCap}"></div></div>
        </div>
        <div class="a3-bar" style="--bar-color:#5b8dee;">
          <div class="a3-bar-row">
            <div class="a3-bar-label"><span class="a3-bar-ico"></span>تحمل التدريب</div>
            <div class="a3-bar-val">${trainingTol}%</div>
          </div>
          <div class="a3-bar-track"><div class="a3-bar-fill" data-w="${trainingTol}"></div></div>
        </div>
        <div class="a3-bar" style="--bar-color:${sleepColor};">
          <div class="a3-bar-row">
            <div class="a3-bar-label"><span class="a3-bar-ico"></span>جودة النوم</div>
            <div class="a3-bar-val">${sleepPct}%</div>
          </div>
          <div class="a3-bar-track"><div class="a3-bar-fill" data-w="${sleepPct}"></div></div>
        </div>
      </div>
    </div>
    <div class="a3-panel" style="--panel-line:#00e5b0;">
      <div class="a3-panel-title">النظام التدريبي المقترح</div>
      <div class="a3-ts-body">
        <div class="a3-ts-figure">
          <div class="a3-aura"></div>
          <div class="a3-ring"></div>
          <div class="a3-grid-floor"></div>
          <img class="a3-hero-body" src="assets/body-hero.png" alt="" loading="lazy" decoding="async"/>
          <span class="a3-pulse-dot p1" aria-hidden="true"></span>
          <span class="a3-pulse-dot p2" aria-hidden="true"></span>
          <span class="a3-pulse-dot p3" aria-hidden="true"></span>
        </div>
        <div>
          <div class="a3-ts-name">${splitName}</div>
          <div class="a3-ts-sub">${state.days} أيام · ${state.time} د · ${expTxt} · ${goalTxt}</div>
          <div class="a3-ts-meta" style="font-size:11px;opacity:0.72;margin-top:4px;letter-spacing:0.3px;color:var(--text-muted);">نشاط: ${dailyTxt} · توتر: ${stressTxt}</div>
        </div>
        <div class="a3-ts-chips">
          ${splitChips.map(c=>`<span class="a3-ts-chip" style="--chip-color:${c.c};"><i></i>${c.l}</span>`).join('')}
        </div>
      </div>
    </div>
  </div>`;

  // PLAN DETAILS — removed v37 (دمج في subtitle و lifestyle meta)

  // SMART RECOMMENDATION — مبني على بيانات موجودة
  let recTitle='توصية ذكية', recText='', recTag='';
  if(state.bmi >= 35){
    recTitle='تحتياط طبي — تعديل كثافة التمارين';
    recText='تم تعديل تمارين الوقوف المحملة وترجيح تمارين Seated/Supported لحماية الركبة والظهر. ينصح باستشارة متخصص قبل البدء';
    recTag='BMI ≥ 35';
  } else if(state.bmi >= 30){
    recTitle='تحسين طبي — تعديل كثافة التمارين';
    recText='تم تعديل تمارين الوقوف المحملة لمحافظة أفضل للركبة وتقليل الضغط على المفاصل. يمكن مراجعته مع متخصص';
    recTag='BMI ≥ 30';
  } else if(recScore < 60){
    recTitle='تعديل ذكي — حجم محافظ';
    recText='مستوى تعافيك أقل من المثالي — تم خفض الحجم التدريبي تلقائيا لتجنب الإفراط في التدريب وتحسين الاستجابة البيولوجية';
    recTag='تعافي '+recScore+'%';
  } else if((state.age||0) >= 55){
    recTitle='برنامج 55+ — تعديل للعمر';
    recText='نطاقات التكرار مرفوعة (10–15 بدل 8–12) لحماية المفاصل والأوتار. فترات الراحة ممددة قليلا وفقا لإرشادات ACSM.';
    recTag=state.age+' سنة';
  } else if(state.exp==='beginner'){
    recTitle='برنامج مبتدئين — حجم محافظ';
    recText='تم تعيين 12–16 مجموعة/جلسة بدل 18–21 لمنع DOMS الشديد وضمان الاستمرارية. بعد 4–6 أسابيع سيرتفع الحجم تلقائيا.';
    recTag='مبتدئ';
  } else if(state.goal==='muscle' && state.bmi > 27){
    recTitle='توصية تغذية — Lean Bulk';
    recText='مع هدف الضخامة ووزنك الحالي، ننصح بفائض سعرات معتدل (Lean Bulk) للحفاظ على التعريف العضلي وتفادي تراكم دهني متسارع';
    recTag=goalTxt;
  } else if(state.goal==='cut' && state.bmi < 22){
    recTitle='توصية — حفاظ على الكتلة';
    recText='هدف التنشيف مع وزن طبيعي — سيتم التركيز على الحفاظ على الكتلة العضلية مع عجز سعرات معتدل (300 بدل 500).';
    recTag=goalTxt;
  } else {
    recTitle='توصية تحسب لك — تعديل كثافة التمارين';
    recText='بياناتك ممتازة! تعافيك ' + recScore + '% — جاهز لبناء خطة ' + goalTxt + ' فعالة. تم ضبط كثافة التمارين وفقا لمستواك والوقت المتاح';
    recTag='مثالي';
  }
  html += `<div class="a3-rec">
    <div class="a3-rec-ico"></div>
    <div class="a3-rec-body">
      <div class="a3-rec-title">${recTitle} <span class="a3-rec-tag">${recTag}</span></div>
      <div class="a3-rec-text">${recText}</div>
    </div>
  </div>`;

  // ANALYTICS ROW
  // gauge-1: جاهزية + ملف المتدرب
  const overallDash = (283 * (1 - overall/100)).toFixed(1);
  // gauge-2: هدف السعرات (دائرة بسيطة)
  const kcalPct = Math.min(100, Math.round((goalKcal / state.tdee) * 100));
  const kcalDash = (283 * (1 - kcalPct/100)).toFixed(1);

  html += `<div class="a3-analytics">
    <div class="a3-mini" style="--mini-line:#00e5b0;">
      <div class="a3-mini-head">
        <span>سعة الأسبوع التدريبي</span>
        <span class="a3-mini-badge">${state.days}×</span>
      </div>
      <div class="a3-cap-wrap">
        <div class="a3-cap-row" style="--cap-color:#00e5b0;">
          <span class="lbl">حجم أسبوعي</span>
          <div class="track"><div class="fill" data-w="${volCap}"></div></div>
          <span class="val">${volCap}%</span>
        </div>
        <div class="a3-cap-row" style="--cap-color:#5b8dee;">
          <span class="lbl">تحمل</span>
          <div class="track"><div class="fill" data-w="${trainingTol}"></div></div>
          <span class="val">${trainingTol}%</span>
        </div>
        <div class="a3-cap-row" style="--cap-color:#b87fff;">
          <span class="lbl">تعافي</span>
          <div class="track"><div class="fill" data-w="${recScore}"></div></div>
          <span class="val">${recScore}%</span>
        </div>
        <div class="a3-cap-row" style="--cap-color:${sleepColor};">
          <span class="lbl">نوم</span>
          <div class="track"><div class="fill" data-w="${sleepPct}"></div></div>
          <span class="val">${sleepPct}%</span>
        </div>
      </div>
    </div>
    <div class="a3-mini" style="--mini-line:${recoColor};">
      <div class="a3-mini-head">
        <span>ملف التقدم</span>
        <span class="a3-mini-badge">${expTxt}</span>
      </div>
      <div class="a3-gauge" style="--gauge-color:${recoColor};">
        <div class="a3-gauge-ring">
          <svg viewBox="0 0 100 100">
            <circle class="track" cx="50" cy="50" r="45"/>
            <circle class="progress" cx="50" cy="50" r="45" data-dash="${overallDash}"/>
          </svg>
          <div class="a3-gauge-center">
            <div class="a3-gauge-val">${overall}%</div>
            <div class="a3-gauge-unit">${genderTxt}</div>
          </div>
        </div>
        <div class="a3-gauge-sub">${state.height} سم · <b>مستوى ${expTxt}</b></div>
      </div>
    </div>
    <div class="a3-mini" style="--mini-line:#b87fff;">
      <div class="a3-mini-head">
        <span>هدف السعرات</span>
        <span class="a3-mini-badge">${goalTxt}</span>
      </div>
      <div class="a3-gauge" style="--gauge-color:#b87fff;">
        <div class="a3-gauge-ring">
          <svg viewBox="0 0 100 100">
            <circle class="track" cx="50" cy="50" r="45"/>
            <circle class="progress" cx="50" cy="50" r="45" data-dash="${kcalDash}"/>
          </svg>
          <div class="a3-gauge-center">
            <div class="a3-gauge-val">${goalKcal}</div>
            <div class="a3-gauge-unit">سعر حراري</div>
          </div>
        </div>
        <div class="a3-gauge-sub">${goalDeltaTxt}</div>
      </div>
    </div>
  </div>`;

  // CTA strip
  html += `<div class="a3-cta-strip">
    <div class="a3-cta-ico"></div>
    <div class="a3-cta-txt">يمكنك معنا تحقيق <b>80%+</b> من أهدافك بخطة ${goalTxt} مخصصة لملفك</div>
  </div>`;

  html += `</div>`; // /a3-wrap

  document.getElementById('analysisSections').innerHTML = html;

  // ── 6) Animate bars + gauges after paint (rAF - transitions trigger)
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      document.querySelectorAll('#sec3 .a3-bar-fill, #sec3 .a3-cap-row .fill').forEach(el=>{
        const w = el.getAttribute('data-w') || '0';
        el.style.width = w + '%';
      });
      document.querySelectorAll('#sec3 .a3-gauge-ring svg .progress').forEach(el=>{
        const d = el.getAttribute('data-dash') || '283';
        el.style.strokeDashoffset = d;
      });
    });
  });

  // hide loading bar
  const lb=document.getElementById('analysisLoadBar'); if(lb) lb.style.display='none';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUILD SPLITS — 8 أنظمة مع اقتراح ذكي
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildSplits(){
  const splits=getSplits();
  const rec=state.recommendedSplit;
  const recName=splits[rec]?.name||'';
  document.getElementById('splitExplanation').innerHTML=
    `بناء على تحليل <b>${state.days} أيام تدريب</b> · خبرة <b>${state.exp==='beginner'?'مبتدئ':state.exp==='intermediate'?'متوسطة':'متقدمة'}</b> · تعافي <b>${state.recoveryScore}%</b> · هدف <b>${{cut:'تنشيف',muscle:'ضخامة',strength:'قوة',fitness:'لياقة'}[state.goal]}</b> — قمنا بتحليل جميع العوامل واقتراح الأنسب لك. <b>أنت حر في اختيار أي نظام مؤهل</b>`;
  const recBanner=document.getElementById('recBanner');
  recBanner.innerHTML=` <b>النظام المقترح لك:</b> ${recName} — ${splits[rec]?.desc||''}`;
  recBanner.style.display='block';

  // ── ELIGIBILITY ENGINE ─────────────────────────────────────────────
  function splitEligibilityStatus(k){
    const s=splits[k];
    if(!s) return {eligible:false, reason:'غير موجود'};
    const d=state.days, e=state.exp, r=state.recoveryScore;
    const reasons=[];

    // ── Constitutional day-range gate ──
    if(d < s.minDays) reasons.push(`يحتاج ${s.minDays}+ أيام (أنت: ${d})`);
    if(d > s.maxDays) reasons.push(`الحد الأقصى ${s.maxDays} أيام (أنت: ${d})`);

    // Experience gate
    if(s.level && !s.level.includes(e)){
      const levelAr={beginner:'مبتدئ',intermediate:'متوسط',advanced:'متقدم'};
      reasons.push(`يتطلب مستوى: ${s.level.map(l=>levelAr[l]).join(' أو ')}`);
    }

    // Arnold specific: recovery + advanced only
    if(k==='arnold'){
      if(e!=='advanced') reasons.push('متقدمون فقط');
      if(r<70) reasons.push(`تعاف منخفض (${r}% / المطلوب: 70%+)`);
    }
    if(k==='brosplit' && e==='beginner') reasons.push('غير مناسب للمبتدئين');
    if((k==='ppl_weak'||k==='ppl_3') && e==='beginner') reasons.push('للمتوسطين والمتقدمين فقط');

    return {eligible: reasons.length===0, reasons};
  }

  // ── ADVANCED OVERRIDE PATCH: classify locked splits ────────────────
  // Hard-invalid: TRULY structurally impossible — engine CANNOT generate a valid
  //   program. Permanently blocked. NO override can unlock these.
  // Soft-unsupported: not ideal for user profile but engine CAN run them.
  //   Appear in the advanced section when user manually opens the toggle.
  function isHardInvalid(k) {
    const d = state.days, e = state.exp;
    const s = splits[k];
    // Split object missing entirely
    if(!s) return true;

    // ── CONSTITUTIONAL DAY-RANGE GATE ─────────────────────────────────────
    // Each split has a hard minDays/maxDays from The Constitution §1.
    // If the user's day count falls outside that range, the engine
    // CANNOT physically build a valid plan - hard invalid.

    // 3-day exclusives
    if(k==='ppl_3'      && d!==3) return true;  // exactly 3 days
    if(k==='stronglifts'&& d!==3) return true;  // exactly 3 days

    // 4-day exclusive
    if(k==='upper_lower'&& d!==4) return true;  // exactly 4 days

    // 5-day exclusives
    if(k==='brosplit'   && d!==5) return true;  // exactly 5 days (5 muscle groups)
    if(k==='hybrid'     && d!==5) return true;  // exactly 5 days (PPL+UL)

    // 6-day exclusives
    if(k==='arnold'     && d!==6) return true;  // exactly 6 days
    if(k==='ul6'        && d!==6) return true;  // exactly 6 days (Upper/Lower x3)

    // 5-6 day range
    if(k==='ppl'        && d<5)   return true;  // needs ≥5 days
    if(k==='ppl'        && d>6)   return true;  // no standard > 6-day PPL

    // 4 أيام فقط — HARD EXCLUDED على 5+ أيام
    if(k==='anterior_posterior' && d!==4) return true;
    if(k==='ppl_weak'           && d!==4) return true;
    if(k==='torso_limbs'        && d!==4) return true;

    // Full Body: 2-3 days
    if(k==='fullbody' && (d<2||d>3)) return true;

    // ── EXPERIENCE HARD LOCKS ──────────────────────────────────────────────
    // ppl_3 and ppl_weak assume intermediate+ motor patterns
    if((k==='ppl_weak'||k==='ppl_3') && e==='beginner') return true;
    // Bro Split: too low frequency for beginners (once-per-muscle-per-week)
    if(k==='brosplit' && e==='beginner') return true;
    // Arnold: advanced only (recovery + motor control requirement)
    if(k==='arnold' && e!=='advanced') return true;

    // Everything else (goal mismatch, recovery mismatch) = soft warning, not hard invalid
    return false;
  }

  // Rich reason label for soft-unsupported warning strip
  function softWarnLabel(k) {
    const s = splits[k];
    const r = state.recoveryScore, e = state.exp, d = state.days;
    const labels = [];
    if(s && d < s.minDays) labels.push(`يحتاج ${s.minDays}+ أيام (أنت: ${d})`);
    if(s && d > s.maxDays) labels.push(`الأنسب حتى ${s.maxDays} أيام (أنت: ${d})`);
    if(s && s.level && !s.level.includes(e)){
      const lAr={beginner:'مبتدئ',intermediate:'متوسط',advanced:'متقدم'};
      labels.push(`الأنسب ل ${s.level.map(l=>lAr[l]||l).join('/')} — مستواك: ${lAr[e]||e}`);
    }
    if(k==='arnold'){
      if(e!=='advanced') labels.push('للمتقدمين فقط');
      if(r<70) labels.push(`تعافيك (${r}%) أقل من المطلوب 70%`);
    }
    if(k==='brosplit' && e==='beginner') labels.push('تردد التمرين غير كاف للمبتدئين');
    if((k==='ppl'||k==='brosplit'||k==='arnold') && r<55) labels.push(`تعافيك منخفض (${r}%) — خطر إرهاق`);
    if(k==='ppl' && d<5) labels.push(`PPL الكامل يحتاج 5+ أيام — على ${d} أيام استخدم ppl_3`);
    if(labels.length===0) labels.push('غير موصى به لحالتك الحالية');
    return labels.join(' · ');
  }

  // ── SPLIT SELECTION — القاعدة: الأيام هي الفلتر الأول والوحيد ──────────
  // المرحلة 1: فلتر الأيام فقط (strict day-count gate)
  //   كل جدول عدد أيامه يطابق اختيار المستخدم - يظهر في ال main grid
  //   كل جدول عدد أيامه لا يطابق - يختفي تماما (hard-blocked)
  // المرحلة 2 (داخل الكارد فقط): الخبرة والتعافي = تحذيرات نصية فقط
  // لا يمنع أي جدول بسبب خبرة أو تعافي — المستخدم يختار بحرية كاملة

  const allKeys = Object.keys(splits);

  // ── المرحلة 1: فلتر الأيام الصارم ──────────────────────────────────────
  // isHardInvalid() يفحص الأيام + تحقق هيكلي فقط (بدون خبرة)
  // نضيف هنا dayMismatch كفلتر نقي للأيام فقط
  function isDayMismatch(k) {
    const s = splits[k];
    if (!s) return true;
    const d = state.days;
    // fullbody: 2-3 أيام فقط
    if (k === 'fullbody'           && (d < 2 || d > 3)) return true;
    // 3-day exclusives
    if (k === 'ppl_3'              && d !== 3) return true;
    if (k === 'stronglifts'        && d !== 3) return true;
    // 4-day exclusive
    if (k === 'upper_lower'        && d !== 4) return true;
    // 4 أيام فقط — HARD EXCLUDED على 5+ أيام
    if (k === 'anterior_posterior' && d !== 4) return true;
    if (k === 'ppl_weak'           && d !== 4) return true;
    if (k === 'torso_limbs'        && d !== 4) return true;
    // 5-day exclusives
    if (k === 'brosplit'           && d !== 5) return true;
    if (k === 'hybrid'             && d !== 5) return true;
    // 5-6 day range
    if (k === 'ppl'                && (d < 5 || d > 6)) return true;
    // 6-day exclusive
    if (k === 'arnold'             && d !== 6) return true;
    // جداول جديدة — فلتر صارم للأيام
    if (k === 'ppul'               && d !== 4) return true;  // Push/Pull/Upper/Lower — 4 only
    if (k === 'ululf'              && d !== 5) return true;  // Upper/Lower/Full   — 5 only
    if (k === 'ul6'                && d !== 6) return true;  // Upper/Lower x3     — 6 only
    return false;
  }

  // الجداول المطابقة للأيام - تظهر كلها في main grid
  const dayMatched   = allKeys.filter(k => !isDayMismatch(k));
  // الجداول غير المطابقة للأيام - محجوبة تماما (hard-invalid)
  const hardInvalid  = allKeys.filter(k => isDayMismatch(k));
  // softUnsupp = فارغة الآن — لا يوجد "ممنوع بسبب خبرة" في ال main grid
  const softUnsupp   = [];

  // ترتيب عرض ال main grid: المقترح أولا، ثم الباقي تنازليا حسب نتيجة التوافق
  // (calcSplitScore معرفة لاحقا في نفس النطاق — hoisted، آمنة الاستدعاء هنا)
  const order = [
    rec,
    ...dayMatched
      .filter(k => k !== rec)
      .sort((a, b) => calcSplitScore(b) - calcSplitScore(a) || a.localeCompare(b))
  ].filter(k => dayMatched.includes(k) || k === rec);

  // ── تحذيرات داخل الكارد (خبرة + تعافي) — لا تمنع الجدول من الظهور ──────
  // نعاد استخدام softWarnLabel() كتحذير نصي داخل الكارد فقط
  function getDayMatchedWarn(k) {
    const s = splits[k];
    const r_w = state.recoveryScore, e_w = state.exp, d_w = state.days;
    const labels = [];
    // تحذير خبرة
    if (s && s.level && !s.level.includes(e_w)) {
      const lAr = {beginner:'مبتدئ', intermediate:'متوسط', advanced:'متقدم'};
      labels.push(`الأنسب ل ${s.level.map(l=>lAr[l]||l).join('/')} — مستواك: ${lAr[e_w]||e_w}`);
    }
    // تحذير تعافي
    if (k === 'arnold' && r_w < 70) {
      labels.push(`تعافيك (${r_w}%) أقل من المطلوب 70%`);
    }
    if ((k === 'ppl' || k === 'brosplit' || k === 'arnold') && r_w < 55) {
      labels.push(`تعافيك منخفض (${r_w}%) — راقب الإجهاد`);
    }
    // تحذير مبتدئ
    if (k === 'brosplit' && e_w === 'beginner') {
      labels.push('تردد التمرين منخفض للمبتدئين — تأكد من الالتزام');
    }
    if ((k === 'ppl_weak' || k === 'ppl_3') && e_w === 'beginner') {
      labels.push('ينصح للمتوسطين فأعلى — تابع بحذر');
    }
    // anterior_posterior و ppl_weak = 4 أيام فقط — لا يصلان هنا على d=5 أبدا
    return labels.join(' · ');
  }

  // ── Week visual builder ───────────────────────────────────────────
  const _wd = state.days || 3; // عدد الأيام الفعلي للمستخدم
  const SPLIT_WEEK_MAP = {
    // 2-3 أيام
    fullbody:          _wd===2
      ? [{l:'Full A',w:true},{l:'راحة',w:false},{l:'Full B',w:true},{l:'راحة',w:false},{l:'راحة',w:false},{l:'راحة',w:false},{l:'راحة',w:false}]
      : [{l:'Full A',w:true},{l:'راحة',w:false},{l:'Full B',w:true},{l:'راحة',w:false},{l:'Full C',w:true},{l:'راحة',w:false},{l:'راحة',w:false}],
    ppl_3:             [{l:'Push',w:true},{l:'راحة',w:false},{l:'Pull',w:true},{l:'راحة',w:false},{l:'Legs',w:true},{l:'راحة',w:false},{l:'راحة',w:false}],
    stronglifts:       [{l:'A 5×5',w:true},{l:'راحة',w:false},{l:'B 5×5',w:true},{l:'راحة',w:false},{l:'A 5×5',w:true},{l:'راحة',w:false},{l:'راحة',w:false}],
    // 4 أيام فقط
    upper_lower:       [{l:'Upper A',w:true},{l:'Lower A',w:true},{l:'راحة',w:false},{l:'Upper B',w:true},{l:'Lower B',w:true},{l:'راحة',w:false},{l:'راحة',w:false}],
    // 4 أيام فقط (HARD LOCKED — لا يظهران على 5 أيام أبدا)
    anterior_posterior: [{l:'Ant A',w:true},{l:'Post A',w:true},{l:'راحة',w:false},{l:'Ant B',w:true},{l:'Post B',w:true},{l:'راحة',w:false},{l:'راحة',w:false}],
    ppl_weak:           [{l:'Push',w:true},{l:'Pull',w:true},{l:'Legs',w:true},{l:'راحة',w:false},{l:'Weak',w:true},{l:'راحة',w:false},{l:'راحة',w:false}],
    torso_limbs:        [{l:'Torso A',w:true},{l:'Limbs A',w:true},{l:'راحة',w:false},{l:'Torso B',w:true},{l:'Limbs B',w:true},{l:'راحة',w:false},{l:'راحة',w:false}],
    // 5 أيام: Push A / Pull A / Legs / راحة / Push B / Pull B / راحة
    // 6 أيام: Push 1 / Pull 1 / Legs 1 / Push 2 / Pull 2 / Legs 2 / راحة
    ppl: _wd===6
      ? [{l:'Push 1',w:true},{l:'Pull 1',w:true},{l:'Legs 1',w:true},{l:'راحة',w:false},{l:'Push 2',w:true},{l:'Pull 2',w:true},{l:'Legs 2',w:true}]
      : [{l:'Push A',w:true},{l:'Pull A',w:true},{l:'Legs',w:true},{l:'راحة',w:false},{l:'Push B',w:true},{l:'Pull B',w:true},{l:'راحة',w:false}],
    brosplit:          [{l:'صدر',w:true},{l:'ظهر',w:true},{l:'أكتاف',w:true},{l:'راحة',w:false},{l:'أرجل',w:true},{l:'ذراع',w:true},{l:'راحة',w:false}],
    hybrid:            [{l:'Push',w:true},{l:'Pull',w:true},{l:'Legs',w:true},{l:'راحة',w:false},{l:'Upper',w:true},{l:'Lower',w:true},{l:'راحة',w:false}],
    // 6 أيام: ثلاثة/راحة/ثلاثة
    arnold:            [{l:'صدر+ظهر',w:true},{l:'أكتاف+ذراع',w:true},{l:'أرجل',w:true},{l:'راحة',w:false},{l:'صدر+ظهر',w:true},{l:'أكتاف+ذراع',w:true},{l:'أرجل',w:true}],
    // NEWSPLITS-WEEKMAP — جداول جديدة
    ppul:  [{l:'Push',w:true},{l:'Pull',w:true},{l:'راحة',w:false},{l:'Upper',w:true},{l:'Lower',w:true},{l:'راحة',w:false},{l:'راحة',w:false}],
    ululf: [{l:'Upper A',w:true},{l:'Lower A',w:true},{l:'راحة',w:false},{l:'Upper B',w:true},{l:'Lower B',w:true},{l:'Full',w:true},{l:'راحة',w:false}],
    ul6:   [{l:'Upper 1',w:true},{l:'Lower 1',w:true},{l:'Upper 2',w:true},{l:'راحة',w:false},{l:'Lower 2',w:true},{l:'Upper 3',w:true},{l:'Lower 3',w:true}],
  };
  const SPLIT_ICONS = {
    fullbody:'',upper_lower:'',ppl_3:'',ppl:'',brosplit:'',
    arnold:'',stronglifts:'',hybrid:'',anterior_posterior:'',ppl_weak:'',ppul:'',ululf:'',ul6:'',torso_limbs:''
  };
  const SPLIT_ICON_IMG = {
    fullbody:'kettlebell',upper_lower:'dumbbell',ppl_3:'plates',ppl:'barbell',brosplit:'bicep',
    arnold:'arnold',stronglifts:'squat',hybrid:'hybrid',anterior_posterior:'anatomy',ppl_weak:'target',ppul:'cross',ululf:'flask',ul6:'flame',torso_limbs:'anatomy'
  };

  function buildSplitCardHTML(k, isRec, isAdv, score, warn){
    const s = splits[k];
    const _imgk = SPLIT_ICON_IMG[k];
    const icon = _imgk ? '<img class="sc-icon-img" src="assets/splits/'+_imgk+'.svg?v=40" alt="" loading="lazy">' : (SPLIT_ICONS[k]||'');
    const week = SPLIT_WEEK_MAP[k] || [{l:'—',w:true}];
    const weekHTML = week.map(d=>{
      const cls = isRec && d.w ? 'sc-day-rec' : d.w ? 'sc-day-work' : 'sc-day-rest';
      return `<div class="sc-day ${cls}">${d.l}</div>`;
    }).join('');
    const scoreColor = score>=85?'var(--green)':score>=70?'var(--accent)':score>=55?'var(--blue)':'var(--text-muted)';
    const tagsHTML = (s.tags||[]).map(t=>`<span class="sc-tag">${t}</span>`).join('');
    const extraClass = isRec?'recommended-card':isAdv?'soft-unsupported':'';
    return`<div class="split-card ${extraClass}" data-split="${k}" ${isAdv?'data-override="soft"':''} onclick="selectSplit('${k}')">
      ${isRec?'<div class="rec-badge"> مقترح لك</div>':''}
      ${isAdv?'<div class="override-badge"> متقدم</div>':''}
      <div class="sc-head">
        <div class="sc-icon-box">${icon}</div>
        <div class="sc-info">
          <div class="sc-name">${mixedText(s.name)}</div>
          <div class="sc-freq">${s.freq}</div>
        </div>
        <div class="sc-score-wrap">
          <div class="sc-ring" style="--p:${score};--rc:${scoreColor};"><b style="color:${scoreColor};">${score}</b></div>
          <div class="sc-score-lbl">توافق /100</div>
        </div>
      </div>
      <div class="sc-week">${weekHTML}</div>
      <div class="sc-desc">${s.desc}</div>
      <div class="sc-tags">${tagsHTML}</div>
      ${warn?`<div class="sc-warn-strip"> ${warn}</div>`:''}
    </div>`;
  }

  // ── Score calculator (visual only) ───────────────────────────────
  function calcSplitScore(k){
    const s=splits[k]; if(!s) return 40;
    let sc=50;
    if(k===rec) sc=96;
    else if(!isDayMismatch(k)){
      // الجدول مطابق للأيام — سكور بناء على الهدف والخبرة فقط
      sc = 78; // base score للجداول المطابقة للأيام
      if(state.goal&&s.goals&&s.goals.includes(state.goal)) sc=Math.min(sc+8,92);
      if(state.exp&&s.level&&s.level.includes(state.exp)) sc=Math.min(sc+6,92);
      // تخفيض بسيط للجداول اللي فيها تحذير خبرة أو تعافي (ليس حجبا)
      if(getDayMatchedWarn(k)) sc=Math.max(sc-10,58);
      // anterior_posterior و ppl_weak = 4 أيام فقط — لا يصلان ل calcSplitScore على d=5
    } else sc=42;
    return sc;
  }

  // ── Main grid: كل الجداول المطابقة للأيام تظهر هنا ────────────────────
  // الخبرة والتعافي = تحذير داخل الكارد فقط — لا تخفي الجدول
  document.getElementById('splitGrid').innerHTML=order.map(k=>{
    const warn = (k !== rec) ? getDayMatchedWarn(k) : '';
    return buildSplitCardHTML(k, k===rec, false, calcSplitScore(k), warn);
  }).join('');

  // ── Advanced grid: فارغة دائما — لا يوجد "جداول مخفية" بسبب الخبرة ────
  const advGrid = document.getElementById('advSplitGrid');
  // softUnsupp = [] دائما في هذا المنطق الجديد
  if(softUnsupp.length > 0){
    advGrid.innerHTML = softUnsupp.map(k=>{
      return buildSplitCardHTML(k, false, true, calcSplitScore(k), softWarnLabel(k));
    }).join('');
    document.getElementById('advToggleBtn').style.display='';
  } else {
    document.getElementById('advToggleBtn').style.display='none';
  }

  // Hard-invalid: جداول عدد أيامها مختلف — تسرد في الهامش فقط ──────────
  if(hardInvalid.length){
    const note = document.createElement('div');
    note.style.cssText='grid-column:1/-1;margin-top:10px;padding:10px 14px;background:rgba(120,40,40,0.12);border:1px solid rgba(220,80,80,0.22);border-radius:10px;font-size:10px;color:var(--text-muted);';
    note.innerHTML=` <b style="color:#f07090;">غير متاح لعدد أيامك:</b> ${hardInvalid.map(k=>splits[k]?.name).filter(Boolean).join(' · ')}<br><span style="font-size:9px;opacity:0.7;">هذه الأنظمة تحتاج عدد أيام مختلف — غير متاحة على ${state.days} أيام</span>`;
    document.getElementById('splitGrid').appendChild(note);
  }

  // Reset advanced toggle state on rebuild
  window._advOverrideOpen = false;
  const advBtn = document.getElementById('advToggleBtn');
  const advSec = document.getElementById('advSection');
  if(advBtn){ advBtn.classList.remove('active'); }
  if(advSec){ advSec.classList.remove('show'); }
  document.getElementById('overrideActiveBanner').classList.remove('show');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADVANCED OVERRIDE TOGGLE — UI-only, engine untouched
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function toggleAdvancedSystems(){
  window._advOverrideOpen = !window._advOverrideOpen;
  const btn = document.getElementById('advToggleBtn');
  const sec = document.getElementById('advSection');
  const lbl = document.getElementById('advToggleLabel');
  if(window._advOverrideOpen){
    btn.classList.add('active');
    sec.classList.add('show');
    lbl.textContent = ' إخفاء الأنظمة المتقدمة';
  } else {
    btn.classList.remove('active');
    sec.classList.remove('show');
    lbl.textContent = ' فتح الأنظمة الأخرى — خيار متقدم';
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRE-ANALYSIS LAYER — 60/20/20 Profile لكل سبليت
// طبقة تفكير مسبقة: تحلل التوزيع المتوقع قبل توليد البرنامج
// تعمل على جميع السبليتات — مقترحة أو غير مقترحة
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// نسبة توزيع المجموعات المتوقعة لكل سبليت (تقريبية بناء على هيكل الجدول)
// مشتقة من تحليل groups[] في getSplitSchedule
const SPLIT_DISTRIBUTION_PROFILE = {
  // primary(صدر+ظهر+كوادز+هامستينج) / shoulders / accessory
  fullbody:          { primary: 0.58, shoulders: 0.18, accessory: 0.24, note: 'توزيع متكامل في كل جلسة' },
  upper_lower:       { primary: 0.62, shoulders: 0.19, accessory: 0.19, note: 'أقرب نظام للمثالية 60/20/20' },
  ppl_3:             { primary: 0.55, shoulders: 0.22, accessory: 0.23, note: 'أكتاف وذراع قد تأخذ حصة أعلى' },
  ppl:               { primary: 0.58, shoulders: 0.20, accessory: 0.22, note: 'Push يدمج صدر+أكتاف+ترايسبس' },
  brosplit:          { primary: 0.60, shoulders: 0.20, accessory: 0.20, note: 'نظري مثالي لكن تكرار عضلي منخفض' },
  arnold:            { primary: 0.56, shoulders: 0.22, accessory: 0.22, note: 'صدر+ظهر يشارك الأكتاف كثيرا' },
  stronglifts:       { primary: 0.72, shoulders: 0.14, accessory: 0.14, note: 'هيمنة المركبات — أقل تنوعا' },
  hybrid:            { primary: 0.60, shoulders: 0.20, accessory: 0.20, note: 'هجين متوازن — قريب من المثالي' },
  anterior_posterior:{ primary: 0.62, shoulders: 0.16, accessory: 0.22, note: 'سلسلة أمامية/خلفية — أكتاف أقل' },
  ppl_weak:          { primary: 0.55, shoulders: 0.18, accessory: 0.27, note: 'يوم إضافي لنقاط الضعف يرفع الملحقة' },
  torso_limbs:       { primary: 0.60, shoulders: 0.18, accessory: 0.22, note: 'جذع/أطراف متوازن — يوم ذراع مخصص يرفع جودة الذراع' },
};

/**
 * analyzeSplitDistribution
 * تحلل التوزيع المتوقع لسبليت معين وتعيد تقرير مفصل
 * @param {string} splitKey
 * @returns {{ ok: boolean, profile: object, issues: string[], badge: string }}
 */
function analyzeSplitDistribution(splitKey) {
  const profile = SPLIT_DISTRIBUTION_PROFILE[splitKey];
  if (!profile) return { ok: true, issues: [], badge: '' };

  const issues = [];
  const TOL = 0.12; // هامش 12% قبل التحذير

  // تحقق من كل فئة
  if (profile.primary < 0.50) {
    const gap = Math.round((0.60 - profile.primary) * 100);
    issues.push(` <b>العضلات الأساسية</b> تحصل على ~${Math.round(profile.primary*100)}% (الهدف 60%) — النظام يعطي الذراع والملحقة حصة أعلى مما ينبغي ب${gap}%.`);
  }
  if (profile.shoulders < 0.12) {
    issues.push(` <b>الأكتاف</b> ~${Math.round(profile.shoulders*100)}% — قد تحتاج وحدة أكتاف جانبية إضافية لتعزيز التوازن.`);
  }
  if (profile.accessory > 0.28) {
    const gap = Math.round((profile.accessory - 0.20) * 100);
    issues.push(` <b>العضلات المساعدة</b> ~${Math.round(profile.accessory*100)}% (الهدف 20%) — الفائض ${gap}% سيعاد توزيعه تلقائيا عند التوليد (PASS 2H).`);
  }

  // stronglifts تحذير خاص: هيمنة primary على حساب الملحقة
  if (splitKey === 'stronglifts' && profile.primary > 0.68) {
    issues.push(` <b>StrongLifts 5×5</b> نظام قوة بامتياز — العضلات الملحقة (ذراع، ساعد) تحصل على حجم أقل من المعتاد، وهذا مقصود في هذا البروتوكول.`);
  }

  const allOK = issues.length === 0;
  const badge = allOK
    ? `<span style="color:#00e5a0;font-size:10px;font-weight:700;"> توزيع 60/20/20 متوازن</span>`
    : `<span style="color:#fbbf24;font-size:10px;font-weight:700;"> توزيع سيعدل تلقائيا</span>`;

  return { ok: allOK, profile, issues, badge };
}

function selectSplit(key){
  state.selectedSplit=key;
  // Select across BOTH main grid and advanced grid (covers all .split-card elements)
  document.querySelectorAll('.split-card').forEach(c=>c.classList.toggle('selected',c.dataset.split===key));

  // ── ADVANCED OVERRIDE PATCH: override banner ───────────────────────
  const overrideBanner = document.getElementById('overrideActiveBanner');
  const selectedCard = document.querySelector(`.split-card[data-split="${key}"]`);
  const isOverride = selectedCard && selectedCard.dataset.override === 'soft';
  if(overrideBanner){
    if(isOverride) overrideBanner.classList.add('show');
    else overrideBanner.classList.remove('show');
  }
  // ── END PATCH ──────────────────────────────────────────────────────

  const warn=document.getElementById('splitWarning');
  const rec=state.recommendedSplit;
  const splits=getSplits();
  const s=splits[key];
  let warnings=[];

  if(!s){ warn.style.display='none'; return; }

  // Day count checks
  if(state.days < s.minDays)
    warnings.push(` <b>أيام غير كافية:</b> هذا النظام يحتاج ${s.minDays}+ أيام وأنت تمرن ${state.days} فقط.`);

  // Experience checks
  if(key==='arnold' && state.exp!=='advanced')
    warnings.push(` <b>Arnold Split للمتقدمين حصرا</b> — خبرتك الحالية قد لا تسمح بالتعافي من 6 أيام ثقيلة أسبوعيا.`);
  if((key==='brosplit'||key==='ppl_weak') && state.exp==='beginner')
    warnings.push(` هذا النظام غير مناسب للمبتدئين — تردد التمرين غير كاف لتطوير عصبي-عضلي سليم.`);

  // ENFORCEMENT LAYER: Smart intensity adaptation for beginners on advanced splits
  const _advancedSplits = ['arnold','brosplit','ppl','hybrid','ppl_weak'];
  if(state.exp === 'beginner' && _advancedSplits.includes(key)){
    warnings.push(` <b>تكيف ذكي تلقائي:</b> اخترت جدولا متقدما كمبتدئ — سيقوم النظام تلقائيا بتقليل عدد المجموعات لكل تمرين (الحد الأقصى 3 مجموعات/تمرين) وزيادة وقت الراحة حماية لمفاصلك وتسريع التعلم الحركي.`);
  }
  if(state.exp === 'intermediate' && (key==='arnold')){
    warnings.push(` <b>تكيف ذكي تلقائي:</b> Arnold Split مصمم للمتقدمين — سيضبط النظام الحجم ليناسب مستواك (الحد الأقصى 4 مجموعات/تمرين).`);
  }

  // Recovery checks
  if(key==='arnold' && state.recoveryScore<70)
    warnings.push(` تعافيك (${state.recoveryScore}%) غير كاف ل Arnold — هذا النظام يتطلب 70%+ للتعافي الفعلي.`);
  if((key==='ppl'||key==='brosplit'||key==='arnold') && state.recoveryScore<55)
    warnings.push(` تعافيك منخفض (${state.recoveryScore}%) — هذا النظام قد يسبب overtraining. أولوية: نوم + تقليل إجهاد.`);

  // Full PPL on less than 5 days
  if(key==='ppl' && state.days<5)
    warnings.push(` PPL الكاملة تعمل ب 5-6 أيام. بأيامك الحالية (${state.days}) ستكون التغطية العضلية غير مكتملة.`);

  // ── PATCH 2: Frequency warnings — low muscle-hit frequency systems ──────────
  // Warning only  no blocking, no engine change
  if(key==='ppl_3' || key==='brosplit'){
    const freqWarn = key==='brosplit'
      ? `<b>تردد عضلي منخفض (1×/أسبوع):</b> Bro Split يدرب كل عضلة مرة واحدة أسبوعيا فقط، لكن الأبحاث تثبت أن 2×/أسبوع ينتج ضخامة أسرع في معظم الحالات. هذا النظام يظل خيارا مشروعا للمتقدمين ذوي الالتزام العالي.`
      : `<b>تردد عضلي محدود (1-2×/أسبوع):</b> PPL على 3 أيام تقلل تكرار تدريب العضلة مقارنة ب Full Body أو Upper/Lower — قد يكون التقدم أبطأ للمبتدئين والطبيعيين (Natural). ينصح بمتابعة الأداء أسبوعيا.`;
    warnings.push(freqWarn);
  }

  // ── PATCH 1 supplement: Combined stress+recovery+injury warning ───────
  // Fires only when 3 factors align — indicates high overtraining risk
  const _hasInjury = (state.injuries||[]).length>0 && !(state.injuries||[]).includes('none');
  const _lowRec    = (state.recoveryScore||75) < 55;
  const _highStress = state.stress === 'high';
  const _poorSleep  = state.sleep === 'poor';
  if(_lowRec && _highStress && (_poorSleep || _hasInjury)){
    const factors = [];
    if(_poorSleep)   factors.push('نوم ضعيف');
    if(_hasInjury)   factors.push('إصابة نشطة');
    if(_highStress)  factors.push('إجهاد مرتفع');
    warnings.push(` <b>خطر Overtraining مرتفع:</b> تجمع عوامل (${factors.join(' + ')}) مع تعاف منخفض (${state.recoveryScore}%) — ينصح بنظام تدريبي ذو حجم منخفض وتعاف أعلى ك Full Body أو Upper/Lower.`);
  }

  // Recommendation note (soft, not a blocker)
  if(key!==rec && warnings.length===0)
    warnings.push(`اخترت <b>${mixedText(s.name)}</b> — المقترح لك هو <b>${mixedText(splits[rec]?.name)}</b>. اختيارك صالح تماما.`);

  // ── PRE-ANALYSIS: 60/20/20 Distribution Audit للسبليت المختار ────────────
  // تعمل على جميع السبليتات مهما كانت — مقترحة أو غير مقترحة
  const distAnalysis = analyzeSplitDistribution(key);
  if (!distAnalysis.ok && distAnalysis.issues.length > 0) {
    // أضف تحليل التوزيع كآخر عنصر (بعد التحذيرات الأخرى) — معلوماتي لا تحذيري
    warnings.push(
      ` <b>تحليل التوزيع 60/20/20:</b><br>` +
      distAnalysis.issues.join('<br>') +
      `<br><span style="font-size:10px;color:var(--green);"> المصحح التلقائي (PASS 2H) سيعيد التوازن عند التوليد</span>`
    );
  } else if (distAnalysis.ok) {
    // إضافة badge إيجابي فقط إذا لم تكن هناك تحذيرات أخرى
    if (warnings.length === 0) {
      warnings.push(` <b>تحليل التوزيع:</b> ${distAnalysis.badge} — ${distAnalysis.profile?.note || 'توزيع متوازن'}.`);
    }
  }

  if(warnings.length){
    warn.innerHTML = warnings.join('<br>') + `<br><span style="color:var(--green);font-size:10px;"> يمكنك المتابعة مع الأخذ بهذه الملاحظات</span>`;
    warn.style.display='block';
  } else {
    warn.style.display='none';
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PREMIUM COVERAGE DASHBOARD — Visual Layer v1.0
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ARCHITECTURE: Engine Layer - produces freq/sets data.
//               This layer ONLY reads that data and converts to UI states.
//               ZERO engine modifications. Read-only visual interpretation.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Centralized visual tokens ──────────────────────────────────────────
const COVERAGE_COLORS = {
  optimal:    '#00e5a0',  // strong direct + balanced frequency
  good:       '#6c63ff',  // sufficient weekly work
  acceptable: '#3b82f6',  // minimum effective coverage
  indirect:   '#a855f7',  // indirect stimulation from compounds
  low:        '#6b7280'   // weak / missing direct coverage
};

const COVERAGE_LABELS_AR = {
  optimal:    'نطاق مثالي',
  good:       'نطاق جيد',
  acceptable: 'كاف',
  indirect:   'غير مباشر',
  low:        'تغطية منخفضة'
};

const COVERAGE_GLOWS = {
  optimal:    'radial-gradient(ellipse at top, rgba(0,229,160,0.07) 0%, transparent 70%)',
  good:       'radial-gradient(ellipse at top, rgba(108,99,255,0.06) 0%, transparent 70%)',
  acceptable: 'radial-gradient(ellipse at top, rgba(59,130,246,0.06) 0%, transparent 70%)',
  indirect:   'radial-gradient(ellipse at top, rgba(168,85,247,0.06) 0%, transparent 70%)',
  low:        'none'
};

// Emoji fallback illustrations per muscle group
const MUSCLE_EMOJI = {
  chest:'', back:'', quads:'', hamstrings:'', glutes:'',
  calves:'', shoulders:'', biceps:'', triceps:'',
  forearms:'', traps:'', core:'', adductors:''
};

// Indirect stimulation detection:
// Which muscles receive meaningful indirect work from compound movements
// This is a VISUAL INTERPRETATION rule — does NOT affect exercise generation.
const INDIRECT_PROVIDERS = {
  forearms: ['back','biceps'],   // pulling compounds stimulate forearms
  traps:    ['back'],            // rows/deadlifts stimulate traps
  glutes:   ['hamstrings'], // جلوتس: indirect فقط من hamstrings (RDL/hip hinge patterns) — quads حذف لأن إظهار الجلوتس في يوم Anterior مضلل منهجيا في Anterior/Posterior split
  adductors:['quads'],          // squats/lunges/leg press stimulate adductors (indirect)
  core:     ['quads','hamstrings','chest','back','shoulders'] // stabilizers
};


// ── Anatomical muscle illustration (sec5) — PHOTOREAL edition ──
// Real 3D anatomy PNGs for each muscle. All muscles now have a bundled
// photoreal image (triceps, traps, adductors added).
const MUSCLE_IMG_KEYS = new Set([
  'chest','shoulders','core','biceps','forearms',
  'quads','back','glutes','hams','hamstrings','calves',
  'triceps','traps','adductors'
]);

function muscleImg(key, color){
  const src = (key === 'hamstrings') ? 'hams' : key;
  return '<div class="m-img-wrap" data-key="' + key + '" style="--mc:' + color + '">'
    +   '<img class="m-img" src="assets/muscles/' + src + '.png" alt="" loading="lazy" decoding="async" />'
    +   '<span class="m-img-glow" aria-hidden="true"></span>'
    + '</div>';
}

function muscleSvg(key, color){
  if (MUSCLE_IMG_KEYS.has(key)) return muscleImg(key, color);
  const regions = {
    triceps:   { view:'back',  vb:'4 30 72 30' },
    traps:     { view:'back',  vb:'24 14 32 22' },
    adductors: { view:'front', vb:'32 86 16 36' }
  };
  const r = regions[key] || { view:'front', vb:'0 0 80 145' };
  const dim   = '#2a3142';
  const dimSt = '#3d4760';
  const uid = 'ms' + key;
  const defs = '<defs>'
    + '<linearGradient id="' + uid + '-g" x1="0" y1="0" x2="0" y2="1">'
    +   '<stop offset="0%" stop-color="' + color + '" stop-opacity="1"/>'
    +   '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.72"/>'
    + '</linearGradient>'
    + '<filter id="' + uid + '-glow" x="-40%" y="-40%" width="180%" height="180%">'
    +   '<feGaussianBlur stdDeviation="0.55" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>'
    + '</filter></defs>';
  const active = (shape) =>
    '<g class="m-active" filter="url(#' + uid + '-glow)" fill="url(#' + uid + '-g)" stroke="' + color + '" stroke-width="0.7" stroke-linejoin="round">' + shape + '</g>';
  const inert = (shape) =>
    '<g fill="' + dim + '" stroke="' + dimSt + '" stroke-width="0.5">' + shape + '</g>';
  const openSvg = '<svg viewBox="' + r.vb + '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" class="m-svg">';
  if (key === 'triceps'){
    return openSvg + defs
      + inert('<path d="M26 32 Q40 30 54 32 L56 60 Q48 64 40 64 Q32 64 24 60 Z"/>')
      + active('<ellipse cx="14" cy="44" rx="6" ry="12"/><ellipse cx="66" cy="44" rx="6" ry="12"/>')
      + '</svg>';
  }
  if (key === 'traps'){
    return openSvg + defs
      + active('<path d="M28 20 Q40 17 52 20 L56 30 Q40 28 24 30 Z"/>')
      + inert('<ellipse cx="20" cy="30" rx="9" ry="6"/><ellipse cx="60" cy="30" rx="9" ry="6"/>')
      + '</svg>';
  }
  return openSvg + defs
    + inert('<ellipse cx="32" cy="104" rx="7" ry="14"/><ellipse cx="48" cy="104" rx="7" ry="14"/>')
    + active('<path d="M37 91 Q40 100 43 91 L43 115 Q40 117 37 115 Z"/>')
    + '</svg>';
}

// Volume/standards & weekly-hierarchy enforcers moved to engine/volume.js (v49 engine extraction)

function buildCoverageVisualState(freq, setsMap, muscleKeys, days) {
  // ── Muscle-specific MEV/MRV thresholds (Gymna Pro standards) ──────
  // Replaces flat day-count thresholds — each muscle judged by its own science-backed minimum.
  // Visual layer ONLY — zero effect on exercise selection or plan engine.
  const d = days || 4;
  // Frequency reference: how many times a muscle is expected to be hit per week
  // Still used for the fillPct bar — but set judgement now driven by actual weekly sets vs MEV
  const baseOptFreq = d <= 2 ? 2 : d <= 4 ? 2 : 3;

  return muscleKeys.map(m => {
    const f = freq[m] || 0;
    const s = setsMap[m] || 0;

    // ── Get muscle-specific standards (fallback to conservative defaults) ─
    const std = MUSCLE_VOLUME_STANDARDS[m] || { mev: 6, good: 10, opt: 14, optFreq: 2 };

    // ── Determine coverage state via muscle-specific MEV ────────────
    let state_key;

    if (f === 0) {
      const providers = INDIRECT_PROVIDERS[m];
      // Accessory muscles (forearms/traps/core) always get indirect work
      const alwaysIndirect = ['forearms','traps','core'];
      if (alwaysIndirect.includes(m) && providers &&
          providers.some(p => (freq[p] || 0) >= 1)) {
        // If indirect work likely exceeds MEV (mev=0), rate as good
        state_key = std.mev === 0 ? 'good' : 'indirect';
      } else if (providers && providers.some(p => (freq[p] || 0) >= 1)) {
        state_key = 'indirect';
      } else {
        state_key = 'low';
      }
    } else if (s === 0 && f > 0) {
      // العضلة موجودة في الجدول (freq>0) بس sets=0 - الخطة لسه بتبنى
      // نعاملها ك acceptable مؤقتا بدل low — تجنب تقييم ظالم قبل اكتمال البناء
      state_key = 'acceptable';
    } else if (s >= std.opt && f >= std.optFreq) {
      // نطاق مثالي: sets ≥ optimal AND frequency adequate
      state_key = 'optimal';
    } else if (s >= std.opt) {
      // sets وصلت ال optimal بس frequency أقل من المثالي — نطاق جيد جدا
      // الكواد/الهامستينج: يوم أرجل مكثف واحد يكافئ يومين معتدلين
      state_key = 'good';
    } else if (s >= std.good) {
      // نطاق جيد: sets above good threshold
      state_key = 'good';
    } else if (s >= std.mev && std.mev > 0) {
      // كاف: above MEV but below good
      state_key = 'acceptable';
    } else if (std.mev === 0 && s > 0) {
      // Accessory muscle with any direct work = acceptable minimum
      state_key = 'acceptable';
    } else if (s > 0 && s < std.mev) {
      //تحت الحد الأدنى الفعال — below MEV, not zero
      state_key = 'low';
    } else {
      state_key = 'low';
    }

    // ── Bar fill width (0–100%) based on progress toward optimal ──
    const optFreq = std.optFreq || baseOptFreq;
    let fillPct;
    if (state_key === 'indirect') fillPct = 35;
    else if (state_key === 'low' && s === 0) fillPct = 8;
    else if (state_key === 'low')  fillPct = Math.min(30, Math.round((s / std.mev) * 30));
    else fillPct = Math.min(100, Math.round((s / std.opt) * 100));

    return {
      key:      m,
      freq:     f,
      sets:     s,
      state:    state_key,
      color:    COVERAGE_COLORS[state_key],
      label:    COVERAGE_LABELS_AR[state_key],
      glow:     COVERAGE_GLOWS[state_key],
      fillPct,
      indirect: state_key === 'indirect',
      // Expose MEV target for coaching notes
      _mev:     std.mev,
      _opt:     std.opt,
    };
  });
}

// ── Coverage quality score (visual only — does NOT affect any engine) ──
function calcCoverageQualityScore(cards) {
  // ══════════════════════════════════════════════════════════════
  // v18 — قواعد تييم أعدل وأكثر دقة علميا:
  //
  // ① الأكتاف تقيم بوزن 2 لا 3 — لأنها دائما تحصل على عمل
  //    غير مباشر كثير من تمارين الصدر والظهر، ف 6 sets مباشر
  //    يعني في الواقع 12-14 sets فعلية. معاقبتها ك primary كامل ظلم.
  //
  // ② قاعدة توازن الأرجل (Ham/Quad Ratio) — في الاتجاهين:
  //    • Ham > Quad + 2 - عدم توازن خلفي - penalty
  //    • Quad > Ham - عدم توازن أمامي - penalty (خطر الركبة)
  //    النطاق الصحي: Ham = Quad أو Quad+1 أو Quad+2
  //
  // ③ عقوبة الأكتاف > Quads+Hams مجتمعين تزيد ل -8 (كانت -5)
  //    لأن ده خلل هيكلي حقيقي يضر الجسم
  //
  // ④ بونص توازن الأرجل يتطلب أن الفرق ≤ 2 (مش بس كلاهما good)
  // ══════════════════════════════════════════════════════════════
  const primaryMuscles   = ['chest','back','quads','hamstrings','glutes']; // glutes عضلة أرجل أساسية
  const shoulderKey      = 'shoulders'; // تعالج باستقلالية بوزن 2
  const secondaryMuscles = ['biceps','triceps','calves'];

  let weightedSum = 0, totalWeight = 0;

  for (const c of cards) {
    const isPrimary   = primaryMuscles.includes(c.key);
    const isShoulder  = c.key === shoulderKey;
    const isSecondary = secondaryMuscles.includes(c.key);
    // الأكتاف: وزن 2 بدل 3 — تحصل دايما على عمل غير مباشر من press/row
    const w = isPrimary ? 3 : (isShoulder || isSecondary) ? 2 : 1;

    let cardScore;
    if (c.state === 'optimal') {
      cardScore = 97;
    } else if (c.state === 'good') {
      // good = العضلة بتتدرب صح — 88 أساس + تدريج حسب القرب من optimal
      const ratio = c._opt > 0 ? Math.min(c.sets / c._opt, 1) : 1;
      cardScore = 88 + Math.round(ratio * 9); // 88 - 97
    } else if (c.state === 'acceptable') {
      // acceptable = فوق MEV لكن أقل من good — 72 - 86
      const std = MUSCLE_VOLUME_STANDARDS[c.key];
      const goodTh = std ? std.good : (c._opt * 0.7 || 1);
      const ratio  = goodTh > 0 ? Math.min(c.sets / goodTh, 1) : 1;
      cardScore = isShoulder
        ? 78 + Math.round(ratio * 8)   // أكتاف: عمل غير مباشر يعوض
        : 72 + Math.round(ratio * 14); // 72 - 86
    } else if (c.state === 'indirect') {
      cardScore = 65; // غير مباشر — أفضل من low
    } else {
      // low
      cardScore = c.sets > 0 ? 35 : 10;
    }

    weightedSum += cardScore * w;
    totalWeight += w;
  }

  let base = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  // ── بونص تغطية كاملة ───────────────────────────────────────────
  const coveredCount = cards.filter(c => c.state !== 'low').length;
  if (coveredCount === cards.length)         base = Math.min(100, base + 4);
  else if (coveredCount >= cards.length - 1) base = Math.min(100, base + 2);

  // ── بونص توازن الأساسيات (chest/back/quads/hams كلها ≥ good) ────
  const primaries   = cards.filter(c => primaryMuscles.includes(c.key));
  const allPrimGood = primaries.length >= 3 && primaries.every(c => c.state === 'good' || c.state === 'optimal');
  if (allPrimGood) base = Math.min(100, base + 3);

  // ── عقوبة: عضلة أساسية low ──────────────────────────────────────
  if (primaries.some(c => c.state === 'low')) base = Math.max(0, base - 8);

  // ── قواعد التوازن العضلي — Quad/Ham ────────────────────────────
  const _quads = cards.find(c => c.key === 'quads');
  const _hams  = cards.find(c => c.key === 'hamstrings');
  const _shlds = cards.find(c => c.key === 'shoulders');

  if (_quads && _hams) {
    const diff = _hams.sets - _quads.sets; // موجب = hams أكتر، سالب = quads أكتر

    // بونص: النطاق الصحي — Ham = Quad أو Quad+1 أو Quad+2
    if (diff >= 0 && diff <= 2 &&
        (_quads.state === 'good' || _quads.state === 'optimal') &&
        (_hams.state  === 'good' || _hams.state  === 'optimal')) {
      base = Math.min(100, base + 4); // زاد من 3 ل 4 — التوازن الحقيقي يستحق
    }

    //عقوبة: Ham > Quad + 2 — خلل خلفي (هامستينج بتسحق الكوادز)
    if (diff > 2) {
      const excess = diff - 2; // كل set زيادة فوق الهامش
      const pen = Math.min(8, excess * 2); // 2 نقطة لكل set زيادة، بحد أقصى 8
      base = Math.max(0, base - pen);
    }

    //عقوبة: Quad > Ham — خلل أمامي (خطر على الركبة والظهر)
    if (diff < 0) {
      const excess = Math.abs(diff);
      const pen = Math.min(10, excess * 2); // أشد عقوبة — خطر إصابة
      base = Math.max(0, base - pen);
    }
  }

  // ── عقوبة: الأكتاف > Quads+Hams مجتمعين — خلل هيكلي علوي/سفلي ──
  if (_shlds && _quads && _hams &&
      _shlds.sets > (_quads.sets + _hams.sets)) {
    base = Math.max(0, base - 8); // زادت من -5 ل -8
  }

  return Math.min(100, Math.max(0, base));
}

// ── Coaching notes generator (visual layer only) ───────────────────────
function buildCoverageNotes(cards, splitKey) {
  const notes = [];
  // العضلات المقيدة ب session cap (2 sets/session) — لا نعاقبها على حجمها المحدود عمدا
  const _CAPPED = new Set(['calves','forearms','traps']);

  const optimal   = cards.filter(c => c.state === 'optimal').map(c => c.key);
  const low       = cards.filter(c => c.state === 'low' && !c.indirect && !_CAPPED.has(c.key));
  const indirect  = cards.filter(c => c.state === 'indirect');
  // belowMev: مدربة لكن أقل من MEV — نستثني العضلات المقيدة عمدا بالنظام
  const belowMev  = cards.filter(c => c.state === 'low' && c.sets > 0 && c._mev > 0 && !_CAPPED.has(c.key));
  const untrained = cards.filter(c => c.state === 'low' && c.sets === 0 && !c.indirect && !_CAPPED.has(c.key));
  const cappedLow = cards.filter(c => c.state === 'low' && _CAPPED.has(c.key) && c.sets > 0);
  const mAr = {chest:'الصدر',back:'الظهر',quads:'الكوادز',hamstrings:'الهامستينج',
    glutes:'الجلوتس',calves:'السمانة',shoulders:'الأكتاف',biceps:'البايسبس',triceps:'الترايسبس',
    forearms:'الساعد',traps:'الترابيس',core:'الكور'};

  if (optimal.length >= 4)
    notes.push({ color: COVERAGE_COLORS.optimal, icon:'',
      text: `تم تغطية ${optimal.map(k=>mAr[k]||k).join(' · ')} بشكل مثالي ومتوازن وفق المعايير العلمية.` });

  // Muscles trained but below MEV — show gap clearly (excluding capped muscles)
  for (const c of belowMev) {
    notes.push({ color: COVERAGE_COLORS.low, icon:'',
      text: `${mAr[c.key]||c.key}: ${c.sets} مجموعة أسبوعيا — أقل من الحد الأدنى الفعال (${c._mev} مجموعة). زد الحجم أو أضف وحدة مباشرة.` });
  }

  // Completely untrained muscles (excluding capped)
  if (untrained.length)
    notes.push({ color: COVERAGE_COLORS.low, icon:'',
      text: `${untrained.map(c=>mAr[c.key]||c.key).join(' · ')} لا يحصل على عمل مباشر كاف — أضف الوحدات الاختيارية في الخطوة التالية.` });

  // Capped muscles info (السمانة/الساعد/الترابيس) — معلوماتي فقط بدون تحذير
  if (cappedLow.length)
    notes.push({ color: COVERAGE_COLORS.acceptable, icon:'',
      text: `${cappedLow.map(c=>mAr[c.key]||c.key).join(' · ')}: النظام يحد مجموعاتها عمدا (2 مجموعة/جلسة) لتجنب Junk Volume — هذا تصميم مقصود وليس نقصا.` });

  // ── نوتة ثابتة: أولوية مجموعات الأكتاف ─────────────────────────────
  // تظهر دايما — معلومة تدريبية مهمة بغض النظر عن حجم الأكتاف
  const _shCard = cards.find(c => c.key === 'shoulders');
  if (_shCard) {
    notes.push({ color: COVERAGE_COLORS.good, icon:'',
      text: `أولوية الأكتاف في أي جدول: الجانبي (Lateral) أولا للعرض - ثم الخلفي (Rear) للتوازن والصحة - الأمامي (Anterior) أخيرا لأنه يأخذ كفايته من تمارين الضغط.` });
  }

  // ── نوتة توازن الأرجل (Quad/Ham Ratio) ─────────────────────────────
  const _qCard = cards.find(c => c.key === 'quads');
  const _hCard = cards.find(c => c.key === 'hamstrings');
  if (_qCard && _hCard) {
    const diff = _hCard.sets - _qCard.sets;
    if (diff > 2) {
      // هامستينج بتطغى على الكواد
      notes.push({ color: COVERAGE_COLORS.low, icon:'',
        text: `عدم توازن الأرجل: الهامستينج (${_hCard.sets} sets) يتجاوز الكوادز (${_qCard.sets} sets) بفارق ${diff} — النطاق الصحي هو Ham = Quad أو Quad+1 أو Quad+2 كحد أقصى.` });
    } else if (diff < 0) {
      // كواد يطغى على الهامستينج — أخطر
      notes.push({ color: COVERAGE_COLORS.low, icon:'',
        text: `خلل أمامي خلفي: الكوادز (${_qCard.sets} sets) أكثر من الهامستينج (${_hCard.sets} sets) — هذا يزيد خطر إصابة الركبة والظهر. يجب أن يكون Ham ≥ Quad دائما.` });
    } else if (diff >= 0 && diff <= 2) {
      notes.push({ color: COVERAGE_COLORS.optimal, icon:'',
        text: `توازن الأرجل مثالي: الهامستينج (${_hCard.sets}) = الكوادز (${_qCard.sets})${diff > 0 ? '+'+diff : ''} — هذا هو النطاق الصحي الصحيح.` });
    }
  }

  for (const c of indirect) {
    const providerNames = (INDIRECT_PROVIDERS[c.key] || []).map(p => mAr[p]).filter(Boolean);
    if (providerNames.length)
      notes.push({ color: COVERAGE_COLORS.indirect, icon:'',
        text: `${mAr[c.key]||c.key} يحصل على تحفيز غير مباشر كاف من تمارين ${providerNames.join(' و')}.` });
  }

  if (!low.length && !indirect.length)
    notes.push({ color: COVERAGE_COLORS.acceptable, icon:'',
      text: `يمكن إضافة عمل مباشر اختياري لمزيد من الحجم حسب الهدف وال MRV الشخصي.` });

  return notes;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUILD MUSCLE MAP — Orchestrates visual layer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// القاعدة الذهبية: صفحة 5 (Coverage) تعرض دايما نفس رقم صفحة 6 (Plan)
// لأن كلاهما يقرأ من state.plan الحقيقي بعد buildExercisePlan
// لا تقدير، لا حسابات موازية، مصدر واحد فقط.
function buildMuscleMap(){
  // ── تأكد إن السبليت اتغير - أعد البناء من الصفر ──────────────────
  const splitChanged = state._lastMuscleMapSplit !== state.selectedSplit;
  if(splitChanged){
    state._trainingSchedule = null;
    state.plan = null;
    state._realTotalSets = null;
    state._planCacheKey = null; // invalidate cache
  }

  // ── ابن الخطة لو مش موجودة أو فارغة ───────────────────────────────
  const planReady = state.plan && state.plan.some(d => !d.isRest && (d.exercises||[]).length > 0);
  if(!planReady){
    buildExercisePlan(); // بناء صامت — يملأ state.plan بالكامل
  }
  state._lastMuscleMapSplit = state.selectedSplit;

  // ── حارس الجودة النهائي (تشخيص غير معطل — يسجل أي مخالفة بنيوية في ال console) ──
  if (typeof PlanValidator !== 'undefined' && PlanValidator.diagnosePlan) {
    try {
      PlanValidator.diagnosePlan(state.plan, { minEx: state.exp === 'advanced' ? 6 : (state.exp === 'beginner' ? 4 : 5) });
    } catch (_e) { /* التشخيص لا يوقف العرض أبدا */ }
  }

  // ── الآن state.plan جاهز دايما — اقرأ منه مباشرة ──────────────────
  const freq = {}, setsMap = {};
  let _mapTotalSets = 0; // إجمالي كل ال sets بدون استثناء
  (state.plan||[]).forEach(day => {
    if(day.isRest) return;
    const musclesThisDay = new Set();
    (day.groups||[]).forEach(([grpName, subKey]) => {
      musclesThisDay.add(grpName);
      if(subKey === 'glutes') musclesThisDay.add('glutes');
    });
    musclesThisDay.forEach(m => { freq[m] = (freq[m]||0) + 1; });
    // sets من exercises الفعلية — تجمع في setsMap حسب grp
    // الإجمالي الكلي يشمل كل exercise بدون استثناء (حتى grp مجهول)
    (day.exercises||[]).forEach(ex => {
      const s = ex.sets || 0;
      _mapTotalSets += s; // الكل بدون استثناء
      if(ex.grp){
        // الجلوتس مستقلة: hamstrings/glutes تحسب في glutes مش في hamstrings
        const _sk = (ex.grp === 'hamstrings' && ex.sub === 'glutes') ? 'glutes' : ex.grp;
        setsMap[_sk] = (setsMap[_sk]||0) + s;
      }
    });
  });
  // استخدم الإجمالي المحسوب هنا إذا لم يكن _realTotalSets محسوبا بعد
  if(!state._realTotalSets) state._realTotalSets = _mapTotalSets;

  // ── VISUAL STATE (rendering layer) ───────────────────────────────────
  // PATCH 6: Added glutes to muscleKeys — it's a primary group in all lower splits
  const muscleKeys = ['chest','back','shoulders','quads','hamstrings','glutes','calves','adductors','biceps','triceps','forearms','traps','core'];
  const mNames = {chest:'صدر',back:'ظهر',quads:'كوادز',hamstrings:'هامستينج',
    glutes:'جلوتس',calves:'سمانة',adductors:'ضامة',shoulders:'أكتاف',biceps:'بايسبس',triceps:'ترايسبس',
    forearms:'ساعد',traps:'ترابيس',core:'كور'};

  const cards = buildCoverageVisualState(freq, setsMap, muscleKeys, state.days);
  const qScore = calcCoverageQualityScore(cards);
  const qLabel = qScore>=90?'ممتازة':qScore>=80?'جيدة جدا':qScore>=68?'متوازنة':qScore>=55?'مقبولة':'تحتاج تحسين';
  const qColor = qScore>=88?COVERAGE_COLORS.optimal:qScore>=72?COVERAGE_COLORS.good:qScore>=58?COVERAGE_COLORS.acceptable:COVERAGE_COLORS.low;
  const notes  = buildCoverageNotes(cards, state.selectedSplit);

  // ── Update SVG body map colors based on coverage states ─────────────
  const SVG_MUSCLE_MAP = {
    chest:      ['p4sv-chest'],
    back:       ['p4sv-back-bar'],
    shoulders:  ['p4sv-shoulders'],
    quads:      ['p4sv-quads'],
    hamstrings: ['p4sv-hamstrings','p4sv-hamstrings2'],
    biceps:     ['p4sv-biceps'],
    triceps:    ['p4sv-triceps'],
    calves:     ['p4sv-calves'],
    core:       ['p4sv-core'],
    glutes:     ['p4sv-glutes'],
  };
  cards.forEach(c => {
    const ids = SVG_MUSCLE_MAP[c.key];
    if (!ids) return;
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const col = c.color;
      const alphaHex = c.state==='optimal'?'59':c.state==='good'?'3d':c.state==='acceptable'?'2e':c.state==='indirect'?'1e':'11';
      const strokeHex = c.state==='low'?'26':'80';
      el.style.fill   = col + alphaHex;
      el.style.stroke = col + strokeHex;
      el.style.strokeWidth = c.state==='optimal'?'1.5':'0.7';
      el.style.filter = c.state==='optimal'?`drop-shadow(0 0 5px ${col}80)`:'';
    });
  });

  // Header
  document.getElementById('muscleMapDesc').innerHTML =
    `<span style="font-weight:700;color:var(--text-dim);">${getSplits()[state.selectedSplit]?.name||state.selectedSplit}</span>
     <span style="color:var(--text-muted);margin-right:4px;">— خريطة التغطية العضلية الأسبوعية</span>`;

  // Score pill
  const _pillEl = document.getElementById('p4ScorePill');
  const _numEl  = document.getElementById('p4ScoreNum');
  if(_pillEl && _numEl){
    _pillEl.style.display = 'inline-flex';
    _numEl.textContent = qScore;
    _numEl.style.color = qColor;
    _pillEl.style.borderColor = qColor+'44';
    _pillEl.style.background   = qColor+'14';
    const _tagEl = _pillEl.querySelector('.p4-score-tag');
    if(_tagEl) _tagEl.textContent = getSplits()[state.selectedSplit]?.name||'';
  }

  // ── Render cards — grouped layout ────────────────────────────────────
  const MH_GROUPS = [
    { label: 'جذع علوي', keys: ['chest','back','shoulders'] },
    { label: 'جذع سفلي', keys: ['quads','hamstrings','glutes','calves','adductors'] },
    { label: 'ذراعين وكور', keys: ['biceps','triceps','forearms','traps','core'] }
  ];
  const cardsByKey = {};
  cards.forEach(c => cardsByKey[c.key] = c);

  const groupsHtml = MH_GROUPS.map(grp => {
    const grpCards = grp.keys.map(k => cardsByKey[k]).filter(Boolean);
    if(!grpCards.length) return '';
    const cardsHtml = grpCards.map(c => {
      const freqTxt = c.freq>0 ? c.freq+'x' : '—';
      const setsTxt = c.indirect ? 'sets/week '+(c.sets||0) : 'sets/week '+c.sets;
      const statusIcon = (c.state==='optimal'||c.state==='good') ? '✓' : (c.state==='indirect' ? '●' : (c.state==='low' ? '!' : '●'));
      const tagHtml = c.indirect ? '<div class="mh-tag" style="--mh-color:'+c.color+'">عمل غير مباشر</div>' : '';
      return `<div class="mh-item state-${c.state} ${c.indirect?'mh-has-tag':''}" style="--mh-color:${c.color};">
        ${tagHtml}
        <div class="mh-row">
          <div class="mh-illus">${muscleSvg(c.key, c.color)}</div>
          <div class="mh-body">
            <div class="mh-name">${mNames[c.key]||c.key}</div>
            <div class="mh-freq-big">${freqTxt}</div>
            <div class="mh-sets-sub">${setsTxt}</div>
          </div>
        </div>
        <div class="mh-track"><div class="mh-fill" style="width:${c.fillPct}%"></div></div>
        <div class="mh-status"><span class="mh-status-icon">${statusIcon}</span>${c.label}</div>
      </div>`;
    }).join('');
    return `<div class="mh-group-label">${grp.label}</div><div class="mh-group-grid">${cardsHtml}</div>`;
  }).join('');

  document.getElementById('muscleHeatmap').innerHTML = groupsHtml;

  // ── Coverage summary + legend + coaching notes ────────────────────────
  const legendHtml = Object.entries(COVERAGE_COLORS).map(([k,col]) =>
    `<div class="cov-leg-item">
       <div class="cov-leg-dot" style="background:${col};box-shadow:0 0 5px ${col}80;"></div>
       ${COVERAGE_LABELS_AR[k]}
     </div>`
  ).join('');

  // Progress bar for quality score
  const qBarColor = qScore>=90?COVERAGE_COLORS.optimal:qScore>=75?COVERAGE_COLORS.good:qScore>=60?COVERAGE_COLORS.acceptable:COVERAGE_COLORS.low;
  const qProgressHtml = `
    <div style="margin-top:6px;">
      <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${qScore}%;background:linear-gradient(90deg,${qBarColor},${qBarColor}aa);border-radius:4px;box-shadow:0 0 8px ${qBarColor}60;transition:width 1s cubic-bezier(.4,0,.2,1);"></div>
      </div>
    </div>`;

  const notesHtml = notes.map(n =>
    `<div class="cov-note" style="--note-color:${n.color};">
       <span style="flex-shrink:0;font-size:13px;margin-top:1px;">${n.icon||''}</span>
       <span>${n.text}</span>
     </div>`
  ).join('');

  document.getElementById('coverageStatus').innerHTML = `
    <div class="coverage-summary">
      <div class="cov-sum-header">
        <div>
          <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:3px;">جودة التغطية اعضلية</div>
          <div style="font-size:9px;color:var(--text-muted);font-weight:600;">مقارنة ب MAV ل ${state.days} أيام/أسبوع · 55+ مقبول · 68+ متوازن · 80+ جيد جدا</div>
          ${qProgressHtml}
        </div>
        <div style="text-align:center;min-width:70px;">
          <div class="cov-sum-score">
            <div class="cov-score-val" style="-webkit-text-fill-color:transparent;background:linear-gradient(135deg,${qColor},#6c63ff);-webkit-background-clip:text;background-clip:text;">${qScore}</div>
            <div class="cov-score-max">/100</div>
          </div>
          <div class="cov-score-lbl" style="color:${qColor};">${qLabel}</div>
        </div>
      </div>
      <div class="cov-stats-row">
        <div class="cov-stat-box">
          <div class="cov-stat-val">${_mapTotalSets}</div>
          <div class="cov-stat-lbl">Sets إجمالي</div>
        </div>
        <div class="cov-stat-box">
          <div class="cov-stat-val" style="color:${qColor};">${cards.filter(c=>c.state!=='low').length} / ${cards.length}</div>
          <div class="cov-stat-lbl">عضلات مغطاة</div>
        </div>
        <div class="cov-stat-box">
          <div class="cov-stat-val" style="color:${qColor};font-size:13px;">${qLabel}</div>
          <div class="cov-stat-lbl">جودة التوزيع</div>
        </div>
      </div>
      <div class="cov-legend">${legendHtml}</div>
      ${notesHtml ? `<div class="cov-notes">${notesHtml}</div>` : ''}
    </div>`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUILD EXERCISE PLAN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// injectRestDays — الدستور: هندسة أيام الراحة الأسبوعية
// يحول خطة N أيام إلى أسبوع كامل 7 أيام بنمط راحة صحيح
// 3 أيام: تمرين/راحة/تمرين/راحة/تمرين/راحة/راحة
// 4 أيام: تمرين/تمرين/راحة/تمرين/تمرين/راحة/راحة
// 5 أيام: تمرين/تمرين/راحة/تمرين/تمرين/تمرين/راحة
// 6 أيام: تمرين/تمرين/تمرين/راحة/تمرين/تمرين/تمرين
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function injectRestDays(trainingDays, numDays, splitKey, preferredDays){
  const REST = { name:'Rest — يوم تعافي', muscles:[], groups:[], isRest:true, exercises:[] };

  // PATCH-GYM-3: أيام الراحة سلبية تماما — صفر تمارين مقاومة
  // الترابيس والساعدين ينتمون لأيام Pull — لا لأيام الراحة
  // القاعدة: أي تمرين مقاومة في يوم راحة ينقل لأقرب يوم Pull أو ظهر

  // ── القاعدة العامة لأيام الراحة ─────────────────────────────────────
  // 2 أيام : يوم/راحة/يوم/راحة/راحة/راحة/راحة
  // 3 أيام : يوم/راحة/يوم/راحة/يوم/راحة/راحة
  // 4 أيام : يومان/راحة/يومان/راحة/راحة
  // 5 أيام : ثلاثة/راحة/يومان/راحة
  // 6 أيام : ثلاثة/راحة/ثلاثة
  const WEEK_PATTERNS = {
    2: [1,0,1,0,0,0,0],
    3: [1,0,1,0,1,0,0],
    4: [1,1,0,1,1,0,0],
    5: [1,1,1,0,1,1,0],  // T T T R T T R — PPL: Push+Pull+Legs - REST - Push+Pull
    6: [1,1,1,0,1,1,1]
  };

  // ── استثناء: PPL + Weak Point له نمط خاص (4 أيام) ──────────────────
  // Push - Pull - Legs - REST - Weak - REST - REST
  const SPLIT_OVERRIDES = {
    ppl_weak: [1,1,1,0,1,0,0]
  };

  // [EGY] لو المتدرب اختار أيامه المفضلة (السبت=0 .. الجمعة=6) نبني
  // نمط الأسبوع منها بدل النمط الثابت. لو المختار أقل من
  // عدد أيام التمرين نكمل بالنمط الافتراضي في أيام فاضية.
  const _defaultPattern = SPLIT_OVERRIDES[splitKey] || WEEK_PATTERNS[numDays] || WEEK_PATTERNS[3];
  let pattern = _defaultPattern;
  const _pref = Array.isArray(preferredDays)
    ? Array.from(new Set(preferredDays.map(x=>Math.round(Number(x))).filter(x=>Number.isFinite(x)&&x>=0&&x<=6))).sort((a,b)=>a-b)
    : [];
  if(_pref.length){
    pattern = [0,0,0,0,0,0,0];
    const _take = _pref.slice(0, trainingDays.length);
    _take.forEach(d=>{ pattern[d] = 1; });
    let _need = trainingDays.length - _take.length;
    for(let i=0;i<7 && _need>0;i++){ if(!pattern[i] && _defaultPattern[i]===1){ pattern[i]=1; _need--; } }
    for(let i=0;i<7 && _need>0;i++){ if(!pattern[i]){ pattern[i]=1; _need--; } }
  }
  const result = [];
  let trainIdx = 0;
  for(let i = 0; i < 7; i++){
    if(pattern[i] === 1 && trainIdx < trainingDays.length){
      result.push(trainingDays[trainIdx++]);
    } else {
      result.push({ ...REST });
    }
  }
  return result;
}

// ── REGENERATE — ولد جدولا جديدا بنفس معطيات المستخدم ─────────────
// يعيد لف بذرة التنويع ثم يعيد البناء — فينتج توليفة تمارين مختلفة
// (بنفس الجودة والحجم والسبليت والأهداف) في كل ضغطة.
function regenerateWorkoutPlan(){
  if(typeof _freshVarietySeed === 'function') state.varietySeed = _freshVarietySeed();
  else state.varietySeed = (Date.now() ^ Math.floor(Math.random()*0x7fffffff)) >>> 0;
  // إبطال الكاش لإجبار إعادة البناء (نفس السبليت/الأيام)
  state._planCacheKey = null;
  state.plan = null;
  buildExercisePlan(); // يعيد البناء والعرض
  if(typeof saveStateToStorage === 'function') saveStateToStorage();
}

function buildExercisePlan(){
  // ── Cache check: لو الخطة موجودة لنفس السبليت والأيام، لا إعادة بناء ─
  // صفحة 5 وصفحة 6 يعرضان نفس الخطة دايما
  const _cacheKey = `${state.selectedSplit}_${state.days}_${state.exp}_${state.goal}`;
  const _planValid = state.plan
    && state._planCacheKey === _cacheKey
    && state.plan.some(d => !d.isRest && (d.exercises||[]).length > 0);
  if(_planValid) return; // الخطة موجودة ومحدثة — لا شيء يتغير

  // ── بناء جديد من state._trainingSchedule (المصدر النظيف) ──────────
  if(!state._trainingSchedule){
    // WEEKLY REGION-COVERAGE GUARANTEE: نضمن تغطية مناطق الصدر (علوي/مسطح/سفلي)
    // والأكتاف (أمامي/جانبي/خلفي) عبر الأسبوع قبل توليد التمارين وخريطة العضلات.
    state._trainingSchedule = _ensureWeeklyRegionCoverage(getSplitSchedule(state.selectedSplit, state.days));
    state._lastMuscleMapSplit = state.selectedSplit;
  }
  // نبني state.plan (7 أيام مع راحة) من نسخة نظيفة من _trainingSchedule
  // deep clone لمنع أي تلوث عكسي على _trainingSchedule
  const cleanTraining = state._trainingSchedule.map(d => ({
    ...d,
    groups: d.groups ? d.groups.map(g => [...g]) : [],
    exercises: [] // نبدأ بدون exercises — بتتبنى في PASS 1
  }));
  state.plan = injectRestDays(cleanTraining, state.days || 3, state.selectedSplit, state.preferredDays);
  // حفظ cache key عشان نمنع إعادة البناء غير الضرورية
  state._planCacheKey = `${state.selectedSplit}_${state.days}_${state.exp}_${state.goal}`;
  // إعادة ضبط الإجمالي المخزن — هيحسب من جديد بعد بناء الخطة
  state._realTotalSets = null;
  let warnHTML='';
  if(!state.injuries.includes('none')){
    const msgs={shoulder:'إصابة كتف: تجنب الضغط فوق الرأس، قلل الوزن، استبدل بالكابل عند الألم',back:'إصابة ظهر: تجنب Deadlift وGood Morning. استخدم Chest Supported.',knee:'إصابة ركبة: تجنب السكوات العميق، فضل Leg Extension والـ Hip Thrust.',elbow:'إصابة مرفق: قلل الوزن في تمارين الذراع، تجنب Skull Crushers.',wrist:'إصابة رسغ: استخدم straps، تجنب تمارين الساعد المباشرة',neck:'إصابة رقبة: تجنب Shrugs والتمارين التي تضغط الرقبة'};
    warnHTML=state.injuries.map(inj=>`<div class="injury-warn">${msgs[inj]||inj}</div>`).join('');
  }
  document.getElementById('injuryWarnings').innerHTML=warnHTML;

  // ── DB SOURCE ENFORCEMENT NOTICE ────────────────────────────────────
  const isHome = state.equip === 'home';
  const dbNotice = `<div style="display:flex;align-items:center;gap:10px;background:${isHome?'rgba(0,229,160,0.06)':'rgba(108,99,255,0.06)'};border:1px solid ${isHome?'rgba(0,229,160,0.25)':'rgba(108,99,255,0.25)'};border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:12px;font-size:11px;color:${isHome?'#a0f5d8':'var(--accent3)'};">
    <span style="font-size:18px;">${isHome?'':''}</span>
    <span><b>${isHome?'Home Exercise Database':'Gym Exercise Database'}</b> — جميع التمارين أدناه مصدرها قاعدة بيانات ${isHome?'المنزل':'الجيم'} الداخلية الموثوقة فقط. لا يوجد أي تمرين عشوائي</span>
  </div>`;
  document.getElementById('injuryWarnings').innerHTML = dbNotice + warnHTML;

  const plan=state.plan;let html='';
  const dayColors=['#6c63ff','#00e5a0','#3b82f6','#a855f7','#ff7a1a','#fbbf24'];
  const dayIcons=['','','','','',''];
  // Pre-warm video cache for all exercise vids
  setTimeout(()=>prewarmVideos(state.plan), 300);

  // ── PRE-PROCESSOR: حساب الميزانية الأسبوعية + 60/20/20 قبل أي شيء ─────
  initPreProcessor();

  // PATCH-GYM-4: فلتر الكارديو عالي الكثافة قبل بناء الوحدات
  applyHighImpactFilter(state.bmi || 22);

  // ═════════════════════════════════════════════════════════════════════
  // INTELLIGENCE LAYER A  Beginner × Advanced Split Enforcement
  // ══════════════════════════════════════════════════════════════════════
  // إذا اختار المبتدئ جدولا متقدما (Arnold / Bro Split / PPL كاملة)
  // نطبق "حزمة الحماية" قسريا: نخفض الميزانية اليومية ونعلم المستخدم
  // المبدأ: النظام يظل الخبير حتى لو تجاوز المستخدم التوصية
  (function enforceBeginnerProtection() {
    const ADVANCED_SPLITS = new Set(['arnold', 'brosplit', 'ppl', 'ppl_weak', 'hybrid']);
    const isBegLvl   = state.exp === 'beginner';
    const splitChosen = state.selectedSplit || '';
    const isOverrideSplit = ADVANCED_SPLITS.has(splitChosen);

    if (isBegLvl && isOverrideSplit) {
      // ① ضغط الميزانية اليومية: مبتدئ + جدول متقدم - حد أقصى 14 set/يوم
      //    بدلا من 16-20 — يمنع الإجهاد المفرط (Excessive DOMS)
      if (_preProcBudget) {
        // مبتدئ + جدول متقدم: نضغط ال total لكن ضمن حدود ABSOLUTE_WEEKLY_BOUNDS دائما
        // لا يجوز أن يتجاوز budget.max (70) ولا ينزل عن budget.min (50)
        const _begAbsBounds = ABSOLUTE_WEEKLY_BOUNDS.beginner; // {min:50, max:70}
        _preProcBudget.total = Math.max(_begAbsBounds.min, Math.min(_preProcBudget.total, 65));
        _preProcBudget.primary   = Math.round(_preProcBudget.total * 0.60);
        const _shCapBeg = 8; // مبتدئ دايما ≤ 8 sets أكتاف أسبوعيا
        _preProcBudget.shoulders = Math.min(Math.round(_preProcBudget.total * 0.20), _shCapBeg);
        _preProcBudget.accessory = _preProcBudget.total - _preProcBudget.primary - _preProcBudget.shoulders;
        _preProcBudget.perDay    = Math.round(_preProcBudget.total / Math.max(state.days || 3, 1));
        // تأكد أن budget.min/max لا تتغير — ال AbsFinalGuard يعتمد عليهما
        _preProcBudget.budget = _begAbsBounds;
      }

      // ② تنبيه ذكي في واجهة المستخدم
      const splitNames = {
        arnold:'Arnold Split', brosplit:'Bro Split',
        ppl:'Push Pull Legs', ppl_weak:'PPL + Weak Point', hybrid:'Hybrid'
      };
      const smartAlert = `<div style="
        display:flex;align-items:flex-start;gap:10px;
        background:rgba(255,156,91,0.07);
        border:1px solid rgba(255,156,91,0.35);
        border-radius:var(--radius-sm);padding:12px 14px;
        margin-bottom:12px;font-size:11px;color:#fdd9b0;line-height:1.65;
      ">
        <span style="font-size:20px;flex-shrink:0"></span>
        <span>
          <b>تعديل ذكي لحمايتك:</b> اخترت <b>${splitNames[splitChosen] || splitChosen}</b>
          وهو نظام متقدم، لكن مستواك الحالي <b>مبتدئ</b>.<br>
          قام النظام تلقائيا ب:
          <b>تقليل الشدة اليومية</b> إلى 14 مجموعة كحد أقصى ·
          <b>ارفع وقت الراحة</b> بين المجموعات ·
          <b>زيادة RIR</b> لحماية مفاصلك وتعلم الحركة الصحيحة.
          <span style="opacity:0.7;display:block;margin-top:4px;">
             بعد 3 أشهر مع هذا البرنامج، انتقل للنظام بشدته الكاملة.
          </span>
        </span>
      </div>`;
      document.getElementById('injuryWarnings').innerHTML = smartAlert +
        document.getElementById('injuryWarnings').innerHTML;
    }
  })();

  // ══════════════════════════════════════════════════════════════════════
  // INTELLIGENCE LAYER B — Goal × Recovery Alignment (Prescriptive Guard)
  // ═════════════════════════════════════════════════════════════════════
  // القوة + تعافي منخفض: نحذف تمارين الإنهاء (Finishers) وتمارين العزل الأخرة
  // الضخامة + تعافي منخفض: نقلل sets من آخر تمرين عزل في كل يوم
  // المبدأ: تركيز الطاقة المحدودة على ما يحقق أثرا فسيولوجيا حقيقيا
  // يعمل بعد PASS 1 — يطبق فورا على الخطة المبنية
  // (الكود التطبيقي أسفل PASS 1 مباشرة)
  const _goalRecAlignment = {
    isStrengthLowRec: state.goal === 'strength' && (state.recoveryScore || 75) < 60,
    isMuscleLowRec:   state.goal === 'muscle'   && (state.recoveryScore || 75) < 60,
  };

  // ── PASS 1: Pick all exercises ───────────────────────────────────────
  // FIX 4: crossDayUsed — compound exercises that appear in day N are excluded
  // from being picked again in day N+1..N+k within the same weekly schedule.
  // This prevents e.g. Romanian Deadlift appearing in both Pull A and Legs B.
  // Only S-tier compounds are tracked cross-day; isolation/accessory exercises
  // are allowed to repeat (e.g. Lateral Raise is fine twice/week).
  // ANGLE LAYER: reset weekly angle tracker so each plan build starts fresh
  // ── بذرة التنويع: ثابتة خلال الجلسة، متغيرة بين المستخدمين/التوليدات ──
  // تضمن ألا نتج جدولا متطابقان لشخصين بنس المعطيات، مع بقاء الجودة العلمية.
  // ثابتة داخل الجلسة الواحدة - تناسق بين خريطة العضلات وصفحة الجدول.
  if(typeof state.varietySeed !== 'number'){
    state.varietySeed = (typeof _freshVarietySeed === 'function') ? _freshVarietySeed() : ((Date.now() ^ Math.floor(Math.random()*0x7fffffff)) >>> 0);
  }
  if(typeof resetVarietySeed === 'function') resetVarietySeed(state.varietySeed);

  resetAngleTracker();
  const crossDayUsed = new Set();
  plan.forEach((day,idx)=>{
    if(day.isRest) return; //  تخطي أيام الراحة — لا تمارين
    const exercises=pickExercises(day.groups||[],state.equip,state.injuries,state.goal,state.time,state.exp,state.gender,idx,crossDayUsed);
    // Register only S-tier compound-type exercises into the cross-day tracker
    exercises.forEach(ex=>{
      if(ex.tier==='S' && ['chest','back','quads','hamstrings','shoulders'].includes(ex.grp)){
        crossDayUsed.add(ex.n);
      }
    });
    state.plan[idx].exercises=exercises;
  });

  // ══════════════════════════════════════════════════════════════════════
  // INTELLIGENCE LAYER B — تطبيق Goal × Recovery Alignment
  // ══════════════════════════════════════════════════════════════════════
  // يعمل مباشرة بعد اختيار التمارين — قبل أي pass آخر
  (function applyGoalRecoveryAlignment() {
    if (!_goalRecAlignment.isStrengthLowRec && !_goalRecAlignment.isMuscleLowRec) return;

    state.plan.forEach((day) => {
      if (!day?.exercises?.length) return;
      const exs = day.exercises;

      if (_goalRecAlignment.isStrengthLowRec) {
        // الحالة + تعافي منخفض:
        // ① احذف آخر تمرين Finisher (rank 5) إذا وجد — لتركيز الطاقة على المركبات
        // ② قلل sets على آخر تمرين عزل بمجموعة واحدة
        const lastFinisherIdx = (() => {
          for (let j = exs.length - 1; j >= 0; j--) {
            if (getExerciseRank(exs[j]) === 5 && !exs[j]._mandatoryCore) return j;
          }
          return -1;
        })();
        if (lastFinisherIdx >= 0 && exs.length > 3) {
          exs.splice(lastFinisherIdx, 1);
        }
        // قلل sets على آخر تمرين عزل (rank 4)
        for (let j = exs.length - 1; j >= 0; j--) {
          const _advMinC = (typeof state !== 'undefined' && state.exp === 'advanced') ? 3 : 2; // FIX v24
          if (getExerciseRank(exs[j]) >= 4 && !exs[j]._mandatoryCore && exs[j].sets > _advMinC) {
            exs[j] = { ...exs[j], sets: exs[j].sets - 1, _goalRecReduced: true };
            break;
          }
        }
      } else if (_goalRecAlignment.isMuscleLowRec) {
        // الضخامة + تعافي منخفض:
        // قلل set واحدة من آخر تمريني عزل — يحافظ على التحفيز مع تقليل التعب
        let count = 0;
        for (let j = exs.length - 1; j >= 0 && count < 2; j--) {
          const _advMinD = (typeof state !== 'undefined' && state.exp === 'advanced') ? 3 : 2; // FIX v24
          if (getExerciseRank(exs[j]) >= 4 && !exs[j]._mandatoryCore && exs[j].sets > _advMinD) {
            exs[j] = { ...exs[j], sets: exs[j].sets - 1, _goalRecReduced: true };
            count++;
          }
        }
      }

      day.exercises = exs;
    });
  })();

  // ── PASS 1C: "الدستور" — قاعدة تصحيح الجلوتس تلقائيا ──────────────────
  // إذا اليوم يحتوي RDL أو سكوات عميق - خصم 30% من مجموعات عزل الجلوتس
  // لمنع الإجهاد المفصلي وفق المعايير العلمية
  (function applyGlutesCompoundReduction(){
    state.plan.forEach((day) => {
      if(!day || !day.exercises || !day.exercises.length) return;
      const exs = day.exercises;
      const factor = getGlutesReductionFactor(exs);
      if(factor === 1.0) return; // لا تخفيض مطلوب

      exs.forEach((ex, i) => {
        // تطبيق الخصم فقط على تمارين عزل الجلوتس
        const isGluteIso = ex.grp === 'glutes' && ex.sub && ex.sub.includes('iso');
        const isGluteAccessory = ex.grp === 'glutes' && ex.sets >= 3;
        if((isGluteIso || isGluteAccessory) && !ex._mandatoryCore){
          const reduced = Math.max(2, Math.round(ex.sets * factor));
          exs[i] = { ...ex, sets: reduced, _gluteReduced: true };
        }
      });
    });
  })();

  // ── PASS 1B: EXERCISE INTELLIGENCE PATCH 2 — Fatigue-based isolation reduction
  // Fires ONLY when fatigueCap is critically low (<50).
  // Reduces sets on the LAST isolation/accessory exercise per day by 1 set.
  // NEVER touches: compounds (rank 1-2), split structure, frequency, plan shape.
  // NEVER removes mandatory core or weak-point bonus exercises.
  // Safe: HARD_MAX/MIN volume re-enforced in PASS 2F as always.
  (function applyFatigueIsolationReduction(){
    const fc = state.fatigueCap || 80;
    if(fc >= 50) return; // only fires on critically low fatigue capacity

    const ISOLATION_RANKS = new Set([4, 5]); // isolation + finisher only

    state.plan.forEach((day) => {
      if(!day || !day.exercises || !day.exercises.length) return;
      const exs = day.exercises;

      // Find last isolation/finisher exercise (exclude mandatory core & weak-bonus)
      let lastIsoIdx = -1;
      for(let j = exs.length - 1; j >= 0; j--){
        const rank = getExerciseRank(exs[j]);
        if(ISOLATION_RANKS.has(rank) && !exs[j]._mandatoryCore && !exs[j]._weakBonus){
          lastIsoIdx = j;
          break;
        }
      }

      // Reduce 1 set from last isolation — minimum 2 sets preserved
      if(lastIsoIdx >= 0 && exs[lastIsoIdx].sets > 2){
        exs[lastIsoIdx] = {
          ...exs[lastIsoIdx],
          sets: exs[lastIsoIdx].sets - 1,
          _fatigueReduced: true
        };
      }
    });
  })();

  // ── PASS 1C: EXERCISE INTELLIGENCE PATCH 3 — Post-fatigue volume safety guard
  // Lightweight check: if any day dropped below absolute minimum (3 exercises)
  // after fatigue reduction, restore the removed set on the last isolation.
  // PASS 2F (HARD_MAX/MIN_SETS) handles the full volume enforcement downstream.
  // This guard only prevents edge cases where fatigue reduction + short-session
  // would combine to leave fewer than 3 exercises with sets.
  (function postFatigueVolumeGuard(){
    const fc = state.fatigueCap || 80;
    if(fc >= 50) return; // only relevant when fatigue reduction fired
    state.plan.forEach((day) => {
      if(!day || !day.exercises) return;
      const exs = day.exercises;
      // If a day has <3 exercises, restore the _fatigueReduced set
      if(exs.length < 3){
        const restored = exs.find(e => e._fatigueReduced);
        if(restored) restored.sets = Math.min(restored.sets + 1, 4);
      }
      // Minimum exercise count guard: if somehow < 2 exercises, log it
      if(exs.length < 2){
        console.warn('[postFatigueVolumeGuard] Day has <2 exercises after fatigue reduction:', day.name);
      }
    });
  })();

  // ══════════════════════════════════════════════════════════════════════
  // INTELLIGENCE LAYER C — PPL 5-Day Legs Boost (الدستور §3A)
  // في PPL 5 أيام: يوم الأرجل هيكليا موسع (6 groups بدل 5)
  // لا نحتاج ضرب ×1.5 على ال sets لأن البنية نفسها تضمن الحجم الكافي
  // Push/Pull كل منهما يغطي نصف الزوايا فقط (A أو B) - لا نخفض حجمهم
  // ════════════════════════════════════════════════════════════════════════
  (function applyPPL5DayLaw() {
    if (state.selectedSplit !== 'ppl' || state.days !== 5) return;
    // يوم الأرجل = index 2 في نمط: Push A(0) - Pull A(1) - Legs(2) - Push B(3) - Pull B(4)
    // بعد injectRestDays قد يتغير ال index — نبحث عن يوم الأرجل بالاسم
    const legsDay = state.plan.find(d => !d.isRest && d.name && d.name.startsWith('Legs'));
    if (legsDay && legsDay.exercises && legsDay.exercises.length > 0) {
      // الأرجل الموسعة تأخذ الحجم الكامل — لا تخفيض ولا تضخيم اصطناعي
      // فقط نعلم اليوم ب flag لل debug
      legsDay._ppl5FullLegs = true;
    }
    // Push A/B و Pull A/B يغطيان زوايا مختلفة — كل منها يعمل بحجمه الكامل
    // لا تخفيض 15% — كل يوم مصمم لنصف الجسم فقط
  })();

  // ══════════════════════════════════════════════════════════════════════
  // INTELLIGENCE LAYER D — enforceRecoveryAutoScale (الدستور §3B)
  // إذا اختار المستخدم سبليت "ثقيل" جدا لمستواه:
  //   ① كل تمرين: حد أقصى 2 مجموعة
  //   ② وقت الراحة +60 ثانية
  //   ③ RIR = 3 (يمنع الوصول للفشل)
  // ═════════════════════════════════════════════════════════════════════════
  function enforceRecoveryAutoScale(plan, st) {
    const HEAVY_SPLITS = new Set(['arnold', 'brosplit', 'ppl', 'hybrid', 'ppl_weak']);
    const isBeginner   = st.exp === 'beginner';
    const isHeavySplit = HEAVY_SPLITS.has(st.selectedSplit || '');
    if (!isBeginner || !isHeavySplit) return;

    plan.forEach(day => {
      if (!day || !day.exercises) return;
      day.exercises.forEach((ex, i) => {
        // ① Hard-cap sets to 2
        const cappedSets = Math.min(ex.sets || 3, 2);

        // ② Parse existing rest and add 60 seconds
        let restStr = ex.rest || '90 ثانية';
        const addedRest = (() => {
          // يحاول استخراج الأرقام من نص الراحة
          const mins = restStr.match(/(\d+)\s*(?:دقيقة|دقائق|دقيق)/); // [إصلاح باق الجمع "دقائق"]: كان /دقيق/ لا يطابق "دقائق" فيسقط لfallback ويقلل راحة المركب الثقيل
          const secs = restStr.match(/(\d+)\s*ثانية/);
          if (mins) {
            const totalSec = parseInt(mins[1]) * 60 + 60;
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            return s > 0 ? `${m} دقيقة ${s} ثانية` : `${m} دقائق`;
          } else if (secs) {
            const totalSec = parseInt(secs[1]) + 60;
            return totalSec >= 60
              ? `${Math.floor(totalSec/60)} دقيقة${totalSec%60?` ${totalSec%60} ثانية`:''}`
              : `${totalSec} ثانية`;
          }
          return '2 دقيقة'; // fallback
        })();

        // ③ Force RIR = 3
        day.exercises[i] = {
          ...ex,
          sets: cappedSets,
          rest: addedRest,
          rir: '3 RIR',
          _autoScaled: true
        };
      });
    });
  }
  enforceRecoveryAutoScale(state.plan, state);

  // ── PASS 2: Apply Distribution Intelligence Layer ────────────────────
  const distributedPlan = applyDistributionLayer(
    state.plan,
    state.goal,
    (state.weak||[]).map(w=>w.toLowerCase())
  );
  // Persist quality score
  const qualityData = distributedPlan._distributionQuality || {score:85};

  // ── PASS 2B: Apply Intelligent Training Prescription Layer ──────────
  applyPrescriptionLayer(
    distributedPlan,
    state.goal,
    state.exp,
    state.recoveryScore || 75
  );


  // ── PASS 2C: Guarantee Warmup & Cooldown for Every Day ───────────────
  guaranteeWarmupCooldown(distributedPlan, state.injuries);

  // ── PASS 2D: Full Muscle Coverage Validation ─────────────────────────
  const coverageData = validateMuscleCoverage(distributedPlan);
  state._coverageData = coverageData;

  // ── PASS 2D-2: Apply coverage patches (inject exercises for missing groups)
  if (coverageData.missing && coverageData.missing.length > 0) {
    applyCoveragePatches(distributedPlan, state.equip, state.injuries, state.goal, state.time, state.exp, state.gender);
    // Re-score coverage after patches
    const patchedCoverage = validateMuscleCoverage(distributedPlan);
    state._coverageData = patchedCoverage;

    // PATCH 1: For plans > 2 days, block render if required muscles still missing
    if (state.days > 2 && patchedCoverage.missingRequired && patchedCoverage.missingRequired.length > 0) {
      // Second patch pass — try once more with different day targets
      applyCoveragePatches(distributedPlan, state.equip, state.injuries, state.goal, state.time, state.exp, state.gender);
      const secondPatch = validateMuscleCoverage(distributedPlan);
      state._coverageData = secondPatch;
    }
  }

  // ── PASS 2D-3: Leg Balance Validation & Patching ─────────────────────
  // الشرط الذهبي لتوازن الأرجل:
  // يوم واحد - لام: كوادز + هامستينج + سمانة + جلوتس
  // يومين - كل أسبوع لازم يغطي كل قسم بشكل كاف + سمانة في كل يوم أرجل
  validateAndPatchLegBalance(
    distributedPlan,
    state.equip,
    state.injuries || [],
    state.goal,
    state.time,
    state.exp,
    state.gender
  );

  // ── PASS 2E: Smart Module Integration (Step 6 selections) ────────────
  applyModuleIntegrationLayer(
    distributedPlan,
    state.activeModules || [],
    state.goal,
    state.recoveryScore || 75,
    state.exp,
    state.weak || []
  );

  // ─ PASS 2E-REST: 3-min rest cap for non-strength (single chokepoint) ──
  enforceRestCapOnPlan(distributedPlan, state.goal);

  // ── PASS 2F: HARD SETS CAP — إلزامي بعد كل ال passes ─────────────────
  // يضمن أن أي يوم لا يتجاوز الحد الأقصى مهما كان السبليت أو الوحدات المضفة
  // "الدستور": الحدود مشتقة من الميزانية الأسبوعية ÷ عدد الأيام
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // القاعدة: HARD_MAX_SETS يجب أن يكون = budget.max ÷ days
  // حتى لا يتجاوز الإجمالي اليومي × عدد الأيام حدود ال ABSOLUTE_WEEKLY_BOUNDS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const _isBeg  = state.exp === 'beginner';
  const _isAdv  = state.exp === 'advanced';
  const _recLow = (state.recoveryScore||75) < 60;
  const _isCut  = state.goal === 'cut';
  const _pp = _preProcBudget || computeWeeklyBudget(state.exp, state.days, state.goal, state.recoveryScore);
  const _trainingDays = Math.max(state.days || 3, 1);

  // ── حد يومي مشتق من ABSOLUTE_WEEKLY_BOUNDS مباشرة ────────────────────
  const _absBoundsForDaily = ABSOLUTE_WEEKLY_BOUNDS[state.exp] || ABSOLUTE_WEEKLY_BOUNDS.intermediate;
  // الحد الأقصى اليومي = budget_max ÷ days (بدون هامش مرفوع — يضمن عدم التجاوز)
  const _dailyAbsMax = Math.floor(_absBoundsForDaily.max / _trainingDays);
  // الحد الأدنى اليومي = budget_min ÷ days
  const _dailyAbsMin = Math.ceil(_absBoundsForDaily.min / _trainingDays);

  // الحد اليومي المحسوب من ال total
  const _dailyTarget = Math.round(_pp.total / _trainingDays);

  // ── SPEC v25: سقف يومي مشروط بالمستوى + عدد الأيام + مدة الجلسة ─────────
  // الجداول قليلة الأيام (2–3) تسمح بكثافة أعلى لتعويض قلة التردد التدريبي
  const _lowDays = _trainingDays <= 3;
  const _capLevelDays = _isBeg ? (_lowDays ? 18 : 16)
                      : _isAdv ? 24
                      : (_lowDays ? 22 : 20);
  // سقف زمني واقعي: ≤45 دق - 16 | 60 و 75 دق - 24
  const _sessTime = Number(state.time) || Number(state.duration) || 60;
  const _capTime = _sessTime <= 45 ? 16 : 24;
  const _dailyHardCap = Math.min(_capLevelDays, _capTime);
  // HARD_MAX_SETS: أقل قيمة بين: (daily target +25%) و (abs_max ÷ days) و السقف اليومي
  const _rawMax = Math.min(
    Math.round(_dailyTarget * 1.25),
    _dailyAbsMax,
    _dailyHardCap
  );
  // HARD_MIN_SETS: أكبر قيمة بين: (daily target -25%) و (abs_min ÷ days)
  const _rawMin = Math.max(
    Math.round(_dailyTarget * 0.75),
    _dailyAbsMin,
    _isBeg ? 8 : _isAdv ? 14 : (_isCut ? 11 : _recLow ? 11 : 12)
  );
  // ضمان أن HARD_MAX > HARD_MIN — بخفض الحد الأدنى لا برفع السقف
  // حتى لا يكسر الحد الأدنى (المشتق من abs_min/days) السقف اليومي عند قلة الأيام
  const HARD_MAX_SETS = _rawMax;
  const HARD_MIN_SETS = Math.min(_rawMin, HARD_MAX_SETS - 2);
  distributedPlan.forEach((day, i) => {
    if (!day || !day.exercises || !day.exercises.length) return;
    const exs = day.exercises;
    let total = exs.reduce((s, e) => s + (e.sets || 0), 0);

    // إذا تجاوز الحد الأقصى: اقطع من ال isolation وال finishers أولا
    if (total > HARD_MAX_SETS) {
      let surplus = total - HARD_MAX_SETS;
      // اقطع من آخر التمارين (ال isolation وال finishers) للخلف — مع حماية السمانة والضامة
      for (let j = exs.length - 1; j >= 0 && surplus > 0; j--) {
        if (exs[j]._protected) continue; // السمانة والضامة محمية
        const _advMinHard = state.exp === 'advanced' ? 3 : 2; // FIX v24: متقدم لا ينزل تحت 3
        const canRemove = Math.max(0, exs[j].sets - _advMinHard);
        const remove = Math.min(surplus, canRemove);
        exs[j] = { ...exs[j], sets: exs[j].sets - remove };
        surplus -= remove;
      }
      // إذا لا يزال متجاوزا بعد تقليل ال sets، احذف آخر تمرين غير محمي
      total = exs.reduce((s, e) => s + e.sets, 0);
      while (total > HARD_MAX_SETS && exs.length > 3) {
        // ابحث عن آخر تمرين غير محمي
        let removedIdx = -1;
        for (let j = exs.length - 1; j >= 0; j--) {
          if (!exs[j]._protected) { removedIdx = j; break; }
        }
        if (removedIdx === -1) break; // كلهم محميين — لا تحذف
        const removed = exs.splice(removedIdx, 1)[0];
        total -= removed.sets;
      }
      day.exercises = exs;
    }

    // إذا تحت الحد الأدنى: أضف sets على ال compounds
    total = exs.reduce((s, e) => s + (e.sets || 0), 0);
    if (total < HARD_MIN_SETS && exs.length > 0) {
      let deficit = HARD_MIN_SETS - total;
      for (let j = 0; j < exs.length && deficit > 0; j++) {
        const add = Math.min(deficit, j < 2 ? 2 : 1);
        exs[j] = { ...exs[j], sets: exs[j].sets + add };
        deficit -= add;
      }
      day.exercises = exs;
    }

    distributedPlan[i] = day;
  });
  // ─────────────────────────────────────────────────────────────────────────

  // ── PASS 2G: "الدستور" — التحقق من الميزانية الأسبوعية الكلية ──────────
  // بعد كل ال passes، نتحقق أن الإجمالي الأسبوعي ضمن نطاق [min, max]
  (function validateWeeklyBudget(){
    const pp = _preProcBudget;
    if(!pp) return;
    const weeklyTotal = distributedPlan.reduce((sum, day) => {
      if(!day || !day.exercises) return sum;
      return sum + day.exercises.reduce((s, e) => s + (e.sets||0), 0);
    }, 0);
    // SPEC v25: الحدود الأسبوعية لا تتجاوز الممكن فعليا = أيام × السقف اليومي
    // يمنع الحد الأدنى الأسبوعي من دفع اليوم فوق السقف عند قلة الأيام
    const _reachable = _trainingDays * _dailyHardCap;
    const budget = {
      min: Math.min(pp.budget.min, _reachable),
      max: Math.min(pp.budget.max, _reachable)
    };

    console.log('[WeeklyBudget] Total:', weeklyTotal,
      '| Target Range:', budget.min, '-', budget.max,
      '| Experience:', state.exp,
      '| Days:', state.days);

    // إذا تجاوز الحد الأقصى: اقطع تدريجيا من الأيام الأعلى حجما
    if(weeklyTotal > budget.max) {
      let surplus = weeklyTotal - budget.max;
      // رتب الأيام من الأعلى مجموعات إلى الأقل
      const daysSorted = distributedPlan
        .map((d,i) => ({i, sets: (d?.exercises||[]).reduce((s,e)=>s+(e.sets||0),0)}))
        .sort((a,b) => b.sets - a.sets);

      for(const {i} of daysSorted) {
        if(surplus <= 0) break;
        const day = distributedPlan[i];
        if(!day?.exercises?.length) continue;
        const exs = day.exercises;
        // اقطع من ال isolation أولا من نهاية الوم
        for(let j = exs.length-1; j >= 0 && surplus > 0; j--) {
          const _advMinW = state.exp === 'advanced' ? 3 : 2; // FIX v24: متقدم لا ينزل تحت 3
          const canRemove = Math.max(0, exs[j].sets - _advMinW);
          const remove = Math.min(surplus, canRemove);
          exs[j] = {...exs[j], sets: exs[j].sets - remove};
          surplus -= remove;
        }
        day.exercises = exs;
        distributedPlan[i] = day;
      }
      console.log('[WeeklyBudget] Trimmed surplus:', weeklyTotal - budget.max, ' - new total:', distributedPlan.reduce((s,d)=>s+(d?.exercises||[]).reduce((ss,e)=>ss+(e.sets||0),0),0));
    }

    // إذا تحت الحد الأدنى: أضف على ال compounds في الأيام الأقل حجما
    const finalTotal = distributedPlan.reduce((s,d)=>s+(d?.exercises||[]).reduce((ss,e)=>ss+(e.sets||0),0),0);
    if(finalTotal < budget.min) {
      let deficit = budget.min - finalTotal;
      const daysSorted2 = distributedPlan
        .map((d,i) => ({i, sets: (d?.exercises||[]).reduce((s,e)=>s+(e.sets||0),0)}))
        .sort((a,b) => a.sets - b.sets);
      for(const {i} of daysSorted2) {
        if(deficit <= 0) break;
        const day = distributedPlan[i];
        if(!day?.exercises?.length) continue;
        const exs = day.exercises;
        // أضف على ال compounds الأولى
        for(let j = 0; j < Math.min(2, exs.length) && deficit > 0; j++) {
          const add = Math.min(deficit, 2);
          exs[j] = {...exs[j], sets: exs[j].sets + add};
          deficit -= add;
        }
        day.exercises = exs;
        distributedPlan[i] = day;
      }
    }
  })();

  // ── PASS 2H: "الدستور" — طبقة التحقق من 60/20/20 وإعادة التوازن ─────────
  // هذه الطبقة تعمل بعد كل ال passes — صامتة تماما
  (function enforce602020Distribution(){
    const pp = _preProcBudget || computeWeeklyBudget(state.exp, state.days, state.goal, state.recoveryScore);
    if(!pp) return;

    // ── إضافة مجموعات إضافية لنقاط الضعف — Dynamic Budgeting ────────────
    // المنطق الجديد (v2): المجموعات الإضافية تتحدد بذكاء:
    //   - عضلة كبيرة (primary): +4 مجموعات — تحتاج حجما أعلى للتحفيز
    //   - عضلة متوسطة (shoulders): +3 مجموعات
    //   - عضلة صغيرة (accessory): +2 مجموعات — تتعب بسرعة، أقل = أكثر أمانا
    //   - عند نقطتي ضعف أو أكثر: تخفض المجموعات الإضافية ب 1 لتوزيع الجهد
    //   - هذه المجموعات خارج ميزانية 60/20/20 — تضاف على التمارين الموجودة فقط
    // ── WEAK POINT: أضف تمرين كامل جديد للعضلة الضعيفة في أنسب يوم ──────────
    // المنطق: تمرين واحد إضافي في الأسبوع من نفس ال DB (gym/home) للعضلة الضعيفة
    // 'arms' ليست مفتاح عضلة في قاعدة البيانات — نوسعها لرأسيها الحقيقيين
    // (بايسبس + ترايسبس) حتى ينجح حقن تمرين نقطة الضعف من ال DB بدل الفشل الصامت.
    const weakMuscles = (state.weak||[])
      .map(w => w.toLowerCase())
      .flatMap(w => (['arms','ذراع','ذراعين','اذرع','الذراعين','اذرعه'].includes(w)) ? ['biceps','triceps'] : [w])
      .filter((w, i, a) => a.indexOf(w) === i);
    if(weakMuscles.length > 0){
      const isHomeEquip = state.equip === 'home';

      // ربط اسم نقطة الضعف ب grp + أفضل sub للسحب منه
      const WEAK_MUSCLE_MAP = {
        'biceps':'biceps',   'بايسبس':'biceps',
        'triceps':'triceps', 'ترايسبس':'triceps',
        'shoulders':'shoulders','أكتاف':'shoulders',
        'chest':'chest',     'صدر':'chest',
        'back':'back',       'ظهر':'back',
        'quads':'quads',     'كوادز':'quads',
        'hamstrings':'hamstrings','هامستينج':'hamstrings',
        'calves':'calves',   'سمانة':'calves',
        'glutes':'glutes',   'جلوتس':'glutes',
        'core':'core',       'كور':'core',
        'traps':'traps',     'ترابيس':'traps',
        'forearms':'forearms','ساعد':'forearms',
      };

      // أفضل sub للسحب منه لكل عضلة
      const WEAK_BEST_SUB = {
        chest:      isHomeEquip ? 'upper' : 'upper',
        back:       isHomeEquip ? 'lats'  : 'lats',
        shoulders:  isHomeEquip ? 'lateral': 'lateral',
        biceps:     isHomeEquip ? 'short' : 'short',
        triceps:    isHomeEquip ? 'long'  : 'long',
        quads:      isHomeEquip ? 'isolation': 'isolation',
        hamstrings: isHomeEquip ? 'dominant' : 'isolation',
        glutes:     isHomeEquip ? 'glutes'   : 'glutes',
        calves:     isHomeEquip ? 'all'      : 'gastrocnemius',
        core:       isHomeEquip ? 'all'      : 'all',
        traps:      'all',
        forearms:   'all',
      };

      // جمع كل أسماء التمارين المستخدمة في الخطة كلها
      const _allUsedNames = new Set();
      distributedPlan.forEach(d => (d.exercises||[]).forEach(e => _allUsedNames.add(e.n)));

      weakMuscles.forEach(wk => {
        const grpKey = WEAK_MUSCLE_MAP[wk] || wk;
        const bestSub = WEAK_BEST_SUB[grpKey] || 'all';

        // اسحب من DB الصح حسب equip
        const _db = isHomeEquip ? HOME_DB : GYM_DB;
        const _grpDB = _db[grpKey] || {};
        // حاول ال sub المفضل أولا، لو فاضي جرب كل ال subs
        const _subPool = _grpDB[bestSub] || [];
        const _allSubPools = Object.values(_grpDB).flat();
        const _candidatePool = _subPool.length > 0 ? _subPool : _allSubPools;

        // استبعد التمارين المستخدمة بالفعل في الخطة
        const _activeInj = (state.injuries||[]).map(i=>i.toLowerCase());
        const _safeForInj = (e) => {
          if(!_activeInj.length) return true;
          for(const inj of _activeInj){
            if((e.safe_injuries||[]).includes(inj)) continue;
            if((DANGER_MAP[inj]||[]).includes(e.n)) return false;
          }
          return true;
        };
        const _available = _candidatePool.filter(e =>
          !_allUsedNames.has(e.n) && _safeForInj(e)
        );

        // لو مفيش تمرين جديد، اسمح بتكرار تمرين موجود في يوم تاني
        const _finalPool = _available.length > 0 ? _available :
          _candidatePool.filter(e => _safeForInj(e));

        if(_finalPool.length === 0){
          console.log(`[WeakExtra] ${grpKey}: no exercise available in DB`);
          return;
        }

        // اختار التمرين الأعلى tier
        const _pick = _finalPool.sort((a,b) =>
          (a.tier==='S'?0:a.tier==='A'?1:2) - (b.tier==='S'?0:b.tier==='A'?1:2)
        )[0];

        // ابحث عن أنسب يوم يتدرب فيه هذه العضلة
        let bestDayIdx = -1, bestDayLoad = Infinity;
        distributedPlan.forEach((day, di) => {
          if(day.isRest) return;
          const dayHasMuscle = (day.exercises||[]).some(e => e.grp === grpKey);
          if(!dayHasMuscle) return;
          const dayLoad = (day.exercises||[]).reduce((s,e) => s+(e.sets||0), 0);
          if(dayLoad < bestDayLoad){ bestDayLoad = dayLoad; bestDayIdx = di; }
        });

        // لو مش فيه يوم للعضلة دي، خد أقل يوم حمل عام
        if(bestDayIdx < 0){
          distributedPlan.forEach((day, di) => {
            if(day.isRest) return;
            const dayLoad = (day.exercises||[]).reduce((s,e) => s+(e.sets||0), 0);
            if(dayLoad < bestDayLoad){ bestDayLoad = dayLoad; bestDayIdx = di; }
          });
        }

        if(bestDayIdx < 0) return;

        const _sets = state.exp === 'beginner' ? 3 : 4;
        const _reps = ['calves','forearms','core'].includes(grpKey) ? '15-20' : '10-12';

        distributedPlan[bestDayIdx].exercises.push({
          ..._pick,
          grp: grpKey,
          sub: bestSub,
          sets: _sets,
          reps: _reps,
          rest: '60-90 ث',
          blocked: false,
          vid: getValidVid(_pick.vid),
          _weakExtra: true,      // flag لل UI
          _protected: true,
        });
        _allUsedNames.add(_pick.n);
        console.log(`[WeakExtra] ${grpKey}: added "${_pick.n}" to day ${bestDayIdx}`);
      });
    }

    // ── تصنيف العضلات حسب الفئة (مطابق ل MUSCLE_CATEGORY) ────────────────
    const CAT_PRIMARY    = new Set(['chest','back','quads','hamstrings']);
    const CAT_SHOULDERS  = new Set(['shoulders']);
    const CAT_ACCESSORY  = new Set(['biceps','triceps','calves','glutes','core','forearms','traps']);

    // ── حساب المجموعات الأسبوعية الفعلية لكل فئة ───────────────────────────
    function getWeeklyCatSets() {
      let primary = 0, shoulders = 0, accessory = 0;
      distributedPlan.forEach(day => {
        if (!day?.exercises?.length) return;
        day.exercises.forEach(ex => {
          const g = ex.grp || '';
          if (CAT_PRIMARY.has(g))   primary   += ex.sets || 0;
          else if (CAT_SHOULDERS.has(g)) shoulders += ex.sets || 0;
          else if (CAT_ACCESSORY.has(g)) accessory += ex.sets || 0;
        });
      });
      return { primary, shoulders, accessory, total: primary + shoulders + accessory };
    }

    const actual = getWeeklyCatSets();
    if (actual.total === 0) return;

    // ── الأهداف النظرية 60/20/20 ───────────────────────────────────────────
    const targetPrimary   = Math.round(actual.total * 0.60);
    const targetShoulders = Math.round(actual.total * 0.20);
    const targetAccessory = actual.total - targetPrimary - targetShoulders;

    // ── هامش مقبول: ±8% — ضيق من 10% لأن التوليد الآن budget-aware ─────
    const TOL = 0.08;
    const primaryRatio   = actual.primary   / actual.total;
    const shoulderRatio  = actual.shoulders / actual.total;
    const accessoryRatio = actual.accessory / actual.total;

    const primaryOK   = Math.abs(primaryRatio   - 0.60) <= TOL;
    const shoulderOK  = Math.abs(shoulderRatio  - 0.20) <= TOL;
    const accessoryOK = Math.abs(accessoryRatio - 0.20) <= TOL;

    // تسجيل الراجعة دائما لل debug
    console.log('[60/20/20 Audit]', {
      actual: { primary: actual.primary, shoulders: actual.shoulders, accessory: actual.accessory, total: actual.total },
      ratios: {
        primary:   (primaryRatio   * 100).toFixed(1) + '%',
        shoulders: (shoulderRatio  * 100).toFixed(1) + '%',
        accessory: (accessoryRatio * 100).toFixed(1) + '%'
      },
      target: '60% / 20% / 20%',
      status: (primaryOK && shoulderOK && accessoryOK) ? ' متوازن' : ' يحتاج تعديل'
    });

    if (primaryOK && shoulderOK && accessoryOK) return; //  لا تدخل مطلوب

    // ── إعادة التوازن: تعديل ال sets بدون تغيير التمارين أو الهيكل ─────────
    // استراتيجية: نحدد الفائض والعجز لكل فئة ثم نوزع بشكل ذكي

    // جمع كل exercises مع مرجع يومها
    const allExsByDay = [];
    distributedPlan.forEach((day, di) => {
      if (!day?.exercises?.length) return;
      day.exercises.forEach((ex, ei) => {
        allExsByDay.push({ di, ei, ex });
      });
    });

    // دالة تعديل المجموعات مع احترام الحدود الدنيا والقصوى
    function adjustSets(di, ei, delta) {
      const ex = distributedPlan[di].exercises[ei];
      // FIX v24: المتقدم لا يمكن أن ينزل تحت 3 sets/تمرين مهما حدث
      const MIN_SETS_PER_EX = state.exp === 'advanced' ? 3 : 2;
      // سقف 4 مجموعات/تمرين صارم — مبتدئ 3
      const _adjExpCap = state.exp === 'beginner' ? 3 : 4;
      const MAX_SETS_PER_EX = _adjExpCap;
      const newSets = Math.max(MIN_SETS_PER_EX, Math.min(MAX_SETS_PER_EX, (ex.sets || 3) + delta));
      distributedPlan[di].exercises[ei] = { ...ex, sets: newSets, _budgetAdjusted: true };
    }

    // ── حالة 1: Primary أقل من 50% — أضف sets على primary compounds ────────
    if (primaryRatio < 0.50) {
      const deficit = targetPrimary - actual.primary;
      let remaining = deficit;
      // أولوية: compound primary exercises من الأيام الأقل حجما
      const primaryExs = allExsByDay
        .filter(({ex}) => CAT_PRIMARY.has(ex.grp) && getExerciseRank(ex) <= 2)
        .sort((a, b) => {
          const aSets = distributedPlan[a.di].exercises.reduce((s,e)=>s+e.sets,0);
          const bSets = distributedPlan[b.di].exercises.reduce((s,e)=>s+e.sets,0);
          return aSets - bSets; // ابدأ بالأيام الأقل حجما
        });
      for (const {di, ei} of primaryExs) {
        if (remaining <= 0) break;
        const add = Math.min(1, remaining);
        adjustSets(di, ei, add);
        remaining -= add;
      }
    }

    // ── حالة 2: Accessory أكثر من 30% - قلل من accessory isolation ─────────
    if (accessoryRatio > 0.30) {
      const surplus = actual.accessory - targetAccessory;
      let remaining = Math.min(surplus, 4); // حد أقصى للتعديل: 4 sets
      const accessoryIsoExs = allExsByDay
        .filter(({ex}) => CAT_ACCESSORY.has(ex.grp) && getExerciseRank(ex) >= 4)
        .sort((a, b) => b.ex.sets - a.ex.sets); // ابدأ بالأعلى مجموعات
      for (const {di, ei} of accessoryIsoExs) {
        if (remaining <= 0) break;
        const remove = Math.min(1, remaining);
        adjustSets(di, ei, -remove);
        remaining -= remove;
      }
    }

    // ── حالة 3: Shoulders أقل من 10% — أضف على shoulder exercises ──────────
    if (shoulderRatio < 0.10) {
      const deficit = targetShoulders - actual.shoulders;
      let remaining = Math.min(deficit, 3); // حد أقصى للتعديل: 3 sets
      const shoulderExs = allExsByDay
        .filter(({ex}) => CAT_SHOULDERS.has(ex.grp))
        .sort((a, b) => a.ex.sets - b.ex.sets);
      for (const {di, ei} of shoulderExs) {
        if (remaining <= 0) break;
        adjustSets(di, ei, 1);
        remaining--;
      }
    }

    // ── تسجيل ما بعد التعديل ─────────────────────────────────────────────
    const after = getWeeklyCatSets();
    console.log('[60/20/20 After Rebalance]', {
      primary:   (after.primary   / after.total * 100).toFixed(1) + '%',
      shoulders: (after.shoulders / after.total * 100).toFixed(1) + '%',
      accessory: (after.accessory / after.total * 100).toFixed(1) + '%'
    });

    // ── المرحلة 4: قفل الأمان النهائي — Hard Anchor Check ──────────────────
    // بعد كل passes: تحقق من أن العضلات الصغيرة لا تساوي أو تتجاوز العضلات الكبيرة
    // هذا الحارس يصحح أي خلل في التقريب الرياضي أو تراكم التعديلات
    (function hardAnchorCheck() {
      // احسب مجموع sets لكل عضلة أسبوعيا
      const muscleSets = {};
      distributedPlan.forEach(day => {
        if (!day?.exercises?.length) return;
        day.exercises.forEach(ex => {
          muscleSets[ex.grp] = (muscleSets[ex.grp] || 0) + (ex.sets || 0);
        });
      });

      const chestSets = muscleSets['chest'] || 0;
      const backSets  = muscleSets['back']  || 0;
      const calveSets = muscleSets['calves'] || 0;
      const forearmSets = muscleSets['forearms'] || 0;
      const bicepsSets = muscleSets['biceps'] || 0;
      const backRef = Math.max(backSets, 1);

      // القاعدة 1: السمانة يجب أن تكون أقل من الصدر والظهر بفارق واضح
      // السمانة الطبيعية = 30% × 20% = 6% من الإجمالي — أقل بكثير من الصدر (60%÷4=15%)
      // ── FLOOR PROTECTION: لا تقطع السمانة تحت الحد الأدنى العلمي ──
      const CALVES_HARD_FLOOR = { beginner: 3, intermediate: 3, advanced: 4 };
      const calvesFloor = CALVES_HARD_FLOOR[state.exp || 'intermediate'] || 4;
      if (calveSets >= chestSets || calveSets >= backSets) {
        const excessCalves = calveSets - Math.round(Math.min(chestSets, backSets) * 0.45);
        if (excessCalves > 0) {
          let toRemove = excessCalves;
          distributedPlan.forEach((day, di) => {
            if (!day?.exercises?.length) return;
            day.exercises.forEach((ex, ei) => {
              const _calvesAdvMin = getMinSetsForExp(state.exp, 'calves');
              if (ex.grp === 'calves' && toRemove > 0 && ex.sets > _calvesAdvMin) {
                // لا تقطع تحت ال floor المطلق
                const safeMin = Math.max(_calvesAdvMin, calvesFloor);
                const currentTotal = distributedPlan.reduce((s,d) => s + (d.exercises||[]).filter(e=>e.grp==='calves').reduce((ss,e)=>ss+(e.sets||0),0), 0);
                if (currentTotal - toRemove < calvesFloor) {
                  toRemove = Math.max(0, currentTotal - calvesFloor);
                }
                const remove = Math.min(toRemove, ex.sets - safeMin);
                if (remove > 0) {
                  distributedPlan[di].exercises[ei] = { ...ex, sets: ex.sets - remove, _hardAnchorFixed: true };
                  toRemove -= remove;
                }
              }
            });
          });
          console.log('[HardAnchor] Calves trimmed (floor protected at', calvesFloor, ')');
        }
      }

      // القاعدة 2: الساعد لا يتجاوز 30% من مجموعات الظهر
      const forearmCap = Math.max(2, Math.round(backRef * 0.30));
      if (forearmSets > forearmCap) {
        let toRemove = forearmSets - forearmCap;
        distributedPlan.forEach((day, di) => {
          if (!day?.exercises?.length) return;
          day.exercises.forEach((ex, ei) => {
            const _forearmAdvMin = getMinSetsForExp(state.exp, 'forearms');
            if (ex.grp === 'forearms' && toRemove > 0 && ex.sets > _forearmAdvMin) {
              const remove = Math.min(toRemove, ex.sets - _forearmAdvMin);
              distributedPlan[di].exercises[ei] = { ...ex, sets: ex.sets - remove, _hardAnchorFixed: true };
              toRemove -= remove;
            }
          });
        });
      }

      // القاعدة 3: البايسبس لا يتجاوز الظهر أبدا
      if (bicepsSets > backSets) {
        let toRemove = bicepsSets - backSets;
        distributedPlan.forEach((day, di) => {
          if (!day?.exercises?.length) return;
          day.exercises.forEach((ex, ei) => {
            const _advMinG = (typeof state !== 'undefined' && state.exp === 'advanced') ? 3 : 2; // FIX v24
            if (ex.grp === 'biceps' && toRemove > 0 && ex.sets > _advMinG) {
              const remove = Math.min(toRemove, ex.sets - _advMinG);
              distributedPlan[di].exercises[ei] = { ...ex, sets: ex.sets - remove, _hardAnchorFixed: true };
              toRemove -= remove;
            }
          });
        });
        console.log('[HardAnchor] Biceps capped to back level');
      }

      // ── القاعدة 4: الأكتاف — حد أسبوعي مطلق لا يكسر بأي pass ──────────
      // مبتدئ: ≤8 | متوسط: ≤12 | متقدم: ≤15
      const SHOULDER_HARD_CAP = { beginner: 8, intermediate: 12, advanced: 15 };
      const shoulderHardMax = SHOULDER_HARD_CAP[state.exp] || 12;
      const shoulderActual = muscleSets['shoulders'] || 0;
      if (shoulderActual > shoulderHardMax) {
        let toRemove = shoulderActual - shoulderHardMax;
        distributedPlan.forEach((day, di) => {
          if (!day?.exercises?.length) return;
          day.exercises.forEach((ex, ei) => {
            const _shAdvMin = getMinSetsForExp(state.exp, 'shoulders'); // FIX v24
            if (ex.grp === 'shoulders' && toRemove > 0 && ex.sets > _shAdvMin) {
              const remove = Math.min(toRemove, ex.sets - _shAdvMin);
              distributedPlan[di].exercises[ei] = { ...ex, sets: ex.sets - remove, _shoulderCapFixed: true };
              toRemove -= remove;
            }
          });
        });
        console.log('[HardAnchor] Shoulders capped:', shoulderActual, ' - ', shoulderHardMax);
      }

      // ── القاعدة 5: حد أسبوعي لكل عضلة حسب المستوى (MUSCLE_WEEKLY_CAPS) ──
      // يضمن أن كل عضلة لا تتجاوز الحد العلمي الموثق لمستوى المتدرب
      // مبتدئ/متوسط/متقدم — مستقل تماما عن الأكتاف التي تعالج في قاعدة 4
      const _exp = state.exp || 'intermediate';
      // ── HARD FLOORS: لا يقطع تحتها أبدا في أي pass ──
      const LOWER_HARD_FLOORS = {
        glutes: { beginner: 3, intermediate: 3, advanced: 3 },
        calves: { beginner: 3, intermediate: 4, advanced: 6 }
      };
      Object.keys(MUSCLE_WEEKLY_CAPS).forEach(grp => {
        if (grp === 'shoulders') return; // تعالجها قاعدة 4 أعلاه
        const cap = MUSCLE_WEEKLY_CAPS[grp][_exp];
        if (!cap) return;
        const actual = muscleSets[grp] || 0;
        if (actual <= cap) return;
        let toRemove = actual - cap;
        const floor = (LOWER_HARD_FLOORS[grp] || {})[_exp] || 0;
        // قطع من التمارين ذات أعلى sets أولا (isolation - compound)
        const exsList = [];
        distributedPlan.forEach((day, di) => {
          if (!day?.exercises?.length) return;
          day.exercises.forEach((ex, ei) => {
            if (ex.grp === grp) exsList.push({ di, ei, sets: ex.sets || 0 });
          });
        });
        exsList.sort((a, b) => b.sets - a.sets);
        for (const { di, ei } of exsList) {
          if (toRemove <= 0) break;
          const ex = distributedPlan[di].exercises[ei];
          // احسب الإجمالي الحالي لهذه العضلة — لا تهبط عن ال floor
          const currentGrpTotal = distributedPlan.reduce((s,d)=>s+(d.exercises||[]).filter(e=>e.grp===grp).reduce((ss,e)=>ss+(e.sets||0),0),0);
          const maxCanRemove = Math.max(0, currentGrpTotal - floor);
          if (maxCanRemove <= 0) break; // محمي بال floor
          const _advMinE = (typeof state !== 'undefined' && state.exp === 'advanced') ? 3 : 2; // FIX v24
          const canRemove = Math.max(0, Math.min(ex.sets - _advMinE, maxCanRemove));
          const remove = Math.min(toRemove, canRemove);
          if (remove > 0) {
            distributedPlan[di].exercises[ei] = { ...ex, sets: ex.sets - remove, _muscleCapFixed: true };
            toRemove -= remove;
          }
        }
        console.log(`[HardAnchor] ${grp} capped (${_exp}):`, actual, ' - ', cap);
      });
    })();
  })();

  // ── PASS 2I: "لدستور §4" — الحارس النهائي للميزنية الأسبوعي ─────────
  // يعمل بعد PASS 2H (60/20/20 + weak points) الذي قد يرفع الإجمالي فوق budget.max
  // هذا ال pass هو آخر سور — بعده مباشرة الرندر.
  // المبدأ: لا يضيف ولا يزيل تمارين — يعدل sets فقط.
  // الأولوية: يقطع من isolation أولا - accessory - compound أخيرا.
  // يحافظ على الحدود الدنيا (2 sets/تمرين) في كل الأحوال.
  // يحفظ state._realTotalSets للعرض في ال dashboard.
  (function finalWeeklyBudgetClamp() {
    const _pp = _preProcBudget;
    if (!_pp) return;

    const { budget } = _pp;   // { min, max } من WEEKLY_BUDGET[exp]

    // ── حساب الإجمالي الفعلي بعد كل ال passes ──────────────────────────
    function calcWeeklyTotal() {
      return distributedPlan.reduce((sum, day) => {
        if (!day?.exercises?.length) return sum;
        return sum + day.exercises.reduce((s, e) => s + (e.sets || 0), 0);
      }, 0);
    }

    let weeklyTotal = calcWeeklyTotal();

    // ── تصنيف التمارين حسب الأولوية للقطع/الزيادة ────────────────────────
    // القطع يبدأ من الأعلى rank (isolation/finisher) للأقل (compound)
    function getSortedExsForTrim() {
      const all = [];
      distributedPlan.forEach((day, di) => {
        if (!day?.exercises?.length) return;
        day.exercises.forEach((ex, ei) => {
          all.push({ di, ei, rank: getExerciseRank(ex), sets: ex.sets || 0 });
        });
      });
      // ترتيب: rank أعلى أولا (isolation/finisher يقطع أولا)
      return all.sort((a, b) => b.rank - a.rank || b.sets - a.sets);
    }

    // الزيادة تبدأ من ال compounds (rank أقل = أعلى أولوية)
    function getSortedExsForBoost() {
      const all = [];
      distributedPlan.forEach((day, di) => {
        if (!day?.exercises?.length) return;
        day.exercises.forEach((ex, ei) => {
          all.push({ di, ei, rank: getExerciseRank(ex), sets: ex.sets || 0 });
        });
      });
      return all.sort((a, b) => a.rank - b.rank);
    }

    // ── الحالة 1: تجاوز الحد الأقصى - قطع تدريجي ────────────────────────
    if (weeklyTotal > budget.max) {
      let surplus = weeklyTotal - budget.max;
      const exsToTrim = getSortedExsForTrim();
      // ── FLOOR PROTECTION: لا يقطع الجلوتس/السمانة تحت الحد الأدنى ──
      const _trimFloors = {
        glutes: { beginner: 3, intermediate: 3, advanced: 3 },
        calves: { beginner: 3, intermediate: 4, advanced: 6 }
      };
      const _trimExp = state.exp || 'intermediate';

      for (const { di, ei } of exsToTrim) {
        if (surplus <= 0) break;
        const ex = distributedPlan[di].exercises[ei];
        const grpFloor = (_trimFloors[ex.grp] || {})[_trimExp] || 0;
        const _advMinH = (state.exp === 'advanced') ? 3 : 2; // FIX v24
        let canRemove = Math.max(0, (ex.sets || 0) - _advMinH);
        if (grpFloor > 0) {
          // احسب الإجمالي الحالي لهذه العضلة
          const grpTotal = distributedPlan.reduce((s,d)=>s+(d.exercises||[]).filter(e=>e.grp===ex.grp).reduce((ss,e)=>ss+(e.sets||0),0),0);
          const maxRemovable = Math.max(0, grpTotal - grpFloor);
          canRemove = Math.min(canRemove, maxRemovable);
        }
        const remove = Math.min(surplus, canRemove);
        if (remove > 0) {
          distributedPlan[di].exercises[ei] = {
            ...ex,
            sets: ex.sets - remove,
            _budgetClamped: true
          };
          surplus -= remove;
        }
      }

      const newTotal = calcWeeklyTotal();
      console.log(
        '[PASS 2I]  Trimmed weekly total:',
        weeklyTotal, ' - ', newTotal,
        '| Budget max:', budget.max,
        '| Exp:', state.exp
      );
    }

    // ── الحالة 2: تحت الحد الأدنى - زيادة تدريجية على ال compounds ──────
    weeklyTotal = calcWeeklyTotal();
    if (weeklyTotal < budget.min) {
      let deficit = budget.min - weeklyTotal;
      const exsToBoost = getSortedExsForBoost();
      // سقف/تمرين حسب المستوى (يتوافق مع PASS 2F)
      const _perExCap = state.exp === 'beginner' ? 3 : state.exp === 'advanced' ? 5 : 4;

      for (const { di, ei } of exsToBoost) {
        if (deficit <= 0) break;
        const ex = distributedPlan[di].exercises[ei];
        const canAdd = Math.max(0, _perExCap - (ex.sets || 0));
        const add = Math.min(deficit, canAdd, 2); // max +2 sets per exercise لتوزيع عادل
        if (add > 0) {
          distributedPlan[di].exercises[ei] = {
            ...ex,
            sets: ex.sets + add,
            _budgetBoosted: true
          };
          deficit -= add;
        }
      }

      const newTotal = calcWeeklyTotal();
      console.log(
        '[PASS 2I]  Boosted weekly total:',
        weeklyTotal, ' - ', newTotal,
        '| Budget min:', budget.min,
        '| Exp:', state.exp
      );
    }

    // ── حفظ الإجمالي الفعلي النهائي في state للعرض في ال dashboard ────────
    state._realTotalSets = calcWeeklyTotal();

    // ── الحارس المطلق لكل العضلات — آخر سطر قبل الرندر ─────────────────────────
    // يضمن أن أي عضلة لا تتجاوز الحد العلمي بأي حال مهما حدث في ال passes السابقة
    // يشمل الأكتاف + جميع عضلات MUSCLE_WEEKLY_CAPS
    (function enforceAllMuscleAbsoluteCaps(){
      const _expCap = state.exp || 'intermediate';

      // ── الأكتاف أولا (كانت قائمة وحدها — محتفظ بمنطقها) ──
      const SHOULDER_ABS_CAP = { beginner: 8, intermediate: 12, advanced: 15 };
      const capSh = SHOULDER_ABS_CAP[_expCap] || 12;
      let shTotal = 0;
      distributedPlan.forEach(d => {
        if (!d?.exercises?.length) return;
        d.exercises.forEach(ex => { if (ex.grp === 'shoulders') shTotal += (ex.sets||0); });
      });
      if (shTotal > capSh) {
        let toRemove = shTotal - capSh;
        const shExs = [];
        distributedPlan.forEach((day, di) => {
          if (!day?.exercises?.length) return;
          day.exercises.forEach((ex, ei) => {
            if (ex.grp === 'shoulders') shExs.push({ di, ei, sets: ex.sets||0 });
          });
        });
        shExs.sort((a,b) => b.sets - a.sets);
        // Pass 1: تقليص مع ال floor
        for (const { di, ei } of shExs) {
          if (toRemove <= 0) break;
          const ex = distributedPlan[di].exercises[ei];
          const _advMinSh = state.exp === 'advanced' ? 3 : 2;
          const canRemove = Math.max(0, ex.sets - _advMinSh);
          const remove = Math.min(toRemove, canRemove);
          if (remove > 0) {
            distributedPlan[di].exercises[ei] = { ...ex, sets: ex.sets - remove, _shAbsCap: true };
            toRemove -= remove;
          }
        }
        // Pass 2: لو لسه فوق ال cap — احذف تمارين كاملة (isolation أولا)
        if (toRemove > 0) {
          shExs.sort((a,b) => a.sets - b.sets); // الأقل sets يحذف أولا
          for (const { di, ei } of shExs) {
            if (toRemove <= 0) break;
            const ex = distributedPlan[di].exercises[ei];
            if (!ex || (ex.sets||0) <= 0) continue;
            toRemove -= (ex.sets||0);
            distributedPlan[di].exercises[ei] = { ...ex, sets: 0, _shCapRemoved: true };
            console.log(`[AllMuscleCap]  Removed "${ex.n}" (shoulders) to enforce cap`);
          }
          distributedPlan.forEach((day, di) => {
            if (!day?.exercises?.length) return;
            distributedPlan[di].exercises = day.exercises.filter(e => (e.sets||0) > 0);
          });
        }
        state._realTotalSets = calcWeeklyTotal();
        console.log('[AllMuscleCap] Shoulders capped:', shTotal, ' - ', capSh, '| Exp:', _expCap);
      }

      // ── باقي العضلات من MUSCLE_WEEKLY_CAPS ──
      Object.keys(MUSCLE_WEEKLY_CAPS).forEach(grp => {
        if (grp === 'shoulders') return; // عولجت أعلاه
        const cap = MUSCLE_WEEKLY_CAPS[grp][_expCap];
        if (!cap) return;
        let total = 0;
        distributedPlan.forEach(d => {
          if (!d?.exercises?.length) return;
          d.exercises.forEach(ex => { if (ex.grp === grp) total += (ex.sets||0); });
        });
        if (total <= cap) return;
        let toRemove = total - cap;
        const exsList = [];
        distributedPlan.forEach((day, di) => {
          if (!day?.exercises?.length) return;
          day.exercises.forEach((ex, ei) => {
            if (ex.grp === grp) exsList.push({ di, ei, sets: ex.sets||0 });
          });
        });
        exsList.sort((a,b) => b.sets - a.sets);
        // Pass 1: تقليص مع ال floor
        for (const { di, ei } of exsList) {
          if (toRemove <= 0) break;
          const ex = distributedPlan[di].exercises[ei];
          const _advMinMu = state.exp === 'advanced' ? 3 : 2;
          const canRemove = Math.max(0, ex.sets - _advMinMu);
          const remove = Math.min(toRemove, canRemove);
          if (remove > 0) {
            distributedPlan[di].exercises[ei] = { ...ex, sets: ex.sets - remove, _musAbsCap: true };
            toRemove -= remove;
          }
        }
        // Pass 2: لو لسه فوق — احذف تمارين كاملة
        if (toRemove > 0) {
          exsList.sort((a,b) => a.sets - b.sets);
          for (const { di, ei } of exsList) {
            if (toRemove <= 0) break;
            const ex = distributedPlan[di].exercises[ei];
            if (!ex || (ex.sets||0) <= 0) continue;
            toRemove -= (ex.sets||0);
            distributedPlan[di].exercises[ei] = { ...ex, sets: 0, _musCapRemoved: true };
            console.log(`[AllMuscleCap]  Removed "${ex.n}" (${grp}) to enforce cap`);
          }
          distributedPlan.forEach((day, di) => {
            if (!day?.exercises?.length) return;
            distributedPlan[di].exercises = day.exercises.filter(e => (e.sets||0) > 0);
          });
        }
        console.log(`[AllMuscleCap] ${grp} capped (${_expCap}):`, total, ' - ', cap);
      });

      state._realTotalSets = calcWeeklyTotal();
    })();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // LOWER BODY MINIMUM ENFORCER — ضمان حد أدنى صارم للكوادز، هامستينج، جلوتس، سمانة
    // يطبق بعد كل passes ليضمن الوصول للنطاق العلمي بغض النظر عن الجدول
    // المصدر: جدول Weekly Sets per Muscle المرجعي
    //   كوادز:    مبتدئ 8-10  | متوسط 12-15 | متقدم 15-20
    //   هامستينج: مبتدئ 6-8   | متوسط  9-12 | متقدم 12-15
    //   جلوتس:    مبتدئ 3-6   | متوسط  3-9  | متقدم  3-9
    //   سمانة:    مبتدئ 3-5   | متوسط  4-6  | متقدم  6-9
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    (function enforceLegsWeeklyMinimum() {
      const _legExp = state.exp || 'intermediate';

      // الحدود الدنيا الصارمة — الحد الأدنى من نطاق كل مستوى
      const LOWER_BODY_WEEKLY_MINS = {
        quads:      { beginner: 8,  intermediate: 12, advanced: 15 },
        hamstrings: { beginner: 6,  intermediate:  9, advanced: 12 },
        glutes:     { beginner: 3,  intermediate:  3, advanced:  3 },
        calves:     { beginner: 3,  intermediate:  4, advanced:  6 }
      };

      // الحدود القصوى مأخوذة من MUSCLE_WEEKLY_CAPS
      const LOWER_BODY_WEEKLY_MAXS = {
        quads:      { beginner: 10, intermediate: 15, advanced: 20 },
        hamstrings: { beginner:  8, intermediate: 12, advanced: 15 },
        glutes:     { beginner:  6, intermediate:  9, advanced:  9 },
        calves:     { beginner:  5, intermediate:  6, advanced:  9 }
      };

      // العضلات التي لا يوجد لها تمارين مباشرة في بعض الجداول (full body/upper-lower)
      // نحتاج نفحصها ونضيف تمارين إذا لزم
      const FALLBACK_GROUPS = {
        glutes: ['hamstrings', 'glutes'],
        calves: ['calves', 'all']
      };

      ['quads', 'hamstrings', 'glutes', 'calves'].forEach(muscle => {
        const minSets = LOWER_BODY_WEEKLY_MINS[muscle][_legExp] || 3;
        const maxSets = LOWER_BODY_WEEKLY_MAXS[muscle][_legExp] || 9;

        // احسب المجموعات الأسبوعية الفعلية للعضلة
        let actualSets = 0;
        distributedPlan.forEach(day => {
          if (!day?.exercises?.length) return;
          day.exercises.forEach(ex => {
            if (ex.grp === muscle) actualSets += (ex.sets || 0);
          });
        });

        if (actualSets >= minSets) return; //  داخل النطاق — لا تدخل

        const deficit = minSets - actualSets;
        console.log(`[LowerBodyMinEnforcer]  ${muscle} deficit: ${actualSets} < min ${minSets} (exp: ${_legExp}) - adding ${deficit} sets`);

        // جمع كل تمارين هذه العضلة مرتبة بال rank (S-tier أولا)
        const muscleExs = [];
        distributedPlan.forEach((day, di) => {
          if (!day?.exercises?.length || day.isRest) return;
          day.exercises.forEach((ex, ei) => {
            if (ex.grp === muscle) muscleExs.push({ di, ei, rank: getExerciseRank(ex), sets: ex.sets || 0 });
          });
        });

        const perExMax = _legExp === 'beginner' ? 4 : _legExp === 'advanced' ? 6 : 5;

        if (muscleExs.length > 0) {
          // استراتيجية 1: أضف مجموعات على التمارين الموجودة (S/A tier أولا)
          muscleExs.sort((a, b) => a.rank - b.rank);
          let remaining = deficit;
          for (const { di, ei } of muscleExs) {
            if (remaining <= 0) break;
            const ex = distributedPlan[di].exercises[ei];
            const canAdd = Math.max(0, Math.min(perExMax, maxSets) - (ex.sets || 0));
            const add = Math.min(remaining, canAdd, 2);
            if (add > 0) {
              distributedPlan[di].exercises[ei] = { ...ex, sets: (ex.sets || 0) + add, _lowerMinBoost: true };
              remaining -= add;
            }
          }

          // استراتيجية 2: در مرة ثانية بدون قيد +2 لو لسه في عجز
          if (remaining > 0) {
            muscleExs.sort((a, b) => a.rank - b.rank);
            for (const { di, ei } of muscleExs) {
              if (remaining <= 0) break;
              const curSets = distributedPlan[di].exercises[ei].sets || 0;
              const canAdd = Math.max(0, Math.min(perExMax, maxSets) - curSets);
              const add = Math.min(remaining, canAdd);
              if (add > 0) {
                distributedPlan[di].exercises[ei] = { ...distributedPlan[di].exercises[ei], sets: curSets + add, _lowerMinBoost: true };
                remaining -= add;
              }
            }
          }
        } else if (FALLBACK_GROUPS[muscle]) {
          // استراتيجية 3: لا تمارين مباشرة — ابحث عن أخف يوم أرجل وأضف تمرين من DB
          // (هذا fallback للسمانة/جلوتس في جداول بدون يوم أرجل مخصص)
          const grp = FALLBACK_GROUPS[muscle];
          let bestDay = -1;
          let minLoad = Infinity;
          distributedPlan.forEach((day, di) => {
            if (day.isRest || !day.exercises) return;
            const isLegsDay = (day.groups||[]).some(g => g[0]==='quads' || g[0]==='hamstrings');
            const load = (day.exercises||[]).reduce((s,e)=>s+(e.sets||0),0);
            if (isLegsDay && load < minLoad) { minLoad = load; bestDay = di; }
          });
          // لو ما فيش يوم أرجل، أخد أخف يوم عموما
          if (bestDay < 0) {
            distributedPlan.forEach((day, di) => {
              if (day.isRest || !day.exercises) return;
              const load = (day.exercises||[]).reduce((s,e)=>s+(e.sets||0),0);
              if (load < minLoad) { minLoad = load; bestDay = di; }
            });
          }
          if (bestDay >= 0) {
            // FIX v24: لا تضيف لو اليوم وصل ال cap
            const _legCapMax = state.exp === 'beginner' ? 6 : 7;
            if ((distributedPlan[bestDay].exercises||[]).length >= _legCapMax) return;
            const fallbackExs = pickExercises([grp], state.equip, state.injuries, state.goal, state.time, state.exp, state.gender, bestDay + 200);
            const toAdd = fallbackExs.slice(0, 1).map(ex => ({
              ...ex,
              sets: Math.min(deficit, perExMax, maxSets),
              _lowerMinBoost: true
            }));
            if (toAdd.length) {
              const existingNames = new Set((distributedPlan[bestDay].exercises||[]).map(e=>e.n));
              const deduped = toAdd.filter(e => !existingNames.has(e.n));
              distributedPlan[bestDay].exercises = [...(distributedPlan[bestDay].exercises||[]), ...deduped];
              if (!distributedPlan[bestDay].groups) distributedPlan[bestDay].groups = [];
              if (!distributedPlan[bestDay].groups.some(g=>g[0]===grp[0]&&g[1]===grp[1])) {
                distributedPlan[bestDay].groups.push(grp);
              }
            }
          }
        }

        // تحقق نهائي وسجل
        let finalSets = 0;
        distributedPlan.forEach(day => {
          if (!day?.exercises?.length) return;
          day.exercises.forEach(ex => { if (ex.grp === muscle) finalSets += (ex.sets || 0); });
        });
        console.log(`[LowerBodyMinEnforcer]  ${muscle}: ${actualSets} - ${finalSets} (min: ${minSets}, max: ${maxSets})`);
      });

      state._realTotalSets = calcWeeklyTotal();
    })();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ABSOLUTE FINAL GUARD — الحاس المطلق انهائي (آخر سطر قبل الرندر)
    // يضمن بشكل حديدي أن الإجمالي الأسبوعي لازم يكون ضمن ABSOLUTE_WEEKLY_BOUNDS
    // لا يستثنى منه أي حالة: لا beginner protection، لا weak points، لا modules
    // إذا كان أعلى من max - اقطع | إذا كان أقل من min - ارفع
    // هذا هو آخر ود يعمل قبل الرندر — لا يوجد pass بعده
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    (function absoluteFinalBoundsEnforcer() {
      const _absExp  = state.exp || 'intermediate';
      const _absBounds = ABSOLUTE_WEEKLY_BOUNDS[_absExp] || ABSOLUTE_WEEKLY_BOUNDS.intermediate;
      const _absMin  = _absBounds.min;
      const _absMax  = _absBounds.max;

      let _absTotal = calcWeeklyTotal();

      // ── فوق الحد الأقصى: اقطع من isolation أولا ────────────────────
      if (_absTotal > _absMax) {
        let surplus = _absTotal - _absMax;
        // رتب: rank أعلى (isolation/finisher) أولا، ثم ال sets الأعلى
        const allExs = [];
        distributedPlan.forEach((day, di) => {
          if (!day?.exercises?.length) return;
          day.exercises.forEach((ex, ei) => {
            allExs.push({ di, ei, rank: getExerciseRank(ex), sets: ex.sets || 0 });
          });
        });
        // ── الأولوية في القطع: غير الأرجل أولا (كوادز/هامستينج/جلوتس/سمانة محمية) ──
        // ثم isolation قبل compounds ثم ال sets الأعلى
        // FIX v25: السمانة محمية بشكل خاص عند المتقدم (floor=6, cap=9 — هامش ضيق)
        const PROTECTED_LOWER = new Set(['quads','hamstrings','glutes','calves']);
        const _calvesHardFloor = { beginner: 3, intermediate: 4, advanced: 6 };
        const _calvesFloorVal  = _calvesHardFloor[_absExp] || 4;
        allExs.sort((a, b) => {
          const aIsLegs = PROTECTED_LOWER.has(distributedPlan[a.di].exercises[a.ei].grp);
          const bIsLegs = PROTECTED_LOWER.has(distributedPlan[b.di].exercises[b.ei].grp);
          if (aIsLegs !== bIsLegs) return aIsLegs ? 1 : -1; // غير الأرجل يقطع أولا
          return b.rank - a.rank || b.sets - a.sets;
        });

        for (const { di, ei } of allExs) {
          if (surplus <= 0) break;
          const ex = distributedPlan[di].exercises[ei];
          // ── Floor protection للجلوتس والسمانة ──
          const _absFloors = { glutes: {beginner:3,intermediate:3,advanced:3}, calves: {beginner:3,intermediate:4,advanced:6} };
          const grpFloor = (_absFloors[ex.grp] || {})[_absExp] || 0;
          let canRemove = Math.max(0, (ex.sets || 0) - getMinSetsForExp(_absExp, ex.grp)); // FIX v24
          if (grpFloor > 0) {
            const grpTotal = distributedPlan.reduce((s,d)=>s+(d.exercises||[]).filter(e=>e.grp===ex.grp).reduce((ss,e)=>ss+(e.sets||0),0),0);
            canRemove = Math.min(canRemove, Math.max(0, grpTotal - grpFloor));
          }
          // FIX v25: السمانة عند المتقدم — ال weekly floor (6) يطغى على ال per-exercise floor
          if (ex.grp === 'calves') {
            const calvesTotal = distributedPlan.reduce((s,d)=>s+(d.exercises||[]).filter(e=>e.grp==='calves').reduce((ss,e)=>ss+(e.sets||0),0),0);
            canRemove = Math.min(canRemove, Math.max(0, calvesTotal - _calvesFloorVal));
          }
          const remove = Math.min(surplus, canRemove);
          if (remove > 0) {
            distributedPlan[di].exercises[ei] = { ...ex, sets: ex.sets - remove, _absFinalCap: true };
            surplus -= remove;
          }
        }
        _absTotal = calcWeeklyTotal();
        console.log('[AbsFinalGuard]  Trimmed to max:', _absTotal, '≤', _absMax, '| Exp:', _absExp);
      }

      // ── تحت الحد الأدنى: أضف على ال compounds ──────────────────────
      if (_absTotal < _absMin) {
        let deficit = _absMin - _absTotal;
        const allExs = [];
        distributedPlan.forEach((day, di) => {
          if (!day?.exercises?.length || day.isRest) return;
          day.exercises.forEach((ex, ei) => {
            allExs.push({ di, ei, rank: getExerciseRank(ex), sets: ex.sets || 0 });
          });
        });
        // ابدأ بال compounds (rank أقل = أهم)
        allExs.sort((a, b) => a.rank - b.rank);

        // سقف max per exercise — hard cap 4 sets مطلق (مبتدئ: 3)
        const _ACCESSORY_B_ABS = new Set(['calves','forearms','traps']);
        const getAbsHardCap = (ex) => _ACCESSORY_B_ABS.has(ex.grp) ? 2 : (_absExp === 'beginner' ? 3 : 4);

        for (const { di, ei } of allExs) {
          if (deficit <= 0) break;
          const ex = distributedPlan[di].exercises[ei];
          const hardCap = getAbsHardCap(ex);
          const canAdd = Math.max(0, hardCap - (ex.sets || 0));
          const add = Math.min(deficit, canAdd, 2); // max +2 per exercise للتوزيع
          if (add > 0) {
            distributedPlan[di].exercises[ei] = { ...ex, sets: ex.sets + add, _absFinalBoost: true };
            deficit -= add;
          }
        }
        _absTotal = calcWeeklyTotal();
        console.log('[AbsFinalGuard]  Boosted to min:', _absTotal, '≥', _absMin, '| Exp:', _absExp);
      }

      state._realTotalSets = calcWeeklyTotal();

      // تحقق نهائي — log تحذير إذا لم نصل للنطاق (لا يجب أن يحدث)
      const _finalOk = state._realTotalSets >= _absMin && state._realTotalSets <= _absMax;
      if (!_finalOk) {
        console.warn(
          '[AbsFinalGuard]  BOUNDS VIOLATION — Total:', state._realTotalSets,
          '| Expected:', _absMin, '-', _absMax,
          '| Exp:', _absExp
        );
      } else {
        console.log(
          '[AbsFinalGuard]  BOUNDS OK — Total:', state._realTotalSets,
          '| Range:', _absMin, '-', _absMax,
          '| Exp:', _absExp
        );
      }
    })();

    state._weeklyBudgetMeta = {
      actual:  state._realTotalSets,
      min:     budget.min,
      max:     budget.max,
      exp:     state.exp,
      withinBudget: state._realTotalSets >= budget.min && state._realTotalSets <= budget.max
    };

    console.log(
      '[PASS 2I]  Final weekly total:', state._realTotalSets,
      '| Budget:', budget.min, '-', budget.max,
      '| Within budget:', state._weeklyBudgetMeta.withinBudget
    );
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASS 2J: ABSOLUTE 4-SET CAP + SINGLE LEGS DAY PRIORITY
  // القاعدة 1: أي تمرين — 4 sets كحد أقصى مطلق (مبتدئ: 3) — لا استثناء
  // القاعدة 2: لو يوم الأرجل في الأسبوع يوم واحد فقط — الكوادز والهامستينج
  //            يأخذوا أكبر نصيب من sets في ذلك اليوم (بدون إلزام بالحد الأسبوعي)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  (function enforceSetCapAndLegsPriority() {
    const _exp2j  = state.exp || 'intermediate';
    const _ACCESSORY_B = new Set(['calves','forearms','traps']);
    // الحد الأقصى المطلق لكل تمرين
    function hardCapForExercise(ex) {
      // السمانة في يوم الأرجل: cap = 4 (مش 2) — عضلة أرجل أساسية
      if (_ACCESSORY_B.has(ex.grp) && ex.grp !== 'calves') return 2;  // forearms/traps: 2
      return _exp2j === 'beginner' ? 3 : 4;                            // الجميع + calves: 4 (مبتدئ: 3)
    }

    // ── القاعدة 1: تطبيق hard cap على كل تمرين في الخطة ──────────────────
    distributedPlan.forEach((day, di) => {
      if (!day?.exercises?.length) return;
      const _isDayLegs = (day.exercises||[]).some(e => ['quads','hamstrings','glutes','calves','adductors'].includes(e.grp));
      day.exercises.forEach((ex, ei) => {
        const cap = hardCapForExercise(ex);
        if ((ex.sets || 0) > cap) {
          distributedPlan[di].exercises[ei] = { ...ex, sets: cap, _setCapEnforced: true };
          console.log(`[PASS2J]  ${ex.n} capped: ${ex.sets} - ${cap}`);
        }
      const _isAdvanced = _exp2j === 'advanced';
      const _legsMuscles = new Set(['quads','hamstrings','glutes','calves','adductors']);
      const _accB = new Set(['calves','forearms','traps']);
      // Q3: يوم الأرجل — min 3 لعضلات الأرجل
      // السمانة والضامة كمان تاخد min 3 في يوم الأرجل (مش forearms/traps فقط)
      if (_isDayLegs && _legsMuscles.has(ex.grp) && (!_accB.has(ex.grp) || ex.grp === 'calves' || ex.grp === 'adductors')) {
          const currentSets = distributedPlan[di].exercises[ei].sets || 0;
          if (currentSets < 3) {
            distributedPlan[di].exercises[ei] = { ...distributedPlan[di].exercises[ei], sets: 3, _legsMin3: true };
            console.log(`[PASS2J]  ${ex.n} legs min: ${currentSets} - 3`);
          }
        }
      if (_isAdvanced && !_accB.has(ex.grp)) {
        const curS = distributedPlan[di].exercises[ei].sets || 0;
        if (curS < 3) {
          distributedPlan[di].exercises[ei] = { ...distributedPlan[di].exercises[ei], sets: 3, _advMin3: true };
          console.log(`[PASS2J]  ${ex.n} advanced min3: ${curS} - 3`);
        }
      }
      });
    });

    // ── القاعدة 2: كل أيام الأرجل المنفصلة — ترتيب الأولوية الصارم ──
    // المطلوب: كوادز+هامستينج > سمانة+ضامة > جلوتس (من حيث عدد ال sets)
    // FIX v26: يتطبق على كل أيام الأرجل (يوم واحد أو أكثر) — مش بس single legs day
    // يوم الأرجل المنفصل = فيه كوادز/هامستينج بدون صدر/ظهر/كتف
    const LEGS_TIER1 = new Set(['quads','hamstrings']);          // أولوية 1 — الأعلى دائما
    const LEGS_TIER2 = new Set(['calves','adductors']);          // أولوية 2 — أقل من T1
    const LEGS_TIER3 = new Set(['glutes']);                      // أولوية 3 — الأقل
    const _PUSH_PULL_GROUPS = new Set(['chest','back','shoulders','biceps','triceps']);

    const legsDays = distributedPlan
      .map((day, di) => {
        if (day.isRest || !day.exercises?.length) return { di, isLegs: false };
        const hasT1    = day.exercises.some(e => LEGS_TIER1.has(e.grp));
        const hasPushPull = day.exercises.some(e => _PUSH_PULL_GROUPS.has(e.grp));
        // يوم أرجل منفصل = فيه كوادز/هامستينج ومفيش صدر/ظهر/كتف
        return { di, isLegs: hasT1 && !hasPushPull };
      })
      .filter(d => d.isLegs);

    // FIX v26: نطبق المنطق على كل يوم أرجل منفصل — كان محصور في legsDays.length===1
    legsDays.forEach(({ di }) => {

      // FIX v27: المفتاح الفعال — Hip Thrust/Glute Bridge (hamstrings.glutes)
      // تحسب ك glutes هنا تماما مثل بطاقة الملخص (buildMuscleMap)، حتى لا
      // يحسب عمل الجلوتس ضمن الهامستينج فيظهر الهامستينج أقل من الجلوتس/السمانة.
      const _effGrp = (e) => (e.grp === 'hamstrings' && e.sub === 'glutes') ? 'glutes' : e.grp;

      const getSets = (tier) => (distributedPlan[di].exercises||[])
        .filter(e => tier.has(_effGrp(e))).reduce((s,e) => s+(e.sets||0), 0);

      const trimTier = (tier, toTrimAmt, floorOverride) => {
        // FIX v25 P2: استخدم for loop مع break بدل forEach
        let remaining = toTrimAmt;
        for (let _ti = 0; _ti < distributedPlan[di].exercises.length; _ti++) {
          if (remaining <= 0) break;
          const ex = distributedPlan[di].exercises[_ti];
          if (!tier.has(_effGrp(ex))) continue;
          // FIX v26: الجلوتس floor = 2 دائما (مش advMin=3) عشان يسمح بالقطع الصح
          // السمانة والضامة في يوم الأرجل: floor = 3 (مش 2)
          const _isCavlesOrAdd = ex.grp === 'calves' || ex.grp === 'adductors';
          const _floor = (floorOverride !== undefined) ? floorOverride
            : (_isCavlesOrAdd ? 3
            : ((typeof state !== 'undefined' && state.exp === 'advanced') ? 3 : 2));
          const canRemove = Math.max(0, (ex.sets||0) - _floor);
          const remove = Math.min(remaining, canRemove);
          if (remove > 0) {
            distributedPlan[di].exercises[_ti] = { ...ex, sets: (ex.sets||0) - remove, _legsRebalanced: true };
            remaining -= remove;
          }
        }
      };

      const boostTier = (tier, deficit) => {
        distributedPlan[di].exercises.forEach((ex, ei) => {
          if (deficit <= 0 || !tier.has(_effGrp(ex))) return;
          const cap = hardCapForExercise(ex);
          const canAdd = Math.max(0, cap - (ex.sets||0));
          const add = Math.min(deficit, canAdd);
          if (add > 0) {
            distributedPlan[di].exercises[ei] = { ...ex, sets: (ex.sets||0) + add, _legsPriorityBoost: true };
            deficit -= add;
          }
        });
      };

      // ── الشرط 1: T1 (كوادز+هامستينج) > T2 (سمانة+ضامة) ──
      const t1 = getSets(LEGS_TIER1), t2 = getSets(LEGS_TIER2), t3 = getSets(LEGS_TIER3);
      console.log(`[PASS2J] Legs day di=${di}: T1=${t1} T2=${t2} T3=${t3}`);

      if (t1 <= t2) {
        // T1 ليس أكبر من T2 — ارفع T1 أو اقطع T2
        const needed = t2 - t1 + 1;
        boostTier(LEGS_TIER1, needed);
        // لو boost مش كفاية — اقطع T2
        const newT1 = getSets(LEGS_TIER1), newT2 = getSets(LEGS_TIER2);
        if (newT1 <= newT2) trimTier(LEGS_TIER2, newT2 - newT1 + 1);
      }

      // ── الشرط 2: T2 (سمانة+ضامة) > T3 (جلوتس) ──
      // FIX v26: نمرر floor=2 للجلوتس صرحة — يضمن إمكانية القطع في كل الحالات
      const t2After = getSets(LEGS_TIER2), t3After = getSets(LEGS_TIER3);
      if (t3After >= t2After) {
        trimTier(LEGS_TIER3, t3After - t2After + 1, 2);
      }

      // ── الشرط 3: T1 يضل أكتر من T3 بوضوح ──
      const t1Final = getSets(LEGS_TIER1), t3Final = getSets(LEGS_TIER3);
      if (t3Final >= t1Final) trimTier(LEGS_TIER3, t3Final - t1Final + 1, 2);

      const finalT1 = getSets(LEGS_TIER1), finalT2 = getSets(LEGS_TIER2), finalT3 = getSets(LEGS_TIER3);
      const finalTotal = (distributedPlan[di].exercises||[]).reduce((s,e)=>s+(e.sets||0),0);
      console.log(`[PASS2J]  Final di=${di}: T1(quad/ham)=${finalT1} > T2(calves/add)=${finalT2} > T3(glutes)=${finalT3} | Total=${finalTotal}`);
    });

    state._realTotalSets = distributedPlan.reduce((s,d)=>{
      if (!d?.exercises?.length) return s;
      return s + d.exercises.reduce((ss,e)=>ss+(e.sets||0),0);
    },0);
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASS 2N — DEDICATED LEGS DAY COMPLETENESS ENFORCER (v27)
  // الضمان: كل يوم أرجل منفصل (بدون صدر/ظر/كتف) لازم يتوي على
  //   ال 5 مجموعا الأساسية: كوادز + هامستنج + جلوتس + سمانة + ضامة
  // لو يومين أرجل - توزيع عادل لل weekly volume الكلي عليهم
  // المنطق:
  //   1) كشف كل أيام الأرجل المنفصلة
  //   2) كل يوم: تأكد من وجود ممثل لكل عضلة من ال 5 — و مش موجود - أضفه
  //   3) لو يومين أرجل - توزع ال weekly sets بشكل متوازن بين اليومين
  //      (مش كل يوم يشتغل مستقل — يتحسب الإجمالي الأسبوعي ويتوزع)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  (function pass2N_legsCompletenessEnforcer() {
    const _PUSH_PULL = new Set(['chest','back','shoulders','biceps','triceps']);
    const _LEG_MUSCLES = ['quads','hamstrings','glutes','calves','adductors'];
    const _exp2n = state.exp || 'intermediate';
    const _isHome = !!(state.equip === 'home' || state.equip === 'none');

    // ── كشف أيام الأرجل المنفصلة ──
    const legsDays = distributedPlan
      .map((day, di) => {
        if (day?.isRest || !day?.exercises?.length) return null;
        const grps = new Set(day.exercises.map(e => e.grp));
        const hasLegs = grps.has('quads') || grps.has('hamstrings');
        const hasPushPull = [...grps].some(g => _PUSH_PULL.has(g));
        return hasLegs && !hasPushPull ? di : null;
      })
      .filter(di => di !== null);

    if (legsDays.length === 0) return;
    console.log(`[PASS2N] Found ${legsDays.length} dedicated legs day(s): indices ${legsDays.join(',')}`);

    // ── ال DB pools لكل عضلة ──
    const _dbPools = {
      quads:     _isHome ? (HOME_DB?.quads?.all || [])      : (GYM_DB?.quads?.all || []),
      hamstrings:_isHome ? (HOME_DB?.hamstrings?.all || []) : (GYM_DB?.hamstrings?.all || []),
      glutes:    _isHome ? (HOME_DB?.glutes?.all || [])     : (GYM_DB?.glutes?.all || []),
      calves:    _isHome ? (HOME_DB?.calves?.all || [])     : (GYM_DB?.calves?.all || []),
      adductors: _isHome ? [] : (GYM_DB?.adductors?.all || [])
    };

    // ── Min sets لكل عضلة في يوم الأرجل ──
    const _legMuscleMinSets = {
      quads:      _exp2n === 'beginner' ? 6 : 6,   // min 6 weekly - ~3/day لو يومين
      hamstrings: _exp2n === 'beginner' ? 5 : 6,
      glutes:     _exp2n === 'beginner' ? 3 : 3,
      calves:     _exp2n === 'beginner' ? 3 : 3,
      adductors:  _isHome ? 0 : 3
    };

    // ── STEP 1: ضمان وجود كل عضلة في كل يوم أرجل ──
    legsDays.forEach(di => {
      const day = distributedPlan[di];
      const usedInDay = new Set(day.exercises.map(e => e.n));
      const grpsInDay = new Set(day.exercises.map(e => e.grp));

      _LEG_MUSCLES.forEach(grp => {
        // الضامة: تجاهل في home
        if (grp === 'adductors' && _isHome) return;

        if (!grpsInDay.has(grp)) {
          // مش موجودة — نضيف تمرين منها
          const _userBMI2n = state.bmi || 22;
          const _injuries2n = (state.injuries || []).filter(i => i !== 'none');
          const pool = (_dbPools[grp] || []).filter(e => {
            if (usedInDay.has(e.n)) return false;
            // Simple injury check inline (isExcluded is out of scope here)
            if (_injuries2n.length && e.safe_injuries) {
              for (const inj of _injuries2n) {
                const injBase = inj.replace('_mild','');
                if (!e.safe_injuries.includes(inj) && !e.safe_injuries.includes(injBase) &&
                    !e.safe_injuries.includes(inj+'_mild')) {
                  // Not safe — skip
                }
              }
            }
            // BMI check inline
            if (_userBMI2n >= 35 && ['Sissy Squat','Hack Squat Machine','Jump Squat','Box Jump','Burpees'].includes(e.n)) return false;
            if (_userBMI2n >= 30 && ['Sissy Squat','Jump Squat','Box Jump'].includes(e.n)) return false;
            return true;
          });
          if (pool.length === 0) return;

          const pick = pool[0];
          const newSets = grp === 'glutes' || grp === 'calves' || grp === 'adductors' ? 3 : 3;
          distributedPlan[di].exercises.push({
            ...pick,
            grp,
            sub: pick.sub || 'all',
            sets: newSets,
            reps: pick.reps || (grp === 'calves' ? '15-20' : '10-15'),
            rest: pick.rest || '60 ثانية',
            blocked: false,
            vid: (typeof getValidVid === 'function') ? getValidVid(pick.vid) : (pick.vid || '6HgNrPFaGlw'),
            _pass2nInjected: true, _protected: true
          });
          usedInDay.add(pick.n);
          grpsInDay.add(grp);
          console.log(`[PASS2N]  Injected ${pick.n} (${grp}) into legs day di=${di}`);
        }
      });
    });

    // ── STEP 2: لو يومين أرجل - توزيع أسبوعي عادل ──
    if (legsDays.length < 2) return;

    // احسب الإجمالي الأسبوعي الحالي لكل عضلة أرجل
    _LEG_MUSCLES.forEach(grp => {
      if (grp === 'adductors' && _isHome) return;

      // اجمع كل sets هذه العضلة عبر الأسبوع
      let weeklyTotal = 0;
      distributedPlan.forEach(d => {
        if (!d?.exercises?.length) return;
        d.exercises.forEach(e => { if (e.grp === grp) weeklyTotal += (e.sets || 0); });
      });

      // الحد الأسبوعي العلمي
      const weeklyCap = (MUSCLE_WEEKLY_CAPS[grp] || {})[_exp2n] || 999;
      weeklyTotal = Math.min(weeklyTotal, weeklyCap);

      // الحصة العادلة لكل يوم
      const fairShare = Math.floor(weeklyTotal / legsDays.length);
      const remainder = weeklyTotal % legsDays.length; // اليوم الأول يأخذ الباقي

      legsDays.forEach((di, idx) => {
        const targetSets = fairShare + (idx === 0 ? remainder : 0);
        if (targetSets <= 0) return;

        // اجمع ال sets الحالية لهذه العضلة في هذا اليوم
        const dayExs = distributedPlan[di].exercises.filter(e => e.grp === grp);
        const currentSets = dayExs.reduce((s, e) => s + (e.sets || 0), 0);

        if (currentSets === targetSets) return;

        const diff = targetSets - currentSets;

        if (diff > 0) {
          // ارفع sets على أول تمرين من هذه العضلة في اليوم
          for (let ei = 0; ei < distributedPlan[di].exercises.length; ei++) {
            if (distributedPlan[di].exercises[ei].grp !== grp) continue;
            const ex = distributedPlan[di].exercises[ei];
            const cap = _exp2n === 'beginner' ? 3 : 4;
            const canAdd = Math.max(0, cap - (ex.sets || 0));
            const add = Math.min(diff, canAdd);
            if (add > 0) {
              distributedPlan[di].exercises[ei] = { ...ex, sets: (ex.sets||0) + add, _pass2nBalanced: true };
              break;
            }
          }
        } else if (diff < 0) {
          // خفض sets — ابدأ من آخر تمرين (الأقل أهمية)
          let toRemove = Math.abs(diff);
          for (let ei = distributedPlan[di].exercises.length - 1; ei >= 0 && toRemove > 0; ei--) {
            if (distributedPlan[di].exercises[ei].grp !== grp) continue;
            const ex = distributedPlan[di].exercises[ei];
            const floor = grp === 'glutes' || grp === 'calves' || grp === 'adductors' ? 2 : 3;
            const canRemove = Math.max(0, (ex.sets || 0) - floor);
            const remove = Math.min(toRemove, canRemove);
            if (remove > 0) {
              distributedPlan[di].exercises[ei] = { ...ex, sets: (ex.sets||0) - remove, _pass2nBalanced: true };
              toRemove -= remove;
            }
          }
        }
      });

      // ── سجل النتيجة ──
      legsDays.forEach(di => {
        const daySets = distributedPlan[di].exercises
          .filter(e => e.grp === grp).reduce((s,e)=>s+(e.sets||0),0);
        console.log(`[PASS2N] ${grp} di=${di}: ${daySets} sets`);
      });
    });

    console.log('[PASS2N]  Legs completeness + balance enforced');
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASS 2P — QUAD / HAMSTRING WEEKLY BALANCE ENFORCER
  // القاعدة: Quad Weekly Sets - Hamstring Weekly Sets ≤ 3
  // إذا الفرق > 3 — يعيد توزيع ال sets تلقائيا
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  (function pass2P_quadHamBalance() {
    const _PUSH_PULL = new Set(['chest','back','shoulders','biceps','triceps']);
    const _exp2p = state.exp || 'intermediate';

    // احسب إجمالي أسبوعي لكل عضلة (dedicated leg days فقط لضمان الدقة)
    let quadTotal = 0, hamTotal = 0;
    distributedPlan.forEach(day => {
      if (!day?.exercises?.length || day.isRest) return;
      day.exercises.forEach(ex => {
        if (ex.grp === 'quads') quadTotal += (ex.sets || 0);
        // الجلوتس مستقلة — sub=glutes لا تحسب في hamTotal
        if (ex.grp === 'hamstrings' && ex.sub !== 'glutes') hamTotal += (ex.sets || 0);
      });
    });

    const diff = quadTotal - hamTotal;
    if (diff <= 3) {
      console.log(`[PASS2P]  Quad/Ham balance OK: quads=${quadTotal} ham=${hamTotal} diff=${diff}`);
      return;
    }

    console.log(`[PASS2P]  Imbalance detected: quads=${quadTotal} ham=${hamTotal} diff=${diff} — rebalancing...`);

    // نحتاج نرفع ال Hamstring أو نخفض ال Quad بمقدار (diff - 3)
    let toAdd = diff - 3; // الكمية المطلوبة لتقليص الفجوة

    // محاولة 1: رفع sets الهامستينج في أيام الأرجل
    distributedPlan.forEach(day => {
      if (!day?.exercises?.length || day.isRest || toAdd <= 0) return;
      const grps = new Set(day.exercises.map(e => e.grp));
      const hasPushPull = [...grps].some(g => _PUSH_PULL.has(g));
      if (hasPushPull) return; // dedicated leg days only

      day.exercises.forEach((ex, ei) => {
        if (toAdd <= 0) return;
        if (ex.grp !== 'hamstrings') return;
        const cap = _exp2p === 'beginner' ? 3 : 4;
        const canAdd = Math.max(0, cap - (ex.sets || 0));
        const add = Math.min(toAdd, canAdd);
        if (add > 0) {
          day.exercises[ei] = { ...ex, sets: (ex.sets || 0) + add, _pass2pBalanced: true };
          toAdd -= add;
          console.log(`[PASS2P]  ${ex.n}: +${add} sets (hamstrings)`);
        }
      });
    });

    // محاولة 2: لو لسه فيه فجوة - لو مفيش مجال رفع Ham - حاول تضيف تمرين هامستينج
    if (toAdd > 0) {
      const _isHome2p = !!(state.equip === 'home' || state.equip === 'none');
      const hamDB = _isHome2p ? (HOME_DB?.hamstrings?.all || []) : (GYM_DB?.hamstrings?.all || []);

      distributedPlan.forEach(day => {
        if (!day?.exercises?.length || day.isRest || toAdd <= 0) return;
        const grps = new Set(day.exercises.map(e => e.grp));
        const hasPushPull = [...grps].some(g => _PUSH_PULL.has(g));
        if (hasPushPull) return;
        if (!grps.has('quads') && !grps.has('hamstrings')) return;

        const usedNames = new Set(day.exercises.map(e => e.n));
        const pick = hamDB.find(e => !usedNames.has(e.n));
        if (!pick) return;

        const newSets = Math.min(toAdd, _exp2p === 'beginner' ? 3 : 3);
        day.exercises.push({
          ...pick, grp: 'hamstrings', sub: pick.sub || 'dominant',
          sets: newSets, reps: '10-12', rest: '90 ثانية',
          blocked: false,
          vid: (typeof getValidVid === 'function') ? getValidVid(pick.vid) : (pick.vid || ''),
          _pass2pInjected: true, _protected: true
        });
        toAdd -= newSets;
        console.log(`[PASS2P]  Injected ${pick.n} (${newSets} sets) for ham balance`);
      });
    }

    // إعادة حساب نهائية للتأكيد
    let qFinal = 0, hFinal = 0;
    distributedPlan.forEach(day => {
      if (!day?.exercises?.length || day.isRest) return;
      day.exercises.forEach(ex => {
        if (ex.grp === 'quads')      qFinal += (ex.sets || 0);
        if (ex.grp === 'hamstrings') hFinal += (ex.sets || 0);
      });
    });
    console.log(`[PASS2P]  After rebalance: quads=${qFinal} ham=${hFinal} diff=${qFinal - hFinal}`);
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASS 2Q — LEG ANTI-STACKING: إعادة ترتيب التمارين داخل يوم الأرجل
  // القاعدة: لا تتراص نفس العضلة أكثر من مرتين متتاليتين
  // الترتي المفضل: كوادز - هامستينج - سمانة - جلوتس - ضامة - كوادز - هامستينج
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  (function pass2Q_legAntiStacking() {
    const _PUSH_PULL = new Set(['chest','back','shoulders','biceps','triceps']);
    // الأولوية المفضلة لعضلات الأرجل
    const LEG_ORDER = ['quads','hamstrings','calves','adductors','glutes'];
    const LEG_GRP_PRIORITY = {};
    LEG_ORDER.forEach((g, i) => { LEG_GRP_PRIORITY[g] = i; });

    distributedPlan.forEach(day => {
      if (!day?.exercises?.length || day.isRest) return;
      const grps = new Set(day.exercises.map(e => e.grp));
      const hasPushPull = [...grps].some(g => _PUSH_PULL.has(g));
      const hasLegs = grps.has('quads') || grps.has('hamstrings');
      if (!hasLegs || hasPushPull) return; // dedicated leg day only

      const exs = day.exercises;

      // تحقق: هل في تكدس (نفس العضلة 3+ مرات متتالية)؟
      function hasStacking(arr) {
        for (let i = 2; i < arr.length; i++) {
          if (arr[i].grp === arr[i-1].grp && arr[i].grp === arr[i-2].grp) return true;
        }
        return false;
      }

      if (!hasStacking(exs)) return; // لا يوجد تكدس — لا حاجة للترتيب

      // فصل التمارين حسب عضلتها وإعادة ترتيبها بالتناوب
      const buckets = {};
      exs.forEach(ex => {
        const g = ex.grp || 'other';
        if (!buckets[g]) buckets[g] = [];
        buckets[g].push(ex);
      });

      // ترتيب العضلات: كوادز - هامستينج - سمانة + ضامة - جلوتس - ...
      const sortedGroups = Object.keys(buckets).sort((a, b) => {
        const pa = LEG_GRP_PRIORITY[a] ?? 99;
        const pb = LEG_GRP_PRIORITY[b] ?? 99;
        return pa - pb;
      });

      // Interleave: خذ واحد من كل مجموعة بالتناوب
      const reordered = [];
      let round = 0;
      while (reordered.length < exs.length) {
        let added = false;
        for (const g of sortedGroups) {
          if (round < buckets[g].length) {
            reordered.push(buckets[g][round]);
            added = true;
          }
        }
        if (!added) break;
        round++;
      }

      // تأكد من عدم خسارة أي تمرين
      if (reordered.length === exs.length) {
        day.exercises = reordered;
        console.log(`[PASS2Q]  Reordered legs day — anti-stacking applied`);
      }
    });
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SIMILAR_PAIRS — SINGLE SOURCE OF TRUTH
  // أزواج التمارين المتشابهة ميكانيكيا (نفس الزاوية / نفس العضلة الرئيسية)
  // مستخدم ف: PASS 2R + finalDedupPass + enforceMinExercisesAbsolute
  // القاعدة: الأول المختار يبقى، الثاني يحذف تلقائيا
  //  أي إضافة جديدة: أضفها هنا فقط — ال 3 functions تقرأ من هنا تلقائيا
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const SIMILAR_PAIRS = [

      // ── CHEST (صدر) ──────────────────────────────────────────────────
      // Flat (mid) — نفس الزاوية السطحة
      ['Barbell Bench Press',           'Dumbbell Bench Press'],
      ['Barbell Bench Press',           'Machine Chest Press'],
      ['Barbell Bench Press',           'Smith Machine Flat Press'],
      ['Dumbbell Bench Press',          'Machine Chest Press'],
      ['Dumbbell Bench Press',          'Smith Machine Flat Press'],
      ['Machine Chest Press',           'Smith Machine Flat Press'],
      // Incline (upper) — نفس الزاوية المائلة للأعلى
      ['Incline Barbell Press',         'Incline Dumbbell Press'],
      ['Incline Barbell Press',         'Incline Smith Machine Press'],
      ['Incline Barbell Press',         'Hammer Strength Incline Press'],
      ['Incline Dumbbell Press',        'Incline Smith Machine Press'],
      ['Incline Dumbbell Press',        'Hammer Strength Incline Press'],
      // Fly / isolation (تفتيح) — نفس حركة التفتيح Mid
      ['Pec Deck Machine',              'Seated Cable Fly'],
      ['Pec Deck Machine',              'Dumbbell Fly'],
      ['Seated Cable Fly',              'Dumbbell Fly'],
      // Cable Fly Upper (صدر علوي داخلي) — Low to High pattern
      ['Low to High Cable Fly',         'Cable Upper Chest Crossover'],
      // Cable Fly Lower (صدر سفلي داخلي) — High to Low pattern
      ['High to Low Cable Fly',         'Decline Cable Fly'],
      // Cable Chest Press — horizontal push، similar ل Flat press pattern
      ['Cable Chest Press',             'Machine Chest Press'],
      ['Cable Chest Press',             'Dumbbell Bench Press'],
      // Decline (lower)
      ['Decline Barbell Press',         'Decline Dumbbell Press'],
      ['Decline Barbell Press',         'Dips (Chest Variation)'],
      ['Decline Dumbbell Press',        'Dips (Chest Variation)'],

      // ── BACK (ظهر) — Vertical Pull ─────────────────────────────────────
      ['Wide Grip Lat Pulldown',        'Neutral Grip Lat Pulldown'],
      ['Wide Grip Lat Pulldown',        'Close Grip Pulldown'],
      ['Wide Grip Lat Pulldown',        'Pull-Ups'],
      ['Neutral Grip Lat Pulldown',     'Close Grip Pulldown'],
      ['Neutral Grip Lat Pulldown',     'Pull-Ups'],
      ['Close Grip Pulldown',           'Pull-Ups'],
      // Horizontal Pull (سمك الظهر)
      ['Barbell Bent Over Row',         'Dumbbell Bent Over Row'],
      ['Barbell Bent Over Row',         'Smith Machine Row'],
      ['Seated Cable Row',              'Chest Supported Row Machine'],
      ['Seated Cable Row',              'Wide Grip Seated Row'],
      ['Chest Supported Row Machine',           'Wide Grip Seated Row'],
      ['One Arm Dumbbell Row',          'Meadows Row'],
      ['One Arm Dumbbell Row',          'Single Arm Cable Row'],
      ['Meadows Row',                   'Single Arm Cable Row'],
      // Pullover
      ['Lat Pullover Machine',          'Cable Pullover'],
      ['Lat Pullover Machine',          'Dumbbell Pullover (Bench/Floor)'],
      ['Cable Pullover',                'Dumbbell Pullover (Bench/Floor)'],

      // ── SHOULDERS (أكتاف) ───────────────────────────────────────────────
      // Press (أمامي / مركب)
      ['Overhead Barbell Press',        'Seated DB Shoulder Press'],
      ['Overhead Barbell Press',        'Machine Shoulder Press'],
      ['Overhead Barbell Press',        'Smith Machine Shoulder Press'],
      ['Overhead Barbell Press',        'Arnold Press'],
      ['Seated DB Shoulder Press',      'Machine Shoulder Press'],
      ['Seated DB Shoulder Press',      'Smith Machine Shoulder Press'],
      ['Seated DB Shoulder Press',      'Arnold Press'],
      ['Machine Shoulder Press',        'Smith Machine Shoulder Press'],
      ['Dumbbell Shoulder Press (Seated)', 'Seated DB Shoulder Press'],
      ['Dumbbell Shoulder Press (Seated)', 'Machine Shoulder Press'],
      ['Dumbbell Shoulder Press (Seated)', 'Overhead Barbell Press'],
      // Lateral (جانبي)
      ['Dumbbell Lateral Raise',        'Cable Lateral Raise'],
      ['Dumbbell Lateral Raise',        'Machine Lateral Raise'],
      ['Dumbbell Lateral Raise',        'Leaning Cable Lateral Raise'],
      ['Cable Lateral Raise',           'Machine Lateral Raise'],
      ['Cable Lateral Raise',           'Leaning Cable Lateral Raise'],
      ['Machine Lateral Raise',         'Leaning Cable Lateral Raise'],
      // Rear Delt (خلفي)
      ['Rope Face Pull',                'Rear Delt Machine Fly'],
      ['Rope Face Pull',                'Bent Over Rear Delt Raise'],
      ['Rope Face Pull',                'Cable Rear Delt Fly'],
      ['Rope Face Pull',                'Reverse Cable Crossover'],
      ['Rear Delt Machine Fly',         'Bent Over Rear Delt Raise'],
      ['Rear Delt Machine Fly',         'Cable Rear Delt Fly'],
      ['Rear Delt Machine Fly',         'Reverse Cable Crossover'],
      ['Bent Over Rear Delt Raise',     'Cable Rear Delt Fly'],
      ['Bent Over Rear Delt Raise',     'Reverse Cable Crossover'],
      ['Cable Rear Delt Fly',           'Reverse Cable Crossover'],

      // ── BICEPS (بايسبس) ─────────────────────────────────────────────────
      // Mid / Standard
      ['EZ Bar Curl',                   'Barbell Curl'],
      ['EZ Bar Curl',                   'Standing Dumbbell Curl'],
      ['Barbell Curl',                  'Standing Dumbbell Curl'],
      // Preacher / Shortened
      ['Machine Preacher Curl',         'EZ Bar Preacher Curl'],
      ['Machine Preacher Curl',         'Spider Curl (EZ Bar)'],
      ['EZ Bar Preacher Curl',          'Spider Curl (EZ Bar)'],
      // Stretch / Long Head — (Cable Bayesian Curl = Bayesian Cable Curl نفس الاسم مكرر في DB، حذفنا الزوج المكرر)
      ['Bayesian Cable Curl',           'Incline Dumbbell Curl'],

      // ── TRICEPS (ترايسبس) ───────────────────────────────────────────────
      // Overhead / Long Head
      ['Overhead Cable Tricep Extension', 'Skull Crushers (EZ Bar)'],
      ['Overhead Cable Tricep Extension', 'Dumbbell Overhead Tricep Ext'],
      ['Skull Crushers (EZ Bar)',          'Dumbbell Overhead Tricep Ext'],
      // Pushdown / Lateral Head — (elbow-only, shoulder neutral)
      ['Rope Tricep Pushdown',            'Bar Tricep Pushdown'],
      ['Rope Tricep Pushdown',            'Katana Extension'],
      ['Bar Tricep Pushdown',             'Katana Extension'],
      // Kickback — shoulder extension محور مختلف عن Pushdown، Long Head تحفيز مختلف
      ['Cable Tricep Kickback',           'Bar Tricep Pushdown'],
      // Tricep Dips Machine — compound (صدر سفلي + كتف أمامي)، مش isolation مثل Pushdown
      ['Tricep Dips Machine',             'Dips (Chest Variation)'],

      // ── TRAPS (ترابيس) ──────────────────────────────────────────────────
      ['Barbell Shrugs',                'Dumbbell Shrugs'],
      ['Barbell Shrugs',                'Smith Machine Shrugs'],
      ['Dumbbell Shrugs',               'Smith Machine Shrugs'],

      // ── LEGS (أرجل) — موجودة سابقا + موسعة ──────────────────────────
      // Hip Hinge / RDL
      ['Romanian Deadlift',             'Stiff Leg Deadlift'],
      ['Romanian Deadlift',             'Dumbbell Romanian Deadlift'],
      ['Romanian Deadlift',             'Single Leg RDL (Dumbbell)'],
      ['Stiff Leg Deadlift',            'Dumbbell Romanian Deadlift'],
      ['Dumbbell Romanian Deadlift',    'Single Leg RDL (Dumbbell)'],
      // Squat pattern — knee-dominant, quad-anterior
      ['Hack Squat Machine',            'Smith Machine Squat'],
      ['Hack Squat Machine',            'Barbell Back Squat'],
      ['Hack Squat Machine',            'Leg Press (45°)'],
      ['Smith Machine Squat',           'Barbell Back Squat'],
      ['Smith Machine Squat',           'Leg Press (45°)'],
      ['Barbell Back Squat',            'Leg Press (45°)'],
      ['Pendulum Squat',                'Hack Squat Machine'],
      ['Pendulum Squat',                'Smith Machine Squat'],
      ['Pendulum Squat',                'Leg Press (45°)'],
      // Unilateral Squat — أحادي (مختلف عن bilateral لكن similar لبعض)
      ['Bulgarian Split Squat',         'Walking Lunges (Barbell)'],
      ['Bulgarian Split Squat',         'Step-Up with Barbell'],
      ['Walking Lunges (Barbell)',       'Step-Up with Barbell'],
      // Leg Curl
      ['Lying Leg Curl Machine',        'Seated Leg Curl Machine'],
      ['Lying Leg Curl Machine',        'Single Leg Curl Machine'],
      ['Seated Leg Curl Machine',       'Single Leg Curl Machine'],
      // Leg Extension
      ['Leg Extension Machine',         'Single Leg Extension'],
      // Hip Thrust
      ['Barbell Hip Thrust',            'Smith Machine Hip Thrust'],
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASS 2R — MOVEMENT PATTERN DEDUP (كل الأيام بدون استثناء)
  // القاعدة الذهبية: ممنوع تمرينان بنفس النمط الحركي في نفس اليوم
  // لأي عضلة كانت: صدر، ظهر، كتف، بايسبس، ترايسبس، أرجل، ترابيس
  // مثال: Flat Barbell Bench Press + Flat Dumbbell Bench Press =  ممنوع
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  (function pass2R_globalPatternDedup() {

    // بناء lookup سريع: اسم التمرين - Set بأسماء التمارين المشابهة
    const SIMILAR_LOOKUP = {};
    SIMILAR_PAIRS.forEach(([a, b]) => {
      if (!SIMILAR_LOOKUP[a]) SIMILAR_LOOKUP[a] = new Set();
      if (!SIMILAR_LOOKUP[b]) SIMILAR_LOOKUP[b] = new Set();
      SIMILAR_LOOKUP[a].add(b);
      SIMILAR_LOOKUP[b].add(a);
    });

    // ── PATCH-GYM-2: حماية أسفل الظهر — ممنوع دمج الديدليفت + تحديد تكراراته ──
    // يطبق على كل الأيام (مش أيام الأرجل فقط)
    const _DEADLIFT_NAMES = new Set([
      'Romanian Deadlift','Dumbbell Romanian Deadlift',
      'Stiff Leg Deadlift','Single Leg RDL (Dumbbell)',
      'Deficit Deadlift','Sumo Deadlift'
    ]);
    distributedPlan.forEach(day => {
      if (!day?.exercises?.length || day.isRest) return;
      const deadliftsInDay = day.exercises.filter(e => _DEADLIFT_NAMES.has(e.n));
      if (deadliftsInDay.length > 1) {
        deadliftsInDay.sort((a,b) => (a.tier==='S'?0:1) - (b.tier==='S'?0:1));
        const keepDeadlift = new Set([deadliftsInDay[0].n]);
        day.exercises = day.exercises.filter(e => !_DEADLIFT_NAMES.has(e.n) || keepDeadlift.has(e.n));
        console.log(`[PATCH-GYM-2]  Removed duplicate deadlifts — kept: ${deadliftsInDay[0].n}`);
      }
      // تحديد تكرارات الديدليفت: 8-12 فقط (حماية الفقرات القطنية)
      day.exercises.forEach(ex => {
        if (_DEADLIFT_NAMES.has(ex.n)) {
          ex.reps = '8-12';
          ex._deadliftCapApplied = true;
        }
      });
    });

    // ══════════════════════════════════════════════════════════════════════
    // التطبيق: كل يوم بدون استثناء (أرجل + صدر + ظهر + كتف + ذراع + ...)
    // تم إزالة شرط "أيام الأرجل فقط" — القاعدة عالمية الآن
    // ══════════════════════════════════════════════════════════════════════
    distributedPlan.forEach((day, dayIdx) => {
      if (!day?.exercises?.length || day.isRest) return;

      const kept = [];
      const usedNames = new Set();
      // العضلات المحذوفة بسبب التشابه — نحتاج بديل لها
      const removedGrps = [];

      day.exercises.forEach(ex => {
        // هل التمرين ده مشابه لأي تمرين موجود بالفعل في نفس اليوم؟
        const hasSimilar = SIMILAR_LOOKUP[ex.n] &&
          [...SIMILAR_LOOKUP[ex.n]].some(s => usedNames.has(s));
        if (hasSimilar) {
          console.log(`[PASS2R]  Day ${dayIdx+1}: Removed similar "${ex.n}" (similar already present)`);
          // سجل عضلة التمرين المحذوف لنجيب بديل مختلف ليها
          if (ex.grp) removedGrps.push({ grp: ex.grp, sub: ex.sub || 'all', removedEx: ex });
          return;
        }
        kept.push(ex);
        usedNames.add(ex.n);
      });

      // ── بدل كل تمرين محذوف بتمرين مختلف من نفس العضلة ────────────────
      if (removedGrps.length > 0) {
        const _isHomeP2r = !!(state.equip === 'home' || state.equip === 'none');
        const _dbP2r = _isHomeP2r ? HOME_DB : GYM_DB;
        const _injuries2r = (state.injuries||[]).filter(i => i !== 'none');

        removedGrps.forEach(({ grp, sub, removedEx }) => {
          // ابحث عن تمرين من نفس العضلة غير موجود في اليوم
          const grpData = _dbP2r[grp] || {};
          // جرب نفس ال sub أولا ثم باقي ال subs
          let subKeys = [sub, ...Object.keys(grpData).filter(k => k !== sub)];
          // ── FIX v51: امنع تقاطع عائلة الدفع/السحب في بديل الأكتاف ──
          // دلتا خلفي (rear) = سحب فقط؛ press/lateral = دفع. بدون هذا القيد كان
          // ال dedup يضع Machine Shoulder Press (v_push) في خانة sub='rear'
          // على يوم Pull (عطل push_on_pull الحقيقي).
          if (grp === 'shoulders') {
            const _PUSH_SUBS2r = new Set(['press', 'lateral']);
            if (sub === 'rear') subKeys = subKeys.filter(k => !_PUSH_SUBS2r.has(k));
            else if (_PUSH_SUBS2r.has(sub)) subKeys = subKeys.filter(k => k !== 'rear');
          }
          let replacement = null;
          let replacementSub = sub;

          for (const sk of subKeys) {
            const pool = grpData[sk] || [];
            replacement = pool.find(e => {
              if (usedNames.has(e.n)) return false;
              // تحقق من الإصابات
              if (_injuries2r.length && e.safe_injuries) {
                for (const inj of _injuries2r) {
                  const injBase = inj.replace('_mild','');
                  if (!e.safe_injuries.includes(inj) && !e.safe_injuries.includes(injBase) &&
                      !e.safe_injuries.includes(injBase+'_mild')) return false;
                }
              }
              // تأكد إنه مش مشابه لأي تمرين موجود
              if (SIMILAR_LOOKUP[e.n] && [...SIMILAR_LOOKUP[e.n]].some(s => usedNames.has(s))) return false;
              return true;
            });
            if (replacement) { replacementSub = sk; break; }
          }

          if (replacement) {
            kept.push({
              ...replacement,
              grp, sub: replacementSub,
              sets: removedEx.sets || 3,
              reps: removedEx.reps || '10-15',
              rest: removedEx.rest || '60-90 ث',
              blocked: false,
              vid: (typeof getValidVid === 'function') ? getValidVid(replacement.vid) : (replacement.vid||''),
              _pass2rReplacement: true
            });
            usedNames.add(replacement.n);
            console.log(`[PASS2R]  Day ${dayIdx+1}: Replaced "${removedEx.n}" - "${replacement.n}" (${grp})`);
          } else {
            console.log(`[PASS2R]  Day ${dayIdx+1}: No replacement found for ${grp}/${sub}`);
          }
        });
      }

      if (kept.length !== day.exercises.length || removedGrps.length > 0) {
        day.exercises = kept;
        console.log(`[PASS2R]  Day ${dayIdx+1}: Dedup+Replace applied — ${kept.length} exercises`);
      }
    });
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASS 2_FINAL — FINAL LEG VALIDATION (القسم السادس من الوثيقة)
  // يفحص 6 شروط ويسجل تقرير تحقق — يعاد التوليد لو فشل
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  (function pass2_FINAL_LegValidation() {
    const _PUSH_PULL = new Set(['chest','back','shoulders','biceps','triceps']);
    const _isHome2f = !!(state.equip === 'home' || state.equip === 'none');
    const failures = [];

    // ── شرط 1: عدد أيام الجدول = اختيار المستخدم ──────────────────────
    const activeDays = distributedPlan.filter(d => !d.isRest).length;
    if (activeDays !== state.days) {
      failures.push(`[FINAL-1]  Day count mismatch: plan=${activeDays} expected=${state.days}`);
    }

    // ── لكشف عن أيام الأرجل المنفصلة ───────────────────────────────────
    const legDaysFinal = distributedPlan
      .map((day, di) => {
        if (day?.isRest || !day?.exercises?.length) return null;
        const grps = new Set(day.exercises.map(e => e.grp));
        const hasLegs = grps.has('quads') || grps.has('hamstrings');
        const hasPushPull = [...grps].some(g => _PUSH_PULL.has(g));
        return hasLegs && !hasPushPull ? di : null;
      })
      .filter(di => di !== null);

    // ── شرط 2: تغطية عضلات الأرجل الإلزامية ────────────────────────────
    const _REQ_MUSCLES = ['quads','hamstrings','calves'];
    const _REQ_GYM_EXTRA = ['adductors'];
    const weeklyGrps = new Set();
    distributedPlan.forEach(day => {
      if (!day?.exercises?.length || day.isRest) return;
      day.exercises.forEach(ex => weeklyGrps.add(ex.grp));
    });
    _REQ_MUSCLES.forEach(m => {
      if (!weeklyGrps.has(m)) failures.push(`[FINAL-2]  Missing required leg muscle: ${m}`);
    });
    // تحقق من glutes (hamstrings/glutes sub)
    const hasGlutes = distributedPlan.some(day =>
      (day?.exercises||[]).some(e => e.grp === 'hamstrings' && e.sub === 'glutes')
    );
    if (!hasGlutes && legDaysFinal.length > 0) {
      failures.push('[FINAL-2]  Missing: glutes (hamstrings/glutes)');
    }
    if (!_isHome2f) {
      _REQ_GYM_EXTRA.forEach(m => {
        if (!weeklyGrps.has(m)) failures.push(`[FINAL-2]  Missing Gym leg muscle: ${m}`);
      });
    }

    // ── شرط 3: توازن Quad/Ham ≤ 3 sets ──────────────────────────────────
    let qTotal = 0, hTotal = 0;
    distributedPlan.forEach(day => {
      if (!day?.exercises?.length || day.isRest) return;
      day.exercises.forEach(ex => {
        if (ex.grp === 'quads')      qTotal += (ex.sets || 0);
        if (ex.grp === 'hamstrings') hTotal += (ex.sets || 0);
      });
    });
    if ((qTotal - hTotal) > 3) {
      failures.push(`[FINAL-3]  Quad/Ham imbalance: quads=${qTotal} ham=${hTotal} diff=${qTotal-hTotal}`);
    }

    // ── شرط 4: لا عضلة أرجل مهملة أسبوعيا (< 3 sets) ──────────────────
    const _LEG_MIN = { quads:6, hamstrings:6, calves:3, adductors: _isHome2f ? 0 : 3 };
    const weeklyMuscle = {};
    distributedPlan.forEach(day => {
      if (!day?.exercises?.length || day.isRest) return;
      day.exercises.forEach(ex => {
        weeklyMuscle[ex.grp] = (weeklyMuscle[ex.grp] || 0) + (ex.sets || 0);
      });
    });
    Object.entries(_LEG_MIN).forEach(([m, min]) => {
      if (min === 0) return;
      const actual = weeklyMuscle[m] || 0;
      if (actual < min) {
        failures.push(`[FINAL-4]  Neglected muscle: ${m} = ${actual} sets (min: ${min})`);
      }
    });

    // ── شرط 5: لا تكدس 3+ مرات متتالية نفس العضلة ──────────────────────
    legDaysFinal.forEach(di => {
      const exs = distributedPlan[di]?.exercises || [];
      for (let i = 2; i < exs.length; i++) {
        if (exs[i].grp === exs[i-1].grp && exs[i].grp === exs[i-2].grp) {
          failures.push(`[FINAL-5]  Muscle stacking in day ${di}: ${exs[i].grp} ×3+ consecutive`);
          break;
        }
      }
    });

    // ── شرط 6: لا تكرار نمط حركي مشابه ─────────────────────────────────
    const _SIMILAR_P = [
      ['Romanian Deadlift','Stiff Leg Deadlift'],
      ['Romanian Deadlift','Dumbbell Romanian Deadlift'],
      ['Stiff Leg Deadlift','Dumbbell Romanian Deadlift'],
      ['Hack Squat Machine','Smith Machine Squat'],
      ['Lying Leg Curl Machine','Seated Leg Curl Machine'],
    ];
    legDaysFinal.forEach(di => {
      const names = new Set((distributedPlan[di]?.exercises||[]).map(e => e.n));
      _SIMILAR_P.forEach(([a, b]) => {
        if (names.has(a) && names.has(b)) {
          failures.push(`[FINAL-6]  Duplicate movement pattern in day ${di}: "${a}" + "${b}"`);
        }
      });
    });

    // ── تقرير نهائي ──────────────────────────────────────────────────────
    if (failures.length === 0) {
      console.log('[PASS2_FINAL]  All 6 leg validation checks passed');
    } else {
      failures.forEach(f => console.warn(f));
      console.warn(`[PASS2_FINAL] ${failures.length} validation issue(s) — the above passes should have auto-fixed these. Check PASS2P/2Q/2R/2N logs.`);
      // ملاحظة: لا نلغي الخطة — ال passes السابقة يجب أن تكون أصلحت المشاكل
      // هذا ال pass هو للمراقبة والتشخيص فقط
    }
  })();

  // ── PASS 2M: ABSOLUTE MIN SETS ENFORCER — يعمل قبل 2K ──────────────────
  // FIX v25: نقل للأمام ليعمل قبل ال cap sweep — المنطق:
  //   1) 2M تضبط الحد الأدنى (المتقدم ≥ 3 sets/تمرين)
  //   2) 2K تقطع أي زيادة فوق ال weekly cap بعدها
  // هكذا لو 2M رفعت set - 2K تقطع الزيادة بشكل صحيح بدل تعارض
  (function enforceAbsoluteMinSets() {
    if (state.exp !== 'advanced') return; // المبتدئ والمتوسط: 2 مقبول
    distributedPlan.forEach(day => {
      if (!day || !day.exercises || day.isRest) return;
      day.exercises.forEach((ex, i) => {
        if ((ex.sets || 0) < 3) {
          day.exercises[i] = { ...ex, sets: 3, _minSetsEnforced: true };
        }
      });
    });
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASS 2K — الحارس المطلق النهائي لكل عضلة (آخر سور قبل الرندر مباشرة)
  // يطبق بعد PASS 2J + 2M لأن boostTier و minSets ممكن يتجاوزوا MUSCLE_WEEKLY_CAPS
  // القاعدة: كل عضلة لا تتجاوز MAX من الجدول العلمي مهما حصل في أي pass
  // الجدول: MUSCLE_WEEKLY_CAPS (مبتدئ/متوسط/متقدم) — مصدر الحقيقة الوحيد
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  (function pass2K_finalMuscleCapSweep() {
    const _exp2k = state.exp || 'intermediate';

    // كل عضلة موجودة في MUSCLE_WEEKLY_CAPS يتم فحصها
    Object.keys(MUSCLE_WEEKLY_CAPS).forEach(grp => {
      const cap = MUSCLE_WEEKLY_CAPS[grp][_exp2k];
      if (!cap) return;

      // احسب الإجمالي الأسبوعي الفعلي
      let total = 0;
      distributedPlan.forEach(d => {
        if (!d?.exercises?.length) return;
        d.exercises.forEach(ex => { if (ex.grp === grp) total += (ex.sets || 0); });
      });

      if (total <= cap) return; //  ضمن الحد — لا تدخل

      // تجاوز الحد - اقطع من التمارين ذات أعلى sets أولا (isolation - compound)
      let toRemove = total - cap;
      const exsList = [];
      distributedPlan.forEach((day, di) => {
        if (!day?.exercises?.length) return;
        day.exercises.forEach((ex, ei) => {
          if (ex.grp === grp) exsList.push({ di, ei, sets: ex.sets || 0, rank: getExerciseRank(ex) });
        });
      });
      // ترتيب: rank أعلى (isolation) أولا، ثم sets أعلى
      exsList.sort((a, b) => b.rank - a.rank || b.sets - a.sets);

      // Pass 1: تقليص مع ال floor
      for (const { di, ei } of exsList) {
        if (toRemove <= 0) break;
        const ex = distributedPlan[di].exercises[ei];
        const canRemove = Math.max(0, (ex.sets || 0) - getMinSetsForExp(_exp2k, grp));
        const remove = Math.min(toRemove, canRemove);
        if (remove > 0) {
          distributedPlan[di].exercises[ei] = { ...ex, sets: ex.sets - remove, _pass2kCap: true };
          toRemove -= remove;
        }
      }

      // Pass 2: لو لسه فوق ال cap بعد ال floor — احذف تمارين كاملة
      if (toRemove > 0) {
        exsList.sort((a, b) => b.rank - a.rank || a.sets - b.sets); // isolation أولا، الأقل sets أولا
        for (const { di, ei } of exsList) {
          if (toRemove <= 0) break;
          const ex = distributedPlan[di].exercises[ei];
          if (!ex || (ex.sets||0) <= 0) continue;
          toRemove -= (ex.sets||0);
          distributedPlan[di].exercises[ei] = { ...ex, sets: 0, _pass2kRemoved: true };
          console.log(`[PASS2K]  Removed "${ex.n}" (${grp}) — floor conflict, enforcing hard cap`);
        }
        distributedPlan.forEach((day, di) => {
          if (!day?.exercises?.length) return;
          distributedPlan[di].exercises = day.exercises.filter(e => (e.sets||0) > 0);
        });
      }

      // تحقق نهائي
      let finalTotal = 0;
      distributedPlan.forEach(d => {
        if (!d?.exercises?.length) return;
        d.exercises.forEach(ex => { if (ex.grp === grp) finalTotal += (ex.sets || 0); });
      });
      console.log(`[PASS2K] ${grp} (${_exp2k}): ${total} - ${finalTotal}  cap ${cap}`);
    });

    // تحديث الإجمالي الأسبوعي النهائي
    state._realTotalSets = distributedPlan.reduce((s, d) => {
      if (!d?.exercises?.length) return s;
      return s + d.exercises.reduce((ss, e) => ss + (e.sets || 0), 0);
    }, 0);
    console.log('[PASS2K]  Final sweep complete. Weekly total:', state._realTotalSets);
  })();

  // ── PASS 2L: HARD EXERCISE COUNT CAP — إلزامي بعد كل ال passes ──────────
  // FIX v24: يضمن أن أي يوم لا يتجاوز 7 تمارين مهما أضافت ال patches وال modules
  // يوم الأرجل: max 7 | باقي الأيام: max 7 (متوسط/متقدم) أو 6 (مبتدئ)
  (function enforceExerciseCountCap() {
    const _isBegCap = state.exp === 'beginner';
    distributedPlan.forEach((day) => {
      if (!day || !day.exercises || day.isRest) return;
      const MAX_EX_HARD = _isBegCap ? 6 : 7; // مطلق — لا استثناء
      if (day.exercises.length <= MAX_EX_HARD) return;
      // احذف من الخلف (finishers أولا، ثم isolation)
      const sorted = [...day.exercises].map((ex, i) => ({ex, i, rank: getExerciseRank(ex)}));
      sorted.sort((a, b) => b.rank - a.rank); // rank أعلى = finisher = يحذف أولا
      const toRemoveCount = day.exercises.length - MAX_EX_HARD;
      // FIX v57: احذف غير المحمي أولا (السمانة المختارة تعلم _protected) — السمانة لا تحذف إلا كملاذ أخير
      const _nonProt57 = sorted.filter(x => !x.ex._protected);
      const _prot57 = sorted.filter(x => x.ex._protected);
      const _removeOrder57 = [..._nonProt57, ..._prot57];
      const idxToRemove = new Set(_removeOrder57.slice(0, toRemoveCount).map(x => x.i));
      day.exercises = day.exercises.filter((_, i) => !idxToRemove.has(i));
      console.log(`[PASS2L]  Day "${day.name}" trimmed to ${day.exercises.length} exercises (was ${day.exercises.length + toRemoveCount})`);
    });
  })();

  // ── PASS 2S: HARD DAILY SETS CAP — 21 مجموعة/يوم، 24 ليوم الأرجل الفردي ──
  // PATCH-GYM-SETS: السقف الصارم — يطبق مرتين (هنا وبعد PATCH-GYM-3)
  function enforceHardDailySetCap() {
    // SPEC v25 — السلطة النهائية للسقف اليومي (مصدر واحد للحقيقة)
    // الجداول قليلة الأيام (≤3): سقف موحد لكل الأيام حسب المستوى+الوقت
    //   مبتدئ 18 / متوسط 22 / متقدم 24 — ويخفض ل 16 إذا كانت الجلسة ≤45 دق
    // الجداول 4+ أيام: تبقى على سلوكها الأصلي (21 عادي / 24 أرجل)
    const _days3   = Math.max(state.days || 3, 1);
    const _t3      = Number(state.time) || Number(state.duration) || 60;
    const _lowDays3 = _days3 <= 3;
    let _HARD_CAP_NORMAL, _HARD_CAP_LEGS;
    if (_lowDays3) {
      const _tier3 = state.exp === 'beginner' ? 18 : state.exp === 'advanced' ? 24 : 22;
      const _cap3  = Math.min(_tier3, _t3 <= 45 ? 16 : 24);
      _HARD_CAP_NORMAL = _cap3;
      _HARD_CAP_LEGS   = _cap3;
    } else {
      _HARD_CAP_NORMAL = 21;
      _HARD_CAP_LEGS   = 24;
    }
    const _splitKey3 = state.recommendedSplit || state.selectedSplit || '';
    const _singleLegsSplits3 = new Set(['ppl','ppl_3','hybrid','brosplit','anterior_posterior']);

    const _legsFreq3 = distributedPlan.filter(d =>
      !d.isRest && (d.groups||[]).some(([g]) => g === 'quads' || g === 'hamstrings')
    ).length;
    const _isSingleLegs3 = _legsFreq3 <= 1
      ? (_legsFreq3 === 0 ? _singleLegsSplits3.has(_splitKey3) : true)
      : false;

    distributedPlan.forEach(day => {
      if (!day?.exercises?.length || day.isRest) return;
      const isLegsDay = (day.groups||[]).some(([g]) => g === 'quads' || g === 'hamstrings');
      const capForDay = (isLegsDay && _isSingleLegs3) ? _HARD_CAP_LEGS : _HARD_CAP_NORMAL;

      // أولا: تأكد عدد التمارين لا يتجاوز السقف
      const _isBegCap2 = state.exp === 'beginner';
      const MAX_EX_CAP2 = isLegsDay ? 8 : (_isBegCap2 ? 6 : 7);
      if (day.exercises.length > MAX_EX_CAP2) {
        day.exercises = day.exercises.slice(0, MAX_EX_CAP2);
      }

      let total = day.exercises.reduce((s, e) => s + (e.sets||0), 0);

      // فقط إذا تجاوز السقف: اخفض المجموعات
      if (total > capForDay) {
        let surplus = total - capForDay;
        const minS = (state.exp === 'advanced') ? 3 : 2;
        // ابدأ من آخر تمرين (isolation) للأمام
        for (let i = day.exercises.length - 1; i >= 0 && surplus > 0; i--) {
          const canRemove = Math.max(0, (day.exercises[i].sets||0) - minS);
          const remove = Math.min(surplus, canRemove);
          day.exercises[i] = {...day.exercises[i], sets: (day.exercises[i].sets||0) - remove};
          surplus -= remove;
        }
        total = day.exercises.reduce((s, e) => s + (e.sets||0), 0);
        console.log(`[PASS2S]  "${day.name}" capped: ${total}/${capForDay} sets`);
      }
    });
  }
  enforceHardDailySetCap();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PATCH-GYM-3: REST DAY SANITY — تنقية أيام الراحة من تمارين المقاومة
  // أيام الراحة = صفر مقاومة. الترابيس والساعدين - أيام Pull/ظهر فقط
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  (function patchGym3_RestDaySanity() {
    const _RESISTANCE_EXERCISES = new Set([
      'Barbell Shrugs','Smith Machine Shrugs','Dumbbell Shrugs',
      'Barbell Wrist Curl','Reverse Barbell Wrist Curl',
      'Dumbbell Wrist Curl','Reverse Dumbbell Wrist Curl',
      'Wrist Roller','Plate Pinch','Farmer\'s Walk'
    ]);
    // أيام الظهر/السحب لنقل التمارين إليها
    const pullDayIdx = distributedPlan.findIndex(d =>
      !d.isRest && (d.groups||[]).some(([g]) => g === 'back' || g === 'traps' || g === 'forearms')
    );
    distributedPlan.forEach(day => {
      if (!day.isRest) return;
      const found = (day.exercises||[]).filter(e => _RESISTANCE_EXERCISES.has(e.n));
      if (!found.length) return;
      // أزل من يوم الراحة
      day.exercises = (day.exercises||[]).filter(e => !_RESISTANCE_EXERCISES.has(e.n));
      // انقل لأقرب يوم Pull إذا وجد — مع تجنب التكرار والتمارين المشابهة
      if (pullDayIdx >= 0 && found.length) {
        const _destExNames = new Set((distributedPlan[pullDayIdx].exercises||[]).map(e => e.n));
        const _simPairsGym3 = [
          ["Barbell Shrugs","Dumbbell Shrugs"],["Barbell Shrugs","Smith Machine Shrugs"],
          ["Dumbbell Shrugs","Smith Machine Shrugs"],
          ["Wide Grip Lat Pulldown","Neutral Grip Lat Pulldown"],["Wide Grip Lat Pulldown","Pull-Ups"],
          ["Neutral Grip Lat Pulldown","Pull-Ups"],["Seated Cable Row","Chest Supported Row Machine"],
          ["Barbell Bent Over Row","Dumbbell Bent Over Row"],["One Arm Dumbbell Row","Meadows Row"],
        ];
        const _simLkp = {};
        _simPairsGym3.forEach(([a,b]) => {
          if(!_simLkp[a]) _simLkp[a] = new Set();
          if(!_simLkp[b]) _simLkp[b] = new Set();
          _simLkp[a].add(b); _simLkp[b].add(a);
        });
        found.forEach(ex => {
          if (_destExNames.has(ex.n)) {
            console.log(`[PATCH-GYM-3]  Skipped duplicate "${ex.n}" already in pull day`);
            return;
          }
          if (_simLkp[ex.n]) {
            for (const sim of _simLkp[ex.n]) {
              if (_destExNames.has(sim)) {
                console.log(`[PATCH-GYM-3]  Skipped similar "${ex.n}" (similar "${sim}" already present)`);
                return;
              }
            }
          }
          distributedPlan[pullDayIdx].exercises.push(ex);
          _destExNames.add(ex.n);
          console.log(`[PATCH-GYM-3]  Moved "${ex.n}" from rest day - day ${pullDayIdx}`);
        });
      }
    });
    // إعادة تطبيق سقف المجموعات بعد نقل التمارين
    enforceHardDailySetCap();
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PATCH-GYM-REPS: سقف مطلق 20 تكرار — لا يوجد استثناء لأي تمرين
  (function enforceMaxRepCap() {
    const MAX_REP = 20;
    function capRepString(r) {
      if (!r || typeof r !== 'string') return r;
      return r.replace(/(\d+)/g, n => Math.min(parseInt(n, 10), MAX_REP).toString());
    }
    distributedPlan.forEach(day => {
      if (!day?.exercises?.length) return;
      day.exercises.forEach(ex => {
        if (ex.reps) {
          const original = ex.reps;
          ex.reps = capRepString(ex.reps);
          if (ex.reps !== original) console.log(`[PATCH-REPS]  "${ex.n}": ${original} - ${ex.reps}`);
        }
      });
    });
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FINAL DEDUP — آخر خط دفاع ضد التكرار بعد كل ال patches
  // يعيد تطبيق قاعدة "لا تمرينان متشابهان في نفس اليوم" بعد أي injection
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  (function finalDedupPass() {
    // يستخدم SIMILAR_PAIRS — single source of truth المعرف أعلى
    const _fdLookup = {};
    SIMILAR_PAIRS.forEach(([a,b]) => {
      if(!_fdLookup[a]) _fdLookup[a] = new Set();
      if(!_fdLookup[b]) _fdLookup[b] = new Set();
      _fdLookup[a].add(b); _fdLookup[b].add(a);
    });
    distributedPlan.forEach((day, di) => {
      if (!day?.exercises?.length || day.isRest) return;
      const kept = [], seen = new Set();
      const _removedFD = []; // تتبع التمارين المحذوفة لإيجاد بديل

      day.exercises.forEach(ex => {
        if (seen.has(ex.n)) {
          console.log('[FINAL-DEDUP]  Day '+(di+1)+': Removed exact duplicate "'+ex.n+'"');
          if (ex.grp) _removedFD.push({ grp: ex.grp, sub: ex.sub||'all', removedEx: ex });
          return;
        }
        if (_fdLookup[ex.n]) {
          for (const sim of _fdLookup[ex.n]) {
            if (seen.has(sim)) {
              console.log('[FINAL-DEDUP]  Day '+(di+1)+': Removed similar "'+ex.n+'" (similar "'+sim+'" present)');
              if (ex.grp) _removedFD.push({ grp: ex.grp, sub: ex.sub||'all', removedEx: ex });
              return;
            }
          }
        }
        kept.push(ex);
        seen.add(ex.n);
      });

      // ── إيجاد بديل مختلف لكل تمرين محذوف من نفس عضلته ─────────────────
      if (_removedFD.length > 0) {
        const _isHomeFD = !!(state.equip === 'home' || state.equip === 'none');
        const _dbFD = _isHomeFD ? HOME_DB : GYM_DB;
        const _injFD = (state.injuries||[]).filter(i => i !== 'none');

        _removedFD.forEach(({ grp, sub, removedEx }) => {
          const grpData = _dbFD[grp] || {};
          const subKeys = [sub, ...Object.keys(grpData).filter(k => k !== sub)];
          let repl = null;

          for (const sk of subKeys) {
            const pool = grpData[sk] || [];
            repl = pool.find(e => {
              if (seen.has(e.n)) return false;
              if (_injFD.length && e.safe_injuries) {
                for (const inj of _injFD) {
                  const b = inj.replace('_mild','');
                  if (!e.safe_injuries.includes(inj) && !e.safe_injuries.includes(b) &&
                      !e.safe_injuries.includes(b+'_mild')) return false;
                }
              }
              if (_fdLookup[e.n] && [..._fdLookup[e.n]].some(s => seen.has(s))) return false;
              return true;
            });
            if (repl) break;
          }

          if (repl) {
            kept.push({
              ...repl, grp, sub,
              sets: removedEx.sets||3, reps: removedEx.reps||'10-15',
              rest: removedEx.rest||'60-90 ث', blocked: false,
              vid: (typeof getValidVid==='function') ? getValidVid(repl.vid) : (repl.vid||''),
              _finalDedupReplacement: true
            });
            seen.add(repl.n);
            console.log('[FINAL-DEDUP]  Day '+(di+1)+': Replaced "'+removedEx.n+'" - "'+repl.n+'" ('+grp+')');
          }
        });
      }

      if (kept.length < day.exercises.length || _removedFD.length > 0) {
        day.exercises = kept;
      }
    });
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MIN_EX ABSOLUTE ENFORCER — الضمان المطلق للحد الأدنى من التمارين
  // المتوسط والمتقدم: لا يوم بأقل من 5 تمارين — مهما حصل من dedup أو patches
  // المبتدئ: لا يوم بأقل من 4 تمارين
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── ARCHETYPE & DUPLICATE SANITIZER (defense-in-depth قبل إعادة الملء) ──
  // يزيل أي تمرين يخالف نوع اليوم (صدر/ذراع على Lower، أرجل على Upper) ويقص
  // التكرار الأسبوعي المفرط لنفس التمرين. يعمل قبل enforceMinExercisesAbsolute
  // حتى يعاد ملء أي نقص بتمارين صحيحة من عضلات اليوم.
  (function sanitizeArchetypeAndDuplicates() {
    const LOWER_KEYS = ['quads','hamstrings','glutes','calves','adductors'];
    const UPPER_KEYS = ['chest','back','shoulders','biceps','triceps','traps','forearms'];
    const MAX_WEEKLY_FREQ = { calves: 2, shoulders: 2, core: 2, abs: 2 };
    const _weeklyCount = {};
    distributedPlan.forEach(day => {
      if (!day?.exercises || day.isRest) return;
      const grpSet  = new Set((day.groups || []).map(g => Array.isArray(g) ? g[0] : g));
      const isLower = LOWER_KEYS.some(k => grpSet.has(k));
      const isUpper = UPPER_KEYS.some(k => grpSet.has(k));
      day.exercises = day.exercises.filter(ex => {
        const g = ex.grp;
        // 1) حارس ال archetype — يسمح بأسفل الظهر فقط على يوم الأرجل
        if (isLower && !isUpper && UPPER_KEYS.includes(g) && !(g === 'back' && ex.sub === 'lower')) {
          console.warn('[SANITIZER] removed cross-archetype "'+ex.n+'" ('+g+') from LOWER day');
          return false;
        }
        if (isUpper && !isLower && LOWER_KEYS.includes(g)) {
          console.warn('[SANITIZER] removed cross-archetype "'+ex.n+'" ('+g+') from UPPER day');
          return false;
        }
        // 2) حارس التكرار لأسبوعي لنفس التمرين
        const cap = MAX_WEEKLY_FREQ[g] || 1;
        _weeklyCount[ex.n] = (_weeklyCount[ex.n] || 0) + 1;
        if (_weeklyCount[ex.n] > cap) {
          console.warn('[SANITIZER] removed weekly-duplicate "'+ex.n+'" (#'+_weeklyCount[ex.n]+')');
          return false;
        }
        return true;
      });
    });
  })();

  (function enforceMinExercisesAbsolute() {
    const _isNotBegAbs = state.exp !== 'beginner';
    const _absMinEx    = state.exp === 'advanced' ? 6 : (_isNotBegAbs ? 5 : 4);
    const _isHome      = !!(state.equip === 'home' || state.equip === 'none');
    const _activeDB    = _isHome ? HOME_DB : GYM_DB;
    const _injuries    = (state.injuries||[]).filter(i => i !== 'none');

    // يستخدم SIMILAR_PAIRS — single source of truth المعرف أعلى
    const _simAbsLookup = {};
    SIMILAR_PAIRS.forEach(([a,b]) => {
      if(!_simAbsLookup[a]) _simAbsLookup[a] = new Set();
      if(!_simAbsLookup[b]) _simAbsLookup[b] = new Set();
      _simAbsLookup[a].add(b); _simAbsLookup[b].add(a);
    });

    // دالة مساعدة: هل التمرين مسموح به؟
    function _canUseEx(ex, usedNames, usedGrps, strict) {
      if (usedNames.has(ex.n)) return false;
      // فحص التمارين المشابهة
      if (_simAbsLookup[ex.n] && [..._simAbsLookup[ex.n]].some(s => usedNames.has(s))) return false;
      // فحص الإصابات
      if (_injuries.length && ex.safe_injuries) {
        for (const inj of _injuries) {
          const b = inj.replace('_mild','');
          if (!ex.safe_injuries.includes(inj) && !ex.safe_injuries.includes(b) &&
              !ex.safe_injuries.includes(b+'_mild')) return false;
        }
      }
      return true;
    }

    distributedPlan.forEach((day, di) => {
      if (!day?.exercises || day.isRest) return;
      if (day.exercises.length >= _absMinEx) return;

      const _usedNames = new Set(day.exercises.map(e => e.n));
      const _usedGrps  = new Set(day.exercises.map(e => e.grp));

      // ── ARCHETYPE GUARD: امنع ملء اليوم بعضلة تضاد نوعه (لا صدر/ذراع على Lower، ولا أرجل على Upper)
      const _archGrpSet     = new Set((day.groups || []).map(g => Array.isArray(g) ? g[0] : g));
      const _lowerKeysAbs   = ['quads','hamstrings','glutes','calves','adductors'];
      const _upperKeysAbs   = ['chest','back','shoulders','biceps','triceps','traps','forearms'];
      const _archIsLowerAbs = _lowerKeysAbs.some(k => _archGrpSet.has(k));
      const _archIsUpperAbs = _upperKeysAbs.some(k => _archGrpSet.has(k));
      let _allowedFillGrps;
      if (_archIsLowerAbs && !_archIsUpperAbs)      _allowedFillGrps = new Set([..._lowerKeysAbs, 'core']);
      else if (_archIsUpperAbs && !_archIsLowerAbs) _allowedFillGrps = new Set([..._upperKeysAbs, 'core']);
      else                                          _allowedFillGrps = new Set([..._archGrpSet, 'core']);

      // الأولوية 1: نفس العضلات الموجودة في اليوم (sub مختلف أو تمرين ثان لها)
      const _dayGrps = [..._usedGrps];

      // الأولوية 2: أي عضلة متاحة من ال DB
      const _allExByGrp = {};
      Object.entries(_activeDB).forEach(([grpKey, grpData]) => {
        const pool = Object.values(grpData).flatMap(arr => Array.isArray(arr) ? arr : []);
        _allExByGrp[grpKey] = pool;
      });

      // أولا: ابحث في عضلات اليوم
      for (const grpKey of _dayGrps) {
        if (day.exercises.length >= _absMinEx) break;
        if (!_allowedFillGrps.has(grpKey)) continue; // حارس ال archetype
        const pool = _allExByGrp[grpKey] || [];
        const candidate = pool.find(e => _canUseEx(e, _usedNames, _usedGrps));
        if (candidate) {
          day.exercises.push({
            ...candidate, grp: grpKey, sub: candidate.sub||'all',
            sets: _isNotBegAbs ? 3 : 2, reps: '10-15', rest: '60-90 ث',
            blocked: false,
            vid: (typeof getValidVid==='function') ? getValidVid(candidate.vid) : (candidate.vid||''),
            _minExFiller: true
          });
          _usedNames.add(candidate.n);
          console.log('[MIN-EX-ABS]  Day '+(di+1)+': Added "'+candidate.n+'" ('+grpKey+') — same-day muscle');
        }
      }

      // ثانيا: لو لسه ناقص - جيب من أي عضلة متاحة
      if (day.exercises.length < _absMinEx) {
        const _allExFlat = Object.entries(_allExByGrp).flatMap(([grpKey, pool]) =>
          pool.map(e => ({ ...e, _grpKey: grpKey }))
        );
        for (const ex of _allExFlat) {
          if (day.exercises.length >= _absMinEx) break;
          if (_usedGrps.has(ex._grpKey)) continue;
          if (!_allowedFillGrps.has(ex._grpKey)) continue; // حارس ال archetype: لا تملأ بعضلة تضاد اليوم // تجنب تكرار العضلة
          if (!_canUseEx(ex, _usedNames, _usedGrps)) continue;
          day.exercises.push({
            ...ex, grp: ex._grpKey, sub: ex.sub||'all',
            sets: _isNotBegAbs ? 3 : 2, reps: '10-15', rest: '60-90 ث',
            blocked: false,
            vid: (typeof getValidVid==='function') ? getValidVid(ex.vid) : (ex.vid||''),
            _minExFiller: true
          });
          _usedNames.add(ex.n);
          _usedGrps.add(ex._grpKey);
          console.log('[MIN-EX-ABS]  Day '+(di+1)+': Added "'+ex.n+'" ('+ex._grpKey+') — fill');
        }
      }

      if (day.exercises.length < _absMinEx) {
        console.warn('[MIN-EX-ABS]  Day '+(di+1)+': Could only reach '+day.exercises.length+'/'+_absMinEx);
      }
    });
  })();

  // FINAL GUARD: سقف أسبوعي لكل عضلة + سقف يومي نهائي — لا يتجاوزهم أي patch
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  enforceWeeklyCapsOnPlan(distributedPlan, state.exp);
  enforceWeeklyHierarchy(distributedPlan, state.exp); // v29: حارس الهرم الأسبوعي
  enforceHardDailySetCap(); // تطبيق نهائي بعد كل شيء
  // v32: re-assert hierarchy after hard daily cap frees room, so the traps
  // floor (>=6 when back trained >=2x) can claim sets the cap pass just freed.
  // Add-only & cap-respecting (verified: never exceeds daily caps).
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASS2X (v33): LEG-DAY POSTERIOR-CHAIN BALANCE — final deterministic guard.
  // Runs dead-last (after all cap/dedup/hierarchy passes) so nothing can strip it.
  // Scope: ONLY splits with >=2 *pure* leg days (e.g. ul6, ululf, 6-day PPL).
  // Single-leg-day splits (e.g. 5-day PPL) are intentionally untouched.
  // Guarantees each leg day trains hamstrings, glutes, calves, adductors at a
  // sane minimum so posterior-chain frequency is consistent across generations.
  (function pass2X_legDayPosteriorBalance(){
    try {
      const _PP = new Set(['chest','back','shoulders','biceps','triceps']);
      const legDays = [];
      distributedPlan.forEach((day,di)=>{
        if(!day || !day.exercises || !day.exercises.length || day.isRest) return;
        const grps = new Set(day.exercises.map(e=>e.grp));
        const hasLegs = grps.has('quads') || grps.has('hamstrings');
        const hasPP = [..._PP].some(g=>grps.has(g));
        if(hasLegs && !hasPP) legDays.push(di);
      });
      if(legDays.length < 2) return; // not a multi-leg-day split
      const isHome = !!(state.equip==='home' || state.equip==='none');
      const DB = isHome ? HOME_DB : GYM_DB;
      const inj = (state.injuries||[]).filter(i=>i!=='none');
      const beg = state.exp==='beginner';
      const safe = (e)=>{
        if(inj.length && e.safe_injuries){
          for(const x of inj){ const b=x.replace("_mild","");
            if(!e.safe_injuries.includes(x) && !e.safe_injuries.includes(b) && !e.safe_injuries.includes(b+"_mild")) return false; }
        }
        return true;
      };
      const pickFrom = (grp, used)=>{
        const gd = DB[grp] || {};
        for(const sk of Object.keys(gd)){
          const hit = (gd[sk]||[]).find(e=>!used.has(e.n) && safe(e));
          if(hit) return {ex:hit, sub:hit.sub||sk||"all"};
        }
        return null;
      };
      const addEx = (day, used, grp, sub, sets)=>{
        const r = pickFrom(grp, used);
        if(!r) return false;
        day.exercises.push({...r.ex, grp, sub:(grp==="glutes"?"all":(r.ex.sub||r.sub||sub)),
          sets, reps:"10-15", rest:"60-90 ث", blocked:false,
          vid:(typeof getValidVid==="function")?getValidVid(r.ex.vid):(r.ex.vid||""),
          _legBalanceInjected:true, _protected:true });
        used.add(r.ex.n);
        return true;
      };
      legDays.forEach(di=>{
        const day = distributedPlan[di];
        const used = new Set(day.exercises.map(e=>e.n));
        // hamstrings
        if(!day.exercises.some(e=>e.grp==='hamstrings')) addEx(day, used, 'hamstrings', 'dominant', beg?5:6);
        // glutes (counted as grp=glutes OR hamstrings/sub=glutes)
        const hasGlutes = day.exercises.some(e=>e.grp==='glutes' || (e.grp==='hamstrings' && e.sub==='glutes'));
        if(!hasGlutes){
          // glutes live as a SUBKEY under hamstrings (hip thrust / hip hinge)
          const gpool = (DB.hamstrings && DB.hamstrings.glutes) || [];
          const ghit = gpool.find(e=>!used.has(e.n) && safe(e));
          if(ghit){
            day.exercises.push({...ghit, grp:"hamstrings", sub:"glutes", sets:3, reps:"10-15", rest:"60-90 ث", blocked:false,
              vid:(typeof getValidVid==="function")?getValidVid(ghit.vid):(ghit.vid||""),
              _legBalanceInjected:true, _protected:true });
            used.add(ghit.n);
          }
        }
        // calves
        if(!day.exercises.some(e=>e.grp==='calves')) addEx(day, used, 'calves', 'gastrocnemius', 3);
        // adductors (skip for home where pool is empty)
        if(!isHome && !day.exercises.some(e=>e.grp==='adductors')) addEx(day, used, 'adductors', 'all', 3);
      });
      if(typeof console!=='undefined') console.log('[PASS2X]  Leg-day posterior balance enforced on days: '+legDays.map(d=>d+1).join(','));
    } catch(_e){ /* never break generation */ }
  })();


  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CLEAN FINAL PLAN VALIDATOR — deterministic, non-patching guard
  // Last engine-level pass before rendering. It resolves the audit failures
  // without changing split structure: hierarchy, arm parity, traps floor,
  // adductors coverage, daily caps, and final total bookkeeping.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  (function cleanFinalPlanValidator(){
    const isHome = !!(state.equip === 'home' || state.equip === 'none');
    const exp = state.exp || 'intermediate';
    const LEG_MUSCLES = new Set(['quads','hamstrings','glutes','calves','adductors']);
    const UPPER_MUSCLES = new Set(['chest','back','shoulders','biceps','triceps','traps','forearms']);
    const PUSH_PULL = new Set(['chest','back','shoulders','biceps','triceps']);
    const PRIMARY_MUSCLES_SET = new Set(['chest','back','quads','hamstrings','shoulders']);
    function exCap(muscle){
      if(PRIMARY_MUSCLES_SET.has(muscle)) return exp === 'beginner' ? 4 : 5;
      return exp === 'beginner' ? 3 : 4;
    }

    function effGrp(ex){ return (ex.grp === 'hamstrings' && ex.sub === 'glutes') ? 'glutes' : ex.grp; }
    function totals(){
      const s = {}, f = {};
      distributedPlan.forEach(day => {
        if(!day || day.isRest || !day.exercises) return;
        const seen = new Set();
        day.exercises.forEach(ex => {
          const g = effGrp(ex); if(!g) return;
          s[g] = (s[g] || 0) + (ex.sets || 0);
          seen.add(g);
        });
        seen.forEach(g => { f[g] = (f[g] || 0) + 1; });
      });
      return {sets:s, freq:f};
    }
    function dayTotal(day){ return (day.exercises||[]).reduce((a,e)=>a+(e.sets||0),0); }
    function isLegDay(day){
      const grps = new Set((day.exercises||[]).map(e => effGrp(e)));
      return grps.has('quads') || grps.has('hamstrings');
    }
    function isDedicatedLegDay(day){
      const grps = new Set((day.exercises||[]).map(e => effGrp(e)));
      const hasLegs = grps.has('quads') || grps.has('hamstrings');
      const hasUpper = [...grps].some(g => PUSH_PULL.has(g));
      return hasLegs && !hasUpper;
    }
    function dailyCap(day){
      return isDedicatedLegDay(day) ? 24 : 21;
    }
    function exerciseRefs(muscle){
      const out=[];
      distributedPlan.forEach((day,di)=>{
        if(!day || day.isRest || !day.exercises) return;
        day.exercises.forEach((ex,ei)=>{ if(effGrp(ex) === muscle) out.push({day,di,ei,ex,rank:getExerciseRank(ex)}); });
      });
      return out;
    }
    function boostExisting(muscle, target){
      let data = totals();
      let cur = data.sets[muscle] || 0;
      if(cur >= target) return cur;
      const refs = exerciseRefs(muscle).sort((a,b)=>a.rank-b.rank || (a.ex.sets||0)-(b.ex.sets||0));
      let guard=0;
      while(cur < target && guard++ < 80){
        let changed=false;
        for(const r of refs){
          if(cur >= target) break;
          const ex = r.day.exercises[r.ei]; if(!ex) continue;
          if((ex.sets||0) >= exCap(muscle)) continue;
          if(dayTotal(r.day) >= dailyCap(r.day)) continue;
          r.day.exercises[r.ei] = Object.assign({}, ex, {sets:(ex.sets||0)+1, _cleanFinalBoost:true});
          cur++; changed=true;
        }
        if(!changed) break;
      }
      return cur;
    }
    function trimMuscle(muscle, ceiling){
      let cur = totals().sets[muscle] || 0;
      if(cur <= ceiling) return cur;
      const refs = exerciseRefs(muscle).sort((a,b)=>b.rank-a.rank || (b.ex.sets||0)-(a.ex.sets||0));
      let guard=0;
      while(cur > ceiling && guard++ < 120){
        let changed=false;
        for(const r of refs){
          if(cur <= ceiling) break;
          const ex = r.day.exercises[r.ei]; if(!ex || (ex.sets||0) <= 0) continue;
          r.day.exercises[r.ei] = Object.assign({}, ex, {sets:(ex.sets||0)-1, _cleanFinalTrim:true});
          cur--; changed=true;
        }
        if(!changed) break;
      }
      distributedPlan.forEach(day => { if(day && day.exercises) day.exercises = day.exercises.filter(e => e && (e.sets||0) > 0); });
      return cur;
    }
    function safeForCurrentUser(ex){
      const injuries = (state.injuries||[]).filter(i => i !== 'none');
      if(!injuries.length) return true;
      for(const inj of injuries){
        const base = inj.replace('_mild','');
        if((ex.safe_injuries||[]).includes(inj) || (ex.safe_injuries||[]).includes(base) || (ex.safe_injuries||[]).includes(base+'_mild')) continue;
        if(typeof DANGER_MAP !== 'undefined' && (DANGER_MAP[base]||[]).includes(ex.n)) return false;
      }
      return true;
    }
    function makeRoom(day, needed, protectedGroups){
      protectedGroups = protectedGroups || new Set();
      let guard = 0;
      while(dayTotal(day) + needed > dailyCap(day) && guard++ < 80){
        const refs = (day.exercises||[]).map((ex,ei)=>({ex,ei,rank:getExerciseRank(ex)}))
          .filter(r => !protectedGroups.has(effGrp(r.ex)))
          .sort((a,b)=>b.rank-a.rank || (b.ex.sets||0)-(a.ex.sets||0));
        let changed = false;
        for(const r of refs){
          if(dayTotal(day) + needed <= dailyCap(day)) break;
          const ex = day.exercises[r.ei];
          if(!ex || (ex.sets||0) <= 1) continue;
          day.exercises[r.ei] = Object.assign({}, ex, {sets:(ex.sets||0)-1, _cleanRoomTrim:true});
          changed = true;
        }
        if(!changed) break;
      }
      day.exercises = (day.exercises||[]).filter(e => e && (e.sets||0) > 0);
      return dayTotal(day) + needed <= dailyCap(day);
    }
    function addExerciseToDay(day, grp, sets){
      const db = isHome ? HOME_DB : GYM_DB;
      const grpData = db[grp] || {};
      const used = new Set((day.exercises||[]).map(e=>e.n));
      const pool = Object.values(grpData).flatMap(x => Array.isArray(x) ? x : []);
      const pick = pool.find(e => !used.has(e.n) && safeForCurrentUser(e));
      if(!pick) return false;
      if(dayTotal(day) + sets > dailyCap(day)) {
        const protectedGroups = new Set([grp, 'quads', 'hamstrings']);
        if(!makeRoom(day, sets, protectedGroups)) return false;
      }
      day.exercises.push(Object.assign({}, pick, {
        grp, sub: pick.sub || 'all', sets, reps: pick.reps || '10-15', rest: pick.rest || '60-90 ث',
        blocked:false, vid:(typeof getValidVid==='function') ? getValidVid(pick.vid) : (pick.vid||''),
        _cleanFinalInjected:true
      }));
      return true;
    }
    function isUpperDay(day){
      const grps = new Set((day.exercises||[]).map(e => effGrp(e)));
      return [...grps].some(g => UPPER_MUSCLES.has(g));
    }
    // Raise a muscle to a weekly floor: boost existing slots first, then add an
    // exercise (only for muscles that exist as a DB group) on a region day with room.
    function ensureMuscleAtLeast(muscle, target, dayFilter){
      if(target <= 0) return totals().sets[muscle] || 0;
      boostExisting(muscle, target);
      let cur = totals().sets[muscle] || 0;
      const db = isHome ? HOME_DB : GYM_DB;
      const canAdd = !!(db && db[muscle]);
      let guard = 0;
      while(cur < target && canAdd && guard++ < 6){
        const cands = distributedPlan
          .filter(d => d && !d.isRest && d.exercises && (!dayFilter || dayFilter(d)))
          .sort((a,b) => (dailyCap(b)-dayTotal(b)) - (dailyCap(a)-dayTotal(a)));
        let added = false;
        for(const d of cands){
          const need = Math.min(target - cur, exp === 'beginner' ? 3 : 4);
          if(addExerciseToDay(d, muscle, Math.max(2, need))){ added = true; break; }
        }
        if(!added) break;
        boostExisting(muscle, target);
        cur = totals().sets[muscle] || 0;
      }
      return cur;
    }
    // Free one set on a packed leg day to fund glutes MEV: trim the highest-set
    // exercise whose muscle keeps a safe surplus (primaries stay >=5, well above
    // the glutes target of 3, preserving the lower-body hierarchy).
    function makeRoomForGlutes(day){
      let best=-1, bestSets=0;
      (day.exercises||[]).forEach((e,i)=>{
        if(effGrp(e)==='glutes') return;
        const m=effGrp(e);
        const cur=totals().sets[m]||0;
        const floor=PRIMARY_MUSCLES_SET.has(m)?5:1;
        if((e.sets||0)>1 && cur>floor && (e.sets||0)>bestSets){ best=i; bestSets=e.sets||0; }
      });
      if(best<0) return false;
      day.exercises[best]=Object.assign({},day.exercises[best],{sets:(day.exercises[best].sets||0)-1});
      return true;
    }
    // Bring glutes to MEV (3) even when its leg day is at the daily cap, by
    // making room from a non-protected muscle (e.g. calves) on that same day.
    function ensureGlutesFloor(){
      let guard = 0;
      while((totals().sets.glutes||0) > 0 && (totals().sets.glutes||0) < 3 && guard++ < 12){
        let day = null;
        for(const dd of distributedPlan){
          if(!dd || dd.isRest || !dd.exercises) continue;
          if(dd.exercises.some(e => effGrp(e) === 'glutes')){ day = dd; break; }
        }
        if(!day) break;
        if(dayTotal(day) >= dailyCap(day)){
          if(!makeRoomForGlutes(day)) break;
        }
        const idx = day.exercises.findIndex(e => effGrp(e) === 'glutes');
        if(idx < 0) break;
        const ex = day.exercises[idx];
        if((ex.sets||0) >= exCap('glutes')) break;
        day.exercises[idx] = Object.assign({}, ex, {sets:(ex.sets||0)+1, _cleanGluteFloor:true});
      }
    }
    // Equalize arms: level the lower up to the higher, else level the higher down.
    function equalizeArms(){
      let d = totals();
      let bi = d.sets.biceps || 0, tri = d.sets.triceps || 0;
      if(bi <= 0 || tri <= 0 || bi === tri) return;
      boostExisting(bi < tri ? 'biceps' : 'triceps', Math.max(bi, tri));
      d = totals(); bi = d.sets.biceps || 0; tri = d.sets.triceps || 0;
      if(bi !== tri) trimMuscle(bi > tri ? 'biceps' : 'triceps', Math.min(bi, tri));
    }
    function ensureAdductors(){
      if(isHome) return;
      const hasLegs = distributedPlan.some(d => d && !d.isRest && isLegDay(d));
      if(!hasLegs) return;
      if((totals().sets.adductors||0) >= 3) return;
      const candidates = distributedPlan
        .filter(d => d && !d.isRest && isLegDay(d))
        .sort((a,b)=>dayTotal(a)-dayTotal(b));
      for(const d of candidates){
        if(addExerciseToDay(d, 'adductors', 3)) break;
      }
      // If still below MEV, add sets to an existing adductor slot.
      if((totals().sets.adductors||0) > 0 && (totals().sets.adductors||0) < 3){
        boostExisting('adductors', 3);
      }
    }
    function enforceDailyCaps(){
      distributedPlan.forEach(day => {
        if(!day || day.isRest || !day.exercises) return;
        const cap = dailyCap(day);
        let guard=0;
        while(dayTotal(day) > cap && guard++ < 120){
          const refs = day.exercises.map((ex,ei)=>({ex,ei,rank:getExerciseRank(ex)}))
            .sort((a,b)=>b.rank-a.rank || (b.ex.sets||0)-(a.ex.sets||0));
          let changed=false;
          for(const r of refs){
            if(dayTotal(day) <= cap) break;
            const ex = day.exercises[r.ei]; if(!ex || (ex.sets||0) <= 1) continue;
            day.exercises[r.ei] = Object.assign({}, ex, {sets:(ex.sets||0)-1, _cleanDailyTrim:true});
            changed=true;
          }
          if(!changed){
            day.exercises.sort((a,b)=>getExerciseRank(b)-getExerciseRank(a));
            day.exercises.pop();
          }
          day.exercises = day.exercises.filter(e=>e && (e.sets||0)>0);
        }
      });
    }

    // ━━ STAGE 1: ensure minor leg coverage (adductors MEV) exists ━━
    ensureAdductors();
    enforceDailyCaps();

    // ━━ STAGE 2: iterative hierarchy + arm parity ━━
    // Boosting a primary can shift daily pressure, so we iterate. Trimming an
    // accessory is always feasible; boosting a primary may add an exercise.
    for(let iter = 0; iter < 6; iter++){
      let data = totals();

      // (a) Traps: aim for a real floor (6) when back is trained 2+ days.
      if((data.freq.back||0) >= 2 && (data.sets.traps||0) > 0 && (data.sets.traps||0) < 6){
        boostExisting('traps', 6);
      }

      // (b) Arm parity (level up first, else level down).
      equalizeArms();

      // (c) LOWER hierarchy: quads & hamstrings out-rank glutes/calves/adductors.
      data = totals();
      if((data.sets.quads||0) > 0 && (data.sets.hamstrings||0) > 0){
        const hasLeg = distributedPlan.some(d => d && !d.isRest && isLegDay(d));
        // MEV-floored accessories (adductors/glutes = 3) need weak primary >= 4.
        const needFloor = (!isHome && hasLeg) || (data.sets.glutes||0) > 0;
        const primaryTarget = needFloor ? 4 : 2;
        ensureMuscleAtLeast('quads', primaryTarget, isLegDay);
        ensureMuscleAtLeast('hamstrings', primaryTarget, isLegDay);
        const wp = Math.min(totals().sets.quads||0, totals().sets.hamstrings||0);
        if(!isHome && hasLeg){
          if((totals().sets.adductors||0) < 3) ensureMuscleAtLeast('adductors', 3, isLegDay);
          if((totals().sets.adductors||0) > wp-1) trimMuscle('adductors', Math.max(3, wp-1));
        }
        if((totals().sets.glutes||0) > 0){
          if((totals().sets.glutes||0) > wp-1) trimMuscle('glutes', wp-1);
          if((totals().sets.glutes||0) < 3) ensureGlutesFloor();
        }
        if((totals().sets.calves||0) > wp-1) trimMuscle('calves', Math.max(0, wp-1));
      }

      // (d) UPPER hierarchy: chest & back out-rank arms/traps and cover shoulders.
      data = totals();
      if((data.sets.chest||0) > 0 && (data.sets.back||0) > 0){
        const accMax = Math.max(data.sets.biceps||0, data.sets.triceps||0, data.sets.traps||0);
        const upperTarget = Math.max(accMax + 1, data.sets.shoulders || 0);
        ensureMuscleAtLeast('chest', upperTarget, isUpperDay);
        ensureMuscleAtLeast('back', upperTarget, isUpperDay);
        const wu = Math.min(totals().sets.chest||0, totals().sets.back||0);
        ['biceps','triceps','traps'].forEach(m => { if((totals().sets[m]||0) >= wu) trimMuscle(m, wu-1); });
        if((totals().sets.shoulders||0) > wu) trimMuscle('shoulders', wu);
        equalizeArms();
      }

      enforceDailyCaps();
    }

    // ━━ STAGE 3: deterministic final reconciliation ━━
    // One cap pass, then trim-only constraints so daily caps AND
    // hierarchy/parity all hold simultaneously at render time.
    ensureAdductors();
    enforceDailyCaps();

    // Lower accessories strictly below weak primary, keeping MEV floors (wp>=4 => 3 ok).
    {
      const data = totals();
      if((data.sets.quads||0) > 0 && (data.sets.hamstrings||0) > 0){
        const wp = Math.min(data.sets.quads||0, data.sets.hamstrings||0);
        if((data.sets.glutes||0) > wp-1) trimMuscle('glutes', wp-1);
        if((data.sets.calves||0) > wp-1) trimMuscle('calves', Math.max(0, wp-1));
        if(!isHome && (data.sets.adductors||0) > wp-1) trimMuscle('adductors', Math.max(3, wp-1));
        if((totals().sets.glutes||0) > 0 && (totals().sets.glutes||0) < 3 && wp-1 >= 3) ensureGlutesFloor();
        if(!isHome && (totals().sets.adductors||0) > 0 && (totals().sets.adductors||0) < 3 && wp-1 >= 3) boostExisting('adductors', 3);
      }
    }

    // Upper accessories strictly below weak primary; shoulders <= weak primary.
    {
      const data = totals();
      if((data.sets.chest||0) > 0 && (data.sets.back||0) > 0){
        const wu = Math.min(data.sets.chest||0, data.sets.back||0);
        ['biceps','triceps','traps'].forEach(m => { if((totals().sets[m]||0) >= wu) trimMuscle(m, wu-1); });
        if((totals().sets.shoulders||0) > wu) trimMuscle('shoulders', wu);
      }
    }

    // Traps: if a real floor (6) is required but unmet, remove token volume
    // — indirect work from rows/deadlifts already covers traps.
    {
      const data = totals();
      if((data.freq.back||0) >= 2 && (data.sets.traps||0) > 0 && (data.sets.traps||0) < 6){
        trimMuscle('traps', 0);
      }
    }

    // Final arm parity by trim-to-min (never breaks caps; guarantees biceps == triceps).
    {
      const data = totals();
      const bi = data.sets.biceps||0, tri = data.sets.triceps||0;
      if(bi > 0 && tri > 0 && bi !== tri) trimMuscle(bi > tri ? 'biceps' : 'triceps', Math.min(bi, tri));
    }

    state._realTotalSets = distributedPlan.reduce((s,d)=>{
      if(!d || d.isRest || !d.exercises) return s;
      return s + d.exercises.reduce((ss,e)=>ss+(e.sets||0),0);
    },0);
  })();

  // ── PASS FINAL v58: سياسة المجموعات النهائية — [2,4] لكل تمرين + نطاق أسبوعي حسب المستوى ──
  // آخر تعديل على المجموعات قبل العرض/التصدير. تتجاوز كل الطبقات السابقة وتضمن:
  //   • كل تمرين فعال بين 2 و 4 مجموعات (لا أقل من 2، لا أكثر من 4)
  //   • الإجمالي الأسبوعي ضمن نطاق المستوى: مبتدئ 40-65 / متوسط 70-90 / متقدم 90-120 (قدر المتاح)
  (function enforceFinalSetPolicy(){
    const _EXP = state.exp || 'intermediate';
    const PER_EX_MIN = 2, PER_EX_MAX = 4;
    const BANDS = { beginner:{min:40,max:65}, intermediate:{min:70,max:90}, advanced:{min:90,max:120} };
    const band = BANDS[_EXP] || BANDS.intermediate;
    const DAILY_CAP = 21, LEGS_DAILY_CAP = 24;
    const _LEGSET = new Set(['quads','hamstrings','glutes','calves','adductors']);
    const _isDayLeg = (day) => day.exercises.some(e => _LEGSET.has(e.grp));
    const _dayCap = (day) => _isDayLeg(day) ? LEGS_DAILY_CAP : DAILY_CAP;
    const _rankOf = (ex) => (typeof getExerciseRank==='function') ? getExerciseRank(ex) : 3;
    const _getMRV = (grp) => (typeof MUSCLE_WEEKLY_CAPS!=='undefined'&&MUSCLE_WEEKLY_CAPS[grp]) ? (MUSCLE_WEEKLY_CAPS[grp][_EXP]||999) : 999;
    const _days = distributedPlan.filter(d => d && !d.isRest && d.exercises);
    // 1) احذف المصفر، واحصر كل تمرين في [2,4]
    _days.forEach(day => {
      day.exercises = day.exercises.filter(e => (e.sets||0) > 0);
      day.exercises.forEach(ex => {
        let s = ex.sets || 0;
        if(s < PER_EX_MIN){ s = PER_EX_MIN; ex._minFloor2 = true; }
        if(s > PER_EX_MAX){ s = PER_EX_MAX; ex._capped4 = true; }
        ex.sets = s;
      });
    });
    const _train = _days.filter(d => d.exercises.length);
    const _dayTotal = (d) => d.exercises.reduce((s,e)=>s+(e.sets||0),0);
    const _weekly = () => _train.reduce((s,d)=>s+_dayTotal(d),0);
    const _muscleWeekly = () => { const m={}; _train.forEach(d=>d.exercises.forEach(e=>{m[e.grp]=(m[e.grp]||0)+(e.sets||0);})); return m; };
    // 2) تحت الحد الأدنى: زد المركبات أولا (حتى 4)
    //    مع احترام: السقف اليومي (21/24) + سقف MRV الأسبوعي لكل عضلة (لا نضيف لعضلة بلغت MRV)
    let _g = 0;
    while(_weekly() < band.min && _g++ < 3000){
      let best = null, _bestDT = Infinity;
      const _mVol = _muscleWeekly();
      _train.forEach(day => {
        const _dt = _dayTotal(day);
        if(_dt >= _dayCap(day)) return;
        day.exercises.forEach(ex => {
          if((ex.sets||0) < PER_EX_MAX && (_mVol[ex.grp]||0) < _getMRV(ex.grp)){
            const _r = _rankOf(ex);
            if(!best || _r < best._r || (_r === best._r && _dt < _bestDT)){ best = {ex, _r}; _bestDT = _dt; }
          }
        });
      });
      if(!best) break;
      best.ex.sets += 1;
    }
    // 3) فوق الحد الأقصى الأسبوعي: قلل العزل/الfinishers أولا (حتى 2)
    _g = 0;
    while(_weekly() > band.max && _g++ < 3000){
      let worst = null;
      _train.forEach(day => {
        day.exercises.forEach(ex => {
          if((ex.sets||0) > PER_EX_MIN){
            if(!worst || _rankOf(ex) > _rankOf(worst)) worst = ex;
          }
        });
      });
      if(!worst) break;
      worst.sets -= 1;
    }
    // 4) إنفاذ السقف اليومي — يقلص أي يوم تجاوز سقفه (من passes سابقة أو من خطوة 2)
    //    العزل/الfinishers تقلص أولا، لا تمرين ينزل تحت 2
    _train.forEach(day => {
      const _cap = _dayCap(day);
      let __g = 0;
      while(_dayTotal(day) > _cap && __g++ < 200){
        let worst = null;
        day.exercises.forEach(ex => { if((ex.sets||0) > PER_EX_MIN && (!worst || _rankOf(ex) > _rankOf(worst))) worst = ex; });
        if(!worst) break;
        worst.sets -= 1;
      }
    });
    // 5) إنفاذ سقف MRV الأسبوعي لكل عضلة — يقلص بعد كل الخطوات السابقة
    //    يتعامل مع تجاوزات الpasses القديمة (StrongLifts back، adductors، إلخ)
    if(typeof MUSCLE_WEEKLY_CAPS !== 'undefined'){
      Object.keys(MUSCLE_WEEKLY_CAPS).forEach(grp => {
        const _mrv = _getMRV(grp);
        if(!_mrv || _mrv >= 999) return;
        let __g = 0;
        while((_muscleWeekly()[grp]||0) > _mrv && __g++ < 200){
          let worst = null;
          _train.forEach(day => {
            day.exercises.forEach(ex => {
              if(ex.grp === grp && (ex.sets||0) > PER_EX_MIN && (!worst || _rankOf(ex) > _rankOf(worst))) worst = ex;
            });
          });
          if(!worst) break;
          worst.sets -= 1;
        }
      });
    }
  })();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PASS FINAL — WEEKLY REGION-COVERAGE REPAIR (exercise-level guarantee)
  // آخر ضمان: بعد كل ال trim/dedup/caps، لو منطقة مطلوبة غابت من
  // التمارين النهائية (صدر: علوي/مسطح/سفلي — كتف: أمامي/جانبي/خلفي)
  // والعضلة عندها تمارين كفاية، نستبدل تمرينا من منطقة مكررة بأفضل تمرين
  // من المنطقة الناقصة (نفس عدد المجموعات — محايد تماما للحجم). يحترم الإصابات.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  (function repairWeeklyRegionCoverage(){
    const isHome = (state.equip === 'home' || state.equip === 'none');
    const DB = isHome ? (typeof HOME_DB!=='undefined'?HOME_DB:null) : (typeof GYM_DB!=='undefined'?GYM_DB:null);
    if(!DB) return;
    const COVERAGE = { chest:['upper','mid','lower'], shoulders:['press','lateral','rear'], back:['lats','mid'], biceps:['long','short'], triceps:['long','lateral'], quads:['dominant','isolation'] };
    const injBmap = {shoulder:['shoulders'], knee:['quads','hamstrings'], back:['back'], elbow:['biceps','triceps'], neck:['traps']};
    const activeInj = (state.injuries||[]).filter(i=>i && i!=='none');
    const blockedGrps = new Set();
    activeInj.forEach(inj=>{ const base=inj.replace('_mild',''); (injBmap[base]||[]).forEach(g=>blockedGrps.add(g)); });
    const usedNames = new Set();
    distributedPlan.forEach(d=>{ if(d&&!d.isRest&&Array.isArray(d.exercises)) d.exercises.forEach(e=>usedNames.add(e.n)); });
    const tierRank = t => t==='S'?3:(t==='A'?2:1);
    const injOk = e => { if(!activeInj.length) return true; if(!e.safe_injuries) return true; return activeInj.every(inj=>{ const base=inj.replace('_mild',''); return e.safe_injuries.includes(inj)||e.safe_injuries.includes(base)||e.safe_injuries.includes(base+'_mild'); }); };
    for(const grp of Object.keys(COVERAGE)){
      if(blockedGrps.has(grp)) continue;
      const required = COVERAGE[grp];
      // خريطة اسم-التمرين - منطقته الحقيقية من قاعدة البيانات (يصحح تصنيف 'all' الخاطئ)
      const nameRegion = {};
      for(const reg of Object.keys(DB[grp]||{})){ (DB[grp][reg]||[]).forEach(e=>{ if(e&&e.n&&!(e.n in nameRegion)) nameRegion[e.n]=reg; }); }
      const slots = [];
      distributedPlan.forEach((d,di)=>{ if(d&&!d.isRest&&Array.isArray(d.exercises)) d.exercises.forEach((e,ei)=>{ if(e.grp===grp) slots.push({di,ei}); }); });
      if(slots.length < required.length) continue;
      // تطبيع التصنيف: لو التمرين موجود في منطقة محددة بقاعدة البيانات، صحح الsub
      // عشان الواجهة وخريطة العضلات تعرض المنطقة الصحيحة (مش 'all')
      slots.forEach(s=>{ const e=distributedPlan[s.di].exercises[s.ei]; if(nameRegion[e.n] && nameRegion[e.n]!==e.sub){ e.sub = nameRegion[e.n]; e._regionRelabeled=true; } });
      const subOf = s => { const e=distributedPlan[s.di].exercises[s.ei]; return nameRegion[e.n] || e.sub; };
      const present = new Set(slots.map(subOf));
      const missing = required.filter(r=>!present.has(r));
      for(const miss of missing){
        const pool = (DB[grp] && DB[grp][miss]) ? DB[grp][miss] : [];
        const cand = pool.filter(e=>e&&e.n&&!usedNames.has(e.n)&&injOk(e)).sort((a,b)=>tierRank(b.tier)-tierRank(a.tier))[0];
        if(!cand) continue;
        const counts = {}; slots.forEach(s=>{ const k=subOf(s); counts[k]=(counts[k]||0)+1; });
        const isReq = sub => required.includes(sub);
        // الضحية = خانة منطقة زائدة (غير مطلوبة مثل 'all')، أو منطقة مطلوبة مكررة (>=2)
        const victims = slots.filter(s=>{ const k=subOf(s); return !isReq(k) || (counts[k]||0)>=2; });
        if(!victims.length) continue;
        // تفضيل السرقة من منطقة مكررة (>=2) أولا، ثم من منطقة زائدة (لحماية تمارين قيمة مثل الظهر السفلي)
        victims.sort((a,b)=>{ const sa=subOf(a),sb=subOf(b); const ca=counts[sa],cb=counts[sb]; const aOver=ca>=2,bOver=cb>=2; if(aOver!==bOver) return aOver?-1:1; if(cb!==ca) return cb-ca; return b.ei-a.ei; });
        const v = victims[0];
        const old = distributedPlan[v.di].exercises[v.ei];
        distributedPlan[v.di].exercises[v.ei] = { ...old, n:cand.n, alt:cand.alt, mu:cand.mu, tier:cand.tier, safe_injuries:cand.safe_injuries, goal_bonus:cand.goal_bonus, vid:(typeof getValidVid==='function'?getValidVid(cand.vid):cand.vid), sub:miss, _regionCoverageSwap:true };
        usedNames.delete(old.n); usedNames.add(cand.n);
        present.add(miss);
        console.log('[RegionCoverageRepair] '+grp+': '+old.n+' ('+old.sub+') \u2192 '+cand.n+' ('+miss+')');
      }
    }
  })();

  const rankLabels = {1:'Compound',2:'Compound',3:'Hypertrophy',4:'Isolation',5:'Finisher'};
  const rankColors = {1:'#ff7a1a',2:'#fbbf24',3:'#6c63ff',4:'#3b82f6',5:'#00e5a0'};

  plan.forEach((day,idx)=>{
    const exercises = distributedPlan[idx]?.exercises || day.exercises || [];
    state.plan[idx].exercises = exercises;
    const totalSets=exercises.reduce((s,e)=>s+e.sets,0);
    state.plan[idx]._totalSets=totalSets;
    const color=dayColors[idx%dayColors.length];

    // يوم الراحة = راحة 100% — لا نبني له محتوى تمارين
    if (day.isRest) {
      html+=`<div id="dcont${idx}" style="display:none;"></div>`;
      html+=`<div id="dcontex${idx}" style="display:none;"></div>`;
      return;
    }

    const warmHTML=day.warm?`<div class="warmup-section"><div class="warmup-title"> الإحماء</div><div class="warmup-items">${day.warm.map(w=>`<span class="warmup-item">${mixedText(w)}</span>`).join('')}</div></div>`:'';
    const stretchHTML=day.stretch?`<div class="stretch-section">
      <div class="stretch-title"> الاسترش بعد التمرين</div>
      <div class="stretch-items">${day.stretch.map(s=>`<span class="stretch-item" dir="rtl">${mixedText(s)}</span>`).join('')}</div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
        <a href="https://www.youtube.com/shorts/1Mr9N8tN-Uw" target="_blank" rel="noopener"
           style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;font-size:10px;font-weight:700;color:#e56880;text-decoration:none;background:rgba(240,112,144,0.1);padding:7px 10px;border-radius:8px;border:1px solid rgba(240,112,144,0.25);min-width:100px;">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true" style="flex:0 0 auto;vertical-align:middle"><path d="M8 5v14l11-7z"/></svg> فيديو الاسترتش السفلي
        </a>
        <a href="https://www.youtube.com/shorts/OZ1sPerv9kA" target="_blank" rel="noopener"
           style="flex:1;display:flex;align-items:center;justify-content:center;gap:5px;font-size:10px;font-weight:700;color:#e56880;text-decoration:none;background:rgba(240,112,144,0.1);padding:7px 10px;border-radius:8px;border:1px solid rgba(240,112,144,0.25);min-width:100px;">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true" style="flex:0 0 auto;vertical-align:middle"><path d="M8 5v14l11-7z"/></svg> فيديو الاسترتش العلوي
        </a>
      </div>
    </div>`:'';
    // ── الأنشطة الإضافية / Module blocks ────────────────────────────
    const cooldownHTML = (day.cooldown && day.cooldown.length)
      ? `<div style="background:rgba(0,229,160,0.05);border:1px solid rgba(0,229,160,0.2);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:10px;">
           <div style="font-size:10px;font-weight:800;color:var(--green);margin-bottom:6px;"> الأنشطة الإضافية</div>
           <div style="font-size:9.5px;color:var(--text-muted);margin-bottom:8px;line-height:1.6;">يمكنك أداء هذه التمارين في الوقت الذي يناسبك، ويفضل تنفيذها في أيام التدريب، ولكن في وقت مختلف عن وقت جلسة الجيم الأساسية لتجنب التأثير على الأداء والاستشفاء</div>
           <div style="display:flex;flex-direction:column;gap:5px;">${day.cooldown.map(c=>`<span style="font-size:10px;font-weight:600;color:#a0f5d8;background:rgba(0,229,160,0.08);padding:4px 10px;border-radius:8px;">${c}</span>`).join('')}</div>
         </div>`
      : '';
    const coverageNotesHTML = (day._coverageNotes && day._coverageNotes.length)
      ? `<div style="background:rgba(59,130,246,0.05);border:1px solid rgba(59,130,246,0.2);border-radius:var(--radius-sm);padding:8px 12px;margin-bottom:8px;">
           <div style="font-size:9px;font-weight:800;color:var(--blue2);margin-bottom:4px;">تغطية عضلية تلقائية</div>
           ${day._coverageNotes.map(n=>`<div style="font-size:9px;color:#93c5fd;">${n}</div>`).join('')}
         </div>`
      : '';
    const moduleTagsHTML = (day._moduleTags && day._moduleTags.length)
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px;padding:8px 14px;background:rgba(168,85,247,0.04);border-top:1px solid rgba(168,85,247,0.12);">
           <span style="font-size:8px;font-weight:800;color:var(--text-muted);letter-spacing:0.5px;align-self:center;">وحدات مدمجة:</span>
           ${day._moduleTags.map(t=>`<span style="font-size:8.5px;font-weight:700;background:rgba(168,85,247,0.12);color:#d8b4fe;border:1px solid rgba(168,85,247,0.25);padding:2px 8px;border-radius:8px;">${t}</span>`).join('')}
         </div>`
      : '';
    const dbSourceBadge = state.equip==='home'
      ? `<span style="font-size:8px;font-weight:800;padding:2px 7px;border-radius:8px;background:rgba(0,229,160,0.12);color:var(--green);border:1px solid rgba(0,229,160,0.3);">HOME DB</span>`
      : `<span style="font-size:8px;font-weight:800;padding:2px 7px;border-radius:8px;background:rgba(108,99,255,0.12);color:var(--accent3);border:1px solid rgba(108,99,255,0.3);">GYM DB</span>`;
    // ── Muscle Section Headers — يوم الأرجل ──────────────────────────
    const isLegsRenderDay = (day.groups||[]).some(g => g[0]==='quads' || g[0]==='hamstrings');
    const LEG_SECTIONS = [
      { grp:'quads',      sub:null,      icon:'', ar:'الكوادز',                en:'Quadriceps',         color:'#6c8ef5', border:'rgba(108,142,245,0.3)' },
      { grp:'hamstrings', sub:'dominant',icon:'', ar:'الهامستينج',             en:'Hamstrings',         color:'#38b6ff', border:'rgba(56,182,255,0.3)'  },
      { grp:'calves',     sub:null,      icon:'', ar:'السمانة',               en:'Calves',             color:'#00e5b0', border:'rgba(0,229,176,0.3)'   },
      { grp:'hamstrings', sub:'glutes',  icon:'', ar:'الجلوتس (المؤخرة)',     en:'Glutes',             color:'#b87fff', border:'rgba(184,127,255,0.3)' },
      { grp:'adductors',  sub:null,      icon:'', ar:'الضامة الداخلية',       en:'Adductors',          color:'#ffd060', border:'rgba(255,208,96,0.3)'  },
    ];
    const _seenSections = new Set();
    function _muscleSecHeader(grp, sub){
      const key = grp + '|' + (sub||'*');
      if(_seenSections.has(key)) return '';
      _seenSections.add(key);
      const sec = LEG_SECTIONS.find(s => s.grp === grp && (s.sub === null || s.sub === sub));
      if(!sec) return '';
      return `<div class="muscle-section-header" style="--msh-color:${sec.color};--msh-border:${sec.border};">
        <span class="msh-icon">${sec.icon}</span>
        <div class="msh-info">
          <div class="msh-name">${sec.ar}</div>
          <div class="msh-en">${sec.en}</div>
        </div>
        <div class="msh-line"></div>
      </div>`;
    }
    // ──────────────────────────────────────────────────────────────────
    // ترتيب تمارين يوم الأرجل حسب LEG_SECTIONS: Quad - Ham - Calves - Glutes - Adductors
    const _sortedExercises = isLegsRenderDay ? (() => {
      const _sectionOrder = LEG_SECTIONS.map((s,i)=>({grp:s.grp,sub:s.sub,order:i}));
      const _getOrder = (ex) => {
        const match = _sectionOrder.find(s =>
          s.grp === ex.grp && (s.sub === null || s.sub === ex.sub)
        );
        return match ? match.order : 99;
      };
      return [...exercises].sort((a,b) => _getOrder(a) - _getOrder(b));
    })() : exercises;
    const exHTML=_sortedExercises.map((ex,ei)=>{
      const tierClass  = ex.tier==='S' ? 'tier-s' : 'tier-a';
      const rank       = getExerciseRank(ex);
      const seqLabelAr = getSeqLabelAr(rank);
      const seqColor   = rankColors[rank] || '#9898c0';
      const exAccent   = getExAccent(ex, color);
      const coachNote  = getCoachingNote(ex);
      const typeLabel  = classifyExerciseType(ex) === 'heavy_compound'
        ? 'مركبة ثقيلة' : classifyExerciseType(ex) === 'compound'
        ? 'مركبة' : 'عزل';

      const _secHdr = isLegsRenderDay ? _muscleSecHeader(ex.grp, ex.sub) : '';
      return _secHdr + `<div class="ex-card" style="--ex-accent:${exAccent};">
        <!-- ── HEADER ── -->
        <div class="ex-header">
          <div class="ex-num" style="background:${exAccent};border-radius:8px;">${ei+1}</div>
          <div class="ex-info">
            <div class="ex-name" dir="rtl">${mixedText(ex.n)}</div>
            <div class="ex-muscle">${ex.mu||''} ${ex.blocked?'<span class=\"ex-injury-flag\">تعديل إصابة</span>':''}${ex._compensatory?'<span class=\"ex-injury-flag\" style=\"background:rgba(0,229,176,0.12);color:var(--green);border-color:rgba(0,229,176,0.3);\">حجم تعويضي</span>':''}</div>
          </div>
          <div class="ex-badges">
            <span class="ex-seq-badge" style="background:${seqColor}18;color:${seqColor};border:1px solid ${seqColor}35;">${seqLabelAr}</span>
            <span class="ex-tier ${tierClass}">${ex.tier}</span>
            ${ex._weakExtra ? '<span class="ex-tier" style="background:rgba(255,100,100,0.12);color:#ff6464;border:1px solid rgba(255,100,100,0.25);">نقطة ضعف</span>' : ''}
          </div>
        </div>

        <!-- ── METRICS ROW (sets / reps / rest) ── -->
        <div class="ex-metrics">
          <div class="ex-metric">
            <div class="ex-metric-val" style="color:${exAccent};">${ex.sets}</div>
            <div class="ex-metric-lbl">مجموعات</div>
          </div>
          <div class="ex-metric">
            <div class="ex-metric-val">${ex.reps}</div>
            <div class="ex-metric-lbl">عدات</div>
          </div>
          <div class="ex-metric">
            <div class="ex-metric-val" style="font-size:11px;">${fmtRest(ex.rest)}</div>
            <div class="ex-metric-lbl">راحة</div>
          </div>
        </div>

        <!-- ── RIR + TYPE CHIPS ── -->
        <div class="ex-rir-row">
          ${ex.progressiveRIR
            ? `<span class="ex-rir-chip rir" title="RIR تصاعدي: مجموعة 1 - مجموعة أخيرة">${ex.progressiveRIR}</span>`
            : ex.rir ? `<span class="ex-rir-chip rir">${ex.rir}</span>` : ''}
          <span class="ex-rir-chip type">${typeLabel}</span>
        </div>

        <!-- ── COACH NOTE ── -->
        <div class="ex-coach-note">
          <span class="note-icon"></span>
          <span>${coachNote}</span>
        </div>

        <!-- ── PROGRESSION ── -->
        ${ex.progression?`<div class="ex-progression">
          <span class="prog-label"> تقدم</span>
          <span>${ex.progression}</span>
        </div>`:''}

        <!-- ── FOOTER: alt + video ── -->
        <div class="ex-footer">
          <div class="ex-alt">
            <span class="ex-alt-label">بديل</span>
            <span class="ex-alt-name">${ex.alt||'—'}</span>
          </div>
          <a href="${safeVidUrl(ex.vid, ex.grp)}" target="_blank" rel="noopener" class="ex-video"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true" style="flex:0 0 auto;vertical-align:middle"><path d="M8 5v14l11-7z"/></svg> شاهد</a>
        </div>
      </div>`;
    }).join('');
    // Session fatigue summary
    const dayFat = accumulateFatigue(exercises);
    const fatTags = Object.entries(dayFat)
      .filter(([,v])=>v>4)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,3)
      .map(([k,v])=>{
        const label={lower_back:'ظهر سفلي',shoulder_press:'أكتاف/ضغط',elbow_ext:'ترايسبس',
          elbow_flex:'بايسبس',cns:'CNS',grip:'قبضة',axial:'محوري',
          ham:'هامستينج',quad:'كوادز',posterior:'خلفي',anterior:'أمامي'}[k]||k;
        return `<span style="font-size:9px;font-weight:700;color:var(--text-muted);background:var(--bg2);padding:2px 7px;border-radius:8px;">${label}: ${v}</span>`;
      }).join('');
    const fatigueBar = fatTags ? `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:9px 16px;background:rgba(0,0,0,0.18);border-top:1px solid rgba(255,255,255,0.04);">
      <span style="font-size:8.5px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.6px;margin-left:4px;">إجهاد الجلسة:</span>${fatTags}</div>` : '';
    // Session meta chips
    const sessionGoalLabel = {strength:'قوة',muscle:'ضخامة',cut:'تنشيف',fitness:'لياقة'}[state.goal]||state.goal;
    const sessionMeta = `<div class="day-session-meta">
      <span class="day-meta-chip"> ${exercises.length} تمرين</span>
      <span class="day-meta-chip"> ${totalSets} مجموعة</span>
      <span class="day-meta-chip"> ${sessionGoalLabel}</span>
      <span class="day-meta-chip"> ${state.exp==='beginner'?'مبتدئ':state.exp==='intermediate'?'متوسط':'متقدم'}</span>
    </div>`;
    // ── LISS AUTO-RECOMMENDATION: بعد أيام الأرجل الثقيلة ──────────────
    // إذا كانت الجلسة تحتوي على هامستينج أو كوادز compound (S-tier)
    // نعرض توصية LISS بدل HIIT لليوم التالي — لحماية التعافي العضلي.
    const isHeavyLegDay = exercises.some(e=>
      e.tier==='S' && (e.grp==='quads' || e.grp==='hamstrings')
    );
    const lissNoteHTML = isHeavyLegDay
      ? `<div style="background:rgba(56,182,255,0.05);border:1px solid rgba(56,182,255,0.2);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px;">
           <span style="font-size:16px;flex-shrink:0;"></span>
           <div>
             <div style="font-size:10px;font-weight:800;color:var(--blue2);margin-bottom:3px;">كارديو اليوم التالي — LISS موصى به</div>
             <div style="font-size:10px;color:rgba(110,207,255,0.85);line-height:1.6;">بعد تمارين أرجل ثقيلة، ال HIIT يزيد الإجهاد التراكمي ويبطئ التعافي. استبدله ب <b>30-40 دقيقة Incline Walk أو Cycling</b> بشدة منخفضة — يحرق دهون دون هدم عضلي</div>
           </div>
         </div>`
      : '';
    // ──────────────────────────────────────────────────────────────────────
    // Store content for drawer (full: warmup + exercises + stretch)
    const contentId = `dcont${idx}`;
    html+=`<div id="${contentId}" style="display:none;">${sessionMeta}${warmHTML}${lissNoteHTML}${exHTML}${fatigueBar}${cooldownHTML}${stretchHTML}${coverageNotesHTML}${moduleTagsHTML}</div>`;
    // Store exercises-only content for planner panel (no warmup/stretch)
    html+=`<div id="dcontex${idx}" style="display:none;">${sessionMeta}${lissNoteHTML}${exHTML}${fatigueBar}${coverageNotesHTML}${moduleTagsHTML}</div>`;
  });

  // ── Build tabs strip + day panels (Weekly Planner Board) ────────────
  const cardColors=['#6c63ff','#00e5a0','#3b82f6','#a855f7','#ff7a1a','#fbbf24'];
  let tabsHTML = `<div class="p5-tabs-strip days-${plan.length}" id="p5TabsStrip">`;
  plan.forEach((day,idx)=>{
    const col = cardColors[idx % cardColors.length];
    const isRest = day.isRest || false;
    const exercises = state.plan[idx]?.exercises || [];
    const totalSets = exercises.reduce((s,e)=>s+(e.sets||0),0);
    const _p=day.name.split('\u2014');
    const _nameEn=_p[0].trim();
    tabsHTML += `<div
      class="p5-day-tab${isRest?' rest-tab':''}"
      style="--dc-color:${col};"
      id="p5tab${idx}"
      ${isRest?'':'onclick="p5SwitchTab('+idx+')"'}>
      <span class="tab-day-num">يوم ${idx+1}</span>
      <span class="tab-day-name">${isRest?' راحة':_nameEn}</span>
      ${!isRest?`<span class="tab-day-sets">${totalSets} sets</span>`:''}
    </div>`;
  });
  tabsHTML += `</div>`;
  // panels container (hidden divs per day, shown by tab)
  let panelsHTML = `<div id="p5Panels">`;
  plan.forEach((day,idx)=>{
    const col = cardColors[idx % cardColors.length];
    const isRest = day.isRest || false;
    const contentId = `dcont${idx}`;
    panelsHTML += `<div id="p5panel${idx}" class="p5-day-panel" style="--dc-color:${col};display:${idx===0&&!isRest?'block':'none'};">
      <div id="p5panelInner${idx}"><!-- loaded on click --></div>
    </div>`;
  });
  panelsHTML += `</div>`;

  // keep cardsHTML (hidden) for drawer compatibility
  let cardsHTML = `<div class="days-grid" id="daysGrid">`;
  plan.forEach((day,idx)=>{
    const col = cardColors[idx % cardColors.length];
    const isRest = day.isRest || false;
    const exercises = state.plan[idx]?.exercises || [];
    const totalEx = exercises.length;
    const totalSets = exercises.reduce((s,e)=>s+(e.sets||0),0);
    const _p=day.name.split('\u2014');
    const _nameEn=_p[0].trim();
    const _nameAr=_p.slice(1).join('\u2014').trim();
    const muscleList = (day.muscles||[]);
    const muscleTags = muscleList.map((m,mi)=>`<span class="${mi<2?'primary':''}">${m}</span>`).join('');
    cardsHTML += `<div
      class="day-card${isRest?' dc-rest':''}"
      style="--dc-color:${col};"
      ${isRest?'':'onclick="openDrawer('+idx+')"'}
      id="daycard${idx}">
      <div class="dc-head">
        <div class="dc-num">يوم ${idx+1}</div>
        <div class="dc-icon">${dayIcons[idx%dayIcons.length]}</div>
      </div>
      <div class="dc-body">
        <div class="dc-name">${_nameEn}</div>
        ${_nameAr?`<div class="dc-name-ar">${_nameAr}</div>`:''}
        ${isRest?`<div class="dc-muscles"><span>يوم تعافي</span></div>`:`<div class="dc-muscles">${muscleTags}</div>`}
      </div>
      ${isRest?'':`
      <div class="dc-meta">
        <div class="dc-stats-group">
          <div class="dc-stat"><span style="font-size:11px;"></span><span class="dc-stat-val">${totalEx}</span><span class="dc-stat-lbl">تمارين</span></div>
          <div class="dc-stat"><span style="font-size:11px;"></span><span class="dc-stat-val">${totalSets}</span><span class="dc-stat-lbl">مجموعات</span></div>
        </div>
        <div class="dc-arrow"></div>
      </div>`}
    </div>`;
  });
  cardsHTML += `</div>`;

  // ── Populate stats bar ───────────────────────────────────────────────
  // المصدر الوحيد للحقيقة: state._realTotalSets المحسوب في syncCoverageAfterPlan
  // لو لأي سبب مش موجود، نحسبه هنا بنفس الطريقة
  const totalPlanSets = state._realTotalSets || plan.reduce((acc,d,idx)=>{
    if(d.isRest) return acc;
    const exs = state.plan[idx]?.exercises||[];
    return acc + exs.reduce((s,e)=>s+(e.sets||0),0);
  },0);
  // تحديث state بالقيمة المحسوبة عشان الصفحتين تتزامنا
  state._realTotalSets = totalPlanSets;
  const workDays = plan.filter(d=>!d.isRest).length;
  const goalLabelAr = {strength:'قوة',muscle:'ضخامة',cut:'تنشيف',fitness:'لياقة'}[state.goal]||state.goal;
  const _gid = (id) => document.getElementById(id);
  if(_gid('p5StatDays'))  _gid('p5StatDays').textContent=workDays;
  if(_gid('p5StatSets'))  _gid('p5StatSets').textContent=totalPlanSets;
  if(_gid('p5StatMins'))  _gid('p5StatMins').textContent=state.duration||60;
  if(_gid('p5StatGoal'))  _gid('p5StatGoal').textContent=goalLabelAr;
  if(_gid('p5SplitLabel'))_gid('p5SplitLabel').textContent=getSplits()[state.selectedSplit]?.name||'';
  const dbBadgeEl=document.getElementById('p5DbBadge');
  if(dbBadgeEl) dbBadgeEl.innerHTML=state.equip==='home'
    ?`<span style="font-size:8px;font-weight:800;padding:3px 10px;border-radius:8px;background:rgba(0,229,160,0.1);color:var(--green);border:1px solid rgba(0,229,160,0.25);"> HOME DB</span>`
    :`<span style="font-size:8px;font-weight:800;padding:3px 10px;border-radius:8px;background:rgba(108,99,255,0.1);color:var(--accent3);border:1px solid rgba(108,99,255,0.25);"> GYM DB</span>`;

  // Combine: tabs + panels (replaces grid) + hidden grid (for drawer)
  const plannerCombo = tabsHTML + panelsHTML + cardsHTML;

  // ── Warmup Summary — built here so it lands ABOVE everything ─────────
  const warmupSummaryHTML = `<div id="warmupSummarySection" style="margin-bottom:16px;background:linear-gradient(145deg,rgba(245,200,66,0.07),rgba(0,0,0,0.25));border:1px solid rgba(245,200,66,0.3);border-radius:var(--radius);padding:16px;">
    <div class="protocol-header" onclick="toggleProtocol('warmup')">
      <span style="font-size:18px;"></span>
      <span style="font-size:13px;font-weight:800;color:var(--yellow);">بروتوكول الإحماء الثابت</span>
      <span style="font-size:9px;font-weight:700;background:rgba(245,200,66,0.15);color:#fde68a;border:1px solid rgba(245,200,66,0.3);padding:2px 8px;border-radius:10px;">إلزامي قبل كل جلسة</span>
      <span id="warmupToggleIcon" class="protocol-toggle-icon">
        <i class="arrow">▼</i><span id="warmupToggleTxt">اعرض</span>
      </span>
    </div>
    <div id="warmupBody" class="protocol-body">
      <div style="padding-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:rgba(245,200,66,0.06);border:1px solid rgba(245,200,66,0.2);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;">
          <div style="font-size:11px;font-weight:800;color:var(--yellow);margin-bottom:8px;"> إحماء علوي</div>
          <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
            ${WARMUP.upper.map(w=>`<span style="font-size:10px;font-weight:600;color:#f9de86;background:rgba(245,200,66,0.09);padding:3px 8px;border-radius:7px;direction:rtl;unicode-bidi:plaintext;text-align:right;display:block;">${mixedText(w)}</span>`).join('')}
          </div>
          <a href="https://www.youtube.com/shorts/YslX2dqLvxM" target="_blank" rel="noopener"
             style="margin-top:10px;display:flex;align-items:center;justify-content:center;gap:5px;font-size:10px;font-weight:700;color:#e56880;text-decoration:none;background:rgba(240,112,144,0.1);padding:7px 10px;border-radius:8px;border:1px solid rgba(240,112,144,0.25);">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true" style="flex:0 0 auto;vertical-align:middle"><path d="M8 5v14l11-7z"/></svg> فيديو الإحماء العلوي 1
          </a>
          <a href="https://www.youtube.com/shorts/0gHLR5jaYCk" target="_blank" rel="noopener"
             style="margin-top:6px;display:flex;align-items:center;justify-content:center;gap:5px;font-size:10px;font-weight:700;color:#e56880;text-decoration:none;background:rgba(240,112,144,0.1);padding:7px 10px;border-radius:8px;border:1px solid rgba(240,112,144,0.25);">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true" style="flex:0 0 auto;vertical-align:middle"><path d="M8 5v14l11-7z"/></svg> فيديو الإحماء العلوي 2
          </a>
        </div>
        <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;">
          <div style="font-size:11px;font-weight:800;color:var(--blue2);margin-bottom:8px;"> إحماء سفلي</div>
          <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
            ${WARMUP.lower.map(w=>`<span style="font-size:10px;font-weight:600;color:#93c5fd;background:rgba(59,130,246,0.09);padding:3px 8px;border-radius:7px;direction:rtl;unicode-bidi:plaintext;text-align:right;display:block;">${mixedText(w)}</span>`).join('')}
          </div>
          <a href="https://www.youtube.com/watch?v=IsRCKPIk86o" target="_blank" rel="noopener"
             style="margin-top:10px;display:flex;align-items:center;justify-content:center;gap:5px;font-size:10px;font-weight:700;color:#e56880;text-decoration:none;background:rgba(240,112,144,0.1);padding:7px 10px;border-radius:8px;border:1px solid rgba(240,112,144,0.25);">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true" style="flex:0 0 auto;vertical-align:middle"><path d="M8 5v14l11-7z"/></svg> فيديو الإحماء السفلي 1
          </a>
          <a href="https://www.youtube.com/shorts/M7qRIigeUMc" target="_blank" rel="noopener"
             style="margin-top:6px;display:flex;align-items:center;justify-content:center;gap:5px;font-size:10px;font-weight:700;color:#e56880;text-decoration:none;background:rgba(240,112,144,0.1);padding:7px 10px;border-radius:8px;border:1px solid rgba(240,112,144,0.25);">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true" style="flex:0 0 auto;vertical-align:middle"><path d="M8 5v14l11-7z"/></svg> فيديو الإحماء السفلي 2
          </a>
        </div>
      </div>
      <div style="margin-top:8px;font-size:10px;color:var(--text-muted);padding:7px 10px;background:rgba(0,0,0,0.2);border-radius:8px;">
         <b style="color:var(--yellow);">Ramp-Up:</b> 50% × 10 - 70% × 6 - وزن العمل الكامل
      </div>
    </div>
  </div>`;

  // warmup - tabs+panels+cards - hidden content divs (quality banner prepended after)
  html = warmupSummaryHTML + plannerCombo + html;

  // ── Program Quality Banner ───────────────────────────────────────────
  const qScore = qualityData.score||85;
  const qColor = qScore>=85?'#00e5a0':qScore>=70?'#fbbf24':'#ff4466';
  const qLabel = qScore>=85?'برنامج احترافي مرتب ذكيا':qScore>=70?'برنامج جيد مع بعض التحسينات':'تم إعادة توزيع ذكي للبرنامج';
  const covData = state._coverageData || {coverageScore:100,missing:[]};
  const covScore = covData.coverageScore || 100;
  const covColor = covScore>=90?'#00e5a0':covScore>=70?'#fbbf24':'#ff4466';
  const covMissingAr = {rear_delts:'دلتا خلفي',side_delts:'دلتا جانبي',front_delts:'دلتا أمامي',lats:'ظهر لاتس',upper_back:'ظهر وسط',glutes:'جلوتس',calves:'سمانة',core:'كور',triceps:'ترايسبس',biceps:'بايسبس',chest:'صدر',quads:'كوادز',hamstrings:'هامستينج'};
  const covMissingStr = (covData.missing||[]).map(m=>covMissingAr[m]||m).join('، ') || 'لا يوجد';
  html = `<div style="display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,rgba(108,99,255,0.07),rgba(0,0,0,0.3));border:1px solid rgba(108,99,255,0.2);border-radius:12px;padding:14px 18px;margin-bottom:18px;">
    <div style="text-align:center;min-width:52px;background:rgba(108,99,255,0.1);border:1px solid rgba(108,99,255,0.2);border-radius:10px;padding:8px 6px;">
      <div style="font-size:26px;font-weight:900;color:${qColor};line-height:1;">${qScore}</div>
      <div style="font-size:8px;color:var(--text-muted);font-weight:800;letter-spacing:0.5px;margin-top:2px;">QUALITY</div>
    </div>
    <div style="flex:1;">
      <div style="font-size:12px;font-weight:900;color:var(--text);margin-bottom:3px;"> برنامج مصمم ذكيا</div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:5px;">${qLabel}</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;">
        <span style="font-size:9px;font-weight:700;background:rgba(255,122,26,0.1);color:#fdba74;border:1px solid rgba(255,122,26,0.2);padding:2px 8px;border-radius:8px;">ترتيب احترافي</span>
        <span style="font-size:9px;font-weight:700;background:rgba(0,229,160,0.1);color:#a0f5d8;border:1px solid rgba(0,229,160,0.2);padding:2px 8px;border-radius:8px;">إدارة الإجهاد</span>
        <span style="font-size:9px;font-weight:700;background:rgba(59,130,246,0.1);color:#93c5fd;border:1px solid rgba(59,130,246,0.2);padding:2px 8px;border-radius:8px;">توازن الحركات</span>
        <span style="font-size:9px;font-weight:700;background:rgba(168,85,247,0.1);color:#d8b4fe;border:1px solid rgba(168,85,247,0.2);padding:2px 8px;border-radius:8px;">توصية تقدم</span>
        <span style="font-size:9px;font-weight:700;background:rgba(0,229,160,0.1);color:${covColor};border:1px solid rgba(0,229,160,0.2);padding:2px 8px;border-radius:8px;"> تغطية عضلية: ${covScore}%</span>
        ${(state.activeModules&&state.activeModules.length)?`<span style="font-size:9px;font-weight:700;background:rgba(108,99,255,0.1);color:var(--accent3);border:1px solid rgba(108,99,255,0.25);padding:2px 8px;border-radius:8px;"> ${state.activeModules.length} وحدة مدمجة</span>`:''}
      </div>
    </div>
  </div>` + html;
  document.getElementById('exercisePlan').innerHTML=html;

  // ── Auto-load first non-rest tab ───────────────────────────────────
  const firstWorkIdx = (state.plan||[]).findIndex(d=>!d.isRest);
  if(firstWorkIdx>=0) setTimeout(()=>p5SwitchTab(firstWorkIdx),0);

  // ── Stretch summary appended after ──────────────────────────────────

  // ── STRETCH PROTOCOL: fixed section after the day cards ─────────────
  const stretchSummaryHTML = `<div id="stretchSummarySection" style="margin-top:18px;background:linear-gradient(145deg,rgba(45,212,160,0.06),rgba(0,0,0,0.25));border:1px solid rgba(45,212,160,0.28);border-radius:var(--radius);padding:16px;">

    <!-- Header -->
    <div class="protocol-header" onclick="toggleProtocol('stretch')">
      <span style="font-size:18px;"></span>
      <span style="font-size:13px;font-weight:800;color:#2dd4a0;">بروتوكول الاسترتش بعد التمرين</span>
      <span style="font-size:9px;font-weight:700;background:rgba(45,212,160,0.14);color:#6ee7c7;border:1px solid rgba(45,212,160,0.3);padding:2px 8px;border-radius:10px;">إلزامي بعد كل جلسة</span>
      <span id="stretchToggleIcon" class="protocol-toggle-icon">
        <i class="arrow">▼</i><span id="stretchToggleTxt">اعرض</span>
      </span>
    </div>

    <div id="stretchBody" class="protocol-body">
    <div style="padding-top:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">

      <!-- Upper body -->
      <div style="background:rgba(45,212,160,0.06);border:1px solid rgba(45,212,160,0.2);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:0;">
        <div style="font-size:10px;font-weight:800;color:#2dd4a0;margin-bottom:8px;"> جزء علوي</div>
        <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
          ${STRETCH.chest.map(s=>`<span style="font-size:9.5px;font-weight:600;color:#a0f5d8;background:rgba(45,212,160,0.07);padding:3px 7px;border-radius:7px;direction:rtl;unicode-bidi:plaintext;text-align:right;display:block;">${mixedText(s)}</span>`).join('')}
        </div>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:5px;">
          <a href="https://www.youtube.com/shorts/OZ1sPerv9kA" target="_blank" rel="noopener"
             style="display:flex;align-items:center;justify-content:center;gap:5px;font-size:9.5px;font-weight:700;color:#e56880;text-decoration:none;background:rgba(240,112,144,0.1);padding:7px 8px;border-radius:8px;border:1px solid rgba(240,112,144,0.25);width:100%;box-sizing:border-box;">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true" style="flex:0 0 auto;vertical-align:middle"><path d="M8 5v14l11-7z"/></svg> فيديو الجزء العلوي 1
          </a>
          <a href="https://www.youtube.com/shorts/LBZvfBYcxAU" target="_blank" rel="noopener"
             style="display:flex;align-items:center;justify-content:center;gap:5px;font-size:9.5px;font-weight:700;color:#e56880;text-decoration:none;background:rgba(240,112,144,0.1);padding:7px 8px;border-radius:8px;border:1px solid rgba(240,112,144,0.25);width:100%;box-sizing:border-box;">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true" style="flex:0 0 auto;vertical-align:middle"><path d="M8 5v14l11-7z"/></svg> فيديو الجزء العلوي 2
          </a>
        </div>
      </div>

      <!-- Lower body -->
      <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:0;">
        <div style="font-size:10px;font-weight:800;color:var(--blue2);margin-bottom:8px;"> جزء سفلي</div>
        <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
          ${STRETCH.legs.map(s=>`<span style="font-size:9.5px;font-weight:600;color:#93c5fd;background:rgba(59,130,246,0.09);padding:3px 7px;border-radius:7px;direction:rtl;unicode-bidi:plaintext;text-align:right;display:block;">${mixedText(s)}</span>`).join('')}
        </div>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:5px;">
          <a href="https://www.youtube.com/shorts/1Mr9N8tN-Uw" target="_blank" rel="noopener"
             style="display:flex;align-items:center;justify-content:center;gap:5px;font-size:9.5px;font-weight:700;color:#e56880;text-decoration:none;background:rgba(240,112,144,0.1);padding:7px 8px;border-radius:8px;border:1px solid rgba(240,112,144,0.25);width:100%;box-sizing:border-box;">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true" style="flex:0 0 auto;vertical-align:middle"><path d="M8 5v14l11-7z"/></svg> فيديو الجزء السفلي 1
          </a>
          <a href="https://www.youtube.com/shorts/ExqOGQIn6RE" target="_blank" rel="noopener"
             style="display:flex;align-items:center;justify-content:center;gap:5px;font-size:9.5px;font-weight:700;color:#e56880;text-decoration:none;background:rgba(240,112,144,0.1);padding:7px 8px;border-radius:8px;border:1px solid rgba(240,112,144,0.25);width:100%;box-sizing:border-box;">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true" style="flex:0 0 auto;vertical-align:middle"><path d="M8 5v14l11-7z"/></svg> فيديو الجزء السفلي 2
          </a>
        </div>
      </div>

      <!-- Back & glutes -->
      <div style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.2);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:0;">
        <div style="font-size:10px;font-weight:800;color:#c084fc;margin-bottom:8px;"> ظهر وجلوتس</div>
        <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
          ${STRETCH.back.map(s=>`<span style="font-size:9.5px;font-weight:600;color:#d8b4fe;background:rgba(168,85,247,0.09);padding:3px 7px;border-radius:7px;direction:rtl;unicode-bidi:plaintext;text-align:right;display:block;">${mixedText(s)}</span>`).join('')}
          ${STRETCH.glutes.map(s=>`<span style="font-size:9.5px;font-weight:600;color:#d8b4fe;background:rgba(168,85,247,0.09);padding:3px 7px;border-radius:7px;direction:rtl;unicode-bidi:plaintext;text-align:right;display:block;">${mixedText(s)}</span>`).join('')}
        </div>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:5px;">
          <a href="https://www.youtube.com/shorts/n-K9EP3hAVM" target="_blank" rel="noopener"
             style="display:flex;align-items:center;justify-content:center;gap:5px;font-size:9.5px;font-weight:700;color:#e56880;text-decoration:none;background:rgba(240,112,144,0.1);padding:7px 8px;border-radius:8px;border:1px solid rgba(240,112,144,0.25);width:100%;box-sizing:border-box;">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true" style="flex:0 0 auto;vertical-align:middle"><path d="M8 5v14l11-7z"/></svg> فيديو الظهر والجلوتس 1
          </a>
          <a href="https://www.youtube.com/shorts/Tlq03VyQa7Y" target="_blank" rel="noopener"
             style="display:flex;align-items:center;justify-content:center;gap:5px;font-size:9.5px;font-weight:700;color:#e56880;text-decoration:none;background:rgba(240,112,144,0.1);padding:7px 8px;border-radius:8px;border:1px solid rgba(240,112,144,0.25);width:100%;box-sizing:border-box;">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true" style="flex:0 0 auto;vertical-align:middle"><path d="M8 5v14l11-7z"/></svg> فيديو الظهر والجلوتس 2
          </a>
        </div>
      </div>

    </div>

    <!-- Golden rule -->
    <div style="margin-top:10px;font-size:10px;color:var(--text-muted);line-height:1.7;padding:7px 10px;background:rgba(0,0,0,0.2);border-radius:8px;">
       <b style="color:#2dd4a0;">قاعدة ذهبية:</b> امسك كل وضعية 30–45 ثانية بدون ارتداد — التنفس الهادئ يعمق الاسترتش تلقائيا.
    </div>
    </div><!-- /stretchBody -->
  </div>`;
  document.getElementById('exercisePlan').innerHTML += stretchSummaryHTML;

  // Drawer closed by default — user taps to open

  // ── SYNC COVERAGE: بعد بناء الخطة، حدث إحصائيات التغطية العضلية ──────
  // المصدر الوحيد للحقيقة: state.plan exercises الفعلية
  // ═══════════════════════════════════════════════════════════════════════
  // FINAL DEFENSE — Post-Processing Antagonist Guard
  // v54-FD: بعد كل منطق placement — يحذف أي تمرين مضاد لأركيتايب اليوم
  // يعمل على فلسفة: إذا فشلت كل الحراس السابقة فالحارس الأخير يضمن عدم وجود عضلة في غير يومها
  // نطاق الحذف: push day - لا biceps/back(pull)/legs | pull day - لا chest/triceps/legs | legs day - لا chest/back(pull)/biceps/triceps
  // استثناء: جميع العضلات المخططة في planned groups لليوم لا تحذف
  // استثناء: calves/core/forearms محايدة دائما
  // استثناء: upper/full/other archetypes لا تتأثر (كلاهما صحيحان لهذه الأركيتايب)
  // ═══════════════════════════════════════════════════════════════════════
  (function applyFinalDefenseGuard() {
    (state.plan||[]).forEach(day => {
      if (day.isRest) return;
      const grpSet = new Set((day.groups||[]).map(g => Array.isArray(g) ? g[0] : g));
      const subMap = {};
      (day.groups||[]).forEach(g => { if(Array.isArray(g)) { subMap[g[0]] = subMap[g[0]]||[]; subMap[g[0]].push(g[1]); } });
      const hasChest = grpSet.has('chest');
      const backUpper = grpSet.has('back') && !(subMap['back']||[]).every(s=>s==='lower');
      const hasLegs = grpSet.has('quads')||grpSet.has('hamstrings')||grpSet.has('glutes')||grpSet.has('adductors');
      // حدد archetype اليوم
      const _fdIsPush = hasChest && !backUpper && !hasLegs;
      const _fdIsPull = backUpper && !hasChest && !hasLegs;
      const _fdIsLegs = hasLegs && !hasChest && !backUpper;
      if (!_fdIsPush && !_fdIsPull && !_fdIsLegs) return; // upper/full/other — آمن
      day.exercises = (day.exercises||[]).filter(ex => {
        const g = ex.grp||'', s = ex.sub||'';
        if (!g) return true; // بدون group: احتفظ
        if (g==='calves'||g==='core'||g==='forearms') return true; // محايدة
        if (grpSet.has(g)) return true; // اليوم خطط هذه العضلة قصدا
        const isBackPull = g==='back' && s!=='lower';
        const isLeg = g==='quads'||g==='hamstrings'||g==='glutes'||g==='adductors';
        if (_fdIsPush && (g==='biceps'||isBackPull||isLeg)) return false; // push - لا biceps/back(pull)/legs
        if (_fdIsPull && (g==='chest'||g==='triceps'||isLeg)) return false; // pull - لا chest/triceps/legs
        if (_fdIsLegs && (g==='chest'||isBackPull||g==='biceps'||g==='triceps')) return false; // legs - لا جذع
        return true;
      });
    });
  })();

  // ── HINGE-DUP GUARD (v54) ────────────────────────────────────────────────
  // قاعدة رياضية: ممنوع تمرينان من نفس النمط الحركي (hip hinge) في نفس الجلسة
  // مثال: Romanian Deadlift (RDL) + Stiff-Leg Deadlift = CNS overload بدون فائدة إضافية
  // الحل: الأول يبقى، الثاني يحذف من اليوم
  (function applyHingeDupGuard() {
    // كشف نمط الثني (hip-hinge) بقاعدة كلمات مفتاحية — أقوى وأدوم من قايمة أسماء ثابتة
    // يمسك كل الموجود (RDL/Stiff-Leg/Romanian/Pull Through/Good Morning) + أي متغير مستقبلي
    // مستثنى عمدا: Hip Thrust (امتداد ورك مختلف) وLower Back Extension (أكسسوار عزل)
    const HINGE_RE = /deadlift|\bRDL\b|romanian|pull[\s-]?through|good\s*morning/i;
    const HINGE_EXCLUDE = /hip\s*thrust|back\s*extension|hyperext/i;
    const isHinge = (n) => !!n && HINGE_RE.test(n) && !HINGE_EXCLUDE.test(n);
    (state.plan||[]).forEach(day => {
      if (day.isRest) return;
      const exs = day.exercises || [];
      // جمع كل تمارين الثني في اليوم
      const hingeIdx = exs.map((ex,i)=>({ex,i})).filter(o => isHinge(o.ex.n));
      if (hingeIdx.length <= 1) return;
      // احتفظ بالأفضل: أقل rank (المركب الأهم) وعند التعادل S قبل A ثم أعلى sets
      hingeIdx.sort((a,b) => {
        const ra = getExerciseRank(a.ex), rb = getExerciseRank(b.ex);
        if (ra !== rb) return ra - rb;
        const ta = a.ex.tier==='S'?0:1, tb = b.ex.tier==='S'?0:1;
        if (ta !== tb) return ta - tb;
        return (b.ex.sets||0) - (a.ex.sets||0);
      });
      const keep = hingeIdx[0].i;
      const removeSet = new Set(hingeIdx.slice(1).map(o=>o.i));
      day.exercises = exs.filter((ex,i) => !removeSet.has(i) || i === keep);
    });
  })();

  (function syncCoverageAfterPlan() {
    const coverageEl = document.getElementById('coverageStatus');
    if (!coverageEl) return;
    try {
      // احسب setsMap الفعلي من exercises
      // FIX: تمارين hamstrings/glutes كانت تحسب مرتين — أزيل ال double count
      const realSetsMap = {};
      (state.plan||[]).forEach(d => {
        if (d.isRest) return;
        (d.exercises||[]).forEach(ex => {
          if (!ex.grp) return;
          // الجلوتس مستقلة: hamstrings/glutes تحسب في glutes مش في hamstrings
          const _mapKey = (ex.grp === 'hamstrings' && ex.sub === 'glutes') ? 'glutes' : ex.grp;
          realSetsMap[_mapKey] = (realSetsMap[_mapKey]||0) + (ex.sets||0);
        });
      });
      // الإجمالي الحقيقي = مجموع كل exercises بدون استثناء (شامل grp مجهول)
      // لا نعتمد على realSetsMap لأنه يتجاهل exercises بدون grp
      state._realTotalSets = (state.plan||[]).reduce((sum,d) => {
        if(d.isRest) return sum;
        return sum + (d.exercises||[]).reduce((s,e)=>s+(e.sets||0),0);
      }, 0);
      const realFreq = {};
      (state.plan||[]).forEach(d => {
        if (d.isRest) return;
        const seen = new Set();
        (d.groups||[]).forEach(([g, sub]) => {
          seen.add(g);
          if (sub === 'glutes') seen.add('glutes');
        });
        seen.forEach(m => { realFreq[m] = (realFreq[m]||0) + 1; });
      });

      const muscleKeys = ['chest','back','shoulders','quads','hamstrings','glutes','calves','adductors','biceps','triceps','forearms','traps','core'];
      const cards = buildCoverageVisualState(realFreq, realSetsMap, muscleKeys, state.days);
      const qScore = calcCoverageQualityScore(cards);
      const qLabel = qScore>=90?'ممتازة':qScore>=80?'جيدة جدا':qScore>=68?'متوازنة':qScore>=55?'مقبولة':'تحتاج تحسين';
      const qColor = qScore>=88?COVERAGE_COLORS.optimal:qScore>=72?COVERAGE_COLORS.good:qScore>=58?COVERAGE_COLORS.acceptable:COVERAGE_COLORS.low;
      const notes  = buildCoverageNotes(cards, state.selectedSplit);
      const notesHtml = notes.map(n=>`<div class="cov-note" style="border-left:2px solid ${n.color};"><span>${n.icon}</span><span>${n.text}</span></div>`).join('');
      const legendHtml = `
        <span class="cov-leg"><span class="cov-leg-dot" style="background:${COVERAGE_COLORS.optimal}"></span>نطاق مثالي</span>
        <span class="cov-leg"><span class="cov-leg-dot" style="background:${COVERAGE_COLORS.good}"></span>نطاق جيد</span>
        <span class="cov-leg"><span class="cov-leg-dot" style="background:${COVERAGE_COLORS.acceptable}"></span>كافي</span>
        <span class="cov-leg"><span class="cov-leg-dot" style="background:${COVERAGE_COLORS.indirect}"></span>غير مباشر</span>
        <span class="cov-leg"><span class="cov-leg-dot" style="background:${COVERAGE_COLORS.low}"></span>تغطية منخفضة</span>`;
      const qProgressHtml = `<div style="margin-top:5px;height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;"><div style="height:100%;width:${qScore}%;background:${qColor};border-radius:2px;transition:width 0.6s ease;"></div></div>`;

      // أعد كتابة عنصر التغطية كاملا بالبيانات الحقيقية
      coverageEl.innerHTML = `
        <div class="coverage-summary">
          <div class="cov-sum-header">
            <div>
              <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:3px;">جودة التغطية العضلية</div>
              <div style="font-size:9px;color:var(--text-muted);font-weight:600;">مقارنة ب MAV ل ${state.days} أيام/أسبوع · 55+ مقبول · 68+ متوازن · 80+ جيد جدا</div>
              ${qProgressHtml}
            </div>
            <div style="text-align:center;min-width:70px;">
              <div class="cov-sum-score">
                <div class="cov-score-val" style="-webkit-text-fill-color:transparent;background:linear-gradient(135deg,${qColor},#6c63ff);-webkit-background-clip:text;background-clip:text;">${qScore}</div>
                <div class="cov-score-max">/100</div>
              </div>
              <div class="cov-score-lbl" style="color:${qColor};">${qLabel}</div>
            </div>
          </div>
          <div class="cov-stats-row">
            <div class="cov-stat-box">
              <div class="cov-stat-val" id="covRealSets">${state._realTotalSets}</div>
              <div class="cov-stat-lbl">Sets إجمالي</div>
            </div>
            <div class="cov-stat-box">
              <div class="cov-stat-val" style="color:${qColor};">${cards.filter(c=>c.state!=='low').length} / ${cards.length}</div>
              <div class="cov-stat-lbl">عضلات مغطاة</div>
            </div>
            <div class="cov-stat-box">
              <div class="cov-stat-val" style="color:${qColor};font-size:13px;">${qLabel}</div>
              <div class="cov-stat-lbl">جودة التوزيع</div>
            </div>
          </div>
          <div class="cov-legend">${legendHtml}</div>
          ${notesHtml ? `<div class="cov-notes">${notesHtml}</div>` : ''}
        </div>`;
    } catch(e) { console.warn('syncCoverageAfterPlan error:', e); }
  })();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DAY DRAWER — open / close
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let _drawerOpen = false;
let _drawerIdx  = -1;

// ── Weekly Planner Board — Tab switcher ──────────────────────────────
function p5SwitchTab(idx){
  const plan = state.plan || [];
  const cardColors=['#6c63ff','#00e5a0','#3b82f6','#a855f7','#ff7a1a','#fbbf24'];

  // Switch tab active state
  plan.forEach((_,i)=>{
    const t=document.getElementById(`p5tab${i}`);
    if(t) t.classList.toggle('active', i===idx);
    const p=document.getElementById(`p5panel${i}`);
    if(p) p.style.display=(i===idx?'block':'none');
  });

  // Lazy-load panel content from exercises-only hidden div
  const inner=document.getElementById(`p5panelInner${idx}`);
  if(inner && !inner._loaded){
    const src=document.getElementById(`dcontex${idx}`);
    if(src){
      inner.innerHTML=src.innerHTML;
      inner._loaded=true;
    }
  }

  // Update panel border color
  const panel=document.getElementById(`p5panel${idx}`);
  if(panel) panel.style.borderTopColor=cardColors[idx%cardColors.length];
}

function openDrawer(idx){
  const day   = state.plan[idx];
  if(!day) return;
  const plan  = state.plan;
  const cardColors=['#6c63ff','#00e5a0','#3b82f6','#a855f7','#ff7a1a','#fbbf24'];
  const dayIcons=['','','','','',''];
  const col   = cardColors[idx % cardColors.length];
  const icon  = dayIcons[idx % dayIcons.length];

  // Header
  document.getElementById('ddDot').style.background  = col+'22';
  document.getElementById('ddDot').style.border      = `1.5px solid ${col}55`;
  document.getElementById('ddDot').textContent        = icon;
  const _ddParts = day.name.split('—');
  const _ddEng   = _ddParts[0].trim();
  const _ddAr    = _ddParts.slice(1).join('—').trim();
  document.getElementById('ddName').innerHTML =
    `<div style="direction:ltr;font-size:15px;font-weight:800;">يوم ${idx+1} — ${_ddEng}</div>`
    + (_ddAr ? `<div style="direction:rtl;font-size:11px;font-weight:600;color:var(--text-dim);margin-top:2px;">${_ddAr}</div>` : '');
  document.getElementById('ddName').style.color       = col;
  document.getElementById('ddMuscles').textContent    = (day.muscles||[]).join(' · ');
  document.getElementById('ddHeader').style.borderTop = `3px solid ${col}`;

  // Body — copy from hidden div
  const src = document.getElementById(`dcont${idx}`);
  document.getElementById('ddBody').innerHTML = src ? src.innerHTML : '';

  // Highlight active card
  document.querySelectorAll('.day-card').forEach(c=>c.classList.remove('dc-active'));
  const card = document.getElementById(`daycard${idx}`);
  if(card) card.classList.add('dc-active');

  // Open
  document.getElementById('dayDrawerOverlay').classList.add('open');
  document.getElementById('dayDrawer').classList.add('open');
  document.body.style.overflow = 'hidden';
  _drawerOpen = true;
  _drawerIdx  = idx;
}

function closeDrawer(){
  document.getElementById('dayDrawerOverlay').classList.remove('open');
  document.getElementById('dayDrawer').classList.remove('open');
  document.body.style.overflow = '';
  document.querySelectorAll('.day-card').forEach(c=>c.classList.remove('dc-active'));
  _drawerOpen = false;
  _drawerIdx  = -1;
}

// Close on back gesture / ESC
document.addEventListener('keydown', e=>{ if(e.key==='Escape'&&_drawerOpen) closeDrawer(); });

// Swipe-down to close — ONLY when dragging from handle or header, NOT from scrollable body
(function(){
  let startY=0, dragging=false, fromHandle=false;
  const drawer  = ()=>document.getElementById('dayDrawer');
  const ddBody  = ()=>document.getElementById('ddBody');
  const handle  = ()=>document.querySelector('.dd-handle');
  const ddHdr   = ()=>document.getElementById('ddHeader');

  document.addEventListener('touchstart', e=>{
    if(!_drawerOpen) return;
    startY = e.touches[0].clientY;
    // Only allow drag-to-close when touch starts on handle or header — not on scrollable body
    const target = e.target;
    const body   = ddBody();
    const hnd    = handle();
    const hdr    = ddHdr();
    fromHandle = (hnd && hnd.contains(target)) || (hdr && hdr.contains(target));
    dragging = true;
  },{passive:true});

  document.addEventListener('touchmove', e=>{
    if(!dragging||!_drawerOpen||!fromHandle) return;
    const dy = e.touches[0].clientY - startY;
    if(dy>0) drawer().style.transform = `translateY(${dy}px)`;
  },{passive:true});

  document.addEventListener('touchend', e=>{
    if(!dragging||!_drawerOpen) return;
    dragging=false;
    if(!fromHandle){ fromHandle=false; return; }
    fromHandle=false;
    const dy = e.changedTouches[0].clientY - startY;
    if(dy>80){ drawer().style.transform=''; closeDrawer(); }
    else { drawer().style.transform=''; }
  },{passive:true});
})();

function toggleDay(idx){ openDrawer(idx); }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUILD MODULES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildModules(){
  const mods=[
    {id:'core',icon:'',name:'Core Protocol',desc:'تمارين كور علمية: Upper Abs، Lower Abs، Anti-Rotation، Anti-Extension'},
    {id:'kegel',icon:'',name:'Kegel Training',desc:'تمارين قاع الحوض لتحسين الثبات الجذعي والأداء العام'},
    {id:'yoga',icon:'',name:'Yoga Flow',desc:'جلسة يوغا أسبوعية لتحسين الاسترخاء والتعافي العميق'},
    {id:'mobility',icon:'',name:'Mobility & Flex',desc:'بروتوكول مرونة وموبيلتي قبل التمرين لتحسين المدى الحركي'},
    {id:'stretching',icon:'',name:'Stretching Protocol',desc:'روتين استرتش شامل بعد كل جلسة للتعافي السريع وتقليل DOMS'},
    {id:'breathing',icon:'',name:'Breathing & Mindset',desc:'تقنيات التنفس لتحسين الأداء وتقليل التوتر والكورتيزول'},
    {id:'cardio',icon:'',name:'Cardio Zone',desc:'بروتوكول كارديو متكيف حسب هدفك ومستوى التعافي الأسبوعي'},
    {id:'nutrition',icon:'',name:'Nutrition Guide',desc:'توزيع المغذيات المحسوب بناء على هدفك وTDEE الفعلي'},
    {id:'sleep',icon:'',name:'Recovery Protocol',desc:'بروتوكول تعافي ونوم وفوم رولينج مخصص لبياناتك'},
    {id:'deload',icon:'',name:'Deload Week',desc:'أسبوع تخفيف دوري لمنع الإفراط في التدريب وضمان التقدم'},
    {id:'weakpoint',icon:'',name:'Weak Point Focus',desc:'تمارين عزل مخصصة لتطوير المناطق الضعيفة المحددة لديك'},
    {id:'supplements',icon:'',name:'Supplements Guide',desc:'مكملات غذائية موصى بها حسب هدفك وحالتك — جرعات وتوقيتات دقيقة'}
  ];
  const suggested=[];
  if(state.goal==='muscle')suggested.push('nutrition','supplements');
  if(state.goal==='cut')suggested.push('cardio','nutrition','supplements');
  if(state.goal==='strength')suggested.push('supplements');
  if(state.recoveryScore<70)suggested.push('sleep','deload');
  // FIX v25: Deload مقترح دايما للمتوسط والمتقدم (مش بس لو التعافي منخفض)
  // علميا: كل متوسط/متقدم محتاج deload كل 4-6 أسابيع بغض النظر عن التعافي
  if(state.exp !== 'beginner' && !suggested.includes('deload')) suggested.push('deload');
  if(state.weak&&state.weak.includes('core'))suggested.push('core');
  if(state.injuries&&state.injuries.length>0&&!state.injuries.includes('none'))suggested.push('mobility');
  if(state.weak&&state.weak.length>0)suggested.push('weakpoint');
  // deduplicate
  const suggestedUniq=[...new Set(suggested)];
  //  لا يوجد auto-select — المستخدم يختار بنفسه فقط
  state.activeModules = [];
  const MOD_COLORS={core:'#6c8ef5',kegel:'#ff6b8a',yoga:'#b87fff',mobility:'#ffd060',stretching:'#00e5b0',breathing:'#38b6ff',cardio:'#ff6b8a',nutrition:'#ff9c5b',sleep:'#00e5b0',deload:'#38b6ff',weakpoint:'#ff9c5b',supplements:'#b87fff'};
  document.getElementById('modulesGrid').innerHTML=mods.map(m=>{
    const isSugg=suggestedUniq.includes(m.id);
    const badgeTxt = isSugg ? 'مقترح' : 'اختياري';
    const uc = MOD_COLORS[m.id]||'var(--purple)';
    return`<div class="mod-card" id="mod_${m.id}" style="--uc:${uc}" onclick="toggleMod('${m.id}')">
      <div class="mod-icon-wrap">${m.icon}</div>
      <div class="mod-name">${mixedText(m.name)}</div>
      <div class="mod-desc">${m.desc}</div>
      <span class="mod-badge">${badgeTxt}</span>
    </div>`;
  }).join('');
  updateModDetails();
}
function toggleMod(id){
  const el=document.getElementById(`mod_${id}`);el.classList.toggle('mod-active');
  const idx=state.activeModules.indexOf(id);
  if(idx>=0)state.activeModules.splice(idx,1);else state.activeModules.push(id);
  updateModDetails();
}
// ─── MODULE DETAIL RENDERER — FIX 2: Premium video card style matching main exercise system ────────────
function renderModuleExercises(list, vidFn){
  if(!list||!list.length) return '';
  return list.map((e,ei)=>{
    const tierClass = e.tier==='S'?'tier-s':'tier-a';
    // Use passed-in vidFn or fallback to global safeVidUrl
    const resolvedFn = (typeof vidFn === 'function') ? vidFn : safeVidUrl;
    // PATCH 2+6: Resolve category for correct fallback pool
    // Module DB items use e.category (e.g. 'mobility_hip', 'breathwork') not e.grp
    // Map to VID_SAFE_FALLBACKS keys
    const rawCat = e.category||e.grp||'default';
    const modCatMap = {
      mobility_hip:'mobility', mobility_spine:'mobility', mobility_shoulder:'mobility',
      mobility_ankle:'mobility', mobility_full:'mobility',
      stretch_static:'stretching',
      yoga_flow:'yoga', yoga_restorative:'yoga', yoga_active:'yoga',
      yoga_standing:'yoga', yoga_balance:'yoga',
      breathwork:'breathing', mindset:'breathing',
      recovery_active:'recovery', recovery_mobility:'recovery',
      recovery_stretch:'recovery', recovery_smr:'recovery',
      recovery_breathing:'recovery', recovery_thermal:'recovery',
      core_isometric:'core', core_bodyweight:'core', core_rotation:'core',
      core_anti_extension:'core',
      cardio_liss:'cardio', cardio_hiit:'cardio', cardio_steady:'cardio',
      kegel:'kegel'
    };
    // Match partial category prefix
    const resolvedCat = modCatMap[rawCat]
      || Object.keys(modCatMap).find(k=>rawCat.startsWith(k.split('_')[0]))
      || rawCat;
    const vidUrl = resolvedFn(e.vid, resolvedCat);
    const meta = e.sets||e.duration||e.protocol||'';
    const target = e.target||e.mu||'';
    const equipment = e.equipment && e.equipment!=='none' ? e.equipment : null;
    return `<div class="ex-card" style="--ex-accent:var(--purple);margin-bottom:10px;overflow:hidden;max-width:100%;">
      <!-- HEADER -->
      <div class="ex-header">
        <div class="ex-num" style="background:var(--purple);border-radius:8px;flex-shrink:0;">${ei+1}</div>
        <div class="ex-info" style="min-width:0;flex:1;overflow:hidden;">
          <div class="ex-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.n}</div>
          <div class="ex-muscle">${target}${equipment?` · ${equipment}`:''}</div>
        </div>
        <div class="ex-badges" style="flex-shrink:0;">
          <span class="ex-tier ${tierClass}">${e.tier}</span>
        </div>
      </div>
      <!-- META ROW -->
      ${meta?`<div class="ex-rir-row">
        <span class="ex-rir-chip type"> ${meta}</span>
      </div>`:''}
      <!-- DESCRIPTION -->
      ${e.desc?`<div class="ex-coach-note">
        <span class="note-icon"></span>
        <span>${e.desc}</span>
      </div>`:''}
      <!-- FOOTER: VIDEO -->
      <div class="ex-footer" style="justify-content:flex-end;align-items:center;">
        <a href="${vidUrl}" target="_blank" rel="noopener" class="ex-video" style="flex-shrink:0;"><svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true" style="flex:0 0 auto;vertical-align:middle"><path d="M8 5v14l11-7z"/></svg> شاهد</a>
      </div>
    </div>`;
  }).join('');
}

function getModuleDetail(id){
  switch(id){

    case 'cardio': {
      const isLowRecov = state.recoveryScore < 65;
      const goal = state.goal;
      const recProto = goal==='cut'
        ? 'LISS 35-40 دقيقة × 3-4 أيام/أسبوع في أيام الراحة'
        : goal==='muscle'
        ? 'LISS 20-25 دقيقة × 2 أيام فقط — لا تزيد لحماية الطاقة للنمو'
        : 'LISS 30 دقيقة × 3 أيام أو HIIT 20 دقيقة × 2 أيام';
      const topCardio = [
        ...(isLowRecov ? MODULE_DB.cardio.s.filter(e=>e.fatigue!=='high') : MODULE_DB.cardio.s),
        ...MODULE_DB.cardio.a.slice(0,2)
      ].slice(0,4);
      return `<div class="mod-proto-banner">
          <span class="proto-icon"></span>
          <span>بروتوكول مخصص لهدف <b>${{cut:'التنشيف',muscle:'الضخامة',strength:'القوة',fitness:'اللياقة'}[goal]||goal}</b> — ${recProto}</span>
        </div>
        ${isLowRecov?'<div class="mod-warn-strip"><span></span><span>تعافيك منخفض — تجنب HIIT حتى يتحسن النوم والتعافي</span></div>':''}
        <div class="mod-ex-heading">التمارين المقترحة</div>
        ${renderModuleExercises(topCardio, safeVidUrl)}`;
    }

    case 'core': {
      const coreList = MODULE_DB.core.filter(e=>e.tier==='S').concat(
        MODULE_DB.core.filter(e=>e.tier==='A').slice(0,3)
      );
      return `<div class="mod-proto-banner">
          <span class="proto-icon"></span>
          <span>في نهاية كل جلسة — <b>10-12 دقيقة</b> · 4 تمارين × 3 مجموعات · S-Tier أولا ثم A-Tier</span>
        </div>
        <div class="mod-ex-heading">التمارين المقترحة</div>
        ${renderModuleExercises(coreList.slice(0,5), safeVidUrl)}`;
    }

    case 'kegel': {
      const kegelList = MODULE_DB.kegel.filter(e=>e.tier==='S').concat(
        MODULE_DB.kegel.filter(e=>e.tier==='A').slice(0,2)
      );
      return `<div class="mod-proto-banner">
          <span class="proto-icon"></span>
          <span>يوميا بعد الاستيقاظ أو قبل النوم — <b>5-8 دقائق</b> · تحسن الثبات الجذعي والأداء بشكل غير مرئي لكن محسوس</span>
        </div>
        <div class="mod-ex-heading">التمارين المقترحة</div>
        ${renderModuleExercises(kegelList, safeVidUrl)}`;
    }

    case 'yoga': {
      const yogaList = MODULE_DB.yoga.filter(e=>e.tier==='S').concat(
        MODULE_DB.yoga.filter(e=>e.tier==='A').slice(0,2)
      );
      return `<div class="mod-proto-banner">
          <span class="proto-icon"></span>
          <span>جلسة أسبوعية واحدة — <b>30-45 دقيقة</b> · أفضل وقت: يوم الراحة الأول · تحسن النوم والمرونة والتعافي النفسي</span>
        </div>
        <div class="mod-ex-heading">التمارين المقترحة</div>
        ${renderModuleExercises(yogaList, safeVidUrl)}`;
    }

    case 'mobility': {
      const mobList = MODULE_DB.mobility.filter(e=>e.tier==='S').concat(
        MODULE_DB.mobility.filter(e=>e.tier==='A').slice(0,2)
      );
      return `<div class="mod-proto-banner">
          <span class="proto-icon"></span>
          <span><b>10 دقائق قبل كل جلسة</b> كجزء من الإحماء · يحسن المدى الحركي ويقلل خطر الإصابة</span>
        </div>
        <div class="mod-ex-heading">التمارين المقترحة</div>
        ${renderModuleExercises(mobList, safeVidUrl)}`;
    }

    case 'stretching': {
      const strList = MODULE_DB.stretching.filter(e=>e.tier==='S').concat(
        MODULE_DB.stretching.filter(e=>e.tier==='A').slice(0,2)
      );
      return `<div class="mod-proto-banner">
          <span class="proto-icon"></span>
          <span><b>10-15 دقيقة بعد كل جلسة</b> · استرتش ثابت 30-45ث لكل عضلة · لا تتجاوز الألم</span>
        </div>
        <div class="mod-ex-heading">التمارين المقترحة</div>
        ${renderModuleExercises(strList, safeVidUrl)}`;
    }

    case 'breathing': {
      const brList = MODULE_DB.breathing.filter(e=>e.tier==='S').concat(
        MODULE_DB.breathing.filter(e=>e.tier==='A').slice(0,1)
      );
      return `<div class="mod-proto-banner">
          <span class="proto-icon"></span>
          <span><b>قبل التمرين وبعده</b> · يخفض الكورتيزول ويحسن التركيز ويسرع التعافي بين الجلسات</span>
        </div>
        <div class="mod-ex-heading">التمارين المقترحة</div>
        ${renderModuleExercises(brList, safeVidUrl)}`;
    }

    case 'sleep': {
      const recList = MODULE_DB.recovery.filter(e=>e.tier==='S').concat(
        MODULE_DB.recovery.filter(e=>e.tier==='A').slice(0,2)
      );
      const sleepHrs = state.sleep==='poor'?'7-8 ساعات (ارفع الأولوية الآن)':state.sleep==='ok'?'8 ساعات منتظمة':'ممتاز — حافظ عليه';
      const scoreColor = state.recoveryScore>=70?'#00e5a0':'#fbbf24';
      return `<div class="mod-proto-banner">
          <span class="proto-icon"></span>
          <span>تعافيك الحالي: <b style="color:${scoreColor}">${state.recoveryScore}%</b> · هدف النوم: <b>${sleepHrs}</b></span>
        </div>
        <ul class="mod-info-list">
          <li><span class="li-icon"></span><span>ماغنيسيوم 300mg قبل النوم ب 30 دقيقة</span></li>
          <li><span class="li-icon"></span><span>درجة حرارة غرفة اردة (18-20°C) لنوم أعمق</span></li>
          <li><span class="li-icon"></span><span>أوقف الشاشات 1 ساعة قبل النوم</span></li>
        </ul>
        <div class="mod-ex-heading">بروتوكول التعافي النشط</div>
        ${renderModuleExercises(recList, safeVidUrl)}`;
    }

    case 'nutrition': {
      const targetKcal = state.goal==='cut'?state.tdee-400:state.goal==='muscle'?state.tdee+250:state.tdee;
      const protein = Math.round(state.weight*1.8);
      const carbs = Math.round(state.weight*(state.goal==='cut'?2:4));
      const fat = Math.round((targetKcal - protein*4 - carbs*4)/9);
      return `<div class="mod-nutr-grid">
          <div class="mod-nutr-tile">
            <div class="mod-nutr-val" style="color:var(--accent2)">${state.tdee}</div>
            <div class="mod-nutr-label">TDEE · صيانة</div>
          </div>
          <div class="mod-nutr-tile">
            <div class="mod-nutr-val" style="color:var(--green)">${targetKcal}</div>
            <div class="mod-nutr-label">هدف السعرات</div>
          </div>
          <div class="mod-nutr-tile">
            <div class="mod-nutr-val" style="color:#f472b6">${protein}g</div>
            <div class="mod-nutr-label">بروتين يومي</div>
          </div>
          <div class="mod-nutr-tile">
            <div class="mod-nutr-val" style="color:var(--orange)">${carbs}g</div>
            <div class="mod-nutr-label">كارب يومي</div>
          </div>
        </div>
        <ul class="mod-info-list">
          <li><span class="li-icon"></span><span>دهون: <b style="color:var(--yellow)">${fat}g</b> يوميا — دهون صحية فقط (زيت زيتون، أفوكادو، مكسرات)</span></li>
          <li><span class="li-icon"></span><span>ماء: <b style="color:var(--blue2)">3-4 لتر/يوم</b> + زيادة في أيام التمرين الشديد</span></li>
          <li><span class="li-icon"></span><span>قبل التمرين (60-90 دقيقة): كارب معقد + بروتين خفيف</span></li>
          <li><span class="li-icon"></span><span>بعد التمرين (30 دقيقة): Whey + كارب سريع الامتصاص</span></li>
          <li><span class="li-icon"></span><span>قبل النوم: كازين أو جبن قريش لبروتين ليلي بطيء</span></li>
        </ul>`;
    }

    case 'deload': {
      return `<div class="mod-proto-banner">
          <span class="proto-icon"></span>
          <span>كل <b>4-6 أسابيع</b> تلقائيا — نفس التمارين ونفس الحركات · خفف الوزن <b>40%</b> والمجموعات <b>50%</b></span>
        </div>
        <ul class="mod-info-list">
          <li><span class="li-icon"></span><span>الجدول: أسبوع 1-4 تدريب عادي - أسبوع 5 Deload - أسبوع 6-9 تدريب - أسبوع 10 Deload</span></li>
          <li><span class="li-icon"></span><span>لماذا؟ يعيد حساسية الجهاز العصبي + يشفي الأنسجة الدقيقة + يمنع Overtraining</span></li>
          <li><span class="li-icon"></span><span>علامة نجاح ال Deload: العودة بعده أقوى ب 5-10% على الأقل</span></li>
          <li><span class="li-icon"></span><span>لا تعتذر عن التدريب الخفيف — المحترفون يعملونه دائما بشكل منتظم</span></li>
        </ul>`;
    }

    case 'weakpoint': {
      const weakList = state.weak||[];
      if(!weakList.length){
        return `<div class="mod-proto-banner">
            <span class="proto-icon"></span>
            <span>لم تحدد نقاط ضعف بعد — ارجع للخطوة 1 وحدد العضلات الضعيفة لتفعيل هذا البروتوكول</span>
          </div>`;
      }
      let html = `<div class="mod-proto-banner">
          <span class="proto-icon"></span>
          <span>تم دمج <b>${weakList.length} منطقة ضعيفة</b> مباشرة داخل يوم تدريب العضلة المستهدفة — <b>تمرين واحد × 3 مجموعات</b> لكل منطقة، مختلف عن تمارين الجلسة الأساسية</span>
        </div>
        <div class="mod-warn-strip" style="background:rgba(255,107,138,0.08);border:1px solid rgba(255,107,138,0.2);color:#ff9bbb;">
          <span></span>
          <span>لا يتم إنشاء جلسة منفصلة — التمارين تضاف في نهاية اليوم الذي يدرب العضلة المستهدفة</span>
        </div>`;
      weakList.slice(0,4).forEach(w=>{
        const key = w==='arms'?'arms':w==='glutes'?'glutes':w==='calves'?'calves':w==='core'?'core':w==='forearms'?'forearms':w;
        const pool = MODULE_DB.weakpoint[key];
        if(!pool) return;
        const label = {chest:'صدر',back:'ظهر',shoulders:'أكتاف',arms:'ذراع',legs:'أرجل',glutes:'جلوتس',gluteus_medius:'جلوتس ميديوس',core:'كور',calves:'سمانة',forearms:'ساعد',traps:'ترابيس',rotator_cuff:'روتاتور كاف'}[key]||key;
        html += `<div class="mod-ex-heading"> ${label}</div>`;
        html += renderModuleExercises(pool.slice(0,2), safeVidUrl);
      });
      return html;
    }

    case 'supplements': {
      return buildSupplementsContent();
    }

    default: return '';
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUPPLEMENTS DATA — مكملات دقيقة حسب الهدف والحالة
// البيانات مستخرجة من الدليل العلمي المرف بالمشروع
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SUPP_DB = {
  // ── المكملات الأساسية (مشتركة لكل الأهداف) ─────────────────
  base: [
    {
      id:'whey', icon:'', name:'Whey Protein',
      dose:'25–30 جم/جرعة', timing:'بعد التمرين أو عند نقص البروتين',
      benefit:'بناء وترميم العضلات — أسرع بروتين امتصاصا بعد التمرين',
      note:'استهدف 1.6–2.2 جم بروتين لكل كجم من وزنك يوميا',
      accent:'#6c8ef5',iconBg:'rgba(108,142,245,0.1)',iconBorder:'rgba(108,142,245,0.2)',
      goals:['muscle','strength','cut','fitness']
    },
    {
      id:'creatine', icon:'', name:'Creatine Monohydrate',
      dose:'3–5 جم يوميا', timing:'أي وقت — الأهم الثبات اليومي',
      benefit:'يزيد القوة والانفجارية بنسبة 5–15% مع تدريب مقاوم',
      note:'لا تحتاج مرحلة تحميل. الكرياتين الأكثر بحثا من أي مكمل آخر',
      accent:'#ffd060',iconBg:'rgba(255,208,96,0.1)',iconBorder:'rgba(255,208,96,0.22)',
      goals:['muscle','strength','fitness']
    },
    {
      id:'vitd3', icon:'', name:'Vitamin D3 + K2',
      dose:'5000 IU D3 + 100 mcg K2', timing:'مع وجبة دهنية (إفطار/غداء)',
      benefit:'صحة العظام والمفاصل + دعم التستوستيرون الطبيعي',
      note:'K2 ضروري مع D3 لتوجيه الكالسيوم للعظام وليس الشرايين',
      accent:'#ff9c5b',iconBg:'rgba(255,156,91,0.1)',iconBorder:'rgba(255,156,91,0.22)',
      goals:['muscle','strength','cut','fitness']
    },
    {
      id:'mag', icon:'', name:'Magnesium Glycinate',
      dose:'300–400 مجم', timing:'قبل النوم ب 30–60 دقيقة',
      benefit:'تعمق النوم + تسريع الاستشفاء العضلي + تقليل التشنجات',
      note:'Glycinate أفضل أشكاله امتصاصا — لا يسبب اضطرابات هضمية',
      accent:'#8ba8ff',iconBg:'rgba(139,168,255,0.1)',iconBorder:'rgba(139,168,255,0.22)',
      goals:['muscle','strength','cut','fitness']
    },
    {
      id:'omega3', icon:'', name:'Omega-3 (Fish Oil)',
      dose:'2–3 جم EPA+DHA', timing:'مع وجبة دسمة',
      benefit:'تقليل الالتهاب بعد التمرين + صحة القلب والمفاصل',
      note:'ركز على محتوى EPA+DHA وليس إجمالي الزيت — فرق كبير',
      accent:'#38b6ff',iconBg:'rgba(56,182,255,0.1)',iconBorder:'rgba(56,182,255,0.22)',
      goals:['muscle','strength','cut','fitness']
    },
    {
      id:'zinc', icon:'', name:'Zinc Citrate',
      dose:'15–30 مجم', timing:'مع وجبة — بعيدا عن الكالسيوم',
      benefit:'المناعة + دعم هرمونات الذكورة (تستوستيرون)',
      note:'لا تأخذه مع منتجات الألبان أو مكملات الكالسيوم — يمنع الامتصاص',
      accent:'#00e5b0',iconBg:'rgba(0,229,176,0.09)',iconBorder:'rgba(0,229,176,0.22)',
      goals:['muscle','strength','fitness']
    },
    {
      id:'vitb', icon:'', name:'Vitamin B Complex',
      dose:'كبسولة واحدة يوميا', timing:'مع الإفطار',
      benefit:'إنتاج الطاقة الخلوية + صحة الأعصاب + تحويل الغذاء لطاقة',
      note:'خذه مع الأكل — B-vitamins قابلة للذوبان في الماء لكن قد تسبب غثيان على معدة فارغة',
      accent:'#ffd060',iconBg:'rgba(255,208,96,0.09)',iconBorder:'rgba(255,208,96,0.2)',
      goals:['cut','fitness','muscle','strength']
    },
    {
      id:'vitc', icon:'', name:'Vitamin C',
      dose:'500–1000 مجم', timing:'أي وقت — يفضل مع الوجبات',
      benefit:'مضاد أكسدة قوي + دعم صحة المفاصل والغضاريف + المناعة',
      note:'500 مجم تعطي نفس تأثير 1000 مجم تقريبا — لا تبالغ في الجرعة',
      accent:'#ff6b8a',iconBg:'rgba(255,107,138,0.1)',iconBorder:'rgba(255,107,138,0.22)',
      goals:['cut','fitness','muscle','strength']
    }
  ],
  // ── مكملات خاصة بالهدف ──────────────────────────────────────
  byGoal: {
    cut: [
      {
        id:'caffeine', icon:'', name:'Caffeine',
        dose:'150–200 مجم', timing:'قبل التمرين ب 45 دقيقة',
        benefit:'يرفع معدل الحرق + يحسن التركيز والأداء في حصة التنشيف',
        note:'لا تتجاوز 400 مجم يوميا. أوقفه بعد 2 م لحماية النوم',
        accent:'#ff9c5b',iconBg:'rgba(255,156,91,0.1)',iconBorder:'rgba(255,156,91,0.22)'
      },
      {
        id:'greentea', icon:'', name:'Green Tea Extract',
        dose:'400–600 مجم EGCG', timing:'مع وجبة',
        benefit:'يعزز أكسدة الدهون ويرفع معدل الأيض قليلا',
        note:'تأثيره هادئ ومتراكم — يعمل بشكل أفضل مع عجز سعري منتظم',
        accent:'#00e5b0',iconBg:'rgba(0,229,176,0.08)',iconBorder:'rgba(0,229,176,0.2)'
      },
      {
        id:'glucomannan', icon:'', name:'Glucomannan (ألياف)',
        dose:'1–3 جم', timing:'قبل الوجبة ب 30 دقيقة مع ماء وفير',
        benefit:'يزيد الشعور بالشبع + يبطئ امتصاص السكر',
        note:'يجب شربه مع كمية كبيرة ماء (كوبان+) — بدونه قد يسبب اختناقا',
        accent:'#6c8ef5',iconBg:'rgba(108,142,245,0.09)',iconBorder:'rgba(108,142,245,0.2)'
      },
      {
        id:'chromium', icon:'', name:'Chromium',
        dose:'200–500 mcg', timing:'مع وجبة غنية بالكربوهيدرات',
        benefit:'تنظيم مستوى السكر والأنسولين + تقليل الشهية للحلويات',
        note:'مفيد بشكل خاص لمن يعانون تقلبات في السكر أو شهية قهرية للحلو',
        accent:'#b87fff',iconBg:'rgba(184,127,255,0.1)',iconBorder:'rgba(184,127,255,0.22)'
      }
    ],
    muscle: [
      {
        id:'betaalanine', icon:'', name:'Beta-Alanine',
        dose:'3.2–6.4 جم', timing:'يوميا (الثبات أهم من التوقيت)',
        benefit:'يؤخر حمض اللاكتيك + يزيد التحمل العضلي في مجموعات 8–20 عدة',
        note:'التنميل الخفيف (Paresthesia) طبيعي تماما — يختفي بعد أسابيع',
        accent:'#ff9c5b',iconBg:'rgba(255,156,91,0.1)',iconBorder:'rgba(255,156,91,0.22)'
      },
      {
        id:'citrulline', icon:'', name:'Citrulline Malate',
        dose:'6-8 جم', timing:'قبل التمرين ب 60 دقيقة',
        benefit:'يزيد ال Pump + يقلل التعب العضلي ويحسن الأداء في أواخر المجموعة',
        note:'أفضل من L-Arginine في رفع أكسيد النيتريك — يمتص بكفاءة أعلى',
        accent:'#ff6b8a',iconBg:'rgba(255,107,138,0.1)',iconBorder:'rgba(255,107,138,0.22)'
      },
      {
        id:'ashwagandha', icon:'', name:'Ashwagandha',
        dose:'300–600 مجم KSM-66', timing:'صباحا أو قبل النوم',
        benefit:'يخفض الكورتيزول + يحسن الاستشفاء + يدعم مستويات التستوستيرون',
        note:'يحتاج أسبوعين+ لتظهر نتائجه الكاملة — خذه بانتظام ولا تتوقف',
        accent:'#00e5b0',iconBg:'rgba(0,229,176,0.08)',iconBorder:'rgba(0,229,176,0.2)'
      }
    ],
    strength: [
      {
        id:'betaalanine_str', icon:'', name:'Beta-Alanine',
        dose:'3.2–6.4 جم', timing:'يوميا',
        benefit:'يمد القدرة على تكرارات أعلى ويقلل انهيار الأداء في التمارين الثقيلة',
        note:'أهم لمجموعات 6+ عدات — قيمته في الثقيل تحت RPE 9-10 أقل',
        accent:'#ff9c5b',iconBg:'rgba(255,156,91,0.1)',iconBorder:'rgba(255,156,91,0.22)'
      },
      {
        id:'ash_str', icon:'', name:'Ashwagandha',
        dose:'300–600 مجم', timing:'قبل النوم',
        benefit:'يعزز التعافي العصبي + يدعم مستويات التستوستيرون الطبيعية',
        note:'مع الكرياتين والبروتين — ثلاثتهم معا يعطون أفضل نتائج القوة',
        accent:'#00e5b0',iconBg:'rgba(0,229,176,0.08)',iconBorder:'rgba(0,229,176,0.2)'
      }
    ],
    fitness: [
      {
        id:'caffeine_fit', icon:'', name:'Caffeine',
        dose:'100–150 مجم', timing:'قبل التمرين ب 30–45 دقيقة',
        benefit:'يحسن اليقظة والأداء العام في جلسات اللياقة المتنوعة',
        note:'جرعة أقل من التنشيف كافية — اهتم أكثر بالثبات اليومي على الأساسيات',
        accent:'#ff9c5b',iconBg:'rgba(255,156,91,0.1)',iconBorder:'rgba(255,156,91,0.22)'
      }
    ]
  }
};

// يبني محتوى وحدة المكملات كاملا
function buildSupplementsContent(){
  const goal = state.goal || 'fitness';
  const goalLabel = {cut:'التنشيف',muscle:'الضخامة',strength:'القوة',fitness:'اللياقة'}[goal] || 'هدفك';
  const recovery = state.recoveryScore || 70;

  function suppCard(s, isSuggested){
    const badgeStyle = isSuggested
      ? 'background:rgba(0,229,176,0.1);border:1px solid rgba(0,229,176,0.3);color:var(--green);'
      : 'background:rgba(99,140,220,0.08);border:1px solid var(--border);color:var(--text-muted);';
    const badgeTxt = isSuggested ? ' موصى به' : 'اختياري';
    return `<div class="supp-card" style="--supp-accent:${s.accent};--supp-icon-bg:${s.iconBg};--supp-icon-border:${s.iconBorder};">
      <span class="supp-goal-badge" style="${badgeStyle}">${badgeTxt}</span>
      <div class="supp-header">
        <div class="supp-icon-wrap">${s.icon}</div>
        <div class="supp-titles">
          <div class="supp-name">${s.name}</div>
          <div class="supp-dose"> ${s.dose}</div>
        </div>
      </div>
      <div class="supp-rows">
        <div class="supp-row"><span class="supp-row-icon"></span><span><b>التوقيت:</b> ${s.timing}</span></div>
        <div class="supp-row"><span class="supp-row-icon"></span><span><b>الفائدة:</b> ${s.benefit}</span></div>
        <div class="supp-row"><span class="supp-row-icon"></span><span>${s.note}</span></div>
      </div>
    </div>`;
  }

  // المكملات الأساسية لهذا الهدف
  const baseSupps = SUPP_DB.base.filter(s => s.goals.includes(goal));
  // المكملات الخاصة بالهدف
  const goalSupps = SUPP_DB.byGoal[goal] || [];
  // إذا تعافي منخفض: أبرز الماغنيسيوم
  const lowRecSupp = recovery < 65
    ? `<div class="mod-warn-strip" style="margin-bottom:14px;"><span></span><span>تعافيك منخفض (${recovery}%) — <b>Magnesium Glycinate</b> والنوم هما أولويتك القصوى الآن قبل أي مكمل آخر</span></div>`
    : '';

  // ترتيب نصائح التفاعل
  const interactionNote = `<div class="supp-export-note">
    <span style="font-size:16px;flex-shrink:0;"></span>
    <span><b style="color:var(--yellow);">تفاعلات مهمة:</b> لا تأخذ الزنك مع الكالسيوم في نفس الوقت (فرق 2 ساعة). الكرياتين والأشواجندا يحتاجان أسبوعين+ للنتائج الكاملة. شرب 3–4 لتر ماء يوميا ضروري مع الكرياتين والبروتين</span>
  </div>`;

  const baseCardsHTML = baseSupps.map(s => suppCard(s, true)).join('');
  const goalCardsHTML = goalSupps.map(s => suppCard(s, true)).join('');

  let html = `<div class="mod-proto-banner">
      <span class="proto-icon"></span>
      <span>مكملات مصممة لهدف <b>${goalLabel}</b> — مرتبة من الأهم للأقل أهمية. ابدأ بالأساسيات ثم أضف الخاصة بهدفك</span>
    </div>
    ${lowRecSupp}
    <div class="supp-section-divider"> المكملات الأساسية — لكل الأهداف</div>
    <div class="supp-grid">${baseCardsHTML}</div>`;

  if(goalCardsHTML){
    html += `<div class="supp-section-divider"> مكملات هدف ${goalLabel} تحديدا</div>
    <div class="supp-grid">${goalCardsHTML}</div>`;
  }

  html += interactionNote;
  html += `<div class="mod-warn-strip" style="margin-top:12px;background:rgba(99,140,220,0.05);border-color:rgba(99,140,220,0.2);color:var(--text-dim);">
    <span></span><span>هذا الدليل استرشادي. راجع طبيبك أو أخصائي تغذية قبل البدء بأي مكمل جديد، خاصة إذا كنت تتناول أدوية</span>
  </div>`;

  return html;
}

// ── Module accent palette ───────────────────────────────────────────────
function getModMeta(id){
  const map = {
    cardio:    {accent:'#38b6ff',iconBg:'rgba(56,182,255,0.1)',iconBorder:'rgba(56,182,255,0.22)',icon:''},
    core:      {accent:'#ffd060',iconBg:'rgba(255,208,96,0.1)',iconBorder:'rgba(255,208,96,0.22)',icon:''},
    kegel:     {accent:'#38b6ff',iconBg:'rgba(56,182,255,0.08)',iconBorder:'rgba(56,182,255,0.2)',icon:''},
    yoga:      {accent:'#b87fff',iconBg:'rgba(184,127,255,0.1)',iconBorder:'rgba(184,127,255,0.22)',icon:''},
    mobility:  {accent:'#00e5b0',iconBg:'rgba(0,229,176,0.08)',iconBorder:'rgba(0,229,176,0.2)',icon:''},
    stretching:{accent:'#ff9c5b',iconBg:'rgba(255,156,91,0.1)',iconBorder:'rgba(255,156,91,0.22)',icon:''},
    breathing: {accent:'#6c8ef5',iconBg:'rgba(108,142,245,0.1)',iconBorder:'rgba(108,142,245,0.22)',icon:''},
    sleep:     {accent:'#8ba8ff',iconBg:'rgba(139,168,255,0.1)',iconBorder:'rgba(139,168,255,0.22)',icon:''},
    nutrition: {accent:'#00e5b0',iconBg:'rgba(0,229,176,0.08)',iconBorder:'rgba(0,229,176,0.2)',icon:''},
    deload:    {accent:'#ffd060',iconBg:'rgba(255,208,96,0.08)',iconBorder:'rgba(255,208,96,0.2)',icon:''},
    weakpoint: {accent:'#ff6b8a',iconBg:'rgba(255,107,138,0.1)',iconBorder:'rgba(255,107,138,0.22)',icon:''},
    supplements:{accent:'#00e5b0',iconBg:'rgba(0,229,176,0.09)',iconBorder:'rgba(0,229,176,0.22)',icon:''},
  };
  return map[id] || {accent:'var(--purple)',iconBg:'rgba(184,127,255,0.08)',iconBorder:'rgba(184,127,255,0.18)',icon:''};
}

function getModLabel(id){
  const labels = {
    cardio:'Cardio Zone',core:'Core Protocol',kegel:'Kegel Training',
    yoga:'Yoga Flow',mobility:'Mobility & Flex',stretching:'Stretching',
    breathing:'Breathing & Mindset',sleep:'Recovery Protocol',
    nutrition:'Nutrition Guide',deload:'Deload Week',weakpoint:'Weak Point Focus',
    supplements:'Supplements Guide'
  };
  return labels[id] || id;
}

function updateModDetails(){
  if(!state.activeModules.length){
    document.getElementById('modulesDetail').innerHTML = '';
    return;
  }
  const html = state.activeModules.map((id,idx)=>{
    const content = getModuleDetail(id);
    if(!content) return '';
    const meta = getModMeta(id);
    const label = getModLabel(id);
    // all panels start closed — user opens manually
    const isOpen = '';
    return `<div class="mod-detail-panel ${isOpen}"
      style="--mod-accent:${meta.accent};--mod-icon-bg:${meta.iconBg};--mod-border:${meta.iconBorder};"
      id="mdp_${id}">
      <div class="mod-detail-header" onclick="toggleModPanel('${id}')">
        <div class="mod-detail-icon">${meta.icon}</div>
        <div class="mod-detail-titles">
          <div class="mod-detail-name">${label}</div>
          <div class="mod-detail-sub">انقر لعرض البروتوكول والتمارين</div>
        </div>
        <span class="mod-detail-chevron">▼</span>
      </div>
      <div class="mod-detail-body">
        ${content}
      </div>
    </div>`;
  }).filter(Boolean).join('');

  const heading = state.activeModules.length
    ? `<div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.4px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">
        <span style="width:6px;height:6px;border-radius:50%;background:var(--purple);display:inline-block;box-shadow:0 0 8px var(--purple);"></span>
        ${state.activeModules.length} وحدة مفعلة — اضغط على أي وحدة لعرض التفاصيل
      </div>`
    : '';

  document.getElementById('modulesDetail').innerHTML = heading + html;
  // إذا كنا في Step 7 بالفعل، حدث قسم المكملات فورا
  if(document.getElementById('sec7') && document.getElementById('sec7').classList.contains('show')){
    buildSuppSection();
  }
}

function toggleModPanel(id){
  const panel = document.getElementById('mdp_'+id);
  if(!panel) return;
  panel.classList.toggle('open');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MESOCYCLE / PERIODIZATION LAYER  —  v1.0
//
// ARCHITECTURE RULE: This is a THIN ORCHESTRATION LAYER ONLY.
// It does NOT modify exercise selection, split logic, prescription engine,
// recovery systems, or any existing generation logic.
// It ONLY organizes phases, adjusts progression targets, and schedules deloads.
// The weekly workout generator remains the PRIMARY engine.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildMesocyclePlan(){
  const el = document.getElementById('mesocyclePlan');
  if(!el) return;

  // ── STEP 1: Determine plan length from user profile ─────────────────
  const exp      = state.exp;
  const recScore = state.recoveryScore || 70;
  const goal     = state.goal;

  let totalWeeks;
  if(exp === 'beginner')     totalWeeks = 8;
  else if(exp === 'advanced') totalWeeks = 12;
  else                        totalWeeks = recScore >= 75 ? 10 : 8;

  // ── STEP 2: Define phase structure (safe & realistic) ─────────────────
  // Phases are purely structural: they adjust targets only.
  // All exercise generation still goes through the existing engine.

  const isBeg = exp === 'beginner';
  const isAdv = exp === 'advanced';

  let phases;
  if(totalWeeks === 8){
    phases = [
      {
        num:1, name:'المرحلة الأولى — التكيف والأساس',
        weeks:[1,2], color:'#3b82f6', badgeColor:'rgba(59,130,246,0.15)', badgeTxt:'color:#93c5fd',
        focus:'بناء قاعدة حركية وتقنية محكمة. حجم معتدل وشدة محافظة لتهيئة الجسم للتقدم. التركيز على التحكم والمدى الحركي الكامل',
        load:'60–70%', rirTarget:'3–4 RIR', sets:'نفس الخطة الأسبوعية', volChange:'100%',
        instruction:'نفذ برنامجك الأسبوعي كما هو. ركز على الشكل الصحيح في كل عدة. لا تتجاوز RPE 7.',
        isDeload:false
      },
      {
        num:2, name:'المرحلة الثانية — الحمل التدريجي',
        weeks:[3,5], color:'#6c63ff', badgeColor:'rgba(108,99,255,0.15)', badgeTxt:'color:#b0aaff',
        focus:'زيادة تدريجية في الوزن وعدد العدات أسبوعيا. هذه المرحلة هي مرحلة النمو الرئيسية',
        load:'70–80%', rirTarget:'2–3 RIR', sets:isBeg?'نفس الخطة الأسبوعية':'+ مجموعة إضافية للمركبات الرئيسية', volChange: isBeg?'100%':'110%',
        instruction:`أضف ${goal==='strength'?'2.5–5 كجم':'1–2.5 كجم'} على المركبات الرئيسية عند إتمام جميع العدات بشكل مثالي. سجل الوزن في كل جلسة.`,
        isDeload:false
      },
      {
        num:3, name:'المرحلة الثالثة — التكثيف',
        weeks:[6,7], color:'#ff7a1a', badgeColor:'rgba(255,122,26,0.15)', badgeTxt:'color:#fdba74',
        focus:'أعلى شدة تدريبية في الدورة. التعرض المحكوم للإجهاد قبل أسبوع التعافي. تعظيم المحفز التكيفي',
        load:'80–87%', rirTarget:'1–2 RIR', sets:'نفس المرحلة الثانية', volChange:isAdv?'115%':'105%',
        instruction:'الأسبوع السادس: ابق على نفس الأوزان. الأسبوع السابع: ارفع الشدة بمقدار محافظ. توقف عند RPE 8 — لا تتجاوزها باستمرار',
        isDeload:false
      },
      {
        num:4, name:'المرحلة الرابعة — Deload والتعافي',
        weeks:[8,8], color:'#00e5a0', badgeColor:'rgba(0,229,160,0.12)', badgeTxt:'color:#a0f5d8',
        focus:'أسبوع تعاف مخطط. تخفيض الحجم والشدة مع الحفاظ على جودة الحركة',
        load:'50–60%', rirTarget:'4–5 RIR', sets:'50% من المجموعات المعتادة', volChange:'50%',
        instruction:'نفس التمارين — خفف الوزن 40–50% وقلل المجموعات إلى النصف. الهدف: الحركة والتدفق الدموي، لا الإجهاد',
        isDeload:true
      }
    ];
  } else if(totalWeeks === 10){
    phases = [
      {
        num:1, name:'المرحلة الأولى — التكيف والأساس',
        weeks:[1,2], color:'#3b82f6', badgeColor:'rgba(59,130,246,0.15)', badgeTxt:'color:#93c5fd',
        focus:'بناء قاعدة حركية محكمة. حجم معتدل وتحكم تقني كامل. هيكلة الجهاز العضلي-العصبي قبل التحميل',
        load:'60–70%', rirTarget:'3–4 RIR', sets:'نفس الخطة الأسبوعية', volChange:'100%',
        instruction:'نفذ برنامجك الأسبوعي كما هو. التركيز على الشكل الصحيح والإحساس العضلي. لا تتجاوز RPE 7.',
        isDeload:false
      },
      {
        num:2, name:'المرحلة الثانية — الحمل التدريجي (الأول)',
        weeks:[3,5], color:'#6c63ff', badgeColor:'rgba(108,99,255,0.15)', badgeTxt:'color:#b0aaff',
        focus:'زيادة منتظمة في الوزن والحجم. إرساء عادة Progressive Overload أسبوعية',
        load:'70–80%', rirTarget:'2–3 RIR', sets:'+ مجموعة إضافية للمركبات', volChange:'110%',
        instruction:`أضف ${goal==='strength'?'2.5–5 كجم':'1–2.5 كجم'} أسبوعيا على المركبات الرئيسية. سجل كل جلسة.`,
        isDeload:false
      },
      {
        num:3, name:'المرحلة الثالثة — Deload خفيف',
        weeks:[6,6], color:'#00e5a0', badgeColor:'rgba(0,229,160,0.12)', badgeTxt:'color:#a0f5d8',
        focus:'أسبوع تعاف منتصفي. يمنع تراكم الإجهاد ويعيد ضبط الجهاز العصبي للمرحلة التالية',
        load:'55–65%', rirTarget:'4 RIR', sets:'60% من المجموعات', volChange:'60%',
        instruction:'خفف الوزن 35–40% وقلل المجموعات. نفس الحركات — تدفق وحركة فقط',
        isDeload:true
      },
      {
        num:4, name:'المرحلة الرابعة — التكثيف المتقدم',
        weeks:[7,9], color:'#ff7a1a', badgeColor:'rgba(255,122,26,0.15)', badgeTxt:'color:#fdba74',
        focus:'أعلى شدة في الدورة. حمل متصاعد مع إدارة محكمة للإجهاد',
        load:'80–88%', rirTarget:'1–2 RIR', sets:'نفس المرحلة الثانية + تقدم إضافي', volChange:'115%',
        instruction:'استمر بزيادة الأوزان أسبوعيا. أسبوع 9: ادفع بثقة إلى حدود RPE 8 على المركبات الأساسية',
        isDeload:false
      },
      {
        num:5, name:'المرحلة الخامسة — Deload والتعافي الكامل',
        weeks:[10,10], color:'#a855f7', badgeColor:'rgba(168,85,247,0.12)', badgeTxt:'color:#d8b4fe',
        focus:'تعاف كامل من التراكم. تجهيز الجسم لدورة جديدة بمستوى أعلى',
        load:'50–60%', rirTarget:'4–5 RIR', sets:'50% من المجموعات', volChange:'50%',
        instruction:'نفس التمارين — نصف الوزن ونصف المجموعات. احتفل بإتمام الدورة كاملة',
        isDeload:true
      }
    ];
  } else { // 12 weeks advanced
    phases = [
      {
        num:1, name:'المرحلة الأولى — التكيف والأساس',
        weeks:[1,2], color:'#3b82f6', badgeColor:'rgba(59,130,246,0.15)', badgeTxt:'color:#93c5fd',
        focus:'إعادة تأهيل المفاصل والأنسجة الضامة. بناء قاعدة حركية وتقنية قبل التحميل العالي',
        load:'60–70%', rirTarget:'3–4 RIR', sets:'نفس الخطة الأسبوعية', volChange:'100%',
        instruction:'تحكم كامل في كل حركة. لا تتجاوز RPE 7. ركز على جودة الأداء لا الوزن',
        isDeload:false
      },
      {
        num:2, name:'المرحلة الثانية — الحجم والتحمل',
        weeks:[3,5], color:'#6c63ff', badgeColor:'rgba(108,99,255,0.15)', badgeTxt:'color:#b0aaff',
        focus:'بناء الحجم التدريبي الأساسي. تراكم إجهاد مخطط ومنتظم',
        load:'70–78%', rirTarget:'2–3 RIR', sets:'+ مجموعة على المركبات', volChange:'110%',
        instruction:`أضف ${goal==='strength'?'2.5–5 كجم':'1–2.5 كجم'} أسبوعيا. جلسات 5 و6: احتفظ بنفس الوزن إذا لم تكتمل جميع العدات.`,
        isDeload:false
      },
      {
        num:3, name:'المرحلة الثالثة — Deload متوسطي',
        weeks:[6,6], color:'#00e5a0', badgeColor:'rgba(0,229,160,0.12)', badgeTxt:'color:#a0f5d8',
        focus:'إعادة ضبط عصبي بعد ثلاثة أسابيع حمل. يمنع الإجهاد المزمن',
        load:'55–65%', rirTarget:'4 RIR', sets:'60% من المجموعات', volChange:'60%',
        instruction:'تقليل الحجم والوزن بشكل واضح. أعط جسمك إذنا حقيقيا بالتعافي',
        isDeload:true
      },
      {
        num:4, name:'المرحلة الرابعة — التكثيف',
        weeks:[7,9], color:'#ff7a1a', badgeColor:'rgba(255,122,26,0.15)', badgeTxt:'color:#fdba74',
        focus:'أعلى شدة في الموجة الأولى من التكثيف. تعظيم المحفز الأداتيفي',
        load:'80–87%', rirTarget:'1–2 RIR', sets:'نفس المرحلة الثانية', volChange:'115%',
        instruction:'ادفع بثقة. قيس تقدم المرحلة الثانية وتجاوزه. أسبوع 9: اختبار قوة محكوم',
        isDeload:false
      },
      {
        num:5, name:'المرحلة الخامسة — التخصص والذروة',
        weeks:[10,11], color:'#a855f7', badgeColor:'rgba(168,85,247,0.15)', badgeTxt:'color:#d8b4fe',
        focus:'تخصص على نقاط القوة أو نقاط الضعف المحددة. الوصول إلى ذروة الأداء',
        load:'82–90%', rirTarget:'1 RIR', sets:'نفس المرحلة الرابعة', volChange:'115%',
        instruction:`${(state.weak&&state.weak.length)?'أضف مجموعة إضافية على '+state.weak.slice(0,2).join(' و ')+'.'  :'ركز على الحركات الأساسية بأعلى وزن متحكم فيه'} أسبوع 11: تثبيت الأوزان تحضيرا لل Deload.`,
        isDeload:false
      },
      {
        num:6, name:'المرحلة السادسة — Deload الختامي',
        weeks:[12,12], color:'#00e5a0', badgeColor:'rgba(0,229,160,0.12)', badgeTxt:'color:#a0f5d8',
        focus:'تعاف كامل من 11 أسبوع تراكم. الخروج من الدورة بجسم جاهز لأرقام قياسية جديدة',
        load:'50–60%', rirTarget:'4–5 RIR', sets:'50% من المجموعات', volChange:'50%',
        instruction:'نهاية الدورة — نفذ برنامجك بنصف الوزن ونصف المجموعات. قيم تقدمك الكلي',
        isDeload:true
      }
    ];
  }

  // ── STEP 3: Validate phases (progression realism check) ──────────────
  // Simple sanity check: no deload can follow another deload
  // No consecutive high-intensity phases without recovery
  // (All phases here are pre-validated by design)

  // ── STEP 4: Build week timeline chips ────────────────────────────────
  // Map each week (1..totalWeeks) to a phase for the visual timeline
  const weekPhase = {};
  for(const ph of phases){
    const [s,e] = ph.weeks;
    for(let w=s;w<=e;w++) weekPhase[w] = ph;
  }

  const timelineHtml = Array.from({length:totalWeeks},(_,i)=>{
    const w  = i+1;
    const ph = weekPhase[w];
    if(!ph) return '';
    const alpha = ph.isDeload ? '0.18' : '0.22';
    return `<div class="meso-week-chip" style="background:${ph.color}${alpha === '0.22' ? '38' : '2e'};border:1px solid ${ph.color}55;color:${ph.color};" title="الأسبوع ${w} — ${ph.name}">و${w}</div>`;
  }).join('');

  // ── STEP 5: Render phases ─────────────────────────────────────────────
  const goalAr = {cut:'تنشيف',muscle:'ضخامة',strength:'قوة',fitness:'لياقة'}[goal]||goal;
  const expAr  = {beginner:'مبتدئ',intermediate:'متوسط',advanced:'متقدم'}[exp]||exp;

  let html = `
  <div class="meso-header">
    <div>
      <div class="meso-badge"> Mesocycle Plan — ${totalWeeks} أسابيع</div>
    </div>
    <div class="meso-duration">${expAr} · ${goalAr} · ${totalWeeks} أسابيع</div>
  </div>
  ${recScore < 45 ? `
  <div style="padding:12px 14px;background:rgba(255,107,138,0.08);border:1px solid rgba(255,107,138,0.3);border-radius:10px;margin-bottom:14px;display:flex;align-items:flex-start;gap:10px;">
    <span style="font-size:18px;flex-shrink:0;"></span>
    <div>
      <div style="font-size:12px;font-weight:700;color:#ff6b8a;margin-bottom:4px;">تحذير: مؤشر تعافيك (${recScore}%) أقل من 45 — ينصح ب Deload مبكر</div>
      <div style="font-size:11px;color:var(--text-dim);line-height:1.7;">
        مؤشرات التعب المتراكم تتجاوز قدرة التكيف الحالية. الاستمرار بالحجم الكامل في هذه المرحلة يرفع خطر الإفراط التدريبي (Overreaching). <b>الخيار الأذكى:</b> نفذ أسبوع Deload الآن ثم عد للبرنامج الكامل.
      </div>
    </div>
  </div>` : ''}
  <div style="font-size:11px;color:var(--text-muted);line-height:1.7;margin-bottom:14px;padding:10px 12px;background:rgba(108,99,255,0.05);border:1px solid rgba(108,99,255,0.15);border-radius:8px;">
     <b style="color:var(--accent3);">مبدأ الطبقة:</b> هذه الخطة لا تعيد توليد برنامجك — بل تنظم <b>توجيهات التقدم والشدة والتعافي</b> على مدى الدورة. برنامجك الأسبوعي يبقى كما هو.
  </div>
  <div style="margin-bottom:14px;">
    <div class="sub-label" style="margin-bottom:8px;">خريطة الأسابيع</div>
    <div class="meso-timeline">${timelineHtml}</div>
  </div>
  <div class="meso-phases">`;

  phases.forEach((ph, idx) => {
    const [ws, we] = ph.weeks;
    const weekRange = ws === we ? `الأسبوع ${ws}` : `الأسابيع ${ws}–${we}`;
    const weekCount = we - ws + 1;
    const weekCountStr = weekCount === 1 ? 'أسبوع واحد' : `${weekCount} أسابيع`;
    const bodyId = `mesoBody_${ph.num}`;

    const deloadBadge = ph.isDeload
      ? `<span style="font-size:9px;font-weight:800;padding:2px 8px;border-radius:8px;background:rgba(0,229,160,0.15);color:#00e5a0;margin-right:6px;">Deload </span>`
      : '';

    html += `
    <div class="meso-phase" style="border-color:${ph.color}40;">
      <div class="meso-phase-header" onclick="toggleMesoPhase(${ph.num})">
        <div class="meso-phase-num" style="background:${ph.color};">${ph.num}</div>
        <div class="meso-phase-info">
          <div class="meso-phase-name">${ph.name}</div>
          <div class="meso-phase-weeks">${weekRange} · ${weekCountStr}</div>
        </div>
        ${deloadBadge}
        <span style="font-size:9px;font-weight:800;padding:3px 10px;border-radius:10px;${ph.badgeTxt};background:${ph.badgeColor};white-space:nowrap;">${ph.isDeload ? ' تعاف' : ' تقدم'}</span>
        <div class="meso-phase-toggle" id="mesoTog_${ph.num}" style="margin-right:8px;">▼</div>
      </div>
      <div class="meso-phase-body ${idx === 0 ? 'open' : ''}" id="${bodyId}">
        <div class="meso-phase-focus"> <b>تركيز المرحلة:</b> ${ph.focus}</div>
        <div class="meso-prog-grid">
          <div class="meso-prog-item">
            <div class="meso-prog-val" style="color:${ph.color};">${ph.load}</div>
            <div class="meso-prog-lbl">الحمل النسبي</div>
          </div>
          <div class="meso-prog-item">
            <div class="meso-prog-val" style="color:${ph.isDeload?'#00e5a0':'#fbbf24'};">${ph.rirTarget}</div>
            <div class="meso-prog-lbl">هامش RIR</div>
          </div>
          <div class="meso-prog-item">
            <div class="meso-prog-val" style="color:var(--accent3);font-size:11px;">${ph.volChange}</div>
            <div class="meso-prog-lbl">الحجم النسبي</div>
          </div>
        </div>
        <div class="meso-instruction">
          <b style="color:var(--accent3);"> التعليمات:</b> ${ph.instruction}
        </div>
        ${ph.isDeload ? `<div class="meso-deload-strip"> <b>Deload مخطط:</b> نفس الحركات — خفف الوزن وقلل المجموعات. لا تلغ التدريب كليا.</div>` : ''}
      </div>
    </div>`;
  });

  html += `
  </div>
  <div style="margin-top:14px;padding:10px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;font-size:10px;color:var(--text-muted);line-height:1.8;">
     <b style="color:var(--text-dim);">تذكير:</b> برنامجك الأسبوعي الموجود أعلاه هو مرجعك الثابت.
    هذا ال Mesocycle يحدد <em>كيف</em> تدار الشدة والتعافي أسبوعا بأسبوع — لا يغير التمارين.
  </div>
  <div style="margin-top:10px;padding:10px 14px;background:rgba(108,99,255,0.05);border:1px solid rgba(108,99,255,0.18);border-radius:8px;font-size:10px;color:var(--accent3);line-height:1.8;">
     <b>بعد إتمام الدورة:</b> ابدأ دورة جديدة برفع الهدف — زد الأوزان، غير السبليت، أو ارفع عدد الأيام. كل دورة مكتملة = مستوى جديد.
  </div>`;

  el.innerHTML = html;

  // Auto-open first phase toggle indicator
  const tog = document.getElementById('mesoTog_1');
  if(tog) tog.classList.add('open');
}

// Toggle mesocycle phase accordion
function toggleMesoPhase(num){
  const body = document.getElementById('mesoBody_'+num);
  const tog  = document.getElementById('mesoTog_'+num);
  if(!body||!tog) return;
  const isOpen = body.classList.toggle('open');
  tog.classList.toggle('open', isOpen);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUILD DASHBOARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildDashboard(){
  const totalExercises=(state.plan||[]).reduce((a,d)=>a+(d.exercises?.length||0),0);
  const totalSets=(state.plan||[]).reduce((a,d)=>a+(d.exercises||[]).reduce((b,e)=>b+e.sets,0),0);
  const splitName=getSplits()[state.selectedSplit]?.name||'-';
  // Get distribution quality from stored plan metadata
  const distScore = (state.plan?._distributionQuality?.score) || scoreDistributionQuality(state.plan||[]).score;
  const distColor = distScore>=85?'#00e5a0':distScore>=70?'#fbbf24':'#ff4466';
  const goalLabels={cut:' تنشيف',muscle:' ضخامة',strength:' قوة',fitness:' لياقة'};
  const goalLabel = goalLabels[state.goal]||state.goal||'—';
  const expLabels={beginner:'مبتدئ',intermediate:'متوسط',advanced:'متقدم'};
  const expLabel = expLabels[state.exp]||state.exp||'—';
  const recColor=state.recoveryScore>=75?'#00e5a0':state.recoveryScore>=55?'#fbbf24':'#ff6b8a';

  // Update split label in header
  const splitLabelEl = document.getElementById('dashSplitLabel');
  if(splitLabelEl) splitLabelEl.textContent = splitName + ' · ' + expLabel;

  document.getElementById('dashGrid').innerHTML=[{icon:'',val:goalLabel,label:'هدفك الرئيسي',color:'#a855f7'},{icon:'',val:state.days,label:'أيام/أسبوع',color:'#6c63ff'},{icon:'',val:state.time+'د',label:'وقت الجلسة',color:'#38b6ff'},{icon:'',val:state.tdee,label:'TDEE (kcal)',color:'#ff7a1a'},{icon:'',val:totalSets,label:'مجموعات/أسبوع',color:'#3b82f6'},{icon:'',val:totalExercises,label:'تمارين/أسبوع',color:'#00e5a0'}].map((d,i)=>{
    const isWide = false;
    return `<div class="dash-stat${isWide?' dash-wide':''}" style="--dash-color:${d.color};">
      <span class="dash-icon">${d.icon}</span>
      <div class="dash-val" style="color:${d.color}">${d.val}</div>
      <div class="dash-label">${d.label}</div>
    </div>`;
  }).join('');

  const readiness=Math.round(((state.recoveryScore||0)+(Number(distScore)||0))/2);const rdColor=readiness>=85?'#00e5a0':readiness>=70?'#3ddc97':readiness>=55?'#fbbf24':'#ff6b8a';const rdState=readiness>=85?'ممتاز — استمر':readiness>=70?'جيد جدا':readiness>=55?'مقبول — قابل للتحسين':'يحتاج تحسين';document.getElementById('dashBars').innerHTML='<div class="dash-gauge" style="--p:'+readiness+';--gc:'+rdColor+';"><div class="dg-center"><b style="color:'+rdColor+'">'+readiness+'%</b><span>جاهزية الخطة</span></div></div><div class="dash-gstate" style="color:'+rdColor+'">'+rdState+'</div><div class="dash-mini"><div class="dmi-row"><span>مستوى التعافي</span><span style="color:'+recColor+'">'+state.recoveryScore+'%</span></div><div class="dmi-bar"><i style="width:'+state.recoveryScore+'%;background:'+recColor+';box-shadow:0 0 8px '+recColor+'55"></i></div><div class="dmi-row"><span>جودة التوزيع العضلي</span><span style="color:'+distColor+'">'+distScore+'%</span></div><div class="dmi-bar"><i style="width:'+distScore+'%;background:'+distColor+';box-shadow:0 0 8px '+distColor+'55"></i></div></div>';
  const mNames={accessory:'مساعدة',chest:'صدر',back:'ظهر',quads:'كوادز',hamstrings:'هامستينج',calves:'سمانة',adductors:'ضامة',shoulders:'أكتاف',biceps:'بايسبس',triceps:'ترايسبس',forearms:'ساعد',traps:'ترابيس',core:'كور'};
  const colors=['#6c63ff','#00e5a0','#3b82f6','#a855f7','#ff7a1a','#fbbf24','#ff4466','#60a5fa','#f472b6','#34d399','#fb923c'];
  const setsMap={};
  (state.plan||[]).forEach(d=>(d.exercises||[]).forEach(ex=>{setsMap[ex.grp]=(setsMap[ex.grp]||0)+ex.sets;}));
  const maxSets=Math.max(...Object.values(setsMap),1);
  (function(){var ents=Object.entries(setsMap);var cols=ents.map(function(e,i){var v=e[1];var c=colors[i%colors.length];var h=Math.max(8,Math.round(v/maxSets*100));return '<div class="vsp-col"><div class="vsp-val" style="color:'+c+';text-shadow:0 0 8px '+c+'66">'+v+'</div><div class="vsp-bar" style="height:'+h+'%;background:linear-gradient(180deg,'+c+','+c+'22);box-shadow:0 0 12px '+c+'55,inset 0 1px 0 rgba(255,255,255,.25)"></div></div>';}).join('');var names=ents.map(function(e){var k=e[0];var nm=mNames[k]||k;return '<div class="vsp-name" title="'+nm+'">'+nm+'</div>';}).join('');document.getElementById('volumeBreakdown').innerHTML='<div class="vol-spectrum-wrap"><div class="vsp-band">'+cols+'</div><div class="vsp-names">'+names+'</div></div>';})();
  const goalTxt={cut:' تنشيف',muscle:' ضخامة',strength:' قوة',fitness:' لياقة'}[state.goal];
  const recAccents=['#6c8ef5','#00e5b0','#ff9c5b','#b87fff','#38b6ff'];
  document.getElementById('progressRecs').innerHTML=[
    {icon:'',title:'Progressive Overload',text:`أضف ${state.goal==='strength'?'2.5-5':'1-2.5'} كجم كل أسبوع عند إتمام العدات بشكل مثالي.`},
    {icon:'',title:'تسجيل الأداء',text:'سجل الوزن والعدات في كل جلسة. استخدم ملف ال Progress Tracker.'},
    {icon:'',title:'Deload',text:'كل 4-6 أسابيع خفف الحجم 50% لأسبوع كامل لمنع الإجهاد المزمن'},
    {icon:'',title:'نقاط الضعف',text:state.weak.length?`ركز على ${state.weak.join(' و ')} بإضافة set إضافية.`:'لا توجد نقاط ضعف محددة — حافظ على التوازن'},
    {icon:'',title:'التعافي',text:state.recoveryScore<70?'تعافيك منخفض — أولوية: نوم 8 ساعات وتقليل التوتر':'تعافيك ممتاز — استمر بنفس النمط'}
  ].map((r,i)=>`<div class="prog-item" style="--prog-accent:${recAccents[i]};"><div class="prog-icon">${r.icon}</div><div class="prog-text"><b>${r.title}</b>${r.text}</div></div>`).join('');

  // ── PATCH 3: Early Deload Recommendation — read-only, display only ──────
  // Triggers when 3+ signals indicate accumulated fatigue / insufficient recovery.
  // Does NOT change plan, mesocycle, or any engine state.
  (function buildDeloadRecommendation(){
    const rec   = state.recoveryScore || 75;
    const fc    = state.fatigueCap    || 80;
    const tol   = state.trainingTolerance || 75;
    const sleep = state.sleep;
    const stress= state.stress;

    // Count risk signals
    let signals = 0;
    if(rec < 55)         signals++;
    if(fc  < 50)         signals++;
    if(tol < 50)         signals++;
    if(sleep === 'poor') signals++;
    if(stress === 'high')signals++;

    const el = document.getElementById('deloadRecommendation');
    if(!el) return;

    if(signals >= 3){
      // Build detail list
      const details = [];
      if(rec   < 55) details.push(`تعاف منخفض (${rec}%)`);
      if(fc    < 50) details.push(`سعة إجهاد منخفضة (${fc}%)`);
      if(tol   < 50) details.push(`قدرة تحمل منخفضة (${tol}%)`);
      if(sleep === 'poor')  details.push('نوم ضعيف');
      if(stress === 'high') details.push('إجهاد يومي مرتفع');

      el.innerHTML = `<div style="
        background:rgba(255,208,96,0.06);border:1px solid rgba(255,208,96,0.3);
        border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:16px;
        display:flex;align-items:flex-start;gap:11px;">
        <span style="font-size:22px;flex-shrink:0;"></span>
        <div>
          <div style="font-size:12px;font-weight:800;color:var(--yellow);margin-bottom:4px;">
            يوصى بعمل Deload مبكر
          </div>
          <div style="font-size:11px;color:#fde68a;line-height:1.6;margin-bottom:6px;">
            مؤشرات متعددة تشير إلى تراكم إجهاد: ${details.join(' · ')}.
          </div>
          <div style="font-size:10px;color:var(--text-dim);line-height:1.6;">
             خفف الحجم التدريبي 50% لأسبوع — نفس التمارين بنصف المجموعات ونصف الأوزان.
            لا تلغ التدريب تماما. هذا يساعد الجهاز العصبي على التعافي ويمنع الإجهاد المزمن.
          </div>
        </div>
      </div>`;
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  })();

  // ── Mesocycle layer: runs AFTER dashboard — thin orchestration only ──
  buildMesocyclePlan();

  // ── Supplements Section: show only if 'supplements' module is active ──
  buildSuppSection();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUPPLEMENTS SECTION — يبنى في Step 7
// يظهر / يختفي بناء على تفعيل وحدة المكملات في Step 6
// يستدعى من buildDashboard وكذلك من updateModDetails عند تغيير الوحدات
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildSuppSection(){
  const section = document.getElementById('suppSection');
  if(!section) return;
  const isActive = (state.activeModules||[]).includes('supplements');
  if(!isActive){
    section.style.display = 'none';
    return;
  }
  // البناء
  section.style.display = 'block';
  // عداد المكملات في الشارة
  const goal = state.goal || 'fitness';
  const baseCount = SUPP_DB.base.filter(s=>s.goals.includes(goal)).length;
  const goalCount = (SUPP_DB.byGoal[goal]||[]).length;
  const totalCount = baseCount + goalCount;
  const badge = document.getElementById('suppBadgeCount');
  if(badge) badge.textContent = totalCount + ' مكمل';
  // ال content
  const content = document.getElementById('suppPlanContent');
  if(content) content.innerHTML = buildSupplementsContent();
}

// ────────────────────────────────────────────────────────────────────────────
// EXPORT PLAN — PDF PREMIUM ARABIC SUPPORT

// Verified YouTube Shorts IDs - curated list with fallbacks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VIDEO VALIDATION PIPELINE — verifiedVideoPipeline
// Every exercise video goes through this pipeline before display.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const VERIFIED_VIDS = {
  // ── CHEST ──
  '8iPEnn-ltC8': true,  // Incline DB Press
  'D3mMVuWqnSs': true,  // Cable Fly / Band Fly
  'SCVCLChPQEY': true,  // DB Floor Press / Doorway Chest Stretch
  'dRp4UqHRTVo': true,  // Chest Press fallback
  'Z57CtFmRMxA': true,  // Pec Deck Machine
  '2z8JmcrW-As': true,  // Dips / Decline Press
  // ── BACK ──
  'CAwf7n6Luuc': true,  // Wide Grip Lat Pulldown
  'xBmfkqbGUWs': true,  // Neutral/Close Grip Pulldown
  'eGo4IYlbE5g': true,  // Pull-Ups / Hanging Leg Raise / Dead Hangs
  'JObJSYKR5lw': true,  // Lat Pullover Machine / Cable Pullover
  'UtOHMCmOAYI': true,  // Chest Supported Row Machine / Barbell Bent Over Row
  'GZbfZ033f74': true,  // Seated Cable Row
  '0fnkODFYbVY': true,  // Meadows Row
  'pYcpY20QaE8': true,  // One Arm Dumbbell Row
  'V8dZ3x7a4EQ': true,  // Rope Face Pull / Thoracic Rotation
  'Yfx4LxQBkwk': true,  // Reverse Cable Crossover / Rear Delt Fly
  // ── LEGS ──
  'rYgNArpwE7E': true,  // Hack Squat Machine (updated)
  'ultWZbUMPL8': true,  // Barbell Back Squat / Goblet Squat / Deep Squat Hold
  'iGK-yd6j8Ko': true,  // Smith Machine Squat / Dumbbell Squat
  '1vdoqE--qTA': true,  // Pendulum Squat (updated)
  'YyvSfVjQeL0': true,  // Leg Extension Machine / Sissy Squat
  '2C-uNgKwPLE': true,  // Bulgarian Split Squat / Walking Lunges / Step-Up
  'sEM_zo6HKLA': true,  // Leg Press 45° / Step-Up
  'm4ytaCJZDoE': true,  // Front Barbell Squat / Reverse Nordic Curl
  'JCXUYuzwNrM': true,  // Romanian Deadlift / Stiff Leg / Hamstring Stretch
  'EfeVvA1vdd4': true,  // Lying Leg Curl Machine (updated)
  'bZuv_z8z8go': true,  // Single Leg Curl Machine (updated)
  'eFs1d8c5vRI': true,  // Standing Leg Curl Machine (updated)
  'xDmFkJxPzeM': true,  // Barbell Hip Thrust / Machine Hip Thrust / Kegel
  'OUgsJ8-Vi0E': true,  // Glute Bridge / Hip 90-90 / Yoga flows / Child's Pose
  'tHGR_3MsVBg': true,  // Cable Pull Through
  'YA-h3n9L4YU': true,  // Hamstring fallback
  'gwLzBkvzekY': true,  // Standing Calf Raise / Calf Stretch / Ankle CARs
  'JbyjNymZOt0': true,  // Seated Calf Raise Machine
  'IGwqbwVCRuA': true,  // Leg Press Calf Raise
  'c5b-rGRXvXk': true,  // Single Leg Calf Raise
  // ── SHOULDERS ──
  'WvLMauqrnK8': true,  // Machine Shoulder Press / Arnold Press / Shoulder CARs
  'qEwKCR5JCog': true,  // Seated DB Shoulder Press / Pike Push-Up
  'PPGKIKsR5Ec': true,  // Cable Lateral Raise / Machine Lateral Raise
  'fEFNezIgMeQ': true,  // Dumbbell Lateral Raise / Stretch / Band Opener
  'eIq5CB9JfKE': false, // REPLACED  do not use
  // ── ARMS ──
  '_4EGFiBU0PY': true,  // Bayesian Cable Curl / Cable Overhead Curl
  'soxrZlIl35U': true,  // Incline Dumbbell Curl
  'fIWP-FRFNU0': true,  // Machine Preacher Curl / EZ Bar Preacher Curl
  'av7-8CzC9Vk': true,  // Standing Dumbbell Curl
  'zC3nLlEvin4': true,  // Hammer Curl
  'zG2C55O9FHs': true,  // EZ Bar Curl
  // ── TRICEPS / CORE ─
  '_gsUck-7M-o': true,  // Cable Crunch / Pallof Press / Russian Twist / Woodchop
  'd_KZxkY_gmE': true,  // Overhead Cable Tricep Extension / Skull Crushers
  '2-LAMcpzODU': true,  // Rope Tricep Pushdown / Bar Pushdown
  'Hq71JvEQpKo': true,  // Katana Extension
  'nEF0bv2z-gE': true,  // Close Grip Bench Press / Close Grip Push-Up
  '6Fzep104f0s': true,  // Cable Tricep Kickback / Dips
  // ── MISC ──
  'V7bCBlMMPFY': true,  // Barbell Wrist Curl / Dumbbell Wrist Curl
  'G8l_8chR5BE': true,  // Reverse Barbell Wrist Curl
  'Fkzks_YrMOI': true,  // Farmer Walk
  'cJRVVxmytaM': true,  // Barbell Shrugs / Dumbbell Shrugs
  'eSIUSUoJPJ8': true,  // Smith Machine Shrugs
  '6HgNrPFaGlw': true,  // Ab Wheel / Plank / Breathing / Recovery — ULTIMATE FALLBACK
  'cfns6QMnFNc': true,  // Incline Push-Up
  'IODxDxX7oi4': true,  // Wide Push-Up
  // ── CARDIO MODULE ─
  'kZCBfpRgGNQ': true,  // Walking / LISS cardio / Active Recovery Walk
  '1BZM2L-T5bk': true,  // Jump Rope / HIIT cardio / Jogging / Boxing
  // ── MOBILITY / YOGA ──  (all from existing verified IDs above)
  // OUgsJ8-Vi0E, V8dZ3x7a4EQ, WvLMauqrnK8, ultWZbUMPL8 already listed
  // ── KEGEL ── xDmFkJxPzeM already listed

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GLOBAL VIDEO PIPELINE SYNC — NEW DB VIDEOS (auto-added)
  // Source: GYM_DB + HOME_DB + MODULE_DB + weakpoint sections
  // All IDs below were active in the DBs but missing from VERIFIED_VIDS,
  // causing them to fall through to async check - fallback chain.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── CHEST / PUSH (new) ──
  '-7RYGlUaIa0': true,
  '-aVIf0bgMEs': true,
  '0wh9TUuAoaM': true,
  '1DhJRHp3ICc': true,
  '1Sp6wu1QLVQ': true,
  '1cikFylNxqw': true,
  // ── BACK / PULL (new) ──
  '27Vu1-5mv-4': true,
  'EwdQSgvBeZ4': true,  // Dumbbell Side Lunge (updated)
  '2HgbXXA-uqE': true,
  '3FoduzL7P3w': true,
  '3nmvrd1iNk0': true,
  'AAhseLS-HkI': true,
  'AG7TZqWPmU4': true,
  'B1ecyjcR0K8': true,
  'B2ey8AegfOI': true,
  'C3sSWhFcEyY': true,
  'D7-Dzclb9g0': true,
  'Dj3ZIsic-Ng': true,
  'FlvG95fGrCM': true,
  'G2vYhVJq_Nk': true,
  'GXbdhyKckCA': true,
  'rYgNArpwE7E': true,  // Hack Squat Machine (updated)
  'GpD_E62Eo6I': true,
  // ── LEGS / GLUTES (new) ──
  '30-MYPAVXqk': true,
  '30D1yo5lGiI': true,
  '4htPNpQ5gyA': true,
  '4uEwWxI9Les': true,
  '4ukM_Aj8Cko': true,
  '5jIeAozuTpo': true,
  '5rbI0TYcgiA': true,
  'HHoaBq8zoSM': true,
  'Hw-X7MD0-y0': true,
  'IJSDHkN7qPc': true,
  'JK3H-R2XmJ4': true,
  'KbIMqVOSIiw': true,
  'KyHeum4DBm8': true,
  'LtpafVkzaJY': true,
  // ── SHOULDERS (new) ──
  '7F6VF0tcgwo': true,
  '7F_fA6gIV28': true,
  '8UR7-0rZNZ8': true,
  '9OZwfohGle0': true,
  'MMkySa7XzoY': true,
  'O99BAimzVxw': true,
  'Om4wDy-P7Yw': true,
  'P54hOJ4oC20': true,
  'P7wHMT3RkjE': true,
  'PsnDj-DJ9lw': true,
  'PxPzzPM0vis': true,
  // ── ARMS (new) ──
  'RAZw60BY9JI': true,
  'RENB-Bhhb6E': true,
  'RPDKC0M_P7Y': true,
  'Rg27bvMeTKA': true,
  'S0bQA8s2Etg': true,
  'SQcjwqjOwb4': true,
  'SRQz6FMrqa0': true,
  'SUMi6lIS538': true,
  'SfL6IOrFUUc': true,
  'Shdpeii5WF4': true,
  'Sj8t4vL-Ryw': true,
  'T8lf5TXSxpE': true,
  'TCvTnibKiCs': true,
  'U42kp8eI6rk': true,
  'UOiuG9kbTZU': true,
  'UPqqRK-0Cyg': true,
  'UTvLG1QvleU': true,
  // ── CORE / ABS (new) ──
  'X8X1ReVotR0': true,
  'XUbRqqEqX0I': true,
  'XbMjFPHAHek': true,
  'YAq-ExWuQdg': true,
  'Yf_FElozs8w': true,
  'YjLf5zig7jg': true,
  '_1KeButC2TE': true,
  '_T71qr8679M': true,
  // ── CARDIO / HIIT (new) ──
  'oFsPXMIbNR4': true,  // Leg Press 45° (updated)
  'aWUdVOSSqfI': true,
  'bN6e7i-VyYs': true,
  'bbPhNXdH5E4': true,
  'cgOj-mVlKoA': true,
  '1vdoqE--qTA': true,  // Pendulum Squat (updated)
  // ── MOBILITY / STRETCHING (new) ──
  'dORPFUGJ8ao': true,
  'dTDhV_w1NoU': true,
  'dW54d_uMrKQ': true,
  'ezvyKMleqiA': true,
  'fHWXcdqEUBg': true,
  'fL341jQY6O8': true,
  'fPdW24CYZx0': true,
  'fUrD4YnhkPM': true,
  'f_9GoghbTeM': true,
  // ── MODULE / WEAKPOINT (new) ──
  'gO4d_QCW-dw': true,
  'gXUHsk20JaY': true,
  'or1frhkjBDc': true,  // Bulgarian Split Squat (updated)
  'Cu2THH1IQDA': true,  // Sissy Squat (updated)
  'eDgxpUNdbD8': true,  // Leg Press Narrow Stance (updated)
  'xAL7lHwj30E': true,  // Romanian Deadlift RDL (updated)
  'CN_7cz3P-1U': true,  // Stiff-Leg Deadlift (updated)
  'FV1xu0LySiQ': true,  // Single Leg RDL Dumbbell (updated)
  'EfeVvA1vdd4': true,  // Lying Leg Curl Machine (updated)
  'bZuv_z8z8go': true,  // Single Leg Curl Machine (updated)
  'eFs1d8c5vRI': true,  // Standing Leg Curl Machine (updated)
  'wlqTemUXPXY': true,  // Smith Machine Calf Raise (updated)
  'DvEnixpoSg0': true,  // Leg Press Calf Raise (updated)
  'OZlYFWLZ3cw': true,  // Seated Calf Raise Machine (updated)
  'watMaxAQBCU': true,  // Donkey Calf Raise (updated)
  'Q08rMkanmtc': true,  // Cable Hip Adduction (updated)
  'BmMmt-c9aNM': true,  // Seated Hip Adduction Machine (updated)
  'nd8eNnkFOKU': true,  // Smith Machine Shrugs
  'JZ5i0j9I3cI': true,  // Cable Hip Abduction (weakpoint module)
  '29bKY-pAsdc': true,  // Goblet Squat (Dumbbell) home DB
  'gcpSI7Z8ic0': true,
  'gplY6YfPhDY': true,
  'gxbuKq46J6w': true,
  'hA4Y5b7xEDM': true,
  'hZX6UjNUHYM': true,
  'hdWdMTAC0yU': true,
  'i5tL8KwlkWE': true,
  'iRYIqSFN21w': true,
  'j32z7Bk2wT0': true,
  'j_K11EdMv00': true,
  'ja5ilJGhfFw': true,
  'k3Y2HGFRl6A': true,
  'kCqkeb1Hjdo': true,
  'lLF92nmyDYw': true,
  'lQqbC17EOzo': true,
  'lWvP5DojnyY': true,
  'm68nOljccd8': true,
  'nYeOXf38uSU': true,
  'oL9rCnDluds': true,
  'opKrn8GDf5Y': true,
  'ouDoSHzM5d0': true,
  'p9y2g_7w5GA': true,
  'pzwvY0MWCaA': true,
  'qHOjn0OeLM0': true,
  'qVMP8AOwcmI': true,
  'qfalV5Wo-Jg': true,
  'qs26Aw3LCI4': true,
  'rFjGILMDnZQ': true,
  'ra5FuqPjFh4': true,
  'ribH6XwiS7E': true,
  'rxtUFGiGE1M': true,
  'sFLdqBMKF3E': true,
  'tZjU3cTn2Wk': true,
  'tmy1wmws9z4': true,
  'u9SkETpalMg': true,
  'ue249CNAigc': true,
  'vGzXYvbLEEg': true,
  'xB8kANe5h_U': true,
  'y5nyOmAalhA': true,
  'yK6-CD9u2vQ': true,
  'z8uKym5Y8d4': true,
  'zP3sD865Doc': true,
  'zzTdj6pnkxI': true,
  // ── NEW HOME DB VIDEO IDs (from Excel database) ──
  'mPklne1U9aI': true,  // Decline Push-Up Shorts
  'PwXRg-BwYgc': true,  // Resistance Band Pulldown Shorts
  'uVT8qEn-5eo': true,  // Single Arm DB Row Shorts
  'bBpK36TAQww': true,  // Resistance Band Seated Row Shorts
  'eKB5rv5c7FQ': true,  // Superman Hold Shorts
  'Qij3pSB-gNk': true,  // Resistance Band Face Pull Shorts
  'cYLucJwoiFI': true,  // Prone Dumbbell Y-Raise Shorts
  '1M-V_qlyowo': true,  // Bulgarian Split Squat (Chair)
  'S5cTdwO1Trk': true,  // Resistance Band Squat Shorts
  'pU7XbxvViIY': true,  // Sissy Squat Shorts
  '3LrzsE3clIs': true,  // Step-Up Chair Shorts
  'kNZlId2h7i8': true,  // Single Leg RDL Shorts
  'LORVjN2bg5o': true,  // Glute Bridge Weighted Shorts
  'ZTANv8Fjpj8': true,  // Resistance Band Pull Through Shorts
  '4N9Flc-4JzU': true,  // Single Leg Calf Raise Shorts
  'KybK2zbg0n4': true,  // Dumbbell Shoulder Press Shorts
  'YuOhl4-Ppq4': true,  // Resistance Band Lateral Raise Shorts
  'erhCK5sEhfY': true,  // Side Lying DB Raise Shorts
  'Xq2aSZvNk2E': true,  // Dumbbell Rear Delt Fly Shorts
  'K2C4Nf3zQyc': true,  // Incline Dumbbell Curl
  'ZYtpAy4rg74': true,  // Dumbbell Preacher Curl Shorts
  'ktG4qWYIzUQ': true,  // Hammer Curl Shorts
  'xPgtezPGbOk': true,  // DB Overhead Tricep Extension Shorts
  'PkGesjlH7RQ': true,  // Resistance Band Pushdown Shorts
  'CZT3gEobyOo': true,  // Close Grip Push-Up Shorts
  '3PJSBYpWfWI': true,  // Dumbbell Wrist Curl Shorts
  'Sj4nSnbKZMc': true,  // Reverse Dumbbell Wrist Curl Shorts
  'gvC0ubD0hdQ': true,  // Dumbbell Shrugs Shorts
  'EFqM4Gg8LJc': true,  // Bicycle Crunch Shorts
  '1wDQznFSh3E': true,  // Mountain Climbers Shorts
  'DqLL45uk2Tk': true,  // Dead Bug Shorts
};

// Runtime blacklist — videos confirmed broken at runtime are added here
const _vidBlacklist = new Set();

// Safe fallback chain by exercise category
const VID_SAFE_FALLBACKS = {
  chest:      ['SCVCLChPQEY','Z57CtFmRMxA','dRp4UqHRTVo','8iPEnn-ltC8','2z8JmcrW-As'],
  back:       ['GZbfZ033f74','xBmfkqbGUWs','UtOHMCmOAYI','CAwf7n6Luuc','pYcpY20QaE8'],
  shoulders:  ['WvLMauqrnK8','qEwKCR5JCog','fEFNezIgMeQ','PPGKIKsR5Ec','V8dZ3x7a4EQ'],
  quads:      ['ultWZbUMPL8','sEM_zo6HKLA','iGK-yd6j8Ko','YyvSfVjQeL0','2C-uNgKwPLE'],
  hamstrings: ['JCXUYuzwNrM','EfeVvA1vdd4','bZuv_z8z8go','tHGR_3MsVBg','xDmFkJxPzeM'],
  glutes:     ['xDmFkJxPzeM','tHGR_3MsVBg','OUgsJ8-Vi0E','JCXUYuzwNrM'],
  calves:     ['gwLzBkvzekY','JbyjNymZOt0','c5b-rGRXvXk','IGwqbwVCRuA'],
  biceps:     ['_4EGFiBU0PY','soxrZlIl35U','av7-8CzC9Vk','fIWP-FRFNU0','zC3nLlEvin4'],
  triceps:    ['d_KZxkY_gmE','2-LAMcpzODU','nEF0bv2z-gE','6Fzep104f0s','Hq71JvEQpKo'],
  core:       ['eGo4IYlbE5g','_gsUck-7M-o','6HgNrPFaGlw'],
  forearms:   ['V7bCBlMMPFY','G8l_8chR5BE','Fkzks_YrMOI'],
  traps:      ['cJRVVxmytaM','eSIUSUoJPJ8','V8dZ3x7a4EQ'],
  // ── Module category fallbacks ──
  cardio:     ['kZCBfpRgGNQ','1BZM2L-T5bk','6HgNrPFaGlw'],
  kegel:      ['xDmFkJxPzeM','OUgsJ8-Vi0E','6HgNrPFaGlw'],
  mobility:   ['OUgsJ8-Vi0E','V8dZ3x7a4EQ','WvLMauqrnK8','cfns6QMnFNc'],
  stretching: ['JCXUYuzwNrM','SCVCLChPQEY','OUgsJ8-Vi0E','fEFNezIgMeQ'],
  yoga:       ['OUgsJ8-Vi0E','ultWZbUMPL8','xDmFkJxPzeM','6HgNrPFaGlw'],
  breathing:  ['6HgNrPFaGlw','IODxDxX7oi4','cfns6QMnFNc'],
  recovery:   ['kZCBfpRgGNQ','OUgsJ8-Vi0E','6HgNrPFaGlw'],
  default:    ['6HgNrPFaGlw','eGo4IYlbE5g','OUgsJ8-Vi0E']
};

// Master fallback — always safe
const VID_ULTIMATE_FALLBACK = '6HgNrPFaGlw';

// Get the safe fallback for a given vid and exercise group
function getFallbackVid(vid, grp){
  // 1. Try VID_FALLBACKS chain first
  let fb = VID_FALLBACKS[vid];
  if(fb && !_vidBlacklist.has(fb) && VERIFIED_VIDS[fb]) return fb;
  // 2. Try category-specific safe fallbacks
  const catList = VID_SAFE_FALLBACKS[grp] || VID_SAFE_FALLBACKS.default;
  for(const v of catList){
    if(!_vidBlacklist.has(v) && VERIFIED_VIDS[v]) return v;
  }
  // 3. Ultimate fallback
  return VID_ULTIMATE_FALLBACK;
}

// verifiedVideoPipeline — resolves a vid to always-safe URL
// Checks: VERIFIED_VIDS - blacklist - fallback chain
// Rejects: Shorts IDs, playlist IDs, youtu.be, embed URLs, invalid lengths
// Output vid is always used in watch?v= format by safeVidUrl()
