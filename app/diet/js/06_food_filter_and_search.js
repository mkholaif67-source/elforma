// ═══════════════════════════════════════════════════════════════
//  PHASE 4 — FOOD FILTER ENGINE
// ═══════════════════════════════════════════════════════════════
LOG('Phase 4 — Food Filter Engine...');

function isFoodAllowed(food) {
  const diet   = DE.selectedDiet || 'balanced';
  const health = DE.healthConditions;

  // Use DIET_CONSTRAINTS engine
  const constraints = DIET_CONSTRAINTS[diet];
  if (constraints) {
    // 1. Check explicitly forbidden foods
    if (constraints.forbiddenFoods.includes(food.id))
      return { ok:false, reason:`ممنوع في نظام ${getDietLabel(diet)}` };

    // 2. Check allowed categories
    if (!constraints.allowedCats.includes(food.cat) && constraints.allowedCats.length > 0)
      return { ok:false, reason:`فئة ${food.cat} غير مسموح بها في ${getDietLabel(diet)}` };

    // 3. Carb check — only for strict diets (keto/carnivore/lowcarb), NOT balanced/carbcycle
    // And only for foods whose REALISTIC serving would exceed the limit
    // (Don't block foods just because their per-100g carb is high — e.g. rice cakes eaten in 7g servings)
    if (['keto','carnivore'].includes(diet) && food.cat !== 'fat') {
      // For keto/carnivore: check if the food is a carb source with very high carbs per 100g
      if (food.carb > (constraints.maxCarbPerMeal || 10) && !['fruit','veggie'].includes(food.cat)) {
        return { ok:false, reason:`كارب عال (${food.carb}ج/100جم) — لا يناسب ${getDietLabel(diet)}` };
      }
    }
    // For lowcarb: only block foods explicitly in forbiddenFoods (already handled above)
    // balanced & carbcycle: NO carb blocking — they allow all carbs
  }

  // Legacy allowedDiets check (backward compatibility)
  if (food.allowedDiets && food.allowedDiets.length && !food.allowedDiets.includes(diet))
    return { ok:false, reason:`ممنوع في نظام ${getDietLabel(diet)}` };

  // Health filter
  for (const hc of health) {
    if (food.avoidHealth && food.avoidHealth.includes(hc)) {
      return { ok:false, reason:`ممنوع لحالة: ${HC_LABELS[hc] || hc}` };
    }
  }

  return { ok:true, reason:'' };
}

const HC_LABELS = {
  diabetes:'سكري', insulin:'مقاومة إنسولين', bp:'ضغط مرتفع',
  thyroid:'مشاكل غدة', gluten:'حساسية جلوتين', lactose:'حساسية لاكتوز',
  'slow-meta':'بطء حرق', ibs:'قولون', cholesterol:'كوليسترول',
  kidney:'مشاكل كلى', 'fatty-liver':'كبد دهني', gout:'نقرس',
  anemia:'أنيميا', pcos:'تكيس مبايض', gerd:'حموضة'
};

function getDietLabel(k) {
  return { balanced:'متوازن', lowcarb:'لو كارب', mediterranean:'حمية البحر المتوسط', carbcycle:'كارب سايكل', keto:'كيتو', carnivore:'كارنفور' }[k] || k;
}

LOG('✔ Phase 4 Complete — Food filter engine ready');

// ═══════════════════════════════════════════════════════════════
//  PHASE 3 — SMART SEARCH SYSTEM
// ═══════════════════════════════════════════════════════════════
LOG('Phase 3 — Smart Search System...');

function normalizeSearch(str) {
  return String(str || '').toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')        // إزالة التشكيل والتطويل
    .replace(/[أإآ]/g, 'ا').replace(/[ةه]/g, 'ه')
    .replace(/[يى]/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '')
    .replace(/\s+/g, ' ').trim();
}

// مطابقة كلمة بحث بتسامح في ألف البداية ("ارز" تجد "رز" والعكس)
function _wordMatches(word, haystack) {
  if (!word) return true;
  if (haystack.indexOf(word) !== -1) return true;
  // إذا بدأ المستخدم الكلمة بألف، جرب بدونها (أرز/ارز - رز)
  if (word.length > 2 && word.charAt(0) === 'ا' && haystack.indexOf(word.slice(1)) !== -1) return true;
  return false;
}

function searchFoods(query, cat) {
  const q = normalizeSearch(query);
  let pool = FOOD_DB.filter(food => {
    if (cat && cat !== 'all' && food.cat !== cat) return false;
    if (!q) return true;
    const haystack = normalizeSearch(
      food.nameAr + ' ' + food.nameEn + ' ' + (food.tags || []).join(' ')
    );
    return q.split(' ').every(word => _wordMatches(word, haystack));
  });

  // ── Sort: added - natural/unprocessed first - Egyptian priority - allowed - alpha ──
  const addedIds = new Set(DE.availableFoods || []);
  const _naturalScore = p => ({minimal:4, none:4, low:3, medium:1, high:-2, very_high:-4}[p] ?? 0);
  pool.sort((a, b) => {
    // الأولوية الأولى: _NC_SORT_MAP (أرز - خبز - بطاطا - ...)
    const aSortScore = (typeof _NC_SORT_MAP !== 'undefined' ? (_NC_SORT_MAP.get(a.id)||0) : 0) * 1000;
    const bSortScore = (typeof _NC_SORT_MAP !== 'undefined' ? (_NC_SORT_MAP.get(b.id)||0) : 0) * 1000;
    if (aSortScore !== bSortScore) return bSortScore - aSortScore;
    // الأولوية الثانية: addedIds + natural + egy
    const aAdded = addedIds.has(a.id) ? 4 : 0;
    const bAdded = addedIds.has(b.id) ? 4 : 0;
    const aNat   = _naturalScore(a.processedLevel);
    const bNat   = _naturalScore(b.processedLevel);
    const aEgy   = (EGY_MARKET_PRIORITY[a.id] || 0) * 0.4;
    const bEgy   = (EGY_MARKET_PRIORITY[b.id] || 0) * 0.4;
    const diff   = (bAdded + bNat + bEgy) - (aAdded + aNat + aEgy);
    return diff !== 0 ? diff : (a.nameAr||'').localeCompare(b.nameAr||'', 'ar');
  });

  return pool.slice(0, 40);
}

function onFoodSearch(query) {
  const cat = DE.foodSearchCat || 'all';
  const results = searchFoods(query, cat);
  renderSearchResults(results, query);
}

function filterFoodCat(btn, cat) {
  DE.foodSearchCat = cat;
  document.querySelectorAll('#food-cat-pills .chip').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const query = document.getElementById('food-search-input')?.value || '';
  onFoodSearch(query);
  // scroll reset AFTER render via rAF
  requestAnimationFrame(() => {
    const el = document.getElementById('food-search-results');
    if (el) el.scrollTop = 0;
  });
}

function renderSearchResults(foods, query) {
  const container = document.getElementById('food-search-results');
  if (!container) return;

  if (!foods.length) {
    container.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-dim);font-size:12px;">
      لم يتم العثور على نتائج${query ? ' ل "'+query+'"' : ''}</div>`;
    return;
  }

  container.innerHTML = foods.map(food => {
    const filter   = isFoodAllowed(food);
    const isAdded  = DE.availableFoods.includes(food.id);
    const blocked  = !filter.ok;
    const opacity  = blocked ? '0.4' : '1';
    const catEmoji = { protein:'', carb:'', fat:'', veggie:'', fruit:'', dairy:'', snack:'' }[food.cat] || '';

    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;
        margin-bottom:4px;background:var(--surface2);border:1px solid var(--border);opacity:${opacity};
        ${blocked ? 'cursor:not-allowed;' : ''}">
      <span style="font-size:18px;">${catEmoji}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12.5px;font-weight:700;color:${blocked?'var(--text-muted)':'var(--text)'};">${food.nameAr}</div>
        <div style="font-size:10.5px;color:var(--text-dim);margin-top:1px;">
         ${food.cal} ·${food.pro}ج ·${food.carb}ج ·${food.fat}ج
          ${(!food.unit || food.unit.startsWith('100')) ? '<span style="color:var(--text-dim);font-size:10px;"> / 100جم</span>' : ''}
          ${food.unit ? `<span style="color:var(--orange);font-size:10px;margin-right:4px;">${food.unit}</span>` : ''}
          ${blocked ? `<span style="color:var(--red);margin-right:6px;">${filter.reason}</span>` : ''}
          ${typeof GI_DB !== 'undefined' && GI_DB[food.id] > 0 ? `<span style="color:${GI_DB[food.id]<55?'var(--green)':GI_DB[food.id]<70?'var(--orange)':'var(--red)'};font-size:10px;margin-right:4px;">${GI_DB[food.id]<55?'':GI_DB[food.id]<70?'':''} GI:${GI_DB[food.id]}</span>` : ''}
        </div>
      </div>
      ${blocked
        ? `<span style="font-size:10px;color:var(--red);">ممنوع</span>`
        : `<button onclick="toggleFood('${food.id}')"
            style="padding:5px 12px;border-radius:8px;border:1.5px solid ${isAdded?'var(--red)':'var(--green)'};
            background:${isAdded?'rgba(232,76,76,0.1)':'rgba(42,232,123,0.1)'};
            color:${isAdded?'var(--red)':'var(--green)'};font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;">
            ${isAdded ? '✕ إزالة' : '+ إضافة'}
          </button>`
      }
    </div>`;
  }).join('');
  requestAnimationFrame(() => { container.scrollTop = 0; });
}

function toggleFood(id) {
  const idx = DE.availableFoods.indexOf(id);
  if (idx >= 0) {
    DE.availableFoods.splice(idx, 1);
  } else {
    // Check if allowed — FIX-2: O(1) lookup
    const food = FOOD_MAP.get(id);
    if (!food) return;
    const filter = isFoodAllowed(food);
    if (!filter.ok) { alert('هذا الطعام ممنوع: ' + filter.reason); return; }
    DE.availableFoods.push(id);
  }
  updateSelectedFoodsTags();
  // Re-render results to update button state
  const query = document.getElementById('food-search-input')?.value || '';
  onFoodSearch(query);
  LOG(`✔ Available foods: ${DE.availableFoods.length} selected`);
}

function updateSelectedFoodsTags() {
  const container = document.getElementById('selected-foods-tags');
  const countEl   = document.getElementById('selected-foods-count');
  const warning   = document.getElementById('food-warning');
  if (!container) return;

  countEl.textContent = `(${DE.availableFoods.length})`;

  if (!DE.availableFoods.length) {
    container.innerHTML = `<span style="color:var(--text-dim);font-size:12px;padding:6px 0;">
      لم تختر أطعمة بعد — ابحث وأضف من القائمة أعلاه</span>`;
    if (warning) warning.style.display = 'none';
    return;
  }

  container.innerHTML = DE.availableFoods.map(id => {
    const food = FOOD_MAP.get(id); // FIX-2: O(1)
    if (!food) return '';
    const catEmoji = { protein:'', carb:'', fat:'', veggie:'', fruit:'', dairy:'', snack:'' }[food.cat] || '';
    return `<span onclick="toggleFood('${id}')"
      style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:20px;
      background:rgba(42,232,123,0.1);border:1px solid rgba(42,232,123,0.3);
      color:var(--green);font-size:11.5px;font-weight:700;cursor:pointer;user-select:none;"
      title="اضغط للإزالة">
      ${catEmoji} ${food.nameAr} <span style="opacity:0.6;">✕</span>
    </span>`;
  }).join('');

  // Warning if < 5 foods
  if (warning) {
    const enoughVariety = checkFoodVariety();
    warning.style.display = enoughVariety.ok ? 'none' : 'flex';
    document.getElementById('food-warning-text').textContent = enoughVariety.msg;
  }
}

function checkFoodVariety() {
  const selected = DE.availableFoods.map(id => FOOD_MAP.get(id)).filter(Boolean); // FIX-2: O(1)
  const hasProtein = selected.some(f => f.cat === 'protein');
  const hasCarb    = selected.some(f => ['carb','fruit'].includes(f.cat));
  const hasVeggie  = selected.some(f => f.cat === 'veggie');

  if (selected.length < 3) return { ok:false, msg:'ينصح باختيار 3 أطعمة على الأقل لبناء خطة متنوعة' };
  if (!hasProtein) return { ok:false, msg:'لم تختر أي مصدر بروتين — البروتين أساسي لأي دايت' };
  const diet = DE.selectedDiet || 'balanced';
  if (!['keto','carnivore','lowcarb'].includes(diet) && !hasCarb)
    return { ok:false, msg:'لم تختر أي مصدر كارب — ضروري لنظامك الغذائي المختار' };
  return { ok:true, msg:'' };
}

function selectAllVisible() {
  const query = document.getElementById('food-search-input')?.value || '';
  const cat   = DE.foodSearchCat || 'all';
  const foods = searchFoods(query, cat);
  foods.forEach(food => {
    const filter = isFoodAllowed(food);
    if (filter.ok && !DE.availableFoods.includes(food.id)) {
      DE.availableFoods.push(food.id);
    }
  });
  updateSelectedFoodsTags();
  onFoodSearch(query);
  LOG(`✔ Select all visible: ${DE.availableFoods.length} total`);
}

function clearAllFoods() {
  DE.availableFoods = [];
  updateSelectedFoodsTags();
  const query = document.getElementById('food-search-input')?.value || '';
  onFoodSearch(query);
  LOG('✔ All foods cleared');
}

// Initialize step-6 (food selection) on entry — diet is already chosen
function initStep6() {
  // Update diet context banner
  const diet = DE.selectedDiet || 'balanced';
  const dietLabels = { balanced:'متوازن', lowcarb:'لو كارب', carbcycle:'كارب سايكل', keto:'كيتو', carnivore:'كارنفور' };
  const banner = document.getElementById('food-diet-banner-text');
  if (banner) {
    const hcText = DE.healthConditions.length ? ` + حالتك الصحية (${DE.healthConditions.length} حالة)` : '';
    banner.innerHTML = `الفلترة تعتمد على: <strong style="color:var(--accent);">${dietLabels[diet]||diet}</strong>${hcText} — الأطعمة الممنوعة ستظهر باهتة`;
  }
  // Re-filter foods based on current diet/health selections
  // Remove any now-blocked foods
  DE.availableFoods = DE.availableFoods.filter(id => {
    const food = FOOD_MAP.get(id); // FIX-2: O(1)
    return food && isFoodAllowed(food).ok;
  });
  updateSelectedFoodsTags();
  onFoodSearch(''); // show all foods filtered by chosen diet
  LOG(`✔ Step-6 (food) initialized with diet=${diet}, health=[${DE.healthConditions}]`);
}

LOG('✔ Phase 2 Complete — Available Foods UI ready');

// ═══════════════════════════════════════════════════════════════
//  TAB SWITCHER — STEP 6
// ═══════════════════════════════════════════════════════════════
function switchTab6(tab) {
  const isAvailable = tab === 'available';
  document.getElementById('tab-available').style.display  = isAvailable ? 'block' : 'none';
  document.getElementById('tab-planner').style.display    = isAvailable ? 'none'  : 'block';
  const btnA = document.getElementById('tab-btn-available');
  const btnP = document.getElementById('tab-btn-planner');
  if (btnA) { btnA.style.background = isAvailable ? 'var(--accent)' : 'var(--surface2)'; btnA.style.color = isAvailable ? '#000' : 'var(--text-muted)'; }
  if (btnP) { btnP.style.background = isAvailable ? 'var(--surface2)' : 'var(--accent)'; btnP.style.color = isAvailable ? 'var(--text-muted)' : '#000'; }
  if (!isAvailable) {
    // Update BYD context banner with info from step 4
    const bannerText = document.getElementById('byd-banner-text');
    if (bannerText) {
      const mealCountInfo = DE.workoutType === 'gym' && DE.gymSplit === 'default'
        ? 'فطار + قبل تمرين + بعد تمرين + عشاء'
        : `${DE.mealCount} وجبات${DE.snacks ? ' + سناكس' : ''}`;
      const foodCount = DE.availableFoods.length;
      bannerText.innerHTML = `
        <span style="color:var(--green);font-weight:700;">✔ عدد الوجبات من الخطوة 4:</span> ${mealCountInfo}<br>
        <span style="color:var(--green);font-weight:700;">✔ أطعمتك المتاحة:</span> ${foodCount} طعام مختار —
        <span style="color:var(--text-dim);">النظام يحسب السعرات والماكروز تلقائيا</span>
      `;
    }
    // Reset extra foods picker state when entering BYD
    // (keep DP_EXTRA_FOODS in case user came back — don't clear)
    renderDayPlan();
    // Initialize food search with selected foods
    onMealPlannerSearch('');
  }
}
