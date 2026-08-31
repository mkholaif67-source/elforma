// ═══════════════════════════════════════════════════════════════
//  STEP 2 — PHYSIOLOGICAL ANALYSIS ENGINE
//  Reads data from step 1 only — zero writes to DE logic
// ═══════════════════════════════════════════════════════════════
function buildPhysioAnalysis() {
  LOG('Building Physiological Analysis...');
  const container = document.getElementById('physio-analysis-content');
  if (!container) return;

  // ── Read step-1 data ──────────────────────────────────────────
  const gender    = document.getElementById('inp-gender').value || 'ذكر';
  const age       = parseInt(document.getElementById('inp-age').value)    || 25;
  const height    = parseInt(document.getElementById('inp-height').value) || 170;
  const weight    = parseFloat(document.getElementById('inp-weight').value)|| 80;
  const target    = parseFloat(document.getElementById('inp-target').value)|| 75;
  const activity  = parseFloat(document.getElementById('inp-activity').value)|| 1.375;
  const goal      = document.getElementById('inp-goal').value || 'cut';
  const bfInput   = parseFloat(document.getElementById('inp-bf')?.value)  || null;
  const waist     = parseFloat(document.getElementById('inp-waist')?.value)|| null;
  const neck      = parseFloat(document.getElementById('inp-neck')?.value) || null;
  const hip       = parseFloat(document.getElementById('inp-hip')?.value)  || null;
  const trainDays = parseInt(document.getElementById('inp-train-days')?.value)  || 0;
  const workoutDur= parseInt(document.getElementById('inp-workout-dur')?.value) || 0;
  const cardioDays= parseInt(document.getElementById('inp-cardio')?.value)      || 0;
  const steps     = parseInt(document.getElementById('inp-steps')?.value)       || 5000;
  const sleepHrs  = parseFloat(document.getElementById('inp-sleep')?.value)     || 7;
  const weeklyRate= parseFloat(document.getElementById('inp-weekly-rate')?.value)|| 0.5;

  // ── Core Calculations ─────────────────────────────────────────
  const isFemale = gender === 'أنثى';

  // BMI
  const bmi    = +(weight / Math.pow(height/100, 2)).toFixed(1);
  const bmiCat = bmi < 18.5 ? {label:'نقص وزن',    cls:'psb-blue',   color:'var(--blue)'}
               : bmi < 25   ? {label:'وزن طبيعي',  cls:'psb-green',  color:'var(--green)'}
               : bmi < 30   ? {label:'زيادة وزن',  cls:'psb-orange', color:'var(--orange)'}
               : bmi < 35   ? {label:'سمنة 1',     cls:'psb-red',    color:'var(--red)'}
               :              {label:'سمنة 2+',     cls:'psb-red',    color:'var(--red)'};

  // BMR — Mifflin St Jeor
  const bmr = Math.round(isFemale
    ? 10*weight + 6.25*height - 5*age - 161
    : 10*weight + 6.25*height - 5*age + 5);

  // TDEE
  const tdee = Math.round(bmr * activity);

  // Body Fat %
  let bf = bfInput;
  if (!bf && waist && neck) {
    if (isFemale && hip)
      bf = +(495/(1.0324-0.19077*Math.log10(waist+hip-neck)+0.15456*Math.log10(height))-450).toFixed(1);
    else if (!isFemale)
      bf = +(495/(1.0324-0.19077*Math.log10(waist-neck)+0.15456*Math.log10(height))-450).toFixed(1);
  }
  if (!bf) bf = +(1.2*bmi + 0.23*age - 10.8*(isFemale?0:1) - 5.4).toFixed(1);
  bf = Math.max(5, Math.min(60, bf));

  const fatMass = +(weight * bf / 100).toFixed(1);
  const lbm     = +(weight - fatMass).toFixed(1);

  const idealBfLow  = isFemale ? 20 : 10;
  const idealBfHigh = isFemale ? 28 : 18;
  const bfStatus = bf < idealBfLow
    ? {label:'منخفضة',    color:'var(--blue)'}
    : bf <= idealBfHigh
    ? {label:'صحية ✓',   color:'var(--green)'}
    : bf <= idealBfHigh+7
    ? {label:'زائدة',    color:'var(--orange)'}
    : {label:'مرتفعة جدا', color:'var(--red)'};

  // Metabolic Rate
  const tdeePerKg = tdee / weight;
  const metaStatus = tdeePerKg > 36
    ? {label:'أيض سريع',      score:90, color:'var(--green)',  bg:'rgba(34,217,114,0.08)', border:'rgba(34,217,114,0.2)'}
    : tdeePerKg > 30
    ? {label:'أيض طبيعي',     score:70, color:'var(--blue)',   bg:'rgba(59,158,255,0.08)', border:'rgba(59,158,255,0.2)'}
    : tdeePerKg > 25
    ? {label:'أيض متباطئ',   score:45, color:'var(--orange)', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.2)'}
    : {label:'أيض بطيء جدا', score:25, color:'var(--red)',    bg:'rgba(240,82,82,0.08)',  border:'rgba(240,82,82,0.2)'};

  // Fitness Score
  const activityScore = {1.2:15, 1.375:35, 1.55:60, 1.725:80, 1.9:95}[activity] || 50;
  const trainScore    = Math.min(100, (trainDays/7)*100*0.7 + (workoutDur/90)*100*0.3);
  const cardioScore   = Math.min(100, cardioDays * 14);
  const stepsScore    = Math.min(100, (steps/10000)*100);
  const fitnessScore  = Math.round(activityScore*0.35 + trainScore*0.30 + cardioScore*0.15 + stepsScore*0.20);

  const fitnessLevel = fitnessScore >= 75 ? {label:'لياقة عالية',      color:'var(--green)'}
                     : fitnessScore >= 50 ? {label:'لياقة متوسطة',    color:'var(--blue)'}
                     : fitnessScore >= 25 ? {label:'لياقة منخفضة',    color:'var(--orange)'}
                     :                     {label:'لياقة ضعيفة جدا', color:'var(--red)'};

  // Sleep Score
  const sleepScore = sleepHrs >= 7.5 ? 100 : sleepHrs >= 6.5 ? 80 : sleepHrs >= 5.5 ? 55 : 30;

  // Scores
  const bfScore      = bf <= idealBfHigh ? 85 : Math.max(20, 85 - (bf - idealBfHigh)*3);
  const ageScore     = age < 30 ? 95 : age < 40 ? 85 : age < 50 ? 70 : age < 60 ? 55 : 40;
  const overallScore = Math.round(bfScore*0.25 + fitnessScore*0.25 + metaStatus.score*0.20 + sleepScore*0.15 + ageScore*0.15);

  const responsePct  = Math.round((fitnessScore > 60 ? 25 : 15) + (bf > 25 ? 25 : 15) + (sleepHrs >= 7 ? 20 : 10) + metaStatus.score*0.30);
  const neatEst      = Math.round(steps*0.04 + (activity-1.2)*500);

  // Timeline
  const weightDiff    = Math.abs(weight - target);
  const weeksEstimate = Math.ceil(weightDiff / weeklyRate);
  const monthsEstimate= +(weeksEstimate/4.33).toFixed(1);
  const adaptRisk     = weeklyRate >= 1.0 ? {label:'مرتفع', color:'var(--red)'} : weeklyRate >= 0.75 ? {label:'متوسط', color:'var(--orange)'} : {label:'منخفض', color:'var(--green)'};

  // Overall ring color
  const ringColor  = overallScore >= 75 ? 'var(--green)'  : overallScore >= 50 ? 'var(--blue)'   : overallScore >= 30 ? 'var(--orange)' : 'var(--red)';
  const ringBorder = overallScore >= 75 ? 'rgba(34,217,114,0.6)'  : overallScore >= 50 ? 'rgba(59,158,255,0.6)'   : overallScore >= 30 ? 'rgba(245,158,11,0.6)'   : 'rgba(240,82,82,0.5)';
  const ringShadow = overallScore >= 75 ? '0 0 40px rgba(34,217,114,0.25)' : overallScore >= 50 ? '0 0 40px rgba(59,158,255,0.22)' : overallScore >= 30 ? '0 0 40px rgba(245,158,11,0.2)' : '0 0 40px rgba(240,82,82,0.18)';
  const overallLabel = overallScore >= 75 ? 'جاهزية عالية' : overallScore >= 50 ? 'جاهزية متوسطة' : overallScore >= 30 ? 'جاهزية محدودة' : 'يحتاج تحسين';

  // Strengths & Weaknesses
  const strengths = [], weaknesses = [];
  if (bf <= idealBfHigh) strengths.push('نسبة دهون صحية — تدعم استجابة هرمونية جيدة وحساسية أنسولين مثالية');
  else weaknesses.push('نسبة دهون مرتفعة — تقلل حساسية الأنسولين وقد تبطئ استجابة الجسم');
  if (fitnessScore >= 60) strengths.push('مستوى نشاط جيد يرفع TDEE ويحافظ على الكتلة العضلية أثناء الدايت');
  else weaknesses.push('مستوى نشاط منخفض — زيادة الحركة اليومية ستسرع النتائج بشكل ملحوظ');
  if (sleepHrs >= 7) strengths.push('نوم كاف — يدعم هرمون النمو GH وتعافي العضل وضبط هرموني الجوع');
  else weaknesses.push(`قلة النوم (${sleepHrs}س) — ترفع الكورتيزول وتقلل Leptin مما يزيد الجوع ويعيق الحرق`);
  if (lbm >= (isFemale ? 40 : 55)) strengths.push('كتلة عضلية كافية — ترفع الأيض الأساسي وتدعم قوة الجسم على المدى البعيد');
  else weaknesses.push('كتلة عضلية منخفضة — البروتين العالي والتمرين المقاوم أساسيان لبناءها وحمايتها');
  if (tdeePerKg > 32) strengths.push('معدل حرق جيد لوزنك — يمنحك هامشا سعريا مريحا لتحقيق هدفك');
  else weaknesses.push('معدل حرق منخفض نسبيا — يستلزم صبرا ودقة في تطبيق السعرات المستهدفة');
  if (age < 35) strengths.push('عمرك الشاب يعطيك استجابة هرمونية وعضلية ممتازة للتدريب والتغذية');

  // ── Render ─────────────────────────────────────────────────────
  container.innerHTML = `

    <!-- ① Overall Score -->
    <div class="pa-score-wrap">
      <div class="pa-score-ring" style="
          color:${ringColor};
          border-color:${ringBorder};
          box-shadow:${ringShadow}, 0 4px 20px rgba(0,0,0,0.3);
          border-color-after:${ringBorder};">
        <div class="pa-score-num">${overallScore}</div>
        <div class="pa-score-of">/ 100</div>
      </div>
      <div class="pa-score-label" style="color:${ringColor};">${overallLabel}</div>
      <div class="pa-score-sub">مؤشر الجاهزية الفسيولوجية الكلي</div>
    </div>

    <!-- ② Key Metrics Strip -->
    <div class="pa-metrics-grid">
      <div class="pa-metric-cell" style="border-color:rgba(245,166,35,0.18);background:linear-gradient(145deg,#100e05,#0e0d16);">
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% -10%,rgba(245,166,35,0.1),transparent 65%);pointer-events:none;"></div>
        <div class="pa-metric-val" style="color:var(--accent);">${bmi}</div>
        <div class="pa-metric-lbl">مؤشر الكتلة</div>
        <div><span class="pa-metric-badge" style="background:${bmiCat.color}22;color:${bmiCat.color};border:1px solid ${bmiCat.color}44;">${bmiCat.label}</span></div>
      </div>
      <div class="pa-metric-cell" style="border-color:rgba(245,166,35,0.18);background:linear-gradient(145deg,#100e05,#0e0d16);">
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% -10%,rgba(245,166,35,0.1),transparent 65%);pointer-events:none;"></div>
        <div class="pa-metric-val" style="color:var(--orange);">${bf}%</div>
        <div class="pa-metric-lbl">نسبة الدهون</div>
        <div><span class="pa-metric-badge" style="background:${bfStatus.color}22;color:${bfStatus.color};border:1px solid ${bfStatus.color}44;">${bfStatus.label}</span></div>
      </div>
      <div class="pa-metric-cell" style="border-color:rgba(155,89,182,0.2);background:linear-gradient(145deg,#0d0a16,#0c0e18);">
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% -10%,rgba(155,89,182,0.1),transparent 65%);pointer-events:none;"></div>
        <div class="pa-metric-val" style="color:var(--purple);">${lbm}كجم</div>
        <div class="pa-metric-lbl">كتلة عضلية</div>
        <div style="font-size:8.5px;color:var(--text-dim);margin-top:5px;">دهون: ${fatMass}كجم</div>
      </div>
      <div class="pa-metric-cell" style="border-color:rgba(59,158,255,0.2);background:linear-gradient(145deg,#050d1a,#07101e);">
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% -10%,rgba(59,158,255,0.1),transparent 65%);pointer-events:none;"></div>
        <div class="pa-metric-val" style="color:var(--blue);">${tdee}</div>
        <div class="pa-metric-lbl">TDEE يومي</div>
        <div style="font-size:8.5px;color:var(--text-dim);margin-top:5px;">BMR: ${bmr}</div>
      </div>
    </div>
    <div class="pa-metrics-grid" style="border-top:none;padding-top:0;">
      <div class="pa-metric-cell" style="border-color:${fitnessLevel.color}33;background:linear-gradient(145deg,#070d12,#090e16);">
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% -10%,${fitnessLevel.color}18,transparent 65%);pointer-events:none;"></div>
        <div class="pa-metric-val" style="color:${fitnessLevel.color};">${fitnessScore}%</div>
        <div class="pa-metric-lbl">مؤشر اللياقة</div>
        <div><span class="pa-metric-badge" style="background:${fitnessLevel.color}22;color:${fitnessLevel.color};border:1px solid ${fitnessLevel.color}44;">${fitnessLevel.label}</span></div>
      </div>
      <div class="pa-metric-cell" style="border-color:rgba(42,232,123,0.2);background:linear-gradient(145deg,#050e0a,#071210);">
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% -10%,rgba(42,232,123,0.09),transparent 65%);pointer-events:none;"></div>
        <div class="pa-metric-val" style="color:var(--green);">${responsePct}%</div>
        <div class="pa-metric-lbl">استجابة متوقعة</div>
        <div style="font-size:8.5px;color:var(--text-dim);margin-top:5px;">للخطة الغذائية</div>
      </div>
      <div class="pa-metric-cell" style="border-color:rgba(59,158,255,0.2);background:linear-gradient(145deg,#050d1a,#07101e);">
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% -10%,rgba(59,158,255,0.09),transparent 65%);pointer-events:none;"></div>
        <div class="pa-metric-val" style="color:var(--blue);">${weeksEstimate}</div>
        <div class="pa-metric-lbl">أسبوع للهدف</div>
        <div style="font-size:8.5px;color:var(--text-dim);margin-top:5px;">~${monthsEstimate} شهر</div>
      </div>
      <div class="pa-metric-cell" style="border-color:rgba(245,166,35,0.18);background:linear-gradient(145deg,#100e05,#0e0d16);">
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% -10%,rgba(245,166,35,0.09),transparent 65%);pointer-events:none;"></div>
        <div class="pa-metric-val" style="color:var(--orange);">${neatEst}</div>
        <div class="pa-metric-lbl">NEAT يومي</div>
        <div style="font-size:8.5px;color:var(--text-dim);margin-top:5px;">سعرة حركة</div>
      </div>
    </div>

    <!-- ③ Physiological Indicators -->
    <div class="pa-section">
      <div class="pa-section-title">
        <div class="pa-stitle-icon" style="background:rgba(59,158,255,0.12);border:1px solid rgba(59,158,255,0.2);"></div>
        المؤشرات الفسيولوجية
      </div>
      <div>
        <div class="pa-bar-row">
          <div class="pa-bar-left"><span class="pa-bar-icon"></span><span class="pa-bar-name">الأيض الغذائي</span></div>
          <div class="pa-bar-track"><div class="pa-bar-fill" style="width:${metaStatus.score}%;background:linear-gradient(90deg,${metaStatus.color},var(--accent));"></div></div>
          <div class="pa-bar-pct" style="color:${metaStatus.color};">${metaStatus.score}%</div>
        </div>
        <div class="pa-bar-row">
          <div class="pa-bar-left"><span class="pa-bar-icon"></span><span class="pa-bar-name">مستوى اللياقة</span></div>
          <div class="pa-bar-track"><div class="pa-bar-fill" style="width:${fitnessScore}%;background:linear-gradient(90deg,var(--blue),var(--purple));"></div></div>
          <div class="pa-bar-pct" style="color:var(--blue);">${fitnessScore}%</div>
        </div>
        <div class="pa-bar-row">
          <div class="pa-bar-left"><span class="pa-bar-icon"></span><span class="pa-bar-name">جودة النوم</span></div>
          <div class="pa-bar-track"><div class="pa-bar-fill" style="width:${sleepScore}%;background:linear-gradient(90deg,var(--purple),var(--blue));"></div></div>
          <div class="pa-bar-pct" style="color:var(--purple);">${sleepScore}%</div>
        </div>
        <div class="pa-bar-row">
          <div class="pa-bar-left"><span class="pa-bar-icon"></span><span class="pa-bar-name">الاستجابة المتوقعة</span></div>
          <div class="pa-bar-track"><div class="pa-bar-fill" style="width:${responsePct}%;background:linear-gradient(90deg,var(--green),var(--blue));"></div></div>
          <div class="pa-bar-pct" style="color:var(--green);">${responsePct}%</div>
        </div>
        <div class="pa-bar-row">
          <div class="pa-bar-left"><span class="pa-bar-icon"></span><span class="pa-bar-name">إمكانية العضل</span></div>
          <div class="pa-bar-track"><div class="pa-bar-fill" style="width:${ageScore}%;background:linear-gradient(90deg,var(--green),var(--accent));"></div></div>
          <div class="pa-bar-pct" style="color:var(--green);">${ageScore}%</div>
        </div>
      </div>
    </div>

    <!-- ④ Metabolic State -->
    <div class="pa-section">
      <div class="pa-section-title">
        <div class="pa-stitle-icon" style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);"></div>
        الحالة الأيضية الراهنة
      </div>
      <div class="pa-meta-banner" style="background:${metaStatus.bg};border:1px solid ${metaStatus.border};">
        <div class="pa-meta-chips">
          <span class="pa-chip" style="background:${metaStatus.color}18;color:${metaStatus.color};border:1px solid ${metaStatus.color}44;">${metaStatus.label} · TDEE: ${tdee} سعرة</span>
          <span class="pa-chip" style="background:rgba(155,89,182,0.12);color:var(--purple);border:1px solid rgba(155,89,182,0.3);">إمكانية بناء عضل: ${age < 30 ? 'ممتاز' : age < 40 ? 'جيد جدا' : 'جيد'}</span>
          <span class="pa-chip" style="background:rgba(59,158,255,0.1);color:var(--blue);border:1px solid rgba(59,158,255,0.25);">NEAT ~${neatEst} سعرة</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);line-height:1.85;">
          ${metaStatus.score >= 70
            ? `أيضك <strong style="color:${metaStatus.color};">${metaStatus.label}</strong> يمنحك مرونة سعرية جيدة وجسمك مهيأ للاستجابة`
            : metaStatus.score >= 45
            ? `أيضك في المستوى الطبيعي — الالتزام الدقيق بالسعرات والبروتين سيظهر نتائج تدريجية ثابتة`
            : `أيضك متباطئ — قابل للتحسين تدريجيا برفع الكتلة العضلية وزيادة النشاط الحركي اليومي`
          }
          <br>خطر التكيف الأيضي (Adaptive Thermogenesis): <strong style="color:${adaptRisk.color};">${adaptRisk.label}</strong> عند ${weeklyRate} كجم/أسبوع
        </div>
      </div>
    </div>

    <!-- ⑤ Strengths & Weaknesses -->
    <div class="pa-section">
      <div class="pa-section-title">
        <div class="pa-stitle-icon" style="background:rgba(34,217,114,0.1);border:1px solid rgba(34,217,114,0.2);"></div>
        نقاط القوة والتحدي
      </div>
      ${strengths.length ? `
      <div class="pa-sw-group">
        <div class="pa-sw-label" style="color:var(--green);">نقاط القوة لديك</div>
        ${strengths.map(s => `<div class="pa-sw-item strength"><span class="pa-sw-icon" style="color:var(--green);">✓</span><span>${s}</span></div>`).join('')}
      </div>` : ''}
      ${weaknesses.length ? `
      <div class="pa-sw-group">
        <div class="pa-sw-label" style="color:var(--orange);">نقاط تحتاج انتباها</div>
        ${weaknesses.map(w => `<div class="pa-sw-item weakness"><span class="pa-sw-icon" style="color:var(--orange);"></span><span>${w}</span></div>`).join('')}
      </div>` : ''}
    </div>

    <!-- ⑥ Progress Forecast Timeline -->
    <div class="pa-section">
      <div class="pa-section-title">
        <div class="pa-stitle-icon" style="background:rgba(59,158,255,0.1);border:1px solid rgba(59,158,255,0.2);"></div>
        توقعات مسار التقدم
      </div>
      ${sleepHrs < 7 ? `<div class="pa-sleep-warn"><span style="font-size:16px;flex-shrink:0;"></span><span><strong>تنبيه النوم:</strong> ${sleepHrs} ساعات/ليلة أقل من المثالي. قلة النوم ترفع Ghrelin (جوع) وتخفض Leptin (شبع) بنسبة تصل ل 24% — مما يصعب الالتزام ويبطئ الحرق</span></div>` : ''}
      <div class="pa-timeline">
        <div class="pa-timeline-item">
          <div class="pa-timeline-dot" style="background:var(--blue);box-shadow:0 0 0 3px var(--bg), 0 0 8px rgba(59,158,255,0.4);"></div>
          <div class="pa-timeline-body">
            <div class="pa-timeline-title">الأسابيع 1-${Math.min(2,weeksEstimate)}: مرحلة التكيف</div>
            <div class="pa-timeline-desc">تكيف الجسم مع النظام الجديد — خسارة/زيادة ماء وجليكوجين. توقع تغيرات سريعة غير حقيقية في هذه المرحلة</div>
          </div>
        </div>
        <div class="pa-timeline-item">
          <div class="pa-timeline-dot" style="background:var(--orange);box-shadow:0 0 0 3px var(--bg), 0 0 8px rgba(245,158,11,0.4);"></div>
          <div class="pa-timeline-body">
            <div class="pa-timeline-title">الأسابيع 3-${Math.min(weeksEstimate,12)}: مرحلة التغيير الحقيقي</div>
            <div class="pa-timeline-desc">الجسم يبدأ التغيير الفعلي بمعدل ~${weeklyRate} كجم/أسبوع. هذه المرحلة تحتاج ثبات وصبر</div>
          </div>
        </div>
        <div class="pa-timeline-item">
          <div class="pa-timeline-dot" style="background:var(--green);box-shadow:0 0 0 3px var(--bg), 0 0 8px rgba(34,217,114,0.4);"></div>
          <div class="pa-timeline-body">
            <div class="pa-timeline-title">الأسبوع ~${weeksEstimate}: الوصول للهدف</div>
            <div class="pa-timeline-desc">مع ثبات الالتزام، الوصول للهدف <strong>${target} كجم</strong> متوقع خلال ~${monthsEstimate} شهر (${weeksEstimate} أسبوع)</div>
          </div>
        </div>
        <div class="pa-timeline-item">
          <div class="pa-timeline-dot" style="background:var(--purple);box-shadow:0 0 0 3px var(--bg), 0 0 8px rgba(155,89,182,0.4);"></div>
          <div class="pa-timeline-body">
            <div class="pa-timeline-title">مرحلة الثبات والاستدامة</div>
            <div class="pa-timeline-desc">إعادة ضبط السعرات للصيانة مع الحفاظ على عادات النظام الغذائي المكتسبة</div>
          </div>
        </div>
      </div>
      <div class="pa-forecast-box">
        <strong>توقع واقعي:</strong>
        ${weightDiff <= 5
          ? `هدفك قريب (${weightDiff} كجم) — مع ثبات الالتزام قابل للتحقيق خلال ${weeksEstimate} أسابيع`
          : weightDiff <= 15
          ? `هدفك متوسط (${weightDiff} كجم) — ينصح بتقسيمه لمراحل قصيرة وتقييم الأداء كل 4 أسابيع`
          : `هدفك طموح (${weightDiff} كجم) — رحلة طويلة تحتاج استراتيجية مرنة ومراحل متعددة ومراجعة دورية`
        }
      </div>
    </div>

    <!-- ⑦ Summary -->
    <div class="pa-section">
      <div class="pa-summary">
        <div class="pa-summary-title">ملخص التحليل الفسيولوجي</div>
        <div class="pa-summary-row">
          <div class="pa-summary-key">جسمك</div>
          <div class="pa-summary-val">${weight}كجم وزن · <span style="color:var(--purple);">${lbm}كجم عضلة</span> · <span style="color:var(--orange);">${fatMass}كجم دهون (${bf}%)</span> · BMI: ${bmi} — ${bmiCat.label}</div>
        </div>
        <div class="pa-summary-row">
          <div class="pa-summary-key">أيضك</div>
          <div class="pa-summary-val"><span style="color:var(--blue);">${bmr} سعرة BMR</span> · <span style="color:var(--accent);">${tdee} TDEE</span> · ${metaStatus.label} · NEAT ~${neatEst} سعرة/يوم</div>
        </div>
        <div class="pa-summary-row">
          <div class="pa-summary-key">لياقتك</div>
          <div class="pa-summary-val">${fitnessLevel.label} · نوم ${sleepHrs}س (${sleepScore >= 80 ? 'ممتاز' : sleepScore >= 55 ? 'مقبول' : 'يحتاج تحسين'})</div>
        </div>
        <div class="pa-summary-row">
          <div class="pa-summary-key">توقعاتك</div>
          <div class="pa-summary-val">وصول ${target}كجم خلال ~<strong style="color:var(--green);">${weeksEstimate} أسبوع</strong> · استجابة متوقعة ${responsePct}% · خطر تكيف أيضي <strong style="color:${adaptRisk.color};">${adaptRisk.label}</strong></div>
        </div>
      </div>
    </div>
  `;

  LOG('✔ Physiological Analysis complete');
}

// ═══════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════
function goStep(n) {
  if (n > DE.currentStep) {
    if (!validateStep(DE.currentStep)) return;
  }
  if (n === 2) buildPhysioAnalysis();
  if (n === 6) buildRecommendations();
  if (n === 7) initStep6();

  // ── FIX-1: Non-blocking buildResults — إعطاء المتصفح فرصة لرسم ال UI أولا ──
  if (n === 8) {
    // أولا: عرض ال panel فورا حتى يتجاوب المتصفح مع الضغطة
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    const panel8 = document.getElementById('step-8');
    if (panel8) panel8.classList.add('active');
    for (let i = 1; i <= 8; i++) {
      const dot = document.getElementById(`sd${i}`);
      if (!dot) continue;
      dot.classList.remove('active','done');
      if (i < 8) { dot.classList.add('done'); dot.textContent = '✓'; }
      else { dot.classList.add('active'); dot.textContent = 8; }
      if (i < 8) { const line = document.getElementById(`sl${i}-${i+1}`); if (line) line.classList.toggle('done', i < 8); }
    }
    DE.currentStep = 8;
    window.scrollTo({ top:0, behavior:'smooth' });
    // ثانيا: إضافة loading state وتأجيل الحساب الثقيل
    document.body.classList.add('is-building-plan');
    const loadingEl = document.getElementById('results-section');
    if (loadingEl) {
      loadingEl.style.display = 'block';
      const existingLoader = document.getElementById('_plan_loader');
      if (!existingLoader) {
        const loader = document.createElement('div');
        loader.id = '_plan_loader';
        loader.style.cssText = 'text-align:center;padding:32px 16px;font-size:14px;color:var(--text-muted);';
        loader.innerHTML = '<div style="font-size:24px;margin-bottom:10px;animation:_spin 1s linear infinite;display:inline-block;"></div><br>جاري بناء الخطة الذكية...';
        loadingEl.prepend(loader);
      }
    }
    // ثالثا: تشغيل buildResults بعد أن يرسم المتصفح ال frame الحالي
    setTimeout(() => {
      try {
        const loader2 = document.getElementById('_plan_loader');
        if (loader2) loader2.remove();
        buildResults();
      } catch(err) {
        console.error('buildResults failed', err);
        const loader2 = document.getElementById('_plan_loader');
        if (loader2) loader2.innerHTML = 'حدث خطأ أثناء بناء الخطة. حاول مجددا';
      } finally {
        document.body.classList.remove('is-building-plan');
      }
    }, 0);
    LOG('✔ Navigated to step 8 — buildResults deferred (non-blocking)');
    return; // المهم: الخروج فورا — لا ننتظر buildResults
  }
  // ── END FIX-1 ──

  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`step-${n}`);
  if (!panel) { console.error('Step panel not found:', n); return; }
  panel.classList.add('active');

  for (let i = 1; i <= 8; i++) {
    const dot = document.getElementById(`sd${i}`);
    if (!dot) continue;
    dot.classList.remove('active','done');
    if (i < n) { dot.classList.add('done'); dot.textContent = '✓'; }
    else if (i === n) { dot.classList.add('active'); dot.textContent = i; }
    else dot.textContent = i;
    if (i < 8) {
      const line = document.getElementById(`sl${i}-${i+1}`);
      if (line) line.classList.toggle('done', i < n);
    }
  }
  DE.currentStep = n;
  window.scrollTo({ top:0, behavior:'smooth' });
  LOG(`✔ Navigated to step ${n}`);
}

function validateStep(s) {
  if (s === 1) {
    const age = parseInt(document.getElementById('inp-age').value);
    const h   = parseInt(document.getElementById('inp-height').value);
    const w   = parseInt(document.getElementById('inp-weight').value);
    const t   = parseInt(document.getElementById('inp-target').value);
    const g   = document.getElementById('inp-goal').value;
    const err = document.getElementById('step1-error');
    const msg = document.getElementById('step1-error-msg');
    if (!age||!h||!w||!t||!g||age<7||age>80||h<100||w<25||t<25) {
      err.style.display='flex';
      msg.textContent = !g ? 'يرجى اختيار الهدف الرئيسي' : 'يرجى إدخال جميع البيانات بشكل صحيح';
      return false;
    }
    err.style.display='none';
    DE.age=age; DE.height=h; DE.weight=w; DE.target=t;
    LOG('✔ Step 1 validated');
  }
  if (s === 5) {
    if (!DE.workoutType) {
      document.getElementById('step4-error').style.display='flex';
      return false;
    }
    document.getElementById('step4-error').style.display='none';
  }
  if (s === 6) {
    // Diet step — user MUST choose a diet. No auto-selection.
    if (!DE.selectedDiet) {
      // Show error - user must select
      const container = document.getElementById('diet-rec-cards');
      const existingErr = document.getElementById('diet-select-err');
      if (!existingErr) {
        const errDiv = document.createElement('div');
        errDiv.id = 'diet-select-err';
        errDiv.className = 'info-box info-red';
        errDiv.style.cssText = 'margin-top:10px;';
        errDiv.innerHTML = '<span class="ib-icon">&#9888;</span><span>يجب اختيار نظام غذائي أولا — اضغط على أي نظام من القائمة أعلاه</span>';
        container.after(errDiv);
      }
      return false;
    }
    const existingErr = document.getElementById('diet-select-err');
    if (existingErr) existingErr.remove();
    return true;
  }
  if (s === 7) {
    const v = checkFoodVariety();
    const el = document.getElementById('food-warning');
    if (!v.ok && el) { el.style.display='flex'; document.getElementById('food-warning-text').textContent=v.msg; }
    // Don't block — just warn
  }
  return true;
}

// ══════════════════════════════════════════════════════════════
//  STEP 1 INPUTS
// ═══════════════════════════════════════════════════════════════
function selectGender(btn, val) {
  document.querySelectorAll('#gender-btns .choice-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('inp-gender').value = val;
  DE.gender = val;
}
function selActivity(btn, val) {
  document.querySelectorAll('#activity-btns .choice-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  DE.activity = parseFloat(val);
  // FIX: sync hidden field so buildPhysioAnalysis reads the correct value
  const actField = document.getElementById('inp-activity');
  if (actField) actField.value = val;
  const actHints = {
    '1.2':   'مكتب أغلب اليوم + حركة قليلة + بدون تمرين',
    '1.375': 'حركة بسيطة أو تمرين 1-3 أيام أسبوعيا',
    '1.55':  'تتمرن 3-5 أيام + حركة يومية متوسطة',
    '1.725': 'تمرين قوي 5-6 أيام أو شغل فيه حركة',
    '1.9':   'تمرين يومي مكثف أو شغل بدني عالي'
  };
  const h = document.getElementById('activity-hint');
  if (h) { h.textContent = actHints[val] || ''; h.style.display = 'block'; }
}
function selGoal(btn, val, style) {
  document.querySelectorAll('#goal-btns .choice-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('inp-goal').value = val;
  DE.goal = val;
  // ── GAIN STYLE — internal modifier over the same 'bulk' engine (no demolition) ──
  // 'lean' = زيادة عضلية (clean small surplus) | 'mass' = ضخامة (larger surplus)
  DE.gainStyle = (val === 'bulk') ? (style || 'lean') : null;
  var _gsField = document.getElementById('inp-gain-style');
  if (_gsField) _gsField.value = DE.gainStyle || '';
  const hints = {
    cut:      'عجز حراري ذكي مع حماية العضلات — اختر معدل النزول الأسبوعي المناسب',
    recomp:   'بناء وحرق في نفس الوقت — عجز طفيف مع بروتين عالي جدا',
    bulk:     'فائض سعرات لبناء عضل صافي — فائض ذكي بناء على أيام تمرينك',
    maintain: 'حفاظ على الوزن الحالي — سعرات تساوي الحرق اليومي'
  };
  const h = document.getElementById('goal-hint');
  var _gainHints = {
    lean: 'زيادة عضلية نظيفة — فائض صغير 5-8% مع بروتين كاف. الأفضل مع تمرين مقاومة 3+ أيام',
    mass: 'ضخامة — فائض أكبر 10-15% لزيادة كتلة أوضح وأسرع'
  };
  if (val === 'bulk') { h.textContent = _gainHints[DE.gainStyle] || _gainHints.lean; }
  else { h.textContent = hints[val]||''; }
  h.style.display='block';
  // ── Lean-gain training guardrail: warn (don't block) if no resistance training ──
  if (val === 'bulk' && DE.gainStyle === 'lean') {
    var _td = parseInt(document.getElementById('inp-train-days')?.value) || 0;
    if (_td < 3) { h.textContent += ' —من غير تمرين مقاومة منتظم، النظام هيتعامل معاها ك"زيادة وزن صحية"؛ ضيف تمرين مقاومة عشان الزيادة تبقى عضل'; }
  }
  // Show weekly rate card only for cut or bulk
  const rateCard = document.getElementById('weekly-rate-card');
  if (rateCard) {
    rateCard.style.display = (val === 'cut' || val === 'bulk') ? 'block' : 'none';
    const rateBtns = document.querySelectorAll('#rate-btns .choice-btn');
    const rateSectionTitle = document.getElementById('rate-section-title');
    const currentRate = parseFloat(document.getElementById('inp-weekly-rate').value) || 0.5;
    const dailyAmount = Math.round((currentRate * 7700) / 7);
    if (val === 'bulk') {
      if (rateSectionTitle) rateSectionTitle.textContent = 'معدل الفائض الأسبوعي المستهدف';
      // ── GainStyle-aware rate labels and hints ──────────────────────
      const _sgGs = DE.gainStyle || (document.getElementById('inp-gain-style')?.value) || 'lean';
      // For lean gain: compute actual capped surplus per rate selection
      const _sgActual = (r) => Math.min(350, Math.max(120, Math.round(r * 7700 / 7)));
      const bulkLabels = _sgGs === 'lean' ? [
        ['0.25 كجم/أسبوع', 'ناعم · أعلى نسبة عضل صاف'],
        ['0.5 كجم/أسبوع',  'مثالي · الحد الأمثل للزيادة النظيفة'],
        ['0.75 كجم/أسبوع', 'محدود بالسقف (يعادل 0.5 عمليا)'],
        ['1 كجم/أسبوع',    'محدود بالسقف (يعادل 0.5 عمليا)']
      ] : [
        ['0.25 كجم/أسبوع', 'ناعم جدا · نسبة عضل أفضل'],
        ['0.5 كجم/أسبوع',  'مثالي · الأكثر شيوعا'],
        ['0.75 كجم/أسبوع', 'ضخامة سريعة'],
        ['1 كجم/أسبوع',    'ضخامة قوية']
      ];
      rateBtns.forEach((b, i) => {
        if (bulkLabels[i]) b.innerHTML = bulkLabels[i][0] + '<br><span style="font-size:10px;color:var(--text-dim);">' + bulkLabels[i][1] + '</span>';
      });
      const surplusHints = _sgGs === 'lean' ? {
        0.25: 'فائض فعلي ~' + _sgActual(0.25) + ' سعرة/يوم (~' + (_sgActual(0.25)*7/7700).toFixed(2) + 'كجم/أسبوع) — زيادة عضلية ناعمة نظيفة',
        0.5:  'فائض فعلي ~' + _sgActual(0.5)  + ' سعرة/يوم (~' + (_sgActual(0.5)*7/7700).toFixed(2)  + 'كجم/أسبوع) — الحد الأمثل للزيادة العضلية النظيفة',
        0.75: 'فائض فعلي ~' + _sgActual(0.75) + ' سعرة/يوم — محدود بالسقف الأمني (يعادل 0.5 عمليا)',
        1.0:  'فائض فعلي ~' + _sgActual(1.0)  + ' سعرة/يوم — محدود بالسقف الأمني (يعادل 0.5 عمليا)'
      } : {
        0.25: 'فائض يومي ~' + dailyAmount + ' سعرة — ضخامة ناعمة، نسبة عضل/دهون أفضل',
        0.5:  'فائض يومي ~' + dailyAmount + ' سعرة — معيار ذهبي للضخامة الذكية مع بروتين عالي',
        0.75: 'فائض يومي ~' + dailyAmount + ' سعرة — ضخامة سريعة نسبيا، يحتاج تمرين مقاومة منتظم',
        1.0:  'فائض يومي ~' + dailyAmount + ' سعرة — ضخامة قوية، مناسبة للمبتدئين أو بعد توقف طويل'
      };
      document.getElementById('rate-hint').textContent = surplusHints[currentRate] || surplusHints[0.5];
    } else {
      if (rateSectionTitle) rateSectionTitle.textContent = 'معدل التغيير الأسبوعي المستهدف';
      const cutLabels = [
        ['0.25 كجم/أسبوع', 'ناعم جدا · حماية عضل'],
        ['0.5 كجم/أسبوع',  'مثالي · الأكثر شيوعا'],
        ['0.75 كجم/أسبوع', 'سريع نسبيا'],
        ['1 كجم/أسبوع',    'أقصى موصى به']
      ];
      rateBtns.forEach((b, i) => {
        if (cutLabels[i]) b.innerHTML = cutLabels[i][0] + '<br><span style="font-size:10px;color:var(--text-dim);">' + cutLabels[i][1] + '</span>';
      });
      const deficitHints = {
        0.25: 'عجز يومي ~' + dailyAmount + ' سعرة — نزول ناعم جدا، حماية عضل ممتازة',
        0.5:  'عجز يومي ~' + dailyAmount + ' سعرة — معيار ذهبي للحفاظ على العضل مع فقد دهون فعال',
        0.75: 'عجز يومي ~' + dailyAmount + ' سعرة — سريع نسبيا، يحتاج بروتين عالي وتمرين منتظم',
        1.0:  'عجز يومي ~' + dailyAmount + ' سعرة — أقصى معدل موصى به. يحتاج نسبة دهون ≥20%'
      };
      document.getElementById('rate-hint').textContent = deficitHints[currentRate] || deficitHints[0.5];
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  STEP 2 — HEALTH
// ═══════════════════════════════════════════════════════════════
const HEALTH_IMPACTS = {
  diabetes:      'سكري: تقلل الكارب المعالجة — وجبات متوزعة لمنع ارتفاع السكر',
  insulin:       'مقاومة إنسولين: يفضل Low Carb مع تقليل السكريات والنشويات البيضاء',
  bp:            'ضغط مرتفع: يقلل الصوديوم وتزاد الأطعمة الغنية ببوتاسيوم ومغنيسيوم',
  thyroid:       'مشاكل الغدة: دعم الأيض وتحسين الطاقة مع تجنب الأطعمة المعيقة',
  hypothyroid:   'قصور الغدة (Hypothyroid): الأيض بطيء — تعزز اليود والسيلينيوم والزنك. تفضل البروتينات الخفيفة والكارب المعقد. الصليبيات مسموحة مطبوخة فقط',
  hyperthyroid:  'فرط نشاط الغدة (Hyperthyroid): الأيض مرتفع — تجنب مصادر اليود الزائدة (أعشاب بحرية، ملح معالج). يركز على المغنيسيوم والكالسيوم وتقليل الكافيين',
  ibs:           'قولون: أطعمة سهلة الهضم — تقليل الدهون العالية والألياف القاسية',
  gerd:          'حموضة: تتجنب الأطعمة الدهنية جدا والحمضية في العشاء',
  cholesterol:   'كوليسترول: تقلل الدهون المشبعة وتزاد الألياف والأوميغا-3',
  kidney:        'مشاكل كلى: يقلل البروتين الزائد ويراعى مستوى البوتاسيوم',
  'fatty-liver': 'كبد دهني: يقلل السكر والكارب المعالج مع زيادة الألياف',
  gout:          'نقرس: تتجنب الكبدة واللحوم الحمراء بكميات كبيرة مع زيادة الماء',
  anemia:        'أنيميا: تركز مصادر الحديد مع فيتامين C',
  pcos:          'تكيس المبايض PCOS: نظام منخفض الكارب أو متوازن — تقليل السكر ودعم حساسية الإنسولين — أوميغا-3 يوميا — أطعمة مضادة للالتهاب منخفضة المؤشر الجلايسيمي',
  lactose:       'حساسية لاكتوز: تستبدل منتجات الألبان ببدائل',
  gluten:        'حساسية جلوتين: يزال القمح والشعير والجاودار من الخطة',
  'slow-meta':   'بطء الحرق: رفع نسبة البروتين وإضافة تمارين قوة'
};

function selectHealthToggle(v) {
  // Legacy hidden elements (kept for any internal reads)
  document.getElementById('hc-no').classList.toggle('selected', v==='no');
  document.getElementById('hc-yes').classList.toggle('selected', v==='yes');
  // New redesigned toggle
  const noOpt  = document.getElementById('hc-no-opt');
  const yesOpt = document.getElementById('hc-yes-opt');
  if (noOpt)  noOpt.classList.toggle('s2-active', v==='no');
  if (yesOpt) yesOpt.classList.toggle('s2-active', v==='yes');
  const picker = document.getElementById('health-conditions-picker');
  if (picker) {
    if (v==='yes') { picker.style.display = 'block'; }
    else { picker.style.display = 'none'; }
  }
  if (v==='no') { DE.healthConditions = []; updateHealthImpact(); }
}

function toggleChip(el, type) {
  el.classList.toggle('multi-selected');
  if (type === 'health') {
    const hc = el.dataset.hc;
    if (el.classList.contains('multi-selected')) { if (!DE.healthConditions.includes(hc)) DE.healthConditions.push(hc); }
    else DE.healthConditions = DE.healthConditions.filter(x => x !== hc);
    updateHealthImpact();
  } else if (type === 'prob') {
    const prob = el.dataset.prob;
    if (el.classList.contains('multi-selected')) { if (!DE.dietProblems.includes(prob)) DE.dietProblems.push(prob); }
    else DE.dietProblems = DE.dietProblems.filter(x => x !== prob);
    updateProbStatusBar();
  }
}

function updateHealthImpact() {
  const box = document.getElementById('health-impact');
  const txt = document.getElementById('health-impact-text');
  if (!DE.healthConditions.length) { box.style.display='none'; return; }
  txt.innerHTML = DE.healthConditions.map(hc => '• ' + (HEALTH_IMPACTS[hc]||hc)).join('<br>');
  box.style.display = 'block';
}

// ═══════════════════════════════════════════════════════════════
//  STEP 3 — PROBLEMS
// ═══════════════════════════════════════════════════════════════
function selectProbToggle(v) {
  document.getElementById('prob-no').classList.toggle('selected', v==='no');
  document.getElementById('prob-yes').classList.toggle('selected', v==='yes');
  document.getElementById('problems-picker').style.display = v==='no' ? 'none' : 'block';
  if (v==='no') DE.dietProblems = [];
  updateProbStatusBar();
}
function updateProbStatusBar() {
  const bar = document.getElementById('prob-status-bar');
  const txt = document.getElementById('prob-status-text');
  if (!bar || !txt) return;
  const isNo = document.getElementById('prob-no').classList.contains('selected');
  if (isNo) {
    bar.style.background = 'rgba(42,232,123,0.08)';
    bar.style.borderColor = 'rgba(42,232,123,0.3)';
    bar.style.color = 'var(--green)';
    bar.querySelector('span:first-child').textContent = '';
    txt.textContent = 'ممتاز! سنبني لك خطة دايت متوازنة ومرنة';
    bar.style.display = 'flex';
  } else {
    const count = DE.dietProblems.length;
    if (count > 0) {
      bar.style.background = 'rgba(245,166,35,0.08)';
      bar.style.borderColor = 'rgba(245,166,35,0.35)';
      bar.style.color = 'var(--accent)';
      bar.querySelector('span:first-child').textContent = '';
      txt.textContent = 'تم تحديد ' + count + ' مشكلة — سنبني خطتك بناء عليها';
      bar.style.display = 'flex';
    } else {
      bar.style.display = 'none';
    }
  }
}
selectProbToggle('no');

// ═══════════════════════════════════════════════════════════════
//  STEP 4 — WORKOUT
// ═══════════════════════════════════════════════════════════════
function selWorkoutType(t) {
  DE.workoutType = t;
  document.getElementById('wt-gym').classList.toggle('selected', t==='gym');
  document.getElementById('wt-home').classList.toggle('selected', t==='home');
  document.getElementById('gym-options').style.display  = t==='gym'  ? 'block' : 'none';
  document.getElementById('home-options').style.display = t==='home' ? 'block' : 'none';
  document.getElementById('step4-error').style.display  = 'none';
}
function selGymSplit(s) {
  DE.gymSplit = s;
  document.getElementById('gym-split-default').classList.toggle('selected', s==='default');
  document.getElementById('gym-split-custom').classList.toggle('selected',  s==='custom');
  document.getElementById('gym-custom-count').style.display = s==='custom' ? 'block' : 'none';
  if (s==='default') DE.mealCount = 4;
}
function selHomeSplit(s) {
  DE.homeSplit = s;
  document.getElementById('home-split-default').classList.toggle('selected', s==='default');
  document.getElementById('home-split-custom').classList.toggle('selected',  s==='custom');
  document.getElementById('home-custom-count').style.display = s==='custom' ? 'block' : 'none';
  if (s==='default') DE.mealCount = 3;
}
function selMealCount(btn, n) {
  btn.closest('.btn-group').querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  DE.mealCount = n;
}
const snackState = { gym:false, home:false };
function toggleSnacks(type) {
  snackState[type] = !snackState[type];
  DE.snacks = snackState[type];
  document.getElementById(`snack-toggle-${type}`).classList.toggle('on', snackState[type]);
}
