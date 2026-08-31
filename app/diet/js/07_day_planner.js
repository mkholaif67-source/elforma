// ═══════════════════════════════════════════════════════════════
//  DAY PLANNER ENGINE
// ═══════════════════════════════════════════════════════════════
// State
const DP = {
  meals: [],           // [{id, type, name, items:[{food,grams,cals,pro,carb,fat}]}]
  activeMealType: 'breakfast',
  pendingItems: [],    // items being added to current meal
  mealCounter: 0,
  foodCat: 'all'       // category filter for meal planner picker
};

const MEAL_LABELS = { breakfast:'فطار', lunch:'غداء', dinner:'عشاء', snack:'سناك', pre:'قبل تمرين', post:'بعد تمرين' };
const MEAL_COLORS = { breakfast:'var(--orange)', lunch:'var(--accent)', dinner:'var(--purple)', snack:'var(--green)', pre:'var(--blue)', post:'var(--green)' };

// ── v22: Two-step meal type card selector
function selMealTypeCard(btn, type) {
  // Highlight selected card
  document.querySelectorAll('#mp-meal-type-btns .mp-type-card').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('mp-meal-type').value = type;
  DP.activeMealType = type;

  // Update badge in step 2
  const badge = document.getElementById('amp-type-badge');
  if (badge) badge.textContent = MEAL_LABELS[type] || type;

  // Transition to step 2 after brief delay for visual feedback
  setTimeout(() => {
    document.getElementById('amp-step1').style.display = 'none';
    document.getElementById('amp-step2').style.display = 'block';
    // Reset search/filter
    DP.foodCat = 'all';
    const searchEl = document.getElementById('mp-food-search');
    if (searchEl) searchEl.value = '';
    document.querySelectorAll('#mp-cat-pills .chip').forEach((b,i) => {
      if (i === 0) b.classList.add('selected');
      else b.classList.remove('selected');
    });
    onMealPlannerSearch('');
    document.getElementById('amp-step2').scrollIntoView({ behavior:'smooth', block:'nearest' });
  }, 150);
}

// ── Back to step 1
function backToMealTypeStep() {
  document.getElementById('amp-step1').style.display = 'block';
  document.getElementById('amp-step2').style.display = 'none';
  // Deselect all type cards
  document.querySelectorAll('#mp-meal-type-btns .mp-type-card').forEach(b => b.classList.remove('selected'));
  document.getElementById('mp-meal-type').value = '';
  DP.activeMealType = 'breakfast'; // reset default
  DP.pendingItems = [];
  renderPendingItems();
}

// ── Legacy alias kept for any code still calling selMealType
function selMealType(btn, type) { selMealTypeCard(btn, type); }

// ── Open / Close Add Meal Panel
function openAddMealPanel() {
  DP.pendingItems = [];
  DP.foodCat = 'all';
  // Show step 1, hide step 2
  const s1 = document.getElementById('amp-step1');
  const s2 = document.getElementById('amp-step2');
  if (s1) s1.style.display = 'block';
  if (s2) s2.style.display = 'none';
  // Deselect type cards
  document.querySelectorAll('#mp-meal-type-btns .mp-type-card').forEach(b => b.classList.remove('selected'));
  document.getElementById('mp-meal-type').value = '';
  DP.activeMealType = 'breakfast';
  renderPendingItems();
  document.getElementById('add-meal-panel').style.display = 'block';
  document.getElementById('add-meal-panel').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function closeAddMealPanel() {
  DP.pendingItems = [];
  document.getElementById('add-meal-panel').style.display = 'none';
}

// ── Search Foods for Meal Planner
// ── BYD EXTRA FOOD PICKER STATE
// Tracks extra foods added via "إضافة طعام آخر" picker (not in availableFoods)
const DP_EXTRA_FOODS = new Set();

// ── Category filter for meal planner (isolated — only touches DP state)
function mpFilterCat(btn, cat) {
  DP.foodCat = cat;
  document.querySelectorAll('#mp-cat-pills .chip').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const q = document.getElementById('mp-food-search')?.value || '';
  onMealPlannerSearch(q);
  requestAnimationFrame(() => {
    const el = document.getElementById('mp-food-results');
    if (el) el.scrollTop = 0;
  });
}

// ── Egyptian market food priority — most available and commonly used ─
// Higher number = appears higher in each category list
const EGY_MARKET_PRIORITY = {
  // Protein — most available in Egyptian markets
  chicken_breast:   10, chicken_thigh:     9, eggs_whole:        10,
  egg_whites:        8, tuna_canned:       10, beef_lean:          9,
  beef_ground:       9, foul:              10, lentils:           10,
  tilapia:           9, sardines:           8, liver_chicken:      8,
  turkey_breast:     7, cottage_cheese:     7, labneh_spreadable: 10,
  greek_yogurt:      9, yogurt_plain:       9, milk_skim:          9,
  // Carbs — Egyptian staple carbs first (whole, natural, common)
  baladi_bread:     10, white_rice:        10, brown_rice:         9,
  oats:             10, sweet_potato:       9, lentil_soup:       10,
  chickpeas:         9, whole_bread:        9, potato_boiled:      9,
  pasta_ww:          8, corn_on_cob:        8, quinoa:             7,
  // Carbs — processed/less diet-suitable - LOW priority (appear after staples)
  pasta_bechamel:    1, white_bread_toast:  2, croissant:          1,
  pasta_white:       3, white_pasta:        3, biscuits:           1,
  rice_pudding:      2, cornflakes:         2, granola_bar:        3,
  // Fats — commonly available
  olive_oil:        10, sunflower_oil:      9, tahini_salad:      10,
  almonds:           9, walnuts:            8, peanut_butter:      9,
  avocado:           7, sesame_tahini:      9,
  // Veggies — found in any Egyptian market
  tomato:           10, cucumber:          10, spinach:            9,
  broccoli:          7, bell_pepper_red:    8, zucchini_veg:       9,
  eggplant_grilled:  9, cauliflower:        8, mushroom:           7,
  lettuce:           9, arugula_rocket:     7,
  // Fruits
  banana:           10, orange:             9, mango_fresh:        8,
  strawberry:        7, watermelon:         9, apple:              9,
  // Dairy
  labneh_spreadable:10, greek_yogurt:       9, yogurt_plain:       9,
  milk_skim:         9, feta_cheese:        9, cottage_cheese:     7,
};

function onMealPlannerSearch(q) {
  const mType  = DP.activeMealType;
  const cat    = DP.foodCat || 'all';
  const q2     = (q || '').trim().toLowerCase();

  // v22: عرض كل الأطعمة المسموح بيها من قاعدة البيانات الكاملة
  // الأطعمة اللي اختارها المستخدم في الخطوة 6 تظهر أول (مميزة)
  const selectedIds = new Set(DE.availableFoods || []);

  let pool = FOOD_DB.filter(f => isFoodAllowed(f).ok);

  // Filter by category pill
  if (cat && cat !== 'all') {
    pool = pool.filter(f => f.cat === cat);
  }

  // Filter by search query
  if (q2) {
    pool = pool.filter(f =>
      normalizeSearch(f.nameAr||'').includes(normalizeSearch(q2)) ||
      f.nameEn?.toLowerCase().includes(q2) ||
      (f.tags || []).some(t => t.toLowerCase().includes(q2))
    );
  }

  // Sort priority:
  //  1. Already added to this meal (✓ في الوجبة)
  //  2. User-selected in step 6 (مفضل)
  //  3. Natural/unprocessed foods first (minimal/none before very_high)
  //  4. Suitable for this meal type
  //  5. Egyptian market priority (common & available)
  //  6. Alphabetical
  const _natScoreMeal = p => ({minimal:3, none:3, low:2, medium:0, high:-2, very_high:-3}[p] ?? 0);
  pool.sort((a, b) => {
    const aAdded    = DP.pendingItems.some(i => i.food.id === a.id) ? 8 : 0;
    const bAdded    = DP.pendingItems.some(i => i.food.id === b.id) ? 8 : 0;
    const aSelected = selectedIds.has(a.id) ? 4 : 0;
    const bSelected = selectedIds.has(b.id) ? 4 : 0;
    const aNat      = _natScoreMeal(a.processedLevel);
    const bNat      = _natScoreMeal(b.processedLevel);
    const aOk       = a.mealTypes?.includes(mType) ? 2 : 0;
    const bOk       = b.mealTypes?.includes(mType) ? 2 : 0;
    const aEgy      = (EGY_MARKET_PRIORITY[a.id] || 0) * 0.3;
    const bEgy      = (EGY_MARKET_PRIORITY[b.id] || 0) * 0.3;
    // _NC_SORT_MAP حتمي — أرز أولا دايما
    const aSrt = (typeof _NC_SORT_MAP !== 'undefined' ? (_NC_SORT_MAP.get(a.id)||0) : 0) * 100;
    const bSrt = (typeof _NC_SORT_MAP !== 'undefined' ? (_NC_SORT_MAP.get(b.id)||0) : 0) * 100;
    const aScore    = aSrt + aAdded + aSelected + aNat + aOk + aEgy;
    const bScore    = bSrt + bAdded + bSelected + bNat + bOk + bEgy;
    if (bScore !== aScore) return bScore - aScore;
    return (a.nameAr || '').localeCompare(b.nameAr || '', 'ar');
  });

  const catEmoji = { protein:'', carb:'', fat:'', veggie:'', fruit:'', dairy:'', snack:'' };
  const showPool = pool.slice(0, 60);

  const foodRows = showPool.map(f => {
    const alreadyAdded = DP.pendingItems.some(i => i.food.id === f.id);
    const forMeal      = f.mealTypes?.includes(mType);
    const isSelected   = selectedIds.has(f.id);  // في قائمة الخطوة 6
    return `<div style="display:flex;align-items:center;gap:8px;padding:9px 10px;
                border-bottom:1px solid var(--border);
                background:${alreadyAdded ? 'rgba(42,232,123,0.06)' : isSelected ? 'rgba(245,166,35,0.03)' : 'transparent'};">
      <div style="flex:1;min-width:0;">
        <div style="font-size:12.5px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
          ${catEmoji[f.cat]||''} ${f.nameAr}
          ${isSelected ? `<span style="font-size:10px;color:var(--accent);background:rgba(245,166,35,0.12);padding:1px 5px;border-radius:5px;">مفضل</span>` : ''}
          ${!forMeal ? `<span style="font-size:10px;color:var(--text-dim);background:var(--surface3);padding:1px 5px;border-radius:5px;">لوجبة أخرى</span>` : ''}
          ${alreadyAdded ? `<span style="font-size:10px;color:var(--green);background:rgba(42,232,123,0.1);padding:1px 5px;border-radius:5px;">✓ في الوجبة</span>` : ''}
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
         ${f.cal} ·${f.pro}ج ·${f.carb}ج ·${f.fat}ج
          ${(!f.unit || f.unit.startsWith('100')) ? '<span style="color:var(--text-dim);font-size:10px;"> / 100جم</span>' : ''}
          ${f.unit ? `<span style="color:var(--orange);font-size:10px;margin-right:4px;">${f.unit}</span>` : ''}
        </div>
      </div>
      ${alreadyAdded
        ? `<button onclick="removePendingItem('${f.id}')"
             style="padding:5px 10px;border-radius:8px;border:1px solid rgba(232,76,76,0.4);
                    background:rgba(232,76,76,0.08);color:var(--red);font-size:11px;
                    font-weight:700;cursor:pointer;flex-shrink:0;">✕ إزالة</button>`
        : `<button onclick="openGramsInput('${f.id}')"
             style="padding:5px 12px;border-radius:8px;border:none;background:var(--green);
                    color:#000;font-size:11px;font-weight:800;cursor:pointer;flex-shrink:0;">+ إضافة</button>`
      }
    </div>`;
  }).join('');

  const emptyMsg = showPool.length === 0
    ? `<div style="padding:20px;text-align:center;color:var(--text-dim);font-size:12px;">
        ${q2 ? 'لا نتائج — جرب كلمة أخرى أو فئة مختلفة'
             : 'لا يوجد طعام متاح في هذه الفئة'}
       </div>`
    : '';

  const el = document.getElementById('mp-food-results');
  if (el) {
    el.innerHTML = foodRows + emptyMsg;
    el.scrollTop = 0;  // always reset scroll when list refreshes
  }
}

// ── EXTRA FOOD PICKER — يفتح من FOOD_DB الكاملة ويضيف للقائمة
function openExtraFoodPicker() {
  const overlay = document.getElementById('extra-food-picker-overlay');
  if (overlay) { overlay.style.display = 'flex'; extraPickerSearch(''); return; }

  // Create overlay once
  const div = document.createElement('div');
  div.id = 'extra-food-picker-overlay';
  div.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;
    background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:16px;`;
  div.innerHTML = `
    <div style="background:var(--surface);border-radius:18px;border:1.5px solid rgba(42,140,232,0.4);
                width:100%;max-width:520px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:16px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:14px;font-weight:900;color:var(--text);">إضافة طعام آخر</div>
        <button onclick="closeExtraFoodPicker()" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer;">✕</button>
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);">
        <input id="extra-picker-search" class="field-input" type="text"
          placeholder="ابحث بالعربي أو الإنجليزي..."
          oninput="extraPickerSearch(this.value)" autocomplete="off" style="direction:rtl;">
      </div>
      <div id="extra-picker-results" style="overflow-y:auto;flex:1;padding:8px 0;"></div>
    </div>`;
  document.body.appendChild(div);
  extraPickerSearch('');
}

function closeExtraFoodPicker() {
  const overlay = document.getElementById('extra-food-picker-overlay');
  if (overlay) overlay.style.display = 'none';
}

function extraPickerSearch(q) {
  if (!DE || !Array.isArray(DE.availableFoods)) return;
  const q2 = (q || '').trim();
  // Search full DB — only allowed foods
  let results = FOOD_DB.filter(f => {
    if (!isFoodAllowed(f).ok) return false;
    if (DE.availableFoods.includes(f.id)) return false; // already in list
    if (!q2) return true;
    const hay = normalizeSearch(f.nameAr + ' ' + f.nameEn + ' ' + (f.tags||[]).join(' '));
    return normalizeSearch(q2).split(' ').every(w => hay.includes(w));
  }).slice(0, 40);

  const catEmoji = { protein:'', carb:'', fat:'', veggie:'', fruit:'', dairy:'', snack:'' };
  const container = document.getElementById('extra-picker-results');
  if (!container) return;

  if (!results.length && !q2) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-dim);font-size:12px;">اكتب اسم الطعام للبحث</div>`;
    return;
  }
  if (!results.length) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-dim);font-size:12px;">لا نتائج</div>`;
    return;
  }

  container.innerHTML = results.map(f => {
    const alreadyExtra = DP_EXTRA_FOODS.has(f.id);
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:var(--text);">${catEmoji[f.cat]||''} ${f.nameAr}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${f.cal} ·${f.pro}ج ·${f.carb}ج ·${f.fat}ج${(!f.unit || f.unit.startsWith('100')) ? ' / 100جم' : ''}</div>
      </div>
      <button onclick="addExtraFood('${f.id}')"
        style="padding:7px 14px;border-radius:9px;border:none;
               background:${alreadyExtra ? 'var(--surface3)' : 'var(--green)'};
               color:${alreadyExtra ? 'var(--text-muted)' : '#000'};
               font-size:12px;font-weight:800;cursor:pointer;flex-shrink:0;white-space:nowrap;">
        ${alreadyExtra ? '✓ مضاف' : '+ إضافة'}
      </button>
    </div>`;
  }).join('');
}

function addExtraFood(id) {
  DP_EXTRA_FOODS.add(id);
  // Refresh picker list
  const q = document.getElementById('extra-picker-search')?.value || '';
  extraPickerSearch(q);
  // Refresh meal planner search
  const mpQ = document.getElementById('mp-food-search')?.value || '';
  onMealPlannerSearch(mpQ);
}

// ── Grams Input Modal (inline)
function openGramsInput(foodId) {
  const food = FOOD_MAP.get(foodId) || FOOD_DB.find(f => f.id === foodId); // FIX-2: O(1) with fallback
  if (!food) return;

  // v17: Smart Serving Engine
  const goal = DE.goal;
  const diet = DE.selectedDiet;
  const defaultG   = food.cat === 'fat' ? 10 : 100;
  const bounds     = SSE.getBounds(food);
  const presets    = food.cat === 'fat' ? [5, 10, 15, 20] : [50, 100, 150, 200];
  const unitLabel  = SSE.getUnit(food);
  const warnText   = SSE.getPrimaryWarn(food);
  const typeLabel  = SSE.getLabel(food);
  const isSauce    = SSE.isSauce(food);
  const isTreat    = SSE.isTreat(food);

  const warnHtml = warnText
    ? `<div style="font-size:10.5px;color:var(--orange);margin-bottom:6px;padding:5px 8px;background:rgba(245,166,35,0.08);border-radius:6px;">${warnText}</div>`
    : '';
  const typeBadge = typeLabel
    ? `<span style="font-size:10px;color:var(--text-dim);margin-right:6px;">${typeLabel}</span>`
    : '';

  // Sauce/treat visual indicator
  const roleBorder = isSauce ? 'border-color:rgba(232,76,76,0.3)' :
                     isTreat ? 'border-color:rgba(155,89,182,0.3)' :
                     'border-color:rgba(42,232,123,0.25)';
  const roleColor  = isSauce ? 'var(--red)' : isTreat ? 'var(--purple)' : 'var(--green)';

  const resultsEl = document.getElementById('mp-food-results');
  const existingInput = document.getElementById(`grams-input-${foodId}`);
  if (existingInput) { existingInput.remove(); return; }

  const inputRow = document.createElement('div');
  inputRow.id = `grams-input-${foodId}`;
  inputRow.style.cssText = `padding:10px 12px;background:rgba(42,232,123,0.04);border:1px solid;${roleBorder};border-radius:10px;margin:4px 8px;`;
  inputRow.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <div style="font-size:12px;font-weight:800;color:${roleColor};">كمية ${food.nameAr}</div>
      ${typeBadge}
    </div>
    ${warnHtml}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
      ${presets.map(g => `<button onclick="quickGram('${foodId}',${g})"
        style="padding:5px 12px;border-radius:8px;border:1px solid rgba(42,232,123,0.3);background:var(--surface2);
               color:var(--text-muted);font-size:12px;font-weight:700;cursor:pointer;">${g}${unitLabel}</button>`).join('')}
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <input type="number" id="grams-val-${foodId}" value="${defaultG}"
        min="${bounds.min}" max="${bounds.hardMax}"
        style="flex:1;background:var(--surface2);border:1.5px solid rgba(42,232,123,0.3);border-radius:8px;
               padding:7px 10px;color:var(--text);font-size:13px;font-weight:700;direction:ltr;text-align:center;outline:none;"
        oninput="previewGrams('${foodId}')">
      <span style="font-size:12px;color:var(--text-muted);">${unitLabel}</span>
      <div id="grams-preview-${foodId}" style="font-size:11px;color:var(--accent);font-weight:700;min-width:80px;text-align:center;"></div>
      <button onclick="confirmGrams('${foodId}')"
        style="padding:7px 14px;border-radius:8px;border:none;background:${roleColor};color:#000;font-size:12px;font-weight:800;cursor:pointer;">
        ✓ أضف
      </button>
      <button onclick="document.getElementById('grams-input-${foodId}').remove()"
        style="padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-muted);font-size:12px;cursor:pointer;">
        ✕
      </button>
    </div>
  `;
  resultsEl.insertAdjacentElement('afterbegin', inputRow);
  previewGrams(foodId);
}

function quickGram(foodId, g) {
  const inp = document.getElementById(`grams-val-${foodId}`);
  if (inp) { inp.value = g; previewGrams(foodId); }
}

function previewGrams(foodId) {
  const food = FOOD_MAP.get(foodId) || FOOD_DB.find(f => f.id === foodId); // FIX-2: O(1)
  const g = parseFloat(document.getElementById(`grams-val-${foodId}`)?.value) || 0;
  if (!food || g <= 0) return;
  const cals = Math.round(food.cal * g / 100);
  const pro  = +(food.pro * g / 100).toFixed(1);
  const el   = document.getElementById(`grams-preview-${foodId}`);

  // v17: SSE validation warning
  const validation = SSE.validateGrams(food, g);
  const previewEl  = document.getElementById(`grams-preview-${foodId}`);
  if (previewEl) {
    previewEl.innerHTML = validation.blocked
      ? `<span style="color:var(--red);font-size:10px;">ممنوع</span>`
      : `${cals} ·${pro}ج`;
  }

  // Show inline warning if needed
  let warnEl = document.getElementById(`grams-warn-${foodId}`);
  if (!warnEl) {
    warnEl = document.createElement('div');
    warnEl.id = `grams-warn-${foodId}`;
    warnEl.style.cssText = 'font-size:10px;color:var(--orange);margin-top:5px;padding:4px 8px;border-radius:5px;background:rgba(245,166,35,0.08);';
    document.getElementById(`grams-input-${foodId}`)?.appendChild(warnEl);
  }
  if (validation.warnings.length) {
    warnEl.style.display = 'block';
    warnEl.textContent = validation.warnings[0];
    warnEl.style.color = validation.blocked ? 'var(--red)' : 'var(--orange)';
    warnEl.style.background = validation.blocked ? 'rgba(232,76,76,0.08)' : 'rgba(245,166,35,0.08)';
  } else {
    warnEl.style.display = 'none';
  }
}

function confirmGrams(foodId) {
  const food = FOOD_MAP.get(foodId) || FOOD_DB.find(f => f.id === foodId); // FIX-2: O(1)
  const g = parseFloat(document.getElementById(`grams-val-${foodId}`)?.value) || 0;
  if (!food || g <= 0) return;

  // v17: Block catastrophic amounts before adding
  const validation = SSE.validateGrams(food, g);
  if (validation.blocked) {
    const bounds = SSE.getBounds(food);
    const unit   = SSE.getUnit(food);
    alert(`كمية غير مقبولة!\n\n${food.nameAr}: الحد الأقصى ${bounds.hardMax}${unit}\n\n${validation.warnings[0]}`);
    return;
  }

  // Remove any existing entry for same food
  DP.pendingItems = DP.pendingItems.filter(i => i.food.id !== foodId);
  DP.pendingItems.push({
    food,
    grams:    Math.round(g),
    cals:     Math.round(food.cal * g / 100),
    pro:      +(food.pro  * g / 100).toFixed(1),
    carb:     +(food.carb * g / 100).toFixed(1),
    fat:      +(food.fat  * g / 100).toFixed(1),
    hasWarn:  validation.warnings.length > 0,
    warnMsg:  validation.warnings[0] || ''
  });
  document.getElementById(`grams-input-${foodId}`)?.remove();
  renderPendingItems();
  onMealPlannerSearch(document.getElementById('mp-food-search')?.value || '');
}

function removePendingItem(foodId) {
  DP.pendingItems = DP.pendingItems.filter(i => i.food.id !== foodId);
  renderPendingItems();
  onMealPlannerSearch(document.getElementById('mp-food-search')?.value || '');
}

function renderPendingItems() {
  const wrap = document.getElementById('mp-items-wrap');
  const list = document.getElementById('mp-items-list');
  if (!wrap || !list) return;

  if (DP.pendingItems.length === 0) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  const totalCals = DP.pendingItems.reduce((s,i) => s + i.cals, 0);
  const totalPro  = +DP.pendingItems.reduce((s,i) => s + i.pro,  0).toFixed(1);
  const totalCarb = +DP.pendingItems.reduce((s,i) => s + i.carb, 0).toFixed(1);
  const totalFat  = +DP.pendingItems.reduce((s,i) => s + i.fat,  0).toFixed(1);

  // v17: SSE sauce / treat count warnings
  const sauceCount = DP.pendingItems.filter(i => SSE.isSauce(i.food)).length;
  const treatCount = DP.pendingItems.filter(i => SSE.isTreat(i.food)).length;

  list.innerHTML = DP.pendingItems.map(i => {
    const typeLabel = SSE.getLabel(i.food);
    const isSauce   = SSE.isSauce(i.food);
    const isTreat   = SSE.isTreat(i.food);
    const unit      = SSE.getUnit(i.food);
    const borderCol = isSauce ? 'rgba(232,76,76,0.2)' : isTreat ? 'rgba(155,89,182,0.2)' : 'var(--border)';
    const warnRow   = i.hasWarn
      ? `<div style="font-size:9.5px;color:var(--orange);margin-top:2px;">${i.warnMsg}</div>` : '';
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;
                border-bottom:1px solid ${borderCol};">
      <div style="flex:1;">
        <div style="font-size:12px;color:var(--text);">
          ${typeLabel ? `<span style="font-size:10px;color:var(--text-dim);margin-left:4px;">${typeLabel}</span>` : ''}
          ${i.food.nameAr}
        </div>
        ${warnRow}
      </div>
      <div style="font-size:11px;color:var(--text-muted);">${i.grams}${unit}</div>
      <div style="font-size:11px;color:var(--accent);font-weight:700;">${i.cals}kcal</div>
      <div style="font-size:11px;color:var(--green);">${i.pro}ج</div>
      <button onclick="removePendingItem('${i.food.id}')"
        style="background:none;border:none;color:var(--text-dim);font-size:14px;cursor:pointer;padding:0 4px;">✕</button>
    </div>`;
  }).join('');

  // SSE composition warnings at bottom of pending list
  const compWarnings = [];
  if (sauceCount >= 2) compWarnings.push(`${sauceCount} صلصات في وجبة واحدة — كثير`);
  if (treatCount >= 1) compWarnings.push(`الحلويات وجبة ترفيهية — لا تجعلها أساس الوجبة`);
  const onlyTreats = DP.pendingItems.every(i => SSE.isTreat(i.food) || SSE.isSauce(i.food));
  if (onlyTreats && DP.pendingItems.length > 0)
    compWarnings.push(`الوجبة كلها حلويات/صلصات — أضف بروتين أو كارب رئيسي`);

  if (compWarnings.length) {
    list.innerHTML += `<div style="margin-top:8px;padding:8px 10px;border-radius:8px;
      background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.25);font-size:11px;
      color:var(--orange);">${compWarnings.map(w=>`<div>${w}</div>`).join('')}</div>`;
  }

  // Update subtotal
  const sc = document.getElementById('mp-sub-cals'); if(sc) sc.textContent = totalCals;
  const sp = document.getElementById('mp-sub-pro');  if(sp) sp.textContent = totalPro;
  const sr = document.getElementById('mp-sub-carb'); if(sr) sr.textContent = totalCarb;
  const sf = document.getElementById('mp-sub-fat');  if(sf) sf.textContent = totalFat;
}

// ── Confirm and Save Meal
function confirmAddMeal() {
  if (DP.pendingItems.length === 0) {
    alert('أضف أطعمة للوجبة أولا');
    return;
  }
  const type = DP.activeMealType;

  // v15: Meal Quality Engine check
  const quality = MQE.evaluate(DP.pendingItems, type);
  if (quality.issues.length > 0) {
    const issueText = quality.issues.join('\n');
    const proceed = confirm(`تحذير جودة الوجبة:\n${issueText}\n\nهل تريد الإضافة على أي حال؟`);
    if (!proceed) return;
  }

  const name = MEAL_LABELS[type] || type;
  DP.mealCounter++;
  DP.meals.push({
    id: DP.mealCounter,
    type,
    name,
    items: [...DP.pendingItems],
    qualityScore: quality.score,
    qualityBadges: quality.badges
  });
  closeAddMealPanel();
  renderDayPlan();
  updateDayTotals();
}

// ── Remove Meal
function removeMeal(mealId) {
  DP.meals = DP.meals.filter(m => m.id !== mealId);
  renderDayPlan();
  updateDayTotals();
}

// ── Clear Day
function clearDayPlan() {
  if (DP.meals.length === 0) return;
  if (confirm('مسح كل وجبات اليوم؟')) {
    DP.meals = [];
    renderDayPlan();
    updateDayTotals();
  }
}

// ── Render All Meal Cards
function renderDayPlan() {
  const container = document.getElementById('day-plan-meals');
  const empty     = document.getElementById('dp-empty');
  if (!container) return;

  if (DP.meals.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  // Sort by meal type order
  const order = ['breakfast','pre','lunch','post','snack','dinner'];
  const sorted = [...DP.meals].sort((a,b) => (order.indexOf(a.type)||99) - (order.indexOf(b.type)||99));

  container.innerHTML = sorted.map(meal => {
    const totCals = meal.items.reduce((s,i) => s+i.cals, 0);
    const totPro  = +meal.items.reduce((s,i) => s+i.pro, 0).toFixed(1);
    const totCarb = +meal.items.reduce((s,i) => s+i.carb,0).toFixed(1);
    const totFat  = +meal.items.reduce((s,i) => s+i.fat, 0).toFixed(1);
    const col     = MEAL_COLORS[meal.type] || 'var(--accent)';
    // v15: quality display
    const qs = meal.qualityScore !== undefined ? meal.qualityScore : MQE.evaluate(meal.items, meal.type).score;
    const ql = MQE.getScoreLabel(qs);
    const badges = (meal.qualityBadges||[]).slice(0,3).map(b => `<span style="font-size:10px;background:rgba(42,232,123,0.1);border-radius:6px;padding:1px 6px;color:var(--green);">${b}</span>`).join('');
    return `
    <div class="meal-card" style="margin-bottom:10px;border-color:${col}33;">
      <div class="meal-card-header">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:13px;font-weight:800;color:var(--text);">${meal.name}</span>
            <span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:12px;
                         background:${col}22;color:${col};">${MEAL_LABELS[meal.type]}</span>
            <span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:12px;
                         background:${ql.color}18;color:${ql.color};">جودة: ${ql.label} ${qs}%</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">
            <strong style="color:var(--accent);">${totCals} kcal</strong>
            ${badges ? `<span style="margin-right:6px;">${badges}</span>` : ''}
          </div>
        </div>
        <button onclick="removeMeal(${meal.id})"
          style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer;padding:4px;"></button>
      </div>
      <div class="meal-foods">
        ${meal.items.map(i => `
          <div class="food-item">
            <span class="food-name">${i.food.nameAr}</span>
            <span class="food-amount" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="background:rgba(42,140,232,0.15);color:var(--blue);border-radius:5px;padding:1px 7px;font-weight:800;font-size:12px;">${i.grams}جم</span>
              <span style="color:var(--accent);font-weight:800;font-size:12px;">${i.cals}</span>
              <span style="color:var(--green);font-size:11px;">${i.pro}ج</span>
            </span>
          </div>`).join('')}
      </div>
      <div class="meal-macros">
        <span class="macro-pill" style="color:var(--green);">${totPro}ج</span>
        <span class="macro-pill" style="color:var(--blue);">${totCarb}ج</span>
        <span class="macro-pill" style="color:var(--orange);">${totFat}ج</span>
      </div>
    </div>`;
  }).join('');
}

// ── Update Daily Totals + Progress Bars
function updateDayTotals() {
  const totCals = DP.meals.reduce((s,m) => s + m.items.reduce((ss,i) => ss+i.cals,0), 0);
  const totPro  = +DP.meals.reduce((s,m) => s + m.items.reduce((ss,i) => ss+i.pro, 0),0).toFixed(1);
  const totCarb = +DP.meals.reduce((s,m) => s + m.items.reduce((ss,i) => ss+i.carb,0),0).toFixed(1);
  const totFat  = +DP.meals.reduce((s,m) => s + m.items.reduce((ss,i) => ss+i.fat, 0),0).toFixed(1);

  const sc = document.getElementById('dp-total-cals'); if(sc) sc.textContent = totCals;
  const sp = document.getElementById('dp-total-pro');  if(sp) sp.textContent = totPro+'ج';
  const sr = document.getElementById('dp-total-carb'); if(sr) sr.textContent = totCarb+'ج';
  const sf = document.getElementById('dp-total-fat');  if(sf) sf.textContent = totFat+'ج';

  // Progress bars vs target
  const targetCals  = calcTargetCals ? calcTargetCals() : 0;
  const targetMacros = targetCals && DE.selectedDiet ? calcMacros(targetCals, DE.selectedDiet) : null;

  const bars = document.getElementById('dp-progress-bars');
  if (!bars || !targetCals) return;

  const pct  = (val, max) => Math.min(100, max > 0 ? Math.round(val/max*100) : 0);
  const color = (p) => p < 60 ? 'var(--blue)' : p <= 100 ? 'var(--green)' : 'var(--red)';

  const calsPct = pct(totCals, targetCals);
  const proPct  = targetMacros ? pct(totPro,  targetMacros.protein) : 0;
  const carbPct = targetMacros ? pct(totCarb, targetMacros.carbs)   : 0;
  const fatPct  = targetMacros ? pct(totFat,  targetMacros.fat)     : 0;

  bars.innerHTML = [
    ['سعرات', totCals, targetCals, calsPct, 'var(--accent)'],
    ['بروتين', totPro+'ج', targetMacros ? targetMacros.protein+'ج' : '—', proPct, 'var(--green)'],
    ['كارب',   totCarb+'ج', targetMacros ? targetMacros.carbs+'ج'   : '—', carbPct, 'var(--blue)'],
    ['دهون',  totFat+'ج',  targetMacros ? targetMacros.fat+'ج'     : '—', fatPct, 'var(--orange)']
  ].map(([lbl, val, max, p, col]) => `
    <div style="margin-bottom:7px;">
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;margin-bottom:3px;">
        <span style="color:${col};">${lbl}</span>
        <span style="color:var(--text-muted);">${val} / ${max} <span style="color:${color(p)};">(${p}%)</span></span>
      </div>
      <div style="height:6px;background:var(--surface3);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${p}%;background:${col};border-radius:3px;transition:width .5s;
             ${p > 100 ? 'background:var(--red);' : ''}"></div>
      </div>
    </div>`).join('');
}

// ── IMPORT / EXPORT ─────────────────────────────────────────────
LOG('Phase 7 — Import/Export System...');

function exportFoodDB() {
  const data = JSON.stringify(FOOD_DB, null, 2);
  const blob = new Blob([data], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'diet_engine_foods.json'; a.click();
  URL.revokeObjectURL(url);
  LOG('✔ Food DB exported');
}

function importFoodDB(event) {
  const file = event.target.files[0];
  if (!file) return;

  // ── PILLAR 3: Backup current state before any mutation ────────────────
  const _backup = FOOD_DB ? [...FOOD_DB] : [];

  // ── SCHEMA: Required keys and their expected types ────────────────────
  const REQUIRED_KEYS = { id: 'string', nameAr: 'string', cat: 'string',
                          cal: 'number', pro: 'number', carb: 'number', fat: 'number' };
  const ALLOWED_CATS  = new Set(['protein','carb','fat','veggie','fruit','dairy','snack']);
  const NUMERIC_KEYS  = ['cal','pro','carb','fat','satiety','glycemicIndex',
                          'glycemicLoad','insulinImpact','inflammationScore','healthyScore'];
  const ALLOWED_KEYS  = new Set([
    'id','nameAr','nameEn','cat','cal','pro','carb','fat','unit',
    'mealTypes','allowedDiets','avoidHealth','satiety','digestion','prep',
    'tags','glycemicIndex','glycemicLoad','insulinImpact','inflammationScore',
    'processedLevel','healthyScore','portionHint'
  ]);

  // ── PILLAR 1: Schema validator ────────────────────────────────────────
  function _validateEntry(f, idx) {
    // Required keys presence and type
    for (const [key, type] of Object.entries(REQUIRED_KEYS)) {
      if (f[key] === undefined || f[key] === null) {
        LOG(`[SECURITY-BLOCK]: Entry #${idx} missing required key "${key}". Import aborted`);
        return false;
      }
      if (type === 'number' && typeof f[key] !== 'number' && isNaN(parseFloat(f[key]))) {
        LOG(`[SECURITY-BLOCK]: Entry #${idx} key "${key}" is not a valid number. Import aborted`);
        return false;
      }
      if (type === 'string' && typeof f[key] !== 'string') {
        LOG(`[SECURITY-BLOCK]: Entry #${idx} key "${key}" must be a string. Import aborted`);
        return false;
      }
    }
    // id: no injection chars (prevent prototype pollution or XSS via ID)
    if (!/^[a-zA-Z0-9_\-]+$/.test(f.id)) {
      LOG(`[SECURITY-BLOCK]: Entry #${idx} id "${f.id}" contains illegal characters. Import aborted`);
      return false;
    }
    // id length cap
    if (f.id.length > 80) {
      LOG(`[SECURITY-BLOCK]: Entry #${idx} id too long (${f.id.length} chars). Import aborted`);
      return false;
    }
    // category must be known
    if (!ALLOWED_CATS.has(f.cat)) {
      LOG(`[SECURITY-BLOCK]: Entry #${idx} unknown category "${f.cat}". Import aborted`);
      return false;
    }
    // Numeric sanity: calories must be 0–900 per 100g, macros 0–100
    const cal  = parseFloat(f.cal);
    const pro  = parseFloat(f.pro);
    const carb = parseFloat(f.carb);
    const fat  = parseFloat(f.fat);
    if (cal < 0 || cal > 900)  { LOG(`[SECURITY-BLOCK]: Entry #${idx} "${f.id}" cal=${cal} out of range [0–900]`); return false; }
    if (pro < 0 || pro > 100)  { LOG(`[SECURITY-BLOCK]: Entry #${idx} "${f.id}" pro=${pro} out of range [0–100]`); return false; }
    if (carb < 0 || carb > 100){ LOG(`[SECURITY-BLOCK]: Entry #${idx} "${f.id}" carb=${carb} out of range [0–100]`); return false; }
    if (fat < 0 || fat > 100)  { LOG(`[SECURITY-BLOCK]: Entry #${idx} "${f.id}" fat=${fat} out of range [0–100]`); return false; }
    if (pro + carb + fat > 105){ LOG(`[SECURITY-BLOCK]: Entry #${idx} "${f.id}" macro sum ${pro+carb+fat}g > 105g/100g (impossible). Import aborted`); return false; }
    return true;
  }

  // ── PILLAR 2: Sanitizer — strips unknown fields, force-casts numerics ─
  function _sanitizeEntry(f) {
    const clean = {};
    for (const key of ALLOWED_KEYS) {
      if (f[key] === undefined) continue;
      clean[key] = f[key];
    }
    // Force-cast all numeric fields; NaN - 0
    for (const key of NUMERIC_KEYS) {
      if (clean[key] !== undefined) {
        const v = parseFloat(clean[key]);
        clean[key] = isFinite(v) ? v : 0;
      }
    }
    // Sanitize string fields: strip HTML tags, truncate
    if (clean.nameAr) clean.nameAr = String(clean.nameAr).replace(/<[^>]*>/g,'').trim().slice(0,80);
    if (clean.nameEn) clean.nameEn = String(clean.nameEn).replace(/<[^>]*>/g,'').trim().slice(0,80);
    if (clean.id)     clean.id     = String(clean.id).replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,80);
    // Arrays: ensure they are arrays of strings, no injection
    for (const arrKey of ['mealTypes','allowedDiets','avoidHealth','tags']) {
      if (clean[arrKey] !== undefined) {
        if (!Array.isArray(clean[arrKey])) { clean[arrKey] = []; continue; }
        clean[arrKey] = clean[arrKey]
          .filter(v => typeof v === 'string' && v.length < 50)
          .map(v => v.replace(/<[^>]*>/g,'').trim())
          .slice(0, 30);
      }
    }
    // Mark as user-imported for traceability
    clean._imported = true;
    return clean;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      // ── Parse ──────────────────────────────────────────────────
      let raw;
      try {
        raw = JSON.parse(e.target.result);
      } catch (parseErr) {
        LOG(`[SECURITY-BLOCK]: Invalid JSON syntax — ${parseErr.message}. Import aborted`);
        alert('الملف لا يحتوي على JSON صالح');
        return;
      }

      // Must be array
      if (!Array.isArray(raw)) {
        LOG('[SECURITY-BLOCK]: Invalid JSON structure detected. Import aborted');
        alert('هيكل الملف غير صحيح — يجب أن يكون array');
        return;
      }

      // Cap total entries to prevent memory DoS
      const MAX_IMPORT = 500;
      if (raw.length > MAX_IMPORT) {
        LOG(`[SECURITY-BLOCK]: Import exceeds ${MAX_IMPORT} entries (got ${raw.length}). Truncated for safety`);
        raw = raw.slice(0, MAX_IMPORT);
      }

      // ── PILLAR 1: Validate every entry ────────────────────────
      for (let i = 0; i < raw.length; i++) {
        if (typeof raw[i] !== 'object' || raw[i] === null || Array.isArray(raw[i])) {
          LOG(`[SECURITY-BLOCK]: Entry #${i} is not a valid object. Import aborted`);
          alert(`الإدخال رقم ${i+1} ليس كائنا صحيحا`);
          FOOD_DB = _backup;  // PILLAR 3: restore
          return;
        }
        if (!_validateEntry(raw[i], i)) {
          alert(`بيانات غير صالحة في الإدخال رقم ${i+1}. تم إلغاء الاستيراد`);
          FOOD_DB = _backup;  // PILLAR 3: restore
          return;
        }
      }

      // ── PILLAR 2: Sanitize all entries ─────────────────────────
      const sanitized = raw.map((f, i) => _sanitizeEntry(f));

      // ── Merge: skip IDs already in DB (no silent override) ─────
      const existingIds = new Set(FOOD_DB.map(f => f.id));
      const newFoods    = sanitized.filter(f => !existingIds.has(f.id));
      const duplicates  = sanitized.length - newFoods.length;

      // ── Apply to FOOD_DB ───────────────────────────────────────
      FOOD_DB = [...FOOD_DB, ...newFoods];

      // ── PILLAR 3: Verify state is valid after mutation ─────────
      if (!Array.isArray(FOOD_DB) || FOOD_DB.length === 0) {
        LOG('[SECURITY-BLOCK]: Post-import state invalid. Rolling back');
        FOOD_DB = _backup;
        alert('فشل التحقق من الحالة بعد الاستيراد. تم الاستعادة');
        return;
      }

      // ── Sync engine state ──────────────────────────────────────
      if (typeof rebuildFoodMap === 'function') rebuildFoodMap();
      FoodStorage.save(FOOD_DB);
      const el = document.getElementById('db-food-count');
      if (el) el.textContent = `${FOOD_DB.length} طعام في القاعدة`;
      onFoodSearch(document.getElementById('food-search-input')?.value || '');

      // ── PILLAR 4: Detailed success log ─────────────────────────
      LOG(`[DATA-SUCCESS]: New database loaded with ${newFoods.length} items`);
      LOG(`[IMPORT-DETAIL]: total_in_file=${raw.length} | accepted=${newFoods.length} | duplicates_skipped=${duplicates} | db_total=${FOOD_DB.length}`);

      alert(`تم استيراد ${newFoods.length} طعام جديد\n${duplicates > 0 ? `(تم تجاهل ${duplicates} مكرر)` : ''}\nإجمالي القاعدة: ${FOOD_DB.length} طعام`);

    } catch (err) {
      // ── PILLAR 3: Catch-all rollback ────────────────────────────
      LOG(`[SECURITY-BLOCK]: Unexpected error during import — ${err.message}. Rolling back`);
      FOOD_DB = _backup;
      if (typeof rebuildFoodMap === 'function') rebuildFoodMap();
      alert('خطأ غير متوقع. تم استعادة القاعدة السابقة');
    }
  };

  reader.onerror = () => {
    LOG('[SECURITY-BLOCK]: File read error. Import aborted');
    FOOD_DB = _backup;
    alert('تعذر قراءة الملف');
  };

  reader.readAsText(file, 'UTF-8');
}

LOG('✔ Phase 7 Complete — Import/Export ready');
