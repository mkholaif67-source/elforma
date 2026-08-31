// ═══════════════════════════════════════════════════════════════
//  STEP 6 — RECOMMENDATION ENGINE
// ═══════════════════════════════════════════════════════════════
const DIETS = {
  balanced:  { label:'متوازن',     key:'balanced',  icon:'' },
  lowcarb:   { label:'لو كارب',    key:'lowcarb',   icon:'' },
  mediterranean: { label:'حمية البحر المتوسط', key:'mediterranean', icon:'' },
  carbcycle: { label:'كارب سايكل', key:'carbcycle', icon:'' },
  keto:      { label:'كيتو',       key:'keto',      icon:'' },
  carnivore: { label:'كارنفور',  key:'carnivore', icon:''}
};

function scoreDiet(dietKey) {
  const { goal, healthConditions, dietProblems, weight, target, availableFoods } = DE;
  const isBulk = (target - weight) > 8 || goal === 'bulk';
  const toLose = (weight || 0) - (target || 0); // كم كيلو مطلوب نزوله (موجب أثناء التنشيف)
  const bigCut = goal === 'cut' && toLose >= 15; // تنشيف سريع / وزن زائد كبير (15كج+)
  let score = 50; let reasons = []; let warnings = [];

  // ── USE COMPATIBILITY MATRIX ──────────────────────────────────
  // Health conditions (weighted heavily)
  healthConditions.forEach(hc => {
    const hcScores = COMPATIBILITY_MATRIX.health[hc];
    if (hcScores && hcScores[dietKey] !== undefined) {
      const compat = hcScores[dietKey];
      score += (compat - 50) * 0.5;
      if (compat >= 85) reasons.push(`ممتاز ل ${HC_LABELS[hc]||hc}`);
      else if (compat >= 70) reasons.push(`مناسب ل ${HC_LABELS[hc]||hc}`);
      else if (compat < 40) warnings.push(`خطر على ${HC_LABELS[hc]||hc}`);
      else if (compat < 55) warnings.push(`يحتاج حذر مع ${HC_LABELS[hc]||hc}`);
    }
  });

  // Goal compatibility
  const goalScores = COMPATIBILITY_MATRIX.goal[goal];
  if (goalScores && goalScores[dietKey] !== undefined) {
    const gs = goalScores[dietKey];
    score += (gs - 50) * 0.4;
    if (gs >= 85) reasons.push('مثالي لهدفك');
    else if (gs >= 70) reasons.push('مناسب لهدفك');
    else if (gs < 40) warnings.push('غير مناسب لهدفك');
  }

  // Problem compatibility
  dietProblems.forEach(prob => {
    const pScores = COMPATIBILITY_MATRIX.problem[prob];
    if (pScores && pScores[dietKey] !== undefined) {
      const ps = pScores[dietKey];
      score += (ps - 50) * 0.2;
      if (ps >= 88) reasons.push(`حل ممتاز ل ${getProbLabel(prob)}`);
    }
  });

  // Food availability check
  const availableForDiet = FOOD_DB.filter(f =>
    availableFoods.includes(f.id) &&
    f.allowedDiets && f.allowedDiets.includes(dietKey)
  );
  if (availableFoods.length > 0 && availableForDiet.length < 3) {
    score -= 25;
    warnings.push(`أطعمتك المتاحة لا تكفي لهذا النظام (${availableForDiet.length} طعام فقط متوافق)`);
  }

  // Diet-specific overrides
  if (dietKey === 'balanced') {
    score += 5; reasons.push('مناسب للجميع');
    if (isBulk) { score += 20; reasons.push('الأفضل للتضخيم'); }
    if (goal==='maintain') { score += 15; reasons.push('مثالي للحفاظ على الوزن'); }
    if (dietProblems.includes('time'))    { score += 8; reasons.push('مرن وسريع التحضير'); }
    if (dietProblems.includes('outside')) { score += 8; reasons.push('سهل خارج المنزل'); }
  }
  if (dietKey === 'lowcarb') {
    if (goal==='cut') { score += 15; reasons.push('ممتاز للتنشيف'); }
    if (bigCut) { score += 8; reasons.push('فعال لخسارة دهون كبيرة'); }
    if (dietProblems.includes('satiety')) { score += 12; reasons.push('يزيد الشبع بشكل ممتاز'); }
    if (isBulk) { score -= 20; warnings.push('غير مناسب للتضخيم'); }
  }
  if (dietKey === 'carbcycle') {
    if (goal==='recomp') { score += 20; reasons.push('الأمثل لل Recomp'); }
    if (goal==='cut') { score += 10; reasons.push('فعال للتنشيف'); }
    // حل سريع للتنشيف مع وزن زائد كبير — لكن ليس لمرضى السكر/الأنسولين (أيام الكارب العالية غير مناسبة لهم)
    if (bigCut && !healthConditions.includes('diabetes') && !healthConditions.includes('insulin')) { score += 16; reasons.push('حل سريع للتنشيف مع وزن زائد كبير (15كج+)'); }
    if (dietProblems.includes('plateau')) { score += 18; reasons.push('يكسر ثبات الوزن'); }
    if (dietProblems.includes('boredom')) { score += 12; reasons.push('متنوع ومثير'); }
  }
  if (dietKey === 'mediterranean') {
    score += 8; reasons.push('صحي ومتوازن لصحة القلب والشرايين');
    if (goal==='maintain') { score += 12; reasons.push('مثالي للحفاظ على الوزن والصحة'); }
    if (goal==='cut') { score += 5; reasons.push('مناسب للتنشيف الصحي المستدام'); }
    if (healthConditions.includes('cholesterol')) { score += 12; reasons.push('الأفضل للكوليسترول'); }
    if (healthConditions.includes('bp'))          { score += 10; reasons.push('ممتاز لضغط الدم'); }
    if (healthConditions.includes('fatty-liver')) { score += 12; reasons.push('الأنسب للكبد الدهني'); }
    if (healthConditions.includes('diabetes') || healthConditions.includes('insulin')) { score += 6; reasons.push('يحسن السكر والإنسولين'); }
    if (healthConditions.includes('gout'))        { score += 6; reasons.push('لطيف على النقرس'); }
    if (dietProblems.includes('outside'))         { score += 6; reasons.push('سهل خارج المنزل'); }
    if (dietProblems.includes('adherence'))       { score += 8; reasons.push('سهل الالتزام طويل المدى'); }
    if (isBulk) { score -= 6; }
  }
  if (dietKey === 'keto') {
    if (isBulk) { score -= 35; warnings.push('غير مناسب للتضخيم مطلقا'); }
    if (dietProblems.includes('outside')) { score -= 20; warnings.push('صعب خارج المنزل'); }
  }
  if (dietKey === 'carnivore') {
    if (healthConditions.includes('kidney')) { score -= 40; }
    if (healthConditions.includes('cholesterol')) { score -= 30; }
    if (isBulk) { score -= 30; }
    score = Math.min(score, 70); // cap carnivore
  }

  // rawScore (uncapped) is kept only as a tiebreaker for ranking; the displayed
  // percentage stays capped at 99 so the UI never shows >99%.
  const rawScore = Math.round(score);
  score = Math.max(5, Math.min(99, rawScore));
  return { score, rawScore, reasons, warnings };
}

function getProbLabel(prob) {
  const l = { hunger:'الجوع', sweets:'الحلويات', satiety:'الشبع', adherence:'الالتزام',
    time:'الوقت', outside:'الأكل خارج', boredom:'الملل', plateau:'ثبات الوزن',
    energy:'الطاقة', digestion:'الهضم' };
  return l[prob] || prob;
}

function buildRecommendations() {
  const isBulk = isBulkScenario();
  const container = document.getElementById('diet-rec-cards');
  const explainEl = document.getElementById('rec-explain-text');
  const scored = Object.keys(DIETS).map(k => ({ key:k, ...DIETS[k], ...scoreDiet(k) }))
    .sort((a,b) => (b.score - a.score) || (b.rawScore - a.rawScore));
  // ── v53: Diet tiering — keto & carnivore are LAST RESORT only ──────────
  // The four front-line diets are always preferred for recommendation:
  //   lowcarb · mediterranean · balanced · carbcycle
  // keto/carnivore only ever appear as a final fallback, never as the primary
  // suggestion, regardless of their raw compatibility score.
  const PREFERRED_DIETS   = ['lowcarb','mediterranean','balanced','carbcycle'];
  const LAST_RESORT_DIETS = ['keto','carnivore'];
  const preferredScored  = scored.filter(d => PREFERRED_DIETS.includes(d.key));
  const lastResortScored = scored.filter(d => LAST_RESORT_DIETS.includes(d.key));
  // Primary suggestion = best of the four front-line diets.
  const best = preferredScored[0] || scored[0];
  // v54: الخانة الثانية بقت مرنة = أفضل نظام أمامي تاني بعد الأساسي
  // (بدل ما كانت مقفولة على المتوازن دايما). ده بيدي الكارب سايكل وغيره
  // فرصة يظهروا كترشيح ثاني لما يتفوقوا على المتوازن (مثل حالات التنشيف/كسر الثبات).
  // المتوازن يفضل ظاهر دايما — لو مش أساسي/ثانوي يبان في "خيارات أخرى مناسبة".
  const balancedCard = scored.find(d => d.key === 'balanced');
  const secondary = preferredScored.find(d => d.key !== best.key) || balancedCard || null;
  //IMPORTANT: We do NOT auto-select any diet. selectedDiet stays null until user clicks.

  const _bestName = best.label.replace(/^[^\s]+\s/,'');
  const _secName = secondary ? secondary.label.replace(/^[^\s]+\s/,'') : 'المتوازن';
  explainEl.innerHTML = isBulk
    ? `هدفك تضخيم (${DE.weight} - ${DE.target} كجم) — رشحنا لك نظامين: <strong style="color:var(--accent);">${_bestName}</strong> + ${_secName}. <strong style="color:var(--accent);">الاختيار النهائي لك</strong>`
    : `بناء على هدفك وحالتك الصحية — رشحنا لك نظامين: <strong style="color:var(--accent);">${_bestName}</strong> + ${_secName}. <strong style="color:var(--accent);">الاختيار لك</strong>`;

  const noneSelected = !DE.selectedDiet;

  // ── diet metadata for premium UI ──
  const DIET_META = {
    balanced:  { iconBg:'rgba(59,158,255,0.12)',  barColor:'var(--blue)',   tags:['تنوع غذائي','سهل الالتزام','مرن'] },
    lowcarb:   { iconBg:'rgba(34,217,114,0.12)',  barColor:'var(--green)',  tags:['تنشيف سريع','حماية عضل','كارب منخفض'] },
    mediterranean: { iconBg:'rgba(16,185,129,0.12)', barColor:'var(--green)', tags:['زيت زيتون','سمك وأوميغا-3','صحة القلب'] },
    carbcycle: { iconBg:'rgba(245,158,11,0.12)',  barColor:'var(--orange)', tags:['للرياضيين','تدوير يومي','مرونة'] },
    keto:      { iconBg:'rgba(34,217,114,0.12)',  barColor:'var(--green)',  tags:['حرق دهون','طاقة مستقرة','دهون صحية'] },
    carnivore: { iconBg:'rgba(240,82,82,0.1)',    barColor:'var(--red)',    tags:['بروتين عالي','صارم'] }
  };

  // ── v53 tiers ──
  // Primary picks = [best front-line, balanced]; other front-line diets shown
  // as "خيارات أخرى مناسبة"; keto/carnivore always shown last as "الحل الأخير".
  const primaryKeys = [best.key];
  if (secondary && secondary.key !== best.key) primaryKeys.push(secondary.key);
  const topDiets  = preferredScored.filter(d => primaryKeys.includes(d.key))
                     .sort((a,b) => primaryKeys.indexOf(a.key) - primaryKeys.indexOf(b.key));
  const midDiets  = preferredScored.filter(d => !primaryKeys.includes(d.key));
  const lowDiets  = lastResortScored;

  function buildCard(d) {
    const isRec  = d.key === best.key;
    const isSec  = secondary && d.key === secondary.key && !isRec;
    const isLast = LAST_RESORT_DIETS.includes(d.key);
    const isSel  = d.key === DE.selectedDiet;
    const meta   = DIET_META[d.key] || { iconBg:'rgba(255,255,255,0.06)', barColor:'var(--text-muted)', tags:[] };
    const isLow  = isLast;

    const ringCls  = d.score >= 70 ? 'ring-high' : d.score >= 50 ? 'ring-mid' : 'ring-low';
    const badgeCls = isRec ? 'rbp-green' : isSec ? 'rbp-green' : isLast ? 'rbp-red' : 'rbp-amber';
    const badgeTxt = isRec ? 'الأنسب لك' : isSec ? (d.key==='balanced' ? 'خيارك الآمن' : 'بديل قوي مناسب') : isLast ? 'حل أخير فقط' : 'مناسب أيضا';
    const barFillColor = d.score >= 70 ? 'var(--green)' : d.score >= 50 ? 'var(--orange)' : 'var(--red)';
    const accentBarColor = d.score >= 70 ? 'var(--green)' : d.score >= 50 ? 'var(--orange)' : 'var(--red)';

    const tagsHtml = meta.tags.map(t => `<span class="rec-tag">${t}</span>`).join('');

    const btnHtml = isSel
      ? `<span class="rec-active-indicator">مفعل</span>`
      : `<button class="rec-select-btn" onclick="event.stopPropagation();selectDiet('${d.key}')">+ اختار هذا النظام</button>`;

    const reasonsHtml = d.reasons.slice(0,2).map(r => `<span class="rec-tag" style="color:var(--green);border-color:rgba(34,217,114,0.2);">${r}</span>`).join('');
    const warnsHtml   = d.warnings.slice(0,1).map(w => `<span class="rec-tag" style="color:var(--orange);border-color:rgba(245,158,11,0.2);">${w}</span>`).join('');

    return `<div class="rec-card ${isRec?'recommended':''} ${isSel?'selected-diet':''} ${isLow?'not-rec-card':''}"
       id="rec-${d.key}" onclick="selectDiet('${d.key}')">
      <div class="rec-card-accent-bar" style="background:${accentBarColor};"></div>
      <div class="rec-card-inner">
        <div class="rec-card-top">
          <div class="rec-card-left">
            <div class="rec-diet-icon" style="background:${meta.iconBg};">${d.icon}</div>
            <div>
              <div class="rec-card-title">${d.label.replace(/^[^\s]+\s/,'')}</div>
              <div class="rec-card-tagline">${d.reasons[0] || (isLow ? 'لا يتوافق مع هدفك الحالي' : 'مناسب لهدفك')}</div>
            </div>
          </div>
          <div class="rec-card-right">
            <div class="rec-score-ring ${ringCls}">${d.score}%</div>
            <div class="rec-badge-pill ${badgeCls}">${badgeTxt}</div>
          </div>
        </div>
        <div class="rec-tags-row">${tagsHtml}${reasonsHtml}${warnsHtml}</div>
        <div class="rec-score-bar-wrap">
          <div class="rec-score-bar-row">
            <span>التوافق مع هدفك</span>
            <span style="color:${barFillColor};font-weight:800;">${d.score}%</span>
          </div>
          <div class="rec-score-bar-track">
            <div class="rec-score-bar-fill" style="width:${d.score}%;background:${barFillColor};"></div>
          </div>
        </div>
      </div>
      <div class="rec-card-footer">
        ${btnHtml}
        ${isLow ? `<span style="font-size:11px;color:var(--text-dim);">${d.warnings[0]||'غير مناسب حاليا'}</span>` : ''}
      </div>
    </div>`;
  }

  let html = noneSelected ? `
    <div class="info-box info-warning" style="margin-bottom:12px;">
      <span class="ib-icon"></span>
      <span>لم تختر أي نظام بعد — اضغط على أي نظام أدناه لتفعيله. الشارات هي مجرد <strong>اقتراح</strong> فقط</span>
    </div>` : '';

  if (topDiets.length) {
    html += `<div class="top-pick-banner">ترشيحاتنا لك — نظامان مناسبان</div>`;
    html += topDiets.map(buildCard).join('');
  }
  if (midDiets.length) {
    html += `<div class="rec-section-label lbl-mid">خيارات أخرى مناسبة لك</div>`;
    html += midDiets.map(buildCard).join('');
  }
  if (lowDiets.length) {
    html += `<div class="rec-section-label lbl-low">الحل الأخير — لحالات خاصة فقط (كيتو / كارنفور)</div>`;
    html += lowDiets.map(buildCard).join('');
  }

  container.innerHTML = html;
  LOG(`✔ Recommendations built — best suggestion: ${best.key} (${best.score}%) — selectedDiet: ${DE.selectedDiet||'none'}`);
}

function selectDiet(key) {
  const wasSelected = DE.selectedDiet;

  // ── IMP-4: Medical conflict warnings for dangerous diet+condition combos ──
  // v31: Migrated from v30 science layer — clinical safety gate before selection
  // Gout + carnivore: purines in red meat directly raise uric acid.
  // Kidney + carnivore/keto: high protein load stresses impaired kidneys (KDIGO).
  // These are shown as a blocking confirmation — not silent — because the risk is direct.
  const healthConditions = DE.healthConditions || [];
  const dietConflicts = [];

  if (key === 'carnivore' && healthConditions.includes('gout')) {
    dietConflicts.push('تحذير طبي — نقرس + كارنفور:\nالنظام الكارنفور يحتوي على كميات ضخمة من البيورينات (purines) في اللحوم الحمراء، مما يرفع حمض اليوريك في الدم بشكل مباشر ويمكن أن يشعل نوبات النقرس الحادة');
  }
  if ((key === 'carnivore' || key === 'keto') && healthConditions.includes('kidney')) {
    dietConflicts.push('تحذير طبي — كلى + ' + (key === 'keto' ? 'كيتو' : 'كارنفور') + ':\nمرضى الكلى يحتاجون تقليل البروتين (KDOQI: 0.6–0.8 جم/كج). هذا النظام يرفع البروتين بشكل كبير مما يضاعف الضغط على الكلى المتضررة');
  }
  if (key === 'carnivore' && healthConditions.includes('cholesterol')) {
    dietConflicts.push('تحذير — كوليسترول + كارنفور:\nالدهون المشبعة العالية في الكارنفور قد ترفع LDL بشكل ملحوظ. استشر طبيبك أولا إذا كان لديك كوليسترول مرتفع');
  }
  // IMP-4 RC3: Keto + NAFLD incompatibility warning
  // Clinical basis: EASL 2016 — NAFLD requires fat ≤22-25% of calories.
  // Classic keto requires fat ≥65% of calories. These are mutually exclusive.
  // The engine auto-caps fat at 22% which breaks keto macros silently.
  // This warning surfaces that adjustment to the user explicitly.
  if (key === 'keto' && healthConditions.includes('fatty-liver')) {
    dietConflicts.push('تحذير طبي — كبد دهني + كيتو:\nالكيتو الكلاسيكي يتطلب دهونا عالية (≥65% من السعرات)، لكن الكبد الدهني يحتاج الحد من الدهون (≤22–25% وفق إرشادات EASL 2016). لهذا سيعدل النظام التوزيع تلقائيا ولن يكون كيتو كلاسيكيا — ستحصل على نظام منخفض الكربوهيدرات بدهون معتدلة. إذا أردت كيتو صارما، استشر طبيبك أولا');
  }

  if (dietConflicts.length > 0 && window._imp4Acknowledged !== key) {
    // ── IMP-4 RC1: Non-blocking medical conflict modal ─────────────
    // Design decision: medical warnings are shown as a full-screen
    // overlay (non-blocking to JS thread) with two explicit buttons:
    // "أفهم وأستمر" (proceed) and "إلغاء" (cancel).
    // This replaces browser confirm() to avoid:
    //   - thread blocking
    //   - inconsistent native dialog appearance
    //   - inability to style or localise
    // The medical gate is INTENTIONAL and PRESERVED — only the delivery
    // mechanism changed from confirm() to in-page modal.
    // Clinical basis: KDIGO (kidney), ACR (gout), ACC (cholesterol).
    _imp4ShowMedicalModal(key, dietConflicts, healthConditions);
    return; // modal callbacks handle selectDiet re-entry if user proceeds
  }

  DE.selectedDiet = key;
  document.querySelectorAll('.rec-card').forEach(c => c.classList.remove('selected-diet'));
  if (typeof diOnDietSelected === 'function') diOnDietSelected(key);
  document.getElementById(`rec-${key}`)?.classList.add('selected-diet');
  // Rebuild all card indicators inline
  buildRecommendations();
  // If we're on step 6, re-filter foods immediately
  if (DE.currentStep === 7) initStep6();
  LOG(`✔ Diet selected: ${key}${wasSelected && wasSelected !== key ? ' (changed from '+wasSelected+')' : ''}`);
}

// ── IMP-4 RC1: Medical conflict modal helper ─────────────────────────────────
// Non-blocking overlay — replaces browser confirm() for medical gate.
// Preserves the medical intent: user must explicitly acknowledge or cancel.
// _pendingDietKey tracks the key awaiting confirmation so callbacks can
// call selectDiet() cleanly without re-triggering the conflict check.
// ─────────────────────────────────────────────────────────────────────────────
let _imp4PendingKey = null; // key waiting for medical acknowledgment

function _imp4ShowMedicalModal(key, conflicts, conditions) {
  _imp4PendingKey = key;

  // Remove stale modal if any
  const stale = document.getElementById('imp4-medical-modal');
  if (stale) stale.remove();

  const conflictHTML = conflicts
    .map(c => `<div class="imp4-conflict-item">${c.replace(/\n/g, '<br>')}</div>`)
    .join('');

  const modal = document.createElement('div');
  modal.id = 'imp4-medical-modal';
  modal.setAttribute('role', 'alertdialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'تحذير طبي');
  modal.innerHTML = `
    <div class="imp4-backdrop"></div>
    <div class="imp4-dialog">
      <div class="imp4-header">
        <span class="imp4-icon"></span>
        <span class="imp4-title">تحذير طبي — تعارض مع حالتك الصحية</span>
      </div>
      <div class="imp4-body">
        ${conflictHTML}
        <div class="imp4-question">هل تفهم المخاطر وتريد الاستمرار باختيار هذا النظام؟</div>
      </div>
      <div class="imp4-footer">
        <button class="imp4-btn imp4-btn-cancel" onclick="_imp4Cancel()">إلغاء</button>
        <button class="imp4-btn imp4-btn-proceed" onclick="_imp4Proceed()">أفهم المخاطر وأستمر</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  // Focus the cancel button by default (safe choice first)
  setTimeout(() => modal.querySelector('.imp4-btn-cancel')?.focus(), 50);
  LOG(`IMP-4: Medical conflict modal shown for ${key}+[${conditions.join(',')}]`);
}

function _imp4Proceed() {
  const key = _imp4PendingKey;
  _imp4PendingKey = null;
  const modal = document.getElementById('imp4-medical-modal');
  if (modal) modal.remove();
  if (!key) return;
  LOG(`IMP-4: User acknowledged medical conflict — proceeding with ${key}`);
  // Set acknowledgment flag so selectDiet skips conflict check on re-entry
  window._imp4Acknowledged = key;
  selectDiet(key);
  window._imp4Acknowledged = null;
}

function _imp4Cancel() {
  const key = _imp4PendingKey;
  _imp4PendingKey = null;
  const modal = document.getElementById('imp4-medical-modal');
  if (modal) modal.remove();
  LOG(`IMP-4: Diet selection of '${key}' cancelled — medical conflict`);
}
// ── END IMP-4 modal helper ────────────────────────────────────────────────────

// ── L2-1 RC1: Fat floor warning banner ───────────────────────────────────────
// Shows a dismissible banner in the results section when fat allocation
// falls below the LBM-based minimum. Informational only — plan is NOT blocked.
// ─────────────────────────────────────────────────────────────────────────────
function _showFatFloorWarningBanner(actualG, floorG) {
  // Remove stale banner
  const stale = document.getElementById('l21-fat-floor-banner');
  if (stale) stale.remove();

  // Find best container: results section or body fallback
  const container = document.getElementById('res-health-warnings') ||
                    document.getElementById('step-results') ||
                    document.querySelector('.results-section') ||
                    document.body;

  const banner = document.createElement('div');
  banner.id = 'l21-fat-floor-banner';
  banner.className = 'info-box info-warning';
  banner.style.cssText = 'margin: 10px 0; direction: rtl; text-align: right;';
  banner.innerHTML = `
    <span class="ib-icon"></span>
    <span>
      <strong>تنبيه — الدهون أقل من الحد الأدنى الهرموني:</strong>
      الخطة تحتوي على ${actualG}جم دهون، وهو أقل من الحد الأدنى المحسوب (${floorG}جم).
      قد يؤثر ذلك على هرمونات الستيرويد وامتصاص الفيتامينات الدهنية.
      راجع توزيع الدهون في الخطة
    </span>
    <button onclick="this.parentElement.remove()" style="
      background:none; border:none; cursor:pointer; color:var(--orange);
      font-size:16px; margin-right:auto; padding:0 4px; flex-shrink:0;
    ">×</button>`;

  if (container === document.getElementById('res-health-warnings')) {
    container.style.display = '';
    container.appendChild(banner);
  } else {
    container.insertBefore(banner, container.firstChild);
  }
  LOG(`[L2-1] Fat floor banner shown: actual=${actualG}g < floor=${floorG}g`);
}
// ── END L2-1 fat floor banner ─────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
//  STEP 7 — RESULTS (Phase 5 + 8)
// ═══════════════════════════════════════════════════════════════
function buildResults() {
  LOG('Building Smart Results (Phase 5+8)...');

  // ── Read user data into DE with optional chaining and fallback
  DE.gender = document.getElementById('inp-gender')?.value || DE.gender || 'ذكر';
  DE.age    = parseInt(document.getElementById('inp-age')?.value) || DE.age || 25;
  DE.height = parseInt(document.getElementById('inp-height')?.value) || DE.height || 175;
  DE.weight = parseFloat(document.getElementById('inp-weight')?.value) || DE.weight || 70;
  DE.target = parseFloat(document.getElementById('inp-target')?.value) || DE.target || 70;

  // -- BRIDGE (FIX): merge page-7 SMPS pool selections into DE.availableFoods --
  // The 90-day pool builder (step 7) stores the user's food choices in
  // SMPS.pool (a Set per meal slot). The daily results section + the
  // downloadable plan are built from DE.availableFoods. Without this sync the
  // results showed EMPTY meals (each falling back to the per-meal calorie
  // target, e.g. a repeated 654 kcal) even though the user had picked foods.
  // We merge every food chosen in any SMPS slot into availableFoods so both
  // systems share the same selections. Safe no-op when SMPS.pool is empty.
  try {
    if (typeof SMPS !== 'undefined' && SMPS && SMPS.pool) {
      if (!Array.isArray(DE.availableFoods)) DE.availableFoods = [];
      var _afSeen = new Set(DE.availableFoods);
      Object.keys(SMPS.pool).forEach(function(_sk){
        var _set = SMPS.pool[_sk];
        if (_set && typeof _set.forEach === 'function') {
          _set.forEach(function(_id){
            if (_id && !_afSeen.has(_id)) { _afSeen.add(_id); DE.availableFoods.push(_id); }
          });
        }
      });
      LOG('[bridge] SMPS pool merged into availableFoods, total = ' + DE.availableFoods.length);
    }
  } catch (_bridgeErr) {
    console.warn('[bridge] SMPS->availableFoods failed:', _bridgeErr);
  }

  const cals   = calcTargetCals();
  const macros = calcMacros(cals, DE.selectedDiet);
  const tdee   = calcTDEE();
  const bmr    = calcBMR();
  const bf     = estimateBodyFat();
  const lbm    = calcLBM();
  const bulk   = isBulkScenario();
  const deficit = Math.abs(cals - tdee);
  const weeklyRate = parseFloat(document.getElementById('inp-weekly-rate')?.value) || 0.5;
  const wkKg   = bulk ? weeklyRate.toFixed(2) : ((deficit * 7) / 7700).toFixed(2);

  // ── FIX: Low-TDEE floor warning ────────────────────────────────
  // When TDEE is at or below the safety floor (1200f/1400m), a cut goal
  // produces the same calories as maintain — warn the user clearly.
  const _floor = DE.gender === 'female' ? 1200 : 1400;
  if (DE.goal === 'cut' && tdee <= _floor + 50) {
    LOG('LOW-TDEE: TDEE near floor — cut plan auto-converted to maintain calorie level');
    const _warn = document.getElementById('res-goal-note');
    if (_warn) {
      _warn.style.display = 'flex';
      _warn.innerHTML = `<span class="ib-icon"></span><span>
        <b>تنبيه:</b> معدل حرقك اليومي (TDEE=${tdee} سعرة) قريب جدا من الحد الأدنى الآمن.
        الخطة ستعمل على <b>المحافظة</b> فعليا حتى لا تنزل تحت ${_floor} سعرة.
        لتحقيق التنشيف: زد مستوى النشاط أو اصبر على نتائج بطيئة
      </span>`;
    }
  }

  // ── FIX: Keto/Carnivore auto-convert warning (PATCH 1 side effect) ─
  // When PATCH 1 releases the carb cap to prevent starvation, the user
  // selected keto/carnivore but is receiving a balanced macro split.
  // Warn them explicitly so they understand what happened.
  const _isRestrictiveDiet = ['keto','carnivore'].includes(DE.selectedDiet);
  if (_isRestrictiveDiet) {
    const _rawCarb = Math.round((cals - macros.protein*4 - macros.fat*9) / 4);
    const _capLimit = DE.selectedDiet === 'keto' ? 40 : 10;
    if (_rawCarb > _capLimit * 1.5) {  // cap was released
      LOG(`DIET-CONVERT: ${DE.selectedDiet} carb cap released by PATCH1 — user notified`);
      const _existingNote = document.getElementById('res-goal-note');
      if (_existingNote && _existingNote.style.display === 'none') {
        _existingNote.style.display = 'flex';
        _existingNote.innerHTML = `<span class="ib-icon"></span><span>
          <b>تعديل تلقائي:</b> نظام ${DE.selectedDiet === 'keto' ? 'الكيتو' : 'الكارنيفور'}
          يتطلب دهونا عالية جدا مع بياناتك الحالية، مما قد يقلل إجمالي السعرات بشكل غير آمن.
          قام النظام بتعديل توزيع الماكروز للحفاظ على هدف السعرات.
          النتيجة: نظام <b>منخفض الكربوهيدرات</b> بدلا من ${DE.selectedDiet === 'keto' ? 'كيتو كلاسيكي' : 'كارنيفور صارم'}.
        </span>`;
      }
    }
  }
  // ── PATCH 4 START: Timeline NaN / Infinity Guard ──────────────────────
  // For 'maintain' and 'recomp', wkKg approaches 0 - Math.ceil produces
  // Infinity or NaN. Guard strictly on goal type and wkKg > 0.
  let wksTo;
  if (['cut', 'bulk'].includes(DE.goal) && parseFloat(wkKg) > 0) {
    wksTo = Math.ceil(Math.abs(DE.weight - DE.target) / parseFloat(wkKg));
  } else {
    wksTo = 'هدف مستمر'; // maintain / recomp have no finite endpoint
  }
  // ── PATCH 4 END ─────────────────────────────────────────────────────────
  // ── Water: use adaptive formula (health-aware) ────────────────
  // Base: 35ml/kg. Adjusted for medical conditions via L2-2 wrapper.
  // Falls back to 35ml/kg if L2-2 hasn't run yet (first render).
  let waterML = DE.v31WaterML || Math.round(DE.weight * 35);
  // FIX: Clamp to safe display range in case L2-2 hasn't run yet
  waterML = Math.max(1500, Math.min(5000, waterML));

  // ── Stats grid — enhanced with LBM, BF, BMR, water
  const resStatsEl = document.getElementById('res-stats');
  if (resStatsEl) {
    resStatsEl.innerHTML = `
      <div class="stat-box"><div class="stat-val">${cals}</div><div class="stat-lbl">سعرة يوميا</div></div>
      <div class="stat-box"><div class="stat-val" style="color:var(--green)">${macros.protein}ج</div><div class="stat-lbl">بروتين</div></div>
      <div class="stat-box"><div class="stat-val" style="color:var(--blue)">${macros.carbs}ج</div><div class="stat-lbl">كارب</div></div>
      <div class="stat-box"><div class="stat-val" style="color:var(--orange)">${macros.fat}ج</div><div class="stat-lbl">دهون</div></div>
      <div class="stat-box"><div class="stat-val">${tdee}</div><div class="stat-lbl">TDEE</div></div>
      <div class="stat-box"><div class="stat-val">${wkKg}كجم</div><div class="stat-lbl">${bulk?'زيادة':'نزول'}/أسبوع</div></div>
      <div class="stat-box"><div class="stat-val" style="color:var(--purple)">${lbm}كجم</div><div class="stat-lbl">كتلة عضلية LBM</div></div>
      <div class="stat-box"><div class="stat-val" style="color:var(--text-muted)">${bf}%</div><div class="stat-lbl">دهون الجسم</div></div>
      <div class="stat-box"><div class="stat-val" style="color:var(--blue)">${bmr}</div><div class="stat-lbl">BMR (حرق الأساس)</div></div>
      <div class="stat-box"><div class="stat-val" style="color:var(--blue)">${waterML}مل</div><div class="stat-lbl">ماء يومي موصى به</div></div>`;
  }

  // ── Smart Macro Explanation — "لماذا هذه الأرقام؟" ─────────────
  const protPerKgLBM = lbm > 0 ? (macros.protein / lbm).toFixed(2) : '—';
  const protReason = DE.goal === 'cut'
    ? `بروتين مرتفع ${macros.protein}ج (${protPerKgLBM}ج/كجم عضل) — لحماية العضلات أثناء التنشيف، بناء على Helms/Norton 2014`
    : DE.goal === 'bulk'
    ? (DE.gainStyle === 'mass'
        ? `بروتين ${macros.protein}ج (${protPerKgLBM}ج/كجم عضل) — ISSN 1.8–2.2ج/كجم · الفائض الأكبر يكمل بناء الكتلة العضلية`
        : `بروتين مرتفع ${macros.protein}ج (${protPerKgLBM}ج/كجم عضل) — 2.0–2.4ج/كجم للزيادة العضلية النظيفة مع فائض صغير (Schoenfeld 2018)`)
    : DE.goal === 'recomp'
    ? `بروتين عالي ${macros.protein}ج لل Recomp — يبني العضل ويحرق الدهون بالتزامن`
    : `بروتين ${macros.protein}ج (${protPerKgLBM}ج/كجم عضل) — كاف للحفاظ على الكتلة العضلية`;
  const carbReason = DE.healthConditions.includes('diabetes') || DE.healthConditions.includes('insulin')
    ? `كارب مخفض ${macros.carbs}ج — معدل للسكري/مقاومة الإنسولين، كارب معقد فقط`
    : DE.selectedDiet === 'keto'
    ? `كارب كيتوجيني ≤${macros.carbs}ج صافي — يحافظ على حالة Ketosis`
    : `كارب ${macros.carbs}ج — يملأ الجليكوجين العضلي ويدعم الطاقة والأداء`;
  const fatReason = DE.healthConditions.includes('cholesterol')
    ? `دهون مخفضة ${macros.fat}ج — ضمن حدود الكولسترول الصحية (≤20% سعرات)`
    : DE.goal === 'bulk' && DE.gainStyle === 'lean'
    ? `دهون ${macros.fat}ج (23% سعرات) — منخفضة عمدا لتوسيع كارب الجليكوجين العضلي في الزيادة النظيفة`
    : DE.goal === 'bulk' && DE.gainStyle === 'mass'
    ? `دهون ${macros.fat}ج (27% سعرات) — مناسبة للفائض الأكبر مع الحفاظ على التوازن الهرموني`
    : `دهون ${macros.fat}ج — الحد الأدنى الهرموني: 0.7ج/كجم لصحة الهرمونات`;

  const macroExplainEl = document.getElementById('res-macro-explain');
  if (macroExplainEl) {
    macroExplainEl.style.display = 'block';
    macroExplainEl.innerHTML = `
      <div class="info-box info-blue" style="flex-direction:column;align-items:flex-start;gap:5px;">
        <div style="font-weight:800;font-size:12px;margin-bottom:2px;">لماذا هذه الماكروز بالتحديد؟</div>
        <div style="font-size:11.5px;line-height:1.8;color:var(--text);">
          <span style="color:var(--green);">${protReason}</span><br>
          <span style="color:var(--blue);">${carbReason}</span><br>
          <span style="color:var(--orange);">${fatReason}</span>
        </div>
        <div style="font-size:10.5px;color:var(--text-dim);margin-top:2px;">
          الحسابات بناء على: Mifflin St Jeor BMR · Navy BF% · LBM-based protein · ISSN/ACSM guidelines
        </div>
      </div>`;
  }

  const dietLabel = DIETS[DE.selectedDiet]?.label || DE.selectedDiet;
  const resRecBadgeEl = document.getElementById('res-rec-badge');
  if (resRecBadgeEl) {
    resRecBadgeEl.innerHTML = `<div class="rec-badge">${dietLabel} · ${bulk?(DE.gainStyle==='mass'?'ضخامة':'زيادة عضلية'):DE.goal==='cut'?'تخسيس':'تثبيت'}</div>`;
  }

  // v44: Hydration (IOM 2004: 35ml/kg base)
  (function(){
    var b=Math.round(DE.weight*35);
    var e=DE.healthConditions.includes('kidney')?0:['keto','carnivore'].includes(DE.selectedDiet)?500:DE.goal==='bulk'?400:200;
    var kdn=DE.healthConditions.includes('kidney');
    DE._hydNote='توصية السوائل: <strong>'+((b+e)/1000).toFixed(1)+' لتر/يوم<\/strong>'+(kdn?' — استشر طبيبك لتحديد الكمية':' ('+b+' مل أساسي + '+e+' مل إضافي)');
  })();
  const goalNotes = {
    cut:      `عجز ${deficit} سعرة/يوم (${weeklyRate} كجم/أسبوع) — وصول الهدف ~${wksTo} أسبوع`,
    bulk:     (DE.gainStyle === 'mass')
                ? `فائض ${deficit} سعرة/يوم — ضخامة ~${wkKg}كجم/أسبوع`
                : `فائض ${deficit} سعرة/يوم — زيادة عضلية نظيفة ~${wkKg}كجم/أسبوع`,
    recomp:   `عجز طفيف ${deficit} سعرة — بروتين عالي ${macros.protein}ج لل Recomp`,
    maintain: `سعرات تساوي الحرق — TDEE ${tdee} سعرة/يوم`
  };
  const resGoalNoteEl = document.getElementById('res-goal-note');
  if (resGoalNoteEl) {
    resGoalNoteEl.style.display = 'flex';
  }
  const resGoalNoteTextEl = document.getElementById('res-goal-note-text');
  if (resGoalNoteTextEl) {
    resGoalNoteTextEl.textContent = goalNotes[DE.goal]||'';
    if(DE._hydNote){
      var hEl=document.getElementById('res-hydration-note');
      if(!hEl){hEl=document.createElement('div');hEl.id='res-hydration-note';
        hEl.style.cssText='background:#e8f4fd;border:1px solid #90c8f0;border-radius:8px;padding:10px 14px;margin-top:10px;color:#1a5276;font-size:13px;';
        if(resGoalNoteTextEl&&resGoalNoteTextEl.parentNode)
          resGoalNoteTextEl.parentNode.insertBefore(hEl,resGoalNoteTextEl.nextSibling);}
      hEl.innerHTML=DE._hydNote;hEl.style.display='block';}
    // ── Natural Recomp opportunity: detect & surface for maintain goal ──
    // Condition: maintain goal + BF ≥ 18% + resistance training ≥ 3 days/wk
    // At these conditions the user can build muscle and lose fat simultaneously
    // without any surplus/deficit — just protein + progressive overload.
    if (DE.goal === 'maintain') {
      const _rcBf = parseFloat(document.getElementById('inp-bf')?.value) || 0;
      const _rcTd = parseInt(document.getElementById('inp-train-days')?.value) || 0;
      if (_rcBf >= 18 && _rcTd >= 3) {
        resGoalNoteTextEl.textContent += ' — وضعك مثالي لRecomp طبيعي: دهون ≥18% + تمرين مقاومة 3+ أيام - ستبني عضلا وتحرق دهونا بنفس السعرات دون حاجة لتغيير هدفك';
      }
    }
  }

  // ── Diet Recommendation Explanation box
  const dietExplainEl = document.getElementById('res-diet-explain');
  if (dietExplainEl && DE.selectedDiet) {
    const scored = Object.keys(DIETS).map(k => ({ key:k, ...scoreDiet(k) }));
    const thisDiet = scored.find(d => d.key === DE.selectedDiet);
    const bestDiet = [...scored].sort((a,b) => b.score - a.score)[0];
    const isTopRec = DE.selectedDiet === bestDiet.key;

    const dietExplainMap = {
      balanced:  'نظام متوازن يوزع السعرات على البروتين والكارب والدهون بنسب صحية، مرن وسهل الالتزام، مناسب لأغلب الأهداف',
      lowcarb:   'نظام يخفض الكارب ل 20–30% من السعرات ويرفع البروتين والدهون، يعجل فقد الدهون ويحسن حساسية الإنسولين',
      carbcycle: 'نظام يتناوب بين أيام كارب عالي (أيام التمرين) وكارب منخفض (أيام الراحة)، يحافظ على الأيض ويدعم بناء العضل',
      keto:      'نظام كيتوجيني: كارب ≤50ج/يوم، دهون 65–75%، يدخل الجسم في حالة ketosis لحرق الدهون مباشرة كوقود',
      carnivore: 'نظام اللحوم فقط: بروتين ودهون حيوانية بالكامل، كارب قريب من الصفر، مناسب لحالات خاصة'
    };
    const topReasons = thisDiet?.reasons?.slice(0,3) || [];
    const topWarnings = thisDiet?.warnings?.slice(0,2) || [];

    dietExplainEl.style.display = 'block';
    dietExplainEl.innerHTML = `
      <div class="info-box info-green" style="flex-direction:column;align-items:flex-start;gap:6px;">
        <div style="font-weight:800;font-size:13px;">تم ترشيح: ${dietLabel}${isTopRec?' (الأعلى توافقا مع بياناتك)':''}</div>
        <div style="font-size:12px;line-height:1.8;color:var(--text);">${dietExplainMap[DE.selectedDiet]||''}</div>
        ${topReasons.length ? `<div style="font-size:12px;color:var(--green);">${topReasons.join(' · ')}</div>` : ''}
        ${topWarnings.length ? `<div style="font-size:12px;color:var(--orange);">${topWarnings.join(' · ')}</div>` : ''}
        <div style="font-size:11px;color:var(--text-dim);margin-top:4px;border-top:1px solid var(--border);padding-top:6px;">
         هذه ليست نصيحة طبية — استشر طبيبك أو أخصائي تغذية قبل البدء. الاختيار النهائي دائما لك
        </div>
      </div>`;
  }

  // ── Calorie Floor Warning — visible when calcTargetCals hit the safety floor ──
  {
    let _flWarn = document.getElementById('res-floor-warning');
    if (!_flWarn) {
      _flWarn = document.createElement('div');
      _flWarn.id = 'res-floor-warning';
      const _hwEl = document.getElementById('res-health-warnings');
      if (_hwEl && _hwEl.parentNode) _hwEl.parentNode.insertBefore(_flWarn, _hwEl);
    }
    if (DE._calorieFloorApplied) {
      _flWarn.className = 'info-box info-warning';
      _flWarn.style.cssText = 'margin-bottom:10px;';
      _flWarn.style.display = 'flex';
      _flWarn.innerHTML = `<span class="ib-icon"></span><span>تم رفع السعرات من <strong>${DE._calorieFloorFrom}</strong> إلى <strong>${DE._calorieFloorTo}</strong> سعرة — الحد الأدنى الأمني للجسم. معدل التغيير المختار مرتفع جدا لوزنك الحالي. نوصي باختيار معدل أبطأ للحفاظ على العضلات</span>`;
    } else {
      _flWarn.style.display = 'none';
    }
  }

  // ── Health Warnings
  if (DE.healthConditions.length) {
    document.getElementById('res-health-warnings').style.display = 'block';
    if (DE._ageWarning) {
      const _awB = document.getElementById('res-health-warnings-body');
      if (_awB) {
        const _d = document.createElement('div');
        _d.style.cssText='background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:10px 14px;margin-bottom:10px;color:#856404;font-size:13px;';
        _d.innerHTML='<strong>تنبيه:<\/strong> '+DE._ageWarning;
        _awB.insertBefore(_d,_awB.firstChild);
      }
    }
    document.getElementById('res-health-warnings-body').innerHTML = DE.healthConditions.map(hc =>
      `<div class="info-box info-warning" style="margin-bottom:6px;"><span class="ib-icon"></span><span>${HEALTH_IMPACTS[hc]||hc}</span></div>`
    ).join('');
  }

  // ── Clinical Protocol — GAP-2/3/5/6 ────────────────────────────────────────
  // Renders condition-specific clinical protocols for:
  //   GAP-2: PCOS - Inositol + Supplement protocol (BioNatura 2025, ScienceDirect 2025)
  //   GAP-3: Cholesterol + Keto - Lean Mass Hyper-Responder warning
  //   GAP-5: Insulin Resistance - eTRF eating window protocol (Sutton 2018)
  //   GAP-1: Hypothyroid/Hyperthyroid - specific clinical guidance
  //   GAP-6: Fatty Liver - fructose-specific warning
  //   GAP-4: Anemia type differentiation guidance
  const _clinProtocols = [];
  const _hc = DE.healthConditions;

  // ── PCOS Clinical Protocol ───────────────────────────────────────────────
  if (_hc.includes('pcos')) {
    _clinProtocols.push(`
      <div class="info-box info-blue" style="margin-bottom:10px;flex-direction:column;align-items:flex-start;gap:6px;">
        <span class="ib-icon" style="margin-bottom:2px;"></span>
        <strong style="font-size:13px;">بروتوكول PCOS — المكملات الغذائية (مثبت علميا 2025)</strong>
        <span style="line-height:1.9;font-size:12px;">
          ① <strong>Myo-Inositol 2000 مجم + D-Chiro-Inositol 50 مجم</strong> يوميا (نسبة 40:1) — يحسن حساسية الإنسولين بفعالية تعادل Metformin وبدون أعراض جانبية · مدة: 3–6 أشهر<br>
          ② <strong>فيتامين D3: 2000–4000 وحدة/يوم</strong> — نقصه يفاقم مقاومة الإنسولين في PCOS. افحص مستوياتك أولا<br>
          ③ <strong>أوميغا-3: 2–4 جم/يوم</strong> (EPA+DHA) — يقلل الأندروجينات الزائدة ويخفف الالتهاب المزمن<br>
          ④ <strong>كروم بيكولينات: 200 ميكروجم/يوم</strong> — يحسن استجابة الخلايا للإنسولين ويقلل الرغبة في السكريات<br>
          ⑤ <strong>المغنيسيوم: 300–400 مجم/يوم</strong> — 70% من مريضات PCOS لديهن نقص مغنيسيوم<br>
          <span style="color:var(--text-dim);font-size:11px;">المرجع: BioNatura Journal 2025 · ScienceDirect PCOS 2025 · Meta-analysis Pkhaladze 2015</span><br>
          <span style="color:var(--orange);font-size:11px;">استشيري طبيبك أو أخصائية نساء وتوليد قبل البدء بأي مكمل</span>
        </span>
      </div>`);
  }

  // ── Hypothyroid Clinical Protocol ───────────────────────────────────────
  if (_hc.includes('hypothyroid')) {
    _clinProtocols.push(`
      <div class="info-box info-blue" style="margin-bottom:10px;flex-direction:column;align-items:flex-start;gap:6px;">
        <span class="ib-icon" style="margin-bottom:2px;"></span>
        <strong style="font-size:13px;">بروتوكول قصور الغدة الدرقية — التغذية الداعمة</strong>
        <span style="line-height:1.9;font-size:12px;">
          ① <strong>السيلينيوم: 55–200 ميكروجم/يوم</strong> — ضروري لإنزيمات تحويل T4 - T3 (deiodinase). أفضل مصدر: تونة معلبة أو مكسرات برازيلية (1-2 حبة/يوم = الاكتفاء اليومي)<br>
          ② <strong>الزنك: 8–11 مجم/يوم</strong> — ينشط مستقبلات هرمون T3. مصادر: لحم العجل، دواجن، بقوليات<br>
          ③ <strong>اليود: من الطعام لا المكمل</strong> — 2-3 وجبات أسماك أسبوعيا كافية. تجنب مكملات اليود بدون تحليل طبي<br>
          ④ <strong>فيتامين D3: 1000–2000 وحدة/يوم</strong> — نقصه شائع جدا مع قصور الغدة<br>
          ⑤ <strong>الصليبيات: مطبوخة فقط</strong> — السلق أو البخار يعطل الجويترين بنسبة 87%. لا تأكلها نيئة<br>
          ⑥ <strong>فترة الدواء</strong> — إذا كنت على Levothyroxine: تناوله صائما قبل الأكل ب 30-60 دقيقة. الكافيين والكالسيوم يعيقان امتصاصه<br>
          <span style="color:var(--text-dim);font-size:11px;">المرجع: Thyroid Journal 2022 · Köhrle et al. 2023</span>
        </span>
      </div>`);
  }

  // ── Hyperthyroid Clinical Protocol ──────────────────────────────────────
  if (_hc.includes('hyperthyroid')) {
    _clinProtocols.push(`
      <div class="info-box info-warning" style="margin-bottom:10px;flex-direction:column;align-items:flex-start;gap:6px;">
        <span class="ib-icon" style="margin-bottom:2px;"></span>
        <strong style="font-size:13px;">بروتوكول فرط نشاط الغدة الدرقية — التغذية المعدلة</strong>
        <span style="line-height:1.9;font-size:12px;">
          ① <strong>تجنب اليود الزائد تماما</strong> — لا ملح معالج بيود، لا أعشاب بحرية، قلل السردين والتونة الطازجة. اليود يحفز الغدة المفرطة النشاط<br>
          ② <strong>الكالسيوم: 1000–1200 مجم/يوم</strong> — فرط الغدة يسرع فقدان الكثافة العظمية. منتجات ألبان + خضروات ورقية<br>
          ③ <strong>المغنيسيوم: 350-400 مجم/يوم</strong> — يخفف الخفقان والتوتر العصبي المصاحب لفرط الغدة<br>
          ④ <strong>بروتين عال: 1.5–2 جم/كجم</strong> — الأيض المرتفع يسرع هدم العضلات. البروتين يحميها<br>
          ⑤ <strong>الصليبيات: مفيدة لك</strong> — بروكلي وقرنبيط يحتويان على جويترين يبطئ نشاط الغدة طبيا (mild goitrogen — therapeutic)<br>
          ⑥ <strong>قلل الكافيين</strong> — القهوة والشاي يفاقمان الخفقان وارتفاع ضغط الدم المصاحبين لفرط الغدة<br>
          <span style="color:var(--orange);font-size:11px;">فرط الغدة يحتاج متابعة طبية دقيقة — التغذية داعمة وليست بديلا عن العلاج</span>
        </span>
      </div>`);
  }

  // ── GAP-3: Cholesterol + Keto — Lean Mass Hyper-Responder Warning ────────
  if (_hc.includes('cholesterol') && DE.selectedDiet === 'keto') {
    _clinProtocols.push(`
      <div class="info-box info-warning" style="margin-bottom:10px;flex-direction:column;align-items:flex-start;gap:6px;">
        <span class="ib-icon" style="margin-bottom:2px;"></span>
        <strong style="font-size:13px;">تنبيه: كيتو + كوليسترول مرتفع — ظاهرة LMHR</strong>
        <span style="line-height:1.9;font-size:12px;">
          بعض الأشخاص النحيفين وعالي النشاط على الكيتو يختبرون ارتفاعا حادا في LDL-C (يعرف ب Lean Mass Hyper-Responder LMHR)<br>
          <strong>المهم:</strong> ارتفاع LDL-C في هؤلاء يصاحبه <strong>ارتفاع HDL وانخفاض الدهون الثلاثية</strong> — وهو نمط مختلف عن الكوليسترول الخطر<br>
          ① افحص <strong>Lipid Panel كامل + ApoB</strong> بعد 8 أسابيع من بدء الكيتو<br>
          ② إذا ارتفع LDL-C مع ارتفاع HDL وانخفاض TG - راجع طبيبك لتقييم المخاطر الشخصية<br>
          ③ بديل آمن: Low Carb (بدلا من كيتو صارم) مع دهون أكثر تنوعا يقلل هذه الاستجابة<br>
          <span style="color:var(--text-dim);font-size:11px;">المرجع: Norwitz et al. 2022 — LMHR Phenotype · Virta Health Research 2023</span>
        </span>
      </div>`);
  }

  // ── GAP-5: Insulin Resistance — eTRF Eating Window Protocol ─────────────
  if (_hc.includes('insulin')) {
    _clinProtocols.push(`
      <div class="info-box info-blue" style="margin-bottom:10px;flex-direction:column;align-items:flex-start;gap:6px;">
        <span class="ib-icon" style="margin-bottom:2px;">⏱</span>
        <strong style="font-size:13px;">بروتوكول مقاومة الإنسولين — نافذة الأكل الزمنية (eTRF)</strong>
        <span style="line-height:1.9;font-size:12px;">
          الصيام المتقطع بنظام <strong>8–10 ساعات</strong> (Eating Window) يحسن حساسية الإنسولين بشكل مستقل عن فقدان الوزن نفسه<br>
          ① <strong>النافذة المثلى: 7 صباحا – 5 مساء</strong> (early TRF) — الدراسات تثبت أن توقيت الأكل الصباحي يتفوق على المسائي ب 36% في تحسين حساسية الإنسولين<br>
          ② <strong>أول وجبة: بروتين + دهون</strong> (لا كارب وحده) — يمنع ارتفاع الإنسولين الصباحي الحاد<br>
          ③ <strong>آخر وجبة: قبل الغروب بساعة على الأقل</strong> — حساسية الإنسولين تنخفض تدريجيا بعد الغروب<br>
          ④ <strong>الصيام: 14–16 ساعة</strong> — يعيد ضبط مستقبلات الإنسولين ويقلل مستوياته الأساسية<br>
          ⑤ في أيام التمرين: يمكن توسيع النافذة إلى 10 ساعات حسب وقت التمرين<br>
          <span style="color:var(--text-dim);font-size:11px;">المرجع: Sutton 2018 CELL METABOLISM — eTRF يحسن حساسية الإنسولين بدون فقدان وزن</span>
        </span>
      </div>`);
  }

  // ── GAP-6: Fatty Liver — Fructose-specific warning ──────────────────────
  if (_hc.includes('fatty-liver')) {
    _clinProtocols.push(`
      <div class="info-box info-warning" style="margin-bottom:10px;flex-direction:column;align-items:flex-start;gap:6px;">
        <span class="ib-icon" style="margin-bottom:2px;"></span>
        <strong style="font-size:13px;">الكبد الدهني — الفركتوز هو العدو الأول</strong>
        <span style="line-height:1.9;font-size:12px;">
          الكبد هو العضو الوحيد الذي يحول الفركتوز إلى دهون مباشرة (De Novo Lipogenesis)<br>
          ① <strong>تجنب تماما:</strong> عصائر الفاكهة، مشروبات سكرية، شراب الذرة عالي الفركتوز، تمر بكميات كبيرة<br>
          ② <strong>الفاكهة الكاملة مسموحة بحد 2 حبة/يوم</strong> — الألياف تبطئ امتصاص الفركتوز<br>
          ③ <strong>الكحول صفر</strong> — حتى كميات صغيرة تسرع تراكم الدهون في الكبد الدهني غير الكحولي NAFLD<br>
          ④ <strong>فقدان 7–10% من وزنك</strong> هو الهدف الأول — هذا وحده يحسن NAFLD في 80% من الحالات<br>
          ⑤ <strong>القهوة السوداء: مفيدة!</strong> — 2-3 أكواب/يوم تقلل التليف الكبدي بنسبة 40% (دراسات متعددة)<br>
          <span style="color:var(--text-dim);font-size:11px;">المرجع: Targher et al. 2021 — Fructose and NAFLD · AASLD Guidelines 2023</span>
        </span>
      </div>`);
  }

  // ── GAP-4: Anemia — type differentiation ────────────────────────────────
  if (_hc.includes('anemia')) {
    _clinProtocols.push(`
      <div class="info-box info-blue" style="margin-bottom:10px;flex-direction:column;align-items:flex-start;gap:6px;">
        <span class="ib-icon" style="margin-bottom:2px;"></span>
        <strong style="font-size:13px;">الأنيميا — النوع يحدد العلاج الغذائي</strong>
        <span style="line-height:1.9;font-size:12px;">
          <strong>① أنيميا الحديد (الأكثر شيوعا):</strong> حديد هيمي من اللحوم الحمراء + فيتامين C في نفس الوجبة لمضاعفة الامتصاص. تجنب الشاي والقهوة مع وجبة الحديد ب ساعة على الأقل<br>
          <strong>② أنيميا B12:</strong> منتجات حيوانية يوميا (لحم، بيض، ألبان). النباتيون يحتاجون مكمل B12 بالضرورة<br>
          <strong>③ أنيميا حمض الفوليك:</strong> خضروات ورقية داكنة (سبانخ، جرجير)، بقوليات، خبز كامل<br>
          <strong>④ أنيميا الأمراض المزمنة (مع CKD/التهاب):</strong> الحديد الزائد قد يكون ضارا — استشر طبيبك قبل أي مكمل<br>
          <strong>الخطوة الأولى:</strong> تحليل CBC + Serum Iron + Ferritin + B12 + Folate لتحديد النوع بدقة<br>
          <span style="color:var(--orange);font-size:11px;">لا تأخذ مكملات حديد بدون تشخيص طبي — الحديد الزائد سام</span>
        </span>
      </div>`);
  }

  // ── GAP-7: Sleep Protocol — automatic tip if sleep < 6h ────────────────
  const _sleepVal = parseFloat(document.getElementById('inp-sleep')?.value) || 0;
  if (_sleepVal > 0 && _sleepVal < 6) {
    _clinProtocols.push(`
      <div class="info-box info-warning" style="margin-bottom:10px;flex-direction:column;align-items:flex-start;gap:6px;">
        <span class="ib-icon" style="margin-bottom:2px;"></span>
        <strong style="font-size:13px;">تنبيه: نقص النوم يعاكس هدفك الغذائي</strong>
        <span style="line-height:1.9;font-size:12px;">
          <strong>النوم ${_sleepVal} ساعات فقط</strong> يحدث اختلالا هرمونيا مباشرا:<br>
          ① <strong>جريلين +28%</strong> (هرمون الجوع يرتفع) — ستشعر بجوع أشد بكثير من حاجتك الحقيقية<br>
          ② <strong>ليبتين −18%</strong> (هرمون الشبع ينخفض) — صعوبة الإحساس بالامتلاء حتى بعد الأكل<br>
          ③ <strong>كورتيزول مرتفع</strong> — يخزن الدهون في منطقة البطن تحديدا<br>
          ④ <strong>هدم العضلات يتسارع</strong> — لذلك رفعنا هدف بروتينك تلقائيا ب 7% في هذه الخطة<br>
          <strong>الحل الأول قبل الدايت:</strong> استهدف 7–9 ساعات نوم — ساعة نوم إضافية قد تساوي أسبوع كامل من الدايت في تأثيرها على الهرمونات<br>
          <span style="color:var(--text-dim);font-size:11px;">المرجع: Spiegel 2004 · Taheri PLOS Medicine 2004 · Van Cauter 2008</span>
        </span>
      </div>`);
  }

  // ── Render all clinical protocols if any ────────────────────────────────
  if (_clinProtocols.length > 0) {
    document.getElementById('res-clinical-protocol').style.display = 'block';
    document.getElementById('res-clinical-protocol-body').innerHTML = _clinProtocols.join('');
  }

  // ── Problem Solutions — علمية ومفصلة
  const PROB_SOLUTIONS = {
    hunger: `<strong>الجوع الشديد:</strong> البروتين هو الماكرو الأشبع — استهدف 35–40% من سعراتك بروتين. أضف ألياف قابلة للذوبان (شوفان، تفاح، بقوليات) لتبطئ الإفراغ المعدي. اشرب 500مل ماء قبل كل وجبة ب 20 دقيقة — يقلل الكمية المتناولة 13% (دراسة Davy 2010). الخضار الورقية والخيار بلا حدود`,
    sweets: `<strong>الرغبة في الحلويات:</strong> السبب الأساسي: انخفاض سكر الدم أو نقص الكروم/المغنيسيوم. الحل: ① لا تدع فترة بين الوجبات تتجاوز 4 ساعات ② شوكولاتة داكنة 85%+ (20–25ج) تشبع الرغبة ب 120 سعرة فقط ③ تمر + جبن قريش = بديل صحي للحلو ④ تأكد من كفاية الكارب المعقد في وجبات النهار`,
    satiety: `<strong>ضعف الشبع:</strong> ① كثافة الطعام أهم من حجمه — 500ج خضار = 100 سعرة فقط ② الدهون الصحية (أفوكادو، زيت زيتون، مكسرات) تبطئ امتصاص الكارب وتطيل الشبع ③ البروتين يرفع هرمون PYY ويخفض الجريلين (هرمون الجوع) ④ الأكل ببطء 20 دقيقة — يمنح الدماغ وقت لاستقبال إشارة الشبع`,
    emotional: `<strong>الأكل العاطفي:</strong> ① سجل المشاعر قبل الأكل — معظم نوبات الأكل العاطفي تستمر فقط 10–15 دقيقة ② استبدل ب: نشاط بدني خفيف، شرب ماء دافئ، تنفس عميق ③ احتفظ ب سناك بروتيني محضر مسبقا (بيضة مسلوقة، قريش) لتجنب قرارات الجوع العاطفي ④ وجبات منتظمة كل 4–5 ساعات تقلل تقلبات السكر المحفزة للأكل العاطفي`,
    adherence: `<strong>ضعف الالتزام:</strong> ① مبدأ 80/20 — الالتزام 80% من الوقت كاف لنتائج ممتازة ② ابدأ بالتغييرات الصغيرة: استبدل مكون واحد في اليوم لا كل شيء ③ Habit Stacking: اربط التحضير بعادة قائمة (مثلا: بعد العشاء جهز فطار الغد) ④ قاعدة "لا يومين متتاليين" — إذا أخطأت يوما، العودة في اليوم التالي مباشرة`,
    time: `<strong>ضيق الوقت:</strong> ① Batch Cooking: ساعة واحدة يوم الجمعة تكفي ل 5 أيام — اطبخ كميات كبيرة من البروتين والكارب ② 5 وجبات جاهزة: بيض مسلوق + تونة + فراخ مشوي + أرز بني + خضار مقطعة ③ استخدم الفريزر — الوجبات المطبوخة تحفظ 3 أشهر ④ قاعدة ال 15 دقيقة: أي وجبة صحية يمكن تحضيرها في 15 دقيقة أو أقل`,
    outside: `<strong>الأكل خارج المنزل:</strong> ① في أي مطعم: فراخ/سمك مشوي + سلطة خضراء + ليمون — هذا متاح في 95% من المطاعم ② تجنب الصلصات — اطلبها منفصلة ③ قاعدة نصف الطبق: نصف خضار، ربع بروتين، ربع كارب ④ في الفاست فود: سلطة + جريل بدون صوص + ماء — الخيارات الصحية موجودة دائما`,
    energy: `<strong>ضعف الطاقة:</strong> ① كارب معقد قبل التمرين ب 60–90 دقيقة (أرز، بطاطا، موز) — يملأ الجليكوجين ② قهوة سوداء قبل التمرين ب 30 دقيقة تزيد الأداء 11% (Meta-analysis 2018) ③ تأكد من الحديد والفيتامين B12 إذا كان الضعف مستمرا ④ <strong>النوم 7–9 ساعات</strong> يرفع هرمون النمو 70% وهو أهم مكمل طبيعي مجاني — نقص ساعة نوم يخفض الأداء الجسدي بنسبة 11% وزيادة الجريلين 28% ⑤ المغنيسيوم قبل النوم (300 مجم جليسينات مغنيسيوم) يحسن جودة النوم ومستوى الطاقة النهارية`,
    'night-hunger': `<strong>الجوع الليلي:</strong> ① جبن قريش 150ج + خيار = بروتين كازيين بطيء الامتصاص يشبعك طوال الليل ② ابحث عن السبب: هل وجبة العشاء كافية؟ هل تنام متأخرا جدا؟ ③ شرب ماء دافئ أو شاي أخضر قبل النوم يسيطر على الجوع الليلي في 70% من الحالات ④ إذا احتجت سناك — بيضة مسلوقة أو 10 حبات لوز كافية`,
    digestion: `<strong>مشاكل الهضم:</strong> ① تجنب الدهون العالية مع الكارب المعالج في نفس الوجبة ② الخضار المطبوخة أسهل هضما من النيئة في المرحلة الأولى ③ بروبيوتيك طبيعي: زبادي يوناني يوميا يحسن البيئة المعوية خلال 3–4 أسابيع ④ لا تشرب الماء البارد أثناء الأكل — يضعف إنزيمات الهضم. ماء دافئ أو بعد 30 دقيقة`,
    plateau: `<strong>ثبات الوزن (Plateau):</strong> ① Refeed Day مرة أسبوعيا: ارفع سعراتك لمستوى TDEE يوما واحدا — يعيد ضبط هرمون اللبتين ② قياس الجسم بالسنتيمتر لا الميزان فقط — الجسم قد يتحسن حتى مع ثبات الرقم ③ تغيير ترتيب التمارين أو نوعها كل 4 أسابيع يكسر التكيف ④ حساب السعرات بدقة لأسبوع كامل — كثيرون يقدرون الكميات بأقل من الحقيقة`,
    boredom: `<strong>الملل من الدايت:</strong> ① التنويع في طريقة الطهي لا المكونات — الفراخ يمكن طبخها 10 طرق مختلفة ② أضف أعشاب وتوابل: كمون، كركم، ريحان، ثوم — لا سعرات وتغيير تام في الطعم ③ وجبة حرة مرة أسبوعيا ضمن السعرات الأسبوعية الكلية — تكسر الرتابة وتحافظ على الالتزام ④ جرب مطبخا جديدا أسبوعيا — يوناني، آسيوي، مكسيكي — بنفس مكوناتك`,
    prep: `<strong>صعوبة التحضير:</strong> ① قاعدة ال 3 مكونات: بروتين + كارب + خضار — لا تحتاج أكثر ② Batch Protein: اطبخ 500–700ج فراخ/لحم يوم الجمعة وقسمها على الأسبوع ③ الفريزر صديقك — الأرز البني والخضار المشوية تجمد ممتاز ④ ليست كل وجبة تحتاج طبخ: تونة + خبر بر + خيار = وجبة كاملة في دقيقتين`,
    'post-workout-hunger': `<strong>الجوع بعد التمرين:</strong> ① وجبة ما بعد التمرين هي الأهم — 25–30ج بروتين سريع الامتصاص خلال 30–60 دقيقة ② أضف كارب سريع (موز، أرز أبيض، خبز) لاستعادة الجليكوجين وإيقاف الهدم ③ بروتين شيك + موزة = الحل السريع المثالي إذا لم يكن الطبخ متاحا ④ لا تتأخر في الوجبة — كلما طالت الفجوة بعد التمرين كلما زاد الجوع والهدم`,
    'snack-control': `<strong>ضعف التحكم في السناك:</strong> ① قاعدة الأكياس: قسم السناكس في أكياس بكميات محددة مسبقا — لا تأكل من العبوة الكبيرة أبدا ② الخيار السهل يحكم القرار — إذا كانت الفاكهة في متناول يدك ستأكلها بدلا من الشيبس ③ لا تشتري ما لا تريد أكله — قرار السوبرماركت أسهل من قرار البيت ④ سناك بروتيني محضر (بيض مسلوق، قريش، مكسرات محددة) يقلل الرغبة في السناك المعالج 60%`
  };
  if (DE.dietProblems.length) {
    document.getElementById('res-problems-solution').style.display = 'block';
    document.getElementById('res-problems-body').innerHTML = DE.dietProblems.map(p =>
      `<div class="info-box info-blue" style="margin-bottom:8px;flex-direction:column;align-items:flex-start;gap:4px;"><span class="ib-icon" style="margin-bottom:2px;"></span><span style="line-height:1.8;">${PROB_SOLUTIONS[p]||p}</span></div>`
    ).join('');
  }

  // ── Macros Bars
  const total = macros.protein*4 + macros.carbs*4 + macros.fat*9;
  const pP = (macros.protein*4/total*100).toFixed(0);
  const cP = (macros.carbs*4/total*100).toFixed(0);
  const fP = (macros.fat*9/total*100).toFixed(0);
  document.getElementById('res-macros').innerHTML = `
    <div class="macro-bar-wrap">
      ${[['بروتين',macros.protein,pP,'var(--green)'],['كارب',macros.carbs,cP,'var(--blue)'],['دهون',macros.fat,fP,'var(--orange)']].map(([lbl,val,pct,col])=>`
      <div class="macro-bar-row">
        <span style="color:${col};font-weight:800;min-width:85px;">${lbl}</span>
        <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${pct}%;background:${col};"></div></div>
        <span style="font-weight:800;color:var(--text);min-width:70px;text-align:left;">${val}ج (${pct}%)</span>
      </div>`).join('')}
    </div>`;

  // ── PHASE 5 — Smart Meal Plan from Available Foods
  // ── INTEGRATION BRIDGE: resolve DWCP weekly targets before meal generation ──
  // _resolveWeeklyTargets() queries DWCP for the current week and returns
  // safe calories + macros. Falls back to base cals/macros if DWCP unavailable.
  DE.currentWeek = DE.currentWeek || 1; // ensure initialized
  const weeklyTargets = _resolveWeeklyTargets(cals, macros, DE.currentWeek);
  buildSmartMealPlan(weeklyTargets.calories, weeklyTargets.macros, weeklyTargets.meta);

  // ── L2-1 RC1: Check fat floor warning flag written by Dynamic Fat Floor Validator ──
  // This is the downstream consumer of weeklyMeta._v31FatFloorWarning.
  // Shows a non-intrusive warning banner if fat floor was breached post-assembly.
  if (weeklyTargets.meta && weeklyTargets.meta._v31FatFloorWarning) {
    const fatAct = weeklyTargets.meta._v31FatFloorActual || 0;
    const fatMin = weeklyTargets.meta._v31FatFloorMin    || 0;
    _showFatFloorWarningBanner(fatAct, fatMin);
    // Clear flag after consuming — no leakage to saved state
    delete weeklyTargets.meta._v31FatFloorWarning;
    delete weeklyTargets.meta._v31FatFloorActual;
    delete weeklyTargets.meta._v31FatFloorMin;
  }

  // ── INTEGRATION: Populate week selector dropdown after first render ──
  _injectWeekSelectorOptions(DE.currentWeek);

  // ── Timeline
  buildTimeline(tdee, wkKg, wksTo);

  // ── DWCP — Show 12-week dynamic progression panel ──────────
  // Passes base cals/macros as targets; DWCP layer derives weekly modulations via WSL
  dwcpShowPanel();

  // ── PHL — Show plateau protocol panel ──────────────────────
  phlShowPanel();

  document.getElementById('results-section').style.display = 'block';
  const tlCard = document.getElementById('timeline-card');
  if (tlCard) tlCard.style.display = 'block';

  LOG(`✔ Results complete — diet:${DE.selectedDiet}, LBM:${lbm}kg, BF:${bf}%, meals from ${DE.availableFoods.length} available foods`);
}

// ═══════════════════════════════════════════════════════════════
//  INTEGRATION BRIDGE — DWCP - buildSmartMealPlan
//  Connects weekly strategy targets to actual meal generation.
//  Does NOT rebuild any engine. Only routes data between layers.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
//  CARB CYCLE RUNTIME BRIDGE
//  _resolveCarbCycleTargets(targets, weekNum)
//
//  Converts carbcycle from "visual diet label" to real runtime behavior.
//  Determines training vs rest day and applies bounded carb/fat modulation.
//
//  SCIENCE BASIS:
//   · Training days: glycogen depletion - higher carb replenishment needed
//     +25–40% carb vs weekly average; fat reduced to compensate
//   · Rest days: lower insulin demand - reduce carbs –20–30%; fat rises
//     for satiety and hormonal support
//   · Protein: held constant (muscle protein synthesis is not day-dependent)
//   · Weekly calorie average preserved: training-day surplus offsets rest-day
//     deficit within the same 7-day window
//
//  BOUNDS (prevents extreme swings):
//   · Training carb multiplier: max ×1.45 (prevents GI distress)
//   · Rest carb multiplier:     min ×0.65 (prevents <80g threshold)
//   · Fat floor:                0.7 g/kg body weight always
//   · Carb floor:               80g on rest days (brain + organ minimum)
//   · Protein:                  untouched — floors enforced by PHL/calcMacros
//
//  GUARDS:
//   · Only activates when DE.selectedDiet === 'carbcycle'
//   · Skips if no trainDays in DE (no training = no cycling)
//   · Medical guards: diabetes/insulin/pcos cap carb even on training days
//   · Falls back to original targets on any error
// ═══════════════════════════════════════════════════════════════════════

// ── _getCarbCycleDayState ─────────────────────────────────────────────
// Determines if today (relative to weekNum and day-of-week) is a training
// or rest day. Uses trainDays count from inputs and weekNum for week parity.
// No scheduling engine — uses a simple modulo distribution pattern.
//
// Returns: { isTrainingDay, trainDaysPerWeek, restDaysPerWeek, dayLabel }
function _getCarbCycleDayState(weekNum) {
  const trainDays = parseFloat(document.getElementById('inp-train-days')?.value) || 0;
  const restDays  = 7 - trainDays;

  // No training - no cycling
  if (trainDays <= 0) return { isTrainingDay: false, trainDaysPerWeek: 0, restDaysPerWeek: 7, dayLabel: 'راحة' };

  // ── PATCH 3 START: Remove Date() dependency for UX stability ──────────
  // Previous code used new Date().getDay() causing the plan macros to mutate
  // each real-world day. Replace with a deterministic value derived solely
  // from weekNum so the plan is always stable for a given week number.
  const today = (weekNum * 3) % 7;  // deterministic pseudo-day: 0–6, never changes for same weekNum
  // ── PATCH 3 END ────────────────────────────────────────────────────────

  const weekOffset = ((weekNum - 1) * 7);  // absolute day offset from week 1

  // Training days are the first N days of each 7-day cycle when sorted
  // by a deterministic day-of-week order starting Monday (1,2,3,4,5,6,0)
  const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun priority order
  const trainingSet = new Set(dayOrder.slice(0, trainDays));
  const isTrainingDay = trainingSet.has(today);

  return {
    isTrainingDay,
    trainDaysPerWeek: trainDays,
    restDaysPerWeek:  restDays,
    dayLabel: isTrainingDay ? 'تمرين' : 'راحة'
  };
}

// ── _resolveCarbCycleTargets ──────────────────────────────────────────
// Main carb cycle macro modulator.
// Called at the END of _resolveWeeklyTargets, after DWCP and PHL layers.
//
// @param  targets  {calories, macros:{protein,carbs,fat}, meta}
// @param  weekNum  {number} current week (1-based)
// @returns modified targets with day-appropriate carb/fat distribution
function _resolveCarbCycleTargets(targets, weekNum) {
  // ── Guard: only active for carbcycle diet ─────────────────────────
  if ((typeof DE === 'undefined') || DE.selectedDiet !== 'carbcycle') return targets;
  if (!targets || !isFinite(targets.calories) || targets.calories <= 0) return targets;

  try {
    const dayState = _getCarbCycleDayState(weekNum || 1);

    // If no training days configured - carbcycle has no basis - pass through
    if (dayState.trainDaysPerWeek === 0) {
      LOG('CarbCycle: no trainDays set — skipping modulation');
      return targets;
    }

    const baseProt  = targets.macros.protein;
    const baseCarbs = targets.macros.carbs;
    const baseFat   = targets.macros.fat;
    const baseCals  = targets.calories;

    // ── Modulation multipliers ─────────────────────────────────────
    // Training day: +35% carbs, fat reduced to compensate
    // Rest day:     –28% carbs, fat increased for satiety
    // Multipliers tuned for sustainability (not extreme cycling)
    const TRAIN_CARB_MULT = 1.35;
    const REST_CARB_MULT  = 0.72;

    let adjCarbs, adjFat;

    if (dayState.isTrainingDay) {
      adjCarbs = Math.round(baseCarbs * TRAIN_CARB_MULT);
      // Fat: reduce to offset extra carb calories, preserve protein
      const extraCarbCals = (adjCarbs - baseCarbs) * 4;
      const adjFatRaw = baseFat - Math.round(extraCarbCals / 9);
      // Fat floor: 0.7 g/kg BW for hormonal health
      const fatFloor = Math.round((DE.weight || 70) * 0.7);
      adjFat = Math.max(adjFatRaw, fatFloor);
    } else {
      // Rest day
      adjCarbs = Math.round(baseCarbs * REST_CARB_MULT);
      // Carb floor: 80g on rest days (brain glucose minimum)
      adjCarbs = Math.max(adjCarbs, 80);
      // Fat: increase to compensate for reduced carb calories
      const savedCarbCals = (baseCarbs - adjCarbs) * 4;
      adjFat = baseFat + Math.round(savedCarbCals / 9);
    }

    // ── Medical carb caps — override modulation if needed ──────────
    const health = DE.healthConditions || [];
    if (health.includes('diabetes') || health.includes('insulin')) {
      adjCarbs = Math.min(adjCarbs, Math.round((baseCals * 0.38) / 4)); // ≤38% cals as carb
    }
    if (health.includes('pcos')) {
      adjCarbs = Math.min(adjCarbs, Math.round((baseCals * 0.38) / 4));
    }
    if (health.includes('fatty-liver')) {
      adjCarbs = Math.min(adjCarbs, Math.round((baseCals * 0.40) / 4));
    }
    // Cholesterol: cap fat on training days
    if (health.includes('cholesterol')) {
      adjFat = Math.min(adjFat, Math.round((baseCals * 0.22) / 9));
    }

    // ── Recalculate actual calories from adjusted macros ───────────
    // Protein is held constant; calories may shift slightly — acceptable
    // (training day slightly higher, rest day slightly lower - weekly balance)
    const adjCals = Math.round(baseProt * 4 + adjCarbs * 4 + adjFat * 9);

    // ── Final NaN guards ───────────────────────────────────────────
    const safeCarbs = (isFinite(adjCarbs) && adjCarbs >= 0) ? adjCarbs : baseCarbs;
    const safeFat   = (isFinite(adjFat)   && adjFat   > 0) ? adjFat   : baseFat;
    const safeCals  = (isFinite(adjCals)  && adjCals  > 0) ? adjCals  : baseCals;

    // ── Build enriched meta ────────────────────────────────────────
    const ccMeta = {
      ...(targets.meta || {}),
      carbCycleActive:  true,
      carbCycleDayType: dayState.dayLabel,
      isTrainingDay:    dayState.isTrainingDay,
      carbDelta:        safeCarbs - baseCarbs,    // signed: +train / –rest
      fatDelta:         safeFat   - baseFat,
      trainDaysPerWeek: dayState.trainDaysPerWeek,
    };

    LOG(`CarbCycle: ${dayState.dayLabel} | Carbs ${baseCarbs} - ${safeCarbs}g (${safeCarbs > baseCarbs ? '+' : ''}${safeCarbs - baseCarbs}) | Fat ${baseFat} - ${safeFat}g | Cal ${baseCals} - ${safeCals}`);

    return { calories: safeCals, macros: { protein: baseProt, carbs: safeCarbs, fat: safeFat }, meta: ccMeta };

  } catch(e) {
    LOG('CarbCycle bridge error — ' + e.message + ' — targets unchanged');
    return targets;
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  PHL - RUNTIME CLOSED-LOOP BRIDGE
//  _resolvePHLAdjustments(targets, tdee, healthConditions)
//
//  Reads PHL.assess() output and applies bounded, safe calorie/macro
//  corrections to an already-resolved {calories, macros, meta} target object.
//
//  Called at the END of _resolveWeeklyTargets — after DWCP resolves targets,
//  before buildSmartMealPlan receives them.
//
//  RULES:
//   · Only activates when PHL detects a real plateau (isPlateauing = true)
//   · Never applies during: bulk, maintain goals
//   · Never crashes calories below gender-appropriate minimums
//   · Never destroys protein minimum (LBM × 1.6 g/kg)
//   · Corrections are bounded: max ±20% calorie shift
//   · Fallback: returns original targets unchanged on any error
//   · No recursion risk: PHL.assess() is stateless and pure
// ─────────────────────────────────────────────────────────────────────────
function _resolvePHLAdjustments(targets, tdee, healthConditions) {
  // ── Guard: only apply for cut/recomp goals where plateau is relevant
  const goal = (typeof DE !== 'undefined') ? (DE.goal || 'cut') : 'cut';
  if (!['cut', 'recomp'].includes(goal)) return targets;

  // ── Guard: PHL must be available
  if (typeof PHL === 'undefined' || typeof PHL.assess !== 'function') return targets;

  // ── Guard: targets must be valid before we adjust them
  if (!targets || !isFinite(targets.calories) || targets.calories <= 0) return targets;

  try {
    // ── Build PHL assess input from live DE state ──────────────────
    const bf       = (typeof estimateBodyFat === 'function') ? estimateBodyFat() : 20;
    const bmi      = (DE.weight && DE.height) ? DE.weight / ((DE.height / 100) ** 2) : 25;
    const safeTDEE = (isFinite(tdee) && tdee > 0) ? tdee : targets.calories + 300;
    const defPct   = safeTDEE > 0 ? Math.max(0, (safeTDEE - targets.calories) / safeTDEE) : 0.20;

    // weeksCutting: approximate from currentWeek (conservative estimate)
    // DE.currentWeek reflects how long the user has been on the plan
    const weeksCutting = (goal === 'cut') ? (DE.currentWeek || 1) : 0;

    // PLAN ASSUMPTION (90-day predictive): the plan is calibrated on the
    // realistic assumption that the user follows the schedule ~70-80% of the
    // time. 75% (midpoint) is the default scientific baseline; no manual
    // feedback input is required.
    const adherencePct = 75;
    // FEEDBACK: real logged weigh-ins when available (PHL format [{week,weight}])
    const _pfWeightLog = (typeof DE !== 'undefined' && Array.isArray(DE.weightLog))
      ? DE.weightLog.filter(function(e){ return e && isFinite(e.week) && isFinite(e.weight); })
      : [];
    const _pfExpLoss = (typeof DE !== 'undefined' && isFinite(DE.expectedWeeklyLoss) && DE.expectedWeeklyLoss > 0)
      ? DE.expectedWeeklyLoss
      : 0.5;

    const phlInput = {
      weightHistory:     _pfWeightLog,   // real logged weigh-ins when available
      weeksCutting,
      deficitPct:        defPct,
      bodyFatPct:        bf,
      bmi,
      adherencePct,
      goal,
      healthConditions:  healthConditions || [],
      dietKey:           (DE.selectedDiet || 'balanced'),
      expectedWeeklyLoss: _pfExpLoss,
    };

    const report = PHL.assess(phlInput);

    // ── No plateau detected — return targets unchanged ─────────────
    if (!report.isPlateauing || report.plateauType === 'none') {
      return targets;
    }

    // ── PHL plateau detected — apply strategy correction ───────────
    LOG(`PHL ACTIVE: ${report.plateauType} detected — applying runtime correction`);

    // Get the primary safe strategy (already medical-guarded by PHL.assess)
    const strategy = report.primaryStrategy;
    if (!strategy) {
      LOG('PHL: no primary strategy available — targets unchanged');
      return targets;
    }

    // ── Safety floor constants (own scope — SAFETY is inside DWCP IIFE)
    const lbm      = (typeof calcLBM === 'function') ? calcLBM() : DE.weight * 0.80;
    const isFemal  = (typeof DE !== 'undefined' && DE.gender === 'أنثى') || lbm < 50;
    const MIN_CALS = isFemal ? 1200 : 1400;
    const MIN_PROT = Math.round(lbm * 1.6); // absolute minimum protein floor

    // ── Calorie adjustment ─────────────────────────────────────────
    // calAdj semantics from PLATEAU_STRATEGIES:
    //   calAdj ≥ 1.00 - restore to TDEE level (refeed / diet break / relief)
    //   calAdj < 1.00 - reduce deficit (e.g. 0.82 = reduce deficit by 18%)
    //
    // We map these onto the already-resolved calorie target:
    //
    // Case A — restoration strategies (refeed / diet break / fatigue relief):
    //   calAdj = 1.00 - raise calories toward TDEE
    //   Apply: newCal = targets.calories + (safeTDEE - targets.calories) * restoreFraction
    //   restoreFraction = 0.5 for mild, 1.0 for full break (capped at TDEE)
    //
    // Case B — deficit reduction strategies:
    //   calAdj < 1.00 - scale the deficit down
    //   Apply: currentDeficit * calAdj - new deficit - newCal = TDEE - newDeficit
    //
    // MAX CORRECTION: ±20% of current calorie target (prevents extreme swings)

    let adjustedCals = targets.calories;
    const currentDeficit = Math.max(0, safeTDEE - targets.calories);

    if (strategy.calAdj >= 1.00) {
      // Restoration: raise toward TDEE
      // For refeed (single day): partial restoration 60% toward TDEE
      // For diet break / maintenance relief: full restoration to TDEE
      const isFullBreak = ['diet_break_full', 'maintenance_relief', 'carb_cycle_break'].includes(strategy.id);
      const restoreFraction = isFullBreak ? 1.0 : 0.60;
      const restorationAmount = Math.round((safeTDEE - targets.calories) * restoreFraction);
      adjustedCals = targets.calories + restorationAmount;
    } else {
      // Deficit reduction: scale the deficit
      const reducedDeficit = Math.round(currentDeficit * strategy.calAdj);
      adjustedCals = safeTDEE - reducedDeficit;
    }

    // ── Calorie bounds ─────────────────────────────────────────────
    // Never below minimum safe intake
    adjustedCals = Math.max(adjustedCals, MIN_CALS);
    // Never above TDEE + 5% (surplus is not PHL's job)
    adjustedCals = Math.min(adjustedCals, Math.round(safeTDEE * 1.05));
    // Clamp correction to ±20% of original target (stability guard)
    const maxSwing = Math.round(targets.calories * 0.20);
    adjustedCals = Math.max(targets.calories - maxSwing, Math.min(targets.calories + maxSwing, adjustedCals));
    // Final NaN guard
    if (!isFinite(adjustedCals) || adjustedCals <= 0) adjustedCals = targets.calories;
    adjustedCals = Math.round(adjustedCals);

    // ── Macro adjustment ───────────────────────────────────────────
    // Apply strategy multipliers to existing macros
    // Protein: always protected — multiply then floor at MIN_PROT
    // Carbs: multiply — key signal for refeed/diet-break
    // Fat: multiply — allowed to reduce on refeed days
    const rawPro  = Math.round((targets.macros.protein || 150) * (strategy.proteinMult || 1.0));
    const rawCarb = Math.round((targets.macros.carbs   || 180) * (strategy.carbMult   || 1.0));
    const rawFat  = Math.round((targets.macros.fat     || 55)  * (strategy.fatMult    || 1.0));

    // Protein minimum floor
    const adjProtein = Math.max(rawPro, MIN_PROT);
    // Fat minimum: 0.6 g/kg body weight for hormonal safety
    const minFat = Math.round((DE.weight || 70) * 0.6);
    const adjFat = Math.max(rawFat, minFat);
    // Carbs: recalculate from remaining calories to ensure macro-calorie coherence
    const remainingForCarbs = adjustedCals - (adjProtein * 4) - (adjFat * 9);
    const adjCarbs = Math.max(20, Math.round(remainingForCarbs / 4));

    // Diet-specific carb guards
    const dietKey = DE.selectedDiet || 'balanced';
    const finalCarbs = (['keto','carnivore'].includes(dietKey))
      ? Math.min(adjCarbs, dietKey === 'carnivore' ? 10 : 40)
      : adjCarbs;

    // Medical guards — carried through from strategy (already in PHL.assess)
    let finalProtein = adjProtein;
    if ((healthConditions || []).includes('kidney')) {
      // Kidney: protein cap via IBW (consistent with Patch 2)
      const heightIn = (DE.height || 170) / 2.54;
      const ibwBase  = (DE.gender === 'أنثى') ? 45.5 : 50;
      const ibw      = Math.max(30, ibwBase + 2.3 * (heightIn - 60));
      const refW     = (DE.weight || 70) > ibw * 1.2 ? ibw : (DE.weight || 70);
      finalProtein   = Math.min(finalProtein, Math.round(refW * 0.8));
    }

    // Final NaN guards on macros
    const resolvedMacros = {
      protein: isFinite(finalProtein) && finalProtein > 0 ? finalProtein : targets.macros.protein,
      carbs:   isFinite(finalCarbs)   && finalCarbs   >= 0 ? finalCarbs  : targets.macros.carbs,
      fat:     isFinite(adjFat)       && adjFat        > 0 ? adjFat      : targets.macros.fat
    };

    // ── Build enriched meta with PHL context ───────────────────────
    const phlMeta = {
      ...(targets.meta || {}),
      phlActive:     true,
      phlType:       report.plateauType,
      phlLabel:      report.severity?.label || '—',
      phlStrategy:   strategy.label,
      phlStrategyId: strategy.id,
      phlSignals:    report.signals || [],
      phlWarnings:   strategy.safetyWarnings || [],
      phlCalDelta:   adjustedCals - targets.calories,   // signed delta for display
    };

    LOG(`PHL applied: ${strategy.label} | cal ${targets.calories} - ${adjustedCals} (Δ${adjustedCals - targets.calories}) | P:${resolvedMacros.protein}g C:${resolvedMacros.carbs}g F:${resolvedMacros.fat}g`);

    return {
      calories: adjustedCals,
      macros:   resolvedMacros,
      meta:     phlMeta
    };

  } catch(e) {
    LOG('PHL bridge error — ' + e.message + ' — targets unchanged');
    return targets; // safe fallback: original targets pass through
  }
}

// ── _resolveWeeklyTargets ────────────────────────────────────────
// Queries DWCP.getWeekTargets(weekNum) and returns a safe {calories,
// macros, meta} object for buildSmartMealPlan. Automatically falls
// back to base cals/macros if DWCP is unavailable or returns invalid data.
//
// @param  baseCals   {number}  base calories from calcTargetCals()
// @param  baseMacros {object}  base macros from calcMacros()
// @param  weekNum    {number}  1-based week number (from DE.currentWeek)
// @returns {calories, macros:{protein,carbs,fat}, meta:{isRefeed,isDietBreak,phaseLabel,weekNote,safetyFlags}}
function _resolveWeeklyTargets(baseCals, baseMacros, weekNum) {
  // Safety: validate base inputs first
  const safeCals   = (isFinite(baseCals) && baseCals > 0) ? baseCals : 1800;
  const safeMacros = {
    protein: (isFinite(baseMacros?.protein) && baseMacros.protein > 0) ? baseMacros.protein : 150,
    carbs:   (isFinite(baseMacros?.carbs)   && baseMacros.carbs   >= 0) ? baseMacros.carbs   : 180,
    fat:     (isFinite(baseMacros?.fat)     && baseMacros.fat     > 0) ? baseMacros.fat     : 55
  };
  const fallback = { calories: safeCals, macros: safeMacros, meta: null };

  // ── Helper: resolve TDEE for PHL (needed for deficit% calculation) ──
  const _getTDEE = () => {
    try { return (typeof calcTDEE === 'function') ? calcTDEE() : safeCals + 300; }
    catch(e) { return safeCals + 300; }
  };
  const health = (typeof DE !== 'undefined') ? (DE.healthConditions || []) : [];

  // If DWCP unavailable (e.g. engine not yet initialized), use base
  // ── Apply PHL + CarbCycle even on fallback path ──────────────────
  if (typeof DWCP === 'undefined' || typeof DWCP.getWeekTargets !== 'function') {
    LOG('INTEGRATION: DWCP unavailable — using base targets + PHL + CarbCycle pass');
    const phlFb = _resolvePHLAdjustments(fallback, _getTDEE(), health);
    return _resolveCarbCycleTargets(phlFb, weekNum || 1);
  }

  try {
    const w = Math.max(1, Math.min(52, Math.round(weekNum) || 1));
    const wt = DWCP.getWeekTargets(w);

    // Validate DWCP output: reject if calories are zero/NaN (fallback state)
    if (!wt || !isFinite(wt.calories) || wt.calories <= 0) {
      LOG(`INTEGRATION: DWCP returned invalid data for week ${w} — base targets + PHL + CarbCycle pass`);
      const phlFb2 = _resolvePHLAdjustments(fallback, _getTDEE(), health);
      return _resolveCarbCycleTargets(phlFb2, w);
    }

    // DWCP: skip PHL correction on DWCP-managed refeed/diet-break weeks —
    // DWCP already handles those via WSL strategy; PHL would double-apply.
    // PHL only activates on standard deficit weeks where it adds value.
    const isDWCPSpecialWeek = wt.isRefeedWeek || wt.isDietBreak;

    // For refeed weeks: use refeed macros if available (high carb day)
    const activeMacros = (wt.isRefeedWeek && wt.refeedMacros && isFinite(wt.refeedMacros.carbs))
      ? { protein: wt.refeedMacros.protein, carbs: wt.refeedMacros.carbs, fat: wt.refeedMacros.fat }
      : { protein: wt.protein, carbs: wt.carbs, fat: wt.fat };

    // Final NaN guard on resolved macros
    const resolvedMacros = {
      protein: isFinite(activeMacros.protein) && activeMacros.protein > 0 ? activeMacros.protein : safeMacros.protein,
      carbs:   isFinite(activeMacros.carbs)   && activeMacros.carbs   >= 0 ? activeMacros.carbs  : safeMacros.carbs,
      fat:     isFinite(activeMacros.fat)     && activeMacros.fat     > 0 ? activeMacros.fat     : safeMacros.fat
    };

    const meta = {
      weekNumber:   w,
      isRefeedWeek: wt.isRefeedWeek,
      isDietBreak:  wt.isDietBreak,
      phaseLabel:   wt.phaseLabel || '—',
      phaseType:    wt.phaseType  || '—',
      weekNote:     wt.weekNote   || '',
      safetyFlags:  wt.safetyFlags || [],
      expectedTrend: wt.expectedTrend || ''
    };

    // ── DIET BREAK SYNC (additive) ────────────────────────────────
    // Problem: wt.calories = TDEE (correct) but resolvedMacros are derived
    // from baseMac (cut calories) × WSL multipliers - macros stay at cut level.
    // Fix: when isDietBreak, recalculate macros from TDEE calories directly.
    // Strictly additive — only fires on diet break weeks, zero impact otherwise.
    let finalCalories  = wt.calories;
    let finalMacros    = resolvedMacros;
    if (wt.isDietBreak && isFinite(wt.tdee) && wt.tdee > 0) {
      try {
        const _dbTdee   = wt.tdee;                                    // maintenance cals
        const _dbMacros = calcMacros(_dbTdee, DE.selectedDiet);       // recalc from TDEE
        finalCalories   = _dbTdee;
        finalMacros     = {
          protein: isFinite(_dbMacros.protein) && _dbMacros.protein > 0 ? _dbMacros.protein : resolvedMacros.protein,
          carbs:   isFinite(_dbMacros.carbs)   && _dbMacros.carbs   >= 0 ? _dbMacros.carbs   : resolvedMacros.carbs,
          fat:     isFinite(_dbMacros.fat)     && _dbMacros.fat     > 0 ? _dbMacros.fat     : resolvedMacros.fat
        };
        LOG(`DIET-BREAK SYNC: calories ${wt.calories} - ${finalCalories} kcal (TDEE) | macros P${finalMacros.protein}/C${finalMacros.carbs}/F${finalMacros.fat}`);
      } catch(e) {
        LOG('DIET-BREAK SYNC error: ' + e.message + ' — using DWCP macros');
      }
    }
    // ── END DIET BREAK SYNC ───────────────────────────────────────

    const dwcpResolved = { calories: finalCalories, macros: finalMacros, meta };

    // ── FINAL STAGE: PHL closed-loop correction ────────────────────
    // Skip PHL on DWCP-managed special weeks (refeed/diet-break) to
    // avoid double-applying the same intervention.
    if (isDWCPSpecialWeek) {
      LOG(`✔ INTEGRATION: Week ${w} [DWCP-managed] — PHL skipped to avoid double-intervention`);
      // Still apply carbcycle on non-PHL weeks (even refeed weeks benefit from day-typing)
      return _resolveCarbCycleTargets(dwcpResolved, w);
    }

    // Standard deficit week: PHL gets the final word on runtime targets,
    // then carbcycle modulates day-by-day carb distribution on top
    const tdeeNow = _getTDEE();
    LOG(`✔ INTEGRATION: Week ${w} DWCP resolved — passing to PHL stage`);
    const phlResolved = _resolvePHLAdjustments(dwcpResolved, tdeeNow, health);

    // ── FINAL STAGE: CarbCycle day-state modulation ────────────────
    // Applied after PHL — day-appropriate carb/fat shift on top of
    // all previous adjustments. Only active when diet === 'carbcycle'.
    return _resolveCarbCycleTargets(phlResolved, w);

  } catch(e) {
    LOG('INTEGRATION: _resolveWeeklyTargets error — ' + e.message + ' — base + PHL + CarbCycle pass');
    const phlCatch = _resolvePHLAdjustments(fallback, _getTDEE(), health);
    return _resolveCarbCycleTargets(phlCatch, weekNum || 1);
  }
}

// ── _injectWeekSelectorOptions ───────────────────────────────────
// Populates the week <select> dropdown with labels from DWCP weeks.
// Called once by buildResults() after meal plan is first rendered.
function _injectWeekSelectorOptions(currentWeek) {
  const sel = document.getElementById('meal-week-input');
  const container = document.getElementById('meal-week-selector');
  if (!sel || !container) return;

  // Build options from DWCP if available, else plain 1-12
  let options = '';
  if (typeof DWCP !== 'undefined' && typeof DWCP.getAllWeeks === 'function') {
    try {
      const weeks = DWCP.getAllWeeks();
      options = weeks.map(w => {
        const refeedMark = w.isRefeedWeek ? '' : w.isDietBreak ? '' : '';
        return `<option value="${w.weekNumber}" ${w.weekNumber === currentWeek ? 'selected' : ''}>أسبوع ${w.weekNumber}${refeedMark} · ${w.calories} kcal</option>`;
      }).join('');
    } catch(e) {
      options = Array.from({length:12}, (_,i) => `<option value="${i+1}" ${(i+1)===currentWeek?'selected':''}>أسبوع ${i+1}</option>`).join('');
    }
  } else {
    options = Array.from({length:12}, (_,i) => `<option value="${i+1}" ${(i+1)===currentWeek?'selected':''}>أسبوع ${i+1}</option>`).join('');
  }

  sel.innerHTML = options;
  container.style.display = 'flex';
  _updateWeekPhaseBadge(currentWeek);
}

// ── _updateWeekPhaseBadge ────────────────────────────────────────
// Updates the phase label badge next to the week selector.
function _updateWeekPhaseBadge(weekNum) {
  const badge = document.getElementById('meal-week-phase-badge');
  if (!badge) return;
  try {
    if (typeof DWCP !== 'undefined' && typeof DWCP.getWeekTargets === 'function') {
      const wt = DWCP.getWeekTargets(weekNum);
      if (wt && wt.phaseLabel && wt.phaseLabel !== '—') {
        badge.textContent = wt.phaseLabel;
        const isRefeed = wt.isRefeedWeek;
        const isBreak  = wt.isDietBreak;
        badge.style.background = isBreak ? 'rgba(42,140,232,0.15)' : isRefeed ? 'rgba(42,140,232,0.12)' : 'rgba(42,232,123,0.12)';
        badge.style.color = isBreak ? 'var(--blue)' : isRefeed ? 'var(--blue)' : 'var(--green)';
        return;
      }
    }
  } catch(e) { /* ignore */ }
  badge.textContent = '';
}

// ── rebuildMealPlanForWeek ───────────────────────────────────────
// Called by the week selector onchange. Updates DE.currentWeek,
// resolves DWCP targets for the selected week, and re-renders ONLY
// the meal plan section (res-meals) — no full buildResults() re-run.
// Preserves all medical filters, food scoring, optimizePortions().
function rebuildMealPlanForWeek(weekNum) {
  const w = Math.max(1, Math.min(52, Math.round(weekNum) || 1));
  DE.currentWeek = w;
  _updateWeekPhaseBadge(w);

  // Get current base calories/macros from the live engine
  const baseCals   = calcTargetCals();
  const baseMacros = calcMacros(baseCals, DE.selectedDiet);

  // Resolve weekly targets from DWCP
  const weeklyTargets = _resolveWeeklyTargets(baseCals, baseMacros, w);

  // Re-render the meal plan with weekly-adjusted targets
  // buildSmartMealPlan() signature: (totalCals, macros, meta)
  // meta is optional — buildSmartMealPlan already handles undefined meta
  buildSmartMealPlan(weeklyTargets.calories, weeklyTargets.macros, weeklyTargets.meta);

  LOG(`✔ INTEGRATION: Meal plan rebuilt for week ${w} — ${weeklyTargets.calories} kcal`);
}

// ── PHASE 5 — Build meal plan from available foods ──────────────
// ── ELF v56 — فلتر الأكل المصري الشائع للخطة التلقائية (لما العميل مايختارش أكل) ──
var ELF_PREF_IDS=(function(){var a=['sdr_frakh_mshwy','wrk_frakh_mshwy','kfta_frakh','kbda_frakh_mshwya','sdr_bt_mshwy','wrk_bt_mshwya','jnah_frakh_mshwy','lhm_bqry_mslwq','shrah_lhm_mshwya','kbab_mshwy','kfta_mshwya_ala_alfhm','lhm_mfrwm_bqry_qlyl_aldhn','kbda_askndrany','byd_mslwq','byd_awmlyt','twna_myah','qta_twna_balzyt','blty_mshwy','bwry_mshwy','makryl_mshwy','srdyn_mshwy','jbnaqrysh','jbna_rwds_gwld','jbnabyda','jbnarwmy','zbadytbyay','zbadylayt','lbnkhalyaldsm','lbnkamlaldsm','arzabydmtbwkh','arzbsmtymtbwkh','arzbnymtbwkh','mkrwnamslwqa','btatsmslwqa','btatsmshwya','btatamshwya','ayshbldy','ayshasmr','twstasmr','rayskykbny','ayshqmhkaml','fwlmdms','btykh','shmam','manjw','anb','khwkh','mshmsh','tynshwky','tyn','brtqal','ywsfy','jwafa','kmthra','rman','frawla','kaka','tfah','mwz','blh','tmr','zbyb'];var o={};a.forEach(function(x){o[x]=1;});return o;})();
function _elfInSeasonFruit(){var m=(new Date()).getMonth();var summer=['btykh','shmam','manjw','anb','khwkh','tyn','brqwq','ananas','mshmsh','frawla'];var winter=['brtqal','ywsfy','jwafa','tfah','kmthra','mwz','rman','kywy'];var base=(m>=3&&m<=9)?summer:winter;return base.concat(['mwz','tfah','brtqal','tmr','blh']);}
function _elfBreakfastBadCarb(id){return /^arz|mkrwna|kshry|brghl|fryk|shaayr|frkya|qmh/.test(String(id||''));}
function _elfCurateMealFoods(mType,cands){
  if(!Array.isArray(cands)||!cands.length) return cands;
  var diet=(typeof DE!=='undefined'&&DE.selectedDiet)||'balanced';
  var season=_elfInSeasonFruit();
  function keep(f){
    if(!f) return false; var id=String(f.id||''),cat=f.cat;
    if(cat==='fruit'){ if(!ELF_PREF_IDS[id]) return false; if(season.indexOf(id)<0) return false; return true; }
    if(cat==='protein'||cat==='carb'||cat==='dairy'){ if(!ELF_PREF_IDS[id]) return false; }
    if(mType==='breakfast' && cat==='carb' && _elfBreakfastBadCarb(id)) return false;
    if(id==='arzbnymtbwkh' && diet!=='mediterranean') return false;
    return true;
  }
  var out=cands.filter(keep);
  var byCat={}; cands.forEach(function(f){ if(!f) return; (byCat[f.cat]=byCat[f.cat]||[]).push(f); });
  var have={}; out.forEach(function(f){ have[f.cat]=true; });
  ['protein','carb','dairy','fruit','veggie','fat','snack'].forEach(function(c){
    if(byCat[c] && byCat[c].length && !have[c]){
      var fb=byCat[c].filter(function(f){return ELF_PREF_IDS[f.id];}); if(!fb.length) fb=byCat[c];
      if(c==='carb' && mType==='breakfast'){ var nf=fb.filter(function(f){return !_elfBreakfastBadCarb(f.id);}); if(nf.length) fb=nf; }
      if(c==='fruit'){ var sf=fb.filter(function(f){return season.indexOf(String(f.id))>=0;}); if(sf.length) fb=sf; }
      out=out.concat(fb.slice(0,4));
    }
  });
  return out.length?out:cands;
}

function buildSmartMealPlan(totalCals, macros, weeklyMeta) {
  const diet  = DE.selectedDiet || 'balanced';
  const context = { diet, goal:DE.goal, health:DE.healthConditions, problems:DE.dietProblems };
  const mealLabels = { breakfast:'الفطار', pre:'قبل التمرين', post:'بعد التمرين', lunch:'الغداء', dinner:'العشاء', snack:'السناك' };
  const mealDesc   = { breakfast:'شبع + طاقة مستقرة', pre:'طاقة + هضم خفيف', post:'تعافي + بناء عضلي', lunch:'الوجبة الكبرى', dinner:'شبع + هضم مريح', snack:'خفيف ومشبع' };

  // Determine meal structure
  let mealTypes = [];
  if (DE.workoutType === 'gym' && DE.gymSplit === 'default') {
    mealTypes = isBulkScenario() ? ['breakfast','snack','pre','post','dinner'] : ['breakfast','pre','post','dinner'];
  } else {
    const n = DE.mealCount;
    if (n===2) mealTypes = ['breakfast','dinner'];
    else if (n===3) mealTypes = ['breakfast','lunch','dinner'];
    else if (n===4) mealTypes = ['breakfast','lunch','dinner','snack'];
    else mealTypes = ['breakfast','snack','lunch','post','dinner'];
  }
  if (DE.snacks && !mealTypes.includes('snack')) mealTypes.push('snack');

  // ── PROBLEM-BASED MEAL STRUCTURE ADJUSTMENTS ──────────────────
  // Night hunger: add a late evening protein snack (casein-rich)
  if (DE.dietProblems.includes('night-hunger') && !mealTypes.includes('snack')) {
    mealTypes.push('snack'); // adds a protein snack in the evening slot
  }
  // Hunger/satiety issues: ensure at least 4 meals for better hunger control
  if ((DE.dietProblems.includes('hunger') || DE.dietProblems.includes('satiety'))
      && mealTypes.length < 4 && !['keto','carnivore'].includes(DE.selectedDiet)) {
    if (!mealTypes.includes('snack')) mealTypes.push('snack');
  }
  // Diabetes: 5-6 small meals preferred for glucose control
  if (DE.healthConditions.includes('diabetes') && mealTypes.length < 5) {
    // Add a snack between main meals if not already there
    if (!mealTypes.includes('snack')) mealTypes.push('snack');
  }

  // -- UNIFY (single source of truth): align results-page slots with the 90-day plan --
  if (typeof SMPS !== 'undefined' && Array.isArray(SMPS.slots) && SMPS.slots.length) {
    mealTypes = SMPS.slots.slice();
  }
  var _smpsBySlot = {};
  try {
    if (typeof SMPS !== 'undefined' && typeof SMPS.ensurePlan === 'function') {
      var _smpsDay1 = SMPS.ensurePlan()[0] || [];
      _smpsDay1.forEach(function(m){ if (m && m.slotKey) _smpsBySlot[m.slotKey] = m; });
    }
  } catch (e) {}
  const snackCount = mealTypes.filter(m=>m==='snack').length;
  const mainCount  = mealTypes.filter(m=>m!=='snack').length;

  // ── SMART SNACK CALORIE — dynamic % of total (FIX: was hardcoded 150/200)
  // Night hunger / IBS: lighter snack (8% of total)
  // Regular: 10% of total calories
  // Absolute bounds: min 120 kcal (not worth eating less), max 300 kcal (stays a snack)
  const snackPct = (DE.dietProblems.includes('night-hunger') || DE.healthConditions.includes('ibs')) ? 0.08 : 0.10;
  const snackCals = Math.min(300, Math.max(120, Math.round(totalCals * snackPct)));
  const mainCals   = Math.round((totalCals - snackCals * snackCount) / mainCount);

  const getMealMacro = (mType) => {
    // ── [FIX-CARB-DIST] Peri-workout carb allocation — replaces flat division ──
    // Evidence: Aragon & Schoenfeld 2013, Ivy 2004, Kerksick 2017 (ISSN Timing)
    // Rationale: pre/post workout meals need disproportionate carb allocation
    // for glycogen loading and recovery. Flat division (÷ n meals) means only
    // ~10-15% of carbs reach peri-workout meals when 4-5 meals exist — far
    // below the evidence-recommended 50-65% on training days.
    //
    // Allocation tables (must sum to 1.0 across all meals in the plan):
    //   Training day (pre + post exist): concentrate 50-65% around workout
    //   Rest day / no workout: balanced across meals, dinner leaner
    //
    // Protein and fat still use flat division — protein timing evidence is weaker
    // (total daily protein matters more), and fat is not timing-sensitive.
    const hasWorkoutMeals = mealTypes.includes('pre') || mealTypes.includes('post');

    let carbShare;
    if (hasWorkoutMeals) {
      // Training day proportional carb map
      const trainingCarbMap = {
        pre:       0.25,  // glycogen loading before workout
        post:      0.25,  // glycogen replenishment + insulin window
        breakfast: 0.18,  // morning energy + metabolic priming
        lunch:     0.18,  // midday maintenance
        dinner:    0.08,  // dinner thinning — glycogen full post-workout
        snack:     0.06,  // lean snack
      };
      // Fallback: if meal type not in map (edge case), use equal share
      const mappedSum = mealTypes.reduce((s, m) => s + (trainingCarbMap[m] || 0), 0);
      if (mappedSum > 0) {
        // Normalize to sum = 1.0 regardless of which meal types are active
        const norm = 1.0 / mappedSum;
        carbShare = (trainingCarbMap[mType] || (1 / mealTypes.length)) * norm;
      } else {
        carbShare = 1 / mealTypes.length;
      }
    } else {
      // Rest day / no workout: balanced but still dinner-lean
      const restCarbMap = {
        breakfast: 0.30,
        lunch:     0.35,
        dinner:    0.20,
        snack:     0.15,
      };
      const mappedSum = mealTypes.reduce((s, m) => s + (restCarbMap[m] || 0), 0);
      if (mappedSum > 0) {
        const norm = 1.0 / mappedSum;
        carbShare = (restCarbMap[mType] || (1 / mealTypes.length)) * norm;
      } else {
        carbShare = 1 / mealTypes.length;
      }
    }

    const base = {
      protein: Math.round(macros.protein / mealTypes.length),
      carbs:   Math.round(macros.carbs   * carbShare),
      fat:     Math.round(macros.fat     / mealTypes.length)
    };

    LOG(`[FIX-CARB-DIST]: ${mType} - carbShare=${(carbShare*100).toFixed(1)}% = ${base.carbs}g (total pool: ${macros.carbs}g)`);

    // ── [CARB-CLAMP] Safety clamps for carb distribution ─────────
    // Prevents any meal from getting unrealistically low carbs due to:
    //  (a) extreme dinner-thinning in 6+ meal plans
    //  (b) rounding drift accumulation across multiple meals
    //  (c) IF/OMAD edge cases where 1-2 meals must carry all carbs
    //  (d) unknown/new meal types falling through the map
    // Rules:
    //  - snack floor: 5% of daily carbs (snacks intentionally leaner)
    //  - all other meals: 8% of daily carbs minimum
    //  - OMAD/IF: no floor enforced — single meal must absorb all carbs
    //  - Hard minimum: 15g absolute (to keep meals functional)
    (function _carbSafetyClamp() {
      const _dailyCarbs  = macros.carbs;
      const _mealCount   = mealTypes.length;
      const _isOmad      = _mealCount === 1;                       // OMAD — no floor
      const _isIF        = _mealCount <= 2 && !hasWorkoutMeals;   // IF 2-meal — relax floor
      const _isIntentionallyLean = mType === 'dinner' && hasWorkoutMeals; // dinner thinning is intentional

      if (!_isOmad && !_isIF) {
        // Snacks get a lower floor (6% - already in map, but clamp to 5%)
        const _floorPct   = mType === 'snack' ? 0.05 : 0.08;
        const _floorCarbs = Math.max(15, Math.round(_dailyCarbs * _floorPct));

        if (base.carbs < _floorCarbs && !_isIntentionallyLean) {
          LOG(`[CARB-CLAMP]: ${mType} carbs ${base.carbs}g below floor ${_floorCarbs}g - clamped`);
          base.carbs = _floorCarbs;
        }
      }

      // Absolute minimum: 15g for any non-keto meal regardless of context
      // (except intentional diet overrides applied below — GERD, diabetes, etc)
      if (base.carbs < 15 && !['keto','carnivore'].includes(DE.selectedDiet || '')) {
        base.carbs = 15;
      }
    })();

    // ── [CARB-DRIFT] Rounding drift correction ───────────────────
    // The normalize * round pattern can drift ±2-3g per plan.
    // Correction applied on the LAST meal only — simple and safe.
    // Drift is computed by comparing sum of all already-assigned
    // meals; since getMealMacro is called sequentially per mealType,
    // we track a running sum and correct on the final call.
    (function _carbDriftCorrection() {
      if (!getMealMacro._carbRunningTotal) getMealMacro._carbRunningTotal = 0;
      getMealMacro._carbRunningTotal += base.carbs;

      const isLastMeal = mType === mealTypes[mealTypes.length - 1];
      if (isLastMeal) {
        const drift = macros.carbs - getMealMacro._carbRunningTotal;
        if (Math.abs(drift) <= 5) {          // only correct small rounding drifts
          base.carbs = Math.max(0, base.carbs + drift);
          if (drift !== 0) LOG(`[CARB-DRIFT]: rounding correction ${drift > 0 ? '+' : ''}${drift}g applied to ${mType}`);
        }
        getMealMacro._carbRunningTotal = 0;  // reset for next plan build
      }
    })();

    // ── Original per-meal adjustments preserved below (protein + fat tweaks) ──
    // Protein timing adjustments — kept as-is (additive on top of flat protein)
    if (mType === 'post')      { base.protein = Math.round(base.protein * 1.3); }
    if (mType === 'breakfast') { base.protein = Math.round(base.protein * 1.1); }
    // NOTE: carbs multiplier for post (×1.2) and dinner (×0.6) REMOVED —
    // now handled by proportional carbShare above to prevent double-adjustment.
    // ── HOTFIX P4 — GERD: enforce small dinner and avoid large late meals ──
    // GERD patients must have a significantly lighter dinner (reduced carbs + fat)
    // to minimize LES relaxation and reflux risk during sleep.
    if (mType === 'dinner' && DE.healthConditions.includes('gerd')) {
      base.carbs = Math.round(base.carbs * 0.5);  // further reduce carbs at dinner for GERD
      base.fat   = Math.round(base.fat   * 0.7);  // reduce fat — high fat - LES relaxation
      LOG('HOTFIX-P4: GERD dinner portion reduced — carbs 50% and fat 70% of base');
    }
    // Hunger-focused: boost protein in snacks for satiety
    if (mType === 'snack' && (DE.dietProblems.includes('hunger') || DE.dietProblems.includes('night-hunger'))) {
      base.protein = Math.round(base.protein * 1.4); // more protein = more satiety
    }
    // Diabetes: snacks should be low-carb to prevent glucose spikes
    if (mType === 'snack' && DE.healthConditions.includes('diabetes')) {
      base.carbs = Math.round(base.carbs * 0.5);
    }

    // ── CARB CYCLE intra-meal distribution ────────────────────────
    // Only active when diet === 'carbcycle' AND weeklyMeta has day state.
    // Training days: concentrate carbs around workout meals (pre/post/breakfast)
    //   and reduce carbs at dinner (glycogen is replenished, no need for more)
    // Rest days: reduce carbs evenly; boost fat at dinner for satiety
    if (DE.selectedDiet === 'carbcycle' && weeklyMeta && weeklyMeta.carbCycleActive) {
      if (weeklyMeta.isTrainingDay) {
        // Training day intra-meal carb shifting
        if (mType === 'pre')       base.carbs = Math.round(base.carbs * 1.4);  // pre-workout: glycogen loading
        if (mType === 'post')      base.carbs = Math.round(base.carbs * 1.3);  // post-workout: glycogen replenishment (stacks with base)
        if (mType === 'breakfast') base.carbs = Math.round(base.carbs * 1.15); // morning energy
        if (mType === 'dinner')    { base.carbs = Math.round(base.carbs * 0.5); base.fat = Math.round(base.fat * 1.2); } // evening: lower carb
        if (mType === 'snack')     base.carbs = Math.round(base.carbs * 0.8);  // snacks lean
      } else {
        // Rest day intra-meal carb reduction + fat redistribution for satiety
        if (mType === 'breakfast') { base.carbs = Math.round(base.carbs * 0.85); base.fat = Math.round(base.fat * 1.15); }
        if (mType === 'lunch')     { base.carbs = Math.round(base.carbs * 0.80); base.fat = Math.round(base.fat * 1.20); }
        if (mType === 'dinner')    { base.carbs = Math.round(base.carbs * 0.40); base.fat = Math.round(base.fat * 1.30); } // minimal carb at night
        if (mType === 'snack')     { base.carbs = Math.round(base.carbs * 0.50); base.fat = Math.round(base.fat * 1.25); } // fat-rich snack for satiety
        if (mType === 'pre')       base.carbs = Math.round(base.carbs * 0.7);   // rest day: no heavy pre-workout load
        if (mType === 'post')      base.carbs = Math.round(base.carbs * 0.8);   // rest day: lighter post-workout
      }
      // ── HF-2 ACTIVATION FLAG ──────────────────────────────────────────
      // Signal to ccpmApply (HF-2 wrapper) that getMealMacro has already
      // applied carb-cycle multipliers. The wrapper stamps portions as
      // _ccpmAdjusted so ccpmApply skips double multiplication.
      weeklyMeta.ccMacroLayerApplied = true;
    }

    return base;
  };

  // ── FIX-2: استخدام FOOD_MAP (O(1)) بدلا من FOOD_DB.find (O(n)) ──────────
  // Get allowed available foods
  const allowedAvailable = DE.availableFoods
    .map(id => FOOD_MAP.get(id))
    .filter(f => f && isFoodAllowed(f).ok);

  // Apply health constraints to further filter
  // ── UNIFIED MEDICAL FILTER: avoidFoods + blockedConditions (V16) ──
  const healthFilteredFoods = allowedAvailable.filter(f => {
    // 1. HEALTH_MEAL_RULES avoidFoods (legacy path)
    for (const hc of DE.healthConditions) {
      const rules = HEALTH_MEAL_RULES[hc];
      if (rules && rules.avoidFoods && rules.avoidFoods.includes(f.id)) return false;
    }
    // 2. V16 blockedConditions field on food object
    if (Array.isArray(f.blockedConditions) && f.blockedConditions.length > 0) {
      for (const bc of f.blockedConditions) {
        if (DE.healthConditions.includes(bc)) return false;
      }
    }
    return true;
  });

  // Blocked foods list — reuse the already-resolved objects from allowedAvailable
  const _allResolved = DE.availableFoods
    .map(id => FOOD_MAP.get(id))
    .filter(Boolean);
  const blockedFoods = _allResolved
    .filter(f => {
      if (!isFoodAllowed(f).ok) return true;
      for (const hc of DE.healthConditions) {
        const rules = HEALTH_MEAL_RULES[hc];
        if (rules && rules.avoidFoods && rules.avoidFoods.includes(f.id)) return true;
      }
      return false;
    })
    .map(f => {
      const dietBlock = isFoodAllowed(f);
      if (!dietBlock.ok) return { food:f, reason: dietBlock.reason };
      for (const hc of DE.healthConditions) {
        const rules = HEALTH_MEAL_RULES[hc];
        if (rules && rules.avoidFoods && rules.avoidFoods.includes(f.id))
          return { food:f, reason:`ممنوع لحالة: ${HC_LABELS[hc]||hc} — ${rules.mealNotes||''}` };
      }
      return { food:f, reason:'سبب غير محدد' };
    });
  // ── END FIX-2 ─────────────────────────────────────────────────────────────

  // Build meals HTML
  let totalPlanQuality = 0;
  const mealsHTML = mealTypes.map(mType => {
    const isSnack = mType === 'snack';
    const mCals   = isSnack ? snackCals : mainCals;
    const mMacro  = getMealMacro(mType);

    // Filter foods suitable for this meal type — use health-filtered pool
    const suitableFoods = healthFilteredFoods.filter(f =>
      f.mealTypes && f.mealTypes.includes(mType)
    );

    // Snack: only snack/fruit foods
    const mealFoods = isSnack
      ? _elfCurateMealFoods(mType, healthFilteredFoods.filter(f => ['snack','fruit','dairy'].includes(f.cat))).slice(0, 3)
      : _elfCurateMealFoods(mType, suitableFoods);

    // ── HOTFIX P3 — DIABETES MEAL CARB HARD CAP ───────────────────────
    // Applied BEFORE optimizePortions — not as a warning, but as a numeric clamp.
    // Rules: standard meals ≤ 60g carbs; post-workout exception ≤ 75g.
    // Preserves carbcycle/refeed day carb allowances within diabetic limits.
    // Applies for both 'diabetes' and 'insulin' conditions.
    if (DE.healthConditions.includes('diabetes') || DE.healthConditions.includes('insulin')) {
      const _p3PostWorkout = (mType === 'post');
      const _p3CarbCeiling = _p3PostWorkout ? 75 : 60;
      if (mMacro.carbs > _p3CarbCeiling) {
        LOG(`HOTFIX-P3: Diabetes carb cap — meal '${mType}' carbs clamped ${mMacro.carbs}g - ${_p3CarbCeiling}g`);
        const _p3FreedCals = (mMacro.carbs - _p3CarbCeiling) * 4;
        mMacro.carbs = _p3CarbCeiling;
        // Redistribute freed calories to fat (preserve calorie density for satiety)
        mMacro.fat = Math.round(mMacro.fat + _p3FreedCals / 9);
      }
    }

    // ── PATCH B3: surgical try/catch around optimizePortions ─────────
    // Prevents malformed food objects or engine exceptions from crashing
    // the entire buildSmartMealPlan render. Returns safe fallback on error.
    let portions = [];
    if (mealFoods.length > 0) {
      try {
        portions = optimizePortions(mType, mCals, mMacro, mealFoods);
        // Guard: ensure result is always an array
        if (!Array.isArray(portions)) portions = [];
        // ── CCPM: apply carb cycle portion modulation (additive, non-destructive) ──
        portions = ccpmApply(portions, mType, weeklyMeta);
      } catch (portionsErr) {
        LOG(`PatchB3: optimizePortions exception for meal '${mType}': ${portionsErr.message || portionsErr} — using safe fallback`);
        // Fallback: take first 1–2 foods from the pool with safe gram defaults
        portions = mealFoods.slice(0, 2).map(f => {
          const safeGrams = (f && f.cal > 0) ? Math.min(150, Math.max(30, Math.round(mCals / (f.cal || 100) * 100))) : 100;
          const safeCals  = f ? Math.round((f.cal  || 0) * safeGrams / 100) : 0;
          const safePro   = f ? +((f.pro  || 0) * safeGrams / 100).toFixed(1) : 0;
          const safeCarb  = f ? +((f.carb || 0) * safeGrams / 100).toFixed(1) : 0;
          const safeFat   = f ? +((f.fat  || 0) * safeGrams / 100).toFixed(1) : 0;
          return { food: f, grams: safeGrams, cals: safeCals, pro: safePro, carb: safeCarb, fat: safeFat, _fallback: true };
        }).filter(p => p.food);
      }
    }

    // -- UNIFY: use the 90-day plan's meal for this slot (single source of truth) --
    // Falls back to the optimizePortions result above only if the plan has no meal here.
    if (_smpsBySlot[mType] && Array.isArray(_smpsBySlot[mType].foods) && _smpsBySlot[mType].foods.length) {
      portions = _smpsBySlot[mType].foods;
    }

    // Validate meal composition
    const quality = portions.length ? calcMealQuality(mType, portions, context) : null;
    if (quality) totalPlanQuality += quality.quality;

    const realCals = portions.reduce((s,p) => s + p.cals, 0);
    const realPro  = +portions.reduce((s,p) => s + p.pro, 0).toFixed(1);
    const realCarb = +portions.reduce((s,p) => s + p.carb, 0).toFixed(1);
    const realFat  = +portions.reduce((s,p) => s + p.fat, 0).toFixed(1);

    // ── تجميع كل عناصر الخضار في صف واحد "سلطة" ──
    const _saladGrouped = (function(ps){
      var veg=ps.filter(function(p){return p.food&&p.food.cat==='veggie';});
      var oth=ps.filter(function(p){return !(p.food&&p.food.cat==='veggie');});
      if(veg.length<2) return ps;
      var sum=function(k){return veg.reduce(function(s,p){return s+(p[k]||0);},0);};
      var names=veg.map(function(p){return p.food.nameAr||p.food.id;}).join(' + ');
      return oth.concat([{isSalad:true,saladNames:names,food:{nameAr:'سلطة',cat:'veggie',id:'salad_group'},grams:sum('grams'),cals:Math.round(sum('cals')),pro:+sum('pro').toFixed(1),carb:+sum('carb').toFixed(1),fat:+sum('fat').toFixed(1)}]);
    })(portions);
    const foodsHTML = _saladGrouped.length
      ? _saladGrouped.map(p => `
          <div class="food-item">
            <span class="food-name">${p.isSalad ? ('سلطة <small style="color:var(--text-dim);font-weight:400;">('+p.saladNames+')</small>') : p.food.nameAr}</span>
            <span class="food-amount" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="background:rgba(42,140,232,0.15);color:var(--blue);border-radius:5px;padding:1px 7px;font-weight:800;font-size:12px;">${p.grams}جم</span>
              <span style="color:var(--accent);font-weight:800;font-size:12px;">${p.cals}</span>
              <span style="color:var(--green);font-size:11px;">${p.pro}ج</span>
            </span>
          </div>`).join('')
      : `<div style="padding:10px;background:rgba(232,76,76,0.08);border-radius:8px;font-size:12px;color:var(--red);">
         لم تختر أطعمة مناسبة لهذه الوجبة —
          <button onclick="goStep(7)" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:12px;text-decoration:underline;">أضف أطعمة</button>
        </div>`;

    // Quality indicators
    const qualityHTML = quality ? (() => {
      const highIssues = quality.issues.filter(i => i.severity === 'high');
      const medIssues  = quality.issues.filter(i => i.severity === 'medium');
      const issuesHtml = [...highIssues, ...medIssues].map(i =>
        `<div style="font-size:11px;color:${i.severity==='high'?'var(--red)':'var(--orange)'};margin-top:4px;">${i.msg}</div>`
      ).join('');
      const qColor = quality.quality >= 70 ? 'var(--green)' : quality.quality >= 40 ? 'var(--orange)' : 'var(--red)';
      return `<details class="meal-quality"><summary>مؤشرات الجودة والشبع</summary><div class="mq-body" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;padding-top:8px;">
        <span style="font-size:10.5px;color:${qColor};font-weight:800;">جودة ${quality.quality}%</span>
        <span style="font-size:10.5px;color:var(--blue);font-weight:700;">شبع ${quality.satiety}%</span>
        <span style="font-size:10.5px;color:var(--purple);font-weight:700;">هضم ${quality.digestion}%</span>
        <span style="font-size:10.5px;color:var(--text-muted);font-weight:700;">التزام ${quality.adherence}%</span>
      ${issuesHtml}</div></details>`;
    })() : '';

    return `<div class="meal-card">
      <div class="meal-card-header">
        <div style="flex:1;">
          <div class="meal-title">${mealLabels[mType]}</div>
          <div class="meal-subtitle">${mealDesc[mType]} · <strong style="color:var(--accent);">${realCals||mCals} kcal</strong>${
            // CCPM: badge يظهر نوع اليوم في كل وجبة عند تفعيل الكارب سايكل
            (weeklyMeta && weeklyMeta.carbCycleActive && DE.selectedDiet === 'carbcycle')
              ? ` · <span style="font-size:10px;font-weight:800;padding:1px 6px;border-radius:8px;${
                    weeklyMeta.isTrainingDay
                      ? 'background:rgba(42,232,123,0.15);color:var(--green);'
                      : 'background:rgba(42,140,232,0.12);color:var(--blue);'
                  }">${weeklyMeta.isTrainingDay ? 'كارب عال' : 'كارب منخفض'}</span>`
              : ''
          }</div>
        </div>
      </div>
      <div class="meal-foods">${foodsHTML}</div>
      ${portions.length ? `<div class="meal-macros">
        <span class="macro-pill" style="color:var(--green);">${realPro}ج</span>
        <span class="macro-pill" style="color:var(--blue);">${realCarb}ج</span>
        <span class="macro-pill" style="color:var(--orange);">${realFat}ج</span>
      </div>` : ''}
      ${qualityHTML}
      ${portions.length ? renderP3Quality(portions) : ''}
    </div>`;
  }).join('');

  // Plan-level quality summary
  const avgQuality = mealTypes.length ? Math.round(totalPlanQuality / mealTypes.length) : 0;

  // ── Analysis Block
  let analysisHTML = '';
  if (blockedFoods.length > 0) {
    analysisHTML += `<div class="info-box info-red" style="margin-bottom:8px;flex-direction:column;align-items:flex-start;gap:6px;">
      <div style="font-weight:800;font-size:13px;color:var(--red);">أطعمة تم استبعادها تلقائيا:</div>
      ${blockedFoods.map(b=>`<div style="font-size:12px;">• ${b.food.nameAr} — ${b.reason}</div>`).join('')}
    </div>`;
  }
  if (healthFilteredFoods.length === 0) {
    analysisHTML += `<div class="info-box info-warning">
      <span class="ib-icon"></span>
      <span>لم تختر أي أطعمة متاحة — الخطة تعتمد على توصيات افتراضية
      <button onclick="goStep(7)" style="background:none;border:none;color:var(--blue);cursor:pointer;text-decoration:underline;font-size:12px;">أضف أطعمتك الآن</button></span>
    </div>`;
  } else {
    const catCount = {};
    healthFilteredFoods.forEach(f => catCount[f.cat] = (catCount[f.cat]||0)+1);
    const catSummary = Object.entries(catCount).map(([c,n]) =>
      `${({protein:'',carb:'',fat:'',veggie:'',fruit:'',dairy:'',snack:''}[c]||'')} ${n}`
    ).join(' · ');
    const qColor = avgQuality >= 70 ? 'var(--green)' : avgQuality >= 45 ? 'var(--orange)' : 'var(--red)';
    analysisHTML += `<div class="info-box info-green" style="margin-bottom:8px;">
      <span class="ib-icon"></span>
      <span>تم بناء الخطة من <strong>${healthFilteredFoods.length}</strong> طعام متاح: ${catSummary}
      · <span style="color:${qColor};font-weight:800;">جودة الخطة: ${avgQuality}%</span></span>
    </div>`;
  }

  // Health-specific meal notes
  const healthNotes = DE.healthConditions.map(hc => HEALTH_MEAL_RULES[hc]?.mealNotes).filter(Boolean);
  if (healthNotes.length) {
    analysisHTML += `<div class="info-box info-warning" style="margin-bottom:8px;flex-direction:column;align-items:flex-start;gap:4px;">
      <div style="font-weight:800;font-size:12px;">تعليمات خاصة بحالتك الصحية:</div>
      ${healthNotes.map(n=>`<div style="font-size:11.5px;">• ${n}</div>`).join('')}
    </div>`;
  }

  // ── INTEGRATION: Weekly meta banner (phase label, safety flags, week note) ──
  // Renders DWCP phase info AND PHL plateau correction notices.
  let weeklyBannerHTML = '';
  if (weeklyMeta && weeklyMeta.weekNumber) {
    const wm = weeklyMeta;
    const isSpecial = wm.isRefeedWeek || wm.isDietBreak;
    const bannerColor = wm.isDietBreak ? 'info-blue' : wm.isRefeedWeek ? 'info-blue' : 'info-green';
    const phaseIcon   = wm.isDietBreak ? '' : wm.isRefeedWeek ? '' : '';
    weeklyBannerHTML = `<div class="info-box ${bannerColor}" style="margin-bottom:10px;flex-direction:column;align-items:flex-start;gap:4px;">
      <div style="font-size:12px;font-weight:800;">${phaseIcon} أسبوع ${wm.weekNumber} — ${wm.phaseLabel}${wm.isRefeedWeek?' (Refeed)':''}${wm.isDietBreak?' (Diet Break)':''}</div>
      ${wm.weekNote ? `<div style="font-size:11px;color:var(--text-muted);line-height:1.7;">${wm.weekNote}</div>` : ''}
      ${wm.expectedTrend ? `<div style="font-size:10.5px;color:var(--text-dim);">التوقع: ${wm.expectedTrend}</div>` : ''}
      ${wm.safetyFlags && wm.safetyFlags.length ? wm.safetyFlags.map(f=>`<div style="font-size:10.5px;color:var(--orange);">${f}</div>`).join('') : ''}
    </div>`;
  }

  // ── PHL active banner — shown when plateau correction was applied ──
  let phlBannerHTML = '';
  if (weeklyMeta && weeklyMeta.phlActive) {
    const wm = weeklyMeta;
    const deltaSign  = wm.phlCalDelta >= 0 ? '+' : '';
    const deltaColor = wm.phlCalDelta >= 0 ? 'var(--blue)' : 'var(--orange)';
    const signalList = (wm.phlSignals || []).slice(0, 3)
      .map(s => `<div style="font-size:10.5px;color:var(--text-muted);line-height:1.6;">${s}</div>`).join('');
    const warnList = (wm.phlWarnings || [])
      .map(w => `<div style="font-size:10px;color:var(--orange);">${w}</div>`).join('');

    phlBannerHTML = `
    <div class="info-box info-warning" style="margin-bottom:10px;flex-direction:column;align-items:flex-start;gap:5px;border-color:rgba(232,160,42,0.35);">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:12px;font-weight:800;">تعديل Plateau تلقائي نشط</span>
        <span style="font-size:10px;background:rgba(232,160,42,0.12);color:var(--orange);padding:2px 8px;border-radius:10px;font-weight:700;">${wm.phlLabel}</span>
        <span style="font-size:11px;font-weight:800;color:${deltaColor};margin-right:auto;">${deltaSign}${wm.phlCalDelta} kcal</span>
      </div>
      <div style="font-size:11px;color:var(--text-muted);">استراتيجية: <strong style="color:var(--text);">${wm.phlStrategy}</strong></div>
      ${signalList}
      ${warnList}
    </div>`;
  }

  // ── CarbCycle day-state banner ─────────────────────────────────
  let carbCycleBannerHTML = '';
  if (weeklyMeta && weeklyMeta.carbCycleActive) {
    const cc = weeklyMeta;
    const isTraining  = cc.isTrainingDay;
    const dayIcon     = isTraining ? '' : '';
    const dayColor    = isTraining ? 'var(--green)' : 'var(--blue)';
    const dayBg       = isTraining ? 'rgba(42,232,123,0.08)' : 'rgba(42,140,232,0.08)';
    const carbDeltaSign = (cc.carbDelta || 0) >= 0 ? '+' : '';
    const fatDeltaSign  = (cc.fatDelta  || 0) >= 0 ? '+' : '';
    carbCycleBannerHTML = `
    <div class="info-box" style="margin-bottom:10px;flex-direction:column;align-items:flex-start;gap:5px;
         background:${dayBg};border-color:${dayColor}33;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:13px;font-weight:800;">${dayIcon} يوم ${cc.carbCycleDayType} — كارب سايكل</span>
        <span style="font-size:10px;padding:2px 9px;border-radius:10px;font-weight:800;
               background:${isTraining?'rgba(42,232,123,0.15)':'rgba(42,140,232,0.15)'};
               color:${dayColor};">${isTraining ? 'كارب عال' : 'كارب منخفض'}</span>
      </div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--text-muted);">
        <span>كارب: <strong style="color:${dayColor};">${carbDeltaSign}${cc.carbDelta || 0}ج</strong> عن الأساس</span>
        <span>دهون: <strong style="color:var(--orange);">${fatDeltaSign}${cc.fatDelta || 0}ج</strong> عن الأساس</span>
        <span>${cc.trainDaysPerWeek || 0} أيام تمرين / أسبوع</span>
      </div>
      <div style="font-size:10.5px;color:var(--text-dim);">
        ${isTraining ? 'الكارب موزع حول التمرين — قبل وبعد للجليكوجين والتعافي' : 'كارب منخفض للتعافي — دهون أعلى للشبع والدعم الهرموني'}
      </div>
    </div>`;
  }

  document.getElementById('res-meals').innerHTML = weeklyBannerHTML + phlBannerHTML + carbCycleBannerHTML + analysisHTML + mealsHTML;
  LOG(`✔ Smart meal plan built from ${healthFilteredFoods.length} health-filtered foods · avg quality ${avgQuality}%`);
}

// ── TIMELINE ──────────────────────────────────────────────────
function buildTimeline(tdee, wkKg, wksTo) {
  const container = document.getElementById('mp-timeline-section');
  if (!container) return;
  const diff = Math.abs(DE.weight - DE.target);
  const phases = diff <= 5
    ? [{wk:'1-4',label:'مرحلة التكيف',note:'تكيف مع النظام الجديد',col:'var(--blue)'},{wk:'4-8',label:'مرحلة النتائج',note:'نتائج واضحة',col:'var(--orange)'},{wk:'8+',label:'الثبات',note:'حفاظ على النتائج',col:'var(--green)'}]
    : [{wk:'1-3',label:'التكيف الأولي',note:'نزول/رفع ماء + جليكوجين',col:'var(--blue)'},{wk:'3-12',label:'التغيير الحقيقي',note:`~${wkKg} كجم/أسبوع`,col:'var(--orange)'},{wk:'12+',label:'التحسين',note:'تركيبة جسمانية أفضل',col:'var(--green)'}];
  container.innerHTML = phases.map((p,i) => `
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
      <div style="width:32px;height:32px;border-radius:50%;background:${p.col};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#000;flex-shrink:0;">${i+1}</div>
      <div><div style="font-size:13px;font-weight:800;color:var(--text);">${p.label} <span style="font-size:11px;color:var(--text-muted);">· أسبوع ${p.wk}</span></div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:3px;">${p.note}</div></div>
    </div>`).join('');
  const card = document.getElementById('timeline-card');
  if (card) card.style.display = 'block';
}

// ── TIMELINE DOM INJECTION ────────────────────────────────────
(function injectTimelineDOM() {
  const resSection = document.getElementById('results-section');
  if (!resSection) return;
  if (document.getElementById('timeline-card')) return;
  const tl = document.createElement('div');
  tl.className = 'card card-blue';
  tl.id = 'timeline-card';
  tl.style.display = 'none';
  tl.innerHTML = `<div class="section-title"><span class="icon"></span> توقعات الجدول الزمني</div><div id="mp-timeline-section"></div>`;
  resSection.appendChild(tl);
})();

// ── DWCP PANEL DOM INJECTION ──────────────────────────────────
(function injectDWCPPanelDOM() {
  const doInject = () => {
    const resSection = document.getElementById('results-section');
    if (!resSection) return;
    if (document.getElementById('dwcp-progression-card')) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'dwcp-progression-card';
    card.style.cssText = 'border-color:rgba(155,89,182,0.30);display:none;';
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;margin-bottom:0;"
           onclick="dwcpTogglePanel()">
        <div class="section-title" style="margin-bottom:0;">
          <span class="icon"></span>
          التقدم الأسبوعي الديناميكي
          <span style="font-size:10px;color:var(--text-dim);font-weight:400;">(12 أسبوع)</span>
        </div>
        <span id="dwcp-panel-arrow" style="font-size:14px;color:var(--text-muted);">&#9660;</span>
      </div>
      <div id="dwcp-panel-body" style="display:none;margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">
        <div id="dwcp-progression-content">
          <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;">
            جاري تحميل خطة التقدم...
          </div>
        </div>
      </div>`;
    resSection.appendChild(card);
    LOG('DWCP panel injected');
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doInject);
  } else {
    doInject();
  }
})();

// ── PHL PANEL DOM INJECTION ───────────────────────────────────
(function injectPHLPanelDOM() {
  const doInject = () => {
    const resSection = document.getElementById('results-section');
    if (!resSection) return;
    if (document.getElementById('phl-plateau-card')) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'phl-plateau-card';
    card.style.cssText = 'border-color:rgba(232,76,76,0.25);display:none;';
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;margin-bottom:0;"
           onclick="phlTogglePanel()">
        <div class="section-title" style="margin-bottom:0;">
          <span class="icon"></span>
          خطة كسر الثبات (Plateau Protocol)
          <span style="font-size:10px;color:var(--text-dim);font-weight:400;">Refeed · Diet Break · Relief</span>
        </div>
        <span id="phl-panel-arrow" style="font-size:14px;color:var(--text-muted);">&#9660;</span>
      </div>
      <div id="phl-panel-body" style="display:none;margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">
        <div id="phl-panel-content">
          <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;">
            جاري تحميل بروتوكول كسر الثبات...
          </div>
        </div>
      </div>`;
    resSection.appendChild(card);
    LOG('PHL panel injected');
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doInject);
  } else {
    doInject();
  }
})();

function dwcpTogglePanel() {
  const body  = document.getElementById('dwcp-panel-body');
  const arrow = document.getElementById('dwcp-panel-arrow');
  if (!body) return;
  const isOpen = body.style.display === 'block';
  body.style.display  = isOpen ? 'none' : 'block';
  if (arrow) arrow.innerHTML = isOpen ? '&#9660;' : '&#9650;';
  if (!isOpen) DWCP.renderProgressionPanel('dwcp-progression-content');
}

function dwcpShowPanel() {
  const card = document.getElementById('dwcp-progression-card');
  if (card) card.style.display = 'block';
}

function phlTogglePanel() {
  const body  = document.getElementById('phl-panel-body');
  const arrow = document.getElementById('phl-panel-arrow');
  if (!body) return;
  const isOpen = body.style.display === 'block';
  body.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.innerHTML = isOpen ? '&#9660;' : '&#9650;';
  if (!isOpen) PHL.renderPanel('phl-panel-content');
}

function phlShowPanel() {
  const card = document.getElementById('phl-plateau-card');
  if (card) card.style.display = 'block';
}

// ── PRINT STYLES ──────────────────────────────────────────────
const printStyles = document.createElement('style');
printStyles.textContent = `
  @media print {
    /* ── Reset & base ── */
    *, *::before, *::after { box-sizing: border-box !important; }
    body {
      background: #fff !important;
      color: #111 !important;
      font-family: 'Segoe UI', Arial, sans-serif !important;
      font-size: 12px !important;
      margin: 0 !important;
      padding: 0 !important;
      direction: rtl !important;
    }

    /* ── Hide everything except results ── */
    .nav-row, #step-indicator, .btn-calc, .btn-next, .btn-back,
    .main-tabs, .tab-bar, header, footer,
    #diet-info-section, #nc-results-section,
    .step-panel { display: none !important; }

    /* ── Show only step-8 (results) ── */
    #step-8 { display: block !important; }
    #results-section { display: block !important; }

    /* ── Force all cards visible ── */
    .card { 
      display: block !important;
      border: 1px solid #ccc !important;
      background: #fff !important;
      border-radius: 8px !important;
      padding: 12px !important;
      margin-bottom: 10px !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .card[style*="display:none"], .card[style*="display: none"] {
      display: none !important;
    }

    /* ── Force DWCP weekly progression panel fully visible ── */
    #dwcp-progression-card { display: block !important; }
    #dwcp-panel-body { display: block !important; }
    #dwcp-progression-content { display: block !important; }
    #dwcp-panel-arrow { display: none !important; }

    /* ── FIXED: preserve meaningful colors — don't blanket override ── */
    /* Previous star-rule color:#111 was wiping all colored text           */
    /* including deficit/surplus values and weekly row tags.               */
    body, p, span, div, li, td, th, h1, h2, h3, h4, h5, h6, label {
      color: #111 !important;
      background: transparent !important;
    }
    /* Restore semantic colors for key values */
    .text-green, [style*="color:var(--green)"],
    [style*="color: var(--green)"], .deficit-green   { color: #1a7a3a !important; }
    .text-red,   [style*="color:var(--red)"],
    [style*="color: var(--red)"],   .surplus-red      { color: #b71c1c !important; }
    .text-orange,[style*="color:var(--orange)"],
    [style*="color: var(--orange)"]                   { color: #c66000 !important; }
    .text-blue,  [style*="color:var(--blue)"],
    [style*="color: var(--blue)"]                     { color: #1a4fa0 !important; }
    /* Weekly table — Diet Break rows */
    tr[style*="background"],
    .diet-break-row td { background: #f5f5f5 !important; }

    /* ── Section titles ── */
    .section-title { color: #000 !important; font-weight: 900 !important; border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 8px; }

    /* ── Stats grid ── */
    .stats-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 6px !important; }
    .stat-box { border: 1px solid #ddd !important; border-radius: 6px !important; padding: 8px !important; text-align: center !important; }
    .stat-val { font-size: 20px !important; font-weight: 900 !important; color: #000 !important; }
    .stat-lbl { font-size: 10px !important; color: #555 !important; }

    /* ── Weekly table ── */
    table { width: 100% !important; border-collapse: collapse !important; font-size: 11px !important; }
    th { background: #f0f0f0 !important; color: #000 !important; padding: 5px !important; border: 1px solid #ccc !important; }
    td { padding: 5px !important; border: 1px solid #eee !important; color: #111 !important; }

    /* ─── Meal plan cards ── */
    .meal-card { break-inside: avoid !important; page-break-inside: avoid !important; border: 1px solid #ddd !important; margin-bottom: 6px !important; padding: 8px !important; border-radius: 6px !important; }

    /* ── Page breaks ── */
    #res-macros, #res-meals { page-break-before: auto !important; }
    #dwcp-progression-card { page-break-before: always !important; }

    /* ── Info boxes ── */
    .info-box { border: 1px solid #ccc !important; padding: 6px 10px !important; border-radius: 6px !important; margin: 4px 0 !important; }

    /* ── MNL micronutrient panel ── */
    #mnl-coverage-panel { border: 1px solid #ccc !important; padding: 10px !important; margin-top: 6px !important; }

    /* ── Print header ── */
    #_print_header { display: block !important; text-align: center; border-bottom: 2px solid #333; margin-bottom: 14px; padding-bottom: 8px; }
  }
  /* Hidden by default — only shows in print via @media print above */
  #_print_header { display: none; }
`;
document.head.appendChild(printStyles);

// ── Enhanced print function — forces DWCP panel open before printing ──
function printPlan() {
  // ── Step 1: force results section visible regardless of active step ──
  const step8 = document.getElementById('step-8');
  const resultsSection = document.getElementById('results-section');
  if (step8) step8.style.display = 'block';
  if (resultsSection) resultsSection.style.display = 'block';

  // ── Step 2: expand DWCP panel and render table if needed ──
  const dwcpCard    = document.getElementById('dwcp-progression-card');
  const dwcpBody    = document.getElementById('dwcp-panel-body');
  const dwcpContent = document.getElementById('dwcp-progression-content');

  if (dwcpCard)  dwcpCard.style.display  = 'block';
  if (dwcpBody)  dwcpBody.style.display  = 'block';

  const needsDWCPRender = dwcpContent && !dwcpContent.querySelector('table');
  if (needsDWCPRender &&
      typeof DWCP !== 'undefined' &&
      typeof DWCP.renderProgressionPanel === 'function') {
    DWCP.renderProgressionPanel('dwcp-progression-content');
  }

  // ── Step 3: inject print header ────────────────────────────────────
  let hdr = document.getElementById('_print_header');
  if (!hdr) {
    hdr = document.createElement('div');
    hdr.id = '_print_header';
    const rs = resultsSection || step8;
    if (rs) rs.prepend(hdr);
  }
  const now = new Date().toLocaleDateString('ar-EG');
  hdr.innerHTML = `
    <h2 style="margin:0;font-size:16px;">خطتك الغذائية الشخصية</h2>
    <p style="margin:4px 0 0;font-size:11px;color:#555;">
      ${DE.gender || ''} · ${DE.age || '—'} سنة · ${DE.weight || '—'} كجم - ${DE.target || '—'} كجم ·
      هدف: ${DE.goal || '—'} · نظام: ${DE.selectedDiet || '—'} · تاريخ: ${now}
    </p>`;

  // ── Step 4: defer print until two animation frames pass ─────────────
  // First rAF: browser processes the DOM mutations above.
  // Second rAF + 120ms: browser has fully laid out and painted new nodes.
  // Only then open the print dialog — prevents blank/incomplete printouts.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
      }, 120);
    });
  });
}

// ── Download Plan — exports a self-contained HTML snapshot ──────────
function downloadPlan() {
  try {
    const resultsSection = document.getElementById('results-section');
    if (!resultsSection) {
      alert('لا توجد خطة محسوبة بعد. احسب الخطة أولا ثم حملها');
      return;
    }

    // Ensure DWCP progression table is rendered before cloning
    const dwcpContent = document.getElementById('dwcp-progression-content');
    if (dwcpContent && !dwcpContent.querySelector('table')) {
      if (typeof DWCP !== 'undefined' && typeof DWCP.renderProgressionPanel === 'function') {
        DWCP.renderProgressionPanel('dwcp-progression-content');
      }
    }
    const dwcpCard = document.getElementById('dwcp-progression-card');
    const dwcpBody = document.getElementById('dwcp-panel-body');
    if (dwcpCard) dwcpCard.style.display = 'block';
    if (dwcpBody) dwcpBody.style.display = 'block';

    // ── Helpers & defensive data collection ──
    const _r = function(v){ return (typeof v === 'number' && isFinite(v)) ? Math.round(v) : v; };
    const D  = (typeof DE !== 'undefined' && DE) ? DE : {};

    var _dietKey = D.selectedDiet || 'balanced';
    var _tdee   = (typeof calcTDEE === 'function') ? calcTDEE()
                : (typeof calculateTDEE === 'function') ? calculateTDEE() : null;
    var _target = (typeof calcTargetCals === 'function') ? calcTargetCals() : _tdee;
    var _mac    = (typeof calcMacros === 'function') ? calcMacros(_target, _dietKey)
                : (typeof calculateMacros === 'function') ? calculateMacros(_target) : null;

    var gender = D.gender || '';
    var age    = (D.age != null && D.age !== '') ? D.age : '—';
    var wNow   = (D.weight != null && D.weight !== '') ? D.weight : '—';
    var wTgt   = (D.target != null && D.target !== '') ? D.target : '—';
    var goal   = D.goal || '—';
    var now    = new Date().toLocaleDateString('ar-EG');

    var isCut = /تنشيف|خسار|نقص|cut|loss|دهون/i.test(String(goal)) ||
                (typeof wNow === 'number' && typeof wTgt === 'number' && wNow > wTgt);

    var pro   = _mac ? _r(_mac.protein) : '—';
    var carb  = _mac ? _r(_mac.carbs)   : '—';
    var fat   = _mac ? _r(_mac.fat)     : '—';
    var tdeeR = (_tdee != null)   ? _r(_tdee)   : '—';
    var tgtR  = (_target != null) ? _r(_target) : '—';

    function _step(n, ico, title, bodyHTML, applyHTML){
      return '<section class="dlx-step">' +
        '<div class="dlx-step-head"><div class="dlx-badge">' + n + '</div>' +
        '<span class="ico">' + ico + '</span><h2>' + title + '</h2></div>' +
        '<div class="dlx-body">' + bodyHTML + '</div>' +
        (applyHTML ? '<div class="dlx-apply"><b>كيفية التطبيق:</b> ' + applyHTML + '</div>' : '') +
        '</section>';
    }

    var phaseRows = [
      ['أسبوع 1', 'تكيف (Adaptation)', 'عجز خفيف ليعتاد جسمك على النظام بدون صدمة أو جوع شديد'],
      ['أسبوع 2–3', 'عجز معتدل', 'مرحلة الخسارة الأساسية — التزم بالسعرات والبروتين بدقة'],
      ['أسبوع 4', 'ريفيد (Refeed)', 'ارفع الكارب يوما لإنعاش الأيض وهرمون اللبتين وكسر أي ركود'],
      ['أسبوع 5', 'عجز معتدل', 'عد لعجز الخسارة بعد الريفيد'],
      ['أسبوع 6', 'ريفيد (Refeed)', 'ريفيد ثان لحماية الأيض والحفاظ على الأداء'],
      ['أسبوع 7–8', 'عجز أقصى آمن', 'تسريع مدروس للخسارة مع بروتين عال لحماية العضل'],
      ['أسبوع 9', 'استراحة دايت (Diet Break)', 'أسبوع كامل على سعرات الثبات — راحة هرمونية ونفسية تمنع الثبات'],
      ['أسبوع 10', 'عجز ناعم', 'استئناف الخسارة بلطف بعد الاستراحة'],
      ['أسبوع 11', 'عجز معتدل', 'دفعة خسارة أخيرة قبل التثبيت'],
      ['أسبوع 12', 'تثبيت (Stabilization)', 'رفع تدريجي للسعرات نحو الثبات لتثبيت النتائج'],
      ['أسبوع 13', 'متابعة وإعادة تقييم', 'قس نتائجك وأعد حساب أرقامك على وزنك الجديد لبدء دورة محسنة']
    ];
    var phaseTableHTML;
    if (isCut) {
      phaseTableHTML = '<table class="dlx-ptable"><thead><tr><th>المدة</th><th>المرحلة</th><th>ماذا تفعل</th></tr></thead><tbody>' +
        phaseRows.map(function(r){ return '<tr><td><b>'+r[0]+'</b></td><td><span class="ph">'+r[1]+'</span></td><td>'+r[2]+'</td></tr>'; }).join('') +
        '</tbody></table>';
    } else {
      phaseTableHTML = '<p>خطتك مقسمة إلى 13 أسبوعا بمراحل تتكيف تلقائيا مع هدفك (تكيف - بناء/خسارة - مراحل إنعاش دورية - تثبيت). راجع جدول المراحل التفصيلي في القسم الأخير بالأسفل</p>';
    }

    var _dwcpEl = document.getElementById('dwcp-progression-content');
    var _dwcpTableHTML = (_dwcpEl && _dwcpEl.querySelector('table')) ? ('<div class="dlx-dwcp-wrap">' + _dwcpEl.innerHTML + '</div>') : '';
    var guide = '';
    guide += _step('1','','افهم أرقامك الأساسية',
      '<div class="dlx-nums">' +
        '<div class="dlx-num"><div class="v">'+tdeeR+'</div><div class="k">سعرات الحفاظ (TDEE)</div></div>' +
        '<div class="dlx-num"><div class="v">'+tgtR+'</div><div class="k">هدفك اليومي (سعرة)</div></div>' +
        '<div class="dlx-num"><div class="v">'+pro+'غ</div><div class="k">بروتين</div></div>' +
        '<div class="dlx-num"><div class="v">'+carb+'غ</div><div class="k">كارب</div></div>' +
        '<div class="dlx-num"><div class="v">'+fat+'غ</div><div class="k">دهون</div></div>' +
      '</div>' +
      '<p>هذه أرقامك المحسوبة علميا (معادلة Mifflin-St Jeor + مستوى نشاطك). «سعرات الحفاظ» هي ما تحرقه يوميا، و«هدفك اليومي» هو ما تأكله للوصول لهدفك</p>',
      'التزم بهدف السعرات اليومي في حدود ±100 سعرة، وأعط <b>البروتين</b> الأولوية القصوى لحماية عضلاتك أثناء الخسارة');

    guide += _step('2','','نظامك الغذائي ولماذا اخترناه',
      '<p>نظامك: <b>'+_dietKey+'</b>. تم اختيار توزيع الماكروز بناء على هدفك ووزنك ونسبة دهونك لتحقيق أفضل نتيجة مع أقل فقدان للعضل</p>',
      'لا تغير النظام كل أسبوع — أعط كل مرحلة وقتها (٢–٣ أسابيع على الأقل) قبل الحكم على النتيجة');

    guide += _step('3','','وجباتك اليومية وكيف تطبقها',
      '<p>الجدول بالأسفل يوضح وجبات كل يوم بالكميات والماكروز. الأطعمة داخل نفس الفئة <b>قابلة للتبديل</b> بمكافئها في السعرات والماكروز</p>' +
      '<ul>' +
        '<li>وزع وجباتك على مدار اليوم بما يناسب جدولك — العبرة بإجمالي اليوم</li>' +
        '<li>اشرب نحو ٣٥ مل ماء لكل كجم من وزنك يوميا</li>' +
        '<li>استبدل أي صنف بصنف مكافئ إن لم يتوفر، مع الحفاظ على الكمية بالجرام</li>' +
      '</ul>',
      'حضر وجباتك مسبقا (Meal Prep) ليوم أو يومين لتسهل الالتزام وتتجنب الخيارات العشوائية');

    guide += _step('4','','خارطة ال90 يوما (13 أسبوعا) بالمراحل',
      '<p>خطتك ليست رقما ثابتا ل90 يوما — بل <b>مراحل متدرجة</b> مصممة لمنع الثبات واستمرار النتائج:</p>' + (_dwcpTableHTML || phaseTableHTML),
      'تنقل بين الأسابيع من تبويبات «أسبوع 1 - 13»، ونفذ كل مرحلة كما هي — هذا التدرج هو سر استمرار النزول');

    guide += _step('5','','قواعد كسر الثبات (مدمجة تلقائيا)',
      '<ul>' +
        '<li><b>أيام الريفيد:</b> رفع مؤقت للكارب لإنعاش الأيض وهرمون اللبتين</li>' +
        '<li><b>استراحة الدايت (أسبوع 9):</b> أسبوع كامل على الثبات لإعادة ضبط الهرمونات والحالة النفسية</li>' +
        '<li><b>تدوير الكارب:</b> كارب أعلى في أيام التمرين، وأقل في أيام الراحة</li>' +
      '</ul>' +
      '<p>الخطة معايرة علميا على افتراض التزامك بنسبة <b>70–80%</b> من الجدول — دون أي إدخال يدوي</p>',
      'لا تتخط أيام الريفيد أو استراحة الدايت ظنا أنها «تكسر الدايت» — هي جزء أساسي من نجاح الخطة طويلة المدى');

    guide += _step('6','','المتابعة والتعديل',
      '<ul>' +
        '<li>اوزن نفسك صباحا مرة/أسبوع بنفس الظروف، وخذ المتوسط الأسبوعي</li>' +
        '<li>صور نفسك وقس محيط الخصر كل أسبوعين — المرآة أصدق من الميزان</li>' +
        '<li>نم ٧–٩ ساعات؛ قلة النوم تبطئ الخسارة وتزيد الجوع</li>' +
        '<li>إذا توقف الوزن ٣ أسابيع متتالية رغم الالتزام، أعد حساب أرقامك على وزنك الجديد</li>' +
      '</ul>',
      'بعد انتهاء ال90 يوما، أعد إدخال وزنك الحالي لبدء دورة جديدة بأرقام محدثة');

    guide += _step('7','','تنزيل الماء الزائد في آخر فترة التخسيس (بأمان)',
      '<p>لو وزنك ثبت فجأة وأنت ملتزم، غالبا السبب <b>احتباس ماء</b> وليس توقف نزول الدهون — الجسم أحيانا يحبس الماء ثم يطلقه دفعة واحدة (ظاهرة ال«Whoosh»)</p>' +
      '<ul>' +
        '<li><b>لا تقلل الماء:</b> قلة الشرب تزيد الاحتباس. حافظ على ترطيبك المعتاد</li>' +
        '<li><b>وازن الصوديوم:</b> قلل الأطعمة المعالجة والمعلبات عالية الملح، دون منع الملح تماما</li>' +
        '<li><b>زد البوتاسيوم:</b> خضار وفواكه (موز، خيار، ورقيات) تساعد على توازن السوائل</li>' +
        '<li><b>النوم وتقليل التوتر:</b> قلة النوم وارتفاع الكورتيزول يزيدان احتباس الماء</li>' +
        '<li><b>حركة وكارديو خفيف:</b> المشي ينشط الدورة الدموية ويساعد على طرد الماء الزائد</li>' +
        '<li><b>يوم ريفيد محسوب:</b> رفع الكارب مؤقتا أحيانا يطلق ال«Whoosh» وينزل الماء</li>' +
      '</ul>',
      'لو الميزان ثابت أسبوع–أسبوعين رغم التزامك، اهدأ وكمل — غالبا سينزل دفعة واحدة <b>تجنب تماما</b> التجفيف أو حبوب إدرار البول؛ خطيرة وغير ضرورية');

    guide += _step('8','','بعد ال090 يوما: الرجوع التدريجي (Reverse Diet)',
      '<p>أخطر لحظة هي بعد الوصول لهدفك: العودة المفاجئة للأكل الطبيعي ترجع الوزن بسرعة. الحل هو <b>رفع السعرات تدريجيا</b> لإعادة الأيض لوضعه الطبيعي مع تثبيت النتيجة</p>' +
      '<ul>' +
        '<li>ارفع <b>100–150 سعرة أسبوعيا</b> (غالبا من الكارب وبعض الدهون) حتى تصل لسعرات الحفاظ</li>' +
        '<li>اوزن نفسك أسبوعيا؛ زيادة بسيطة (~نصف كيلو) طبيعية بسبب الجلايكوجين والماء وليست دهونا</li>' +
        '<li>حافظ على <b>البروتين العالي</b> والتمرين بانتظام خلال مرحلة الرجوع</li>' +
      '</ul>',
      'الهدف الوصول لأعلى سعرات ممكنة بأقل زيادة دهون — هذا يحمي نتيجتك ويجعل أي مرحلة تخسيس قادمة أسهل وأسرع');

    var cover =
      '<div class="dlx-cover">' +
        '<h1>خطتك الغذائية الشخصية</h1>' +
        '<div class="sub">صمم دايت — محرك التغذية الذكي · خطة 90 يوما</div>' +
        '<div class="dlx-chips">' +
          (gender ? '<div class="dlx-chip">'+gender+'</div>' : '') +
          '<div class="dlx-chip">العمر: <b>'+age+'</b></div>' +
          '<div class="dlx-chip">الهدف: <b>'+goal+'</b></div>' +
          '<div class="dlx-chip">النظام: <b>'+_dietKey+'</b></div>' +
          '<div class="dlx-chip">التاريخ: <b>'+now+'</b></div>' +
        '</div>' +
        '<div class="dlx-hero">' +
          '<div class="box"><div class="n">'+wNow+'</div><div class="l">وزنك الحالي (كجم)</div></div>' +
          '<div class="box"><div class="n">'+wTgt+'</div><div class="l">هدفك (كجم)</div></div>' +
          '<div class="box"><div class="n">'+tgtR+'</div><div class="l">سعراتك اليومية</div></div>' +
        '</div>' +
      '</div>';

    var toc =
      '<div class="dlx-toc"><h3>دليلك خطوة بخطوة</h3><ol>' +
        '<li>افهم أرقامك الأساسية</li>' +
        '<li>نظامك الغذائي ولماذا اخترناه</li>' +
        '<li>وجباتك اليومية وكيف تطبقها</li>' +
        '<li>خارطة ال90 يوما بالمراحل</li>' +
        '<li>قواعد كسر الثبات</li>' +
        '<li>المتابعة والتعديل</li>' +
        '<li>تنزيل الماء الزائد بأمان</li>' +
        '<li>الرجوع التدريجي بعد 90 يوما</li>' +
        '<li>خطتك التفصيلية وجداول الأسابيع</li>' +
      '</ol></div>';

    var cloned = resultsSection.cloneNode(true);
    ['mnl-coverage-panel', '_print_header'].forEach(function(id){
      var el = cloned.querySelector('#' + id);
      if (el) el.remove();
    });

    var _detailExtra = '';
    ['res-health-warnings','res-clinical-protocol','res-problems-solution'].forEach(function(_id){
      var _o = document.getElementById(_id);
      var _c = cloned.querySelector('#'+_id);
      if (_o && _c && getComputedStyle(_o).display !== 'none') { _detailExtra += _c.outerHTML; }
    });
    var _weeksHTML = (typeof SMPS!=='undefined' && SMPS && typeof SMPS.buildPrintableWeeks==='function') ? SMPS.buildPrintableWeeks() : '';
    var detailBody = _detailExtra + _weeksHTML;
    var detail =
      '<section class="dlx-step">' +
        '<div class="dlx-step-head"><div class="dlx-badge">9</div><span class="ico"></span>' +
        '<h2>خطتك التفصيلية وجداول الأسابيع</h2></div>' +
        '<div class="dlx-body">' + detailBody + '</div>' +
      '</section>';

    var disclaimer =
      '<div class="dlx-disc"><b>تنويه طبي:</b> هذه الخطة أداة تخطيط غذائي استرشادية وليست تشخيصا أو وصفة علاجية أو بديلا عن استشارة طبية. الأرقام تقديرية وقد تختلف من شخص لآخر. إذا كانت لديك حالة صحية مزمنة أو تتناول أدوية أو كنت حاملا أو مرضعة، لا تبدأ قبل مراجعة طبيبك أو أخصائي/ة تغذية معتمد. أوقف الخطة واستشر طبيبك عند أي أعراض غير معتادة.</div>' + (DE._pregnancySafety ? '<div class="dlx-disc" style="border-color:#f5b544;background:rgba(245,181,68,.12)"><b>تنبيه هام:</b> تم ضبط السعرات على مستوى الثبات (بدون عجز) لأن الحمل/الرضاعة يتطلب إشرافا طبيا. راجعي طبيبة النساء وأخصائية التغذية لتحديد احتياجك الفعلي.</div>' : '');

    var footer = '<div class="dlx-foot">تم إنشاؤها بواسطة صمم دايت — محرك التغذية الذكي · '+now+'</div>';

    var existingStyles = Array.from(document.styleSheets)
      .map(function(sheet){
        try { return Array.from(sheet.cssRules).map(function(r){ return r.cssText; }).join('\n'); }
        catch (e) { return ''; }
      }).join('\n');

    var themeCSS = `
      :root {
        --bg:#0f1117; --surface:#1a1d27; --surface2:#22263a; --surface3:#2a2f45;
        --border:#2e3350; --text:#e8eaf6; --text-muted:#8892b0; --text-dim:#5a6380;
        --blue:#4A9EFF; --green:#2AE87B; --orange:#F5A623; --red:#E24B4A;
        --purple:#A855F7; --yellow:#FFD700;
      }
      body { background:var(--bg); color:var(--text); font-family:'Segoe UI',Arial,sans-serif; direction:rtl; margin:0; padding:16px; }
      * { box-sizing:border-box; }
    `;

    var guideCSS = `
      .dlx-doc{max-width:920px;margin:0 auto;}
      .dlx-cover{background:linear-gradient(135deg,rgba(42,232,123,0.14),rgba(74,158,255,0.10));border:1px solid var(--border);border-radius:18px;padding:30px 26px;text-align:center;margin-bottom:22px;}
      .dlx-cover h1{margin:0;font-size:26px;font-weight:900;color:var(--green);}
      .dlx-cover .sub{color:var(--text-muted);font-size:13px;margin-top:8px;}
      .dlx-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:16px;}
      .dlx-chip{background:var(--surface2);border:1px solid var(--border);border-radius:999px;padding:6px 13px;font-size:12px;color:var(--text);}
      .dlx-chip b{color:var(--green);}
      .dlx-hero{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:18px;}
      .dlx-hero .box{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 20px;min-width:120px;}
      .dlx-hero .box .n{font-size:24px;font-weight:900;color:var(--green);}
      .dlx-hero .box .l{font-size:11px;color:var(--text-muted);margin-top:2px;}
      .dlx-toc{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 20px;margin-bottom:24px;}
      .dlx-toc h3{margin:0 0 10px;font-size:15px;color:var(--text);}
      .dlx-toc ol{margin:0;padding-inline-start:20px;color:var(--text-muted);font-size:13px;line-height:2;}
      .dlx-step{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px 22px;margin-bottom:18px;break-inside:avoid;}
      .dlx-step-head{display:flex;align-items:center;gap:12px;margin-bottom:12px;}
      .dlx-badge{flex:0 0 auto;width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#2AE87B,#1a9e55);color:#04210f;font-weight:900;font-size:17px;display:flex;align-items:center;justify-content:center;}
      .dlx-step-head .ico{font-size:20px;}
      .dlx-step-head h2{margin:0;font-size:17px;font-weight:800;color:var(--text);}
      .dlx-body{font-size:13.5px;line-height:1.95;color:var(--text);}
      .dlx-body ul{margin:8px 0;padding-inline-start:20px;}
      .dlx-apply{margin-top:12px;background:rgba(42,232,123,0.07);border-right:3px solid var(--green);border-radius:10px;padding:11px 14px;font-size:13px;line-height:1.9;color:var(--text);}
      .dlx-apply b{color:var(--green);}
      .dlx-nums{display:flex;flex-wrap:wrap;gap:10px;margin:6px 0 10px;}
      .dlx-num{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:9px 14px;text-align:center;min-width:92px;}
      .dlx-num .v{font-size:18px;font-weight:900;color:var(--blue);}
      .dlx-num .k{font-size:11px;color:var(--text-muted);margin-top:2px;}
      .dlx-ptable{width:100%;border-collapse:collapse;margin-top:10px;font-size:12.5px;}
      .dlx-ptable th,.dlx-ptable td{border:1px solid var(--border);padding:8px 10px;text-align:right;}
      .dlx-ptable th{background:var(--surface2);color:var(--green);font-weight:800;}
      .dlx-ptable .ph{font-weight:800;color:var(--text);}
      .dlx-disc{background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.3);border-radius:12px;padding:12px 16px;font-size:12px;color:var(--text-muted);line-height:1.85;margin-top:14px;}
      .dlx-dwcp-wrap{overflow-x:auto;margin:12px 0;}
      .dlx-foot{text-align:center;color:var(--text-dim);font-size:11px;margin:24px 0 6px;line-height:1.8;}
    `;

    var htmlDoc = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>خطتك الغذائية — ${now}</title>
  <style>
    ${themeCSS}
    ${existingStyles}
    .nav-row, .btn-next, .btn-back, #btn-download-plan, #step-indicator, .main-tabs, header { display:none !important; }
    #results-section { display:block !important; }
    .card { margin-bottom:12px; }
    ${guideCSS}
  </style>
</head>
<body>
  <div class="dlx-doc">
    ${cover}
    ${toc}
    ${guide}
    ${detail}
    ${disclaimer}
    ${footer}
  </div>
</body>
</html>`;

    var blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    var dateStr = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `خطة-غذائية-${(D.weight!=null&&D.weight!=='')?D.weight:''}كجم-${dateStr}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);

    if (typeof LOG === 'function') LOG('✔ [Download] Structured plan exported');
  } catch(e) {
    console.error('[Download] Error:', e);
    alert('حدث خطأ أثناء التحميل. حاول مجددا أو استخدم زر الطباعة');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const printBtn = document.querySelector('button[onclick="window.print()"]');
  if (printBtn) {
    printBtn.setAttribute('onclick', 'printPlan()');
    printBtn.innerHTML = 'طباعة الخطة الكاملة';
  }
});

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  LOG('✔ Diet Engine v9 initialized — Smart Nutrition Engine: Mifflin St Jeor + Dynamic TDEE + LBM Macros + Adaptive Deficit + Weekly Rate Selector + Detailed Problem Solutions');
  // default weekly rate hint
  const rateBtn = document.querySelector('#rate-btns .choice-btn.selected');
  if (rateBtn) selWeeklyRate(rateBtn, 0.5);
});
